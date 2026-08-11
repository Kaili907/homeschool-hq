import { describe, expect, it, vi } from 'vitest'
import { createAdminStudyWorkerEvidenceSource } from './admin-study-worker-evidence-source.js'

const NOW = new Date('2026-08-10T16:00:00.000Z')
const EVIDENCE = Object.freeze({
  schemaVersion: 1,
  configuredState: 'configured',
  latestRunTimestamp: '2026-08-10T15:55:00.000Z',
  latestSuccessfulRunTimestamp: '2026-08-10T15:55:00.000Z',
  latestResultCategory: 'processed',
  stalenessClassification: 'healthy',
  workerVersion: 'adult-review-worker.v2',
})

function clientResult(result) {
  const abortSignal = vi.fn().mockResolvedValue(result)
  return {
    client: { rpc: vi.fn(() => ({ abortSignal })) },
    abortSignal,
  }
}

describe('Admin Study worker evidence source', () => {
  it('reads the authoritative status RPC at a server-derived observation time', async () => {
    const { client, abortSignal } = clientResult({ data: EVIDENCE, error: null })
    const source = createAdminStudyWorkerEvidenceSource({ client, now: () => NOW })

    await expect(source.read()).resolves.toEqual(EVIDENCE)
    expect(client.rpc).toHaveBeenCalledWith(
      'academy_study_adult_review_worker_status_v1',
      { p_observed_at: NOW.toISOString() },
    )
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  })

  it.each([
    ['malformed projection', { data: { ...EVIDENCE, deliveryIds: ['private'] }, error: null }],
    ['permission denied', { data: null, error: { code: '42501', message: 'private SQL detail' } }],
  ])('fails closed for %s with one bounded error', async (_label, result) => {
    const { client } = clientResult(result)
    const source = createAdminStudyWorkerEvidenceSource({ client, now: () => NOW })
    await expect(source.read()).rejects.toThrow('worker_evidence_source_unavailable')
  })

  it('does not create a client when service configuration is incomplete', async () => {
    const source = createAdminStudyWorkerEvidenceSource({ env: {}, now: () => NOW })
    await expect(source.read()).rejects.toThrow('worker_evidence_source_unavailable')
  })
})
