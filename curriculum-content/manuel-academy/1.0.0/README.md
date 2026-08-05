# Manuel Academy — Complete Grades 5, 7, and 8 Curriculum v1.0.0

**Authoring release date:** 2026-08-03  
**Grades:** 5, 7, and 8  
**Courses:** 30  
**Units:** 232  
**Lesson blueprints:** 2736  
**School-year model:** 36 weeks / 180 instructional days

## What is complete in this release

This is a production-oriented curriculum-authoring package, not merely a scope-and-sequence outline. It contains:

- ten coordinated courses for each grade;
- complete year, course, unit, week, and daily lesson sequencing;
- a structured blueprint for every lesson, including objectives, standards, five-part lesson flow, student activity, formative check, scoring guidance, adaptive tutor routes, mastery rule, extension, accommodations, safety, privacy, media fallback, parent visibility, and home connection;
- unit assessments with prompts, points, mastery interpretation, rubric dimensions, and accommodation guidance;
- performance tasks and capstones;
- 36-week family overviews and 180-day schedules;
- original short-text banks for Grades 5, 7, and 8;
- shared policies, rubrics, schema, indices, integration instructions, validation evidence, and file hashes.

## Course set for every grade

1. Mathematics
2. English Language Arts
3. Science
4. Social Studies
5. Health
6. Physical Education
7. Ready for Life
8. Technology and Computer Science
9. Arts and Music
10. Financial Literacy

## Lesson totals

- Grade 5: 900
- Grade 7: 900
- Grade 8: 936
- Total: 2736

Grade 8 contains 72 financial-literacy sessions so all seven Michigan personal-finance strands receive deeper treatment. Grades 5 and 7 contain 36 financial-literacy sessions each.

## How to use the package

Start with `grades/grade-X/grade-overview.md`, then open `daily-schedule.csv` and `family-weekly-overview.md`. Each course folder contains:

- `course-guide.md`
- `units.json`
- `assessments.json`
- `lessons.jsonl`
- `lesson-sequence.md`

Machine-readable import begins with `curriculum-manifest.json`, `course-index.json`, `unit-index.json`, `lesson-index.csv`, and `schemas/lesson.schema.json`.

## Important boundary

“Curriculum complete” here means the authored and validated curriculum package is complete. It does not mean the package has been merged into `homeschool-hq`, deployed, connected to production identity or persistence, licensed with third-party full-length texts, or visually produced as thousands of custom media assets. Those are separate integration and production stages.

## Frozen baselines

This release preserves the existing Grade 5 adaptive math, Adaptive English, and Ready for Life artifacts by reference. Their exact filenames, roles, and SHA-256 values are listed in `standards/standards-reference.md` and `curriculum-manifest.json`. They are not included or modified.

## Validation

See `validation/validation-report.md`, `validation/validation.json`, `validation/manifest-verification.txt`, `MANIFEST.json`, and `SHA256SUMS.txt`.
