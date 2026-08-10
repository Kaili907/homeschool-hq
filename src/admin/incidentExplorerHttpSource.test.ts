import { describe, expect, it, vi } from 'vitest'
import {
  AdminIncidentReadError,
  decodeAdminIncidentPage,
  readAdminIncidentPage,
} from './incidentExplorerHttpSource'
import type { AdminIncidentFilters } from './incidentExplorerModel'

const FILTERS: AdminIncidentFilters = {
  correlationId: '20000000-0000-4000-8000-000000000001',
  occurredFrom: '2026-08-10T14:00:00.000Z',
  occurredTo: '2026-08-10T16:00:00.000Z',
  domain: 'all',
  engine: 'gateway',
  result: 'timeout',
  limit: 25,
}

const EVENT = {
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-10T15:00:00.000Z',
  correlationId: FILTERS.correlationId,
  source: 'runtime',
  facts: {
    engine: 'gateway', eventType: 'gateway.request', result: 'timeout', durationMs: 500,
    operation: 'anthropic_messages', reasonCode: 'provider_timeout', provider: 'anthropic',
    httpStatus: 504, failureStage: null, retryable: true,
  },
} as const

const PAGE = {
  schemaVersion: 2,
  generatedAt: '2026-08-10T16:00:00.000Z',
  sortOrder: 'chronological',
  query: FILTERS,
  events: [EVENT],
  sources: { runtime: 'available', 'admin-audit': 'unauthorized', 'provider-accounting': 'available' },
  evidence: { status: 'partial', reasons: ['admin_audit_unauthorized'], rejectedEntries: 0 },
  nextCursor: 'safe_cursor',
} as const

describe('Admin incident HTTP source', () => {
  it('sends only bounded filters and decodes the safe response contract', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = new URL(String(url), 'https://academy.test')
      expect(parsed.pathname).toBe('/api/admin/v1/correlations')
      expect(parsed.searchParams.get('correlationId')).toBe(FILTERS.correlationId)
      expect(parsed.searchParams.get('occurredFrom')).toBe(FILTERS.occurredFrom)
      expect(parsed.searchParams.get('occurredTo')).toBe(FILTERS.occurredTo)
      expect(parsed.searchParams.get('engine')).toBe('gateway')
      expect(parsed.searchParams.get('result')).toBe('timeout')
      expect(parsed.searchParams.get('limit')).toBe('25')
      expect(parsed.searchParams.get('cursor')).toBe('safe_cursor')
      return new Response(JSON.stringify(PAGE), { status: 200 })
    })
    await expect(readAdminIncidentPage(FILTERS, 'safe_cursor', {
      getAccessToken: async () => 'verified-token',
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toEqual(PAGE)
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', Authorization: 'Bearer verified-token' },
    }))
  })

  it('rejects a response event carrying a raw backend error or unknown field', () => {
    expect(() => decodeAdminIncidentPage({
      ...PAGE,
      events: [{ ...EVENT, rawError: 'database learner transcript SECRET' }],
    })).toThrowError(AdminIncidentReadError)
  })

  it('rejects protected content even when placed under an otherwise safe fact key', () => {
    expect(() => decodeAdminIncidentPage({
      ...PAGE,
      events: [{ ...EVENT, facts: { ...EVENT.facts, reasonCode: 'bearer.secret' } }],
    })).toThrowError(AdminIncidentReadError)
  })

  it('rejects out-of-order events, excessive pages, and unknown completeness reasons', () => {
    const later = { ...EVENT, eventId: '10000000-0000-4000-8000-000000000002', occurredAt: '2026-08-10T15:30:00.000Z' }
    expect(() => decodeAdminIncidentPage({ ...PAGE, events: [later, EVENT] })).toThrowError(AdminIncidentReadError)
    expect(() => decodeAdminIncidentPage({ ...PAGE, events: Array.from({ length: 101 }, () => EVENT) })).toThrowError(AdminIncidentReadError)
    expect(() => decodeAdminIncidentPage({
      ...PAGE, evidence: { status: 'partial', reasons: ['raw_error'], rejectedEntries: 1 },
    })).toThrowError(AdminIncidentReadError)
  })

  it.each([
    [401, 'incident_unauthorized'],
    [403, 'incident_unauthorized'],
    [400, 'invalid_query'],
    [504, 'incident_timeout'],
    [503, 'incident_unavailable'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    await expect(readAdminIncidentPage(FILTERS, null, {
      getAccessToken: async () => 'verified-token',
      fetchImpl: async () => new Response('{}', { status }),
    })).rejects.toMatchObject({ code })
  })

  it('fails closed without an access token and never fetches', async () => {
    const fetchImpl = vi.fn()
    await expect(readAdminIncidentPage(FILTERS, null, {
      getAccessToken: async () => null,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'incident_unauthorized' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
