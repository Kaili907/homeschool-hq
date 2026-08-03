# Unified event dictionary

| Event or record | Producer | Consumer | Durable payload rule |
|---|---|---|---|
| Tutor interaction | Frozen Tutor Core | Session 6 bridge | Validated Core contract only |
| Pre-Core safety classification | Session 6 bridge | Tutor callback gate | No raw disclosure persisted |
| One-time processing permit | Session 6 bridge | Authority adapter | Opaque, context-bound, single-use, expiring |
| Accepted Tutor event | Session 6 bridge | Mandatory event ledger | Unique on `(sessionId,eventId)` with content digest |
| Study projection | Session 6 bridge | Study Engine / student runtime | Minimized IDs, outcomes, confidence; no raw answer/transcript |
| Study recommendation | Session 2 | Student/review runtime | Pacing/review only; never mastery authority |
| Outbox proposal | Session 6/8 | Durable host outbox | Proposal is not a delivery claim |
| Recovery checkpoint v1 | Student runtime | Resume validator | Exact cursor/revision/session and protected references |
| Review attempt/result | Session 8 | Review queue | Canonical, ledgered, idempotent |
| Calendar placement/continuation | Session 8 | Learner calendar | Learner-local date plus explicit household IANA timezone |
| Parent decision evidence | Session 8 | Parent dashboard/audit | Authorization, constraints, winner, reason, history |
| Romeo assignment sidecar | Session 8 | Manual host adapter | Metadata only; no credentials/login/scraping/sync |

Unknown event names, unsupported versions, malformed enums, forged directives, and event-ID collisions quarantine. Identical accepted-event replay is ignored before projection and outbox creation.
