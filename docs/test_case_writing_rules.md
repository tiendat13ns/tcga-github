# Quy tắc đọc tài liệu & viết Test Case (rút ra từ bộ mẫu netAT)

Tài liệu này rút ra từ 2 nguồn mẫu do người viết cung cấp (`backend/uploads/`, đã xoá sau khi
phân tích vì là dữ liệu tạm):

- 5 tài liệu mô tả chức năng CRUD "Dự án" (Thêm mới, Cập nhật, Tìm kiếm/Danh sách, Xem chi tiết, Xóa).
- 1 bộ Test Suite Excel (`KBKTCN_netAT_TestSuites_Project`) — 1237 dòng, ~1000 test case cho 9
  chức năng của module "Project" (CRUD + Import/Export + 2 màn hình thống kê).

Mục đích: hệ thống hoá các quy luật để AI trong TCGA (`requirement_extraction_prompt.py`,
`test_case_generation_prompt.py`) đọc tài liệu và viết test case theo đúng phong cách/độ sâu mà
đội QA gốc đang áp dụng.

---

## 1. Cấu trúc tài liệu mô tả chức năng (input cho AI)

Mỗi chức năng trong tài liệu mẫu luôn theo đúng 5 mục, đánh số `3.1.N.x`:

1. **Thông tin chung chức năng**: mô tả ngắn + Actor + Mục tiêu + Điều kiện tiên quyết + Trigger.
2. **Màn hình**: ảnh chụp UI (không có nội dung text để trích xuất).
3. **Mô tả chi tiết các thành phần**: bảng liệt kê TỪNG control trên màn hình — cột **Tên, Kiểu
   dữ liệu (Textbox/Combobox/Selectbox/Textarea/Button/Dialog/Table/Pagination...), Input/Output,
   Giá trị khởi tạo, Mô tả** (mô tả luôn nêu: bắt buộc hay không, max length, hành vi trim, hành
   vi autofocus, nguồn dữ liệu dropdown, mapping field DB).
4. **Luồng nghiệp vụ**, tách làm 2:
   - *Luồng giao diện*: các bước người dùng thao tác trên UI, có nhánh rẽ đánh số kiểu `5A`, `7A`
     (luồng lỗi/luồng thay thế đi kèm bước chính `5`, `7`).
   - *Luồng xử lý nghiệp vụ*: các bước backend xử lý request, kèm **câu SQL Query cụ thể** cho
     mỗi bước truy vấn/ghi DB, và nhánh rẽ lỗi (`1A`, `2A`...) ứng với mã HTTP cụ thể.
5. **Thiết kế thông báo lỗi**: bảng **Mã lỗi | Loại (Validation/Business/System) | Tình huống |
   Thông báo hiển thị | Ghi chú** — đây là nguồn dữ liệu chính xác nhất cho `expected_result` của
   các test case Negative/Validation.

**Hệ quả cho AI trích xuất requirement**: đây chính là dữ liệu mà `inputs`, `outputs`,
`validation_rule`, `business_rules`, `error_handling`, `workflow` cần chứa — nhưng ở mức
**chi tiết từng field/từng mã lỗi**, không phải tóm tắt chung chung. Một field trong tài liệu
gốc (vd. "Project Name: Textbox, bắt buộc, max 100 ký tự, tự trim khoảng trắng, autofocus") phải
được giữ nguyên đủ 4 thuộc tính đó trong `inputs`, vì mỗi thuộc tính sẽ sinh ra một nhóm test case
riêng (xem mục 2).

---

## 2. "Bộ khung" test case theo từng loại field UI

Đây là quy luật lặp lại nhất quán cho **mọi** Textbox/Combobox/Selectbox/Textarea trong bộ mẫu —
mỗi field luôn được rà theo đúng trình tự sau (không thiếu bước nào, kể cả field không bắt buộc):

**A. Trạng thái giao diện (UI state)** — áp dụng mọi loại field:
- Giao diện mặc định (placeholder, màu, border, vị trí)
- Giao diện khi hover
- Giao diện khi click / focus (border đổi màu, shadow, con trỏ nhấp nháy)
- Giao diện khi báo lỗi (border đỏ, background đỏ nhạt, text lỗi dưới field, vị trí không đổi)
- Giá trị mặc định (rỗng, hoặc giá trị định sẵn — vd. Status mặc định "Active")

**B. Ràng buộc dữ liệu (validation)** — riêng cho Textbox/Textarea:
- Trường bắt buộc: để trống → thông báo lỗi đúng NGUYÊN VĂN từ bảng mã lỗi + focus vào field lỗi
- Ký tự đặc biệt (`%^&*()#@...`) — mặc định PHẢI cho phép nhập trừ khi tài liệu nói khác
- Chữ có dấu tiếng Việt — phải lưu/hiển thị đúng, không lỗi font
- Chữ không dấu (a-z, A-Z) — chỉ chữ thường, chỉ chữ hoa, và hỗn hợp hoa/thường (3 case riêng)
- Boundary độ dài: nhập **> max** (thông báo lỗi) và nhập **= max chính xác** (thành công, verify
  lưu đúng đủ ký tự vào DB) — đây là Boundary Value Analysis đúng chuẩn ISTQB, luôn đi theo cặp
- Trim khoảng trắng đầu/cuối khi rời field hoặc khi lưu vào DB (kiểm tra riêng, có câu SQL verify)
- Copy/paste bằng Ctrl+V phải hoạt động như gõ tay

**C. Hành vi field** — riêng cho combobox/select có tìm kiếm:
- Danh sách giá trị hiển thị đầy đủ (kèm câu SQL nguồn dữ liệu)
- Tìm kiếm: nhập giá trị hợp lệ → có kết quả; nhập giá trị không tồn tại → "No Data"
- Đổi lựa chọn nhiều lần (chọn A → sang field khác → quay lại → đổi sang B) phải giữ đúng trạng
  thái đã chọn
- Riêng textbox tìm kiếm trong bộ lọc: khoảng trắng thuần → coi như tìm tất cả; không giới hạn
  maxlength ở màn hình tìm kiếm (khác với màn hình nhập liệu)

**D. Textarea có thêm**: kéo giãn/thu nhỏ khung nhập, thanh cuộn khi nội dung vượt chiều cao.

**E. Field không bắt buộc** vẫn cần: case để trống vẫn submit thành công + case nhập giá trị hợp
lệ vẫn lưu đúng — không được bỏ qua field optional.

> Quy tắc rút gọn cho AI: khi tài liệu liệt kê một field kèm thuộc tính (bắt buộc, max length,
> kiểu control, hành vi trim/autofocus), hãy sinh đủ nhóm case tương ứng ở trên cho field đó thay
> vì chỉ 1 case "nhập dữ liệu hợp lệ" chung chung.

---

## 3. Quy luật UI chung cho mọi màn hình (không phụ thuộc field)

Áp dụng 1 lần cho mỗi Dialog/màn hình, không lặp theo field:
- Bố cục, chính tả, căn lề, font chữ đồng nhất; trường bắt buộc phải có dấu `*`
- Thứ tự di chuyển con trỏ khi nhấn Tab (trái→phải, trên→dưới) và Shift+Tab (ngược lại)
- Nhấn Enter khi focus vào nút Submit → thực hiện submit
- Zoom in/out trình duyệt (Ctrl +/-) → không vỡ layout
- Click ra ngoài Dialog → **không** tự đóng (test case ngầm định UI phải cản người dùng thao tác
  nhầm mất dữ liệu)
- Nút Cancel/icon X: đóng dialog, reset form, KHÔNG lưu gì vào DB (luôn có case verify bằng SQL)

---

## 4. Quy luật cho luồng nghiệp vụ chính (Create/Update/Delete)

**Luôn viết theo cặp đối xứng "thành công" / "không thành công", mỗi bên nhiều biến thể:**

Thành công — mỗi biến thể đều verify bằng toast message + đóng dialog + reset form + record mới
lên đầu danh sách + **câu SQL SELECT xác nhận trong DB**:
- Điền đủ toàn bộ field rồi Submit
- Điền đủ rồi nhấn Enter (không chỉ click Submit)
- Để trống field optional
- Chỉ điền field bắt buộc, còn lại để trống
- Trùng giá trị không-unique (vd. trùng Project Name nhưng khác Project Code) → vẫn thành công
  (khẳng định rõ field nào KHÔNG phải unique key)

Không thành công:
- Thiếu field bắt buộc → lỗi + KHÔNG lưu DB
- Trùng giá trị unique key (vd. Project Code) → thông báo lỗi đúng nguyên văn + KHÔNG lưu DB
- Đóng bằng Cancel/X sau khi đã nhập → KHÔNG lưu DB
- **Lỗi tích hợp hệ thống ngoài** (vd. GitLab fork API trả 500) → mock lỗi, verify: thông báo lỗi
  đúng mã lỗi trong bảng thiết kế lỗi, dialog KHÔNG đóng, KHÔNG có bản ghi DB, KHÔNG có tài
  nguyên ngoài (GitLab repo) bị tạo — tức là verify **rollback/transaction toàn vẹn**
- Mất kết nối mạng khi gọi API → ẩn loading, giữ nguyên dữ liệu đã nhập trên form (không mất)

**Kiểm tra lưu trữ DB (riêng 1 nhóm case)**: với MỖI cột trong bảng DB liên quan, viết 1 test case
verify giá trị lưu đúng bằng câu SQL cụ thể — bao gồm cả cột hệ thống (id tự tăng, FK resolve
đúng id, enum status đúng mã 0/1, timestamp đúng format, soft-delete field `deleted_at` NULL khi
tạo mới / có giá trị khi xoá).

---

## 5. Quy luật cho màn hình Tìm kiếm/Danh sách

- Mỗi bộ lọc (combobox/multi-select): case chọn 1 giá trị, case chọn nhiều giá trị, case không
  chọn gì (→ mặc định trạng thái Active/tất cả), case áp dụng lọc xuyên trang phân trang
- Case **kết hợp nhiều bộ lọc cùng lúc** (ít nhất vài tổ hợp 2 điều kiện)
- Mỗi case lọc đều kèm câu SQL WHERE/JOIN tương ứng để verify đúng tập kết quả
- Phân trang: tổng bản ghi, số trang, số dòng/trang (10/20/50)
- Đổi chế độ xem (Table View / Card View) hiển thị cùng dữ liệu
- Textbox tìm kiếm tự do: bỏ dấu tiếng Việt khi so khớp, escape ký tự đặc biệt, không giới hạn độ
  dài, trim khoảng trắng, hỗ trợ Ctrl+V

---

## 6. Quy luật cho màn hình Xem chi tiết

- **Mỗi field hiển thị = 1 test case riêng**, kèm câu SQL SELECT xác nhận giá trị đúng
- Với field có thể NULL: thêm 1 case riêng "khi field = NULL → hiển thị `—` / avatar `?`"
  (không được gộp chung với case hiển thị bình thường)
- Case cách ly dữ liệu: mở 2 bản ghi khác nhau, xác nhận KHÔNG bị lẫn dữ liệu giữa 2 bản ghi
- Case đồng bộ dữ liệu: xem lại ngay sau khi vừa tạo mới / vừa cập nhật → dữ liệu phải khớp
  chính xác, không hiển thị dữ liệu cũ
- Case refresh trình duyệt (F5) không mất/đổi dữ liệu đang xem
- Case hiển thị giá trị ở biên (field dài đúng max length, textarea nhiều dòng) → không vỡ layout,
  không bị cắt nội dung
- ID không hợp lệ trên URL (không phải số nguyên dương, số âm, số thập phân) → thông báo lỗi cụ
  thể; bản ghi đã bị xoá mềm hoặc không tồn tại → "Data was not found"

---

## 7. Về nhóm "An toàn thông tin" (Security) trong file mẫu

File mẫu có hẳn 1 nhóm riêng mỗi chức năng: SQL Injection (Insert/Select), XSS (kể cả payload mã
hoá Hexa, script lồng nhau), CSRF, path traversal khi upload, session fixation/hijacking, kiểm tra
xác thực/phân quyền, download không xác thực, user enumeration, thất thoát thông tin.

**Quyết định áp dụng cho TCGA**: theo yêu cầu của người dùng hệ thống, **giữ nguyên phạm vi hiện
tại** — `test_case_generation_prompt.py` tiếp tục KHÔNG sinh nhóm test case này (lý do: tester dùng
AI này chỉ có tài liệu, không có source code/quyền thực hiện kiểm thử xâm nhập). Nhóm này ghi nhận
lại ở đây để nếu sau này đổi quyết định thì đã có sẵn danh mục chi tiết cần thêm.

---

## 8. Định dạng & văn phong test case

- ID test case: `<Tên_chức_năng>_<số thứ tự toàn cục>` — KHÔNG dùng lại trong TCGA vì schema hiện
  tại sinh `title` dạng câu tự nhiên, không dùng mã ID (giữ nguyên theo thiết kế hiện tại).
  Số thứ tự chạy xuyên suốt toàn bộ chức năng, không reset theo từng nhóm con.
- `test_data`/ví dụ luôn là giá trị cụ thể thật (chuỗi mẫu, số ký tự đếm được), không viết chung
  chung kiểu "nhập dữ liệu hợp lệ" — điều này đã khớp với rule hiện có trong
  `test_case_generation_prompt.py`.
- `expected_result` luôn lấy **đúng nguyên văn** thông báo lỗi/thành công từ tài liệu (không diễn
  giải lại), và kèm câu SQL khi cần verify DB.
- Steps luôn đánh số 1, 2, 3 trong 1 field text (khác quy ước hiện tại của TCGA — TCGA yêu cầu
  `test_steps` là list, không đánh số thủ công; đây là khác biệt về CÔNG CỤ lưu trữ, không phải
  khác biệt về nội dung — giữ nguyên quy ước hiện tại của TCGA khi sinh).
- Precondition dùng chung cho cả 1 nhóm lớn (đăng nhập → vào menu → mở dialog) thay vì lặp lại
  từng dòng — TCGA nên áp dụng tương tự: nếu nhiều test case liền kề dùng chung 1 precondition,
  hãy viết ngắn gọn nhất quán thay vì diễn giải lại dài dòng mỗi lần.

---

## 9. Áp dụng vào TCGA — mapping cụ thể

| Quy luật rút ra | Đưa vào đâu trong code |
|---|---|
| Field-level detail (kiểu control, bắt buộc, max length, default, trim, autofocus) | `requirement_extraction_prompt.py` → field `inputs`/`outputs`, để `test_case_generation_prompt.py` có đủ dữ liệu sinh test case theo bộ khung mục 2 |
| Bảng mã lỗi + thông báo chính xác | `requirement_extraction_prompt.py` → field `error_handling` (giữ nguyên văn message) |
| Bộ khung UI-state + validation theo field | `test_case_generation_prompt.py` → checklist hệ thống theo field |
| UI chung (tab order, zoom, click-outside, Enter-to-submit) | `test_case_generation_prompt.py` → checklist 1 lần/màn hình |
| Cặp thành công/thất bại đối xứng + rollback/tích hợp ngoài | `test_case_generation_prompt.py` → rule bắt buộc |
| DB verification per column | `test_case_generation_prompt.py` → test_type mới hoặc gắn vào Validation/Positive kèm câu query nếu schema được cung cấp |
| Bộ lọc/phân trang/kết hợp filter | `test_case_generation_prompt.py` → checklist riêng khi requirement là màn hình danh sách |
| Security (XSS/SQLi/CSRF...) | KHÔNG áp dụng — giữ nguyên loại trừ theo quyết định người dùng (mục 7) |

Ghi chú độ sâu: bộ mẫu đạt ~190 test case cho 1 use case CRUD đơn giản. Sau khi cân nhắc, TCGA
**KHÔNG** đẩy AI sinh sâu tới mức đó — `test_case_generation_prompt.py` giữ nguyên phạm vi tập
trung, chỉ sinh các field chính (title/scenario/preconditions/test_steps/test_data/
expected_result/priority/severity/test_type/automation_candidate/execution_type). Độ chi tiết
"khủng" của file mẫu (UI-state hover/focus/click từng field, ma trận browser×lần chạy, mã lỗi,
câu SQL verify) mang tính theo dõi thực thi thủ công, không phải thứ AI nên tự sinh hàng loạt —
xem mục 10.

## 10. Tester Studio — nơi tester làm việc trực tiếp trên test case

Theo đúng tinh thần file mẫu, phần "ma trận Environment/Browser × Lần chạy" đã được xây dựng
thành tính năng RIÊNG trong Tester Studio (không phải AI sinh), nơi tester trực tiếp điền/sửa khi
thực thi test case thủ công:

- Bảng `test_executions` (model `TestExecution`) — mỗi bản ghi là 1 ô trong ma trận: gắn với 1
  `TestCase`, có `environment` (tên tự do tester đặt, VD "Desktop-Chrome"), `run_number` (lần chạy,
  tester tự thêm khi cần retest — không giới hạn cứng 3 lần), `result` (Untested/Pass/Fail/
  Blocked). Ô **CHỈ** chứa kết quả — đúng theo cấu trúc file mẫu (cột "Kết quả hiện tại", "Mã
  lỗi", "Ghi chú" chỉ xuất hiện 1 lần/dòng, KHÔNG lặp lại theo từng ô Lần 1/2/3), nên
  `actual_result` (đã có sẵn), `bug_reference` (mới thêm), `note` (đã có sẵn) nằm ở **cấp
  TestCase**, dùng chung cho mọi môi trường/lần chạy của test case đó.
- `execution_status` TỔNG trên `TestCase` được **suy ra tự động** từ các ô này (ưu tiên
  Fail > Blocked > Untested > Pass) mỗi khi một ô được tạo/sửa/xoá — xem
  `_recompute_execution_status` trong `routers/test_case_studio.py`. Test case nào chưa có ô nào
  trong ma trận thì vẫn dùng dropdown thủ công như trước (tương thích ngược).
- API: `GET/POST /api/v1/test-cases/{id}/executions`, `PUT/DELETE /api/v1/test-cases/executions/{execution_id}`
  (chỉ nhận `result`). `bug_reference`/`note` sửa qua `PUT /api/v1/test-cases/{id}` như các field
  khác của test case.
- UI: nút lưới cạnh cột Execution trong Tester Studio mở `ExecutionMatrixDrawer` — tester tự thêm
  environment mới, thêm lần chạy cho environment đã có, đổi kết quả từng ô, xoá ô. "Mã lỗi" sửa
  trong drawer Sửa Test Case (`TestCaseFormDrawer`); "Kết quả hiện tại" vẫn qua `BugReportDrawer`
  như trước.
