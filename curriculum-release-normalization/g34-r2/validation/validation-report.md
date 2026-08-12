# Validation Report - Grades 3/4 Normalized Release

**Release:** `manuel-academy-grades-3-4-r2-normalized`
**Normalized on:** 2026-08-12
**Input:** `curriculum-release-candidates/g34-r1` (manuel-academy-grades-3-4-r1), unmodified

| Group | Verdict |
| --- | --- |
| Conformance to `release/validation-contract.md` | **PASS** |
| Normalization integrity | **PASS** |
| Preservation of the candidate | **PASS** |
| Overall | **PASS** |

The candidate reported release-contract conformance as FAIL on `lesson-schema-compatibility` and
`required-standards-and-objectives`. Both now pass, and neither passes because a lesson was
rewritten - see [content equivalence](../provenance/content-equivalence-report.md).

## Counts

| | Grade 3 | Grade 4 | Total |
| --- | ---: | ---: | ---: |
| Courses | 10 | 10 | 20 |
| Units | 77 | 77 | 154 |
| Lessons | 900 | 900 | 1800 |
| Assessments | | | 154 |
| Scheduled sessions | | | 1800 |

Every count matches the candidate exactly.

## Per course

| Grade | Subject | Course ID | Units | Lessons | Assess | Sessions | Cadence | Lane std. artifact | Status |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| 3 | mathematics | `ma-g3-mathematics` | 10 | 180 | 10 | 180 | 5/wk x 36wk | yes | RELEASE_READY |
| 3 | english-language-arts | `ma-g3-english-language-arts` | 10 | 180 | 10 | 180 | 5/wk x 36wk | yes | RELEASE_READY |
| 3 | science | `ma-g3-science` | 9 | 108 | 9 | 108 | 3/wk x 36wk | none - standalone projected | RELEASE_READY |
| 3 | social-studies | `ma-g3-social-studies` | 9 | 108 | 9 | 108 | 3/wk x 36wk | none - standalone projected | RELEASE_READY |
| 3 | health | `ma-g3-health` | 6 | 36 | 6 | 36 | 1/wk x 36wk | yes | PENDING_FINAL_HEALTH_REVIEW |
| 3 | physical-education | `ma-g3-physical-education` | 9 | 108 | 9 | 108 | 3/wk x 36wk | yes | PENDING_FINAL_HEALTH_REVIEW |
| 3 | ready-for-life | `ma-g3-ready-for-life` | 6 | 36 | 6 | 36 | 1/wk x 36wk | none - standalone projected | RELEASE_READY |
| 3 | technology | `ma-g3-tech-cs` | 6 | 36 | 6 | 36 | 1/wk x 36wk | yes | RELEASE_READY |
| 3 | arts-and-music | `ma-g3-arts-music` | 6 | 72 | 6 | 72 | 2/wk x 36wk | yes | RELEASE_READY |
| 3 | financial-literacy | `ma-g3-financial-literacy` | 6 | 36 | 6 | 36 | 1/wk x 36wk | none - standalone projected | RELEASE_READY |
| 4 | mathematics | `ma-g4-mathematics` | 10 | 180 | 10 | 180 | 5/wk x 36wk | yes | RELEASE_READY |
| 4 | english-language-arts | `ma-g4-english-language-arts` | 10 | 180 | 10 | 180 | 5/wk x 36wk | yes | RELEASE_READY |
| 4 | science | `ma-g4-science` | 9 | 108 | 9 | 108 | 3/wk x 36wk | none - standalone projected | RELEASE_READY |
| 4 | social-studies | `ma-g4-social-studies` | 9 | 108 | 9 | 108 | 3/wk x 36wk | none - standalone projected | RELEASE_READY |
| 4 | health | `ma-g4-health` | 6 | 36 | 6 | 36 | 1/wk x 36wk | yes | PENDING_FINAL_HEALTH_REVIEW |
| 4 | physical-education | `ma-g4-physical-education` | 9 | 108 | 9 | 108 | 3/wk x 36wk | yes | PENDING_FINAL_HEALTH_REVIEW |
| 4 | ready-for-life | `ma-g4-ready-for-life` | 6 | 36 | 6 | 36 | 1/wk x 36wk | none - standalone projected | RELEASE_READY |
| 4 | technology | `ma-g4-tech-cs` | 6 | 36 | 6 | 36 | 1/wk x 36wk | yes | RELEASE_READY |
| 4 | arts-and-music | `ma-g4-arts-music` | 6 | 72 | 6 | 72 | 2/wk x 36wk | yes | RELEASE_READY |
| 4 | financial-literacy | `ma-g4-financial-literacy` | 6 | 36 | 6 | 36 | 1/wk x 36wk | none - standalone projected | RELEASE_READY |

## Release-contract checks

Every required check in
[`standards/sources/release/validation-contract.md`](../standards/sources/release/validation-contract.md),
in the contract's own order, run against the normalized lessons.

| Check | Result | Detail |
| --- | --- | --- |
| `two-grades` | PASS | grades present: [3, 4] |
| `ten-courses-per-grade` | PASS | grade 3: 10 courses, one per canonical subject; grade 4: 10 courses, one per canonical subject |
| `course-count` | PASS | 20 courses |
| `unique-course-ids` | PASS | 20 distinct of 20 |
| `unique-unit-ids` | PASS | 154 units, 154 distinct |
| `unique-lesson-ids` | PASS | 1800 lessons, 1800 distinct; 0 fail the grade34 lesson-id pattern |
| `schedule-covers-every-lesson-once` | PASS | all 20 courses: every lesson scheduled exactly once, no unscheduled lesson |
| `week-coverage` | PASS | all 20 courses span exactly weeks 1-36 with no empty week |
| `lesson-schema-compatibility` | PASS | all 1800 lessons validate against schemas/lesson.release.v1.json |
| `lesson-schema-compatibility-against-unmodified-release-schema` | REPORTED | 216 of 1800 lessons fail standards/sources/release/lesson-schema.json as the release-standards lane authored it. Remaining reasons: 'arts-and-music' not in enum (144); 'technology' not in enum (72). This is the stale subject enum recorded in the r1 custody report section 5, not a content defect; adapters/subject-slug-map.json translates in both directions. |
| `required-standards-and-objectives` | PASS | learning_objectives >= 3: PASS on all 1800 lessons. standards entry carrying a mapping_status: PASS on 1800 of 1800 lessons (4757 of 4757 citations carry one). |
| `accessibility-depth` | PASS | 0 lessons below 5 entries; minimum observed is 6 |
| `no-media-path` | PASS | 0 lessons name no text/transcript/description/demonstration fallback (keyword heuristic over accessibility_and_accommodations; human review still required) |
| `safety-privacy-depth` | PASS | 0 lessons below 2 entries; minimum observed is 4 |
| `safety-privacy-content` | PASS | 0 non-prohibiting uses of a banned disclosure term across 1800 lessons (keyword heuristic that ignores explicit prohibitions such as 'no photo required'; human review still required) |
| `multi-occasion-mastery` | PASS | 0 lessons whose mastery_rule does not name multiple evidence occasions (keyword heuristic; human review still required) |
| `standards-mapping-status-reported` | PASS | 4757 standards citations across 1800 lessons; all 4757 carry a per-citation mapping_status. Rollup: canonical 1210, unverified 2850, human-review 697. Derivation: adapters/standards-mapping-policy.json; per-course detail: standards/standards-rollup.json. |

## Normalization integrity

| Check | Result | Detail |
| --- | --- | --- |
| `input-candidate-verified` | PASS | g34-r1 re-hashed against its own SHA256SUMS.txt before reading: 195 files, 0 differ |
| `lesson-roundtrip-byte-identical` | PASS | denormalize(normalize(lesson)) re-serialized in the source file's own separator style reproduces all 1800 original JSONL lines byte for byte |
| `instructional-content-digest-equal` | PASS | SHA256 over every field outside ['standards', 'schema_version', 'authored_schema_version'] is identical between g34-r1 and this release on all 1800 lessons; the standards citation sequence digest is identical too |
| `normalization-surface-closed` | PASS | exactly 3 lesson fields are touched release-wide (standards, schema_version, authored_schema_version); every other field compares equal on all 1800 lessons |
| `verbatim-files-byte-identical` | PASS | 167 non-lesson files carried from g34-r1 re-hashed after write; 0 differ |
| `lesson-index-identical-to-candidate` | PASS | lesson-index.csv regenerated from the normalized lessons is byte-identical to g34-r1's, which fixes every lesson id, course id, grade, subject, unit number, course day, phase and title in one hash |
| `sealed-1.0.0-untouched` | PASS | no file under curriculum-content/manuel-academy/1.0.0 is added, changed, or removed |
| `g34-r1-candidate-untouched` | PASS | no file under curriculum-release-candidates/g34-r1 is added, changed, or removed |

## Preservation

| Check | Result | Detail |
| --- | --- | --- |
| `counts-preserved` | PASS | courses: 20 (candidate 20); units: 154 (candidate 154); lessons: 1800 (candidate 1800); assessments: 154 (candidate 154); scheduled_sessions: 1800 (candidate 1800) |
| `lesson-ids-preserved` | PASS | 1800 lesson ids, same values in the same order as the candidate |
| `unit-ids-preserved` | PASS | 154 unit ids unchanged |
| `course-ids-preserved` | PASS | 20 course ids unchanged |
| `assessment-ids-preserved` | PASS | 154 assessments, 154 distinct, all ids unchanged |
| `schedules-preserved` | PASS | all 20 schedule CSVs plus schedule-index.json are byte-identical to the candidate |
| `assessments-preserved` | PASS | all 20 assessments.json files are byte-identical to the candidate |
| `subject-slugs-canonical` | PASS | all 20 courses carry a subject drawn from the canonical 10-subject enum the sealed 1.0.0 package and src/curriculum-authoring/v2/contracts.ts use |
| `standards-artifact-per-course` | PASS | 20 of 20 courses have a standalone standards artifact under standards/courses/ (8 of them projected from lesson citations because their lane shipped none) |

## Standards mapping-status rollup

The rollup the contract asks for, which the candidate could not produce because no lane emitted the
object citation form.

| Status | Citations | Share |
| --- | ---: | ---: |
| `canonical` | 1210 | 25% |
| `unverified` | 2850 | 60% |
| `human-review` | 697 | 15% |
| **Total** | **4757** | |

Derivation rules and the evidence for each: [`adapters/standards-mapping-policy.json`](../adapters/standards-mapping-policy.json).
Per-course: [`standards/standards-rollup.json`](../standards/standards-rollup.json).
The contract requires this rollup to be *reported*, not to hit a particular ratio - it exists so
convergence can decide whether the ratio is acceptable. It is not acceptable yet: 3547
of 4757 citations still need a human.

## Scope limits

- Internal consistency only. No standard code is verified against a live Michigan source in this
  run; that is exactly what the `unverified` count above measures.
- `no-media-path`, `safety-privacy-content` and `multi-occasion-mastery` are keyword heuristics,
  as the contract itself describes them. They run over fields this normalization does not touch,
  and the keyword sets are the candidate's. A PASS means the scan found nothing.
- No licensed-educator sign-off exists for any of the 20 courses. Health and Physical Education
  carry `PENDING_FINAL_HEALTH_REVIEW` and remain an explicit external gate.
- No rendered-interface accessibility audit.
- No host integration. Grades 3 and 4 still do not exist in `AcademyGrade`, `PILOT_GRADES`, or
  `scripts/build-curriculum.mjs`. Promotion is a separate session; 1.0.0 stays frozen.
