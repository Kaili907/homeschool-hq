import { describe, expect, it } from 'vitest'
import { loadSocialStudiesCatalog } from './source.node'
import {
  SOCIAL_STUDIES_LESSONS_PER_GRADE,
  SOCIAL_STUDIES_PHASE_SEQUENCE,
  SOCIAL_STUDIES_TOTAL_LESSONS,
  SOCIAL_STUDIES_TOTAL_UNITS,
  SOCIAL_STUDIES_UNITS_PER_GRADE,
} from './types'

describe('FF-M3 loadSocialStudiesCatalog', () => {
  const catalog = loadSocialStudiesCatalog()

  it('loads one social studies course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.courseId).toBe(`ma-g${course.grade}-social-studies`)
      expect(course.title).toBe(`Grade ${course.grade} Social Studies`)
    }
  })

  it('matches the exact canonical expectation: 108 lessons / 9 units per grade, 324 / 27 total', () => {
    for (const course of catalog.courses) {
      expect(course.lessons.length).toBe(SOCIAL_STUDIES_LESSONS_PER_GRADE)
      expect(course.units.length).toBe(SOCIAL_STUDIES_UNITS_PER_GRADE)
      expect(course.assessments.length).toBe(SOCIAL_STUDIES_UNITS_PER_GRADE)
    }
    const totalLessons = catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
    const totalUnits = catalog.courses.reduce((sum, course) => sum + course.units.length, 0)
    expect(totalLessons).toBe(SOCIAL_STUDIES_TOTAL_LESSONS)
    expect(totalLessons).toBe(324)
    expect(totalUnits).toBe(SOCIAL_STUDIES_TOTAL_UNITS)
    expect(totalUnits).toBe(27)
  })

  it('resolves every unit lesson id to a catalog lesson, with no missing lessons', () => {
    for (const course of catalog.courses) {
      const lessonIds = new Set(course.lessons.map((lesson) => lesson.lessonId))
      for (const unit of course.units) {
        expect(unit.lessonIds.length).toBe(SOCIAL_STUDIES_PHASE_SEQUENCE.length)
        for (const lessonId of unit.lessonIds) {
          expect(lessonIds.has(lessonId)).toBe(true)
        }
      }
      for (const lesson of course.lessons) {
        const unit = course.units.find((u) => u.unitId === lesson.unitId)
        expect(unit).toBeDefined()
        expect(unit!.lessonIds).toContain(lesson.lessonId)
        expect(unit!.unitNumber).toBe(lesson.unitNumber)
      }
    }
  })

  it('orders each course as a gapless 1..108 completion sequence with no duplicate refs', () => {
    for (const course of catalog.courses) {
      const days = course.lessons.map((lesson) => lesson.courseDay)
      expect(days).toEqual(Array.from({ length: days.length }, (_, i) => i + 1))

      const lessonIds = course.lessons.map((lesson) => lesson.lessonId)
      expect(new Set(lessonIds).size).toBe(lessonIds.length)

      const unitIds = course.units.map((unit) => unit.unitId)
      expect(new Set(unitIds).size).toBe(unitIds.length)
    }
  })

  it('repeats the same 12-phase sequence in the same order in every unit of every grade', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        const lessonsInUnit = unit.lessonIds.map((id) => course.lessons.find((lesson) => lesson.lessonId === id)!)
        expect(lessonsInUnit.map((lesson) => lesson.phase)).toEqual([...SOCIAL_STUDIES_PHASE_SEQUENCE])
      }
    }
  })

  it('has no duplicate lesson refs across the whole catalog (grades never collide)', () => {
    const allLessonIds = catalog.courses.flatMap((course) => course.lessons.map((lesson) => lesson.lessonId))
    expect(new Set(allLessonIds).size).toBe(allLessonIds.length)
    expect(allLessonIds.length).toBe(324)
  })

  it('carries source/evidence metadata (standards, focus, essential question) for every lesson', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.standards.length).toBeGreaterThan(0)
        expect(lesson.focus.length).toBeGreaterThan(0)
        expect(lesson.essentialQuestion.length).toBeGreaterThan(0)
      }
    }
  })

  it('joins exactly one assessment to each unit, matching unit and assessment unit numbers', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        const assessment = course.assessments.find((a) => a.assessmentId === unit.assessmentId)
        expect(assessment).toBeDefined()
        expect(assessment!.unitNumber).toBe(unit.unitNumber)
      }
    }
  })

  it('is deterministic and cached: repeated loads return the same frozen catalog', () => {
    const again = loadSocialStudiesCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.courses[0])).toBe(true)
    expect(Object.isFrozen(catalog.courses[0].lessons)).toBe(true)
  })
})
