# Recovery checkpoint specification

The public checkpoint contract is `study-core-bridge.recovery-checkpoint.v1`, contract version 1.

Required integrity context includes checkpoint ID, revision, timestamps, session/lesson/segment IDs, exact instructional cursor, completed segment IDs, per-segment active time, paused/break time, protected draft/state references, last accepted event ID, Tutor interaction reference, and technical-interruption state.

Resume accepts only an exact session, lesson, segment, cursor, revision, accepted-event, protected-state reference, known segment set, and valid time boundary. Stale, tampered, copied cross-session, unsupported-version, and mismatched checkpoints quarantine. Raw answer and transcript values are never checkpoint fields; the contract carries explicit `false` exclusion flags.

Checkpoint storage in this candidate is local/portable. Production must provide encrypted, authenticated, authorization-scoped persistence and atomic revision control.
