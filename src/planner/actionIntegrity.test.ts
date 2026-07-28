import { describe, expect, it } from 'vitest'
import { defaultSchoolYear } from '../curriculum/pacing'
import { hydrateAppState } from '../appState'
import { defaultAppState, emptyProfile } from '../migration'
import type { AppState } from '../types'
import {
  applyPlannerCommand,
  type PlannerCommandContext,
} from './actions'
import { plannerBlockInstanceId } from './resume'
import {
  PLANNER_VERSION,
  type PlannerBlock,
  type PlannerCommand,
  type PlannerOccurrenceSnapshot,
  type PlannerState,
} from './types'

const DAY = '2026-08-31'
const T0 = '2026-08-31T09:00:00.000Z'
const T5 = '2026-08-31T09:05:00.000Z'
const T10 = '2026-08-31T09:10:00.000Z'
const context: PlannerCommandContext = {
  now: T0,
  currentLocalDate: DAY,
  docs: [],
  schoolYear: defaultSchoolYear(DAY),
}

function manual(
  id = 'manual:work',
  assignedProfileIds = ['p1'],
): PlannerBlock {
  return {
    id,
    title: 'Current work',
    studentInstructions: 'Follow the current instructions.',
    category: 'custom',
    source: { kind: 'manual' },
    assignedProfileIds,
    assignToAll: false,
    weekdays: [1],
    startTime: '09:00',
    expectedMinutes: 30,
    scheduleBehavior: 'flexible',
    requiresParentHelp: false,
    active: true,
    createdAt: T0,
    updatedAt: T0,
  }
}

function romeo(id = 'romeo:work'): PlannerBlock {
  return {
    ...manual(id),
    category: 'romeo-online',
    source: { kind: 'romeo-online', activityId: 'romeo-practice' },
    linkedActivity: {
      adapter: 'romeo-online',
      activityId: 'romeo-practice',
    },
  }
}

function planner(blocks: PlannerBlock[] = [manual()]): PlannerState {
  return {
    version: PLANNER_VERSION,
    blocks,
    overrides: [],
    progress: {},
  }
}

function app(blocks: PlannerBlock[] = [manual()]): AppState {
  const state = defaultAppState()
  state.profiles.p1 = emptyProfile('p1', 'One', '6')
  state.profiles.p2 = emptyProfile('p2', 'Two', '6')
  state.activeProfileId = 'p1'
  state.planner = planner(blocks)
  return state
}

function command(
  action: PlannerCommand['action'],
  over: Partial<PlannerCommand> = {},
): PlannerCommand {
  const blockId = over.target?.blockId ?? 'manual:work'
  const profileId = over.target?.profileId ?? 'p1'
  return {
    actor: over.actor ?? { kind: 'parent' },
    action,
    target: {
      profileId,
      date: over.target?.date ?? DAY,
      blockId,
      blockInstanceId:
        over.target?.blockInstanceId ??
        plannerBlockInstanceId(profileId, over.target?.date ?? DAY, blockId),
    },
  }
}

describe('current-state planner command validation', () => {
  it('starts a currently assigned block using identifiers only', () => {
    const result = applyPlannerCommand(app(), command('start'), context)
    const instanceId = command('start').target.blockInstanceId
    expect(result.outcome).toEqual({
      kind: 'applied',
      from: 'not-started',
      to: 'in-progress',
    })
    expect(result.state.planner).toMatchObject({
      progress: {
        [instanceId]: {
          profileId: 'p1',
          blockId: 'manual:work',
          status: 'in-progress',
          activeSince: T0,
        },
      },
    })
    expect(result.navigation).toEqual({
      destination: { kind: 'manual-activity' },
      source: 'safe-fallback',
      granularity: 'activity',
    })
  })

  it('rejects an unknown profile without changing state', () => {
    const state = app()
    const result = applyPlannerCommand(
      state,
      command('start', {
        target: {
          profileId: 'missing',
          date: DAY,
          blockId: 'manual:work',
          blockInstanceId: plannerBlockInstanceId(
            'missing',
            DAY,
            'manual:work',
          ),
        },
      }),
      context,
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'profile-not-found',
    })
  })

  it('rejects fabricated and mismatched instance IDs without orphan progress', () => {
    const state = app()
    const result = applyPlannerCommand(
      state,
      command('complete', {
        target: {
          profileId: 'p1',
          date: DAY,
          blockId: 'manual:work',
          blockInstanceId: 'planner:p1:2026-08-31:fabricated',
        },
      }),
      context,
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'invalid-instance-id',
    })
    expect(result).not.toHaveProperty('navigation')
    expect((state.planner as PlannerState).progress).toEqual({})
  })

  it('rejects unknown and removed block IDs without creating progress', () => {
    const unknownState = app()
    const unknown = applyPlannerCommand(
      unknownState,
      command('start', {
        target: {
          profileId: 'p1',
          date: DAY,
          blockId: 'manual:unknown',
          blockInstanceId: plannerBlockInstanceId(
            'p1',
            DAY,
            'manual:unknown',
          ),
        },
      }),
      context,
    )
    expect(unknown.state).toBe(unknownState)
    expect(unknown.outcome).toEqual({
      kind: 'rejected',
      reason: 'block-not-found',
    })

    const removedState = app([])
    const removed = applyPlannerCommand(
      removedState,
      command('start'),
      context,
    )
    expect(removed.state).toBe(removedState)
    expect(removed.outcome).toEqual({
      kind: 'rejected',
      reason: 'block-not-found',
    })
    expect((removedState.planner as PlannerState).progress).toEqual({})
  })

  it('rejects a block deactivated after render', () => {
    const stale = manual()
    const current = { ...stale, active: false, updatedAt: T5 }
    const state = app([current])
    const result = applyPlannerCommand(state, command('start'), {
      ...context,
      now: T5,
    })
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'block-not-actionable',
    })
    expect(result.navigation).toBeUndefined()
  })

  it('rejects a stale command after assignment changes', () => {
    const state = app([manual('manual:work', ['p2'])])
    const result = applyPlannerCommand(state, command('start'), context)
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'not-assigned',
    })
  })

  it('returns navigation reselected from the latest template state', () => {
    const latest = manual()
    latest.linkedActivity = {
      adapter: 'route',
      activityId: 'mindset',
      route: 'mindset',
    }
    latest.updatedAt = T5

    const result = applyPlannerCommand(
      app([latest]),
      command('start'),
      { ...context, now: T5 },
    )

    expect(result.outcome.kind).toBe('applied')
    expect(result.navigation).toEqual({
      destination: { kind: 'mindset' },
      source: 'linked-activity',
      granularity: 'activity',
    })
  })

  it('rejects a valid template on a date where it is not actionable', () => {
    const tuesday = '2026-09-01'
    const state = app()
    const result = applyPlannerCommand(
      state,
      command('start', {
        target: {
          profileId: 'p1',
          date: tuesday,
          blockId: 'manual:work',
          blockInstanceId: plannerBlockInstanceId(
            'p1',
            tuesday,
            'manual:work',
          ),
        },
      }),
      { ...context, now: '2026-09-01T09:00:00.000Z' },
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'block-not-actionable',
    })
  })

  it('rejects cross-profile student commands before selecting the target', () => {
    const state = app()
    const result = applyPlannerCommand(
      state,
      command('start', {
        actor: { kind: 'student', profileId: 'p2' },
      }),
      context,
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'actor-profile-mismatch',
    })
  })

  it('rejects a student command when the actor is not the active profile', () => {
    const state = app([manual('manual:work', ['p2'])])
    state.activeProfileId = 'p1'
    const result = applyPlannerCommand(
      state,
      command('start', {
        actor: { kind: 'student', profileId: 'p2' },
        target: {
          profileId: 'p2',
          date: DAY,
          blockId: 'manual:work',
          blockInstanceId: plannerBlockInstanceId(
            'p2',
            DAY,
            'manual:work',
          ),
        },
      }),
      context,
    )

    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'active-profile-mismatch',
    })
    expect(result).not.toHaveProperty('navigation')
  })

  it('restricts student commands to the injected family-local date', () => {
    const tuesday = '2026-09-01'
    const state = app()
    state.activeProfileId = 'p1'
    const result = applyPlannerCommand(
      state,
      command('start', {
        actor: { kind: 'student', profileId: 'p1' },
        target: {
          profileId: 'p1',
          date: tuesday,
          blockId: 'manual:work',
          blockInstanceId: plannerBlockInstanceId(
            'p1',
            tuesday,
            'manual:work',
          ),
        },
      }),
      context,
    )

    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'student-date-restricted',
    })
    expect(result).not.toHaveProperty('navigation')
  })

  it('binds a student command to the authenticated active profile', () => {
    const state = app([manual('manual:work', ['p2'])])
    const result = applyPlannerCommand(
      state,
      command('start', {
        actor: { kind: 'student', profileId: 'p2' },
        target: {
          profileId: 'p2',
          date: DAY,
          blockId: 'manual:work',
          blockInstanceId: plannerBlockInstanceId(
            'p2',
            DAY,
            'manual:work',
          ),
        },
      }),
      context,
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'active-profile-mismatch',
    })
    expect(result.navigation).toBeUndefined()
  })

  it('restricts a student command to the current family-local date', () => {
    const tomorrow = '2026-09-01'
    const block = { ...manual(), weekdays: [2 as const] }
    const state = app([block])
    const result = applyPlannerCommand(
      state,
      command('start', {
        actor: { kind: 'student', profileId: 'p1' },
        target: {
          profileId: 'p1',
          date: tomorrow,
          blockId: block.id,
          blockInstanceId: plannerBlockInstanceId(
            'p1',
            tomorrow,
            block.id,
          ),
        },
      }),
      { ...context, now: '2026-09-01T09:00:00.000Z' },
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'student-date-restricted',
    })
    expect(result.navigation).toBeUndefined()
  })

  it('rejects a target profile that is not assigned the block', () => {
    const state = app()
    const result = applyPlannerCommand(
      state,
      command('start', {
        target: {
          profileId: 'p2',
          date: DAY,
          blockId: 'manual:work',
          blockInstanceId: plannerBlockInstanceId(
            'p2',
            DAY,
            'manual:work',
          ),
        },
      }),
      context,
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'not-assigned',
    })
  })

  it.each(['skip', 'excuse', 'move', 'reopen'] as const)(
    'rejects student-originated parent action %s',
    (action) => {
      const state = app()
      state.activeProfileId = 'p1'
      const result = applyPlannerCommand(
        state,
        command(action, {
          actor: { kind: 'student', profileId: 'p1' },
        }),
        context,
      )
      expect(result.state).toBe(state)
      expect(result.outcome).toEqual({
        kind: 'rejected',
        reason: 'permission-denied',
      })
    },
  )

  it('rejects unsupported future planner data without rewriting it', () => {
    const state = app()
    state.planner = {
      version: PLANNER_VERSION + 1,
      futureField: { preserved: true },
    }
    const before = JSON.stringify(state.planner)
    const result = applyPlannerCommand(state, command('start'), context)
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'planner-version-unsupported',
    })
    expect(JSON.stringify(result.state.planner)).toBe(before)
  })

  it.each(['2026-08-30', '2026-09-01'] as const)(
    'rejects direct manual-mission completion outside today (%s)',
    (date) => {
      const state = app([])
      state.profiles.p1.missions[date] = {
        items: [
          {
            id: 'manual-source',
            label: 'Source-owned mission',
            done: false,
          },
        ],
      }
      const blockId = 'mission:manual-source'
      const result = applyPlannerCommand(
        state,
        command('complete', {
          target: {
            profileId: 'p1',
            date,
            blockId,
            blockInstanceId: plannerBlockInstanceId(
              'p1',
              date,
              blockId,
            ),
          },
        }),
        context,
      )
      expect(result.state).toBe(state)
      expect(result.outcome).toMatchObject({
        kind: 'rejected',
        reason: 'mission-date-restricted',
      })
      expect(state.profiles.p1.missions[date].items[0].done).toBe(false)
    },
  )

  it('reports a removed generated source instead of resurrecting stale progress', () => {
    const state = app([])
    const blockId = 'curriculum:missing:week-1'
    const blockInstanceId = plannerBlockInstanceId('p1', DAY, blockId)
    const occurrence: PlannerOccurrenceSnapshot = {
      blockInstanceId,
      blockId,
      profileId: 'p1',
      date: DAY,
      title: 'Removed curriculum',
      studentInstructions: 'Legacy instructions',
      category: 'manuel-academy',
      source: {
        kind: 'curriculum',
        subjectId: 'missing',
        subjectLabel: 'Missing',
        week: 1,
        items: [],
      },
      preferredStartTime: '09:00',
      preferredStartMinute: 540,
      placement: {
        kind: 'scheduled',
        startMinute: 540,
        endMinute: 570,
        startTime: '09:00',
      },
      expectedMinutes: 30,
      scheduleBehavior: 'flexible',
      requiresParentHelp: false,
      capturedAt: T0,
    }
    ;(state.planner as PlannerState).progress[blockInstanceId] = {
      profileId: 'p1',
      date: DAY,
      blockInstanceId,
      blockId,
      status: 'paused',
      activeElapsedSeconds: 120,
      occurrence,
      updatedAt: T0,
    }

    const result = applyPlannerCommand(
      state,
      command('resume', {
        target: {
          profileId: 'p1',
          date: DAY,
          blockId,
          blockInstanceId,
        },
      }),
      context,
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'source-unavailable',
      status: 'paused',
    })
    expect(
      (state.planner as PlannerState).progress[blockInstanceId].status,
    ).toBe('paused')
  })

  it('allows a missing mission source to close its live timer but not resume it', () => {
    const state = app([])
    const blockId = 'mission:removed-source'
    const blockInstanceId = plannerBlockInstanceId('p1', DAY, blockId)
    const occurrence: PlannerOccurrenceSnapshot = {
      blockInstanceId,
      blockId,
      profileId: 'p1',
      date: DAY,
      title: 'Removed mission',
      studentInstructions: 'Older source timing.',
      category: 'existing-mission',
      source: {
        kind: 'mission',
        missionItemId: 'removed-source',
        autoOnly: false,
      },
      preferredStartTime: '09:00',
      preferredStartMinute: 540,
      placement: {
        kind: 'scheduled',
        startMinute: 540,
        endMinute: 570,
        startTime: '09:00',
      },
      expectedMinutes: 30,
      scheduleBehavior: 'flexible',
      requiresParentHelp: false,
      capturedAt: T0,
    }
    ;(state.planner as PlannerState).progress[blockInstanceId] = {
      profileId: 'p1',
      date: DAY,
      blockInstanceId,
      blockId,
      status: 'in-progress',
      completionAuthority: 'mission',
      startedAt: T0,
      activeSince: T0,
      activeElapsedSeconds: 0,
      occurrence,
      updatedAt: T0,
    }
    const target = {
      profileId: 'p1',
      date: DAY,
      blockId,
      blockInstanceId,
    }

    const paused = applyPlannerCommand(
      state,
      command('pause', { target }),
      { ...context, now: T5 },
    )
    expect(paused.outcome).toEqual({
      kind: 'applied',
      from: 'in-progress',
      to: 'paused',
    })
    expect(
      (paused.state.planner as PlannerState).progress[blockInstanceId],
    ).toMatchObject({
      status: 'paused',
      completionAuthority: 'mission',
      activeElapsedSeconds: 300,
    })

    const resumed = applyPlannerCommand(
      paused.state,
      command('resume', { target }),
      { ...context, now: T5 },
    )
    expect(resumed.outcome).toMatchObject({
      kind: 'rejected',
      reason: 'source-unavailable',
    })
    expect(resumed.navigation).toBeUndefined()
  })
})

describe('public command transition enforcement', () => {
  it('keeps repeated Start idempotent and preserves activeSince', () => {
    const first = applyPlannerCommand(app(), command('start'), context)
    const repeated = applyPlannerCommand(first.state, command('start'), {
      ...context,
      now: T5,
    })
    expect(repeated.state).toBe(first.state)
    expect(repeated.outcome).toEqual({
      kind: 'idempotent',
      status: 'in-progress',
    })
    expect(repeated.navigation?.destination).toEqual({
      kind: 'manual-activity',
    })
    expect(
      (repeated.state.planner as PlannerState).progress[
        command('start').target.blockInstanceId
      ].activeSince,
    ).toBe(T0)
  })

  it('rejects stale dispositions after completion in both public command paths', () => {
    const completed = applyPlannerCommand(app(), command('complete'), context)
    const staleExcuse = applyPlannerCommand(
      completed.state,
      command('excuse'),
      { ...context, now: T5 },
    )
    expect(staleExcuse.state).toBe(completed.state)
    expect(staleExcuse.outcome).toEqual({
      kind: 'rejected',
      reason: 'invalid-transition',
      status: 'completed',
    })

    const excused = applyPlannerCommand(app(), command('excuse'), context)
    const staleComplete = applyPlannerCommand(
      excused.state,
      command('complete'),
      { ...context, now: T5 },
    )
    expect(staleComplete.state).toBe(excused.state)
    expect(staleComplete.outcome).toEqual({
      kind: 'rejected',
      reason: 'invalid-transition',
      status: 'excused',
    })
  })

  it('requires an explicit parent reopen before a terminal row can restart', () => {
    const completed = applyPlannerCommand(app(), command('complete'), context)
    const staleStart = applyPlannerCommand(
      completed.state,
      command('start'),
      { ...context, now: T5 },
    )
    expect(staleStart.state).toBe(completed.state)
    expect(staleStart.outcome.kind).toBe('rejected')

    const reopened = applyPlannerCommand(
      completed.state,
      command('reopen'),
      { ...context, now: T5 },
    )
    expect(reopened.outcome).toEqual({
      kind: 'applied',
      from: 'completed',
      to: 'not-started',
    })
    expect(
      (reopened.state.planner as PlannerState).progress[
        command('reopen').target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'not-started',
      activeElapsedSeconds: 0,
      reopenedAt: T5,
    })
  })

  it.each(['recurrence', 'assignment', 'date-removal'] as const)(
    'rejects reopen when current %s no longer produces the occurrence',
    (change) => {
      const completed = applyPlannerCommand(
        app(),
        command('complete'),
        context,
      )
      const current = completed.state.planner as PlannerState
      const changedPlanner: PlannerState = {
        ...current,
        blocks:
          change === 'recurrence'
            ? current.blocks.map((block) => ({
                ...block,
                weekdays: [2],
                updatedAt: T5,
              }))
            : change === 'assignment'
              ? current.blocks.map((block) => ({
                  ...block,
                  assignedProfileIds: ['p2'],
                  updatedAt: T5,
                }))
              : current.blocks,
        overrides:
          change === 'date-removal'
            ? [
                {
                  id: 'remove-current-occurrence',
                  date: DAY,
                  action: 'remove',
                  targetBlockId: 'manual:work',
                  createdAt: T5,
                  updatedAt: T5,
                },
              ]
            : current.overrides,
      }
      const state = { ...completed.state, planner: changedPlanner }
      const reopened = applyPlannerCommand(
        state,
        command('reopen'),
        { ...context, now: T5 },
      )
      expect(reopened.state).toBe(state)
      expect(reopened.outcome).toMatchObject({
        kind: 'rejected',
        reason: 'source-unavailable',
        status: 'completed',
      })
    },
  )
})

describe('unavailable manual occurrence settlement', () => {
  it('pauses a real in-progress occurrence after template removal exactly once', () => {
    const started = applyPlannerCommand(app(), command('start'), context)
    const withoutTemplate: AppState = {
      ...started.state,
      planner: {
        ...(started.state.planner as PlannerState),
        blocks: [],
      },
    }

    const completedDirectly = applyPlannerCommand(
      withoutTemplate,
      command('complete'),
      { ...context, now: T5 },
    )
    expect(completedDirectly.outcome).toEqual({
      kind: 'applied',
      from: 'in-progress',
      to: 'completed',
    })
    expect(
      (completedDirectly.state.planner as PlannerState).progress[
        command('complete').target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'completed',
      activeElapsedSeconds: 300,
      completedAt: T5,
    })

    const repeatedComplete = applyPlannerCommand(
      completedDirectly.state,
      command('complete'),
      { ...context, now: T10 },
    )
    expect(repeatedComplete.state).toBe(completedDirectly.state)
    expect(repeatedComplete.outcome).toEqual({
      kind: 'idempotent',
      status: 'completed',
    })
    expect(
      (repeatedComplete.state.planner as PlannerState).progress[
        command('complete').target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'completed',
      activeElapsedSeconds: 300,
      completedAt: T5,
      terminalAt: T5,
      updatedAt: T5,
    })

    const paused = applyPlannerCommand(
      withoutTemplate,
      command('pause'),
      { ...context, now: T5 },
    )
    expect(paused.outcome).toEqual({
      kind: 'applied',
      from: 'in-progress',
      to: 'paused',
    })
    expect(
      (paused.state.planner as PlannerState).progress[
        command('pause').target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'paused',
      activeElapsedSeconds: 300,
      activeSince: undefined,
      lastPausedAt: T5,
    })

    const repeated = applyPlannerCommand(
      paused.state,
      command('pause'),
      { ...context, now: T10 },
    )
    expect(repeated.state).toBe(paused.state)
    expect(repeated.outcome).toEqual({
      kind: 'idempotent',
      status: 'paused',
    })
    expect(
      (repeated.state.planner as PlannerState).progress[
        command('pause').target.blockInstanceId
      ].activeElapsedSeconds,
    ).toBe(300)
  })

  it('completes a paused occurrence after template deactivation without losing elapsed time', () => {
    const started = applyPlannerCommand(app(), command('start'), context)
    const paused = applyPlannerCommand(
      started.state,
      command('pause'),
      { ...context, now: T5 },
    )
    const current: AppState = {
      ...paused.state,
      planner: {
        ...(paused.state.planner as PlannerState),
        blocks: [
          {
            ...manual(),
            active: false,
            updatedAt: T10,
          },
        ],
      },
    }

    const completed = applyPlannerCommand(
      current,
      command('complete'),
      { ...context, now: T10 },
    )
    expect(completed.outcome).toEqual({
      kind: 'applied',
      from: 'paused',
      to: 'completed',
    })
    expect(
      (completed.state.planner as PlannerState).progress[
        command('complete').target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'completed',
      activeElapsedSeconds: 300,
      completedAt: T10,
      terminalAt: T10,
    })

    const resume = applyPlannerCommand(
      current,
      command('resume'),
      { ...context, now: T10 },
    )
    expect(resume.state).toBe(current)
    expect(resume.outcome).toEqual({
      kind: 'rejected',
      reason: 'source-unavailable',
      status: 'paused',
    })
    expect(resume.navigation).toBeUndefined()
  })

  it('rejects deterministic raw progress when normalization had to synthesize its occurrence', () => {
    const state = app([])
    const instanceId = command('pause').target.blockInstanceId
    ;(state.planner as PlannerState).progress[instanceId] = {
      profileId: 'p1',
      date: DAY,
      blockInstanceId: instanceId,
      blockId: 'manual:work',
      status: 'in-progress',
      startedAt: T0,
      activeSince: T0,
      activeElapsedSeconds: 0,
      updatedAt: T0,
    }

    const result = applyPlannerCommand(
      state,
      command('pause'),
      { ...context, now: T5 },
    )
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'source-unavailable',
      status: 'in-progress',
    })
    expect(
      (state.planner as PlannerState).progress[instanceId],
    ).toMatchObject({
      status: 'in-progress',
      activeSince: T0,
      activeElapsedSeconds: 0,
    })
    expect(
      (state.planner as PlannerState).progress[instanceId].occurrence,
    ).toBeUndefined()
  })

  it('keeps a normalization-only archive read-only after production hydration', () => {
    const state = app([])
    const instanceId = command('complete').target.blockInstanceId
    ;(state.planner as PlannerState).progress[instanceId] = {
      profileId: 'p1',
      date: DAY,
      blockInstanceId: instanceId,
      blockId: 'manual:work',
      status: 'in-progress',
      startedAt: T0,
      activeSince: T0,
      activeElapsedSeconds: 0,
      updatedAt: T0,
    }

    const hydrated = hydrateAppState(
      JSON.parse(JSON.stringify(state)) as AppState,
    )
    expect(
      (hydrated.planner as PlannerState).progress[instanceId].occurrence,
    ).toMatchObject({
      provenance: 'normalized-archive',
      source: { kind: 'manual' },
    })

    const result = applyPlannerCommand(
      hydrated,
      command('complete'),
      { ...context, now: T5 },
    )
    expect(result.state).toBe(hydrated)
    expect(result.outcome).toEqual({
      kind: 'rejected',
      reason: 'source-unavailable',
      status: 'in-progress',
    })
  })

  it('pauses a removed linked Romeo Online occurrence but cannot restart it', () => {
    const item = romeo()
    const target = {
      profileId: 'p1',
      date: DAY,
      blockId: item.id,
      blockInstanceId: plannerBlockInstanceId('p1', DAY, item.id),
    }
    const romeoCommand = (action: PlannerCommand['action']) =>
      command(action, { target })
    const started = applyPlannerCommand(
      app([item]),
      romeoCommand('start'),
      context,
    )
    const removed: AppState = {
      ...started.state,
      planner: {
        ...(started.state.planner as PlannerState),
        blocks: [],
      },
    }

    const paused = applyPlannerCommand(
      removed,
      romeoCommand('pause'),
      { ...context, now: T5 },
    )
    expect(paused.outcome).toEqual({
      kind: 'applied',
      from: 'in-progress',
      to: 'paused',
    })
    expect(
      (paused.state.planner as PlannerState).progress[target.blockInstanceId],
    ).toMatchObject({
      status: 'paused',
      completionAuthority: 'planner',
      activeElapsedSeconds: 300,
      lastPausedAt: T5,
    })

    const resumed = applyPlannerCommand(
      paused.state,
      romeoCommand('resume'),
      { ...context, now: T10 },
    )
    expect(resumed.state).toBe(paused.state)
    expect(resumed.outcome).toEqual({
      kind: 'rejected',
      reason: 'source-unavailable',
      status: 'paused',
    })
    expect(resumed.navigation).toBeUndefined()
  })

  it('completes a deactivated linked Romeo Online occurrence idempotently', () => {
    const item = romeo()
    const target = {
      profileId: 'p1',
      date: DAY,
      blockId: item.id,
      blockInstanceId: plannerBlockInstanceId('p1', DAY, item.id),
    }
    const romeoCommand = (action: PlannerCommand['action']) =>
      command(action, { target })
    const started = applyPlannerCommand(
      app([item]),
      romeoCommand('start'),
      context,
    )
    const deactivated: AppState = {
      ...started.state,
      planner: {
        ...(started.state.planner as PlannerState),
        blocks: [{ ...item, active: false, updatedAt: T5 }],
      },
    }

    const completed = applyPlannerCommand(
      deactivated,
      romeoCommand('complete'),
      { ...context, now: T5 },
    )
    expect(completed.outcome).toEqual({
      kind: 'applied',
      from: 'in-progress',
      to: 'completed',
    })
    expect(
      (completed.state.planner as PlannerState).progress[
        target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'completed',
      activeElapsedSeconds: 300,
      completedAt: T5,
      terminalAt: T5,
    })

    const repeated = applyPlannerCommand(
      completed.state,
      romeoCommand('complete'),
      { ...context, now: T10 },
    )
    expect(repeated.state).toBe(completed.state)
    expect(repeated.outcome).toEqual({
      kind: 'idempotent',
      status: 'completed',
    })
    expect(
      (repeated.state.planner as PlannerState).progress[
        target.blockInstanceId
      ],
    ).toMatchObject({
      status: 'completed',
      activeElapsedSeconds: 300,
      completedAt: T5,
      terminalAt: T5,
      updatedAt: T5,
    })
  })
})
