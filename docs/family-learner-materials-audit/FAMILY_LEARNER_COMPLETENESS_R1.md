# Family Learner Materials Completeness Audit R1

## Ruling

**FAMILY_LEARNER_MATERIALS_AUDIT_COMPLETE — release is not learner-complete for normal end-to-end family use.** All 8,292 active lesson packages exist, but production-file coverage masks learner-content and browser-path defects. No course is classified complete because the final app wires no learner response type and exposes none of the 699 unit assessments through a learner workflow.

The practical start ruling is narrower: Mathematics and English Language Arts are **DO_NOT_BEGIN_YET** in every supported grade. The other subject families may begin only with the specific paper/off-screen, source, safety, scoring, and later-assessment limitations recorded below.

## Scope and provenance

- Audited release SHA: `c81ddb6e04bc1c3629212327d47817c1b5677477`
- Audit-tool base SHA: `c81ddb6e04bc1c3629212327d47817c1b5677477`
- Admitted release: `curriculum-release-admitted/family-pilot-r1`
- Population: 90 courses, 8,292 active lessons, 699 assessment records
- Grades: 3, 4, 5, 7, 8, 9, 10, 11, 12; Grade 6 remains unsupported as a curriculum grade
- Production source SHAs: `00374a8dc26eddfac2cf52aec5661deff760ddbb` (1,620 lessons); `12d78e0f2d683b6a87321d096ec7cee627119622` (984 lessons); `7eeb4b7bf258800c9ecfa8eb4873544d604f4d63` (1,620 lessons); `8a6fd925e71f8f83035229df5fbcd099e9e24856` (324 lessons); `9f00acefc4d73b7efa29be7e4e49a3a8c3b0a9fa` (504 lessons); `a03811a6647409bff068c034b67a0140720a77fc` (972 lessons); `b8e9611ec37c5e66820f0efd2461d7cd2daa6807` (972 lessons); `c523a0c9748b340a871493afbf51276759d406ce` (1,296 lessons)
- Manual stratified review ledger: 450 selections (five per grade × subject/course), listed below

## Definitions

**Actionable learner work** requires an executable learner action that produces observable evidence: solving, selecting, writing, explaining, reading and responding, investigating, classifying, creating, performing, simulating, demonstrating, revising, or analyzing. A project, physical activity, simulation, source analysis, or performance is valid without conventional questions when its steps/evidence contract is specific. A direction to “attempt today’s lesson” or “complete a new application of today’s lesson” without the actual task is not actionable.

**Projection loss** compares every source production package with the exact in-memory behavior of `scripts/build-final-family-pilot-data.mjs`. For structured JSON, the browser DTO retains headings, bodies, and prompt strings but not selectable choices, prompt/response kinds, task objects, rubric objects, or response controls. Markdown is preserved as text but rendered in a pre-wrapped display-only block.

## Headline counts

- Learner-complete courses: **0**
- Complete-with-advisories courses: **0**
- Incomplete/blocked courses: **90**
- Zero-actionable lessons: **540**
- Questionable-actionable lessons: **2**
- Empty mastery checks: **8**
- Empty independent-practice sections: **3**
- Empty assessment sections inside lesson packages: **0**
- Assessment records with no usable production learner material: **564**
- Lessons with lost choice structure: **1888**
- Placeholder/filler lessons: **540** (strict TODO/TBD/FIXME residue is zero; these are generic ELA meta-task shells)
- Adult answer/scoring leaks in browser learner material: **0**
- Source-readiness issue/limitation lessons: **1052**
- Attestation equal-credit-path issues: **0** across 81 guardian-authority lessons
- Disconnected response-path lessons: **8292**

## Grade results

| Grade | Courses | Lessons | Actionable | Zero action | Empty mastery | Choice loss | Filler | Source issues |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 10 | 900 | 890 | 10 | 5 | 207 | 10 | 172 |
| 4 | 10 | 900 | 890 | 10 | 3 | 200 | 10 | 160 |
| 5 | 10 | 900 | 740 | 160 | 0 | 187 | 160 | 0 |
| 7 | 10 | 900 | 740 | 160 | 0 | 192 | 160 | 0 |
| 8 | 10 | 936 | 776 | 160 | 0 | 185 | 160 | 0 |
| 9 | 10 | 936 | 926 | 10 | 0 | 244 | 10 | 180 |
| 10 | 10 | 936 | 926 | 10 | 0 | 219 | 10 | 180 |
| 11 | 10 | 936 | 926 | 10 | 0 | 240 | 10 | 180 |
| 12 | 10 | 948 | 938 | 10 | 0 | 214 | 10 | 180 |

Each grade’s first ten worst defects are recorded in `grade-subject-matrix.json`; every grade × subject cell also contains its first ten.

## Subject results

| Subject | Courses | Lessons | Actionable | Zero action | Empty mastery | Choice loss | Filler | Source issues |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mathematics | 9 | 1620 | 1620 | 0 | 8 | 1619 | 0 | 0 |
| english-language-arts | 9 | 1620 | 1080 | 540 | 0 | 0 | 540 | 1040 |
| science | 9 | 972 | 972 | 0 | 0 | 0 | 0 | 0 |
| social-studies | 9 | 972 | 972 | 0 | 0 | 0 | 0 | 12 |
| health | 9 | 324 | 324 | 0 | 0 | 0 | 0 | 0 |
| physical-education | 9 | 972 | 972 | 0 | 0 | 0 | 0 | 0 |
| ready-for-life | 9 | 324 | 324 | 0 | 0 | 46 | 0 | 0 |
| financial-literacy | 9 | 504 | 504 | 0 | 0 | 223 | 0 | 0 |
| technology | 9 | 336 | 336 | 0 | 0 | 0 | 0 | 0 |
| arts-and-music | 9 | 648 | 648 | 0 | 0 | 0 | 0 | 0 |

## Course readiness

| Course | Readiness | Safe to begin | Zero action | Empty sections | Choice loss | Usable assessments |
| --- | --- | --- | --- | --- | --- | --- |
| ma-g3-arts-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g3-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 10 | 0 | 0 | 0/10 |
| ma-g3-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 27 | 0/6 |
| ma-g3-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g3-mathematics | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 0 | 8 | 180 | 0/10 |
| ma-g3-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g3-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g3-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g3-social-studies | BLOCKED_BY_MISSING_SOURCE | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g3-tech-cs | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g4-arts-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g4-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 10 | 0 | 0 | 0/10 |
| ma-g4-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 10 | 0/6 |
| ma-g4-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g4-mathematics | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 0 | 3 | 180 | 0/10 |
| ma-g4-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g4-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 10 | 0/6 |
| ma-g4-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g4-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g4-tech-cs | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g5-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g5-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 160 | 0 | 0 | 0/10 |
| ma-g5-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 7 | 0/6 |
| ma-g5-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g5-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 180 | 0/10 |
| ma-g5-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g5-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g5-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g5-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g5-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g7-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g7-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 160 | 0 | 0 | 0/10 |
| ma-g7-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 4 | 0/6 |
| ma-g7-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g7-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 180 | 0/10 |
| ma-g7-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g7-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 8 | 0/6 |
| ma-g7-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g7-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g7-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g8-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g8-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 160 | 0 | 0 | 0/10 |
| ma-g8-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 2 | 0/7 |
| ma-g8-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g8-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 179 | 0/11 |
| ma-g8-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g8-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 4 | 0/6 |
| ma-g8-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g8-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g8-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g9-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g9-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 10 | 0 | 0 | 0/10 |
| ma-g9-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 45 | 0/7 |
| ma-g9-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g9-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 180 | 0/10 |
| ma-g9-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g9-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 19 | 0/6 |
| ma-g9-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g9-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g9-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g10-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g10-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 10 | 0 | 0 | 0/10 |
| ma-g10-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 38 | 0/7 |
| ma-g10-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g10-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 180 | 0/10 |
| ma-g10-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g10-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 1 | 0/6 |
| ma-g10-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g10-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g10-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g11-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g11-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 10 | 0 | 0 | 0/10 |
| ma-g11-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 56 | 0/7 |
| ma-g11-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g11-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 180 | 0/10 |
| ma-g11-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g11-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 4 | 0/6 |
| ma-g11-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g11-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g11-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g12-arts-and-music | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g12-english-language-arts | BLOCKED_BY_CONTENT | DO_NOT_BEGIN_YET | 10 | 0 | 0 | 0/10 |
| ma-g12-financial-literacy | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 34 | 0/7 |
| ma-g12-health | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g12-mathematics | BLOCKED_BY_RENDERER | DO_NOT_BEGIN_YET | 0 | 0 | 180 | 0/10 |
| ma-g12-physical-education | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g12-ready-for-life | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |
| ma-g12-science | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g12-social-studies | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/9 |
| ma-g12-technology | BLOCKED_BY_RENDERER | SAFE_WITH_SPECIFIC_LIMITATION | 0 | 0 | 0 | 0/6 |

## Empty promised sections

| Lesson | Classification | Section | Directions |
| --- | --- | --- | --- |
| ma-g3-mathematics-u01-l01 | EMPTY_MASTERY_CHECK | Mastery check | Show what you can do so far. This sets the starting point, not a grade. |
| ma-g3-mathematics-u09-l01 | EMPTY_MASTERY_CHECK | Mastery check | Show what you can do so far. This sets the starting point, not a grade. |
| ma-g3-mathematics-u09-l02 | EMPTY_INDEPENDENT_PRACTICE | Independent practice | Work on your own. Show the steps that produced each answer. |
| ma-g3-mathematics-u09-l02 | EMPTY_MASTERY_CHECK | Mastery check | Mastery check. Work without help, then stop and hand this section in. |
| ma-g3-mathematics-u10-l06 | EMPTY_MASTERY_CHECK | Mastery check | Mastery check. Work without help, then stop and hand this section in. |
| ma-g3-mathematics-u10-l07 | EMPTY_INDEPENDENT_PRACTICE | Independent practice | Work on your own. Show the steps that produced each answer. |
| ma-g3-mathematics-u10-l07 | EMPTY_MASTERY_CHECK | Mastery check | Mastery check. Work without help, then stop and hand this section in. |
| ma-g3-mathematics-u10-l08 | EMPTY_INDEPENDENT_PRACTICE | Independent practice | Work on your own. Show the steps that produced each answer. |
| ma-g4-mathematics-u01-l01 | EMPTY_MASTERY_CHECK | Mastery check | Show what you can do so far. This sets the starting point, not a grade. |
| ma-g4-mathematics-u10-l02 | EMPTY_MASTERY_CHECK | Mastery check | Mastery check. Work without help, then stop and hand this section in. |
| ma-g4-mathematics-u10-l03 | EMPTY_MASTERY_CHECK | Mastery check | Mastery check. Work without help, then stop and hand this section in. |

## Mathematics special finding

The defect class seen in `ma-g3-mathematics-u01-l01` also occurs in `ma-g4-mathematics-u01-l01`: both diagnostics contain only mathematical-habits/strategy-choice prompts and an empty mastery check. Across Math, 8 mastery checks and 3 independent-practice sections promise work with zero items. Choice structure is lost in 1619 Math lessons (13,179 choice items); the final UI treats every segment as `responseKind: 'none'`.

| Lesson | Grade | Title | Actionable class | Key codes |
| --- | --- | --- | --- | --- |
| ma-g3-mathematics-u01-l01 | 3 | Launch and diagnostic: making sense of unfamiliar problems | QUESTIONABLE_ACTIONABLE_WORK | MATH_STRATEGY_ONLY_DIAGNOSTIC, EMPTY_MASTERY_CHECK |
| ma-g3-mathematics-u09-l01 | 3 | Launch and diagnostic: covering a surface without gaps or overlaps | ACTIONABLE_QUESTION_SET | EMPTY_MASTERY_CHECK |
| ma-g3-mathematics-u09-l02 | 3 | Concept build A: unit squares and area as a count of squares | ACTIONABLE_QUESTION_SET | EMPTY_INDEPENDENT_PRACTICE, EMPTY_MASTERY_CHECK |
| ma-g3-mathematics-u10-l06 | 3 | Concept build C: categories of quadrilaterals and their attributes | ACTIONABLE_QUESTION_SET | EMPTY_MASTERY_CHECK |
| ma-g3-mathematics-u10-l07 | 3 | Guided practice B: attributes shared across shape categories | ACTIONABLE_QUESTION_SET | EMPTY_INDEPENDENT_PRACTICE, EMPTY_MASTERY_CHECK |
| ma-g3-mathematics-u10-l08 | 3 | Error analysis and repair: classification-by-appearance errors | ACTIONABLE_QUESTION_SET | EMPTY_INDEPENDENT_PRACTICE |
| ma-g4-mathematics-u01-l01 | 4 | Launch and diagnostic: making sense of large numbers and unfamiliar problems | QUESTIONABLE_ACTIONABLE_WORK | MATH_STRATEGY_ONLY_DIAGNOSTIC, EMPTY_MASTERY_CHECK |
| ma-g4-mathematics-u10-l02 | 4 | Concept build A: angles as fractions of a circular turn | ACTIONABLE_QUESTION_SET | EMPTY_MASTERY_CHECK |
| ma-g4-mathematics-u10-l03 | 4 | Concept build B: measuring angles with a protractor | ACTIONABLE_QUESTION_SET | EMPTY_MASTERY_CHECK |

## Browser projection and renderer readiness

**Result: FAIL_LOSSY_AND_DISPLAY_ONLY.** The final browser DTO has no choice or response model. `MaterialView` renders structured prompts as list items and markdown as pre-wrapped text. `LessonSurface` always passes `responseKind: 'none'`, so the Lesson Player’s existing text/choice controls are disconnected for all 8,292 admitted lessons.

| Subject | Source/browser sections | Source/browser display items | Choice items kept | Interactive types | Disconnected lessons |
| --- | --- | --- | --- | --- | --- |
| mathematics | 5131/5131 | 15937/19500 | 0/13179 | 0 | 1620 |
| english-language-arts | 9680/8640 | 4028/0 | 0/0 | 0 | 1620 |
| science | 6804/6804 | 6948/6948 | 0/0 | 0 | 972 |
| social-studies | 7776/7776 | 1944/1944 | 0/0 | 0 | 972 |
| health | 1944/3636 | 972/5904 | 0/0 | 0 | 324 |
| physical-education | 5832/10152 | 2916/18744 | 0/0 | 0 | 972 |
| ready-for-life | 1283/3269 | 1987/3161 | 0/64 | 0 | 324 |
| financial-literacy | 1740/4764 | 3632/6199 | 0/237 | 0 | 504 |
| technology | 1788/5484 | 1164/12195 | 0/0 | 0 | 336 |
| arts-and-music | 3456/10584 | 2538/23836 | 0/0 | 0 | 648 |

The full item-type matrix, source/browser counts, task/rubric preservation counts, and alternate-surface requirements are in `browser-projection-loss.json`.

## Assessment readiness

- Assessment records: **699**
- BOUND production learner packages: **135**
- STRUCTURAL_ONLY records: **564**
- Usable source learner material: **135**
- Scoring-authority references present: **699**
- Linked to final browser learner workflow: **0**
- Usable in normal end-to-end final-app school use: **0**

The 135 bound Health/PE assessment packages exist and contain evidence tasks, but the final browser DTO and Family Pilot routes do not load, assign, play, submit, or score assessment records. The other 564 records have no production learner assessment package. Existing “READY”/fallback metadata is therefore not proof of a usable learner assessment.

## Diagnostics and progression

Diagnostic/baseline/mastery terms are inspected per lesson in `lesson-findings.jsonl`. Diagnostics are recorded as starting-point or lesson evidence only; this audit found no final-app path that changes an official working level from these materials. The two Math strategy-only diagnostics cannot measure subject ability as titled.

Exact actionable-task hashing found 33 cross-grade groups. The largest is an identical 480-lesson ELA shell across Grades 5, 7, and 8. Other repeated ELA tasks cross Grades 9–12, and smaller Science/Social Studies groups repeat exact tasks across grades. These are progression advisories or blockers where the task is also generic; safety/rubric boilerplate was excluded from the fingerprints.

## Safe-to-begin matrix

| Grade | mathematics | english-language-arts | science | social-studies | health | physical-education | ready-for-life | financial-literacy | technology | arts-and-music |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 4 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 5 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 7 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 8 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 9 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 10 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 11 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |
| 12 | DO_NOT_BEGIN_YET | DO_NOT_BEGIN_YET | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION | SAFE_WITH_SPECIFIC_LIMITATION |

No cell is marked `SAFE_TO_BEGIN_NOW` because every subject lacks in-app response capture and every course eventually reaches an unavailable unit-assessment workflow. Cell-specific limitations are in `grade-subject-matrix.json`.

## Top blockers

| Finding code | Affected lessons |
| --- | --- |
| RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP | 8292 |
| GENERIC_NEW_APPLICATION_TASK_SHELL | 1676 |
| ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE | 1620 |
| CHOICES_FLATTENED_TO_DISPLAY_TEXT | 1619 |
| ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION | 1040 |
| CROSS_GRADE_EXACT_ACTIONABLE_TASK | 893 |
| GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK | 540 |
| SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP | 540 |
| CHOICES_DROPPED_FROM_BROWSER_STRUCTURE | 269 |
| PENDING_SOURCE_ATTACHMENT | 12 |
| EMPTY_MASTERY_CHECK | 8 |
| DECLARED_PHASE_TITLE_MISMATCH | 3 |
| EMPTY_INDEPENDENT_PRACTICE | 3 |
| MATH_STRATEGY_ONLY_DIAGNOSTIC | 2 |

## Manual stratified sample ledger

The five deterministic strata are first lesson, first concept-build lesson, mid-course lesson, first assessment/performance/mastery/application/publication lesson (or penultimate fallback), and final-course lesson. This ledger supports manual source review without substituting for the full 8,292-lesson machine audit.

| Course | Stratum | Lesson | Actionable class | Finding codes |
| --- | --- | --- | --- | --- |
| ma-g3-arts-music | first-lesson | ma-g3-arts-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-arts-music | first-concept-build | ma-g3-arts-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-arts-music | mid-course | ma-g3-arts-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-arts-music | assessment-or-performance | ma-g3-arts-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-arts-music | final-course | ma-g3-arts-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-english-language-arts | first-lesson | ma-g3-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-english-language-arts | first-concept-build | ma-g3-english-language-arts-u01-l03 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-english-language-arts | mid-course | ma-g3-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-english-language-arts | assessment-or-performance | ma-g3-english-language-arts-u01-l17 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-english-language-arts | final-course | ma-g3-english-language-arts-u10-l18 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-financial-literacy | first-lesson | ma-g3-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-financial-literacy | first-concept-build | ma-g3-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-financial-literacy | mid-course | ma-g3-financial-literacy-u04-l01 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-financial-literacy | assessment-or-performance | ma-g3-financial-literacy-u01-l04 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-financial-literacy | final-course | ma-g3-financial-literacy-u06-l06 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-health | first-lesson | ma-g3-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-health | first-concept-build | ma-g3-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-health | mid-course | ma-g3-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-health | assessment-or-performance | ma-g3-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-health | final-course | ma-g3-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-mathematics | first-lesson | ma-g3-mathematics-u01-l01 | QUESTIONABLE_ACTIONABLE_WORK | MATH_STRATEGY_ONLY_DIAGNOSTIC, EMPTY_MASTERY_CHECK, CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-mathematics | first-concept-build | ma-g3-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-mathematics | mid-course | ma-g3-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-mathematics | assessment-or-performance | ma-g3-mathematics-u01-l13 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-mathematics | final-course | ma-g3-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-physical-education | first-lesson | ma-g3-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-physical-education | first-concept-build | ma-g3-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-physical-education | mid-course | ma-g3-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-physical-education | assessment-or-performance | ma-g3-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-physical-education | final-course | ma-g3-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-ready-for-life | first-lesson | ma-g3-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-ready-for-life | first-concept-build | ma-g3-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-ready-for-life | mid-course | ma-g3-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-ready-for-life | assessment-or-performance | ma-g3-ready-for-life-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-ready-for-life | final-course | ma-g3-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-science | first-lesson | ma-g3-science-u01-l01 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g3-science | first-concept-build | ma-g3-science-u01-l02 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g3-science | mid-course | ma-g3-science-u05-l07 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-science | assessment-or-performance | ma-g3-science-u01-l09 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-science | final-course | ma-g3-science-u09-l12 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-social-studies | first-lesson | ma-g3-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-social-studies | first-concept-build | ma-g3-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-social-studies | mid-course | ma-g3-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-social-studies | assessment-or-performance | ma-g3-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-social-studies | final-course | ma-g3-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | PENDING_SOURCE_ATTACHMENT, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g3-tech-cs | first-lesson | ma-g3-tech-cs-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-tech-cs | first-concept-build | ma-g3-tech-cs-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-tech-cs | mid-course | ma-g3-tech-cs-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-tech-cs | assessment-or-performance | ma-g3-tech-cs-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g3-tech-cs | final-course | ma-g3-tech-cs-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-arts-music | first-lesson | ma-g4-arts-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-arts-music | first-concept-build | ma-g4-arts-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-arts-music | mid-course | ma-g4-arts-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-arts-music | assessment-or-performance | ma-g4-arts-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-arts-music | final-course | ma-g4-arts-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-english-language-arts | first-lesson | ma-g4-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-english-language-arts | first-concept-build | ma-g4-english-language-arts-u01-l03 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-english-language-arts | mid-course | ma-g4-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-english-language-arts | assessment-or-performance | ma-g4-english-language-arts-u01-l16 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-english-language-arts | final-course | ma-g4-english-language-arts-u10-l18 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-financial-literacy | first-lesson | ma-g4-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-financial-literacy | first-concept-build | ma-g4-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-financial-literacy | mid-course | ma-g4-financial-literacy-u04-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-financial-literacy | assessment-or-performance | ma-g4-financial-literacy-u01-l04 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-financial-literacy | final-course | ma-g4-financial-literacy-u06-l06 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-health | first-lesson | ma-g4-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-health | first-concept-build | ma-g4-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-health | mid-course | ma-g4-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-health | assessment-or-performance | ma-g4-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-health | final-course | ma-g4-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-mathematics | first-lesson | ma-g4-mathematics-u01-l01 | QUESTIONABLE_ACTIONABLE_WORK | MATH_STRATEGY_ONLY_DIAGNOSTIC, EMPTY_MASTERY_CHECK, CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-mathematics | first-concept-build | ma-g4-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-mathematics | mid-course | ma-g4-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-mathematics | assessment-or-performance | ma-g4-mathematics-u01-l13 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-mathematics | final-course | ma-g4-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-physical-education | first-lesson | ma-g4-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-physical-education | first-concept-build | ma-g4-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-physical-education | mid-course | ma-g4-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-physical-education | assessment-or-performance | ma-g4-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-physical-education | final-course | ma-g4-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-ready-for-life | first-lesson | ma-g4-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-ready-for-life | first-concept-build | ma-g4-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-ready-for-life | mid-course | ma-g4-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-ready-for-life | assessment-or-performance | ma-g4-ready-for-life-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-ready-for-life | final-course | ma-g4-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-science | first-lesson | ma-g4-science-u01-l01 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g4-science | first-concept-build | ma-g4-science-u01-l02 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g4-science | mid-course | ma-g4-science-u05-l07 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-science | assessment-or-performance | ma-g4-science-u01-l09 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g4-science | final-course | ma-g4-science-u09-l12 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-social-studies | first-lesson | ma-g4-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-social-studies | first-concept-build | ma-g4-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-social-studies | mid-course | ma-g4-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-social-studies | assessment-or-performance | ma-g4-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-social-studies | final-course | ma-g4-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-tech-cs | first-lesson | ma-g4-tech-cs-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-tech-cs | first-concept-build | ma-g4-tech-cs-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-tech-cs | mid-course | ma-g4-tech-cs-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-tech-cs | assessment-or-performance | ma-g4-tech-cs-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g4-tech-cs | final-course | ma-g4-tech-cs-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-arts-and-music | first-lesson | ma-g5-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-arts-and-music | first-concept-build | ma-g5-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-arts-and-music | mid-course | ma-g5-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-arts-and-music | assessment-or-performance | ma-g5-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-arts-and-music | final-course | ma-g5-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-english-language-arts | first-lesson | ma-g5-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-english-language-arts | first-concept-build | ma-g5-english-language-arts-u01-l02 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-english-language-arts | mid-course | ma-g5-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-english-language-arts | assessment-or-performance | ma-g5-english-language-arts-u01-l11 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-english-language-arts | final-course | ma-g5-english-language-arts-u10-l18 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-financial-literacy | first-lesson | ma-g5-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-financial-literacy | first-concept-build | ma-g5-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-financial-literacy | mid-course | ma-g5-financial-literacy-u04-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-financial-literacy | assessment-or-performance | ma-g5-financial-literacy-u01-l04 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-financial-literacy | final-course | ma-g5-financial-literacy-u06-l06 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-health | first-lesson | ma-g5-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-health | first-concept-build | ma-g5-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-health | mid-course | ma-g5-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-health | assessment-or-performance | ma-g5-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-health | final-course | ma-g5-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-mathematics | first-lesson | ma-g5-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-mathematics | first-concept-build | ma-g5-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-mathematics | mid-course | ma-g5-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-mathematics | assessment-or-performance | ma-g5-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-mathematics | final-course | ma-g5-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-physical-education | first-lesson | ma-g5-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-physical-education | first-concept-build | ma-g5-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-physical-education | mid-course | ma-g5-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-physical-education | assessment-or-performance | ma-g5-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-physical-education | final-course | ma-g5-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-ready-for-life | first-lesson | ma-g5-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-ready-for-life | first-concept-build | ma-g5-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-ready-for-life | mid-course | ma-g5-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-ready-for-life | assessment-or-performance | ma-g5-ready-for-life-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-ready-for-life | final-course | ma-g5-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-science | first-lesson | ma-g5-science-u01-l01 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-science | first-concept-build | ma-g5-science-u01-l02 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-science | mid-course | ma-g5-science-u05-l07 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-science | assessment-or-performance | ma-g5-science-u01-l09 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-science | final-course | ma-g5-science-u09-l12 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-social-studies | first-lesson | ma-g5-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-social-studies | first-concept-build | ma-g5-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-social-studies | mid-course | ma-g5-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-social-studies | assessment-or-performance | ma-g5-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-social-studies | final-course | ma-g5-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g5-technology | first-lesson | ma-g5-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-technology | first-concept-build | ma-g5-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-technology | mid-course | ma-g5-technology-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-technology | assessment-or-performance | ma-g5-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g5-technology | final-course | ma-g5-technology-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-arts-and-music | first-lesson | ma-g7-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-arts-and-music | first-concept-build | ma-g7-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-arts-and-music | mid-course | ma-g7-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-arts-and-music | assessment-or-performance | ma-g7-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-arts-and-music | final-course | ma-g7-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-english-language-arts | first-lesson | ma-g7-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g7-english-language-arts | first-concept-build | ma-g7-english-language-arts-u01-l02 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g7-english-language-arts | mid-course | ma-g7-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g7-english-language-arts | assessment-or-performance | ma-g7-english-language-arts-u01-l11 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g7-english-language-arts | final-course | ma-g7-english-language-arts-u10-l18 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g7-financial-literacy | first-lesson | ma-g7-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-financial-literacy | first-concept-build | ma-g7-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-financial-literacy | mid-course | ma-g7-financial-literacy-u04-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-financial-literacy | assessment-or-performance | ma-g7-financial-literacy-u01-l04 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-financial-literacy | final-course | ma-g7-financial-literacy-u06-l06 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-health | first-lesson | ma-g7-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-health | first-concept-build | ma-g7-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-health | mid-course | ma-g7-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-health | assessment-or-performance | ma-g7-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-health | final-course | ma-g7-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-mathematics | first-lesson | ma-g7-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-mathematics | first-concept-build | ma-g7-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-mathematics | mid-course | ma-g7-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-mathematics | assessment-or-performance | ma-g7-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-mathematics | final-course | ma-g7-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-physical-education | first-lesson | ma-g7-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-physical-education | first-concept-build | ma-g7-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-physical-education | mid-course | ma-g7-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-physical-education | assessment-or-performance | ma-g7-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-physical-education | final-course | ma-g7-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-ready-for-life | first-lesson | ma-g7-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-ready-for-life | first-concept-build | ma-g7-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-ready-for-life | mid-course | ma-g7-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-ready-for-life | assessment-or-performance | ma-g7-ready-for-life-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-ready-for-life | final-course | ma-g7-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-science | first-lesson | ma-g7-science-u01-l01 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-science | first-concept-build | ma-g7-science-u01-l02 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-science | mid-course | ma-g7-science-u05-l07 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-science | assessment-or-performance | ma-g7-science-u01-l09 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-science | final-course | ma-g7-science-u09-l12 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-social-studies | first-lesson | ma-g7-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-social-studies | first-concept-build | ma-g7-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-social-studies | mid-course | ma-g7-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-social-studies | assessment-or-performance | ma-g7-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-social-studies | final-course | ma-g7-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-technology | first-lesson | ma-g7-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-technology | first-concept-build | ma-g7-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-technology | mid-course | ma-g7-technology-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-technology | assessment-or-performance | ma-g7-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g7-technology | final-course | ma-g7-technology-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-arts-and-music | first-lesson | ma-g8-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-arts-and-music | first-concept-build | ma-g8-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-arts-and-music | mid-course | ma-g8-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-arts-and-music | assessment-or-performance | ma-g8-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-arts-and-music | final-course | ma-g8-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-english-language-arts | first-lesson | ma-g8-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-english-language-arts | first-concept-build | ma-g8-english-language-arts-u01-l02 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-english-language-arts | mid-course | ma-g8-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-english-language-arts | assessment-or-performance | ma-g8-english-language-arts-u01-l11 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-english-language-arts | final-course | ma-g8-english-language-arts-u10-l18 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-financial-literacy | first-lesson | ma-g8-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-financial-literacy | first-concept-build | ma-g8-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-financial-literacy | mid-course | ma-g8-financial-literacy-u04-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-financial-literacy | assessment-or-performance | ma-g8-financial-literacy-u01-l09 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-financial-literacy | final-course | ma-g8-financial-literacy-u07-l11 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-health | first-lesson | ma-g8-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-health | first-concept-build | ma-g8-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-health | mid-course | ma-g8-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-health | assessment-or-performance | ma-g8-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-health | final-course | ma-g8-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-mathematics | first-lesson | ma-g8-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-mathematics | first-concept-build | ma-g8-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-mathematics | mid-course | ma-g8-mathematics-u05-l15 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-mathematics | assessment-or-performance | ma-g8-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-mathematics | final-course | ma-g8-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-physical-education | first-lesson | ma-g8-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-physical-education | first-concept-build | ma-g8-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-physical-education | mid-course | ma-g8-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-physical-education | assessment-or-performance | ma-g8-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-physical-education | final-course | ma-g8-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-ready-for-life | first-lesson | ma-g8-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-ready-for-life | first-concept-build | ma-g8-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-ready-for-life | mid-course | ma-g8-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-ready-for-life | assessment-or-performance | ma-g8-ready-for-life-u01-l04 | VALID_NONQUESTION_TASK | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-ready-for-life | final-course | ma-g8-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-science | first-lesson | ma-g8-science-u01-l01 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-science | first-concept-build | ma-g8-science-u01-l02 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-science | mid-course | ma-g8-science-u05-l07 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-science | assessment-or-performance | ma-g8-science-u01-l09 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-science | final-course | ma-g8-science-u09-l12 | ACTIONABLE_QUESTION_SET | SCIENCE_LESSON_SPECIFIC_ACTIVITY_AUTHORING_GAP, GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-social-studies | first-lesson | ma-g8-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-social-studies | first-concept-build | ma-g8-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-social-studies | mid-course | ma-g8-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-social-studies | assessment-or-performance | ma-g8-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-social-studies | final-course | ma-g8-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g8-technology | first-lesson | ma-g8-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-technology | first-concept-build | ma-g8-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-technology | mid-course | ma-g8-technology-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-technology | assessment-or-performance | ma-g8-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g8-technology | final-course | ma-g8-technology-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-arts-and-music | first-lesson | ma-g9-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-arts-and-music | first-concept-build | ma-g9-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-arts-and-music | mid-course | ma-g9-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-arts-and-music | assessment-or-performance | ma-g9-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-arts-and-music | final-course | ma-g9-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-english-language-arts | first-lesson | ma-g9-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g9-english-language-arts | first-concept-build | ma-g9-english-language-arts-u01-l02 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-english-language-arts | mid-course | ma-g9-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g9-english-language-arts | assessment-or-performance | ma-g9-english-language-arts-u01-l11 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-english-language-arts | final-course | ma-g9-english-language-arts-u10-l18 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g9-financial-literacy | first-lesson | ma-g9-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-financial-literacy | first-concept-build | ma-g9-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-financial-literacy | mid-course | ma-g9-financial-literacy-u04-l07 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-financial-literacy | assessment-or-performance | ma-g9-financial-literacy-u01-l10 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-financial-literacy | final-course | ma-g9-financial-literacy-u07-l11 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-health | first-lesson | ma-g9-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-health | first-concept-build | ma-g9-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-health | mid-course | ma-g9-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-health | assessment-or-performance | ma-g9-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-health | final-course | ma-g9-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-mathematics | first-lesson | ma-g9-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-mathematics | first-concept-build | ma-g9-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-mathematics | mid-course | ma-g9-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-mathematics | assessment-or-performance | ma-g9-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-mathematics | final-course | ma-g9-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-physical-education | first-lesson | ma-g9-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-physical-education | first-concept-build | ma-g9-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-physical-education | mid-course | ma-g9-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-physical-education | assessment-or-performance | ma-g9-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-physical-education | final-course | ma-g9-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-ready-for-life | first-lesson | ma-g9-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-ready-for-life | first-concept-build | ma-g9-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-ready-for-life | mid-course | ma-g9-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-ready-for-life | assessment-or-performance | ma-g9-ready-for-life-u01-l04 | VALID_NONQUESTION_TASK | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-ready-for-life | final-course | ma-g9-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-science | first-lesson | ma-hs9-biology-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-science | first-concept-build | ma-hs9-biology-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-science | mid-course | ma-hs9-biology-u05-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-science | assessment-or-performance | ma-hs9-biology-u01-l09 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-science | final-course | ma-hs9-biology-u09-l12 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-social-studies | first-lesson | ma-g9-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-social-studies | first-concept-build | ma-g9-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-social-studies | mid-course | ma-g9-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-social-studies | assessment-or-performance | ma-g9-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-social-studies | final-course | ma-g9-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-technology | first-lesson | ma-g9-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-technology | first-concept-build | ma-g9-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-technology | mid-course | ma-g9-technology-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-technology | assessment-or-performance | ma-g9-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g9-technology | final-course | ma-g9-technology-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-arts-and-music | first-lesson | ma-g10-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-arts-and-music | first-concept-build | ma-g10-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-arts-and-music | mid-course | ma-g10-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-arts-and-music | assessment-or-performance | ma-g10-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-arts-and-music | final-course | ma-g10-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-english-language-arts | first-lesson | ma-g10-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g10-english-language-arts | first-concept-build | ma-g10-english-language-arts-u01-l02 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-english-language-arts | mid-course | ma-g10-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g10-english-language-arts | assessment-or-performance | ma-g10-english-language-arts-u01-l11 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-english-language-arts | final-course | ma-g10-english-language-arts-u10-l18 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g10-financial-literacy | first-lesson | ma-g10-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-financial-literacy | first-concept-build | ma-g10-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-financial-literacy | mid-course | ma-g10-financial-literacy-u04-l07 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-financial-literacy | assessment-or-performance | ma-g10-financial-literacy-u01-l10 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-financial-literacy | final-course | ma-g10-financial-literacy-u07-l11 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-health | first-lesson | ma-g10-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-health | first-concept-build | ma-g10-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-health | mid-course | ma-g10-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-health | assessment-or-performance | ma-g10-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-health | final-course | ma-g10-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-mathematics | first-lesson | ma-g10-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-mathematics | first-concept-build | ma-g10-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-mathematics | mid-course | ma-g10-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-mathematics | assessment-or-performance | ma-g10-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-mathematics | final-course | ma-g10-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-physical-education | first-lesson | ma-g10-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-physical-education | first-concept-build | ma-g10-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-physical-education | mid-course | ma-g10-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-physical-education | assessment-or-performance | ma-g10-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-physical-education | final-course | ma-g10-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-ready-for-life | first-lesson | ma-g10-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-ready-for-life | first-concept-build | ma-g10-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-ready-for-life | mid-course | ma-g10-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-ready-for-life | assessment-or-performance | ma-g10-ready-for-life-u01-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-ready-for-life | final-course | ma-g10-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-science | first-lesson | ma-hs10-chemistry-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-science | first-concept-build | ma-hs10-chemistry-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-science | mid-course | ma-hs10-chemistry-u05-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-science | assessment-or-performance | ma-hs10-chemistry-u01-l09 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-science | final-course | ma-hs10-chemistry-u09-l12 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-social-studies | first-lesson | ma-g10-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-social-studies | first-concept-build | ma-g10-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-social-studies | mid-course | ma-g10-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-social-studies | assessment-or-performance | ma-g10-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-social-studies | final-course | ma-g10-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-technology | first-lesson | ma-g10-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-technology | first-concept-build | ma-g10-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-technology | mid-course | ma-g10-technology-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-technology | assessment-or-performance | ma-g10-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g10-technology | final-course | ma-g10-technology-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-arts-and-music | first-lesson | ma-g11-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-arts-and-music | first-concept-build | ma-g11-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-arts-and-music | mid-course | ma-g11-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-arts-and-music | assessment-or-performance | ma-g11-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-arts-and-music | final-course | ma-g11-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-english-language-arts | first-lesson | ma-g11-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g11-english-language-arts | first-concept-build | ma-g11-english-language-arts-u01-l02 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-english-language-arts | mid-course | ma-g11-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g11-english-language-arts | assessment-or-performance | ma-g11-english-language-arts-u01-l11 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-english-language-arts | final-course | ma-g11-english-language-arts-u10-l18 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g11-financial-literacy | first-lesson | ma-g11-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-financial-literacy | first-concept-build | ma-g11-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-financial-literacy | mid-course | ma-g11-financial-literacy-u04-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-financial-literacy | assessment-or-performance | ma-g11-financial-literacy-u01-l10 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-financial-literacy | final-course | ma-g11-financial-literacy-u07-l11 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-health | first-lesson | ma-g11-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-health | first-concept-build | ma-g11-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-health | mid-course | ma-g11-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-health | assessment-or-performance | ma-g11-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-health | final-course | ma-g11-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-mathematics | first-lesson | ma-g11-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-mathematics | first-concept-build | ma-g11-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-mathematics | mid-course | ma-g11-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-mathematics | assessment-or-performance | ma-g11-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-mathematics | final-course | ma-g11-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-physical-education | first-lesson | ma-g11-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-physical-education | first-concept-build | ma-g11-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-physical-education | mid-course | ma-g11-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-physical-education | assessment-or-performance | ma-g11-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-physical-education | final-course | ma-g11-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-ready-for-life | first-lesson | ma-g11-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-ready-for-life | first-concept-build | ma-g11-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-ready-for-life | mid-course | ma-g11-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-ready-for-life | assessment-or-performance | ma-g11-ready-for-life-u01-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-ready-for-life | final-course | ma-g11-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-science | first-lesson | ma-hs11-physics-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-science | first-concept-build | ma-hs11-physics-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-science | mid-course | ma-hs11-physics-u05-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-science | assessment-or-performance | ma-hs11-physics-u01-l09 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-science | final-course | ma-hs11-physics-u09-l12 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-social-studies | first-lesson | ma-g11-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-social-studies | first-concept-build | ma-g11-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-social-studies | mid-course | ma-g11-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-social-studies | assessment-or-performance | ma-g11-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-social-studies | final-course | ma-g11-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-technology | first-lesson | ma-g11-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-technology | first-concept-build | ma-g11-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-technology | mid-course | ma-g11-technology-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-technology | assessment-or-performance | ma-g11-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g11-technology | final-course | ma-g11-technology-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-arts-and-music | first-lesson | ma-g12-arts-and-music-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-arts-and-music | first-concept-build | ma-g12-arts-and-music-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-arts-and-music | mid-course | ma-g12-arts-and-music-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-arts-and-music | assessment-or-performance | ma-g12-arts-and-music-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-arts-and-music | final-course | ma-g12-arts-and-music-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-english-language-arts | first-lesson | ma-g12-english-language-arts-u01-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g12-english-language-arts | first-concept-build | ma-g12-english-language-arts-u01-l02 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-english-language-arts | mid-course | ma-g12-english-language-arts-u06-l01 | ZERO_ACTIONABLE_WORK_BLOCKER | GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK, ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g12-english-language-arts | assessment-or-performance | ma-g12-english-language-arts-u01-l11 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-english-language-arts | final-course | ma-g12-english-language-arts-u10-l18 | ACTIONABLE_QUESTION_SET | ELA_SOURCE_REFERENCE_LOST_IN_BROWSER_PROJECTION, ELA_INSTRUCTION_IS_FACILITATOR_META_LANGUAGE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP, CROSS_GRADE_EXACT_ACTIONABLE_TASK |
| ma-g12-financial-literacy | first-lesson | ma-g12-financial-literacy-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-financial-literacy | first-concept-build | ma-g12-financial-literacy-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-financial-literacy | mid-course | ma-g12-financial-literacy-u04-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-financial-literacy | assessment-or-performance | ma-g12-financial-literacy-u01-l10 | ACTIONABLE_QUESTION_SET | CHOICES_DROPPED_FROM_BROWSER_STRUCTURE, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-financial-literacy | final-course | ma-g12-financial-literacy-u07-l11 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-health | first-lesson | ma-g12-health-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-health | first-concept-build | ma-g12-health-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-health | mid-course | ma-g12-health-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-health | assessment-or-performance | ma-g12-health-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-health | final-course | ma-g12-health-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-mathematics | first-lesson | ma-g12-mathematics-u01-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-mathematics | first-concept-build | ma-g12-mathematics-u01-l02 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-mathematics | mid-course | ma-g12-mathematics-u06-l01 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-mathematics | assessment-or-performance | ma-g12-mathematics-u01-l11 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-mathematics | final-course | ma-g12-mathematics-u10-l18 | ACTIONABLE_QUESTION_SET | CHOICES_FLATTENED_TO_DISPLAY_TEXT, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-physical-education | first-lesson | ma-g12-physical-education-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-physical-education | first-concept-build | ma-g12-physical-education-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-physical-education | mid-course | ma-g12-physical-education-u05-l07 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-physical-education | assessment-or-performance | ma-g12-physical-education-u01-l09 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-physical-education | final-course | ma-g12-physical-education-u09-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-ready-for-life | first-lesson | ma-g12-ready-for-life-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-ready-for-life | first-concept-build | ma-g12-ready-for-life-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-ready-for-life | mid-course | ma-g12-ready-for-life-u04-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-ready-for-life | assessment-or-performance | ma-g12-ready-for-life-u01-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-ready-for-life | final-course | ma-g12-ready-for-life-u06-l06 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-science | first-lesson | ma-hs12-earth-space-environmental-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-science | first-concept-build | ma-hs12-earth-space-environmental-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-science | mid-course | ma-hs12-earth-space-environmental-u05-l07 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-science | assessment-or-performance | ma-hs12-earth-space-environmental-u01-l09 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-science | final-course | ma-hs12-earth-space-environmental-u09-l12 | ACTIONABLE_QUESTION_SET | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-social-studies | first-lesson | ma-g12-social-studies-u01-l01 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-social-studies | first-concept-build | ma-g12-social-studies-u01-l02 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-social-studies | mid-course | ma-g12-social-studies-u05-l07 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-social-studies | assessment-or-performance | ma-g12-social-studies-u01-l09 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-social-studies | final-course | ma-g12-social-studies-u09-l12 | ACTIONABLE_QUESTION_SET | GENERIC_NEW_APPLICATION_TASK_SHELL, RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-technology | first-lesson | ma-g12-technology-u01-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-technology | first-concept-build | ma-g12-technology-u01-l02 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-technology | mid-course | ma-g12-technology-u05-l01 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-technology | assessment-or-performance | ma-g12-technology-u01-l04 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |
| ma-g12-technology | final-course | ma-g12-technology-u06-l12 | VALID_NONQUESTION_TASK | RESPONSE_PATH_DISCONNECTED_IN_FINAL_APP |

## Tests and negative controls

- `node --test scripts/audit-family-learner-materials/audit.test.mjs`
- `node scripts/audit-family-learner-materials/audit.mjs --check`
- Mutation controls cover empty mastery, zero actionable work, flattened multiple choice, missing task steps, adult answer leak, placeholder text, missing assessment material, source/browser item-count mismatch, and cross-grade copied lesson.

## Final classification

**FAMILY_LEARNER_MATERIALS_AUDIT_COMPLETE**
