# Validation Report — High School Social Studies 9-12

**Package:** `manuel-academy-highschool-9-12-social-studies-v1`  
**Version:** 1.0.0  
**Validated on:** 2026-08-12  
**Result:** **PASS** (27 of 27 checks passed)

| Check | Result | Details |
| --- | --- | --- |
| four-complete-courses | PASS | 4 courses; required artifacts present |
| nine-units-per-course | PASS | {9: 9, 10: 9, 11: 9, 12: 9} |
| lesson-count | PASS | 432 total; {9: 108, 10: 108, 11: 108, 12: 108} |
| twelve-lessons-per-unit | PASS | every unit has 12 lessons |
| assessment-per-unit | PASS | 9 unit assessments per course |
| lesson-id-pattern | PASS | all 432 match ^ma-gNN-social-studies-uNN-lNN |
| unique-lesson-ids | PASS | 432 unique of 432 |
| unique-unit-ids | PASS | 36 unique of 36 |
| unit-lesson-assessment-refs-resolve | PASS | all unit lesson_ids and assessment_ids resolve |
| course-index-matches | PASS | ['ma-g10-social-studies', 'ma-g11-social-studies', 'ma-g12-social-studies', 'ma-g9-social-studies'] |
| unit-index-complete | PASS | 36 units indexed |
| lesson-index-complete | PASS | 432 rows |
| schedule-covers-every-lesson-once | PASS | 4 x 108 = 432 scheduled, 36 weeks x 3 sessions each |
| grade-8-to-9-continuity | PASS | Grade 8 U9 carries Michigan Grade 8 U6.1 introduction, P3, P4; Grade 9 U1 carries USHG F1; Grade 9 U2 resumes at USHG 6.1.x |
| grade-9-era-sequence-forward-and-complete | PASS | Grade 9 units 2-9 traverse USHG Eras [6, 7, 8, 9] in order |
| michigan-hs-expectation-coverage | PASS | 162 of 162 high school expectation codes carried; gaps: none |
| mmc-required-components | PASS | USHG 39/39 in grade 9; WHG 32/32 in grade 10; Civics 54/54 in grade 11 units 1-5; Economics 33/33 in grade 11 units 6-9 |
| civics-economics-credit-segmentation | PASS | civics units 1-5 = 60 sessions; economics units 6-9 = 48 sessions |
| grade-12-present-and-non-repeating | PASS | 9 units, 108 sessions, no unit title repeats grades 9-11 |
| grade-12-advances-research-and-argument | PASS | every Grade 12 performance task requires independent research, analysis, or defense |
| research-and-argument-progression-documented | PASS | grade 8 supported inquiry -> 9 counterclaim -> 10 comparative -> 11 policy/constitutional -> 12 independent defended research |
| multi-occasion-mastery | PASS | all 432 lessons require independent evidence and transfer on at least two separate occasions |
| source-provenance-present | PASS | every lesson and unit names its source focus and real, repository-attributed anchor sources |
| no-quotations-from-sources | PASS | only unit focus terms and one facilitator prompt appear in quotation marks; no source wording is reproduced |
| tutor-boundary-and-static-path | PASS | all 432 lessons declare a static path and a route that refuses to draft graded argument |
| lesson-schema-conformance | PASS | all 432 lessons conform to schemas/lesson.schema.json |
| optional-media-and-accessible-fallback | PASS | all lessons: media optional with a readable fallback |
