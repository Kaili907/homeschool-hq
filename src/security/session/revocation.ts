import type { SecurityLifecycleEventType } from '../contracts/lifecycle'
import { hasExactKeys, type SecurityClock, type SecurityStorage, systemSecurityClock } from './runtime'

export const GLOBAL_REVOCATION_STORAGE_KEY = 'manuel-academy.security.global-revocation-epoch.v1'
export const GLOBAL_REVOCATION_CHANNEL_NAME = 'manuel-academy.security.global-revocation.v1'
export const GLOBAL_REVOCATION_LOCK_NAME = 'manuel-academy.security.global-revocation-epoch.v1'
export const GLOBAL_REVOCATION_NOTICE_VERSION = 1 as const

export const GLOBAL_REVOCATION_CAUSES = Object.freeze([
  'learner-lock',
  'learner-sign-out',
  'learner-switch-start',
  'learner-credential-reset',
  'household-switch',
  'household-sign-out',
  'import-or-replacement',
  'provenance-loss',
  'global-revocation',
] as const satisfies readonly SecurityLifecycleEventType[])

export type GlobalRevocationCause = typeof GLOBAL_REVOCATION_CAUSES[number]

export interface GlobalRevocationNotice {
  readonly schemaVersion: typeof GLOBAL_REVOCATION_NOTICE_VERSION
  readonly epoch: number
  readonly cause: GlobalRevocationCause
  readonly occurredAt: string
}

export interface GlobalRevocationSource {
  currentEpoch(): number | null
  subscribe(listener: () => void): () => void
}

export interface GlobalRevocationPort extends GlobalRevocationSource {
  revoke(cause: GlobalRevocationCause): Promise<GlobalRevocationNotice>
  close(): void
}

export interface RevocationLockManager {
  request<T>(
    name: string,
    options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T>
}

export interface RevocationBroadcastPort {
  postMessage(message: unknown): void
  close(): void
  onmessage: ((event: { readonly data: unknown }) => void) | null
}

export interface RevocationStorageEvent {
  readonly key: string | null
  readonly newValue: string | null
}

export interface RevocationStorageEventSource {
  addEventListener(type: 'storage', listener: (event: RevocationStorageEvent) => void): void
  removeEventListener(type: 'storage', listener: (event: RevocationStorageEvent) => void): void
}

export interface GlobalRevocationCoordinatorOptions {
  readonly storage: SecurityStorage
  readonly clock?: SecurityClock
  readonly channelFactory?: (name: string) => RevocationBroadcastPort | null
  readonly storageEvents?: RevocationStorageEventSource
  readonly lockManager?: RevocationLockManager
}

function parseStoredEpoch(value: string | null): number | null {
  if (value === null) return 0
  if (!/^(0|[1-9]\d*)$/.test(value)) return null
  const epoch = Number(value)
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null
}

function isCause(value: unknown): value is GlobalRevocationCause {
  return typeof value === 'string' && GLOBAL_REVOCATION_CAUSES.includes(value as GlobalRevocationCause)
}

function parseNotice(value: unknown): GlobalRevocationNotice | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!hasExactKeys(record, ['schemaVersion', 'epoch', 'cause', 'occurredAt'])) return null
  if (record.schemaVersion !== GLOBAL_REVOCATION_NOTICE_VERSION) return null
  if (!Number.isSafeInteger(record.epoch) || Number(record.epoch) < 1) return null
  if (!isCause(record.cause)) return null
  if (typeof record.occurredAt !== 'string' || !Number.isFinite(Date.parse(record.occurredAt))) return null
  return record as unknown as GlobalRevocationNotice
}

/**
 * Maintains a non-secret, monotonic device revocation epoch. BroadcastChannel
 * delivers promptly; the durable epoch and storage event remain the fallback.
 */
export class GlobalRevocationCoordinator implements GlobalRevocationPort {
  readonly #storage: SecurityStorage
  readonly #clock: SecurityClock
  readonly #channel: RevocationBroadcastPort | null
  readonly #storageEvents?: RevocationStorageEventSource
  readonly #lockManager?: RevocationLockManager
  readonly #listeners = new Set<() => void>()
  #observedEpoch: number
  #closed = false

  readonly #onStorage = (event: RevocationStorageEvent): void => {
    if (event.key !== GLOBAL_REVOCATION_STORAGE_KEY) return
    const epoch = parseStoredEpoch(event.newValue)
    if (epoch === null || epoch < this.#observedEpoch) {
      this.#notify()
      return
    }
    if (epoch > this.#observedEpoch) {
      this.#observedEpoch = epoch
      this.#notify()
    }
  }

  constructor(options: GlobalRevocationCoordinatorOptions) {
    this.#storage = options.storage
    this.#clock = options.clock ?? systemSecurityClock
    this.#lockManager = options.lockManager
    const initial = parseStoredEpoch(this.#storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY))
    this.#observedEpoch = initial ?? -1
    this.#storageEvents = options.storageEvents
    this.#storageEvents?.addEventListener('storage', this.#onStorage)
    this.#channel = options.channelFactory?.(GLOBAL_REVOCATION_CHANNEL_NAME) ?? null
    if (this.#channel) {
      this.#channel.onmessage = (event) => {
        const notice = parseNotice(event.data)
        if (!notice || notice.epoch <= this.#observedEpoch) return
        this.#observedEpoch = notice.epoch
        this.#notify()
      }
    }
  }

  currentEpoch(): number | null {
    if (this.#closed) return null
    let stored: number | null
    try {
      stored = parseStoredEpoch(this.#storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY))
    } catch {
      return null
    }
    if (stored === null || stored < this.#observedEpoch) return null
    if (stored > this.#observedEpoch) this.#observedEpoch = stored
    return stored
  }

  async revoke(cause: GlobalRevocationCause): Promise<GlobalRevocationNotice> {
    if (!this.#lockManager) {
      throw new Error('Global revocation coordination is unavailable.')
    }
    return this.#lockManager.request(
      GLOBAL_REVOCATION_LOCK_NAME,
      { mode: 'exclusive' },
      () => {
        const current = this.currentEpoch()
        if (current === null || current === Number.MAX_SAFE_INTEGER) {
          throw new Error('Global revocation epoch is unavailable.')
        }
        const now = this.#clock()
        if (!Number.isSafeInteger(now) || now < 0) throw new Error('Security clock is unavailable.')
        const notice: GlobalRevocationNotice = Object.freeze({
          schemaVersion: GLOBAL_REVOCATION_NOTICE_VERSION,
          epoch: current + 1,
          cause,
          occurredAt: new Date(now).toISOString(),
        })
        this.#storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, String(notice.epoch))
        if (parseStoredEpoch(this.#storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY)) !== notice.epoch) {
          throw new Error('Global revocation epoch could not be verified.')
        }
        this.#observedEpoch = notice.epoch
        this.#channel?.postMessage(notice)
        this.#notify()
        return notice
      },
    )
  }

  subscribe(listener: () => void): () => void {
    if (this.#closed) return () => undefined
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#storageEvents?.removeEventListener('storage', this.#onStorage)
    if (this.#channel) {
      this.#channel.onmessage = null
      this.#channel.close()
    }
    this.#listeners.clear()
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener()
  }
}

/** Browser adapter kept separate so tests never depend on ambient tab APIs. */
export function createBrowserGlobalRevocationCoordinator(): GlobalRevocationCoordinator {
  if (typeof window === 'undefined') throw new Error('Browser revocation storage is unavailable.')
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    throw new Error('Browser revocation storage is unavailable.')
  }
  const lockManager = (navigator as Navigator & { locks?: RevocationLockManager }).locks
  if (!lockManager) throw new Error('Browser revocation coordination is unavailable.')
  return new GlobalRevocationCoordinator({
    storage,
    lockManager,
    storageEvents: window as unknown as RevocationStorageEventSource,
    channelFactory: typeof BroadcastChannel === 'undefined'
      ? undefined
      : (name) => new BroadcastChannel(name) as unknown as RevocationBroadcastPort,
  })
}
