#!/usr/bin/env python3
"""Deterministic generator for High School Ready for Life 9-12.

Emits, per course: course-guide.md, units.json, lessons.jsonl, assessments.json,
daily-schedule.csv, lesson-sequence.md.

Deterministic: no clock, no randomness, no network.

    python3 authoring/generate_courses.py
"""
import csv, io, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blueprints as BP

LANE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURSES = os.path.join(LANE, "courses")

SAFETY = [
    "Use respectful, non-shaming language. Difficulty with a life skill is never treated as a character flaw, and no learner is compared to another.",
    "Guardian supervision is required for heat, sharp tools, appliances, chemicals, medication, electricity, ladders or heights, power tools, driving, water, money movement, or contact with unfamiliar adults.",
    "No unsafe unsupervised real-world task is ever assigned. Where supervision is not available, the simulated alternative carries equal credit.",
    "No credential collection. No password, account number, government identifier, card number, or real balance is requested, displayed, entered, or stored anywhere in this course.",
    "No forced private disclosure. Autobiographical or household detail is never required; a fictional or analytical alternative is always offered and is never scored lower.",
    "No identifiable learner photo, voice recording, or public performance is required; a checklist, drawing, written explanation, or guardian confirmation is always accepted.",
    "Stop and get adult help with fire, broken glass, electrical hazards, gas or chemical smells, heavy objects, leaks, injury, raw-food risk, or any unknown substance.",
    "Nothing in this course is medical, legal, financial, employment, or immigration advice. Where a topic touches those, the lesson teaches how to find a qualified human source and declines to individualize.",
    "Local rules vary. Driving, working age, curfew, tenancy, identification, and majority rules differ by jurisdiction; verify against a current local source rather than assuming.",
]

ACCESS = [
    "Provide readable text plus optional audio or read-aloud support; no voice feature is required.",
    "Chunk directions into one action at a time and keep the success criteria visible in text.",
    "Allow typed, handwritten, dictated, drawn, or checklist responses; the response mode is not the competency.",
    "Offer reduced-copying, extended-time, hidden-timer, movement-break, and low-distraction options.",
    "Break any multi-step real-world task into a printed sequence the learner can hold and tick off.",
    "Use captions, transcripts, alt text, high-contrast print, and keyboard access for any media.",
    "Preserve the competency while adjusting quantity, pacing, representation, supervision level, or response mode.",
]

MASTERY = ("Do not mark mastery from one answer, and never from practice generation alone. Require accurate "
           "independent evidence plus the learner's own explanation on at least two separate occasions, at least "
           "one of them transferred to a situation the learner has not rehearsed. A guardian-attested real-world "
           "performance counts as one occasion only when the attestation is present.")

CERT_RULE = ("A click cannot certify a real-world adult-supervised task. A learner-side completion toggle records "
             "only that the learner reports having finished. Evidence for this lesson is not complete until an "
             "adult attestation names the observing adult's role, what the adult actually observed, and the date.")

VISIBILITY = ("Share the lesson target, completion state, evidence type, guardian attestation where required, and "
              "the next instructional step. Do not expose raw reflections, raw responses, recordings, photographs, "
              "household detail, health detail, or diagnosis-like language.")

AUTHORSHIP = [
    "The learner does the task and produces every assessed response, plan, and defence. The tutor may explain, question, critique, or suggest a direction.",
    "The tutor must not draft the learner's plan or statement, and must not complete a graded task on the learner's behalf.",
    "Tutor or adult assistance is logged as guided evidence; unaided work is logged as independent evidence. Mastery requires independent evidence.",
    "An adult attestation records that a real-world task was observed. It is not a substitute for the learner's own explanation.",
]


def routes(focus, signoff):
    r = [
        {"signal": "prerequisite gap",
         "action": f"Return to the smallest prerequisite needed for {focus}, model it once, then retry one fresh step. Do not perform the task for the learner."},
        {"signal": "procedure without understanding",
         "action": f"Ask the learner to explain why the steps for {focus} are in that order, and what would go wrong if one were skipped."},
        {"signal": "correct but low confidence",
         "action": f"Name specifically what the learner got right about {focus}, offer one varied situation, and avoid unnecessary remediation."},
        {"signal": "repeated error pattern",
         "action": f"Describe the observable pattern neutrally and schedule a short later review of {focus}. Never infer effort, motivation, character, diagnosis, or family circumstance from an error."},
        {"signal": "requests the answer",
         "action": "Decline to supply the assessed response. Offer a question, a criterion, a checklist, or a worked analogue instead, and record that guided support was given."},
        {"signal": "expresses shame or self-criticism",
         "action": "Respond without agreeing or minimising. Separate the skill from the person, name one concrete thing that worked, and continue. Do not record the disclosure in progress metadata."},
        {"signal": "discloses private or household detail",
         "action": "Do not probe, repeat, or store it. Acknowledge briefly, offer the fictional or analytical alternative, and continue. Guardian-visible records carry no such detail."},
        {"signal": "offers a credential or identifier",
         "action": "Stop and redirect. Do not accept, repeat, or store any password, account number, card number, or government identifier. Restate that this course never needs one."},
        {"signal": "proposes an unsafe or unsupervised action",
         "action": "Decline and stop. Name the specific hazard plainly and without alarm, require the guardian-supervised route or offer the simulated alternative at equal credit, and do not proceed until one is chosen."},
        {"signal": "asks for medical, legal, or financial direction",
         "action": "Decline to individualize. Give the general principle, then direct the learner to a qualified adult or licensed professional. Do not diagnose, advise, or predict an outcome."},
        {"signal": "mastery evidence", "action": MASTERY},
    ]
    if signoff:
        r.insert(-1, {"signal": "reports a real-world task complete without attestation",
                      "action": CERT_RULE + " Ask who supervised, record the attestation fields, and leave the evidence open until they are present."})
    return r


def flow(focus, phase, signoff):
    supervised = (" An adult supervises this step and will be asked to attest to what they observed."
                  if signoff else "")
    return [
        {"segment": "Welcome and retrieval", "minutes": "5-8",
         "teacher_or_tutor_action": f"Open with a short retrieval prompt on {focus}. Ask the learner to recall, predict, or raise a question before instruction."},
        {"segment": "Model or mini-lesson", "minutes": "8-15",
         "teacher_or_tutor_action": f"Name the skill, walk through {focus} once at normal speed, then again naming each decision point and each hazard."},
        {"segment": "Guided practice", "minutes": "10-18",
         "teacher_or_tutor_action": f"Work through {focus} together with prompts, fading support on the second pass. After each step ask, \"What tells you that step is done correctly?\""},
        {"segment": "Application", "minutes": "15-25",
         "teacher_or_tutor_action": f"The learner carries out {focus} with the checklist available, recording what they did and what they noticed.{supervised} The learner does the task; the tutor may question but may not do it for them."},
        {"segment": "Review and next step", "minutes": "5-10",
         "teacher_or_tutor_action": f"The learner states what worked, what needed help, and the single next step for {focus}. Record evidence type and, where required, the adult attestation."},
    ]


def build_course(grade):
    theme_title, theme_desc = BP.GRADE_THEMES[grade]
    course_id = f"ma-g{grade}-{BP.SUBJECT}"
    std_string = f"Manuel Academy RFL Grade {grade} progression"
    units, lessons, assessments, sched = [], [], [], []
    day = 0
    for ui, spec in enumerate(BP.BLUEPRINTS[grade], start=1):
        unit_id = f"{course_id}-u{ui:02d}"
        n = BP.LESSONS_PER_UNIT
        lesson_ids = [f"{unit_id}-l{i:02d}" for i in range(1, n + 1)]
        cap = spec.get("capstone_level")
        units.append({
            "unit_id": unit_id, "course_id": course_id, "grade": grade,
            "subject": BP.SUBJECT, "unit_number": ui, "title": spec["title"],
            "days": n,
            "standards": [std_string],
            "competency_domains": list(spec["domains"]),
            "essential_question": spec["essential_question"],
            "topics": list(spec["topics"]),
            "performance_task": spec["performance_task"],
            "capstone_level": cap,
            "requires_guardian_signoff": True,
            "lesson_ids": lesson_ids,
            "assessment_id": f"{unit_id}-assessment",
        })
        for i in range(1, n + 1):
            day += 1
            focus = spec["topics"][i - 1]
            phase = BP.PHASES[i - 1]
            signoff = i in BP.GUARDIAN_SIGNOFF_DAYS
            lessons.append({
                "schema_version": "1.0",
                "lesson_id": lesson_ids[i - 1], "course_id": course_id,
                "grade": grade, "subject": BP.SUBJECT, "course_day": day,
                "unit_number": ui, "unit_title": spec["title"], "day_in_unit": i,
                "title": f"{phase}: {focus}",
                "phase": phase, "focus": focus,
                "estimated_minutes": "40-60",
                "standards": [std_string],
                "competency_domains": list(spec["domains"]),
                "essential_question": spec["essential_question"],
                "learning_objectives": [
                    f"Explain what {focus} involves and why it matters for living independently.",
                    f"Carry out {focus} at {theme_title.lower()} level, with supervision where the task requires it.",
                    f"Judge the learner's own performance of {focus} against stated criteria and name the next step.",
                ],
                "success_criteria": [
                    f"The learner completes the task for {focus} using the checklist.",
                    "The learner explains the reasoning and names each hazard or decision point that applied.",
                    "The learner states honestly what needed help and what the next step is.",
                ],
                "materials": [
                    "course notebook or digital equivalent",
                    "the unit's task checklist",
                    "any supplies named in the checklist, gathered with an adult where the task requires supervision",
                ],
                "lesson_flow": flow(focus, phase, signoff),
                "student_activity": f"The learner carries out {focus} with the checklist available, recording what they did and what they noticed.",
                "formative_check": f"State what makes {focus} done correctly, and one sign that it has gone wrong.",
                "answer_or_scoring_guidance": (
                    f"Score the stated competency for {focus}: whether the task was completed correctly and safely, "
                    "the quality of the learner's own explanation, and the honesty of the self-review. Do not score "
                    "household resources, family circumstance, or the learner's starting point. Do not infer effort, "
                    "motivation, character, or diagnosis from a difficulty."),
                "adaptive_tutor_routes": routes(focus, signoff),
                "mastery_rule": MASTERY,
                "extension": f"Carry out {focus} again in a different setting or under a different constraint and compare what changed.",
                "student_authorship": list(AUTHORSHIP),
                "accessibility_and_accommodations": list(ACCESS),
                "safety_and_privacy": list(SAFETY),
                "requires_guardian_signoff": signoff,
                "guardian_signoff_rule": CERT_RULE if signoff else None,
                "adult_attestation": ({
                    "required": True,
                    "fields": ["observing_adult_role", "what_was_observed", "date"],
                    "click_alone_is_insufficient": True,
                    "note": CERT_RULE,
                } if signoff else {"required": False, "click_alone_is_insufficient": True}),
                "simulated_alternative": (
                    f"If supervision is unavailable or the task is not safe in this household, the learner completes "
                    f"a walkthrough, checklist, or role-play of {focus} instead. The simulated route carries equal "
                    "credit and is never recorded as a lesser result."),
                "media": {
                    "suggestion": f"Optional checklist, labelled diagram, or step photograph of the task for {focus}.",
                    "required": False,
                    "fallback": "Provide the same information as readable text or alt text. No media is required, and no identifiable learner photo is ever required.",
                },
                "parent_or_guardian_visibility": VISIBILITY,
                "home_connection": (
                    f"Invite the learner to notice one place {focus} already shows up in daily life. No purchase, "
                    "account signup, app download, or disclosure of private family detail is required."),
                "performance_task_link": spec["performance_task"],
                "capstone_level": cap if i == n else None,
            })
            sched.append({
                "course_day": day, "week": day, "weekday": 1,
                "unit_number": ui, "unit_title": spec["title"],
                "lesson_id": lesson_ids[i - 1], "phase": phase, "focus": focus,
                "requires_guardian_signoff": "yes" if signoff else "no",
            })
        t = spec["topics"]
        assessments.append({
            "assessment_id": f"{unit_id}-assessment", "course_id": course_id,
            "unit_number": ui, "unit_title": spec["title"],
            "standards": [std_string], "competency_domains": list(spec["domains"]),
            "total_points": 30, "capstone_level": cap,
            "prompts": [
                {"type": "explain the skill", "points": 4,
                 "prompt": f"Explain {t[0]} in your own words, including why the order of steps matters."},
                {"type": "hazard and judgement", "points": 5,
                 "prompt": f"Identify the hazards or failure points in {t[1]} and state what supervision or check each one needs."},
                {"type": "demonstration", "points": 6,
                 "prompt": f"Demonstrate {t[2]}. An adult attests to what they observed; the learner supplies the explanation."},
                {"type": "problem solving", "points": 5,
                 "prompt": f"Something goes wrong during {t[3]}. Describe what you would do, in order, and when you would stop and ask for help."},
                {"type": "performance evidence", "points": 6,
                 "prompt": f"Present evidence from the unit performance task: {spec['performance_task']}"},
                {"type": "honest self-review", "points": 4,
                 "prompt": f"Connect {t[4]} and {t[5]}. State one thing you can now do independently, one that still needs support, and the next step. An honest answer scores full marks."},
            ],
            "administration_note": "Checklists, printed sequences, and adult supervision remain available during assessment unless independence at that specific step is the competency being measured.",
            "authorship_rule": "The learner performs the task and gives the explanation. Adult attestation records observation; it does not replace the learner's explanation and does not by itself establish mastery.",
            "signoff_rule": CERT_RULE,
            "no_shame_rule": "Naming a skill that still needs support scores full marks. No response is penalised for honesty about difficulty, and no result is framed as a personal failing.",
            "safety_rule": "No assessment step requires an unsafe or unsupervised action. Where supervision is unavailable, the simulated alternative carries equal credit.",
            "privacy_rule": "No assessment step requires disclosure of private household, financial, health, or personal detail.",
            "mastery_interpretation": MASTERY,
        })
    return course_id, theme_title, theme_desc, units, lessons, assessments, sched


def course_guide(grade, course_id, tt, td, units):
    L = []; a = L.append
    a(f"# Manuel Academy — Ready for Life, Grade {grade}")
    a(""); a(f"**{tt}.** {td}"); a("")
    a(f"- Course id: `{course_id}`")
    a(f"- Units: {len(units)}  |  Lessons: {BP.TOTAL_LESSONS}  |  Schedule: {BP.WEEKS} weeks x {BP.DAYS_PER_WEEK} day")
    a(f"- Competency framework: local Manuel Academy progression (`Manuel Academy RFL Grade {grade} progression`). "
      "Ready for Life has no external standards body and none is claimed.")
    a("")
    a("## Scope and sequence"); a("")
    for u in units:
        a(f"### Unit {u['unit_number']} — {u['title']}"); a("")
        a(f"*{u['essential_question']}*"); a("")
        a(f"- Days: {u['days']}  |  Domains: {', '.join(u['competency_domains'])}")
        a(f"- Topics: {'; '.join(u['topics'])}")
        a(f"- Performance task: {u['performance_task']}")
        if u["capstone_level"] == "senior":
            a("- **This is the Grade 12 transition-to-adulthood capstone — the culminating unit of the 9-12 progression.**")
        elif u["capstone_level"] == "year":
            a(f"- This is the Grade {grade} year capstone.")
        a("")
    a("## Safety and dignity policies"); a("")
    a("**No shame.** " + "Difficulty with a life skill is never treated as a character flaw. Honest self-assessment "
      "scores full marks. No learner is compared to another, and no result is framed as a personal or family failing.")
    a("")
    a("**No unsafe unsupervised task.** Any task involving heat, sharp tools, appliances, chemicals, medication, "
      "electricity, heights, power tools, driving, water, money movement, or unfamiliar adults is guardian-supervised "
      "or simulated. Where supervision is unavailable, the simulated alternative carries **equal credit**.")
    a("")
    a("**Guardian sign-off, and what a click cannot do.** " + CERT_RULE)
    a("")
    a(f"Lessons requiring attestation in this course: day {BP.GUARDIAN_SIGNOFF_DAYS[0]} and day "
      f"{BP.GUARDIAN_SIGNOFF_DAYS[1]} of every unit ({len(units) * len(BP.GUARDIAN_SIGNOFF_DAYS)} of "
      f"{BP.TOTAL_LESSONS} lessons).")
    a("")
    a("**No credential collection.** No password, account number, government identifier, card number, or real "
      "balance is requested, displayed, entered, or stored anywhere in this course.")
    a("")
    a("**No forced private disclosure.** Autobiographical, household, financial, or health disclosure is never "
      "required. A fictional or analytical alternative is always available and never scored lower.")
    a("")
    a("**Not advice.** Nothing here is medical, legal, financial, employment, or immigration advice. Local rules "
      "vary and are to be verified against a current local source rather than assumed.")
    a("")
    a("**Mastery.** Practice generation never directly awards mastery. " + MASTERY)
    a("")
    a("**Guardian visibility.** " + VISIBILITY)
    a("")
    return "\n".join(L) + "\n"


def lesson_sequence(grade, units, lessons):
    L = [f"# Ready for Life, Grade {grade} — Lesson Sequence", ""]
    by = {}
    for x in lessons:
        by.setdefault(x["unit_number"], []).append(x)
    for u in units:
        L += [f"## Unit {u['unit_number']} — {u['title']}", "",
              "| Day | Lesson | Phase | Focus | Guardian sign-off |",
              "| --- | --- | --- | --- | --- |"]
        for x in by[u["unit_number"]]:
            L.append(f"| {x['course_day']} | `{x['lesson_id']}` | {x['phase']} | {x['focus']} | "
                     f"{'**required**' if x['requires_guardian_signoff'] else 'not required'} |")
        L.append("")
    return "\n".join(L) + "\n"


def write(p, t):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(t)


def main():
    total = 0
    for grade in BP.GRADES:
        cid, tt, td, units, lessons, assess, sched = build_course(grade)
        d = os.path.join(COURSES, f"{BP.SUBJECT}-{grade}")
        os.makedirs(d, exist_ok=True)
        write(os.path.join(d, "units.json"), json.dumps(units, indent=2, ensure_ascii=False) + "\n")
        write(os.path.join(d, "lessons.jsonl"),
              "".join(json.dumps(x, ensure_ascii=False) + "\n" for x in lessons))
        write(os.path.join(d, "assessments.json"), json.dumps(assess, indent=2, ensure_ascii=False) + "\n")
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=["course_day", "week", "weekday", "unit_number", "unit_title",
                                            "lesson_id", "phase", "focus", "requires_guardian_signoff"],
                           lineterminator="\n")
        w.writeheader(); w.writerows(sched)
        write(os.path.join(d, "daily-schedule.csv"), buf.getvalue())
        write(os.path.join(d, "course-guide.md"), course_guide(grade, cid, tt, td, units))
        write(os.path.join(d, "lesson-sequence.md"), lesson_sequence(grade, units, lessons))
        total += len(lessons)
        sc = sum(1 for x in lessons if x["requires_guardian_signoff"])
        print(f"  {cid}: {len(units)} units, {len(lessons)} lessons, {sc} guardian sign-off lessons")
    print(f"ready-for-life 9-12: {total} lessons total")


if __name__ == "__main__":
    main()
