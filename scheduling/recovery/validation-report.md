# Schedule Recovery Validation Report

Date: 2026-07-28  
Scope: `scheduling/recovery/**`

## Contract and implementation checks

- Strong TypeScript contracts cover every required activity and all eight
  recovery choices.
- Runtime schedule/proposal validation is dependency-free.
- Exported JSON Schemas use draft 2020-12 and closed top-level objects.
- Shared planner inspection was read-only; additive needs are documented in
  `core-change-requests.md`.
- Proposal generation is side-effect free and parent gated.
- Fixed/locked/protected transition checks, required-work preservation, conflict
  detection, due-date warnings, daily/weekly/carryover/focus limits, catch-up
  capacity, audit history, and exact undo are implemented.
- Household-local time conversion covers ordinary, ambiguous fall-back, and
  nonexistent spring-forward wall times.
- Automatic placement uses current-or-future household-local slots only.
- Break recommendations omit intervals that overlap events or protected time.

## Commands

```powershell
npx tsc -p scheduling/recovery/tsconfig.json
npx vitest run --config tests/schedule-recovery/vitest.config.ts
```

## Recorded results

- Root application typecheck: **PASS** (`npm run typecheck`)
- Engine strict typecheck: **PASS**
- Browser feature strict typecheck: **PASS**
- Recovery test-project typecheck: **PASS**
- Focused recovery test suite: **PASS — 4 files, 81 tests**
- Browser prototype model suite: **PASS — 1 file, 5 tests**
- Existing root application suite: **PASS — 33 files, 506 tests**
- Multi-student samples: **PASS** runtime validation and complete proposal
  generation for every sample trigger
- Conflict-aware break, protected-event/window, no-past-placement, time-zone/DST,
  no-overload, required-work, audit, and exact-undo regressions: **PASS**

The unscoped `npm test` command is not a valid aggregate gate in this
multi-worktree checkout because Vitest recursively discovers `.worktrees/**`
owned by other sessions, including worktrees with separate dependencies and
database processes. The existing application was therefore verified with
`npx vitest run --dir src --reporter=dot`; no root test configuration was
changed.

See `tests/schedule-recovery/VALIDATION.md` for the coverage manifest, DST
fixtures, five defects found and corrected during independent review, and exact
commands.
