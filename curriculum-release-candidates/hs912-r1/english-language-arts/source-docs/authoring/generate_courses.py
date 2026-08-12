# -*- coding: utf-8 -*-
"""Generate English 9-12 course artifacts.

Emits, per course: units.json, lessons.jsonl, assessments.json, text-bank.json,
daily-schedule.csv, course-guide.md, lesson-sequence.md.

Lesson objects mirror the shape of the published Grade 8 ELA release so the same
Study Engine segmentation, protected-field boundary, and family schedule apply
without any engine change.
"""
import json, os, sys, csv

HERE = os.path.dirname(os.path.abspath(__file__))
LANE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from blueprints import COURSES, UNIT_TEXTS, TEXT_ANCHORS
from rigor import RIGOR, PHASES, PHASE_SPECS, OBJECTIVES, CRITERIA
from texts import BANKS

CORPUS = json.load(open(os.path.join(LANE, "standards", "michigan-ela-9-12-standards.json"), encoding="utf-8"))
BY_CODE = {s["code"]: s for s in CORPUS["standards"]}

ACCESS = [
  "Provide readable text plus optional audio or read-aloud support; no voice feature is required.",
  "Chunk directions into one action at a time and make the success criteria visible in text.",
  "Allow typed, handwritten, dictated, or recorded-to-text responses; the response mode is not the standard.",
  "Offer reduced-copying, extended-time, hidden-timer, movement-break, and low-distraction options.",
  "Use captions, transcripts, alt text, high-contrast print, keyboard access, and text-only fallbacks for any media.",
  "Provide an accessible reading representation (digital reflowable text, enlarged print, or audio) for every assigned text.",
  "Preserve the learning target while adjusting quantity, pacing, representation, or response mode.",
]
SAFETY = [
  "Use respectful, non-shaming language about writing and reading difficulty.",
  "Allow a pause, break, or alternate response mode without treating it as failure.",
  "Offer an alternate text or private response when content is personally sensitive.",
  "Do not require autobiographical disclosure; fictionalized or analytical alternatives are always acceptable.",
  "Presentation may be delivered privately to the facilitator; no public or recorded performance is ever required.",
]
AUTHORSHIP = [
  "The learner writes every assessed response. The tutor may explain, question, critique, or suggest a revision direction.",
  "The tutor must not draft, rewrite, or supply sentences for an assessed response, and must not complete a graded task on the learner's behalf.",
  "Tutor assistance is logged as guided evidence; unaided work is logged as independent evidence. Mastery requires independent evidence.",
  "Fixed-form assessment items keep their answer key adult-only; the key is never surfaced in a learner-facing surface.",
]

def tutor_routes(focus, g):
    r = RIGOR[g]
    return [
      {"signal": "prerequisite gap",
       "action": f"Return to the smallest prerequisite needed for {focus}, re-teach it on a short passage, then retry one fresh item. Do not write the learner's response."},
      {"signal": "procedure without understanding",
       "action": f"Ask the learner to explain why the move for {focus} works on this text before continuing. Accept explanation in any modality."},
      {"signal": "correct but low confidence",
       "action": f"Name specifically what the reasoning got right about {focus}, offer one varied case, and avoid unnecessary remediation."},
      {"signal": "repeated error pattern",
       "action": f"Describe the observable pattern neutrally, contrast it with a correct case, and schedule a short later review of {focus}."},
      {"signal": "requests the answer",
       "action": "Decline to supply the assessed response. Offer a question, a criterion, or a counterexample instead, and record that guided support was given."},
      {"signal": "mastery evidence",
       "action": r["mastery"]},
    ]

def resolve_texts(slug, unit_number):
    bank = {t["text_id"]: t for t in BANKS[slug]}
    out = []
    for tid in UNIT_TEXTS[slug][unit_number]:
        t = bank[tid]
        out.append({
            "text_id": tid, "title": t["title"], "author": t["author"],
            "year": t["year"], "form": t["form"], "rights": t["rights"],
            "source": t["source"],
            "accessible_representation": "Digital reflowable text, enlarged print, or audio, learner's choice.",
        })
    return out

def build_lesson(course, unit_idx, day, unit_title, standards, topics, ptask, slug):
    g = course["grade"]; r = RIGOR[g]
    un = unit_idx + 1
    focus = topics[(day - 1) % 6]
    phase = PHASES[day - 1]
    spec = PHASE_SPECS[phase]
    cid = f"ma-g{g}-english-language-arts"
    primary = standards[(day - 1) % len(standards)]

    fmt = dict(focus=focus, ptask=ptask, unit=unit_title, band=r["band_clause"],
               model=r["model"], guided=r["guided"], independent=r["independent"],
               seminar=r["seminar"], transfer=r["transfer"], mastery=r["mastery"])

    flow = [{"segment": name, "minutes": mins,
             "teacher_or_tutor_action": action.format(**fmt)}
            for (name, mins, action) in spec["segments"]]

    default_activity = r["independent"] + f" Focus: {focus}."
    default_check = (f"State the most important claim about {focus} and identify one check "
                     "that would expose a weak or unsupported reading.")
    activity = spec.get("activity", default_activity).format(**fmt)
    check = spec.get("check", default_check).format(**fmt)

    return {
      "schema_version": "1.0",
      "lesson_id": f"{cid}-u{un:02d}-l{day:02d}",
      "course_id": cid,
      "grade": g,
      "subject": "english-language-arts",
      "course_day": unit_idx * 18 + day,
      "unit_number": un,
      "unit_title": unit_title,
      "day_in_unit": day,
      "title": f"{phase}: {focus}",
      "phase": phase,
      "focus": focus,
      "estimated_minutes": "55\u201375",
      "standards": list(standards),
      "primary_standard": primary,
      "standards_band": course["band"],
      "assigned_texts": resolve_texts(slug, un),
      "essential_question": f"How does close, evidence-governed attention to {focus} change what a reader or writer is entitled to claim?",
      "learning_objectives": [o.format(**fmt) for o in OBJECTIVES[g]],
      "success_criteria": [c.format(**fmt) for c in CRITERIA[g]],
      "materials": [
        "course notebook or digital equivalent",
        "the unit's assigned texts, in an accessible reading representation",
        "citation reference or style manual appropriate to the course",
      ],
      "lesson_flow": flow,
      "student_activity": activity,
      "formative_check": check,
      "answer_or_scoring_guidance": "Score the stated learning target, accuracy, evidence and reasoning, and revision. Accept multiple valid readings when the evidence supports them. Do not infer effort, motivation, diagnosis, or character from an error.",
      "adaptive_tutor_routes": tutor_routes(focus, g),
      "mastery_rule": r["mastery"],
      "extension": r["transfer"],
      "student_authorship": AUTHORSHIP,
      "accessibility_and_accommodations": ACCESS,
      "safety_and_privacy": SAFETY,
      "media": {
        "suggestion": f"Optional diagram, annotated passage, recorded reading, or short clip supporting {focus}.",
        "required": False,
        "fallback": "Provide the same information as readable text, alt text, or a transcript. No media is required to meet the standard.",
      },
      "parent_or_guardian_visibility": "Share the lesson target, completion state, evidence type, and next instructional step. Do not expose raw drafts, raw private reflections, recordings, or diagnosis language.",
      "home_connection": f"Invite the learner to notice one real-world instance of {focus} in something they already read. No purchase, account creation, or private disclosure is required.",
      "performance_task_link": ptask,
    }

def build_assessment(course, unit_idx, unit_title, standards, topics, ptask):
    g = course["grade"]; r = RIGOR[g]
    cid = f"ma-g{g}-english-language-arts"
    un = unit_idx + 1
    prompts = [
      {"type": "concept and vocabulary",
       "prompt": f"Explain {topics[0]} in your own words and identify a valid example in an assigned text.", "points": 4},
      {"type": "textual evidence",
       "prompt": f"Cite the strongest available evidence for a claim about {topics[1]}, and state what the evidence does not establish.", "points": 5},
      {"type": "application",
       "prompt": f"Apply {topics[2]} to a text you have not analyzed in this unit. Show the reasoning, not only the conclusion.", "points": 6},
      {"type": "error or claim analysis",
       "prompt": f"Analyze a plausible misreading or unsupported claim involving {topics[3]}; correct it and explain what made it wrong.", "points": 6},
      {"type": "connection",
       "prompt": f"Connect {topics[4]} with {topics[5]}. Explain how one constrains, supports, or complicates the other.", "points": 5},
      {"type": "performance evidence",
       "prompt": f"Present the strongest evidence from the unit performance task: {ptask}", "points": 8},
      {"type": "reflection and transfer",
       "prompt": "Identify one skill you can now transfer, one check that improves the quality of your reading or writing, and one open question.", "points": 4},
    ]
    # The ladder. Grade 8 assesses at 38 points / 7 prompts; every high-school
    # course must ask for strictly more, and each step adds a dimension tied to
    # that course's rigor profile rather than more of the same.
    prompts.append({"type": "sufficiency and counter-evidence",
      "prompt": f"Show that your evidence for {topics[1]} is sufficient, not merely consistent with your claim. Identify the strongest piece of evidence that cuts against you.", "points": 5})
    if g >= 10:
        prompts.append({"type": "unaided transfer",
          "prompt": f"Apply {topics[0]} to a text supplied at assessment time, with no exemplar and no checklist. Explain the choice you made and why.", "points": 5})
    if g >= 11:
        prompts.append({"type": "uncertainty and limits",
          "prompt": "State precisely where the text or the sources leave the question unsettled, and what additional evidence would settle it.", "points": 6})
    if g == 12:
        prompts.append({"type": "source trail audit",
          "prompt": "Supply a source trail a reader could re-walk: every claim traced to a source, every source assessed for strengths and limitations relative to this task.", "points": 8})
    return {
      "assessment_id": f"{cid}-u{un:02d}-assessment",
      "course_id": cid,
      "unit_number": un,
      "unit_title": unit_title,
      "standards": list(standards),
      "total_points": sum(p["points"] for p in prompts),
      "prompts": prompts,
      "administration_note": r["assessment_note"],
      "authorship_rule": "Every response is written by the learner. Tutor or adult support may explain, question, or critique, but any assessed sentence must be the learner's own. Supported attempts are recorded as guided evidence and do not by themselves establish mastery.",
      "mastery_interpretation": {
        "secure": "At least 85% with accurate independent application and sufficient cited evidence.",
        "developing": "70-84%, or inconsistent explanation; assign targeted review and a fresh transfer check on new text.",
        "not_yet": "Below 70%, or a missing prerequisite; reteach the smallest gap and reassess with new evidence.",
        "rule": "A unit score is one evidence source, not the sole basis for long-term mastery.",
      },
      "reassessment": "Reassessment uses fresh items or a new text after targeted instruction. The higher demonstration stands; the earlier attempt is not averaged in.",
      "rubric_dimensions": ["accuracy or fidelity", "evidence and reasoning", "application or performance", "checking and revision"],
      "accommodation_note": "Access supports may change format, pacing, quantity, setting, or response mode without changing the standard being assessed.",
    }

def course_guide_md(course, units, assessments):
    g = course["grade"]; r = RIGOR[g]; cid = f"ma-g{g}-english-language-arts"
    rows = "\n".join(
      f"| {u['unit_number']} | {u['title']} | {u['days']} | {', '.join(u['standards'])} | {u['performance_task']} |"
      for u in units)
    bank = BANKS[course["slug"]]
    n_orig = sum(1 for t in bank if t["rights"] == "original")
    n_pd = sum(1 for t in bank if t["rights"] == "public_domain")
    n_gated = sum(1 for t in bank if t["rights"] == "rights_required")
    return f"""# {course['title']} — Course Guide

**Course ID:** `{cid}`
**Grade:** {g}
**Standards band:** Michigan ELA grades {course['band']}
**Instructional sessions:** 180 (36 weeks x 5 days)
**Typical session:** 55–75 minutes
**Cadence:** daily

## Course description

{course['description']}

## Where this course sits in the band

{course['band_expectation']}

Michigan publishes high-school ELA as two grade bands, 9-10 and 11-12, not as four
separate grade-level standard sets. This course takes the **{r['support']}** half of the
{course['band']} band. The split between the two years of a band is a Manuel Academy
curricular decision; the state band does not itself prescribe it. The one place the
state does differentiate within a band is standard 10, and this course is anchored to
it: work is expected {r['band_clause']}.

## Course outcomes

By the end of the course, learners will:

1. Demonstrate the listed Michigan grades {course['band']} expectations through independent, accessible evidence.
2. Ground every interpretive or argumentative claim in cited textual evidence, and say what the evidence does not establish.
3. Transfer analytical and research moves to unfamiliar texts, tasks, and audiences.
4. Use feedback and error evidence to revise without shame or character judgments.
5. Complete the course capstone: **{course['capstone']}**

## Instructional model

Each unit runs the same recurring 18-day arc: launch and diagnostic; concept models;
guided practice; independent application; investigation or close reading; reteach;
seminar; performance-task planning and build; consolidation; transfer; assessment
preparation; unit assessment; targeted correction; and publication or reflection.
Lessons are resumable by segment, media is always optional, and an accessible reading
representation is always specified.

What distinguishes this course from the others in the sequence is how much is withdrawn:

- **Modeling:** {r['model']}
- **Guided practice:** {r['guided']}
- **Independent application:** {r['independent']}
- **Seminar:** {r['seminar']}
- **Transfer:** {r['transfer']}

## Mastery and grading

- One correct answer never establishes mastery.
- {r['mastery']}
- Unit assessments combine concept, textual evidence, application, error analysis, connection, performance evidence, and reflection{', plus an explicit account of uncertainty and limits' if g >= 11 else ''}{', plus an auditable source trail' if g == 12 else ''}.
- Suggested reporting: **Secure**, **Developing**, or **Not Yet**, supported by evidence rather than a single percentage.
- Reassessment uses fresh items or a new text after targeted instruction; the higher demonstration stands.
- Approved breaks, accommodations, voice/no-voice choices, and alternate response modes are not failures.

## Student authorship

The learner writes every assessed response. The tutor may explain, ask questions,
critique, and suggest a direction for revision. The tutor may not draft or rewrite an
assessed response. Supported work is recorded as guided evidence; mastery requires
independent evidence. Answer keys for fixed-form items remain adult-only and are never
projected into a learner-facing surface.

Raw student essays are not persisted into Family Pilot metadata. Guardian-visible
records carry the target, completion state, evidence type, and next step only.

## Accessibility

Text-first throughout. No voice recording is required, no video is required, and any
presentation may be delivered privately to the facilitator. Media carries captions,
transcripts, and alt text, and every assigned text has an accessible reading
representation. Access supports never change the standard being assessed.

## Scope and sequence

| Unit | Title | Days | Standards | Performance task |
| --- | --- | --- | --- | --- |
{rows}

## Text bank and source boundaries

This course draws on {len(bank)} catalogued texts: {n_orig} original Manuel Academy texts,
{n_pd} public-domain works, and {"1 reference-only entry" if n_gated == 1 else str(n_gated) + " reference-only entries"}.

No copyrighted novel, play, poem, article, or lyric is reproduced in this package.
Where the Michigan standards name a still-copyrighted work as an example, this course
records the reference, does **not** include the text, and supplies a public-domain
substitute that meets the same standard. Families may substitute the named work if
they hold or obtain access. Full citation and rights metadata for every entry is in
`text-bank.json`.

## Core artifacts

- `units.json` — unit specifications and standards alignment
- `lessons.jsonl` — {len(units) * 18} lesson blueprints, one JSON object per line
- `assessments.json` — {len(assessments)} unit assessments with rubrics and mastery interpretation
- `text-bank.json` — catalogued texts with rights and citation metadata
- `daily-schedule.csv` — the 180-day schedule
- `lesson-sequence.md` — human-readable sequence

## Capstone

{course['capstone']}

The capstone may be presented publicly, privately, in writing, orally, or in another
accessible format that preserves the learning targets.
"""

def lesson_sequence_md(course, units, lessons):
    g = course["grade"]
    out = [f"# {course['title']} — Lesson Sequence\n",
           f"**Course ID:** `ma-g{g}-english-language-arts`  \n**Sessions:** {len(lessons)}\n"]
    by_unit = {}
    for l in lessons:
        by_unit.setdefault(l["unit_number"], []).append(l)
    for u in units:
        un = u["unit_number"]
        out.append(f"\n## Unit {un}: {u['title']}\n")
        out.append(f"*Days {(un-1)*18+1}–{un*18} · Standards: {', '.join(u['standards'])}*\n")
        out.append(f"**Essential question:** {u['essential_question']}\n")
        out.append(f"**Performance task:** {u['performance_task']}\n")
        out.append("\n| Day | Course day | Phase | Focus |")
        out.append("| --- | --- | --- | --- |")
        for l in by_unit[un]:
            out.append(f"| {l['day_in_unit']} | {l['course_day']} | {l['phase']} | {l['focus']} |")
        out.append("")
    return "\n".join(out) + "\n"

def main():
    summary = []
    for course in COURSES:
        g = course["grade"]; slug = course["slug"]; cid = f"ma-g{g}-english-language-arts"
        outdir = os.path.join(LANE, "courses", slug)
        os.makedirs(outdir, exist_ok=True)
        units, lessons, assessments = [], [], []
        for i, (title, stds, topics, ptask) in enumerate(course["units"]):
            un = i + 1
            lesson_ids = [f"{cid}-u{un:02d}-l{d:02d}" for d in range(1, 19)]
            units.append({
              "unit_id": f"{cid}-u{un:02d}", "course_id": cid, "grade": g,
              "subject": "english-language-arts", "standards_band": course["band"],
              "unit_number": un, "title": title, "days": 18,
              "standards": list(stds),
              "essential_question": f"How does disciplined attention to {topics[0]} and {topics[1]} change what a reader or writer is entitled to claim?",
              "topics": list(topics),
              "performance_task": ptask,
              "assigned_text_ids": list(UNIT_TEXTS[slug][un]),
              "lesson_ids": lesson_ids,
              "assessment_id": f"{cid}-u{un:02d}-assessment",
            })
            for d in range(1, 19):
                lessons.append(build_lesson(course, i, d, title, stds, topics, ptask, slug))
            assessments.append(build_assessment(course, i, title, stds, topics, ptask))

        def w(name, obj):
            with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
                json.dump(obj, f, ensure_ascii=False, indent=2); f.write("\n")
        w("units.json", units)
        w("assessments.json", assessments)
        w("text-bank.json", {
            "course_id": cid, "grade": g,
            "rights_policy": "original | public_domain | rights_required. Nothing marked rights_required is reproduced in this package.",
            "count": len(BANKS[slug]), "texts": BANKS[slug]})
        with open(os.path.join(outdir, "lessons.jsonl"), "w", encoding="utf-8") as f:
            for l in lessons:
                f.write(json.dumps(l, ensure_ascii=False) + "\n")
        with open(os.path.join(outdir, "daily-schedule.csv"), "w", encoding="utf-8", newline="") as f:
            wr = csv.writer(f)
            wr.writerow(["course_day", "week", "weekday", "unit_number", "unit_title", "lesson_id", "phase", "focus"])
            for l in lessons:
                cd = l["course_day"]
                wr.writerow([cd, (cd - 1) // 5 + 1, (cd - 1) % 5 + 1, l["unit_number"],
                             l["unit_title"], l["lesson_id"], l["phase"], l["focus"]])
        open(os.path.join(outdir, "course-guide.md"), "w", encoding="utf-8").write(
            course_guide_md(course, units, assessments))
        open(os.path.join(outdir, "lesson-sequence.md"), "w", encoding="utf-8").write(
            lesson_sequence_md(course, units, lessons))
        summary.append((slug, cid, len(units), len(lessons), len(assessments)))
        print(f"{slug}: units={len(units)} lessons={len(lessons)} assessments={len(assessments)}")
    return summary

if __name__ == "__main__":
    main()
