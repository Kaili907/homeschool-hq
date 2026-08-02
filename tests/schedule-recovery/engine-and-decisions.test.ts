import { describe, expect, it } from 'vitest'
import {
  addRecoveryProposal,
  applyRecoveryDecision,
  createRecoveryState,
  recoveryAuditForStudent,
  undoRecovery,
} from '../../scheduling/recovery/decisions'
import {
  explainProposalForStudent,
  generateRecoveryProposal,
} from '../../scheduling/recovery/engine'
import { validateRecoveryProposal } from '../../scheduling/recovery/schemas'
import {
  compareLocalDateTime,
} from '../../scheduling/recovery/time'
import {
  type RecoveryActor,
  type RecoveryChoice,
  type RecoveryDecision,
  type RecoveryOption,
  type RecoveryState,
  type ScheduleEvent,
} from '../../scheduling/recovery/types'
import {
  ALL_ACTIVITY_KINDS,
  eventChange,
  makeCatchUpBlock,
  makeEvent,
  makeRecoveryScenario,
  makeSchedule,
  makeStudent,
  makeWorkItem,
  NOW,
} from './fixtures'

const PARENT: RecoveryActor = {
  id: 'parent-manuel',
  role: 'parent',
  displayName: 'Parent',
}

const SYSTEM: RecoveryActor = {
  id: 'schedule-recovery',
  role: 'system',
  displayName: 'Recovery engine',
}

const ALL_CHOICES: readonly RecoveryChoice[] = [
  'move-to-tomorrow',
  'shorten-today',
  'split-sessions',
  'move-to-catch-up-block',
  'replace-lower-priority-review',
  'keep-due-date-rebalance-week',
  'parent-manual',
  'leave-unchanged',
]

function optionFor(
  stateOrProposal:
    | RecoveryState['proposals'][number]
    | { options: RecoveryOption[] },
  choice: RecoveryChoice,
): RecoveryOption {
  const option = stateOrProposal.options.find(
    (candidate) => candidate.choice === choice,
  )
  if (!option) throw new Error(`missing ${choice}`)
  return option
}

function stateWithProposal() {
  const scenario = makeRecoveryScenario()
  const proposal = generateRecoveryProposal({
    schedule: scenario.schedule,
    trigger: {
      kind: 'missed',
      eventId: scenario.missedEvent.id,
      observedAt: NOW,
      remainingMinutes: 60,
      reason: 'The lesson was interrupted by a family need.',
    },
    proposalId: 'proposal-main',
    now: NOW,
  })
  const added = addRecoveryProposal(createRecoveryState(scenario.schedule), proposal)
  if (!added.ok) throw new Error(added.errors.map((error) => error.message).join('; '))
  return { ...scenario, proposal, state: added.value }
}

function approve(
  state: RecoveryState,
  choice: RecoveryChoice,
  sequence = choice,
) {
  const proposal = state.proposals.find(
    (candidate) => candidate.status === 'pending-parent',
  )
  if (!proposal) throw new Error('missing pending proposal')
  const option = optionFor(proposal, choice)
  const decision: RecoveryDecision = {
    id: `decision-${sequence}`,
    proposalId: proposal.id,
    kind: 'approve',
    actor: PARENT,
    decidedAt: '2026-07-28T16:05:00Z',
    selectedOptionId: option.id,
    reason: `Parent selected ${choice}.`,
  }
  return applyRecoveryDecision({ state, decision })
}

describe('automatic proposal generation', () => {
  it('always shows all eight choices, why, tradeoff, safety, and student text', () => {
    const { proposal } = stateWithProposal()

    expect(proposal.options.map((option) => option.choice)).toEqual(ALL_CHOICES)
    expect(new Set(proposal.options.map((option) => option.id)).size).toBe(8)
    for (const option of proposal.options) {
      expect(option.label).not.toHaveLength(0)
      expect(option.why).not.toHaveLength(0)
      expect(option.tradeoff.gained).not.toHaveLength(0)
      expect(option.tradeoff.cost).not.toHaveLength(0)
      expect(option.studentExplanation).not.toHaveLength(0)
      expect(typeof option.preservesInvariants).toBe('boolean')
    }
    expect(validateRecoveryProposal(proposal)).toMatchObject({ valid: true })
    expect(explainProposalForStudent(proposal)).not.toHaveLength(0)
    expect(proposal.summary).toMatch(/No change is applied without parent approval/)
  })

  it('produces safe generated changes for six automatic choices', () => {
    const { proposal } = stateWithProposal()

    for (const choice of ALL_CHOICES.slice(0, 6)) {
      const option = optionFor(proposal, choice)
      expect(option.availability, `${choice}: ${option.why}`).toBe(
        'requires-parent',
      )
      expect(option.preservesInvariants, choice).toBe(true)
      expect(option.changes.length, choice).toBeGreaterThan(0)
    }
    expect(optionFor(proposal, 'parent-manual')).toMatchObject({
      availability: 'requires-parent',
      changes: [],
    })
    expect(optionFor(proposal, 'leave-unchanged')).toMatchObject({
      availability: 'available',
      changes: [],
    })
  })

  it.each(ALL_ACTIVITY_KINDS)(
    'supports recovery proposal presentation for %s',
    (kind) => {
      const work = makeWorkItem({
        id: `work-${kind}`,
        title: kind,
        kind,
      })
      const event = makeEvent({
        id: `event-${kind}`,
        title: kind,
        kind,
        workItemId: work.id,
        status: 'interrupted',
      })
      const schedule = makeSchedule({
        workItems: [work],
        events: [event],
        catchUpBlocks: [
          makeCatchUpBlock({
            studentId: event.studentId,
            date: '2026-07-29',
          }),
        ],
      })

      const proposal = generateRecoveryProposal({
        schedule,
        trigger: {
          kind: 'interrupted',
          eventId: event.id,
          observedAt: NOW,
          actualMinutes: 10,
        },
        proposalId: `proposal-${kind}`,
      })

      expect(proposal.options.map((option) => option.choice)).toEqual(ALL_CHOICES)
      expect(proposal.options.every((option) => option.studentExplanation.length > 0))
        .toBe(true)
    },
  )

  it.each([
    'missed',
    'interrupted',
    'shortened',
    'overdue',
    'focus-difficulty',
  ] as const)('supports a %s trigger without adding work', (kind) => {
    const { schedule, missedEvent } = makeRecoveryScenario()
    const proposal = generateRecoveryProposal({
      schedule,
      trigger: {
        kind,
        eventId: missedEvent.id,
        observedAt: NOW,
        remainingMinutes: 40,
        actualMinutes: 20,
      },
      proposalId: `proposal-${kind}`,
    })

    const generatedTotals = proposal.options
      .filter((option) => option.availability !== 'unavailable')
      .flatMap((option) => option.changes)
      .filter((change) => change.kind === 'event' && change.after)
      .map((change) => change.after as ScheduleEvent)
      .filter((event) => event.workItemId === missedEvent.workItemId)
    expect(generatedTotals.every((event) => event.durationMinutes <= 60)).toBe(
      true,
    )
    if (kind === 'focus-difficulty') {
      expect(
        [
          'split-sessions',
          'shorten-today',
          'move-to-catch-up-block',
          'keep-due-date-rebalance-week',
          'move-to-tomorrow',
          'replace-lower-priority-review',
          'leave-unchanged',
        ],
      ).toContain(
        proposal.options.find(
          (option) => option.id === proposal.recommendedOptionId,
        )?.choice,
      )
    }
  })

  it('marks tomorrow unavailable instead of exceeding tomorrow limits', () => {
    const student = makeStudent('student-ada', 'Ada', {
      defaultDailyLimit: {
        maxScheduledMinutes: 90,
        maxAcademicMinutes: 90,
        maxPhysicalMinutes: 90,
      },
    })
    const work = makeWorkItem()
    const missed = makeEvent({
      workItemId: work.id,
      status: 'missed',
      durationMinutes: 60,
    })
    const fullTomorrow = makeEvent({
      id: 'tomorrow-capacity',
      start: { date: '2026-07-29', time: '09:00' },
      durationMinutes: 90,
    })
    const schedule = makeSchedule({
      students: [student],
      workItems: [work],
      events: [missed, fullTomorrow],
    })

    const proposal = generateRecoveryProposal({
      schedule,
      trigger: {
        kind: 'missed',
        eventId: missed.id,
        observedAt: NOW,
      },
      proposalId: 'proposal-full-tomorrow',
    })
    const tomorrow = optionFor(proposal, 'move-to-tomorrow')

    expect(tomorrow.availability).toBe('unavailable')
    expect(tomorrow.preservesInvariants).toBe(false)
    expect(`${tomorrow.why} ${tomorrow.studentExplanation}`).toMatch(
      /not silently overloaded|too full/i,
    )
  })

  it('never proposes an automatic placement before the household-local current time', () => {
    const { proposal } = stateWithProposal()
    const currentLocal = { date: '2026-07-28', time: '12:00' }

    for (const choice of ALL_CHOICES.slice(0, 6)) {
      const option = optionFor(proposal, choice)
      if (option.availability === 'unavailable') continue
      for (const change of option.changes) {
        if (change.kind !== 'event' || !change.after) continue
        if (change.after.status === 'deferred') continue
        expect(
          compareLocalDateTime(change.after.start, currentLocal),
          `${choice} placed ${change.after.id} at ${change.after.start.date} ${change.after.start.time}`,
        ).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('interprets tomorrow from current local time for an overdue old event', () => {
    const work = makeWorkItem({
      id: 'old-work',
      deadline: {
        due: { date: '2026-07-27', time: '17:00' },
        kind: 'hard',
        parentLocked: true,
      },
    })
    const oldEvent = makeEvent({
      id: 'old-event',
      workItemId: work.id,
      start: { date: '2026-07-20', time: '09:00' },
      status: 'overdue',
    })
    const schedule = makeSchedule({
      students: [
        makeStudent('student-ada', 'Ada', {
          maxContinuousFocusMinutes: 60,
        }),
      ],
      range: { start: '2026-07-20', end: '2026-08-09' },
      workItems: [work],
      events: [oldEvent],
    })
    const proposal = generateRecoveryProposal({
      schedule,
      trigger: {
        kind: 'overdue',
        eventId: oldEvent.id,
        observedAt: NOW,
      },
      proposalId: 'proposal-old-event',
    })
    const tomorrow = optionFor(proposal, 'move-to-tomorrow')
    const moved = tomorrow.changes.find(
      (change) => change.kind === 'event',
    )?.after

    expect(tomorrow.availability).toBe('requires-parent')
    expect(moved?.start.date).toBe('2026-07-29')
  })

  it('uses configured catch-up capacity and preserves the due date while balancing', () => {
    const { proposal, work } = stateWithProposal()
    const catchUp = optionFor(proposal, 'move-to-catch-up-block')
    const balanced = optionFor(proposal, 'keep-due-date-rebalance-week')
    const catchUpAfter = catchUp.changes.find(
      (change) => change.kind === 'event',
    )?.after
    const balancedAfter = balanced.changes.find(
      (change) => change.kind === 'event',
    )?.after

    expect(catchUpAfter?.start).toMatchObject({
      date: '2026-07-30',
      time: '14:00',
    })
    expect(balancedAfter?.start.date).toBe('2026-07-30')
    expect(work.deadline?.due).toEqual({
      date: '2026-07-31',
      time: '17:00',
    })
    expect(balanced.changes.every((change) => change.kind === 'event')).toBe(
      true,
    )
  })

  it('splits the same remaining work into distinct useful sessions', () => {
    const { proposal, work } = stateWithProposal()
    const split = optionFor(proposal, 'split-sessions')
    const segments = split.changes.flatMap((change) =>
      change.kind === 'event' && change.after ? [change.after] : [],
    )

    expect(segments.length).toBeGreaterThanOrEqual(2)
    expect(new Set(segments.map((event) => event.id)).size).toBe(segments.length)
    expect(
      segments.reduce((minutes, event) => minutes + event.durationMinutes, 0),
    ).toBe(60)
    expect(
      segments.every(
        (event) => event.durationMinutes >= work.minimumSessionMinutes,
      ),
    ).toBe(true)
  })

  it('shortens only the reservation and keeps the unscheduled remainder visible', () => {
    const { proposal, work } = stateWithProposal()
    const shortened = optionFor(proposal, 'shorten-today')
    const after = shortened.changes.find(
      (change) => change.kind === 'event',
    )?.after

    expect(after?.durationMinutes).toBeLessThan(60)
    expect(shortened.changes.every((change) => change.kind === 'event')).toBe(
      true,
    )
    expect(shortened.dueDateRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workItemId: work.id,
          unscheduledMinutes: 30,
        }),
      ]),
    )
  })

  it('moves tomorrow as explicit carryover without losing its origin', () => {
    const { proposal } = stateWithProposal()
    const tomorrow = optionFor(proposal, 'move-to-tomorrow')
    const after = tomorrow.changes.find(
      (change) => change.kind === 'event',
    )?.after

    expect(after?.start.date).toBe('2026-07-29')
    expect(after?.source.adapterData).toMatchObject({
      recoveryOriginDate: '2026-07-28',
      recoveryProposalId: proposal.id,
    })
    expect(
      tomorrow.workload.find((day) => day.date === '2026-07-29'),
    ).toMatchObject({ overloaded: false, carryoverMinutes: 60 })
  })

  it('replaces only lower-priority review and defers rather than deletes it', () => {
    const { proposal, reviewEvent } = stateWithProposal()
    const replacement = optionFor(proposal, 'replace-lower-priority-review')
    const reviewChange = replacement.changes.find(
      (change) =>
        change.kind === 'event' && change.eventId === reviewEvent.id,
    )

    expect(reviewChange).toMatchObject({
      kind: 'event',
      before: reviewEvent,
      after: expect.objectContaining({ status: 'deferred' }),
      reasonCode: 'defer-lower-priority-review',
    })
    expect(replacement.tradeoff.cost).toMatch(/reconsidered later/i)
  })
})

describe('parent decisions, audit history, and exact undo', () => {
  it.each(
    ALL_CHOICES.filter((choice) => choice !== 'parent-manual'),
  )('parent approval applies %s and records a visible audit', (choice) => {
    const { state, work } = stateWithProposal()
    const result = approve(state, choice)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.errors[0]?.message)
    expect(result.value.proposals[0]?.status).toBe('applied')
    expect(result.value.auditHistory).toHaveLength(1)
    expect(result.value.auditHistory[0]).toMatchObject({
      proposalId: 'proposal-main',
      action: 'proposal-applied',
      actor: PARENT,
    })
    expect(
      result.value.schedule.workItems.find((candidate) => candidate.id === work.id),
    ).toEqual(work)
  })

  it('requires a parent override with explicit changes for manual choice', () => {
    const { state, proposal, missedEvent } = stateWithProposal()
    const manual = optionFor(proposal, 'parent-manual')
    const invalidApproval = applyRecoveryDecision({
      state,
      decision: {
        id: 'decision-manual-invalid',
        proposalId: proposal.id,
        kind: 'approve',
        actor: PARENT,
        decidedAt: '2026-07-28T16:05:00Z',
        selectedOptionId: manual.id,
      },
    })
    const manuallyMoved = {
      ...missedEvent,
      start: { date: '2026-07-30', time: '10:00' },
      status: 'scheduled' as const,
      updatedAt: '2026-07-28T16:05:00Z',
    }
    const validOverride = applyRecoveryDecision({
      state,
      decision: {
        id: 'decision-manual-override',
        proposalId: proposal.id,
        kind: 'override',
        actor: PARENT,
        decidedAt: '2026-07-28T16:05:00Z',
        overrideChanges: [
          eventChange(missedEvent, manuallyMoved, 'parent-override'),
        ],
        reason: 'Parent selected an existing supervised time.',
      },
    })

    expect(invalidApproval).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: 'invalid-decision' })],
    })
    expect(validOverride).toMatchObject({
      ok: true,
      value: {
        auditHistory: [
          expect.objectContaining({ action: 'parent-override-applied' }),
        ],
      },
    })
  })

  it('leaves the schedule byte-for-byte unchanged when that choice is approved', () => {
    const { state } = stateWithProposal()
    const beforeJson = JSON.stringify(state.schedule)
    const result = approve(state, 'leave-unchanged')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.errors[0]?.message)
    expect(JSON.stringify(result.value.schedule)).toBe(beforeJson)
    expect(result.value.auditHistory[0]?.changes).toEqual([])
  })

  it('allows rejection without changing the schedule', () => {
    const { state, proposal } = stateWithProposal()
    const result = applyRecoveryDecision({
      state,
      decision: {
        id: 'decision-reject',
        proposalId: proposal.id,
        kind: 'reject',
        actor: PARENT,
        decidedAt: '2026-07-28T16:05:00Z',
        reason: 'Parent will revisit this after dinner.',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        schedule: state.schedule,
        proposals: [expect.objectContaining({ status: 'rejected' })],
        auditHistory: [
          expect.objectContaining({
            action: 'proposal-rejected',
            changes: [],
          }),
        ],
      },
    })
  })

  it('denies system approval, stale proposals, and unavailable options', () => {
    const { state, proposal } = stateWithProposal()
    const chosen = optionFor(proposal, 'move-to-tomorrow')
    const systemResult = applyRecoveryDecision({
      state,
      decision: {
        id: 'decision-system',
        proposalId: proposal.id,
        kind: 'approve',
        actor: SYSTEM,
        decidedAt: NOW,
        selectedOptionId: chosen.id,
      },
    })
    const staleResult = applyRecoveryDecision({
      state: {
        ...state,
        schedule: { ...state.schedule, revision: state.schedule.revision + 1 },
      },
      decision: {
        id: 'decision-stale',
        proposalId: proposal.id,
        kind: 'approve',
        actor: PARENT,
        decidedAt: NOW,
        selectedOptionId: chosen.id,
      },
    })

    expect(systemResult).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: 'parent-approval-required' })],
    })
    expect(staleResult).toMatchObject({
      ok: false,
      errors: [
        expect.objectContaining({ code: 'stale-schedule-revision' }),
      ],
    })
  })

  it('restores the exact prior schedule and appends a compensating audit entry', () => {
    const { state } = stateWithProposal()
    const applied = approve(state, 'move-to-catch-up-block')
    if (!applied.ok) throw new Error(applied.errors[0]?.message)
    const target = applied.value.auditHistory[0]
    const restored = undoRecovery({
      state: applied.value,
      auditEntryId: target.id,
      actor: PARENT,
      at: '2026-07-28T16:10:00Z',
      reason: 'Parent restored the prior schedule.',
    })

    expect(restored.ok).toBe(true)
    if (!restored.ok) throw new Error(restored.errors[0]?.message)
    expect(restored.value.schedule).toEqual(state.schedule)
    expect(JSON.stringify(restored.value.schedule)).toBe(
      JSON.stringify(state.schedule),
    )
    expect(restored.value.auditHistory).toHaveLength(2)
    expect(restored.value.auditHistory[0]).toEqual(target)
    expect(restored.value.auditHistory[1]).toMatchObject({
      action: 'undo',
      undoOf: target.id,
      beforeSchedule: target.afterSchedule,
      afterSchedule: target.beforeSchedule,
    })
    expect(
      undoRecovery({
        state: restored.value,
        auditEntryId: target.id,
        actor: PARENT,
        at: '2026-07-28T16:11:00Z',
      }),
    ).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: 'already-undone' })],
    })
  })

  it('keeps another student unchanged and filters audit history by student', () => {
    const { state, graceEvent } = stateWithProposal()
    const applied = approve(state, 'move-to-tomorrow')
    if (!applied.ok) throw new Error(applied.errors[0]?.message)

    expect(
      applied.value.schedule.events.find((event) => event.id === graceEvent.id),
    ).toEqual(graceEvent)
    expect(recoveryAuditForStudent(applied.value, 'student-ada')).toHaveLength(1)
    expect(recoveryAuditForStudent(applied.value, 'student-grace')).toEqual([])
  })
})
