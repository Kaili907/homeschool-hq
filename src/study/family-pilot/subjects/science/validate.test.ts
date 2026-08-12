import { describe, expect, it } from 'vitest'
import { loadScienceCatalog } from './source.node'
import type { ScienceCatalog } from './types'
import { validateScienceSubjectLane } from './validate'

describe('FAMILY-PILOT-SCIENCE-1 validateScienceSubjectLane', () => {
  it('reports ok with 108/108/108 lessons, 9 units each, and 324 total against the real catalog', () => {
    const report = validateScienceSubjectLane()
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])
    expect(report.totalLessons).toBe(324)
    expect(report.lessonsByGrade).toEqual({ '5': 108, '7': 108, '8': 108 })
    expect(report.unitsByGrade).toEqual({ '5': 9, '7': 9, '8': 9 })
  })

  it('accepts an explicitly-passed catalog, not only the cached default', () => {
    const catalog = loadScienceCatalog()
    const report = validateScienceSubjectLane(catalog)
    expect(report.ok).toBe(true)
  })

  it('flags a grade with the wrong lesson count instead of silently passing', () => {
    const catalog = loadScienceCatalog()
    const broken: ScienceCatalog = {
      ...catalog,
      courses: catalog.courses.map((course) =>
        course.grade === '5' ? { ...course, lessons: course.lessons.slice(0, 100) } : course,
      ),
    }
    const report = validateScienceSubjectLane(broken)
    expect(report.ok).toBe(false)
    expect(report.issues.some((issue) => issue.includes('grade 5') && issue.includes('108'))).toBe(true)
    expect(report.totalLessons).toBe(316)
  })

  it('flags a cross-grade lesson id collision instead of silently passing', () => {
    const catalog = loadScienceCatalog()
    const collidingLessonId = catalog.courses[1].lessons[0].lessonId
    const broken: ScienceCatalog = {
      ...catalog,
      courses: catalog.courses.map((course, index) =>
        index === 0
          ? {
              ...course,
              lessons: [{ ...course.lessons[0], lessonId: collidingLessonId }, ...course.lessons.slice(1)],
            }
          : course,
      ),
    }
    const report = validateScienceSubjectLane(broken)
    expect(report.ok).toBe(false)
    expect(report.issues).toContain('lesson refs collide across grades or within a grade')
  })

  it('flags a non-gapless course_day schedule instead of silently passing', () => {
    const catalog = loadScienceCatalog()
    const broken: ScienceCatalog = {
      ...catalog,
      courses: catalog.courses.map((course, index) =>
        index === 0
          ? { ...course, lessons: [{ ...course.lessons[0], courseDay: 99 }, ...course.lessons.slice(1)] }
          : course,
      ),
    }
    const report = validateScienceSubjectLane(broken)
    expect(report.ok).toBe(false)
    expect(report.issues.some((issue) => issue.includes('gapless'))).toBe(true)
  })
})
