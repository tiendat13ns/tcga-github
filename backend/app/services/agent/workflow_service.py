"""
"Node" gọi LLM thực sự cho 2 tác vụ sinh nội dung cốt lõi: extract_requirements_node()
và generate_test_cases_node(). Đây là nơi DUY NHẤT trong dự án thực sự gọi LLM để sinh
Requirement/Test Case (khác với services/agent/chat_agent.py — đó là ReAct agent cho chat,
agent bên đó gọi lại xuống các service dùng module này, không tự gọi LLM để sinh JSON).

Ưu tiên dùng structured output (function-calling) để Pydantic tự validate response —
nếu model/proxy không hỗ trợ, fallback về cách cũ: yêu cầu JSON trong prompt rồi tự tách
bằng regex + JSONDecoder (_extract_json). get_llm() cũng được tái sử dụng bởi chat_service.py
và bug_report_service.py cho các lời gọi LLM đơn giản không cần structured output.
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import ValidationError

from app.schemas.agent_schema import AIRequirementOutput, AITestCaseOutput
from app.models import AgentLog
from app.database import SessionLocal

# Load environment variables
BACKEND_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BACKEND_DIR / ".env")

logger = logging.getLogger(__name__)


def get_llm(streaming: bool = True) -> ChatOpenAI:
    """Khởi tạo LLM ChatOpenAI với cấu hình từ .env.

    streaming=False dùng cho các tác vụ sinh JSON (extract/generate node): các node này
    await nguyên kết quả nên streaming không có lợi, mà response non-stream lại được SDK
    retry sạch hơn khi kết nối đứt giữa chừng (lỗi hay gặp với provider pool occ/...).
    Luồng chat (chat_service) vẫn giữ streaming=True để đẩy token dần lên UI.

    timeout đọc từ OPENAI_COMPATIBLE_TIMEOUT_SECONDS (trước đây biến này khai báo trong .env
    nhưng KHÔNG được code dùng — giờ đã gắn thật). max_retries để SDK tự thử lại các lỗi
    tầng HTTP (connection/timeout) trước khi ném ra ngoài.
    """
    timeout_s = float(os.getenv("OPENAI_COMPATIBLE_TIMEOUT_SECONDS", "180"))
    return ChatOpenAI(
        model=os.getenv("OPENAI_COMPATIBLE_MODEL", "gemini-1.5-flash"),
        api_key=os.getenv("OPENAI_COMPATIBLE_API_KEY", ""),
        base_url=os.getenv("OPENAI_COMPATIBLE_BASE_URL", "https://api.vilao.ai/v1"),
        temperature=0.2,
        streaming=streaming,
        timeout=timeout_s,
        max_retries=2,
    )


# Số lần thử tối đa cho mỗi node sinh nội dung (structured + fallback tính là 1 lần).
# Tunable qua .env; mặc định 3. Nguyên nhân chính cần retry: provider pool đôi khi đứt kết
# nối giữa chừng → response rỗng → _extract_json ném "expected value at line 1 column 1".
_LLM_MAX_ATTEMPTS = int(os.getenv("LLM_MAX_ATTEMPTS", "3"))


def _is_length_error(exc: Exception) -> bool:
    """Lỗi do output vượt giới hạn token (model cắt cụt response). Đây là lỗi DETERMINISTIC —
    cùng prompt sẽ cắt cụt y hệt, nên retry chỉ tốn thêm token/thời gian mà vẫn hỏng. Cần
    fail-fast + giảm số lượng test case yêu cầu (xem prompt COVERAGE SCOPE)."""
    msg = str(exc).lower()
    return (
        "length limit" in msg
        or "maximum context" in msg
        or "output too long" in msg
    )


async def _run_llm_attempt_with_retry(attempt, task_label: str):
    """Chạy coroutine-factory `attempt` (không tham số) với retry + exponential backoff.

    Mỗi `attempt` tự bao trọn 1 lần thử đầy đủ (structured output → fallback JSON parsing).
    Retry dành cho sự cố THOÁNG QUA của provider (đứt kết nối → response rỗng → parse lỗi).
    KHÔNG retry lỗi cắt cụt do output quá dài (deterministic) — dừng ngay để khỏi đốt token.
    """
    last_exc: Exception | None = None
    for i in range(1, _LLM_MAX_ATTEMPTS + 1):
        try:
            return await attempt()
        except Exception as exc:
            last_exc = exc
            if _is_length_error(exc):
                logger.error(
                    "%s: output vượt giới hạn token (bị cắt cụt) — KHÔNG retry, dừng ngay. "
                    "Cần giảm số lượng test case sinh ra.", task_label,
                )
                raise
            if i < _LLM_MAX_ATTEMPTS:
                backoff = 2 ** (i - 1)  # 1s, 2s, 4s, ...
                logger.warning(
                    "%s: lần thử %d/%d thất bại (%s) — thử lại sau %ds",
                    task_label, i, _LLM_MAX_ATTEMPTS, exc, backoff,
                )
                await asyncio.sleep(backoff)
            else:
                logger.error(
                    "%s: thất bại sau %d lần thử — %s",
                    task_label, _LLM_MAX_ATTEMPTS, exc,
                )
    raise last_exc  # type: ignore[misc]


def _strip_markdown_fence(text: str) -> str:
    """Loại bỏ markdown code fence (```json ... ```) nếu model trả về dạng này."""
    text = text.strip()
    # Strip ```json ... ``` hoặc ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json(text: str) -> dict:
    """Trích xuất JSON từ string, có thể bọc trong markdown fence."""
    cleaned = _strip_markdown_fence(text)
    # Tìm JSON object đầu tiên trong text
    decoder = json.JSONDecoder()
    for i, ch in enumerate(cleaned):
        if ch in "{[":
            try:
                data, _ = decoder.raw_decode(cleaned[i:])
                return data
            except json.JSONDecodeError:
                continue
    raise ValueError(f"No valid JSON found in response: {text[:200]}")


def log_agent_execution(
    task_type: str,
    input_ref_id: str,
    input_type: str,
    status: str,
    error: str = None,
    duration: int = None,
):
    """Ghi log quá trình thực thi của Agent vào Database."""
    try:
        with SessionLocal() as db:
            log = AgentLog(
                task_type=task_type,
                provider="openai_compatible",
                model=os.getenv("OPENAI_COMPATIBLE_MODEL", "gemini-1.5-flash"),
                status=status,
                input_reference_id=uuid.UUID(input_ref_id) if input_ref_id else None,
                input_type=input_type,
                error_message=error,
                execution_time_ms=duration,
            )
            db.add(log)
            db.commit()
    except Exception as e:
        logger.warning("Failed to log agent execution: %s", e)


from app.prompts.requirement_extraction_prompt import (
    SYSTEM_PROMPT as REQ_SYSTEM_PROMPT,
    JSON_FORMAT_INSTRUCTION as REQ_JSON_FORMAT,
)
from app.prompts.test_case_generation_prompt import (
    SYSTEM_PROMPT as TC_SYSTEM_PROMPT,
    JSON_FORMAT_INSTRUCTION as TC_JSON_FORMAT,
)


async def extract_requirements_node(user_prompt: str, document_id: str) -> AIRequirementOutput:
    """
    Node trích xuất Requirement.
    Ưu tiên dùng structured output (function-calling) của LLM để Pydantic tự validate
    trực tiếp — đáng tin cậy hơn nhiều so với tự parse JSON từ raw text, nhất là với
    output dài. Nếu proxy/model không hỗ trợ function-calling, fallback về cách cũ:
    yêu cầu JSON trong prompt rồi tự trích xuất bằng regex + JSONDecoder.
    """
    start_time = time.time()
    messages = [
        SystemMessage(content=REQ_SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]

    async def _attempt() -> AIRequirementOutput:
        # streaming=False: node await nguyên kết quả, không cần stream; giúp SDK retry sạch hơn.
        llm = get_llm(streaming=False)
        try:
            # method="function_calling" thay vì mặc định "json_schema" của langchain_openai —
            # json_schema là API mới của OpenAI, các proxy dịch sang backend Claude/Anthropic
            # (vốn không có khái niệm json_schema, chỉ có tool-use) thường KHÔNG dịch đúng, khiến
            # model luôn trả JSON dạng text thô (kèm ```json fence) thay vì gọi tool → structured
            # output luôn fail 100% → tốn gấp đôi lời gọi mỗi lần generate (fail + fallback).
            # function_calling dùng tool-calling kiểu cũ, được các proxy hỗ trợ phổ biến hơn nhiều.
            structured_llm = llm.with_structured_output(AIRequirementOutput, method="function_calling")
            return await structured_llm.ainvoke(messages)
        except Exception as structured_exc:
            if _is_length_error(structured_exc):
                raise RuntimeError(
                    f"LLM output too long (length limit reached) khi trích xuất requirement: {structured_exc}"
                ) from structured_exc
            logger.warning(
                "Structured output failed for extract_requirements_node (%s) — "
                "falling back to manual JSON parsing",
                structured_exc,
            )
            # Nhánh fallback tự parse JSON từ text → cần chỉ dẫn định dạng + schema
            # tường minh (structured output không dùng, nên schema chỉ ghép vào đây).
            fallback_messages = [
                SystemMessage(content=f"{REQ_SYSTEM_PROMPT}\n\n{REQ_JSON_FORMAT}"),
                HumanMessage(content=user_prompt),
            ]
            response = await llm.ainvoke(fallback_messages)
            data = _extract_json(response.content)
            return AIRequirementOutput.model_validate(data)

    try:
        result = await _run_llm_attempt_with_retry(_attempt, "extract_requirements_node")

        duration = int((time.time() - start_time) * 1000)
        log_agent_execution("extract_requirements", document_id, "document", "success", duration=duration)
        logger.info("extract_requirements_node: extracted %d requirements in %d ms", len(result.requirements), duration)
        return result

    except (ValidationError, ValueError) as e:
        duration = int((time.time() - start_time) * 1000)
        log_agent_execution("extract_requirements", document_id, "document", "failed", error=str(e), duration=duration)
        raise RuntimeError(f"Requirement extraction failed: {e}") from e
    except Exception as e:
        duration = int((time.time() - start_time) * 1000)
        log_agent_execution("extract_requirements", document_id, "document", "failed", error=str(e), duration=duration)
        raise


async def generate_test_cases_node(user_prompt: str, requirement_id: str) -> AITestCaseOutput:
    """
    Node sinh Test Case từ Requirement.
    Ưu tiên structured output; fallback về parse JSON thủ công nếu model/proxy
    không hỗ trợ function-calling (xem ghi chú ở extract_requirements_node).
    """
    start_time = time.time()
    messages = [
        SystemMessage(content=TC_SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]

    async def _attempt() -> AITestCaseOutput:
        # streaming=False: node await nguyên kết quả, không cần stream; giúp SDK retry sạch hơn.
        llm = get_llm(streaming=False)
        try:
            # Xem giải thích chi tiết ở extract_requirements_node._attempt — method="function_calling"
            # thay vì mặc định "json_schema" để tránh proxy dịch sai sang backend Claude/Anthropic,
            # nguyên nhân khiến mỗi lần generate tốn gấp đôi lời gọi LLM (structured luôn fail + fallback).
            structured_llm = llm.with_structured_output(AITestCaseOutput, method="function_calling")
            return await structured_llm.ainvoke(messages)
        except Exception as structured_exc:
            if _is_length_error(structured_exc):
                # Output vượt token → fallback (cùng prompt, còn dài hơn vì kèm schema) chắc chắn
                # cũng cắt cụt → không phí thêm 1 lời gọi. Ném luôn để retry-helper bỏ qua.
                raise RuntimeError(
                    f"LLM output too long (length limit reached) khi sinh test case: {structured_exc}"
                ) from structured_exc
            logger.warning(
                "Structured output failed for generate_test_cases_node (%s) — "
                "falling back to manual JSON parsing",
                structured_exc,
            )
            # Nhánh fallback tự parse JSON từ text → cần chỉ dẫn định dạng + schema
            # tường minh (structured output không dùng, nên schema chỉ ghép vào đây).
            fallback_messages = [
                SystemMessage(content=f"{TC_SYSTEM_PROMPT}\n\n{TC_JSON_FORMAT}"),
                HumanMessage(content=user_prompt),
            ]
            response = await llm.ainvoke(fallback_messages)
            data = _extract_json(response.content)
            return AITestCaseOutput.model_validate(data)

    try:
        result = await _run_llm_attempt_with_retry(_attempt, "generate_test_cases_node")

        duration = int((time.time() - start_time) * 1000)
        log_agent_execution("generate_test_cases", requirement_id, "requirement", "success", duration=duration)
        logger.info("generate_test_cases_node: generated %d test cases in %d ms", len(result.test_cases), duration)
        return result

    except (ValidationError, ValueError) as e:
        duration = int((time.time() - start_time) * 1000)
        log_agent_execution("generate_test_cases", requirement_id, "requirement", "failed", error=str(e), duration=duration)
        raise RuntimeError(f"Test case generation failed: {e}") from e
    except Exception as e:
        duration = int((time.time() - start_time) * 1000)
        log_agent_execution("generate_test_cases", requirement_id, "requirement", "failed", error=str(e), duration=duration)
        raise
