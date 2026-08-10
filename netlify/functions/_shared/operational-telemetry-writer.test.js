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
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OCCURRED_AT = '2026-08-09T14:30:00.000Z'

const ENV = Object.freeze({
  ACADEMY_APP_VERSION: 'deploy.2026.08.09',
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
    durationMs: 1_250,
    metadata: { operation: 'complete', reason_code: 'completed' },
    courseRef: 'math-5',
    unitRef: 'unit-1',
    lessonRef: 'lesson-2',
    skillRef: 'fractions.compare',
    ...overrides,
  }
}

function stored(facts) {
  return { ...facts, eventId: EVENT_ID, occurredAt: OCCURRED_AT }
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
      const event = stored(facts)
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
    resolveScope: overrides.resolveScope ?? (async () => ({
      scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: LEARNER_ID,
    })),
    resolveCurriculumVersion: overrides.resolveCurriculumVersion
      ?? (async () => 'curriculum.2026.08'),
    resolveAppVersion: overrides.resolveAppVersion,
    resolveEngineVersion: overrides.resolveEngineVersion,
    onPersistenceFailure: overrides.onPersistenceFailure,
  })
}

describe('trusted server operational telemetry writer', () => {
  it('resolves scope and versions outside the observation payload', async () => {
    const store = memoryStore()
    const telemetry = writer({ store })
    await expect(telemetry.record(observation(), { verifiedSession: 'opaque' }))
      .resolves.toMatchObject({ status: 'recorded' })
    expect(store.append).toHaveBeenCalledWith('study:execution:0001', expect.objectContaining({
      scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: LEARNER_ID,
      appVersion: 'deploy.2026.08.09', engineVersion: 'study.v2',
      curriculumVersion: 'curriculum.2026.08',
    }))
  })

  it.each(['householdRef', 'learnerRef'])('rejects browser-supplied %s authority', async (field) => {
    const store = memoryStore()
    await expect(writer({ store }).record(observation({
      [field]: '90000000-0000-4000-8000-000000000009',
    }), { browserClaim: 'untrusted' })).rejects.toMatchObject({
      code: 'telemetry_field_not_allowed',
    })
    expect(store.append).not.toHaveBeenCalled()
  })

  it.each(['appVersion', 'engineVersion', 'curriculumVersion'])('rejects browser-supplied %s', async (field) => {
    await expect(writer().record(observation({ [field]: 'forged.v999' }), {}))
      .rejects.toBeInstanceOf(OperationalTelemetryValidationError)
  })

  it('requires trusted deployment and registered engine versions', () => {
    expect(() => resolveTrustedAppVersion({})).toThrow(expect.objectContaining({
      code: 'telemetry_app_version_invalid',
    }))
    expect(() => resolveTrustedEngineVersion({}, 'study')).toThrow(expect.objectContaining({
      code: 'telemetry_engine_version_invalid',
    }))
    expect(resolveTrustedAppVersion({ COMMIT_REF: 'commit.123' })).toBe('commit.123')
    expect(resolveTrustedEngineVersion({ ACADEMY_SYNC_ENGINE_VERSION: 'sync.v3' }, 'sync'))
      .toBe('sync.v3')
  })

  it('inherits exact metadata privacy validation', async () => {
    await expect(writer().record(observation({ metadata: { prompt: 'private' } }), {}))
      .rejects.toMatchObject({ code: 'telemetry_prohibited_field' })
    await expect(writer().record(observation({ metadata: { arbitrary: 'blob' } }), {}))
      .rejects.toMatchObject({ code: 'telemetry_metadata_field_not_allowed' })
  })

  it('replays identical executions and conflicts on differing facts', async () => {
    const telemetry = writer()
    await expect(telemetry.record(observation(), {})).resolves.toMatchObject({ status: 'recorded' })
    await expect(telemetry.record(observation(), {})).resolves.toMatchObject({ status: 'replayed' })
    await expect(telemetry.record(observation({ result: 'fallback' }), {})).resolves.toEqual({
      status: 'reconciliation_conflict',
    })
  })

  it('isolates persistence and failure-notice errors from the completed learner action', async () => {
    const learnerState = { completedLessons: 1 }
    const notice = vi.fn(async () => { throw new Error('notice offline') })
    const store = { append: vi.fn(async () => { throw new Error('database offline') }), list: async () => [] }
    await expect(writer({ store, onPersistenceFailure: notice }).record(observation(), {}))
      .resolves.toEqual({ status: 'not-recorded', executionKey: 'study:execution:0001' })
    expect(learnerState.completedLessons).toBe(1)
    expect(notice).toHaveBeenCalledWith({
      code: 'telemetry_persistence_failed', engine: 'study',
      eventType: 'study.session', executionKey: 'study:execution:0001',
    })
  })
})
