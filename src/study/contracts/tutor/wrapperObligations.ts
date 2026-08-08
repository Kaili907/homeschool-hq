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
} as const)

/**
 * Both, for a wrapper card to enumerate rather than rediscover.
 *
 * They no longer share a status, and that asymmetry is the point. F1 was a
 * property of how a host CALLS the contract, so a host could discharge it and
 * one now has. F4 is a property of what a type assertion can express, so no
 * host can discharge it and none ever will — it stays open, and the honest
 * statement of what the brand does and does not buy stays with it.
 */
export const STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS = Object.freeze([
  STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT,
  STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT,
] as const)
