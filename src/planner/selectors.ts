import type { AppState, SchoolYear } from '../types'
import { defaultSchoolYear } from '../curriculum/pacing'
import type { PlanDoc } from '../curriculum/parser'
import { readPlannerState } from './defaults'
import { curriculumPlanForDay } from './adapters/curriculumAdapter'
import { missionBlocksForDay, missionDayForPlanner } from './adapters/missionAdapter'
import { deriveDailyPlan } from './engine'
import { resolvePlannerNavigation } from './resume'
import type {
  DailyPlan,
  DailyPlanBlock,
  DailyPlanSummary,
  PlannerBlock,
  PlannerActivitySource,
  PlannerNavigationResolution,
  PlannerOccurrenceSnapshot,
  PlannerPlacement,
  PlannerProgress,
  StudentDailyPlan,
  StudentDailyPlanBlock,
  StudentPlannerBlock,
  StudentPlannerProgress,
} from './types'

export interface SelectDailyPlanOptions {
  state: AppState
  profileId: string
  date: string
  /** Family-local date, injected independently from the UTC action clock. */
  currentLocalDate: string
  docs: PlanDoc[]
  now: string
  schoolYear?: SchoolYear
}

const EMPTY_SUMMARY: DailyPlanSummary = {
  plannedMinutes: 0,
  plannedMinutesRemaining: 0,
  activeMinutes: 0,
  completedCount: 0,
  remainingCount: 0,
  eligibleCount: 0,
  completionPercentage: 100,
}

function emptyPlan(
  profileId: string,
  date: string,
  compatibility: DailyPlan['compatibility'],
): DailyPlan {
  const updateRequired = compatibility.kind === 'unsupported-newer'
  return {
    profileId,
    date,
    blocks: [],
    notices: updateRequired
      ? [
          {
            id: `planner-update-required:${profileId}:${date}`,
            profileId,
            date,
            reason: 'planner-update-required',
            title: 'Planner update required',
            message: `This plan uses planner data version ${compatibility.version}. Update the app before viewing or changing it.`,
          },
        ]
      : [],
    compatibility,
    summary: { ...EMPTY_SUMMARY },
  }
}

export function selectDailyPlan(options: SelectDailyPlanOptions): DailyPlan {
  const plannerRead = readPlannerState(options.state.planner)
  if (plannerRead.kind === 'unsupported-newer') {
    return emptyPlan(options.profileId, options.date, {
      kind: 'unsupported-newer',
      version: plannerRead.version,
    })
  }

  const profile = options.state.profiles[options.profileId]
  if (!profile) {
    return emptyPlan(options.profileId, options.date, {
      kind: 'supported',
      version: plannerRead.state.version,
    })
  }

  const schoolYear =
    options.schoolYear ??
    options.state.schoolYear ??
    defaultSchoolYear(options.state.mindsetStartDate ?? '')
  const missionDay = missionDayForPlanner(profile, options.date)
  const curriculum = curriculumPlanForDay(
    profile,
    options.docs,
    schoolYear,
    options.date,
  )
  const plan = deriveDailyPlan({
    templates: plannerRead.state.blocks,
    overrides: plannerRead.state.overrides,
    student: profile,
    date: options.date,
    schoolYear,
    missionDay,
    missionBlocks: missionBlocksForDay(profile, options.date, missionDay),
    curriculumBlocks: curriculum.blocks,
    storedProgress: plannerRead.state.progress,
    now: options.now,
    currentLocalDate: options.currentLocalDate,
    notices: curriculum.notices,
  })
  const notices = [...plan.notices]
  const blocks = plan.blocks.map((row) => {
    const navigation = resolvePlannerNavigation(row, profile)
    if (
      row.block.source.kind === 'curriculum' &&
      navigation.destination.kind === 'unavailable'
    ) {
      const id = `curriculum-navigation:${row.instanceId}`
      if (!notices.some((notice) => notice.id === id)) {
        notices.push({
          id,
          profileId: profile.id,
          date: options.date,
          reason:
            navigation.destination.code === 'no-safe-entry'
              ? 'missing-adapter'
              : 'unsupported-destination',
          title: row.block.title,
          message: navigation.destination.message,
        })
      }
    }
    return {
      ...row,
      navigation,
      canStart:
        row.canStart && navigation.destination.kind !== 'unavailable',
      ...(navigation.destination.kind === 'unavailable'
        ? { unavailableReason: navigation.destination.message }
        : {}),
    }
  })

  return {
    ...plan,
    blocks,
    notices,
  }
}

function studentSource(
  source: PlannerActivitySource,
): StudentPlannerBlock['source'] {
  if (source.kind === 'manual') return { kind: 'manual' }
  if (source.kind === 'romeo-online') {
    return {
      kind: 'romeo-online',
      ...(source.activityId ? { activityId: source.activityId } : {}),
    }
  }
  if (source.kind === 'mission') {
    return {
      kind: 'mission',
      missionItemId: source.missionItemId,
      autoOnly: source.autoOnly,
      ...(source.autoKind ? { autoKind: source.autoKind } : {}),
    }
  }
  return {
    kind: 'curriculum',
    subjectId: source.subjectId,
    subjectLabel: source.subjectLabel,
    week: source.week,
    items: source.items.map((item) => ({
      id: item.id,
      text: item.text,
      dadTaught: item.dadTaught,
    })),
  }
}

function studentPlacement(placement: PlannerPlacement): PlannerPlacement {
  if (placement.kind === 'scheduled') {
    return {
      kind: 'scheduled',
      startMinute: placement.startMinute,
      endMinute: placement.endMinute,
      startTime: placement.startTime,
      ...(placement.crossesMidnight ? { crossesMidnight: true } : {}),
      ...(placement.conflict ? { conflict: placement.conflict } : {}),
    }
  }
  if (placement.kind === 'overflow') {
    return {
      kind: 'overflow',
      order: placement.order,
      earliestStartMinute: placement.earliestStartMinute,
      durationMinutes: placement.durationMinutes,
      reason: placement.reason,
    }
  }
  return {
    kind: 'unavailable',
    reason: placement.reason,
    message: placement.message,
  }
}

function studentNavigation(
  navigation: PlannerNavigationResolution,
): PlannerNavigationResolution {
  const destination = navigation.destination
  if (destination.kind === 'high-school-course') {
    return {
      destination: {
        kind: 'high-school-course',
        courseId: destination.courseId,
      },
      source: navigation.source,
      granularity: navigation.granularity,
    }
  }
  if (destination.kind === 'curriculum-instructions') {
    return {
      destination: {
        kind: 'curriculum-instructions',
        instanceId: destination.instanceId,
      },
      source: navigation.source,
      granularity: navigation.granularity,
    }
  }
  if (destination.kind === 'unavailable') {
    return {
      destination: {
        kind: 'unavailable',
        code: destination.code,
        message: destination.message,
      },
      source: navigation.source,
      granularity: navigation.granularity,
    }
  }
  return {
    destination: { kind: destination.kind },
    source: navigation.source,
    granularity: navigation.granularity,
  }
}

function studentBlock(block: PlannerBlock): StudentPlannerBlock {
  return {
    id: block.id,
    title: block.title,
    studentInstructions: block.studentInstructions,
    category: block.category,
    source: studentSource(block.source),
    startTime: block.startTime,
    expectedMinutes: block.expectedMinutes,
    scheduleBehavior: block.scheduleBehavior,
    requiresParentHelp: block.requiresParentHelp,
    ...(block.location ? { location: block.location } : {}),
    active: block.active,
  }
}

function studentOccurrence(
  occurrence: PlannerOccurrenceSnapshot | undefined,
): StudentPlannerProgress['occurrence'] {
  if (!occurrence) return undefined
  return {
    blockInstanceId: occurrence.blockInstanceId,
    blockId: occurrence.blockId,
    profileId: occurrence.profileId,
    date: occurrence.date,
    title: occurrence.title,
    studentInstructions: occurrence.studentInstructions,
    category: occurrence.category,
    preferredStartTime: occurrence.preferredStartTime,
    preferredStartMinute: occurrence.preferredStartMinute,
    placement: studentPlacement(occurrence.placement),
    expectedMinutes: occurrence.expectedMinutes,
    scheduleBehavior: occurrence.scheduleBehavior,
    requiresParentHelp: occurrence.requiresParentHelp,
    ...(occurrence.location ? { location: occurrence.location } : {}),
    capturedAt: occurrence.capturedAt,
  }
}

function studentProgress(progress: PlannerProgress): StudentPlannerProgress {
  const occurrence = studentOccurrence(progress.occurrence)
  return {
    profileId: progress.profileId,
    date: progress.date,
    blockInstanceId: progress.blockInstanceId,
    blockId: progress.blockId,
    status: progress.status,
    ...(progress.completionAuthority
      ? { completionAuthority: progress.completionAuthority }
      : {}),
    ...(progress.startedAt ? { startedAt: progress.startedAt } : {}),
    ...(progress.activeSince ? { activeSince: progress.activeSince } : {}),
    ...(progress.lastPausedAt
      ? { lastPausedAt: progress.lastPausedAt }
      : {}),
    ...(progress.completedAt ? { completedAt: progress.completedAt } : {}),
    ...(progress.terminalAt ? { terminalAt: progress.terminalAt } : {}),
    ...(progress.reopenedAt ? { reopenedAt: progress.reopenedAt } : {}),
    activeElapsedSeconds: progress.activeElapsedSeconds,
    ...(occurrence ? { occurrence } : {}),
    updatedAt: progress.updatedAt,
  }
}

/**
 * Student components receive a new allowlisted object graph. Parent notes,
 * assignments, source internals, parent verification, and unknown future fields
 * never cross this boundary.
 */
export function toStudentDailyPlan(plan: DailyPlan): StudentDailyPlan {
  return {
    profileId: plan.profileId,
    date: plan.date,
    blocks: plan.blocks.map(
      (row): StudentDailyPlanBlock => ({
        profileId: row.profileId,
        date: row.date,
        instanceId: row.instanceId,
        block: studentBlock(row.block),
        scheduledStartTime: row.scheduledStartTime,
        preferredStartMinute: row.preferredStartMinute,
        placement: studentPlacement(row.placement),
        ...(row.effectiveStartTime
          ? { effectiveStartTime: row.effectiveStartTime }
          : {}),
        progress: studentProgress(row.progress),
        canManuallyComplete: row.canManuallyComplete,
        canSetDisposition: false,
        canStart: row.canStart,
        ...(row.unavailableReason
          ? { unavailableReason: row.unavailableReason }
          : {}),
        ...(row.navigation
          ? { navigation: studentNavigation(row.navigation) }
          : {}),
        generated: row.generated,
      }),
    ),
    notices: plan.notices.map((notice) => ({
      id: notice.id,
      profileId: notice.profileId,
      date: notice.date,
      reason: notice.reason,
      title: notice.title,
      message: notice.message,
    })),
    compatibility: plan.compatibility,
    summary: { ...plan.summary },
  }
}

type OrderedDailyRow = {
  instanceId: string
  progress: { status: PlannerProgress['status'] }
}

export function currentDailyBlock<T extends OrderedDailyRow>(
  plan: { blocks: T[] },
): T | undefined {
  return (
    plan.blocks.find((block) => block.progress.status === 'in-progress') ??
    plan.blocks.find((block) => block.progress.status === 'paused') ??
    plan.blocks.find((block) =>
      ['not-started', 'skipped'].includes(block.progress.status),
    )
  )
}

export function nextDailyBlock<T extends OrderedDailyRow>(
  plan: { blocks: T[] },
  current: T | undefined = currentDailyBlock(plan),
): T | undefined {
  const remaining = plan.blocks.filter((block) =>
    ['not-started', 'in-progress', 'paused', 'skipped'].includes(
      block.progress.status,
    ),
  )
  if (!current) return remaining[0]
  const currentIndex = remaining.findIndex(
    (block) => block.instanceId === current.instanceId,
  )
  return remaining[currentIndex + 1]
}
