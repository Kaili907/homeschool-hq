import { describe, expect, it } from 'vitest'
import {
  isAbandonedStudySession,
  isActiveStudySession,
  isApprovedBreakStudySession,
  isCompletedStudySession,
  isPausedStudySession,
  isPlannedStudySession,
  isStudentRequestedBreakStudySession,
  isTechnicalInterruptionStudySession,
  studySessionSchema,
} from './study-session.schema.ts'
import { cloneFixture, loadValidFixture } from './test-helpers.ts'

const sessionVariants = [
  ['planned', 'session-planned.json', isPlannedStudySession],
  ['active', 'session-active.json', isActiveStudySession],
  ['paused', 'session-paused.json', isPausedStudySession],
  ['approved-break', 'session-approved-break.json', isApprovedBreakStudySession],
  [
    'student-requested-break',
    'session-student-requested-break.json',
    isStudentRequestedBreakStudySession,
  ],
  [
    'technical-interruption',
    'session-technical-interruption.json',
    isTechnicalInterruptionStudySession,
  ],
  ['completed', 'session-completed.json', isCompletedStudySession],
  ['abandoned', 'session-abandoned.json', isAbandonedStudySession],
] as const

describe('study-session state union', () => {
  it.each(sessionVariants)('validates and narrows %s', (status, filename, guard) => {
    const fixture = loadValidFixture(filename)
    const result = studySessionSchema.validate(fixture)
    expect(result, result.ok ? undefined : result.error).toMatchObject({ ok: true })
    expect(guard(fixture)).toBe(true)
    if (result.ok) expect(result.value.status).toBe(status)
  })

  it('requires a resume point for a paused session', () => {
    const fixture = cloneFixture('session-paused.json')
    delete fixture.resumePoint
    const result = studySessionSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'type', path: '$.resumePoint' }),
      )
    }
  })

  it('rejects a resume point on a terminal session', () => {
    const fixture = cloneFixture('session-completed.json')
    fixture.resumePoint = {
      segmentId: 'segment:mastery-check',
      elapsedActiveSecondsInSegment: 0,
    }
    const result = studySessionSchema.validate(fixture)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'unknown-key', path: '$.resumePoint' }),
      )
    }
  })
})

