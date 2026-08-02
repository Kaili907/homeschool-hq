import {
  type RecoveryError,
  type RecoveryResult,
  type RecoverySchedule,
  type ScheduleChange,
  type ScheduleEvent,
  type WorkItem,
} from './types'
import { eventIsProtected } from './models'
import { newConflicts } from './conflicts'
import { validateRecoverySchedule } from './schemas'
import { workloadInvariantErrors } from './workload'

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function changedPlacementOrDisposition(
  before: ScheduleEvent,
  after: ScheduleEvent | null,
): boolean {
  if (!after) return true
  return (
    before.start.date !== after.start.date ||
    before.start.time !== after.start.time ||
    before.durationMinutes !== after.durationMinutes ||
    before.status !== after.status ||
    before.mobility !== after.mobility ||
    before.parentLocked !== after.parentLocked ||
    before.protection !== after.protection
  )
}

function requiredWorkRemoved(
  before: WorkItem,
  after: WorkItem | null,
): boolean {
  return (
    before.requirement === 'required' &&
    (after === null ||
      after.status === 'waived' ||
      after.duration.expectedMinutes < before.duration.expectedMinutes)
  )
}

function scheduleWithChangesUnchecked(
  schedule: RecoverySchedule,
  changes: readonly ScheduleChange[],
  updatedAt: string,
): RecoverySchedule {
  const eventMap = new Map(schedule.events.map((event) => [event.id, event]))
  const workMap = new Map(schedule.workItems.map((work) => [work.id, work]))
  for (const change of changes) {
    if (change.kind === 'event') {
      if (change.after === null) eventMap.delete(change.eventId)
      else eventMap.set(change.eventId, change.after)
    } else if (change.after === null) {
      workMap.delete(change.workItemId)
    } else {
      workMap.set(change.workItemId, change.after)
    }
  }
  return {
    ...schedule,
    events: [...eventMap.values()].sort((left, right) => {
      const student = left.studentId.localeCompare(right.studentId)
      if (student !== 0) return student
      const date = left.start.date.localeCompare(right.start.date)
      if (date !== 0) return date
      const time = left.start.time.localeCompare(right.start.time)
      return time || left.id.localeCompare(right.id)
    }),
    workItems: [...workMap.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    revision: schedule.revision + 1,
    updatedAt,
  }
}

function newWorkloadErrors(
  before: RecoverySchedule,
  after: RecoverySchedule,
): RecoveryError[] {
  const existing = new Set(
    workloadInvariantErrors(before).map(
      (error) => `${error.code}:${error.message}`,
    ),
  )
  return workloadInvariantErrors(after).filter(
    (error) => !existing.has(`${error.code}:${error.message}`),
  )
}

export interface ApplyScheduleChangesOptions {
  updatedAt: string
  explicitlyApproveRequiredWorkRemoval?: boolean
  /**
   * Generated options and ordinary parent approvals keep this false. It is
   * exposed for importing already-reviewed legacy edits, not silent recovery.
   */
  allowExistingBeforeMismatch?: boolean
}

/**
 * Applies typed changes after checking immutable rows, stale before-images,
 * runtime schema, conflicts, workload, carryover, and focus-stamina invariants.
 */
export function applyScheduleChanges(
  schedule: RecoverySchedule,
  changes: readonly ScheduleChange[],
  options: ApplyScheduleChangesOptions,
): RecoveryResult<RecoverySchedule> {
  const errors: RecoveryError[] = []
  const seen = new Set<string>()

  for (const [index, change] of changes.entries()) {
    const key = `${change.kind}:${
      change.kind === 'event' ? change.eventId : change.workItemId
    }`
    if (seen.has(key)) {
      errors.push({
        code: 'invalid-decision',
        message: `A change set may edit ${key} only once.`,
        path: `changes[${index}]`,
      })
      continue
    }
    seen.add(key)

    if (change.kind === 'event') {
      const current = schedule.events.find(
        (event) => event.id === change.eventId,
      )
      if (
        !options.allowExistingBeforeMismatch &&
        !equivalent(current ?? null, change.before)
      ) {
        errors.push({
          code: 'invalid-decision',
          message: `Event ${change.eventId} changed after this option was prepared.`,
          path: `changes[${index}].before`,
        })
        continue
      }
      if (change.after && change.after.id !== change.eventId) {
        errors.push({
          code: 'invalid-decision',
          message: 'An event change cannot rewrite the stable event ID.',
          path: `changes[${index}].after.id`,
        })
      }
      if (
        current &&
        changedPlacementOrDisposition(current, change.after) &&
        current.parentLocked
      ) {
        errors.push({
          code: 'parent-locked-change',
          message: `${current.title} is parent locked and cannot be changed by recovery.`,
        })
      } else if (
        current &&
        changedPlacementOrDisposition(current, change.after) &&
        eventIsProtected(current)
      ) {
        errors.push({
          code: 'protected-time-change',
          message: `${current.title} is protected and cannot be changed by recovery.`,
        })
      } else if (
        current &&
        changedPlacementOrDisposition(current, change.after) &&
        current.mobility === 'fixed'
      ) {
        errors.push({
          code: 'fixed-event-change',
          message: `${current.title} is fixed and cannot be moved, resized, or replaced.`,
        })
      }
    } else {
      const current = schedule.workItems.find(
        (work) => work.id === change.workItemId,
      )
      if (
        !options.allowExistingBeforeMismatch &&
        !equivalent(current ?? null, change.before)
      ) {
        errors.push({
          code: 'invalid-decision',
          message: `Work item ${change.workItemId} changed after this option was prepared.`,
          path: `changes[${index}].before`,
        })
        continue
      }
      if (change.after && change.after.id !== change.workItemId) {
        errors.push({
          code: 'invalid-decision',
          message: 'A work-item change cannot rewrite the stable work-item ID.',
          path: `changes[${index}].after.id`,
        })
      }
      if (
        current &&
        requiredWorkRemoved(current, change.after) &&
        !options.explicitlyApproveRequiredWorkRemoval
      ) {
        errors.push({
          code: 'required-work-removal',
          message: `${current.title} is required work and needs explicit parent approval before it can be waived or reduced.`,
        })
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  const after = scheduleWithChangesUnchecked(
    schedule,
    changes,
    options.updatedAt,
  )
  const validation = validateRecoverySchedule(after)
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.issues.map((validationIssue) => ({
        code: 'invalid-contract',
        message: validationIssue.message,
        path: validationIssue.path,
      })),
    }
  }

  const conflicts = newConflicts(schedule, after)
  if (conflicts.length > 0) {
    return {
      ok: false,
      errors: conflicts.map((conflict) => ({
        code: 'new-conflict',
        message: conflict.message,
      })),
    }
  }

  const overload = newWorkloadErrors(schedule, after)
  if (overload.length > 0) return { ok: false, errors: overload }
  return { ok: true, value: after }
}

/**
 * Preview helper used by proposal generation. A successful result is exactly
 * the schedule that parent approval would commit at the same revision.
 */
export function previewScheduleChanges(
  schedule: RecoverySchedule,
  changes: readonly ScheduleChange[],
  updatedAt: string,
): RecoveryResult<RecoverySchedule> {
  return applyScheduleChanges(schedule, changes, { updatedAt })
}
