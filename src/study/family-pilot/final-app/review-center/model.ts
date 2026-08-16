import type { FamilyPilotAssignmentRecordV1 } from '../../core'
import type { FinalFamilyPilotAttestationRecord } from '../../final-composition'
import type { SafetyHoldV1 } from '../../safety'
import type {
  FinalFamilyPilotAssessmentAssignment,
  FinalFamilyPilotSavedSession,
} from '../state'

export type ParentReviewKind =
  | 'PENDING_SCORING'
  | 'GUARDIAN_REVIEW'
  | 'MANUAL_REVIEW'
  | 'SAFETY_ACTION'
  | 'COMPLETED'

export interface ParentReviewCenterItem {
  readonly itemRef: string
  readonly studentRef: string
  readonly assignmentRef: string | null
  readonly kind: ParentReviewKind
  readonly title: string
  readonly state: string
  readonly when: string
  readonly result: string
  readonly next: string
  readonly action:
    | 'NONE'
    | 'CERTIFY_ASSESSMENT'
    | 'COMPLETE_MANUAL_REVIEW'
    | 'CERTIFY_PHYSICAL_COMPLETION'
    | 'CLEAR_SAFETY_HOLD'
}

export interface ParentReviewCenterModel {
  readonly studentRef: string
  readonly reviewQueue: readonly ParentReviewCenterItem[]
  readonly pendingScoring: readonly ParentReviewCenterItem[]
  readonly guardianReview: readonly ParentReviewCenterItem[]
  readonly manualReview: readonly ParentReviewCenterItem[]
  readonly safetyActions: readonly ParentReviewCenterItem[]
  readonly completedHistory: readonly ParentReviewCenterItem[]
}

export interface ParentReviewCenterInput {
  readonly studentRef: string
  readonly assessments: readonly FinalFamilyPilotAssessmentAssignment[]
  readonly attestations: readonly FinalFamilyPilotAttestationRecord[]
  readonly safetyHolds: readonly SafetyHoldV1[]
  readonly sessions: readonly FinalFamilyPilotSavedSession[]
  readonly assignments: readonly FamilyPilotAssignmentRecordV1[]
}

function assessmentPending(
  assessment: FinalFamilyPilotAssessmentAssignment,
  kind: Exclude<ParentReviewKind, 'SAFETY_ACTION' | 'COMPLETED'>,
): ParentReviewCenterItem {
  const copy = kind === 'PENDING_SCORING'
    ? {
        state: 'Waiting for trusted scoring',
        result: 'No grade has been awarded.',
        next: 'Trusted scoring must finish. Other subjects remain available.',
        action: 'NONE' as const,
      }
    : kind === 'MANUAL_REVIEW'
      ? {
          state: 'Waiting for manual review',
          result: 'No rubric result has been recorded.',
          next: 'Review with the existing authorized rubric, then record completion.',
          action: 'COMPLETE_MANUAL_REVIEW' as const,
        }
      : {
          state: 'Waiting for guardian certification',
          result: 'Learner completion is not yet certified.',
          next: 'A parent or guardian must certify the completion.',
          action: 'CERTIFY_ASSESSMENT' as const,
        }
  return Object.freeze({
    itemRef: assessment.assignmentRef,
    studentRef: assessment.studentRef,
    assignmentRef: assessment.assignmentRef,
    kind,
    title: assessment.title,
    when: assessment.updatedAt,
    ...copy,
  })
}

function attestationTitle(
  attestation: FinalFamilyPilotAttestationRecord,
  assignments: readonly FamilyPilotAssignmentRecordV1[],
): string {
  return assignments.find((item) => item.assignmentRef === attestation.assignmentRef)?.title
    ?? 'Physical completion'
}

function completedAssessment(assessment: FinalFamilyPilotAssessmentAssignment): ParentReviewCenterItem {
  const result = assessment.authorityClass === 'AUTO_SCOREABLE'
    ? 'Trusted scoring completed.'
    : assessment.authorityClass === 'RUBRIC_REQUIRED'
      ? 'Authorized manual review completed.'
      : assessment.authorityClass === 'GUARDIAN_REQUIRED'
        ? 'Guardian certification completed.'
        : 'Completion recorded.'
  return Object.freeze({
    itemRef: assessment.assignmentRef,
    studentRef: assessment.studentRef,
    assignmentRef: assessment.assignmentRef,
    kind: 'COMPLETED',
    title: assessment.title,
    state: 'Completed',
    when: assessment.completedAt ?? assessment.updatedAt,
    result,
    next: 'The learner is ready to continue.',
    action: 'NONE',
  })
}

function sortNewestFirst(items: readonly ParentReviewCenterItem[]): readonly ParentReviewCenterItem[] {
  return Object.freeze([...items].sort((left, right) => right.when.localeCompare(left.when)))
}

/**
 * Builds an adult-only, response-free projection for one exact student. It
 * consumes only minimized status metadata; learner answers and restricted
 * rubric/scoring material are not accepted by this boundary.
 */
export function deriveParentReviewCenter(input: ParentReviewCenterInput): ParentReviewCenterModel {
  const assessments = input.assessments.filter((item) => item.studentRef === input.studentRef)
  const attestations = input.attestations.filter((item) => item.studentRef === input.studentRef)
  const holds = input.safetyHolds.filter((item) => item.studentRef === input.studentRef)
  const sessions = input.sessions.filter((item) => item.studentRef === input.studentRef)
  // Core stores assignments inside an already student-scoped record, so these
  // rows do not carry a duplicate studentRef field.
  const assignments = input.assignments

  const pendingScoring = assessments
    .filter((item) => item.status === 'PENDING_ASSESSMENT')
    .map((item) => assessmentPending(item, 'PENDING_SCORING'))
  const guardianReview = [
    ...assessments
      .filter((item) => item.status === 'PENDING_GUARDIAN_ATTESTATION')
      .map((item) => assessmentPending(item, 'GUARDIAN_REVIEW')),
    ...attestations
      .filter((item) => item.status === 'PENDING_GUARDIAN_ATTESTATION')
      .map((item): ParentReviewCenterItem => Object.freeze({
        itemRef: `${item.assignmentRef}:${item.sessionRef}`,
        studentRef: item.studentRef,
        assignmentRef: item.assignmentRef,
        kind: 'GUARDIAN_REVIEW',
        title: attestationTitle(item, assignments),
        state: 'Waiting for guardian certification',
        when: item.learnerAssertedAt,
        result: 'Physical completion is not yet certified.',
        next: 'Choose observed completion or the equal-credit simulated alternative.',
        action: 'CERTIFY_PHYSICAL_COMPLETION',
      })),
  ]
  const manualReview = assessments
    .filter((item) => item.status === 'ADULT_REVIEW_REQUIRED')
    .map((item) => assessmentPending(item, 'MANUAL_REVIEW'))
  const safetyActions = holds
    .filter((item) => item.status !== 'cleared')
    .map((item): ParentReviewCenterItem => {
      const session = sessions.find((candidate) => candidate.session.sessionRef === item.sessionRef)
      const assignment = assignments.find((candidate) => candidate.assignmentRef === session?.assignmentRef)
      return Object.freeze({
        itemRef: item.holdRef,
        studentRef: item.studentRef,
        assignmentRef: session?.assignmentRef ?? null,
        kind: 'SAFETY_ACTION',
        title: assignment?.title ?? 'Study safety check-in',
        state: 'Parent action required',
        when: item.createdAt,
        result: 'Only this learner session is paused.',
        next: session ? 'Check in with the learner, then clear this exact hold.' : 'The exact held session is unavailable; do not clear it from this view.',
        action: session ? 'CLEAR_SAFETY_HOLD' : 'NONE',
      })
    })
  const completedHistory = [
    ...assessments.filter((item) => item.status === 'CERTIFIED').map(completedAssessment),
    ...attestations
      .filter((item) => item.status === 'CERTIFIED')
      .map((item): ParentReviewCenterItem => Object.freeze({
        itemRef: `${item.assignmentRef}:${item.sessionRef}`,
        studentRef: item.studentRef,
        assignmentRef: item.assignmentRef,
        kind: 'COMPLETED',
        title: attestationTitle(item, assignments),
        state: 'Certified',
        when: item.attestedAt ?? item.learnerAssertedAt,
        result: item.evidenceMode === 'simulated-alternative'
          ? 'Equal-credit simulated alternative certified.'
          : 'Guardian-observed completion certified.',
        next: 'The learner is ready to continue.',
        action: 'NONE',
      })),
    ...holds
      .filter((item) => item.status === 'cleared' && item.clearedAt)
      .map((item): ParentReviewCenterItem => {
        const session = sessions.find((candidate) => candidate.session.sessionRef === item.sessionRef)
        const assignment = assignments.find((candidate) => candidate.assignmentRef === session?.assignmentRef)
        return Object.freeze({
          itemRef: item.holdRef,
          studentRef: item.studentRef,
          assignmentRef: session?.assignmentRef ?? null,
          kind: 'COMPLETED',
          title: assignment?.title ?? 'Study safety check-in',
          state: 'Safety hold cleared',
          when: item.clearedAt as string,
          result: 'Parent check-in completed for the exact held session.',
          next: 'This learner session may continue.',
          action: 'NONE',
        })
      }),
  ]

  const sortedPendingScoring = sortNewestFirst(pendingScoring)
  const sortedGuardianReview = sortNewestFirst(guardianReview)
  const sortedManualReview = sortNewestFirst(manualReview)
  const sortedSafetyActions = sortNewestFirst(safetyActions)
  return Object.freeze({
    studentRef: input.studentRef,
    pendingScoring: sortedPendingScoring,
    guardianReview: sortedGuardianReview,
    manualReview: sortedManualReview,
    safetyActions: sortedSafetyActions,
    reviewQueue: sortNewestFirst([
      ...sortedPendingScoring,
      ...sortedGuardianReview,
      ...sortedManualReview,
      ...sortedSafetyActions,
    ]),
    completedHistory: sortNewestFirst(completedHistory),
  })
}
