# Exact Recovery and Durable Hook Boundaries

## Recovery checkpoint

`StudyRecoveryCheckpointV1` records:

- session, lesson, and segment IDs;
- safe Tutor phase/cycle/item/turn cursor;
- completed segment IDs;
- per-segment active seconds;
- paused and break seconds;
- protected draft reference, never draft content;
- protected Tutor-state reference, never Core state content;
- last accepted event ID and event version;
- Tutor interaction reference;
- technical interruption state;
- revision and timestamps;
- literal raw-answer/transcript exclusion flags.

`validateRecoveryCheckpoint` enforces exact keys, version 1, ID/date formats,
known segments, session/lesson identity, revision freshness, optional
last-event equality, and future-date limits. A stale or mismatched checkpoint
quarantines and cannot resume.

Exact instructional restoration is delegated to
`TutorRecoverySidecarPort`. Its production implementation must keep Core
observations, attempts, scores, response counts, selected misconceptions, raw
responses, and transcripts behind the Tutor-owned boundary. The bridge sees
only a version-bound `tutor-state:` reference and a restored/stale/quarantined
result.

## Duplicate prevention

`acceptEventOnce` keeps an interface-level digest ledger:

- identical event ID and content → `duplicate-ignored`;
- same ID with different content → `event-id-collision` quarantine;
- new valid event → new immutable ledger value.

The in-memory value is a deterministic test/reference model, not production
persistence.

## Sidecar port

`PersistenceSidecarPort` defines:

- checkpoint read;
- compare-and-swap checkpoint write;
- append accepted event with idempotency.

It implements no storage.

`TutorRecoverySidecarPort` separately defines capture and restoration of
Tutor-owned recovery state without returning the snapshot to the bridge.

## Outbox and downstream ports

`buildOutboxEvents` creates one versioned, idempotent proposal for each:

- review queue;
- calendar placement;
- parent-control enforcement.

Every event has a learner-local date, household IANA zone, stable event ID,
event version, retry policy, quarantine behavior, adult-review flags, and
optional parent override provenance.

The related ports return proposed/blocked/quarantined status only. They do not
write a database, place a calendar event, or enforce a parent control.
