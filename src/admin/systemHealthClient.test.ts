import { describe, expect, it, vi } from 'vitest'
import type { AdminOperationalEvent } from './contracts'
import { buildSystemHealthProjection } from './systemHealth'
import { decodeSystemHealthProjection, readSystemHealth } from './systemHealthClient'

const NOW = new Date('2026-08-08T12:00:00.000Z')
const EVENT: AdminOperationalEvent = {
  schemaVersion: 2,
  eventId: '00000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-08T11:59:00.000Z',
  scope: 'system', householdRef: null, learnerRef: null,
  engine: 'gateway', appVersion: 'deploy.1', engineVersion: 'gateway.1', curriculumVersion: null,
  courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
  eventType: 'gateway.request', result: 'provider_error', durationMs: 900,
  metadata: { reason_code: 'provider_rejected' },
}

describe('System Health browser read boundary', () => {
  it('decodes the exact bounded DTO and rejects extra or unsafe fields', () => {
    const projection = buildSystemHealthProjection([EVENT], { now: NOW })
    expect(decodeSystemHealthProjection(projection)).toEqual(projection)
    expect(decodeSystemHealthProjection({ ...projection, rawException: 'SECRET' })).toBeNull()
    expect(decodeSystemHealthProjection({
      ...projection,
      engines: projection.engines.map((engine, index) => index === 0 ? { ...engine, providerBody: 'SECRET' } : engine),
    })).toBeNull()
    expect(decodeSystemHealthProjection({
      ...projection,
      incidents: [{ ...projection.incidents[0], reasonCode: 'raw_exception_SECRET' }],
    })).toBeNull()
  })

  it('uses bearer authorization, no credentials, and the selected bounded window', async () => {
    const projection = buildSystemHealthProjection([EVENT], { now: NOW, selectedWindow: '24h' })
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => projection }))
    await expect(readSystemHealth({
      window: '24h', getAccessToken: async () => 'verified.access.token', fetchImpl,
    })).resolves.toEqual({ status: 'ready', projection })
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/v1/health?window=24h', expect.objectContaining({
      method: 'GET', headers: { Authorization: 'Bearer verified.access.token' },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    }))
  })

  it('fails closed without a token, on server denial, or on a malformed response', async () => {
    const fetchImpl = vi.fn()
    await expect(readSystemHealth({ window: '1h', getAccessToken: async () => null, fetchImpl })).resolves.toEqual({ status: 'denied' })
    expect(fetchImpl).not.toHaveBeenCalled()
    await expect(readSystemHealth({
      window: '1h', getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status: 403, json: async () => ({}) }),
    })).resolves.toEqual({ status: 'denied' })
    await expect(readSystemHealth({
      window: '1h', getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status: 200, json: async () => ({ raw: 'SECRET' }) }),
    })).resolves.toEqual({ status: 'error', code: 'health_unavailable' })
  })
})
