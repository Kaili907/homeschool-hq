# Validation Contract — Grades 3/4 Release

`validate-grade34.mjs` implements this contract. It is runnable today (against the empty/planned matrix, or against synthetic fixtures — see `validate-grade34.test.ts`) and is meant to be re-run, unmodified in its check list, once subject lanes have authored real content. It mirrors the check categories in `curriculum-content/manuel-academy/1.0.0/validation/validation-report.md` so the two validation reports read the same way.

## Required checks

| Check | Rule |
| --- | --- |
| `two-grades` | Course set covers exactly grades `[3, 4]`, no others. |
| `ten-courses-per-grade` | Each grade has exactly 10 courses, one per subject in the canonical subject list. |
| `course-count` | Total courses == 20. |
| `unique-course-ids` | Every `course_id` is unique across the whole set. |
| `unique-unit-ids` | Every `unit_id` is unique across the whole set (once units exist). |
| `unique-lesson-ids` | Every `lesson_id` is unique across the whole set (once lessons exist), and matches the grade34 lesson-id pattern `^ma-g(3\|4)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$`. |
| `schedule-covers-every-lesson-once` | Every lesson referenced by a 36-week schedule resolves to exactly one lesson record, and every lesson record appears in the schedule exactly once (no gaps, no duplicates). |
| `week-coverage` | Each course's schedule spans exactly 36 weeks. |
| `lesson-schema-compatibility` | Every lesson record validates against `lesson-schema.json`. |
| `required-standards-and-objectives` | Every lesson has ≥1 `standards` entry with a `mapping_status`, and ≥3 `learning_objectives`. |
| `accessibility-depth` | Every lesson has ≥5 `accessibility_and_accommodations` entries. |
| `no-media-path` | Every lesson's `accessibility_and_accommodations` names a text/transcript/description/demonstration fallback (keyword/heuristic check — human review still required). |
| `safety-privacy-depth` | Every lesson has ≥2 `safety_and_privacy` entries. |
| `safety-privacy-content` | No `safety_and_privacy` entry requires photo, voice, precise location, diagnosis, medical history, family income, faith disclosure, immigration status, real credentials, card numbers, tax IDs, or private messages, per `policies/instruction-mastery-accessibility-safety.md` (keyword/heuristic scan that ignores boilerplate prohibitions like "no photo required" — human review still required for phrasing it doesn't catch). |
| `multi-occasion-mastery` | Every lesson's `mastery_rule` text reflects multiple evidence occasions, not a single-answer check (keyword/heuristic check — human review still required). |
| `standards-mapping-status-reported` | The run reports a count of `canonical` / `unverified` / `human-review` standards entries; it does not silently pass content with unreviewed mappings — it surfaces the count so convergence can decide whether the ratio is acceptable. |

## Explicit non-goals of the validator

- It does not assert specific unit/lesson counts — those are unknown until subject lanes report them (`course-matrix.json` counts are `null` by design).
- It does not verify standard codes against the live Michigan sources itself (no network access assumed at validation time) — it only checks that every standards entry declares a `mapping_status` and rolls up the counts.
- It does not check production-host integration, external accreditation, or third-party licensing — same scope limit the 1.0.0 validation report already states.

## Inputs

The validator accepts a root directory (default: `curriculum-authoring/full-family-grade34/`) and expects, once subject lanes exist:
- `subjects/<subject>/grade-<n>/course.json` (or equivalent — see subject lane's own manifest) contributing to the aggregate course/unit/lesson/schedule set.
- Falls back to `release/course-matrix.json` alone (today's state) and reports `INCOMPLETE — no subject content found` rather than a false pass, when no subject directories exist yet.

## Output

A structured report (JSON + human-readable table), same PASS/FAIL-per-check shape as `curriculum-content/manuel-academy/1.0.0/validation/validation-report.md`, plus an explicit `overall` of `PASS`, `FAIL`, or `INCOMPLETE`.
