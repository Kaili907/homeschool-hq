import { describe, expect, it } from 'vitest'
import {
  effectiveHoursPerDay,
  getAttendance,
} from './attendance/attendance'
import { defaultSchoolYear } from './curriculum/pacing'
import { defaultAppState, emptyProfile } from './migration'
import {
  autoCompleteKind,
  isDayComplete,
} from './missions'
import {
  applyManualMissionItemCommand,
  finalizeMissionMutation,
} from './missionCompletion'
import { getStars, getStarsConfig } from './stars/stars'
import type { AppState, MissionDay, Profile } from './types'

const TODAY = '2026-08-31'
const YESTERDAY = '2026-08-30'
const TOMORROW = '2026-09-01'
const ITEM_ID = 'manual-work'

const openManualDay = (
  id = ITEM_ID,
  label = 'Manual work',
): MissionDay => ({
  items: [{ id, label, done: false }],
})

const completeManualDay = (
  id = ITEM_ID,
  label = 'Manual work',
): MissionDay => ({
  items: [{ id, label, done: true }],
})

function stateWithDay(
  day: MissionDay = openManualDay(),
  profileId = 'p1',
): AppState {
  const state = defaultAppState()
  const profile = emptyProfile(profileId, 'Mission Kid', '3')
  profile.missions[TODAY] = day
  state.profiles[profileId] = profile
  return state
}

function command(
  state: AppState,
  over: Partial<Parameters<typeof applyManualMissionItemCommand>[1]> = {},
) {
  return applyManualMissionItemCommand(state, {
    profileId: 'p1',
    itemId: ITEM_ID,
    done: true,
    date: TODAY,
    currentLocalDate: TODAY,
    ...over,
  })
}

const ledgerCount = (profile: Profile, source: string, day = TODAY) =>
  getStars(profile).ledger.filter(
    (entry) => entry.source === source && entry.day === day,
  ).length

describe('manual mission command boundary', () => {
  it('completes today for an inactive profile with streak, reward, and attendance atomically', () => {
    const state = stateWithDay()
    state.activeProfileId = 'p2'
    const beforeActive = state.profiles.p2
    const expectedHours = effectiveHoursPerDay(state.profiles.p1)

    const result = command(state)
    const profile = result.state.profiles.p1

    expect(result.outcome).toBe('applied')
    expect(result.dayCompletedNow).toBe(true)
    expect(profile.missions[TODAY].items[0].done).toBe(true)
    expect(profile.streaks).toEqual({
      current: 1,
      best: 1,
      lastActiveDate: TODAY,
    })
    expect(ledgerCount(profile, 'mission-complete')).toBe(1)
    expect(getAttendance(profile).log).toEqual([
      { date: TODAY, hours: expectedHours },
    ])
    expect(result.state.activeProfileId).toBe('p2')
    expect(result.state.profiles.p2).toBe(beforeActive)
  })

  it('does not award completion effects until the final eligible item is done', () => {
    const state = stateWithDay({
      items: [
        { id: ITEM_ID, label: 'First', done: false },
        { id: 'second', label: 'Second', done: false },
      ],
    })

    const result = command(state)
    const profile = result.state.profiles.p1

    expect(result.dayCompletedNow).toBe(false)
    expect(isDayComplete(profile.missions[TODAY])).toBe(false)
    expect(profile.streaks.current).toBe(0)
    expect(ledgerCount(profile, 'mission-complete')).toBe(0)
    expect(getAttendance(profile).log).toEqual([])
  })

  it('rejects yesterday and tomorrow before touching missions or streaks', () => {
    const state = stateWithDay()
    const yesterday = command(state, {
      date: YESTERDAY,
      currentLocalDate: TODAY,
    })
    const tomorrow = command(state, {
      date: TOMORROW,
      currentLocalDate: TODAY,
    })

    expect(yesterday).toMatchObject({
      state,
      outcome: 'rejected',
      reason: 'wrong-date',
      dayCompletedNow: false,
    })
    expect(tomorrow).toMatchObject({
      state,
      outcome: 'rejected',
      reason: 'wrong-date',
      dayCompletedNow: false,
    })
    expect(state.profiles.p1.missions[TODAY].items[0].done).toBe(false)
    expect(state.profiles.p1.streaks.current).toBe(0)
  })

  it('rejects unknown profiles, removed or renamed IDs, and auto-only items', () => {
    const removed = stateWithDay(openManualDay('replacement-id', 'Renamed work'))
    const missingProfile = command(removed, { profileId: 'missing' })
    const staleId = command(removed)

    const auto = stateWithDay({
      items: [
        {
          id: ITEM_ID,
          label: 'Math source',
          done: false,
          auto: true,
          autoKind: 'math',
        },
      ],
    })
    const autoAttempt = command(auto)

    expect(missingProfile.outcome).toBe('rejected')
    expect(missingProfile.reason).toBe('profile-not-found')
    expect(staleId.outcome).toBe('rejected')
    expect(staleId.reason).toBe('item-not-found')
    expect(staleId.state).toBe(removed)
    expect(autoAttempt.outcome).toBe('rejected')
    expect(autoAttempt.reason).toBe('auto-only')
    expect(autoAttempt.state).toBe(auto)
  })

  it('uses stable source identity when only the mission label is renamed', () => {
    const state = stateWithDay(openManualDay(ITEM_ID, 'Updated source label'))
    const result = command(state)
    expect(result.outcome).toBe('applied')
    expect(result.state.profiles.p1.missions[TODAY].items[0]).toMatchObject({
      id: ITEM_ID,
      label: 'Updated source label',
      done: true,
    })
  })

  it('repeated completion is idempotent for streak, rewards, and attendance', () => {
    const once = command(stateWithDay()).state
    const twiceResult = command(once)
    const profile = twiceResult.state.profiles.p1

    expect(twiceResult.outcome).toBe('no-op')
    expect(twiceResult.reason).toBe('already-applied')
    expect(profile.streaks).toEqual({
      current: 1,
      best: 1,
      lastActiveDate: TODAY,
    })
    expect(ledgerCount(profile, 'mission-complete')).toBe(1)
    expect(getAttendance(profile).log).toHaveLength(1)
  })

  it('uncheck then re-check cannot pay or record the same day twice', () => {
    const completed = command(stateWithDay()).state
    const unchecked = command(completed, { done: false }).state
    expect(unchecked.profiles.p1.missions[TODAY].items[0].done).toBe(false)

    const rechecked = command(unchecked).state
    const profile = rechecked.profiles.p1

    expect(profile.missions[TODAY].items[0].done).toBe(true)
    expect(profile.streaks.current).toBe(1)
    expect(ledgerCount(profile, 'mission-complete')).toBe(1)
    expect(getAttendance(profile).log).toHaveLength(1)
  })

  it('repairs missing append-only attendance without duplicating a prior reward', () => {
    const state = stateWithDay(completeManualDay())
    const rates = getStarsConfig(state).rates
    const before = state.profiles.p1
    const rewarded = finalizeMissionMutation(
      { ...before, missions: { [TODAY]: openManualDay() } },
      before,
      rates,
      TODAY,
    )
    state.profiles.p1 = { ...rewarded, attendance: undefined }

    const result = command(state)
    const profile = result.state.profiles.p1

    expect(result.outcome).toBe('no-op')
    expect(ledgerCount(profile, 'mission-complete')).toBe(1)
    expect(getAttendance(profile).log).toHaveLength(1)
  })

  it('does not create a star wallet for a stars-disabled profile', () => {
    const state = defaultAppState()
    const teen = emptyProfile('p4', 'Teen', '10')
    teen.missions[TODAY] = openManualDay()
    state.profiles.p4 = teen

    const result = command(state, { profileId: 'p4' })
    const profile = result.state.profiles.p4

    expect(profile.missions[TODAY].items[0].done).toBe(true)
    expect(profile.streaks.current).toBe(1)
    expect(profile.stars).toBeUndefined()
    expect(getAttendance(profile).log).toHaveLength(1)
  })

  it('never reads planner elapsed time when calculating attendance or rewards', () => {
    const state = stateWithDay()
    const plannerSentinel = {
      version: 1 as const,
      blocks: [],
      overrides: [],
      progress: {},
    }
    state.planner = plannerSentinel
    const expectedHours = effectiveHoursPerDay(state.profiles.p1)

    const result = command(state)
    const profile = result.state.profiles.p1

    expect(result.state.planner).toBe(plannerSentinel)
    expect(getAttendance(profile).log[0].hours).toBe(expectedHours)
    expect(getStars(profile).balance).toBe(
      getStarsConfig(state).rates.missionComplete,
    )
  })
})

describe('shared source-activity finalizer', () => {
  it('gives an auto source the same streak, reward, and attendance effects', () => {
    const profile = emptyProfile('p1', 'Auto Kid', '3')
    profile.missions[TODAY] = {
      items: [
        {
          id: 'math-source',
          label: 'Math',
          done: false,
          auto: true,
          autoKind: 'math',
        },
      ],
    }
    const state = defaultAppState()
    const afterSource = autoCompleteKind(profile, 'math', TODAY)
    const finalized = finalizeMissionMutation(
      profile,
      afterSource,
      getStarsConfig(state).rates,
      TODAY,
    )

    expect(finalized.missions[TODAY].items[0].done).toBe(true)
    expect(finalized.streaks.current).toBe(1)
    expect(ledgerCount(finalized, 'mission-complete')).toBe(1)
    expect(getAttendance(finalized).log).toHaveLength(1)
  })

  it('awards the fourth-day weekly event once, even after uncheck/re-check', () => {
    const MON = '2026-08-31'
    const TUE = '2026-09-01'
    const WED = '2026-09-02'
    const THU = '2026-09-03'
    const profile = emptyProfile('p1', 'Streak Kid', '3')
    profile.missions = {
      [MON]: completeManualDay(),
      [TUE]: completeManualDay(),
      [WED]: completeManualDay(),
      [THU]: openManualDay(),
    }
    profile.streaks = { current: 3, best: 3, lastActiveDate: WED }
    const state = defaultAppState()
    state.profiles.p1 = profile

    const fourth = command(state, {
      date: THU,
      currentLocalDate: THU,
    }).state
    const unchecked = command(fourth, {
      date: THU,
      currentLocalDate: THU,
      done: false,
    }).state
    const rechecked = command(unchecked, {
      date: THU,
      currentLocalDate: THU,
    }).state
    const finalProfile = rechecked.profiles.p1

    expect(finalProfile.streaks).toEqual({
      current: 4,
      best: 4,
      lastActiveDate: THU,
    })
    expect(ledgerCount(finalProfile, 'mission-complete', THU)).toBe(1)
    expect(ledgerCount(finalProfile, 'weekly-streak', THU)).toBe(1)
    expect(getAttendance(finalProfile).log.filter((row) => row.date === THU)).toHaveLength(1)
  })

  it('preserves unrelated profile data through the mission boundary', () => {
    const state = stateWithDay()
    state.profiles.p1.skills.mult = { attempts: 9, correct: 7, mastery: 64 }
    state.profiles.p1.pacing = {
      pointers: { math: 3 },
      nudges: [
        {
          at: `${TODAY}T12:00:00.000Z`,
          subjectId: 'math',
          from: 4,
          to: 3,
          reason: 'Keep the existing pointer history',
        },
      ],
    }
    state.schoolYear = defaultSchoolYear(TODAY)
    const beforeSkills = state.profiles.p1.skills
    const beforePacing = state.profiles.p1.pacing
    const beforeSchoolYear = state.schoolYear

    const result = command(state)

    expect(result.state.profiles.p1.skills).toBe(beforeSkills)
    expect(result.state.profiles.p1.pacing).toBe(beforePacing)
    expect(result.state.schoolYear).toBe(beforeSchoolYear)
  })
})
