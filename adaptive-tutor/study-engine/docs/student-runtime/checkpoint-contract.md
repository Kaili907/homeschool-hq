# Student Runtime recovery checkpoint

The checkpoint is a versioned, device-local sidecar aligned to the Session
6-R2 recovery boundary. It contains only:

- session, lesson, segment, and canonical task identity;
- ordered completed segment IDs and safe instructional cursor;
- per-segment active time, paused time, and break time;
- protected draft reference and draft revision;
- last accepted event ID and event version;
- opaque Tutor-state recovery reference;
- technical-interruption state;
- validated household IANA time zone;
- monotonic checkpoint revision and integrity digest.

Restore verifies the digest, supported version, session/lesson/task bindings,
monotonic revision, event binding, and segment ordering before mutation. Stale
or cross-session checkpoints are rejected. The last accepted event ID and
ledger state prevent duplicate replay.

Raw answers, raw learner responses, raw transcripts, names, emails, diagnosis
language, credentials, and adult-private notes are forbidden. Draft content is
kept behind the protected opaque draft reference and is never copied into the
checkpoint.
