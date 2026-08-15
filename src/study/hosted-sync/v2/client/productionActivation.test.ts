import { describe, expect, it } from 'vitest'
import { HOSTED_SYNC_PRODUCTION_ACTIVATION, requireHostedSyncProductionPrivacySerializer } from './productionActivation'

describe('hosted sync production activation gate', () => {
  it('is default-off while using the reviewed activation configuration', () => {
    expect(HOSTED_SYNC_PRODUCTION_ACTIVATION).toEqual({ enabled: false, reason: 'HOSTED_SYNC_R2_DEFAULT_OFF' })
    expect(requireHostedSyncProductionPrivacySerializer()).toBe(true)
  })
})
