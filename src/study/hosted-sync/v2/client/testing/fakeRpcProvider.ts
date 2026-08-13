import {
  cloneHostedSyncDocument,
  isHostedSyncInstant,
  isHostedSyncOperationId,
  isHostedSyncRevision,
  parseHostedSyncIdentity,
  parseHostedSyncSnapshot,
} from '../contracts'
import {
  HOSTED_SYNC_RPC,
  type HostedSyncAuthenticatedRpcProvider,
  type HostedSyncIdentity,
  type HostedSyncRpcName,
  type HostedSyncRpcProviderResult,
  type HostedSyncSnapshot,
} from '../types'

interface FakeHostedDocument {
  readonly identity: HostedSyncIdentity
  readonly revision: number
  readonly lastOperationId: string
  readonly snapshot: HostedSyncSnapshot
}

interface AcceptedOperation {
  readonly fingerprint: string
  readonly acceptedAt: string
  readonly revision: number
  readonly documentKey: string
}

interface Acknowledgement {
  readonly fingerprint: string
  readonly acknowledgedAt: string
  readonly target: string
  readonly revision: number
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function rpcIdentity(args: Record<string, unknown>): HostedSyncIdentity | null {
  return parseHostedSyncIdentity({
    householdRef: args.p_household_ref,
    learnerRef: args.p_learner_ref,
    documentRef: args.p_document_ref,
  })
}

function key(identity: HostedSyncIdentity): string {
  return `${identity.householdRef}\u0000${identity.learnerRef}\u0000${identity.documentRef}`
}

function snapshotCopy(snapshot: HostedSyncSnapshot): HostedSyncSnapshot {
  return Object.freeze({
    documentSchemaVersion: 1,
    document: cloneHostedSyncDocument(snapshot.document),
  })
}

function data(value: unknown): HostedSyncRpcProviderResult {
  return Object.freeze({ data: value, error: null })
}

function refused(reasonCode: string): HostedSyncRpcProviderResult {
  return data(Object.freeze({ schema_version: 2, status: 'refused', reason_code: reasonCode }))
}

export interface FakeHostedSyncRpcProvider extends HostedSyncAuthenticatedRpcProvider {
  readonly calls: readonly Readonly<{ name: HostedSyncRpcName; args: Readonly<Record<string, unknown>> }>[]
  dropNextCommittedResponse(
    name: typeof HOSTED_SYNC_RPC.firstLinkImport |
      typeof HOSTED_SYNC_RPC.revisionedWrite |
      typeof HOSTED_SYNC_RPC.acknowledge,
  ): void
  failNext(result: Extract<HostedSyncRpcProviderResult, { data: null }>): void
  inspect(identity: HostedSyncIdentity): FakeHostedDocument | null
}

/**
 * Lossless executable fixture for the narrow R2 RPC contract. It intentionally
 * models server idempotency and a response lost after commit.
 */
export function createFakeHostedSyncRpcProvider(input: {
  readonly now?: () => Date
} = {}): FakeHostedSyncRpcProvider {
  const now = input.now ?? (() => new Date())
  const documents = new Map<string, FakeHostedDocument>()
  const writes = new Map<string, AcceptedOperation>()
  const acknowledgements = new Map<string, Acknowledgement>()
  const acknowledgedTargets = new Set<string>()
  const calls: { name: HostedSyncRpcName; args: Readonly<Record<string, unknown>> }[] = []
  const drop = new Set<HostedSyncRpcName>()
  let nextFailure: Extract<HostedSyncRpcProviderResult, { data: null }> | null = null

  function storedResponse(operationId: string, accepted: AcceptedOperation, duplicate: boolean) {
    return Object.freeze({
      schema_version: 2,
      status: duplicate ? 'duplicate' : 'stored',
      operation_id: operationId,
      server_revision: accepted.revision,
      accepted_at: accepted.acceptedAt,
    })
  }

  function write(
    name: typeof HOSTED_SYNC_RPC.firstLinkImport | typeof HOSTED_SYNC_RPC.revisionedWrite,
    args: Record<string, unknown>,
  ): HostedSyncRpcProviderResult {
    const expected = name === HOSTED_SYNC_RPC.firstLinkImport
      ? [
          'p_schema_version', 'p_household_ref', 'p_learner_ref', 'p_document_ref',
          'p_operation_id', 'p_base_revision', 'p_adult_confirmation', 'p_confirmed_at', 'p_snapshot',
        ]
      : [
          'p_schema_version', 'p_household_ref', 'p_learner_ref', 'p_document_ref',
          'p_operation_id', 'p_base_revision', 'p_snapshot',
        ]
    const identity = rpcIdentity(args)
    if (!exactKeys(args, expected) || args.p_schema_version !== 2 || !identity ||
        !isHostedSyncOperationId(args.p_operation_id) || !isHostedSyncRevision(args.p_base_revision)) {
      return refused('INVALID_WRITE')
    }
    if (name === HOSTED_SYNC_RPC.firstLinkImport &&
        (args.p_base_revision !== 0 || args.p_adult_confirmation !== 'EXPLICIT_ADULT_CONFIRMED' ||
         !isHostedSyncInstant(args.p_confirmed_at))) return refused('INVALID_FIRST_LINK')
    const snapshot = parseHostedSyncSnapshot(args.p_snapshot, identity)
    if (!snapshot) return refused('INVALID_SNAPSHOT')
    const operationId = args.p_operation_id
    const fingerprint = JSON.stringify({ name, args })
    const prior = writes.get(operationId)
    if (prior) {
      return prior.fingerprint === fingerprint
        ? data(storedResponse(operationId, prior, true))
        : refused('IDEMPOTENCY_COLLISION')
    }
    const held = documents.get(key(identity))
    const currentRevision = held?.revision ?? 0
    if (args.p_base_revision !== currentRevision) {
      return data(Object.freeze({
        schema_version: 2,
        status: 'stale_revision',
        operation_id: operationId,
        server_revision: currentRevision,
      }))
    }
    const accepted: AcceptedOperation = Object.freeze({
      fingerprint,
      acceptedAt: now().toISOString(),
      revision: currentRevision + 1,
      documentKey: key(identity),
    })
    writes.set(operationId, accepted)
    documents.set(key(identity), Object.freeze({
      identity: Object.freeze({ ...identity }),
      revision: accepted.revision,
      lastOperationId: operationId,
      snapshot: snapshotCopy(snapshot),
    }))
    if (drop.delete(name)) {
      return Object.freeze({
        data: null,
        error: Object.freeze({ code: 'NETWORK_UNAVAILABLE' as const, reasonCode: 'RESPONSE_LOST_AFTER_COMMIT' }),
      })
    }
    return data(storedResponse(operationId, accepted, false))
  }

  const provider: FakeHostedSyncRpcProvider = {
    get calls() { return calls },

    async rpc(name, args, signal) {
      calls.push(Object.freeze({ name, args }))
      if (signal?.aborted) {
        return Object.freeze({ data: null, error: Object.freeze({ code: 'ABORTED' as const }) })
      }
      if (nextFailure) {
        const held = nextFailure
        nextFailure = null
        return held
      }
      if (name === HOSTED_SYNC_RPC.firstLinkImport || name === HOSTED_SYNC_RPC.revisionedWrite) {
        return write(name, { ...args })
      }
      if (name === HOSTED_SYNC_RPC.hydrate) {
        const raw = { ...args }
        if (!exactKeys(raw, ['p_schema_version', 'p_household_ref', 'p_learner_ref', 'p_document_ref']) ||
            raw.p_schema_version !== 2) return refused('INVALID_HYDRATE')
        const identity = rpcIdentity(raw)
        if (!identity) return refused('INVALID_HYDRATE')
        const held = documents.get(key(identity))
        return held
          ? data(Object.freeze({
              schema_version: 2,
              status: 'ready',
              server_revision: held.revision,
              last_operation_id: held.lastOperationId,
              snapshot: snapshotCopy(held.snapshot),
            }))
          : data(Object.freeze({ schema_version: 2, status: 'unavailable' }))
      }
      if (name === HOSTED_SYNC_RPC.acknowledge) {
        const raw = { ...args }
        if (!exactKeys(raw, [
          'p_schema_version', 'p_household_ref', 'p_learner_ref', 'p_document_ref',
          'p_operation_id', 'p_acknowledged_operation_id', 'p_server_revision',
        ]) || raw.p_schema_version !== 2) return refused('INVALID_ACKNOWLEDGEMENT')
        const identity = rpcIdentity(raw)
        if (!identity || !isHostedSyncOperationId(raw.p_operation_id) ||
            !isHostedSyncOperationId(raw.p_acknowledged_operation_id) ||
            !isHostedSyncRevision(raw.p_server_revision)) return refused('INVALID_ACKNOWLEDGEMENT')
        const operationId = raw.p_operation_id
        const target = `${key(identity)}\u0000${raw.p_acknowledged_operation_id}\u0000${raw.p_server_revision}`
        const fingerprint = JSON.stringify({ name, args })
        const prior = acknowledgements.get(operationId)
        if (prior && prior.fingerprint !== fingerprint) return refused('IDEMPOTENCY_COLLISION')
        if (prior) {
          return data(Object.freeze({
            schema_version: 2,
            status: 'duplicate',
            operation_id: operationId,
            acknowledged_operation_id: raw.p_acknowledged_operation_id,
            server_revision: raw.p_server_revision,
            acknowledged_at: prior.acknowledgedAt,
          }))
        }
        const acceptedTarget = writes.get(raw.p_acknowledged_operation_id)
        if (!acceptedTarget || acceptedTarget.revision !== raw.p_server_revision ||
            acceptedTarget.documentKey !== key(identity)) return refused('ACKNOWLEDGEMENT_TARGET_MISMATCH')
        const duplicate = Boolean(prior) || acknowledgedTargets.has(target)
        const acknowledgement = Object.freeze({
          fingerprint,
          acknowledgedAt: now().toISOString(),
          target,
          revision: raw.p_server_revision,
        })
        acknowledgements.set(operationId, acknowledgement)
        acknowledgedTargets.add(target)
        if (drop.delete(name)) {
          return Object.freeze({
            data: null,
            error: Object.freeze({ code: 'NETWORK_UNAVAILABLE' as const, reasonCode: 'RESPONSE_LOST_AFTER_COMMIT' }),
          })
        }
        return data(Object.freeze({
          schema_version: 2,
          status: duplicate ? 'duplicate' : 'acknowledged',
          operation_id: operationId,
          acknowledged_operation_id: raw.p_acknowledged_operation_id,
          server_revision: raw.p_server_revision,
          acknowledged_at: acknowledgement.acknowledgedAt,
        }))
      }
      return refused('UNKNOWN_RPC')
    },

    dropNextCommittedResponse(name) { drop.add(name) },
    failNext(result) { nextFailure = result },
    inspect(identity) {
      const held = documents.get(key(identity))
      return held ? Object.freeze({ ...held, snapshot: snapshotCopy(held.snapshot) }) : null
    },
  }
  return Object.freeze(provider)
}
