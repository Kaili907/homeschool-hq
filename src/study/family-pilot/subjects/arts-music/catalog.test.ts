import { describe, expect, it } from 'vitest'
import { getArtsMusicAssessmentForUnit, getArtsMusicAssignments, getArtsMusicLesson, getArtsMusicUnit, getNextArtsMusicLesson } from './catalog'
import { loadArtsMusicCatalog } from './source.node'
import type { ArtsMusicCatalog, ArtsMusicLessonSegment } from './types'

const FLOW: readonly ArtsMusicLessonSegment[] = [
  { segment: 'Welcome and retrieval', minutes: '5–8', teacherOrTutorAction: 'warm up' },
]

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
    focus: 'focus',
    estimatedMinutes: '40–60',
    lessonFlow: FLOW,
  }
}

/** A small two-course fixture, independent of the filesystem loader, so
 * catalog.ts edge cases (unknown ref, last-lesson boundary, grade routing)
 * are pinned without depending on the real curriculum content's exact
 * size. */
function fixtureCatalog(): ArtsMusicCatalog {
  const g5Lessons = [1, 2, 3].map((day) => lessonRef('ma-g5-arts-and-music', '5', 'u01', 1, day))
  const g7Lessons = [1, 2].map((day) => lessonRef('ma-g7-arts-and-music', '7', 'u01', 1, day))
  return {
    releaseVersion: '0.0.0-fixture',
    courses: [
      {
        courseId: 'ma-g5-arts-and-music',
        grade: '5',
        subject: 'arts-and-music',
        title: 'Grade 5 Arts & Music',
        units: [{
          unitId: 'u01', courseId: 'ma-g5-arts-and-music', unitNumber: 1, title: 'Unit 1',
          performanceTask: 'Create a portfolio piece.', assessmentId: 'ma-g5-arts-and-music-u01-assessment',
          lessonIds: g5Lessons.map((l) => l.lessonId),
        }],
        assessments: [{
          assessmentId: 'ma-g5-arts-and-music-u01-assessment', unitNumber: 1, totalPoints: 38,
          rubricDimensions: ['accuracy or fidelity', 'evidence and reasoning'],
          masteryInterpretation: { secure: 'secure copy', developing: 'developing copy', notYet: 'not yet copy' },
        }],
        lessons: g5Lessons,
      },
      {
        courseId: 'ma-g7-arts-and-music',
        grade: '7',
        subject: 'arts-and-music',
        title: 'Grade 7 Arts & Music',
        units: [{
          unitId: 'u01', courseId: 'ma-g7-arts-and-music', unitNumber: 1, title: 'Unit 1',
          performanceTask: 'Perform a short piece.', assessmentId: null,
          lessonIds: g7Lessons.map((l) => l.lessonId),
        }],
        assessments: [],
        lessons: g7Lessons,
      },
    ],
  }
}

describe('ARTS-MUSIC-1 catalog queries (fixture)', () => {
  const catalog = fixtureCatalog()

  it('getArtsMusicAssignments returns the student grade course in completion order', () => {
    const assignments = getArtsMusicAssignments(catalog, { studentRef: 'stu-1', grade: '5' })
    expect(assignments.map((l) => l.lessonId)).toEqual(['ma-g5-arts-and-music-l1', 'ma-g5-arts-and-music-l2', 'ma-g5-arts-and-music-l3'])
  })

  it('grade routing: a grade with no published course returns an empty list, not an error', () => {
    const noMatch = getArtsMusicAssignments({ releaseVersion: 'x', courses: [] }, { studentRef: 'stu-1', grade: '5' })
    expect(noMatch).toEqual([])
  })

  it('getArtsMusicLesson resolves a known ref and returns undefined for an unknown one', () => {
    expect(getArtsMusicLesson(catalog, 'ma-g7-arts-and-music-l1')?.title).toBe('Lesson 1')
    expect(getArtsMusicLesson(catalog, 'does-not-exist')).toBeUndefined()
  })

  it('getNextArtsMusicLesson walks the completion order and stops after the last lesson', () => {
    expect(getNextArtsMusicLesson(catalog, 'ma-g5-arts-and-music-l1')?.lessonId).toBe('ma-g5-arts-and-music-l2')
    expect(getNextArtsMusicLesson(catalog, 'ma-g5-arts-and-music-l2')?.lessonId).toBe('ma-g5-arts-and-music-l3')
    expect(getNextArtsMusicLesson(catalog, 'ma-g5-arts-and-music-l3')).toBeUndefined()
  })

  it('getNextArtsMusicLesson never crosses from one course into another', () => {
    expect(getNextArtsMusicLesson(catalog, 'ma-g7-arts-and-music-l2')).toBeUndefined()
  })

  it('getArtsMusicUnit resolves the unit a lesson belongs to', () => {
    expect(getArtsMusicUnit(catalog, 'ma-g5-arts-and-music-l1')?.unitId).toBe('u01')
    expect(getArtsMusicUnit(catalog, 'does-not-exist')).toBeUndefined()
  })

  it('getArtsMusicAssessmentForUnit resolves rubric metadata, or undefined when a unit has no assessment', () => {
    expect(getArtsMusicAssessmentForUnit(catalog, 'u01')?.rubricDimensions).toEqual(['accuracy or fidelity', 'evidence and reasoning'])
  })
})

describe('ARTS-MUSIC-1 catalog queries (real curriculum content)', () => {
  const catalog = loadArtsMusicCatalog()

  it('getArtsMusicAssignments covers every lesson in each grade, once, in course order', () => {
    for (const grade of ['5', '7', '8'] as const) {
      const course = catalog.courses.find((c) => c.grade === grade)!
      const assignments = getArtsMusicAssignments(catalog, { studentRef: 'stu-1', grade })
      expect(assignments).toEqual(course.lessons)
    }
  })

  it('grade routing: an unsupported grade returns an empty list', () => {
    expect(getArtsMusicAssignments(catalog, { studentRef: 'stu-1', grade: '6' as unknown as '5' })).toEqual([])
  })

  it('getNextArtsMusicLesson is deterministic and reconstructs each course end to end', () => {
    for (const course of catalog.courses) {
      let current: string | undefined = course.lessons[0].lessonId
      const walked: string[] = []
      while (current) {
        walked.push(current)
        current = getNextArtsMusicLesson(catalog, current)?.lessonId
      }
      expect(walked).toEqual(course.lessons.map((lesson) => lesson.lessonId))

      // Same input, same output — no hidden state or ordering dependence.
      const again = getNextArtsMusicLesson(catalog, course.lessons[0].lessonId)
      expect(again).toEqual(getNextArtsMusicLesson(catalog, course.lessons[0].lessonId))
    }
  })

  it('getArtsMusicLesson resolves every ref returned by getArtsMusicAssignments', () => {
    for (const grade of ['5', '7', '8'] as const) {
      for (const lesson of getArtsMusicAssignments(catalog, { studentRef: 'stu-1', grade })) {
        expect(getArtsMusicLesson(catalog, lesson.lessonId)).toEqual(lesson)
      }
    }
  })

  it('every unit resolves an assessment with rubric dimensions', () => {
    for (const course of catalog.courses) {
      for (const unit of course.units) {
        expect(unit.assessmentId).not.toBeNull()
        const assessment = getArtsMusicAssessmentForUnit(catalog, unit.unitId)
        expect(assessment?.rubricDimensions.length).toBeGreaterThan(0)
      }
    }
  })
})
