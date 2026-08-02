# Manuel Academy Schedule Recovery

This package is the integration-ready scheduling and workload engine for missed,
interrupted, shortened, overdue, and focus-difficulty recovery. It never mutates a
schedule while generating proposals. A parent must approve a generated option or
submit a safeguarded manual override before a change is applied.

## Directory resolution

No equivalent `scheduling/recovery` directory existed in the active workspace
before this session. The existing shared calendar implementation was found in the
separate, clean Session 1 worktree:

- Worktree: `.worktrees/calendar-core-daily-planner`
- Branch: `feature/calendar-core-daily-planner`
- Inspected HEAD: `76f13e6`
- Shared implementation: `src/planner/**`

That worktree was inspected read-only. This package does not edit or import the
shared planner, `src/**`, another session's owned directory, or shared calendar
state. The structural adapter in `adapters.ts` keeps the dependency explicit.
Additive shared-core needs are recorded in `core-change-requests.md`.

## Public entry point

Import all production contracts and functions from:

```ts
import {
  addRecoveryProposal,
  approveRecoveryProposal,
  createRecoveryState,
  generateRecoveryProposal,
  undoRecovery,
  validateRecoverySchedule,
} from './scheduling/recovery/index'
```

Important public types include:

- `RecoverySchedule`, `RecoveryStudent`, `StudentWorkloadPolicy`
- `WorkItem`, `ScheduleEvent`, `ProtectedWindow`, `CatchUpBlock`
- `PriorityModel`, `DeadlineModel`, `DurationEstimate`
- `RecoveryTrigger`, `RecoveryProposal`, `RecoveryOption`
- `RecoveryDecision`, `RecoveryAuditEntry`, `RecoveryState`
- `Conflict`, `DueDateRiskWarning`
- `DayWorkloadSummary`, `WeekWorkloadSummary`

## Recovery flow

1. Adapt the current shared planner projection with
   `adaptSharedPlannerDailyBlocks`, or construct a validated
   `RecoverySchedule`.
2. Call `generateRecoveryProposal`. It always returns all eight required choices:
   move to tomorrow, shorten today, split sessions, use a catch-up block, replace
   lower-priority review, keep the due date and rebalance the week, parent manual,
   and leave unchanged.
3. Display each option's `why`, `tradeoff`, conflicts, due-date warnings, workload,
   and `studentExplanation`.
4. Add the proposal to `RecoveryState` with `addRecoveryProposal`.
5. Commit only through `approveRecoveryProposal`, `overrideRecoveryProposal`, or
   `applyRecoveryDecision`.
6. Persist the resulting schedule and append-only `auditHistory` together.
7. Convert the approved before/after projection into host commands with
   `recoveryEventsToPlannerCommands`. The host must reselect and authorize the
   current planner rows before creating shared planner date overrides.

Proposal generation is deterministic when `proposalId` is supplied. Approval
uses the proposal's schedule revision and before-images, so stale or tampered
decisions fail closed.

## Invariants

Generated changes and parent overrides share the same commit boundary:

- Fixed appointments and any fixed event cannot move, resize, or be replaced.
- Parent-locked events cannot be changed by recovery.
- Sleep, meals, protected events, and parent-defined protected windows remain
  intact.
- A required `WorkItem` cannot be deleted, waived, or reduced without a parent
  decision carrying `explicitlyApproveRequiredWorkRemoval: true`.
- New event/protected-window conflicts are rejected.
- New daily, weekly, physical, carryover, and continuous-focus overloads are
  rejected.
- Tomorrow is checked before placement; it is never silently overloaded.
- Automatic placements are never in the past. Same-day searches are floored to
  the rounded household-local current time.
- Work is placed only in a complete interval. `findAvailableSlot` never silently
  splits it.
- Focus difficulty favors smaller sessions, supportive movement/recovery breaks,
  or safer placement. It never adds work or makes health/ADHD claims.
- `undoRecovery` restores the exact prior schedule snapshot and appends a
  compensating audit entry. Only the latest unapplied recovery can be undone, so
  later decisions cannot be lost.

`validateRecoverySchedule` and `validateRecoveryProposal` provide dependency-free
runtime validation. Portable draft-2020-12 schemas are exported as
`RECOVERY_SCHEDULE_JSON_SCHEMA` and `RECOVERY_PROPOSAL_JSON_SCHEMA`.

## Time zones and daylight saving

Dates and local times are interpreted in the schedule's IANA household time
zone. `localDateTimeToEpochMs` handles ambiguous fall-back and nonexistent
spring-forward wall times with explicit `compatible`, `earlier`, `later`, or
`reject` disambiguation. Calendar-day movement uses `addCalendarDays`, not a
24-hour millisecond offset, so moving to tomorrow remains correct across DST.

## Break placement

`requiredBreakPlacements` applies each student's focus and movement thresholds.
It recommends a break only when the complete break fits before the student's day
boundary and does not overlap another event or protected window.
`createBreakEvent` materializes an approved recommendation; it does not apply it.

## Sample coverage

`SAMPLE_MULTI_STUDENT_SCHEDULE` contains two students with different focus and
workload policies. Across its work items and events it demonstrates:

- Academic, Romeo Virtual Academy, Manuel Academy, adaptive tutor, and Ready for
  Life work
- Wrestling, jiu-jitsu, weight training, and PE
- Appointments, meals, movement breaks, focus-recovery breaks, and
  parent-created activities
- Household sleep windows and student-specific catch-up blocks

`SAMPLE_RECOVERY_TRIGGERS` contains missed, interrupted, shortened, overdue, and
focus-difficulty examples.

## Local verification

```powershell
npx tsc -p scheduling/recovery/tsconfig.json
npx vitest run --config tests/schedule-recovery/vitest.config.ts
```

See `validation-report.md` for the recorded session result.
