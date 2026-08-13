#!/usr/bin/env python3
"""Build the Grade 8 Mathematics 8.EE.2 integration schedule artefacts.

Emits, from the sealed 1.0.0 course plus the accepted e9ead0c overlay:
  schedule.csv                 the exact resulting 180-day course schedule
  lesson-mapping.csv           sealed course_day -> integrated course_day, every lesson
  daily-schedule-grade8.csv    the Grade 8 family schedule with period_1 re-sequenced
  lessons.integration.jsonl    the one new delivery-day record (u01-l22)
  integration-manifest.json    machine-readable descriptor

Nothing outside this directory is written. The sealed release is read only.
Usage: python3 build.py   (from this directory)
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RELEASE = os.path.join(REPO, "curriculum-content", "manuel-academy", "1.0.0")
COURSE = os.path.join(RELEASE, "grades", "grade-8", "courses", "mathematics")
OVERLAY = os.path.join(REPO, "curriculum-release-corrections", "grade8-mathematics")

CORRECTION_ID = "g8-math-8ee2-2026-08-12"
INTEGRATION_ID = "g8-math-8ee2-integration-2026-08-12"

# The four sealed days withdrawn from the required 180-day path.
# All four are recycle-phase days in Unit 10, whose every standard is instructed
# and assessed in an earlier dedicated unit. Each folds into the next retained day.
# Unit 10's reteach day (u10-l08) is deliberately RETAINED so the final unit keeps
# re-teaching capacity; the transfer challenge is given up instead, its function
# being already carried by the performance-task build and the capstone assessment.
WITHDRAWN = {
    "ma-g8-mathematics-u10-l10": {
        "phase": "Discussion or problem seminar",
        "recycles": "focus 'geometry and measurement', instructed at u10-l04",
        "absorbed_by": "ma-g8-mathematics-u10-l11",
        "absorption": "seminar protocol opens the performance-task planning session",
    },
    "ma-g8-mathematics-u10-l13": {
        "phase": "Skill consolidation",
        "recycles": "focus 'defining variables and assumptions', instructed at u10-l01 and u10-l07",
        "absorbed_by": "ma-g8-mathematics-u10-l15",
        "absorption": "consolidation set runs as the fluency half of assessment preparation",
    },
    "ma-g8-mathematics-u10-l14": {
        "phase": "Transfer challenge",
        "recycles": "focus 'selecting linear or nonlinear models', instructed at u10-l02 and reworked at u10-l08",
        "absorbed_by": "ma-g8-mathematics-u10-l15",
        "absorption": "transfer set runs as the unfamiliar-context half of assessment preparation",
    },
    "ma-g8-mathematics-u10-l17": {
        "phase": "Targeted correction",
        "recycles": "focus 'data trends and uncertainty', instructed at u10-l05 and u10-l11",
        "absorbed_by": "ma-g8-mathematics-u10-l18",
        "absorption": "post-assessment correction folded into the revision step of publication",
    },
}

INSERT_AFTER = "ma-g8-mathematics-u01-l18"

L22 = {
    "schema_version": "1.0",
    "lesson_id": "ma-g8-mathematics-u01-l22",
    "course_id": "ma-g8-mathematics",
    "grade": 8,
    "subject": "mathematics",
    "course_day": 22,
    "unit_number": 1,
    "unit_title": "Real Numbers and Irrational Numbers",
    "day_in_unit": 22,
    "title": "Correction assessment: exact roots, evaluation, and irrationality",
    "phase": "Correction assessment",
    "focus": "independent mastery evidence for 8.EE.2",
    "estimated_minutes": "45–60",
    "standards": ["8.EE.2", "MP.2", "MP.6"],
    "essential_question": "How can understanding real numbers and irrational numbers help us explain, decide, create, or solve something that matters?",
    "learning_objectives": [
        "Produce independent evidence of the three requirements of 8.EE.2 without instructional support.",
        "Name exact solutions with root notation and distinguish them from decimal approximations.",
        "Give a reason, rather than an assertion, for the irrationality of √2 and the rationality of a perfect-square root.",
    ],
    "success_criteria": [
        "The learner works every prompt of ma-g8-mathematics-c01-assessment independently.",
        "The learner reports exact values where exact values exist and labels approximations as approximations.",
        "The learner supports each classification with a stated reason.",
    ],
    "materials": [
        "course notebook or digital equivalent",
        "pencil or accessible response tool",
        "squaring and cubing reference table (permitted for every learner)",
    ],
    "lesson_flow": [
        {
            "segment": "Welcome and orientation",
            "minutes": "3–5",
            "teacher_or_tutor_action": "State that this is independent mastery evidence for 8.EE.2, name the permitted supports, and confirm the learner may use two sittings.",
        },
        {
            "segment": "Assessment administration",
            "minutes": "35–45",
            "teacher_or_tutor_action": "Administer ma-g8-mathematics-c01-assessment (30 points, 6 prompts) with no instructional prompting. Do not model, hint, or correct during the assessment.",
        },
        {
            "segment": "Verification pass",
            "minutes": "3–7",
            "teacher_or_tutor_action": "Invite the learner to re-check two answers with the inverse operation before submitting, as the assessment itself requires.",
        },
        {
            "segment": "Collection and scoring",
            "minutes": "0",
            "teacher_or_tutor_action": "Score against the accepted rubric dimensions in curriculum-release-corrections/grade8-mathematics/assessment.json. Record the evidence occasion; do not mark mastery from this occasion alone.",
        },
        {
            "segment": "Next step",
            "minutes": "2–5",
            "teacher_or_tutor_action": "Record one next instructional step from the mastery interpretation band, and schedule the second occasion of evidence in Unit 8, where solving x² = p recurs.",
        },
    ],
    "student_activity": "Learner completes ma-g8-mathematics-c01-assessment independently and records both results and the reasoning that produced them.",
    "formative_check": "Before submitting, the learner names one answer verified with the inverse operation and one value reported in exact rather than rounded form.",
    "answer_or_scoring_guidance": "Score against the five rubric dimensions of ma-g8-mathematics-c01-assessment. Accept multiple valid approaches when they meet the criteria. Do not infer effort, motivation, diagnosis, or character from an error.",
    "adaptive_tutor_routes": [
        {"signal": "prerequisite gap", "action": "Return to the squaring-and-cubing inverse relationship with a concrete area or volume model, then retry one fresh item."},
        {"signal": "procedure without understanding", "action": "Ask the learner to explain why √p names the non-negative solution before continuing."},
        {"signal": "correct but low confidence", "action": "Confirm the reasoning specifically and avoid unnecessary remediation."},
        {"signal": "repeated error pattern", "action": "Name the observable pattern neutrally — most often reporting a decimal where an exact root is required — contrast it with a worked example, and schedule a short review."},
        {"signal": "mastery evidence", "action": "Require a second occasion of accurate independent evidence, taken in Unit 8 where x² = p recurs, before marking 8.EE.2 mastered."},
    ],
    "mastery_rule": "Do not mark 8.EE.2 mastered from this assessment alone. Require accurate independent evidence and successful transfer or retrieval on at least two occasions when feasible.",
    "extension": "Apply exact root reasoning under a new constraint, or explain to another person why a rounded side length is not the exact side length, without completing another learner's graded work.",
    "accessibility_and_accommodations": [
        "Permit a squaring and cubing reference table for every learner; the target is root reasoning, not recall of the table.",
        "Accept spoken, typed, handwritten, drawn, or manipulatives-based responses.",
        "Allow extended time and a hidden timer; allow completion across two sittings.",
        "Provide read-aloud support and reduced-copying formats; do not require the learner to transcribe the prompts.",
        "Preserve the learning target while adjusting quantity, pacing, representation, or response mode.",
        "The formal proof of the irrationality of √2 is never required for mastery at this grade.",
    ],
    "safety_and_privacy": [
        "Use respectful, non-shaming language.",
        "Allow a pause, break, or alternate response mode without treating it as failure.",
    ],
    "media": {
        "suggestion": "Optional squaring and cubing reference table.",
        "required": False,
        "fallback": "Provide the same information as readable steps or a spoken list.",
    },
    "parent_or_guardian_visibility": "Share the lesson target, completion state, evidence type, and next instructional step. Do not expose raw private reflections, raw answers, or diagnosis language.",
    "home_connection": "No home task is required on an assessment day.",
    "correction_metadata": {
        "correction_id": CORRECTION_ID,
        "integration_id": INTEGRATION_ID,
        "role": "delivery-day record for the accepted correction assessment",
        "administers_assessment_id": "ma-g8-mathematics-c01-assessment",
        "closes_standard": "8.EE.2",
        "authored_by": "integration",
    },
}


def sealed_lessons():
    with open(os.path.join(COURSE, "lessons.jsonl")) as fh:
        rows = [json.loads(line) for line in fh if line.strip()]
    rows.sort(key=lambda r: r["course_day"])
    return rows


def overlay_lessons():
    with open(os.path.join(OVERLAY, "lessons.jsonl")) as fh:
        return [json.loads(line) for line in fh if line.strip()]


def build():
    sealed = sealed_lessons()
    overlay = overlay_lessons()
    overlay.sort(key=lambda r: r["course_day"])
    new_block = overlay + [L22]

    required = []
    for row in sealed:
        if row["lesson_id"] in WITHDRAWN:
            continue
        required.append(row)
        if row["lesson_id"] == INSERT_AFTER:
            required.extend(new_block)

    assert len(required) == 180, len(required)

    # schedule.csv
    sched_path = os.path.join(HERE, "schedule.csv")
    with open(sched_path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow([
            "course_day", "lesson_id", "unit_number", "unit_title", "day_in_unit",
            "phase", "focus", "standards", "origin", "sealed_course_day",
        ])
        for day, row in enumerate(required, start=1):
            origin = "sealed-1.0.0" if row["lesson_id"] not in {r["lesson_id"] for r in new_block} else (
                "overlay-e9ead0c" if row["lesson_id"] != "ma-g8-mathematics-u01-l22" else "integration"
            )
            w.writerow([
                day, row["lesson_id"], row["unit_number"], row["unit_title"],
                row.get("day_in_unit", ""), row["phase"], row["focus"],
                " ".join(row["standards"]), origin,
                row["course_day"] if origin == "sealed-1.0.0" else "",
            ])

    # lesson-mapping.csv — every sealed lesson plus every new lesson
    new_day = {row["lesson_id"]: day for day, row in enumerate(required, start=1)}
    map_path = os.path.join(HERE, "lesson-mapping.csv")
    with open(map_path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow([
            "lesson_id", "sealed_course_day", "integrated_course_day", "shift",
            "delivery", "treatment",
        ])
        for row in sealed:
            lid = row["lesson_id"]
            if lid in WITHDRAWN:
                w.writerow([lid, row["course_day"], "", "", "reserve",
                            "withdrawn from required path; absorbed by " + WITHDRAWN[lid]["absorbed_by"]])
            else:
                d = new_day[lid]
                w.writerow([lid, row["course_day"], d, d - row["course_day"], "required", "unchanged content"])
        for row in new_block:
            lid = row["lesson_id"]
            w.writerow([lid, "", new_day[lid], "", "required",
                        "added by correction" if lid != "ma-g8-mathematics-u01-l22" else "added by integration (delivery day for c01 assessment)"])

    # daily-schedule-grade8.csv — period_1 re-sequenced, all other periods byte-identical
    src = os.path.join(RELEASE, "grades", "grade-8", "daily-schedule.csv")
    with open(src, newline="") as fh:
        rows = list(csv.reader(fh))
    header, body = rows[0], rows[1:]
    assert len(body) == 180
    for i, r in enumerate(body):
        r[2] = required[i]["lesson_id"]
    with open(os.path.join(HERE, "daily-schedule-grade8.csv"), "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(body)

    # lessons.integration.jsonl
    with open(os.path.join(HERE, "lessons.integration.jsonl"), "w") as fh:
        fh.write(json.dumps(L22, ensure_ascii=False) + "\n")

    # integration-manifest.json
    unit_days = {}
    for day, row in enumerate(required, start=1):
        unit_days.setdefault(row["unit_number"], []).append(day)
    manifest = {
        "integration_id": INTEGRATION_ID,
        "title": "Grade 8 Mathematics — 8.EE.2 correction, 180-day integration",
        "created_on": "2026-08-12",
        "integrates_correction": CORRECTION_ID,
        "integrates_commit": "e9ead0c",
        "targets_release": "manuel-academy-grades-5-7-8-curriculum-v1 1.0.0",
        "produces_release": "1.0.1 (proposed; 1.0.0 is not edited)",
        "target_course_id": "ma-g8-mathematics",
        "status": "planned-not-applied",
        "sealed_release_modified": False,
        "decision": {
            "chosen": "A-prime \u2014 insertion at the topical point, funded by withdrawal of four redundant Unit 10 recycle days",
            "schedule_length_days": 180,
            "extension_option_rejected": "184 days (not 183: the accepted overlay carries an assessment that needs its own delivery day). Rejected — the sealed lesson schema caps course_day at 180.",
            "overlay_option_a_amended": "The overlay recommended substituting Unit 1 days u01-l08/l13/l14. Amended: Unit 1's 8.NS.1 and 8.NS.2 are unique to Unit 1, whereas every Unit 10 standard is instructed and assessed in an earlier dedicated unit. Funding the days from Unit 10 costs strictly less coverage.",
        },
        "insertion": {
            "after_lesson_id": INSERT_AFTER,
            "days": [19, 20, 21, 22],
            "lesson_ids": [r["lesson_id"] for r in new_block],
            "course_day_matches_overlay_as_authored": True,
        },
        "withdrawn": [
            {
                "lesson_id": lid,
                "sealed_course_day": next(r["course_day"] for r in sealed if r["lesson_id"] == lid),
                **meta,
            }
            for lid, meta in WITHDRAWN.items()
        ],
        "counts": {
            "required_scheduled_days": len(required),
            "authored_math_lesson_records": len(sealed) + len(new_block),
            "required_lesson_records": len(required),
            "reserve_lesson_records": len(WITHDRAWN),
            "unit_day_counts": {str(k): len(v) for k, v in sorted(unit_days.items())},
        },
        "shift_summary": {
            "days_1_to_18": "unchanged",
            "days_19_to_22": "new 8.EE.2 correction block",
            "units_2_to_9": "+4 days",
            "unit_10": "starts at day 167; 14 required days",
        },
    }
    with open(os.path.join(HERE, "integration-manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print("required days:", len(required))
    print("unit day counts:", {k: len(v) for k, v in sorted(unit_days.items())})
    print("wrote schedule.csv lesson-mapping.csv daily-schedule-grade8.csv "
          "lessons.integration.jsonl integration-manifest.json")


if __name__ == "__main__":
    build()
