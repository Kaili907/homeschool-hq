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

Reads use `academy_list_operational_events_v2` through a server-resolved active
Admin assignment with the canonical `engines:read` capability. The database
surface is service-only and requires that capability assertion. Ordinary
guardians, authenticated clients, and anonymous clients have no telemetry read
path or direct table privileges. Authorization resolution itself remains owned
by the Admin authorization layer.

### ADMIN-4 bounded performance source

Engine Performance currently consumes the legacy 500-row read. Its projection
captures the raw source row count before stored-event decoding. Reaching 500 raw
rows marks the source partial even when malformed rows reduce the accepted event
count; rejected rows are reported separately, excluded from every metric and
evidence threshold, and also keep source completeness partial below the limit.

After TEL-FOUNDATION is integrated, a dedicated follow-up should source Engine
Performance from `academy_aggregate_operational_events_v2`, map its declared
group and retention completeness into the projection, and preserve the existing
metric and insufficient-evidence semantics. This ADMIN-4 correction does not
integrate that additive migration or aggregate reader.

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

Expired rows are removed only by the bounded service-role purge RPC. The
migration is named `20260808121000_academy_operational_events.sql`; the ADMIN-R1
integration assigns it after Admin authorization and before provider usage/cost
accounting. No hosted migration has been applied.

## Ownership boundary

This card provides the shared operational event contract, validation,
persistence, retention, and server read surface. It does not instrument every
engine workflow, calculate provider cost, resolve Admin assignments, build the
Admin UI, deploy, or apply hosted migrations. ADMIN-0 owns shared contracts,
ADMIN-1 owns authorization, ADMIN-3 owns cost accounting, and ADMIN-5 owns UI.
