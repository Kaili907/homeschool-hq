import type {
  AccessDenialReason,
  FalsePositiveReview,
  HumanReviewHistoryEntry,
  HumanReviewItem,
  SafetyCenterStore,
  SafetyEvent,
  SafetyPrincipal,
} from './contracts.ts'
import { AI_SAFETY_SCHEMA_VERSION } from './contracts.ts'
import { authorizeStudentAccess } from './access.ts'

export type ReviewWorkflowError =
  | AccessDenialReason
  | 'invalid-transition'
  | 'false-positive-already-open'
  | 'false-positive-not-pending'
  | 'invalid-comment'
  | 'invalid-reason-code'

export type ReviewWorkflowResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ReviewWorkflowError }

function priorityFor(event: SafetyEvent): HumanReviewItem['priority'] {
  if (event.severity === 'critical' || event.escalation === 'human-safety-review') {
    return 'urgent'
  }
  if (
    event.severity === 'high' ||
    event.escalation === 'urgent-parent-attention' ||
    event.escalation === 'parent-review'
  ) {
    return 'prompt'
  }
  return 'routine'
}

export function queueHumanReview(
  event: SafetyEvent,
  input: {
    readonly reviewId: string
    readonly actionId: string
    readonly systemActorId: string
    readonly at: string
  },
): HumanReviewItem {
  return {
    kind: 'human-review-item',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.at,
    reviewId: input.reviewId,
    eventId: event.eventId,
    sessionId: event.sessionId,
    studentId: event.studentId,
    priority: priorityFor(event),
    status: 'queued',
    queuedAt: input.at,
    history: [
      {
        actionId: input.actionId,
        at: input.at,
        actor: { role: 'system', actorId: input.systemActorId },
        action: 'queued',
        reasonCode: event.classification,
      },
    ],
    resolution: 'pending',
  }
}

export function claimHumanReview(
  principal: SafetyPrincipal,
  item: HumanReviewItem,
  input: { readonly actionId: string; readonly at: string },
): ReviewWorkflowResult<HumanReviewItem> {
  const authorization = authorizeStudentAccess(
    principal,
    item.studentId,
    ['reviewer'],
    'reviews:resolve',
  )
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (item.status !== 'queued') return { ok: false, reason: 'invalid-transition' }
  return {
    ok: true,
    value: {
      ...item,
      status: 'in-review',
      assignedReviewerId: principal.actorId,
      history: [
        ...item.history,
        {
          actionId: input.actionId,
          at: input.at,
          actor: { role: 'reviewer', actorId: principal.actorId },
          action: 'claimed',
        },
      ],
    },
  }
}

export function requestFalsePositiveReview(
  principal: SafetyPrincipal,
  item: HumanReviewItem,
  input: {
    readonly falsePositiveId: string
    readonly actionId: string
    readonly at: string
    readonly reason: FalsePositiveReview['reason']
    readonly comment?: string
  },
): ReviewWorkflowResult<HumanReviewItem> {
  const authorization = authorizeStudentAccess(principal, item.studentId, [
    'student',
    'parent',
  ])
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (item.falsePositiveReview?.status === 'pending') {
    return { ok: false, reason: 'false-positive-already-open' }
  }
  if (item.status === 'dismissed') return { ok: false, reason: 'invalid-transition' }
  const comment = input.comment?.trim()
  if (comment !== undefined && (comment.length === 0 || comment.length > 500)) {
    return { ok: false, reason: 'invalid-comment' }
  }
  const actorRole = principal.role as 'student' | 'parent'
  const falsePositiveReview: FalsePositiveReview = {
    falsePositiveId: input.falsePositiveId,
    requestedAt: input.at,
    requestedBy: { role: actorRole, actorId: principal.actorId },
    reason: input.reason,
    ...(comment ? { comment } : {}),
    status: 'pending',
  }
  const historyEntry: HumanReviewHistoryEntry = {
    actionId: input.actionId,
    at: input.at,
    actor: { role: actorRole, actorId: principal.actorId },
    action: 'false-positive-requested',
    reasonCode: input.reason,
  }
  const { resolvedAt: _resolvedAt, ...itemWithoutResolvedAt } = item
  const base = item.status === 'resolved' ? itemWithoutResolvedAt : item
  return {
    ok: true,
    value: {
      ...base,
      // A resolved item is reopened for a new, explicit false-positive review.
      status: item.status === 'resolved' ? 'queued' : item.status,
      resolution: item.status === 'resolved' ? 'pending' : item.resolution,
      falsePositiveReview,
      history: [...item.history, historyEntry],
    },
  }
}

export function decideFalsePositiveReview(
  principal: SafetyPrincipal,
  item: HumanReviewItem,
  input: {
    readonly actionId: string
    readonly at: string
    readonly decision: 'accepted' | 'rejected'
    readonly reasonCode: string
  },
): ReviewWorkflowResult<HumanReviewItem> {
  const authorization = authorizeStudentAccess(
    principal,
    item.studentId,
    ['reviewer'],
    'reviews:resolve',
  )
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(input.reasonCode)) {
    return { ok: false, reason: 'invalid-reason-code' }
  }
  if (!item.falsePositiveReview || item.falsePositiveReview.status !== 'pending') {
    return { ok: false, reason: 'false-positive-not-pending' }
  }
  if (
    item.assignedReviewerId !== undefined &&
    item.assignedReviewerId !== principal.actorId
  ) {
    return { ok: false, reason: 'invalid-transition' }
  }
  const accepted = input.decision === 'accepted'
  return {
    ok: true,
    value: {
      ...item,
      assignedReviewerId: principal.actorId,
      falsePositiveReview: {
        ...item.falsePositiveReview,
        status: input.decision,
        decidedAt: input.at,
        decidedByReviewerId: principal.actorId,
      },
      status: accepted ? 'resolved' : 'in-review',
      resolution: accepted ? 'false-positive' : 'pending',
      ...(accepted ? { resolvedAt: input.at } : {}),
      history: [
        ...item.history,
        {
          actionId: input.actionId,
          at: input.at,
          actor: { role: 'reviewer', actorId: principal.actorId },
          action: accepted ? 'false-positive-accepted' : 'false-positive-rejected',
          reasonCode: input.reasonCode,
        },
      ],
    },
  }
}

export function resolveHumanReview(
  principal: SafetyPrincipal,
  item: HumanReviewItem,
  input: {
    readonly actionId: string
    readonly at: string
    readonly resolution: 'safety-concern-confirmed' | 'insufficient-context'
    readonly reasonCode: string
  },
): ReviewWorkflowResult<HumanReviewItem> {
  const authorization = authorizeStudentAccess(
    principal,
    item.studentId,
    ['reviewer'],
    'reviews:resolve',
  )
  if (!authorization.allowed) return { ok: false, reason: authorization.reason }
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(input.reasonCode)) {
    return { ok: false, reason: 'invalid-reason-code' }
  }
  if (item.status !== 'in-review' && item.status !== 'queued') {
    return { ok: false, reason: 'invalid-transition' }
  }
  if (
    item.assignedReviewerId !== undefined &&
    item.assignedReviewerId !== principal.actorId
  ) {
    return { ok: false, reason: 'invalid-transition' }
  }
  return {
    ok: true,
    value: {
      ...item,
      status: 'resolved',
      assignedReviewerId: principal.actorId,
      resolution: input.resolution,
      resolvedAt: input.at,
      history: [
        ...item.history,
        {
          actionId: input.actionId,
          at: input.at,
          actor: { role: 'reviewer', actorId: principal.actorId },
          action: 'resolved',
          reasonCode: input.reasonCode,
        },
      ],
    },
  }
}

export type ReviewQueueResult =
  | { readonly status: 'ok'; readonly items: readonly HumanReviewItem[] }
  | {
      readonly status: 'not-authorized'
      readonly items: readonly []
      readonly reason: AccessDenialReason
    }

export function humanReviewQueueForStudent(
  principal: SafetyPrincipal,
  store: SafetyCenterStore,
  studentId: string,
): ReviewQueueResult {
  const authorization = authorizeStudentAccess(
    principal,
    studentId,
    ['parent', 'reviewer'],
    'reviews:read',
  )
  if (!authorization.allowed) {
    return { status: 'not-authorized', items: [], reason: authorization.reason }
  }
  return {
    status: 'ok',
    items: store.reviewItems
      .filter((item) => item.studentId === studentId)
      .sort((left, right) => {
        const priority = { urgent: 2, prompt: 1, routine: 0 } as const
        return (
          priority[right.priority] - priority[left.priority] ||
          Date.parse(left.queuedAt) - Date.parse(right.queuedAt)
        )
      }),
  }
}

export function upsertReviewItem(
  store: SafetyCenterStore,
  item: HumanReviewItem,
): SafetyCenterStore {
  return {
    ...store,
    reviewItems: [
      ...store.reviewItems.filter(
        (candidate) =>
          candidate.studentId !== item.studentId ||
          candidate.reviewId !== item.reviewId,
      ),
      item,
    ],
  }
}
