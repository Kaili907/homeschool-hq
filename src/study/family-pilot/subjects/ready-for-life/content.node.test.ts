import { describe, expect, it } from 'vitest'
import { RflContentError, getReadyForLifeCourse, getReadyForLifeLesson, loadReadyForLifeCatalog } from './content.node'

describe('FULL-FAMILY-READY-FOR-LIFE loadReadyForLifeCatalog', () => {
  const catalog = loadReadyForLifeCatalog()

  it('loads one Ready for Life course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.subject).toBe('ready-for-life')
      expect(course.courseId).toBe(`ma-g${course.grade}-ready-for-life`)
      expect(course.title).toBe(`Grade ${course.grade} Ready for Life`)
    }
  })

  it('has exactly 36 lessons and 6 units per grade — canonical course scope', () => {
    for (const course of catalog.courses) {
      expect(course.lessons.length).toBe(36)
      expect(course.units.length).toBe(6)
    }
  })

  it('totals exactly 108 lessons and 18 units across the pilot — canonical course scope', () => {
    const totalLessons = catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
    const totalUnits = catalog.courses.reduce((sum, course) => sum + course.units.length, 0)
    expect(totalLessons).toBe(108)
    expect(totalUnits).toBe(18)
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
        const unit = course.units.find((u) => u.unitId === lesson.unitId)
        expect(unit).toBeDefined()
        expect(unit!.lessonIds).toContain(lesson.lessonId)
        expect(unit!.unitNumber).toBe(lesson.unitNumber)
        expect(unit!.title).toBe(lesson.unitTitle)
      }
    }
  })

  it('orders each course as a gapless 1..36 completion sequence with no duplicate refs', () => {
    for (const course of catalog.courses) {
      const days = course.lessons.map((lesson) => lesson.courseDay)
      expect(days).toEqual(Array.from({ length: 36 }, (_, i) => i + 1))

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

  it('is deterministic and cached: repeated loads return the same frozen catalog', () => {
    const again = loadReadyForLifeCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.courses[0])).toBe(true)
    expect(Object.isFrozen(catalog.courses[0].lessons)).toBe(true)
  })

  it('routes to the correct course for each grade — grade routing', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const course = getReadyForLifeCourse(catalog, grade)
      expect(course.grade).toBe(grade)
      expect(course.lessons.every((lesson) => lesson.grade === grade)).toBe(true)
    }
  })

  it('rejects an unsupported grade with a precise error rather than a guess', () => {
    // @ts-expect-error deliberately outside AcademyGrade to exercise the routing guard
    expect(() => getReadyForLifeCourse(catalog, '6')).toThrow(RflContentError)
  })

  it('resolves a lesson by id from anywhere in the catalog', () => {
    const known = catalog.courses[0].lessons[0]
    const lesson = getReadyForLifeLesson(catalog, known.lessonId)
    expect(lesson).toEqual(known)
    expect(() => getReadyForLifeLesson(catalog, 'not-a-real-lesson')).toThrow(RflContentError)
  })

  it('every lesson carries the fields the safety/study/tutor adapters depend on', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.lessonFlow.length).toBeGreaterThan(0)
        expect(lesson.safetyAndPrivacy.length).toBeGreaterThan(0)
        expect(lesson.parentOrGuardianVisibility.length).toBeGreaterThan(0)
        expect(lesson.homeConnection.length).toBeGreaterThan(0)
        expect(lesson.adaptiveTutorRoutes.length).toBeGreaterThan(0)
      }
    }
  })
})
