import { describe, expect, it, vi } from 'vitest'
import {
  createAdminCorrelationsHandler,
  decodeCorrelationCursor,
  parseCorrelationQuery,
} from './admin-correlations.js'
import { AdminCorrelationReadError } from './_shared/admin-correlation-reader.js'

const NOW = '2026-08-10T16:00:00.000Z'
const CORRELATION_ID = '20000000-0000-4000-8000-000000000001'

const runtimeEvent = (overrides = {}) => ({
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-10T15:01:00.000Z',
  correlationId: CORRELATION_ID,
  source: 'runtime',
  facts: {
    engine: 'gateway', eventType: 'gateway.request', result: 'provider_error',
    durationMs: 420, operation: 'anthropic_messages', reasonCode: 'provider_timeout',
    provider: 'anthropic', httpStatus: 504, failureStage: null, retryable: true,
  },
  ...overrides,
})

const auditEvent = (overrides = {}) => ({
  eventId: '10000000-0000-4000-8000-000000000002',
  occurredAt: '2026-08-10T15:02:00.000Z',
  correlationId: CORRELATION_ID,
  source: 'admin-audit',
  facts: {
    actorRole: 'admin', action: 'incident.acknowledge', resourceType: 'incident',
    resourceRef: 'incident-42', resourceVersion: null, resourceRevision: '2',
    previousValue: { status: 'open' }, newValue: { status: 'acknowledged' },
    reasonCode: 'incident.acknowledged',
  },
  ...overrides,
})

const providerEvent = (overrides = {}) => ({
  eventId: '10000000-0000-4000-8000-000000000003',
  occurredAt: '2026-08-10T15:00:30.000Z',
  correlationId: CORRELATION_ID,
  source: 'provider-accounting',
  facts: {
    engine: 'tutor', provider: 'anthropic', providerProductId: 'claude-sonnet',
    logicalModelTier: 'sonnet', result: 'provider_error', resultReasonCode: 'provider_timeout',
    billingDisposition: 'unknown', costKind: 'unavailable', currency: 'USD',
  },
  ...overrides,
})

const request = (rawQueryString = '') => ({
  httpMethod: 'GET',
  path: '/api/admin/v1/correlations',
  headers: { authorization: 'Bearer verified-token' },
  rawQueryString,
})

const success = (events = [], overrides = {}) => ({
  events,
  rejectedEntries: 0,
  hasMore: false,
  ...overrides,
})

function setup({ authorization, runtime, audit, providerAccounting } = {}) {
  const auth = authorization ?? { require: vi.fn(async () => ({ ok: true, principal: { role: 'viewer' } })) }
  const reader = {
    runtime: vi.fn(async () => runtime ?? success([runtimeEvent()])),
    audit: vi.fn(async () => audit ?? success([auditEvent()])),
    providerAccounting: vi.fn(async () => providerAccounting ?? success([providerEvent()])),
  }
  return {
    authorization: auth,
    reader,
    handler: createAdminCorrelationsHandler({ authorization: auth, reader, now: () => NOW }),
  }
}

describe('GET /api/admin/v1/correlations', () => {
  it('builds one chronological correlation timeline without collapsing source semantics', async () => {
    const { handler, authorization, reader } = setup()
    const response = await handler(request(`correlationId=${CORRELATION_ID}`))
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.events.map((event) => event.source)).toEqual([
      'provider-accounting', 'runtime', 'admin-audit',
    ])
    expect(body.sortOrder).toBe('chronological')
    expect(body.evidence).toEqual({ status: 'complete', reasons: [], rejectedEntries: 0 })
    expect(body.sources).toEqual({
      runtime: 'available', 'admin-audit': 'available', 'provider-accounting': 'available',
    })
    expect(authorization.require.mock.calls.map((call) => call[1]).sort()).toEqual([
      'audit:read', 'costs:read', 'engines:read',
    ])
    for (const method of [reader.runtime, reader.audit, reader.providerAccounting]) {
      expect(method).toHaveBeenCalledWith(expect.objectContaining({
        correlationId: CORRELATION_ID,
        occurredFrom: '2026-08-09T16:00:00.000Z',
        occurredTo: NOW,
        limit: 50,
      }), null)
    }
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('omits an unauthorized source while preserving independently authorized evidence', async () => {
    const authorization = { require: vi.fn(async (_event, capability) => capability === 'audit:read'
      ? { ok: false, response: { statusCode: 403, body: '{}' } }
      : { ok: true, principal: { role: 'viewer' } }) }
    const { handler, reader } = setup({ authorization })
    const body = JSON.parse((await handler(request(`correlationId=${CORRELATION_ID}`))).body)
    expect(body.events.map((event) => event.source)).toEqual(['provider-accounting', 'runtime'])
    expect(body.sources['admin-audit']).toBe('unauthorized')
    expect(body.evidence).toEqual({
      status: 'partial', reasons: ['admin_audit_unauthorized'], rejectedEntries: 0,
    })
    expect(reader.audit).not.toHaveBeenCalled()
  })

  it('keeps an independent source failure bounded and leaves the other sources usable', async () => {
    const { handler, reader } = setup()
    reader.audit.mockRejectedValue(new AdminCorrelationReadError('source_timeout'))
    const response = await handler(request())
    const body = JSON.parse(response.body)
    expect(response.statusCode).toBe(200)
    expect(body.events).toHaveLength(2)
    expect(body.sources['admin-audit']).toBe('timeout')
    expect(body.evidence.reasons).toContain('admin_audit_timeout')
  })

  it('surfaces rejected malformed entries as partial without returning raw data', async () => {
    const { handler, reader } = setup()
    reader.runtime.mockResolvedValue(success([runtimeEvent()], { rejectedEntries: 1 }))
    const body = JSON.parse((await handler(request())).body)
    expect(body.evidence).toEqual({
      status: 'partial', reasons: ['runtime_malformed_entries'], rejectedEntries: 1,
    })
    expect(JSON.stringify(body)).not.toMatch(/prompt|transcript|raw backend error|secret/i)
  })

  it('returns an explicit empty result for a missing correlation', async () => {
    const { handler, reader } = setup()
    reader.runtime.mockResolvedValue(success())
    reader.audit.mockResolvedValue(success())
    reader.providerAccounting.mockResolvedValue(success())
    const body = JSON.parse((await handler(request(`correlationId=${CORRELATION_ID}`))).body)
    expect(body.events).toEqual([])
    expect(body.evidence.status).toBe('complete')
    expect(body.nextCursor).toBeNull()
  })

  it('paginates with an opaque cursor bound to the exact safe query', async () => {
    const older = runtimeEvent({
      eventId: '10000000-0000-4000-8000-000000000004',
      occurredAt: '2026-08-10T14:59:00.000Z',
    })
    const { handler, reader } = setup({ runtime: success([runtimeEvent(), older], { hasMore: true }) })
    reader.audit.mockResolvedValue(success())
    reader.providerAccounting.mockResolvedValue(success())
    const first = JSON.parse((await handler(request(`correlationId=${CORRELATION_ID}&limit=1`))).body)
    expect(first.events).toHaveLength(1)
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/)

    const parsed = parseCorrelationQuery(request(`correlationId=${CORRELATION_ID}&limit=1`), NOW)
    expect(decodeCorrelationCursor(first.nextCursor, parsed.queryHash).runtime).toEqual({
      occurredAt: runtimeEvent().occurredAt,
      eventId: runtimeEvent().eventId,
    })
    const changed = await handler(request(`correlationId=${CORRELATION_ID}&limit=2&cursor=${first.nextCursor}`))
    expect(changed.statusCode).toBe(400)
    expect(JSON.parse(changed.body).error.code).toBe('invalid_cursor')
  })

  it('merges a maximum 100-event correlation page and keeps older evidence behind a cursor', async () => {
    const events = Array.from({ length: 100 }, (_, index) => runtimeEvent({
      eventId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      occurredAt: new Date(Date.parse(NOW) - (index + 1) * 1_000).toISOString(),
    }))
    const { handler } = setup({ runtime: success(events, { hasMore: true }) })
    const started = performance.now()
    const response = await handler(request('domain=runtime&limit=100'))
    console.info(`[admin-performance] 100-event correlation page ${(performance.now() - started).toFixed(1)}ms`)
    const body = JSON.parse(response.body)
    expect(response.statusCode).toBe(200)
    expect(body.events).toHaveLength(100)
    expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(body.events[0].occurredAt).toBe(events.at(-1).occurredAt)
    expect(body.events.at(-1).occurredAt).toBe(events[0].occurredAt)
    expect(response.body.length).toBeLessThan(150_000)
  })

  it('applies domain, time, engine, result, and audit filters server-side', async () => {
    const { handler, authorization, reader } = setup()
    const query = new URLSearchParams({
      occurredFrom: '2026-08-10T14:00:00Z', occurredTo: NOW,
      domain: 'runtime', engine: 'gateway', result: 'timeout', limit: '25',
    }).toString()
    const response = await handler(request(query))
    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledOnce()
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'engines:read')
    expect(reader.runtime).toHaveBeenCalledWith(expect.objectContaining({
      occurredFrom: '2026-08-10T14:00:00.000Z', occurredTo: NOW,
      domain: 'runtime', engine: 'gateway', result: 'timeout', limit: 25,
    }), null)
    expect(reader.audit).not.toHaveBeenCalled()
    expect(reader.providerAccounting).not.toHaveBeenCalled()
  })

  it.each([
    'occurredFrom=2026-08-10T00%3A00%3A00Z',
    'occurredFrom=2026-01-01T00%3A00%3A00Z&occurredTo=2026-08-10T00%3A00%3A00Z',
    'occurredFrom=2026-08-10T15%3A00%3A00Z&occurredTo=2026-08-10T14%3A00%3A00Z',
    'engine=unknown', 'result=raw_error', 'domain=logs', 'limit=101',
    'correlationId=bearer.secret', 'search=learner', 'limit=1&limit=2',
  ])('rejects unsafe or unbounded query %s before authorization', async (query) => {
    const { handler, authorization } = setup()
    const response = await handler(request(query))
    expect(response.statusCode).toBe(400)
    expect(authorization.require).not.toHaveBeenCalled()
  })

  it('returns 401 before any source read when the bearer is not authenticated', async () => {
    const authorization = { require: vi.fn(async () => ({
      ok: false,
      response: { statusCode: 401, headers: {}, body: JSON.stringify({ error: { code: 'authentication_required' } }) },
    })) }
    const { handler, reader } = setup({ authorization })
    const response = await handler(request())
    expect(response.statusCode).toBe(401)
    expect(reader.runtime).not.toHaveBeenCalled()
  })

  it('rejects non-GET methods and unknown paths', async () => {
    const { handler } = setup()
    expect((await handler({ ...request(), httpMethod: 'POST' })).statusCode).toBe(405)
    expect((await handler({ ...request(), path: '/api/admin/v1/correlations/export' })).statusCode).toBe(404)
  })
})
