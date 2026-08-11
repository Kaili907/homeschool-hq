import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STUDY_SESSION_HEADER } from '../client/studySessionTransport'
import type { StudySessionInvalidationNotice } from '../client/studyIdentityClient'
import type { StudySessionGrant } from '../contracts/identity/session'
import {
  createAppStudySessionComposition,
  StudySessionInstallRejectedError,
} from './appStudySession'

// STUDY-A1-COMP Phases 4-6. One transport, one lifecycle, one identity client,
// wired to each other and to nothing else. The raw Study-session reference never
// leaves the transport closure, and the two events only the host can observe —
// logout and a learner change — empty everything before anything else runs.
//
// The three factories below are counted, not replaced: each wrapper delegates to
// the real implementation, so every assertion is made against production code.

const counters = vi.hoisted(() => ({
  transports: 0,
  lifecycles: 0,
  identities: 0,
  foreignTransports: 0,
  identityDeps: [] as Array<{ onSessionInvalidated?: (notice: StudySessionInvalidationNotice) => void } | undefined>,
}))

vi.mock('../client/studySessionTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/studySessionTransport')>()
  return {
    ...actual,
    createStudySessionTransport: (...args: []) => {
      counters.transports += 1
      return actual.createStudySessionTransport(...args)
    },
  }
})

vi.mock('../client/studySessionLifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/studySessionLifecycle')>()
  return {
    ...actual,
    createStudySessionLifecycle: (deps: Parameters<typeof actual.createStudySessionLifecycle>[0] = {}) => {
      counters.lifecycles += 1
      if (deps.transport) counters.foreignTransports += 1
      return actual.createStudySessionLifecycle(deps)
    },
  }
})

vi.mock('../client/studyIdentityClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client/studyIdentityClient')>()
  return {
    ...actual,
    createStudyIdentityClient: (
      fetchImpl?: typeof fetch,
      deps?: Parameters<typeof actual.createStudyIdentityClient>[1],
    ) => {
      counters.identities += 1
      counters.identityDeps.push(deps)
      return actual.createStudyIdentityClient(fetchImpl, deps)
    },
  }
})

const REFERENCE_A = `aca_stu_v1_${'A'.repeat(43)}`
const REFERENCE_B = `aca_stu_v1_${'B'.repeat(43)}`
const REFERENCE_C = `aca_stu_v1_${'C'.repeat(43)}`
const REFERENCE_D = `aca_stu_v1_${'D'.repeat(43)}`

function grant(overrides: Partial<StudySessionGrant> = {}): StudySessionGrant {
  return {
    schemaVersion: 1,
    status: 'issued',
    sessionReference: REFERENCE_A,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    ...overrides,
  } as StudySessionGrant
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

describe('App-owned Study session composition', () => {
  beforeEach(() => {
    counters.transports = 0
    counters.lifecycles = 0
    counters.identities = 0
    counters.foreignTransports = 0
    counters.identityDeps = []
  })
  afterEach(() => { vi.restoreAllMocks() })

  describe('construction', () => {
    it('builds exactly one transport, one lifecycle and one identity client', () => {
      const composition = createAppStudySessionComposition()

      expect(counters.lifecycles).toBe(1)
      expect(counters.identities).toBe(1)
      // The lifecycle owns the only transport there is, and no foreign transport
      // is ever handed to it.
      expect(counters.transports).toBe(1)
      expect(counters.foreignTransports).toBe(0)
      expect(composition.lifecycle).toBeDefined()
      expect(composition.identity).toBeDefined()
    })

    it('does not create a second lifecycle per authorization read or per port', () => {
      const composition = createAppStudySessionComposition()
      for (let index = 0; index < 25; index += 1) {
        composition.authorization.authorizeStudyRequestHeaders({ 'content-type': 'application/json' })
      }
      expect(counters.lifecycles).toBe(1)
      expect(counters.transports).toBe(1)
    })

    it('exposes the same authorization seam the lifecycle owns, and no way to install through it', () => {
      const composition = createAppStudySessionComposition()
      expect(composition.authorization).toBe(composition.lifecycle.authorization)
      expect(Object.keys(composition.authorization)).toEqual(['authorizeStudyRequestHeaders'])
    })

    it('routes identity invalidation into the same lifecycle', () => {
      const composition = createAppStudySessionComposition()
      const deps = counters.identityDeps[0]
      expect(typeof deps?.onSessionInvalidated).toBe('function')

      composition.installIssuedGrant(grant())
      expect(composition.lifecycle.hasSession()).toBe(true)

      deps!.onSessionInvalidated!({ reason: 'session-rejected' })
      expect(composition.lifecycle.hasSession()).toBe(false)
      expect(composition.lifecycle.lastClearReason()).toBe('session-rejected')
    })
  })

  describe('grant installation', () => {
    it('authorizes a request only after a valid grant is installed', () => {
      const composition = createAppStudySessionComposition()
      expect(composition.authorization.authorizeStudyRequestHeaders({})).toBeNull()

      composition.installIssuedGrant(grant())
      const headers = composition.authorization.authorizeStudyRequestHeaders({
        Authorization: 'Bearer adult-token',
      })
      expect(headers?.[STUDY_SESSION_HEADER]).toBe(REFERENCE_A)
      expect(headers?.Authorization).toBe('Bearer adult-token')
    })

    it('refuses a malformed grant with a fixed non-secret code and installs nothing', () => {
      const codes: string[] = []
      const composition = createAppStudySessionComposition({
        onInstallRejected: (code) => codes.push(code),
      })
      const malformed = { schemaVersion: 1, status: 'issued', sessionReference: '' } as unknown as StudySessionGrant

      expect(() => composition.installIssuedGrant(malformed)).toThrow(StudySessionInstallRejectedError)
      expect(codes).toEqual(['study-session-reference-invalid'])
      expect(composition.lifecycle.hasSession()).toBe(false)
      expect(composition.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    })

    it('reports only a fixed code — never a message, a reference, or the grant', () => {
      const codes: unknown[] = []
      const composition = createAppStudySessionComposition({
        onInstallRejected: (code) => codes.push(code),
      })
      const hostile = {
        schemaVersion: 1,
        status: 'issued',
        sessionReference: REFERENCE_A,
        expiresAt: 'not-a-date',
      } as unknown as StudySessionGrant

      let thrown: unknown
      try { composition.installIssuedGrant(hostile) } catch (error) { thrown = error }

      expect(codes).toHaveLength(1)
      expect(typeof codes[0]).toBe('string')
      expect(String(codes[0])).not.toContain(REFERENCE_A)
      expect(thrown).toBeInstanceOf(StudySessionInstallRejectedError)
      expect((thrown as Error).message).not.toContain(REFERENCE_A)
      expect((thrown as StudySessionInstallRejectedError).code).not.toContain(REFERENCE_A)
    })

    it('does not report a code when the host wired no reporter, and still fails closed', () => {
      const composition = createAppStudySessionComposition()
      expect(() => composition.installIssuedGrant({} as StudySessionGrant)).toThrow(StudySessionInstallRejectedError)
      expect(composition.lifecycle.hasSession()).toBe(false)
    })

    it('leaves nothing authorizing when an already-expired grant is installed', () => {
      const composition = createAppStudySessionComposition()
      composition.installIssuedGrant(grant())
      expect(composition.lifecycle.hasSession()).toBe(true)

      composition.installIssuedGrant(grant({
        sessionReference: REFERENCE_B,
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      }))
      expect(composition.lifecycle.hasSession()).toBe(false)
      expect(composition.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    })

    it('drops the previous reference when a replacement grant throws', () => {
      const composition = createAppStudySessionComposition()
      composition.installIssuedGrant(grant())

      const throwing = { schemaVersion: 1, status: 'issued', expiresAt: new Date(Date.now() + 600_000).toISOString() }
      Object.defineProperty(throwing, 'sessionReference', {
        get() { throw new Error('hostile accessor') },
        enumerable: true,
      })
      expect(() => composition.installIssuedGrant(throwing as StudySessionGrant)).toThrow()

      // The old session must not survive a refused rotation: the caller no
      // longer knows which session this composition represents.
      expect(composition.lifecycle.hasSession()).toBe(false)
      expect(composition.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    })

    it('never serializes the installed reference', () => {
      const composition = createAppStudySessionComposition()
      composition.installIssuedGrant(grant({ sessionReference: REFERENCE_C }))

      for (const value of [composition, composition.lifecycle, composition.authorization, composition.identity]) {
        expect(JSON.stringify(value) ?? '').not.toContain(REFERENCE_C)
      }
      expect(Object.values(composition.lifecycle)).not.toContain(REFERENCE_C)
      expect(Object.values(composition)).not.toContain(REFERENCE_C)
    })
  })

  describe('logout and learner change', () => {
    it('empties the lifecycle and the identity client on logout', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse(grant()))
      const composition = createAppStudySessionComposition({ fetchImpl: fetchImpl as unknown as typeof fetch })
      const issued = await composition.identity.issueGuardianLaunch({
        accessToken: 'adult-token',
        selectedStudentRef: { kind: 'legacy-profile-id', value: 'child-a' },
      })
      composition.installIssuedGrant(issued)
      expect(composition.identity.hasSession()).toBe(true)
      expect(composition.lifecycle.hasSession()).toBe(true)

      composition.clear('logout')

      expect(composition.lifecycle.hasSession()).toBe(false)
      expect(composition.identity.hasSession()).toBe(false)
      expect(composition.lifecycle.lastClearReason()).toBe('logout')
      expect(composition.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    })

    it('clears child A before child B can authorize anything', () => {
      const composition = createAppStudySessionComposition()

      composition.installIssuedGrant(grant({ sessionReference: REFERENCE_A }))
      expect(
        composition.authorization.authorizeStudyRequestHeaders({})?.[STUDY_SESSION_HEADER],
      ).toBe(REFERENCE_A)

      composition.clear('learner-changed')
      expect(composition.lifecycle.lastClearReason()).toBe('learner-changed')
      // Between the two learners there is no header at all: child B cannot
      // inherit child A's, and no cached authorization map survives.
      expect(composition.authorization.authorizeStudyRequestHeaders({})).toBeNull()

      composition.installIssuedGrant(grant({ sessionReference: REFERENCE_B }))
      const headers = composition.authorization.authorizeStudyRequestHeaders({})
      expect(headers?.[STUDY_SESSION_HEADER]).toBe(REFERENCE_B)
      expect(JSON.stringify(headers)).not.toContain(REFERENCE_A)
    })

    it('keeps the host reason authoritative when the identity client re-enters on clear', () => {
      const composition = createAppStudySessionComposition()
      composition.installIssuedGrant(grant())
      // identity.clear() fires onSessionInvalidated('cleared') straight back
      // into the lifecycle; the host's own reason must win.
      composition.clear('logout')
      expect(composition.lifecycle.lastClearReason()).toBe('logout')
      expect(composition.lifecycle.hasSession()).toBe(false)
    })

    it('leaves no expiry timer able to clear a later session', () => {
      vi.useFakeTimers()
      try {
        const composition = createAppStudySessionComposition()
        composition.installIssuedGrant(grant({ expiresAt: new Date(Date.now() + 5_000).toISOString() }))
        composition.clear('logout')
        composition.installIssuedGrant(grant({
          sessionReference: REFERENCE_D,
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }))
        vi.advanceTimersByTime(60_000)
        // The retired timer must not have cleared the live session.
        expect(composition.lifecycle.hasSession()).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
