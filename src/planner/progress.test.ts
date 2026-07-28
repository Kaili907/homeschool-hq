import { describe, expect, it } from 'vitest'
import { defaultAppState, emptyProfile } from '../migration'
import { buildMissionDay, defaultTemplateFor } from '../missions'
import { defaultSchoolYear } from '../curriculum/pacing'
import { applyPlannerAction } from './actions'
import { reconcileMissionTimers } from './adapters/missionAdapter'
import { createManualPlannerBlock, defaultPlannerState } from './defaults'
import { deriveDailyPlan } from './engine'
import {
  pausePlannerProgress,
  progressTargetFor,
  startPlannerProgress,
} from './progress'
import type {
  DailyPlanBlock,
  PlannerBlock,
  ResumePointer,
} from './types'

const DAY = '2026-08-31'
const T0 = '2026-08-31T09:00:00.000Z'
const T5 = '2026-08-31T09:05:00.000Z'
const T10 = '2026-08-31T09:10:00.000Z'
const T12 = '2026-08-31T09:12:00.000Z'

function manual(id: string, profileId = 'p1', startTime = '09:00'): PlannerBlock {
  return createManualPlannerBlock(
    {
      title: id,
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

function daily(block: PlannerBlock, profileId = 'p1'): DailyPlanBlock {
  const profile = emptyProfile(profileId, profileId, '6')
  return deriveDailyPlan({
    templates: [block],
    overrides: [],
    student: profile,
    date: DAY,
    schoolYear: defaultSchoolYear(DAY),
    missionBlocks: [],
    curriculumBlocks: [],
    storedProgress: {},
    now: T0,
  }).blocks[0]
}

describe('planner progress transitions', () => {
  it('completes a manual planner block in progress storage', () => {
    const state = { ...defaultAppState(), planner: defaultPlannerState() }
    const block = daily(manual('chores'))
    const out = applyPlannerAction(state, block, 'complete', T10, {
      note: 'Kitchen finished',
    })
    const row = out.planner!.progress[block.instanceId]
    expect(row.status).toBe('completed')
    expect(row.completedAt).toBe(T10)
    expect(row.completionNote).toBe('Kitchen finished')
  })

  it('starts a second block by pausing the first in one atomic reducer call', () => {
    const first = daily(manual('first'))
    const second = daily(manual('second', 'p1', '09:30'))
    let planner = startPlannerProgress(defaultPlannerState(), progressTargetFor(first), T0)
    planner = startPlannerProgress(planner, progressTargetFor(second), T10)
    expect(planner.progress[first.instanceId]).toMatchObject({
      status: 'paused',
      activeElapsedSeconds: 600,
      lastPausedAt: T10,
    })
    expect(planner.progress[second.instanceId].status).toBe('in-progress')
    expect(
      Object.values(planner.progress).filter(
        (row) => row.profileId === 'p1' && row.status === 'in-progress',
      ),
    ).toHaveLength(1)
  })

  it('retains elapsed time and adapter resume data across pause and continue', () => {
    const block = daily(manual('lesson'))
    const firstPointer: ResumePointer = {
      activityId: 'lesson',
      lessonId: 'lesson-4',
      stepId: 'step-2',
      adapterData: { safePage: 4 },
      updatedAt: T5,
    }
    let planner = startPlannerProgress(defaultPlannerState(), progressTargetFor(block), T0)
    planner = pausePlannerProgress(planner, progressTargetFor(block), T5, firstPointer)
    planner = startPlannerProgress(planner, progressTargetFor(block), T10)
    planner = pausePlannerProgress(planner, progressTargetFor(block), T12)
    expect(planner.progress[block.instanceId].activeElapsedSeconds).toBe(7 * 60)
    expect(planner.progress[block.instanceId].resumePointer).toEqual(firstPointer)
    expect(planner.progress[block.instanceId].startedAt).toBe(T0)
  })

  it('does not pause a different student when another student starts work', () => {
    const p1 = daily(manual('p1-work', 'p1'), 'p1')
    const p2 = daily(manual('p2-work', 'p2'), 'p2')
    let planner = startPlannerProgress(defaultPlannerState(), progressTargetFor(p1), T0)
    planner = startPlannerProgress(planner, progressTargetFor(p2), T5)
    expect(planner.progress[p1.instanceId].status).toBe('in-progress')
    expect(planner.progress[p2.instanceId].status).toBe('in-progress')
  })
})

describe('source boundaries', () => {
  function missionDaily(autoOnly: boolean): {
    state: ReturnType<typeof defaultAppState>
    block: DailyPlanBlock
  } {
    const profile = emptyProfile('p1', 'Kid', '3')
    const day = buildMissionDay(defaultTemplateFor('3'), DAY)
    const item = autoOnly
      ? day.items.find((candidate) => candidate.auto)!
      : day.items.find((candidate) => !candidate.auto)!
    profile.missions[DAY] = { items: [item] }
    const missionBlock: PlannerBlock = {
      id: `mission:${item.id}`,
      title: item.label,
      description: 'Mission',
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: item.id,
        autoOnly,
        ...(item.autoKind ? { autoKind: item.autoKind } : {}),
      },
      assignedProfileIds: ['p1'],
      assignToAll: false,
      weekdays: [1],
      startTime: '09:00',
      expectedMinutes: 20,
      scheduleBehavior: 'flexible',
      requiresParentHelp: false,
      active: true,
      createdAt: T0,
      updatedAt: T0,
    }
    const block = deriveDailyPlan({
      templates: [],
      overrides: [],
      student: profile,
      date: DAY,
      schoolYear: defaultSchoolYear(DAY),
      missionDay: profile.missions[DAY],
      missionBlocks: [missionBlock],
      curriculumBlocks: [],
      storedProgress: {},
      now: T0,
    }).blocks[0]
    const state = defaultAppState()
    state.profiles.p1 = profile
    state.planner = defaultPlannerState()
    return { state, block }
  }

  it('updates the established mission record for an eligible manual mission', () => {
    const { state, block } = missionDaily(false)
    const out = applyPlannerAction(state, block, 'complete', T5)
    const source = block.block.source
    if (source.kind !== 'mission') throw new Error('fixture is not a mission')
    expect(
      out.profiles.p1.missions[DAY].items.find(
        (item) => item.id === source.missionItemId,
      )?.done,
    ).toBe(true)
  })

  it('does not allow an auto-only mission item to be manually bypassed', () => {
    const { state, block } = missionDaily(true)
    expect(applyPlannerAction(state, block, 'complete', T5)).toBe(state)
    expect(applyPlannerAction(state, block, 'excuse', T5)).toBe(state)
    expect(state.planner!.progress).toEqual({})
  })

  it('closes an active planner timer when its mission source auto-completes', () => {
    const { state, block } = missionDaily(true)
    let started = applyPlannerAction(state, block, 'start', T0)
    const source = block.block.source
    if (source.kind !== 'mission') throw new Error('fixture is not a mission')
    started.profiles.p1.missions[DAY].items = started.profiles.p1.missions[
      DAY
    ].items.map((item) =>
      item.id === source.missionItemId ? { ...item, done: true } : item,
    )
    const reconciled = reconcileMissionTimers(started, 'p1', DAY, T5)
    expect(reconciled.planner!.progress[block.instanceId]).toMatchObject({
      status: 'completed',
      activeElapsedSeconds: 300,
      completedAt: T5,
    })
  })

  it('never changes mastery when a curriculum/planner block is completed', () => {
    const state = defaultAppState()
    state.planner = defaultPlannerState()
    state.profiles.p1.skills.mult = { attempts: 4, correct: 3, mastery: 72 }
    const before = JSON.parse(JSON.stringify(state.profiles.p1.skills))
    const block = daily(
      manual('academy').source.kind === 'manual'
        ? {
            ...manual('academy'),
            category: 'manuel-academy',
            source: {
              kind: 'curriculum',
              subjectId: 'math',
              subjectLabel: 'Math',
              week: 1,
              items: [{ id: 'lesson', text: 'Lesson', dadTaught: false }],
            },
          }
        : manual('academy'),
    )
    const out = applyPlannerAction(state, block, 'complete', T10)
    expect(out.profiles.p1.skills).toEqual(before)
    expect(out.profiles.p1).toBe(state.profiles.p1)
  })
})
