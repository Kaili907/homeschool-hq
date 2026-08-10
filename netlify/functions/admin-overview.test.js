import { describe, expect, it, vi } from 'vitest'
import { createAdminOverviewHandler } from './admin-overview.js'
import { resolveAdminOverviewRange } from './_shared/admin-overview.js'

const NOW = new Date('2026-08-09T14:30:00.000Z')
const ALL_CAPABILITIES = ['overview:read', 'learners:read', 'engines:read', 'health:read', 'costs:read', 'safety:read', 'curriculum:read']

function event(query = { range: 'today' }, overrides = {}) {
  return { httpMethod: 'GET', path: '/api/admin/v1/overview', queryStringParameters: query, body: '', ...overrides }
}

function authorization(capabilities = ALL_CAPABILITIES) {
  return {
    require: vi.fn(async (_event, capability) => capability === 'overview:read'
      ? { ok: true, principal: { role: 'admin', capabilities }, accessToken: 'trusted-token' }
      : { ok: false, response: { statusCode: 403, body: '{}' } }),
  }
}

const count = (value) => ({ status: 'available', value })

function costRecord(index, costMicros = '9007199254740993') {
  return {
    schemaVersion: 2, usageId: `usage-${index}`, occurredAt: '2026-08-09T12:00:00.000Z',
    accountRef: 'private-account', householdRef: 'private-household', householdAttribution: 'resolved', learnerRef: null,
    engine: 'tutor', appVersion: 'build-1', engineVersion: 'tutor-1', curriculumVersion: null,
    provider: 'anthropic', providerProductId: 'claude-sonnet-4-6', providerModelId: 'private-provider-model', logicalModelTier: 'sonnet',
    inputTokens: 10, outputTokens: 4, cachedInputReadTokens: 3, cachedInputWriteTokens: 2, ttsCharacters: null,
    requestCount: 1, latencyMs: 100, result: 'success', resultReasonCode: null, billingDisposition: 'billable',
    costMicros, currency: 'USD', costKind: 'calculated', pricingCatalogVersion: 'catalog-v1',
    costComponents: [{
      unit: 'input_token', rate: { unit: 'input_token', currency: 'USD', pricingCatalogVersion: 'catalog-v1' }, calculatedCostMicros: costMicros,
    }],
    reconciliationRef: null,
  }
}

function operationalEvent(index, occurredAt) {
  return {
    schemaVersion: 2,
    eventId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    occurredAt,
    scope: 'system', householdRef: null, learnerRef: null,
    engine: 'tutor', appVersion: 'build-1', engineVersion: 'tutor-1', curriculumVersion: null,
    courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
    eventType: 'tutor.turn', result: 'success', durationMs: 100, metadata: {},
  }
}

function sources(overrides = {}) {
  return {
    learners: vi.fn(async () => ({
      observedAt: '2026-08-09T14:25:00.000Z',
      learners: [
        { learnerRef: 'private-p1', displayName: 'Private Child', attendance: { recordedToday: true } },
        { learnerRef: 'private-p2', displayName: 'Private Child', attendance: { recordedToday: false } },
      ],
    })),
    health: vi.fn(async () => ({ events: [], rejectedRows: 0, sourceTruncated: false })),
    enginePerformance: vi.fn(async () => []),
    costs: vi.fn(async () => []),
    safety: vi.fn(async () => ({
      observedAt: '2026-08-09T14:20:00.000Z',
      summary: { openSafetyStops: count(2), adultReviewPending: count(1), failClosedEvents: count(3) },
      events: [{ eventRef: 'private-event', detail: 'private safety detail' }],
    })),
    curriculumCatalog: vi.fn(async () => ({ source: { version: '1.0.0' } })),
    curriculumValidation: vi.fn(async () => ({
      validation: {
        package_id: 'manuel-academy-r1', version: '1.0.0', overall: 'PASS', artifact_version: 'validation-v1',
        validated_at: '2026-08-08T00:00:00.000Z', checks: [{ check: 'schema-validation', result: 'PASS' }],
      },
      curriculumManifest: { package_id: 'manuel-academy-r1', version: '1.0.0' },
      packageManifest: { version: '1.0.0' },
    })),
    ...overrides,
  }
}

function handler(overrides = {}) {
  return createAdminOverviewHandler({
    authorization: authorization(), sources: sources(), now: () => NOW,
    env: {
      CONTEXT: 'production', APP_VERSION: 'build-2026.08.09', ACADEMY_STUDY_ENABLED: 'true',
    },
    runtimeConfigurationResolver: {
      resolve: vi.fn(async () => ({ values: { aiEnabled: true, ttsEnabled: true } })),
    },
    ...overrides,
  })
}

const body = (response) => JSON.parse(response.body)

describe('Admin Overview authorization composition', () => {
  it('requires overview:read and ignores forged browser capabilities', async () => {
    const auth = authorization()
    const response = await handler({ authorization: auth })(event(
      { range: 'today', capabilities: 'owner,costs:read' },
      { headers: { 'x-admin-capabilities': 'owner,costs:read' } },
    ))
    expect(response.statusCode).toBe(400)
    expect(auth.require).toHaveBeenCalledTimes(1)
    expect(auth.require).toHaveBeenCalledWith(expect.anything(), 'overview:read')
    const denied = { require: vi.fn(async () => ({ ok: false, response: { statusCode: 403, body: '{"error":"admin_access_denied"}' } })) }
    expect((await handler({ authorization: denied })(event())).statusCode).toBe(403)
  })

  it('checks each trusted domain capability before invoking its source', async () => {
    const domainSources = sources()
    const response = await handler({ authorization: authorization(['overview:read', 'health:read']), sources: domainSources })(event())
    const model = body(response)
    expect(model.engineHealth.availability).toBe('available')
    expect(model.learners).toMatchObject({ availability: 'unavailable', reasonCode: 'capability_required' })
    expect(model.costs).toMatchObject({ availability: 'unavailable', reasonCode: 'capability_required' })
    expect(domainSources.health).toHaveBeenCalledOnce()
    expect(domainSources.learners).not.toHaveBeenCalled()
    expect(domainSources.enginePerformance).not.toHaveBeenCalled()
    expect(domainSources.costs).not.toHaveBeenCalled()
    expect(domainSources.safety).not.toHaveBeenCalled()
    expect(domainSources.curriculumCatalog).not.toHaveBeenCalled()
    expect(domainSources.curriculumValidation).not.toHaveBeenCalled()
  })

  it('uses resolved AI/TTS flags for Health and fails closed if resolution throws', async () => {
    const disabled = await handler({
      runtimeConfigurationResolver: {
        resolve: vi.fn(async () => ({ values: { aiEnabled: false, ttsEnabled: false } })),
      },
    })(event())
    expect(body(disabled).engineHealth.data.engines).toEqual(expect.arrayContaining([
      expect.objectContaining({ engineId: 'gateway', health: 'disabled' }),
      expect.objectContaining({ engineId: 'tts', health: 'disabled' }),
      expect.objectContaining({ engineId: 'study', health: 'unknown' }),
    ]))

    const unavailable = await handler({
      runtimeConfigurationResolver: {
        resolve: vi.fn(async () => { throw new Error('SECRET configuration detail') }),
      },
    })(event())
    expect(unavailable.statusCode).toBe(200)
    expect(body(unavailable).engineHealth.data.engines).toEqual(expect.arrayContaining([
      expect.objectContaining({ engineId: 'gateway', health: 'disabled' }),
      expect.objectContaining({ engineId: 'tts', health: 'disabled' }),
      expect.objectContaining({ engineId: 'study', health: 'unknown' }),
    ]))
    expect(unavailable.body).not.toContain('SECRET')
  })
})

describe('Admin Overview UTC range', () => {
  it.each([
    [{ range: 'today' }, ['2026-08-09', '2026-08-09', 1]],
    [{ range: '7-days' }, ['2026-08-03', '2026-08-09', 7]],
    [{ range: '30-days' }, ['2026-07-11', '2026-08-09', 30]],
    [{ range: 'school-year' }, ['2026-08-01', '2026-08-09', 9]],
    [{ range: 'custom', start: '2025-08-09', end: '2026-08-09' }, ['2025-08-09', '2026-08-09', 366]],
  ])('resolves %o to [startInclusive, endExclusive)', (query, expected) => {
    const range = resolveAdminOverviewRange(event(query), NOW)
    expect([range.start, range.end, range.days]).toEqual(expected)
    expect(range.startInclusive).toMatch(/T00:00:00\.000Z$/)
    expect(range.endExclusive).toBe('2026-08-10T00:00:00.000Z')
    expect(range.timezone).toBe('UTC')
  })

  it('uses the canonical query map when Netlify supplies an empty multi-value map', () => {
    expect(resolveAdminOverviewRange(event(
      { range: '7-days' },
      { multiValueQueryStringParameters: {} },
    ), NOW).kind).toBe('7-days')
  })

  it.each([
    { range: 'custom', start: '2025-08-08', end: '2026-08-09' },
    { range: 'custom', start: '2026-08-01', end: '2026-08-10' },
    { range: 'custom', start: '2026-02-30', end: '2026-08-09' },
  ])('rejects excessive, future, or invalid custom range %o', async (query) => {
    expect((await handler()(event(query))).statusCode).toBe(400)
  })
})

describe('Admin Overview domain semantics and isolation', () => {
  it('keeps no-data Health unknown and preserves actual window labels', async () => {
    const model = body(await handler()(event({ range: '30-days' })))
    expect(model.engineHealth).toMatchObject({
      availability: 'available', freshness: 'unknown', completeness: 'complete', observationStatus: 'unknown',
      window: { kind: 'fixed' }, data: { overallHealth: 'unknown' },
    })
    expect(model.costs.window).toMatchObject({ kind: 'requested', startInclusive: '2026-07-11T00:00:00.000Z' })
    expect(model.learners.window).toMatchObject({ kind: 'fixed', label: 'Attendance recorded today (UTC)' })
    expect(model.safety.window.kind).toBe('as-of')
  })

  it('isolates a failed domain and returns successful domains', async () => {
    const response = await handler({ sources: sources({ health: vi.fn(async () => { throw new Error('private backend detail') }) }) })(event())
    const model = body(response)
    expect(response.statusCode).toBe(200)
    expect(model.engineHealth).toMatchObject({ availability: 'unavailable', observationStatus: 'unavailable', reasonCode: 'source_unavailable' })
    expect(model.learners.availability).toBe('available')
    expect(model.safety.availability).toBe('available')
  })

  it('keeps stale Health distinct from partial and unavailable domains', async () => {
    const staleEvents = Array.from({ length: 5 }, (_, index) => operationalEvent(
      index + 1,
      new Date(NOW.getTime() - 20 * 60_000 - index * 1_000).toISOString(),
    ))
    const response = await handler({
      sources: sources({ health: vi.fn(async () => ({ events: staleEvents, rejectedRows: 0, sourceTruncated: false })) }),
    })(event())
    expect(body(response).engineHealth).toMatchObject({
      availability: 'available', freshness: 'stale', completeness: 'complete', observationStatus: 'stale',
    })
  })

  it('defines active learners by attendance and leaves unproven metrics unavailable', async () => {
    const model = body(await handler()(event()))
    expect(model.learners.data.activeLearners).toEqual({ status: 'available', value: 1 })
    for (const key of ['lessonsStarted', 'lessonsCompleted', 'studySessions', 'instructionalMinutes']) {
      expect(model.learners.data[key]).toEqual({ status: 'unavailable' })
    }
  })

  it('returns Safety summary and curriculum validation without private detail', async () => {
    const response = await handler()(event())
    const model = body(response)
    expect(model.safety.data).toEqual({ openSafetyStops: count(2), adultReviewsPending: count(1), failClosedEvents: count(3) })
    expect(model.curriculum.data).toMatchObject({
      publishedVersion: { status: 'available', value: '1.0.0' },
      validationState: { status: 'available', value: 'passed' },
      validatedAt: { status: 'available', value: '2026-08-08T00:00:00.000Z' },
      validationArtifactVersion: { status: 'available', value: 'validation-v1' },
      coverageWarning: { status: 'unavailable' },
    })
    for (const prohibited of ['Private Child', 'private-p1', 'private-event', 'private safety detail', 'accountRef', 'householdRef', 'providerModelId']) {
      expect(response.body).not.toContain(prohibited)
    }
  })

  it('does not serialize arbitrary backend errors', async () => {
    const response = await handler({ sources: sources({ health: vi.fn(async () => { throw new Error('SECRET accountRef householdRef') }) }) })(event())
    expect(response.body).not.toMatch(/SECRET|accountRef|householdRef/)
  })

  it('preserves exact IntegerMicros and reports the 500-row source ceiling as truncated', async () => {
    const records = Array.from({ length: 500 }, (_, index) => costRecord(index))
    const response = await handler({ sources: sources({ costs: vi.fn(async () => records) }) })(event())
    const model = body(response)
    expect(model.costs).toMatchObject({ availability: 'available', completeness: 'truncated', observationStatus: 'partial' })
    expect(model.costs.data.calculatedCost).toEqual({
      status: 'partial', micros: '4503599627370496500', currency: 'USD',
    })
    expect(response.body).not.toMatch(/private-account|private-household|private-provider-model/)
  })
})
