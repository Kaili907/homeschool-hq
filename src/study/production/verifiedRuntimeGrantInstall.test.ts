import { describe, expect, it, vi } from 'vitest'
import { createAppStudySessionComposition } from '../composition/appStudySession'
import { STUDY_SESSION_HEADER } from '../client/studySessionTransport'
import { StudyLifecycleBoundary } from '../lifecycle'
import { createVerifiedStudyRuntimeAdapter } from './verifiedRuntimeAdapter'

// STUDY-A1-COMP Phase 5 — the grant the existing guardian-launch path issues is
// installed into the app-owned lifecycle immediately, through the real adapter
// and the real identity client. Nothing copies the reference anywhere else, and
// a refused install leaves Study unavailable rather than half-established.

const REFERENCE_A = `aca_stu_v1_${'A'.repeat(43)}`
const REFERENCE_B = `aca_stu_v1_${'B'.repeat(43)}`
const READINESS = Object.freeze({
  schemaVersion: 1 as const,
  status: 'ready' as const,
  expiresAt: '2099-08-01T16:00:30.000Z',
})

function issued(sessionReference = REFERENCE_A, expiresAt = '2099-08-01T16:15:00.000Z') {
  return { schemaVersion: 1, status: 'issued', sessionReference, expiresAt }
}

function verified() {
  return { schemaVersion: 1, status: 'verified', expiresAt: '2099-08-01T16:15:00.000Z' }
}

function launchInput(studentId = 'child-a', overrides = {}) {
  return {
    featureEnabled: true,
    authenticatedHostSession: true,
    hostSessionKey: 'browser-host-session-key',
    accessToken: 'guardian.access.token',
    selectedStudentRef: { kind: 'legacy-profile-id' as const, value: studentId },
    readiness: READINESS,
    ...overrides,
  }
}

function gateway(grantBody: unknown) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/issue')) return new Response(JSON.stringify(grantBody), { status: 201 })
    if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
    if (url.endsWith('/revoke')) return new Response(null, { status: 204 })
    throw new Error('unexpected request')
  })
}

function composed(fetchImpl: typeof fetch, codes: string[] = []) {
  const session = createAppStudySessionComposition({
    fetchImpl,
    onInstallRejected: (code) => codes.push(code),
  })
  const adapter = createVerifiedStudyRuntimeAdapter({
    identityClient: session.identity,
    lifecycle: new StudyLifecycleBoundary(),
    onSessionGrantIssued: (grant) => { session.installIssuedGrant(grant) },
  })
  return { session, adapter, codes }
}

describe('issued Study grant installation at the App composition seam', () => {
  it('installs the issued grant so the next Study request carries its header', async () => {
    const { session, adapter } = composed(gateway(issued()) as unknown as typeof fetch)
    expect(session.authorization.authorizeStudyRequestHeaders({})).toBeNull()

    const snapshot = await adapter.launch(launchInput())
    expect(snapshot.status).toBe('ready')

    const headers = session.authorization.authorizeStudyRequestHeaders({
      Authorization: 'Bearer adult-token',
    })
    expect(headers?.[STUDY_SESSION_HEADER]).toBe(REFERENCE_A)
  })

  it('installs nothing and refuses the launch when the issued grant is malformed', async () => {
    const codes: string[] = []
    const malformed = { schemaVersion: 1, status: 'issued', sessionReference: 'not-an-opaque-reference', expiresAt: '2099-08-01T16:15:00.000Z' }
    const { session, adapter } = composed(gateway(malformed) as unknown as typeof fetch, codes)

    // The identity client's own parser refuses it first, so the launch fails
    // before the install seam is ever reached — and either way nothing installs.
    await expect(adapter.launch(launchInput())).rejects.toThrow()
    expect(session.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(session.identity.hasSession()).toBe(false)
    expect(adapter.isReady()).toBe(false)
  })

  it('leaves Study unavailable when the install itself is refused', async () => {
    const codes: string[] = []
    const fetchImpl = gateway(issued()) as unknown as typeof fetch
    const session = createAppStudySessionComposition({
      fetchImpl,
      onInstallRejected: (code) => codes.push(code),
    })
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: session.identity,
      lifecycle: new StudyLifecycleBoundary(),
      // A composition whose install cannot succeed: the launch must not proceed.
      onSessionGrantIssued: () => { throw new Error('install refused') },
    })

    await expect(adapter.launch(launchInput())).rejects.toThrow()
    expect(session.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(adapter.isReady()).toBe(false)
    expect(session.identity.hasSession()).toBe(false)
  })

  it('installs an expired grant as no session at all', async () => {
    const { session, adapter } = composed(
      gateway(issued(REFERENCE_A, '2020-01-01T00:00:00.000Z')) as unknown as typeof fetch,
    )
    await expect(adapter.launch(launchInput())).rejects.toThrow()
    expect(session.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(session.lifecycle.hasSession()).toBe(false)
  })

  it('never lets child B inherit child A reference across a learner switch', async () => {
    let body = issued(REFERENCE_A)
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/issue')) return new Response(JSON.stringify(body), { status: 201 })
      if (url.endsWith('/verify')) return new Response(JSON.stringify(verified()), { status: 200 })
      if (url.endsWith('/revoke')) return new Response(null, { status: 204 })
      throw new Error('unexpected request')
    })
    const { session, adapter } = composed(fetchImpl as unknown as typeof fetch)

    await adapter.launch(launchInput('child-a'))
    expect(session.authorization.authorizeStudyRequestHeaders({})?.[STUDY_SESSION_HEADER]).toBe(REFERENCE_A)

    // The App clears before the next learner's launch, exactly as Phase 6 requires.
    session.clear('learner-changed')
    expect(session.authorization.authorizeStudyRequestHeaders({})).toBeNull()

    body = issued(REFERENCE_B)
    await adapter.launch(launchInput('child-b'))
    const headers = session.authorization.authorizeStudyRequestHeaders({})
    expect(headers?.[STUDY_SESSION_HEADER]).toBe(REFERENCE_B)
    expect(JSON.stringify(headers)).not.toContain(REFERENCE_A)
  })

  it('reuses an existing session without re-installing anything', async () => {
    const fetchImpl = gateway(issued()) as unknown as typeof fetch
    const installs: unknown[] = []
    const session = createAppStudySessionComposition({ fetchImpl })
    const adapter = createVerifiedStudyRuntimeAdapter({
      identityClient: session.identity,
      lifecycle: new StudyLifecycleBoundary(),
      onSessionGrantIssued: (grant) => {
        installs.push(grant)
        session.installIssuedGrant(grant)
      },
    })

    await adapter.launch(launchInput('child-a'))
    await adapter.launch(launchInput('child-a'))
    // The second launch reuses the live session, so no second grant is issued
    // and nothing is rotated underneath the learner.
    expect(installs).toHaveLength(1)
    expect(session.authorization.authorizeStudyRequestHeaders({})?.[STUDY_SESSION_HEADER]).toBe(REFERENCE_A)
  })

  it('keeps the reference out of every snapshot the adapter exposes', async () => {
    const { session, adapter } = composed(gateway(issued()) as unknown as typeof fetch)
    await adapter.launch(launchInput())
    expect(JSON.stringify(adapter.snapshot())).not.toContain(REFERENCE_A)
    expect(JSON.stringify(session.lifecycle) ?? '').not.toContain(REFERENCE_A)
    expect(JSON.stringify(session.identity) ?? '').not.toContain(REFERENCE_A)
  })
})
