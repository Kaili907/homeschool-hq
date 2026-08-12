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
PERFORMANCE_DAY = 9
ASSESSMENT_DAY = 11
# Day 9 builds the performance task, which for any unit with a physical or chemical
# investigation means handling the same materials again. It therefore inherits the
# investigation's full safety set instead of the desk-work baseline.
HANDS_ON_DAYS = (INVESTIGATION_DAY, PERFORMANCE_DAY)

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
    "Burn: cool it under running cool water for 20 minutes. Do not use ice, butter, or ointment.",
    "Splash in an eye: rinse with running water for 15 minutes, holding the eyelid open, before anything else.",
    "Fumes or a strong smell: leave the room, open a window from outside the room, and do not go back in to tidy up.",
    "Fire: do not use water. Get everyone out, close the door, and call the emergency number. Smother a very small "
    "contained flame with a metal pan lid or a fire blanket only if that is safe to do without reaching over it.",
    "If anyone may have swallowed a magnet, a battery, or any material from a lesson, treat it as an emergency and "
    "seek medical help at once. Do not wait for symptoms.",
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
    "Never fully seal a reacting, fermenting, oxidising, or warm mixture in any container.",
    "Never have a flammable liquid open in the same room as a flame, hob, pilot light, heater, lamp, charger, or battery.",
    "Never use alcohol, or any other fuel, for a flame demonstration; no open-flame demonstration is used anywhere in this package.",
    "Never light, strike, or operate an open flame or a hob, burner, or pilot light for any investigation in this package; no lesson requires one.",
    "Never cut, tear, puncture, or open a sealed commercial product - cold pack, hand warmer, glow stick, or smoke detector.",
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
    {"namespace": "manuel.academy/lab-safety", "value_schema_ref": "lab-safety-v1",
     "allowed_projection": "student-safe"},
]

# The 2.0.0 contract strips safety_privacy from the student projection, so safety that
# lives only there never reaches the learner. Everything actionable is therefore also
# rendered into the learner-visible lesson flow, the student activity, and a student-safe
# lab-safety extension. safety_privacy stays as the guardian record.
SAFETY_LABELS = ("HAZARD", "MITIGATION", "SUPERVISION", "SAFE ORDER", "STOP", "DISPOSAL", "ALTERNATIVE")


def ext(namespace, schema_ref, key, text):
    if len(text) > 2000:
        raise SystemExit(f"extension {namespace}/{key} is {len(text)} chars; the contract caps string "
                         "extension values at 2000 and silent truncation would drop safety text")
    return {"namespace": namespace, "key": key, "schema_ref": schema_ref,
            "projection": "student-safe", "value": {"type": "string", "value": text}}


def supervision_sentence(level):
    return {
        "none": "SUPERVISION: you may work on this independently. Tell an adult before you start anyway.",
        "nearby-adult": "SUPERVISION: an adult must be within earshot and able to reach you. Do not start until they are.",
        "direct-adult": "SUPERVISION: an adult must be beside you, watching, for the whole investigation. Do not start "
                        "any step until they are there.",
    }[level]


# Anything a mitigation tells the learner to wear has to appear on the materials list, or the
# family has no notice to obtain it before the session.
PPE_FROM_MITIGATION = (
    (re.compile(r"\bgloves?\b", re.I), "gloves - REQUIRED for this investigation"),
    (re.compile(r"waterproof dressing", re.I), "waterproof dressing for any cut or graze - REQUIRED for this investigation"),
)


def mitigation_ppe(inv):
    listed = " | ".join(inv["materials"])
    return [label for pattern, label in PPE_FROM_MITIGATION
            if pattern.search(" ".join(m for _, _, m in inv["hazards"])) and not pattern.search(listed)]


def requires_eye_protection(inv):
    """Resolve the PPE line at build time; the learner cannot read the hazard list to decide."""
    text = " ".join(d + " " + m for _, d, m in inv["hazards"]).lower()
    kinds = {k for k, _, _ in inv["hazards"]}
    return "chemical" in kinds or any(w in text for w in ("eye protection", "splash", "spatter", "snap back", "tension"))


def safety_capsule(inv):
    """Compact machine-readable safety block for a host that renders safety separately.
    The full brief is carried in lesson_flow, which has room for all of it."""
    kinds = sorted({k for k, _, _ in inv["hazards"]})
    return (f"SUPERVISION: {inv['supervision']} | "
            f"EYE PROTECTION: {'required' if requires_eye_protection(inv) else 'not required'} | "
            f"HAZARD KINDS: {', '.join(kinds)} | "
            f"HAZARD COUNT: {len(inv['hazards'])} | "
            f"SAFE-ORDER STEPS: {len(inv['sequence'])} | "
            f"STOP CONDITIONS: {len(inv['stop']) + len(GLOBAL_STOP)} | "
            "The full hazard, mitigation, safe-order, stop-condition, disposal, and alternative text is in this "
            "lesson's Safety review segment, which you must read before you touch any material.")


def safety_brief(inv):
    """The learner-facing safety brief. Every field a learner needs before touching a
    material appears here in plain text, because safety_privacy does not reach them."""
    lines = ["READ THIS BEFORE YOU TOUCH ANY MATERIAL."]
    for kind, description, mitigation in inv["hazards"]:
        lines.append(f"HAZARD ({kind}): {description}")
        lines.append(f"MITIGATION: {mitigation}")
    lines.append(supervision_sentence(inv["supervision"]))
    if requires_eye_protection(inv):
        lines.append("EYE PROTECTION IS REQUIRED for this investigation. Put it on before the first step.")
    lines.append("SAFE ORDER - do these steps in this order and do not reorder them:")
    for n, step in enumerate(inv["sequence"], start=1):
        lines.append(f"  SAFE ORDER {n}. {step}")
    lines.append("STOP CONDITIONS - stop at once if any of these happens:")
    for cond in list(inv["stop"]) + GLOBAL_STOP:
        lines.append(f"  STOP: {cond}")
    lines.append(f"DISPOSAL: {inv['disposal']}")
    lines.append(f"ALTERNATIVE (equal credit, no special equipment): {inv['alternative']}")
    lines.append("ALWAYS - these rules hold in every lesson and nobody can switch them off:")
    for rule in NON_DISABLEABLE:
        lines.append(f"  ALWAYS: {rule}")
    return "\n".join(lines)


def std_ref(pe):
    return {"framework_ref": FRAMEWORK_ID, "standard_id": pe, "mapping_status": "canonical"}


# A unit that owns no performance expectation says so, rather than borrowing a standard it
# has not taught. Borrowing put HS-ETS1-3, HS-PS2-1, and HS-ESS3-5 on Unit 1 assessments in
# three courses, in every case before the standard was taught.
FOUNDATION_REF = {
    "framework_ref": FRAMEWORK_ID,
    "legacy_label": "Science and engineering practice foundation - this unit claims no Michigan performance expectation.",
    "mapping_status": "human-review",
}


def taught_order():
    """Global teaching order: {performance expectation -> index of the unit that first teaches it}."""
    first, idx = {}, 0
    for course in sorted(spec.COURSES, key=lambda c: c["order"]):
        for unit in course["units"]:
            idx += 1
            for pe in unit["standards"]:
                first.setdefault(pe, idx)
    return first


TAUGHT_FIRST = None  # populated by build()


def split_spiral(unit, unit_index):
    """Reinforcement looks backwards; a preview looks forwards. They are never the same thing."""
    reinforces, previews = [], []
    for pe in unit["spiral"]:
        first = TAUGHT_FIRST.get(pe)
        (reinforces if first is not None and first <= unit_index else previews).append(pe)
    return reinforces, previews


def standards_role_text(unit, unit_index):
    reinforces, previews = split_spiral(unit, unit_index)
    parts = ["Primary coverage: " + (", ".join(pe.upper() for pe in unit["standards"])
                                     or "practice foundation; no performance expectation is claimed for this unit.")]
    if reinforces:
        parts.append("Reinforced (already taught in or before this unit, and assessed only where it is primary): "
                     + ", ".join(pe.upper() for pe in reinforces))
    if previews:
        parts.append("Previewed (taught later in the sequence; touched here to build readiness, never assessed here): "
                     + ", ".join(pe.upper() for pe in previews))
    return ". ".join(parts) + "."


def unit_standard_refs(unit):
    """Assessed standards are the unit's own primary coverage - never a spiral entry."""
    return [std_ref(pe) for pe in unit["standards"]] or [dict(FOUNDATION_REF)]


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


SEALED_PRODUCT = ("cold pack", "hand warmer", "glow stick", "smoke detector", "smoke alarm")

# The anchoring phenomenon is repeated in the retrieval segment of all twelve days, but only the
# hands-on days carry a safety brief. A phenomenon that names a material a learner could reproduce
# at a kitchen sink is therefore an unbriefed invitation on the ten days it is not investigated, so
# every hazard-bearing phenomenon carries its own student-visible rule on every day, briefed or not.
PHENOMENON_RIDERS = (
    (re.compile(r"\b(steel wool|iron powder|iron filings)\b", re.I),
     "damp or warm finely divided iron self-heats as it oxidises and can start a fire, so it is never dampened, "
     "warmed, sealed, bagged, boxed, or binned outside the Day 7 investigation, which an adult runs beside you in a "
     "wide open dish under that lesson's safety review; on every other day this phenomenon is studied from recorded "
     "data only and no steel wool is handled"),
    (re.compile(r"\b(sodium|potassium|caesium|cesium)\b", re.I),
     "these metals react violently with water, are never handled or substituted for anywhere in this course, and the "
     "phenomenon is studied from published footage and recorded data only"),
    (re.compile(r"\bsealed (bag|jar|box|container)\b", re.I),
     "a reacting, fermenting, oxidising, or warm mixture is never sealed in any container in any other lesson; the one "
     "sealed trial in this course is the Day 7 investigation, at the quantity that lesson fixes, flat on a tray, never "
     "held, with an adult beside you under its safety review"),
    (re.compile(r"\b(fizzy|carbonated|sparkling) (water|drink)\b|\bsealed bottle\b", re.I),
     "a closed carbonated bottle is a pressure vessel: it is never warmed above 40 degrees Celsius, never shaken while "
     "closed, and is opened slowly by an adult with the cap pointed away from every face"),
    (re.compile(r"\b(bleach|ammonia|drain cleaner)\b", re.I),
     "household cleaning products are never mixed, decanted, or brought to the work surface in any lesson, and no "
     "investigation uses one"),
)


def phenomenon_line(unit):
    """A hazard-bearing material named in the phenomenon carries its rule every day, briefed or not."""
    text = unit["phenomenon"]
    riders = []
    named = [p for p in SEALED_PRODUCT if p in text.lower()]
    if named:
        riders.append("the " + " and ".join(named) + " in this unit "
                      + ("is" if len(named) == 1 else "are")
                      + " observed sealed and from the outside only - never cut, torn, punctured, bitten, dismantled, "
                        "or opened, and the contents are never touched or tasted")
    for pattern, rider in PHENOMENON_RIDERS:
        if pattern.search(text):
            riders.append(rider)
    if not riders:
        return text
    return text + " SAFETY: " + "; ".join(riders) + "."


def hands_on(inv, day):
    """True when this day physically handles the investigation's materials."""
    if day == INVESTIGATION_DAY:
        return True
    if day != PERFORMANCE_DAY:
        return False
    return any(k in ("physical", "chemical") for k, _, _ in inv["hazards"])


def flow(unit, focus, phase, day, inv):
    a = []
    if hands_on(inv, day):
        # First segment of any hands-on day, and it is student-visible: the learner reads the
        # actual hazards, mitigations, supervision, safe order, stop conditions, disposal, and
        # alternative here, not a pointer to a guardian-only record.
        a.append({"segment_id": "safety-review", "title": "Safety review before any material is handled",
                  "duration": {"minimum_minutes": 6, "maximum_minutes": 9},
                  "teacher_or_tutor_action": safety_brief(inv)})
    for seg_id, seg_title, lo, hi in SEGMENTS:
        if seg_id == "retrieval":
            act = (f"Open with the unit phenomenon - {phenomenon_line(unit)} - or a short retrieval prompt on {focus}. "
                   "Ask the learner to notice, predict, estimate, or question before any instruction. Record the prediction; it is not graded.")
        elif seg_id == "instruction":
            act = (f"Develop {focus} from the phenomenon: pose the testable question, build or use a model, and show how evidence "
                   f"constrains the explanation. Name the success criteria and demonstrate how to check the work. Phase focus: {phase}.")
            if hands_on(inv, day):
                act = (f"The safety review in the first segment has already been read aloud with the guardian present; do not begin until it "
                       f"has. Then model the procedure for: {inv['title']}, following the safe order exactly as written. Confirm which path the "
                       "family is running - the investigation or its no-special-equipment alternative. Both meet the same target.")
        elif seg_id == "guided":
            act = (f"Work two supported examples on {focus}, asking after each move: what evidence or reasoning supports that step? "
                   "Fade the prompting on the second example and have the learner narrate the check.")
            if hands_on(inv, day):
                act = (f"Set up and run the first trial together, or the first step of the alternative, keeping to the safe order in the safety "
                       "review. Establish how each measurement is taken, how uncertainty is recorded, and how a trial that goes wrong is "
                       "written down rather than discarded.")
        elif seg_id == "independent":
            act = (f"The learner completes a new application of {focus} independently and records both the result and the reasoning, evidence, "
                   "process, or design choice that produced it.")
            if hands_on(inv, day):
                act = ("Work through the safe order in the safety review, in order, without reordering it. Stop at once if any stop condition "
                       "happens. Then run the remaining trials and record your own data. No expected value is supplied beforehand and no result "
                       "is ever filled in for you. If the data is messy, write down what happened and why it may have happened. Finish with the "
                       "disposal steps in the safety review before anything is packed away.")
            if day == ASSESSMENT_DAY:
                act = ("The learner completes the unit assessment independently. The tutor may clarify what a prompt is asking but supplies no "
                       "answer, no worked solution, and no evaluation of correctness during the assessment.")
            if day == 12:
                act = ("The learner reworks the specific items missed, using a fresh parallel task rather than the original item, and writes what "
                       "changed in their thinking.")
        else:
            act = (f"In one concise response, the learner shows or explains the most important idea about {focus}, then names one check that "
                   "would catch an error or a weak claim in their own work.")
            if hands_on(inv, day):
                act = (f"Confirm out loud that every disposal step in the safety review has been done and nothing has been left sealed, warm, "
                       f"connected, or unaccounted for. Then in one concise response show or explain the most important idea about {focus}, and "
                       "name one check that would catch an error or a weak claim in your own work.")
        a.append({"segment_id": f"{seg_id}", "title": seg_title,
                  "duration": {"minimum_minutes": lo, "maximum_minutes": hi},
                  "teacher_or_tutor_action": act})
    return a


def clamp(text, field):
    if len(text) > 240:
        raise SystemExit(f"safety {field} is {len(text)} chars; the contract caps it at 240 and silent "
                         f"truncation would drop safety text: {text[:80]}...")
    return text


def safety_for(unit, day, inv):
    """Hands-on days carry the unit's full hazard set; desk days carry the baseline."""
    if hands_on(inv, day):
        hazards = [{"kind": k, "description": clamp(d, "hazard description"), "mitigation": clamp(m, "hazard mitigation")}
                   for k, d, m in inv["hazards"]]
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


def build_lesson(course, unit, unit_no, day, course_day, unit_index):
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
    if hands_on(inv, day):
        ppe = (["eye protection - REQUIRED for this investigation"] if requires_eye_protection(inv)
               else ["no eye protection is required for this investigation"]) + mitigation_ppe(inv)
        materials = list(inv["materials"]) + ppe + materials
    else:
        materials.append("printed or on-screen text, data table, or model for this lesson")

    resource_refs = ["res-hs-science-lab-safety-card", f"res-{cid}-investigation-guide"]
    if day in (INVESTIGATION_DAY, 9, 10):
        resource_refs.append(f"res-{cid}-data-sources")
    if day in (ASSESSMENT_DAY, 12):
        resource_refs.append("res-hs-science-mastery-evidence-guide")

    lesson_flow = flow(unit, focus, phase, day, inv)
    independent = next(seg for seg in lesson_flow if seg["segment_id"] == "independent")["teacher_or_tutor_action"]
    if hands_on(inv, day):
        student_activity = (f"SAFETY FIRST - {supervision_sentence(inv['supervision'])} Read the safety review segment in full "
                            "before you touch any material, follow the safe order in the order written, stop at once if any stop "
                            f"condition happens, and finish with the disposal steps. {independent}")
    else:
        student_activity = independent

    exts = [
        ext("manuel.academy/standards-role", "standards-role-v1", "role", standards_role_text(unit, unit_index)),
        ext("manuel.academy/data-provenance", "data-provenance-v1", "provenance", inv["data_source"]),
    ]
    if hands_on(inv, day):
        exts.append(ext("manuel.academy/lab-alternative", "lab-alternative-v1", "alternative", inv["alternative"]))
        exts.append(ext("manuel.academy/lab-safety", "lab-safety-v1", "safety", safety_capsule(inv)))
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
        "estimated_duration": ({"minimum_minutes": 61, "maximum_minutes": 84} if hands_on(inv, day)
                               else {"minimum_minutes": 55, "maximum_minutes": 75}),
        "standards": unit_standard_refs(unit),
        "essential_question": unit["essential_question"],
        "learning_objectives": objectives(unit, focus, phase, day),
        "success_criteria": criteria(unit, focus, day),
        "materials": materials[:100],
        "lesson_flow": lesson_flow,
        "student_activity": student_activity,
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
            "Share the lesson target, completion state, evidence type, and next instructional step. For any hands-on lesson, share the hazard "
            "list, the supervision level, the stop conditions, the safe order, the required PPE, and the disposal steps - including any step "
            "that runs unattended or overnight - BEFORE the session so the guardian can review them in advance. Do not expose raw "
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
        "standards": unit_standard_refs(unit),
        "total_points": total, "prompts": prompts,
        "rubric_dimensions": ["accuracy or fidelity", "evidence and reasoning", "application or transfer",
                              "checking and revision", "safety and honest reporting"],
        "accommodation_note": ("Any response mode the standard permits is acceptable: typed, handwritten, spoken, drawn, built, or demonstrated. "
                               "Extended time and a hidden timer are available by default. Reading the prompts aloud is allowed. No photograph, "
                               "video, or voice recording is required. Adjust quantity, pacing, or representation while preserving the target."),
        "protected_interpretation_ref": f"{aid}-interpretation",
        "extensions": [ext("manuel.academy/standards-role", "standards-role-v1", "role",
                           "Assessed here: " + (", ".join(s.upper() for s in unit["standards"])
                                                or "practice foundation; this assessment claims no performance expectation.")
                           + ". No standard is assessed before the unit that teaches it.")],
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
    global TAUGHT_FIRST
    TAUGHT_FIRST = taught_order()
    courses, units, lessons, assessments, interpretations, schedules = [], [], [], [], [], []
    unit_index = 0
    for course in sorted(spec.COURSES, key=lambda c: c["order"]):
        cid, unit_refs = course["course_id"], []
        course_day = 0
        course_pes = []
        for unit_no, unit in enumerate(course["units"], start=1):
            unit_index += 1
            u_id = uid(cid, unit_no)
            unit_refs.append(u_id)
            lesson_refs = []
            for day in range(1, 13):
                course_day += 1
                lesson = build_lesson(course, unit, unit_no, day, course_day, unit_index)
                lessons.append(lesson)
                lesson_refs.append(lesson["lesson_id"])
            a, i = build_assessment(course, unit, unit_no)  # assessed standards are primary only
            assessments.append(a); interpretations.append(i)
            for s in unit["standards"]:
                if s not in course_pes:
                    course_pes.append(s)
            units.append({
                "schema_set_version": SSV, "unit_id": u_id, "course_ref": cid, "grade": course["grade"],
                "subject": "science", "order": unit_no, "title": unit["title"], "days": 12,
                "standards": unit_standard_refs(unit),
                "essential_question": unit["essential_question"], "topics": unit["topics"],
                "performance_task": unit["performance_task"], "lesson_refs": lesson_refs,
                "assessment_ref": a["assessment_id"],
                "extensions": [
                    ext("manuel.academy/sequence-note", "sequence-note-v1", "phenomenon",
                        "Anchoring phenomenon: " + phenomenon_line(unit)),
                    ext("manuel.academy/lab-alternative", "lab-alternative-v1", "alternative",
                        "Day 7 investigation: " + unit["investigation"]["title"] + " | No-special-equipment alternative: "
                        + unit["investigation"]["alternative"]),
                    ext("manuel.academy/standards-role", "standards-role-v1", "role", standards_role_text(unit, unit_index)),
                    ext("manuel.academy/lab-safety", "lab-safety-v1", "safety", safety_capsule(unit["investigation"])),
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
