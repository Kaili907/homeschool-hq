import { isUuidV4 } from '../contracts/identifiers'
import type { SecurityLifecycleEvent, SecurityLifecycleEventType } from '../contracts/lifecycle'
import { parseProfileId, type ProfileId } from '../contracts/profileId'
import { SECURITY_SESSION_POLICY } from '../contracts/sessionPolicy'
import {
  createLocalSessionId,
  LOCAL_SESSION_SCHEMA_VERSION,
  type LearnerSessionRecord,
  type LocalSessionId,
} from '../contracts/sessions'
import { SerializedLifecycleDelivery, type SecurityLifecycleSink } from './lifecycleDelivery'
import type { GlobalRevocationNotice, GlobalRevocationSource } from './revocation'
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
export const LEARNER_SESSION_OWNER_LOCK_PREFIX = 'manuel-academy:learner-session-owner:'
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
  | 'ownership-unavailable'
  | 'ownership-conflict'
  | 'idle-expired'
  | 'absolute-expired'
  | 'clock-anomaly'
  | 'global-revocation'

export type LearnerSessionCheck =
  | Readonly<{ status: 'active'; session: LearnerSessionRecord }>
  | Readonly<{ status: 'ended'; reason: LearnerSessionEndReason }>

export interface LearnerSessionOwnershipLock {
  readonly name: string
}

export interface LearnerSessionOwnershipLockManager {
  request<T>(
    name: string,
    options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LearnerSessionOwnershipLock | null) => T | Promise<T>,
  ): Promise<T>
}

export interface LearnerSessionControllerOptions {
  readonly storage: SecurityStorage
  readonly revocation: GlobalRevocationSource
  readonly ownershipLockManager?: LearnerSessionOwnershipLockManager
  readonly clock?: SecurityClock
  readonly randomUUID?: () => string
  readonly activityWriteThrottleMs?: number
  readonly onLifecycleEvent?: SecurityLifecycleSink
}

interface ParsedLearnerSession {
  readonly record: LearnerSessionRecord
  readonly authenticatedAt: number
  readonly lastMeaningfulActivityAt: number
  readonly absoluteExpiresAt: number
}

interface LearnerSessionOwnershipLease {
  release(): Promise<void>
}

function parseLearnerSessionRecord(value: unknown): ParsedLearnerSession | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, LEARNER_SESSION_KEYS)) return null
  if (value.schemaVersion !== LOCAL_SESSION_SCHEMA_VERSION) return null
  if (!isUuidV4(value.sessionId)) return null
  const profileId = parseProfileId(value.profileId)
  if (!profileId) return null
  if (!Number.isSafeInteger(value.globalRevocationEpoch) || Number(value.globalRevocationEpoch) < 0) return null
  const authenticatedAt = parseCanonicalTimestamp(value.authenticatedAt)
  const lastMeaningfulActivityAt = parseCanonicalTimestamp(value.lastMeaningfulActivityAt)
  const absoluteExpiresAt = parseCanonicalTimestamp(value.absoluteExpiresAt)
  if (authenticatedAt === null || lastMeaningfulActivityAt === null || absoluteExpiresAt === null) return null
  if (lastMeaningfulActivityAt < authenticatedAt || lastMeaningfulActivityAt > absoluteExpiresAt) return null
  if (absoluteExpiresAt !== authenticatedAt + SECURITY_SESSION_POLICY.learner.absoluteTimeoutMs) return null
  return {
    record: Object.freeze({ ...value, profileId }) as unknown as LearnerSessionRecord,
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

export function learnerSessionOwnershipLockName(sessionId: LocalSessionId): string {
  if (!isUuidV4(sessionId)) throw new Error('Learner session ID is invalid.')
  return `${LEARNER_SESSION_OWNER_LOCK_PREFIX}${sessionId}`
}

async function acquireLearnerSessionOwnership(
  lockManager: LearnerSessionOwnershipLockManager,
  sessionId: LocalSessionId,
): Promise<LearnerSessionOwnershipLease | null> {
  let resolveAcquired!: (value: boolean) => void
  let resolveRelease!: () => void
  const acquired = new Promise<boolean>((resolve) => { resolveAcquired = resolve })
  const releaseGate = new Promise<void>((resolve) => { resolveRelease = resolve })
  let holder: Promise<unknown>
  try {
    holder = Promise.resolve(lockManager.request(
      learnerSessionOwnershipLockName(sessionId),
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) {
          resolveAcquired(false)
          return
        }
        resolveAcquired(true)
        await releaseGate
      },
    ))
  } catch {
    resolveAcquired(false)
    return null
  }
  const containedHolder = holder.catch(() => {
    resolveAcquired(false)
  })
  if (!await acquired) {
    await containedHolder
    return null
  }
  let released = false
  return Object.freeze({
    release: async () => {
      if (!released) {
        released = true
        resolveRelease()
      }
      await containedHolder
    },
  })
}

/**
 * A tab-scoped learner authorization. The sessionStorage record is only a
 * candidate: authority also requires a dedicated, exclusive Web Lock held for
 * the complete document/session lifetime.
 */
export class LearnerSessionController {
  readonly #storage: SecurityStorage
  readonly #revocation: GlobalRevocationSource
  readonly #ownershipLockManager?: LearnerSessionOwnershipLockManager
  readonly #clock: SecurityClock
  readonly #randomUUID?: () => string
  readonly #writeThrottleMs: number
  readonly #lifecycle: SerializedLifecycleDelivery
  readonly #unsubscribeRevocation: () => void
  #session: LearnerSessionRecord | null = null
  #ownership: LearnerSessionOwnershipLease | null = null
  #pendingOwnership: Promise<LearnerSessionOwnershipLease | null> | null = null
  #lastObservedAt: number | null = null
  #lastStorageWriteAt: number | null = null
  #lastEndReason: LearnerSessionEndReason = 'none'
  #closed = false

  constructor(options: LearnerSessionControllerOptions) {
    this.#storage = options.storage
    this.#revocation = options.revocation
    this.#ownershipLockManager = options.ownershipLockManager
    this.#clock = options.clock ?? systemSecurityClock
    this.#randomUUID = options.randomUUID
    this.#writeThrottleMs = options.activityWriteThrottleMs ?? DEFAULT_LEARNER_ACTIVITY_WRITE_THROTTLE_MS
    if (!Number.isFinite(this.#writeThrottleMs) || this.#writeThrottleMs < 0) {
      throw new Error('Learner activity write throttle is invalid.')
    }
    this.#lifecycle = new SerializedLifecycleDelivery(options.onLifecycleEvent)
    this.#unsubscribeRevocation = this.#revocation.subscribe((notice) => this.#handleRevocation(notice))
  }

  async create(profileIdInput: ProfileId): Promise<LearnerSessionRecord> {
    const profileId = parseProfileId(profileIdInput)
    if (!profileId) throw new Error('Learner profile ID is invalid.')
    if (this.#closed) throw new Error('Learner session controller is closed.')
    await this.clearLocal()
    const sessionId = createLocalSessionId(this.#randomUUID)
    if (!await this.#claimOwnership(sessionId)) {
      throw new Error('Learner session ownership is unavailable.')
    }
    try {
      const now = requireSafeTimestamp(this.#clock)
      const epoch = this.#revocation.currentEpoch()
      if (epoch === null) throw new Error('Global revocation epoch is unavailable.')
      const record: LearnerSessionRecord = Object.freeze({
        schemaVersion: LOCAL_SESSION_SCHEMA_VERSION,
        sessionId,
        profileId,
        authenticatedAt: new Date(now).toISOString(),
        lastMeaningfulActivityAt: new Date(now).toISOString(),
        absoluteExpiresAt: new Date(now + SECURITY_SESSION_POLICY.learner.absoluteTimeoutMs).toISOString(),
        globalRevocationEpoch: epoch,
      })
      const serialized = JSON.stringify(record)
      this.#storage.setItem(LEARNER_SESSION_STORAGE_KEY, serialized)
      if (this.#storage.getItem(LEARNER_SESSION_STORAGE_KEY) !== serialized) {
        throw new Error('Learner session storage could not be verified.')
      }
      this.#session = record
      this.#lastObservedAt = now
      this.#lastStorageWriteAt = now
      this.#lastEndReason = 'none'
      const delivered = await this.#emit('learner-authenticated', now)
      if (!delivered || !this.#session) {
        await this.clearLocal()
        throw new Error('Learner lifecycle delivery failed closed.')
      }
      return record
    } catch (error) {
      await this.clearLocal()
      throw error
    }
  }

  async restore(): Promise<LearnerSessionCheck> {
    if (this.#closed) return Object.freeze({ status: 'ended', reason: 'ownership-unavailable' })
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
    if (!parsed) {
      const ended = this.#end('malformed-record')
      await this.#lifecycle.whenIdle()
      return ended
    }
    if (!this.#ownershipLockManager) {
      const ended = this.#end('ownership-unavailable')
      await this.#lifecycle.whenIdle()
      return ended
    }
    if (!await this.#claimOwnership(parsed.record.sessionId)) {
      const ended = this.#end('ownership-conflict')
      await this.#lifecycle.whenIdle()
      return ended
    }
    this.#session = parsed.record
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = parsed.lastMeaningfulActivityAt
    this.#lastEndReason = 'none'
    const checked = this.recheck()
    if (checked.status === 'ended') await this.#lifecycle.whenIdle()
    return checked
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
      return this.#end('global-revocation', true, now, 'global-revocation')
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

  async clearLocal(): Promise<void> {
    safeRemove(this.#storage, LEARNER_SESSION_STORAGE_KEY)
    this.#session = null
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = null
    this.#lastEndReason = 'none'
    await this.#releaseOwnership()
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    this.#unsubscribeRevocation()
    this.#session = null
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = null
    if (this.#pendingOwnership) await this.#pendingOwnership.catch(() => null)
    await this.#releaseOwnership()
    await this.#lifecycle.whenIdle()
  }

  whenLifecycleIdle(): Promise<void> {
    return this.#lifecycle.whenIdle()
  }

  get lifecycleDeliveryFailed(): boolean {
    return this.#lifecycle.failed
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
    lifecycleType?: SecurityLifecycleEventType,
  ): LearnerSessionCheck {
    if (remove) safeRemove(this.#storage, LEARNER_SESSION_STORAGE_KEY)
    const shouldEmit = reason !== 'none' && (this.#session !== null || this.#lastEndReason !== reason)
    this.#session = null
    this.#lastObservedAt = null
    this.#lastStorageWriteAt = null
    this.#lastEndReason = reason
    void this.#releaseOwnership()
    if (shouldEmit) {
      const type = lifecycleType ?? (
        reason === 'idle-expired' || reason === 'absolute-expired'
          ? 'learner-session-expired'
          : reason === 'global-revocation'
            ? 'global-revocation'
            : 'provenance-loss'
      )
      void this.#emit(type, occurredAt)
    }
    return Object.freeze({ status: 'ended', reason })
  }

  #emit(type: SecurityLifecycleEventType, occurredAt?: number): Promise<boolean> {
    let timestamp = occurredAt
    if (timestamp === undefined) {
      try {
        timestamp = requireSafeTimestamp(this.#clock)
      } catch {
        timestamp = 0
      }
    }
    const event: SecurityLifecycleEvent = Object.freeze({
      type,
      occurredAt: new Date(timestamp).toISOString(),
    })
    return this.#lifecycle.enqueue(event, () => {
      safeRemove(this.#storage, LEARNER_SESSION_STORAGE_KEY)
      this.#session = null
      this.#lastObservedAt = null
      this.#lastStorageWriteAt = null
      void this.#releaseOwnership()
    })
  }

  async #handleRevocation(notice: GlobalRevocationNotice): Promise<void> {
    const session = this.#session
    if (!session || notice.epoch <= session.globalRevocationEpoch) return
    const occurredAt = parseCanonicalTimestamp(notice.occurredAt) ?? undefined
    this.#end('global-revocation', true, occurredAt, notice.cause)
    await this.#lifecycle.whenIdle()
  }

  async #claimOwnership(sessionId: LocalSessionId): Promise<boolean> {
    if (!this.#ownershipLockManager || this.#closed || this.#ownership || this.#pendingOwnership) return false
    const pending = acquireLearnerSessionOwnership(this.#ownershipLockManager, sessionId)
    this.#pendingOwnership = pending
    const ownership = await pending
    if (this.#pendingOwnership === pending) this.#pendingOwnership = null
    if (!ownership) return false
    if (this.#closed) {
      await ownership.release()
      return false
    }
    this.#ownership = ownership
    return true
  }

  #releaseOwnership(): Promise<void> {
    const ownership = this.#ownership
    this.#ownership = null
    return ownership?.release().catch(() => undefined) ?? Promise.resolve()
  }
}

export function createBrowserLearnerSessionController(
  options: Omit<LearnerSessionControllerOptions, 'storage' | 'ownershipLockManager'>,
): LearnerSessionController {
  if (typeof window === 'undefined') throw new Error('Browser session storage is unavailable.')
  let storage: Storage
  try {
    storage = window.sessionStorage
  } catch {
    throw new Error('Browser session storage is unavailable.')
  }
  const ownershipLockManager = (
    navigator as Navigator & { locks?: LearnerSessionOwnershipLockManager }
  ).locks
  if (!ownershipLockManager) throw new Error('Browser learner-session ownership is unavailable.')
  return new LearnerSessionController({ ...options, storage, ownershipLockManager })
}
