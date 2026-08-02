import { describe, expect, it } from 'vitest'
import {
  parseStudySessionGrant,
  parseVerifiedStudySession,
  STUDY_STAFF_AUTHORIZATION_UNAVAILABLE,
} from './session'

const issued = {
  schemaVersion: 1,
  status: 'issued',
  sessionReference: `aca_stu_v1_${'A'.repeat(43)}`,
  expiresAt: '2026-08-01T16:15:00.000Z',
}

describe('verified Study identity contracts', () => {
  it('accepts only minimized browser envelopes', () => {
    expect(parseStudySessionGrant(issued)).toEqual(issued)
    expect(parseVerifiedStudySession({
      schemaVersion: 1,
      status: 'verified',
      expiresAt: issued.expiresAt,
    })).toEqual({ schemaVersion: 1, status: 'verified', expiresAt: issued.expiresAt })
  })

  it('rejects authority-bearing extras and malformed opaque references', () => {
    expect(parseStudySessionGrant({ ...issued, studentId: '22222222-2222-4222-8222-222222222222' })).toBeNull()
    expect(parseVerifiedStudySession({
      schemaVersion: 1,
      status: 'verified',
      expiresAt: issued.expiresAt,
      householdId: '44444444-4444-4444-8444-444444444444',
    })).toBeNull()
    expect(parseStudySessionGrant({ ...issued, sessionReference: 'student-1234' })).toBeNull()
  })

  it('keeps staff production authorization structurally unavailable', () => {
    expect(STUDY_STAFF_AUTHORIZATION_UNAVAILABLE).toEqual({
      status: 'not-ready',
      code: 'staff-authorization-unavailable',
    })
  })
})
