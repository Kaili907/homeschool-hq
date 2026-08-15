import type { StudyPortBundle } from './ports'
import type { StudyCalendarEntry, StudyScope } from './types'

export const STUDY_PROGRESSION_AUTHORITY_INVARIANTS = Object.freeze({
  TUTOR_CAN_COMPLETE_STUDY_SEGMENT: false,
  TUTOR_CAN_DECLARE_OFFICIAL_MASTERY: false,
  TUTOR_CAN_CHANGE_WORKING_LEVEL: false,
  TUTOR_CAN_CHANGE_NOMINAL_GRADE: false,
  TUTOR_CAN_ASSIGN_CURRICULUM: false,
  TUTOR_RECOMMENDATION_IS_ADVISORY: true,
  STUDY_PROGRESSION_DECISION_REQUIRED: true,
  STUDY_ENGINE_REMAINS_AUTHORITY: true,
} as const)

export type StudyTutorAdvisory =
  | {
      readonly status: 'accepted'
      readonly eventRef: string
      readonly directive: 'continue' | 'reteach'
    }
  | { readonly status: 'stopped' }
  | { readonly status: 'quarantined' }
  | { readonly status: 'invalid' }
  | { readonly status: 'rejected' }

export interface StudyProgressionPolicyInput {
  readonly entry: StudyCalendarEntry
  readonly segmentRef: string
  readonly tutorAdvisory: StudyTutorAdvisory | null
  readonly bindingIsCurrent: boolean
  readonly safetyStopped: boolean
}

export type StudyProgressionDecision =
  | {
      readonly decision: 'ADVANCE'
      readonly authority: 'study'
      readonly reasonCode: 'accepted-tutor-continue' | 'completion-only'
    }
  | {
      readonly decision: 'HOLD'
      readonly authority: 'study'
      readonly reasonCode:
        | 'accepted-tutor-reteach'
        | 'tutor-stopped'
        | 'tutor-quarantined'
        | 'tutor-invalid'
        | 'tutor-rejected'
        | 'missing-tutor-advisory'
        | 'unexpected-tutor-advisory'
        | 'stale-binding'
        | 'safety-stop'
        | 'non-active-study-state'
        | 'non-current-segment'
    }

export type StudyProgressionPolicy = (input: StudyProgressionPolicyInput) => StudyProgressionDecision

const hold = (reasonCode: Extract<StudyProgressionDecision, { decision: 'HOLD' }>['reasonCode']): StudyProgressionDecision => ({
  decision: 'HOLD',
  authority: 'study',
  reasonCode,
})

/**
 * The one mounted Study progression policy. Tutor output is an advisory input;
 * this Study-owned decision is the only object that can authorize mutation.
 */
export const decideStudyProgression: StudyProgressionPolicy = (input) => {
  if (!input.bindingIsCurrent) return hold('stale-binding')
  if (input.safetyStopped) return hold('safety-stop')
  if (input.entry.state !== 'active') return hold('non-active-study-state')
  const currentSegment = input.entry.segments.find(
    (segment) => !input.entry.completedSegmentRefs.includes(segment.segmentRef),
  )
  if (!currentSegment || currentSegment.segmentRef !== input.segmentRef) return hold('non-current-segment')

  // Completion-only means Study records that the assigned activity was done;
  // no Tutor recommendation or mastery claim participates. Tutor-advised work
  // instead requires an accepted `continue` recommendation, but Study still
  // owns the final decision after checking canonical state, binding, and safety.
  if (input.entry.masteryAuthority === 'completion-only') {
    return input.tutorAdvisory === null
      ? { decision: 'ADVANCE', authority: 'study', reasonCode: 'completion-only' }
      : hold('unexpected-tutor-advisory')
  }

  const advisory = input.tutorAdvisory
  if (!advisory) return hold('missing-tutor-advisory')
  if (advisory.status === 'stopped') return hold('tutor-stopped')
  if (advisory.status === 'quarantined') return hold('tutor-quarantined')
  if (advisory.status === 'invalid') return hold('tutor-invalid')
  if (advisory.status === 'rejected') return hold('tutor-rejected')
  if (advisory.directive === 'reteach') return hold('accepted-tutor-reteach')
  return { decision: 'ADVANCE', authority: 'study', reasonCode: 'accepted-tutor-continue' }
}

export interface ApplyStudyProgressionInput extends StudyProgressionPolicyInput {
  readonly ports: StudyPortBundle
  readonly scope: StudyScope
  readonly occurredAt: string
  readonly policy?: StudyProgressionPolicy
}

export interface AppliedStudyProgression {
  readonly decision: StudyProgressionDecision
  readonly entry: StudyCalendarEntry
  readonly replayed: boolean
}

export interface RecoverStudyCompletionInput {
  readonly ports: StudyPortBundle
  readonly scope: StudyScope
  readonly entry: StudyCalendarEntry
  readonly occurredAt: string
}

function acceptedEventRef(advisory: StudyTutorAdvisory | null): string | null {
  return advisory?.status === 'accepted' ? advisory.eventRef : null
}

export async function applyStudyProgression(input: ApplyStudyProgressionInput): Promise<AppliedStudyProgression> {
  const decision = (input.policy ?? decideStudyProgression)(input)
  if (decision.decision === 'HOLD') return { decision, entry: input.entry, replayed: false }

  const canonical = (await input.ports.calendar.list(input.scope)).find(
    (candidate) => candidate.blockRef === input.entry.blockRef,
  )
  if (!canonical) throw new Error('Study progression rejected: canonical calendar block is unavailable.')
  if (canonical.completedSegmentRefs.includes(input.segmentRef)) {
    return { decision, entry: canonical, replayed: true }
  }

  const decisionRef = `study-progression:${input.scope.sessionRef}:${input.segmentRef}`
  const appendResult = await input.ports.eventLedger.append(input.scope, {
    eventRef: decisionRef,
    occurredAt: input.occurredAt,
    type: 'study-progression-decision',
    payload: {
      decision: decision.decision,
      basis: decision.reasonCode,
      segmentRef: input.segmentRef,
    },
  })
  if (appendResult === 'idempotency-collision') {
    throw new Error('Study progression rejected: decision evidence collision.')
  }

  const tutorEventRef = acceptedEventRef(input.tutorAdvisory)
  await input.ports.persistence.saveSession({
    scope: input.scope,
    lessonRef: input.entry.lessonRef,
    segmentRef: input.segmentRef,
    status: 'active',
    updatedAt: input.occurredAt,
    lastAcceptedEventRef: tutorEventRef,
    lastProgressionDecisionRef: decisionRef,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })

  const next = await input.ports.calendar.completeCurrentSegment(
    input.scope,
    input.entry.blockRef,
    input.segmentRef,
    input.occurredAt,
  )
  const status = next.state === 'completed' ? 'completed' : 'active'
  if (status === 'completed') {
    const completionResult = await input.ports.eventLedger.append(input.scope, {
      eventRef: `completion:${input.scope.sessionRef}:${input.entry.lessonRef}`,
      occurredAt: input.occurredAt,
      type: 'session-completed',
      payload: { blockRef: input.entry.blockRef, lessonRef: input.entry.lessonRef },
    })
    if (completionResult === 'idempotency-collision') {
      throw new Error('Study progression rejected: completion evidence collision.')
    }
  }
  await input.ports.persistence.saveSession({
    scope: input.scope,
    lessonRef: input.entry.lessonRef,
    segmentRef: input.segmentRef,
    status,
    updatedAt: input.occurredAt,
    lastAcceptedEventRef: tutorEventRef,
    lastProgressionDecisionRef: decisionRef,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
  return { decision, entry: next, replayed: false }
}

/**
 * Reconciles only the narrow crash window after canonical calendar completion.
 * The minimized Study decision and, where applicable, Tutor event are read back
 * and verified before the terminal event and snapshot are written.
 */
export async function recoverAuthorizedStudyCompletion(input: RecoverStudyCompletionInput): Promise<void> {
  if (input.entry.state !== 'completed') throw new Error('Study completion recovery requires a completed calendar block.')
  const snapshot = await input.ports.persistence.loadSession(input.scope)
  if (snapshot?.status === 'completed') return
  if (
    snapshot?.status !== 'active' ||
    !snapshot.lastProgressionDecisionRef ||
    !input.entry.completedSegmentRefs.includes(snapshot.segmentRef)
  ) throw new Error('Study completion recovery rejected: authorized active snapshot is unavailable.')

  const decision = await input.ports.eventLedger.read(input.scope, snapshot.lastProgressionDecisionRef)
  const expectedBasis = input.entry.masteryAuthority === 'completion-only'
    ? 'completion-only'
    : 'accepted-tutor-continue'
  if (
    decision?.type !== 'study-progression-decision' ||
    decision.payload.decision !== 'ADVANCE' ||
    decision.payload.basis !== expectedBasis ||
    decision.payload.segmentRef !== snapshot.segmentRef
  ) throw new Error('Study completion recovery rejected: progression decision evidence is invalid.')

  if (input.entry.masteryAuthority !== 'completion-only') {
    if (!snapshot.lastAcceptedEventRef) {
      throw new Error('Study completion recovery rejected: Tutor evidence is unavailable.')
    }
    const tutorEvent = await input.ports.eventLedger.read(input.scope, snapshot.lastAcceptedEventRef)
    if (tutorEvent?.type !== 'tutor-directive') {
      throw new Error('Study completion recovery rejected: Tutor evidence is invalid.')
    }
  }

  const completionResult = await input.ports.eventLedger.append(input.scope, {
    eventRef: `completion:${input.scope.sessionRef}:${input.entry.lessonRef}`,
    occurredAt: input.occurredAt,
    type: 'session-completed',
    payload: { blockRef: input.entry.blockRef, lessonRef: input.entry.lessonRef },
  })
  if (completionResult === 'idempotency-collision') {
    throw new Error('Study completion recovery rejected: completion evidence collision.')
  }
  await input.ports.persistence.saveSession({
    ...snapshot,
    status: 'completed',
    updatedAt: input.occurredAt,
  })
}
