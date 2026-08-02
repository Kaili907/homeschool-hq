import { describe, expect, it } from 'vitest'
import {
  adaptSharedPlannerDailyBlocks,
  recoveryEventsToPlannerCommands,
} from '../../scheduling/recovery/adapters'
import {
  createBreakEvent,
  requiredBreakPlacements,
} from '../../scheduling/recovery/breaks'
import { detectConflicts } from '../../scheduling/recovery/conflicts'
import { generateRecoveryProposal } from '../../scheduling/recovery/engine'
import { validateRecoveryInvariants } from '../../scheduling/recovery/invariants'
import {
  SAMPLE_MULTI_STUDENT_SCHEDULE,
  SAMPLE_RECOVERY_TRIGGERS,
} from '../../scheduling/recovery/samples'
import { validateRecoverySchedule } from '../../scheduling/recovery/schemas'
import {
  type ActivityKind,
  type SharedPlannerDailyBlockLike,
} from '../../scheduling/recovery/types'
import {
  makeEvent,
  makeSchedule,
  makeStudent,
  NOW,
} from './fixtures'

const REQUIRED_USER_ACTIVITY_KINDS: readonly ActivityKind[] = [
  'academic-assignment',
  'romeo-virtual-academy-assignment',
  'manuel-academy-lesson',
  'adaptive-tutor-intervention',
  'ready-for-life-activity',
  'wrestling',
  'jiu-jitsu',
  'weight-training',
  'pe-activity',
  'appointment',
  'meal',
  'movement-break',
  'focus-recovery-break',
  'parent-created-activity',
]

describe('supportive break placement', () => {
  it('recommends the configured movement break at the focus threshold', () => {
    const student = makeStudent('student-ada', 'Ada', {
      preferredFocusBlockMinutes: 30,
      maxContinuousFocusMinutes: 45,
      movementBreakAfterMinutes: 30,
      movementBreakMinutes: 10,
    })
    const focus = makeEvent({
      id: 'focus-30',
      durationMinutes: 30,
      start: { date: '2026-07-28', time: '09:00' },
    })
    const schedule = makeSchedule({ students: [student], events: [focus] })

    const placements = requiredBreakPlacements(
      schedule,
      student.id,
      '2026-07-28',
    )

    expect(placements).toEqual([
      expect.objectContaining({
        afterEventId: focus.id,
        startTime: '09:30',
        durationMinutes: 10,
        kind: 'movement-break',
      }),
    ])
    const breakEvent = createBreakEvent(
      placements[0],
      'generated-movement',
      NOW,
    )
    const withBreak = makeSchedule({
      students: [student],
      events: [focus, breakEvent],
    })
    expect(validateRecoverySchedule(withBreak)).toMatchObject({ valid: true })
    expect(detectConflicts(withBreak)).toEqual([])
  })

  it('recommends a supportive focus-recovery break after exceeding the limit', () => {
    const student = makeStudent('student-ada', 'Ada', {
      preferredFocusBlockMinutes: 30,
      maxContinuousFocusMinutes: 45,
      movementBreakAfterMinutes: 30,
      focusRecoveryBreakMinutes: 15,
    })
    const schedule = makeSchedule({
      students: [student],
      events: [makeEvent({ id: 'focus-50', durationMinutes: 50 })],
    })

    expect(
      requiredBreakPlacements(schedule, student.id, '2026-07-28'),
    ).toEqual([
      expect.objectContaining({
        kind: 'focus-recovery-break',
        durationMinutes: 15,
        reason: expect.stringMatching(/supportive reset/i),
      }),
    ])
  })

  it('recognizes an existing movement break as a focus reset', () => {
    const student = makeStudent('student-ada', 'Ada', {
      movementBreakAfterMinutes: 30,
    })
    const schedule = makeSchedule({
      students: [student],
      events: [
        makeEvent({ id: 'before', durationMinutes: 20 }),
        makeEvent({
          id: 'existing-break',
          kind: 'movement-break',
          start: { date: '2026-07-28', time: '09:20' },
          durationMinutes: 10,
        }),
        makeEvent({
          id: 'after',
          start: { date: '2026-07-28', time: '09:30' },
          durationMinutes: 20,
        }),
      ],
    })

    expect(
      requiredBreakPlacements(schedule, student.id, '2026-07-28'),
    ).toEqual([])
    expect(validateRecoveryInvariants(schedule)).toMatchObject({ valid: true })
  })

  it('does not recommend a break over a fixed event or protected window', () => {
    const student = makeStudent('student-ada', 'Ada', {
      movementBreakAfterMinutes: 30,
      movementBreakMinutes: 10,
    })
    const focus = makeEvent({
      id: 'focus-before-fixed',
      start: { date: '2026-07-28', time: '09:00' },
      durationMinutes: 30,
    })
    const fixed = makeEvent({
      id: 'fixed-at-break-time',
      kind: 'appointment',
      start: { date: '2026-07-28', time: '09:30' },
      durationMinutes: 30,
    })
    const occupied = makeSchedule({
      students: [student],
      events: [focus, fixed],
    })
    const protectedAtBreak = makeSchedule({
      students: [student],
      events: [focus],
      protectedWindows: [
        {
          id: 'protected-at-break-time',
          date: '2026-07-28',
          startTime: '09:30',
          endTime: '10:00',
          kind: 'parent-defined',
          title: 'Parent protected time',
          parentLocked: true,
        },
      ],
    })

    expect(
      requiredBreakPlacements(occupied, student.id, '2026-07-28'),
    ).toEqual([])
    expect(
      requiredBreakPlacements(protectedAtBreak, student.id, '2026-07-28'),
    ).toEqual([])
  })

  it('keeps accumulated focus active when an immediate break slot is blocked', () => {
    const student = makeStudent('student-ada', 'Ada', {
      movementBreakAfterMinutes: 30,
      movementBreakMinutes: 10,
      maxContinuousFocusMinutes: 45,
    })
    const first = makeEvent({
      id: 'focus-before-blocker',
      start: { date: '2026-07-28', time: '09:00' },
      durationMinutes: 30,
    })
    const blocker = makeEvent({
      id: 'fixed-blocker',
      kind: 'appointment',
      start: { date: '2026-07-28', time: '09:30' },
      durationMinutes: 10,
    })
    const second = makeEvent({
      id: 'focus-after-blocker',
      start: { date: '2026-07-28', time: '09:40' },
      durationMinutes: 10,
    })
    const schedule = makeSchedule({
      students: [student],
      events: [first, blocker, second],
    })

    expect(
      requiredBreakPlacements(schedule, student.id, '2026-07-28'),
    ).toEqual([
      expect.objectContaining({
        afterEventId: second.id,
        startTime: '09:50',
        kind: 'movement-break',
      }),
    ])
  })
})

describe('shared-planner integration boundary', () => {
  const adaptedAt = '2026-07-28T16:00:00Z'
  const plannerRows: SharedPlannerDailyBlockLike[] = [
    {
      profileId: 'student-ada',
      date: '2026-07-28',
      instanceId: 'planner:ada:2026-07-28:mission',
      block: {
        id: 'mission',
        title: 'Daily reading',
        category: 'existing-mission',
        startTime: '09:00',
        expectedMinutes: 30,
        scheduleBehavior: 'flexible',
        assignedProfileIds: ['student-ada'],
        assignToAll: false,
        source: { kind: 'mission' },
        active: true,
        createdAt: adaptedAt,
        updatedAt: adaptedAt,
      },
      progress: { status: 'completed', activeElapsedSeconds: 1_800 },
    },
    {
      profileId: 'student-ada',
      date: '2026-07-28',
      instanceId: 'planner:ada:2026-07-28:appointment',
      block: {
        id: 'appointment',
        title: 'Appointment',
        category: 'appointment',
        startTime: '11:00',
        expectedMinutes: 45,
        scheduleBehavior: 'fixed',
        assignedProfileIds: ['student-ada'],
        assignToAll: false,
        source: { kind: 'manual' },
        active: true,
        createdAt: adaptedAt,
        updatedAt: adaptedAt,
      },
      progress: { status: 'not-started' },
    },
    {
      profileId: 'student-ada',
      date: '2026-07-28',
      instanceId: 'planner:ada:2026-07-28:lunch',
      block: {
        id: 'lunch',
        title: 'Lunch',
        category: 'meal',
        startTime: '12:00',
        expectedMinutes: 30,
        scheduleBehavior: 'fixed',
        assignedProfileIds: ['student-ada'],
        assignToAll: false,
        source: { kind: 'manual' },
        active: true,
        createdAt: adaptedAt,
        updatedAt: adaptedAt,
      },
      progress: { status: 'not-started' },
    },
  ]

  it('adapts planner completion and fixed/protected semantics without mutation', () => {
    const original = structuredClone(plannerRows)
    const schedule = adaptSharedPlannerDailyBlocks({
      householdId: 'household-manuel',
      timeZone: 'America/New_York',
      range: { start: '2026-07-28', end: '2026-07-29' },
      students: [makeStudent('student-ada', 'Ada')],
      dailyBlocks: plannerRows,
      revision: 4,
      adaptedAt,
    })

    expect(plannerRows).toEqual(original)
    expect(validateRecoverySchedule(schedule)).toMatchObject({ valid: true })
    expect(schedule.workItems[0]).toMatchObject({
      status: 'completed',
      completedMinutes: 30,
      requirement: 'required',
    })
    expect(
      schedule.events.find((event) => event.kind === 'appointment'),
    ).toMatchObject({ mobility: 'fixed', parentLocked: false })
    expect(
      schedule.events.find((event) => event.kind === 'meal'),
    ).toMatchObject({
      mobility: 'fixed',
      parentLocked: true,
      protection: 'meal',
    })
  })

  it('emits integration commands rather than mutating shared planner rows', () => {
    const before = adaptSharedPlannerDailyBlocks({
      householdId: 'household-manuel',
      timeZone: 'America/New_York',
      range: { start: '2026-07-28', end: '2026-07-29' },
      students: [makeStudent('student-ada', 'Ada')],
      dailyBlocks: plannerRows,
      revision: 4,
      adaptedAt,
    })
    const reading = before.events.find(
      (event) => event.kind === 'academic-assignment',
    )
    if (!reading) throw new Error('missing adapted reading event')
    const after = {
      ...before,
      events: before.events.map((event) =>
        event.id === reading.id
          ? {
              ...event,
              start: { date: '2026-07-29', time: '10:00' },
              updatedAt: '2026-07-28T16:05:00Z',
            }
          : event,
      ),
    }

    expect(recoveryEventsToPlannerCommands(before, after)).toEqual([
      expect.objectContaining({
        kind: 'change-date-override',
        profileId: 'student-ada',
        date: '2026-07-29',
        targetPlannerBlockId: 'mission',
        recoveryEventId: reading.id,
        changes: {
          startTime: '10:00',
          expectedMinutes: 30,
          scheduleBehavior: 'flexible',
        },
      }),
    ])
  })
})

describe('multi-student sample validation', () => {
  it('is a valid two-student, IANA-zoned contract with every required activity', () => {
    expect(validateRecoverySchedule(SAMPLE_MULTI_STUDENT_SCHEDULE)).toMatchObject(
      { valid: true },
    )
    expect(SAMPLE_MULTI_STUDENT_SCHEDULE.students).toHaveLength(2)
    expect(
      new Set(
        SAMPLE_MULTI_STUDENT_SCHEDULE.students.map(
          (student) => student.policy.preferredFocusBlockMinutes,
        ),
      ).size,
    ).toBe(2)
    const represented = new Set([
      ...SAMPLE_MULTI_STUDENT_SCHEDULE.workItems.map((item) => item.kind),
      ...SAMPLE_MULTI_STUDENT_SCHEDULE.events.map((event) => event.kind),
    ])
    for (const kind of REQUIRED_USER_ACTIVITY_KINDS) {
      expect(represented.has(kind), kind).toBe(true)
    }
  })

  it('generates a complete proposal for every sample trigger', () => {
    for (const [index, trigger] of SAMPLE_RECOVERY_TRIGGERS.entries()) {
      const proposal = generateRecoveryProposal({
        schedule: SAMPLE_MULTI_STUDENT_SCHEDULE,
        trigger,
        proposalId: `sample-proposal-${index}`,
      })
      expect(proposal.options).toHaveLength(8)
      expect(proposal.studentId).toBe(
        SAMPLE_MULTI_STUDENT_SCHEDULE.events.find(
          (event) => event.id === trigger.eventId,
        )?.studentId,
      )
    }
  })
})
