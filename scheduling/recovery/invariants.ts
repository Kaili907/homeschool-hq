import {
  type RecoveryError,
  type RecoverySchedule,
  type ScheduleEvent,
} from './types'
import { eventIsProtected } from './models'
import { newConflicts } from './conflicts'
import { validateRecoverySchedule } from './schemas'
import { workloadInvariantErrors } from './workload'

export interface RecoveryInvariantReport {
  valid: boolean
  errors: RecoveryError[]
}

function eventPlacementChanged(
  before: ScheduleEvent,
  after: ScheduleEvent | undefined,
): boolean {
  return (
    !after ||
    before.start.date !== after.start.date ||
    before.start.time !== after.start.time ||
    before.durationMinutes !== after.durationMinutes ||
    before.status !== after.status
  )
}

export function validateRecoveryInvariants(
  schedule: RecoverySchedule,
): RecoveryInvariantReport {
  const schema = validateRecoverySchedule(schedule)
  const errors: RecoveryError[] = schema.valid
    ? []
    : schema.issues.map((validationIssue) => ({
        code: 'invalid-contract',
        message: validationIssue.message,
        path: validationIssue.path,
      }))
  if (schema.valid) errors.push(...workloadInvariantErrors(schedule))
  return { valid: errors.length === 0, errors }
}

/**
 * Transition-level invariant check used by integrations before converting an
 * approved recovery into shared-calendar overrides.
 */
export function validateRecoveryTransition(
  before: RecoverySchedule,
  after: RecoverySchedule,
  explicitlyApproveRequiredWorkRemoval = false,
): RecoveryInvariantReport {
  const errors: RecoveryError[] = []
  const afterEvents = new Map(after.events.map((event) => [event.id, event]))
  for (const event of before.events) {
    if (!eventPlacementChanged(event, afterEvents.get(event.id))) continue
    if (event.parentLocked) {
      errors.push({
        code: 'parent-locked-change',
        message: `${event.title} is parent locked.`,
      })
    } else if (event.mobility === 'fixed') {
      errors.push({
        code: 'fixed-event-change',
        message: `${event.title} is fixed.`,
      })
    } else if (eventIsProtected(event)) {
      errors.push({
        code: 'protected-time-change',
        message: `${event.title} is protected.`,
      })
    }
  }
  const afterWork = new Map(after.workItems.map((work) => [work.id, work]))
  for (const work of before.workItems) {
    if (work.requirement !== 'required') continue
    const next = afterWork.get(work.id)
    if (
      (!next ||
        next.status === 'waived' ||
        next.duration.expectedMinutes < work.duration.expectedMinutes) &&
      !explicitlyApproveRequiredWorkRemoval
    ) {
      errors.push({
        code: 'required-work-removal',
        message: `${work.title} is required and was removed or reduced without explicit parent approval.`,
      })
    }
  }
  errors.push(
    ...newConflicts(before, after).map((conflict) => ({
      code: 'new-conflict' as const,
      message: conflict.message,
    })),
  )
  const existingWorkload = new Set(
    workloadInvariantErrors(before).map(
      (error) => `${error.code}:${error.message}`,
    ),
  )
  errors.push(
    ...workloadInvariantErrors(after).filter(
      (error) => !existingWorkload.has(`${error.code}:${error.message}`),
    ),
  )
  return { valid: errors.length === 0, errors }
}
