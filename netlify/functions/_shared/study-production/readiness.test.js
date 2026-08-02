import { describe, expect, it, vi } from 'vitest'
import { createStudyProductionReadinessHandler } from '../../study-production-readiness.js'
import {
  createStudyProductionReadinessService,
  readinessWireResult,
} from './readiness.js'

function readyDependencies(overrides = {}) {
  return {
    identityVerifier: {
      isDurable: true,
      isReady: () => true,
      readiness: vi.fn(async () => ({ status: 'ready' })),
    },
    durablePorts: {
      refreshReadiness: vi.fn(async () => true),
    },
    academicReadiness: vi.fn(async () => 'ready'),
    classifier: {
      isConfigured: () => true,
      circuitState: () => 'closed',
    },
    session17: {
      deliveryProvider: vi.fn(async () => 'ready'),
      receiptValidator: vi.fn(async () => 'ready'),
    },
    ...overrides,
  }
}

describe('Study production readiness assembly', () => {
  it('keeps unimplemented Session 17 ports explicitly not-ready', async () => {
    const dependencies = readyDependencies({ session17: undefined })
    const service = createStudyProductionReadinessService(dependencies)
    const snapshot = await service.check()

    expect(snapshot.status).toBe('not-ready')
    expect(snapshot.registrations).toContainEqual({ dependency: 'delivery-provider', status: 'not-ready' })
    expect(snapshot.registrations).toContainEqual({ dependency: 'receipt-validator', status: 'not-ready' })
    expect(snapshot.registrations).toHaveLength(17)
  })

  it('does not use the safety reconciliation probe as academic health', async () => {
    const dependencies = readyDependencies({ academicReadiness: undefined })
    const snapshot = await createStudyProductionReadinessService(dependencies).check()
    expect(snapshot.registrations).toContainEqual({
      dependency: 'study-session-adapter',
      status: 'not-ready',
    })
    expect(snapshot.registrations).toContainEqual({ dependency: 'rate-limiter', status: 'ready' })
  })

  it('uses live identity and durable probes, caches only through TTL, and then revalidates', async () => {
    let currentTime = 10_000
    const dependencies = readyDependencies({ now: () => currentTime, ttlMs: 2_000 })
    const service = createStudyProductionReadinessService(dependencies)

    const first = await service.check()
    const cached = await service.check()
    expect(cached).toBe(first)
    expect(dependencies.identityVerifier.readiness).toHaveBeenCalledTimes(1)
    expect(dependencies.durablePorts.refreshReadiness).toHaveBeenCalledTimes(1)

    currentTime = 12_001
    const refreshed = await service.check()
    expect(refreshed).not.toBe(first)
    expect(dependencies.identityVerifier.readiness).toHaveBeenCalledTimes(2)
    expect(dependencies.durablePorts.refreshReadiness).toHaveBeenCalledTimes(2)
  })

  it('allows ready only with every real dependency and degrades on live classifier health', async () => {
    const ready = await createStudyProductionReadinessService(readyDependencies()).check()
    expect(ready.status).toBe('ready')

    const degraded = await createStudyProductionReadinessService(readyDependencies({
      classifier: { isConfigured: () => true, circuitState: () => 'open' },
    })).check()
    expect(degraded.status).toBe('degraded')
    expect(degraded.registrations).toContainEqual({
      dependency: 'production-classifier',
      status: 'degraded',
    })
  })

  it('projects only schema, state, and expiry to the client', async () => {
    const snapshot = await createStudyProductionReadinessService(readyDependencies()).check()
    const wire = readinessWireResult(snapshot)
    expect(Object.keys(wire)).toEqual(['schemaVersion', 'status', 'expiresAt'])
    expect(JSON.stringify(wire)).not.toMatch(/dependency|provider|recipient|secret|key/i)
  })
})

describe('Study production readiness endpoint', () => {
  it('authenticates, returns minimized 503 readiness, and rejects unsupported requests', async () => {
    const check = vi.fn(async () => ({
      status: 'not-ready',
      expiresAtMs: Date.parse('2026-08-01T16:00:05.000Z'),
      registrations: [{ dependency: 'delivery-provider', status: 'not-ready', secret: 'hidden' }],
    }))
    const authVerifier = vi.fn(async () => ({ ok: true, user: { id: 'synthetic-user' } }))
    const handler = createStudyProductionReadinessHandler({
      readiness: { check },
      authVerifier,
    })

    const response = await handler({
      httpMethod: 'GET',
      path: '/api/study/production/readiness',
      headers: { authorization: 'Bearer synthetic-token' },
    })
    expect(response.statusCode).toBe(503)
    expect(JSON.parse(response.body)).toEqual({
      schemaVersion: 1,
      status: 'not-ready',
      expiresAt: '2026-08-01T16:00:05.000Z',
    })
    expect(response.body).not.toMatch(/dependency|provider|recipient|secret|hidden/i)
    expect(authVerifier).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledTimes(1)

    expect((await handler({ httpMethod: 'POST', path: '/api/study/production/readiness' })).statusCode).toBe(405)
    expect((await handler({
      httpMethod: 'GET', path: '/api/study/production/readiness', rawQuery: 'details=true',
    })).statusCode).toBe(400)
  })

  it('does not run dependency probes for an unauthenticated request', async () => {
    const check = vi.fn()
    const handler = createStudyProductionReadinessHandler({
      readiness: { check },
      authVerifier: async () => ({ ok: false, response: { statusCode: 401, body: '{}' } }),
    })
    const response = await handler({ httpMethod: 'GET', path: '/api/study/production/readiness' })
    expect(response.statusCode).toBe(401)
    expect(check).not.toHaveBeenCalled()
  })
})
