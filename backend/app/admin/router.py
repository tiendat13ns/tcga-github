from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.admin import service
from app.admin.schemas import UpdateCreditRequest, UpdateFeedbackStatusRequest, UpdatePlanRequest
from app.core.auth import get_db, require_admin
from app.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> Any:
    return service.get_admin_stats(db)


@router.get("/users")
def get_admin_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> Any:
    return service.get_admin_users(db)


@router.patch("/users/{user_id}/credits")
def update_user_credits(
    user_id: UUID,
    payload: UpdateCreditRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> Any:
    return service.update_user_credits(db, user_id, payload.credit_balance)


@router.patch("/users/{user_id}/plan")
def update_user_plan(
    user_id: UUID,
    payload: UpdatePlanRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> Any:
    return service.update_user_plan(db, user_id, payload.plan)


@router.get("/feedback")
def get_admin_feedback(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> Any:
    return service.get_admin_feedback(db)


@router.patch("/feedback/{feedback_id}/status")
def update_feedback_status(
    feedback_id: UUID,
    payload: UpdateFeedbackStatusRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> Any:
    return service.update_feedback_status(db, feedback_id, payload.status)
