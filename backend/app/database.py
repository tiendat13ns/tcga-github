"""
Kết nối Database + cơ chế "tự migrate" đơn giản, KHÔNG dùng Alembic.

Chiến lược: mỗi lần server khởi động, init_db() chạy Base.metadata.create_all() để tạo
bảng mới hoàn toàn (nếu chưa có), sau đó chạy một loạt hàm _ensure_*_columns() — mỗi hàm
là các câu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` idempotent để thêm cột mới vào
bảng ĐÃ TỒN TẠI (create_all không tự thêm cột cho bảng cũ khi model thay đổi). Nhờ
IF NOT EXISTS, chạy lại nhiều lần (mỗi lần deploy/restart) đều an toàn.

Đánh đổi: đơn giản, không cần thêm dependency Alembic, nhưng không có migration history/
rollback thật sự, và không xoá được cột — chỉ cộng dồn. Nếu dự án lớn hơn, nên cân nhắc
chuyển sang Alembic.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
PLACEHOLDER_VALUES = {"", "postgresql://postgres:password@host:5432/postgres"}

Base = declarative_base()

engine = None
SessionLocal = None

if DATABASE_URL not in PLACEHOLDER_VALUES:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def is_database_configured() -> bool:
    return engine is not None and SessionLocal is not None


def init_db() -> None:
    """Tạo bảng (nếu chưa có) + chạy toàn bộ migration thủ công + seed admin user.
    Gọi 1 lần lúc FastAPI startup (xem main.py). No-op nếu DATABASE_URL chưa cấu hình."""
    if not is_database_configured():
        return

    from app import models  # noqa: F401

    # Kích hoạt pgvector extension (bắt buộc trước create_all để cột Vector(1536) hoạt động)
    _ensure_pgvector_extension()

    Base.metadata.create_all(bind=engine)
    _ensure_user_columns()
    _backfill_user_plan()
    _backfill_documents_uploaded_total()
    _ensure_project_columns()
    _ensure_document_columns()
    _ensure_document_chunk_columns()
    _ensure_requirement_columns()
    _ensure_requirement_hitl_columns()
    _ensure_agent_log_columns()
    _ensure_test_case_columns()
    _ensure_usage_logs_table()
    _ensure_admin_user()



def _ensure_pgvector_extension() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
    except Exception as exc:
        # Không fail nếu DB không hỗ trợ pgvector (fallback graceful)
        import logging
        logging.getLogger(__name__).warning(
            "Could not create pgvector extension: %s. RAG features will be disabled.", exc
        )


def _ensure_test_case_columns() -> None:
    add_column_statements = [
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS document_id UUID",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS scenario TEXT",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS preconditions TEXT",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS test_steps JSON",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS test_data TEXT",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS severity TEXT",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS test_type TEXT",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS automation_candidate BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS execution_type TEXT NOT NULL DEFAULT 'Manual'",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS execution_status TEXT NOT NULL DEFAULT 'Untested'",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
    ]
    # Fix legacy columns whose types differ from our model
    fix_type_statements = [
        # Old schema had test_data as JSON; convert to TEXT so plain strings can be stored
        "ALTER TABLE test_cases ALTER COLUMN test_data TYPE TEXT USING test_data::TEXT",
    ]

    with engine.begin() as connection:
        for statement in add_column_statements:
            connection.execute(text(statement))
        for statement in fix_type_statements:
            connection.execute(text(statement))


def _ensure_document_columns() -> None:
    statements = [
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id UUID",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS requirement_status TEXT",
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS requirement_error TEXT",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_document_chunk_columns() -> None:
    statements = [
        "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS project_id UUID",
    ]

    with engine.begin() as connection:
        for statement in statements:
            try:
                connection.execute(text(statement))
            except Exception as e:
                pass # Bỏ qua nếu table chưa tồn tại (create_all sẽ tạo sau, nhưng create_all chạy trước rồi)


def _ensure_requirement_columns() -> None:
    statements = [
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS project_id UUID",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS functional_requirement TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS validation_rule JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS permission JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS workflow JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS state JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS error_handling JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS module_name TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS feature_name TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS actor TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS business_rules JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS inputs JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS outputs JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS preconditions JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS validation_rules JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS exception_flows JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS source_reference TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS created_by UUID",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_requirement_hitl_columns() -> None:
    """Thêm các cột cho tính năng Human-in-the-Loop Q&A."""
    statements = [
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS clarifying_questions JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS user_answers JSON",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS test_case_status TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS test_case_error TEXT",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_agent_log_columns() -> None:
    statements = [
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS task_type TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS provider TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS model TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS status TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS input_reference_id UUID",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS input_type TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS prompt_preview TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS raw_output TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_usage_logs_table() -> None:
    """Tạo bảng usage_logs nếu chưa tồn tại (idempotent)."""
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS usage_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    operation TEXT NOT NULL,
                    target_name TEXT,
                    credits_used INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_usage_logs_user_id ON usage_logs(user_id);"
            ))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Could not ensure usage_logs table: %s", exc)


def check_database_connection() -> tuple[bool, str | None]:
    if not is_database_configured():
        return False, "DATABASE_URL is not configured"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:
        return False, str(exc)


def _ensure_user_columns() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 200",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS documents_uploaded_total INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
        # Cột plan thêm dạng NULLABLE (không DEFAULT) để _backfill_user_plan phân biệt được
        # hàng "chưa từng set" (NULL) và điền plan đúng theo credit_balance cũ. User mới tạo
        # qua register/ORM luôn có plan='free' (default ở model), nên NULL chỉ tồn tại thoáng
        # qua ở các hàng cũ trước migration.
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT",
    ]
    with engine.begin() as connection:
        for statement in statements:
            try:
                connection.execute(text(statement))
            except Exception:
                pass


def _backfill_user_plan() -> None:
    """
    Điền plan cho user cũ (plan IS NULL) dựa trên credit_balance theo ngưỡng cũ, để không ai
    bị mất quyền lợi khi migrate sang mô hình plan độc lập. Chỉ đụng hàng NULL nên hoàn toàn
    idempotent — sau khi set, admin đổi plan tay sẽ không bị ghi đè ở các lần restart sau.
    """
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE users
                SET plan = CASE
                    WHEN credit_balance >= 1500 THEN 'pro'
                    WHEN credit_balance >= 600 THEN 'lite'
                    ELSE 'free'
                END
                WHERE plan IS NULL;
            """))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Could not backfill user plan: %s", exc)


def _backfill_documents_uploaded_total() -> None:
    """
    Khởi tạo documents_uploaded_total cho user đã có sẵn document từ trước khi cột này tồn tại.
    Chỉ ghi đè khi counter còn = 0, nên chạy lại nhiều lần (mỗi lần server start) vẫn an toàn,
    không đè lên giá trị đã được tăng dần qua các lần upload sau đó.
    """
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE users u
                SET documents_uploaded_total = sub.doc_count
                FROM (
                    SELECT p.user_id AS user_id, COUNT(d.id) AS doc_count
                    FROM documents d
                    JOIN projects p ON d.project_id = p.id
                    WHERE p.user_id IS NOT NULL
                    GROUP BY p.user_id
                ) sub
                WHERE u.id = sub.user_id AND u.documents_uploaded_total = 0 AND sub.doc_count > 0;
            """))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Could not backfill documents_uploaded_total: %s", exc)


def _ensure_project_columns() -> None:
    """Thêm cột user_id vào bảng projects cho multi-tenant isolation."""
    statements = [
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE",
        "CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects(user_id)",
    ]
    with engine.begin() as connection:
        for statement in statements:
            try:
                connection.execute(text(statement))
            except Exception:
                pass


def _ensure_admin_user() -> None:
    """Tự động cấp quyền admin & Pro Plan (3,500 credits) cho dat96133@gmail.com trong DB.
    Chạy lại mỗi lần server start, nên nếu credit_balance của admin bị trừ xuống dưới 3500
    qua sử dụng bình thường (không còn bypass — xem credit_service.py), nó sẽ được nạp lại
    về 3500 ở lần restart kế tiếp. Đây không phải unlimited credit, chỉ là "top-up" định kỳ."""
    try:
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE users SET role = 'admin', credit_balance = 3500 WHERE email = 'dat96133@gmail.com' AND (credit_balance IS NULL OR credit_balance < 3500)")
            )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Could not set admin role for dat96133@gmail.com: %s", exc)

