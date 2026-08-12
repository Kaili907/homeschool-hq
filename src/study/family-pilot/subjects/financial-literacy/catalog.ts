import type { FinancialLiteracyCatalog, FinLitLessonRef, FinLitStudentRef, FinLitUnitRef } from './types'

/**
 * FAMILY-PILOT-FINLIT-1 — pure catalog queries. Given an already-loaded
 * catalog (see source.node.ts), these never touch the filesystem, so the
 * Study runtime can call them from any environment once it has a catalog
 * instance.
 */

function courseForGrade(catalog: FinancialLiteracyCatalog, grade: FinLitStudentRef['grade']) {
  return catalog.courses.find((course) => course.grade === grade)
}

function courseForLesson(catalog: FinancialLiteracyCatalog, lessonRef: string) {
  return catalog.courses.find((course) => course.lessons.some((lesson) => lesson.lessonId === lessonRef))
}

/** The student's assigned course, in completion order. Empty if the
 * catalog has no course for the student's grade. */
export function getAssignments(
  catalog: FinancialLiteracyCatalog,
  student: FinLitStudentRef,
): readonly FinLitLessonRef[] {
  return courseForGrade(catalog, student.grade)?.lessons ?? []
}

export function getLesson(catalog: FinancialLiteracyCatalog, lessonRef: string): FinLitLessonRef | undefined {
  return courseForLesson(catalog, lessonRef)?.lessons.find((lesson) => lesson.lessonId === lessonRef)
}

/** The next lesson after `lessonRef` in its course's completion order.
 * undefined if lessonRef is unknown or is the course's last lesson. */
export function getNextLesson(catalog: FinancialLiteracyCatalog, lessonRef: string): FinLitLessonRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  if (!course) return undefined
  const index = course.lessons.findIndex((lesson) => lesson.lessonId === lessonRef)
  return index >= 0 ? course.lessons[index + 1] : undefined
}

export function getUnit(catalog: FinancialLiteracyCatalog, unitId: string): FinLitUnitRef | undefined {
  for (const course of catalog.courses) {
    const unit = course.units.find((candidate) => candidate.unitId === unitId)
    if (unit) return unit
  }
  return undefined
}

export function getUnitForLesson(catalog: FinancialLiteracyCatalog, lessonRef: string): FinLitUnitRef | undefined {
  const lesson = getLesson(catalog, lessonRef)
  return lesson ? getUnit(catalog, lesson.unitId) : undefined
}
