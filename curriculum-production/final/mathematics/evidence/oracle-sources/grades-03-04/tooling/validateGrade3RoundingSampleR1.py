#!/usr/bin/env python3
"""Validate the isolated canonical Grade 3 Rounding Sample R1."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


BASE = "56dd8a45fee1ca03dd5f83e1466c9f081824d6b9"
LESSON_ID = "ma-g3-mathematics-u01-l02"
ROOT = Path(__file__).resolve().parents[7]
MATH = ROOT / "curriculum-production" / "final" / "mathematics"
PACKAGE = MATH / "active" / "packages" / "grade-03" / f"{LESSON_ID}.package.json"
KEY = MATH / "active" / "answer-keys" / "grade-03" / f"{LESSON_ID}.key.json"
RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str) -> None:
    RESULTS.append((name, bool(ok), detail))


def load(path: Path) -> dict:
    return json.loads(path.read_text())


package = load(PACKAGE)
key = load(KEY)
base_package = json.loads(
    subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{BASE}:{PACKAGE.relative_to(ROOT)}"],
        text=True,
        capture_output=True,
        check=True,
    ).stdout
)

check(
    "identity-proven",
    package["lessonRef"] == base_package["lessonRef"]
    and package["lessonRef"]["lessonId"] == LESSON_ID
    and package["lessonRef"]["courseDay"] == 2,
    f"{LESSON_ID}, course day {package['lessonRef']['courseDay']}",
)
check(
    "approved-standards-preserved",
    package["standards"] == base_package["standards"],
    str(package["standards"]),
)
check(
    "baseline-was-rounding",
    any(
        "round" in item["prompt"].lower()
        for section in base_package["sections"]
        for item in section["items"]
    ),
    "the exact base package already contains rounding instruction and practice",
)

package_schema = load(MATH / "schemas" / "grades-03-04" / "student-work-package.schema.json")
key_schema = load(MATH / "schemas" / "grades-03-04" / "answer-key.schema.json")
schema_errors = [
    *(error.message for error in Draft202012Validator(package_schema).iter_errors(package)),
    *(error.message for error in Draft202012Validator(key_schema).iter_errors(key)),
]
check("schema-conformance", not schema_errors, schema_errors[0] if schema_errors else "package and key conform")

sections = {section["sectionId"]: section for section in package["sections"]}
expected_counts = {"ex": 3, "gp": 5, "ip": 10, "mc": 5, "rm": 4, "xt": 2}
actual_counts = {section_id: len(sections.get(section_id, {}).get("items", [])) for section_id in expected_counts}
check("required-counts", actual_counts == expected_counts, str(actual_counts))
check(
    "three-teaching-blocks",
    len([section_id for section_id in sections if section_id.startswith("learn-")]) == 3,
    "learn-01, learn-02, learn-03",
)

items = [item for section in package["sections"] for item in section["items"]]
graded = [item for item in items if item["kind"] != "worked-example"]
refs = [item["ref"] for item in items]
prompts = [item["prompt"] for item in items]
check("distinct-item-refs", len(refs) == len(set(refs)), f"{len(refs)} unique refs")
check("distinct-prompts", len(prompts) == len(set(prompts)), f"{len(prompts)} unique prompts")

answer_refs = [answer["ref"] for answer in key["answers"]]
check(
    "adult-authority-resolves",
    len(answer_refs) == len(set(answer_refs))
    and set(answer_refs) == {item["ref"] for item in graded},
    f"{len(graded)} graded items, {len(answer_refs)} separate answers",
)
authority_ok = all(
    answer.get("verification", {}).get("method") == "recomputed"
    and answer.get("verification", {}).get("oracle", "").endswith("#grade3RoundingSampleR1Oracle")
    and answer.get("solutionReasoning", {}).get("answer") == answer.get("answer")
    for answer in key["answers"]
)
check("independent-oracle-authority", authority_ok, f"{len(answer_refs)} recomputed authority records")

forbidden = {
    "answer",
    "answerIndex",
    "correctAnswer",
    "expectedAnswer",
    "solutionReasoning",
    "given",
    "verification",
    "workedSolution",
}
leaks = [f"{item['ref']}:{sorted(forbidden & set(item))}" for item in graded if forbidden & set(item)]
check("zero-learner-answer-leaks", not leaks, leaks[0] if leaks else "0 graded records expose answer-bearing fields")

changed_active = subprocess.run(
    ["git", "-C", str(ROOT), "diff", "--name-only", BASE, "--", str(MATH / "active")],
    text=True,
    capture_output=True,
    check=True,
).stdout.splitlines()
changed_lessons = {
    Path(path).name.removesuffix(".package.json").removesuffix(".key.json")
    for path in changed_active
}
check("one-active-lesson-changed", changed_lessons == {LESSON_ID}, str(sorted(changed_lessons)))
check(
    "other-grades-unchanged",
    all("/grade-03/" in path for path in changed_active),
    "no G4/G5/G7-G12 active package or key changed",
)

schedule_diff = subprocess.run(
    ["git", "-C", str(ROOT), "diff", "--quiet", BASE, "--", str(MATH / "schedules")]
).returncode
check("schedules-unchanged", schedule_diff == 0, "all nine 180-day Math schedules are byte-identical to base")

width = max(len(name) for name, _, _ in RESULTS)
for name, ok, detail in RESULTS:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
passed = sum(ok for _, ok, _ in RESULTS)
print(f"\n{passed}/{len(RESULTS)} checks passed")
sys.exit(0 if passed == len(RESULTS) else 1)
