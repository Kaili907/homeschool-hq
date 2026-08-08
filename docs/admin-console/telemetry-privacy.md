# Operational telemetry and privacy contract

## Purpose and separation

The Admin operational ledger answers whether systems worked, how long they took,
and which safe operational outcome occurred. It is not a replacement for Study
learning evidence, safety records, gateway quotas, protected learner work, or
administrative audit history.

Contract version 1 is `AdminOperationalEvent` in `src/admin/contracts.ts`.

## Required event shape

Each accepted event contains:

- `schemaVersion`, currently `1`;
- a globally unique `eventId` and UTC `occurredAt` instant;
- `scope`: `household` or `system`;
- an opaque `householdRef` for household events and optional opaque
  `learnerRef`; system events set both to `null`;
- canonical `engine` and immutable `engineVersion`;
- immutable deployed `appVersion`;
- `curriculumVersion`, nullable only when curriculum is irrelevant;
- nullable opaque course, unit, lesson, and skill references;
- one allowlisted `eventType` and canonical `result`;
- non-negative integer `durationMs`, or `null` when no duration exists; and
- a flat, bounded, allowlisted metadata object.

Trusted server context supplies household/learner identity wherever available.
Writers must not accept a browser's household, learner, result, duration, token,
or cost claim as authoritative.

## Event and metadata allowlists

Version 1 event types are:

- `tutor.turn`
- `study.session`
- `assessment.attempt`
- `curriculum.load`
- `jarvis.turn`
- `tts.synthesis`
- `gateway.request`
- `sync.operation`
- `safety.classification`
- `persistence.operation`

Metadata keys are the constants in `ADMIN_TELEMETRY_METADATA_KEYS`. A writer must
reject unknown keys. Values are scalars only: string, safe integer, boolean, or
null. Objects, arrays, binary data, and free text are rejected. String values
must be selected from a per-key enumeration or match a bounded opaque-token
grammar; they may not contain prose. The serialized metadata limit is 2 KiB and
each string limit is 128 characters. Adding a key requires an ADMIN contract
revision plus privacy review.

Event IDs and accepted timestamps should be server-generated. Client event IDs
may be used only as bounded idempotency inputs and must not replace server
identity or acceptance time.

## Prohibited telemetry

The operational ledger must not store, by default or through metadata:

- raw or summarized learner/Tutor conversations;
- raw or summarized Study conversations;
- prompts, model responses, transcripts, or learner free text;
- student audio or audio encodings;
- emotional labels or inferred emotional state;
- personality judgments or inferred traits;
- diagnostic or clinical inferences;
- assessment questions, answer content, answer keys, or learner response text;
- secrets, bearer tokens, credentials, provider keys, contact details, or
  protected learner work.

The prohibited field-name constants are defense in depth, not the whole control.
ADMIN-2 must use exact-object validation, per-key value validation, byte bounds,
and tests proving that prohibited content cannot hide inside an allowed key.

## Failure behavior and retention

Telemetry is best-effort for a learning request: a telemetry outage must not
corrupt or roll back accepted learning state. A writer reports failure through a
bounded server diagnostic/health signal and never falls back to persisting the
raw request. Safety enforcement, audit atomicity, and protected persistence keep
their existing stricter failure behavior; this rule does not weaken them.

Retention must be declared per event category before production. The default is
the shortest duration that supports operational diagnosis. Retention expiry must
not delete an independent safety, learning-evidence, cost, or audit record.

## Existing-contract mapping

- Study's `academy_study_event_ledger` and monitoring validators demonstrate
  exact keys, bounded payloads, sensitive-field rejection, idempotency, and
  learner-state separation. Do not widen their payloads for Admin convenience.
- Local Study safety stops may be `available`, `incomplete`, or `unavailable`.
  Admin health must preserve that uncertainty; missing local history is never
  reported as zero stops.
- Sync conflicts, provenance pauses, persistence errors, and gateway errors map
  into canonical engine/result/health states without copying their source data.
