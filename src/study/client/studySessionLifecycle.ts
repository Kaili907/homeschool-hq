import type { StudySessionGrant } from '../contracts/identity/session'
import type {
  StudySessionInvalidationNotice,
  StudySessionInvalidationReason,
} from './studyIdentityClient'
import {
  createStudySessionTransport,
  type StudySessionAuthorization,
  type StudySessionTransport,
} from './studySessionTransport'

/** Why the transport is empty. Never carries a reference, token, or identifier. */
export type StudySessionClearReason =
  | StudySessionInvalidationReason
  /** A notice arrived whose reason code this build does not recognise. */
  | 'identity-invalidated'
  | 'expired'
  | 'install-rejected'
  | StudySessionExplicitClearReason

/** The two lifecycle events only the host can observe. */
export type StudySessionExplicitClearReason = 'logout' | 'learner-changed'

const INVALIDATION_REASONS: ReadonlySet<string> = new Set<StudySessionInvalidationReason>([
  'session-rejected',
  'revoked',
  'cleared',
  'reissued',
])

/**
 * `setTimeout` silently fires immediately past this delay, so a grant dated
 * further out than this is rescheduled rather than expired on the spot.
 */
const MAX_TIMER_DELAY_MS = 2_147_483_647

export interface StudySessionLifecycleDeps {
  /** Defaults to a fresh transport; injected only so tests can watch the real one. */
  readonly transport?: StudySessionTransport
  /**
   * The identity client, narrowed to the one method an explicit host clear needs.
   * Omitted, `clear` still empties the transport.
   */
  readonly identity?: { clear(): void }
  readonly now?: () => number
  readonly setTimer?: (callback: () => void, delayMs: number) => unknown
  readonly clearTimer?: (handle: unknown) => void
}

export interface StudySessionLifecycle {
  /** The read-only seam Study requests depend on. Cannot install, rotate, or clear. */
  readonly authorization: StudySessionAuthorization
  /** Installs one issued grant and schedules its expiry, cancelling any prior timer. */
  install(grant: StudySessionGrant): void
  /** Logout or learner change: empties the transport and the identity client. */
  clear(reason: StudySessionExplicitClearReason): void
  /** Wire this into `createStudyIdentityClient`'s `onSessionInvalidated`. */
  onIdentitySessionInvalidated(notice: StudySessionInvalidationNotice): void
  hasSession(): boolean
  lastClearReason(): StudySessionClearReason | null
}

/**
 * Keeps the identity client and the session transport from drifting apart. It
 * holds only non-secret expiry metadata; the reference itself stays inside the
 * transport closure, so nothing here can read, copy, persist, or log it.
 */
export function createStudySessionLifecycle(
  deps: StudySessionLifecycleDeps = {},
): StudySessionLifecycle {
  const transport = deps.transport ?? createStudySessionTransport()
  const now = deps.now ?? (() => Date.now())
  const setTimer = deps.setTimer ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs))
  const clearTimer = deps.clearTimer ??
    ((handle) => { globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>) })

  let expiresAtMs: number | null = null
  let timer: unknown = null
  let generation = 0
  let lastReason: StudySessionClearReason | null = null

  function cancelTimer(): void {
    if (timer === null) return
    clearTimer(timer)
    timer = null
  }

  function clearInternal(reason: StudySessionClearReason): void {
    cancelTimer()
    expiresAtMs = null
    transport.clear()
    lastReason = reason
  }

  function scheduleExpiry(installedGeneration: number, expiry: number): void {
    const remaining = expiry - now()
    timer = setTimer(() => {
      timer = null
      // A timer belonging to a replaced grant must never clear the current one.
      if (installedGeneration !== generation) return
      if (now() < expiry) {
        scheduleExpiry(installedGeneration, expiry)
        return
      }
      clearInternal('expired')
    }, Math.min(Math.max(remaining, 0), MAX_TIMER_DELAY_MS))
  }

  /** Lazy expiry, so a throttled or never-fired timer cannot leave one usable. */
  function expireIfElapsed(): void {
    if (expiresAtMs !== null && now() >= expiresAtMs) clearInternal('expired')
  }

  const authorization: StudySessionAuthorization = Object.freeze({
    authorizeStudyRequestHeaders(headers: Readonly<Record<string, string>>) {
      expireIfElapsed()
      return transport.authorizeStudyRequestHeaders(headers)
    },
  })

  return Object.freeze({
    authorization,

    install(grant: StudySessionGrant) {
      cancelTimer()
      expiresAtMs = null
      const installedGeneration = ++generation
      try {
        // The transport is the only validator, and it fail-closes on refusal.
        transport.install(grant)
      } catch (error) {
        lastReason = 'install-rejected'
        throw error
      }
      const expiry = Date.parse(grant.expiresAt)
      expiresAtMs = expiry
      lastReason = null
      if (now() >= expiry) {
        clearInternal('expired')
        return
      }
      scheduleExpiry(installedGeneration, expiry)
    },

    clear(reason: StudySessionExplicitClearReason) {
      // First, so the notice it raises cannot overwrite the host's own reason.
      deps.identity?.clear()
      clearInternal(reason)
    },

    onIdentitySessionInvalidated(notice: StudySessionInvalidationNotice) {
      const reason = notice?.reason
      clearInternal(
        typeof reason === 'string' && INVALIDATION_REASONS.has(reason)
          ? reason
          : 'identity-invalidated',
      )
    },

    hasSession() {
      expireIfElapsed()
      return transport.hasSession()
    },

    lastClearReason() {
      return lastReason
    },
  })
}
