import { describe, expect, it, vi } from 'vitest'
import { createAdminHealthSource, disabledHealthEngines } from './admin-health-source.js'

describe('System Health telemetry source', () => {
  it('uses the canonical service-only ADMIN-2 read seam with engines:read', async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: [], error: null })
    const rpc = vi.fn(() => ({ abortSignal }))
    const source = createAdminHealthSource({ client: { rpc } })
    await expect(source.list()).resolves.toEqual({
      events: [], rejectedRows: 0, sourceTruncated: false,
    })
    expect(rpc).toHaveBeenCalledWith('academy_list_operational_events_v2', {
      p_scope: null, p_household_id: null, p_learner_id: null,
      p_limit: 500, p_required_capability: 'engines:read',
    })
    expect(abortSignal).toHaveBeenCalledOnce()
  })

  it('fails without a service source and never returns database details', async () => {
    const source = createAdminHealthSource({ env: {} })
    await expect(source.list()).rejects.toThrow('health_source_unavailable')
  })

  it('derives disabled states only from server-owned exact-default-off gates', () => {
    expect([...disabledHealthEngines({})]).toEqual(['study', 'tts', 'gateway'])
    expect([...disabledHealthEngines({
      ACADEMY_STUDY_ENABLED: 'true', ACADEMY_TTS_ENABLED: 'on', ACADEMY_AI_ENABLED: '1',
    })]).toEqual([])
    expect([...disabledHealthEngines({ ACADEMY_STUDY_ENABLED: 'true' })]).toEqual(['tts', 'gateway'])
  })
})
