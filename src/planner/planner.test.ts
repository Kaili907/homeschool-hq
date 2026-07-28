import { describe, expect, it, vi } from 'vitest'
import {
  hydrateAppState,
  importBackup,
  loadAppState,
  saveAppState,
  serializeAllBackup,
} from '../appState'
import { defaultAppState } from '../migration'
import {
  MANUAL_ACTIVITY_CATEGORIES,
  PLANNER_VERSION,
  createManualPlannerBlock,
  defaultPlannerState,
  normalizePlannerState,
  patchPlannerBlock,
  readPlannerState,
  removePlannerBlock,
  togglePlannerBlockActive,
  updateManualPlannerBlock,
} from './defaults'
import { deriveDailyPlan } from './engine'
import { snapshotForDailyPlanBlock } from './occurrence'
import { plannerBlockInstanceId } from './resume'
import { defaultSchoolYear } from '../curriculum/pacing'
import type {
  PlannerBlock,
  PlannerProgress,
  PlannerState,
  UnsupportedPlannerState,
} from './types'

const MON = '2026-08-31'
const NOW = '2026-08-31T13:00:00.000Z'

function manualBlock(
  id: string,
  over: Partial<PlannerBlock> = {},
): PlannerBlock {
  return {
    ...createManualPlannerBlock(
      {
        title: id,
        studentInstructions: `${id} instructions`,
        parentNotes: `${id} parent note`,
        category: 'custom',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '09:00',
        expectedMinutes: 30,
        scheduleBehavior: 'flexible',
      },
      NOW,
      id,
    ),
    ...over,
  }
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      get length() {
        return values.size
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    },
  }
}

describe('version-aware planner hydration', () => {
  it('hydrates schema-v2 AppState without planner data to planner v2', () => {
    const legacyApp = defaultAppState()
    expect(legacyApp.planner).toBeUndefined()
    const hydrated = hydrateAppState(legacyApp)
    expect(hydrated.schemaVersion).toBe(2)
    expect(hydrated.planner).toEqual(defaultPlannerState())
    expect(hydrated.profiles).toEqual(legacyApp.profiles)
    expect(PLANNER_VERSION).toBe(2)
  })

  it('loads a persisted AppState without planner data', () => {
    const { storage } = memoryStorage()
    storage.setItem('homeschool-hq:app:v2', JSON.stringify(defaultAppState()))
    vi.stubGlobal('localStorage', storage)
    try {
      const loaded = loadAppState()
      expect(loaded.migrated).toBe(false)
      expect(loaded.state.planner).toEqual(defaultPlannerState())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('migrates missing-version and planner-v1 data to v2', () => {
    const block = manualBlock('legacy')
    const legacyShape = {
      blocks: [
        {
          ...block,
          description: 'Old student instructions',
          notes: 'Old ambiguous note',
          studentInstructions: undefined,
          parentNotes: undefined,
        },
      ],
      overrides: [],
      progress: {},
    }
    const missingVersion = readPlannerState(
      JSON.parse(JSON.stringify(legacyShape)),
    )
    const v1 = readPlannerState({
      ...JSON.parse(JSON.stringify(legacyShape)),
      version: 1,
    })
    for (const result of [missingVersion, v1]) {
      expect(result.kind).toBe('supported')
      if (result.kind !== 'supported') continue
      expect(result.migrated).toBe(true)
      expect(result.state.version).toBe(2)
      expect(result.state.blocks[0]).toMatchObject({
        studentInstructions: 'Old student instructions',
        parentNotes: 'Old ambiguous note',
      })
      expect('description' in result.state.blocks[0]).toBe(false)
      expect('notes' in result.state.blocks[0]).toBe(false)
    }
  })

  it('normalizes partial current data without discarding valid siblings', () => {
    const good = manualBlock('good')
    const result = readPlannerState({
      version: 2,
      blocks: [{ id: 'broken' }, good],
      overrides: 'not-an-array',
      progress: {
        bad: { status: 'invented' },
      },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    expect(result.migrated).toBe(false)
    expect(result.state.blocks.map((block) => block.id)).toEqual(['good'])
    expect(result.state.overrides).toEqual([])
    expect(result.state.progress).toEqual({})
  })

  it('preserves safe unknown fields throughout current planner data', () => {
    const futureInstanceId = plannerBlockInstanceId(
      'p1',
      MON,
      'future-block',
    )
    const raw = {
      version: 2,
      futureTop: { enabled: true, flags: ['a', 'b'] },
      blocks: [
        {
          ...manualBlock('future-block'),
          futureBlock: { revision: 7 },
          source: { kind: 'manual', futureSource: 'kept' },
          linkedActivity: {
            adapter: 'route',
            activityId: 'future',
            futureLink: { safe: true },
          },
        },
      ],
      overrides: [],
      progress: {
        [futureInstanceId]: {
          profileId: 'p1',
          date: MON,
          blockInstanceId: futureInstanceId,
          blockId: 'future-block',
          status: 'paused',
          activeElapsedSeconds: 10,
          updatedAt: NOW,
          futureProgress: { deviceRevision: 3 },
          resumePointer: {
            updatedAt: NOW,
            activityId: 'future',
            futurePointer: ['safe'],
          },
        },
      },
    }
    const result = readPlannerState(raw)
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    const restored = JSON.parse(JSON.stringify(result.state))
    expect(restored.futureTop).toEqual(raw.futureTop)
    expect(restored.blocks[0].futureBlock).toEqual({ revision: 7 })
    expect(restored.blocks[0].source.futureSource).toBe('kept')
    expect(restored.blocks[0].linkedActivity.futureLink).toEqual({
      safe: true,
    })
    expect(restored.progress[futureInstanceId].futureProgress).toEqual({
      deviceRevision: 3,
    })
    expect(
      restored.progress[futureInstanceId].resumePointer.futurePointer,
    ).toEqual(['safe'])
  })

  it('preserves an unsupported future payload through hydration and backup', () => {
    const future = {
      version: 3,
      futureTop: { nested: ['must', 'survive'] },
      blocks: [{ futureShape: true }],
      custom: 'opaque',
    } as unknown as UnsupportedPlannerState
    const app = { ...defaultAppState(), planner: future }
    const hydrated = hydrateAppState(app)
    expect(hydrated).toBe(app)
    expect(hydrated.planner).toEqual(future)
    const read = readPlannerState(hydrated.planner)
    expect(read).toEqual({
      kind: 'unsupported-newer',
      version: 3,
      raw: future,
    })
    const restored = importBackup(
      defaultAppState(),
      serializeAllBackup(hydrated),
    )
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.planner).toEqual(future)
  })

  it('does not strip an unsupported future payload during load and save', () => {
    const future = {
      version: 8,
      nested: { unknown: { stays: true } },
      rows: [1, 2, 3],
    }
    const app = { ...defaultAppState(), planner: future }
    const { storage, values } = memoryStorage()
    storage.setItem('homeschool-hq:app:v2', JSON.stringify(app))
    vi.stubGlobal('localStorage', storage)
    try {
      const loaded = loadAppState()
      saveAppState(loaded.state)
      expect(
        JSON.parse(values.get('homeschool-hq:app:v2')!).planner,
      ).toEqual(future)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('round-trips current planner state through full backup', () => {
    const state = hydrateAppState(defaultAppState())
    if (!state.planner || state.planner.version !== PLANNER_VERSION) {
      throw new Error('expected current planner')
    }
    state.planner.blocks = [manualBlock('backup-block')]
    const restored = importBackup(
      defaultAppState(),
      serializeAllBackup(state),
    )
    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.planner).toEqual(state.planner)
  })

  it('drops noncanonical progress keys and fabricated instance IDs', () => {
    const block = manualBlock('canonical')
    const instanceId = plannerBlockInstanceId('p1', MON, block.id)
    const base = {
      profileId: 'p1',
      date: MON,
      blockId: block.id,
      status: 'completed',
      activeElapsedSeconds: 0,
      updatedAt: NOW,
    }
    const result = readPlannerState({
      version: 2,
      blocks: [block],
      overrides: [],
      progress: {
        'wrong-map-key': { ...base, blockInstanceId: instanceId },
        fabricated: { ...base, blockInstanceId: 'fabricated' },
      },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    expect(result.state.progress).toEqual({})
  })

  it('quarantines a cross-profile occurrence instead of exposing its text', () => {
    const block = manualBlock('private-history')
    const initial = deriveDailyPlan({
      templates: [block],
      overrides: [],
      student: defaultAppState().profiles.p1,
      date: MON,
      schoolYear: defaultSchoolYear(MON),
      missionBlocks: [],
      curriculumBlocks: [],
      storedProgress: {},
      now: NOW,
    }).blocks[0]
    const instanceId = initial.instanceId
    const result = readPlannerState({
      version: 2,
      blocks: [block],
      overrides: [],
      progress: {
        [instanceId]: {
          profileId: 'p1',
          date: MON,
          blockInstanceId: instanceId,
          blockId: block.id,
          status: 'completed',
          activeElapsedSeconds: 0,
          updatedAt: NOW,
          occurrence: {
            ...snapshotForDailyPlanBlock(initial, NOW),
            profileId: 'p2',
            title: 'Other student private title',
            studentInstructions: 'Other student private instructions',
          },
        },
      },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    const occurrence = result.state.progress[instanceId].occurrence
    expect(occurrence).toMatchObject({
      profileId: 'p1',
      blockInstanceId: instanceId,
      title: 'Archived activity',
    })
    expect(JSON.stringify(occurrence)).not.toContain('Other student')
  })

  it('quarantines inconsistent or out-of-day scheduled placements', () => {
    const block = manualBlock('placement-guard')
    const initial = deriveDailyPlan({
      templates: [block],
      overrides: [],
      student: defaultAppState().profiles.p1,
      date: MON,
      schoolYear: defaultSchoolYear(MON),
      missionBlocks: [],
      curriculumBlocks: [],
      storedProgress: {},
      now: NOW,
    }).blocks[0]
    const instanceId = initial.instanceId
    const snapshot = snapshotForDailyPlanBlock(initial, NOW)
    const invalidPlacements = [
      {
        kind: 'scheduled',
        startMinute: 1440,
        endMinute: 1470,
        startTime: '00:00',
      },
      {
        kind: 'scheduled',
        startMinute: 540,
        endMinute: 570,
        startTime: '10:00',
      },
      {
        kind: 'scheduled',
        startMinute: 540,
        endMinute: 540,
        startTime: '09:00',
      },
    ]
    for (const placement of invalidPlacements) {
      const result = readPlannerState({
        version: 2,
        blocks: [block],
        overrides: [],
        progress: {
          [instanceId]: {
            profileId: 'p1',
            date: MON,
            blockInstanceId: instanceId,
            blockId: block.id,
            status: 'completed',
            activeElapsedSeconds: 0,
            updatedAt: NOW,
            occurrence: { ...snapshot, placement },
          },
        },
      })
      expect(result.kind).toBe('supported')
      if (result.kind !== 'supported') continue
      expect(result.state.progress[instanceId].occurrence).toMatchObject({
        title: 'Archived activity',
        placement: { kind: 'unavailable' },
      })
    }
  })

  it('canonicalizes preferred start minutes from the saved local time', () => {
    const block = manualBlock('preferred-time-guard')
    const initial = deriveDailyPlan({
      templates: [block],
      overrides: [],
      student: defaultAppState().profiles.p1,
      date: MON,
      schoolYear: defaultSchoolYear(MON),
      missionBlocks: [],
      curriculumBlocks: [],
      storedProgress: {},
      now: NOW,
    }).blocks[0]
    const instanceId = initial.instanceId
    const result = readPlannerState({
      version: 2,
      blocks: [block],
      overrides: [],
      progress: {
        [instanceId]: {
          profileId: 'p1',
          date: MON,
          blockInstanceId: instanceId,
          blockId: block.id,
          status: 'completed',
          activeElapsedSeconds: 0,
          updatedAt: NOW,
          occurrence: {
            ...snapshotForDailyPlanBlock(initial, NOW),
            preferredStartTime: '09:00',
            preferredStartMinute: 2500,
          },
        },
      },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    expect(
      result.state.progress[instanceId].occurrence?.preferredStartMinute,
    ).toBe(540)
    expect(result.state.progress[instanceId].occurrence?.title).toBe(
      block.title,
    )
  })
})

describe('legacy mission completion normalization', () => {
  function legacyMissionProgress(
    over: Partial<PlannerProgress> = {},
  ): Record<string, unknown> {
    const blockId = 'mission:read-20'
    const instanceId = plannerBlockInstanceId('p1', MON, blockId)
    return {
      profileId: 'p1',
      date: MON,
      blockInstanceId: instanceId,
      blockId,
      status: 'completed',
      completedAt: NOW,
      terminalAt: NOW,
      completionNote: 'legacy mirror',
      parentVerification: { verified: true, verifiedAt: NOW },
      activeElapsedSeconds: 0,
      updatedAt: NOW,
      ...over,
    }
  }

  it('does not resurrect an untimed legacy mission completion', () => {
    const raw = legacyMissionProgress()
    const result = readPlannerState({
      version: 1,
      blocks: [],
      overrides: [],
      progress: { [String(raw.blockInstanceId)]: raw },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    const row = Object.values(result.state.progress)[0]
    expect(row).toMatchObject({
      completionAuthority: 'mission',
      status: 'not-started',
      activeElapsedSeconds: 0,
    })
    expect(row.completedAt).toBeUndefined()
    expect(row.terminalAt).toBeUndefined()
    expect(row.completionNote).toBeUndefined()
    expect(row.parentVerification).toBeUndefined()
    expect(row.occurrence).toBeUndefined()
  })

  it('retains useful timing as paused non-authoritative mission history', () => {
    const raw = legacyMissionProgress({
      startedAt: '2026-08-31T12:55:00.000Z',
      lastPausedAt: NOW,
      activeElapsedSeconds: 300,
    })
    const result = readPlannerState({
      version: 1,
      blocks: [],
      overrides: [],
      progress: { [String(raw.blockInstanceId)]: raw },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    const row = Object.values(result.state.progress)[0]
    expect(row).toMatchObject({
      completionAuthority: 'mission',
      status: 'paused',
      activeElapsedSeconds: 300,
      occurrence: {
        title: 'Archived mission activity',
        category: 'existing-mission',
        source: { kind: 'mission', missionItemId: 'read-20' },
        placement: { kind: 'unavailable', reason: 'missing-source' },
      },
    })
    expect(row.completedAt).toBeUndefined()
  })

  it('sanitizes planner-owned mission completion in current planner v2', () => {
    const raw = legacyMissionProgress({
      completionAuthority: 'planner',
      startedAt: '2026-08-31T12:55:00.000Z',
      activeElapsedSeconds: 300,
    })
    const result = readPlannerState({
      version: 2,
      blocks: [],
      overrides: [],
      progress: { [String(raw.blockInstanceId)]: raw },
    })
    expect(result.kind).toBe('supported')
    if (result.kind !== 'supported') return
    const row = Object.values(result.state.progress)[0]
    expect(row).toMatchObject({
      completionAuthority: 'mission',
      status: 'paused',
      activeElapsedSeconds: 300,
    })
    expect(row.completedAt).toBeUndefined()
    expect(row.terminalAt).toBeUndefined()
    expect(row.parentVerification).toBeUndefined()
  })
})

describe('manual category and current-state-safe template helpers', () => {
  it('excludes generated-system categories from manual creation', () => {
    expect(MANUAL_ACTIVITY_CATEGORIES).not.toContain('existing-mission')
    expect(MANUAL_ACTIVITY_CATEGORIES).not.toContain('manuel-academy')
    const impersonating = createManualPlannerBlock(
      {
        title: 'Typed mission label',
        category: 'existing-mission',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '09:00',
        expectedMinutes: 20,
        scheduleBehavior: 'flexible',
      },
      NOW,
      'manual:fake-mission',
    )
    expect(impersonating.category).toBe('custom')
    expect(impersonating.source).toEqual({ kind: 'manual' })
  })

  it('keeps ordinary Romeo entries manual unless explicitly source-linked', () => {
    const ordinary = createManualPlannerBlock(
      {
        title: 'Romeo worksheet',
        category: 'romeo-online',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '09:00',
        expectedMinutes: 20,
        scheduleBehavior: 'flexible',
      },
      NOW,
      'manual:romeo',
    )
    const linked = createManualPlannerBlock(
      {
        title: 'Linked Romeo activity',
        category: 'romeo-online',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '09:30',
        expectedMinutes: 20,
        scheduleBehavior: 'flexible',
        linkedActivity: {
          adapter: 'romeo-online',
          activityId: 'romeo:algebra-1',
        },
      },
      NOW,
      'linked:romeo',
    )
    expect(ordinary.source).toEqual({ kind: 'manual' })
    expect(plannerBlockInstanceId('p1', MON, ordinary.id)).toContain(
      'manual%3Aromeo',
    )
    expect(linked.source).toEqual({
      kind: 'romeo-online',
      activityId: 'romeo:algebra-1',
    })
  })

  it('does not detach an explicitly linked Romeo template through a category edit', () => {
    const linked = createManualPlannerBlock(
      {
        title: 'Linked Romeo',
        category: 'romeo-online',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '09:00',
        expectedMinutes: 20,
        scheduleBehavior: 'flexible',
        linkedActivity: {
          adapter: 'romeo-online',
          activityId: 'romeo:geometry',
        },
      },
      NOW,
      'linked',
    )
    const updated = updateManualPlannerBlock(
      { ...defaultPlannerState(), blocks: [linked] },
      linked.id,
      {
        title: 'Still linked',
        category: 'custom',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '10:00',
        expectedMinutes: 30,
        scheduleBehavior: 'flexible',
      },
      NOW,
    )
    expect(updated.blocks[0]).toMatchObject({
      category: 'romeo-online',
      source: {
        kind: 'romeo-online',
        activityId: 'romeo:geometry',
      },
    })
  })

  it('downgrades legacy manual system categories without deleting the row', () => {
    const legacy = {
      ...manualBlock('legacy-system-label'),
      category: 'manuel-academy',
      source: { kind: 'manual' },
    }
    const normalized = normalizePlannerState({
      version: 1,
      blocks: [legacy],
      overrides: [],
      progress: {},
    })
    expect(normalized.blocks).toHaveLength(1)
    expect(normalized.blocks[0]).toMatchObject({
      id: legacy.id,
      title: legacy.title,
      category: 'custom',
      source: { kind: 'manual' },
    })
  })

  it('updates the latest template while preserving immutable identity and history', () => {
    const original = manualBlock('editable', {
      active: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const progress: PlannerProgress = {
      profileId: 'p1',
      date: MON,
      blockInstanceId: plannerBlockInstanceId('p1', MON, original.id),
      blockId: original.id,
      status: 'completed',
      activeElapsedSeconds: 600,
      completedAt: NOW,
      updatedAt: NOW,
    }
    const planner: PlannerState = {
      ...defaultPlannerState(),
      blocks: [original],
      progress: { [progress.blockInstanceId]: progress },
    }
    const updated = updateManualPlannerBlock(
      planner,
      original.id,
      {
        title: 'Latest submitted title',
        studentInstructions: 'New instructions',
        category: 'wrestling',
        assignedProfileIds: ['p1', 'p2'],
        weekdays: [1, 3],
        startTime: '12:00',
        expectedMinutes: 45,
        scheduleBehavior: 'fixed',
      },
      '2026-08-31T14:00:00.000Z',
    )
    expect(updated.blocks[0]).toMatchObject({
      id: original.id,
      title: 'Latest submitted title',
      source: original.source,
      createdAt: original.createdAt,
      active: false,
    })
    expect(updated.progress[progress.blockInstanceId].occurrence).toMatchObject(
      {
        title: 'editable',
        preferredStartTime: '09:00',
        expectedMinutes: 30,
      },
    )
  })

  it('uses latest active state and refuses unknown/removed IDs', () => {
    const original = manualBlock('toggle', { active: false })
    const planner = { ...defaultPlannerState(), blocks: [original] }
    const toggled = togglePlannerBlockActive(planner, original.id, NOW)
    expect(toggled.blocks[0].active).toBe(true)
    expect(togglePlannerBlockActive(toggled, 'fabricated', NOW)).toBe(toggled)
    expect(
      updateManualPlannerBlock(
        toggled,
        'removed',
        {
          title: 'No orphan',
          category: 'custom',
          assignedProfileIds: ['p1'],
          weekdays: [1],
          startTime: '09:00',
          expectedMinutes: 30,
          scheduleBehavior: 'flexible',
        },
        NOW,
      ),
    ).toBe(toggled)
  })

  it('clears blank parent notes and location during a full editor update', () => {
    const original = manualBlock('clear-optionals', {
      parentNotes: 'Private parent note',
      location: 'Old gym',
    })
    const updated = updateManualPlannerBlock(
      { ...defaultPlannerState(), blocks: [original] },
      original.id,
      {
        title: original.title,
        studentInstructions: original.studentInstructions,
        parentNotes: '   ',
        category: 'custom',
        assignedProfileIds: ['p1'],
        weekdays: [1],
        startTime: '09:00',
        expectedMinutes: 30,
        scheduleBehavior: 'flexible',
        location: '',
      },
      NOW,
    )
    expect(updated.blocks[0].parentNotes).toBeUndefined()
    expect(updated.blocks[0].location).toBeUndefined()
    expect(
      Object.prototype.hasOwnProperty.call(updated.blocks[0], 'parentNotes'),
    ).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(updated.blocks[0], 'location'),
    ).toBe(false)
  })

  it('applies sanitized partial patches to the latest template state', () => {
    const original = manualBlock('concurrent', {
      location: 'Original room',
    })
    const planner = { ...defaultPlannerState(), blocks: [original] }
    const remote = patchPlannerBlock(
      planner,
      original.id,
      { startTime: '11:00', expectedMinutes: 45 },
      '2026-08-31T13:01:00.000Z',
    )
    const local = patchPlannerBlock(
      remote,
      original.id,
      {
        title: '  Local title  ',
        parentNotes: '',
        location: ' ',
        startTime: '99:99',
        expectedMinutes: -10,
      },
      '2026-08-31T13:02:00.000Z',
    )
    expect(local.blocks[0]).toMatchObject({
      title: 'Local title',
      startTime: '11:00',
      expectedMinutes: 45,
    })
    expect(local.blocks[0].parentNotes).toBeUndefined()
    expect(local.blocks[0].location).toBeUndefined()
  })

  it('snapshots meaningful progress before removal and preserves visibility', () => {
    const original = manualBlock('remove-me')
    const progress: PlannerProgress = {
      profileId: 'p1',
      date: MON,
      blockInstanceId: plannerBlockInstanceId('p1', MON, original.id),
      blockId: original.id,
      status: 'excused',
      activeElapsedSeconds: 0,
      terminalAt: NOW,
      updatedAt: NOW,
    }
    const planner: PlannerState = {
      ...defaultPlannerState(),
      blocks: [original],
      progress: { [progress.blockInstanceId]: progress },
    }
    const removed = removePlannerBlock(planner, original.id, NOW)
    expect(removed.blocks).toEqual([])
    expect(removed.progress[progress.blockInstanceId].occurrence).toMatchObject(
      {
        title: 'remove-me',
        parentNotes: 'remove-me parent note',
      },
    )
    const visible = deriveDailyPlan({
      templates: removed.blocks,
      overrides: [],
      student: defaultAppState().profiles.p1,
      date: MON,
      schoolYear: defaultSchoolYear(MON),
      missionBlocks: [],
      curriculumBlocks: [],
      storedProgress: removed.progress,
      now: NOW,
    })
    expect(visible.blocks).toHaveLength(1)
    expect(visible.blocks[0].block.title).toBe('remove-me')
  })
})
