import { describe, expect, it, vi } from 'vitest'
import type { ProductionItemAssessmentRequest } from './contracts'
import {
  createProductionItemFetchTransport,
  ProductionAssessmentServerError,
  ProductionAssessmentTimeoutError,
} from './client'
import { ProductionAssessmentOfflineError } from './offline'

const request: ProductionItemAssessmentRequest = {
  schemaVersion: 1,
  releaseId: 'family-pilot-r1',
  assignmentRef: 'assignment-1',
  lessonRef: 'ma-g5-mathematics-u01-l01',
  sectionRef: 'ip',
  itemRef: 'ma-g5-mathematics-u01-l01#ip-01',
  attemptRef: 'attempt-1',
  response: { kind: 'choice', choiceRef: 'choice-3' },
}

describe('production item browser transport', () => {
  it('sends only the opaque bearer, IDs, and learner response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'assessed' }),
    })
    const transport = createProductionItemFetchTransport(
      fetchImpl as unknown as typeof fetch,
      () => 'opaque-study-session',
    )
    await transport.assess(request)
    const [, init] = fetchImpl.mock.calls[0]
    const sent = JSON.parse(init.body)
    expect(sent).toEqual({ schemaVersion: 1, operation: 'assess', request })
    expect(JSON.stringify(sent)).not.toContain('expectedAnswer')
    expect(JSON.stringify(sent)).not.toContain('answerIndex')
    expect(init.headers.authorization).toBe('Bearer opaque-study-session')
  })

  it('distinguishes offline transport failure from server rejection', async () => {
    const offline = createProductionItemFetchTransport(
      vi.fn().mockRejectedValue(new TypeError('network')) as unknown as typeof fetch,
      () => 'opaque-study-session',
    )
    await expect(offline.assess(request)).rejects.toBeInstanceOf(ProductionAssessmentOfflineError)

    const rejected = createProductionItemFetchTransport(
      vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch,
      () => 'opaque-study-session',
    )
    await expect(rejected.assess(request)).rejects.toEqual(expect.objectContaining({
      constructor: ProductionAssessmentServerError,
      status: 401,
    }))
  })

  it('fails closed on timeout and aborts the interrupted request', async () => {
    let signal: AbortSignal | undefined
    const transport = createProductionItemFetchTransport(
      vi.fn(async (_input, init) => {
        signal = init?.signal ?? undefined
        return await new Promise<Response>(() => undefined)
      }),
      () => 'opaque-study-session',
      '/api/study/production-item-assessment',
      { timeoutMs: 5 },
    )
    await expect(transport.assess(request)).rejects.toBeInstanceOf(ProductionAssessmentTimeoutError)
    expect(signal?.aborted).toBe(true)
  })
})
