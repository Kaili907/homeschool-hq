# Grade 3–4 Technology and Computer Science

**Package:** Manuel Academy Full-Family Grade 3–4 Curriculum Authoring
**Subject:** Technology and Computer Science
**Grades:** 3, 4
**School-year model:** 36 weeks, weekly cadence
**Status:** draft — curriculum-authoring stage, not yet merged into production `curriculum-content`

## What this is

Two complete, full-year Grade 3 and Grade 4 Technology and Computer Science courses, authored to the same
lesson/unit/assessment blueprint used by the existing Manuel Academy Grade 5 Technology course
(`curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/technology`), scaled down for 8–10 year
old learners and vertically aligned so a learner moving Grade 3 → Grade 4 → Grade 5 experiences a coherent
spiral, not a repeated course.

This package introduces **no new Study Engine**. Content is authored to be Study-compatible: resumable by
lesson segment, with stable IDs, explicit mastery rules, and structured tutor routes that a runtime can
consume the same way it consumes the existing Grade 5/7/8 package.

## Courses

| Grade | Course ID | Units | Lessons | Cadence | Capstone |
| --- | --- | --- | --- | --- | --- |
| 3 | `ma-g3-tech-cs` | 6 | 36 | weekly | A simple, accessible prototype with step-by-step directions, a test note, and a short presentation or demonstration. |
| 4 | `ma-g4-tech-cs` | 6 | 36 | weekly | A user-centered prototype with an algorithm, a test log, an accessibility check, and a presentation. |

## Scope progression

- **Grade 3** — digital citizenship and online safety basics; computer parts and care; typing and file
  organization; patterns, sequences, and introductory (largely unplugged) algorithms; simple data as
  pictures and counts; designing a simple solution for another person.
- **Grade 4** — deeper privacy practice and digital footprints; how computers work and basic
  troubleshooting; productivity and collaboration tools with accessibility features; block-based algorithms
  with loops, conditionals, and debugging; data, media rights, and checking sources (including AI-generated
  content); design thinking for real users.

Both courses use the Michigan K–12 Computer Science standards strands: Computing Systems; Networks and the
Internet; Data and Analysis; Algorithms and Programming; Impacts of Computing. See `standards-map.md`.

## Folder layout

Each `grade-3/` and `grade-4/` folder contains:

- `course-guide.md` — course manifest: description, outcomes, mastery policy, scope-and-sequence table, capstone
- `units.json` — the 6 units, each with standards, essential question, topics, performance task, and lesson refs
- `lessons.jsonl` — one JSON object per lesson (36 total per grade): objectives, five-part lesson flow, student
  activity, formative check, adaptive tutor routes, mastery rule, extension, accessibility, safety/privacy,
  media fallback, guardian visibility, and home connection
- `assessments.json` — one unit assessment per unit with scored prompts, mastery interpretation, and rubric
- `schedule.json` — maps every lesson to a week (1–36) and weekday slot exactly once
- `lesson-sequence.md` — human-readable day-by-day rendering of `lessons.jsonl`

Subject-wide files: `standards-map.md`, `accessibility-and-safety-policy.md`, `projects-and-portfolio.md`,
`manifest.json`.

## Safety boundaries (non-negotiable)

- Never requests a real password, account credential, API key, or account-recovery data. All accounts,
  logins, and systems referenced in lessons are fictional or sandboxed.
- No live exploitation, filter bypass, or probing of real external systems is ever taught or practiced.
- The tutor may explain, demonstrate, and help debug, but may not silently complete a graded project or
  assessment for the learner.

See `accessibility-and-safety-policy.md` for the full policy.
