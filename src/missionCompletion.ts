import { recordAttendance } from './attendance/attendance'
import { patchProfile } from './appState'
import { ensureToday, isDayComplete, setItemDone } from './missions'
import {
  awardMissionEvents,
  getStarsConfig,
  starsEnabled,
} from './stars/stars'
import type { AppState, ISODate, Profile, StarRates } from './types'

export type MissionItemCommandRejection =
  | 'wrong-date'
  | 'profile-not-found'
  | 'item-not-found'
  | 'auto-only'
  | 'already-applied'

export interface ManualMissionItemCommand {
  profileId: string
  itemId: string
  done: boolean
  /** The MissionDay being changed. Planner commands may mutate only today. */
  date: ISODate
  /** Injected family-local date. Never derive this from a UTC timestamp. */
  currentLocalDate: ISODate
}

export interface MissionItemCommandResult {
  state: AppState
  outcome: 'applied' | 'no-op' | 'rejected'
  reason?: MissionItemCommandRejection
  dayCompletedNow: boolean
}

/**
 * The single side-effect boundary for a mission mutation.
 *
 * Mission reducers own item completion and streaks. This function adds the
 * source-owned mission reward and append-only attendance exactly once. Planner
 * timers are deliberately absent from this contract and therefore cannot
 * increase rewards or attendance hours.
 */
export function finalizeMissionMutation(
  before: Profile,
  after: Profile,
  rates: StarRates,
  date: ISODate,
): Profile {
  const withRewards = starsEnabled(before)
    ? awardMissionEvents(before, after, rates, date)
    : after
  return recordAttendance(
    withRewards,
    isDayComplete(withRewards.missions[date]),
    date,
  )
}

/**
 * Apply a manual MissionDay checkbox command against the latest AppState.
 *
 * This is the boundary shared by the mission UI and the planner. It validates
 * the current source item before mutating, rejects non-current local dates, and
 * updates an explicitly targeted profile even when another profile is active.
 */
export function applyManualMissionItemCommand(
  state: AppState,
  command: ManualMissionItemCommand,
): MissionItemCommandResult {
  if (command.date !== command.currentLocalDate) {
    return {
      state,
      outcome: 'rejected',
      reason: 'wrong-date',
      dayCompletedNow: false,
    }
  }

  const profile = state.profiles[command.profileId]
  if (!profile) {
    return {
      state,
      outcome: 'rejected',
      reason: 'profile-not-found',
      dayCompletedNow: false,
    }
  }

  // Derive today's current source before accepting a rendered item ID. The
  // derived day is not persisted if validation fails.
  const withDay = ensureToday(profile, command.date)
  const sourceItem = withDay.missions[command.date]?.items.find(
    (item) => item.id === command.itemId,
  )
  if (!sourceItem) {
    return {
      state,
      outcome: 'rejected',
      reason: 'item-not-found',
      dayCompletedNow: false,
    }
  }
  if (sourceItem.auto) {
    return {
      state,
      outcome: 'rejected',
      reason: 'auto-only',
      dayCompletedNow: false,
    }
  }

  const wasComplete = isDayComplete(withDay.missions[command.date])
  if (sourceItem.done === command.done) {
    // A repeated completion cannot pay twice. Calling the shared finalizer also
    // safely repairs a legacy missing attendance row for an already-complete
    // day; recordAttendance itself is append-only and idempotent.
    const reconciled =
      command.done && wasComplete
        ? finalizeMissionMutation(
            withDay,
            withDay,
            getStarsConfig(state).rates,
            command.date,
          )
        : withDay
    const nextState =
      reconciled === profile
        ? state
        : patchProfile(state, command.profileId, () => reconciled)
    return {
      state: nextState,
      outcome: 'no-op',
      reason: 'already-applied',
      dayCompletedNow: false,
    }
  }

  const mutated = setItemDone(
    withDay,
    command.itemId,
    command.done,
    command.date,
  )
  const nextProfile = finalizeMissionMutation(
    withDay,
    mutated,
    getStarsConfig(state).rates,
    command.date,
  )
  const nowComplete = isDayComplete(nextProfile.missions[command.date])

  return {
    state: patchProfile(state, command.profileId, () => nextProfile),
    outcome: 'applied',
    dayCompletedNow: !wasComplete && nowComplete,
  }
}
