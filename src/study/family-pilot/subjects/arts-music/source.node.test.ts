import { describe, expect, it } from 'vitest'
import { loadArtsMusicCatalog } from './source.node'

describe('ARTS-MUSIC-1 loadArtsMusicCatalog', () => {
  const catalog = loadArtsMusicCatalog()

  it('loads one arts-and-music course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.subject).toBe('arts-and-music')
      expect(course.courseId).toBe(`ma-g${course.grade}-arts-and-music`)
      expect(course.title).toBe(`Grade ${course.grade} Arts & Music`)
    }
  })

  it('exact counts: 72 lessons and 6 units per grade, 216 lessons and 18 units total', () => {
    for (const course of catalog.courses) {
      expect(course.lessons.length).toBe(72)
      expect(course.units.length).toBe(6)
    }
    expect(catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)).toBe(216)
    expect(catalog.courses.reduce((sum, course) => sum + course.units.length, 0)).toBe(18)
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
      // Every catalog lesson also belongs to exactly the unit it claims.
      for (const lesson of course.lessons) {
        const unit = course.units.find((u) => u.unitId === lesson.unitId)
        expect(unit).toBeDefined()
        expect(unit!.lessonIds).toContain(lesson.lessonId)
        expect(unit!.unitNumber).toBe(lesson.unitNumber)
      }
    }
  })

  it('orders each course as a gapless 1..N completion sequence with no duplicate refs', () => {
    for (const course of catalog.courses) {
      const days = course.lessons.map((lesson) => lesson.courseDay)
      expect(days).toEqual(Array.from({ length: days.length }, (_, i) => i + 1))

      const lessonIds = course.lessons.map((lesson) => lesson.lessonId)
      expect(new Set(lessonIds).size).toBe(lessonIds.length)

      const unitIds = course.units.map((unit) => unit.unitId)
      expect(new Set(unitIds).size).toBe(unitIds.length)
    }
  })

  it('has no duplicate lesson refs across the whole catalog (grades never collide)', () => {
    const allLessonIds = catalog.courses.flatMap((course) => course.lessons.map((lesson) => lesson.lessonId))
    expect(new Set(allLessonIds).size).toBe(allLessonIds.length)
  })

  it('every lesson carries a non-empty lesson_flow used for Study segment adaptation', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.lessonFlow.length).toBeGreaterThan(0)
        for (const step of lesson.lessonFlow) {
          expect(step.segment.length).toBeGreaterThan(0)
          expect(step.minutes.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('every unit carries a non-empty performance/portfolio task description', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        expect(unit.performanceTask.length).toBeGreaterThan(0)
      }
    }
  })

  it('is deterministic and cached: repeated loads return the same frozen catalog', () => {
    const again = loadArtsMusicCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.courses[0])).toBe(true)
    expect(Object.isFrozen(catalog.courses[0].lessons)).toBe(true)
  })
})
