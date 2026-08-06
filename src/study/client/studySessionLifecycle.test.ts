import { describe, expect, it, vi } from 'vitest'
import type { StudySessionGrant } from '../contracts/identity/session'
import { classifyStudySafety } from '../safety/client'
import { learnerSafeResult } from '../safety/learnerSafe'
import {
  createStudyIdentityClient,
  type StudySessionInvalidationNotice,
} from './studyIdentityClient'
import {
  createStudySessionLifecycle,
  type StudySessionLifecycleDeps,
} from './studySessionLifecycle'
import {
  createStudySessionTransport,
  STUDY_SESSION_HEADER,
  StudySessionTransportError,
} from './studySessionTransport'

const REFERENCE_A = `aca_stu_v1_${'A'.repeat(43)}`
const REFERENCE_B = `aca_stu_v1_${'B'.repeat(43)}`
const NOW = Date.parse('2026-08-06T11:00:00.000Z')
const EXPIRES_AT = '2026-08-06T12:00:00.000Z'
const ONE_HOUR = 60 * 60 * 1000
const STUDENT = { kind: 'academy-student-id', value: '44444444-4444-4444-8444-444444444444' } as const

function grant(sessionReference: string, expiresAt: string = EXPIRES_AT): StudySessionGrant {
  return { schemaVersion: 1, status: 'issued', sessionReference, expiresAt } as StudySessionGrant
}

/**
 * A deterministic clock plus a timer table that also keeps every callback ever
 * scheduled, so a cancelled timer can still be fired the way a real platform
 * timer already queued before `clearTimeout` landed would be.
 */
function fakeClock(start = NOW) {
  let current = start
  let nextHandle = 1
  const live = new Map<number, { at: number; callback: () => void }>()
  const created: { handle: number; callback: () => void }[] = []
  return {
    now: () => current,
    setTimer(callback: () => void, delayMs: number) {
      const handle = nextHandle++
      live.set(handle, { at: current + delayMs, callback })
      created.push({ handle, callback })
      return handle
    },
    clearTimer(handle: unknown) { live.delete(handle as number) },
    liveCount: () => live.size,
    createdCount: () => created.length,
    /** Fires a callback directly, bypassing cancellation and the clock. */
    fireCreated(index: number) { created[index]!.callback() },
    advance(ms: number) {
      current += ms
      for (const [handle, entry] of [...live]) {
        if (entry.at <= current) { live.delete(handle); entry.callback() }
      }
    },
  }
}

function lifecycleDeps(clock: ReturnType<typeof fakeClock>, extra: StudySessionLifecycleDeps = {}) {
  return {
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    ...extra,
  } satisfies StudySessionLifecycleDeps
}

/** Issues once, then answers everything else with `verifyStatus`. */
function identityFetch(sessionReference: string, verifyStatus = 401) {
  return vi.fn(async (url: string) => (url === '/api/study/session/issue'
    ? new Response(JSON.stringify(grant(sessionReference)), { status: 201 })
    : new Response('{}', { status: verifyStatus })))
}

describe('Study session lifecycle — identity invalidation', () => {
  it('clears the transport when the identity client self-clears on a rejected session', async () => {
    const clock = fakeClock()
    const transport = createStudySessionTransport()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock, { transport }))
    const identity = createStudyIdentityClient(
      identityFetch(REFERENCE_A) as unknown as typeof fetch,
      { onSessionInvalidated: lifecycle.onIdentitySessionInvalidated },
    )

    lifecycle.install(await identity.issueGuardianLaunch({
      accessToken: 'guardian-token',
      selectedStudentRef: STUDENT,
    }))
    expect(lifecycle.hasSession()).toBe(true)
    expect(transport.hasSession()).toBe(true)

    await expect(identity.verify({ requiredCapability: 'student:progress:read' })).rejects.toThrow()

    expect(identity.hasSession()).toBe(false)
    expect(transport.hasSession()).toBe(false)
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(lifecycle.lastClearReason()).toBe('session-rejected')
    expect(clock.liveCount()).toBe(0)
  })

  it('clears the transport when an academic operation is rejected and when the session is revoked', async () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    const identity = createStudyIdentityClient(
      identityFetch(REFERENCE_A) as unknown as typeof fetch,
      { onSessionInvalidated: lifecycle.onIdentitySessionInvalidated },
    )

    lifecycle.install(await identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
    await expect(identity.executeAcademicOperation({ operation: 'dashboard:read', request: {} }))
      .rejects.toThrow()
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('session-rejected')

    const revoking = createStudyIdentityClient(
      vi.fn(async (url: string) => (url === '/api/study/session/issue'
        ? new Response(JSON.stringify(grant(REFERENCE_B)), { status: 201 })
        : new Response(null, { status: 204 }))) as unknown as typeof fetch,
      { onSessionInvalidated: lifecycle.onIdentitySessionInvalidated },
    )
    lifecycle.install(await revoking.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
    expect(lifecycle.hasSession()).toBe(true)
    await revoking.revoke()
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('revoked')
  })

  it('clears the stale transport when a new launch replaces the previous session', async () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    // The second launch is refused, which is exactly when a stale reference
    // would otherwise stay live in the transport.
    let issues = 0
    const identity = createStudyIdentityClient(
      vi.fn(async () => (issues++ === 0
        ? new Response(JSON.stringify(grant(REFERENCE_A)), { status: 201 })
        : new Response('{}', { status: 403 }))) as unknown as typeof fetch,
      { onSessionInvalidated: lifecycle.onIdentitySessionInvalidated },
    )

    lifecycle.install(await identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
    expect(lifecycle.hasSession()).toBe(true)

    await expect(identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
      .rejects.toThrow()

    expect(identity.hasSession()).toBe(false)
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('reissued')
  })

  it('is idempotent across duplicate invalidations and tolerates one with no session installed', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))

    lifecycle.onIdentitySessionInvalidated({ reason: 'session-rejected' })
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('session-rejected')

    lifecycle.install(grant(REFERENCE_A))
    for (const reason of ['session-rejected', 'session-rejected', 'revoked'] as const) {
      lifecycle.onIdentitySessionInvalidated({ reason })
      expect(lifecycle.hasSession()).toBe(false)
      expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    }
    expect(lifecycle.lastClearReason()).toBe('revoked')
    expect(clock.liveCount()).toBe(0)
  })

  it('fails closed on a malformed notice instead of leaving the session live', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))

    for (const notice of [
      undefined, null, {}, { reason: 'not-an-approved-code' }, { reason: 42 },
      { reason: 'session-rejected', sessionReference: REFERENCE_A },
    ]) {
      lifecycle.install(grant(REFERENCE_A))
      expect(lifecycle.hasSession()).toBe(true)
      lifecycle.onIdentitySessionInvalidated(notice as unknown as StudySessionInvalidationNotice)
      expect(lifecycle.hasSession()).toBe(false)
    }
    expect(lifecycle.lastClearReason()).toBe('session-rejected')
  })

  it('sends only an approved reason code to the listener and survives one that throws', async () => {
    const seen: unknown[] = []
    const identity = createStudyIdentityClient(
      identityFetch(REFERENCE_A) as unknown as typeof fetch,
      {
        onSessionInvalidated: (notice) => {
          seen.push(notice)
          throw new Error('hostile listener')
        },
      },
    )

    await identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT })
    await expect(identity.verify({ requiredCapability: 'student:progress:read' }))
      .rejects.toThrow('student-session-invalid')

    // The listener threw, and the client still cleared itself and failed closed.
    expect(identity.hasSession()).toBe(false)
    expect(seen).toHaveLength(1)
    const notice = seen[0] as StudySessionInvalidationNotice
    expect(Object.keys(notice)).toEqual(['reason'])
    expect(notice.reason).toBe('session-rejected')
    expect(Object.isFrozen(notice)).toBe(true)
    expect(JSON.stringify(notice)).toBe('{"reason":"session-rejected"}')
    expect(JSON.stringify(notice)).not.toContain('aca_stu_v1_')
    expect(JSON.stringify(notice)).not.toContain('guardian-token')
  })

  it('stays fail-closed when no listener is wired at all', async () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    const identity = createStudyIdentityClient(identityFetch(REFERENCE_A) as unknown as typeof fetch)

    lifecycle.install(await identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
    await expect(identity.verify({ requiredCapability: 'student:progress:read' })).rejects.toThrow()

    // Without the seam the transport is stale — F4's original state — but no
    // permissive path appears: the identity client still refuses, and expiry
    // still empties the transport on its own.
    expect(identity.hasSession()).toBe(false)
    await expect(identity.verify({ requiredCapability: 'student:progress:read' }))
      .rejects.toThrow('student-session-invalid')
    clock.advance(ONE_HOUR)
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('expired')
  })
})

describe('Study session lifecycle — expiry and rotation', () => {
  it('clears at expiry and refuses a later request', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))

    clock.advance(ONE_HOUR - 1)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toEqual({
      [STUDY_SESSION_HEADER]: REFERENCE_A,
    })

    clock.advance(1)
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(lifecycle.lastClearReason()).toBe('expired')
    expect(clock.liveCount()).toBe(0)
  })

  it('expires on the next authorize even when the timer never fires', () => {
    const clock = fakeClock()
    // No timer support at all: a throttled background tab, in effect.
    const lifecycle = createStudySessionLifecycle({
      now: clock.now,
      setTimer: () => null,
      clearTimer: () => {},
    })
    lifecycle.install(grant(REFERENCE_A))
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).not.toBeNull()

    clock.advance(ONE_HOUR)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('expired')
  })

  it('refuses an already-expired grant without leaving a previous one live', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))

    lifecycle.install(grant(REFERENCE_B, '2026-08-06T10:00:00.000Z'))
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    expect(lifecycle.lastClearReason()).toBe('expired')
    expect(clock.liveCount()).toBe(0)
  })

  it('cancels the previous expiry timer on rotation', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))

    lifecycle.install(grant(REFERENCE_A))
    expect(clock.liveCount()).toBe(1)
    lifecycle.install(grant(REFERENCE_B, '2026-08-06T13:00:00.000Z'))
    expect(clock.liveCount()).toBe(1)
    expect(clock.createdCount()).toBe(2)

    // Grant A's deadline passes; only grant B's timer remains, so B survives.
    clock.advance(ONE_HOUR)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toEqual({
      [STUDY_SESSION_HEADER]: REFERENCE_B,
    })
  })

  it('ignores a stale timer callback from a replaced grant', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))

    lifecycle.install(grant(REFERENCE_A))
    lifecycle.install(grant(REFERENCE_B, '2026-08-06T13:00:00.000Z'))
    clock.advance(ONE_HOUR + 1)

    // Grant A's callback, already queued by the platform when rotation
    // cancelled it, runs after grant B is installed and past A's deadline.
    clock.fireCreated(0)

    expect(lifecycle.hasSession()).toBe(true)
    expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toEqual({
      [STUDY_SESSION_HEADER]: REFERENCE_B,
    })
    expect(lifecycle.lastClearReason()).toBeNull()
  })

  it('reschedules rather than clearing when its own timer fires early', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))

    clock.fireCreated(0)
    expect(lifecycle.hasSession()).toBe(true)
    expect(clock.createdCount()).toBe(2)

    clock.advance(ONE_HOUR)
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('expired')
  })

  it('does not let expiry mid-flight authorize a second request', async () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))

    let release!: () => void
    let started!: () => void
    const inFlight = new Promise<void>((resolve) => { release = resolve })
    const requestStarted = new Promise<void>((resolve) => { started = resolve })
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => {
      started()
      await inFlight
      return {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'clear',
          learner: learnerSafeResult('clear'),
          continueToTutorCore: true,
        }),
      }
    })
    const safetyRequest = {
      schemaVersion: 1,
      requestId: '22222222-2222-4222-8222-222222222222',
      studentRef: STUDENT,
      sessionId: '55555555-5555-4555-8555-555555555555',
      transientText: 'synthetic learner text',
    } as const
    const first = classifyStudySafety(safetyRequest, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
      sessionAuthorization: lifecycle.authorization,
    })

    // The reference is already inside this request's headers and on the wire.
    await requestStarted
    clock.advance(ONE_HOUR)
    release()
    expect((await first).classification).toBe('clear')

    // The reference is gone for everything that authorizes after expiry.
    const second = await classifyStudySafety(safetyRequest, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
      sessionAuthorization: lifecycle.authorization,
    })
    expect(second.classification).toBe('invalid')
    expect(second.continueToTutorCore).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('Study session lifecycle — explicit host clears', () => {
  it('clears both holders on logout and on a learner change', async () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    const identity = createStudyIdentityClient(
      identityFetch(REFERENCE_A) as unknown as typeof fetch,
      { onSessionInvalidated: lifecycle.onIdentitySessionInvalidated },
    )
    const wired = createStudySessionLifecycle(lifecycleDeps(clock, { identity }))

    wired.install(await identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
    expect(wired.hasSession()).toBe(true)
    expect(identity.hasSession()).toBe(true)

    wired.clear('logout')
    expect(wired.hasSession()).toBe(false)
    expect(identity.hasSession()).toBe(false)
    // The host's own reason survives the notice the identity clear raises.
    expect(wired.lastClearReason()).toBe('logout')
    expect(clock.liveCount()).toBe(0)

    // Learner switch: explicit clear, then install for the next learner.
    wired.clear('learner-changed')
    expect(wired.lastClearReason()).toBe('learner-changed')
    wired.install(grant(REFERENCE_B))
    expect(wired.hasSession()).toBe(true)
    expect(wired.lastClearReason()).toBeNull()
    expect(wired.authorization.authorizeStudyRequestHeaders({})).toEqual({
      [STUDY_SESSION_HEADER]: REFERENCE_B,
    })
  })

  it('clears without an identity client wired', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))
    lifecycle.clear('logout')
    expect(lifecycle.hasSession()).toBe(false)
    expect(lifecycle.lastClearReason()).toBe('logout')
  })
})

describe('Study session lifecycle — custody of the reference', () => {
  it('refuses a malformed rotation after a valid grant and discloses nothing', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))

    for (const malformed of [
      grant('not-a-study-session'),
      grant(`${REFERENCE_A}x`),
      grant(REFERENCE_B, 'not-a-date'),
      { ...grant(REFERENCE_B), extra: 'x' } as unknown as StudySessionGrant,
      null as unknown as StudySessionGrant,
    ]) {
      let thrown: unknown
      try {
        lifecycle.install(malformed)
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(StudySessionTransportError)
      expect(String(thrown)).not.toContain('aca_stu_v1_')
      expect(JSON.stringify({ error: String(thrown), stack: (thrown as Error).stack }))
        .not.toContain('aca_stu_v1_')
      expect(lifecycle.hasSession()).toBe(false)
      expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
      expect(lifecycle.lastClearReason()).toBe('install-rejected')
      expect(clock.liveCount()).toBe(0)
      lifecycle.install(grant(REFERENCE_A))
    }
  })

  it('never exposes the reference through the lifecycle or its authorization seam', () => {
    const clock = fakeClock()
    const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
    lifecycle.install(grant(REFERENCE_A))

    expect(JSON.stringify(lifecycle)).not.toContain('aca_stu_v1_')
    expect(JSON.stringify({ lifecycle })).not.toContain('aca_stu_v1_')
    expect(String(lifecycle)).not.toContain('aca_stu_v1_')
    expect(Object.values(lifecycle).map(String).join('|')).not.toContain('aca_stu_v1_')
    expect(JSON.stringify(lifecycle.authorization)).toBe('{}')
    expect(Object.isFrozen(lifecycle)).toBe(true)
    expect(Object.isFrozen(lifecycle.authorization)).toBe(true)
    // The read seam cannot install, rotate, or clear.
    expect(Object.keys(lifecycle.authorization)).toEqual(['authorizeStudyRequestHeaders'])
    expect(lifecycle.lastClearReason()).toBeNull()
    lifecycle.onIdentitySessionInvalidated({ reason: 'revoked' })
    expect(JSON.stringify(lifecycle.lastClearReason())).not.toContain('aca_stu_v1_')
  })

  it('writes nothing to storage, the URL, history, or the console across a full lifecycle', async () => {
    const written: string[] = []
    const recordingStorage = () => ({
      getItem: () => null,
      setItem: (key: string, value: string) => { written.push(`${key}=${value}`) },
      removeItem: (key: string) => { written.push(`remove:${key}`) },
      clear: () => {},
      key: () => null,
      length: 0,
    })
    const indexedDbOpen = vi.fn(() => { throw new Error('indexedDB must not be used') })
    const pushState = vi.fn()
    const replaceState = vi.fn()
    const logged: unknown[] = []
    const logSpies = (['log', 'info', 'warn', 'error', 'debug'] as const)
      .map((level) => vi.spyOn(console, level).mockImplementation((...args) => { logged.push(...args) }))
    vi.stubGlobal('localStorage', recordingStorage())
    vi.stubGlobal('sessionStorage', recordingStorage())
    vi.stubGlobal('window', { localStorage: recordingStorage(), sessionStorage: recordingStorage() })
    vi.stubGlobal('indexedDB', { open: indexedDbOpen, deleteDatabase: indexedDbOpen })
    vi.stubGlobal('history', { pushState, replaceState })
    try {
      const clock = fakeClock()
      const lifecycle = createStudySessionLifecycle(lifecycleDeps(clock))
      const identity = createStudyIdentityClient(
        identityFetch(REFERENCE_A) as unknown as typeof fetch,
        { onSessionInvalidated: lifecycle.onIdentitySessionInvalidated },
      )
      lifecycle.install(await identity.issueGuardianLaunch({ accessToken: 'g', selectedStudentRef: STUDENT }))
      lifecycle.authorization.authorizeStudyRequestHeaders({ 'content-type': 'application/json' })
      await expect(identity.verify({ requiredCapability: 'student:progress:read' })).rejects.toThrow()
      lifecycle.install(grant(REFERENCE_B))
      clock.advance(ONE_HOUR)
      lifecycle.clear('logout')

      expect(written).toEqual([])
      expect(indexedDbOpen).not.toHaveBeenCalled()
      expect(pushState).not.toHaveBeenCalled()
      expect(replaceState).not.toHaveBeenCalled()
      expect(JSON.stringify(logged)).not.toContain('aca_stu_v1_')
      expect(logged).toEqual([])
    } finally {
      logSpies.forEach((spy) => spy.mockRestore())
      vi.unstubAllGlobals()
    }
  })
})
