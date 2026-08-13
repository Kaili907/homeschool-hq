# Physical Education Learner Completeness Audit R1

Classification: **PE_LEARNER_AUDIT_COMPLETE**

Corpus readiness: **NOT SAFE TO BEGIN MATRIX**
Base: `c81ddb6e04bc1c3629212327d47817c1b5677477`

## Scope and outcome

The audit read every canonical PE `lesson-task-card` under `curriculum-production/final/health-physical-education/packages/physical-education`: 972 lessons across Grades 3, 4, 5, 7, 8, 9, 10, 11, 12. Grade 6 is not authored and is not part of the 972-lesson contract. All 972 lesson identities are present exactly once.

Every lesson was checked for an activity goal, actionable learner work, activity content, procedural cues/steps, duration, operational safety guidance, adaptations, equipment feasibility, completion criteria, prohibited media/body/intensity requirements, placeholders, and browser projection. 972 lessons have at least one blocking finding. No grade is safe to begin from these learner packages.

## Grade results

| Grade | Audited | Zero work | Empty activity | Missing cues/steps | Missing safety | Missing adaptation | Equipment | Media proof | Projection loss | Safe to begin |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| 3 | 108 | 0 | 0 | 0 | 0 | 0 | 108 | 0 | 0 | NO |
| 4 | 108 | 0 | 0 | 0 | 0 | 0 | 108 | 0 | 0 | NO |
| 5 | 108 | 0 | 0 | 108 | 108 | 0 | 108 | 0 | 0 | NO |
| 7 | 108 | 0 | 0 | 108 | 108 | 0 | 108 | 0 | 0 | NO |
| 8 | 108 | 0 | 0 | 108 | 108 | 0 | 108 | 0 | 0 | NO |
| 9 | 108 | 0 | 0 | 108 | 0 | 0 | 0 | 0 | 0 | NO |
| 10 | 108 | 0 | 0 | 108 | 0 | 0 | 0 | 0 | 0 | NO |
| 11 | 108 | 0 | 0 | 108 | 0 | 0 | 24 | 0 | 0 | NO |
| 12 | 108 | 0 | 0 | 108 | 0 | 0 | 36 | 0 | 0 | NO |

## Top blockers

- MISSING_MOVEMENT_CUES: 756 lessons.
- EQUIPMENT_ASSUMPTION: 600 lessons.
- MISSING_SAFETY: 324 lessons.

`MISSING_MOVEMENT_CUES` is applied when neither `movementCues`, `keyPoints`, nor a procedural step array gives the learner per-lesson execution cues. Grades 5 and above have no such arrays; their learner cards rely on a unit-shared scenario plus a generic focus substitution. `MISSING_SAFETY` requires operational guidance such as a cleared/open safe space, water availability, self-selected intensity, a stop condition, or an equipment/surface check; merely using the word “safe” in a goal is not guidance. `EQUIPMENT_ASSUMPTION` identifies an opaque external equipment list or unspecified “appropriate” equipment instead of a usable learner-side list/alternative.

## Other verified controls

- Activity goals, actionable central tasks, non-empty activities, durations, and completion criteria are present in all 972 lessons.
- All 972 lessons expressly prohibit required photo/video/voice proof; no positive media-proof requirement was found.
- No body-shaming, calorie/weight target, or unsafe required maximal-effort language was found.
- All 972 lessons contain adaptation text and accessibility supports. Equipment/space alternatives are evaluated separately rather than treating a generic response-mode adaptation as an equipment substitute.
- Browser projection loss: 0. The audited projection preserves 864/864 movement-cue values, 0/0 authored step values, and 972/972 adaptation values. The synthetic authored-step projection control also passed.
- Equipment findings: 600; impossible-equipment requirements found in the corpus: 0.

## Negative controls

| Injected fault | Expected detection | Result |
| --- | --- | :---: |
| delete_activity | ZERO_ACTIONABLE_WORK, EMPTY_ACTIVITY | PASS |
| delete_safety | MISSING_SAFETY | PASS |
| camera_requirement | MEDIA_PROOF_REQUIREMENT | PASS |
| impossible_equipment | EQUIPMENT_ASSUMPTION | PASS |
| no_adaptation | MISSING_ADAPTATION | PASS |

## Method and artifacts

The reproducible audit is `scripts/audit-learner-physical-education/audit.mjs`; its focused tests are `scripts/audit-learner-physical-education/audit.test.mjs`. It independently mirrors the learner JSON projection without writing to `public/`, then statically verifies that the production learner view renders all section bodies and prompts. Per-lesson evidence is in `lesson-findings.jsonl`; aggregate grade, equipment, and browser results are in the adjacent JSON files.
