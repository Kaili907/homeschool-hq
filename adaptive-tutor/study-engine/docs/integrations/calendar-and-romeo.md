# Calendar and Romeo Virtual Academy provisional integrations

## Scope and safety boundary

This package is a framework-independent demonstration seam. It does not call or
modify a production calendar, database, authentication provider, parent
dashboard, deployment, or storage layer. It accepts opaque learner/source
references and returns immutable TypeScript values for an integrating
application to review and persist through its own approved boundary.

All timestamps that represent an instant require ISO 8601 with `Z` or a numeric
offset. Calendar grouping uses an explicit IANA time zone. Romeo due dates use
`YYYY-MM-DD`, because the upstream record provides a calendar day rather than an
invented time of day.

## Contract locations

- `integrations/calendar/types.ts` contains the daily block, segment, event,
  interruption, progress-bar, continuation, parent-edit, and planner contracts.
- `integrations/calendar/calendar.ts` contains pure transformations and
  immutable state transitions.
- `integrations/calendar/mock-demo.ts` builds a working in-memory demonstration.
- `integrations/romeo/types.ts` contains the generic external-assignment adapter
  and Romeo assignment contracts.
- `integrations/romeo/adapter.ts` validates Romeo metadata and transforms it to a
  provisional calendar block.
- `integrations/romeo/mock-demo.ts` builds a credential-free assignment and
  proves a repeat import is deduplicated.

## Daily block coverage

`DAILY_CALENDAR_BLOCK_TYPES` is the exhaustive contract for:

1. New instruction
2. Guided practice
3. Independent practice
4. Reading
5. Writing
6. Memorization
7. Assessment
8. Project work
9. Review
10. Physical education
11. Outside activity
12. Romeo Virtual Academy activity
13. Parent-created activity

The mock demonstration creates one block of every type.

## Calendar behavior map

| Required behavior | Contract / implementation | Demonstration / validation |
| --- | --- | --- |
| Estimated duration | Segment `estimatedMinutes`; block total is derived | Transformation and progress tests |
| Actual duration | Segment `actualMinutes`, accumulated only during active intervals | Partial/resume tests |
| Segment-level completion | `completeCurrentSegment` enforces displayed order | Partial and transformation tests |
| Pause and resume | `pauseCalendarBlock`, `resumeCalendarBlock` | Fractions mock and resume test |
| Partial completion | `CalendarCompletionState` and `calendarBlockView` | Fractions mock: 3 of 6 |
| Automatic continuation | `createAutomaticContinuation` copies only unfinished segments | Continuation test |
| Drag-and-drop rescheduling | `rescheduleCalendarBlock(... method: "drag_drop")` | Transformation test and project mock |
| Parent edits | `applyParentCalendarEdit` with a visible audit event | Transformation test and reading mock |
| Approved breaks | `approved_break` requires `approved: true` | Partial/resume test |
| Outside interruptions | `outside_interruption` pause reason | Partial/resume test |
| Technical interruptions | `technical_interruption` pause reason | Partial/resume test and writing mock |
| Daily completion bar | `dailyCompletionBar` uses completed estimated segment minutes | 75% weighted progress test |
| Weekly completion bar | `weeklyCompletionBar` uses a seven-day local-date window | 75% weighted progress test |
| Duplicate prevention | `mergeCalendarEntries` keys on learner plus stable source identity | Duplicate and Romeo tests |
| Time-zone safety | Offset-bearing instants, IANA zones, optional intended-day guard | UTC-boundary and DST-overlap tests |

The required partial lesson is available from
`buildCalendarMockDemonstration()`:

```text
Fractions Lesson
3 of 6 sections complete
Estimated time remaining: 16 minutes
Resume at: Guided Practice
```

The state also records active work minutes separately from break/interruption
time. A pause does not erase partial progress. Automatic continuation leaves the
original record immutable and links a new entry with `continuationOf`.

## Romeo Virtual Academy field map

| Required external field | Provisional contract field | Validation |
| --- | --- | --- |
| External assignment title | `externalAssignmentTitle` | Trimmed, 1–200 visible characters |
| External course | `externalCourse` | Trimmed, 1–120 visible characters |
| Due date | `dueDate` | Real `YYYY-MM-DD` date |
| Estimated duration | `estimatedDurationMinutes` | Positive finite minutes |
| Completion state | `completionState` | `not_started`, `in_progress`, or `completed` |
| Parent-entered progress | `parentEnteredProgress` | Whole completed/total units plus offset timestamp |
| Student-entered progress | `studentEnteredProgress` | Whole completed/total units plus offset timestamp |
| Linked Manuel Academy tutoring support | `linkedManuelAcademyTutoringSupport` | Opaque support ref, visible title, explicit state |
| Resume note | `resumeNote` | Optional visible text, maximum 500 characters |
| External URL reference | `externalUrlReference` | HTTPS only; no URL credentials or credential query keys |

`effectiveRomeoProgress` reports only the explicit external, parent-entered, or
student-entered progress. It does not infer engagement, attention, behavior, or
mastery. Parent and student entries remain separately visible on the normalized
assignment.

`romeoAssignmentToCalendarBlock` maps a Romeo assignment to the
`romeo_virtual_academy_activity` block type. The stable dedupe key is derived
from the provider and opaque external assignment reference, so a repeat import
does not create another entry.

## Credential and privacy rules

The Romeo input type has no login or credential fields. Runtime validation also
rejects objects containing password, passcode, login, username, credential,
secret, API-key, access-token, refresh-token, or session-cookie keys. URL
references reject embedded user information and credential-like query
parameters.

Calendar state stores only the minimum scheduling data required for the
demonstration:

- opaque learner, entry, source, segment, and continuation references;
- visible activity labels and optional subject;
- explicit scheduling and duration data;
- segment completion, pause reason, and a small visible audit history.

It collects no webcam or eye-tracking data, makes no diagnosis, computes no
hidden behavior score, and creates no permanent child label. Free-form
interruption surveillance data is intentionally absent.

## Example use

```ts
import {
  buildCalendarMockDemonstration,
} from "../../integrations/calendar/index.js";
import {
  buildRomeoMockDemonstration,
} from "../../integrations/romeo/index.js";

const calendar = buildCalendarMockDemonstration();
const romeo = buildRomeoMockDemonstration();

calendar.partialFractionsView.estimatedMinutesRemaining; // 16
calendar.partialFractionsView.resumeAt; // "Guided Practice"
romeo.calendarEntryCountAfterRepeatImport; // 1
```

## Provisional integration assumptions

- The host supplies stable opaque learner and source references. These packages
  do not derive identity.
- The host supplies explicit-offset instants and an IANA time zone. The adapter
  never guesses a browser or server time zone.
- Segment estimates come from the approved plan or parent-facing editor.
- Parent/student actions reach these pure functions only after the host performs
  its existing authorization checks.
- Romeo metadata is entered or obtained through an independently approved
  credential-free boundary. This package does not sign in, scrape, or fetch.
- Calendar persistence, conflict transport, notifications, and drag UI remain
  host responsibilities.

## Calendar-scoped core-change requests

No core change was made in this session. A future integration review may choose
to provide these host seams:

1. A read-only study-plan projection with stable source reference, block type,
   segments, explicit-offset start, and IANA time zone.
2. An authorized command boundary that translates student/parent UI actions to
   the pure transition functions.
3. A persistence adapter that uses `learnerRef + dedupeKey` as the logical
   uniqueness boundary and retains the higher local revision on repeat import.
4. A parent-visible audit renderer for reschedules, edits, approved breaks, and
   interruption reasons.
5. An external-assignment metadata intake that explicitly excludes all
   credential material.

These are requests for later integration, not authorization to change calendar,
database, identity, authentication, storage, or parent-dashboard production
code.

## Validation commands

```powershell
npm test -- adaptive-tutor/study-engine/tests/integrations/calendar-transformation.test.ts adaptive-tutor/study-engine/tests/integrations/calendar-partial-resume.test.ts adaptive-tutor/study-engine/tests/integrations/calendar-timezone-duplicates.test.ts adaptive-tutor/study-engine/tests/integrations/external-assignment-adapter.test.ts
```

The focused suite covers calendar transformation, partial completion, resume,
approved/outside/technical pauses, automatic continuation, parent edits,
drag-and-drop, daily/weekly progress, time-zone boundaries, daylight-saving
overlap, external assignment validation, credential rejection, and duplicate
entries.
