# Canonical Contract Integration Agent report

Inspected: 2026-07-29

Scope: read-only inspection of Card 1, Card 5, Tutor Core/Session 6
availability, and the Card 7 student-runtime mapping. The only implementation
change from this audit is the isolated regression test named below. No Wave 1,
canonical, Tutor Core, subject, calendar/parent, production, or deployment
file was edited.

## Artifact verification

| Artifact | Result |
| --- | --- |
| `CARD-1-STUDY-CONTRACTS.zip` | SHA-256 is exactly `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41`, matching dispatch. The ZIP has 73 entries: 70 files and 3 directories. All 70 file streams are byte-identical to their mounted `adaptive-tutor/study-engine/**` counterparts; 0 missing and 0 different. |
| Session 2 Study Engine ZIP | SHA-256 is exactly the supplied `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770`. |
| Session 3 Study-UX ZIP | SHA-256 is exactly the supplied `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11`. |
| `CARD-5-STUDY-RECON-AUDIT.zip` | Present and readable. Its locally computed SHA-256 is `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7`. All 36 files are byte-identical to the mounted Card 5 reconciliation package; 0 missing and 0 different. No external dispatch hash was supplied for this artifact. |

The Card 5 manifest identifies
`manuel-academy.study-reconciliation@0.5.0-blocked.1`. Its overall status is
`PASS_WITH_BLOCKER` because Tutor Core v0.2 is unavailable, and it does not
authorize final assembly or production integration. That blocker does not make
its recorded reconciliation decisions disappear. In particular, DEC-012 is
available and is the applicable precedence decision.

Tutor Core v0.2 is not available. No matching archive, manifest, package name,
or version was found. Card 5 independently records `requiredVersion: "0.2"`,
`status: "NOT_ACCESSIBLE"`, and instructs consumers not to approve mappings
until the actual bytes are inventoried. Legacy application tutor files and
summaries were not treated as substitutes.

No genuine Session 6 bridge package, archive, or manifest is available. The
only matching implementation is the clearly versioned, Card 7-owned
`src/bridges/session6Bridge.v1.ts`. Its source correctly says it is temporary,
local-only, and not Tutor Core. It must remain a stand-in, not a verified
Session 6/Tutor Core mapping.

## Conformance result

Status: **partial, with release-blocking canonical gaps**.

The lab constructs Card 1 `LessonStudyPlan`, `ParentTeacherControls`,
`StudentFocusProfile`, `StudySession`, `LearningEvidence`, and
`StudentSkillReview` values and validates them with the mounted v1 schemas.
Canonical `segment-completed` events are the progress source, the event log
uses Card 1 event strings, and emitted evidence built by the normal path omits
entered work. Those are sound foundations.

The following findings prevent a claim of full Card 1/Card 5 conformance.

### 1. Card 5 precedence is available but not consumed

`runtimeTypes.ts`, `engineProjection.v1.ts`, `catalog.ts`, the UI, manifest,
docs, and tests still label the resolver
`student-runtime.card5-awaiting.v1` with `provisionalUntilCard5: true`.
That availability statement is now false.

DEC-012 requires:

1. schema/version, integrity/idempotency, actor authorization, and active
   recommendation-state gates;
2. reduction of safety constraints, required accommodation bounds, and the
   most restrictive authorized adult maximum into a feasible interval;
3. `manual_review` with no automatic target when the interval is empty;
4. selection from a current authorized override, an accepted
   evidence-sufficient recommendation, an established target, then the grade
   default;
5. clamping with winning provenance and every applied constraint recorded.

The current resolver only chooses manual override over engine over grade
default, computes an upper cap, and returns every possible reason code. It has
no lower bound, infeasible-interval outcome, authorization/expiry/revision
gate, accepted recommendation decision, established target, concurrent
override handling, or winning provenance. Required breaks and presentation
accommodations are also not represented as composed obligations.

Required remediation: version the replacement as a Card 5/DEC-012 resolver,
retain the current save format only behind explicit migration/quarantine, and
update every `card5-awaiting` availability claim and test expectation.

### 2. Stable IDs are typed but do not satisfy DEC-002/DEC-004

Positive: plan, lesson, subject, skill, segment, learner, session, event,
evidence, review, result, and interruption references use Card 1 branded
types at their construction points, and cross-aggregate validation checks key
relationships.

Gaps:

- DEC-002 says IDs must not be derived from grade, names, dates, array
  positions, or titles. Current IDs visibly embed `g5`, semantic labels, and
  segment names. Event IDs embed their sequence.
- `createPlannedCanonicalSession()` always emits
  `session:student-runtime:<subject>:demo-001`. Starting a second independent
  session for the same subject therefore reuses its `SessionId` and all
  downstream evidence/review namespaces.
- DEC-004 says a planned task instance is its canonical `SegmentId`; it
  explicitly forbids a second `TaskId`. The runtime creates a parallel
  `task:g5:...` identity and even labels it “Canonical task” in the UI.

Preferred task-ID remediation: at this temporary bridge boundary, replace
`taskId` with `taskRef` or `segmentId` whose value and type are the exact
canonical `SegmentId`. Use the plan segment's `taskType` only as
classification. If a future verified Tutor Core package requires item/substep
identity, add a versioned local item reference with an explicit
item-to-`SegmentId` mapping; do not call it the canonical task instance.

Current `taskIdFor` usages to retire:

- `src/catalog.ts`: definition;
- `src/state/runtimeMachine.ts`: import, receipt lookup, and bridge request;
- `src/App.tsx`: import and “Canonical task” display;
- `scripts/generate-traces.mjs`: trace task list;
- `tests/student-runtime/unit/canonicalFlow.test.ts`: import and assertion.

The parallel shape also exists as `TutorCoreBoundaryReceipt.taskId`,
`TemporarySession6BridgeRequest.taskId`, the bridge receipt output, and the
unsupported-version adversarial fixture. A breaking replacement needs a new
bridge version and explicit old-save quarantine/migration.

Use caller-supplied opaque fixture IDs generated independently of learner
attributes. Give every newly started session a unique stable `SessionId`;
deterministic traces can inject a fixed test ID rather than making the runtime
reuse one global ID.

### 3. Readiness is a forgeable progress authority

`completeCurrentSegment()` currently requires only an active session, the
learning screen, and mutable local `feedback[currentSegment] === "ready"`.
It does not require a matching validated bridge receipt.

A workspace can complete the next legal segment by changing that one local
field. Because the forged completion remains the expected prefix of the plan,
`validateRuntimeWorkspaceIntegrity()` also accepts it. The current adversarial
probe tests only an out-of-order forged exit-ticket completion and misses this
attack.

The new regression
`tests/student-runtime/unit/canonical-contract-agent.test.ts` proves the gap.
Its narrow run currently fails because integrity returns `{ ok: true }` for a
forged ready flag with zero receipts.

Required remediation:

- make feedback a projection, never an authority;
- require a validated, current-version receipt bound to the exact
  `SessionId`, `SegmentId`, request/idempotency ID, and response reference;
- include those bindings in the receipt (the current receipt omits
  `sessionId`);
- reject a receipt reuse across segments/sessions and quarantine same-key,
  different-payload conflicts;
- make integrity replay derive feedback/completion eligibility from the
  validated receipt/event history.

### 4. Session/event replay and idempotency are incomplete

The normal flow emits only Card 1 event names, preserves contiguous sequence
numbers, and rejects duplicate completed segment IDs. However, Card 5 DEC-005
requires one exhaustive transition reducer because aggregate schema validation
does not prove intermediate transitions. Card 7 currently exposes multiple
mutation functions rather than one reducer and does not replay the event log
through an exhaustive state machine during resume validation.

The local completion key is not the canonical `SessionEventId`, and duplicate
handling does not compare byte-equivalent command payloads. DEC-002/006 require
same key plus same canonical payload to be a no-op, while same key plus
different content is a conflict and quarantine.

Technical recovery appends start/end/resume events while keeping the aggregate
active; the canonical `technical-interruption` state and its typed
`TechnicalInterruption` record are never materialized. Duration-cap pausing is
always coded `accessibility-need`, even when the binding cap came from safety
or a parent maximum. Both should be resolved by the exhaustive reducer with a
reason-specific transition.

### 5. Resume is useful locally but not an exact Card 5 cursor

Positive: the versioned envelope binds subject, session, revision, saved time,
and the complete local workspace; it uses deterministic SHA-256, rejects stale
revision requests, quarantines unsupported/tampered values, and preserves
entered work locally.

Gaps:

- `ResumePoint.elapsedActiveSecondsInSegment` is populated from the
  session-wide `elapsedActiveSeconds`, so its name and exact-position claim are
  not true after earlier segments have consumed time.
- Raw drafts are embedded in the workspace/envelope instead of living in a
  separately addressed local draft vault behind `responseDraftRef`.
- The bridge response reference (`draft:<subject>:<segment>`) differs from the
  canonical resume reference (`draft:<session>:<segment>`).
- The Card 5 cursor bindings for plan revision, substep, last applied event
  sequence, checkpoint revision, and opaque resume token are absent.
- An unkeyed same-origin SHA-256 digest detects accidental/simple edits but is
  not authenticity against an actor able to rewrite the payload and digest.
  This is acceptable only when explicitly described as a local lab limitation.

### 6. Evidence privacy passes the normal builder but authority is provisional

The normal evidence builder uses aggregate counts/ratings and explicit
`raw-answer-omitted`/`pii-omitted` markers. It does not set mastery,
misconception, or prerequisite outcomes, and raw response strings remain out
of emitted events/evidence/reviews in the demonstrated flow.

Remaining concerns:

- canonical accuracy, intervention counts, review success, and focus
  `coreOutcome` are derived from the answer-scoring temporary bridge;
- independence is hard-coded to `independent`/`1`, rather than derived from
  comparable canonical evidence;
- four comparable focus sessions are manufactured by
  `mockComparableHistory()`, so the resulting “sufficient evidence” is a demo
  fixture, not accumulated learner evidence;
- the integrity leakage check compares only local response strings of at least
  eight characters, so it is not a general allowlist against short answers or
  PII placed under another permitted string field.

These outputs may be shown only as lab simulations until the verified Tutor
Core/Session 6 authority and real comparable evidence are available.

### 7. Learner-local review dates are calculated correctly but use a fixed mock zone

`createReviewRecommendation()` converts the offset-qualified instant through
`calendarDateInTimeZone()`, and `StudentSkillReview` persists both date-only
values and `timeZone: "America/New_York"`. It does not use UTC-midnight
arithmetic, so the local-date mechanism is correct.

DEC-015 requires the zone to come from one authorized
`HouseholdCalendarContext`. Card 7 instead uses a hard-coded lab constant. That
is acceptable as an explicitly authorized mock for this isolated prototype,
but it is not a production household-zone source and must not be described as
calendar/parent runtime integration.

## Test result

Command:

```text
npm test -- canonical-contract-agent.test.ts
```

Result at audit time: **FAIL**, 1 file / 1 test. The expected
`invalid-history` rejection received `{ ok: true }`, confirming the forged
readiness gap. No broad test suite was run from this agent because other
integration agents were actively editing the shared untracked Card 7 roots.

## Handoff priority

1. Close the forged readiness/receipt binding defect and make the new
   regression pass.
2. Replace every `card5-awaiting` branch with a versioned DEC-012 resolver.
3. Retire parallel task IDs in favor of exact `SegmentId` task references.
4. Introduce one exhaustive canonical transition/replay reducer and semantic
   idempotency conflict handling.
5. Correct per-segment resume time and cursor/draft bindings.
6. Keep Tutor Core/Session 6 claims provisional until actual package bytes,
   hashes, manifests, fixtures, and parity tests exist.
