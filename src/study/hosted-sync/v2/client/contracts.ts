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

export const HOSTED_SYNC_MAX_RPC_BYTES = 96 * 1024
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

function boundedJson(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value)
    return serialized !== undefined && new TextEncoder().encode(serialized).byteLength <= HOSTED_SYNC_MAX_RPC_BYTES
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

function safe<T extends Readonly<Record<string, unknown>>>(value: T): T | null {
  try { assertHostedSyncPrivate(value) } catch { return null }
  return boundedJson(value) ? Object.freeze(value) : null
}

export function buildFirstLinkArgs(input: HostedSyncFirstLinkInput): Readonly<Record<string, unknown>> | null {
  if (!validCommon(input) || !UUID.test(input.clientOperationId) || !validScope(input.import.localScope) ||
      !REF.test(input.import.hostedScope.assignmentRef) || !REF.test(input.import.hostedScope.sessionRef)) return null
  return safe({
    p_token_digest: input.tokenDigest,
    p_student_id: input.studentId,
    p_client_operation_id: input.clientOperationId,
    p_import: input.import,
  })
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
  return safe({
    p_token_digest: input.tokenDigest,
    p_student_id: input.studentId,
    p_assignment_ref: input.assignmentRef,
    p_session_id: input.sessionId,
    p_expected_revision: input.expectedRevision,
    p_client_operation_id: input.clientOperationId,
    p_operation: input.operation,
    p_payload: input.payload,
  })
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
  const revisions = exact(value.revisions, ['authority', 'session', 'checkpoint'])
  if (!held || !mapped || !revisions || !Object.values(revisions).every(revision)) return null
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
  const held = exact(value, ['schemaVersion', 'status', 'mapping', 'document'])
  const mapped = mapping(value.mapping)
  if (!held || value.status !== 'ready' || !mapped || !record(value.document)) return null
  try { assertHostedSyncPrivate(value.document) } catch { return null }
  return Object.freeze({ ...held, mapping: mapped, document: Object.freeze(value.document) }) as unknown as HostedSyncHydrateResult
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
  if (value.operation !== input.operation || !['authority', 'session', 'checkpoint'].includes(String(value.revisionDomain)) || !revision(value.serverRevision)) return null
  const required = ['schemaVersion', 'status', 'operation', 'revisionDomain', 'serverRevision']
  if (value.status === 'revision-conflict' && !exact(value, required)) return null
  try { assertHostedSyncPrivate(value) } catch { return null }
  return Object.freeze({ ...value }) as unknown as HostedSyncWriteResult
}
