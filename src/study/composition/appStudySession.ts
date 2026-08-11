import {
  createStudyIdentityClient,
  type StudyIdentityClient,
} from '../client/studyIdentityClient'
import {
  createStudySessionLifecycle,
  type StudySessionExplicitClearReason,
  type StudySessionLifecycle,
} from '../client/studySessionLifecycle'
import {
  StudySessionTransportError,
  type StudySessionAuthorization,
  type StudySessionTransportErrorCode,
} from '../client/studySessionTransport'
import type { StudySessionGrant } from '../contracts/identity/session'

/**
 * A fixed, non-secret code. The independent lifecycle review required that an
 * install refusal never reach a log, a surface, or telemetry as an arbitrary
 * `error.message`: the grant, the reference and any server text stay out of the
 * host entirely, and only one of these two words is ever reported.
 */
export type StudySessionInstallFailureCode = StudySessionTransportErrorCode | 'install-rejected'

export class StudySessionInstallRejectedError extends Error {
  constructor(readonly code: StudySessionInstallFailureCode) {
    super(code)
    this.name = 'StudySessionInstallRejectedError'
  }
}

export interface AppStudySessionCompositionDeps {
  /** Only so tests can drive the identity client; production takes the default. */
  readonly fetchImpl?: typeof fetch
  /** Receives the fixed code above and nothing else. A throw here changes nothing. */
  readonly onInstallRejected?: (code: StudySessionInstallFailureCode) => void
}

export interface AppStudySessionComposition {
  /** The one issuer-facing client. Nothing else may mint or revoke a session. */
  readonly identity: StudyIdentityClient
  /** The one lifecycle. It owns the only transport, which is the only validator. */
  readonly lifecycle: StudySessionLifecycle
  /** Read-only seam handed to Study requests. It cannot install, rotate or clear. */
  readonly authorization: StudySessionAuthorization
  /**
   * Installs one grant that the identity client has just issued. On refusal the
   * lifecycle is left empty, a fixed code is reported, and a code-only error is
   * thrown so the caller refuses the launch.
   */
  installIssuedGrant(grant: StudySessionGrant): void
  clear(reason: StudySessionExplicitClearReason): void
}

/**
 * STUDY-A1-COMP Phase 4 — the single Study session trio for one running app.
 *
 * Exactly one transport, one lifecycle and one identity client, constructed once
 * and associated only with each other:
 *  - the lifecycle builds its own transport, so no foreign transport is ever
 *    injected and the canonical grant validator is the real one;
 *  - the identity client's invalidation notices land on THAT lifecycle;
 *  - an explicit host clear empties that lifecycle and then THAT identity client.
 *
 * The construction cycle between the two is broken by a late-bound seam rather
 * than by a second authority: the lifecycle is given a `clear` thunk that reads
 * the identity client only when it is called, by which time it exists.
 *
 * Nothing here mints, reshapes, copies or inspects a grant. The identity client
 * remains the issuer-facing client, the transport remains the canonical
 * validator, and the server remains authoritative.
 */
export function createAppStudySessionComposition(
  deps: AppStudySessionCompositionDeps = {},
): AppStudySessionComposition {
  let identity: StudyIdentityClient | null = null

  const lifecycle = createStudySessionLifecycle({
    // Late-bound on purpose. Passing the client directly is impossible — it does
    // not exist yet — and building a second one here would create a second
    // identity authority, which is exactly what must not happen.
    identity: { clear: () => { identity?.clear() } },
  })

  identity = createStudyIdentityClient(deps.fetchImpl, {
    onSessionInvalidated: (notice) => { lifecycle.onIdentitySessionInvalidated(notice) },
  })

  return Object.freeze({
    identity,
    lifecycle,
    authorization: lifecycle.authorization,

    installIssuedGrant(grant: StudySessionGrant) {
      try {
        lifecycle.install(grant)
      } catch (error) {
        // The lifecycle and the transport have both already emptied themselves;
        // this only decides what the host is allowed to learn about why.
        const code = error instanceof StudySessionTransportError ? error.code : 'install-rejected'
        try {
          deps.onInstallRejected?.(code)
        } catch {
          // A host reporter that throws must not turn a refused install into an
          // unhandled failure, and cannot make the refusal any less refused.
        }
        throw new StudySessionInstallRejectedError(code)
      }
    },

    clear(reason: StudySessionExplicitClearReason) {
      lifecycle.clear(reason)
    },
  })
}
