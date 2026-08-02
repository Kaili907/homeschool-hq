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
  grantId: '11111111-1111-4111-8111-111111111111',
  studentId: '22222222-2222-4222-8222-222222222222',
  learnerSessionId: '33333333-3333-4333-8333-333333333333',
  sessionEpoch: '33333333-3333-4333-8333-333333333333',
  authorizationRevision: 4,
  issuedAt: '2026-08-01T16:00:00.000Z',
  expiresAt: '2026-08-01T16:15:00.000Z',
  contractVersion: 1,
  issuerVersion: 'academy-student-session-issuer.v1',
  scope: [
    'student:assignments:read',
    'student:attempts:create',
    'student:progress:read',
  ],
}
const { sessionReference: _issuedReference, ...issuedWithoutReference } = issued

describe('verified Study identity contracts', () => {
  it('accepts the fixed issued and verified server shapes', () => {
    expect(parseStudySessionGrant(issued)).toEqual(issued)
    expect(parseVerifiedStudySession({
      ...issuedWithoutReference,
      status: 'verified',
      householdId: '44444444-4444-4444-8444-444444444444',
      sessionVersion: 4,
    })).toMatchObject({ status: 'verified', studentId: issued.studentId })
  })

  it('rejects forged scope, mismatched epochs, and malformed opaque references', () => {
    expect(parseStudySessionGrant({ ...issued, scope: ['study:manage'] })).toBeNull()
    expect(parseStudySessionGrant({ ...issued, sessionEpoch: '55555555-5555-4555-8555-555555555555' })).toBeNull()
    expect(parseStudySessionGrant({ ...issued, sessionReference: 'student-1234' })).toBeNull()
  })

  it('keeps staff production authorization structurally unavailable', () => {
    expect(STUDY_STAFF_AUTHORIZATION_UNAVAILABLE).toEqual({
      status: 'not-ready',
      code: 'staff-authorization-unavailable',
    })
  })
})
