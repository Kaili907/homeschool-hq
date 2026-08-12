import { describe, expect, it } from 'vitest'
import {
  getHealthCourse,
  getHealthLesson,
  getHealthUnit,
  getHealthUnitById,
  getUnitForLesson,
  listHealthLessons,
  listHealthLessonsForUnit,
  listHealthUnits,
  nextHealthLesson,
} from './lookup'
import { loadHealthCatalog } from './rawContent.node'

const catalog = loadHealthCatalog()

describe('health lookup', () => {
  it('getHealthCourse finds a course by grade and returns null for an unknown grade', () => {
    expect(getHealthCourse(catalog, '7')?.courseId).toBe('ma-g7-health')
    expect(getHealthCourse(catalog, '6' as never)).toBeNull()
  })

  it('listHealthUnits / getHealthUnit return the 6 units for a grade in order', () => {
    const units = listHealthUnits(catalog, '5')
    expect(units.map((unit) => unit.unitNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(getHealthUnit(catalog, '5', 4)?.title).toBe('Relationships, Communication, and Consent Foundations')
    expect(getHealthUnit(catalog, '5', 99)).toBeNull()
  })

  it('getHealthUnitById finds a unit across the whole catalog', () => {
    expect(getHealthUnitById(catalog, 'ma-g8-health-u06')?.unitNumber).toBe(6)
    expect(getHealthUnitById(catalog, 'not-a-real-unit')).toBeNull()
  })

  it('listHealthLessons / getHealthLesson resolve real lessons and reject unknown ids', () => {
    expect(listHealthLessons(catalog, '8')).toHaveLength(36)
    expect(getHealthLesson(catalog, 'ma-g8-health-u01-l01')?.title).toContain('Launch and diagnostic')
    expect(getHealthLesson(catalog, 'not-a-real-lesson')).toBeNull()
  })

  it('listHealthLessonsForUnit filters to just that unit, in day order', () => {
    const lessons = listHealthLessonsForUnit(catalog, '7', 5)
    expect(lessons).toHaveLength(6)
    expect(lessons.every((lesson) => lesson.unitNumber === 5)).toBe(true)
    expect(lessons.map((lesson) => lesson.dayInUnit)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('getUnitForLesson pairs a lesson with its own unit', () => {
    const unit = getUnitForLesson(catalog, 'ma-g5-health-u02-l03')
    expect(unit?.unitNumber).toBe(2)
    expect(getUnitForLesson(catalog, 'not-a-real-lesson')).toBeNull()
  })

  it('nextHealthLesson walks completion order and returns null past the end', () => {
    expect(nextHealthLesson(catalog, 'ma-g5-health-u01-l01')?.lessonId).toBe('ma-g5-health-u01-l02')
    expect(nextHealthLesson(catalog, 'ma-g5-health-u06-l06')).toBeNull()
    expect(nextHealthLesson(catalog, 'not-a-real-lesson')).toBeNull()
  })
})
