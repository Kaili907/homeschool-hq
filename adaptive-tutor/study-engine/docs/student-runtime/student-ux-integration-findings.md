# CARD 7 Student UX integration findings

> Historical pre-implementation assessment. The final runtime now uses fixed
> opaque IDs, canonical `SegmentId` task identity, v2 resume/bridge adapters,
> and verified Card 5 `DEC-012`. See `canonical-adapter-manifest.json`.

Status: integration specification for the Session 7 browser lab  
Owner: Student UX Integration Agent  
Scope: read-only assessment of Session 1 contracts and Session 3 Study-UX  
Production authority: none; this document does not authorize production storage, identity, authentication, or deployment

## Inspected sources

| Package or source | Result |
| --- | --- |
| `docs/contracts/artifacts/CARD-1-STUDY-CONTRACTS.zip` | SHA-256 verified: `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` |
| `docs/ui/manuel-academy-study-ux-session-3.zip` | SHA-256 verified: `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` |
| `contracts/**`, `schemas/**`, and canonical examples | Inspected read-only |
| `prototype/**`, `ui/**`, `tests/ui/**`, and `docs/ui/**` | Inspected read-only |

No source package was reconstructed from a summary and no Wave 1 file was changed.

## Executive findings

Session 3 already provides a strong learner-facing shell: one task at a time, six-segment progress, three timer presentations, captions, a transcript, no-audio fallback, break screens, reduced-motion controls, mobile reflow, keyboard navigation, local drafts, and refresh recovery. It is suitable as the visual basis for the integration lab, but its current data model cannot be used as the integration authority.

The integration must address these concrete gaps:

1. `SubjectId` is currently the local union `"math" | "reading"`, and the same six `LearningSegmentId` values are reused for both subjects. Canonical `SubjectId`, `LessonId`, `SegmentId`, `SkillId`, `StudyPlanId`, `SessionId`, `SessionEventId`, and `StudentId` values must be supplied by the validated plan/session bootstrap.
2. `${subjectId}-prototype-session` is reused and is not a stable identifier for an individual attempt. Each attempt needs one immutable canonical session ID.
3. `StudyUxEvent` is unversioned and permits a free-form `detail`. It must be replaced at the boundary by one versioned runtime vocabulary, with canonical session events projected into `StudySession.eventLog` and a tightly bounded UI-local projection for presentation-only events.
4. `hydrateWorkspace` checks only the workspace version and that `sessions` is an object. A learner can edit local storage to forge completed segments, event history, or status. Canonical position and completion must never be restored from that object.
5. Session 3 reflection values are three untyped strings; its written specification describes a four-point scale; canonical `SourcedRating` requires an integer from 1 through 5. The integrated UI must use the canonical 1–5 values directly. A lossy 3-to-5 or 4-to-5 conversion is not acceptable.
6. The current browser compares answers with `expectedAnswer` and chooses success/retry locally. In Session 7, the browser may submit a response to a mock Tutor Core bridge, but it must render only the returned, validated directive/outcome. It must not declare mastery, invent a misconception, or choose reteaching from confidence, timing, breaks, or local answer comparison.
7. `answers`, learner transcript text, and speech drafts are stored beside the local event history. They may remain device-local for exact resume, but the outbound adapter must explicitly exclude them from session events, evidence, deterministic traces, logs, errors, and recommendations.
8. `BreakState` restores only a screen and segment. Exact resume also requires the current task/substep, response draft reference, support-panel state, focus target, timer presentation and value, media fallback, reflection substep, and break occurrence.
9. Timer display maps only partially to the canonical `TimerPresentationPreference`. The integrated adapter must preserve the canonical preference and define, rather than guess, its browser presentation.
10. Session 1 has no canonical `TaskId` or dedicated learner-reference type. Session 7 therefore needs an explicitly temporary, versioned UI `taskRef`, while its opaque `learnerRef` is bound one-to-one to the canonical `StudentId` at bootstrap. Neither may be derived from a name, email, array index, or current DOM position.

## Integration boundary

### Authoritative and local data

The browser receives a validated student-safe bootstrap containing:

- canonical `LessonStudyPlan`;
- canonical `StudySession`;
- student-safe `StudentFocusProfile`;
- student-safe `ParentTeacherControls`;
- an opaque `learnerRef` bound to the canonical `studentId`;
- Tutor Core and recommendation bridge capabilities;
- one versioned resume token, if a resumable state exists.

The browser may own:

- the current presentation screen and focus target;
- an editable raw-answer draft stored only under `responseDraftRef`;
- whether the transcript panel is open;
- current caption text;
- speech/media capability state;
- the visual timer display;
- a pending, not-yet-acknowledged intent queue.

The browser must not own:

- completed-segment truth;
- canonical event sequence;
- mastery, misconception, correctness, or reteach authority;
- review-date calculation;
- duration recommendation authority;
- parent/accommodation precedence;
- resume-token validity;
- the decision that a forged or stale history is acceptable.

### Stable demonstration identifiers

The lab fixtures should use explicit IDs similar to the following. Exact spelling may differ, but each value must be declared once in the fixture and then passed through byte-for-byte.

| Entity | Grade 5 math | Grade 5 reading |
| --- | --- | --- |
| Learner reference / canonical student | `learner:demo:g5:01` | `learner:demo:g5:01` |
| Subject | `subject:math` | `subject:reading` |
| Skill | `skill:math:equivalent-fractions` | `skill:reading:context-clues` |
| Lesson | `lesson:g5:math:equivalent-fractions:v1` | `lesson:g5:reading:context-clues:v1` |
| Study plan | `plan:g5:math:equivalent-fractions:v1` | `plan:g5:reading:context-clues:v1` |
| Example session attempt | `session:g5:math:demo:001` | `session:g5:reading:demo:001` |
| Review | `review:g5:math:equivalent-fractions:001` | `review:g5:reading:context-clues:001` |

Each subject plan has six unique canonical segments:

```text
segment:g5:{subject}:warm-up
segment:g5:{subject}:visual-teaching
segment:g5:{subject}:guided-practice
segment:g5:{subject}:independent-attempt
segment:g5:{subject}:reflection
segment:g5:{subject}:exit-ticket
```

Daily goal and check-in are setup states, not completed learning segments. Engine recommendations, review recommendations, breaks, saves, and the final pacing choice also do not increase segment progress. Progress is always `completedSegmentIds.length / plannedSegmentIds.length`.

Until a canonical `TaskId` exists, the UI adapter owns:

```text
taskRef = task:{lessonId}:{segmentId}:primary
```

`taskRef` is stable for the plan revision, is never based on array position, and is never written into a branded canonical ID field. A support example uses a distinct suffix such as `:support-example:01` but remains attached to the same canonical segment.

Recommended deterministic identifiers are:

```text
draft:{sessionId}:{taskRef}:v1
event:{sessionId}:segment:{segmentId}:completed
event:{sessionId}:break:{interruptionId}:requested
event:{sessionId}:break:{interruptionId}:approved
event:{sessionId}:break:{interruptionId}:started
event:{sessionId}:break:{interruptionId}:ended
event:{sessionId}:technical:{runtimeGeneration}:started
event:{sessionId}:technical:{runtimeGeneration}:ended
```

A retry reuses the same semantic event ID. A duplicate with the same ID and body is acknowledged without reapplying it. The same ID with a different body is a conflict and is quarantined.

## One state machine

The integrated browser must render a projection of one canonical session machine. It must not keep a second learning pointer in the UI reducer.

| Runtime state | Student view | Canonical state/event effect | Progress effect |
| --- | --- | --- | --- |
| `daily-goal` | Goal, subject, access settings, start/resume | `PlannedStudySession`; existing `session-planned` remains authoritative | None |
| `check-in` | Readiness and presentation choices | On first start, `session-started`; submitted values are UI preference/input data, not mastery | None |
| `warm-up` | Retrieval item | `segment-started`, optional `active-response-recorded`, then idempotent `segment-completed` | +1 only after accepted completion |
| `visual-teaching` | Visual plus text equivalent and active notice/predict task | Same canonical segment lifecycle | +1 only after active response is accepted |
| `guided-practice` | One scaffolded step at a time | Same canonical segment lifecycle; hints may reference `tutor-intervention-recorded` evidence without raw text | +1 only after required learner contribution |
| `independent-attempt` | Independent response with optional bounded help | Same canonical segment lifecycle; Tutor Core evaluates submitted work | +1 only after accepted attempt lifecycle |
| `reflection` | Confidence, effort, frustration as three 1–5 questions | Ratings become canonical `LearningEvidence` sourced as `student-report`; Tutor Core retains instructional authority | +1 after all required ratings and the validated core response path |
| `exit-ticket` | Concise transfer task | Same canonical segment lifecycle; raw response remains local/Core-only; event carries at most `evidenceRef` | +1 after accepted completion |
| `recommendation` | Supportive, reason-coded engine result | Recommendation is a separate validated result; no segment completion | None |
| `review` | Learner-local review date and preparation | Validated `StudentSkillReview` update; date is computed as a local calendar date in its IANA time zone | None |
| `choice` | Equal break / continue / save-and-exit / finish actions | UI choice is recorded in the runtime vocabulary, then causes the canonical transition described below | None |
| `student-requested-break` | Waiting/approved transition without blame | `break-requested`; state is `StudentRequestedBreakStudySession` until approved | None |
| `approved-break` | Screen-free break and return action | `break-approved`, `break-started`; state is `ApprovedBreakStudySession` with `ResumePoint` | None |
| `paused` | Place/work saved with Resume, Break, Exit | `pause-started`; state is `PausedStudySession` with `ResumePoint` | None |
| `technical-interruption` | Recovery notice and explicit resume | `technical-interruption-started`; state is `TechnicalInterruptionStudySession` | None |
| `completed` | Neutral recap | `session-completed` and canonical `SessionResult` | Frozen |
| `abandoned` | Only for a genuine terminal abandon reason | `session-abandoned` and canonical abandoned result | Frozen |

### Choice semantics

- **Break:** request, approve, and start one break occurrence. Returning emits `break-ended` and `session-resumed`, and restores the exact `ResumePoint` plus the local presentation snapshot.
- **Continue:** complete the current session once, preserve its result, then create a new planned session/cycle with a new `SessionId`. Never reopen a terminal session.
- **Save and exit:** emit `pause-started`, persist a canonical `PausedStudySession`, issue a new resume token, and close the active browser view. It is not `session-abandoned`.
- **Finish:** after the exit ticket, emit one `session-completed` and one result. Repeated activation returns the prior acknowledgment.

### Technical recovery

Unexpected close, reload, browser crash, or connection loss is not a learner break. The first load in a new runtime generation emits one idempotent `technical-interruption-started`, pauses active time, and shows a recovery card. Explicit Resume emits `technical-interruption-ended` followed by `session-resumed`. Refreshing the recovery card repeatedly must not mint more interruption events for the same runtime generation.

Unavailable speech synthesis, unavailable speech recognition, and missing optional media use accessibility fallbacks; they are not automatically technical session interruptions.

## One versioned event vocabulary

Use one envelope, for example `StudentRuntimeEventV1`, with a literal
`vocabularyVersion: "student-runtime.event.v1"`. Required common fields are:

```text
id
vocabularyVersion
sessionId
sequence or pendingSequence
occurredAt
actor
type
idempotencyKey
```

Optional fields are bounded references and enums only: `segmentId`, `taskRef`,
`interruptionId`, `evidenceRef`, `reviewId`, `reasonCode`, and
`recommendationId`. There is no free-form `detail`, raw response, name, email,
transcript, prompt text, or coach text in the event.

Canonical event types use the exact Session 1 spelling and project directly into
`StudySessionEvent` after validation. UI-only types are namespaced and stay in
the local/runtime ledger:

```text
ui:check-in-submitted
ui:draft-saved
ui:reflection-substep-saved
ui:timer-mode-changed
ui:timer-goal-reached
ui:media-fallback-activated
ui:speech-fallback-activated
ui:engine-recommendation-presented
ui:review-recommendation-presented
ui:pacing-choice-recorded
ui:resume-quarantined
```

Only canonical types may enter `StudySession.eventLog`. The single runtime
vocabulary is therefore the browser/bridge seam; its canonical projection
remains a valid Session 1 aggregate and its UI projection remains explicitly
versioned.

The browser submits `pendingSequence`; the bridge assigns the next contiguous
canonical sequence after validation. A browser-supplied sequence or completed
segment list is never trusted.

### Current event retirement mapping

| Session 3 event or intent | Session 7 mapping |
| --- | --- |
| `session_started` | Canonical `session-started` |
| `check_in_completed` / `ui/check-in-submitted` | `ui:check-in-submitted`; never masquerades as a segment |
| `segment_completed` / `ui/segment-completed` | Canonical `segment-completed` with canonical `segmentId` and stable idempotency key |
| `break_requested` | Canonical `break-requested`; do not jump directly to an approved break without a validated decision |
| `break_returned` | Canonical `break-ended`, then `session-resumed` |
| `timer_goal_reached` | `ui:timer-goal-reached`; never advances instruction |
| `technical_interruption` | Canonical `technical-interruption-started`; recovery later emits ended/resumed |
| `intentional_save_exit` / `ui/work-saved` | Canonical `pause-started` plus a new resume token |
| `pacing_decision` / `ui/pacing-selected` | `ui:pacing-choice-recorded`, followed by the applicable canonical break, completion, or new-session transition |
| `ProvisionalOrchestratorEvent` | Retire; translate through the Session 7 canonical adapter and Tutor Core bridge |

## Exact resume contract

The local presentation snapshot may contain:

- `sessionId`, `studyPlanId`, and plan revision;
- canonical `segmentId`;
- temporary versioned `taskRef`;
- screen and substep;
- `responseDraftRef`;
- support panel/example state;
- reflection field currently being shown;
- timer mode, remaining active seconds, and pre-interruption running state;
- break occurrence and selected break activity;
- caption, transcript-open, no-audio, reduced-motion, and text-scale preferences;
- intended focus target expressed as a bounded focus-target enum;
- last acknowledged event ID/sequence.

Raw draft text is stored separately under `responseDraftRef`. It is not embedded
in the canonical `ResumePoint`, token, session event, evidence, or trace.

The token is opaque and integrity-protected by the bridge. It is bound to:

- vocabulary/token version;
- learner reference;
- session ID and session revision;
- study plan ID and revision;
- canonical segment;
- last acknowledged event sequence;
- issuance and expiry;
- a nonce consumed or rotated on successful resume.

On resume, the bridge validates the token before returning canonical state. A
browser-only hash is not sufficient to reject forgery because a learner can
rewrite both local data and its hash.

Reject and quarantine when:

- token version is missing, older without a lossless migration, or future;
- the token integrity check fails;
- learner, session, plan, or plan revision does not match;
- the token sequence is behind the latest acknowledged mutation;
- the session is already terminal;
- the segment is not in the validated plan or conflicts with canonical state;
- the token is expired or its nonce has already been replaced.

Quarantine never overwrites the source. Show: “This saved link can’t be used
now. Your last verified place is still safe.” Load only the last bridge-verified
position. Do not accept locally forged completed segments to make recovery seem
successful.

## Grade 5 math demonstration mapping

Fixture target: equivalent fractions.

1. **Daily goal:** show “I can build and explain equivalent fractions,” the
   canonical subject/lesson label, segment progress `0 of 6`, and resolved
   parent/access settings.
2. **Check-in:** record readiness and text/audio choice as bounded UI data.
   Starting creates or activates `session:g5:math:demo:001`.
3. **Warm-up retrieval:** render the `warm-up` canonical segment and one active
   response. The accepted completion records one segment only.
4. **Visual explanation:** show fraction bars plus a complete text equivalent.
   Media failure swaps to the text/model fallback without changing the segment.
5. **Guided example:** require one learner-selected or worked step before Tutor
   Core supplies feedback.
6. **Independent attempt:** place the learner’s editable work under its
   `responseDraftRef`; submit through Tutor Core; preserve the draft after the
   response is accepted.
7. **Water break:** while still at the independent-attempt return point, request
   a `water` break. Emit requested, approved, and started once. The UI states
   that work and place are saved and never counts the break as failure.
8. **Exact resume:** return to the same independent task/substep, draft,
   support-panel state, timer mode/value, and focus target. Emit ended/resumed
   once; no completion is created by the return.
9. **Reflection and exit ticket:** collect canonical 1–5 ratings, then one exit
   response. Tutor Core supplies instructional authority and the exit ticket
   becomes segment 6 only once.
10. **Engine and review recommendation:** display validated reason codes and the
    `nextReviewDate` in learner-local time. Show the review recommendation
    before the equal break/continue/save/finish choices.

Observable final state:

- exactly six unique completed segment IDs;
- one water-break occurrence with requested/approved/started/ended events;
- break and active duration stored separately;
- one session completion/result if Finish is selected;
- one review recommendation/update;
- no raw fraction answer, learner name, or email in events, evidence, logs, or
  trace output.

## Grade 5 reading demonstration mapping

Fixture target: context clues.

1. **Retrieval:** identify a contrast clue in the canonical warm-up segment.
2. **Teaching support:** show the context-clue map with an adjacent plain-text
   equivalent. “Read this to me” captions the same text; no audio is required.
3. **Guided response:** require the learner to identify both clue and supported
   meaning before the segment completes.
4. **Independent response:** save the long-form draft continuously under
   `responseDraftRef`. Prompt injection text is treated as inert learner text,
   never as an instruction to the bridge, Tutor Core, event mapper, or Jarvis
   catalog.
5. **Low-confidence check:** record confidence as canonical rating 1 (source
   `student-report`). It does not change mastery or independently choose
   reteaching.
6. **Supportive response:** show reason code `low-confidence-report` with:
   “Thanks for telling me. We can look at one small step or see another
   example.” Offer Break, Another way, and Keep going. Render any correction or
   reteach path only after a valid Tutor Core response.
7. **Save and exit:** from the support/reflection substep, create a
   `PausedStudySession`, preserve the selected low-confidence rating, exact
   support state, independent draft reference, timer state, and intended focus.
8. **Refresh and exact resume:** validate the rotated resume token, render the
   same support/reflection substep, keep the prior draft, pause the timer, do not
   replay speech, and do not duplicate completion, evidence, or review events.
9. Continue through the exit ticket and review recommendation using the same
   canonical rules when the learner elects to proceed.

## Parent preference and accommodation projection

The student-safe bootstrap accepts canonical mock inputs for:

- timer mode;
- maximum work duration;
- minimum/default/maximum break range;
- required breaks;
- reduced motion;
- no audio;
- large text;
- read aloud;
- speech input;
- parent manual override;
- accommodation maximum.

Use Card 5 precedence if it is available and validated. Otherwise the lab must
label and implement this provisional order:

```text
Safety limit
→ Required accommodation
→ Parent hard maximum
→ Parent explicit manual override
→ Engine recommendation
→ Grade-band default
```

Application rules:

- Resolve settings once into a reason-coded `ResolvedStudentSettingsV1`; render
  that projection rather than recomputing precedence in React.
- The effective work maximum is never greater than any higher-precedence cap.
  Manual and engine targets are clamped, not allowed to override a hard maximum.
- Reaching a hard maximum pauses active instructional time and offers Break,
  Save and exit, or Finish. It does not submit an answer, mark a segment
  complete, or use urgent/red countdown behavior.
- Required breaks cannot be skipped by an engine recommendation or a lower
  precedence override. Enter at a safe response boundary with the draft already
  saved.
- Break duration is clamped to the resolved minimum/maximum range. Repeated
  breaks remain approved, neutral events; a configured threshold may add an
  adult-review request without changing `countsAsFailure: false`.
- `reducedMotion` or OS reduced-motion disables ring rotation, pulse, animated
  interpolation, confetti, and slide/scale transitions immediately.
- `noAudio` cancels active speech and prevents later auto-speech. Captions,
  transcript, text, and typed response remain available.
- A required read-aloud accommodation remains available as a control. If audio
  is unavailable or conflicts with a higher-precedence safety/capability
  constraint, provide full text/captions, record a bounded accommodation
  conflict for adult review, and never block learning.
- `largeText` must reflow; it is not satisfied by zooming a fixed-width layout.
- Speech input always produces an editable draft and requires explicit submit.
  Denial/unavailability focuses the existing typed input.

### Timer mapping

The student-visible modes are:

| Browser mode | Canonical source | Behavior |
| --- | --- | --- |
| Visible | `count-down` (or `count-up` with an explicit direction field) | Numeric value, no per-second live announcement |
| Minimal | `progress-bar` or `milestones-only`, preserving which was supplied | No numeric time exposed unless explicitly requested |
| Hidden | `hidden` | No digit, ring value, or remaining-time text in the visual or accessibility tree |

The current `TimerMode = "visible" | "minimal" | "hidden"` loses count direction
and the distinction between progress bar and milestones. Replace it with a
versioned adapter projection that retains `canonicalPresentation` and
`direction`. Timer mode and timer time never alter segment progress.

## Captions, transcript, audio, media, motion, text, keyboard, and mobile

### Captions and transcript

- Populate the complete caption before requesting speech playback.
- The caption remains until the learner moves on; it is not motion-dependent.
- Transcript entries are ordered, speaker-labelled, escaped text. Opening the
  transcript neither pauses nor completes the task.
- Learner transcript/voice text is device-local resume data only. The outbound
  allowlist excludes it from evidence, events, traces, diagnostics, and Jarvis
  prompt context.
- Replaying speech does not duplicate the stored transcript turn.

### No audio and unavailable speech

- No-audio mode stops current speech immediately and persists.
- Speech synthesis failure shows: “Audio isn’t available on this device. You
  can keep going with text.”
- Speech-recognition failure leaves the typed path usable, preserves any draft,
  never shows a fake listening state, and announces the fallback once.
- Neither failure prevents completion.

### Missing media

Every visual has an adjacent semantic text/model equivalent. When an asset is
missing:

- show the equivalent in the same teaching-board landmark;
- emit only `ui:media-fallback-activated` with an opaque asset ID and bounded
  reason code;
- do not include a URL, stack trace, answer, or learner data;
- keep all responses and actions enabled;
- do not complete or skip the segment.

### Reduced motion and large text

- OS `prefers-reduced-motion: reduce` overrides animated modes.
- In-app changes take effect immediately and survive refresh/resume.
- At 200% browser text size and at the largest in-app setting, prompts,
  captions, transcript, progress labels, response controls, and exit controls
  reflow without overlap, clipping, or page-level horizontal scrolling.

### Keyboard and focus

Required order is: skip link, goal/progress, timer controls, task heading,
teaching board equivalent, response, primary action, direct Break, learner
support, Jarvis playback/caption controls, transcript, Save and exit.

- Native controls support Tab/Shift+Tab and Enter/Space; radio groups support
  arrow keys.
- Opening/closing a sheet or transcript restores focus to its trigger.
- Entering a break focuses the break heading.
- Returning focuses the exact restored segment/substep heading and then permits
  movement to the restored response.
- A validated refresh starts at the Resume card; speech never auto-replays.
- No focus trap, keyboard-only dead end, or timer-driven focus change is
  permitted.

### Touch and mobile

- All interactive targets are at least 44 by 44 CSS pixels.
- At 320 CSS pixels wide and in 667×375 landscape, task, response, direct Break,
  Save and exit, transcript, and session choices remain reachable.
- The teaching board and response appear before secondary Jarvis history in
  DOM order.
- On-screen keyboard display does not cover the response or primary action.
- Any horizontally scrollable progress strip is keyboard focusable and has an
  accessible name; the document itself does not scroll horizontally.

## Supportive reason-coded Jarvis messages

Jarvis renders from an allowlisted reason-code catalog. It never concatenates
raw answers, emails, names, transcripts, or untrusted engine text into a
message. Each rendered message must pass the existing coach-language safety
inspection.

| Reason code | Approved learner-facing intent/copy |
| --- | --- |
| `low-confidence-report` | “Thanks for telling me. We can look at one small step or see another example.” |
| `high-frustration-report` | “That felt frustrating. Your work is saved. You can take a break, see another way, or keep going with your answer.” |
| `student_request` / `water_requested` | “Your water break is ready. Your place and work are saved.” |
| `approved_break_not_failure` | “This break is part of the plan. Return when you’re ready.” |
| `repeated_break_pattern` | “You can take this break. Your place is saved. We’ll also ask an adult to review the plan so it can keep supporting you.” |
| `technical-recovery` | “The page was interrupted. Your verified place and draft are ready to resume.” |
| `speech-unavailable` | “Voice isn’t available right now. You can keep learning with captions and text.” |
| `media-unavailable` | “The visual isn’t available, so the same idea is shown in text.” |
| `insufficient_comparable_sessions` | “We’ll keep the current plan while we gather more comparable sessions.” |
| `parent_cap_requires_decrease` / `duration-cap-applied` | “This block has reached today’s limit. Your work is saved; choose a break, save, or finish.” |
| `review-scheduled` | “A short review is planned for {learner-local date}.” |

Random or rapid answers may create bounded evidence such as
`rapid_inconsistent_responses`, but the learner-facing response offers support
without alleging inattention. Prompt-injection text remains inert draft
content. Blame, diagnosis, permanent-capacity claims, punitive break language,
and pressure to sit longer are rejected before display.

## Local shape adapter and retirement manifest

| Session 3 shape | Required Session 7 treatment | Retirement condition |
| --- | --- | --- |
| `SubjectId = "math" | "reading"` | Map fixture route to canonical `SubjectId`; never infer from display text | Components accept canonical subject reference |
| shared `LearningSegmentId` | Replace with canonical per-plan `SegmentId`; keep a presentation-role enum separately | No reducer action accepts local segment aliases |
| `SessionDefinition` | Project validated `LessonStudyPlan` plus versioned content fixture | No plan timing/IDs originate in `content.ts` |
| static prototype `sessionId` | Use bridge-issued canonical `SessionId` per attempt | Two attempts cannot share an ID |
| `StudySession` browser aggregate | Split canonical session projection from local presentation snapshot | Canonical completed state cannot be changed in local storage |
| `StudyUxEvent` and free-form `detail` | Use `StudentRuntimeEventV1` and bounded fields/reason codes | Unknown version/type is quarantined |
| `StudyUxIntent` / `ProvisionalOrchestratorEvent` | Replace with typed canonical adapter and explicit UI-local events | No provisional snake_case event reaches the bridge |
| `answers` | Device-local draft store; outbound submission is isolated; session/evidence adapter omits raw value | Privacy test proves omission |
| `feedback: success | retry` and `expectedAnswer` browser scoring | Render validated Tutor Core result only | Browser cannot manufacture correct/reteach/mastery |
| three-string `ReflectionState` | Use canonical 1–5 ratings with `student-report` source and timestamp | No lossy scale conversion |
| `BreakState` | Canonical break variant + `ResumePoint` + local exact presentation snapshot | Return restores substep, draft, timer, support, focus |
| local `TimerState` | Versioned projection retaining canonical presentation and direction | Count-up/progress/milestone values are not collapsed |
| `StudyPreferences` | Project canonical focus/access settings and resolved controls | Precedence is tested outside React |
| `TranscriptEntry.text` | Local-only escaped content; never evidence/event/trace | Allowlist test rejects transcript leakage |
| `cleanExit`, `runtimeId`, `showRecoveryNotice` | Resume-token/runtime-generation protocol | Refresh loop creates one technical occurrence |
| `PacingDecision` | UI choice event followed by canonical state transition | Continue creates a new session; Finish is idempotent |
| `BoardKind`, `ResponseKind` | Keep as versioned presentation adapters attached to canonical segments/task refs | Unknown presentation version falls back or quarantines safely |

## Testable acceptance criteria

### Canonical and integrity

1. Given a valid Session 1 plan/session bootstrap, every rendered lesson,
   subject, skill, segment, learner, task, session, and event reference matches
   the declared fixture byte-for-byte.
2. Daily goal, check-in, engine recommendation, review, break, and pacing
   choice never increment six-segment progress.
3. Every accepted canonical event has a unique stable ID, a contiguous
   bridge-assigned sequence, an RFC 3339 timestamp, a valid actor, and only a
   planned segment reference.
4. Repeating a completion, review update, finish action, or break lifecycle
   retry with the same semantic key changes state once.
5. Reusing an event ID with a changed body is quarantined and does not mutate
   canonical or local verified state.
6. Missing, old-without-migration, future, or malformed event/workspace/token
   versions are quarantined with adult-safe fixed text.
7. A local-storage edit that adds a completed segment, terminal status, event,
   or higher sequence is rejected; the browser returns to bridge-verified state.
8. An expired, replayed, mismatched-plan, mismatched-learner, or bad-integrity
   resume token is rejected and cannot advance the learner.
9. A valid refresh restores exact task/substep, draft, support state, timer
   mode/value, media fallback, break state, and intended focus.
10. Raw name, email, answer, voice draft, transcript, prompt-injection text,
    browser URL, and stack trace are absent from canonical events, evidence,
    recommendations, logs, error bodies, and deterministic traces.

### Math and reading demonstrations

11. The math flow completes warm-up, visual teaching, guided practice,
    independent attempt, water break, exact resume, reflection, exit ticket,
    engine recommendation, and learner-local review recommendation.
12. The math trace contains six unique segment completions, one break
    occurrence, one review recommendation, and at most one terminal completion.
13. The reading flow completes retrieval, teaching support, guided response,
    independent response, a rating-1 confidence check, supportive response,
    save-and-exit, refresh, and exact resume.
14. Reading save/resume preserves the long-form draft without exporting its
    text and does not replay Jarvis speech.
15. Low confidence and high frustration offer support but never independently
    select correct/reteach, mastery, misconception, or prerequisite status.

### Breaks, timers, caps, and interruptions

16. A break requested from every active segment saves first, pauses active time,
    emits no segment completion, and returns to the exact task.
17. Three or more repeated breaks receive the same neutral UI. A configured
    threshold may open one adult-review request while all break events remain
    non-failure.
18. A water break, required break, and parent-configured break are clamped to
    the resolved range and carry separate occurrence IDs.
19. Visible, minimal, and hidden modes survive refresh. Hidden exposes no time
    value visually or to accessibility APIs; minimal exposes no unsolicited
    digits.
20. Timer expiry has no alarm, red urgency, pulse, auto-submit, progress
    mutation, focus change, or forced finish.
21. Active duration excludes pause, approved-break, save/exit, return countdown,
    background-tab pause, and technical-interruption time.
22. Safety/accommodation/parent caps prevent an excessive engine increase.
    The applied duration and reason codes prove the precedence used.
23. Refresh loops create one technical start event per runtime generation and
    never create learner-break, completion, evidence, or review duplicates.

### Tutor Core, evidence, review, and Jarvis

24. The browser cannot construct a Tutor Core directive by modifying
    confidence, effort, frustration, timer, break count, or answer text.
25. Random-answer indicators are contextual evidence only, include
    `doesNotEstablishInattention: true` where canonical evidence requires it,
    and yield supportive rather than blaming copy.
26. Pacing increases require sufficient comparable evidence; otherwise the UI
    shows the hold/insufficient-evidence message.
27. Review is emitted/displayed once, uses an IANA time zone and local calendar
    date arithmetic, and is unchanged across daylight-saving boundaries.
28. Every Jarvis message comes from an approved reason code, passes the language
    safety check, and rejects blame/diagnosis/punitive-break fixtures.
29. A draft containing HTML or “ignore previous instructions” is escaped,
    retained as learner text, and cannot change event type, reason code, tool
    call, prompt, or state transition.

### Accessibility and responsive browser behavior

30. Axe reports no serious or critical violations on goal, check-in, each of
    six segments, open transcript, no-audio, missing-media, break, recovery,
    recommendation, review, and final-choice states.
31. The full math flow and reading save/resume flow work keyboard-only with
    visible focus, logical order, no trap, and correct focus restoration.
32. Captions are available before speech, transcript replay is not duplicated,
    and no-audio/unavailable-speech modes remain fully completable.
33. Missing media renders a complete text equivalent and never hides,
    disables, or auto-completes the active response.
34. OS reduced motion and in-app reduced motion stop all nonessential motion
    immediately and persist after refresh.
35. At 200% text, 320-pixel portrait, 390×844 portrait, and 667×375 landscape,
    the page has no document-level horizontal overflow, clipped action, or
    obscured response.
36. All required touch targets measure at least 44×44 CSS pixels; the direct
    Break and Save/exit actions remain reachable in at most two activations.
37. Speech input denial, missing synthesis, missing recognition, audio runtime
    error, and media 404 each preserve the current draft and produce one polite
    fallback announcement.

### Build and deterministic validation

38. Unit tests cover adapter exhaustiveness, state transitions, preference
    precedence, idempotency, forged/stale resume rejection, PII omission, and
    safe message selection.
39. Browser tests cover both demonstrations, keyboard, mobile, timer anxiety,
    repeated breaks, unavailable speech, missing media, reduced motion,
    refresh loops, and prompt injection.
40. The deterministic math and reading traces are byte-stable after timestamps
    and generated IDs are fixed by the test clock/fixture.
41. Typecheck, unit tests, browser tests with Axe, and the production build all
    pass from a clean install of the Session 7 source package.

## Integration gate

The Student UX portion is ready for handoff only when:

- React renders canonical plan/session projections rather than the Session 3
  workspace as authority;
- the local provisional intent/event adapter is retired at the bridge;
- Tutor Core owns instruction outcomes;
- resume integrity and stale-state rejection are demonstrated in-browser;
- both required demonstrations and all accessibility fallbacks have automated
  evidence;
- sample traces contain IDs, bounded reason codes, counts, and references only,
  with no PII or raw-answer leakage.
