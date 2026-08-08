import { describe, expect, it, vi } from 'vitest'
import { createOperationalEvent } from './operationalTelemetry'
import {
  OperationalTelemetryStoreError,
  createSupabaseOperationalTelemetryStore,
} from './supabaseOperationalTelemetry'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'

const event = createOperationalEvent({
  eventId: EVENT_ID,
  occurredAt: '2026-08-08T14:30:00.000Z',
  householdRef: HOUSEHOLD_ID,
  learnerRef: LEARNER_ID,
  engine: 'assessment',
  engineVersion: 'assessment.v2',
  applicationVersion: '0.1.0',
  curriculumVersion: 'academy-2026',
  courseRef: 'math-5',
  eventType: 'assessment.lifecycle',
  result: 'success',
  durationMs: 500,
  metadata: { phase: 'completed' },
})

describe('Supabase operational telemetry adapter', () => {
  it('writes through the narrow RPC without leaking database details to callers', async () => {
    const rpc = vi.fn(async () => ({
      data: { status: 'recorded', eventId: EVENT_ID },
      error: null,
    }))
    const store = createSupabaseOperationalTelemetryStore({ rpc })
    await store.append(event)
    expect(rpc).toHaveBeenCalledWith('academy_record_operational_event_v1', {
      p_event: {
        schema_version: 1,
        event_id: EVENT_ID,
        occurred_at: '2026-08-08T14:30:00.000Z',
        household_id: HOUSEHOLD_ID,
        learner_id: LEARNER_ID,
        engine: 'assessment',
        engine_version: 'assessment.v2',
        application_version: '0.1.0',
        curriculum_version: 'academy-2026',
        course_ref: 'math-5',
        unit_ref: null,
        lesson_ref: null,
        skill_ref: null,
        event_type: 'assessment.lifecycle',
        result: 'success',
        duration_ms: 500,
        metadata: { phase: 'completed' },
      },
    })
  })

  it('maps a duplicate database ID to an explicit collision error', async () => {
    const store = createSupabaseOperationalTelemetryStore({
      rpc: async () => ({ data: null, error: { code: '23505' } }),
    })
    await expect(store.append(event)).rejects.toEqual(
      expect.objectContaining<Partial<OperationalTelemetryStoreError>>({
        code: 'event-id-collision',
      }),
    )
  })

  it('uses the bounded read RPC and returns its untrusted payload for decoding', async () => {
    const rpc = vi.fn(async () => ({ data: [{ schemaVersion: 99 }], error: null }))
    const store = createSupabaseOperationalTelemetryStore({ rpc })
    await expect(store.list({
      householdRef: HOUSEHOLD_ID,
      learnerRef: null,
      limit: 100,
    })).resolves.toEqual([{ schemaVersion: 99 }])
    expect(rpc).toHaveBeenCalledWith('academy_list_operational_events_v1', {
      p_household_id: HOUSEHOLD_ID,
      p_learner_id: null,
      p_limit: 100,
    })
  })
})
