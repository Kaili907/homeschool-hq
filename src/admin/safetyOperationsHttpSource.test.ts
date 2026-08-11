import { describe, expect, it, vi } from 'vitest'
import { readAdminSafetyOperations } from './safetyOperationsHttpSource'

function snapshot() {
  const metric = { status: 'available' as const, value: 0 }
  return {
    schemaVersion: 1 as const,
    observedAt: '2026-08-08T13:00:00.000Z',
    summary: {
      openSafetyStops: metric, resolvedSafetyStops: metric, adultReviewPending: metric,
      failClosedEvents: metric, safetyStopEvents: metric, fallbackRejectionEvents: metric,
      unresolvedSafetyConditions: metric,
    },
    sources: [
      { source: 'operational-telemetry' as const, status: 'available' as const },
      { source: 'study-adult-review' as const, status: 'available' as const },
      { source: 'study-safety-monitoring' as const, status: 'available' as const },
    ],
    operationalTelemetry: { status: 'available' as const },
    events: [],
    page: { limit: 50, nextCursor: null },
  }
}

describe('ADMIN-10B browser safety source', () => {
  it('sends only the bearer to the read-only endpoint and accepts the bounded DTO', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => snapshot() }))
    const result = await readAdminSafetyOperations({
      getAccessToken: async () => 'verified.access.token',
      fetchImpl,
    })
    expect(result).toEqual({ status: 'ready', snapshot: snapshot() })
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/v1/safety-operations?limit=50', expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer verified.access.token' },
      cache: 'no-store',
      credentials: 'omit',
    }))
  })

  it.each([
    [401, 'read_failed'], [403, 'read_failed'], [503, 'source_unavailable'],
  ] as const)('fails closed for HTTP %s', async (status, reasonCode) => {
    const result = await readAdminSafetyOperations({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status, json: async () => ({ error: { code: 'raw-error' } }) }),
    })
    expect(result).toEqual({ status: 'unavailable', reasonCode })
  })

  it('rejects missing identity, invalid scope, excessive limits, and malformed wire data', async () => {
    await expect(readAdminSafetyOperations({ getAccessToken: async () => null }))
      .resolves.toEqual({ status: 'unavailable', reasonCode: 'read_failed' })
    await expect(readAdminSafetyOperations({ getAccessToken: async () => 'token', limit: 101 }))
      .resolves.toEqual({ status: 'unavailable', reasonCode: 'read_failed' })
    await expect(readAdminSafetyOperations({
      getAccessToken: async () => 'token',
      learnerRef: '20000000-0000-4000-8000-000000000001',
    })).resolves.toEqual({ status: 'unavailable', reasonCode: 'read_failed' })
    await expect(readAdminSafetyOperations({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status: 200, json: async () => ({ rawMetadata: 'private' }) }),
    })).resolves.toEqual({ status: 'unavailable', reasonCode: 'read_failed' })
  })

  it('rejects malformed partial rows instead of displaying a false zero-safety summary', async () => {
    const malformed = {
      ...snapshot(),
      events: [{ eventId: 'raw-event', rawException: 'private safety provider response' }],
    }
    await expect(readAdminSafetyOperations({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({ status: 200, json: async () => malformed }),
    })).resolves.toEqual({ status: 'unavailable', reasonCode: 'read_failed' })

    const extraAggregate = snapshot()
    await expect(readAdminSafetyOperations({
      getAccessToken: async () => 'token',
      fetchImpl: async () => ({
        status: 200,
        json: async () => ({ ...extraAggregate, summary: { ...extraAggregate.summary, hiddenFailures: 1 } }),
      }),
    })).resolves.toEqual({ status: 'unavailable', reasonCode: 'read_failed' })
  })
})
