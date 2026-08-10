import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../src/admin/contracts.ts'
import { AdminHealthSourceReadError } from './_shared/admin-health-source.js'
import { createAdminHealthHandler } from './admin-health.js'

const NOW = new Date('2026-08-08T12:00:00.000Z')

function request(overrides = {}) {
  return {
    path: '/api/admin/v1/health',
    httpMethod: 'GET',
    headers: { authorization: 'Bearer verified.access.token' },
    queryStringParameters: { window: '1h' },
    ...overrides,
  }
}

function authorized(role = 'viewer') {
  return {
    ok: true,
    principal: { userId: 'admin-ref', role, capabilities: ADMIN_ROLE_CAPABILITIES[role] },
  }
}

function summary(overrides = {}) {
  return {
    eventCount: 0, successCount: 0, fallbackCount: 0, rejectedCount: 0,
    timeoutCount: 0, providerErrorCount: 0, validationErrorCount: 0,
    safetyStopCount: 0, durationCount: 0, durationP50Ms: null, durationP95Ms: null,
    firstOccurredAt: null, lastOccurredAt: null, ...overrides,
  }
}

function evidence(overrides = {}) {
  const empty = { summary: summary(), engines: [], services: [], incidentGroups: [] }
  return { evaluation: empty, history: empty, previous: empty, ...overrides }
}

function completeEvidence(eventCount = 501) {
  const observedAt = '2026-08-08T11:59:50.000Z'
  const engines = [
    'tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync',
  ].map((engineId) => ({
    ...summary({
      eventCount, successCount: eventCount, durationCount: eventCount,
      durationP50Ms: 100, durationP95Ms: 100,
      firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: observedAt,
    }),
    engineId, appVersion: 'deploy.1', engineVersion: `${engineId}.v2`,
    curriculumVersion: engineId === 'curriculum' ? 'curriculum.1' : null,
  }))
  const total = eventCount * engines.length
  const window = {
    summary: summary({
      eventCount: total, successCount: total, durationCount: total,
      durationP50Ms: 100, durationP95Ms: 100,
      firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: observedAt,
    }),
    engines, services: [], incidentGroups: [],
  }
  return evidence({ evaluation: window, history: window })
}

describe('authorized Admin System Health endpoint', () => {
  it.each(['viewer', 'admin', 'owner'])('requires health:read independently for canonical %s', async (role) => {
    const require = vi.fn().mockResolvedValue(authorized(role))
    const source = { read: vi.fn().mockResolvedValue(evidence()) }
    const handler = createAdminHealthHandler({
      authorization: { require }, source, now: () => NOW, disabledEngines: new Set(),
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(200)
    expect(require).toHaveBeenCalledWith(expect.anything(), 'health:read')
    expect(source.read).toHaveBeenCalledWith({ now: NOW, selectedWindow: '1h' })
    expect(JSON.parse(response.body)).toMatchObject({
      contractVersion: 2, overallHealth: 'unknown', generatedAt: NOW.toISOString(),
    })
  })

  it.each([
    ['unauthenticated', 401],
    ['student', 403],
    ['ordinary guardian', 403],
    ['revoked Admin assignment', 403],
    ['expired Admin assignment', 403],
  ])('fails closed for %s before telemetry is touched', async (_label, statusCode) => {
    const source = { read: vi.fn() }
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode, body: '{}' } }) },
      source,
    })
    expect((await handler(request())).statusCode).toBe(statusCode)
    expect(source.read).not.toHaveBeenCalled()
  })

  it('fails closed when authorization resolution throws', async () => {
    const source = { read: vi.fn() }
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockRejectedValue(new Error('database unavailable SECRET')) },
      source,
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(503)
    expect(response.body).toBe(JSON.stringify({ error: { code: 'authorization_unavailable' } }))
    expect(response.body).not.toContain('SECRET')
    expect(source.read).not.toHaveBeenCalled()
  })

  it('returns unknown, never healthy, when aggregate access fails', async () => {
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue(authorized()) },
      source: { read: vi.fn().mockRejectedValue(new Error('SQL raw provider response SECRET')) },
      now: () => NOW,
      disabledEngines: new Set(),
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({
      overallHealth: 'unknown', evidenceCompleteness: 'unavailable',
    })
    expect(response.body).not.toContain('SECRET')
  })

  it.each([
    'partial',
    'retention_limited',
    'malformed',
    'unavailable',
    'timeout',
    'group_incomplete',
  ])('preserves the privacy-safe %s completeness state and never reports healthy', async (completeness) => {
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue(authorized()) },
      source: { read: vi.fn().mockRejectedValue(new AdminHealthSourceReadError(completeness)) },
      now: () => NOW,
      disabledEngines: new Set(),
    })
    const response = await handler(request())
    const body = JSON.parse(response.body)
    expect(body).toMatchObject({ evidenceCompleteness: completeness, overallHealth: 'unknown' })
    expect(body.engines.every((engine) => engine.health === 'unknown')).toBe(true)
    expect(response.body).not.toMatch(/prompt|response|chat|assessmentAnswer|audio|privateNote|SECRET/i)
  })

  it('returns complete health beyond 500 events without exposing raw rows', async () => {
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue(authorized()) },
      source: { read: vi.fn().mockResolvedValue(completeEvidence()) },
      now: () => NOW,
      disabledEngines: new Set(),
    })
    const response = await handler(request())
    const body = JSON.parse(response.body)
    expect(body).toMatchObject({ overallHealth: 'healthy', evidenceCompleteness: 'complete' })
    expect(body.engines.every((engine) => engine.eventCount === 501 && engine.health === 'healthy')).toBe(true)
    expect(response.body).not.toMatch(/eventId|executionKey|householdRef|learnerRef|metadata|durationMs/i)
  })

  it('accepts only GET, exact paths, and bounded declared windows', async () => {
    const authorization = { require: vi.fn() }
    const handler = createAdminHealthHandler({ authorization, source: { read: vi.fn() } })
    expect((await handler(request({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(request({ path: '/api/admin/v1/health/raw' }))).statusCode).toBe(404)
    expect((await handler(request({ queryStringParameters: { window: '30d' } }))).statusCode).toBe(400)
    expect((await handler(request({ queryStringParameters: { window: '1h', role: 'owner' } }))).statusCode).toBe(400)
    expect(authorization.require).not.toHaveBeenCalled()
  })
})
