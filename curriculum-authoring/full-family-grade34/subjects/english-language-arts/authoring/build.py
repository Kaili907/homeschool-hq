#!/usr/bin/env python3
"""Expand the authored Grade 3 and Grade 4 ELA specifications into the package.

Deterministic: running this twice produces byte-identical output. All authored
content lives in spec_grade3.py, spec_grade4.py, texts_grade*.py, public_domain.py
and phases.py; this file only assembles.

Usage:  python3 authoring/build.py
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import phases, public_domain, standards_source
import spec_grade3, spec_grade4, texts_grade3, texts_grade4

PACKAGE_ID = "manuel-academy-grades-3-4-ela-authoring-v1"
VERSION = "1.0.0"
AUTHORED_ON = "2026-08-12"
SUBJECT = "english-language-arts"

GRADES = {
    3: dict(spec=spec_grade3, phase_tpl=phases.G3, texts=texts_grade3.TEXTS,
            pd=public_domain.GRADE_3, catalog=standards_source.G3),
    4: dict(spec=spec_grade4, phase_tpl=phases.G4, texts=texts_grade4.TEXTS,
            pd=public_domain.GRADE_4, catalog=standards_source.G4),
}

INDEPENDENT_PHASES = {
    "Independent application A", "Transfer to a new text", "Transfer challenge",
    "Skill consolidation and retrieval", "Retrieval and assessment preparation",
    "Unit assessment",
}
ASSESSED_PHASES = {"Unit assessment"}
DRAFTING_PHASES = {
    "Writing plan and draft", "Writing revise and edit", "Writing revision workshop",
}

ACCESSIBILITY = {
3: [
 "Every lesson has a complete text-only path; no image, audio, or video is required to reach the target.",
 "All reading content is read-aloud capable by an adult, a screen reader, or a text-to-speech tool, and the learner is never required to read aloud.",
 "A no-audio path is provided: any listening task may be replaced with the printed transcript or a written script.",
 "Where media is used it must carry captions and a transcript, or it must not be used.",
 "Directions are chunked to one action at a time, with a worked example available for every task.",
 "Typed, handwritten, spoken, drawn, dictated-to-scribe, or pointed responses are accepted whenever the standard does not name the mode.",
 "Reduced copying, extended time, hidden timers, movement breaks, high-contrast print, larger type, keyboard access, and low-distraction settings are available on request and are not recorded as failures.",
 "A private presentation alternative exists for every speaking or presenting task; no learner voice or video recording is ever required.",
 "The learning target is preserved while quantity, pacing, representation, or response mode is adjusted.",
],
4: [
 "Every lesson has a complete text-only path; no image, audio, video, or chart is required to reach the target, and every visual carries a written description that conveys the same information.",
 "All reading content is read-aloud capable by an adult, a screen reader, or a text-to-speech tool, and the learner is never required to read aloud.",
 "A no-audio path is provided: any listening or paraphrasing-from-media task may be completed from a printed transcript instead.",
 "Where media is used it must carry captions and a transcript, or it must not be used.",
 "Directions are chunked, and a model or exemplar is available for every extended task.",
 "Typed, handwritten, spoken, dictated-to-scribe, or structured-organizer responses are accepted whenever the standard does not name the mode.",
 "Reduced copying, extended time, hidden timers, movement breaks, high-contrast print, larger type, keyboard access, and low-distraction settings are available on request and are not recorded as failures.",
 "A private presentation alternative exists for every speaking or presenting task; no learner voice or video recording is ever required.",
 "The learning target is preserved while quantity, pacing, representation, or response mode is adjusted.",
]}

SAFETY = [
 "Use respectful, non-shaming language about reading difficulty, spelling, handwriting, speech, accent, or pace.",
 "A pause, a break, or a change of response mode is never recorded as a failure.",
 "Do not require autobiographical disclosure; a fictionalized, analytical, or private-safe alternative is always acceptable.",
 "Offer an alternate text or a private response when content is personally sensitive, and teach difficult history and literature with accuracy, context, and dignity.",
 "Parent-facing summaries show the target, completion, evidence type, and next step, never raw private reflections, raw responses, or diagnosis language.",
]

def speaking_listening(grade):
    return {
        "private_presentation_alternative": (
            "Any presenting, reporting, or discussion turn may be delivered privately to one adult, "
            "submitted in writing, typed, or displayed silently."),
        "no_audio_path": (
            "Listening tasks may be completed from a printed transcript or script. No task requires hearing audio."),
        "no_learner_voice_or_video_required": True,
        "captions_and_transcript_required_when_media_exists": True,
        "recording_is_opt_in": (
            "Where a standard names audio recording, the learner may satisfy it with a written script plus a "
            "silent visual display, or with an adult-read recording. Learner voice is never required and is "
            "never stored without explicit guardian opt-in."),
    }

def mastery_block(grade):
    return {
        "occasions_required": 2,
        "separation": "The two occasions must be separated by time, by text, or by representation.",
        "independent_evidence_required": True,
        "guided_success_is_not_mastery": True,
        "evidence_types": [
            "text-marked or annotated reading response",
            "written response with cited evidence",
            "oral or written explanation of reasoning",
            "a revision that shows the learner acted on criteria",
            "transfer to an unfamiliar text or task",
        ],
        "rule": ("A single correct answer never establishes mastery. Guided success is recorded as guided "
                 "evidence and is weighted below independent evidence. A pacing concern is not a mastery failure."),
    }

def persistence_block():
    return {
        "raw_response_retention_required": False,
        "stored": ["lesson target", "completion state", "evidence type", "guided or independent",
                   "criteria met", "next instructional step"],
        "not_required_to_store": ["the learner's raw essay or extended written response text",
                                  "raw voice or video", "private reflections"],
        "note": ("The runtime may evaluate an extended response in session and persist only the evidence "
                 "descriptors above. No part of this course requires storing a learner's raw essay text."),
    }

AUTHORSHIP = ("The learner writes every assessed response. The tutor may question, model on a separate "
              "example, name a criterion, restate directions, or point to where an idea is unclear. The tutor "
              "must not draft, dictate, outline, complete, reword, or supply sentences for the learner's "
              "assessed essay or extended response.")

FIXED_ANSWER = ("Fixed-answer items and their keys are scorer-visible only. The tutor surface, the learner "
                "surface, and any hint path must not expose, restate, or narrow toward a fixed answer before "
                "the learner responds. Feedback after a response addresses reasoning, not the key.")

def adaptive_support(grade):
    if grade == 4:
        return {
            "adaptive_english_band_match": True,
            "route": ("The frozen Adaptive English package covers approximately Grades 4-6. Grade 4 lessons "
                      "may expose compatible intervention capability through a future adapter. No adapter is "
                      "implemented, mounted, or required by this package."),
            "static_help_sufficient": True,
            "package_modified": False,
        }
    return {
        "adaptive_english_band_match": False,
        "route": ("The frozen Adaptive English package covers approximately Grades 4-6 and does not match "
                  "Grade 3. Grade 3 lessons operate fully through static help: worked examples, step lists, "
                  "reteach representations, and the scripted tutor routes in this lesson."),
        "static_help_sufficient": True,
        "package_modified": False,
    }

def tutor_routes(focus, grade):
    band = "grades 2-3" if grade == 3 else "grades 4-5"
    return [
      {"signal": "decoding or fluency barrier",
       "action": f"If the barrier is reading the words rather than {focus}, drop to the word or phrase level, "
                 f"reread the line, then return. Do not reteach {focus} while decoding is the actual obstacle."},
      {"signal": "prerequisite gap",
       "action": f"Return to the smallest prerequisite {focus} depends on, model it once with a text-only "
                 f"representation, then retry one fresh item."},
      {"signal": "answer without textual support",
       "action": f"Accept the thinking, then require the learner to locate the words in the text that support it. "
                 f"If none exist, treat that as the finding and revise the claim."},
      {"signal": "correct but low confidence",
       "action": f"Confirm the reasoning specifically, offer one varied example of {focus}, and do not assign "
                 f"remediation the evidence does not justify."},
      {"signal": "repeated error pattern",
       "action": f"Name the observable pattern neutrally, contrast it with a worked example, and schedule a "
                 f"short retrieval check in a later session."},
      {"signal": "text too hard for the {b} band".replace("{b}", band),
       "action": f"Swap to a shorter text at the same target rather than lowering the target. Record the swap "
                 f"as an access decision, not as a mastery result."},
      {"signal": "mastery evidence",
       "action": f"Require accurate independent application of {focus} plus an explanation on a second, later "
                 f"occasion before recording mastery."},
    ]

def media_block(focus):
    return {
      "suggestion": f"Optional diagram, labeled illustration, chart, or short captioned clip supporting {focus}.",
      "required": False,
      "fallback": ("The same information is provided as readable text, alt text, a transcript, or an adult "
                   "demonstration. No learner is disadvantaged by declining media."),
      "captions_required_if_used": True,
      "transcript_required_if_used": True,
    }

def build_grade(grade):
    cfg = GRADES[grade]
    spec, tpl, texts, pd = cfg["spec"], cfg["phase_tpl"], cfg["texts"], cfg["pd"]
    by_id = {t["id"]: t for t in texts}
    pd_by_unit = {}
    for item in pd:
        for u in item["units"]:
            pd_by_unit.setdefault(u, []).append(item["id"])

    lessons, units, assessments = [], [], []
    for u in spec.UNITS:
        un = u["n"]
        lesson_ids = []
        anchors = u["anchor_texts"]
        for d in range(1, 19):
            phase = spec.ARC[d - 1]
            focus, stds = u["days"][d - 1]
            t = tpl[phase]
            lid = f"{spec.COURSE_ID}-u{un:02d}-l{d:02d}"
            lesson_ids.append(lid)
            course_day = (un - 1) * 18 + d
            independent = phase in INDEPENDENT_PHASES
            assessed = phase in ASSESSED_PHASES

            if phase in DRAFTING_PHASES:
                textref = {
                  "mode": "learner-produced",
                  "description": "The learner's own draft. No published text is required for this session.",
                  "source_type": "learner-authored",
                }
            else:
                tid = anchors[(d - 1) % len(anchors)]
                src = by_id[tid]
                textref = {
                  "mode": "package-supplied",
                  "text_id": tid,
                  "title": src["title"],
                  "genre": src["genre"],
                  "source_type": src["source_type"],
                  "rights": src["rights"],
                  "location": f"grades/grade-{grade}/original-text-bank.json",
                }
            if pd_by_unit.get(un):
                textref["public_domain_alternatives"] = pd_by_unit[un]
            textref["learner_or_family_selected_texts_permitted"] = (
                "A facilitator may substitute a public-domain, library, licensed, or family-approved text at "
                "the same target. Record the substitution in the source record; do not paste copyrighted text "
                "into the package.")

            flow = []
            for seg, minutes in spec.CADENCE:
                if seg == "Welcome and retrieval":
                    action = (f"Open with a brief accessible retrieval prompt connected to {focus}. Ask the "
                              f"learner to recall, predict, or pose a question before any instruction.")
                elif seg in ("Word work and fluency", "Word study and fluency"):
                    action = t.get("ww") or (
                        f"Two minutes of word work on the vocabulary {focus} requires, then one short passage "
                        f"read for accuracy and phrasing. Reading aloud is optional.")
                elif seg == "Model or mini-lesson":
                    action = t["model"].format(f=focus)
                elif seg == "Guided practice":
                    action = t["guided"].format(f=focus)
                elif seg == "Independent application":
                    action = t["indep"].format(f=focus)
                else:
                    action = t["exit"].format(f=focus)
                flow.append({"segment": seg, "minutes": minutes,
                             "teacher_or_tutor_action": action.format(f=focus)})

            objectives = [
                t["obj"].format(f=focus),
                ("Support your thinking with evidence from the text, a documented process, or a stated "
                 "reason, rather than an unsupported answer."),
                ("Check the work against the stated success criteria and name one next step."),
            ]

            lesson = {
              "schema_version": "1.1",
              "lesson_id": lid,
              "course_id": spec.COURSE_ID,
              "grade": grade,
              "subject": SUBJECT,
              "course_day": course_day,
              "unit_number": un,
              "unit_title": u["title"],
              "day_in_unit": d,
              "title": f"{phase}: {focus}",
              "phase": phase,
              "focus": focus,
              "estimated_minutes": spec.SESSION_MINUTES,
              "standards": stds,
              "essential_question": u["eq"],
              "learning_objectives": objectives,
              "success_criteria": [
                f"The learner completes the central task about {focus}.",
                "The learner supplies evidence, reasoning, or a documented process rather than a bare answer.",
                "The learner checks the work against the criteria and identifies a next step.",
              ],
              "materials": [
                "course notebook or an accessible digital equivalent",
                "pencil, keyboard, or another accessible response tool",
                "the assigned passage in print, on screen, or read aloud",
              ],
              "text_reference": textref,
              "lesson_flow": flow,
              "student_activity": t["indep"].format(f=focus),
              "formative_check": t["exit"].format(f=focus),
              "evidence_mode": "independent" if independent else "guided",
              "assessed": assessed,
              "student_authorship": AUTHORSHIP,
              "fixed_answer_protection": FIXED_ANSWER,
              "answer_or_scoring_guidance": (
                "Score the stated target, the accuracy of the reading or writing move, the quality of the "
                "evidence or reasoning, and the revision. Accept any approach that meets the criteria. Do not "
                "infer effort, motivation, character, or diagnosis from an error."),
              "adaptive_tutor_routes": tutor_routes(focus, grade),
              "adaptive_support": adaptive_support(grade),
              "mastery": mastery_block(grade),
              "mastery_rule": (
                "Do not record mastery from one answer. Require accurate independent evidence plus an "
                "explanation, transfer, or retrieval on at least two occasions separated by time, text, or "
                "representation. Guided success is recorded as guided evidence only."),
              "extension": (
                f"Apply {focus} to a longer or unfamiliar text, compare two texts on it, or teach it with an "
                f"original example. Extension never means completing another learner's assessed work."),
              "accessibility_and_accommodations": ACCESSIBILITY[grade],
              "speaking_and_listening_alternatives": speaking_listening(grade),
              "safety_and_privacy": SAFETY,
              "media": media_block(focus),
              "persistence": persistence_block(),
              "parent_or_guardian_visibility": (
                "Share the target, completion state, evidence type, whether the evidence was guided or "
                "independent, and the next instructional step. Do not expose raw responses, private "
                "reflections, voice recordings, or diagnosis language."),
              "home_connection": (
                f"Invite the learner to notice one safe, optional example of {focus} in everyday reading, "
                f"conversation, or writing. No purchase, account, photograph, or private disclosure is required."),
            }
            lessons.append(lesson)

        additional = sorted(
            {s for lid in lesson_ids for l in lessons if l["lesson_id"] == lid
             for s in l["standards"]} - set(u["standards"]))
        units.append({
          "unit_id": f"{spec.COURSE_ID}-u{un:02d}",
          "course_id": spec.COURSE_ID,
          "grade": grade,
          "subject": SUBJECT,
          "unit_number": un,
          "title": u["title"],
          "days": 18,
          "standards": u["standards"],
          "standards_role": ("Unit anchors. Individual lessons may additionally cite other codes from the "
                             "same verified grade catalog; those appear in additional_standards_touched."),
          "additional_standards_touched": additional,
          "essential_question": u["eq"],
          "topics": u["topics"],
          "performance_task": u["performance_task"],
          "anchor_texts": anchors,
          "public_domain_options": pd_by_unit.get(un, []),
          "lesson_ids": lesson_ids,
          "assessment_id": f"{spec.COURSE_ID}-u{un:02d}-assessment",
        })
        assessments.append(build_assessment(grade, spec, u, additional))

    return spec, lessons, units, assessments

def build_assessment(grade, spec, u, additional):
    un, topics = u["n"], u["topics"]
    t = (topics + topics)[:6]
    prompts = [
      {"type": "concept and vocabulary", "points": 4, "fixed_answer": False,
       "prompt": f"Explain this idea in your own words and give one valid example: {t[0]}."},
      {"type": "text evidence", "points": 6, "fixed_answer": False,
       "prompt": f"Answer a question about {t[1]} using an unfamiliar passage, and quote or precisely "
                 f"paraphrase the words that support your answer."},
      {"type": "selected response", "points": 5, "fixed_answer": True,
       "prompt": f"Fixed-answer items covering {t[2]}. Keys are scorer-visible only and must not be exposed "
                 f"on the tutor or learner surface before the learner responds."},
      {"type": "application", "points": 6, "fixed_answer": False,
       "prompt": f"Apply this to new material: {t[3]}. Show the process or cite the evidence."},
      {"type": "error or claim analysis", "points": 6, "fixed_answer": False,
       "prompt": f"A plausible but flawed response about {t[4]} is provided. Identify the error, correct it, "
                 f"and explain why the correction is better."},
      {"type": "constructed writing", "points": 9, "fixed_answer": False,
       "prompt": f"Write an independent response connected to {t[5]} and to the unit performance task: "
                 f"{u['performance_task']}"},
      {"type": "reflection and transfer", "points": 4, "fixed_answer": False,
       "prompt": "Name one skill you can now transfer, one check that improves your accuracy, and one question "
                 "you still have."},
    ]
    return {
      "assessment_id": f"{spec.COURSE_ID}-u{un:02d}-assessment",
      "course_id": spec.COURSE_ID,
      "grade": grade,
      "unit_number": un,
      "unit_title": u["title"],
      "standards": u["standards"],
      "additional_standards_touched": additional,
      "standards_role": ("standards lists the unit anchors that this assessment reports against. "
                         "additional_standards_touched lists the other verified codes the unit's lessons "
                         "taught; evidence for those is collected across the unit rather than on this form."),
      "total_points": sum(p["points"] for p in prompts),
      "administered_on_lesson": f"{spec.COURSE_ID}-u{un:02d}-l17",
      "guided_evidence": {
        "collected_on": [f"{spec.COURSE_ID}-u{un:02d}-l{d:02d}" for d in (3, 4, 7, 8, 9, 10, 11, 12, 13, 14)],
        "role": ("Guided evidence documents progress and informs instruction. It is recorded separately and "
                 "is never sufficient on its own to record mastery."),
      },
      "independent_evidence": {
        "collected_on": [f"{spec.COURSE_ID}-u{un:02d}-l{d:02d}" for d in (6, 15, 16, 17)],
        "role": "Independent evidence is required for any mastery decision.",
      },
      "prompts": prompts,
      "fixed_answer_protection": FIXED_ANSWER,
      "student_authorship": AUTHORSHIP,
      "multi_occasion_mastery": {
        "occasions_required": 2,
        "note": ("The unit assessment is one occasion. A second occasion must come from independent transfer, "
                 "later retrieval, or the performance task, separated by time, text, or representation."),
      },
      "mastery_interpretation": {
        "secure": "At least 85 percent with accurate independent application and adequate evidence, on two occasions.",
        "developing": "70 to 84 percent, or inconsistent explanation. Assign targeted review and a fresh transfer check.",
        "not_yet": "Below 70 percent or a missing prerequisite. Reteach the smallest gap and reassess with new evidence.",
        "rule": "A unit score is one evidence source, not the sole basis for a mastery decision.",
      },
      "rubric_dimensions": ["accuracy", "evidence and reasoning", "application or transfer",
                            "language and conventions", "source integrity", "checking and revision"],
      "response_modes": ["typed", "handwritten", "dictated to a scribe", "structured organizer",
                         "spoken privately to one adult"],
      "accommodation_note": ("Access supports may change format, pacing, quantity, setting, or response mode "
                             "without changing the standard being assessed. Use of a support is not recorded "
                             "as a mastery result."),
      "persistence": persistence_block(),
    }

def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

def main():
    all_courses, all_units, all_lesson_rows, std_map = [], [], [], {}
    for grade in (3, 4):
        spec, lessons, units, assessments = build_grade(grade)
        gdir = os.path.join(ROOT, "grades", f"grade-{grade}")
        os.makedirs(gdir, exist_ok=True)

        with open(os.path.join(gdir, "lessons.jsonl"), "w", encoding="utf-8") as fh:
            for l in lessons:
                fh.write(json.dumps(l, ensure_ascii=False) + "\n")
        write_json(os.path.join(gdir, "units.json"), units)
        write_json(os.path.join(gdir, "assessments.json"), assessments)

        texts = GRADES[grade]["texts"]
        write_json(os.path.join(gdir, "original-text-bank.json"), texts)
        write_json(os.path.join(gdir, "public-domain-register.json"), {
            "note": ("References only. No public-domain work is reproduced in this package. Obtain each text "
                     "from a public-domain repository, a library, or a printed edition."),
            "rationale": public_domain.PD_RATIONALE,
            "works": GRADES[grade]["pd"],
        })
        with open(os.path.join(gdir, "original-text-bank.md"), "w", encoding="utf-8") as fh:
            fh.write(f"# Grade {grade} Original Practice Texts\n\n")
            fh.write("Every text below was written for Manuel Academy. No copyrighted trade text is reproduced "
                     "anywhere in this package. Public-domain works are listed separately in "
                     "`public-domain-register.json` as references, not reproductions.\n\n")
            for t in texts:
                fh.write(f"## {t['title']} (`{t['id']}`)\n\n")
                fh.write(f"**Genre:** {t['genre']}  \n**Source type:** {t['source_type']}  \n")
                fh.write(f"**Rights:** {t['rights']}  \n**Used in units:** "
                         f"{', '.join(str(x) for x in t['units'])}\n\n")
                fh.write(t["text"] + "\n\n")

        # schedule: 36 weeks x 5 days, one ELA session per instructional day
        dow = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        with open(os.path.join(gdir, "schedule.csv"), "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["week", "day_of_week", "course_day", "unit_number", "day_in_unit", "lesson_id"])
            for l in lessons:
                cd = l["course_day"]
                w.writerow([(cd - 1) // 5 + 1, dow[(cd - 1) % 5], cd,
                            l["unit_number"], l["day_in_unit"], l["lesson_id"]])

        write_course_guide(gdir, grade, spec, units)
        write_lesson_sequence(gdir, grade, spec, lessons)
        write_overview(gdir, grade, spec, units)

        all_courses.append({
          "course_id": spec.COURSE_ID, "grade": grade, "subject": SUBJECT,
          "title": spec.COURSE_TITLE, "days": spec.DAYS, "weeks": spec.WEEKS,
          "units": len(units), "lessons": len(lessons),
          "session_minutes": spec.SESSION_MINUTES, "cadence": "daily",
          "description": spec.COURSE_DESCRIPTION, "capstone": spec.CAPSTONE,
          "path": f"grades/grade-{grade}",
        })
        all_units.extend(units)
        for l in lessons:
            all_lesson_rows.append([
              l["lesson_id"], l["course_id"], l["grade"], l["subject"], l["course_day"],
              l["unit_number"], l["unit_title"], l["day_in_unit"], l["title"], l["phase"],
              l["focus"], ";".join(l["standards"]), l["evidence_mode"],
              "yes" if l["assessed"] else "no",
              l["text_reference"].get("text_id", "learner-produced"),
            ])

        cat = GRADES[grade]["catalog"]
        entries = {}
        for code, desc in cat.items():
            ls = [l["lesson_id"] for l in lessons if code in l["standards"]]
            us = sorted({l["unit_number"] for l in lessons if code in l["standards"]})
            uu = sorted({u["unit_number"] for u in units if code in u["standards"]})
            entries[code] = {"description": desc, "lesson_ids": ls, "lesson_count": len(ls),
                             "unit_numbers": sorted(set(us) | set(uu)),
                             "assessment_ids": [f"{spec.COURSE_ID}-u{n:02d}-assessment" for n in uu]}
        std_map[f"grade-{grade}"] = {"course_id": spec.COURSE_ID, "standard_count": len(entries),
                                     "standards": entries}
        write_json(os.path.join(ROOT, "standards", f"michigan-ela-g{grade}.json"), {
          "grade": grade, "jurisdiction": "Michigan",
          "alignment_date": standards_source.ALIGNMENT_DATE,
          "code_format_in_this_package": "<grade>.<strand>.<number>",
          "code_format_as_published_by_mde": "<strand>.<grade>.<number>",
          "sources": standards_source.SOURCES,
          "standards": cat,
          "excluded_codes": {k: v for k, v in standards_source.EXCLUDED.items()
                             if k.startswith(str(grade))},
        })

    idir = os.path.join(ROOT, "indices")
    os.makedirs(idir, exist_ok=True)
    write_json(os.path.join(idir, "course-index.json"), all_courses)
    write_json(os.path.join(idir, "unit-index.json"), all_units)
    with open(os.path.join(idir, "lesson-index.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["lesson_id", "course_id", "grade", "subject", "course_day", "unit_number",
                    "unit_title", "day_in_unit", "title", "phase", "focus", "standards",
                    "evidence_mode", "assessed", "text_id"])
        w.writerows(all_lesson_rows)
    write_json(os.path.join(ROOT, "standards", "standards-map.json"), {
      "package_id": PACKAGE_ID, "version": VERSION,
      "note": ("Every standard in each grade's verified catalog maps to at least one lesson. "
               "Codes use the Manuel Academy house order <grade>.<strand>.<number>."),
      "grades": std_map})
    print(f"built: {len(all_courses)} courses, {len(all_units)} units, {len(all_lesson_rows)} lessons")

def write_overview(gdir, grade, spec, units):
    with open(os.path.join(gdir, "course-overview.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# {spec.COURSE_TITLE} — Year Overview\n\n")
        fh.write(f"**Course ID:** `{spec.COURSE_ID}`  \n**Year model:** {spec.WEEKS} weeks / {spec.DAYS} "
                 f"instructional days  \n**Session length:** {spec.SESSION_MINUTES} minutes  \n"
                 f"**Cadence:** daily\n\n")
        fh.write(spec.COURSE_DESCRIPTION + "\n\n## Weekly map\n\n")
        fh.write("| Weeks | Unit | Title | Performance task |\n| --- | --- | --- | --- |\n")
        for u in units:
            s = (u["unit_number"] - 1) * 18 // 5 + 1
            e = (u["unit_number"] * 18 + 4) // 5
            fh.write(f"| {s}–{e} | {u['unit_number']} | {u['title']} | {u['performance_task']} |\n")
        fh.write(f"\n## Capstone\n\n{spec.CAPSTONE}\n\n## Daily cadence\n\n")
        fh.write("| Segment | Minutes |\n| --- | --- |\n")
        for seg, m in spec.CADENCE:
            fh.write(f"| {seg} | {m} |\n")
        fh.write("\n## Family use\n\n- `schedule.csv` gives a ready 180-day calendar with one ELA session per day.\n"
                 "- `course-guide.md` gives the scope and sequence and the mastery policy.\n"
                 "- `lesson-sequence.md` is the readable day-by-day plan.\n"
                 "- `lessons.jsonl` and `assessments.json` are the machine-readable records.\n"
                 "- `original-text-bank.md` holds every passage the course supplies.\n"
                 "- No learner photograph, voice recording, precise location, or account credential is required "
                 "anywhere in this course.\n")

def write_course_guide(gdir, grade, spec, units):
    with open(os.path.join(gdir, "course-guide.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# {spec.COURSE_TITLE} — Course Guide\n\n")
        fh.write(f"**Course ID:** `{spec.COURSE_ID}`  \n**Version:** {VERSION}  \n"
                 f"**Instructional sessions:** {spec.DAYS}  \n**Typical session:** {spec.SESSION_MINUTES} "
                 f"minutes  \n**Cadence:** daily\n\n## Course description\n\n")
        fh.write(spec.COURSE_DESCRIPTION + "\n\n")
        fh.write("## Independent progression\n\nThis course is authored independently. It is not the Grade 5 "
                 "course with lowered difficulty labels: it uses its own unit sequence, its own 18-day unit "
                 "arc, its own daily cadence, its own text bank, and standards verified for this grade.\n\n")
        fh.write("## Course outcomes\n\nBy the end of the course, learners will:\n\n"
                 "1. Demonstrate the listed Michigan-aligned Grade "
                 f"{grade} reading, writing, language, and speaking and listening expectations through "
                 "independent, accessible evidence.\n"
                 "2. Support statements about a text with evidence the text actually contains.\n"
                 "3. Write for a purpose across narrative, explanatory, and opinion forms, and revise on "
                 "criteria rather than on correction alone.\n"
                 "4. Use sources honestly: notes in the learner's own words, and a record of where information "
                 "came from.\n"
                 "5. Transfer reading and writing skills to unfamiliar texts and tasks.\n"
                 f"6. Complete the course capstone: **{spec.CAPSTONE}**\n\n")
        fh.write("## Instructional model\n\nEach unit runs an 18-day arc:\n\n")
        for i, p in enumerate(spec.ARC, 1):
            fh.write(f"{i}. {p}\n")
        fh.write("\nEach session runs the same cadence:\n\n| Segment | Minutes |\n| --- | --- |\n")
        for seg, m in spec.CADENCE:
            fh.write(f"| {seg} | {m} |\n")
        fh.write("\nLessons are resumable by segment. Media is optional everywhere and a readable fallback is "
                 "always specified.\n\n")
        fh.write("## Mastery and grading\n\n- One correct answer never establishes mastery.\n"
                 "- Guided evidence and independent evidence are recorded separately. Only independent "
                 "evidence supports a mastery decision.\n"
                 "- Mastery requires accurate independent evidence on at least two occasions separated by "
                 "time, text, or representation.\n"
                 "- Suggested reporting is **Secure**, **Developing**, or **Not Yet**, supported by evidence "
                 "rather than a single percentage.\n"
                 "- Reassessment uses fresh items or a new application after targeted instruction.\n"
                 "- Approved breaks, accommodations, private presentation choices, and alternate response "
                 "modes are never failures.\n\n")
        fh.write("## Academic integrity\n\n" + AUTHORSHIP + "\n\n" + FIXED_ANSWER + "\n\n")
        fh.write("## Text and copyright\n\nEvery passage supplied by this course is an original Manuel Academy "
                 "text. Public-domain works are listed as references with creator, first-publication year, and "
                 "public-domain rationale, and are not reproduced here. Facilitators may substitute library, "
                 "licensed, or family-approved texts at the same target; do not paste copyrighted text into "
                 "this package. See `policies/source-integrity.md`.\n\n")
        fh.write("## Accessibility\n\n")
        for a in ACCESSIBILITY[grade]:
            fh.write(f"- {a}\n")
        fh.write("\n## Adaptive English boundary\n\n" + adaptive_support(grade)["route"] + "\n\n")
        fh.write("## Scope and sequence\n\n| Unit | Title | Days | Standards anchors | Performance task |\n"
                 "| --- | --- | --- | --- | --- |\n")
        for u in units:
            fh.write(f"| {u['unit_number']} | {u['title']} | {u['days']} | "
                     f"{', '.join(u['standards'])} | {u['performance_task']} |\n")
        fh.write(f"\n## Capstone\n\n{spec.CAPSTONE}\n")

def write_lesson_sequence(gdir, grade, spec, lessons):
    with open(os.path.join(gdir, "lesson-sequence.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# {spec.COURSE_TITLE} — Complete Lesson Sequence\n\n**Lessons:** {len(lessons)}\n")
        cur = None
        for l in lessons:
            if l["unit_number"] != cur:
                cur = l["unit_number"]
                fh.write(f"\n## Unit {cur}: {l['unit_title']}\n\n*{l['essential_question']}*\n")
            fh.write(f"\n### Day {l['course_day']} (unit day {l['day_in_unit']}) — {l['title']}\n")
            fh.write(f"**Lesson ID:** `{l['lesson_id']}`  \n**Standards:** {', '.join(l['standards'])}  \n")
            fh.write(f"**Evidence:** {l['evidence_mode']}"
                     f"{' — assessed' if l['assessed'] else ''}  \n")
            tr = l["text_reference"]
            fh.write(f"**Text:** {tr.get('title', tr.get('description'))} "
                     f"({tr.get('source_type')})  \n")
            fh.write(f"**Objective:** {l['learning_objectives'][0]}\n\n")
            fh.write(f"**Student activity:** {l['student_activity']}\n\n")
            fh.write(f"**Exit ticket:** {l['formative_check']}\n")

if __name__ == "__main__":
    main()
