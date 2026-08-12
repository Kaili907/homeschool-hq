# Grade 3–4 Arts and Music

**Package:** Manuel Academy Full-Family Grade 3–4 Curriculum Authoring
**Subject:** Arts and Music
**Grades:** 3, 4
**School-year model:** 36 weeks, twice-weekly cadence
**Status:** draft — curriculum-authoring stage, not yet merged into production `curriculum-content`

## What this is

Two complete, full-year Grade 3 and Grade 4 Arts and Music courses, authored to the same lesson/unit/
assessment blueprint used by the existing Manuel Academy Grade 5 Arts and Music course
(`curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/arts-and-music`), scaled for 8–10 year
old learners and vertically aligned so a learner moving Grade 3 → Grade 4 → Grade 5 experiences a coherent,
choice-based arts progression.

This package introduces **no new Study Engine**. Content is authored to be Study-compatible: resumable by
lesson segment, with stable IDs, explicit mastery rules, and structured tutor routes that a runtime can
consume the same way it consumes the existing Grade 5/7/8 package.

## Courses

| Grade | Course ID | Units | Lessons | Cadence | Capstone |
| --- | --- | --- | --- | --- | --- |
| 3 | `ma-g3-arts-music` | 6 | 72 | twice weekly | A choice-based art and music portfolio shared privately, in writing, or with an audience of choice. |
| 4 | `ma-g4-arts-music` | 6 | 72 | twice weekly | A choice-based arts portfolio and exhibition or private sharing event. |

## Scope progression

- **Grade 3** — elements of art and sound; materials and making; music foundations (beat, voice,
  instruments); drama and movement stories; art and music in daily life and community; portfolio and
  choice showcase.
- **Grade 4** — elements and principles of art and music; techniques, media, and craftsmanship; music
  foundations and listening; theater, storytelling, and movement; arts, culture, and context; portfolio,
  rehearsal, and exhibition.

Both courses use Michigan Arts standards anchors (Creating, Performing/Presenting, Responding, Connecting)
across Visual Arts, Music, Theatre, and Dance. See `standards-map.md`.

## Folder layout

Each `grade-3/` and `grade-4/` folder contains:

- `course-guide.md` — course manifest: description, outcomes, mastery policy, scope-and-sequence table, capstone
- `units.json` — the 6 units, each with standards, essential question, topics, performance task, and lesson refs
- `lessons.jsonl` — one JSON object per lesson (72 total per grade), cycling a 12-phase instructional arc
  twice through 6 topics per unit
- `assessments.json` — one unit assessment per unit with scored prompts, mastery interpretation, and rubric
- `schedule.json` — maps every lesson to a week (1–36) and one of two weekly slots exactly once
- `lesson-sequence.md` — human-readable day-by-day rendering of `lessons.jsonl`

Subject-wide files: `standards-map.md`, `accessibility-and-safety-policy.md`,
`portfolio-and-presentation.md`, `manifest.json`.

## Non-negotiable presentation boundaries

- No lesson or capstone ever *requires* public performance, voice recording, or camera/photo use.
- Every performance or presentation task states a private, written, or no-audio alternative.
- No copyrighted full lyrics, sheet music, or protected works are imported; only original student work,
  public-domain material, or properly licensed excerpts are used.
- The submitted work must remain the student's own authorship.

See `accessibility-and-safety-policy.md` for the full policy.
