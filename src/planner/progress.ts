import type { AppState } from '../types'
import { readPlannerState } from './defaults'
import type {
  DailyPlanSummary,
  DailyPlanBlock,
  ParentVerification,
  PlannerAction,
  PlannerBlockStatus,
  PlannerCommandOutcome,
  PlannerOccurrenceSnapshot,
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

export interface PlannerTransitionOptions extends CompletionOptions {
  completionAuthority?: 'planner' | 'mission'
  occurrence?: PlannerOccurrenceSnapshot
}

export interface PlannerTransitionResult {
  state: PlannerState
  outcome: PlannerCommandOutcome
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
  const unfinishedUnavailable = (block: DailyPlanBlock): boolean =>
    block.progress.status !== 'completed' &&
    (block.placement.kind === 'unavailable' ||
      Boolean(block.unavailableReason) ||
      block.navigation?.destination.kind === 'unavailable')
  const eligible = blocks.filter(
    (block) =>
      block.progress.status !== 'excused' &&
      block.progress.status !== 'moved' &&
      !unfinishedUnavailable(block),
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
    blocks.reduce(
      (total, block) => total + elapsedSecondsAt(block.progress, now),
      0,
    ) / 60,
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

const NEXT_STATUS: Record<
  PlannerBlockStatus,
  Partial<Record<PlannerAction, PlannerBlockStatus>>
> = {
  'not-started': {
    start: 'in-progress',
    complete: 'completed',
    skip: 'skipped',
    excuse: 'excused',
    move: 'moved',
  },
  'in-progress': {
    pause: 'paused',
    complete: 'completed',
    skip: 'skipped',
    excuse: 'excused',
    move: 'moved',
  },
  paused: {
    resume: 'in-progress',
    complete: 'completed',
    skip: 'skipped',
    excuse: 'excused',
    move: 'moved',
  },
  skipped: {
    start: 'in-progress',
    complete: 'completed',
    excuse: 'excused',
    move: 'moved',
  },
  completed: {
    reopen: 'not-started',
  },
  excused: {
    reopen: 'not-started',
  },
  moved: {
    reopen: 'not-started',
  },
}

function isIdempotentTransition(
  status: PlannerBlockStatus,
  action: PlannerAction,
): boolean {
  return (
    (status === 'in-progress' && (action === 'start' || action === 'resume')) ||
    (status === 'paused' && action === 'pause') ||
    (status === 'completed' && action === 'complete') ||
    (status === 'skipped' && action === 'skip') ||
    (status === 'excused' && action === 'excuse') ||
    (status === 'moved' && action === 'move')
  )
}

function rowMatchesTarget(
  progress: PlannerProgress,
  target: PlannerProgressTarget,
): boolean {
  return (
    progress.profileId === target.profileId &&
    progress.date === target.date &&
    progress.blockInstanceId === target.blockInstanceId &&
    progress.blockId === target.blockId
  )
}

function stoppedRow(progress: PlannerProgress, now: string): PlannerProgress {
  return {
    ...progress,
    activeElapsedSeconds: elapsedSecondsAt(progress, now),
    activeSince: undefined,
  }
}

function missionTimingRow(progress: PlannerProgress): boolean {
  return (
    progress.completionAuthority === 'mission' ||
    progress.occurrence?.source.kind === 'mission' ||
    progress.blockId.startsWith('mission:')
  )
}

/**
 * The single planner-owned transition policy.
 *
 * Callers that accept untrusted identifiers must validate them against the
 * current derived plan before invoking this reducer. Rejected and idempotent
 * transitions return the original PlannerState reference.
 */
export function transitionPlannerProgress(
  state: PlannerState,
  target: PlannerProgressTarget,
  action: PlannerAction,
  now: string,
  options: PlannerTransitionOptions = {},
): PlannerTransitionResult {
  const stored = state.progress[target.blockInstanceId]
  if (stored && !rowMatchesTarget(stored, target)) {
    return {
      state,
      outcome: {
        kind: 'rejected',
        reason: 'invalid-transition',
        status: stored.status,
      },
    }
  }

  const current = stored ?? baseProgress(target, now)
  if (isIdempotentTransition(current.status, action)) {
    return {
      state,
      outcome: { kind: 'idempotent', status: current.status },
    }
  }

  if (
    action === 'complete' &&
    (current.completionAuthority === 'mission' ||
      options.completionAuthority === 'mission')
  ) {
    return {
      state,
      outcome: {
        kind: 'rejected',
        reason: 'invalid-transition',
        status: current.status,
      },
    }
  }

  const nextStatus = NEXT_STATUS[current.status][action]
  if (!nextStatus) {
    return {
      state,
      outcome: {
        kind: 'rejected',
        reason: 'invalid-transition',
        status: current.status,
      },
    }
  }

  const progress = { ...state.progress }
  if (action === 'start' || action === 'resume') {
    for (const [key, row] of Object.entries(progress)) {
      if (
        key !== target.blockInstanceId &&
        row.profileId === target.profileId &&
        row.status === 'in-progress'
      ) {
        const paused = pauseRow(row, now)
        progress[key] = missionTimingRow(row)
          ? { ...paused, completionAuthority: 'mission' }
          : paused
      }
    }
  }

  const shared: PlannerProgress = {
    ...current,
    profileId: target.profileId,
    date: target.date,
    blockInstanceId: target.blockInstanceId,
    blockId: target.blockId,
    ...(options.completionAuthority || current.completionAuthority
      ? {
          completionAuthority:
            options.completionAuthority ?? current.completionAuthority,
        }
      : {}),
    ...(current.occurrence || options.occurrence
      ? { occurrence: current.occurrence ?? options.occurrence }
      : {}),
  }

  let next: PlannerProgress
  if (nextStatus === 'in-progress') {
    next = {
      ...shared,
      status: 'in-progress',
      startedAt: shared.startedAt ?? now,
      activeSince: now,
      terminalAt: undefined,
      ...(options.resumePointer ? { resumePointer: options.resumePointer } : {}),
      updatedAt: now,
    }
  } else if (nextStatus === 'paused') {
    next = pauseRow(shared, now, options.resumePointer)
  } else if (nextStatus === 'completed') {
    const stopped = stoppedRow(shared, now)
    next = {
      ...stopped,
      status: 'completed',
      startedAt: stopped.startedAt ?? now,
      completedAt: now,
      terminalAt: now,
      ...(options.note !== undefined ? { completionNote: options.note } : {}),
      ...(options.parentVerification
        ? { parentVerification: options.parentVerification }
        : {}),
      ...(options.resumePointer ? { resumePointer: options.resumePointer } : {}),
      updatedAt: now,
    }
  } else if (
    nextStatus === 'skipped' ||
    nextStatus === 'excused' ||
    nextStatus === 'moved'
  ) {
    next = {
      ...stoppedRow(shared, now),
      status: nextStatus,
      terminalAt: now,
      updatedAt: now,
    }
  } else {
    next = {
      ...shared,
      status: 'not-started',
      startedAt: undefined,
      activeSince: undefined,
      lastPausedAt: undefined,
      completedAt: undefined,
      terminalAt: undefined,
      activeElapsedSeconds: 0,
      parentVerification: undefined,
      completionNote: undefined,
      resumePointer: undefined,
      reopenedAt: now,
      updatedAt: now,
    }
  }

  progress[target.blockInstanceId] = next
  return {
    state: { ...state, progress },
    outcome: { kind: 'applied', from: current.status, to: nextStatus },
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
  const current = state.progress[target.blockInstanceId]
  const action: PlannerAction = current?.status === 'paused' ? 'resume' : 'start'
  return transitionPlannerProgress(state, target, action, now, {
    resumePointer,
  }).state
}

export function pausePlannerProgress(
  state: PlannerState,
  target: PlannerProgressTarget,
  now: string,
  resumePointer?: ResumePointer,
): PlannerState {
  return transitionPlannerProgress(state, target, 'pause', now, {
    resumePointer,
  }).state
}

export function completePlannerProgress(
  state: PlannerState,
  target: PlannerProgressTarget,
  now: string,
  options: CompletionOptions = {},
): PlannerState {
  return transitionPlannerProgress(state, target, 'complete', now, options).state
}

export function setPlannerDisposition(
  state: PlannerState,
  target: PlannerProgressTarget,
  status: Extract<PlannerBlockStatus, 'skipped' | 'excused' | 'moved'>,
  now: string,
): PlannerState {
  const action: PlannerAction =
    status === 'skipped' ? 'skip' : status === 'excused' ? 'excuse' : 'move'
  return transitionPlannerProgress(state, target, action, now).state
}

/**
 * Closes a mission-owned live timer without persisting mission completion.
 * Profile.missions remains the only completion authority.
 */
export function settleMissionPlannerTiming(
  state: PlannerState,
  target: PlannerProgressTarget,
  now: string,
): PlannerState {
  const current = state.progress[target.blockInstanceId]
  if (
    !current ||
    !rowMatchesTarget(current, target) ||
    current.status !== 'in-progress'
  ) {
    return state
  }
  return {
    ...state,
    progress: {
      ...state.progress,
      [target.blockInstanceId]: {
        ...pauseRow(current, now),
        completionAuthority: 'mission',
      },
    },
  }
}

export function patchPlannerState(
  state: AppState,
  update: (planner: PlannerState) => PlannerState,
): AppState {
  const current = readPlannerState(state.planner)
  if (current.kind !== 'supported') return state
  const next = update(current.state)
  if (next === current.state) return state
  return { ...state, planner: next }
}
