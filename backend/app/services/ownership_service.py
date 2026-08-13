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


def filter_owned_document_ids(db: Session, document_ids: list, user_id) -> list[str]:
    """Bản batch của is_document_owned() cho NHIỀU document cùng lúc — 1 JOIN query thay vì
    2 query lặp lại (get Document + get Project) cho từng id, tức 2×N query khi chat agent
    nhận N document_ids trong 1 lượt (search/extract_requirement_tool)."""
    user_uuid = _to_uuid(user_id)
    if user_uuid is None or not document_ids:
        return []
    parsed = [(raw, _to_uuid(raw)) for raw in document_ids]
    valid_uuids = [u for _, u in parsed if u is not None]
    if not valid_uuids:
        return []
    owned_uuids = {
        row[0] for row in (
            db.query(Document.id)
            .join(Project, Document.project_id == Project.id)
            .filter(Document.id.in_(valid_uuids), Project.user_id == user_uuid)
            .all()
        )
    }
    return [raw for raw, u in parsed if u is not None and u in owned_uuids]


def filter_owned_requirement_ids(db: Session, requirement_ids: list, user_id) -> list[str]:
    """Bản batch của is_requirement_owned() cho NHIỀU requirement cùng lúc — vài query cố
    định thay vì 2×N query lặp lại (get Requirement + fallback get Document + get Project)
    cho từng id, khi chat agent nhận N requirement_ids trong 1 lượt (generate_test_case_tool)."""
    user_uuid = _to_uuid(user_id)
    if user_uuid is None or not requirement_ids:
        return []
    parsed = [(raw, _to_uuid(raw)) for raw in requirement_ids]
    valid_uuids = [u for _, u in parsed if u is not None]
    if not valid_uuids:
        return []

    reqs = (
        db.query(Requirement.id, Requirement.project_id, Requirement.document_id)
        .filter(Requirement.id.in_(valid_uuids))
        .all()
    )

    # project_id nullable trên Requirement cũ -> fallback qua document.project_id, gộp lại
    # thành 1 query .in_() cho mọi document cần tra thay vì tra riêng từng cái.
    doc_ids_needed = {r.document_id for r in reqs if r.project_id is None and r.document_id is not None}
    doc_project_by_id: dict = {}
    if doc_ids_needed:
        doc_project_by_id = dict(
            db.query(Document.id, Document.project_id).filter(Document.id.in_(doc_ids_needed)).all()
        )

    req_project_map: dict = {}
    project_ids_needed = set()
    for r in reqs:
        project_id = r.project_id or doc_project_by_id.get(r.document_id)
        req_project_map[r.id] = project_id
        if project_id is not None:
            project_ids_needed.add(project_id)

    owned_project_ids = set()
    if project_ids_needed:
        owned_project_ids = {
            row[0] for row in (
                db.query(Project.id)
                .filter(Project.id.in_(project_ids_needed), Project.user_id == user_uuid)
                .all()
            )
        }

    owned_req_uuids = {
        req_id for req_id, project_id in req_project_map.items()
        if project_id is not None and project_id in owned_project_ids
    }
    return [raw for raw, u in parsed if u is not None and u in owned_req_uuids]
