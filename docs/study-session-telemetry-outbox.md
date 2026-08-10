# Study session telemetry outbox

WIN-13 adds a transactional, server-private bridge from authoritative Study
session lifecycle acceptance to ADMIN operational telemetry V2:

```text
Study lifecycle transaction
  -> private durable receipt
  -> lease-based post-commit worker
  -> canonical operational telemetry writer
  -> idempotent academy_operational_events row
```

Session persistence remains authoritative. The outbox and operational ledger
are observational; no browser response waits for telemetry delivery, and a
delivery outage cannot reverse a committed session transition.

## Dependencies and compatibility

The migration depends on
`20260810151000_academy_study_session_semantics_v2.sql` and
`20260808121000_academy_operational_events.sql`. The server writer was brought
forward from committed telemetry-foundation commit
`d55c5dc6c5d9109952ba6fdc3e9a75a412e5b69a`; the outbox does not create a
second event ledger, validator, retention policy, or aggregate format.

The integrated identity schema names the active learner column
`lifecycle_status`, while the original ADMIN-2 writer RPC referred to the
provisional name `status`. The outbox migration preserves the frozen V2 RPC and
changes only that column binding so canonical delivery works against the real
Study identity schema.

## Acceptance and event mapping

The trusted `academy_study_execute_session_lifecycle_v2` boundary invokes the
private enqueue helper only after its existing authoritative operation returns
an accepted result. The enqueue and Study mutation are in the same database
transaction. Denials, validation errors, revision conflicts, invalid
transitions, unavailable/manual-review results, and failed transactions do not
create success receipts.

All delivered events use `engine=study`, `eventType=study.session`, and the
existing `success` result. The bounded metadata is:

| Accepted lifecycle fact | `operation` | bounded `reason_code` |
| --- | --- | --- |
| begin | `begin` | `session-begun` |
| resume read | `resume` | `session-resumable` or `session-closed` |
| ordinary state edge | `transition` | canonical transition type |
| paused-to-active edge | `resume` | `session-resumed` |
| checkpoint CAS | `checkpoint` | `checkpoint-saved` |
| terminal completion | `complete` | `session-completed` |
| terminal abandonment | `abandon` | `session-abandoned` |

Repeated resume reads at one session revision collapse to one intended event.
Mutation replays retain their original accepted revision and timestamp and hit
the same execution key.

## Authority, privacy, and time

The outbox key is a server-generated SHA-256 digest over the opaque session
reference, authoritative operation, mapped operation, and accepted revisions.
The browser cannot supply the execution key, result, outbox state, lease,
accepted timestamp, or durable revision.

The private receipt stores only the household scope needed by the canonical
household event. It has no student/learner identifier column. Delivery sets
`learner_id=null`; the aggregate shape therefore contains no learner identity.
The only curriculum context is the immutable release version and lesson
reference already accepted by Study authority. No learner answer, lesson text,
Tutor transcript, note, safety text, assessment content, audio, label,
inference, prompt/response, provider object, secret, exception, or raw database
error is accepted.

`accepted_at` on the receipt is owned by Study authority. The operational
ledger continues to own its canonical `occurredAt` at delivery time, as required
by the frozen ADMIN-2 contract.

## Delivery, idempotency, and retry

`academy_claim_study_session_telemetry_outbox_v1` uses `FOR UPDATE SKIP LOCKED`
and a bounded lease. Completion and retry require the matching opaque lease
token. Delivery calls the existing `createServerOperationalTelemetryWriter`
and `academy_record_operational_event_v2` using the receipt execution key.

If the event is recorded but acknowledgement is lost, the lease expires and a
later delivery receives the canonical writer's `replayed` result; no second
operational row is counted. Failures remain pending indefinitely with bounded
backoff. Stored delivery failure codes are only `validation_error`, `timeout`,
`telemetry_unavailable`, and `reconciliation_conflict`; arbitrary exception or
database text is never serialized.

The production composition module intentionally exposes no HTTP handler or
schedule. An authorized scheduled/manual invoker is deployment composition
work and must be reviewed before activation. Until then, durable receipts
accumulate safely without affecting Study authority.

## Migration and validation

Migration:
`20260810155000_academy_study_session_telemetry_outbox.sql`

Normalized SHA-256:
`f3685d4457141a9a00ddf32a23be27daa3f552d7061b42838fb41b4645e4f340`

It creates a forced-RLS `academy_private` table with no application-role table
grants, narrow service-role claim/complete/retry/readiness RPCs, and a Study
persistence metadata marker. It has not been applied to a hosted project.

Permanent focused coverage lives in
`supabase/study-session-telemetry-outbox.db.test.ts` and
`netlify/functions/_shared/study-session-telemetry/*.test.js`.
