"""
ReAct Agent cho luồng chat có dùng tool (LangGraph create_react_agent) — được
services/chat_service.py gọi khi intent phân loại là "execute_tool" (người dùng yêu cầu
tạo/cập nhật Requirement hoặc Test Case qua chat, thay vì chỉ hỏi đáp thông thường).

5 tool AI có thể gọi: search_documents_tool (RAG), update_requirement_tool,
extract_requirement_tool, list_requirements_tool, generate_test_case_tool. Các tool sinh
nội dung (extract_requirement_tool, generate_test_case_tool) gọi ngược lại xuống
services/generation/ — module này KHÔNG tự gọi LLM để sinh JSON, chỉ điều phối tool.

_format_test_cases_summary trả về tóm tắt ngắn (số lượng + vài test case đầu) kèm deep-link
sang Tester Studio (`/test-cases?project_id=...`) thay vì bảng Markdown đầy đủ 7 cột — bảng
đầy đủ quá khổ so với khung chat. Agent LLM không cần (và bị cấm — xem chat_prompt.py)
tóm tắt/sinh lại nội dung, tránh tốn token và tránh AI diễn giải sai số liệu.
"""

import logging
from typing import List, Dict

# Số test case xem trước trực tiếp trong chat trước khi dẫn link sang Tester Studio.
_PREVIEW_COUNT = 3


def _format_test_cases_summary(req_id: str, res) -> str:
    """
    Tóm tắt ngắn gọn: tổng số lượng + vài test case đầu (chỉ tên + loại/priority),
    kèm link deep-link sang Tester Studio để xem/sửa đầy đủ.
    """
    tc_list = res.test_cases
    total = res.total_test_cases

    # Fetch requirement info để lấy project_id cho deep-link + feature name.
    req_feature_name = ""
    project_id = None
    try:
        from uuid import UUID
        from app.database import SessionLocal
        from app.models import Requirement
        with SessionLocal() as db:
            req = db.get(Requirement, UUID(req_id))
            if req:
                req_feature_name = req.feature_name or req.title or ""
                project_id = req.project_id
    except Exception:
        pass

    lines = []
    header = f"**Đã tạo xong {total} Test Case**"
    if req_feature_name:
        header += f" cho *{req_feature_name}*"
    lines.append(header + "\n")

    for i, tc in enumerate(tc_list[:_PREVIEW_COUNT], start=1):
        title = (tc.title or "").strip()
        test_type = tc.test_type or ""
        priority = tc.priority or ""
        meta = " · ".join(p for p in (test_type, priority) if p)
        line = f" - TC-{i:02d}: {title}"
        if meta:
            line += f" ({meta})"
        lines.append(line)

    remaining = total - min(_PREVIEW_COUNT, len(tc_list))
    if remaining > 0:
        lines.append(f" - ... và {remaining} test case khác")

    link = "/test-cases"
    if project_id:
        link += f"?project_id={project_id}"
    # Link được frontend style thành nút pill qua CSS `.markdown-body a[href^="/test-cases"]`
    # (kèm icon mũi tên), nên không cần emoji thủ công ở đây.
    lines.append(f"\n[Xem đầy đủ trong Tester Studio]({link})")

    return "\n".join(lines)


from langchain_core.messages import BaseMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from app.database import SessionLocal
from app.models import Requirement, TestCase
from app.services.agent.workflow_service import get_llm
from app.services.rag.retrieval_service import retrieve_relevant_chunks_async
from app.services.ownership_service import is_document_owned, is_requirement_owned
from app.prompts.chat_prompt import SYSTEM_PROMPT

from app.services.generation.requirement_generation_service import generate_requirements_from_document, list_requirements_by_document
from app.services.generation.test_case_generation_service import generate_test_cases_from_requirement

logger = logging.getLogger(__name__)

# Các field Requirement được phép sửa qua chat — allowlist tường minh để tránh mass
# assignment (trước đây tool cho sửa BẤT KỲ field nào tồn tại trên model, kể cả
# project_id/document_id/id/version — có thể bị lợi dụng để chiếm/phá dữ liệu).
_REQUIREMENT_UPDATABLE_FIELDS = {
    "title", "description", "functional_requirement", "validation_rule", "permission",
    "workflow", "state", "error_handling", "module_name", "feature_name", "actor",
    "business_rules", "inputs", "outputs", "preconditions", "validation_rules",
    "exception_flows", "source_reference", "status",
}


def get_chat_agent(user_id: str):
    """Khởi tạo ReAct Agent cho ĐÚNG user_id đang chat — mỗi tool được định nghĩa dưới
    dạng closure đóng gói user_id để tự kiểm tra quyền sở hữu document/requirement trước
    khi đọc/ghi dữ liệu (trước đây các tool không hề kiểm tra, cho phép đọc/ghi dữ liệu
    của BẤT KỲ user nào chỉ cần biết UUID — xem lịch sử audit)."""

    @tool
    async def search_documents_tool(query: str, document_ids: List[str]) -> str:
        """
        Tìm kiếm thông tin trong các tài liệu (SRS, tài liệu nghiệp vụ) dựa trên câu truy vấn của người dùng.
        Chỉ tìm kiếm trong danh sách document_ids được chỉ định.

        Args:
            query: Câu hỏi hoặc từ khóa cần tìm kiếm.
            document_ids: Danh sách ID của các tài liệu cần tìm.
        """
        logger.info(f"Running search_documents_tool for query: {query}")
        db = SessionLocal()
        try:
            owned_ids = [d for d in document_ids if is_document_owned(db, d, user_id)]
        finally:
            db.close()

        if not owned_ids:
            return "Không tìm thấy tài liệu hợp lệ (không thuộc quyền truy cập của bạn)."

        all_chunks = []
        db = SessionLocal()
        try:
            for doc_id in owned_ids:
                chunks = await retrieve_relevant_chunks_async(
                    db=db,
                    query=query,
                    top_k=5,
                    document_id=doc_id
                )
                all_chunks.extend(chunks)
        finally:
            db.close()

        if not all_chunks:
            return "Không tìm thấy dữ liệu liên quan."

        context_text = "\n\n---\n\n".join([chunk for chunk in all_chunks[:10]])
        return context_text

    @tool
    def update_requirement_tool(requirement_id: str, updates: Dict[str, str]) -> str:
        """
        Cập nhật dữ liệu của một Requirement cụ thể trong Database.

        Args:
            requirement_id: ID của Requirement cần cập nhật.
            updates: Dictionary chứa các trường cần cập nhật. (Ví dụ: {"title": "Tên mới", "status": "approved"})
        """
        logger.info(f"Running update_requirement_tool for req_id: {requirement_id}")
        db = SessionLocal()
        try:
            if not is_requirement_owned(db, requirement_id, user_id):
                return f"Lỗi: Không tìm thấy Requirement có ID {requirement_id}."

            req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
            if not req:
                return f"Lỗi: Không tìm thấy Requirement có ID {requirement_id}."

            applied = []
            for key, value in updates.items():
                if key in _REQUIREMENT_UPDATABLE_FIELDS and hasattr(req, key):
                    setattr(req, key, value)
                    applied.append(key)

            if not applied:
                return "Không có trường hợp lệ nào được cập nhật."

            db.commit()
            return f"Cập nhật thành công các trường: {applied}"
        except Exception as e:
            db.rollback()
            return f"Lỗi khi cập nhật Requirement: {str(e)}"
        finally:
            db.close()

    @tool
    async def extract_requirement_tool(document_ids: List[str]) -> str:
        """
        Sử dụng tool này khi người dùng yêu cầu tạo requirement, trích xuất requirement từ tài liệu.
        Nó sẽ phân tích tài liệu và tạo các requirement trong cơ sở dữ liệu.
        Kết quả trả về ĐÃ ĐƯỢC FORMAT SẴN thành Markdown — KHÔNG cần xử lý hay format lại.
        Chỉ cần hiển thị nguyên văn kết quả này cho người dùng.

        Args:
            document_ids: Danh sách ID của các tài liệu cần phân tích.
        """
        logger.info(f"Running extract_requirement_tool for docs: {document_ids}")
        db = SessionLocal()
        try:
            owned_ids = [d for d in document_ids if is_document_owned(db, d, user_id)]
        finally:
            db.close()

        if not owned_ids:
            return "Lỗi: không tìm thấy tài liệu hợp lệ thuộc quyền truy cập của bạn."

        results = []
        try:
            for doc_id in owned_ids:
                res = await generate_requirements_from_document(doc_id)

                # Hiện tên file thay vì UUID thô cho dễ đọc — UUID không có ý nghĩa với người
                # dùng cuối; ID thật vẫn được agent lấy lại qua list_requirements_tool khi cần.
                doc_label = doc_id
                try:
                    from uuid import UUID
                    from app.database import SessionLocal as _SessionLocal
                    from app.models import Document as _Document
                    with _SessionLocal() as _db:
                        _doc = _db.get(_Document, UUID(doc_id))
                        if _doc and _doc.original_filename:
                            doc_label = _doc.original_filename
                except Exception:
                    pass

                lines = [f"### 📋 Requirements trích xuất từ tài liệu `{doc_label}`\n"]
                for i, req in enumerate(res.requirements, start=1):
                    lines.append(f"#### {i}. {req.title}")
                    lines.append(f"**Mô tả:** {req.description}")

                    if req.functional_requirement and req.functional_requirement != req.description:
                        lines.append(f"\n**Yêu cầu chức năng:**\n{req.functional_requirement}")

                    if req.workflow:
                        lines.append("\n**Luồng nghiệp vụ (Workflow):**")
                        for step in req.workflow:
                            lines.append(f"- {step}")

                    if req.validation_rule:
                        lines.append("\n**Quy tắc kiểm tra (Validation):**")
                        for rule in req.validation_rule:
                            lines.append(f"- {rule}")

                    if req.permission:
                        lines.append("\n**Phân quyền (Permissions):**")
                        for p in req.permission:
                            lines.append(f"- {p}")

                    if req.state:
                        lines.append("\n**Trạng thái (State):**")
                        for s in req.state:
                            lines.append(f"- {s}")

                    if req.error_handling:
                        lines.append("\n**Xử lý lỗi (Error Handling):**")
                        for e in req.error_handling:
                            lines.append(f"- {e}")

                    if req.clarifying_questions:
                        lines.append("\n> **❓ Câu hỏi làm rõ từ AI (Dành cho QA/BA):**")
                        for q in req.clarifying_questions:
                            lines.append(f"> - {q}")

                    lines.append("\n---")

                results.append("\n".join(lines))
            return "\n\n".join(results)
        except Exception as e:
            logger.error(f"Error in extract_requirement_tool: {e}")
            return f"Lỗi khi tạo requirement: {str(e)}"

    @tool
    def list_requirements_tool(document_id: str) -> str:
        """
        Lấy danh sách và CHI TIẾT các requirement đã được tạo cho một tài liệu cụ thể.
        Sử dụng tool này để xem lại requirement hoặc biết ID của requirement trước khi tạo Test Case.
        Kết quả trả về đã được format sẵn — KHÔNG cần xử lý thêm, chỉ cần lấy các requirement_id từ danh sách để truyền vào generate_test_case_tool.

        Args:
            document_id: ID của tài liệu.
        """
        db = SessionLocal()
        try:
            owned = is_document_owned(db, document_id, user_id)
        finally:
            db.close()

        if not owned:
            return f"Không tìm thấy tài liệu {document_id}."

        try:
            res = list_requirements_by_document(document_id)
            if not res.requirements:
                return f"Tài liệu {document_id} chưa có requirement nào. Bạn cần tạo requirement trước."

            lines = [f"Tìm thấy {len(res.requirements)} requirement cho tài liệu `{document_id}`:\n"]
            for i, req in enumerate(res.requirements, start=1):
                lines.append(f"{i}. **{req.title}**")
                lines.append(f"   - ID: `{req.id}`")
                lines.append(f"   - Trạng thái: {req.status}")
                if req.description:
                    lines.append(f"   - Mô tả: {req.description[:150]}{'...' if len(req.description or '') > 150 else ''}")
                lines.append("")
            return "\n".join(lines)
        except Exception as e:
            return f"Lỗi khi lấy danh sách requirement: {str(e)}"

    @tool
    async def generate_test_case_tool(requirement_ids: List[str]) -> str:
        """
        Sử dụng tool này khi người dùng yêu cầu tạo Test Case từ Requirement.
        Nó sẽ sinh Test Case (tuân thủ ISTQB) và lưu vào cơ sở dữ liệu.
        Kết quả trả về ĐÃ ĐƯỢC FORMAT SẴN thành tóm tắt ngắn kèm link Tester Studio —
        KHÔNG cần xử lý hay format lại. Chỉ cần hiển thị nguyên văn kết quả này cho người dùng.

        Args:
            requirement_ids: Danh sách ID của các Requirement cần tạo Test Case.
        """
        logger.info(f"Running generate_test_case_tool for reqs: {requirement_ids}")
        db = SessionLocal()
        try:
            owned_ids = [r for r in requirement_ids if is_requirement_owned(db, r, user_id)]
        finally:
            db.close()

        if not owned_ids:
            return "Lỗi: không tìm thấy requirement hợp lệ thuộc quyền truy cập của bạn."

        results = []
        try:
            for req_id in owned_ids:
                res = await generate_test_cases_from_requirement(req_id)
                # Tóm tắt ngắn + deep-link ngay tại đây — AI không cần xử lý thêm
                summary_output = _format_test_cases_summary(req_id, res)
                results.append(summary_output)
            return "\n\n".join(results)
        except Exception as e:
            logger.error(f"Error in generate_test_case_tool: {e}")
            return f"Lỗi khi tạo test case: {str(e)}"

    llm = get_llm()
    tools = [
        search_documents_tool,
        update_requirement_tool,
        extract_requirement_tool,
        list_requirements_tool,
        generate_test_case_tool
    ]

    # create_react_agent manages the tool calling loop automatically
    agent = create_react_agent(
        llm,
        tools=tools,
        prompt=SYSTEM_PROMPT
    )
    return agent
