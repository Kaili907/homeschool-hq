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
import {
  FAMILY_PLAN_CHECKPOINT_MAX_BYTES_R1,
  FAMILY_RESPONSE_CHECKPOINT_MAX_BYTES_R1,
  parseFamilyPlanCheckpointR1,
  parseFamilyResponseCheckpointR1,
} from './familyCheckpoints'

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
      const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
      const approvedResponseValue = normalizedKey === 'response' && /\.learnerResponseCheckpoint\.responses\[\d+\]$/u.test(path)
      if (FORBIDDEN_KEY.test(normalizedKey) && !approvedResponseValue) throw new Error(`Hosted sync privacy refusal at ${path}.${key}.`)
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
    if ((input.import.learnerResponseCheckpoint || input.import.familyPlanCheckpoint) && !input.import.authorityCheckpoint) return null
    if (input.import.authorityCheckpoint) {
      const authoritySync = input.import.authorityCheckpoint.sync
      if (!record(authoritySync) || authoritySync.operationId !== input.clientOperationId ||
          authoritySync.idempotencyKey !== input.clientOperationId) return null
    }
    if (input.import.learnerResponseCheckpoint) {
      const response = parseFamilyResponseCheckpointR1(input.import.learnerResponseCheckpoint)
      if (!response || response.identity.householdRef !== input.import.localScope.householdRef ||
          response.identity.studentRef !== input.import.localScope.studentRef ||
          response.identity.assignmentRef !== input.import.localScope.assignmentRef ||
          response.identity.sessionRef !== input.import.localScope.sessionRef ||
          response.sync.baseRevision !== 0 || response.sync.revision !== 0 ||
          response.sync.operationId !== input.clientOperationId) return null
    }
    if (input.import.familyPlanCheckpoint) {
      const plan = parseFamilyPlanCheckpointR1(input.import.familyPlanCheckpoint)
      if (!plan || plan.identity.householdRef !== input.import.localScope.householdRef ||
          plan.identity.studentRef !== input.import.localScope.studentRef ||
          plan.sync.baseRevision !== 0 || plan.sync.revision !== 0 ||
          plan.sync.operationId !== input.clientOperationId) return null
    }
  } catch { return null }
  return safe({
    p_token_digest: input.tokenDigest,
    p_student_id: input.studentId,
    p_client_operation_id: input.clientOperationId,
    p_import: input.import,
  }, HOSTED_SYNC_MAX_RPC_BYTES +
    (input.import.authorityCheckpoint ? HOSTED_SYNC_AUTHORITY_CHECKPOINT_MAX_BYTES : 0) +
    (input.import.learnerResponseCheckpoint ? FAMILY_RESPONSE_CHECKPOINT_MAX_BYTES_R1 : 0) +
    (input.import.familyPlanCheckpoint ? FAMILY_PLAN_CHECKPOINT_MAX_BYTES_R1 : 0))
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
    } else if (input.operation === 'learner-response-checkpoint:compare-and-swap') {
      const held = exact(input.payload, ['learnerResponseCheckpoint'])
      const checkpoint = held ? parseFamilyResponseCheckpointR1(held.learnerResponseCheckpoint) : null
      if (!checkpoint || checkpoint.sync.baseRevision !== input.expectedRevision ||
          checkpoint.sync.revision !== input.expectedRevision + 1 || checkpoint.sync.operationId !== input.clientOperationId) return null
    } else if (input.operation === 'family-plan-checkpoint:compare-and-swap') {
      const held = exact(input.payload, ['familyPlanCheckpoint'])
      const checkpoint = held ? parseFamilyPlanCheckpointR1(held.familyPlanCheckpoint) : null
      if (!checkpoint || checkpoint.sync.baseRevision !== input.expectedRevision ||
          checkpoint.sync.revision !== input.expectedRevision + 1 || checkpoint.sync.operationId !== input.clientOperationId) return null
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
    : input.operation === 'learner-response-checkpoint:compare-and-swap'
      ? FAMILY_RESPONSE_CHECKPOINT_MAX_BYTES_R1 + 4096
      : input.operation === 'family-plan-checkpoint:compare-and-swap'
        ? FAMILY_PLAN_CHECKPOINT_MAX_BYTES_R1 + 4096
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
      revisionKeys.some((key) => !['authority', 'session', 'checkpoint', 'authorityCheckpoint', 'learnerResponseCheckpoint', 'familyPlanCheckpoint'].includes(key)) ||
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
  const allowed = [
    'schemaVersion', 'status', 'mapping', 'document', 'authorityCheckpoint', 'authorityCheckpointRevision',
    'learnerResponseCheckpoint', 'learnerResponseCheckpointRevision',
    'familyPlanCheckpoint', 'familyPlanCheckpointRevision', 'courseEnrollments',
  ]
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
  const response = value.learnerResponseCheckpoint === undefined ? undefined : parseFamilyResponseCheckpointR1(value.learnerResponseCheckpoint)
  const plan = value.familyPlanCheckpoint === undefined ? undefined : parseFamilyPlanCheckpointR1(value.familyPlanCheckpoint)
  if ((value.learnerResponseCheckpoint === undefined) !== (value.learnerResponseCheckpointRevision === undefined) ||
      (value.learnerResponseCheckpoint !== undefined && (!response || !revision(value.learnerResponseCheckpointRevision) ||
        response.sync.revision !== value.learnerResponseCheckpointRevision))) return null
  if ((value.familyPlanCheckpoint === undefined) !== (value.familyPlanCheckpointRevision === undefined) ||
      (value.familyPlanCheckpoint !== undefined && (!plan || !revision(value.familyPlanCheckpointRevision) ||
        plan.sync.revision !== value.familyPlanCheckpointRevision))) return null
  if (value.courseEnrollments !== undefined && (!Array.isArray(value.courseEnrollments) ||
      !value.courseEnrollments.every((entry) => record(entry)))) return null
  return Object.freeze({
    ...held, mapping: mapped, document: Object.freeze(value.document),
    ...(record(value.authorityCheckpoint) ? {
      authorityCheckpoint: Object.freeze(value.authorityCheckpoint),
      authorityCheckpointRevision: value.authorityCheckpointRevision as number,
    } : {}),
    ...(response ? { learnerResponseCheckpoint: response, learnerResponseCheckpointRevision: value.learnerResponseCheckpointRevision as number } : {}),
    ...(plan ? { familyPlanCheckpoint: plan, familyPlanCheckpointRevision: value.familyPlanCheckpointRevision as number } : {}),
    ...(Array.isArray(value.courseEnrollments) ? { courseEnrollments: Object.freeze(value.courseEnrollments.map((entry) => Object.freeze(entry))) } : {}),
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
  const expectedDomain = input.operation === 'learner-response-checkpoint:compare-and-swap'
    ? 'learner-response-checkpoint'
    : input.operation === 'family-plan-checkpoint:compare-and-swap'
      ? 'family-plan-checkpoint'
      : null
  if (value.operation !== input.operation || ![
    'authority', 'session', 'checkpoint', 'authority-checkpoint',
    'learner-response-checkpoint', 'family-plan-checkpoint',
  ].includes(String(value.revisionDomain)) || (expectedDomain && value.revisionDomain !== expectedDomain) || !revision(value.serverRevision)) return null
  const required = ['schemaVersion', 'status', 'operation', 'revisionDomain', 'serverRevision']
  if (value.status === 'revision-conflict' && !exact(value, required)) return null
  try { assertHostedSyncPrivate(value) } catch { return null }
  return Object.freeze({ ...value }) as unknown as HostedSyncWriteResult
}
