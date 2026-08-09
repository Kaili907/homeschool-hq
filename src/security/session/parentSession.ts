import type { SecurityLifecycleEvent, SecurityLifecycleEventType } from '../contracts/lifecycle'
import { SECURITY_SESSION_POLICY } from '../contracts/sessionPolicy'
import {
  createLocalSessionId,
  LOCAL_SESSION_SCHEMA_VERSION,
  type ParentSessionRecord,
} from '../contracts/sessions'
import type { GlobalRevocationSource } from './revocation'
import { requireSafeTimestamp, type SecurityClock, systemSecurityClock } from './runtime'

export type ParentSessionEndReason =
  | 'none'
  | 'replaced'
  | 'parent-lock'
  | 'idle-expired'
  | 'absolute-expired'
  | 'clock-anomaly'
  | 'global-revocation'

export type ParentSessionCheck =
  | Readonly<{ status: 'active'; session: ParentSessionRecord }>
  | Readonly<{ status: 'ended'; reason: ParentSessionEndReason }>

export interface ParentSessionControllerOptions {
  readonly revocation: GlobalRevocationSource
  readonly clock?: SecurityClock
  readonly randomUUID?: () => string
  readonly onLifecycleEvent?: (event: SecurityLifecycleEvent) => void
}

/** Parent authority intentionally has no storage dependency and cannot survive refresh. */
export class ParentSessionController {
  readonly #revocation: GlobalRevocationSource
  readonly #clock: SecurityClock
  readonly #randomUUID?: () => string
  readonly #onLifecycleEvent?: (event: SecurityLifecycleEvent) => void
  readonly #endListeners = new Set<(reason: ParentSessionEndReason) => void>()
  readonly #unsubscribeRevocation: () => void
  #session: ParentSessionRecord | null = null
  #lastObservedAt: number | null = null
  #lastEndReason: ParentSessionEndReason = 'none'

  constructor(options: ParentSessionControllerOptions) {
    this.#revocation = options.revocation
    this.#clock = options.clock ?? systemSecurityClock
    this.#randomUUID = options.randomUUID
    this.#onLifecycleEvent = options.onLifecycleEvent
    this.#unsubscribeRevocation = this.#revocation.subscribe(() => {
      if (this.#session) this.recheck()
    })
  }

  create(verifiedParentActorId: string, householdId: string): ParentSessionRecord {
    if (!verifiedParentActorId || verifiedParentActorId.trim() !== verifiedParentActorId) {
      throw new Error('Verified Parent actor ID is required.')
    }
    if (!householdId || householdId.trim() !== householdId) throw new Error('Household ID is required.')
    if (this.#session) this.#end('replaced', false)
    const now = requireSafeTimestamp(this.#clock)
    const epoch = this.#revocation.currentEpoch()
    if (epoch === null) throw new Error('Global revocation epoch is unavailable.')
    this.#session = Object.freeze({
      schemaVersion: LOCAL_SESSION_SCHEMA_VERSION,
      storage: SECURITY_SESSION_POLICY.parent.storage,
      sessionId: createLocalSessionId(this.#randomUUID),
      verifiedParentActorId,
      householdId,
      authenticatedAt: new Date(now).toISOString(),
      lastMeaningfulActivityAt: new Date(now).toISOString(),
      absoluteExpiresAt: new Date(now + SECURITY_SESSION_POLICY.parent.absoluteTimeoutMs).toISOString(),
      globalRevocationEpoch: epoch,
    })
    this.#lastObservedAt = now
    this.#lastEndReason = 'none'
    return this.#session
  }

  recheck(): ParentSessionCheck {
    if (!this.#session) return Object.freeze({ status: 'ended', reason: this.#lastEndReason })
    let now: number
    try {
      now = requireSafeTimestamp(this.#clock)
    } catch {
      return this.#end('clock-anomaly')
    }
    const authenticatedAt = Date.parse(this.#session.authenticatedAt)
    const activityAt = Date.parse(this.#session.lastMeaningfulActivityAt)
    const absoluteAt = Date.parse(this.#session.absoluteExpiresAt)
    if (
      now < authenticatedAt ||
      now < activityAt ||
      (this.#lastObservedAt !== null && now < this.#lastObservedAt)
    ) return this.#end('clock-anomaly', true, now)
    this.#lastObservedAt = now
    const epoch = this.#revocation.currentEpoch()
    if (epoch === null || epoch !== this.#session.globalRevocationEpoch) {
      return this.#end('global-revocation', true, now)
    }
    if (now >= absoluteAt) return this.#end('absolute-expired', true, now)
    if (now - activityAt >= SECURITY_SESSION_POLICY.parent.idleTimeoutMs) {
      return this.#end('idle-expired', true, now)
    }
    return Object.freeze({ status: 'active', session: this.#session })
  }

  noteMeaningfulActivity(): ParentSessionCheck {
    const checked = this.recheck()
    if (checked.status !== 'active') return checked
    const now = this.#lastObservedAt as number
    this.#session = Object.freeze({
      ...checked.session,
      lastMeaningfulActivityAt: new Date(now).toISOString(),
    })
    return Object.freeze({ status: 'active', session: this.#session })
  }

  lock(): void {
    if (this.#session) this.#end('parent-lock')
  }

  subscribeEnded(listener: (reason: ParentSessionEndReason) => void): () => void {
    this.#endListeners.add(listener)
    return () => this.#endListeners.delete(listener)
  }

  close(): void {
    this.#unsubscribeRevocation()
    if (this.#session) this.#end('parent-lock')
    this.#endListeners.clear()
  }

  get session(): ParentSessionRecord | null {
    return this.#session
  }

  #end(reason: ParentSessionEndReason, emit = true, occurredAt?: number): ParentSessionCheck {
    const hadSession = this.#session !== null
    this.#session = null
    this.#lastObservedAt = null
    this.#lastEndReason = reason
    if (hadSession) {
      for (const listener of [...this.#endListeners]) listener(reason)
      if (emit && reason !== 'replaced') {
        const type: SecurityLifecycleEventType = reason === 'global-revocation'
          ? 'global-revocation'
          : reason === 'parent-lock'
            ? 'parent-lock'
            : 'parent-session-expired'
        this.#emit(type, occurredAt)
      }
    }
    return Object.freeze({ status: 'ended', reason })
  }

  #emit(type: SecurityLifecycleEventType, occurredAt?: number): void {
    if (!this.#onLifecycleEvent) return
    let timestamp = occurredAt
    if (timestamp === undefined) {
      try {
        timestamp = requireSafeTimestamp(this.#clock)
      } catch {
        timestamp = 0
      }
    }
    this.#onLifecycleEvent(Object.freeze({ type, occurredAt: new Date(timestamp).toISOString() }))
  }
}
