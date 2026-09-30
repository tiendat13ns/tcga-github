from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_db
from app.core.ownership import verify_requirement_owner
from app.models import Document, Project, User
from app.schemas.requirement_schema import (
    BulkRequirementsResponse,
    GenerationStartedResponse,
    ListRequirementsResponse,
    RequirementInputUpdateRequest,
    RequirementResponse,
    RequirementStatusListResponse,
)
from app.services.credit_service import CREDIT_COST
from app.services.generation import job_runner
from app.services.generation.requirement_generation_service import (
    RequirementGenerationError,
    list_requirement_statuses_by_document,
    list_requirements_by_document,
    list_requirements_by_project,
    run_requirement_generation_job,
    requirement_to_response,
    set_document_requirement_status,
)

router = APIRouter(prefix="/api/v1", tags=["requirements"])


def _verify_document_owner(db: Session, document_id: str, user: User) -> Document:
    """Đảm bảo document thuộc project của chính user đang đăng nhập (chặn thao tác chéo tài khoản).
    Trả về Document để caller dùng lại (tránh query lặp)."""
    try:
        doc_uuid = UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc = db.get(Document, doc_uuid)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.project_id is None:
        raise HTTPException(status_code=403, detail="Không xác định được chủ sở hữu tài liệu.")
    project = db.get(Project, doc.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền trên tài liệu này.")
    return doc


@router.post(
    "/documents/{document_id}/requirements/generate",
    response_model=GenerationStartedResponse,
    status_code=202,
)
async def generate_document_requirements(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Nhận yêu cầu sinh requirement rồi chạy NỀN — trả 202 ngay, không bắt người dùng chờ LLM.
    Frontend poll trạng thái qua documents list (requirement_status). Credit chỉ trừ khi job
    thành công (trong background)."""
    doc = _verify_document_owner(db, document_id, current_user)
    # Chặn sớm nếu không đủ credit — tránh chạy job rồi mới báo thiếu.
    cost = CREDIT_COST.get("REQUIREMENT_EXTRACTION", 0)
    if current_user.credit_balance < cost:
        raise HTTPException(
            status_code=402,
            detail=f"Không đủ Credit. Cần {cost} Credits nhưng chỉ còn {current_user.credit_balance}.",
        )
    if doc.status != "completed":
        raise HTTPException(status_code=400, detail="Tài liệu chưa xử lý xong.")
    if doc.requirement_status == "generating":
        raise HTTPException(status_code=409, detail="Tài liệu này đang được sinh requirement.")

    # Đánh dấu generating vào DB TRƯỚC khi trả về để frontend poll thấy ngay.
    set_document_requirement_status(document_id, "generating", None)
    job_runner.submit(run_requirement_generation_job(document_id, str(current_user.id)))
    return GenerationStartedResponse(status="generating", document_id=document_id)


@router.get("/documents/{document_id}/requirements", response_model=ListRequirementsResponse)
def get_document_requirements(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_document_owner(db, document_id, current_user)
    try:
        return list_requirements_by_document(document_id)
    except RequirementGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get(
    "/documents/{document_id}/requirements/status",
    response_model=RequirementStatusListResponse,
)
def get_document_requirement_statuses(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Endpoint POLL nhẹ: chỉ trả (id, test_case_status, test_case_error) của từng requirement,
    để frontend hỏi trạng thái sinh test case mỗi vài giây mà không kéo lại toàn bộ nội dung."""
    _verify_document_owner(db, document_id, current_user)
    try:
        return list_requirement_statuses_by_document(document_id)
    except RequirementGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def _verify_project_owner(db: Session, project_id: str, user: User) -> None:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Project not found.") from exc
    project = db.get(Project, project_uuid)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found.")


@router.get("/projects/{project_id}/requirements", response_model=BulkRequirementsResponse)
def get_project_requirements(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Requirements của mọi document trong project, 1 request duy nhất — dùng ở trang danh
    sách document để tránh gọi /documents/{id}/requirements riêng cho từng document (N+1)."""
    _verify_project_owner(db, project_id, current_user)
    try:
        return list_requirements_by_project(project_id)
    except RequirementGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.patch("/requirements/{requirement_id}/answers", response_model=RequirementResponse)
def submit_requirement_answers(
    requirement_id: str,
    body: RequirementInputUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update clarifying answers and/or the BA/QA user's confirmed context."""
    req = verify_requirement_owner(db, requirement_id, current_user)
    if "answers" in body.model_fields_set:
        req.user_answers = body.answers
    if "user_context" in body.model_fields_set:
        req.user_context = body.user_context
    db.commit()
    db.refresh(req)

    return requirement_to_response(req)
