from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_db
from app.models import Document, Project, User
from app.schemas.document_schema import DocumentDeleteRequest, DocumentDetail, DocumentExtractResponse, DocumentMetadata
from app.services.documents.file_service import (
    clear_project_documents,
    delete_documents_by_ids,
    list_documents_by_project,
    list_documents_by_projects,
    save_upload_files,
)
from app.services.documents.document_text_service import extract_document_text, get_document_detail
from app.services.credit_service import deduct_user_credits, check_document_upload_quota

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _get_owned_project_id(db: Session, project_id: str, user: User) -> UUID:
    """Verify project_id hợp lệ và thuộc về user hiện tại — trả 404 (không phải 403) để
    tránh lộ việc project đó có tồn tại hay không cho user khác."""
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid project ID") from exc

    project = db.get(Project, project_uuid)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_uuid


def _verify_document_owner(db: Session, document_id: str, user: User) -> Document:
    """Đảm bảo document thuộc project của chính user đang đăng nhập (chặn thao tác chéo tài khoản)."""
    try:
        doc_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Document not found") from exc

    doc = db.get(Document, doc_uuid)
    if doc is None or doc.project_id is None:
        raise HTTPException(status_code=404, detail="Document not found")

    project = db.get(Project, doc.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/upload", response_model=list[DocumentMetadata])
async def upload_document(
    files: list[UploadFile] = File(...),
    project_id: str | None = Query(default=None, description="ID của project để gắn tài liệu. Nếu không truyền, document sẽ không thuộc project nào."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        _get_owned_project_id(db, project_id, current_user)

    check_document_upload_quota(db, current_user, num_new_files=len(files))
    for f in files:
        deduct_user_credits(db, current_user, "DOCUMENT_INGESTION", target_name=f.filename)

    try:
        result = await save_upload_files(files, project_id=project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not save uploaded file") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while saving document") from exc

    if result:
        # Cộng dồn theo số document THẬT SỰ được tạo (1 file zip có thể sinh nhiều document)
        # để lần kiểm tra quota tiếp theo chính xác, không phụ thuộc số document còn tồn tại.
        current_user.documents_uploaded_total = (current_user.documents_uploaded_total or 0) + len(result)
        db.add(current_user)
        db.commit()

    return result


@router.get("", response_model=list[DocumentMetadata])
def get_documents(
    project_id: str | None = Query(default=None, description="Lọc documents theo project_id. Nếu không truyền, trả về document thuộc các project của user hiện tại."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        if project_id:
            _get_owned_project_id(db, project_id, current_user)
            return list_documents_by_project(project_id)

        owned_project_ids = [
            p.id for p in db.query(Project.id).filter(Project.user_id == current_user.id).all()
        ]
        return list_documents_by_projects(owned_project_ids)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while loading documents") from exc


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_document_owner(db, document_id, current_user)
    try:
        document = get_document_detail(document_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while loading document") from exc

    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.post("/{document_id}/extract-text", response_model=DocumentExtractResponse)
def post_extract_text(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_document_owner(db, document_id, current_user)
    try:
        result = extract_document_text(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while extracting text") from exc

    if result is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return result


@router.delete("")
def delete_documents(
    project_id: str = Query(..., description="ID của project cần xoá toàn bộ document/requirement/test case."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Xoá lịch sử upload — SCOPED theo project của user hiện tại, không đụng tới project khác."""
    _get_owned_project_id(db, project_id, current_user)
    try:
        clear_project_documents(project_id)
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not clear upload history") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while clearing upload history") from exc

    return {"status": "cleared"}


@router.delete("/selected")
def delete_selected_documents(
    payload: DocumentDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        requested_uuids = [UUID(doc_id) for doc_id in payload.ids]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc

    owned_ids = [
        str(doc_id)
        for (doc_id,) in db.query(Document.id)
        .join(Project, Document.project_id == Project.id)
        .filter(Document.id.in_(requested_uuids), Project.user_id == current_user.id)
        .all()
    ]

    try:
        deleted_count = delete_documents_by_ids(owned_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not delete selected uploaded files") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error while deleting selected documents") from exc

    return {"status": "deleted", "deleted_count": deleted_count}
