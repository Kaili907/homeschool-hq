import { describe, expect, it, vi } from 'vitest'
import { STUDY_OPERATION_GATE_IDS } from './studyOperationsModel'
import {
  ADMIN_STUDY_OPERATIONS_ENDPOINT,
  readAdminStudyOperations,
} from './studyOperationsHttpSource'

function projection() {
  return {
    contractVersion: 2,
    schemaVersion: 1,
    generatedAt: '2026-08-10T16:00:00.000Z',
    overallStatus: 'unknown',
    gates: STUDY_OPERATION_GATE_IDS.map((id) => ({
      id,
      status: 'unknown',
      reasonCode: 'unknown_evidence',
      contractVersion: null,
      lastVerifiedAt: null,
      operatorAction: 'retry_evidence',
    })),
  }
}

describe('Admin Study Operations browser source', () => {
  it('uses the authenticated minimized no-store request', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => projection() }))
    const state = await readAdminStudyOperations({
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl,
    })
    expect(state.status).toBe('ready')
    expect(fetchImpl).toHaveBeenCalledWith(ADMIN_STUDY_OPERATIONS_ENDPOINT, expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer synthetic.access.token' },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }))
  })

  it.each([401, 403])('maps server permission status %i to denied', async (status) => {
    expect(await readAdminStudyOperations({
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl: async () => ({ status, json: async () => ({}) }),
    })).toEqual({ status: 'denied' })
  })

  it('fails closed for missing auth and malformed or secret-bearing responses', async () => {
    const fetchImpl = vi.fn()
    expect(await readAdminStudyOperations({
      getAccessToken: async () => null,
      fetchImpl,
    })).toEqual({ status: 'denied' })
    expect(fetchImpl).not.toHaveBeenCalled()

    expect(await readAdminStudyOperations({
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl: async () => ({
        status: 200,
        json: async () => ({ ...projection(), rawProviderError: 'SECRET' }),
      }),
    })).toEqual({ status: 'error', code: 'study_operations_unavailable' })
  })

  it('distinguishes timeout from other source failures', async () => {
    const timeout = await readAdminStudyOperations({
      getAccessToken: async () => 'synthetic.access.token',
      timeoutMs: 1,
      fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }),
    })
    expect(timeout).toEqual({ status: 'error', code: 'study_operations_timeout' })

    expect(await readAdminStudyOperations({
      getAccessToken: async () => 'synthetic.access.token',
      fetchImpl: async () => { throw new Error('private network detail') },
    })).toEqual({ status: 'error', code: 'study_operations_unavailable' })
  })
})
