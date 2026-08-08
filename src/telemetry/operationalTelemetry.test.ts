import { describe, expect, it, vi } from 'vitest'
import {
  ADMIN_ENGINE_IDS,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_TELEMETRY_EVENT_TYPES,
  OPERATIONAL_TELEMETRY_MAX_DURATION_MS,
  OperationalTelemetryValidationError,
  createOperationalTelemetry,
  decodeStoredOperationalEvents,
  validateTrustedOperationalEventInput,
  type AcceptedOperationalEventFacts,
  type AdminOperationalEvent,
  type OperationalTelemetryStore,
  type TrustedOperationalEventInput,
} from './operationalTelemetry'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OCCURRED_AT = '2026-08-08T14:30:00.000Z'
const AUTHORIZATION = { kind: 'server-resolved-admin', capability: 'engines:read' } as const

function input(overrides: Record<string, unknown> = {}): TrustedOperationalEventInput {
  return {
    executionKey: 'study:execution:0001',
    scope: 'household',
    householdRef: HOUSEHOLD_ID,
    learnerRef: LEARNER_ID,
    engine: 'study',
    appVersion: 'deploy.2026.08.08',
    engineVersion: 'study.v2',
    curriculumVersion: 'math-r1',
    courseRef: 'math-5',
    unitRef: 'unit-1',
    lessonRef: 'lesson-2',
    skillRef: 'fractions.compare',
    eventType: 'study.session',
    result: 'success',
    durationMs: 1_250,
    metadata: { operation: 'complete', reason_code: 'completed' },
    ...overrides,
  } as TrustedOperationalEventInput
}

function stored(facts = validateTrustedOperationalEventInput(input()).facts): AdminOperationalEvent {
  return { ...facts, eventId: EVENT_ID, occurredAt: OCCURRED_AT } as AdminOperationalEvent
}

function validationCode(value: unknown): string | undefined {
  try {
    validateTrustedOperationalEventInput(value as TrustedOperationalEventInput)
  } catch (error) {
    return error instanceof OperationalTelemetryValidationError ? error.code : undefined
  }
}

describe('ADMIN-0 v2 operational event contract', () => {
  it('mirrors the canonical engine, result, and event-type vocabularies exactly', () => {
    expect(ADMIN_ENGINE_IDS).toEqual([
      'tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync',
    ])
    expect(ADMIN_OPERATIONAL_RESULTS).toEqual([
      'success', 'fallback', 'rejected', 'timeout', 'provider_error',
      'validation_error', 'safety_stop',
    ])
    expect(ADMIN_TELEMETRY_EVENT_TYPES).toEqual([
      'tutor.turn', 'study.session', 'assessment.attempt', 'curriculum.load',
      'jarvis.turn', 'tts.synthesis', 'gateway.request', 'sync.operation',
      'safety.classification', 'persistence.operation',
    ])
  })

  it.each([
    ['tutor', 'tutor.turn'], ['study', 'study.session'],
    ['assessment', 'assessment.attempt'], ['curriculum', 'curriculum.load'],
    ['jarvis', 'jarvis.turn'], ['tts', 'tts.synthesis'],
    ['gateway', 'gateway.request'], ['sync', 'sync.operation'],
  ] as const)('accepts canonical engine %s with %s', (engine, eventType) => {
    const curriculumVersion = eventType === 'curriculum.load' ? 'curriculum.v2' : null
    expect(validateTrustedOperationalEventInput(input({
      engine, eventType, curriculumVersion,
      courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
    })).facts.engine).toBe(engine)
  })

  it.each(ADMIN_OPERATIONAL_RESULTS)('accepts canonical result %s', (result) => {
    expect(validateTrustedOperationalEventInput(input({ result })).facts.result).toBe(result)
  })

  it('uses explicit household and system discriminants', () => {
    expect(validateTrustedOperationalEventInput(input()).facts).toMatchObject({
      schemaVersion: 2, scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: LEARNER_ID,
    })
    expect(validateTrustedOperationalEventInput(input({
      executionKey: 'gateway:execution:0001', scope: 'system',
      householdRef: null, learnerRef: null, engine: 'gateway', eventType: 'gateway.request',
      curriculumVersion: null, courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
    })).facts).toMatchObject({ scope: 'system', householdRef: null, learnerRef: null })
    expect(validationCode(input({ scope: 'system' }))).toBe('telemetry_household_ref_invalid')
  })

  it('requires app and engine versions and applies curriculum version only when relevant', () => {
    expect(validationCode(input({ appVersion: null }))).toBe('telemetry_app_version_invalid')
    expect(validationCode(input({ engineVersion: null }))).toBe('telemetry_engine_version_invalid')
    expect(validationCode(input({ curriculumVersion: null }))).toBe('telemetry_curriculum_version_invalid')
    expect(validationCode(input({
      engine: 'curriculum', eventType: 'curriculum.load', curriculumVersion: null,
      courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
    }))).toBe('telemetry_curriculum_version_invalid')
    expect(validateTrustedOperationalEventInput(input({
      engine: 'gateway', eventType: 'gateway.request', curriculumVersion: null,
      courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
    })).facts.curriculumVersion).toBeNull()
  })

  it('enforces event compatibility, duration bounds, and exact trusted fields', () => {
    expect(validationCode(input({ engine: 'gateway' }))).toBe('telemetry_event_engine_mismatch')
    expect(validationCode(input({ durationMs: -1 }))).toBe('telemetry_duration_invalid')
    expect(validationCode(input({ durationMs: OPERATIONAL_TELEMETRY_MAX_DURATION_MS + 1 })))
      .toBe('telemetry_duration_invalid')
    expect(validationCode({ ...input(), eventId: EVENT_ID })).toBe('telemetry_field_not_allowed')
    expect(validationCode({ ...input(), occurredAt: OCCURRED_AT })).toBe('telemetry_field_not_allowed')
  })

  it('allowlists bounded flat metadata and canonical reason codes', () => {
    expect(validateTrustedOperationalEventInput(input({ metadata: {
      attempt: 1, cache_hit: false, http_status: 503, retryable: true,
      reason_code: 'provider_timeout', severity: 'error',
    } })).facts.metadata).toEqual({
      attempt: 1, cache_hit: false, http_status: 503, retryable: true,
      reason_code: 'provider_timeout', severity: 'error',
    })
    expect(validationCode(input({ metadata: { phase: 'done' } })))
      .toBe('telemetry_metadata_field_not_allowed')
    expect(validationCode(input({ metadata: { provider: { name: 'x' } } })))
      .toBe('telemetry_metadata_value_invalid')
    expect(validationCode(input({ metadata: { provider: 'x'.repeat(129) } })))
      .toBe('telemetry_metadata_value_invalid')
    expect(validationCode(input({ metadata: { provider: 'sk-secret-value' } })))
      .toBe('telemetry_metadata_value_invalid')
  })

  it('rejects privacy-prohibited fields at input and stored-read boundaries', () => {
    expect(validationCode({ ...input(), prompt: 'private' })).toBe('telemetry_prohibited_field')
    expect(validationCode(input({ metadata: { raw_answer: 'private' } })))
      .toBe('telemetry_prohibited_field')
    const safe = stored()
    expect(decodeStoredOperationalEvents([safe, { ...safe, response: 'private' }, null]))
      .toEqual({ events: [safe], rejectedRows: 2 })
    expect(JSON.stringify(safe)).not.toMatch(/messages|conversation|prompt|response|audio|answer_content/i)
  })
})

describe('idempotency, read authorization, and failure semantics', () => {
  function memoryStore(): OperationalTelemetryStore {
    const rows = new Map<string, { facts: AcceptedOperationalEventFacts; event: AdminOperationalEvent }>()
    return {
      async append(executionKey, facts) {
        const previous = rows.get(executionKey)
        if (previous) {
          return JSON.stringify(previous.facts) === JSON.stringify(facts)
            ? { status: 'replayed', event: previous.event }
            : { status: 'reconciliation_conflict' }
        }
        const event = stored(facts)
        rows.set(executionKey, { facts, event })
        return { status: 'created', event }
      },
      async list() { return [...rows.values()].map(({ event }) => event) },
    }
  }

  it('replays identical trusted executions and conflicts on differing facts', async () => {
    const telemetry = createOperationalTelemetry({ store: memoryStore() })
    await expect(telemetry.record(input())).resolves.toMatchObject({ status: 'recorded' })
    await expect(telemetry.record(input())).resolves.toMatchObject({ status: 'replayed' })
    await expect(telemetry.record(input({ result: 'fallback' }))).resolves.toEqual({
      status: 'reconciliation_conflict',
    })
  })

  it('keeps successful learner state when best-effort telemetry fails', async () => {
    const learnerState = { completedLessons: 1 }
    const notice = vi.fn()
    const telemetry = createOperationalTelemetry({
      store: { append: async () => { throw new Error('offline') }, list: async () => [] },
      onPersistenceFailure: notice,
    })
    await expect(telemetry.record(input())).resolves.toEqual({
      status: 'not-recorded', executionKey: 'study:execution:0001',
    })
    expect(learnerState.completedLessons).toBe(1)
    expect(notice).toHaveBeenCalledWith({
      code: 'telemetry_persistence_failed', engine: 'study',
      eventType: 'study.session', executionKey: 'study:execution:0001',
    })
    expect(JSON.stringify(notice.mock.calls)).not.toContain(HOUSEHOLD_ID)
  })

  it('requires server-resolved Admin engines:read and validates bounded filters', async () => {
    const list = vi.fn(async () => [stored(), { malformed: true }])
    const telemetry = createOperationalTelemetry({
      store: { append: async () => ({ status: 'created', event: stored() }), list },
    })
    const filter = { scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: null, limit: 50 } as const
    await expect(telemetry.list(filter, AUTHORIZATION)).resolves.toEqual({
      events: [stored()], rejectedRows: 1,
    })
    expect(list).toHaveBeenCalledWith(filter, AUTHORIZATION)
    await expect(telemetry.list(filter, { kind: 'server-resolved-admin', capability: 'health:read' } as never))
      .rejects.toMatchObject({ code: 'telemetry_read_authorization_invalid' })
  })
})
