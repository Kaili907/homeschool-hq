# Family pilot acceptance

One operator command answering: **is this integrated tree ready for Dad to
start the supervised Family Pilot?**

This is not a production readiness check (see
`scripts/production-local-preflight.mjs` for that). It composes the pieces
the pilot needs, each owned by a different sibling branch, and reports one
of three verdicts per piece — and overall:

- `PASS` — the piece is present and its own check succeeded.
- `FAIL` — the piece is present and its own check failed (or its output
  couldn't be understood).
- `WAITING_ON_INTEGRATION` — the piece hasn't landed in this tree yet, or
  reported that it isn't configured yet (e.g. no pilot unit designated).

Overall verdict: `FAIL` if any piece fails, else `WAITING_ON_INTEGRATION` if
any piece is still missing, else `PASS`.

A tree with pieces still merging from sibling branches is expected to come
back `WAITING_ON_INTEGRATION`, not `FAIL` — this command never hardcodes
failure just because another branch hasn't merged yet.

## What it checks

| Piece | Discovered from |
| --- | --- |
| Family pilot readiness | `scripts/family-pilot/readiness.mjs` |
| Grade 5 Math designated unit validation | `scripts/family-pilot/validate-grade5-math-unit.mjs` |
| Persistence smoke | `supabase/family-pilot/persistence/learner-progress-smoke.db.test.ts` |
| Parent smoke | `tests/family-pilot/parent/` (non-empty) |
| Browser smoke | `tests/family-pilot/browser/playwright.config.ts` |
| Local launcher check mode | `scripts/family-pilot/start-windows.ps1` (run with `-Check`) |

Each row's discovery path is a best-guess location matching the sibling
branch that owns it as of this writing. If a sibling branch lands its piece
somewhere else, add that path to the matching check's `discoveryPaths` in
`scripts/family-pilot/pilot-acceptance.mjs` rather than changing this
runner's shape.

## Usage

```bash
node scripts/family-pilot/pilot-acceptance.mjs
node scripts/family-pilot/pilot-acceptance.mjs --format json
node scripts/family-pilot/pilot-acceptance.mjs --grade5-unit 3
```

`--root <path>` points the runner at a different checkout (used by tests).
`--grade5-unit <id|number>` is forwarded to the Grade 5 Math validator; until
a pilot unit is designated, that check reports `WAITING_ON_INTEGRATION`
rather than failing.

Exit codes: `0` = PASS, `1` = FAIL, `3` = WAITING_ON_INTEGRATION.

## Scope

- Local only. No hosted service is ever contacted.
- No deploy, no production enablement.
- Read-only: this command only runs the sibling checks it discovers; it
  never modifies the checks it composes.
