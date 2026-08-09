import type { AcademySyncTerminalState } from '../security/contracts'
import type {
  ServiceWorkerUpdatePort,
  ServiceWorkerUpdateSnapshot,
} from './serviceWorkerUpdates'

export const UPDATE_REQUIRED_MESSAGE =
  'Manuel Academy has been updated. Refresh to continue.' as const
export const SYNC_MAINTENANCE_MESSAGE =
  'Cloud sync is temporarily paused. Your work is saved on this device.' as const
export const UPDATE_ATTEMPT_STORAGE_KEY =
  'manuel-academy:update-attempt:v1' as const

export type SyncWriteIntent =
  | 'automatic'
  | 'debounced'
  | 'reconnect'
  | 'manual'

export type SyncCompatibilitySignal =
  | Readonly<{
      status: 'normal'
      syncProtocolVersion: number
    }>
  | AcademySyncTerminalState

export interface SyncWritePolicy {
  readonly automatic: 'enabled' | 'paused' | 'stopped'
  readonly debounced: 'enabled' | 'paused' | 'stopped'
  readonly reconnect: 'enabled' | 'paused' | 'stopped'
  readonly manual: 'enabled' | 'paused' | 'stopped'
  readonly retry: 'enabled' | 'disabled'
}

interface ClientUpdateStateBase {
  readonly online: boolean
  readonly localLearning: 'available'
  readonly worker: ServiceWorkerUpdateSnapshot
  readonly sync: SyncWritePolicy
}

export interface NormalClientUpdateState extends ClientUpdateStateBase {
  readonly status: 'normal'
  readonly terminal: false
  readonly message: null
  readonly detail: null
  readonly refresh: 'not-required'
}

export interface MaintenanceClientUpdateState extends ClientUpdateStateBase {
  readonly status: 'maintenance'
  readonly terminal: false
  readonly message: typeof SYNC_MAINTENANCE_MESSAGE
  readonly detail: null
  readonly refresh: 'not-required'
  readonly retryAfter?: string
}

export type UpdateRefreshState =
  | 'preparing'
  | 'available'
  | 'persistence-failed'
  | 'loop-prevented'
  | 'storage-unavailable'
  | 'waiting-for-worker'
  | 'reloading'

export interface UpdateRequiredClientState extends ClientUpdateStateBase {
  readonly status: 'update-required'
  readonly terminal: true
  readonly message: typeof UPDATE_REQUIRED_MESSAGE
  readonly detail: string | null
  readonly refresh: UpdateRefreshState
  readonly syncProtocolVersion: number
  readonly minimumSupportedSyncVersion: number
}

export type ClientUpdateState =
  | NormalClientUpdateState
  | MaintenanceClientUpdateState
  | UpdateRequiredClientState

export type SyncWriteResult<T> =
  | Readonly<{ started: true; value: T }>
  | Readonly<{
      started: false
      reason: 'offline' | 'maintenance' | 'update-required'
    }>

export type RefreshRequestResult = Readonly<
  | { accepted: true; waitingForWorker: boolean }
  | {
      accepted: false
      reason:
        | 'not-required'
        | 'not-ready'
        | 'loop-prevented'
        | 'storage-unavailable'
        | 'already-requested'
    }
>

export interface UpdateAttemptStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ClientUpdateCoordinatorOptions {
  readonly clientSyncProtocolVersion: number
  readonly workerUpdates: ServiceWorkerUpdatePort
  readonly storage: UpdateAttemptStorage | null
  readonly persistEducationalState: () => void | Promise<void>
  readonly reload: () => void
  readonly online?: boolean
}

interface UpdateAttemptMetadata {
  readonly clientSyncProtocolVersion: number
  readonly serverSyncProtocolVersion: number
  readonly minimumSupportedSyncVersion: number
}

const normalSync: SyncWritePolicy = Object.freeze({
  automatic: 'enabled',
  debounced: 'enabled',
  reconnect: 'enabled',
  manual: 'enabled',
  retry: 'enabled',
})

const maintenanceSync: SyncWritePolicy = Object.freeze({
  automatic: 'paused',
  debounced: 'paused',
  reconnect: 'paused',
  manual: 'paused',
  retry: 'disabled',
})

const stoppedSync: SyncWritePolicy = Object.freeze({
  automatic: 'stopped',
  debounced: 'stopped',
  reconnect: 'stopped',
  manual: 'stopped',
  retry: 'disabled',
})

const loopDetail =
  'This browser already tried this protocol update, but the same client is still running. Cloud sync remains stopped.'
const storageDetail =
  'Refresh is blocked because this browser cannot safely prevent a reload loop. Cloud sync remains stopped.'
const persistenceDetail =
  'Refresh is blocked until educational work has been safely persisted on this device.'

function normalState(
  online: boolean,
  worker: ServiceWorkerUpdateSnapshot,
): NormalClientUpdateState {
  return {
    status: 'normal',
    terminal: false,
    online,
    localLearning: 'available',
    message: null,
    detail: null,
    refresh: 'not-required',
    worker,
    sync: normalSync,
  }
}

function sameAttempt(
  left: UpdateAttemptMetadata,
  right: UpdateAttemptMetadata,
): boolean {
  return (
    left.clientSyncProtocolVersion === right.clientSyncProtocolVersion &&
    left.serverSyncProtocolVersion === right.serverSyncProtocolVersion &&
    left.minimumSupportedSyncVersion === right.minimumSupportedSyncVersion
  )
}

function parseAttempt(value: string | null): UpdateAttemptMetadata | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const record = parsed as Record<string, unknown>
    const keys = Object.keys(record).sort()
    if (
      keys.join(',') !==
      'clientSyncProtocolVersion,minimumSupportedSyncVersion,serverSyncProtocolVersion'
    ) {
      return null
    }
    const client = record.clientSyncProtocolVersion
    const server = record.serverSyncProtocolVersion
    const minimum = record.minimumSupportedSyncVersion
    if (
      !Number.isSafeInteger(client) ||
      !Number.isSafeInteger(server) ||
      !Number.isSafeInteger(minimum)
    ) {
      return null
    }
    return {
      clientSyncProtocolVersion: client as number,
      serverSyncProtocolVersion: server as number,
      minimumSupportedSyncVersion: minimum as number,
    }
  } catch {
    return null
  }
}

/**
 * Fail-closed bridge between Sync V2 compatibility state and a user-approved
 * service-worker refresh. It performs no sync operation and owns no credentials.
 */
export class ClientUpdateCoordinator {
  readonly #listeners = new Set<(state: ClientUpdateState) => void>()
  #state: ClientUpdateState
  #attempt: UpdateAttemptMetadata | null = null
  #preparation: Promise<void> = Promise.resolve()
  #terminalAbort = new AbortController()
  #reloadExecuted = false

  constructor(private readonly options: ClientUpdateCoordinatorOptions) {
    if (!Number.isSafeInteger(options.clientSyncProtocolVersion)) {
      throw new Error('A numeric client sync protocol version is required.')
    }
    this.#state = normalState(options.online ?? true, options.workerUpdates.state)
    options.workerUpdates.subscribe((worker) => {
      this.#state = { ...this.#state, worker } as ClientUpdateState
      this.#emit()
      if (
        this.#state.status === 'update-required' &&
        this.#state.refresh === 'waiting-for-worker' &&
        worker.controllerChanged
      ) {
        this.#reloadOnce()
      }
    })
  }

  get state(): ClientUpdateState {
    return this.#state
  }

  get syncAbortSignal(): AbortSignal {
    return this.#terminalAbort.signal
  }

  subscribe(listener: (state: ClientUpdateState) => void): () => void {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  reportSyncCompatibility(signal: SyncCompatibilitySignal): void {
    if (this.#state.status === 'update-required') return

    if (signal.status === 'normal') {
      this.#terminalAbort = new AbortController()
      this.#state = normalState(this.#state.online, this.options.workerUpdates.state)
      this.#emit()
      return
    }

    this.#terminalAbort.abort(signal.status)
    if (signal.status === 'maintenance') {
      this.#state = {
        status: 'maintenance',
        terminal: false,
        online: this.#state.online,
        localLearning: 'available',
        message: SYNC_MAINTENANCE_MESSAGE,
        detail: null,
        refresh: 'not-required',
        worker: this.options.workerUpdates.state,
        sync: maintenanceSync,
        ...(signal.retryAfter ? { retryAfter: signal.retryAfter } : {}),
      }
      this.#emit()
      return
    }

    this.#attempt = {
      clientSyncProtocolVersion: this.options.clientSyncProtocolVersion,
      serverSyncProtocolVersion: signal.syncProtocolVersion,
      minimumSupportedSyncVersion: signal.minimumSupportedSyncVersion,
    }
    const previousAttempt = this.#readAttempt()
    const blockedRefresh =
      previousAttempt === 'storage-unavailable'
        ? 'storage-unavailable'
        : previousAttempt && sameAttempt(previousAttempt, this.#attempt)
          ? 'loop-prevented'
          : null

    this.#state = {
      status: 'update-required',
      terminal: true,
      online: this.#state.online,
      localLearning: 'available',
      message: UPDATE_REQUIRED_MESSAGE,
      detail:
        blockedRefresh === 'loop-prevented'
          ? loopDetail
          : blockedRefresh === 'storage-unavailable'
            ? storageDetail
            : null,
      refresh: blockedRefresh ?? 'preparing',
      worker: this.options.workerUpdates.state,
      sync: stoppedSync,
      syncProtocolVersion: signal.syncProtocolVersion,
      minimumSupportedSyncVersion: signal.minimumSupportedSyncVersion,
    }
    this.#emit()
    this.#preparation = this.#prepare(blockedRefresh)
  }

  setOnline(online: boolean): void {
    if (this.#state.online === online) return
    if (!online) this.#terminalAbort.abort('offline')
    if (online && this.#state.status === 'normal') {
      this.#terminalAbort = new AbortController()
    }
    this.#state = { ...this.#state, online } as ClientUpdateState
    this.#emit()
  }

  async whenPrepared(): Promise<void> {
    await this.#preparation
  }

  async runSyncWrite<T>(
    _intent: SyncWriteIntent,
    operation: (signal: AbortSignal) => T | Promise<T>,
  ): Promise<SyncWriteResult<T>> {
    if (this.#state.status === 'update-required') {
      return { started: false, reason: 'update-required' }
    }
    if (this.#state.status === 'maintenance') {
      return { started: false, reason: 'maintenance' }
    }
    if (!this.#state.online) return { started: false, reason: 'offline' }
    return { started: true, value: await operation(this.#terminalAbort.signal) }
  }

  async requestRefresh(): Promise<RefreshRequestResult> {
    if (this.#state.status !== 'update-required') {
      return { accepted: false, reason: 'not-required' }
    }
    await this.#preparation
    if (this.#state.status !== 'update-required') {
      return { accepted: false, reason: 'not-required' }
    }
    if (this.#state.refresh === 'loop-prevented') {
      return { accepted: false, reason: 'loop-prevented' }
    }
    if (this.#state.refresh === 'storage-unavailable') {
      return { accepted: false, reason: 'storage-unavailable' }
    }
    if (
      this.#state.refresh === 'waiting-for-worker' ||
      this.#state.refresh === 'reloading'
    ) {
      return { accepted: false, reason: 'already-requested' }
    }
    if (this.#state.refresh !== 'available' || !this.#attempt) {
      return { accepted: false, reason: 'not-ready' }
    }
    if (!this.#writeAttempt(this.#attempt)) {
      this.#setRefresh('storage-unavailable', storageDetail)
      return { accepted: false, reason: 'storage-unavailable' }
    }

    const waitingForWorker =
      await this.options.workerUpdates.activateWaitingWorker()
    if (
      waitingForWorker &&
      !this.options.workerUpdates.state.controllerChanged
    ) {
      this.#setRefresh('waiting-for-worker', null)
      return { accepted: true, waitingForWorker: true }
    }
    this.#reloadOnce()
    return { accepted: true, waitingForWorker: false }
  }

  async #prepare(
    blockedRefresh: 'loop-prevented' | 'storage-unavailable' | null,
  ): Promise<void> {
    try {
      await this.options.persistEducationalState()
    } catch {
      this.#setRefresh('persistence-failed', persistenceDetail)
      return
    }
    await this.options.workerUpdates.requestUpdate()
    if (this.#state.status !== 'update-required') return
    if (blockedRefresh === 'loop-prevented') {
      this.#setRefresh('loop-prevented', loopDetail)
    } else if (blockedRefresh === 'storage-unavailable') {
      this.#setRefresh('storage-unavailable', storageDetail)
    } else {
      this.#setRefresh('available', null)
    }
  }

  #readAttempt(): UpdateAttemptMetadata | 'storage-unavailable' | null {
    if (!this.options.storage) return 'storage-unavailable'
    try {
      return parseAttempt(
        this.options.storage.getItem(UPDATE_ATTEMPT_STORAGE_KEY),
      )
    } catch {
      return 'storage-unavailable'
    }
  }

  #writeAttempt(attempt: UpdateAttemptMetadata): boolean {
    if (!this.options.storage) return false
    try {
      this.options.storage.setItem(
        UPDATE_ATTEMPT_STORAGE_KEY,
        JSON.stringify(attempt),
      )
      return true
    } catch {
      return false
    }
  }

  #setRefresh(refresh: UpdateRefreshState, detail: string | null): void {
    if (this.#state.status !== 'update-required') return
    this.#state = { ...this.#state, refresh, detail }
    this.#emit()
  }

  #reloadOnce(): void {
    if (this.#reloadExecuted) return
    this.#reloadExecuted = true
    this.#setRefresh('reloading', null)
    this.options.reload()
  }

  #emit(): void {
    for (const listener of this.#listeners) listener(this.#state)
  }
}
