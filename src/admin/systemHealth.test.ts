import { describe, expect, it } from 'vitest'
import { ADMIN_ENGINE_IDS, type AdminEngineId, type AdminOperationalEvent, type AdminOperationalResult } from './contracts'
import {
  SYSTEM_HEALTH_THRESHOLDS,
  buildSystemHealthProjection,
  buildSystemHealthProjectionFromAggregates,
  type SystemHealthAggregateEvidence,
  type SystemHealthAggregateSummary,
  type SystemHealthEngineAggregateSummary,
  type SystemHealthServiceAggregateSummary,
  type SystemHealthWindowAggregate,
} from './systemHealth'

const NOW = new Date('2026-08-08T12:00:00.000Z')

function event(
  engine: AdminEngineId,
  result: AdminOperationalResult,
  index: number,
  overrides: Partial<AdminOperationalEvent> = {},
): AdminOperationalEvent {
  const eventType = {
    tutor: 'tutor.turn', study: 'study.session', assessment: 'assessment.attempt',
    curriculum: 'curriculum.load', jarvis: 'jarvis.turn', tts: 'tts.synthesis',
    gateway: 'gateway.request', sync: 'sync.operation',
  }[engine] as AdminOperationalEvent['eventType']
  const base = {
    schemaVersion: 2 as const,
    eventId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    occurredAt: new Date(NOW.getTime() - index * 10_000).toISOString(),
    scope: 'system' as const,
    householdRef: null,
    learnerRef: null,
    engine,
    appVersion: 'deploy.2026.08.08',
    engineVersion: `${engine}.v2`,
    curriculumVersion: engine === 'curriculum' ? 'curriculum.1.0.0' : null,
    courseRef: null,
    unitRef: null,
    lessonRef: null,
    skillRef: null,
    eventType,
    result,
    durationMs: 100 + index,
    metadata: {},
  }
  return { ...base, ...overrides } as AdminOperationalEvent
}

function results(engine: AdminEngineId, values: readonly AdminOperationalResult[]): AdminOperationalEvent[] {
  return values.map((result, index) => event(engine, result, index + 1))
}

function aggregateSummary(
  overrides: Partial<SystemHealthAggregateSummary> = {},
): SystemHealthAggregateSummary {
  return {
    eventCount: 0,
    successCount: 0,
    fallbackCount: 0,
    rejectedCount: 0,
    timeoutCount: 0,
    providerErrorCount: 0,
    validationErrorCount: 0,
    safetyStopCount: 0,
    durationCount: 0,
    durationP50Ms: null,
    durationP95Ms: null,
    firstOccurredAt: null,
    lastOccurredAt: null,
    ...overrides,
  }
}

function aggregateEngine(
  engineId: AdminEngineId,
  overrides: Partial<SystemHealthEngineAggregateSummary> = {},
): SystemHealthEngineAggregateSummary {
  return {
    ...aggregateSummary(),
    engineId,
    appVersion: 'deploy.2026.08.08',
    engineVersion: `${engineId}.v2`,
    curriculumVersion: engineId === 'curriculum' ? 'curriculum.1.0.0' : null,
    ...overrides,
  }
}

function aggregateService(
  serviceId: SystemHealthServiceAggregateSummary['serviceId'],
  overrides: Partial<SystemHealthServiceAggregateSummary> = {},
): SystemHealthServiceAggregateSummary {
  return { ...aggregateSummary(), serviceId, ...overrides }
}

function aggregateWindow(
  engines: readonly SystemHealthEngineAggregateSummary[] = [],
  summary: SystemHealthAggregateSummary = aggregateSummary(),
  incidentGroups: SystemHealthWindowAggregate['incidentGroups'] = [],
  services: readonly SystemHealthServiceAggregateSummary[] = [],
): SystemHealthWindowAggregate {
  return { summary, engines, services, incidentGroups }
}

function aggregateEvidence(
  evaluation: SystemHealthWindowAggregate,
  history: SystemHealthWindowAggregate = evaluation,
  previous: SystemHealthWindowAggregate = aggregateWindow(),
): SystemHealthAggregateEvidence {
  return { evaluation, history, previous }
}

describe('deterministic System Health aggregation', () => {
  it('returns all eight canonical engines as unknown when there is no telemetry', () => {
    const projection = buildSystemHealthProjection([], { now: NOW })
    expect(projection.engines.map((engine) => engine.engineId)).toEqual(ADMIN_ENGINE_IDS)
    expect(projection.engines.every((engine) => engine.health === 'unknown')).toBe(true)
    expect(projection.engines.every((engine) => engine.freshness === 'no_evidence')).toBe(true)
    expect(projection.overallHealth).toBe('unknown')
    expect(projection.observedAt).toBeNull()
    expect(projection.failureTrend).toBe('unknown')
  })

  it('preserves authoritative disabled state without pretending it is healthy or unavailable', () => {
    const projection = buildSystemHealthProjection([], {
      now: NOW,
      disabledEngines: new Set<AdminEngineId>(['study', 'tts']),
    })
    expect(projection.engines.find((engine) => engine.engineId === 'study')).toMatchObject({
      health: 'disabled', freshness: 'no_evidence', reasonCodes: ['feature_disabled'],
    })
    expect(projection.engines.find((engine) => engine.engineId === 'tts')?.health).toBe('disabled')
  })

  it('uses evidence observation time and marks stale evidence unknown', () => {
    const events = results('tutor', ['success', 'success', 'success', 'success', 'success'])
      .map((item, index) => ({ ...item, occurredAt: new Date(NOW.getTime() - 20 * 60_000 - index * 1_000).toISOString() }))
    const projection = buildSystemHealthProjection(events, { now: NOW })
    const tutor = projection.engines[0]
    expect(tutor.health).toBe('unknown')
    expect(tutor.freshness).toBe('stale')
    expect(tutor.reasonCodes).toEqual(['stale_evidence'])
    expect(tutor.observedAt).not.toBe(projection.generatedAt)
  })

  it('classifies sufficient fresh successful evidence as healthy', () => {
    const projection = buildSystemHealthProjection(results('tutor', [
      'success', 'success', 'success', 'success', 'success',
    ]), { now: NOW })
    expect(projection.engines[0]).toMatchObject({
      health: 'healthy', eventCount: 5, successCount: 5, successRatePercent: 100,
      reasonCodes: ['operating_normally'],
    })
  })

  it('classifies elevated timeouts, provider errors, and fallbacks deterministically', () => {
    const timeout = buildSystemHealthProjection(results('tutor', [
      'timeout', 'timeout', 'success', 'success', 'success', 'success', 'success', 'success', 'success', 'success',
    ]), { now: NOW }).engines[0]
    expect(timeout.health).toBe('degraded')
    expect(timeout.timeoutRatePercent).toBe(20)
    expect(timeout.reasonCodes).toContain('elevated_timeout_rate')

    const provider = buildSystemHealthProjection(results('study', [
      'provider_error', 'provider_error', 'success', 'success', 'success', 'success', 'success', 'success', 'success', 'success',
    ]), { now: NOW }).engines[1]
    expect(provider.health).toBe('degraded')
    expect(provider.providerErrorRatePercent).toBe(20)
    expect(provider.reasonCodes).toContain('elevated_provider_error_rate')

    const fallback = buildSystemHealthProjection(results('assessment', [
      'fallback', 'fallback', 'fallback', 'success', 'success', 'success', 'success', 'success', 'success', 'success',
    ]), { now: NOW }).engines[2]
    expect(fallback.health).toBe('degraded')
    expect(fallback.fallbackRatePercent).toBe(30)
    expect(fallback.reasonCodes).toContain('elevated_fallback_rate')
  })

  it('classifies a bounded majority of core failures as unavailable', () => {
    const tutor = buildSystemHealthProjection(results('tutor', [
      'timeout', 'provider_error', 'validation_error', 'success', 'success',
    ]), { now: NOW }).engines[0]
    expect(tutor.health).toBe('unavailable')
    expect(tutor.reasonCodes).toEqual(['core_operation_unavailable'])
  })

  it('excludes ordinary rejections from health rates and does not trigger an outage', () => {
    const events = [
      event('gateway', 'rejected', 1, { metadata: { reason_code: 'unauthenticated' } }),
      ...results('gateway', ['success', 'success', 'success', 'success', 'success']).map((item, index) => ({ ...item, eventId: `10000000-0000-4000-8000-${index.toString().padStart(12, '0')}` })),
    ]
    const gateway = buildSystemHealthProjection(events, { now: NOW }).engines[6]
    expect(gateway).toMatchObject({
      health: 'healthy', eventCount: 6, eligibleEventCount: 5,
      rejectedCount: 1, successRatePercent: 100,
    })
  })

  it('does not treat a functioning safety stop as infrastructure failure', () => {
    const events = [
      ...results('study', ['success', 'success', 'success', 'success', 'success']),
      event('study', 'safety_stop', 20, { eventType: 'safety.classification', metadata: { reason_code: 'policy_stop' } }),
    ]
    const study = buildSystemHealthProjection(events, { now: NOW }).engines[1]
    expect(study.health).toBe('healthy')
    expect(study.safetyStopCount).toBe(1)
    expect(study.reasonCodes).toContain('safety_policy_working')
    expect(buildSystemHealthProjection([event('study', 'safety_stop', 1, { eventType: 'safety.classification' })], { now: NOW }).engines[1].health).toBe('unknown')
  })

  it('calculates integer p50 and nearest-rank p95 only with sufficient duration samples', () => {
    const twenty = Array.from({ length: 20 }, (_, index) => event('tutor', 'success', index + 1, { durationMs: index + 1 }))
    const metrics = buildSystemHealthProjection(twenty, { now: NOW }).engines[0]
    expect(metrics.p50LatencyMs).toBe(11)
    expect(metrics.p95LatencyMs).toBe(19)

    const nineteen = twenty.slice(0, 19)
    const insufficient = buildSystemHealthProjection(nineteen, { now: NOW }).engines[0]
    expect(insufficient.p50LatencyMs).toBe(10)
    expect(insufficient.p95LatencyMs).toBeNull()
    expect(SYSTEM_HEALTH_THRESHOLDS.minimumP95Samples).toBe(20)
  })

  it('uses the declared latency objective only when p95 is trustworthy', () => {
    const events = Array.from({ length: 20 }, (_, index) => event('tutor', 'success', index + 1, {
      durationMs: index < 2 ? 6_000 : 100,
    }))
    const tutor = buildSystemHealthProjection(events, { now: NOW }).engines[0]
    expect(tutor.p95LatencyMs).toBe(6_000)
    expect(tutor.health).toBe('degraded')
    expect(tutor.reasonCodes).toContain('elevated_latency')
  })

  it('marks health unknown when the bounded source is truncated or rejects invalid rows', () => {
    const healthy = results('tutor', ['success', 'success', 'success', 'success', 'success'])
    expect(buildSystemHealthProjection(healthy, { now: NOW, sourceTruncated: true }).engines[0]).toMatchObject({
      health: 'unknown', reasonCodes: ['telemetry_incomplete'],
    })
    expect(buildSystemHealthProjection(healthy, { now: NOW, rejectedRows: 1 }).evidenceCompleteness).toBe('invalid_rows_rejected')
  })

  it('derives overall health using critical dependency precedence', () => {
    const healthyAll = ADMIN_ENGINE_IDS.flatMap((engine, engineIndex) =>
      Array.from({ length: 5 }, (_, index) => event(engine, 'success', engineIndex * 20 + index + 1, {
        occurredAt: new Date(NOW.getTime() - (index + 1) * 10_000).toISOString(),
      })))
    expect(buildSystemHealthProjection(healthyAll, { now: NOW }).overallHealth).toBe('healthy')

    const unavailableSync = healthyAll.filter((event) => event.engine !== 'sync').concat(results('sync', [
      'timeout', 'provider_error', 'validation_error', 'success', 'success',
    ]))
    expect(buildSystemHealthProjection(unavailableSync, { now: NOW }).overallHealth).toBe('unavailable')

    const optionalUnavailable = healthyAll.filter((event) => event.engine !== 'tts').concat(results('tts', [
      'timeout', 'provider_error', 'validation_error', 'success', 'success',
    ]))
    expect(buildSystemHealthProjection(optionalUnavailable, { now: NOW }).overallHealth).toBe('degraded')
  })

  it('reports bounded failure trends against the preceding equal-duration window', () => {
    const current = [event('sync', 'timeout', 1), event('sync', 'timeout', 2)]
    const previous = [event('sync', 'timeout', 3, { occurredAt: '2026-08-08T10:30:00.000Z' })]
    const projection = buildSystemHealthProjection([...current, ...previous], { now: NOW, selectedWindow: '1h' })
    expect(projection).toMatchObject({
      failureTrend: 'increasing', currentFailureCount: 2, previousFailureCount: 1,
    })
  })

  it('keeps primary health on one hour while history metrics follow the selected window', () => {
    const older = event('gateway', 'timeout', 1, { occurredAt: '2026-08-08T10:30:00.000Z' })
    const oneHour = buildSystemHealthProjection([older], { now: NOW, selectedWindow: '1h' })
    const day = buildSystemHealthProjection([older], { now: NOW, selectedWindow: '24h' })
    expect(oneHour.historyMetrics.eventCount).toBe(0)
    expect(day.historyMetrics).toMatchObject({ eventCount: 1, timeoutCount: 1 })
    expect(oneHour.engines[6].health).toBe('unknown')
    expect(day.engines[6].health).toBe('unknown')
  })

  it('propagates trusted gateway disablement to its service projection', () => {
    const projection = buildSystemHealthProjection([], {
      now: NOW,
      disabledEngines: new Set<AdminEngineId>(['gateway', 'tts']),
    })
    expect(projection.services.find((service) => service.serviceId === 'anthropic_gateway')?.health).toBe('disabled')
    expect(projection.services.find((service) => service.serviceId === 'tts_gateway')?.health).toBe('disabled')
  })

  it('projects only safe incident codes and legitimate version applicability', () => {
    const unsafe = event('gateway', 'provider_error', 1, {
      appVersion: 'deploy.safe', engineVersion: 'gateway.safe', curriculumVersion: null,
      metadata: { reason_code: 'raw_exception_SECRET_provider_body' },
    })
    const projection = buildSystemHealthProjection([unsafe], { now: NOW })
    expect(projection.engines[6]).toMatchObject({
      appVersion: 'deploy.safe', engineVersion: 'gateway.safe', curriculumVersion: null,
    })
    expect(projection.incidents[0]).toMatchObject({ reasonCode: 'provider_failure' })
    expect(JSON.stringify(projection)).not.toContain('SECRET')
    expect(JSON.stringify(projection)).not.toContain('metadata')
    expect(JSON.stringify(projection)).not.toContain('householdRef')
  })

  it('keeps projection generation time separate from latest evidence time', () => {
    const projection = buildSystemHealthProjection([event('tutor', 'success', 30)], { now: NOW })
    expect(projection.generatedAt).toBe(NOW.toISOString())
    expect(projection.observedAt).toBe('2026-08-08T11:55:00.000Z')
    expect(projection.observedAt).not.toBe(projection.generatedAt)
  })

  it('keeps complete health evidence when every engine exceeds the old 500-row ceiling', () => {
    const observedAt = '2026-08-08T11:59:50.000Z'
    const engines = ADMIN_ENGINE_IDS.map((engineId) => aggregateEngine(engineId, {
      eventCount: 501,
      successCount: 501,
      durationCount: 501,
      durationP50Ms: 100,
      durationP95Ms: 100,
      firstOccurredAt: '2026-08-08T11:00:00.000Z',
      lastOccurredAt: observedAt,
    }))
    const total = 501 * ADMIN_ENGINE_IDS.length
    const window = aggregateWindow(engines, aggregateSummary({
      eventCount: total,
      successCount: total,
      durationCount: total,
      durationP50Ms: 100,
      durationP95Ms: 100,
      firstOccurredAt: '2026-08-08T11:00:00.000Z',
      lastOccurredAt: observedAt,
    }))
    const projection = buildSystemHealthProjectionFromAggregates(
      aggregateEvidence(window),
      { now: NOW },
    )
    expect(projection.evidenceCompleteness).toBe('complete')
    expect(projection.overallHealth).toBe('healthy')
    expect(projection.historyMetrics.eventCount).toBe(total)
    expect(projection.engines.every((engine) =>
      engine.health === 'healthy' && engine.eventCount === 501)).toBe(true)
  })

  it('uses exact aggregate p50/p95 samples and keeps safety stops separate', () => {
    const observedAt = '2026-08-08T11:59:50.000Z'
    const tutor = aggregateEngine('tutor', {
      eventCount: 20,
      successCount: 19,
      safetyStopCount: 1,
      durationCount: 20,
      durationP50Ms: 11,
      durationP95Ms: 19,
      firstOccurredAt: '2026-08-08T11:30:00.000Z',
      lastOccurredAt: observedAt,
    })
    const summary = aggregateSummary({
      eventCount: 20,
      successCount: 19,
      safetyStopCount: 1,
      durationCount: 20,
      durationP50Ms: 11,
      durationP95Ms: 19,
      firstOccurredAt: '2026-08-08T11:30:00.000Z',
      lastOccurredAt: observedAt,
    })
    const projection = buildSystemHealthProjectionFromAggregates(
      aggregateEvidence(aggregateWindow([tutor], summary)),
      { now: NOW },
    )
    expect(projection.engines[0]).toMatchObject({
      health: 'healthy', eligibleEventCount: 19, safetyStopCount: 1,
      p50LatencyMs: 11, p95LatencyMs: 19,
    })
    expect(projection.engines[0].reasonCodes).toContain('safety_policy_working')
  })

  it('preserves mapped service counts, health, and exact aggregate latency', () => {
    const observedAt = '2026-08-08T11:59:50.000Z'
    const gateway = aggregateEngine('gateway', {
      eventCount: 20, successCount: 18, providerErrorCount: 2, durationCount: 20,
      durationP50Ms: 120, durationP95Ms: 6_000,
      firstOccurredAt: '2026-08-08T11:30:00.000Z', lastOccurredAt: observedAt,
    })
    const anthropic = aggregateService('anthropic_gateway', {
      eventCount: 20, successCount: 18, providerErrorCount: 2, durationCount: 20,
      durationP50Ms: 120, durationP95Ms: 6_000,
      firstOccurredAt: '2026-08-08T11:30:00.000Z', lastOccurredAt: observedAt,
    })
    const total = aggregateSummary({
      eventCount: 20, successCount: 18, providerErrorCount: 2, durationCount: 20,
      durationP50Ms: 120, durationP95Ms: 6_000,
      firstOccurredAt: '2026-08-08T11:30:00.000Z', lastOccurredAt: observedAt,
    })
    const projection = buildSystemHealthProjectionFromAggregates(
      aggregateEvidence(aggregateWindow([gateway], total, [], [anthropic])),
      { now: NOW },
    )
    expect(projection.services.find((service) => service.serviceId === 'anthropic_gateway')).toMatchObject({
      health: 'degraded', eventCount: 20, failureCount: 2, p95LatencyMs: 6_000,
      reasonCodes: expect.arrayContaining(['elevated_provider_error_rate', 'elevated_latency']),
    })
  })

  it('preserves critical unavailable precedence with aggregate evidence', () => {
    const observedAt = '2026-08-08T11:59:50.000Z'
    const engines = ADMIN_ENGINE_IDS.map((engineId) => aggregateEngine(engineId, {
      eventCount: 5,
      successCount: 5,
      firstOccurredAt: '2026-08-08T11:30:00.000Z',
      lastOccurredAt: observedAt,
    }))
    engines[7] = aggregateEngine('sync', {
      eventCount: 5,
      successCount: 2,
      timeoutCount: 1,
      providerErrorCount: 1,
      validationErrorCount: 1,
      firstOccurredAt: '2026-08-08T11:30:00.000Z',
      lastOccurredAt: observedAt,
    })
    const projection = buildSystemHealthProjectionFromAggregates(
      aggregateEvidence(aggregateWindow(engines)),
      { now: NOW },
    )
    expect(projection.engines[7].health).toBe('unavailable')
    expect(projection.overallHealth).toBe('unavailable')
  })

  it('keeps aggregate truth separate from bounded incident group samples', () => {
    const observedAt = '2026-08-08T11:59:50.000Z'
    const summary = aggregateSummary({
      eventCount: 501, successCount: 498, providerErrorCount: 3,
      firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: observedAt,
    })
    const tutor = aggregateEngine('tutor', { ...summary })
    const window = aggregateWindow([tutor], summary, [{
      engineId: 'tutor', eventType: 'tutor.turn', result: 'provider_error',
      operation: null, provider: 'anthropic', route: null,
      eventCount: 3, lastOccurredAt: observedAt,
    }])
    const projection = buildSystemHealthProjectionFromAggregates(aggregateEvidence(window), { now: NOW })
    expect(projection.historyMetrics).toMatchObject({ eventCount: 501, providerErrorCount: 3 })
    expect(projection.currentFailureCount).toBe(3)
    expect(projection.incidents).toHaveLength(1)
    expect(projection.incidents[0]).toMatchObject({
      serviceId: 'anthropic_gateway', reasonCode: 'provider_failure',
    })
  })

  it('preserves degraded, stale, and disabled decisions on the aggregate path', () => {
    const current = '2026-08-08T11:59:50.000Z'
    const stale = '2026-08-08T11:40:00.000Z'
    const tutor = aggregateEngine('tutor', {
      eventCount: 10, successCount: 8, timeoutCount: 2,
      firstOccurredAt: '2026-08-08T11:30:00.000Z', lastOccurredAt: current,
    })
    const study = aggregateEngine('study', {
      eventCount: 5, successCount: 5,
      firstOccurredAt: '2026-08-08T11:30:00.000Z', lastOccurredAt: current,
    })
    const assessment = aggregateEngine('assessment', {
      eventCount: 5, successCount: 5,
      firstOccurredAt: '2026-08-08T11:20:00.000Z', lastOccurredAt: stale,
    })
    const window = aggregateWindow([tutor, study, assessment], aggregateSummary({
      eventCount: 20, successCount: 18, timeoutCount: 2,
      firstOccurredAt: '2026-08-08T11:20:00.000Z', lastOccurredAt: current,
    }))
    const projection = buildSystemHealthProjectionFromAggregates(
      aggregateEvidence(window),
      { now: NOW, disabledEngines: new Set<AdminEngineId>(['study']) },
    )
    expect(projection.engines[0]).toMatchObject({
      health: 'degraded', reasonCodes: expect.arrayContaining(['elevated_timeout_rate']),
    })
    expect(projection.engines[1]).toMatchObject({
      health: 'disabled', reasonCodes: ['feature_disabled'],
    })
    expect(projection.engines[2]).toMatchObject({
      health: 'unknown', freshness: 'stale', reasonCodes: ['stale_evidence'],
    })
  })

  it('fails invalid or unavailable aggregate evidence closed to unknown', () => {
    const projection = buildSystemHealthProjectionFromAggregates(null, { now: NOW })
    expect(projection.evidenceCompleteness).toBe('invalid_rows_rejected')
    expect(projection.overallHealth).toBe('unknown')
    expect(projection.engines.every((engine) => engine.health === 'unknown')).toBe(true)
    expect(projection.failureTrend).toBe('unknown')
  })
})
