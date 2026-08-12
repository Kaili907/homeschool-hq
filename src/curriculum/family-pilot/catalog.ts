import type { FamilyPilotCatalog, PilotLessonRef, PilotStudentRef } from './types'

/**
 * FAMILY-PILOT-CURR-1 — pure catalog queries. Given an already-loaded
 * catalog (see source.node.ts), these never touch the filesystem, so the
 * Study runtime can call them from any environment once it has a catalog
 * instance.
 */

function courseForGrade(catalog: FamilyPilotCatalog, grade: PilotStudentRef['grade']) {
  return catalog.courses.find((course) => course.grade === grade)
}

function courseForLesson(catalog: FamilyPilotCatalog, lessonRef: string) {
  return catalog.courses.find((course) => course.lessons.some((lesson) => lesson.lessonId === lessonRef))
}

/** The student's assigned course, in completion order. Empty if the
 * catalog has no course for the student's grade. */
export function getPilotAssignments(
  catalog: FamilyPilotCatalog,
  student: PilotStudentRef,
): readonly PilotLessonRef[] {
  return courseForGrade(catalog, student.grade)?.lessons ?? []
}

export function getLesson(catalog: FamilyPilotCatalog, lessonRef: string): PilotLessonRef | undefined {
  return courseForLesson(catalog, lessonRef)?.lessons.find((lesson) => lesson.lessonId === lessonRef)
}

/** The next lesson after `lessonRef` in its course's completion order.
 * undefined if lessonRef is unknown or is the course's last lesson. */
export function getNextLesson(catalog: FamilyPilotCatalog, lessonRef: string): PilotLessonRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  if (!course) return undefined
  const index = course.lessons.findIndex((lesson) => lesson.lessonId === lessonRef)
  return index >= 0 ? course.lessons[index + 1] : undefined
}
