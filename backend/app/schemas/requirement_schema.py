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


class GenerateRequirementsResponse(BaseModel):
    document_id: str
    project_id: str | None = None
    total_requirements: int
    requirements: list[RequirementResponse]


class ListRequirementsResponse(BaseModel):
    document_id: str
    total_requirements: int
    requirements: list[RequirementResponse]
