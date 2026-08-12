import { describe, expect, it } from 'vitest'
import { markScheduleItemCompleted } from './operations'
import { scheduleProgress } from './projections'
import { buildDailySchedule } from './schema'

const DATE = '2026-08-12'

describe('scheduleProgress', () => {
  it('is vacuously all-done for an empty day', () => {
    const progress = scheduleProgress([], 'student:ada')
    expect(progress).toMatchObject({
      totalItems: 0,
      academicTotal: 0,
      academicCompleted: 0,
      percentComplete: 100,
      allDone: true,
    })
  })

  it('excludes breaks from academic completion', () => {
    const items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        { kind: 'assignment', assignmentRef: 'assignment:1', title: 'Fractions', state: 'planned' },
        { kind: 'break', scheduleItemRef: 'break:morning', title: 'Break', status: 'completed' },
      ],
    })
    const progress = scheduleProgress(items, 'student:ada')
    expect(progress.academicTotal).toBe(1)
    expect(progress.academicCompleted).toBe(0)
    expect(progress.percentComplete).toBe(0)
    // The break is done, but that alone must not read as the day being finished.
    expect(progress.allDone).toBe(false)
  })

  it('reports all-done only once every item, including breaks, is completed', () => {
    let items = buildDailySchedule({
      studentRef: 'student:ada',
      date: DATE,
      items: [
        { kind: 'assignment', assignmentRef: 'assignment:1', title: 'Fractions', state: 'planned' },
        { kind: 'break', scheduleItemRef: 'break:morning', title: 'Break' },
      ],
    })
    items = markScheduleItemCompleted(items, 'student:ada', items[0].scheduleItemRef)
    expect(scheduleProgress(items, 'student:ada').allDone).toBe(false)
    items = markScheduleItemCompleted(items, 'student:ada', items[1].scheduleItemRef)
    const progress = scheduleProgress(items, 'student:ada')
    expect(progress.allDone).toBe(true)
    expect(progress.percentComplete).toBe(100)
  })

  it('only reports the addressed student\'s items', () => {
    const items = [
      ...buildDailySchedule({
        studentRef: 'student:ada',
        date: DATE,
        items: [{ kind: 'assignment', assignmentRef: 'assignment:1', title: 'Fractions', state: 'completed' }],
      }),
      ...buildDailySchedule({
        studentRef: 'student:bo',
        date: DATE,
        items: [
          { kind: 'assignment', assignmentRef: 'assignment:1', title: 'Fractions', state: 'planned' },
          { kind: 'assignment', assignmentRef: 'assignment:2', title: 'Grammar', state: 'planned' },
        ],
      }),
    ]
    expect(scheduleProgress(items, 'student:ada')).toMatchObject({ totalItems: 1, allDone: true })
    expect(scheduleProgress(items, 'student:bo')).toMatchObject({ totalItems: 2, allDone: false })
  })
})
