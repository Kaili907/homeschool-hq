#!/usr/bin/env python3
"""Reproduce the Science learner-depth audit evidence.

Read-only with respect to curriculum. The script reads the admitted release,
the final Science packages, and the separately bound assessment projections;
it writes audit evidence only beside this file.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median


AUDIT_DIR = Path(__file__).resolve().parent
REPO_ROOT = AUDIT_DIR.parents[3]
SCIENCE_ROOT = REPO_ROOT / "curriculum-production/final/science"
BINDINGS_PATH = REPO_ROOT / "curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl"
ASSESSMENT_BINDINGS_PATH = REPO_ROOT / "curriculum-release-admitted/family-pilot-r1/assessment-bindings.json"
ASSESSMENT_ROOT = REPO_ROOT / "curriculum-production/final/assessments"

PHASE_TO_TYPE = {
    "Launch and diagnostic": "concept",
    "Concept model A": "concept",
    "Concept model B": "concept",
    "Guided practice A": "concept",
    "Guided practice B": "concept",
    "Independent application A": "mastery",
    "Investigation or close reading": "inquiry/investigation",
    "Investigation": "lab/activity",
    "Reteach and varied practice": "remediation",
    "Performance task build": "assessment/project",
    "Synthesis and review": "review",
    "Unit assessment": "assessment/project",
    "Correction and reflection": "remediation",
}

GENERATOR_FAMILY = {
    ("g34-committed", "elementary"): "g34-k8-elementary",
    ("canonical-1.0.0", "elementary"): "canonical-k8-elementary",
    ("canonical-1.0.0", "middle"): "canonical-k8-middle",
    ("hs912-science-h4", "high"): "h4-high-school",
}

ENGINEERING_RE = re.compile(r"engineer|design|criteria|constraint|prototype|solution|optim", re.I)
GRAPH_RE = re.compile(r"\bgraph(?:s|ed|ing)?\b", re.I)
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[’'-][A-Za-z0-9]+)*")


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def digest(value) -> str:
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def words(text: str) -> int:
    return len(WORD_RE.findall(text))


def section_words(markdown: str, heading: str, next_heading: str) -> int:
    start = markdown.find(heading)
    if start < 0:
        return 0
    end = markdown.find(next_heading, start + len(heading))
    return words(markdown[start:] if end < 0 else markdown[start:end])


def round_stats(values: list[int]) -> dict:
    return {
        "min": min(values),
        "median": round(median(values), 1),
        "mean": round(mean(values), 1),
        "max": max(values),
    }


def load_packages() -> list[dict]:
    records: list[dict] = []
    for path in sorted((SCIENCE_ROOT / "packages").glob("*/work-packages.jsonl")):
        records.extend(read_jsonl(path))
    return records


def load_active_bindings() -> list[dict]:
    return [row for row in read_jsonl(BINDINGS_PATH) if row.get("subject") == "science"]


def assessment_file(binding: dict, adult: bool = False) -> Path:
    ref = binding["scoringAuthorityRef" if adult else "productionPackageRef"]
    return REPO_ROOT / ref.split(":", 1)[1]


def package_evidence(package: dict) -> dict:
    lesson_id = package["lesson_id"]
    course_id = package["course_id"]
    student_path = SCIENCE_ROOT / "packages" / course_id / "student-sheets" / f"{lesson_id}.md"
    scoring_path = SCIENCE_ROOT / "packages" / course_id / "scoring" / f"{lesson_id}.md"
    student = student_path.read_text()
    scoring = scoring_path.read_text()
    content = package["executable_content"]
    primary = content.get("primary_route", {})
    alternative = content.get("equal_credit_route", {})
    alternative_input = alternative.get("input", {})
    authority = package.get("scientific_correctness_authority", {})
    brief = content.get("science_brief", [])
    evidence_rows = [row.get("information", "") for row in content.get("supplied_evidence", {}).get("rows", [])]
    question_kinds = [question["kind"] for question in package.get("analysis_questions", [])]
    model_rows = alternative_input.get("rows", []) if alternative_input.get("kind") == "MODEL_OUTPUT" else []
    text_for_engineering = " ".join(
        [
            package.get("focus", ""),
            package.get("unit_title", ""),
            package.get("essential_question", ""),
            content.get("unit_performance_task", ""),
        ]
    )
    text_for_graph = " ".join(
        [
            alternative_input.get("task", ""),
            *[q.get("prompt", "") for q in package.get("analysis_questions", [])],
        ]
    )
    tutor_fields = {
        key: key in package
        for key in (
            "tutor_metadata",
            "prerequisite_ids",
            "misconception_codes",
            "response_schema",
            "attempt_history_contract",
            "next_lesson_routes",
        )
    }
    return {
        "lesson_id": lesson_id,
        "course_id": course_id,
        "grade": package["grade"],
        "band": package["band"],
        "source_lineage": package["source"]["lineage"],
        "generator_family": GENERATOR_FAMILY[(package["source"]["lineage"], package["band"])],
        "unit_number": package["unit_number"],
        "day_in_unit": package["day_in_unit"],
        "phase": package["phase"],
        "audit_type": PHASE_TO_TYPE[package["phase"]],
        "work_type": package["work_type"],
        "focus": package["focus"],
        "question_count": len(question_kinds),
        "question_kinds": "|".join(question_kinds),
        "science_brief_rows": len(brief),
        "structured_vocabulary_field": "vocabulary" in package,
        "worked_example_payload": any(key in content for key in ("worked_example", "worked_model", "demonstration")),
        "brief_duplicates_evidence": brief == evidence_rows,
        "data_bearing": package["data_bearing"],
        "primary_route_kind": primary.get("kind", ""),
        "model_data_rows": len(model_rows),
        "graph_interpretation_requested": bool(GRAPH_RE.search(text_for_graph)),
        "engineering_focus": bool(ENGINEERING_RE.search(package.get("focus", ""))),
        "engineering_language": bool(ENGINEERING_RE.search(text_for_engineering)),
        "remediation_route_count": len(package.get("remediation", {}).get("adult_routes", [])),
        "mastery_rule_present": bool(package.get("remediation", {}).get("mastery_rule_verbatim")),
        "expected_reasoning_present": bool(package.get("expected_reasoning", {}).get("per_question")),
        "student_visible_safety": package.get("safety_brief", {}).get("student_visible", False),
        "hazard_count": len(package.get("safety_brief", {}).get("hazards", [])),
        "safe_order_steps": len(package.get("safety_brief", {}).get("safe_order", [])),
        "stop_condition_count": len(package.get("guardian_record", {}).get("stop_conditions", [])),
        "supervision_level": package.get("safety_brief", {}).get("supervision_level", ""),
        "correctness_authority_present": bool(authority),
        "correctness_adult_only": authority.get("adult_facing_only") is True,
        "adult_key_heading_on_learner_sheet": "## Scientific correctness authority for this topic" in student,
        "learner_sheet_words": words(student),
        "safety_section_words": section_words(
            student,
            "## Safety — read this before you touch anything",
            "## The science information and exact work for this lesson",
        ),
        "analysis_section_words": section_words(student, "## Analysis questions", "## How this is scored"),
        "science_payload_hash": digest(
            {
                "brief": brief,
                "case": content.get("case", {}),
                "evidence": content.get("supplied_evidence", {}),
            }
        ),
        "model_payload_hash": digest(alternative_input) if model_rows else "",
        "phase_direction": content.get("bound_task", {}).get("phase_directions", ""),
        "tutor_structured_fields_present": sum(tutor_fields.values()),
    }


def write_csv(path: Path, rows: list[dict], fieldnames: list[str] | None = None) -> None:
    if not rows:
        raise RuntimeError(f"refusing to write empty evidence file: {path}")
    names = fieldnames or list(rows[0])
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=names, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def count_rows(rows: list[dict], key: str) -> dict[str, int]:
    return dict(sorted(Counter(str(row[key]) for row in rows).items()))


def assessment_evidence(bindings: list[dict]) -> tuple[list[dict], dict]:
    science = [row for row in bindings if row.get("subject") == "science"]
    rows: list[dict] = []
    for binding in sorted(science, key=lambda item: item["assessmentRef"]):
        learner = json.loads(assessment_file(binding).read_text())
        adult = json.loads(assessment_file(binding, adult=True).read_text())
        kinds = [task["kind"] for task in learner.get("learnerTasks", [])]
        learner_task_text = "\n".join(task.get("prompt", "") for task in learner.get("learnerTasks", []))
        rows.append(
            {
                "assessment_ref": binding["assessmentRef"],
                "course_ref": binding.get("courseRef", binding.get("releaseSlotId", "")),
                "grade": binding["grade"],
                "state": binding["state"],
                "response_mode": learner.get("responseMode", ""),
                "task_count": len(kinds),
                "task_kinds": "|".join(kinds),
                "metadata_ref_present": learner.get("provenance", {}).get("metadataRef") is not None,
                "learner_material_ref": learner.get("provenance", {}).get("learnerMaterialRef", ""),
                "ready": learner.get("productionReadiness", {}).get("status") == "READY",
                "answer_material_included": learner.get("productionReadiness", {}).get("answerMaterialIncluded") is True,
                "embedded_science_brief_or_bound_data": any(
                    marker in learner_task_text
                    for marker in ("Science brief:", "Complete reference-evidence", "Evidence ID", "MODEL OUTPUT")
                ),
                "adult_authority_kind": adult.get("kind", ""),
                "adult_completion_authority_present": adult.get("completionAuthority") is not None,
                "assessor_boundary": adult.get("assessorBoundary", ""),
            }
        )
    summary = {
        "count": len(rows),
        "bound": sum(row["state"] == "BOUND" for row in rows),
        "ready": sum(row["ready"] for row in rows),
        "answer_material_included": sum(row["answer_material_included"] for row in rows),
        "embedded_science_brief_or_bound_data": sum(row["embedded_science_brief_or_bound_data"] for row in rows),
        "metadata_ref_present": sum(row["metadata_ref_present"] for row in rows),
        "adult_completion_authority_present": sum(row["adult_completion_authority_present"] for row in rows),
        "task_shape_counts": dict(sorted(Counter(row["task_kinds"] for row in rows).items())),
    }
    return rows, summary


def grouped_summary(rows: list[dict], key: str) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        groups[str(row[key])].append(row)
    result = []
    for value, group in sorted(groups.items()):
        result.append(
            {
                key: value,
                "lessons": len(group),
                "courses": len({row["course_id"] for row in group}),
                "concept_model_lessons": sum(row["phase"].startswith("Concept model") for row in group),
                "worked_example_payloads": sum(row["worked_example_payload"] for row in group),
                "numeric_or_categorical_model_tables": sum(row["model_data_rows"] > 0 for row in group),
                "physical_lab_routes": sum(row["primary_route_kind"] == "H4_PHYSICAL_INVESTIGATION" for row in group),
                "document_inquiry_routes": sum(row["primary_route_kind"] == "DOCUMENT_INVESTIGATION" for row in group),
                "graph_requests": sum(row["graph_interpretation_requested"] for row in group),
                "engineering_language_lessons": sum(row["engineering_language"] for row in group),
                "engineering_focus_lessons": sum(row["engineering_focus"] for row in group),
                "learner_sheet_words_mean": round(mean(row["learner_sheet_words"] for row in group), 1),
                "safety_section_words_mean": round(mean(row["safety_section_words"] for row in group), 1),
                "analysis_section_words_mean": round(mean(row["analysis_section_words"] for row in group), 1),
            }
        )
    return result


def main() -> None:
    packages = load_packages()
    active = load_active_bindings()
    package_ids = [row["lesson_id"] for row in packages]
    active_ids = [row["lessonRef"] for row in active]
    if len(packages) != 972 or len(active) != 972:
        raise RuntimeError(f"science universe drift: packages={len(packages)} active={len(active)}")
    if len(set(package_ids)) != len(package_ids) or len(set(active_ids)) != len(active_ids):
        raise RuntimeError("duplicate lesson identifiers in active/package universe")
    if set(package_ids) != set(active_ids):
        raise RuntimeError("active Science bindings and final Science packages do not match")

    rows = sorted((package_evidence(package) for package in packages), key=lambda row: row["lesson_id"])
    assessment_rows, assessment_summary = assessment_evidence(json.loads(ASSESSMENT_BINDINGS_PATH.read_text()))

    science_payload_groups = Counter(row["science_payload_hash"] for row in rows)
    model_payload_groups = Counter(row["model_payload_hash"] for row in rows if row["model_payload_hash"])
    question_shapes = Counter(row["question_kinds"] for row in rows)
    phase_directions = Counter(row["phase_direction"] for row in rows)
    course_summary = grouped_summary(rows, "course_id")
    family_summary = grouped_summary(rows, "generator_family")

    summary = {
        "audit": {
            "base": "56dd8a45fee1ca03dd5f83e1466c9f081824d6b9",
            "branch": "mac/science-depth-audit-r1",
            "scope": "all admitted active Science lesson bindings plus linked bound Science assessments",
            "curriculum_modified": False,
        },
        "universe": {
            "active_lessons": len(rows),
            "active_binding_set_equals_package_set": True,
            "courses": len({row["course_id"] for row in rows}),
            "grades": sorted({row["grade"] for row in rows}),
            "source_lineages": count_rows(rows, "source_lineage"),
            "generator_families": count_rows(rows, "generator_family"),
            "phases": count_rows(rows, "phase"),
            "audit_types": count_rows(rows, "audit_type"),
            "work_types": count_rows(rows, "work_type"),
        },
        "depth": {
            "science_brief_present": sum(row["science_brief_rows"] > 0 for row in rows),
            "science_brief_row_distribution": count_rows(rows, "science_brief_rows"),
            "structured_vocabulary_fields": sum(row["structured_vocabulary_field"] for row in rows),
            "concept_model_lessons": sum(row["phase"].startswith("Concept model") for row in rows),
            "concept_model_lessons_with_worked_example_payload": sum(
                row["phase"].startswith("Concept model") and row["worked_example_payload"] for row in rows
            ),
            "all_lessons_with_worked_example_payload": sum(row["worked_example_payload"] for row in rows),
            "brief_exactly_duplicates_evidence_table": sum(row["brief_duplicates_evidence"] for row in rows),
            "question_count_distribution": count_rows(rows, "question_count"),
            "question_kind_shapes": dict(sorted(question_shapes.items())),
            "distinct_question_kind_shapes": len(question_shapes),
            "universal_cross_cutting_question_instances": 4 * len(rows),
            "distinct_phase_directions": len(phase_directions),
            "phase_direction_counts": dict(sorted(phase_directions.items())),
            "data_bearing_lessons": sum(row["data_bearing"] for row in rows),
            "numeric_or_categorical_model_tables": sum(row["model_data_rows"] > 0 for row in rows),
            "graph_interpretation_requests": sum(row["graph_interpretation_requested"] for row in rows),
            "physical_lab_routes": sum(row["primary_route_kind"] == "H4_PHYSICAL_INVESTIGATION" for row in rows),
            "document_inquiry_routes": sum(row["primary_route_kind"] == "DOCUMENT_INVESTIGATION" for row in rows),
            "evidence_reasoning_metadata": sum(row["expected_reasoning_present"] for row in rows),
            "mastery_rules": sum(row["mastery_rule_present"] for row in rows),
            "remediation_routes_present": sum(row["remediation_route_count"] > 0 for row in rows),
            "remediation_route_count_distribution": count_rows(rows, "remediation_route_count"),
            "engineering_language_lessons": sum(row["engineering_language"] for row in rows),
            "engineering_focus_lessons": sum(row["engineering_focus"] for row in rows),
        },
        "duplication": {
            "distinct_science_case_payloads": len(science_payload_groups),
            "science_case_payload_group_sizes": dict(sorted(Counter(science_payload_groups.values()).items())),
            "distinct_hs_model_payloads": len(model_payload_groups),
            "hs_model_payload_group_sizes": dict(sorted(Counter(model_payload_groups.values()).items())),
        },
        "language": {
            "learner_sheet_words": round_stats([row["learner_sheet_words"] for row in rows]),
            "safety_section_words": round_stats([row["safety_section_words"] for row in rows]),
            "analysis_section_words": round_stats([row["analysis_section_words"] for row in rows]),
        },
        "safety_and_authority": {
            "student_visible_safety": sum(row["student_visible_safety"] for row in rows),
            "safe_order_present": sum(row["safe_order_steps"] > 0 for row in rows),
            "correctness_authority_present": sum(row["correctness_authority_present"] for row in rows),
            "correctness_marked_adult_only": sum(row["correctness_adult_only"] for row in rows),
            "adult_key_heading_on_learner_sheet": sum(row["adult_key_heading_on_learner_sheet"] for row in rows),
        },
        "tutor_metadata": {
            "expected_reasoning_present": sum(row["expected_reasoning_present"] for row in rows),
            "remediation_routes_present": sum(row["remediation_route_count"] > 0 for row in rows),
            "mastery_rules_present": sum(row["mastery_rule_present"] for row in rows),
            "packages_with_any_named_structured_tutor_field": sum(row["tutor_structured_fields_present"] > 0 for row in rows),
            "named_structured_fields_checked": [
                "tutor_metadata",
                "prerequisite_ids",
                "misconception_codes",
                "response_schema",
                "attempt_history_contract",
                "next_lesson_routes",
            ],
        },
        "linked_assessments": assessment_summary,
        "course_summary": course_summary,
        "generator_family_summary": family_summary,
    }

    write_csv(AUDIT_DIR / "lesson-evidence.csv", rows)
    write_csv(AUDIT_DIR / "course-summary.csv", course_summary)
    write_csv(AUDIT_DIR / "generator-family-summary.csv", family_summary)
    write_csv(AUDIT_DIR / "assessment-evidence.csv", assessment_rows)
    (AUDIT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")

    print(json.dumps({
        "active_lessons": len(rows),
        "linked_assessments": len(assessment_rows),
        "lesson_evidence": str(AUDIT_DIR / "lesson-evidence.csv"),
        "summary": str(AUDIT_DIR / "summary.json"),
    }, indent=2))


if __name__ == "__main__":
    main()
