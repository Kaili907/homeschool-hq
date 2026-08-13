import type {
  ReconciliableStudyState,
  StudyFieldAuthority,
  StudyReconciliationOutcome,
  StudySyncOperationKind,
  StudySyncOperationMetadata,
  StudySyncReplica,
  StudySyncResolution,
} from './types'

const OPERATION_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

/**
 * Converts a pure reconciliation decision into either a local hydrate, a CAS
 * write request, a refetch, or an explicit block. It contains no transport.
 */
export function buildSyncResolution(outcome: StudyReconciliationOutcome): StudySyncResolution {
  if (outcome.result === 'RETRY_WITH_REVISION') {
    return Object.freeze({ method: 'REFETCH_REMOTE', result: outcome.result, diagnostic: outcome.diagnostic })
  }
  if (outcome.result === 'MANUAL_OR_CONSERVATIVE_CONFLICT' || outcome.result === 'REFUSE_IDENTITY_MISMATCH') {
    return Object.freeze({ method: 'BLOCK', result: outcome.result, diagnostic: outcome.diagnostic })
  }
  const ready = {
    identity: outcome.identity,
    expectedServerRevision: outcome.remoteServerRevision,
    state: outcome.state,
    authority: outcome.authority,
    operations: outcome.pendingOperations,
    appliedOperationIds: outcome.appliedOperationIds,
    localRevision: outcome.localRevision,
    diagnostic: outcome.diagnostic,
  }
  return outcome.result === 'ACCEPT_REMOTE'
    ? Object.freeze({ ...ready, method: 'HYDRATE_REMOTE' as const, result: outcome.result })
    : Object.freeze({ ...ready, method: 'PUT_WITH_CAS' as const, result: outcome.result })
}

/**
 * Successful acknowledgement is the only operation that advances the local
 * server/base revisions and drains the persisted queue. A CAS write must
 * advance the revision; a remote hydrate acknowledges the fetched revision.
 */
export function finalizeSyncResolution(input: {
  readonly resolution: Extract<StudySyncResolution, { readonly method: 'HYDRATE_REMOTE' | 'PUT_WITH_CAS' }>
  readonly acknowledgedServerRevision: number
  readonly deviceId: string
}): StudySyncReplica {
  const { resolution } = input
  if (!Number.isSafeInteger(input.acknowledgedServerRevision) || input.acknowledgedServerRevision < 0) {
    throw new Error('A non-negative server revision acknowledgement is required.')
  }
  if (resolution.method === 'PUT_WITH_CAS' && input.acknowledgedServerRevision <= resolution.expectedServerRevision) {
    throw new Error('A successful CAS acknowledgement must advance the server revision.')
  }
  if (resolution.method === 'HYDRATE_REMOTE' && input.acknowledgedServerRevision !== resolution.expectedServerRevision) {
    throw new Error('A hydrate must acknowledge the exact fetched server revision.')
  }
  if (!OPERATION_REF.test(input.deviceId)) throw new Error('A valid device identity is required.')
  const appliedOperationIds = Object.freeze([
    ...new Set([...resolution.appliedOperationIds, ...resolution.operations.map((operation) => operation.operationId)]),
  ].sort())
  return Object.freeze({
    identity: resolution.identity,
    state: resolution.state,
    metadata: Object.freeze({
      serverRevision: input.acknowledgedServerRevision,
      baseServerRevision: input.acknowledgedServerRevision,
      localRevision: resolution.localRevision,
      deviceId: input.deviceId,
      pendingOperations: Object.freeze([]),
      appliedOperationIds,
      authority: resolution.authority,
    }),
  })
}

/**
 * Records one offline mutation without storing its payload in the queue. The
 * actual state remains in the existing local stores; the queue holds only the
 * idempotency/revision metadata needed on reconnect.
 */
export function enqueueOfflineStudyMutation(input: {
  readonly replica: StudySyncReplica
  readonly state: ReconciliableStudyState
  readonly authority: StudyFieldAuthority
  readonly operationId: string
  readonly kind: StudySyncOperationKind
  readonly actor: StudySyncOperationMetadata['actor']
}): StudySyncReplica {
  if (!OPERATION_REF.test(input.operationId)) throw new Error('A valid operation identity is required.')
  if (input.replica.metadata.appliedOperationIds.includes(input.operationId) ||
      input.replica.metadata.pendingOperations.some((operation) => operation.operationId === input.operationId)) {
    // Retrying an operation ID is an exact no-op, including its supplied state.
    return input.replica
  }
  const localRevision = input.replica.metadata.localRevision + 1
  const operation: StudySyncOperationMetadata = Object.freeze({
    operationId: input.operationId,
    deviceId: input.replica.metadata.deviceId,
    localRevision,
    kind: input.kind,
    actor: input.actor,
  })
  return Object.freeze({
    identity: input.replica.identity,
    state: input.state,
    metadata: Object.freeze({
      ...input.replica.metadata,
      localRevision,
      pendingOperations: Object.freeze([...input.replica.metadata.pendingOperations, operation]),
      authority: input.authority,
    }),
  })
}
