import type { AcademyGrade } from '../../../../../types'
import type { TechCsCatalog, TechCsCourseRef, TechCsLessonRef, TechCsUnitRef } from './types'

/**
 * FF-M7 — pure catalog queries, mirroring src/curriculum/family-pilot/catalog.ts.
 * Given an already-loaded catalog (see source.node.ts), these never touch the
 * filesystem.
 */

/** Grade routing: the one course for a grade, or undefined if the catalog has
 * no technology/CS course for that grade. */
export function getTechCsCourseForGrade(catalog: TechCsCatalog, grade: AcademyGrade): TechCsCourseRef | undefined {
  return catalog.courses.find((course) => course.grade === grade)
}

function courseForLesson(catalog: TechCsCatalog, lessonRef: string) {
  return catalog.courses.find((course) => course.lessons.some((lesson) => lesson.lessonId === lessonRef))
}

/** The grade's assigned course, in completion order. Empty if the catalog has
 * no course for that grade. */
export function getTechCsAssignments(catalog: TechCsCatalog, grade: AcademyGrade): readonly TechCsLessonRef[] {
  return getTechCsCourseForGrade(catalog, grade)?.lessons ?? []
}

export function getTechCsLesson(catalog: TechCsCatalog, lessonRef: string): TechCsLessonRef | undefined {
  return courseForLesson(catalog, lessonRef)?.lessons.find((lesson) => lesson.lessonId === lessonRef)
}

/** The next lesson after `lessonRef` in its course's completion order.
 * undefined if lessonRef is unknown or is the course's last lesson. */
export function getNextTechCsLesson(catalog: TechCsCatalog, lessonRef: string): TechCsLessonRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  if (!course) return undefined
  const index = course.lessons.findIndex((lesson) => lesson.lessonId === lessonRef)
  return index >= 0 ? course.lessons[index + 1] : undefined
}

export function getTechCsUnit(catalog: TechCsCatalog, unitId: string): TechCsUnitRef | undefined {
  for (const course of catalog.courses) {
    const unit = course.units.find((candidate) => candidate.unitId === unitId)
    if (unit) return unit
  }
  return undefined
}

/** True if a lesson's focus reads as code/logic work rather than general
 * digital-literacy content — grounded in the canonical content's own focus
 * labels (sequence, loops, conditionals, functions, decomposition, …), not
 * an invented taxonomy. */
const CODE_OR_LOGIC_KEYWORDS: readonly string[] = [
  'sequence', 'event', 'loop', 'iteration', 'conditional', 'selection', 'variable',
  'debug', 'decomposition', 'pseudocode', 'function', 'procedure', 'algorithm',
  'code', 'coding', 'program', 'version',
]

export function isCodeOrLogicFocus(lesson: TechCsLessonRef): boolean {
  const focus = lesson.focus.toLowerCase()
  return CODE_OR_LOGIC_KEYWORDS.some((keyword) => focus.includes(keyword))
}
