#!/usr/bin/env python3
"""Build the immutable-input structural Family Pilot release candidate.

This script deliberately emits indexes and binding contracts, not copied lesson
instruction.  Every source read is pinned to a full commit SHA.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import subprocess
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[1]
GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
SUBJECTS = [
    "arts-and-music",
    "english-language-arts",
    "financial-literacy",
    "health",
    "mathematics",
    "physical-education",
    "ready-for-life",
    "science",
    "social-studies",
    "technology",
]

INPUTS = {
    "g34_normalization": {
        "ref": "mac/g34-release-normalization-r2",
        "commit": "e16c943dc1d320fc6a57d6a7baa570eebdd63d26",
        "path": "curriculum-release-normalization/g34-r2",
        "role": "normalized Grade 3/4 structural plane",
    },
    "sealed_1_0_0": {
        "ref": "sealed curriculum-content/manuel-academy/1.0.0",
        "commit": "4056e31d8beb36622be5ac27ea7f20145266343b",
        "path": "curriculum-content/manuel-academy/1.0.0",
        "role": "canonical sealed Grade 5/7/8 source; read only",
    },
    "hs912_normalization": {
        "ref": "mac/hs912-release-normalization-r2",
        "commit": "42874644adc9d7eba0fe85bc712043d128ed11de",
        "path": "curriculum-release-normalization/hs912-r2",
        "role": "normalized Grade 9-12 registry and canonical source snapshot",
    },
    "hs912_science_h4": {
        "ref": "mac/hs912-science-h4",
        "commit": "a86780a315b5a6ba4f134f35b7033f35707b0e52",
        "path": "curriculum-authoring/full-family-highschool-9-12/subjects/science",
        "role": "high-school science H4 correction source",
    },
    "g3_health_h2": {
        "ref": "mac/g3-health-h2",
        "commit": "50399a6fb6ae095907c0fde25db2a15ca85c6f1f",
        "path": "curriculum-authoring/full-family-grade34/subjects/health",
        "role": "Grade 3/4 Health H2 correction source",
    },
    "g8_math_integration": {
        "ref": "mac/g8-math-remediation-integration-r2",
        "commit": "6cde12f62d2ff432f45c5a6bb45f7d5a5f19b0de",
        "path": "curriculum-release-corrections",
        "role": "Grade 8 mathematics 8.EE.2 180-day integration",
    },
    "g34_standards_core": {
        "ref": "mac/g34-standards-core-r3",
        "commit": "29fc136ace384248c0df96c4fea3b5bf6ee9da95",
        "path": "curriculum-release-evidence/g34-core-r3",
        "role": "Grade 3/4 core standards evidence policy",
    },
    "g34_specialty_health_finlit_rfl": {
        "ref": "mac/g34-specialty-health-finlit-rfl-r4",
        "commit": "6e2e2fd091c7d9e46571d07f143545c6153c2402",
        "path": "curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4",
        "role": "Grade 3/4 specialty standards evidence policy",
    },
    "g34_specialty_arts_pe": {
        "ref": "mac/g34-specialty-arts-pe-r4",
        "commit": "c8bc5042215287fe5c655d78dda33ca6b742461e",
        "path": "curriculum-release-evidence/g34-specialty-arts-pe-r4",
        "role": "Grade 3/4 Arts/PE evidence policy with honest advisory states",
    },
    "social_dynamic_sources": {
        "ref": "mac/social-dynamic-sources-r3",
        "commit": "5c013cfa8b48086287ac11a366c5cdf0a47c7cef",
        "path": "curriculum-production/source-resolution/social-studies-dynamic",
        "role": "dynamic Social Studies source projection",
    },
}


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO, check=True, text=True, stdout=subprocess.PIPE
    ).stdout


def show(key: str, relpath: str) -> str:
    item = INPUTS[key]
    return git("show", f"{item['commit']}:{relpath}")


def show_json(key: str, relpath: str):
    return json.loads(show(key, relpath))


def show_jsonl(key: str, relpath: str) -> list[dict]:
    return [json.loads(line) for line in show(key, relpath).splitlines() if line.strip()]


def write_json(relpath: str, value) -> None:
    path = ROOT / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def write_jsonl(relpath: str, values: list[dict]) -> None:
    path = ROOT / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(v, ensure_ascii=False, sort_keys=True) + "\n" for v in values))


def source(key: str, path: str) -> dict:
    return {"input": key, "commit": INPUTS[key]["commit"], "path": path}


def unit_number_from_id(value: str) -> int:
    return int(value.rsplit("-u", 1)[1].split("-", 1)[0])


def read_csv_text(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text)))


def build_records():
    courses: list[dict] = []
    units: list[dict] = []
    lessons: list[dict] = []
    assessments: list[dict] = []
    schedule_sources: dict[str, dict] = {}

    # Normalized Grades 3/4. Health is replaced structurally by the later H2 source.
    g34base = "curriculum-release-normalization/g34-r2"
    g34_courses = show_json("g34_normalization", f"{g34base}/course-index.json")["courses"]
    g34_units = show_json("g34_normalization", f"{g34base}/unit-index.json")["units"]
    g34_lesson_rows = read_csv_text(show("g34_normalization", f"{g34base}/lesson-index.csv"))

    health_lessons: dict[str, dict] = {}
    health_units: dict[str, dict] = {}
    health_assessments: dict[str, dict] = {}
    for grade in (3, 4):
        hp = f"curriculum-authoring/full-family-grade34/subjects/health/grade-{grade}"
        for record in show_jsonl("g3_health_h2", f"{hp}/lessons.jsonl"):
            health_lessons[record["lesson_id"]] = record
        for record in show_json("g3_health_h2", f"{hp}/units.json"):
            health_units[record["unit_id"]] = record
        for record in show_json("g3_health_h2", f"{hp}/assessments.json"):
            health_assessments[record["assessment_id"]] = record

    for record in g34_courses:
        grade, subject = record["grade"], record["subject"]
        cid = record["course_id"]
        content_key = "g3_health_h2" if subject == "health" else "g34_normalization"
        content_path = (
            f"curriculum-authoring/full-family-grade34/subjects/health/grade-{grade}"
            if subject == "health"
            else f"{g34base}/{record['path'].rstrip('/')}"
        )
        courses.append({
            "releaseSlotId": cid,
            "authoredCourseId": cid,
            "grade": grade,
            "subject": subject,
            "title": f"Grade {grade} {subject.replace('-', ' ').title()}",
            "unitCount": record["unit_count"],
            "lessonCount": record["lesson_count"],
            "assessmentCount": record["assessment_count"],
            "idPolicy": "STABLE_ID",
            "contentSource": source(content_key, content_path),
            "normalizationSource": source("g34_normalization", f"{g34base}/course-index.json"),
        })
        schedule_sources[cid] = source("g34_normalization", f"{g34base}/{record['schedule']}")

    for record in g34_units:
        if record["subject"] == "health":
            record = health_units[record["unit_id"]]
            src = source("g3_health_h2", f"curriculum-authoring/full-family-grade34/subjects/health/grade-{record['grade']}/units.json")
        else:
            src = source("g34_normalization", f"{g34base}/unit-index.json")
        units.append({
            "unitRef": record["unit_id"],
            "releaseSlotId": record["course_id"],
            "authoredCourseId": record["course_id"],
            "grade": record["grade"],
            "subject": record["subject"],
            "unitNumber": record.get("unit_number", unit_number_from_id(record["unit_id"])),
            "title": record["title"],
            "requiredLessonRefs": record.get("lesson_ids", []),
            "requiredLessonCount": record.get("lesson_count", len(record.get("lesson_ids", []))),
            "assessmentRefs": [record["assessment_id"]] if record.get("assessment_id") else [],
            "source": src,
        })

    for row in g34_lesson_rows:
        lid = row["lesson_id"]
        if row["subject"] == "health":
            h = health_lessons[lid]
            src = source("g3_health_h2", f"curriculum-authoring/full-family-grade34/subjects/health/grade-{h['grade']}/lessons.jsonl")
            title, standards = h["title"], h.get("standards", [])
            course_day, day_in_unit = h["course_day"], h["day_in_unit"]
        else:
            src = source("g34_normalization", f"{g34base}/lesson-index.csv")
            title, standards = row["title"], [x for x in row.get("standards", "").split(";") if x]
            course_day, day_in_unit = int(row["course_day"]), int(row["day_in_unit"])
        lessons.append({
            "lessonRef": lid,
            "releaseSlotId": row["course_id"],
            "authoredCourseId": row["course_id"],
            "grade": int(row["grade"]),
            "subject": row["subject"],
            "unitRef": lid.rsplit("-l", 1)[0],
            "unitNumber": int(row["unit_number"]),
            "courseDay": int(course_day),
            "dayInUnit": int(day_in_unit),
            "title": title,
            "standards": standards,
            "deliveryStatus": "REQUIRED",
            "source": src,
        })

    for c in [x for x in courses if x["grade"] in (3, 4)]:
        grade, subject, cid = c["grade"], c["subject"], c["authoredCourseId"]
        if subject == "health":
            records = [x for x in health_assessments.values() if x["assessment_id"].startswith(cid + "-")]
            src_path = f"curriculum-authoring/full-family-grade34/subjects/health/grade-{grade}/assessments.json"
            src_key = "g3_health_h2"
        else:
            src_path = f"{g34base}/grades/grade-{grade}/courses/{subject}/assessments.json"
            src_key = "g34_normalization"
            records = show_json(src_key, src_path)
        for a in records:
            assessments.append({
                "assessmentRef": a["assessment_id"],
                "releaseSlotId": cid,
                "authoredCourseId": cid,
                "grade": grade,
                "subject": subject,
                "unitRef": a["assessment_id"].rsplit("-assessment", 1)[0],
                "kind": "UNIT",
                "source": source(src_key, src_path),
            })

    # Canonical sealed Grades 5/7/8, with the Grade 8 math required-path overlay.
    sealed = "curriculum-content/manuel-academy/1.0.0"
    sealed_courses = show_json("sealed_1_0_0", f"{sealed}/course-index.json")
    sealed_units = show_json("sealed_1_0_0", f"{sealed}/unit-index.json")
    sealed_lesson_rows = read_csv_text(show("sealed_1_0_0", f"{sealed}/lesson-index.csv"))
    mapping_path = "curriculum-release-corrections/grade8-mathematics-integration/lesson-mapping.csv"
    integration_path = "curriculum-release-corrections/grade8-mathematics-integration"
    math_mapping = read_csv_text(show("g8_math_integration", mapping_path))
    math_required = {r["lesson_id"]: r for r in math_mapping if r["delivery"] == "required"}
    math_added = {
        r["lesson_id"]: r
        for r in show_jsonl("g8_math_integration", "curriculum-release-corrections/grade8-mathematics/lessons.jsonl")
    }
    math_added.update({
        r["lesson_id"]: r
        for r in show_jsonl("g8_math_integration", f"{integration_path}/lessons.integration.jsonl")
    })
    integrated_schedule = {
        r["lesson_id"]: r
        for r in read_csv_text(show("g8_math_integration", f"{integration_path}/schedule.csv"))
    }

    sealed_lessons_by_course = Counter(r["course_id"] for r in sealed_lesson_rows)
    sealed_units_by_course = Counter(r["course_id"] for r in sealed_units)
    for record in sealed_courses:
        cid, grade, subject = record["course_id"], record["grade"], record["subject"]
        assessment_count = sealed_units_by_course[cid] + (1 if cid == "ma-g8-mathematics" else 0)
        courses.append({
            "releaseSlotId": cid,
            "authoredCourseId": cid,
            "grade": grade,
            "subject": subject,
            "title": record["title"],
            "unitCount": sealed_units_by_course[cid],
            "lessonCount": sealed_lessons_by_course[cid],
            "assessmentCount": assessment_count,
            "idPolicy": "STABLE_ID",
            "contentSource": source("sealed_1_0_0", f"{sealed}/{record['path']}"),
            "correctionSource": source("g8_math_integration", integration_path) if cid == "ma-g8-mathematics" else None,
        })
        schedule_sources[cid] = source(
            "g8_math_integration" if cid == "ma-g8-mathematics" else "sealed_1_0_0",
            f"{integration_path}/schedule.csv" if cid == "ma-g8-mathematics" else f"{sealed}/grades/grade-{grade}/daily-schedule.csv",
        )

    for original in sealed_units:
        record = dict(original)
        cid = record["course_id"]
        src = source("sealed_1_0_0", f"{sealed}/unit-index.json")
        lesson_refs = list(record.get("lesson_ids", []))
        if cid == "ma-g8-mathematics":
            lesson_refs = [x for x in lesson_refs if x in math_required]
            if record["unit_number"] == 1:
                lesson_refs.extend([f"ma-g8-mathematics-u01-l{i:02d}" for i in range(19, 23)])
            lesson_refs.sort(key=lambda x: int(math_required[x]["integrated_course_day"]))
            src = source("g8_math_integration", mapping_path)
        units.append({
            "unitRef": record["unit_id"],
            "releaseSlotId": cid,
            "authoredCourseId": cid,
            "grade": record["grade"],
            "subject": record["subject"],
            "unitNumber": record["unit_number"],
            "title": record["title"],
            "requiredLessonRefs": lesson_refs,
            "requiredLessonCount": len(lesson_refs),
            "assessmentRefs": [record["assessment_id"]] if record.get("assessment_id") else [],
            "source": src,
        })

    sealed_rows_by_id = {r["lesson_id"]: r for r in sealed_lesson_rows}
    for row in sealed_lesson_rows:
        cid, lid = row["course_id"], row["lesson_id"]
        if cid == "ma-g8-mathematics" and lid not in math_required:
            continue
        if cid == "ma-g8-mathematics":
            srow = integrated_schedule[lid]
            course_day = int(srow["course_day"])
            src = source("sealed_1_0_0", f"{sealed}/lesson-index.csv")
        else:
            course_day = int(row["course_day"])
            src = source("sealed_1_0_0", f"{sealed}/lesson-index.csv")
        lessons.append({
            "lessonRef": lid,
            "releaseSlotId": cid,
            "authoredCourseId": cid,
            "grade": int(row["grade"]),
            "subject": row["subject"],
            "unitRef": lid.rsplit("-l", 1)[0],
            "unitNumber": int(row["unit_number"]),
            "courseDay": course_day,
            "dayInUnit": int(row["day_in_unit"]),
            "title": row["title"],
            "standards": [x for x in row.get("standards", "").split(";") if x],
            "deliveryStatus": "REQUIRED",
            "source": src,
        })
    for lid, record in math_added.items():
        srow = integrated_schedule[lid]
        src_path = (
            f"{integration_path}/lessons.integration.jsonl"
            if lid.endswith("-l22")
            else "curriculum-release-corrections/grade8-mathematics/lessons.jsonl"
        )
        lessons.append({
            "lessonRef": lid,
            "releaseSlotId": "ma-g8-mathematics",
            "authoredCourseId": "ma-g8-mathematics",
            "grade": 8,
            "subject": "mathematics",
            "unitRef": "ma-g8-mathematics-u01",
            "unitNumber": 1,
            "courseDay": int(srow["course_day"]),
            "dayInUnit": int(srow["day_in_unit"]),
            "title": record["title"],
            "standards": record.get("standards", []),
            "deliveryStatus": "REQUIRED",
            "source": source("g8_math_integration", src_path),
        })

    for c in [x for x in courses if x["grade"] in (5, 7, 8)]:
        cid, grade, subject = c["authoredCourseId"], c["grade"], c["subject"]
        path = f"{sealed}/grades/grade-{grade}/courses/{subject}/assessments.json"
        for a in show_json("sealed_1_0_0", path):
            assessments.append({
                "assessmentRef": a["assessment_id"], "releaseSlotId": cid,
                "authoredCourseId": cid, "grade": grade, "subject": subject,
                "unitRef": a["assessment_id"].rsplit("-assessment", 1)[0],
                "kind": "UNIT", "source": source("sealed_1_0_0", path),
            })
    correction_assessment_data = show_json(
        "g8_math_integration", "curriculum-release-corrections/grade8-mathematics/assessment.json"
    )
    correction_assessment = correction_assessment_data[0] if isinstance(correction_assessment_data, list) else correction_assessment_data
    assessments.append({
        "assessmentRef": correction_assessment["assessment_id"],
        "releaseSlotId": "ma-g8-mathematics", "authoredCourseId": "ma-g8-mathematics",
        "grade": 8, "subject": "mathematics", "unitRef": "ma-g8-mathematics-u01",
        "kind": "CORRECTION", "administeredByLessonRef": "ma-g8-mathematics-u01-l22",
        "source": source("g8_math_integration", "curriculum-release-corrections/grade8-mathematics/assessment.json"),
    })

    # High school normalization registry, using H4 as the science content authority.
    hsbase = "curriculum-release-normalization/hs912-r2"
    hsreg = show_json("hs912_normalization", f"{hsbase}/registries/release-course-registry.json")
    science_base = "curriculum-authoring/full-family-highschool-9-12/subjects/science/authoring-set"
    science_courses = {x["course_id"]: x for x in show_json("hs912_science_h4", f"{science_base}/courses.json")}
    science_units = show_json("hs912_science_h4", f"{science_base}/units.json")
    science_assessments = show_json("hs912_science_h4", f"{science_base}/assessments.json")
    science_schedules = {x["grade"]: x for x in show_json("hs912_science_h4", f"{science_base}/schedules.json")}

    for record in hsreg["courses"]:
        grade, subject = record["grade"], record["subject"]
        slot, authored = record["release_slot_id"], record["authored_course_id"]
        if subject == "science":
            title = science_courses[authored]["title"]
            content = source("hs912_science_h4", science_base)
            status, id_policy = "STRUCTURALLY_ADMITTED_H4", "ALIAS_NOT_RENAME"
            schedule_sources[slot] = source("hs912_science_h4", f"{science_base}/schedules.json")
        else:
            path = f"curriculum-release-candidates/hs912-r1/{subject}/grade-{grade}"
            title = record["course_name"]
            content = source("hs912_normalization", path)
            status, id_policy = "NORMALIZED", "STABLE_ID"
            schedule_sources[slot] = source("hs912_normalization", f"curriculum-release-candidates/hs912-r1/schedules/grade-{grade}/daily-schedule.csv")
        courses.append({
            "releaseSlotId": slot, "authoredCourseId": authored, "grade": grade,
            "subject": subject, "title": title,
            "unitCount": record["observed"]["units"],
            "lessonCount": record["observed"]["lessons"],
            "assessmentCount": record["observed"]["assessments"],
            "idPolicy": id_policy, "status": status, "contentSource": content,
            "normalizationSource": source("hs912_normalization", f"{hsbase}/registries/release-course-registry.json"),
        })

    slot_by_authored = {c["authoredCourseId"]: c["releaseSlotId"] for c in courses}
    for c in [x for x in courses if x["grade"] >= 9 and x["subject"] != "science"]:
        grade, subject, cid, slot = c["grade"], c["subject"], c["authoredCourseId"], c["releaseSlotId"]
        base = f"curriculum-release-candidates/hs912-r1/{subject}/grade-{grade}"
        for u in show_json("hs912_normalization", f"{base}/units.json"):
            units.append({
                "unitRef": u["unit_id"], "releaseSlotId": slot, "authoredCourseId": cid,
                "grade": grade, "subject": subject, "unitNumber": u["unit_number"],
                "title": u["title"], "requiredLessonRefs": u["lesson_ids"],
                "requiredLessonCount": len(u["lesson_ids"]),
                "assessmentRefs": [u["assessment_id"]] if u.get("assessment_id") else [],
                "source": source("hs912_normalization", f"{base}/units.json"),
            })
        for l in show_jsonl("hs912_normalization", f"{base}/lessons.jsonl"):
            lessons.append({
                "lessonRef": l["lesson_id"], "releaseSlotId": slot, "authoredCourseId": cid,
                "grade": grade, "subject": subject,
                "unitRef": l["lesson_id"].rsplit("-l", 1)[0], "unitNumber": l["unit_number"],
                "courseDay": l["course_day"], "dayInUnit": l["day_in_unit"],
                "title": l["title"], "standards": l.get("standards", []),
                "deliveryStatus": "REQUIRED",
                "source": source("hs912_normalization", f"{base}/lessons.jsonl"),
            })
        for a in show_json("hs912_normalization", f"{base}/assessments.json"):
            assessments.append({
                "assessmentRef": a["assessment_id"], "releaseSlotId": slot,
                "authoredCourseId": cid, "grade": grade, "subject": subject,
                "unitRef": a["assessment_id"].rsplit("-assessment", 1)[0],
                "kind": "UNIT", "source": source("hs912_normalization", f"{base}/assessments.json"),
            })

    for u in science_units:
        slot = slot_by_authored[u["course_ref"]]
        units.append({
            "unitRef": u["unit_id"], "releaseSlotId": slot, "authoredCourseId": u["course_ref"],
            "grade": u["grade"], "subject": "science", "unitNumber": u["order"],
            "title": u["title"], "requiredLessonRefs": u["lesson_refs"],
            "requiredLessonCount": len(u["lesson_refs"]),
            "assessmentRefs": [u["assessment_ref"]] if u.get("assessment_ref") else [],
            "source": source("hs912_science_h4", f"{science_base}/units.json"),
        })
    for authored, scourse in science_courses.items():
        grade, slot = scourse["grade"], slot_by_authored[authored]
        path = f"{science_base}/lessons/{authored}.lessons.jsonl"
        for l in show_jsonl("hs912_science_h4", path):
            lessons.append({
                "lessonRef": l["lesson_id"], "releaseSlotId": slot, "authoredCourseId": authored,
                "grade": grade, "subject": "science", "unitRef": l["unit_ref"],
                "unitNumber": unit_number_from_id(l["unit_ref"]), "courseDay": l["course_day"],
                "dayInUnit": int(l["lesson_id"].rsplit("-l", 1)[1]), "title": l["title"],
                "standards": l.get("standards", []), "deliveryStatus": "REQUIRED",
                "source": source("hs912_science_h4", path),
            })
    for a in science_assessments:
        course = science_courses[a["course_ref"]]
        assessments.append({
            "assessmentRef": a["assessment_id"], "releaseSlotId": slot_by_authored[a["course_ref"]],
            "authoredCourseId": a["course_ref"], "grade": course["grade"], "subject": "science",
            "unitRef": a["unit_ref"], "kind": "UNIT",
            "source": source("hs912_science_h4", f"{science_base}/assessments.json"),
        })

    # Some normalized G3/4 unit records carry only a lesson count. Materialize
    # their explicit refs from the pinned lesson index for structural closure.
    lesson_refs_by_unit: dict[str, list[str]] = defaultdict(list)
    for lesson in lessons:
        lesson_refs_by_unit[lesson["unitRef"]].append(lesson["lessonRef"])
    lesson_day = {lesson["lessonRef"]: lesson["courseDay"] for lesson in lessons}
    for unit in units:
        if not unit["requiredLessonRefs"]:
            unit["requiredLessonRefs"] = sorted(
                lesson_refs_by_unit[unit["unitRef"]], key=lambda ref: (lesson_day[ref], ref)
            )
            unit["requiredLessonCount"] = len(unit["requiredLessonRefs"])

    # Sort all release surfaces deterministically.
    order = {s: i for i, s in enumerate(SUBJECTS)}
    courses.sort(key=lambda x: (x["grade"], order[x["subject"]]))
    units.sort(key=lambda x: (x["grade"], order[x["subject"]], x["unitNumber"], x["unitRef"]))
    lessons.sort(key=lambda x: (x["grade"], order[x["subject"]], x["courseDay"], x["lessonRef"]))
    assessments.sort(key=lambda x: (x["grade"], order[x["subject"]], x["assessmentRef"]))
    return courses, units, lessons, assessments, schedule_sources


def build_standards_refs(courses: list[dict]) -> list[dict]:
    hs_registry = show_json(
        "hs912_normalization",
        "curriculum-release-normalization/hs912-r2/registries/standards-evidence-registry.json",
    )
    hs_family = {x["family"]: x for x in hs_registry["families"]}
    refs = []
    for c in courses:
        grade, subject = c["grade"], c["subject"]
        evidence = []
        status = ""
        advisory = []
        if grade in (3, 4):
            if subject in ("arts-and-music", "physical-education"):
                evidence.append(source("g34_specialty_arts_pe", "curriculum-release-evidence/g34-specialty-arts-pe-r4/registry/crosswalk-registry.json"))
                status = "HUMAN_REVIEW_REQUIRED_ADVISORY_PRESENT"
                if subject == "arts-and-music":
                    advisory.append({"state": "HUMAN_REVIEW_REQUIRED", "distinctMappings": 2, "citationOccurrences": 36})
                else:
                    advisory.append({"state": "HUMAN_REVIEW_REQUIRED", "distinctMappings": 3, "citationOccurrences": 144})
            elif subject in ("health", "financial-literacy", "ready-for-life"):
                evidence.append(source("g34_specialty_health_finlit_rfl", "curriculum-release-evidence/g34-specialty-health-finlit-rfl-r4/evidence/crosswalk.json"))
                status = "EVIDENCE_POLICY_APPLIED"
            elif subject in ("english-language-arts", "mathematics", "science", "social-studies"):
                evidence.append(source("g34_standards_core", "curriculum-release-evidence/g34-core-r3/registry/evidence-registry.json"))
                status = "EVIDENCE_POLICY_APPLIED"
                if grade == 4 and subject == "social-studies":
                    status = "HUMAN_REVIEW_REQUIRED_ADVISORY_PRESENT"
                    advisory.append({"state": "HUMAN_REVIEW_REQUIRED", "distinctMappings": 1, "citationOccurrences": 12})
            else:
                evidence.append(source("g34_normalization", f"curriculum-release-normalization/g34-r2/standards/courses/{c['releaseSlotId']}.standards.json"))
                status = "NORMALIZED_EVIDENCE_CARRIED"
        elif grade in (5, 7, 8):
            evidence.append(source("sealed_1_0_0", "curriculum-content/manuel-academy/1.0.0/standards/standards-reference.md"))
            status = "SEALED_REFERENCE_CARRIED"
        else:
            evidence.append(source("hs912_normalization", "curriculum-release-normalization/hs912-r2/registries/standards-evidence-registry.json"))
            fam = hs_family[subject]
            if subject == "science":
                evidence.append(source("hs912_science_h4", "curriculum-authoring/full-family-highschool-9-12/subjects/science/authoring-set/standard-framework.json"))
                status = "H4_EVIDENCE_CARRIED_WITH_FOUNDATION_ADVISORY"
                advisory.append({"state": "human-review", "distinctMappings": 1, "unitRecords": 1})
            elif (fam["classes"].get("DECLARED_UNVERIFIED") or 0) > 0:
                count = fam["classes"]["DECLARED_UNVERIFIED"]
                status = "DECLARED_UNVERIFIED_ADVISORY_PRESENT"
                advisory.append({"state": "DECLARED_UNVERIFIED", "distinctMappings": count})
            else:
                status = "EVIDENCE_REGISTRY_APPLIED"
        refs.append({
            "releaseSlotId": c["releaseSlotId"], "grade": grade, "subject": subject,
            "status": status, "releaseEffect": "ADVISORY", "evidenceRefs": evidence,
            "advisoryReview": advisory,
            "honestyRule": "No HUMAN_REVIEW_REQUIRED, DECLARED_UNVERIFIED, alias-resolved, or local-composition state is promoted to Michigan-verbatim.",
        })
    return refs


def build_source_ledger() -> list[dict]:
    ledger = []
    for key, item in INPUTS.items():
        resolved = git("rev-parse", item["commit"]).strip()
        if resolved != item["commit"]:
            raise ValueError(f"commit mismatch for {key}: {resolved}")
        tree_sha = git("rev-parse", f"{item['commit']}:{item['path']}").strip()
        ledger.append({
            "inputId": key, "namedRef": item["ref"], "commitSha": item["commit"],
            "path": item["path"], "treeSha": tree_sha, "role": item["role"],
            "importMode": "PINNED_REFERENCE",
        })
    return ledger


def validate(courses, units, lessons, assessments, bindings, standards_refs, ledger) -> dict:
    checks = []

    def check(name: str, passed: bool, detail: str):
        checks.append({"check": name, "result": "PASS" if passed else "FAIL", "detail": detail})

    course_slots = [x["releaseSlotId"] for x in courses]
    unit_refs = [x["unitRef"] for x in units]
    lesson_refs = [x["lessonRef"] for x in lessons]
    assessment_refs = [x["assessmentRef"] for x in assessments]
    expected_matrix = {(g, s) for g in GRADES for s in SUBJECTS}
    actual_matrix = {(x["grade"], x["subject"]) for x in courses}
    check("exact-supported-grades", sorted({x["grade"] for x in courses}) == GRADES, f"grades={sorted({x['grade'] for x in courses})}")
    check("grade-6-absent", all(x["grade"] != 6 for x in courses + units + lessons + assessments), "no structural record has grade 6")
    check("exact-ten-subject-families", sorted({x["subject"] for x in courses}) == sorted(SUBJECTS), f"subjects={','.join(SUBJECTS)}")
    check("world-language-absent", all("world-language" not in json.dumps(x).lower() for x in courses + units + lessons + assessments), "no internally authored World Language record")
    check("complete-grade-subject-matrix", actual_matrix == expected_matrix and len(courses) == 90, f"actual={len(courses)} expected=90")
    check("unique-course-slots", len(course_slots) == len(set(course_slots)), f"unique={len(set(course_slots))}")
    check("unique-unit-refs", len(unit_refs) == len(set(unit_refs)), f"unique={len(set(unit_refs))}")
    check("unique-required-lesson-refs", len(lesson_refs) == len(set(lesson_refs)), f"unique={len(set(lesson_refs))}")
    check("unique-assessment-refs", len(assessment_refs) == len(set(assessment_refs)), f"unique={len(set(assessment_refs))}")
    check("unit-course-integrity", all(x["releaseSlotId"] in set(course_slots) for x in units), f"units={len(units)}")
    check("lesson-unit-integrity", all(x["unitRef"] in set(unit_refs) for x in lessons), f"lessons={len(lessons)}")
    check("assessment-course-integrity", all(x["releaseSlotId"] in set(course_slots) for x in assessments), f"assessments={len(assessments)}")
    unit_declared_lessons = [r for u in units for r in u["requiredLessonRefs"]]
    check("unit-lesson-totality", Counter(unit_declared_lessons) == Counter(lesson_refs), f"unitRefs={len(unit_declared_lessons)} index={len(lesson_refs)}")
    per_course_lessons = Counter(x["releaseSlotId"] for x in lessons)
    per_course_units = Counter(x["releaseSlotId"] for x in units)
    per_course_assessments = Counter(x["releaseSlotId"] for x in assessments)
    count_ok = all(
        c["lessonCount"] == per_course_lessons[c["releaseSlotId"]]
        and c["unitCount"] == per_course_units[c["releaseSlotId"]]
        and c["assessmentCount"] == per_course_assessments[c["releaseSlotId"]]
        for c in courses
    )
    check("course-derived-counts", count_ok, "course counts match indexes")
    duplicate_days = [k for k, v in Counter((x["releaseSlotId"], x["courseDay"]) for x in lessons).items() if v != 1]
    check("schedule-once-per-course-day", not duplicate_days, f"duplicateDays={len(duplicate_days)} scheduled={len(lessons)}")
    check("production-slot-totality", len(bindings) == len(lessons) and {x["lessonRef"] for x in bindings} == set(lesson_refs), f"slots={len(bindings)}")
    check("production-slots-unbound", all(x["bindingStatus"] == "UNBOUND" and x["productionArtifact"] is None for x in bindings), "no moving production-final branch imported")
    science_courses = [x for x in courses if x["grade"] >= 9 and x["subject"] == "science"]
    check("science-alias-not-rename", len(science_courses) == 4 and all(x["releaseSlotId"] != x["authoredCourseId"] and x["idPolicy"] == "ALIAS_NOT_RENAME" for x in science_courses), "four HS science aliases preserve authored IDs")
    check("standards-ref-totality", len(standards_refs) == len(courses) and {x["releaseSlotId"] for x in standards_refs} == set(course_slots), f"refs={len(standards_refs)}")
    false_claim = any(x["status"] == "VERBATIM" for x in standards_refs if x["advisoryReview"])
    check("advisory-honesty", not false_claim, "advisory states are not promoted to VERBATIM")
    check("source-ledger-totality", len(ledger) == len(INPUTS), f"inputs={len(ledger)}")
    sealed_tree = next(x["treeSha"] for x in ledger if x["inputId"] == "sealed_1_0_0")
    check("sealed-1.0.0-tree-unchanged", sealed_tree == "1f18bb1af429ecac9124d39984b288181c7a154b", f"tree={sealed_tree}")
    check("g8-math-180-day-required-path", per_course_lessons["ma-g8-mathematics"] == 180 and len({x["courseDay"] for x in lessons if x["releaseSlotId"] == "ma-g8-mathematics"}) == 180, "180 required lessons on 180 unique days")
    check("expected-release-totals", (len(courses), len(units), len(lessons), len(assessments)) == (90, 698, 8292, 699), f"courses={len(courses)} units={len(units)} lessons={len(lessons)} assessments={len(assessments)}")
    failed = [x for x in checks if x["result"] == "FAIL"]
    return {
        "classification": "FINAL_CURRICULUM_STRUCTURE_READY" if not failed else "BLOCKED",
        "overall": "PASS" if not failed else "FAIL",
        "blockingFailures": len(failed),
        "checks": checks,
        "counts": {"grades": len(GRADES), "courses": len(courses), "units": len(units), "lessons": len(lessons), "assessments": len(assessments)},
        "advisoryReviewCounts": {
            "g34ArtsHumanReviewRequired": {"distinctMappings": 4, "citationOccurrences": 72},
            "g34PhysicalEducationHumanReviewRequired": {"distinctMappings": 6, "citationOccurrences": 288},
            "g34CoreHumanReviewRequired": {"distinctMappings": 1, "citationOccurrences": 12},
            "hsDeclaredUnverified": {"distinctMappings": 11},
            "hsScienceFoundationHumanReview": {"distinctMappings": 1, "unitRecords": 4},
            "releaseEffect": "ADVISORY",
        },
    }


def write_checksums() -> None:
    target = ROOT / "SHA256SUMS.txt"
    files = sorted(p for p in ROOT.rglob("*") if p.is_file() and p != target and "__pycache__" not in p.parts)
    target.write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT).as_posix()}\n" for p in files))


def verify_checksums() -> list[str]:
    errors = []
    for line in (ROOT / "SHA256SUMS.txt").read_text().splitlines():
        expected, rel = line.split("  ", 1)
        path = ROOT / rel
        actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "MISSING"
        if actual != expected:
            errors.append(rel)
    return errors


def generate() -> dict:
    courses, units, lessons, assessments, schedule_sources = build_records()
    standards_refs = build_standards_refs(courses)
    ledger = build_source_ledger()
    bindings = [{
        "contractVersion": "family-pilot-production-binding-1.0",
        "grade": x["grade"], "subject": x["subject"], "lessonRef": x["lessonRef"],
        "releaseSlotId": x["releaseSlotId"], "authoredCourseId": x["authoredCourseId"],
        "bindingKey": f"{x['grade']}::{x['subject']}::{x['lessonRef']}",
        "bindingStatus": "UNBOUND", "productionArtifact": None,
        "admissionRule": "Bind only a production-final artifact whose declared grade, subject, and lessonRef exactly match this slot.",
    } for x in lessons]
    standards_by_slot = {x["releaseSlotId"]: x for x in standards_refs}
    matrix = [{
        "grade": c["grade"], "subject": c["subject"], "releaseSlotId": c["releaseSlotId"],
        "authoredCourseId": c["authoredCourseId"], "supported": True,
        "unitCount": c["unitCount"], "lessonCount": c["lessonCount"],
        "assessmentCount": c["assessmentCount"], "standardsState": standards_by_slot[c["releaseSlotId"]]["status"],
        "productionBindingState": "UNBOUND",
    } for c in courses]
    schedule_index = [{
        "releaseSlotId": c["releaseSlotId"], "grade": c["grade"], "subject": c["subject"],
        "requiredLessonCount": c["lessonCount"], "coverage": "EVERY_REQUIRED_LESSON_EXACTLY_ONCE",
        "source": schedule_sources[c["releaseSlotId"]],
    } for c in courses]
    schedule_rows = [{
        "grade": x["grade"], "subject": x["subject"], "releaseSlotId": x["releaseSlotId"],
        "authoredCourseId": x["authoredCourseId"], "courseDay": x["courseDay"],
        "lessonRef": x["lessonRef"], "source": schedule_sources[x["releaseSlotId"]],
    } for x in lessons]
    correction_ledger = {
        "sealedReleaseModified": False,
        "sealedTreeSha": "1f18bb1af429ecac9124d39984b288181c7a154b",
        "instructionMutationPolicy": "This structural candidate does not rewrite lesson instruction to resolve metadata or standards states.",
        "entries": [
            {"correction": "G34_NORMALIZATION_R2", "state": "APPLIED", "scope": {"grades": [3, 4], "subjects": SUBJECTS}, "stableIds": "PRESERVED", "input": "g34_normalization"},
            {"correction": "G3_HEALTH_H2", "state": "APPLIED", "scope": {"grades": [3, 4], "subjects": ["health"]}, "note": "The named branch contains H2 source corrections for both Grade 3 and Grade 4 Health; their stable IDs replace the older normalized content binding.", "stableIds": "PRESERVED", "input": "g3_health_h2"},
            {"correction": "G8_MATH_8_EE_2_180_DAY", "state": "APPLIED_TO_REQUIRED_PATH", "scope": {"grades": [8], "subjects": ["mathematics"]}, "addedRequiredLessonRefs": [f"ma-g8-mathematics-u01-l{i:02d}" for i in range(19, 23)], "withdrawnToReserveLessonRefs": ["ma-g8-mathematics-u10-l10", "ma-g8-mathematics-u10-l13", "ma-g8-mathematics-u10-l14", "ma-g8-mathematics-u10-l17"], "requiredDays": 180, "assessmentDelta": 1, "stableIds": "PRESERVED_EXCEPT_EXPLICIT_NEW_IDS", "input": "g8_math_integration"},
            {"correction": "HS912_NORMALIZATION_R2", "state": "APPLIED", "scope": {"grades": [9, 10, 11, 12], "subjects": SUBJECTS}, "stableIds": "PRESERVED", "input": "hs912_normalization"},
            {"correction": "HS_SCIENCE_H4", "state": "APPLIED", "scope": {"grades": [9, 10, 11, 12], "subjects": ["science"]}, "idPolicy": "ALIAS_NOT_RENAME", "stableIds": "AUTHORED_MA_HS_IDS_PRESERVED", "input": "hs912_science_h4"},
            {"correction": "G34_STANDARDS_EVIDENCE_POLICIES", "state": "APPLIED_AS_EVIDENCE", "scope": {"grades": [3, 4]}, "instructionEdited": False, "inputs": ["g34_standards_core", "g34_specialty_health_finlit_rfl", "g34_specialty_arts_pe"]},
            {"correction": "SOCIAL_DYNAMIC_SOURCES_R3", "state": "ATTACHED_AS_SOURCE_TRACKING", "scope": {"grades": GRADES, "subjects": ["social-studies"]}, "instructionEdited": False, "input": "social_dynamic_sources"},
        ],
    }
    validation = validate(courses, units, lessons, assessments, bindings, standards_refs, ledger)
    manifest = {
        "releaseId": "family-pilot-final-r1",
        "classification": validation["classification"],
        "releaseType": "STRUCTURAL_CURRICULUM_RELEASE_CANDIDATE",
        "supportedGrades": GRADES,
        "unsupportedGrades": [6],
        "internalSubjectFamilies": SUBJECTS,
        "externalWorldLanguage": {"tracking": "SEPARATE", "blocksFamilyPilotStudy": False, "internallyAuthoredCourseCount": 0},
        "counts": validation["counts"],
        "standardsReviewEffect": "ADVISORY_UNLESS_AN_EXPLICIT_RELEASE_CONTRACT_SAYS_BLOCKING",
        "productionBindings": {"state": "UNBOUND", "slotCount": len(bindings), "contractKey": ["grade", "subject", "lessonRef"]},
        "artifacts": ["course-index.json", "unit-index.json", "lesson-index.jsonl", "assessment-index.json", "schedules/schedule-index.json", "schedules/lesson-schedule.jsonl", "standards-evidence-refs.json", "source-input-ledger.json", "grade-subject-matrix.json", "correction-overlay-ledger.json", "production-binding-slots.jsonl", "validation/structural-validation.json", "SHA256SUMS.txt"],
    }

    write_json("MANIFEST.json", manifest)
    write_json("course-index.json", courses)
    write_json("unit-index.json", units)
    write_jsonl("lesson-index.jsonl", lessons)
    write_json("assessment-index.json", assessments)
    write_json("schedules/schedule-index.json", schedule_index)
    write_jsonl("schedules/lesson-schedule.jsonl", schedule_rows)
    write_json("standards-evidence-refs.json", standards_refs)
    write_json("source-input-ledger.json", ledger)
    write_json("grade-subject-matrix.json", matrix)
    write_json("correction-overlay-ledger.json", correction_ledger)
    write_jsonl("production-binding-slots.jsonl", bindings)
    write_json("validation/structural-validation.json", validation)
    report_lines = [
        "# Structural validation\n",
        f"Overall: **{validation['overall']}**",
        f"Classification: **{validation['classification']}**",
        f"Blocking failures: **{validation['blockingFailures']}**\n",
        "| Check | Result | Detail |",
        "|---|---:|---|",
    ]
    report_lines += [f"| {x['check']} | {x['result']} | {x['detail']} |" for x in validation["checks"]]
    (ROOT / "validation").mkdir(parents=True, exist_ok=True)
    (ROOT / "validation/structural-validation.md").write_text("\n".join(report_lines) + "\n")
    (ROOT / "README.md").write_text(
        "# Family Pilot final structural curriculum candidate R1\n\n"
        "This directory is a structural release candidate over immutable, SHA-pinned inputs. "
        "It contains indexes, schedules, evidence references, correction custody, and deliberately "
        "unbound production-admission slots. It does not copy or silently rewrite lesson instruction.\n\n"
        "Supported internal grades are 3, 4, 5, 7, 8, 9, 10, 11, and 12. Grade 6 is absent. "
        "The matrix contains the existing ten Manuel Academy subject families only. External World "
        "Language tracking is separate and non-blocking.\n\n"
        "Rebuild with `python3 build_release.py`; verify the generated structure and checksums with "
        "`python3 build_release.py --validate-only`.\n"
    )
    write_checksums()
    return validation


def validate_only() -> dict:
    courses = json.loads((ROOT / "course-index.json").read_text())
    units = json.loads((ROOT / "unit-index.json").read_text())
    lessons = [json.loads(x) for x in (ROOT / "lesson-index.jsonl").read_text().splitlines() if x]
    assessments = json.loads((ROOT / "assessment-index.json").read_text())
    bindings = [json.loads(x) for x in (ROOT / "production-binding-slots.jsonl").read_text().splitlines() if x]
    standards_refs = json.loads((ROOT / "standards-evidence-refs.json").read_text())
    ledger = json.loads((ROOT / "source-input-ledger.json").read_text())
    result = validate(courses, units, lessons, assessments, bindings, standards_refs, ledger)
    checksum_errors = verify_checksums()
    result["checksumVerification"] = {"result": "PASS" if not checksum_errors else "FAIL", "mismatches": checksum_errors}
    if checksum_errors:
        result["overall"] = "FAIL"
        result["classification"] = "BLOCKED"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    result = validate_only() if args.validate_only else generate()
    print(json.dumps(result, indent=2))
    return 0 if result["overall"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
