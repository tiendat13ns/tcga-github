"""
Xử lý upload file (đơn lẻ hoặc .zip nhiều file) — validate kích thước/định dạng, lưu file
vật lý vào UPLOAD_DIR, tạo record Document trong DB, và quản lý xoá file/document.

Lưu ý: file vật lý bị xoá ngay sau khi extract text xong (xem document_text_service.py) —
UPLOAD_DIR chỉ chứa file đang chờ extract, không phải kho lưu trữ lâu dài. METADATA_FILE
(documents.json) là sidecar JSON lưu song song với DB, dùng khi cần đọc nhanh metadata mà
không cần query DB.
"""

import json
import re
import zipfile
from io import BytesIO
from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile

from app.database import SessionLocal, is_database_configured
from app.models import Document, Requirement, TestCase
from app.schemas.document_schema import DocumentMetadata

BASE_DIR = Path(__file__).resolve().parents[3]  # trỏ tới backend/
UPLOAD_DIR = BASE_DIR / "uploads"
METADATA_FILE = UPLOAD_DIR / "documents.json"
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md", "xlsx", "csv", "dbml"}
ZIP_EXTENSION = "zip"


def _ensure_storage() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if not METADATA_FILE.exists():
        METADATA_FILE.write_text("[]", encoding="utf-8")


def _read_metadata() -> list[dict]:
    _ensure_storage()
    try:
        return json.loads(METADATA_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _write_metadata(documents: list[dict]) -> None:
    _ensure_storage()
    METADATA_FILE.write_text(
        json.dumps(documents, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _format_datetime(value) -> str:
    if value is None:
        return datetime.now().isoformat(timespec="seconds")

    return value.isoformat(timespec="seconds")


def _document_model_to_schema(document: Document) -> DocumentMetadata:
    return DocumentMetadata(
        id=str(document.id),
        project_id=str(document.project_id) if document.project_id else None,
        original_filename=document.original_filename,
        stored_filename=document.stored_filename,
        file_type=document.file_type,
        file_size=document.file_size,
        file_path=document.file_path,
        status=document.status,
        uploaded_at=_format_datetime(document.uploaded_at),
        error_message=document.error_message,
        updated_at=_format_datetime(document.updated_at),
        requirement_status=document.requirement_status,
        requirement_error=document.requirement_error,
    )


def _delete_uploaded_file(file_path: str) -> None:
    filename = Path(file_path).name

    if not filename:
        return

    target_path = UPLOAD_DIR / filename

    try:
        if target_path.exists() and target_path.is_file():
            target_path.unlink()
    except PermissionError:
        raise
    except OSError:
        raise


def _save_documents_to_database(
    documents: list[DocumentMetadata],
    project_id: str | None = None,
) -> list[DocumentMetadata]:
    if not is_database_configured():
        return documents

    project_uuid = UUID(project_id) if project_id else None

    with SessionLocal() as db:
        saved_documents: list[Document] = []

        for document in documents:
            document_model = Document(
                id=UUID(document.id),
                project_id=project_uuid,
                original_filename=document.original_filename,
                stored_filename=document.stored_filename,
                file_type=document.file_type,
                file_size=document.file_size,
                file_path=document.file_path,
                status=document.status,
            )
            db.add(document_model)
            saved_documents.append(document_model)

        db.commit()

        # Refresh cả loạt bằng 1 query .in_() thay vì db.refresh() riêng từng document (N+1) —
        # commit() làm expire mọi instance nên phải load lại trước khi đọc attribute.
        document_ids = [document_model.id for document_model in saved_documents]
        refreshed_by_id = {
            document_model.id: document_model
            for document_model in db.query(Document).filter(Document.id.in_(document_ids)).all()
        }
        return [
            _document_model_to_schema(refreshed_by_id[document_model.id])
            for document_model in saved_documents
        ]


def _get_documents_from_database(document_ids: list[str]) -> list[DocumentMetadata]:
    document_uuids = [UUID(document_id) for document_id in document_ids]

    with SessionLocal() as db:
        documents = db.query(Document).filter(Document.id.in_(document_uuids)).all()
        document_by_id = {str(document.id): document for document in documents}

        return [
            _document_model_to_schema(document_by_id[document_id])
            for document_id in document_ids
            if document_id in document_by_id
        ]


def _extract_saved_documents(documents: list[DocumentMetadata]) -> list[DocumentMetadata]:
    if not is_database_configured():
        return documents

    from app.services.documents.document_text_service import extract_document_text

    for document in documents:
        extract_document_text(document.id)

    return _get_documents_from_database([document.id for document in documents])


def list_documents_by_project(project_id: str) -> list[DocumentMetadata]:
    """Lấy danh sách documents thuộc một project cụ thể."""
    if not is_database_configured():
        return []

    project_uuid = UUID(project_id)
    with SessionLocal() as db:
        documents = (
            db.query(Document)
            .filter(Document.project_id == project_uuid)
            .order_by(Document.uploaded_at.desc())
            .all()
        )
        return [_document_model_to_schema(doc) for doc in documents]


def list_documents_by_projects(project_ids: list) -> list[DocumentMetadata]:
    """Lấy documents thuộc nhiều project cùng lúc — dùng khi liệt kê toàn bộ document của
    một user qua tất cả project họ sở hữu (thay cho list_documents() vốn trả về TOÀN HỆ THỐNG)."""
    if not is_database_configured() or not project_ids:
        return []

    with SessionLocal() as db:
        documents = (
            db.query(Document)
            .filter(Document.project_id.in_(project_ids))
            .order_by(Document.uploaded_at.desc())
            .all()
        )
        return [_document_model_to_schema(doc) for doc in documents]


def clear_project_documents(project_id: str) -> None:
    """Xoá toàn bộ document/requirement/test case CỦA MỘT PROJECT — scoped, không đụng tới
    dữ liệu của project khác (khác với clear_upload_history() vốn xoá toàn hệ thống)."""
    _ensure_storage()

    if not is_database_configured():
        return

    project_uuid = UUID(project_id)
    with SessionLocal() as db:
        documents = db.query(Document).filter(Document.project_id == project_uuid).all()

        for document in documents:
            _delete_uploaded_file(document.file_path)

        document_ids = [d.id for d in documents]
        if document_ids:
            db.query(TestCase).filter(TestCase.requirement_id.in_(
                db.query(Requirement.id).filter(Requirement.document_id.in_(document_ids))
            )).delete(synchronize_session=False)
            db.query(Requirement).filter(Requirement.document_id.in_(document_ids)).delete(synchronize_session=False)
            db.query(Document).filter(Document.id.in_(document_ids)).delete(synchronize_session=False)
            db.commit()


def _safe_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def _file_type(filename: str) -> str:
    return Path(filename).suffix.lower().lstrip(".")


def _validate_content(filename: str, content: bytes, allowed_extensions: set[str]) -> str:
    file_type = _file_type(filename)

    if not file_type:
        raise ValueError(f"File type is required: {filename}")

    if file_type not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise ValueError(f"Invalid file type for {filename}. Allowed types: {allowed}")

    if len(content) == 0:
        raise ValueError(f"File is empty: {filename}")

    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds maximum size of 10MB: {filename}")

    return file_type


def _save_document(original_filename: str, content: bytes) -> DocumentMetadata:
    safe_original_filename = _safe_filename(original_filename)
    file_type = _validate_content(safe_original_filename, content, ALLOWED_EXTENSIONS)
    document_id = str(uuid4())
    stored_filename = f"{document_id}_{safe_original_filename}"
    destination = UPLOAD_DIR / stored_filename
    destination.write_bytes(content)

    return DocumentMetadata(
        id=document_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_type=file_type,
        file_size=len(content),
        file_path=f"uploads/{stored_filename}",
        status="uploaded",
        uploaded_at=datetime.now().isoformat(timespec="seconds"),
    )


def _save_zip_documents(original_filename: str, content: bytes) -> list[DocumentMetadata]:
    _validate_content(original_filename, content, {ZIP_EXTENSION})

    try:
        archive = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise ValueError(f"Invalid zip file: {original_filename}") from exc

    documents: list[DocumentMetadata] = []

    with archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue

            entry_name = Path(entry.filename).name
            if not entry_name:
                continue

            if Path(entry.filename).is_absolute() or ".." in Path(entry.filename).parts:
                raise ValueError(f"Invalid file path inside zip: {entry.filename}")

            safe_entry_name = _safe_filename(entry_name)
            entry_content = archive.read(entry)
            _validate_content(safe_entry_name, entry_content, ALLOWED_EXTENSIONS)
            documents.append(_save_document(safe_entry_name, entry_content))

    if not documents:
        raise ValueError("Zip file does not contain any supported documents")

    return documents


def list_documents() -> list[DocumentMetadata]:
    if is_database_configured():
        with SessionLocal() as db:
            documents = db.query(Document).order_by(Document.uploaded_at.desc()).all()
            return [_document_model_to_schema(document) for document in documents]

    documents = _read_metadata()
    return [DocumentMetadata(**document) for document in reversed(documents)]


def clear_upload_history() -> None:
    _ensure_storage()

    if is_database_configured():
        with SessionLocal() as db:
            documents = db.query(Document).all()

            for document in documents:
                _delete_uploaded_file(document.file_path)

            # Delete in FK order: test_cases → requirements → documents
            db.query(TestCase).delete()
            db.query(Requirement).delete()
            db.query(Document).delete()
            db.commit()
        _write_metadata([])
        return

    for file_path in UPLOAD_DIR.iterdir():
        if file_path.name in {".gitkeep", "documents.json"}:
            continue

        if file_path.is_file():
            file_path.unlink()

    _write_metadata([])


def delete_documents_by_ids(document_ids: list[str]) -> int:
    _ensure_storage()

    ids_to_delete = set(document_ids)

    if not ids_to_delete:
        raise ValueError("At least one document id is required")

    if is_database_configured():
        document_uuids: list[UUID] = []

        for document_id in ids_to_delete:
            try:
                document_uuids.append(UUID(document_id))
            except ValueError as exc:
                raise ValueError(f"Invalid document id: {document_id}") from exc

        with SessionLocal() as db:
            documents = db.query(Document).filter(Document.id.in_(document_uuids)).all()

            # Xoá file vật lý phải lặp per-document (I/O trên từng path riêng), nhưng DELETE
            # trong DB gộp thành 1 query .in_() cho cả loạt thay vì lặp 3 query/document (N+1)
            # — giống cách clear_project_documents() đã làm.
            for document in documents:
                _delete_uploaded_file(document.file_path)

            doc_ids = [document.id for document in documents]
            if doc_ids:
                # Delete in FK order: test_cases → requirements → documents
                db.query(TestCase).filter(TestCase.requirement_id.in_(
                    db.query(Requirement.id).filter(Requirement.document_id.in_(doc_ids))
                )).delete(synchronize_session=False)
                db.query(Requirement).filter(Requirement.document_id.in_(doc_ids)).delete(synchronize_session=False)
                db.query(Document).filter(Document.id.in_(doc_ids)).delete(synchronize_session=False)
                db.commit()

            deleted_count = len(documents)

        return deleted_count

    documents = _read_metadata()
    remaining_documents: list[dict] = []
    deleted_count = 0

    for document in documents:
        if document.get("id") in ids_to_delete:
            _delete_uploaded_file(document.get("file_path", ""))
            deleted_count += 1
            continue

        remaining_documents.append(document)

    _write_metadata(remaining_documents)

    return deleted_count


async def save_upload_file(
    file: UploadFile,
    project_id: str | None = None,
) -> list[DocumentMetadata]:
    if not file or not file.filename:
        raise ValueError("File is required")

    content = await file.read()
    original_filename = _safe_filename(file.filename)
    upload_type = _file_type(original_filename)

    if not upload_type:
        raise ValueError(f"File type is required: {file.filename}")

    if upload_type == ZIP_EXTENSION:
        uploaded_documents = _save_zip_documents(original_filename, content)
    elif upload_type in ALLOWED_EXTENSIONS:
        uploaded_documents = [_save_document(file.filename, content)]
    else:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS | {ZIP_EXTENSION}))
        raise ValueError(f"Invalid file type for {file.filename}. Allowed types: {allowed}")

    if is_database_configured():
        saved_documents = _save_documents_to_database(uploaded_documents, project_id=project_id)
        return _extract_saved_documents(saved_documents)

    documents = _read_metadata()
    documents.extend(document.model_dump() for document in uploaded_documents)
    _write_metadata(documents)

    return uploaded_documents


async def save_upload_files(
    files: list[UploadFile],
    project_id: str | None = None,
) -> list[DocumentMetadata]:
    if not files:
        raise ValueError("At least one file is required")

    uploaded_documents: list[DocumentMetadata] = []
    for file in files:
        uploaded_documents.extend(await save_upload_file(file, project_id=project_id))

    return uploaded_documents
