# Source-Branch Ledger — Grades 3/4 Release Candidate r1

Machine-readable form: [`source-branches.json`](source-branches.json), which is what
`tools/assemble.py` actually reads.

**Resolution rule.** Remote tip when the branch is pushed; otherwise the committed local branch tip.
Six of the seven branches are pushed and their `origin/` ref matches the local ref exactly.
`mac/g34-release-standards-r1` has no `origin/` ref, so its committed local tip was used.

**Uncommitted work.** None. All seven lane worktrees were clean at assembly time, so no required
work was left behind.

**Common base.** All seven branches and this assembly branch share base commit `656efba1`, and every
branch's diff against that base consists only of *added* files under `curriculum-authoring/` or
`curriculum-content/`. No lane modified or deleted a pre-existing file, and no lane touched `src/`,
`scripts/`, `supabase/`, or `tests/`.

## Inputs

| Lane | Branch | Commit | Tip source | Authored under | Contributed |
| --- | --- | --- | --- | --- | --- |
| release-standards | `mac/g34-release-standards-r1` | `a51e93acaf477db41f042df0f77033e237f7e73a` | local (no origin ref) | `curriculum-authoring/…/release/` | contract, standards reference, course matrix, proposed schema, validation contract — **no courses** |
| mathematics | `mac/g34-math-r1` | `64c1a5e80ea44c1da4d54a1a22c64b81be74d0ca` | origin == local | `curriculum-authoring/…/subjects/mathematics/` | `ma-g{3,4}-mathematics` |
| english-language-arts | `mac/g34-ela-r1` | `ef81511c2b582d003e397bb79daa8a26a41e3b10` | origin == local | `curriculum-authoring/…/subjects/english-language-arts/` | `ma-g{3,4}-english-language-arts` |
| science + social-studies | `mac/g34-science-social-r1` | `4c6ca4ef904c0b79dc81f85e3cfed946c20c98d6` | origin == local | **`curriculum-content/…/1.0.0/grades/grade-{3,4}/`** (misplaced) | `ma-g{3,4}-science`, `ma-g{3,4}-social-studies` |
| health + physical-education | `mac/g34-health-pe-r1` | `d0ebaa010cd01d7565967b4578d415dc7c8ee434` | origin == local | `curriculum-authoring/…/subjects/{health,physical-education}/` | `ma-g{3,4}-health`, `ma-g{3,4}-physical-education` |
| ready-for-life + financial-literacy | `mac/g34-rfl-finlit-r1` | `44e54a39c9acdb4635b09d5e56c344b784c41dc5` | origin == local | **`curriculum-content/…/1.0.0/grades/grade-{3,4}/`** (misplaced) | `ma-g{3,4}-ready-for-life`, `ma-g{3,4}-financial-literacy` |
| technology + arts-music | `mac/g34-tech-arts-r1` | `a3a9d336a3033c9650b1f9fb81a7f043d7386600` | origin == local | `curriculum-authoring/…/subjects/{technology-computer-science,arts-music}/` | `ma-g{3,4}-tech-cs`, `ma-g{3,4}-arts-music` |

## Course-to-source map

| Course ID | Grade | Subject | Branch | Source path at that commit |
| --- | ---: | --- | --- | --- |
| `ma-g3-mathematics` | 3 | mathematics | `mac/g34-math-r1` | `…/subjects/mathematics/courses/grade-3/mathematics` |
| `ma-g3-english-language-arts` | 3 | english-language-arts | `mac/g34-ela-r1` | `…/subjects/english-language-arts/grades/grade-3` |
| `ma-g3-science` | 3 | science | `mac/g34-science-social-r1` | `…/1.0.0/grades/grade-3/courses/science` |
| `ma-g3-social-studies` | 3 | social-studies | `mac/g34-science-social-r1` | `…/1.0.0/grades/grade-3/courses/social-studies` |
| `ma-g3-health` | 3 | health | `mac/g34-health-pe-r1` | `…/subjects/health/grade-3` |
| `ma-g3-physical-education` | 3 | physical-education | `mac/g34-health-pe-r1` | `…/subjects/physical-education/grade-3` |
| `ma-g3-ready-for-life` | 3 | ready-for-life | `mac/g34-rfl-finlit-r1` | `…/1.0.0/grades/grade-3/courses/ready-for-life` |
| `ma-g3-tech-cs` | 3 | technology | `mac/g34-tech-arts-r1` | `…/subjects/technology-computer-science/grade-3` |
| `ma-g3-arts-music` | 3 | arts-and-music | `mac/g34-tech-arts-r1` | `…/subjects/arts-music/grade-3` |
| `ma-g3-financial-literacy` | 3 | financial-literacy | `mac/g34-rfl-finlit-r1` | `…/1.0.0/grades/grade-3/courses/financial-literacy` |
| `ma-g4-mathematics` | 4 | mathematics | `mac/g34-math-r1` | `…/subjects/mathematics/courses/grade-4/mathematics` |
| `ma-g4-english-language-arts` | 4 | english-language-arts | `mac/g34-ela-r1` | `…/subjects/english-language-arts/grades/grade-4` |
| `ma-g4-science` | 4 | science | `mac/g34-science-social-r1` | `…/1.0.0/grades/grade-4/courses/science` |
| `ma-g4-social-studies` | 4 | social-studies | `mac/g34-science-social-r1` | `…/1.0.0/grades/grade-4/courses/social-studies` |
| `ma-g4-health` | 4 | health | `mac/g34-health-pe-r1` | `…/subjects/health/grade-4` |
| `ma-g4-physical-education` | 4 | physical-education | `mac/g34-health-pe-r1` | `…/subjects/physical-education/grade-4` |
| `ma-g4-ready-for-life` | 4 | ready-for-life | `mac/g34-rfl-finlit-r1` | `…/1.0.0/grades/grade-4/courses/ready-for-life` |
| `ma-g4-tech-cs` | 4 | technology | `mac/g34-tech-arts-r1` | `…/subjects/technology-computer-science/grade-4` |
| `ma-g4-arts-music` | 4 | arts-and-music | `mac/g34-tech-arts-r1` | `…/subjects/arts-music/grade-4` |
| `ma-g4-financial-literacy` | 4 | financial-literacy | `mac/g34-rfl-finlit-r1` | `…/1.0.0/grades/grade-4/courses/financial-literacy` |

## What this assembly changed about the inputs

Nothing in their content. Only packaging:

1. **Directory layout** keyed on each lesson's own `subject` value, matching the sealed release's
   `grades/grade-N/courses/<subject>/` convention. Six different lane layouts collapse to one.
2. **Schedules** normalized to one CSV shape. Sixteen courses shipped a schedule in four different
   formats (`schedule.csv`, `schedule-36-week.csv`, `course-schedule.csv`, `schedule.json`); all are
   preserved verbatim alongside the content and normalized into `schedules/`. Four courses —
   `ma-g{3,4}-science` and `ma-g{3,4}-social-studies` — shipped **no** schedule; theirs are derived
   from `course_day` order at 3 sessions/week over 36 weeks and marked `provenance: derived`.
   Lanes name the weekday column differently (`day_of_week` in math/ELA, `day_suggestion` in
   health/PE); both are read, so no authored weekday is lost. Rows are blank in that column only
   for the four derived schedules and for the lanes that never assigned a weekday.
3. **Indexes and manifest** generated across all 20 courses at once.
4. **Schema candidate** derived from what the 1800 lessons actually contain, rather than asserting
   the release lane's proposed schema over content that does not match it.

## Deviations recorded rather than fixed

- `ma-g{3,4}-tech-cs` deviate from `release/course-matrix.json`, which specifies
  `ma-g{3,4}-technology-computer-science`. Kept as authored; renaming would rewrite 72 lesson IDs.
- No lesson in any lane emits `standards` in the object form `release/lesson-schema.json` requires,
  so all 1800 lessons fail that schema. Two further mismatches with the same file: ELA's
  `schema_version` is `1.1` against a `const: "1.0"` (360 lessons), and the schema's `subject` enum
  carries the matrix slugs rather than the canonical ones the lane authored (216 lessons).
  Recorded as `lesson-schema-compatibility: FAIL`; not worked around.
- `mac/g34-science-social-r1` and `mac/g34-rfl-finlit-r1` still carry their misplaced paths on their
  own branches. Correcting them belongs to those lane owners.

Details and consequences: [`../standards/standards-custody-report.md`](../standards/standards-custody-report.md).
