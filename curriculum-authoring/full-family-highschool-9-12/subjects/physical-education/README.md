# Grades 9-12 Physical Education — Manuel Academy

Four continuous high-school physical-education courses (Grades 9, 10, 11, 12) extending the frozen Grade 8 course, aligned to the **Michigan K-12 Physical Education Standards (2017)** grades 9-12 LEVEL 1 and LEVEL 2 expectations.

| | |
| --- | --- |
| Courses | 4 (`ma-g9-physical-education` … `ma-g12-physical-education`) |
| Units | 36 (9 per course) |
| Lessons | 432 (108 per course) |
| Unit assessments | 36 |
| Michigan PE levels | LEVEL 1 in grades 9-10, LEVEL 2 in grades 11-12 |
| Validation | 12 gates, all passing; 34 tests |

## The four-year arc

| Grade | Level | Focus |
| --- | --- | --- |
| 9 | 1 | Safe self-management and the stop rule; movement competence across invasion, net/wall, target, striking, rhythmic, individual, and outdoor categories; fitness literacy without body metrics; inclusive design as an assessed skill. |
| 10 | 1 | Self-analysis and skill refinement without video; tactics across all activity categories; the learner's first self-designed six-week program; recovery and injury prevention; adapted and alternative activity forms; leadership and officiating. |
| 11 | 2 | Periodized program design; two contrasting specializations; advanced game sense; technique-first strength and mobility; outdoor and community recreation planning; inclusive event facilitation; movement and stress. |
| 12 | 2 | Auditing what survives graduation; a fully independent training cycle; the real cost of staying active; a personal challenge; movement for mental health; adapting an activity across a lifespan; a facilitated inclusive session; adult self-care limits. |

The progression is deliberate: Grade 9 broadens so that later specialization is a choice rather than a default, Grade 10 moves from performing a skill to directing it, Grade 11 hands over the program, and Grade 12 removes the school scaffold entirely. The validator enforces that no year reuses another year's units.

## How a 12-day unit is built

Each unit carries **six topics across twelve days, in two passes**. Days 1-6 acquire each topic. Days 7-12 return to the same six under the unit's own **transfer condition**. Every second-pass lesson also carries a prose-independent `manuel-academy.pe-transfer-authority.v2` record for its action, duration/continuity, stop/rest authority, transfer requirement, completion evidence, equal-credit routes, rubric, and adaptive/guardian expectations.

The second pass is a separate mastery occasion, not a repeat, so it carries its own objectives, success criteria, lesson flow, activity, formative check, and extension, plus a tutor route for a learner for whom the added demand is too much that day — dropping back to the first-pass version is scored as full participation. This is what makes the multi-occasion mastery rule real rather than a formality: the two occasions are separated by time *and* by demand. The `distinct-lessons` gate fails the build if any lesson is a relabelled copy of another.

## Participation floor

Nothing in these courses scores **body size, weight, weight change, body composition, or appearance.** No fitness-test norm table, percentile, or peer comparison is used anywhere. **No photograph, video, or voice recording of the learner is required or accepted as a requirement** — self-observation, description, and demonstration to one trusted adult are the intended evidence routes, not fallbacks. **No task requires performing in front of an audience.**

Every unit carries an inclusive adaptation that reaches the same standard by another route, and every lesson carries an explicit seated route, an explicit solo route, a route for a learner who declines a task, and a stop rule. **An adapted or described performance is full credit, not partial credit** — a learner who completes four years entirely through seated, solo, low-impact, and described routes earns exactly the same credit as any other learner.

These are not aspirations in prose — they are the `no-body-metrics`, `no-media-route`, `no-public-performance`, `pe-inclusive-path`, and `privacy-guard` gates, and each has a test proving it catches a violation.

## Layout

```
physical-education/
  README.md                     this file
  standards-reference.md        the five standards, the LEVEL structure, verification method, mapping_status policy
  pacing-and-credit.md          pacing, the Michigan minimum vs. Manuel Academy provision, credit recommendation
  validation-contract.md        the eleven gates and the limits of the heuristics
  authoring-boundaries.md       what this lane owns, what it did not touch, handoff notes
  tools/
    course-data.mjs             the authored content — units, topics, tasks, adaptations, guardian notices
    transfer-authority.mjs      normalized second-pass semantic authority and source validation
    build-courses.mjs           expands course-data into the canonical Study-compatible shape
    validate-course.mjs         the twelve gates
    validate-course.test.mjs    proves each gate can fail
  build/                        generated; not imported into curriculum-content by this lane
```

## Commands

```bash
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs
```

```bash
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/validate-course.mjs
```

```bash
node --test curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/
```

Tests use the Node built-in runner rather than vitest because this worktree has no `node_modules` installed; they run with no install step.

## Not claimed

This is locally authored curriculum aligned to published Michigan standards. It is **not** a claim of state approval, accreditation, licensure, or automatic credit, and it awards no credit. See [`pacing-and-credit.md`](pacing-and-credit.md).
