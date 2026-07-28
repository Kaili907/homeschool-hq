import { describe, expect, it } from 'vitest'
import { defaultAppState, emptyProfile } from '../../migration'
import type { MissionDay } from '../../types'
import { defaultPlannerState, readPlannerState } from '../defaults'
import { plannerBlockInstanceId } from '../resume'
import {
  missionBlocksForDay,
  reconcileMissionTimers,
} from './missionAdapter'

const DAY = '2026-08-31'
const T0 = '2026-08-31T09:00:00.000Z'
const T5 = '2026-08-31T09:05:00.000Z'
const T10 = '2026-08-31T09:10:00.000Z'

const doneAutoDay = (): MissionDay => ({
  items: [
    {
      id: 'math-source',
      label: 'Math source',
      done: true,
      auto: true,
      autoKind: 'math',
    },
  ],
})

const plannerOf = (state: ReturnType<typeof defaultAppState>) => {
  const result = readPlannerState(state.planner)
  if (result.kind !== 'supported') throw new Error('expected supported planner')
  return result.state
}

describe('mission adapter authority', () => {
  it('generates deterministic source IDs without duplicating a repeated item', () => {
    const profile = emptyProfile('p1', 'Kid', '3')
    const day: MissionDay = {
      items: [
        { id: 'manual', label: 'Read', done: false },
        { id: 'manual', label: 'Repeated source row', done: true },
      ],
    }

    const first = missionBlocksForDay(profile, DAY, day)
    const second = missionBlocksForDay(profile, DAY, day)

    expect(first).toHaveLength(1)
    expect(first[0].id).toBe('mission:manual')
    expect(first[0].source).toMatchObject({
      kind: 'mission',
      missionItemId: 'manual',
      autoOnly: false,
    })
    expect(first[0].studentInstructions).toBe('Existing daily mission item.')
    expect(second).toEqual(first)
  })

  it('settles an active timer as paused timing without persisted completion', () => {
    const state = defaultAppState()
    state.profiles.p1 = {
      ...emptyProfile('p1', 'Kid', '3'),
      missions: { [DAY]: doneAutoDay() },
    }
    const blockId = 'mission:math-source'
    const instanceId = plannerBlockInstanceId('p1', DAY, blockId)
    state.planner = {
      ...defaultPlannerState(),
      progress: {
        [instanceId]: {
          profileId: 'p1',
          date: DAY,
          blockInstanceId: instanceId,
          blockId,
          status: 'in-progress',
          completionAuthority: 'mission',
          startedAt: T0,
          activeSince: T0,
          activeElapsedSeconds: 60,
          updatedAt: T0,
        },
      },
    }

    const reconciled = reconcileMissionTimers(state, 'p1', DAY, T5)
    const row = plannerOf(reconciled).progress[instanceId]

    expect(row).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 360,
      lastPausedAt: T5,
      updatedAt: T5,
    })
    expect(row.activeSince).toBeUndefined()
    expect(row.completedAt).toBeUndefined()
    expect(row.terminalAt).toBeUndefined()
  })

  it('repeated reconciliation cannot add the live segment twice', () => {
    const state = defaultAppState()
    state.profiles.p1 = {
      ...emptyProfile('p1', 'Kid', '3'),
      missions: { [DAY]: doneAutoDay() },
    }
    const blockId = 'mission:math-source'
    const instanceId = plannerBlockInstanceId('p1', DAY, blockId)
    state.planner = {
      ...defaultPlannerState(),
      progress: {
        [instanceId]: {
          profileId: 'p1',
          date: DAY,
          blockInstanceId: instanceId,
          blockId,
          status: 'in-progress',
          completionAuthority: 'mission',
          activeSince: T0,
          activeElapsedSeconds: 0,
          updatedAt: T0,
        },
      },
    }

    const once = reconcileMissionTimers(state, 'p1', DAY, T5)
    const twice = reconcileMissionTimers(once, 'p1', DAY, T10)

    expect(plannerOf(twice).progress[instanceId]).toEqual(
      plannerOf(once).progress[instanceId],
    )
    expect(plannerOf(twice).progress[instanceId].activeElapsedSeconds).toBe(300)
  })

  it('does not create planner completion when a done source has no timer row', () => {
    const state = defaultAppState()
    state.profiles.p1 = {
      ...emptyProfile('p1', 'Kid', '3'),
      missions: { [DAY]: doneAutoDay() },
    }
    state.planner = defaultPlannerState()

    const reconciled = reconcileMissionTimers(state, 'p1', DAY, T5)

    expect(plannerOf(reconciled).progress).toEqual({})
  })

  it('retags already-paused source timing as mission-owned without changing time', () => {
    const state = defaultAppState()
    state.profiles.p1 = {
      ...emptyProfile('p1', 'Kid', '3'),
      missions: { [DAY]: doneAutoDay() },
    }
    const blockId = 'mission:math-source'
    const instanceId = plannerBlockInstanceId('p1', DAY, blockId)
    state.planner = {
      ...defaultPlannerState(),
      progress: {
        [instanceId]: {
          profileId: 'p1',
          date: DAY,
          blockInstanceId: instanceId,
          blockId,
          status: 'paused',
          completionAuthority: 'planner',
          activeElapsedSeconds: 180,
          lastPausedAt: T5,
          updatedAt: T5,
        },
      },
    }

    const reconciled = reconcileMissionTimers(state, 'p1', DAY, T10)
    const row = plannerOf(reconciled).progress[instanceId]

    expect(row).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 180,
      lastPausedAt: T5,
      updatedAt: T5,
    })
    expect(reconcileMissionTimers(reconciled, 'p1', DAY, T10)).toBe(reconciled)
  })

  it('removed or replaced source IDs do not settle an unrelated timing row', () => {
    const state = defaultAppState()
    state.profiles.p1 = {
      ...emptyProfile('p1', 'Kid', '3'),
      missions: {
        [DAY]: {
          items: [
            {
              id: 'replacement-source',
              label: 'Renamed with a new ID',
              done: true,
            },
          ],
        },
      },
    }
    const oldBlockId = 'mission:removed-source'
    const oldInstanceId = plannerBlockInstanceId('p1', DAY, oldBlockId)
    state.planner = {
      ...defaultPlannerState(),
      progress: {
        [oldInstanceId]: {
          profileId: 'p1',
          date: DAY,
          blockInstanceId: oldInstanceId,
          blockId: oldBlockId,
          status: 'paused',
          completionAuthority: 'mission',
          activeElapsedSeconds: 120,
          lastPausedAt: T0,
          updatedAt: T0,
        },
      },
    }

    const reconciled = reconcileMissionTimers(state, 'p1', DAY, T5)

    expect(plannerOf(reconciled).progress[oldInstanceId]).toEqual(
      plannerOf(state).progress[oldInstanceId],
    )
  })
})
