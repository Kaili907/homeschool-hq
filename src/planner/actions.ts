import { patchProfile } from '../appState'
import type { AppState } from '../types'
import { completeManualMissionFromPlanner } from './adapters/missionAdapter'
import {
  completePlannerProgress,
  patchPlannerState,
  pausePlannerProgress,
  progressTargetFor,
  setPlannerDisposition,
  startPlannerProgress,
  type CompletionOptions,
} from './progress'
import type { DailyPlanBlock, PlannerAction, ResumePointer } from './types'

export interface ApplyPlannerActionOptions extends CompletionOptions {
  resumePointer?: ResumePointer
}

/**
 * Pure AppState reducer used inside React functional updates. Mission completion
 * delegates to missions.setItemDone; planner completion never touches skills,
 * mastery, assessments, attendance, pacing, identity, or sync fields.
 */
export function applyPlannerAction(
  state: AppState,
  block: DailyPlanBlock,
  action: PlannerAction,
  now: string,
  options: ApplyPlannerActionOptions = {},
): AppState {
  if (!state.profiles[block.profileId]) return state
  const source = block.block.source
  const target = progressTargetFor(block)

  if (source.kind === 'mission' && source.autoOnly && ['complete', 'skip', 'excuse', 'move'].includes(action)) {
    return state
  }
  if (source.kind === 'mission' && ['skip', 'excuse', 'move'].includes(action)) {
    return state
  }

  if (action === 'start' || action === 'resume') {
    return patchPlannerState(state, (planner) =>
      startPlannerProgress(planner, target, now, options.resumePointer),
    )
  }
  if (action === 'pause') {
    return patchPlannerState(state, (planner) =>
      pausePlannerProgress(planner, target, now, options.resumePointer),
    )
  }
  if (action === 'complete') {
    let next = state
    if (source.kind === 'mission') {
      next = patchProfile(state, block.profileId, (profile) =>
        completeManualMissionFromPlanner(profile, block, block.date),
      )
    }
    return patchPlannerState(next, (planner) =>
      completePlannerProgress(planner, target, now, options),
    )
  }
  const disposition =
    action === 'skip' ? 'skipped' : action === 'excuse' ? 'excused' : 'moved'
  return patchPlannerState(state, (planner) =>
    setPlannerDisposition(planner, target, disposition, now),
  )
}
