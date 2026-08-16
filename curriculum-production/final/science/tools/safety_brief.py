"""The student-visible safety brief carried by every Science work package.

High School briefs are built from the H4 package (mac/hs912-science-h4 @
a86780a), which supersedes H3 and H2. Where H4 authored a student-visible `safety-review` segment,
that text is carried verbatim and is the brief's spine — the build never
paraphrases it and never substitutes text from the failed base candidate.

K-8 briefs are built from each lesson's own `safety_and_privacy` block plus the
imported floor. Nothing is invented: every line is either the lesson's own or a
clause the floor lifted verbatim from a reviewed sibling package.

Text identical across every lesson is referenced by block id rather than copied
into each package; `render` prints the resolved text in full.
"""

from __future__ import annotations

import re

import blocks
from package_model import supervision_words

_PPE_PATTERN = re.compile(r"EYE PROTECTION:\s*([^|]+)")
_SAFE_ORDER_PATTERN = re.compile(r"^\s*SAFE ORDER \d+\.\s*(.+)$", re.MULTILINE)
_DISPOSAL_PATTERN = re.compile(r"^DISPOSAL:\s*(.+?)(?=\nALTERNATIVE|\Z)", re.MULTILINE | re.DOTALL)


def _extension_value(record: dict, key: str) -> str:
    for extension in record.get("extensions", []):
        if extension.get("key") == key:
            return extension["value"]["value"]
    return ""


def _hs_safety_segment(lesson: dict) -> str:
    for segment in lesson.get("lesson_flow", []):
        if segment.get("segment_id") == "safety-review":
            return segment["teacher_or_tutor_action"]
    return ""


def build_hs_brief(lesson: dict, floor: dict) -> dict:
    safety_privacy = lesson.get("safety_privacy", {})
    segment = _hs_safety_segment(lesson)
    summary = _extension_value(lesson, "safety")

    ppe_match = _PPE_PATTERN.search(summary)
    ppe = (
        f"Eye protection: {ppe_match.group(1).strip()}."
        if ppe_match
        else "No protective equipment is required for this lesson's desk work."
    )

    safe_order = [step.strip() for step in _SAFE_ORDER_PATTERN.findall(segment)]
    disposal_match = _DISPOSAL_PATTERN.search(segment)

    supervision = safety_privacy.get("supervision", "none")
    return {
        "student_visible": True,
        "lineage": "hs912-science-h4",
        "read_before_touching": True,
        "headline_ref": "safety-headline",
        "supervision_level": supervision,
        "supervision_plain_words": supervision_words(supervision),
        "hazards": [
            {
                "kind": hazard.get("kind", "physical"),
                "description": hazard["description"],
                "mitigation": hazard["mitigation"],
            }
            for hazard in safety_privacy.get("hazards", [])
        ],
        "required_ppe": ppe,
        "safe_order": safe_order,
        "safe_order_note_ref": "" if safe_order else "hs-desk-safe-order-note",
        "stop_conditions": list(safety_privacy.get("stop_conditions", [])),
        "disposal": disposal_match.group(1).strip() if disposal_match else "",
        "disposal_ref": "" if disposal_match else "hs-desk-disposal",
        "prohibitions_from_floor": True,
        "privacy": list(safety_privacy.get("privacy_declarations", [])),
        "sensitivity": list(safety_privacy.get("sensitivity", [])),
        "pause_rule_ref": "pause-rule",
        "equal_credit_rule_ref": "equal-credit-rule",
        "guardian_acknowledgement": lesson.get("guardian_visibility_note", ""),
        "h4_safety_segment_verbatim": segment,
        "h4_lab_safety_summary_verbatim": summary,
    }


def build_k8_brief(lesson: dict, floor: dict, course_id: str, band: str, data_bearing: bool) -> dict:
    lesson_clauses = list(lesson.get("safety_and_privacy", []))
    imports = floor["imported_into"].get(course_id, [])

    imported_clauses: list[str] = []
    if "elementary_investigation_clauses" in imports:
        imported_clauses = [
            item["text"]
            for item in floor["elementary_investigation_clauses"]
            if item["text"] not in lesson_clauses
        ]

    guardian_ack = lesson.get("guardian_safety_ack", "")
    if not guardian_ack and "guardian_acknowledgement_clauses" in imports:
        clauses = floor["guardian_acknowledgement_clauses"]
        guardian_ack = clauses[0]["text"] if clauses else ""

    # The procedure and the materials for these lessons are family-chosen — the
    # source prescribes neither — so the adult has to be watching, not merely in
    # earshot. Less specified work needs more supervision, not less.
    supervision = "direct-adult" if data_bearing else "none"

    return {
        "student_visible": True,
        "lineage": "g34-committed"
        if course_id in ("ma-g3-science", "ma-g4-science")
        else "canonical-1.0.0+floor",
        "read_before_touching": True,
        "headline_ref": "safety-headline-elementary" if band == "elementary" else "safety-headline",
        "supervision_level": supervision,
        "supervision_plain_words": supervision_words(supervision),
        "hazards": [],
        "hazard_note_ref": "k8-hazard-note",
        "required_ppe_ref": "k8-hands-on-ppe" if data_bearing else "k8-desk-ppe",
        "safe_order": [],
        "safe_order_note_ref": "k8-safe-order-note",
        "lesson_safety_clauses_verbatim": lesson_clauses,
        "imported_floor_clauses": imported_clauses,
        "stop_conditions_from_floor": True,
        "disposal_ref": "k8-disposal",
        "prohibitions_from_floor": True,
        "privacy_from_floor": True,
        "sensitivity": [],
        "pause_rule_ref": "pause-rule",
        "equal_credit_rule_ref": "equal-credit-rule",
        "guardian_acknowledgement": guardian_ack,
        "guardian_visibility_verbatim": lesson.get("parent_or_guardian_visibility", ""),
    }


def _floor_text(items: list[dict], band: str) -> list[str]:
    """Adult clause, or its grades 3-5 restatement for elementary learners."""
    key = "elementary_text" if band == "elementary" else "text"
    return [item.get(key) or item["text"] for item in items]


def resolve(brief: dict, floor: dict, band: str = "secondary") -> dict:
    """Expands every block reference so callers see the full brief text."""
    text = blocks.shared_blocks()["text"]
    resolved = dict(brief)
    resolved["headline"] = text[brief["headline_ref"]]
    resolved["pause_rule"] = text[brief["pause_rule_ref"]]
    resolved["equal_credit_rule"] = text[brief["equal_credit_rule_ref"]]

    if brief.get("required_ppe_ref"):
        resolved["required_ppe"] = text[brief["required_ppe_ref"]]
    if brief.get("hazard_note_ref"):
        resolved["hazard_note"] = text[brief["hazard_note_ref"]]
    if brief.get("safe_order_note_ref"):
        resolved["safe_order_note"] = text[brief["safe_order_note_ref"]]
    else:
        resolved["safe_order_note"] = ""
    if brief.get("disposal_ref"):
        resolved["disposal"] = text[brief["disposal_ref"]]

    if brief.get("stop_conditions_from_floor"):
        resolved["stop_conditions"] = _floor_text(floor["global_stop_conditions"], band)
    if brief.get("prohibitions_from_floor"):
        resolved["prohibitions"] = _floor_text(floor["non_disableable_prohibitions"], band)
    if brief.get("privacy_from_floor"):
        resolved["privacy"] = [item["text"] for item in floor["required_privacy_declarations"]]
    resolved["band"] = band
    return resolved


def brief_lines(resolved: dict) -> list[str]:
    """Every safety line a learner must be able to read, flattened.

    The safety validator uses this to prove nothing in the guardian record is
    missing from what the learner sees.
    """
    lines: list[str] = [resolved["headline"], resolved["supervision_plain_words"]]
    for hazard in resolved.get("hazards", []):
        lines.append(hazard["description"])
        lines.append(hazard["mitigation"])
    lines.extend(resolved.get("safe_order", []))
    lines.extend(resolved.get("stop_conditions", []))
    lines.extend(resolved.get("lesson_safety_clauses_verbatim", []))
    lines.extend(resolved.get("imported_floor_clauses", []))
    lines.extend(resolved.get("prohibitions", []))
    lines.extend(resolved.get("privacy", []))
    lines.extend(resolved.get("sensitivity", []))
    lines.append(resolved.get("required_ppe", ""))
    lines.append(resolved.get("disposal", ""))
    lines.append(resolved["pause_rule"])
    lines.append(resolved["equal_credit_rule"])
    if resolved.get("hazard_note"):
        lines.append(resolved["hazard_note"])
    if resolved.get("safe_order_note"):
        lines.append(resolved["safe_order_note"])
    if resolved.get("guardian_acknowledgement"):
        lines.append(resolved["guardian_acknowledgement"])
    if resolved.get("h4_safety_segment_verbatim"):
        lines.append(resolved["h4_safety_segment_verbatim"])
    return [line for line in lines if line]
