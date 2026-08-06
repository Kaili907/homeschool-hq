import { inspect } from 'node:util'
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

/**
 * Grants whose own enumerable properties throw the instant they are read. A
 * network response cannot carry one, but any caller-supplied object can, and
 * installation reads the grant before it can know which kind it holds.
 */
function throwingGrants(): Record<string, StudySessionGrant> {
  return {
    'sessionReference getter throws': {
      schemaVersion: 1,
      status: 'issued',
      get sessionReference(): string { throw new Error('hostile sessionReference accessor') },
      expiresAt: '2026-08-06T12:00:00.000Z',
    },
    'expiresAt getter throws': {
      schemaVersion: 1,
      status: 'issued',
      sessionReference: ROTATED_REFERENCE,
      get expiresAt(): string { throw new Error('hostile expiresAt accessor') },
    },
    'additional enumerable getter throws': {
      schemaVersion: 1,
      status: 'issued',
      sessionReference: ROTATED_REFERENCE,
      expiresAt: '2026-08-06T12:00:00.000Z',
      get extra(): string { throw new Error('hostile extra accessor') },
    },
  } as unknown as Record<string, StudySessionGrant>
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

  it('returns the validated expiry as non-secret metadata, reading the grant once', () => {
    const transport = createStudySessionTransport()
    const installed = transport.install(grant(SESSION_REFERENCE))

    expect(installed).toEqual({ expiresAtMs: Date.parse('2026-08-06T12:00:00.000Z') })
    expect(Object.keys(installed)).toEqual(['expiresAtMs'])
    expect(Object.isFrozen(installed)).toBe(true)
    expect(JSON.stringify(installed)).not.toContain('aca_stu_v1_')
    expect(JSON.stringify(installed)).not.toContain(SESSION_REFERENCE)

    // A grant whose `expiresAt` is an accessor gets one honest answer and then
    // claims a far longer life. Because the fields are copied once before the
    // canonical parser runs, the value that passed validation is the value
    // returned, and no second read can widen it.
    let reads = 0
    const accessorGrant = {
      schemaVersion: 1,
      status: 'issued',
      sessionReference: ROTATED_REFERENCE,
      get expiresAt() {
        reads += 1
        return reads <= 1 ? '2026-08-06T12:00:00.000Z' : '2099-01-01T00:00:00.000Z'
      },
    } as unknown as StudySessionGrant

    expect(transport.install(accessorGrant))
      .toEqual({ expiresAtMs: Date.parse('2026-08-06T12:00:00.000Z') })
    expect(reads).toBe(1)
    expect(transport.authorizeStudyRequestHeaders({})).toEqual({
      [STUDY_SESSION_HEADER]: ROTATED_REFERENCE,
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

    // Several variants at once, plus a header key that must not reach a
    // prototype. It has to be built by JSON.parse: in an object literal
    // `__proto__: 'c'` sets the prototype rather than defining a key, so a
    // literal cannot express an own `__proto__` property and would leave this
    // hazard untested. A header map decoded from a response body can.
    const hostile = JSON.parse(
      '{"X-Study-Session":"a","x-STUDY-session":"b","X-Study-Session-Id":"unrelated","__proto__":"c"}',
    ) as Record<string, string>
    expect(Object.hasOwn(hostile, '__proto__')).toBe(true)

    const headers = transport.authorizeStudyRequestHeaders(hostile)!
    expect(Object.keys(headers).filter((key) => key.toLowerCase() === STUDY_SESSION_HEADER))
      .toEqual([STUDY_SESSION_HEADER])
    expect(headers[STUDY_SESSION_HEADER]).toBe(SESSION_REFERENCE)
    expect(headers['X-Study-Session-Id']).toBe('unrelated')
    expect(JSON.stringify(headers)).not.toContain('"a"')
    expect(JSON.stringify(headers)).not.toContain('"b"')

    // The key was defined, not assigned: this object keeps an ordinary
    // prototype and carries `__proto__` as plain data.
    expect(Object.getPrototypeOf(headers)).toBe(Object.prototype)
    expect(Object.hasOwn(headers, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(headers, '__proto__')).toMatchObject({
      value: 'c',
      enumerable: true,
      writable: true,
    })
    // Nothing leaked onto the shared prototype every other object reads from.
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
    expect(Object.hasOwn(Object.prototype, 'X-Study-Session')).toBe(false)
    expect((({}) as Record<string, unknown>)['X-Study-Session-Id']).toBeUndefined()
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

describe('ephemeral Study session transport — grants that throw while being read', () => {
  it('invalidates the installed reference before reading a throwing grant at all', () => {
    for (const [label, hostile] of Object.entries(throwingGrants())) {
      const transport = createStudySessionTransport()
      transport.install(grant(SESSION_REFERENCE))
      expect(transport.hasSession(), label).toBe(true)

      // Reading the grant is what fails, so the previous reference has to be
      // gone before the first property is touched. Otherwise a refused
      // rotation leaves a session live that no caller believes is installed.
      expect(() => transport.install(hostile), label).toThrow()
      expect(transport.hasSession(), label).toBe(false)
      expect(transport.authorizeStudyRequestHeaders({}), label).toBeNull()
    }
  })

  it('stays empty across repeated refusals and still accepts a later valid grant', () => {
    const transport = createStudySessionTransport()
    transport.install(grant(SESSION_REFERENCE))

    for (let attempt = 0; attempt < 3; attempt += 1) {
      for (const hostile of Object.values(throwingGrants())) {
        expect(() => transport.install(hostile)).toThrow()
        expect(transport.hasSession()).toBe(false)
        expect(transport.authorizeStudyRequestHeaders({})).toBeNull()
      }
    }

    // The refusals are not a wedged state: a genuine grant still installs.
    expect(transport.install(grant(ROTATED_REFERENCE)))
      .toEqual({ expiresAtMs: Date.parse('2026-08-06T12:00:00.000Z') })
    expect(transport.authorizeStudyRequestHeaders({}))
      .toEqual({ [STUDY_SESSION_HEADER]: ROTATED_REFERENCE })
  })

  it('discloses no previous reference through the throw or the transport afterwards', () => {
    for (const [label, hostile] of Object.entries(throwingGrants())) {
      const transport = createStudySessionTransport()
      transport.install(grant(SESSION_REFERENCE))

      let thrown: unknown
      try {
        transport.install(hostile)
      } catch (error) {
        thrown = error
      }
      expect(thrown, label).toBeInstanceOf(Error)

      const descriptors = Object.getOwnPropertyDescriptors(transport)
      for (const surface of [
        String(thrown),
        (thrown as Error).stack ?? '',
        JSON.stringify({ error: String(thrown), stack: (thrown as Error).stack }),
        inspect(thrown, { depth: null, showHidden: true }),
        inspect(transport, { depth: null, showHidden: true }),
        JSON.stringify(transport),
        // Descriptors and function source: the reference lives in a closure, so
        // neither the shape of the transport nor the text of its methods can
        // carry it.
        inspect(descriptors, { depth: null, showHidden: true }),
        Object.values(descriptors).map((descriptor) => String(descriptor.value)).join('|'),
        Object.values(transport).map(String).join('|'),
      ]) {
        expect(surface, label).not.toContain('aca_stu_v1_')
        expect(surface, label).not.toContain('synthetic-study-session-reference')
      }
    }
  })

  it('still installs a genuine network-shaped plain JSON grant', () => {
    const transport = createStudySessionTransport()
    // Exactly what the issue route hands back: parsed JSON, plain data, no
    // accessors anywhere. The fail-closed ordering must not disturb it.
    const overTheWire = JSON.parse(JSON.stringify(grant(SESSION_REFERENCE))) as StudySessionGrant

    expect(transport.install(overTheWire))
      .toEqual({ expiresAtMs: Date.parse('2026-08-06T12:00:00.000Z') })
    expect(transport.hasSession()).toBe(true)
    expect(transport.authorizeStudyRequestHeaders({ 'content-type': 'application/json' })).toEqual({
      'content-type': 'application/json',
      [STUDY_SESSION_HEADER]: SESSION_REFERENCE,
    })
  })
})
