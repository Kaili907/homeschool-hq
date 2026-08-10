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
    projection: { read: vi.fn(async () => ({
      contractVersion: 3,
      generatedAt: '2026-08-10T18:30:00.000Z',
      currency: 'USD',
    })) },
    monthlyCostAlertEvaluator: { read: vi.fn(async () => ({
      contractVersion: 1,
      status: 'normal',
      activeCritical: false,
    })) },
    ...overrides,
  })
}

describe('authorized Admin costs endpoint', () => {
  it('requires costs:read for every direct API request', async () => {
    const authorization = { require: vi.fn(async () => ({ ok: true, principal })) }
    const projection = { read: vi.fn(async () => ({
      contractVersion: 3,
      generatedAt: '2026-08-10T18:30:00.000Z',
      currency: 'USD',
    })) }
    const monthlyCostAlertEvaluator = { read: vi.fn(async () => ({ status: 'warning' })) }
    const response = await readyHandler({ authorization, projection, monthlyCostAlertEvaluator })(event())
    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'costs:read')
    expect(projection.read).toHaveBeenCalledOnce()
    expect(monthlyCostAlertEvaluator.read).toHaveBeenCalledWith({
      generatedAt: '2026-08-10T18:30:00.000Z',
    })
    expect(JSON.parse(response.body)).toMatchObject({
      contractVersion: 4,
      monthlyCostAlert: { status: 'warning' },
    })
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
    const monthlyCostAlertEvaluator = { read: vi.fn() }
    const authorization = {
      require: vi.fn(async () => ({
        ok: false,
        response: { statusCode, body: JSON.stringify({ error: { code } }) },
      })),
    }
    const response = await readyHandler({
      authorization, projection, monthlyCostAlertEvaluator,
    })(event())
    expect(response.statusCode).toBe(statusCode)
    expect(projection.read).not.toHaveBeenCalled()
    expect(monthlyCostAlertEvaluator.read).not.toHaveBeenCalled()
  })

  it('rejects alternate paths and methods without reading data', async () => {
    const projection = { read: vi.fn() }
    const monthlyCostAlertEvaluator = { read: vi.fn() }
    const authorization = { require: vi.fn() }
    const handler = readyHandler({ authorization, projection, monthlyCostAlertEvaluator })
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/costs/raw' }))).statusCode).toBe(404)
    expect((await handler(event({ body: '{"monthlyCostMicros":"1"}' }))).statusCode).toBe(400)
    expect(authorization.require).not.toHaveBeenCalled()
    expect(projection.read).not.toHaveBeenCalled()
    expect(monthlyCostAlertEvaluator.read).not.toHaveBeenCalled()
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
})
