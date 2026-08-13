"""
SQLAlchemy ORM models — nguồn sự thật (source of truth) cho schema DB thật.

Quan hệ chính (User sở hữu Project, Project chứa Document, Document sinh Requirement,
Requirement sinh TestCase):

  User ──< Project ──< Document ──< DocumentChunk (chunk + vector embedding cho RAG)
                            │
                            └──< Requirement ──< TestCase

AgentLog và UsageLog là bảng log độc lập (không tham chiếu ngược từ entity khác), dùng để
theo dõi lịch sử gọi LLM và lịch sử trừ credit.

Lưu ý: DB không dùng Alembic — mọi thay đổi cột ở đây cần thêm câu ALTER TABLE tương ứng
vào app/database.py (_ensure_*_columns) để áp dụng cho DB đã tồn tại, xem docstring ở đó.
"""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class Project(Base):
    """Đơn vị tổ chức cao nhất — mỗi Project đại diện cho một hệ thống/module riêng biệt."""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)


class User(Base):
    """Tài khoản đăng nhập. id map 1-1 với auth.users của Supabase (không tự sinh UUID ở đây)."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True)  # Sẽ map 1-1 với auth.users của Supabase
    email = Column(Text, unique=True, nullable=False, index=True)
    role = Column(Text, nullable=False, default="user")
    # Gói dịch vụ, độc lập với credit_balance: 'free' | 'lite' | 'pro'. Quyết định quota
    # (số tài liệu/project/dung lượng) — xem PLAN_DEFINITIONS trong services/credit_service.py.
    plan = Column(Text, nullable=False, default="free")
    credit_balance = Column(Integer, nullable=False, default=200)
    # Đếm cộng dồn, không giảm khi xóa document — chặn việc xóa rồi upload lại để lách quota.
    documents_uploaded_total = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)


class Document(Base):
    """Một file tài liệu đã upload (SRS/BRD/...). extracted_text là text thô sau khi extractor
    xử lý xong (xem services/documents/extractors/) — nguồn cho chunking + embedding (DocumentChunk)."""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,  # B-Tree index cho project_id để filter nhanh
    )
    original_filename = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)
    file_type = Column(Text, nullable=False)
    file_size = Column(BigInteger, nullable=False)
    file_path = Column(Text, nullable=False)
    extracted_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="uploaded")
    # Trạng thái sinh Requirement chạy nền (tách khỏi `status` vốn là trạng thái extract text):
    # None = chưa/không đang chạy, "generating" = đang gọi LLM nền, "failed" = lỗi (xem
    # requirement_error). "Đã xong" được suy ra từ việc requirements đã tồn tại, không cần cờ riêng.
    requirement_status = Column(Text, nullable=True)
    requirement_error = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)


class DocumentChunk(Base):
    """Lưu trữ các chunk text và vector embedding cho RAG.

    Chiến lược tối ưu hoá:
    - project_id được denormalize trực tiếp vào bảng này (không cần JOIN Document khi search).
    - HNSW index trên cột embedding để cosine similarity search siêu tốc.
    - B-Tree index trên project_id để pre-filter trước khi search vector.
    """
    __tablename__ = "document_chunks"
    __table_args__ = (
        # HNSW index cho vector search — nhanh hơn IVFFlat, không cần training set.
        # m=16: số kết nối tối đa mỗi node; ef_construction=64: độ chính xác khi build index.
        Index(
            "ix_document_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        # B-Tree index cho project_id để filter nhanh trước khi chạy vector search.
        Index("ix_document_chunks_project_id", "project_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalized: lưu project_id trực tiếp vào chunk để tránh JOIN khi search RAG.
    project_id = Column(UUID(as_uuid=True), nullable=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=True)
    # 1536 dimensions cho model text-embedding-3-small
    embedding = Column(Vector(1536), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    functional_requirement = Column(Text, nullable=True)
    validation_rule = Column(JSON, nullable=True)
    permission = Column(JSON, nullable=True)
    workflow = Column(JSON, nullable=True)
    state = Column(JSON, nullable=True)
    error_handling = Column(JSON, nullable=True)
    module_name = Column(Text, nullable=True)
    feature_name = Column(Text, nullable=True)
    actor = Column(Text, nullable=True)
    business_rules = Column(JSON, nullable=True)
    inputs = Column(JSON, nullable=True)
    outputs = Column(JSON, nullable=True)
    preconditions = Column(JSON, nullable=True)
    validation_rules = Column(JSON, nullable=True)
    exception_flows = Column(JSON, nullable=True)
    source_reference = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(Text, nullable=False, default="ai_generated")
    version = Column(Integer, nullable=False, default=1)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    # Human-in-the-Loop Q&A columns
    clarifying_questions = Column(JSON, nullable=True)   # list[str]: questions AI raised
    user_answers = Column(JSON, nullable=True)            # list[str]: QA/BA answers
    # Trạng thái sinh Test Case chạy nền cho requirement này: None = chưa/không chạy,
    # "generating" = đang gọi LLM nền, "failed" = lỗi (xem test_case_error). "Đã xong" suy ra
    # từ việc test case đã tồn tại cho requirement.
    test_case_status = Column(Text, nullable=True)
    test_case_error = Column(Text, nullable=True)


class AgentLog(Base):
    """Nhật ký mỗi lần gọi LLM để sinh Requirement/Test Case (thành công hay thất bại,
    thời gian chạy) — dùng để debug/theo dõi chất lượng, không ảnh hưởng credit (xem UsageLog)."""
    __tablename__ = "agent_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_type = Column(Text, nullable=False)
    provider = Column(Text, nullable=False)
    model = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    input_reference_id = Column(UUID(as_uuid=True), nullable=True)
    input_type = Column(Text, nullable=True)
    prompt_preview = Column(Text, nullable=True)
    raw_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TestCase(Base):
    """Một test case sinh bởi AI (hoặc chỉnh sửa thủ công) cho một Requirement. version tăng
    dần mỗi lần requirement được generate lại — xem TestCaseRepository.get_latest_version_by_requirement_id."""
    __tablename__ = "test_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("requirements.id"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    title = Column(Text, nullable=False)
    scenario = Column(Text, nullable=True)
    preconditions = Column(Text, nullable=True)
    test_steps = Column(JSON, nullable=True)          # list[str]
    test_data = Column(Text, nullable=True)
    expected_result = Column(Text, nullable=False)
    actual_result = Column(Text, nullable=True)
    priority = Column(Text, nullable=False, default="Medium")        # High|Medium|Low
    severity = Column(Text, nullable=True)            # Critical|Major|Minor|Trivial
    test_type = Column(Text, nullable=True)           # Positive|Negative|Boundary|...
    automation_candidate = Column(Boolean, nullable=False, default=False)
    execution_type = Column(Text, nullable=False, default="Manual")  # Manual|Automation Candidate
    execution_status = Column(Text, nullable=False, default="Untested")  # Untested|Pass|Fail|Blocked
    status = Column(Text, nullable=False, default="ai_generated")
    note = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)


class ChatMessage(Base):
    """Một tin nhắn (user hoặc AI) trong lịch sử chat "Work with Agent" của 1 project.
    Lưu ở DB (thay vì chỉ localStorage phía client) để lịch sử đồng bộ được giữa các thiết
    bị/trình duyệt và không mất khi xóa cache — xem services/chat_history_service.py."""
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_project_id_created_at", "project_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(Text, nullable=False)  # "user" | "ai" | "system"
    content = Column(Text, nullable=False)
    error = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UsageLog(Base):
    """Nhật ký trừ Credit theo từng tác vụ AI."""
    __tablename__ = "usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    operation = Column(Text, nullable=False)     # DOCUMENT_INGESTION | REQUIREMENT_EXTRACTION | TEST_CASE_GENERATION | COPILOT_CHAT
    target_name = Column(Text, nullable=True)    # Tên tài liệu / project liên quan
    credits_used = Column(Integer, nullable=False)  # Số credit đã trừ
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Feedback(Base):
    """Báo lỗi / góp ý người dùng gửi từ trong app — Admin xem & xử lý ở Admin Dashboard."""
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(Text, nullable=False, default="other")  # bug | feature_request | other
    message = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="new")  # new | reviewed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
