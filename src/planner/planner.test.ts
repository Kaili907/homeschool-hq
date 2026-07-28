import { describe, expect, it, vi } from 'vitest'
import {
  hydrateAppState,
  importBackup,
  loadAppState,
  serializeAllBackup,
} from '../appState'
import { defaultAppState, emptyProfile } from '../migration'
import { buildMissionDay, defaultTemplateFor } from '../missions'
import { defaultSchoolYear } from '../curriculum/pacing'
import { parsePlanDoc } from '../curriculum/parser'
import { createManualPlannerBlock, defaultPlannerState, normalizePlannerState } from './defaults'
import { curriculumBlocksForDay } from './adapters/curriculumAdapter'
import { missionBlocksForDay } from './adapters/missionAdapter'
import { deriveDailyPlan } from './engine'
import type { PlannerBlock, PlannerProgress } from './types'

const MON = '2026-08-31'
const NOW = '2026-08-31T13:00:00.000Z'
const schoolYear = defaultSchoolYear(MON)

const manualBlock = (
  id: string,
  over: Partial<PlannerBlock> = {},
): PlannerBlock => ({
  ...createManualPlannerBlock(
    {
      title: id,
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
})

const derive = (
  studentId: string,
  templates: PlannerBlock[],
  curriculumBlocks: PlannerBlock[] = [],
  over: Partial<Parameters<typeof deriveDailyPlan>[0]> = {},
) =>
  deriveDailyPlan({
    templates,
    overrides: [],
    student: emptyProfile(studentId, studentId, '6'),
    date: MON,
    schoolYear,
    missionBlocks: [],
    curriculumBlocks,
    storedProgress: {},
    now: NOW,
    ...over,
  })

describe('schema-v2 compatibility and planner normalization', () => {
  it('hydrates an existing AppState that has no planner data', () => {
    const legacy = defaultAppState()
    expect(legacy.planner).toBeUndefined()
    const hydrated = hydrateAppState(legacy)
    expect(hydrated.schemaVersion).toBe(2)
    expect(hydrated.planner).toEqual(defaultPlannerState())
    expect(hydrated.profiles).toEqual(legacy.profiles)
  })

  it('loads a persisted schema-v2 AppState without planner data', () => {
    const values = new Map<string, string>()
    const storage = {
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
    }
    storage.setItem('homeschool-hq:app:v2', JSON.stringify(defaultAppState()))
    vi.stubGlobal('localStorage', storage)
    try {
      const loaded = loadAppState()
      expect(loaded.migrated).toBe(false)
      expect(loaded.state.schemaVersion).toBe(2)
      expect(loaded.state.planner).toEqual(defaultPlannerState())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('generates safe defaults and drops malformed planner rows', () => {
    const normalized = normalizePlannerState({
      version: 999,
      blocks: [{ id: 'broken' }],
      overrides: 'not-an-array',
      progress: { bad: { status: 'invented' } },
    })
    expect(normalized).toEqual(defaultPlannerState())
  })

  it('survives JSON serialization and restoration', () => {
    const block = manualBlock('wrestling', {
      category: 'wrestling',
      assignToAll: true,
      assignedProfileIds: ['p1', 'p2'],
      location: 'Main gym',
    })
    const planner = {
      ...defaultPlannerState(),
      blocks: [block],
      progress: {
        sample: {
          profileId: 'p1',
          date: MON,
          blockInstanceId: 'sample',
          blockId: block.id,
          status: 'paused' as const,
          activeElapsedSeconds: 420,
          resumePointer: {
            activityId: 'wrestling',
            adapterData: { mat: 2, drills: ['shots', 'sprawls'] },
            updatedAt: NOW,
          },
          updatedAt: NOW,
        },
      },
    }
    expect(normalizePlannerState(JSON.parse(JSON.stringify(planner)))).toEqual(planner)
  })

  it('is retained by full backup export and restore', () => {
    const state = hydrateAppState(defaultAppState())
    state.planner!.blocks = [manualBlock('backup-block')]
    const restored = importBackup(defaultAppState(), serializeAllBackup(state))
    expect(restored.ok).toBe(true)
    if (!restored.ok) throw new Error(restored.error)
    expect(restored.state.planner).toEqual(state.planner)
  })
})

describe('assignment and generated-source isolation', () => {
  it('shows an all-students activity for every student', () => {
    const all = manualBlock('family-wrestling', {
      category: 'wrestling',
      assignedProfileIds: [],
      assignToAll: true,
    })
    expect(derive('p1', [all]).blocks.map((row) => row.block.id)).toEqual([all.id])
    expect(derive('p2', [all]).blocks.map((row) => row.block.id)).toEqual([all.id])
  })

  it('keeps a single-student activity isolated', () => {
    const one = manualBlock('solo-weights', {
      category: 'weight-training',
      assignedProfileIds: ['p1'],
      assignToAll: false,
    })
    expect(derive('p1', [one]).blocks).toHaveLength(1)
    expect(derive('p2', [one]).blocks).toHaveLength(0)
  })

  it('deduplicates generated mission blocks by mission identity', () => {
    const profile = emptyProfile('p1', 'Kid', '3')
    const day = buildMissionDay(defaultTemplateFor('3'), MON)
    day.items.push({ ...day.items[0] })
    const blocks = missionBlocksForDay(profile, MON, day)
    expect(blocks.filter((block) => block.source.kind === 'mission')).toHaveLength(
      new Set(day.items.map((item) => item.id)).size,
    )
  })

  it('deduplicates generated curriculum blocks without mutating adapter output', () => {
    const profile = emptyProfile('p1', 'Kid', '10')
    const docs = [
      parsePlanDoc(`---
subject: Personal Finance
subjectId: personal-finance
grades: 10
---
## Week 1
- Build a simple budget
`),
    ]
    const generated = curriculumBlocksForDay(profile, docs, schoolYear, MON)
    const snapshot = JSON.stringify(generated)
    const plan = deriveDailyPlan({
      templates: [],
      overrides: [],
      student: profile,
      date: MON,
      schoolYear,
      missionBlocks: [],
      curriculumBlocks: [...generated, ...generated],
      storedProgress: {},
      now: NOW,
    })
    expect(plan.blocks).toHaveLength(1)
    expect(JSON.stringify(generated)).toBe(snapshot)
  })

  it('suppresses curriculum during a travel week without deleting progress records', () => {
    const profile = emptyProfile('p1', 'Kid', '10')
    const curriculum = manualBlock('curriculum:finance:week-1', {
      title: 'Manuel Academy · Personal Finance',
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'personal-finance',
        subjectLabel: 'Personal Finance',
        week: 1,
        items: [{ id: 'budget', text: 'Budget', dadTaught: false }],
      },
    })
    const progress: Record<string, PlannerProgress> = {
      historical: {
        profileId: 'p1',
        date: '2026-08-24',
        blockInstanceId: 'historical',
        blockId: curriculum.id,
        status: 'completed',
        activeElapsedSeconds: 1200,
        completedAt: '2026-08-24T14:00:00.000Z',
        updatedAt: '2026-08-24T14:00:00.000Z',
      },
    }
    const offYear = { ...schoolYear, offWeeks: [MON] }
    const before = JSON.stringify(progress)
    const plan = deriveDailyPlan({
      templates: [],
      overrides: [],
      student: profile,
      date: MON,
      schoolYear: offYear,
      missionBlocks: [],
      curriculumBlocks: [curriculum],
      storedProgress: progress,
      now: NOW,
    })
    expect(plan.blocks).toHaveLength(0)
    expect(JSON.stringify(progress)).toBe(before)
  })
})
