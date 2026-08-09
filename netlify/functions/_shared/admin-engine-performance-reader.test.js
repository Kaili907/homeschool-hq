import { describe, expect, it, vi } from 'vitest'
import { createAdminEnginePerformanceReader } from './admin-engine-performance-reader.js'

describe('canonical operational telemetry reader', () => {
  it('uses only the existing ADMIN-2 service RPC and its engines:read database boundary', async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: [{ opaque: 'row' }], error: null })
    const client = { rpc: vi.fn(() => ({ abortSignal })) }
    const reader = createAdminEnginePerformanceReader({ client })
    await expect(reader.list(500)).resolves.toEqual([{ opaque: 'row' }])
    expect(client.rpc).toHaveBeenCalledWith('academy_list_operational_events_v2', {
      p_scope: null,
      p_household_id: null,
      p_learner_id: null,
      p_limit: 500,
      p_required_capability: 'engines:read',
    })
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  })

  it('fails closed without server configuration or on database error', async () => {
    await expect(createAdminEnginePerformanceReader({ env: {} }).list(500)).rejects.toMatchObject({ code: 'source_unavailable' })
    const client = { rpc: vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }) })) }
    await expect(createAdminEnginePerformanceReader({ client }).list(500)).rejects.toMatchObject({ code: 'source_unavailable' })
  })
})
