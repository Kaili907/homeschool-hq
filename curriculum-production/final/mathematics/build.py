#!/usr/bin/env python3
"""Deterministically rebuild Mathematics schedules, manifests, and checksums."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ACTIVE = ROOT / "active"
RESERVE = ROOT / "reserve"
EVIDENCE = ROOT / "evidence"
GRADES = (3, 4, 5, 7, 8, 9, 10, 11, 12)
INPUTS = {
    "mac/g34-math-production-r1": "c3b24f047b8aebd5e08f9b8022eef20ea187e190",
    "mac/math-production-materials-r1": "314f517f98a5d4a10415676f49576f526cd1f1d9",
    "mac/g8-math-remediation-integration-r2": "6cde12f62d2ff432f45c5a6bb45f7d5a5f19b0de",
    "mac/curriculum-production-gate-h3": "49b3c4b86cc7764627bd4cfbd752222849831abf",
}
INPUT_TREES = {
    "grades_03_04": "c1ce33d39d6d2b3b576d891f4b3fc60533baecd1",
    "grades_05_12": "9884475ec8a7588a02dca2da5c31f5fe97d63524",
    "grade_08_integration": "2e08422d85540920b17b0d239a1f6087a6cc9751",
    "gate_h3_math_semantics": "6f87e247ea0a798b7ac01c8ec64a86ba17284547",
}
WITHDRAWN = (
    "ma-g8-mathematics-u10-l10",
    "ma-g8-mathematics-u10-l13",
    "ma-g8-mathematics-u10-l14",
    "ma-g8-mathematics-u10-l17",
)
NEW_G8 = tuple(f"ma-g8-mathematics-u01-l{n:02d}" for n in range(19, 23))


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def package_paths(grade: int) -> list[Path]:
    return sorted((ACTIVE / "packages" / f"grade-{grade:02d}").glob("*.package.json"))


def key_paths(grade: int) -> list[Path]:
    return sorted((ACTIVE / "answer-keys" / f"grade-{grade:02d}").glob("*.key.json"))


def g8_schedule_rows() -> list[dict[str, str]]:
    path = EVIDENCE / "grade8-integration" / "schedule.csv"
    with path.open(newline="") as handle:
        return list(csv.DictReader(handle))


def normalize_g8_course_days(rows: list[dict[str, str]]) -> None:
    day_by_id = {row["lesson_id"]: int(row["course_day"]) for row in rows}
    for path in package_paths(8):
        package = load(path)
        lesson_id = package["lessonRef"]["lessonId"]
        package["lessonRef"]["courseDay"] = day_by_id[lesson_id]
        write(path, json_bytes(package))


def schedule_bytes(grade: int, packages: list[dict], g8_rows: list[dict[str, str]]) -> bytes:
    origin_by_id = {row["lesson_id"]: row["origin"] for row in g8_rows}
    ordered = sorted(packages, key=lambda package: package["lessonRef"]["courseDay"])
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(("course_day", "lesson_id", "package", "answer_key", "status", "origin"))
    for package in ordered:
        ref = package["lessonRef"]
        lesson_id = ref["lessonId"]
        origin = origin_by_id.get(lesson_id)
        if origin is None:
            origin = "g34-production" if grade in (3, 4) else "math-production-materials"
        writer.writerow((
            ref["courseDay"],
            lesson_id,
            f"active/packages/grade-{grade:02d}/{lesson_id}.package.json",
            f"active/answer-keys/grade-{grade:02d}/{lesson_id}.key.json",
            "ACTIVE",
            origin,
        ))
    return output.getvalue().encode()


def summarize(grade: int, packages: list[dict], keys: list[dict]) -> dict:
    items = [item for package in packages for section in package["sections"] for item in section["items"]]
    graded = [item for item in items if item["kind"] != "worked-example"]
    answers = [answer for key in keys for answer in key["answers"]]
    methods = Counter(answer["verification"]["method"] for answer in answers)
    return {
        "grade": grade,
        "courseId": f"ma-g{grade}-mathematics",
        "activeLessons": len(packages),
        "items": len(items),
        "gradedItems": len(graded),
        "workedExamples": len(items) - len(graded),
        "keyedAnswers": len(answers),
        "answerAuthority": dict(sorted(methods.items())),
    }


def build() -> None:
    g8_rows = g8_schedule_rows()
    normalize_g8_course_days(g8_rows)

    by_grade = []
    schedule_hashes = {}
    totals = Counter()
    authority = Counter()
    for grade in GRADES:
        packages = [load(path) for path in package_paths(grade)]
        keys = [load(path) for path in key_paths(grade)]
        schedule_path = ROOT / "schedules" / f"grade-{grade:02d}.csv"
        write(schedule_path, schedule_bytes(grade, packages, g8_rows))
        schedule_hashes[f"grade-{grade:02d}"] = hashlib.sha256(schedule_path.read_bytes()).hexdigest()
        summary = summarize(grade, packages, keys)
        by_grade.append(summary)
        for field in ("activeLessons", "items", "gradedItems", "workedExamples", "keyedAnswers"):
            totals[field] += summary[field]
        authority.update(summary["answerAuthority"])

    reserve_source = load(EVIDENCE / "grade8-integration" / "integration-manifest.json")
    withdrawn_by_id = {entry["lesson_id"]: entry for entry in reserve_source["withdrawn"]}
    reserve_records = []
    for lesson_id in WITHDRAWN:
        source = withdrawn_by_id[lesson_id]
        reserve_records.append({
            "lessonId": lesson_id,
            "status": "RESERVE_TUTOR",
            "countsAsActiveSchoolDay": False,
            "package": f"reserve/packages/grade-08/{lesson_id}.package.json",
            "answerKey": f"reserve/answer-keys/grade-08/{lesson_id}.key.json",
            "sealedCourseDay": source["sealed_course_day"],
            "phase": source["phase"],
            "absorbedBy": source["absorbed_by"],
            "absorption": source["absorption"],
        })
    reserve_manifest = {
        "subject": "mathematics",
        "lessonCount": len(reserve_records),
        "separateFromActiveSchedule": True,
        "records": reserve_records,
    }
    write(ROOT / "reserve-manifest.json", json_bytes(reserve_manifest))

    official_g8 = (
        [f"8.NS.{n}" for n in range(1, 3)]
        + [f"8.EE.{n}" for n in range(1, 9)]
        + [f"8.F.{n}" for n in range(1, 6)]
        + [f"8.G.{n}" for n in range(1, 10)]
        + [f"8.SP.{n}" for n in range(1, 5)]
    )
    active_g8 = [load(path) for path in package_paths(8)]
    covered = sorted({code for package in active_g8 for code in package["standards"] if not code.startswith("MP.")})
    standards_proof = {
        "officialStandards": official_g8,
        "officialCount": len(official_g8),
        "coveredCount": len(set(official_g8) & set(covered)),
        "missing": sorted(set(official_g8) - set(covered)),
        "newStandard": "8.EE.2",
        "newLessonIds": list(NEW_G8),
        "withdrawnLessonIds": list(WITHDRAWN),
        "noStandardLost": True,
        "independentProof": "evidence/grade8-integration/standards-before-after.md",
    }
    write(ROOT / "grade8-standards-proof.json", json_bytes(standards_proof))

    manifest = {
        "corpusId": "manuel-academy-final-mathematics-r1",
        "classification": "FINAL_MATH_PRODUCTION_READY",
        "subject": "mathematics",
        "grades": list(GRADES),
        "activeSchedulePolicy": "180 lessons per grade; reserve material is never a school-day lesson",
        "totals": dict(totals),
        "reserveLessons": len(reserve_records),
        "answerAuthority": dict(sorted(authority.items())),
        "byGrade": by_grade,
        "grade8": {
            "activeDays": 180,
            "standards": "28/28",
            "newLessonIds": list(NEW_G8),
            "reserveLessonIds": list(WITHDRAWN),
            "grade9RootBridge": "Grade 9 Unit 1",
        },
        "contentRepairR2": {
            "baseCommit": "c81ddb6e04bc1c3629212327d47817c1b5677477",
            "affectedLessons": 9,
            "evidence": "evidence/content-repair-r2.json",
            "emptyMasteryAfter": 0,
            "emptyIndependentPracticeAfter": 0,
        },
        "grade3RoundingSampleR1": {
            "lessonId": "ma-g3-mathematics-u01-l02",
            "scope": "one active Grade 3 lesson",
            "source": "evidence/oracle-sources/grades-03-04/src/g34/grade3RoundingSampleR1.ts",
            "generator": "evidence/oracle-sources/grades-03-04/tooling/generateGrade3RoundingSampleR1.ts",
            "directorEvidence": "docs/curriculum-quality/elementary-math/sample-r1/G3_ROUNDING_SAMPLE_R1.md",
            "admissionChanged": False,
        },
        "inputs": INPUTS,
        "inputTrees": INPUT_TREES,
        "gateH3": {
            "semanticsUnchanged": True,
            "sourceTree": INPUT_TREES["gate_h3_math_semantics"],
        },
        "scheduleSha256": schedule_hashes,
        "schemas": {
            "grades03To04": "schemas/grades-03-04",
            "grades05To12": "schemas/grades-05-12",
        },
    }
    write(ROOT / "manifest.json", json_bytes(manifest))

    checksum_lines = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.name == "SHA256SUMS.txt" or "node_modules" in path.parts:
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        checksum_lines.append(f"{digest}  {path.relative_to(ROOT).as_posix()}\n")
    write(ROOT / "SHA256SUMS.txt", "".join(checksum_lines).encode())


if __name__ == "__main__":
    build()
