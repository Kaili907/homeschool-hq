# Manuel Academy — High School Ready for Life, Grades 9-12

Four continuous courses extending the published Ready for Life progression into a complete
high-school life-readiness sequence:

`ma-g8-ready-for-life` (published, untouched)
→ **Ready for Life 9** → **10** → **11** → **12**

## Why this lane sits outside `curriculum-content/`

`curriculum-content/manuel-academy/1.0.0/` is an immutable published release pinned to
grades 5/7/8. This lane is authoring-stage content held separately, written to the same lesson
shape so a later release cycle can promote it through the existing pipeline.

**Nothing in this lane modifies the Study Engine, the Family Pilot integration, the app or
router, other high-school subject lanes, or the published Grades 5/7/8 Ready for Life course.**
The frozen baseline artifact `a5-ready-for-life-v1.zip` is likewise referenced, never copied
or modified.

## Layout

```
standards/
  manuel-academy-rfl-9-12-competencies.json   local competency framework + safety charter
progression/
  grade-8-to-ready-for-life-9-handoff.md      what G8 leaves; how each unit continues
  progression-9-12.md                         the four-year shape and the sign-off model
courses/<slug>/
  course-guide.md        description, scope and sequence, safety and dignity policies
  units.json             6 units
  lessons.jsonl          36 lesson blueprints, one JSON object per line
  assessments.json       6 unit assessments
  daily-schedule.csv     36-day schedule (36 weeks x 1), with a sign-off column
  lesson-sequence.md     human-readable sequence, sign-off marked
authoring/               deterministic generators for the above
validation/
  validate.mjs           142 mechanical checks
  validation-report.md   latest run
```

## Totals

| | Count |
| --- | --- |
| Courses | 4 |
| Units | 24 (6 per course) |
| Lessons | 144 (36 per course) |
| Unit assessments | 24 |
| Lessons requiring guardian attestation | 48 (12 per course) |

Shape matches the published Grade 8 course exactly — 6 units × 6 lessons — so pacing and unit
boundaries carry over unchanged.

## No standards claim

Ready for Life has **no external standards body, and none is claimed.** The competency
framework is declared `authority: LOCAL_COMPOSITION` with `jurisdiction: null`, and states
plainly that it is not a state, national, or third-party framework. Courses carry the literal
string `Manuel Academy RFL Grade <n> progression` — extending the equally local declaration
the published Grade 5/7/8 courses already use. No external standard was cited, implied, or
invented to lend this lane borrowed authority.

## The four years

| Grade | Theme | The move that defines the year |
| --- | --- | --- |
| 9 | Systems for Independence | Turn Grade 8 routines into durable systems the learner runs themselves. |
| 10 | Work, Documents, and Community | Career, job readiness, professional communication, consumer and civic tasks. |
| 11 | Postsecondary and Adult Systems | Pathways, deadlines, health self-management, housing, decisions under constraint. |
| 12 | Transition to Adulthood | Operate adult systems end to end; close with the senior capstone. |

## Safety — enforced, not asserted

Validated on all 144 lessons:

- **No shame.** Difficulty is never treated as a character flaw. Honest self-assessment scores
  full marks. Every lesson carries a tutor route for learner self-criticism that does not
  record the disclosure.
- **No unsafe unsupervised real-world task.** Heat, sharp tools, appliances, chemicals,
  medication, electricity, heights, power tools, driving, water, money movement, and contact
  with unfamiliar adults are guardian-supervised or simulated.
- **Equal-credit simulated alternative on every lesson.** A household without a given
  appliance, a vehicle, or an available supervising adult never produces a lower score.
- **No credential collection.** No password, account number, government identifier, card
  number, or real balance is requested, displayed, entered, or stored. Every lesson routes an
  offered credential to refusal.
- **No forced private disclosure.** Household, financial, or health disclosure is never
  required; a fictional or analytical alternative is always available and never scored lower.
- **No identifiable photo, recording, or public performance** is ever required.
- **Not advice.** Nothing here is medical, legal, financial, employment, or immigration
  advice, and local rules are to be verified against a current local source, not assumed.

## A click cannot certify a real-world adult-supervised task

The load-bearing rule of this lane, implemented rather than stated.

Days 4 (supervised application) and 6 (unit performance task) of every unit depend on a
real-world action, so both require an `adult_attestation` naming **the observing adult's role,
what the adult actually observed, and the date**. A learner-side completion toggle records only
that the learner reports having finished; it never satisfies the attestation, and an unattested
real-world task is incomplete evidence rather than mastery. Every sign-off lesson carries a
tutor route for exactly that case.

`click_alone_is_insufficient` is set on **every** lesson, including non-sign-off lessons, so
the property cannot be lost if a lesson is reclassified later.

## Grade 12 senior capstone

Grade 12 unit 6 is the **Transition-to-Adulthood Capstone**, the culminating unit of the whole
progression: assemble and defend a complete transition portfolio — pathway and next steps,
adult-life systems, independent-living evidence, work readiness, civic and legal checklist,
health self-management, and a support-and-contingency plan — with guardian attestation of every
real-world component and an honest statement of what still needs support. Naming a remaining
support need scores full marks.

The capstone is a plan a learner can use, **not** a certificate of competence: the framework
states that it confers no credential, credit, licence, or declaration that a learner is safe to
perform any task unsupervised.

## Study Engine compatibility

Authored for the existing Study Engine; no engine, mastery store, or Family Pilot surface is
introduced or duplicated. Every lesson has at least five `lesson_flow` segments so segment-level
resume works unchanged, and uses the same adult-only fields the content boundary already
withholds from student chunks.

**Practice generation never directly awards mastery.** Mastery requires independent evidence
plus the learner's own explanation on at least two occasions, one transferred. A
guardian-attested performance counts as one occasion only when the attestation is present.

**Parent-visible evidence is minimized:** target, completion state, evidence type, attestation
where required, next step. No raw reflections, recordings, photographs, household detail,
health detail, or diagnosis-like language.

## Validate

```
node validation/validate.mjs
```

## Regenerate

```
python3 authoring/generate_courses.py
```

Generation is deterministic: the same blueprints produce byte-identical output.
