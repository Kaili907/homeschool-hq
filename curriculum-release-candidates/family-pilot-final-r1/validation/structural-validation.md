# Structural validation

Overall: **PASS**
Classification: **FINAL_CURRICULUM_STRUCTURE_READY**
Blocking failures: **0**

| Check | Result | Detail |
|---|---:|---|
| exact-supported-grades | PASS | grades=[3, 4, 5, 7, 8, 9, 10, 11, 12] |
| grade-6-absent | PASS | no structural record has grade 6 |
| exact-ten-subject-families | PASS | subjects=arts-and-music,english-language-arts,financial-literacy,health,mathematics,physical-education,ready-for-life,science,social-studies,technology |
| world-language-absent | PASS | no internally authored World Language record |
| complete-grade-subject-matrix | PASS | actual=90 expected=90 |
| unique-course-slots | PASS | unique=90 |
| unique-unit-refs | PASS | unique=698 |
| unique-required-lesson-refs | PASS | unique=8292 |
| unique-assessment-refs | PASS | unique=699 |
| unit-course-integrity | PASS | units=698 |
| lesson-unit-integrity | PASS | lessons=8292 |
| assessment-course-integrity | PASS | assessments=699 |
| unit-lesson-totality | PASS | unitRefs=8292 index=8292 |
| course-derived-counts | PASS | course counts match indexes |
| schedule-once-per-course-day | PASS | duplicateDays=0 scheduled=8292 |
| production-slot-totality | PASS | slots=8292 |
| production-slots-unbound | PASS | no moving production-final branch imported |
| science-alias-not-rename | PASS | four HS science aliases preserve authored IDs |
| standards-ref-totality | PASS | refs=90 |
| advisory-honesty | PASS | advisory states are not promoted to VERBATIM |
| source-ledger-totality | PASS | inputs=10 |
| sealed-1.0.0-tree-unchanged | PASS | tree=1f18bb1af429ecac9124d39984b288181c7a154b |
| g8-math-180-day-required-path | PASS | 180 required lessons on 180 unique days |
| expected-release-totals | PASS | courses=90 units=698 lessons=8292 assessments=699 |
