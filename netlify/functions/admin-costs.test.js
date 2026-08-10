import { describe, expect, it, vi } from 'vitest'
import { GatewayError } from './_shared/http.js'
import { createAdminCostsHandler } from './admin-costs.js'

const principal = { userId: 'admin-user', role: 'viewer', capabilities: ['costs:read'] }

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/costs',
    headers: { authorization: 'Bearer verified-token' },
    queryStringParameters: { range: 'today' },
    ...overrides,
  }
}

function readyHandler(overrides = {}) {
  return createAdminCostsHandler({
    authorization: { require: vi.fn(async () => ({ ok: true, principal })) },
    projection: { read: vi.fn(async () => ({ contractVersion: 2, currency: 'USD' })) },
    effectiveConfigurationReader: { read: vi.fn(async () => ({ status: 'unavailable' })) },
    ...overrides,
  })
}

describe('authorized Admin costs endpoint', () => {
  it('requires costs:read for every direct API request', async () => {
    const authorization = { require: vi.fn(async () => ({ ok: true, principal })) }
    const projection = { read: vi.fn(async () => ({ contractVersion: 2, currency: 'USD' })) }
    const response = await readyHandler({ authorization, projection })(event())
    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'costs:read')
    expect(projection.read).toHaveBeenCalledOnce()
  })

  it.each([
    ['missing bearer', 401, 'unauthenticated'],
    ['student bearer', 401, 'unauthenticated'],
    ['ordinary guardian', 403, 'admin_access_denied'],
    ['revoked Admin', 403, 'admin_access_denied'],
    ['expired Admin', 403, 'admin_access_denied'],
    ['authorization uncertainty', 503, 'authorization_unavailable'],
  ])('rejects %s before reading costs', async (_label, statusCode, code) => {
    const projection = { read: vi.fn() }
    const authorization = {
      require: vi.fn(async () => ({
        ok: false,
        response: { statusCode, body: JSON.stringify({ error: { code } }) },
      })),
    }
    const response = await readyHandler({ authorization, projection })(event())
    expect(response.statusCode).toBe(statusCode)
    expect(projection.read).not.toHaveBeenCalled()
  })

  it('rejects alternate paths and methods without reading data', async () => {
    const projection = { read: vi.fn() }
    const authorization = { require: vi.fn() }
    const handler = readyHandler({ authorization, projection })
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/costs/raw' }))).statusCode).toBe(404)
    expect(authorization.require).not.toHaveBeenCalled()
    expect(projection.read).not.toHaveBeenCalled()
  })

  it('maps source failures to bounded error codes without raw exception text', async () => {
    const handler = readyHandler({
      projection: { read: vi.fn(async () => { throw new Error('SQL SECRET provider payload') }) },
    })
    const response = await handler(event())
    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'internal_error' } })
    expect(response.body).not.toContain('SECRET')
  })

  it.each([
    [new GatewayError(503, 'service_unavailable'), 503, 'cost_source_unavailable'],
    [new GatewayError(504, 'upstream_timeout'), 504, 'cost_source_timeout'],
  ])('distinguishes an authorized source failure from authorization uncertainty', async (failure, status, code) => {
    const handler = readyHandler({
      projection: { read: vi.fn(async () => { throw failure }) },
    })
    const response = await handler(event())
    expect(response.statusCode).toBe(status)
    expect(JSON.parse(response.body)).toEqual({ error: { code } })
  })

  it('adds an exact monthly calculated-cost threshold classification', async () => {
    const projection = {
      read: vi.fn(async () => ({
        contractVersion: 2,
        currency: 'USD',
        range: { kind: 'month' },
        summary: {
          calculatedCost: { status: 'available', micros: '9007199254740993', currency: 'USD' },
        },
      })),
    }
    const configuration = {
      status: 'available',
      revisions: {
        'cost.warning.monthly_micros': '3',
        'cost.critical.monthly_micros': '4',
      },
      costThresholds: {
        warningMonthlyMicros: '10000000',
        criticalMonthlyMicros: '25000000',
      },
    }
    const response = await readyHandler({
      projection,
      effectiveConfigurationReader: { read: vi.fn(async () => configuration) },
    })(event())
    expect(JSON.parse(response.body).monthlyCostThreshold).toEqual({
      status: 'critical',
      reason: null,
      basis: 'calculated_usage_estimate',
      observedMicros: '9007199254740993',
      warningMicros: '10000000',
      criticalMicros: '25000000',
      configurationRevisions: { warning: '3', critical: '4' },
    })
  })

  it('keeps cost evidence readable while marking unavailable configuration explicitly', async () => {
    const response = await readyHandler({
      projection: { read: vi.fn(async () => ({
        contractVersion: 2, currency: 'USD', range: { kind: 'month' },
        summary: { calculatedCost: { status: 'available', micros: '1', currency: 'USD' } },
      })) },
    })(event())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).monthlyCostThreshold).toMatchObject({
      status: 'unavailable', reason: 'configuration_unavailable',
    })
  })
})
