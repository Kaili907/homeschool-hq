import { parseStudySessionGrant, type StudySessionGrant } from '../contracts/identity/session'

/**
 * Routes that already carry the adult bearer in `authorization` receive the
 * learner's opaque Study-session reference in this header instead. Mirrors
 * `STUDY_SESSION_HEADER` in netlify/functions/_shared/study-identity/contracts.js.
 */
export const STUDY_SESSION_HEADER = 'x-study-session'

export type StudySessionTransportErrorCode = 'study-session-reference-invalid'

/** Carries a code only. The raw reference is never placed in a thrown error. */
export class StudySessionTransportError extends Error {
  constructor(readonly code: StudySessionTransportErrorCode) {
    super(code)
    this.name = 'StudySessionTransportError'
  }
}

/**
 * The read half of the transport. Callers that only need to authorize one
 * outbound request depend on this and can never install, rotate, or clear.
 */
export interface StudySessionAuthorization {
  /**
   * Returns `headers` plus the Study-session header, or null when no verified
   * reference is installed. Null means fail closed: the caller must refuse the
   * request before any network activity.
   */
  authorizeStudyRequestHeaders(
    headers: Readonly<Record<string, string>>,
  ): Record<string, string> | null
}

export interface StudySessionTransport extends StudySessionAuthorization {
  /**
   * Installs a grant minted by the existing issue path, replacing (rotating)
   * any current reference. Refuses anything the canonical identity contract
   * does not parse.
   */
  install(grant: StudySessionGrant): void
  clear(): void
  hasSession(): boolean
}

/**
 * Holds the learner's opaque Study-session reference in this closure only. It
 * is never written to localStorage, sessionStorage, IndexedDB, a URL, history,
 * React state, AppState, analytics, logs, or an exported backup, and it is
 * never exposed as a property, so serializing the transport yields nothing.
 */
export function createStudySessionTransport(): StudySessionTransport {
  let sessionReference: string | null = null

  return Object.freeze({
    install(grant: StudySessionGrant) {
      const parsed = parseStudySessionGrant(grant)
      // Fail closed before validating: a refused rotation must not leave the
      // previous reference live, because the caller no longer knows which
      // session this transport represents.
      sessionReference = null
      if (!parsed) throw new StudySessionTransportError('study-session-reference-invalid')
      sessionReference = parsed.sessionReference
    },

    authorizeStudyRequestHeaders(headers: Readonly<Record<string, string>>) {
      const current = sessionReference
      if (current === null) return null
      // A fresh object per call, so concurrent requests never share a header map
      // and a caller-supplied session header can never override the real one.
      return { ...headers, [STUDY_SESSION_HEADER]: current }
    },

    clear() {
      sessionReference = null
    },

    hasSession() {
      return sessionReference !== null
    },
  })
}
