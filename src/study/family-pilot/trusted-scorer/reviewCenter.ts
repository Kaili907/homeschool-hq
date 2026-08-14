import type { LearnerResponseRecord } from '../final-app/learner-response'

export type FamilyPilotTrustedScoreReviewState =
  | 'PENDING_TRUSTED_SCORE'
  | 'TRUSTED_RESULT_AVAILABLE'
  | 'PARENT_ACTION_REQUIRED'

/**
 * Narrow Session 17 boundary. It contains identity and state, never a learner
 * response, answer authority, rubric, resolver payload, bearer, or secret.
 */
export interface FamilyPilotTrustedScoreReviewItem {
  readonly schemaVersion: 1
  readonly state: FamilyPilotTrustedScoreReviewState
  readonly studentRef: string
  readonly assignmentRef: string
  readonly attemptRef: string
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly updatedAt: string
  readonly trustedReceiptRef: string | null
  readonly outcome: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | null
}

export interface FamilyPilotTrustedScoreReviewCenterPort {
  listTrustedScoreItems(studentRef: string): Promise<readonly FamilyPilotTrustedScoreReviewItem[]>
}

export function projectTrustedScoreReviewItem(
  record: LearnerResponseRecord,
): FamilyPilotTrustedScoreReviewItem {
  const reviewRequired = record.assessment?.decision === 'REVIEW_REQUIRED'
  const outcome = record.assessment && !reviewRequired ? record.assessment.decision : null
  return Object.freeze({
    schemaVersion: 1,
    state: record.status === 'PENDING_ASSESSMENT'
      ? 'PENDING_TRUSTED_SCORE'
      : reviewRequired
        ? 'PARENT_ACTION_REQUIRED'
        : 'TRUSTED_RESULT_AVAILABLE',
    studentRef: record.studentRef,
    assignmentRef: record.assignmentRef,
    attemptRef: record.attemptRef,
    lessonRef: record.lessonRef,
    sectionRef: record.sectionRef,
    itemRef: record.itemRef,
    updatedAt: record.assessment?.assessedAt ?? record.savedAt,
    trustedReceiptRef: record.assessment?.assessmentRef ?? null,
    outcome,
  })
}
