/**
 * The Study Safety request contract must validate each field against its own
 * source of truth.
 *
 * `studentRef.value` for kind 'academy-student-id' is a canonical Study student
 * identity that originates in Postgres and is issued by study-session-issue, so
 * it must be validated by the canonical Study identity contract. `requestId` and
 * `sessionId` are caller-generated correlation values that the browser adapter
 * manufactures as RFC-4122 v4 UUIDs, so their stricter rule is intentional and
 * must not be relaxed alongside the student identity.
 */

import { describe, expect, it } from 'vitest'
import { validateStudySafetyRequest, validUuid as validRequestCorrelationUuid } from './contracts.js'
import { validUuid as validCanonicalStudyId } from '../study-identity/contracts.js'

const RFC_V4 = Object.freeze({
  request: '22222222-2222-4222-8222-222222222222',
  session: '55555555-5555-4555-8555-555555555555',
  student: '44444444-4444-4444-8444-444444444444',
})

/**
 * Canonical Postgres-storable Study student identities that the RFC-strict rule
 * refuses: the version nibble is outside [1-8] and/or the variant nibble is
 * outside [89ab]. study-session-issue accepts every one of these.
 */
const CANONICAL_NON_RFC = Object.freeze([
  ['a zero version and c variant nibble', '9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1d'],
  ['an f version and 7 variant nibble', '123e4567-e89b-f2d3-7456-426614174000'],
  ['an all-zero canonical identity', '00000000-0000-0000-0000-000000000000'],
  // The seeded STUDENT_A identity from the academy_students fixture graph.
  ['the seeded STUDENT_A identity', '00000000-0000-0000-0000-000000000101'],
])

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    requestId: RFC_V4.request,
    studentRef: { kind: 'academy-student-id', value: RFC_V4.student },
    sessionId: RFC_V4.session,
    transientText: 'ordinary answer',
    ...overrides,
  }
}

function refusal(value) {
  try {
    validateStudySafetyRequest(value)
  } catch (error) {
    return { statusCode: error?.statusCode, code: error?.code }
  }
  throw new Error('expected the request contract to refuse this value')
}

describe('Study Safety studentRef identity contract', () => {
  it('pins the fixture premise: canonical Study identities the RFC-strict rule refuses', () => {
    for (const [, value] of CANONICAL_NON_RFC) {
      expect(validCanonicalStudyId(value)).toBe(true)
      expect(validRequestCorrelationUuid(value)).toBe(false)
    }
  })

  it.each(CANONICAL_NON_RFC)(
    'accepts %s as an academy-student-id, matching study-session-issue',
    (_label, student) => {
      const accepted = validateStudySafetyRequest(request({
        studentRef: { kind: 'academy-student-id', value: student },
      }))
      expect(accepted.studentRef).toEqual({ kind: 'academy-student-id', value: student })
      // The selector is preserved verbatim so the authorizer can compare it to
      // the server-verified grant owner rather than to a rewritten value.
      expect(accepted.sessionId).toBe(RFC_V4.session)
      expect(accepted.requestId).toBe(RFC_V4.request)
    },
  )

  it.each(CANONICAL_NON_RFC)(
    'keeps the caller-generated requestId under the stricter rule for %s',
    (_label, correlation) => {
      expect(refusal(request({ requestId: correlation }))).toEqual({
        statusCode: 400, code: 'invalid_request',
      })
    },
  )

  it.each(CANONICAL_NON_RFC)(
    'keeps the caller-generated sessionId under the stricter rule for %s',
    (_label, correlation) => {
      expect(refusal(request({ sessionId: correlation }))).toEqual({
        statusCode: 400, code: 'invalid_request',
      })
    },
  )

  it.each([
    ['a non-UUID string', 'not-a-student-id'],
    ['an empty value', ''],
    ['a whitespace-only value', '   '],
    ['a hyphenless value', '9f2a1c408b3e0a44c1d26f7e8a9b0c1d'],
    ['a non-hexadecimal value', 'gf2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1d'],
    ['a truncated value', '9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1'],
    ['an overlong value', '9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1dd'],
    ['a braced value', '{9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1d}'],
    ['a URN-prefixed value', 'urn:uuid:9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1d'],
    ['a newline-injected value', '9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1d\nx'],
    ['a null value', null],
    ['a numeric value', 42],
    ['an object value', { value: '9f2a1c40-8b3e-0a44-c1d2-6f7e8a9b0c1d' }],
  ])('still fails closed for %s as an academy-student-id', (_label, student) => {
    expect(refusal(request({ studentRef: { kind: 'academy-student-id', value: student } }))).toEqual({
      statusCode: 400, code: 'invalid_request',
    })
  })

  it('refuses an unknown studentRef kind and a malformed selector envelope', () => {
    for (const studentRef of [
      { kind: 'household-id', value: RFC_V4.student },
      { kind: 'academy-student-id' },
      { kind: 'academy-student-id', value: RFC_V4.student, householdId: RFC_V4.student },
      null,
      'academy-student-id',
    ]) {
      expect(refusal(request({ studentRef }))).toEqual({ statusCode: 400, code: 'invalid_request' })
    }
  })

  it('refuses every browser-nominated household, guardian, actor, or authority claim', () => {
    for (const key of [
      'householdId', 'studentId', 'actorUserId', 'guardianId', 'role', 'authority',
      'recipientRef', 'sessionReference', 'learnerSessionId', 'scope',
    ]) {
      expect(refusal({ ...request(), [key]: RFC_V4.student })).toEqual({
        statusCode: 400, code: 'invalid_request',
      })
    }
  })

  it('leaves the legacy-profile-id opaque selector rule unchanged', () => {
    const accepted = validateStudySafetyRequest(request({
      studentRef: { kind: 'legacy-profile-id', value: 'legacy-profile:1042' },
    }))
    expect(accepted.studentRef).toEqual({ kind: 'legacy-profile-id', value: 'legacy-profile:1042' })
    expect(refusal(request({ studentRef: { kind: 'legacy-profile-id', value: '-leading-hyphen' } })))
      .toEqual({ statusCode: 400, code: 'invalid_request' })
  })
})
