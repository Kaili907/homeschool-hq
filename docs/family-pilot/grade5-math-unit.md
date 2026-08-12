# Grade 5 Math static pilot unit validator

## What this checks

`scripts/family-pilot/validate-grade5-math-unit.mjs` is a deterministic,
local-only check that a single Grade 5 Math unit from the frozen Manuel
Academy curriculum-content (`curriculum-content/manuel-academy/`) is
structurally usable for the Family Pilot. It does not judge the entire
Grade 5 Math curriculum — only the one unit it is pointed at.

It verifies, for the named unit:

- the active curriculum release resolves uniquely from
  `production-release-registry.json`
- `units.json`, `lessons.jsonl`, and `assessments.json` exist for
  grade 5 / mathematics under that release, and all three parse
- the unit record exists and its identifiers are internally consistent
  (`unit_id` ↔ `unit_number`, each `lesson_ids` entry ↔ the unit,
  `assessment_id` follows the `<unit_id>-assessment` convention)
- every lesson the unit references exists exactly once in
  `lessons.jsonl`, belongs to the same course, and carries the required
  instructional content (title, learning objectives, success criteria,
  a non-empty lesson flow, scoring guidance)
- the unit's assessment record exists, matches the unit number, and has
  scored prompts
- a matching practice reference exists: an entry in
  `src/curriculum/practice/grade5MathPracticeUnits.ts` for the unit
  number, with a title matching the curriculum-content unit title, and
  the generator file it points at (`src/curriculum/grade5MathUnit<N>Generator.ts`)
  actually exists on disk

No network access is used; every check reads a file already present in
the working tree.

## Why an explicit unit is required

As of this writing, **no single Grade 5 Math unit is designated in this
repository as "the" static Family Pilot candidate.** The only Family
Pilot design found in repo history designates the pilot's static content
at the *course* level (the whole frozen Grade 5 mathematics course, all
10 units), not a specific unit — and that design lives on an unmerged
branch (`mac/family-pilot-curriculum-r1`, commit `1830877`), not in this
worktree.

Rather than invent a unit designation, this validator requires the
caller to name a unit explicitly. If none is given (or the input isn't
recognized), it reports:

```
PILOT_STATIC_UNIT_DESIGNATION_REQUIRED
```

Once a specific unit is designated for the pilot (by whoever owns that
decision), pass it explicitly — see Usage below — or wire that decision
into a future caller of this script.

## Usage

```bash
node scripts/family-pilot/validate-grade5-math-unit.mjs --unit=3
node scripts/family-pilot/validate-grade5-math-unit.mjs --unit=ma-g5-mathematics-u03
node scripts/family-pilot/validate-grade5-math-unit.mjs --unit=3 --format=json
```

Exit codes:

- `0` — unit passed every check
- `1` — unit failed at least one check
- `2` — no unit named / unrecognized input (`PILOT_STATIC_UNIT_DESIGNATION_REQUIRED`)

## Tests

```bash
npx vitest run --project root-app scripts/family-pilot/validate-grade5-math-unit.test.ts
```
