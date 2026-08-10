import type {
  AcceptedAssessmentCommand,
  AssessmentAttemptRecord,
  AssessmentAttemptRef,
  AssessmentAttemptRevision,
  AssessmentCommandId,
  ProtectedAssessmentResponsePayload,
} from './types'
import type { AssessmentOperationalOutcomeDTO } from './privacy'

export interface AssessmentTransitionWrite {
  readonly expectedRevision: AssessmentAttemptRevision
  readonly nextAttempt: AssessmentAttemptRecord
  readonly receipt: AcceptedAssessmentCommand
  /** Written atomically to protected storage when a submission is accepted. */
  readonly protectedResponse: ProtectedAssessmentResponsePayload | null
}

export type AssessmentPersistenceWriteResult =
  | { readonly status: 'stored'; readonly revision: AssessmentAttemptRevision }
  | { readonly status: 'replayed'; readonly revision: AssessmentAttemptRevision }
  | { readonly status: 'revision-conflict'; readonly currentRevision: AssessmentAttemptRevision }
  | { readonly status: 'idempotency-collision'; readonly commandId: AssessmentCommandId }

export interface ProtectedAssessmentReadAuthorization {
  readonly purpose: 'assessment-scoring' | 'authorized-learner-review'
  /** Opaque evidence checked by the server adapter, not a browser role claim. */
  readonly authorizationRef: string
}

/**
 * Persistence seam for a future trusted-server adapter. Implementations must
 * make attempt/receipt/protected-response writes atomic and compare-and-swap
 * on expectedRevision. No browser storage implementation belongs here.
 */
export interface AssessmentAttemptPersistence {
  loadAttempt(attemptRef: AssessmentAttemptRef): Promise<AssessmentAttemptRecord | null>
  createAssignedAttempt(
    attempt: AssessmentAttemptRecord,
    idempotencyKey: string,
  ): Promise<AssessmentPersistenceWriteResult>
  compareAndSwapTransition(write: AssessmentTransitionWrite): Promise<AssessmentPersistenceWriteResult>
  loadOperationalOutcome(attemptRef: AssessmentAttemptRef): Promise<AssessmentOperationalOutcomeDTO | null>
  loadProtectedResponse(
    attemptRef: AssessmentAttemptRef,
    authorization: ProtectedAssessmentReadAuthorization,
  ): Promise<ProtectedAssessmentResponsePayload | null>
}
