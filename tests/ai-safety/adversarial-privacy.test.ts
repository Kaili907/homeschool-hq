import { describe, expect, it } from 'vitest'
import {
  WITHHELD_REASON_VALUES,
  applyRetentionPolicy,
  approveDeletionRequest,
  authorizeStudentAccess,
  buildSafetyCenterDataExport,
  containsProhibitedEmergencyClaim,
  decideFalsePositiveReview,
  emptySafetyCenterStore,
  evaluateSafetyPolicy,
  executeApprovedDeletion,
  materializePolicyEvent,
  querySafetyEvents,
  queryTutorHistory,
  queueHumanReview,
  refusalExplanation,
  requestFalsePositiveReview,
  submitStudentReport,
  upsertReviewItem,
  validateRetentionPolicy,
  type DataDeletionRequest,
  type DataExportRequest,
  type HumanReviewItem,
  type ParentNotification,
  type SafetyCenterStore,
  type SafetyPrincipal,
  type SafetyEvent,
  type StudentTutorBlock,
} from '../../ai-safety/core/index.ts'
import {
  FIXTURE_NOW,
  STUDENT_A_ID,
  STUDENT_B_ID,
  answerWithheldEventFixture,
  deletionRequestFixture,
  emergencyEventFixture,
  exportRequestFixture,
  humanReviewFixture,
  parentAPrincipalFixture,
  parentNotificationFixture,
  retentionPolicyFixture,
  reviewerPrincipalFixture,
  safetyCenterStoreFixture,
  studentAHistoryFixture,
  studentAPrincipalFixture,
  studentASessionFixture,
  studentBHistoryFixture,
  studentBPrincipalFixture,
  studentBSessionFixture,
  studentBlockFixture,
} from '../../ai-safety/core/fixtures.ts'

const AT = '2026-07-28T16:00:00.000Z'

function assertNoOtherStudent(records: readonly { readonly studentId: string }[]): void {
  expect(records.every((record) => record.studentId === STUDENT_A_ID)).toBe(true)
  expect(JSON.stringify(records)).not.toContain(STUDENT_B_ID)
}

function resolvedReview(input: {
  readonly studentId: string
  readonly reviewId: string
  readonly eventId: string
  readonly sessionId: string
}): HumanReviewItem {
  return {
    ...humanReviewFixture,
    studentId: input.studentId,
    reviewId: input.reviewId,
    eventId: input.eventId,
    sessionId: input.sessionId,
    status: 'resolved',
    resolution: 'false-positive',
    resolvedAt: '2026-01-02T00:00:00.000Z',
  }
}

describe('adversarial authorization and student scoping', () => {
  it('does not let forged role, actor, permission, or authorization fields bypass authentication', () => {
    const forged: SafetyPrincipal = {
      authenticated: false,
      actorId: parentAPrincipalFixture.actorId,
      role: 'parent',
      authorizedStudentIds: [STUDENT_A_ID, STUDENT_B_ID],
      permissions: [
        'history:read',
        'safety-events:read',
        'permissions:manage',
        'reviews:read',
        'reviews:resolve',
        'data:export',
        'data:delete',
      ],
    }

    expect(
      authorizeStudentAccess(forged, STUDENT_A_ID, ['parent'], 'history:read'),
    ).toEqual({ allowed: false, reason: 'unauthenticated' })
    expect(
      queryTutorHistory(forged, safetyCenterStoreFixture, {
        studentId: STUDENT_A_ID,
      }),
    ).toMatchObject({
      status: 'not-authorized',
      reason: 'unauthenticated',
      records: [],
    })
  })

  it('ignores a forged authorized-student list on a student principal', () => {
    const forgedStudent: SafetyPrincipal = {
      ...studentAPrincipalFixture,
      authorizedStudentIds: [STUDENT_A_ID, STUDENT_B_ID],
    }

    expect(
      queryTutorHistory(forgedStudent, safetyCenterStoreFixture, {
        studentId: STUDENT_B_ID,
      }),
    ).toMatchObject({
      status: 'not-authorized',
      reason: 'student-not-authorized',
      records: [],
    })
  })

  it('searches only after student scoping and cannot find a sibling transcript', () => {
    const own = queryTutorHistory(
      {
        ...parentAPrincipalFixture,
        authorizedStudentIds: [STUDENT_A_ID, STUDENT_B_ID],
      },
      safetyCenterStoreFixture,
      {
        studentId: STUDENT_A_ID,
        search: 'mitochondrion',
      },
    )
    expect(own).toMatchObject({ status: 'empty', records: [] })

    const ownMatch = queryTutorHistory(
      {
        ...parentAPrincipalFixture,
        authorizedStudentIds: [STUDENT_A_ID, STUDENT_B_ID],
      },
      safetyCenterStoreFixture,
      {
        studentId: STUDENT_A_ID,
        search: 'equivalent fractions',
      },
    )
    expect(ownMatch.status).toBe('ok')
    if (ownMatch.status === 'ok') assertNoOtherStudent(ownMatch.records)
  })

  it('keeps safety-event queries scoped even when event IDs collide', () => {
    const sharedId = 'shared-event-id'
    const store: SafetyCenterStore = {
      ...safetyCenterStoreFixture,
      safetyEvents: [
        { ...answerWithheldEventFixture, eventId: sharedId },
        {
          ...answerWithheldEventFixture,
          eventId: sharedId,
          studentId: STUDENT_B_ID,
          sessionId: studentBSessionFixture.sessionId,
          subjectId: 'science',
          summary: 'Sibling-only safety summary.',
        },
      ],
    }
    const result = querySafetyEvents(
      {
        ...parentAPrincipalFixture,
        authorizedStudentIds: [STUDENT_A_ID, STUDENT_B_ID],
      },
      store,
      { studentId: STUDENT_A_ID },
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      assertNoOtherStudent(result.events)
      expect(JSON.stringify(result.events)).not.toContain('Sibling-only')
    }
  })

  it('returns the same safe denial shape whether another student has matching data or not', () => {
    const withSiblingData = queryTutorHistory(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      { studentId: STUDENT_B_ID, search: 'mitochondrion' },
    )
    const withoutSiblingData = queryTutorHistory(
      parentAPrincipalFixture,
      emptySafetyCenterStore(),
      { studentId: STUDENT_B_ID, search: 'mitochondrion' },
    )
    expect(withSiblingData).toEqual(withoutSiblingData)
    expect(withSiblingData).toMatchObject({
      status: 'not-authorized',
      records: [],
      message: 'Tutor history is not available for this account.',
    })
  })
})

describe('forged actor fields and export minimization', () => {
  it('rejects an export request whose embedded actor does not match the authenticated principal', () => {
    const forgedRequest: DataExportRequest = {
      ...exportRequestFixture,
      requestedBy: { role: 'parent', actorId: 'forged-parent' },
    }
    expect(
      buildSafetyCenterDataExport(
        parentAPrincipalFixture,
        safetyCenterStoreFixture,
        forgedRequest,
        AT,
      ),
    ).toEqual({ ok: false, reason: 'request-student-mismatch' })
  })

  it('derives report ownership from the authorized student instead of a forged input field', () => {
    const forgedInput = {
      reportId: 'report-forgery-check',
      eventId: 'event-forgery-check',
      sessionId: studentASessionFixture.sessionId,
      studentId: STUDENT_A_ID,
      subjectId: 'math',
      at: AT,
      category: 'privacy-concern' as const,
      createdByStudentId: STUDENT_B_ID,
    }
    const result = submitStudentReport(studentAPrincipalFixture, forgedInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.report.createdByStudentId).toBe(STUDENT_A_ID)
    expect(result.value.report.studentId).toBe(STUDENT_A_ID)
    expect(result.value.event.studentId).toBe(STUDENT_A_ID)
  })

  it('overwrites forged deletion approval metadata with the authenticated parent', () => {
    const request: DataDeletionRequest = {
      ...deletionRequestFixture,
      approvedBy: { role: 'parent', actorId: 'forged-parent' },
      approvedAt: '2026-07-28T15:59:00.000Z',
    }
    const result = approveDeletionRequest(parentAPrincipalFixture, request, AT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.approvedBy?.actorId).toBe(
      parentAPrincipalFixture.actorId,
    )
  })

  it('keeps instructional and safety export scopes separate', () => {
    const instructional = buildSafetyCenterDataExport(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      { ...exportRequestFixture, scope: 'instructional-history' },
      AT,
    )
    expect(instructional.ok).toBe(true)
    if (instructional.ok) {
      expect(instructional.value.instructionalHistory.length).toBeGreaterThan(0)
      expect(instructional.value.safetyEvents).toEqual([])
      expect(instructional.value.reports).toEqual([])
      expect(instructional.value.blocks).toEqual([])
      assertNoOtherStudent(instructional.value.instructionalHistory)
    }

    const safety = buildSafetyCenterDataExport(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      { ...exportRequestFixture, scope: 'safety-events' },
      AT,
    )
    expect(safety.ok).toBe(true)
    if (safety.ok) {
      expect(safety.value.instructionalHistory).toEqual([])
      expect(safety.value.safetyEvents.length).toBeGreaterThan(0)
      expect(safety.value.auditEvents).toEqual([])
      assertNoOtherStudent(safety.value.safetyEvents)
    }
  })

  it('does not export parent/reviewer actor IDs to a student', () => {
    const liftedByReviewer: StudentTutorBlock = {
      ...studentBlockFixture,
      active: false,
      liftedAt: AT,
      liftedBy: { role: 'reviewer', actorId: reviewerPrincipalFixture.actorId },
    }
    const studentRequest: DataExportRequest = {
      ...exportRequestFixture,
      requestId: 'student-export-a',
      requestedBy: {
        role: 'student',
        actorId: studentAPrincipalFixture.actorId,
      },
    }
    const result = buildSafetyCenterDataExport(
      studentAPrincipalFixture,
      {
        ...safetyCenterStoreFixture,
        blocks: [liftedByReviewer],
      },
      studentRequest,
      AT,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.auditEvents).toEqual([])
    expect(result.value.blocks).toHaveLength(1)
    expect(result.value.blocks[0]?.liftedBy).toBeUndefined()
    const serialized = JSON.stringify(result.value)
    expect(serialized).not.toContain(reviewerPrincipalFixture.actorId)
    expect(serialized).not.toContain(parentAPrincipalFixture.actorId)
  })
})

describe('emergency-language policy, false positives, and refusal copy', () => {
  it.each([
    ['I want to kill myself.', 'potential-self-harm'],
    ['Someone is trying to hurt me.', 'potential-immediate-danger'],
    ['An adult hits me.', 'potential-abuse-or-unsafe-situation'],
  ] as const)('pauses and escalates clear language: %s', (text, classification) => {
    const decision = evaluateSafetyPolicy({
      text,
      ageBand: '8-12',
      direction: 'student-to-tutor',
    })
    expect(decision).toMatchObject({
      action: 'pause-and-escalate',
      classification,
      severity: 'critical',
      escalation: 'human-safety-review',
      canContinueLearning: false,
    })
    if (decision.action !== 'pause-and-escalate') return
    expect(containsProhibitedEmergencyClaim(decision.studentExplanation)).toBe(
      false,
    )
    expect(containsProhibitedEmergencyClaim(decision.parentSummary)).toBe(false)
    const event = materializePolicyEvent(decision, {
      eventId: `event-${classification}`,
      sessionId: studentASessionFixture.sessionId,
      studentId: STUDENT_A_ID,
      subjectId: 'math',
      occurredAt: AT,
      evidenceRefs: ['turn-redacted'],
    })
    expect(event).toMatchObject({
      kind: 'emergency-language-event',
      hotlineInformationProvided: false,
      emergencyServicesContacted: false,
      evidenceRefs: ['turn-redacted'],
    })
    expect(JSON.stringify(event)).not.toContain(text)
  })

  it('does not escalate an obvious benign homophone', () => {
    expect(
      evaluateSafetyPolicy({
        text: 'For art class, I want to dye my shirt blue.',
        ageBand: '13-17',
        direction: 'student-to-tutor',
      }),
    ).toEqual({ action: 'allow' })
  })

  it('routes a conservative school-quotation match through the false-positive workflow', () => {
    const decision = evaluateSafetyPolicy({
      text: 'For our literature assignment, the quotation is: "I want to die."',
      ageBand: '13-17',
      direction: 'student-to-tutor',
    })
    expect(decision.action).toBe('pause-and-escalate')
    if (decision.action !== 'pause-and-escalate') return

    const event = materializePolicyEvent(decision, {
      eventId: 'event-school-quotation',
      sessionId: studentASessionFixture.sessionId,
      studentId: STUDENT_A_ID,
      subjectId: 'english',
      occurredAt: AT,
    })
    const queued = queueHumanReview(event, {
      reviewId: 'review-school-quotation',
      actionId: 'action-queue-school-quotation',
      systemActorId: 'safety-system',
      at: AT,
    })
    const requested = requestFalsePositiveReview(
      studentAPrincipalFixture,
      queued,
      {
        falsePositiveId: 'false-positive-school-quotation',
        actionId: 'action-request-school-quotation',
        at: '2026-07-28T16:01:00.000Z',
        reason: 'schoolwork-quotation',
      },
    )
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    expect(requested.value.falsePositiveReview?.requestedBy).toEqual({
      role: 'student',
      actorId: studentAPrincipalFixture.actorId,
    })

    const accepted = decideFalsePositiveReview(
      reviewerPrincipalFixture,
      requested.value,
      {
        actionId: 'action-decide-school-quotation',
        at: '2026-07-28T16:02:00.000Z',
        decision: 'accepted',
        reasonCode: 'verified-schoolwork-context',
      },
    )
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.value).toMatchObject({
      status: 'resolved',
      resolution: 'false-positive',
      falsePositiveReview: { status: 'accepted' },
    })

    const reopened = requestFalsePositiveReview(
      studentAPrincipalFixture,
      accepted.value,
      {
        falsePositiveId: 'false-positive-reopened',
        actionId: 'action-reopen-school-quotation',
        at: '2026-07-28T16:03:00.000Z',
        reason: 'context-misunderstood',
      },
    )
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.value.status).toBe('queued')
    expect(reopened.value.resolution).toBe('pending')
    expect(Object.hasOwn(reopened.value, 'resolvedAt')).toBe(false)
    expect(JSON.parse(JSON.stringify(reopened.value))).toEqual(reopened.value)
  })

  it('provides nonempty age-appropriate refusal text for every machine reason', () => {
    for (const reason of WITHHELD_REASON_VALUES) {
      const explanations = (['under-8', '8-12', '13-17'] as const).map(
        (ageBand) => refusalExplanation(reason, ageBand),
      )
      for (const explanation of explanations) {
        expect(explanation.trim().length).toBeGreaterThan(20)
        expect(containsProhibitedEmergencyClaim(explanation)).toBe(false)
      }
    }

    const privacy = refusalExplanation('privacy-request', '8-12').toLowerCase()
    expect(privacy).toContain('promise')
    expect(privacy).toContain('parent')
    expect(privacy).toContain('safety')
    expect(refusalExplanation('safety-concern', 'under-8')).not.toBe(
      refusalExplanation('safety-concern', '13-17'),
    )
  })
})

describe('retention, deletion, ID collisions, and safe fallback', () => {
  it('continues to reject string-coerced retention durations', () => {
    expect(
      validateRetentionPolicy({
        ...retentionPolicyFixture,
        instructionalHistoryDays: '60',
        safetyEventDays: '180',
        auditHistoryDays: '365',
      }).success,
    ).toBe(false)
  })

  it('does not let a sibling event with the same ID defeat target-student retention', () => {
    const sharedEventId = 'collision-event'
    const oldTargetEvent: SafetyEvent = {
      ...answerWithheldEventFixture,
      eventId: sharedEventId,
      occurredAt: '2025-01-01T00:00:00.000Z',
      createdAt: '2025-01-01T00:00:00.000Z',
    }
    const siblingEvent: SafetyEvent = {
      ...answerWithheldEventFixture,
      eventId: sharedEventId,
      studentId: STUDENT_B_ID,
      sessionId: studentBSessionFixture.sessionId,
      subjectId: 'science',
      occurredAt: '2026-07-27T00:00:00.000Z',
      createdAt: '2026-07-27T00:00:00.000Z',
    }
    const targetNotification: ParentNotification = {
      ...parentNotificationFixture,
      notificationId: 'notification-collision-a',
      eventId: sharedEventId,
    }
    const targetReview = resolvedReview({
      studentId: STUDENT_A_ID,
      reviewId: 'review-collision-a',
      eventId: sharedEventId,
      sessionId: studentASessionFixture.sessionId,
    })
    const siblingReview = resolvedReview({
      studentId: STUDENT_B_ID,
      reviewId: 'review-collision-b',
      eventId: sharedEventId,
      sessionId: studentBSessionFixture.sessionId,
    })
    const result = applyRetentionPolicy(
      {
        ...emptySafetyCenterStore(),
        safetyEvents: [oldTargetEvent, siblingEvent],
        notifications: [targetNotification],
        reviewItems: [targetReview, siblingReview],
      },
      { ...retentionPolicyFixture, safetyEventDays: 90 },
      FIXTURE_NOW,
    )
    expect(result.store.safetyEvents).toEqual([siblingEvent])
    expect(result.store.notifications).toEqual([])
    expect(result.store.reviewItems).toEqual([siblingReview])
  })

  it('upserts reviews by composite student-and-review ID', () => {
    const sharedReviewId = 'shared-review-id'
    const sibling = {
      ...humanReviewFixture,
      studentId: STUDENT_B_ID,
      sessionId: studentBSessionFixture.sessionId,
      reviewId: sharedReviewId,
    }
    const target = {
      ...humanReviewFixture,
      reviewId: sharedReviewId,
    }
    const result = upsertReviewItem(
      { ...emptySafetyCenterStore(), reviewItems: [sibling] },
      target,
    )
    expect(result.reviewItems).toHaveLength(2)
    expect(
      result.reviewItems.map((item) => item.studentId).sort(),
    ).toEqual([STUDENT_A_ID, STUDENT_B_ID])
  })

  it('deletes only eligible target records despite sibling ID collisions', () => {
    const sharedEventId = 'shared-delete-event'
    const sharedReviewId = 'shared-delete-review'
    const sharedRequestId = 'shared-delete-request'
    const targetEvent: SafetyEvent = {
      ...answerWithheldEventFixture,
      eventId: sharedEventId,
    }
    const siblingEvent: SafetyEvent = {
      ...answerWithheldEventFixture,
      eventId: sharedEventId,
      studentId: STUDENT_B_ID,
      sessionId: studentBSessionFixture.sessionId,
      subjectId: 'science',
    }
    const targetReview = resolvedReview({
      studentId: STUDENT_A_ID,
      reviewId: sharedReviewId,
      eventId: sharedEventId,
      sessionId: studentASessionFixture.sessionId,
    })
    const siblingReview = resolvedReview({
      studentId: STUDENT_B_ID,
      reviewId: sharedReviewId,
      eventId: sharedEventId,
      sessionId: studentBSessionFixture.sessionId,
    })
    const approved: DataDeletionRequest = {
      ...deletionRequestFixture,
      requestId: sharedRequestId,
      status: 'approved',
      approvedBy: {
        role: 'parent',
        actorId: parentAPrincipalFixture.actorId,
      },
      approvedAt: '2026-07-28T15:59:00.000Z',
    }
    const siblingRequest: DataDeletionRequest = {
      ...deletionRequestFixture,
      requestId: sharedRequestId,
      studentId: STUDENT_B_ID,
      requestedBy: {
        role: 'student',
        actorId: studentBPrincipalFixture.actorId,
      },
    }
    const targetNotification: ParentNotification = {
      ...parentNotificationFixture,
      notificationId: 'notification-shared-delete-a',
      eventId: sharedEventId,
    }
    const store: SafetyCenterStore = {
      ...emptySafetyCenterStore(),
      sessions: [studentASessionFixture, studentBSessionFixture],
      instructionalHistory: [studentAHistoryFixture, studentBHistoryFixture],
      safetyEvents: [targetEvent, siblingEvent],
      notifications: [targetNotification],
      reviewItems: [targetReview, siblingReview],
      deletionRequests: [siblingRequest],
    }
    const result = executeApprovedDeletion(
      parentAPrincipalFixture,
      store,
      approved,
      { at: AT, auditId: 'audit-delete-collision' },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.report.request.status).toBe('completed')
    expect(result.value.store.safetyEvents).toEqual([siblingEvent])
    expect(result.value.store.notifications).toEqual([])
    expect(result.value.store.reviewItems).toEqual([siblingReview])
    expect(result.value.store.instructionalHistory).toEqual([
      studentBHistoryFixture,
    ])
    expect(
      result.value.store.deletionRequests.filter(
        (request) => request.requestId === sharedRequestId,
      ),
    ).toHaveLength(2)
    expect(
      result.value.store.deletionRequests.some(
        (request) =>
          request.studentId === STUDENT_B_ID &&
          request.requestedBy.actorId === studentBPrincipalFixture.actorId,
      ),
    ).toBe(true)
  })

  it('does not call an instructional-only deletion partial because of an unrelated open review', () => {
    const approved: DataDeletionRequest = {
      ...deletionRequestFixture,
      requestId: 'instruction-only-delete',
      scope: 'instructional-history',
      status: 'approved',
      approvedBy: {
        role: 'parent',
        actorId: parentAPrincipalFixture.actorId,
      },
      approvedAt: '2026-07-28T15:59:00.000Z',
    }
    const result = executeApprovedDeletion(
      parentAPrincipalFixture,
      {
        ...emptySafetyCenterStore(),
        sessions: [studentASessionFixture],
        instructionalHistory: [studentAHistoryFixture],
        safetyEvents: [emergencyEventFixture],
        reviewItems: [humanReviewFixture],
      },
      approved,
      { at: AT, auditId: 'audit-instruction-only-delete' },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.report.request.status).toBe('completed')
    expect(result.value.report.retained.openReviewEventIds).toEqual([
      emergencyEventFixture.eventId,
    ])
    expect(result.value.store.instructionalHistory).toEqual([])
    expect(result.value.store.safetyEvents).toEqual([emergencyEventFixture])
    expect(result.value.store.reviewItems).toEqual([humanReviewFixture])
  })

  it('distinguishes unavailable history from a confirmed empty history', () => {
    const unavailable = queryTutorHistory(
      parentAPrincipalFixture,
      undefined,
      { studentId: STUDENT_A_ID },
    )
    expect(unavailable).toEqual({
      status: 'unavailable',
      records: [],
      message:
        'Tutor history is unavailable right now. No missing conversation details will be guessed.',
    })

    const empty = queryTutorHistory(
      parentAPrincipalFixture,
      emptySafetyCenterStore(),
      { studentId: STUDENT_A_ID },
    )
    expect(empty).toMatchObject({
      status: 'empty',
      records: [],
      totalMatched: 0,
    })
  })
})

describe('raw-audio and emergency-service claim audit', () => {
  it('keeps every retained raw-recording flag false and every retention duration zero', () => {
    const stack: unknown[] = [
      safetyCenterStoreFixture,
      retentionPolicyFixture,
    ]
    while (stack.length > 0) {
      const value = stack.pop()
      if (Array.isArray(value)) {
        stack.push(...value)
        continue
      }
      if (!value || typeof value !== 'object') continue
      for (const [key, child] of Object.entries(value)) {
        if (key === 'rawMicrophoneRecordingStored' || key === 'rawAudioStored') {
          expect(child, key).toBe(false)
        }
        if (key === 'rawMicrophoneRecordingRetentionDays') {
          expect(child, key).toBe(0)
        }
        expect(key.toLowerCase()).not.toMatch(/raw.*audio.*url|recording.*url/)
        stack.push(child)
      }
    }
  })

  it('contains no invented number or positive service-contact claim in generated emergency copy', () => {
    const decision = evaluateSafetyPolicy({
      text: 'I am in immediate danger.',
      ageBand: '13-17',
      direction: 'student-to-tutor',
    })
    expect(decision.action).toBe('pause-and-escalate')
    if (decision.action !== 'pause-and-escalate') return
    const generated = [decision.studentExplanation, decision.parentSummary]
    for (const text of generated) {
      expect(text).not.toMatch(/\b(?:9-?1-?1|9-?8-?8)\b/)
      expect(containsProhibitedEmergencyClaim(text)).toBe(false)
    }
    expect(containsProhibitedEmergencyClaim('Call 9-8-8 now.')).toBe(true)
    expect(
      containsProhibitedEmergencyClaim('Emergency services were contacted.'),
    ).toBe(true)
  })
})
