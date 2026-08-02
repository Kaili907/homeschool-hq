import { describe, expect, it } from 'vitest'
import {
  RECOVERY_PROPOSAL_JSON_SCHEMA,
  RECOVERY_SCHEDULE_JSON_SCHEMA,
  validateRecoveryProposal,
  validateRecoverySchedule,
} from '../../scheduling/recovery/schemas'
import {
  addCalendarDays,
  instantToLocalDateTime,
  isInstantString,
  localDateTimeToInstant,
  mondayOf,
  weekdayOf,
} from '../../scheduling/recovery/time'
import {
  RECOVERY_CHOICE_LABELS,
  type RecoveryChoice,
  type RecoveryProposal,
} from '../../scheduling/recovery/types'
import {
  ALL_ACTIVITY_KINDS,
  makeEvent,
  makeSchedule,
  makeWorkItem,
  NOW,
} from './fixtures'

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

describe('runtime and portable schema contracts', () => {
  it('accepts every supported activity kind in work and event contracts', () => {
    for (const [index, kind] of ALL_ACTIVITY_KINDS.entries()) {
      const work = makeWorkItem({
        id: `work-${index}`,
        kind,
        requirement: kind === 'movement-break' ? 'optional' : 'required',
      })
      const event = makeEvent({
        id: `event-${index}`,
        kind,
        workItemId: work.id,
        start: {
          date: '2026-07-28',
          time: `${String(7 + Math.floor(index / 2)).padStart(2, '0')}:${
            index % 2 === 0 ? '00' : '30'
          }`,
        },
        durationMinutes: 20,
      })
      const validation = validateRecoverySchedule(
        makeSchedule({ workItems: [work], events: [event] }),
      )
      expect(validation, `${kind}: ${JSON.stringify(validation)}`).toMatchObject(
        { valid: true },
      )
    }
  })

  it('rejects malformed dates, offsets, time zones, IDs, and cross-student links', () => {
    const work = makeWorkItem()
    const invalid = {
      ...makeSchedule({
        workItems: [work, { ...work }],
        events: [
          makeEvent({
            workItemId: work.id,
            studentId: 'student-grace',
            start: { date: '2026-02-30', time: '24:00' },
            createdAt: '2026-07-28T12:00:00',
          }),
        ],
      }),
      timeZone: 'Eastern-ish',
    }

    const result = validateRecoverySchedule(invalid)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('expected invalid schedule')
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'time-zone',
        'duplicate-id',
        'student-mismatch',
        'format',
        'instant',
      ]),
    )
  })

  it('rejects invalid protected events and incoherent focus policies', () => {
    const schedule = makeSchedule({
      students: [
        {
          ...makeSchedule().students[0],
          policy: {
            ...makeSchedule().students[0].policy,
            minimumFocusBlockMinutes: 50,
            preferredFocusBlockMinutes: 30,
            maxContinuousFocusMinutes: 40,
            activeWeekdays: [1, 1],
          },
        },
      ],
      events: [
        makeEvent({
          kind: 'meal',
          mobility: 'movable',
          parentLocked: false,
          protection: 'none',
        }),
      ],
    })

    const result = validateRecoverySchedule(schedule)

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('expected invalid schedule')
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['focus-order', 'weekday', 'protected-event']),
    )
  })

  it('requires exactly one option for all eight recovery choices', () => {
    const options = ALL_CHOICES.map((choice, index) => ({
      id: `option-${index}`,
      choice,
      label: RECOVERY_CHOICE_LABELS[choice],
      availability: 'available' as const,
      why: `Why ${choice}`,
      tradeoff: { gained: 'A safe plan', cost: 'A visible tradeoff' },
      changes: [],
      conflicts: [],
      dueDateRisks: [],
      workload: [],
      preservesInvariants: true,
      studentExplanation: `We adjusted the plan using ${choice}.`,
    }))
    const proposal: RecoveryProposal = {
      id: 'proposal-all-choices',
      scheduleRevision: 7,
      studentId: 'student-ada',
      trigger: {
        kind: 'missed',
        eventId: 'event-main',
        observedAt: NOW,
      },
      createdAt: NOW,
      status: 'pending-parent',
      recommendedOptionId: options[0].id,
      options,
      summary: 'Eight visible recovery choices',
    }

    expect(validateRecoveryProposal(proposal)).toMatchObject({ valid: true })
    expect(
      validateRecoveryProposal({
        ...proposal,
        options: options.slice(0, -1),
      }),
    ).toMatchObject({ valid: false })
  })

  it('exports draft 2020-12 JSON Schemas with closed top-level objects', () => {
    expect(RECOVERY_SCHEDULE_JSON_SCHEMA).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
    })
    expect(RECOVERY_PROPOSAL_JSON_SCHEMA).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
    })
  })
})

describe('household-local calendar and 2026 New York DST behavior', () => {
  it('uses calendar arithmetic independent of 23-hour and 25-hour days', () => {
    expect(addCalendarDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addCalendarDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(weekdayOf('2026-03-08')).toBe(7)
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
  })

  it('rejects the nonexistent 2026 spring-forward wall time', () => {
    expect(() =>
      localDateTimeToInstant(
        { date: '2026-03-08', time: '02:30' },
        'America/New_York',
        'reject',
      ),
    ).toThrow(/nonexistent/i)
  })

  it('uses compatible forward shifting for a nonexistent spring time', () => {
    expect(
      localDateTimeToInstant(
        { date: '2026-03-08', time: '02:30' },
        'America/New_York',
        'compatible',
      ),
    ).toBe('2026-03-08T07:30:00.000Z')
  })

  it('distinguishes both instants in the ambiguous 2026 fall-back hour', () => {
    const local = { date: '2026-11-01', time: '01:30' }
    const earlier = localDateTimeToInstant(
      local,
      'America/New_York',
      'earlier',
    )
    const later = localDateTimeToInstant(local, 'America/New_York', 'later')

    expect(earlier).toBe('2026-11-01T05:30:00.000Z')
    expect(later).toBe('2026-11-01T06:30:00.000Z')
    expect(Date.parse(later) - Date.parse(earlier)).toBe(60 * 60 * 1000)
    expect(instantToLocalDateTime(earlier, 'America/New_York')).toEqual(local)
    expect(instantToLocalDateTime(later, 'America/New_York')).toEqual(local)
    expect(() =>
      localDateTimeToInstant(local, 'America/New_York', 'reject'),
    ).toThrow(/ambiguous/i)
  })

  it('requires explicit offsets on persisted instants', () => {
    expect(isInstantString('2026-07-28T12:00:00-04:00')).toBe(true)
    expect(isInstantString('2026-07-28T16:00:00Z')).toBe(true)
    expect(isInstantString('2026-07-28T12:00:00')).toBe(false)
  })
})
