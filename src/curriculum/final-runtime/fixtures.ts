import type { Lesson } from '../../curriculum-authoring/v2/contracts.ts'
import type { AdmittedRelease } from '../release-admission/types.ts'
import type {
  FinalCourseLessonLoader,
  FinalCourseLessonRow,
  LessonSourceReadiness,
} from './types.ts'

export type FixtureSourceReadiness = (
  lesson: Lesson,
) => LessonSourceReadiness

const READY: LessonSourceReadiness = Object.freeze({
  state: 'ready',
  dynamicSource: false,
  sourceRefs: Object.freeze([]),
})

function estimatedMinutes(lesson: Lesson): string {
  const { minimum_minutes: minimum, maximum_minutes: maximum } = lesson.estimated_duration
  return minimum === maximum ? String(minimum) : `${minimum}–${maximum}`
}

/**
 * Test/convergence fixture only. It mimics generated per-course import modules:
 * no lesson row is projected until that course's loader is invoked.
 */
export function buildFixtureCourseLoaders(
  release: AdmittedRelease,
  readiness: FixtureSourceReadiness = () => READY,
  onLoad?: (courseRef: string) => void,
): Readonly<Record<string, FinalCourseLessonLoader>> {
  const loaders: Record<string, FinalCourseLessonLoader> = {}
  for (const course of release.candidate.authoring_set.courses) {
    loaders[course.course_id] = async () => {
      onLoad?.(course.course_id)
      const rows: FinalCourseLessonRow[] = release.candidate.authoring_set.lessons
        .filter((lesson) => lesson.course_ref === course.course_id)
        .sort((left, right) => left.course_day - right.course_day)
        .map((lesson) => Object.freeze({
          lessonRef: lesson.lesson_id,
          unitRef: lesson.unit_ref,
          dayInUnit: lesson.day_in_unit,
          courseDay: lesson.course_day,
          title: lesson.title,
          estimatedMinutes: estimatedMinutes(lesson),
          resourceRefs: Object.freeze([...lesson.resource_refs]),
          sourceReadiness: readiness(lesson),
        }))
      return { default: Object.freeze(rows) }
    }
  }
  return Object.freeze(loaders)
}
