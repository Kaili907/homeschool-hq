import type { AcademyGrade } from '../../../../types'
import type { PhysicalEducationCatalog, PhysicalEducationLesson, PhysicalEducationUnit } from './types'

/**
 * FF-M5 — pure catalog queries. Given an already-loaded catalog (see
 * curriculumSource.node.ts), these never touch the filesystem, mirroring
 * src/curriculum/family-pilot/catalog.ts.
 */

function courseForGrade(catalog: PhysicalEducationCatalog, grade: AcademyGrade) {
  return catalog.courses.find((course) => course.grade === grade)
}

function courseForLesson(catalog: PhysicalEducationCatalog, lessonId: string) {
  return catalog.courses.find((course) => course.lessons.some((lesson) => lesson.lessonId === lessonId))
}

/** Every lesson for a grade, in course completion order. Empty if the
 * catalog has no course for that grade. */
export function listLessonsForGrade(
  catalog: PhysicalEducationCatalog,
  grade: AcademyGrade,
): readonly PhysicalEducationLesson[] {
  return courseForGrade(catalog, grade)?.lessons ?? []
}

export function listUnitsForGrade(
  catalog: PhysicalEducationCatalog,
  grade: AcademyGrade,
): readonly PhysicalEducationUnit[] {
  return courseForGrade(catalog, grade)?.units ?? []
}

export function getLesson(catalog: PhysicalEducationCatalog, lessonId: string): PhysicalEducationLesson | undefined {
  return courseForLesson(catalog, lessonId)?.lessons.find((lesson) => lesson.lessonId === lessonId)
}

export function getUnit(catalog: PhysicalEducationCatalog, unitId: string): PhysicalEducationUnit | undefined {
  for (const course of catalog.courses) {
    const unit = course.units.find((candidate) => candidate.unitId === unitId)
    if (unit) return unit
  }
  return undefined
}

export function listLessonsForUnit(
  catalog: PhysicalEducationCatalog,
  unitId: string,
): readonly PhysicalEducationLesson[] {
  const unit = getUnit(catalog, unitId)
  if (!unit) return []
  const course = catalog.courses.find((candidate) => candidate.units.some((u) => u.unitId === unitId))
  if (!course) return []
  const byId = new Map(course.lessons.map((lesson) => [lesson.lessonId, lesson]))
  return unit.lessonIds.map((lessonId) => byId.get(lessonId)).filter((lesson): lesson is PhysicalEducationLesson => !!lesson)
}

/** The next lesson after `lessonId` in its course's completion order.
 * undefined if lessonId is unknown or is the course's last lesson. */
export function getNextLesson(
  catalog: PhysicalEducationCatalog,
  lessonId: string,
): PhysicalEducationLesson | undefined {
  const course = courseForLesson(catalog, lessonId)
  if (!course) return undefined
  const index = course.lessons.findIndex((lesson) => lesson.lessonId === lessonId)
  return index >= 0 ? course.lessons[index + 1] : undefined
}

export function totalLessonCount(catalog: PhysicalEducationCatalog): number {
  return catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
}

export function totalUnitCount(catalog: PhysicalEducationCatalog): number {
  return catalog.courses.reduce((sum, course) => sum + course.units.length, 0)
}
