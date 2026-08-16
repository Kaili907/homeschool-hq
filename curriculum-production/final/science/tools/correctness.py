"""Lesson-level scientific correctness authority.

Reads the hand-authored topic keys in `policy/correctness/`, one per
`(course, unit, focus)` topic, and attaches the forms of authority that apply to
each lesson.

These files are build *inputs*. The build never writes them, and it fails rather
than shipping a lesson whose topic has no key — an absent key must be visible,
not silently tolerated.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

CORRECTNESS_DIR = Path(__file__).resolve().parent.parent / "policy" / "correctness"

REQUIRED_FIELDS = (
    "unit",
    "focus",
    "fixed_facts",
    "relationships",
    "accepted_alternative_framings",
    "disqualifying_errors",
    "out_of_scope",
)

# A key states what the curriculum teaches. Wording that attributes a value or a
# result to the learner has crossed into supplying an observation, which the
# package's first rule forbids. Checked here so the build fails at authoring
# time, and again independently in validation/checks.mjs.
FABRICATION_MARKERS = (
    r"\bthe learner (?:should|will) (?:get|obtain|measure|observe|record|find)\b",
    r"\byou should (?:get|obtain|measure|observe|record|find)\b",
    r"\bexpected (?:value|result|reading|measurement)\b",
    r"\bshould come out (?:to|at)\b",
    r"\bthe result will be\b",
    r"\btypical(?:ly)? (?:reads|measures|comes out)\b",
    r"\bin our trial\b",
    r"\bwe measured\b",
)
_FABRICATION = tuple(re.compile(pattern, re.I) for pattern in FABRICATION_MARKERS)


def topic_key(course_id: str, unit: int, focus: str) -> str:
    return f"{course_id}-u{unit:02d}::{focus}"


def _scan_for_fabrication(key: str, topic: dict) -> list[str]:
    problems = []
    fields = (
        list(topic["fixed_facts"])
        + list(topic["relationships"])
        + list(topic["accepted_alternative_framings"])
        + list(topic["disqualifying_errors"])
        + [topic["out_of_scope"]]
    )
    for text in fields:
        for pattern in _FABRICATION:
            if pattern.search(text):
                problems.append(f"{key}: attributes a result to the learner — {text[:70]}")
    return problems


def load_topic_keys() -> tuple[dict[str, dict], dict[str, dict]]:
    """Returns (topics by key, file provenance by course id)."""
    topics: dict[str, dict] = {}
    provenance: dict[str, dict] = {}
    problems: list[str] = []

    for path in sorted(CORRECTNESS_DIR.glob("*.correctness.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        course_id = document["course_id"]
        provenance[course_id] = {
            "file": f"policy/correctness/{path.name}",
            "source_commit": document["source_commit"],
            "authored_against": document["authored_against"],
        }
        # A key repinned onto a newer source commit rather than re-authored has
        # to say so, and say on what basis, in the package it reaches.
        if "repinned_from" in document:
            provenance[course_id]["repinned_from"] = document["repinned_from"]
            provenance[course_id]["repin_basis"] = document["repin_basis"]
        for topic in document["topics"]:
            for field in REQUIRED_FIELDS:
                if field not in topic:
                    problems.append(f"{course_id}: topic missing field {field}")
            key = topic_key(course_id, topic["unit"], topic["focus"])
            if key in topics:
                problems.append(f"duplicate topic key {key}")
            if not topic["relationships"]:
                problems.append(f"{key}: no accepted relationships authored")
            if not topic["disqualifying_errors"]:
                problems.append(f"{key}: no disqualifying errors authored")
            if not topic["out_of_scope"]:
                problems.append(f"{key}: no grade boundary authored")
            problems += _scan_for_fabrication(key, topic)
            topics[key] = topic

    if problems:
        raise SystemExit(
            "correctness keys rejected:\n  " + "\n  ".join(sorted(problems)[:20])
        )
    return topics, provenance


def build_authority(
    lesson: dict,
    course_id: str,
    topics: dict[str, dict],
    provenance: dict[str, dict],
    data_bearing: bool,
    supplied: dict,
) -> dict:
    key = topic_key(course_id, lesson["unit_number"], lesson["focus"])
    topic = topics.get(key)
    if topic is None:
        raise SystemExit(
            f"no scientific correctness key for {lesson['lesson_id']} (topic {key}). "
            "Author it in policy/correctness/ before building."
        )

    forms = ["ACCEPTED_RELATIONSHIPS", "EXPECTED_REASONING_CRITERIA", "RUBRIC_CORRECTNESS_CONSTRAINT"]
    if topic["fixed_facts"]:
        forms.append("FIXED_FACTUAL")
    if supplied["published_data_named_by_source"]:
        forms.append("SUPPLIED_DATA_ANSWER_AUTHORITY")
    if data_bearing:
        forms.append("INVESTIGATION_CRITERIA")

    authority = {
        "topic_key": key,
        "authority_forms": sorted(forms),
        "headline_ref": "correctness-authority-headline",
        "fixed_facts": list(topic["fixed_facts"]),
        "relationships": list(topic["relationships"]),
        "accepted_alternative_framings": list(topic["accepted_alternative_framings"]),
        "disqualifying_errors": list(topic["disqualifying_errors"]),
        "out_of_scope": topic["out_of_scope"],
        "adult_facing_only": True,
        "authored": dict(provenance[course_id]),
    }
    if data_bearing:
        authority["investigation_rule_ref"] = "investigation-correctness-rule"
    if supplied["published_data_named_by_source"]:
        authority["supplied_data_answer_authority"] = {
            "rule_ref": "supplied-data-answer-authority",
            "authority_is": "the named published source, at the provenance the learner records",
            "source_declared_provenance": supplied["source_declared_provenance"],
            "data_source_resource": supplied["course_data_source_reference"],
            "resource_scope": supplied["data_source_reference_scope"],
        }
    return authority


def coverage_problems(topics: dict[str, dict], expected_keys: set[str]) -> list[str]:
    """Keys authored for topics no lesson uses are as much a defect as missing ones."""
    return sorted(f"authored key matches no lesson: {key}" for key in set(topics) - expected_keys)
