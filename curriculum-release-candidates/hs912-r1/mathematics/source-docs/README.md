# Manuel Academy High School Mathematics, Grades 9-12

A complete four-course Michigan-aligned high school mathematics progression continuing directly
from the published Grade 8 course.

| Grade | Course | Standards | Credit |
| --- | --- | --- | --- |
| 9 | Algebra and Functions I | 41 | MMC mathematics credit 1 of 4 |
| 10 | Geometry: Congruence, Similarity, and Measurement | 37 | MMC mathematics credit 2 of 4 |
| 11 | Advanced Algebra, Functions, and Statistics | 35 | MMC mathematics credit 3 of 4 |
| 12 | Precalculus and Decision Mathematics | 43 | MMC mathematics credit 4 of 4 (district-determined) |

720 lessons · 40 units · 40 unit assessments · 4 × 180 instructional days · all 156 Michigan high
school mathematics standards mapped exactly once.

## Read these first

| Document | What it establishes |
| --- | --- |
| `standards/standards-custody.md` | Where the standards came from: official michigan.gov URLs, SHA-256 hashes, and the per-domain count reconciliation that verifies the extraction |
| `sequence-derivation.md` | Why the sequence is what it is, derived from the standards and Michigan's credit rule rather than from convention |
| `validation-report.md` | 19/19 automated checks, including prerequisite ordering |
| `mastery-evidence.md` | The mastery, evidence, and reassessment model |
| `standards/standards-map.md` | All 156 standards mapped to course and unit, with verbatim text |

## Layout

```
course-manifest.json              package manifest, course list, credit model
sequence-derivation.md            derivation of the 9-12 sequence
validation-report.md              validation results
mastery-evidence.md               mastery, evidence, reassessment
schemas/lesson.hs.schema.json     lesson schema (v1 fields; grade token widened to 9-12)
standards/
  michigan-hs-mathematics-standards.json   verbatim extracted standards
  standards-custody.md                     source, hashes, verification
  standards-map.md                         standard -> course/unit map
courses/grade-{9,10,11,12}/
  course-guide.md                 course description, outcomes, scope and sequence
  units.json                      10 units: standards, topics, essential question, performance task
  lessons.jsonl                   180 lessons
  assessments.json                10 unit assessments with rubrics and reassessment rules
  lesson-sequence.md              human-readable day-by-day sequence
  course-schedule.csv             day-by-day pacing
```

## Boundaries observed

- The published release `curriculum-content/manuel-academy/1.0.0` — including Grade 8 — is immutable
  and was not modified. It is referenced as the entry prerequisite only.
- No Study Engine, Tutor Core, or shared schema file was changed. Lessons reuse the existing
  five-signal Tutor vocabulary unchanged.
- `schemas/lesson.hs.schema.json` is package-local and differs from the published v1 lesson schema in
  exactly two places: the `grade` enum and the `lesson_id` grade token, both widened to 9-12.

## Status

Draft. This package is locally authored curriculum aligned to published Michigan standards. It is
not a claim of state approval, accreditation, licensure, or automatic credit.
