# High School ELA 9-12 — Validation Report

**Package:** `manuel-academy-highschool-9-12-ela`  
**Validated:** 2026-08-12  
**Result:** **PASS** — 213/213 checks passed, 0 failed

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
| `assessment-weight-non-decreasing:english-9` | PASS | 0 -> 38 |
| `assessment-points-sum:english-10` | PASS | all |
| `assessment-rubric:english-10` | PASS | all |
| `assessment-reassessment:english-10` | PASS | all |
| `assessment-authorship-rule:english-10` | PASS | all |
| `assessment-weight-non-decreasing:english-10` | PASS | 38 -> 38 |
| `assessment-points-sum:english-11` | PASS | all |
| `assessment-rubric:english-11` | PASS | all |
| `assessment-reassessment:english-11` | PASS | all |
| `assessment-authorship-rule:english-11` | PASS | all |
| `assessment-weight-non-decreasing:english-11` | PASS | 38 -> 44 |
| `assessment-points-sum:english-12` | PASS | all |
| `assessment-rubric:english-12` | PASS | all |
| `assessment-reassessment:english-12` | PASS | all |
| `assessment-authorship-rule:english-12` | PASS | all |
| `assessment-weight-non-decreasing:english-12` | PASS | 44 -> 52 |
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
| `lane-self-contained` | PASS | all authored artifacts live under the ELA lane |
