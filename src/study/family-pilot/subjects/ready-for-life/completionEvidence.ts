import type { RflGuardianRequirement } from './guardianRequirement'

/**
 * FULL-FAMILY-READY-FOR-LIFE-COMPLETION — the one gate that stops a
 * real-world action from being self-certified by a student click. This is a
 * pure decision function: it holds no store of its own and defers to the
 * existing Study session/progress authority for persistence and idempotency
 * bookkeeping, taking that authority's "already recorded complete" fact as
 * an input (`prior`) rather than tracking it itself.
 */

export interface RflGuardianConfirmation {
  readonly guardianRef: string
  readonly confirmedAt: string
}

export interface RflCompletionEvidence {
  /** Whose evidence this is. Checked against the session's own learner
   * before anything else — evidence for one student can never complete
   * another student's lesson. */
  readonly learnerRef: string
  /** The student reached the end of the lesson's Study segments. On its
   * own, this is enough for a lesson with no guardian sign-off requirement —
   * but never enough on its own for one that has it. */
  readonly studentAdvanced: boolean
  /** Present only when a parent/guardian has actually confirmed the
   * real-world task. Required, and validated non-empty, for any lesson
   * guardianRequirement flags as requiresGuardianSignoffBeforeCompletion. */
  readonly guardianConfirmation?: RflGuardianConfirmation
}

export interface RflCompletionPriorState {
  /** True when the existing Study session authority already has this
   * lesson recorded complete for this learner. */
  readonly alreadyCompleted: boolean
}

export type RflCompletionStatus = 'complete' | 'pending-guardian-confirmation' | 'rejected'

export interface RflCompletionDecision {
  readonly status: RflCompletionStatus
  readonly reasonCode: string
  readonly message: string
}

function reject(reasonCode: string, message: string): RflCompletionDecision {
  return Object.freeze({ status: 'rejected', reasonCode, message })
}

export function decideReadyForLifeCompletion(
  guardianRequirement: RflGuardianRequirement,
  evidence: RflCompletionEvidence,
  expectedLearnerRef: string,
  prior: RflCompletionPriorState,
): RflCompletionDecision {
  if (evidence.learnerRef !== expectedLearnerRef) {
    return reject('learner-mismatch', 'Completion evidence does not belong to this learner.')
  }
  if (prior.alreadyCompleted) {
    return reject('assignment-already-complete', 'This lesson is already recorded complete.')
  }
  if (!evidence.studentAdvanced) {
    return reject('assignment-incomplete', 'The learner has not finished the lesson segments yet.')
  }
  if (guardianRequirement.requiresGuardianSignoffBeforeCompletion) {
    const confirmation = evidence.guardianConfirmation
    if (!confirmation) {
      return Object.freeze({
        status: 'pending-guardian-confirmation',
        reasonCode: 'guardian-confirmation-required',
        message: 'A parent or guardian must confirm this real-world task before it can be marked complete.',
      })
    }
    if (!confirmation.guardianRef.trim() || !confirmation.confirmedAt.trim()) {
      return reject('guardian-confirmation-invalid', 'Guardian confirmation is missing required fields.')
    }
  }
  return Object.freeze({ status: 'complete', reasonCode: 'ok', message: 'Lesson recorded complete.' })
}
