# Validation Report — High School Financial Literacy 9-12

`node validation/validate.mjs` — **159/159 checks passed**, 0 failed.

Run on 2026-08-12. Generation is deterministic: regenerating the courses and re-running
this validator reproduces this report byte for byte.

| Result | Check | Details |
| --- | --- | --- |
| PASS | standards corpus exists | /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-hs912-rfl-finlit-r1/curriculum-authoring/full-family-highschool-9-12/subjects/financial-literacy/standards/michigan-personal-finance-9-12-expectations.json |
| PASS | corpus contains exactly PF1-PF7 plus PF4.1 | PF1, PF2, PF3, PF4, PF4.1, PF5, PF6, PF7 |
| PASS | every expectation carries verbatim text | 8 expectations |
| PASS | corpus records a sha256 of the retrieved source document | ff97640535d7864de8d3333669a5f8d8ab8134ebfa0af5f9f938cf2e91ab2735 |
| PASS | corpus records byte length and page count | 537595 bytes / 2 pages |
| PASS | corpus asserts retrieval-not-memory provenance | verification.method |
| PASS | PF7 Paying Taxes is present (the expectation a 6-standard summary would drop) | Paying Taxes |
| PASS | PF4.1 is recorded as a child of PF4 | parent=PF4 |
| PASS | standards custody document exists | standards-custody.md |
| PASS | corpus states that alignment is not approval | limits |
| PASS | g9: units.json exists | financial-literacy-9/units.json |
| PASS | g9: lessons.jsonl exists | financial-literacy-9/lessons.jsonl |
| PASS | g9: assessments.json exists | financial-literacy-9/assessments.json |
| PASS | g9: daily-schedule.csv exists | financial-literacy-9/daily-schedule.csv |
| PASS | g9: course-guide.md exists | financial-literacy-9/course-guide.md |
| PASS | g9: lesson-sequence.md exists | financial-literacy-9/lesson-sequence.md |
| PASS | g9: 7 units (one per expectation) | 7 |
| PASS | g9: 72 lessons | 72 |
| PASS | g9: 7 unit assessments | 7 |
| PASS | g9: unit day counts match the published Grade 8 shape | 10,10,10,11,10,10,11 |
| PASS | g9: expectation PF1 is covered | PF1 |
| PASS | g9: expectation PF2 is covered | PF2 |
| PASS | g9: expectation PF3 is covered | PF3 |
| PASS | g9: expectation PF4 is covered | PF4 |
| PASS | g9: expectation PF4.1 is covered | PF4.1 |
| PASS | g9: expectation PF5 is covered | PF5 |
| PASS | g9: expectation PF6 is covered | PF6 |
| PASS | g9: expectation PF7 is covered | PF7 |
| PASS | g9: lesson ids unique | 72 |
| PASS | g9: every unit lesson_id resolves to a lesson | 72 refs |
| PASS | g9: course_id consistent | ma-g9-financial-literacy |
| PASS | g9: course_day is contiguous 1..72 | contiguous |
| PASS | g9: every unit assessment_id resolves | 7 |
| PASS | g9: lesson unit_title matches its unit | consistent |
| PASS | g9: schedule header | course_day,week,weekday,unit_number,unit_title,lesson_id,phase,focus |
| PASS | g9: one schedule row per lesson | 72 |
| PASS | g9: schedule lesson refs align | aligned |
| PASS | g9: schedule spans 36 weeks | 36 |
| PASS | g9: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g9: adult-only fields present on every lesson | 3 protected fields |
| PASS | g9: assessments carry mastery_interpretation | present |
| PASS | g10: units.json exists | financial-literacy-10/units.json |
| PASS | g10: lessons.jsonl exists | financial-literacy-10/lessons.jsonl |
| PASS | g10: assessments.json exists | financial-literacy-10/assessments.json |
| PASS | g10: daily-schedule.csv exists | financial-literacy-10/daily-schedule.csv |
| PASS | g10: course-guide.md exists | financial-literacy-10/course-guide.md |
| PASS | g10: lesson-sequence.md exists | financial-literacy-10/lesson-sequence.md |
| PASS | g10: 7 units (one per expectation) | 7 |
| PASS | g10: 72 lessons | 72 |
| PASS | g10: 7 unit assessments | 7 |
| PASS | g10: unit day counts match the published Grade 8 shape | 10,10,10,11,10,10,11 |
| PASS | g10: expectation PF1 is covered | PF1 |
| PASS | g10: expectation PF2 is covered | PF2 |
| PASS | g10: expectation PF3 is covered | PF3 |
| PASS | g10: expectation PF4 is covered | PF4 |
| PASS | g10: expectation PF4.1 is covered | PF4.1 |
| PASS | g10: expectation PF5 is covered | PF5 |
| PASS | g10: expectation PF6 is covered | PF6 |
| PASS | g10: expectation PF7 is covered | PF7 |
| PASS | g10: lesson ids unique | 72 |
| PASS | g10: every unit lesson_id resolves to a lesson | 72 refs |
| PASS | g10: course_id consistent | ma-g10-financial-literacy |
| PASS | g10: course_day is contiguous 1..72 | contiguous |
| PASS | g10: every unit assessment_id resolves | 7 |
| PASS | g10: lesson unit_title matches its unit | consistent |
| PASS | g10: schedule header | course_day,week,weekday,unit_number,unit_title,lesson_id,phase,focus |
| PASS | g10: one schedule row per lesson | 72 |
| PASS | g10: schedule lesson refs align | aligned |
| PASS | g10: schedule spans 36 weeks | 36 |
| PASS | g10: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g10: adult-only fields present on every lesson | 3 protected fields |
| PASS | g10: assessments carry mastery_interpretation | present |
| PASS | g11: units.json exists | financial-literacy-11/units.json |
| PASS | g11: lessons.jsonl exists | financial-literacy-11/lessons.jsonl |
| PASS | g11: assessments.json exists | financial-literacy-11/assessments.json |
| PASS | g11: daily-schedule.csv exists | financial-literacy-11/daily-schedule.csv |
| PASS | g11: course-guide.md exists | financial-literacy-11/course-guide.md |
| PASS | g11: lesson-sequence.md exists | financial-literacy-11/lesson-sequence.md |
| PASS | g11: 7 units (one per expectation) | 7 |
| PASS | g11: 72 lessons | 72 |
| PASS | g11: 7 unit assessments | 7 |
| PASS | g11: unit day counts match the published Grade 8 shape | 10,10,10,11,10,10,11 |
| PASS | g11: expectation PF1 is covered | PF1 |
| PASS | g11: expectation PF2 is covered | PF2 |
| PASS | g11: expectation PF3 is covered | PF3 |
| PASS | g11: expectation PF4 is covered | PF4 |
| PASS | g11: expectation PF4.1 is covered | PF4.1 |
| PASS | g11: expectation PF5 is covered | PF5 |
| PASS | g11: expectation PF6 is covered | PF6 |
| PASS | g11: expectation PF7 is covered | PF7 |
| PASS | g11: lesson ids unique | 72 |
| PASS | g11: every unit lesson_id resolves to a lesson | 72 refs |
| PASS | g11: course_id consistent | ma-g11-financial-literacy |
| PASS | g11: course_day is contiguous 1..72 | contiguous |
| PASS | g11: every unit assessment_id resolves | 7 |
| PASS | g11: lesson unit_title matches its unit | consistent |
| PASS | g11: schedule header | course_day,week,weekday,unit_number,unit_title,lesson_id,phase,focus |
| PASS | g11: one schedule row per lesson | 72 |
| PASS | g11: schedule lesson refs align | aligned |
| PASS | g11: schedule spans 36 weeks | 36 |
| PASS | g11: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g11: adult-only fields present on every lesson | 3 protected fields |
| PASS | g11: assessments carry mastery_interpretation | present |
| PASS | g12: units.json exists | financial-literacy-12/units.json |
| PASS | g12: lessons.jsonl exists | financial-literacy-12/lessons.jsonl |
| PASS | g12: assessments.json exists | financial-literacy-12/assessments.json |
| PASS | g12: daily-schedule.csv exists | financial-literacy-12/daily-schedule.csv |
| PASS | g12: course-guide.md exists | financial-literacy-12/course-guide.md |
| PASS | g12: lesson-sequence.md exists | financial-literacy-12/lesson-sequence.md |
| PASS | g12: 7 units (one per expectation) | 7 |
| PASS | g12: 72 lessons | 72 |
| PASS | g12: 7 unit assessments | 7 |
| PASS | g12: unit day counts match the published Grade 8 shape | 10,10,10,11,10,10,11 |
| PASS | g12: expectation PF1 is covered | PF1 |
| PASS | g12: expectation PF2 is covered | PF2 |
| PASS | g12: expectation PF3 is covered | PF3 |
| PASS | g12: expectation PF4 is covered | PF4 |
| PASS | g12: expectation PF4.1 is covered | PF4.1 |
| PASS | g12: expectation PF5 is covered | PF5 |
| PASS | g12: expectation PF6 is covered | PF6 |
| PASS | g12: expectation PF7 is covered | PF7 |
| PASS | g12: lesson ids unique | 72 |
| PASS | g12: every unit lesson_id resolves to a lesson | 72 refs |
| PASS | g12: course_id consistent | ma-g12-financial-literacy |
| PASS | g12: course_day is contiguous 1..72 | contiguous |
| PASS | g12: every unit assessment_id resolves | 7 |
| PASS | g12: lesson unit_title matches its unit | consistent |
| PASS | g12: schedule header | course_day,week,weekday,unit_number,unit_title,lesson_id,phase,focus |
| PASS | g12: one schedule row per lesson | 72 |
| PASS | g12: schedule lesson refs align | aligned |
| PASS | g12: schedule spans 36 weeks | 36 |
| PASS | g12: every lesson has >= 5 lesson_flow segments | segment resume safe |
| PASS | g12: adult-only fields present on every lesson | 3 protected fields |
| PASS | g12: assessments carry mastery_interpretation | present |
| PASS | complete 9-12 progression covers every Michigan Personal Finance expectation | PF1, PF2, PF3, PF4, PF4.1, PF5, PF6, PF7 |
| PASS | practice generation never directly awards mastery | 288 lessons |
| PASS | mastery requires evidence on at least two separate occasions | two-occasion rule |
| PASS | every lesson carries a mastery-evidence tutor route | present |
| PASS | no learner-facing field ever requests real financial or identifying data | 288 lessons scanned, 0 violations |
| PASS | no SSN-shaped literal anywhere in the lane | none |
| PASS | no card-number-shaped literal anywhere in the lane | none |
| PASS | every lesson is flagged simulation-only and requires no real financial data | 288 lessons |
| PASS | every lesson states that no real transaction is required | no-transaction rule |
| PASS | every lesson carries a tutor route refusing real financial data | refusal route |
| PASS | every lesson carries a tutor route declining individualized financial advice | decline route |
| PASS | every lesson states the no-individualized-advice boundary | boundary stated |
| PASS | every lesson carries the non-shaming requirement | no shame |
| PASS | every lesson routes household-hardship disclosure without recording it | hardship route |
| PASS | parent-visible evidence is minimized on every lesson | minimized |
| PASS | no lesson requires media | media optional everywhere |
| PASS | grade 12 declares a capstone unit | PF7 — Paying Taxes: Taxes and the Simulated Adult Finance Capstone |
| PASS | grade 12 capstone is a practical simulated adult-finance capstone | declared |
| PASS | grade 12 capstone requires no real transaction | simulated |
| PASS | grade 12 has exactly one capstone lesson | one |
| PASS | grade 8 uses the same PF code vocabulary this lane extends | PF1, PF1–PF7 synthesis, PF2, PF3, PF4, PF4.1, PF5, PF6, PF7 |
| PASS | grade 8 predecessor has 7 units, matching this lane | 7 |
| PASS | grade 9 keeps the grade 8 unit-length shape | 10,10,10,11,10,10,11 |
| PASS | grade 8 -> 9 handoff document exists | handoff |
| PASS | rigor progression document exists | rigor |
