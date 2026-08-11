import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from typing import Optional

from app.database import SessionLocal
from app.routers.auth import get_current_user
from app.models import User, UsageLog
from app.services.credit_service import resolve_user_plan

router = APIRouter(prefix="/api/usage", tags=["usage"])
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/summary")
def get_usage_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trả về tổng quan usage: credit hiện có, gói dịch vụ, tổng credit đã dùng.
    """
    total_used = (
        db.query(sqlfunc.sum(UsageLog.credits_used))
        .filter(UsageLog.user_id == current_user.id)
        .scalar()
        or 0
    )

    plan_name, _limit = resolve_user_plan(current_user)

    return {
        "credit_balance": current_user.credit_balance,
        "current_plan": f"{plan_name} Plan",
        "plan_status": "active",
        "total_credits_used": int(total_used),
        "plans": [
            {
                "name": "Free Plan",
                "status": "active",
                "price_vnd": 0,
                "credits_per_month": 200,
                "max_documents": 5,
                "max_projects": 3,
                "storage_mb": 50,
            },
            {
                "name": "Lite Plan",
                "status": "coming_soon",
                "price_vnd": 50000,
                "credits_per_month": 600,
                "max_documents": 15,
                "max_projects": 10,
                "storage_mb": 500,
            },
            {
                "name": "Pro Plan",
                "status": "coming_soon",
                "price_vnd": 150000,
                "credits_per_month": 2000,
                "max_documents": None,
                "max_projects": None,
                "storage_mb": 2048,
            },
        ],
    }


@router.get("/logs")
def get_usage_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Trả về lịch sử sử dụng credit của user hiện tại.
    """
    logs = (
        db.query(UsageLog)
        .filter(UsageLog.user_id == current_user.id)
        .order_by(UsageLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total = (
        db.query(sqlfunc.count(UsageLog.id))
        .filter(UsageLog.user_id == current_user.id)
        .scalar()
        or 0
    )

    return {
        "total": total,
        "items": [
            {
                "id": str(log.id),
                "operation": log.operation,
                "target_name": log.target_name,
                "credits_used": log.credits_used,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
