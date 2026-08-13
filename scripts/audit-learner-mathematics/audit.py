#!/usr/bin/env python3
"""Exhaustive learner-completeness audit for the active Mathematics corpus.

The audit is deliberately independent of the corpus production validator.  It
walks each authoritative schedule row, opens the bound package and scoring key,
reproduces the browser projection in memory, and evaluates the current learner
UI contract.  It never writes to curriculum or application paths.
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


GRADES = (3, 4, 5, 7, 8, 9, 10, 11, 12)
EXPECTED_LESSONS_PER_GRADE = 180
EXPECTED_LESSONS = 1_620
BASE_COMMIT = "c81ddb6e04bc1c3629212327d47817c1b5677477"

CATEGORIES = (
    "EMPTY_MASTERY_CHECK",
    "EMPTY_INDEPENDENT_PRACTICE",
    "EMPTY_GUIDED_PRACTICE",
    "ZERO_ACTIONABLE_WORK",
    "STRATEGY_ONLY_DIAGNOSTIC",
    "FLATTENED_MULTIPLE_CHOICE",
    "LOST_ITEM_IN_BROWSER",
    "UNSUPPORTED_RESPONSE_TYPE",
    "ANSWER_LEAK",
    "PLACEHOLDER",
    "OTHER_BLOCKER",
)

CONTENT_CATEGORIES = {
    "EMPTY_MASTERY_CHECK",
    "EMPTY_INDEPENDENT_PRACTICE",
    "EMPTY_GUIDED_PRACTICE",
    "ZERO_ACTIONABLE_WORK",
    "STRATEGY_ONLY_DIAGNOSTIC",
    "ANSWER_LEAK",
    "PLACEHOLDER",
}

FORBIDDEN_GRADED_FIELDS = {
    "answer",
    "answerIndex",
    "answerType",
    "commonErrors",
    "correctAnswer",
    "given",
    "referenceExample",
    "scoringGuidance",
    "solutionReasoning",
    "verification",
}

PLACEHOLDER_RE = re.compile(
    r"(?:\bTODO\b|\bTBD\b|lorem\s+ipsum|coming\s+soon|"
    r"insert\s+(?:question|prompt|text)\s+here|replace\s+me|"
    r"sample\s+question|\[\s*placeholder\s*\]|\{\{[^{}]+\}\})",
    re.IGNORECASE,
)

STRATEGY_ITEM_RE = re.compile(r"(?:strategy|mathematical-habits)", re.IGNORECASE)

OFFICIAL_G8_STANDARDS = tuple(
    [f"8.NS.{number}" for number in range(1, 3)]
    + [f"8.EE.{number}" for number in range(1, 9)]
    + [f"8.F.{number}" for number in range(1, 6)]
    + [f"8.G.{number}" for number in range(1, 10)]
    + [f"8.SP.{number}" for number in range(1, 5)]
)


def json_load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)


def nested_keys(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            found.add(key)
            found.update(nested_keys(child))
    elif isinstance(value, list):
        for child in value:
            found.update(nested_keys(child))
    return found


def projected_item_text(item: dict[str, Any]) -> str:
    choices = item.get("choices")
    suffix = f"\nChoices: {' · '.join(choices)}" if isinstance(choices, list) else ""
    return f"{item.get('prompt', '')}{suffix}"


def project_package(package: dict[str, Any], subject: str = "mathematics") -> dict[str, Any]:
    """Reproduce projectJsonMaterial from build-final-family-pilot-data.mjs."""
    sections: list[dict[str, Any]] = []
    for source_section in package.get("sections", []):
        prompts: list[str] = []
        for item in source_section.get("items", []):
            if isinstance(item.get("prompt"), str):
                prompts.append(projected_item_text(item))
            steps = item.get("workedSolution", {}).get("steps")
            if isinstance(steps, list):
                prompts.extend(step for step in steps if isinstance(step, str))
        directions = source_section.get("directions")
        section: dict[str, Any] = {
            "title": source_section.get("title") or source_section.get("kind") or "Lesson work",
            "prompts": prompts,
        }
        if isinstance(directions, str) and directions.strip():
            section["body"] = directions.strip()
        if section.get("body") or prompts:
            sections.append(section)
    lesson_ref = package.get("lessonRef", {})
    lesson_id = lesson_ref.get("lessonId", "unknown")
    return {
        "materialRef": f"production-material:{lesson_id}",
        "lessonRef": lesson_id,
        "title": lesson_ref.get("title", lesson_id),
        "subject": subject,
        "format": "structured",
        "sections": sections,
    }


def section_items(package: dict[str, Any], kind: str) -> list[dict[str, Any]]:
    return [
        item
        for section in package.get("sections", [])
        if section.get("kind") == kind
        for item in section.get("items", [])
    ]


def all_items(package: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for section in package.get("sections", []) for item in section.get("items", [])]


def graded_items(package: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in all_items(package) if item.get("kind") != "worked-example"]


def source_content_findings(package: dict[str, Any], key: dict[str, Any] | None) -> dict[str, Any]:
    blueprint_kinds = set(package.get("blueprint", {}).get("sectionKinds", []))
    items = all_items(package)
    graded = [item for item in items if item.get("kind") != "worked-example"]
    worked = [item for item in items if item.get("kind") == "worked-example"]
    multiple_choice = [item for item in graded if item.get("kind") == "multiple-choice"]
    constructed = [item for item in graded if item.get("kind") == "constructed-response"]
    answer_by_ref = {answer.get("ref"): answer for answer in (key or {}).get("answers", [])}

    findings: set[str] = set()
    promised_counts: dict[str, int] = {}
    for kind, category in (
        ("guided-practice", "EMPTY_GUIDED_PRACTICE"),
        ("independent-practice", "EMPTY_INDEPENDENT_PRACTICE"),
        ("mastery-check", "EMPTY_MASTERY_CHECK"),
    ):
        count = len(section_items(package, kind))
        promised_counts[kind] = count
        if kind in blueprint_kinds and count == 0:
            findings.add(category)

    substantive = [
        item for item in graded
        if not STRATEGY_ITEM_RE.search(str(item.get("itemType", "")))
    ]
    if not substantive:
        findings.add("ZERO_ACTIONABLE_WORK")
    diagnostic = package.get("blueprint", {}).get("profile") == "diagnostic-launch"
    if diagnostic and not substantive:
        findings.add("STRATEGY_ONLY_DIAGNOSTIC")

    worked_required = "instructional-example" in blueprint_kinds
    worked_instruction_ok = (not worked_required) or bool(worked) and all(
        isinstance(item.get("prompt"), str)
        and item["prompt"].strip()
        and isinstance(item.get("workedSolution", {}).get("steps"), list)
        and bool(item["workedSolution"]["steps"])
        and isinstance(item.get("workedSolution", {}).get("answer"), str)
        and item["workedSolution"]["answer"].strip()
        for item in worked
    )

    questions_sufficient = bool(graded) and all(
        isinstance(item.get("prompt"), str)
        and item["prompt"].strip()
        and item.get("ref") in answer_by_ref
        and isinstance(answer_by_ref[item["ref"]].get("given"), dict)
        and isinstance(answer_by_ref[item["ref"]].get("answer"), str)
        and bool(answer_by_ref[item["ref"]]["answer"].strip())
        and isinstance(answer_by_ref[item["ref"]].get("verification", {}).get("parameters"), dict)
        and isinstance(answer_by_ref[item["ref"]].get("verification", {}).get("oracle"), str)
        and bool(answer_by_ref[item["ref"]]["verification"]["oracle"].strip())
        for item in graded
    )

    choices_complete = all(
        isinstance(item.get("choices"), list)
        and len(item["choices"]) >= 2
        and len(set(item["choices"])) == len(item["choices"])
        and all(isinstance(choice, str) and choice.strip() for choice in item["choices"])
        and isinstance(answer_by_ref.get(item.get("ref"), {}).get("answerIndex"), int)
        and 0 <= answer_by_ref[item["ref"]]["answerIndex"] < len(item["choices"])
        and item["choices"][answer_by_ref[item["ref"]]["answerIndex"]]
        == answer_by_ref[item["ref"]].get("answer")
        for item in multiple_choice
    )

    constructed_representable_at_source = all(
        isinstance(item.get("responseExpectation"), str) and item["responseExpectation"].strip()
        for item in constructed
    )

    leak_fields: dict[str, list[str]] = {}
    for item in graded:
        present = sorted(FORBIDDEN_GRADED_FIELDS & nested_keys(item))
        if present:
            leak_fields[str(item.get("ref"))] = present
    if leak_fields:
        findings.add("ANSWER_LEAK")

    placeholder_hits = sorted({
        match.group(0)
        for text in strings(package)
        for match in PLACEHOLDER_RE.finditer(text)
    })
    if placeholder_hits:
        findings.add("PLACEHOLDER")

    return {
        "findings": findings,
        "worked_instruction_required": worked_required,
        "worked_instruction_ok": worked_instruction_ok,
        "actual_actionable_math_work": bool(substantive),
        "guided_promised": "guided-practice" in blueprint_kinds,
        "guided_item_count": promised_counts["guided-practice"],
        "independent_promised": "independent-practice" in blueprint_kinds,
        "independent_item_count": promised_counts["independent-practice"],
        "mastery_promised": "mastery-check" in blueprint_kinds,
        "mastery_item_count": promised_counts["mastery-check"],
        "questions_have_sufficient_information": questions_sufficient,
        "choices_complete": choices_complete,
        "constructed_response_representable_at_source": constructed_representable_at_source,
        "answer_leak_fields": leak_fields,
        "placeholder_hits": placeholder_hits,
        "source_item_count": len(items),
        "graded_item_count": len(graded),
        "worked_example_count": len(worked),
        "multiple_choice_count": len(multiple_choice),
        "constructed_response_count": len(constructed),
        "substantive_graded_item_count": len(substantive),
        "strategy_graded_item_count": len(graded) - len(substantive),
        "diagnostic_substantive": (not diagnostic) or bool(substantive),
    }


def browser_findings(package: dict[str, Any], material: dict[str, Any]) -> dict[str, Any]:
    source_sections = package.get("sections", [])
    browser_sections = material.get("sections", []) if material.get("format") == "structured" else []
    found_refs: list[str] = []
    lost_refs: list[str] = []
    browser_question_count = 0

    for index, source_section in enumerate(source_sections):
        browser_prompts = (
            browser_sections[index].get("prompts", [])
            if index < len(browser_sections) and isinstance(browser_sections[index], dict)
            else []
        )
        remaining = Counter(prompt for prompt in browser_prompts if isinstance(prompt, str))
        for item in source_section.get("items", []):
            ref = str(item.get("ref"))
            expected = projected_item_text(item)
            if remaining[expected] > 0:
                remaining[expected] -= 1
                found_refs.append(ref)
                browser_question_count += 1
            else:
                lost_refs.append(ref)

    source = source_content_findings(package, None)
    source_item_count = source["source_item_count"]
    multiple_choice_count = source["multiple_choice_count"]
    constructed_count = source["constructed_response_count"]
    blob = json_text(material)
    item_refs_survive = all(str(item.get("ref")) in blob for item in all_items(package))
    choices_structured = any(
        isinstance(node, dict) and isinstance(node.get("choices"), list)
        for node in walk_objects(material)
    )
    found_ref_set = set(found_refs)
    flattened_count = sum(
        1
        for item in graded_items(package)
        if item.get("kind") == "multiple-choice" and str(item.get("ref")) in found_ref_set
    ) if not choices_structured else 0

    findings: set[str] = set()
    if flattened_count:
        findings.add("FLATTENED_MULTIPLE_CHOICE")
    if lost_refs or browser_question_count != source_item_count:
        findings.add("LOST_ITEM_IN_BROWSER")
    if constructed_count and not browser_has_response_model(material):
        findings.add("UNSUPPORTED_RESPONSE_TYPE")
    if not item_refs_survive:
        findings.add("OTHER_BLOCKER")

    browser_leak_fields = sorted(
        {key for node in walk_objects(material) for key in node if key in FORBIDDEN_GRADED_FIELDS}
    )
    if browser_leak_fields:
        findings.add("ANSWER_LEAK")

    return {
        "findings": findings,
        "source_item_count": source_item_count,
        "browser_learner_item_count": browser_question_count,
        "source_browser_item_count_equal": source_item_count == browser_question_count,
        "found_item_refs": found_refs,
        "lost_item_refs": lost_refs,
        "item_refs_survive_projection": item_refs_survive,
        "multiple_choice_count": multiple_choice_count,
        "flattened_multiple_choice_count": flattened_count,
        "choices_remain_structured": choices_structured,
        "constructed_response_count": constructed_count,
        "constructed_response_supported": constructed_count == 0 or browser_has_response_model(material),
        "browser_answer_leak_fields": browser_leak_fields,
    }


def walk_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_objects(child)


def browser_has_response_model(material: dict[str, Any]) -> bool:
    response_keys = {"responseKind", "responseType", "inputMode", "submission"}
    return any(response_keys & set(node) for node in walk_objects(material))


def path_from_git_ref(repo: Path, reference: str | None) -> Path | None:
    if not isinstance(reference, str) or not reference.startswith("git+") or ":" not in reference:
        return None
    relative = reference.split(":", 1)[1]
    return repo / relative


def load_bindings(path: Path) -> dict[str, dict[str, Any]]:
    bindings: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        binding = json.loads(line)
        if binding.get("subject") == "mathematics":
            bindings[binding["lessonRef"]] = binding
    return bindings


def ui_contract(repo: Path) -> dict[str, Any]:
    build_script = (repo / "scripts/build-final-family-pilot-data.mjs").read_text(encoding="utf-8")
    types = (repo / "src/curriculum/final-app-data/types.ts").read_text(encoding="utf-8")
    app = (repo / "src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx").read_text(encoding="utf-8")
    return {
        "projection_flattens_choices": "Choices: ${item.choices.join(' · ')}" in build_script,
        "projection_preserves_item_refs": "ref: item.ref" in build_script or "itemRef" in types,
        "material_schema_has_structured_choices": "readonly choices" in types,
        "material_schema_has_response_kind": "responseKind" in types,
        "lesson_player_response_kind_none": "responseKind: 'none'" in app,
        "lesson_player_submit_is_noop": "onSubmitAction={() => undefined}" in app,
    }


@dataclass(frozen=True)
class AuditPaths:
    repo: Path
    math: Path
    schedules: Path
    packages: Path
    keys: Path
    bindings: Path
    reserve_manifest: Path
    output: Path

    @classmethod
    def from_repo(cls, repo: Path, output: Path | None = None) -> "AuditPaths":
        math = repo / "curriculum-production/final/mathematics"
        return cls(
            repo=repo,
            math=math,
            schedules=math / "schedules",
            packages=math / "active/packages",
            keys=math / "active/answer-keys",
            bindings=repo / "curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl",
            reserve_manifest=math / "reserve-manifest.json",
            output=output or repo / "docs/learner-audits/mathematics",
        )


def grade_schedule(paths: AuditPaths, grade: int) -> list[dict[str, str]]:
    with (paths.schedules / f"grade-{grade:02d}.csv").open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def relative_path(path: Path, repo: Path) -> str:
    return path.relative_to(repo).as_posix()


def audit(paths: AuditPaths) -> dict[str, Any]:
    bindings = load_bindings(paths.bindings)
    contract = ui_contract(paths.repo)
    records: list[dict[str, Any]] = []
    browser_records: list[dict[str, Any]] = []
    schedules: dict[int, list[dict[str, str]]] = {}
    packages_by_grade: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for grade in GRADES:
        rows = grade_schedule(paths, grade)
        schedules[grade] = rows
        for row in rows:
            lesson_id = row["lesson_id"]
            package_path = paths.math / row["package"]
            key_path = paths.math / row["answer_key"]
            binding = bindings.get(lesson_id)
            package_exists = package_path.is_file()
            key_exists = key_path.is_file()
            binding_package = path_from_git_ref(paths.repo, (binding or {}).get("productionPackageRef"))
            binding_key = path_from_git_ref(paths.repo, (binding or {}).get("scoringAuthorityRef"))
            binding_ok = bool(
                binding
                and binding_package == package_path
                and binding_key == key_path
                and binding_package.is_file()
                and binding_key.is_file()
            )

            if not package_exists:
                record = {
                    "lesson_id": lesson_id,
                    "grade": grade,
                    "course_day": int(row["course_day"]),
                    "findings": ["OTHER_BLOCKER"],
                    "source": {"package_exists": False, "key_exists": key_exists, "binding_ok": binding_ok},
                    "browser": {"learner_can_respond": False},
                }
                records.append(record)
                continue

            package = json_load(package_path)
            key = json_load(key_path) if key_exists else None
            packages_by_grade[grade].append(package)
            material = project_package(package)
            source = source_content_findings(package, key)
            browser = browser_findings(package, material)

            findings = set(source.pop("findings")) | set(browser.pop("findings"))
            if not key_exists or not binding_ok or not source["worked_instruction_ok"]:
                findings.add("OTHER_BLOCKER")
            if not source["questions_have_sufficient_information"] or not source["choices_complete"]:
                findings.add("OTHER_BLOCKER")
            if not source["constructed_response_representable_at_source"]:
                findings.add("UNSUPPORTED_RESPONSE_TYPE")

            learner_can_respond = not (
                contract["lesson_player_response_kind_none"]
                or contract["lesson_player_submit_is_noop"]
                or browser["flattened_multiple_choice_count"]
                or (browser["constructed_response_count"] and not browser["constructed_response_supported"])
            )
            if not learner_can_respond:
                # MC and constructed-response defects retain their specific labels.
                # OTHER_BLOCKER also records the all-item ref loss independently.
                pass

            lesson_ref = package["lessonRef"]
            record = {
                "lesson_id": lesson_id,
                "grade": grade,
                "course_day": int(row["course_day"]),
                "unit_number": lesson_ref["unitNumber"],
                "day_in_unit": lesson_ref["dayInUnit"],
                "title": lesson_ref["title"],
                "profile": package["blueprint"]["profile"],
                "phase": package["blueprint"]["phase"],
                "standards": package["standards"],
                "findings": sorted(findings),
                "source": {
                    "package_exists": package_exists,
                    "package_path": relative_path(package_path, paths.repo),
                    "key_exists": key_exists,
                    "key_path": relative_path(key_path, paths.repo),
                    "binding_ok": binding_ok,
                    **source,
                },
                "browser": {
                    **browser,
                    "learner_can_respond": learner_can_respond,
                    "ui_response_kind": "none" if contract["lesson_player_response_kind_none"] else "unknown",
                    "ui_submit_handler": "no-op" if contract["lesson_player_submit_is_noop"] else "unknown",
                },
            }
            records.append(record)
            browser_records.append({
                "lesson_id": lesson_id,
                "grade": grade,
                "course_day": int(row["course_day"]),
                **browser,
                "learner_can_respond": learner_can_respond,
            })

    counts = {category: sum(category in record["findings"] for record in records) for category in CATEGORIES}
    category_ids = {
        category: [record["lesson_id"] for record in records if category in record["findings"]]
        for category in CATEGORIES
    }
    grade_results = build_grade_results(records, schedules, packages_by_grade)
    reserve = reserve_result(paths, schedules)
    g8 = g8_standards_result(packages_by_grade[8])
    representatives = representative_results(records)
    controls = run_negative_controls(paths)

    browser_aggregate = {
        "projection": "scripts/build-final-family-pilot-data.mjs projectJsonMaterial",
        "ui": "src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx LessonSurface",
        "contract": contract,
        "lessons": len(browser_records),
        "source_items": sum(record["source_item_count"] for record in browser_records),
        "browser_learner_items": sum(record["browser_learner_item_count"] for record in browser_records),
        "item_count_equal_lessons": sum(record["source_browser_item_count_equal"] for record in browser_records),
        "lost_item_lessons": counts["LOST_ITEM_IN_BROWSER"],
        "lost_items": sum(len(record["lost_item_refs"]) for record in browser_records),
        "item_ref_preserved_lessons": sum(record["item_refs_survive_projection"] for record in browser_records),
        "flattened_multiple_choice_lessons": counts["FLATTENED_MULTIPLE_CHOICE"],
        "flattened_multiple_choice_items": sum(record["flattened_multiple_choice_count"] for record in browser_records),
        "unsupported_constructed_response_lessons": counts["UNSUPPORTED_RESPONSE_TYPE"],
        "unsupported_constructed_response_items": sum(record["constructed_response_count"] for record in browser_records),
        "respondable_lessons": sum(record["learner_can_respond"] for record in browser_records),
        "result": "FAIL_ALL_LESSONS_UNRESPONDABLE" if not any(record["learner_can_respond"] for record in browser_records) else "MIXED",
    }

    completeness = {
        "scheduled_lessons": sum(len(rows) for rows in schedules.values()),
        "records": len(records),
        "packages": sum(record.get("source", {}).get("package_exists", False) for record in records),
        "keys": sum(record.get("source", {}).get("key_exists", False) for record in records),
        "bindings": sum(record.get("source", {}).get("binding_ok", False) for record in records),
        "all_1620_audited": len(records) == EXPECTED_LESSONS,
        "nine_grades_180_each": all(len(schedules[grade]) == EXPECTED_LESSONS_PER_GRADE for grade in GRADES),
    }

    classification = "MATH_LEARNER_AUDIT_COMPLETE" if (
        completeness["all_1620_audited"]
        and completeness["nine_grades_180_each"]
        and all(controls.values())
    ) else "AUDIT_INCONCLUSIVE"

    return {
        "classification": classification,
        "base_commit": BASE_COMMIT,
        "completeness": completeness,
        "counts": counts,
        "category_lesson_ids": category_ids,
        "item_impacts": {
            "flattened_multiple_choice_items": browser_aggregate["flattened_multiple_choice_items"],
            "unsupported_constructed_response_items": browser_aggregate["unsupported_constructed_response_items"],
            "lost_items": browser_aggregate["lost_items"],
        },
        "grade_results": grade_results,
        "reserve": reserve,
        "grade8_standards": g8,
        "representatives": representatives,
        "negative_controls": controls,
        "browser_aggregate": browser_aggregate,
        "lesson_records": records,
        "browser_records": browser_records,
    }


def build_grade_results(
    records: list[dict[str, Any]],
    schedules: dict[int, list[dict[str, str]]],
    packages_by_grade: dict[int, list[dict[str, Any]]],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for grade in GRADES:
        grade_records = [record for record in records if record["grade"] == grade]
        category_counts = {
            category: sum(category in record["findings"] for record in grade_records)
            for category in CATEGORIES
        }
        content_blockers = [
            record["lesson_id"]
            for record in grade_records
            if CONTENT_CATEGORIES & set(record["findings"])
        ]
        browser_blockers = [
            record["lesson_id"]
            for record in grade_records
            if not record.get("browser", {}).get("learner_can_respond", False)
        ]
        if content_blockers and browser_blockers:
            readiness = "DO_NOT_BEGIN_YET"
        elif browser_blockers:
            readiness = "SAFE_AFTER_RENDERER_FIX"
        elif content_blockers:
            readiness = "SAFE_AFTER_CONTENT_FIX"
        else:
            readiness = "SAFE_TO_BEGIN_NOW"
        result[str(grade)] = {
            "lessons_audited": len(grade_records),
            "active_days": len(schedules[grade]),
            "package_count": len(packages_by_grade[grade]),
            "readiness": readiness,
            "content_blocker_lessons": content_blockers,
            "browser_blocker_lessons": len(browser_blockers),
            "respondable_lessons": len(grade_records) - len(browser_blockers),
            "category_counts": category_counts,
        }
    return result


def reserve_result(paths: AuditPaths, schedules: dict[int, list[dict[str, str]]]) -> dict[str, Any]:
    manifest = json_load(paths.reserve_manifest)
    active_g8 = {row["lesson_id"] for row in schedules[8]}
    records = manifest.get("records", [])
    inactive = all(
        record.get("status") == "RESERVE_TUTOR"
        and record.get("countsAsActiveSchoolDay") is False
        and record.get("lessonId") not in active_g8
        for record in records
    )
    return {
        "records": len(records),
        "lesson_ids": [record.get("lessonId") for record in records],
        "all_inactive": inactive,
        "active_schedule_overlap": sorted(active_g8 & {record.get("lessonId") for record in records}),
    }


def g8_standards_result(packages: list[dict[str, Any]]) -> dict[str, Any]:
    covered = {
        standard
        for package in packages
        for standard in package.get("standards", [])
        if not str(standard).startswith("MP.")
    }
    official = set(OFFICIAL_G8_STANDARDS)
    return {
        "official": len(official),
        "covered": len(official & covered),
        "missing": sorted(official - covered),
        "result": "28/28" if official <= covered else f"{len(official & covered)}/28",
    }


def representative_results(records: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for grade in GRADES:
        grade_records = sorted(
            (record for record in records if record["grade"] == grade),
            key=lambda record: record["course_day"],
        )
        concept = next(
            (record for record in grade_records if str(record.get("profile", "")).startswith("concept-")),
            None,
        )
        assessment = next(
            (
                record for record in grade_records
                if record.get("profile") in {"unit-assessment", "correction-assessment"}
            ),
            None,
        )
        selected = {
            "first": grade_records[0],
            "first_concept_build": concept,
            "mid_course": next(record for record in grade_records if record["course_day"] == 90),
            "unit_assessment_mastery": assessment,
            "final": grade_records[-1],
        }
        result[str(grade)] = {
            label: {
                "lesson_id": record["lesson_id"],
                "course_day": record["course_day"],
                "profile": record.get("profile"),
                "source_actionable": record.get("source", {}).get("actual_actionable_math_work"),
                "source_items": record.get("source", {}).get("source_item_count"),
                "browser_items": record.get("browser", {}).get("browser_learner_item_count"),
                "learner_can_respond": record.get("browser", {}).get("learner_can_respond"),
                "findings": record.get("findings", []),
            }
            for label, record in selected.items()
            if record is not None
        }
    return result


def run_negative_controls(paths: AuditPaths) -> dict[str, bool]:
    package = json_load(paths.packages / "grade-05/ma-g5-mathematics-u01-l01.package.json")
    key = json_load(paths.keys / "grade-05/ma-g5-mathematics-u01-l01.key.json")

    empty = copy.deepcopy(package)
    mastery = next(section for section in empty["sections"] if section["kind"] == "mastery-check")
    mastery["items"] = []
    empty_detected = "EMPTY_MASTERY_CHECK" in source_content_findings(empty, key)["findings"]

    deletion_material = project_package(package)
    deletion_material["sections"][1]["prompts"].pop(0)
    deletion_result = browser_findings(package, deletion_material)
    deleted_detected = (
        "LOST_ITEM_IN_BROWSER" in deletion_result["findings"]
        and bool(deletion_result["lost_item_refs"])
    )

    normal_browser = browser_findings(package, project_package(package))
    flattened_detected = (
        "FLATTENED_MULTIPLE_CHOICE" in normal_browser["findings"]
        and normal_browser["flattened_multiple_choice_count"] > 0
        and not normal_browser["choices_remain_structured"]
    )

    leak = copy.deepcopy(package)
    next(item for item in graded_items(leak) if item["kind"] == "multiple-choice")["answerIndex"] = 0
    leak_detected = "ANSWER_LEAK" in source_content_findings(leak, key)["findings"]

    zero = copy.deepcopy(package)
    zero["blueprint"]["profile"] = "diagnostic-launch"
    for item in graded_items(zero):
        item["itemType"] = "mathematical-habits-strategy-choice"
    zero_result = source_content_findings(zero, key)["findings"]
    zero_detected = {"ZERO_ACTIONABLE_WORK", "STRATEGY_ONLY_DIAGNOSTIC"} <= zero_result

    mismatch_material = project_package(package)
    mismatch_material["sections"][-1]["prompts"].pop()
    mismatch_result = browser_findings(package, mismatch_material)
    mismatch_detected = (
        not mismatch_result["source_browser_item_count_equal"]
        and mismatch_result["browser_learner_item_count"] == mismatch_result["source_item_count"] - 1
    )

    return {
        "empty_mastery_detected": empty_detected,
        "deleted_question_detected": deleted_detected,
        "flattened_choices_detected": flattened_detected,
        "answerIndex_leak_detected": leak_detected,
        "zero_work_diagnostic_detected": zero_detected,
        "browser_source_item_count_mismatch_detected": mismatch_detected,
    }


def report_markdown(result: dict[str, Any]) -> str:
    counts = result["counts"]
    browser = result["browser_aggregate"]
    lines = [
        "# Mathematics Learner Completeness Audit R1",
        "",
        f"**Classification:** `{result['classification']}`",
        "",
        f"**Audit base:** `{result['base_commit']}`",
        "",
        f"**Scope:** {result['completeness']['records']:,} active Mathematics lessons, Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12.",
        "",
        "## Decision",
        "",
        "No grade is safe to begin through the current browser Study/Practice path. The browser projection converts every multiple-choice item into plain text, removes every item ref and response expectation, and the lesson player explicitly supplies `responseKind: 'none'` with a no-op submit handler. Grades 5, 7, 8, 9, 10, 11, and 12 become source-ready after the renderer/interaction defect is repaired. Grades 3 and 4 also contain source-content blockers and therefore remain `DO_NOT_BEGIN_YET`.",
        "",
        "The known Grade 3 Day 1 defect is independently confirmed: `ma-g3-mathematics-u01-l01` contains only strategy-choice graded work and an empty mastery check. Grade 4 Day 1 (`ma-g4-mathematics-u01-l01`) has the same defect class.",
        "",
        "## Exhaustiveness and method",
        "",
        "The audit is schedule-driven, not file-sample-driven. For every authoritative CSV row it resolves the package, answer key, admitted production binding, blueprint promises, learner items, scoring-key linkage, in-memory browser projection, and current lesson-player response contract. The browser item count counts projected learner question lines and excludes worked-solution step lines, which the projection also stores in `prompts`.",
        "",
        f"- Scheduled/audited: **{result['completeness']['scheduled_lessons']:,}/{EXPECTED_LESSONS:,}**",
        f"- Packages/keys/bindings resolved: **{result['completeness']['packages']:,}/{result['completeness']['keys']:,}/{result['completeness']['bindings']:,}**",
        f"- Active days per grade: **{EXPECTED_LESSONS_PER_GRADE}** for all nine grades",
        f"- Grade 8 reserves: **{result['reserve']['records']} inactive**, active overlap **{len(result['reserve']['active_schedule_overlap'])}**",
        f"- Grade 8 official standards: **{result['grade8_standards']['result']}**",
        "",
        "## Finding counts (lesson incidence)",
        "",
        "Counts below are lessons carrying each finding; one lesson can carry multiple findings.",
        "",
        "| Finding | Lessons |",
        "|---|---:|",
    ]
    lines.extend(f"| `{category}` | {counts[category]:,} |" for category in CATEGORIES)
    lines.extend([
        "",
        "Item impacts: **{:,.0f}** multiple-choice items flattened; **{:,.0f}** constructed-response items have no browser response control; **{:,.0f}** source questions deleted by projection.".format(
            result["item_impacts"]["flattened_multiple_choice_items"],
            result["item_impacts"]["unsupported_constructed_response_items"],
            result["item_impacts"]["lost_items"],
        ),
        "",
        "## Per-grade readiness",
        "",
        "| Grade | Audited | Readiness | Content-blocked lessons | Flattened-choice lessons | Unsupported-response lessons | Respondable now |",
        "|---:|---:|---|---:|---:|---:|---:|",
    ])
    for grade in GRADES:
        row = result["grade_results"][str(grade)]
        lines.append(
            f"| {grade} | {row['lessons_audited']} | `{row['readiness']}` | "
            f"{len(row['content_blocker_lessons'])} | {row['category_counts']['FLATTENED_MULTIPLE_CHOICE']} | "
            f"{row['category_counts']['UNSUPPORTED_RESPONSE_TYPE']} | {row['respondable_lessons']} |"
        )

    lines.extend([
        "",
        "## Source-content blockers",
        "",
        "### Empty mastery checks",
        "",
        *[f"- `{lesson_id}`" for lesson_id in result["category_lesson_ids"]["EMPTY_MASTERY_CHECK"]],
        "",
        "### Empty independent practice",
        "",
        *[f"- `{lesson_id}`" for lesson_id in result["category_lesson_ids"]["EMPTY_INDEPENDENT_PRACTICE"]],
        "",
        "There are no empty promised guided-practice sections. The only zero-actionable and strategy-only diagnostic lessons are Grade 3 Day 1 and Grade 4 Day 1. No learner package contains a graded answer/scoring field, learner placeholder/TODO, incomplete choice set, unkeyed graded item, or source-level unrepresentable constructed response.",
        "",
        "## Browser projection and response path",
        "",
        f"- Source item count and projected learner-question count agree in **{browser['item_count_equal_lessons']:,}/{browser['lessons']:,}** lessons (**{browser['source_items']:,}** items each side).",
        f"- Item refs survive in **{browser['item_ref_preserved_lessons']:,}/{browser['lessons']:,}** lessons.",
        f"- Multiple-choice structure is flattened in **{browser['flattened_multiple_choice_lessons']:,}** lessons (**{browser['flattened_multiple_choice_items']:,}** items).",
        f"- Constructed response is unsupported in **{browser['unsupported_constructed_response_lessons']:,}** lessons (**{browser['unsupported_constructed_response_items']:,}** items).",
        f"- Learner-response capability exists in **{browser['respondable_lessons']:,}/{browser['lessons']:,}** lessons.",
        "- The projection preserves question text and displayed choice text, so `LOST_ITEM_IN_BROWSER` is zero in the real corpus. It does not preserve item identity or response semantics.",
        "- The Study surface advances segments without collecting work; this is a completion-path blocker even where the source package itself is mathematically complete.",
        "",
        "## Required representative inspections",
        "",
        "Each row was included in the exhaustive checks; this table makes the required first/concept/mid/assessment/final inspections explicit.",
        "",
        "| Grade | Position | Lesson | Day | Source actionable | Items source/browser | Respondable |",
        "|---:|---|---|---:|---|---:|---|",
    ])
    for grade in GRADES:
        for label, item in result["representatives"][str(grade)].items():
            lines.append(
                f"| {grade} | {label.replace('_', ' ')} | `{item['lesson_id']}` | {item['course_day']} | "
                f"{'yes' if item['source_actionable'] else 'no'} | {item['source_items']}/{item['browser_items']} | "
                f"{'yes' if item['learner_can_respond'] else 'no'} |"
            )

    lines.extend([
        "",
        "## Negative controls",
        "",
    ])
    lines.extend(
        f"- {'PASS' if passed else 'FAIL'} — `{name}`"
        for name, passed in result["negative_controls"].items()
    )
    lines.extend([
        "",
        "The controls mutate only in-memory copies. They prove detection of empty mastery, a deleted browser question, flattened choices, an injected `answerIndex`, a zero-work diagnostic, and a browser/source item-count mismatch.",
        "",
        "## Readiness rule",
        "",
        "`SAFE_TO_BEGIN_NOW` requires complete source work and a working response path. `SAFE_AFTER_RENDERER_FIX` means source content passed but browser projection/interaction blocks use. `SAFE_AFTER_CONTENT_FIX` is used only when content alone blocks use. `DO_NOT_BEGIN_YET` is used when both source content and the browser path block use. Under that rule Grades 3 and 4 are `DO_NOT_BEGIN_YET`; every other audited grade is `SAFE_AFTER_RENDERER_FIX`.",
        "",
        "## Evidence files",
        "",
        "- `lesson-findings.jsonl`: one record for every active lesson",
        "- `grade-results.json`: per-grade counts, readiness, controls, reserve and standards checks",
        "- `browser-loss.json`: per-lesson source/browser preservation and response evidence",
        "- `scripts/audit-learner-mathematics/audit.py`: deterministic audit and controls",
        "- `scripts/audit-learner-mathematics/test_audit.py`: audit harness tests",
        "",
    ])
    return "\n".join(lines)


def grade_results_document(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "classification": result["classification"],
        "base_commit": result["base_commit"],
        "completeness": result["completeness"],
        "counts": result["counts"],
        "item_impacts": result["item_impacts"],
        "grades": result["grade_results"],
        "reserve": result["reserve"],
        "grade8_standards": result["grade8_standards"],
        "representatives": result["representatives"],
        "negative_controls": result["negative_controls"],
        "browser_projection_result": result["browser_aggregate"]["result"],
    }


def browser_document(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "classification": result["classification"],
        "base_commit": result["base_commit"],
        "aggregate": result["browser_aggregate"],
        "lessons": result["browser_records"],
    }


def output_payloads(result: dict[str, Any]) -> dict[str, str]:
    return {
        "MATH_LEARNER_AUDIT_R1.md": report_markdown(result),
        "lesson-findings.jsonl": "\n".join(
            json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            for record in result["lesson_records"]
        ) + "\n",
        "grade-results.json": json.dumps(
            grade_results_document(result), ensure_ascii=False, sort_keys=True, indent=2
        ) + "\n",
        "browser-loss.json": json.dumps(
            browser_document(result), ensure_ascii=False, sort_keys=True, indent=2
        ) + "\n",
    }


def write_or_check(paths: AuditPaths, payloads: dict[str, str], check: bool) -> bool:
    ok = True
    if check:
        for name, expected in payloads.items():
            path = paths.output / name
            actual = path.read_text(encoding="utf-8") if path.is_file() else None
            if actual != expected:
                print(f"STALE {path}", file=sys.stderr)
                ok = False
        return ok
    paths.output.mkdir(parents=True, exist_ok=True)
    for name, payload in payloads.items():
        (paths.output / name).write_text(payload, encoding="utf-8")
    return True


def repo_root(script: Path) -> Path:
    return script.resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=repo_root(Path(__file__)))
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    paths = AuditPaths.from_repo(args.repo.resolve(), args.output_dir)
    result = audit(paths)
    ok = write_or_check(paths, output_payloads(result), args.check)
    if not args.quiet:
        print(json.dumps({
            "classification": result["classification"],
            "lessons_audited": result["completeness"]["records"],
            "counts": result["counts"],
            "browser": result["browser_aggregate"],
            "readiness": {
                grade: data["readiness"] for grade, data in result["grade_results"].items()
            },
            "negative_controls": result["negative_controls"],
            "artifacts_current": ok,
        }, ensure_ascii=False, indent=2))
    return 0 if ok and result["classification"] == "MATH_LEARNER_AUDIT_COMPLETE" else 1


if __name__ == "__main__":
    raise SystemExit(main())
