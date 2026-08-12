import { evaluateLessonProductionReadiness } from './evaluateLessonProductionReadiness'
import { summarizeProductionGaps } from './summarizeProductionGaps'
import type {
  CourseProductionInput,
  CourseReadinessResult,
  LessonReadinessStatus,
} from './types'

export function evaluateCourseProductionReadiness(
  course: CourseProductionInput,
): CourseReadinessResult {
  const notes: string[] = []

  if (course.lessons.length === 0) {
    notes.push('course has no lessons to evaluate')
    return {
      courseId: course.courseId,
      status: 'NOT_READY',
      lessonResults: [],
      gapSummary: summarizeProductionGaps([]),
      notes,
    }
  }

  const lessonResults = course.lessons.map(evaluateLessonProductionReadiness)

  let status: LessonReadinessStatus
  if (lessonResults.some((result) => result.status === 'NOT_READY')) {
    status = 'NOT_READY'
  } else if (lessonResults.some((result) => result.status === 'NEEDS_HUMAN_REVIEW')) {
    status = 'NEEDS_HUMAN_REVIEW'
  } else {
    status = 'READY'
  }

  return {
    courseId: course.courseId,
    status,
    lessonResults,
    gapSummary: summarizeProductionGaps(lessonResults),
    notes,
  }
}
