# Schedule-recovery validation

This directory is intentionally self-contained and does not change the shared
calendar, recovery engine, application feature, package scripts, or unrelated
tests.

Run the focused runtime suite from the repository root:

```powershell
npx vitest run --config tests/schedule-recovery/vitest.config.ts
```

Typecheck the recovery engine and focused tests:

```powershell
npx tsc --project tests/schedule-recovery/tsconfig.json
```

The focused suite is expected to cover:

- all eight recovery choices and every supported activity kind;
- runtime validation and portable JSON Schema exports;
- fixed events, parent locks, appointments, sleep, meals, and protected time;
- explicit approval before reducing or waiving required work;
- conflicts, due-date risks, daily and weekly workload, carryover, focus stamina,
  break-aware placement, catch-up blocks, and the no-overload-tomorrow rule;
- parent approval, override, rejection/manual handling, leave-unchanged behavior,
  student-friendly explanations, append-only audit history, and exact undo;
- multiple students with separate workload policies;
- IANA timezone behavior at both 2026 `America/New_York` DST transitions,
  including rejection of nonexistent and ambiguous local times.

Tests use fixed IDs and timestamps so failures are reproducible. They exercise
the public recovery API only and must not repair engine defects by mutating
internal state.
