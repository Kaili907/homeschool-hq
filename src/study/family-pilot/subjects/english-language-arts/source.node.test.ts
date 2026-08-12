import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { AcademyGrade } from '../../../../types'
import { getElaCourse, getElaLesson, listElaLessons, listElaUnits } from './catalog'
import { loadElaCatalog } from './source.node'

describe('FAMILY-PILOT-SUBJECT-ELA loadElaCatalog', () => {
  const catalog = loadElaCatalog()

  it('loads one english-language-arts course per pilot grade, from the active release', () => {
    expect(catalog.releaseVersion).toBe('1.0.0')
    expect(catalog.courses.map((course) => course.grade)).toEqual(['5', '7', '8'])
    for (const course of catalog.courses) {
      expect(course.subject).toBe('english-language-arts')
      expect(course.courseId).toBe(`ma-g${course.grade}-english-language-arts`)
      expect(course.title).toBe(`Grade ${course.grade} English Language Arts`)
    }
  })

  it('has exactly 180 lessons and 10 units per grade, 540 lessons total', () => {
    for (const grade of ['5', '7', '8'] as const) {
      expect(listElaLessons(catalog, grade).length).toBe(180)
      expect(listElaUnits(catalog, grade).length).toBe(10)
    }
    const total = catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
    expect(total).toBe(540)
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

  it('has no duplicate lesson or unit refs across the whole catalog (grades never collide)', () => {
    const allLessonIds = catalog.courses.flatMap((course) => course.lessons.map((lesson) => lesson.lessonId))
    expect(new Set(allLessonIds).size).toBe(allLessonIds.length)
    const allUnitIds = catalog.courses.flatMap((course) => course.units.map((unit) => unit.unitId))
    expect(new Set(allUnitIds).size).toBe(allUnitIds.length)
  })

  it('resolves the first, a middle, and the last lesson of a grade in course order', () => {
    const lessons = listElaLessons(catalog, '7')
    expect(lessons[0].lessonId).toBe('ma-g7-english-language-arts-u01-l01')
    expect(lessons[0].courseDay).toBe(1)
    const middle = lessons[Math.floor(lessons.length / 2)]
    expect(middle.courseDay).toBe(Math.floor(lessons.length / 2) + 1)
    const last = lessons[lessons.length - 1]
    expect(last.lessonId).toBe('ma-g7-english-language-arts-u10-l18')
    expect(last.courseDay).toBe(180)
  })

  it('getElaLesson resolves a known ref and returns undefined for an unknown one', () => {
    const known = getElaLesson(catalog, 'ma-g8-english-language-arts-u01-l01')
    expect(known?.grade).toBe('8')
    expect(getElaLesson(catalog, 'not-a-real-lesson')).toBeUndefined()
  })

  it('getElaCourse returns undefined for a grade with no ELA course', () => {
    // AcademyGrade is only '5' | '7' | '8'; cast to exercise the not-found path.
    expect(getElaCourse(catalog, '6' as unknown as AcademyGrade)).toBeUndefined()
  })

  it('is deterministic and cached: repeated loads return the same frozen catalog', () => {
    const again = loadElaCatalog()
    expect(again).toBe(catalog)
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.courses[0])).toBe(true)
    expect(Object.isFrozen(catalog.courses[0].lessons)).toBe(true)
  })

  it('does not vendor a second copy of ELA curriculum content inside the subject lane', () => {
    const here = fileURLToPath(new URL('.', import.meta.url))
    const entries = readdirSync(here)
    const contentFiles = entries.filter((name) => name.endsWith('.json') || name.endsWith('.jsonl'))
    expect(contentFiles).toEqual([])
  })
})
