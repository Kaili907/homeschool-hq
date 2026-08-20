import {
  PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION,
  parseProductionItemResult,
  type ProductionItemAssessmentRequest,
  type ProductionLearnerResponse,
} from '../../production-assessment/contracts'
import type { ProductionItemAssessmentTransport } from '../../production-assessment/offline'
import type {
  LearnerAssessmentReceipt,
  LearnerResponseAssessor,
  LearnerResponseRecord,
} from '../final-app/learner-response'

export const FAMILY_PILOT_TRUSTED_SCORER_REF = 'trusted:production-item:r1' as const

export interface FamilyPilotTrustedScorerOptions {
  readonly transport: ProductionItemAssessmentTransport
  readonly releaseId?: string
  readonly now?: () => Date
  /**
   * Staging may replace local attempt identities with its verified, bound Study
   * session identity. The trusted server still verifies every supplied ref.
   */
  readonly bindAttempt?: (record: LearnerResponseRecord) => {
    readonly assignmentRef: string
    readonly attemptRef: string
  }
}

function learnerResponse(record: LearnerResponseRecord): ProductionLearnerResponse {
  if (record.response.kind === 'CHOICE') {
    const localPrefix = `${record.itemRef}:choice:`
    const ordinal = record.response.choiceRef.startsWith(localPrefix)
      ? record.response.choiceRef.slice(localPrefix.length)
      : ''
    // The current pilot's learner-safe projection uses `choice:N`; the trusted
    // R1 contract projects the same ordinal as `choice-N`.
    const choiceRef = /^\d+$/.test(ordinal)
      ? `${record.itemRef}:choice-${ordinal}`
      : record.response.choiceRef
    return Object.freeze({ kind: 'choice', choiceRef })
  }
  return Object.freeze({ kind: 'text', text: record.response.text })
}

function requestFor(
  record: LearnerResponseRecord,
  releaseId: string,
  bindAttempt: NonNullable<FamilyPilotTrustedScorerOptions['bindAttempt']>,
): ProductionItemAssessmentRequest {
  const bound = bindAttempt(record)
  return Object.freeze({
    schemaVersion: PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION,
    releaseId,
    assignmentRef: bound.assignmentRef,
    lessonRef: record.lessonRef,
    sectionRef: record.sectionRef,
    itemRef: record.itemRef,
    attemptRef: bound.attemptRef,
    response: learnerResponse(record),
  })
}

function receiptFor(
  request: ProductionItemAssessmentRequest,
  transported: unknown,
  assessedAt: string,
): LearnerAssessmentReceipt {
  const result = parseProductionItemResult(transported)
  if (!result) throw new Error('trusted_result_malformed')
  if (
    result.assignmentRef !== request.assignmentRef ||
    result.lessonRef !== request.lessonRef ||
    result.sectionRef !== request.sectionRef ||
    result.itemRef !== request.itemRef ||
    result.attemptRef !== request.attemptRef
  ) throw new Error('trusted_result_identity_mismatch')

  const decision = result.resultKind === 'correct'
    ? 'CORRECT' as const
    : result.resultKind === 'incorrect'
      ? 'INCORRECT' as const
      : result.resultKind === 'review-required'
        ? 'REVIEW_REQUIRED' as const
        : null
  if (!decision) throw new Error('trusted_result_not_applicable')
  return Object.freeze({
    assessmentRef: result.receiptRef,
    assessorRef: FAMILY_PILOT_TRUSTED_SCORER_REF,
    assessedAt,
    decision,
  })
}

/**
 * Browser-side adapter only. It translates a durable learner response to the
 * existing minimized server contract and makes no Study progression decision.
 */
export function createFamilyPilotTrustedScorer(
  options: FamilyPilotTrustedScorerOptions,
): LearnerResponseAssessor {
  const releaseId = options.releaseId ?? 'family-pilot-r1'
  const bindAttempt = options.bindAttempt ?? ((record: LearnerResponseRecord) => ({
    assignmentRef: record.assignmentRef,
    attemptRef: record.attemptRef,
  }))
  const now = options.now ?? (() => new Date())
  return Object.freeze({
    assessorRef: FAMILY_PILOT_TRUSTED_SCORER_REF,
    async assess(record: LearnerResponseRecord): Promise<LearnerAssessmentReceipt> {
      if (record.status !== 'PENDING_ASSESSMENT' || record.assessment !== null) {
        throw new Error('trusted_submission_not_pending')
      }
      const request = requestFor(record, releaseId, bindAttempt)
      const transported = await options.transport.assess(request)
      return receiptFor(request, transported, now().toISOString())
    },
  })
}
