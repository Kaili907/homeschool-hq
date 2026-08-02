import {
  type ActivityKind,
  type DueDateRiskWarning,
  type DurationEstimate,
  type LoadCategory,
  type PriorityBand,
  type RecoverySchedule,
  type ScheduleEvent,
  type StudentWorkloadPolicy,
  type WorkItem,
} from './types'
import {
  compareLocalDateTime,
  instantToLocalDateTime,
  localDateTimeToEpochMs,
} from './time'

const PRIORITY_BAND_FLOOR: Record<PriorityBand, number> = {
  critical: 90,
  high: 70,
  normal: 40,
  low: 0,
}

export const ACADEMIC_ACTIVITY_KINDS: readonly ActivityKind[] = [
  'academic-assignment',
  'romeo-virtual-academy-assignment',
  'manuel-academy-lesson',
  'adaptive-tutor-intervention',
]

export const PHYSICAL_ACTIVITY_KINDS: readonly ActivityKind[] = [
  'wrestling',
  'jiu-jitsu',
  'weight-training',
  'pe-activity',
  'movement-break',
]

export const RESTORATIVE_ACTIVITY_KINDS: readonly ActivityKind[] = [
  'movement-break',
  'focus-recovery-break',
  'meal',
  'sleep',
  'protected-time',
]

export function defaultLoadCategory(kind: ActivityKind): LoadCategory {
  if (ACADEMIC_ACTIVITY_KINDS.includes(kind)) return 'academic'
  if (PHYSICAL_ACTIVITY_KINDS.includes(kind)) return 'physical'
  if (RESTORATIVE_ACTIVITY_KINDS.includes(kind)) return 'restorative'
  if (kind === 'ready-for-life-activity') return 'life-skills'
  return 'neutral'
}

export function normalizedDurationEstimate(
  value: DurationEstimate,
): DurationEstimate {
  const minimumMinutes = Math.max(1, Math.round(value.minimumMinutes))
  const maximumMinutes = Math.max(
    minimumMinutes,
    Math.round(value.maximumMinutes),
  )
  const expectedMinutes = Math.max(
    minimumMinutes,
    Math.min(maximumMinutes, Math.round(value.expectedMinutes)),
  )
  return {
    ...value,
    expectedMinutes,
    minimumMinutes,
    maximumMinutes,
    ...(value.observedSampleCount === undefined
      ? {}
      : {
          observedSampleCount: Math.max(
            0,
            Math.round(value.observedSampleCount),
          ),
        }),
  }
}

export function remainingWorkMinutes(workItem: WorkItem): number {
  if (workItem.status === 'completed' || workItem.status === 'waived') return 0
  return Math.max(
    0,
    Math.round(workItem.duration.expectedMinutes - workItem.completedMinutes),
  )
}

export function scheduledWorkMinutes(
  schedule: RecoverySchedule,
  workItemId: string,
): number {
  return schedule.events
    .filter(
      (event) =>
        event.workItemId === workItemId &&
        event.status !== 'cancelled' &&
        event.status !== 'deferred' &&
        event.status !== 'completed',
    )
    .reduce((total, event) => total + event.durationMinutes, 0)
}

export function unscheduledWorkMinutes(
  schedule: RecoverySchedule,
  workItem: WorkItem,
): number {
  return Math.max(
    0,
    remainingWorkMinutes(workItem) -
      scheduledWorkMinutes(schedule, workItem.id),
  )
}

function deadlineUrgency(
  schedule: RecoverySchedule,
  workItem: WorkItem,
  now: string,
): number {
  if (!workItem.deadline) return 0
  const currentLocal = instantToLocalDateTime(now, schedule.timeZone)
  const dueEpoch = localDateTimeToEpochMs(
    workItem.deadline.due,
    schedule.timeZone,
    'later',
  )
  const nowEpoch = localDateTimeToEpochMs(
    currentLocal,
    schedule.timeZone,
    'earlier',
  )
  const hours = (dueEpoch - nowEpoch) / 3_600_000
  if (hours < 0) return 30
  if (hours <= 24) return 25
  if (hours <= 72) return 18
  if (hours <= 7 * 24) return 10
  return 3
}

/**
 * Effective priority combines the stable parent/source score with deadline
 * urgency. It never lowers the configured band floor.
 */
export function effectivePriorityScore(
  schedule: RecoverySchedule,
  workItem: WorkItem,
  now: string,
): number {
  const factorWeight = workItem.priority.factors.reduce(
    (total, factor) => total + factor.weight,
    0,
  )
  return Math.max(
    PRIORITY_BAND_FLOOR[workItem.priority.band],
    Math.min(
      130,
      workItem.priority.baseScore +
        factorWeight +
        deadlineUrgency(schedule, workItem, now) +
        (workItem.requirement === 'required' ? 10 : 0),
    ),
  )
}

export function compareWorkPriority(
  schedule: RecoverySchedule,
  left: WorkItem,
  right: WorkItem,
  now: string,
): number {
  const score =
    effectivePriorityScore(schedule, right, now) -
    effectivePriorityScore(schedule, left, now)
  if (score !== 0) return score
  if (left.deadline && right.deadline) {
    const deadlineOrder = compareLocalDateTime(
      left.deadline.due,
      right.deadline.due,
    )
    if (deadlineOrder !== 0) return deadlineOrder
  } else if (left.deadline) {
    return -1
  } else if (right.deadline) {
    return 1
  }
  return left.id.localeCompare(right.id)
}

export function dueDateRiskForWorkItem(
  schedule: RecoverySchedule,
  workItem: WorkItem,
  now: string,
): DueDateRiskWarning {
  const unscheduledMinutes = unscheduledWorkMinutes(schedule, workItem)
  if (!workItem.deadline || remainingWorkMinutes(workItem) === 0) {
    return {
      workItemId: workItem.id,
      studentId: workItem.studentId,
      level: 'none',
      unscheduledMinutes,
      message:
        remainingWorkMinutes(workItem) === 0
          ? `${workItem.title} is complete.`
          : `${workItem.title} has no configured due date.`,
    }
  }

  const nowLocal = instantToLocalDateTime(now, schedule.timeZone)
  if (compareLocalDateTime(workItem.deadline.due, nowLocal) < 0) {
    return {
      workItemId: workItem.id,
      studentId: workItem.studentId,
      level: 'overdue',
      due: workItem.deadline.due,
      unscheduledMinutes,
      message: `${workItem.title} is overdue with ${remainingWorkMinutes(
        workItem,
      )} minutes remaining.`,
    }
  }

  const dueEpoch = localDateTimeToEpochMs(
    workItem.deadline.due,
    schedule.timeZone,
    'later',
  )
  const nowEpoch = localDateTimeToEpochMs(nowLocal, schedule.timeZone, 'earlier')
  const days = Math.max(0, (dueEpoch - nowEpoch) / 86_400_000)
  const remaining = remainingWorkMinutes(workItem)
  const intensity = days === 0 ? remaining : remaining / Math.max(1, days)
  const policy = schedule.students.find(
    (student) => student.id === workItem.studentId,
  )?.policy
  const dailyCapacity = policy?.defaultDailyLimit.maxAcademicMinutes ?? 240

  const level =
    unscheduledMinutes > 0 && (days <= 1 || intensity > dailyCapacity)
      ? 'at-risk'
      : unscheduledMinutes > 0 || days <= 2
        ? 'watch'
        : 'none'
  return {
    workItemId: workItem.id,
    studentId: workItem.studentId,
    level,
    due: workItem.deadline.due,
    unscheduledMinutes,
    message:
      level === 'at-risk'
        ? `${workItem.title} may miss its due date unless ${remaining} remaining minutes are placed safely.`
        : level === 'watch'
          ? `${workItem.title} needs attention before ${workItem.deadline.due.date}.`
          : `${workItem.title} remains on track for ${workItem.deadline.due.date}.`,
  }
}

export function dueDateRisks(
  schedule: RecoverySchedule,
  now: string,
  studentId?: string,
): DueDateRiskWarning[] {
  return schedule.workItems
    .filter(
      (item) =>
        item.status === 'active' &&
        (studentId === undefined || item.studentId === studentId),
    )
    .map((item) => dueDateRiskForWorkItem(schedule, item, now))
    .filter((warning) => warning.level !== 'none')
}

export function eventIsProtected(event: ScheduleEvent): boolean {
  return (
    event.protection !== 'none' ||
    event.kind === 'sleep' ||
    event.kind === 'meal' ||
    event.kind === 'protected-time'
  )
}

export function eventCanMove(event: ScheduleEvent): boolean {
  return (
    event.mobility === 'movable' &&
    !event.parentLocked &&
    !eventIsProtected(event)
  )
}

export function eventCanResize(
  event: ScheduleEvent,
  workItem?: WorkItem,
): boolean {
  return (
    eventCanMove(event) &&
    (workItem === undefined || workItem.canShorten) &&
    event.status !== 'completed'
  )
}

export function recommendedFocusBlockMinutes(
  policy: StudentWorkloadPolicy,
  workItem: WorkItem,
  requestedMinutes = remainingWorkMinutes(workItem),
): number {
  const floor = Math.min(
    requestedMinutes,
    Math.max(
      policy.minimumFocusBlockMinutes,
      workItem.minimumSessionMinutes,
    ),
  )
  const desired = Math.min(
    requestedMinutes,
    policy.preferredFocusBlockMinutes,
    policy.maxContinuousFocusMinutes,
  )
  return Math.min(requestedMinutes, Math.max(floor, desired))
}

/**
 * A focus-difficulty response is supportive when it reduces continuous demand,
 * adds recovery time, or moves work to a safer slot without adding total work.
 */
export function isSupportiveFocusAdjustment(
  before: ScheduleEvent,
  afterEvents: ScheduleEvent[],
  policy: StudentWorkloadPolicy,
): boolean {
  const active = afterEvents.filter(
    (event) => event.status !== 'cancelled' && event.status !== 'deferred',
  )
  const total = active.reduce(
    (minutes, event) => minutes + event.durationMinutes,
    0,
  )
  const longest = active.reduce(
    (minutes, event) => Math.max(minutes, event.durationMinutes),
    0,
  )
  const includesRecovery = active.some(
    (event) =>
      event.kind === 'focus-recovery-break' ||
      event.kind === 'movement-break',
  )
  return (
    total <= before.durationMinutes &&
    (longest < before.durationMinutes ||
      includesRecovery ||
      longest <= policy.preferredFocusBlockMinutes)
  )
}
