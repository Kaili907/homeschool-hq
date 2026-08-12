import { describe, expect, it } from 'vitest'
import { loadFinancialLiteracyCatalog } from './source.node'

const EXPECTED_LESSON_COUNT: Readonly<Record<'5' | '7' | '8', number>> = { '5': 36, '7': 36, '8': 72 }
const EXPECTED_UNIT_COUNT: Readonly<Record<'5' | '7' | '8', number>> = { '5': 6, '7': 6, '8': 7 }

describe('FAMILY-PILOT-FINLIT-1 loadFinancialLiteracyCatalog', () => {
  const catalog = loadFinancialLiteracyCatalog()

  it('loads one financial-literacy course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.subject).toBe('financial-literacy')
      expect(course.courseId).toBe(`ma-g${course.grade}-financial-literacy`)
      expect(course.title).toBe(`Grade ${course.grade} Financial Literacy`)
    }
  })

  it('matches the canonical lesson and unit counts: 36/36/72 lessons, 6/6/7 units, 144 lessons and 19 units total', () => {
    let totalLessons = 0
    let totalUnits = 0
    for (const course of catalog.courses) {
      expect(course.lessons.length).toBe(EXPECTED_LESSON_COUNT[course.grade])
      expect(course.units.length).toBe(EXPECTED_UNIT_COUNT[course.grade])
      totalLessons += course.lessons.length
      totalUnits += course.units.length
    }
    expect(totalLessons).toBe(144)
    expect(totalUnits).toBe(19)
  })

  it('retains exactly PF1..PF7 coverage across grade 8, one per unit, in unit order', () => {
    const grade8 = catalog.courses.find((course) => course.grade === '8')!
    expect(grade8.units.length).toBe(7)
    const pfTags = grade8.units.map((unit) => unit.standards.find((standard) => /^PF[1-7]$/.test(standard)))
    expect(pfTags).toEqual(['PF1', 'PF2', 'PF3', 'PF4', 'PF5', 'PF6', 'PF7'])

    const pfInLessons = new Set(
      grade8.lessons.flatMap((lesson) => lesson.standards.filter((standard) => /^PF[1-7]$/.test(standard))),
    )
    expect([...pfInLessons].sort()).toEqual(['PF1', 'PF2', 'PF3', 'PF4', 'PF5', 'PF6', 'PF7'])
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

  it('is deterministic and cached: repeated loads return the same frozen catalog with stable refs', () => {
    const again = loadFinancialLiteracyCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.courses[0])).toBe(true)
    expect(Object.isFrozen(catalog.courses[0].lessons)).toBe(true)
    // Same lessonId on every load — a stable, opaque ref callers can persist.
    expect(again.courses[0].lessons[0].lessonId).toBe(catalog.courses[0].lessons[0].lessonId)
  })

  it('never captures a real-finance field name on any loaded lesson or unit', () => {
    // A key-name check, not a prose scan: legitimate lesson content teaches
    // ABOUT fraud, password, and credit-card safety (that vocabulary is
    // expected in titles), but this catalog's own fields must never be a
    // place to hold one of the real values that vocabulary warns against.
    const banned = /account.?number|routing.?number|social.?security|\bssn\b|credit.?card.?number|password|tax.?id|brokerage.?(account|credential)/i
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(Object.keys(lesson).some((key) => banned.test(key))).toBe(false)
      }
      for (const unit of course.units) {
        expect(Object.keys(unit).some((key) => banned.test(key))).toBe(false)
      }
    }
  })
})
