import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../src/admin/contracts.ts'
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

describe('authorized Admin System Health endpoint', () => {
  it.each(['viewer', 'admin', 'owner'])('requires health:read independently for canonical %s', async (role) => {
    const require = vi.fn().mockResolvedValue(authorized(role))
    const source = { list: vi.fn().mockResolvedValue({ events: [], rejectedRows: 0, sourceTruncated: false }) }
    const handler = createAdminHealthHandler({
      authorization: { require }, source, now: () => NOW, disabledEngines: new Set(),
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(200)
    expect(require).toHaveBeenCalledWith(expect.anything(), 'health:read')
    expect(source.list).toHaveBeenCalledOnce()
    expect(JSON.parse(response.body)).toMatchObject({
      contractVersion: 2, overallHealth: 'unknown', generatedAt: NOW.toISOString(),
    })
  })

  it('reports trusted saved-off AI/TTS runtime as disabled even when deployment gates are on', async () => {
    const source = { list: vi.fn().mockResolvedValue({ events: [], rejectedRows: 0, sourceTruncated: false }) }
    const runtimeConfigurationResolver = {
      resolve: vi.fn(async () => ({ values: { aiEnabled: false, ttsEnabled: false } })),
    }
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue(authorized()) },
      source,
      env: {
        ACADEMY_STUDY_ENABLED: 'true', ACADEMY_AI_ENABLED: 'true', ACADEMY_TTS_ENABLED: 'true',
      },
      runtimeConfigurationResolver,
      now: () => NOW,
    })
    const body = JSON.parse((await handler(request())).body)
    expect(runtimeConfigurationResolver.resolve).toHaveBeenCalledOnce()
    expect(body.engines).toEqual(expect.arrayContaining([
      expect.objectContaining({ engineId: 'gateway', health: 'disabled' }),
      expect.objectContaining({ engineId: 'tts', health: 'disabled' }),
    ]))
  })

  it('reports AI/TTS disabled when an injected runtime resolver throws', async () => {
    const source = { list: vi.fn().mockResolvedValue({ events: [], rejectedRows: 0, sourceTruncated: false }) }
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue(authorized()) },
      source,
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      runtimeConfigurationResolver: {
        resolve: vi.fn(async () => { throw new Error('SECRET configuration detail') }),
      },
      now: () => NOW,
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).engines).toEqual(expect.arrayContaining([
      expect.objectContaining({ engineId: 'gateway', health: 'disabled' }),
      expect.objectContaining({ engineId: 'tts', health: 'disabled' }),
      expect.objectContaining({ engineId: 'study', health: 'unknown' }),
    ]))
    expect(response.body).not.toContain('SECRET')
    expect(source.list).toHaveBeenCalledOnce()
  })

  it.each([
    ['unauthenticated', 401],
    ['student', 403],
    ['ordinary guardian', 403],
    ['revoked Admin assignment', 403],
    ['expired Admin assignment', 403],
  ])('fails closed for %s before telemetry is touched', async (_label, statusCode) => {
    const source = { list: vi.fn() }
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode, body: '{}' } }) },
      source,
    })
    expect((await handler(request())).statusCode).toBe(statusCode)
    expect(source.list).not.toHaveBeenCalled()
  })

  it('fails closed when authorization resolution throws', async () => {
    const source = { list: vi.fn() }
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockRejectedValue(new Error('database unavailable SECRET')) },
      source,
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(503)
    expect(response.body).toBe(JSON.stringify({ error: { code: 'authorization_unavailable' } }))
    expect(response.body).not.toContain('SECRET')
    expect(source.list).not.toHaveBeenCalled()
  })

  it('returns only vetted failure copy when telemetry access fails', async () => {
    const handler = createAdminHealthHandler({
      authorization: { require: vi.fn().mockResolvedValue(authorized()) },
      source: { list: vi.fn().mockRejectedValue(new Error('SQL raw provider response SECRET')) },
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(503)
    expect(response.body).toBe(JSON.stringify({ error: { code: 'health_source_unavailable' } }))
    expect(response.body).not.toContain('SECRET')
  })

  it('accepts only GET, exact paths, and bounded declared windows', async () => {
    const authorization = { require: vi.fn() }
    const handler = createAdminHealthHandler({ authorization, source: { list: vi.fn() } })
    expect((await handler(request({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(request({ path: '/api/admin/v1/health/raw' }))).statusCode).toBe(404)
    expect((await handler(request({ queryStringParameters: { window: '30d' } }))).statusCode).toBe(400)
    expect((await handler(request({ queryStringParameters: { window: '1h', role: 'owner' } }))).statusCode).toBe(400)
    expect(authorization.require).not.toHaveBeenCalled()
  })
})
