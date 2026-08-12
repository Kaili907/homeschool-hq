# Grade 3-4 Physical Education — Authoring Package

Two complete full-year Manuel Academy Physical Education courses, authored
against the existing curriculum and Study contracts. No Study Engine change is
introduced.

| Course | Course ID | Units | Sessions | Cadence |
| --- | --- | --- | --- | --- |
| Grade 3 Physical Education | `ma-g3-physical-education` | 9 | 108 | 36 weeks x 3 sessions (suggested: Mon/Wed/Fri) |
| Grade 4 Physical Education | `ma-g4-physical-education` | 9 | 108 | 36 weeks x 3 sessions (suggested: Mon/Wed/Fri) |

Unit count, session count, cadence, and the twelve-session unit arc all match
the published Grade 5, 7, and 8 PE courses, so a family running more than one
grade keeps one weekly shape.

## Layout

```
physical-education/
  README.md            this file
  standards-map.md     Michigan alignment for both grades (generated)
  grade-3/ grade-4/
    units.json         unit specs, standards, topics, tasks, adapted paths, guardian safety review
    lessons.jsonl      one JSON object per lesson, course_day order
    assessments.json   unit assessments, rubrics, mastery interpretation
    course-guide.md    course guide (generated)
    lesson-sequence.md full sequence (generated)
    schedule.csv       36-week schedule, exact lesson coverage
  tools/
    course-data.mjs    the authored content: units, topics, tasks, adapted paths, guardian blocks
    build-pe-g34.mjs   deterministic generator + validator
```

Everything outside `tools/` is generated. Edit `tools/course-data.mjs`, then rebuild.

`course-data.mjs` holds the actual teaching content. Each of the 108 topics
carries its own `cues` (the movement cues taught that session) and a
`common_error` naming what typically goes wrong and the correction, so lessons
differ in substance rather than only in a substituted topic label.

## Build and validate

```bash
node tools/build-pe-g34.mjs          # regenerate both grades
node tools/build-pe-g34.mjs --check  # validate only, no writes
```

Deterministic: IDs are positional, nothing is randomized or time-stamped, so an
unchanged input reproduces byte-identical output.

The validator fails the build on: wrong counts, non-contiguous `course_day`,
duplicate IDs, dangling references, assessment point sums that do not match
`total_points`, a missing Study field, a missing adapted alternative, an
incomplete guardian safety review, fewer than three taught `cues`, a missing
`common_error`, required media, a non-canonical standard label, a schedule that
is not exactly 36 weeks x 3 sessions covering each lesson once, and any
unnegated body-metric term, media requirement, or public-performance
requirement.

**Scan coverage.** The content scan runs over lesson bodies *and* over unit
performance tasks, adapted alternatives, essential questions, guardian safety
blocks, every topic's cues and common error, and every assessment prompt. An
earlier revision scanned only lesson bodies, which let a performance task
requiring recorded repetition and distance progress through even though that
task is quoted verbatim as an 8-point graded assessment item. Unit and
assessment prose is graded evidence and is scanned accordingly. The banned-term
list includes `repetition count` and `distance score` directly.

## Standards basis

Aligned to the **Michigan K-12 Physical Education Standards** (State Board,
May 2017), all five standards covered in each grade. Unit content follows the
movement concepts and locomotor vocabulary named in the standards themselves:
self-space and general space, directions, levels, pathways, and the locomotor
set walk, run, leap, jump, skip, hop, gallop, slide, chase, flee, dodge. Grade 3
establishes each pattern in stable conditions; Grade 4 combines patterns and
applies them in dynamic space and under light pressure. See `standards-map.md`.

**Anchor encoding.** The published Grade 5/7/8 PE courses encode standards as
`["Michigan PE Standards 1", "2", "4"]`, where standards 2-5 are bare numeric
strings. The v2 authoring compatibility importer classifies those bare labels
`CONTENT_CORRECTION_REQUIRED` because no canonical identifier can be inferred
from them (see `docs/curriculum/schema-set-v2/README.md`). These Grade 3-4
courses write each anchor as a complete self-describing label, so no correction
pass is needed at import. The validator enforces the format.

## Body-safe guarantees

Verified on all 216 lessons by the build validator. The courses never require,
collect, score, or store: any body measurement (weight, height, BMI, body-fat
percentage); a fitness test, timed trial, repetition count, distance score, or
ranking of one learner against another; a photograph, video, or recording of the
learner as proof of participation or performance; or a public performance,
audience, or demonstration in front of peers.

Progress is compared only against the learner's own earlier work, and only when
the learner chooses to track it. `parent_or_guardian_visibility` on every lesson
states that Study records completion and progress metadata only and performs no
physical measurement or fitness tracking.

**Standard 3 is still covered.** Michigan Standard 3 concerns health-enhancing
fitness. These courses teach fitness knowledge and self-judged effort, and
evidence Standard 3 through explanation, planning, and self-selected
participation rather than through testing or measurement. That is a
private-safe design decision layered on the standard, stated openly in
`standards-map.md` rather than presented as full conventional coverage.

## Inclusive alternatives

Every unit carries an `adapted_alternative`, repeated on all 12 of its lessons —
216 of 216 lessons. These are movement-specific rather than generic: each names
the concrete seated, supported, reduced-range, slower, larger-object, or
role-based path that reaches the same standard. Using an adapted alternative is
a full-credit path, never a reduced one, and the scoring guidance on every
lesson states that choosing an adapted path, a rest, or an opt-out is never
scored as a deficit.

## Guardian safety markers

Every unit and every lesson carries a `guardian_safety_review` block with
`equipment`, `environment`, `movement_hazards`, `food_or_allergy_note`, and
`guardian_confirmation_required`. All 9 units in both grades require explicit
guardian confirmation of space and equipment before activity begins, and every
lesson opens with a "Safety and area check" segment.

## Study compatibility

Lessons carry the same field contract the published release uses, so promotion
is mechanical rather than a rewrite: `lesson_id`, `course_id`, `grade`,
`subject`, `course_day`, `unit_number`, `unit_title`, `day_in_unit`, `title`,
`phase`, `focus`, `standards`, plus the teacher-only `answer_or_scoring_guidance`
and `adaptive_tutor_routes` that `scripts/build-curriculum.mjs` strips from the
student projection, and assessment `mastery_interpretation` which it strips
likewise.

Four fields are added beyond the published shape: `adapted_alternative`,
`guardian_safety_review`, `cues` (the movement cues taught), and `common_error`
(the typical fault and its correction). All four are student-safe and are
intended to reach the learner and the guardian.

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
