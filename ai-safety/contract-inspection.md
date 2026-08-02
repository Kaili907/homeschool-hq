# Existing tutor, identity, role, and privacy contract inspection

Inspection date: 2026-07-28  
Session: 3 — AI Safety Center  
Status: read-only inspection of shared code; no shared contract was changed

## Scope and ownership

The resolved Session 3 ownership boundary is recorded in
`ai-safety/OWNERSHIP.md`:

- `ai-safety/**`
- `app/features/ai-safety-center/**`
- `tests/ai-safety/**`

This inspection treated `src/**`, `supabase/**`, and
`adaptive-tutor/study-engine/**` as read-only integration dependencies. This
agent wrote only this file and `ai-safety/core-change-requests.md`.

The inspection covered:

- the active question-scoped AI tutor and HS assistant;
- browser speech input, speech output, and audio caching;
- tutor and assistant transcript persistence and parent review;
- profile/student identity, parent/student PIN gates, household cloud identity,
  and role vocabularies;
- adaptive study-session, actor, evidence, review, parent-control, private-note,
  transcript, resume, and safety-language contracts;
- runtime validation and generated JSON Schema coverage;
- exports, cloud sync, local storage, retention, and deletion behavior.

## Executive verdict

There are useful integration foundations, but there is no complete shared
conversation-safety or production authorization contract.

Available and safe to reuse through explicit adapters:

- byte-preserving `StudentId`, `SubjectId`, `SessionId`, evidence, review, and
  other branded identifiers in
  `adaptive-tutor/study-engine/contracts/common.ts`;
- versioned study-session metadata and a low-detail append-oriented event log in
  `adaptive-tutor/study-engine/contracts/study-session.ts`;
- student-safe parent controls, an adult review request, and a separate
  adult-private record in
  `adaptive-tutor/study-engine/contracts/parent-teacher-controls.ts` and
  `parent-teacher-private.ts`;
- strict runtime validators plus Draft 2020-12 JSON Schemas for the seven
  registered adaptive-study aggregates;
- a capability-shaped, student-bound adult-private authorization precedent in
  the in-memory calendar/parent integration lab;
- existing per-profile tutor and assistant histories in `src/types.ts`;
- a push-to-talk implementation that emits text and does not create an
  application-level raw microphone recording.

Missing or unsuitable for direct production reuse:

- an authenticated actor, household membership, student scope, and
  authorization decision contract;
- a versioned tutor conversation, spoken-turn, transcript, withheld-answer,
  safety-event, notification, report/block, or false-positive-review contract;
- a safety severity/escalation model or emergency-language directive;
- a production human-review queue;
- a complete retention/export/deletion repository contract;
- a stable subject mapping for all existing tutor surfaces;
- a production Tutor Core bridge. The adaptive reconciliation artifacts
  explicitly record that “Manuel Academy Adaptive Tutor Core v0.2” was not
  accessible and mark tutoring safety, spoken turns, transcripts, and
  adult-review evidence as blocked.

The AI Safety Center must therefore remain inside its owned boundary, validate
all input as untrusted, require an explicit actor/household/student scope, and
default-deny or show a safe missing-history state when that binding is absent.

## Contract inventory

### 1. Main application identity and role gates

Relevant paths:

- `src/types.ts`
- `src/App.tsx`
- `src/components/PinPad.tsx`
- `src/components/Picker.tsx`
- `src/migration.ts`
- `src/sync/types.ts`
- `src/sync/supabase.ts`
- `src/sync/engine.ts`
- `supabase/schema.sql`

The persisted local identity shape is:

```ts
interface Profile {
  id: string
  name: string
  grade: '3' | '4' | '6' | '10' | '12'
  pin: string
  // learning fields plus optional tutor/assistant histories
}

interface AppState {
  schemaVersion: 2
  profiles: Record<string, Profile>
  activeProfileId: string | null
  parentPin: string
  // other family configuration
}
```

`src/App.tsx` models access as UI screen state. A student chooses a profile and
enters `Profile.pin`; the parent enters `AppState.parentPin`. Successful
comparison changes the screen and, for a student, sets `activeProfileId`.
There is no reusable principal, authenticated role, household membership,
capability, authorization decision, session expiry, attempt throttle, or audit
record. The four-digit PINs are stored as ordinary strings.

This is a local family-device unlock convention, not a production
authorization contract. In particular:

- `Profile.pin` travels with the whole `Profile`, so it is included in the
  standard all-profile JSON export and in cloud profile JSON;
- `parentPin` is in the local all-profile JSON export, although the current
  Supabase sync mirrors only individual `Profile` values;
- a successful parent PIN gate permits the UI to render all profiles;
- there is no actor identity attached to a parent control or transcript read.

Cloud identity is household-level:

```ts
interface SignedInUser {
  id: string
  email: string
}

interface RemoteProfileRow {
  profile_id: string
  data: Profile
  updated_at: string
}
```

`supabase/schema.sql` keys rows by `(household_id, profile_id)` and applies RLS
with `household_id = auth.uid()`. This is a useful cross-household barrier.
It does not create a student role or enforce one-child-only reads inside a
household.

The cloud ingress is not a sufficient safety-center trust boundary:

- `pullProfiles` casts `r.data` to `Profile` after checking only that it is
  truthy;
- no invariant enforces `RemoteProfileRow.profile_id ===
  RemoteProfileRow.data.id`;
- `isAppState` performs only shallow checks and does not validate tutor,
  assistant, identity, or nested history contracts;
- the last-write-wins merge accepts an unvalidated remote profile as a field
  source.

Normal UI flows keep tutor writes on the selected `Profile`, but a safety
center cannot rely on those UI conventions as authorization.

### 2. Main question-scoped tutor and transcript

Relevant paths:

- `src/types.ts`
- `src/tutor/tutorChat.ts`
- `src/tutor/tutorEngine.ts`
- `src/tutor/tutorApi.ts`
- `src/components/tutor/TutorChat.tsx`
- `src/components/tutor/TutorChatsView.tsx`
- `src/components/tutor/TutorAiControls.tsx`
- `src/tutor/tutor2.test.ts`
- `Homeschool-HQ-Tutor-Addendum-v2-1.md`

The persisted transcript contract is:

```ts
interface TutorMessage {
  role: 'kid' | 'tutor'
  text: string
  ts: number
  source?: 'api' | 'scripted'
}

interface TutorChat {
  id: string
  skillId: SkillId
  grade: Grade
  day: string
  startedTs: number
  problem: string
  correctAnswer: string
  herAnswer: string
  messages: TutorMessage[]
  outcome?: 'flagged' | 'closed'
}
```

The chat is deliberately locked to one problem. The API request includes the
grade, exact problem, correct answer, student answer, and conversation
messages, but not the profile name or profile ID. The persisted `TutorChat`
contains those instructional values and all message text.

`TutorAiControls` renders each profile separately after the parent PIN screen
and passes one `Profile` to `TutorChatsView`. That view is read-only and shows:

- exact problem, student answer, and correct answer;
- every student and tutor message;
- `flagged` or `closed` outcome when present;
- date and usage counters.

It has no text search, subject filter, date-range filter, source event links, or
separate safety-event projection.

`tutorChat.ts` says chats and call timestamps are retained for 60 days, but
pruning happens only when `recordCall` or `saveChat` is invoked. `recentChats`
does not filter by age. An inactive profile can therefore retain and export
older content indefinitely until another tutor write occurs. The same
opportunistic behavior exists for HS assistant sessions.

`src/tutor/tutor2.test.ts` intentionally proves that tutor history is included
in the all-profile export while the provider key is excluded. A safety-center
retention setting must not claim it has deleted exported downloads, migration
snapshots, or cloud copies without a repository-level receipt.

There is no runtime validator or JSON Schema for `TutorMessage`, `TutorChat`,
`TutorQuestionContext`, the Anthropic response, or their parent projection.

### 3. HS assistant transcript

Relevant paths:

- `src/types.ts`
- `src/assistant/assistantState.ts`
- `src/assistant/engine.ts`
- `src/components/assistant/AssistantOrb.tsx`
- `src/components/assistant/AssistantGrownUps.tsx`

The HS assistant has a separate history:

```ts
interface AssistantMessage {
  role: 'girl' | 'assistant'
  text: string
  ts: number
  source?: 'api' | 'scripted'
  action?: AssistantActionRecord
  flagged?: boolean
}

interface AssistantSession {
  id: string
  day: string
  startedTs: number
  messages: AssistantMessage[]
}

interface AssistantState {
  calls: number[]
  sessions: AssistantSession[]
  dailyCap?: number
  name?: string
  persona?: string
}
```

The assistant safety pre-screen reuses the tutor’s `isConcerning` boolean and
scripted parent-flag line. A flagged assistant message carries only
`flagged?: true`; there is no safety event ID, classification, severity,
withheld reason, disposition, reviewer, or notification state.

The assistant has no subject field. It cannot participate in subject filtering
without a reviewed mapping or an explicit `subject: 'general-assistant'`
adapter value.

### 4. Existing tutor safety behavior

Relevant paths:

- `src/tutor/tutorEngine.ts`
- `src/components/tutor/TutorChat.tsx`
- `src/tutor/tutorState.ts`
- `src/assistant/engine.ts`
- `src/tutor/tutor2.test.ts`

Deterministic protections already present:

- the system prompt says never to state the final answer, limits a response to
  three sentences, and asks the model to stay on the problem;
- `sanitizeReply` replaces a detected final-answer leak with a local safe hint;
- `isConcerning` checks a fixed local phrase list before an API call;
- concerning text receives a fixed scripted line and raises a parent flag;
- the sixth student turn closes and flags the question;
- daily per-profile call caps are enforced before API calls;
- no key, offline, or provider error falls back to a fixed “napping” line;
- repeated walkthroughs create `NeedsDadFlag` and gate the skill until the
  parent clears it.

Existing safety state is too lossy to be a safety-event ledger:

```ts
interface NeedsDadFlag {
  since: string
  reason: string
  sessionCount: number
  weekCount: number
}
```

The same flag surface mixes instructional struggle, exchange-limit closeout,
and concerning-language escalation. `reason` is free text. A flag has no
conversation/message reference, rule ID, classification, severity, escalation
level, detection confidence, notification record, audit history, or
false-positive lifecycle. If a skill was already flagged, `flagFromTutor`
preserves the earlier reason, so a later safety concern may not become
distinguishable in the flag record.

`isConcerning` is a phrase matcher, not a complete child-safety classifier. It
can miss paraphrases and produce false positives. Its current scripted reply
only says the event is flagged for Dad. It does not define emergency-language
precedence, trusted-adult guidance, a human-review command, or notification
delivery. It must not be described as emergency service, medical, or legal
support.

Answer-leak redaction returns `{ text, redacted }` internally, but the persisted
`TutorMessage` drops `redacted`. The parent cannot tell why an answer was
withheld from the stored history.

### 5. Speech input, spoken output, and audio

Relevant paths:

- `src/components/tutor/PushToTalkMic.tsx`
- `src/tutor/voice.ts`
- `src/types.ts`
- `Homeschool-HQ-Voice-Addendum-v2-5.md`
- `adaptive-tutor/study-engine/ui/JarvisCore.tsx`
- `adaptive-tutor/study-engine/prototype/src/sessionStore.ts`
- `adaptive-tutor/study-engine/integration-labs/student-runtime/src/runtimeTypes.ts`

`PushToTalkMic` wraps browser `SpeechRecognition`. It:

- starts only on pointer/key press and stops on release/end;
- keeps interim/final recognized text in component memory;
- calls `onTranscript(text)` so the student can review/edit text before send;
- does not define, persist, or upload an application-level audio blob.

This satisfies the narrow “do not store unnecessary raw microphone
recordings” requirement in the reviewed application code. The browser’s speech
recognition service behavior remains a platform concern and is not described
by an application contract.

There is no spoken-turn wire contract. The input boundary is only:

```ts
onTranscript: (text: string) => void
```

Spoken output uses:

```ts
interface SpeakRequest {
  text: string
  voiceRef?: string
  rate?: number
}
```

For an ElevenLabs voice, the full text is sent to the TTS provider. Generated
MP3 data is placed in a shared IndexedDB database named
`homeschool-hq-voice`, with rows shaped as
`{ key, blob, size, lastUsed }`. The key hashes voice, rate, and text but has no
student, session, content-class, retention, or deletion provenance. The cache
is size-bounded by LRU (default 200 MB), not age-bounded. Dynamic tutor replies
can be cached, not just static phrases. Per-student deletion cannot identify
those blobs; only clearing the whole cache is currently reliable.

`JarvisCoreProps` accepts `currentUtterance?: ReactNode` and
`transcript?: ReactNode`. These are UI composition props, not serializable or
validatable contracts.

The adaptive prototypes define two similar transcript shapes:

```ts
interface TranscriptEntry {
  id: string
  speaker: 'Jarvis' | 'Learner'
  text: string
  at: string
  reasonCode: string // student-runtime version only
}
```

Those shapes are local prototypes. They lack an enclosing student/session field
on each turn, modality, safety disposition, withheld reason, parent-visibility
classification, and runtime schema.

### 6. Adaptive study contracts

Relevant paths:

- `adaptive-tutor/study-engine/contracts/common.ts`
- `adaptive-tutor/study-engine/contracts/study-session.ts`
- `adaptive-tutor/study-engine/contracts/learning-evidence.ts`
- `adaptive-tutor/study-engine/contracts/review-scheduling.ts`
- `adaptive-tutor/study-engine/contracts/parent-teacher-controls.ts`
- `adaptive-tutor/study-engine/contracts/parent-teacher-private.ts`
- `adaptive-tutor/study-engine/contracts/legacy-adapters.ts`
- `adaptive-tutor/study-engine/schemas/**`

`common.ts` supplies branded opaque IDs, `ContractHeader`, metadata,
`AdultRole`, `SessionActor`, and `ActorReference`:

```ts
type AdultRole = 'parent' | 'teacher'
type SessionActor = 'student' | 'parent' | 'teacher' | 'tutor' | 'system'

interface ActorReference {
  role: SessionActor
  actorId?: string
}

interface ContractHeader<Kind extends string, Id extends string> {
  kind: Kind
  schemaVersion: 1
  id: Id
  revision: number
  createdAt: string
  updatedAt: string
  metadata?: ContractMetadata
}
```

`StudySession` is a discriminated union for planned, active, paused,
approved-break, student-requested-break, technical-interruption, completed, and
abandoned states. Every variant binds `studentId`, `studyPlanId`,
`plannedSegmentIds`, and an event log.

`StudySessionEvent` carries:

- stable event and session IDs;
- contiguous sequence;
- RFC 3339 occurrence time;
- a closed instructional/session event type;
- a role enum;
- optional segment, low-detail code, and evidence reference.

Its comment explicitly forbids raw keystrokes, audio, and app names. It also
has no raw transcript body. That is the correct boundary: safety-center
conversation text must stay in a separately authorized conversation
repository, with only safe references projected to study events.

`LearningEvidence` binds student, session, subject, and skills and can record
bounded tutor-intervention evidence including `adult-escalation`. It is
instructional evidence, not a conversation-safety event.

`ParentTeacherControls` binds a student and provides work/break/timer controls,
manual overrides, recommendation decisions, accommodations, rescheduling,
review requests, approved interruption categories, and an optional
`privateRecordRef`.

Its `AdultReviewRequest` is:

```ts
interface AdultReviewRequest {
  id: ReviewId
  requestedAt: string
  requestedBy: ActorReference
  category:
    | 'reteaching'
    | 'prerequisite-review'
    | 'accommodation-review'
    | 'schedule-review'
    | 'student-support'
  status: 'open' | 'acknowledged' | 'resolved'
  basisEvidenceIds: readonly string[]
}
```

This can provide an adapter target for ordinary adult support. It does not
represent safety severity, assignee/queue, notification delivery, emergency
precedence, false-positive disposition, or a student report/block action.

`ParentTeacherPrivateRecord` keeps adult note bodies in a student-bound,
separately authorized aggregate. This is the canonical pattern to preserve.
Private note bodies must not be copied into safety events, ordinary controls,
student projections, diagnostics, or analytics.

The schema registry covers exactly:

- lesson study plan;
- student focus profile;
- study session;
- learning evidence;
- student skill review;
- parent/teacher controls;
- parent/teacher private record.

The runtime validators reject unknown keys, non-JSON values, malformed IDs and
timestamps, oversized/deep payloads, invalid chronology, and semantic
invariants. Generated Draft 2020-12 Schemas accompany them. No registered
schema covers tutor conversation history or AI safety events.

`legacy-adapters.ts` explicitly allows byte-preserving
`Profile.id -> StudentId` and legacy skill/subject ID branding. It does not
authorize a profile, establish household membership, or derive a subject from
a skill.

### 7. Adaptive parent/review integration prototypes

Relevant paths:

- `adaptive-tutor/study-engine/parent/contracts.ts`
- `adaptive-tutor/study-engine/parent/privacy.ts`
- `adaptive-tutor/study-engine/integrations/review/types.ts`
- `adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime/privacy.ts`
- `adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime/parent-runtime.ts`

These are explicitly provisional or in-memory.

The provisional parent dashboard uses a pseudonymous `studentRef` and says
authentication and real identity stay outside its boundary. Its early
`ParentControlState` embeds private note bodies and repeats them in the action
log. Reconciliation documentation later rejects that pattern in favor of the
separate canonical private-record boundary. The early parent prototype must
not be imported as the safety center’s private-data model.

The review integration’s `ReviewItem` deliberately has no direct student ID or
raw response:

```ts
interface ReviewItem {
  schemaVersion: 'provisional-review-item.v1'
  reviewRef: string
  skillRef: string
  title: string
  source: 'tutor_generated'
  kind: 'review' | 'reteaching' | 'prerequisite_remediation'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  createdDate: string
  scheduledDate: string
  estimatedMinutes: number
  state: 'pending' | 'completed'
  deferrals: readonly ReviewDeferral[]
}
```

It schedules instructional review, not human safety review. Without an
external tenant/student binding, `reviewRef` alone is not an authorization
scope.

The calendar/parent privacy lab provides the closest existing capability
shape:

```ts
interface AdultPrivateAuthorization {
  actor: { role: 'parent' | 'teacher' | 'tutor'; actorId: string }
  studentRef: string
  canReadPrivateNotes: boolean
  canWritePrivateNotes: boolean
}
```

Its functions reject student-reference mismatch, require author/authorized
actor equality for writes, preserve a narrower `parent-only` audience, and
return an empty student projection with no note-existence signal. This is a
valuable design precedent. It is browser-safe, memory-only, and explicitly
does not integrate identity, authentication, persistence, database, network,
or household membership. It cannot itself authorize a safety-center request.

There is role vocabulary drift:

- canonical `AdultRole`: parent or teacher;
- canonical `SessionActor`: student, parent, teacher, tutor, or system;
- calendar private lab `AdultRole`: parent, teacher, or tutor;
- review deferral actor: student, parent, or system;
- main app: no role type, only parent/student screen paths.

An adapter must not silently widen “parent-only” to “authorized adults” or
grant tutor/teacher/reviewer capabilities from an enum label alone.

### 8. Adaptive transcript/resume prototype

Relevant paths:

- `adaptive-tutor/study-engine/integration-labs/student-runtime/src/runtimeTypes.ts`
- `adaptive-tutor/study-engine/integration-labs/student-runtime/src/state/canonicalSession.ts`
- `adaptive-tutor/study-engine/integration-labs/student-runtime/src/persistence/resumeStore.ts`
- `adaptive-tutor/study-engine/integration-labs/student-runtime/src/catalog.ts`

`RuntimeWorkspaceV1` contains raw local responses, reflection selections,
transcript entries, diagnostics, canonical events/evidence/reviews, and
quarantine state. The entire workspace is placed inside a local resume
envelope.

The demo uses a fixed pseudonymous learner reference and deterministic demo
session IDs. `ResumeLocator` and storage keys contain only `subjectId` and
`sessionId`, not `studentId` or `householdId`. `list()` enumerates every resume
key in the namespace. A production copy of this design could collide across
students or expose another student’s summary on a shared device.

The integrity value is an unkeyed SHA-256 digest. It detects accidental or
unsophisticated edits but is not proof of an authorized writer. Quarantined
records retain the complete raw envelope locally. There is a namespace-clear
method, but no age retention, per-student key, authorized deletion receipt, or
export policy.

These are acceptable constraints for the stated single-learner demo, not a
production safety-center repository.

### 9. Adaptive safety-language guard

Relevant paths:

- `adaptive-tutor/study-engine/engine/safety/language.ts`
- `adaptive-tutor/study-engine/schemas/safety-privacy.test.ts`

The adaptive guard rejects learner-blaming attention/focus language,
duration coercion, diagnostic claims, permanent-capacity claims, and punitive
break language. Its tests also prohibit unsupported inferences and private-note
leakage.

This is valuable output-language defense in depth. It is not an input safety
classifier and does not classify self-harm, abuse, violence, sexual content,
privacy disclosures, or emergency language. It has no severity, escalation,
notification, or human-review state.

### 10. Missing Tutor Core

Relevant paths:

- `adaptive-tutor/study-engine/reconciliation/tutor-core-compatibility.v1.json`
- `adaptive-tutor/study-engine/reconciliation/core-change-requests.v1.json`
- `adaptive-tutor/study-engine/docs/reconciliation/tutor-core-compatibility-matrix.md`
- `adaptive-tutor/study-engine/engine/adapters/provisional-contracts.ts`
- `adaptive-tutor/study-engine/integration-labs/student-runtime/src/bridges/session6Bridge.v1.ts`

The reconciliation record has status `blocked` and says the expected Tutor
Core v0.2 artifact was inaccessible. It forbids reconstructing symbols or
enums from handoff summaries.

The matrix specifically marks these boundaries unverified or blocked:

- tutoring safety refusal/escalation/adult review;
- spoken turns and caption equivalence;
- transcript reference-only handling;
- adult-review evidence;
- mastery/misconception/prerequisite authority;
- unsupported-version quarantine.

The local Session 6 bridge is explicitly temporary and not Tutor Core. It
returns only a bounded demo continue/reteach receipt while withholding mastery
and misconception authority. No Session 3 code should claim compatibility with
the missing Tutor Core.

## Storage, visibility, and retention map

| Data | Current location | Parent-visible | Student-visible | Current retention/deletion behavior |
| --- | --- | --- | --- | --- |
| Tutor chats, problem, correct/student answers | `Profile.tutorChats` in AppState localStorage; optional Supabase profile JSON; all-profile export | Yes, all messages for selected profile | Current chat only in the tutor UI | “60 days” is opportunistic on a later call/save; reset progress drops current profile copy |
| HS assistant sessions/actions/flags | `Profile.assistant` in AppState/local/cloud/export | Yes, recent sessions in Grown-Ups | Current assistant session | Same opportunistic 60-day prune |
| Tutor/assistant call timestamps | Profile fields | Aggregate counts | Cap messages | Pruned with the corresponding history on later writes |
| Parent and student PINs | AppState/Profile | Parent can manage/reset student PINs | Entry only | Plain strings; included in all-profile export; student PIN included in cloud Profile |
| Anthropic/ElevenLabs keys | Separate localStorage keys | Masked presence | No | Explicit clear; excluded from AppState export |
| Recognized speech text | Component draft, then TutorMessage if sent | Yes after send | Yes before send | Becomes ordinary transcript text |
| Raw microphone audio | No application contract/store found | No | No | Not stored by reviewed application code |
| Synthesized tutor audio | Shared IndexedDB MP3 cache | Cache size/clear control only | Playback | 200 MB LRU; no age/student/session provenance |
| Mindset reflection text | Separate profile-keyed localStorage journal | Current UI says no; only completion syncs | Own signed-in view and export | Cleared by parent “Reset progress”; no safety scan in current code |
| Adaptive study events/evidence | Versioned aggregates/fixtures; production repository missing | Intended minimized projection | Student-safe projections | Policy/repository remains a core change request |
| Adaptive runtime responses/transcript | Demo resume envelope localStorage | No production parent projection | Demo student runtime | No age retention; namespace or locator clear |
| Adaptive quarantine raw envelope | Demo quarantine localStorage | Summary only | Safe error | Raw payload retained until clear |

Downloaded exports and pre-migration localStorage snapshots are separate copies.
No in-app deletion can truthfully claim to remove a file already downloaded or
a backup outside the controlled store.

## Privacy notice and reflection boundary

`src/mindset/journalStore.ts` intentionally keeps reflection text outside
AppState, cloud sync, the standard parent panel, and the all-profile export.
`MindsetLesson.tsx` tells the student “Dad sees that you finished, never what
you wrote” and “Only you can do this.”

That statement is only compatible with the current architecture because
mindset journal text is not submitted to the tutor or a safety classifier. The
AI Safety Center must not silently scan, copy, excerpt, or expose that journal.
If a future product decision applies a safety exception to mindset
reflections, the shared mindset owner must change the collection, disclosure,
authorization, and deletion design before collection. The student must then be
told clearly what parents or reviewers can see and when a safety exception
applies. Session 3 is not authorized to make that shared change.

Tutor and assistant messages are different: the existing product specification
requires them to be parent-visible. Student-facing safety-center copy should say
that parents can review those tutor conversations and that safety-related
messages may be escalated; it must not describe them as private reflections.

## Safe adapter rules for Session 3

1. Treat every source payload as `unknown` and run Session 3 runtime validation.
2. Require an explicit actor, household, and requested student ID before
   returning history. Missing/mismatched context returns a safe empty/denied
   result, never another profile’s fallback data.
3. Preserve `Profile.id` byte-for-byte when adapting to `StudentId`, but verify
   the enclosing map/remote row key matches it.
4. Do not infer authorization from `activeProfileId`, a role string, a profile
   object, or possession of an opaque reference.
5. Keep instructional history and safety events as separate record types.
6. Keep raw transcript text out of low-detail adaptive `StudySessionEvent`,
   `LearningEvidence`, notification logs, analytics, and audit diagnostics.
7. Do not convert every `NeedsDadFlag` into a safety event. Walkthrough and
   exchange-limit flags are instructional support. Only a source with a
   verifiable safety reason may create a safety classification.
8. Do not infer a subject for the HS assistant. Main question tutor skills are
   math today, but use an explicit adapter mapping rather than parsing a skill
   name.
9. Do not import the prototype `ReactNode` transcript prop or unvalidated
   `TranscriptEntry` as a wire contract.
10. Do not reuse the adaptive instructional `ReviewItem` as a human safety
    review queue item.
11. Do not write to shared Profile, identity, cloud, adaptive tutor, journal,
    or audio-cache storage from this session.
12. An export/deletion request created by the safety center is a request
    contract until a shared repository adapter returns a verified receipt.
13. Emergency-language behavior may pause tutoring, show age-appropriate
    trusted-adult guidance, and create a human-review request. It must not
    diagnose, promise a response, claim emergency-service capability, or name
    an unverified hotline.

## Threat-model summary

| Threat | Existing exposure | Required integration control |
| --- | --- | --- |
| Student A reads Student B history | Shared browser storage contains all profiles; production roles are UI screen state; adaptive resume locator omits student | Actor/household/student authorization on every query plus negative cross-student tests |
| Parent/teacher/tutor role widening | Role enums differ; enum membership is not authorization | Capability-based decisions and audience-preserving projection |
| Profile confusion or malicious cloud row | Remote JSON is cast; profile key and `data.id` need not match | Runtime validation and immutable identity-binding invariant |
| Instructional and safety meaning collapse | `NeedsDadFlag.reason` mixes struggle, exchange cap, and concern | Separate typed safety-event ledger with source references and reason codes |
| Safety false negative/positive | Fixed phrase matcher only | Layered policy result, conservative emergency precedence, student report, and false-positive review |
| Transcript over-retention | 60-day prune runs only on later writes; exports/backups persist | Repository-level retention sweep, source inventory, and deletion receipts |
| Sensitive text in logs/events | Voice dev log includes a text prefix; early prototypes carry free text | Bounded codes/references in logs, notifications, audit, and adaptive events |
| Raw content in TTS cache | Dynamic spoken text can become an unscoped MP3 blob | Disable sensitive dynamic caching or attach authorized provenance and deletion |
| Forged/tampered local history | AppState has shallow validation; resume hash is unkeyed | Strict schemas, append/CAS semantics, authenticated storage where needed |
| Misleading privacy promise | Mindset UI makes an absolute claim; tutor history is parent-visible | Data-class-specific disclosure; no journal safety exception without coordinated redesign |
| Missing history exposes stale/other data | Multiple stores and prototype list APIs | Safe missing-history state; never substitute another student or unverified cache |

## Integration blockers

The blockers requiring shared-owner action are detailed in
`ai-safety/core-change-requests.md`:

- production actor/household/student authorization;
- a verified Tutor Core conversation/safety/spoken-turn bridge;
- subject and source mapping;
- authorized history/audit persistence;
- retention/export/deletion orchestration across controlled stores;
- parent notification and human-review delivery;
- media/cache governance;
- privacy disclosure and safety-exception governance.

Until those exist, the Session 3 package can be a complete validated policy
domain, seed-backed prototype, and integration-ready UI, but it must not claim
to have changed production tutor enforcement, identity authorization, cloud
deletion, notification delivery, or Tutor Core behavior.
