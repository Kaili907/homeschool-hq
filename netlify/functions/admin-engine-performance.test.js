import { describe, expect, it, vi } from 'vitest'
import { createAdminEnginePerformanceHandler, enginePerformanceFilters } from './admin-engine-performance.js'
import { AdminOperationalAggregateReadError } from './_shared/admin-operational-aggregate-reader.js'

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

function group(overrides = {}) {
  return {
    retentionCategory: 'diagnostic_short',
    engine: 'study',
    appVersion: 'app-1',
    engineVersion: 'study-v1',
    curriculumVersion: 'curriculum-1',
    courseRef: 'course-1',
    unitRef: 'unit-1',
    eventType: 'study.session',
    result: 'success',
    operation: 'start',
    reasonCode: null,
    provider: null,
    route: null,
    eventCount: 1,
    durationCount: 1,
    durationTotalMs: 120,
    durationP50Ms: 120,
    durationP95Ms: 120,
    firstOccurredAt: '2026-08-15T12:00:00.000Z',
    lastOccurredAt: '2026-08-15T12:00:00.000Z',
    ...overrides,
  }
}

function aggregate(groups = [group()], overrides = {}) {
  const grouping = overrides.grouping ?? 'complete'
  const retentionClasses = overrides.retentionClasses ?? [
    { category: 'diagnostic_short', retainedDays: 30, complete: true },
    { category: 'operational_standard', retainedDays: 90, complete: true },
    { category: 'safety_extended', retainedDays: 365, complete: true },
  ]
  return {
    schemaVersion: 2,
    range: { start: '2026-08-01T12:00:00.000Z', endExclusive: NOW, maximumDays: 366 },
    filters: { engine: 'study', engineVersion: null, courseRef: null, unitRef: null },
    completeness: {
      grouping,
      groupCount: groups.length,
      groupLimit: 4096,
      allRetentionClasses: retentionClasses.every((item) => item.complete),
      retentionClasses,
    },
    totalEventCount: groups.reduce((total, item) => total + item.eventCount, 0),
    groups,
    ...overrides.root,
  }
}

describe('ADMIN-4 engine performance endpoint', () => {
  it('independently requires engines:read and returns only the scalable aggregate projection', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal: { role: 'viewer' } }) }
    const reader = { aggregate: vi.fn().mockResolvedValue(aggregate([group({ eventCount: 501, durationCount: 501, durationTotalMs: 60_120 })])) }
    const handler = createAdminEnginePerformanceHandler({ authorization, reader, now: () => NOW })
    const response = await handler(request())
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'engines:read')
    expect(reader.aggregate).toHaveBeenCalledWith({
      start: '2026-08-01T12:00:00.000Z', endExclusive: NOW,
      engine: 'study', engineVersion: null, courseRef: null, unitRef: null,
      capability: 'engines:read',
    })
    expect(reader.list).toBeUndefined()
    expect(body.engines).toHaveLength(8)
    expect(body.source).toMatchObject({
      mode: 'aggregate',
      acceptedEventCount: 501,
      groupCount: 1,
      groupLimit: 4096,
      completeness: 'complete',
    })
    expect(body.source.filteredEventCount).toBe(501)
    expect(body.engines.find((item) => item.engineId === 'study')).toMatchObject({ sampleCount: 501 })
    expect(response.body).not.toMatch(/"(?:eventId|householdRef|learnerRef|conversation|transcript|prompt|response|student_audio|assessment_answer|provider|route)"\s*:/)
  })

  it.each(['unauthenticated', 'student', 'guardian', 'revoked', 'expired', 'unresolved'])(
    'fails closed for a %s principal before telemetry access',
    async () => {
      const reader = { aggregate: vi.fn() }
      const handler = createAdminEnginePerformanceHandler({
        authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }) },
        reader,
        now: () => NOW,
      })
      expect((await handler(request())).statusCode).toBe(403)
      expect(reader.aggregate).not.toHaveBeenCalled()
    },
  )

  it('ignores forged browser capability claims because the server authorizer remains authoritative', async () => {
    const reader = { aggregate: vi.fn() }
    const authorization = { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }) }
    const handler = createAdminEnginePerformanceHandler({ authorization, reader, now: () => NOW })
    const response = await handler(request({
      headers: { authorization: 'Bearer student-token', 'x-admin-capabilities': 'engines:read,admin_roles:manage' },
    }))
    expect(response.statusCode).toBe(403)
    expect(reader.aggregate).not.toHaveBeenCalled()
  })

  it('accepts only bounded canonical filters and rejects grade, learner, duplicates, and invalid values', async () => {
    expect(enginePerformanceFilters(request({ queryStringParameters: { window: '7d', engine: 'tutor', engineVersion: 'v2', course: 'course-1', unit: 'unit-1' } }), NOW)).toMatchObject({
      start: '2026-08-24T12:00:00.000Z', end: NOW,
      engine: 'tutor', engineVersion: 'v2', courseRef: 'course-1', unitRef: 'unit-1',
    })
    expect(enginePerformanceFilters(request(), NOW)).toMatchObject({
      start: '2026-08-01T12:00:00.000Z', end: NOW,
    })
    const authorization = { require: vi.fn() }
    const reader = { aggregate: vi.fn() }
    const handler = createAdminEnginePerformanceHandler({ authorization, reader, now: () => NOW })
    for (const event of [
      request({ queryStringParameters: { window: '90d' } }),
      request({ queryStringParameters: { window: '365d' } }),
      request({ queryStringParameters: { engine: 'unknown' } }),
      request({ queryStringParameters: { grade: '5' } }),
      request({ queryStringParameters: { learner: 'child-1' } }),
      request({ queryStringParameters: { window: '7d', occurredTo: '2099-01-01T00:00:00.000Z' } }),
      request({ multiValueQueryStringParameters: { engine: ['tutor', 'study'] } }),
    ]) {
      expect((await handler(event)).statusCode).toBe(400)
    }
    expect(authorization.require).not.toHaveBeenCalled()
    expect(reader.aggregate).not.toHaveBeenCalled()
  })

  it('calculates exact weighted counts and rates from more than 500 represented events', async () => {
    const groups = [
      group({ operation: 'start', eventCount: 1_000, durationCount: 1_000, durationTotalMs: 120_000 }),
      group({ operation: 'complete', eventCount: 750, durationCount: 750, durationTotalMs: 90_000 }),
    ]
    const handler = createAdminEnginePerformanceHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true }) },
      reader: { aggregate: vi.fn().mockResolvedValue(aggregate(groups)) },
      now: () => NOW,
    })
    const response = await handler(request())
    const body = JSON.parse(response.body)
    const study = body.engines.find((item) => item.engineId === 'study')

    expect(response.statusCode).toBe(200)
    expect(body.source).toMatchObject({ acceptedEventCount: 1_750, groupCount: 2, completeness: 'complete' })
    expect(study).toMatchObject({ sampleCount: 1_750, evidenceState: 'partial' })
    expect(study.metrics.find((item) => item.id === 'sessions_started')).toMatchObject({ value: 1_000, sampleCount: 1_750 })
    expect(study.metrics.find((item) => item.id === 'completion_rate')).toMatchObject({ value: 75, numerator: 750, denominator: 1_000 })
  })

  it('rejects malformed aggregates instead of calculating from inconsistent totals', async () => {
    const malformed = aggregate([group()], { root: { totalEventCount: 2 } })
    const handler = createAdminEnginePerformanceHandler({
      authorization: { require: vi.fn().mockResolvedValue({ ok: true }) },
      reader: { aggregate: vi.fn().mockResolvedValue(malformed) },
      now: () => NOW,
    })
    const response = await handler(request())
    expect(response.statusCode).toBe(502)
    expect(response.body).toBe('{"error":{"code":"engine_performance_malformed"}}')
  })

  it('keeps declared incomplete grouping and retention-limited evidence qualified', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true }) }
    const partialHandler = createAdminEnginePerformanceHandler({
      authorization,
      reader: { aggregate: vi.fn().mockResolvedValue(aggregate([group({ eventCount: 20, durationCount: 20 })], { grouping: 'partial' })) },
      now: () => NOW,
    })
    const partial = JSON.parse((await partialHandler(request())).body)
    expect(partial.source).toMatchObject({ grouping: 'partial', completeness: 'partial' })
    expect(partial.engines.find((item) => item.engineId === 'study').evidenceState).toBe('partial')

    const retentionClasses = [
      { category: 'diagnostic_short', retainedDays: 30, complete: false },
      { category: 'operational_standard', retainedDays: 90, complete: true },
      { category: 'safety_extended', retainedDays: 365, complete: true },
    ]
    const retentionHandler = createAdminEnginePerformanceHandler({
      authorization,
      reader: { aggregate: vi.fn().mockResolvedValue(aggregate([group({ eventCount: 20, durationCount: 20 })], { retentionClasses })) },
      now: () => NOW,
    })
    const retention = JSON.parse((await retentionHandler(request())).body)
    expect(retention.source).toMatchObject({
      completeness: 'retention_limited',
      retention: { status: 'retention_limited', allRetentionClasses: false },
    })
    expect(retention.engines.find((item) => item.engineId === 'study').evidenceState).toBe('partial')
  })

  it('fails closed when aggregate bounds are exceeded and never turns absent evidence into success', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true }) }
    const bounded = createAdminEnginePerformanceHandler({
      authorization,
      reader: { aggregate: vi.fn().mockRejectedValue(new AdminOperationalAggregateReadError('source_group_limit')) },
      now: () => NOW,
    })
    const boundedResponse = await bounded(request())
    expect(boundedResponse.statusCode).toBe(503)
    expect(boundedResponse.body).toBe('{"error":{"code":"engine_performance_incomplete"}}')

    const empty = createAdminEnginePerformanceHandler({
      authorization,
      reader: { aggregate: vi.fn().mockResolvedValue(aggregate([])) },
      now: () => NOW,
    })
    const emptyBody = JSON.parse((await empty(request())).body)
    expect(emptyBody.engines.every((item) => item.evidenceState === 'unavailable')).toBe(true)
    expect(emptyBody.engines.flatMap((item) => item.metrics).every((item) => item.availability !== 'available')).toBe(true)
  })

  it('is GET-only, path-bound, and returns controlled source errors', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal: { role: 'viewer' } }) }
    const handler = createAdminEnginePerformanceHandler({
      authorization,
      reader: { aggregate: vi.fn().mockRejectedValue(new Error('C:\\private\\raw-provider-payload')) },
      now: () => NOW,
    })
    expect((await handler(request({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(request({ path: '/api/admin/v1/other' }))).statusCode).toBe(404)
    const failed = await handler(request())
    expect(failed.statusCode).toBe(503)
    expect(failed.body).toBe('{"error":{"code":"engine_performance_unavailable"}}')

    const timedOut = createAdminEnginePerformanceHandler({
      authorization,
      reader: { aggregate: vi.fn().mockRejectedValue(new AdminOperationalAggregateReadError('source_timeout')) },
      now: () => NOW,
    })
    expect((await timedOut(request())).statusCode).toBe(504)
  })
})
