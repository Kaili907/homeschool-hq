# Manuel Academy — High School Social Studies, Grades 9–12

Michigan-aligned social studies for grades 9 through 12, continuing directly from the Grade 8 course in
`curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/social-studies`.

**Version:** 1.0.0
**Courses:** 4
**Units:** 36
**Lesson blueprints:** 432
**Standards source:** Michigan K-12 Social Studies Standards, v 6/19, Michigan Department of Education

## Courses

| Grade | Course | Sessions | Units | Capstone |
| --- | --- | --- | --- | --- |
| 9 | United States History and Geography | 108 | 9 | A researched United States history argument and policy-debate defense built from primary and secondary evidence with full citation. |
| 10 | World History and Geography | 108 | 9 | A world-historical and geographic investigation of a contemporary global issue, defended with maps, data, and cited multi-regional evidence. |
| 11 | Civics and Economics | 108 | 9 | A paired defense: a documented civic action plan for the civics half-credit and an applied economics analysis for the economics half-credit. |
| 12 | Advanced Civic Inquiry, Research, and Policy Analysis | 108 | 9 | An independent senior research argument with a documented civic action and a public or private defense answering unrehearsed questions. |

## Michigan Merit Curriculum coverage

| Component | Required | Where |
| --- | --- | --- |
| United States History and Geography | 1.0 credit | Grade 9 |
| World History and Geography | 1.0 credit | Grade 10 |
| Civics | 0.5 credit | Grade 11, units 1–5 |
| Economics | 0.5 credit | Grade 11, units 6–9 |

All three required credits are complete at the end of Grade 11. Grade 12 is an elective capstone that
adds rigor rather than repeating prior content.

**Michigan does not assign these credits to specific grades.** The placement above is a Manuel Academy
decision. See `course-sequence-and-placement.md`.

## Layout

```
README.md                                  this file
course-sequence-and-placement.md           placement rationale; what Michigan does and does not require
course-index.json                          one record per course
unit-index.json                            one record per unit (36)
lesson-index.csv                           one row per lesson (432)
schemas/lesson.schema.json                 high school lesson schema (grades 9-12)
standards/
  michigan-hs-social-studies-standards-reference.md   traceable standards outline
  coverage-matrix.md / .json               every expectation mapped to the units carrying it
continuity/
  grade-8-to-grade-9-continuity.md / .json the Grade 8 seam, proven
source-integrity/source-and-citation-policy.md        no invented quotations, no fabricated sources
tutor/tutor-boundaries.md                  what the tutor may and may not do; static path guarantee
integration/INTEGRATION-NOTES.md           how to merge into the released curriculum package
validation/validation.json / .md           validation record
grades/grade-N/
  course-schedule.csv                      36 weeks x 3 sessions
  courses/social-studies/
    course-guide.md                        teacher and family guide
    units.json                             unit specifications, source focus, anchor sources
    lessons.jsonl                          108 lesson blueprints
    assessments.json                       9 unit assessments
    lesson-sequence.md                     readable full sequence
MANIFEST.json / SHA256SUMS.txt             file inventory and hashes
```

## Source integrity

This package names sources and never reproduces their wording. **It contains no quotations and no
fabricated primary sources.** Learners retrieve real documents from named public repositories and
transcribe any quotation themselves. See `source-integrity/source-and-citation-policy.md`.

## Tutor

The tutor may help analyze evidence. The tutor may not ghostwrite a graded argument. A static,
tutor-free path is always available. See `tutor/tutor-boundaries.md`.

## Mastery

One correct answer never establishes mastery. Every lesson requires accurate independent evidence and
successful transfer or retrieval on at least two separate occasions.

## Status

Locally authored and Michigan-aligned. Not a claim of state approval, state review, accreditation, or
automatic credit award by any district.
