import type {
  AccessDenialReason,
  InstructionalHistoryRecord,
  SafetyAuditEvent,
  SafetyCenterStore,
  SafetyEvent,
  SafetyPrincipal,
  TutorTimelineEntry,
} from './contracts.ts'
import { AI_SAFETY_SCHEMA_VERSION } from './contracts.ts'
import { authorizeStudentAccess } from './access.ts'

export interface TutorHistoryQuery {
  readonly studentId: string
  readonly search?: string
  readonly subjectIds?: readonly string[]
  /** Inclusive ISO date or RFC 3339 date-time. */
  readonly from?: string
  /** Inclusive ISO date or RFC 3339 date-time. */
  readonly through?: string
  readonly limit?: number
}

export type TutorHistoryQueryResult =
  | {
      readonly status: 'ok'
      readonly records: readonly InstructionalHistoryRecord[]
      readonly totalMatched: number
    }
  | {
      readonly status: 'empty'
      readonly records: readonly []
      readonly totalMatched: 0
      readonly message: 'No tutor history matches these filters.'
    }
  | {
      readonly status: 'unavailable'
      readonly records: readonly []
      readonly message: 'Tutor history is unavailable right now. No missing conversation details will be guessed.'
    }
  | {
      readonly status: 'not-authorized'
      readonly records: readonly []
      readonly reason: AccessDenialReason
      readonly message: 'Tutor history is not available for this account.'
    }

const lower = (value: string): string => value.trim().toLocaleLowerCase()

function searchableText(record: InstructionalHistoryRecord): string {
  const timelineText = record.timeline
    .map((entry) => {
      if (entry.type === 'message') return entry.text
      if (entry.type === 'tutor-help') return entry.displayText
      if (entry.type === 'answer-withheld') return entry.explanation
      return entry.label
    })
    .join(' ')
  return lower(
    [
      record.subject.displayName,
      record.parentVisibleSummary,
      record.searchableKeywords.join(' '),
      timelineText,
    ].join(' '),
  )
}

function lowerBound(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = Date.parse(dateOnly ? `${value}T00:00:00.000Z` : value)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function upperBound(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = Date.parse(dateOnly ? `${value}T23:59:59.999Z` : value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

/**
 * Parent and student history reads are fail-closed and student-scoped. The
 * result never contains another student's record, even when the backing store
 * is accidentally mixed.
 */
export function queryTutorHistory(
  principal: SafetyPrincipal,
  store: SafetyCenterStore | undefined,
  query: TutorHistoryQuery,
): TutorHistoryQueryResult {
  const authorization = authorizeStudentAccess(
    principal,
    query.studentId,
    ['parent', 'student'],
    'history:read',
  )
  if (!authorization.allowed) {
    return {
      status: 'not-authorized',
      records: [],
      reason: authorization.reason,
      message: 'Tutor history is not available for this account.',
    }
  }
  if (!store || store.historyAvailability === 'unavailable') {
    return {
      status: 'unavailable',
      records: [],
      message:
        'Tutor history is unavailable right now. No missing conversation details will be guessed.',
    }
  }
  const needle = query.search ? lower(query.search) : ''
  const from = lowerBound(query.from)
  const through = upperBound(query.through)
  const allowedSubjects = query.subjectIds ? new Set(query.subjectIds) : undefined
  const records = store.instructionalHistory
    .filter((record) => record.studentId === query.studentId)
    .filter((record) => !allowedSubjects || allowedSubjects.has(record.subject.subjectId))
    .filter((record) => {
      const started = Date.parse(record.startedAt)
      return !Number.isNaN(started) && started >= from && started <= through
    })
    .filter((record) => needle.length === 0 || searchableText(record).includes(needle))
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
  if (records.length === 0) {
    return {
      status: 'empty',
      records: [],
      totalMatched: 0,
      message: 'No tutor history matches these filters.',
    }
  }
  const requestedLimit = query.limit ?? 50
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.max(1, Math.min(200, Math.floor(requestedLimit)))
      : 50
  return { status: 'ok', records: records.slice(0, limit), totalMatched: records.length }
}

export type TutorTimelineResult =
  | { readonly status: 'ok'; readonly timeline: readonly TutorTimelineEntry[] }
  | {
      readonly status: 'unavailable'
      readonly timeline: readonly []
      readonly message: string
    }
  | {
      readonly status: 'not-authorized'
      readonly timeline: readonly []
      readonly reason: AccessDenialReason
      readonly message: string
    }

export function getTutorTimeline(
  principal: SafetyPrincipal,
  store: SafetyCenterStore | undefined,
  studentId: string,
  historyId: string,
): TutorTimelineResult {
  const authorization = authorizeStudentAccess(
    principal,
    studentId,
    ['parent', 'student'],
    'history:read',
  )
  if (!authorization.allowed) {
    return {
      status: 'not-authorized',
      timeline: [],
      reason: authorization.reason,
      message: 'Tutor timeline is not available for this account.',
    }
  }
  if (!store || store.historyAvailability === 'unavailable') {
    return {
      status: 'unavailable',
      timeline: [],
      message:
        'Tutor history is unavailable right now. No missing conversation details will be guessed.',
    }
  }
  const record = store.instructionalHistory.find(
    (candidate) =>
      candidate.studentId === studentId && candidate.historyId === historyId,
  )
  if (!record) {
    return {
      status: 'unavailable',
      timeline: [],
      message: 'This tutor timeline is unavailable. No missing details will be guessed.',
    }
  }
  return {
    status: 'ok',
    timeline: [...record.timeline].sort(
      (left, right) => left.sequence - right.sequence,
    ),
  }
}

export interface SafetyEventQuery {
  readonly studentId: string
  readonly classifications?: readonly SafetyEvent['classification'][]
  readonly minimumSeverity?: SafetyEvent['severity']
  readonly from?: string
  readonly through?: string
}

export type SafetyEventQueryResult =
  | { readonly status: 'ok'; readonly events: readonly SafetyEvent[] }
  | { readonly status: 'empty'; readonly events: readonly [] }
  | {
      readonly status: 'not-authorized'
      readonly events: readonly []
      readonly reason: AccessDenialReason
    }

const severityRank: Readonly<Record<SafetyEvent['severity'], number>> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}

export function querySafetyEvents(
  principal: SafetyPrincipal,
  store: SafetyCenterStore,
  query: SafetyEventQuery,
): SafetyEventQueryResult {
  const authorization = authorizeStudentAccess(
    principal,
    query.studentId,
    ['parent', 'reviewer', 'student'],
    'safety-events:read',
  )
  if (!authorization.allowed) {
    return { status: 'not-authorized', events: [], reason: authorization.reason }
  }
  const from = lowerBound(query.from)
  const through = upperBound(query.through)
  const minimum = query.minimumSeverity ? severityRank[query.minimumSeverity] : 0
  const classifications = query.classifications
    ? new Set(query.classifications)
    : undefined
  const events = store.safetyEvents
    .filter((event) => event.studentId === query.studentId)
    .filter((event) => !classifications || classifications.has(event.classification))
    .filter((event) => severityRank[event.severity] >= minimum)
    .filter((event) => {
      const at = Date.parse(event.occurredAt)
      return !Number.isNaN(at) && at >= from && at <= through
    })
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
  return events.length > 0 ? { status: 'ok', events } : { status: 'empty', events: [] }
}

export function createAuditEvent(input: {
  readonly auditId: string
  readonly studentId: string
  readonly at: string
  readonly principal: Pick<SafetyPrincipal, 'actorId' | 'role'>
  readonly action: SafetyAuditEvent['action']
  readonly targetType: SafetyAuditEvent['targetType']
  readonly targetId: string
  readonly outcome: SafetyAuditEvent['outcome']
  readonly reasonCode?: string
}): SafetyAuditEvent {
  if (
    input.reasonCode !== undefined &&
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(input.reasonCode)
  ) {
    throw new TypeError('Audit reasonCode must be a structured code, not free-form text.')
  }
  return {
    kind: 'safety-audit-event',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.at,
    auditId: input.auditId,
    studentId: input.studentId,
    at: input.at,
    actor: {
      actorId: input.principal.actorId,
      role: input.principal.role,
    },
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    outcome: input.outcome,
    ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
  }
}

export const appendAuditEvent = (
  store: SafetyCenterStore,
  auditEvent: SafetyAuditEvent,
): SafetyCenterStore => ({
  ...store,
  auditEvents: [...store.auditEvents, auditEvent],
})
