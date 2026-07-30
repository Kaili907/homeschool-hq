# Persistence and Duplicate-Event Agent Report

## Scope

Changes are confined to the Session 7 student-runtime source, tests, and docs
roots. No canonical contract, Tutor Core, Wave 1 package, production service,
database, identity, storage service, or deployment file was changed.

## Landed wire versions

- Workspace: `student-runtime.workspace.v2`
- Study-UX adapter: `student-runtime.study-ux-adapter.v2`
- Resume envelope: `student-runtime.resume-envelope.v2`
- Temporary Session 6 bridge: `student-runtime.session6-bridge.v2`
- Card 5 duration precedence: `card5.resolve-duration-policy.v1`
- Parent-preference input remains `student-runtime.parent-preferences.v1`

The old `session6Bridge.v1.ts` path is a module-path compatibility re-export
only. Its implementation accepts the v2 discriminant and rejects v1 wire
payloads.

## Persistence and identity changes

- Interactive callers can create an opaque branded `SessionId` with
  `createLocalSessionId()` and inject it into `createRuntimeWorkspace(...)`.
  `demoSessionIdFor(...)` remains deterministic for tests and traces only.
- Learner, adult, subject, lesson, plan, skill, control, focus, accommodation,
  objective, and segment references now come from fixed opaque lookup values.
  Grade, names, dates, titles, and array positions are not encoded in these
  catalog identities.
- The canonical `SegmentId` is the temporary bridge `taskRef`; the parallel
  `taskIdFor`/`taskId` identity was removed.
- A bridge receipt is usable only when its version, session, exact planned
  segment, canonical response-draft reference, request attempt, submission
  revision, time, directive/reason pair, and withheld-authority fields match.
- `feedback: ready` without the referenced strict v2 `continue` receipt is
  invalid history and cannot grant segment completion.
- Completion and review commands store privacy-safe idempotency records. A
  repeated command with the same canonical payload is ignored. Reusing the
  command ID with a different canonical payload fingerprint is rejected.
- Workspace integrity checks duplicate event IDs, contiguous event sequences,
  session binding, monotonic event times, planned segment membership, canonical
  completion prefix order, completion-to-command binding, receipt uniqueness,
  receipt attempt order, feedback-to-receipt binding, and raw-answer omission
  from emitted evidence/review/events.
- Resume v2 preserves the exact local draft and screen/segment position, rejects
  stale revision tokens, prevents same-revision/different-content writes, and
  quarantines invalid integrity/history without returning raw content.
- Active records in the v1 resume namespace are detected on exact load or list,
  moved to the v2 quarantine namespace as `unsupported-version`, and never
  revived. Namespace clear also covers the owned v1 keys.

## Card 5 duration alignment

`ResolvedDurationPolicy` now carries Card 5 status, reason, bounded target,
optional automatic target, hard maximum, break duration, candidate
source/minutes, feasible interval, ordered provenance codes, and
`provisionalUntilCard5: false`.

Resolved policy states require the automatic target and candidate to fit the
feasible interval. Manual-review states require an empty feasible intersection,
no automatic target/candidate, a bounded safety fallback, and
`candidateSource: manual-review`. Session 7 does not silently accept a displayed
engine duration recommendation because it has no canonical Card 5 acceptance
decision.

## Study-UX state guard

`recordLearnerSupportAction(workspace, action, capabilities, at?)` is the
state-machine boundary for learner support actions. It owns break routing,
read-aloud/no-audio text fallback, speech-unavailable fallback, supportive
reason codes, language inspection, transcript append, and resume revision
updates. The UI no longer needs to mutate transcript state directly.

## Temporary bridge replacement

When Tutor Core v0.2 / the verified Session 6 adapter is available:

1. Replace the import of `bridges/session6Bridge.v2.ts` in
   `state/runtimeMachine.ts` with the verified adapter.
2. Preserve the exact canonical request binding: `sessionId`, `taskRef`
   (`SegmentId`), `responseRef`, request ID, submission revision, and occurrence
   time.
3. Map only a verified Tutor Core receipt to the existing boundary receipt
   fields, and update the bridge version allowlist.
4. Keep raw work device-local. Do not place answer text or a reversible
   low-entropy answer digest in the receipt, evidence, event log, or diagnostics.
5. Keep mastery and misconception authority with Tutor Core; remove the
   temporary demo rubric reason codes only after the verified adapter and its
   conformance tests land.
6. Bump workspace/resume/Study-UX adapter discriminants again if the verified
   receipt wire shape changes, and quarantine v2 saves rather than migrating
   them implicitly.

## Deterministic-lab limitation

Canonical event IDs in the pre-existing session builder remain deterministic
from the immutable session reference plus event sequence/type data. Session 7
now binds completion outcomes to stable command records and rejects duplicate
or conflicting command payloads, but it does not claim that the event-ID
factory is a production distributed-ID allocator. Production replacement
should inject opaque command/event IDs from the authoritative write boundary
while preserving deterministic IDs in trace fixtures.

## Validation

Targeted coverage includes:

- caller-supplied immutable session identity;
- exact v2 bridge binding and forged-readiness rejection;
- same-command/different-payload conflict rejection;
- duplicate completion/review protection;
- exact draft persistence through refresh revisions;
- stale token and racing older-save rejection;
- same-revision content conflict;
- tamper and forged-history quarantine;
- legacy v1 namespace quarantine;
- no raw-answer echo in returned errors/summaries;
- centrally guarded no-audio/speech support messages.

