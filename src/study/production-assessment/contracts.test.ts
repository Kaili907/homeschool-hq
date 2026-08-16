import { describe, expect, it } from 'vitest'
import {
  parseProductionItemAssessmentRequest,
  parseProductionItemResult,
} from './contracts'

const request = {
  schemaVersion: 1,
  releaseId: 'family-pilot-r1',
  assignmentRef: 'assignment-1',
  lessonRef: 'ma-g5-mathematics-u01-l01',
  sectionRef: 'ip',
  itemRef: 'ma-g5-mathematics-u01-l01#ip-01',
  attemptRef: 'attempt-1',
  response: { kind: 'choice', choiceRef: 'choice-3' },
}

describe('production item assessment contracts', () => {
  it('admits IDs plus a learner response and rejects browser answer authority', () => {
    expect(parseProductionItemAssessmentRequest(request)).toEqual(request)
    expect(parseProductionItemAssessmentRequest({ ...request, answerIndex: 2 })).toBeNull()
    expect(parseProductionItemAssessmentRequest({ ...request, expectedAnswer: 'choice-3' })).toBeNull()
    expect(parseProductionItemAssessmentRequest({
      ...request,
      response: { ...request.response, score: 1 },
    })).toBeNull()
  })

  it('accepts only a minimized browser result', () => {
    const result = {
      schemaVersion: 1,
      status: 'assessed',
      receiptRef: `pai:${'a'.repeat(64)}`,
      assignmentRef: request.assignmentRef,
      lessonRef: request.lessonRef,
      sectionRef: request.sectionRef,
      itemRef: request.itemRef,
      attemptRef: request.attemptRef,
      resultKind: 'correct',
      evidenceKind: 'auto-score',
      rawResponseIncluded: false,
    }
    expect(parseProductionItemResult(result)).toEqual(result)
    expect(parseProductionItemResult({ ...result, correctAnswer: 'choice-3' })).toBeNull()
    expect(parseProductionItemResult({ ...result, rawResponseIncluded: true })).toBeNull()
  })
})
