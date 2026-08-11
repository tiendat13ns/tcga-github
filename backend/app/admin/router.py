from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.admin import service
from app.admin.schemas import UpdateCreditRequest
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
