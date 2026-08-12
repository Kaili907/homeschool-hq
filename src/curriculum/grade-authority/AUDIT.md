# Grade-authority consumer audit

Generated while building `src/curriculum/grade-authority/`, the new canonical
source of truth for which grades Manuel Academy curriculum supports
(`3, 4, 5, 7, 8, 9, 10, 11, 12` — grade 6 excluded on purpose).

This is an **inventory only**. Nothing outside `src/curriculum/grade-authority/`
was modified in this pass. Each row below is a real consumer that
independently hardcodes today's grade set (`5, 7, 8`) or a related grade
vocabulary, found by repo-wide search. A later convergence pass should
migrate these onto the new module one at a time.

The current curriculum release only serves grades 5, 7, 8, so every consumer
below still hardcodes `5, 7, 8`, not the new module's wider target list.
Migrating a consumer to `isSupportedAcademyGrade` / `SUPPORTED_ACADEMY_GRADES`
will, on the day it lands, silently widen that consumer to also accept
9–12 — confirm that's actually intended for that call site before switching
it over, rather than migrating mechanically.

## 1. Type / validation hardcoding

| File | Construct | What it does | Recommended migration |
|---|---|---|---|
| `src/admin/curriculum/contracts.ts:4` | `export type CurriculumGrade = 5 \| 7 \| 8` | Numeric grade union for the admin curriculum read model | Replace with `AcademySupportedGrade` |
| `src/admin/curriculum/readModel.ts:7,17,70-73` | re-exports `CurriculumGrade`; `const SUPPORTED_GRADES = new Set<number>([5, 7, 8])`; `grade()` parses/validates against it | Re-derives the same set as a runtime `Set` independently of contracts.ts | Replace `SUPPORTED_GRADES` with `SUPPORTED_ACADEMY_GRADES`/`isSupportedAcademyGrade`; replace `CurriculumGrade` import with `AcademySupportedGrade` |
| `src/admin/curriculum/CurriculumBrowser.tsx:6,287,390` | imports/uses `CurriculumGrade` | Grade-picker UI state typed off the admin contract | Swap import source once `contracts.ts` migrates |
| `src/admin/curriculum/httpSource.ts:88,130,142,159,178-179` | `const GRADES = new Set([5, 7, 8])`, used across multiple field validators | Validates the `grade` field(s) on lesson/unit/course JSON fetched over HTTP | Replace with `isSupportedAcademyGrade` |
| `src/study/contracts/production/content.ts:38,245,270` | `readonly grade: 5 \| 7 \| 8` (type); `![5, 7, 8].includes(candidate.grade as number)` (validator); `candidate.grade as 5 \| 7 \| 8` (cast) | Learner-safe lesson projection type + its own runtime membership check, independent of `contracts.ts` | Replace literal union with `AcademySupportedGrade`; replace `.includes` check with `isSupportedAcademyGrade` |
| `src/admin/curriculum-validation/model.ts:170-173` | `safeGrade()`: `grade === '5' \|\| grade === '7' \|\| grade === '8'` | Sanitizes an untrusted grade value in curriculum-validation findings | Replace with `isSupportedAcademyGrade` (coerce to number first) |
| `src/curriculum-authoring/v2/v1Importer.node.ts:462,493,601` | `[5, 7, 8].map(...)`, `for (const grade of [5, 7, 8])`, `[5, 7, 8].flatMap(...)` | Drives the v1→v2 importer's per-grade schedule/text-bank/course-directory enumeration (Node build script) | Replace literal array with `SUPPORTED_ACADEMY_GRADES` |
| `src/curriculum/family-pilot/source.node.ts:25` | `const PILOT_GRADES: readonly AcademyGrade[] = ['5', '7', '8']` | Grades the Family Pilot course loader enumerates | Replace with a string-mapped `SUPPORTED_ACADEMY_GRADES` |
| `src/academy/featureFlag.ts:12-14` | `academyGradeOf(grade)`: `grade === '5' \|\| grade === '7' \|\| grade === '8' ? grade : null` | Narrows a nominal `Grade` down to a valid `AcademyGrade` | Replace body with `isSupportedAcademyGrade(Number(grade))` |
| `src/sync/provenance.ts:22-23` | `const GRADES = new Set([...])` (nominal grades) and `const ACADEMY_GRADES = new Set(['5', '7', '8'])` | Sync payload validator — independently re-derives **both** the nominal-grade set and the academy-grade set | Replace `ACADEMY_GRADES` with `SUPPORTED_ACADEMY_GRADES`; highest-drift-risk file in this list since it duplicates two vocabularies in one place |
| `netlify/functions/_shared/anthropic-policy.js:20` | `const GRADES = new Set(['3', '4', '6', '10', '12'])` | Whitelist for the `grade` field on tutor/Jarvis chat requests | **Flag, don't just migrate**: this set excludes 5, 7, 8 (today's actual Academy grades) and 9, 11 entirely — looks like a latent bug where an Academy-grade student's tutor context fails validation today. Needs a decision, not a mechanical swap |
| `netlify/functions/_shared/admin-curriculum-standards-review.js:50` and `src/admin/curriculum-standards-review/httpSource.ts:55,108` | `!Number.isSafeInteger(value.grade) \|\| value.grade < 0 \|\| value.grade > 12` | Range check instead of exact-membership check — accepts 0, 1, 2, 6, 9, 11, etc. | Confirm scope (this endpoint may intentionally cover non-academy grades) before replacing with `isSupportedAcademyGrade` |
| `netlify/functions/_shared/admin-curriculum-integrity.js:545` | `['5', '7', '8'].reduce(...)` reconciling per-grade release counts | Real validation/aggregation logic (separate from the versioned package-id string below) | Replace literal array with a string-mapped `SUPPORTED_ACADEMY_GRADES` |

## 2. Grade-derived ID/lesson-ID token logic (regex duplication — highest priority)

The same course/lesson-ID shape `ma-g(5|7|8)-<subject>[-u##[-l##|-assessment]]`
is hand-written **five separate times**, client and server, TS and JS:

| File | Line(s) | Construct |
|---|---|---|
| `src/academy/academyRoute.ts` | 19-20 | `COURSE_ID = /^ma-g(5\|7\|8)-[a-z-]+$/` and `LESSON_ID = /^ma-g(5\|7\|8)-[a-z-]+-u\d{2}-l\d{2}$/` |
| `src/academy/workingLevel.ts` | 63 | `COURSE_ID = /^ma-g(5\|7\|8)-([a-z-]+)$/` (drops stale enrollment on a working-level change) |
| `src/sync/provenance.ts` | 662 | `ACADEMY_COURSE_ID = /^ma-g(5\|7\|8)-([a-z-]+)$/` (`validateAcademyCourseIds`) |
| `src/admin/curriculum-validation/model.ts` | 176, 182, 188, 194 | Four regexes (`safeCourseRef`, `safeUnitRef`, `safeLessonRef`, `safeAssessmentRef`), each repeating the same grade alternation |
| `netlify/functions/_shared/study-content/resolver.js` | 8 | `LESSON_CONTEXT = /^grade-(5\|7\|8):academy-week-(...)-day-(...)$/` — server-side parser for the `lessonRef` string |

The comment at `workingLevel.ts:61-62` already says this mirrors the other two
copies — the duplication is known, but there's no shared source yet, so
extending the alternation to 9–12 means editing five sites by hand and it is
easy to miss one (`academyRoute.ts` alone has two copies in one file).

**Recommended migration:** have all five sites build their pattern from
`SUPPORTED_ACADEMY_GRADES` via this module's `gradeLessonIdToken` /
`parseGradeFromLessonId`, or export a single shared
`ACADEMY_COURSE_ID_PATTERN` helper from grade-authority once ready.

**Template-literal construction sites** (the encoding side — building
`grade-${grade}` / `ma-g${grade}` tokens; all correct today because they
interpolate an already-typed grade, but all assume the token format this
module now owns): `src/App.tsx:401-402`, `src/study/calendarAdapter.ts:75`,
`src/study/family-pilot/integration/curriculum.ts:58`,
`src/academy/contentClient.ts:45,52`,
`src/academy/adapters/studyContextAdapter.ts:45`, `src/tutor/tutorEngine.ts:39`,
`src/assistant/prompt.ts:47`, `src/curriculum/family-pilot/source.node.ts:123-124`,
`src/admin/curriculum/filesystemSource.node.ts:63,90`,
`src/curriculum-authoring/v2/v1Importer.node.ts:200,463,494,602,604`.
Recommended migration: replace each with `gradeLessonIdToken` / `gradeRouteToken`.

## 3. Route tokens

`src/academy/academyRoute.ts` parses `/academy/course/<COURSE_ID>/unit/<n>/lesson/<LESSON_ID>`
using the `COURSE_ID`/`LESSON_ID` regexes from §2 — the grade lives inside the
course/lesson-ID segment, not as its own path segment, so this is the same
regex-duplication problem as §2 rather than a separate literal route.

## 4. UI dropdowns

| File | Construct | Recommended migration |
|---|---|---|
| `src/components/hub/AcademyLevelsPanel.tsx:29` | `const ACADEMY_LEVELS: AcademyGrade[] = ['5', '7', '8']` — populates the per-subject working-level `<select>` | Replace with a string-mapped `SUPPORTED_ACADEMY_GRADES` |
| `src/components/admin/CurriculumStandardsReviewWorkspace.tsx:175` | inline `{[5, 7, 8].map((value) => <option ...>Grade {value}</option>)}` in the standards-review grade filter | Replace literal array with `SUPPORTED_ACADEMY_GRADES`, label via `gradeLabel` |

(`src/study/family-pilot/auth/FamilyPilotStudentLogin.tsx:253` and
`src/components/PinPad.tsx:56` matched a `['1'…'9']`-shaped grep but are PIN-pad
digit buttons, not grade lists — false positives, no action needed.)

## 5. Per-grade generator file convention (bucket, not enumerated)

`src/curriculum/grade{5,7,8}*Generator.ts` — roughly 54 non-test generator
files (`grade{N}{Subject}Unit{N}Generator.ts`), each with a header comment
like `/** Coverage contract: Grade 8 Mathematics Unit 8 (days 127-144), 8.G.6-8. */`.
Representative examples: `src/curriculum/grade5MathUnit1Generator.ts`,
`src/curriculum/grade7MathUnit4Generator.ts`,
`src/curriculum/grade8MathUnit1Generator.ts`. These encode the grade in the
*filename and doc comment only*, not in exported constants that validate a
grade set — they're content, not logic, so this bucket is a much lower
migration priority than §1/§2 and isn't itemized file-by-file here.

One adjacent site worth flagging: `src/admin/curriculum-standards-review/knownEvidence.ts:15,100-105`
hardcodes a matching `(5, 'ma-g5-physical-education')`, `(7, 'ma-g7-...')`,
`(8, 'ma-g8-...')` enumeration, plus an unrelated
`KNOWN_AMBIGUOUS_MICHIGAN_PE_LABELS = ['2','3','4','5']` (Michigan PE standards
legacy labels — not curriculum grades, do not conflate with the grade set).

## 6. Sibling grade vocabularies (not the 5/7/8 academy set, same disease)

These aren't `AcademySupportedGrade` consumers, but each is an independently
hardcoded grade list that a future, broader convergence should be aware of —
a grade authority that only covers Academy content will still leave these to
drift on their own:

| File | Construct |
|---|---|
| `src/curriculum/parser.ts:44` | `const VALID_GRADES: Grade[] = ['3', '4', '6', '10', '12']` — Family Pilot plan-doc parser whitelist (deliberately excludes 5/7/8, since those are Academy-served; also excludes 9/11 because `Grade` itself can't represent them, see §7) |
| `src/study/family-pilot/tutor/types.ts:14` | `TUTOR_CORE_GRADES: readonly Grade[] = ['3','4','5','6','7','8','10','12']` — grades Tutor Core answers locally, consumed by `gradeLiteral()` in `src/study/family-pilot/tutor/tutorBridge.ts:42-44` |
| `src/reading/passages.ts:23,38` | `export type ReadingGrade = '3' \| '4' \| '6'` and `GRADE_LINE = /^grade:\s*([346])\s*$/` — reading-fluency passage grades, a separate subsystem; consumed by `src/components/reading/ReadingView.tsx:20,53` (`READING_GRADES = ['3', '4', '6']`) |
| `src/migration.ts:6-10,30` | `themeForGrade(grade)` grade-band branching (`'3'\|'4'` vs `'5'…'8'`); `PROFILE_SEEDS` seeds five profiles at grades 3, 4, 6, 10, 12 |
| `src/curriculum/practice/featureFlag.ts:18` | `grade5MathPracticeAvailableFromHost(grade)`: `grade === '5' && ...` — single-grade check, low risk |
| `netlify/functions/_shared/admin-curriculum-integrity.js:11` and `src/admin/curriculum-integrity/httpSource.ts:19` | `PACKAGE_ID = 'manuel-academy-grades-5-7-8-curriculum-v1'` — a versioned content-release label; arguably fine to leave as a historical literal (see §1 for the adjacent `.reduce` logic in the same file, which is a real migration target) |

## 7. Nominal vs. working vs. curriculum-supported grade — what already exists

The codebase already has a well-developed, well-commented three-way
distinction under the `ACADEMY-LEVEL-DECOUPLE` banner. This is the direct
precedent for `src/curriculum/grade-authority/gradeKinds.ts`'s
`NominalStudentGrade` / `resolveWorkingAcademyGrade`:

1. **Nominal grade** — `Profile.grade: Grade` (`src/types.ts:39,132` via the
   `Grade` type). "What she IS" — transcripts, report cards, placement, the
   Status/Today/Picker labels, high-school gating, skill trees, mission
   templates all read it.
2. **Working level** — `Profile.workingLevels?: WorkingLevels`
   (`src/types.ts:74`, `Partial<Record<AcademySubject, AcademyGrade>>`).
   "What she RECEIVES, per subject." Only the Academy reads it.
3. **Curriculum-supported grade** — `AcademyGrade` itself (`src/types.ts:44`,
   currently `'5' | '7' | '8'`) — "grades served by the imported Manuel Academy
   curriculum release." This is the concept `AcademySupportedGrade` supersedes.

Resolution logic lives in `src/academy/workingLevel.ts`:
`workingLevelFor(p, subject): Grade` ("unset subject resolves to the nominal
grade"), `hasExplicitWorkingLevel`, `setWorkingLevel` (mutates only
`workingLevels`), `reconcileEnrollment` (drops stale enrollment on a level
change, using the duplicated `COURSE_ID` regex from §2). The server mirrors
this exactly in `src/sync/provenance.ts:619-658`
(`academyAuthorization`/`validateWorkingLevels`), with its own copy of the
same comment block and its own `GRADES`/`ACADEMY_GRADES` sets (§1).

**Existing bug worth flagging, not fixed here:** `src/types.ts:39` —
`export type Grade = '3' | '4' | '5' | '6' | '7' | '8' | '10' | '12'` — the
app-wide nominal-grade type has no literal for grade 9 or grade 11 at all, so
a nominal grade of 9 or 11 currently can't even be represented. This module's
`NominalStudentGrade` (`1..12`, all twelve grades) is deliberately complete so
it doesn't inherit that gap; migrating `Profile.grade` onto it is a
prerequisite for anything downstream (transcripts, gating, working-level
resolution) to correctly handle students in grades 9 or 11.

Admin analytics has parallel, differently-named fields worth converging on
the same vocabulary during a later pass:
`src/admin/learnerAnalyticsModel.ts` — `LearnerListItem.nominalGrade: Grade`
(line 160), `LearnerListItem.workingLevels: readonly WorkingLevelEvidence[]`
(line 161, `WorkingLevelEvidence.level: Grade`,
`.source: 'explicit' | 'nominal-grade'`, lines 128-131),
`CourseEvidence.workingLevel: Grade | null` (line 179), and
`CurriculumEnrollmentEvidence.grade: Grade` (line 112) — note this last field
is typed as the broad nominal `Grade`, not `AcademyGrade`, despite describing
curriculum enrollment; worth a second look during migration.

## Summary

- **Distinct hardcoding sites counted in §1 (type/validation):** 13
- **Duplicated lesson/course-ID regex sites (§2):** 5
- **Template-literal token construction sites (§2):** 15
- **UI dropdown sites (§4):** 2
- **Sibling (non-Academy) grade vocabularies (§6):** 6
- **Per-grade generator files (§5, bucketed, not itemized):** ~54

No files outside `src/curriculum/grade-authority/` were changed to produce
this report.
