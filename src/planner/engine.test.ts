import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import { defaultSchoolYear } from '../curriculum/pacing'
import { createManualPlannerBlock } from './defaults'
import { deriveDailyPlan } from './engine'
import { plannerBlockInstanceId } from './resume'
import type { PlannerBlock, PlannerDateOverride, PlannerProgress } from './types'

const MON = '2026-08-31'
const TUE = '2026-09-01'
const NOW = '2026-08-31T15:00:00.000Z'
const student = emptyProfile('p1', 'Kid', '6')
const schoolYear = defaultSchoolYear(MON)

function block(
  id: string,
  startTime = '09:00',
  expectedMinutes = 30,
  over: Partial<PlannerBlock> = {},
): PlannerBlock {
  return {
    ...createManualPlannerBlock(
      {
        title: id,
        category: 'custom',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime,
        expectedMinutes,
        scheduleBehavior: 'flexible',
      },
      NOW,
      id,
    ),
    ...over,
  }
}

function plan(
  templates: PlannerBlock[],
  over: Partial<Parameters<typeof deriveDailyPlan>[0]> = {},
) {
  return deriveDailyPlan({
    templates,
    overrides: [],
    student,
    date: MON,
    schoolYear,
    missionBlocks: [],
    curriculumBlocks: [],
    storedProgress: {},
    now: NOW,
    ...over,
  })
}

describe('daily planner selection and overrides', () => {
  it('shows repeating activities only on selected weekdays', () => {
    const recurring = block('mon-only')
    expect(plan([recurring]).blocks).toHaveLength(1)
    expect(plan([recurring], { date: TUE }).blocks).toHaveLength(0)
  })

  it('applies date-specific additions, removals, and changes', () => {
    const original = block('original', '09:00')
    const addition = block('date-addition', '10:00', 15, { weekdays: [5] })
    const base = {
      date: MON,
      profileIds: ['p1'],
      createdAt: NOW,
      updatedAt: NOW,
    }
    const overrides: PlannerDateOverride[] = [
      { ...base, id: 'remove', action: 'remove', targetBlockId: original.id },
      { ...base, id: 'add', action: 'add', block: addition },
      {
        ...base,
        id: 'change',
        action: 'change',
        targetBlockId: addition.id,
        changes: { title: 'Special appointment', scheduleBehavior: 'fixed' },
      },
    ]
    const derived = plan([original], { overrides })
    expect(derived.blocks.map((row) => row.block.title)).toEqual(['Special appointment'])
    expect(derived.blocks[0].block.scheduleBehavior).toBe('fixed')
  })
})

describe('schedule behavior and stable identities', () => {
  it('keeps a fixed block at its scheduled start after earlier work runs long', () => {
    const early = block('early', '09:00', 30)
    const fixed = block('practice', '09:30', 60, { scheduleBehavior: 'fixed' })
    const earlyId = plannerBlockInstanceId('p1', MON, early.id)
    const progress: Record<string, PlannerProgress> = {
      [earlyId]: {
        profileId: 'p1',
        date: MON,
        blockInstanceId: earlyId,
        blockId: early.id,
        status: 'completed',
        activeElapsedSeconds: 45 * 60,
        completedAt: NOW,
        updatedAt: NOW,
      },
    }
    const derived = plan([early, fixed], { storedProgress: progress })
    const fixedRow = derived.blocks.find((row) => row.block.id === fixed.id)!
    expect(fixedRow.scheduledStartTime).toBe('09:30')
    expect(fixedRow.effectiveStartTime).toBe('09:30')
  })

  it('shifts a later unfinished flexible block when earlier work runs long', () => {
    const early = block('early', '09:00', 30)
    const later = block('later', '09:30', 30)
    const earlyId = plannerBlockInstanceId('p1', MON, early.id)
    const progress: Record<string, PlannerProgress> = {
      [earlyId]: {
        profileId: 'p1',
        date: MON,
        blockInstanceId: earlyId,
        blockId: early.id,
        status: 'completed',
        activeElapsedSeconds: 45 * 60,
        completedAt: NOW,
        updatedAt: NOW,
      },
    }
    const derived = plan([early, later], { storedProgress: progress })
    expect(derived.blocks.find((row) => row.block.id === later.id)?.effectiveStartTime).toBe(
      '09:45',
    )
  })

  it('uses stable block-instance IDs across renders and clock changes', () => {
    const recurring = block('stable')
    const first = plan([recurring], { now: '2026-08-31T12:00:00.000Z' })
    const second = plan([recurring], { now: '2026-08-31T18:00:00.000Z' })
    expect(first.blocks[0].instanceId).toBe(second.blocks[0].instanceId)
    expect(first.blocks[0].instanceId).toBe(plannerBlockInstanceId('p1', MON, 'stable'))
  })
})

describe('daily progress math', () => {
  it('excludes excused rows, keeps skipped rows incomplete, and calculates percentage', () => {
    const completed = block('completed', '09:00')
    const excused = block('excused', '10:00')
    const skipped = block('skipped', '11:00')
    const records: Record<string, PlannerProgress> = {}
    for (const [item, status] of [
      [completed, 'completed'],
      [excused, 'excused'],
      [skipped, 'skipped'],
    ] as const) {
      const id = plannerBlockInstanceId('p1', MON, item.id)
      records[id] = {
        profileId: 'p1',
        date: MON,
        blockInstanceId: id,
        blockId: item.id,
        status,
        activeElapsedSeconds: status === 'completed' ? 900 : 0,
        updatedAt: NOW,
      }
    }
    const summary = plan([completed, excused, skipped], { storedProgress: records }).summary
    expect(summary.eligibleCount).toBe(2)
    expect(summary.completedCount).toBe(1)
    expect(summary.remainingCount).toBe(1)
    expect(summary.completionPercentage).toBe(50)
    expect(summary.plannedMinutesRemaining).toBe(30)
    expect(summary.activeMinutes).toBe(15)
  })
})
