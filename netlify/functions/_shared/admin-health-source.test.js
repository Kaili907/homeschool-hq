import { describe, expect, it, vi } from 'vitest'
import {
  createAdminHealthSource,
  decodeSystemHealthAggregate,
  disabledHealthEngines,
} from './admin-health-source.js'

const NOW = new Date('2026-08-08T12:00:00.000Z')
const DEFAULT_RANGE = {
  start: '2026-08-08T11:00:00.000Z',
  endExclusive: '2026-08-08T12:00:00.001Z',
  maximumDays: 366,
}

function completeness(overrides = {}) {
  return {
    grouping: 'complete',
    groupCount: 1,
    groupLimit: 4096,
    allRetentionClasses: true,
    retentionClasses: [
      { category: 'diagnostic_short', retainedDays: 30, complete: true },
      { category: 'operational_standard', retainedDays: 90, complete: true },
      { category: 'safety_extended', retainedDays: 365, complete: true },
    ],
    ...overrides,
  }
}

function group(overrides = {}) {
  return {
    retentionCategory: 'diagnostic_short',
    engine: 'study',
    appVersion: 'deploy.1',
    engineVersion: 'study.v2',
    curriculumVersion: null,
    courseRef: null,
    unitRef: null,
    eventType: 'study.session',
    result: 'success',
    operation: 'complete',
    reasonCode: null,
    provider: null,
    route: null,
    eventCount: 501,
    durationCount: 501,
    durationTotalMs: 125_751,
    durationP50Ms: 251,
    durationP95Ms: 476,
    firstOccurredAt: DEFAULT_RANGE.start,
    lastOccurredAt: '2026-08-08T11:59:50.000Z',
    ...overrides,
  }
}

function aggregate(overrides = {}) {
  return {
    schemaVersion: 2,
    range: DEFAULT_RANGE,
    filters: { engine: null, engineVersion: null, courseRef: null, unitRef: null },
    completeness: completeness(),
    totalEventCount: 501,
    groups: [group()],
    ...overrides,
  }
}

function aggregateForRange(parameters, overrides = {}) {
  const lastOccurredAt = new Date(Date.parse(parameters.p_end) - 10).toISOString()
  return aggregate({
    range: { start: parameters.p_start, endExclusive: parameters.p_end, maximumDays: 366 },
    groups: [group({ firstOccurredAt: parameters.p_start, lastOccurredAt })],
    ...overrides,
  })
}

describe('System Health telemetry source', () => {
  it('uses only TEL-FOUNDATION aggregates with health:read and keeps >500 represented events complete', async () => {
    const rpc = vi.fn((_name, parameters) => ({
      abortSignal: vi.fn().mockResolvedValue({ data: aggregateForRange(parameters), error: null }),
    }))
    const evidence = await createAdminHealthSource({ client: { rpc } }).read({
      now: NOW,
      selectedWindow: '1h',
    })
    expect(evidence.evaluation).toMatchObject({
      summary: { eventCount: 501, successCount: 501, durationP50Ms: 251, durationP95Ms: 476 },
      engines: [{ engineId: 'study', eventCount: 501 }],
    })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenNthCalledWith(1, 'academy_aggregate_operational_events_v2', {
      p_start: '2026-08-08T11:00:00.000Z',
      p_end: '2026-08-08T12:00:00.001Z',
      p_engine: null,
      p_engine_version: null,
      p_course_ref: null,
      p_unit_ref: null,
      p_required_capability: 'health:read',
    })
    expect(rpc.mock.calls.flat().join(' ')).not.toContain('academy_list_operational_events_v2')
  })

  it('derives weighted health counts and conservative latency from canonical groups', () => {
    const groups = [
      group({ eventCount: 90, durationCount: 90, durationTotalMs: 9_000, durationP50Ms: 100, durationP95Ms: 150 }),
      group({
        retentionCategory: 'operational_standard', result: 'timeout', eventCount: 10,
        durationCount: 10, durationTotalMs: 20_000, durationP50Ms: 2_000, durationP95Ms: 5_500,
      }),
    ]
    const decoded = decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ groupCount: 2 }),
      totalEventCount: 100,
      groups,
    }))
    expect(decoded).toMatchObject({
      summary: {
        eventCount: 100, successCount: 90, timeoutCount: 10,
        durationCount: 100, durationP50Ms: 2_000, durationP95Ms: 5_500,
      },
      engines: [{ engineId: 'study', eventCount: 100, successCount: 90, timeoutCount: 10 }],
    })
  })

  it('accepts a complete empty aggregate as no telemetry', () => {
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ groupCount: 0 }),
      totalEventCount: 0,
      groups: [],
    }))).toMatchObject({ summary: { eventCount: 0 }, engines: [], services: [] })
  })

  it('validates declared group limits, returned counts, represented totals, and complete grouping', async () => {
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ groupLimit: 500 }),
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ groupCount: 2 }),
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({ totalEventCount: 500 }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ grouping: 'partial' }),
    }))).toBeNull()

    const reader = { aggregate: vi.fn((parameters) => Promise.resolve(aggregateForRange({
      p_start: parameters.start,
      p_end: parameters.endExclusive,
    }, {
      completeness: completeness({ grouping: 'partial' }),
    }))) }
    await expect(createAdminHealthSource({ reader }).read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toMatchObject({ code: 'group_incomplete' })
  })

  it('rejects malformed dimensions, durations, duplicate groups, unsafe fields, and mismatched ranges', async () => {
    expect(decodeSystemHealthAggregate(aggregate({
      groups: [group({ courseRef: 'math/grade-5', unitRef: 'unit/1' })],
    }))).not.toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({
      groups: [group({ courseRef: 'raw learner content' })],
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({
      groups: [group({ engine: 'study', eventType: 'gateway.request' })],
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({
      groups: [group({ durationP50Ms: 500, durationP95Ms: 100 })],
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({
      completeness: completeness({ groupCount: 2 }),
      totalEventCount: 1_002,
      groups: [group(), group()],
    }))).toBeNull()
    expect(decodeSystemHealthAggregate({
      ...aggregate(),
      rawProviderResponse: { secret: 'SECRET' },
    })).toBeNull()

    const reader = { aggregate: vi.fn((parameters) => Promise.resolve(aggregateForRange({
      p_start: parameters.start,
      p_end: parameters.endExclusive,
    }, { totalEventCount: 500 }))) }
    await expect(createAdminHealthSource({ reader }).read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toMatchObject({ code: 'malformed' })
  })

  it('distinguishes retention-limited, timeout, unavailable, and group-overflow evidence', async () => {
    const limitedCompleteness = completeness({
        allRetentionClasses: false,
        retentionClasses: [
          { category: 'diagnostic_short', retainedDays: 30, complete: false },
          { category: 'operational_standard', retainedDays: 90, complete: true },
          { category: 'safety_extended', retainedDays: 365, complete: true },
        ],
    })
    await expect(createAdminHealthSource({
      reader: { aggregate: vi.fn((parameters) => Promise.resolve(aggregateForRange({
        p_start: parameters.start,
        p_end: parameters.endExclusive,
      }, { completeness: limitedCompleteness }))) },
    }).read({ now: NOW, selectedWindow: '1h' })).rejects.toMatchObject({ code: 'retention_limited' })

    for (const [sourceCode, healthCode] of [
      ['source_timeout', 'timeout'],
      ['source_unavailable', 'unavailable'],
      ['source_group_incomplete', 'group_incomplete'],
    ]) {
      await expect(createAdminHealthSource({
        reader: { aggregate: vi.fn().mockRejectedValue({ code: sourceCode }) },
      }).read({ now: NOW, selectedWindow: '1h' })).rejects.toMatchObject({ code: healthCode })
    }
  })

  it('classifies mixed window outcomes as partial evidence', async () => {
    const reader = {
      aggregate: vi.fn((parameters) => parameters.start === '2026-08-08T10:00:00.000Z'
        ? Promise.reject({ code: 'source_unavailable' })
        : Promise.resolve(aggregateForRange({ p_start: parameters.start, p_end: parameters.endExclusive }))),
    }
    await expect(createAdminHealthSource({ reader }).read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toMatchObject({ code: 'partial' })
  })

  it('fails without a service source and never returns database details', async () => {
    await expect(createAdminHealthSource({ env: {} }).read({ now: NOW, selectedWindow: '1h' }))
      .rejects.toMatchObject({ code: 'unavailable', message: 'health_unavailable' })
  })

  it('derives disabled states only from server-owned exact-default-off gates', () => {
    expect([...disabledHealthEngines({})]).toEqual(['study', 'tts', 'gateway'])
    expect([...disabledHealthEngines({
      ACADEMY_STUDY_ENABLED: 'true', ACADEMY_TTS_ENABLED: 'on', ACADEMY_AI_ENABLED: '1',
    })]).toEqual([])
    expect([...disabledHealthEngines({ ACADEMY_STUDY_ENABLED: 'true' })]).toEqual(['tts', 'gateway'])
  })
})
