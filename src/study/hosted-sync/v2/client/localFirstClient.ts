import { isHostedSyncOperationId, parseHostedSyncSnapshot } from './contracts'
import {
  HOSTED_SYNC_MAX_ATTEMPTS,
  completeQueuedOperation,
  enqueueAcknowledgement,
  enqueueFirstLinkImport,
  enqueueRevisionedWrite,
  isHostedSyncRetryable,
  recordQueuedRetry,
  type HostedSyncDurableQueueStore,
  type HostedSyncQueueEntry,
} from './queue'
import type {
  HostedSyncFailure,
  HostedSyncIdentity,
  HostedSyncOutcome,
  HostedSyncRpcAdapter,
  HostedSyncSnapshot,
} from './types'

export interface HostedSyncCanonicalLocalPort {
  /** Reads the already-durable IndexedDB authority at send time. */
  readCanonicalSnapshot(identity: HostedSyncIdentity): Promise<HostedSyncSnapshot>
  /** Must not resolve until the hydrated snapshot is durable in IndexedDB. */
  applyHydratedSnapshot(input: {
    readonly identity: HostedSyncIdentity
    readonly snapshot: HostedSyncSnapshot
    readonly serverRevision: number
  }): Promise<Readonly<{ status: 'DURABLE' }>>
}

export interface HostedSyncLocalFirstClient {
  recordFirstLinkAfterLocalSave(input: {
    readonly localSaveConfirmed: true
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED'
    readonly confirmedAt: string
  }): Promise<Readonly<{ status: 'QUEUED'; operationId: string }>>
  recordWriteAfterLocalSave(input: {
    readonly localSaveConfirmed: true
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly baseRevision: number
  }): Promise<Readonly<{ status: 'QUEUED'; operationId: string }>>
  hydrate(
    identity: HostedSyncIdentity,
    signal?: AbortSignal,
  ): Promise<HostedSyncOutcome<HostedSyncHydrateApplied>>
  flushNext(signal?: AbortSignal): Promise<HostedSyncOutcome<HostedSyncFlushSuccess>>
}

export type HostedSyncHydrateApplied =
  | Readonly<{ status: 'UNAVAILABLE' }>
  | Readonly<{
      status: 'HYDRATED_AND_ACK_QUEUED'
      serverRevision: number
      acknowledgementOperationId: string
    }>

export type HostedSyncFlushSuccess =
  | Readonly<{ status: 'NO_WORK' | 'RETRY_WAIT' }>
  | Readonly<{
      status: 'SYNCED'
      operationId: string
      serverRevision: number
      duplicate: boolean
    }>

export interface CreateHostedSyncLocalFirstClientOptions {
  readonly rpc: HostedSyncRpcAdapter
  readonly queue: HostedSyncDurableQueueStore
  readonly local: HostedSyncCanonicalLocalPort
  readonly operationId: () => string
  readonly now?: () => Date
}

function success<T>(value: T): HostedSyncOutcome<T> {
  return Object.freeze({ code: 'SUCCESS' as const, value })
}

function refusal(reasonCode: string): HostedSyncFailure {
  return Object.freeze({
    code: 'PERMANENT_REFUSAL',
    httpStatus: null,
    retryAfterMs: null,
    serverRevision: null,
    reasonCode,
  })
}

function retryDelay(attempts: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return Math.min(Math.max(retryAfterMs, 1_000), 300_000)
  return Math.min(2 ** Math.min(attempts, 8) * 1_000, 300_000)
}

export function createHostedSyncLocalFirstClient(
  options: CreateHostedSyncLocalFirstClientOptions,
): HostedSyncLocalFirstClient {
  const now = options.now ?? (() => new Date())

  async function recordFirstLinkAfterLocalSave(input: {
    readonly localSaveConfirmed: true
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED'
    readonly confirmedAt: string
  }) {
    if (input.localSaveConfirmed !== true) {
      throw new Error('Local IndexedDB durability must be confirmed before first-link import is queued.')
    }
    await options.queue.update((state) => enqueueFirstLinkImport(state, {
      identity: input.identity,
      operationId: input.operationId,
      adultConfirmation: input.adultConfirmation,
      confirmedAt: input.confirmedAt,
      createdAt: now().toISOString(),
    }))
    return Object.freeze({ status: 'QUEUED' as const, operationId: input.operationId })
  }

  async function recordWriteAfterLocalSave(input: {
    readonly localSaveConfirmed: true
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly baseRevision: number
  }) {
    if (input.localSaveConfirmed !== true) {
      throw new Error('Local IndexedDB durability must be confirmed before hosted write is queued.')
    }
    await options.queue.update((state) => enqueueRevisionedWrite(state, {
      identity: input.identity,
      operationId: input.operationId,
      baseRevision: input.baseRevision,
      createdAt: now().toISOString(),
    }))
    return Object.freeze({ status: 'QUEUED' as const, operationId: input.operationId })
  }

  async function dispatch(entry: HostedSyncQueueEntry, signal?: AbortSignal) {
    if (entry.kind === 'ACKNOWLEDGEMENT') {
      return options.rpc.acknowledge({
        identity: entry.identity,
        operationId: entry.operationId,
        acknowledgedOperationId: entry.acknowledgedOperationId,
        serverRevision: entry.serverRevision,
      }, signal)
    }
    let snapshot: HostedSyncSnapshot
    try {
      snapshot = await options.local.readCanonicalSnapshot(entry.identity)
    } catch {
      return refusal('CANONICAL_LOCAL_SNAPSHOT_UNAVAILABLE')
    }
    if (!parseHostedSyncSnapshot(snapshot, entry.identity)) {
      return refusal('CANONICAL_LOCAL_SNAPSHOT_REFUSED')
    }
    return entry.kind === 'FIRST_LINK_IMPORT'
      ? options.rpc.firstLinkImport({
          identity: entry.identity,
          operationId: entry.operationId,
          baseRevision: entry.baseRevision,
          adultConfirmation: entry.adultConfirmation,
          confirmedAt: entry.confirmedAt,
          snapshot,
        }, signal)
      : options.rpc.revisionedWrite({
          identity: entry.identity,
          operationId: entry.operationId,
          baseRevision: entry.baseRevision,
          snapshot,
        }, signal)
  }

  async function flushNext(signal?: AbortSignal): Promise<HostedSyncOutcome<HostedSyncFlushSuccess>> {
    const state = await options.queue.read()
    const entry = state.entries[0]
    if (!entry) return success(Object.freeze({ status: 'NO_WORK' as const }))
    if (entry.attempts >= HOSTED_SYNC_MAX_ATTEMPTS) return refusal('BOUNDED_RETRY_EXHAUSTED')
    if (entry.nextAttemptAt !== null && Date.parse(entry.nextAttemptAt) > now().getTime()) {
      return success(Object.freeze({ status: 'RETRY_WAIT' as const }))
    }
    const outcome = await dispatch(entry, signal)
    if (outcome.code === 'SUCCESS') {
      await options.queue.update((current) => completeQueuedOperation(current, entry.operationId))
      return success(Object.freeze({
        status: 'SYNCED' as const,
        operationId: entry.operationId,
        serverRevision: outcome.value.serverRevision,
        duplicate: outcome.value.duplicate,
      }))
    }
    if (!isHostedSyncRetryable(outcome.code)) return outcome
    const attempts = entry.attempts + 1
    if (attempts >= HOSTED_SYNC_MAX_ATTEMPTS) {
      await options.queue.update((current) => recordQueuedRetry(
        current,
        entry.operationId,
        now().toISOString(),
      ))
      return refusal('BOUNDED_RETRY_EXHAUSTED')
    }
    const retryAt = new Date(now().getTime() + retryDelay(attempts, outcome.retryAfterMs)).toISOString()
    await options.queue.update((current) => recordQueuedRetry(current, entry.operationId, retryAt))
    return outcome
  }

  async function hydrate(
    identity: HostedSyncIdentity,
    signal?: AbortSignal,
  ): Promise<HostedSyncOutcome<HostedSyncHydrateApplied>> {
    const outcome = await options.rpc.hydrate({ identity }, signal)
    if (outcome.code !== 'SUCCESS') return outcome
    if (outcome.value.status === 'UNAVAILABLE') return success(Object.freeze({ status: 'UNAVAILABLE' as const }))
    const ready = outcome.value
    const applied = await options.local.applyHydratedSnapshot({
      identity,
      snapshot: ready.snapshot,
      serverRevision: ready.serverRevision,
    })
    if (applied.status !== 'DURABLE') return refusal('HYDRATE_NOT_DURABLE')
    const acknowledgementOperationId = options.operationId()
    if (!isHostedSyncOperationId(acknowledgementOperationId)) {
      return refusal('ACKNOWLEDGEMENT_OPERATION_ID_INVALID')
    }
    await options.queue.update((state) => enqueueAcknowledgement(state, {
      identity,
      operationId: acknowledgementOperationId,
      acknowledgedOperationId: ready.lastOperationId,
      serverRevision: ready.serverRevision,
      createdAt: now().toISOString(),
    }))
    return success(Object.freeze({
      status: 'HYDRATED_AND_ACK_QUEUED' as const,
      serverRevision: ready.serverRevision,
      acknowledgementOperationId,
    }))
  }

  return Object.freeze({
    recordFirstLinkAfterLocalSave,
    recordWriteAfterLocalSave,
    hydrate,
    flushNext,
  })
}
