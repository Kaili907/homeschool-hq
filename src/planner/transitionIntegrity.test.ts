import { describe, expect, it } from 'vitest'
import {
  settleMissionPlannerTiming,
  transitionPlannerProgress,
  type PlannerProgressTarget,
} from './progress'
import {
  PLANNER_VERSION,
  type PlannerAction,
  type PlannerState,
} from './types'

const T0 = '2026-08-31T09:00:00.000Z'
const T5 = '2026-08-31T09:05:00.000Z'
const T10 = '2026-08-31T09:10:00.000Z'
const T20 = '2026-08-31T09:20:00.000Z'

const target = (
  blockId = 'work',
  profileId = 'p1',
): PlannerProgressTarget => ({
  profileId,
  date: '2026-08-31',
  blockId,
  blockInstanceId: `planner:${profileId}:2026-08-31:${blockId}`,
})

const emptyPlanner = (): PlannerState => ({
  version: PLANNER_VERSION,
  blocks: [],
  overrides: [],
  progress: {},
})

function apply(
  planner: PlannerState,
  action: PlannerAction,
  at: string,
  to = target(),
): PlannerState {
  return transitionPlannerProgress(planner, to, action, at).state
}

describe('central planner transition policy', () => {
  it.each([
    'start',
    'pause',
    'resume',
    'skip',
    'excuse',
    'move',
  ] as PlannerAction[])(
    'does not let stale %s overwrite completion',
    (staleAction) => {
      const completed = apply(emptyPlanner(), 'complete', T5)
      const result = transitionPlannerProgress(
        completed,
        target(),
        staleAction,
        T10,
      )
      expect(result.state).toBe(completed)
      expect(result.outcome).toEqual({
        kind: 'rejected',
        reason: 'invalid-transition',
        status: 'completed',
      })
      expect(completed.progress[target().blockInstanceId]).toMatchObject({
        status: 'completed',
        completedAt: T5,
        terminalAt: T5,
        updatedAt: T5,
      })
    },
  )

  it.each([
    ['excuse', 'complete', 'excused'],
    ['move', 'complete', 'moved'],
    ['complete', 'excuse', 'completed'],
    ['complete', 'move', 'completed'],
  ] as const)(
    'keeps the first terminal result for %s then %s',
    (first, second, expected) => {
      const terminal = apply(emptyPlanner(), first, T5)
      const result = transitionPlannerProgress(
        terminal,
        target(),
        second,
        T10,
      )
      expect(result.state).toBe(terminal)
      expect(result.outcome.kind).toBe('rejected')
      expect(terminal.progress[target().blockInstanceId].status).toBe(expected)
      expect(terminal.progress[target().blockInstanceId].terminalAt).toBe(T5)
    },
  )

  it('keeps skipped deliberately reversible while completion remains terminal', () => {
    const skipped = apply(emptyPlanner(), 'skip', T5)
    const completed = transitionPlannerProgress(
      skipped,
      target(),
      'complete',
      T10,
    )
    expect(completed.outcome).toEqual({
      kind: 'applied',
      from: 'skipped',
      to: 'completed',
    })
    expect(completed.state.progress[target().blockInstanceId].completedAt).toBe(T10)

    const staleSkip = transitionPlannerProgress(
      completed.state,
      target(),
      'skip',
      T20,
    )
    expect(staleSkip.state).toBe(completed.state)
    expect(staleSkip.state.progress[target().blockInstanceId].status).toBe(
      'completed',
    )
  })

  it('makes repeated completion fully idempotent', () => {
    const completed = apply(emptyPlanner(), 'complete', T5)
    const repeated = transitionPlannerProgress(
      completed,
      target(),
      'complete',
      T20,
      { note: 'stale note' },
    )
    expect(repeated.state).toBe(completed)
    expect(repeated.outcome).toEqual({
      kind: 'idempotent',
      status: 'completed',
    })
    expect(repeated.state.progress[target().blockInstanceId]).toMatchObject({
      activeElapsedSeconds: 0,
      completedAt: T5,
      terminalAt: T5,
      updatedAt: T5,
    })
    expect(
      repeated.state.progress[target().blockInstanceId].completionNote,
    ).toBeUndefined()
  })

  it('allows only explicit reopen to leave completed, excused, and moved', () => {
    for (const action of ['complete', 'excuse', 'move'] as const) {
      const terminal = apply(emptyPlanner(), action, T5)
      const reopened = transitionPlannerProgress(
        terminal,
        target(),
        'reopen',
        T10,
      )
      expect(reopened.outcome).toEqual({
        kind: 'applied',
        from:
          action === 'complete'
            ? 'completed'
            : action === 'excuse'
              ? 'excused'
              : 'moved',
        to: 'not-started',
      })
      expect(reopened.state.progress[target().blockInstanceId]).toMatchObject({
        status: 'not-started',
        activeElapsedSeconds: 0,
        reopenedAt: T10,
        updatedAt: T10,
      })
      expect(
        reopened.state.progress[target().blockInstanceId].terminalAt,
      ).toBeUndefined()
    }
  })
})

describe('elapsed-time idempotence', () => {
  it('does not reset activeSince for repeated start or resume', () => {
    const started = apply(emptyPlanner(), 'start', T0)
    const repeatedStart = transitionPlannerProgress(
      started,
      target(),
      'start',
      T5,
    )
    const repeatedResume = transitionPlannerProgress(
      started,
      target(),
      'resume',
      T10,
    )
    expect(repeatedStart.state).toBe(started)
    expect(repeatedResume.state).toBe(started)
    expect(started.progress[target().blockInstanceId]).toMatchObject({
      status: 'in-progress',
      activeSince: T0,
      activeElapsedSeconds: 0,
      updatedAt: T0,
    })
  })

  it('folds an active segment once across repeated pause', () => {
    const started = apply(emptyPlanner(), 'start', T0)
    const paused = apply(started, 'pause', T10)
    const repeated = transitionPlannerProgress(
      paused,
      target(),
      'pause',
      T20,
    )
    expect(repeated.state).toBe(paused)
    expect(paused.progress[target().blockInstanceId]).toMatchObject({
      status: 'paused',
      activeElapsedSeconds: 600,
      activeSince: undefined,
      lastPausedAt: T10,
      updatedAt: T10,
    })
  })

  it('completes active and paused rows without double-counting', () => {
    const active = apply(emptyPlanner(), 'start', T0)
    const completedActive = apply(active, 'complete', T10)
    expect(
      completedActive.progress[target().blockInstanceId].activeElapsedSeconds,
    ).toBe(600)

    const paused = apply(active, 'pause', T5)
    const completedPaused = apply(paused, 'complete', T20)
    expect(
      completedPaused.progress[target().blockInstanceId].activeElapsedSeconds,
    ).toBe(300)
    expect(completedPaused.progress[target().blockInstanceId].completedAt).toBe(
      T20,
    )
  })

  it('never subtracts time for an invalid or reversed clock', () => {
    const started = apply(emptyPlanner(), 'start', T10)
    const pausedEarlier = apply(started, 'pause', T5)
    expect(
      pausedEarlier.progress[target().blockInstanceId].activeElapsedSeconds,
    ).toBe(0)
  })

  it('starts a second block by pausing the first in the same transition', () => {
    const firstTarget = target('first')
    const secondTarget = target('second')
    const first = apply(emptyPlanner(), 'start', T0, firstTarget)
    const second = transitionPlannerProgress(
      first,
      secondTarget,
      'start',
      T10,
    )
    expect(second.state.progress[firstTarget.blockInstanceId]).toMatchObject({
      status: 'paused',
      activeElapsedSeconds: 600,
      lastPausedAt: T10,
    })
    expect(second.state.progress[secondTarget.blockInstanceId]).toMatchObject({
      status: 'in-progress',
      activeSince: T10,
    })
  })

  it('retags an atomically paused mission row as mission-owned timing', () => {
    const missionTarget = target('mission:source')
    const nextTarget = target('next')
    const missionStarted = transitionPlannerProgress(
      emptyPlanner(),
      missionTarget,
      'start',
      T0,
      { completionAuthority: 'planner' },
    ).state
    const nextStarted = transitionPlannerProgress(
      missionStarted,
      nextTarget,
      'start',
      T5,
    ).state
    expect(nextStarted.progress[missionTarget.blockInstanceId]).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 300,
    })
  })

  it('does not pause another row when the target transition is rejected', () => {
    const activeTarget = target('active')
    const terminalTarget = target('terminal')
    let planner = apply(emptyPlanner(), 'start', T0, activeTarget)
    planner = apply(planner, 'complete', T5, terminalTarget)
    const rejected = transitionPlannerProgress(
      planner,
      terminalTarget,
      'start',
      T10,
    )
    expect(rejected.state).toBe(planner)
    expect(planner.progress[activeTarget.blockInstanceId]).toMatchObject({
      status: 'in-progress',
      activeSince: T0,
    })
  })
})

describe('mission timing boundary', () => {
  it('upgrades a legacy planner tag when a mission-owned transition is applied', () => {
    const missionTarget = target('mission:item')
    const legacy = transitionPlannerProgress(
      emptyPlanner(),
      missionTarget,
      'start',
      T0,
      { completionAuthority: 'planner' },
    ).state
    const paused = transitionPlannerProgress(
      legacy,
      missionTarget,
      'pause',
      T5,
      { completionAuthority: 'mission' },
    )

    expect(paused.state.progress[missionTarget.blockInstanceId]).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 300,
    })
  })

  it('marks another active mission timer as mission-owned when pausing it atomically', () => {
    const missionTarget = target('mission:first')
    const nextTarget = target('manual:next')
    const legacy = transitionPlannerProgress(
      emptyPlanner(),
      missionTarget,
      'start',
      T0,
      { completionAuthority: 'planner' },
    ).state
    const next = transitionPlannerProgress(
      legacy,
      nextTarget,
      'start',
      T5,
      { completionAuthority: 'planner' },
    )

    expect(next.state.progress[missionTarget.blockInstanceId]).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 300,
    })
    expect(next.state.progress[nextTarget.blockInstanceId]).toMatchObject({
      status: 'in-progress',
      completionAuthority: 'planner',
    })
  })

  it('settles a live mission timer without storing mission completion', () => {
    const missionTarget = target('mission:item')
    const started = transitionPlannerProgress(
      emptyPlanner(),
      missionTarget,
      'start',
      T0,
      { completionAuthority: 'mission' },
    ).state
    const settled = settleMissionPlannerTiming(started, missionTarget, T5)
    expect(settled.progress[missionTarget.blockInstanceId]).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 300,
      lastPausedAt: T5,
    })
    expect(
      settled.progress[missionTarget.blockInstanceId].completedAt,
    ).toBeUndefined()
    expect(settleMissionPlannerTiming(settled, missionTarget, T10)).toBe(settled)
  })

  it('rejects planner-owned completion for mission-authority progress', () => {
    const missionTarget = target('mission:item')
    const started = transitionPlannerProgress(
      emptyPlanner(),
      missionTarget,
      'start',
      T0,
      { completionAuthority: 'mission' },
    ).state
    const completed = transitionPlannerProgress(
      started,
      missionTarget,
      'complete',
      T5,
    )
    expect(completed.state).toBe(started)
    expect(completed.outcome.kind).toBe('rejected')
  })
})
