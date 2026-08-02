import type {
  ExpectedReceiptBindingV1,
  ProviderReceiptClaimV1,
  ReceiptAssignmentV1,
  ReceiptBindingMismatchCode,
} from '../../contracts/delivery/types'

export type ReceiptDecision =
  | Readonly<{ state: 'pending-verification'; claim: ProviderReceiptClaimV1 }>
  | Readonly<{ state: 'replayed'; reasonCode: 'provider-receipt-replayed' }>
  | Readonly<{ state: 'mismatched'; reasonCode: ReceiptBindingMismatchCode }>

const bindingFields: readonly (readonly [
  keyof ExpectedReceiptBindingV1,
  ReceiptBindingMismatchCode,
])[] = [
  ['provider', 'provider-mismatch'],
  ['route', 'route-mismatch'],
  ['jobId', 'job-id-mismatch'],
  ['attemptId', 'attempt-id-mismatch'],
  ['idempotencyKey', 'idempotency-key-mismatch'],
  ['recipientRef', 'recipient-ref-mismatch'],
  ['householdRef', 'household-ref-mismatch'],
  ['learnerRef', 'learner-ref-mismatch'],
  ['providerConfigVersion', 'provider-config-version-mismatch'],
  ['acceptedAt', 'accepted-at-mismatch'],
  ['deliveredAt', 'delivered-at-mismatch'],
]

export function decideReceiptAdmission(input: Readonly<{
  expected: ExpectedReceiptBindingV1
  claim: ProviderReceiptClaimV1
  assignments: readonly ReceiptAssignmentV1[]
}>): ReceiptDecision {
  const mismatch = bindingFields.find(([field]) => input.expected[field] !== input.claim[field])
  if (mismatch) return { state: 'mismatched', reasonCode: mismatch[1] }

  const assignment = input.assignments.find((item) =>
    item.provider === input.claim.provider
    && item.route === input.claim.route
    && item.providerReceiptRef === input.claim.providerReceiptRef)
  if (assignment && (
    assignment.jobId !== input.claim.jobId
    || assignment.attemptId !== input.claim.attemptId
  )) return { state: 'replayed', reasonCode: 'provider-receipt-replayed' }

  return { state: 'pending-verification', claim: input.claim }
}
