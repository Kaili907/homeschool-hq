import { parseStudyCheckpointDraft } from '../../contracts/production/session'
import { assertStudySyncPayloadPrivate } from '../transport/privacy'
import type {
  HostedStudyRpcHydrateDocument,
  HostedStudyRpcHydrateResult,
  HostedStudyRpcScope,
  HostedStudyRpcWriteInput,
  HostedStudyRpcWriteResult,
} from './rpcTypes'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const HEX_DIGEST = /^[0-9a-f]{64}$/

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!record(value)) return null
  const held = Object.keys(value)
  return held.length === keys.length && held.every((key) => keys.includes(key)) ? value : null
}

function revision(value: unknown, positive = false): value is number {
  return Number.isSafeInteger(value) && (value as number) >= (positive ? 1 : 0)
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function nullableInstant(value: unknown): value is string | null {
  return value === null || instant(value)
}

export function validHostedStudyRpcScope(value: HostedStudyRpcScope): boolean {
  return REF.test(value.householdRef) && UUID.test(value.studentRef) &&
    REF.test(value.assignmentRef) && REF.test(value.sessionRef)
}

export function buildHostedStudyHydrateArgs(scope: HostedStudyRpcScope): Readonly<Record<string, unknown>> | null {
  if (!validHostedStudyRpcScope(scope)) return null
  return Object.freeze({
    p_student_id: scope.studentRef,
    p_assignment_ref: scope.assignmentRef,
    p_session_id: scope.sessionRef,
  })
}

export function buildHostedStudyWriteArgs(
  input: HostedStudyRpcWriteInput,
  tokenDigest: string,
): Readonly<Record<string, unknown>> | null {
  if (!validHostedStudyRpcScope(input.scope) || !HEX_DIGEST.test(tokenDigest) ||
      !revision(input.expectedRevision) || !UUID.test(input.clientOperationId)) return null
  const payload = input.operation === 'checkpoint:compare-and-swap'
    ? (parseStudyCheckpointDraft(input.checkpoint) ? { checkpoint: input.checkpoint } : null)
    : {}
  if (!payload) return null
  const args = {
    p_token_digest: tokenDigest,
    p_student_id: input.scope.studentRef,
    p_assignment_ref: input.scope.assignmentRef,
    p_session_id: input.scope.sessionRef,
    p_expected_revision: input.expectedRevision,
    p_client_operation_id: input.clientOperationId,
    p_operation: input.operation,
    p_payload: payload,
  }
  assertStudySyncPayloadPrivate(args)
  return Object.freeze(args)
}

function parseHydrateDocument(value: unknown, scope: HostedStudyRpcScope): HostedStudyRpcHydrateDocument | null {
  const doc = exact(value, [
    'studentRef', 'assignmentRef', 'lessonRef', 'studySessionId', 'completionState',
    'revisions', 'progress', 'safety', 'guardianAttestation',
    'dynamicSourceReadiness', 'syncMetadata',
  ])
  if (!doc || doc.studentRef !== scope.studentRef || doc.assignmentRef !== scope.assignmentRef ||
      doc.studySessionId !== scope.sessionRef || !REF.test(String(doc.lessonRef)) ||
      !['planned', 'active', 'paused', 'approved-break', 'student-requested-break', 'technical-interruption', 'completed', 'abandoned'].includes(String(doc.completionState))) return null
  const revisions = exact(doc.revisions, ['authority', 'session', 'checkpoint'])
  const progress = exact(doc.progress, ['currentSegmentRef', 'completedSegmentRefs', 'safeInstructionalCursor', 'checkpointUpdatedAt'])
  const safety = exact(doc.safety, ['state', 'stoppedAt', 'clearedAt'])
  const guardian = exact(doc.guardianAttestation, ['state', 'attestedAt'])
  const source = exact(doc.dynamicSourceReadiness, ['state', 'curriculumReleaseVersion'])
  const sync = exact(doc.syncMetadata, ['lastAuthorityClientOperationId', 'serverAcceptedAt'])
  if (!revisions || !revision(revisions.authority, true) || !revision(revisions.session) || !revision(revisions.checkpoint) ||
      !progress || !(progress.currentSegmentRef === null || REF.test(String(progress.currentSegmentRef))) ||
      !Array.isArray(progress.completedSegmentRefs) || !progress.completedSegmentRefs.every((ref) => REF.test(String(ref))) ||
      new Set(progress.completedSegmentRefs).size !== progress.completedSegmentRefs.length ||
      !(progress.safeInstructionalCursor === null || record(progress.safeInstructionalCursor)) ||
      !nullableInstant(progress.checkpointUpdatedAt) || !safety || !['clear', 'stopped'].includes(String(safety.state)) ||
      !nullableInstant(safety.stoppedAt) || !nullableInstant(safety.clearedAt) ||
      (safety.state === 'stopped' ? !safety.stoppedAt || safety.clearedAt !== null : safety.stoppedAt !== null) ||
      !guardian || !['pending', 'attested'].includes(String(guardian.state)) || !nullableInstant(guardian.attestedAt) ||
      (guardian.state === 'attested' ? !guardian.attestedAt : guardian.attestedAt !== null) ||
      !source || !['ready', 'not-ready'].includes(String(source.state)) ||
      typeof source.curriculumReleaseVersion !== 'string' || source.curriculumReleaseVersion.length > 160 ||
      !sync || !(sync.lastAuthorityClientOperationId === null || UUID.test(String(sync.lastAuthorityClientOperationId))) ||
      !instant(sync.serverAcceptedAt)) return null
  try { assertStudySyncPayloadPrivate(doc) } catch { return null }
  return Object.freeze(doc) as unknown as HostedStudyRpcHydrateDocument
}

export function parseHostedStudyHydrateResult(value: unknown, scope: HostedStudyRpcScope): HostedStudyRpcHydrateResult | null {
  const unavailable = exact(value, ['schemaVersion', 'status'])
  if (unavailable?.schemaVersion === 1 && unavailable.status === 'unavailable') {
    return Object.freeze({ schemaVersion: 1, status: 'unavailable' })
  }
  const ready = exact(value, ['schemaVersion', 'status', 'document'])
  if (ready?.schemaVersion !== 1 || ready.status !== 'ready') return null
  const document = parseHydrateDocument(ready.document, scope)
  return document ? Object.freeze({ schemaVersion: 1, status: 'ready', document }) : null
}

export function parseHostedStudyWriteResult(value: unknown, input: HostedStudyRpcWriteInput): HostedStudyRpcWriteResult | null {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.status !== 'string') return null
  if (value.status === 'stored') {
    const allowed = ['schemaVersion', 'status', 'operation', 'serverRevision', 'safetyState', 'guardianAttestationState']
    if (Object.keys(value).some((key) => !allowed.includes(key)) || value.operation !== input.operation ||
        !revision(value.serverRevision, true) || value.serverRevision <= input.expectedRevision ||
        !(value.safetyState === undefined || ['clear', 'stopped'].includes(String(value.safetyState))) ||
        !(value.guardianAttestationState === undefined || ['pending', 'attested'].includes(String(value.guardianAttestationState)))) return null
    return Object.freeze({ ...value }) as HostedStudyRpcWriteResult
  }
  if (value.status === 'revision-conflict') {
    if (!exact(value, ['schemaVersion', 'status', 'operation', 'serverRevision']) ||
        value.operation !== input.operation || !revision(value.serverRevision)) return null
    return Object.freeze({ ...value }) as HostedStudyRpcWriteResult
  }
  if (value.status === 'denied') {
    if (!exact(value, ['schemaVersion', 'status', 'code']) ||
        !['study-session-invalid', 'actor-not-authorized', 'study-session-closed'].includes(String(value.code))) return null
    return Object.freeze({ ...value }) as HostedStudyRpcWriteResult
  }
  if (value.status === 'idempotency-collision') {
    return exact(value, ['schemaVersion', 'status', 'operation']) && value.operation === input.operation
      ? Object.freeze({ ...value }) as HostedStudyRpcWriteResult : null
  }
  if (value.status === 'invalid-write') {
    return exact(value, ['schemaVersion', 'status', 'operation', 'reasonCode']) && value.operation === input.operation &&
      typeof value.reasonCode === 'string'
      ? Object.freeze({ ...value }) as HostedStudyRpcWriteResult : null
  }
  return null
}
