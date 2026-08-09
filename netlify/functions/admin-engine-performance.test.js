import { describe, expect, it, vi } from 'vitest'
import { createAdminEnginePerformanceHandler, enginePerformanceFilters } from './admin-engine-performance.js'
import { AdminEnginePerformanceReadError } from './_shared/admin-engine-performance-reader.js'

const NOW = '2026-08-31T12:00:00.000Z'

function request(overrides = {}) {
  return {
    path: '/api/admin/v1/engine-performance',
    httpMethod: 'GET',
    headers: { authorization: 'Bearer verified-token', 'x-admin-capabilities': 'engines:read' },
    queryStringParameters: { window: '30d', engine: 'study' },
    multiValueQueryStringParameters: null,
    ...overrides,
  }
}

function row(overrides = {}) {
  return {
    schemaVersion: 2,
    eventId: '00000000-0000-4000-8000-000000000001',
    occurredAt: '2026-08-15T12:00:00.000Z',
    scope: 'household',
    householdRef: '00000000-0000-4000-8000-000000000002',
    learnerRef: '00000000-0000-4000-8000-000000000003',
    engine: 'study',
    appVersion: 'app-1',
    engineVersion: 'study-v1',
    curriculumVersion: 'curriculum-1',
    courseRef: 'course-1',
    unitRef: 'unit-1',
    lessonRef: null,
    skillRef: null,
    eventType: 'study.session',
    result: 'success',
    durationMs: 120,
    metadata: { operation: 'start' },
    ...overrides,
  }
}

describe('ADMIN-4 engine performance endpoint', () => {
  it('independently requires engines:read and returns only the bounded projection', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal: { role: 'viewer' } }) }
    const reader = { list: vi.fn().mockResolvedValue([row()]) }
    const handler = createAdminEnginePerformanceHandler({ authorization, reader, now: () => NOW })
    const response = await handler(request())
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'engines:read')
    expect(reader.list).toHaveBeenCalledWith(500)
    expect(body.engines).toHaveLength(8)
    expect(body.source).toMatchObject({
      rawRowCount: 1,
      acceptedEventCount: 1,
      rejectedRowCount: 0,
      limitReached: false,
      completeness: 'complete',
    })
    expect(body.source.filteredEventCount).toBe(1)
    expect(response.body).not.toMatch(/"(?:eventId|householdRef|learnerRef|conversation|transcript|prompt|response|student_audio|assessment_answer)"\s*:/)
  })

  it.each(['unauthenticated', 'student', 'guardian', 'revoked', 'expired', 'unresolved'])(
    'fails closed for a %s principal before telemetry access',
    async () => {
      const reader = { list: vi.fn() }
      const handler = createAdminEnginePerformanceHandler({
        authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }) },
        reader,
        now: () => NOW,
      })
      expect((await handler(request())).statusCode).toBe(403)
      expect(reader.list).not.toHaveBeenCalled()
    },
  )

  it('ignores forged browser capability claims because the server authorizer remains authoritative', async () => {
    const reader = { list: vi.fn() }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }) }
    const handler = createAdminEnginePerformanceHandler({ authorization, reader, now: () => NOW })
    const response = await handler(request({
      headers: { authorization: 'Bearer student-token', 'x-admin-capabilities': 'engines:read,admin_roles:manage' },
    }))
    expect(response.statusCode).toBe(403)
    expect(reader.list).not.toHaveBeenCalled()
  })

  it('accepts only bounded canonical filters and rejects grade, learner, duplicates, and invalid values', async () => {
    expect(enginePerformanceFilters(request({ queryStringParameters: { window: '7d', engine: 'tutor', engineVersion: 'v2', course: 'course-1', unit: 'unit-1' } }), NOW)).toMatchObject({
      engine: 'tutor', engineVersion: 'v2', courseRef: 'course-1', unitRef: 'unit-1', end: NOW,
    })
    const authorization = { require: vi.fn() }
    const reader = { list: vi.fn() }
    const handler = createAdminEnginePerformanceHandler({ authorization, reader, now: () => NOW })
    for (const event of [
      request({ queryStringParameters: { window: '365d' } }),
      request({ queryStringParameters: { engine: 'unknown' } }),
      request({ queryStringParameters: { grade: '5' } }),
      request({ queryStringParameters: { learner: 'child-1' } }),
      request({ multiValueQueryStringParameters: { engine: ['tutor', 'study'] } }),
    ]) {
      expect((await handler(event)).statusCode).toBe(400)
    }
    expect(authorization.require).not.toHaveBeenCalled()
    expect(reader.list).not.toHaveBeenCalled()
  })

  it('is GET-only, path-bound, and returns controlled source errors', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal: { role: 'viewer' } }) }
    const handler = createAdminEnginePerformanceHandler({
      authorization,
      reader: { list: vi.fn().mockRejectedValue(new Error('C:\\private\\raw-provider-payload')) },
      now: () => NOW,
    })
    expect((await handler(request({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(request({ path: '/api/admin/v1/other' }))).statusCode).toBe(404)
    const failed = await handler(request())
    expect(failed.statusCode).toBe(503)
    expect(failed.body).toBe('{"error":{"code":"engine_performance_unavailable"}}')

    const timedOut = createAdminEnginePerformanceHandler({
      authorization,
      reader: { list: vi.fn().mockRejectedValue(new AdminEnginePerformanceReadError('source_timeout')) },
      now: () => NOW,
    })
    expect((await timedOut(request())).statusCode).toBe(504)
  })
})
