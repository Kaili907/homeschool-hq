#!/usr/bin/env python3
"""Generate the Grade 3 and Grade 4 mathematics course packages.

Reads the authored blueprints and emits every course artifact under
curriculum-authoring/full-family-grade34/subjects/mathematics/.

Run:  python3 generate.py
"""
import csv, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arc
import blueprint_g3, blueprint_g4
import standards_catalog as SC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKAGE_ID = "manuel-academy-grade34-mathematics"
VERSION = "1.0.0"
AUTHORED_ON = "2026-08-12"
SCHEMA_VERSION = "1.0"
WEEKS = 36
DAYS_PER_WEEK = 5
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

GRADES = {3: blueprint_g3, 4: blueprint_g4}
SESSION_MINUTES = {3: "30-45", 4: "40-55"}

# --- Adaptive Math compatibility -------------------------------------------
# The frozen adaptive-math package (adaptive-tutor/subjects/math, gradeBand
# 4-6) exposes exactly four sequences. Grade 4 units are marked ONLY where the
# skill genuinely aligns. Nothing is copied, rewritten, or modified.
FROZEN_SEQUENCES = {
    "math-seq-pv-regroup-v1": "Place Value and Regrouping",
    "math-seq-mult-div-rel-v1": "Multiplication and Division Relationships",
    "math-seq-equivalent-fractions-v1": "Equivalent Fractions and Common Denominators",
    "math-seq-multistep-word-problems-v1": "Multistep Word-Problem Reasoning",
}
ADAPTIVE_ALIGNMENT = {
    (4, 1): ["math-seq-pv-regroup-v1"],
    (4, 2): ["math-seq-pv-regroup-v1", "math-seq-multistep-word-problems-v1"],
    (4, 3): ["math-seq-mult-div-rel-v1"],
    (4, 4): ["math-seq-mult-div-rel-v1", "math-seq-multistep-word-problems-v1"],
    (4, 5): ["math-seq-mult-div-rel-v1", "math-seq-multistep-word-problems-v1"],
    (4, 6): ["math-seq-equivalent-fractions-v1"],
    (4, 7): ["math-seq-equivalent-fractions-v1"],
}

ACCESSIBILITY = [
    "Provide readable text plus optional read-aloud; no voice input and no camera are required at any point.",
    "Chunk directions to one action at a time and keep a worked example visible while the learner works.",
    "Accept typed, handwritten, spoken, drawn, built, or manipulative-based responses whenever the standard allows it.",
    "Offer reduced item counts, extended time, hidden or disabled timers, movement breaks, and a low-distraction setting.",
    "Describe every representation in words so the lesson works with high-contrast print, screen readers, or no images at all.",
    "Keep all diagrams static and describable; no animation, motion, or auto-advance is required to understand the mathematics.",
    "Size interactive targets for touch and allow the whole task to be completed on a small screen or on paper.",
    "Preserve the learning target while adjusting quantity, pacing, representation, or response mode.",
]
SAFETY = [
    "Use respectful, non-shaming language; an error is information about the next teaching move, never a judgment of the learner.",
    "Allow a pause, break, or change of response mode at any time without recording it as a failure.",
    "Do not require photographs, voice recordings, location, or any personal or family detail to complete a task.",
    "Any task involving tools, heat, liquids, or moving about the home requires adult supervision and may be replaced with a paper alternative.",
]

def cid(g): return "ma-g%d-mathematics" % g
def uid(g, n): return "%s-u%02d" % (cid(g), n)
def lid(g, n, d): return "%s-u%02d-l%02d" % (cid(g), n, d)

DOMAIN_ORDER = {"OA": 0, "NBT": 1, "NF": 2, "MD": 3, "G": 4}


def std_key(code):
    """Sort content codes by domain then number, with practices last."""
    if code.startswith("MP."):
        return (9, int(code.split(".")[1]))
    p = code.split(".")
    return (DOMAIN_ORDER[p[1]], int(p[2]))


def unit_standards(unit):
    seen = set()
    for _f, s in unit["days"]:
        seen.update(s.split())
    return sorted(seen, key=std_key)

def fmt_std(codes):
    return ", ".join(codes)

# --- lessons ---------------------------------------------------------------

def build_lessons(g, mod):
    lessons = []
    course_day = 0
    for unit in mod.UNITS:
        u_std = unit_standards(unit)
        aligned = ADAPTIVE_ALIGNMENT.get((g, unit["n"]), [])
        for idx, (day_in_unit, phase, ev) in enumerate(arc.ARC):
            focus, std_s = unit["days"][idx]
            stds = std_s.split()
            course_day += 1
            mis = unit["misconceptions"][unit["day_misconceptions"][idx]]
            seg_ids = []
            flow = []
            for si, (seg, mins, action) in enumerate(arc.FLOW[ev], start=1):
                sid = "%s-s%d" % (lid(g, unit["n"], day_in_unit), si)
                seg_ids.append(sid)
                flow.append({
                    "segment_id": sid,
                    "segment": seg,
                    "minutes": mins,
                    "teacher_or_tutor_action": action.format(focus=focus),
                })
            lesson = {
                "schema_version": SCHEMA_VERSION,
                "lesson_id": lid(g, unit["n"], day_in_unit),
                "course_id": cid(g),
                "grade": g,
                "subject": "mathematics",
                "course_day": course_day,
                "unit_number": unit["n"],
                "unit_title": unit["title"],
                "day_in_unit": day_in_unit,
                "title": "%s: %s" % (phase, focus),
                "phase": phase,
                "focus": focus,
                "evidence_type": ev,
                "counts_toward_independent_mastery_evidence": ev == arc.INDEPENDENT,
                "estimated_minutes": SESSION_MINUTES[g],
                "standards": stds,
                "essential_question": unit["eq"],
                "learning_objectives": [o.format(focus=focus) for o in arc.OBJECTIVE[ev]],
                "success_criteria": [
                    "The learner completes the task about %s." % focus,
                    "The learner shows a model, calculation, or documented process rather than a bare answer.",
                    "The learner checks the work against the criteria and names one next step.",
                ],
                "academic_vocabulary": unit["vocabulary"],
                "representations": unit["representations"],
                "materials": [
                    "notebook, paper, or an accessible digital equivalent",
                    "pencil or an accessible response tool",
                    "the unit representation set: %s" % "; ".join(unit["representations"][:3]),
                    "household or classroom objects may substitute for any named manipulative",
                ],
                "lesson_flow": flow,
                "student_activity": arc.ACTIVITY[ev].format(focus=focus),
                "formative_check": arc.EXIT[ev].format(focus=focus),
                "answer_or_scoring_guidance": (
                    "Score the stated target for %s: accuracy, the quality of the model or reasoning, "
                    "and the revision. Accept any valid approach that meets the criteria. Do not infer "
                    "effort, motivation, diagnosis, or character from an error." % focus
                ),
                "target_misconception": {
                    "pattern": mis["pattern"],
                    "diagnostic_probe": mis["probe"],
                    "repair_move": mis["repair"],
                },
                "adaptive_tutor_routes": build_routes(g, unit, focus, mis, aligned, ev),
                "mastery_rule": (
                    "One correct response cannot establish mastery of %s. Mastery requires accurate "
                    "independent evidence plus explanation on at least two separate occasions, "
                    "separated by time or by representation. Guided success is recorded as supported "
                    "and is not weighted as independent evidence." % focus
                ),
                "support": support_text(ev, focus, unit),
                "extension": (
                    "Apply %s under a new constraint, compare two strategies and justify which is more "
                    "efficient, or write an original problem and its worked solution. The learner may not "
                    "complete another learner's graded work." % focus
                ),
                "accessibility_and_accommodations": ACCESSIBILITY,
                "safety_and_privacy": SAFETY,
                "media": {
                    "suggestion": "Optional diagram or worked example illustrating %s." % focus,
                    "required": False,
                    "fallback": (
                        "Every representation in this lesson is fully described in words and can be built "
                        "from paper, household objects, or a plain number line. No image, video, audio, or "
                        "animation is required."
                    ),
                    "reduced_motion_safe": True,
                },
                "evidence_record": {
                    "persist": ["lesson_id", "target", "evidence_type", "completion_state",
                                "adult_observed_result", "next_instructional_step"],
                    "do_not_persist": ["raw learner responses", "free-text reflections", "voice recordings",
                                       "images of the learner", "diagnosis or disability language"],
                    "raw_learner_response_persistence": "not-required",
                    "note": ("Mastery decisions are made from the recorded evidence type and adult-observed "
                             "result. Storing the learner's raw answers is never required by this course."),
                },
                "study_adapter": {
                    "resumable_by_segment": True,
                    "segment_ids": seg_ids,
                    "session_target_minutes": SESSION_MINUTES[g],
                    "break_points_after": seg_ids[:-1],
                    "static_fallback_available": True,
                    "requires_network": False,
                    "requires_adaptive_package": False,
                },
                "parent_or_guardian_visibility": (
                    "Share the target, completion state, evidence type, and next instructional step. "
                    "Do not expose raw answers, private reflections, recordings, or diagnosis language."
                ),
                "home_connection": (
                    "Notice one safe, optional example of %s in daily life and describe it. No purchase, "
                    "account, photograph, or private disclosure is required." % focus
                ),
            }
            lessons.append(lesson)
    return lessons

# Days on which the learner must work unsupported. On these days the adult may
# provide access supports and may RECORD what they observe, but may not deliver a
# diagnostic probe, a repair move, or a reteach -- doing so would convert
# independent evidence into guided evidence and break the mastery contract.
UNSUPPORTED = ("independent-evidence", "assessment")


def support_text(ev, focus, unit):
    if ev in UNSUPPORTED:
        return ("Do not reteach %s during this task. Access supports -- extended time, reduced "
                "quantity, alternate response mode, breaks, and re-reading the directions -- are "
                "always available and do not change the standard being evidenced. Record what you "
                "observe and act on it during the day-17 reassessment or the unit's prerequisite "
                "practice. Prerequisites for this unit: %s."
                % (focus, "; ".join(unit["prerequisites"])))
    return ("If the learner is not yet ready for %s, return to the smallest prerequisite, reteach it "
            "with a concrete or text-only representation, then retry one fresh item. Prerequisites "
            "for this unit: %s." % (focus, "; ".join(unit["prerequisites"])))


def build_routes(g, unit, focus, mis, aligned, ev):
    if ev in UNSUPPORTED:
        return [
            {"signal": "prerequisite gap",
             "action": "Record that a prerequisite for %s is not secure (%s). Do not reteach it now; "
                       "this task must stay unsupported to count as independent evidence."
                       % (focus, unit["prerequisites"][0]),
             "handler": "static-lesson-fallback"},
            {"signal": "target misconception observed",
             "action": "Record the pattern neutrally: %s Do NOT deliver the diagnostic probe or the "
                       "repair move during this task. Both are scheduled for the day-17 reassessment."
                       % mis["pattern"],
             "handler": "static-lesson-fallback"},
            {"signal": "procedure without understanding",
             "action": "Note that the recorded reasoning for %s is thin. Ask for the reasoning only "
                       "after the learner has finished and submitted the task." % focus,
             "handler": "static-lesson-fallback"},
            {"signal": "correct but low confidence",
             "action": "After the task, confirm specifically that the reasoning for %s was sound. Do "
                       "not begin remediation." % focus,
             "handler": "static-lesson-fallback"},
            {"signal": "repeated error pattern",
             "action": "Record the pattern for the day-17 reassessment. Do not interrupt the task to "
                       "correct it.",
             "handler": "static-lesson-fallback"},
            {"signal": "access support needed",
             "action": "Provide the access support. Extended time, reduced quantity, an alternate "
                       "response mode, a break, or re-reading the directions never make the evidence "
                       "guided and never change the standard being evidenced.",
             "handler": "static-lesson-fallback"},
            {"signal": "mastery evidence",
             "action": "Require accurate independent application plus explanation on a later or "
                       "different occasion before recording %s as mastered." % focus,
             "handler": "static-lesson-fallback"},
        ]
    routes = [
        {"signal": "prerequisite gap",
         "action": "Return to the smallest prerequisite for %s (%s), reteach with a concrete or text-only "
                   "representation, then retry one fresh item." % (focus, unit["prerequisites"][0]),
         "handler": "static-lesson-fallback"},
        {"signal": "target misconception observed",
         "action": "Observed pattern: %s Ask: \"%s\" Then: %s" % (mis["pattern"], mis["probe"], mis["repair"]),
         "handler": "static-lesson-fallback"},
        {"signal": "procedure without understanding",
         "action": "Ask the learner to represent why the procedure for %s works before continuing to more "
                   "items." % focus,
         "handler": "static-lesson-fallback"},
        {"signal": "correct but low confidence",
         "action": "Confirm the reasoning specifically, offer one varied example of %s, and do not start "
                   "remediation." % focus,
         "handler": "static-lesson-fallback"},
        {"signal": "repeated error pattern",
         "action": "Name the observable pattern neutrally, contrast it with a worked example, and schedule a "
                   "short spaced review rather than a longer session today.",
         "handler": "static-lesson-fallback"},
        {"signal": "mastery evidence",
         "action": "Require accurate independent application plus explanation on a later or different "
                   "occasion before recording %s as mastered." % focus,
         "handler": "static-lesson-fallback"},
    ]
    if aligned:
        routes.append({
            "signal": "persistent gap after two static repair cycles",
            "action": "An aligned frozen Adaptive Math intervention sequence exists for this unit (%s). "
                      "An adult may route the learner to it through the capability marker. The course does "
                      "not require it and remains complete without it."
                      % ", ".join("%s (%s)" % (s, FROZEN_SEQUENCES[s]) for s in aligned),
            "handler": "adaptive-math-capability-marker",
            "capability": "adaptive-math.v1",
            "aligned_sequence_ids": aligned,
        })
    return routes

# --- units / assessments ---------------------------------------------------

def build_units(g, mod, lessons):
    out = []
    for unit in mod.UNITS:
        u_std = unit_standards(unit)
        aligned = ADAPTIVE_ALIGNMENT.get((g, unit["n"]), [])
        ids = [l["lesson_id"] for l in lessons if l["unit_number"] == unit["n"]]
        out.append({
            "unit_id": uid(g, unit["n"]),
            "course_id": cid(g),
            "grade": g,
            "subject": "mathematics",
            "unit_number": unit["n"],
            "title": unit["title"],
            "days": len(ids),
            "standards": u_std,
            "essential_question": unit["eq"],
            "topics": unit["topics"],
            "academic_vocabulary": unit["vocabulary"],
            "representations": unit["representations"],
            "prerequisites": unit["prerequisites"],
            "fluency_target": unit["fluency"],
            "known_misconceptions": unit["misconceptions"],
            "performance_task": unit["task"],
            "lesson_ids": ids,
            "assessment_id": "%s-assessment" % uid(g, unit["n"]),
            "independent_evidence_days": arc.INDEPENDENT_EVIDENCE_DAYS,
            "adaptive_math_aligned_sequences": aligned,
            "static_fallback_complete": True,
        })
    return out

def error_stem_standards(unit):
    """Standards of the first day that targets the misconception the stem shows."""
    for i, mi in enumerate(unit["day_misconceptions"]):
        if mi == 0:
            return sorted(set(unit["days"][i][1].split()), key=std_key)
    return unit_standards(unit)


def build_assessments(g, mod):
    out = []
    for unit in mod.UNITS:
        u_std = unit_standards(unit)
        t = unit["topics"]
        ts = unit["topic_standards"]
        practices = [c for c in u_std if c.startswith("MP.")]
        prompts = [
            {"type": "concept and vocabulary", "points": 4, "standards": ts[t[0]],
             "prompt": "Explain %s in your own words and give a correct example." % t[0]},
            {"type": "representation", "points": 6, "standards": ts[t[1]],
             "prompt": "Use one of the unit representations (%s) to show %s. Label the parts."
                       % ("; ".join(unit["representations"][:2]), t[1])},
            {"type": "procedure and accuracy", "points": 6, "standards": ts[t[2]],
             "prompt": "Carry out %s accurately and show every step." % t[2]},
            {"type": "application", "points": 8, "standards": ts[t[3]],
             "prompt": "Apply %s in a situation you have not worked before. Show the process that produced "
                       "your answer." % t[3]},
            {"type": "error analysis", "points": 6, "standards": error_stem_standards(unit),
             "prompt": "%s Find the error, correct it, and explain why the correction works."
                       % unit["assessment_error_stem"]},
            {"type": "connection", "points": 4,
             "standards": sorted(set(ts[t[0]]) | set(ts[t[-1]]), key=std_key),
             "prompt": unit["connection_prompt"]},
            {"type": "performance evidence", "points": 8,
             "standards": [c for c in u_std if not c.startswith("MP.")],
             "prompt": "Present the strongest evidence from the unit task: %s" % unit["task"]},
            {"type": "reflection and transfer", "points": 4, "standards": practices or ts[t[0]],
             "prompt": "Name one skill you can now transfer, one check that improves your accuracy, and one "
                       "question you still have."},
        ]
        out.append({
            "assessment_id": "%s-assessment" % uid(g, unit["n"]),
            "unit_id": uid(g, unit["n"]),
            "course_id": cid(g),
            "grade": g,
            "unit_number": unit["n"],
            "unit_title": unit["title"],
            "administered_on_day_in_unit": arc.ASSESSMENT_DAY,
            "standards": u_std,
            "total_points": sum(p["points"] for p in prompts),
            "prompts": prompts,
            "rubric_dimensions": ["accuracy", "representation and reasoning", "application", "checking and revision"],
            "mastery_interpretation": {
                "secure": "At least 85 percent with accurate independent application and adequate reasoning.",
                "developing": "70 to 84 percent, or inconsistent explanation; assign targeted review and a fresh transfer check.",
                "not_yet": "Below 70 percent or a missing prerequisite; reteach the smallest gap and reassess with new evidence.",
                "rule": "This score is ONE evidence source. It cannot by itself establish or deny mastery.",
            },
            "reassessment": {
                "occurs_on_day_in_unit": arc.REASSESSMENT_DAY,
                "requires_fresh_items": True,
                "note": "Reassessment must use items not seen on this assessment; a reused item cannot "
                        "establish new evidence.",
            },
            "accommodation_note": "Access supports may change format, pacing, quantity, setting, or response "
                                  "mode without changing the standard being assessed.",
            "no_media_path": "Every prompt is answerable in writing, by speech, by drawing, or by building "
                             "with objects. No image, audio, video, or camera is required.",
        })
    return out

# --- practice / projects / mastery -----------------------------------------

def build_practice(g, mod):
    sets = []
    for unit in mod.UNITS:
        n = unit["n"]
        spaced = [u["n"] for u in mod.UNITS if n - 3 <= u["n"] < n]
        sets.append({
            "practice_id": "%s-practice" % uid(g, n),
            "unit_id": uid(g, n),
            "unit_number": n,
            "unit_title": unit["title"],
            "fluency_practice": {
                "target": unit["fluency"],
                "scheduled_day_in_unit": 9,
                "format": "Short mixed set, 8 to 12 items.",
                "timing_policy": "Untimed by default. Timers stay hidden or off. Speed is never scored and "
                                 "is never reported to a parent or guardian as a result.",
                "stop_rule": "Stop the set early if accuracy drops below roughly half; that is a signal to "
                             "reteach, not to continue practicing an error.",
            },
            "retrieval_practice": {
                "scheduled_days_in_unit": [9, 15],
                "spaced_review_units": spaced,
                "format": "Two or three items from each listed earlier unit, mixed with current-unit items.",
                "purpose": "Spacing and interleaving build durable retrieval; this is not a graded quiz.",
            },
            "application_practice": {
                "scheduled_days_in_unit": [11, 18],
                "format": "One or two multi-step problems set in a realistic situation.",
                "requirement": "The learner records the model or process, not only the answer.",
            },
            "prerequisite_practice": {
                "available": True,
                "targets": unit["prerequisites"],
                "note": "Assign only when a gap is observed. Do not pre-assign as a default workload.",
            },
            "accessibility": "Quantity may be reduced without changing the target. Any item may be answered "
                             "orally, in writing, by drawing, or by building with objects.",
            "no_media_path": "All practice is text and object based. No image, audio, or video is required.",
        })
    return {"course_id": cid(g), "grade": g, "subject": "mathematics", "practice_sets": sets}

def build_projects(g, mod):
    projects = []
    for unit in mod.UNITS:
        n = unit["n"]
        capstone = (n == 10)
        projects.append({
            "project_id": "%s-project" % uid(g, n),
            "unit_id": uid(g, n),
            "unit_number": n,
            "unit_title": unit["title"],
            "type": "capstone" if capstone else "unit performance task",
            "title": unit["task"],
            "scheduled_days_in_unit": [13, 14] + ([15, 18] if capstone else []),
            "standards": unit_standards(unit),
            "success_criteria": [
                "The mathematics is accurate and every result is shown with a model, calculation, or process.",
                "Each decision is justified against the situation, not asserted.",
                "At least one error check appears in the work and is explained.",
                "The product is revised at least once in response to feedback against these criteria.",
            ],
            "adult_role": "Give feedback against the criteria and supply access supports. The adult or tutor "
                          "does not complete any part of the graded product.",
            "accessible_alternatives": [
                "written or typed plan", "spoken explanation with an adult scribe", "drawn or diagrammed plan",
                "physical model built from household objects", "spreadsheet or plain-text table",
            ],
            "no_media_path": "The product may be entirely text, numbers, and hand-drawn diagrams. No "
                             "photograph, recording, video, or published post is required, and none is "
                             "required to be shared outside the household.",
            "safety_and_privacy": "Use de-identified data. Do not collect names, addresses, images, or "
                                  "personal details of other people. Measuring tasks involving tools, heat, "
                                  "or liquids require adult supervision and may be replaced with a paper "
                                  "alternative.",
        })
    return {"course_id": cid(g), "grade": g, "subject": "mathematics", "projects": projects}

def build_mastery(g, mod):
    units = []
    for unit in mod.UNITS:
        occ = []
        for d in arc.INDEPENDENT_EVIDENCE_DAYS:
            focus = unit["days"][d - 1][0]
            occ.append({"day_in_unit": d, "lesson_id": lid(g, unit["n"], d),
                        "evidence_type": "independent-evidence", "focus": focus,
                        "counts_toward_mastery": True})
        occ.append({"day_in_unit": arc.ASSESSMENT_DAY, "lesson_id": lid(g, unit["n"], arc.ASSESSMENT_DAY),
                    "evidence_type": "assessment", "focus": unit["days"][arc.ASSESSMENT_DAY - 1][0],
                    "counts_toward_mastery": True,
                    "note": "One evidence source among several; never the sole basis."})
        occ.append({"day_in_unit": arc.REASSESSMENT_DAY, "lesson_id": lid(g, unit["n"], arc.REASSESSMENT_DAY),
                    "evidence_type": "reassessment", "focus": unit["days"][arc.REASSESSMENT_DAY - 1][0],
                    "counts_toward_mastery": True, "requires_fresh_items": True})
        units.append({
            "unit_id": uid(g, unit["n"]), "unit_number": unit["n"], "unit_title": unit["title"],
            "standards": unit_standards(unit),
            "independent_evidence_occasions": len(arc.INDEPENDENT_EVIDENCE_DAYS),
            "guided_practice_days": [d for d, _p, e in arc.ARC if e == arc.GUIDED],
            "instruction_days": [d for d, _p, e in arc.ARC if e == arc.INSTRUCTION],
            "evidence_occasions": occ,
        })
    return {
        "course_id": cid(g), "grade": g, "subject": "mathematics",
        "canonical_rule": "One correct response cannot establish mastery.",
        "evidence_model": {
            "instruction": "The idea is being taught. No mastery claim is possible from an instruction day.",
            "guided-practice": "Success is supported by prompts or feedback. Recorded as supported; not "
                               "weighted as independent evidence.",
            "independent-evidence": "Unsupported, unprompted work with recorded reasoning. Usable toward a "
                                    "mastery claim.",
            "retrieval": "Spaced recall without speed pressure. Informs teaching; a slow response is not a "
                         "mastery failure.",
            "project": "Extended application with revision. Contributes performance evidence.",
            "assessment": "One evidence source among several.",
            "reassessment": "Fresh evidence after targeted correction, separated in time from the first "
                            "attempt.",
        },
        "mastery_decision_rule": (
            "Record a standard as secure only when the learner has produced accurate independent evidence "
            "WITH an explanation on at least two separate occasions, separated by time or by representation, "
            "and has not shown the target misconception on the later occasion. A single assessment score, a "
            "single correct answer, or guided success alone is never sufficient."
        ),
        "reporting_bands": ["Secure", "Developing", "Not Yet"],
        "pacing_note": "A pacing concern is not a mastery failure. Extended time, reduced quantity, and "
                       "breaks do not change the standard being evidenced.",
        "privacy_note": "Mastery records store the target, evidence type, completion state, adult-observed "
                        "result, and next step. Raw learner responses are not required to be stored.",
        "units": units,
    }

# --- schedule --------------------------------------------------------------

def build_schedule(g, lessons):
    rows = []
    for i, l in enumerate(lessons):
        week = i // DAYS_PER_WEEK + 1
        rows.append({
            "week": week,
            "day_of_week": DAY_NAMES[i % DAYS_PER_WEEK],
            "course_day": l["course_day"],
            "lesson_id": l["lesson_id"],
            "unit_number": l["unit_number"],
            "unit_title": l["unit_title"],
            "phase": l["phase"],
            "evidence_type": l["evidence_type"],
            "standards": ";".join(l["standards"]),
        })
    return rows

# --- writers ---------------------------------------------------------------

def w_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=True)
        f.write("\n")

def w_text(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(s)

def w_jsonl(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=True) + "\n")

def w_csv(path, rows, cols):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols)
        wr.writeheader()
        for r in rows:
            wr.writerow(r)

# --- documents -------------------------------------------------------------

ORDINAL = {3: "third", 4: "fourth"}

def course_guide(g, mod, units):
    L = []
    A = L.append
    A("# Grade %d Mathematics - Course Guide\n" % g)
    A("**Course ID:** `%s`  " % cid(g))
    A("**Version:** %s  " % VERSION)
    A("**Instructional sessions:** 180  ")
    A("**School year:** %d weeks at %d instructional days per week  " % (WEEKS, DAYS_PER_WEEK))
    A("**Typical session:** %s minutes  " % SESSION_MINUTES[g])
    A("**Cadence:** daily\n")
    A("## Course description\n")
    A("A complete %s-grade mathematics course built directly from the Grade %d Michigan mathematics "
      "domains. Every unit moves from concrete representation to reasoning to independent evidence, and "
      "no unit treats a single correct answer as proof of learning.\n" % (ORDINAL[g], g))
    A("This course is original Grade %d sequencing. It is not a simplification of the Manuel Academy "
      "Grade 5 mathematics course, and it shares no lesson content with it.\n" % g)
    for note in SC.SCOPE_NOTES[g]:
        A("- %s" % note)
    A("")
    A("## Course outcomes\n")
    A("By the end of the course, learners will:\n")
    A("1. Demonstrate the Grade %d Michigan mathematics standards through independent, accessible evidence." % g)
    A("2. Explain reasoning with a model, calculation, or documented process rather than an unsupported answer.")
    A("3. Transfer a learned idea to an unfamiliar problem or situation.")
    A("4. Use error evidence to revise, without shame or character judgment.")
    A("5. Complete the course capstone: **%s**\n" % mod.UNITS[-1]["task"])
    A("## Instructional model\n")
    A("Every unit runs the same 18-day arc, so learners and adults always know what kind of day it is "
      "and what the day is for:\n")
    A("| Day | Phase | What it is for |")
    A("| --- | --- | --- |")
    purpose = {
        arc.INSTRUCTION: "Teaching. No mastery claim is possible.",
        arc.GUIDED: "Supported practice. Recorded as supported, not independent.",
        arc.INDEPENDENT: "Unprompted evidence. Counts toward a mastery claim.",
        arc.RETRIEVAL: "Spaced recall without speed pressure.",
        arc.PROJECT: "Extended application with revision.",
        arc.ASSESSMENT: "One evidence source among several.",
        arc.REASSESSMENT: "Fresh evidence after targeted correction.",
    }
    for d, phase, ev in arc.ARC:
        A("| %d | %s | %s |" % (d, phase, purpose[ev]))
    A("")
    A("## Mastery and grading\n")
    A("- **One correct response never establishes mastery.** This is the canonical Manuel Academy rule and "
      "it is enforced structurally: each unit provides %d independent-evidence occasions on separate days, "
      "plus an assessment and a reassessment occasion." % len(arc.INDEPENDENT_EVIDENCE_DAYS))
    A("- Instruction, guided practice, independent evidence, and reassessment are recorded as different "
      "kinds of evidence and are never collapsed into one number.")
    A("- Guided success is not weighted the same as independent success.")
    A("- Reassessment requires fresh items. A reused item cannot establish new evidence.")
    A("- Suggested reporting: **Secure**, **Developing**, **Not Yet**, supported by evidence rather than a "
      "single percentage.")
    A("- A pacing concern is not a mastery failure. Speed is never scored and never reported as a result.")
    A("- Parent summaries show target, completion, evidence type, and next step. They exclude raw answers, "
      "private reflections, recordings, and diagnosis language.\n")
    A("## Scope and sequence\n")
    A("| Unit | Title | Days | Standards | Performance task |")
    A("| --- | --- | --- | --- | --- |")
    for u in units:
        A("| %d | %s | %d | %s | %s |" % (u["unit_number"], u["title"], u["days"],
                                          fmt_std(u["standards"]), u["performance_task"]))
    A("")
    A("## Adaptive Math compatibility\n")
    if g == 4:
        A("Grade 4 overlaps the frozen Adaptive Math intervention package (grade band 4-6). Where a unit's "
          "skills genuinely align with one of that package's four sequences, the unit carries a capability "
          "marker so an adult may route a learner to the intervention after static repair has been tried. "
          "The frozen package is referenced only - never copied, rewritten, or modified.\n")
        A("| Unit | Aligned frozen sequence |")
        A("| --- | --- |")
        for u in units:
            al = u["adaptive_math_aligned_sequences"]
            A("| %d | %s |" % (u["unit_number"],
                               ", ".join(FROZEN_SEQUENCES[s] for s in al) if al else "none - static fallback only"))
        A("")
        A("**Every Grade 4 unit is complete without the adaptive package.** Units 8, 9, and 10 have no "
          "aligned sequence at all, and they function exactly like the rest of the course.\n")
    else:
        A("The frozen Adaptive Math intervention package covers approximately grades 4 to 6. **No Grade 3 "
          "unit claims alignment with it, and no Grade 3 lesson depends on it.** Every Grade 3 adaptive "
          "route resolves to the static lesson and help fallback that ships with this course. The course is "
          "fully functional when no adaptive intervention matches, which for Grade 3 is always.\n")
    A("## Accessibility\n")
    A("No camera, no identifiable photograph, and no voice input is required at any point in this course. "
      "Every lesson has a complete text-only path, every representation is described in words, every "
      "diagram is static and reduced-motion safe, and every learner task can be completed on a small "
      "touch screen or on paper. See `accessibility-no-media.md`.\n")
    A("## Core files\n")
    A("- `units.json` - unit manifests")
    A("- `lessons.jsonl` - 180 daily lesson blueprints")
    A("- `lesson-sequence.md` - human-readable day-by-day sequence")
    A("- `assessments.json` - 10 unit assessments")
    A("- `practice.json` - fluency, retrieval, application, and prerequisite practice")
    A("- `projects.json` - 10 performance tasks including the capstone")
    A("- `schedule-36-week.csv` - the %d-week schedule" % WEEKS)
    A("- `mastery-evidence.json` - the evidence model and per-unit occasions")
    A("- `teacher-parent-guide.md` - guidance for the adult")
    A("- `accessibility-no-media.md` - accessibility and no-media alternatives")
    return "\n".join(L) + "\n"

def lesson_sequence(g, mod, lessons):
    L = []
    A = L.append
    A("# Grade %d Mathematics - Complete Lesson Sequence\n" % g)
    A("**Lessons:** %d  " % len(lessons))
    A("**Weeks:** %d  " % WEEKS)
    A("**Session length:** %s minutes\n" % SESSION_MINUTES[g])
    for unit in mod.UNITS:
        us = [l for l in lessons if l["unit_number"] == unit["n"]]
        A("## Unit %d: %s\n" % (unit["n"], unit["title"]))
        A("**Essential question:** %s  " % unit["eq"])
        A("**Standards:** %s  " % fmt_std(unit_standards(unit)))
        A("**Fluency target:** %s  " % unit["fluency"])
        A("**Performance task:** %s\n" % unit["task"])
        for l in us:
            A("### Day %d (course day %d) - %s" % (l["day_in_unit"], l["course_day"], l["title"]))
            A("**Lesson ID:** `%s`  " % l["lesson_id"])
            A("**Standards:** %s  " % fmt_std(l["standards"]))
            A("**Evidence type:** %s  " % l["evidence_type"])
            A("**Objective:** %s\n" % l["learning_objectives"][0])
            A("**Student activity:** %s\n" % l["student_activity"])
            A("**Exit check:** %s\n" % l["formative_check"])
            A("**Watch for:** %s\n" % l["target_misconception"]["pattern"])
    return "\n".join(L) + "\n"

def teacher_parent_guide(g, mod):
    L = []
    A = L.append
    A("# Grade %d Mathematics - Teacher and Parent Guide\n" % g)
    A("## What this course asks of you\n")
    A("You do not need to be a mathematician. Each lesson tells you exactly what to model, what to ask, "
      "and what to look for. The single most valuable thing you can do is ask *how do you know* and wait "
      "for the answer.\n")
    A("## Reading a lesson day\n")
    A("Every day is labelled with an evidence type. It tells you how much help is allowed:\n")
    A("| Evidence type | Your role | Help allowed |")
    A("| --- | --- | --- |")
    A("| instruction | Model and think aloud | Full - this is teaching |")
    A("| guided-practice | Prompt, then fade | Prompts that decrease across the set |")
    A("| independent-evidence | Observe only | Restate directions and give access supports; no mathematical steps |")
    A("| retrieval | Keep it calm and untimed | Confirm, do not reteach mid-set |")
    A("| project | Give feedback on criteria | Feedback only; never do part of the product |")
    A("| assessment | Set up access, then step back | Accommodations only |")
    A("| reassessment | Reteach the smallest gap, then step back | Reteach before, not during |")
    A("")
    A("Getting this distinction right is what makes the mastery rule real. If you supply the steps on an "
      "independent-evidence day, the evidence is no longer independent and should be recorded as guided.\n")
    A("## The mastery rule, in plain language\n")
    A("**One right answer is never enough.** Before you record a skill as secure, you want to have seen it "
      "twice, on different days, done without help, with the learner able to say why it works. Each unit "
      "gives you %d independent-evidence days plus an assessment and a reassessment day, so you will have "
      "the occasions you need.\n" % len(arc.INDEPENDENT_EVIDENCE_DAYS))
    A("A slow answer is not a wrong answer. A pacing concern is not a mastery failure.\n")
    A("## When the learner is stuck\n")
    A("1. Find the smallest missing prerequisite - the unit lists them.")
    A("2. Reteach it with a different representation than the one that failed.")
    A("3. Retry one fresh item, not the same one.")
    A("4. If the same pattern appears twice more, look at the unit's known misconceptions list. Each one "
      "has a diagnostic question and a repair move.\n")
    if g == 4:
        A("5. Some Grade 4 units also align with the frozen Adaptive Math intervention package. If you have "
          "access to it and static repair has not worked, the unit will tell you which sequence matches. "
          "This is optional; the course is complete without it.\n")
    else:
        A("5. Grade 3 does not use the adaptive intervention package at all. Everything you need is in the "
          "lesson itself.\n")
    A("## What to say when there is an error\n")
    A("Describe the pattern, not the person. \"You subtracted the smaller digit from the larger one in "
      "this column\" is useful. \"You weren't paying attention\" is not, and it is not accurate. Errors "
      "are how you find out what to teach next.\n")
    A("## What gets shared and what does not\n")
    A("Parent- and guardian-facing summaries show the target, whether it was completed, what kind of "
      "evidence it was, and the next step. They do not show raw answers, private reflections, recordings, "
      "or any diagnosis language. This course never requires you to store a learner's raw responses.\n")
    A("## Safety\n")
    A("Measuring tasks that involve tools, heat, liquids, or moving about the home need your supervision. "
      "Any of them can be replaced with a paper alternative without changing the standard being learned. "
      "Data projects use de-identified information only - no names, addresses, or images of other people.\n")
    A("## If a day does not fit\n")
    A("Sessions are designed for %s minutes. If a day runs long, stop at a segment boundary and resume; "
      "every lesson is built to be resumable segment by segment. Finishing the mathematics matters more "
      "than finishing the clock.\n" % SESSION_MINUTES[g])
    return "\n".join(L) + "\n"

def accessibility_doc(g):
    L = []
    A = L.append
    A("# Grade %d Mathematics - Accessibility and No-Media Alternatives\n" % g)
    A("## Guarantees\n")
    A("Every one of the 180 lessons in this course satisfies all of the following:\n")
    A("- **No camera is required.** No task asks for a photograph, and no identifiable image of a learner "
      "is ever needed.")
    A("- **No voice is required.** Read-aloud is offered as an option; voice input is never required and "
      "voice is never recorded or stored.")
    A("- **A complete text-only path exists.** Media is optional in every lesson and carries a written "
      "fallback that conveys the same mathematics.")
    A("- **Reduced motion is safe.** Every representation is static and describable. Nothing animates, "
      "auto-advances, or requires motion to be understood.")
    A("- **Large-touch and mobile compatible.** Every learner task can be completed on a small touch "
      "screen or entirely on paper.\n")
    A("## Representation without images\n")
    A("Each unit names its representation set, and each representation has a physical and a verbal form:\n")
    A("| Representation | Physical form | Text-only form |")
    A("| --- | --- | --- |")
    A("| number line | a strip of paper with folded marks | a written list of the labelled points in order |")
    A("| array or area model | tiles, coins, or a grid drawn on paper | \"a rectangle 4 rows by 6 columns\" stated in words |")
    A("| base-ten materials | bundled straws, coins, or paper strips | place-value words: \"3 hundreds, 4 tens, 7 ones\" |")
    A("| fraction model | folded paper strips | \"a strip folded into 4 equal parts; 3 parts shaded\" |")
    A("| graph or line plot | a hand-drawn grid | a written table of categories and values |")
    A("| angle diagram | a folded paper corner or a protractor | \"two rays from one point, opening about half a right angle\" |")
    A("")
    A("## Response modes\n")
    A("Any task may be answered by typing, handwriting, speaking to a scribe, drawing, building with "
      "objects, or demonstrating - whenever the standard itself does not require a specific form. The "
      "learning target is preserved; only the route to showing it changes.\n")
    A("## Adjusting without lowering\n")
    A("Quantity, pacing, representation, and response mode may all be adjusted. The standard being "
      "evidenced may not. Reducing a 12-item set to 5 items is an access support. Replacing multi-digit "
      "reasoning with single-digit facts is a different standard, and should be recorded as such.\n")
    A("## Timing and attention\n")
    A("Timers are hidden or off by default. Speed is never scored and is never reported as a result. "
      "Movement breaks are available at any segment boundary, and every lesson is resumable segment by "
      "segment, so a break never costs the learner their place.\n")
    A("## Privacy\n")
    A("This course never requires an account, a purchase, a photograph, a recording, a location, a "
      "diagnosis, or any family detail. Data projects use de-identified data only.\n")
    return "\n".join(L) + "\n"

# --- standards map ---------------------------------------------------------

def build_standards_map(all_lessons):
    grades = {}
    for g, mod in GRADES.items():
        cat = SC.CATALOG[g]
        cov = {c: [] for c in cat}
        for l in all_lessons[g]:
            for c in l["standards"]:
                if c in cov:
                    cov[c].append({"lesson_id": l["lesson_id"], "unit_number": l["unit_number"],
                                   "course_day": l["course_day"], "evidence_type": l["evidence_type"]})
        entries = []
        for code in sorted(cat, key=lambda c: (c.split(".")[1], int(c.split(".")[2]))):
            hits = cov[code]
            subs = {k: v for k, v in SC.SUBPARTS[g].items() if SC.SUBPART_PARENT[k] == code}
            entries.append({
                "code": code,
                "domain": code.split(".")[1],
                "domain_title": SC.DOMAIN_TITLES[code.split(".")[1]],
                "requirement": cat[code],
                "sub_parts": [{"code": k, "requirement": v} for k, v in sorted(subs.items())],
                "units": sorted({h["unit_number"] for h in hits}),
                "lesson_count": len(hits),
                "independent_evidence_lessons": [h["lesson_id"] for h in hits
                                                 if h["evidence_type"] == arc.INDEPENDENT],
                "assessed_in_units": sorted({h["unit_number"] for h in hits
                                             if h["evidence_type"] == arc.ASSESSMENT}),
                "lessons": [h["lesson_id"] for h in hits],
            })
        prac = {}
        for l in all_lessons[g]:
            for c in l["standards"]:
                if c.startswith("MP."):
                    prac.setdefault(c, []).append(l["lesson_id"])
        grades[str(g)] = {
            "grade": g,
            "course_id": cid(g),
            "content_standards_total": len(cat),
            "content_standards_covered": sum(1 for e in entries if e["lesson_count"] > 0),
            "domain_ceilings": {k: v for k, v in SC.DOMAIN_CEILINGS.items() if k.startswith(str(g))},
            "scope_notes": SC.SCOPE_NOTES[g],
            "standards": entries,
            "mathematical_practices": [
                {"code": c, "title": SC.MATHEMATICAL_PRACTICES[c], "lesson_count": len(v)}
                for c, v in sorted(prac.items())
            ],
        }
    return {
        "package_id": PACKAGE_ID, "version": VERSION,
        "jurisdiction": "Michigan",
        "alignment_status": ("Locally authored curriculum aligned to published Michigan mathematics "
                             "standards. Not a claim of state approval, accreditation, licensure, or "
                             "automatic credit."),
        "code_format": ("Codes are written without cluster letters (3.OA.1, not 3.OA.A.1), matching the "
                        "Michigan K-12 Standards: Mathematics document and the Manuel Academy v1.0.0 "
                        "Grade 5 mathematics course."),
        "practice_code_note": ("The MP.n prefix is a Manuel Academy package convention carried over from "
                               "v1.0.0. The Michigan document numbers the Standards for Mathematical "
                               "Practice 1-8 under that heading and does not print the string 'MP.1'. The "
                               "practice titles are quoted from the document; the prefix is not."),
        "sources": SC.SOURCES,
        "grades": grades,
    }

def standards_map_md(smap):
    L = []
    A = L.append
    A("# Grade 3 and Grade 4 Mathematics - Standards Map\n")
    A("**Jurisdiction:** Michigan  ")
    A("**Status:** %s\n" % smap["alignment_status"])
    A("**Code format:** %s\n" % smap["code_format"])
    for g in ("3", "4"):
        d = smap["grades"][g]
        A("## Grade %s (%d of %d content standards covered)\n"
          % (g, d["content_standards_covered"], d["content_standards_total"]))
        for note in d["scope_notes"]:
            A("- %s" % note)
        A("")
        A("Verified domain ceilings: %s. Codes beyond these do not exist and none are used.\n"
          % ", ".join("%s ends at %d" % (k, v) for k, v in sorted(d["domain_ceilings"].items())))
        A("| Code | Requirement | Units | Lessons | Independent-evidence lessons |")
        A("| --- | --- | --- | --- | --- |")
        for e in d["standards"]:
            A("| `%s` | %s | %s | %d | %d |" % (
                e["code"], e["requirement"],
                ", ".join(str(u) for u in e["units"]), e["lesson_count"],
                len(e["independent_evidence_lessons"])))
        A("")
        subs = [e for e in d["standards"] if e["sub_parts"]]
        if subs:
            A("### Verified sub-parts under Grade %s parent codes\n" % g)
            A("Daily lessons carry the parent code, following the v1.0.0 convention. The sub-parts below "
              "are recorded so coverage can be inspected at finer grain.\n")
            A("| Sub-part | Requirement | Covered via |")
            A("| --- | --- | --- |")
            for e in subs:
                for sp in e["sub_parts"]:
                    A("| `%s` | %s | `%s` in unit(s) %s |" % (
                        sp["code"], sp["requirement"], e["code"],
                        ", ".join(str(u) for u in e["units"])))
            A("")
        A("### Standards for Mathematical Practice\n")
        A("| Code | Title | Lessons |")
        A("| --- | --- | --- |")
        for p in d["mathematical_practices"]:
            A("| `%s` | %s | %d |" % (p["code"], p["title"], p["lesson_count"]))
        A("")
    A("## Sources\n")
    A("| Source | URL | Role |")
    A("| --- | --- | --- |")
    for s in smap["sources"]:
        A("| %s | %s | %s |" % (s["title"], s["url"], s["role"]))
    A("")
    A("## Practice-code note\n")
    A(smap["practice_code_note"] + "\n")
    return "\n".join(L) + "\n"

# --- adaptive --------------------------------------------------------------

def build_capability_map(units_by_grade):
    g4 = []
    for u in units_by_grade[4]:
        g4.append({"unit_id": u["unit_id"], "unit_number": u["unit_number"], "unit_title": u["title"],
                   "aligned_sequence_ids": u["adaptive_math_aligned_sequences"],
                   "alignment": "aligned" if u["adaptive_math_aligned_sequences"] else "none",
                   "static_fallback_complete": True})
    g3 = [{"unit_id": u["unit_id"], "unit_number": u["unit_number"], "unit_title": u["title"],
           "aligned_sequence_ids": [], "alignment": "none", "static_fallback_complete": True}
          for u in units_by_grade[3]]
    return {
        "capability": "adaptive-math.v1",
        "package_id": PACKAGE_ID,
        "version": VERSION,
        "integration_mode": "capability-marker-and-adapter",
        "frozen_package": {
            "path": "adaptive-tutor/subjects/math",
            "subject_id": "math",
            "declared_version": "1.0.0",
            "declared_grade_band": {"minimum": 4, "maximum": 6, "prerequisite_support": [3]},
            "sequences": [{"sequence_id": k, "title": v} for k, v in FROZEN_SEQUENCES.items()],
            "modification_status": "referenced only - not copied, not rewritten, not modified",
        },
        "contract": [
            "This map is the ONLY coupling between the Grade 3/4 mathematics courses and the frozen "
            "Adaptive Math package.",
            "The frozen package is never imported, vendored, edited, or re-published by this course.",
            "A capability marker is advisory. When the capability is absent, every route falls back to the "
            "static lesson and help path and the course remains complete.",
            "Alignment is asserted only where the unit's skills genuinely match a frozen sequence. Units "
            "with no genuine match are marked 'none' rather than force-fitted.",
            "Grade 3 asserts no alignment at all. The frozen package lists grade 3 only as prerequisite "
            "support, which is not a Grade 3 curriculum claim.",
        ],
        "resolution_order": [
            "1. Static in-lesson support: the lesson's own support text and target misconception repair.",
            "2. Static unit fallback: the unit's prerequisite list and known-misconception table.",
            "3. Optional: if capability 'adaptive-math.v1' is present AND the unit declares an aligned "
            "sequence, an adult may route the learner to that frozen sequence.",
            "4. If the capability is absent or no sequence is aligned, stop at step 2. This is a supported "
            "terminal state, not a degraded one.",
        ],
        "grade_3": {"alignment": "none", "requires_adaptive_package": False,
                    "static_fallback_mandatory": True, "units": g3},
        "grade_4": {"alignment": "partial", "requires_adaptive_package": False,
                    "static_fallback_mandatory": True, "units": g4},
    }

def adapter_doc(capmap):
    L = []
    A = L.append
    A("# Adaptive Math Compatibility - Adapter and Capability Marker\n")
    A("## What this is\n")
    A("The Manuel Academy Adaptive Math package (`adaptive-tutor/subjects/math`) is frozen. It declares a "
      "grade band of 4 to 6 and ships exactly four intervention sequences. This document defines the only "
      "way the Grade 3 and Grade 4 mathematics courses may touch it: a **capability marker** plus a "
      "**declarative alignment map**. Nothing is copied, rewritten, vendored, or modified.\n")
    A("## The four frozen sequences\n")
    A("| Sequence ID | Title |")
    A("| --- | --- |")
    for s in capmap["frozen_package"]["sequences"]:
        A("| `%s` | %s |" % (s["sequence_id"], s["title"]))
    A("")
    A("## Grade 4 alignment\n")
    A("Alignment is asserted only where the skills actually match.\n")
    A("| Unit | Title | Aligned sequence |")
    A("| --- | --- | --- |")
    for u in capmap["grade_4"]["units"]:
        A("| %d | %s | %s |" % (u["unit_number"], u["unit_title"],
                                ", ".join("`%s`" % s for s in u["aligned_sequence_ids"]) or "none"))
    A("")
    A("Units 8, 9, and 10 cover decimal notation, measurement and conversion, and angles and geometry. The "
      "frozen package contains no sequence for any of those, so they assert no alignment. Force-fitting "
      "them would be a false claim about the intervention's coverage.\n")
    A("## Grade 3\n")
    A("**Grade 3 asserts no alignment whatsoever.** The frozen manifest lists grade 3 under "
      "`prerequisiteSupport`, which means some Grade 4-6 sequences may reach back to a Grade 3 idea. That "
      "is not a claim that the package teaches the Grade 3 curriculum, and this course does not treat it "
      "as one. Every Grade 3 adaptive route resolves to the static fallback. See "
      "`grade3-static-fallback.md`.\n")
    A("## Resolution order\n")
    for step in capmap["resolution_order"]:
        A("- %s" % step)
    A("")
    A("## Contract\n")
    for c in capmap["contract"]:
        A("- %s" % c)
    A("")
    A("## Why a marker rather than an import\n")
    A("An import would couple a 180-lesson course to a frozen artifact's internal shape, and would break "
      "the course if that artifact were absent. A marker is advisory: the runtime asks whether the "
      "capability exists, and if the answer is no, nothing about the lesson changes. That is what makes "
      "the Grade 3 guarantee possible.\n")
    return "\n".join(L) + "\n"

def fallback_doc():
    L = []
    A = L.append
    A("# Grade 3 Static Lesson and Help Fallback\n")
    A("## The guarantee\n")
    A("**Grade 3 Mathematics is fully functional when no adaptive intervention matches - which, for Grade "
      "3, is always.** No Grade 3 lesson, unit, assessment, project, or practice set depends on the "
      "Adaptive Math package being present, installed, licensed, or reachable.\n")
    A("## What every Grade 3 lesson carries on its own\n")
    A("| Field | What it provides |")
    A("| --- | --- |")
    A("| `support` | The smallest prerequisite to return to, and how to reteach it |")
    A("| `target_misconception` | The specific error to expect, a diagnostic question, and a repair move |")
    A("| `adaptive_tutor_routes` | Six routes, every one resolving to `static-lesson-fallback` |")
    A("| `extension` | Where to go when the learner is ready for more |")
    A("| `lesson_flow` | Five or more segments with explicit adult actions |")
    A("| `media.fallback` | A written path that needs no image, audio, or video |")
    A("| `study_adapter.static_fallback_available` | Always `true`; `requires_adaptive_package` always `false` |")
    A("")
    A("## The six static routes\n")
    A("Every Grade 3 lesson resolves all six of these without any external package:\n")
    A("1. **prerequisite gap** - return to the unit's smallest prerequisite, reteach concretely, retry one "
      "fresh item.")
    A("2. **target misconception observed** - the unit's named pattern, its diagnostic probe, and its "
      "repair move.")
    A("3. **procedure without understanding** - require a representation of why the procedure works before "
      "more items.")
    A("4. **correct but low confidence** - confirm the reasoning, vary the example, do not remediate.")
    A("5. **repeated error pattern** - name the pattern neutrally, contrast with a worked example, schedule "
      "spaced review.")
    A("6. **mastery evidence** - require independent application plus explanation on a later occasion.\n")
    A("## Unit-level fallback\n")
    A("Each of the ten Grade 3 units supplies a prerequisite list and a table of five known misconceptions, "
      "each with a diagnostic probe and a repair move. Together with the lesson-level fields above, this is "
      "the complete help system for the course.\n")
    A("## What a runtime should do\n")
    A("A Study runtime that has no Adaptive Math capability should render Grade 3 exactly as authored and "
      "take no degraded-mode branch. There is no missing-capability warning to show, because nothing is "
      "missing: `requires_adaptive_package` is `false` on all 180 Grade 3 lessons.\n")
    return "\n".join(L) + "\n"

# --- schema ----------------------------------------------------------------

LESSON_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://manuel.academy/schemas/curriculum-lesson-g34-v1.json",
    "title": "Manuel Academy Curriculum Lesson v1 - Grade 3/4 profile",
    "description": ("Grade 3/4 profile of the Manuel Academy curriculum lesson contract. It keeps every "
                    "required field of curriculum-lesson-v1 and adds the fields the Grade 3/4 courses rely "
                    "on: evidence typing, the target misconception, the evidence record, and the Study "
                    "adapter block. The v1.0.0 package schema is unchanged by this profile."),
    "type": "object",
    "required": [
        "schema_version", "lesson_id", "course_id", "grade", "subject", "course_day", "unit_number",
        "title", "phase", "focus", "standards", "learning_objectives", "lesson_flow", "formative_check",
        "mastery_rule", "accessibility_and_accommodations", "safety_and_privacy",
        "evidence_type", "target_misconception", "adaptive_tutor_routes", "media", "evidence_record",
        "study_adapter",
    ],
    "properties": {
        "schema_version": {"const": "1.0"},
        "lesson_id": {"type": "string", "pattern": "^ma-g(3|4)-mathematics-u[0-9]{2}-l[0-9]{2}$"},
        "course_id": {"type": "string", "pattern": "^ma-g(3|4)-mathematics$"},
        "grade": {"enum": [3, 4]},
        "subject": {"const": "mathematics"},
        "course_day": {"type": "integer", "minimum": 1, "maximum": 180},
        "unit_number": {"type": "integer", "minimum": 1, "maximum": 10},
        "day_in_unit": {"type": "integer", "minimum": 1, "maximum": 18},
        "title": {"type": "string", "minLength": 5},
        "phase": {"type": "string"},
        "focus": {"type": "string"},
        "evidence_type": {"enum": ["instruction", "guided-practice", "independent-evidence", "retrieval",
                                   "project", "assessment", "reassessment"]},
        "counts_toward_independent_mastery_evidence": {"type": "boolean"},
        "standards": {"type": "array", "minItems": 1, "items": {"type": "string"}},
        "learning_objectives": {"type": "array", "minItems": 3, "items": {"type": "string"}},
        "success_criteria": {"type": "array", "minItems": 3, "items": {"type": "string"}},
        "lesson_flow": {
            "type": "array", "minItems": 5,
            "items": {"type": "object",
                      "required": ["segment_id", "segment", "minutes", "teacher_or_tutor_action"],
                      "properties": {"segment_id": {"type": "string"}, "segment": {"type": "string"},
                                     "minutes": {"type": "string"},
                                     "teacher_or_tutor_action": {"type": "string"}}},
        },
        "formative_check": {"type": "string"},
        "mastery_rule": {"type": "string"},
        "target_misconception": {
            "type": "object", "required": ["pattern", "diagnostic_probe", "repair_move"],
            "properties": {"pattern": {"type": "string"}, "diagnostic_probe": {"type": "string"},
                           "repair_move": {"type": "string"}},
        },
        "adaptive_tutor_routes": {
            "type": "array", "minItems": 5,
            "items": {"type": "object", "required": ["signal", "action", "handler"],
                      "properties": {"signal": {"type": "string"}, "action": {"type": "string"},
                                     "handler": {"enum": ["static-lesson-fallback",
                                                          "adaptive-math-capability-marker"]},
                                     "capability": {"type": "string"},
                                     "aligned_sequence_ids": {"type": "array",
                                                              "items": {"type": "string"}}}},
        },
        "accessibility_and_accommodations": {"type": "array", "minItems": 5, "items": {"type": "string"}},
        "safety_and_privacy": {"type": "array", "minItems": 2, "items": {"type": "string"}},
        "media": {
            "type": "object", "required": ["required", "fallback", "reduced_motion_safe"],
            "properties": {"suggestion": {"type": "string"}, "required": {"const": False},
                           "fallback": {"type": "string"}, "reduced_motion_safe": {"const": True}},
        },
        "evidence_record": {
            "type": "object",
            "required": ["persist", "do_not_persist", "raw_learner_response_persistence"],
            "properties": {"persist": {"type": "array", "items": {"type": "string"}},
                           "do_not_persist": {"type": "array", "items": {"type": "string"}},
                           "raw_learner_response_persistence": {"const": "not-required"}},
        },
        "study_adapter": {
            "type": "object",
            "required": ["resumable_by_segment", "segment_ids", "static_fallback_available",
                         "requires_adaptive_package"],
            "properties": {"resumable_by_segment": {"const": True},
                           "segment_ids": {"type": "array", "minItems": 5, "items": {"type": "string"}},
                           "session_target_minutes": {"type": "string"},
                           "break_points_after": {"type": "array", "items": {"type": "string"}},
                           "static_fallback_available": {"const": True},
                           "requires_network": {"const": False},
                           "requires_adaptive_package": {"const": False}},
        },
    },
    "additionalProperties": True,
}

# --- main ------------------------------------------------------------------

def main():
    all_lessons, all_units, all_assess = {}, {}, {}
    course_index, unit_index, lesson_rows = [], [], []

    for g, mod in GRADES.items():
        lessons = build_lessons(g, mod)
        units = build_units(g, mod, lessons)
        assess = build_assessments(g, mod)
        all_lessons[g], all_units[g], all_assess[g] = lessons, units, assess
        base = os.path.join(ROOT, "courses", "grade-%d" % g, "mathematics")

        w_jsonl(os.path.join(base, "lessons.jsonl"), lessons)
        w_json(os.path.join(base, "units.json"), units)
        w_json(os.path.join(base, "assessments.json"), assess)
        w_json(os.path.join(base, "practice.json"), build_practice(g, mod))
        w_json(os.path.join(base, "projects.json"), build_projects(g, mod))
        w_json(os.path.join(base, "mastery-evidence.json"), build_mastery(g, mod))
        w_text(os.path.join(base, "course-guide.md"), course_guide(g, mod, units))
        w_text(os.path.join(base, "lesson-sequence.md"), lesson_sequence(g, mod, lessons))
        w_text(os.path.join(base, "teacher-parent-guide.md"), teacher_parent_guide(g, mod))
        w_text(os.path.join(base, "accessibility-no-media.md"), accessibility_doc(g))
        w_csv(os.path.join(base, "schedule-36-week.csv"), build_schedule(g, lessons),
              ["week", "day_of_week", "course_day", "lesson_id", "unit_number", "unit_title",
               "phase", "evidence_type", "standards"])

        course_index.append({
            "course_id": cid(g), "grade": g, "subject": "mathematics",
            "title": "Grade %d Mathematics" % g, "days": len(lessons), "units": len(units),
            "weeks": WEEKS, "days_per_week": DAYS_PER_WEEK,
            "session_minutes": SESSION_MINUTES[g],
            "capstone": mod.UNITS[-1]["task"],
            "requires_adaptive_package": False,
            "path": "courses/grade-%d/mathematics" % g,
        })
        unit_index.extend(units)
        for l in lessons:
            lesson_rows.append({
                "lesson_id": l["lesson_id"], "course_id": l["course_id"], "grade": l["grade"],
                "subject": l["subject"], "course_day": l["course_day"], "unit_number": l["unit_number"],
                "unit_title": l["unit_title"], "day_in_unit": l["day_in_unit"], "title": l["title"],
                "phase": l["phase"], "focus": l["focus"], "evidence_type": l["evidence_type"],
                "standards": ";".join(l["standards"]),
            })

    w_json(os.path.join(ROOT, "indexes", "course-index.json"), course_index)
    w_json(os.path.join(ROOT, "indexes", "unit-index.json"), unit_index)
    w_csv(os.path.join(ROOT, "indexes", "lesson-index.csv"), lesson_rows,
          ["lesson_id", "course_id", "grade", "subject", "course_day", "unit_number", "unit_title",
           "day_in_unit", "title", "phase", "focus", "evidence_type", "standards"])

    smap = build_standards_map(all_lessons)
    w_json(os.path.join(ROOT, "standards", "standards-map.json"), smap)
    w_text(os.path.join(ROOT, "standards", "standards-map.md"), standards_map_md(smap))

    capmap = build_capability_map(all_units)
    w_json(os.path.join(ROOT, "adaptive", "adaptive-math-capability-map.json"), capmap)
    w_text(os.path.join(ROOT, "adaptive", "adaptive-math-adapter.md"), adapter_doc(capmap))
    w_text(os.path.join(ROOT, "adaptive", "grade3-static-fallback.md"), fallback_doc())

    w_json(os.path.join(ROOT, "schemas", "lesson.schema.json"), LESSON_SCHEMA)

    manifest = {
        "package_id": PACKAGE_ID, "version": VERSION, "authored_on": AUTHORED_ON,
        "status": "grade34-mathematics-authoring-complete",
        "subject": "mathematics", "grades": [3, 4],
        "jurisdictional_alignment": ("Michigan-aligned; locally authored; not a claim of state approval, "
                                     "accreditation, licensure, or automatic credit"),
        "school_year": {"weeks": WEEKS, "days_per_week": DAYS_PER_WEEK, "instructional_days": 180},
        "cadence_note": ("180 daily lesson opportunities across 36 weeks at 5 instructional days per week, "
                         "matching the Manuel Academy v1.0.0 mathematics convention. No deviation was "
                         "required."),
        "counts": {
            "courses": len(course_index), "units": len(unit_index),
            "lessons": sum(len(v) for v in all_lessons.values()),
            "lessons_by_grade": {str(g): len(v) for g, v in all_lessons.items()},
            "assessments": sum(len(v) for v in all_assess.values()),
            "content_standards_covered": {g: smap["grades"][g]["content_standards_covered"]
                                          for g in ("3", "4")},
        },
        "contract_reference": {
            "schema_and_policy_reference": "curriculum-content/manuel-academy/1.0.0",
            "note": ("The v1.0.0 package is the schema, policy, and convention reference. It is read, not "
                     "modified. No Grade 5 content is copied, adapted, or reused."),
        },
        "frozen_baselines": [{
            "artifact": "adaptive-tutor/subjects/math",
            "declared_version": "1.0.0",
            "role": ("Adaptive mathematics intervention overlay for grades 4-6; referenced through a "
                     "capability marker only. Not copied, rewritten, or modified."),
        }],
        "entry_points": {
            "human": "README.md",
            "courses": "indexes/course-index.json",
            "units": "indexes/unit-index.json",
            "lessons": "indexes/lesson-index.csv",
            "schema": "schemas/lesson.schema.json",
            "standards": "standards/standards-map.json",
            "adaptive": "adaptive/adaptive-math-capability-map.json",
            "validation": "validation/validation-report.md",
            "blockers": "PILOT_BLOCKERS.md",
        },
        "boundaries": [
            "Owns only curriculum-authoring/full-family-grade34/subjects/mathematics/**.",
            "No release path, no other subject, and no Study Engine source is modified.",
            "The frozen adaptive-math package is referenced but never embedded or altered.",
            "Grade 5 mathematics is neither rewritten nor duplicated.",
            "No repository, database, hosted service, identity system, or deployment is modified.",
        ],
    }
    w_json(os.path.join(ROOT, "package-manifest.json"), manifest)

    print("courses: %d" % len(course_index))
    print("units:   %d" % len(unit_index))
    print("lessons: %d (%s)" % (sum(len(v) for v in all_lessons.values()),
                                ", ".join("g%d=%d" % (g, len(v)) for g, v in sorted(all_lessons.items()))))
    print("standards covered: %s" % manifest["counts"]["content_standards_covered"])
    return manifest


if __name__ == "__main__":
    main()
