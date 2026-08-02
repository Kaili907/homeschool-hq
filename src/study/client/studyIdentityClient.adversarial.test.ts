import { describe, expect, it, vi } from 'vitest'
import { createStudyIdentityClient } from './studyIdentityClient'

const STUDENT_A = '12222222-2222-4222-8222-222222222222'
const STUDENT_B = '23333333-3333-4333-8333-333333333333'
const REFERENCE_A = `aca_stu_v1_${'A'.repeat(43)}`
const REFERENCE_B = `aca_stu_v1_${'B'.repeat(43)}`

function issued(studentId: string, sessionReference: string, suffix: string) {
  const learnerSessionId = `${suffix}4444444-4444-4444-8444-444444444444`
  return {
    schemaVersion: 1,
    status: 'issued',
    sessionReference,
    grantId: `${suffix}1111111-1111-4111-8111-111111111111`,
    studentId,
    learnerSessionId,
    sessionEpoch: learnerSessionId,
    authorizationRevision: 1,
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
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('Study identity client lifecycle races', () => {
  it('never lets learner A overwrite learner B when A issuance resolves last', async () => {
    const pendingA = deferred<Response>()
    const pendingB = deferred<Response>()
    const grantA = issued(STUDENT_A, REFERENCE_A, 'a')
    const grantB = issued(STUDENT_B, REFERENCE_B, 'b')
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null
      if (body?.selectedStudentRef?.value === STUDENT_A) return pendingA.promise
      if (body?.selectedStudentRef?.value === STUDENT_B) return pendingB.promise
      return new Response(JSON.stringify({
        ...grantB,
        status: 'verified',
        householdId: '35555555-5555-4555-8555-555555555555',
        sessionVersion: 1,
        sessionReference: undefined,
      }), { status: 200 })
    })
    const client = createStudyIdentityClient(fetchImpl as unknown as typeof fetch)

    const issueA = client.issueGuardianLaunch({
      accessToken: 'guardian-token',
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_A },
    })
    const issueB = client.issueGuardianLaunch({
      accessToken: 'guardian-token',
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_B },
    })
    pendingB.resolve(new Response(JSON.stringify(grantB), { status: 201 }))
    await issueB
    pendingA.resolve(new Response(JSON.stringify(grantA), { status: 201 }))
    await issueA.catch(() => undefined)

    await client.verify({ requiredCapability: 'student:progress:read' })
    expect(fetchImpl.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      Authorization: `Bearer ${REFERENCE_B}`,
    })
  })

  it('does not restore a session when issuance resolves after logout/clear', async () => {
    const pending = deferred<Response>()
    const client = createStudyIdentityClient(vi.fn(async () => pending.promise))
    const issuing = client.issueGuardianLaunch({
      accessToken: 'guardian-token',
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_A },
    })

    client.clear()
    pending.resolve(new Response(JSON.stringify(issued(STUDENT_A, REFERENCE_A, 'a')), {
      status: 201,
    }))
    await issuing.catch(() => undefined)

    expect(client.hasSession()).toBe(false)
  })
})
