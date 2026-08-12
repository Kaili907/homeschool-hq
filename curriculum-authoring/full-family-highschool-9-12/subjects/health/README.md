# Grades 9-12 Health — Manuel Academy

Four continuous high-school health courses (Grades 9, 10, 11, 12) extending the frozen Grade 8 course, aligned to the **Michigan Health Education Standards Guidelines 2025** Grades 9-12 band.

| | |
| --- | --- |
| Courses | 4 (`ma-g9-health` … `ma-g12-health`) |
| Units | 24 (6 per course) |
| Lessons | 144 (36 per course) |
| Unit assessments | 24 |
| Optional guardian-activated module | 1 (6 days, excluded from every course) |
| Validation | 10 gates, all passing; 27 tests |

## The four-year arc

| Grade | Focus |
| --- | --- |
| 9 | Health literacy and decision making; stress, coping, and help-seeking; safety and emergency response including CPR/AED; substance-use prevention; non-diet fueling, sleep, and recovery; personal wellness and HIV basics. |
| 10 | Influence analysis; healthy relationships, boundaries, and consent; communication, conflict, and violence prevention; media and digital influence; substance-misuse refusal and support pathways; mental-health support systems. |
| 11 | Evaluating health information, products, and services; chronic conditions over a long horizon; community and environmental health; navigating health systems, coverage, and confidentiality; community-level substance risk; designing an advocacy project. |
| 12 | Independent adult self-management; support networks after high school; sustainable mental-health maintenance; adult safety and emergency readiness; consumer health and care navigation; personal health plan capstone. |

The progression is deliberate: Grade 9 turns Grade 8's recognition into use, Grade 10 turns inward skill outward into relationships and information, Grade 11 widens to systems, and Grade 12 removes the adult scaffold. The validator enforces that no year reuses another year's units.

## Privacy floor

No course, unit, lesson, or assessment requires **weight, BMI, body-fat, body measurement, calorie counts, diet or body-size goals, medical history, mental-health diagnosis, sexual history, a body photograph, or a voice or video recording.** Every scenario is fictional. A learner who discloses something private is routed to a trusted adult; the disclosure is never recorded or used as assessment evidence. **This course set teaches health information and does not diagnose.**

These are not aspirations in prose — they are the `health-privacy-guard`, `no-body-metrics`, and `no-media-route` gates, and each has a test proving it catches a violation.

## Layout

```
health/
  README.md                     this file
  standards-reference.md        framework, verification method, mapping_status policy
  pacing-and-credit.md          pacing, the Michigan minimum vs. Manuel Academy provision, credit recommendation
  sex-education-module.md       why Section 3 is a separate guardian-activated module
  validation-contract.md        the ten gates and the limits of the heuristics
  authoring-boundaries.md       what this lane owns, what it did not touch, handoff notes
  tools/
    course-data.mjs             the authored content — units, topics, tasks, guards, guardian notices
    build-courses.mjs           expands course-data into the canonical Study-compatible shape
    validate-course.mjs         the ten gates
    validate-course.test.mjs    proves each gate can fail
  build/                        generated; not imported into curriculum-content by this lane
```

## Commands

```bash
node curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/build-courses.mjs
```

```bash
node curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/validate-course.mjs
```

```bash
node --test curriculum-authoring/full-family-highschool-9-12/subjects/health/tools/
```

Tests use the Node built-in runner rather than vitest because this worktree has no `node_modules` installed; they run with no install step.

## Not claimed

This is locally authored curriculum aligned to published Michigan standards. It is **not** a claim of state approval, accreditation, licensure, or automatic credit, and it awards no credit. See [`pacing-and-credit.md`](pacing-and-credit.md).
