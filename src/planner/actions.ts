import type { PlanDoc } from '../curriculum/parser'
import { applyManualMissionItemCommand } from '../missionCompletion'
import type { AppState, SchoolYear } from '../types'
import { blockAssignedTo } from './engine'
import { normalizePlannerProgress, readPlannerState } from './defaults'
import { snapshotForDailyPlanBlock } from './occurrence'
import {
  settleMissionPlannerTiming,
  transitionPlannerProgress,
  type PlannerProgressTarget,
} from './progress'
import {
  plannerBlockInstanceId,
  pointerFromLinkedActivity,
} from './resume'
import { selectDailyPlan } from './selectors'
import type {
  DailyPlanBlock,
  PlannerCommand,
  PlannerCommandOutcome,
  PlannerCommandRejection,
  PlannerNavigationResolution,
  PlannerState,
} from './types'

export interface PlannerCommandContext {
  now: string
  /** Family-local YYYY-MM-DD, injected so mission-date checks are deterministic. */
  currentLocalDate: string
  docs: PlanDoc[]
  schoolYear: SchoolYear
}

export interface ApplyPlannerCommandResult {
  state: AppState
  outcome: PlannerCommandOutcome
  /** Present only for an accepted Start/Resume, after latest-state validation. */
  navigation?: PlannerNavigationResolution
}

const rejected = (
  state: AppState,
  reason: PlannerCommandRejection,
  status?: DailyPlanBlock['progress']['status'],
): ApplyPlannerCommandResult => ({
  state,
  outcome: {
    kind: 'rejected',
    reason,
    ...(status ? { status } : {}),
  },
})

const idempotent = (
  state: AppState,
  status: DailyPlanBlock['progress']['status'],
): ApplyPlannerCommandResult => ({
  state,
  outcome: { kind: 'idempotent', status },
})

function targetFor(row: DailyPlanBlock): PlannerProgressTarget {
  return {
    profileId: row.profileId,
    date: row.date,
    blockInstanceId: row.instanceId,
    blockId: row.block.id,
  }
}

function plannerWithMissionTimingSettled(
  state: AppState,
  target: PlannerProgressTarget,
  now: string,
): AppState {
  const readable = readPlannerState(state.planner)
  if (readable.kind !== 'supported') return state
  const planner = settleMissionPlannerTiming(readable.state, target, now)
  return planner === readable.state ? state : { ...state, planner }
}

function sourceUnavailable(
  planner: PlannerState,
  command: PlannerCommand,
): boolean {
  const row = planner.progress[command.target.blockInstanceId]
  return (
    row?.profileId === command.target.profileId &&
    row.date === command.target.date &&
    row.blockId === command.target.blockId &&
    (row.occurrence?.source.kind === 'mission' ||
      row.occurrence?.source.kind === 'curriculum')
  )
}

function currentSourceActionableForReopen(
  state: AppState,
  planner: PlannerState,
  command: PlannerCommand,
  context: PlannerCommandContext,
): boolean {
  const progress = { ...planner.progress }
  delete progress[command.target.blockInstanceId]
  const currentPlan = selectDailyPlan({
    state: {
      ...state,
      planner: { ...planner, progress },
    },
    profileId: command.target.profileId,
    date: command.target.date,
    currentLocalDate: context.currentLocalDate,
    docs: context.docs,
    now: context.now,
    schoolYear: context.schoolYear,
  })
  const currentRow = currentPlan.blocks.find(
    (candidate) =>
      candidate.instanceId === command.target.blockInstanceId &&
      candidate.block.id === command.target.blockId,
  )
  return Boolean(
    currentRow &&
      currentRow.canStart &&
      currentRow.placement.kind !== 'unavailable' &&
      !currentRow.unavailableReason,
  )
}

function maySettleUnavailablePlannerOwnedOccurrence(
  state: AppState,
  planner: PlannerState,
  row: DailyPlanBlock,
  command: PlannerCommand,
  missingSource: boolean,
): boolean {
  const rawPlanner =
    typeof state.planner === 'object' &&
    state.planner !== null &&
    !Array.isArray(state.planner)
      ? (state.planner as Record<string, unknown>)
      : undefined
  const rawProgress =
    rawPlanner &&
    typeof rawPlanner.progress === 'object' &&
    rawPlanner.progress !== null &&
    !Array.isArray(rawPlanner.progress)
      ? (rawPlanner.progress as Record<string, unknown>)
      : undefined
  const persisted = normalizePlannerProgress(
    rawProgress?.[command.target.blockInstanceId],
  )
  const persistedSource = persisted?.occurrence?.source
  const plannerOwnedOccurrence =
    persisted?.occurrence?.provenance !== 'normalized-archive' &&
    ((persistedSource?.kind === 'manual' &&
      row.block.source.kind === 'manual') ||
      (persistedSource?.kind === 'romeo-online' &&
        row.block.source.kind === 'romeo-online'))

  if (
    !missingSource ||
    !plannerOwnedOccurrence ||
    !(
      (command.action === 'pause' &&
        (row.progress.status === 'in-progress' ||
          row.progress.status === 'paused')) ||
      (command.action === 'complete' &&
        (row.progress.status === 'in-progress' ||
          row.progress.status === 'paused' ||
          row.progress.status === 'completed'))
    )
  ) {
    return false
  }

  const stored = planner.progress[command.target.blockInstanceId]
  const occurrence = stored?.occurrence
  return Boolean(
    stored &&
      occurrence &&
      stored.profileId === command.target.profileId &&
      stored.date === command.target.date &&
      stored.blockId === command.target.blockId &&
      stored.blockInstanceId === command.target.blockInstanceId &&
      stored.status === row.progress.status &&
      persisted?.profileId === command.target.profileId &&
      persisted.date === command.target.date &&
      persisted.blockId === command.target.blockId &&
      persisted.blockInstanceId === command.target.blockInstanceId &&
      persisted.status === stored.status &&
      occurrence.profileId === command.target.profileId &&
      occurrence.date === command.target.date &&
      occurrence.blockId === command.target.blockId &&
      occurrence.blockInstanceId === command.target.blockInstanceId &&
      occurrence.source.kind === persistedSource?.kind,
  )
}

/**
 * Pure, current-state command reducer.
 *
 * The command carries identifiers only. The target row and every permission are
 * reselected from the latest AppState supplied by the React functional updater.
 */
export function applyPlannerCommand(
  state: AppState,
  command: PlannerCommand,
  context: PlannerCommandContext,
): ApplyPlannerCommandResult {
  const profile = state.profiles[command.target.profileId]
  if (!profile) return rejected(state, 'profile-not-found')

  if (
    command.actor.kind === 'student' &&
    command.actor.profileId !== command.target.profileId
  ) {
    return rejected(state, 'actor-profile-mismatch')
  }

  if (
    command.actor.kind === 'student' &&
    state.activeProfileId !== command.actor.profileId
  ) {
    return rejected(state, 'active-profile-mismatch')
  }

  if (
    command.actor.kind === 'student' &&
    command.target.date !== context.currentLocalDate
  ) {
    return rejected(state, 'student-date-restricted')
  }

  if (
    command.actor.kind === 'student' &&
    (command.action === 'skip' ||
      command.action === 'excuse' ||
      command.action === 'move' ||
      command.action === 'reopen')
  ) {
    return rejected(state, 'permission-denied')
  }

  const readable = readPlannerState(state.planner)
  if (readable.kind !== 'supported') {
    return rejected(state, 'planner-version-unsupported')
  }
  const planner = readable.state

  const expectedInstanceId = plannerBlockInstanceId(
    command.target.profileId,
    command.target.date,
    command.target.blockId,
  )
  if (command.target.blockInstanceId !== expectedInstanceId) {
    return rejected(state, 'invalid-instance-id')
  }

  const plan = selectDailyPlan({
    state,
    profileId: command.target.profileId,
    date: command.target.date,
    currentLocalDate: context.currentLocalDate,
    docs: context.docs,
    now: context.now,
    schoolYear: context.schoolYear,
  })
  if (plan.compatibility.kind !== 'supported') {
    return rejected(state, 'planner-version-unsupported')
  }

  const row = plan.blocks.find(
    (candidate) =>
      candidate.instanceId === command.target.blockInstanceId &&
      candidate.block.id === command.target.blockId &&
      candidate.profileId === command.target.profileId &&
      candidate.date === command.target.date,
  )
  if (!row) {
    const template = planner.blocks.find(
      (candidate) => candidate.id === command.target.blockId,
    )
    if (template && !blockAssignedTo(template, command.target.profileId)) {
      return rejected(state, 'not-assigned')
    }
    if (template && !template.active) {
      return rejected(state, 'block-not-actionable')
    }
    if (template) {
      return rejected(state, 'block-not-actionable')
    }
    return rejected(
      state,
      sourceUnavailable(planner, command) ? 'source-unavailable' : 'block-not-found',
    )
  }

  if (!blockAssignedTo(row.block, command.target.profileId)) {
    return rejected(state, 'not-assigned', row.progress.status)
  }
  const source = row.block.source
  const missingSource = plan.notices.some(
    (notice) =>
      notice.reason === 'missing-source' &&
      notice.profileId === row.profileId &&
      notice.date === row.date &&
      notice.id === `missing-source:${row.instanceId}`,
  )
  const maySettleOrphanMission =
    source.kind === 'mission' &&
    row.progress.status === 'in-progress' &&
    command.action === 'pause'
  const maySettleUnavailablePlannerOwned =
    maySettleUnavailablePlannerOwnedOccurrence(
      state,
      planner,
      row,
      command,
      missingSource,
    )
  if (
    missingSource &&
    !maySettleOrphanMission &&
    !maySettleUnavailablePlannerOwned
  ) {
    return rejected(state, 'source-unavailable', row.progress.status)
  }
  if (
    row.placement.kind === 'unavailable' &&
    !maySettleOrphanMission &&
    !maySettleUnavailablePlannerOwned
  ) {
    return rejected(
      state,
      row.placement.reason === 'missing-source'
        ? 'source-unavailable'
        : 'block-not-actionable',
      row.progress.status,
    )
  }

  if (
    (command.action === 'start' || command.action === 'resume') &&
    !row.canStart
  ) {
    return rejected(state, 'navigation-unavailable', row.progress.status)
  }

  if (
    (command.action === 'skip' ||
      command.action === 'excuse' ||
      command.action === 'move') &&
    !row.canSetDisposition
  ) {
    return rejected(state, 'permission-denied', row.progress.status)
  }

  if (
    command.action === 'reopen' &&
    !currentSourceActionableForReopen(state, planner, command, context)
  ) {
    return rejected(state, 'block-not-actionable', row.progress.status)
  }

  if (source.kind === 'mission') {
    if (
      command.action === 'skip' ||
      command.action === 'excuse' ||
      command.action === 'move' ||
      command.action === 'reopen'
    ) {
      return rejected(state, 'permission-denied', row.progress.status)
    }

    if (command.action === 'complete') {
      if (source.autoOnly) {
        return rejected(state, 'permission-denied', row.progress.status)
      }
      if (command.target.date !== context.currentLocalDate) {
        return rejected(state, 'mission-date-restricted', row.progress.status)
      }
      if (!row.canManuallyComplete) {
        return rejected(state, 'permission-denied', row.progress.status)
      }

      const missionResult = applyManualMissionItemCommand(state, {
        profileId: command.target.profileId,
        itemId: source.missionItemId,
        done: true,
        date: command.target.date,
        currentLocalDate: context.currentLocalDate,
      })
      if (missionResult.outcome === 'rejected') {
        const reason =
          missionResult.reason === 'wrong-date'
            ? 'mission-date-restricted'
            : missionResult.reason === 'profile-not-found'
              ? 'profile-not-found'
              : missionResult.reason === 'item-not-found'
                ? 'source-unavailable'
                : 'permission-denied'
        return rejected(state, reason, row.progress.status)
      }

      const next = plannerWithMissionTimingSettled(
        missionResult.state,
        targetFor(row),
        context.now,
      )
      return row.progress.status === 'completed'
        ? idempotent(next, 'completed')
        : {
            state: next,
            outcome: {
              kind: 'applied',
              from: row.progress.status,
              to: 'completed',
            },
          }
    }

    if (row.progress.status === 'completed') {
      return rejected(state, 'invalid-transition', row.progress.status)
    }
  } else if (
    command.action === 'complete' &&
    !row.canManuallyComplete &&
    !maySettleUnavailablePlannerOwned
  ) {
    return rejected(state, 'permission-denied', row.progress.status)
  }

  const resumePointer =
    command.action === 'pause'
      ? row.progress.resumePointer ??
        pointerFromLinkedActivity(row, context.now)
      : undefined
  const transition = transitionPlannerProgress(
    planner,
    targetFor(row),
    command.action,
    context.now,
    {
      completionAuthority:
        source.kind === 'mission' ? 'mission' : 'planner',
      occurrence: snapshotForDailyPlanBlock(row, context.now),
      ...(resumePointer ? { resumePointer } : {}),
    },
  )
  const navigation =
    (command.action === 'start' || command.action === 'resume') &&
    transition.outcome.kind !== 'rejected'
      ? row.navigation
      : undefined
  if (transition.state === planner) {
    return {
      state,
      outcome: transition.outcome,
      ...(navigation ? { navigation } : {}),
    }
  }
  return {
    state: { ...state, planner: transition.state },
    outcome: transition.outcome,
    ...(navigation ? { navigation } : {}),
  }
}
