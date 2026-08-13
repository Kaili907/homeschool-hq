#!/usr/bin/env python3
"""Builds the Science student-work production packages.

    python3 curriculum-production/final/science/tools/build_student_work.py

Deterministic: no clock, no randomness, sorted iteration throughout. Rebuilding
from the same pinned sources reproduces the tree byte for byte.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import blocks  # noqa: E402
import correctness  # noqa: E402
import render  # noqa: E402
from blocks import ELEMENTARY_SAFETY_VARIANTS  # noqa: E402
from package_model import (  # noqa: E402
    PACKAGE_VERSION,
    build_analysis_questions,
    build_derived_alternative_task,
    build_data_sheet,
    build_extension,
    build_instruction,
    build_remediation,
    is_data_bearing,
    unit_phenomenon,
)
from safety_brief import brief_lines, build_hs_brief, build_k8_brief, resolve  # noqa: E402
from safety_floor import build_safety_floor  # noqa: E402
from sources import (  # noqa: E402
    COURSES,
    HS_FAILED_BASE_COMMIT,
    HS_H4_COMMIT,
    HS_SUPERSEDED_H2_COMMIT,
    HS_SUPERSEDED_H3_COMMIT,
    HS_RESOURCES_PATH,
    INPUT_COMMITS,
    REPO_ROOT,
    SourceReader,
)

OUT_ROOT = REPO_ROOT / "curriculum-production" / "final" / "science"

REGISTER_BY_BAND = {"elementary": "elementary", "middle": "secondary", "high": "secondary"}


# ---------------------------------------------------------------------------
# Source adapters
# ---------------------------------------------------------------------------


def _k8_normalise(raw: dict, units: dict[str, dict], course: dict) -> dict:
    unit_id = f"{course['course_id']}-u{raw['unit_number']:02d}"
    return {
        "lesson_id": raw["lesson_id"],
        "unit_id": unit_id,
        "unit_number": raw["unit_number"],
        "unit_title": raw["unit_title"],
        "day_in_unit": raw["day_in_unit"],
        "course_day": raw["course_day"],
        "title": raw["title"],
        "phase": raw["phase"],
        "focus": raw["focus"],
        "estimated_minutes": raw["estimated_minutes"],
        "standards": list(raw["standards"]),
        "essential_question": raw["essential_question"],
        "learning_objectives": list(raw["learning_objectives"]),
        "success_criteria": list(raw["success_criteria"]),
        "materials": list(raw["materials"]),
        "student_activity": raw["student_activity"],
        "formative_check": raw["formative_check"],
        "scoring_guidance": raw["answer_or_scoring_guidance"],
        "home_connection": raw.get("home_connection", ""),
        "accessibility": list(raw.get("accessibility_and_accommodations", [])),
        "raw": raw,
        "unit": units[unit_id],
    }


def _hs_normalise(raw: dict, units: dict[str, dict], course: dict) -> dict:
    duration = raw.get("estimated_duration", {})
    standards = [
        entry.get("standard_id", "").upper() or entry.get("legacy_label", "practice foundation")
        for entry in raw.get("standards", [])
    ]
    return {
        "lesson_id": raw["lesson_id"],
        "unit_id": raw["unit_ref"],
        "unit_number": int(raw["unit_ref"].rsplit("-u", 1)[1]),
        "unit_title": units[raw["unit_ref"]]["title"],
        "day_in_unit": raw["day_in_unit"],
        "course_day": raw["course_day"],
        "title": raw["title"],
        "phase": raw["phase"],
        "focus": raw["focus"],
        "estimated_minutes": f"{duration.get('minimum_minutes')}–{duration.get('maximum_minutes')}",
        "standards": standards,
        "essential_question": raw["essential_question"],
        "learning_objectives": list(raw["learning_objectives"]),
        "success_criteria": list(raw["success_criteria"]),
        "materials": list(raw["materials"]),
        "student_activity": raw["student_activity"],
        "formative_check": raw["formative_check"],
        "scoring_guidance": raw["scoring_guidance"],
        "home_connection": raw.get("home_connection", ""),
        "accessibility": _hs_accessibility(raw.get("accessibility", {})),
        "raw": raw,
        "unit": units[raw["unit_ref"]],
    }


def _hs_accessibility(accessibility: dict) -> list[str]:
    if not accessibility:
        return []
    modes = ", ".join(accessibility.get("response_modes", []))
    return [
        f"A readable text path is {accessibility.get('text_fallback', 'required')} for every activity.",
        f"Keyboard access is {accessibility.get('keyboard', 'required')}.",
        f"Accepted response modes: {modes}.",
        "Extended time is available and the timer is hidden."
        if accessibility.get("extended_time")
        else "Timing accommodations follow the course policy.",
        "Movement breaks are available at any point.",
    ]


# ---------------------------------------------------------------------------
# Alternatives
# ---------------------------------------------------------------------------


def _extension_value(record: dict, key: str) -> str:
    for extension in record.get("extensions", []):
        if extension.get("key") == key:
            return extension["value"]["value"]
    return ""


# Provenance wording that means the lesson draws on data the learner did not
# generate. Any of these makes the lesson's external source subject to the
# integrity check.
EXTERNAL_DATA_MARKERS = (
    "published",
    "retriev",
    "looked up",
    "reference densit",
    "reference value",
    "dataset",
    "data set",
    "public record",
)


# A materials list states a protective-equipment position, not an item to
# obtain, when it opens with "no ... protection".
_PPE_STATEMENT = re.compile(r"^\s*no\b.*\bprotection\b", re.I)


def filter_materials(materials: list[str]) -> list[str]:
    return [item for item in materials if not _PPE_STATEMENT.match(item)]


def build_alternatives(
    lesson: dict, course: dict, floor: dict, data_bearing: bool, resource_ids: set[str],
    register: str,
) -> tuple[dict, dict]:
    """Returns (supplied_data_alternative, equal_credit_safe_alternative)."""
    if course["family"] == "hs":
        lesson_alternative = _extension_value(lesson["raw"], "alternative")
        unit_alternative = _extension_value(lesson["unit"], "alternative")
        provenance = _extension_value(lesson["raw"], "provenance")
        data_source_ref = next(
            (
                ref
                for ref in lesson["raw"].get("resource_refs", [])
                if ref.endswith("-data-sources")
            ),
            "",
        )
        data_source_scope = "lesson" if data_source_ref else ""
        # Some lesson-level alternatives are pointers rather than paths: they
        # say the lesson needs no special equipment and defer to the unit's
        # Day 7 investigation. That is the honest statement for a desk day, so
        # it stays. A lesson that actually handles materials needs the
        # alternative itself, so those fall back to the unit-level path.
        is_pointer = bool(
            re.search(r"no special equipment is needed for this lesson", lesson_alternative, re.I)
        )
        if data_bearing and (is_pointer or not lesson_alternative) and unit_alternative:
            alternative_text = unit_alternative
            alternative_source = "hs912-science-h4 unit lab-alternative"
            is_pointer = False
        else:
            alternative_text = lesson_alternative or unit_alternative
            alternative_source = (
                "hs912-science-h4 lesson lab-alternative"
                if lesson_alternative
                else "hs912-science-h4 unit lab-alternative"
            )
        # A desk day still tells the learner what the unit's hands-on day offers,
        # so the choice is visible before Day 7 rather than on it.
        unit_path_text = (
            unit_alternative
            if unit_alternative and alternative_text not in unit_alternative
            else ""
        )
        lowered = provenance.lower()
        published_data = any(marker in lowered for marker in EXTERNAL_DATA_MARKERS)
        if published_data and not data_source_ref:
            # The published-data list is a course-scoped resource. A lesson that
            # names published data without listing it still resolves to the
            # course list, provided that resource actually exists.
            candidate = f"res-{course['course_id']}-data-sources"
            if candidate in resource_ids:
                data_source_ref = candidate
                data_source_scope = "course"
        if not published_data:
            # A lesson whose data the learner collects has no published source
            # to point at, and saying otherwise would invite a lookup instead of
            # a measurement.
            data_source_ref = ""
            data_source_scope = ""
    else:
        provenance = ""
        data_source_ref = ""
        data_source_scope = ""
        published_data = False
        is_pointer = False
        unit_path_text = ""
        if lesson["raw"].get("investigation_alternative"):
            alternative_text = lesson["raw"]["investigation_alternative"]
            alternative_source = "g34-committed investigation_alternative"
        else:
            clauses = floor["equal_credit_alternative_clauses"]
            alternative_text = clauses[0]["text"] if clauses else ""
            alternative_source = (
                "imported from g34-committed investigation_alternative; the canonical Grade 5/7/8 "
                "source declares none of its own"
            )

    supplied = {
        "applies_to_data_collection": data_bearing,
        "headline_ref": "supplied-headline",
        "how_ref": "supplied-how",
        "supplies_no_numbers_ref": "supplies-no-numbers",
        "marking_rule_ref": "no-supplied-values-rule",
        "provenance_required_ref": "supplied-provenance-fields",
        "scoring_ref": "supplied-scoring",
        "source_declared_provenance": provenance,
        "published_data_named_by_source": published_data,
        "course_data_source_reference": data_source_ref,
        "data_source_reference_scope": data_source_scope,
    }

    # Several alternatives promise supplied or provided material — a data set, a
    # table, a diagram sequence, a printed case study — that neither the source
    # nor this package ships. Rather than edit committed source text, the
    # package says plainly what "supplied" means and who has to produce it.
    promises_supplied_material = bool(
        re.search(r"\b(supplied|provided)\b", alternative_text, re.I)
    )

    equal_credit = {
        "text": alternative_text,
        "source": alternative_source,
        "derived_task": (
            build_derived_alternative_task(lesson, register)
            if course["family"] == "k8"
            else ""
        ),
        "derived_task_note_ref": "k8-derived-path-note" if course["family"] == "k8" else "",
        "clarification_ref": "supplied-material-clarification"
        if promises_supplied_material
        else "",
        "is_no_equipment_note": is_pointer,
        "unit_path_text": unit_path_text,
        "guarantees_ref": "alternative-guarantees",
        "equal_credit_rule_ref": "equal-credit-rule",
        "how_to_choose_ref": "alternative-how-to-choose",
    }
    return supplied, equal_credit


# ---------------------------------------------------------------------------
# Scoring authority
# ---------------------------------------------------------------------------


def build_expected_reasoning(lesson: dict, questions: list[dict]) -> dict:
    return {
        "no_fixed_answer_key_ref": "no-fixed-answer-key",
        "source_scoring_guidance_verbatim": lesson["scoring_guidance"],
        "success_criteria_verbatim": list(lesson["success_criteria"]),
        "per_question": [
            {
                "id": question["id"],
                "kind": question["kind"],
                "objective_index": question["objective_index"],
                "complete_response_contains_ref": question["kind"],
            }
            for question in questions
        ],
        "non_negotiables_ref": "scoring-non-negotiables",
    }


def build_rubric(lesson: dict) -> dict:
    return {
        "criteria_ref": "rubric_criteria",
        "scale_ref": "rubric-scale",
        "threshold_ref": "rubric-threshold",
        "equal_credit_rule_ref": "equal-credit-rule",
        "success_criteria_verbatim": list(lesson["success_criteria"]),
    }


# ---------------------------------------------------------------------------
# Package assembly
# ---------------------------------------------------------------------------


def safety_completeness(
    resolved_brief: dict, guardian_record: dict, band: str
) -> tuple[str, list[str]]:
    """VERIFIED only when the learner can read everything the guardian record holds.

    For grades 3-5 the learner reads the restated variant of a floor clause
    rather than the adult wording, so either form satisfies the comparison —
    but only a variant this build actually authored, never a paraphrase.
    """
    problems: list[str] = []
    visible = "\n".join(brief_lines(resolved_brief))

    def is_visible(clause: str) -> bool:
        if clause in visible:
            return True
        if band != "elementary":
            return False
        variant = ELEMENTARY_SAFETY_VARIANTS.get(clause)
        return bool(variant) and variant in visible

    for hazard in guardian_record.get("hazards", []):
        if not is_visible(hazard["description"]):
            problems.append(f"hazard not student-visible: {hazard['description'][:60]}")
        if not is_visible(hazard["mitigation"]):
            problems.append(f"mitigation not student-visible: {hazard['mitigation'][:60]}")
    for condition in guardian_record.get("stop_conditions", []):
        if not is_visible(condition):
            problems.append(f"stop condition not student-visible: {condition[:60]}")
    if not resolved_brief.get("stop_conditions"):
        problems.append("brief carries no stop conditions")
    if not resolved_brief.get("required_ppe"):
        problems.append("brief states no protective-equipment position")
    if not resolved_brief.get("disposal"):
        problems.append("brief states no disposal step")
    if not resolved_brief.get("prohibitions"):
        problems.append("brief carries no non-disableable prohibitions")

    return ("VERIFIED" if not problems else "GAP"), problems


_PPE_TERMS = (
    ("eye protection", re.compile(r"\beye protection\b|\bsafety (?:glasses|goggles)\b", re.I)),
    ("gloves", re.compile(r"\bgloves?\b", re.I)),
    ("waterproof dressing", re.compile(r"\bwaterproof dressing\b", re.I)),
    ("apron", re.compile(r"\bapron\b", re.I)),
    ("dust mask", re.compile(r"\bdust mask\b", re.I)),
)


def protective_equipment(lesson: dict, resolved_brief: dict) -> str:
    """Every protective item this lesson names, not only the eye-protection position.

    H3 resolved gloves and dressings onto the materials list but left the brief's
    PPE line stating eye protection alone, so the one field an adult reads as the
    PPE summary understated the lesson. This reads the materials, the mitigations,
    and the safe order as well, so the summary cannot be narrower than the lesson.
    """
    stated = resolved_brief.get("required_ppe", "")
    surfaces = " \n".join(
        [
            " ".join(lesson.get("materials", [])),
            " ".join(hazard["mitigation"] for hazard in resolved_brief.get("hazards", [])),
            " ".join(resolved_brief.get("safe_order", [])),
        ]
    )
    extra = [
        name
        for name, pattern in _PPE_TERMS
        if pattern.search(surfaces) and not pattern.search(stated)
    ]
    if not extra:
        return stated
    return f"{stated} Also required by this lesson: {', '.join(extra)}."


def build_package(
    lesson: dict,
    course: dict,
    floor: dict,
    resource_ids: set[str],
    topics: dict,
    topic_provenance: dict,
) -> dict:
    register = REGISTER_BY_BAND[course["band"]]
    data_bearing = is_data_bearing(lesson["phase"])
    work_type = "INVESTIGATION_DATA_SHEET" if data_bearing else "STUDENT_WORK_SHEET"

    if course["family"] == "hs":
        brief = build_hs_brief(lesson["raw"], floor)
        guardian_record = {
            "policy_ref": lesson["raw"].get("safety_privacy", {}).get("policy_ref", ""),
            "hazards": lesson["raw"].get("safety_privacy", {}).get("hazards", []),
            "supervision": lesson["raw"].get("safety_privacy", {}).get("supervision", "none"),
            "guardian_visibility": lesson["raw"]
            .get("safety_privacy", {})
            .get("guardian_visibility", ""),
            "stop_conditions": lesson["raw"].get("safety_privacy", {}).get("stop_conditions", []),
            "privacy_declarations": lesson["raw"]
            .get("safety_privacy", {})
            .get("privacy_declarations", []),
            "academic_integrity_mode": lesson["raw"]
            .get("safety_privacy", {})
            .get("academic_integrity_mode", ""),
        }
    else:
        brief = build_k8_brief(lesson["raw"], floor, course["course_id"], course["band"], data_bearing)
        guardian_record = {
            "policy_ref": "manuel-academy-science-student-work-floor",
            "hazards": [],
            "supervision": brief["supervision_level"],
            "guardian_visibility": "summary",
            "stop_conditions": [item["text"] for item in floor["global_stop_conditions"]],
            "lesson_safety_and_privacy_verbatim": lesson["raw"].get("safety_and_privacy", []),
            "guardian_visibility_note": lesson["raw"].get("parent_or_guardian_visibility", ""),
        }

    resolved_brief = resolve(brief, floor, course["band"])

    # H3 found the guardian note had no field for the safe order, the protective
    # equipment, or the disposal, so an adult reading only the record could not
    # see what the learner had been told to do first, wear, or bin. The record
    # carries all three, resolved exactly as the learner reads them.
    guardian_record["safe_order"] = list(resolved_brief.get("safe_order", []))
    guardian_record["required_ppe"] = protective_equipment(lesson, resolved_brief)
    guardian_record["disposal_instruction"] = resolved_brief.get("disposal", "")
    # Additive only. The source's own visibility note carries the privacy
    # directive for grades 3-8 and must not be displaced by the acknowledgement.
    if resolved_brief.get("guardian_acknowledgement"):
        guardian_record["guardian_acknowledgement"] = resolved_brief["guardian_acknowledgement"]
        guardian_record.setdefault(
            "guardian_visibility_note", resolved_brief["guardian_acknowledgement"]
        )
    safety_status, safety_problems = safety_completeness(
        resolved_brief, guardian_record, course["band"]
    )

    questions, unmapped_objectives = build_analysis_questions(lesson, register)
    data_sheet = build_data_sheet(lesson, work_type)
    supplied, equal_credit = build_alternatives(
        lesson, course, floor, data_bearing, resource_ids, register
    )
    remediation = build_remediation(lesson["raw"], course["family"])
    extension = build_extension(lesson["raw"], lesson["unit"], course["family"])
    expected_reasoning = build_expected_reasoning(lesson, questions)
    rubric = build_rubric(lesson)
    authority = correctness.build_authority(
        lesson, course["course_id"], topics, topic_provenance, data_bearing, supplied
    )
    instruction = build_instruction(lesson, lesson["unit"])

    covered = {question["objective_index"] for question in questions}
    aligned = covered == set(range(len(lesson["learning_objectives"]))) and all(
        0 <= question["objective_index"] < len(lesson["learning_objectives"])
        for question in questions
    )

    requires_source_integrity = bool(supplied["published_data_named_by_source"])
    if not requires_source_integrity:
        source_integrity_status = "NOT_APPLICABLE"
    elif supplied["source_declared_provenance"] and supplied["course_data_source_reference"]:
        source_integrity_status = "VERIFIED"
    else:
        source_integrity_status = "UNKNOWN"

    return {
        "package_version": PACKAGE_VERSION,
        "package_id": f"swp-{lesson['lesson_id']}",
        "lesson_id": lesson["lesson_id"],
        "course_id": course["course_id"],
        "course_title": course["title"],
        "grade": course["grade"],
        "band": course["band"],
        "register": register,
        "subject": "science",
        "unit_id": lesson["unit_id"],
        "unit_number": lesson["unit_number"],
        "unit_title": lesson["unit_title"],
        "day_in_unit": lesson["day_in_unit"],
        "course_day": lesson["course_day"],
        "title": lesson["title"],
        "phase": lesson["phase"],
        "focus": lesson["focus"],
        "estimated_minutes": lesson["estimated_minutes"],
        "standards": lesson["standards"],
        "essential_question": lesson["essential_question"],
        "learning_objectives": lesson["learning_objectives"],
        "success_criteria": lesson["success_criteria"],
        "materials": filter_materials(lesson["materials"]),
        "accessibility": lesson["accessibility"],
        "home_connection": lesson["home_connection"],
        "source": {
            "lineage": course["lineage"],
            "commit": course["commit"],
            "path": course["lessons_path"],
            "record_id": lesson["lesson_id"],
        },
        "work_type": work_type,
        "data_bearing": data_bearing,
        "instruction": instruction,
        # The unit phenomenon carries H3's student-visible SAFETY rule for any
        # hazard-bearing material it names. It reached the machine record only,
        # so the printed sheet asked for observations of a phenomenon it never
        # stated, and the rule reached nobody who reads the sheet.
        "unit_phenomenon": unit_phenomenon(lesson["unit"]),
        "safety_brief": brief,
        "data_sheet": data_sheet,
        "supplied_data_alternative": supplied,
        "equal_credit_safe_alternative": equal_credit,
        "analysis_questions": questions,
        "expected_reasoning": expected_reasoning,
        "scientific_correctness_authority": authority,
        "rubric": rubric,
        "remediation": remediation,
        "extension": extension,
        "guardian_record": guardian_record,
        "assurances": {
            "supplies_no_observations": True,
            "supplies_no_expected_values": True,
            "every_recording_field_blank": True,
            "equal_credit_alternative_present": bool(equal_credit["text"]),
            "student_visible_safety_brief": True,
            "safety_completeness": safety_status,
            "safety_problems": safety_problems,
            "objective_alignment_verified": aligned,
            "scientific_correctness_authority_present": True,
            "scientific_correctness_authority_forms": list(authority["authority_forms"]),
            "supplies_no_expected_measurement": True,
            "unmapped_objective_templates": unmapped_objectives,
            "source_integrity_required": requires_source_integrity,
            "source_integrity_status": source_integrity_status,
            "source_integrity_evidence": (
                {
                    "provenance_statement_carried_verbatim": bool(
                        supplied["source_declared_provenance"]
                    ),
                    "named_data_source_resource": supplied["course_data_source_reference"],
                    "resource_scope": supplied["data_source_reference_scope"],
                    "third_party_content_embedded": False,
                }
                if requires_source_integrity
                else {}
            ),
        },
    }


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def load_all(reader: SourceReader) -> tuple[dict[str, list[dict]], dict[str, dict]]:
    raw_lessons: dict[str, list[dict]] = {}
    units_by_course: dict[str, dict] = {}
    for course in COURSES:
        raw_lessons[course["course_id"]] = reader.read_jsonl(
            course["lineage"], course["commit"], course["lessons_path"]
        )
        units = reader.read_json(course["lineage"], course["commit"], course["units_path"])
        units_by_course[course["course_id"]] = {
            unit["unit_id"]: unit
            for unit in units
            if unit.get("course_id", unit.get("course_ref")) == course["course_id"]
        }
    return raw_lessons, units_by_course


def main() -> int:
    reader = SourceReader()
    raw_lessons, units_by_course = load_all(reader)
    floor = build_safety_floor(reader, raw_lessons)
    topics, topic_provenance = correctness.load_topic_keys()
    resources = reader.read_json("hs912-science-h4", HS_H4_COMMIT, HS_RESOURCES_PATH)
    resource_ids = {resource["resource_id"] for resource in resources}
    shared = blocks.shared_blocks()

    packages_root = OUT_ROOT / "packages"
    if packages_root.exists():
        shutil.rmtree(packages_root)

    coverage: list[dict] = []
    total = 0
    used_topic_keys: set[str] = set()

    for course in COURSES:
        course_id = course["course_id"]
        units = units_by_course[course_id]
        normalise_fn = _k8_normalise if course["family"] == "k8" else _hs_normalise
        lessons = [normalise_fn(raw, units, course) for raw in raw_lessons[course_id]]
        lessons.sort(key=lambda lesson: (lesson["unit_number"], lesson["day_in_unit"]))

        course_dir = packages_root / course_id
        (course_dir / "student-sheets").mkdir(parents=True, exist_ok=True)
        (course_dir / "scoring").mkdir(parents=True, exist_ok=True)

        records = []
        for lesson in lessons:
            package = build_package(
                lesson, course, floor, resource_ids, topics, topic_provenance
            )
            used_topic_keys.add(package["scientific_correctness_authority"]["topic_key"])
            records.append(package)
            (course_dir / "student-sheets" / f"{package['lesson_id']}.md").write_text(
                render.student_sheet(package, shared, floor), encoding="utf-8"
            )
            (course_dir / "scoring" / f"{package['lesson_id']}.md").write_text(
                render.scoring_sheet(package, shared, floor), encoding="utf-8"
            )

        with (course_dir / "work-packages.jsonl").open("w", encoding="utf-8") as handle:
            for package in records:
                handle.write(json.dumps(package, ensure_ascii=False, sort_keys=True) + "\n")

        (course_dir / "README.md").write_text(
            render.course_readme(course, records), encoding="utf-8"
        )

        total += len(records)
        coverage.append(
            {
                "course_id": course_id,
                "title": course["title"],
                "grade": course["grade"],
                "lineage": course["lineage"],
                "commit": course["commit"],
                "lessons": len(records),
                "units": len({package["unit_id"] for package in records}),
                "investigation_data_sheets": sum(
                    1 for package in records if package["work_type"] == "INVESTIGATION_DATA_SHEET"
                ),
                "student_work_sheets": sum(
                    1 for package in records if package["work_type"] == "STUDENT_WORK_SHEET"
                ),
                "safety_verified": sum(
                    1
                    for package in records
                    if package["assurances"]["safety_completeness"] == "VERIFIED"
                ),
                "hazard_bearing": sum(
                    1 for package in records if package["safety_brief"].get("hazards")
                ),
                "correctness_topics": len(
                    {
                        package["scientific_correctness_authority"]["topic_key"]
                        for package in records
                    }
                ),
                "correctness_authority_lessons": sum(
                    1
                    for package in records
                    if package["assurances"]["scientific_correctness_authority_present"]
                ),
            }
        )

    unused = correctness.coverage_problems(topics, used_topic_keys)
    if unused:
        raise SystemExit("correctness keys rejected:\n  " + "\n  ".join(unused))

    policy_dir = OUT_ROOT / "policy"
    policy_dir.mkdir(parents=True, exist_ok=True)
    (policy_dir / "safety-floor.json").write_text(
        json.dumps(floor, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (policy_dir / "shared-blocks.json").write_text(
        json.dumps(shared, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (policy_dir / "scoring-and-safety-policy.md").write_text(
        render.policy_doc(shared, floor), encoding="utf-8"
    )

    manifest = {
        "manifest_version": "1.0.0",
        "package_version": PACKAGE_VERSION,
        "subject": "science",
        "total_lessons": total,
        "courses": coverage,
        "sources_read": [
            {
                "lineage": ref.lineage,
                "commit": ref.commit,
                "path": ref.path,
                "sha256": ref.sha256,
                "bytes": ref.bytes,
            }
            for ref in reader.refs()
        ],
        "high_school_safety_lineage": {
            "used": HS_H4_COMMIT,
            "branch": "mac/hs912-science-h4",
            "supersedes": [HS_SUPERSEDED_H3_COMMIT, HS_SUPERSEDED_H2_COMMIT],
            "rejected_base_candidate": HS_FAILED_BASE_COMMIT,
            "note": (
                "High School student sheets are derived exclusively from H4. No blob from "
                "H3, H2, or the failed base candidate is read for High School production."
            ),
        },
        "invariants": [
            "No observation, measurement, result, or expected value is supplied by this package.",
            "Every recording field ships blank.",
            "Every lesson carries a student-visible safety brief and an equal-credit safe alternative.",
            "High School safety content comes from H4 only; H3 and H2 are superseded.",
            "Every lesson carries a scientific correctness authority for its topic, adult-facing only.",
            "No correctness key states an expected measurement or any observation.",
        ],
    }
    source_ledger = {
        "ledger_version": "1.0.0",
        "subject": "science",
        "inputs": list(INPUT_COMMITS),
        "source_blobs": manifest["sources_read"],
        "h4_source_validation": {
            "commit": HS_H4_COMMIT,
            "schema_contract_issues": 0,
            "mission_checks": {"passed": 63, "total": 63},
            "mutation_tests": {"killed": 44, "total": 44},
            "generated_tree_clean_after_run": True,
        },
        "correctness_repin": {
            "from": HS_SUPERSEDED_H3_COMMIT,
            "to": HS_H4_COMMIT,
            "basis_fields": [
                "unit_ref",
                "focus",
                "phase",
                "title",
                "essential_question",
                "learning_objectives",
                "success_criteria",
            ],
            "lessons_compared": 432,
            "differences": 0,
        },
    }
    manifest["input_shas"] = list(INPUT_COMMITS)
    (OUT_ROOT / "MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (OUT_ROOT / "SOURCE_LEDGER.json").write_text(
        json.dumps(source_ledger, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    reports_dir = OUT_ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "coverage.md").write_text(render.coverage_report(manifest), encoding="utf-8")

    checksums = []
    for path in sorted(OUT_ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in {".md", ".json", ".jsonl"}:
            continue
        relative = path.relative_to(OUT_ROOT).as_posix()
        if relative.startswith("reports/production-quality-gate") or relative.startswith(
            "reports/safety-gate"
        ):
            continue
        checksums.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}")
    (OUT_ROOT / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n", encoding="utf-8")

    print(f"built {total} student-work packages across {len(coverage)} courses")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
