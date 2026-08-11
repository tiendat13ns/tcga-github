from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_db
from app.models import Document, Project, Requirement, User
from app.schemas.requirement_schema import (
    GenerateRequirementsResponse,
    ListRequirementsResponse,
    RequirementResponse,
)
from app.services.credit_service import CREDIT_COST, deduct_user_credits
from app.services.generation.requirement_generation_service import (
    RequirementGenerationError,
    generate_requirements_from_document,
    list_requirements_by_document,
)

router = APIRouter(prefix="/api/v1", tags=["requirements"])


class SubmitAnswersRequest(BaseModel):
    answers: list[str]


def _verify_document_owner(db: Session, document_id: str, user: User) -> None:
    """Đảm bảo document thuộc project của chính user đang đăng nhập (chặn thao tác chéo tài khoản)."""
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


@router.post("/documents/{document_id}/requirements/generate", response_model=GenerateRequirementsResponse)
async def generate_document_requirements(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_document_owner(db, document_id, current_user)
    # Chặn sớm nếu không đủ credit — tránh gọi LLM tốn kém rồi mới báo thiếu.
    cost = CREDIT_COST.get("REQUIREMENT_EXTRACTION", 0)
    if current_user.credit_balance < cost:
        raise HTTPException(
            status_code=402,
            detail=f"Không đủ Credit. Cần {cost} Credits nhưng chỉ còn {current_user.credit_balance}.",
        )
    try:
        result = await generate_requirements_from_document(document_id)
    except RequirementGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    # Chỉ trừ credit khi sinh thành công (nhất quán với luồng chat).
    deduct_user_credits(db, current_user, "REQUIREMENT_EXTRACTION")
    return result


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


def _verify_requirement_owner(db: Session, requirement_id: str, user: User) -> Requirement:
    """Đảm bảo requirement thuộc project của chính user đang đăng nhập (chặn thao tác chéo tài khoản)."""
    try:
        req_uuid = UUID(requirement_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Requirement not found") from exc
    req = db.get(Requirement, req_uuid)
    if req is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    project_id = req.project_id
    if project_id is None and req.document_id is not None:
        doc = db.get(Document, req.document_id)
        project_id = doc.project_id if doc else None
    if project_id is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return req


@router.patch("/requirements/{requirement_id}/answers", response_model=RequirementResponse)
def submit_requirement_answers(
    requirement_id: str,
    body: SubmitAnswersRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User submits answers to the AI's clarifying questions for a requirement."""
    req = _verify_requirement_owner(db, requirement_id, current_user)
    req.user_answers = body.answers
    db.commit()
    db.refresh(req)

    return RequirementResponse(
        id=str(req.id),
        title=req.title,
        description=req.description,
        functional_requirement=req.functional_requirement,
        validation_rule=req.validation_rule,
        permission=req.permission,
        workflow=req.workflow,
        state=req.state,
        error_handling=req.error_handling,
        module_name=req.module_name,
        feature_name=req.feature_name,
        actor=req.actor,
        business_rules=req.business_rules,
        inputs=req.inputs,
        outputs=req.outputs,
        preconditions=req.preconditions,
        validation_rules=req.validation_rules,
        exception_flows=req.exception_flows,
        source_reference=req.source_reference,
        status=req.status,
        version=req.version,
        clarifying_questions=req.clarifying_questions,
        user_answers=req.user_answers,
    )
