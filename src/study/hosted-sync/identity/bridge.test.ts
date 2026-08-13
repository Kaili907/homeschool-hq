import { describe, expect, it, vi } from 'vitest'
import type { StudySessionGrant } from '../../contracts/identity/session'
import { createHostedFamilyIdentityBridge } from './bridge'
import type {
  AuthorizedStudentAuthority,
  HostedAdultAuthorizationEnvelope,
  HostedFamilyAuthorityEnvelope,
  HostedFamilyIdentityProvider,
} from './contracts'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')
const EXPIRES = '2030-08-13T12:00:00.000Z'
const ADULT_REF = 'd3f2a1b0-4c5d-4e6f-8a9b-0c1d2e3f4a5b'
const HOUSEHOLD_REF = 'a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6'
const OTHER_HOUSEHOLD_REF = 'b1c2d3e4-f5a6-47b8-9c0d-e1f2a3b4c5d6'
const STUDENT_A = '11111111-2222-4333-8444-555555555555'
const STUDENT_B = '66666666-7777-4888-9999-aaaaaaaaaaaa'
const UNKNOWN_STUDENT = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const SESSION_A = `aca_stu_v1_${'A'.repeat(43)}`
const SESSION_B = `aca_stu_v1_${'B'.repeat(43)}`
const ADULT_TOKEN = 'provider-owned-adult-bearer'

const authorityEnvelope: Extract<HostedFamilyAuthorityEnvelope, { status: 'authorized' }> = Object.freeze({
  schemaVersion: 1,
  status: 'authorized',
  adult: Object.freeze({ adultRef: ADULT_REF }),
  household: Object.freeze({
    householdRef: HOUSEHOLD_REF,
    relationship: 'parent',
    authorityRevision: 7,
  }),
  students: Object.freeze([
    Object.freeze({
      studentRef: Object.freeze({ kind: 'academy-student-id', value: STUDENT_A }),
      displayName: 'Avery',
      nominalGrade: '5',
      workingGradeBySubject: Object.freeze({ mathematics: '7' }),
      enabledSubjects: Object.freeze(['mathematics', 'science'] as const),
      pinRequired: true,
      configRevision: 3,
    }),
    Object.freeze({
      studentRef: Object.freeze({ kind: 'academy-student-id', value: STUDENT_B }),
      displayName: 'Blake',
      nominalGrade: '8',
      workingGradeBySubject: Object.freeze({}),
      enabledSubjects: Object.freeze(['mathematics', 'english-language-arts'] as const),
      pinRequired: false,
      configRevision: 4,
    }),
  ]),
  expiresAt: EXPIRES,
})

const authorizationEnvelope: HostedAdultAuthorizationEnvelope = Object.freeze({
  schemaVersion: 1,
  status: 'authorized',
  adultRef: ADULT_REF,
  householdRef: HOUSEHOLD_REF,
  authorityRevision: 7,
  expiresAt: EXPIRES,
  headers: Object.freeze({ Authorization: `Bearer ${ADULT_TOKEN}` }),
})

function provider(initialAuthority: unknown = authorityEnvelope) {
  let authority: unknown = initialAuthority
  let authorization: unknown = authorizationEnvelope
  return {
    port: {
      readHostedAuthority: vi.fn(async () => structuredClone(authority)),
      authorizeAdultRequest: vi.fn(async () => structuredClone(authorization)),
    } satisfies HostedFamilyIdentityProvider,
    setAuthority(value: unknown) { authority = value },
    setAuthorization(value: unknown) { authorization = value },
  }
}

function bridge(port: HostedFamilyIdentityProvider, expectedHouseholdRef?: string) {
  return createHostedFamilyIdentityBridge({
    provider: port,
    ...(expectedHouseholdRef ? { expectedHouseholdRef } : {}),
    now: () => NOW,
  })
}

function studentRef(value: string) {
  return { kind: 'academy-student-id' as const, value }
}

function grant(sessionReference: string, expiresAt = EXPIRES): StudySessionGrant {
  return { schemaVersion: 1, status: 'issued', sessionReference, expiresAt }
}

async function authorizedStudent(
  identity: ReturnType<typeof bridge>,
  value = STUDENT_A,
): Promise<AuthorizedStudentAuthority> {
  const result = await identity.assertStudentAuthority(studentRef(value))
  expect(result.status).toBe('authorized')
  if (result.status !== 'authorized') throw new Error('fixture authority missing')
  return result.authority
}

describe('hosted family identity bridge', () => {
  it('resolves one stable household and roster on two independent device fixtures', async () => {
    const deviceA = bridge(provider().port)
    const deviceB = bridge(provider().port)

    await expect(deviceA.resolveAdultIdentity()).resolves.toEqual({
      status: 'authenticated',
      identity: { source: 'hosted-authority-state', adultRef: ADULT_REF, expiresAt: EXPIRES },
    })
    const householdA = await deviceA.resolveHousehold()
    const householdB = await deviceB.resolveHousehold()
    const rosterA = await deviceA.listAuthorizedStudents()
    const rosterB = await deviceB.listAuthorizedStudents()

    expect(householdA).toEqual(householdB)
    expect(rosterA).toEqual(rosterB)
    expect(rosterA).toMatchObject({
      status: 'authorized',
      householdRef: HOUSEHOLD_REF,
      students: [
        { studentRef: studentRef(STUDENT_A), displayName: 'Avery', configRevision: 3 },
        { studentRef: studentRef(STUDENT_B), displayName: 'Blake', configRevision: 4 },
      ],
    })
  })

  it('rejects the wrong household before exposing a roster or usable grant', async () => {
    const identity = bridge(provider().port, OTHER_HOUSEHOLD_REF)
    await expect(identity.resolveHousehold()).resolves.toEqual({
      status: 'rejected',
      source: 'hosted-authority-state',
      reason: 'wrong-household',
    })
    await expect(identity.listAuthorizedStudents()).resolves.toMatchObject({
      status: 'rejected',
      reason: 'wrong-household',
    })
  })

  it('rejects unknown, legacy, malformed, and structurally tampered student references', async () => {
    const identity = bridge(provider().port)
    await expect(identity.assertStudentAuthority(studentRef(UNKNOWN_STUDENT))).resolves.toMatchObject({
      status: 'rejected',
      reason: 'unknown-student',
    })
    for (const tampered of [
      { kind: 'legacy-profile-id', value: STUDENT_A },
      { kind: 'academy-student-id', value: `${STUDENT_A}x` },
      { kind: 'academy-student-id', value: STUDENT_A, householdRef: HOUSEHOLD_REF },
      { kind: 'academy-student-id', value: STUDENT_B.replace('6666', 'zzzz') },
    ]) {
      await expect(identity.assertStudentAuthority(tampered)).resolves.toMatchObject({
        status: 'rejected',
        reason: 'tampered-student-ref',
      })
    }
  })

  it('binds a grant to one closure-branded student authority and isolates siblings', async () => {
    const identity = bridge(provider().port)
    const authorityA = await authorizedStudent(identity, STUDENT_A)
    const authorityB = await authorizedStudent(identity, STUDENT_B)
    expect(identity.installStudySessionGrant(authorityA, grant(SESSION_A))).toMatchObject({ status: 'installed' })

    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority: authorityB }))
      .resolves.toMatchObject({ status: 'rejected', reason: 'student-authority-mismatch' })
    const authorizedA = await identity.getAuthorizationHeaders({ scope: 'study', authority: authorityA })
    expect(authorizedA).toMatchObject({
      status: 'authorized',
      headers: {
        Authorization: `Bearer ${ADULT_TOKEN}`,
        'x-study-session': SESSION_A,
      },
    })

    const forged = { ...authorityA, studentRef: studentRef(STUDENT_B) }
    await expect(identity.getAuthorizationHeaders({
      scope: 'study',
      authority: forged,
    })).resolves.toMatchObject({ status: 'rejected', reason: 'stale-student-authority' })

    expect(identity.installStudySessionGrant(authorityB, grant(SESSION_B))).toMatchObject({ status: 'installed' })
    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority: authorityA }))
      .resolves.toMatchObject({ status: 'rejected', reason: 'student-authority-mismatch' })
    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority: authorityB }))
      .resolves.toMatchObject({ status: 'authorized', headers: { 'x-study-session': SESSION_B } })
  })

  it('rotates grants and clears the stale grant before a failed rotation', async () => {
    const identity = bridge(provider().port)
    const authority = await authorizedStudent(identity)
    expect(identity.installStudySessionGrant(authority, grant(SESSION_A))).toMatchObject({ status: 'installed' })
    expect(identity.installStudySessionGrant(authority, grant(SESSION_B))).toMatchObject({ status: 'installed' })
    const rotated = await identity.getAuthorizationHeaders({ scope: 'study', authority })
    expect(rotated).toMatchObject({ status: 'authorized', headers: { 'x-study-session': SESSION_B } })
    expect(JSON.stringify(rotated)).not.toContain(SESSION_A)

    expect(identity.installStudySessionGrant(authority, {
      ...grant(SESSION_A),
      sessionReference: 'tampered',
    })).toEqual({ status: 'rejected', reason: 'study-session-grant-invalid' })
    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority })).resolves.toMatchObject({
      status: 'interrupted',
      state: 'study-session-missing',
      interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
    })

    expect(identity.installStudySessionGrant(authority, grant(SESSION_A, '2026-08-13T11:59:59.000Z')))
      .toEqual({ status: 'rejected', reason: 'study-session-grant-expired' })
  })

  it('makes a revoked Study grant unusable without turning it into a safety incident', async () => {
    const identity = bridge(provider().port)
    const authority = await authorizedStudent(identity)
    identity.installStudySessionGrant(authority, grant(SESSION_A))
    identity.clearStudySessionGrant('revoked')
    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority })).resolves.toEqual({
      status: 'interrupted',
      source: 'hosted-authority-state',
      state: 'study-session-revoked',
      interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
    })
  })

  it('returns signed-out, expired, and revoked adult auth as neutral interruptions', async () => {
    for (const state of ['signed-out', 'expired', 'revoked'] as const) {
      const identity = bridge(provider({ schemaVersion: 1, status: state }).port)
      await expect(identity.resolveHousehold()).resolves.toEqual({
        status: 'interrupted',
        source: 'hosted-authority-state',
        state,
        interruption: { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
      })
    }

    const expiredEnvelope = {
      ...structuredClone(authorityEnvelope),
      expiresAt: '2026-08-13T11:59:59.000Z',
    }
    await expect(bridge(provider(expiredEnvelope).port).resolveHousehold()).resolves.toMatchObject({
      status: 'interrupted',
      state: 'expired',
    })

    const fixture = provider()
    const identity = bridge(fixture.port)
    const authority = await authorizedStudent(identity)
    identity.installStudySessionGrant(authority, grant(SESSION_A))
    fixture.setAuthorization({ schemaVersion: 1, status: 'expired' })
    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority })).resolves.toEqual({
      status: 'interrupted',
      source: 'hosted-authority-state',
      state: 'expired',
      interruption: { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
    })
  })

  it('rejects authority projections that try to smuggle credentials or extra claims', async () => {
    const identity = bridge(provider({
      ...structuredClone(authorityEnvelope),
      accessToken: ADULT_TOKEN,
    }).port)
    const result = await identity.resolveHousehold()
    expect(result).toEqual({
      status: 'unavailable',
      source: 'hosted-authority-state',
      reason: 'hosted-authority-invalid',
    })
    expect(JSON.stringify(result)).not.toContain(ADULT_TOKEN)
  })

  it('keeps adult-only headers separate and refuses provider/caller header substitution', async () => {
    const fixture = provider()
    const identity = bridge(fixture.port)
    await expect(identity.getAuthorizationHeaders({
      scope: 'adult',
      headers: { 'content-type': 'application/json' },
    })).resolves.toMatchObject({
      status: 'authorized',
      headers: {
        Authorization: `Bearer ${ADULT_TOKEN}`,
        'content-type': 'application/json',
      },
    })

    await expect(identity.getAuthorizationHeaders({
      scope: 'adult',
      headers: { authorization: 'Bearer caller-token' },
    })).resolves.toMatchObject({ status: 'rejected', reason: 'invalid-request-headers' })

    fixture.setAuthorization({
      ...authorizationEnvelope,
      headers: { Authorization: `Bearer ${ADULT_TOKEN}`, 'x-study-session': SESSION_B },
    })
    await expect(identity.getAuthorizationHeaders({ scope: 'adult' })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'authorization-headers-invalid',
    })
  })

  it('invalidates tickets and grants when hosted roster authority changes', async () => {
    const fixture = provider()
    const identity = bridge(fixture.port)
    const authority = await authorizedStudent(identity)
    identity.installStudySessionGrant(authority, grant(SESSION_A))
    fixture.setAuthority({
      ...structuredClone(authorityEnvelope),
      household: { ...authorityEnvelope.household, authorityRevision: 8 },
    })
    await identity.resolveHousehold()
    await expect(identity.getAuthorizationHeaders({ scope: 'study', authority })).resolves.toMatchObject({
      status: 'rejected',
      reason: 'stale-student-authority',
    })
  })
})
