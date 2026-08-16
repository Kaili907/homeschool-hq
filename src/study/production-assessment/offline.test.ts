import { describe, expect, it, vi } from 'vitest'
import type { ProductionItemAssessmentRequest } from './contracts'
import { assessOrQueuePending, ProductionAssessmentOfflineError } from './offline'

const request: ProductionItemAssessmentRequest = {
  schemaVersion: 1,
  releaseId: 'family-pilot-r1',
  assignmentRef: 'assignment-1',
  lessonRef: 'ma-g5-mathematics-u01-l01',
  sectionRef: 'ip',
  itemRef: 'ma-g5-mathematics-u01-l01#ip-01',
  attemptRef: 'attempt-offline-1',
  response: { kind: 'choice', choiceRef: 'choice-3' },
}

describe('offline production assessment', () => {
  it('stores PENDING_ASSESSMENT and never fabricates correctness', async () => {
    const savePending = vi.fn().mockResolvedValue(undefined)
    const outcome = await assessOrQueuePending(
      { assess: vi.fn().mockRejectedValue(new ProductionAssessmentOfflineError()) },
      { savePending },
      request,
      () => '2026-08-13T12:00:00.000Z',
    )
    expect(outcome).toMatchObject({
      status: 'pending-assessment',
      resultKind: null,
      evidenceKind: null,
      rawResponseIncluded: false,
    })
    expect(outcome).not.toHaveProperty('correct')
    expect(savePending).toHaveBeenCalledWith(expect.objectContaining({
      state: 'PENDING_ASSESSMENT',
      queuedAt: '2026-08-13T12:00:00.000Z',
      request,
    }))
  })
})
