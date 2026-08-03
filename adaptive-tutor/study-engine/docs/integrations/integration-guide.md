# Study integrations guide

## Purpose

This directory contains provisional, working demonstrations for daily study
calendar behavior, the tutor-generated review queue, Romeo Virtual Academy
assignment metadata, and parent insights/controls.

All adapters are local and side-effect free. They do not modify or connect to
the production calendar, database, authentication, identity, Parent Hub,
storage, Supabase, or deployment.

## Module map

| Surface | Entry point | Demonstration |
| --- | --- | --- |
| Daily calendar | `integrations/calendar/index.ts` | `buildCalendarMockDemonstration()` |
| Review queue | `integrations/review/index.ts` | `createMockReviewQueueDemo()` |
| Romeo assignment adapter | `integrations/romeo/index.ts` | `buildRomeoMockDemonstration()` |
| Parent dashboard and controls | `parent/index.ts` | `ParentDashboardPrototype` / `createParentDashboardDemoModel()` |

Detailed behavior is documented in:

- [Calendar and Romeo](./calendar-and-romeo.md)
- [Review queue](./review-queue.md)
- [Parent dashboard](./parent-dashboard.md)
- [Privacy report](./privacy-report.md)
- [Validation report](./validation-report.md)
- [Core-change requests](./core-change-requests.md)
- [Session 4 handoff](./session-4-handoff.md)

## Boundary rules

1. Treat every schema name beginning with `provisional-` as unstable pending
   coordinated integration review.
2. Supply opaque stable references. Do not pass a learner name, email, login,
   or external account credential as a reference.
3. Use ISO 8601 timestamps with `Z` or an explicit numeric offset for instants.
4. Supply an IANA time-zone name for calendar grouping.
5. Use `YYYY-MM-DD` for calendar-only due/scheduled dates.
6. Keep authorization outside these pure adapters and inside the existing host.
7. Persist nothing until an approved production adapter, retention policy, and
   owner review exist.
8. Preserve the parent-visible evidence and supportive student messages.

## Calendar demonstration

```ts
import {
  buildCalendarMockDemonstration,
  calendarBlockView,
  pauseCalendarBlock,
  resumeCalendarBlock,
} from "../../integrations/calendar/index.js";

const demo = buildCalendarMockDemonstration();

demo.partialFractionsView;
// {
//   title: "Fractions Lesson",
//   segmentsCompleted: 3,
//   totalSegments: 6,
//   estimatedMinutesRemaining: 16,
//   resumeAt: "Guided Practice",
//   ...
// }
```

Calendar state transitions return new values. The caller must retain the
returned block:

```ts
const paused = pauseCalendarBlock(activeBlock, {
  at: "2026-07-28T10:22:00-04:00",
  actor: "student",
  reason: "approved_break",
  approved: true,
});

const resumed = resumeCalendarBlock(
  paused,
  "2026-07-28T10:27:00-04:00",
);
```

`mergeCalendarEntries()` uses `learnerRef + dedupeKey` as logical identity. A
newer local revision wins over a repeated revision-zero import. Production
persistence must enforce equivalent uniqueness and concurrency rules.

## Review queue demonstration

```ts
import {
  buildDailyReviewQueue,
  createMockReviewQueueDemo,
} from "../../integrations/review/index.js";

const demo = createMockReviewQueueDemo();

demo.queue.scheduled; // work inside today's explicit limits
demo.queue.capacityHeld; // due work held with parent-visible reasons
demo.queue.upcoming; // future and explicitly deferred work
```

The core/tutor producer decides whether a directive is review, reteaching, or
prerequisite remediation and supplies its priority. The integration never
derives these from raw learner responses. The queue preserves priority and
holds later items when a higher-priority item cannot fit.

## Romeo Virtual Academy demonstration

```ts
import {
  romeoVirtualAcademyAdapter,
} from "../../integrations/romeo/index.js";

const assignment = romeoVirtualAcademyAdapter.normalize({
  externalAssignmentRef: "rva-algebra-204",
  externalAssignmentTitle: "Solving Two-Step Equations",
  externalCourse: "Algebra I",
  dueDate: "2026-07-31",
  estimatedDurationMinutes: 35,
  completionState: "in_progress",
  studentEnteredProgress: {
    completedUnits: 3,
    totalUnits: 5,
    updatedAt: "2026-07-28T09:10:00-04:00",
  },
  resumeNote: "Resume with question 6.",
  externalUrlReference:
    "https://academy.example.invalid/assignments/rva-algebra-204",
});
```

Do not add a credential to this input. Runtime validation rejects credential
keys, embedded URL credentials, and credential-like query keys. The adapter
does not fetch the URL. `toCalendar()` projects only the title, course,
external assignment reference, and estimated work duration needed for a
calendar block.

## Parent dashboard demonstration

The React prototype can be server-rendered or mounted by a separate review
harness:

```tsx
import {
  ParentDashboardPrototype,
  createParentDashboardDemoModel,
} from "../../parent/index.js";

<ParentDashboardPrototype
  initialModel={createParentDashboardDemoModel()}
/>
```

The prototype includes:

- TODAY: scheduled/completed blocks, reviewed skills, breaks, resumable work,
  and assignments needing support
- LEARNING: mastered/developing skills, prerequisite gaps, upcoming reviews,
  and repeated misconceptions
- STUDY HABITS: current observed work-block ranges, effective task lengths,
  shorter-section suggestions, approved breaks, recommendation direction, and
  visible evidence
- Every requested parent control

The CSS is mobile-first, avoids wide tables, keeps inputs fluid, uses 44-pixel
minimum touch targets, and progressively adds columns at wider breakpoints.
Hiding timers changes the rendered projection as well as the control state.

Parent events are explicit immutable commands:

```ts
import {
  applyParentControlEvent,
  createParentDashboardDemoModel,
} from "../../parent/index.js";

const initial = createParentDashboardDemoModel();
const next = applyParentControlEvent(initial, {
  type: "maximum_work_duration_set",
  minutes: 24,
  at: "2026-07-28T12:00:00-04:00",
});
```

`InMemoryParentDashboardAdapter` is a clone-on-read/dispatch demonstration. It
is not a production data source. A future host must authorize commands and map
them to existing production services.

## Error handling

Each package throws a typed error with a stable provisional `code`:

- `CalendarIntegrationError`
- `ReviewQueueError`
- `RomeoAdapterError`
- `ParentControlError`

Integrators should branch on the code and present supportive user-facing text.
Do not expose stack traces or convert a validation error into a learner label.

## Privacy integration checklist

Before passing data to a provisional adapter:

- Remove direct identity, contact data, raw answers, and transcripts
- Verify all references are opaque and stable
- Verify timestamps and time-zone context
- Reject any credential-bearing external assignment payload
- Keep parent-private notes out of the snapshot and student projection
- Include visible evidence for every learning or habit inference
- Preserve explicit parent overrides

See [privacy-report.md](./privacy-report.md) for residual limitations and
production conditions.

## Verification

From the repository root:

```powershell
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/integrations --configLoader runner
```

The suite includes calendar transformation, partial completion, resume,
time-zone and duplicate handling, external assignment validation, review
overload, parent overrides, mobile parent-dashboard behavior, privacy, and
static boundary validation.

## Integration status

Ready for dispatch review as a provisional demonstration. Not approved for
production persistence, authentication, deployment, or direct integration.
Future host needs are documented in
[core-change-requests.md](./core-change-requests.md).
