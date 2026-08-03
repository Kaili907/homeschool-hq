# Provisional review queue integration

## Scope and safety boundary

This package is a pure, framework-independent demonstration. It does not read
or write a database, calendar, identity provider, dashboard, notification
service, or tutor core. It accepts explicit review items, returns a daily plan,
and performs no network, storage, authentication, or clock access.

The tutor core remains authoritative for whether a learner needs ordinary
review, reteaching, or prerequisite remediation and for the priority assigned
to that work. The review integration only orders those directives and applies
parent-visible daily limits.

Implementation entry point:
`adaptive-tutor/study-engine/integrations/review/index.ts`.

## Behavior traceability

| Requested behavior | Contract or implementation | Automated proof |
| --- | --- | --- |
| Tutor-generated reviews | `ReviewItem.source: "tutor_generated"` and runtime validation | Mock-demo coverage test |
| Same-day review | `classifyReviewTiming()` returns `same_day` for the planning date | Classification and mock-demo tests |
| Future review | Future items appear in `DailyReviewQueue.upcoming` | Classification and mock-demo tests |
| Overdue review | Earlier calendar dates are due with `timing: "overdue"` | Classification and mock-demo tests |
| Reteaching | `ReviewItem.kind: "reteaching"` | Mock-demo coverage test |
| Prerequisite remediation | `ReviewItem.kind: "prerequisite_remediation"` | Mock-demo coverage test |
| Review deferral | Pure `deferReview()` transform plus structured `ReviewDeferral` evidence | Immutable, invalid, and completed-item deferral tests |
| Daily review limit | `DailyReviewLimits.maxItems` and `maxMinutes` are hard caps | Separate item-limit and minute-limit tests |
| Review priority | Explicit order `urgent`, `high`, `normal`, `low`; then oldest date and opaque reference | Priority ordering test |
| Avoiding review overload | Due work beyond either cap is returned in `capacityHeld`, never silently discarded | Item-limit, minute-limit, and strict-priority tests |

## Contracts

`ReviewItem` contains only:

- Opaque review and skill references
- A short curricular title
- Tutor-generated source
- Review, reteaching, or prerequisite-remediation kind
- Explicit priority
- Creation and scheduled calendar dates
- Estimated whole minutes
- Pending or completed state
- Structured deferral records

Calendar dates use `YYYY-MM-DD`. The caller supplies the learner's relevant
local planning date. The planner compares those calendar dates directly instead
of constructing local-midnight `Date` objects, preventing a host time zone from
moving a review to the previous or next day.

`DailyReviewQueue` separates:

- `scheduled`: due work that fits the limits
- `upcoming`: future work, including explicitly deferred work
- `capacityHeld`: due work kept for a later plan because of a cap
- `completedExcludedReviewRefs`: completed work omitted from the plan
- `summary`: counts, total scheduled minutes, overload status, and
  parent-visible evidence

## Deterministic queue policy

The planner uses this stable order:

1. Explicit tutor priority: urgent, high, normal, low.
2. Earlier scheduled date.
3. Opaque review reference.

Both the item count and total estimated minutes are hard daily limits. When a
due item cannot fit the remaining minutes, it is held with reason
`daily_minute_limit`. All later items are held with `priority_preserved`, even
if a shorter lower-priority item could fit. This prevents low-priority work from
quietly leapfrogging higher-priority support. Reaching the item cap gives all
remaining due work reason `daily_item_limit`.

Capacity-held reviews are not mutated or automatically moved to another date.
The result explains why each was held; a parent, tutor, or future scheduling
adapter can explicitly call `deferReview()` with a new date.

## Working mock demonstration

`createMockReviewQueueDemo()` uses fixed data for July 28, 2026:

- An urgent overdue fractions reteaching review
- A high-priority same-day prerequisite warm-up
- Normal and low same-day reviews
- A future review
- A student-requested review deferral
- A limit of three items and 25 minutes

The urgent 10-minute and high-priority 8-minute reviews are scheduled. The
normal 12-minute review is held because it would exceed 25 minutes. The later
low-priority five-minute review is also held so it cannot leapfrog. Future and
deferred work remains visible in `upcoming`.

Example:

```ts
import {
  createMockReviewQueueDemo,
} from "../../integrations/review/index.js";

const demo = createMockReviewQueueDemo();

demo.queue.summary;
// {
//   dueCount: 4,
//   scheduledCount: 2,
//   scheduledMinutes: 18,
//   capacityHeldCount: 2,
//   upcomingCount: 2,
//   completedExcludedCount: 0,
//   overloadAvoided: true,
//   evidence: [...]
// }
```

## Privacy and supportive-language review

- No learner name, email, birth date, diagnosis, medical inference, raw answer,
  transcript, credential, or external account identifier exists in the
  contract.
- No webcam monitoring, eye tracking, hidden behavior scoring, or permanent
  child label is performed or requested.
- Priority is supplied by the tutor core for a specific review item. It is not a
  learner trait.
- Exact limits, estimates, ordering evidence, and hold reasons remain visible
  to parents.
- Student messages use phrases such as "still ready when you are" and "stays
  manageable." They do not use failure labels or attention-span claims.
- The queue is ephemeral. A production owner must make any persistence and
  retention decision outside this provisional adapter.

## Core-change requests

No core changes were made. Future integration needs an approved core-owned
directive with these fields:

- Stable opaque `reviewRef` and `skillRef`
- Short supportive curricular title
- `kind`
- `priority`
- `createdDate` and `scheduledDate` in the learner's calendar context
- `estimatedMinutes`

The production calendar or parent dashboard would also need to supply the
applicable local `planningDate` and explicit daily limits. Those systems should
consume the returned evidence rather than silently dropping `capacityHeld`
reviews. Decisions about automatically suggesting a later date remain outside
this adapter.

## Validation

Focused tests:

```text
npx vitest run adaptive-tutor/study-engine/tests/integrations/review-queue.test.ts
```

The suite covers all traceability rows, deterministic ordering, immutable
deferral, invalid deferral, completed-review exclusion, duplicate protection,
supportive language, and forbidden-data absence.
