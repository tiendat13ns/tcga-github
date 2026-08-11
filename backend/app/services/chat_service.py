"""
Entry point cho "AI Chat Workspace" — router duy nhất chịu trách nhiệm QUYẾT ĐỊNH câu hỏi
của người dùng nên đi luồng nào, trước khi giao cho agent/RAG xử lý thật sự.

3 luồng xử lý (routing dựa trên intent — xem _keyword_classify/_llm_classify_intent):
  - execute_tool  : dùng ReAct agent đầy đủ tool (services/agent/chat_agent.py) — khi
                     người dùng yêu cầu tạo/cập nhật Requirement hoặc Test Case.
  - general_chat  : "Fast path" — RAG 1 lần rồi gọi LLM 1 lần, KHÔNG dùng tool/agent loop.
                     Dùng cho câu hỏi nghiệp vụ thông thường, nhanh hơn nhiều so với agent.
  - small_talk    : như general_chat nhưng bỏ qua bước RAG (chào hỏi không cần tra tài liệu).

Có 2 entry point song song: process_chat_message() (trả JSON 1 lần, dùng cho API thô/test)
và stream_chat_message() (SSE, dùng thật bởi frontend) — cả 2 dùng chung logic classify +
_fast_response/_agent_response nhưng khác cách trả kết quả về client.
"""

import logging
import re
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage

from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.agent.chat_agent import get_chat_agent
from app.services.agent.workflow_service import get_llm
from app.services.rag.retrieval_service import retrieve_relevant_chunks_async
from app.database import SessionLocal
from app.prompts.chat_prompt import (
    FAST_SYSTEM_PROMPT,
    INTENT_CLASSIFICATION_PROMPT,
    OVERVIEW_ANALYSIS_INSTRUCTION,
)
from app.services.chat_history_service import save_message

logger = logging.getLogger(__name__)

# ── Keyword-based classifier (O(1), 0ms latency, không tốn LLM token) ────────
_TOOL_KEYWORDS = re.compile(
    r"(tạo|sinh|generate|tao|extract|create|cập nhật|update)\s+"
    r"(requirement|test case|testcase|yêu cầu|tc|req)",
    re.IGNORECASE | re.UNICODE,
)

_SMALL_TALK_KEYWORDS = re.compile(
    r"^(chào|chao|hi|hello|hey|cảm ơn|cam on|thanks|thank you|ok|oke|okie|dạ|da|bạn là ai|ban la ai)\s*[\!\.\?]*$",
    re.IGNORECASE | re.UNICODE,
)

# "Phân tích tổng quan" (nút Quick Action hoặc gõ tương tự) vẫn là general_chat, nhưng cần
# RAG sâu hơn (nhiều chunk hơn) và output có cấu trúc cố định — khác với 1 câu hỏi ngắn
# thông thường chỉ cần top-3 chunk là đủ.
_OVERVIEW_ANALYSIS_KEYWORDS = re.compile(
    r"(phân tích|tóm tắt).{0,25}(tổng quan)",
    re.IGNORECASE | re.UNICODE,
)

_VALID_INTENTS = {"execute_tool", "general_chat", "small_talk"}

# ── Reasoning/chain-of-thought stripper ──────────────────────────────────────
# Một số model "reasoning" (qua proxy OpenAI-compatible) chèn thẳng đoạn suy luận nội
# bộ vào field `content` dưới dạng <think>...</think> thay vì tách riêng. Nếu không lọc,
# đoạn này sẽ hiện nguyên văn lên UI như thể là câu trả lời thật (vừa lộ nội bộ, vừa tốn
# token/thời gian ngược với chỉ dẫn "trả lời ngắn gọn" trong SYSTEM_PROMPT).
_THINK_OPEN = "<think>"
_THINK_CLOSE = "</think>"


def _strip_reasoning_block(text: str) -> str:
    """Loại bỏ <think>...</think> khỏi 1 chuỗi text đầy đủ (dùng cho response non-stream).
    Xử lý luôn trường hợp thiếu tag mở (proxy tự ẩn <think> ở đầu turn, chỉ trả về
    </think> mồ côi) — khi đó mọi thứ trước tag đóng cũng là reasoning, cắt luôn."""
    if not text or _THINK_CLOSE not in text.lower():
        return text
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.IGNORECASE | re.DOTALL)
    close_idx = text.lower().find(_THINK_CLOSE)
    if close_idx != -1:
        text = text[close_idx + len(_THINK_CLOSE):]
    return text.strip()


class _ThinkStreamFilter:
    """Lọc <think>...</think> theo từng chunk khi streaming SSE — không thể dùng regex
    một lần vì tag có thể bị cắt ngang giữa 2 chunk liên tiếp. feed() trả về phần text an
    toàn để emit ngay; phần cuối buffer (có thể là nửa tag) được giữ lại chờ chunk kế tiếp.
    flush() lấy nốt phần còn đọng lại khi stream kết thúc."""

    _MAX_TAG_LEN = max(len(_THINK_OPEN), len(_THINK_CLOSE))

    def __init__(self):
        self._buf = ""
        self._in_think = False

    def feed(self, chunk: str) -> str:
        self._buf += chunk
        out: list[str] = []
        while True:
            if self._in_think:
                idx = self._buf.lower().find(_THINK_CLOSE)
                if idx == -1:
                    return "".join(out)
                self._buf = self._buf[idx + len(_THINK_CLOSE):]
                self._in_think = False
                continue

            low = self._buf.lower()
            open_idx = low.find(_THINK_OPEN)
            close_idx = low.find(_THINK_CLOSE)

            if close_idx != -1 and (open_idx == -1 or close_idx < open_idx):
                # </think> mồ côi: proxy đã ẩn tag mở, mọi thứ trước đó là reasoning
                self._buf = self._buf[close_idx + len(_THINK_CLOSE):]
                continue

            if open_idx == -1:
                # Giữ lại tối đa (độ dài tag - 1) ký tự cuối phòng trường hợp tag bị cắt
                # ngang giữa chunk này và chunk kế tiếp.
                safe_len = max(0, len(self._buf) - self._MAX_TAG_LEN + 1)
                out.append(self._buf[:safe_len])
                self._buf = self._buf[safe_len:]
                return "".join(out)

            out.append(self._buf[:open_idx])
            self._buf = self._buf[open_idx + len(_THINK_OPEN):]
            self._in_think = True
            continue

    def flush(self) -> str:
        if self._in_think:
            self._buf = ""
            return ""
        remaining = self._buf
        self._buf = ""
        return remaining

# RAG top_k + số chunk đưa vào context — mặc định cho general_chat thường, và mở rộng
# riêng cho yêu cầu phân tích tổng quan (cần bao phủ rộng hơn, giống mức Requirement
# extraction, thay vì chỉ nhìn top-3 chunk gần nhất với câu hỏi).
_DEFAULT_RAG_TOP_K = 3
_DEFAULT_CONTEXT_CHUNK_LIMIT = 6
_OVERVIEW_RAG_TOP_K = 12
_OVERVIEW_CONTEXT_CHUNK_LIMIT = 15


def _is_overview_analysis_request(message: str) -> bool:
    """Nhận diện yêu cầu 'phân tích tổng quan' để áp RAG sâu hơn + prompt có cấu trúc cố
    định (xem OVERVIEW_ANALYSIS_INSTRUCTION) — khác với general_chat thông thường."""
    return bool(_OVERVIEW_ANALYSIS_KEYWORDS.search(message))


def _keyword_classify(message: str) -> str | None:
    """
    Phân loại ý định tức thì bằng Regex cho các câu RÕ RÀNG, không làm trễ API.
    Trả về None khi không chắc chắn — caller sẽ fallback sang LLM classify thật
    (ví dụ "tạo giúp tôi test case cho tài liệu này" không khớp regex vì có từ
    chen giữa động từ và danh từ, nhưng vẫn là execute_tool).
    """
    msg = message.strip()
    if _TOOL_KEYWORDS.search(msg):
        return "execute_tool"
    if _SMALL_TALK_KEYWORDS.match(msg):
        return "small_talk"
    return None


async def _llm_classify_intent(message: str) -> str:
    """
    Fallback LLM classify — chỉ gọi khi keyword-matching không đủ tự tin.
    Dùng INTENT_CLASSIFICATION_PROMPT thật (trước đây hàm này chỉ gọi lại
    _keyword_classify, khiến prompt phân loại không bao giờ thực sự được dùng).
    """
    try:
        llm = get_llm()
        messages = [
            SystemMessage(content=INTENT_CLASSIFICATION_PROMPT),
            HumanMessage(content=message),
        ]
        response = await llm.ainvoke(messages)
        label = (response.content or "").strip().lower()
        if label in _VALID_INTENTS:
            logger.info("LLM classified intent as: %s", label)
            return label
        logger.warning("LLM returned unexpected intent label '%s' — defaulting to general_chat", label)
        return "general_chat"
    except Exception as e:
        logger.warning("LLM intent classification failed (%s) — defaulting to general_chat", e)
        return "general_chat"


async def _build_fast_path_system_content(request: ChatRequest, use_rag: bool) -> str:
    """
    Build system prompt cho Fast Path — dùng chung giữa _fast_response() (JSON) và
    stream_chat_message() (SSE) để tránh lặp logic RAG + chọn prompt ở 2 nơi.

    Nếu câu hỏi là yêu cầu "phân tích tổng quan" (xem _is_overview_analysis_request), lấy
    RAG sâu hơn (top-12 thay vì top-3, giống mức Requirement extraction) và thêm
    OVERVIEW_ANALYSIS_INSTRUCTION để output có cấu trúc cố định thay vì tuỳ hứng mỗi lần.
    """
    is_overview = _is_overview_analysis_request(request.message)
    top_k = _OVERVIEW_RAG_TOP_K if is_overview else _DEFAULT_RAG_TOP_K
    context_limit = _OVERVIEW_CONTEXT_CHUNK_LIMIT if is_overview else _DEFAULT_CONTEXT_CHUNK_LIMIT

    context_chunks: list[str] = []
    if use_rag and request.document_ids:
        db = SessionLocal()
        try:
            for doc_id in request.document_ids:
                chunks = await retrieve_relevant_chunks_async(
                    db=db,
                    query=request.message,
                    top_k=top_k,
                    document_id=doc_id,
                )
                context_chunks.extend(chunks)
        finally:
            db.close()

    system_content = FAST_SYSTEM_PROMPT
    if is_overview:
        system_content += "\n\n" + OVERVIEW_ANALYSIS_INSTRUCTION
    if context_chunks:
        context_text = "\n\n---\n\n".join(context_chunks[:context_limit])
        system_content += f"\n\n## Nội dung tài liệu liên quan:\n\n{context_text}"

    return system_content


async def _fast_response(request: ChatRequest, use_rag: bool = True) -> str:
    """
    Luồng NHANH: Lấy chunk liên quan nhất từ Vector DB (Direct RAG) nếu use_rag=True → gọi LLM một lần duy nhất.
    Không nạp Tools, không có ReAct loop.
    """
    system_content = await _build_fast_path_system_content(request, use_rag)

    messages: list = [SystemMessage(content=system_content)]
    for msg in request.chat_history:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "ai":
            messages.append(AIMessage(content=msg.content))
    messages.append(HumanMessage(content=request.message))

    llm = get_llm()
    response = await llm.ainvoke(messages)
    return _strip_reasoning_block(response.content)


async def _agent_response(request: ChatRequest) -> str:
    """
    Luồng ĐẦY ĐỦ: Dùng ReAct Agent với đầy đủ Tools để tạo/cập nhật dữ liệu.
    """
    history = []
    for msg in request.chat_history:
        if msg.role == "user":
            history.append(HumanMessage(content=msg.content))
        elif msg.role == "ai":
            history.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            history.append(SystemMessage(content=msg.content))

    # Gắn document_ids vào context để agent biết phải search ở đâu
    context_instruction = (
        f"\n\n[Hệ thống: Người dùng đã chọn các tài liệu có ID: {request.document_ids}. "
        f"Nếu cần tìm thông tin, hãy gọi search_documents_tool với các ID này.]"
        if request.document_ids
        else ""
    )
    history.append(HumanMessage(content=request.message + context_instruction))

    agent = get_chat_agent(request.user_id)
    result = await agent.ainvoke({"messages": history})
    messages = result.get("messages", [])

    # Tool trả về Markdown đã format sẵn (bảng requirement/test case). Chế độ non-streaming
    # không có kênh riêng để đẩy bảng lên UI như luồng SSE, nên phải ghép vào response ở đây.
    # Chỉ 2 tool user-facing (xem giải thích ở stream_chat_message) mới được ghép vào response —
    # các tool nội bộ khác không hiện cho người dùng. So khớp CHÍNH XÁC tên tool để tránh bug cũ
    # trừ nhầm credit REQUIREMENT_EXTRACTION cho list_requirements_tool/update_requirement_tool.
    tool_outputs: list[str] = []
    for msg in messages:
        if isinstance(msg, ToolMessage) and msg.content:
            tool_name = getattr(msg, "name", "") or ""
            if tool_name == "generate_test_case_tool":
                _deduct_credits_for_request(request, "TEST_CASE_GENERATION")
            elif tool_name == "extract_requirement_tool":
                _deduct_credits_for_request(request, "REQUIREMENT_EXTRACTION")

            if tool_name in ("generate_test_case_tool", "extract_requirement_tool"):
                tool_outputs.append(str(msg.content))

    final_text = ""
    if messages and isinstance(messages[-1], AIMessage):
        final_text = _strip_reasoning_block(messages[-1].content or "")

    return "\n\n".join(tool_outputs + ([final_text] if final_text else []))


def _describe_provider_error(exc: Exception) -> str:
    """Chuyển exception kỹ thuật từ AI provider thành message dễ hiểu cho người dùng,
    tránh lộ traceback/API key ra ngoài."""
    try:
        import openai
        if isinstance(exc, openai.PermissionDeniedError):
            return "AI provider từ chối truy cập model hiện tại (kiểm tra quyền/subscription của API key)."
        if isinstance(exc, openai.RateLimitError):
            return "Đã vượt giới hạn tốc độ gọi AI provider. Vui lòng thử lại sau ít phút."
        if isinstance(exc, openai.APITimeoutError):
            return "AI provider phản hồi quá chậm (timeout). Vui lòng thử lại."
        if isinstance(exc, openai.APIConnectionError):
            return "Không thể kết nối tới AI provider. Vui lòng thử lại sau."
    except ImportError:
        pass
    return "Hệ thống AI hiện đang gặp sự cố, vui lòng thử lại sau."


def _deduct_credits_for_request(request: ChatRequest, operation: str) -> None:
    user_id = getattr(request, "user_id", None)
    if not user_id:
        return
    try:
        from app.database import SessionLocal
        from app.models import User
        from app.services.credit_service import deduct_user_credits
        from uuid import UUID
        db = SessionLocal()
        try:
            user = db.get(User, UUID(user_id))
            if user:
                deduct_user_credits(db, user, operation)
        finally:
            db.close()
    except Exception as e:
        logger.warning("Credit deduction failed (non-fatal): %s", e)


def _persist_user_message(request: ChatRequest) -> None:
    """Lưu tin nhắn user vào lịch sử chat của project (nếu request có project_id + user_id).
    Không lưu được thì bỏ qua im lặng — không nên làm gián đoạn luồng chat chính."""
    user_id = getattr(request, "user_id", None)
    if not request.project_id or not user_id:
        return
    db = SessionLocal()
    try:
        save_message(db, request.project_id, user_id, "user", request.message)
    finally:
        db.close()


def _persist_ai_message(request: ChatRequest, content: str, error: bool = False) -> None:
    user_id = getattr(request, "user_id", None)
    if not request.project_id or not user_id or not content:
        return
    db = SessionLocal()
    try:
        save_message(db, request.project_id, user_id, "ai", content, error=error)
    finally:
        db.close()


# ── Public Entry Point ───────────────────────────────────────────────────────
async def process_chat_message(request: ChatRequest) -> ChatResponse:
    message = request.message.strip()
    intent = _keyword_classify(message)
    if intent is None:
        intent = await _llm_classify_intent(message)

    logger.info("Router → intent=%s for message: %.80s", intent, message)

    _persist_user_message(request)

    if intent != "execute_tool":
        _deduct_credits_for_request(request, "COPILOT_CHAT")

    if intent == "execute_tool":
        final_response = await _agent_response(request)
    elif intent == "general_chat":
        final_response = await _fast_response(request, use_rag=True)
    else:
        final_response = await _fast_response(request, use_rag=False)

    _persist_ai_message(request, str(final_response))

    return ChatResponse(response=str(final_response))


# ── Streaming Entry Point ────────────────────────────────────────────────────
async def stream_chat_message(request: ChatRequest):
    import json
    from langchain_core.messages import AIMessageChunk

    message = request.message.strip()
    intent = _keyword_classify(message)
    if intent is None:
        intent = await _llm_classify_intent(message)

    logger.info("StreamRouter → intent=%s for message: %.80s", intent, message)

    _persist_user_message(request)
    # Gom lại toàn bộ text đã stream ra UI để lưu thành 1 message AI hoàn chỉnh vào lịch
    # sử sau khi stream xong — không lưu từng chunk riêng lẻ.
    full_response_parts: list[str] = []
    had_error = False

    if intent != "execute_tool":
        _deduct_credits_for_request(request, "COPILOT_CHAT")

    try:
        # ── Nhánh AGENT (execute_tool): stream qua LangGraph ─────────────────
        if intent == "execute_tool":
            history = []
            for msg in request.chat_history:
                if msg.role == "user":
                    history.append(HumanMessage(content=msg.content))
                elif msg.role == "ai":
                    history.append(AIMessage(content=msg.content))
                elif msg.role == "system":
                    history.append(SystemMessage(content=msg.content))

            context_instruction = (
                f"\n\n[Hệ thống: Người dùng đã chọn các tài liệu có ID: {request.document_ids}. "
                f"Nếu cần tìm thông tin, hãy gọi search_documents_tool với các ID này.]"
                if request.document_ids
                else ""
            )
            history.append(HumanMessage(content=request.message + context_instruction))

            agent = get_chat_agent(request.user_id)
            # Buffer text tự thuật của agent thay vì đẩy thẳng lên UI. Agent (ReAct) hay tự thuật
            # kế hoạch giữa các bước ("Lấy danh sách requirements trước...", "tiến hành tạo test
            # case...") — đây là suy nghĩ nội bộ, KHÔNG nên hiện cho user; nếu đẩy ngay còn bị khối
            # tool output chèn vào giữa, cắt xé câu chữ.
            # Quy tắc: text thuộc lượt CÓ gọi tool = planning → bỏ; chỉ text của lượt trả lời CUỐI
            # (không kèm tool call) mới là câu chốt → flush 1 lần khi stream kết thúc.
            agent_text_buf: list[str] = []
            async for event in agent.astream({"messages": history}, stream_mode="messages"):
                # event = (chunk, metadata) khi stream_mode="messages"
                chunk, _meta = event if isinstance(event, tuple) else (event, {})

                # Chỉ 2 tool này được thiết kế để stream kết quả trực tiếp lên UI cho người
                # dùng xem (xem SYSTEM_PROMPT trong chat_prompt.py) — các tool nội bộ khác
                # (list_requirements_tool, search_documents_tool, update_requirement_tool) chỉ
                # phục vụ agent tự suy luận/chuỗi sang tool call tiếp theo (vd lấy requirement_id
                # để gọi generate_test_case_tool), KHÔNG nên lộ ra màn hình chat (chứa UUID thô,
                # gây khó hiểu cho người dùng).
                from langchain_core.messages import ToolMessage, ToolMessageChunk
                if isinstance(chunk, (ToolMessage, ToolMessageChunk)) and chunk.content:
                    # Có tool chạy → text agent tích luỹ trước đó là planning của lượt hành động
                    # này → bỏ đi để không lộ và không bị chèn vào giữa tool output.
                    agent_text_buf.clear()
                    tool_name = getattr(chunk, "name", "") or ""
                    # So khớp CHÍNH XÁC tên tool — tránh bug cũ: "requirement" in tool_name.lower()
                    # khớp nhầm cả list_requirements_tool/update_requirement_tool (không gọi LLM,
                    # đáng lẽ miễn phí) khiến user bị trừ oan credit REQUIREMENT_EXTRACTION.
                    if tool_name == "generate_test_case_tool":
                        _deduct_credits_for_request(request, "TEST_CASE_GENERATION")
                    elif tool_name == "extract_requirement_tool":
                        _deduct_credits_for_request(request, "REQUIREMENT_EXTRACTION")

                    if tool_name in ("generate_test_case_tool", "extract_requirement_tool"):
                        text = chunk.content
                        # Thêm khoảng trắng để tách biệt với các câu chữ khác
                        full_response_parts.append(f"\n\n{text}\n\n")
                        payload = json.dumps({"chunk": f"\n\n{text}\n\n"}, ensure_ascii=False)
                        yield f"data: {payload}\n\n"
                    continue

                # Chỉ xét text sinh từ chính node agent (bỏ text sinh từ LLM lồng bên trong tool)
                if _meta.get("langgraph_node") != "agent":
                    continue

                if isinstance(chunk, AIMessageChunk):
                    # Chunk đang sinh arguments cho một tool call → lượt này là hành động, không
                    # phải câu trả lời cuối → xoá text đã buffer của lượt này.
                    if getattr(chunk, "tool_call_chunks", None):
                        agent_text_buf.clear()
                        continue
                    if chunk.content:
                        agent_text_buf.append(chunk.content)

            # Kết thúc stream: phần còn lại trong buffer là câu chốt của lượt trả lời cuối (lượt
            # không gọi tool). Lọc <think> rồi đẩy 1 lần — tránh chèn vào giữa các khối tool output.
            final_text = _strip_reasoning_block("".join(agent_text_buf)).strip()
            if final_text:
                full_response_parts.append(final_text)
                payload = json.dumps({"chunk": final_text}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

        # ── Nhánh FAST (general_chat / small_talk): stream trực tiếp LLM ─────
        else:
            use_rag = (intent == "general_chat")
            system_content = await _build_fast_path_system_content(request, use_rag)

            messages_list: list = [SystemMessage(content=system_content)]
            for msg in request.chat_history:
                if msg.role == "user":
                    messages_list.append(HumanMessage(content=msg.content))
                elif msg.role == "ai":
                    messages_list.append(AIMessage(content=msg.content))
            messages_list.append(HumanMessage(content=request.message))

            think_filter = _ThinkStreamFilter()
            llm = get_llm()
            async for chunk in llm.astream(messages_list):
                if chunk.content:
                    text = think_filter.feed(chunk.content)
                    if text:
                        full_response_parts.append(text)
                        payload = json.dumps({"chunk": text}, ensure_ascii=False)
                        yield f"data: {payload}\n\n"

            tail = think_filter.flush()
            if tail:
                full_response_parts.append(tail)
                payload = json.dumps({"chunk": tail}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

    except Exception as exc:
        # Không để lỗi từ AI provider (403/429/timeout/network...) làm crash cả
        # ASGI response — trả về một chunk báo lỗi dễ hiểu rồi kết thúc stream sạch sẽ.
        logger.error("stream_chat_message failed (intent=%s): %s", intent, exc, exc_info=True)
        error_text = _describe_provider_error(exc)
        had_error = True
        full_response_parts.append(f"\n\n❌ {error_text}")
        payload = json.dumps({"chunk": f"\n\n❌ {error_text}"}, ensure_ascii=False)
        yield f"data: {payload}\n\n"

    _persist_ai_message(request, "".join(full_response_parts).strip(), error=had_error)

    # Signal kết thúc stream
    yield "data: [DONE]\n\n"
