import type { DeliveryAttemptState, DeliveryReceiptState } from './types'

const ATTEMPT_TRANSITIONS: Readonly<Record<DeliveryAttemptState, readonly DeliveryAttemptState[]>> = {
  created: ['submitted', 'permanent-failure'],
  submitted: [
    'provider-accepted',
    'provider-rejected',
    'timeout-indeterminate',
    'permanent-failure',
  ],
  'provider-accepted': [
    'receipt-verified',
    'receipt-rejected',
    'timeout-indeterminate',
    'permanent-failure',
  ],
  'provider-rejected': ['permanent-failure'],
  'timeout-indeterminate': ['receipt-verified', 'receipt-rejected', 'permanent-failure'],
  'receipt-verified': [],
  'receipt-rejected': ['permanent-failure'],
  'permanent-failure': [],
}
const RECEIPT_TRANSITIONS: Readonly<Record<DeliveryReceiptState, readonly DeliveryReceiptState[]>> = {
  absent: ['pending-verification'],
  'pending-verification': ['verified', 'rejected', 'replayed', 'mismatched'],
  verified: [],
  rejected: [],
  replayed: [],
  mismatched: [],
}

export function canTransitionDeliveryAttempt(
  from: DeliveryAttemptState,
  to: DeliveryAttemptState,
): boolean {
  return ATTEMPT_TRANSITIONS[from].includes(to)
}

export function canTransitionDeliveryReceipt(
  from: DeliveryReceiptState,
  to: DeliveryReceiptState,
): boolean {
  return RECEIPT_TRANSITIONS[from].includes(to)
}
