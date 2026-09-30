from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class AIRequirementComponent(BaseModel):
    name: str = Field(..., description="Tên trường, control, dữ liệu hoặc thành phần")
    data_type: Optional[str] = Field(None, description="Kiểu dữ liệu nếu nguồn có nêu")
    direction: Literal["input", "output", "input_output"] = Field(
        ...,
        description="Chiều dữ liệu: input, output hoặc input_output",
    )
    initial_value: Optional[str] = Field(None, description="Giá trị khởi tạo nếu nguồn có nêu")
    description: Optional[str] = Field(None, description="Ý nghĩa hoặc cách sử dụng thành phần")


class AIRequirementErrorMessage(BaseModel):
    type: Optional[str] = Field(None, description="Loại lỗi hoặc mức độ")
    situation: str = Field(..., description="Tình huống làm phát sinh lỗi")
    message: Optional[str] = Field(None, description="Thông báo hiển thị chính xác nếu nguồn có nêu")
    notes: Optional[str] = Field(None, description="Ghi chú xử lý hoặc khôi phục")


class AIRequirementItem(BaseModel):
    title: str = Field(..., description="Tiêu đề của Requirement")
    description: str = Field(..., description="Mô tả chi tiết Requirement")
    functional_requirement: Optional[str] = Field(None, description="Yêu cầu chức năng chi tiết")
    module: Optional[str] = Field(None, description="Tên module")
    feature: Optional[str] = Field(None, description="Tên tính năng")
    actor: Optional[str] = Field(None, description="Người dùng hoặc hệ thống thực hiện (Actor)")
    goal: Optional[str] = Field(None, description="Mục tiêu nghiệp vụ của Actor")
    trigger: Optional[str] = Field(None, description="Sự kiện kích hoạt use case")
    business_rule: Optional[List[str]] = Field(None, description="Các luật nghiệp vụ áp dụng")
    input_data: Optional[List[str]] = Field(None, description="Từng field/control input trên UI, MỖI field 1 phần tử: tên, loại control, bắt buộc/không, max length/định dạng, giá trị mặc định, hành vi (trim, autofocus, read-only...)")
    output_data: Optional[List[str]] = Field(None, description="Từng field/control hiển thị (output), MỖI field 1 phần tử: tên, vị trí hiển thị, mapping nguồn dữ liệu nếu có, cách hiển thị khi rỗng/null")
    preconditions: Optional[List[str]] = Field(None, description="Điều kiện tiên quyết")
    validation_rule: Optional[List[str]] = Field(None, description="Luật kiểm tra tính hợp lệ")
    exception_flow: Optional[List[str]] = Field(None, description="Luồng ngoại lệ / Lỗi")
    workflow: Optional[List[str]] = Field(None, description="Các bước thực hiện (Workflow)")
    error_handling: Optional[List[str]] = Field(None, description="Xử lý lỗi (Error handling) — nếu tài liệu có bảng mã lỗi/thông báo, giữ NGUYÊN VĂN thông báo lỗi gắn với tình huống kích hoạt")
    permission: Optional[List[str]] = Field(None, description="Quyền hạn / Phân quyền (Permissions)")
    state: Optional[List[str]] = Field(None, description="Trạng thái (State / Status)")
    clarifying_questions: Optional[List[str]] = Field(None, description="Các câu hỏi làm rõ requirement dành cho người dùng")
    source_reference: Optional[str] = Field(None, description="Trích dẫn nguồn gốc từ tài liệu")
    components: Optional[List[AIRequirementComponent]] = Field(None, description="Các thành phần input/output có cấu trúc")
    error_messages: Optional[List[AIRequirementErrorMessage]] = Field(None, description="Các thông báo lỗi có cấu trúc")

    @field_validator("clarifying_questions")
    @classmethod
    def deduplicate_clarifying_questions(cls, questions: Optional[List[str]]) -> Optional[List[str]]:
        """Keep model output stable when the same question is repeated verbatim."""
        if questions is None:
            return None
        unique: list[str] = []
        seen: set[str] = set()
        for question in questions:
            normalised = " ".join(question.split()).casefold()
            if not normalised or normalised in seen:
                continue
            seen.add(normalised)
            unique.append(question.strip())
        return unique

class AIRequirementOutput(BaseModel):
    requirements: List[AIRequirementItem] = Field(..., description="Danh sách các requirement được trích xuất")

class AITestCaseItem(BaseModel):
    title: str = Field(..., description="Tiêu đề của Test Case")
    scenario: Optional[str] = Field(None, description="Kịch bản Test (Scenario)")
    preconditions: Optional[str] = Field(None, description="Điều kiện tiên quyết để chạy Test Case")
    test_steps: List[str] = Field(..., description="Danh sách các bước thực hiện")
    test_data: Optional[str] = Field(None, description="Dữ liệu test (Test Data)")
    expected_result: str = Field(..., description="Kết quả mong đợi (Expected Result)")
    priority: str = Field("Medium", description="Độ ưu tiên: High, Medium, Low")
    severity: Optional[str] = Field(None, description="Mức độ nghiêm trọng: Critical, Major, Minor, Trivial")
    test_type: Optional[str] = Field(None, description="Loại Test (black-box only, không bao gồm security/performance/white-box): Positive, Negative, Boundary, Validation, Permission, State Transition, Integration, Other")
    automation_candidate: bool = Field(False, description="Có thể tự động hoá hay không (True/False)")
    execution_type: str = Field("Manual", description="Loại thực thi: Manual hoặc Automation Candidate")

class AITestCaseOutput(BaseModel):
    test_cases: List[AITestCaseItem] = Field(..., description="Danh sách các test case được sinh ra")
