# Session 7 provisional-adapter retirement draft

> Superseded draft. It predates the verified Card 5 integration and the v2
> engine, UI, resume, and temporary Session 6 adapters. Use
> `provisional-adapter-retirement-report.md` for the implemented status.

- Status: draft for the STUDY-STUDENT-RUNTIME integration lab
- Prepared by: Engine Adapter Retirement Agent
- Date: 2026-07-28
- Change scope: this report only; all Session 1, Session 2, Session 3, Tutor Core, parent/calendar, and production files were inspected read-only.

## Package verification and availability

The three supplied packages are present and their SHA-256 hashes match the dispatch values exactly:

| Package | Verified SHA-256 | Result |
| --- | --- | --- |
| `CARD-1-STUDY-CONTRACTS.zip` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | exact match |
| `manuel-academy-session-2-study-engine.zip` | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | exact match |
| `manuel-academy-study-ux-session-3.zip` | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | exact match |

No Tutor Core v0.2 package, Session 6 bridge package, or Card 5 policy package was present in the workspace, incoming/attachment folders, or the supplied package set at inspection time. None is reconstructed from a summary. Session 1's own compatibility report also records that the named `manuel-academy-adaptive-tutor-core-v0.2` package was unavailable when Card 1 was built.

Consequently:

- Card 1 is the canonical contract and validation source for this lab.
- Session 2 algorithms may be reused behind adapters, but their provisional public shapes are not canonical.
- Tutor outcomes used in demonstrations must be marked fixture-only and must cross a narrow, versioned temporary authority adapter.
- The precedence rule in this report is explicitly provisional until Card 5 is received and verified.
- A Session 7-owned `student-runtime.session6-bridge.v1` boundary is required until the real Session 6 bridge is received and verified.

## Retirement decision

Retire the Session 2 provisional aggregate and event assumptions now. Preserve the pure, conservative algorithms behind projections from validated Card 1 records.

The durable boundary is:

1. accept cross-package, storage, and browser values as `unknown`;
2. call `migrateStudyEngineContractToCurrent`;
3. quarantine anything other than a valid current Card 1 payload;
4. select and run the Card 1 runtime schema;
5. project the resulting typed records into the narrow Session 2 algorithm input;
6. translate algorithm output into canonical records/events or a versioned UI intent;
7. validate the resulting canonical record again before local persistence.

An unsupported, missing, invalid, older, or future `schemaVersion` must never be coerced. The migration gate already returns a quarantine disposition for these cases.

## Provisional-to-canonical replacement matrix

| Session 2 provisional assumption | Disposition | Exact Card 1 replacement | Required boundary behavior |
| --- | --- | --- | --- |
| `provisional.study-engine.session-context.v1` | retire | validated `LessonStudyPlan`, `StudySession`, optional `StudentFocusProfile`, `ParentTeacherControls`, and `StudentSkillReview` records, all at `schemaVersion: 1` | The Session 7 adapter selects records by stable ID and revision; it does not create a second session aggregate. |
| `sessionRef` | retire | `StudySession.id: SessionId` | Preserve the string byte-for-byte. Every `StudySessionEvent.sessionId` must equal it. |
| provisional opaque-key regex and 64-character limit | retire | Card 1 `expectId` and branded ID types, with the canonical 128-character wire limit | Do not normalize case, spelling, slashes, or legacy camelCase IDs. |
| `gradeBand: elementary \| middle \| high` | retire | `elementary-3-5 \| middle-6-8 \| high-9-12` | The only mapping is elementary -> elementary-3-5, middle_school/middle -> middle-6-8, and high_school/high -> high-9-12. Never infer grade or placement from age, performance, or answers. |
| `subjectKey` | retire | `LessonStudyPlan.subjectId: SubjectId` | Exact equality is the subject-comparability rule. |
| `taskTypeKey` | retire | selected `LessonSegment.taskType: StudyTaskType` plus `customTaskTypeId` when and only when `taskType === "custom"` | Exact equality of both fields is the task-comparability rule. A task type is a category, not a task-instance ID. |
| an implied task-instance key | replace at the boundary | the selected canonical `SegmentId` is the Card 1 task-instance key | Card 1 defines no separate `TaskId`. Session 7 must not add `taskId` as an unknown canonical property. A temporary bridge `taskRef` must equal the selected `segmentId` until a verified contract introduces a distinct `TaskId`. |
| `timeZone` in the provisional session context | partially retire | the IANA-validated `StudentSkillReview.timeZone` for review calculation | Card 1 does not put a time zone on `StudySession` or `LessonStudyPlan`. The runtime context adapter must therefore carry the validated learner-local IANA zone until an official bridge supplies it. It must never guess from IP, browser locale, or machine zone. |
| `provisional.tutor-core.instruction-outcome.v1` | cannot retire yet | no Card 1 or available Tutor Core package defines this live handoff | Keep a fixture-only, versioned Tutor Core authority adapter. Reject unknown fields, wrong session/segment IDs, unsupported versions, and non-authoritative outcomes. |
| `instructionDirective: correct \| reteach` inside `confidence_check_completed` | retire as a session event | Tutor Core-authored outcome, then canonical `SessionResult.recommendedNextAction` (`continue-plan` or `reteach`) and, when an intervention actually occurs, `tutor-intervention-recorded` | Confidence is never converted into correctness. `correct` has no direct Card 1 event equivalent and must not be stored as a made-up canonical event. |
| `provisional-study-session.v1` and its `phase`, `cycleNumber`, and transition history | retire | the Card 1 `StudySession` status union, append-only `StudySessionEvent[]`, `LessonStudyPlan.segmentSequence`, and `ResumePoint` | One plan-driven reducer owns runtime state. Phase is derived from current segment and canonical event history, not persisted as a second competing state machine. |
| Session 2 local event names such as `check_in_completed` and `review_scheduled` | retire from persisted state | Card 1 `SessionEventType`, canonical segment events, and a separate `StudentSkillReview` aggregate | UI intents may remain versioned, but only canonical event names enter `StudySession.eventLog`. |
| `FocusSessionEvidence.subject: string` | retire | `SubjectId` from the validated plan/evidence records | No normalized-label matching. Stable ID equality replaces Unicode/case normalization. |
| `FocusSessionEvidence.taskType: string` | retire | `StudyTaskType` plus `customTaskTypeId` and `SegmentId` provenance | No free-form task label enters the engine projection. |
| epoch milliseconds in focus evidence | retire at the boundary | RFC 3339 `capturedAt`, `occurredAt`, and session timestamps | Parse validated timestamps only. Sorting remains deterministic, with a stable ID tie-break rather than learner data. |
| local `coreOutcome` | cannot retire yet | a projection of a verified Tutor Core-authored outcome | Never derive it from accuracy, confidence, random-answer indicators, breaks, frustration, or Session 2 classification. |
| local `durationResponse` | cannot retire yet | no Card 1 field is semantically equivalent | Preserve a reason-coded Session 7 runtime observation (`comfortable`, `too_long`, `too_short`, `unknown`) with an evidence ID and no free text. Do not hide it in an unrelated Card 1 rating. |
| local per-block planned/completed duration | partially retire | planned minutes from `LessonSegment.timing`; completed active time from canonical session timing when the block is unambiguous | Card 1 has session-level result durations but no per-segment result duration. A versioned projection must retain segment timing provenance until the official bridge supplies it. |
| local `ParentFocusOverride` | retire as a contract | current, unexpired Card 1 `ParentFocusOverride`, `ParentTeacherControls.maximumWorkDurationMinutes`, and matching `ManualStudyOverride` | Validate actor, target, timestamps, expiry, revision, student reference, and controls reference. A manual work-duration override cannot exceed the control maximum. |
| local break types and `BreakRecord` | retire from persistence | canonical break events, `ApprovedBreak`, `StudentRequestedBreak`, `ApprovedBreakStudySession`, and `ResumePoint` | Specific choices such as water or movement may remain a bounded UI reason code. Persist the canonical reason category and never score a break as failure. |
| local interruption/technical issue enum | retire from persistence | `TechnicalInterruptionStudySession` and `technical-interruption-started/ended` | Never map a technical interruption to a break, pause for effort, or learner failure. |
| local `EvidenceSignals` aggregate as a wire contract | retire | validated `LearningEvidence` plus canonical session/plan context | Project only bounded counts, ratios, ratings, and references. Raw answers, names, emails, transcript, keystrokes, audio, and app history have no projection. |
| local `EvidenceAssessment` as mastery/misconception data | retire for authority decisions | contextual `engagementSupport`, cautious `RandomResponseIndicator`, or an adult-review route | A possible classifier category is advisory and cannot populate `masteryOutcome` or a confirmed `prerequisiteGapOutcome`. |
| local review baseline index and numeric evidence | partially retire | `StudentSkillReview.currentInterval`, `retrievalAttempts`, `intervalAdjustments`, `nextReviewDate`, and Tutor Core-authored triggers | The scheduler still needs a versioned numeric projection and baseline cursor; canonical output must be a valid `ReviewInterval` and learner-local `ISODate`. |
| hand-written provisional guards | retire at ingress/egress | Card 1 runtime schemas and migration registry | Algorithm-internal validation may remain defense in depth, but it is not a substitute for canonical validation. |

## Canonical session and event translation

The ordered lesson plan is the flow authority. Daily goal, check-in, warm-up retrieval, visual teaching, guided practice, independent attempt, reflection, exit ticket, and any reteach step must be explicit, stable `LessonSegment` records in `segmentSequence`. Segment completion remains the only primary progress measure.

Session 2 events translate as follows:

| Retired local event | Canonical effect |
| --- | --- |
| `check_in_completed` | `active-response-recorded`, when a response is required, followed by `segment-completed` for the explicit check-in segment |
| `prior_retrieval_completed` | canonical response/completion events on a `retrieval-practice` segment |
| `visual_teaching_completed` | `segment-completed` on the planned teaching segment, normally `direct-instruction` |
| `guided_practice_completed` | response/completion events on a `guided-practice` segment |
| `independent_attempt_completed` | response/completion events on an `independent-practice` or `mastery-check` segment |
| `confidence_check_completed` | `active-response-recorded` on a reflection/check segment; Tutor Core authority data remains separate |
| `core_instruction_completed` | `tutor-intervention-recorded` only when an intervention occurred, plus canonical completion of the relevant planned segment |
| `review_scheduled` | create/update a validated `StudentSkillReview`; there is no canonical `review-scheduled` session event |
| pacing `break` | `break-requested`, `break-approved`, and `break-started`, with an approved-break state and exact `ResumePoint` |
| pacing `continue` | start the next planned segment; do not increment a parallel local cycle counter |
| pacing `finish` | `session-completed` and a canonical `SessionResult` |
| `break_resume_confirmed` | `break-ended` then `session-resumed`, retaining the same session, segment, resume point, and draft reference |

Save-and-exit is `pause-started` plus `PausedStudySession`, not abandonment. A browser or media failure is a `TechnicalInterruptionStudySession`, not a learner-requested break. A refresh recovery may append `technical-interruption-ended` and `session-resumed` only once; it must not synthesize segment completion.

Every persisted event requires:

- a stable `SessionEventId`;
- the enclosing `SessionId`;
- the next contiguous sequence number;
- a nondecreasing RFC 3339 timestamp;
- a canonical actor and event type;
- the planned `SegmentId` when segment-scoped;
- at most a bounded, non-PII `detailCode`;
- an opaque `EvidenceId` rather than answer content.

Card 1 validation rejects duplicate event IDs inside an aggregate, noncontiguous sequence numbers, wrong session references, unplanned segment references, invalid chronology, and unknown keys. Session 7 must additionally keep an idempotency index across refresh/replay revisions so the same completion or review command is ignored rather than appended twice.

## Versioned Session 7 boundary adapters that must remain

### `student-runtime.canonical-ingress.v1`

This is a durable trust boundary, not temporary compatibility debt. It accepts `unknown`, runs Card 1 version inspection/migration and the selected runtime schema, and returns either a typed value or a fixed, student-safe quarantine reason. It never echoes rejected values.

### `student-runtime.engine-projection.v1`

This adapter is required while the pure Session 2 algorithms consume narrower numeric models than Card 1 records. It:

- selects canonical records by stable ID and revision;
- verifies matching `studentId`, `sessionId`, `studyPlanId`, `lessonId`, `subjectId`, and `segmentId`;
- maps only the canonical grade-band literals;
- projects timing, break, focus, evidence, and review inputs without free text or direct identity;
- records source record IDs/revisions and evidence IDs for deterministic replay;
- validates algorithm output before producing a canonical update;
- never writes mastery, misconception, prerequisite confirmation, or correctness.

### `student-runtime.tutor-core-fixture-bridge.v1`

This is temporary and demonstration-only because Tutor Core v0.2 is unavailable. The allowlist is:

- adapter version;
- literal fixture authority marker;
- `sessionId`;
- `segmentId`;
- RFC 3339 `occurredAt`;
- `directive: correct | reteach`;
- zero or more opaque `basisEvidenceIds`.

It rejects a session/segment mismatch, unsupported version, invalid timestamp, unknown directive, missing fixture authority, or unknown property. It must not accept a name, email, diagnosis, prompt, transcript, raw answer, misconception text, or mastery score. Its output may route the demo but must never be represented as a verified production Tutor Core result.

### `student-runtime.session6-bridge.v1`

This is a clearly versioned Session 7-owned temporary bridge, not a reconstruction or claimed copy of Session 6. It may carry only the data needed to join already validated records:

- canonical learner reference (`StudentId`), `SessionId`, `StudyPlanId`, `LessonId`, `SubjectId`, selected `SegmentId`, and `StudyTaskType`;
- source aggregate revisions;
- validated learner-local IANA time zone;
- current canonical event sequence;
- exact canonical `ResumePoint` and opaque draft reference;
- resolved policy values with provenance (`safety`, `accommodation`, `parent-hard-maximum`, `parent-manual-override`, `engine`, or `grade-default`);
- references to Tutor Core authority evidence, never an invented authority result.

It must have a closed runtime validator. A different version is quarantined. It must not be persisted inside a Card 1 aggregate as unknown properties.

## Tutor Core authority boundary

Tutor Core owns:

- correctness and instructional outcome;
- mastery status and its algorithm/criterion provenance;
- misconception classification;
- confirmed prerequisite-gap status;
- the decision that reteaching or prerequisite remediation is instructionally warranted.

The Session 2 study engine owns only advisory:

- focus-duration recommendation;
- break action and bounded break timing;
- review date/cadence recommendation;
- practice ordering;
- reason-coded supportive messaging.

The student runtime owns:

- canonical event capture and state transitions;
- idempotency, resume integrity, and local draft recovery;
- applying validated safety/accommodation/parent constraints;
- rendering accessibility preferences and safe choices.

The following are forbidden authority shortcuts:

- confidence -> correctness or mastery;
- accuracy alone -> prerequisite gap or engagement concern;
- rapid/random-looking answers -> inattention, diagnosis, or failure;
- repeated breaks -> poor effort, failure, or mastery change;
- technical interruption -> learner behavior;
- Session 2's possible evidence category -> Tutor Core outcome;
- Jarvis text -> an instructional authority decision.

When Tutor Core data is missing, the runtime must return an insufficient-data or fixture-only route. It must not manufacture `successful`, `retrievalFailed`, `prerequisiteGap`, `reteachingOutcome`, mastery, or misconception values.

## Pacing-evidence sufficiency rules

An automatic focus-duration change is permitted only after all of these rules are applied:

1. Use the same canonical `SubjectId`.
2. Use the same canonical `StudyTaskType` and, for `custom`, the same `customTaskTypeId`.
3. Use a planned duration within `max(2 minutes, 20% of current duration)`.
4. Require reliable timing evidence. Exclude technical issues and non-break interruptions.
5. Keep approved breaks eligible and neutral. They are counted for transparency but never converted into an unsuccessful outcome.
6. Use at least five comparable observations. The configured comparison window may be 5-50 but may never lower this minimum.
7. Evaluate the newest comparable observations with a stable deterministic tie-break.
8. Accept academic success only from the Tutor Core authority projection.
9. Require at least `ceil(evaluatedCount * 0.8)` authoritative successes and zero `too_long` responses for an increase. In the normal five-session window this is four of five.
10. Two or more `too_long` responses support a conservative decrease. At least two `too_long` and two `too_short` responses are conflicting and require adult review.
11. Any trusted adult-review flag or manual-review override stops automatic change.
12. An increase is capped at 10% of current duration, may be configured lower, and is also capped by the effective hard ceiling.
13. Preferred increase steps remain bounded: elementary normally 2 minutes with a 1-minute minimum useful step; middle school 3 with a 2-minute minimum; high school 4 with a 3-minute minimum. If the remaining safe budget is below the minimum useful step, maintain.
14. The default automatic decrease budget is at most 10% and never below the configured minimum duration.
15. A hard maximum below the current value can require a decrease even with sparse history because it is a configuration constraint, not a learner inference.
16. A recommendation describes only the next comparable block. It is never displayed or stored as a permanent capacity.

Card 1 lacks a direct duration-comfort response and per-segment completed active duration. Those values must remain in `student-runtime.engine-projection.v1`, with bounded enum values, stable evidence references, and no free-form response content, until an official contract supplies equivalent fields.

For the Session 2 review scheduler, the temporary deterministic projection is:

- retrieval accuracy = `correctCount / attemptedCount` only when `attemptedCount > 0`; otherwise null;
- independence: `independent -> 1`, `minimal-support -> 0.75`, `guided -> 0.5`, `full-support -> 0`;
- confidence rating: `(rating - 1) / 4`, preserving missing as null;
- `retrievalFailed`, `prerequisiteGap`, `reteachingOutcome`, and successful-retrieval count come only from Tutor Core authority, never from those numeric conversions.

This numeric mapping is a Session 7 adapter rule, not a canonical meaning or learner score. It must be replaced if the verified Tutor Core/Session 6 contract supplies its own mapping.

Review output maps to a canonical `ReviewInterval`: use the exact canonical ID for 0, 1, 3, 7, 14, or 30 days and `custom` for another validated day count. `reviewedOn` is derived from the event instant in the validated `StudentSkillReview.timeZone`; `dueOn`/`nextReviewDate` is calculated by local calendar days, never fixed 24-hour elapsed blocks.

## Provisional cap and preference precedence

Card 5 is unavailable, so this order is explicitly provisional:

`Safety limit -> Required accommodation -> Parent hard maximum -> Parent explicit manual override -> Engine recommendation -> Grade-band default`

For work duration, resolve only current, validated, unexpired records:

1. Determine the safety maximum.
2. Apply any required accommodation maximum.
3. Apply `ParentTeacherControls.maximumWorkDurationMinutes`.
4. The effective hard ceiling is the minimum of those present maximums.
5. Select the first available candidate in this order: active parent manual target, evidence-sufficient engine recommendation, established focus target, generic grade-band starting target.
6. Clamp the candidate to the effective hard ceiling.
7. A manual override may reduce or hold, but cannot raise above the parent hard maximum, accommodation maximum, or safety limit.
8. An engine recommendation may never override an accommodation, required break, parent hold/reduction, or hard cap.
9. A grade-band range is fallback planning guidance only and must never be presented as personalized evidence.

For breaks:

- clamp duration to the validated parent break range;
- satisfy a required accommodation break even if an ordinary preference would suppress it;
- a student-requested break remains non-punitive;
- repeated approved requests may add adult review but do not deny the immediate safe break solely because earlier breaks occurred;
- the Session 2 default repeated-review threshold is the third approved break in a rolling 45-minute window unless a verified policy supplies a stricter safe rule;
- a technical interruption is never charged as a break;
- reaching the effective session maximum routes to finish/save safely rather than pressure or blame.

Card 1 enforces that a work-duration manual override cannot exceed the control maximum and that a break override stays inside the configured break range. It does not define the complete cross-record precedence among safety, required accommodation, focus-profile override, and controls override. The Session 7 policy resolver must therefore emit the winning provenance reason and remain marked provisional until Card 5 replaces it.

## Exact replacement steps for the temporary Session 6 bridge

When the real Session 6 bridge becomes available:

1. Obtain the actual package and its dispatch-provided SHA-256. Do not implement from a handoff summary.
2. Verify the hash before reading or executing it. Record its package/version/export inventory in the Session 7 adapter manifest.
3. Inspect the complete bridge types, runtime validators, version/migration policy, event vocabulary, Tutor Core authority seam, ID semantics, time-zone semantics, resume-token semantics, and cap precedence.
4. Build a field-by-field compatibility table against `student-runtime.session6-bridge.v1`. Mark every mapping lossless, intentionally dropped, or incompatible. Unknown or ambiguous fields block automatic replacement.
5. Add an official-bridge ingress adapter inside the Session 7 owned root. Treat input as `unknown`; validate official version first, then validate every resulting Card 1 aggregate.
6. Run both adapters read-only against the same deterministic math, reading, break/resume, refresh, and adversarial fixtures. Compare canonical IDs, event order, segment progress, resume point, draft reference, recommendations, local review date, and reason codes. Do not dual-write events.
7. Preserve existing canonical `SessionId`, `SessionEventId`, event sequence, `EvidenceId`, `ReviewId`, `ResumePoint`, and draft reference during a lossless migration. Never mint replacements for already accepted events.
8. For a saved temporary envelope, use an explicit pure migration from `student-runtime.session6-bridge.v1` to the verified official version. If exact migration is impossible, quarantine it as stale/incompatible and offer student-safe recovery from the last validated canonical session; do not partially merge or forge history.
9. Switch the local composition root to the official adapter only after canonical conformance, deterministic trace, duplicate-event, stale/forged resume, refresh recovery, privacy, accessibility, timer/cap, break neutrality, and production-build tests pass.
10. Search the complete Session 7 owned roots for imports, persisted version strings, fixtures, and documentation references to the temporary bridge. Remove the temporary implementation and fixture-only Tutor bridge only when there are zero live consumers.
11. Update the adapter manifest, event dictionary, state diagram, validation report, integration instructions, and downloadable ZIP. State the official package hash and the exact retired temporary version.

The replacement must touch only Session 7-owned roots. It must not modify Session 1 contracts, Session 2 engine sources, Tutor Core, Session 6, parent/calendar packages, production systems, GitHub, Supabase, database, authentication, identity, storage, or deployment.

## Retirement acceptance gates

The provisional engine surfaces are considered retired only when the integrated lab demonstrates:

- all ingress and egress records pass Card 1 runtime validation;
- unsupported versions are quarantined and never overwritten;
- stable IDs and revisions survive refresh, break/resume, and bridge replacement;
- the same canonical event/review command is idempotent;
- forged histories, unplanned segments, wrong learner/session refs, and stale resume state are rejected;
- segment completion, not elapsed time or answer count, is primary progress;
- approved breaks remain non-failure evidence, with repeated patterns routed neutrally to adult review;
- technical interruptions remain separate from breaks;
- parent/safety/accommodation caps win in the documented provisional order;
- automatic duration changes obey evidence sufficiency and increase/decrease caps;
- review recommendations use the learner-local calendar date;
- Tutor Core alone supplies mastery, misconception, correctness, prerequisite confirmation, and reteach authority;
- output evidence contains no learner name, email, raw answer, transcript, keystroke, audio, or prompt-injection text;
- reason-coded Jarvis messages pass the blame/permanent-capacity/punitive-break language guard;
- deterministic traces produce the same canonical IDs, event order, recommendations, and due dates from the same fixtures.

## Inspected sources

- `engine/adapters/provisional-contracts.ts`
- `engine/orchestrator/types.ts`
- `engine/orchestrator/orchestrator.ts`
- `engine/focus/types.ts`
- `engine/focus/recommend-focus-duration.ts`
- `engine/breaks/types.ts`
- `engine/breaks/break-recommender.ts`
- `engine/evidence/types.ts`
- `engine/evidence/evidence-classifier.ts`
- `engine/review/types.ts`
- `engine/review/review-scheduler.ts`
- `engine/review/calendar-date.ts`
- `docs/engine/provisional-adapter-report.md`
- `docs/engine/algorithm-explanation.md`
- `contracts/common.ts`
- `contracts/study-plan.ts`
- `contracts/study-session.ts`
- `contracts/focus-profile.ts`
- `contracts/learning-evidence.ts`
- `contracts/review-scheduling.ts`
- `contracts/parent-teacher-controls.ts`
- `contracts/versioning.ts`
- `contracts/legacy-adapters.ts`
- `schemas/validation.ts`
- `schemas/registry.ts`
- `schemas/migrations.ts`
- the relevant Card 1 runtime schemas and contract integration documentation
