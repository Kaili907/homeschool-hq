import { describe, expect, it, vi } from 'vitest'
import {
  createStudyIdentityClient,
  type StudySessionInvalidationNotice,
} from './studyIdentityClient'

const STUDENT_A = '12222222-2222-4222-8222-222222222222'
const STUDENT_B = '23333333-3333-4333-8333-333333333333'
const REFERENCE_A = `aca_stu_v1_${'A'.repeat(43)}`
const REFERENCE_B = `aca_stu_v1_${'B'.repeat(43)}`

function issued(_studentId: string, sessionReference: string, _suffix: string) {
  return {
    schemaVersion: 1,
    status: 'issued',
    sessionReference,
    expiresAt: '2026-08-01T16:15:00.000Z',
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
        schemaVersion: 1,
        status: 'verified',
        expiresAt: grantB.expiresAt,
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

describe('Study identity client session-invalidation seam', () => {
  const STUDENT_REF = { kind: 'academy-student-id', value: STUDENT_A } as const
  const issueOnce = (reference: string, rest: () => Response) => vi.fn(async (url: string) => (
    url === '/api/study/session/issue'
      ? new Response(JSON.stringify(issued(STUDENT_A, reference, 'a')), { status: 201 })
      : rest()))

  it('notifies once per real transition and never when no session was held', async () => {
    const notices: StudySessionInvalidationNotice[] = []
    const client = createStudyIdentityClient(
      issueOnce(REFERENCE_A, () => new Response('{}', { status: 401 })) as unknown as typeof fetch,
      { onSessionInvalidated: (notice) => { notices.push(notice) } },
    )

    // Nothing held yet, so nothing to invalidate.
    client.clear()
    await client.revoke()
    expect(notices).toEqual([])

    await client.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
    expect(notices).toEqual([])

    client.clear()
    expect(notices.map((notice) => notice.reason)).toEqual(['cleared'])
    // Repeat invalidation of an already-empty client stays silent.
    client.clear()
    await client.revoke()
    expect(notices.map((notice) => notice.reason)).toEqual(['cleared'])
  })

  it('emits one approved reason code per invalidation path and leaks nothing else', async () => {
    const notices: StudySessionInvalidationNotice[] = []
    const listener = (notice: StudySessionInvalidationNotice) => { notices.push(notice) }
    const reasons: string[] = []

    const rejecting = createStudyIdentityClient(
      issueOnce(REFERENCE_A, () => new Response('{}', { status: 401 })) as unknown as typeof fetch,
      { onSessionInvalidated: listener },
    )
    await rejecting.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
    await rejecting.verify({ requiredCapability: 'student:progress:read' }).catch(() => undefined)
    reasons.push(...notices.splice(0).map((notice) => notice.reason))

    const revoking = createStudyIdentityClient(
      issueOnce(REFERENCE_B, () => new Response(null, { status: 204 })) as unknown as typeof fetch,
      { onSessionInvalidated: listener },
    )
    await revoking.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
    await revoking.revoke()
    reasons.push(...notices.splice(0).map((notice) => notice.reason))

    let issues = 0
    const reissuing = createStudyIdentityClient(vi.fn(async () => (issues++ === 0
      ? new Response(JSON.stringify(issued(STUDENT_A, REFERENCE_A, 'a')), { status: 201 })
      : new Response('{}', { status: 403 }))) as unknown as typeof fetch,
      { onSessionInvalidated: listener })
    await reissuing.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
    await reissuing.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
      .catch(() => undefined)
    reasons.push(...notices.splice(0).map((notice) => notice.reason))

    const clearing = createStudyIdentityClient(
      issueOnce(REFERENCE_A, () => new Response(null, { status: 204 })) as unknown as typeof fetch,
      { onSessionInvalidated: listener },
    )
    await clearing.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
    clearing.clear()
    const captured = notices.splice(0)
    reasons.push(...captured.map((notice) => notice.reason))

    expect(reasons).toEqual(['session-rejected', 'revoked', 'reissued', 'cleared'])
    for (const notice of captured) {
      expect(Object.keys(notice)).toEqual(['reason'])
      expect(Object.isFrozen(notice)).toBe(true)
      const serialized = JSON.stringify(notice)
      expect(serialized).not.toContain('aca_stu_v1_')
      expect(serialized).not.toContain('guardian-token')
      expect(serialized).not.toContain(STUDENT_A)
    }
  })

  it('keeps its fail-closed outcome when the listener throws or re-enters', async () => {
    let reentered = 0
    let client!: ReturnType<typeof createStudyIdentityClient>
    client = createStudyIdentityClient(
      issueOnce(REFERENCE_A, () => new Response('{}', { status: 401 })) as unknown as typeof fetch,
      {
        onSessionInvalidated: () => {
          reentered += 1
          // A listener re-entering the client must not recurse: the reference
          // is already gone, so there is no second transition to announce.
          client.clear()
          throw new Error('hostile listener')
        },
      },
    )

    await client.issueGuardianLaunch({ accessToken: 'guardian-token', selectedStudentRef: STUDENT_REF })
    await expect(client.verify({ requiredCapability: 'student:progress:read' }))
      .rejects.toThrow('student-session-invalid')

    expect(reentered).toBe(1)
    expect(client.hasSession()).toBe(false)
    await expect(client.executeAcademicOperation({ operation: 'dashboard:read', request: {} }))
      .rejects.toThrow('student-session-invalid')
  })
})
