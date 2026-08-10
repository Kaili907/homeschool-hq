import { describe, expect, it, vi } from 'vitest'
import {
  StudySessionTelemetryOutboxStoreError,
  createStudySessionTelemetryOutboxStore,
} from './outbox-store.js'

const CLAIM = Object.freeze({
  outboxId: '10000000-0000-4000-8000-000000000001',
  executionKey: 'study:session:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  householdRef: '20000000-0000-4000-8000-000000000001',
  authoritativeOperation: 'checkpoint:compare-and-swap',
  operation: 'checkpoint',
  result: 'success',
  sessionRevision: 3,
  checkpointRevision: 2,
  acceptedAt: '2026-08-10T15:51:00.000Z',
  curriculumVersion: '1.0.0',
  lessonRef: 'lesson-production-a',
  reasonCode: 'checkpoint-saved',
  attemptCount: 1,
  leaseToken: '30000000-0000-4000-8000-000000000001',
})

describe('Study session telemetry Supabase outbox store', () => {
  it('claims through the narrow service RPC and validates the returned contract', async () => {
    const rpc = vi.fn(async () => ({ data: [CLAIM], error: null }))
    const store = createStudySessionTelemetryOutboxStore({ rpc })
    await expect(store.claim({ limit: 5, leaseSeconds: 20 })).resolves.toEqual([CLAIM])
    expect(rpc).toHaveBeenCalledWith(
      'academy_claim_study_session_telemetry_outbox_v1',
      { p_limit: 5, p_lease_seconds: 20 },
    )
  })

  it.each([
    { ...CLAIM, learnerRef: '40000000-0000-4000-8000-000000000001' },
    { ...CLAIM, answer: 'private' },
    { ...CLAIM, reasonCode: 'arbitrary-exception' },
    { ...CLAIM, checkpointRevision: null },
  ])('rejects malformed or privacy-expanding claim rows', async (row) => {
    const store = createStudySessionTelemetryOutboxStore({
      rpc: async () => ({ data: [row], error: null }),
    })
    await expect(store.claim()).rejects.toMatchObject({ code: 'database-contract' })
  })

  it('marks success and retry only through lease-token RPCs', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))
    const store = createStudySessionTelemetryOutboxStore({ rpc })
    await store.complete({
      outboxId: CLAIM.outboxId,
      leaseToken: CLAIM.leaseToken,
      operationalEventId: '50000000-0000-4000-8000-000000000001',
    })
    await store.retry({
      outboxId: CLAIM.outboxId,
      leaseToken: CLAIM.leaseToken,
      failureCode: 'telemetry_unavailable',
    })
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'academy_complete_study_session_telemetry_outbox_v1',
      expect.objectContaining({ p_lease_token: CLAIM.leaseToken }),
    )
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'academy_retry_study_session_telemetry_outbox_v1',
      expect.objectContaining({
        p_lease_token: CLAIM.leaseToken,
        p_failure_code: 'telemetry_unavailable',
      }),
    )
  })

  it('maps database failures without exposing raw details', async () => {
    const store = createStudySessionTelemetryOutboxStore({
      rpc: async () => ({ data: null, error: { code: '42501', message: 'raw db detail' } }),
    })
    await expect(store.claim()).rejects.toEqual(
      expect.objectContaining({ code: 'unauthorized' }),
    )
    await expect(store.retry({
      outboxId: CLAIM.outboxId,
      leaseToken: CLAIM.leaseToken,
      failureCode: 'made-up',
    })).rejects.toBeInstanceOf(StudySessionTelemetryOutboxStoreError)
  })
})
