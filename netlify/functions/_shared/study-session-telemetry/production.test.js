import { describe, expect, it, vi } from 'vitest'
import { createProductionStudySessionTelemetryWorker } from './production.js'

const CLAIM = Object.freeze({
  outboxId: '10000000-0000-4000-8000-000000000001',
  executionKey: 'study:session:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  householdRef: '20000000-0000-4000-8000-000000000001',
  authoritativeOperation: 'session:begin',
  operation: 'begin',
  result: 'success',
  sessionRevision: 1,
  checkpointRevision: null,
  acceptedAt: '2026-08-10T15:51:00.000Z',
  curriculumVersion: '1.0.0',
  lessonRef: 'lesson-production-a',
  reasonCode: 'session-begun',
  attemptCount: 1,
  leaseToken: '30000000-0000-4000-8000-000000000001',
})
const EVENT_ID = '40000000-0000-4000-8000-000000000001'

describe('production Study session telemetry composition', () => {
  it('connects private claims to the canonical writer without learner identity', async () => {
    const rpc = vi.fn(async (name, parameters) => {
      if (name === 'academy_claim_study_session_telemetry_outbox_v1') {
        return { data: [CLAIM], error: null }
      }
      if (name === 'academy_record_operational_event_v2') {
        const facts = parameters.p_facts
        return {
          data: {
            status: 'created',
            event: {
              schemaVersion: 2,
              eventId: EVENT_ID,
              occurredAt: '2026-08-10T15:55:00.000Z',
              scope: facts.scope,
              householdRef: facts.household_id,
              learnerRef: facts.learner_id,
              engine: facts.engine,
              appVersion: facts.app_version,
              engineVersion: facts.engine_version,
              curriculumVersion: facts.curriculum_version,
              courseRef: facts.course_ref,
              unitRef: facts.unit_ref,
              lessonRef: facts.lesson_ref,
              skillRef: facts.skill_ref,
              eventType: facts.event_type,
              result: facts.result,
              durationMs: facts.duration_ms,
              metadata: facts.metadata,
            },
          },
          error: null,
        }
      }
      if (name === 'academy_complete_study_session_telemetry_outbox_v1') {
        return { data: true, error: null }
      }
      throw new Error(`unexpected rpc ${name}`)
    })
    const worker = createProductionStudySessionTelemetryWorker({
      env: {
        ACADEMY_APP_VERSION: 'deploy.2026.08.10',
        ACADEMY_STUDY_ENGINE_VERSION: 'study.v2',
      },
      client: { rpc },
    })
    await expect(worker.run()).resolves.toMatchObject({ delivered: 1 })
    const write = rpc.mock.calls.find(([name]) =>
      name === 'academy_record_operational_event_v2')
    expect(write[1]).toEqual({
      p_execution_key: CLAIM.executionKey,
      p_facts: expect.objectContaining({
        scope: 'household',
        household_id: CLAIM.householdRef,
        learner_id: null,
        engine: 'study',
        event_type: 'study.session',
        result: 'success',
        curriculum_version: '1.0.0',
        lesson_ref: 'lesson-production-a',
        metadata: {
          operation: 'begin',
          reason_code: 'session-begun',
          source: 'study-session-outbox',
        },
      }),
    })
    expect(JSON.stringify(write)).not.toMatch(/acceptedAt|sessionRevision|checkpointRevision|student/i)
  })
})
