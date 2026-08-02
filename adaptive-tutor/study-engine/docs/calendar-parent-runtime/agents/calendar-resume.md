# Calendar and Resume Agent Report

## Result

`calendar-runtime.ts` is a local, immutable adapter/runtime for the Session 4
calendar vocabulary. It does not call a production calendar, persistence,
identity, authentication, Student Study-UX, or network service.

The supplied packages were inspected in place and independently verified:

| Input | Verified SHA-256 |
| --- | --- |
| `CARD-1-STUDY-CONTRACTS.zip` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` |
| Study-Engine ZIP | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` |
| Study-Integrations ZIP | `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B` |

Card 5 was read from the available
`CARD-5-STUDY-RECON-AUDIT.zip` (`2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7`).
Its machine decisions and mappings were inspected directly from the archive,
not reconstructed from a summary.

## Canonical calendar mapping

The Session 4 labels remain boundary identifiers; every segment receives the
corresponding Session 1 `StudyTaskType`. Custom canonical tasks carry an
explicit `customTaskTypeId`.

| Session 4 calendar block | Canonical task type | Custom task ID |
| --- | --- | --- |
| `new_instruction` | `direct-instruction` | — |
| `guided_practice` | `guided-practice` | — |
| `independent_practice` | `independent-practice` | — |
| `reading` | `reading` | — |
| `writing` | `writing` | — |
| `memorization` | `retrieval-practice` | — |
| `assessment` | `mastery-check` | — |
| `project_work` | `project-work` | — |
| `review` | `retrieval-practice` | — |
| `physical_education` | `custom` | `physical-education` |
| `outside_activity` | `custom` | `outside-activity` |
| `romeo_virtual_academy_activity` | `custom` | `romeo-virtual-academy-activity` |
| `parent_created_activity` | `custom` | `parent-created-activity` |

The mapping uses TypeScript `satisfies Record<...>` so adding or removing a
Session 4 label without reconciling it to a canonical task fails compilation.

The reverse Card 5 adapter maps `worked-example` to `new_instruction` and
`prerequisite-remediation` to `review`. It fails closed for
`problem-solving`, `discussion`, `reflection`, and `custom` unless the approved
plan supplies an explicit block type. A supplied canonical segment task type is
preserved, so a `worked-example` is not flattened to `direct-instruction`.

## Identity and duplicate policy

- `internalBlockId` is the stable lab/host identifier.
- `sourceIdentity.source + sourceIdentity.externalItemId` is the stable
  external identity.
- Canonical ID validation matches Session 1, including `/`; accepted bytes and
  case are never normalized.
- `CalendarSegment.segmentId` is the canonical branded `SegmentId`; its ordinal
  is display metadata, not an alternate task ID.
- Repeat imports collapse on learner, source, external item, and continuation
  key. The first accepted internal ID is retained even if a repeat import
  arrives with a throwaway generated ID.
- A continuation retains the original external identity but receives a new
  internal ID and a stable, host-supplied `continuationKey`.
- Retrying the same continuation command returns the existing continuation and
  does not append another block or audit event.

## Duration, partial completion, and resume

Estimated and actual duration are intentionally separate:

- `estimatedDurationMinutes` is derived from segment estimates.
- `actualDurationSeconds` is derived only from active intervals in the current
  calendar occurrence.
- Active intervals must resolve to whole seconds. Fractional-second input fails
  instead of silently corrupting the canonical exact-resume value.
- Break and interruption time never becomes active work time.
- Continuations carry prior within-segment elapsed seconds only as resume
  metadata; that carried time is not counted a second time as occurrence
  duration.

The focused fixture completes 3 of 6 Fractions Lesson segments. It produces:

- next segment `guided`, original plan ordinal 4;
- 60 elapsed active seconds within that segment;
- completed IDs `warm-up`, `visual`, and `example`;
- remaining IDs `guided`, `independent`, and `check-in`;
- response draft reference `draft-ref-guided-1`;
- 16 estimated minutes remaining and 10 actual active minutes;
- a structural adapter to canonical Session 1 `ResumePoint`.

Automatic continuation copies only the three incomplete segments, preserves
their original plan ordinals, and carries the exact resume point.

## Break and interruption dictionary

The runtime does not collapse interruption semantics:

| Runtime category | Meaning | Default approval state |
| --- | --- | --- |
| `planned_break` | A break already present in the approved plan | `approved` |
| `requested_break` | A learner-requested break | `requested` |
| `outside_interruption` | An interruption external to study execution | `not_required` |
| `technical_interruption` | A device/application/network interruption | `not_required` |

Each record includes the actor, timestamp, approval state, and exact resume
metadata. Planned breaks cannot be recorded as merely requested.

## Required-work completion bars

Completion bars count explicit required segment units. Optional extension work
is excluded and elapsed time alone contributes nothing. Stable source and
segment identity collapse logical work copied into a continuation, preventing a
split lesson from inflating the denominator.

The test deliberately spends 30 active minutes without completing a required
unit and remains at 0%. Completing one of two required units moves the bar to
50%, independent of actual time.

## Household timezone strategy

The host supplies a validated household IANA timezone. Card 5's preferred
placement supplies an explicit-offset `scheduledStart`, an
`intendedLocalDate`, the learner-local wall minute, and the household zone.
The runtime validates that they agree and preserves the offset string
byte-for-byte. It snapshots the intended date and zone so later household-zone
changes cannot rewrite historical daily grouping.

- Normal wall times resolve deterministically without consulting the host
  machine timezone.
- Fall-back overlaps accept an explicit `earlier` or `later` disambiguation.
  New York `2026-11-01T01:30` resolves to two instants one hour apart.
- Spring-forward gaps fail closed. New York `2026-03-08T02:30` is rejected
  rather than silently shifted.
- Daily completion groups resolved instants in the supplied household zone.
- Drag/drop and parent edits keep the original household zone.

Older Session 4 fixtures that omit explicit placement still resolve from wall
time plus IANA zone, but are marked
`placementSource: "lab-wall-time-resolution"`. Exact replacement instruction:
supply `scheduledStart` and `intendedLocalDate` on create, drag/drop, parent
reschedule, and continuation inputs, and reject the marked fallback at a future
production boundary.

## Parent-created calendar demonstrations

Focused tests demonstrate:

- student drag-and-drop rescheduling with an immutable audit event;
- parent title, timer, and estimate edits;
- a generic parent-created activity;
- physical education;
- an outside activity.

All retain stable IDs and use `source: "parent"`.

## Assumptions and replacement notes

Card 5 was available and applied directly. This calendar module contains no
precedence resolver, so DEC-012 requires no calendar identity or mapping
change. DEC-014-authorized retry instants enter through the explicit-offset
household-zone placement boundary; the calendar does not choose a retry time.

Remaining host assumptions are explicit:

1. The host supplies stable opaque learner, source, internal, external, and
   continuation identifiers.
2. The host authorizes parent/student commands before invoking these pure
   functions.
3. Segment estimates and required/optional flags come from an approved
   canonical plan or authorized parent edit.
4. Event instants carry `Z` or an explicit numeric offset.
5. Persistence, UI gestures, conflict transport, notifications, and production
   synchronization remain outside this lab.
6. Card 5's signed resume-cursor sidecar (session/plan revision, substep, event
   sequence, checkpoint revision, and integrity token) remains outside this
   calendar projection. Student Study-UX is intentionally not integrated.

Session 4’s verified block vocabulary is mapped exhaustively by
`CALENDAR_TO_CANONICAL_TASK`. If a future canonical version changes that
vocabulary, update the mapping and its exhaustive fixture while preserving
`internalBlockId`, `externalItemId`, segment IDs, plan ordinals,
`continuationKey`, and existing audit history byte-for-byte during that
migration.

## Focused validation

```powershell
npm test -- adaptive-tutor/study-engine/tests/calendar-parent-runtime/calendar-runtime.test.ts
```

Result: **1 file passed, 17 tests passed**.

The suite covers all 13 mappings, stable IDs, repeat imports, drag/drop, parent
edits, parent/PE/outside activities, 3-of-6 partial completion, canonical
resume adaptation, idempotent continuation, all four interruption categories,
required-work completion, explicit-offset placement, historical zone/date
snapshots, IANA zones, UTC date boundaries, fractional-second rejection, and
both DST edge cases.
