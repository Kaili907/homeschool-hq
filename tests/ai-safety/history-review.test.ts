import { describe, expect, it } from 'vitest'
import {
  claimHumanReview,
  decideFalsePositiveReview,
  getTutorTimeline,
  humanReviewQueueForStudent,
  queryTutorHistory,
  requestFalsePositiveReview,
  resolveHumanReview,
  upsertReviewItem,
} from '../../ai-safety/core/index.ts'
import {
  STUDENT_A_ID,
  STUDENT_B_ID,
  humanReviewFixture,
  parentAPrincipalFixture,
  reviewerPrincipalFixture,
  safetyCenterStoreFixture,
  studentAPrincipalFixture,
} from '../../ai-safety/core/fixtures.ts'

describe('searchable parent-visible tutor history', () => {
  it('filters by subject, date, and search text', () => {
    const result = queryTutorHistory(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      {
        studentId: STUDENT_A_ID,
        search: 'equivalent',
        subjectIds: ['math'],
        from: '2026-07-27',
        through: '2026-07-27',
      },
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.subject.subjectId).toBe('math')
    }

    expect(
      queryTutorHistory(parentAPrincipalFixture, safetyCenterStoreFixture, {
        studentId: STUDENT_A_ID,
        search: 'mitochondrion',
      }),
    ).toMatchObject({ status: 'empty', records: [] })
  })

  it('provides a safe missing-history fallback without inventing details', () => {
    const missingStore = queryTutorHistory(
      parentAPrincipalFixture,
      undefined,
      { studentId: STUDENT_A_ID },
    )
    expect(missingStore).toEqual({
      status: 'unavailable',
      records: [],
      message:
        'Tutor history is unavailable right now. No missing conversation details will be guessed.',
    })

    const unavailable = queryTutorHistory(
      parentAPrincipalFixture,
      { ...safetyCenterStoreFixture, historyAvailability: 'unavailable' },
      { studentId: STUDENT_A_ID },
    )
    expect(unavailable).toMatchObject({ status: 'unavailable', records: [] })
    expect(JSON.stringify(unavailable)).not.toMatch(/fraction|student-b/i)
  })

  it('returns an ordered text/playback timeline and never raw audio', () => {
    const result = getTutorTimeline(
      studentAPrincipalFixture,
      safetyCenterStoreFixture,
      STUDENT_A_ID,
      'history-a-math-1',
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.timeline.map((entry) => entry.sequence)).toEqual([1, 2, 3])
      expect(JSON.stringify(result.timeline)).toContain(
        '"rawAudioStored":false',
      )
      expect(JSON.stringify(result.timeline)).not.toContain('audioUrl')
    }
  })
})

describe('human review and false-positive workflow', () => {
  it('supports queue claim, false-positive request, and reviewer acceptance', () => {
    const claimed = claimHumanReview(reviewerPrincipalFixture, humanReviewFixture, {
      actionId: 'claim-action-1',
      at: '2026-07-28T15:10:00.000Z',
    })
    expect(claimed.ok).toBe(true)
    if (!claimed.ok) return

    const requested = requestFalsePositiveReview(
      studentAPrincipalFixture,
      claimed.value,
      {
        falsePositiveId: 'false-positive-a-1',
        actionId: 'false-positive-request-action-1',
        at: '2026-07-28T15:11:00.000Z',
        reason: 'schoolwork-quotation',
        comment: 'This was a line from the assigned story.',
      },
    )
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    expect(requested.value.falsePositiveReview?.status).toBe('pending')

    const decided = decideFalsePositiveReview(
      reviewerPrincipalFixture,
      requested.value,
      {
        actionId: 'false-positive-decision-action-1',
        at: '2026-07-28T15:12:00.000Z',
        decision: 'accepted',
        reasonCode: 'verified-schoolwork-context',
      },
    )
    expect(decided.ok).toBe(true)
    if (decided.ok) {
      expect(decided.value).toMatchObject({
        status: 'resolved',
        resolution: 'false-positive',
        falsePositiveReview: { status: 'accepted' },
      })
    }
  })

  it('reopens a resolved item without creating an undefined JSON property', () => {
    const resolved = {
      ...humanReviewFixture,
      status: 'resolved' as const,
      resolution: 'safety-concern-confirmed' as const,
      resolvedAt: '2026-07-28T15:00:00.000Z',
    }
    const reopened = requestFalsePositiveReview(
      studentAPrincipalFixture,
      resolved,
      {
        falsePositiveId: 'false-positive-reopen',
        actionId: 'false-positive-reopen-action',
        at: '2026-07-28T15:20:00.000Z',
        reason: 'context-misunderstood',
      },
    )
    expect(reopened.ok).toBe(true)
    if (reopened.ok) {
      expect(reopened.value.status).toBe('queued')
      expect(Object.hasOwn(reopened.value, 'resolvedAt')).toBe(false)
      expect(() => JSON.stringify(reopened.value)).not.toThrow()
    }
  })

  it('denies a reviewer who lacks explicit authorization for the student', () => {
    const wrongReviewer = {
      ...reviewerPrincipalFixture,
      authorizedStudentIds: [STUDENT_B_ID],
    }
    expect(
      resolveHumanReview(wrongReviewer, humanReviewFixture, {
        actionId: 'forged-resolution',
        at: '2026-07-28T15:30:00.000Z',
        resolution: 'insufficient-context',
        reasonCode: 'forged',
      }),
    ).toMatchObject({ ok: false, reason: 'student-not-authorized' })
  })

  it('rejects free-form reviewer text in structured reason-code fields', () => {
    expect(
      resolveHumanReview(reviewerPrincipalFixture, humanReviewFixture, {
        actionId: 'unsafe-reason-action',
        at: '2026-07-28T15:30:00.000Z',
        resolution: 'insufficient-context',
        reasonCode: 'Student said a private sentence here',
      }),
    ).toMatchObject({ ok: false, reason: 'invalid-reason-code' })
  })

  it('returns only the requested student in a parent/reviewer queue', () => {
    const result = humanReviewQueueForStudent(
      parentAPrincipalFixture,
      {
        ...safetyCenterStoreFixture,
        reviewItems: [
          humanReviewFixture,
          {
            ...humanReviewFixture,
            reviewId: 'review-b',
            eventId: 'event-b',
            sessionId: 'session-b',
            studentId: STUDENT_B_ID,
          },
        ],
      },
      STUDENT_A_ID,
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.items.every((item) => item.studentId === STUDENT_A_ID)).toBe(
        true,
      )
    }
  })

  it('upserts by composite student and review ID without deleting a sibling collision', () => {
    const sibling = {
      ...humanReviewFixture,
      studentId: STUDENT_B_ID,
      eventId: 'event-b',
      sessionId: 'session-b',
    }
    const updated = {
      ...humanReviewFixture,
      status: 'in-review' as const,
      assignedReviewerId: 'reviewer-actor-1',
    }
    const store = upsertReviewItem(
      { ...safetyCenterStoreFixture, reviewItems: [humanReviewFixture, sibling] },
      updated,
    )
    expect(store.reviewItems).toHaveLength(2)
    expect(store.reviewItems.some((item) => item.studentId === STUDENT_B_ID)).toBe(
      true,
    )
    expect(
      store.reviewItems.find((item) => item.studentId === STUDENT_A_ID)?.status,
    ).toBe('in-review')
  })
})
