#!/usr/bin/env python3
"""Deterministic generator for High School Financial Literacy 9-12.

Emits, per course: course-guide.md, units.json, lessons.jsonl, assessments.json,
daily-schedule.csv, lesson-sequence.md.

Generation is deterministic: no clock, no randomness, no network. The same
blueprints produce byte-identical output.

    python3 authoring/generate_courses.py
"""
import csv, io, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import blueprints as BP

LANE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURSES = os.path.join(LANE, "courses")

SIM = "All figures, employers, institutions, offers, accounts, and documents in this course are fictional and exist only for practice."

SAFETY = [
    SIM,
    "Never enter or share a real bank or card number, password, PIN, Social Security or tax identification number, brokerage credential, or real account balance. No lesson in this course ever asks for one.",
    "No real transaction is required or requested: no purchase, transfer, deposit, withdrawal, trade, application, or account opening.",
    "This course teaches general financial concepts. It does not give individualized financial advice. For an actual decision, the learner is directed to a trusted adult or a qualified licensed professional.",
    "A learner's real household finances are private. Use the supplied fictional scenario; no learner is asked to disclose family income, debt, balances, or hardship.",
    "Use respectful, non-shaming language about money, debt, and financial difficulty. Financial hardship is never framed as a personal or family failing.",
]

ACCESS = [
    "Provide readable text plus optional audio or read-aloud support; no voice feature is required.",
    "Chunk directions into one action at a time and keep the success criteria visible in text.",
    "Allow typed, handwritten, dictated, or recorded-to-text responses; the response mode is not the standard.",
    "Supply every scenario's figures in an accessible table as well as any chart, and never require colour alone to carry meaning.",
    "Permit a calculator and a formula reference throughout unless the arithmetic itself is the stated target.",
    "Offer reduced-copying, extended-time, hidden-timer, movement-break, and low-distraction options.",
    "Preserve the learning target while adjusting quantity, pacing, representation, or response mode.",
]

AUTHORSHIP = [
    "The learner produces every assessed response, calculation, and defence. The tutor may explain, question, critique, or suggest a direction for revision.",
    "The tutor must not compute the assessed answer, draft the assessed writing, or complete a graded task on the learner's behalf.",
    "Tutor assistance is logged as guided evidence; unaided work is logged as independent evidence. Mastery requires independent evidence.",
    "Answer keys and scoring guidance stay adult-only and are never surfaced in a learner-facing surface.",
]

MASTERY = ("Do not mark mastery from one answer, and never from practice generation alone. Require accurate "
           "independent application plus an explanation of the reasoning on at least two separate occasions, at "
           "least one of them on a scenario the learner has not previously worked.")

VISIBILITY = ("Share the lesson target, completion state, evidence type, and next instructional step. Do not expose "
              "raw learner responses, raw reflections, recordings, any real or fictional household financial detail "
              "the learner volunteered, or diagnosis-like language.")


def routes(focus):
    return [
        {"signal": "prerequisite gap",
         "action": f"Return to the smallest prerequisite needed for {focus}, re-teach it on a short fictional example, then retry one fresh item. Do not compute or write the learner's response."},
        {"signal": "procedure without understanding",
         "action": f"Ask the learner to explain why the method for {focus} works, and what the result means for the fictional person in the scenario, before continuing."},
        {"signal": "correct but low confidence",
         "action": f"Name specifically what the reasoning got right about {focus}, offer one varied case, and avoid unnecessary remediation."},
        {"signal": "repeated error pattern",
         "action": f"Describe the observable pattern neutrally, contrast it with a correct case, and schedule a short later review of {focus}. Do not infer effort, character, or family circumstance from an error."},
        {"signal": "requests the answer",
         "action": "Decline to supply the assessed response. Offer a question, a criterion, a worked analogue on different numbers, or a counterexample instead, and record that guided support was given."},
        {"signal": "asks what they personally should do with real money",
         "action": "Decline to individualize. State plainly that this course teaches concepts and does not advise on a real decision, answer the general principle, and direct the learner to a trusted adult or a qualified licensed professional."},
        {"signal": "offers real financial or identifying data",
         "action": "Stop and redirect immediately. Do not accept, repeat, store, or act on a real account number, balance, credential, or identifier. Restate that the course uses fictional figures only, and continue with the supplied scenario."},
        {"signal": "discloses household financial hardship",
         "action": "Respond without judgement, do not probe, do not record the disclosure in progress metadata, and offer the fictional scenario as the working context. Where support is clearly needed, point to a trusted adult rather than advising."},
        {"signal": "mastery evidence",
         "action": MASTERY},
    ]


def flow(focus, phase):
    return [
        {"segment": "Welcome and retrieval", "minutes": "5-8",
         "teacher_or_tutor_action": f"Open with a short retrieval prompt on {focus}. Ask the learner to predict, recall, or pose a question before any instruction."},
        {"segment": "Model or mini-lesson", "minutes": "8-15",
         "teacher_or_tutor_action": f"Name the idea, show one worked fictional example of {focus}, and make the success criteria explicit before practice begins."},
        {"segment": "Guided practice", "minutes": "10-18",
         "teacher_or_tutor_action": f"Work two supported examples together. After each step ask, \"What in the scenario justifies that figure or that choice?\" Fade prompts on the second example. The object of practice is {focus}."},
        {"segment": "Independent application", "minutes": "15-28",
         "teacher_or_tutor_action": f"The learner completes a new fictional application of {focus} with the criteria checklist available, recording the result and the reasoning that produced it. The learner does this work; the tutor may question or critique but may not compute or draft it."},
        {"segment": "Exit ticket and next step", "minutes": "3-7",
         "teacher_or_tutor_action": f"In one concise response, state the most important conclusion about {focus} during {phase.lower()}, and one check that would expose a wrong assumption."},
    ]


def build_course(grade):
    theme_title, theme_desc = BP.GRADE_THEMES[grade]
    course_id = f"ma-g{grade}-{BP.SUBJECT}"
    units, lessons, assessments, sched = [], [], [], []
    day = 0
    for ui, ucode in enumerate(BP.UNIT_ORDER, start=1):
        spec = BP.BLUEPRINTS[grade][ucode]
        meta = BP.UNITS[ucode]
        n = BP.UNIT_LESSON_COUNTS[ui - 1]
        unit_id = f"{course_id}-u{ui:02d}"
        title = f"{ucode} — {meta['title']}: {spec['subtitle']}"
        lesson_ids = [f"{unit_id}-l{i:02d}" for i in range(1, n + 1)]
        capstone = grade == 12 and ucode == "PF7"

        units.append({
            "unit_id": unit_id, "course_id": course_id, "grade": grade,
            "subject": BP.SUBJECT, "standards_band": "9-12",
            "unit_number": ui, "title": title, "days": n,
            "standards": list(meta["codes"]),
            "essential_question": spec["essential_question"],
            "topics": list(spec["topics"]),
            "performance_task": spec["performance_task"],
            "is_capstone_unit": capstone,
            "simulation_only": True,
            "lesson_ids": lesson_ids,
            "assessment_id": f"{unit_id}-assessment",
        })

        for i in range(1, n + 1):
            day += 1
            focus = spec["topics"][(i - 1) % 6]
            phase = BP.PHASES[i - 1] if i - 1 < len(BP.PHASES) else BP.PHASES[-1]
            lessons.append({
                "schema_version": "1.0",
                "lesson_id": lesson_ids[i - 1], "course_id": course_id,
                "grade": grade, "subject": BP.SUBJECT, "course_day": day,
                "unit_number": ui, "unit_title": title, "day_in_unit": i,
                "title": f"{phase}: {focus}",
                "phase": phase, "focus": focus,
                "estimated_minutes": "45-60",
                "standards": list(meta["codes"]), "standards_band": "9-12",
                "essential_question": spec["essential_question"],
                "learning_objectives": [
                    f"Explain what {focus} means and why it changes a financial decision.",
                    f"Apply {focus} accurately to a fictional scenario at {theme_title.lower()} depth.",
                    f"Judge the sufficiency of the learner's own reasoning about {focus} and revise using stated criteria.",
                ],
                "success_criteria": [
                    f"The learner completes the central task about {focus} using the supplied fictional figures.",
                    "The learner shows the reasoning and the numbers behind the conclusion, not the conclusion alone.",
                    "The learner names one assumption the conclusion depends on and what would change it.",
                ],
                "materials": [
                    "course notebook or digital equivalent",
                    "the unit's fictional scenario pack",
                    "calculator and formula reference",
                ],
                "lesson_flow": flow(focus, phase),
                "student_activity": f"The learner completes a new fictional application of {focus}, recording the result and the reasoning that produced it. Focus: {focus}.",
                "formative_check": f"State the most important conclusion about {focus} and identify one assumption that, if wrong, would change it.",
                "answer_or_scoring_guidance": (
                    f"Score the stated target for {focus}: accuracy of the computation or analysis, the quality of the "
                    "reasoning and evidence, and the revision. Accept any defensible conclusion the fictional figures "
                    "support. Do not score the learner's or family's real financial situation, and do not infer effort, "
                    "motivation, character, or household circumstance from an error."),
                "adaptive_tutor_routes": routes(focus),
                "mastery_rule": MASTERY,
                "extension": f"Apply {focus} to a second fictional scenario with different figures and compare what changed.",
                "student_authorship": list(AUTHORSHIP),
                "accessibility_and_accommodations": list(ACCESS),
                "safety_and_privacy": list(SAFETY),
                "simulation_only": True,
                "requires_real_financial_data": False,
                "media": {
                    "suggestion": f"Optional table, chart, or annotated fictional document supporting {focus}.",
                    "required": False,
                    "fallback": "Provide the same information as readable text, an accessible data table, alt text, or a transcript. No media is required to meet the expectation.",
                },
                "parent_or_guardian_visibility": VISIBILITY,
                "home_connection": (
                    f"Invite the learner to notice one everyday, public instance of {focus} — a posted price, an "
                    "advertisement, a published rate. No purchase, account, credential, app signup, or disclosure of "
                    "family finances is required."),
                "performance_task_link": spec["performance_task"],
                "is_capstone_lesson": bool(capstone and i == n),
            })
            sched.append({
                "course_day": day, "week": (day - 1) // BP.DAYS_PER_WEEK + 1,
                "weekday": (day - 1) % BP.DAYS_PER_WEEK + 1,
                "unit_number": ui, "unit_title": title,
                "lesson_id": lesson_ids[i - 1], "phase": phase, "focus": focus,
            })

        t = spec["topics"]
        assessments.append({
            "assessment_id": f"{unit_id}-assessment", "course_id": course_id,
            "unit_number": ui, "unit_title": title,
            "standards": list(meta["codes"]), "total_points": 38,
            "simulation_only": True,
            "prompts": [
                {"type": "concept and vocabulary", "points": 4,
                 "prompt": f"Explain {t[0]} in your own words and identify a valid example in the unit's fictional scenario."},
                {"type": "computation and evidence", "points": 5,
                 "prompt": f"Compute the figure that {t[1]} depends on, show the work, and state what the figure does not establish."},
                {"type": "application", "points": 6,
                 "prompt": f"Apply {t[2]} to a fictional case you have not worked in this unit. Show the reasoning, not only the conclusion."},
                {"type": "error or claim analysis", "points": 6,
                 "prompt": f"Analyse a plausible mistake or misleading claim involving {t[3]}; correct it and explain what made it wrong."},
                {"type": "connection", "points": 5,
                 "prompt": f"Connect {t[4]} with {t[5]}. Explain how one constrains, supports, or complicates the other."},
                {"type": "performance evidence", "points": 8,
                 "prompt": f"Present the strongest evidence from the unit performance task: {spec['performance_task']}"},
                {"type": "reflection and transfer", "points": 4,
                 "prompt": "Identify one decision you could now analyse, one check that improves a financial judgement, and one open question."},
            ],
            "administration_note": "Scaffolds permitted during instruction (checklists, formula sheets, exemplars, calculators) remain available on the unit assessment unless the standard being measured is the scaffold itself.",
            "authorship_rule": "Every response is produced by the learner. Tutor or adult assistance is recorded as guided evidence and does not by itself establish mastery.",
            "data_rule": "This assessment uses fictional figures only. It never requires, requests, or accepts a real account number, balance, credential, or government identifier.",
            "advice_rule": "This assessment evaluates reasoning about a fictional scenario. It does not ask the learner what they personally should do with real money, and no response is treated as individualized financial advice.",
            "mastery_interpretation": MASTERY,
        })
    return course_id, theme_title, theme_desc, units, lessons, assessments, sched


def course_guide(grade, course_id, theme_title, theme_desc, units):
    L = []
    a = L.append
    a(f"# Manuel Academy — Financial Literacy, Grade {grade}")
    a("")
    a(f"**{theme_title}.** {theme_desc}")
    a("")
    a(f"- Course id: `{course_id}`")
    a(f"- Units: {len(units)} (one per Michigan Personal Finance content expectation)")
    a(f"- Lessons: {BP.TOTAL_LESSONS}")
    a(f"- Schedule: {BP.WEEKS} weeks x {BP.DAYS_PER_WEEK} days")
    a("- Every figure, employer, institution, offer, and document is fictional.")
    a("")
    a("## Expectation coverage")
    a("")
    a("This course covers **all seven** Michigan Personal Finance content expectations, PF1-PF7, "
      "including sub-expectation PF4.1. Michigan publishes one 9-12 expectation set rather than four "
      "grade-level sets; each high-school year therefore sweeps the full set at increasing "
      "sophistication rather than dividing the expectations between years. See "
      "`../../progression/rigor-progression-9-12.md`.")
    a("")
    a("| Unit | Expectation | Focus for this grade |")
    a("| --- | --- | --- |")
    for u in units:
        a(f"| {u['unit_number']} | {', '.join(u['standards'])} | {u['title'].split(': ', 1)[1]} |")
    a("")
    a("## Scope and sequence")
    a("")
    for u in units:
        a(f"### Unit {u['unit_number']} — {u['title']}")
        a("")
        a(f"*{u['essential_question']}*")
        a("")
        a(f"- Days: {u['days']}")
        a(f"- Expectations: {', '.join(u['standards'])}")
        a(f"- Topics: {'; '.join(u['topics'])}")
        a(f"- Performance task: {u['performance_task']}")
        if u["is_capstone_unit"]:
            a("- **This is the Grade 12 simulated adult-finance capstone unit.**")
        a("")
    a("## Policies")
    a("")
    a("**Simulated finances only.** No real transaction is ever required. The course never requests a real "
      "bank credential, card number, account number, Social Security or tax identification number, brokerage "
      "credential, password, or real balance, and the tutor is routed to refuse and redirect if a learner "
      "offers one.")
    a("")
    a("**No individualized financial advice.** The course teaches general concepts against fictional "
      "scenarios. When a learner asks what they personally should do with real money, the tutor declines to "
      "individualize, answers the general principle, and points to a trusted adult or a qualified licensed "
      "professional.")
    a("")
    a("**No shame.** Financial hardship is never framed as a personal or family failing, and no lesson asks a "
      "learner to disclose real household finances. A fictional scenario is always the working context.")
    a("")
    a("**Mastery.** Practice generation never directly awards mastery. " + MASTERY)
    a("")
    a("**Guardian visibility.** " + VISIBILITY)
    a("")
    return "\n".join(L) + "\n"


def lesson_sequence(grade, units, lessons):
    L = [f"# Financial Literacy, Grade {grade} — Lesson Sequence", ""]
    by_unit = {}
    for x in lessons:
        by_unit.setdefault(x["unit_number"], []).append(x)
    for u in units:
        L.append(f"## Unit {u['unit_number']} — {u['title']}")
        L.append("")
        L.append("| Day | Lesson | Phase | Focus |")
        L.append("| --- | --- | --- | --- |")
        for x in by_unit[u["unit_number"]]:
            L.append(f"| {x['course_day']} | `{x['lesson_id']}` | {x['phase']} | {x['focus']} |")
        L.append("")
    return "\n".join(L) + "\n"


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


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
        w = csv.DictWriter(buf, fieldnames=["course_day", "week", "weekday", "unit_number",
                                            "unit_title", "lesson_id", "phase", "focus"],
                           lineterminator="\n")
        w.writeheader()
        w.writerows(sched)
        write(os.path.join(d, "daily-schedule.csv"), buf.getvalue())
        write(os.path.join(d, "course-guide.md"), course_guide(grade, cid, tt, td, units))
        write(os.path.join(d, "lesson-sequence.md"), lesson_sequence(grade, units, lessons))
        total += len(lessons)
        print(f"  {cid}: {len(units)} units, {len(lessons)} lessons, {len(assess)} assessments")
    print(f"financial-literacy 9-12: {total} lessons total")


if __name__ == "__main__":
    main()
