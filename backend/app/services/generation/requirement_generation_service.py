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
)
from app.services.rag.retrieval_service import retrieve_relevant_chunks_async
from app.services.agent.workflow_service import extract_requirements_node

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


def _requirement_to_response(requirement: Requirement) -> RequirementResponse:
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
        business_rules=_coerce_to_list(requirement.business_rules),
        inputs=_coerce_to_list(requirement.inputs),
        outputs=_coerce_to_list(requirement.outputs),
        preconditions=_coerce_to_list(requirement.preconditions),
        validation_rules=_coerce_to_list(requirement.validation_rules),
        exception_flows=_coerce_to_list(requirement.exception_flows),
        source_reference=requirement.source_reference,
        status=requirement.status,
        version=requirement.version,
        clarifying_questions=_coerce_to_list(requirement.clarifying_questions),
        user_answers=_coerce_to_list(requirement.user_answers),
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
        fallback_text = document.extracted_text

        # RAG: Lấy các chunks liên quan nhất từ DB thay vì nhồi toàn bộ văn bản.
        RAG_QUERY = (
            "software requirements, features, user stories, business rules, "
            "functional requirements, use cases, actors, workflows, validations, "
            "permissions, error handling, system behavior"
        )
        retrieved_chunks = await retrieve_relevant_chunks_async(
            db,
            RAG_QUERY,
            top_k=12,
            document_id=doc_id_str,
            project_id=str(project_id) if project_id else None,
        )

    # Nếu chưa có chunks trong DB, fallback về extracted_text
    if retrieved_chunks:
        retrieved_context = "\n\n---\n\n".join(retrieved_chunks)
        logger.info(
            "RAG: using %d retrieved chunks for document %s (skipping full extracted_text)",
            len(retrieved_chunks),
            doc_id_str,
        )
    else:
        retrieved_context = fallback_text
        logger.warning(
            "RAG: no chunks found for document %s, falling back to full extracted_text",
            doc_id_str,
        )

    # Sử dụng Workflow Agent với Structured Output
    started_at = time.perf_counter()
    error_message: str | None = None

    try:
        from app.prompts.requirement_extraction_prompt import build_user_prompt
        
        user_prompt = build_user_prompt(
            project_context="",  # Hiện tại chưa truyền project_context cụ thể
            document_id=doc_id_str,
            file_name=getattr(document, "file_name", "Unknown File"),
            document_type=getattr(document, "file_type", "Unknown Type"),
            retrieved_context=retrieved_context
        )
        
        result = await extract_requirements_node(user_prompt, document_id)
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
            deleted_count = repository.delete_by_document_id(document.id)
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
                    business_rules=item.business_rule,
                    inputs=item.input_data,
                    outputs=item.output_data,
                    preconditions=item.preconditions,
                    exception_flows=item.exception_flow,
                    source_reference=item.source_reference,
                    status="ai_generated",
                    version=1,
                    updated_at=datetime.now(),
                )
                for item in result.requirements
            ]

            saved_requirements = repository.create_many(requirements)

        return GenerateRequirementsResponse(
            document_id=str(document_uuid),
            project_id=str(project_id) if project_id else None,
            total_requirements=len(saved_requirements),
            requirements=[_requirement_to_response(r) for r in saved_requirements],
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
            requirements=[_requirement_to_response(req) for req in requirements],
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
                    requirements=[_requirement_to_response(req) for req in reqs],
                )
                for document_id, reqs in grouped.items()
            }
        )
