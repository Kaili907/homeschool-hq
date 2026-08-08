# Admin operational telemetry foundation

This foundation is an append-only, privacy-minimized event rail. It records
operational outcomes and bounded educational references, not learner content.
The names below are provisional until ADMIN-0 reconciles the shared Admin
Console vocabulary.

## Event envelope

Every event has a caller-generated UUID, canonical UTC occurrence time,
household UUID, optional learner UUID, engine and engine version, event type,
result, optional bounded duration, and exact-key typed metadata. Application and
curriculum versions plus course, unit, lesson, and skill references are optional;
curriculum references require a curriculum version.

The initial engines are `study`, `tutor`, `assessment`, `sync`, `application`,
and `infrastructure`. Results are `success`, `failure`, `cancelled`, `rejected`,
`timeout`, `unavailable`, and `duplicate`.

The initial event variants are:

| Event type | Required metadata | Learner rule |
| --- | --- | --- |
| `session.lifecycle` | allowlisted `phase` | required |
| `persistence.operation` | allowlisted `operation`; boolean `retryable` | optional |
| `sync.lifecycle` | allowlisted `phase` and `direction` | optional |
| `safety.decision` | allowlisted `decision` | required |
| `assessment.lifecycle` | allowlisted `phase` | required |
| `application.lifecycle` | allowlisted `phase` | optional |
| `infrastructure.health` | allowlisted `component` and `state` | forbidden |

Metadata is not an extension bag. Both TypeScript and PostgreSQL require the
exact keys and enum/boolean values for the selected variant. Unknown keys,
oversized values, arbitrary strings, and mismatched engine/event combinations
are rejected. Duration is an integer from 0 through 86,400,000 milliseconds.

## Privacy boundary

There are no fields for conversations, prompts, responses, audio, speech,
emotions, personality, psychological or diagnostic inference, assessment
answers, journals, messages, or other raw content. The typed API rejects unknown
or prohibited field names, the database RPC accepts an exact envelope, and the
table constraint revalidates variant metadata. Learner IDs must belong to the
event household through a composite foreign key.

## Read and write security

Callers use `createOperationalTelemetry` with an
`OperationalTelemetryStore`; the supplied Supabase adapter hides RPC and column
details. Writes go only through `academy_record_operational_event_v1`. The table
is append-only to callers, duplicate UUIDs fail, and no upsert path exists.

The table has enabled and forced RLS. It grants no table privilege to anonymous
or authenticated clients. Authenticated active guardians read through the
bounded `academy_list_operational_events_v1` RPC after household and optional
learner permission checks. Trusted service-role callers may use both RPCs.
Students and anonymous clients have neither direct table reads nor RPC execute
access.

## Failure semantics

Operational telemetry is observational. Unsafe input is rejected before a
write. Once a learner action succeeds, a telemetry-store outage returns
`not-recorded`; it does not roll back, replace, or corrupt learner state. The
optional failure notice contains only event ID, engine, event type, and a fixed
code.

This rule does not weaken an existing safety or security rail. Safety stops,
authorization, and other fail-closed records keep their dedicated durable
semantics and must never depend on best-effort operational telemetry.

## Ownership boundary

This card supplies generic operational event persistence, validation, and
read/write contracts. It does not instrument every engine workflow, calculate
AI/TTS/token cost, define provider pricing, or build Admin UI. ADMIN-3 owns cost
accounting; ADMIN-5 owns UI; ADMIN-0 owns final shared naming.
