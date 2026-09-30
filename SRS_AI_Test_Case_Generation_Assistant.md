# SOFTWARE REQUIREMENTS SPECIFICATION
# AI Test Case Generation Assistant (TCGA)

**Phiên bản:** 2.2 — Cập nhật theo hệ thống triển khai thực tế  
**Ngày cập nhật:** 2026-08-12  
**Trạng thái:** Production-ready MVP

---

## 1. Giới thiệu

### 1.1 Mục tiêu hệ thống

Hệ thống **AI Test Case Generation Assistant (TCGA)** hỗ trợ BA/QA tự động hóa việc:

1. **Phân tích tài liệu đặc tả** (SRS, BRD, User Story, API Spec) thông qua pipeline Upload → Text Extraction → Vector Embedding → RAG Retrieval.
2. **Trích xuất Requirement có cấu trúc** bằng AI (LLM + Pydantic validation schema).
3. **Sinh Test Case chuẩn QA** từ Requirement đã được review/approve.
4. **Quản lý và export** Test Case ra Excel (`.xlsx`) theo chuẩn 10 cột.
5. **AI Chat Workspace** để hỏi đáp, phân tích và thao tác nhanh với tài liệu/requirement/test case.

**Trọng tâm kỹ thuật:**
- Backend kiểm soát state machine, validate AI schema trước khi lưu DB.
- RAG (Retrieval-Augmented Generation) tách biệt theo từng Project để đảm bảo dữ liệu không bị trộn lẫn.
- Hệ thống Credit để theo dõi chi phí API mỗi tác vụ AI.
- Human-in-the-Loop: AI có thể đặt câu hỏi làm rõ (clarifying_questions), người dùng trả lời (user_answers).

### 1.2 Phạm vi MVP (Đã triển khai)

| Tính năng | Trạng thái |
|-----------|------------|
| Xác thực người dùng (Supabase Auth + JWT) | ✅ Done |
| Quản lý Project (CRUD) | ✅ Done |
| Upload tài liệu đa định dạng | ✅ Done |
| Text Extraction + Vector Embedding (RAG) | ✅ Done |
| AI Requirement Extraction (LangGraph + OpenAI-compatible) | ✅ Done |
| Requirement Review / Human-in-the-Loop Q&A | ✅ Done |
| AI Test Case Generation từ Requirement | ✅ Done |
| Test Case Studio (Bulk Edit, Filter, CRUD) | ✅ Done |
| Export Excel (.xlsx) 10 cột | ✅ Done |
| AI Chat Workspace (Streaming SSE) + Chat History | ✅ Done |
| Credit & Usage Tracking | ✅ Done |
| Auto Bug Report Generation | ✅ Done |
| In-app Feedback (bug / feature request) | ✅ Done |
| Admin Dashboard (quản lý user, credit, plan, feedback) | ✅ Done |

### 1.3 Ngoài phạm vi MVP

- **Kiểm thử phi-blackbox**: hệ thống CHỈ sinh test case black-box chức năng (Positive/Negative/Boundary/Validation/Integration/Permission theo role). KHÔNG sinh white-box/code-level test (unit test, coverage nội bộ), performance/load/stress test, hay penetration-testing/security-exploit test (SQL injection, XSS, fuzzing...) — vì tester chỉ có tài liệu yêu cầu, không có quyền truy cập source code hay hạ tầng để thực hiện các loại kiểm thử đó.
- Tích hợp Jira / TestRail / Xray hai chiều.
- Collaborative editing realtime (WebSocket multi-user).
- Fine-tuning model riêng (custom LLM).
- OCR nâng cao cho scan PDF chất lượng thấp.
- Tự động chạy test automation hoặc sinh automation script hoàn chỉnh.
- Email notification / Webhook.
- Gói thanh toán Lite / Pro (hiện tại chỉ hiển thị, chưa tích hợp payment gateway).

---

## 2. Tổng quan người dùng và vai trò

| Vai trò | Quyền hạn | Ghi chú |
|---------|-----------|---------|
| **User (Tester/BA)** | Tạo/xóa Project, upload Document, generate Requirement & Test Case, bulk edit, export, chat AI, gửi feedback | Role mặc định khi đăng ký |
| **Admin** | Toàn bộ quyền User + Admin Dashboard: xem thống kê hệ thống, quản lý credit/plan của user, xử lý feedback | Role `admin` (email nằm trong `ADMIN_EMAILS`) |

**Credit & Plan System:**
- Tài khoản mới được cấp **200 Credits** (`users.credit_balance` default 200). Admin được cấp **3.500 Credits**.
- **Plan là một cột độc lập** `users.plan` (`free` | `lite` | `pro`), **KHÔNG** suy ra từ `credit_balance`. `credit_balance` chỉ là số dư chi tiêu cho tác vụ AI; `plan` quyết định quota (số Document / Project / dung lượng). Nguồn sự thật: `PLAN_DEFINITIONS` trong `credit_service.py`.
- Quota theo gói: **Free** = 5 docs / 3 projects / 50MB; **Lite** = 15 docs / 10 projects / 500MB; **Pro** = không giới hạn / 2GB.
- Giới hạn Document được kiểm bằng `users.documents_uploaded_total` — bộ đếm **cộng dồn, không giảm khi xóa** — nên không thể xóa tài liệu cũ rồi upload lại để lách quota.
- **Admin không có cơ chế bypass credit**: mọi role đều bị trừ credit như nhau khi gọi tính năng AI; admin chỉ khác ở `plan = "pro"`, `credit_balance` cao và quyền truy cập Admin Dashboard.

---

## 3. Luồng nghiệp vụ tổng thể

### 3.1 Core Workflow

```
[User] Đăng nhập (Supabase Auth → JWT)
   ↓
[User] Tạo hoặc chọn Project
   ↓
[User] Upload tài liệu vào Project
   ↓
[Backend] Kiểm tra: file type, file size (≤10MB), credit quota
   ↓  Trừ 2 Credits (DOCUMENT_INGESTION)
[Backend] Lưu file → storage (uploads/), tạo Document record (status="uploaded")
   ↓
[Extract Engine] Trích xuất text (pdfplumber/python-docx/openpyxl...)
   → Thành công: status = "completed", lưu extracted_text
   → Thất bại:   status = "failed",    lưu error_message
   ↓
[Embedding Pipeline] Chunking (LangChain) → Embedding (1536-dim) → lưu document_chunks + HNSW index
   ↓
[User] Chọn Document "completed" → yêu cầu Generate Requirements
   ↓
[Backend] Tách outline → chia batch theo source section → build prompt → gọi LLM
   → Hậu kiểm coverage và chạy bổ sung cho section còn thiếu
   ↓
[LLM] Trả về JSON → Backend Pydantic validate → lưu requirements (status="ai_generated")
   AI có thể sinh clarifying_questions → lưu vào requirement.clarifying_questions
   → Thành công: trừ 17 Credits (REQUIREMENT_EXTRACTION)
   ↓
[User] Review Requirement → trả lời clarifying_questions (PATCH /requirements/{id}/answers)
   → Approve / Edit / Reject
   ↓
[User] Chọn Requirement → yêu cầu Generate Test Cases
   ↓  Trừ 50 Credits (TEST_CASE_GENERATION)
[Backend] Build prompt từ requirement context → gọi LLM
   ↓
[LLM] Trả về JSON → Backend Pydantic validate → lưu test_cases (status="ai_generated")
   ↓
[User] Test Case Studio: Review / Bulk Edit / Filter / Approve / Reject
   ↓
[User] Export Excel (.xlsx) → lưu export_history (qua usage_logs)
```

### 3.2 AI Chat Workflow

```
[User] Mở AI Chat Workspace trong Project
   ↓
[User] Nhập câu hỏi / lệnh nhanh (Quick Actions)
   ↓
[Intent Router] Phân loại tin nhắn thành 1 trong 3 nhánh:
   - Regex fast-path (0ms) khớp được cho câu RÕ RÀNG → dùng luôn kết quả.
   - Nếu regex không chắc → gọi LLM classify thật (INTENT_CLASSIFICATION_PROMPT) để quyết định.
   ↓
   ├─ "execute_tool"  (tạo/cập nhật Requirement, Test Case)
   │     ↓ Trừ credit theo tool thực sự chạy (17 REQUIREMENT_EXTRACTION / 50 TEST_CASE_GENERATION)
   │  [ReAct Agent — LangGraph] có thể gọi các tool:
   │     - search_documents_tool      (RAG semantic search theo document/project)
   │     - update_requirement_tool    (cập nhật field của 1 Requirement)
   │     - extract_requirement_tool   (sinh Requirement từ tài liệu)
   │     - list_requirements_tool     (lấy danh sách + ID Requirement)
   │     - generate_test_case_tool    (sinh Test Case từ Requirement)
   │
   ├─ "general_chat"  (hỏi đáp nghiệp vụ thông thường)
   │     ↓ Trừ 10 Credits (COPILOT_CHAT)
   │  [Fast Path] RAG 1 lần (top-3 chunk/document) → gọi LLM 1 lần, KHÔNG dùng tool/agent loop.
   │
   └─ "small_talk"    (chào hỏi, cảm ơn...)
         ↓ Trừ 10 Credits (COPILOT_CHAT)
      [Fast Path] Gọi LLM 1 lần, KHÔNG dùng RAG (không cần tra tài liệu).
   ↓
[Response] Streaming SSE (text/event-stream) → hiển thị trực tiếp trên UI.
   Nếu AI provider lỗi giữa chừng (hết quota, rate limit, timeout...), stream kết thúc gọn
   với 1 message lỗi dễ hiểu thay vì crash kết nối.
```

---

## 4. Yêu cầu chức năng chi tiết

### 4.1 UC01 — Xác thực người dùng (Authentication)

**Actors:** User

| ID | Yêu cầu |
|----|---------|
| UC01-F01 | User đăng ký bằng email + password. Backend gọi Supabase Auth `sign_up`, sau đó tạo record trong bảng `users` với `credit_balance = 200`, `plan = "free"`, `role = "user"`. Nếu email nằm trong `ADMIN_EMAILS` → `role = "admin"`, `plan = "pro"`, `credit_balance = 3500`. |
| UC01-F02 | User đăng nhập bằng email + password. Backend gọi Supabase `sign_in_with_password`, trả về `access_token` (JWT) + `refresh_token`. Nếu user chưa có record local → tự tạo (sync). |
| UC01-F03 | `POST /api/auth/refresh` đổi `refresh_token` lấy `access_token` mới (Supabase `refresh_session`) để giữ phiên mà không bắt login lại. |
| UC01-F04 | Mọi API yêu cầu auth đều dùng Bearer token (JWT). Backend xác minh chữ ký JWT bằng `SUPABASE_JWT_SECRET` (HS256) — decode cục bộ, không gọi network. |
| UC01-F05 | `GET /api/auth/me` trả về `{id, email, role, plan, credit_balance, created_at}`. |
| UC01-F06 | Nếu email đã tồn tại trong DB → trả về HTTP 400 `"Email already registered"`. |
| UC01-F07 | Nếu JWT không hợp lệ/hết hạn → trả về HTTP 401. Nếu login khi email chưa được xác nhận → 401 với message riêng ("Email chưa được xác nhận..."). |

**State Machine User:**
```
[unregistered] → đăng ký → [active]
[active] → đăng nhập → [authenticated session]
[authenticated session] → hết token → [expired] → refresh → [authenticated session]
```

---

### 4.2 UC02 — Quản lý Project

**Actors:** User (đã đăng nhập)

| ID | Yêu cầu |
|----|---------|
| UC02-F01 | User tạo Project với `name` (bắt buộc) và `description` (tùy chọn). Project tự động gắn `user_id` của người tạo. |
| UC02-F02 | `GET /api/v1/projects` trả về danh sách Projects của user hiện tại kèm thống kê: `file_count`, `req_count`, `test_case_count` (số requirement distinct có test case). |
| UC02-F03 | `GET /api/v1/projects/{id}` trả về chi tiết một project. Backend kiểm tra `project.user_id == current_user.id`; nếu không khớp → trả về 404 (không lộ 403 để tránh enumeration). |
| UC02-F04 | `PUT /api/v1/projects/{id}` cho phép cập nhật `name`, `description`. |
| UC02-F05 | `DELETE /api/v1/projects/{id}` xóa cascade toàn bộ: Documents → DocumentChunks → Requirements → TestCases. |
| UC02-F06 | Trang Overview mặc định khi đăng nhập (`/overview`). Projects được hiển thị dạng Grid. |

---

### 4.3 UC03 — Upload & Quản lý Document

**Actors:** User

| ID | Yêu cầu |
|----|---------|
| UC03-F01 | `POST /api/documents/upload` nhận `multipart/form-data` với một hoặc nhiều files và tham số `project_id` (query param, tùy chọn). |
| UC03-F02 | **Định dạng file được chấp nhận:** `pdf`, `docx`, `txt`, `md`, `xlsx`, `csv`, `dbml`, và `zip` (chứa các file trên). |
| UC03-F03 | **Giới hạn kích thước:** Tối đa **10MB** mỗi file. File vượt giới hạn → HTTP 400 `"File too large"`. |
| UC03-F04 | Nếu user đã đăng nhập, Backend kiểm tra quota Free Plan (tối đa 5 documents). Vượt quota → HTTP 403. |
| UC03-F05 | Trừ **2 Credits** (DOCUMENT_INGESTION) cho mỗi file được upload thành công. |
| UC03-F06 | File được lưu vào thư mục `backend/uploads/` với tên `{uuid}_{original_filename}`. |
| UC03-F07 | Document record được tạo với `status = "uploaded"`. Backend tự động trigger text extraction. |
| UC03-F08 | **Text Extraction Pipeline:** |
| | - PDF: `pdfplumber` |
| | - DOCX: `python-docx` |
| | - XLSX/CSV: `openpyxl` + pandas-like parse |
| | - TXT/MD/DBML: đọc trực tiếp |
| | - ZIP: giải nén → xử lý từng file bên trong |
| UC03-F09 | Sau extraction thành công: `status = "completed"`, `extracted_text` được lưu. |
| UC03-F10 | Sau extraction thất bại: `status = "failed"`, `error_message` lưu lý do lỗi. |
| UC03-F11 | **Embedding Pipeline** (sau extraction, chạy NGẦM trong thread riêng — không block response upload): Chunking theo cấu trúc heading — DOCX nhận diện Word Heading style, đoạn text ngắn bôi đậm dạng "Label:", và danh sách từ khoá section phổ biến (Input/Output/Acceptance Criteria...); PDF suy luận heading từ cỡ chữ tương đối so với "body text" của tài liệu. Tài liệu không có cấu trúc heading nào → fallback cắt theo ký tự (RecursiveCharacterTextSplitter). Sau đó embed bằng OpenAI-compatible API (1536 dimensions) → lưu vào bảng `document_chunks` với HNSW index. |
| UC03-F12 | `GET /api/documents?project_id=...` trả về danh sách documents của project. |
| UC03-F13 | `GET /api/v1/documents/{id}` trả về chi tiết document bao gồm `extracted_text` preview. |
| UC03-F14 | `POST /api/documents/{id}/extract-text` (manual re-trigger extraction). |
| UC03-F15 | Chỉ document có `status = "completed"` mới được dùng để generate requirements. |

**Document Status State Machine:**
```
uploaded → [Text Extraction] → completed
                              → failed
```

---

### 4.4 UC04 — Trích xuất Requirement (AI Requirement Generation)

**Actors:** User, AI Agent

| ID | Yêu cầu |
|----|---------|
| UC04-F01 | `POST /api/v1/documents/{document_id}/requirements/generate` kích hoạt generate. Chạy **NỀN (fire-and-forget)**: endpoint đánh dấu `documents.requirement_status = "generating"` rồi trả **HTTP 202** ngay; job LLM chạy trong background (`job_runner`, giới hạn concurrency bằng semaphore). Nếu đang có job "generating" cho cùng document → **HTTP 409**. Credit chỉ bị trừ khi job **thành công**. |
| UC04-F02 | Backend kiểm tra: document phải có `status = "completed"` và `extracted_text` không rỗng. |
| UC04-F03 | **Coverage Strategy:** Backend đọc outline Markdown từ `extracted_text`, loại heading metadata/nội bộ, gắn marker `[SOURCE SECTION: ...]` và chia batch theo section với ngưỡng `REQUIREMENT_CONTEXT_MAX_CHARS` (mặc định 24.000 ký tự). Mọi section nghiệp vụ được đưa vào prompt theo thứ tự nguồn, không dùng top-k toàn cục cho bước trích xuất Requirement. |
| UC04-F04 | Sau lượt đầu, backend đối chiếu `source_reference` với các section đã phát hiện. Section chưa được ánh xạ sẽ được chạy một lượt bổ sung; log ghi số section phát hiện, đã bao phủ và còn thiếu. |
| UC04-F05 | Backend build prompt (system + user) → gọi LLM qua OpenAI-compatible API. |
| UC04-F06 | Ưu tiên dùng **Structured Output** (function-calling) để LLM trả trực tiếp object khớp `AIRequirementOutput` — Pydantic validate ngay trong quá trình gọi. Nếu model/proxy không hỗ trợ function-calling, tự động fallback: LLM trả JSON dạng text → Backend tự tách JSON (regex + JSONDecoder) → Pydantic validate thủ công. |
| UC04-F07 | Khi re-generate, thao tác xóa Requirements cũ và lưu bộ mới nằm trong cùng transaction; nếu lưu thất bại thì dữ liệu cũ không bị mất. |
| UC04-F08 | Requirements được lưu vào DB với `status = "ai_generated"`. |
| UC04-F09 | AI sinh `clarifying_questions` chỉ cho thông tin thực sự thiếu; không suy diễn để lấp trường trống và backend loại câu hỏi trùng nguyên văn sau khi chuẩn hóa khoảng trắng/chữ hoa-thường. |
| UC04-F10 | Mọi lần AI chạy ghi `AgentLog` với: `task_type`, `model`, `status`, `execution_time_ms`, `error_message`. |
| UC04-F11 | `GET /api/v1/documents/{document_id}/requirements` trả về danh sách requirements của document. |
| UC04-F12 | `GET /api/v1/projects/{project_id}/requirements` trả về requirements (version mới nhất) của **mọi** document trong project bằng 1 query — tránh N+1 khi hiển thị trang danh sách document. |
| UC04-F13 | `PATCH /api/v1/requirements/{id}/answers` nhận payload tương thích ngược gồm `answers?: list[str] | null` và `user_context?: string | null` (tối đa 4.000 ký tự). Chỉ field xuất hiện trong payload mới được cập nhật. |

**Requirement Status State Machine:**
```
ai_generated → [User Review] → approved
                             → rejected
                             → (edit trực tiếp, giữ ai_generated)
```

---

### 4.5 UC05 — Sinh Test Case (AI Test Case Generation)

**Actors:** User, AI Agent

| ID | Yêu cầu |
|----|---------|
| UC05-F01 | `POST /api/v1/requirements/{requirement_id}/test-cases/generate` kích hoạt generate. Chạy **NỀN**: endpoint set `requirements.test_case_status = "generating"` bằng **một câu UPDATE có điều kiện (atomic)** rồi trả **HTTP 202**; job LLM chạy background. Nếu requirement đang "generating" (câu UPDATE không khớp row nào) → **HTTP 409**, đảm bảo không bao giờ có 2 job song song cho cùng 1 requirement (tránh trùng test case / trừ credit 2 lần). Credit chỉ trừ khi job thành công. |
| UC05-F02 | Backend kiểm tra credit đủ trước khi nhận job; requirement `status = "rejected"` không được sinh test case. |
| UC05-F03 | Backend build prompt từ toàn bộ Requirement, bao gồm Actor, Goal, Trigger, Components, Error Messages, flow/rule hiện có, `user_answers` và `user_context`. `user_context` được đặt trong khối `[USER-CONFIRMED CONTEXT]` để phân biệt với nội dung AI trích xuất. |
| UC05-F04 | RAG: retrieve thêm context liên quan (top-15 chunk) từ `document_chunks` của document gốc, scope theo `document_id`. |
| UC05-F05 | Ưu tiên **Structured Output** (function-calling) để validate trực tiếp theo `AITestCaseOutput`; fallback về parse JSON thủ công nếu model/proxy không hỗ trợ (giống UC04-F06). |
| UC05-F06 | **Chỉ sinh test case Black-box chức năng.** Áp dụng kỹ thuật ISTQB (Equivalence Partitioning, Boundary Value Analysis, Decision Table, State Transition). KHÔNG sinh test case white-box/code-level, performance/load, hay penetration-testing/security-exploit (SQL injection, XSS...). Số lượng test case co giãn theo độ phức tạp Requirement (tham khảo: ~8-12 case cho yêu cầu đơn giản, ~20-30 cho yêu cầu phức tạp nhiều rule/role/state), không áp con số cố định. |
| UC05-F07 | Test cases thiếu `title` hoặc `expected_result` → bị loại, không lưu DB. |
| UC05-F08 | **Khác với Requirement**, test cases cũ **KHÔNG bị xóa** khi re-generate: bộ mới được lưu với `version = max(version) + 1` (giữ lịch sử các lần sinh). `GET .../test-cases` trả về bộ version mới nhất. |
| UC05-F09 | Test cases lưu với `status = "ai_generated"`, `execution_status = "Untested"`. |
| UC05-F10 | `GET /api/v1/requirements/{id}/test-cases` trả về danh sách test cases (version mới nhất) của requirement. |
| UC05-F11 | Nếu requirement có `clarifying_questions` đã được trả lời (`user_answers`), mỗi câu trả lời được coi là 1 business rule đã xác nhận và bắt buộc có ít nhất 1 test case riêng cho nó. |
| UC05-F12 | `GET /api/v1/documents/{document_id}/requirements/status` — endpoint POLL **nhẹ**, chỉ trả `{id, test_case_status, test_case_error}` cho từng requirement để frontend hỏi trạng thái mỗi vài giây mà không kéo lại toàn bộ nội dung requirement. |

**Test Case Status State Machine:**
```
ai_generated → [User Review] → approved
                             → rejected
(any status) → [Export]      → exported
```

**Test Case Execution Status:**
```
Untested → Pass
         → Fail
         → Blocked
```

---

### 4.6 UC06 — Test Case Studio (Quản lý hàng loạt)

**Actors:** User

| ID | Yêu cầu |
|----|---------|
| UC06-F01 | `GET /api/v1/test-cases` trả về danh sách test cases với filter: `project_id`, `document_id`, `priority`, `status`, `test_type`. |
| UC06-F02 | `PUT /api/v1/test-cases/{id}` cập nhật bất kỳ trường nào của test case (partial update). Tự động tăng `version` và cập nhật `updated_at`. |
| UC06-F03 | `POST /api/v1/test-cases` tạo test case thủ công từ requirement có sẵn. |
| UC06-F04 | `GET /api/v1/test-cases/export?project_id=...` xuất Excel 10 cột: `Feature | Test Case ID | Title | Precondition | Test Steps | Test Data | Expected Output | Priority | Note | Test Type`. |
| UC06-F05 | Test Case ID trong Excel được format: `TC-01`, `TC-02`, ... (padded). |
| UC06-F06 | Feature name lấy theo thứ tự ưu tiên: `requirement.feature_name` → `requirement.module_name` → `requirement.title` → `"Unknown Feature"`. |
| UC06-F07 | Bộ lọc động: Status (ai_generated/approved/rejected/exported), Priority (High/Medium/Low), Test Type (Positive/Negative/Boundary/...). |
| UC06-F08 | Bulk edit hàng loạt: lưu nhiều test case song song (multi-save). |

---

### 4.7 UC07 — AI Chat Workspace

**Actors:** User, Chat Agent

| ID | Yêu cầu |
|----|---------|
| UC07-F01 | `POST /api/chat/message` xử lý tin nhắn chat. Hỗ trợ `stream: true` (SSE) và `stream: false` (JSON). |
| UC07-F02 | Streaming response format: `data: {"chunk": "..."}\n\n` → kết thúc bằng `data: [DONE]\n\n`. |
| UC07-F03 | Tin nhắn được phân loại intent trước (regex fast-path, fallback LLM classify nếu không chắc — xem 3.2) để quyết định dùng ReAct Agent (có tool) hay Fast Path (RAG + LLM 1 lần, không tool). |
| UC07-F04 | ReAct Agent có 5 tool: `search_documents_tool` (RAG semantic search), `update_requirement_tool`, `extract_requirement_tool`, `list_requirements_tool`, `generate_test_case_tool`. Nếu người dùng yêu cầu tạo Test Case nhưng tài liệu chưa có Requirement, agent tự gọi `extract_requirement_tool` trước rồi mới tiếp tục, không dừng lại hỏi người dùng. |
| UC07-F05 | RAG Isolation: semantic search được cô lập theo `document_id`/`project_id` để tránh trộn dữ liệu giữa các document/project khác nhau. |
| UC07-F06 | Quick Actions trên UI: Phân tích tổng quan, Tạo Requirement, Tạo Test Case. |
| UC07-F07 | Chat history được lưu trên `localStorage` theo `projectId`. |
| UC07-F08 | Credit trừ theo nhánh xử lý thực tế: **10 Credits** (COPILOT_CHAT) cho `general_chat`/`small_talk`; khi đi nhánh `execute_tool`, credit trừ theo TOOL thực sự chạy (**17** cho `extract_requirement_tool`, **50** cho `generate_test_case_tool`), không phải mức COPILOT_CHAT cố định. |
| UC07-F09 | `GET /api/chat/history` và `DELETE /api/chat/history` (theo project) quản lý lịch sử hội thoại lưu ở backend. |

---

### 4.8 UC08 — Auto Bug Report

**Actors:** User, AI Agent

| ID | Yêu cầu |
|----|---------|
| UC08-F01 | `POST /api/v1/test-cases/{id}/bug-report` nhận `actual_result: str`. |
| UC08-F02 | Agent lấy `title`, `preconditions`, `test_steps`, `expected_result` của test case → kết hợp với `actual_result` → sinh Bug Report có cấu trúc. |
| UC08-F03 | Trả về `{"report": "<markdown_content>"}`. |

---

### 4.9 UC09 — Credit & Usage Management

**Actors:** User

| ID | Yêu cầu |
|----|---------|
| UC09-F01 | `GET /api/usage/summary` trả về: `credit_balance`, `current_plan` (đọc từ `users.plan`), `total_credits_used`, danh sách các gói (Free/Lite/Pro) từ `PLAN_DEFINITIONS`. |
| UC09-F02 | `GET /api/usage/logs?limit=50&offset=0` trả về lịch sử trừ credit theo tác vụ. |
| UC09-F03 | Mỗi lần trừ credit: ghi `UsageLog` với `operation`, `target_name`, `credits_used`. |

**Bảng giá Credit** (nguồn: `CREDIT_COST` trong `credit_service.py`):

| Tác vụ | Credits |
|--------|---------|
| DOCUMENT_INGESTION | 2 |
| COPILOT_CHAT | 10 |
| REQUIREMENT_EXTRACTION | 17 |
| TEST_CASE_GENERATION | 50 |

---

### 4.10 UC10 — In-app Feedback

**Actors:** User

| ID | Yêu cầu |
|----|---------|
| UC10-F01 | `POST /api/feedback` (yêu cầu auth) nhận `{type, message}`. `type` ∈ `{bug, feature_request, other}` (giá trị lạ → `other`); `message` rỗng → HTTP 400. |
| UC10-F02 | Feedback lưu vào bảng `feedback` với `status = "new"`, gắn `user_id` người gửi. Không trừ credit. |

### 4.11 UC11 — Admin Dashboard

**Actors:** Admin (mọi endpoint dùng dependency `require_admin`)

| ID | Yêu cầu |
|----|---------|
| UC11-F01 | `GET /api/admin/stats` — thống kê tổng hệ thống (số user, project, document, requirement, test case, credit đã dùng...). |
| UC11-F02 | `GET /api/admin/users` — danh sách user kèm role, plan, credit_balance. |
| UC11-F03 | `PATCH /api/admin/users/{user_id}/credits` — điều chỉnh `credit_balance` của một user. |
| UC11-F04 | `PATCH /api/admin/users/{user_id}/plan` — đổi `plan` (`free`/`lite`/`pro`) của một user. |
| UC11-F05 | `GET /api/admin/feedback` — danh sách feedback; `PATCH /api/admin/feedback/{feedback_id}/status` — đổi trạng thái (`new` → `reviewed`). |

---

## 5. Data Schema (thực tế triển khai)

### 5.1 Bảng `users`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | Map 1-1 với Supabase auth.users |
| email | Text (unique) | |
| role | Text | Default: `"user"` (`user` / `admin`) |
| plan | Text | Default: `"free"` (`free` / `lite` / `pro`) — độc lập với credit_balance |
| credit_balance | Integer | Default: 200 (admin: 3500) |
| documents_uploaded_total | Integer | Default: 0 — bộ đếm cộng dồn để kiểm quota (không giảm khi xóa) |
| created_at | Timestamp | |
| updated_at | Timestamp | Nullable |

### 5.2 Bảng `projects`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| user_id | UUID | FK → users.id (CASCADE) |
| name | Text | Required |
| description | Text | Nullable |
| created_at | Timestamp | |
| updated_at | Timestamp | Nullable |

### 5.3 Bảng `documents`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| project_id | UUID | FK → projects.id (CASCADE), nullable |
| original_filename | Text | Tên file gốc |
| stored_filename | Text | Tên file lưu trữ |
| file_type | Text | `pdf`, `docx`, `txt`, ... |
| file_size | BigInteger | bytes |
| file_path | Text | Đường dẫn trên server |
| extracted_text | Text | Nullable |
| error_message | Text | Nullable |
| status | Text | Trạng thái extract text: `uploaded` → `completed` / `failed` |
| requirement_status | Text | Trạng thái sinh Requirement chạy nền: `null` / `generating` / `failed` |
| requirement_error | Text | Nullable — lý do lỗi khi `requirement_status = failed` |
| uploaded_at | Timestamp | |
| updated_at | Timestamp | Nullable |

### 5.4 Bảng `document_chunks`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| document_id | UUID | FK → documents.id (CASCADE) |
| project_id | UUID | Denormalized để tránh JOIN khi RAG |
| chunk_index | Integer | Thứ tự chunk |
| content | Text | Nội dung chunk |
| token_count | Integer | Nullable |
| embedding | Vector(1536) | Model OpenAI-compatible cấu hình qua `.env`, ép về 1536 dims |
| created_at | Timestamp | |

**Index:** HNSW trên `embedding` (cosine ops), B-Tree trên `project_id`.

### 5.5 Bảng `requirements`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| project_id | UUID | FK → projects.id (SET NULL) |
| document_id | UUID | FK → documents.id |
| title | Text | |
| description | Text | |
| functional_requirement | Text | Nullable |
| validation_rule | JSON | list[str] |
| permission | JSON | list[str] |
| workflow | JSON | list[str] |
| state | JSON | list[str] |
| error_handling | JSON | list[str] |
| module_name | Text | Nullable |
| feature_name | Text | Nullable |
| actor | Text | Nullable |
| goal | Text | Nullable — mục tiêu nghiệp vụ của Actor |
| trigger | Text | Nullable — sự kiện/điều kiện kích hoạt use case |
| business_rules | JSON | list[str] |
| inputs | JSON | list[str] |
| outputs | JSON | list[str] |
| preconditions | JSON | list[str] |
| validation_rules | JSON | list[str] |
| exception_flows | JSON | list[str] |
| source_reference | Text | Nullable |
| components | JSON | Danh sách `{name, data_type, direction, initial_value, description}` |
| error_messages | JSON | Danh sách `{type, situation, message, notes}` |
| confidence_score | Float | 0.0–1.0 |
| status | Text | `ai_generated` / `approved` / `rejected` |
| version | Integer | Default: 1 |
| created_by | UUID | Nullable |
| clarifying_questions | JSON | list[str] — AI đặt câu hỏi |
| user_answers | JSON | list[str] — BA/QA trả lời |
| user_context | Text | Nullable — góp ý/ngữ cảnh tự do do BA/QA xác nhận, tối đa 4.000 ký tự ở API |
| test_case_status | Text | Trạng thái sinh test case chạy nền: `null` / `generating` / `failed` |
| test_case_error | Text | Nullable — lý do lỗi khi `test_case_status = failed` |
| created_at | Timestamp | |
| updated_at | Timestamp | Nullable |

**Index:** B-Tree trên `document_id` (`ix_requirements_document_id`) và `project_id` — tăng tốc truy vấn theo document/project (đặc biệt trên đường polling trạng thái).

### 5.6 Bảng `test_cases`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| requirement_id | UUID | FK → requirements.id |
| document_id | UUID | FK → documents.id, nullable |
| title | Text | Required |
| scenario | Text | Nullable |
| preconditions | Text | Nullable |
| test_steps | JSON | list[str] |
| test_data | Text | Nullable |
| expected_result | Text | Required |
| actual_result | Text | Nullable |
| priority | Text | `High` / `Medium` / `Low` |
| severity | Text | `Critical` / `Major` / `Minor` / `Trivial` |
| test_type | Text | `Positive` / `Negative` / `Boundary` / `Validation` / `Integration` / `Other` (black-box only — không có `Security`) |
| automation_candidate | Boolean | Default: false |
| execution_type | Text | `Manual` / `Automation Candidate` |
| execution_status | Text | `Untested` / `Pass` / `Fail` / `Blocked` |
| status | Text | `ai_generated` / `approved` / `rejected` / `exported` |
| note | Text | Nullable |
| version | Integer | Default: 1 — tăng mỗi lần re-generate (giữ nhiều "phiên bản" test case) |
| created_at | Timestamp | |
| updated_at | Timestamp | Nullable |

**Index:** B-Tree trên `requirement_id` (`ix_test_cases_requirement_id`) — tăng tốc truy vấn/poll test case theo requirement.

### 5.7 Bảng `agent_logs`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| task_type | Text | `extract_requirements` / `generate_test_cases` |
| provider | Text | `openai_compatible` |
| model | Text | Tên model từ env |
| status | Text | `success` / `failed` |
| input_reference_id | UUID | document_id hoặc requirement_id |
| input_type | Text | `document` / `requirement` |
| prompt_preview | Text | Nullable |
| raw_output | Text | Nullable |
| error_message | Text | Nullable |
| execution_time_ms | Integer | Thời gian thực thi (ms) |
| created_at | Timestamp | |

### 5.8 Bảng `usage_logs`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| user_id | UUID | FK → users.id (CASCADE) |
| operation | Text | `DOCUMENT_INGESTION` / `REQUIREMENT_EXTRACTION` / `TEST_CASE_GENERATION` / `COPILOT_CHAT` |
| target_name | Text | Tên tài liệu / project liên quan |
| credits_used | Integer | Số credit đã trừ |
| created_at | Timestamp | |

### 5.9 Bảng `feedback`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID | PK |
| user_id | UUID | FK → users.id (CASCADE) |
| type | Text | `bug` / `feature_request` / `other` (default `other`) |
| message | Text | Nội dung góp ý / báo lỗi |
| status | Text | `new` → `reviewed` |
| created_at | Timestamp | |

---

## 6. AI Output Schema (Pydantic Validation)

### 6.1 Requirement Extraction — `AIRequirementOutput`

Đây là schema LLM thực sự trả về (qua Structured Output hoặc JSON fallback) — tên field
**khác với** tên cột DB ở một số chỗ (`module`→`module_name`, `feature`→`feature_name`,
`business_rule`→`business_rules`, `input_data`→`inputs`, `output_data`→`outputs`,
`exception_flow`→`exception_flows`); việc map tên diễn ra ở `requirement_generation_service.py`
khi lưu DB (xem bảng `requirements` ở mục 5.5).

```json
{
  "requirements": [
    {
      "title": "string (required)",
      "description": "string (required)",
      "functional_requirement": "string | null",
      "module": "string | null",
      "feature": "string | null",
      "actor": "string | null",
      "goal": "string | null",
      "trigger": "string | null",
      "business_rule": ["string"],
      "input_data": ["string"],
      "output_data": ["string"],
      "preconditions": ["string"],
      "validation_rule": ["string"],
      "exception_flow": ["string"],
      "workflow": ["string"],
      "error_handling": ["string"],
      "permission": ["string"],
      "state": ["string"],
      "clarifying_questions": ["string"],
      "source_reference": "string | null",
      "components": [
        {
          "name": "string",
          "data_type": "string | null",
          "direction": "input | output | input_output",
          "initial_value": "string | null",
          "description": "string | null"
        }
      ],
      "error_messages": [
        {
          "type": "string | null",
          "situation": "string",
          "message": "string | null",
          "notes": "string | null"
        }
      ]
    }
  ]
}
```

**Validation rules:**
- `title` và `description` là bắt buộc.
- Mỗi use case hoặc feature độc lập tạo một Requirement; một flow liên tục không bị tách vụn chỉ vì có heading con.
- Trường không có bằng chứng trong nguồn phải là `null` hoặc `[]`; AI tạo câu hỏi làm rõ đúng field/tình huống còn thiếu thay vì tự bịa giá trị.
- `source_reference` phải trỏ đến marker `[SOURCE SECTION: ...]` tương ứng để hậu kiểm coverage.
- `status` KHÔNG nằm trong output của LLM — cột `requirements.status` trong DB luôn được backend set cứng `"ai_generated"` khi lưu, LLM không tự quyết định giá trị này.

### 6.2 Test Case Generation — `AITestCaseOutput`

```json
{
  "test_cases": [
    {
      "title": "string (required)",
      "scenario": "string | null",
      "preconditions": "string | null",
      "test_steps": ["step 1", "step 2"],
      "test_data": "string | null",
      "expected_result": "string (required)",
      "priority": "High | Medium | Low",
      "severity": "Critical | Major | Minor | Trivial | null",
      "test_type": "Positive | Negative | Boundary | Validation | Integration | Other | null",
      "automation_candidate": false,
      "execution_type": "Manual | Automation Candidate"
    }
  ]
}
```

**Validation rules:**
- `title` và `expected_result` là bắt buộc; nếu thiếu → item bị loại.
- `test_steps` tự động làm sạch: loại bỏ prefix `"Bước 1:"`, `"Step 1:"`, `"1."`, `"1)"`, dấu `-` đầu dòng.
- `priority` normalize: capitalize, fallback về `"Medium"` nếu không hợp lệ.
- `severity` normalize: capitalize, trả về `null` nếu không hợp lệ.
- `test_type` normalize: thử exact match → capitalize → fallback về `"Other"`. Không có giá trị `Security` — phạm vi chỉ black-box chức năng (xem 1.3 và UC05-F06).
- `execution_type` normalize: fallback về `"Manual"`.
- `automation_candidate` và `execution_type` phải nhất quán: `true` ↔ `"Automation Candidate"`, `false` ↔ `"Manual"`.

---

## 7. API Contract

### 7.1 Auth APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/auth/register` | ❌ | Đăng ký tài khoản mới |
| POST | `/api/auth/login` | ❌ | Đăng nhập, nhận JWT |
| POST | `/api/auth/refresh` | ❌ | Đổi refresh_token lấy access_token mới |
| GET | `/api/auth/me` | ✅ | Lấy thông tin user hiện tại (kèm `plan`) |

### 7.2 Project APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/projects` | ✅ | Danh sách projects + stats |
| POST | `/api/v1/projects` | ✅ | Tạo project mới |
| GET | `/api/v1/projects/{id}` | ✅ | Chi tiết project |
| PUT | `/api/v1/projects/{id}` | ✅ | Cập nhật project |
| DELETE | `/api/v1/projects/{id}` | ✅ | Xóa cascade project |

### 7.3 Document APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/documents/upload` | 🔶 Optional | Upload file(s) vào project |
| GET | `/api/documents` | ❌ | Danh sách documents (filter by project_id) |
| GET | `/api/v1/documents/{id}` | ❌ | Chi tiết + preview document |
| POST | `/api/documents/{id}/extract-text` | ❌ | Manual trigger text extraction |
| DELETE | `/api/documents` | ❌ | Xóa toàn bộ upload history |
| DELETE | `/api/documents/selected` | ❌ | Xóa các document được chọn |

> 🔶 Auth optional: nếu có token → kiểm tra quota + trừ credit; nếu không có → cho phép upload tự do (dev mode).

### 7.4 Requirement APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/v1/documents/{id}/requirements/generate` | ❌ | Generate requirements (async, trả 202) |
| GET | `/api/v1/documents/{id}/requirements` | ❌ | Danh sách requirements (đầy đủ) |
| GET | `/api/v1/documents/{id}/requirements/status` | ❌ | POLL nhẹ: chỉ trạng thái sinh test case |
| GET | `/api/v1/projects/{id}/requirements` | ✅ | Bulk: requirements của mọi document trong project |
| PATCH | `/api/v1/requirements/{id}/answers` | ❌ | Cập nhật `answers` và/hoặc `user_context` (tối đa 4.000 ký tự); payload answers-only cũ vẫn hợp lệ |

Payload tương thích với client cũ:

```json
{
  "answers": ["Chỉ áp dụng cho người dùng đã xác thực"]
}
```

Payload có thêm ngữ cảnh do BA/QA xác nhận:

```json
{
  "answers": ["Chỉ áp dụng cho người dùng đã xác thực"],
  "user_context": "Phạm vi mobile.\nGiữ nguyên thông báo Unicode trong tài liệu."
}
```

Response trả lại Requirement đầy đủ, bao gồm các trường mới `goal`, `trigger`, `components`,
`error_messages`, `user_answers` và `user_context`. Có thể gửi riêng một trong hai field; gửi
`null` một cách tường minh sẽ xóa giá trị field tương ứng, còn field không xuất hiện thì giữ nguyên.

### 7.5 Test Case APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/v1/requirements/{id}/test-cases/generate` | ❌ | Generate test cases (async, trả 202; guard 409 nếu đang chạy) |
| GET | `/api/v1/requirements/{id}/test-cases` | ❌ | Danh sách test cases của requirement |
| GET | `/api/v1/test-cases` | ❌ | Danh sách (filter: project, doc, priority, status, type) |
| GET | `/api/v1/test-cases/export` | ❌ | Export Excel (.xlsx) |
| POST | `/api/v1/test-cases` | ❌ | Tạo test case thủ công |
| PUT | `/api/v1/test-cases/{id}` | ❌ | Cập nhật test case |
| POST | `/api/v1/test-cases/{id}/bug-report` | ❌ | Generate Bug Report tự động |

### 7.6 Chat & Agent APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/chat/message` | 🔶 Optional | AI Chat — `stream: true` (SSE, dùng thật bởi frontend) hoặc `stream: false` (JSON, dùng cho test/Swagger). Tự động routing sang ReAct Agent hoặc Fast Path RAG tuỳ intent (xem 3.2). |
| GET | `/api/chat/history` | ✅ | Lấy lịch sử hội thoại theo project |
| DELETE | `/api/chat/history` | ✅ | Xóa lịch sử hội thoại theo project |

### 7.7 Usage APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/api/usage/summary` | ✅ | Tổng quan credit, gói dịch vụ |
| GET | `/api/usage/logs` | ✅ | Lịch sử sử dụng credit |

### 7.8 AI Provider APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/ai/health` | ❌ | Kiểm tra kết nối tới AI provider (OpenAI-compatible) |
| POST | `/api/v1/ai/test` | ❌ | Gọi thử LLM để kiểm tra cấu hình |

### 7.9 Feedback APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/api/feedback` | ✅ | Gửi feedback (bug / feature_request / other) |

### 7.10 Admin APIs (yêu cầu role `admin`)

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/api/admin/stats` | 🔐 Admin | Thống kê tổng hệ thống |
| GET | `/api/admin/users` | 🔐 Admin | Danh sách user (role, plan, credit) |
| PATCH | `/api/admin/users/{id}/credits` | 🔐 Admin | Điều chỉnh credit_balance |
| PATCH | `/api/admin/users/{id}/plan` | 🔐 Admin | Đổi plan (free/lite/pro) |
| GET | `/api/admin/feedback` | 🔐 Admin | Danh sách feedback |
| PATCH | `/api/admin/feedback/{id}/status` | 🔐 Admin | Đổi trạng thái feedback (new → reviewed) |

---

## 8. Non-Functional Requirements

### 8.1 Hiệu năng

| Chỉ số | Mục tiêu |
|--------|---------|
| API response time (non-AI) | < 500ms |
| RAG vector search (HNSW) | < 200ms cho top-12 với 100K chunks |
| AI generation latency (Requirement) | < 30s |
| AI generation latency (Test Case) | < 20s |
| Export Excel | < 3s cho 500 test cases |
| Streaming first-token latency | < 2s |

### 8.2 Bảo mật

| Yêu cầu | Chi tiết |
|---------|---------|
| Authentication | JWT từ Supabase Auth; token validate bằng public key |
| Authorization | Resource isolation: `project.user_id == current_user.id`; 404 thay vì 403 |
| Data isolation | RAG chunks được lọc theo `project_id` trước khi vector search |
| File upload security | Whitelist extension, giới hạn 10MB; filename được sanitize |

### 8.3 Khả năng mở rộng

- **Horizontal scaling**: Backend FastAPI stateless → có thể scale out.
- **DB**: PostgreSQL + pgvector (Supabase) → hỗ trợ connection pooling.
- **AI Provider**: Cấu hình qua `.env` (`OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL`, `OPENAI_COMPATIBLE_API_KEY`) → dễ dàng swap model/provider.

### 8.4 Độ tin cậy

- Nếu DB chưa kết nối được → Backend vẫn khởi động, log warning, trả về 503 cho các API cần DB.
- Text extraction thất bại → ghi `error_message`, document chuyển `failed`; không block toàn bộ upload.
- AI call thất bại → ghi `AgentLog` với status `failed` + `error_message`; trả về HTTP 502 cho client.
- Credit check thực hiện trước khi gọi AI → tránh chi phí khi user hết credit.
- AI Chat streaming (SSE): nếu provider lỗi giữa chừng (hết quota/rate limit/timeout/mất kết nối), stream bắt exception, gửi 1 message lỗi dễ hiểu cho người dùng rồi kết thúc gọn (`data: [DONE]`) — không để crash toàn bộ kết nối ASGI.
- Structured Output (function-calling) khi sinh Requirement/Test Case: nếu model/proxy không hỗ trợ, tự động fallback về parse JSON thủ công thay vì lỗi cứng.

### 8.5 Triển khai

- **Docker Compose**: Frontend (port 1302) + Backend (port 1303).
- **Frontend**: React 18 + TypeScript + Vite → build static files, serve bởi Nginx trong container.
- **Backend**: FastAPI + Uvicorn trong Python 3.12 container.
- Cấu hình toàn bộ qua `backend/.env` (không hardcode secrets).

---

## 9. Tech Stack chi tiết

### 9.1 Backend

| Thành phần | Công nghệ |
|-----------|----------|
| Framework | FastAPI (Python 3.12) |
| ORM | SQLAlchemy |
| Database | PostgreSQL + pgvector extension (Supabase) |
| Auth | Supabase Auth (JWT) + python-jose |
| AI Framework | LangChain + LangGraph (workflow orchestration) |
| LLM Provider | Chỉ OpenAI-compatible API (cấu hình model qua `.env`, vd Gemini/GPT qua proxy tương thích chuẩn OpenAI) — đã bỏ hỗ trợ Ollama local |
| Embedding | Model OpenAI-compatible cấu hình qua `.env` `OPENAI_COMPATIBLE_EMBEDDING_MODEL` (mặc định `text-embedding-3-small`), ép về 1536 dims qua tham số `dimensions` để khớp cột `Vector(1536)` trong DB |
| Vector Index | HNSW via pgvector |
| Text Extraction | pdfplumber, python-docx, openpyxl |
| Export | openpyxl |
| Chunking | langchain-text-splitters — MarkdownHeaderTextSplitter theo Heading (Word Heading style, đoạn bôi đậm dạng "Label:", hoặc từ khoá section phổ biến như Input/Output/Acceptance Criteria cho DOCX; suy luận heading theo cỡ chữ cho PDF), fallback RecursiveCharacterTextSplitter khi tài liệu không có cấu trúc heading nào |

### 9.2 Frontend

| Thành phần | Công nghệ |
|-----------|----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Data Fetching | TanStack React Query v5 (caching, background refetch) |
| Styling | Vanilla CSS + CSS Variables (Design System Warm Beige) |
| Icons | lucide-react |
| Markdown | react-markdown + remark-gfm + rehype-raw |
| Routing | Custom URL routing (pathToView / viewToPath) |
| State | React Context (Auth) + React Query (server state) |

### 9.3 Frontend Pages/Views

| Route | View | Mô tả |
|-------|------|-------|
| `/` | LandingPage | Trang giới thiệu sản phẩm (public, chưa đăng nhập) |
| `/login` | LoginScreen | Đăng nhập / Đăng ký |
| `/overview` | OverviewDashboard / ProjectsGrid | Trang mặc định sau đăng nhập — danh sách project dạng grid |
| `/projects` | ProjectManager | Quản lý project |
| `/projects/{id}` | ProjectDetailDashboard | Chi tiết project: Documents, Requirements, Chat |
| `/test-cases` | TesterStudio | Studio quản lý & bulk-edit test case toàn project (kèm Bug Report) |
| `/usage` | UsageBilling | Credit & gói dịch vụ |
| `/tutorial` | TutorialsView / OnboardingTour | Hướng dẫn sử dụng + tour onboarding |
| `/settings` | SettingsPage | Cài đặt tài khoản |
| `/admin`, `/admin/feedback` | AdminDashboard | Admin: thống kê, quản lý user/credit/plan, feedback (chỉ role `admin`; non-admin bị đưa về `/overview`) |

---

## 10. Acceptance Criteria (MVP)

### Authentication
- [x] User đăng ký được, nhận JWT token.
- [x] User đăng nhập được, nhận access_token + refresh_token.
- [x] API yêu cầu auth từ chối request không có token hợp lệ (HTTP 401).

### Project Management
- [x] User tạo, xem, sửa, xóa project.
- [x] Xóa project cascade xóa toàn bộ documents, chunks, requirements, test cases.
- [x] Không lộ project của user khác (trả 404, không 403).

### Document Upload
- [x] Upload thành công file: pdf, docx, txt, md, xlsx, csv, dbml, zip.
- [x] File > 10MB bị từ chối (HTTP 400).
- [x] File sai định dạng bị từ chối (HTTP 400).
- [x] Quota Free Plan (5 docs) được kiểm tra và reject khi vượt (HTTP 403).
- [x] 2 Credits bị trừ mỗi lần upload.
- [x] Document có status rõ ràng: uploaded → completed/failed.
- [x] Chỉ document `completed` mới cho phép generate requirements.

### AI Requirement Extraction
- [x] Generate requirements từ document completed.
- [x] Pipeline chia `extracted_text` theo section, bao phủ tất cả section nghiệp vụ và chạy lượt bổ sung cho section còn thiếu.
- [x] Requirements có đủ fields theo schema.
- [x] AI schema validation bằng Pydantic trước khi lưu DB.
- [x] clarifying_questions lưu vào requirement khi AI cần làm rõ.
- [x] User submit answers qua PATCH /requirements/{id}/answers.
- [x] User lưu góp ý tự do `user_context`; nội dung được gắn nhãn riêng trong prompt sinh Test Case.
- [x] AgentLog ghi mỗi lần AI chạy.
- [x] 17 Credits bị trừ mỗi lần generate requirement (chỉ khi job nền thành công).

### AI Test Case Generation
- [x] Generate test cases từ requirement không bị rejected.
- [x] Test case thiếu title hoặc expected_result bị loại.
- [x] Test cases liên kết requirement_id, có đủ fields.
- [x] 50 Credits bị trừ mỗi lần generate (chỉ khi job nền thành công).
- [x] Re-generate không xóa bộ cũ — tăng `version`; guard 409 chặn 2 job song song cùng requirement.
- [x] test_steps được normalize (xóa prefix số/chữ thừa).

### Test Case Studio & Export
- [x] Xem, lọc test cases theo project/document/priority/status/type.
- [x] Bulk edit: cập nhật nhiều test case, tăng version.
- [x] Export Excel 10 cột, format TC-01, TC-02...
- [x] Bug Report tự động từ actual_result.

### AI Chat
- [x] Chat streaming SSE hoạt động, kết thúc gọn kèm thông báo lỗi rõ ràng nếu provider lỗi giữa chừng.
- [x] RAG isolation theo document_id/project_id.
- [x] Intent routing chính xác cho câu tự nhiên (kể cả khi động từ và danh từ bị chen từ ở giữa).
- [x] Credit trừ đúng theo tool/nhánh xử lý thực tế (10/17/50 Credits tuỳ thao tác), không phải mức cố định.

---

## 11. Rủi ro và Khuyến nghị

| Rủi ro | Mức độ | Khuyến nghị |
|--------|--------|------------|
| LLM trả về JSON không hợp lệ | Trung bình (đã giảm) | Ưu tiên Structured Output (function-calling) để Pydantic validate ngay trong quá trình gọi, giảm mạnh rủi ro so với chỉ parse JSON từ text; fallback JSON-parse vẫn còn cho model không hỗ trợ function-calling. Nên thêm retry logic tối đa 2 lần cho cả 2 đường. |
| OpenAI-compatible proxy unstable | Trung bình | Log AgentLog đầy đủ; hiển thị error rõ ràng cho user (đã có cho chat streaming — xem 8.4) |
| Credit hết giữa session | Trung bình | Check credit trước mọi AI call; hiển thị credit balance dạng progress bar trong Sidebar và Overview Dashboard |
| RAG chunks chưa được embed | Trung bình | Fallback về extracted_text đã implement |
| File size > 10MB cần xử lý | Thấp | Tăng limit hoặc implement streaming upload nếu cần |
| Supabase Auth quota | Thấp | Monitor Supabase dashboard; cân nhắc self-hosted Auth nếu scale |

---

## 12. Kết luận

Hệ thống TCGA MVP đã triển khai đầy đủ pipeline cốt lõi:

**Document Upload → Text Extraction → Vector Embedding → RAG Retrieval → AI Requirement Extraction → Human Review → AI Test Case Generation → Test Case Studio → Export Excel**

Các điểm kỹ thuật quan trọng đã đảm bảo:
1. **State machine nghiêm ngặt**: document status, requirement status, test case status đều được kiểm soát.
2. **AI schema validation**: Pydantic validate 100% trước khi lưu DB.
3. **RAG isolation**: dữ liệu vector search cô lập theo project.
4. **Traceability đầy đủ**: Document → Requirement → TestCase → UsageLog + AgentLog.
5. **Credit governance**: mọi tác vụ AI đều trừ credit và ghi log.

**Bước tiếp theo được khuyến nghị:**
- Thêm retry logic cho AI calls (tối đa 2 lần) — Structured Output đã giảm rủi ro JSON lỗi nhưng chưa loại bỏ hoàn toàn.
- Thêm auth guard cho toàn bộ Document/Requirement/TestCase APIs (hiện tại nhiều endpoint không yêu cầu auth).
- Implement payment gateway cho gói Lite/Pro.
- Thêm unit test cho Pydantic schemas và service layer.
- Thêm pagination cho các list API.
