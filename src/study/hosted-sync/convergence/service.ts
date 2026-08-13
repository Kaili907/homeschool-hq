import type { StudyCheckpointRecord } from '../../contracts/persistence/types'
import type { DurableStudyDocumentV1 } from '../../family-pilot/durable-ports'
import { applyHostedHydrateToDurableStudyDocument, type HostedStudyCanonicalLocalStore } from './localStudyAdapter'
import type { HostedStudyRpcClient, HostedStudyRpcHydrateDocument, HostedStudyRpcScope } from './rpcTypes'
import {
  HOSTED_STUDY_SYNC_MAX_ACKNOWLEDGED_IDS,
  HOSTED_STUDY_SYNC_MAX_ATTEMPTS,
  enqueueHostedStudyOperation,
  type HostedStudyLocalSyncState,
  type HostedStudyRpcOperation,
  type HostedStudySyncMetadataStore,
} from './syncMetadata'

export interface HostedStudyAuthorityProjectionSink {
  /** Must durably preserve safety, guardian attestation, and source readiness. */
  apply(remote: HostedStudyRpcHydrateDocument): Promise<void>
}

export type HostedStudyServiceOutcome =
  | Readonly<{ status: 'LOCAL_SAVED_AND_QUEUED'; operationId: string }>
  | Readonly<{ status: 'SYNCED' | 'HYDRATED'; serverRevision: number }>
  | Readonly<{ status: 'NO_WORK' }>
  | Readonly<{ status: 'OFFLINE_QUEUED' | 'SERVER_UNAVAILABLE' | 'AUTH_REQUIRED' | 'CONFLICT' | 'REFUSED' | 'EXHAUSTED'; reason: string }>

export interface HostedStudyConvergenceService {
  recordAfterLocalSave(input: {
    readonly localSaveConfirmed: true
    readonly operationId: string
    readonly operation: HostedStudyRpcOperation
    readonly actorRole: 'student' | 'parent'
  }): Promise<HostedStudyServiceOutcome>
  sync(signal?: AbortSignal): Promise<HostedStudyServiceOutcome>
  hydrate(signal?: AbortSignal): Promise<HostedStudyServiceOutcome>
  logout(): void
}

export interface CreateHostedStudyConvergenceServiceOptions {
  readonly scope: HostedStudyRpcScope
  readonly metadata: HostedStudySyncMetadataStore
  readonly localStudy: HostedStudyCanonicalLocalStore
  readonly rpc: HostedStudyRpcClient
  readonly checkpoint: () => Promise<StudyCheckpointRecord | null>
  readonly authoritySink: HostedStudyAuthorityProjectionSink
  /** Builds the deterministic curriculum/session skeleton on a fresh device. */
  readonly localTemplate: (
    current: DurableStudyDocumentV1,
    remote: HostedStudyRpcHydrateDocument,
  ) => Promise<DurableStudyDocumentV1>
  readonly clearEphemeralAuthorization: () => void
  readonly now?: () => Date
}

function retryDelay(attempts: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) return Math.min(Math.max(retryAfterMs, 1_000), 300_000)
  return Math.min(2 ** Math.min(attempts, 8) * 1_000, 300_000)
}

function lastIds(state: HostedStudyLocalSyncState, operationId: string): readonly string[] {
  const values = [...state.acknowledgedOperationIds.filter((id) => id !== operationId), operationId]
  return Object.freeze(values.slice(-HOSTED_STUDY_SYNC_MAX_ACKNOWLEDGED_IDS))
}

export function createHostedStudyConvergenceService(
  options: CreateHostedStudyConvergenceServiceOptions,
): HostedStudyConvergenceService {
  const now = options.now ?? (() => new Date())

  async function recordAfterLocalSave(input: {
    readonly localSaveConfirmed: true
    readonly operationId: string
    readonly operation: HostedStudyRpcOperation
    readonly actorRole: 'student' | 'parent'
  }): Promise<HostedStudyServiceOutcome> {
    if (input.localSaveConfirmed !== true) throw new Error('Local IndexedDB durability must be confirmed before sync enqueue.')
    if (input.actorRole === 'student' &&
        (input.operation === 'safety:clear' || input.operation === 'guardian-attestation:attest')) {
      return Object.freeze({ status: 'REFUSED', reason: 'PARENT_AUTHORITY_REQUIRED' })
    }
    const current = await options.metadata.read()
    const next = enqueueHostedStudyOperation({ state: current, operationId: input.operationId, operation: input.operation })
    if (next === current) return Object.freeze({ status: 'NO_WORK' })
    await options.metadata.write(next)
    return Object.freeze({ status: 'LOCAL_SAVED_AND_QUEUED', operationId: input.operationId })
  }

  async function sync(signal?: AbortSignal): Promise<HostedStudyServiceOutcome> {
    const state = await options.metadata.read()
    const entry = [...state.queue].sort((left, right) => left.localSequence - right.localSequence)[0]
    if (!entry) return Object.freeze({ status: 'NO_WORK' })
    if (entry.attempts >= HOSTED_STUDY_SYNC_MAX_ATTEMPTS) {
      return Object.freeze({ status: 'EXHAUSTED', reason: 'BOUNDED_RETRY_EXHAUSTED' })
    }
    if (entry.nextAttemptAt && Date.parse(entry.nextAttemptAt) > now().getTime()) {
      return Object.freeze({ status: 'OFFLINE_QUEUED', reason: 'RETRY_WAIT' })
    }
    const checkpoint = entry.operation === 'checkpoint:compare-and-swap'
      ? await options.checkpoint() : null
    if (entry.operation === 'checkpoint:compare-and-swap' && !checkpoint) {
      const refused = Object.freeze({ ...state, lastOutcome: 'PERMANENT_REFUSAL' as const })
      await options.metadata.write(refused)
      return Object.freeze({ status: 'REFUSED', reason: 'CANONICAL_CHECKPOINT_UNAVAILABLE' })
    }
    const writeInput = entry.operation === 'checkpoint:compare-and-swap'
      ? {
          scope: options.scope,
          expectedRevision: entry.baseRevision,
          clientOperationId: entry.operationId,
          operation: entry.operation,
          checkpoint: checkpoint as StudyCheckpointRecord,
        } as const
      : {
          scope: options.scope,
          expectedRevision: entry.baseRevision,
          clientOperationId: entry.operationId,
          operation: entry.operation,
        } as const
    const outcome = await options.rpc.write(writeInput, signal)
    if (outcome.code === 'SUCCESS') {
      const result = outcome.value
      if (result.status === 'stored') {
        const queue = state.queue
          .filter((candidate) => candidate.operationId !== entry.operationId)
          .map((candidate) => candidate.revisionDomain === entry.revisionDomain && candidate.baseRevision === entry.baseRevision
            ? Object.freeze({ ...candidate, baseRevision: result.serverRevision }) : candidate)
        const revisions = Object.freeze({ ...state.serverRevisions, [entry.revisionDomain]: result.serverRevision })
        const next = Object.freeze({
          ...state,
          serverRevisions: revisions,
          baseRevisions: Object.freeze({ ...state.baseRevisions, [entry.revisionDomain]: result.serverRevision }),
          queue: Object.freeze(queue),
          acknowledgedOperationIds: lastIds(state, entry.operationId),
          lastOutcome: 'SUCCESS' as const,
          retryAt: null,
        })
        await options.metadata.write(next)
        return Object.freeze({ status: 'SYNCED', serverRevision: result.serverRevision })
      }
      if (result.status === 'revision-conflict') {
        await options.metadata.write(Object.freeze({ ...state, lastOutcome: 'CONFLICT' as const, retryAt: null }))
        return Object.freeze({ status: 'CONFLICT', reason: `CAS_REVISION:${result.serverRevision}` })
      }
      const auth = result.status === 'denied' && result.code === 'study-session-invalid'
      await options.metadata.write(Object.freeze({
        ...state,
        lastOutcome: auth ? 'AUTH_REQUIRED' as const : 'PERMANENT_REFUSAL' as const,
        retryAt: null,
      }))
      if (auth) options.clearEphemeralAuthorization()
      return Object.freeze({ status: auth ? 'AUTH_REQUIRED' : 'REFUSED', reason: result.status })
    }
    if (outcome.code === 'ABORTED') return Object.freeze({ status: 'OFFLINE_QUEUED', reason: 'ABORTED' })
    if (outcome.code === 'AUTHORIZATION_REQUIRED' || outcome.code === 'SESSION_EXPIRED') {
      await options.metadata.write(Object.freeze({ ...state, lastOutcome: 'AUTH_REQUIRED' as const, retryAt: null }))
      options.clearEphemeralAuthorization()
      return Object.freeze({ status: 'AUTH_REQUIRED', reason: outcome.code })
    }
    if (outcome.code === 'PERMANENT_REFUSAL' || outcome.code === 'MALFORMED_RESPONSE') {
      await options.metadata.write(Object.freeze({ ...state, lastOutcome: 'PERMANENT_REFUSAL' as const, retryAt: null }))
      return Object.freeze({ status: 'REFUSED', reason: outcome.code })
    }
    const attempts = entry.attempts + 1
    const exhausted = attempts >= HOSTED_STUDY_SYNC_MAX_ATTEMPTS
    const retryAt = exhausted ? null : new Date(now().getTime() + retryDelay(attempts, outcome.retryAfterMs)).toISOString()
    const queue = state.queue.map((candidate) => candidate.operationId === entry.operationId
      ? Object.freeze({ ...candidate, attempts, nextAttemptAt: retryAt }) : candidate)
    const offline = outcome.code === 'OFFLINE' || outcome.code === 'NETWORK_UNAVAILABLE' || outcome.code === 'TIMEOUT'
    await options.metadata.write(Object.freeze({
      ...state,
      queue: Object.freeze(queue),
      lastOutcome: offline ? 'OFFLINE' as const : 'SERVER_UNAVAILABLE' as const,
      retryAt,
    }))
    return exhausted
      ? Object.freeze({ status: 'EXHAUSTED', reason: 'BOUNDED_RETRY_EXHAUSTED' })
      : Object.freeze({ status: offline ? 'OFFLINE_QUEUED' : 'SERVER_UNAVAILABLE', reason: outcome.code })
  }

  async function hydrate(signal?: AbortSignal): Promise<HostedStudyServiceOutcome> {
    const state = await options.metadata.read()
    const outcome = await options.rpc.hydrate(options.scope, signal)
    if (outcome.code !== 'SUCCESS') {
      if (outcome.code === 'AUTHORIZATION_REQUIRED' || outcome.code === 'SESSION_EXPIRED') {
        await options.metadata.write(Object.freeze({ ...state, lastOutcome: 'AUTH_REQUIRED' as const }))
        options.clearEphemeralAuthorization()
        return Object.freeze({ status: 'AUTH_REQUIRED', reason: outcome.code })
      }
      const offline = ['OFFLINE', 'NETWORK_UNAVAILABLE', 'TIMEOUT'].includes(outcome.code)
      await options.metadata.write(Object.freeze({
        ...state,
        lastOutcome: offline ? 'OFFLINE' as const : 'SERVER_UNAVAILABLE' as const,
      }))
      return Object.freeze({ status: offline ? 'OFFLINE_QUEUED' : 'SERVER_UNAVAILABLE', reason: outcome.code })
    }
    if (outcome.value.status === 'unavailable') {
      return Object.freeze({ status: 'REFUSED', reason: 'HOSTED_DOCUMENT_UNAVAILABLE' })
    }
    const remote = outcome.value.document
    // Safety/attestation must land before progress can become runnable.
    await options.authoritySink.apply(remote)
    const current = await options.localStudy.read()
    const template = await options.localTemplate(current, remote)
    const hydrated = applyHostedHydrateToDurableStudyDocument({ scope: options.scope, local: template, remote })
    if (hydrated.status === 'conflict') {
      await options.metadata.write(Object.freeze({ ...state, lastOutcome: 'CONFLICT' as const }))
      return Object.freeze({ status: 'CONFLICT', reason: hydrated.reason })
    }
    await options.localStudy.replaceValidated(hydrated.document)
    const next = Object.freeze({
      ...state,
      serverRevisions: Object.freeze({ checkpoint: remote.revisions.checkpoint, authority: remote.revisions.authority }),
      baseRevisions: state.queue.length === 0
        ? Object.freeze({ checkpoint: remote.revisions.checkpoint, authority: remote.revisions.authority })
        : state.baseRevisions,
      acknowledgedOperationIds: remote.syncMetadata.lastAuthorityClientOperationId
        ? lastIds(state, remote.syncMetadata.lastAuthorityClientOperationId) : state.acknowledgedOperationIds,
      lastOutcome: 'SUCCESS' as const,
      retryAt: null,
    })
    await options.metadata.write(next)
    return Object.freeze({ status: 'HYDRATED', serverRevision: Math.max(remote.revisions.authority, remote.revisions.checkpoint) })
  }

  return Object.freeze({
    recordAfterLocalSave,
    sync,
    hydrate,
    logout() { options.clearEphemeralAuthorization() },
  })
}
