import { describe, expect, it } from 'vitest'
import { loadElaCatalog } from './source.node'
import { validateElaSubjectLane } from './validate'

describe('validateElaSubjectLane', () => {
  it('proves the exact grade/unit/lesson counts this lane promises', () => {
    const report = validateElaSubjectLane(loadElaCatalog())
    expect(report.releaseVersion).toBe('1.0.0')
    expect(report.lessonsByGrade).toEqual({ '5': 180, '7': 180, '8': 180 })
    expect(report.unitsByGrade).toEqual({ '5': 10, '7': 10, '8': 10 })
    expect(report.totalLessons).toBe(540)
  })

  it('rejects a catalog missing a grade', () => {
    const catalog = loadElaCatalog()
    const missingGrade = { ...catalog, courses: catalog.courses.slice(1) }
    expect(() => validateElaSubjectLane(missingGrade)).toThrow(/exactly grades/)
  })

  it('rejects a course with the wrong lesson count', () => {
    const catalog = loadElaCatalog()
    const truncated = {
      ...catalog,
      courses: catalog.courses.map((course, i) => (i === 0 ? { ...course, lessons: course.lessons.slice(0, 5) } : course)),
    }
    expect(() => validateElaSubjectLane(truncated)).toThrow(/must have 180 lessons/)
  })

  it('rejects duplicate lesson refs across grades', () => {
    const catalog = loadElaCatalog()
    const collided = {
      ...catalog,
      courses: catalog.courses.map((course, i) =>
        i === 1 ? { ...course, lessons: [catalog.courses[0].lessons[0], ...course.lessons.slice(1)] } : course,
      ),
    }
    expect(() => validateElaSubjectLane(collided)).toThrow()
  })
})
