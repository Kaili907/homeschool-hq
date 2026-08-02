import { describe, expect, it } from 'vitest'
import {
  assertSafeOutboxTransition,
  canTransitionOutbox,
  canTransitionProposal,
  canTransitionRecipient,
} from './stateMachine'

describe('adult-review canonical operational state machine', () => {
  it('keeps terminal proposal and recipient states terminal', () => {
    expect(canTransitionProposal('proposed', 'accepted')).toBe(true)
    expect(canTransitionProposal('rejected', 'proposed')).toBe(false)
    expect(canTransitionRecipient('resolved', 'revoked')).toBe(true)
    expect(canTransitionRecipient('revoked', 'resolved')).toBe(false)
  })

  it('requires an attempt-bound verified receipt for delivered', () => {
    expect(() => assertSafeOutboxTransition({
      from: 'leased', to: 'delivered', submitted: true, verifiedReceipt: false,
    })).toThrow('verified_receipt_required')
    expect(() => assertSafeOutboxTransition({
      from: 'leased', to: 'delivered', submitted: true, verifiedReceipt: true,
    })).not.toThrow()
  })

  it('recovers only work that has not crossed the provider boundary', () => {
    expect(canTransitionOutbox('leased', 'pending')).toBe(true)
    expect(() => assertSafeOutboxTransition({
      from: 'leased', to: 'pending', submitted: true, verifiedReceipt: false,
    })).toThrow('submitted_attempt_requires_reconciliation')
  })
})
