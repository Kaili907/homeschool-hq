import {
  type ActivityKind,
  type LoadCategory,
  type RecoverySchedule,
  type RecoveryStudent,
  type ScheduleEvent,
  type SharedPlannerDailyBlockLike,
  type SourceReference,
  type WorkItem,
  type WorkRequirement,
} from './types'
import { defaultLoadCategory } from './models'

export interface SharedPlannerAdaptInput {
  householdId: string
  timeZone: string
  range: RecoverySchedule['range']
  students: RecoveryStudent[]
  dailyBlocks: SharedPlannerDailyBlockLike[]
  protectedWindows?: RecoverySchedule['protectedWindows']
  catchUpBlocks?: RecoverySchedule['catchUpBlocks']
  revision: number
  adaptedAt: string
}

function activityKindForPlanner(
  category: string,
  sourceKind: string,
): ActivityKind {
  if (sourceKind === 'romeo-online' || category === 'romeo-online') {
    return 'romeo-virtual-academy-assignment'
  }
  if (sourceKind === 'curriculum' || category === 'manuel-academy') {
    return 'manuel-academy-lesson'
  }
  switch (category) {
    case 'wrestling':
      return 'wrestling'
    case 'jiu-jitsu':
      return 'jiu-jitsu'
    case 'weight-training':
      return 'weight-training'
    case 'other-pe':
      return 'pe-activity'
    case 'appointment':
      return 'appointment'
    case 'meal':
      return 'meal'
    case 'break':
      return 'movement-break'
    case 'family-responsibility':
      return 'ready-for-life-activity'
    case 'existing-mission':
    case 'reading':
      return 'academic-assignment'
    default:
      return 'parent-created-activity'
  }
}

function requirementForPlanner(
  category: string,
  sourceKind: string,
): WorkRequirement {
  if (
    sourceKind === 'curriculum' ||
    sourceKind === 'romeo-online' ||
    sourceKind === 'mission' ||
    category === 'manuel-academy'
  ) {
    return 'required'
  }
  return category === 'reading' ? 'review' : 'optional'
}

function sourceForPlanner(
  block: SharedPlannerDailyBlockLike,
): SourceReference {
  return {
    system: 'shared-planner',
    sourceId: block.instanceId,
    adapterData: {
      plannerBlockId: block.block.id,
      plannerInstanceId: block.instanceId,
      plannerSourceKind: block.block.source.kind,
    },
  }
}

function statusForPlanner(
  status: string,
): ScheduleEvent['status'] {
  switch (status) {
    case 'in-progress':
      return 'in-progress'
    case 'completed':
    case 'excused':
      return 'completed'
    case 'skipped':
      return 'missed'
    case 'moved':
      return 'deferred'
    default:
      return 'scheduled'
  }
}

function workItemForPlanner(
  row: SharedPlannerDailyBlockLike,
  kind: ActivityKind,
  loadCategory: LoadCategory,
  source: SourceReference,
  adaptedAt: string,
): WorkItem | undefined {
  if (
    ['appointment', 'meal', 'movement-break', 'focus-recovery-break', 'sleep', 'protected-time'].includes(
      kind,
    )
  ) {
    return undefined
  }
  const requirement = requirementForPlanner(
    row.block.category,
    row.block.source.kind,
  )
  return {
    id: `planner-work:${row.instanceId}`,
    studentId: row.profileId,
    title: row.block.title,
    kind,
    loadCategory,
    requirement,
    priority: {
      band: requirement === 'required' ? 'high' : 'normal',
      baseScore: requirement === 'required' ? 75 : 50,
      factors:
        requirement === 'required'
          ? [
              {
                code: 'required',
                weight: 10,
                explanation: 'Imported as required planner work.',
              },
            ]
          : [],
    },
    duration: {
      expectedMinutes: row.block.expectedMinutes,
      minimumMinutes: Math.min(10, row.block.expectedMinutes),
      maximumMinutes: Math.max(
        row.block.expectedMinutes,
        Math.ceil(row.block.expectedMinutes * 1.5),
      ),
      confidence: 'medium',
      basis: 'source-provided',
    },
    completedMinutes:
      row.progress.status === 'completed'
        ? row.block.expectedMinutes
        : Math.min(
            row.block.expectedMinutes,
            Math.floor((row.progress.activeElapsedSeconds ?? 0) / 60),
          ),
    status: row.progress.status === 'completed' ? 'completed' : 'active',
    canSplit: row.block.scheduleBehavior === 'flexible',
    canShorten: row.block.scheduleBehavior === 'flexible',
    minimumSessionMinutes: Math.min(10, row.block.expectedMinutes),
    source,
    createdAt: row.block.createdAt,
    updatedAt: adaptedAt,
  }
}

/**
 * Read-only bridge from Session 1 planner projections into the recovery model.
 * Completion remains planner/mission-owned; callers must adapt approved changes
 * back through planner date overrides rather than persist this projection as a
 * second completion authority.
 */
export function adaptSharedPlannerDailyBlocks(
  input: SharedPlannerAdaptInput,
): RecoverySchedule {
  const workItems: WorkItem[] = []
  const events: ScheduleEvent[] = []
  for (const row of input.dailyBlocks) {
    const kind = activityKindForPlanner(
      row.block.category,
      row.block.source.kind,
    )
    const loadCategory = defaultLoadCategory(kind)
    const source = sourceForPlanner(row)
    const workItem = workItemForPlanner(
      row,
      kind,
      loadCategory,
      source,
      input.adaptedAt,
    )
    if (workItem) workItems.push(workItem)
    const protectedKind =
      kind === 'meal'
        ? 'meal'
        : kind === 'sleep'
          ? 'sleep'
          : kind === 'protected-time'
            ? 'parent-defined'
            : 'none'
    const inherentlyFixed =
      kind === 'appointment' ||
      kind === 'meal' ||
      kind === 'sleep' ||
      kind === 'protected-time'
    events.push({
      id: `planner-event:${row.instanceId}`,
      studentId: row.profileId,
      ...(workItem ? { workItemId: workItem.id } : {}),
      title: row.block.title,
      kind,
      loadCategory,
      start: { date: row.date, time: row.block.startTime },
      durationMinutes: row.block.expectedMinutes,
      mobility:
        inherentlyFixed || row.block.scheduleBehavior === 'fixed'
          ? 'fixed'
          : 'movable',
      parentLocked:
        kind === 'meal' || kind === 'sleep' || kind === 'protected-time',
      protection: protectedKind,
      status: statusForPlanner(row.progress.status),
      source,
      createdAt: row.block.createdAt,
      updatedAt: input.adaptedAt,
    })
  }
  return {
    version: 1,
    householdId: input.householdId,
    timeZone: input.timeZone,
    range: input.range,
    students: input.students,
    workItems,
    events,
    protectedWindows: input.protectedWindows ?? [],
    catchUpBlocks: input.catchUpBlocks ?? [],
    revision: input.revision,
    updatedAt: input.adaptedAt,
  }
}

export interface SharedPlannerRecoveryCommand {
  kind: 'change-date-override' | 'add-date-override'
  profileId: string
  date: string
  targetPlannerBlockId?: string
  recoveryEventId: string
  changes: {
    startTime: string
    expectedMinutes: number
    scheduleBehavior: 'flexible' | 'fixed'
  }
}

/**
 * Produces integration commands, not planner mutations. The host must reselect
 * current planner rows and authorize an equivalent PlannerDateOverride.
 */
export function recoveryEventsToPlannerCommands(
  before: RecoverySchedule,
  after: RecoverySchedule,
): SharedPlannerRecoveryCommand[] {
  const beforeById = new Map(before.events.map((event) => [event.id, event]))
  return after.events.flatMap((event) => {
    const plannerBlockId = event.source.adapterData?.plannerBlockId
    const prior = beforeById.get(event.id)
    if (
      prior &&
      prior.start.date === event.start.date &&
      prior.start.time === event.start.time &&
      prior.durationMinutes === event.durationMinutes
    ) {
      return []
    }
    return [
      {
        kind: prior ? 'change-date-override' : 'add-date-override',
        profileId: event.studentId,
        date: event.start.date,
        ...(typeof plannerBlockId === 'string'
          ? { targetPlannerBlockId: plannerBlockId }
          : {}),
        recoveryEventId: event.id,
        changes: {
          startTime: event.start.time,
          expectedMinutes: event.durationMinutes,
          scheduleBehavior: event.mobility === 'fixed' ? 'fixed' : 'flexible',
        },
      } satisfies SharedPlannerRecoveryCommand,
    ]
  })
}
