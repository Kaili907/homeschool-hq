"""Expand course_spec.py into a Curriculum Authoring Schema Set 2.0.0 authoring set.

Run:  python3 tools/build_authoring_set.py
Then: node --experimental-strip-types validation/validate.mjs
"""
import json, os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "authoring-set")
sys.path.insert(0, HERE)

import course_spec as spec
import standards_data

SSV = "2.0.0"
POLICY_ID = "manuel-academy-hs-science-policy"
FRAMEWORK_ID = "michigan-science-standards-2015"
CURRICULUM_ID = "manuel-academy-highschool-9-12-science"
DRAFT_VERSION = "0.1.0"

# ---------------------------------------------------------------- phase arc
# Matches the Grade 8 anchor's 12-day unit arc so the courses read continuously.
PHASES = [
    "Launch and diagnostic", "Concept model A", "Guided practice A", "Independent application A",
    "Concept model B", "Guided practice B", "Investigation", "Reteach and varied practice",
    "Performance task build", "Synthesis and review", "Unit assessment", "Correction and reflection",
]
INVESTIGATION_DAY = 7
ASSESSMENT_DAY = 11

SEGMENTS = [
    ("retrieval", "Retrieval and phenomenon check", 5, 7),
    ("instruction", "Model or mini-lesson", 10, 14),
    ("guided", "Guided practice", 12, 16),
    ("independent", "Independent application", 20, 28),
    ("close", "Exit evidence and next step", 8, 10),
]

TUTOR_ROUTES = [
    ("prerequisite-gap", "prerequisite-reteach",
     {"representation": "concrete", "retry_count": 1, "require_explanation": True}),
    ("procedure-without-understanding", "conceptual-explanation",
     {"representation": "visual", "require_explanation": True}),
    ("correct-low-confidence", "confidence-calibration",
     {"representation": "text", "retry_count": 0, "require_explanation": False}),
    ("repeated-error-pattern", "error-pattern-contrast",
     {"representation": "worked-example", "retry_count": 2, "review_timing": "next-session"}),
    ("mastery-evidence", "mastery-evidence-collection",
     {"evidence_type": "application", "require_explanation": True, "review_timing": "same-day"}),
]

GLOBAL_STOP = [
    "Stop for any injury, burn, spill, fume, or allergic reaction and tell the supervising adult.",
    "Stop if a material, tool, or step is not the one this lesson specifies.",
    "A pause, break, or switch to the alternative activity is never treated as failure.",
]
GLOBAL_PRIVACY = [
    "Records the learning target, completion state, evidence type, and next step only.",
    "Stores no raw reflection text, no free-text answers, no photograph, no video, and no voice recording.",
    "Requires no camera or video proof of any activity.",
    "Collects no learner body measurement, health measurement, or medical information.",
    "Requires no account creation, purchase, or disclosure of the family's location.",
]
NON_DISABLEABLE = [
    "Never mix household cleaning products; bleach combined with ammonia or acid releases toxic gas.",
    "Never connect any investigation to mains electricity; low-voltage cells only.",
    "Never look at the sun directly or through any lens, filter, grating, or camera.",
    "Never require a photograph, video, or voice recording as evidence of completion.",
    "Never request or record a learner body measurement, health measurement, or medical history.",
    "Never present invented measurements as real experimental results.",
]

EXT_NAMESPACES = [
    {"namespace": "manuel.academy/lab-alternative", "value_schema_ref": "lab-alternative-v1",
     "allowed_projection": "student-safe"},
    {"namespace": "manuel.academy/data-provenance", "value_schema_ref": "data-provenance-v1",
     "allowed_projection": "student-safe"},
    {"namespace": "manuel.academy/standards-role", "value_schema_ref": "standards-role-v1",
     "allowed_projection": "student-safe"},
    {"namespace": "manuel.academy/sequence-note", "value_schema_ref": "sequence-note-v1",
     "allowed_projection": "student-safe"},
]


def ext(namespace, schema_ref, key, text):
    return {"namespace": namespace, "key": key, "schema_ref": schema_ref,
            "projection": "student-safe", "value": {"type": "string", "value": text[:2000]}}


def std_ref(pe):
    return {"framework_ref": FRAMEWORK_ID, "standard_id": pe, "mapping_status": "canonical"}


def uid(course_id, unit_no, lesson_no=None):
    base = f"{course_id}-u{unit_no:02d}"
    return base if lesson_no is None else f"{base}-l{lesson_no:02d}"


# ---------------------------------------------------------------- resources
def build_resources():
    r = [
        dict(schema_set_version=SSV, resource_id="res-hs-science-lab-safety-card", kind="document",
             title="Manuel Academy home laboratory safety card",
             locator="curriculum-authoring/full-family-highschool-9-12/subjects/science/lab-safety-framework.md",
             rights="Manuel Academy original; freely reusable by the family.", required=False,
             text_fallback="Readable text: hazard classes, supervision levels, stop conditions, and the non-disableable prohibitions."),
        dict(schema_set_version=SSV, resource_id="res-hs-science-mastery-evidence-guide", kind="document",
             title="Evidence and multi-occasion mastery guide",
             locator="curriculum-authoring/full-family-highschool-9-12/subjects/science/authoring-set/policy-set.json",
             rights="Manuel Academy original; freely reusable by the family.", required=False,
             text_fallback="Readable text: what counts as evidence, and why one correct answer never establishes mastery."),
    ]
    for c in spec.COURSES:
        r.append(dict(schema_set_version=SSV, resource_id=f"res-{c['course_id']}-investigation-guide",
                      kind="document", title=f"{c['title']} investigation and alternative-path guide",
                      locator=f"curriculum-authoring/full-family-highschool-9-12/subjects/science/course-guides/{c['course_id']}.md",
                      rights="Manuel Academy original; freely reusable by the family.", required=False,
                      text_fallback="Readable text: for each unit, the investigation, its hazards, its supervision level, and its no-special-equipment alternative."))
        r.append(dict(schema_set_version=SSV, resource_id=f"res-{c['course_id']}-data-sources",
                      kind="document", title=f"{c['title']} published data source list",
                      locator=f"curriculum-authoring/full-family-highschool-9-12/subjects/science/course-guides/{c['course_id']}.md",
                      rights="Names third-party sources; the family retrieves them under the sources' own terms. No third-party content is embedded.",
                      required=False,
                      text_fallback="Readable text: which published dataset each unit uses, and what the learner must generate themselves."))
    return r


# ---------------------------------------------------------------- lessons
def objectives(unit, focus, phase, day):
    core = [
        f"Explain {focus} using evidence, a model, or a documented process rather than an unsupported answer.",
        f"Apply {focus} to a task the learner has not seen before, showing the reasoning that produced the result.",
        f"Check and revise the work on {focus} against the stated success criteria and name the next step.",
    ]
    if day == 1:
        core.insert(0, f"Observe the anchoring phenomenon, surface initial thinking about {focus} without penalty, and pose a testable question.")
    if day == INVESTIGATION_DAY:
        core.insert(0, f"Plan and carry out a safe investigation of {focus}, or its stated alternative, and record the learner's own data with its uncertainty.")
    if day == 9:
        core.insert(0, f"Produce performance-task evidence for {focus} that a reader could check independently.")
    if day == ASSESSMENT_DAY:
        core.insert(0, f"Demonstrate independent mastery evidence for {focus} on a fresh task.")
    return core


def criteria(unit, focus, day):
    base = [
        f"The learner completes the central task about {focus}.",
        "The learner supplies evidence, reasoning, a model, or a documented process, not a bare answer.",
        "The learner checks or revises the work and identifies one specific next step.",
        "Any quantity the learner reports is one the learner measured, computed, or cited to a named published source.",
    ]
    if day == INVESTIGATION_DAY:
        base.append("The learner states the investigation's limitations and what the data cannot show.")
        base.append("The learner records the safety review and the supervision that was actually in place.")
    return base


def flow(unit, focus, phase, day, inv):
    a = []
    for seg_id, seg_title, lo, hi in SEGMENTS:
        if seg_id == "retrieval":
            act = (f"Open with the unit phenomenon - {unit['phenomenon']} - or a short retrieval prompt on {focus}. "
                   "Ask the learner to notice, predict, estimate, or question before any instruction. Record the prediction; it is not graded.")
        elif seg_id == "instruction":
            act = (f"Develop {focus} from the phenomenon: pose the testable question, build or use a model, and show how evidence "
                   f"constrains the explanation. Name the success criteria and demonstrate how to check the work. Phase focus: {phase}.")
            if day == INVESTIGATION_DAY:
                act = (f"Before any materials are handled, review the investigation's hazards, the required supervision level, and every stop "
                       f"condition with the guardian present. Then model the procedure for: {inv['title']}. Confirm which path the family is "
                       "running - the investigation or its no-special-equipment alternative. Both meet the same target.")
        elif seg_id == "guided":
            act = (f"Work two supported examples on {focus}, asking after each move: what evidence or reasoning supports that step? "
                   "Fade the prompting on the second example and have the learner narrate the check.")
            if day == INVESTIGATION_DAY:
                act = (f"Set up and run the first trial together, or the first step of the alternative. Establish how each measurement is taken, "
                       "how uncertainty is recorded, and how a trial that goes wrong is written down rather than discarded.")
        elif seg_id == "independent":
            act = (f"The learner completes a new application of {focus} independently and records both the result and the reasoning, evidence, "
                   "process, or design choice that produced it.")
            if day == INVESTIGATION_DAY:
                act = (f"The learner runs the remaining trials and records their own data. No expected value is supplied beforehand and no result "
                       "is ever filled in for the learner. If the data is messy, the learner writes down what happened and why it may have happened.")
            if day == ASSESSMENT_DAY:
                act = ("The learner completes the unit assessment independently. The tutor may clarify what a prompt is asking but supplies no "
                       "answer, no worked solution, and no evaluation of correctness during the assessment.")
            if day == 12:
                act = ("The learner reworks the specific items missed, using a fresh parallel task rather than the original item, and writes what "
                       "changed in their thinking.")
        else:
            act = (f"In one concise response, the learner shows or explains the most important idea about {focus}, then names one check that "
                   "would catch an error or a weak claim in their own work.")
        a.append({"segment_id": f"{seg_id}", "title": seg_title,
                  "duration": {"minimum_minutes": lo, "maximum_minutes": hi},
                  "teacher_or_tutor_action": act})
    return a


def safety_for(unit, day, inv):
    """Investigation day carries the unit's full hazard set; other days carry the baseline."""
    if day == INVESTIGATION_DAY:
        hazards = [{"kind": k, "description": d[:240], "mitigation": m[:240]} for k, d, m in inv["hazards"]]
        supervision, visibility = inv["supervision"], inv["visibility"]
        stops = list(inv["stop"]) + GLOBAL_STOP
    else:
        hazards = [{"kind": "physical",
                    "description": "Desk-based work only; no chemicals, heat, electricity, or tools are used in this lesson.",
                    "mitigation": "Materials are notebook, writing tool, and printed or on-screen text. Any hands-on extension defers to the unit investigation's safety review."}]
        supervision, visibility = "none", "summary"
        stops = list(GLOBAL_STOP)
    return {
        "policy_ref": POLICY_ID,
        "hazards": hazards[:20],
        "sensitivity": ["Content is academic; no personal, family, health, or location disclosure is requested."],
        "supervision": supervision,
        "guardian_visibility": visibility,
        "stop_conditions": stops[:20],
        "privacy_declarations": list(GLOBAL_PRIVACY),
        "academic_integrity_mode": "independent-graded" if day == ASSESSMENT_DAY else "practice-support",
    }


def build_lesson(course, unit, unit_no, day, course_day):
    focus = unit["topics"][(day - 1) % 6]
    phase = PHASES[day - 1]
    inv = unit["investigation"]
    cid = course["course_id"]
    evidence = ["explanation", "application"]
    if day in (INVESTIGATION_DAY, 9):
        evidence = evidence + ["performance"]
    elif day == ASSESSMENT_DAY:
        evidence = evidence + ["error-analysis"]
    else:
        evidence = evidence + ["retrieval"]

    materials = ["course notebook or digital equivalent", "pencil, keyboard, or other accessible response tool"]
    if day == INVESTIGATION_DAY:
        materials = list(inv["materials"]) + ["eye protection where the hazard list requires it"] + materials
    else:
        materials.append("printed or on-screen text, data table, or model for this lesson")

    resource_refs = ["res-hs-science-lab-safety-card", f"res-{cid}-investigation-guide"]
    if day in (INVESTIGATION_DAY, 9, 10):
        resource_refs.append(f"res-{cid}-data-sources")
    if day in (ASSESSMENT_DAY, 12):
        resource_refs.append("res-hs-science-mastery-evidence-guide")

    exts = [
        ext("manuel.academy/standards-role", "standards-role-v1", "role",
            "Primary coverage: " + (", ".join(s.upper() for s in unit["standards"]) or "practice foundation; no performance expectation is claimed for this unit.")
            + (". Reinforced: " + ", ".join(s.upper() for s in unit["reinforces"]) if unit["reinforces"] else "")),
        ext("manuel.academy/data-provenance", "data-provenance-v1", "provenance", inv["data_source"]),
    ]
    if day == INVESTIGATION_DAY:
        exts.append(ext("manuel.academy/lab-alternative", "lab-alternative-v1", "alternative", inv["alternative"]))
    else:
        exts.append(ext("manuel.academy/lab-alternative", "lab-alternative-v1", "alternative",
                        "No special equipment is needed for this lesson; it is notebook and text based. The unit investigation on Day 7 carries the full alternative path."))

    scoring = ("Score the stated learning target: accuracy, quality of evidence and reasoning, and evidence of checking or revision. "
               "Accept any valid approach that meets the criteria. Do not infer effort, motivation, diagnosis, or character from an error. "
               "Do not award credit for a numerical result that the learner did not measure, compute, or cite to a named source.")
    if day == ASSESSMENT_DAY:
        scoring = ("Score against the unit assessment rubric and its protected interpretation. A unit score is one evidence source and does not "
                   "by itself establish mastery; the policy floor still requires independent evidence on a second occasion and a separate date.")

    return {
        "schema_set_version": SSV,
        "lesson_id": uid(cid, unit_no, day),
        "course_ref": cid,
        "unit_ref": uid(cid, unit_no),
        "grade": course["grade"],
        "subject": "science",
        "course_day": course_day,
        "day_in_unit": day,
        "title": f"{phase}: {focus}",
        "phase": phase,
        "focus": focus,
        "estimated_duration": {"minimum_minutes": 55, "maximum_minutes": 75},
        "standards": [std_ref(s) for s in (unit["standards"] or unit["reinforces"])],
        "essential_question": unit["essential_question"],
        "learning_objectives": objectives(unit, focus, phase, day),
        "success_criteria": criteria(unit, focus, day),
        "materials": materials[:100],
        "lesson_flow": flow(unit, focus, phase, day, inv),
        "student_activity": flow(unit, focus, phase, day, inv)[3]["teacher_or_tutor_action"],
        "formative_check": (f"In one concise response, show or explain the most important idea about {focus}, then name one check that would "
                            "catch an error or a weak claim."),
        "scoring_guidance": scoring,
        "mastery": {
            "policy_ref": POLICY_ID, "minimum_occasions": 2, "minimum_distinct_dates": 2,
            "independent_evidence_required": True, "evidence_types": evidence,
            "transfer_requirement": "novel-context",
        },
        "tutor_routes": [{"signal": s, "strategy": st, "parameters": p} for s, st, p in TUTOR_ROUTES],
        "extension_activity": (f"Apply {focus} under a new constraint, compare two approaches or two sources, or teach the idea with an original "
                               "example. Extension never means completing another learner's graded work."),
        "accessibility": {
            "policy_ref": POLICY_ID, "text_fallback": "required", "keyboard": "required",
            "caption_or_transcript": "required-when-media", "alt_or_long_description": "required-when-visual",
            "reduced_motion": "available", "high_contrast": "available", "extended_time": True,
            "timer_accommodation": "hidden", "movement_break": True,
            "response_modes": ["typed", "handwritten", "spoken", "drawn", "manipulative", "demonstrated"],
        },
        "safety_privacy": safety_for(unit, day, inv),
        "resource_refs": resource_refs,
        "guardian_visibility_note": (
            "Share the lesson target, completion state, evidence type, and next instructional step. For the Day 7 investigation, share the hazard "
            "list, the supervision level, and the stop conditions BEFORE the session so the guardian can review them in advance. Do not expose raw "
            "reflections, raw answers, or diagnosis language."),
        "home_connection": (f"Notice one safe, optional example of {focus} in ordinary life and describe it in a sentence. No purchase, account, "
                            "photograph, travel, or private disclosure is required, and this is never graded."),
        "extensions": exts,
    }


# ---------------------------------------------------------------- assessment
PROMPTS = [
    ("concept-vocabulary", 4, "Explain {focus} in your own words and give or identify a valid example."),
    ("representation-source", 5, "Use a diagram, model, graph, data display, or worked process to show your understanding of {t1}."),
    ("application", 6, "Apply {t2} in a situation you have not seen before. Show the process or cite the evidence you used."),
    ("error-claim-analysis", 6, "Analyse a plausible error, weak claim, unsafe choice, or design flaw involving {t3}; correct it and explain why the correction holds."),
    ("connection", 5, "Connect {focus} with {t5}. Explain how the two ideas support, constrain, contrast with, or build on one another."),
    ("performance-evidence", 8, "Present your strongest evidence from the unit performance task: {task} State one limitation of that evidence."),
    ("reflection-transfer", 4, "Name one skill you can now transfer, one check that improves your accuracy, and one question you still have."),
]


def build_assessment(course, unit, unit_no):
    cid = course["course_id"]
    aid = f"{uid(cid, unit_no)}-assessment"
    t = unit["topics"]
    prompts = []
    for i, (ptype, pts, tmpl) in enumerate(PROMPTS, start=1):
        text = tmpl.format(focus=t[0], t1=t[1], t2=t[2], t3=t[3], t5=t[5], task=unit["performance_task"])
        prompts.append({"prompt_id": f"{aid}-p{i:02d}", "type": ptype, "prompt": text, "points": pts,
                        "resource_refs": [f"res-{cid}-data-sources"] if ptype in ("representation-source", "performance-evidence") else []})
    total = sum(p["points"] for p in prompts)
    assessment = {
        "schema_set_version": SSV, "assessment_id": aid, "course_ref": cid, "unit_ref": uid(cid, unit_no),
        "title": f"{unit['title']} - unit assessment",
        "standards": [std_ref(s) for s in (unit["standards"] or unit["reinforces"])],
        "total_points": total, "prompts": prompts,
        "rubric_dimensions": ["accuracy or fidelity", "evidence and reasoning", "application or transfer",
                              "checking and revision", "safety and honest reporting"],
        "accommodation_note": ("Any response mode the standard permits is acceptable: typed, handwritten, spoken, drawn, built, or demonstrated. "
                               "Extended time and a hidden timer are available by default. Reading the prompts aloud is allowed. No photograph, "
                               "video, or voice recording is required. Adjust quantity, pacing, or representation while preserving the target."),
        "protected_interpretation_ref": f"{aid}-interpretation",
        "extensions": [ext("manuel.academy/standards-role", "standards-role-v1", "role",
                           "Primary coverage: " + (", ".join(s.upper() for s in unit["standards"]) or "practice foundation."))],
    }
    interpretation = {
        "schema_set_version": SSV, "interpretation_id": f"{aid}-interpretation", "assessment_ref": aid,
        "secure_minimum_percent": 85, "developing_minimum_percent": 70, "not_yet_maximum_percent": 69,
        "mastery_rule": ("A unit score is one evidence source and never establishes mastery on its own. The policy floor still requires accurate "
                         "independent evidence on at least two occasions across at least two distinct dates, including transfer to a novel context. "
                         "Reassessment uses fresh items or a new application after targeted instruction, and replaces the earlier score."),
        "prompt_scoring": [{"prompt_ref": p["prompt_id"], "scoring_guidance": _scoring_for(p["type"], unit)} for p in prompts],
        "extensions": [],
    }
    return assessment, interpretation


def _scoring_for(ptype, unit):
    m = {
        "concept-vocabulary": "Full credit for an accurate explanation in the learner's own words plus a valid example. Half credit for a correct definition with no example or an example that does not fit.",
        "representation-source": "Full credit when the representation is accurate, labelled, and actually carries the reasoning. Deduct when the representation is decorative or when axes, units, or scales are missing.",
        "application": "Full credit for a correct result in a genuinely new situation WITH the process or evidence shown. A correct answer with no visible reasoning earns partial credit only.",
        "error-claim-analysis": "Full credit for identifying the specific error, correcting it, and explaining why the correction holds. Naming the error without the reasoning earns partial credit.",
        "connection": "Full credit for a specific, defensible relationship between the two ideas. Generic statements that the ideas are 'related' earn no credit.",
        "performance-evidence": ("Full credit for evidence the learner actually produced, presented so a reader could check it, with one honest limitation stated. "
                                 "Award NO credit for any quantity the learner did not measure, compute, or cite to a named published source."),
        "reflection-transfer": "Credit for specificity, not for sentiment. A named skill, a named check, and a real question. Never score reflection on attitude, effort, or character.",
    }
    return m[ptype]


# ---------------------------------------------------------------- assembly
def build():
    courses, units, lessons, assessments, interpretations, schedules = [], [], [], [], [], []
    for course in spec.COURSES:
        cid, unit_refs = course["course_id"], []
        course_day = 0
        course_pes = []
        for unit_no, unit in enumerate(course["units"], start=1):
            u_id = uid(cid, unit_no)
            unit_refs.append(u_id)
            lesson_refs = []
            for day in range(1, 13):
                course_day += 1
                lesson = build_lesson(course, unit, unit_no, day, course_day)
                lessons.append(lesson)
                lesson_refs.append(lesson["lesson_id"])
            a, i = build_assessment(course, unit, unit_no)
            assessments.append(a); interpretations.append(i)
            for s in unit["standards"]:
                if s not in course_pes:
                    course_pes.append(s)
            units.append({
                "schema_set_version": SSV, "unit_id": u_id, "course_ref": cid, "grade": course["grade"],
                "subject": "science", "order": unit_no, "title": unit["title"], "days": 12,
                "standards": [std_ref(s) for s in (unit["standards"] or unit["reinforces"])],
                "essential_question": unit["essential_question"], "topics": unit["topics"],
                "performance_task": unit["performance_task"], "lesson_refs": lesson_refs,
                "assessment_ref": a["assessment_id"],
                "extensions": [
                    ext("manuel.academy/sequence-note", "sequence-note-v1", "phenomenon",
                        "Anchoring phenomenon: " + unit["phenomenon"]),
                    ext("manuel.academy/lab-alternative", "lab-alternative-v1", "alternative",
                        "Day 7 investigation: " + unit["investigation"]["title"] + " | No-special-equipment alternative: "
                        + unit["investigation"]["alternative"]),
                    ext("manuel.academy/standards-role", "standards-role-v1", "role",
                        "Primary: " + (", ".join(s.upper() for s in unit["standards"]) or "practice foundation; no performance expectation claimed.")
                        + (" | Reinforced: " + ", ".join(s.upper() for s in unit["reinforces"]) if unit["reinforces"] else "")),
                ],
            })
        courses.append({
            "schema_set_version": SSV, "course_id": cid, "grade": course["grade"], "subject": "science",
            "title": course["title"], "description": course["description"], "capstone": course["capstone"],
            "days": 108, "order": course["order"], "unit_refs": unit_refs,
            "standards": [std_ref(s) for s in course_pes],
            "extensions": [
                ext("manuel.academy/sequence-note", "sequence-note-v1", "credit-role", course["credit_role"]),
                ext("manuel.academy/sequence-note", "sequence-note-v1", "placement",
                    "Grade placement is a Manuel Academy decision. Michigan prescribes science content expectations and credit counts, "
                    "not the year in which a course is taken. See sequence-design.md section 3."),
            ],
        })
        # one schedule per course: 36 weeks x 3 sessions (days 1, 3, 5)
        entries, idx = [], 0
        course_lessons = [l["lesson_id"] for l in lessons if l["course_ref"] == cid]
        for week in range(1, 37):
            for day in (1, 3, 5):
                entries.append({"week": week, "day": day, "lesson_refs": [course_lessons[idx]]})
                idx += 1
        schedules.append({"schema_set_version": SSV, "schedule_id": f"{cid}-schedule", "grade": course["grade"],
                          "weeks": 36, "instructional_days": 108, "entries": entries})

    resources = build_resources()
    policy = {
        "schema_set_version": SSV, "policy_set_id": POLICY_ID,
        "title": "Manuel Academy High School Science 9-12 policy set",
        "mastery_floor": {"policy_ref": POLICY_ID, "minimum_occasions": 2, "minimum_distinct_dates": 2,
                          "independent_evidence_required": True,
                          "evidence_types": ["explanation", "application"],
                          "transfer_requirement": "novel-context"},
        "tutor_authority": {"reveals_answers": False, "gives_final_graded_answer": False,
                            "controls_graded_work_policy": False},
        "safety_privacy": {"non_disableable_prohibitions": NON_DISABLEABLE,
                           "required_privacy_declarations": GLOBAL_PRIVACY},
        "extension_namespaces": EXT_NAMESPACES,
    }
    framework = standards_data.build_framework(FRAMEWORK_ID, SSV)
    manifest = {
        "schema_set_version": SSV, "curriculum_id": CURRICULUM_ID, "draft_version": DRAFT_VERSION,
        "status": "draft",
        "title": "Manuel Academy High School Science, Grades 9-12",
        "policy_set_ref": POLICY_ID, "framework_refs": [FRAMEWORK_ID],
        "course_refs": [c["course_id"] for c in courses],
        "schedule_refs": [s["schedule_id"] for s in schedules],
        "resource_refs": [r["resource_id"] for r in resources],
        "counts": {"courses": len(courses), "units": len(units), "lessons": len(lessons),
                   "assessments": len(assessments), "schedules": len(schedules), "resources": len(resources)},
    }
    return dict(manifest=manifest, courses=courses, units=units, lessons=lessons, assessments=assessments,
                assessment_interpretations=interpretations, schedules=schedules,
                standard_frameworks=[framework], resources=resources, policy_sets=[policy])


def write(aset):
    os.makedirs(os.path.join(OUT, "lessons"), exist_ok=True)
    def dump(name, obj):
        with open(os.path.join(OUT, name), "w") as f:
            json.dump(obj, f, indent=1, ensure_ascii=False)
            f.write("\n")
    dump("manifest.json", aset["manifest"])
    dump("policy-set.json", aset["policy_sets"][0])
    dump("standard-framework.json", aset["standard_frameworks"][0])
    dump("courses.json", aset["courses"])
    dump("units.json", aset["units"])
    dump("assessments.json", aset["assessments"])
    dump("assessment-interpretations.json", aset["assessment_interpretations"])
    dump("schedules.json", aset["schedules"])
    dump("resources.json", aset["resources"])
    for c in aset["courses"]:
        path = os.path.join(OUT, "lessons", f"{c['course_id']}.lessons.jsonl")
        with open(path, "w") as f:
            for l in aset["lessons"]:
                if l["course_ref"] == c["course_id"]:
                    f.write(json.dumps(l, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    aset = build()
    write(aset)
    m = aset["manifest"]["counts"]
    print(f"courses={m['courses']} units={m['units']} lessons={m['lessons']} "
          f"assessments={m['assessments']} schedules={m['schedules']} resources={m['resources']}")
