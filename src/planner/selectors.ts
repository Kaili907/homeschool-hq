import type { AppState, SchoolYear } from '../types'
import { defaultSchoolYear } from '../curriculum/pacing'
import type { PlanDoc } from '../curriculum/parser'
import { normalizePlannerState } from './defaults'
import { curriculumBlocksForDay } from './adapters/curriculumAdapter'
import { missionBlocksForDay, missionDayForPlanner } from './adapters/missionAdapter'
import { deriveDailyPlan } from './engine'
import type { DailyPlan, DailyPlanBlock } from './types'

export interface SelectDailyPlanOptions {
  state: AppState
  profileId: string
  date: string
  docs: PlanDoc[]
  now: string
  schoolYear?: SchoolYear
}

export function selectDailyPlan(options: SelectDailyPlanOptions): DailyPlan {
  const profile = options.state.profiles[options.profileId]
  if (!profile) {
    return {
      profileId: options.profileId,
      date: options.date,
      blocks: [],
      summary: {
        plannedMinutes: 0,
        plannedMinutesRemaining: 0,
        activeMinutes: 0,
        completedCount: 0,
        remainingCount: 0,
        eligibleCount: 0,
        completionPercentage: 100,
      },
    }
  }
  const planner = normalizePlannerState(options.state.planner)
  const schoolYear =
    options.schoolYear ??
    options.state.schoolYear ??
    defaultSchoolYear(options.state.mindsetStartDate ?? '')
  const missionDay = missionDayForPlanner(profile, options.date)
  return deriveDailyPlan({
    templates: planner.blocks,
    overrides: planner.overrides,
    student: profile,
    date: options.date,
    schoolYear,
    missionDay,
    missionBlocks: missionBlocksForDay(profile, options.date, missionDay),
    curriculumBlocks: curriculumBlocksForDay(profile, options.docs, schoolYear, options.date),
    storedProgress: planner.progress,
    now: options.now,
  })
}

export function currentDailyBlock(plan: DailyPlan): DailyPlanBlock | undefined {
  return (
    plan.blocks.find((block) => block.progress.status === 'in-progress') ??
    plan.blocks.find((block) => block.progress.status === 'paused') ??
    plan.blocks.find((block) =>
      ['not-started', 'skipped'].includes(block.progress.status),
    )
  )
}

export function nextDailyBlock(
  plan: DailyPlan,
  current: DailyPlanBlock | undefined = currentDailyBlock(plan),
): DailyPlanBlock | undefined {
  const remaining = plan.blocks.filter((block) =>
    ['not-started', 'in-progress', 'paused', 'skipped'].includes(block.progress.status),
  )
  if (!current) return remaining[0]
  const currentIndex = remaining.findIndex((block) => block.instanceId === current.instanceId)
  return remaining[currentIndex + 1]
}
