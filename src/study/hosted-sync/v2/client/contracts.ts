import {
  HOSTED_SYNC_WRITE_OPERATIONS,
  type HostedSyncFirstLinkInput,
  type HostedSyncFirstLinkResult,
  type HostedSyncHydrateInput,
  type HostedSyncHydrateResult,
  type HostedSyncLocalScope,
  type HostedSyncMapping,
  type HostedSyncResolveMappingInput,
  type HostedSyncResolveMappingResult,
  type HostedSyncWriteInput,
  type HostedSyncWriteResult,
} from './types'
import { assertHostedSyncPrivacyAllowlistR1, serializeAuthorityCheckpointPrivacyGateR1 } from './privacyGate'

export const HOSTED_SYNC_MAX_RPC_BYTES = 96 * 1024
/** Explicit ceiling for one school-year minimized authority checkpoint. */
export const HOSTED_SYNC_AUTHORITY_CHECKPOINT_MAX_BYTES = 2 * 1024 * 1024
export const HOSTED_SYNC_OPERATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UUID = HOSTED_SYNC_OPERATION_UUID
const DIGEST = /^[0-9a-f]{64}$/
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const FORBIDDEN_KEY = /^(?:rawanswer|rawresponse|rawlearnerresponse|privateanswer|answer|answerindex|answertext|answerkey|answerkeyref|correctanswer|response|responsetext|scoringlocator|rubric|transcript|transcripttext|rawtranscript|tutormessage|tutorprompt|privatenotes|audio|emotion|emotionallabel|personality|personalityinference|diagnosis|diagnosticinference|pin|pincode|pinhash|pinsalt|password|credential|credentials|apikey|providerapikey|accesstoken|refreshtoken|bearertoken|servicerole|servicerolekey|sessiongrant|cookie)$/i
const SECRET_TEXT = /(?:\bbearer\s+[A-Za-z0-9._~-]+|\b(?:access|refresh|service[-_ ]?role|api)[-_ ]?(?:token|key)\b)/i

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!record(value)) return null
  const held = Object.keys(value)
  return held.length === keys.length && held.every((key) => keys.includes(key)) ? value : null
}

function boundedJson(value: unknown, maximumBytes = HOSTED_SYNC_MAX_RPC_BYTES): boolean {
  try {
    const serialized = JSON.stringify(value)
    return serialized !== undefined && new TextEncoder().encode(serialized).byteLength <= maximumBytes
  } catch { return false }
}

export function assertHostedSyncPrivate(value: unknown, path = 'payload', seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (SECRET_TEXT.test(value)) throw new Error(`Hosted sync privacy refusal at ${path}.`)
    return
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return
  if (typeof value !== 'object') throw new Error(`Hosted sync payload is not JSON-safe at ${path}.`)
  if (seen.has(value)) throw new Error(`Hosted sync payload is cyclic at ${path}.`)
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertHostedSyncPrivate(item, `${path}[${index}]`, seen))
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key.replace(/[^a-z0-9]/gi, ''))) throw new Error(`Hosted sync privacy refusal at ${path}.${key}.`)
      assertHostedSyncPrivate(item, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

function validScope(value: HostedSyncLocalScope): boolean {
  return REF.test(value.householdRef) && REF.test(value.studentRef) &&
    REF.test(value.assignmentRef) && REF.test(value.sessionRef)
}

function validCommon(input: { tokenDigest: string; studentId: string }): boolean {
  return DIGEST.test(input.tokenDigest) && UUID.test(input.studentId)
}

function safe<T extends Readonly<Record<string, unknown>>>(value: T, maximumBytes = HOSTED_SYNC_MAX_RPC_BYTES): T | null {
  try { assertHostedSyncPrivate(value) } catch { return null }
  if (!boundedJson(value, maximumBytes)) return null
  // Force the exact object through JSON serialization before it can become a
  // provider argument. This removes prototypes/accessors and prevents callers
  // from changing a nested value after validation but before dispatch.
  try { return deepFreeze(JSON.parse(JSON.stringify(value))) as T } catch { return null }
}

function deepFreeze(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

export function buildFirstLinkArgs(input: HostedSyncFirstLinkInput): Readonly<Record<string, unknown>> | null {
  if (!validCommon(input) || !UUID.test(input.clientOperationId) || !validScope(input.import.localScope) ||
      !REF.test(input.import.hostedScope.assignmentRef) || !REF.test(input.import.hostedScope.sessionRef)) return null
  try {
    assertHostedSyncPrivacyAllowlistR1(input.import)
    if (input.import.authorityCheckpoint) serializeAuthorityCheckpointPrivacyGateR1(input.import.authorityCheckpoint)
  } catch { return null }
  return safe({
    p_token_digest: input.tokenDigest,
    p_student_id: input.studentId,
    p_client_operation_id: input.clientOperationId,
    p_import: input.import,
  }, input.import.authorityCheckpoint
    ? HOSTED_SYNC_AUTHORITY_CHECKPOINT_MAX_BYTES + HOSTED_SYNC_MAX_RPC_BYTES
    : HOSTED_SYNC_MAX_RPC_BYTES)
}

export function buildResolveMappingArgs(input: HostedSyncResolveMappingInput): Readonly<Record<string, unknown>> | null {
  if (!validCommon(input) || !validScope(input.localScope)) return null
  return safe({ p_token_digest: input.tokenDigest, p_student_id: input.studentId, p_local_scope: input.localScope })
}

export function buildHydrateArgs(input: HostedSyncHydrateInput): Readonly<Record<string, unknown>> | null {
  if (!validCommon(input) || !REF.test(input.assignmentRef) || !REF.test(input.sessionId)) return null
  return safe({
    p_token_digest: input.tokenDigest,
    p_student_id: input.studentId,
    p_assignment_ref: input.assignmentRef,
    p_session_id: input.sessionId,
  })
}

export function buildWriteArgs(input: HostedSyncWriteInput): Readonly<Record<string, unknown>> | null {
  if (!buildHydrateArgs(input) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !UUID.test(input.clientOperationId) || !HOSTED_SYNC_WRITE_OPERATIONS.includes(input.operation)) return null
  try {
    assertHostedSyncPrivacyAllowlistR1(input.payload)
    if (input.operation === 'authority-checkpoint:compare-and-swap') {
      const held = exact(input.payload, ['authorityCheckpoint'])
      if (!held) return null
      serializeAuthorityCheckpointPrivacyGateR1(held.authorityCheckpoint)
    }
  } catch { return null }
  return safe({
    p_token_digest: input.tokenDigest,
    p_student_id: input.studentId,
    p_assignment_ref: input.assignmentRef,
    p_session_id: input.sessionId,
    p_expected_revision: input.expectedRevision,
    p_client_operation_id: input.clientOperationId,
    p_operation: input.operation,
    p_payload: input.payload,
  }, input.operation === 'authority-checkpoint:compare-and-swap'
    ? HOSTED_SYNC_AUTHORITY_CHECKPOINT_MAX_BYTES + 4096
    : HOSTED_SYNC_MAX_RPC_BYTES)
}

function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function mapping(value: unknown): HostedSyncMapping | null {
  const held = exact(value, [
    'localHouseholdRef', 'localStudentRef', 'localAssignmentRef', 'localSessionRef',
    'hostedHouseholdId', 'hostedStudentId', 'hostedAssignmentRef', 'hostedSessionRef',
  ])
  if (!held || !Object.values(held).every((item) => typeof item === 'string' && item.length > 0)) return null
  return Object.freeze(held) as unknown as HostedSyncMapping
}

export function parseFirstLinkResult(value: unknown): HostedSyncFirstLinkResult | null {
  if (!record(value) || value.schemaVersion !== 2) return null
  if (value.status === 'mapping-conflict' || value.status === 'idempotency-collision') {
    return exact(value, ['schemaVersion', 'status']) ? Object.freeze(value) as unknown as HostedSyncFirstLinkResult : null
  }
  if (value.status === 'denied') {
    return exact(value, ['schemaVersion', 'status', 'code']) && typeof value.code === 'string'
      ? Object.freeze(value) as unknown as HostedSyncFirstLinkResult : null
  }
  if (value.status !== 'imported' && value.status !== 'linked-existing') return null
  const held = exact(value, ['schemaVersion', 'status', 'mapping', 'revisions'])
  const mapped = mapping(value.mapping)
  const revisions = record(value.revisions) ? value.revisions : null
  const revisionKeys = revisions ? Object.keys(revisions) : []
  if (!held || !mapped || !revisions ||
      !['authority', 'session', 'checkpoint'].every((key) => revisionKeys.includes(key)) ||
      revisionKeys.some((key) => !['authority', 'session', 'checkpoint', 'authorityCheckpoint'].includes(key)) ||
      !Object.values(revisions).every(revision)) return null
  return Object.freeze({ ...held, mapping: mapped, revisions: Object.freeze(revisions) }) as unknown as HostedSyncFirstLinkResult
}

export function parseResolveMappingResult(value: unknown): HostedSyncResolveMappingResult | null {
  if (!record(value) || value.schemaVersion !== 2) return null
  if (value.status === 'unavailable') return exact(value, ['schemaVersion', 'status']) ? Object.freeze(value) as unknown as HostedSyncResolveMappingResult : null
  const held = exact(value, ['schemaVersion', 'status', 'mapping'])
  const mapped = mapping(value.mapping)
  return held && value.status === 'mapped' && mapped
    ? Object.freeze({ ...held, mapping: mapped }) as unknown as HostedSyncResolveMappingResult : null
}

export function parseHydrateResult(value: unknown): HostedSyncHydrateResult | null {
  if (!record(value) || value.schemaVersion !== 2) return null
  if (value.status === 'unavailable') return exact(value, ['schemaVersion', 'status']) ? Object.freeze(value) as unknown as HostedSyncHydrateResult : null
  const keys = Object.keys(value)
  const allowed = ['schemaVersion', 'status', 'mapping', 'document', 'authorityCheckpoint', 'authorityCheckpointRevision']
  const held = keys.every((key) => allowed.includes(key)) &&
    ['schemaVersion', 'status', 'mapping', 'document'].every((key) => keys.includes(key)) ? value : null
  const mapped = mapping(value.mapping)
  if (!held || value.status !== 'ready' || !mapped || !record(value.document)) return null
  try {
    assertHostedSyncPrivate(value.document)
    if (value.authorityCheckpoint !== undefined) assertHostedSyncPrivate(value.authorityCheckpoint)
  } catch { return null }
  if ((value.authorityCheckpoint === undefined) !== (value.authorityCheckpointRevision === undefined) ||
      (value.authorityCheckpoint !== undefined && (!record(value.authorityCheckpoint) || !revision(value.authorityCheckpointRevision)))) return null
  return Object.freeze({
    ...held, mapping: mapped, document: Object.freeze(value.document),
    ...(record(value.authorityCheckpoint) ? {
      authorityCheckpoint: Object.freeze(value.authorityCheckpoint),
      authorityCheckpointRevision: value.authorityCheckpointRevision as number,
    } : {}),
  }) as unknown as HostedSyncHydrateResult
}

export function parseWriteResult(value: unknown, input: HostedSyncWriteInput): HostedSyncWriteResult | null {
  if (!record(value) || value.schemaVersion !== 2) return null
  if (value.status === 'denied') {
    return exact(value, ['schemaVersion', 'status', 'code']) && typeof value.code === 'string'
      ? Object.freeze(value) as unknown as HostedSyncWriteResult : null
  }
  if (value.status === 'idempotency-collision') {
    return exact(value, ['schemaVersion', 'status', 'operation']) && value.operation === input.operation
      ? Object.freeze(value) as unknown as HostedSyncWriteResult : null
  }
  if (value.status === 'invalid-write') {
    return exact(value, ['schemaVersion', 'status', 'operation', 'reasonCode']) && value.operation === input.operation && typeof value.reasonCode === 'string'
      ? Object.freeze(value) as unknown as HostedSyncWriteResult : null
  }
  if (value.status !== 'stored' && value.status !== 'revision-conflict') return null
  if (value.operation !== input.operation || !['authority', 'session', 'checkpoint', 'authority-checkpoint'].includes(String(value.revisionDomain)) || !revision(value.serverRevision)) return null
  const required = ['schemaVersion', 'status', 'operation', 'revisionDomain', 'serverRevision']
  if (value.status === 'revision-conflict' && !exact(value, required)) return null
  try { assertHostedSyncPrivate(value) } catch { return null }
  return Object.freeze({ ...value }) as unknown as HostedSyncWriteResult
}
