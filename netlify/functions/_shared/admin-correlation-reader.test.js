import { describe, expect, it, vi } from 'vitest'
import {
  AdminCorrelationReadError,
  createAdminCorrelationReader,
  sanitizeAuditEntry,
  sanitizeCorrelationRows,
  sanitizeProviderEntry,
  sanitizeRuntimeEntry,
} from './admin-correlation-reader.js'

const runtime = (overrides = {}) => ({
  event_id: '10000000-0000-4000-8000-000000000001',
  execution_key: '20000000-0000-4000-8000-000000000001',
  occurred_at: '2026-08-10T15:00:00.000Z',
  engine: 'gateway', event_type: 'gateway.request', result: 'timeout', duration_ms: 500,
  metadata: { operation: 'anthropic_messages', reason_code: 'provider_timeout', provider: 'anthropic', http_status: 504, retryable: true },
  ...overrides,
})

const audit = (overrides = {}) => ({
  schemaVersion: 2,
  eventId: '10000000-0000-4000-8000-000000000002',
  occurredAt: '2026-08-10T15:01:00.000Z', actorRole: 'owner',
  action: 'configuration.update', resourceType: 'configuration', resourceRef: 'gateway.default_tier',
  resourceVersion: null, resourceRevision: '3', previousValue: { value: 'haiku' },
  newValue: { value: 'sonnet' }, reasonCode: 'configuration.updated',
  correlationId: '20000000-0000-4000-8000-000000000001',
  ...overrides,
})

const provider = (overrides = {}) => ({
  id: '10000000-0000-4000-8000-000000000003',
  execution_key: '20000000-0000-4000-8000-000000000001',
  occurred_at: '2026-08-10T15:00:30.000Z', engine: 'tutor', provider: 'anthropic',
  provider_product_id: 'claude-sonnet', logical_model_tier: 'sonnet', result: 'timeout',
  result_reason_code: 'provider_timeout', billing_disposition: 'unknown',
  cost_kind: 'unavailable', currency: 'USD',
  ...overrides,
})

describe('Admin correlation source sanitizers', () => {
  it('rebuilds runtime evidence from allowlisted operational facts only', () => {
    expect(sanitizeRuntimeEntry(runtime())).toEqual({
      eventId: runtime().event_id,
      occurredAt: runtime().occurred_at,
      correlationId: runtime().execution_key,
      source: 'runtime',
      facts: {
        engine: 'gateway', eventType: 'gateway.request', result: 'timeout', durationMs: 500,
        operation: 'anthropic_messages', reasonCode: 'provider_timeout', provider: 'anthropic',
        httpStatus: 504, failureStage: null, retryable: true,
      },
    })
  })

  it('keeps Admin audit transitions distinct and minimized', () => {
    expect(sanitizeAuditEntry(audit())).toMatchObject({
      source: 'admin-audit',
      facts: {
        actorRole: 'owner', action: 'configuration.update', resourceType: 'configuration',
        resourceRef: 'gateway.default_tier', previousValue: { value: 'haiku' },
        newValue: { value: 'sonnet' },
      },
    })
  })

  it('returns provider accounting state without account, learner, usage payload, or bigint cost data', () => {
    const projected = sanitizeProviderEntry(provider())
    expect(projected).toMatchObject({
      source: 'provider-accounting',
      facts: { provider: 'anthropic', billingDisposition: 'unknown', costKind: 'unavailable' },
    })
    expect(JSON.stringify(projected)).not.toMatch(/accountRef|account_id|household|learner|input.?token|output.?token|costMicros/i)
  })

  it('rejects one malformed row without corrupting valid timeline evidence', () => {
    const decoded = sanitizeCorrelationRows([
      runtime(),
      runtime({ event_id: 'bad', metadata: { raw_error: 'backend transcript SECRET' } }),
      runtime({ event_id: '10000000-0000-4000-8000-000000000004' }),
    ], sanitizeRuntimeEntry, false, 50)
    expect(decoded.events).toHaveLength(2)
    expect(decoded.rejectedEntries).toBe(1)
    expect(JSON.stringify(decoded)).not.toMatch(/backend|transcript|SECRET/)
  })

  it.each([
    runtime({ metadata: { prompt: 'private lesson content' } }),
    runtime({ metadata: { reason_code: 'bearer.secret' } }),
    { ...runtime(), rawError: 'database learner transcript' },
  ])('rejects prohibited runtime content and raw backend errors', (row) => {
    expect(() => sanitizeRuntimeEntry(row)).toThrowError(AdminCorrelationReadError)
  })

  it('rejects unsafe audit values and provider identity fields rather than passing through unknown keys', () => {
    expect(() => sanitizeAuditEntry(audit({ newValue: { value: 'sk.secret' } }))).toThrowError(AdminCorrelationReadError)
    expect(() => sanitizeProviderEntry({ ...provider(), account_id: 'private-account' })).toThrowError(AdminCorrelationReadError)
  })

  it('rejects malformed and secret-like correlation identifiers', () => {
    expect(() => sanitizeRuntimeEntry(runtime({ execution_key: 'bearer.secret' }))).toThrowError(AdminCorrelationReadError)
    expect(() => sanitizeProviderEntry(provider({ execution_key: 'has spaces' }))).toThrowError(AdminCorrelationReadError)
  })

  it('uses existing bounded indexed sources with field-minimized selects and exact filters', async () => {
    function builder(data) {
      const calls = []
      const value = {
        calls,
        select: vi.fn((...args) => { calls.push(['select', ...args]); return value }),
        gte: vi.fn((...args) => { calls.push(['gte', ...args]); return value }),
        lt: vi.fn((...args) => { calls.push(['lt', ...args]); return value }),
        lte: vi.fn((...args) => { calls.push(['lte', ...args]); return value }),
        eq: vi.fn((...args) => { calls.push(['eq', ...args]); return value }),
        order: vi.fn((...args) => { calls.push(['order', ...args]); return value }),
        limit: vi.fn((...args) => { calls.push(['limit', ...args]); return value }),
        or: vi.fn((...args) => { calls.push(['or', ...args]); return value }),
        abortSignal: vi.fn(async () => ({ data, error: null })),
      }
      return value
    }
    const providerBuilder = builder([provider()])
    const runtimeRpcBuilder = { abortSignal: vi.fn(async () => ({
      data: {
        schemaVersion: 2, events: [runtime()], hasMore: false,
        diagnosticRetentionComplete: true,
      },
      error: null,
    })) }
    const auditBuilder = { abortSignal: vi.fn(async () => ({
      data: { schemaVersion: 2, events: [audit()], hasMore: false }, error: null,
    })) }
    const client = {
      from: vi.fn(() => providerBuilder),
      rpc: vi.fn((name) => name === 'academy_admin_read_incident_runtime_v1'
        ? runtimeRpcBuilder : auditBuilder),
    }
    const reader = createAdminCorrelationReader({ client })
    const query = {
      correlationId: runtime().execution_key,
      occurredFrom: '2026-08-10T14:00:00.000Z', occurredTo: '2026-08-10T16:00:00.000Z',
      domain: 'all', engine: 'gateway', result: 'timeout', limit: 25,
    }
    await reader.runtime(query, null)
    await reader.audit(query, null)
    await reader.providerAccounting(query, null)

    expect(client.from).toHaveBeenCalledWith('academy_provider_usage_ledger')
    expect(providerBuilder.select.mock.calls[0][0]).not.toMatch(/account|household|learner|token|cost_micros/i)
    expect(providerBuilder.lte).toHaveBeenCalledWith('occurred_at', query.occurredTo)
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_read_incident_runtime_v1', {
      p_limit: 25, p_before_at: null, p_before_event_id: null,
      p_occurred_from: query.occurredFrom, p_occurred_to: query.occurredTo,
      p_correlation_id: query.correlationId, p_engine: 'gateway', p_result: 'timeout',
      p_required_capability: 'engines:read',
    })
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_read_audit_events_v1', expect.objectContaining({
      p_limit: 25, p_correlation_id: query.correlationId,
      p_occurred_from: query.occurredFrom, p_occurred_to: query.occurredTo,
      p_required_capability: 'audit:read',
    }))
  })
})
