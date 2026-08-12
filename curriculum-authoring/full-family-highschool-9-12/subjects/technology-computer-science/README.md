# Technology and Computer Science — Grades 9–12

Four continuous courses extending the Grade 8 exit point (`ma-g8-technology`)
through a full high-school computer-science progression.

| Grade | Course ID | Title | Units | Sessions |
| --- | --- | --- | --- | --- |
| 9 | `ma-g9-technology` | Computer Science Foundations and Human-Centered Design | 6 | 36 |
| 10 | `ma-g10-technology` | Data, Algorithms, and Secure Systems | 6 | 36 |
| 11 | `ma-g11-technology` | Software Engineering, Web Systems, and Applied Data Science | 6 | 36 |
| 12 | `ma-g12-technology` | Advanced Computing, Ethics, and Capstone | 6 | 48 |

**Totals:** 4 courses · 24 units · 156 lessons · 24 unit assessments.

Grade 12 runs 48 sessions rather than 36: the capstone units (U5 and U6) are 12
sessions each, so the capstone gets 24 sustained sessions instead of 12. All
other units are 6 sessions.

## Layout

Each `grade-NN/` directory holds the same five files the Grade 5/7/8 release
uses, so the packages are drop-in compatible with the existing course shape:

- `units.json` — unit specs, topics, performance tasks, lesson and assessment refs
- `lessons.jsonl` — one JSON lesson per line, in the 1.0.0 release lesson shape (see Schema compatibility)
- `assessments.json` — unit assessment sets, rubrics, mastery interpretation
- `course-guide.md` — course description, outcomes, scope and sequence, capstone
- `lesson-sequence.md` — readable day-by-day sequence

Alongside them:

- `grade-8-to-9-handoff.md` — what Grade 9 assumes, and thread continuity G8→G12
- `standards-coverage.md` — strand coverage map, generated from `units.json`
- `validate.mjs` — executable validation of every constraint below

## Stable refs

IDs are deterministic and content-independent:

```
unit    ma-g{grade}-technology-u{NN}
lesson  ma-g{grade}-technology-u{NN}-l{NN}
assess  ma-g{grade}-technology-u{NN}-assessment
```

`course_day` runs contiguously from 1 to the course session count (36 for Grades
9–11, 48 for Grade 12) with no gaps. Regenerating the courses produces
byte-identical IDs.

## Safety constraints enforced

Every lesson carries, and `validate.mjs` verifies:

- **No credentials.** No real password, API key, access token, account
  credential, private message, precise location, or identifiable image is ever
  used or requested. Only clearly fictional placeholder values appear. The
  validator also scans the whole tree for credential-shaped literals.
- **No live exploitation.** All security work stays in sandboxed, simulated, or
  fictional environments. Nothing scans, probes, exploits, or attempts access
  against real systems, networks, accounts, services, or people. The Grade 10
  and Grade 12 security units are explicitly written as paper threat models and
  defensive reviews of fictional systems.
- **Tutor boundary.** The tutor may explain concepts, ask diagnostic questions,
  and help debug. It never silently completes graded project work — this is
  encoded as a dedicated `adaptive_tutor_routes` signal on every lesson.
- **Accessible route.** Eight accommodation provisions per lesson, including
  executive-function scaffolding for multi-session projects and a
  screen-reader/keyboard-only/paper-and-trace route for every programming task.
  Media is never required and always has a readable fallback.
- **No topic assessed before it is taught.** Every unit topic gets at least one
  instructional lesson before any mastery-check, assessment, or correction
  lesson; those phases are scoped to the whole unit, never to a single topic.
  `validate.mjs` fails the build otherwise.

## Study Engine compatibility

No new engine work. Each lesson exposes a `study_integration` block:

```json
{ "resumable_by_segment": true, "segment_count": 5, "artifact_persistence": "..." }
```

`segment_count` always equals `lesson_flow.length`, so the existing segment
resume model applies unchanged. Project and artifact persistence is specified as
**safe refs and metadata only** — artifact type, learner-supplied title,
family-chosen storage location, completion state, rubric evidence, revision
count. Raw learner artifacts, media, and full project files are explicitly not
stored in the study record unless host storage later supports it.

## Validate

```bash
node validate.mjs
```

## Schema compatibility

Lessons carry the **exact 30-field shape** the Grade 8 course uses in the 1.0.0
release, plus one additive field (`study_integration`). Field parity was checked
against `grade-8/courses/technology/lessons.jsonl` and
`grade-8/courses/arts-and-music/lessons.jsonl`: no Grade 8 field is missing.

They deliberately do **not** validate against
`curriculum-content/manuel-academy/1.0.0/schemas/lesson.schema.json`. That file
is scoped to the frozen release and hard-codes two constraints that exclude high
school by construction:

```json
"grade":     { "enum": [5, 7, 8] }
"lesson_id": { "pattern": "^ma-g(5|7|8)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$" }
```

Every other v1 constraint — all 17 required fields, array minimums, types — is
satisfied. Admitting grades 9–12 requires widening those two constraints, which
lives outside this directory.

The newer `curriculum-content/manuel-academy/schema-sets/2.0.0/schema-set.json`
already allows `grade` 1–12 and generic IDs, but it is a **different record
shape** (`course_ref`/`unit_ref` instead of `course_id`/`unit_number`,
`safety_privacy` instead of `safety_and_privacy`, `additionalProperties: false`).
These packages target the 1.0.0 shape because that is what the Grade 8 exit
point and the current Study Engine consume. Retargeting to 2.0.0 is a
mechanical remap if the platform moves to that set.

## Integration status

These packages are authored content only. They are **not** wired into the served
curriculum, and nothing outside this directory was modified. `node
scripts/build-curriculum.mjs` still reports its unchanged 30 courses / 232 units
/ 2736 lessons, because it scans `curriculum-content/` only.

Serving grades 9–12 is a separate, cross-cutting change. It cannot be done from
inside this directory, and it touches a release that is explicitly marked
immutable. It would require, at minimum:

| What | Where | Why |
| --- | --- | --- |
| Release decision | `curriculum-content/manuel-academy/production-release-registry.json` | 1.0.0 is `curriculum-authoring-release-complete` and pinned as the single active release. High school should almost certainly be a new version rather than a mutation of 1.0.0. |
| Manifest | `1.0.0/curriculum-manifest.json` | `package_id` is `manuel-academy-grades-5-7-8-curriculum-v1`; `grades` and `counts` are fixed. |
| Build gate | `scripts/build-curriculum.mjs` | `EXPECTED = { courses: 30, units: 232, lessons: 2736, grades: ['5','7','8'] }` — hard-fails on any other count. |
| Lesson schema | `1.0.0/schemas/lesson.schema.json` | `grade` enum and `lesson_id` pattern exclude 9–12 (see Schema compatibility). |
| Runtime grade allowlists | `src/admin/curriculum/readModel.ts`, `src/admin/curriculum/httpSource.ts`, `src/study/contracts/production/content.ts`, `src/curriculum/family-pilot/source.node.ts` | Each hard-codes grades 5/7/8. |
| Count-asserting tests | `src/admin/curriculum/CurriculumReleaseHistory.test.tsx`, `src/admin/curriculum-validation/model.test.ts`, and the `manuel-academy-grades-5-7-8-curriculum-v1` fixtures | Assert the 5/7/8 counts and package id. |

Sequencing that work is a platform decision, not an authoring one.
