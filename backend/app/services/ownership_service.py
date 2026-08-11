"""
Helper kiểm tra quyền sở hữu document/requirement — dùng chung giữa routers và
services/agent (chat tools). Tách riêng vì chat_agent.py cần gọi lại đúng logic này
(document -> project -> user, requirement -> project (qua project_id hoặc document
fallback) -> user) mà không thể import trực tiếp hàm nội bộ (_verify_*) của từng router.

Tools trong chat_agent.py không có Depends()/HTTPException như router — chúng cần trả về
bool để tự quyết định thông báo lỗi dạng text cho agent, nên các hàm ở đây trả bool/None
thay vì raise.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Document, Project, Requirement


def _to_uuid(value) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


def is_project_owned(db: Session, project_id, user_id) -> bool:
    project_uuid = _to_uuid(project_id)
    user_uuid = _to_uuid(user_id)
    if project_uuid is None or user_uuid is None:
        return False
    project = db.get(Project, project_uuid)
    return project is not None and project.user_id == user_uuid


def get_document_owner_project_id(db: Session, document_id) -> UUID | None:
    doc_uuid = _to_uuid(document_id)
    if doc_uuid is None:
        return None
    doc = db.get(Document, doc_uuid)
    if doc is None or doc.project_id is None:
        return None
    return doc.project_id


def is_document_owned(db: Session, document_id, user_id) -> bool:
    project_id = get_document_owner_project_id(db, document_id)
    user_uuid = _to_uuid(user_id)
    if project_id is None or user_uuid is None:
        return False
    project = db.get(Project, project_id)
    return project is not None and project.user_id == user_uuid


def get_requirement_owner_project_id(db: Session, requirement_id) -> UUID | None:
    req_uuid = _to_uuid(requirement_id)
    if req_uuid is None:
        return None
    req = db.get(Requirement, req_uuid)
    if req is None:
        return None
    project_id = req.project_id
    if project_id is None and req.document_id is not None:
        doc = db.get(Document, req.document_id)
        project_id = doc.project_id if doc else None
    return project_id


def is_requirement_owned(db: Session, requirement_id, user_id) -> bool:
    project_id = get_requirement_owner_project_id(db, requirement_id)
    user_uuid = _to_uuid(user_id)
    if project_id is None or user_uuid is None:
        return False
    project = db.get(Project, project_id)
    return project is not None and project.user_id == user_uuid
