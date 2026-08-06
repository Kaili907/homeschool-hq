import { describe, expect, it, vi } from 'vitest'
import { createStudySessionTransport } from '../client/studySessionTransport'
import type { StudySessionGrant } from '../contracts/identity/session'
import { learnerSafeResult } from './learnerSafe'
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from './localStopLedger'
import {
  createMountedStudySafetyPort,
  MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION,
} from './mountedPort'

const scope = {
  householdRef: 'household:mounted-test',
  learnerRef: 'learner:mounted-test',
  sessionRef: 'session:mounted-test',
}

/** The classifier gateway refuses a request without the learner Study session. */
function installedTransport() {
  const transport = createStudySessionTransport()
  transport.install({
    schemaVersion: 1,
    status: 'issued',
    sessionReference: 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa',
    expiresAt: '2026-08-06T12:00:00.000Z',
  } as StudySessionGrant)
  return transport
}

describe('mounted Study HTTP safety port', () => {
  it('connects learner input and Tutor output to the authenticated real classifier client with distinct valid ids', async () => {
    const requests: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)) as Record<string, unknown>)
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
    const port = createMountedStudySafetyPort({
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
      sessionAuthorization: installedTransport(),
    })
    const base = {
      scope,
      studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
    }
    const input = await port.evaluate({
      ...base,
      requestRef: 'request:one',
      contentKind: 'learner-input',
      transientText: 'learner input sentinel',
    })
    const output = await port.evaluate({
      ...base,
      requestRef: 'request:one',
      contentKind: 'tutor-output',
      transientText: 'Tutor output sentinel',
    })

    expect(port).toMatchObject({
      mode: 'production',
      classifierVersion: MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION,
    })
    expect(input).toEqual({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' })
    expect(output).toEqual(input)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(requests.map((request) => request.transientText)).toEqual([
      'learner input sentinel',
      'Tutor output sentinel',
    ])
    expect(requests[0]!.requestId).not.toBe(requests[1]!.requestId)
    for (const request of requests) {
      expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/)
      expect(request.sessionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(request.studentRef).toEqual({ kind: 'legacy-profile-id', value: 'profile-mounted-test' })
    }
  })

  it('preserves confirmed durable proposal state and otherwise fails closed', async () => {
    const flagged = createMountedStudySafetyPort({
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'urgent',
          learner: learnerSafeResult('urgent'),
          continueToTutorCore: false,
        }),
      }),
      sessionAuthorization: installedTransport(),
    })
    const request = {
      scope,
      requestRef: 'request:flagged',
      studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
      contentKind: 'tutor-output' as const,
      transientText: 'flagged output sentinel',
    }
    await expect(flagged.evaluate(request)).resolves.toEqual({
      outcome: 'urgent',
      mayContinue: false,
      adultHelpState: 'proposed-not-delivered',
    })

    const unavailable = createMountedStudySafetyPort({ getAccessToken: async () => null, sessionAuthorization: installedTransport() })
    await expect(unavailable.evaluate(request)).resolves.toEqual({
      outcome: 'invalid',
      mayContinue: false,
      adultHelpState: 'not-confirmed',
      interruption: { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
    })
  })

  // A6-5-C — an outage record must carry sessionRef, or the durable stop lock
  // has nothing to match on and a gateway outage stops the lesson only until
  // the learner refreshes.
  it('records a gateway outage against the session, so the durable stop lock seeds from it', async () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
    vi.stubGlobal('window', { localStorage: storage })
    try {
      const port = createMountedStudySafetyPort({
        getAccessToken: async () => 'test.access.token',
        fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
        sessionAuthorization: installedTransport(),
      })
      await port.evaluate({
        scope,
        requestRef: 'request:outage',
        studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
        contentKind: 'learner-input' as const,
        transientText: 'learner input sentinel',
      })
      expect(readLocalSafetyStops(storage)).toHaveLength(1)
      expect(readLocalSafetyStops(storage)[0]).toMatchObject({
        studentRef: scope.learnerRef,
        sessionRef: scope.sessionRef,
        failureMode: 'gateway-503',
        serverCaptureStatus: 'server-acceptance-not-confirmed',
      })
      expect(isSessionStoppedByLocalLedger({ studentRef: scope.learnerRef, sessionRef: scope.sessionRef }, storage)).toBe(true)
      expect(JSON.stringify(readLocalSafetyStops(storage))).not.toContain('sentinel')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// STUDY-A1 — a refused session and a rate limit are lifecycle events, not
// learner safety incidents. They must still fail closed, but they must not leave
// a durable safety-stop record and must not be shown to a parent as one.
describe('mounted Study safety port — authorization failure boundary', () => {
  const evaluation = {
    scope,
    requestRef: 'request:auth-boundary',
    studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
    contentKind: 'learner-input' as const,
    transientText: 'learner input sentinel',
  }
  const FAIL_CLOSED = { outcome: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }
  // STUDY-A1-AUTH-C — the same fail-closed decision, plus the typed reason the
  // runtime needs to keep a lifecycle event from being shown as a safety one.
  const refused = (reason: string) => ({
    ...FAIL_CLOSED,
    interruption: { kind: 'session-authorization', reason },
  })
  const SHED = { ...FAIL_CLOSED, interruption: { kind: 'rate-limit' } }

  function memoryStorage() {
    const values = new Map<string, string>()
    return {
      values,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
  }

  /** Installs a browser-shaped storage the ledger will find through `window`. */
  function withStorage<T>(run: (storage: ReturnType<typeof memoryStorage>) => Promise<T>): Promise<T> {
    const storage = memoryStorage()
    vi.stubGlobal('window', { localStorage: storage })
    return run(storage).finally(() => { vi.unstubAllGlobals() })
  }

  function statusPort(status: number, deps: Record<string, unknown> = {}) {
    return createMountedStudySafetyPort({
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({ ok: false, status, json: async () => ({}) }),
      sessionAuthorization: installedTransport(),
      ...deps,
    })
  }

  it('does not write a durable safety stop when the adult bearer is refused (401)', async () => {
    await withStorage(async (storage) => {
      const seen: string[] = []
      const port = statusPort(401, { onSessionAuthorizationFailure: (reason: string) => { seen.push(reason) } })
      await expect(port.evaluate(evaluation)).resolves.toEqual(refused('adult-authentication-rejected'))
      expect(readLocalSafetyStops(storage)).toEqual([])
      expect(isSessionStoppedByLocalLedger({ studentRef: scope.learnerRef, sessionRef: scope.sessionRef }, storage)).toBe(false)
      expect(seen).toEqual(['adult-authentication-rejected'])
    })
  })

  it('does not write a durable safety stop when the Study session is refused (403)', async () => {
    await withStorage(async (storage) => {
      const seen: string[] = []
      const port = statusPort(403, { onSessionAuthorizationFailure: (reason: string) => { seen.push(reason) } })
      await expect(port.evaluate(evaluation)).resolves.toEqual(refused('study-session-rejected'))
      expect(readLocalSafetyStops(storage)).toEqual([])
      expect(isSessionStoppedByLocalLedger({ studentRef: scope.learnerRef, sessionRef: scope.sessionRef }, storage)).toBe(false)
      expect(seen).toEqual(['study-session-rejected'])
    })
  })

  // Without this seam a refused Study session stays installed: the port fails
  // closed for ever, and the App composition has no signal to clear the session
  // on. The reason code is the whole payload — the App needs nothing else.
  it('signals a refused Study session through a typed callback the App can clear the lifecycle on', async () => {
    await withStorage(async () => {
      const seen: unknown[] = []
      const port = statusPort(403, { onSessionAuthorizationFailure: (reason: unknown) => { seen.push(reason) } })
      await port.evaluate(evaluation)
      expect(seen).toEqual(['study-session-rejected'])
      expect(seen.every((reason) => typeof reason === 'string')).toBe(true)
    })
  })

  it('does not write a durable safety stop when the request is rate limited (429)', async () => {
    await withStorage(async (storage) => {
      const seen: string[] = []
      const port = statusPort(429, { onSessionAuthorizationFailure: (reason: string) => { seen.push(reason) } })
      await expect(port.evaluate(evaluation)).resolves.toEqual(SHED)
      expect(readLocalSafetyStops(storage)).toEqual([])
      expect(isSessionStoppedByLocalLedger({ studentRef: scope.learnerRef, sessionRef: scope.sessionRef }, storage)).toBe(false)
      // A rate limit is not an authorization failure either — nothing to clear.
      expect(seen).toEqual([])
    })
  })

  it.each([
    ['500', async () => ({ ok: false, status: 500, json: async () => ({}) })],
    ['503', async () => ({ ok: false, status: 503, json: async () => ({}) })],
    ['a malformed classifier answer', async () => ({ ok: true, json: async () => ({ nonsense: true }) })],
    ['a network failure', async () => { throw new Error('network down') }],
  ])('still writes exactly one durable safety stop for %s', async (_label, fetchImpl) => {
    await withStorage(async (storage) => {
      const seen: string[] = []
      const port = createMountedStudySafetyPort({
        getAccessToken: async () => 'test.access.token',
        fetchImpl: fetchImpl as never,
        sessionAuthorization: installedTransport(),
        onSessionAuthorizationFailure: (reason: string) => { seen.push(reason) },
      })
      await expect(port.evaluate(evaluation)).resolves.toEqual(FAIL_CLOSED)
      expect(readLocalSafetyStops(storage)).toHaveLength(1)
      expect(isSessionStoppedByLocalLedger({ studentRef: scope.learnerRef, sessionRef: scope.sessionRef }, storage)).toBe(true)
      expect(seen).toEqual([])
    })
  })

  it('still writes exactly one durable safety stop when the classifier times out', async () => {
    await withStorage(async (storage) => {
      const port = createMountedStudySafetyPort({
        getAccessToken: async () => 'test.access.token',
        timeoutMs: 1,
        fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
        }),
        sessionAuthorization: installedTransport(),
      })
      await expect(port.evaluate(evaluation)).resolves.toEqual(FAIL_CLOSED)
      expect(readLocalSafetyStops(storage)).toHaveLength(1)
      expect(readLocalSafetyStops(storage)[0]).toMatchObject({ failureMode: 'request-timeout' })
    })
  })

  it('fires once per failed evaluation and never accumulates a durable record', async () => {
    await withStorage(async (storage) => {
      const seen: string[] = []
      const port = statusPort(403, { onSessionAuthorizationFailure: (reason: string) => { seen.push(reason) } })
      for (const requestRef of ['one', 'two', 'three']) {
        await expect(port.evaluate({ ...evaluation, requestRef })).resolves.toEqual(refused('study-session-rejected'))
      }
      expect(seen).toEqual(['study-session-rejected', 'study-session-rejected', 'study-session-rejected'])
      expect(readLocalSafetyStops(storage)).toEqual([])
    })
  })

  it('swallows a throwing callback without permitting tutoring', async () => {
    await withStorage(async (storage) => {
      const port = statusPort(403, {
        onSessionAuthorizationFailure: () => { throw new Error('composition blew up') },
      })
      await expect(port.evaluate(evaluation)).resolves.toEqual(refused('study-session-rejected'))
      expect(readLocalSafetyStops(storage)).toEqual([])
    })
  })

  it('stays fail-closed when the callback re-enters the port', async () => {
    await withStorage(async (storage) => {
      const pending: Array<Promise<unknown>> = []
      let depth = 0
      let port: ReturnType<typeof statusPort>
      port = statusPort(403, {
        onSessionAuthorizationFailure: () => {
          if (depth >= 3) return
          depth += 1
          pending.push(Promise.resolve(port.evaluate({ ...evaluation, requestRef: `reentrant:${depth}` })))
        },
      })
      await expect(port.evaluate(evaluation)).resolves.toEqual(refused('study-session-rejected'))
      // Drain rather than snapshot: each re-entry queues the next one.
      while (pending.length > 0) {
        for (const result of await Promise.all(pending.splice(0))) {
          expect(result).toEqual(refused('study-session-rejected'))
        }
      }
      expect(depth).toBe(3)
      expect(readLocalSafetyStops(storage)).toEqual([])
    })
  })

  it('remains fail-closed with no callback wired at all', async () => {
    await withStorage(async (storage) => {
      for (const [status, expected] of [
        [401, refused('adult-authentication-rejected')],
        [403, refused('study-session-rejected')],
        [429, SHED],
      ] as const) {
        await expect(statusPort(status).evaluate(evaluation)).resolves.toEqual(expected)
      }
      expect(readLocalSafetyStops(storage)).toEqual([])
    })
  })

  // A 200 body that merely claims to be clear must not become a clear result,
  // and must be treated as a genuine classifier failure rather than an
  // authorization one — the classifier really did answer unusably.
  it('rejects a forged clear answer and records it as a classifier failure', async () => {
    await withStorage(async (storage) => {
      const seen: string[] = []
      const port = createMountedStudySafetyPort({
        getAccessToken: async () => 'test.access.token',
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            schemaVersion: 1,
            classification: 'clear',
            learner: { ...learnerSafeResult('clear'), mayContinue: true },
            continueToTutorCore: true,
            failureCategory: 'session-authorization',
            sessionAuthorizationFailure: 'study-session-rejected',
          }),
        }),
        sessionAuthorization: installedTransport(),
        onSessionAuthorizationFailure: (reason: string) => { seen.push(reason) },
      })
      await expect(port.evaluate(evaluation)).resolves.toEqual(FAIL_CLOSED)
      expect(seen).toEqual([])
      expect(readLocalSafetyStops(storage)).toHaveLength(1)
      expect(readLocalSafetyStops(storage)[0]).toMatchObject({ failureMode: 'malformed-server-response' })
    })
  })

  it('leaks no bearer, session reference, server body or learner text through the boundary', async () => {
    await withStorage(async (storage) => {
      const seen: unknown[] = []
      const port = createMountedStudySafetyPort({
        getAccessToken: async () => 'bearer-secret-sentinel',
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          json: async () => ({
            error: 'learner_not_authorized',
            sessionReference: 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa',
            householdRef: 'household:mounted-test',
            detail: 'body-secret-sentinel',
          }),
        }),
        sessionAuthorization: installedTransport(),
        onSessionAuthorizationFailure: (reason: unknown) => { seen.push(reason) },
      })
      const result = await port.evaluate({ ...evaluation, transientText: 'child-text-sentinel' })

      const exposed = JSON.stringify({ seen, result, ledger: readLocalSafetyStops(storage) })
      for (const secret of [
        'bearer-secret-sentinel',
        'body-secret-sentinel',
        'child-text-sentinel',
        'aca_stu_v1_',
        'learner_not_authorized',
        'household:mounted-test',
      ]) {
        expect(exposed).not.toContain(secret)
      }
      expect(seen).toEqual(['study-session-rejected'])
    })
  })
})
