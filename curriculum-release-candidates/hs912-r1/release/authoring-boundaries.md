# Authoring Boundaries — Manuel Academy High School 9–12

**Contract:** `manuel-academy-high-school-9-12-release-contract`
**Authored:** 2026-08-12
**Owner of this file:** `mac/hs912-release-r1`

This document is the ownership and non-interference contract for the Grades 9–12
authoring wave. It binds every session in the wave, including this one.

## 1. Directory ownership

```
curriculum-authoring/full-family-highschool-9-12/
├── release/                       ← OWNED BY mac/hs912-release-r1 (this session)
├── mathematics/                   ← mac/hs912-math-r1
├── english-language-arts/         ← mac/hs912-ela-r1
├── science/                       ← mac/hs912-science-r1
├── social-studies/                ← mac/hs912-social-studies-r1
├── health/                        ← mac/hs912-health-pe-r1
├── physical-education/            ← mac/hs912-health-pe-r1
├── ready-for-life/                ← mac/hs912-rfl-finlit-r1
├── financial-literacy/            ← mac/hs912-rfl-finlit-r1
├── technology/                    ← mac/hs912-tech-arts-r1
└── arts-and-music/                ← mac/hs912-tech-arts-r1
```

One directory per **subject family**, not per session. Two sessions each own two
families; each family still gets its own directory so that a later assembly can
attribute every file to exactly one family without parsing branch names.

A session writes only inside the directories listed against its branch. No session
writes into `release/`. This session writes only into `release/` and reads
everything else.

### Directory shape expected of each subject family

```
curriculum-authoring/full-family-highschool-9-12/<subject>/
├── subject-overview.md            # exit/entry expectations, sequence rationale
├── standards-coverage.md          # verbatim codes from the official document
└── grade-9/ grade-10/ grade-11/ grade-12/
    ├── course-guide.md
    ├── units.json
    ├── lessons.jsonl
    ├── assessments.json
    └── lesson-sequence.md
```

This mirrors the published Grade 8 layout
(`curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/<subject>/`) so a
later assembly step is a move plus an index rebuild, not a reshape.

## 2. Files that must not be touched

| Path | Rule |
| --- | --- |
| `curriculum-content/manuel-academy/1.0.0/**` | **READ-ONLY.** Published release. No session in this wave edits, renames, reorders, or re-indexes any file here. |
| `adaptive-tutor/**` | Study Engine. Not rebuilt, not modified by this wave. |
| `src/**`, `netlify/**`, `supabase/**` | Runtime and data plane. Not modified by this wave. |
| `package.json`, `vite.config.ts`, `scripts/**` | Shared build surface. Ten sessions editing these concurrently would collide. See §5. |
| `curriculum-content/manuel-academy/production-release-registry.json` | Activation control. Changing it activates content; that is a release action, not an authoring action. |

## 3. What this wave does *not* produce

- **No subject content is authored in `release/`.** This session produces the
  contract, matrix, coverage audit, and validator only. Every unit, lesson, and
  assessment belongs to a subject session.
- **No lesson counts are fixed in advance.** `course-matrix.json` records
  recommended session counts and credit, and deliberately leaves units and lessons
  unbound. The validator derives actual counts from what builders return and checks
  internal consistency instead of asserting a pre-agreed total.
- **No new subject family is created.** Adding an eleventh family (see the World
  Language finding in `credit-coverage-map.md`) is a Director decision with runtime
  consequences described in §5, not something a subject session may do unilaterally.

## 4. Identifier ownership

Course, unit, lesson, and assessment identifiers are allocated centrally by
`course-matrix.json` and extended by a fixed rule. Subject sessions do not invent
course IDs.

```
course      ma-g<grade>-<subject>
unit        ma-g<grade>-<subject>-u<NN>          NN = 01..99, zero padded
lesson      ma-g<grade>-<subject>-u<NN>-l<NN>
assessment  ma-g<grade>-<subject>-u<NN>-assessment
```

`<grade>` is `9`, `10`, `11`, or `12` for this wave. Two-digit grades are new:
every existing runtime pattern in the repository is written against single-digit
grades `5|7|8` and will not match `ma-g10-…`. See §5.

Identifiers are **stable**: once a builder returns a course, its IDs do not change.
Renaming a course changes its `course_name`, never its `course_id`.

## 5. Downstream obligations this wave creates but must not perform

Grades 9–12 cannot be served by the current runtime as written. The following are
recorded here as required follow-on work for the integration owner. **No session in
this wave performs them**, because they all live in shared files outside this
wave's ownership.

| Location | Current state | Required change |
| --- | --- | --- |
| `src/types.ts:44` | `AcademyGrade = '5' \| '7' \| '8'` | Extend to include `'9' \| '10' \| '11' \| '12'` |
| `src/types.ts` `ACADEMY_SUBJECTS` | Closed 10-subject tuple | Only changes if a World Language family is approved |
| `src/study/contracts/production/content.ts:38,245,270` | `grade: 5 \| 7 \| 8`, `[5,7,8].includes(...)` | Extend grade union and guard |
| `src/admin/curriculum/contracts.ts:4` | `CurriculumGrade = 5 \| 7 \| 8` | Extend |
| `src/admin/curriculum/httpSource.ts:88` | `new Set([5,7,8])` | Extend |
| `src/admin/curriculum/readModel.ts:17` | `SUPPORTED_GRADES` | Extend |
| `src/admin/curriculum-validation/model.ts:176,182,188,194` | `^ma-g(?:5\|7\|8)-…` | Extend to `^ma-g(?:5\|7\|8\|9\|1[0-2])-…` |
| `src/academy/academyRoute.ts:19,20` | `^ma-g(5\|7\|8)-…` | Extend, two-digit safe |
| `src/academy/workingLevel.ts:63,128` | `^ma-g(5\|7\|8)-…`, `['5','7','8']` | Extend |
| `src/curriculum/family-pilot/source.node.ts:25` | `PILOT_GRADES = ['5','7','8']` | Extend |
| `curriculum-content/…/schemas/lesson.schema.json` | `grade` enum `[5,7,8]`; `lesson_id` pattern `^ma-g(5\|7\|8)-…` | A new schema version for the 9–12 release |
| `scripts/build-curriculum.mjs:~40` | `EXPECTED = { courses: 30, units: 232, lessons: 2736, grades: ['5','7','8'] }` | Recompute after builders return |
| `curriculum-content/manuel-academy/production-release-registry.json` | Single active release `1.0.0` | A new release version, activated deliberately |

Every regular expression in that list is written for a single grade digit. A
naive edit that appends `|9|10` to `ma-g(5|7|8)` produces a pattern where the `1`
of `10` can be consumed as a separate alternative in some engines; use
`(?:5|7|8|9|1[0-2])` and anchor it. `validate-high-school.mjs` checks the
identifier grammar independently so this class of mistake fails loudly rather
than silently dropping Grade 10.

## 6. Coordination protocol

1. `git fetch origin --prune` before starting and before publishing.
2. Check `origin/mac/hs912-*` and `origin/win/*` for a branch that already owns
   your directory. Stop if one exists.
3. Never rebase or force-push another session's branch.
4. If a subject session needs a change to `course-matrix.json`, it opens the request
   against `mac/hs912-release-r1` rather than editing the file.

## 7. Standards sourcing rules (binding on every subject session)

- Cite the **official Michigan Department of Education** document. Vendor mappings,
  homeschool blogs, and third-party alignment charts are not authority.
- Copy standards codes **verbatim** from the official document. Do not construct,
  guess, extrapolate, or pattern-match a code that you have not seen.
- If an exact code cannot be verified against an official source, record it as
  `UNVERIFIED` with a note describing what was attempted. An honest `UNVERIFIED`
  is acceptable; a plausible invented code is a contract violation.
- Distinguish the three classifications in every claim: `STATE_REQUIREMENT`,
  `STATE_STANDARD`, `MANUEL_ACADEMY_COURSE_DESIGN_DECISION`.
- Do not make legal claims about homeschool graduation law, diploma validity,
  accreditation, or credit recognition. This wave produces a curriculum and
  coverage design, not a legal opinion.
