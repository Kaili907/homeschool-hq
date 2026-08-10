import { describe, expect, it, vi } from 'vitest'
import {
  createAdminHealthSource,
  decodeSystemHealthAggregate,
  disabledHealthEngines,
} from './admin-health-source.js'

const NOW = new Date('2026-08-08T12:00:00.000Z')
const OBSERVED_AT = '2026-08-08T11:59:50.000Z'

function summary(overrides = {}) {
  return {
    eventCount: 0, successCount: 0, fallbackCount: 0, rejectedCount: 0,
    timeoutCount: 0, providerErrorCount: 0, validationErrorCount: 0,
    safetyStopCount: 0, durationCount: 0, durationP50Ms: null, durationP95Ms: null,
    firstOccurredAt: null, lastOccurredAt: null, ...overrides,
  }
}

function completeness(overrides = {}) {
  return {
    grouping: 'complete', groupCount: 1, groupLimit: 4096, allRetentionClasses: true,
    retentionClasses: [
      { category: 'diagnostic_short', retainedDays: 30, complete: true },
      { category: 'operational_standard', retainedDays: 90, complete: true },
      { category: 'safety_extended', retainedDays: 365, complete: true },
    ],
    ...overrides,
  }
}

function aggregate(overrides = {}) {
  const complete = summary({
    eventCount: 501, successCount: 501, durationCount: 501,
    durationP50Ms: 251, durationP95Ms: 476,
    firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: OBSERVED_AT,
  })
  return {
    schemaVersion: 2,
    range: {
      start: '2026-08-08T11:00:00.000Z', endExclusive: '2026-08-08T12:00:00.001Z',
      maximumDays: 366,
    },
    filters: { engine: null, engineVersion: null, courseRef: null, unitRef: null },
    completeness: completeness(),
    totalEventCount: 501,
    summary: complete,
    engineSummaries: [{
      engine: 'study', appVersion: 'deploy.1', engineVersion: 'study.v2',
      curriculumVersion: null, ...complete,
    }],
    serviceSummaries: [],
    groups: [{
      retentionCategory: 'diagnostic_short',
      engine: 'study', eventType: 'study.session', result: 'success',
      operation: 'complete', provider: null, route: null,
      eventCount: 501, durationCount: 501,
      firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: OBSERVED_AT,
    }],
    ...overrides,
  }
}

describe('System Health telemetry source', () => {
  it('uses only TEL-FOUNDATION aggregates with health:read and keeps >500 complete', async () => {
    const rpc = vi.fn((_name, parameters) => {
      const firstOccurredAt = parameters.p_start
      const lastOccurredAt = new Date(Date.parse(parameters.p_end) - 10).toISOString()
      const value = aggregate({
        range: { start: parameters.p_start, endExclusive: parameters.p_end, maximumDays: 366 },
      })
      for (const item of [value.summary, value.engineSummaries[0], value.groups[0]]) {
        item.firstOccurredAt = firstOccurredAt
        item.lastOccurredAt = lastOccurredAt
      }
      return { abortSignal: vi.fn().mockResolvedValue({ data: value, error: null }) }
    })
    const source = createAdminHealthSource({ client: { rpc } })
    const evidence = await source.read({ now: NOW, selectedWindow: '1h' })
    expect(evidence.evaluation).toMatchObject({
      summary: { eventCount: 501, durationP50Ms: 251, durationP95Ms: 476 },
      engines: [{ engineId: 'study', eventCount: 501 }],
    })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenNthCalledWith(1, 'academy_aggregate_operational_events_v2', {
      p_start: '2026-08-08T11:00:00.000Z',
      p_end: '2026-08-08T12:00:00.001Z',
      p_engine: null, p_engine_version: null, p_course_ref: null, p_unit_ref: null,
      p_required_capability: 'health:read',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'academy_aggregate_operational_events_v2', {
      p_start: '2026-08-08T10:00:00.000Z',
      p_end: '2026-08-08T11:00:00.000Z',
      p_engine: null, p_engine_version: null, p_course_ref: null, p_unit_ref: null,
      p_required_capability: 'health:read',
    })
    expect(rpc.mock.calls.flat().join(' ')).not.toContain('academy_list_operational_events_v2')
  })

  it('fails without a service source and never returns database details', async () => {
    const source = createAdminHealthSource({ env: {} })
    await expect(source.read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toThrow('source_unavailable')
  })

  it('accepts a complete empty aggregate as no telemetry', () => {
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: {
        ...completeness(), groupCount: 0,
      },
      totalEventCount: 0,
      summary: summary(),
      engineSummaries: [],
      serviceSummaries: [],
      groups: [],
    }))).toMatchObject({ summary: { eventCount: 0 }, engines: [], services: [] })
  })

  it('rejects incomplete or internally inconsistent aggregate evidence', async () => {
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ allRetentionClasses: false }),
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({ totalEventCount: 500 }))).toBeNull()
    const reader = { aggregate: vi.fn().mockResolvedValue(aggregate({ totalEventCount: 500 })) }
    await expect(createAdminHealthSource({ reader }).read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toThrow('health_source_unavailable')
  })

  it('cross-checks result, engine, service, duration, range, and retention facts', () => {
    const complete = summary({
      eventCount: 20, successCount: 20, durationCount: 20,
      durationP50Ms: 11, durationP95Ms: 19,
      firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: OBSERVED_AT,
    })
    const valid = aggregate({
      totalEventCount: 20,
      summary: complete,
      engineSummaries: [{
        engine: 'gateway', appVersion: 'deploy.1', engineVersion: 'gateway.v2',
        curriculumVersion: null, ...complete,
      }],
      serviceSummaries: [{ serviceId: 'anthropic_gateway', ...complete }],
      groups: [{
        retentionCategory: 'operational_standard', engine: 'gateway',
        eventType: 'gateway.request', result: 'success', operation: 'request',
        provider: 'anthropic', route: null, eventCount: 20, durationCount: 20,
        firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: OBSERVED_AT,
      }],
    })
    expect(decodeSystemHealthAggregate(valid)).toMatchObject({
      summary: { eventCount: 20, successCount: 20 },
      engines: [{ engineId: 'gateway', eventCount: 20 }],
      services: [{ serviceId: 'anthropic_gateway', eventCount: 20 }],
    })

    const contradictoryResult = structuredClone(valid)
    contradictoryResult.summary.successCount = 0
    contradictoryResult.summary.timeoutCount = 20
    expect(decodeSystemHealthAggregate(contradictoryResult)).toBeNull()

    const contradictoryEngine = structuredClone(valid)
    contradictoryEngine.engineSummaries[0].successCount = 0
    contradictoryEngine.engineSummaries[0].timeoutCount = 20
    expect(decodeSystemHealthAggregate(contradictoryEngine)).toBeNull()

    const contradictoryService = structuredClone(valid)
    contradictoryService.serviceSummaries[0].eventCount = 19
    contradictoryService.serviceSummaries[0].successCount = 19
    contradictoryService.serviceSummaries[0].durationCount = 19
    expect(decodeSystemHealthAggregate(contradictoryService)).toBeNull()

    const invalidLatency = structuredClone(valid)
    invalidLatency.summary.durationP50Ms = 20
    invalidLatency.summary.durationP95Ms = 10
    expect(decodeSystemHealthAggregate(invalidLatency)).toBeNull()

    const unsafeVersion = structuredClone(valid)
    unsafeVersion.engineSummaries[0].appVersion = 'raw provider secret'
    expect(decodeSystemHealthAggregate(unsafeVersion)).toBeNull()

    const inconsistentRetention = structuredClone(valid)
    inconsistentRetention.completeness.retentionClasses[0].complete = false
    expect(decodeSystemHealthAggregate(inconsistentRetention)).toBeNull()

    const missingRange = structuredClone(valid)
    delete missingRange.range
    expect(decodeSystemHealthAggregate(missingRange)).toBeNull()
  })

  it('rejects a valid aggregate returned for a different requested range', async () => {
    const reader = { aggregate: vi.fn().mockResolvedValue(aggregate()) }
    await expect(createAdminHealthSource({ reader }).read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toThrow('health_source_unavailable')
  })

  it('derives disabled states only from server-owned exact-default-off gates', () => {
    expect([...disabledHealthEngines({})]).toEqual(['study', 'tts', 'gateway'])
    expect([...disabledHealthEngines({
      ACADEMY_STUDY_ENABLED: 'true', ACADEMY_TTS_ENABLED: 'on', ACADEMY_AI_ENABLED: '1',
    })]).toEqual([])
    expect([...disabledHealthEngines({ ACADEMY_STUDY_ENABLED: 'true' })]).toEqual(['tts', 'gateway'])
  })
})
