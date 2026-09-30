"""
Orchestrator: Document đã extract text → RAG lấy context liên quan → gọi LLM sinh
Requirement → lưu DB. Đây là entry point chính được routers/requirements.py gọi.

Luồng generate_requirements_from_document():
  1. Lấy top-k chunk liên quan nhất từ document_chunks (retrieval_service) — fallback về
     toàn bộ extracted_text nếu chưa có chunk nào (chưa embed xong hoặc document quá ngắn).
  2. Build prompt (prompts/requirement_extraction_prompt.py) rồi gọi LLM
     (services/agent/workflow_service.extract_requirements_node).
  3. Xoá requirement cũ của document (nếu có) rồi lưu requirement mới vào DB.

Theo thiết kế hiện tại, một document luôn được tổng hợp thành ĐÚNG 1 Requirement duy nhất
(xem rule trong requirement_extraction_prompt.py) — quy ước 1 file = 1 use case.
"""

import logging
import os
import time
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal, is_database_configured
from app.models import Document, Requirement, User
from app.repositories.requirement_repository import RequirementRepository
from app.services.credit_service import deduct_user_credits
from app.schemas.requirement_schema import (
    BulkRequirementsResponse,
    GenerateRequirementsResponse,
    ListRequirementsResponse,
    RequirementResponse,
    RequirementStatusItem,
    RequirementStatusListResponse,
)
from app.services.agent.workflow_service import extract_requirements_node
from app.services.generation.requirement_coverage_service import (
    build_context_batches,
    deduplicate_requirements,
    extract_source_sections,
    find_uncovered_sections,
)

logger = logging.getLogger(__name__)


class RequirementGenerationError(RuntimeError):
    status_code = 400


class RequirementGenerationNotFoundError(RequirementGenerationError):
    status_code = 404


class RequirementGenerationAIError(RequirementGenerationError):
    status_code = 502


def _coerce_to_list(value) -> list[str] | None:
    """Chuyển đổi an toàn: str → [str], list giữ nguyên, None → None."""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        return [value]
    return None


def requirement_to_response(requirement: Requirement) -> RequirementResponse:
    return RequirementResponse(
        id=str(requirement.id),
        title=requirement.title,
        description=requirement.description,
        functional_requirement=requirement.functional_requirement,
        validation_rule=_coerce_to_list(requirement.validation_rule),
        permission=_coerce_to_list(requirement.permission),
        workflow=_coerce_to_list(requirement.workflow),
        state=_coerce_to_list(requirement.state),
        error_handling=_coerce_to_list(requirement.error_handling),
        module_name=requirement.module_name,
        feature_name=requirement.feature_name,
        actor=requirement.actor,
        goal=requirement.goal,
        trigger=requirement.trigger,
        business_rules=_coerce_to_list(requirement.business_rules),
        inputs=_coerce_to_list(requirement.inputs),
        outputs=_coerce_to_list(requirement.outputs),
        preconditions=_coerce_to_list(requirement.preconditions),
        validation_rules=_coerce_to_list(requirement.validation_rules),
        exception_flows=_coerce_to_list(requirement.exception_flows),
        source_reference=requirement.source_reference,
        components=requirement.components,
        error_messages=requirement.error_messages,
        status=requirement.status,
        version=requirement.version,
        clarifying_questions=_coerce_to_list(requirement.clarifying_questions),
        user_answers=_coerce_to_list(requirement.user_answers),
        user_context=requirement.user_context,
        test_case_status=requirement.test_case_status,
        test_case_error=requirement.test_case_error,
    )


async def generate_requirements_from_document(document_id: str) -> GenerateRequirementsResponse:
    if not is_database_configured():
        raise RequirementGenerationError("Database is not configured")

    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise RequirementGenerationNotFoundError("Document not found.") from exc

    with SessionLocal() as db:
        document = db.get(Document, document_uuid)

        if document is None:
            raise RequirementGenerationNotFoundError("Document not found.")

        if document.status != "completed":
            raise RequirementGenerationError("Document must be completed before requirement generation.")

        if not document.extracted_text or not document.extracted_text.strip():
            raise RequirementGenerationError("Document has no extracted text.")

        project_id = getattr(document, "project_id", None)
        doc_id_str = str(document.id)
        extracted_text = document.extracted_text
        original_filename = document.original_filename
        document_type = document.file_type

    context_max_chars = int(os.getenv("REQUIREMENT_CONTEXT_MAX_CHARS", "24000"))
    source_sections = extract_source_sections(extracted_text)
    context_batches = build_context_batches(
        source_sections,
        max_chars=context_max_chars,
    )
    logger.info(
        "Requirement coverage: document=%s sections=%d batches=%d titles=%s",
        doc_id_str,
        len(source_sections),
        len(context_batches),
        [section.title for section in source_sections],
    )

    # Sử dụng Workflow Agent với Structured Output
    started_at = time.perf_counter()
    error_message: str | None = None

    try:
        from app.prompts.requirement_extraction_prompt import build_user_prompt
        
        result_items: list = []
        for batch_index, retrieved_context in enumerate(context_batches, start=1):
            user_prompt = build_user_prompt(
                project_context="",
                document_id=doc_id_str,
                file_name=original_filename,
                document_type=document_type,
                retrieved_context=retrieved_context,
            )
            batch_result = await extract_requirements_node(user_prompt, document_id)
            result_items.extend(batch_result.requirements)
            logger.info(
                "Requirement coverage: document=%s batch=%d/%d generated=%d",
                doc_id_str, batch_index, len(context_batches), len(batch_result.requirements),
            )

        result_items = deduplicate_requirements(result_items)
        uncovered_sections = find_uncovered_sections(source_sections, result_items)
        if uncovered_sections:
            logger.warning(
                "Requirement coverage incomplete after first pass: document=%s uncovered=%s",
                doc_id_str, [section.title for section in uncovered_sections],
            )
            for supplementary_context in build_context_batches(
                uncovered_sections,
                max_chars=context_max_chars,
            ):
                supplementary_prompt = build_user_prompt(
                    project_context="",
                    document_id=doc_id_str,
                    file_name=original_filename,
                    document_type=document_type,
                    retrieved_context=supplementary_context,
                )
                supplementary_result = await extract_requirements_node(supplementary_prompt, document_id)
                result_items.extend(supplementary_result.requirements)
            result_items = deduplicate_requirements(result_items)

        still_uncovered = find_uncovered_sections(source_sections, result_items)
        logger.log(
            logging.WARNING if still_uncovered else logging.INFO,
            "Requirement coverage result: document=%s detected=%d covered=%d uncovered=%s",
            doc_id_str,
            len(source_sections),
            len(source_sections) - len(still_uncovered),
            [section.title for section in still_uncovered],
        )
        if not result_items:
            raise RequirementGenerationAIError("AI returned no requirements for the document.")
        execution_time_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info("Agent extract_requirements completed in %d ms", execution_time_ms)
    except Exception as exc:
        error_message = str(exc)
        raise RequirementGenerationAIError(error_message) from exc

    try:
        with SessionLocal() as db:
            document = db.get(Document, document_uuid)

            if document is None:
                raise RequirementGenerationNotFoundError("Document not found.")

            repository = RequirementRepository(db)

            # Xóa requirements cũ + test cases liên quan trước khi tạo mới
            # Delete + insert share one transaction so a failed replacement preserves old data.
            deleted_count = repository.delete_by_document_id(document.id, commit=False)
            if deleted_count > 0:
                logger.info(
                    "Replaced %d old requirement(s) for document %s before generating new ones.",
                    deleted_count, doc_id_str,
                )

            requirements = [
                Requirement(
                    project_id=getattr(document, "project_id", None),
                    document_id=document.id,
                    title=item.title,
                    description=item.description,
                    functional_requirement=item.functional_requirement or item.description,
                    validation_rule=item.validation_rule,
                    workflow=item.workflow,
                    error_handling=item.error_handling,
                    permission=item.permission,
                    state=item.state,
                    clarifying_questions=item.clarifying_questions,
                    module_name=item.module,
                    feature_name=item.feature,
                    actor=item.actor,
                    goal=item.goal,
                    trigger=item.trigger,
                    business_rules=item.business_rule,
                    inputs=item.input_data,
                    outputs=item.output_data,
                    preconditions=item.preconditions,
                    exception_flows=item.exception_flow,
                    source_reference=item.source_reference,
                    components=[component.model_dump() for component in (item.components or [])],
                    error_messages=[message.model_dump() for message in (item.error_messages or [])],
                    status="ai_generated",
                    version=1,
                    updated_at=datetime.now(),
                )
                for item in result_items
            ]

            saved_requirements = repository.create_many(requirements)

        return GenerateRequirementsResponse(
            document_id=str(document_uuid),
            project_id=str(project_id) if project_id else None,
            total_requirements=len(saved_requirements),
            requirements=[requirement_to_response(r) for r in saved_requirements],
        )
    except SQLAlchemyError as exc:
        raise RequirementGenerationError("Database save failed") from exc


def set_document_requirement_status(document_id: str, status: str | None, error: str | None) -> None:
    """Cập nhật trạng thái sinh requirement của document (None/"generating"/"failed") vào DB
    — nguồn sự thật để frontend poll. Mở session riêng nên gọi được từ background task."""
    if not is_database_configured():
        return
    try:
        with SessionLocal() as db:
            doc = db.get(Document, UUID(document_id))
            if doc is not None:
                doc.requirement_status = status
                doc.requirement_error = error
                db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Could not update requirement_status for document %s", document_id)


async def run_requirement_generation_job(document_id: str, user_id: str) -> None:
    """Background job: sinh requirement rồi trừ credit khi thành công, cập nhật trạng thái
    "failed" nếu lỗi. Tự quản session riêng — không dùng session/request của endpoint."""
    try:
        await generate_requirements_from_document(document_id)
    except Exception as exc:  # noqa: BLE001
        set_document_requirement_status(document_id, "failed", str(exc)[:500])
        raise
    # Thành công: trừ credit + xoá trạng thái generating.
    try:
        with SessionLocal() as db:
            user = db.get(User, UUID(user_id))
            if user is not None:
                deduct_user_credits(db, user, "REQUIREMENT_EXTRACTION")
    except Exception:  # noqa: BLE001
        logger.exception("Requirement generated but credit deduction failed for user %s", user_id)
    set_document_requirement_status(document_id, None, None)


def list_requirements_by_document(document_id: str) -> ListRequirementsResponse:
    if not is_database_configured():
        raise RequirementGenerationError("Database is not configured")

    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise RequirementGenerationNotFoundError("Document not found.") from exc

    with SessionLocal() as db:
        repository = RequirementRepository(db)
        requirements = repository.list_latest_by_document_id(document_uuid)

        return ListRequirementsResponse(
            document_id=str(document_uuid),
            total_requirements=len(requirements),
            requirements=[requirement_to_response(req) for req in requirements],
        )


def list_requirement_statuses_by_document(document_id: str) -> RequirementStatusListResponse:
    """Chỉ trả về trạng thái sinh test case của các requirement (version mới nhất) trong
    document — dùng cho polling nhẹ mỗi vài giây, không kéo toàn bộ nội dung requirement."""
    if not is_database_configured():
        raise RequirementGenerationError("Database is not configured")

    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise RequirementGenerationNotFoundError("Document not found.") from exc

    with SessionLocal() as db:
        repository = RequirementRepository(db)
        rows = repository.list_status_by_document_id(document_uuid)

        return RequirementStatusListResponse(
            document_id=str(document_uuid),
            requirements=[
                RequirementStatusItem(
                    id=str(row.id),
                    test_case_status=row.test_case_status,
                    test_case_error=row.test_case_error,
                )
                for row in rows
            ],
        )


def list_requirements_by_project(project_id: str) -> BulkRequirementsResponse:
    """Trả về requirements của mọi document trong project bằng 1 query — dùng để tránh
    trang danh sách document phải gọi list_requirements_by_document() N lần (1 lần/document)."""
    if not is_database_configured():
        raise RequirementGenerationError("Database is not configured")

    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise RequirementGenerationNotFoundError("Project not found.") from exc

    with SessionLocal() as db:
        repository = RequirementRepository(db)
        grouped = repository.list_latest_by_project_id(project_uuid)

        return BulkRequirementsResponse(
            documents={
                str(document_id): ListRequirementsResponse(
                    document_id=str(document_id),
                    total_requirements=len(reqs),
                    requirements=[requirement_to_response(req) for req in reqs],
                )
                for document_id, reqs in grouped.items()
            }
        )
