# Admin operational telemetry — contract v2

ADMIN-2 implements the privacy-minimized operational projection owned by
ADMIN-0-R1 commit `73693f9e12a4a02546a4245bfea71143262e2df9`. It records bounded
operational facts, not learner content. The contract version is `2`.

## Canonical envelope and vocabulary

Every accepted event receives its durable UUID and `occurredAt` timestamp from
the trusted server. Callers provide a stable, bounded execution key solely for
idempotency. They cannot supply either durable identity or occurrence time.

The canonical engines are exactly `tutor`, `study`, `assessment`, `curriculum`,
`jarvis`, `tts`, `gateway`, and `sync`. Results are exactly `success`,
`fallback`, `rejected`, `timeout`, `provider_error`, `validation_error`, and
`safety_stop`.

The canonical event types are `tutor.turn`, `study.session`,
`assessment.attempt`, `curriculum.load`, `jarvis.turn`, `tts.synthesis`,
`gateway.request`, `sync.operation`, `safety.classification`, and
`persistence.operation`. Primary engine event types require their matching
engine. Safety classification is available only to its applicable engines;
persistence operations are available to all eight engines.

Events explicitly discriminate `household` scope from `system` scope.
Household events require an active household and may reference a learner in
that household. System events require both references to be null. `appVersion`
and `engineVersion` are always required. `curriculumVersion` is nullable only
when curriculum is irrelevant; it is required for `curriculum.load` and whenever
course, unit, lesson, or skill references are present.

## Metadata and privacy boundary

Metadata is a flat scalar map capped at 2 KiB, with strings capped at 128
characters. Its only keys are `attempt`, `cache_hit`, `failure_stage`,
`feature_flag`, `http_status`, `operation`, `provider`, `reason_code`,
`retryable`, `route`, `severity`, `source`, and `voice_ref`. Values use bounded
tokens or their defined integer/boolean form; `reason_code` is the canonical
machine-readable explanation channel. Unknown keys, nested values, free prose,
and secret-like tokens are rejected.

Messages, conversations, transcripts, prompts, responses, learner audio,
emotional labels, personality judgments, diagnostic inferences, assessment
answers, answer content, and raw answers are prohibited. TypeScript validates
before dispatch, the write RPC accepts an exact fact shape, table constraints
revalidate durable data, and stored rows are decoded as untrusted input before
being returned to the application.

## Trust, authorization, and idempotency

Only isolated service-role infrastructure can execute
`academy_record_operational_event_v2`. Trusted server workflows resolve scope,
household, learner, result, duration, versions, and operational context before
calling it. Browser and ordinary guardian writes are denied.

An identical replay of a stable execution key returns the original event,
including its original UUID and timestamp. A replay with any differing fact
returns `reconciliation_conflict`; it never overwrites the original row.

Legacy bounded reads use `academy_list_operational_events_v2` through a server-resolved active
Admin assignment with the canonical `engines:read` capability. The database
surface is service-only and requires that capability assertion. Ordinary
guardians, authenticated clients, and anonymous clients have no telemetry read
path or direct table privileges. Authorization resolution itself remains owned
by the Admin authorization layer.

`academy_aggregate_operational_events_v2` is the scalable Admin seam. It accepts
a half-open server range of at most 366 days plus canonical engine/version and
course/unit filters. SQL performs the aggregation; the browser never receives
an event dump. Responses declare their 4,096-group bound, exact group count,
`grouping: complete`, total event count, and per-retention-class completeness.
More than 4,096 groups is an explicit error, not a truncated success. Aggregate
groups contain allowlisted operational dimensions, counts, duration summaries,
and first/last timestamps only—never event/execution IDs, household/learner
identity, or raw metadata.

## Failure and retention semantics

Operational telemetry is best effort. Invalid input fails before persistence;
a telemetry outage after a learner action succeeds returns `not-recorded` and
does not roll back learner state. This does not weaken fail-closed safety,
security, protected persistence, or administrative audit rails.

Retention is declared at write time and enforced by expiry:

| Category | Duration | Applies to |
| --- | ---: | --- |
| `diagnostic_short` | 30 days | successful ordinary engine observations |
| `operational_standard` | 90 days | non-success results plus gateway, sync, and persistence operations |
| `safety_extended` | 365 days | safety classifications and `safety_stop` results |

Reporting is trustworthy only when every population used by a count/rate is
complete for the requested range. `diagnostic_short` is complete through 30
days, `operational_standard` through 90 days, and `safety_extended` through 365
days. The aggregate reports these independently and filters logically expired
rows even before physical purge. Ordinary performance rates include successful
diagnostic events, so Admin Engine Performance is limited to 7- and 30-day
windows; the former 90-day option is rejected rather than comparing 30-day
successes with 90-day failures. Admin Health's longest window is 7 days and is
retention-safe for all three categories.

Expired rows are removed only by the bounded service-role purge RPC. The
ledger migration is `20260808121000_academy_operational_events.sql`; the additive
aggregate migration is
`20260809120000_academy_operational_telemetry_foundation.sql`. No hosted
migration has been applied.

## Production writer seam

`createServerOperationalTelemetryWriter` is the shared emission primitive for
the later TEL-AI-GATEWAYS, TEL-STUDY, TEL-TUTOR-OPS, TEL-TUTOR-OUTCOMES,
TEL-ASSESSMENT, TEL-SYNC, and TEL-CURRICULUM cards. Its observation input has no
scope, household, learner, app-version, engine-version, or curriculum-version
fields. A server authority resolver supplies verified scope; deployment
configuration resolves `ACADEMY_APP_VERSION`, `COMMIT_REF`, or `DEPLOY_ID`;
each canonical engine must register its own `ACADEMY_<ENGINE>_ENGINE_VERSION`;
and curriculum instrumentation registers a trusted curriculum resolver. Missing
trusted versions fail validation—there is no invented `unknown` version.

The writer validates exact canonical fields and privacy allowlists before the
service-role store call. Identical execution-key replay returns the original
event; differing replay reports reconciliation conflict. Store/failure-notice
outages return `not-recorded` and do not undo completed learner work. This
observational rule does not alter independently fail-closed safety, security,
protected persistence, or administrative audit enforcement.

## Ownership boundary

This card provides the shared operational event contract, validation,
persistence, retention, and server read surface. It does not instrument every
engine workflow, calculate provider cost, resolve Admin assignments, build the
Admin UI, deploy, or apply hosted migrations. ADMIN-0 owns shared contracts,
ADMIN-1 owns authorization, ADMIN-3 owns cost accounting, and ADMIN-5 owns UI.
