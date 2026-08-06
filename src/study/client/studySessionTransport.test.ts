import { describe, expect, it, vi } from 'vitest'
import type { StudySessionGrant } from '../contracts/identity/session'
import { classifyStudySafety } from '../safety/client'
import { learnerSafeResult } from '../safety/learnerSafe'
import { createStudyIdentityClient } from './studyIdentityClient'
import {
  createStudySessionTransport,
  STUDY_SESSION_HEADER,
  StudySessionTransportError,
} from './studySessionTransport'

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

const safetyRequest = {
  schemaVersion: 1,
  requestId: '22222222-2222-4222-8222-222222222222',
  studentRef: { kind: 'academy-student-id', value: '44444444-4444-4444-8444-444444444444' },
  sessionId: '55555555-5555-4555-8555-555555555555',
  transientText: 'synthetic learner text',
} as const

describe('ephemeral Study session transport', () => {
  it('installs a verified reference and reads it only when authorizing a request', () => {
    const transport = createStudySessionTransport()
    expect(transport.hasSession()).toBe(false)
    expect(transport.authorizeStudyRequestHeaders({ 'content-type': 'application/json' })).toBeNull()

    transport.install(grant(SESSION_REFERENCE))
    expect(transport.hasSession()).toBe(true)
    expect(transport.authorizeStudyRequestHeaders({ 'content-type': 'application/json' })).toEqual({
      'content-type': 'application/json',
      [STUDY_SESSION_HEADER]: SESSION_REFERENCE,
    })
  })

  it('refuses malformed references without disclosing them and without keeping a previous session', () => {
    const transport = createStudySessionTransport()
    transport.install(grant(SESSION_REFERENCE))

    for (const malformed of [
      'not-a-study-session',
      'aca_stu_v1_tooshort',
      `${SESSION_REFERENCE}, ${ROTATED_REFERENCE}`,
      `${SESSION_REFERENCE}x`,
      '',
    ]) {
      let thrown: unknown
      try {
        transport.install(grant(malformed))
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(StudySessionTransportError)
      expect((thrown as StudySessionTransportError).code).toBe('study-session-reference-invalid')
      expect(String(thrown)).not.toContain('aca_stu_v1_')
      expect(String(thrown)).not.toContain('synthetic-study-session-reference')
      expect(JSON.stringify({ error: String(thrown), stack: (thrown as Error).stack })).not.toContain('aca_stu_v1_')
      // A refused rotation must not leave the previous session live.
      expect(transport.hasSession()).toBe(false)
      expect(transport.authorizeStudyRequestHeaders({})).toBeNull()
      transport.install(grant(SESSION_REFERENCE))
    }

    for (const invalidShape of [null, undefined, 'aca_stu_v1_', { sessionReference: SESSION_REFERENCE }, { ...grant(SESSION_REFERENCE), extra: 'x' }]) {
      expect(() => transport.install(invalidShape as unknown as StudySessionGrant))
        .toThrow(StudySessionTransportError)
      expect(transport.hasSession()).toBe(false)
      transport.install(grant(SESSION_REFERENCE))
    }
  })

  it('clears the reference so it cannot be reused, and rotation replaces the previous one', () => {
    const transport = createStudySessionTransport()
    transport.install(grant(SESSION_REFERENCE))
    transport.clear()
    expect(transport.hasSession()).toBe(false)
    expect(transport.authorizeStudyRequestHeaders({})).toBeNull()

    transport.install(grant(SESSION_REFERENCE))
    transport.install(grant(ROTATED_REFERENCE))
    expect(transport.authorizeStudyRequestHeaders({})).toEqual({ [STUDY_SESSION_HEADER]: ROTATED_REFERENCE })
    expect(JSON.stringify(transport.authorizeStudyRequestHeaders({}))).not.toContain(SESSION_REFERENCE)
  })

  it('never exposes the reference through the transport object itself', () => {
    const transport = createStudySessionTransport()
    transport.install(grant(SESSION_REFERENCE))

    expect(JSON.stringify(transport)).toBe('{}')
    expect(JSON.stringify({ transport })).not.toContain('aca_stu_v1_')
    expect(Object.values(transport).map(String).join('|')).not.toContain('aca_stu_v1_')
    expect(String(transport)).not.toContain('aca_stu_v1_')
    expect(Object.isFrozen(transport)).toBe(true)
    // Each authorized request gets its own header map, so one caller can never
    // mutate another caller's headers or the transport's own state.
    const first = transport.authorizeStudyRequestHeaders({})!
    const second = transport.authorizeStudyRequestHeaders({})!
    expect(first).not.toBe(second)
    first[STUDY_SESSION_HEADER] = 'tampered'
    expect(transport.authorizeStudyRequestHeaders({})).toEqual({ [STUDY_SESSION_HEADER]: SESSION_REFERENCE })
    // A caller cannot smuggle its own session header past the transport.
    expect(transport.authorizeStudyRequestHeaders({ [STUDY_SESSION_HEADER]: 'forged' })).toEqual({
      [STUDY_SESSION_HEADER]: SESSION_REFERENCE,
    })
  })

  it('strips caller session headers in any case and returns exactly one canonical header', () => {
    const transport = createStudySessionTransport()
    transport.install(grant(SESSION_REFERENCE))

    for (const variant of [
      'X-Study-Session', 'X-STUDY-SESSION', 'x-Study-Session', 'X-study-SESSION', 'x-study-session',
    ]) {
      const headers = transport.authorizeStudyRequestHeaders({
        [variant]: 'forged-by-caller',
        'content-type': 'application/json',
        Authorization: 'Bearer host-adult-token',
      })!
      // Header names are case-insensitive on the wire, so a surviving variant
      // would be combined with the canonical one and refused by the gateway.
      expect(Object.keys(headers).filter((key) => key.toLowerCase() === STUDY_SESSION_HEADER))
        .toEqual([STUDY_SESSION_HEADER])
      expect(headers[STUDY_SESSION_HEADER]).toBe(SESSION_REFERENCE)
      expect(JSON.stringify(headers)).not.toContain('forged-by-caller')
      // Unrelated headers are untouched.
      expect(headers['content-type']).toBe('application/json')
      expect(headers.Authorization).toBe('Bearer host-adult-token')
    }

    // Several variants at once, and a header key that must not reach a prototype.
    const headers = transport.authorizeStudyRequestHeaders({
      'X-Study-Session': 'a', 'x-STUDY-session': 'b', 'X-Study-Session-Id': 'unrelated', __proto__: 'c',
    })!
    expect(Object.keys(headers).filter((key) => key.toLowerCase() === STUDY_SESSION_HEADER))
      .toEqual([STUDY_SESSION_HEADER])
    expect(headers[STUDY_SESSION_HEADER]).toBe(SESSION_REFERENCE)
    expect(headers['X-Study-Session-Id']).toBe('unrelated')
    expect(Object.getPrototypeOf(headers)).toBe(Object.prototype)
    expect(JSON.stringify(headers)).not.toContain('"a"')
    expect(JSON.stringify(headers)).not.toContain('"b"')
  })

  it('leaves unrelated Study requests unchanged', async () => {
    const transport = createStudySessionTransport()
    const fetchBefore = globalThis.fetch
    transport.install(grant(SESSION_REFERENCE))
    // The transport authorizes explicitly; it never patches global fetch.
    expect(globalThis.fetch).toBe(fetchBefore)

    const identityFetch = vi.fn(async () => new Response(
      JSON.stringify({ schemaVersion: 1, status: 'issued', sessionReference: ROTATED_REFERENCE, expiresAt: '2026-08-06T12:00:00.000Z' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const identity = createStudyIdentityClient(identityFetch as unknown as typeof fetch)
    await identity.issueGuardianLaunch({
      accessToken: 'test.access.token',
      selectedStudentRef: { kind: 'academy-student-id', value: '44444444-4444-4444-8444-444444444444' },
    })
    const [, init] = (identityFetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!
    expect(Object.keys(init.headers as Record<string, string>)).toEqual(['Authorization', 'content-type'])
    expect(JSON.stringify(init.headers)).not.toContain(STUDY_SESSION_HEADER)
    expect(JSON.stringify(init.headers)).not.toContain(SESSION_REFERENCE)
  })

  it('never writes the reference to localStorage, sessionStorage, IndexedDB, the URL, or history', async () => {
    const written: string[] = []
    const recordingStorage = () => ({
      getItem: () => null,
      setItem: (key: string, value: string) => { written.push(`${key}=${value}`) },
      removeItem: (key: string) => { written.push(`remove:${key}`) },
      clear: () => {},
      key: () => null,
      length: 0,
    })
    const indexedDbOpen = vi.fn(() => { throw new Error('indexedDB must not be used for the session reference') })
    const pushState = vi.fn()
    const replaceState = vi.fn()
    vi.stubGlobal('localStorage', recordingStorage())
    vi.stubGlobal('sessionStorage', recordingStorage())
    vi.stubGlobal('window', { localStorage: recordingStorage(), sessionStorage: recordingStorage() })
    vi.stubGlobal('indexedDB', { open: indexedDbOpen, deleteDatabase: indexedDbOpen })
    vi.stubGlobal('history', { pushState, replaceState })
    try {
      const transport = createStudySessionTransport()
      transport.install(grant(SESSION_REFERENCE))
      transport.install(grant(ROTATED_REFERENCE))
      transport.authorizeStudyRequestHeaders({ 'content-type': 'application/json' })

      const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'clear',
          learner: learnerSafeResult('clear'),
          continueToTutorCore: true,
        }),
      }))
      await classifyStudySafety(safetyRequest, {
        getAccessToken: async () => 'test.access.token',
        fetchImpl,
        sessionAuthorization: transport,
      })
      transport.clear()

      const [url] = fetchImpl.mock.calls[0]!
      expect(url).toBe('/api/study/safety/classify')
      expect(url).not.toContain('?')
      expect(url).not.toContain('aca_stu_v1_')
      expect(written.join('|')).not.toContain('aca_stu_v1_')
      expect(written).toEqual([])
      expect(indexedDbOpen).not.toHaveBeenCalled()
      expect(pushState).not.toHaveBeenCalled()
      expect(replaceState).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
