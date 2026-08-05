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
import type {
  HostStudyLaunchContext,
  StudyCalendarEntry,
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
      result.minimizedProjection.evidence.sessionId !== scope.sessionRef
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

function validSafetyResult(value: unknown): value is StudySafetyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  if (
    Object.keys(result).length !== 3 ||
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
      sessionId: sessionRef,
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
        if (sessionId !== input.scope.sessionRef || (input.isCurrentBinding && !input.isCurrentBinding())) {
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
    let result: SafeTutorBridgeResult
    try {
      result = await submitStudentTurn(
        {
          requestId: input.requestRef,
          sessionId: input.scope.sessionRef,
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
