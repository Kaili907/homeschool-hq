import type { DurableStudyDocumentV1 } from '../../family-pilot/durable-ports/schema'
import { assertStudySyncPayloadPrivate, parseMinimizedStudySyncDocument } from './privacy'
import {
  STUDY_SYNC_PROTOCOL_VERSION,
  type StudySyncAcknowledgeInput,
  type StudySyncAcknowledgeResult,
  type StudySyncDocumentState,
  type StudySyncHydrateInput,
  type StudySyncHydrateResult,
  type StudySyncHydrateStudent,
  type StudySyncIdentity,
  type StudySyncPullInput,
  type StudySyncPullResult,
  type StudySyncPushInput,
  type StudySyncPushResult,
  type StudySyncRequestContract,
} from './types'

const MAX_STUDENTS = 64
const MAX_DOCUMENTS_PER_STUDENT = 16
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function validRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function validOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_ID.test(value)
}

function validRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function sameIdentity(left: StudySyncIdentity, right: StudySyncIdentity): boolean {
  return left.householdRef === right.householdRef &&
    left.studentRef === right.studentRef &&
    left.documentRef === right.documentRef
}

export function parseStudySyncIdentity(value: unknown): StudySyncIdentity | null {
  if (!isRecord(value) || !exactKeys(value, ['householdRef', 'studentRef', 'documentRef'])) return null
  if (!validRef(value.householdRef) || !validRef(value.studentRef) || !validRef(value.documentRef)) return null
  return Object.freeze({
    householdRef: value.householdRef,
    studentRef: value.studentRef,
    documentRef: value.documentRef,
  })
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen)
    Object.freeze(value)
  }
  return value
}

function cloneDocument(document: DurableStudyDocumentV1): DurableStudyDocumentV1 | null {
  try {
    return JSON.parse(JSON.stringify(document)) as DurableStudyDocumentV1
  } catch {
    return null
  }
}

function validHydrateStudent(value: StudySyncHydrateStudent): boolean {
  return validRef(value.studentRef) &&
    Array.isArray(value.documentRefs) &&
    value.documentRefs.length > 0 &&
    value.documentRefs.length <= MAX_DOCUMENTS_PER_STUDENT &&
    value.documentRefs.every(validRef) &&
    new Set(value.documentRefs).size === value.documentRefs.length
}

export function buildHydrateRequest(input: StudySyncHydrateInput): StudySyncRequestContract | null {
  if (!validRef(input.householdRef) || !Array.isArray(input.students) ||
      input.students.length === 0 || input.students.length > MAX_STUDENTS ||
      !input.students.every(validHydrateStudent) ||
      new Set(input.students.map((student) => student.studentRef)).size !== input.students.length) return null
  const request = {
    protocolVersion: STUDY_SYNC_PROTOCOL_VERSION,
    operation: 'HYDRATE' as const,
    householdRef: input.householdRef,
    students: input.students.map((student) => ({
      studentRef: student.studentRef,
      documentRefs: [...student.documentRefs],
    })),
  }
  assertStudySyncPayloadPrivate(request)
  return deepFreeze(request)
}

export function buildPullRequest(input: StudySyncPullInput): StudySyncRequestContract | null {
  const identity = parseStudySyncIdentity(input.identity)
  const afterRevision = input.afterRevision ?? null
  if (!identity || !(afterRevision === null || validRevision(afterRevision))) return null
  const request = {
    protocolVersion: STUDY_SYNC_PROTOCOL_VERSION,
    operation: 'PULL' as const,
    identity,
    afterRevision,
  }
  assertStudySyncPayloadPrivate(request)
  return deepFreeze(request)
}

export function buildPushRequest(input: StudySyncPushInput): StudySyncRequestContract | null {
  const identity = parseStudySyncIdentity(input.identity)
  if (!identity || !validOperationId(input.operationId) || !validRevision(input.baseRevision)) return null
  const cloned = cloneDocument(input.document)
  const document = cloned ? parseMinimizedStudySyncDocument(cloned, identity) : null
  if (!document) return null
  const request = {
    protocolVersion: STUDY_SYNC_PROTOCOL_VERSION,
    operation: 'PUSH' as const,
    identity,
    operationId: input.operationId,
    baseRevision: input.baseRevision,
    mutation: 'REPLACE_MINIMIZED_STUDY_DOCUMENT' as const,
    document,
  }
  assertStudySyncPayloadPrivate(request)
  return deepFreeze(request)
}

export function buildAcknowledgeRequest(input: StudySyncAcknowledgeInput): StudySyncRequestContract | null {
  const identity = parseStudySyncIdentity(input.identity)
  if (!identity || !validOperationId(input.acknowledgementId) || !validRevision(input.serverRevision)) return null
  const request = {
    protocolVersion: STUDY_SYNC_PROTOCOL_VERSION,
    operation: 'ACKNOWLEDGE' as const,
    identity,
    acknowledgementId: input.acknowledgementId,
    serverRevision: input.serverRevision,
  }
  assertStudySyncPayloadPrivate(request)
  return deepFreeze(request)
}

function successEnvelope(value: unknown, operation: string, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) &&
    exactKeys(value, ['protocolVersion', 'status', 'operation', ...keys]) &&
    value.protocolVersion === STUDY_SYNC_PROTOCOL_VERSION &&
    value.status === 'SUCCESS' &&
    value.operation === operation
}

function parseDocumentState(value: unknown): StudySyncDocumentState | null {
  if (!isRecord(value) ||
      !exactKeys(value, ['documentRef', 'serverRevision', 'acknowledgedRevision', 'hasRemoteDocument']) ||
      !validRef(value.documentRef) || !validRevision(value.serverRevision) ||
      !(value.acknowledgedRevision === null || validRevision(value.acknowledgedRevision)) ||
      typeof value.hasRemoteDocument !== 'boolean') return null
  if (value.acknowledgedRevision !== null && value.acknowledgedRevision > value.serverRevision) return null
  if (!value.hasRemoteDocument && value.serverRevision !== 0) return null
  return Object.freeze({
    documentRef: value.documentRef,
    serverRevision: value.serverRevision,
    acknowledgedRevision: value.acknowledgedRevision,
    hasRemoteDocument: value.hasRemoteDocument,
  })
}

export function parseHydrateResponse(value: unknown, request: StudySyncHydrateInput): StudySyncHydrateResult | null {
  if (!successEnvelope(value, 'HYDRATE', ['householdRef', 'students']) ||
      value.householdRef !== request.householdRef || !Array.isArray(value.students) ||
      value.students.length !== request.students.length) return null
  const requested = new Map(request.students.map((student) => [student.studentRef, new Set(student.documentRefs)]))
  const seen = new Set<string>()
  const students = []
  for (const item of value.students) {
    if (!isRecord(item) || !exactKeys(item, ['studentRef', 'documents']) ||
        !validRef(item.studentRef) || !Array.isArray(item.documents) || seen.has(item.studentRef)) return null
    const expectedDocuments = requested.get(item.studentRef)
    if (!expectedDocuments || item.documents.length !== expectedDocuments.size) return null
    const documents: StudySyncDocumentState[] = []
    const documentRefs = new Set<string>()
    for (const raw of item.documents) {
      const document = parseDocumentState(raw)
      if (!document || !expectedDocuments.has(document.documentRef) || documentRefs.has(document.documentRef)) return null
      documentRefs.add(document.documentRef)
      documents.push(document)
    }
    seen.add(item.studentRef)
    students.push(Object.freeze({ studentRef: item.studentRef, documents: Object.freeze(documents) }))
  }
  const result = { householdRef: request.householdRef, students: Object.freeze(students) }
  try {
    assertStudySyncPayloadPrivate(result)
  } catch {
    return null
  }
  return deepFreeze(result)
}

export function parsePullResponse(value: unknown, request: StudySyncPullInput): StudySyncPullResult | null {
  if (!successEnvelope(value, 'PULL', ['identity', 'serverRevision', 'document'])) return null
  const identity = parseStudySyncIdentity(value.identity)
  if (!identity || !sameIdentity(identity, request.identity) || !validRevision(value.serverRevision)) return null
  const document = value.document === null
    ? null
    : parseMinimizedStudySyncDocument(value.document, identity)
  if (value.document !== null && !document) return null
  const result = { identity, serverRevision: value.serverRevision, document }
  try {
    assertStudySyncPayloadPrivate(result)
  } catch {
    return null
  }
  return deepFreeze(result)
}

export function parsePushResponse(value: unknown, request: StudySyncPushInput): StudySyncPushResult | null {
  if (!successEnvelope(value, 'PUSH', [
    'identity', 'operationId', 'serverRevision', 'acceptedAt', 'duplicate',
  ])) return null
  const identity = parseStudySyncIdentity(value.identity)
  if (!identity || !sameIdentity(identity, request.identity) || value.operationId !== request.operationId ||
      !validRevision(value.serverRevision) || value.serverRevision <= request.baseRevision ||
      !validInstant(value.acceptedAt) || typeof value.duplicate !== 'boolean') return null
  return deepFreeze({
    identity,
    operationId: value.operationId as string,
    serverRevision: value.serverRevision,
    acceptedAt: value.acceptedAt,
    duplicate: value.duplicate,
  })
}

export function parseAcknowledgeResponse(
  value: unknown,
  request: StudySyncAcknowledgeInput,
): StudySyncAcknowledgeResult | null {
  if (!successEnvelope(value, 'ACKNOWLEDGE', [
    'identity', 'acknowledgementId', 'serverRevision', 'acknowledgedAt', 'duplicate',
  ])) return null
  const identity = parseStudySyncIdentity(value.identity)
  if (!identity || !sameIdentity(identity, request.identity) ||
      value.acknowledgementId !== request.acknowledgementId ||
      value.serverRevision !== request.serverRevision || !validInstant(value.acknowledgedAt) ||
      typeof value.duplicate !== 'boolean') return null
  return deepFreeze({
    identity,
    acknowledgementId: value.acknowledgementId as string,
    serverRevision: value.serverRevision as number,
    acknowledgedAt: value.acknowledgedAt,
    duplicate: value.duplicate,
  })
}
