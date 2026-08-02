import {
  RECOVERY_CONTRACT_VERSION,
  type ActivityKind,
  type LoadCategory,
  type PriorityBand,
  type ProtectedWindow,
  type RecoverySchedule,
  type RecoveryTrigger,
  type ScheduleEvent,
  type StudentWorkloadPolicy,
  type WorkItem,
  type WorkRequirement,
} from './types'
import { defaultLoadCategory } from './models'
import { datesBetween } from './time'

const CREATED_AT = '2026-11-01T16:00:00.000Z'

function policy(
  studentId: string,
  focusMinutes: number,
  academicDaily: number,
  academicWeekly: number,
): StudentWorkloadPolicy {
  return {
    studentId,
    timeZone: 'America/New_York',
    defaultDailyLimit: {
      maxScheduledMinutes: 600,
      maxAcademicMinutes: academicDaily,
      maxPhysicalMinutes: 180,
    },
    dailyLimitOverrides: {},
    maxAcademicMinutesPerWeek: academicWeekly,
    maxCarryoverMinutesPerDay: 75,
    preferredFocusBlockMinutes: focusMinutes,
    maxContinuousFocusMinutes: focusMinutes,
    minimumFocusBlockMinutes: 10,
    minimumBreakMinutes: 10,
    movementBreakAfterMinutes: focusMinutes,
    movementBreakMinutes: 10,
    focusRecoveryBreakMinutes: 15,
    earliestStartTime: '07:30',
    latestEndTime: '21:00',
    activeWeekdays: [1, 2, 3, 4, 5, 6],
  }
}

interface WorkSeed {
  id: string
  studentId: string
  title: string
  kind: ActivityKind
  requirement?: WorkRequirement
  band?: PriorityBand
  minutes: number
  dueDate?: string
  sourceSystem?: WorkItem['source']['system']
  status?: WorkItem['status']
}

function work(seed: WorkSeed): WorkItem {
  const requirement = seed.requirement ?? 'required'
  return {
    id: seed.id,
    studentId: seed.studentId,
    title: seed.title,
    kind: seed.kind,
    loadCategory: defaultLoadCategory(seed.kind),
    requirement,
    priority: {
      band: seed.band ?? (requirement === 'required' ? 'high' : 'normal'),
      baseScore: requirement === 'required' ? 75 : 45,
      factors:
        requirement === 'required'
          ? [
              {
                code: 'required',
                weight: 10,
                explanation: 'This is required student work.',
              },
            ]
          : [
              {
                code: 'review',
                weight: 0,
                explanation: 'This is replaceable review work.',
              },
            ],
    },
    ...(seed.dueDate
      ? {
          deadline: {
            due: { date: seed.dueDate, time: '17:00' },
            kind: 'hard' as const,
            parentLocked: true,
          },
        }
      : {}),
    duration: {
      expectedMinutes: seed.minutes,
      minimumMinutes: Math.min(10, seed.minutes),
      maximumMinutes: Math.max(seed.minutes, Math.ceil(seed.minutes * 1.5)),
      confidence: 'medium',
      basis: 'parent-estimate',
    },
    completedMinutes: 0,
    status: seed.status ?? 'active',
    canSplit: true,
    canShorten: true,
    minimumSessionMinutes: Math.min(10, seed.minutes),
    source: {
      system: seed.sourceSystem ?? 'parent',
      sourceId: seed.id,
    },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }
}

interface EventSeed {
  id: string
  studentId: string
  title: string
  kind: ActivityKind
  date: string
  time: string
  minutes: number
  workItemId?: string
  status?: ScheduleEvent['status']
  mobility?: ScheduleEvent['mobility']
  parentLocked?: boolean
  protection?: ScheduleEvent['protection']
  loadCategory?: LoadCategory
}

function event(seed: EventSeed): ScheduleEvent {
  const protectedEvent = ['meal', 'sleep', 'protected-time'].includes(seed.kind)
  return {
    id: seed.id,
    studentId: seed.studentId,
    ...(seed.workItemId ? { workItemId: seed.workItemId } : {}),
    title: seed.title,
    kind: seed.kind,
    loadCategory: seed.loadCategory ?? defaultLoadCategory(seed.kind),
    start: { date: seed.date, time: seed.time },
    durationMinutes: seed.minutes,
    mobility:
      seed.mobility ??
      (protectedEvent || seed.kind === 'appointment' ? 'fixed' : 'movable'),
    parentLocked: seed.parentLocked ?? protectedEvent,
    protection:
      seed.protection ??
      (seed.kind === 'meal'
        ? 'meal'
        : seed.kind === 'sleep'
          ? 'sleep'
          : seed.kind === 'protected-time'
            ? 'parent-defined'
            : 'none'),
    status: seed.status ?? 'scheduled',
    source: {
      system: 'parent',
      sourceId: seed.id,
    },
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }
}

const sampleWorkItems: WorkItem[] = [
  work({
    id: 'maya-algebra',
    studentId: 'maya',
    title: 'Algebra problem set',
    kind: 'academic-assignment',
    minutes: 60,
    dueDate: '2026-11-04',
  }),
  work({
    id: 'maya-manuel',
    studentId: 'maya',
    title: 'Manuel Academy science lesson',
    kind: 'manuel-academy-lesson',
    minutes: 40,
    dueDate: '2026-11-06',
    sourceSystem: 'manuel-academy',
  }),
  work({
    id: 'maya-ready-life',
    studentId: 'maya',
    title: 'Ready for Life budgeting',
    kind: 'ready-for-life-activity',
    minutes: 35,
    sourceSystem: 'ready-for-life',
  }),
  work({
    id: 'maya-review',
    studentId: 'maya',
    title: 'Vocabulary review',
    kind: 'academic-assignment',
    requirement: 'review',
    band: 'low',
    minutes: 30,
  }),
  work({
    id: 'eli-romeo',
    studentId: 'eli',
    title: 'Romeo Virtual Academy English',
    kind: 'romeo-virtual-academy-assignment',
    minutes: 45,
    dueDate: '2026-11-05',
    sourceSystem: 'romeo-virtual-academy',
  }),
  work({
    id: 'eli-tutor',
    studentId: 'eli',
    title: 'Adaptive tutor practice',
    kind: 'adaptive-tutor-intervention',
    minutes: 30,
    sourceSystem: 'adaptive-tutor',
  }),
  work({
    id: 'eli-history',
    studentId: 'eli',
    title: 'History response',
    kind: 'academic-assignment',
    minutes: 30,
    dueDate: '2026-11-02',
  }),
]

const sampleEvents: ScheduleEvent[] = [
  event({
    id: 'maya-breakfast',
    studentId: 'maya',
    title: 'Breakfast',
    kind: 'meal',
    date: '2026-11-02',
    time: '08:00',
    minutes: 30,
  }),
  event({
    id: 'maya-algebra-event',
    studentId: 'maya',
    title: 'Algebra problem set',
    kind: 'academic-assignment',
    date: '2026-11-02',
    time: '09:00',
    minutes: 60,
    workItemId: 'maya-algebra',
    status: 'missed',
  }),
  event({
    id: 'maya-movement',
    studentId: 'maya',
    title: 'Movement break',
    kind: 'movement-break',
    date: '2026-11-02',
    time: '10:10',
    minutes: 10,
  }),
  event({
    id: 'maya-manuel-event',
    studentId: 'maya',
    title: 'Manuel Academy science lesson',
    kind: 'manuel-academy-lesson',
    date: '2026-11-02',
    time: '10:30',
    minutes: 40,
    workItemId: 'maya-manuel',
    status: 'interrupted',
  }),
  event({
    id: 'maya-lunch',
    studentId: 'maya',
    title: 'Lunch',
    kind: 'meal',
    date: '2026-11-02',
    time: '12:00',
    minutes: 45,
  }),
  event({
    id: 'maya-ready-event',
    studentId: 'maya',
    title: 'Ready for Life budgeting',
    kind: 'ready-for-life-activity',
    date: '2026-11-02',
    time: '13:00',
    minutes: 35,
    workItemId: 'maya-ready-life',
  }),
  event({
    id: 'maya-wrestling',
    studentId: 'maya',
    title: 'Wrestling',
    kind: 'wrestling',
    date: '2026-11-02',
    time: '16:00',
    minutes: 90,
    mobility: 'fixed',
  }),
  event({
    id: 'maya-review-event',
    studentId: 'maya',
    title: 'Vocabulary review',
    kind: 'academic-assignment',
    date: '2026-11-03',
    time: '10:00',
    minutes: 30,
    workItemId: 'maya-review',
  }),
  event({
    id: 'maya-weight',
    studentId: 'maya',
    title: 'Weight training',
    kind: 'weight-training',
    date: '2026-11-03',
    time: '15:00',
    minutes: 45,
    mobility: 'fixed',
  }),
  event({
    id: 'maya-focus-break',
    studentId: 'maya',
    title: 'Focus recovery break',
    kind: 'focus-recovery-break',
    date: '2026-11-03',
    time: '10:30',
    minutes: 15,
  }),
  event({
    id: 'eli-breakfast',
    studentId: 'eli',
    title: 'Breakfast',
    kind: 'meal',
    date: '2026-11-02',
    time: '08:15',
    minutes: 30,
  }),
  event({
    id: 'eli-romeo-event',
    studentId: 'eli',
    title: 'Romeo Virtual Academy English',
    kind: 'romeo-virtual-academy-assignment',
    date: '2026-11-02',
    time: '09:00',
    minutes: 45,
    workItemId: 'eli-romeo',
    status: 'shortened',
  }),
  event({
    id: 'eli-tutor-event',
    studentId: 'eli',
    title: 'Adaptive tutor practice',
    kind: 'adaptive-tutor-intervention',
    date: '2026-11-02',
    time: '10:00',
    minutes: 30,
    workItemId: 'eli-tutor',
  }),
  event({
    id: 'eli-lunch',
    studentId: 'eli',
    title: 'Lunch',
    kind: 'meal',
    date: '2026-11-02',
    time: '12:00',
    minutes: 45,
  }),
  event({
    id: 'eli-jiu-jitsu',
    studentId: 'eli',
    title: 'Jiu-jitsu',
    kind: 'jiu-jitsu',
    date: '2026-11-02',
    time: '16:30',
    minutes: 60,
    mobility: 'fixed',
  }),
  event({
    id: 'eli-history-event',
    studentId: 'eli',
    title: 'History response',
    kind: 'academic-assignment',
    date: '2026-11-03',
    time: '09:00',
    minutes: 30,
    workItemId: 'eli-history',
    status: 'overdue',
  }),
  event({
    id: 'eli-pe',
    studentId: 'eli',
    title: 'Neighborhood bike ride',
    kind: 'pe-activity',
    date: '2026-11-03',
    time: '14:00',
    minutes: 45,
  }),
  event({
    id: 'eli-appointment',
    studentId: 'eli',
    title: 'Family appointment',
    kind: 'appointment',
    date: '2026-11-04',
    time: '11:00',
    minutes: 60,
    mobility: 'fixed',
    parentLocked: true,
  }),
  event({
    id: 'eli-parent-created',
    studentId: 'eli',
    title: 'Library visit',
    kind: 'parent-created-activity',
    date: '2026-11-04',
    time: '14:00',
    minutes: 60,
  }),
]

function protectedWindows(): ProtectedWindow[] {
  return datesBetween('2026-11-02', '2026-11-08').flatMap((date) => [
    {
      id: `sleep-am-${date}`,
      date,
      startTime: '00:00',
      endTime: '07:30',
      kind: 'sleep',
      title: 'Household sleep',
      parentLocked: true,
    },
    {
      id: `sleep-pm-${date}`,
      date,
      startTime: '21:00',
      endTime: '24:00',
      kind: 'sleep',
      title: 'Household sleep',
      parentLocked: true,
    },
  ])
}

export const SAMPLE_MULTI_STUDENT_SCHEDULE: RecoverySchedule = {
  version: RECOVERY_CONTRACT_VERSION,
  householdId: 'sample-household',
  timeZone: 'America/New_York',
  range: { start: '2026-11-02', end: '2026-11-08' },
  students: [
    {
      id: 'maya',
      displayName: 'Maya',
      policy: policy('maya', 45, 210, 900),
    },
    {
      id: 'eli',
      displayName: 'Eli',
      policy: policy('eli', 30, 180, 750),
    },
  ],
  workItems: sampleWorkItems,
  events: sampleEvents,
  protectedWindows: protectedWindows(),
  catchUpBlocks: [
    {
      id: 'maya-catch-up-wed',
      studentId: 'maya',
      date: '2026-11-04',
      startTime: '13:00',
      endTime: '14:30',
      label: 'Maya catch-up',
      parentLocked: true,
    },
    {
      id: 'eli-catch-up-thu',
      studentId: 'eli',
      date: '2026-11-05',
      startTime: '13:00',
      endTime: '14:00',
      label: 'Eli catch-up',
      parentLocked: true,
    },
  ],
  revision: 3,
  updatedAt: CREATED_AT,
}

export const SAMPLE_RECOVERY_TRIGGERS: RecoveryTrigger[] = [
  {
    kind: 'missed',
    eventId: 'maya-algebra-event',
    observedAt: '2026-11-02T15:30:00.000Z',
    remainingMinutes: 60,
    reason: 'The planned block did not start.',
  },
  {
    kind: 'interrupted',
    eventId: 'maya-manuel-event',
    observedAt: '2026-11-02T16:00:00.000Z',
    actualMinutes: 15,
    reason: 'The session ended early.',
  },
  {
    kind: 'shortened',
    eventId: 'eli-romeo-event',
    observedAt: '2026-11-02T16:00:00.000Z',
    actualMinutes: 20,
  },
  {
    kind: 'overdue',
    eventId: 'eli-history-event',
    observedAt: '2026-11-03T15:00:00.000Z',
    remainingMinutes: 30,
  },
  {
    kind: 'focus-difficulty',
    eventId: 'maya-algebra-event',
    observedAt: '2026-11-02T15:20:00.000Z',
    remainingMinutes: 45,
    reason: 'The student asked for a smaller block and a reset.',
  },
]
