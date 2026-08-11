import { describe, expect, it, vi } from 'vitest'
import { createStudySessionTelemetryScheduledEntrypoint } from './_shared/study-session-telemetry/scheduled.js'
import { createStudySessionTelemetryDeliverHandler } from './study-session-telemetry-deliver.js'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.example.test',
  SUPABASE_ANON_KEY: 'public-anon-test-key',
  ACADEMY_APP_VERSION: 'deploy.2026.08.10',
  ACADEMY_STUDY_ENGINE_VERSION: 'study.v2',
})
const DELIVERY_RESULT = Object.freeze({
  schemaVersion: 1,
  delivery: Object.freeze({
    schemaVersion: 1,
    category: 'processed',
    claimed: 2,
    delivered: 1,
    replayed: 1,
    retryScheduled: 0,
    leaseLost: 0,
    acknowledgementFailed: 0,
  }),
  health: Object.freeze({
    schemaVersion: 1,
    worker: 'available',
    pendingCount: null,
    oldestPendingAgeBucket: null,
    deliveryResultCategory: 'processed',
  }),
})

function event(overrides = {}) {
  return {
    httpMethod: 'POST',
    path: '/api/admin/v1/study-telemetry-delivery',
    headers: {
      authorization: 'Bearer verified-admin-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ schemaVersion: 1, action: 'deliver' }),
    ...overrides,
  }
}

function permitted() {
  return { require: vi.fn(async () => ({ ok: true, principal: { role: 'admin' } })) }
}

describe('Study session telemetry authorized manual endpoint', () => {
  it('requires engines:operate and invokes a fixed shared worker entrypoint', async () => {
    const authorization = permitted()
    const runDelivery = vi.fn(async () => DELIVERY_RESULT)
    const handler = createStudySessionTelemetryDeliverHandler({ env: ENV, authorization, runDelivery })
    const response = await handler(event())

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual(DELIVERY_RESULT)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'engines:operate')
    expect(runDelivery).toHaveBeenCalledWith({ env: ENV })
  })

  it('refuses unauthorized and forged-header invocations before worker access', async () => {
    const runDelivery = vi.fn()
    const authorization = {
      require: vi.fn(async () => ({
        ok: false,
        response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' },
      })),
    }
    const handler = createStudySessionTelemetryDeliverHandler({ env: ENV, authorization, runDelivery })
    const response = await handler(event({
      headers: {
        authorization: 'Bearer learner-token',
        'content-type': 'application/json',
        'x-admin-role': 'owner',
        'x-admin-capabilities': 'engines:operate',
        'x-nf-event': 'schedule',
      },
    }))

    expect(response.statusCode).toBe(403)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'engines:operate')
    expect(runDelivery).not.toHaveBeenCalled()
  })

  it.each([
    { schemaVersion: 1, action: 'deliver', limit: 50 },
    { schemaVersion: 1, action: 'deliver', leaseSeconds: 120 },
    { schemaVersion: 1, action: 'deliver', appVersion: 'latest' },
    { schemaVersion: 1, action: 'deliver', workerIdentity: 'forged' },
  ])('rejects caller-authored worker settings and authority', async (body) => {
    const authorization = permitted()
    const runDelivery = vi.fn()
    const handler = createStudySessionTelemetryDeliverHandler({ env: ENV, authorization, runDelivery })
    const response = await handler(event({ body: JSON.stringify(body) }))
    expect(response.statusCode).toBe(400)
    expect(authorization.require).not.toHaveBeenCalled()
    expect(runDelivery).not.toHaveBeenCalled()
  })

  it('exposes minimized authorized readiness with no learner data', async () => {
    const authorization = permitted()
    const handler = createStudySessionTelemetryDeliverHandler({ env: ENV, authorization })
    const response = await handler(event({ httpMethod: 'GET', body: undefined }))
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      schemaVersion: 1,
      workerCode: 'available',
      manualAuthority: 'configured',
      scheduledEntrypoint: 'available',
      schedule: 'not_configured',
      deploymentVersions: 'configured',
      telemetryWriter: 'available',
    })
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'engines:read')
    expect(response.body).not.toMatch(/learner|student|answer|transcript|note|safety|secret|provider/i)
  })

  it.each(['no_work', 'processed', 'partial_with_retryable_failures', 'failed', 'unavailable'])(
    'preserves the %s delivery category and never projects raw failures',
    async (category) => {
      const handler = createStudySessionTelemetryDeliverHandler({
        env: ENV,
        authorization: permitted(),
        runDelivery: async () => ({
          ...DELIVERY_RESULT,
          secret: 'hidden',
          delivery: { ...DELIVERY_RESULT.delivery, category, rawDatabaseError: 'hidden' },
          health: {
            ...DELIVERY_RESULT.health,
            worker: category === 'unavailable' ? 'unavailable' : 'available',
            deliveryResultCategory: category,
            learnerAnswer: 'hidden',
          },
        }),
      })
      const response = await handler(event())
      expect(JSON.parse(response.body).delivery.category).toBe(category)
      expect(response.statusCode).toBe(['no_work', 'processed'].includes(category) ? 200 : 503)
      expect(response.body).not.toMatch(/hidden|secret|rawDatabaseError|learnerAnswer/i)
    },
  )

  it('maps thrown worker failures to a bounded unavailable result', async () => {
    const handler = createStudySessionTelemetryDeliverHandler({
      env: ENV,
      authorization: permitted(),
      runDelivery: async () => { throw new Error('raw learner transcript secret') },
    })
    const response = await handler(event())
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toMatchObject({
      delivery: { category: 'unavailable' },
      health: { worker: 'unavailable' },
    })
    expect(response.body).not.toMatch(/raw|learner|transcript|secret/i)
  })

  it('shares the same delivery function with the scheduled seam', async () => {
    const runDelivery = vi.fn(async () => DELIVERY_RESULT)
    const manual = createStudySessionTelemetryDeliverHandler({
      env: ENV,
      authorization: permitted(),
      runDelivery,
    })
    const scheduled = createStudySessionTelemetryScheduledEntrypoint({ runDelivery })
    await manual(event())
    await scheduled()
    expect(runDelivery).toHaveBeenCalledTimes(2)
    expect(runDelivery).toHaveBeenNthCalledWith(1, { env: ENV })
    expect(runDelivery).toHaveBeenNthCalledWith(2)
  })
})
