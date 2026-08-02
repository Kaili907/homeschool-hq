export const PROPOSAL_STATES = [
  'proposed', 'accepted', 'rejected', 'cancelled', 'expired',
] as const

export const RECIPIENT_RESOLUTION_STATES = [
  'pending', 'resolved', 'no-authorized-recipient', 'revoked', 'failed',
] as const

export const OUTBOX_STATES = [
  'pending', 'leased', 'retryable', 'indeterminate', 'delivered',
  'permanent-failure', 'cancelled',
] as const

export type ProposalState = (typeof PROPOSAL_STATES)[number]
export type RecipientResolutionState = (typeof RECIPIENT_RESOLUTION_STATES)[number]
export type OutboxState = (typeof OUTBOX_STATES)[number]

const proposalTransitions: Readonly<Record<ProposalState, readonly ProposalState[]>> = {
  proposed: ['accepted', 'rejected', 'cancelled', 'expired'],
  accepted: ['cancelled', 'expired'],
  rejected: [],
  cancelled: [],
  expired: [],
}

const recipientTransitions: Readonly<Record<RecipientResolutionState, readonly RecipientResolutionState[]>> = {
  pending: ['resolved', 'no-authorized-recipient', 'revoked', 'failed'],
  resolved: ['revoked'],
  'no-authorized-recipient': [],
  revoked: [],
  failed: ['pending'],
}

const outboxTransitions: Readonly<Record<OutboxState, readonly OutboxState[]>> = {
  pending: ['leased', 'cancelled'],
  leased: ['pending', 'retryable', 'indeterminate', 'delivered', 'permanent-failure', 'cancelled'],
  retryable: ['leased', 'cancelled'],
  indeterminate: ['delivered', 'permanent-failure', 'cancelled'],
  delivered: [],
  'permanent-failure': [],
  cancelled: [],
}

export function canTransitionProposal(from: ProposalState, to: ProposalState): boolean {
  return proposalTransitions[from].includes(to)
}

export function canTransitionRecipient(
  from: RecipientResolutionState,
  to: RecipientResolutionState,
): boolean {
  return recipientTransitions[from].includes(to)
}

export function canTransitionOutbox(from: OutboxState, to: OutboxState): boolean {
  return outboxTransitions[from].includes(to)
}

export function assertSafeOutboxTransition(input: Readonly<{
  from: OutboxState
  to: OutboxState
  submitted: boolean
  verifiedReceipt: boolean
}>): void {
  if (!canTransitionOutbox(input.from, input.to)) throw new Error('invalid_outbox_transition')
  if (input.to === 'delivered' && !input.verifiedReceipt) throw new Error('verified_receipt_required')
  if (input.from === 'leased' && input.to === 'pending' && input.submitted) {
    throw new Error('submitted_attempt_requires_reconciliation')
  }
}
