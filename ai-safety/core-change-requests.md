# Session 3 shared-core change requests

Status: documentation-only requests  
Created: 2026-07-28  
Authority: none; this file does not approve changes outside Session 3 ownership

The existing shared tutor and identity infrastructure does not expose all
contracts needed to integrate the AI Safety Center safely. Session 3 did not
modify `src/**`, `supabase/**`, or `adaptive-tutor/**`.

These requests extend or specialize earlier adaptive-study requests, especially:

- `adaptive-tutor/study-engine/docs/contracts/core-change-requests.md`
  CR-04, CR-05, and CR-07;
- `adaptive-tutor/study-engine/reconciliation/core-change-requests.v1.json`
  CCR-001 through CCR-004 and CCR-009;
- `adaptive-tutor/study-engine/docs/integrations/core-change-requests.md`
  CR-INT-003, CR-INT-004, CR-INT-007, and CR-INT-008.

## S3-CCR-01 — Production actor, household, and student authorization

**Priority:** blocker before production history reads or control writes  
**Requested owners:** identity/authentication, household/profile, parent hub

**Gap**

The main app has local parent/student PIN screen gates and Supabase household
RLS, but no reusable authenticated-principal or authorization contract.
`activeProfileId`, a role string, a profile object, and an opaque reference are
not authorization. Remote profile JSON also lacks a validated invariant tying
the row key to `Profile.id`.

**Requested interface**

```ts
type AcademyRole =
  | 'student'
  | 'parent'
  | 'teacher'
  | 'human-reviewer'
  | 'system'

interface AuthenticatedAcademyActor {
  actorId: string
  householdId: string
  role: AcademyRole
  authenticatedAt: string
  authenticationMethod: 'household-account' | 'local-student-unlock' | 'service'
}

type SafetyCenterAction =
  | 'history.read'
  | 'safety-event.read'
  | 'permission.read'
  | 'permission.write'
  | 'student-report.create'
  | 'student-block.write'
  | 'review.request'
  | 'review.resolve'
  | 'export.request'
  | 'deletion.request'

interface StudentScopedResource {
  householdId: string
  studentId: string
}

type AuthorizationDecision =
  | { allowed: true; actor: AuthenticatedAcademyActor; studentId: string }
  | {
      allowed: false
      reason:
        | 'unauthenticated'
        | 'wrong-household'
        | 'student-scope-mismatch'
        | 'role-not-permitted'
        | 'capability-missing'
    }

authorizeSafetyCenter(
  actor: AuthenticatedAcademyActor,
  action: SafetyCenterAction,
  resource: StudentScopedResource,
): AuthorizationDecision
```

The local four-digit PIN may remain a family-device convenience, but production
interfaces must distinguish it from an authenticated household account and
must not represent it as strong identity assurance.

**Acceptance criteria**

- A student can read/report/block only their own student ID.
- A parent can access only students linked to the authenticated household.
- Teacher and human-reviewer access is explicit and narrower than parent
  access; a role label alone grants nothing.
- Parent-only data is never widened to teacher/tutor/reviewer visibility.
- Every safety-center query and command requires an authorization decision.
- `profileMapKey`, remote `profile_id`, and `Profile.id` must match before data
  is accepted.
- Remote `Profile` data is runtime-validated before merge or projection.
- Missing identity context returns a denied/safe-empty result, never a default
  profile.
- Cross-student and cross-household negative tests run at both query and command
  boundaries.
- Authorization failures use fixed messages and do not reveal whether another
  student’s record exists.

**Temporary Session 3 behavior**

Use Session 3’s own explicit actor/household/student test context for fixtures
and prototype access. Do not wire it to production PIN state or Supabase.

## S3-CCR-02 — Verified Tutor Core conversation, safety, and spoken-turn bridge

**Priority:** blocker before production tutor enforcement  
**Requested owner:** Tutor Core

**Gap**

The expected Manuel Academy Adaptive Tutor Core v0.2 artifact is absent. The
adaptive reconciliation record explicitly blocks claims about its safety,
spoken-turn, transcript, and adult-review contracts. The current main tutor has
unversioned `TutorChat`/`TutorMessage` values; voice input is a callback; the
adaptive UI accepts `ReactNode`.

**Requested interface**

The actual interface must be derived from the verified Tutor Core package, not
invented from this sketch. At minimum it needs equivalent versioned,
runtime-validated concepts:

```ts
interface TutorConversationDescriptor {
  schemaVersion: string
  conversationId: string
  studentId: string
  sessionId?: string
  subjectId?: string
  startedAt: string
  endedAt?: string
  channel: 'question-tutor' | 'study-tutor' | 'hs-assistant'
}

interface TutorTurn {
  schemaVersion: string
  turnId: string
  conversationId: string
  studentId: string
  occurredAt: string
  actor: 'student' | 'tutor' | 'system'
  modality: 'text' | 'speech-transcript'
  text: string
  source: 'student' | 'model' | 'scripted-policy'
  withheldReason?:
    | 'final-answer-protection'
    | 'off-topic'
    | 'permission-denied'
    | 'subject-disabled'
    | 'outside-allowed-time'
    | 'safety-policy'
  rawAudioStored: false
}

type TutorSafetyDirective =
  | { kind: 'allow' }
  | { kind: 'withhold'; reasonCode: string; studentExplanationKey: string }
  | {
      kind: 'pause-and-escalate'
      classificationCode: string
      severity: string
      escalationLevel: string
      studentExplanationKey: string
      humanReviewRequired: boolean
    }
```

The bridge should expose references/structured outcomes to the adaptive Study
Engine while keeping authorized transcript bodies in a dedicated conversation
repository.

**Acceptance criteria**

- The actual Tutor Core archive/package hash, manifest, version, exports, and
  supported runtime schemas are recorded.
- Unsupported versions and enum values quarantine without coercion.
- Conversation, turn, student, session, and subject IDs are bound and
  cross-checked.
- Spoken text and visible captions are equivalent; audio-unavailable falls back
  to text.
- Raw microphone audio is neither required nor returned.
- Safety directives veto ordinary pacing, model calls, and tutor actions.
- Every withheld response has a machine reason and an age-appropriate
  explanation key.
- Emergency-language behavior does not diagnose, promise response, name a
  hotline, or claim emergency-service capability.
- Transcript bodies never enter low-detail study events, learning evidence,
  logs, or analytics.
- The bridge covers false-positive review and parent/human-review references.
- Node and browser consumers pass isolated compatibility probes.

**Temporary Session 3 behavior**

Keep the policy engine and UI integration-ready with seed fixtures. Do not
import the temporary Session 6 demo bridge as Tutor Core and do not claim the
main tutor is now governed by Session 3.

## S3-CCR-03 — Stable subject and source mapping

**Priority:** required before production subject filters or subject controls  
**Requested owners:** curriculum/catalog, tutor, adaptive-study contracts

**Gap**

Main `TutorChat` records a legacy math `SkillId`, not `SubjectId`. HS assistant
sessions have no subject. Adaptive sessions use branded subject IDs. Parsing
skill names or defaulting an unknown assistant session to math would create
incorrect filtering and permissions.

**Requested interface**

```ts
interface TutorSourceMapping {
  sourceSystem: 'legacy-question-tutor' | 'adaptive-study-tutor' | 'hs-assistant'
  sourceSkillId?: string
  subjectId: string
  mappingVersion: string
  mappingAuthority: 'curriculum-catalog'
}

resolveTutorSubject(source: unknown): TutorSourceMapping | {
  subjectId: 'subject:unknown'
  reason: 'missing-mapping' | 'unsupported-source'
}
```

**Acceptance criteria**

- Legacy IDs are preserved byte-for-byte.
- Every mapping is catalog-backed and versioned.
- Unknown source/skill values remain unknown; they are never guessed.
- Parent subject permissions are applied only after successful student and
  source binding.
- Filters can include an explicit “General assistant” or “Unknown subject”
  category without leaking hidden data.
- Historical mapping changes do not silently rewrite old audit records.

## S3-CCR-04 — Authorized conversation and safety-ledger repository

**Priority:** blocker before production persistence  
**Requested owners:** tutor persistence, privacy/security, parent hub

**Gap**

Tutor history currently lives inside a whole `Profile`; adaptive study events
have a different repository proposal; safety events need independent retention
and audit semantics. Opportunistic array pruning is not an authorized,
concurrent, auditable repository.

**Requested interface**

```ts
interface TutorHistoryRepository {
  listConversations(
    scope: AuthorizedStudentScope,
    query: ConversationQuery,
  ): Promise<ConversationPage>
  readConversation(
    scope: AuthorizedStudentScope,
    conversationId: string,
  ): Promise<TutorConversation | null>
  appendTurn(
    scope: AuthorizedStudentScope,
    turn: TutorTurn,
    idempotencyKey: string,
  ): Promise<AppendReceipt>
}

interface SafetyEventRepository {
  append(
    scope: AuthorizedStudentScope,
    event: SafetyEvent,
    expectedRevision: number | null,
    idempotencyKey: string,
  ): Promise<AppendReceipt>
  query(
    scope: AuthorizedStudentScope,
    filter: SafetyEventFilter,
  ): Promise<SafetyEventPage>
}
```

**Acceptance criteria**

- Conversation history and safety events are different aggregates and query
  surfaces.
- Every key includes household and student scope.
- Same idempotency key/same payload is a no-op; same key/different payload is
  rejected/quarantined.
- Append/CAS prevents stale profile overwrite.
- Safety audit entries are append-only; corrections use a new disposition event
  rather than rewriting detection history.
- Raw transcript bodies are absent from safety audit, notification, telemetry,
  and diagnostic logs; bounded excerpts require explicit policy.
- Missing or corrupt history produces a safe unavailable state, not another
  student’s history.
- Parent search/date/subject queries are server/repository scoped before
  projection, not client-side filtering of all children’s data.

**Temporary Session 3 behavior**

Use the in-memory/fixture repository inside Session 3 ownership only. Do not
insert new fields into `Profile` or adaptive Study Engine aggregates.

## S3-CCR-05 — Retention, export, and deletion orchestration

**Priority:** blocker before claiming production retention or deletion  
**Requested owners:** privacy/data governance, local storage, sync/cloud,
adaptive runtime, tutor voice

**Gap**

Relevant content currently spans AppState localStorage, Supabase profile JSON,
downloaded exports, migration snapshots, a separate mindset journal,
IndexedDB TTS blobs, and adaptive resume/quarantine namespaces. The existing
60-day tutor prune runs only on later writes. No shared request can enumerate
or verify deletion across these stores.

**Requested interface**

```ts
type GovernedDataClass =
  | 'instructional-conversation'
  | 'safety-event'
  | 'safety-audit'
  | 'adult-private'
  | 'student-reflection'
  | 'tts-cache'
  | 'resume-state'
  | 'quarantine-record'

interface DataSubjectRequest {
  requestId: string
  householdId: string
  studentId: string
  requestedByActorId: string
  kind: 'export' | 'delete'
  dataClasses: readonly GovernedDataClass[]
  requestedAt: string
}

interface StoreOperationReceipt {
  storeId: string
  status: 'completed' | 'not-found' | 'pending' | 'failed' | 'outside-control'
  completedAt?: string
  reasonCode?: string
}

interface DataSubjectRequestResult {
  requestId: string
  status: 'pending' | 'partially-completed' | 'completed' | 'failed'
  receipts: readonly StoreOperationReceipt[]
}
```

**Acceptance criteria**

- Retention is enforced by scheduled/query-time sweeps, not only future writes.
- Instructional conversations, safety events, safety audit, and adult-private
  data have separate configurable policies.
- Deletion is student-scoped and authorization-checked.
- Cloud and controlled local copies return independent receipts.
- Downloaded/user-managed backups are reported as `outside-control`; the
  product does not claim to delete them.
- Migration snapshots are inventoried explicitly.
- Adaptive resume and quarantine storage keys include student scope before
  per-student deletion is offered.
- Unattributed TTS blobs either force whole-cache clear or are redesigned with
  provenance; the UI explains which occurred.
- A safety audit that must retain a disposition uses a minimized tombstone or
  policy-approved record rather than silently retaining transcript text.
- Export produces only the requested student and data classes and never another
  child.
- Retry/failure states are honest; a request contract is not described as a
  completed deletion.

**Student reflection condition**

The current mindset journal is intentionally outside parent review and tutor
safety processing. Keep it excluded by default. Any future safety exception for
reflection text requires a separate shared product/privacy decision and revised
student disclosure before collection.

## S3-CCR-06 — Parent notification and human safety review delivery

**Priority:** required before claiming that a parent or reviewer was notified  
**Requested owners:** parent hub, notification delivery, safeguarding/human
review operations

**Gap**

Existing `NeedsDadFlag` and `AdultReviewRequest` record a local need for adult
support. They do not define notification channels/delivery receipts or a human
safety queue. The provisional instructional `ReviewItem` is not suitable.

**Requested interface**

```ts
interface ParentSafetyNotificationCommand {
  notificationId: string
  householdId: string
  studentId: string
  safetyEventId: string
  urgency: 'routine' | 'prompt' | 'immediate-in-app'
  contentTemplateKey: string
  createdAt: string
}

interface NotificationDeliveryReceipt {
  notificationId: string
  state: 'queued' | 'delivered' | 'failed' | 'suppressed'
  channel?: 'in-app' | 'email'
  recordedAt: string
  reasonCode?: string
}

interface HumanSafetyReviewItem {
  reviewId: string
  householdId: string
  studentId: string
  safetyEventId: string
  state: 'open' | 'assigned' | 'resolved' | 'dismissed'
  priority: string
  requestedBy: 'student' | 'parent' | 'policy'
  assignedReviewerId?: string
  disposition?: 'confirmed' | 'false-positive' | 'insufficient-context'
  createdAt: string
  resolvedAt?: string
}
```

**Acceptance criteria**

- Creation, queueing, and delivery are distinct states.
- UI says “notification queued” or “could not notify” unless a delivery receipt
  proves delivery.
- No raw transcript is placed in notification bodies or ordinary logs.
- Human reviewers receive only the minimum authorized context.
- Reviewer access is student/household/event scoped and audited.
- Student and parent false-positive requests cannot erase the original event;
  resolution appends a disposition.
- A student block takes effect locally even when notification/review delivery
  is unavailable.
- Emergency-language escalation is not dependent on email or network success.
- No SLA, emergency response, hotline, medical, or legal claim is implied by
  the contract.

**Temporary Session 3 behavior**

Model commands and receipts as fixtures/in-memory states. Label them as
prototype delivery states; do not send external messages.

## S3-CCR-07 — Voice/transcript media governance

**Priority:** required before production voice safety-center integration  
**Requested owners:** tutor voice, privacy/security

**Gap**

The application does not store microphone audio, which should be preserved.
However, dynamic tutor text can be synthesized by ElevenLabs and the resulting
MP3 stored in a shared unscoped IndexedDB cache. A student-specific retention
or deletion request cannot identify those blobs.

**Requested interface/policy**

```ts
interface SpokenTurnPolicy {
  rawMicrophoneRecording: 'prohibited'
  speechTranscriptStorage: 'conversation-policy'
  dynamicSafetySensitiveTtsCache: 'prohibited' | 'student-scoped'
}

interface TtsCacheDescriptor {
  cacheKey: string
  contentClass: 'static-instruction' | 'dynamic-tutor'
  studentId?: string
  conversationId?: string
  createdAt: string
  expiresAt?: string
}
```

**Acceptance criteria**

- No application code creates or persists a raw microphone recording.
- Students review recognized text before send where the modality supports it.
- Static non-sensitive lines may be cached independently.
- Dynamic tutor/safety text is either not persisted or is student-scoped,
  encrypted/authorized as appropriate, age-limited, and deletable.
- Provider disclosure covers sending text for speech synthesis.
- Development logging never prints transcript or utterance excerpts.
- Clearing/deleting media returns an honest receipt.
- Captions remain available when audio is unavailable or disabled.

## S3-CCR-08 — Student-facing data-use and safety-exception notice

**Priority:** required before production launch  
**Requested owners:** tutor UX, mindset UX, parent hub, privacy/product

**Gap**

Existing tutor specifications require parent-visible transcripts. Existing
mindset UI makes an absolute statement that Dad never sees journal text.
Those are different data classes, but no shared notice contract describes the
difference or a potential safety exception.

**Requested interface**

```ts
interface StudentDataUseNotice {
  noticeVersion: string
  surface: 'question-tutor' | 'study-tutor' | 'hs-assistant' | 'mindset-journal'
  parentCanReview: 'conversation' | 'completion-only' | 'none'
  safetyExceptionApplies: boolean
  safetyExceptionExplanationKey?: string
  rawAudioStored: false
  retentionSummaryKey: string
}
```

**Acceptance criteria**

- Tutor/assistant students are told clearly that linked parents can review
  conversations.
- Students are told that safety-related messages may be escalated.
- The notice does not imply confidentiality that the product cannot preserve.
- Mindset journal remains `completion-only`/no safety exception unless its
  shared owner explicitly redesigns the feature.
- If a safety exception is introduced for any reflection surface, disclosure is
  updated before collection and tests prohibit the old absolute claim on that
  surface.
- Notice versions are auditable without storing acknowledgement behavior as a
  hidden child score.
- Copy is age-appropriate and avoids medical, legal, emergency-service, or
  hotline claims.

## S3-CCR-09 — Safety audit command and actor provenance seam

**Priority:** required before production parent permissions or review actions  
**Requested owners:** parent controls, tutor core, audit/persistence

**Gap**

Canonical `StudySessionEvent.actor` is a role without an actor ID; main parent
controls have no actor; prototype parent events use divergent role vocabularies.
A safety audit must identify the authorized actor for permission changes,
reports, blocks, notification acknowledgement, and review disposition without
embedding private bodies.

**Requested interface**

```ts
interface SafetyAuditCommand {
  commandId: string
  householdId: string
  studentId: string
  actorId: string
  actorRole: AcademyRole
  actionCode: string
  targetRef: string
  occurredAt: string
  expectedRevision: number | null
  idempotencyKey: string
}

interface SafetyAuditEntry {
  entryId: string
  commandId: string
  householdId: string
  studentId: string
  actorId: string
  actorRole: AcademyRole
  actionCode: string
  targetRef: string
  occurredAt: string
  resultCode: string
}
```

**Acceptance criteria**

- Actor identity comes from authorization, never caller-supplied display state.
- Audit entries contain bounded codes/references, not transcript, private-note,
  emergency-language, or notification body text.
- Permission changes record before/after references or versions.
- Same command replay is idempotent; conflicting replay is rejected.
- Parent, student, teacher, reviewer, tutor, and system vocabularies are mapped
  explicitly and exhaustively.
- Student projections never reveal adult-private note existence or reviewer
  internal notes.
- Retention and deletion policy for audit entries is documented separately
  from conversation text.

## Requested review order

1. Identity/household/student authorization and remote profile validation.
2. Verified Tutor Core artifact and bridge inspection.
3. Subject/source mapping and conversation/safety repository governance.
4. Privacy notice, media, retention/export/deletion approval.
5. Parent notification and human-review operational ownership.
6. Production adapters, migration plan, and negative authorization tests.

No production integration should proceed by reconstructing a missing contract
or by treating the Session 3 prototype actor context as authentication.
