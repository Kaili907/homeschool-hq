import {
  RECOVERY_CONTRACT_VERSION,
  type ActivityKind,
  type JsonObject,
  type RecoveryChoice,
  type RecoveryProposal,
  type RecoverySchedule,
  type ValidationIssue,
  type ValidationResult,
} from './types'
import {
  isISODate,
  isInstantString,
  isLocalTime,
  isValidTimeZone,
  isWindowBoundaryTime,
  timeToMinutes,
} from './time'

const ACTIVITY_KINDS = new Set<ActivityKind>([
  'academic-assignment',
  'romeo-virtual-academy-assignment',
  'manuel-academy-lesson',
  'adaptive-tutor-intervention',
  'ready-for-life-activity',
  'wrestling',
  'jiu-jitsu',
  'weight-training',
  'pe-activity',
  'appointment',
  'meal',
  'movement-break',
  'focus-recovery-break',
  'parent-created-activity',
  'sleep',
  'protected-time',
])

const LOAD_CATEGORIES = new Set([
  'academic',
  'life-skills',
  'physical',
  'restorative',
  'neutral',
])
const REQUIREMENTS = new Set(['required', 'review', 'optional'])
const PRIORITY_BANDS = new Set(['critical', 'high', 'normal', 'low'])
const DEADLINE_KINDS = new Set(['hard', 'soft'])
const CONFIDENCE = new Set(['high', 'medium', 'low'])
const DURATION_BASES = new Set([
  'source-provided',
  'student-history',
  'parent-estimate',
  'teacher-estimate',
  'default',
])
const SOURCE_SYSTEMS = new Set([
  'shared-planner',
  'romeo-virtual-academy',
  'manuel-academy',
  'adaptive-tutor',
  'ready-for-life',
  'parent',
  'external',
])
const WORK_STATUSES = new Set(['active', 'completed', 'waived'])
const EVENT_STATUSES = new Set([
  'scheduled',
  'in-progress',
  'completed',
  'missed',
  'interrupted',
  'shortened',
  'overdue',
  'deferred',
  'cancelled',
])
const PROTECTIONS = new Set(['none', 'sleep', 'meal', 'parent-defined'])
const CHOICES = new Set<RecoveryChoice>([
  'move-to-tomorrow',
  'shorten-today',
  'split-sessions',
  'move-to-catch-up-block',
  'replace-lower-priority-review',
  'keep-due-date-rebalance-week',
  'parent-manual',
  'leave-unchanged',
])

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function issue(
  issues: ValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message })
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is string {
  if (typeof value === 'string' && value.trim().length > 0) return true
  issue(issues, path, 'type', 'Expected a non-empty string.')
  return false
}

function finiteInteger(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  ) {
    return true
  }
  issue(
    issues,
    path,
    'range',
    `Expected an integer from ${minimum} through ${maximum}.`,
  )
  return false
}

function enumValue(
  value: unknown,
  allowed: ReadonlySet<unknown>,
  path: string,
  issues: ValidationIssue[],
): boolean {
  if (allowed.has(value)) return true
  issue(issues, path, 'enum', 'Value is not in the allowed set.')
  return false
}

function localDateTime(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): boolean {
  const row = object(value)
  if (!row) {
    issue(issues, path, 'type', 'Expected a local date-time object.')
    return false
  }
  if (!isISODate(row.date)) issue(issues, `${path}.date`, 'format', 'Invalid date.')
  if (!isLocalTime(row.time)) {
    issue(issues, `${path}.time`, 'format', 'Invalid local start time.')
  }
  return isISODate(row.date) && isLocalTime(row.time)
}

function sourceReference(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  const source = object(value)
  if (!source) {
    issue(issues, path, 'type', 'Expected a source reference.')
    return
  }
  enumValue(source.system, SOURCE_SYSTEMS, `${path}.system`, issues)
  nonEmptyString(source.sourceId, `${path}.sourceId`, issues)
  if (
    source.adapterData !== undefined &&
    object(source.adapterData) === undefined
  ) {
    issue(
      issues,
      `${path}.adapterData`,
      'type',
      'Adapter data must be a JSON object.',
    )
  }
}

function priority(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  const row = object(value)
  if (!row) {
    issue(issues, path, 'type', 'Expected a priority model.')
    return
  }
  enumValue(row.band, PRIORITY_BANDS, `${path}.band`, issues)
  finiteInteger(row.baseScore, `${path}.baseScore`, issues, 0, 100)
  if (!Array.isArray(row.factors)) {
    issue(issues, `${path}.factors`, 'type', 'Expected an array.')
    return
  }
  row.factors.forEach((factorValue, index) => {
    const factor = object(factorValue)
    const factorPath = `${path}.factors[${index}]`
    if (!factor) {
      issue(issues, factorPath, 'type', 'Expected a priority factor.')
      return
    }
    enumValue(
      factor.code,
      new Set([
        'hard-deadline',
        'soft-deadline',
        'overdue',
        'prerequisite',
        'required',
        'parent-priority',
        'review',
        'student-readiness',
      ]),
      `${factorPath}.code`,
      issues,
    )
    finiteInteger(factor.weight, `${factorPath}.weight`, issues, -100, 100)
    nonEmptyString(factor.explanation, `${factorPath}.explanation`, issues)
  })
}

function duration(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  const row = object(value)
  if (!row) {
    issue(issues, path, 'type', 'Expected a duration estimate.')
    return
  }
  const expected = finiteInteger(
    row.expectedMinutes,
    `${path}.expectedMinutes`,
    issues,
    1,
    1440,
  )
  const minimum = finiteInteger(
    row.minimumMinutes,
    `${path}.minimumMinutes`,
    issues,
    1,
    1440,
  )
  const maximum = finiteInteger(
    row.maximumMinutes,
    `${path}.maximumMinutes`,
    issues,
    1,
    10080,
  )
  if (
    expected &&
    minimum &&
    maximum &&
    !(
      Number(row.minimumMinutes) <= Number(row.expectedMinutes) &&
      Number(row.expectedMinutes) <= Number(row.maximumMinutes)
    )
  ) {
    issue(
      issues,
      path,
      'duration-order',
      'Minimum must be at most expected, and expected at most maximum.',
    )
  }
  enumValue(row.confidence, CONFIDENCE, `${path}.confidence`, issues)
  enumValue(row.basis, DURATION_BASES, `${path}.basis`, issues)
  if (row.observedSampleCount !== undefined) {
    finiteInteger(
      row.observedSampleCount,
      `${path}.observedSampleCount`,
      issues,
      0,
    )
  }
}

function studentPolicy(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  studentId: string | undefined,
  scheduleTimeZone: string | undefined,
): void {
  const policy = object(value)
  if (!policy) {
    issue(issues, path, 'type', 'Expected a student workload policy.')
    return
  }
  if (
    nonEmptyString(policy.studentId, `${path}.studentId`, issues) &&
    studentId !== undefined &&
    policy.studentId !== studentId
  ) {
    issue(
      issues,
      `${path}.studentId`,
      'student-mismatch',
      'Policy student ID must match its student.',
    )
  }
  if (!isValidTimeZone(policy.timeZone)) {
    issue(issues, `${path}.timeZone`, 'time-zone', 'Invalid IANA time zone.')
  } else if (
    scheduleTimeZone !== undefined &&
    policy.timeZone !== scheduleTimeZone
  ) {
    issue(
      issues,
      `${path}.timeZone`,
      'time-zone-mismatch',
      'Student and household time zones must match in contract version 1.',
    )
  }
  for (const [field, minimum] of [
    ['maxAcademicMinutesPerWeek', 1],
    ['maxCarryoverMinutesPerDay', 0],
    ['preferredFocusBlockMinutes', 1],
    ['maxContinuousFocusMinutes', 1],
    ['minimumFocusBlockMinutes', 1],
    ['minimumBreakMinutes', 1],
    ['movementBreakAfterMinutes', 1],
    ['movementBreakMinutes', 1],
    ['focusRecoveryBreakMinutes', 1],
  ] as const) {
    finiteInteger(policy[field], `${path}.${field}`, issues, minimum, 10080)
  }
  if (!isLocalTime(policy.earliestStartTime)) {
    issue(
      issues,
      `${path}.earliestStartTime`,
      'format',
      'Invalid local time.',
    )
  }
  if (!isWindowBoundaryTime(policy.latestEndTime)) {
    issue(
      issues,
      `${path}.latestEndTime`,
      'format',
      'Invalid local boundary time.',
    )
  }
  if (
    isLocalTime(policy.earliestStartTime) &&
    isWindowBoundaryTime(policy.latestEndTime) &&
    timeToMinutes(policy.earliestStartTime) >=
      timeToMinutes(policy.latestEndTime)
  ) {
    issue(
      issues,
      path,
      'day-boundary',
      'Earliest start must be before latest end.',
    )
  }
  if (
    Number.isInteger(policy.minimumFocusBlockMinutes) &&
    Number.isInteger(policy.preferredFocusBlockMinutes) &&
    Number.isInteger(policy.maxContinuousFocusMinutes) &&
    !(
      Number(policy.minimumFocusBlockMinutes) <=
        Number(policy.preferredFocusBlockMinutes) &&
      Number(policy.preferredFocusBlockMinutes) <=
        Number(policy.maxContinuousFocusMinutes)
    )
  ) {
    issue(
      issues,
      path,
      'focus-order',
      'Minimum focus must be at most preferred focus, and preferred at most maximum continuous focus.',
    )
  }
  const defaultLimit = object(policy.defaultDailyLimit)
  if (!defaultLimit) {
    issue(
      issues,
      `${path}.defaultDailyLimit`,
      'type',
      'Expected daily limits.',
    )
  } else {
    validateDailyLimit(defaultLimit, `${path}.defaultDailyLimit`, issues)
  }
  const overrides = object(policy.dailyLimitOverrides)
  if (!overrides) {
    issue(
      issues,
      `${path}.dailyLimitOverrides`,
      'type',
      'Expected an override record.',
    )
  } else {
    for (const [date, limitValue] of Object.entries(overrides)) {
      if (!isISODate(date)) {
        issue(
          issues,
          `${path}.dailyLimitOverrides.${date}`,
          'format',
          'Override key must be an ISO date.',
        )
      }
      const limit = object(limitValue)
      if (limit) {
        validateDailyLimit(
          limit,
          `${path}.dailyLimitOverrides.${date}`,
          issues,
        )
      } else {
        issue(
          issues,
          `${path}.dailyLimitOverrides.${date}`,
          'type',
          'Expected daily limits.',
        )
      }
    }
  }
  if (
    !Array.isArray(policy.activeWeekdays) ||
    policy.activeWeekdays.length === 0
  ) {
    issue(
      issues,
      `${path}.activeWeekdays`,
      'type',
      'Expected at least one active weekday.',
    )
  } else {
    const unique = new Set(policy.activeWeekdays)
    if (
      unique.size !== policy.activeWeekdays.length ||
      policy.activeWeekdays.some(
        (day) => !Number.isInteger(day) || Number(day) < 1 || Number(day) > 7,
      )
    ) {
      issue(
        issues,
        `${path}.activeWeekdays`,
        'weekday',
        'Weekdays must be unique integers from 1 through 7.',
      )
    }
  }
}

function validateDailyLimit(
  limit: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  finiteInteger(
    limit.maxScheduledMinutes,
    `${path}.maxScheduledMinutes`,
    issues,
    1,
    1440,
  )
  finiteInteger(
    limit.maxAcademicMinutes,
    `${path}.maxAcademicMinutes`,
    issues,
    0,
    1440,
  )
  finiteInteger(
    limit.maxPhysicalMinutes,
    `${path}.maxPhysicalMinutes`,
    issues,
    0,
    1440,
  )
}

function duplicateIds(
  rows: unknown[],
  path: string,
  issues: ValidationIssue[],
): void {
  const seen = new Set<string>()
  rows.forEach((value, index) => {
    const id = object(value)?.id
    if (typeof id !== 'string') return
    if (seen.has(id)) {
      issue(
        issues,
        `${path}[${index}].id`,
        'duplicate-id',
        `Duplicate ID ${id}.`,
      )
    }
    seen.add(id)
  })
}

export function validateRecoverySchedule(
  value: unknown,
): ValidationResult<RecoverySchedule> {
  const issues: ValidationIssue[] = []
  const schedule = object(value)
  if (!schedule) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'type',
          message: 'Expected a recovery schedule object.',
        },
      ],
    }
  }

  if (schedule.version !== RECOVERY_CONTRACT_VERSION) {
    issue(
      issues,
      '$.version',
      'version',
      `Expected recovery contract version ${RECOVERY_CONTRACT_VERSION}.`,
    )
  }
  nonEmptyString(schedule.householdId, '$.householdId', issues)
  const scheduleTimeZone = isValidTimeZone(schedule.timeZone)
    ? schedule.timeZone
    : undefined
  if (!scheduleTimeZone) {
    issue(issues, '$.timeZone', 'time-zone', 'Invalid IANA time zone.')
  }
  const range = object(schedule.range)
  if (!range) {
    issue(issues, '$.range', 'type', 'Expected a date range.')
  } else {
    if (!isISODate(range.start)) {
      issue(issues, '$.range.start', 'format', 'Invalid start date.')
    }
    if (!isISODate(range.end)) {
      issue(issues, '$.range.end', 'format', 'Invalid end date.')
    }
    if (
      isISODate(range.start) &&
      isISODate(range.end) &&
      range.start > range.end
    ) {
      issue(issues, '$.range', 'range-order', 'Start must not follow end.')
    }
  }
  finiteInteger(schedule.revision, '$.revision', issues, 0)
  if (!isInstantString(schedule.updatedAt)) {
    issue(
      issues,
      '$.updatedAt',
      'instant',
      'Expected an offset-aware ISO instant.',
    )
  }

  const studentRows = Array.isArray(schedule.students)
    ? schedule.students
    : []
  if (!Array.isArray(schedule.students) || studentRows.length === 0) {
    issue(issues, '$.students', 'type', 'Expected at least one student.')
  }
  duplicateIds(studentRows, '$.students', issues)
  const studentIds = new Set<string>()
  studentRows.forEach((value, index) => {
    const path = `$.students[${index}]`
    const student = object(value)
    if (!student) {
      issue(issues, path, 'type', 'Expected a student object.')
      return
    }
    if (nonEmptyString(student.id, `${path}.id`, issues)) {
      studentIds.add(student.id)
    }
    nonEmptyString(student.displayName, `${path}.displayName`, issues)
    studentPolicy(
      student.policy,
      `${path}.policy`,
      issues,
      typeof student.id === 'string' ? student.id : undefined,
      scheduleTimeZone,
    )
  })

  const workRows = Array.isArray(schedule.workItems) ? schedule.workItems : []
  if (!Array.isArray(schedule.workItems)) {
    issue(issues, '$.workItems', 'type', 'Expected an array.')
  }
  duplicateIds(workRows, '$.workItems', issues)
  const workStudents = new Map<string, string>()
  workRows.forEach((value, index) => {
    const path = `$.workItems[${index}]`
    const work = object(value)
    if (!work) {
      issue(issues, path, 'type', 'Expected a work item.')
      return
    }
    if (
      nonEmptyString(work.id, `${path}.id`, issues) &&
      typeof work.studentId === 'string'
    ) {
      workStudents.set(work.id, work.studentId)
    }
    if (
      nonEmptyString(work.studentId, `${path}.studentId`, issues) &&
      !studentIds.has(work.studentId)
    ) {
      issue(
        issues,
        `${path}.studentId`,
        'reference',
        'Unknown student reference.',
      )
    }
    nonEmptyString(work.title, `${path}.title`, issues)
    enumValue(work.kind, ACTIVITY_KINDS, `${path}.kind`, issues)
    enumValue(
      work.loadCategory,
      LOAD_CATEGORIES,
      `${path}.loadCategory`,
      issues,
    )
    enumValue(
      work.requirement,
      REQUIREMENTS,
      `${path}.requirement`,
      issues,
    )
    priority(work.priority, `${path}.priority`, issues)
    if (work.deadline !== undefined) {
      const deadline = object(work.deadline)
      if (!deadline) {
        issue(issues, `${path}.deadline`, 'type', 'Expected a deadline model.')
      } else {
        localDateTime(deadline.due, `${path}.deadline.due`, issues)
        enumValue(
          deadline.kind,
          DEADLINE_KINDS,
          `${path}.deadline.kind`,
          issues,
        )
        if (typeof deadline.parentLocked !== 'boolean') {
          issue(
            issues,
            `${path}.deadline.parentLocked`,
            'type',
            'Expected a boolean.',
          )
        }
      }
    }
    duration(work.duration, `${path}.duration`, issues)
    finiteInteger(
      work.completedMinutes,
      `${path}.completedMinutes`,
      issues,
      0,
      10080,
    )
    enumValue(work.status, WORK_STATUSES, `${path}.status`, issues)
    for (const field of ['canSplit', 'canShorten'] as const) {
      if (typeof work[field] !== 'boolean') {
        issue(issues, `${path}.${field}`, 'type', 'Expected a boolean.')
      }
    }
    finiteInteger(
      work.minimumSessionMinutes,
      `${path}.minimumSessionMinutes`,
      issues,
      1,
      1440,
    )
    sourceReference(work.source, `${path}.source`, issues)
    if (!isInstantString(work.createdAt)) {
      issue(issues, `${path}.createdAt`, 'instant', 'Invalid instant.')
    }
    if (!isInstantString(work.updatedAt)) {
      issue(issues, `${path}.updatedAt`, 'instant', 'Invalid instant.')
    }
  })

  const eventRows = Array.isArray(schedule.events) ? schedule.events : []
  if (!Array.isArray(schedule.events)) {
    issue(issues, '$.events', 'type', 'Expected an array.')
  }
  duplicateIds(eventRows, '$.events', issues)
  eventRows.forEach((value, index) => {
    const path = `$.events[${index}]`
    const event = object(value)
    if (!event) {
      issue(issues, path, 'type', 'Expected a schedule event.')
      return
    }
    nonEmptyString(event.id, `${path}.id`, issues)
    if (
      nonEmptyString(event.studentId, `${path}.studentId`, issues) &&
      !studentIds.has(event.studentId)
    ) {
      issue(
        issues,
        `${path}.studentId`,
        'reference',
        'Unknown student reference.',
      )
    }
    if (event.workItemId !== undefined) {
      if (
        !nonEmptyString(event.workItemId, `${path}.workItemId`, issues) ||
        !workStudents.has(String(event.workItemId))
      ) {
        issue(
          issues,
          `${path}.workItemId`,
          'reference',
          'Unknown work item reference.',
        )
      } else if (
        workStudents.get(String(event.workItemId)) !== event.studentId
      ) {
        issue(
          issues,
          `${path}.workItemId`,
          'student-mismatch',
          'Event and work item must belong to the same student.',
        )
      }
    }
    nonEmptyString(event.title, `${path}.title`, issues)
    enumValue(event.kind, ACTIVITY_KINDS, `${path}.kind`, issues)
    enumValue(
      event.loadCategory,
      LOAD_CATEGORIES,
      `${path}.loadCategory`,
      issues,
    )
    localDateTime(event.start, `${path}.start`, issues)
    finiteInteger(
      event.durationMinutes,
      `${path}.durationMinutes`,
      issues,
      1,
      1440,
    )
    enumValue(event.mobility, new Set(['fixed', 'movable']), `${path}.mobility`, issues)
    if (typeof event.parentLocked !== 'boolean') {
      issue(issues, `${path}.parentLocked`, 'type', 'Expected a boolean.')
    }
    enumValue(
      event.protection,
      PROTECTIONS,
      `${path}.protection`,
      issues,
    )
    enumValue(event.status, EVENT_STATUSES, `${path}.status`, issues)
    if (event.segmentIndex !== undefined) {
      finiteInteger(
        event.segmentIndex,
        `${path}.segmentIndex`,
        issues,
        0,
        1000,
      )
    }
    sourceReference(event.source, `${path}.source`, issues)
    if (!isInstantString(event.createdAt)) {
      issue(issues, `${path}.createdAt`, 'instant', 'Invalid instant.')
    }
    if (!isInstantString(event.updatedAt)) {
      issue(issues, `${path}.updatedAt`, 'instant', 'Invalid instant.')
    }

    if (
      ['meal', 'sleep', 'protected-time'].includes(String(event.kind)) &&
      (event.mobility !== 'fixed' ||
        event.parentLocked !== true ||
        event.protection === 'none')
    ) {
      issue(
        issues,
        path,
        'protected-event',
        'Meals, sleep, and protected time must be fixed, parent locked, and protected.',
      )
    }
    if (event.kind === 'appointment' && event.mobility !== 'fixed') {
      issue(
        issues,
        `${path}.mobility`,
        'appointment-fixed',
        'Appointments must be fixed.',
      )
    }
  })

  const windowRows = Array.isArray(schedule.protectedWindows)
    ? schedule.protectedWindows
    : []
  if (!Array.isArray(schedule.protectedWindows)) {
    issue(issues, '$.protectedWindows', 'type', 'Expected an array.')
  }
  duplicateIds(windowRows, '$.protectedWindows', issues)
  windowRows.forEach((value, index) => {
    const path = `$.protectedWindows[${index}]`
    const window = object(value)
    if (!window) {
      issue(issues, path, 'type', 'Expected a protected window.')
      return
    }
    nonEmptyString(window.id, `${path}.id`, issues)
    if (
      window.studentId !== undefined &&
      (!nonEmptyString(window.studentId, `${path}.studentId`, issues) ||
        !studentIds.has(String(window.studentId)))
    ) {
      issue(
        issues,
        `${path}.studentId`,
        'reference',
        'Unknown student reference.',
      )
    }
    if (!isISODate(window.date)) {
      issue(issues, `${path}.date`, 'format', 'Invalid date.')
    }
    if (!isLocalTime(window.startTime)) {
      issue(issues, `${path}.startTime`, 'format', 'Invalid start time.')
    }
    if (!isWindowBoundaryTime(window.endTime)) {
      issue(issues, `${path}.endTime`, 'format', 'Invalid end time.')
    }
    if (
      isLocalTime(window.startTime) &&
      isWindowBoundaryTime(window.endTime) &&
      timeToMinutes(window.startTime) >= timeToMinutes(window.endTime)
    ) {
      issue(issues, path, 'window-order', 'Window start must precede end.')
    }
    enumValue(
      window.kind,
      new Set(['sleep', 'meal', 'parent-defined']),
      `${path}.kind`,
      issues,
    )
    nonEmptyString(window.title, `${path}.title`, issues)
    if (window.parentLocked !== true) {
      issue(
        issues,
        `${path}.parentLocked`,
        'locked',
        'Protected windows must be parent locked.',
      )
    }
  })

  const catchUpRows = Array.isArray(schedule.catchUpBlocks)
    ? schedule.catchUpBlocks
    : []
  if (!Array.isArray(schedule.catchUpBlocks)) {
    issue(issues, '$.catchUpBlocks', 'type', 'Expected an array.')
  }
  duplicateIds(catchUpRows, '$.catchUpBlocks', issues)
  catchUpRows.forEach((value, index) => {
    const path = `$.catchUpBlocks[${index}]`
    const block = object(value)
    if (!block) {
      issue(issues, path, 'type', 'Expected a catch-up block.')
      return
    }
    nonEmptyString(block.id, `${path}.id`, issues)
    if (
      nonEmptyString(block.studentId, `${path}.studentId`, issues) &&
      !studentIds.has(block.studentId)
    ) {
      issue(
        issues,
        `${path}.studentId`,
        'reference',
        'Unknown student reference.',
      )
    }
    if (!isISODate(block.date)) {
      issue(issues, `${path}.date`, 'format', 'Invalid date.')
    }
    if (!isLocalTime(block.startTime)) {
      issue(issues, `${path}.startTime`, 'format', 'Invalid start time.')
    }
    if (!isWindowBoundaryTime(block.endTime)) {
      issue(issues, `${path}.endTime`, 'format', 'Invalid end time.')
    }
    if (
      isLocalTime(block.startTime) &&
      isWindowBoundaryTime(block.endTime) &&
      timeToMinutes(block.startTime) >= timeToMinutes(block.endTime)
    ) {
      issue(issues, path, 'window-order', 'Block start must precede end.')
    }
    nonEmptyString(block.label, `${path}.label`, issues)
    if (typeof block.parentLocked !== 'boolean') {
      issue(issues, `${path}.parentLocked`, 'type', 'Expected a boolean.')
    }
  })

  return issues.length === 0
    ? { valid: true, value: value as RecoverySchedule, issues: [] }
    : { valid: false, issues }
}

export function validateRecoveryProposal(
  value: unknown,
): ValidationResult<RecoveryProposal> {
  const issues: ValidationIssue[] = []
  const proposal = object(value)
  if (!proposal) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'type',
          message: 'Expected a recovery proposal object.',
        },
      ],
    }
  }
  nonEmptyString(proposal.id, '$.id', issues)
  finiteInteger(proposal.scheduleRevision, '$.scheduleRevision', issues, 0)
  nonEmptyString(proposal.studentId, '$.studentId', issues)
  if (!isInstantString(proposal.createdAt)) {
    issue(issues, '$.createdAt', 'instant', 'Invalid instant.')
  }
  enumValue(
    proposal.status,
    new Set(['pending-parent', 'applied', 'rejected', 'superseded']),
    '$.status',
    issues,
  )
  nonEmptyString(proposal.recommendedOptionId, '$.recommendedOptionId', issues)
  nonEmptyString(proposal.summary, '$.summary', issues)
  if (!Array.isArray(proposal.options)) {
    issue(issues, '$.options', 'type', 'Expected an array of options.')
  } else {
    const found = new Set<RecoveryChoice>()
    proposal.options.forEach((value, index) => {
      const option = object(value)
      const path = `$.options[${index}]`
      if (!option) {
        issue(issues, path, 'type', 'Expected an option object.')
        return
      }
      nonEmptyString(option.id, `${path}.id`, issues)
      if (enumValue(option.choice, CHOICES, `${path}.choice`, issues)) {
        found.add(option.choice as RecoveryChoice)
      }
      nonEmptyString(option.label, `${path}.label`, issues)
      enumValue(
        option.availability,
        new Set(['available', 'requires-parent', 'unavailable']),
        `${path}.availability`,
        issues,
      )
      nonEmptyString(option.why, `${path}.why`, issues)
      nonEmptyString(
        option.studentExplanation,
        `${path}.studentExplanation`,
        issues,
      )
      if (!Array.isArray(option.changes)) {
        issue(issues, `${path}.changes`, 'type', 'Expected an array.')
      }
      if (!Array.isArray(option.conflicts)) {
        issue(issues, `${path}.conflicts`, 'type', 'Expected an array.')
      }
      if (!Array.isArray(option.dueDateRisks)) {
        issue(issues, `${path}.dueDateRisks`, 'type', 'Expected an array.')
      }
      if (!Array.isArray(option.workload)) {
        issue(issues, `${path}.workload`, 'type', 'Expected an array.')
      }
      if (typeof option.preservesInvariants !== 'boolean') {
        issue(
          issues,
          `${path}.preservesInvariants`,
          'type',
          'Expected a boolean.',
        )
      }
    })
    for (const choice of CHOICES) {
      if (!found.has(choice)) {
        issue(
          issues,
          '$.options',
          'missing-choice',
          `Missing required recovery choice: ${choice}.`,
        )
      }
    }
    if (proposal.options.length !== CHOICES.size) {
      issue(
        issues,
        '$.options',
        'choice-count',
        `Expected exactly ${CHOICES.size} recovery choices.`,
      )
    }
    if (
      typeof proposal.recommendedOptionId === 'string' &&
      !proposal.options.some(
        (optionValue) =>
          object(optionValue)?.id === proposal.recommendedOptionId,
      )
    ) {
      issue(
        issues,
        '$.recommendedOptionId',
        'reference',
        'Recommended option does not exist.',
      )
    }
  }
  return issues.length === 0
    ? { valid: true, value: value as RecoveryProposal, issues: [] }
    : { valid: false, issues }
}

const localDateTimeSchema: JsonObject = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'time'],
  properties: {
    date: { type: 'string', format: 'date' },
    time: {
      type: 'string',
      pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
    },
  },
}

/**
 * Portable JSON Schema for storage/API boundaries. Runtime validation above
 * additionally enforces references, ordering, time zones, and cross-field rules.
 */
export const RECOVERY_SCHEDULE_JSON_SCHEMA: JsonObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/schedule-recovery/v1/schedule.json',
  title: 'Manuel Academy Recovery Schedule',
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'householdId',
    'timeZone',
    'range',
    'students',
    'workItems',
    'events',
    'protectedWindows',
    'catchUpBlocks',
    'revision',
    'updatedAt',
  ],
  properties: {
    version: { const: RECOVERY_CONTRACT_VERSION },
    householdId: { type: 'string', minLength: 1 },
    timeZone: { type: 'string', minLength: 1 },
    range: {
      type: 'object',
      additionalProperties: false,
      required: ['start', 'end'],
      properties: {
        start: { type: 'string', format: 'date' },
        end: { type: 'string', format: 'date' },
      },
    },
    students: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/$defs/student' },
    },
    workItems: {
      type: 'array',
      items: { $ref: '#/$defs/workItem' },
    },
    events: {
      type: 'array',
      items: { $ref: '#/$defs/event' },
    },
    protectedWindows: {
      type: 'array',
      items: { $ref: '#/$defs/protectedWindow' },
    },
    catchUpBlocks: {
      type: 'array',
      items: { $ref: '#/$defs/catchUpBlock' },
    },
    revision: { type: 'integer', minimum: 0 },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  $defs: {
    localDateTime: localDateTimeSchema,
    source: {
      type: 'object',
      required: ['system', 'sourceId'],
      properties: {
        system: { type: 'string', enum: [...SOURCE_SYSTEMS] },
        sourceId: { type: 'string', minLength: 1 },
        adapterData: { type: 'object' },
      },
    },
    dailyLimit: {
      type: 'object',
      additionalProperties: false,
      required: [
        'maxScheduledMinutes',
        'maxAcademicMinutes',
        'maxPhysicalMinutes',
      ],
      properties: {
        maxScheduledMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
        maxAcademicMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
        maxPhysicalMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
      },
    },
    student: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'displayName', 'policy'],
      properties: {
        id: { type: 'string', minLength: 1 },
        displayName: { type: 'string', minLength: 1 },
        policy: { type: 'object' },
      },
    },
    workItem: {
      type: 'object',
      required: [
        'id',
        'studentId',
        'title',
        'kind',
        'loadCategory',
        'requirement',
        'priority',
        'duration',
        'completedMinutes',
        'status',
        'canSplit',
        'canShorten',
        'minimumSessionMinutes',
        'source',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        id: { type: 'string', minLength: 1 },
        studentId: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1 },
        kind: { type: 'string', enum: [...ACTIVITY_KINDS] },
        loadCategory: { type: 'string', enum: [...LOAD_CATEGORIES] },
        requirement: { type: 'string', enum: [...REQUIREMENTS] },
        priority: { type: 'object' },
        deadline: {
          type: 'object',
          required: ['due', 'kind', 'parentLocked'],
          properties: {
            due: { $ref: '#/$defs/localDateTime' },
            kind: { type: 'string', enum: [...DEADLINE_KINDS] },
            parentLocked: { type: 'boolean' },
          },
        },
        duration: { type: 'object' },
        completedMinutes: { type: 'integer', minimum: 0 },
        status: { type: 'string', enum: [...WORK_STATUSES] },
        canSplit: { type: 'boolean' },
        canShorten: { type: 'boolean' },
        minimumSessionMinutes: { type: 'integer', minimum: 1 },
        source: { $ref: '#/$defs/source' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    event: {
      type: 'object',
      required: [
        'id',
        'studentId',
        'title',
        'kind',
        'loadCategory',
        'start',
        'durationMinutes',
        'mobility',
        'parentLocked',
        'protection',
        'status',
        'source',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        id: { type: 'string', minLength: 1 },
        studentId: { type: 'string', minLength: 1 },
        workItemId: { type: 'string', minLength: 1 },
        title: { type: 'string', minLength: 1 },
        kind: { type: 'string', enum: [...ACTIVITY_KINDS] },
        loadCategory: { type: 'string', enum: [...LOAD_CATEGORIES] },
        start: { $ref: '#/$defs/localDateTime' },
        durationMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
        mobility: { type: 'string', enum: ['fixed', 'movable'] },
        parentLocked: { type: 'boolean' },
        protection: { type: 'string', enum: [...PROTECTIONS] },
        status: { type: 'string', enum: [...EVENT_STATUSES] },
        segmentIndex: { type: 'integer', minimum: 0 },
        location: { type: 'string' },
        source: { $ref: '#/$defs/source' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    protectedWindow: {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'date',
        'startTime',
        'endTime',
        'kind',
        'title',
        'parentLocked',
      ],
      properties: {
        id: { type: 'string', minLength: 1 },
        studentId: { type: 'string', minLength: 1 },
        date: { type: 'string', format: 'date' },
        startTime: {
          type: 'string',
          pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        endTime: {
          type: 'string',
          pattern: '^(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)$',
        },
        kind: {
          type: 'string',
          enum: ['sleep', 'meal', 'parent-defined'],
        },
        title: { type: 'string', minLength: 1 },
        parentLocked: { const: true },
      },
    },
    catchUpBlock: {
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'studentId',
        'date',
        'startTime',
        'endTime',
        'label',
        'parentLocked',
      ],
      properties: {
        id: { type: 'string', minLength: 1 },
        studentId: { type: 'string', minLength: 1 },
        date: { type: 'string', format: 'date' },
        startTime: {
          type: 'string',
          pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        endTime: {
          type: 'string',
          pattern: '^(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)$',
        },
        label: { type: 'string', minLength: 1 },
        parentLocked: { type: 'boolean' },
      },
    },
  },
}

export const RECOVERY_PROPOSAL_JSON_SCHEMA: JsonObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/schedule-recovery/v1/proposal.json',
  title: 'Manuel Academy Recovery Proposal',
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'scheduleRevision',
    'studentId',
    'trigger',
    'createdAt',
    'status',
    'recommendedOptionId',
    'options',
    'summary',
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    scheduleRevision: { type: 'integer', minimum: 0 },
    studentId: { type: 'string', minLength: 1 },
    trigger: { type: 'object' },
    affectedWorkItemId: { type: 'string', minLength: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    status: {
      type: 'string',
      enum: ['pending-parent', 'applied', 'rejected', 'superseded'],
    },
    recommendedOptionId: { type: 'string', minLength: 1 },
    options: {
      type: 'array',
      minItems: 8,
      maxItems: 8,
      items: {
        type: 'object',
        required: [
          'id',
          'choice',
          'label',
          'availability',
          'why',
          'tradeoff',
          'changes',
          'conflicts',
          'dueDateRisks',
          'workload',
          'preservesInvariants',
          'studentExplanation',
        ],
        properties: {
          id: { type: 'string', minLength: 1 },
          choice: { type: 'string', enum: [...CHOICES] },
          label: { type: 'string', minLength: 1 },
          availability: {
            type: 'string',
            enum: ['available', 'requires-parent', 'unavailable'],
          },
          why: { type: 'string', minLength: 1 },
          tradeoff: {
            type: 'object',
            required: ['gained', 'cost'],
            properties: {
              gained: { type: 'string', minLength: 1 },
              cost: { type: 'string', minLength: 1 },
            },
          },
          changes: { type: 'array' },
          conflicts: { type: 'array' },
          dueDateRisks: { type: 'array' },
          workload: { type: 'array' },
          preservesInvariants: { type: 'boolean' },
          studentExplanation: { type: 'string', minLength: 1 },
        },
      },
    },
    summary: { type: 'string', minLength: 1 },
  },
}
