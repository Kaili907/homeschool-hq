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

function aggregate(overrides = {}) {
  const complete = summary({
    eventCount: 501, successCount: 501, durationCount: 501,
    durationP50Ms: 251, durationP95Ms: 476,
    firstOccurredAt: '2026-08-08T11:00:00.000Z', lastOccurredAt: OBSERVED_AT,
  })
  return {
    schemaVersion: 2,
    completeness: { grouping: 'complete', groupCount: 1, groupLimit: 4096, allRetentionClasses: true },
    totalEventCount: 501,
    summary: complete,
    engineSummaries: [{
      engine: 'study', appVersion: 'deploy.1', engineVersion: 'study.v2',
      curriculumVersion: null, ...complete,
    }],
    serviceSummaries: [],
    groups: [{
      engine: 'study', eventType: 'study.session', result: 'success',
      operation: 'complete', provider: null, route: null,
      eventCount: 501, lastOccurredAt: OBSERVED_AT,
    }],
    ...overrides,
  }
}

describe('System Health telemetry source', () => {
  it('uses only TEL-FOUNDATION aggregates with health:read and keeps >500 complete', async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: aggregate(), error: null })
    const rpc = vi.fn(() => ({ abortSignal }))
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
        grouping: 'complete', groupCount: 0, groupLimit: 4096, allRetentionClasses: true,
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
      completeness: { grouping: 'complete', groupCount: 1, groupLimit: 4096, allRetentionClasses: false },
    }))).toBeNull()
    expect(decodeSystemHealthAggregate(aggregate({ totalEventCount: 500 }))).toBeNull()
    const reader = { aggregate: vi.fn().mockResolvedValue(aggregate({ totalEventCount: 500 })) }
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
