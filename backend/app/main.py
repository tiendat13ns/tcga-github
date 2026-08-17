"""
Entry point FastAPI — khởi tạo app, đăng ký CORS và toàn bộ router.

Kiến trúc tổng quan của backend (xem thêm docstring từng module để biết chi tiết):
  - routers/    : định nghĩa HTTP endpoint, chuyển request/response, không chứa business logic.
  - services/   : business logic thực sự, chia theo domain:
      services/rag/        — chunking, embedding, semantic search (retrieval-augmented generation).
      services/documents/  — upload, extract text từ file (pdf/docx/...), quản lý tài liệu.
      services/generation/ — orchestrate sinh Requirement / Test Case từ tài liệu (dùng rag + agent).
      services/agent/      — lời gọi LLM thực sự: ReAct chat agent, prompt/JSON generation "node".
      services/ai/         — abstraction cho AI provider (hiện chỉ còn OpenAI-compatible).
      chat_service.py, credit_service.py — cắt ngang nhiều domain nên để ở gốc services/.
  - schemas/    : Pydantic request/response models cho API.
  - repositories/: truy vấn DB (SQLAlchemy) tách khỏi service logic.
  - models.py   : SQLAlchemy ORM models (schema DB thật).
  - database.py : kết nối DB + cơ chế tự migrate đơn giản (không dùng Alembic, xem docstring ở đó).
"""

import logging
import this_module_does_not_exist
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import check_database_connection, init_db
from app.routers.ai import router as ai_router
from app.routers.documents import router as documents_router
from app.routers.projects import router as projects_router
from app.routers.requirements import router as requirements_router
from app.routers.test_cases import router as test_cases_router
from app.routers.chat import router as chat_router
from app.routers.test_case_studio import router as test_case_studio_router
from app.routers.auth import router as auth_router
from app.routers.usage import router as usage_router
from app.routers.feedback import router as feedback_router
from app.admin.router import router as admin_router

app = FastAPI(title="AI Test Case Generation Assistant")

logging.basicConfig(level=logging.INFO)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:1302"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(documents_router)
app.include_router(ai_router)
app.include_router(requirements_router)
app.include_router(test_cases_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(test_case_studio_router)
app.include_router(auth_router)
app.include_router(usage_router)
app.include_router(feedback_router)
app.include_router(admin_router)


@app.on_event("startup")
def on_startup():
    # init_db() vừa tạo bảng (create_all) vừa chạy các "migration" thủ công (ALTER TABLE
    # IF NOT EXISTS...) — xem database.py để biết vì sao dự án không dùng Alembic.
    try:
        init_db()
    except Exception as exc:
        print(f"WARNING: Database initialization failed: {exc}")
        print("WARNING: Backend will start, but database-backed APIs may fail until DATABASE_URL/network is fixed.")


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def database_health_check():
    connected, error = check_database_connection()

    return {
        "database_connected": connected,
        "error": error,
    }
