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
 * NOT CLOSED HERE. This card does not modify StudySessionContainer, which today
 * calls the preview runtime's synchronous `launch` for effect. The requirement
 * lands with the wrapper.
 */
export const STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT = Object.freeze({
  id: 'WRAPPER_LANDING_REQUIREMENT',
  condition: 'F1',
  requirement: 'AWAIT_LAUNCH_BEFORE_DURABLE_PREPARATION',
  status: 'open',
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
 * Partially closed here: `acceptStudyTutorResult` exists, so the fail-closed
 * path is now shorter than writing the mistake. The obligation to use it still
 * lands with the wrapper.
 */
export const STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT = Object.freeze({
  id: 'WRAPPER_LANDING_REQUIREMENT',
  condition: 'F4',
  requirement: 'PARSE_RAW_RESULT_BEFORE_IT_IS_TYPED_AS_A_CONTRACT_VALUE',
  status: 'open',
  rawResultType: 'unknown',
  admissibleOutcomes: Object.freeze(['accepted-contract-value', 'quarantine', 'refusal']),
  enforcedBy: 'production-wrapper-integration-tests',
} as const)

/** Both, for a wrapper card to enumerate rather than rediscover. */
export const STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS = Object.freeze([
  STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT,
  STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT,
] as const)
