import type {
  ExpectedReceiptBindingV1,
  ProviderReceiptClaimV1,
  ReceiptAssignmentV1,
  ReceiptBindingMismatchCode,
} from '../../contracts/delivery'

export type ReceiptAdmissionDecision =
  | { readonly state: 'pending-verification' }
  | { readonly state: 'replayed'; readonly code: 'provider-receipt-already-assigned' }
  | { readonly state: 'mismatched'; readonly code: ReceiptBindingMismatchCode }

const BINDING_COMPARISONS: readonly {
  readonly field: keyof ExpectedReceiptBindingV1
  readonly code: ReceiptBindingMismatchCode
}[] = [
  { field: 'provider', code: 'provider-mismatch' },
  { field: 'route', code: 'route-mismatch' },
  { field: 'jobId', code: 'job-id-mismatch' },
  { field: 'attemptId', code: 'attempt-id-mismatch' },
  { field: 'idempotencyKey', code: 'idempotency-key-mismatch' },
  { field: 'recipientRef', code: 'recipient-ref-mismatch' },
  { field: 'householdRef', code: 'household-ref-mismatch' },
  { field: 'learnerRef', code: 'learner-ref-mismatch' },
  { field: 'providerConfigVersion', code: 'provider-config-version-mismatch' },
  { field: 'acceptedAt', code: 'accepted-at-mismatch' },
  { field: 'deliveredAt', code: 'delivered-at-mismatch' },
]

/** Returns a stable, non-sensitive mismatch code, or null for an exact binding. */
export function findReceiptBindingMismatch(
  claim: ProviderReceiptClaimV1,
  expected: ExpectedReceiptBindingV1,
): ReceiptBindingMismatchCode | null {
  for (const comparison of BINDING_COMPARISONS) {
    if (claim[comparison.field] !== expected[comparison.field]) return comparison.code
  }
  return null
}

/**
 * Binding admission never returns `verified`; authenticity must be established
 * independently by the trusted server-side provider adapter.
 */
export function decideReceiptAdmission(input: {
  readonly claim: ProviderReceiptClaimV1
  readonly expected: ExpectedReceiptBindingV1
  readonly existingAssignments: readonly ReceiptAssignmentV1[]
}): ReceiptAdmissionDecision {
  const alreadyAssigned = input.existingAssignments.some(
    (assignment) =>
      assignment.provider === input.claim.provider &&
      assignment.route === input.claim.route &&
      assignment.providerReceiptRef === input.claim.providerReceiptRef,
  )
  if (alreadyAssigned) {
    return { state: 'replayed', code: 'provider-receipt-already-assigned' }
  }
  const mismatch = findReceiptBindingMismatch(input.claim, input.expected)
  return mismatch === null
    ? { state: 'pending-verification' }
    : { state: 'mismatched', code: mismatch }
}
