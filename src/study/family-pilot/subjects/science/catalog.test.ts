import { describe, expect, it } from 'vitest'
import {
  getScienceCourse,
  getScienceLesson,
  getScienceUnitAssessment,
  listScienceLessons,
  listScienceUnits,
} from './catalog'
import { loadScienceCatalog } from './source.node'

describe('FAMILY-PILOT-SCIENCE-1 catalog queries (real curriculum content)', () => {
  const catalog = loadScienceCatalog()

  it('getScienceCourse resolves each pilot grade', () => {
    for (const grade of ['5', '7', '8'] as const) {
      expect(getScienceCourse(catalog, grade)?.grade).toBe(grade)
    }
  })

  it('listScienceUnits returns exactly 9 units, in unit_number order', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const units = listScienceUnits(catalog, grade)
      expect(units).toHaveLength(9)
      expect(units.map((unit) => unit.unitNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    }
  })

  it('listScienceLessons returns exactly 108 lessons in schedule (course_day) order', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const lessons = listScienceLessons(catalog, grade)
      expect(lessons).toHaveLength(108)
      expect(lessons.map((lesson) => lesson.courseDay)).toEqual(
        Array.from({ length: 108 }, (_unused, index) => index + 1),
      )
    }
  })

  it('getScienceLesson resolves every ref returned by listScienceLessons, with matching detail', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const ref of listScienceLessons(catalog, grade)) {
        const detail = getScienceLesson(catalog, grade, ref.lessonId)
        expect(detail).toBeDefined()
        expect(detail!.lessonId).toBe(ref.lessonId)
        expect(detail!.courseDay).toBe(ref.courseDay)
        expect(detail!.unitId).toBe(ref.unitId)
      }
    }
  })

  it('getScienceLesson returns undefined for an unknown ref or the wrong grade', () => {
    expect(getScienceLesson(catalog, '5', 'does-not-exist')).toBeUndefined()
    const g7Lesson = listScienceLessons(catalog, '7')[0].lessonId
    expect(getScienceLesson(catalog, '5', g7Lesson)).toBeUndefined()
  })

  it('getScienceUnitAssessment resolves a unit with an assessment_id and returns matching standards', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const unit of listScienceUnits(catalog, grade)) {
        if (unit.assessmentId === null) continue
        const assessment = getScienceUnitAssessment(catalog, grade, unit.unitId)
        expect(assessment).toBeDefined()
        expect(assessment!.assessmentId).toBe(unit.assessmentId)
        expect(assessment!.unitNumber).toBe(unit.unitNumber)
        expect(assessment!.prompts.length).toBeGreaterThan(0)
      }
    }
  })

  it('getScienceUnitAssessment returns undefined for an unknown unit', () => {
    expect(getScienceUnitAssessment(catalog, '5', 'does-not-exist')).toBeUndefined()
  })
})
