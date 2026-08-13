#!/usr/bin/env python3
"""Validate the final canonical Mathematics production corpus."""

from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
ACTIVE = ROOT / "active"
RESERVE = ROOT / "reserve"
GRADES = (3, 4, 5, 7, 8, 9, 10, 11, 12)
H3_SHA = "49b3c4b86cc7764627bd4cfbd752222849831abf"
H3_TREE = "6f87e247ea0a798b7ac01c8ec64a86ba17284547"
REPAIR_BASE = "c81ddb6e04bc1c3629212327d47817c1b5677477"
CONTENT_REPAIR_LESSONS = {
    "ma-g3-mathematics-u01-l01",
    "ma-g3-mathematics-u09-l01",
    "ma-g3-mathematics-u09-l02",
    "ma-g3-mathematics-u10-l06",
    "ma-g3-mathematics-u10-l07",
    "ma-g3-mathematics-u10-l08",
    "ma-g4-mathematics-u01-l01",
    "ma-g4-mathematics-u10-l02",
    "ma-g4-mathematics-u10-l03",
}
WITHDRAWN = {
    "ma-g8-mathematics-u10-l10",
    "ma-g8-mathematics-u10-l13",
    "ma-g8-mathematics-u10-l14",
    "ma-g8-mathematics-u10-l17",
}
NEW_G8 = {f"ma-g8-mathematics-u01-l{n:02d}" for n in range(19, 23)}
FORBIDDEN = {"answerIndex", "given", "solutionReasoning", "commonErrors", "verification", "answer", "answerType", "referenceExample"}
RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str) -> None:
    RESULTS.append((name, bool(ok), detail))


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def packages(grade: int) -> dict[str, dict]:
    result = {}
    for path in sorted((ACTIVE / "packages" / f"grade-{grade:02d}").glob("*.package.json")):
        package = load(path)
        result[package["lessonRef"]["lessonId"]] = package
    return result


def keys(grade: int) -> dict[str, dict]:
    result = {}
    for path in sorted((ACTIVE / "answer-keys" / f"grade-{grade:02d}").glob("*.key.json")):
        key = load(path)
        result[key["lessonRef"]["lessonId"]] = key
    return result


all_packages: dict[str, dict] = {}
all_keys: dict[str, dict] = {}
all_schedule_ids: set[str] = set()
grade_counts = {}
schedule_errors = []
for grade in GRADES:
    grade_packages = packages(grade)
    grade_keys = keys(grade)
    grade_counts[grade] = (len(grade_packages), len(grade_keys))
    all_packages.update(grade_packages)
    all_keys.update(grade_keys)
    with (ROOT / "schedules" / f"grade-{grade:02d}.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    days = [int(row["course_day"]) for row in rows]
    ids = [row["lesson_id"] for row in rows]
    if days != list(range(1, 181)):
        schedule_errors.append(f"grade {grade}: non-contiguous course days")
    if len(ids) != len(set(ids)):
        schedule_errors.append(f"grade {grade}: duplicate lesson ID")
    if set(ids) != set(grade_packages):
        schedule_errors.append(f"grade {grade}: schedule/package mismatch")
    for row in rows:
        lesson_id = row["lesson_id"]
        if grade_packages[lesson_id]["lessonRef"]["courseDay"] != int(row["course_day"]):
            schedule_errors.append(f"{lesson_id}: package courseDay differs from schedule")
    all_schedule_ids.update(ids)

check("active-corpus-1620", len(all_packages) == len(all_keys) == len(all_schedule_ids) == 1620,
      f"{len(all_packages)} packages, {len(all_keys)} keys, {len(all_schedule_ids)} scheduled IDs")
check("nine-grades-180-each", all(value == (180, 180) for value in grade_counts.values()), str(grade_counts))
check("exact-schedules-no-double-booking", not schedule_errors, schedule_errors[:3] or "days 1..180 and unique IDs for every grade")

reserve_packages = {path.name.removesuffix(".package.json") for path in (RESERVE / "packages" / "grade-08").glob("*.package.json")}
reserve_keys = {path.name.removesuffix(".key.json") for path in (RESERVE / "answer-keys" / "grade-08").glob("*.key.json")}
check("reserve-manifest-separate", reserve_packages == reserve_keys == WITHDRAWN and not (WITHDRAWN & all_schedule_ids),
      f"{len(reserve_packages)} RESERVE_TUTOR records; 0 active schedule references")

schema_errors = []
for grade in GRADES:
    schema_family = "grades-03-04" if grade in (3, 4) else "grades-05-12"
    package_validator = Draft202012Validator(load(ROOT / "schemas" / schema_family / "student-work-package.schema.json"))
    key_validator = Draft202012Validator(load(ROOT / "schemas" / schema_family / "answer-key.schema.json"))
    for lesson_id, package in packages(grade).items():
        schema_errors.extend(
            f"{lesson_id}.package: {error.message}" for error in package_validator.iter_errors(package)
        )
    for lesson_id, key in keys(grade).items():
        schema_errors.extend(
            f"{lesson_id}.key: {error.message}" for error in key_validator.iter_errors(key)
        )
check("schema-conformance", not schema_errors,
      schema_errors[:3] or "1,620 packages and 1,620 keys conform, including four integration pairs")

link_errors = []
leaks = []
authority_errors = []
authority_methods = Counter()
for lesson_id, package in all_packages.items():
    key = all_keys.get(lesson_id)
    if key is None:
        link_errors.append(f"{lesson_id}: missing key")
        continue
    if key["packageId"] != package["packageId"]:
        link_errors.append(f"{lesson_id}: packageId mismatch")
    graded = {
        item["ref"]: item
        for section in package["sections"]
        for item in section["items"]
        if item["kind"] != "worked-example"
    }
    answer_by_ref = {answer["ref"]: answer for answer in key["answers"]}
    if set(graded) != set(answer_by_ref):
        link_errors.append(f"{lesson_id}: graded/key refs differ")
    for item in graded.values():
        present = FORBIDDEN & set(item)
        if present:
            leaks.append(f"{item['ref']}: {sorted(present)}")
    blob = json.dumps(package)
    for field in ("answerIndex", "solutionReasoning", "commonErrors", "given"):
        if f'"{field}"' in blob:
            leaks.append(f"{lesson_id}: serialized {field}")
    for answer in key["answers"]:
        verification = answer.get("verification", {})
        method = verification.get("method")
        authority_methods[method] += 1
        if method not in ("recomputed", "generator-authority"):
            authority_errors.append(f"{answer['ref']}: unsupported method {method!r}")
        if not verification.get("oracle") or "parameters" not in verification:
            authority_errors.append(f"{answer['ref']}: incomplete oracle evidence")
        if not answer.get("answer") or not answer.get("solutionReasoning", {}).get("steps"):
            authority_errors.append(f"{answer['ref']}: incomplete scoring authority")
        item = graded.get(answer["ref"])
        if item and item["kind"] == "multiple-choice":
            index = answer.get("answerIndex")
            if not isinstance(index, int) or not 0 <= index < len(item["choices"]) or item["choices"][index] != answer["answer"]:
                authority_errors.append(f"{answer['ref']}: answerIndex does not resolve")

check("student-package-and-scoring-authority", not link_errors, link_errors[:3] or "every active lesson has exactly one package and key")
check("no-answer-leakage", not leaks, leaks[:3] or "no graded learner item carries an answer-bearing field")
check("answer-key-authority", not authority_errors, authority_errors[:3] or f"methods {dict(authority_methods)}")

empty_mastery = []
empty_practice = []
for lesson_id, package in all_packages.items():
    for section in package["sections"]:
        if section["kind"] == "mastery-check" and not section["items"]:
            empty_mastery.append(lesson_id)
        if section["kind"] == "independent-practice" and not section["items"]:
            empty_practice.append(lesson_id)
check("no-empty-mastery-checks", not empty_mastery, empty_mastery[:3] or "0 empty mastery-check sections")
check("no-empty-independent-practice", not empty_practice,
      empty_practice[:3] or "0 empty independent-practice sections")

diagnostic_errors = []
diagnostic_detail = []
for grade in (3, 4):
    day_one = next(package for package in packages(grade).values() if package["lessonRef"]["courseDay"] == 1)
    graded = [
        item for section in day_one["sections"] for item in section["items"]
        if item["kind"] != "worked-example"
    ]
    substantive = [
        item for item in graded
        if not item["standard"].startswith("MP.") and "strategy" not in item["itemType"]
    ]
    mastery = next((section for section in day_one["sections"] if section["kind"] == "mastery-check"), None)
    if len(substantive) < 4:
        diagnostic_errors.append(f"grade {grade}: only {len(substantive)} substantive graded items")
    if mastery is None or len(mastery["items"]) != 2:
        diagnostic_errors.append(f"grade {grade}: mastery diagnostic is not two items")
    if mastery is None or "starting point, not a grade" not in mastery["directions"]:
        diagnostic_errors.append(f"grade {grade}: low-stakes direction missing")
    diagnostic_detail.append(f"G{grade} {len(substantive)} substantive + {len(graded) - len(substantive)} strategy")
check("day-one-mathematical-diagnostic", not diagnostic_errors,
      diagnostic_errors[:3] or "; ".join(diagnostic_detail))

changed_paths = subprocess.run(
    ["git", "-C", str(REPO), "diff", "--name-only", REPAIR_BASE, "--"],
    text=True, capture_output=True, check=True,
).stdout.splitlines()
changed_active = {
    Path(path).name.split(".package.json")[0].split(".key.json")[0]
    for path in changed_paths
    if path.startswith("curriculum-production/final/mathematics/active/")
}
scope_errors = []
if changed_active != CONTENT_REPAIR_LESSONS:
    scope_errors.append(f"active lesson diff {sorted(changed_active ^ CONTENT_REPAIR_LESSONS)}")
if any("/grade-05/" in path or "/grade-07/" in path or "/grade-08/" in path
       or "/grade-09/" in path or "/grade-10/" in path or "/grade-11/" in path
       or "/grade-12/" in path for path in changed_paths):
    scope_errors.append("a Grade 5-12 learner package or key changed")
if any(path.startswith("curriculum-release-admitted/") for path in changed_paths):
    scope_errors.append("global admitted release changed")
check("content-repair-scope", not scope_errors,
      scope_errors[:3] or "exactly 9 active G3/G4 lessons; G5-12 and admitted release unchanged")

standard_errors = []
for lesson_id in sorted(CONTENT_REPAIR_LESSONS):
    grade = all_packages[lesson_id]["lessonRef"]["grade"]
    relative = f"curriculum-production/final/mathematics/active/packages/grade-{grade:02d}/{lesson_id}.package.json"
    baseline = subprocess.run(
        ["git", "-C", str(REPO), "show", f"{REPAIR_BASE}:{relative}"],
        text=True, capture_output=True, check=True,
    )
    before = set(json.loads(baseline.stdout)["standards"])
    after_standards = set(all_packages[lesson_id]["standards"])
    if not before <= after_standards:
        standard_errors.append(f"{lesson_id}: lost {sorted(before - after_standards)}")
check("all-grade-standards-preserved", not standard_errors,
      standard_errors[:3] or "G3/G4 changed lessons lose no standards; G5-12 content unchanged")

g8 = packages(8)
official = (
    [f"8.NS.{n}" for n in range(1, 3)]
    + [f"8.EE.{n}" for n in range(1, 9)]
    + [f"8.F.{n}" for n in range(1, 6)]
    + [f"8.G.{n}" for n in range(1, 10)]
    + [f"8.SP.{n}" for n in range(1, 5)]
)
after = {code for package in g8.values() for code in package["standards"] if not code.startswith("MP.")}
reserve_docs = [load(path) for path in (RESERVE / "packages" / "grade-08").glob("*.package.json")]
before_docs = [package for lesson_id, package in g8.items() if lesson_id not in NEW_G8] + reserve_docs
before = {code for package in before_docs for code in package["standards"] if not code.startswith("MP.")}
check("grade8-28-of-28", set(official) <= after and len(official) == 28, f"{len(set(official) & after)}/28")
check("grade8-no-standard-lost", before <= after and set(official) - before == {"8.EE.2"},
      f"before {len(set(official) & before)}/28; after {len(set(official) & after)}/28; lost {sorted(before - after)}")
check("grade8-active-180-reserve-4", len(g8) == 180 and len(reserve_docs) == 4 and not (WITHDRAWN & set(g8)),
      f"{len(g8)} active, {len(reserve_docs)} reserve")

oracle_path = ROOT / "evidence" / "grade8-integration" / "build_student_work.py"
spec = importlib.util.spec_from_file_location("g8_oracle", oracle_path)
oracle_module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(oracle_module)
oracle_errors = []
oracle_count = 0
for lesson_id in sorted(NEW_G8):
    for answer in all_keys[lesson_id]["answers"]:
        tokens = oracle_module.oracle(answer["itemType"], answer["verification"]["parameters"])
        oracle_count += 1
        if any(token not in answer["answer"] for token in tokens):
            oracle_errors.append(f"{answer['ref']}: oracle mismatch")
check("grade8-independent-oracle", not oracle_errors and oracle_count == 47,
      oracle_errors[:3] or f"{oracle_count}/47 correction answers re-derived from recorded parameters")

bridge = (ROOT / "evidence" / "grade8-integration" / "grade9-handoff-note.md").read_text()
unquoted_unit2 = [line for line in bridge.splitlines() if "Grade 9 Unit 2" in line and not line.lstrip().startswith(">")]
check("grade8-to-grade9-root-bridge-unit1", "Grade 9 **Unit 1**" in bridge and not unquoted_unit2,
      "root bridge names Grade 9 Unit 1")

git_tree = subprocess.run(
    ["git", "-C", str(REPO), "rev-parse", "HEAD:src/curriculum/production-quality"],
    text=True, capture_output=True,
)
tree = git_tree.stdout.strip()
gate_diff = subprocess.run(
    ["git", "-C", str(REPO), "diff", "--quiet", H3_SHA, "--", "src/curriculum/production-quality"],
).returncode
check("gate-h3-semantics-unchanged", git_tree.returncode == 0 and tree == H3_TREE and gate_diff == 0,
      f"tree {tree or 'unresolved'}")

sealed_diff = subprocess.run(
    ["git", "-C", str(REPO), "diff", "--quiet", H3_SHA, "--", "curriculum-content/manuel-academy/1.0.0"],
).returncode
check("sealed-1.0.0-unmodified", sealed_diff == 0, "no diff from H3 input")

checksum_errors = []
for line in (ROOT / "SHA256SUMS.txt").read_text().splitlines():
    digest, relative = line.split("  ", 1)
    path = ROOT / relative
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else "MISSING"
    if digest != actual:
        checksum_errors.append(f"{relative}: {actual}")
check("checksums", not checksum_errors, checksum_errors[:3] or "all listed SHA-256 digests match")

manifest = load(ROOT / "manifest.json")
check("manifest-counts", manifest["totals"]["activeLessons"] == 1620 and manifest["reserveLessons"] == 4,
      f"active={manifest['totals']['activeLessons']}, reserve={manifest['reserveLessons']}")
check("input-shas-exact", manifest["inputs"] == {
    "mac/g34-math-production-r1": "c3b24f047b8aebd5e08f9b8022eef20ea187e190",
    "mac/math-production-materials-r1": "314f517f98a5d4a10415676f49576f526cd1f1d9",
    "mac/g8-math-remediation-integration-r2": "6cde12f62d2ff432f45c5a6bb45f7d5a5f19b0de",
    "mac/curriculum-production-gate-h3": H3_SHA,
}, "four pinned input tips")
repair_evidence = load(ROOT / "evidence" / "content-repair-r2.json")
check("content-repair-evidence", manifest.get("contentRepairR2", {}).get("affectedLessons") == 9
      and set(repair_evidence["scope"]["affectedLessons"]) == CONTENT_REPAIR_LESSONS
      and repair_evidence["sectionEvidence"]["emptyMasteryAfter"] == 0
      and repair_evidence["sectionEvidence"]["emptyIndependentPracticeAfter"] == 0,
      "9 affected lessons bound to zero-empty post-repair evidence")

width = max(len(name) for name, _, _ in RESULTS)
for name, ok, detail in RESULTS:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
passed = sum(ok for _, ok, _ in RESULTS)
print(f"\n{passed}/{len(RESULTS)} checks passed")
print(f"OVERALL: {'PASS' if passed == len(RESULTS) else 'FAIL'}")
sys.exit(0 if passed == len(RESULTS) else 1)
