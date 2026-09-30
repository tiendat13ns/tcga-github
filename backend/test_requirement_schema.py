import unittest
from types import SimpleNamespace

from pydantic import ValidationError

from app.prompts.requirement_extraction_prompt import SYSTEM_PROMPT as REQUIREMENT_SYSTEM_PROMPT
from app.prompts.test_case_generation_prompt import build_user_prompt as build_test_case_prompt
from app.schemas.agent_schema import AIRequirementOutput
from app.schemas.requirement_schema import RequirementInputUpdateRequest, RequirementResponse


class RequirementSchemaTests(unittest.TestCase):
    def test_structured_output_accepts_ba_qa_fields(self):
        output = AIRequirementOutput.model_validate({
            "requirements": [{
                "title": "Đăng nhập",
                "description": "Người dùng đăng nhập",
                "goal": "Truy cập hệ thống",
                "trigger": "Người dùng nhấn Đăng nhập",
                "components": [{
                    "name": "email", "data_type": "string", "direction": "input",
                    "initial_value": None, "description": "Email tài khoản",
                }],
                "error_messages": [{
                    "type": "validation", "situation": "Email trống",
                    "message": "Email là bắt buộc", "notes": None,
                }],
            }],
        })
        self.assertEqual(output.requirements[0].components[0].direction, "input")
        self.assertEqual(output.requirements[0].error_messages[0].message, "Email là bắt buộc")

    def test_invalid_component_direction_is_rejected(self):
        with self.assertRaises(ValidationError):
            AIRequirementOutput.model_validate({
                "requirements": [{
                    "title": "Login", "description": "Login",
                    "components": [{"name": "email", "direction": "sideways"}],
                }],
            })

    def test_duplicate_clarifying_questions_are_removed(self):
        output = AIRequirementOutput.model_validate({
            "requirements": [{
                "title": "Login",
                "description": "Login",
                "clarifying_questions": [
                    "What triggers login?",
                    "  what   triggers LOGIN?  ",
                ],
            }],
        })
        self.assertEqual(output.requirements[0].clarifying_questions, ["What triggers login?"])

    def test_extraction_prompt_requires_evidence_and_targeted_questions(self):
        self.assertIn("Never invent", REQUIREMENT_SYSTEM_PROMPT)
        self.assertIn("Trigger", REQUIREMENT_SYSTEM_PROMPT)
        self.assertIn("initial values", REQUIREMENT_SYSTEM_PROMPT)
        self.assertIn("empty array []", REQUIREMENT_SYSTEM_PROMPT)

    def test_test_case_prompt_labels_user_context_and_new_fields(self):
        requirement = SimpleNamespace(
            id="req-1",
            title="Login",
            description="User logs in",
            functional_requirement=None,
            actor="User",
            goal="Open the dashboard",
            trigger="Select Sign in",
            module_name=None,
            feature_name=None,
            business_rules=None,
            inputs=None,
            outputs=None,
            preconditions=None,
            validation_rule=None,
            validation_rules=None,
            workflow=None,
            state=None,
            permission=None,
            error_handling=None,
            exception_flows=None,
            components=None,
            error_messages=[{
                "type": "validation",
                "situation": "Email is blank",
                "message": "Email is required",
                "notes": None,
            }],
            user_context="Mobile scope only\nPreserve Unicode ✓",
            clarifying_questions=["What is the lockout behavior?"],
            user_answers=None,
        )
        prompt = build_test_case_prompt(requirement)
        self.assertIn("Business Goal: Open the dashboard", prompt)
        self.assertIn("Trigger: Select Sign in", prompt)
        self.assertIn("Email is required", prompt)
        self.assertIn("[USER-CONFIRMED CONTEXT]", prompt)
        self.assertIn("Mobile scope only\nPreserve Unicode ✓", prompt)
        self.assertIn("[UNRESOLVED QUESTIONS — DO NOT ASSUME ANSWERS]", prompt)

    def test_legacy_requirement_response_defaults_new_fields_to_none(self):
        response = RequirementResponse.model_validate({
            "id": "req-1", "title": "Legacy", "description": "Old row",
            "status": "ai_generated", "version": 1,
        })
        self.assertIsNone(response.goal)
        self.assertIsNone(response.components)
        self.assertIsNone(response.user_context)

    def test_input_update_keeps_old_answers_only_payload_compatible(self):
        payload = RequirementInputUpdateRequest.model_validate({"answers": ["Đã xác nhận"]})
        self.assertEqual(payload.answers, ["Đã xác nhận"])
        self.assertIsNone(payload.user_context)
        self.assertEqual(payload.model_fields_set, {"answers"})

    def test_explicit_null_context_can_be_distinguished_from_an_omitted_field(self):
        payload = RequirementInputUpdateRequest.model_validate({"user_context": None})
        self.assertEqual(payload.model_fields_set, {"user_context"})

    def test_user_context_has_clear_length_limit(self):
        with self.assertRaises(ValidationError):
            RequirementInputUpdateRequest.model_validate({"user_context": "x" * 4001})


if __name__ == "__main__":
    unittest.main()
