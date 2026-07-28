import { describe, expect, it } from 'vitest'
import { getAttendance } from '../attendance/attendance'
import { defaultSchoolYear } from '../curriculum/pacing'
import { defaultAppState, emptyProfile } from '../migration'
import { getStars } from '../stars/stars'
import type { AppState, MissionDay } from '../types'
import { applyPlannerCommand } from './actions'
import {
  createManualPlannerBlock,
  defaultPlannerState,
  readPlannerState,
} from './defaults'
import { calculateDailyProgress } from './progress'
import { plannerBlockInstanceId } from './resume'
import { selectDailyPlan } from './selectors'
import type {
  DailyPlanBlock,
  PlannerAction,
  PlannerBlock,
  PlannerState,
} from './types'

const DAY = '2026-08-31'
const T0 = '2026-08-31T09:00:00.000Z'
const T5 = '2026-08-31T09:05:00.000Z'
const T10 = '2026-08-31T09:10:00.000Z'
const SCHOOL_YEAR = defaultSchoolYear(DAY)

function manual(
  id: string,
  profileId = 'p1',
  startTime = '09:00',
): PlannerBlock {
  return createManualPlannerBlock(
    {
      title: id,
      studentInstructions: `Complete ${id}.`,
      category: 'custom',
      assignedProfileIds: [profileId],
      weekdays: [1],
      startTime,
      expectedMinutes: 30,
      scheduleBehavior: 'flexible',
    },
    T0,
    id,
  )
}

function stateWithBlocks(blocks: PlannerBlock[]): AppState {
  const state = defaultAppState()
  state.profiles.p1 = emptyProfile('p1', 'First', '6')
  state.profiles.p2 = emptyProfile('p2', 'Second', '6')
  state.planner = { ...defaultPlannerState(), blocks }
  return state
}

function planRow(
  state: AppState,
  profileId: string,
  blockId: string,
  now = T0,
): DailyPlanBlock {
  const row = selectDailyPlan({
    state,
    profileId,
    date: DAY,
    currentLocalDate: DAY,
    docs: [],
    now,
    schoolYear: SCHOOL_YEAR,
  }).blocks.find((item) => item.block.id === blockId)
  if (!row) throw new Error(`missing planner row ${blockId}`)
  return row
}

function apply(
  state: AppState,
  row: DailyPlanBlock,
  action: PlannerAction,
  now: string,
): ReturnType<typeof applyPlannerCommand> {
  return applyPlannerCommand(
    state,
    {
      actor: { kind: 'parent' },
      action,
      target: {
        profileId: row.profileId,
        date: row.date,
        blockId: row.block.id,
        blockInstanceId: row.instanceId,
      },
    },
    {
      now,
      currentLocalDate: DAY,
      docs: [],
      schoolYear: SCHOOL_YEAR,
    },
  )
}

function plannerOf(state: AppState): PlannerState {
  const read = readPlannerState(state.planner)
  if (read.kind !== 'supported') throw new Error('expected supported planner')
  return read.state
}

describe('integrated planner progress commands', () => {
  it('excludes unfinished unavailable rows without hiding recorded active time', () => {
    const availableBlock = manual('available')
    const unavailableBlock = manual('unavailable', 'p1', '10:00')
    const state = stateWithBlocks([availableBlock, unavailableBlock])
    const completed = {
      ...planRow(state, 'p1', availableBlock.id),
      progress: {
        ...planRow(state, 'p1', availableBlock.id).progress,
        status: 'completed' as const,
        completedAt: T10,
        terminalAt: T10,
      },
    }
    const unavailable = {
      ...planRow(state, 'p1', unavailableBlock.id),
      placement: {
        kind: 'unavailable' as const,
        reason: 'missing-source' as const,
        message: 'Source unavailable.',
      },
      progress: {
        ...planRow(state, 'p1', unavailableBlock.id).progress,
        status: 'paused' as const,
        activeElapsedSeconds: 600,
        lastPausedAt: T10,
      },
      unavailableReason: 'Source unavailable.',
    }

    expect(calculateDailyProgress([completed, unavailable], T10)).toEqual({
      plannedMinutes: 30,
      plannedMinutesRemaining: 0,
      activeMinutes: 10,
      completedCount: 1,
      remainingCount: 0,
      eligibleCount: 1,
      completionPercentage: 100,
    })
  })

  it('completes a current manual block without changing academic or reward domains', () => {
    const block = manual('chores')
    const state = stateWithBlocks([block])
    state.profiles.p1.skills.mult = {
      attempts: 4,
      correct: 3,
      mastery: 72,
    }
    state.profiles.p1.pacing = {
      pointers: { math: 3 },
      nudges: [
        {
          at: T0,
          subjectId: 'math',
          from: 4,
          to: 3,
          reason: 'Keep current pacing',
        },
      ],
    }
    const beforeProfile = state.profiles.p1
    const beforeAssessments = beforeProfile.assessments
    const beforeAttendance = getAttendance(beforeProfile)
    const beforeStars = getStars(beforeProfile)

    const result = apply(state, planRow(state, 'p1', block.id), 'complete', T10)
    const stored =
      plannerOf(result.state).progress[
        plannerBlockInstanceId('p1', DAY, block.id)
      ]

    expect(result.outcome).toMatchObject({
      kind: 'applied',
      from: 'not-started',
      to: 'completed',
    })
    expect(stored).toMatchObject({
      status: 'completed',
      completedAt: T10,
      terminalAt: T10,
    })
    expect(result.state.profiles.p1).toBe(beforeProfile)
    expect(result.state.profiles.p1.assessments).toBe(beforeAssessments)
    expect(getAttendance(result.state.profiles.p1)).toEqual(beforeAttendance)
    expect(getStars(result.state.profiles.p1)).toEqual(beforeStars)
  })

  it('starts a second block and pauses the first in one current-state update', () => {
    const first = manual('first')
    const second = manual('second', 'p1', '09:30')
    let state = stateWithBlocks([first, second])

    state = apply(state, planRow(state, 'p1', first.id), 'start', T0).state
    state = apply(
      state,
      planRow(state, 'p1', second.id, T10),
      'start',
      T10,
    ).state
    const planner = plannerOf(state)
    const firstProgress =
      planner.progress[plannerBlockInstanceId('p1', DAY, first.id)]
    const secondProgress =
      planner.progress[plannerBlockInstanceId('p1', DAY, second.id)]

    expect(firstProgress).toMatchObject({
      status: 'paused',
      activeElapsedSeconds: 600,
      lastPausedAt: T10,
    })
    expect(secondProgress.status).toBe('in-progress')
    expect(
      Object.values(planner.progress).filter(
        (row) => row.profileId === 'p1' && row.status === 'in-progress',
      ),
    ).toHaveLength(1)
  })

  it('keeps start, pause, and resume elapsed time idempotent', () => {
    const block = manual('lesson')
    let state = stateWithBlocks([block])
    let row = planRow(state, 'p1', block.id)

    state = apply(state, row, 'start', T0).state
    state = apply(state, planRow(state, 'p1', block.id, T5), 'start', T5).state
    state = apply(state, planRow(state, 'p1', block.id, T5), 'pause', T5).state
    state = apply(state, planRow(state, 'p1', block.id, T10), 'pause', T10).state
    state = apply(state, planRow(state, 'p1', block.id, T10), 'resume', T10).state
    state = apply(state, planRow(state, 'p1', block.id, T10), 'resume', T10).state

    row = planRow(state, 'p1', block.id, T10)
    expect(row.progress).toMatchObject({
      status: 'in-progress',
      startedAt: T0,
      activeSince: T10,
      activeElapsedSeconds: 300,
    })
  })

  it('isolates active progress by profile', () => {
    const first = manual('shared', 'p1')
    first.assignToAll = true
    let state = stateWithBlocks([first])
    const p1 = planRow(state, 'p1', first.id)
    state = apply(state, p1, 'start', T0).state
    const p2 = planRow(state, 'p2', first.id, T5)
    state = apply(state, p2, 'start', T5).state

    expect(
      plannerOf(state).progress[plannerBlockInstanceId('p1', DAY, first.id)]
        .status,
    ).toBe('in-progress')
    expect(
      plannerOf(state).progress[plannerBlockInstanceId('p2', DAY, first.id)]
        .status,
    ).toBe('in-progress')
  })
})

describe('mission completion authority through planner commands', () => {
  const missionDay = (auto = false): MissionDay => ({
    items: [
      {
        id: 'mission-source',
        label: 'Source-owned work',
        done: false,
        ...(auto ? { auto: true, autoKind: 'math' as const } : {}),
      },
    ],
  })

  function missionState(auto = false): AppState {
    const state = stateWithBlocks([])
    state.profiles.p1.missions[DAY] = missionDay(auto)
    return state
  }

  it('writes manual completion only to Profile.missions, not a planner completion mirror', () => {
    const state = missionState()
    const row = planRow(state, 'p1', 'mission:mission-source')
    const result = apply(state, row, 'complete', T5)
    const stored =
      plannerOf(result.state).progress[row.instanceId]

    expect(result.outcome.kind).toBe('applied')
    expect(
      result.state.profiles.p1.missions[DAY].items[0].done,
    ).toBe(true)
    expect(stored?.status).not.toBe('completed')
    expect(stored?.completedAt).toBeUndefined()
  })

  it('rejects an auto-only completion even when a caller fabricates the command', () => {
    const state = missionState(true)
    const row = planRow(state, 'p1', 'mission:mission-source')
    const result = apply(state, row, 'complete', T5)

    expect(result.state).toBe(state)
    expect(result.outcome).toMatchObject({
      kind: 'rejected',
      reason: 'permission-denied',
    })
    expect(state.profiles.p1.missions[DAY].items[0].done).toBe(false)
    expect(plannerOf(state).progress).toEqual({})
  })
})
