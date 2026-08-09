import { describe, expect, it, vi } from 'vitest'
import { createAdminCostReader } from './admin-cost-reader.js'

describe('authorized Admin cost read seam', () => {
  it('requires costs:read and preserves IntegerMicros strings', async () => {
    const records = [{ costMicros: '9007199254740993', costComponents: [{ costMicros: '9007199254740992' }] }]
    const requireCapability = vi.fn(async () => true)
    const gatewayAccess = { readProviderUsageCosts: vi.fn(async () => records) }
    const reader = createAdminCostReader({ requireCapability, gatewayAccess })
    await expect(reader.list({ limit: 50, before: '2026-08-08T12:00:00.000Z' })).resolves.toBe(records)
    expect(requireCapability).toHaveBeenCalledWith('costs:read')
    expect(gatewayAccess.readProviderUsageCosts).toHaveBeenCalledWith({ limit: 50, before: '2026-08-08T12:00:00.000Z' })
  })

  it('fails closed before service access when authorization is absent', async () => {
    const gatewayAccess = { readProviderUsageCosts: vi.fn() }
    const reader = createAdminCostReader({ requireCapability: vi.fn(async () => false), gatewayAccess })
    await expect(reader.list()).rejects.toMatchObject({ statusCode: 403, code: 'admin_forbidden' })
    expect(gatewayAccess.readProviderUsageCosts).not.toHaveBeenCalled()
  })
})
