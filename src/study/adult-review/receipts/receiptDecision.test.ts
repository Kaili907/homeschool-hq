import { describe, expect, it } from 'vitest'
import type { ExpectedReceiptBindingV1, ProviderReceiptClaimV1 } from '../../contracts/delivery/types'
import { decideReceiptAdmission } from './receiptDecision'

const expected: ExpectedReceiptBindingV1 = {
  schemaVersion: 1,
  provider: 'academy-in-app',
  route: 'in-app',
  jobId: 'job:synthetic-1',
  attemptId: 'attempt:synthetic-1',
  idempotencyKey: 'delivery:synthetic-1',
  recipientRef: 'recipient:synthetic-guardian',
  householdRef: 'household:synthetic',
  learnerRef: 'learner:synthetic',
  providerConfigVersion: 'in-app-config-v1',
  acceptedAt: '2026-08-01T12:00:00.000Z',
  deliveredAt: '2026-08-01T12:00:01.000Z',
}
const claim: ProviderReceiptClaimV1 = { ...expected, providerReceiptRef: 'receipt:synthetic-1' }

describe('attempt-bound receipt admission', () => {
  it('requires verification after all bindings match', () => {
    expect(decideReceiptAdmission({ expected, claim, assignments: [] })).toEqual({
      state: 'pending-verification', claim,
    })
  })

  it('rejects cross-attempt mismatch and replay', () => {
    expect(decideReceiptAdmission({
      expected,
      claim: { ...claim, attemptId: 'attempt:forged' },
      assignments: [],
    })).toEqual({ state: 'mismatched', reasonCode: 'attempt-id-mismatch' })
    expect(decideReceiptAdmission({
      expected,
      claim,
      assignments: [{
        provider: claim.provider,
        route: claim.route,
        providerReceiptRef: claim.providerReceiptRef,
        jobId: 'job:other',
        attemptId: 'attempt:other',
      }],
    })).toEqual({ state: 'replayed', reasonCode: 'provider-receipt-replayed' })
  })
})
