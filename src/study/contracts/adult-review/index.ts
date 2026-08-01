import type {
  SafetyClassification,
  SafetyReasonCode,
  StudySafetyMonitoringEventV1,
} from '../safety'

export const ADULT_REVIEW_SCHEMA_VERSION = 1 as const

export interface AdultReviewProposalV1 {
  readonly schemaVersion: typeof ADULT_REVIEW_SCHEMA_VERSION
  readonly proposalId: string
  readonly householdId: string
  readonly studentId: string
  readonly sessionId: string
  readonly category: 'student-support'
  readonly classification: Exclude<SafetyClassification, 'clear'>
  readonly urgency: 'urgent' | 'uncertain' | 'review-required'
  readonly reasonCodes: readonly SafetyReasonCode[]
  readonly classifierVersion: string
  readonly occurredAt: string
  readonly idempotencyKey: string
  readonly deliveryState: 'proposed-not-delivered'
  readonly authorizedRecipientResolutionState: 'pending'
}

export interface AdultReviewOutboxRecordV1 {
  readonly schemaVersion: 1
  readonly outboxId: string
  readonly proposalId: string
  readonly deliveryIdempotencyKey: string
  readonly recipientRef: string
  readonly routeRef: string
  readonly channel: 'email' | 'in-app' | 'sms'
  readonly state: 'pending' | 'claimed' | 'retry-scheduled' | 'delivered' | 'permanent-failure' | 'indeterminate'
  readonly attemptCount: number
  readonly retryAt: string | null
  readonly version: number
}

export interface ClaimedAdultReviewOutboxWorkV1 {
  readonly record: AdultReviewOutboxRecordV1
  readonly leaseToken: string
  readonly leaseExpiresAt: string
}

export interface AdultReviewPersistencePort {
  createProposal(input: {
    proposal: AdultReviewProposalV1
  }): Promise<{ created: true } | { created: false; duplicateProposalId: string }>
  claimUnresolvedProposals(input: { now: string; limit: number; leaseMs: number }): Promise<readonly {
    proposal: AdultReviewProposalV1
    leaseToken: string
    leaseExpiresAt: string
  }[]>
  recordRecipientResolutionAndEnqueue(input: {
    proposalId: string
    proposalLeaseToken: string
    resolutionRef: string
    policyVersion: string
    routes: readonly {
      recipientRef: string
      routeRef: string
      channel: 'email' | 'in-app' | 'sms'
      deliveryIdempotencyKey: string
    }[]
  }): Promise<readonly AdultReviewOutboxRecordV1[]>
  claimOutboxWork(input: { now: string; limit: number; leaseMs: number }): Promise<readonly ClaimedAdultReviewOutboxWorkV1[]>
  recordAttempt(input: {
    outboxId: string
    leaseToken: string
    attemptId: string
    deliveryIdempotencyKey: string
    recipientRef: string
    routeRef: string
    channel: 'email' | 'in-app' | 'sms'
    providerVersion: string
    authorizationEvidenceRef: string
    attemptedAt: string
  }): Promise<{ attemptCount: number }>
  recordDeliveryReceipt(input: {
    outboxId: string
    leaseToken: string
    attemptId: string
    deliveryIdempotencyKey: string
    recipientRef: string
    routeRef: string
    channel: 'email' | 'in-app' | 'sms'
    providerVersion: string
    deliveredAt: string
    providerReceiptRef: string
  }): Promise<void>
  recordPermanentFailure(input: {
    outboxId: string
    leaseToken: string
    failedAt: string
    failureCode: string
  }): Promise<void>
  recordTemporaryFailure(input: {
    outboxId: string
    leaseToken: string
    failedAt: string
    retryAt: string
    failureCode: string
  }): Promise<void>
  recordIndeterminate(input: {
    outboxId: string
    leaseToken: string
    failedAt: string
    failureCode: string
  }): Promise<void>
  recordMonitoringAlert(event: StudySafetyMonitoringEventV1): Promise<void>
}

export interface AuthorizedAdultRecipientRefV1 {
  readonly recipientRef: string
  readonly membershipRef: string
  readonly learnerRelationshipRef: string
  readonly notificationPermissionRef: string
  readonly relationship: 'guardian'
  readonly routes: readonly {
    readonly channel: 'email' | 'in-app' | 'sms'
    readonly routeRef: string
  }[]
}

export interface AuthorizedAdultRecipientResolverPort {
  resolve(input: {
    proposalRef: string
  }): Promise<
    | {
        state: 'resolved'
        resolutionRef: string
        policyVersion: string
        recipients: readonly AuthorizedAdultRecipientRefV1[]
      }
    | { state: 'unavailable' | 'indeterminate'; reasonCode: string }
  >
  reauthorizeForDelivery(input: {
    proposalRef: string
    recipientRef: string
    routeRef: string
    now: string
  }): Promise<
    | { state: 'authorized'; authorizationEvidenceRef: string }
    | { state: 'revoked' | 'unavailable' | 'indeterminate'; reasonCode: string }
  >
}

export interface AdultReviewDeliveryAttemptV1 {
  readonly idempotencyKey: string
  readonly recipientRef: string
  readonly routeRef: string
  readonly templateCode: 'study-safety-adult-review-v1'
}

export type AdultReviewDeliveryResultV1 =
  | { readonly state: 'delivered'; readonly verified: true; readonly providerReceiptRef: string }
  | { readonly state: 'accepted-awaiting-receipt'; readonly providerAcceptanceRef: string }
  | { readonly state: 'temporary-failure'; readonly failureCode: string; readonly retryAt: string }
  | { readonly state: 'permanent-failure'; readonly failureCode: string }
  | { readonly state: 'indeterminate'; readonly failureCode: string }

export interface AdultReviewDeliveryProviderPort {
  readonly channel: 'email' | 'in-app' | 'sms'
  readonly providerVersion: string
  /** Production implementations must honor unchanged idempotency keys durably. */
  readonly supportsDurableIdempotency: boolean
  deliver(input: AdultReviewDeliveryAttemptV1): Promise<AdultReviewDeliveryResultV1>
  verifyReceipt(input: {
    deliveryIdempotencyKey: string
    recipientRef: string
    routeRef: string
    providerReceiptRef: string
  }): Promise<{ verified: true; evidenceRef: string } | { verified: false }>
}
