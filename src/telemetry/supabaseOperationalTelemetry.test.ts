import { describe, expect, it, vi } from 'vitest'
import { validateTrustedOperationalEventInput } from './operationalTelemetry'
import {
  OperationalTelemetryStoreError,
  createSupabaseOperationalTelemetryStore,
} from './supabaseOperationalTelemetry'

const EVENT_ID = '00000000-0000-4000-8000-000000000001'
const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OCCURRED_AT = '2026-08-08T14:30:00.000Z'

const validated = validateTrustedOperationalEventInput({
  executionKey: 'assessment:execution:0001',
  scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: LEARNER_ID,
  engine: 'assessment', appVersion: 'deploy.2026.08.08', engineVersion: 'assessment.v2',
  curriculumVersion: 'academy-2026', courseRef: 'math-5', unitRef: null,
  lessonRef: null, skillRef: null, eventType: 'assessment.attempt', result: 'success',
  durationMs: 500, metadata: { operation: 'submit', reason_code: 'completed' },
})
const event = { ...validated.facts, eventId: EVENT_ID, occurredAt: OCCURRED_AT }

describe('Supabase operational telemetry v2 adapter', () => {
  it('writes trusted facts without accepting caller IDs or timestamps', async () => {
    const rpc = vi.fn(async () => ({ data: { status: 'created', event }, error: null }))
    const store = createSupabaseOperationalTelemetryStore({ rpc })
    await expect(store.append(validated.executionKey, validated.facts)).resolves.toEqual({
      status: 'created', event,
    })
    expect(rpc).toHaveBeenCalledWith('academy_record_operational_event_v2', {
      p_execution_key: 'assessment:execution:0001',
      p_facts: {
        schema_version: 2, scope: 'household', household_id: HOUSEHOLD_ID,
        learner_id: LEARNER_ID, engine: 'assessment', app_version: 'deploy.2026.08.08',
        engine_version: 'assessment.v2', curriculum_version: 'academy-2026',
        course_ref: 'math-5', unit_ref: null, lesson_ref: null, skill_ref: null,
        event_type: 'assessment.attempt', result: 'success', duration_ms: 500,
        metadata: { operation: 'submit', reason_code: 'completed' },
      },
    })
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('occurred_at')
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('event_id')
  })

  it.each(['created', 'replayed'] as const)('accepts validated %s results', async (status) => {
    const store = createSupabaseOperationalTelemetryStore({
      rpc: async () => ({ data: { status, event }, error: null }),
    })
    await expect(store.append(validated.executionKey, validated.facts))
      .resolves.toEqual({ status, event })
  })

  it('returns explicit reconciliation conflicts and rejects malformed payloads', async () => {
    const conflict = createSupabaseOperationalTelemetryStore({
      rpc: async () => ({ data: { status: 'reconciliation_conflict' }, error: null }),
    })
    await expect(conflict.append(validated.executionKey, validated.facts)).resolves.toEqual({
      status: 'reconciliation_conflict',
    })
    const malformed = createSupabaseOperationalTelemetryStore({
      rpc: async () => ({ data: { status: 'created', event: { ...event, prompt: 'private' } }, error: null }),
    })
    await expect(malformed.append(validated.executionKey, validated.facts)).rejects.toMatchObject({
      code: 'database-contract',
    })
  })

  it('maps database errors without exposing database details', async () => {
    const store = createSupabaseOperationalTelemetryStore({
      rpc: async () => ({ data: null, error: { code: '42501' } }),
    })
    await expect(store.append(validated.executionKey, validated.facts)).rejects.toEqual(
      expect.objectContaining<Partial<OperationalTelemetryStoreError>>({ code: 'unauthorized' }),
    )
  })

  it('uses the Admin-only bounded v2 read RPC', async () => {
    const rpc = vi.fn(async () => ({ data: [event], error: null }))
    const store = createSupabaseOperationalTelemetryStore({ rpc })
    await expect(store.list(
      { scope: 'household', householdRef: HOUSEHOLD_ID, learnerRef: null, limit: 100 },
      { kind: 'server-resolved-admin', capability: 'engines:read' },
    )).resolves.toEqual([event])
    expect(rpc).toHaveBeenCalledWith('academy_list_operational_events_v2', {
      p_scope: 'household', p_household_id: HOUSEHOLD_ID, p_learner_id: null,
      p_limit: 100, p_required_capability: 'engines:read',
    })
  })
})
