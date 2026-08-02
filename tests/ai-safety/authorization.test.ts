import { describe, expect, it } from 'vitest'
import {
  buildSafetyCenterDataExport,
  createStudentTutorBlock,
  evaluateTutorAccess,
  liftStudentTutorBlock,
  querySafetyEvents,
  queryTutorHistory,
  submitStudentReport,
} from '../../ai-safety/core/index.ts'
import {
  STUDENT_A_ID,
  STUDENT_B_ID,
  exportRequestFixture,
  parentAPrincipalFixture,
  parentBothPrincipalFixture,
  reviewerPrincipalFixture,
  safetyCenterStoreFixture,
  studentAPrincipalFixture,
  studentBPrincipalFixture,
  studentBlockFixture,
  tutorPermissionsFixture,
} from '../../ai-safety/core/fixtures.ts'

describe('parent/student authorization and cross-student isolation', () => {
  it('allows a parent to read only an explicitly authorized student', () => {
    const own = queryTutorHistory(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      { studentId: STUDENT_A_ID },
    )
    expect(own.status).toBe('ok')
    if (own.status === 'ok') {
      expect(own.records.every((record) => record.studentId === STUDENT_A_ID)).toBe(
        true,
      )
    }

    const sibling = queryTutorHistory(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      { studentId: STUDENT_B_ID },
    )
    expect(sibling).toMatchObject({
      status: 'not-authorized',
      records: [],
      reason: 'student-not-authorized',
    })
  })

  it('allows students to read their own history but never another student’s', () => {
    expect(
      queryTutorHistory(studentAPrincipalFixture, safetyCenterStoreFixture, {
        studentId: STUDENT_A_ID,
      }).status,
    ).toBe('ok')
    expect(
      queryTutorHistory(studentAPrincipalFixture, safetyCenterStoreFixture, {
        studentId: STUDENT_B_ID,
      }),
    ).toMatchObject({
      status: 'not-authorized',
      records: [],
      reason: 'student-not-authorized',
    })
  })

  it('still filters by requested student when a parent supports two students', () => {
    const result = queryTutorHistory(
      parentBothPrincipalFixture,
      safetyCenterStoreFixture,
      { studentId: STUDENT_B_ID },
    )
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.studentId).toBe(STUDENT_B_ID)
      expect(JSON.stringify(result.records)).not.toContain('history-a-math-1')
    }
  })

  it('fails closed for unauthenticated principals and reviewers cannot read transcripts', () => {
    const unauthenticated = {
      ...parentAPrincipalFixture,
      authenticated: false,
    }
    expect(
      queryTutorHistory(unauthenticated, safetyCenterStoreFixture, {
        studentId: STUDENT_A_ID,
      }),
    ).toMatchObject({ status: 'not-authorized', reason: 'unauthenticated' })

    const reviewer = {
      ...parentAPrincipalFixture,
      role: 'reviewer' as const,
      permissions: ['history:read' as const],
    }
    expect(
      queryTutorHistory(reviewer, safetyCenterStoreFixture, {
        studentId: STUDENT_A_ID,
      }),
    ).toMatchObject({ status: 'not-authorized', reason: 'role-not-allowed' })
  })

  it('student and reviewer safety-event queries are also student scoped', () => {
    expect(
      querySafetyEvents(studentAPrincipalFixture, safetyCenterStoreFixture, {
        studentId: STUDENT_A_ID,
      }).status,
    ).toBe('ok')
    expect(
      querySafetyEvents(studentAPrincipalFixture, safetyCenterStoreFixture, {
        studentId: STUDENT_B_ID,
      }),
    ).toMatchObject({ status: 'not-authorized', events: [] })
  })

  it('exports one student only and excludes human-review assignment history', () => {
    const result = buildSafetyCenterDataExport(
      parentAPrincipalFixture,
      safetyCenterStoreFixture,
      exportRequestFixture,
      '2026-07-28T15:05:00.000Z',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(
      result.value.instructionalHistory.every(
        (record) => record.studentId === STUDENT_A_ID,
      ),
    ).toBe(true)
    expect(JSON.stringify(result.value)).not.toContain(STUDENT_B_ID)
    expect(JSON.stringify(result.value)).not.toContain('assignedReviewerId')
  })
})

describe('student report/block authorization', () => {
  const reportInput = {
    reportId: 'new-report-a',
    eventId: 'new-report-event-a',
    sessionId: 'session-a-math-1',
    studentId: STUDENT_A_ID,
    subjectId: 'math',
    at: '2026-07-28T15:10:00.000Z',
    category: 'unhelpful' as const,
  }

  it('lets a student report and block their own tutor without requiring a narrative', () => {
    const report = submitStudentReport(studentAPrincipalFixture, reportInput)
    expect(report.ok).toBe(true)
    if (report.ok) {
      expect(report.value.report.comment).toBeUndefined()
      expect(report.value.event.studentId).toBe(STUDENT_A_ID)
    }

    const block = createStudentTutorBlock(studentAPrincipalFixture, {
      blockId: 'new-block-a',
      eventId: 'new-block-event-a',
      sessionId: 'session-a-math-1',
      studentId: STUDENT_A_ID,
      subjectId: 'math',
      at: '2026-07-28T15:10:00.000Z',
      scope: 'all-tutor',
      reason: 'student-choice',
    })
    expect(block.ok).toBe(true)
  })

  it('rejects attempts to report or block for another student', () => {
    expect(
      submitStudentReport(studentBPrincipalFixture, reportInput),
    ).toMatchObject({ ok: false, reason: 'student-not-authorized' })
    expect(
      createStudentTutorBlock(studentBPrincipalFixture, {
        blockId: 'forged-block',
        eventId: 'forged-event',
        sessionId: 'session-a-math-1',
        studentId: STUDENT_A_ID,
        subjectId: 'math',
        at: '2026-07-28T15:10:00.000Z',
        scope: 'subject',
        reason: 'other',
      }),
    ).toMatchObject({ ok: false, reason: 'student-not-authorized' })
  })

  it('lets the owning student lift a block but requires adult/reviewer capabilities', () => {
    expect(
      liftStudentTutorBlock(studentAPrincipalFixture, studentBlockFixture, {
        studentId: STUDENT_A_ID,
        at: '2026-07-28T15:12:00.000Z',
      }),
    ).toMatchObject({
      ok: true,
      value: {
        active: false,
        liftedBy: { role: 'student', actorId: 'student-actor-a' },
      },
    })

    expect(
      liftStudentTutorBlock(
        { ...parentAPrincipalFixture, permissions: [] },
        studentBlockFixture,
        {
          studentId: STUDENT_A_ID,
          at: '2026-07-28T15:12:00.000Z',
        },
      ),
    ).toMatchObject({ ok: false, reason: 'permission-missing' })
    expect(
      liftStudentTutorBlock(parentAPrincipalFixture, studentBlockFixture, {
        studentId: STUDENT_A_ID,
        at: '2026-07-28T15:12:00.000Z',
      }),
    ).toMatchObject({
      ok: true,
      value: { liftedBy: { role: 'parent', actorId: 'parent-actor-a' } },
    })

    expect(
      liftStudentTutorBlock(
        { ...reviewerPrincipalFixture, permissions: [] },
        studentBlockFixture,
        {
          studentId: STUDENT_A_ID,
          at: '2026-07-28T15:12:00.000Z',
        },
      ),
    ).toMatchObject({ ok: false, reason: 'permission-missing' })
    expect(
      liftStudentTutorBlock(reviewerPrincipalFixture, studentBlockFixture, {
        studentId: STUDENT_A_ID,
        at: '2026-07-28T15:12:00.000Z',
      }),
    ).toMatchObject({
      ok: true,
      value: { liftedBy: { role: 'reviewer', actorId: 'reviewer-actor-1' } },
    })
  })
})

describe('subject, session-time, and allowed-time permissions', () => {
  const allowedRequest = {
    studentId: STUDENT_A_ID,
    sessionId: 'new-session-a',
    subjectId: 'math',
    channel: 'text' as const,
    // 10:00 Tuesday in America/New_York.
    at: '2026-07-28T14:00:00.000Z',
    activeSessionMinutes: 10,
    sessionsStartedOnLocalDate: 1,
    activeBlocks: [],
  }

  it('allows a configured subject inside the window', () => {
    expect(evaluateTutorAccess(tutorPermissionsFixture, allowedRequest)).toEqual({
      allowed: true,
    })
  })

  it('denies restricted subjects, time limits, voice, and outside hours', () => {
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        subjectId: 'science',
      }),
    ).toMatchObject({ allowed: false, reason: 'restricted-subject' })
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        activeSessionMinutes: 30,
      }),
    ).toMatchObject({ allowed: false, reason: 'session-time-limit' })
    expect(
      evaluateTutorAccess(
        {
          ...tutorPermissionsFixture,
          capabilities: {
            ...tutorPermissionsFixture.capabilities,
            voiceInput: false,
          },
        },
        { ...allowedRequest, channel: 'voice' },
      ),
    ).toMatchObject({ allowed: false, reason: 'voice-input-disabled' })
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        at: '2026-07-28T01:00:00.000Z',
      }),
    ).toMatchObject({ allowed: false, reason: 'outside-allowed-time' })
  })

  it('honors only blocks matching the student and scope', () => {
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        activeBlocks: [studentBlockFixture],
      }),
    ).toMatchObject({ allowed: false, reason: 'student-blocked' })
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        activeBlocks: [{ ...studentBlockFixture, studentId: STUDENT_B_ID }],
      }),
    ).toEqual({ allowed: true })
  })

  it('fails closed on invalid or negative host-supplied counters', () => {
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        activeSessionMinutes: Number.NaN,
      }),
    ).toMatchObject({ allowed: false, reason: 'permission-disabled' })
    expect(
      evaluateTutorAccess(tutorPermissionsFixture, {
        ...allowedRequest,
        sessionsStartedOnLocalDate: -1,
      }),
    ).toMatchObject({ allowed: false, reason: 'permission-disabled' })
  })
})
