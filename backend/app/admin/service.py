from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Document, Project, Requirement, TestCase, UsageLog, User


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

        plan = "Pro Plan" if (user.role == "admin" or (user.credit_balance is not None and user.credit_balance >= 2000)) else ("Lite Plan" if (user.credit_balance is not None and user.credit_balance >= 600) else "Free Plan")

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
