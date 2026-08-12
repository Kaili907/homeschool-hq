import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadTechCsCatalog } from './source.node'
import { TECH_CS_SUBJECT } from './types'

const CONTENT_ROOT = fileURLToPath(new URL('../../../../../../curriculum-content/manuel-academy/', import.meta.url))

const GRADES = ['5', '7', '8'] as const

describe('FF-M7 Technology / CS catalog loader (real curriculum content)', () => {
  const catalog = loadTechCsCatalog()

  it('has exactly one course per published grade', () => {
    expect(catalog.courses).toHaveLength(3)
    expect(catalog.courses.map((course) => course.grade).sort()).toEqual([...GRADES].sort())
  })

  it('has exact counts: 36 lessons and 6 units per grade, 108 lessons and 18 units total', () => {
    for (const grade of GRADES) {
      const course = catalog.courses.find((c) => c.grade === grade)!
      expect(course.lessons).toHaveLength(36)
      expect(course.units).toHaveLength(6)
    }
    const totalLessons = catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
    const totalUnits = catalog.courses.reduce((sum, course) => sum + course.units.length, 0)
    expect(totalLessons).toBe(108)
    expect(totalUnits).toBe(18)
  })

  it('grade routing: every lesson and unit in a grade course actually belongs to that grade', () => {
    for (const grade of GRADES) {
      const course = catalog.courses.find((c) => c.grade === grade)!
      expect(course.lessons.every((lesson) => lesson.grade === grade)).toBe(true)
      expect(course.subject).toBe(TECH_CS_SUBJECT)
    }
  })

  it('grade routing: no lesson id from one grade appears in another grade course', () => {
    const idsByGrade = new Map(GRADES.map((grade) => [grade, new Set(catalog.courses.find((c) => c.grade === grade)!.lessons.map((l) => l.lessonId))]))
    for (const a of GRADES) {
      for (const b of GRADES) {
        if (a === b) continue
        for (const id of idsByGrade.get(a)!) {
          expect(idsByGrade.get(b)!.has(id)).toBe(false)
        }
      }
    }
  })

  it('stable refs: every lessonId, unitId, and courseId is unique across the whole catalog', () => {
    const lessonIds = catalog.courses.flatMap((c) => c.lessons.map((l) => l.lessonId))
    const unitIds = catalog.courses.flatMap((c) => c.units.map((u) => u.unitId))
    const courseIds = catalog.courses.map((c) => c.courseId)
    expect(new Set(lessonIds).size).toBe(lessonIds.length)
    expect(new Set(unitIds).size).toBe(unitIds.length)
    expect(new Set(courseIds).size).toBe(courseIds.length)
  })

  it('stable refs: refs are stable opaque strings (safe for the Study adapter\'s ref format)', () => {
    const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
    for (const course of catalog.courses) {
      expect(SAFE_REF.test(course.courseId)).toBe(true)
      for (const unit of course.units) expect(SAFE_REF.test(unit.unitId)).toBe(true)
      for (const lesson of course.lessons) expect(SAFE_REF.test(lesson.lessonId)).toBe(true)
    }
  })

  it('stable refs: repeated loads return the exact same cached catalog', () => {
    expect(loadTechCsCatalog()).toBe(catalog)
  })

  it('course_day is a gapless 1..36 sequence per grade, matching completion order', () => {
    for (const course of catalog.courses) {
      expect(course.lessons.map((l) => l.courseDay)).toEqual(Array.from({ length: 36 }, (_unused, i) => i + 1))
    }
  })

  it('units cover every lesson in their course exactly once, in unit_number order', () => {
    for (const course of catalog.courses) {
      expect(course.units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4, 5, 6])
      const coveredLessonIds = course.units.flatMap((u) => u.lessonIds)
      expect(new Set(coveredLessonIds).size).toBe(coveredLessonIds.length)
      expect(new Set(coveredLessonIds)).toEqual(new Set(course.lessons.map((l) => l.lessonId)))
    }
  })

  it('code/project metadata: day_in_unit deterministically maps to the same dayPhase across every grade and unit', () => {
    const expected: Record<number, string> = {
      1: 'launch-diagnostic',
      2: 'explicit-model',
      3: 'guided-practice',
      4: 'application-project',
      5: 'mastery-check',
      6: 'correction-reflection',
    }
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.dayPhase).toBe(expected[lesson.dayInUnit])
      }
    }
  })

  it('code/project metadata: each grade has at least one programming-focused unit with code/logic lessons', () => {
    for (const grade of GRADES) {
      const course = catalog.courses.find((c) => c.grade === grade)!
      const codeLessons = course.lessons.filter((lesson) => /loop|conditional|variable|function|sequence|decomposition|pseudocode/i.test(lesson.focus))
      expect(codeLessons.length).toBeGreaterThan(0)
    }
  })

  it('accessibility path: every lesson carries non-empty accessibility and safety/privacy metadata', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.accessibilityAndAccommodations.length).toBeGreaterThan(0)
        expect(lesson.safetyAndPrivacy.length).toBeGreaterThan(0)
      }
    }
  })

  it('no credentials/secrets: no lesson or unit carries credential-like content', () => {
    const CREDENTIAL_PATTERN = /\b(password|api[_-]?key|secret|token)\s*[:=]\s*\S+/i
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        const haystack = [lesson.title, lesson.focus, ...lesson.standards, ...lesson.accessibilityAndAccommodations, ...lesson.safetyAndPrivacy].join('\n')
        expect(CREDENTIAL_PATTERN.test(haystack)).toBe(false)
      }
      for (const unit of course.units) {
        const haystack = [unit.title, unit.performanceTask, ...unit.topics].join('\n')
        expect(CREDENTIAL_PATTERN.test(haystack)).toBe(false)
      }
    }
  })

  it('no credentials/secrets: assessments.json (prompts, rubrics, mastery interpretation) is scanned too', () => {
    const CREDENTIAL_PATTERN = /\b(password|api[_-]?key|secret|token)\s*[:=]\s*\S+/i
    for (const grade of GRADES) {
      const path = join(CONTENT_ROOT, catalog.releaseVersion, 'grades', `grade-${grade}`, 'courses', TECH_CS_SUBJECT, 'assessments.json')
      const raw = readFileSync(path, 'utf8')
      expect(CREDENTIAL_PATTERN.test(raw)).toBe(false)
    }
  })

  it('no credentials/secrets: every lesson explicitly forbids real credentials in its own safety note', () => {
    for (const course of catalog.courses) {
      for (const lesson of course.lessons) {
        expect(lesson.safetyAndPrivacy.some((note) => /credential|password/i.test(note))).toBe(true)
      }
    }
  })
})
