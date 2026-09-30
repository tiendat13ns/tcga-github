"""Structure-aware context batching and coverage checks for Requirement extraction."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Sequence


_HEADING_RE = re.compile(r"^(#{1,4})\s+(.+?)\s*$", re.MULTILINE)
_NON_BUSINESS_HEADINGS = {
    "abstract", "appendix", "background", "change log", "changelog", "contents",
    "definitions", "document information", "functional requirements", "glossary",
    "introduction", "non functional requirements", "overview",
    "references", "scope", "table of contents",
    "actor", "actor chinh", "actor phu", "acceptance criteria", "business rules",
    "description", "error handling", "exception flow", "goal", "input", "inputs",
    "main flow", "notes", "output", "outputs", "permission", "permissions",
    "postcondition", "postconditions", "precondition", "preconditions", "state",
    "trigger", "validation", "validation rules", "workflow",
    "bang thuat ngu", "dau ra", "dau vao", "dieu kien tien quyet", "gioi thieu",
    "ghi chu", "luong chinh", "luong ngoai le", "luong thay the", "mo ta", "muc luc",
    "muc tieu", "pham vi", "quy tac nghiep vu", "tai lieu tham khao", "tong quan",
    "tieu chi chap nhan", "xu ly loi", "yeu cau chuc nang", "yeu cau phi chuc nang",
}


@dataclass(frozen=True)
class SourceSection:
    title: str
    content: str

    @property
    def marker(self) -> str:
        return f"[SOURCE SECTION: {self.title}]"

    def render(self) -> str:
        return f"{self.marker}\n{self.content.strip()}".strip()


def _normalise(value: str | None) -> str:
    if not value:
        return ""
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", ascii_value.lower()).strip()


def _is_business_heading(title: str) -> bool:
    normalised = _normalise(title).strip(" :.-")
    normalised = re.sub(r"^(?:\d+\s+)+", "", normalised)
    if not normalised or normalised in _NON_BUSINESS_HEADINGS:
        return False
    if normalised.isdigit() or len(normalised) < 3:
        return False
    return True


def extract_source_sections(text: str) -> list[SourceSection]:
    """Extract likely use-case/feature sections while ignoring internal metadata headings."""
    matches = list(_HEADING_RE.finditer(text or ""))
    if not matches:
        return [SourceSection("Full document", (text or "").strip())]

    headings = [
        (match.start(), match.end(), len(match.group(1)), match.group(2).strip())
        for match in matches
    ]
    business_by_level: dict[int, list[tuple[int, int, int, str]]] = {}
    for heading in headings:
        if _is_business_heading(heading[3]):
            business_by_level.setdefault(heading[2], []).append(heading)

    eligible_levels = [
        level for level, level_headings in business_by_level.items()
        if len(level_headings) >= 2
    ]
    chosen_level = min(
        eligible_levels,
        key=lambda level: (-len(business_by_level[level]), level),
        default=None,
    )

    if chosen_level is None:
        return [SourceSection("Full document", (text or "").strip())]

    sections: list[SourceSection] = []
    for start, body_start, level, title in business_by_level[chosen_level]:
        end = len(text)
        for next_start, _next_body, next_level, _next_title in headings:
            if next_start > start and next_level <= level:
                end = next_start
                break
        content = text[body_start:end].strip()
        if content:
            sections.append(SourceSection(title=title, content=content))

    return sections or [SourceSection("Full document", (text or "").strip())]


def build_context_batches(
    sections: Sequence[SourceSection],
    max_chars: int = 24_000,
) -> list[str]:
    """Keep every section in source order while staying below a per-call context budget."""
    max_chars = max(2_000, max_chars)
    rendered_parts: list[str] = []
    for section in sections:
        rendered = section.render()
        if len(rendered) <= max_chars:
            rendered_parts.append(rendered)
            continue

        content_budget = max_chars - len(section.marker) - 2
        paragraphs = re.split(r"\n\s*\n", section.content)
        current = ""
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            if len(paragraph) > content_budget:
                if current:
                    rendered_parts.append(f"{section.marker}\n{current}")
                    current = ""
                for offset in range(0, len(paragraph), content_budget):
                    rendered_parts.append(f"{section.marker}\n{paragraph[offset:offset + content_budget]}")
                continue
            candidate = f"{current}\n\n{paragraph}".strip()
            if current and len(candidate) > content_budget:
                rendered_parts.append(f"{section.marker}\n{current}")
                current = paragraph
            else:
                current = candidate
        if current:
            rendered_parts.append(f"{section.marker}\n{current}")

    batches: list[str] = []
    current_parts: list[str] = []
    current_length = 0
    for part in rendered_parts:
        separator_length = 6 if current_parts else 0
        if current_parts and current_length + separator_length + len(part) > max_chars:
            batches.append("\n\n---\n\n".join(current_parts))
            current_parts = []
            current_length = 0
        current_parts.append(part)
        current_length += separator_length + len(part)
    if current_parts:
        batches.append("\n\n---\n\n".join(current_parts))
    return batches


def find_uncovered_sections(sections: Sequence[SourceSection], requirements: Iterable[object]) -> list[SourceSection]:
    """Return business sections not referenced by any generated Requirement."""
    if len(sections) == 1 and sections[0].title == "Full document":
        return []
    references = [
        _normalise(getattr(requirement, "source_reference", None))
        for requirement in requirements
    ]
    uncovered: list[SourceSection] = []
    for section in sections:
        title = _normalise(section.title)
        if not any(title and title in reference for reference in references if reference):
            uncovered.append(section)
    return uncovered


def deduplicate_requirements(requirements: Iterable[object]) -> list[object]:
    """Remove exact cross-batch duplicates without merging independent use cases."""
    unique: list[object] = []
    seen: set[tuple[str, str]] = set()
    for requirement in requirements:
        key = (
            _normalise(getattr(requirement, "source_reference", None)),
            _normalise(getattr(requirement, "title", None)),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(requirement)
    return unique
