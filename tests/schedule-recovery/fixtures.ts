import { defaultLoadCategory } from '../../scheduling/recovery/models'
import {
  RECOVERY_CONTRACT_VERSION,
  type ActivityKind,
  type CatchUpBlock,
  type DailyWorkloadLimit,
  type ProtectedWindow,
  type RecoverySchedule,
  type RecoveryStudent,
  type ScheduleEvent,
  type StudentWorkloadPolicy,
  type WorkItem,
} from '../../scheduling/recovery/types'

export const NOW = '2026-07-28T16:00:00Z'
export const HOUSEHOLD_TIME_ZONE = 'America/New_York'

export const ALL_ACTIVITY_KINDS: readonly ActivityKind[] = [
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
]

export const DEFAULT_DAILY_LIMIT: DailyWorkloadLimit = {
  maxScheduledMinutes: 600,
  maxAcademicMinutes: 240,
  maxPhysicalMinutes: 180,
}

export function makePolicy(
  studentId: string,
  overrides: Partial<StudentWorkloadPolicy> = {},
): StudentWorkloadPolicy {
  return {
    studentId,
    timeZone: HOUSEHOLD_TIME_ZONE,
    defaultDailyLimit: { ...DEFAULT_DAILY_LIMIT },
    dailyLimitOverrides: {},
    maxAcademicMinutesPerWeek: 900,
    maxCarryoverMinutesPerDay: 90,
    preferredFocusBlockMinutes: 30,
    maxContinuousFocusMinutes: 45,
    minimumFocusBlockMinutes: 15,
    minimumBreakMinutes: 10,
    movementBreakAfterMinutes: 45,
    movementBreakMinutes: 10,
    focusRecoveryBreakMinutes: 15,
    earliestStartTime: '07:00',
    latestEndTime: '21:00',
    activeWeekdays: [1, 2, 3, 4, 5, 6],
    ...overrides,
  }
}

export function makeStudent(
  id: string,
  displayName: string,
  policyOverrides: Partial<StudentWorkloadPolicy> = {},
): RecoveryStudent {
  return {
    id,
    displayName,
    policy: makePolicy(id, policyOverrides),
  }
}

export const ADA = makeStudent('student-ada', 'Ada')
export const GRACE = makeStudent('student-grace', 'Grace', {
  preferredFocusBlockMinutes: 20,
  maxContinuousFocusMinutes: 30,
  minimumFocusBlockMinutes: 10,
  maxAcademicMinutesPerWeek: 720,
  defaultDailyLimit: {
    maxScheduledMinutes: 480,
    maxAcademicMinutes: 180,
    maxPhysicalMinutes: 150,
  },
})

export function makeWorkItem(
  overrides: Partial<WorkItem> = {},
): WorkItem {
  const kind = overrides.kind ?? 'academic-assignment'
  const id = overrides.id ?? 'work-main'
  return {
    id,
    studentId: overrides.studentId ?? ADA.id,
    title: overrides.title ?? 'Algebra practice',
    kind,
    loadCategory: overrides.loadCategory ?? defaultLoadCategory(kind),
    requirement: overrides.requirement ?? 'required',
    priority: overrides.priority ?? {
      band: 'high',
      baseScore: 72,
      factors: [
        {
          code: 'required',
          weight: 8,
          explanation: 'Required course work',
        },
      ],
    },
    deadline: overrides.deadline ?? {
      due: { date: '2026-07-31', time: '17:00' },
      kind: 'hard',
      parentLocked: true,
    },
    duration: overrides.duration ?? {
      expectedMinutes: 60,
      minimumMinutes: 30,
      maximumMinutes: 90,
      confidence: 'medium',
      basis: 'teacher-estimate',
    },
    completedMinutes: overrides.completedMinutes ?? 0,
    status: overrides.status ?? 'active',
    canSplit: overrides.canSplit ?? true,
    canShorten: overrides.canShorten ?? true,
    minimumSessionMinutes: overrides.minimumSessionMinutes ?? 15,
    source: overrides.source ?? {
      system: 'external',
      sourceId: id,
    },
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  }
}

function protectedAttributes(kind: ActivityKind): Pick<
  ScheduleEvent,
  'mobility' | 'parentLocked' | 'protection'
> | undefined {
  if (kind === 'meal') {
    return { mobility: 'fixed', parentLocked: true, protection: 'meal' }
  }
  if (kind === 'sleep') {
    return { mobility: 'fixed', parentLocked: true, protection: 'sleep' }
  }
  if (kind === 'protected-time') {
    return {
      mobility: 'fixed',
      parentLocked: true,
      protection: 'parent-defined',
    }
  }
  if (kind === 'appointment') {
    return { mobility: 'fixed', parentLocked: false, protection: 'none' }
  }
  return undefined
}

export function makeEvent(
  overrides: Partial<ScheduleEvent> = {},
): ScheduleEvent {
  const kind = overrides.kind ?? 'academic-assignment'
  const id = overrides.id ?? 'event-main'
  const requiredProtection = protectedAttributes(kind)
  return {
    id,
    studentId: overrides.studentId ?? ADA.id,
    workItemId: overrides.workItemId,
    title: overrides.title ?? 'Algebra practice',
    kind,
    loadCategory: overrides.loadCategory ?? defaultLoadCategory(kind),
    start: overrides.start ?? { date: '2026-07-28', time: '09:00' },
    durationMinutes: overrides.durationMinutes ?? 60,
    mobility:
      overrides.mobility ?? requiredProtection?.mobility ?? 'movable',
    parentLocked:
      overrides.parentLocked ?? requiredProtection?.parentLocked ?? false,
    protection:
      overrides.protection ?? requiredProtection?.protection ?? 'none',
    status: overrides.status ?? 'scheduled',
    segmentIndex: overrides.segmentIndex,
    location: overrides.location,
    source: overrides.source ?? {
      system: 'external',
      sourceId: id,
    },
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  }
}

export function makeProtectedWindow(
  overrides: Partial<ProtectedWindow> = {},
): ProtectedWindow {
  return {
    id: overrides.id ?? 'protected-lunch',
    studentId: overrides.studentId,
    date: overrides.date ?? '2026-07-28',
    startTime: overrides.startTime ?? '12:00',
    endTime: overrides.endTime ?? '13:00',
    kind: overrides.kind ?? 'meal',
    title: overrides.title ?? 'Lunch',
    parentLocked: true,
  }
}

export function makeCatchUpBlock(
  overrides: Partial<CatchUpBlock> = {},
): CatchUpBlock {
  return {
    id: overrides.id ?? 'catch-up-wed',
    studentId: overrides.studentId ?? ADA.id,
    date: overrides.date ?? '2026-07-29',
    startTime: overrides.startTime ?? '14:00',
    endTime: overrides.endTime ?? '15:30',
    label: overrides.label ?? 'Catch-up block',
    parentLocked: overrides.parentLocked ?? true,
  }
}

export interface ScheduleOverrides {
  students?: RecoveryStudent[]
  workItems?: WorkItem[]
  events?: ScheduleEvent[]
  protectedWindows?: ProtectedWindow[]
  catchUpBlocks?: CatchUpBlock[]
  revision?: number
  updatedAt?: string
  timeZone?: string
  range?: RecoverySchedule['range']
}

export function makeSchedule(
  overrides: ScheduleOverrides = {},
): RecoverySchedule {
  return {
    version: RECOVERY_CONTRACT_VERSION,
    householdId: 'household-manuel',
    timeZone: overrides.timeZone ?? HOUSEHOLD_TIME_ZONE,
    range: overrides.range ?? {
      start: '2026-07-27',
      end: '2026-08-09',
    },
    students: overrides.students ?? [ADA, GRACE],
    workItems: overrides.workItems ?? [],
    events: overrides.events ?? [],
    protectedWindows: overrides.protectedWindows ?? [],
    catchUpBlocks: overrides.catchUpBlocks ?? [],
    revision: overrides.revision ?? 7,
    updatedAt: overrides.updatedAt ?? NOW,
  }
}

export function eventChange(
  before: ScheduleEvent,
  after: ScheduleEvent | null,
  reasonCode:
    | 'recovered-missed-work'
    | 'support-focus-stamina'
    | 'parent-override'
    | 'undo' = 'recovered-missed-work',
) {
  return {
    kind: 'event' as const,
    eventId: before.id,
    before,
    after,
    reasonCode,
  }
}

export function makeRecoveryScenario() {
  const work = makeWorkItem({
    id: 'work-recovery',
    title: 'Geometry lesson',
    kind: 'manuel-academy-lesson',
    source: { system: 'manuel-academy', sourceId: 'geometry-week-5' },
  })
  const missedEvent = makeEvent({
    id: 'event-recovery',
    title: work.title,
    kind: work.kind,
    loadCategory: work.loadCategory,
    workItemId: work.id,
    status: 'missed',
    start: { date: '2026-07-28', time: '09:00' },
    durationMinutes: 60,
    source: work.source,
  })
  const reviewWork = makeWorkItem({
    id: 'work-review',
    title: 'Vocabulary review',
    requirement: 'review',
    priority: {
      band: 'low',
      baseScore: 10,
      factors: [
        {
          code: 'review',
          weight: 1,
          explanation: 'Helpful review that may be deferred',
        },
      ],
    },
    deadline: undefined,
    duration: {
      expectedMinutes: 60,
      minimumMinutes: 15,
      maximumMinutes: 75,
      confidence: 'medium',
      basis: 'student-history',
    },
  })
  const reviewEvent = makeEvent({
    id: 'event-review',
    title: reviewWork.title,
    workItemId: reviewWork.id,
    kind: reviewWork.kind,
    loadCategory: reviewWork.loadCategory,
    start: { date: '2026-07-29', time: '15:00' },
    durationMinutes: 60,
    source: reviewWork.source,
  })
  const graceEvent = makeEvent({
    id: 'event-grace-reading',
    studentId: GRACE.id,
    title: 'Grace reading',
    kind: 'academic-assignment',
    start: { date: '2026-07-29', time: '10:00' },
    durationMinutes: 25,
  })
  const todayBackground = makeEvent({
    id: 'event-today-background',
    title: 'Independent reading',
    kind: 'academic-assignment',
    start: { date: '2026-07-28', time: '10:50' },
    durationMinutes: 60,
  })
  const schedule = makeSchedule({
    students: [
      makeStudent(ADA.id, ADA.displayName, {
        maxContinuousFocusMinutes: 60,
      }),
      GRACE,
    ],
    workItems: [work, reviewWork],
    events: [missedEvent, reviewEvent, graceEvent, todayBackground],
    protectedWindows: [
      makeProtectedWindow({
        id: 'protected-lunch-wed',
        date: '2026-07-29',
      }),
    ],
    catchUpBlocks: [
      makeCatchUpBlock({
        id: 'catch-up-thu',
        date: '2026-07-30',
        startTime: '14:00',
        endTime: '15:30',
      }),
    ],
  })
  return {
    schedule,
    work,
    missedEvent,
    reviewWork,
    reviewEvent,
    graceEvent,
    todayBackground,
  }
}
