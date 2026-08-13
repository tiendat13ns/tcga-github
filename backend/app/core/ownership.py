"""Helper kiểm tra quyền sở hữu tài nguyên dùng chung cho nhiều router.

Trước đây `verify_requirement_owner` bị copy y hệt ở 3 router (test_cases, requirements,
test_case_studio) — sửa một chỗ dễ quên hai chỗ kia, mà đây là logic BẢO MẬT (chặn thao tác
chéo tài khoản) nên rủi ro. Gom về một nơi để chỉ có một nguồn sự thật."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Document, Project, Requirement, User


def verify_requirement_owner(db: Session, requirement_id: str, user: User) -> Requirement:
    """Đảm bảo requirement thuộc project của chính user đang đăng nhập; nếu không, luôn trả 404
    (KHÔNG dùng 403) để không tiết lộ sự tồn tại của requirement cho người ngoài. Trả về
    Requirement để caller dùng lại (tránh query lặp).

    Xác định project qua requirement.project_id, fallback qua document.project_id vì
    requirement.project_id nullable (ondelete SET NULL / requirement cũ chưa set)."""
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
