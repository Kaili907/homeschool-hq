import type { SafetyClassification } from '../../contracts/safety'
import type { CreateSafetyHoldInputV1 } from './types'

/**
 * Minimized input mirroring the Study Safety classifier's own result shape
 * (src/study/contracts/safety StudySafetyClassificationResponseV1) — only the
 * classification and the identifiers needed to place a hold, never the
 * transient learner text the classifier evaluated.
 */
export interface StudySafetyClassificationSignalV1 {
  readonly studentRef: string
  readonly sessionRef: string
  readonly classification: SafetyClassification
  readonly occurredAt: string
}

/**
 * Converts a non-clear Study Safety classification into a Family Pilot
 * safety hold input. 'clear' and 'invalid' produce no hold: 'clear' needs no
 * parent review, and 'invalid' is the classifier's own fail-closed client
 * result — Study's existing local stop ledger already fail-closes the
 * session locally in that case, so this pilot bridge does not duplicate it.
 */
export function safetyHoldInputFromStudySafetyClassification(
  signal: StudySafetyClassificationSignalV1,
): CreateSafetyHoldInputV1 | null {
  if (signal.classification !== 'urgent' && signal.classification !== 'uncertain') return null
  return {
    studentRef: signal.studentRef,
    sessionRef: signal.sessionRef,
    createdAt: signal.occurredAt,
    reasonCode: signal.classification === 'urgent' ? 'study-safety-urgent' : 'study-safety-uncertain',
    source: 'study-safety',
  }
}
