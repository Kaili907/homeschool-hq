import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_ENGINE_IDS,
  OperationalTelemetryValidationError,
} from '../../../src/telemetry/operationalTelemetry.ts'
import {
  createServerOperationalTelemetryWriter,
  resolveTrustedAppVersion,
  resolveTrustedEngineVersion,
} from './operational-telemetry-writer.js'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const OCCURRED_AT = '2026-08-10T15:55:00.000Z'
const ENV = Object.freeze({
  ACADEMY_APP_VERSION: 'deploy.2026.08.10',
  ...Object.fromEntries(ADMIN_ENGINE_IDS.map((engine) => [
    `ACADEMY_${engine.toUpperCase()}_ENGINE_VERSION`, `${engine}.v2`,
  ])),
})

function observation(overrides = {}) {
  return {
    executionKey: 'study:execution:0001',
    engine: 'study',
    eventType: 'study.session',
    result: 'success',
    durationMs: null,
    metadata: { operation: 'complete', reason_code: 'session-completed' },
    courseRef: null,
    unitRef: null,
    lessonRef: 'lesson-production-a',
    skillRef: null,
    ...overrides,
  }
}

function memoryStore() {
  const rows = new Map()
  return {
    append: vi.fn(async (executionKey, facts) => {
      const previous = rows.get(executionKey)
      if (previous) {
        return JSON.stringify(previous.facts) === JSON.stringify(facts)
          ? { status: 'replayed', event: previous.event }
          : { status: 'reconciliation_conflict' }
      }
      const event = { ...facts, eventId: EVENT_ID, occurredAt: OCCURRED_AT }
      rows.set(executionKey, { facts, event })
      return { status: 'created', event }
    }),
    list: async () => [],
  }
}

function writer(overrides = {}) {
  return createServerOperationalTelemetryWriter({
    env: ENV,
    store: overrides.store ?? memoryStore(),
    resolveScope: async () => ({
      scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: null,
    }),
    resolveCurriculumVersion: async () => '1.0.0',
    onPersistenceFailure: overrides.onPersistenceFailure,
  })
}

describe('trusted server operational telemetry writer dependency', () => {
  it('resolves identity and versions outside the observation', async () => {
    const store = memoryStore()
    await expect(writer({ store }).record(observation(), {
      householdRef: HOUSEHOLD_ID,
    })).resolves.toMatchObject({ status: 'recorded' })
    expect(store.append).toHaveBeenCalledWith(
      'study:execution:0001',
      expect.objectContaining({
        scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: null,
        appVersion: 'deploy.2026.08.10', engineVersion: 'study.v2',
        curriculumVersion: '1.0.0',
      }),
    )
  })

  it.each(['householdRef', 'learnerRef', 'appVersion', 'engineVersion', 'occurredAt'])(
    'rejects observation-authored %s authority',
    async (field) => {
      await expect(writer().record(observation({ [field]: 'forged' }), {}))
        .rejects.toBeInstanceOf(OperationalTelemetryValidationError)
    },
  )

  it('requires trusted deployment and Study engine versions', () => {
    expect(() => resolveTrustedAppVersion({})).toThrow(expect.objectContaining({
      code: 'telemetry_app_version_invalid',
    }))
    expect(() => resolveTrustedEngineVersion({}, 'study')).toThrow(
      expect.objectContaining({ code: 'telemetry_engine_version_invalid' }),
    )
    expect(() => resolveTrustedAppVersion({ ACADEMY_APP_VERSION: 'latest' })).toThrow(
      expect.objectContaining({ code: 'telemetry_app_version_invalid' }),
    )
    expect(() => resolveTrustedEngineVersion({
      ACADEMY_STUDY_ENGINE_VERSION: 'LATEST',
    }, 'study')).toThrow(expect.objectContaining({ code: 'telemetry_engine_version_invalid' }))
  })

  it('inherits privacy and metadata allowlist validation', async () => {
    await expect(writer().record(observation({ metadata: { prompt: 'private' } }), {}))
      .rejects.toMatchObject({ code: 'telemetry_prohibited_field' })
    await expect(writer().record(observation({ metadata: { arbitrary: 'blob' } }), {}))
      .rejects.toMatchObject({ code: 'telemetry_metadata_field_not_allowed' })
  })

  it('replays identical executions and conflicts changed facts', async () => {
    const telemetry = writer()
    await expect(telemetry.record(observation(), {})).resolves.toMatchObject({
      status: 'recorded',
    })
    await expect(telemetry.record(observation(), {})).resolves.toMatchObject({
      status: 'replayed',
    })
    await expect(telemetry.record(observation({ result: 'fallback' }), {}))
      .resolves.toEqual({ status: 'reconciliation_conflict' })
  })

  it('isolates persistence and failure-notice errors', async () => {
    const notice = vi.fn(async () => { throw new Error('notice offline') })
    const store = {
      append: vi.fn(async () => { throw new Error('database offline') }),
      list: async () => [],
    }
    await expect(writer({ store, onPersistenceFailure: notice }).record(
      observation(), {},
    )).resolves.toEqual({
      status: 'not-recorded', executionKey: 'study:execution:0001',
    })
    expect(notice).toHaveBeenCalledWith({
      code: 'telemetry_persistence_failed',
      engine: 'study',
      eventType: 'study.session',
      executionKey: 'study:execution:0001',
    })
  })
})
