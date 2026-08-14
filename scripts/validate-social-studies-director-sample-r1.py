#!/usr/bin/env python3
"""Validate the one Social Studies R1 sample without touching the corpus."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
LESSON_ID = "ma-g5-social-studies-u08-l03"
REGISTRY_INPUT_SHA = "50359f17d16f39272daaf33899dd17fce63ccc7e"
SCHEMA_PATH = ROOT / "docs/curriculum-quality/social-studies/SOCIAL_STUDIES_LESSON_CONTRACT_R1.schema.json"
PACKAGE_PATH = ROOT / f"docs/curriculum-quality/social-studies/sample-r1/{LESSON_ID}.package.json"
PREVIEW_CONTENT_PATH = ROOT / "src/study/family-pilot/social-studies-director-preview/content.ts"
CANONICAL_LESSONS_PATH = ROOT / "curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/social-studies/lessons.jsonl"
REGISTRY_PATH = "curriculum-production/source-resolution/social-studies/source-registry.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_registry() -> dict:
    raw = subprocess.check_output(
        ["git", "show", f"{REGISTRY_INPUT_SHA}:{REGISTRY_PATH}"],
        cwd=ROOT,
        text=True,
    )
    return json.loads(raw)


def all_refs(value: object, key: str) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for child_key, child_value in value.items():
            if child_key == key:
                if isinstance(child_value, str):
                    found.add(child_value)
                elif isinstance(child_value, list):
                    found.update(item for item in child_value if isinstance(item, str))
            found.update(all_refs(child_value, key))
    elif isinstance(value, list):
        for child in value:
            found.update(all_refs(child, key))
    return found


def main() -> None:
    schema = json.loads(SCHEMA_PATH.read_text())
    package = json.loads(PACKAGE_PATH.read_text())
    errors = sorted(Draft202012Validator(schema).iter_errors(package), key=lambda error: list(error.path))
    require(not errors, "Schema errors:\n" + "\n".join(f"/{'/'.join(map(str, error.path))}: {error.message}" for error in errors))

    canonical_lesson = next(
        json.loads(line)
        for line in CANONICAL_LESSONS_PATH.read_text().splitlines()
        if json.loads(line)["lesson_id"] == LESSON_ID
    )
    require(package["lesson_id"] == canonical_lesson["lesson_id"], "Lesson ID drifted from canonical custody")
    require(package["grade"] == canonical_lesson["grade"], "Grade drifted from canonical custody")
    require(package["subject"] == canonical_lesson["subject"], "Subject drifted from canonical custody")
    require(package["authored_phase"] == canonical_lesson["phase"], "Authored phase drifted from canonical custody")
    require(
        [entry["legacy_label"] for entry in package["standard_refs"]] == canonical_lesson["standards"],
        "Standards labels drifted from canonical custody",
    )
    require(all(entry["mapping_status"] == "unverified" for entry in package["standard_refs"]), "Legacy standard labels were silently promoted")

    registry = load_registry()
    registry_sources = registry["sources"]
    lesson_registry = next(entry for entry in registry["lessons"] if entry["lessonRef"] == LESSON_ID)
    expected_sources = set(lesson_registry["anchorSourceKeys"])
    package_sources = set(package["tutor_manifest"]["source_refs"])
    require(package_sources == expected_sources, "Sample does not preserve the canonical lesson source set")
    require(all(source_ref in registry_sources for source_ref in all_refs(package, "source_refs")), "Package contains an invented source ref")

    preview_content = PREVIEW_CONTENT_PATH.read_text()
    for source_ref in sorted(expected_sources):
        record = registry_sources[source_ref]
        require(source_ref in preview_content, f"Preview omits canonical source key {source_ref}")
        require(record["url"] in preview_content, f"Preview URL drifted for {source_ref}")
        require(record["title"] in preview_content, f"Preview title drifted for {source_ref}")
    for forbidden in ("acceptable_evidence", "scoring_guidance", "correctAnswer", "answerKey", "answerIndex"):
        require(forbidden not in preview_content, f"Protected answer authority leaked into learner preview: {forbidden}")

    task_ids = {task["task_id"] for task in package["tasks"]}
    model_ids = {model["model_id"] for model in package["model_analyses"]}
    scored_task_ids = {task["task_id"] for task in package["tasks"] if task["scored"]}
    authority_ids = {entry["task_ref"] for entry in package["protected_content"]["adult_authority"]}
    require(scored_task_ids == authority_ids, "Every scored task must have one protected adult-authority entry")
    require(all_refs(package["task_collections"], "guided_task_refs") <= task_ids, "Guided collection contains an unresolved task ref")
    for path in package["remediation_paths"]:
        require(path["model_ref"] in model_ids, "Remediation model ref is unresolved")
        require(set(path["guided_task_refs"] + path["fresh_retry_task_refs"] + path["mastery_task_refs"]) <= task_ids, "Remediation task ref is unresolved")
        require(not path["repeats_failed_task_only"], "Remediation repeats only the failed task")

    require(len(package["task_collections"]["guided_task_refs"]) >= 2, "Guided support does not fade across two tasks")
    require(len(package["mastery_evidence"]) >= 2, "Fresh mastery requires at least two evidence points")
    require(package["tutor_manifest"]["may_invent_historical_facts"] is False, "Tutor may invent facts")
    require(package["tutor_manifest"]["may_invent_sources"] is False, "Tutor may invent sources")
    require(package["tutor_manifest"]["may_write_or_rewrite_graded_work"] is False, "Tutor may write graded work")

    print("SOCIAL_STUDIES_DIRECTOR_SAMPLE_R1: 18/18 validation groups passed")


if __name__ == "__main__":
    main()
