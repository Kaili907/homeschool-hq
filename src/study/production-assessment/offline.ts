import {
  PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION,
  type PendingAssessmentResult,
  type PendingProductionItemAssessment,
  type ProductionItemAssessmentRequest,
  type ProductionItemResult,
  parseProductionItemResult,
} from './contracts'

export interface PendingAssessmentStore {
  /** Device-local only. Implementations must scope records to the signed-in learner. */
  savePending(record: PendingProductionItemAssessment): Promise<void>
}

export interface ProductionItemAssessmentTransport {
  assess(request: ProductionItemAssessmentRequest): Promise<unknown>
}

/** Transport adapters use this only for a positively identified offline failure. */
export class ProductionAssessmentOfflineError extends Error {
  constructor() {
    super('production_assessment_offline')
    this.name = 'ProductionAssessmentOfflineError'
  }
}

function pendingResult(request: ProductionItemAssessmentRequest): PendingAssessmentResult {
  return Object.freeze({
    schemaVersion: PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION,
    status: 'pending-assessment',
    assignmentRef: request.assignmentRef,
    lessonRef: request.lessonRef,
    sectionRef: request.sectionRef,
    itemRef: request.itemRef,
    attemptRef: request.attemptRef,
    resultKind: null,
    evidenceKind: null,
    rawResponseIncluded: false,
  })
}

/**
 * Network failure never becomes correctness. The exact learner response is
 * retained only in the explicitly device-local pending queue for later trusted
 * assessment; no global Study checkpoint or mastery record receives it.
 */
export async function assessOrQueuePending(
  transport: ProductionItemAssessmentTransport,
  store: PendingAssessmentStore,
  request: ProductionItemAssessmentRequest,
  now: () => string = () => new Date().toISOString(),
): Promise<ProductionItemResult | PendingAssessmentResult> {
  let transported: unknown
  try {
    transported = await transport.assess(request)
  } catch (error) {
    if (!(error instanceof ProductionAssessmentOfflineError)) throw error
    await store.savePending(Object.freeze({
      schemaVersion: PRODUCTION_ITEM_ASSESSMENT_SCHEMA_VERSION,
      state: 'PENDING_ASSESSMENT',
      queuedAt: now(),
      request,
    }))
    return pendingResult(request)
  }
  const parsed = parseProductionItemResult(transported)
  if (!parsed) throw new Error('production_item_result_contract')
  return parsed
}
