import { describe, expect, it, vi } from 'vitest'
import {
  hydrateAppState,
  importBackup,
  serializeAllBackup,
} from '../appState'
import { defaultAppState, emptyProfile } from '../migration'
import { readPlannerState } from './defaults'
import { plannerBlockInstanceId } from './resume'

const DAY = '2026-08-31'
const STARTED = '2026-08-31T09:00:00.000Z'
const BOUNDED = '2026-08-31T09:05:00.000Z'
const UPDATED = '2026-08-31T10:00:00.000Z'

function legacyState(sourceDone: boolean) {
  const state = defaultAppState()
  const profile = emptyProfile('p1', 'Kid', '3')
  profile.missions[DAY] = {
    items: [
      {
        id: 'manual-source',
        label: 'Manual source',
        done: sourceDone,
      },
    ],
  }
  state.profiles.p1 = profile
  const blockId = 'mission:manual-source'
  const instanceId = plannerBlockInstanceId('p1', DAY, blockId)
  state.planner = {
    version: 1,
    blocks: [],
    overrides: [],
    progress: {
      [instanceId]: {
        profileId: 'p1',
        date: DAY,
        blockInstanceId: instanceId,
        blockId,
        status: 'completed',
        activeElapsedSeconds: 420,
        startedAt: '2026-08-31T09:00:00.000Z',
        lastPausedAt: '2026-08-31T09:07:00.000Z',
        completedAt: UPDATED,
        completionNote: 'Legacy planner mirror',
        parentVerification: {
          verified: true,
          verifiedAt: UPDATED,
          verifiedBy: 'parent',
        },
        updatedAt: UPDATED,
      },
    },
  }
  return { state, instanceId }
}

function liveMissionState(
  source: 'open' | 'done' | 'missing',
  version: 1 | 2 = 1,
) {
  const state = defaultAppState()
  const profile = emptyProfile('p1', 'Kid', '3')
  profile.missions[DAY] = {
    items:
      source === 'missing'
        ? [
            {
              id: 'replacement-source',
              label: 'Replacement source',
              done: true,
            },
          ]
        : [
            {
              id: 'manual-source',
              label: 'Manual source',
              done: source === 'done',
            },
          ],
  }
  state.profiles.p1 = profile
  const blockId = 'mission:manual-source'
  const instanceId = plannerBlockInstanceId('p1', DAY, blockId)
  state.planner = {
    version,
    blocks: [],
    overrides: [],
    progress: {
      [instanceId]: {
        profileId: 'p1',
        date: DAY,
        blockInstanceId: instanceId,
        blockId,
        status: 'in-progress',
        activeElapsedSeconds: 60,
        startedAt: STARTED,
        activeSince: STARTED,
        updatedAt: BOUNDED,
      },
    },
  }
  return { state, instanceId }
}

const supportedPlanner = (value: unknown) => {
  const result = readPlannerState(value)
  if (result.kind !== 'supported') throw new Error('expected supported planner')
  return result.state
}

describe('legacy mission planner authority', () => {
  it.each([false, true])(
    'does not write legacy planner completion into a source whose done value is %s',
    (sourceDone) => {
      const { state, instanceId } = legacyState(sourceDone)

      const hydrated = hydrateAppState(state)
      const row = supportedPlanner(hydrated.planner).progress[instanceId]

      expect(hydrated.profiles.p1.missions[DAY].items[0].done).toBe(sourceDone)
      expect(row.status).toBe('paused')
      expect(row.completionAuthority).toBe('mission')
      expect(row.activeElapsedSeconds).toBe(420)
      expect(row.completedAt).toBeUndefined()
      expect(row.completionNote).toBeUndefined()
      expect(row.parentVerification).toBeUndefined()
    },
  )

  it('round-trips source completion and non-authoritative timing without resurrection', () => {
    const { state, instanceId } = legacyState(false)
    const hydrated = hydrateAppState(state)

    const restored = importBackup(
      defaultAppState(),
      serializeAllBackup(hydrated),
    )
    expect(restored.ok).toBe(true)
    if (!restored.ok) throw new Error(restored.error)

    const row = supportedPlanner(restored.state.planner).progress[instanceId]
    expect(restored.state.profiles.p1.missions[DAY].items[0].done).toBe(false)
    expect(row).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 420,
    })
    expect(row.completedAt).toBeUndefined()
  })

  it.each([1, 2] as const)(
    'closes a restored planner-v%s live timer for a completed mission at its persisted cutoff',
    (version) => {
      vi.useFakeTimers()
      try {
        const { state, instanceId } = liveMissionState('done', version)

        vi.setSystemTime(new Date('2027-01-01T12:00:00.000Z'))
        const first = hydrateAppState(state)
        const firstRow = supportedPlanner(first.planner).progress[instanceId]

        expect(firstRow).toMatchObject({
          status: 'paused',
          completionAuthority: 'mission',
          activeElapsedSeconds: 360,
          lastPausedAt: BOUNDED,
          updatedAt: BOUNDED,
        })
        expect(firstRow.activeSince).toBeUndefined()
        expect(firstRow.completedAt).toBeUndefined()
        expect(firstRow.terminalAt).toBeUndefined()

        vi.setSystemTime(new Date('2032-07-04T20:30:00.000Z'))
        const second = hydrateAppState(first)
        expect(second).toEqual(first)
      } finally {
        vi.useRealTimers()
      }
    },
  )

  it('closes an orphaned live mission timer without charging time through hydration', () => {
    const { state, instanceId } = liveMissionState('missing')

    const hydrated = hydrateAppState(state)
    const row = supportedPlanner(hydrated.planner).progress[instanceId]

    expect(row).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 360,
      lastPausedAt: BOUNDED,
      updatedAt: BOUNDED,
    })
    expect(row.activeSince).toBeUndefined()
    expect(hydrated.profiles.p1.missions[DAY].items).toEqual(
      state.profiles.p1.missions[DAY].items,
    )
  })

  it('keeps an open authoritative source live while retagging its timing as mission-owned', () => {
    const { state, instanceId } = liveMissionState('open', 2)

    const hydrated = hydrateAppState(state)
    const row = supportedPlanner(hydrated.planner).progress[instanceId]

    expect(row).toMatchObject({
      status: 'in-progress',
      completionAuthority: 'mission',
      activeElapsedSeconds: 60,
      activeSince: STARTED,
      updatedAt: BOUNDED,
    })
  })

  it('uses activeSince instead of an earlier updatedAt as the finite cutoff', () => {
    const { state, instanceId } = liveMissionState('done', 2)
    const rawPlanner = state.planner as {
      progress: Record<string, { updatedAt: string }>
    }
    rawPlanner.progress[instanceId].updatedAt =
      '2026-08-31T08:55:00.000Z'

    const hydrated = hydrateAppState(state)
    const row = supportedPlanner(hydrated.planner).progress[instanceId]

    expect(row).toMatchObject({
      status: 'paused',
      activeElapsedSeconds: 60,
      lastPausedAt: STARTED,
      updatedAt: STARTED,
    })
  })

  it('retags restored paused mission timing without changing elapsed data', () => {
    const { state, instanceId } = liveMissionState('open', 2)
    const rawPlanner = state.planner as {
      progress: Record<
        string,
        {
          status: string
          activeElapsedSeconds: number
          activeSince?: string
          lastPausedAt?: string
          completionAuthority?: string
        }
      >
    }
    const row = rawPlanner.progress[instanceId]
    row.status = 'paused'
    row.activeElapsedSeconds = 240
    delete row.activeSince
    row.lastPausedAt = BOUNDED
    row.completionAuthority = 'planner'

    const hydrated = hydrateAppState(state)
    expect(supportedPlanner(hydrated.planner).progress[instanceId]).toMatchObject(
      {
        status: 'paused',
        completionAuthority: 'mission',
        activeElapsedSeconds: 240,
        lastPausedAt: BOUNDED,
      },
    )
  })

  it('reconciles a raw backup before exposing restored mission timing', () => {
    const { state, instanceId } = liveMissionState('done')

    const restored = importBackup(
      defaultAppState(),
      serializeAllBackup(state),
    )
    expect(restored.ok).toBe(true)
    if (!restored.ok) throw new Error(restored.error)

    expect(
      supportedPlanner(restored.state.planner).progress[instanceId],
    ).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 360,
      lastPausedAt: BOUNDED,
    })
  })

  it('leaves an unsupported future planner payload opaque', () => {
    const state = defaultAppState()
    const future = {
      version: 99,
      futureMissionState: {
        doNotInterpret: true,
      },
    } as const
    state.planner = future

    const hydrated = hydrateAppState(state)

    expect(hydrated).toBe(state)
    expect(hydrated.planner).toBe(future)
  })
})
