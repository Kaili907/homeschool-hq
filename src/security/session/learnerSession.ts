import { isUuidV4 } from '../contracts/identifiers'
import type { SecurityLifecycleEvent, SecurityLifecycleEventType } from '../contracts/lifecycle'
import { SECURITY_SESSION_POLICY } from '../contracts/sessionPolicy'
import {
  createLocalSessionId,
  LOCAL_SESSION_SCHEMA_VERSION,
  type LearnerSessionRecord,
} from '../contracts/sessions'
import type { GlobalRevocationSource } from './revocation'
import {
  hasExactKeys,
  isPlainRecord,
  parseCanonicalTimestamp,
  requireSafeTimestamp,
  safeRemove,
  type SecurityClock,
  type SecurityStorage,
  systemSecurityClock,
} from './runtime'

export const LEARNER_SESSION_STORAGE_KEY = 'manuel-academy.security.learner-session.v1'
export const DEFAULT_LEARNER_ACTIVITY_WRITE_THROTTLE_MS = 5_000

const LEARNER_SESSION_KEYS = Object.freeze([
  'schemaVersion',
  'sessionId',
  'profileId',
  'authenticatedAt',
  'lastMeaningfulActivityAt',
  'absoluteExpiresAt',
  'globalRevocationEpoch',
] as const)

export type LearnerSessionEndReason =
  | 'none'
  | 'malformed-record'
  | 'storage-unavailable'
  | 'idle-expired'
  | 'absolute-expired'
  | 'clock-anomaly'
  | 'global-revocation'

export type LearnerSessionCheck =
  | Readonly<{ status: 'active'; session: LearnerSessionRecord }>
  | Readonly<{ status: 'ended'; reason: LearnerSessionEndReason }>

export interface LearnerSessionControllerOptions {
  readonly storage: SecurityStorage
  readonly revocation: GlobalRevocationSource
  readonly clock?: SecurityClock
  readonly randomUUID?: () => string
  readonly activityWriteThrottleMs?: number
  readonly onLifecycleEvent?: (event: SecurityLifecycleEvent) => void
}

interface ParsedLearnerSession {
  readonly record: LearnerSessionRecord
  readonly authenticatedAt: number
  readonly lastMeaningfulActivityAt: number
  readonly absoluteExpiresAt: number
}

function parseLearnerSessionRecord(value: unknown): ParsedLearnerSession | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, LEARNER_SESSION_KEYS)) return null
  if (value.schemaVersion !== LOCAL_SESSION_SCHEMA_VERSION) return null
  if (!isUuidV4(value.sessionId)) return null
  if (typeof value.profileId !== 'string' || value.profileId.trim() !== value.profileId || !value.profileId) return null
  if (!Number.isSafeInteger(value.globalRevocationEpoch) || Number(value.globalRevocationEpoch) < 0) return null
  const authenticatedAt = parseCanonicalTimestamp(value.authenticatedAt)
  const lastMeaningfulActivityAt = parseCanonicalTimestamp(value.lastMeaningfulActivityAt)
  const absoluteExpiresAt = parseCanonicalTimestamp(value.absoluteExpiresAt)
  if (authenticatedAt === null || lastMeaningfulActivityAt === null || absoluteExpiresAt === null) return null
  if (lastMeaningfulActivityAt < authenticatedAt || lastMeaningfulActivityAt > absoluteExpiresAt) return null
  if (absoluteExpiresAt !== authenticatedAt + SECURITY_SESSION_POLICY.learner.absoluteTimeoutMs) return null
  return {
    record: value as unknown as LearnerSessionRecord,
    authenticatedAt,
    lastMeaningfulActivityAt,
    absoluteExpiresAt,
  }
}

export function deserializeLearnerSessionRecord(serialized: string): LearnerSessionRecord | null {
  try {
    return parseLearnerSessionRecord(JSON.parse(serialized))?.record ?? null
  } catch {
    return null
  }
}

/** A tab-scoped learner authorization backed only by that tab's sessionStorage. */
export class LearnerSessionController {
  readonly #storage: SecurityStorage
  readonly #revocation: GlobalRevocationSource
  readonly #clock: SecurityClock
  readonly #randomUUID?: () => string
  readonly #writeThrottleMs: number
  readonly #onLifecycleEvent?: (event: SecurityLifecycleEvent) => void
  readonly #unsubscribeRevocation: () => void
  #session: LearnerSessionRecord | null = null
  #lastObservedAt: number | null = null
  #lastStorageWriteAt: number | null = null
  #lastEndReason: LearnerSessionEndReason = 'none'

  constructor(options: LearnerSessionControllerOptions) {
    this.#storage = options.storage
    this.#revocation = options.revocation
    this.#clock = options.clock ?? systemSecurityClock
    this.#randomUUID = options.randomUUID
    this.#writeThrottleMs = options.activityWriteThrottleMs ?? DEFAULT_LEARNER_ACTIVITY_WRITE_THROTTLE_MS
    if (!Number.isFinite(this.#writeThrottleMs) || this.#writeThrottleMs < 0) {
      throw new Error('Learner activity write throttle is invalid.')
    }
    this.#onLifecycleEvent = options.onLifecycleEvent
    this.#unsubscribeRevocation = this.#revocation.subscribe(() => {
      if (this.#session) this.recheck()
    })
  }

  create(profileId: string): LearnerSessionRecord {
    if (!profileId || profileId.trim() !== profileId) throw new Error('Learner profile ID is required.')
    const now = requireSafeTimestamp(this.#clock)
    const epoch = this.#revocation.currentEpoch()
    if (epoch === null) throw new Error('Global revocation epoch is unavailable.')
    const record: LearnerSessionRecord = Object.freeze({
      schemaVersion: LOCAL_SESSION_SCHEMA_VERSION,
      sessionId: createLocalSessionId(this.#randomUUID),
      profileId,
      authenticatedAt: new Date(now).toISOString(),
      lastMeaningfulActivityAt: new Date(now).toISOString(),
      absoluteExpiresAt: new Date(now + SECURITY_SESSION_POLICY.learner.absoluteTimeoutMs).toISOString(),
      globalRevocationEpoch: epoch,
    })
    this.#storage.setItem(LEARNER_SESSION_STORAGE_KEY, JSON.stringify(record))
    this.#session = record
    this.#lastObservedAt = now
    this.#lastStorageWriteAt = now
    this.#lastEndReason = 'none'
    this.#emit('learner-authenticated', now)
    return record
  }

  restore(): LearnerSessionCheck {
    let serialized: string | null
    try {
      serialized = this.#storage.getItem(LEARNER_SESSION_STORAGE_KEY)
    } catch {
      return this.#end('storage-unavailable')
    }
    if (serialized === null) return this.#end('none', false)
    let parsed: ParsedLearnerSession | null
    try {
      parsed = parseLearnerSessionRecord(JSON.parse(serialized))
    } catch {
      parsed = null
    }
    if (!parsed) return this.#end('malformed-record')
    this.#session = parsed.record
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = parsed.lastMeaningfulActivityAt
    this.#lastEndReason = 'none'
    return this.recheck()
  }

  recheck(): LearnerSessionCheck {
    if (!this.#session) return Object.freeze({ status: 'ended', reason: this.#lastEndReason })
    const now = this.#readClockOrEnd()
    if (now === null) return Object.freeze({ status: 'ended', reason: this.#lastEndReason })
    const parsed = parseLearnerSessionRecord(this.#session)
    if (!parsed) return this.#end('malformed-record', true, now)
    if (
      now < parsed.authenticatedAt ||
      now < parsed.lastMeaningfulActivityAt ||
      (this.#lastObservedAt !== null && now < this.#lastObservedAt)
    ) return this.#end('clock-anomaly', true, now)
    this.#lastObservedAt = now

    const epoch = this.#revocation.currentEpoch()
    if (epoch === null || epoch !== parsed.record.globalRevocationEpoch) {
      return this.#end('global-revocation', true, now)
    }
    if (now >= parsed.absoluteExpiresAt) return this.#end('absolute-expired', true, now)
    if (now - parsed.lastMeaningfulActivityAt >= SECURITY_SESSION_POLICY.learner.idleTimeoutMs) {
      return this.#end('idle-expired', true, now)
    }
    return Object.freeze({ status: 'active', session: this.#session })
  }

  noteMeaningfulActivity(): LearnerSessionCheck {
    const checked = this.recheck()
    if (checked.status !== 'active') return checked
    const now = this.#lastObservedAt as number
    if (Date.parse(checked.session.lastMeaningfulActivityAt) === now) return checked
    this.#session = Object.freeze({
      ...checked.session,
      lastMeaningfulActivityAt: new Date(now).toISOString(),
    })
    if (this.#lastStorageWriteAt === null || now - this.#lastStorageWriteAt >= this.#writeThrottleMs) {
      if (!this.#persist(now)) return Object.freeze({ status: 'ended', reason: this.#lastEndReason })
    }
    return Object.freeze({ status: 'active', session: this.#session })
  }

  flushActivity(): LearnerSessionCheck {
    const checked = this.recheck()
    if (checked.status !== 'active') return checked
    const activityAt = Date.parse(checked.session.lastMeaningfulActivityAt)
    if (activityAt !== this.#lastStorageWriteAt && !this.#persist(this.#lastObservedAt as number)) {
      return Object.freeze({ status: 'ended', reason: this.#lastEndReason })
    }
    return Object.freeze({ status: 'active', session: this.#session as LearnerSessionRecord })
  }

  clearLocal(): void {
    safeRemove(this.#storage, LEARNER_SESSION_STORAGE_KEY)
    this.#session = null
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = null
    this.#lastEndReason = 'none'
  }

  close(): void {
    this.#unsubscribeRevocation()
  }

  get session(): LearnerSessionRecord | null {
    return this.#session
  }

  #readClockOrEnd(): number | null {
    try {
      return requireSafeTimestamp(this.#clock)
    } catch {
      this.#end('clock-anomaly')
      return null
    }
  }

  #persist(now: number): boolean {
    try {
      this.#storage.setItem(LEARNER_SESSION_STORAGE_KEY, JSON.stringify(this.#session))
      this.#lastStorageWriteAt = Date.parse((this.#session as LearnerSessionRecord).lastMeaningfulActivityAt)
      return true
    } catch {
      this.#end('storage-unavailable', true, now)
      return false
    }
  }

  #end(
    reason: LearnerSessionEndReason,
    remove = true,
    occurredAt?: number,
  ): LearnerSessionCheck {
    if (remove) safeRemove(this.#storage, LEARNER_SESSION_STORAGE_KEY)
    const shouldEmit = reason !== 'none' && (this.#session !== null || this.#lastEndReason !== reason)
    this.#session = null
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = null
    this.#lastEndReason = reason
    if (shouldEmit) {
      const type: SecurityLifecycleEventType = reason === 'global-revocation'
        ? 'global-revocation'
        : 'learner-session-expired'
      this.#emit(type, occurredAt)
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

export function createBrowserLearnerSessionController(
  options: Omit<LearnerSessionControllerOptions, 'storage'>,
): LearnerSessionController {
  if (typeof window === 'undefined') throw new Error('Browser session storage is unavailable.')
  let storage: Storage
  try {
    storage = window.sessionStorage
  } catch {
    throw new Error('Browser session storage is unavailable.')
  }
  return new LearnerSessionController({ ...options, storage })
}
