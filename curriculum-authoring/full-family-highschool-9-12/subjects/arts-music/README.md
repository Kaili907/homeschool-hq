# Arts and Music — Grades 9–12

Four continuous courses extending the Grade 8 exit point
(`ma-g8-arts-and-music`) through a full high-school arts progression.

| Grade | Course ID | Title | Units | Sessions |
| --- | --- | --- | --- | --- |
| 9 | `ma-g9-arts-and-music` | Studio Direction, Music Literacy, and Critical Practice | 6 | 72 |
| 10 | `ma-g10-arts-and-music` | Technique, Composition, and Media Production | 6 | 72 |
| 11 | `ma-g11-arts-and-music` | Concentration, Craft, and Critical Response | 6 | 72 |
| 12 | `ma-g12-arts-and-music` | Capstone Portfolio and Professional Practice | 6 | 72 |

**Totals:** 4 courses · 24 units · 288 lessons · 24 unit assessments.

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

## Preserved strands

Creation, performance and presentation, response, critique, connections,
portfolio development, music literacy, visual arts, design, and applied arts are
each anchored across all four years. `standards-coverage.md` shows the map; no
listed anchor is unanchored.

**Dance is deliberately out of scope.** These courses teach no choreography,
movement vocabulary, or dance technique, so no unit claims Dance coverage and
Dance is not in the validator's required-anchor list. Claiming it on the
strength of one "physical expression and staging" topic would have been a
string match, not real coverage. A family needing Dance should treat it as a
separate course.

## Stable refs

```
unit    ma-g{grade}-arts-and-music-u{NN}
lesson  ma-g{grade}-arts-and-music-u{NN}-l{NN}
assess  ma-g{grade}-arts-and-music-u{NN}-assessment
```

`course_day` runs contiguously 1..72 within each course, with no gaps. Regenerating the
courses produces byte-identical IDs.

## Privacy and rights constraints enforced

Every lesson carries, and `validate.mjs` verifies:

- **No required public performance.** Every performance, presentation,
  exhibition, and defense has a private, low-audience, or written-and-scored
  route carrying the identical academic target.
- **No required learner voice recording.** Never, in any unit, including the
  Grade 12 capstone.
- **No required photos or video.** Documentation may be written, notated,
  sketched, or adult-verified instead. `media.required` is `false` on all 288
  lessons and a readable fallback is always specified.
- **Copyright integrity.** Only original, public-domain, licensed, or
  family-approved works. Full copyrighted lyrics, sheet music, and other
  protected works are never reproduced without documented rights. Rights and
  permissions review is itself taught — G9 U6, G10 U3/U6, G11 U6, G12 U2.
- **Accessible route.** Nine accommodation provisions per lesson, including
  adaptive instruments and grips, enlarged or braille notation, seated and
  standing studio access, and low-odour/low-dust material substitutes.
- **Documentation target preserved.** Where documentation quality is itself the
  learning target (G10 U6, G11 U6, G12 U5), the accommodation is *artwork-only
  capture with no person in frame* or direct adult verification of the physical
  work — not a sketched substitute that would quietly change the target.
- **No topic assessed before it is taught.** Every unit topic gets a dedicated
  instructional lesson before any assessment or correction lesson; those phases
  are scoped to the whole unit. `validate.mjs` fails the build otherwise.

## Grade 12 capstone

`ma-g12-arts-and-music` is a substantial portfolio/capstone path: proposal and
precedent research (U1), professional practice and rights (U2), sustained
production (U3), refinement and revision (U4), presentation design (U5), and
defense with portfolio completion (U6) — all completable in a fully private
format.

Professional practice sits at **U2**, sessions 13–24, rather than late in the
year. It carries portfolio and application materials, auditions, and
postsecondary pathways, which have to land before real application and audition
deadlines rather than after them.

## Study Engine compatibility

No new engine work. Each lesson exposes a `study_integration` block with
`resumable_by_segment: true` and `segment_count` equal to `lesson_flow.length`,
so the existing segment resume model applies unchanged. Portfolio and artifact
persistence is specified as **safe refs and metadata only** — artifact type,
learner-supplied title, family-chosen storage location, completion state, rubric
evidence, revision count. Raw learner artwork, audio, recordings, and full
project files are explicitly not stored in the study record unless host storage
later supports it.

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
