import { describe, expect, it } from 'vitest'
import {
  getLesson,
  getNextLesson,
  getUnit,
  listLessonsForGrade,
  listLessonsForUnit,
  listUnitsForGrade,
  totalLessonCount,
  totalUnitCount,
} from './catalog'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'

const catalog = loadPhysicalEducationCatalog()

describe('activity lesson resolution', () => {
  it('resolves a lesson by id regardless of which grade it belongs to', () => {
    const lesson = getLesson(catalog, 'ma-g7-physical-education-u03-l05')
    expect(lesson?.lessonId).toBe('ma-g7-physical-education-u03-l05')
    expect(lesson?.grade).toBe('7')
  })

  it('returns undefined for an unknown lesson id', () => {
    expect(getLesson(catalog, 'not-a-real-lesson')).toBeUndefined()
  })

  it('resolves every lesson listed in a unit, in day order', () => {
    const unit = listUnitsForGrade(catalog, '5')[0]
    const lessons = listLessonsForUnit(catalog, unit.unitId)
    expect(lessons.map((lesson) => lesson.lessonId)).toEqual(unit.lessonIds)
    lessons.forEach((lesson, index) => expect(lesson.dayInUnit).toBe(index + 1))
  })

  it('resolves a unit by id', () => {
    const unit = getUnit(catalog, 'ma-g8-physical-education-u01')
    expect(unit?.unitNumber).toBe(1)
    expect(unit?.grade).toBe('8')
  })

  it('resolves the next lesson in course order, and undefined past the last lesson', () => {
    const lessons = listLessonsForGrade(catalog, '5')
    const next = getNextLesson(catalog, lessons[0].lessonId)
    expect(next?.lessonId).toBe(lessons[1].lessonId)
    expect(getNextLesson(catalog, lessons[lessons.length - 1].lessonId)).toBeUndefined()
  })

  it('never resolves a grade-5 lesson id against the grade-7 or grade-8 course', () => {
    const grade5Lesson = listLessonsForGrade(catalog, '5')[0]
    expect(listLessonsForGrade(catalog, '7').some((lesson) => lesson.lessonId === grade5Lesson.lessonId)).toBe(false)
    expect(listLessonsForGrade(catalog, '8').some((lesson) => lesson.lessonId === grade5Lesson.lessonId)).toBe(false)
  })
})

describe('exact counts', () => {
  it('totals 324 lessons and 27 units', () => {
    expect(totalLessonCount(catalog)).toBe(324)
    expect(totalUnitCount(catalog)).toBe(27)
  })
})
