# Student runtime event dictionary

Vocabulary version: Card 1 `SessionEventType`, canonical schema version `1`.

The runtime persists one event vocabulary only. Session 2 snake-case
orchestration events and Session 3 `StudyUxEvent` values are not persisted.
UI actions are commands; accepted commands produce the canonical events below.
Every event has a stable `SessionEventId`, the owning `SessionId`, a contiguous
sequence, a canonical `SegmentId` when applicable, an actor, and a bounded
reason code. Events never contain names, email addresses, raw responses,
transcripts, prompts, URLs, keystrokes, or audio.

Under Card 5 `DEC-004`, the canonical `SegmentId` is also the task identity.
No parallel local `TaskId` enters events, receipts, evidence, or traces.

| Canonical event | Runtime meaning | Progress effect |
| --- | --- | --- |
| `session-planned` | A validated plan was bound to the pseudonymous learner reference. | None |
| `session-started` | The learner began the canonical session. | None |
| `segment-started` | The current canonical segment became active. | None |
| `active-response-recorded` | A response was accepted at the boundary; only an aggregate evidence reference is emitted. | None |
| `segment-completed` | The expected active segment completed once. | Advances segment progress exactly once |
| `pause-started` | Intentional save-and-exit captured a canonical `ResumePoint`. | None |
| `break-requested` | The learner requested a supported break. | None |
| `break-approved` | Policy approved the break as non-failure. | None |
| `break-started` | Instructional active time paused at the exact segment. | None |
| `break-ended` | The learner ended the approved break. | None |
| `technical-interruption-started` | A refresh/device interruption was recorded separately from a break. | None |
| `technical-interruption-ended` | Verified recovery completed. | None |
| `session-resumed` | The canonical resume position was restored. | None |
| `redirection-recorded` | Reserved Card 1 event; not emitted by this lab. | None |
| `tutor-intervention-recorded` | Reserved for verified Tutor Core integration; not manufactured by this lab. | None |
| `session-completed` | The final result partition and evidence references were saved once. | Terminal only |
| `session-abandoned` | Reserved for explicit abandonment; not used for save, break, cap, or technical recovery. | Terminal only |

## Local commands that are not canonical events

Timer display changes, transcript visibility, captions, read-aloud requests,
speech fallback, reduced motion, large text, missing-media fallback, the daily
goal, engine calculation, and the decision-screen button choice remain
presentation or adapter state. Review scheduling is represented by
`StudentSkillReview`, not a made-up session event.

## Idempotency

- Segment completion key:
  `complete:{sessionId}:{segmentId}`.
- Review key: `review:{sessionId}:{skillId}`.
- Event IDs are deterministic from session, sequence, type, and segment.
- Each accepted command records its key, kind, payload fingerprint, emitted
  canonical event IDs, and occurrence time.
- The same command ID plus the same fingerprint is a no-op with
  `duplicate-event-ignored`.
- The same command ID plus changed canonical content is rejected with
  `idempotency-conflict-rejected`.
- Completion also requires a current v2 temporary-bridge receipt bound to the
  active session, canonical segment/task, draft reference, submission revision,
  occurrence time, and directive.
- Noncontiguous or forged history, stale revisions, cross-session copies,
  mismatched bindings, and unsupported versions are rejected or quarantined.
