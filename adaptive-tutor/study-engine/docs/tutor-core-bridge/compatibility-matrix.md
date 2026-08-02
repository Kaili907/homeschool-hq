# Tutor Core Compatibility Matrix

Supported pairing:

- Tutor package: `@manuel-academy/adaptive-tutor-core` `0.2.0`
- Study contract schema: numeric version `1`
- Bridge contract: numeric version `1`
- Bridge release: `1.0.1`

| # | Required adapter | Bridge implementation | Result / boundary |
|---:|---|---|---|
| 1 | Opaque ID conversion | `createGovernedIdRegistry` | Explicit one-to-one map; no normalization |
| 2 | Package/contract version | `validateTutorBridgeEvent` | Exact versions only; otherwise quarantine |
| 3 | Grade band/level | `mapStudyGradeBandToTutor`, `mapTutorGradeLevelToStudy` | Grades 3–12 mapped; K–2 unsupported |
| 4 | Subject references | `mapStudySubjectToTutor` | Closed governed mapping |
| 5 | Skill references | `createGovernedIdRegistry` | Caller-supplied governed registry |
| 6 | Task to interaction phase | `mapStudyTaskToTutorPhase` | Advisory request only |
| 7 | Segment to Tutor cycle | `mapStudySegmentToTutorCycle` | Study completion and Tutor mastery stay separate |
| 8 | Assessment to Study evidence | `adaptFrozenTutorCoreResult` → `projectTutorEventToStudy` | Frozen schemas + program/review thresholds; counts only |
| 9 | Confidence/uncertainty | `confidenceFor` projection | Bridge auxiliary evidence; not Study 1–5 self-report |
| 10 | Misconception result | `misconceptionFor` projection | Tutor ID/status only; never diagnosis |
| 11 | Prerequisite result | validated `TutorPrerequisiteV1` | Current Core has no result envelope; emit insufficient evidence and never claim a gap |
| 12 | Guided/independent weighting | source to `IndependenceEvidence` | Guided remains guided; independent remains independent |
| 13 | Safety to adult review | layered classifier + `adultReviewFor` | Urgent/uncertain stop; structured flags only |
| 14 | Adult review evidence | `AdultPrivateProjectionV1` | No note body, direct ID, raw text, or transcript |
| 15 | Learner-safe evidence | `LearnerSafeProjectionV1` | Fixed supportive messages |
| 16 | Visual passthrough | `mapVisualBoardCommands` | Exact ten-command allowlist |
| 17 | Unknown visual fallback | `accessibleFallback` | Valid readable `add-text` command |
| 18 | Spoken turns | verified wrapper + `mapLearnerMedia` | Actual validated Core turn; visible text always present |
| 19 | Captions | Core cues or synthesized cue | Always visible |
| 20 | Transcript handling | `transcriptIncluded:false` | Never enters Study persistence |
| 21 | No voice | `mapLearnerMedia` | Visible fallback text; lesson continues |
| 22 | Missing media | `mapVisualBoardCommands` | Readable step; lesson continues |
| 23 | Reason codes to UX | fixed `LEARNER_MESSAGES` | No blame or source-text echo |
| 24 | Completion back to Tutor | `mapStudyCompletionToTutorReview` | IDs/flags/evidence refs only |
| 25 | Review recommendations | `recommendStudyAction` | Study scheduling still decides the date |
| 26 | Unsupported version | validation/quarantine | Lossless caller-owned source; payload not stored |
| 27 | Validation result | `adaptTutorCoreValidationResult` | Core `issue.value` is stripped |
| 28 | Schema registry | `createStudySchemaRegistryPort` | Canonical Session 1 registry is mandatory |
| 29 | Household time zone | validators and outbox | IANA zone plus local date required |
| 30 | Persistence sidecar | `PersistenceSidecarPort`, `TutorRecoverySidecarPort` | Atomic event ledger plus interfaces; Core state remains opaque |
| 31 | Queue/calendar/parent hooks | `orchestrateStudyCoreBridge` + hook ports | Ledger precedes proposal construction; interface/proposal only |
| 32 | Exact recovery checkpoint | `StudyRecoveryCheckpointV1` | CAS, cursor, timers, dedupe, protected Tutor-state reference; no answer/transcript |

## Frozen Core validation notes

The Tutor manifest declares 248 files and 1,133,026 listed bytes. Its custom
runtime validators are the integration authority. The generated
`tutor-program.schema.json` repeats nested `$id: "AssessmentItem"` values, so a
generic JSON Schema resolver may reject or ambiguously register that document.
The bridge tests the frozen runtime schema and separately tests committed JSON
schema structure; it does not rewrite the schema.

Tutor Core's package is private and has no `main`, `types`, or `exports`.
Integration therefore injects frozen runtime functions or uses its direct ESM
barrel; the bridge does not invent a package export.

## Prerequisite limitation

Tutor Core exports graph validation and `getMissingPrerequisites`, but its
engine does not call `getMissingPrerequisites`. The bridge can accept only a
validated Core graph. Because Core v0.2 exports neither demonstrated-skill
provenance nor a prerequisite-result envelope, the bridge always emits
`insufficient-evidence` with no claimed gap and no remediation decision.
Caller-constructed prerequisite evidence is an unknown field and is
quarantined. The bridge does not manufacture a prerequisite result from low
accuracy.
