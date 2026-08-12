# Integration Notes

## Why this package sits outside `curriculum-content/manuel-academy/1.0.0/`

The released package at `curriculum-content/manuel-academy/1.0.0/` is a sealed artifact:

- Its identity is `manuel-academy-grades-5-7-8-curriculum-v1` with `grades: [5, 7, 8]`.
- Its status is `curriculum-authoring-release-complete`.
- It carries `MANIFEST.json` and `SHA256SUMS.txt` over every file, and a passing `validation.json`
  whose checks assert three grades, thirty courses, and 2736 lessons.
- Its `schemas/lesson.schema.json` constrains `grade` to `5 | 7 | 8` and `lesson_id` to
  `^ma-g(5|7|8)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$`.

Writing grades 9–12 into that tree would invalidate the manifest, the hash list, the validation
record, and the schema, and would require edits to shared index files owned by other authoring work.
This package is therefore self-contained and additive.

## What this package contains

Social studies only, grades 9–12. It does not modify any file under `curriculum-content/`.

## How to merge when the full high school package is assembled

1. **Schema.** Adopt `schemas/lesson.schema.json` from this package, or widen the released schema's
   `grade` enum to `[5, 7, 8, 9, 10, 11, 12]` and its `lesson_id` pattern to `^ma-g(5|7|8|9|10|11|12)-`.
   The high school schema additionally requires `source_use`, `citation_requirement`, `tutor_boundary`,
   and `static_path_available`; those fields are additive and do not conflict with the 5–7–8 records.
2. **Course folders.** Copy `grades/grade-{9,10,11,12}/courses/social-studies/` into the target tree
   unchanged. Paths and identifiers already follow the released convention.
3. **Indexes.** Append the entries in `course-index.json`, `unit-index.json`, and `lesson-index.csv`
   to the released files. Column order in `lesson-index.csv` matches the released file exactly.
4. **Grade-level files.** Each grade needs a `grade-overview.md`, a `family-weekly-overview.md`, and a
   combined `daily-schedule.csv` spanning all subjects. Those are grade-level artifacts spanning every
   subject and are **not** owned by this package. `grades/grade-N/course-schedule.csv` here gives the
   social studies rows for that combined schedule.
5. **Manifest and validation.** Regenerate `MANIFEST.json`, `SHA256SUMS.txt`, and `validation.json` for
   the combined package, and update `curriculum-manifest.json` counts, `grades`, and `package_id`.

## Stable references

Identifiers in this package are stable and are safe to reference from runtime code, schedules, and
progress records:

- Course: `ma-g{9,10,11,12}-social-studies`
- Unit: `<course_id>-u01` through `-u09`
- Lesson: `<course_id>-uNN-lNN`, `l01` through `l12` per unit
- Assessment: `<unit_id>-assessment`

Every lesson also carries `course_day` 1–108, which is the ordering key used by
`grades/grade-N/course-schedule.csv`.
