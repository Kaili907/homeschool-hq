import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHostedFamilyIdentityBridge } from './bridge'
import type { HostedFamilyIdentityProvider } from './contracts'

const SESSION_REFERENCE = `aca_stu_v1_${'C'.repeat(43)}`
const ADULT_TOKEN = 'adult-secret-must-remain-ephemeral'
const HOUSEHOLD_REF = 'a1b2c3d4-e5f6-47a8-9b0c-d1e2f3a4b5c6'
const ADULT_REF = 'd3f2a1b0-4c5d-4e6f-8a9b-0c1d2e3f4a5b'
const STUDENT_REF = '11111111-2222-4333-8444-555555555555'
const EXPIRES = '2030-08-13T12:00:00.000Z'

afterEach(() => vi.unstubAllGlobals())

describe('hosted family identity browser safety', () => {
  it('never persists, navigates with, logs, or serializes a bearer or Study-session credential', async () => {
    const writes: string[] = []
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn((key: string, value: string) => { writes.push(`${key}=${value}`) }),
      removeItem: vi.fn((key: string) => { writes.push(`remove:${key}`) }),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    }
    const indexedDbOpen = vi.fn(() => { throw new Error('identity bridge must not open IndexedDB') })
    const pushState = vi.fn()
    const replaceState = vi.fn()
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('indexedDB', { open: indexedDbOpen, deleteDatabase: indexedDbOpen })
    vi.stubGlobal('history', { pushState, replaceState })

    const provider: HostedFamilyIdentityProvider = {
      readHostedAuthority: vi.fn(async () => ({
        schemaVersion: 1,
        status: 'authorized',
        adult: { adultRef: ADULT_REF },
        household: { householdRef: HOUSEHOLD_REF, relationship: 'guardian', authorityRevision: 1 },
        students: [{
          studentRef: { kind: 'academy-student-id', value: STUDENT_REF },
          displayName: 'Learner',
          nominalGrade: '5',
          workingGradeBySubject: {},
          enabledSubjects: ['mathematics'],
          pinRequired: true,
          configRevision: 1,
        }],
        expiresAt: EXPIRES,
      })),
      authorizeAdultRequest: vi.fn(async () => ({
        schemaVersion: 1,
        status: 'authorized',
        adultRef: ADULT_REF,
        householdRef: HOUSEHOLD_REF,
        authorityRevision: 1,
        expiresAt: EXPIRES,
        headers: { Authorization: `Bearer ${ADULT_TOKEN}` },
      })),
    }
    const identity = createHostedFamilyIdentityBridge({
      provider,
      now: () => Date.parse('2026-08-13T12:00:00.000Z'),
    })
    const asserted = await identity.assertStudentAuthority({ kind: 'academy-student-id', value: STUDENT_REF })
    if (asserted.status !== 'authorized') throw new Error('fixture authority unavailable')
    identity.installStudySessionGrant(asserted.authority, {
      schemaVersion: 1,
      status: 'issued',
      sessionReference: SESSION_REFERENCE,
      expiresAt: EXPIRES,
    })

    expect(JSON.stringify(identity)).toBe('{}')
    expect(JSON.stringify({ identity })).not.toContain(SESSION_REFERENCE)
    expect(JSON.stringify({ identity })).not.toContain(ADULT_TOKEN)
    expect(Object.values(identity).map(String).join('|')).not.toContain(SESSION_REFERENCE)
    expect(Object.values(identity).map(String).join('|')).not.toContain(ADULT_TOKEN)

    const resolved = await identity.resolveHousehold()
    expect(JSON.stringify(resolved)).not.toContain(SESSION_REFERENCE)
    expect(JSON.stringify(resolved)).not.toContain(ADULT_TOKEN)
    const request = await identity.getAuthorizationHeaders({ scope: 'study', authority: asserted.authority })
    expect(request).toMatchObject({ status: 'authorized' })
    identity.clearStudySessionGrant()

    expect(writes).toEqual([])
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(indexedDbOpen).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    consoleLog.mockRestore()
    consoleError.mockRestore()
  })
})
