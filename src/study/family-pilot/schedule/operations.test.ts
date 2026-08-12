import { describe, expect, it } from 'vitest'
import {
  getCurrentScheduleItem,
  getNextScheduleItem,
  markScheduleItemCompleted,
  markScheduleItemStarted,
} from './operations'
import { buildDailySchedule, type ScheduleItemV1 } from './schema'

const DATE = '2026-08-12'

function household(): readonly ScheduleItemV1[] {
  const ada = buildDailySchedule({
    studentRef: 'student:ada',
    date: DATE,
    items: [
      { kind: 'assignment', assignmentRef: 'assignment:1', title: 'Fractions', state: 'planned' },
      { kind: 'assignment', assignmentRef: 'assignment:2', title: 'Grammar', state: 'planned' },
    ],
  })
  const bo = buildDailySchedule({
    studentRef: 'student:bo',
    date: DATE,
    items: [
      { kind: 'assignment', assignmentRef: 'assignment:1', title: 'Fractions', state: 'planned' },
    ],
  })
  return [...ada, ...bo]
}

describe('getNextScheduleItem / getCurrentScheduleItem', () => {
  it('returns the first pending item as next when nothing is in progress', () => {
    const items = household()
    const next = getNextScheduleItem(items, 'student:ada')
    expect(next?.title).toBe('Fractions')
    expect(getCurrentScheduleItem(items, 'student:ada')).toBeNull()
  })

  it('returns the in-progress item as both current and next', () => {
    let items = household()
    const target = getNextScheduleItem(items, 'student:ada')!
    items = markScheduleItemStarted(items, 'student:ada', target.scheduleItemRef)
    expect(getCurrentScheduleItem(items, 'student:ada')?.scheduleItemRef).toBe(target.scheduleItemRef)
    expect(getNextScheduleItem(items, 'student:ada')?.scheduleItemRef).toBe(target.scheduleItemRef)
  })

  it('returns null once every item is completed', () => {
    let items = household()
    for (const item of items.filter((i) => i.studentRef === 'student:ada')) {
      items = markScheduleItemCompleted(items, 'student:ada', item.scheduleItemRef)
    }
    expect(getNextScheduleItem(items, 'student:ada')).toBeNull()
    expect(getCurrentScheduleItem(items, 'student:ada')).toBeNull()
  })
})

describe('mark started / completed', () => {
  it('leaves a completed item completed when started is called again', () => {
    let items = household()
    const target = items.find((i) => i.studentRef === 'student:ada')!
    items = markScheduleItemCompleted(items, 'student:ada', target.scheduleItemRef)
    items = markScheduleItemStarted(items, 'student:ada', target.scheduleItemRef)
    expect(items.find((i) => i.scheduleItemRef === target.scheduleItemRef)?.status).toBe('completed')
  })

  it('is a no-op for an unknown scheduleItemRef', () => {
    const before = household()
    const after = markScheduleItemStarted(before, 'student:ada', 'schedule:does-not-exist')
    expect(after).toBe(before)
  })
})

describe('student separation', () => {
  it('never lets one student see or mutate another student\'s items', () => {
    const before = household()
    const bosItem = before.find((i) => i.studentRef === 'student:bo')!

    // Ada cannot start Bo's item, even though it shares the same assignmentRef.
    const afterWrongStudent = markScheduleItemStarted(before, 'student:ada', bosItem.scheduleItemRef)
    expect(afterWrongStudent).toBe(before)

    // getNext/getCurrent for Ada never surfaces Bo's item.
    expect(getNextScheduleItem(before, 'student:ada')?.studentRef).toBe('student:ada')

    // Completing Bo's item does not touch Ada's identically-named assignment.
    const adaItem = before.find((i) => i.studentRef === 'student:ada' && i.title === 'Fractions')!
    const after = markScheduleItemCompleted(before, 'student:bo', bosItem.scheduleItemRef)
    expect(after.find((i) => i.scheduleItemRef === adaItem.scheduleItemRef)?.status).toBe('pending')
  })

  it('holds even when two students\' host-supplied scheduleItemRefs collide', () => {
    // Breaks/study-sessions get their ref from the host, so a naming collision
    // across students is a real (if unlikely) scenario — unlike assignment
    // items, whose ref always embeds the studentRef.
    const adaBreak = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [{ kind: 'break', scheduleItemRef: 'break:shared', title: 'Break' }],
    })
    const boBreak = buildDailySchedule({
      studentRef: 'student:bo',
      date: DATE,
      items: [{ kind: 'break', scheduleItemRef: 'break:shared', title: 'Break' }],
    })
    const before = [...adaBreak, ...boBreak]
    const after = markScheduleItemCompleted(before, 'student:bo', 'break:shared')
    expect(after.find((i) => i.studentRef === 'student:bo')?.status).toBe('completed')
    expect(after.find((i) => i.studentRef === 'student:ada')?.status).toBe('pending')
  })
})
