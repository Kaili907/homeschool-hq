# Validation Contract — Manuel Academy High School 9–12

**Contract:** `manuel-academy-high-school-9-12-release-contract`
**Implementation:** `validate-high-school.mjs`
**Tests:** `validate-high-school.test.ts`
**Authored:** 2026-08-12

This document states what a later assembly step must be able to *prove* before
Grades 9–12 may be assembled into a curriculum release, and maps each claim to the
check that proves it. Every claim below is machine-checked. Nothing here relies on
a reviewer reading prose and agreeing.

## Running it

Contract mode — the default. Validates the contract artifacts alone. This is what
runs today, before any subject session has returned.

```bash
node curriculum-authoring/full-family-highschool-9-12/release/validate-high-school.mjs --format operator
```

Assembly mode — additionally validates delivered subject content. This is what runs
once builders return.

```bash
node curriculum-authoring/full-family-highschool-9-12/release/validate-high-school.mjs --mode assembly --format json
```

Tests:

```bash
npx vitest run --config curriculum-authoring/full-family-highschool-9-12/release/validate-high-school.vitest.config.mjs
```

Exit code is `0` when `overall` is `HIGH_SCHOOL_RELEASE_CONTRACT_READY` and `1`
when `BLOCKED`. `--format json` emits a stable machine-readable result carrying
`schemaVersion`, `mode`, `overall`, `blockingCount`, `advisoryCount`,
`derivedCounts` and every `finding`.

The validator is not wired into `package.json`. Ten sessions editing that file
concurrently would collide, and `package.json` is outside this wave's ownership
(`authoring-boundaries.md` §2). Wiring it is a follow-on task for the integration
owner.

## The proof obligations

| # | Claim the assembly validator must prove | Check | Mode |
| --- | --- | --- | --- |
| 1 | Grades 8, 9, 10, 11, 12 are continuous | `checkMatrix` → `GRADE_SPAN_MISMATCH` | contract |
| 2 | No grade is missing for any subject family | `checkMatrix` → `GRADE_MISSING` | contract |
| 3 | No subject-grade slot is filled twice | `checkMatrix` → `GRADE_DUPLICATED`, `COURSE_ID_DUPLICATE` | contract |
| 4 | All expected courses are present | `checkMatrix` → `COUNT_MISMATCH_*`; `runValidation` → `ASSEMBLY_INCOMPLETE` | both |
| 5 | Course IDs are unique and stable | `checkMatrix` → `COURSE_ID_DUPLICATE`, `COURSE_ID_INCONSISTENT` | contract |
| 6 | Unit IDs are unique and well formed | `checkAssembly` → `UNIT_ID_DUPLICATE`, `UNIT_ID_MALFORMED` | assembly |
| 7 | Lesson IDs are unique across the whole release | `checkAssembly` → `LESSON_ID_DUPLICATE` | assembly |
| 8 | Every lesson belongs to exactly one unit | `checkAssembly` → `LESSON_CLAIMED_TWICE`, `LESSON_ORPHANED`, `LESSON_REF_UNRESOLVED` | assembly |
| 9 | Every schedule reference resolves to exactly one lesson | `checkSchedules` → `SCHEDULE_REF_UNRESOLVED`, `SCHEDULE_REF_DUPLICATED` | assembly |
| 10 | Every lesson is scheduled — the reverse direction | `checkSchedules` → `LESSON_UNSCHEDULED`, `SCHEDULE_MISSING` | assembly |
| 11 | Course prerequisites are coherent | `checkMatrix` → `PREREQ_CARDINALITY`, `PREREQ_INCOHERENT`, `PREREQ_UNRESOLVED` | contract |
| 12 | Prerequisites are acyclic | `checkNoPrerequisiteCycle` → `PREREQ_CYCLE` | contract |
| 13 | Grade 8 → 9 has no *unexplained* gap | `checkHandoff` → `HANDOFF_FAMILY_MISSING`, `HANDOFF_RULINGS_INCOMPLETE` | contract |
| 14 | Grade 9 → 10 → 11 → 12 is continuous | claims 2 and 11 together: each course names its own subject one grade below | contract |
| 15 | Standards are traceable | `checkLesson` → `STANDARD_UNTRACEABLE`, `STANDARD_BLANK`; `checkAssembly` → `UNIT_STANDARDS_MISSING` | assembly |
| 16 | An assessment and mastery policy exists | `checkAssembly` → `COURSE_NO_ASSESSMENT`; `checkLesson` → missing `mastery_rule` | assembly |
| 17 | Mastery is evidenced on more than one occasion | `checkAssembly` → `MASTERY_SINGLE_OCCASION` | assembly |
| 18 | Accessibility provision is present and substantive | `checkLesson` → `LESSON_FIELD_INSUFFICIENT` on `accessibility_and_accommodations` (≥5) | assembly |
| 19 | Privacy is protected | `checkLesson` → `PRIVACY_PROHIBITED_REQUEST`; `safety_and_privacy` (≥2) | assembly |
| 20 | Safety rules are carried forward | `checkLesson` → `BODY_ASSESSMENT_PROHIBITED` for health and physical education | assembly |
| 21 | No-media alternatives exist | `checkLesson` → `MEDIA_NO_ALTERNATIVE` | assembly |
| 22 | Structure is Study-compatible | `REQUIRED_LESSON_FIELDS` and `PROTECTED_LESSON_FIELDS` mirror the published lesson contract | assembly |
| 23 | Graduation coverage is ruled on honestly | `checkCoverageMap` → `COVERAGE_VERDICT_UNUSED`, `COVERAGE_WORLD_LANGUAGE_MISSING` | contract |
| 24 | Lesson counts are **not** pinned before builders return | `checkCountsAreNotPinned` → `COUNTS_PINNED_TOO_EARLY` | contract |
| 25 | Two-digit grades are handled correctly | `checkIdGrammar` → `ID_GRAMMAR_ACCEPTS_INVALID`, `ID_GRAMMAR_REJECTS_VALID` | contract |

## Claim 24 in detail — why counts are derived, not asserted

The mission constraint is that no final lesson count may be fixed before the
subject sessions return. The validator therefore does the opposite of the usual
release check: instead of asserting `lessons === 2736` the way
`scripts/build-curriculum.mjs` does for the published release, it

- **derives** `derivedCounts` from what is actually on disk,
- reports `countsAsserted: false` in every result, and
- **fails** if a future edit to `course-matrix.json` replaces
  `units_per_course` or `lessons_per_course` with a number.

Once builders return, the assembly owner reads `derivedCounts` and writes those
observed numbers into the release manifest. That is the correct moment to fix a
count, and it is downstream of this contract.

## Claim 25 in detail — the two-digit-grade trap

Every identifier pattern in the repository today is written for a single grade
digit — `^ma-g(5|7|8)-[a-z-]+$` and its siblings, listed in
`authoring-boundaries.md` §5. Grades 10, 11 and 12 are the first two-digit grades
this programme has ever produced.

The natural but wrong extension is `ma-g(5|7|8|9|10|11|12)-…`, where the alternation
can match a leading `1` and leave the second digit to the subject segment, so
`ma-g1-mathematics` is accepted and a Grade 10 identifier can be mis-parsed. This
validator uses `(?:5|7|8|9|1[0-2])` and `checkIdGrammar` asserts both directions on
every run: valid two-digit ids must be accepted, and `ma-g1-…`, `ma-g13-…`,
`ma-g0-…` must be rejected. If someone later relaxes the pattern, the validator
fails before any content is assembled.

## What this validator deliberately does not check

- **Instructional quality.** Whether a lesson teaches well is a human review.
- **Standards correctness.** The validator proves a cited code appears in the
  family's `standards-coverage.md` registry. It cannot prove the registry itself
  is faithful to the Michigan document; that is the subject session's sourcing
  obligation under `authoring-boundaries.md` §7, and the reason `UNVERIFIED` is an
  accepted, non-blocking value.
- **Credit award or transcript validity.** Out of scope for a curriculum audit.
- **Runtime serving.** Whether the Study runtime can serve Grade 10 depends on the
  shared-file changes in `authoring-boundaries.md` §5, which this wave does not
  perform.

## Current status

Contract mode passes with zero blocking findings. Assembly mode blocks with
`ASSEMBLY_INCOMPLETE`, which is the correct state: no subject session has returned
content yet.
