from app.models import Requirement

SYSTEM_PROMPT = """You are a senior QA Engineer and Test Case Designer.

Your task is to generate structured test cases from a given software requirement.

SCOPE (IMPORTANT): These test cases are BLACK-BOX tests derived purely from the requirement
document — the tester has no access to source code and does not know the implementation.
Only generate test cases a QA/BA could execute by using the application like an end user
(UI/API inputs and outputs, documented business rules). Do NOT generate:
- White-box / code-level tests (unit tests, code coverage, internal function calls).
- Performance / load / stress tests (response time, concurrency, throughput).
- Penetration-testing / security-exploit tests (SQL injection, XSS, fuzzing, auth bypass
  attempts) — these require implementation knowledge the tester does not have.
Permission/role checks ARE in scope, but only as ordinary functional black-box tests
(e.g. "user without role X cannot see button Y" / "action Z returns a permission-denied
message for role W") based strictly on what the requirement's permission/role rules state —
not as an attempt to find security vulnerabilities.

For every requirement provided, generate comprehensive test cases that cover:
- Happy path / positive scenarios
- Negative scenarios (invalid inputs, boundary violations)
- Boundary value cases
- Validation and business rule enforcement
- Permission / role-based access scenarios (if applicable) — functional, not security-exploit testing
- Error handling and exception flows (if applicable)

Each test case must include:
- title: A clear, human-readable sentence stating the objective or purpose of the test case. Do NOT use ID-like formats (e.g. PM_TC001_...).
- scenario: what situation is being tested
- preconditions: what must be true before the test runs
- test_steps: ordered list of concrete steps a tester follows
- test_data: specific input values or data used
- expected_result: what the system should do
- priority: High | Medium | Low
- severity: Critical | Major | Minor | Trivial (or null)
- test_type: Positive | Negative | Boundary | Validation | Permission | State Transition | Integration | Other
  (use "Permission" for role-based access tests, "State Transition" for status/lifecycle change tests)
- automation_candidate: true or false
- execution_type: Manual | Automation Candidate

Rules:
- IMPORTANT (TEST DESIGN): You MUST apply ISTQB standard techniques before generating cases:
  1. Equivalence Partitioning: Cover valid and invalid partitions.
  2. Boundary Value Analysis: Test exact MIN, MAX, MIN-1, MAX+1.
  3. Decision Table: If business rules have multiple conditions, create combinations of True/False paths.
  4. State Transition: Test valid and invalid state changes based on 'workflow' and 'state'.
- IMPORTANT (TEST DATA): Do NOT use generic test data like "invalid email" or "long string". Your `test_data` MUST be specific and explicit (e.g., "email='user@.com'", "name='A'*256", "age=-1", "amount=0"). Include Unicode, empty strings/arrays, nulls, and boundary-exceeding values for negative cases. Do NOT include exploit-style payloads (SQL injection, XSS, script injection) — that is penetration testing, out of scope here (see SCOPE above).
- IMPORTANT (LANGUAGE): The language of your output test cases MUST MATCH the language of the input requirement (e.g., if the requirement text is in Vietnamese, all JSON string values must be written in Vietnamese; if English, output in English).
- test_steps must be a list of strings (at least 2 steps). Do NOT include numbering or prefixes like "Step 1:", "Bước 1:", "1.", "- " in the strings (the UI will handle numbering automatically).
- expected_result must be explicit and verifiable — never vague like "it works".
- IMPORTANT (COVERAGE SCOPE): Generate a FOCUSED, high-value suite — NOT an exhaustive one. The
  entire JSON response must fit the model's output token budget, so keep the count SMALL and favour
  quality over quantity. As a guide:
  - Simple requirement (few fields, no branching business rules, single actor): ~5-8 test cases.
  - Medium requirement (some validation rules, permissions, or a state transition): ~8-10 test cases.
  - Complex requirement (many validation rules, multiple roles/permissions, multi-step workflow, several error/state scenarios): ~10-12 test cases.
  - HARD LIMIT: NEVER output more than 12 test cases in a single response. If a requirement has more
    ground to cover, PRIORITIZE the highest-value scenarios (critical validations, permission/role
    checks, state transitions, key boundaries) and DROP redundant or low-value variations — do not
    exceed 12 under any circumstances.
  - Cover all dimensions that actually apply to this requirement: Functional (happy path), Negative (invalid input/actions), Boundary (min/max/edge values), Permission/role-based access (if the requirement defines roles), and State Transition (status change flows). Do not force a dimension that has no basis in the requirement (e.g. no State Transition cases if the requirement has no state/status field, no permission cases if the requirement defines no roles).
  - Do not concentrate cases in only 1-2 dimensions — a suite that is 90% happy-path with only 1-2 negative cases is not acceptable coverage regardless of total count.
- Every validation rule MUST have at least 2 negative test cases (one for each boundary).
- Every error handling scenario MUST have a dedicated test case.
- If [Q&A CLARIFICATION CONTEXT] is provided below, generate additional dedicated test cases for each answer provided — these represent confirmed business rules.
- Do not invent business logic not supported by the requirement or the Q&A context.
- priority: High for critical/auth/data-integrity flows, Medium for standard flows, Low for edge cases.
- automation_candidate: true if the test case has deterministic steps and clear data.
- automation_candidate and execution_type MUST be consistent with each other: if automation_candidate is true, execution_type MUST be "Automation Candidate"; if automation_candidate is false, execution_type MUST be "Manual".
"""


# Chỉ ghép vào SYSTEM_PROMPT ở NHÁNH FALLBACK (khi model/proxy không hỗ trợ structured
# output / function-calling). Luồng chính dùng with_structured_output() nên schema đã được
# Pydantic enforce — KHÔNG lặp lại schema trong prompt để tránh thừa token và tránh làm model
# nhỏ nhả JSON ra text thay vì gọi tool. Xem workflow_service.generate_test_cases_node.
JSON_FORMAT_INSTRUCTION = """Return ONLY valid JSON.
Do not include markdown.
Do not include explanations outside JSON.
Do not wrap the JSON in code fences.

Required JSON schema:

{
  "test_cases": [
    {
      "title": "string",
      "scenario": "string or null",
      "preconditions": "string or null",
      "test_steps": ["step 1", "step 2"],
      "test_data": "string or null",
      "expected_result": "string",
      "priority": "High",
      "severity": "Critical",
      "test_type": "Positive",
      "automation_candidate": false,
      "execution_type": "Manual"
    }
  ]
}
"""


def build_user_prompt(
    requirement: Requirement,
    document_context: str | None = None,
    exclude_titles: list[str] | None = None,
) -> str:
    def _join_list(items) -> str:
        if not items:
            return "None"
        if isinstance(items, list):
            return "\n".join(f"  - {item}" for item in items)
        return str(items)

    sections = [
        f"Generate test cases for the following requirement:\n",
        f"Requirement ID: {requirement.id}",
        f"Title: {requirement.title}",
        f"Description: {requirement.description or 'N/A'}",
        f"Functional Requirement:\n  {requirement.functional_requirement or 'N/A'}",
    ]

    if requirement.actor:
        sections.append(f"Actor: {requirement.actor}")

    if requirement.module_name:
        sections.append(f"Module: {requirement.module_name}")

    if requirement.feature_name:
        sections.append(f"Feature: {requirement.feature_name}")

    if requirement.preconditions:
        sections.append(f"Preconditions:\n{_join_list(requirement.preconditions)}")

    if requirement.validation_rule:
        sections.append(f"Validation Rules:\n{_join_list(requirement.validation_rule)}")

    if requirement.validation_rules:
        sections.append(f"Additional Validation Rules:\n{_join_list(requirement.validation_rules)}")

    if requirement.business_rules:
        sections.append(f"Business Rules:\n{_join_list(requirement.business_rules)}")

    if requirement.workflow:
        sections.append(f"Workflow Steps:\n{_join_list(requirement.workflow)}")

    if requirement.permission:
        sections.append(f"Permissions:\n{_join_list(requirement.permission)}")

    if requirement.error_handling:
        sections.append(f"Error Handling:\n{_join_list(requirement.error_handling)}")

    if requirement.inputs:
        sections.append(f"Inputs:\n{_join_list(requirement.inputs)}")

    if requirement.outputs:
        sections.append(f"Expected Outputs:\n{_join_list(requirement.outputs)}")

    if requirement.exception_flows:
        sections.append(f"Exception Flows:\n{_join_list(requirement.exception_flows)}")

    if document_context:
        sections.append(
            f"[DOCUMENT CONTEXT]\n"
            f"The following excerpts are the most relevant sections from the original source document.\n"
            f"Use them to enrich the test cases with concrete data, edge cases, and business rules\n"
            f"that may not be fully captured in the requirement fields above:\n\n"
            f"{document_context}"
        )

    # Inject Q&A clarification if user has answered
    questions = getattr(requirement, "clarifying_questions", None) or []
    answers = getattr(requirement, "user_answers", None) or []
    if questions and answers:
        qa_lines = []
        for i, q in enumerate(questions):
            ans = answers[i] if i < len(answers) else "(no answer provided)"
            qa_lines.append(f"  Q{i+1}: {q}\n  A{i+1}: {ans}")
        sections.append(
            "[Q&A CLARIFICATION CONTEXT]\n"
            "The following questions were raised by AI about ambiguities in the document.\n"
            "The QA/BA team has provided answers below. Treat each answer as a CONFIRMED business rule\n"
            "and generate at least one dedicated test case for each answer:\n\n"
            + "\n\n".join(qa_lines)
        )
    elif questions:
        # Questions exist but not answered yet — still show as hints
        hints = "\n".join(f"  - {q}" for q in questions)
        sections.append(
            "[UNRESOLVED QUESTIONS — use as hints for boundary/negative cases]\n"
            "The following edge cases were identified as unclear in the document.\n"
            "Use them as inspiration for negative and boundary test cases:\n\n"
            + hints
        )

    # Batch mode: sinh test case bổ sung, tránh trùng với các case đã sinh ở batch trước.
    if exclude_titles:
        sections.append(
            "[BATCH CONTEXT — GENERATE ADDITIONAL DISTINCT TEST CASES]\n"
            "You have ALREADY generated the test cases listed below for THIS requirement. Do NOT repeat\n"
            "them or produce trivial variations. Generate ONLY NEW, DISTINCT, high-value test cases that\n"
            "cover scenarios/dimensions not yet addressed (more negatives, boundaries, permission/role,\n"
            "state transitions, error/exception flows, edge combinations). If there is no more meaningful\n"
            "ground to cover, return FEWER cases (or an empty list) rather than padding with redundant ones.\n\n"
            "Already generated (do not duplicate):\n"
            + "\n".join(f"  - {t}" for t in exclude_titles)
        )

    sections.append("""
Before returning JSON, internally verify:
- ISTQB check: Have you used Boundary Value Analysis (MIN/MAX, MIN-1, MAX+1) and Equivalence Partitioning?
- Test Data check: Does `test_data` contain explicit, raw values (e.g., exact strings, numbers, nulls, special chars) rather than generic descriptions?
- Coverage check: the number of test cases matches the ACTUAL complexity of this requirement (not padded, not skimped — see COVERAGE SCOPE rule), and spans every dimension that applies here (Functional, Negative, Boundary, Permission/role-based access, State Transition) without concentrating almost entirely on happy-path.
- Scope check: no white-box/code-level, performance/load, or penetration-testing/security-exploit test cases (SQL injection, XSS, fuzzing) — this is black-box functional testing only.
- every validation rule has at least 2 negative test cases;
- every error handling scenario has a dedicated test case;
- if Q&A context is provided, each answer has at least 1 dedicated test case;
- title values are unique, descriptive, and in natural language (no ID codes);
- test_steps contains at least 2 steps for each test case;
- automation_candidate and execution_type agree with each other (true ↔ "Automation Candidate", false ↔ "Manual");
- the response is ONLY valid JSON matching the required schema.
""")

    return "\n\n".join(sections)
