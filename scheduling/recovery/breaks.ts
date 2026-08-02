import {
  type ISODate,
  type RecoverySchedule,
  type ScheduleEvent,
} from './types'
import { minutesToTime, timeToMinutes } from './time'
import { policyForStudent } from './workload'

export interface BreakPlacement {
  studentId: string
  date: ISODate
  afterEventId: string
  startTime: string
  durationMinutes: number
  kind: 'movement-break' | 'focus-recovery-break'
  reason: string
}

function breakSlotIsClear(
  schedule: RecoverySchedule,
  studentId: string,
  date: ISODate,
  startMinute: number,
  durationMinutes: number,
): boolean {
  const endMinute = startMinute + durationMinutes
  for (const event of schedule.events) {
    if (
      event.studentId !== studentId ||
      event.start.date !== date ||
      event.status === 'cancelled' ||
      event.status === 'deferred'
    ) {
      continue
    }
    const eventStart = timeToMinutes(event.start.time)
    const eventEnd = eventStart + event.durationMinutes
    if (startMinute < eventEnd && eventStart < endMinute) return false
  }
  for (const window of schedule.protectedWindows) {
    if (
      window.date !== date ||
      (window.studentId !== undefined && window.studentId !== studentId)
    ) {
      continue
    }
    const windowStart = timeToMinutes(window.startTime)
    const windowEnd = timeToMinutes(window.endTime)
    if (startMinute < windowEnd && windowStart < endMinute) return false
  }
  return true
}

/**
 * Computes supportive break placements after sustained academic demand. This
 * function makes recommendations only; it never deletes work or turns a focus
 * difficulty into a penalty.
 */
export function requiredBreakPlacements(
  schedule: RecoverySchedule,
  studentId: string,
  date: ISODate,
): BreakPlacement[] {
  const policy = policyForStudent(schedule, studentId)
  if (!policy) return []
  const events = schedule.events
    .filter(
      (event) =>
        event.studentId === studentId &&
        event.start.date === date &&
        event.status !== 'cancelled' &&
        event.status !== 'deferred',
    )
    .sort(
      (left, right) =>
        timeToMinutes(left.start.time) - timeToMinutes(right.start.time),
    )
  const result: BreakPlacement[] = []
  let focusMinutes = 0
  let priorEnd: number | undefined
  for (const event of events) {
    const start = timeToMinutes(event.start.time)
    const end = start + event.durationMinutes
    const existingReset =
      event.kind === 'movement-break' ||
      event.kind === 'focus-recovery-break' ||
      event.kind === 'meal' ||
      event.kind === 'sleep' ||
      event.kind === 'protected-time' ||
      (priorEnd !== undefined &&
        start - priorEnd >= policy.minimumBreakMinutes)
    if (existingReset) focusMinutes = 0
    if (event.loadCategory === 'academic') {
      focusMinutes += event.durationMinutes
      if (focusMinutes >= policy.movementBreakAfterMinutes) {
        const kind =
          focusMinutes > policy.maxContinuousFocusMinutes
            ? 'focus-recovery-break'
            : 'movement-break'
        const durationMinutes =
          kind === 'focus-recovery-break'
            ? policy.focusRecoveryBreakMinutes
            : policy.movementBreakMinutes
        if (
          end + durationMinutes <= timeToMinutes(policy.latestEndTime) &&
          breakSlotIsClear(
            schedule,
            studentId,
            date,
            end,
            durationMinutes,
          )
        ) {
          result.push({
            studentId,
            date,
            afterEventId: event.id,
            startTime: minutesToTime(end),
            durationMinutes,
            kind,
            reason:
              kind === 'focus-recovery-break'
                ? `Continuous focus reached ${focusMinutes} minutes; a supportive reset is due.`
                : `Focused work reached the ${policy.movementBreakAfterMinutes}-minute movement-break threshold.`,
          })
          focusMinutes = 0
        }
      }
    }
    priorEnd = Math.max(priorEnd ?? end, end)
  }
  return result
}

export function createBreakEvent(
  placement: BreakPlacement,
  eventId: string,
  now: string,
): ScheduleEvent {
  return {
    id: eventId,
    studentId: placement.studentId,
    title:
      placement.kind === 'movement-break'
        ? 'Movement break'
        : 'Focus recovery break',
    kind: placement.kind,
    loadCategory: 'restorative',
    start: { date: placement.date, time: placement.startTime },
    durationMinutes: placement.durationMinutes,
    mobility: 'movable',
    parentLocked: false,
    protection: 'none',
    status: 'scheduled',
    source: {
      system: 'parent',
      sourceId: eventId,
      adapterData: {
        generatedBy: 'schedule-recovery',
        afterEventId: placement.afterEventId,
      },
    },
    createdAt: now,
    updatedAt: now,
  }
}
