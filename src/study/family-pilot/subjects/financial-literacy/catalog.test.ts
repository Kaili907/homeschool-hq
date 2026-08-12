import { describe, expect, it } from 'vitest'
import { getAssignments, getLesson, getNextLesson, getUnit, getUnitForLesson } from './catalog'
import { loadFinancialLiteracyCatalog } from './source.node'
import type { FinancialLiteracyCatalog } from './types'

function lessonRef(courseId: string, grade: '5' | '7' | '8', unitId: string, unitNumber: number, day: number) {
  return {
    lessonId: `${courseId}-l${day}`,
    courseId,
    grade,
    unitId,
    unitNumber,
    dayInUnit: day,
    courseDay: day,
    title: `Lesson ${day}`,
    standards: ['PF1'],
    parentVisibility: null,
  }
}

/** A small two-course fixture, independent of the filesystem loader, so
 * catalog.ts edge cases (unknown ref, last-lesson boundary) are pinned
 * without depending on the real curriculum content's exact size. */
function fixtureCatalog(): FinancialLiteracyCatalog {
  const g5Lessons = [1, 2, 3].map((day) => lessonRef('ma-g5-financial-literacy', '5', 'u01', 1, day))
  const g7Lessons = [1, 2].map((day) => lessonRef('ma-g7-financial-literacy', '7', 'u01', 1, day))
  return {
    releaseVersion: '0.0.0-fixture',
    courses: [
      {
        courseId: 'ma-g5-financial-literacy',
        grade: '5',
        subject: 'financial-literacy',
        title: 'Grade 5 Financial Literacy',
        units: [{ unitId: 'u01', courseId: 'ma-g5-financial-literacy', unitNumber: 1, title: 'Unit 1', standards: ['PF1'], assessmentId: null, lessonIds: g5Lessons.map((l) => l.lessonId) }],
        lessons: g5Lessons,
      },
      {
        courseId: 'ma-g7-financial-literacy',
        grade: '7',
        subject: 'financial-literacy',
        title: 'Grade 7 Financial Literacy',
        units: [{ unitId: 'u01', courseId: 'ma-g7-financial-literacy', unitNumber: 1, title: 'Unit 1', standards: ['PF1'], assessmentId: null, lessonIds: g7Lessons.map((l) => l.lessonId) }],
        lessons: g7Lessons,
      },
    ],
  }
}

describe('FAMILY-PILOT-FINLIT-1 catalog queries (fixture)', () => {
  const catalog = fixtureCatalog()

  it('getAssignments returns the student grade course in completion order (grade routing)', () => {
    const assignments = getAssignments(catalog, { studentRef: 'stu-1', grade: '5' })
    expect(assignments.map((l) => l.lessonId)).toEqual(['ma-g5-financial-literacy-l1', 'ma-g5-financial-literacy-l2', 'ma-g5-financial-literacy-l3'])
  })

  it('getAssignments never returns another grade’s lessons', () => {
    const grade5 = getAssignments(catalog, { studentRef: 'stu-1', grade: '5' })
    const grade7 = getAssignments(catalog, { studentRef: 'stu-1', grade: '7' })
    expect(grade5.every((l) => l.grade === '5')).toBe(true)
    expect(grade7.every((l) => l.grade === '7')).toBe(true)
  })

  it('getAssignments returns an empty list for a grade with no course', () => {
    const noMatch = getAssignments({ releaseVersion: 'x', courses: [] }, { studentRef: 'stu-1', grade: '5' })
    expect(noMatch).toEqual([])
  })

  it('getLesson resolves a known ref and returns undefined for an unknown one', () => {
    expect(getLesson(catalog, 'ma-g7-financial-literacy-l1')?.title).toBe('Lesson 1')
    expect(getLesson(catalog, 'does-not-exist')).toBeUndefined()
  })

  it('getNextLesson walks the completion order and stops after the last lesson', () => {
    expect(getNextLesson(catalog, 'ma-g5-financial-literacy-l1')?.lessonId).toBe('ma-g5-financial-literacy-l2')
    expect(getNextLesson(catalog, 'ma-g5-financial-literacy-l2')?.lessonId).toBe('ma-g5-financial-literacy-l3')
    expect(getNextLesson(catalog, 'ma-g5-financial-literacy-l3')).toBeUndefined()
  })

  it('getNextLesson never crosses from one course into another', () => {
    expect(getNextLesson(catalog, 'ma-g7-financial-literacy-l2')).toBeUndefined()
  })

  it('getNextLesson returns undefined for an unknown lessonRef', () => {
    expect(getNextLesson(catalog, 'does-not-exist')).toBeUndefined()
  })

  it('getUnit and getUnitForLesson resolve known refs and undefined for unknown ones', () => {
    expect(getUnit(catalog, 'u01')?.title).toBe('Unit 1')
    expect(getUnit(catalog, 'does-not-exist')).toBeUndefined()
    expect(getUnitForLesson(catalog, 'ma-g5-financial-literacy-l1')?.unitId).toBe('u01')
    expect(getUnitForLesson(catalog, 'does-not-exist')).toBeUndefined()
  })
})

describe('FAMILY-PILOT-FINLIT-1 catalog queries (real curriculum content)', () => {
  const catalog = loadFinancialLiteracyCatalog()

  it('getAssignments covers every lesson in each grade, once, in course order', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const course = catalog.courses.find((c) => c.grade === grade)!
      const assignments = getAssignments(catalog, { studentRef: 'stu-1', grade })
      expect(assignments).toEqual(course.lessons)
    }
  })

  it('getNextLesson is deterministic and reconstructs each course end to end', () => {
    for (const course of catalog.courses) {
      let current: string | undefined = course.lessons[0].lessonId
      const walked: string[] = []
      while (current) {
        walked.push(current)
        current = getNextLesson(catalog, current)?.lessonId
      }
      expect(walked).toEqual(course.lessons.map((lesson) => lesson.lessonId))

      const again = getNextLesson(catalog, course.lessons[0].lessonId)
      expect(again).toEqual(getNextLesson(catalog, course.lessons[0].lessonId))
    }
  })

  it('getLesson resolves every ref returned by getAssignments', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getAssignments(catalog, { studentRef: 'stu-1', grade })) {
        expect(getLesson(catalog, lesson.lessonId)).toEqual(lesson)
      }
    }
  })
})
