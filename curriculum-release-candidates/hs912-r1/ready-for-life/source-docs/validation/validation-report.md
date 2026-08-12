# Validation Report — High School Ready for Life 9-12

`node validation/validate.mjs` — **142/142 checks passed**, 0 failed.

Run on 2026-08-12. Generation is deterministic: regenerating the courses and re-running
this validator reproduces this report byte for byte.

| Result | Check | Details |
| --- | --- | --- |
| PASS | competency framework exists | /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-rfl-finlit-r1/curriculum-authoring/full-family-highschool-9-12/subjects/ready-for-life/standards/manuel-academy-rfl-9-12-competencies.json |
| PASS | framework is declared LOCAL_COMPOSITION | LOCAL_COMPOSITION |
| PASS | framework claims no jurisdiction | jurisdiction=null |
| PASS | framework explicitly disclaims external standards authority | disclaimed |
| PASS | framework states the published grades 5/7/8 course is unmodified | NONE |
| PASS | safety charter present | 6 clauses |
| PASS | framework states that a click cannot certify a real-world task | stated |
| PASS | framework states the multi-occasion evidence rule | stated |
| PASS | g9: units.json exists | ready-for-life-9/units.json |
| PASS | g9: lessons.jsonl exists | ready-for-life-9/lessons.jsonl |
| PASS | g9: assessments.json exists | ready-for-life-9/assessments.json |
| PASS | g9: daily-schedule.csv exists | ready-for-life-9/daily-schedule.csv |
| PASS | g9: course-guide.md exists | ready-for-life-9/course-guide.md |
| PASS | g9: lesson-sequence.md exists | ready-for-life-9/lesson-sequence.md |
| PASS | g9: 6 units | 6 |
| PASS | g9: 36 lessons | 36 |
| PASS | g9: 6 unit assessments | 6 |
| PASS | g9: every unit is 6 lessons | uniform |
| PASS | g9: lesson ids unique | 36 |
| PASS | g9: every unit lesson_id resolves | 36 refs |
| PASS | g9: course_id consistent | ma-g9-ready-for-life |
| PASS | g9: course_day contiguous 1..36 | contiguous |
| PASS | g9: every unit assessment_id resolves | 6 |
| PASS | g9: lessons carry the local grade progression string | Manuel Academy RFL Grade 9 progression |
| PASS | g9: every competency domain resolves to the framework | resolved |
| PASS | g9: one schedule row per lesson | 36 |
| PASS | g9: schedule lesson refs align | aligned |
| PASS | g9: schedule sign-off column matches lessons | consistent |
| PASS | g9: schedule spans 36 weeks | 36 |
| PASS | g9: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g9: adult-only fields present on every lesson | 3 protected fields |
| PASS | g10: units.json exists | ready-for-life-10/units.json |
| PASS | g10: lessons.jsonl exists | ready-for-life-10/lessons.jsonl |
| PASS | g10: assessments.json exists | ready-for-life-10/assessments.json |
| PASS | g10: daily-schedule.csv exists | ready-for-life-10/daily-schedule.csv |
| PASS | g10: course-guide.md exists | ready-for-life-10/course-guide.md |
| PASS | g10: lesson-sequence.md exists | ready-for-life-10/lesson-sequence.md |
| PASS | g10: 6 units | 6 |
| PASS | g10: 36 lessons | 36 |
| PASS | g10: 6 unit assessments | 6 |
| PASS | g10: every unit is 6 lessons | uniform |
| PASS | g10: lesson ids unique | 36 |
| PASS | g10: every unit lesson_id resolves | 36 refs |
| PASS | g10: course_id consistent | ma-g10-ready-for-life |
| PASS | g10: course_day contiguous 1..36 | contiguous |
| PASS | g10: every unit assessment_id resolves | 6 |
| PASS | g10: lessons carry the local grade progression string | Manuel Academy RFL Grade 10 progression |
| PASS | g10: every competency domain resolves to the framework | resolved |
| PASS | g10: one schedule row per lesson | 36 |
| PASS | g10: schedule lesson refs align | aligned |
| PASS | g10: schedule sign-off column matches lessons | consistent |
| PASS | g10: schedule spans 36 weeks | 36 |
| PASS | g10: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g10: adult-only fields present on every lesson | 3 protected fields |
| PASS | g11: units.json exists | ready-for-life-11/units.json |
| PASS | g11: lessons.jsonl exists | ready-for-life-11/lessons.jsonl |
| PASS | g11: assessments.json exists | ready-for-life-11/assessments.json |
| PASS | g11: daily-schedule.csv exists | ready-for-life-11/daily-schedule.csv |
| PASS | g11: course-guide.md exists | ready-for-life-11/course-guide.md |
| PASS | g11: lesson-sequence.md exists | ready-for-life-11/lesson-sequence.md |
| PASS | g11: 6 units | 6 |
| PASS | g11: 36 lessons | 36 |
| PASS | g11: 6 unit assessments | 6 |
| PASS | g11: every unit is 6 lessons | uniform |
| PASS | g11: lesson ids unique | 36 |
| PASS | g11: every unit lesson_id resolves | 36 refs |
| PASS | g11: course_id consistent | ma-g11-ready-for-life |
| PASS | g11: course_day contiguous 1..36 | contiguous |
| PASS | g11: every unit assessment_id resolves | 6 |
| PASS | g11: lessons carry the local grade progression string | Manuel Academy RFL Grade 11 progression |
| PASS | g11: every competency domain resolves to the framework | resolved |
| PASS | g11: one schedule row per lesson | 36 |
| PASS | g11: schedule lesson refs align | aligned |
| PASS | g11: schedule sign-off column matches lessons | consistent |
| PASS | g11: schedule spans 36 weeks | 36 |
| PASS | g11: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g11: adult-only fields present on every lesson | 3 protected fields |
| PASS | g12: units.json exists | ready-for-life-12/units.json |
| PASS | g12: lessons.jsonl exists | ready-for-life-12/lessons.jsonl |
| PASS | g12: assessments.json exists | ready-for-life-12/assessments.json |
| PASS | g12: daily-schedule.csv exists | ready-for-life-12/daily-schedule.csv |
| PASS | g12: course-guide.md exists | ready-for-life-12/course-guide.md |
| PASS | g12: lesson-sequence.md exists | ready-for-life-12/lesson-sequence.md |
| PASS | g12: 6 units | 6 |
| PASS | g12: 36 lessons | 36 |
| PASS | g12: 6 unit assessments | 6 |
| PASS | g12: every unit is 6 lessons | uniform |
| PASS | g12: lesson ids unique | 36 |
| PASS | g12: every unit lesson_id resolves | 36 refs |
| PASS | g12: course_id consistent | ma-g12-ready-for-life |
| PASS | g12: course_day contiguous 1..36 | contiguous |
| PASS | g12: every unit assessment_id resolves | 6 |
| PASS | g12: lessons carry the local grade progression string | Manuel Academy RFL Grade 12 progression |
| PASS | g12: every competency domain resolves to the framework | resolved |
| PASS | g12: one schedule row per lesson | 36 |
| PASS | g12: schedule lesson refs align | aligned |
| PASS | g12: schedule sign-off column matches lessons | consistent |
| PASS | g12: schedule spans 36 weeks | 36 |
| PASS | g12: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g12: adult-only fields present on every lesson | 3 protected fields |
| PASS | expected number of guardian sign-off lessons | 48 of 144 |
| PASS | sign-off lessons are exactly the real-world application and performance-task days | days 4,6 |
| PASS | every sign-off lesson requires an adult attestation | 48 lessons |
| PASS | attestation names the observing adult role, what was observed, and the date | 3 fields |
| PASS | every lesson records that a click alone is insufficient | 144 lessons |
| PASS | every sign-off lesson states the click-cannot-certify rule verbatim | stated |
| PASS | every sign-off lesson routes an unattested completion claim | routed |
| PASS | every lesson states that no unsafe unsupervised task is assigned | stated |
| PASS | every lesson enumerates the supervision-required hazards | enumerated |
| PASS | every lesson offers a simulated alternative at equal credit | 144 lessons |
| PASS | every lesson carries a tutor route refusing unsafe or unsupervised action | routed |
| PASS | no learner-facing field ever requests a credential or identifier | 144 lessons scanned, 0 violations |
| PASS | every lesson states the no-credential rule | stated |
| PASS | every lesson routes an offered credential to refusal | routed |
| PASS | every lesson carries the no-shame requirement | no shame |
| PASS | every lesson routes learner shame without recording it | routed |
| PASS | every lesson states the no-forced-disclosure rule | stated |
| PASS | every lesson routes private disclosure without storing it | routed |
| PASS | no lesson requires an identifiable photo, recording, or performance | stated |
| PASS | no lesson requires media | optional |
| PASS | every lesson states the not-advice boundary | stated |
| PASS | every lesson routes an advice request to a qualified human | routed |
| PASS | every lesson tells the learner to verify local rules rather than assume | stated |
| PASS | practice generation never directly awards mastery | 144 lessons |
| PASS | mastery requires evidence on at least two separate occasions | two-occasion rule |
| PASS | an attested real-world performance counts only when the attestation exists | stated |
| PASS | parent-visible evidence is minimized on every lesson | minimized |
| PASS | grade 12 declares a senior capstone unit | Transition-to-Adulthood Capstone |
| PASS | the senior capstone is the final unit of grade 12 | unit 6 |
| PASS | the senior capstone is a transition-to-adulthood capstone | declared |
| PASS | the senior capstone requires guardian attestation of real-world components | required |
| PASS | the senior capstone names remaining support needs without shame | stated |
| PASS | g9: declares a capstone unit | Grade 9 Independence Capstone |
| PASS | g10: declares a capstone unit | Grade 10 Work-Readiness Capstone |
| PASS | g11: declares a capstone unit | Grade 11 Transition-Planning Capstone |
| PASS | g12: declares a capstone unit | Transition-to-Adulthood Capstone |
| PASS | grade 8 predecessor has 6 units, matching this lane | 6 |
| PASS | grade 8 predecessor uses 6-lesson units, matching this lane | uniform |
| PASS | grade 8 uses the same local progression-string convention this lane extends | Manuel Academy RFL Grade 8 progression |
| PASS | framework predecessor unit list matches the actual grade 8 course | 6 units |
| PASS | grade 8 -> 9 handoff exists | handoff |
| PASS | progression document exists | progression |
