import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import { defaultSchoolYear } from '../curriculum/pacing'
import { createManualPlannerBlock } from './defaults'
import {
  deriveDailyPlan,
  formatDayMinute,
  plannerSourceIdentity,
} from './engine'
import { snapshotForDailyPlanBlock } from './occurrence'
import { plannerBlockInstanceId } from './resume'
import type {
  PlannerBlock,
  PlannerDateOverride,
  PlannerProgress,
} from './types'

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
        studentInstructions: `${id} instructions`,
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
    currentLocalDate: MON,
    ...over,
  })
}

function progressFor(
  item: PlannerBlock,
  status: PlannerProgress['status'],
  over: Partial<PlannerProgress> = {},
): PlannerProgress {
  const instanceId = plannerBlockInstanceId('p1', MON, item.id)
  return {
    profileId: 'p1',
    date: MON,
    blockInstanceId: instanceId,
    blockId: item.id,
    status,
    activeElapsedSeconds: 0,
    updatedAt: NOW,
    ...over,
  }
}

describe('daily planner selection, identities, and overrides', () => {
  it('shows repeating activities only on selected weekdays', () => {
    const recurring = block('mon-only')
    expect(plan([recurring]).blocks).toHaveLength(1)
    expect(plan([recurring], { date: TUE }).blocks).toHaveLength(0)
  })

  it('applies date additions outside recurrence and deterministic changes', () => {
    const original = block('original', '09:00')
    const addition = block('date-addition', '10:00', 15, {
      weekdays: [5],
    })
    const base = {
      date: MON,
      profileIds: ['p1'],
      createdAt: NOW,
    }
    const overrides: PlannerDateOverride[] = [
      {
        ...base,
        updatedAt: '2026-08-31T10:02:00.000Z',
        id: 'last-title',
        action: 'change',
        targetBlockId: addition.id,
        changes: { title: 'Final title' },
      },
      {
        ...base,
        updatedAt: '2026-08-31T10:00:00.000Z',
        id: 'add',
        action: 'add',
        block: addition,
      },
      {
        ...base,
        updatedAt: '2026-08-31T10:01:00.000Z',
        id: 'fixed',
        action: 'change',
        targetBlockId: addition.id,
        changes: { scheduleBehavior: 'fixed', startTime: '12:00' },
      },
      {
        ...base,
        updatedAt: '2026-08-31T10:03:00.000Z',
        id: 'remove',
        action: 'remove',
        targetBlockId: original.id,
      },
    ]
    const first = plan([original], { overrides })
    const second = plan([original], { overrides: [...overrides].reverse() })
    expect(first.blocks.map((row) => row.block.title)).toEqual([
      'Final title',
    ])
    expect(first.blocks[0]).toMatchObject({
      scheduledStartTime: '12:00',
      effectiveStartTime: '12:00',
      block: { scheduleBehavior: 'fixed' },
    })
    expect(second.blocks).toEqual(first.blocks)
  })

  it('lets a remove override win without deleting snapshot history', () => {
    const original = block('original')
    const initial = plan([original]).blocks[0]
    const completed = progressFor(original, 'completed', {
      completedAt: NOW,
      terminalAt: NOW,
      occurrence: snapshotForDailyPlanBlock(initial, NOW),
    })
    const override: PlannerDateOverride = {
      id: 'remove',
      date: MON,
      action: 'remove',
      targetBlockId: original.id,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const derived = plan([original], {
      overrides: [override],
      storedProgress: { [completed.blockInstanceId]: completed },
    })
    expect(derived.blocks).toHaveLength(1)
    expect(derived.blocks[0].progress.status).toBe('completed')
    expect(derived.blocks[0]).toMatchObject({
      canStart: false,
      canSetDisposition: false,
      unavailableReason:
        'The linked source activity is no longer available.',
    })
  })

  it('makes override-removed curriculum history read-only', () => {
    const curriculum = block('curriculum:science:week-1', '09:00', 30, {
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'science',
        subjectLabel: 'Science',
        week: 1,
        items: [{ id: 'lesson', text: 'Lesson', dadTaught: false }],
      },
    })
    const initial = plan([], { curriculumBlocks: [curriculum] }).blocks[0]
    const completed = progressFor(curriculum, 'completed', {
      completedAt: NOW,
      terminalAt: NOW,
      occurrence: snapshotForDailyPlanBlock(initial, NOW),
    })
    const override: PlannerDateOverride = {
      id: 'remove-curriculum',
      date: MON,
      action: 'remove',
      targetBlockId: curriculum.id,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const history = plan([], {
      curriculumBlocks: [curriculum],
      overrides: [override],
      storedProgress: { [completed.blockInstanceId]: completed },
    })
    expect(history.blocks).toHaveLength(1)
    expect(history.blocks[0]).toMatchObject({
      progress: { status: 'completed' },
      canStart: false,
      canSetDisposition: false,
      unavailableReason:
        'The linked source activity is no longer available.',
    })
  })

  it('makes override-removed mission timing history read-only', () => {
    const mission = block('mission:reading', '09:00', 20, {
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: 'reading',
        autoOnly: false,
      },
    })
    const missionDay = {
      items: [{ id: 'reading', label: 'Read', done: false }],
    }
    const initial = plan([], {
      missionBlocks: [mission],
      missionDay,
    }).blocks[0]
    const paused = progressFor(mission, 'paused', {
      startedAt: NOW,
      lastPausedAt: NOW,
      occurrence: snapshotForDailyPlanBlock(initial, NOW),
    })
    const override: PlannerDateOverride = {
      id: 'remove-mission',
      date: MON,
      action: 'remove',
      targetBlockId: mission.id,
      createdAt: NOW,
      updatedAt: NOW,
    }
    const history = plan([], {
      missionBlocks: [mission],
      missionDay,
      overrides: [override],
      storedProgress: { [paused.blockInstanceId]: paused },
    })
    expect(history.blocks).toHaveLength(1)
    expect(history.blocks[0]).toMatchObject({
      progress: { status: 'paused' },
      canStart: false,
      canManuallyComplete: false,
      canSetDisposition: false,
      unavailableReason:
        'The linked source activity is no longer available.',
    })
  })

  it('deduplicates generated source identities deterministically', () => {
    const curriculum = block('curriculum-a', '09:00', 30, {
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'science',
        subjectLabel: 'Science',
        week: 2,
        items: [
          { id: 'b', text: 'B', dadTaught: false },
          { id: 'a', text: 'A', dadTaught: false },
        ],
      },
    })
    const duplicate = {
      ...curriculum,
      id: 'curriculum-b',
      source: {
        ...curriculum.source,
        items:
          curriculum.source.kind === 'curriculum'
            ? [...curriculum.source.items].reverse()
            : [],
      },
    } as PlannerBlock
    expect(plannerSourceIdentity(curriculum)).toBe(
      plannerSourceIdentity(duplicate),
    )
    expect(
      plan([], {
        curriculumBlocks: [curriculum, duplicate],
      }).blocks,
    ).toHaveLength(1)
  })

  it('does not let a persisted curriculum link self-authenticate as generated work', () => {
    const spoof = block('persisted-curriculum-link', '09:00', 30, {
      title: 'Typed system-looking work',
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'science',
        subjectLabel: 'Science',
        week: 2,
        items: [{ id: 'lesson', text: 'Lesson', dadTaught: false }],
      },
      linkedActivity: {
        adapter: 'curriculum',
        activityId: 'science',
        route: 'course-detail',
      },
    })
    const derived = plan([spoof])
    expect(derived.blocks).toHaveLength(1)
    expect(derived.blocks[0]).toMatchObject({
      block: { id: spoof.id, title: 'Typed system-looking work' },
      generated: false,
      canStart: false,
      canManuallyComplete: false,
      unavailableReason:
        'The linked source activity is no longer available.',
    })
    expect(derived.notices).toEqual([
      expect.objectContaining({
        reason: 'missing-source',
        title: 'Typed system-looking work',
      }),
    ])
  })

  it('prefers matching adapter rows over persisted system-linked templates', () => {
    const persisted = block('persisted-science', '08:00', 15, {
      title: 'Stale persisted title',
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'science',
        subjectLabel: 'Old Science',
        week: 2,
        items: [{ id: 'lesson', text: 'Old lesson', dadTaught: false }],
      },
      linkedActivity: {
        adapter: 'curriculum',
        activityId: 'stale-route',
        route: 'stale-route',
      },
    })
    const adapter = block('curriculum:science:week-2', '10:00', 40, {
      title: 'Authoritative science',
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'science',
        subjectLabel: 'Science',
        week: 2,
        items: [{ id: 'lesson', text: 'Current lesson', dadTaught: false }],
      },
      linkedActivity: {
        adapter: 'curriculum',
        activityId: 'science',
        route: 'course-detail',
      },
    })
    const derived = plan([persisted], { curriculumBlocks: [adapter] })
    expect(derived.blocks).toHaveLength(1)
    expect(derived.blocks[0]).toMatchObject({
      block: {
        id: adapter.id,
        title: adapter.title,
        linkedActivity: adapter.linkedActivity,
      },
      generated: true,
      canStart: true,
    })
  })

  it('uses current mission adapter authority over a stale auto-only snapshot', () => {
    const id = 'mission:typing'
    const spoof = block(id, '09:00', 20, {
      title: 'Stale manual-looking mission',
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: 'typing',
        autoOnly: false,
      },
      linkedActivity: {
        adapter: 'mission',
        activityId: 'custom',
      },
    })
    const adapter = block(id, '09:00', 20, {
      title: 'Typing mission',
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: 'typing',
        autoOnly: true,
        autoKind: 'typing',
      },
      linkedActivity: {
        adapter: 'mission',
        activityId: 'typing',
      },
    })
    const missionDay = {
      items: [
        {
          id: 'typing',
          label: 'Typing mission',
          done: false,
          auto: true,
          autoKind: 'typing' as const,
        },
      ],
    }
    const staleRow = plan([spoof], { missionDay }).blocks[0]
    const staleProgress = progressFor(spoof, 'paused', {
      startedAt: '2026-08-31T14:00:00.000Z',
      lastPausedAt: '2026-08-31T14:05:00.000Z',
      occurrence: snapshotForDailyPlanBlock(staleRow, NOW),
    })
    const derived = plan([spoof], {
      missionBlocks: [adapter],
      missionDay,
      storedProgress: {
        [staleProgress.blockInstanceId]: staleProgress,
      },
    })
    expect(derived.blocks).toHaveLength(1)
    expect(derived.blocks[0]).toMatchObject({
      block: {
        source: {
          kind: 'mission',
          missionItemId: 'typing',
          autoOnly: true,
          autoKind: 'typing',
        },
        linkedActivity: {
          adapter: 'mission',
          activityId: 'typing',
        },
      },
      generated: true,
      canManuallyComplete: false,
      canStart: true,
    })
  })
})

describe('interval-aware scheduling', () => {
  it('moves a long flexible block after a fixed event instead of overlapping it', () => {
    const flexible = block('long-work', '09:00', 90)
    const fixed = block('appointment', '10:00', 60, {
      scheduleBehavior: 'fixed',
    })
    const derived = plan([flexible, fixed])
    expect(
      derived.blocks.find((row) => row.block.id === fixed.id),
    ).toMatchObject({
      effectiveStartTime: '10:00',
      placement: { kind: 'scheduled', startMinute: 600, endMinute: 660 },
    })
    expect(
      derived.blocks.find((row) => row.block.id === flexible.id),
    ).toMatchObject({
      effectiveStartTime: '11:00',
      placement: { kind: 'scheduled', startMinute: 660, endMinute: 750 },
    })
  })

  it('places flexible work into exact gaps between several fixed events', () => {
    const fixed1 = block('fixed-1', '09:30', 30, {
      scheduleBehavior: 'fixed',
    })
    const fixed2 = block('fixed-2', '11:00', 60, {
      scheduleBehavior: 'fixed',
    })
    const first = block('flex-1', '09:00', 60)
    const second = block('flex-2', '09:05', 60)
    const derived = plan([first, second, fixed1, fixed2])
    expect(
      derived.blocks.find((row) => row.block.id === first.id)
        ?.effectiveStartTime,
    ).toBe('10:00')
    expect(
      derived.blocks.find((row) => row.block.id === second.id)
        ?.effectiveStartTime,
    ).toBe('12:00')
  })

  it('keeps every fixed event fixed and labels fixed-fixed conflicts', () => {
    const first = block('fixed-1', '09:00', 90, {
      scheduleBehavior: 'fixed',
    })
    const second = block('fixed-2', '10:00', 30, {
      scheduleBehavior: 'fixed',
    })
    const derived = plan([first, second])
    expect(derived.blocks.map((row) => row.effectiveStartTime)).toEqual([
      '09:00',
      '10:00',
    ])
    expect(derived.blocks.every((row) => row.placement.kind === 'scheduled'))
      .toBe(true)
    expect(
      derived.blocks.every(
        (row) =>
          row.placement.kind === 'scheduled' &&
          row.placement.conflict === 'fixed-overlap',
      ),
    ).toBe(true)
  })

  it('retains a shifted paused placement across refresh and template edits', () => {
    const fixed = block('fixed', '09:00', 60, {
      scheduleBehavior: 'fixed',
    })
    const flexible = block('flex', '09:30', 30)
    const shifted = plan([fixed, flexible]).blocks.find(
      (row) => row.block.id === flexible.id,
    )!
    expect(shifted.effectiveStartTime).toBe('10:00')
    const paused = progressFor(flexible, 'paused', {
      startedAt: '2026-08-31T14:00:00.000Z',
      lastPausedAt: NOW,
      activeElapsedSeconds: 300,
      occurrence: snapshotForDailyPlanBlock(shifted, NOW),
    })
    const edited = { ...flexible, title: 'Renamed later', startTime: '13:00' }
    const refreshed = plan([fixed, edited], {
      now: '2026-08-31T18:00:00.000Z',
      storedProgress: { [paused.blockInstanceId]: paused },
    }).blocks.find((row) => row.instanceId === paused.blockInstanceId)!
    expect(refreshed.effectiveStartTime).toBe('10:00')
    expect(refreshed.block.title).toBe('flex')
    expect(refreshed.progress.activeElapsedSeconds).toBe(300)
  })

  it('retains a shifted in-progress start while elapsed time grows', () => {
    const fixed = block('fixed', '09:00', 60, {
      scheduleBehavior: 'fixed',
    })
    const flexible = block('flex', '09:30', 30)
    const shifted = plan([fixed, flexible]).blocks.find(
      (row) => row.block.id === flexible.id,
    )!
    const active = progressFor(flexible, 'in-progress', {
      startedAt: '2026-08-31T14:00:00.000Z',
      activeSince: '2026-08-31T14:00:00.000Z',
      occurrence: snapshotForDailyPlanBlock(shifted, NOW),
    })
    const refreshed = plan([fixed, flexible], {
      now: '2026-08-31T15:15:00.000Z',
      storedProgress: { [active.blockInstanceId]: active },
    }).blocks.find((row) => row.instanceId === active.blockInstanceId)!
    expect(refreshed.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 600,
      endMinute: 675,
    })
  })

  it('keeps an active start factual and shifts the paused row after restart', () => {
    const restarted = block('restart-after-skip', '09:00', 60)
    const established = block('already-established', '09:05', 60)
    const initial = plan([restarted, established])
    const restartedInitial = initial.blocks.find(
      (row) => row.block.id === restarted.id,
    )!
    const skipped = progressFor(restarted, 'skipped', {
      startedAt: '2026-08-31T13:50:00.000Z',
      terminalAt: '2026-08-31T14:00:00.000Z',
      occurrence: snapshotForDailyPlanBlock(restartedInitial, NOW),
    })
    const afterSkip = plan([restarted, established], {
      storedProgress: { [skipped.blockInstanceId]: skipped },
    })
    const establishedShifted = afterSkip.blocks.find(
      (row) => row.block.id === established.id,
    )!
    expect(establishedShifted.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 545,
      endMinute: 605,
    })

    const commandTime = '2026-08-31T14:30:00.000Z'
    const restartedActive: PlannerProgress = {
      ...skipped,
      status: 'in-progress',
      activeSince: commandTime,
      terminalAt: undefined,
      updatedAt: commandTime,
    }
    const establishedPaused = progressFor(established, 'paused', {
      startedAt: '2026-08-31T14:10:00.000Z',
      lastPausedAt: commandTime,
      occurrence: snapshotForDailyPlanBlock(establishedShifted, commandTime),
      updatedAt: commandTime,
    })
    const derived = plan([restarted, established], {
      now: '2026-08-31T14:45:00.000Z',
      storedProgress: {
        [restartedActive.blockInstanceId]: restartedActive,
        [establishedPaused.blockInstanceId]: establishedPaused,
      },
    })
    const establishedRow = derived.blocks.find(
      (row) => row.block.id === established.id,
    )!
    const restartedRow = derived.blocks.find(
      (row) => row.block.id === restarted.id,
    )!
    expect(establishedRow.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 600,
      endMinute: 660,
      conflict: 'historical-overlap',
    })
    expect(restartedRow.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 540,
      endMinute: 600,
    })
    expect(
      restartedActive.occurrence?.placement.kind === 'scheduled'
        ? restartedActive.occurrence.placement.startMinute
        : undefined,
    ).toBe(540)
  })

  it('keeps a grown in-progress start factual and flags its fixed-event overrun', () => {
    const activeBlock = block('active-overrun', '09:00', 30)
    const fixed = block('fixed-practice', '10:00', 60, {
      scheduleBehavior: 'fixed',
    })
    const initial = plan([activeBlock, fixed])
    const activeInitial = initial.blocks.find(
      (row) => row.block.id === activeBlock.id,
    )!
    const active = progressFor(activeBlock, 'in-progress', {
      startedAt: '2026-08-31T14:00:00.000Z',
      activeSince: '2026-08-31T14:00:00.000Z',
      occurrence: snapshotForDailyPlanBlock(activeInitial, NOW),
    })
    const derived = plan([activeBlock, fixed], {
      now: '2026-08-31T15:15:00.000Z',
      storedProgress: { [active.blockInstanceId]: active },
    })
    const activeRow = derived.blocks.find(
      (row) => row.block.id === activeBlock.id,
    )!
    const fixedRow = derived.blocks.find((row) => row.block.id === fixed.id)!
    expect(activeRow.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 540,
      endMinute: 615,
      conflict: 'historical-overlap',
    })
    expect(fixedRow.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 600,
      endMinute: 660,
    })
    expect(
      active.occurrence?.placement.kind === 'scheduled'
        ? active.occurrence.placement
        : undefined,
    ).toMatchObject({ startMinute: 540, endMinute: 570 })
  })

  it('shifts a later pinned row when active duration grows into its interval', () => {
    const growing = block('growing-active', '09:00', 30)
    const later = block('later-paused', '09:30', 30)
    const initial = plan([growing, later])
    const growingInitial = initial.blocks.find(
      (row) => row.block.id === growing.id,
    )!
    const laterInitial = initial.blocks.find(
      (row) => row.block.id === later.id,
    )!
    const active = progressFor(growing, 'in-progress', {
      startedAt: '2026-08-31T14:00:00.000Z',
      activeSince: '2026-08-31T14:00:00.000Z',
      occurrence: snapshotForDailyPlanBlock(growingInitial, NOW),
    })
    const paused = progressFor(later, 'paused', {
      startedAt: '2026-08-31T14:30:00.000Z',
      lastPausedAt: '2026-08-31T14:45:00.000Z',
      occurrence: snapshotForDailyPlanBlock(laterInitial, NOW),
    })
    const derived = plan([growing, later], {
      now: '2026-08-31T15:15:00.000Z',
      storedProgress: {
        [active.blockInstanceId]: active,
        [paused.blockInstanceId]: paused,
      },
    })
    const growingRow = derived.blocks.find(
      (row) => row.block.id === growing.id,
    )!
    const laterRow = derived.blocks.find((row) => row.block.id === later.id)!
    expect(growingRow.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 540,
      endMinute: 615,
    })
    expect(laterRow.placement).toMatchObject({
      kind: 'scheduled',
      startMinute: 615,
      endMinute: 645,
      conflict: 'historical-overlap',
    })
    expect(
      growingRow.placement.kind === 'scheduled' &&
        laterRow.placement.kind === 'scheduled' &&
        growingRow.placement.endMinute <= laterRow.placement.startMinute,
    ).toBe(true)
  })

  it('represents a pinned conflict past midnight as explicit overflow', () => {
    const growing = block('late-growing-active', '22:00', 60)
    const later = block('late-paused', '23:00', 60)
    const initial = plan([growing, later])
    const growingInitial = initial.blocks.find(
      (row) => row.block.id === growing.id,
    )!
    const laterInitial = initial.blocks.find(
      (row) => row.block.id === later.id,
    )!
    const active = progressFor(growing, 'in-progress', {
      startedAt: '2026-08-31T13:00:00.000Z',
      activeSince: '2026-08-31T13:00:00.000Z',
      occurrence: snapshotForDailyPlanBlock(growingInitial, NOW),
    })
    const paused = progressFor(later, 'paused', {
      startedAt: '2026-08-31T14:00:00.000Z',
      lastPausedAt: '2026-08-31T14:30:00.000Z',
      occurrence: snapshotForDailyPlanBlock(laterInitial, NOW),
    })
    const derived = plan([growing, later], {
      now: '2026-08-31T15:00:00.000Z',
      storedProgress: {
        [active.blockInstanceId]: active,
        [paused.blockInstanceId]: paused,
      },
    })
    expect(
      derived.blocks.find((row) => row.block.id === growing.id)?.placement,
    ).toMatchObject({
      kind: 'scheduled',
      startMinute: 1320,
      endMinute: 1440,
    })
    expect(
      derived.blocks.find((row) => row.block.id === later.id)?.placement,
    ).toEqual({
      kind: 'overflow',
      order: 1,
      earliestStartMinute: 1440,
      durationMinutes: 60,
      reason: 'past-day-boundary',
    })
  })

  it('represents overflow explicitly and preserves multiple-row order', () => {
    const fixed = block('late-fixed', '23:00', 59, {
      scheduleBehavior: 'fixed',
    })
    const first = block('overflow-1', '22:30', 90)
    const second = block('overflow-2', '22:45', 30)
    const rows = plan([first, second, fixed]).blocks.filter(
      (row) => row.placement.kind === 'overflow',
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.effectiveStartTime)).toEqual([
      undefined,
      undefined,
    ])
    expect(rows.map((row) => row.placement)).toEqual([
      expect.objectContaining({
        kind: 'overflow',
        order: 1,
        earliestStartMinute: 1440,
      }),
      expect.objectContaining({
        kind: 'overflow',
        order: 2,
        earliestStartMinute: 1530,
      }),
    ])
    expect(rows.every((row) => row.effectiveStartTime !== '23:59')).toBe(true)
  })

  it('preserves saved overflow order when template iteration is reversed', () => {
    const fixed = block('late-fixed-refresh', '23:00', 59, {
      scheduleBehavior: 'fixed',
    })
    const earlier = block('overflow-earlier', '22:30', 90)
    const later = block('overflow-later', '22:45', 30)
    const templates = [later, earlier, fixed]
    const initial = plan(templates)
    const earlierRow = initial.blocks.find(
      (row) => row.block.id === earlier.id,
    )!
    const laterRow = initial.blocks.find((row) => row.block.id === later.id)!
    const laterProgress = progressFor(later, 'completed', {
      completedAt: NOW,
      terminalAt: NOW,
      occurrence: snapshotForDailyPlanBlock(laterRow, NOW),
    })
    const earlierProgress = progressFor(earlier, 'completed', {
      completedAt: NOW,
      terminalAt: NOW,
      occurrence: snapshotForDailyPlanBlock(earlierRow, NOW),
    })
    const refreshed = plan(templates, {
      storedProgress: {
        [laterProgress.blockInstanceId]: laterProgress,
        [earlierProgress.blockInstanceId]: earlierProgress,
      },
    }).blocks.filter((row) => row.placement.kind === 'overflow')
    expect(refreshed.map((row) => row.block.id)).toEqual([
      earlier.id,
      later.id,
    ])
    expect(
      refreshed.map((row) =>
        row.placement.kind === 'overflow'
          ? [row.placement.order, row.placement.earliestStartMinute]
          : [],
      ),
    ).toEqual([
      [1, 1440],
      [2, 1530],
    ])
  })

  it('handles midnight, noon, and fixed events crossing midnight', () => {
    const midnight = block('midnight', '00:00', 30)
    const noon = block('noon', '12:00', 30)
    const lateFixed = block('late', '23:30', 60, {
      scheduleBehavior: 'fixed',
    })
    const derived = plan([midnight, noon, lateFixed])
    expect(
      derived.blocks.find((row) => row.block.id === midnight.id),
    ).toMatchObject({ effectiveStartTime: '00:00' })
    expect(
      derived.blocks.find((row) => row.block.id === noon.id),
    ).toMatchObject({ effectiveStartTime: '12:00' })
    expect(
      derived.blocks.find((row) => row.block.id === lateFixed.id)?.placement,
    ).toMatchObject({
      kind: 'scheduled',
      startTime: '23:30',
      endMinute: 1470,
      crossesMidnight: true,
    })
    expect(formatDayMinute(1440)).toBeUndefined()
  })

  it('marks invalid direct-engine durations unavailable', () => {
    const invalid = { ...block('invalid'), expectedMinutes: 0 }
    const row = plan([invalid]).blocks[0]
    expect(row.placement).toEqual({
      kind: 'unavailable',
      reason: 'invalid-duration',
      message: 'Expected duration must be greater than zero.',
    })
    expect(row.canStart).toBe(false)
    expect(row.canManuallyComplete).toBe(false)
  })
})

describe('append-only occurrence history', () => {
  it.each(['completed', 'skipped', 'excused', 'moved'] as const)(
    'keeps a %s occurrence visible after template removal',
    (status) => {
      const original = block(`historical-${status}`, '10:15', 45)
      const initial = plan([original]).blocks[0]
      const progress = progressFor(original, status, {
        terminalAt: NOW,
        ...(status === 'completed' ? { completedAt: NOW } : {}),
        occurrence: snapshotForDailyPlanBlock(initial, NOW),
      })
      const historical = plan([], {
        storedProgress: { [progress.blockInstanceId]: progress },
      })
      expect(historical.blocks).toHaveLength(1)
      expect(historical.blocks[0]).toMatchObject({
        scheduledStartTime: '10:15',
        effectiveStartTime: '10:15',
        block: { title: `historical-${status}` },
        progress: { status },
        canStart: false,
        canSetDisposition: false,
        unavailableReason:
          'The linked source activity is no longer available.',
      })
      expect(historical.notices).toEqual([
        expect.objectContaining({ reason: 'missing-source' }),
      ])
    },
  )

  it('does not rewrite a completed occurrence after template edits', () => {
    const original = block('Original title', '09:15', 25)
    const initial = plan([original]).blocks[0]
    const completed = progressFor(original, 'completed', {
      completedAt: NOW,
      terminalAt: NOW,
      occurrence: snapshotForDailyPlanBlock(initial, NOW),
    })
    const edited: PlannerBlock = {
      ...original,
      title: 'New title',
      startTime: '14:00',
      expectedMinutes: 90,
    }
    const historical = plan([edited], {
      storedProgress: { [completed.blockInstanceId]: completed },
    }).blocks[0]
    expect(historical.block.title).toBe('Original title')
    expect(historical.scheduledStartTime).toBe('09:15')
    expect(historical.block.expectedMinutes).toBe(25)
  })

  it.each([
    ['deactivated', { active: false }],
    ['reassigned', { assignedProfileIds: ['p2'] }],
    ['nonrecurring', { weekdays: [2] }],
  ] as const)(
    'keeps %s saved history visible but read-only',
    (_label, templateChanges) => {
      const original = block('history-source-check', '09:15', 25)
      const initial = plan([original]).blocks[0]
      const completed = progressFor(original, 'completed', {
        completedAt: NOW,
        terminalAt: NOW,
        occurrence: snapshotForDailyPlanBlock(initial, NOW),
      })
      const changed = { ...original, ...templateChanges } as PlannerBlock
      const history = plan([changed], {
        storedProgress: { [completed.blockInstanceId]: completed },
      })
      expect(history.blocks).toHaveLength(1)
      expect(history.blocks[0]).toMatchObject({
        block: { title: original.title },
        canStart: false,
        canSetDisposition: false,
        unavailableReason:
          'The linked source activity is no longer available.',
      })
    },
  )

  it('keeps a reopened occurrence stable through restart', () => {
    const original = block('Reopen original', '09:15', 25)
    const initial = plan([original]).blocks[0]
    const occurrence = snapshotForDailyPlanBlock(initial, NOW)
    const reopened = progressFor(original, 'not-started', {
      reopenedAt: '2026-08-31T15:05:00.000Z',
      occurrence,
    })
    const edited: PlannerBlock = {
      ...original,
      title: 'Edited template',
      startTime: '14:00',
      expectedMinutes: 90,
    }
    const reopenedPlan = plan([edited], {
      storedProgress: { [reopened.blockInstanceId]: reopened },
    }).blocks[0]
    expect(reopenedPlan).toMatchObject({
      scheduledStartTime: '09:15',
      block: { title: 'Reopen original', expectedMinutes: 25 },
    })

    const restarted: PlannerProgress = {
      ...reopened,
      status: 'in-progress',
      startedAt: '2026-08-31T15:06:00.000Z',
      activeSince: '2026-08-31T15:06:00.000Z',
      updatedAt: '2026-08-31T15:06:00.000Z',
    }
    const restartedPlan = plan([edited], {
      storedProgress: { [restarted.blockInstanceId]: restarted },
    }).blocks[0]
    expect(restartedPlan).toMatchObject({
      scheduledStartTime: '09:15',
      block: { title: 'Reopen original', expectedMinutes: 25 },
    })
  })

  it('retains completed curriculum history during a later off-week derivation', () => {
    const curriculum = block('curriculum:science:week-1', '09:00', 30, {
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'science',
        subjectLabel: 'Science',
        week: 1,
        items: [{ id: 'lesson', text: 'Lesson', dadTaught: false }],
      },
    })
    const initial = plan([], { curriculumBlocks: [curriculum] }).blocks[0]
    const completed = progressFor(curriculum, 'completed', {
      completedAt: NOW,
      terminalAt: NOW,
      occurrence: snapshotForDailyPlanBlock(initial, NOW),
    })
    const offYear = { ...schoolYear, offWeeks: [MON] }
    const history = plan([], {
      curriculumBlocks: [curriculum],
      schoolYear: offYear,
      storedProgress: { [completed.blockInstanceId]: completed },
    })
    expect(history.blocks).toHaveLength(1)
    expect(history.blocks[0]).toMatchObject({
      progress: { status: 'completed' },
      canStart: false,
      canSetDisposition: false,
      unavailableReason:
        'The linked source activity is no longer available.',
    })
  })

  it('never shows one profile’s historical snapshot to another', () => {
    const original = block('private-history')
    const initial = plan([original]).blocks[0]
    const completed = progressFor(original, 'completed', {
      completedAt: NOW,
      occurrence: snapshotForDailyPlanBlock(initial, NOW),
    })
    const other = deriveDailyPlan({
      templates: [],
      overrides: [],
      student: emptyProfile('p2', 'Other', '6'),
      date: MON,
      schoolYear,
      missionBlocks: [],
      curriculumBlocks: [],
      storedProgress: { [completed.blockInstanceId]: completed },
      now: NOW,
    })
    expect(other.blocks).toHaveLength(0)
  })
})
