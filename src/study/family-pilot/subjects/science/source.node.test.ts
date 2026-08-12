import { describe, expect, it } from 'vitest'
import { loadScienceCatalog } from './source.node'

describe('FAMILY-PILOT-SCIENCE-1 loadScienceCatalog', () => {
  const catalog = loadScienceCatalog()

  it('loads one science course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.subject).toBe('science')
      expect(course.courseId).toBe(`ma-g${course.grade}-science`)
      expect(course.title).toBe(`Grade ${course.grade} Science`)
    }
  })

  it('gives every grade exactly 108 lessons across exactly 9 units — 324 lessons total', () => {
    expect(catalog.courses).toHaveLength(3)
    for (const course of catalog.courses) {
      expect(course.lessons).toHaveLength(108)
      expect(course.units).toHaveLength(9)
    }
    const total = catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
    expect(total).toBe(324)
  })

  it('pins the first, a middle, and the last lesson of a course by ref and position', () => {
    const g5 = catalog.courses.find((course) => course.grade === '5')!
    expect(g5.lessons[0].lessonId).toBe('ma-g5-science-u01-l01')
    expect(g5.lessons[0].courseDay).toBe(1)
    expect(g5.lessons[53].courseDay).toBe(54)
    expect(g5.lessons[107].lessonId).toBe('ma-g5-science-u09-l12')
    expect(g5.lessons[107].courseDay).toBe(108)
  })

  it('resolves every unit lesson id to a catalog lesson, with no missing lessons', () => {
    for (const course of catalog.courses) {
      const lessonIds = new Set(course.lessons.map((lesson) => lesson.lessonId))
      for (const unit of course.units) {
        expect(unit.lessonIds.length).toBeGreaterThan(0)
        for (const lessonId of unit.lessonIds) {
          expect(lessonIds.has(lessonId)).toBe(true)
        }
      }
      for (const lesson of course.lessons) {
        const unit = course.units.find((candidate) => candidate.unitId === lesson.unitId)
        expect(unit).toBeDefined()
        expect(unit!.lessonIds).toContain(lesson.lessonId)
        expect(unit!.unitNumber).toBe(lesson.unitNumber)
      }
    }
  })

  it('orders each course as a gapless 1..N schedule sequence with no duplicate refs', () => {
    for (const course of catalog.courses) {
      const days = course.lessons.map((lesson) => lesson.courseDay)
      expect(days).toEqual(Array.from({ length: days.length }, (_unused, index) => index + 1))

      const lessonIds = course.lessons.map((lesson) => lesson.lessonId)
      expect(new Set(lessonIds).size).toBe(lessonIds.length)

      const unitIds = course.units.map((unit) => unit.unitId)
      expect(new Set(unitIds).size).toBe(unitIds.length)
    }
  })

  it('has no duplicate lesson refs across the whole catalog (grades never collide)', () => {
    const allLessonIds = catalog.courses.flatMap((course) => course.lessons.map((lesson) => lesson.lessonId))
    expect(new Set(allLessonIds).size).toBe(allLessonIds.length)
    // Every ref embeds its own grade, so a stray copy-paste across grades is
    // structurally impossible, not just coincidentally absent today.
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.lessonId).toContain(`g${course.grade}-science`)
      }
    }
  })

  it('every lesson detail declares media as optional with a text-only fallback', () => {
    for (const course of catalog.courses) {
      for (const detail of course.lessonDetailById.values()) {
        expect(detail.safety.mediaRequired).toBe(false)
        expect(detail.safety.noMediaFallback.length).toBeGreaterThan(0)
      }
    }
  })

  it('every lesson detail carries non-empty guardian-visible safety text', () => {
    for (const course of catalog.courses) {
      for (const detail of course.lessonDetailById.values()) {
        expect(detail.safety.safetyAndPrivacy.length).toBeGreaterThan(0)
        expect(detail.safety.parentOrGuardianVisibility.length).toBeGreaterThan(0)
      }
    }
  })

  it('every lesson has the fixed five-part lesson flow', () => {
    for (const course of catalog.courses) {
      for (const detail of course.lessonDetailById.values()) {
        expect(detail.lessonFlow).toHaveLength(5)
      }
    }
  })

  it('resolves every unit assessment_id to a loaded assessment', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        if (unit.assessmentId === null) continue
        expect(course.assessmentsById.has(unit.assessmentId)).toBe(true)
      }
    }
  })

  it('is deterministic and cached: repeated loads return the same frozen catalog', () => {
    const again = loadScienceCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.courses[0])).toBe(true)
    expect(Object.isFrozen(catalog.courses[0].lessons)).toBe(true)
  })
})
