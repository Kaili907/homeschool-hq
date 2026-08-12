import { describe, expect, it } from 'vitest'
import {
  getNextTechCsLesson,
  getTechCsAssignments,
  getTechCsCourseForGrade,
  getTechCsLesson,
  getTechCsUnit,
  isCodeOrLogicFocus,
} from './catalog'
import { loadTechCsCatalog } from './source.node'
import type { TechCsCatalog, TechCsLessonRef } from './types'

function lessonRef(
  courseId: string,
  grade: '5' | '7' | '8',
  unitId: string,
  unitNumber: number,
  day: number,
  focus = 'digital citizenship',
): TechCsLessonRef {
  return {
    lessonId: `${courseId}-l${day}`,
    courseId,
    grade,
    unitId,
    unitNumber,
    dayInUnit: day,
    courseDay: day,
    title: `Lesson ${day}`,
    focus,
    dayPhase: 'guided-practice',
    standards: ['Michigan Computer Science: Computing Systems'],
    accessibilityAndAccommodations: ['Provide readable text plus optional audio support.'],
    safetyAndPrivacy: ['Never require a real password, private message, or account credential.'],
  }
}

/** A small two-course fixture, independent of the filesystem loader, so
 * catalog.ts edge cases (unknown ref, last-lesson boundary) are pinned
 * without depending on the real curriculum content's exact size. */
function fixtureCatalog(): TechCsCatalog {
  const g5Lessons = [1, 2, 3].map((day) => lessonRef('ma-g5-technology', '5', 'u01', 1, day))
  const g7Lessons = [1, 2].map((day) => lessonRef('ma-g7-technology', '7', 'u01', 1, day, 'loops'))
  return {
    releaseVersion: '0.0.0-fixture',
    courses: [
      {
        courseId: 'ma-g5-technology',
        grade: '5',
        subject: 'technology',
        title: 'Grade 5 Technology and Computer Science',
        units: [{
          unitId: 'u01',
          courseId: 'ma-g5-technology',
          unitNumber: 1,
          title: 'Unit 1',
          topics: ['topic-a'],
          performanceTask: 'Build a simple project.',
          assessmentId: null,
          lessonIds: g5Lessons.map((l) => l.lessonId),
        }],
        lessons: g5Lessons,
      },
      {
        courseId: 'ma-g7-technology',
        grade: '7',
        subject: 'technology',
        title: 'Grade 7 Technology and Computer Science',
        units: [{
          unitId: 'u01',
          courseId: 'ma-g7-technology',
          unitNumber: 1,
          title: 'Unit 1',
          topics: ['topic-a'],
          performanceTask: 'Build a simple project.',
          assessmentId: null,
          lessonIds: g7Lessons.map((l) => l.lessonId),
        }],
        lessons: g7Lessons,
      },
    ],
  }
}

describe('FF-M7 Technology / CS catalog queries (fixture)', () => {
  const catalog = fixtureCatalog()

  it('getTechCsAssignments returns the grade course in completion order (grade routing)', () => {
    const assignments = getTechCsAssignments(catalog, '5')
    expect(assignments.map((l) => l.lessonId)).toEqual(['ma-g5-technology-l1', 'ma-g5-technology-l2', 'ma-g5-technology-l3'])
  })

  it('getTechCsAssignments returns an empty list for a grade with no course', () => {
    const noMatch = getTechCsAssignments({ releaseVersion: 'x', courses: [] }, '5')
    expect(noMatch).toEqual([])
  })

  it('getTechCsCourseForGrade resolves the correct course per grade', () => {
    expect(getTechCsCourseForGrade(catalog, '5')?.courseId).toBe('ma-g5-technology')
    expect(getTechCsCourseForGrade(catalog, '7')?.courseId).toBe('ma-g7-technology')
    expect(getTechCsCourseForGrade(catalog, '8')).toBeUndefined()
  })

  it('getTechCsLesson resolves a known ref and returns undefined for an unknown one', () => {
    expect(getTechCsLesson(catalog, 'ma-g7-technology-l1')?.title).toBe('Lesson 1')
    expect(getTechCsLesson(catalog, 'does-not-exist')).toBeUndefined()
  })

  it('getTechCsUnit resolves a known unit and returns undefined for an unknown one', () => {
    expect(getTechCsUnit(catalog, 'u01')?.performanceTask).toBe('Build a simple project.')
    expect(getTechCsUnit({ releaseVersion: 'x', courses: [] }, 'does-not-exist')).toBeUndefined()
  })

  it('getNextTechCsLesson walks the completion order and stops after the last lesson', () => {
    expect(getNextTechCsLesson(catalog, 'ma-g5-technology-l1')?.lessonId).toBe('ma-g5-technology-l2')
    expect(getNextTechCsLesson(catalog, 'ma-g5-technology-l2')?.lessonId).toBe('ma-g5-technology-l3')
    expect(getNextTechCsLesson(catalog, 'ma-g5-technology-l3')).toBeUndefined()
  })

  it('getNextTechCsLesson never crosses from one course into another', () => {
    expect(getNextTechCsLesson(catalog, 'ma-g7-technology-l2')).toBeUndefined()
  })

  it('getNextTechCsLesson returns undefined for an unknown lessonRef', () => {
    expect(getNextTechCsLesson(catalog, 'does-not-exist')).toBeUndefined()
  })

  it('isCodeOrLogicFocus flags code/logic lessons and not general digital-literacy lessons', () => {
    expect(isCodeOrLogicFocus(getTechCsLesson(catalog, 'ma-g7-technology-l1')!)).toBe(true)
    expect(isCodeOrLogicFocus(getTechCsLesson(catalog, 'ma-g5-technology-l1')!)).toBe(false)
  })
})

describe('FF-M7 Technology / CS catalog queries (real curriculum content)', () => {
  const catalog = loadTechCsCatalog()

  it('getTechCsAssignments covers every lesson in each grade, once, in course order', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const course = getTechCsCourseForGrade(catalog, grade)!
      const assignments = getTechCsAssignments(catalog, grade)
      expect(assignments).toEqual(course.lessons)
    }
  })

  it('getNextTechCsLesson is deterministic and reconstructs each course end to end', () => {
    for (const course of catalog.courses) {
      let current: string | undefined = course.lessons[0].lessonId
      const walked: string[] = []
      while (current) {
        walked.push(current)
        current = getNextTechCsLesson(catalog, current)?.lessonId
      }
      expect(walked).toEqual(course.lessons.map((lesson) => lesson.lessonId))

      const again = getNextTechCsLesson(catalog, course.lessons[0].lessonId)
      expect(again).toEqual(getNextTechCsLesson(catalog, course.lessons[0].lessonId))
    }
  })

  it('getTechCsLesson resolves every ref returned by getTechCsAssignments', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getTechCsAssignments(catalog, grade)) {
        expect(getTechCsLesson(catalog, lesson.lessonId)).toEqual(lesson)
      }
    }
  })

  it('getTechCsUnit resolves every unit referenced by a course', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        expect(getTechCsUnit(catalog, unit.unitId)).toEqual(unit)
      }
    }
  })
})
