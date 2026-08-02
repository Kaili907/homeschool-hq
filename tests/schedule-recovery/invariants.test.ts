import { describe, expect, it } from 'vitest'
import { applyScheduleChanges } from '../../scheduling/recovery/changes'
import { detectConflicts } from '../../scheduling/recovery/conflicts'
import {
  dueDateRiskForWorkItem,
  eventCanMove,
  isSupportiveFocusAdjustment,
  recommendedFocusBlockMinutes,
} from '../../scheduling/recovery/models'
import {
  dayWorkload,
  findAvailableSlot,
  focusStaminaViolations,
  weekWorkload,
  workloadInvariantErrors,
} from '../../scheduling/recovery/workload'
import {
  eventChange,
  makeEvent,
  makeProtectedWindow,
  makeSchedule,
  makeStudent,
  makeWorkItem,
  NOW,
} from './fixtures'

function errorCodes(result: ReturnType<typeof applyScheduleChanges>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code)
}

describe('fixed, locked, protected, and required-work invariants', () => {
  it.each([
    [
      'fixed appointment',
      makeEvent({
        id: 'fixed-appointment',
        kind: 'appointment',
        mobility: 'fixed',
      }),
      'fixed-event-change',
    ],
    [
      'parent-locked event',
      makeEvent({ id: 'parent-lock', parentLocked: true }),
      'parent-locked-change',
    ],
    [
      'sleep',
      makeEvent({ id: 'sleep', kind: 'sleep' }),
      'parent-locked-change',
    ],
    [
      'meal',
      makeEvent({ id: 'meal', kind: 'meal' }),
      'parent-locked-change',
    ],
    [
      'parent protected time',
      makeEvent({ id: 'protected', kind: 'protected-time' }),
      'parent-locked-change',
    ],
  ])('never moves or resizes a %s', (_label, before, expectedCode) => {
    const after = {
      ...before,
      start: { ...before.start, time: '11:00' },
      durationMinutes: before.durationMinutes + 5,
      updatedAt: '2026-07-28T16:05:00Z',
    }
    const result = applyScheduleChanges(
      makeSchedule({ events: [before] }),
      [eventChange(before, after)],
      { updatedAt: '2026-07-28T16:05:00Z' },
    )

    expect(result.ok).toBe(false)
    expect(errorCodes(result)).toContain(expectedCode)
    expect(eventCanMove(before)).toBe(false)
  })

  it('blocks overlap with an independent protected sleep or meal window', () => {
    const event = makeEvent({
      start: { date: '2026-07-28', time: '12:15' },
      durationMinutes: 30,
    })
    const schedule = makeSchedule({
      events: [event],
      protectedWindows: [makeProtectedWindow()],
    })

    expect(detectConflicts(schedule)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'protected-time-overlap',
          eventIds: [event.id],
        }),
      ]),
    )
  })

  it('still detects a protected event overlapping a different protected window', () => {
    const meal = makeEvent({
      id: 'meal-inside-sleep',
      kind: 'meal',
      start: { date: '2026-07-28', time: '07:15' },
      durationMinutes: 30,
    })
    const sleepWindow = makeProtectedWindow({
      id: 'sleep-window',
      startTime: '00:00',
      endTime: '08:00',
      kind: 'sleep',
      title: 'Protected sleep',
    })
    const before = makeSchedule({ protectedWindows: [sleepWindow] })
    const afterAttempt = applyScheduleChanges(
      before,
      [
        {
          kind: 'event',
          eventId: meal.id,
          before: null,
          after: meal,
          reasonCode: 'parent-override',
        },
      ],
      { updatedAt: NOW },
    )

    expect(detectConflicts(makeSchedule({
      events: [meal],
      protectedWindows: [sleepWindow],
    }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'protected-time-overlap',
          eventIds: [meal.id],
          protectedWindowId: sleepWindow.id,
        }),
      ]),
    )
    expect(errorCodes(afterAttempt)).toContain('new-conflict')
  })

  it('requires explicit approval before required work can be waived', () => {
    const work = makeWorkItem({ id: 'required-work' })
    const waived = { ...work, status: 'waived' as const, updatedAt: NOW }
    const change = {
      kind: 'work-item' as const,
      workItemId: work.id,
      before: work,
      after: waived,
      reasonCode: 'parent-override' as const,
    }
    const schedule = makeSchedule({ workItems: [work] })

    expect(
      errorCodes(
        applyScheduleChanges(schedule, [change], {
          updatedAt: '2026-07-28T16:05:00Z',
        }),
      ),
    ).toContain('required-work-removal')
    expect(
      applyScheduleChanges(schedule, [change], {
        updatedAt: '2026-07-28T16:05:00Z',
        explicitlyApproveRequiredWorkRemoval: true,
      }),
    ).toMatchObject({
      ok: true,
      value: {
        revision: schedule.revision + 1,
        workItems: [expect.objectContaining({ status: 'waived' })],
      },
    })
  })

  it('rejects stale before-images and duplicate changes', () => {
    const event = makeEvent()
    const moved = {
      ...event,
      start: { ...event.start, time: '10:00' },
      updatedAt: NOW,
    }
    const schedule = makeSchedule({ events: [event] })
    const stale = eventChange(
      { ...event, title: 'A stale title' },
      moved,
    )

    expect(errorCodes(applyScheduleChanges(schedule, [stale], { updatedAt: NOW })))
      .toContain('invalid-decision')
    expect(
      errorCodes(
        applyScheduleChanges(
          schedule,
          [eventChange(event, moved), eventChange(event, moved)],
          { updatedAt: NOW },
        ),
      ),
    ).toContain('invalid-decision')
  })
})

describe('conflicts, deadline risk, and capacity limits', () => {
  it('distinguishes movable overlap from overlap involving a fixed event', () => {
    const first = makeEvent({
      id: 'first',
      start: { date: '2026-07-28', time: '09:00' },
    })
    const second = makeEvent({
      id: 'second',
      start: { date: '2026-07-28', time: '09:30' },
    })
    const fixed = makeEvent({
      id: 'fixed',
      kind: 'appointment',
      start: { date: '2026-07-28', time: '09:45' },
    })

    const movableConflict = detectConflicts(
      makeSchedule({ events: [first, second] }),
    )
    const fixedConflict = detectConflicts(
      makeSchedule({ events: [first, fixed] }),
    )

    expect(movableConflict).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'event-overlap' }),
      ]),
    )
    expect(fixedConflict).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'fixed-event-overlap' }),
      ]),
    )
  })

  it('flags events outside the student day without moving them', () => {
    const late = makeEvent({
      id: 'late',
      start: { date: '2026-07-28', time: '20:45' },
      durationMinutes: 30,
    })
    expect(detectConflicts(makeSchedule({ events: [late] }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'outside-student-day',
          eventIds: ['late'],
        }),
      ]),
    )
  })

  it('warns when remaining required work is overdue or cannot fit safely', () => {
    const overdue = makeWorkItem({
      id: 'overdue',
      deadline: {
        due: { date: '2026-07-27', time: '17:00' },
        kind: 'hard',
        parentLocked: true,
      },
    })
    const atRisk = makeWorkItem({
      id: 'at-risk',
      duration: {
        expectedMinutes: 300,
        minimumMinutes: 30,
        maximumMinutes: 360,
        confidence: 'low',
        basis: 'default',
      },
      deadline: {
        due: { date: '2026-07-29', time: '08:00' },
        kind: 'hard',
        parentLocked: true,
      },
    })
    const schedule = makeSchedule({ workItems: [overdue, atRisk] })

    expect(dueDateRiskForWorkItem(schedule, overdue, NOW)).toMatchObject({
      level: 'overdue',
      unscheduledMinutes: 60,
    })
    expect(dueDateRiskForWorkItem(schedule, atRisk, NOW)).toMatchObject({
      level: 'at-risk',
      unscheduledMinutes: 300,
    })
  })

  it('calculates per-student day and week loads independently', () => {
    const adaEvents = Array.from({ length: 3 }, (_, index) =>
      makeEvent({
        id: `ada-${index}`,
        start: {
          date: `2026-07-${String(28 + index).padStart(2, '0')}`,
          time: '09:00',
        },
        durationMinutes: 120,
      }),
    )
    const graceEvent = makeEvent({
      id: 'grace',
      studentId: 'student-grace',
      start: { date: '2026-07-28', time: '11:30' },
      durationMinutes: 30,
    })
    const schedule = makeSchedule({ events: [...adaEvents, graceEvent] })

    expect(dayWorkload(schedule, 'student-ada', '2026-07-28')).toMatchObject({
      academicMinutes: 120,
      overloaded: false,
    })
    expect(dayWorkload(schedule, 'student-grace', '2026-07-28')).toMatchObject({
      academicMinutes: 30,
      overloaded: false,
    })
    expect(weekWorkload(schedule, 'student-ada', '2026-07-30')).toMatchObject({
      weekStart: '2026-07-27',
      academicMinutes: 360,
      overloaded: false,
    })
  })

  it('detects daily, weekly, carryover, and continuous-focus overload', () => {
    const constrained = makeStudent('constrained', 'Constrained', {
      defaultDailyLimit: {
        maxScheduledMinutes: 90,
        maxAcademicMinutes: 60,
        maxPhysicalMinutes: 60,
      },
      maxAcademicMinutesPerWeek: 60,
      maxCarryoverMinutesPerDay: 20,
      maxContinuousFocusMinutes: 30,
      preferredFocusBlockMinutes: 20,
      minimumFocusBlockMinutes: 10,
    })
    const first = makeEvent({
      id: 'carryover-a',
      studentId: constrained.id,
      durationMinutes: 35,
      source: {
        system: 'external',
        sourceId: 'a',
        adapterData: { recoveryOriginDate: '2026-07-27' },
      },
    })
    const second = makeEvent({
      id: 'carryover-b',
      studentId: constrained.id,
      start: { date: '2026-07-28', time: '09:35' },
      durationMinutes: 35,
      source: {
        system: 'external',
        sourceId: 'b',
        adapterData: { recoveryOriginDate: '2026-07-27' },
      },
    })
    const schedule = makeSchedule({
      students: [constrained],
      events: [first, second],
    })

    expect(focusStaminaViolations(schedule, constrained.id)).not.toHaveLength(0)
    expect(workloadInvariantErrors(schedule).map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'daily-overload',
        'weekly-overload',
        'carryover-overload',
        'focus-stamina-overload',
      ]),
    )
  })
})

describe('focus-supportive sizing, breaks, and no-overload placement', () => {
  it('sizes work within the student focus range and work-item minimum', () => {
    const policy = makeSchedule().students[0].policy
    const work = makeWorkItem({
      duration: {
        expectedMinutes: 90,
        minimumMinutes: 30,
        maximumMinutes: 120,
        confidence: 'medium',
        basis: 'student-history',
      },
      minimumSessionMinutes: 20,
    })

    expect(recommendedFocusBlockMinutes(policy, work)).toBe(30)
    expect(recommendedFocusBlockMinutes(policy, work, 12)).toBe(12)
  })

  it('treats a shorter block plus a recovery break as supportive, not punitive', () => {
    const before = makeEvent({ durationMinutes: 45 })
    const after = [
      makeEvent({
        id: 'shorter',
        durationMinutes: 25,
      }),
      makeEvent({
        id: 'recovery-break',
        kind: 'focus-recovery-break',
        start: { date: '2026-07-28', time: '09:25' },
        durationMinutes: 15,
      }),
    ]

    expect(
      isSupportiveFocusAdjustment(
        before,
        after,
        makeSchedule().students[0].policy,
      ),
    ).toBe(true)
    expect(
      isSupportiveFocusAdjustment(
        before,
        [makeEvent({ durationMinutes: 60 })],
        makeSchedule().students[0].policy,
      ),
    ).toBe(false)
  })

  it('places only a complete block around fixed and protected time', () => {
    const schedule = makeSchedule({
      events: [
        makeEvent({
          id: 'fixed-class',
          kind: 'appointment',
          start: { date: '2026-07-29', time: '09:30' },
          durationMinutes: 30,
        }),
      ],
      protectedWindows: [
        makeProtectedWindow({
          id: 'morning-protected',
          date: '2026-07-29',
          startTime: '07:00',
          endTime: '09:00',
          kind: 'parent-defined',
        }),
      ],
    })

    expect(
      findAvailableSlot({
        schedule,
        studentId: 'student-ada',
        dates: ['2026-07-29'],
        durationMinutes: 45,
        loadCategory: 'academic',
      }),
    ).toEqual({
      studentId: 'student-ada',
      date: '2026-07-29',
      startTime: '10:00',
      endTime: '10:45',
    })
  })

  it('never silently overloads tomorrow', () => {
    const constrained = makeStudent('student-ada', 'Ada', {
      defaultDailyLimit: {
        maxScheduledMinutes: 120,
        maxAcademicMinutes: 90,
        maxPhysicalMinutes: 120,
      },
    })
    const tomorrowFull = makeEvent({
      id: 'tomorrow-full',
      start: { date: '2026-07-29', time: '09:00' },
      durationMinutes: 90,
    })
    const schedule = makeSchedule({
      students: [constrained],
      events: [tomorrowFull],
    })

    expect(
      findAvailableSlot({
        schedule,
        studentId: 'student-ada',
        dates: ['2026-07-29'],
        durationMinutes: 30,
        loadCategory: 'academic',
      }),
    ).toBeUndefined()
  })
})
