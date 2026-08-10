import { describe, expect, it, vi } from 'vitest'
import {
  ADULT_REVIEW_RUN_EVIDENCE_KEYS,
  createSupabaseAdultReviewRunEvidence,
  executeAdultReviewWorkerRun,
} from './run-evidence.js'

const WORKER = 'worker:run-evidence-test'
const VERSION = 'credential-run-evidence-v1'
const RUN_ID = '00000000-0000-4000-8000-000000000201'

function receipt() {
  return {
    runId: RUN_ID,
    startedAt: '2026-08-10T12:00:00.000Z',
    completedAt: '2026-08-10T12:00:01.000Z',
    resultCategory: 'processed',
    claimedCount: 1,
    processedCount: 1,
    retryableFailureCount: 0,
    terminalFailureCount: 0,
    invocationKind: 'scheduled',
    reasonCode: 'completed',
  }
}

describe('Study adult-review worker run evidence adapter', () => {
  it('uses the credential-bound RPC with an exact content-free receipt', async () => {
    const call = vi.fn(async () => ({ recorded: true, replayed: false }))
    const adapter = createSupabaseAdultReviewRunEvidence({
      rpc: { isConfigured: () => true, call },
      workerIdentity: WORKER,
      credentialVersion: VERSION,
    })
    expect(adapter.isReady()).toBe(true)
    await expect(adapter.record(receipt())).resolves.toEqual({ recorded: true, replayed: false })
    expect(call).toHaveBeenCalledWith(
      'academy_study_record_adult_review_worker_run_v1',
      { p_worker_id: WORKER, p_run: receipt() },
      {
        requireWorkerCredential: true,
        workerContext: { workerIdentity: WORKER, credentialVersion: VERSION },
      },
    )
    expect(Object.keys(call.mock.calls[0][1].p_run).sort())
      .toEqual([...ADULT_REVIEW_RUN_EVIDENCE_KEYS].sort())
    expect(JSON.stringify(call.mock.calls)).not.toMatch(
      /student|learner|payload|content|provider|response|transcript|answer|note|secret/i,
    )
  })

  it('rejects widened receipt input and malformed durable acknowledgements', async () => {
    const call = vi.fn(async () => ({ recorded: true, replayed: false }))
    const adapter = createSupabaseAdultReviewRunEvidence({
      rpc: { isConfigured: () => true, call },
      workerIdentity: WORKER,
      credentialVersion: VERSION,
    })
    await expect(adapter.record({ ...receipt(), studentId: 'private' }))
      .rejects.toThrow('worker_run_evidence_contract')
    call.mockResolvedValueOnce({ recorded: true, replayed: false, detail: 'widened' })
    await expect(adapter.record(receipt())).rejects.toThrow('durable_port_contract')
  })

  it.each([
    ['no_work', { claimed: 0, delivered: 0, indeterminate: 0, failed: 0 }, 'no-work'],
    ['processed', { claimed: 2, delivered: 2, indeterminate: 0, failed: 0 }, 'completed'],
    ['partial_with_retryable_failures',
      { claimed: 2, delivered: 1, indeterminate: 0, failed: 1 }, 'retryable-failures'],
    ['failed', { claimed: 1, delivered: 0, indeterminate: 0, failed: 1 }, 'retryable-failures'],
  ])('preserves %s while recording one run receipt', async (status, result, reasonCode) => {
    const record = vi.fn(async () => ({ recorded: true, replayed: false }))
    const response = await executeAdultReviewWorkerRun({
      worker: { run: vi.fn(async () => result) },
      runEvidence: { record },
      invocationKind: 'scheduled',
      workerCredential: 'opaque-worker-credential',
      limit: 10,
      createRunId: () => RUN_ID,
      now: vi.fn()
        .mockReturnValueOnce(new Date('2026-08-10T12:00:00.000Z'))
        .mockReturnValueOnce(new Date('2026-08-10T12:00:01.000Z')),
    })
    expect(JSON.parse(response.body).status).toBe(status)
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      runId: RUN_ID,
      resultCategory: status,
      reasonCode,
    }))
  })

  it('records a systemic failure without persisting the thrown detail', async () => {
    const record = vi.fn(async () => ({ recorded: true, replayed: false }))
    const response = await executeAdultReviewWorkerRun({
      worker: { run: vi.fn(async () => { throw new Error('private database failure detail') }) },
      runEvidence: { record },
      invocationKind: 'manual',
      workerCredential: 'opaque-worker-credential',
      limit: 10,
      createRunId: () => RUN_ID,
      now: () => new Date('2026-08-10T12:00:00.000Z'),
    })
    expect(JSON.parse(response.body).status).toBe('failed')
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      resultCategory: 'failed',
      reasonCode: 'systemic-failure',
      claimedCount: 0,
    }))
    expect(JSON.stringify(record.mock.calls)).not.toContain('private database failure detail')
  })
})
