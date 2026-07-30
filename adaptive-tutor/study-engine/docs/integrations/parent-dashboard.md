# Parent study-insights integration

Status: provisional, memory-only demonstration  
Owned package: `study-engine/parent/**`  
Contract version: `provisional-parent-dashboard.v1`

## Purpose

This package demonstrates a parent-visible study dashboard without modifying the
production Parent Hub, calendar, learner profile, authentication, database,
storage, or deployment code. It consumes a minimized snapshot and returns
explicit parent-control events through a provisional adapter boundary.

The working React mock is `parent/ParentDashboardPrototype.tsx`. Its default
fixture is `parent/demo-data.ts`, and `InMemoryParentDashboardAdapter` provides
a credential-free control round trip. The demo is interactive when rendered in
any React host; `ParentDashboardDemoPage` supplies the mobile viewport for a
standalone mock page.

## Dashboard projection

The parent snapshot contains only an opaque `studentRef`, a non-identifying
learner label, an IANA time-zone identifier, visible summary information, and
evidence records.

The prototype renders every required category:

- **TODAY:** scheduled blocks, completed blocks, skills reviewed, breaks taken,
  resumable work, and assignments needing support.
- **LEARNING:** mastered skills, developing skills, prerequisite gaps, upcoming
  reviews, and repeated misconceptions.
- **STUDY HABITS:** current effective work-block ranges, best-performing task
  lengths, subjects that benefit from shorter sections, approved breaks, a
  suggested increase/maintain/decrease direction, and the evidence supporting
  the recommendation.

The fixture intentionally uses the observational wording:

> Current effective math work-block range: 18–22 minutes

It does not convert a temporary work pattern into an “attention span,” learner
trait, diagnosis, score, or permanent label.

The resumable-work card demonstrates:

- Fractions Lesson
- 3 of 6 sections complete
- Estimated time remaining: 16 minutes
- Resume at: Guided Practice
- A supportive learner message that recognizes progress and offers a next step

## Parent controls

`ParentControlEvent` is a discriminated union. `applyParentControlEvent` applies
each event as a functional, immutable update and appends it to an in-memory
action log.

| Parent control | Event |
| --- | --- |
| Accept recommendation | `recommendation_accepted` |
| Reject recommendation | `recommendation_rejected` |
| Set maximum work duration | `maximum_work_duration_set` |
| Set break duration | `break_duration_set` |
| Hide timers | `timers_hidden_set` |
| Add accommodation | `accommodation_added` |
| Reschedule incomplete work | `incomplete_work_rescheduled` |
| Mark outside or technical interruption | `interruption_marked` |
| Add private note | `private_note_added` |
| Request teacher or tutor review | `review_requested` |

An accepted recommendation applies its suggested durations, but a later
explicit duration event remains the parent’s authoritative choice. Rejecting a
recommendation does not change duration preferences.

Reschedule moments require an ISO 8601 timestamp with `Z` or an explicit
offset. A reschedule is only accepted for a block present in
`today.resumableWork`; an integration must translate that accepted event into
its own calendar command. This package never writes calendar state.

## Provisional adapter

The contract deliberately exposes only two operations:

```ts
interface ParentDashboardAdapter {
  load(): Promise<ParentDashboardModel>
  dispatch(event: ParentControlEvent): Promise<ParentDashboardModel>
}
```

An approved future integration should:

1. Build `ParentDashboardSnapshot` from already-authorized, minimized calendar,
   review, and tutor projections.
2. Preserve every `ParentVisibleEvidence` record supplied with an insight.
3. Route control events to the owning calendar/tutor service after its own
   authorization and conflict checks.
4. Return a fresh projection after the owning service accepts the command.
5. Keep authentication tokens, external-service login credentials, raw tutor
   transcripts, webcam/camera data, and identity records outside this boundary.

The supplied in-memory adapter uses `structuredClone`, performs no network or
storage calls, and requests no login credentials.

## Privacy behavior

`auditParentDashboardPrivacy` checks the minimized snapshot for:

- prohibited surveillance, diagnostic, hidden-score, and permanent-label
  fields or language;
- missing parent-visible evidence for reviewed skills, learning insights,
  repeated misconceptions, task-length observations, shorter-section
  suggestions, and the overall recommendation;
- unsupportive learner-facing resume or next-step language.

`auditPrivateNoteIsolation` confirms that parent-only note contents were not
copied into the dashboard snapshot. The prototype shows only the count of
private notes. Free text is bounded, normalized, and rejected when it requests
surveillance, diagnosis, or permanent labeling.

The prototype performs no webcam monitoring, eye tracking, medical diagnosis,
hidden behavior scoring, or permanent child labeling. Evidence is always
visible to the parent, and the contract collects no official grades.

## Mobile behavior

The CSS is mobile-first:

- a one-column baseline with `minmax(0, 1fr)` and `min-width: 0`;
- no wide data table;
- 44-pixel minimum touch controls;
- full-width narrow-screen form fields and action buttons;
- two- and three-column progressive layouts at wider breakpoints;
- overflow-safe wrapping and reduced-motion support;
- a standalone page viewport of `width=device-width, initial-scale=1`.

## Validation

Focused tests:

```text
tests/integrations/parent-dashboard.test.tsx
tests/integrations/parent-overrides.test.ts
tests/integrations/mobile-parent-dashboard.test.tsx
tests/integrations/privacy-contract.test.ts
```

Coverage includes all dashboard categories, the exact non-diagnostic range
wording, partial/resumable work, all ten parent controls, immutable overrides,
unsafe-input rejection, parent-note isolation, evidence completeness,
credential absence, viewport/card behavior, touch sizing, responsive
breakpoints, and the hide-timers override.

## Core-change requests

No core change is required to review or run this mock. Before production
integration, the control room should assign owners for:

- an authorized snapshot assembler that maps calendar/review/tutor data into
  this minimized contract;
- durable, parent-only storage for private notes with retention/deletion rules;
- a command router for calendar reschedules and teacher/tutor review requests;
- conflict/idempotency handling for repeated control events;
- production authentication and parent-authorization checks outside this
  package.

Those requests are intentionally not implemented in this session.
