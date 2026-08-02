# Schedule Recovery browser feature

This directory is a self-contained, integration-ready React interface for Manuel
Academy schedule recovery. It is intentionally not mounted in the shared
`src/App.tsx` because that file is outside this session's ownership. It does not
write to the shared calendar core or persist decisions on its own.

## What is included

- Parent proposal queue with recommendation review, all eight recovery choices,
  approval, reasoned override, manual placement, and undo.
- Student view that explains what changed, why, the tradeoff, and what remains
  protected in supportive language.
- Conflict, due-date risk, workload-limit, required-work, fixed-event, and
  protected-time indicators.
- Multiple-student demo data covering academic, Romeo Virtual Academy, Manuel
  Academy, adaptive tutor, Ready for Life, sport, appointment, meal, break, and
  parent-created activity categories.
- Recovery audit history and a local state reducer for demonstrating approval,
  override, manual placement, and undo.
- Accessible labels, keyboard-operable controls, live decision announcements,
  visible focus treatment, reduced-motion support, and responsive layouts.

## Fastest prototype mount

```tsx
import { ScheduleRecoveryPrototype } from './app/features/schedule-recovery'
import './app/features/schedule-recovery/schedule-recovery.css'

export function RecoveryDemoPage() {
  return <ScheduleRecoveryPrototype />
}
```

The prototype uses in-memory sample state. Resetting or reloading restores the
original samples.

## Engine integration

Production code should render `ScheduleRecoveryWorkspace`, not the demo wrapper.
The canonical recovery engine is expected at `scheduling/recovery/index.ts` with
proposal, decision, audit, and undo operations. Keep that engine state canonical
and map it at the UI boundary:

The UI `RecoveryChoice` values are the canonical engine values with no aliases:
`move-to-tomorrow`, `shorten-today`, `split-sessions`,
`move-to-catch-up-block`, `replace-lower-priority-review`,
`keep-due-date-rebalance-week`, `parent-manual`, and `leave-unchanged`.

```tsx
import {
  createScheduleRecoveryAdapter,
  ScheduleRecoveryWorkspace,
  type ScheduleRecoveryHandlers,
} from './app/features/schedule-recovery'

const toViewModel = createScheduleRecoveryAdapter((engineState: RecoveryState) => ({
  generatedAt: engineState.schedule.updatedAt,
  timeZone: engineState.schedule.timeZone,
  students: mapStudents(engineState),
  proposals: engineState.proposals.map(mapProposal),
  conflicts: mapConflicts(engineState),
  dueDateRisks: mapRisks(engineState),
  calendarItems: mapCalendar(engineState),
  auditHistory: engineState.auditHistory.map(mapAuditEntry),
  safeguards: mapSafeguards(engineState),
}))

const handlers: ScheduleRecoveryHandlers = {
  onApprove: ({ proposalId, choice }) => {
    // approveRecoveryProposal / applyRecoveryDecision
  },
  onOverride: ({ proposalId, choice, reason }) => {
    // overrideRecoveryProposal with explicit parent reason
  },
  onManualPlacement: ({ proposalId, date, startTime, durationMinutes, reason }) => {
    // create a parent decision, validate it, then apply it
  },
  onUndo: ({ auditEntryId }) => {
    // undoRecovery(state, auditEntryId)
  },
}

<ScheduleRecoveryWorkspace model={toViewModel(recoveryState)} handlers={handlers} />
```

The mapping layer is intentionally explicit. It prevents React presentation
needs from becoming calendar-core contracts and lets the engine validate every
manual placement before it is committed.

## Integration requirements

Before applying any UI callback, the integration must:

1. Revalidate the proposal against the latest schedule revision.
2. Reject a fixed appointment or parent-locked event move.
3. Reject sleep, meal, or protected-time overlap.
4. Reject any day over the student-specific limit, including tomorrow.
5. Require explicit parent approval for reduced or replaced required work.
6. Persist the decision and its reason to recovery audit history.
7. Return the new canonical state; do not optimistically mutate the calendar
   from this view model.

Manual placements show a client-side date/time/duration form, but the engine is
the authority for conflicts, time zones, daylight-saving behavior, workload,
and fixed-event rules.

## Local validation

From the repository root:

```powershell
node node_modules/typescript/bin/tsc -p app/features/schedule-recovery/tsconfig.json
```

The root `tsconfig.json` currently includes only `src`, so this directory keeps
a scoped TypeScript project until the host application explicitly includes it.
