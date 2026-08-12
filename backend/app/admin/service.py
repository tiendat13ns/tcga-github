from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Document, Feedback, Project, Requirement, TestCase, UsageLog, User
from app.services.credit_service import PLAN_DEFINITIONS, get_plan_key


def get_admin_stats(db: Session) -> dict[str, int]:
    """Trả về thống kê tổng quan hệ thống dành cho Admin."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    total_documents = db.query(func.count(Document.id)).scalar() or 0
    total_requirements = db.query(func.count(Requirement.id)).scalar() or 0
    total_test_cases = db.query(func.count(TestCase.id)).scalar() or 0
    total_usage_logs = db.query(func.count(UsageLog.id)).scalar() or 0

    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "total_documents": total_documents,
        "total_requirements": total_requirements,
        "total_test_cases": total_test_cases,
        "total_usage_logs": total_usage_logs,
    }


def get_admin_users(db: Session) -> list[dict[str, Any]]:
    """
    Lấy danh sách người dùng kèm theo thông tin chi tiết:
    - số dư credit
    - số project đã tạo
    - số requirement đã tạo
    - số test case đã tạo
    """
    users = db.query(User).order_by(User.created_at.desc()).all()
    user_ids = [u.id for u in users]

    # Đếm theo BATCH bằng GROUP BY cho toàn bộ user cùng lúc (3 query cố định) thay vì lặp
    # 3 query riêng cho mỗi user (1+3N) — tránh N+1 khi danh sách user lớn.
    projects_counts: dict = {}
    requirements_counts: dict = {}
    test_cases_counts: dict = {}
    if user_ids:
        projects_counts = dict(
            db.query(Project.user_id, func.count(Project.id))
            .filter(Project.user_id.in_(user_ids))
            .group_by(Project.user_id)
            .all()
        )
        requirements_counts = dict(
            db.query(Project.user_id, func.count(Requirement.id))
            .join(Requirement, Requirement.project_id == Project.id)
            .filter(Project.user_id.in_(user_ids))
            .group_by(Project.user_id)
            .all()
        )
        test_cases_counts = dict(
            db.query(Project.user_id, func.count(TestCase.id))
            .join(Requirement, Requirement.project_id == Project.id)
            .join(TestCase, TestCase.requirement_id == Requirement.id)
            .filter(Project.user_id.in_(user_ids))
            .group_by(Project.user_id)
            .all()
        )

    results = []

    for user in users:
        projects_count = projects_counts.get(user.id, 0)
        requirements_count = requirements_counts.get(user.id, 0)
        test_cases_count = test_cases_counts.get(user.id, 0)

        plan = PLAN_DEFINITIONS[get_plan_key(user)]["name"]

        results.append(
            {
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
                "plan": plan,
                "credit_balance": user.credit_balance,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "projects_count": projects_count,
                "requirements_count": requirements_count,
                "test_cases_count": test_cases_count,
            }
        )

    return results


def update_user_credits(db: Session, user_id: UUID, credit_balance: int) -> dict[str, Any]:
    """Cập nhật số dư credit cho một người dùng bất kỳ."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if credit_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credit balance cannot be negative",
        )

    target_user.credit_balance = credit_balance
    db.commit()
    db.refresh(target_user)

    return {
        "message": "User credits updated successfully",
        "user_id": str(target_user.id),
        "credit_balance": target_user.credit_balance,
    }


def update_user_plan(db: Session, user_id: UUID, plan_key: str) -> dict[str, Any]:
    """Đổi gói dịch vụ của user (độc lập với credit_balance). plan_key: 'free'|'lite'|'pro'."""
    if plan_key not in PLAN_DEFINITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan '{plan_key}'. Must be one of: {', '.join(PLAN_DEFINITIONS)}",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    target_user.plan = plan_key
    db.commit()
    db.refresh(target_user)

    return {
        "message": "User plan updated successfully",
        "user_id": str(target_user.id),
        "plan": PLAN_DEFINITIONS[plan_key]["name"],
    }


def get_admin_feedback(db: Session) -> list[dict[str, Any]]:
    """Lấy danh sách feedback người dùng gửi, kèm email người gửi, mới nhất trước."""
    rows = (
        db.query(Feedback, User.email)
        .join(User, User.id == Feedback.user_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(fb.id),
            "user_email": email,
            "type": fb.type,
            "message": fb.message,
            "status": fb.status,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
        }
        for fb, email in rows
    ]


def update_feedback_status(db: Session, feedback_id: UUID, status_value: str) -> dict[str, Any]:
    """Đánh dấu feedback đã xem/xử lý."""
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not found",
        )

    feedback.status = status_value
    db.commit()
    db.refresh(feedback)

    return {"id": str(feedback.id), "status": feedback.status}
