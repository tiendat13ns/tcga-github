from pydantic import BaseModel


class RequirementResponse(BaseModel):
    id: str
    title: str
    description: str
    functional_requirement: str | None = None
    validation_rule: list[str] | None = None
    permission: list[str] | None = None
    workflow: list[str] | None = None
    state: list[str] | None = None
    error_handling: list[str] | None = None
    module_name: str | None = None
    feature_name: str | None = None
    actor: str | None = None
    business_rules: list[str] | None = None
    inputs: list[str] | None = None
    outputs: list[str] | None = None
    preconditions: list[str] | None = None
    validation_rules: list[str] | None = None
    exception_flows: list[str] | None = None
    source_reference: str | None = None
    status: str
    version: int
    # Human-in-the-Loop Q&A fields
    clarifying_questions: list[str] | None = None
    user_answers: list[str] | None = None
    # Trạng thái sinh test case chạy nền cho requirement này (None/"generating"/"failed").
    test_case_status: str | None = None
    test_case_error: str | None = None


class GenerateRequirementsResponse(BaseModel):
    document_id: str
    project_id: str | None = None
    total_requirements: int
    requirements: list[RequirementResponse]


class ListRequirementsResponse(BaseModel):
    document_id: str
    total_requirements: int
    requirements: list[RequirementResponse]


class BulkRequirementsResponse(BaseModel):
    """documents keyed by document_id — chỉ chứa các document đã có requirements."""
    documents: dict[str, ListRequirementsResponse]


class GenerationStartedResponse(BaseModel):
    """Trả về khi một tác vụ sinh (requirement/test case) được nhận và chạy nền (HTTP 202)."""
    status: str = "generating"
    document_id: str | None = None
    requirement_id: str | None = None
