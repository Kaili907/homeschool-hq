# Shared Calendar Core Change Requests

Status: additive integration requests only. The shared calendar core exists in
the separate Session 1 worktree at `feature/calendar-core-daily-planner`, inspected
at HEAD `76f13e6`. It was not edited by this session.

Session 1 already provides a strong base: stable planner block and occurrence
identities, fixed/flexible behavior, per-profile progress, date overrides,
historical occurrence snapshots, mission completion authority, parent/student
projections, conflict-aware placement, and an explicit future synchronization
boundary. Recovery should extend those contracts through adapters and atomic host
commands; it should not replace them or create a second completion authority.

## 1. Additive protection metadata

Recovery needs a persisted distinction among:

- Fixed placement
- Parent-locked placement/disposition
- Sleep protection
- Meal protection
- Parent-defined protected time

`PlannerScheduleBehavior = 'fixed' | 'flexible'` identifies placement behavior,
but does not identify why a row is immutable or whether duration/disposition is
also parent locked. Candidate additive fields on a template/date override or
effective occurrence:

```ts
parentLocked?: boolean
protection?: 'none' | 'sleep' | 'meal' | 'parent-defined'
```

The host must authorize these fields as parent-only. Recovery will continue to
treat existing `fixed` appointments as immovable even before these fields exist.

## 2. Durable work-obligation reference

The planner schedules blocks, while recovery must preserve a durable obligation
when a block is shortened, split, moved, or temporarily replaced. Add an opaque
source-owned `workItemId` or equivalent obligation reference to effective
occurrences. The source system remains authoritative for completion, due date,
and required/waived status.

Required additive source projection:

- Required/review/optional classification
- Stable priority plus parent/source factors
- Hard/soft due local date-time and lock state
- Expected/minimum/maximum duration, confidence, and estimate basis
- Completed or remaining effort
- Whether splitting/shortening is supported
- Minimum useful session length

These fields may come from an adapter response instead of being copied into
planner persistence. Recovery must not write curriculum mastery, grades,
attendance, or mission completion.

## 3. Household/student scheduling policy

The shared calendar needs a parent-owned policy seam for:

- Daily total, academic, and physical-minute limits
- Weekly academic-minute limit
- Carryover cap
- Preferred/minimum/maximum continuous focus size
- Movement and focus-recovery break rules
- Earliest start/latest end and active weekdays
- Date-specific workload overrides
- Explicit catch-up windows

Version 1 recovery assumes the household and student policy use the same IANA
time zone. The host must supply household-local dates; UTC-derived dates are not
an acceptable substitute.

## 4. Atomic proposal apply

An approved recovery frequently changes more than one row (split sessions or a
review replacement). The host needs one atomic, idempotent operation that:

1. Checks household membership and parent role.
2. Checks expected planner/schedule revision.
3. Reselects every current template, occurrence, source, assignment, and lock.
4. Validates before-images and stable IDs.
5. Rejects fixed, parent-locked, protected, conflict-producing, or overload-
   producing changes.
6. Applies all date overrides/additions or none.
7. Appends the parent decision, explanation, tradeoff, and before/after facts to
   audit history.
8. Returns the new revision.

Illustrative boundary:

```text
planner_apply_recovery_proposal(
  expected_revision,
  proposal_id,
  decision_id,
  option_id_or_override,
  observed_at,
  idempotency_key
)
```

Applying split/replacement operations as independent client requests could leave
required work partially scheduled or lose the displaced review. That is not an
acceptable integration.

## 5. Append-only recovery audit and compensating undo

Persist proposal/decision events with household, profile, actor, server time,
reason, changes, and immutable before/after snapshots. Undo must be a
parent-authorized compensating event for the latest unapplied recovery, not a
deletion of history. The server must recheck revision and invariants before
restoring.

## 6. Category/source mapping

Current shared categories map structurally as follows:

| Shared planner category/source | Recovery kind |
| --- | --- |
| `romeo-online` | `romeo-virtual-academy-assignment` |
| curriculum / `manuel-academy` | `manuel-academy-lesson` |
| mission / reading | `academic-assignment` |
| `family-responsibility` | `ready-for-life-activity` |
| wrestling / jiu-jitsu / weight-training / other-pe | matching physical kind |
| meal / break / appointment | matching recovery kind |
| custom | `parent-created-activity` |

Adaptive tutor intervention, explicit focus-recovery break, sleep, and
parent-defined protected time do not have distinct Session 1 category IDs. Add
stable category IDs or an adapter-provided recovery-kind field before round-trip
persistence needs exact distinctions.

## 7. Date-override round trip

`recoveryEventsToPlannerCommands` currently emits integration commands rather
than mutating planner state. The host still needs documented support for:

- Moving one effective occurrence without rewriting recurrence
- Adding split-session occurrences tied to the same obligation
- Marking a lower-priority review deferred without treating required work as
  completed, skipped, or deleted
- Keeping original historical occurrence snapshots after a recovery
- Preserving student privacy projections (especially parent notes and reasons)

Until the atomic boundary exists, approved recovery schedules should be treated
as a prototype projection, not silently persisted as multiple ordinary planner
edits.
