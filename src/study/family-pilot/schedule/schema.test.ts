import { describe, expect, it } from 'vitest'
import type { FamilyPilotAssignmentState } from '../core/schema'
import { buildDailySchedule, type DailyScheduleInputItem } from './schema'

const DATE = '2026-08-12'

function assignmentItem(
  assignmentRef: string,
  title: string,
  state: FamilyPilotAssignmentState,
): DailyScheduleInputItem {
  return { kind: 'assignment', assignmentRef, title, state }
}

describe('buildDailySchedule', () => {
  it('returns an empty list for an empty day', () => {
    const items = buildDailySchedule({ studentRef: 'student:ada', date: DATE, items: [] })
    expect(items).toEqual([])
  })

  it('builds three planned assignments in the given order', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'planned'),
        assignmentItem('assignment:2', 'Grammar', 'planned'),
        assignmentItem('assignment:3', 'Reading', 'planned'),
      ],
    })
    expect(items.map((item) => item.title)).toEqual(['Fractions', 'Grammar', 'Reading'])
    expect(items.map((item) => item.order)).toEqual([0, 1, 2])
    expect(items.every((item) => item.status === 'pending')).toBe(true)
    expect(items.every((item) => item.kind === 'assignment')).toBe(true)
  })

  it('promotes in-progress work ahead of planned work', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'planned'),
        assignmentItem('assignment:2', 'Grammar', 'active'),
        assignmentItem('assignment:3', 'Reading', 'planned'),
      ],
    })
    expect(items.map((item) => item.title)).toEqual(['Grammar', 'Fractions', 'Reading'])
    expect(items[0].status).toBe('in-progress')
  })

  it('keeps a paused assignment in-progress rather than demoting it to pending', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'planned'),
        assignmentItem('assignment:2', 'Grammar', 'paused'),
      ],
    })
    const grammar = items.find((item) => item.title === 'Grammar')
    expect(grammar?.status).toBe('in-progress')
    expect(items[0].title).toBe('Grammar')
  })

  it('reflects a completed assignment as a completed item', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [assignmentItem('assignment:1', 'Fractions', 'completed')],
    })
    expect(items[0].status).toBe('completed')
  })

  it('drops abandoned assignments from today entirely', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'abandoned'),
        assignmentItem('assignment:2', 'Grammar', 'planned'),
      ],
    })
    expect(items.map((item) => item.title)).toEqual(['Grammar'])
  })

  it('includes an optional break that does not affect assignment status', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'planned'),
        { kind: 'break', scheduleItemRef: 'break:morning', title: 'Morning break' },
      ],
    })
    const brk = items.find((item) => item.kind === 'break')
    expect(brk?.status).toBe('pending')
    expect(brk?.assignmentRef).toBeNull()
  })

  it('carries a break status supplied by the host across a rebuild', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        { kind: 'break', scheduleItemRef: 'break:morning', title: 'Morning break', status: 'completed' },
      ],
    })
    expect(items[0].status).toBe('completed')
  })

  it('produces identical, deterministically ordered output for the same input', () => {
    const input = {
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'planned'),
        { kind: 'break' as const, scheduleItemRef: 'break:morning', title: 'Break' },
        assignmentItem('assignment:2', 'Grammar', 'active'),
        assignmentItem('assignment:3', 'Reading', 'completed'),
      ],
    }
    const first = buildDailySchedule(input)
    const second = buildDailySchedule(input)
    expect(second).toEqual(first)
    // in-progress (Grammar), then pending (Fractions, Break in given order), then completed (Reading)
    expect(first.map((item) => item.title)).toEqual(['Grammar', 'Fractions', 'Break', 'Reading'])
  })

  it('never creates a second copy of the same assignment for the same day', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        assignmentItem('assignment:1', 'Fractions', 'planned'),
        assignmentItem('assignment:1', 'Fractions', 'active'),
      ],
    })
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('pending')
  })

  it('derives a stable scheduleItemRef for the same assignment across rebuilds', () => {
    const build = () => buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [assignmentItem('assignment:1', 'Fractions', 'active')],
    })
    expect(build()[0].scheduleItemRef).toBe(build()[0].scheduleItemRef)
  })

  it('keeps a paused assignment\'s scheduleItemRef stable across a rebuild, not a fresh item', () => {
    const active = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [assignmentItem('assignment:1', 'Fractions', 'active')],
    })
    const pausedNow = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [assignmentItem('assignment:1', 'Fractions', 'paused')],
    })
    expect(pausedNow[0].scheduleItemRef).toBe(active[0].scheduleItemRef)
    expect(pausedNow[0].status).toBe('in-progress')
  })
})
