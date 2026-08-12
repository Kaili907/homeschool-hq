import { describe, expect, it } from 'vitest'
import { loadPhysicalEducationCatalog } from './curriculumSource.node'

describe('loadPhysicalEducationCatalog', () => {
  it('loads exactly 324 lessons across the three published grades', () => {
    const catalog = loadPhysicalEducationCatalog()
    const total = catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
    expect(total).toBe(324)
  })

  it('loads exactly 108 lessons for each of grade 5, 7, and 8', () => {
    const catalog = loadPhysicalEducationCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      const course = catalog.courses.find((candidate) => candidate.grade === grade)
      expect(course?.lessons.length).toBe(108)
    }
  })

  it('loads exactly 27 units across the three published grades', () => {
    const catalog = loadPhysicalEducationCatalog()
    const total = catalog.courses.reduce((sum, course) => sum + course.units.length, 0)
    expect(total).toBe(27)
  })

  it('loads exactly 9 units for each of grade 5, 7, and 8', () => {
    const catalog = loadPhysicalEducationCatalog()
    for (const grade of ['5', '7', '8'] as const) {
      const course = catalog.courses.find((candidate) => candidate.grade === grade)
      expect(course?.units.length).toBe(9)
    }
  })

  it('covers exactly grades 5, 7, and 8, in that order', () => {
    const catalog = loadPhysicalEducationCatalog()
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
  })

  it('every unit has exactly 12 lessons, matching 9 units x 12 lessons = 108', () => {
    const catalog = loadPhysicalEducationCatalog()
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        expect(unit.lessonIds.length).toBe(12)
      }
    }
  })

  it('orders lessons within a course by course_day, 1..N with no gaps', () => {
    const catalog = loadPhysicalEducationCatalog()
    for (const course of catalog.courses) {
      course.lessons.forEach((lesson, index) => {
        expect(lesson.courseDay).toBe(index + 1)
      })
    }
  })

  it('caches the loaded catalog across calls', () => {
    expect(loadPhysicalEducationCatalog()).toBe(loadPhysicalEducationCatalog())
  })
})
