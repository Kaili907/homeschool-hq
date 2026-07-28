import type { AppState } from '../types'
import { normalizePlannerState } from './defaults'
import type {
  DailyPlanSummary,
  DailyPlanBlock,
  ParentVerification,
  PlannerBlockStatus,
  PlannerProgress,
  PlannerState,
  ResumePointer,
} from './types'

export interface PlannerProgressTarget {
  profileId: string
  date: string
  blockInstanceId: string
  blockId: string
}

export interface CompletionOptions {
  note?: string
  parentVerification?: ParentVerification
  resumePointer?: ResumePointer
}

export const progressTargetFor = (block: DailyPlanBlock): PlannerProgressTarget => ({
  profileId: block.profileId,
  date: block.date,
  blockInstanceId: block.instanceId,
  blockId: block.block.id,
})

function baseProgress(target: PlannerProgressTarget, now: string): PlannerProgress {
  return {
    profileId: target.profileId,
    date: target.date,
    blockInstanceId: target.blockInstanceId,
    blockId: target.blockId,
    status: 'not-started',
    activeElapsedSeconds: 0,
    updatedAt: now,
  }
}

function secondsBetween(start: string | undefined, end: string): number {
  if (!start) return 0
  const from = Date.parse(start)
  const to = Date.parse(end)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0
  return Math.max(0, Math.floor((to - from) / 1000))
}

/** Includes the live segment without mutating the stored progress row. */
export function elapsedSecondsAt(progress: PlannerProgress, now: string): number {
  return (
    progress.activeElapsedSeconds +
    (progress.status === 'in-progress' ? secondsBetween(progress.activeSince, now) : 0)
  )
}

/**
 * Completion is schedule completion only. It never reads or changes mastery,
 * assessment, attendance, or grade data.
 */
export function calculateDailyProgress(
  blocks: DailyPlanBlock[],
  now: string,
): DailyPlanSummary {
  const eligible = blocks.filter(
    (block) => block.progress.status !== 'excused' && block.progress.status !== 'moved',
  )
  const completed = eligible.filter((block) => block.progress.status === 'completed')
  const plannedMinutes = eligible.reduce(
    (total, block) => total + block.block.expectedMinutes,
    0,
  )
  const plannedMinutesRemaining = eligible
    .filter((block) => block.progress.status !== 'completed')
    .reduce((total, block) => {
      const active = Math.floor(elapsedSecondsAt(block.progress, now) / 60)
      return total + Math.max(0, block.block.expectedMinutes - active)
    }, 0)
  const activeMinutes = Math.floor(
    blocks.reduce((total, block) => total + elapsedSecondsAt(block.progress, now), 0) / 60,
  )
  const eligibleCount = eligible.length
  const completedCount = completed.length
  return {
    plannedMinutes,
    plannedMinutesRemaining,
    activeMinutes,
    completedCount,
    remainingCount: eligibleCount - completedCount,
    eligibleCount,
    completionPercentage:
      eligibleCount === 0 ? 100 : Math.round((completedCount / eligibleCount) * 100),
  }
}

function pauseRow(
  progress: PlannerProgress,
  now: string,
  resumePointer?: ResumePointer,
): PlannerProgress {
  if (progress.status !== 'in-progress') return progress
  return {
    ...progress,
    status: 'paused',
    activeElapsedSeconds: elapsedSecondsAt(progress, now),
    activeSince: undefined,
    lastPausedAt: now,
    ...(resumePointer ? { resumePointer } : {}),
    updatedAt: now,
  }
}

/**
 * Starts/resumes one block and pauses every other active row for that profile in
 * the same atomic state transition. The date is intentionally not part of the
 * pause filter: one student cannot be active in two calendar-day instances.
 */
export function startPlannerProgress(
  state: PlannerState,
  target: PlannerProgressTarget,
  now: string,
  resumePointer?: ResumePointer,
): PlannerState {
  const planner = normalizePlannerState(state)
  const existing = planner.progress[target.blockInstanceId]
  if (existing && ['completed', 'excused', 'moved'].includes(existing.status)) return planner

  const progress = { ...planner.progress }
  for (const [key, row] of Object.entries(progress)) {
    if (
      row.profileId === target.profileId &&
      row.status === 'in-progress' &&
      key !== target.blockInstanceId
    ) {
      progress[key] = pauseRow(row, now)
    }
  }

  const current = existing ?? baseProgress(target, now)
  progress[target.blockInstanceId] = {
    ...current,
    profileId: target.profileId,
    date: target.date,
    blockInstanceId: target.blockInstanceId,
    blockId: target.blockId,
    status: 'in-progress',
    startedAt: current.startedAt ?? now,
    activeSince: now,
    completedAt: undefined,
    ...(resumePointer ? { resumePointer } : {}),
    updatedAt: now,
  }
  return { ...planner, progress }
}

export function pausePlannerProgress(
  state: PlannerState,
  target: PlannerProgressTarget,
  now: string,
  resumePointer?: ResumePointer,
): PlannerState {
  const planner = normalizePlannerState(state)
  const current = planner.progress[target.blockInstanceId]
  if (!current || current.profileId !== target.profileId || current.status !== 'in-progress') {
    return planner
  }
  return {
    ...planner,
    progress: {
      ...planner.progress,
      [target.blockInstanceId]: pauseRow(current, now, resumePointer),
    },
  }
}

export function completePlannerProgress(
  state: PlannerState,
  target: PlannerProgressTarget,
  now: string,
  options: CompletionOptions = {},
): PlannerState {
  const planner = normalizePlannerState(state)
  const current = planner.progress[target.blockInstanceId] ?? baseProgress(target, now)
  if (current.profileId !== target.profileId) return planner
  return {
    ...planner,
    progress: {
      ...planner.progress,
      [target.blockInstanceId]: {
        ...current,
        status: 'completed',
        startedAt: current.startedAt ?? now,
        activeElapsedSeconds: elapsedSecondsAt(current, now),
        activeSince: undefined,
        completedAt: current.completedAt ?? now,
        ...(options.note !== undefined ? { completionNote: options.note } : {}),
        ...(options.parentVerification
          ? { parentVerification: options.parentVerification }
          : {}),
        ...(options.resumePointer ? { resumePointer: options.resumePointer } : {}),
        updatedAt: now,
      },
    },
  }
}

export function setPlannerDisposition(
  state: PlannerState,
  target: PlannerProgressTarget,
  status: Extract<PlannerBlockStatus, 'skipped' | 'excused' | 'moved'>,
  now: string,
): PlannerState {
  const planner = normalizePlannerState(state)
  const current = planner.progress[target.blockInstanceId] ?? baseProgress(target, now)
  if (current.profileId !== target.profileId) return planner
  return {
    ...planner,
    progress: {
      ...planner.progress,
      [target.blockInstanceId]: {
        ...current,
        status,
        activeElapsedSeconds: elapsedSecondsAt(current, now),
        activeSince: undefined,
        updatedAt: now,
      },
    },
  }
}

export function patchPlannerState(
  state: AppState,
  update: (planner: PlannerState) => PlannerState,
): AppState {
  return { ...state, planner: update(normalizePlannerState(state.planner)) }
}
