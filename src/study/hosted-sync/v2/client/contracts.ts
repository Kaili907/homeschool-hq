import {
  parseDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../../../family-pilot/durable-ports/schema'
import {
  HOSTED_SYNC_CLIENT_PROTOCOL_VERSION,
  type HostedSyncAcknowledgeInput,
  type HostedSyncAcknowledgeRpcArgs,
  type HostedSyncAcknowledgedResult,
  type HostedSyncFirstLinkImportInput,
  type HostedSyncFirstLinkImportRpcArgs,
  type HostedSyncHydrateInput,
  type HostedSyncHydrateResult,
  type HostedSyncHydrateRpcArgs,
  type HostedSyncIdentity,
  type HostedSyncRevisionedWriteInput,
  type HostedSyncRevisionedWriteRpcArgs,
  type HostedSyncSnapshot,
  type HostedSyncStoredResult,
} from './types'

export const HOSTED_SYNC_MAX_RPC_BYTES = 5 * 1024 * 1024

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
export const HOSTED_SYNC_OPERATION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REASON = /^[A-Z][A-Z0-9_]{0,95}$/
const FORBIDDEN_KEY = /^(?:rawanswer|rawresponse|privateanswer|answertext|responsetext|transcript|transcripttext|rawtranscript|rawtutortranscript|tutortranscript|tutormessage|tutorprompt|pin|pincode|pinhash|pinsalt|password|credential|credentials|apikey|providerapikey|accesstoken|refreshtoken|bearertoken|servicerole|servicerolekey|sessiongrant|studysessiongrant|cookie)$/i
const CREDENTIAL_TEXT = /(?:\bbearer\s+[A-Za-z0-9._~-]+|\b(?:access|refresh|service[-_ ]?role|api)[-_ ]?(?:token|key)\b)/i

export type ParsedWriteResponse =
  | Readonly<{ status: 'SUCCESS'; value: HostedSyncStoredResult }>
  | Readonly<{ status: 'STALE_REVISION'; serverRevision: number }>
  | Readonly<{ status: 'PERMANENT_REFUSAL'; reasonCode: string }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const held = Object.keys(value)
  return held.length === keys.length && held.every((key) => keys.includes(key))
}

export function isHostedSyncRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

export function isHostedSyncOperationId(value: unknown): value is string {
  return typeof value === 'string' && HOSTED_SYNC_OPERATION_UUID.test(value)
}

export function isHostedSyncRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

export function isHostedSyncInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

/** Throws on credential-like or forbidden authority content; callers fail closed. */
export function assertHostedSyncPrivate(value: unknown, path = 'payload', seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (CREDENTIAL_TEXT.test(value)) throw new Error(`Hosted sync privacy refusal at ${path}.`)
    return
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return
  if (typeof value !== 'object') throw new Error(`Hosted sync payload is not JSON-safe at ${path}.`)
  if (seen.has(value)) throw new Error(`Hosted sync payload is cyclic at ${path}.`)
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertHostedSyncPrivate(entry, `${path}[${index}]`, seen))
  } else {
    for (const [key, entry] of Object.entries(value)) {
      const normalized = normalizedKey(key)
      const minimizedMarker =
        (normalized === 'rawanswerincluded' || normalized === 'transcriptincluded') && entry === false
      if (FORBIDDEN_KEY.test(normalized) && !minimizedMarker && entry !== null && entry !== false) {
        throw new Error(`Hosted sync privacy refusal at ${path}.${key}.`)
      }
      assertHostedSyncPrivate(entry, `${path}.${key}`, seen)
    }
  }
  seen.delete(value)
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value)
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry, seen))
    Object.freeze(value)
  }
  return value
}

function cloneJson<T>(value: T): T | null {
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > HOSTED_SYNC_MAX_RPC_BYTES) return null
    return JSON.parse(serialized) as T
  } catch {
    return null
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function parseHostedSyncIdentity(value: unknown): HostedSyncIdentity | null {
  if (!isRecord(value) || !exactKeys(value, ['householdRef', 'learnerRef', 'documentRef']) ||
      !isHostedSyncRef(value.householdRef) || !isHostedSyncRef(value.learnerRef) ||
      !isHostedSyncRef(value.documentRef)) return null
  return Object.freeze({
    householdRef: value.householdRef,
    learnerRef: value.learnerRef,
    documentRef: value.documentRef,
  })
}

export function parseHostedSyncSnapshot(value: unknown, identity: HostedSyncIdentity): HostedSyncSnapshot | null {
  if (!isRecord(value) || !exactKeys(value, ['documentSchemaVersion', 'document']) ||
      value.documentSchemaVersion !== 1) return null
  const cloned = cloneJson(value.document)
  if (!cloned) return null
  try { assertHostedSyncPrivate(cloned) } catch { return null }
  const parsed = parseDurableStudyDocument(cloned, {
    householdRef: identity.householdRef,
    learnerRef: identity.learnerRef,
  })
  if (parsed.status !== 'current') return null
  // The local parser is allowed to normalize device reads. Hosted sync is not:
  // silently dropping an unknown field here would make cross-device state lossy.
  if (canonicalJson(cloned) !== canonicalJson(parsed.document)) return null
  const snapshot = { documentSchemaVersion: 1 as const, document: parsed.document }
  try { assertHostedSyncPrivate(snapshot) } catch { return null }
  return deepFreeze(snapshot)
}

function argsIdentity(identity: HostedSyncIdentity) {
  return {
    p_household_ref: identity.householdRef,
    p_learner_ref: identity.learnerRef,
    p_document_ref: identity.documentRef,
  }
}

export function buildFirstLinkImportArgs(
  input: HostedSyncFirstLinkImportInput,
): HostedSyncFirstLinkImportRpcArgs | null {
  const identity = parseHostedSyncIdentity(input.identity)
  const snapshot = identity ? parseHostedSyncSnapshot(input.snapshot, identity) : null
  if (!identity || !snapshot || !isHostedSyncOperationId(input.operationId) || input.baseRevision !== 0 ||
      input.adultConfirmation !== 'EXPLICIT_ADULT_CONFIRMED' || !isHostedSyncInstant(input.confirmedAt)) return null
  const args = {
    p_schema_version: HOSTED_SYNC_CLIENT_PROTOCOL_VERSION,
    ...argsIdentity(identity),
    p_operation_id: input.operationId,
    p_base_revision: 0 as const,
    p_adult_confirmation: input.adultConfirmation,
    p_confirmed_at: input.confirmedAt,
    p_snapshot: snapshot,
  }
  try { assertHostedSyncPrivate(args) } catch { return null }
  return deepFreeze(args)
}

export function buildHydrateArgs(input: HostedSyncHydrateInput): HostedSyncHydrateRpcArgs | null {
  const identity = parseHostedSyncIdentity(input.identity)
  if (!identity) return null
  return Object.freeze({
    p_schema_version: HOSTED_SYNC_CLIENT_PROTOCOL_VERSION,
    ...argsIdentity(identity),
  })
}

export function buildRevisionedWriteArgs(
  input: HostedSyncRevisionedWriteInput,
): HostedSyncRevisionedWriteRpcArgs | null {
  const identity = parseHostedSyncIdentity(input.identity)
  const snapshot = identity ? parseHostedSyncSnapshot(input.snapshot, identity) : null
  if (!identity || !snapshot || !isHostedSyncOperationId(input.operationId) ||
      !isHostedSyncRevision(input.baseRevision)) return null
  const args = {
    p_schema_version: HOSTED_SYNC_CLIENT_PROTOCOL_VERSION,
    ...argsIdentity(identity),
    p_operation_id: input.operationId,
    p_base_revision: input.baseRevision,
    p_snapshot: snapshot,
  }
  try { assertHostedSyncPrivate(args) } catch { return null }
  return deepFreeze(args)
}

export function buildAcknowledgeArgs(
  input: HostedSyncAcknowledgeInput,
): HostedSyncAcknowledgeRpcArgs | null {
  const identity = parseHostedSyncIdentity(input.identity)
  if (!identity || !isHostedSyncOperationId(input.operationId) ||
      !isHostedSyncOperationId(input.acknowledgedOperationId) ||
      !isHostedSyncRevision(input.serverRevision)) return null
  return Object.freeze({
    p_schema_version: HOSTED_SYNC_CLIENT_PROTOCOL_VERSION,
    ...argsIdentity(identity),
    p_operation_id: input.operationId,
    p_acknowledged_operation_id: input.acknowledgedOperationId,
    p_server_revision: input.serverRevision,
  })
}

function stored(value: Record<string, unknown>, operationId: string): ParsedWriteResponse | null {
  if (!exactKeys(value, ['schema_version', 'status', 'operation_id', 'server_revision', 'accepted_at']) ||
      value.schema_version !== 2 || (value.status !== 'stored' && value.status !== 'duplicate') ||
      value.operation_id !== operationId || !isHostedSyncRevision(value.server_revision) ||
      value.server_revision < 1 || !isHostedSyncInstant(value.accepted_at)) return null
  return Object.freeze({
    status: 'SUCCESS' as const,
    value: Object.freeze({
      operationId,
      serverRevision: value.server_revision,
      acceptedAt: value.accepted_at,
      duplicate: value.status === 'duplicate',
    }),
  })
}

export function parseWriteResponse(
  value: unknown,
  operationId: string,
  baseRevision: number,
): ParsedWriteResponse | null {
  if (!isRecord(value) || value.schema_version !== 2 || typeof value.status !== 'string') return null
  if (value.status === 'stored' || value.status === 'duplicate') {
    const parsed = stored(value, operationId)
    return parsed?.status === 'SUCCESS' && parsed.value.serverRevision > baseRevision ? parsed : null
  }
  if (value.status === 'stale_revision') {
    if (!exactKeys(value, ['schema_version', 'status', 'operation_id', 'server_revision']) ||
        value.operation_id !== operationId || !isHostedSyncRevision(value.server_revision) ||
        value.server_revision < baseRevision) return null
    return Object.freeze({ status: 'STALE_REVISION' as const, serverRevision: value.server_revision })
  }
  if (value.status === 'refused') {
    return parseRefusalResponse(value)
  }
  return null
}

export function parseRefusalResponse(
  value: unknown,
): Readonly<{ status: 'PERMANENT_REFUSAL'; reasonCode: string }> | null {
  if (!isRecord(value) || !exactKeys(value, ['schema_version', 'status', 'reason_code']) ||
      value.schema_version !== 2 || value.status !== 'refused' ||
      typeof value.reason_code !== 'string' || !REASON.test(value.reason_code)) return null
  return Object.freeze({ status: 'PERMANENT_REFUSAL' as const, reasonCode: value.reason_code })
}

export function parseHydrateResponse(
  value: unknown,
  identity: HostedSyncIdentity,
): HostedSyncHydrateResult | null {
  if (!isRecord(value) || value.schema_version !== 2) return null
  if (value.status === 'unavailable') {
    return exactKeys(value, ['schema_version', 'status']) ? Object.freeze({ status: 'UNAVAILABLE' as const }) : null
  }
  if (value.status !== 'ready' ||
      !exactKeys(value, ['schema_version', 'status', 'server_revision', 'last_operation_id', 'snapshot']) ||
      !isHostedSyncRevision(value.server_revision) || value.server_revision < 1 ||
      !isHostedSyncOperationId(value.last_operation_id)) return null
  const snapshot = parseHostedSyncSnapshot(value.snapshot, identity)
  if (!snapshot) return null
  return deepFreeze({
    status: 'READY' as const,
    serverRevision: value.server_revision,
    lastOperationId: value.last_operation_id,
    snapshot,
  })
}

export function parseAcknowledgeResponse(
  value: unknown,
  input: HostedSyncAcknowledgeInput,
): HostedSyncAcknowledgedResult | null {
  if (!isRecord(value) ||
      !exactKeys(value, [
        'schema_version', 'status', 'operation_id', 'acknowledged_operation_id',
        'server_revision', 'acknowledged_at',
      ]) || value.schema_version !== 2 ||
      (value.status !== 'acknowledged' && value.status !== 'duplicate') ||
      value.operation_id !== input.operationId ||
      value.acknowledged_operation_id !== input.acknowledgedOperationId ||
      value.server_revision !== input.serverRevision || !isHostedSyncInstant(value.acknowledged_at)) return null
  return Object.freeze({
    operationId: input.operationId,
    acknowledgedOperationId: input.acknowledgedOperationId,
    serverRevision: input.serverRevision,
    acknowledgedAt: value.acknowledged_at,
    duplicate: value.status === 'duplicate',
  })
}

/** Used by the fake provider to retain a lossless, isolated document copy. */
export function cloneHostedSyncDocument(document: DurableStudyDocumentV1): DurableStudyDocumentV1 {
  const cloned = cloneJson(document)
  if (!cloned) throw new Error('Hosted sync document is not bounded JSON.')
  return cloned
}
