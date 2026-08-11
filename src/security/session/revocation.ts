import type { SecurityLifecycleEventType } from '../contracts/lifecycle'
import {
  hasExactKeys,
  parseCanonicalTimestamp,
  requireSafeTimestamp,
  type SecurityClock,
  type SecurityStorage,
  systemSecurityClock,
} from './runtime'

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

export interface GlobalRevocationObservation {
  readonly epoch: number
  readonly notice: GlobalRevocationNotice | null
}

export type GlobalRevocationListener = (
  notice: GlobalRevocationNotice,
) => void | Promise<void>

export interface GlobalRevocationSource {
  currentEpoch(): number | null
  currentRevocation?(): GlobalRevocationObservation | null
  subscribe(listener: GlobalRevocationListener): () => void
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

function parseLegacyEpoch(value: string | null): number | null {
  if (value === null) return 0
  if (!/^(0|[1-9]\d*)$/.test(value)) return null
  const epoch = Number(value)
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null
}

function isCause(value: unknown): value is GlobalRevocationCause {
  return typeof value === 'string' && GLOBAL_REVOCATION_CAUSES.includes(value as GlobalRevocationCause)
}

export function parseGlobalRevocationNotice(value: unknown): GlobalRevocationNotice | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!hasExactKeys(record, ['schemaVersion', 'epoch', 'cause', 'occurredAt'])) return null
  if (record.schemaVersion !== GLOBAL_REVOCATION_NOTICE_VERSION) return null
  if (!Number.isSafeInteger(record.epoch) || Number(record.epoch) < 1) return null
  if (!isCause(record.cause)) return null
  if (parseCanonicalTimestamp(record.occurredAt) === null) return null
  return Object.freeze(record as unknown as GlobalRevocationNotice)
}

function parseStoredNotice(value: string | null): GlobalRevocationNotice | null {
  if (value === null) return null
  try {
    return parseGlobalRevocationNotice(JSON.parse(value))
  } catch {
    return null
  }
}

function parseStoredRevocation(value: string | null): GlobalRevocationObservation | null {
  const legacy = parseLegacyEpoch(value)
  if (legacy !== null) return Object.freeze({ epoch: legacy, notice: null })
  const notice = parseStoredNotice(value)
  return notice === null ? null : Object.freeze({ epoch: notice.epoch, notice })
}

function parseRevocationEpochHint(value: unknown): number | null {
  if (typeof value === 'string') {
    const legacy = parseLegacyEpoch(value)
    if (legacy !== null) return legacy
    try {
      return parseRevocationEpochHint(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const epoch = (value as Record<string, unknown>).epoch
  return Number.isSafeInteger(epoch) && Number(epoch) >= 1 ? Number(epoch) : null
}

function parseRevocationTransport(
  value: unknown,
  source: 'storage' | 'channel',
): GlobalRevocationObservation | null {
  if (source === 'storage') {
    return typeof value === 'string' || value === null ? parseStoredRevocation(value) : null
  }
  const notice = parseGlobalRevocationNotice(value)
  return notice === null ? null : Object.freeze({ epoch: notice.epoch, notice })
}

export function getCurrentGlobalRevocation(
  source: GlobalRevocationSource,
): GlobalRevocationObservation | null {
  if (source.currentRevocation) {
    const observation = source.currentRevocation()
    if (!observation || !Number.isSafeInteger(observation.epoch) || observation.epoch < 0) return null
    if (observation.notice === null) {
      return Object.freeze({ epoch: observation.epoch, notice: null })
    }
    const notice = parseGlobalRevocationNotice(observation.notice)
    if (!notice || notice.epoch !== observation.epoch) return null
    return Object.freeze({ epoch: observation.epoch, notice })
  }
  const epoch = source.currentEpoch()
  return epoch === null ? null : Object.freeze({ epoch, notice: null })
}

/**
 * Maintains a non-secret, monotonic device revocation epoch. New writes persist
 * the complete causeful envelope in the existing durable slot; numeric legacy
 * epochs remain readable and are delivered with the generic fail-closed cause.
 *
 * Lock order: callers must release learner-session ownership before requesting
 * this revocation lock. This coordinator never acquires an ownership or PIN lock.
 */
export class GlobalRevocationCoordinator implements GlobalRevocationPort {
  readonly #storage: SecurityStorage
  readonly #clock: SecurityClock
  readonly #channel: RevocationBroadcastPort | null
  readonly #storageEvents?: RevocationStorageEventSource
  readonly #lockManager?: RevocationLockManager
  readonly #listeners = new Set<GlobalRevocationListener>()
  #deliveryTail: Promise<void> = Promise.resolve()
  #observedEpoch: number
  #terminallyInvalid = false
  #closed = false

  readonly #onStorage = (event: RevocationStorageEvent): void => {
    if (event.key !== GLOBAL_REVOCATION_STORAGE_KEY || this.#closed) return
    this.#reconcileTransport(event.newValue, 'storage')
  }

  constructor(options: GlobalRevocationCoordinatorOptions) {
    this.#storage = options.storage
    this.#clock = options.clock ?? systemSecurityClock
    this.#lockManager = options.lockManager
    const initial = parseStoredRevocation(this.#storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY))
    this.#observedEpoch = initial?.epoch ?? -1
    this.#storageEvents = options.storageEvents
    this.#storageEvents?.addEventListener('storage', this.#onStorage)
    this.#channel = options.channelFactory?.(GLOBAL_REVOCATION_CHANNEL_NAME) ?? null
    if (this.#channel) {
      this.#channel.onmessage = (event) => {
        if (this.#closed) return
        this.#reconcileTransport(event.data, 'channel')
      }
    }
  }

  currentRevocation(): GlobalRevocationObservation | null {
    if (this.#closed || this.#terminallyInvalid) return null
    const stored = this.#readDurableRevocation()
    if (stored === null || stored.epoch < this.#observedEpoch) return null
    if (stored.epoch > this.#observedEpoch) this.#acceptDurable(stored)
    return stored
  }

  currentEpoch(): number | null {
    return this.currentRevocation()?.epoch ?? null
  }

  async revoke(cause: GlobalRevocationCause): Promise<GlobalRevocationNotice> {
    if (!isCause(cause)) throw new Error('Global revocation cause is invalid.')
    if (!this.#lockManager) {
      throw new Error('Global revocation coordination is unavailable.')
    }
    return this.#lockManager.request(
      GLOBAL_REVOCATION_LOCK_NAME,
      { mode: 'exclusive' },
      async () => {
        const current = this.currentEpoch()
        if (current === null || current === Number.MAX_SAFE_INTEGER) {
          throw new Error('Global revocation epoch is unavailable.')
        }
        const now = requireSafeTimestamp(this.#clock)
        const notice: GlobalRevocationNotice = Object.freeze({
          schemaVersion: GLOBAL_REVOCATION_NOTICE_VERSION,
          epoch: current + 1,
          cause,
          occurredAt: new Date(now).toISOString(),
        })
        const serialized = JSON.stringify(notice)
        this.#storage.setItem(GLOBAL_REVOCATION_STORAGE_KEY, serialized)
        const verified = parseStoredNotice(this.#storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY))
        if (
          !verified ||
          verified.epoch !== notice.epoch ||
          verified.cause !== notice.cause ||
          verified.occurredAt !== notice.occurredAt
        ) {
          throw new Error('Global revocation epoch could not be verified.')
        }
        this.#observedEpoch = notice.epoch
        try {
          this.#channel?.postMessage(notice)
        } catch {
          // The durable envelope and storage event remain the cross-tab path.
        }
        await this.#enqueueDelivery(notice)
        return notice
      },
    )
  }

  subscribe(listener: GlobalRevocationListener): () => void {
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

  #genericNotice(epoch: number): GlobalRevocationNotice {
    let now = 0
    try {
      now = requireSafeTimestamp(this.#clock)
    } catch {
      // Epoch and generic cause are sufficient for fail-closed delivery.
    }
    return Object.freeze({
      schemaVersion: GLOBAL_REVOCATION_NOTICE_VERSION,
      epoch: Math.max(1, epoch),
      cause: 'global-revocation',
      occurredAt: new Date(now).toISOString(),
    })
  }

  #readDurableRevocation(): GlobalRevocationObservation | null {
    try {
      return parseStoredRevocation(this.#storage.getItem(GLOBAL_REVOCATION_STORAGE_KEY))
    } catch {
      return null
    }
  }

  #acceptDurable(observation: GlobalRevocationObservation): void {
    if (observation.epoch <= this.#observedEpoch) return
    if (observation.epoch === 0) {
      this.#observedEpoch = 0
      return
    }
    this.#enqueueDelivery(observation.notice ?? this.#genericNotice(observation.epoch))
    this.#observedEpoch = observation.epoch
  }

  #acceptGeneric(epoch: number): void {
    if (epoch <= this.#observedEpoch) return
    this.#enqueueDelivery(this.#genericNotice(epoch))
    this.#observedEpoch = epoch
  }

  #reconcileTransport(value: unknown, source: 'storage' | 'channel'): void {
    const previouslyObserved = this.#observedEpoch
    const durable = this.#readDurableRevocation()
    if (durable && durable.epoch > this.#observedEpoch) this.#acceptDurable(durable)

    if (durable && durable.epoch < previouslyObserved) {
      this.#deliverMalformed()
      return
    }

    const transport = parseRevocationTransport(value, source)
    const hintedEpoch = parseRevocationEpochHint(value)
    if (durable === null) {
      const unavailableEpoch = transport?.epoch ?? hintedEpoch
      if (unavailableEpoch !== null && unavailableEpoch > this.#observedEpoch) {
        this.#acceptGeneric(unavailableEpoch)
      } else {
        this.#deliverMalformed()
      }
      return
    }

    if (transport === null) {
      if (
        durable.epoch > previouslyObserved &&
        (hintedEpoch === null || hintedEpoch <= durable.epoch)
      ) return
      if (hintedEpoch !== null && hintedEpoch > this.#observedEpoch) {
        this.#acceptGeneric(hintedEpoch)
      } else {
        this.#deliverMalformed()
      }
      return
    }

    if (transport.epoch <= this.#observedEpoch) return
    if (durable.epoch >= transport.epoch) return
    this.#acceptGeneric(transport.epoch)
  }

  #deliverMalformed(): void {
    if (this.#observedEpoch === Number.MAX_SAFE_INTEGER) {
      if (this.#terminallyInvalid) return
      this.#terminallyInvalid = true
      this.#enqueueDelivery(this.#genericNotice(Number.MAX_SAFE_INTEGER))
      return
    }
    this.#acceptGeneric(Math.max(1, this.#observedEpoch + 1))
  }

  #enqueueDelivery(notice: GlobalRevocationNotice): Promise<void> {
    const listeners = [...this.#listeners]
    const delivery = this.#deliveryTail.then(async () => {
      for (const listener of listeners) {
        try {
          await listener(notice)
        } catch {
          // Subscribers own fail-closed cleanup; contain their delivery failure.
        }
      }
    })
    this.#deliveryTail = delivery.catch(() => undefined)
    return this.#deliveryTail
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
