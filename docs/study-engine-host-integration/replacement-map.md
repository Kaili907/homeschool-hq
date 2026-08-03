# Session 13 and Session 14 Replacement Map

Every implementation in `localDevelopmentPorts.ts` is labeled `LOCAL DEVELOPMENT ONLY — NOT DURABLE` and isolated behind one of the required ports.

## Session 13 — persistence and durable calendar/parent state

| Provisional port | Current behavior | Exact replacement point |
|---|---|---|
| `StudyPersistencePort` | In-memory safe session snapshots and learner preferences | Replace the object supplied as `ports.persistence` in `createLocalDevelopmentStudyPorts`; retain the interface and learner/household/session validation. |
| `StudyCheckpointPort` | In-memory monotonic checkpoint with cross-learner rejection | Replace `ports.checkpoint`; use an atomic durable compare-and-swap and unique session/learner binding. |
| `StudyReviewQueuePort` | In-memory semantic dedupe and parent decision | Replace `ports.reviewQueue`; preserve unique semantic identity `(learner,evidence,lesson,dueDate)` and safe reason codes. |
| `StudyCalendarPort` | Stores accepted RC1 `CalendarBlock` objects in memory | Replace `ports.calendar`; persist canonical block identity, revision, exact resume metadata, lineage, and continuation keys atomically. |
| `StudyParentSettingsPort` | In-memory revisioned public settings | Replace `ports.parentSettings`; retain RC1 validation, adult authorization, optimistic concurrency, and non-diagnostic accommodation text. |
| `StudyAdultPrivatePort` | Separate private map, never included in public inspection | Replace `ports.adultPrivate` with the adult-only encrypted/authorized store. Do not expose existence or body to ordinary student/public projections. |
| `StudyEventLedgerPort` | In-memory event and semantic idempotency | Replace `ports.eventLedger` with an atomic durable uniqueness constraint and collision quarantine. |
| `StudyOutboxPort` | Stores proposals marked `proposed-not-delivered` | Replace `ports.outbox` with the Session 13 durable transactional outbox. Delivery status must remain truthful. |

Session 13 must also replace `localDevelopmentHouseholdTimeZone()` with durable household settings and remove the local preview seeding path from normal authenticated use.

## Session 14 — safety, identity, voice, and adult delivery

| Boundary | Current behavior | Exact replacement point |
|---|---|---|
| `StudySafetyPort` | Explicit injected local forced-outcome classifier; no production classifier implemented | Supply a reviewed production `StudySafetyPort` at `ports.safety`. It must preserve the accepted versioned classifier shape and fail closed for missing, throwing, malformed, uncertain, urgent, or invalid outcomes. |
| RC1 learner binding | `Rc1LocalLearnerBindingAdapter` binds the RC1 sentinel to one host learner/session and strips it from projections | Replace `AcceptedRc1HostRuntime` use of the sentinel when the controlled public Tutor wrapper accepts `studentId/learnerRef`. Remove the reprojection adapter only after accepted receipts carry the selected learner. |
| Voice/media | Jarvis is text/captions with `no-audio` or `unavailable`; no provider call | Inject a secured gateway-only Study voice/media port. Never reuse browser-local Tutor/ElevenLabs key paths or direct provider headers. |
| Adult review delivery | Outbox status is always `proposed-not-delivered`/`local-only-not-delivered` | Connect the reviewed Session 14 delivery boundary. Do not show “notified” until a durable delivery receipt exists. |
| Mid-flight identity epoch | Callback rechecks the current host binding before/after the accepted call | Replace with the Session 14 authenticated identity epoch/cancellation source while preserving late-result discard semantics. |

No replacement may pass raw learner text, transcripts, adult-private note bodies, provider keys, or Supabase clients into Study evidence or presentation ports.
