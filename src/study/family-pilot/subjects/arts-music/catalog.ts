import type {
  ArtsMusicAssessmentRef,
  ArtsMusicCatalog,
  ArtsMusicLessonRef,
  ArtsMusicStudentRef,
  ArtsMusicUnitRef,
} from './types'

/**
 * ARTS-MUSIC-1 — pure catalog queries. Given an already-loaded catalog (see
 * source.node.ts), these never touch the filesystem, mirroring
 * src/curriculum/family-pilot/catalog.ts's math-catalog query shape so the
 * two subjects are queried the same way.
 */

function courseForGrade(catalog: ArtsMusicCatalog, grade: ArtsMusicStudentRef['grade']) {
  return catalog.courses.find((course) => course.grade === grade)
}

function courseForLesson(catalog: ArtsMusicCatalog, lessonRef: string) {
  return catalog.courses.find((course) => course.lessons.some((lesson) => lesson.lessonId === lessonRef))
}

/** The student's assigned course, in completion order. Empty if the
 * catalog has no course for the student's grade — this is grade routing:
 * only grades with a published course resolve to lessons. */
export function getArtsMusicAssignments(
  catalog: ArtsMusicCatalog,
  student: ArtsMusicStudentRef,
): readonly ArtsMusicLessonRef[] {
  return courseForGrade(catalog, student.grade)?.lessons ?? []
}

export function getArtsMusicLesson(catalog: ArtsMusicCatalog, lessonRef: string): ArtsMusicLessonRef | undefined {
  return courseForLesson(catalog, lessonRef)?.lessons.find((lesson) => lesson.lessonId === lessonRef)
}

/** The next lesson after `lessonRef` in its course's completion order.
 * undefined if lessonRef is unknown or is the course's last lesson. */
export function getNextArtsMusicLesson(catalog: ArtsMusicCatalog, lessonRef: string): ArtsMusicLessonRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  if (!course) return undefined
  const index = course.lessons.findIndex((lesson) => lesson.lessonId === lessonRef)
  return index >= 0 ? course.lessons[index + 1] : undefined
}

export function getArtsMusicUnit(catalog: ArtsMusicCatalog, lessonRef: string): ArtsMusicUnitRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  const lesson = course?.lessons.find((entry) => entry.lessonId === lessonRef)
  if (!course || !lesson) return undefined
  return course.units.find((unit) => unit.unitId === lesson.unitId)
}

export function getArtsMusicAssessmentForUnit(
  catalog: ArtsMusicCatalog,
  unitId: string,
): ArtsMusicAssessmentRef | undefined {
  for (const course of catalog.courses) {
    const unit = course.units.find((entry) => entry.unitId === unitId)
    if (!unit) continue
    if (!unit.assessmentId) return undefined
    return course.assessments.find((assessment) => assessment.assessmentId === unit.assessmentId)
  }
  return undefined
}
