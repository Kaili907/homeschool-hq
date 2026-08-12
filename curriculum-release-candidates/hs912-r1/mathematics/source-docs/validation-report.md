# High School Mathematics 9-12 — Validation Report

**Package:** `full-family-highschool-9-12:mathematics`
**Validated:** 2026-08-12
**Result:** 19/19 checks pass.

Validation is reproducible from the package itself: every check reads the committed
`units.json`, `lessons.jsonl`, `assessments.json`, `course-schedule.csv`, the extracted standards
inventory, and the published Grade 8 release.

| # | Check | Status | Detail |
| - | --- | --- | --- |
| 1 | Lesson schema conformance (720 lessons vs lesson.hs.schema.json) | **PASS** | 720/720 conform; all required fields, patterns, enums, and minItems satisfied |
| 2 | Standards partition: all 156 mapped exactly once | **PASS** | 156/156 mapped; duplicated=0; unmapped=0; not-in-source=0 |
| 3 | Every course standard resolves to the official extracted inventory | **PASS** | all codes resolve to michigan-hs-mathematics-standards.json |
| 4 | Credit model: G9-11 carry the 113 core standards (Michigan's 3 credits) | **PASS** | G9=(41, 0) G10=(37, 0) G11=(35, 0) (core,plus); core total=113 |
| 5 | Credit model: G12 carries the 43 (+) standards (district-determined 4th credit) | **PASS** | G12 core=0 plus=43 |
| 6 | Lesson ID uniqueness across all four courses | **PASS** | 720 ids, 720 unique |
| 7 | Reference integrity: unit->lesson, unit->assessment, lesson->course | **PASS** | 40 units x 18 lesson refs + 40 assessment refs all resolve |
| 8 | Pacing completeness: 4 x 180 contiguous days, 10 x 18-day units, schedule aligned | **PASS** | 720 scheduled days; every day has exactly one lesson and one schedule row |
| 9 | Assessment correctness: point sums, prompt count, rubric, reassessment, standards match | **PASS** | 40/40 assessments: points sum to 38, 7 prompts, rubric+reassessment present, standards match unit |
| 10 | Mastery: no single-answer mastery; independent evidence on multiple occasions | **PASS** | 720/720 lessons carry the multi-occasion rule; 40/40 assessments deny sole-source mastery |
| 11 | Instruction -> guided practice -> independent evidence preserved in every lesson | **PASS** | 720/720 carry model -> guided -> independent -> exit-ticket flow |
| 12 | No duplicated year: zero standards overlap between any two courses | **PASS** | all 6 course pairs disjoint |
| 13 | No Grade 8 standard is re-taught as high school credit | **PASS** | G8 codes (8.*) appear in no HS unit; HS standards are all high-school codes |
| 14 | Senior year exists and carries substantive mathematics | **PASS** | G12 = 180 lessons, 10 units, 43 advanced (+) standards incl. N-VM (vectors/matrices), N-CN, F-TF, S-MD |
| 15 | Accessibility: no lesson requires media; every lesson has a readable fallback | **PASS** | 720/720 media optional with text-equivalent fallback |
| 16 | No raw learner answer persistence requirement | **PASS** | 720/720 exclude raw answers, raw reflections, voice recordings, and diagnosis language from reporting |
| 17 | Published 1.0.0 release (incl. Grade 8) unmodified | **PASS** | git reports no changes under curriculum-content/ |
| 18 | Tutor: uses only the existing signal vocabulary; Tutor Core unchanged | **PASS** | signals=['correct but low confidence', 'mastery evidence', 'prerequisite gap', 'procedure without understanding', 'repeated error pattern']; identical to the Grade 8 set; no shared Tutor code modified |
| 19 | Prerequisite ordering: no standard precedes a standard it depends on | **PASS** | 20 source-derived dependency pairs checked; 1 co-taught in-unit, rest scheduled strictly earlier |

## What the brief asked to be proven

| Requirement | Where proven |
| --- | --- |
| Grade 8 -> 9 prerequisite handoff | `sequence-derivation.md` sections 3 and 7; the `8.EE.2` and inequality gaps are identified and bridged in Grade 9 Units 1 and 3 |
| 9 -> 10 | Check 19 plus `sequence-derivation.md` section 7: `G-GPE.1/2` depend on Grade 9 quadratics (U05); `G-GPE.4/5` depend on Grade 9 Units 3-4 |
| 10 -> 11 | Check 19: `F-TF.1` depends on `G-C.5`, and `F-TF.5` on `G-SRT.6`, both scheduled in Grade 10 |
| 11 -> 12 | `sequence-derivation.md` section 7: every Grade 12 unit extends a named Grade 11 strand into its `(+)` standards |
| No duplicated year disguised by harder numbers | Checks 12 and 13: zero standards overlap between any two high school courses, and no Grade 8 standard is re-taught for high school credit |
| Official standards traceability | Checks 2 and 3, `standards/standards-custody.md` (source URLs + SHA-256 + per-domain count reconciliation), `standards/standards-map.md` (all 156 mapped) |
| Stable refs | Checks 6 and 7: 720 unique lesson IDs; all unit->lesson, unit->assessment, and lesson->course references resolve |
| Complete pacing | Check 8: 4 x 180 contiguous instructional days, 10 x 18-day units per course, schedule rows aligned to lessons |
| Assessment correctness | Check 9: 40/40 assessments, point sums correct, rubric and reassessment present, standards match their unit |
| Senior-year mathematics exists | Check 14: Grade 12 carries 180 lessons and all 43 Michigan `(+)` standards |
| No raw learner answer persistence requirement | Check 16 |
| Study Engine / Tutor Core not rebuilt | Check 18: lessons reuse the existing five-signal Tutor vocabulary unchanged; no shared Tutor or Study Engine source was modified |

## Prerequisite ordering

Check 19 encodes 20 dependency pairs read directly from the verbatim standard text — for example
`G-GPE.1` ("complete the square to find the center and radius") depends on `A-SSE.3`/`A-REI.4`, and
`F-IF.7e` ("graph ... logarithmic ... and trigonometric functions") depends on `F-LE.4` and `F-TF.5`.
The check fails if any standard is scheduled before something it depends on. Pairs taught inside the
same unit are permitted and are counted separately, because the unit's topic order sequences them.

This check found three genuine ordering defects in the first draft of this package, all corrected:
quadratic algebra was scheduled a year after the geometry standard that requires it; advanced
function graphing preceded the logarithms and trigonometry it graphs; and Grade 12 complex-plane
rotation preceded the angle-addition formulas it uses.

## Scope note

This package adds only `curriculum-authoring/full-family-highschool-9-12/subjects/mathematics/**`.
The published release `curriculum-content/manuel-academy/1.0.0` — which contains Grade 8 — is
immutable and was not modified (check 17). No Study Engine, Tutor Core, or shared schema file was
changed. The one schema deviation is documented and package-local: `schemas/lesson.hs.schema.json`
widens only the `grade` enum and the `lesson_id` grade token to 9-12, leaving every other field
identical to the published v1 lesson schema.
