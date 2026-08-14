import { describe, expect, it } from 'vitest'
import type { LearnerResponseRecord } from '../final-app/learner-response'
import { projectTrustedScoreReviewItem } from './reviewCenter'

function record(decision?: 'CORRECT' | 'INCORRECT' | 'REVIEW_REQUIRED'): LearnerResponseRecord {
  return Object.freeze({
    schemaVersion: 1,
    lessonRef: 'lesson:1',
    studentRef: 'student:1',
    assignmentRef: 'assignment:1',
    attemptRef: 'attempt:1',
    sectionRef: 'section:1',
    itemRef: 'item:1',
    segmentRef: 'segment:1',
    responseType: 'TEXT',
    evidenceMode: 'MASTERY',
    response: Object.freeze({ kind: 'TEXT', text: 'private learner response' }),
    status: decision ? 'ASSESSED' : 'PENDING_ASSESSMENT',
    savedAt: '2026-08-14T12:00:00.000Z',
    assessment: decision ? Object.freeze({
      assessmentRef: 'pai:receipt-1',
      assessorRef: 'trusted:production-item:r1',
      assessedAt: '2026-08-14T12:01:00.000Z',
      decision,
    }) : null,
  })
}

describe('trusted score Review Center contract', () => {
  it.each([
    [undefined, 'PENDING_TRUSTED_SCORE'],
    ['CORRECT' as const, 'TRUSTED_RESULT_AVAILABLE'],
    ['REVIEW_REQUIRED' as const, 'PARENT_ACTION_REQUIRED'],
  ])('projects %s as %s', (decision, state) => {
    const projected = projectTrustedScoreReviewItem(record(decision))
    expect(projected.state).toBe(state)
    expect(projected).not.toHaveProperty('response')
    expect(JSON.stringify(projected)).not.toMatch(/private learner response|answer|rubric|bearer|secret/i)
  })
})
