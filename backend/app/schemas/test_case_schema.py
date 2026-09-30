from pydantic import BaseModel


class TestExecutionItem(BaseModel):
    """Một ô trong ma trận chạy thử Environment × Lần chạy — CHỈ chứa kết quả Pass/Fail/Blocked
    của lần chạy đó. actual_result/bug_reference/note nằm ở cấp TestCase (1 giá trị dùng chung
    cho cả dòng, đúng cấu trúc file mẫu) — xem models.TestExecution và models.TestCase."""
    id: str
    test_case_id: str
    environment: str
    run_number: int
    result: str
    executed_by: str | None = None
    executed_at: str | None = None


class TestExecutionListResponse(BaseModel):
    test_case_id: str
    executions: list[TestExecutionItem]


class TestExecutionCreatePayload(BaseModel):
    environment: str
    run_number: int | None = None  # None → tự gán = lần chạy kế tiếp cho environment đó (bắt đầu từ 1)


class TestExecutionUpdatePayload(BaseModel):
    result: str | None = None


class TestCaseResponse(BaseModel):
    id: str
    requirement_id: str
    document_id: str | None = None
    title: str
    scenario: str | None = None
    preconditions: str | None = None
    test_steps: list[str] | None = None
    test_data: str | None = None
    expected_result: str
    actual_result: str | None = None
    priority: str
    severity: str | None = None
    test_type: str | None = None
    automation_candidate: bool
    execution_type: str
    execution_status: str
    status: str
    note: str | None = None
    bug_reference: str | None = None
    version: int


class GenerateTestCasesResponse(BaseModel):
    requirement_id: str
    document_id: str | None = None
    total_test_cases: int
    test_cases: list[TestCaseResponse]


class ListTestCasesResponse(BaseModel):
    requirement_id: str
    total_test_cases: int
    test_cases: list[TestCaseResponse]


class StudioTestCaseItem(TestCaseResponse):
    feature_name: str | None = None
    requirement_title: str | None = None
    project_id: str | None = None
    module_name: str | None = None
    executions: list[TestExecutionItem] = []


class StudioTestCaseListResponse(BaseModel):
    total_test_cases: int
    test_cases: list[StudioTestCaseItem]


class TestCaseUpdatePayload(BaseModel):
    title: str | None = None
    scenario: str | None = None
    preconditions: str | None = None
    test_steps: list[str] | None = None
    test_data: str | None = None
    expected_result: str | None = None
    actual_result: str | None = None
    priority: str | None = None
    severity: str | None = None
    test_type: str | None = None
    automation_candidate: bool | None = None
    execution_type: str | None = None
    execution_status: str | None = None
    status: str | None = None
    note: str | None = None
    bug_reference: str | None = None

class TestCaseCreatePayload(BaseModel):
    requirement_id: str
    title: str
    scenario: str | None = None
    preconditions: str | None = None
    test_steps: list[str] | None = []
    test_data: str | None = None
    expected_result: str
    actual_result: str | None = None
    priority: str = "Medium"
    severity: str | None = None
    test_type: str | None = "Functional"
    automation_candidate: bool = False
    execution_type: str = "Manual"
    execution_status: str = "Untested"
    status: str = "draft"
    note: str | None = None
    bug_reference: str | None = None
