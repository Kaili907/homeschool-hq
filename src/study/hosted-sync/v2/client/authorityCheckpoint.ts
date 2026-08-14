import { parseHostedSyncStateSnapshotR2, type HostedSyncStateIdentityR2, type HostedSyncStateSnapshotR2 } from '../contracts'
import type { HostedSyncFirstLinkImport, HostedSyncHydrateResult } from './types'

export function withAuthorityCheckpointR1(
  legacy: HostedSyncFirstLinkImport,
  checkpoint: HostedSyncStateSnapshotR2,
): HostedSyncFirstLinkImport {
  const parsed = parseHostedSyncStateSnapshotR2(checkpoint, checkpoint.identity)
  if (parsed.status !== 'ready') throw new Error(`Authority checkpoint refused: ${parsed.reason}`)
  if (parsed.snapshot.identity.householdRef !== legacy.localScope.householdRef ||
      parsed.snapshot.identity.studentRef !== legacy.localScope.studentRef) {
    throw new Error('Authority checkpoint/local first-link identity mismatch.')
  }
  return Object.freeze({
    ...legacy,
    authorityCheckpoint: parsed.snapshot as unknown as Readonly<Record<string, unknown>>,
  })
}

/** Empty-device hydrate refuses to invent a document when repaired authority is absent. */
export function authorityCheckpointFromHydrateR1(
  result: HostedSyncHydrateResult,
  expectedIdentity: HostedSyncStateIdentityR2,
): HostedSyncStateSnapshotR2 {
  if (result.status !== 'ready' || !result.authorityCheckpoint || result.authorityCheckpointRevision === undefined) {
    throw new Error('LOSSLESS_AUTHORITY_CHECKPOINT_UNAVAILABLE')
  }
  const parsed = parseHostedSyncStateSnapshotR2(result.authorityCheckpoint, expectedIdentity)
  if (parsed.status !== 'ready') throw new Error(`Lossless hydrate refused: ${parsed.reason}`)
  if (parsed.snapshot.sync.serverRevision !== result.authorityCheckpointRevision) {
    throw new Error('Lossless hydrate revision mismatch.')
  }
  return parsed.snapshot
}

export function authorityCheckpointWritePayloadR1(input: {
  readonly checkpoint: HostedSyncStateSnapshotR2
  readonly expectedRevision: number
  readonly clientOperationId: string
}): Readonly<{ authorityCheckpoint: HostedSyncStateSnapshotR2 }> {
  const parsed = parseHostedSyncStateSnapshotR2(input.checkpoint, input.checkpoint.identity)
  if (parsed.status !== 'ready') throw new Error(`Authority checkpoint refused: ${parsed.reason}`)
  const sync = parsed.snapshot.sync
  if (sync.baseRevision !== input.expectedRevision || sync.serverRevision !== input.expectedRevision + 1 ||
      sync.operationId !== input.clientOperationId || sync.idempotencyKey !== input.clientOperationId) {
    throw new Error('Authority checkpoint CAS metadata mismatch.')
  }
  return Object.freeze({ authorityCheckpoint: parsed.snapshot })
}
