import { describe, expect, it, vi } from 'vitest'
import { createStudyIdentityClient, StudyIdentityClientError } from './studyIdentityClient'

const reference = `aca_stu_v1_${'A'.repeat(43)}`
const grant = {
  schemaVersion: 1,
  status: 'issued',
  sessionReference: reference,
  grantId: '11111111-1111-4111-8111-111111111111',
  studentId: '22222222-2222-4222-8222-222222222222',
  learnerSessionId: '33333333-3333-4333-8333-333333333333',
  sessionEpoch: '33333333-3333-4333-8333-333333333333',
  authorizationRevision: 1,
  issuedAt: '2026-08-01T16:00:00.000Z',
  expiresAt: '2026-08-01T16:15:00.000Z',
  contractVersion: 1,
  issuerVersion: 'academy-student-session-issuer.v1',
  scope: ['student:assignments:read', 'student:attempts:create', 'student:progress:read'],
}

describe('Study identity browser client', () => {
  it('sends only a learner selector for guardian launch and uses the opaque reference as a bearer', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(grant), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ...grant,
        status: 'verified',
        householdId: '44444444-4444-4444-8444-444444444444',
        sessionVersion: 1,
        sessionReference: undefined,
      }), { status: 200 }))
    const client = createStudyIdentityClient(fetchImpl)

    await client.issueGuardianLaunch({
      accessToken: 'guardian-access-token',
      selectedStudentRef: { kind: 'academy-student-id', value: grant.studentId },
    })
    const [, issueInit] = fetchImpl.mock.calls[0]
    expect(JSON.parse(issueInit.body)).toEqual({
      schemaVersion: 1,
      selectedStudentRef: { kind: 'academy-student-id', value: grant.studentId },
    })
    expect(issueInit.body).not.toContain('householdId')
    expect(issueInit.body).not.toContain('membershipId')
    expect(issueInit.body).not.toContain('relationshipId')

    await client.verify({ requiredCapability: 'student:attempts:create' })
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${reference}`)
  })

  it('clears the in-memory reference on local clear, invalid verification, and revoke', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(grant), { status: 201 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(grant), { status: 201 }))
      .mockResolvedValueOnce(new Response('{"schemaVersion":1,"status":"revoked"}', { status: 200 }))
    const client = createStudyIdentityClient(fetchImpl)
    await client.issueGuardianLaunch({
      accessToken: 'guardian',
      selectedStudentRef: { kind: 'academy-student-id', value: grant.studentId },
    })
    await expect(client.verify({ requiredCapability: 'student:progress:read' })).rejects.toMatchObject({
      code: 'student-session-invalid',
    })
    expect(client.hasSession()).toBe(false)
    await client.issueGuardianLaunch({
      accessToken: 'guardian',
      selectedStudentRef: { kind: 'academy-student-id', value: grant.studentId },
    })
    await client.revoke()
    expect(client.hasSession()).toBe(false)
    expect(fetchImpl.mock.calls[3][1].method).toBe('DELETE')
  })

  it('does not expose a session before verified issuance', async () => {
    const client = createStudyIdentityClient(vi.fn())
    expect(client.hasSession()).toBe(false)
    await expect(client.verify({ requiredCapability: 'student:progress:read' }))
      .rejects.toBeInstanceOf(StudyIdentityClientError)
    client.clear()
    expect(client.hasSession()).toBe(false)
  })

  it('can send a legacy profile id only as a non-authoritative selector', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(grant), { status: 201 }),
    )
    const client = createStudyIdentityClient(fetchImpl)
    await client.issueGuardianLaunch({
      accessToken: 'guardian',
      selectedStudentRef: { kind: 'legacy-profile-id', value: 'learner-p1' },
    })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      schemaVersion: 1,
      selectedStudentRef: { kind: 'legacy-profile-id', value: 'learner-p1' },
    })
  })
})
