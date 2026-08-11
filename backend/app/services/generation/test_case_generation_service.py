"""
Orchestrator: Requirement đã lưu DB → RAG lấy context gốc từ tài liệu → gọi LLM sinh
Test Case (chuẩn ISTQB, black-box) → lưu DB. Entry point chính do routers/test_cases.py gọi.

Luồng generate_test_cases_from_requirement():
  1. Lấy lại các field của Requirement (functional_requirement, validation_rule, workflow...)
     làm nguồn chính cho prompt.
  2. Bổ sung thêm context RAG từ CHÍNH document gốc (scope theo document_id) để có thêm dữ
     liệu cụ thể (test data, edge case) mà các field Requirement có thể chưa nêu hết.
  3. Nếu requirement có clarifying_questions đã được người dùng trả lời (Q&A HITL), coi mỗi
     câu trả lời là 1 business rule đã xác nhận và bắt AI sinh test case riêng cho nó.
  4. Build prompt (prompts/test_case_generation_prompt.py), gọi LLM, lưu test case mới với
     version tăng dần (không xoá test case cũ như bên Requirement — giữ lịch sử các lần sinh).
"""

import logging
import os
import time
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal, is_database_configured
from app.models import Requirement, TestCase
from app.repositories.test_case_repository import TestCaseRepository
from app.schemas.test_case_schema import GenerateTestCasesResponse, ListTestCasesResponse, TestCaseResponse
from app.services.rag.retrieval_service import retrieve_relevant_chunks_async
from app.services.agent.workflow_service import generate_test_cases_node

logger = logging.getLogger(__name__)


class TestCaseGenerationError(RuntimeError):
    status_code = 400


class TestCaseGenerationNotFoundError(TestCaseGenerationError):
    status_code = 404


class TestCaseGenerationAIError(TestCaseGenerationError):
    status_code = 502


def _test_case_to_response(tc: TestCase) -> TestCaseResponse:
    return TestCaseResponse(
        id=str(tc.id),
        requirement_id=str(tc.requirement_id),
        document_id=str(tc.document_id) if tc.document_id else None,
        title=tc.title,
        scenario=tc.scenario,
        preconditions=tc.preconditions,
        test_steps=tc.test_steps,
        test_data=tc.test_data,
        expected_result=tc.expected_result,
        priority=tc.priority,
        severity=tc.severity,
        test_type=tc.test_type,
        automation_candidate=tc.automation_candidate,
        execution_type=tc.execution_type,
        execution_status=tc.execution_status,
        actual_result=tc.actual_result,
        status=tc.status,
        note=tc.note,
        version=tc.version,
    )


async def generate_test_cases_from_requirement(requirement_id: str) -> GenerateTestCasesResponse:
    if not is_database_configured():
        raise TestCaseGenerationError("Database is not configured")

    try:
        requirement_uuid = UUID(requirement_id)
    except ValueError as exc:
        raise TestCaseGenerationNotFoundError("Requirement not found.") from exc

    with SessionLocal() as db:
        requirement = db.get(Requirement, requirement_uuid)

        if requirement is None:
            raise TestCaseGenerationNotFoundError("Requirement not found.")

        if requirement.status == "rejected":
            raise TestCaseGenerationError(
                "Cannot generate test cases for a rejected requirement."
            )

        # Detach tất cả data cần dùng trước khi session đóng
        req_id = requirement.id
        doc_id = requirement.document_id
        req_title = requirement.title
        req_description = requirement.description
        req_functional = requirement.functional_requirement
        req_business_rules = requirement.business_rules
        req_validation_rule = requirement.validation_rule
        req_preconditions = requirement.preconditions
        req_workflow = requirement.workflow
        req_error_handling = requirement.error_handling
        req_state = requirement.state
        req_permission = requirement.permission
        req_exception_flows = requirement.exception_flows
        req_inputs = requirement.inputs
        req_outputs = requirement.outputs

        # RAG: Lấy các chunks liên quan nhất từ đúng tài liệu gốc
        document_context: str | None = None
        if doc_id:
            rag_query = f"{req_title}: {req_description or req_functional or ''}"
            project_id = getattr(requirement, "project_id", None)
            chunks = await retrieve_relevant_chunks_async(
                db,
                rag_query,
                top_k=15,
                document_id=str(doc_id),   # ← scope đúng vào document, không bị ô nhiễm từ file khác
                project_id=str(project_id) if project_id else None,
            )
            if chunks:
                document_context = "\n\n---\n\n".join(chunks)
                logger.info(
                    "RAG: enriched test case prompt for requirement %s with %d chunks from document %s",
                    req_id, len(chunks), doc_id,
                )
            else:
                logger.warning(
                    "RAG: no chunks found for document %s (requirement %s), using requirement fields only",
                    doc_id, req_id,
                )

    def _fmt(val) -> str:
        """Format list or scalar thành chuỗi có thể đọc được cho LLM."""
        if val is None:
            return "(none)"
        if isinstance(val, list):
            return "\n".join(f"- {item}" for item in val) if val else "(none)"
        return str(val)

    started_at = time.perf_counter()
    error_message: str | None = None

    try:
        from app.prompts.test_case_generation_prompt import build_user_prompt

        # Sinh test case theo BATCH để đạt ~20-25 case mà mỗi lời gọi vẫn dưới trần token (~10K)
        # của model → không cắt cụt. Mỗi batch sinh ~≤12 case; batch sau nhận danh sách title đã
        # sinh để tạo case KHÁC, bổ sung (adaptive: requirement đơn giản thì batch sau trả ít/rỗng).
        # Số batch chỉnh qua TEST_CASE_BATCHES (mặc định 2 → ~24 case tối đa).
        num_batches = max(1, int(os.getenv("TEST_CASE_BATCHES", "2")))
        all_items: list = []
        seen_titles: set[str] = set()

        for batch_idx in range(num_batches):
            exclude = list(seen_titles) if batch_idx > 0 else None
            user_prompt = build_user_prompt(requirement, document_context, exclude_titles=exclude)
            try:
                result = await generate_test_cases_node(user_prompt, requirement_id)
            except Exception as batch_exc:
                if batch_idx == 0:
                    raise  # batch đầu bắt buộc phải thành công
                # Batch bổ sung là best-effort — lỗi thì vẫn lưu những gì đã có.
                logger.warning(
                    "Batch %d/%d sinh test case thất bại (%s) — dùng %d case đã có.",
                    batch_idx + 1, num_batches, batch_exc, len(all_items),
                )
                break

            added = 0
            for item in result.test_cases:
                key = (item.title or "").strip().lower()
                if key and key in seen_titles:
                    continue  # loại case trùng title giữa các batch
                if key:
                    seen_titles.add(key)
                all_items.append(item)
                added += 1
            logger.info(
                "Batch %d/%d: thêm %d test case mới (tổng %d).",
                batch_idx + 1, num_batches, added, len(all_items),
            )
            # Batch bổ sung không thêm được case mới nào → hết đất → dừng sớm, khỏi tốn lời gọi.
            if batch_idx > 0 and added == 0:
                break

        execution_time_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info(
            "Agent generate_test_cases completed in %d ms — %d test cases",
            execution_time_ms, len(all_items),
        )
    except Exception as exc:
        error_message = str(exc)
        raise TestCaseGenerationAIError(error_message) from exc

    try:
        with SessionLocal() as db:
            repository = TestCaseRepository(db)
            version = repository.get_latest_version_by_requirement_id(req_id) + 1

            test_cases = [
                TestCase(
                    requirement_id=req_id,
                    document_id=doc_id,
                    title=item.title,
                    scenario=item.scenario,
                    preconditions=item.preconditions,
                    test_steps=item.test_steps,
                    test_data=item.test_data,
                    expected_result=item.expected_result,
                    priority=item.priority,
                    severity=item.severity,
                    test_type=item.test_type,
                    automation_candidate=item.automation_candidate,
                    execution_type=item.execution_type,
                    status="ai_generated",
                    version=version,
                    updated_at=datetime.now(),
                )
                for item in all_items
            ]

            saved = repository.create_many(test_cases)

        return GenerateTestCasesResponse(
            requirement_id=str(req_id),
            document_id=str(doc_id) if doc_id else None,
            total_test_cases=len(saved),
            test_cases=[_test_case_to_response(tc) for tc in saved],
        )

    except SQLAlchemyError as exc:
        db_error = str(exc.orig) if hasattr(exc, "orig") and exc.orig else str(exc)
        raise TestCaseGenerationError(f"Database save failed: {db_error}") from exc


def list_test_cases_by_requirement(requirement_id: str) -> ListTestCasesResponse:
    if not is_database_configured():
        raise TestCaseGenerationError("Database is not configured")

    try:
        requirement_uuid = UUID(requirement_id)
    except ValueError as exc:
        raise TestCaseGenerationNotFoundError("Requirement not found.") from exc

    with SessionLocal() as db:
        requirement = db.get(Requirement, requirement_uuid)

        if requirement is None:
            raise TestCaseGenerationNotFoundError("Requirement not found.")

        repository = TestCaseRepository(db)
        test_cases = repository.list_by_requirement_id(requirement_uuid)

        return ListTestCasesResponse(
            requirement_id=str(requirement_uuid),
            total_test_cases=len(test_cases),
            test_cases=[_test_case_to_response(tc) for tc in test_cases],
        )
