import {
  parseStudySessionGrant,
  parseVerifiedStudySession,
  type StudyLearnerSelector,
  type StudySessionGrant,
  type StudyStudentCapability,
  type VerifiedStudySession,
} from '../contracts/identity/session'

export type StudyIdentityClientErrorCode =
  | 'unauthenticated'
  | 'learner-unavailable'
  | 'student-session-invalid'
  | 'service-not-ready'

export class StudyIdentityClientError extends Error {
  constructor(readonly code: StudyIdentityClientErrorCode) {
    super(code)
    this.name = 'StudyIdentityClientError'
  }
}

/**
 * The browser client's own copy of the operation -> capability allow-list.
 *
 * One of three independent literals — this one, the Netlify gateway's, and
 * academy_private.study_runtime_operation_contract() in the database — kept as
 * separate lists on purpose, so a stale client cannot silently agree with the
 * server it no longer matches. supabase/academy-study-learner-runtime-operations.db.test.ts
 * executes the SQL authority and requires all three to be identical.
 *
 * preferences:write is absent by design: adult preferences are an adult/parent
 * authority operation and never ride a learner-session grant.
 */
export const STUDY_ACADEMIC_OPERATIONS = Object.freeze({
  'dashboard:read': 'student:progress:read',
  'calendar:read': 'student:assignments:read',
  'calendar:transition': 'student:attempts:create',
  'session:begin': 'student:attempts:create',
  'session:transition': 'student:attempts:create',
  'checkpoint:read': 'student:progress:read',
  'checkpoint:compare-and-swap': 'student:attempts:create',
  'event:append': 'student:attempts:create',
}) satisfies Readonly<Record<string, StudyStudentCapability>>

/** Derived from the map above so the accepted names cannot drift from it. */
export type StudyAcademicOperation = keyof typeof STUDY_ACADEMIC_OPERATIONS

export interface StudyIdentityClient {
  issueGuardianLaunch(input: {
    readonly accessToken: string
    readonly selectedStudentRef: StudyLearnerSelector
    readonly signal?: AbortSignal
  }): Promise<StudySessionGrant>
  verify(input: {
    readonly requiredCapability: StudyStudentCapability
    readonly signal?: AbortSignal
  }): Promise<VerifiedStudySession>
  executeAcademicOperation(input: {
    readonly operation: StudyAcademicOperation
    readonly request: Readonly<Record<string, unknown>>
    readonly signal?: AbortSignal
  }): Promise<unknown>
  revoke(signal?: AbortSignal): Promise<void>
  clear(): void
  hasSession(): boolean
}

function mappedError(status: number): StudyIdentityClientError {
  if (status === 401) return new StudyIdentityClientError('unauthenticated')
  if (status === 403) return new StudyIdentityClientError('learner-unavailable')
  return new StudyIdentityClientError('service-not-ready')
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new StudyIdentityClientError('service-not-ready')
  }
}

/**
 * Creates an identity client whose opaque learner-session reference exists only
 * in this closure. It is never copied to localStorage, sessionStorage, URLs, or
 * application state projections.
 */
export function createStudyIdentityClient(
  fetchImpl: typeof fetch = globalThis.fetch,
): StudyIdentityClient {
  let sessionReference: string | null = null
  let generation = 0

  const client: StudyIdentityClient = {
    async issueGuardianLaunch({ accessToken, selectedStudentRef, signal }) {
      const requestGeneration = ++generation
      sessionReference = null
      let response: Response
      try {
        response = await fetchImpl('/api/study/session/issue', {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            schemaVersion: 1,
            selectedStudentRef,
          }),
        })
      } catch {
        throw new StudyIdentityClientError('service-not-ready')
      }
      if (!response.ok) throw mappedError(response.status)
      const grant = parseStudySessionGrant(await json(response))
      if (!grant) throw new StudyIdentityClientError('service-not-ready')
      if (requestGeneration !== generation || signal?.aborted) {
        throw new StudyIdentityClientError('student-session-invalid')
      }
      sessionReference = grant.sessionReference
      return grant
    },

    async verify({ requiredCapability, signal }) {
      const current = sessionReference
      const requestGeneration = generation
      if (!current) throw new StudyIdentityClientError('student-session-invalid')
      let response: Response
      try {
        response = await fetchImpl('/api/study/session/verify', {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${current}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ schemaVersion: 1, requiredCapability }),
        })
      } catch {
        throw new StudyIdentityClientError('service-not-ready')
      }
      if (!response.ok) {
        if (response.status === 401) {
          if (requestGeneration === generation && sessionReference === current) {
            generation += 1
            sessionReference = null
          }
          throw new StudyIdentityClientError('student-session-invalid')
        }
        throw mappedError(response.status)
      }
      const verified = parseVerifiedStudySession(await json(response))
      if (!verified) throw new StudyIdentityClientError('service-not-ready')
      if (
        requestGeneration !== generation ||
        sessionReference !== current ||
        signal?.aborted
      ) throw new StudyIdentityClientError('student-session-invalid')
      return verified
    },

    async executeAcademicOperation({ operation, request, signal }) {
      const current = sessionReference
      const requestGeneration = generation
      if (!current) throw new StudyIdentityClientError('student-session-invalid')
      let response: Response
      try {
        response = await fetchImpl('/api/study/academic-runtime', {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${current}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ schemaVersion: 1, operation, request }),
        })
      } catch {
        throw new StudyIdentityClientError('service-not-ready')
      }
      if (!response.ok) {
        if (response.status === 401 && requestGeneration === generation && sessionReference === current) {
          generation += 1
          sessionReference = null
          throw new StudyIdentityClientError('student-session-invalid')
        }
        throw mappedError(response.status)
      }
      const result = await json(response)
      if (
        !result || typeof result !== 'object' || Array.isArray(result) ||
        Object.keys(result).length !== 4 ||
        (result as Record<string, unknown>).schemaVersion !== 1 ||
        (result as Record<string, unknown>).status !== 'ok' ||
        (result as Record<string, unknown>).operation !== operation ||
        !Object.hasOwn(result, 'body')
      ) throw new StudyIdentityClientError('service-not-ready')
      if (requestGeneration !== generation || sessionReference !== current || signal?.aborted) {
        throw new StudyIdentityClientError('student-session-invalid')
      }
      return (result as Record<string, unknown>).body
    },

    async revoke(signal) {
      const current = sessionReference
      generation += 1
      sessionReference = null
      if (!current) return
      let response: Response
      try {
        response = await fetchImpl('/api/study/session/revoke', {
          method: 'DELETE',
          signal,
          headers: { Authorization: `Bearer ${current}` },
        })
      } catch {
        throw new StudyIdentityClientError('service-not-ready')
      }
      if (!response.ok) throw mappedError(response.status)
    },

    clear() {
      generation += 1
      sessionReference = null
    },

    hasSession() {
      return sessionReference !== null
    },
  }

  return Object.freeze(client)
}
