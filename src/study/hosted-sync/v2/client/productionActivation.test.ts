import { describe, expect, it } from 'vitest'
import { HOSTED_SYNC_PRODUCTION_ACTIVATION, requireHostedSyncProductionPrivacySerializer } from './productionActivation'

describe('hosted sync production activation gate', () => {
  it('cannot be enabled in the convergence branch', () => {
    expect(HOSTED_SYNC_PRODUCTION_ACTIVATION).toEqual({ enabled: false, reason: 'HOSTED_SYNC_R2_INACTIVE_PENDING_STAGING' })
    expect(requireHostedSyncProductionPrivacySerializer()).toBe(true)
  })
})
