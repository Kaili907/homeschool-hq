import type {
  AccessDenialReason,
  SafetyCenterStore,
  SafetyPrincipal,
  StudentBlockSafetyEvent,
  StudentReport,
  StudentReportSafetyEvent,
  StudentTutorBlock,
} from './contracts.ts'
import { AI_SAFETY_SCHEMA_VERSION } from './contracts.ts'
import { authorizeStudentAccess } from './access.ts'
import { SAFETY_CLASSIFICATION_DEFAULTS } from './policy.ts'

export type StudentControlError =
  | AccessDenialReason
  | 'invalid-comment'
  | 'block-not-found'
  | 'block-student-mismatch'

export type StudentControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: StudentControlError }

export interface SubmitStudentReportInput {
  readonly reportId: string
  readonly eventId: string
  readonly sessionId: string
  readonly studentId: string
  readonly subjectId: string
  readonly at: string
  readonly category: StudentReport['category']
  readonly targetEntryId?: string
  readonly comment?: string
}

/**
 * Reports never require a narrative. Optional comments are trimmed and capped
 * so the safety event does not become a duplicate transcript store.
 */
export function submitStudentReport(
  principal: SafetyPrincipal,
  input: SubmitStudentReportInput,
): StudentControlResult<{
  readonly report: StudentReport
  readonly event: StudentReportSafetyEvent
}> {
  const authorization = authorizeStudentAccess(principal, input.studentId, ['student'])
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  const comment = input.comment?.trim()
  if (comment !== undefined && (comment.length === 0 || comment.length > 500)) {
    return { ok: false, reason: 'invalid-comment' }
  }
  const report: StudentReport = {
    kind: 'student-report',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.at,
    reportId: input.reportId,
    studentId: input.studentId,
    sessionId: input.sessionId,
    createdByStudentId: input.studentId,
    category: input.category,
    ...(input.targetEntryId ? { targetEntryId: input.targetEntryId } : {}),
    ...(comment ? { comment } : {}),
    status: 'submitted',
  }
  const defaults = SAFETY_CLASSIFICATION_DEFAULTS['student-report']
  const event: StudentReportSafetyEvent = {
    kind: 'student-report-event',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.at,
    eventId: input.eventId,
    sessionId: input.sessionId,
    studentId: input.studentId,
    subjectId: input.subjectId,
    occurredAt: input.at,
    classification: 'student-report',
    severity: defaults.severity,
    escalation: defaults.escalation,
    summary: `The student reported a tutor interaction as ${input.category}.`,
    evidenceRefs: input.targetEntryId ? [input.targetEntryId] : [],
    detector: 'student',
    parentVisible: true,
    rawMicrophoneRecordingStored: false,
    reportId: input.reportId,
    reportCategory: input.category,
    ...(input.targetEntryId ? { targetEntryId: input.targetEntryId } : {}),
    ...(comment ? { studentComment: comment } : {}),
  }
  return { ok: true, value: { report, event } }
}

export interface CreateStudentBlockInput {
  readonly blockId: string
  readonly eventId: string
  readonly sessionId: string
  readonly studentId: string
  readonly subjectId: string
  readonly at: string
  readonly scope: StudentTutorBlock['scope']
  readonly reason: StudentTutorBlock['reason']
}

export function createStudentTutorBlock(
  principal: SafetyPrincipal,
  input: CreateStudentBlockInput,
): StudentControlResult<{
  readonly block: StudentTutorBlock
  readonly event: StudentBlockSafetyEvent
}> {
  const authorization = authorizeStudentAccess(principal, input.studentId, ['student'])
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  const block: StudentTutorBlock = {
    kind: 'student-tutor-block',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.at,
    blockId: input.blockId,
    studentId: input.studentId,
    createdByStudentId: input.studentId,
    sessionId: input.sessionId,
    ...(input.scope === 'subject' ? { subjectId: input.subjectId } : {}),
    scope: input.scope,
    reason: input.reason,
    active: true,
  }
  const defaults = SAFETY_CLASSIFICATION_DEFAULTS['student-block']
  const event: StudentBlockSafetyEvent = {
    kind: 'student-block-event',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.at,
    eventId: input.eventId,
    sessionId: input.sessionId,
    studentId: input.studentId,
    subjectId: input.subjectId,
    occurredAt: input.at,
    classification: 'student-block',
    severity: defaults.severity,
    escalation: defaults.escalation,
    summary: `The student blocked the tutor for scope ${input.scope}.`,
    evidenceRefs: [],
    detector: 'student',
    parentVisible: true,
    rawMicrophoneRecordingStored: false,
    blockId: input.blockId,
    blockScope: input.scope,
  }
  return { ok: true, value: { block, event } }
}

export function liftStudentTutorBlock(
  principal: SafetyPrincipal,
  block: StudentTutorBlock,
  input: { readonly studentId: string; readonly at: string },
): StudentControlResult<StudentTutorBlock> {
  const authorization =
    principal.role === 'student'
      ? authorizeStudentAccess(principal, block.studentId, ['student'])
      : principal.role === 'parent'
        ? authorizeStudentAccess(
            principal,
            block.studentId,
            ['parent'],
            'permissions:manage',
          )
        : principal.role === 'reviewer'
          ? authorizeStudentAccess(
              principal,
              block.studentId,
              ['reviewer'],
              'reviews:resolve',
            )
          : authorizeStudentAccess(principal, block.studentId, [])
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (block.studentId !== input.studentId) {
    return { ok: false, reason: 'block-student-mismatch' }
  }
  return {
    ok: true,
    value: {
      ...block,
      active: false,
      liftedAt: input.at,
      liftedBy: {
        role: principal.role as 'student' | 'parent' | 'reviewer',
        actorId: principal.actorId,
      },
    },
  }
}

export function recordStudentReport(
  store: SafetyCenterStore,
  result: { readonly report: StudentReport; readonly event: StudentReportSafetyEvent },
): SafetyCenterStore {
  return {
    ...store,
    reports: [...store.reports, result.report],
    safetyEvents: [...store.safetyEvents, result.event],
  }
}

export function recordStudentBlock(
  store: SafetyCenterStore,
  result: { readonly block: StudentTutorBlock; readonly event: StudentBlockSafetyEvent },
): SafetyCenterStore {
  return {
    ...store,
    blocks: [...store.blocks, result.block],
    safetyEvents: [...store.safetyEvents, result.event],
  }
}
