import unittest
from types import SimpleNamespace

from app.services.generation.requirement_coverage_service import (
    build_context_batches,
    extract_source_sections,
    find_uncovered_sections,
)


class RequirementCoverageTests(unittest.TestCase):
    def setUp(self):
        self.document = "# Product SRS\n\n" + "\n\n".join(
            f"## Use Case {index}\n### Mục tiêu\nMục tiêu {index}.\n### Luồng chính\nActor thực hiện nghiệp vụ {index}."
            for index in range(1, 8)
        )

    def test_extracts_all_seven_business_sections(self):
        sections = extract_source_sections(self.document)
        self.assertEqual([section.title for section in sections], [f"Use Case {i}" for i in range(1, 8)])

    def test_batches_keep_every_source_marker(self):
        sections = extract_source_sections(self.document)
        combined = "\n".join(build_context_batches(sections, max_chars=2_000))
        for section in sections:
            self.assertIn(section.marker, combined)

    def test_reports_only_sections_without_source_reference(self):
        sections = extract_source_sections(self.document)
        generated = [SimpleNamespace(source_reference=f"[SOURCE SECTION: Use Case {i}]") for i in range(1, 5)]
        uncovered = find_uncovered_sections(sections, generated)
        self.assertEqual([section.title for section in uncovered], ["Use Case 5", "Use Case 6", "Use Case 7"])

    def test_partial_reference_does_not_mark_a_section_covered(self):
        sections = extract_source_sections(self.document)
        generated = [SimpleNamespace(source_reference="Use")]
        self.assertEqual(find_uncovered_sections(sections, generated), sections)

    def test_ignores_numbered_internal_and_group_headings(self):
        document = """# 1. Functional Requirements
## 1.1 Login
### 1.1.1 Main Flow
User signs in.
## 1.2 Reset Password
### 1.2.1 Error Handling
The token may expire.
# 2. Non-functional Requirements
## 2.1 Audit History
User actions are recorded.
"""
        sections = extract_source_sections(document)
        self.assertEqual(
            [section.title for section in sections],
            ["1.1 Login", "1.2 Reset Password", "2.1 Audit History"],
        )


if __name__ == "__main__":
    unittest.main()
