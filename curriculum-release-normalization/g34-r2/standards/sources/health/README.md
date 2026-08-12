# Grade 3-4 Health — Authoring Package

Two complete full-year Manuel Academy Health courses, authored against the
existing curriculum and Study contracts. No Study Engine change is introduced.

| Course | Course ID | Units | Sessions | Cadence |
| --- | --- | --- | --- | --- |
| Grade 3 Health | `ma-g3-health` | 6 | 36 | 36 weeks x 1 session (suggested: Wednesday) |
| Grade 4 Health | `ma-g4-health` | 6 | 36 | 36 weeks x 1 session (suggested: Wednesday) |

Session count and cadence match the published Grade 5, 7, and 8 health courses
(36 sessions, weekly), so a family running more than one grade keeps one shape.

## Layout

```
health/
  README.md            this file
  standards-map.md     Michigan alignment for both grades (generated)
  grade-3/ grade-4/
    units.json         unit specs, standards, topics, tasks, guardian safety review
    lessons.jsonl      one JSON object per lesson, course_day order
    assessments.json   unit assessments, rubrics, mastery interpretation
    course-guide.md    course guide (generated)
    lesson-sequence.md full sequence (generated)
    schedule.csv       36-week schedule, exact lesson coverage
  tools/
    course-data.mjs    the authored content: units, topics, tasks, adapted paths, guardian blocks
    build-health-g34.mjs  deterministic generator + validator
```

Everything outside `tools/` is generated. Edit `tools/course-data.mjs`, then rebuild.

`course-data.mjs` holds the actual teaching content. Each of the 72 topics
carries its own `key_points` (the facts and rules taught that session) and a
`scenario` (a fictional worked situation), so lessons differ in substance rather
than only in a substituted topic label. Topic order within a unit is deliberate:
the highest-stakes topic sits at index 1, which the six-day arc maps to the
explicit-model session, so safety-critical material is taught directly rather
than landing in the correction slot.

## Build and validate

```bash
node tools/build-health-g34.mjs          # regenerate both grades
node tools/build-health-g34.mjs --check  # validate only, no writes
```

The generator is deterministic: IDs are positional, and nothing is randomized or
time-stamped, so an unchanged input reproduces byte-identical output.

The validator fails the build on: wrong lesson/unit/assessment counts,
non-contiguous `course_day`, duplicate IDs, dangling unit-to-lesson or
unit-to-assessment references, assessment point sums that do not match
`total_points`, a missing Study field, a missing adapted alternative, a missing
guardian safety review, fewer than four taught `key_points`, a missing
`practice_scenario`, required media, a schedule that does not span exactly 36
weeks or cover each lesson exactly once, and any unnegated body-metric term or
media requirement.

**Scan coverage.** The content scan runs over lesson bodies *and* over unit
performance tasks, adapted alternatives, home connections, essential questions,
guardian safety blocks, every topic's key points and scenario, and every
assessment prompt. An earlier revision scanned only lesson bodies, which let a
non-compliant performance task through even though that task is quoted verbatim
as a graded assessment item — unit and assessment prose is graded evidence and
is scanned accordingly.

Two refinements keep the scan honest rather than merely noisy. A banned term is
a violation only when it is *not* inside an explicit prohibition, because naming
what the course refuses to do is the point. And media is a violation only when
the learner is asked to produce it or when it depicts the learner, so teaching
content may discuss an advertising video or a cyberbullying photo without
tripping the check.

## Standards basis

Aligned to the **Michigan Health Education Standards Guidelines 2025**, approved
by the State Board on 2025-11-13. That revision reorganizes health education
into six Practices and consolidates grade spans to K-2, **3-5**, 6-8, and 9-12.
Grade 3 and Grade 4 both sit inside the 3-5 band, so the two courses share band
anchors and differ by depth: Grade 3 establishes the habit, the vocabulary, and
the trusted-adult pathway; Grade 4 moves to planning, deciding, refusing, goal
setting, and source-checked advocacy. All six Practices are covered in each
grade. See `standards-map.md`.

Note this is a newer framework than the published Grade 5/7/8 health courses
use. Those carry pre-2025 anchors (`Michigan Health: Core Concepts`,
`Accessing Information`, `Self-Management`). These Grade 3-4 courses are aligned
to the standards currently in force; the older courses were not re-aligned here
because they are outside this session's ownership.

## Private-safe guarantees

Verified on all 72 lessons by the build validator. The courses never require,
collect, score, or store: body weight, height, BMI, or body-fat percentage;
calorie counting, dieting, weight-loss goals, or body-size targets; private
medical history, diagnosis, or treatment disclosure; mental-health diagnosis or
trauma disclosure; sexual-history disclosure; or any photograph or video of the
learner.

Every scenario is fictional and the learner may always answer about a made-up
character. Optional private reflection is never scored, never required, and
never persisted as raw text — `parent_or_guardian_visibility` on every lesson
states that Study records completion and progress metadata only.

**Reproductive and sexual-health instruction is deliberately excluded; personal
safety is not.** Michigan law places *sex education and HIV/STI instruction*
under local control with guardian notice and opt-out (MCL 380.1507, MCL
380.1507b). That statute does not restrict child-sexual-abuse prevention, and
this package does not use it as a reason to omit that.

Excluded and left to the guardian as a separately selected module: reproductive
anatomy and function, puberty instruction, and sexual-health content. Included
and taught, in Unit 4 of both grades: body autonomy and the right to refuse
touch from anyone including relatives, correct anatomical names, the
private-parts rule with its narrow named exceptions, permission, the difference
between a happy surprise and an unsafe secret, the fact that unsafe requests
most often come from someone already known and trusted, that a child is never at
fault, and that they should keep telling until an adult acts. Unit 4 carries a
guardian confirmation flag so guardians can preview it.

## Guardian safety markers

Every unit and every lesson carries a `guardian_safety_review` block with
`equipment`, `environment`, `movement_hazards`, `food_or_allergy_note`, and
`guardian_confirmation_required`. Units 2, 4, 5, and 6 in both grades require
explicit guardian confirmation before the activity runs — unit 2 for food and
allergens, unit 4 so guardians can preview the personal-safety content, unit 5
for the home safety walk, and unit 6 for medicine containers and supervised
internet use.

## Study compatibility

Lessons carry the same field contract the published release uses, so promotion
is mechanical rather than a rewrite. Verified: `lesson_id`, `course_id`,
`grade`, `subject`, `course_day`, `unit_number`, `unit_title`, `day_in_unit`,
`title`, `phase`, `focus`, `standards`, plus the teacher-only fields
`answer_or_scoring_guidance` and `adaptive_tutor_routes` that
`scripts/build-curriculum.mjs` strips from the student projection, and
assessment `mastery_interpretation` which it strips likewise.

Four fields are added beyond the published shape: `adapted_alternative`,
`guardian_safety_review`, `key_points` (the facts and rules the session teaches),
and `practice_scenario` (the worked fictional situation for guided practice).
All four are student-safe and are intended to reach the learner and the guardian.

## Not yet wired into Study

This package is authoring-stage content. It is additive and touches nothing
outside `curriculum-authoring/`; `scripts/build-curriculum.mjs` still projects
the frozen 1.0.0 release unchanged (30 courses, 232 units, 2736 lessons).

Serving these courses to learners requires changes **outside this session's
ownership**, which is why they are not made here:

1. `src/types.ts` — `AcademyGrade` is `'5' | '7' | '8'`; grades 3 and 4 do not exist in the runtime type system.
2. Release promotion — `curriculum-content/manuel-academy/1.0.0` is frozen and immutable, so grade 3/4 content needs a new release version rather than an edit.
3. `scripts/build-curriculum.mjs` — `EXPECTED.grades` is `['5','7','8']` and the course/unit/lesson counts are hard-coded.
4. Release indexes — `course-index.json`, `unit-index.json`, `lesson-index.csv`, `curriculum-manifest.json`, `SHA256SUMS.txt`.
5. `src/curriculum/family-pilot/source.node.ts` — `PILOT_GRADES` is `['5','7','8']`.
6. A grade-level `daily-schedule.csv` for grades 3 and 4, which cannot be completed until the remaining grade 3/4 subjects exist. Health and PE ship their own per-course `schedule.csv` in the meantime.
