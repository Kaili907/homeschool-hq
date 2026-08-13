import { describe, expect, it } from 'vitest'
import { evaluateCourseProductionReadiness } from './evaluateCourseProductionReadiness'
import {
  readyArtsLesson,
  readyElaLesson,
  readyMathLesson,
  readyScienceLesson,
} from './productionReadinessFixtures.testSupport'

describe('evaluateCourseProductionReadiness', () => {
  it('is READY when every lesson across mixed subject families is READY', () => {
    const result = evaluateCourseProductionReadiness({
      courseId: 'multi-subject-sample',
      title: 'Multi-Subject Sample Course',
      lessons: [
        readyMathLesson({ lessonId: 'l1' }),
        readyElaLesson({ lessonId: 'l2' }),
        readyScienceLesson({ lessonId: 'l3' }),
        readyArtsLesson({ lessonId: 'l4' }),
      ],
    })

    expect(result.status).toBe('READY')
    expect(result.lessonResults).toHaveLength(4)
    expect(result.gapSummary.readyCount).toBe(4)
  })

  it('is NOT_READY when any lesson is NOT_READY', () => {
    const result = evaluateCourseProductionReadiness({
      courseId: 'course-with-a-gap',
      title: 'Course With a Gap',
      lessons: [
        readyMathLesson({ lessonId: 'l1' }),
        readyMathLesson({ lessonId: 'l2', independentWork: { present: false } }),
      ],
    })

    expect(result.status).toBe('NOT_READY')
  })

  it('is NEEDS_HUMAN_REVIEW when no lesson is NOT_READY but at least one needs review', () => {
    const result = evaluateCourseProductionReadiness({
      courseId: 'course-needing-review',
      title: 'Course Needing Review',
      lessons: [
        readyMathLesson({ lessonId: 'l1' }),
        readyMathLesson({ lessonId: 'l2', assessmentAlignment: 'UNKNOWN' }),
      ],
    })

    expect(result.status).toBe('NEEDS_HUMAN_REVIEW')
  })

  it('is NOT_READY with a note when the course has no lessons', () => {
    const result = evaluateCourseProductionReadiness({
      courseId: 'empty-course',
      title: 'Empty Course',
      lessons: [],
    })

    expect(result.status).toBe('NOT_READY')
    expect(result.lessonResults).toHaveLength(0)
    expect(result.notes).toContain('course has no lessons to evaluate')
  })
})
