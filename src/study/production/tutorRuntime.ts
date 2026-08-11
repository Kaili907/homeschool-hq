/**
 * STUDY-A1-PROD-TUTOR-WRAPPER — the production `StudyTutorRuntime`.
 *
 * This is the object the contract in ../contracts/tutor/runtime.ts describes.
 * Everything it hands a Tutor is either an opaque reference the host already
 * approved, a closed domain value, or the learner's transient words; everything
 * it hands back to the host went through `acceptStudyTutorResult`.
 *
 * Three separations are load-bearing and none of them is obvious from the
 * shapes alone.
 *
 * HOST AUTHORITY IS CONSTRUCTOR STATE, NOT METHOD ARGUMENTS. The safety port
 * needs the host's `StudyScope` and its legacy profile reference to evaluate a
 * turn; a Tutor may be given neither. So they are supplied once, when the host
 * builds the runtime, and they never appear in `StudyTutorLaunch` or
 * `StudyTutorTurn` — there is no field in either for them to travel in, and
 * `STUDY_TUTOR_FORBIDDEN_KEYS` names both.
 *
 * THE LEARNER IDENTITY A TUTOR SEES IS DERIVED, NOT PASSED. `submit` computes
 * the per-session pseudonym from the turn's own `sessionRef` at the one call
 * site below. There is no parameter a caller could use to supply a different
 * one, so a host profile reference cannot arrive there by mistake.
 *
 * STALENESS IS RE-ASSERTED AFTER EVERY AWAIT, NOT ONCE AT THE TOP. A turn can
 * outlive its own authority: the launch, the safety evaluation and the bridge
 * work are each a real interval, and a learner switch, a logout, a grant expiry
 * or Study being turned off can land in any of them. A check at entry proves
 * only that the turn was authorized when it started.
 */
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  acceptStudyTutorResult,
  type StudyTutorLaunch,
  type StudyTutorRuntime,
  type StudyTutorTurn,
  type ValidatedStudyTutorResult,
} from '../contracts/tutor'
import type { StudyEventLedgerPort, StudySafetyPort } from '../ports'
import type { StudyRuntimeInterruption, StudyScope, StudySafetyResult, StudySubject } from '../types'
import type { StudyTaskType } from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import { runProductionTutorTurn, type StudyTutorAdapterResult } from './tutorAdapter'
import { studyTutorLearnerPresentation } from './tutorPresentation'
import { studyTutorLearnerPseudonym } from './tutorPseudonym'

export interface ProductionStudyTutorRuntimeDependencies {
  /**
   * Host-side identity for the host's OWN ports. None of it crosses to a Tutor:
   * the safety port and the event ledger are host services, and the adapter is
   * given only the pseudonym and the opaque references.
   */
  readonly scope: StudyScope
  readonly hostProfileRef: string
  readonly safety: StudySafetyPort
  readonly eventLedger: StudyEventLedgerPort
  /**
   * The host's lifecycle authority, asked again after every async boundary.
   * Supplied as a thunk rather than a snapshot precisely so that it is LIVE: a
   * boolean captured at construction would answer about the moment the runtime
   * was built, which is the staleness bug rather than the check for it.
   */
  readonly isCurrent: () => boolean
  /** The bridge's `sessionId`, already bounded by the host. */
  readonly bridgeSessionRef: string
}

/** Structural refusals this runtime raises before or around the adapter. */
export const STUDY_TUTOR_RUNTIME_REASON_CODES = Object.freeze({
  stale: 'stale-host-authority',
  pseudonymUnavailable: 'learner-pseudonym-unavailable',
  unsupportedSubject: 'tutor-subject-unsupported',
  unsupportedTask: 'tutor-task-type-unsupported',
  runtimeError: 'tutor-runtime-boundary-error',
  presentationRefused: 'tutor-visible-text-not-presentable',
})

/**
 * Host vocabulary to Tutor vocabulary. `null` rather than a throw, because an
 * unteachable subject is a structural quarantine and not a crash — the same
 * choice ../contracts/tutor/runtime.ts documents for `subject`.
 */
function bridgeSubject(subject: StudySubject): 'math' | 'english' | null {
  if (subject === 'math') return 'math'
  if (subject === 'reading' || subject === 'writing') return 'english'
  return null
}

/**
 * The bridge admits a narrower task set than the host's canonical one. The two
 * host task types with no Tutor equivalent are mapped exactly as the preview
 * facade maps them; everything outside the intersection is `null` and
 * quarantines rather than being guessed into the nearest neighbour.
 */
function bridgeTaskType(task: StudyTutorTurn['taskType']): StudyTaskType | null {
  if (
    task === 'retrieval-practice' ||
    task === 'direct-instruction' ||
    task === 'guided-practice' ||
    task === 'independent-practice' ||
    task === 'reflection' ||
    task === 'mastery-check'
  ) return task
  if (task === 'reading' || task === 'writing') return 'guided-practice'
  return null
}

function invalidSafetyResult(): StudySafetyResult {
  return { outcome: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }
}

const SESSION_AUTHORIZATION_REASONS: ReadonlySet<string> =
  new Set(['adult-authentication-rejected', 'study-session-rejected'])

/**
 * Exact and closed on both sides, and rebuilt in one pass — the same discipline
 * `narrowedInterruption` keeps in ../contracts/tutor/results.ts. Restated here
 * rather than shared because the host safety port's field is `unknown` at this
 * boundary and the contract's parser takes a whole result, not an interruption.
 */
function narrowedInterruption(value: unknown): StudyRuntimeInterruption | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate)
  const kind = candidate.kind
  if (kind === 'rate-limit' || kind === 'authorization-infrastructure') {
    return keys.length === 1 ? Object.freeze({ kind }) : null
  }
  if (kind !== 'session-authorization' || keys.length !== 2 || !Object.hasOwn(candidate, 'reason')) return null
  const reason = candidate.reason
  return typeof reason === 'string' && SESSION_AUTHORIZATION_REASONS.has(reason)
    ? Object.freeze({ kind, reason: reason as 'adult-authentication-rejected' | 'study-session-rejected' })
    : null
}

function validSafetyResult(value: unknown): value is StudySafetyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  if (Object.hasOwn(result, 'interruption')) {
    if (
      Object.keys(result).length !== 4 ||
      result.outcome !== 'invalid' ||
      narrowedInterruption(result.interruption) === null
    ) return false
  } else if (Object.keys(result).length !== 3) return false
  if (
    !['outcome', 'mayContinue', 'adultHelpState'].every((key) => Object.hasOwn(result, key)) ||
    !['urgent', 'uncertain', 'clear', 'invalid'].includes(String(result.outcome)) ||
    typeof result.mayContinue !== 'boolean'
  ) return false
  if (result.outcome === 'clear') return result.mayContinue === true && result.adultHelpState === 'not-needed'
  if (result.outcome === 'invalid') return result.mayContinue === false && result.adultHelpState === 'not-confirmed'
  return result.mayContinue === false && result.adultHelpState === 'proposed-not-delivered'
}

/**
 * Which bridge failures are structural and which are about the learner.
 *
 * Restated from `classifiedBridgeFailure` in ../runtimeFacade.ts, whose
 * derivation this keeps exactly: the pre-Core safety gateway runs first and
 * returns before anything downstream, so any status other than its own means
 * the gateway already cleared this learner's text. `stop-invalid-input` is the
 * one status both the gateway and the orchestrator emit, so it is split by the
 * gateway's own reason code.
 *
 * Anything unrecognised falls to the learner-safety side, which is the
 * direction a fail-closed host must miss in.
 */
const STRUCTURAL_BRIDGE_STATUSES: ReadonlySet<string> = new Set(['quarantined', 'duplicate-ignored'])
const STRUCTURAL_GATEWAY_REASONS: ReadonlySet<string> = new Set(['urgent-gateway-invalid-context'])

function classifiedBridgeFailure(
  inner: unknown,
): { readonly kind: 'structural' | 'learner-safety'; readonly reasonCode: string } {
  const candidate = (inner ?? {}) as { readonly status?: unknown; readonly reasonCode?: unknown }
  const status = candidate.status
  const reason = candidate.reasonCode
  const named = typeof status === 'string' ? status : 'unrecognised'
  if (STRUCTURAL_BRIDGE_STATUSES.has(named)) return { kind: 'structural', reasonCode: `bridge-${named}` }
  if (named === 'stop-invalid-input' && typeof reason === 'string' && STRUCTURAL_GATEWAY_REASONS.has(reason)) {
    return { kind: 'structural', reasonCode: `bridge-${reason}` }
  }
  return { kind: 'learner-safety', reasonCode: `bridge-${named}` }
}

export class ProductionStudyTutorRuntime implements StudyTutorRuntime {
  readonly contractVersion = STUDY_TUTOR_CONTRACT_VERSION

  constructor(private readonly dependencies: ProductionStudyTutorRuntimeDependencies) {}

  /**
   * Validates, and prepares NOTHING durable.
   *
   * That emptiness is the design. The host's durable preparation — calendar
   * start, the session-launched event, session persistence — belongs to the
   * host and happens after this promise settles, behind the `LaunchSettled`
   * witness in ./tutorLaunchOrdering.ts. If this method wrote durable state of
   * its own, the ordering the witness enforces would be enforcing the wrong
   * thing.
   *
   * It can and does reject. A rejection here is the case F1 exists for, and the
   * three checks below are the ones that can only be made at launch:
   *
   *  - the host's authority is current,
   *  - a per-session pseudonym can actually be produced on this platform, so a
   *    missing `crypto.subtle` refuses the SESSION rather than surfacing later
   *    as a quarantined turn once the block is already marked begun,
   *  - the day boundary the Tutor will reason with is well-formed.
   *
   * The references need no check: `sessionRef` and `lessonRef` are
   * `StudyTutorRef`, which only `parseStudyTutorRef` produces.
   */
  async launch(launch: StudyTutorLaunch): Promise<void> {
    if (!this.dependencies.isCurrent()) throw new Error('Study authority is not current for this Tutor launch.')
    if (!isIsoCalendarDate(launch.learnerLocalDate)) throw new Error('Tutor launch carries an invalid learner local date.')
    if (!isTimeZone(launch.householdTimeZone)) throw new Error('Tutor launch carries an invalid household time zone.')
    const pseudonym = await studyTutorLearnerPseudonym(launch.sessionRef)
    if (pseudonym === null) throw new Error('A per-session learner pseudonym could not be produced on this platform.')
    // Re-asserted after the digest, which is the only await above.
    if (!this.dependencies.isCurrent()) throw new Error('Study authority lapsed during the Tutor launch.')
  }

  /**
   * One learner turn, and the only path a Tutor result reaches the host on.
   *
   * Every return is `acceptStudyTutorResult(...)`. The raw value it is given is
   * built here as a plain object and typed `unknown` on the way in, so nothing
   * in this method has the type `ValidatedStudyTutorResult` until the parser
   * has produced it — there is no assertion, no `as unknown as`, and no brand
   * minted by hand. A shape this contract will not admit becomes `quarantined`
   * with a contract-parse code rather than reaching the host.
   */
  async submit(turn: StudyTutorTurn): Promise<ValidatedStudyTutorResult> {
    const { scope, hostProfileRef, safety, eventLedger, isCurrent, bridgeSessionRef } = this.dependencies
    if (!isCurrent()) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)

    const subject = bridgeSubject(turn.subject)
    if (subject === null) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.unsupportedSubject)
    const taskType = bridgeTaskType(turn.taskType)
    if (taskType === null) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.unsupportedTask)

    // D2 — derived here, from this turn's own session reference, and nowhere
    // else. No parameter of this method could carry a different one.
    const learnerPseudonym = await studyTutorLearnerPseudonym(turn.sessionRef)
    if (!isCurrent()) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)
    if (learnerPseudonym === null) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.pseudonymUnavailable)

    // The host's own pre-Tutor safety gate, upstream of and independent of the
    // bridge's. It is also where an authorization interruption is raised: an
    // unreachable verifier or a refused session arrives here and must NOT be
    // dressed up as anything about the learner.
    let inputSafety = invalidSafetyResult()
    if (safety.mode === 'production') {
      try {
        const candidate = await safety.evaluate({
          scope,
          requestRef: `${turn.requestRef}:learner-input`,
          studentRef: { kind: 'legacy-profile-id', value: hostProfileRef },
          contentKind: 'learner-input',
          transientText: turn.transientLearnerText,
        })
        inputSafety = validSafetyResult(candidate) ? candidate : invalidSafetyResult()
      } catch {
        inputSafety = invalidSafetyResult()
      }
    }
    if (!isCurrent()) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)
    if (inputSafety.outcome !== 'clear' || inputSafety.mayContinue !== true) {
      const interruption = narrowedInterruption(inputSafety.interruption)
      if (interruption) return acceptStudyTutorResult({ status: 'interrupted', interruption })
      return acceptStudyTutorResult({
        status: 'stopped',
        reasonCode: `mounted-input-safety-${inputSafety.outcome === 'clear' ? 'invalid' : inputSafety.outcome}`,
        deliveryStatus: inputSafety.adultHelpState === 'proposed-not-delivered'
          ? 'proposed-not-delivered'
          : 'not-confirmed',
      })
    }

    // Held from inside the output classifier below, exactly as the preview
    // facade does: the bridge's decision shape carries no interruption, so a
    // session refused BETWEEN the two safety checks would otherwise be lost and
    // shown as a safety stop about a child the classifier never judged.
    let outputInterruption: unknown
    let adapterResult: StudyTutorAdapterResult
    try {
      adapterResult = await runProductionTutorTurn(
        {
          requestRef: turn.requestRef,
          sessionRef: bridgeSessionRef,
          learnerPseudonym,
          lessonRef: turn.lessonRef,
          segmentRef: turn.segmentRef,
          skillRef: turn.skillRef,
          subject,
          taskType,
          transientLearnerText: turn.transientLearnerText,
          expectedAnswer: turn.expectedAnswer,
          occurredAt: turn.occurredAt,
          learnerLocalDate: turn.learnerLocalDate,
          householdTimeZone: turn.householdTimeZone,
        },
        {
          eventLedger: {
            appendAcceptedEvent: async (sessionId, eventId, eventVersion, idempotencyKey) => {
              // The durable accepted-event append. Both guards are here because
              // this is the one durable write inside the bridge, and a stale
              // epoch must not reach it: the bridge echoes back the identifier
              // it was given, so the first check is that this really is our
              // session, and the second is that our authority still holds.
              if (sessionId !== bridgeSessionRef || !isCurrent()) {
                return { status: 'idempotency-collision' as const }
              }
              const status = await eventLedger.append(scope, {
                eventRef: eventId,
                occurredAt: turn.occurredAt,
                type: 'tutor-directive',
                payload: { bridgeEventVersion: eventVersion, eventLedgerIdempotencyKey: idempotencyKey },
              })
              return { status }
            },
          },
          safety: { mode: 'production', classifier: PRECHECKED_CLASSIFIER },
          outputSafety: {
            classify: async (request) => {
              const candidate = await safety.evaluate({
                scope,
                requestRef: request.requestId,
                studentRef: { kind: 'legacy-profile-id', value: hostProfileRef },
                contentKind: 'tutor-output',
                transientText: request.transientTutorText,
              })
              const decision = validSafetyResult(candidate) ? candidate : invalidSafetyResult()
              // Reassigned on every call, so a later clear answer cannot
              // inherit an earlier refusal.
              outputInterruption = decision.interruption
              return {
                classification: decision.outcome,
                mayContinue: decision.mayContinue,
                adultHelpState: decision.adultHelpState,
              }
            },
          },
        },
      )
    } catch {
      return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.runtimeError)
    }

    // PHASE 16 — the last async boundary. A result that arrives for an epoch
    // the host has moved on from does zero further work: it cannot be shown, it
    // cannot be recorded, and it certainly cannot become a safety stop.
    if (!isCurrent()) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)

    if (adapterResult.status === 'wrapper-quarantined') {
      return this.#quarantined(adapterResult.reasonCode)
    }
    if (adapterResult.status === 'output-blocked') {
      const interruption = narrowedInterruption(outputInterruption)
      if (interruption) return acceptStudyTutorResult({ status: 'interrupted', interruption })
      return acceptStudyTutorResult({
        status: 'stopped',
        reasonCode: `mounted-tutor-output-safety-${adapterResult.classification}`,
        deliveryStatus: adapterResult.adultHelpState,
      })
    }
    if (adapterResult.status === 'stopped-or-quarantined') {
      const failure = classifiedBridgeFailure(adapterResult.result)
      if (failure.kind === 'structural') return this.#quarantined(failure.reasonCode)
      return acceptStudyTutorResult({
        status: 'stopped',
        reasonCode: failure.reasonCode,
        deliveryStatus: 'not-confirmed',
      })
    }

    const presentation = studyTutorLearnerPresentation(adapterResult.visibleText)
    if (presentation === null) return this.#quarantined(STUDY_TUTOR_RUNTIME_REASON_CODES.presentationRefused)
    // Oversized or empty prose is REJECTED here, never truncated: the parser
    // returns null and `acceptStudyTutorResult` quarantines. Truncating would
    // launder output the host had already decided it could not vouch for into a
    // shorter one it then treats as accepted.
    return acceptStudyTutorResult({
      status: 'accepted',
      eventRef: adapterResult.eventId,
      visibleText: presentation.visibleText,
    })
  }

  #quarantined(reasonCode: string): ValidatedStudyTutorResult {
    return acceptStudyTutorResult({ status: 'quarantined', reasonCode })
  }
}

/**
 * The host has already cleared this learner's text through its own safety port
 * above, so the bridge's gateway is given a classifier that says so rather than
 * a second, different opinion. The gateway's own reviewed deterministic layer
 * still runs on top of this and may still escalate — see
 * `toLayeredSafetyConfiguration` — so this does not weaken the gateway; it
 * avoids classifying the same text twice with two different classifiers.
 */
const PRECHECKED_CLASSIFIER_VERSION = 'mounted-http-prechecked-clear-v1'
const PRECHECKED_CLASSIFIER = {
  classifierVersion: PRECHECKED_CLASSIFIER_VERSION,
  classify: () => ({
    classificationVersion: 1 as const,
    classifierVersion: PRECHECKED_CLASSIFIER_VERSION,
    outcome: 'clear' as const,
    categories: [],
    reasonCodes: [PRECHECKED_CLASSIFIER_VERSION],
  }),
}

/** `YYYY-MM-DD`, and a date that exists. Mirrors the bridge's `isISODate`. */
function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** An IANA zone this platform actually knows. Mirrors the bridge's `isIanaTimeZone`. */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}
