# AI Safety Center integration guide

## Package boundaries

- Canonical policy/contracts entry point: `ai-safety/core/index.ts`
- Parent/student React entry point:
  `app/features/ai-safety-center/index.ts`
- Runtime validation: `ai-safety/core/validation.ts`
- Draft 2020-12 schemas: `ai-safety/schemas/*.schema.json`

The safety package does not import the current tutor, profile, PIN, Supabase,
or adaptive-study implementations. The host must adapt those systems at a
validated and authorized boundary.

## Required request path

1. Authenticate the actor in the host.
2. Resolve household membership and the exact student relationship.
3. Produce a minimized `SafetyPrincipal`; never accept role, actor, authorized
   student IDs, or permissions from browser form state.
4. Validate incoming safety-center records before persistence or projection.
5. Authorize the requested student and capability before querying.
6. Filter by student before applying text, subject, date, or severity filters.
7. Audit the decision with structured codes and references, not transcript
   bodies.

The temporary core does not carry `householdId`. Production integration is
blocked on `S3-CCR-01` in `core-change-requests.md`; the host must bind
household plus student in authorization and storage/RLS.

## Tutor turn sequence

Before a model call or tutor continuation:

1. Call `evaluateTutorAccess` with the selected student's permissions, subject,
   current local time, session counters, and active student blocks.
2. Call `evaluateSafetyPolicy` with that access decision and the student's
   message. A `pause-and-escalate` result vetoes model calls and ordinary tutor
   actions.
3. For tutor output, perform the host's deterministic answer-leak check and
   pass its result to `evaluateSafetyPolicy`.
4. Persist instructional text only in `InstructionalHistoryRecord`.
5. For a non-allow decision, call `materializePolicyEvent`. The event stores a
   safe summary and opaque evidence references, not a duplicate transcript.
6. Queue required human review and create an in-app notification command.
   `pending` is not `shown`, `shown` is not `acknowledged`, and none of those
   states proves an email or external response.
7. Show the fixed age-band explanation. Do not replace it with model-generated
   medical, legal, hotline, or emergency-service copy.

`createParentNotification` is a data-contract factory, not recipient
authorization. Its `recipientActorId` must come from a server-side lookup of an
authenticated, currently linked parent for the event's student. Never accept
that ID from the browser or infer it from a display name. Notification
recipient binding and delivery receipts remain production integration
requirements.

## Existing tutor adapter

The current `src/types.ts` `TutorChat` shape is not runtime validated and does
not carry a stable subject or safety event. An adapter must:

- cross-check the profile map key, remote profile ID, and `Profile.id`;
- preserve conversation and student IDs byte-for-byte;
- resolve `skillId` through a versioned curriculum subject mapping;
- represent unknown mappings as unknown rather than guessing a subject;
- convert epoch milliseconds to validated RFC 3339 timestamps;
- mark browser speech input as transcript text and
  `rawMicrophoneRecordingStored: false`;
- preserve the original history only inside the authorized conversation
  repository;
- derive withheld reasons from verified policy output, never from free-text
  flag reasons.

Do not directly map the current `NeedsDadFlag` to severity or emergency
escalation. It mixes instructional and safety reasons and lacks event
provenance.

## Adaptive-study adapter

Reuse the adaptive study engine's opaque `StudentId`, `SubjectId`, and
`SessionId` values through byte-preserving adapters. Study events and learning
evidence receive only low-detail safety references. Never put transcript text,
spoken text, parent-private notes, or reviewer notes into those records.

The expected Tutor Core safety/spoken-turn protocol is still missing. Do not
import a prototype `TranscriptEntry`, `ReactNode`, or provisional reconciliation
enum as a production contract. See `S3-CCR-02`.

## UI projection and actions

Pass `AiSafetyCenter` one verified actor, one selected student, and one
student-scoped `SafetyCenterData` projection. The component fails closed if any
projected record has a different student reference.

The browser checks are defense in depth. Every `onAction` request must be
reauthorized, runtime validated, revision checked, persisted, and audited by
the host. The host must not trust the action's student reference or expected
revision merely because the component emitted it.

The included prototype can be launched from the repository root:

```powershell
npx vite app/features/ai-safety-center
```

It uses synthetic fixtures and is not connected to real profiles or delivery
services.

## Retention, export, and deletion

- Apply retention on reads or a scheduled sweep, not only on future writes.
- Keep instructional, safety-event, and audit periods separate.
- Preserve an active block and the event needed by an open review; report that
  hold as partial completion.
- Scope replacement and deletion keys by student plus record ID.
- Student exports omit audit/reviewer actor identifiers.
- The host must return per-store receipts for local profile data, Supabase,
  adaptive resume/quarantine data, and TTS cache state.
- Downloaded backups are outside application control and must be reported
  honestly.

The existing shared voice cache cannot perform per-student deletion because
its rows lack student provenance. Until `S3-CCR-07` is resolved, do not claim a
student-specific media deletion; either avoid caching dynamic safety-sensitive
speech or clear the whole governed cache with an explicit receipt.

## Student disclosure

Tutor conversations are parent-reviewable and safety concerns may be shared
with an authorized adult or reviewer. Raw microphone recordings are not part
of this package.

The separate mindset journal remains outside this safety center: its text is
not collected or reviewed here. A future safety exception for that surface
requires a new shared product/privacy contract and updated disclosure before
collection.
