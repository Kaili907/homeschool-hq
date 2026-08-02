import { describe, expect, it } from 'vitest'
import {
  AI_SAFETY_SCHEMA_VERSION,
  applyRetentionPolicy,
  approveDeletionRequest,
  buildSafetyCenterDataExport,
  executeApprovedDeletion,
  type DataDeletionRequest,
  type DataExportRequest,
  type HumanReviewItem,
  type InstructionalHistoryRecord,
  type ParentNotification,
  type SafetyEvent,
} from '../../ai-safety/core/index.ts'
import {
  STUDENT_A_ID,
  STUDENT_B_ID,
  answerWithheldEventFixture,
  deletionRequestFixture,
  humanReviewFixture,
  parentAPrincipalFixture,
  retentionPolicyFixture,
  safetyCenterStoreFixture,
  studentAHistoryFixture,
  studentAPrincipalFixture,
  studentBHistoryFixture,
  studentBlockFixture,
} from '../../ai-safety/core/fixtures.ts'

const oldHistoryA: InstructionalHistoryRecord = {
  ...studentAHistoryFixture,
  historyId: 'old-history-a',
  sessionId: 'old-session-a',
  createdAt: '2025-01-01T10:00:00.000Z',
  startedAt: '2025-01-01T10:00:00.000Z',
  endedAt: '2025-01-01T10:10:00.000Z',
}

const oldHistoryB: InstructionalHistoryRecord = {
  ...studentBHistoryFixture,
  historyId: 'old-history-b',
  sessionId: 'old-session-b',
  createdAt: '2025-01-01T10:00:00.000Z',
  startedAt: '2025-01-01T10:00:00.000Z',
  endedAt: '2025-01-01T10:10:00.000Z',
}

const oldClosedEventA: SafetyEvent = {
  ...answerWithheldEventFixture,
  eventId: 'old-closed-event-a',
  sessionId: 'old-session-a',
  createdAt: '2025-01-01T10:01:00.000Z',
  occurredAt: '2025-01-01T10:01:00.000Z',
}

const oldOpenEventA: SafetyEvent = {
  ...answerWithheldEventFixture,
  eventId: 'old-open-event-a',
  sessionId: 'old-session-a',
  createdAt: '2025-01-01T10:02:00.000Z',
  occurredAt: '2025-01-01T10:02:00.000Z',
  severity: 'high',
  escalation: 'human-safety-review',
}

const oldEventB: SafetyEvent = {
  ...answerWithheldEventFixture,
  eventId: 'old-event-b',
  sessionId: 'old-session-b',
  studentId: STUDENT_B_ID,
  createdAt: '2025-01-01T10:01:00.000Z',
  occurredAt: '2025-01-01T10:01:00.000Z',
}

const openReviewA: HumanReviewItem = {
  ...humanReviewFixture,
  reviewId: 'open-review-old-a',
  eventId: oldOpenEventA.eventId,
  sessionId: oldOpenEventA.sessionId,
  createdAt: '2025-01-01T10:03:00.000Z',
  queuedAt: '2025-01-01T10:03:00.000Z',
}

const resolvedReviewA: HumanReviewItem = {
  ...humanReviewFixture,
  reviewId: 'resolved-review-old-a',
  eventId: oldClosedEventA.eventId,
  sessionId: oldClosedEventA.sessionId,
  createdAt: '2025-01-01T10:03:00.000Z',
  queuedAt: '2025-01-01T10:03:00.000Z',
  status: 'resolved',
  resolvedAt: '2025-01-02T10:03:00.000Z',
  resolution: 'insufficient-context',
}

const notificationFor = (
  event: SafetyEvent,
  notificationId: string,
): ParentNotification => ({
  kind: 'parent-notification',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: event.occurredAt,
  notificationId,
  eventId: event.eventId,
  studentId: event.studentId,
  recipientActorId: 'parent-actor-a',
  channel: 'in-app',
  urgency: 'when-convenient',
  title: 'Tutor safety event',
  summary: event.summary,
  includedData: ['safe-event-summary'],
  includesRawTranscript: false,
  status: 'pending',
})

describe('retention controls', () => {
  it('prunes one student by class while preserving open reviews and all sibling data', () => {
    const store = {
      ...safetyCenterStoreFixture,
      instructionalHistory: [
        ...safetyCenterStoreFixture.instructionalHistory,
        oldHistoryA,
        oldHistoryB,
      ],
      safetyEvents: [
        ...safetyCenterStoreFixture.safetyEvents,
        oldClosedEventA,
        oldOpenEventA,
        oldEventB,
      ],
      notifications: [
        ...safetyCenterStoreFixture.notifications,
        notificationFor(oldClosedEventA, 'old-notification-closed-a'),
        notificationFor(oldOpenEventA, 'old-notification-open-a'),
      ],
      reviewItems: [
        ...safetyCenterStoreFixture.reviewItems,
        openReviewA,
        resolvedReviewA,
      ],
    }
    const result = applyRetentionPolicy(
      store,
      retentionPolicyFixture,
      '2026-07-28T15:00:00.000Z',
    )
    expect(
      result.store.instructionalHistory.some(
        (record) => record.historyId === oldHistoryA.historyId,
      ),
    ).toBe(false)
    expect(
      result.store.instructionalHistory.some(
        (record) => record.historyId === oldHistoryB.historyId,
      ),
    ).toBe(true)
    expect(
      result.store.safetyEvents.some(
        (event) => event.eventId === oldClosedEventA.eventId,
      ),
    ).toBe(false)
    expect(
      result.store.safetyEvents.some(
        (event) => event.eventId === oldOpenEventA.eventId,
      ),
    ).toBe(true)
    expect(
      result.store.safetyEvents.some(
        (event) => event.eventId === oldEventB.eventId,
      ),
    ).toBe(true)
    expect(result.report.preservedOpenReviewEventIds).toContain(
      oldOpenEventA.eventId,
    )
    expect(
      result.store.reviewItems.some(
        (item) => item.reviewId === resolvedReviewA.reviewId,
      ),
    ).toBe(false)
  })

  it('does not let a sibling same-ID event retain a target notification/review', () => {
    const targetEvent = {
      ...oldClosedEventA,
      eventId: 'collision-event',
    }
    const siblingEvent = {
      ...oldEventB,
      eventId: 'collision-event',
    }
    const targetReview = {
      ...resolvedReviewA,
      reviewId: 'collision-review-a',
      eventId: 'collision-event',
    }
    const result = applyRetentionPolicy(
      {
        ...safetyCenterStoreFixture,
        safetyEvents: [targetEvent, siblingEvent],
        notifications: [
          notificationFor(targetEvent, 'collision-notification-a'),
        ],
        reviewItems: [targetReview],
      },
      retentionPolicyFixture,
      '2026-07-28T15:00:00.000Z',
    )
    expect(
      result.store.safetyEvents.some(
        (event) => event.studentId === STUDENT_B_ID,
      ),
    ).toBe(true)
    expect(result.store.notifications).toHaveLength(0)
    expect(result.store.reviewItems).toHaveLength(0)
  })
})

describe('approved deletion execution', () => {
  it('requires authorized parent approval', () => {
    expect(
      approveDeletionRequest(
        studentAPrincipalFixture,
        deletionRequestFixture,
        '2026-07-28T15:01:00.000Z',
      ),
    ).toMatchObject({ ok: false, reason: 'role-not-allowed' })
    const approved = approveDeletionRequest(
      parentAPrincipalFixture,
      deletionRequestFixture,
      '2026-07-28T15:01:00.000Z',
    )
    expect(approved.ok).toBe(true)
    if (approved.ok) {
      expect(approved.value).toMatchObject({
        status: 'approved',
        approvedBy: { role: 'parent', actorId: 'parent-actor-a' },
      })
    }
  })

  it('deletes eligible target data, preserves disclosed holds, and never changes sibling data', () => {
    const approved = approveDeletionRequest(
      parentAPrincipalFixture,
      deletionRequestFixture,
      '2026-07-28T15:01:00.000Z',
    )
    if (!approved.ok) throw new Error('fixture approval failed')
    const siblingCollisionRequest: DataDeletionRequest = {
      ...approved.value,
      studentId: STUDENT_B_ID,
      requestedBy: { role: 'parent', actorId: 'parent-actor-b' },
    }
    const closedTargetReview: HumanReviewItem = {
      ...resolvedReviewA,
      eventId: answerWithheldEventFixture.eventId,
    }
    const result = executeApprovedDeletion(
      parentAPrincipalFixture,
      {
        ...safetyCenterStoreFixture,
        reviewItems: [humanReviewFixture, closedTargetReview],
        deletionRequests: [approved.value, siblingCollisionRequest],
      },
      approved.value,
      {
        at: '2026-07-28T15:02:00.000Z',
        auditId: 'deletion-audit-1',
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      result.value.store.instructionalHistory.some(
        (record) => record.studentId === STUDENT_A_ID,
      ),
    ).toBe(false)
    expect(
      result.value.store.instructionalHistory.some(
        (record) => record.studentId === STUDENT_B_ID,
      ),
    ).toBe(true)
    // The critical event has an open review and the active block remains operational.
    expect(result.value.report.request.status).toBe('partially-completed')
    expect(result.value.report.retained.openReviewEventIds).toContain(
      'event-a-emergency-1',
    )
    expect(result.value.report.retained.activeBlockIds).toContain(
      studentBlockFixture.blockId,
    )
    expect(
      result.value.store.reviewItems.some(
        (item) => item.reviewId === resolvedReviewA.reviewId,
      ),
    ).toBe(false)
    expect(
      result.value.store.deletionRequests.some(
        (request) =>
          request.studentId === STUDENT_B_ID &&
          request.requestId === siblingCollisionRequest.requestId,
      ),
    ).toBe(true)
  })

  it('does not mark instructional-only deletion partial for unrelated safety holds', () => {
    const request: DataDeletionRequest = {
      ...deletionRequestFixture,
      requestId: 'instructional-delete-a',
      scope: 'instructional-history',
      status: 'approved',
      approvedBy: { role: 'parent', actorId: parentAPrincipalFixture.actorId },
      approvedAt: '2026-07-28T15:01:00.000Z',
    }
    const result = executeApprovedDeletion(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      request,
      {
        at: '2026-07-28T15:02:00.000Z',
        auditId: 'instructional-deletion-audit',
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.report.request.status).toBe('completed')
  })

  it('does not use a sibling event collision to retain target notification/review', () => {
    const request: DataDeletionRequest = {
      ...deletionRequestFixture,
      requestId: 'collision-delete-a',
      scope: 'safety-events',
      status: 'approved',
      approvedBy: { role: 'parent', actorId: parentAPrincipalFixture.actorId },
      approvedAt: '2026-07-28T15:01:00.000Z',
    }
    const targetEvent = {
      ...answerWithheldEventFixture,
      eventId: 'delete-collision-event',
    }
    const siblingEvent = {
      ...answerWithheldEventFixture,
      eventId: 'delete-collision-event',
      studentId: STUDENT_B_ID,
    }
    const targetReview = {
      ...resolvedReviewA,
      eventId: 'delete-collision-event',
    }
    const result = executeApprovedDeletion(
      parentAPrincipalFixture,
      {
        ...safetyCenterStoreFixture,
        safetyEvents: [targetEvent, siblingEvent],
        notifications: [
          notificationFor(targetEvent, 'delete-collision-notification'),
        ],
        reviewItems: [targetReview],
        blocks: [],
      },
      request,
      {
        at: '2026-07-28T15:02:00.000Z',
        auditId: 'collision-deletion-audit',
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.store.safetyEvents).toEqual([siblingEvent])
    expect(result.value.store.notifications).toHaveLength(0)
    expect(result.value.store.reviewItems).toHaveLength(0)
  })
})

describe('privacy-preserving exports', () => {
  it('omits audit actor IDs and non-student block-lifter identities from a student export', () => {
    const studentRequest: DataExportRequest = {
      kind: 'data-export-request',
      schemaVersion: AI_SAFETY_SCHEMA_VERSION,
      createdAt: '2026-07-28T15:00:00.000Z',
      requestId: 'student-export-a',
      studentId: STUDENT_A_ID,
      requestedBy: {
        role: 'student',
        actorId: studentAPrincipalFixture.actorId,
      },
      requestedAt: '2026-07-28T15:00:00.000Z',
      scope: 'all-safety-center-data',
      format: 'json',
      status: 'requested',
    }
    const liftedBlock = {
      ...studentBlockFixture,
      active: false,
      liftedAt: '2026-07-28T15:00:00.000Z',
      liftedBy: { role: 'reviewer' as const, actorId: 'private-reviewer-id' },
    }
    const result = buildSafetyCenterDataExport(
      studentAPrincipalFixture,
      { ...safetyCenterStoreFixture, blocks: [liftedBlock] },
      studentRequest,
      '2026-07-28T15:05:00.000Z',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.auditEvents).toEqual([])
    expect(JSON.stringify(result.value)).not.toContain('private-reviewer-id')
    expect(result.value.blocks[0]).not.toHaveProperty('liftedBy')
  })
})
