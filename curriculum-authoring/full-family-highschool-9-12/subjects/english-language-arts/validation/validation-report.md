# High School ELA 9-12 — Validation Report

**Package:** `manuel-academy-highschool-9-12-ela`  
**Validated:** 2026-08-12  
**Result:** **PASS** — 303/303 checks passed, 0 failed

| Total | Count |
| --- | --- |
| courses | 4 |
| units | 40 |
| lessons | 720 |
| assessments | 40 |
| standards in corpus | 84 |

Run with `node validation/validate.mjs` (add `--json` for the machine-readable form).

## Checks

| Check | Result | Details |
| --- | --- | --- |
| `standards-corpus-size` | PASS | 84 entries (expect 84 = 2 bands x (10+10+10+6+6)) |
| `standards-source-hashed` | PASS | 5d340bbe90c70f95b937a4b95f099b55543b423e55ac0708ea43fee6a15a4863 |
| `standards-code-format-disclosed` | PASS | LOCAL_COMPOSITION |
| `standards-verified-flag` | PASS | true |
| `standards-text-nonempty` | PASS | all entries carry text |
| `course-exists:english-9` | PASS | /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts/courses/english-9 |
| `course-exists:english-10` | PASS | /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts/courses/english-10 |
| `course-exists:english-11` | PASS | /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts/courses/english-11 |
| `course-exists:english-12` | PASS | /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts/courses/english-12 |
| `four-courses` | PASS | english-9, english-10, english-11, english-12 |
| `units-count:english-9` | PASS | 10 |
| `lessons-count:english-9` | PASS | 180 |
| `assessments-count:english-9` | PASS | 10 |
| `unit-days-18:english-9` | PASS | 10 units x 18 days |
| `course-id-consistent:english-9` | PASS | ma-g9-english-language-arts |
| `grade-consistent:english-9` | PASS | 9 |
| `lesson-id-format:english-9` | PASS | ^ma-g9-english-language-arts-u[0-9]{2}-l[0-9]{2}$ |
| `course-days-1-180:english-9` | PASS | 1..180, unique=180 |
| `units-count:english-10` | PASS | 10 |
| `lessons-count:english-10` | PASS | 180 |
| `assessments-count:english-10` | PASS | 10 |
| `unit-days-18:english-10` | PASS | 10 units x 18 days |
| `course-id-consistent:english-10` | PASS | ma-g10-english-language-arts |
| `grade-consistent:english-10` | PASS | 10 |
| `lesson-id-format:english-10` | PASS | ^ma-g10-english-language-arts-u[0-9]{2}-l[0-9]{2}$ |
| `course-days-1-180:english-10` | PASS | 1..180, unique=180 |
| `units-count:english-11` | PASS | 10 |
| `lessons-count:english-11` | PASS | 180 |
| `assessments-count:english-11` | PASS | 10 |
| `unit-days-18:english-11` | PASS | 10 units x 18 days |
| `course-id-consistent:english-11` | PASS | ma-g11-english-language-arts |
| `grade-consistent:english-11` | PASS | 11 |
| `lesson-id-format:english-11` | PASS | ^ma-g11-english-language-arts-u[0-9]{2}-l[0-9]{2}$ |
| `course-days-1-180:english-11` | PASS | 1..180, unique=180 |
| `units-count:english-12` | PASS | 10 |
| `lessons-count:english-12` | PASS | 180 |
| `assessments-count:english-12` | PASS | 10 |
| `unit-days-18:english-12` | PASS | 10 units x 18 days |
| `course-id-consistent:english-12` | PASS | ma-g12-english-language-arts |
| `grade-consistent:english-12` | PASS | 12 |
| `lesson-id-format:english-12` | PASS | ^ma-g12-english-language-arts-u[0-9]{2}-l[0-9]{2}$ |
| `course-days-1-180:english-12` | PASS | 1..180, unique=180 |
| `unique-lesson-ids` | PASS | 720 unique, 0 dupes |
| `unique-unit-ids` | PASS | 40 unique |
| `unique-assessment-ids` | PASS | 40 unique |
| `unit-refs-resolve:english-9` | PASS | 0 unresolved |
| `unit-refs-exactly-once:english-9` | PASS | 0 referenced != once |
| `no-orphan-lessons:english-9` | PASS | 0 orphans |
| `assessment-refs-resolve:english-9` | PASS | 10/10 |
| `unit-refs-resolve:english-10` | PASS | 0 unresolved |
| `unit-refs-exactly-once:english-10` | PASS | 0 referenced != once |
| `no-orphan-lessons:english-10` | PASS | 0 orphans |
| `assessment-refs-resolve:english-10` | PASS | 10/10 |
| `unit-refs-resolve:english-11` | PASS | 0 unresolved |
| `unit-refs-exactly-once:english-11` | PASS | 0 referenced != once |
| `no-orphan-lessons:english-11` | PASS | 0 orphans |
| `assessment-refs-resolve:english-11` | PASS | 10/10 |
| `unit-refs-resolve:english-12` | PASS | 0 unresolved |
| `unit-refs-exactly-once:english-12` | PASS | 0 referenced != once |
| `no-orphan-lessons:english-12` | PASS | 0 orphans |
| `assessment-refs-resolve:english-12` | PASS | 10/10 |
| `schedule-rows:english-9` | PASS | 180 |
| `schedule-refs-known:english-9` | PASS | 0 unknown |
| `schedule-covers-every-lesson-once:english-9` | PASS | scheduled=180, lessons=180 |
| `schedule-36-weeks:english-9` | PASS | 36 |
| `schedule-weekdays-1-5:english-9` | PASS | 1,2,3,4,5 |
| `schedule-rows:english-10` | PASS | 180 |
| `schedule-refs-known:english-10` | PASS | 0 unknown |
| `schedule-covers-every-lesson-once:english-10` | PASS | scheduled=180, lessons=180 |
| `schedule-36-weeks:english-10` | PASS | 36 |
| `schedule-weekdays-1-5:english-10` | PASS | 1,2,3,4,5 |
| `schedule-rows:english-11` | PASS | 180 |
| `schedule-refs-known:english-11` | PASS | 0 unknown |
| `schedule-covers-every-lesson-once:english-11` | PASS | scheduled=180, lessons=180 |
| `schedule-36-weeks:english-11` | PASS | 36 |
| `schedule-weekdays-1-5:english-11` | PASS | 1,2,3,4,5 |
| `schedule-rows:english-12` | PASS | 180 |
| `schedule-refs-known:english-12` | PASS | 0 unknown |
| `schedule-covers-every-lesson-once:english-12` | PASS | scheduled=180, lessons=180 |
| `schedule-36-weeks:english-12` | PASS | 36 |
| `schedule-weekdays-1-5:english-12` | PASS | 1,2,3,4,5 |
| `standards-resolve:english-9` | PASS | 0 unknown:  |
| `standards-band-correct:english-9` | PASS | band 9-10, 0 out-of-band |
| `standards-applicable-only:english-9` | PASS | 0 not-applicable used |
| `no-k8-standard-codes:english-9` | PASS | 0 grade-prefixed (e.g. 8.RL.1) codes |
| `standards-resolve:english-10` | PASS | 0 unknown:  |
| `standards-band-correct:english-10` | PASS | band 9-10, 0 out-of-band |
| `standards-applicable-only:english-10` | PASS | 0 not-applicable used |
| `no-k8-standard-codes:english-10` | PASS | 0 grade-prefixed (e.g. 8.RL.1) codes |
| `standards-resolve:english-11` | PASS | 0 unknown:  |
| `standards-band-correct:english-11` | PASS | band 11-12, 0 out-of-band |
| `standards-applicable-only:english-11` | PASS | 0 not-applicable used |
| `no-k8-standard-codes:english-11` | PASS | 0 grade-prefixed (e.g. 8.RL.1) codes |
| `standards-resolve:english-12` | PASS | 0 unknown:  |
| `standards-band-correct:english-12` | PASS | band 11-12, 0 out-of-band |
| `standards-applicable-only:english-12` | PASS | 0 not-applicable used |
| `no-k8-standard-codes:english-12` | PASS | 0 grade-prefixed (e.g. 8.RL.1) codes |
| `band-coverage:9-10` | PASS | 41/41 covered |
| `band-coverage:11-12` | PASS | 41/41 covered |
| `lesson-required-fields:english-9` | PASS | 0 lessons missing a required field |
| `lesson-3-objectives:english-9` | PASS | all |
| `lesson-5-segments:english-9` | PASS | all (Study-resumable segmentation) |
| `lesson-has-standards:english-9` | PASS | all |
| `lesson-accessibility-5:english-9` | PASS | all |
| `lesson-safety-2:english-9` | PASS | all |
| `media-optional-with-fallback:english-9` | PASS | all lessons: media never required, fallback present |
| `accessible-reading-representation:english-9` | PASS | all |
| `private-presentation-path:english-9` | PASS | all |
| `multi-occasion-mastery:english-9` | PASS | every lesson requires >= 2 occasions |
| `student-authorship-present:english-9` | PASS | all |
| `tutor-may-not-write-response:english-9` | PASS | all |
| `tutor-declines-answer-route:english-9` | PASS | all |
| `no-raw-essay-in-guardian-metadata:english-9` | PASS | all |
| `lesson-required-fields:english-10` | PASS | 0 lessons missing a required field |
| `lesson-3-objectives:english-10` | PASS | all |
| `lesson-5-segments:english-10` | PASS | all (Study-resumable segmentation) |
| `lesson-has-standards:english-10` | PASS | all |
| `lesson-accessibility-5:english-10` | PASS | all |
| `lesson-safety-2:english-10` | PASS | all |
| `media-optional-with-fallback:english-10` | PASS | all lessons: media never required, fallback present |
| `accessible-reading-representation:english-10` | PASS | all |
| `private-presentation-path:english-10` | PASS | all |
| `multi-occasion-mastery:english-10` | PASS | every lesson requires >= 2 occasions |
| `student-authorship-present:english-10` | PASS | all |
| `tutor-may-not-write-response:english-10` | PASS | all |
| `tutor-declines-answer-route:english-10` | PASS | all |
| `no-raw-essay-in-guardian-metadata:english-10` | PASS | all |
| `lesson-required-fields:english-11` | PASS | 0 lessons missing a required field |
| `lesson-3-objectives:english-11` | PASS | all |
| `lesson-5-segments:english-11` | PASS | all (Study-resumable segmentation) |
| `lesson-has-standards:english-11` | PASS | all |
| `lesson-accessibility-5:english-11` | PASS | all |
| `lesson-safety-2:english-11` | PASS | all |
| `media-optional-with-fallback:english-11` | PASS | all lessons: media never required, fallback present |
| `accessible-reading-representation:english-11` | PASS | all |
| `private-presentation-path:english-11` | PASS | all |
| `multi-occasion-mastery:english-11` | PASS | every lesson requires >= 2 occasions |
| `student-authorship-present:english-11` | PASS | all |
| `tutor-may-not-write-response:english-11` | PASS | all |
| `tutor-declines-answer-route:english-11` | PASS | all |
| `no-raw-essay-in-guardian-metadata:english-11` | PASS | all |
| `lesson-required-fields:english-12` | PASS | 0 lessons missing a required field |
| `lesson-3-objectives:english-12` | PASS | all |
| `lesson-5-segments:english-12` | PASS | all (Study-resumable segmentation) |
| `lesson-has-standards:english-12` | PASS | all |
| `lesson-accessibility-5:english-12` | PASS | all |
| `lesson-safety-2:english-12` | PASS | all |
| `media-optional-with-fallback:english-12` | PASS | all lessons: media never required, fallback present |
| `accessible-reading-representation:english-12` | PASS | all |
| `private-presentation-path:english-12` | PASS | all |
| `multi-occasion-mastery:english-12` | PASS | every lesson requires >= 2 occasions |
| `student-authorship-present:english-12` | PASS | all |
| `tutor-may-not-write-response:english-12` | PASS | all |
| `tutor-declines-answer-route:english-12` | PASS | all |
| `no-raw-essay-in-guardian-metadata:english-12` | PASS | all |
| `assessment-points-sum:english-9` | PASS | all |
| `assessment-rubric:english-9` | PASS | all |
| `assessment-reassessment:english-9` | PASS | all |
| `assessment-authorship-rule:english-9` | PASS | all |
| `assessment-weight-non-decreasing:english-9` | PASS | 0 -> 43 |
| `assessment-points-sum:english-10` | PASS | all |
| `assessment-rubric:english-10` | PASS | all |
| `assessment-reassessment:english-10` | PASS | all |
| `assessment-authorship-rule:english-10` | PASS | all |
| `assessment-weight-non-decreasing:english-10` | PASS | 43 -> 48 |
| `assessment-points-sum:english-11` | PASS | all |
| `assessment-rubric:english-11` | PASS | all |
| `assessment-reassessment:english-11` | PASS | all |
| `assessment-authorship-rule:english-11` | PASS | all |
| `assessment-weight-non-decreasing:english-11` | PASS | 48 -> 54 |
| `assessment-points-sum:english-12` | PASS | all |
| `assessment-rubric:english-12` | PASS | all |
| `assessment-reassessment:english-12` | PASS | all |
| `assessment-authorship-rule:english-12` | PASS | all |
| `assessment-weight-non-decreasing:english-12` | PASS | 54 -> 62 |
| `rigor-distinct:model` | PASS | 4/4 distinct across the four courses |
| `rigor-distinct:guided` | PASS | 4/4 distinct across the four courses |
| `rigor-distinct:independent` | PASS | 4/4 distinct across the four courses |
| `rigor-distinct:mastery` | PASS | 4/4 distinct across the four courses |
| `g12-no-supplied-method` | PASS | English 12 withholds the worked exemplar |
| `g9-scaffold-present` | PASS | English 9 keeps the criteria checklist |
| `g12-source-trail-audit` | PASS | English 12 scores an auditable source trail |
| `g11-uncertainty-scored` | PASS | English 11 scores uncertainty and limits |
| `g10-lacks-g12-dimension` | PASS | English 10 does not carry the senior dimension |
| `text-rights-valid:english-9` | PASS | all |
| `text-ids-unique:english-9` | PASS | 12 |
| `public-domain-year:english-9` | PASS | 0 entries dated after 1929 |
| `rights-required-substituted:english-9` | PASS | 1 gated entries, each with a PD substitute |
| `rights-required-no-text:english-9` | PASS | no passage stored for gated works |
| `text-citation-metadata:english-9` | PASS | all entries carry source + author |
| `original-texts-present:english-9` | PASS | 4 original |
| `text-rights-valid:english-10` | PASS | all |
| `text-ids-unique:english-10` | PASS | 12 |
| `public-domain-year:english-10` | PASS | 0 entries dated after 1929 |
| `rights-required-substituted:english-10` | PASS | 1 gated entries, each with a PD substitute |
| `rights-required-no-text:english-10` | PASS | no passage stored for gated works |
| `text-citation-metadata:english-10` | PASS | all entries carry source + author |
| `original-texts-present:english-10` | PASS | 4 original |
| `text-rights-valid:english-11` | PASS | all |
| `text-ids-unique:english-11` | PASS | 13 |
| `public-domain-year:english-11` | PASS | 0 entries dated after 1929 |
| `rights-required-substituted:english-11` | PASS | 0 gated entries, each with a PD substitute |
| `rights-required-no-text:english-11` | PASS | no passage stored for gated works |
| `text-citation-metadata:english-11` | PASS | all entries carry source + author |
| `original-texts-present:english-11` | PASS | 3 original |
| `text-rights-valid:english-12` | PASS | all |
| `text-ids-unique:english-12` | PASS | 12 |
| `public-domain-year:english-12` | PASS | 0 entries dated after 1929 |
| `rights-required-substituted:english-12` | PASS | 0 gated entries, each with a PD substitute |
| `rights-required-no-text:english-12` | PASS | no passage stored for gated works |
| `text-citation-metadata:english-12` | PASS | all entries carry source + author |
| `original-texts-present:english-12` | PASS | 4 original |
| `phase-arc-implemented:english-9` | PASS | 13 distinct lesson_flow shapes across 18 phases (a single shape means the arc is decorative) |
| `phase-shape-stable:english-9` | PASS | each phase yields one consistent shape |
| `assessment-days-present:english-9` | PASS | 10 |
| `assessment-day-no-instruction:english-9` | PASS | 0 assessment days still run modelling or guided practice |
| `seminar-day-is-seminar:english-9` | PASS | 10 days |
| `seminar-private-option:english-9` | PASS | all |
| `correction-day-has-reassessment:english-9` | PASS | 10 days |
| `formative-check-varies:english-9` | PASS | 89 distinct formative checks |
| `phase-arc-implemented:english-10` | PASS | 13 distinct lesson_flow shapes across 18 phases (a single shape means the arc is decorative) |
| `phase-shape-stable:english-10` | PASS | each phase yields one consistent shape |
| `assessment-days-present:english-10` | PASS | 10 |
| `assessment-day-no-instruction:english-10` | PASS | 0 assessment days still run modelling or guided practice |
| `seminar-day-is-seminar:english-10` | PASS | 10 days |
| `seminar-private-option:english-10` | PASS | all |
| `correction-day-has-reassessment:english-10` | PASS | 10 days |
| `formative-check-varies:english-10` | PASS | 89 distinct formative checks |
| `phase-arc-implemented:english-11` | PASS | 13 distinct lesson_flow shapes across 18 phases (a single shape means the arc is decorative) |
| `phase-shape-stable:english-11` | PASS | each phase yields one consistent shape |
| `assessment-days-present:english-11` | PASS | 10 |
| `assessment-day-no-instruction:english-11` | PASS | 0 assessment days still run modelling or guided practice |
| `seminar-day-is-seminar:english-11` | PASS | 10 days |
| `seminar-private-option:english-11` | PASS | all |
| `correction-day-has-reassessment:english-11` | PASS | 10 days |
| `formative-check-varies:english-11` | PASS | 89 distinct formative checks |
| `phase-arc-implemented:english-12` | PASS | 13 distinct lesson_flow shapes across 18 phases (a single shape means the arc is decorative) |
| `phase-shape-stable:english-12` | PASS | each phase yields one consistent shape |
| `assessment-days-present:english-12` | PASS | 10 |
| `assessment-day-no-instruction:english-12` | PASS | 0 assessment days still run modelling or guided practice |
| `seminar-day-is-seminar:english-12` | PASS | 10 days |
| `seminar-private-option:english-12` | PASS | all |
| `correction-day-has-reassessment:english-12` | PASS | 10 days |
| `formative-check-varies:english-12` | PASS | 88 distinct formative checks |
| `success-criteria-distinct-per-course` | PASS | 4/4 distinct |
| `learning-objectives-distinct-per-course` | PASS | 4/4 distinct |
| `g12-criteria-are-senior-level` | PASS | English 12 is judged on method choice and bounded claims |
| `g9-criteria-are-scaffolded` | PASS | English 9 is judged against a supplied checklist |
| `assessment-above-grade-8` | PASS | 43 < 48 < 54 < 62 vs grade 8 = 38 |
| `assessment-strictly-increasing` | PASS | 43 -> 48 -> 54 -> 62 |
| `assessment-weight-consistent-in-course` | PASS | all 10 units per course carry the same weight |
| `primary-standard-resolves:english-9` | PASS | all |
| `primary-standard-in-unit:english-9` | PASS | all |
| `every-unit-standard-is-primary-somewhere:english-9` | PASS | 0 unit standards never primary |
| `primary-standards-varied:english-9` | PASS | 40 distinct primaries |
| `primary-standard-resolves:english-10` | PASS | all |
| `primary-standard-in-unit:english-10` | PASS | all |
| `every-unit-standard-is-primary-somewhere:english-10` | PASS | 0 unit standards never primary |
| `primary-standards-varied:english-10` | PASS | 38 distinct primaries |
| `primary-standard-resolves:english-11` | PASS | all |
| `primary-standard-in-unit:english-11` | PASS | all |
| `every-unit-standard-is-primary-somewhere:english-11` | PASS | 0 unit standards never primary |
| `primary-standards-varied:english-11` | PASS | 41 distinct primaries |
| `primary-standard-resolves:english-12` | PASS | all |
| `primary-standard-in-unit:english-12` | PASS | all |
| `every-unit-standard-is-primary-somewhere:english-12` | PASS | 0 unit standards never primary |
| `primary-standards-varied:english-12` | PASS | 39 distinct primaries |
| `units-assign-texts:english-9` | PASS | every unit assigns >= 2 texts |
| `assigned-texts-resolve:english-9` | PASS | 0 unresolved |
| `gated-text-never-assigned:english-9` | PASS | 0 gated works assigned |
| `every-text-is-taught:english-9` | PASS | 11/11 assignable texts assigned |
| `lessons-name-their-texts:english-9` | PASS | all 180 |
| `lesson-texts-carry-citation:english-9` | PASS | all |
| `lesson-texts-accessible:english-9` | PASS | all |
| `units-assign-texts:english-10` | PASS | every unit assigns >= 2 texts |
| `assigned-texts-resolve:english-10` | PASS | 0 unresolved |
| `gated-text-never-assigned:english-10` | PASS | 0 gated works assigned |
| `every-text-is-taught:english-10` | PASS | 11/11 assignable texts assigned |
| `lessons-name-their-texts:english-10` | PASS | all 180 |
| `lesson-texts-carry-citation:english-10` | PASS | all |
| `lesson-texts-accessible:english-10` | PASS | all |
| `units-assign-texts:english-11` | PASS | every unit assigns >= 2 texts |
| `assigned-texts-resolve:english-11` | PASS | 0 unresolved |
| `gated-text-never-assigned:english-11` | PASS | 0 gated works assigned |
| `every-text-is-taught:english-11` | PASS | 13/13 assignable texts assigned |
| `lessons-name-their-texts:english-11` | PASS | all 180 |
| `lesson-texts-carry-citation:english-11` | PASS | all |
| `lesson-texts-accessible:english-11` | PASS | all |
| `units-assign-texts:english-12` | PASS | every unit assigns >= 2 texts |
| `assigned-texts-resolve:english-12` | PASS | 0 unresolved |
| `gated-text-never-assigned:english-12` | PASS | 0 gated works assigned |
| `every-text-is-taught:english-12` | PASS | 12/12 assignable texts assigned |
| `lessons-name-their-texts:english-12` | PASS | all 180 |
| `lesson-texts-carry-citation:english-12` | PASS | all |
| `lesson-texts-accessible:english-12` | PASS | all |
| `text-anchor:english-10-u3-9-10.RI.9` | PASS | 9-10.RI.9 instantiated by ma-hs-ela-t-1005 + ma-hs-ela-t-1007 |
| `text-anchor:english-9-u9-9-10.RL.6` | PASS | 9-10.RL.6 instantiated by ma-hs-ela-t-909 |
| `text-anchor:english-10-u7-9-10.RL.7` | PASS | 9-10.RL.7 instantiated by ma-hs-ela-t-1010 + ma-hs-ela-t-1012 |
| `text-anchor:english-11-u2-11-12.RI.9` | PASS | 11-12.RI.9 instantiated by ma-hs-ela-t-1113 + ma-hs-ela-t-1106 |
| `text-anchor:english-11-u9-11-12.RL.7` | PASS | 11-12.RL.7 instantiated by ma-hs-ela-t-1110 + ma-hs-ela-t-1112 |
| `text-anchor:english-12-u7-11-12.RL.7` | PASS | 11-12.RL.7 instantiated by ma-hs-ela-t-1208 + ma-hs-ela-t-1209 |
| `text-anchor:english-11-u5-11-12.RL.9` | PASS | 11-12.RL.9 instantiated by ma-hs-ela-t-1107 + ma-hs-ela-t-1108 |
| `lane-self-contained` | PASS | all authored artifacts live under the ELA lane |
