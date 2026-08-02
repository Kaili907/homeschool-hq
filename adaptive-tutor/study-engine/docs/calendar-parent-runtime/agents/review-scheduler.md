# Review Scheduler Integration Agent report

## Delivered seam

The review integration agent audited and hardened:

- `integration-labs/calendar-parent-runtime/review-runtime.ts`
- `tests/calendar-parent-runtime/review-runtime.test.ts`

The adapter accepts the Session 2 `ReviewRecommendation`, preserves
caller-supplied recommendation and occurrence IDs, updates the canonical Card 1
`StudentSkillReview`, and projects one Card 8 local queue occurrence. The queue
contract remains inside Session 8 because Card 1 intentionally has no canonical
queue aggregate.

## Reconciliation corrections

- Added the missing canonical `SessionId` to the DEC-017 result-return command.
  The command now carries review, occurrence, session, result, retrieval
  attempt, and evidence identities plus the caller-stable idempotency key and
  expected review revision.
- Added DEC-014 retry-window field names:
  `householdTimeZone`, `notBeforeLocalDate`, and `dueByLocalDate`. Existing Card
  8 date/time-zone aliases remain byte-equal for compatibility and are checked
  for disagreement.
- Added a deterministic source-envelope digest to adapter-created queue
  occurrences and canonical review metadata. Exact replay is idempotent;
  changed source bytes under a stable queue or recommendation identity fail
  closed without placing source content in the queue.
- Made old-recommendation replay safe after the canonical review advances:
  an already projected occurrence returns the current canonical aggregate
  instead of incrementing or rolling back its revision.
- Made result-return replay safe after the review advances. Exact command
  replay reuses the prior memory-only outbox value and successor occurrence.
  Reused result, attempt, or occurrence identities with different command bytes
  are rejected.
- A completed queue occurrence can be replayed only with the same actual
  duration and expected canonical review revision; a different duration is an
  identity conflict.

## Runtime behavior

- Retrieval failure becomes reteaching before a learner-local same-day retry.
- A confirmed prerequisite gap becomes prerequisite remediation before retry.
- Successful retrieval records the canonical attempt, expands the interval,
  completes the prior occurrence, and creates one deterministic successor.
- Same-day is a learner-local civil date, never an immediate retry. A projected
  slot requires explicit authorized policy provenance, an offset
  `retryNotBefore`, completed required preparation, a matching completed
  break/session boundary, and remaining same-day attempt capacity.
- Manual-review, awaiting-preparation, awaiting-boundary, and daily-attempt-limit
  retry intents are held out of the daily plan with distinct reasons. They do
  not consume review item/minute capacity.
- Required instruction is reserved before review capacity is calculated.
  Holds identify whether instruction reservation or the explicit review-minute
  cap was the binding constraint.
- Item and minute limits are hard. Priority is deterministic; a shorter
  lower-priority item cannot leapfrog a higher-priority item that did not fit.
- Actual duration remains independent from estimated duration.
- Only aggregate retrieval evidence crosses back to the engine.

## Canonical and adversarial checks

The boundary now validates:

- canonical recommendation date arithmetic and Session 2 vocabulary;
- learner-local `reviewedOn` and retrieval-attempt dates;
- canonical interval ID/day pairs and review headers;
- stable review, recommendation, occurrence, result, session, attempt, and
  evidence linkage;
- unique and disjoint segment/evidence identities;
- exact agreement between the canonical next action and authoritative
  retrieval-failure/prerequisite signals;
- authorized same-day actor/source vocabulary and event ordering;
- no preparation or support boundary predating the recommendation;
- no authorization timestamp after its retry-not-before instant;
- pending/completed queue state and actual-duration consistency.

Unexpected raw-answer, transcript, diagnosis, learner-name, and hidden-score
properties are not copied into queue or trace projections.

## Canonical authority

Canonical external authority:

- `contracts/review-scheduling.ts`
- `contracts/study-session.ts`
- `engine/review/review-scheduler.ts`
- Card 5 DEC-009, DEC-014, DEC-017, and enum/event mappings

Local-only types:

- `ReviewQueueEntry`
- `DailyReviewPlan`
- `LearnerLocalRetryIntent`
- `ReviewResultReturnCommand` / `ReviewResultReturnOutboxValue`
- deterministic `ReviewRuntimeTrace`

The local occurrence ID, source recommendation ID, canonical review ID,
canonical revision, session ID, result ID, attempt ID, and evidence ID remain
independent stable fields. No identity is regenerated from a title, learner
name, array position, or wall-clock timestamp.

## Validation

The focused suite contains 17 tests covering canonical creation/update,
source-payload replay conflicts, semantic duplicate prevention, strict priority,
daily item/minute limits, required-instruction protection, same-day manual and
attempt-limit holds, authorized retry windows, deterministic planning,
result-return/outbox replay, successful interval expansion, reteaching,
remediation, and evidence/action mismatch rejection.

- TypeScript strict typecheck: passed.
- Shared full Session 8 lab suite: passed, 86 of 86 tests.

## Remaining boundaries

- The queue, digest, and outbox are local in-memory lab adapters, not durable
  production persistence or dispatch.
- The deterministic source digest is a conflict detector, not an
  authentication or security-integrity primitive.
- A date-only same-day recommendation remains manual until an authorized adult
  or scheduler supplies the reviewed slot; this lab does not invent a time.
- Tutor Core v0.2 remains unverified. Card 5 remains
  `PASS_WITH_BLOCKER`; this work does not authorize production integration or
  final assembly.
