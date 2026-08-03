# Study UX integration adapter

## Boundary

The prototype owns presentation, device-local drafts, timer display, break
overlays, recovery notices, and idempotency keys. It does **not** decide
mastery, invent a misconception, choose a reteach directive, schedule review,
authenticate a learner, or write to a production store.

The executable boundary is
[`ui/integrationAdapter.ts`](../../ui/integrationAdapter.ts). It exposes a
framework-neutral `StudyUxIntent`, a pure `mapStudyUxIntent` helper, and
`stableCompletionKey(sessionRef, segment)`.

## Event mapping

| UI intent | Provisional study-engine event | Notes |
| --- | --- | --- |
| Check-in submitted | `check_in_completed` | The learner’s private check-in value stays UI-side unless a future contract explicitly permits it. |
| Warm-up completed | `prior_retrieval_completed` | Completion key is `complete:{sessionRef}:warm-up`. |
| Visual lesson completed | `visual_teaching_completed` | Completion represents an active response, not time watched. |
| Practice together completed | `guided_practice_completed` | Replayed clicks reuse the same completion key. |
| Independent attempt completed | `independent_attempt_completed` | The adapter forwards completion, not inferred correctness or mastery. |
| Confidence/effort/frustration submitted | none yet | The authoritative core must return `correct` or `reteach`; the UI cannot manufacture `confidence_check_completed.coreDirective`. |
| Exit ticket completed | none yet | Core-instruction completion and future-review scheduling must be coordinated by the integration owner. |
| End-of-cycle break/continue/finish | `pacing_disposition_recorded` | Maps only after the exit ticket cycle is complete. |
| Return from an engine lifecycle break | `break_resume_confirmed` | Mid-segment comfort breaks are UI-local overlays and do not advance the engine. |
| Technical interruption recovered | none | Record in observability separately; never treat as learner break or completion. |
| Save-and-exit | none | Preserve the exact UI pointer and drafts without advancing instruction. |

## Idempotency

Every learning completion uses one stable key per session and segment:

```text
complete:{sessionRef}:{segmentId}
```

The local reducer rejects a completion when the requested segment is no longer
current and keeps an event ledger keyed by that value. A production adapter
should retain the same key across retries and expect an idempotent
acknowledgment from its transport. A refresh must not mint a new completion
key.

Technical recovery uses a different namespace:

```text
technical:{sessionRef}:{priorRuntimeId}
```

This prevents a refresh from being counted as a break or learning completion.

## Suggested host interface

```ts
interface StudyUxHost {
  send(intent: StudyUxIntent): Promise<{
    accepted: boolean;
    idempotencyKey?: string;
  }>;
  requestCoreDirective(input: {
    sessionRef: string;
    confidence: string;
    effort: string;
    frustration: string;
  }): Promise<"correct" | "reteach">;
}
```

The host should supply only opaque `sessionRef` identifiers. Names, email
addresses, audio recordings, and production credentials are outside this UI
contract.

## Prototype storage

The demo uses `localStorage` under
`manuel-academy.study-ux.prototype.v1`. It is intentionally a local mock:

- no production authentication;
- no database or Supabase call;
- no cross-device sync;
- no audio recording upload;
- no automatic integration with the existing orchestrator.

Replace the persistence function at integration time; do not reinterpret the
prototype JSON as a production schema.
