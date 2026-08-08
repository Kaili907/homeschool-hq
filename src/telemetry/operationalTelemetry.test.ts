import { describe, expect, it, vi } from 'vitest'
import {
  OPERATIONAL_TELEMETRY_MAX_DURATION_MS,
  OperationalTelemetryValidationError,
  createOperationalEvent,
  createOperationalTelemetry,
  decodeStoredOperationalEvents,
  type OperationalEvent,
  type OperationalEventInput,
  type OperationalTelemetryStore,
} from './operationalTelemetry'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'
const SECOND_EVENT_ID = '00000000-0000-4000-8000-000000000002'
const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OCCURRED_AT = '2026-08-08T14:30:00.000Z'

function sessionInput(
  overrides: Partial<Record<keyof OperationalEventInput, unknown>> = {},
): OperationalEventInput {
  return {
    eventId: EVENT_ID,
    occurredAt: OCCURRED_AT,
    householdRef: HOUSEHOLD_ID,
    learnerRef: LEARNER_ID,
    engine: 'study',
    engineVersion: 'study-runtime.v1',
    applicationVersion: '0.1.0',
    curriculumVersion: 'math-r1',
    courseRef: 'math-5',
    unitRef: 'unit-1',
    lessonRef: 'lesson-2',
    skillRef: 'fractions.compare',
    eventType: 'session.lifecycle',
    result: 'success',
    durationMs: 1_250,
    metadata: { phase: 'completed' },
    ...overrides,
  } as OperationalEventInput
}

function validationCode(input: unknown): string | undefined {
  try {
    createOperationalEvent(input as OperationalEventInput)
    return undefined
  } catch (error) {
    return error instanceof OperationalTelemetryValidationError
      ? error.code
      : undefined
  }
}

describe('privacy-safe operational event contract', () => {
  it('accepts a valid typed event and normalizes its durable envelope', () => {
    expect(createOperationalEvent(sessionInput())).toEqual({
      schemaVersion: 1,
      eventId: EVENT_ID,
      occurredAt: OCCURRED_AT,
      householdRef: HOUSEHOLD_ID,
      learnerRef: LEARNER_ID,
      engine: 'study',
      engineVersion: 'study-runtime.v1',
      applicationVersion: '0.1.0',
      curriculumVersion: 'math-r1',
      courseRef: 'math-5',
      unitRef: 'unit-1',
      lessonRef: 'lesson-2',
      skillRef: 'fractions.compare',
      eventType: 'session.lifecycle',
      result: 'success',
      durationMs: 1_250,
      metadata: { phase: 'completed' },
    })
  })

  it('rejects invalid engines and event/engine combinations', () => {
    expect(validationCode(sessionInput({ engine: 'jarvis' }))).toBe(
      'telemetry_engine_invalid',
    )
    expect(validationCode(sessionInput({ engine: 'sync' }))).toBe(
      'telemetry_event_engine_mismatch',
    )
  })

  it('rejects invalid results', () => {
    expect(validationCode(sessionInput({ result: 'mostly-ok' }))).toBe(
      'telemetry_result_invalid',
    )
  })

  it('rejects malformed and non-canonical timestamps', () => {
    expect(validationCode(sessionInput({ occurredAt: '2026-08-08' }))).toBe(
      'telemetry_occurred_at_invalid',
    )
    expect(
      validationCode(sessionInput({ occurredAt: '2026-02-30T10:00:00.000Z' })),
    ).toBe('telemetry_occurred_at_invalid')
  })

  it('enforces duration bounds and accepts both endpoints', () => {
    expect(createOperationalEvent(sessionInput({ durationMs: 0 })).durationMs).toBe(0)
    expect(
      createOperationalEvent(
        sessionInput({ durationMs: OPERATIONAL_TELEMETRY_MAX_DURATION_MS }),
      ).durationMs,
    ).toBe(OPERATIONAL_TELEMETRY_MAX_DURATION_MS)
    expect(validationCode(sessionInput({ durationMs: -1 }))).toBe(
      'telemetry_duration_invalid',
    )
    expect(
      validationCode(
        sessionInput({ durationMs: OPERATIONAL_TELEMETRY_MAX_DURATION_MS + 1 }),
      ),
    ).toBe('telemetry_duration_invalid')
  })

  it('rejects excessive, unknown, and prohibited metadata', () => {
    const oversized = {
      operation: `learner-state${'x'.repeat(600)}`,
      retryable: false,
    }
    expect(
      validationCode(
        sessionInput({ eventType: 'persistence.operation', metadata: oversized }),
      ),
    ).toBe('telemetry_metadata_too_large')
    expect(
      validationCode(sessionInput({ metadata: { phase: 'completed', attempt: 1 } })),
    ).toBe('telemetry_metadata_field_not_allowed')
    expect(
      validationCode(sessionInput({ metadata: { phase: 'completed', rawPrompt: 'x' } })),
    ).toBe('telemetry_prohibited_field')
  })

  it('rejects prohibited raw content at the event boundary', () => {
    expect(
      validationCode({ ...sessionInput(), rawTutorConversation: 'private text' }),
    ).toBe('telemetry_prohibited_field')
    expect(
      JSON.stringify(createOperationalEvent(sessionInput())),
    ).not.toMatch(/conversation|prompt|response|answer|journal|audio/i)
  })

  it('accepts a legitimate learner-less infrastructure event', () => {
    const event = createOperationalEvent({
      eventId: EVENT_ID,
      occurredAt: OCCURRED_AT,
      householdRef: HOUSEHOLD_ID,
      engine: 'infrastructure',
      engineVersion: 'health-probe.v1',
      eventType: 'infrastructure.health',
      result: 'unavailable',
      metadata: { component: 'database', state: 'unavailable' },
    })
    expect(event.learnerRef).toBeNull()
  })

  it('requires learner scope for learner event variants', () => {
    expect(validationCode(sessionInput({ learnerRef: null }))).toBe(
      'telemetry_learner_scope_invalid',
    )
    expect(
      validationCode(
        sessionInput({
          engine: 'infrastructure',
          eventType: 'infrastructure.health',
          learnerRef: LEARNER_ID,
          metadata: { component: 'network', state: 'healthy' },
        }),
      ),
    ).toBe('telemetry_learner_scope_invalid')
  })

  it('requires curriculum version whenever curriculum references are present', () => {
    expect(validationCode(sessionInput({ curriculumVersion: null }))).toBe(
      'telemetry_version_invalid',
    )
  })
})

describe('operational telemetry resilience boundary', () => {
  it('handles malformed stored rows without exposing them to callers', () => {
    const valid = createOperationalEvent(sessionInput())
    const malformed = { ...valid, metadata: { phase: 'completed', rawAnswer: 'secret' } }
    const decoded = decodeStoredOperationalEvents([valid, malformed, null])
    expect(decoded.events).toEqual([valid])
    expect(decoded.rejectedRows).toBe(2)
  })

  it('does not corrupt a successful learner action when telemetry persistence fails', async () => {
    const learnerState = { completedLessons: 0 }
    learnerState.completedLessons += 1
    const notices: unknown[] = []
    const telemetry = createOperationalTelemetry({
      store: {
        append: async () => {
          throw new Error('database unavailable')
        },
        list: async () => [],
      },
      onPersistenceFailure: (notice) => {
        notices.push(notice)
      },
    })

    await expect(telemetry.record(sessionInput())).resolves.toEqual({
      status: 'not-recorded',
      eventId: EVENT_ID,
    })
    expect(learnerState.completedLessons).toBe(1)
    expect(notices).toEqual([{
      code: 'telemetry_persistence_failed',
      eventId: EVENT_ID,
      engine: 'study',
      eventType: 'session.lifecycle',
    }])
    expect(JSON.stringify(notices)).not.toContain(HOUSEHOLD_ID)
    expect(JSON.stringify(notices)).not.toContain(LEARNER_ID)
  })

  it('does not silently overwrite when an event ID collides', async () => {
    const rows = new Map<string, OperationalEvent>()
    const store: OperationalTelemetryStore = {
      async append(event) {
        if (rows.has(event.eventId)) throw new Error('event ID collision')
        rows.set(event.eventId, event)
      },
      async list() {
        return [...rows.values()]
      },
    }
    const telemetry = createOperationalTelemetry({ store })
    await expect(telemetry.record(sessionInput())).resolves.toMatchObject({
      status: 'recorded',
    })
    await expect(
      telemetry.record(sessionInput({ result: 'failure' })),
    ).resolves.toEqual({ status: 'not-recorded', eventId: EVENT_ID })
    expect(rows.get(EVENT_ID)?.result).toBe('success')

    await expect(
      telemetry.record(sessionInput({ eventId: SECOND_EVENT_ID })),
    ).resolves.toMatchObject({ status: 'recorded' })
    expect(rows).toHaveLength(2)
  })

  it('validates reads and counts malformed database results', async () => {
    const valid = createOperationalEvent(sessionInput())
    const list = vi.fn(async () => [valid, { unexpected: true }])
    const telemetry = createOperationalTelemetry({
      store: { append: async () => {}, list },
    })
    await expect(
      telemetry.list({ householdRef: HOUSEHOLD_ID, limit: 50 }),
    ).resolves.toEqual({ events: [valid], rejectedRows: 1 })
    expect(list).toHaveBeenCalledWith({
      householdRef: HOUSEHOLD_ID,
      learnerRef: null,
      limit: 50,
    })
  })
})
