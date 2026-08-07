import {
  launchStudentSession,
  submitStudentTurn,
  type SafeTutorBridgeRequest,
  type SafeTutorBridgeResult,
  type StudentSessionLaunch,
} from '../../adaptive-tutor/study-engine/runtime/src/student.ts'
import type { AcceptedEventLedgerPort } from '../../adaptive-tutor/study-engine/runtime/src/ledger.ts'
import type { UrgentSafetyClassifierPort } from '../../adaptive-tutor/study-engine/runtime/src/safety.ts'
import { assertCompleteStudyPortBundle, type StudyPortBundle } from './ports'
import { assertAcceptedStudyRuntime } from './runtimeCompatibility'
import { learnerSafeResult } from './safety/learnerSafe'
import { recordLocalPreAcceptanceSafetyStop } from './safety/localStopLedger'
import { studyBridgeSessionRef } from './studyBridgeSessionRef'
import type {
  HostStudyLaunchContext,
  StudyCalendarEntry,
  StudyRuntimeInterruption,
  StudySafetyResult,
  StudyScope,
} from './types'

const RC1_LOCAL_LEARNER_SENTINEL = 'learner:local-release-candidate'

export interface StudyTutorTurnInput {
  readonly context: HostStudyLaunchContext
  readonly entry: StudyCalendarEntry
  readonly scope: StudyScope
  readonly requestRef: string
  readonly segmentRef: string
  readonly transientLearnerText: string
  readonly expectedAnswer: string
  readonly occurredAt: string
  readonly isCurrentBinding?: () => boolean
}

export type StudyTutorTurnResult =
  | {
      readonly status: 'accepted'
      readonly eventRef: string
      readonly directive: 'continue' | 'reteach'
      readonly reasonCode: string
      readonly presentation: {
        readonly visibleText: string
        readonly captionsAlwaysVisible: true
        readonly lessonMayContinueWithoutMedia: true
        readonly transcriptIncluded: false
      }
    }
  | {
      readonly status: 'stopped'
      readonly reasonCode: string
      readonly coreSubmitInvocations: 0 | 1
      readonly classification: 'urgent' | 'uncertain' | 'invalid'
      readonly deliveryStatus: 'proposed-not-delivered' | 'not-confirmed'
      readonly studentMessage: string
    }
  /**
   * The turn could not be evaluated, and the reason was not the learner. This
   * deliberately carries no classification, reason code, delivery status,
   * student message, identifier or server detail: there is nothing to record
   * about this child, so there is nothing here for a caller to record.
   * `coreSubmitInvocations` is kept only so a caller can see whether Tutor Core
   * ran before the refusal — 0 whenever the learner's own input was refused,
   * which is every case except a session refused between the two safety checks.
   */
  | {
      readonly status: 'interrupted'
      readonly interruption: StudyRuntimeInterruption
      readonly coreSubmitInvocations: 0 | 1
    }
  | { readonly status: 'quarantined'; readonly reasonCode: string }

export class Rc1LocalLearnerBindingAdapter {
  readonly label = 'LOCAL DEVELOPMENT ONLY — RC1 SENTINEL IDENTITY REPROJECTION'
  readonly #sessions = new Map<string, string>()

  bind(scope: StudyScope): void {
    const binding = `${scope.householdRef}|${scope.learnerRef}`
    const previous = this.#sessions.get(scope.sessionRef)
    if (previous && previous !== binding) throw new Error('RC1 session identity binding mismatch.')
    this.#sessions.set(scope.sessionRef, binding)
  }

  verifyAccepted(scope: StudyScope, result: Extract<SafeTutorBridgeResult, { status: 'accepted' }>): void {
    this.bind(scope)
    if (
      result.bridgeVersion !== '1.0.1' ||
      result.bridgeContractVersion !== 1 ||
      result.minimizedProjection.evidence.studentId !== RC1_LOCAL_LEARNER_SENTINEL ||
      // The projection echoes the identifier the bridge was GIVEN, so this must
      // ask for the same one — the durable session reference is not what
      // crossed the boundary. `this.#sessions` above still keys on the durable
      // reference: that map is the host's own identity binding, not transport.
      result.minimizedProjection.evidence.sessionId !== studyBridgeSessionRef(scope.sessionRef)
    ) {
      throw new Error('RC1 accepted result identity or version mismatch; projection quarantined.')
    }
  }
}

function subjectForBridge(subject: HostStudyLaunchContext['subject']): SafeTutorBridgeRequest['subject'] {
  if (subject === 'math') return 'math'
  if (subject === 'reading' || subject === 'writing') return 'english'
  throw new Error('This Study task has no Tutor bridge subject mapping.')
}

function taskForBridge(task: StudyCalendarEntry['segments'][number]['taskType']): SafeTutorBridgeRequest['taskType'] {
  if (
    task === 'retrieval-practice' ||
    task === 'direct-instruction' ||
    task === 'guided-practice' ||
    task === 'independent-practice' ||
    task === 'reflection' ||
    task === 'mastery-check'
  ) return task
  if (task === 'reading' || task === 'writing') return 'guided-practice'
  throw new Error('This Study task is completion-only and cannot be cast into a Tutor Core task.')
}

const PRECHECKED_CLASSIFIER_VERSION = 'mounted-http-prechecked-clear-v1'

function invalidSafetyResult(): StudySafetyResult {
  return {
    outcome: 'invalid',
    mayContinue: false,
    adultHelpState: 'not-confirmed',
  }
}

type StudySessionAuthorizationReason =
  Extract<StudyRuntimeInterruption, { kind: 'session-authorization' }>['reason']

const SESSION_AUTHORIZATION_REASONS: ReadonlySet<string> =
  new Set<StudySessionAuthorizationReason>(['adult-authentication-rejected', 'study-session-rejected'])

/** Narrows to the reason union, so only a checked primitive can be kept. */
function isSessionAuthorizationReason(value: unknown): value is StudySessionAuthorizationReason {
  return typeof value === 'string' && SESSION_AUTHORIZATION_REASONS.has(value)
}

/**
 * Exact, and closed on both sides: an unrecognised kind, an unrecognised reason,
 * a missing reason, and any extra field are all rejected.
 *
 * STUDY-A1-COMP Phase 10 — validates and rebuilds in ONE pass, returning the
 * frozen copy or null.
 *
 * The type check comes first and membership is asked of the primitive itself.
 * Coercing with String() let an object whose `toString` returned an approved
 * code through, and the object that was admitted — not the code it printed —
 * then travelled onward as the reason. Anything it closed over went with it.
 *
 * Validating and rebuilding together is what makes that hold. Each field is read
 * exactly once and the value that is KEPT is the value that was CHECKED, so an
 * own accessor cannot answer the check with an approved string and then hand
 * something else to whatever is built afterwards. Only primitives leave here.
 *
 * Null means "not an interruption", which is not an error: it simply is not
 * honoured, leaving the result on the true safety-stop path. That is the safer
 * direction — the worst outcome of over-rejecting is a stop a parent has to
 * clear, while the worst outcome of under-rejecting is a real safety stop
 * silently downgraded.
 */
function narrowedInterruption(value: unknown): StudyRuntimeInterruption | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate)
  const kind = candidate.kind
  if (kind === 'rate-limit') return keys.length === 1 ? Object.freeze({ kind: 'rate-limit' as const }) : null
  if (kind !== 'session-authorization' || keys.length !== 2 || !Object.hasOwn(candidate, 'reason')) return null
  const reason = candidate.reason
  return isSessionAuthorizationReason(reason)
    ? Object.freeze({ kind: 'session-authorization' as const, reason })
    : null
}

/** Exact, and closed on both sides: see `narrowedInterruption`. */
function validInterruption(value: unknown): value is StudyRuntimeInterruption {
  return narrowedInterruption(value) !== null
}

function validSafetyResult(value: unknown): value is StudySafetyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  // An interruption may accompany a fail-closed `invalid` result and nothing
  // else, so a port cannot use one to soften a real flag or to buy a learner
  // past the safety gate.
  if (Object.hasOwn(result, 'interruption')) {
    if (
      Object.keys(result).length !== 4 ||
      result.outcome !== 'invalid' ||
      !validInterruption(result.interruption)
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

function stoppedResult(
  classification: 'urgent' | 'uncertain' | 'invalid',
  reasonCode: string,
  coreSubmitInvocations: 0 | 1,
  deliveryStatus: 'proposed-not-delivered' | 'not-confirmed',
): Extract<StudyTutorTurnResult, { readonly status: 'stopped' }> {
  return {
    status: 'stopped',
    reasonCode,
    coreSubmitInvocations,
    classification,
    deliveryStatus,
    studentMessage: learnerSafeResult(classification).message,
  }
}

export class AcceptedRc1HostRuntime {
  readonly #identity = new Rc1LocalLearnerBindingAdapter()

  constructor(private readonly ports: Partial<StudyPortBundle>) {}

  launch(context: HostStudyLaunchContext, entry: StudyCalendarEntry, sessionRef: string): StudentSessionLaunch {
    assertAcceptedStudyRuntime()
    assertCompleteStudyPortBundle(this.ports)
    if (entry.learnerRef !== context.learnerRef) throw new Error('Wrong learner calendar block rejected.')
    const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef }
    this.#identity.bind(scope)
    return launchStudentSession({
      sessionId: studyBridgeSessionRef(sessionRef),
      lessonId: entry.lessonRef,
      calendarBlockId: entry.blockRef,
      householdTimeZone: context.householdTimeZone,
      learnerLocalDate: context.learnerLocalDate,
    })
  }

  async submit(input: StudyTutorTurnInput): Promise<StudyTutorTurnResult> {
    assertAcceptedStudyRuntime()
    assertCompleteStudyPortBundle(this.ports)
    const ports = this.ports
    if (input.entry.learnerRef !== input.context.learnerRef || input.scope.learnerRef !== input.context.learnerRef) {
      return { status: 'quarantined', reasonCode: 'identity-binding-mismatch' }
    }
    if (input.isCurrentBinding && !input.isCurrentBinding()) {
      return { status: 'quarantined', reasonCode: 'stale-host-binding' }
    }
    this.#identity.bind(input.scope)
    const segment = input.entry.segments.find((candidate) => candidate.segmentRef === input.segmentRef)
    if (!segment) return { status: 'quarantined', reasonCode: 'unknown-segment' }

    const safetyPort = ports.safety
    let inputSafety = invalidSafetyResult()
    if (safetyPort.mode === 'production') {
      try {
        const candidate = await safetyPort.evaluate({
          scope: input.scope,
          requestRef: `${input.requestRef}:learner-input`,
          studentRef: { kind: 'legacy-profile-id', value: input.context.hostProfileRef },
          contentKind: 'learner-input',
          transientText: input.transientLearnerText,
        })
        inputSafety = validSafetyResult(candidate) ? candidate : invalidSafetyResult()
      } catch {
        inputSafety = invalidSafetyResult()
      }
    }
    if (inputSafety.outcome !== 'clear' || inputSafety.mayContinue !== true) {
      // A refused session or a shed request is not a stop. It is returned
      // before any safety bookkeeping, so nothing durable is written and the
      // caller has no stop-shaped result it could write one from. Tutor Core
      // has not been reached at this point.
      // One read of the port's field, narrowed in the same pass. A null falls
      // through to the genuine safety-stop path below.
      const interruption = narrowedInterruption(inputSafety.interruption)
      if (interruption) {
        return { status: 'interrupted', interruption, coreSubmitInvocations: 0 }
      }
      const classification = inputSafety.outcome === 'clear' ? 'invalid' : inputSafety.outcome
      if (safetyPort.mode !== 'production') {
        await recordLocalPreAcceptanceSafetyStop({
          occurredAt: input.occurredAt,
          studentRef: input.scope.learnerRef,
          sessionRef: input.scope.sessionRef,
          failureMode: 'non-production-safety-port',
          serverCaptureStatus: 'server-not-contacted',
        })
      }
      return stoppedResult(
        classification,
        `mounted-input-safety-${classification}`,
        0,
        inputSafety.adultHelpState === 'proposed-not-delivered'
          ? 'proposed-not-delivered'
          : 'not-confirmed',
      )
    }
    // STUDY-A1-SESSIONREF-C. Bounded here, at the one seam that calls the
    // bridge, rather than at each caller: the durable `scope.sessionRef` stays
    // whole everywhere else in this method — the safety port, the event ledger,
    // persistence and the identity binding all still use it — and only what
    // crosses the bridge is bounded.
    const bridgeSessionRef = studyBridgeSessionRef(input.scope.sessionRef)
    const classifier: UrgentSafetyClassifierPort = {
      classifierVersion: PRECHECKED_CLASSIFIER_VERSION,
      classify: () => ({
        classificationVersion: 1,
        classifierVersion: PRECHECKED_CLASSIFIER_VERSION,
        outcome: 'clear',
        categories: [],
        reasonCodes: [PRECHECKED_CLASSIFIER_VERSION],
      }),
    }
    const eventLedger: AcceptedEventLedgerPort = {
      appendAcceptedEvent: async (sessionId, eventId, eventVersion, idempotencyKey) => {
        // The bridge hands back the identifier it was given, so this compares
        // against that one. The append below is still scoped by the durable
        // `input.scope`, which is what the host event ledger is keyed on.
        if (sessionId !== bridgeSessionRef || (input.isCurrentBinding && !input.isCurrentBinding())) {
          return { status: 'idempotency-collision' as const }
        }
        const status = await ports.eventLedger.append(input.scope, {
          eventRef: eventId,
          occurredAt: input.occurredAt,
          type: 'tutor-directive',
          payload: { bridgeEventVersion: eventVersion, eventLedgerIdempotencyKey: idempotencyKey },
        })
        return { status }
      },
    }
    let outputInterruption: StudyRuntimeInterruption | undefined
    let result: SafeTutorBridgeResult
    try {
      result = await submitStudentTurn(
        {
          requestId: input.requestRef,
          sessionId: bridgeSessionRef,
          lessonId: input.entry.lessonRef,
          segmentId: input.segmentRef,
          subject: subjectForBridge(input.context.subject),
          skillId: input.context.skillRefs[0] ?? `${input.entry.lessonRef}:completion`,
          transientLearnerText: input.transientLearnerText,
          expectedAnswer: input.expectedAnswer,
          occurredAt: input.occurredAt,
          learnerLocalDate: input.context.learnerLocalDate,
          householdTimeZone: input.context.householdTimeZone,
          taskType: taskForBridge(segment.taskType),
        },
        eventLedger,
        {
          safety: { mode: 'production', classifier },
          outputSafety: {
            classify: async (request) => {
              const candidate = await safetyPort.evaluate({
                scope: input.scope,
                requestRef: request.requestId,
                studentRef: { kind: 'legacy-profile-id', value: input.context.hostProfileRef },
                contentKind: 'tutor-output',
                transientText: request.transientTutorText,
              })
              const decision = validSafetyResult(candidate) ? candidate : invalidSafetyResult()
              // The bridge's decision shape carries no interruption, so it is
              // kept here instead. Reassigned on every call, so a later clear
              // answer cannot inherit an earlier refusal.
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
      return { status: 'quarantined', reasonCode: 'runtime-boundary-error' }
    }
    if (input.isCurrentBinding && !input.isCurrentBinding()) {
      return { status: 'quarantined', reasonCode: 'stale-host-binding' }
    }
    if (result.status === 'output-blocked') {
      // The session can be refused between the learner-input check and the
      // Tutor-output one. Tutor Core has run by then and its text is discarded
      // either way, but the refusal is still a lifecycle event: dressing it up
      // as a safety stop would tell this child's parent she wrote something
      // unsafe when the classifier never judged her at all.
      const interruption = narrowedInterruption(outputInterruption)
      if (interruption) {
        return { status: 'interrupted', interruption, coreSubmitInvocations: 1 }
      }
      return stoppedResult(
        result.classification,
        `mounted-tutor-output-safety-${result.classification}`,
        1,
        result.adultHelpState,
      )
    }
    if (result.status !== 'accepted') {
      return stoppedResult(
        'invalid',
        `bridge-${result.result.status}`,
        result.coreSubmitInvocations,
        'not-confirmed',
      )
    }
    try {
      this.#identity.verifyAccepted(input.scope, result)
    } catch {
      return { status: 'quarantined', reasonCode: 'accepted-projection-identity-mismatch' }
    }
    const visibleText = result.directive === 'continue'
      ? 'Your Tutor Core check was accepted. Continue to the next planned step.'
      : 'Your Tutor Core check was accepted. Let’s try this step with a different example.'
    await ports.persistence.saveSession({
      scope: input.scope,
      lessonRef: input.entry.lessonRef,
      segmentRef: input.segmentRef,
      status: 'active',
      updatedAt: input.occurredAt,
      lastAcceptedEventRef: result.eventId,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })
    return {
      status: 'accepted',
      eventRef: result.eventId,
      directive: result.directive,
      reasonCode: result.reasonCode,
      presentation: {
        visibleText,
        captionsAlwaysVisible: true,
        lessonMayContinueWithoutMedia: true,
        transcriptIncluded: false,
      },
    }
  }
}
