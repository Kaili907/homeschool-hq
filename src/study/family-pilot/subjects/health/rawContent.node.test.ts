import { describe, expect, it } from 'vitest'
import { loadHealthCatalog } from './rawContent.node'

describe('loadHealthCatalog', () => {
  const catalog = loadHealthCatalog()

  it('loads exactly one course per published grade, in grade order', () => {
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
  })

  it('loads 36 lessons and 6 units per grade — 108 lessons / 18 units total', () => {
    let totalLessons = 0
    let totalUnits = 0
    for (const course of catalog.courses) {
      expect(course.lessons).toHaveLength(36)
      expect(course.units).toHaveLength(6)
      totalLessons += course.lessons.length
      totalUnits += course.units.length
    }
    expect(totalLessons).toBe(108)
    expect(totalUnits).toBe(18)
  })

  it.each(['5', '7', '8'] as const)('grade %s: first lesson is unit 1 day 1', (grade) => {
    const course = catalog.courses.find((candidate) => candidate.grade === grade)!
    const first = course.lessons[0]
    expect(first.lessonId).toBe(`ma-g${grade}-health-u01-l01`)
    expect(first.courseDay).toBe(1)
    expect(first.unitNumber).toBe(1)
    expect(first.dayInUnit).toBe(1)
  })

  it.each(['5', '7', '8'] as const)('grade %s: mid-course lesson (day 18) is unit 3 day 6', (grade) => {
    const course = catalog.courses.find((candidate) => candidate.grade === grade)!
    const mid = course.lessons[17]
    expect(mid.lessonId).toBe(`ma-g${grade}-health-u03-l06`)
    expect(mid.courseDay).toBe(18)
    expect(mid.unitNumber).toBe(3)
    expect(mid.dayInUnit).toBe(6)
  })

  it.each(['5', '7', '8'] as const)('grade %s: last lesson is unit 6 day 6', (grade) => {
    const course = catalog.courses.find((candidate) => candidate.grade === grade)!
    const last = course.lessons[course.lessons.length - 1]
    expect(last.lessonId).toBe(`ma-g${grade}-health-u06-l06`)
    expect(last.courseDay).toBe(36)
    expect(last.unitNumber).toBe(6)
    expect(last.dayInUnit).toBe(6)
  })

  it('every unit has exactly 6 lessons in completion order', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        expect(unit.lessonIds).toHaveLength(6)
      }
    }
  })

  it('every lesson belongs to a unit that lists it', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const unit = course.units.find((candidate) => candidate.unitNumber === lesson.unitNumber)
        expect(unit).toBeDefined()
        expect(unit!.lessonIds).toContain(lesson.lessonId)
      }
    }
  })

  it('caches the catalog across calls', () => {
    expect(loadHealthCatalog()).toBe(catalog)
  })
})
