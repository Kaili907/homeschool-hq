# Card 7 canonical integration findings

> Historical pre-integration audit. Card 5 was subsequently found,
> hash-verified, and integrated through `DEC-012`; the final authority and
> adapter status is recorded in `canonical-adapter-manifest.json` and
> `provisional-adapter-retirement-report.md`.

Date inspected: 2026-07-28

Scope: read-only inspection of Cards 1–3 and currently available local files

Owner of this report: `docs/student-runtime/**`

## Integration decision

Card 1 schema version `1` is the only canonical wire authority available to
the student runtime. Card 2 algorithms and Card 3 presentation can be joined
without changing either Wave 1 package, but neither package's provisional
session/event model can remain an authority:

- Persist and replay `LessonStudyPlan`, `StudySession`, `LearningEvidence`,
  `StudentFocusProfile`, and `StudentSkillReview` version `1`.
- Treat UI actions as commands. Translate accepted commands to canonical
  `StudySessionEvent` values and canonical aggregate revisions.
- Derive engine inputs from already validated canonical aggregates. Project
  engine outputs back into canonical aggregates only where Card 1 has an exact
  representation.
- Keep device-only drafts, presentation state, transcript visibility, and
  resume-token integrity in explicitly versioned Card 7 adapters.
- Do not claim a canonical Tutor Core outcome, task ID, resume token, Jarvis
  message, or review-scheduled session event. Card 1 defines none of those.

The canonical session is the authority. Card 2
`provisional-study-session.v1`, Card 2 snake-case orchestration events, Card 3
`StudyUxEvent`, and Card 3 `WORKSPACE_VERSION` cannot independently advance
learning state.

## Verified inputs

All three named archives are present and their SHA-256 values exactly match the
dispatch values:

| Package | SHA-256 | Archive-to-working-tree comparison |
| --- | --- | --- |
| `CARD-1-STUDY-CONTRACTS.zip` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | 70 file entries checked; 0 missing; 0 different |
| Session 2 Study Engine | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | 58 file entries checked; 0 missing; 0 different |
| Session 3 Study UX | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | 64 file entries checked; 0 missing; 0 different |

The comparison hashed every non-directory archive entry directly from the ZIP
stream and its corresponding working-tree file. No archive was reconstructed
or inferred from a summary.

The inspected Card 1 sources are:

- `contracts/common.ts`, `study-plan.ts`, `study-session.ts`,
  `learning-evidence.ts`, `focus-profile.ts`,
  `review-scheduling.ts`, and `parent-teacher-controls.ts`;
- all seven registered runtime schemas and their generated Draft 2020-12 JSON
  Schemas;
- all valid/invalid fixtures and the schema tests;
- the version inspector and migration gate.

## Availability of later packages

### Tutor Core v0.2

No file or archive identified as `manuel-academy-adaptive-tutor-core-v0.2`
was present in the workspace, incoming folder, attachment folder, owned
integration-lab roots, or visible package filenames/content. Consequently:

- no v0.2 field, enum, lifecycle, or validation compatibility is claimed;
- Card 2's
  `provisional.tutor-core.instruction-outcome.v1` is not evidence of the
  missing v0.2 contract;
- no mastery or misconception value may be manufactured to make the demo
  advance.

A Card 7 temporary Tutor bridge must be labelled lab-only and must consume only
predeclared mock outcomes. It must not call itself a Tutor Core v0.2 adapter
until the actual verified package and its fixtures are available.

### Session 6 bridge

No file, archive, manifest entry, or handoff explicitly identified as the
Session 6 student/Tutor bridge was present at inspection time.

An in-progress
`integration-labs/calendar-parent-runtime` package is present at version
`0.8.0`. It contains a narrow `toCanonicalResumePoint()` helper, but its
manifest explicitly excludes Student Study-UX and it is not labelled as the
Session 6 bridge. It therefore must not be imported or treated as the missing
student bridge. Calendar/parent runtime remains outside Card 7.

The same in-progress package contains `CARD-5-REPLACEMENT.md`, whose status
explicitly says Card 5 is unavailable and whose policy is provisional. It is
not a verified Card 5 package. Card 7 must therefore use and label this
temporary precedence:

1. Safety limit
2. Required accommodation
3. Parent hard maximum
4. Parent explicit manual override
5. Engine recommendation
6. Grade-band default

Every resolution should retain the selected value, winning source, and
reason-code trace so a later Card 5 adapter can be compared without changing
callers.

## Canonical version and aggregate authority

`STUDY_ENGINE_SCHEMA_VERSION` is the integer literal `1`. All canonical
aggregates use:

```ts
interface ContractHeader<Kind extends string, Id extends string> {
  kind: Kind
  schemaVersion: 1
  id: Id
  revision: number
  createdAt: ISODateTime
  updatedAt: ISODateTime
  metadata?: ContractMetadata
}
```

The runtime-relevant registry is:

| Canonical type | `kind` / schema ID | Card 7 use |
| --- | --- | --- |
| `LessonStudyPlan` | `lesson-study-plan` | Stable lesson structure, segment order, timing, active-response, break, prerequisite, and mastery-check requirements |
| `StudentFocusProfile` | `student-focus-profile` | Contextual focus range, timer preference, accessibility, accommodations, and adult operational maximum |
| `StudySession` | `study-session` | The one persisted learning-state union and append-only canonical event log |
| `LearningEvidence` | `learning-evidence` | Aggregate, non-raw observations and Tutor-authored outcomes |
| `StudentSkillReview` | `student-skill-review` | Learner-local retrieval history and next review date |
| `ParentTeacherControls` | `parent-teacher-controls` | Canonical mock guardrails and approved student-safe settings |
| `ParentTeacherPrivateRecord` | `parent-teacher-private` | Excluded from the student runtime and every student-facing projection |

## Stable identifier mapping

Card 1 branded IDs are compile-time brands over byte-preserved wire strings.
Runtime IDs must pass the Card 1 ID rule: 1–128 characters, beginning with an
ASCII letter or digit, followed only by ASCII letters, digits, `.`, `_`, `:`,
`/`, or `-`.

| Runtime identity | Exact canonical type | Source/relationship |
| --- | --- | --- |
| Learner reference | `StudentId` | `studentId` on plan, session, focus, evidence, review, and controls; use a pseudonymous opaque value, never a name/email |
| Study plan | `StudyPlanId` | `LessonStudyPlan.id`; referenced by `StudySession.studyPlanId` |
| Lesson | `LessonId` | `LessonStudyPlan.lessonId` |
| Segment | `SegmentId` | `LessonSegment.id`, `segmentSequence`, events, session position, result partitions, and resume point |
| Subject | `SubjectId` | Plan, evidence, focus scope, and skill-review subject |
| Skill | `SkillId` | Plan prerequisites/mastery checks, evidence, and skill review |
| Session | `SessionId` | `StudySession.id`; repeated byte-for-byte by every event and result |
| Event | `SessionEventId` | `StudySessionEvent.id`; also the append idempotency identity |
| Result | `SessionResultId` | Terminal `SessionResult.id` |
| Evidence | `EvidenceId` | `LearningEvidence.id`, event `evidenceRef`, result evidence IDs, and review bases |
| Review | `ReviewId` | `StudentSkillReview.id` |
| Retrieval attempt | `RetrievalAttemptId` | `RetrievalAttempt.id` |
| Interruption | `InterruptionId` | Approved/requested break and technical interruption records |
| Focus/control | `FocusProfileId`, `ControlSetId` | Optional versioned plan references |
| Draft pointer | unbranded validated ID string | `ResumePoint.responseDraftRef`; points to local raw work but never contains it |

Card 1 has no `TaskId` and no distinct `LearnerReferenceId`. For version `1`:

- a planned task instance is identified by its stable `SegmentId`;
- its category is `StudyTaskType`;
- `customTaskTypeId` is only a category discriminator for
  `taskType: 'custom'`, not an instance ID;
- a browser-facing `learnerRef` is a local alias resolved at a trusted boundary
  to one canonical `StudentId`, byte-for-byte.

If Card 7 needs item-level task identity beneath a segment, it must use a
versioned local `RuntimeTaskId` and keep an explicit
`RuntimeTaskId -> SegmentId` mapping. It must not add `taskId` to a Card 1
payload or describe that adapter ID as canonical.

Never derive IDs from mutable titles, learner names, dates, labels, array
positions, answers, or timestamps. A retry must reuse the same ID.

## Canonical flow mapping

Daily-goal copy is presentation content keyed by stable lesson/objective IDs.
Card 1 has no `dailyGoal` field, so the display string must not be inserted as
an unknown plan property.

| Required flow point | Canonical plan representation | Canonical runtime/evidence representation |
| --- | --- | --- |
| Daily goal | `lessonId`, `learningObjectiveIds`, and content keyed by those IDs | Display-only; not a completion unit |
| Check-in | Dedicated `LessonSegment` with `taskType: 'reflection'` | `segment-started`, optional `active-response-recorded`, then `segment-completed`; do not place raw check-in text in an event |
| Warm-up retrieval | Segment with `taskType: 'retrieval-practice'` | Generic segment events plus aggregate evidence if scored |
| Visual teaching | Segment with `taskType: 'direct-instruction'`; visual support named in bounded support strategies | Generic segment events; watching time alone cannot complete it when active response is required |
| Guided practice | Segment with `taskType: 'guided-practice'` | Generic segment events; structured support/hint evidence as applicable |
| Independent attempt | Segment with `taskType: 'independent-practice'` | Generic segment events; independence/accuracy aggregates, never the raw answer |
| Confidence/effort/frustration | Segment with `taskType: 'reflection'` | `LearningEvidence.confidence`, `.effort`, and `.frustration` as `SourcedRating` values 1–5 with `source: 'student-report'` |
| Exit ticket | Segment with `taskType: 'mastery-check'` and explicit skill/objective requirements | Active response and completion event; Tutor Core alone may author `masteryOutcome` or misconception-related routing |
| Engine recommendation | No new session event | Terminal `SessionResult.recommendedNextAction` for exact canonical actions; contextual pacing remains a versioned adapter result until applied to `StudentFocusProfile.adjustmentHistory` |
| Review event | Not a `StudySessionEvent` | Create/update `StudentSkillReview`; retrieval uses a stable `RetrievalAttemptId` and `EvidenceId` |
| Break | `LessonSegment.breakEligibility` plus controls | Requested/approved break state and canonical break events; never segment completion or failure evidence |
| Continue | Command, not a canonical event type | Stay active and start the next remaining `SegmentId`, or create a new canonical session if the plan cycle is complete |
| Save and exit | No local terminal event | `paused` session with final `pause-started` event and exact `ResumePoint` |
| Finish | No pacing-decision event | `completed` session with `SessionResult` and final `session-completed` event |

The canonical Grade 5 plan value is `gradeBand:
'elementary-3-5'`. Card 3's display value `Grades 4–6` crosses canonical bands
and must not cross the boundary.

## One canonical state machine

The authoritative state discriminant is the Card 1 `StudySession.status` union:

`planned | active | paused | approved-break | student-requested-break |
technical-interruption | completed | abandoned`.

Card 7 should enforce this transition table before creating the next immutable
revision:

| From | Accepted cause | Required event tail / next state |
| --- | --- | --- |
| `planned` | Start | append `session-started`; `active` at the first planned segment |
| `active` | Begin/record/complete work | `segment-started`, `active-response-recorded`, `segment-completed`; remain `active` and advance only in `segmentSequence` |
| `active` | Intentional save/pause | append `pause-started`; capture `ResumePoint`; `paused` |
| `active` | Learner asks for a break | append `break-requested`; capture `ResumePoint`; `student-requested-break` |
| `student-requested-break` | Approval and start | append `break-approved`, then `break-started`; `approved-break` |
| `active` | Already-approved scheduled/accessibility/wellbeing break | append the applicable request/approval records and end with `break-started`; `approved-break` |
| `approved-break` | Return | append `break-ended`, then `session-resumed`; restore exact segment/draft; `active` |
| `active` | Device/network/audio/input interruption | append `technical-interruption-started`; capture `ResumePoint`; `technical-interruption` |
| `technical-interruption` | Recovery | append `technical-interruption-ended`, then `session-resumed`; restore exact position; `active` |
| nonterminal | Valid terminal completion | append one `session-completed`; partition all planned segments in `SessionResult`; `completed` |
| nonterminal | Explicit abandonment/unrecoverable technical stop | append one `session-abandoned`; produce abandoned result; `abandoned` |

Canonical validation requires the correct final event for planned, paused,
break, technical, and terminal snapshots. It does not by itself prove every
historical event-to-event transition. Card 7 must replay the event log through
the table above and reject a structurally valid but forged history.

Card 2 `SessionPhase` and Card 3 `screen`, `currentSegment`, and `status` become
derived projections. They must not be independently trusted after refresh.

## Version 1 event dictionary

The only shared persisted event vocabulary is the Card 1
`SessionEventType` union:

```text
session-planned
session-started
segment-started
active-response-recorded
segment-completed
pause-started
break-requested
break-approved
break-started
break-ended
technical-interruption-started
technical-interruption-ended
session-resumed
redirection-recorded
tutor-intervention-recorded
session-completed
session-abandoned
```

Card 2/Card 3 values map as follows:

| Provisional value | Card 1 projection | Retirement rule |
| --- | --- | --- |
| `session_started` | `session-started` | Replace underscore event |
| `check_in_completed` | Generic response/completion events on the stable check-in segment | Do not add a check-in event to Card 1 |
| `prior_retrieval_completed` | `segment-completed` on the retrieval segment | Phase name becomes plan metadata |
| `visual_teaching_completed` | `segment-completed` on the direct-instruction segment | Phase name becomes plan metadata |
| `guided_practice_completed` | `segment-completed` on the guided segment | Phase name becomes plan metadata |
| `independent_attempt_completed` | `segment-completed` on the independent segment | Phase name becomes plan metadata |
| `confidence_check_completed` | Response/completion event with `evidenceRef` | Core directive is not an event field |
| `core_instruction_completed` | Optional `tutor-intervention-recorded` with evidence reference, then ordinary segment progression | Never infer mastery |
| `review_scheduled` | Update `StudentSkillReview` | There is no canonical review-scheduled session event |
| `pacing_disposition_recorded` / `pacing_decision` | Command projected to break, next segment/session, pause, or terminal canonical events | Do not persist the local choice as Card 1 |
| `break_requested` | `break-requested` | Use canonical break state and `InterruptionId` |
| `break_returned` / `break_resume_confirmed` | `break-ended`, then `session-resumed` | Restore the canonical resume point |
| `technical_interruption` | `technical-interruption-started`; recovery emits end/resume | Keep separate from learner breaks |
| `intentional_save_exit` | `pause-started` | Saved work is paused, not abandoned |
| `timer_goal_reached` | Device-local presentation/telemetry only | It cannot complete a segment |
| `segment_completed` | `segment-completed` | Reuse a stable `SessionEventId`; require the currently expected segment |

`StudySessionEvent.detailCode` is a bounded reason code, not free text.
`evidenceRef` points to aggregate evidence. Raw answers, prompt text, names,
email, transcript text, keystrokes, audio, and app names must never enter an
event.

## Parent-preference projection

Card 7 may accept validated mock `StudentFocusProfile` and
`ParentTeacherControls` aggregates without importing the calendar/parent
runtime.

| Required input | Exact Card 1 field | Adapter rule |
| --- | --- | --- |
| Timer mode | `timerVisibility` / `timerPresentationPreference` | Card 7 display `visible -> count-down`, `minimal -> milestones-only`, `hidden -> hidden`; retain a reason trace |
| Maximum duration | `ParentTeacherControls.maximumWorkDurationMinutes` | Hard operational cap, never learner evidence |
| Break range | `breakDuration.minimumMinutes/defaultMinutes/maximumMinutes` | Bound every recommended/selected break |
| Required breaks | No exact top-level field | Versioned policy adapter plus per-segment `breakEligibility`; do not add a Card 1 property |
| Reduced motion | `accessibility.reducedMotion` | Must override decorative motion |
| No audio | `accessibility.narration: 'off'` | Audio unavailability is technical context, not failure |
| Large text | `accessibility.textScalePercent` | Apply the validated percentage |
| Read aloud | `accessibility.narration: 'available' | 'preferred'` | `no audio` wins when both are requested |
| Speech input | `accessibility.inputModes` includes `speech` | Fall back to keyboard/touch when unavailable and record technical context only |
| Captions | `accessibility.captions` | Preserve even when audio is off |
| Parent manual override | `manualOverrides` and, where applicable, `parentOverride` | Validate target-specific fields, expiry, provenance, and cap |
| Accommodation | `accommodations` | Functional and minimally described; never diagnosis text |
| Accommodation maximum | No exact numeric Card 1 field | Temporary versioned policy input associated with a stable `AccommodationId`; do not hide it in free text |

The resolver must apply the provisional six-level order above and then the
more restrictive applicable numeric cap. It must never let an engine increase
exceed a safety, required-accommodation, or parent hard maximum.

## Engine adapter retirement

### Card 2 session context

Replace `ProvisionalSessionContext` as follows:

| Card 2 field | Canonical source |
| --- | --- |
| `sessionRef` | `StudySession.id: SessionId` |
| `gradeBand` | `LessonStudyPlan.gradeBand`; exact map: `elementary-3-5 -> elementary`, `middle-6-8 -> middle_school`, `high-9-12 -> high_school` only inside the engine adapter |
| `subjectKey` | `LessonStudyPlan.subjectId: SubjectId`, byte-preserved |
| `taskTypeKey` | Current `LessonSegment.taskType`, plus `customTaskTypeId` only when canonical task type is `custom` |
| `timeZone` | `StudentSkillReview.timeZone` or a separately validated learner-local mock setting; do not infer it from the browser offset |

The canonical aggregates must be validated first and must agree on
`studentId`, session/plan reference, segment membership, and revision. The
adapter should pass only the narrow values the deterministic engine needs.

### Card 2 focus/evidence/review

- Build `FocusSessionEvidence` only from canonical session durations and
  aggregate evidence with matching stable subject/task context.
- An approved break maps to `approved_break` and remains eligible, non-failure
  evidence. Pause, interruption, and technical time never becomes completed
  active duration.
- Run an automatic pacing recommendation only with the algorithm's required
  comparable evidence. Card 1 `insufficient-data` remains insufficient; do not
  convert grade-band guidance into personalized evidence.
- Card 2 recommendation reason codes remain in a versioned lab result. Apply
  an accepted duration change through a canonical `FocusAdjustment` with
  evidence IDs and cap it through validated settings.
- Convert Card 2 review output to a `StudentSkillReview` only when stable
  learner/subject/skill/review/evidence IDs and an IANA zone are available.
  `dueOn` becomes `nextReviewDate` as a learner-local calendar date. Do not add
  24-hour instants.
- Preserve canonical interval ID/day pairs and evidence-backed interval
  adjustments. Do not invent evidence IDs for an engine reason.

### Card 2 Tutor handoff

`adaptTutorCoreOutcome()` currently accepts the guessed values `correct` and
`reteach`. Card 1 defines structured `masteryOutcome`,
`prerequisiteGapOutcome`, retention, and session next actions, but it does not
define a Tutor Core transport outcome.

Until the verified v0.2 package exists:

- accept only a fixed, versioned, lab-owned mock outcome selected by scenario;
- require matching `SessionId`, `EvidenceId`, timestamp, and declared
  `authority: 'mock-tutor-core'`;
- never derive the directive from confidence, frustration, time, random
  answers, or UI scoring;
- quarantine every other version/shape;
- label the UI result as a lab simulation, not v0.2 output.

### Card 3 UX

- `SessionDefinition` becomes presentation content keyed by canonical
  `LessonId`, `SegmentId`, `SubjectId`, and `SkillId`.
- The six local `LearningSegmentId` strings may be retained only as stable
  segment IDs if the canonical plan includes them exactly. Card 7 also needs a
  stable check-in segment.
- `StudyUxIntent` may remain an internal command union after receiving its own
  explicit adapter version, but `ProvisionalOrchestratorEvent` must be retired.
- `StudyUxEvent` cannot be the shared audit log. Shared semantic events go to
  canonical `eventLog`; timer display and transcript-panel events stay local.
- `answers`, check-in draft, and learner transcript content stay in a local
  draft store keyed by `responseDraftRef`. They never enter canonical events,
  evidence, traces, errors, or recommendation text.
- Card 3 currently resets unsupported/corrupt workspace data to an empty
  workspace. Card 7 must instead quarantine the original value, preserve it
  unchanged, and offer a safe restart without representing data loss as a
  successful migration.

## Required versioned Card 7 adapters

These are local integration seams, not additions to Card 1:

| Adapter | Required responsibility | Removal/replacement gate |
| --- | --- | --- |
| `student-runtime.canonical-ingress.v1` | Run the Card 1 migration gate/schema parser on every external or persisted aggregate | Retain while Card 1 v1 is current |
| `student-runtime.content-plan.v1` | Bind Grade 5 content to stable plan/lesson/segment/subject/skill IDs and exact task types | Replace only with a verified canonical content package |
| `student-runtime.ui-command.v1` | Validate UI commands, expected state, stable IDs, timestamp, and idempotency ID before emitting canonical events | Retain as UI boundary; version on breaking command changes |
| `student-runtime.engine-input.v1` | Project validated canonical session/plan/evidence/settings to Card 2 narrow inputs | Retire only when the engine consumes Card 1 types directly |
| `student-runtime.engine-output.v1` | Project bounded engine recommendations to canonical focus/review/result fields where exact | Retire only when the engine emits validated Card 1 aggregates |
| `student-runtime.tutor-core-mock-bridge.v1` | Fixed scenario outcome only; no inferred mastery/misconception; explicit mock authority | Delete after verified Tutor Core v0.2 schema, fixtures, and parity tests pass |
| `student-runtime.session6-bridge.v1` | Temporary Card 7-owned envelope around only validated canonical IDs/settings/results needed by the lab | Delete after an explicitly identified, verified Session 6 bridge passes parity tests |
| `student-runtime.resume-envelope.v1` | Bind session ID, session revision, last event sequence/ID, resume point, draft ref, and integrity digest | Version whenever any bound field/algorithm changes |
| `student-runtime.preference-policy.v1` | Apply provisional precedence and return value/source/reason trace | Replace after verified Card 5 fixtures pass winner/trace parity |
| `student-runtime.safe-evidence.v1` | Allowlist aggregate evidence/reason codes and reject raw answer/PII/prompt-injection content | Retain at the privacy boundary |
| `student-runtime.jarvis-message.v1` | Map trusted reason codes to static supportive copy; never interpolate learner input | Retain until a canonical safe-message contract exists |

Exact replacement procedure for either missing bridge:

1. Receive the actual package; record its path and dispatch SHA-256.
2. Hash the archive and compare every extracted file to the verified archive.
3. Read its actual schemas, validators, fixtures, version policy, and authority
   rules; do not transcribe a summary into a contract.
4. Add a separate adapter beside the temporary one and run valid, invalid,
   stale, forged, duplicate, privacy, and deterministic-trace parity tests.
5. Compare IDs, state transitions, recommendation authority, and reason traces.
   Any semantic difference is a documented migration, not silent coercion.
6. Switch the import/adapter manifest only after parity passes.
7. Remove temporary code, mock fixtures, UI provisional labels, and its version
   marker together. Retain old saved values in quarantine until an explicit
   lossless migration exists.

## Validation boundaries

### Boundary order

1. Treat browser storage, ZIP fixtures, mock settings, resume envelopes, UI
   commands, and bridge results as `unknown`.
2. Inspect version before selecting a parser.
3. For Card 1 aggregates, call
   `migrateStudyEngineContractToCurrent(value)`.
4. Select the exact schema by trusted route and verify `kind`; do not trust a
   caller-selected kind alone.
5. Validate all same-aggregate invariants.
6. Validate cross-aggregate references: matching `studentId`, matching
   `studyPlanId`, planned segment membership, subject/skill context, revision,
   and evidence ownership.
7. Replay the canonical session event log through the Card 7 state machine.
8. Verify resume integrity/freshness and semantic idempotency.
9. Project to the engine or UI using an explicit allowlist.
10. Validate every newly produced canonical aggregate again before local
    persistence.

### Card 1 boundary guarantees

The runtime validators reject:

- non-JSON-safe values, cycles, accessors, symbol keys, sparse arrays, reserved
  keys (`__proto__`, `prototype`, `constructor`), and non-plain objects;
- payloads over 20,000 visited nodes, depth 24, string length 16,000, array
  length 2,000, object-key count 500, or ID length 128;
- unknown core properties; the only open surface is namespaced
  `metadata.extensions` with keys such as `manuel:trace-id`;
- malformed IDs, RFC 3339 instants, calendar dates, IANA time zones, ordered
  ranges, percentages, chronology, duplicates, dangling references, and
  state/result inconsistencies;
- a session event log that is empty, exceeds 2,000 events, repeats an event ID,
  has non-contiguous sequence numbers, moves timestamps backward, refers to a
  different session, or names an unplanned segment;
- a terminal result whose completed/remaining segment sets do not exactly
  partition planned segments.

Card 1 schema validation alone does not prevent two different event IDs from
both claiming `segment-completed` for the same segment. Card 7 must enforce a
semantic uniqueness key such as:

```text
sessionId + eventType + segmentId
```

for one-time events, while also reusing the same `SessionEventId` on transport
retry. The same rule applies to one terminal event, one result ID, and one
review-recommendation application.

### Resume and refresh boundary

A canonical `ResumePoint` contains:

```ts
{
  segmentId: SegmentId
  elapsedActiveSecondsInSegment: number
  responseDraftRef?: string
}
```

It does not prove freshness or authenticity. The local resume envelope must
bind at least:

- adapter version;
- `SessionId`;
- `StudySession.revision`;
- last canonical event sequence and ID;
- the exact `ResumePoint`;
- completed-segment identity or a digest of the canonical event prefix;
- draft reference and a digest of the locally stored draft;
- issuance time and an integrity digest.

On refresh, first validate the stored canonical session, replay it, and then
verify the envelope. Reject/quarantine when the session ID differs, revision or
event prefix is stale, segment is not the next resumable planned segment,
completed segments regress, draft digest differs, or integrity validation
fails. A stale/forged token must never overwrite the newer canonical state.

Raw entered work remains in a separate local value addressed by
`responseDraftRef`. The event/evidence/trace contains the pointer only.

In a browser-only lab, a digest can demonstrate deterministic tamper detection
against the supplied adversarial cases, but it is not a security boundary
against an attacker who can rewrite both same-origin storage and shipped
client code. Strong authenticity requires a trusted key/service, which is
outside Card 7's authorization. The validation report must state that
limitation rather than imply production-grade token security.

## Unsupported-version behavior

Card 1 classifies input as:

- `current`;
- `missing-version`;
- `invalid-version`;
- `unsupported-older-version`;
- `unsupported-future-version`.

The migration gate additionally returns `unknown-kind` or
`invalid-current-payload`. Version `1` has no predecessor migration. A current
valid payload is returned by reference with `migrated: false`; it is not cloned,
normalized, or rewritten.

For every non-current or invalid disposition, Card 7 must:

1. reject it before state replay or engine invocation;
2. keep the original value unchanged in a quarantine record;
3. emit a fixed, adult-safe diagnostic containing a disposition/reason code,
   never source values;
4. avoid inserting defaults, deleting unknown fields, changing the version, or
   overwriting the last valid state;
5. allow an explicit safe restart as a separate action, not as a claimed
   migration.

The same fail-closed pattern applies independently to local adapter versions.
A string such as `provisional-study-session.v1` is not canonical
`schemaVersion: 1`.

## Privacy, evidence, and authority constraints

- Unknown canonical fields are rejected, but `metadata.extensions`,
  `detailCode`, `scoringMethod`, and other bounded strings still require a
  Card 7 allowlist. Structural validation alone cannot tell whether an opaque
  string is a learner name.
- Use pseudonymous IDs generated independently of names/email. A syntactically
  valid name-like string is still prohibited as a learner reference.
- Never copy raw email, name, answer, check-in text, transcript, prompt text,
  injected instructions, keystrokes, audio, or local app names to canonical
  evidence, events, traces, errors, recommendation messages, or extensions.
- Treat learner-entered text as inert display/draft data. It cannot select a
  tool, event type, next state, reason code, Tutor authority, or Jarvis
  template.
- `RandomResponseIndicator.doesNotEstablishInattention` must remain literal
  `true`. Random-like patterns are cautious aggregate signals, not learner
  labels.
- Low accuracy alone cannot produce an engagement concern or confirmed
  prerequisite gap.
- Tutor Core remains the only authority for mastery and misconception meaning.
  Card 7 and Card 2 may route or display a supplied outcome but cannot derive
  one.
- Approved and repeated breaks remain non-failure events. A reason-coded adult
  review may be recommended without lowering completion/mastery, changing
  learner labels, or treating break time as active work.
- Technical interruption duration is separate from approved break, intentional
  pause, and active work duration.
- A pacing increase requires sufficient comparable evidence and remains capped
  by safety, accommodation, and parent limits.
- Review dates are `YYYY-MM-DD` in `StudentSkillReview.timeZone`; use local
  calendar arithmetic.
- Student progress is completed canonical segment units, not elapsed time.

## Conformance tests implied by these findings

The Card 7 suite should prove:

- all supplied Card 1 valid fixtures pass and invalid mutations fail through
  the Card 7 ingress;
- Grade 5 plans use exact canonical task/grade-band values and stable IDs;
- every accepted UI command produces only the expected canonical event(s);
- canonical event replay rejects forged order, unplanned segments, duplicate
  completion, duplicate terminal/review events, and regressive timestamps;
- stale/forged resume envelopes are quarantined while a valid refresh restores
  exact segment, elapsed active seconds, draft, and completion set;
- unsupported Card 1 and local adapter versions are retained unchanged and
  quarantined;
- approved/repeated breaks never count as failure, while the configured
  threshold may emit a neutral adult-review reason;
- technical interruption never becomes a break or completion;
- raw name/email/answer/transcript/prompt-injection content is absent from
  serialized canonical aggregates, traces, diagnostics, and Jarvis copy;
- all visible/minimal/hidden timer mappings and provisional precedence winners
  are deterministic and capped;
- no-audio, missing-media, captions, transcript availability, reduced motion,
  large text, speech-unavailable fallback, keyboard-only, and mobile flows do
  not change canonical completion semantics;
- review recommendations use learner-local dates and are idempotent;
- engine traces are deterministic for the same validated canonical input.

## Bottom line

Cards 1–3 are compatible through a strict adapter layer, not through direct
reuse of the provisional event/state types. The non-negotiable seam is:

```text
unknown input
  -> version gate
  -> Card 1 runtime schema
  -> cross-aggregate/state/idempotency checks
  -> narrow Card 2 algorithm input
  -> bounded reason-coded output
  -> Card 1 aggregate/event update
  -> student-safe Card 3 projection
```

Tutor Core v0.2 and an explicitly identifiable Session 6 student bridge remain
unavailable. Their temporary Card 7 bridges must be versioned, isolated inside
the owned root, visibly provisional, and removed only by the verified
package-and-parity process above.
