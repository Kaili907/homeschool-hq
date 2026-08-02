import {
  type Conflict,
  type ProtectedWindow,
  type RecoverySchedule,
  type ScheduleEvent,
} from './types'
import { eventIsProtected } from './models'
import {
  intervalsOverlap,
  timeToMinutes,
  zonedInterval,
} from './time'

const INACTIVE_STATUSES = new Set<ScheduleEvent['status']>([
  'cancelled',
  'deferred',
])

function activeEvent(event: ScheduleEvent): boolean {
  return !INACTIVE_STATUSES.has(event.status)
}

function conflictId(
  kind: Conflict['kind'],
  date: string,
  ids: readonly string[],
): string {
  return `${kind}:${date}:${[...ids].sort().join(':')}`
}

function outsideStudentDay(
  schedule: RecoverySchedule,
  event: ScheduleEvent,
): Conflict | undefined {
  const student = schedule.students.find(
    (candidate) => candidate.id === event.studentId,
  )
  if (!student) return undefined
  const start = timeToMinutes(event.start.time)
  const end = start + event.durationMinutes
  const earliest = timeToMinutes(student.policy.earliestStartTime)
  const latest = timeToMinutes(student.policy.latestEndTime)
  if (start >= earliest && end <= latest) return undefined
  return {
    id: conflictId('outside-student-day', event.start.date, [event.id]),
    studentId: event.studentId,
    date: event.start.date,
    kind: 'outside-student-day',
    eventIds: [event.id],
    message: `${event.title} falls outside the student’s protected day boundary.`,
  }
}

function windowApplies(
  window: ProtectedWindow,
  event: ScheduleEvent,
): boolean {
  return (
    window.date === event.start.date &&
    (window.studentId === undefined || window.studentId === event.studentId)
  )
}

function overlapsProtectedWindow(
  event: ScheduleEvent,
  window: ProtectedWindow,
): boolean {
  const eventStart = timeToMinutes(event.start.time)
  const eventEnd = eventStart + event.durationMinutes
  const windowStart = timeToMinutes(window.startTime)
  const windowEnd = timeToMinutes(window.endTime)
  return eventStart < windowEnd && windowStart < eventEnd
}

export interface DetectConflictOptions {
  studentId?: string
  dates?: string[]
}

/**
 * Detects factual conflicts. It never resolves fixed-fixed overlaps by moving
 * either event; callers must surface them to a parent.
 */
export function detectConflicts(
  schedule: RecoverySchedule,
  options: DetectConflictOptions = {},
): Conflict[] {
  const dateSet = options.dates ? new Set(options.dates) : undefined
  const events = schedule.events.filter(
    (event) =>
      activeEvent(event) &&
      (options.studentId === undefined ||
        event.studentId === options.studentId) &&
      (dateSet === undefined || dateSet.has(event.start.date)),
  )
  const result: Conflict[] = []

  for (const event of events) {
    const boundary = outsideStudentDay(schedule, event)
    if (boundary) result.push(boundary)
    for (const window of schedule.protectedWindows) {
      if (
        windowApplies(window, event) &&
        overlapsProtectedWindow(event, window)
      ) {
        result.push({
          id: conflictId('protected-time-overlap', event.start.date, [
            event.id,
            window.id,
          ]),
          studentId: event.studentId,
          date: event.start.date,
          kind: 'protected-time-overlap',
          eventIds: [event.id],
          protectedWindowId: window.id,
          message: `${event.title} overlaps protected ${window.kind} time (${window.title}).`,
        })
      }
    }
  }

  for (let firstIndex = 0; firstIndex < events.length; firstIndex += 1) {
    const first = events[firstIndex]
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < events.length;
      secondIndex += 1
    ) {
      const second = events[secondIndex]
      if (
        first.studentId !== second.studentId ||
        first.start.date !== second.start.date
      ) {
        continue
      }
      const firstInterval = zonedInterval(
        first.start,
        first.durationMinutes,
        schedule.timeZone,
      )
      const secondInterval = zonedInterval(
        second.start,
        second.durationMinutes,
        schedule.timeZone,
      )
      if (!intervalsOverlap(firstInterval, secondInterval)) continue
      const fixed =
        first.mobility === 'fixed' ||
        second.mobility === 'fixed' ||
        first.parentLocked ||
        second.parentLocked ||
        eventIsProtected(first) ||
        eventIsProtected(second)
      const kind: Conflict['kind'] = fixed
        ? 'fixed-event-overlap'
        : 'event-overlap'
      result.push({
        id: conflictId(kind, first.start.date, [first.id, second.id]),
        studentId: first.studentId,
        date: first.start.date,
        kind,
        eventIds: [first.id, second.id].sort(),
        message: `${first.title} overlaps ${second.title}.`,
      })
    }
  }

  return [...new Map(result.map((conflict) => [conflict.id, conflict])).values()]
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function newConflicts(
  before: RecoverySchedule,
  after: RecoverySchedule,
): Conflict[] {
  const existing = new Set(detectConflicts(before).map((conflict) => conflict.id))
  return detectConflicts(after).filter((conflict) => !existing.has(conflict.id))
}
