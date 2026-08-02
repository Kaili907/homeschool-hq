# Session 2 Schedule-Recovery Handoff

Status: complete and integration-ready outside the shared calendar core.

## Ownership and directory resolution

The three requested directories did not exist in the active worktree before
this session. The shared Calendar Core and Daily Planner was found in the clean,
separate Session 1 worktree `.worktrees/calendar-core-daily-planner`, branch
`feature/calendar-core-daily-planner`, inspected at HEAD `76f13e6`. It was
treated as a read-only integration dependency and was not edited or
cherry-picked.

No pre-existing file was modified by this session. Every created file is listed
below.

## Exact files created

### Recovery engine and documentation

- `scheduling/recovery/adapters.ts`
- `scheduling/recovery/breaks.ts`
- `scheduling/recovery/changes.ts`
- `scheduling/recovery/conflicts.ts`
- `scheduling/recovery/core-change-requests.md`
- `scheduling/recovery/decisions.ts`
- `scheduling/recovery/engine.ts`
- `scheduling/recovery/index.ts`
- `scheduling/recovery/invariants.ts`
- `scheduling/recovery/models.ts`
- `scheduling/recovery/README.md`
- `scheduling/recovery/samples.ts`
- `scheduling/recovery/schemas.ts`
- `scheduling/recovery/SESSION-2-HANDOFF.md`
- `scheduling/recovery/time.ts`
- `scheduling/recovery/tsconfig.json`
- `scheduling/recovery/types.ts`
- `scheduling/recovery/validation-report.md`
- `scheduling/recovery/workload.ts`
- `scheduling/recovery/artifacts/MANUEL-ACADEMY-SESSION-2-SCHEDULE-RECOVERY.zip`
- `scheduling/recovery/artifacts/MANUEL-ACADEMY-SESSION-2-SCHEDULE-RECOVERY.zip.sha256`

### Parent/student browser feature

- `app/features/schedule-recovery/env.d.ts`
- `app/features/schedule-recovery/index.ts`
- `app/features/schedule-recovery/integration.ts`
- `app/features/schedule-recovery/presentation.ts`
- `app/features/schedule-recovery/ProposalReview.tsx`
- `app/features/schedule-recovery/README.md`
- `app/features/schedule-recovery/RecoveryAuditHistory.tsx`
- `app/features/schedule-recovery/RecoveryIndicators.tsx`
- `app/features/schedule-recovery/sampleData.test.ts`
- `app/features/schedule-recovery/sampleData.ts`
- `app/features/schedule-recovery/schedule-recovery.css`
- `app/features/schedule-recovery/ScheduleRecoveryPrototype.tsx`
- `app/features/schedule-recovery/ScheduleRecoveryWorkspace.tsx`
- `app/features/schedule-recovery/StudentRecoveryView.tsx`
- `app/features/schedule-recovery/tsconfig.json`
- `app/features/schedule-recovery/types.ts`

### Focused tests and validation evidence

- `tests/schedule-recovery/breaks-adapters-and-samples.test.ts`
- `tests/schedule-recovery/contracts-and-time.test.ts`
- `tests/schedule-recovery/engine-and-decisions.test.ts`
- `tests/schedule-recovery/fixtures.ts`
- `tests/schedule-recovery/invariants.test.ts`
- `tests/schedule-recovery/README.md`
- `tests/schedule-recovery/tsconfig.json`
- `tests/schedule-recovery/VALIDATION.md`
- `tests/schedule-recovery/vitest.config.ts`

## Completion gates

| Gate | Result |
| --- | --- |
| Root `npm run typecheck` | PASS |
| Recovery engine strict TypeScript project | PASS |
| Browser feature strict TypeScript project | PASS |
| Recovery test strict TypeScript project | PASS |
| Runtime and JSON Schema validation | PASS |
| Conflict and protected-time tests | PASS |
| Time-zone and both 2026 New York DST transition tests | PASS |
| Daily, weekly, carryover, focus, and tomorrow no-overload invariants | PASS |
| Exact prior-schedule undo | PASS |
| Focused recovery suite | PASS — 4 files, 81 tests |
| Browser prototype model suite | PASS — 1 file, 5 tests |
| Existing root application suite | PASS — 33 files, 506 tests |
| ZIP entry/read verification | PASS |

Plain `npm test` is not a valid aggregate command in this multi-worktree
checkout: default Vitest discovery traverses other sessions' `.worktrees/**`
with separate dependencies and database processes. The clean existing
application gate is `npx vitest run --dir src --reporter=dot`. No package or root
test configuration was changed.

## Sample recovery scenarios

1. A missed Manuel Academy lesson offers every recovery choice; catch-up,
   tomorrow, split, shortening, replacement, and weekly balancing remain
   parent-gated and capacity checked.
2. An interrupted or focus-difficulty block favors shorter sessions and
   supportive movement/focus-recovery breaks without adding work.
3. A shortened Romeo Virtual Academy assignment retains its external source,
   due date, remaining work, and student-friendly explanation.
4. An overdue event interprets "tomorrow" from the current household-local date
   and never places work in the past.
5. Fixed appointments, sports, meals, sleep, and parent-locked time remain
   unchanged; unsafe choices are visibly unavailable.
6. Lower-priority review may be deferred, never deleted, while required work
   can be waived or reduced only through an explicit parent override flag.
7. Two sample students use different daily, weekly, carryover, and focus limits
   without one student's decision changing the other's schedule.

## Validation findings

Independent testing found five defects before finalization:

1. Proposal JSON Schema allowed unknown top-level properties.
2. Focus sizing collapsed to the minimum instead of the preferred safe size.
3. Break recommendations could overlap a fixed/protected row and reset focus
   even when no break fit.
4. Protected events were skipped against independent protected windows.
5. Same-day and overdue choices could search past wall-clock slots.

All five were corrected and have focused regression tests. Full evidence is in
`tests/schedule-recovery/VALIDATION.md`.

## Unresolved integration needs

The shared planner still needs additive, owner-approved seams for:

- parent-lock and sleep/meal/protected-time metadata;
- durable work-obligation, priority, due-date, duration, and required-work
  projections;
- household/student workload and catch-up policies;
- one atomic, revision-checked, idempotent proposal-apply command;
- append-only server audit plus compensating undo;
- exact adaptive-tutor, focus-recovery, sleep, and protected-time category
  round trips.

These requests and the non-authoritative structural adapter boundary are
detailed in `scheduling/recovery/core-change-requests.md`. Until that atomic
host boundary exists, the browser feature and recovery schedule are
integration-ready projections, not silent mutations of shared planner state.

## ZIP

The archive is
`scheduling/recovery/artifacts/MANUEL-ACADEMY-SESSION-2-SCHEDULE-RECOVERY.zip`.
Its SHA-256 is recorded in the adjacent `.sha256` sidecar after packaging. The
archive intentionally contains the three owned source trees and excludes the
`artifacts` directory so it cannot recursively contain itself.

Confirmed: no other session's owned file was changed.
