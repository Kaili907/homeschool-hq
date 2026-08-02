import type {
  AccessDenialReason,
  DataDeletionRequest,
  DataExportRequest,
  RetentionPolicy,
  SafetyCenterDataExport,
  SafetyCenterStore,
  SafetyPrincipal,
} from './contracts.ts'
import {
  AI_SAFETY_SCHEMA_VERSION,
  PARENT_REVIEW_NOTICE,
  RAW_AUDIO_NOTICE,
  SAFETY_EXCEPTION_NOTICE,
} from './contracts.ts'
import { authorizeStudentAccess } from './access.ts'
import { createAuditEvent } from './history.ts'

const DAY_MS = 24 * 60 * 60 * 1_000

const olderThan = (value: string, cutoff: number): boolean => {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) || timestamp < cutoff
}

export interface RetentionApplicationReport {
  readonly studentId: string
  readonly removed: {
    readonly sessions: number
    readonly instructionalHistory: number
    readonly safetyEvents: number
    readonly notifications: number
    readonly auditEvents: number
    readonly reviewItems: number
  }
  readonly preservedOpenReviewEventIds: readonly string[]
}

export function authorizeRetentionPolicyChange(
  principal: SafetyPrincipal,
  policy: RetentionPolicy,
): ReturnType<typeof authorizeStudentAccess> {
  return authorizeStudentAccess(
    principal,
    policy.studentId,
    ['parent'],
    'permissions:manage',
  )
}

/**
 * Applies one student's policy without touching records for siblings. Open
 * human reviews preserve their event until review resolution; this exception is
 * explicit in the policy and reported to the caller.
 */
export function applyRetentionPolicy(
  store: SafetyCenterStore,
  policy: RetentionPolicy,
  now: string,
): { readonly store: SafetyCenterStore; readonly report: RetentionApplicationReport } {
  const nowTimestamp = Date.parse(now)
  if (Number.isNaN(nowTimestamp)) throw new TypeError('now must be an RFC 3339 date-time')
  const instructionalCutoff =
    nowTimestamp - policy.instructionalHistoryDays * DAY_MS
  const safetyCutoff = nowTimestamp - policy.safetyEventDays * DAY_MS
  const auditCutoff = nowTimestamp - policy.auditHistoryDays * DAY_MS
  const openReviews = store.reviewItems.filter(
    (item) =>
      item.studentId === policy.studentId &&
      (item.status === 'queued' || item.status === 'in-review'),
  )
  const openReviewEventIds = new Set(openReviews.map((item) => item.eventId))

  const instructionalHistory = store.instructionalHistory.filter(
    (record) =>
      record.studentId !== policy.studentId ||
      !olderThan(record.endedAt ?? record.startedAt, instructionalCutoff),
  )
  const safetyEvents = store.safetyEvents.filter(
    (event) =>
      event.studentId !== policy.studentId ||
      openReviewEventIds.has(event.eventId) ||
      !olderThan(event.occurredAt, safetyCutoff),
  )
  const keptEventIds = new Set(
    safetyEvents
      .filter((event) => event.studentId === policy.studentId)
      .map((event) => event.eventId),
  )
  const reviewItems = store.reviewItems.filter(
    (item) =>
      item.studentId !== policy.studentId ||
      item.status === 'queued' ||
      item.status === 'in-review' ||
      keptEventIds.has(item.eventId),
  )
  const notifications = store.notifications.filter(
    (notification) =>
      notification.studentId !== policy.studentId ||
      keptEventIds.has(notification.eventId),
  )
  const auditEvents = store.auditEvents.filter(
    (event) =>
      event.studentId !== policy.studentId || !olderThan(event.at, auditCutoff),
  )
  const retainedSessionIds = new Set<string>()
  for (const history of instructionalHistory) {
    if (history.studentId === policy.studentId) retainedSessionIds.add(history.sessionId)
  }
  for (const event of safetyEvents) {
    if (event.studentId === policy.studentId) retainedSessionIds.add(event.sessionId)
  }
  for (const block of store.blocks) {
    if (block.studentId === policy.studentId && block.active) {
      retainedSessionIds.add(block.sessionId)
    }
  }
  const sessions = store.sessions.filter(
    (session) =>
      session.studentId !== policy.studentId ||
      session.status === 'active' ||
      retainedSessionIds.has(session.sessionId),
  )
  const next: SafetyCenterStore = {
    ...store,
    sessions,
    instructionalHistory,
    safetyEvents,
    notifications,
    auditEvents,
    reviewItems,
  }
  return {
    store: next,
    report: {
      studentId: policy.studentId,
      removed: {
        sessions: store.sessions.length - sessions.length,
        instructionalHistory:
          store.instructionalHistory.length - instructionalHistory.length,
        safetyEvents: store.safetyEvents.length - safetyEvents.length,
        notifications: store.notifications.length - notifications.length,
        auditEvents: store.auditEvents.length - auditEvents.length,
        reviewItems: store.reviewItems.length - reviewItems.length,
      },
      preservedOpenReviewEventIds: [...openReviewEventIds].filter((eventId) =>
        keptEventIds.has(eventId),
      ),
    },
  }
}

export type DataOperationError =
  | AccessDenialReason
  | 'request-student-mismatch'
  | 'request-not-approved'
  | 'request-not-exportable'

export type DataOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: DataOperationError }

export function approveDeletionRequest(
  principal: SafetyPrincipal,
  request: DataDeletionRequest,
  at: string,
): DataOperationResult<DataDeletionRequest> {
  const authorization = authorizeStudentAccess(
    principal,
    request.studentId,
    ['parent'],
    'data:delete',
  )
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (
    request.status !== 'requested' &&
    request.status !== 'awaiting-parent-confirmation'
  ) {
    return { ok: false, reason: 'request-not-approved' }
  }
  return {
    ok: true,
    value: {
      ...request,
      status: 'approved',
      approvedBy: { role: 'parent', actorId: principal.actorId },
      approvedAt: at,
    },
  }
}

export interface DeletionExecutionReport {
  readonly request: DataDeletionRequest
  readonly deleted: {
    readonly sessions: number
    readonly instructionalHistory: number
    readonly safetyEvents: number
    readonly notifications: number
    readonly reports: number
    readonly inactiveBlocks: number
    readonly reviewItems: number
  }
  readonly retained: {
    readonly openReviewEventIds: readonly string[]
    readonly activeBlockIds: readonly string[]
  }
}

export function executeApprovedDeletion(
  principal: SafetyPrincipal,
  store: SafetyCenterStore,
  request: DataDeletionRequest,
  input: { readonly at: string; readonly auditId: string },
): DataOperationResult<{
  readonly store: SafetyCenterStore
  readonly report: DeletionExecutionReport
}> {
  const authorization = authorizeStudentAccess(
    principal,
    request.studentId,
    ['parent', 'system'],
    'data:delete',
  )
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (
    request.status !== 'approved' ||
    !request.approvedBy ||
    !request.approvedAt
  ) {
    return { ok: false, reason: 'request-not-approved' }
  }

  const deleteInstructional =
    request.scope === 'instructional-history' ||
    request.scope === 'all-eligible-data'
  const deleteSafety =
    request.scope === 'safety-events' || request.scope === 'all-eligible-data'
  const openReviews = store.reviewItems.filter(
    (item) =>
      item.studentId === request.studentId &&
      (item.status === 'queued' || item.status === 'in-review'),
  )
  const retainedOpenEventIds = new Set(openReviews.map((item) => item.eventId))

  const instructionalHistory = deleteInstructional
    ? store.instructionalHistory.filter(
        (record) => record.studentId !== request.studentId,
      )
    : store.instructionalHistory
  const safetyEvents = deleteSafety
    ? store.safetyEvents.filter(
        (event) =>
          event.studentId !== request.studentId ||
          retainedOpenEventIds.has(event.eventId),
      )
    : store.safetyEvents
  const keptEventIds = new Set(
    safetyEvents
      .filter((event) => event.studentId === request.studentId)
      .map((event) => event.eventId),
  )
  const notifications = deleteSafety
    ? store.notifications.filter(
        (notification) =>
          notification.studentId !== request.studentId ||
          keptEventIds.has(notification.eventId),
      )
    : store.notifications
  const retainedReportIds = new Set<string>()
  for (const event of safetyEvents) {
    if (
      event.studentId === request.studentId &&
      event.kind === 'student-report-event'
    ) {
      retainedReportIds.add(event.reportId)
    }
  }
  const reports = deleteSafety
    ? store.reports.filter(
        (report) =>
          report.studentId !== request.studentId ||
          retainedReportIds.has(report.reportId),
      )
    : store.reports
  const activeBlockIds = store.blocks
    .filter((block) => block.studentId === request.studentId && block.active)
    .map((block) => block.blockId)
  const blocks = deleteSafety
    ? store.blocks.filter(
        (block) => block.studentId !== request.studentId || block.active,
      )
    : store.blocks
  const reviewItems = deleteSafety
    ? store.reviewItems.filter(
        (item) =>
          item.studentId !== request.studentId ||
          item.status === 'queued' ||
          item.status === 'in-review',
      )
    : store.reviewItems

  const retainedSessionIds = new Set<string>()
  for (const record of instructionalHistory) {
    if (record.studentId === request.studentId) retainedSessionIds.add(record.sessionId)
  }
  for (const event of safetyEvents) {
    if (event.studentId === request.studentId) retainedSessionIds.add(event.sessionId)
  }
  for (const block of blocks) {
    if (block.studentId === request.studentId && block.active) {
      retainedSessionIds.add(block.sessionId)
    }
  }
  const sessions =
    deleteInstructional || deleteSafety
      ? store.sessions.filter(
          (session) =>
            session.studentId !== request.studentId ||
            session.status === 'active' ||
            retainedSessionIds.has(session.sessionId),
        )
      : store.sessions
  const partial =
    deleteSafety &&
    (retainedOpenEventIds.size > 0 || activeBlockIds.length > 0)
  const completedRequest: DataDeletionRequest = {
    ...request,
    status: partial ? 'partially-completed' : 'completed',
    completedAt: input.at,
  }
  const audit = createAuditEvent({
    auditId: input.auditId,
    studentId: request.studentId,
    at: input.at,
    principal,
    action: 'deletion-completed',
    targetType: 'data-request',
    targetId: request.requestId,
    outcome: partial ? 'partial' : 'completed',
    ...(partial ? { reasonCode: 'open-review-or-active-block-preserved' } : {}),
  })
  const nextStore: SafetyCenterStore = {
    ...store,
    sessions,
    instructionalHistory,
    safetyEvents,
    notifications,
    reports,
    blocks,
    reviewItems,
    auditEvents: [...store.auditEvents, audit],
    deletionRequests: [
      ...store.deletionRequests.filter(
        (candidate) =>
          candidate.studentId !== request.studentId ||
          candidate.requestId !== request.requestId,
      ),
      completedRequest,
    ],
  }
  return {
    ok: true,
    value: {
      store: nextStore,
      report: {
        request: completedRequest,
        deleted: {
          sessions: store.sessions.length - sessions.length,
          instructionalHistory:
            store.instructionalHistory.length - instructionalHistory.length,
          safetyEvents: store.safetyEvents.length - safetyEvents.length,
          notifications: store.notifications.length - notifications.length,
          reports: store.reports.length - reports.length,
          inactiveBlocks: store.blocks.length - blocks.length,
          reviewItems: store.reviewItems.length - reviewItems.length,
        },
        retained: {
          openReviewEventIds: [...retainedOpenEventIds],
          activeBlockIds,
        },
      },
    },
  }
}

export function buildSafetyCenterDataExport(
  principal: SafetyPrincipal,
  store: SafetyCenterStore,
  request: DataExportRequest,
  generatedAt: string,
): DataOperationResult<SafetyCenterDataExport> {
  const authorization = authorizeStudentAccess(
    principal,
    request.studentId,
    ['student', 'parent'],
    'data:export',
  )
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (
    request.requestedBy.actorId !== principal.actorId ||
    request.requestedBy.role !== principal.role
  ) {
    return { ok: false, reason: 'request-student-mismatch' }
  }
  if (request.status === 'denied') {
    return { ok: false, reason: 'request-not-exportable' }
  }
  const includeInstructional =
    request.scope === 'instructional-history' ||
    request.scope === 'all-safety-center-data'
  const includeSafety =
    request.scope === 'safety-events' ||
    request.scope === 'all-safety-center-data'
  return {
    ok: true,
    value: {
      kind: 'safety-center-data-export',
      schemaVersion: AI_SAFETY_SCHEMA_VERSION,
      createdAt: generatedAt,
      requestId: request.requestId,
      studentId: request.studentId,
      generatedAt,
      notices: {
        parentReview: PARENT_REVIEW_NOTICE,
        safetyException: SAFETY_EXCEPTION_NOTICE,
        rawAudio: RAW_AUDIO_NOTICE,
      },
      instructionalHistory: includeInstructional
        ? store.instructionalHistory.filter(
            (record) => record.studentId === request.studentId,
          )
        : [],
      safetyEvents: includeSafety
        ? store.safetyEvents.filter(
            (event) => event.studentId === request.studentId,
          )
        : [],
      reports: includeSafety
        ? store.reports.filter((report) => report.studentId === request.studentId)
        : [],
      blocks: includeSafety
        ? store.blocks
            .filter((block) => block.studentId === request.studentId)
            .map((block) => {
              if (
                principal.role !== 'student' ||
                !block.liftedBy ||
                block.liftedBy.role === 'student'
              ) {
                return block
              }
              const { liftedBy: _liftedBy, ...studentSafeBlock } = block
              return studentSafeBlock
            })
        : [],
      // Human-review assignments/history are intentionally excluded.
      auditEvents:
        request.scope === 'all-safety-center-data' && principal.role === 'parent'
          ? store.auditEvents.filter(
              (event) => event.studentId === request.studentId,
            )
          : [],
    },
  }
}
