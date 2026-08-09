/**
 * STUDY-A1-TUTOR-CONTRACT-H2 — what a production wrapper must do, stated where
 * the wrapper's own tests will trip over it.
 *
 * These are NOT closed by this card. The production Tutor wrapper does not
 * exist (PROD_TUTOR_WRAPPER_REMAINS_SEPARATE), and two of the independent
 * review's conditions cannot be closed by the contract alone: they are
 * properties of how a host *calls* the contract, and the host that will do so
 * has not been written.
 *
 * Recording them as a frozen, exported, tested list is the honest form. A
 * comment can be landed past; a named requirement that the wrapper's own
 * integration suite is required to cite cannot be, and it stays visible in the
 * contract's surface until something discharges it.
 *
 * Nothing here changes runtime behaviour. It is the statement the next card is
 * held to.
 */

/**
 * F1 — the async launch.
 *
 * `StudyTutorRuntime.launch` returns `Promise<void>`. A host that calls it
 * without awaiting has started nothing it can rely on: the Tutor session may
 * not exist yet, and it may still fail. Anything durable the host does in that
 * window is a claim it cannot support.
 *
 * The three durable preparations that must not precede a settled launch, named
 * from what the mounted preview host actually does:
 *
 *  - calendar start (the block is marked begun),
 *  - the session-launched event (a durable record that Study started),
 *  - session persistence (`saveSession`, which writes the active session row).
 *
 * If launch rejects and any of those already happened, the host has recorded a
 * Study session that never started for a learner who never got one.
 *
 * CLOSED by STUDY-A1-PROD-TUTOR-WRAPPER-C, and closed on evidence rather than
 * on the existence of a wrapper.
 *
 * The bar this card set for itself was that the real host must be shown
 * incapable of the mistake, not merely written so as to avoid it. Both halves
 * are in place:
 *
 *  - STRUCTURALLY. `settleStudyTutorLaunch` in
 *    src/study/production/tutorLaunchOrdering.ts awaits the launch, re-asserts
 *    the lifecycle epoch afterwards, and returns a `LaunchSettled` witness
 *    branded with an unexported `unique symbol`. `prepareDurableStudySession`
 *    — which performs all three preparations above and is the only thing that
 *    does — requires that witness. A host cannot reach a durable write before a
 *    settled launch without an explicit type assertion; it does not compile.
 *
 *  - BEHAVIOURALLY. src/study/production/tutorLaunchOrdering.integration.test.tsx
 *    mounts the REAL StudySessionContainer against the REAL Study ports with a
 *    Tutor whose launch rejects only after twelve microtask turns — comfortably
 *    past where an unawaiting host would have written all three records — and
 *    asserts that none of them happened, that no active session row exists, and
 *    that the calendar block is still `scheduled`. The same file first
 *    REPRODUCES the defect with the pre-card ordering against those same ports,
 *    so the guard is shown to be guarding something real.
 *
 * The residual, stated plainly and in the same terms as F4's below: one
 * `as LaunchSettled` compiles. That is what a type assertion IS, and a contract
 * claiming otherwise would invite a later author to trust a guarantee that was
 * never there. What the witness removes is every bypass that reads as correct
 * code — a forgotten `await`, a reordered pair of statements, a boolean flag
 * set too early.
 */
export const STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT = Object.freeze({
  id: 'WRAPPER_LANDING_REQUIREMENT',
  condition: 'F1',
  requirement: 'AWAIT_LAUNCH_BEFORE_DURABLE_PREPARATION',
  status: 'closed',
  mustPrecede: Object.freeze([
    'calendar-start',
    'session-launched-event',
    'session-persistence',
  ]),
  /**
   * The wrapper's integration suite must fail if this is violated — an
   * unawaited `launch` is invisible in a passing test that never sequences it,
   * so the test has to be one that orders a rejecting launch against the first
   * durable write.
   */
  enforcedBy: 'production-wrapper-integration-tests',
  /** The card that discharged it, so the claim is attributable. */
  closedBy: 'STUDY-A1-PROD-TUTOR-WRAPPER-C',
  /** The structural half, named the way F4 names its own. */
  contractEnforcement: 'launch-settled-witness',
  /** The same residual the validated-result brand has, and for the same reason. */
  residualBypass: 'single-explicit-type-assertion',
} as const)

/**
 * F4 — the parse obligation.
 *
 * An external Tutor's output is unknown until it has been parsed. The only
 * admissible crossing is:
 *
 *   raw external Tutor result
 *     -> parseStudyTutorResult(raw)   (or acceptStudyTutorResult(raw))
 *     -> accepted contract value, or safe quarantine / refusal
 *
 * The failure this forbids is a type assertion: a wrapper that declares its
 * transport's output to be `StudyTutorResult` before validating it has skipped
 * the boundary while appearing to honour it. `unknown` is the only correct type
 * for a value that has not been through the parser.
 *
 * H2 made the fail-closed path shorter than the mistake (`acceptStudyTutorResult`).
 * H3 made the mistake hard to express at all: `StudyTutorRuntime.submit` returns
 * `ValidatedStudyTutorResult`, which is branded with an unexported symbol, so a
 * wrapper cannot satisfy the method by asserting its transport's output or by
 * writing a literal of the right shape. The only expressions of that type are
 * the ones the parser returned.
 *
 * STILL OPEN, and deliberately.
 *
 * H4 CORRECTION. H3 recorded the residual bypass as `as unknown as
 * ValidatedStudyTutorResult`, i.e. a double assertion. That overstated what the
 * brand costs an attacker, and the independent review was right to say so.
 * Measured against this tree rather than reasoned about: ONE assertion is
 * enough, from any of the three starting points a wrapper actually has —
 *
 *   raw as ValidatedStudyTutorResult                  // its transport's output
 *   unknownValue as ValidatedStudyTutorResult         // straight from unknown
 *   { status: 'quarantined', reasonCode: 'x' } as ValidatedStudyTutorResult
 *
 * — and all three compile clean under `strict`. That is not a hole in the
 * brand; it is what a type assertion IS. TypeScript cannot prevent a programmer
 * from asserting, and a contract that claimed otherwise would be inviting a
 * wrapper author to trust a guarantee that was never there.
 *
 * So the honest statement of what the brand buys is narrower than H3's, and
 * still worth having: it removes the bypasses that DO NOT look like one. A
 * wrapper can no longer satisfy `submit` by declaring its transport's return
 * type, or by writing an object literal of the right shape — the two mistakes
 * that read as correct code and pass review. What remains is an explicit,
 * greppable assertion that a reviewer can see and ask about.
 *
 * The obligation is therefore unchanged and lands with the wrapper: no
 * assertion to `ValidatedStudyTutorResult`, in any form. The admissible
 * crossing is the one at the top of this comment, and it is shorter to write
 * than the bypass.
 *
 * STUDY-A1-F4-PARSE-BEFORE-HOST-C — the host stopped depending on it.
 *
 * This obligation is STILL OPEN and this card does not close it. Nothing here
 * could: `raw as ValidatedStudyTutorResult` remains expressible in any wrapper
 * that wants to write it, forever, and no host-side change makes a TypeScript
 * assertion fail to compile. A card claiming otherwise would be claiming
 * something about the language that is not true.
 *
 * What changed is narrower and worth stating exactly: the bypass is no longer
 * LOAD-BEARING AT THE HOST. `StudySessionContainer`'s normalizer used to take a
 * `ValidatedStudyTutorResult` and read its fields straight into presentation
 * and durable state, so a forged brand carried a Tutor's content — 25,000
 * characters of prose to a ten-year-old, a 500-character reference into her
 * father's durable record, a learner's own sentence into the safety-stop
 * ledger under a field named `reasonCode`. It now takes `unknown` and its first
 * operation is `acceptStudyTutorResult(raw)`; every branch reads the canonical
 * rebuilt value and none reads the caller's object. A forged brand still
 * compiles and now buys nothing: it reaches a parser that never looked at the
 * type.
 *
 * So there are two independent layers with separate failure modes, which is the
 * point of keeping both. The brand is a compile-time layer that removes the two
 * bypasses which read as correct code (`removesBypasses` below). The host
 * reparse is a runtime layer that does not care whether the brand was earned.
 * `StudyTutorRuntime.submit` therefore still returns
 * `ValidatedStudyTutorResult` and must keep doing so — widening it to `unknown`
 * would delete the compile-time layer to celebrate the runtime one.
 *
 * Enforcement of the host half is
 * src/study/production/hostResultAcceptance.integration.test.tsx, which mounts
 * the real container against a runtime that performs exactly the one assertion
 * this comment says cannot be prevented.
 */
export const STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT = Object.freeze({
  id: 'WRAPPER_LANDING_REQUIREMENT',
  condition: 'F4',
  requirement: 'PARSE_RAW_RESULT_BEFORE_IT_IS_TYPED_AS_A_CONTRACT_VALUE',
  status: 'open',
  rawResultType: 'unknown',
  admissibleOutcomes: Object.freeze(['accepted-contract-value', 'quarantine', 'refusal']),
  enforcedBy: 'production-wrapper-integration-tests',
  /**
   * What H3 changed, recorded so a later card can tell a structural boundary
   * from the convention this used to be — and so that removing the brand shows
   * up as a lie here rather than as silence.
   */
  contractEnforcement: 'validated-result-brand',
  contractEnforcementCard: 'STUDY-A1-TUTOR-CONTRACT-H3',
  /**
   * What the brand does NOT stop, recorded as data so a wrapper card reads it
   * rather than inferring a stronger guarantee from prose. H3 said the residual
   * cost was a double assertion; it is a single one.
   */
  residualBypass: 'single-explicit-type-assertion',
  residualBypassCorrectedBy: 'STUDY-A1-TUTOR-CONTRACT-H4',
  /** The two mistakes the brand DOES remove — the ones that read as correct. */
  removesBypasses: Object.freeze([
    'declaring-the-transport-return-type-as-the-contract-type',
    'object-literal-of-the-right-shape',
  ]),
  /**
   * STUDY-A1-F4-PARSE-BEFORE-HOST-C — the host-side half, recorded as data.
   *
   * These four fields say something different from `status`, and the difference
   * is the whole reason they exist. `status` is about the WRAPPER obligation,
   * which is open and stays open. These are about what the HOST does, and a
   * later reader must be able to tell the two apart without inferring it from
   * prose.
   */
  hostEnforcement: 'host-reparse-of-untrusted-result',
  hostEnforcementCard: 'STUDY-A1-F4-PARSE-BEFORE-HOST-C',
  /** The host names no branded type and takes no compile-time fact on trust. */
  hostTrustsTheBrand: false,
  /**
   * The residual bypass is still expressible and still compiles. It just no
   * longer decides anything at the host, because the host reparses regardless.
   * This is NOT a claim that the assertion was closed.
   */
  loadBearingAtHost: false,
} as const)

/**
 * F5 — content eligibility before durable work.
 *
 * THE DEFECT, reproduced rather than described.
 * `selectTutorProgram` in the frozen subject registry ends
 * `matched ?? registration.programs[0]`, so an unmatched lesson or skill
 * reference does not refuse — it returns the subject's DEFAULT program. Driven
 * at this card's base, a turn carrying `lessonRef: 'lesson:fractions-week-3'`
 * and `skillRef: 'skill:equivalent-fractions'` came back `accepted`, asking the
 * learner a place-value comparison question from sequence 01. Nothing anywhere
 * reported a mismatch, because a wrongly-selected program is still reviewed,
 * still in band and still schema-valid: every later check answers correctly
 * about the wrong lesson.
 *
 * The known "unsupported content is discovered on submit" failure is the
 * BENIGN half of this. It at least quarantines. The silent half taught the
 * wrong lesson and recorded a normal session.
 *
 * THE REQUIREMENT. A host must settle content eligibility BEFORE any of the
 * four steps in `mustPrecede`, and an ineligible answer must refuse rather than
 * choose a program. Ordered first among them is `settleStudyTutorLaunch`
 * itself: eligibility is a property of the block, knowable before a Tutor
 * session is opened, and a launch that succeeded for content the Tutor cannot
 * teach has already cost something even when nothing durable followed it.
 *
 * WHAT IS IN PLACE.
 *
 *  - `evaluateStudyTutorContentEligibility` in
 *    src/study/production/tutorContentEligibility.ts, and its fail-closed
 *    selector `selectEligibleTutorProgram`, whose entire difference from the
 *    legacy one is `?? null` where that has `?? registration.programs[0]`.
 *    LEGACY SEMANTICS ARE UNCHANGED, deliberately: the mounted preview host
 *    depends on the fallback, and the frozen tree's own suite pins it.
 *    src/study/production/tutorContentEligibility.test.ts drives both over one
 *    unmatched input and asserts they disagree, so the difference is a tested
 *    fact rather than a comment.
 *  - `settleEligibleStudyTutorLaunch` in
 *    src/study/production/tutorLaunchOrdering.ts, which reparses the decision
 *    as `unknown` — F4's rule applied to the eligibility transport — and throws
 *    before `launch` is called. No witness is minted, so
 *    `prepareDurableStudySession` cannot run.
 *  - src/study/production/tutorContentEligibilityOrdering.integration.test.tsx,
 *    which drives that seam against the REAL local Study ports and asserts that
 *    an ineligible block leaves the calendar block `scheduled`, appends no
 *    `session-launched` event and writes no session row — and that an eligible
 *    one does all three, so the guard is not passing by doing nothing.
 *
 * STILL OPEN, and deliberately. The production host does not exist
 * (PRODUCTION_ROUTE_NOT_MOUNTED), so nothing can yet be required to come
 * through that door: a host may still call `settleStudyTutorLaunch` directly
 * and skip the check entirely. That is the honest residual, recorded the way
 * F4's single type assertion is. It closes when a mounted production host
 * discharges it.
 *
 * The transport-facing half — `parseStudyTutorEligibilityRequest`,
 * `parseStudyTutorEligibility` and `acceptStudyTutorEligibility` in
 * ./eligibility.ts — is complete and is what a future server check answers
 * over. Malformed and over-long references are REFUSED there, never trimmed:
 * a truncated `lesson:...` is a different lesson reference, and one that may
 * well match a reviewed program, which is this same defect with a new entrance.
 */
export const STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT = Object.freeze({
  id: 'WRAPPER_LANDING_REQUIREMENT',
  condition: 'F5',
  requirement: 'SETTLE_CONTENT_ELIGIBILITY_BEFORE_ANY_DURABLE_WORK',
  status: 'open',
  /** In order. The launch is first because eligibility precedes it too. */
  mustPrecede: Object.freeze([
    'tutor-launch-settlement',
    'calendar-start',
    'session-launched-event',
    'session-persistence',
  ]),
  enforcedBy: 'production-wrapper-integration-tests',
  /** The seam that refuses, and the only one that reparses the decision. */
  contractEnforcement: 'ineligible-content-refused-before-launch',
  contractEnforcementCard: 'STUDY-A1-TUTOR-CONTENT-ELIGIBILITY-CONTRACT-C',
  /**
   * The legacy fallback is NOT removed, and a later card must be able to tell
   * that from data rather than from prose. `selectTutorProgram` still answers an
   * unmatched routing id with `registration.programs[0]`; the production
   * selector is a separate function that answers `null`.
   */
  legacySelectorRemainsFallback: true,
  productionSelector: 'selectEligibleTutorProgram',
  /** Refuse, never trim — the rule the reference parsers hold to. */
  malformedReferencePolicy: 'reject-not-truncate',
  /** No learner grade and no working level is an input, in either half. */
  usesLearnerGradeAuthority: false,
  /** What a host can still do, stated the way F4 states its own residual. */
  residualBypass: 'calling-settleStudyTutorLaunch-directly',
} as const)

/**
 * All three, for a wrapper card to enumerate rather than rediscover.
 *
 * They do not share a status, and that asymmetry is the point. F1 was a
 * property of how a host CALLS the contract, so a host could discharge it and
 * one now has. F4 is a property of what a type assertion can express, so no
 * host can discharge it and none ever will — it stays open, and the honest
 * statement of what the brand does and does not buy stays with it. F5 is a
 * property of a host that has not been built: the machinery to discharge it is
 * in place and tested, and it stays open until something is mounted that has to
 * use it.
 */
export const STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS = Object.freeze([
  STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT,
  STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT,
  STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT,
] as const)
