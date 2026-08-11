import { describe, expect, it, vi } from 'vitest'
import { buildSystemHealthProjection } from './systemHealth'
import {
  loadAdminAttentionCenter,
  type AdminAttentionLoaderDependencies,
} from './attentionLoader'

describe('Admin Attention Center loader authorization', () => {
  it('calls only source endpoints whose domain capability the caller has', async () => {
    const unavailable = vi.fn(async () => { throw new Error('must not be called') })
    const readHealth = vi.fn(async () => ({
      status: 'ready' as const,
      projection: {
        ...buildSystemHealthProjection([], { now: new Date('2026-08-10T18:00:00.000Z') }),
        overallHealth: 'healthy' as const,
        overallReasonCodes: ['operating_normally' as const],
        observedAt: '2026-08-10T17:59:00.000Z',
        freshness: 'current' as const,
      },
    }))
    const dependencies = {
      readReadiness: unavailable,
      readHealth,
      readConfiguration: unavailable,
      readLearners: unavailable,
      readSafety: unavailable,
      readCosts: unavailable,
    } as unknown as AdminAttentionLoaderDependencies

    const model = await loadAdminAttentionCenter(['health:read'], {
      signal: new AbortController().signal,
      today: '2026-08-10',
      dependencies,
    })

    expect(readHealth).toHaveBeenCalledOnce()
    expect(unavailable).not.toHaveBeenCalled()
    expect(model.visibleDomains).toEqual(['health'])
    expect(model.evidence.status).toBe('complete')
  })

  it('keeps sibling evidence available and never emits an all-clear when one required source fails', async () => {
    const unavailable = vi.fn(async () => { throw new Error('private provider failure') })
    const readHealth = vi.fn(async () => ({
      status: 'ready' as const,
      projection: buildSystemHealthProjection([], { now: new Date('2026-08-10T18:00:00.000Z') }),
    }))
    const dependencies = {
      readReadiness: unavailable,
      readHealth,
      readConfiguration: unavailable,
      readLearners: unavailable,
      readSafety: unavailable,
      readCosts: unavailable,
    } as unknown as AdminAttentionLoaderDependencies

    const model = await loadAdminAttentionCenter(['health:read', 'costs:read'], {
      signal: new AbortController().signal,
      today: '2026-08-10',
      dependencies,
    })

    expect(readHealth).toHaveBeenCalledOnce()
    expect(model.evidence).toMatchObject({
      status: 'partial', expectedSourceCount: 2, availableSourceCount: 1,
      unavailableDomains: ['costs'],
    })
    expect(model.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ domain: 'costs', itemType: 'evidence-unavailable', retryable: true }),
    ]))
  })
})
