# Schedule-recovery validation report

Validated on 2026-07-28 with:

- Node.js `v24.14.1`
- npm `11.11.0`
- TypeScript `5.8.3`
- Vitest `4.1.10`
- Windows, with schedule calculations explicitly using
  `America/New_York`

## Completion gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused typecheck | PASS | `npx tsc --project tests/schedule-recovery/tsconfig.json` |
| Runtime/schema validation | PASS | Valid contracts, malformed dates/times/zones/references, duplicate IDs, protected-event rules, all choices, and JSON Schema metadata |
| Conflict tests | PASS | Movable, fixed, protected-window, outside-day, and protected-event-versus-protected-window conflicts |
| Timezone and DST | PASS | Explicit IANA zone plus both 2026 New York transitions; nonexistent spring time and ambiguous fall time |
| No-overload invariants | PASS | Daily, weekly, academic, physical, carryover, focus-stamina, and tomorrow-capacity checks |
| Exact undo | PASS | Restores the complete prior schedule snapshot, preserves the original audit row, and appends a compensating undo row |
| Existing root tests | PASS | `npx vitest run --dir src --reporter=dot`: 33 files and 506 tests passed |
| Focused recovery tests | PASS | 4 files and 81 tests passed |

## Focused command

```powershell
npx vitest run --config tests/schedule-recovery/vitest.config.ts
```

Final result:

```text
Test Files  4 passed (4)
Tests       81 passed (81)
```

## Coverage manifest

`contracts-and-time.test.ts`

- all 16 activity kinds;
- all eight recovery-choice contracts;
- malformed runtime contracts;
- JSON Schema boundary metadata;
- offset-aware instants and host-independent calendar arithmetic;
- 2026-03-08 nonexistent New York wall time;
- 2026-11-01 ambiguous New York wall time, including both instants.

`invariants.test.ts`

- fixed appointments, parent locks, sleep, meals, and parent-protected time;
- explicit approval before required work can be waived;
- stale before-images and duplicate changes;
- movable and fixed conflicts;
- protected event against a separate protected window;
- outside-student-day conflicts;
- due-date risk;
- per-student daily and weekly load;
- daily, weekly, carryover, and focus overload;
- supportive sizing and break-aware complete-slot placement;
- no silent overload of tomorrow.

`engine-and-decisions.test.ts`

- all eight choices and every trigger;
- proposal generation for every activity kind;
- no automatic placement in the past;
- overdue “tomorrow” based on household-local current time;
- safe split totals, shortening remainder, carryover provenance, catch-up
  capacity, lower-priority review deferral, and weekly balancing;
- parent approval, explicit manual override, rejection, unchanged choice,
  stale/system rejection, audit filtering, and exact undo;
- separation of multiple students.

`breaks-adapters-and-samples.test.ts`

- movement and focus-recovery break recommendations;
- fixed/protected break-slot avoidance;
- retained focus accumulation when an immediate break is blocked;
- read-only shared-planner adaptation and emitted override commands;
- valid multi-student sample schedule;
- sample triggers for missed, interrupted, shortened, overdue, and
  focus-difficulty recovery.

## Defects found and resolved during validation

The engine owner resolved each before the final run:

1. The proposal JSON Schema was not closed at its top-level object.
2. Focus block sizing collapsed to the minimum instead of the preferred safe
   duration.
3. Break recommendations could overlap fixed/protected rows and initially
   reset accumulated focus even when no real break fit.
4. Protected events were skipped when checking independent protected windows.
5. Same-day and overdue proposals could place recovery work in the past.

All five have focused regression coverage.

## Repository-wide discovery finding

Plain `npm test` recursively discovers tests under `.worktrees/**`, including
other sessions with intentionally separate dependencies and PostgreSQL
processes. That broad command is not a clean existing-root gate in this
workspace. It reported unrelated missing `@supabase/supabase-js` dependencies,
database timeouts, and review-worktree failures.

Use `npx vitest run --dir src --reporter=dot` for the existing root application
baseline and the focused command above for schedule recovery. No package or
root test configuration was changed by this workstream.
