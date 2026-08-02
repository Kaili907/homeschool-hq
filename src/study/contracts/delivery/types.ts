export const ADULT_REVIEW_DELIVERY_SCHEMA_VERSION = 1 as const

export const DELIVERY_ATTEMPT_STATES = [
  'created',
  'submitted',
  'provider-accepted',
  'provider-rejected',
  'timeout-indeterminate',
  'receipt-verified',
  'receipt-rejected',
  'permanent-failure',
] as const

export type DeliveryAttemptState = (typeof DELIVERY_ATTEMPT_STATES)[number]

export const DELIVERY_RECEIPT_STATES = [
  'absent',
  'pending-verification',
  'verified',
  'rejected',
  'replayed',
  'mismatched',
] as const

export type DeliveryReceiptState = (typeof DELIVERY_RECEIPT_STATES)[number]

export const ADULT_REVIEW_DELIVERY_ROUTES = ['in-app', 'email', 'sms'] as const

export type AdultReviewDeliveryRoute = (typeof ADULT_REVIEW_DELIVERY_ROUTES)[number]
export type DeliveryAttemptTimeoutState = 'not-timed-out' | 'indeterminate'
export type DeliveryRetryDecision = 'none' | 'retry' | 'reconcile' | 'stop'

/**
 * Immutable, minimized metadata for one provider invocation. Contact values,
 * message bodies, provider response bodies, and credentials are deliberately
 * not representable by this contract.
 */
export interface DeliveryAttemptRecordV1 {
  readonly schemaVersion: typeof ADULT_REVIEW_DELIVERY_SCHEMA_VERSION
  readonly attemptId: string
  readonly jobId: string
  readonly route: AdultReviewDeliveryRoute
  readonly provider: string
  readonly providerConfigVersion: string
  readonly startedAt: string
  readonly completedAt: string | null
  readonly state: DeliveryAttemptState
  readonly timeoutState: DeliveryAttemptTimeoutState
  readonly providerReceiptRef: string | null
  readonly retryDecision: DeliveryRetryDecision
  readonly errorCode: string | null
  readonly idempotencyKey: string
}

/** The binding expected from the durable job and immutable attempt ledger. */
export interface ExpectedReceiptBindingV1 {
  readonly schemaVersion: typeof ADULT_REVIEW_DELIVERY_SCHEMA_VERSION
  readonly provider: string
  readonly route: AdultReviewDeliveryRoute
  readonly jobId: string
  readonly attemptId: string
  readonly idempotencyKey: string
  readonly recipientRef: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly providerConfigVersion: string
  readonly acceptedAt: string | null
  readonly deliveredAt: string | null
}

/**
 * Provider claim awaiting verification. This is binding metadata, not proof of
 * delivery. It may only enter through a trusted server/provider boundary.
 */
export interface ProviderReceiptClaimV1 extends ExpectedReceiptBindingV1 {
  readonly providerReceiptRef: string
}

/** The smallest assignment needed to prevent a receipt from being reassigned. */
export interface ReceiptAssignmentV1 {
  readonly provider: string
  readonly route: AdultReviewDeliveryRoute
  readonly providerReceiptRef: string
  readonly jobId: string
  readonly attemptId: string
}

export type ReceiptBindingMismatchCode =
  | 'provider-mismatch'
  | 'route-mismatch'
  | 'job-id-mismatch'
  | 'attempt-id-mismatch'
  | 'idempotency-key-mismatch'
  | 'recipient-ref-mismatch'
  | 'household-ref-mismatch'
  | 'learner-ref-mismatch'
  | 'provider-config-version-mismatch'
  | 'accepted-at-mismatch'
  | 'delivered-at-mismatch'

export type DeliveryContractValidationCode =
  | 'not-an-exact-object'
  | 'unexpected-fields'
  | 'invalid-schema-version'
  | 'invalid-field'
  | 'incoherent-attempt-state'
  | 'missing-receipt-timestamp'

export type DeliveryContractValidationResult<T> =
  | { readonly valid: true; readonly value: T }
  | {
      readonly valid: false
      readonly code: DeliveryContractValidationCode
      readonly field?: string
    }
