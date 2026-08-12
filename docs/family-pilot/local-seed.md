# Family pilot local seed

Produces deterministic **local test/preview** fixture data for the
supervised Grade 5 Math pilot: one household, one adult supervisor, one
Grade 5 learner, a second learner for isolation tests, an assigned Grade 5
Math pilot unit reference, and clean starting session/progress state.

This is separate from and does not touch the production seed, migration, or
readiness tooling (`scripts/production-local-preflight.mjs`,
`scripts/family-pilot/readiness.mjs`). It makes **no network calls and no
hosted Supabase writes** — it only computes a JSON structure in memory and,
if asked, writes it to a local file.

## Why the unit reference is an explicit input

No single Grade 5 Math unit is designated in this repository as "the" pilot
unit (see `docs/family-pilot/grade5-math-unit.md`). This seed script
therefore requires the caller to name a unit explicitly — `--unit=` — the
same convention used by `scripts/family-pilot/validate-grade5-math-unit.mjs`.
Passing no unit, or an unrecognized one, is refused rather than defaulted.

## Usage

```bash
# Print a human-readable summary (default)
node scripts/family-pilot/seed-local-pilot.mjs --unit=3

# Print the full fixture dataset as JSON
node scripts/family-pilot/seed-local-pilot.mjs --unit=ma-g5-mathematics-u03 --format=json

# Write the fixture dataset to a local file
node scripts/family-pilot/seed-local-pilot.mjs --unit=3 --out=scripts/family-pilot/output/local-pilot-seed.json

# Vary the deterministic seed (same seed + unit always reproduces the same IDs)
node scripts/family-pilot/seed-local-pilot.mjs --unit=3 --seed=my-local-run
```

`--unit` accepts either a canonical `unit_id` (`ma-g5-mathematics-u03`) or a
bare unit number (`3`). Exit code is `0` on success, `2` when the unit
reference is missing/unrecognized or the `--format` flag is invalid.

## What the fixture contains

- `household` — one synthetic household, `status: 'active'`
- `adults` — one adult supervisor, `role: 'guardian'`
- `learners` — two learners, `role: 'learner'`, grade 5:
  - learner A (`isolationLabel: 'primary'`) — the one the pilot unit is
    assigned to
  - learner B (`isolationLabel: 'isolation-control'`) — exists only so
    isolation tests have a second, distinct learner in the same household
- `assignment` — the requested Grade 5 Math unit reference, assigned to
  learner A only
- `sessions` — one clean session per learner: `progressStatus:
  'not_started'`, `attempts: []`

Every ID is a UUID-v4-shaped string derived deterministically from the
`--seed` value and a role-specific label (via SHA-256), never from
`crypto.randomUUID()` or the system clock — repeat runs with the same
`--unit`/`--seed` produce byte-identical output. No real family PII is used;
names are synthetic placeholders (`Pilot Household 01`, `Pilot Adult
Supervisor`, `Pilot Learner A`/`B`).

## Tests

```bash
npx vitest run --project root-app scripts/family-pilot/seed-local-pilot.test.ts
```

Covers: deterministic repeat runs, distinct IDs/roles/labels for the adult
vs. both learners, clean starting session state, refusal on a
missing/malformed `--unit`, and absence of any secret-shaped field
(`password`/`secret`/`token`/`apikey`) in the generated output.
