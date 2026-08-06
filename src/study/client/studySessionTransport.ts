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

/**
 * What `install` hands back: non-secret metadata derived from the very value
 * the canonical parser admitted. It carries no reference and no token, so the
 * caller can schedule expiry without ever holding the session itself.
 */
export interface StudySessionInstalledSession {
  readonly expiresAtMs: number
}

export interface StudySessionTransport extends StudySessionAuthorization {
  /**
   * Installs a grant minted by the existing issue path, replacing (rotating)
   * any current reference. Refuses anything the canonical identity contract
   * does not parse.
   */
  install(grant: StudySessionGrant): StudySessionInstalledSession
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
      // Copy the own enumerable fields once, before validating. A grant whose
      // `expiresAt` is an accessor would otherwise be free to return one value
      // to the canonical parser and a later, longer-lived one to whoever reads
      // it again; the parser then admits a grant nobody scheduled correctly.
      // Spreading calls each getter exactly once and yields plain data, so the
      // canonical parser and the expiry below see the same frozen-in value.
      const snapshot = grant !== null && typeof grant === 'object' ? { ...grant } : grant
      const parsed = parseStudySessionGrant(snapshot)
      // Fail closed before validating: a refused rotation must not leave the
      // previous reference live, because the caller no longer knows which
      // session this transport represents.
      sessionReference = null
      if (!parsed) throw new StudySessionTransportError('study-session-reference-invalid')
      // The canonical parser is the only validator, and it already requires a
      // finite instant. Re-checking here keeps a session that nothing could
      // ever expire from being installed if that ever ceases to hold.
      const expiresAtMs = Date.parse(parsed.expiresAt)
      if (!Number.isFinite(expiresAtMs)) {
        throw new StudySessionTransportError('study-session-reference-invalid')
      }
      sessionReference = parsed.sessionReference
      return Object.freeze({ expiresAtMs })
    },

    authorizeStudyRequestHeaders(headers: Readonly<Record<string, string>>) {
      const current = sessionReference
      if (current === null) return null
      // A fresh object per call, so concurrent requests never share a header map
      // and a caller-supplied session header can never override the real one.
      // Header names are case-insensitive on the wire, so a caller key such as
      // `X-Study-Session` would otherwise survive next to the canonical one and
      // fetch would send both combined, which the gateway refuses. Drop every
      // case variant first, then add exactly one canonical lowercase header.
      // `fromEntries` defines rather than assigns, so a `__proto__` header key
      // stays an ordinary own property instead of reaching the prototype.
      const authorized = Object.fromEntries(
        Object.entries(headers).filter(([key]) => key.toLowerCase() !== STUDY_SESSION_HEADER),
      )
      authorized[STUDY_SESSION_HEADER] = current
      return authorized
    },

    clear() {
      sessionReference = null
    },

    hasSession() {
      return sessionReference !== null
    },
  })
}
