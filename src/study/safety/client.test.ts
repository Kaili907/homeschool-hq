import { describe, expect, it, vi } from 'vitest'
import { createStudySessionTransport } from '../client/studySessionTransport'
import type { StudySessionGrant } from '../contracts/identity/session'
import type { StudySafetyClassificationRequestV1 } from '../contracts/safety'
import {
  classifyStudySafety,
  classifyStudySafetyWithCaptureStatus,
  STUDY_SAFETY_ENDPOINT,
  type StudySafetyClientDeps,
} from './client'
import { learnerSafeResult } from './learnerSafe'

const request: StudySafetyClassificationRequestV1 = {
  schemaVersion: 1,
  requestId: '22222222-2222-4222-8222-222222222222',
  studentRef: { kind: 'academy-student-id', value: '44444444-4444-4444-8444-444444444444' },
  sessionId: '55555555-5555-4555-8555-555555555555',
  transientText: 'synthetic learner text',
}

const SESSION_REFERENCE = 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa'
const ROTATED_REFERENCE = 'aca_stu_v1_rotated-study-session-reference-bbbbbbbbbbb'

function grant(sessionReference: string): StudySessionGrant {
  return {
    schemaVersion: 1,
    status: 'issued',
    sessionReference,
    expiresAt: '2026-08-06T12:00:00.000Z',
  } as StudySessionGrant
}

/** A transport holding a verified reference, as the issue path would leave it. */
function installedTransport(sessionReference: string = SESSION_REFERENCE) {
  const transport = createStudySessionTransport()
  transport.install(grant(sessionReference))
  return transport
}

const clearResponse = {
  schemaVersion: 1,
  classification: 'clear',
  learner: learnerSafeResult('clear'),
  continueToTutorCore: true,
}

describe('narrow Study safety browser adapter', () => {
  it('sends one same-origin transient request with host auth, no cookies, no referrer, and no retry', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        classification: 'clear',
        learner: learnerSafeResult('clear'),
        continueToTutorCore: true,
      }),
    }))
    const result = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
      sessionAuthorization: installedTransport(),
    })
    expect(result.classification).toBe('clear')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(STUDY_SAFETY_ENDPOINT)
    expect(init.credentials).toBe('omit')
    expect(init.referrerPolicy).toBe('no-referrer')
    expect(init.cache).toBe('no-store')
    expect(init.headers).toEqual({ Authorization: 'Bearer test.access.token', 'content-type': 'application/json', 'x-study-session': SESSION_REFERENCE })
    expect(init.body).toBe(JSON.stringify(request))
    expect(init.body).not.toContain('provider')
    expect(init.body).not.toContain('aca_stu_v1_')
  })

  it('fails closed for missing auth, network failure, timeout, and malformed responses', async () => {
    const missing = await classifyStudySafety(request, { getAccessToken: async () => null, sessionAuthorization: installedTransport() })
    expect(missing).toMatchObject({ classification: 'invalid', continueToTutorCore: false })

    const networkFetch = vi.fn(async () => { throw new Error('network and provider internals') })
    const network = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: networkFetch,
      sessionAuthorization: installedTransport(),
    })
    expect(network).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
    expect(JSON.stringify(network)).not.toContain('provider internals')
    expect(networkFetch).toHaveBeenCalledTimes(1)

    const malformed = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({ ok: true, json: async () => ({ classification: 'clear', recipient: 'hidden' }) }),
      sessionAuthorization: installedTransport(),
    })
    expect(malformed).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
  })

  it('rejects extra adult/provider details and arbitrary learner messages', async () => {
    for (const extra of [
      { recipientRef: 'recipient:hidden' },
      { classifierVersion: 'provider-model' },
      { reasonCodes: ['hidden'] },
      { adultReviewProposalId: 'hidden' },
    ]) {
      const result = await classifyStudySafety(request, {
        getAccessToken: async () => 'test.access.token',
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            schemaVersion: 1,
            classification: 'clear',
            learner: learnerSafeResult('clear'),
            continueToTutorCore: true,
            ...extra,
          }),
        }),
        sessionAuthorization: installedTransport(),
      })
      expect(result.classification).toBe('invalid')
    }

    const arbitraryMessage = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'urgent',
          learner: { ...learnerSafeResult('urgent'), message: 'A provider says a message was delivered.' },
          continueToTutorCore: false,
        }),
      }),
      sessionAuthorization: installedTransport(),
    })
    expect(arbitraryMessage.classification).toBe('invalid')
  })

  // RED PROOF (STUDY-A1): the server-side safety authorizer reads the learner's
  // opaque Study-session reference from `x-study-session`, and refuses the
  // request without it. The seam here is an inline literal on purpose: this test
  // must fail on the baseline for the behavioral defect, not for a missing module.
  it('sends the learner Study-session reference in x-study-session on the safety request', async () => {
    const sessionReference = 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa'
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        classification: 'clear',
        learner: learnerSafeResult('clear'),
        continueToTutorCore: true,
      }),
    }))
    await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
      sessionAuthorization: {
        authorizeStudyRequestHeaders: (headers) => ({ ...headers, 'x-study-session': sessionReference }),
      },
    })
    const [, init] = fetchImpl.mock.calls[0]!
    expect((init.headers as Record<string, string>)['x-study-session']).toBe(sessionReference)
  })

  it('honors host lifecycle cancellation before and during the request', async () => {
    const alreadyCancelled = new AbortController()
    alreadyCancelled.abort('learner-switch')
    const neverCalled = vi.fn()
    const first = await classifyStudySafety(request, {
      signal: alreadyCancelled.signal,
      getAccessToken: async () => 'test.access.token',
      fetchImpl: neverCalled,
      sessionAuthorization: installedTransport(),
    })
    expect(first).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
    expect(neverCalled).not.toHaveBeenCalled()

    const active = new AbortController()
    let notifyStarted!: () => void
    const started = new Promise<void>((resolve) => { notifyStarted = resolve })
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => new Promise<never>((_resolve, reject) => {
      notifyStarted()
      init.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
    }))
    const pending = classifyStudySafety(request, {
      signal: active.signal,
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
      sessionAuthorization: installedTransport(),
    })
    await started
    active.abort('logout')
    expect(await pending).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fails closed before any network activity when the reference is missing, malformed, or cleared', async () => {
    const neverCalled = vi.fn()

    const noSeam = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: neverCalled,
    })
    expect(noSeam).toMatchObject({ classification: 'invalid', continueToTutorCore: false })

    const emptyTransport = createStudySessionTransport()
    const notInstalled = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: neverCalled,
      sessionAuthorization: emptyTransport,
    })
    expect(notInstalled).toMatchObject({ classification: 'invalid', continueToTutorCore: false })

    // A malformed reference is refused at install, so the transport that reaches
    // the safety client is empty and the request never leaves the browser.
    const malformedTransport = createStudySessionTransport()
    expect(() => malformedTransport.install(grant('not-a-study-session'))).toThrow()
    const malformed = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: neverCalled,
      sessionAuthorization: malformedTransport,
    })
    expect(malformed).toMatchObject({ classification: 'invalid', continueToTutorCore: false })

    const cleared = installedTransport()
    cleared.clear()
    const afterClear = await classifyStudySafety(request, {
      getAccessToken: async () => 'test.access.token',
      fetchImpl: neverCalled,
      sessionAuthorization: cleared,
    })
    expect(afterClear).toMatchObject({ classification: 'invalid', continueToTutorCore: false })

    expect(neverCalled).not.toHaveBeenCalled()
    expect(JSON.stringify([noSeam, notInstalled, malformed, afterClear])).not.toContain('aca_stu_v1_')
  })

  it('stops reusing a cleared reference and sends the rotated one after rotation', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => clearResponse }))
    const transport = installedTransport()
    const deps = { getAccessToken: async () => 'test.access.token', fetchImpl, sessionAuthorization: transport }

    await classifyStudySafety(request, deps)
    transport.clear()
    const afterClear = await classifyStudySafety(request, deps)
    expect(afterClear).toMatchObject({ classification: 'invalid', continueToTutorCore: false })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    transport.install(grant(ROTATED_REFERENCE))
    await classifyStudySafety(request, deps)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const headers = fetchImpl.mock.calls.map(([, init]) => (init.headers as Record<string, string>)['x-study-session'])
    expect(headers).toEqual([SESSION_REFERENCE, ROTATED_REFERENCE])
  })

  it('keeps the reference intact and unexposed across duplicate concurrent safety calls', async () => {
    const seen: Array<Record<string, string>> = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      seen.push(headers)
      // Mutating the headers handed to fetch must not reach the transport.
      headers['x-study-session'] = 'tampered'
      await gate
      return { ok: true, json: async () => clearResponse }
    })
    const transport = installedTransport()
    const deps = { getAccessToken: async () => 'test.access.token', fetchImpl, sessionAuthorization: transport }

    const both = Promise.all([classifyStudySafety(request, deps), classifyStudySafety(request, deps)])
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    release()
    for (const result of await both) expect(result.classification).toBe('clear')

    expect(seen[0]).not.toBe(seen[1])
    expect(transport.hasSession()).toBe(true)
    expect(transport.authorizeStudyRequestHeaders({})).toEqual({ 'x-study-session': SESSION_REFERENCE })
  })
})

describe('session authorization failure versus classifier failure', () => {
  const deps = (fetchImpl: unknown): StudySafetyClientDeps => ({
    getAccessToken: async () => 'test.access.token',
    fetchImpl: fetchImpl as StudySafetyClientDeps['fetchImpl'],
    sessionAuthorization: installedTransport(),
  })

  it('reports an expired or revoked Study session as a session-authorization failure', async () => {
    // The gateway answers 403 learner_not_authorized when the session reference
    // is missing, expired, revoked, or unauthorized, and 401 when the adult
    // bearer is refused. Neither is a safety classification.
    for (const status of [401, 403]) {
      const result = await classifyStudySafetyWithCaptureStatus(
        request,
        deps(vi.fn(async () => ({ ok: false, status, json: async () => ({}) }))),
      )
      expect(result.failureCategory).toBe('session-authorization')
      expect(result.failureMode).toBe('authentication-failure')
      expect(result.failureMode).not.toBe('classifier-unreachable')
      // Still fail closed: neither may continue tutoring.
      expect(result.response.classification).toBe('invalid')
      expect(result.response.continueToTutorCore).toBe(false)
      expect(result.response.learner.mayContinue).toBe(false)
    }
  })

  it('reports missing host auth and a missing Study session as session-authorization failures', async () => {
    const unreached = vi.fn(async () => ({ ok: true, json: async () => clearResponse }))
    for (const overrides of [
      { getAccessToken: async () => null },
      { getAccessToken: async () => { throw new Error('token store unavailable') } },
      { sessionAuthorization: undefined },
      { sessionAuthorization: createStudySessionTransport() },
    ]) {
      const result = await classifyStudySafetyWithCaptureStatus(request, {
        ...deps(unreached),
        ...overrides,
      })
      expect(result.failureCategory).toBe('session-authorization')
      expect(result.serverCaptureStatus).toBe('server-not-contacted')
      expect(result.response.continueToTutorCore).toBe(false)
    }
    expect(unreached).not.toHaveBeenCalled()
  })

  it('keeps genuine classifier failures categorised as classifier failures', async () => {
    const cases: Array<[unknown, string]> = [
      [vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })), 'gateway-503'],
      [vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })), 'classifier-unreachable'],
      [vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })), 'classifier-unreachable'],
      [vi.fn(async () => ({ ok: true, json: async () => ({ nonsense: true }) })), 'malformed-server-response'],
      [vi.fn(async () => { throw new Error('network down') }), 'network-failure-mid-request'],
    ]
    for (const [fetchImpl, failureMode] of cases) {
      const result = await classifyStudySafetyWithCaptureStatus(request, deps(fetchImpl))
      expect(result.failureCategory).toBe('classifier')
      expect(result.failureMode).toBe(failureMode)
      expect(result.response.continueToTutorCore).toBe(false)
    }
  })

  it('leaves a successful classification uncategorised', async () => {
    const result = await classifyStudySafetyWithCaptureStatus(
      request,
      deps(vi.fn(async () => ({ ok: true, json: async () => clearResponse }))),
    )
    expect(result.failureCategory).toBeUndefined()
    expect(result.failureMode).toBeUndefined()
    expect(result.response.classification).toBe('clear')
  })
})
