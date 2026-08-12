import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from typing import Optional

from app.database import SessionLocal
from app.routers.auth import get_current_user
from app.models import User, UsageLog
from app.services.credit_service import PLAN_DEFINITIONS, PLAN_ORDER, get_plan_key

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

    current_key = get_plan_key(current_user)

    # Dựng danh sách gói từ nguồn sự thật duy nhất (PLAN_DEFINITIONS). Free là gói tự phục vụ
    # (active); Lite/Pro hiện chỉ cấp qua admin nên đánh dấu coming_soon cho phần mua tự động.
    plans = []
    for key in PLAN_ORDER:
        d = PLAN_DEFINITIONS[key]
        plans.append({
            "name": d["name"],
            "status": "active" if key == "free" else "coming_soon",
            "price_vnd": d["price_vnd"],
            "credits_per_month": d["credits_per_month"],
            "max_documents": d["max_documents"],
            "max_projects": d["max_projects"],
            "storage_mb": d["storage_mb"],
        })

    return {
        "credit_balance": current_user.credit_balance,
        "current_plan": PLAN_DEFINITIONS[current_key]["name"],
        "plan_status": "active",
        "total_credits_used": int(total_used),
        "plans": plans,
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
