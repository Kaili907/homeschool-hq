import {
  type DayWorkloadSummary,
  type ISODate,
  type LoadCategory,
  type RecoveryError,
  type RecoverySchedule,
  type ScheduleEvent,
  type StudentWorkloadPolicy,
  type WeekWorkloadSummary,
} from './types'
import {
  addCalendarDays,
  datesBetween,
  minutesToTime,
  mondayOf,
  timeToMinutes,
  weekdayOf,
} from './time'
import { detectConflicts } from './conflicts'

const INACTIVE_STATUSES = new Set<ScheduleEvent['status']>([
  'cancelled',
  'deferred',
])

function includedEvent(event: ScheduleEvent): boolean {
  return !INACTIVE_STATUSES.has(event.status)
}

function sourceOriginDate(event: ScheduleEvent): string | undefined {
  const origin = event.source.adapterData?.recoveryOriginDate
  return typeof origin === 'string' ? origin : undefined
}

export function policyForStudent(
  schedule: RecoverySchedule,
  studentId: string,
): StudentWorkloadPolicy | undefined {
  return schedule.students.find((student) => student.id === studentId)?.policy
}

export function dailyLimitFor(
  policy: StudentWorkloadPolicy,
  date: ISODate,
): StudentWorkloadPolicy['defaultDailyLimit'] {
  return policy.dailyLimitOverrides[date] ?? policy.defaultDailyLimit
}

export function dayWorkload(
  schedule: RecoverySchedule,
  studentId: string,
  date: ISODate,
  excludeEventIds: readonly string[] = [],
): DayWorkloadSummary {
  const policy = policyForStudent(schedule, studentId)
  if (!policy) {
    throw new RangeError(`Unknown student ${studentId}`)
  }
  const excluded = new Set(excludeEventIds)
  const events = schedule.events.filter(
    (event) =>
      event.studentId === studentId &&
      event.start.date === date &&
      includedEvent(event) &&
      !excluded.has(event.id),
  )
  const scheduledMinutes = events.reduce(
    (total, event) => total + event.durationMinutes,
    0,
  )
  const academicMinutes = events
    .filter((event) => event.loadCategory === 'academic')
    .reduce((total, event) => total + event.durationMinutes, 0)
  const physicalMinutes = events
    .filter((event) => event.loadCategory === 'physical')
    .reduce((total, event) => total + event.durationMinutes, 0)
  const carryoverMinutes = events
    .filter((event) => {
      const origin = sourceOriginDate(event)
      return origin !== undefined && origin < event.start.date
    })
    .reduce((total, event) => total + event.durationMinutes, 0)
  const limit = dailyLimitFor(policy, date)
  return {
    studentId,
    date,
    scheduledMinutes,
    academicMinutes,
    physicalMinutes,
    carryoverMinutes,
    limit,
    overloaded:
      scheduledMinutes > limit.maxScheduledMinutes ||
      academicMinutes > limit.maxAcademicMinutes ||
      physicalMinutes > limit.maxPhysicalMinutes ||
      carryoverMinutes > policy.maxCarryoverMinutesPerDay,
  }
}

export function weekWorkload(
  schedule: RecoverySchedule,
  studentId: string,
  anchorDate: ISODate,
): WeekWorkloadSummary {
  const policy = policyForStudent(schedule, studentId)
  if (!policy) throw new RangeError(`Unknown student ${studentId}`)
  const weekStart = mondayOf(anchorDate)
  const weekEnd = addCalendarDays(weekStart, 6)
  const days = datesBetween(weekStart, weekEnd).map((date) =>
    dayWorkload(schedule, studentId, date),
  )
  const academicMinutes = days.reduce(
    (total, day) => total + day.academicMinutes,
    0,
  )
  return {
    studentId,
    weekStart,
    weekEnd,
    academicMinutes,
    maxAcademicMinutes: policy.maxAcademicMinutesPerWeek,
    overloaded:
      academicMinutes > policy.maxAcademicMinutesPerWeek ||
      days.some((day) => day.overloaded),
    days,
  }
}

export interface FocusStaminaViolation {
  studentId: string
  date: ISODate
  eventIds: string[]
  continuousMinutes: number
  maximumMinutes: number
}

export function focusStaminaViolations(
  schedule: RecoverySchedule,
  studentId?: string,
): FocusStaminaViolation[] {
  const students = studentId
    ? schedule.students.filter((student) => student.id === studentId)
    : schedule.students
  const violations: FocusStaminaViolation[] = []
  for (const student of students) {
    const dates = [
      ...new Set(
        schedule.events
          .filter(
            (event) =>
              event.studentId === student.id && includedEvent(event),
          )
          .map((event) => event.start.date),
      ),
    ]
    for (const date of dates) {
      const events = schedule.events
        .filter(
          (event) =>
            event.studentId === student.id &&
            event.start.date === date &&
            includedEvent(event),
        )
        .sort(
          (left, right) =>
            timeToMinutes(left.start.time) - timeToMinutes(right.start.time),
        )
      let continuousMinutes = 0
      let priorEnd: number | undefined
      let chain: string[] = []
      for (const event of events) {
        const start = timeToMinutes(event.start.time)
        const end = start + event.durationMinutes
        const resets =
          event.kind === 'movement-break' ||
          event.kind === 'focus-recovery-break' ||
          event.kind === 'meal' ||
          event.kind === 'sleep' ||
          event.kind === 'protected-time' ||
          (priorEnd !== undefined &&
            start - priorEnd >= student.policy.minimumBreakMinutes)
        if (resets) {
          continuousMinutes = 0
          chain = []
        }
        if (event.loadCategory === 'academic') {
          continuousMinutes += event.durationMinutes
          chain.push(event.id)
          if (
            continuousMinutes > student.policy.maxContinuousFocusMinutes
          ) {
            violations.push({
              studentId: student.id,
              date,
              eventIds: [...chain],
              continuousMinutes,
              maximumMinutes: student.policy.maxContinuousFocusMinutes,
            })
          }
        }
        priorEnd = Math.max(priorEnd ?? end, end)
      }
    }
  }
  return violations
}

export interface AvailableSlot {
  studentId: string
  date: ISODate
  startTime: string
  endTime: string
}

export interface FindAvailableSlotInput {
  schedule: RecoverySchedule
  studentId: string
  dates: ISODate[]
  durationMinutes: number
  loadCategory: LoadCategory
  excludeEventIds?: string[]
  earliestTime?: string
  latestTime?: string
  /** Restrict every candidate to one or more explicit windows. */
  windows?: Array<{
    date: ISODate
    startTime: string
    endTime: string
  }>
  stepMinutes?: number
}

function workloadAllows(
  schedule: RecoverySchedule,
  studentId: string,
  date: ISODate,
  durationMinutes: number,
  loadCategory: LoadCategory,
  excludeEventIds: readonly string[],
): boolean {
  const summary = dayWorkload(schedule, studentId, date, excludeEventIds)
  const policy = policyForStudent(schedule, studentId)
  if (!policy) return false
  const scheduled = summary.scheduledMinutes + durationMinutes
  const academic =
    summary.academicMinutes +
    (loadCategory === 'academic' ? durationMinutes : 0)
  const physical =
    summary.physicalMinutes +
    (loadCategory === 'physical' ? durationMinutes : 0)
  const weekStart = mondayOf(date)
  const weekEnd = addCalendarDays(weekStart, 6)
  const excluded = new Set(excludeEventIds)
  const weekAcademicMinutes = schedule.events
    .filter(
      (event) =>
        event.studentId === studentId &&
        event.start.date >= weekStart &&
        event.start.date <= weekEnd &&
        event.loadCategory === 'academic' &&
        includedEvent(event) &&
        !excluded.has(event.id),
    )
    .reduce((total, event) => total + event.durationMinutes, 0)
  return (
    scheduled <= summary.limit.maxScheduledMinutes &&
    academic <= summary.limit.maxAcademicMinutes &&
    physical <= summary.limit.maxPhysicalMinutes &&
    (loadCategory !== 'academic' ||
      weekAcademicMinutes + durationMinutes <=
        policy.maxAcademicMinutesPerWeek)
  )
}

function placementIsClear(
  schedule: RecoverySchedule,
  studentId: string,
  date: ISODate,
  startMinute: number,
  durationMinutes: number,
  excluded: Set<string>,
): boolean {
  const endMinute = startMinute + durationMinutes
  for (const event of schedule.events) {
    if (
      event.studentId !== studentId ||
      event.start.date !== date ||
      !includedEvent(event) ||
      excluded.has(event.id)
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
 * Finds the first complete, non-overlapping slot without exceeding daily,
 * weekly, or carryover limits. Work is never silently split by this function.
 */
export function findAvailableSlot(
  input: FindAvailableSlotInput,
): AvailableSlot | undefined {
  const {
    schedule,
    studentId,
    durationMinutes,
    loadCategory,
    excludeEventIds = [],
    stepMinutes = 5,
  } = input
  const policy = policyForStudent(schedule, studentId)
  if (
    !policy ||
    durationMinutes <= 0 ||
    !Number.isInteger(durationMinutes) ||
    stepMinutes <= 0
  ) {
    return undefined
  }
  const excluded = new Set(excludeEventIds)
  for (const date of [...input.dates].sort()) {
    if (!policy.activeWeekdays.includes(weekdayOf(date))) continue
    if (
      !workloadAllows(
        schedule,
        studentId,
        date,
        durationMinutes,
        loadCategory,
        excludeEventIds,
      )
    ) {
      continue
    }
    const allowedWindows =
      input.windows?.filter((window) => window.date === date) ?? []
    const windows =
      allowedWindows.length > 0
        ? allowedWindows
        : [
            {
              date,
              startTime: input.earliestTime ?? policy.earliestStartTime,
              endTime: input.latestTime ?? policy.latestEndTime,
            },
          ]
    for (const window of windows) {
      const startBoundary = Math.max(
        timeToMinutes(window.startTime),
        timeToMinutes(input.earliestTime ?? policy.earliestStartTime),
      )
      const endBoundary = Math.min(
        timeToMinutes(window.endTime),
        timeToMinutes(input.latestTime ?? policy.latestEndTime),
      )
      for (
        let start = startBoundary;
        start + durationMinutes <= endBoundary;
        start += stepMinutes
      ) {
        if (
          placementIsClear(
            schedule,
            studentId,
            date,
            start,
            durationMinutes,
            excluded,
          )
        ) {
          return {
            studentId,
            date,
            startTime: minutesToTime(start),
            endTime: minutesToTime(start + durationMinutes),
          }
        }
      }
    }
  }
  return undefined
}

export function workloadInvariantErrors(
  schedule: RecoverySchedule,
): RecoveryError[] {
  const errors: RecoveryError[] = []
  for (const student of schedule.students) {
    const dates = [
      ...new Set(
        schedule.events
          .filter((event) => event.studentId === student.id)
          .map((event) => event.start.date),
      ),
    ]
    for (const date of dates) {
      const day = dayWorkload(schedule, student.id, date)
      if (day.scheduledMinutes > day.limit.maxScheduledMinutes) {
        errors.push({
          code: 'daily-overload',
          message: `${student.displayName} has ${day.scheduledMinutes} scheduled minutes on ${date}, above the ${day.limit.maxScheduledMinutes}-minute limit.`,
        })
      }
      if (day.academicMinutes > day.limit.maxAcademicMinutes) {
        errors.push({
          code: 'daily-overload',
          message: `${student.displayName} has ${day.academicMinutes} academic minutes on ${date}, above the ${day.limit.maxAcademicMinutes}-minute limit.`,
        })
      }
      if (day.physicalMinutes > day.limit.maxPhysicalMinutes) {
        errors.push({
          code: 'daily-overload',
          message: `${student.displayName} has ${day.physicalMinutes} physical minutes on ${date}, above the ${day.limit.maxPhysicalMinutes}-minute limit.`,
        })
      }
      if (day.carryoverMinutes > student.policy.maxCarryoverMinutesPerDay) {
        errors.push({
          code: 'carryover-overload',
          message: `${student.displayName} has ${day.carryoverMinutes} carryover minutes on ${date}, above the ${student.policy.maxCarryoverMinutesPerDay}-minute limit.`,
        })
      }
    }
    for (const weekStart of new Set(dates.map(mondayOf))) {
      const week = weekWorkload(schedule, student.id, weekStart)
      if (week.academicMinutes > week.maxAcademicMinutes) {
        errors.push({
          code: 'weekly-overload',
          message: `${student.displayName} has ${week.academicMinutes} academic minutes in the week of ${week.weekStart}, above the ${week.maxAcademicMinutes}-minute limit.`,
        })
      }
    }
  }
  for (const violation of focusStaminaViolations(schedule)) {
    errors.push({
      code: 'focus-stamina-overload',
      message: `${violation.continuousMinutes} continuous academic minutes on ${violation.date} exceeds the ${violation.maximumMinutes}-minute focus limit.`,
    })
  }
  for (const conflict of detectConflicts(schedule)) {
    errors.push({
      code: 'new-conflict',
      message: conflict.message,
    })
  }
  return errors
}
