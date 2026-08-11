from typing import List, Optional
from pydantic import BaseModel, Field

class AIRequirementItem(BaseModel):
    title: str = Field(..., description="Tiêu đề của Requirement")
    description: str = Field(..., description="Mô tả chi tiết Requirement")
    functional_requirement: Optional[str] = Field(None, description="Yêu cầu chức năng chi tiết")
    module: Optional[str] = Field(None, description="Tên module")
    feature: Optional[str] = Field(None, description="Tên tính năng")
    actor: Optional[str] = Field(None, description="Người dùng hoặc hệ thống thực hiện (Actor)")
    business_rule: Optional[List[str]] = Field(None, description="Các luật nghiệp vụ áp dụng")
    input_data: Optional[List[str]] = Field(None, description="Dữ liệu đầu vào")
    output_data: Optional[List[str]] = Field(None, description="Dữ liệu đầu ra")
    preconditions: Optional[List[str]] = Field(None, description="Điều kiện tiên quyết")
    validation_rule: Optional[List[str]] = Field(None, description="Luật kiểm tra tính hợp lệ")
    exception_flow: Optional[List[str]] = Field(None, description="Luồng ngoại lệ / Lỗi")
    workflow: Optional[List[str]] = Field(None, description="Các bước thực hiện (Workflow)")
    error_handling: Optional[List[str]] = Field(None, description="Xử lý lỗi (Error handling)")
    permission: Optional[List[str]] = Field(None, description="Quyền hạn / Phân quyền (Permissions)")
    state: Optional[List[str]] = Field(None, description="Trạng thái (State / Status)")
    clarifying_questions: Optional[List[str]] = Field(None, description="Các câu hỏi làm rõ requirement dành cho người dùng")
    source_reference: Optional[str] = Field(None, description="Trích dẫn nguồn gốc từ tài liệu")
    confidence_score: float = Field(..., description="Điểm tin cậy của AI từ 0.0 đến 1.0")

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
