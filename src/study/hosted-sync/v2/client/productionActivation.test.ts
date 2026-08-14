import { describe, expect, it } from 'vitest'
import { HOSTED_SYNC_PRODUCTION_ACTIVATION, requireHostedSyncProductionPrivacySerializer } from './productionActivation'

describe('hosted sync production activation gate', () => {
  it('cannot be enabled in the convergence branch', () => {
    expect(HOSTED_SYNC_PRODUCTION_ACTIVATION).toEqual({ enabled: false, reason: 'PRODUCTION_PRIVACY_SERIALIZER_REQUIRED' })
    expect(requireHostedSyncProductionPrivacySerializer).toThrow('PRODUCTION_PRIVACY_SERIALIZER_REQUIRED')
  })
})
