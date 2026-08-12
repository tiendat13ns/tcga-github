from pydantic import BaseModel


class DocumentMetadata(BaseModel):
    id: str
    project_id: str | None = None
    original_filename: str
    stored_filename: str
    file_type: str
    file_size: int
    file_path: str
    status: str
    uploaded_at: str
    error_message: str | None = None
    updated_at: str | None = None
    # Trạng thái sinh requirement chạy nền (None/"generating"/"failed").
    requirement_status: str | None = None
    requirement_error: str | None = None


class DocumentDetail(DocumentMetadata):
    text_length: int
    preview: str | None = None


class DocumentExtractResponse(BaseModel):
    document_id: str
    status: str
    text_length: int
    error_message: str | None = None


class DocumentDeleteRequest(BaseModel):
    ids: list[str]
