import type { HealthCatalog, HealthCourse, HealthGrade, HealthLesson, HealthUnit } from './types'

/**
 * Pure course/unit/lesson lookup over an already-loaded HealthCatalog. Kept
 * separate from rawContent.node.ts so every function here can run in a
 * browser build or a test without touching node:fs — callers load the
 * catalog once (loadHealthCatalog() on the server, or a fixture in tests)
 * and pass it in.
 */

export function getHealthCourse(catalog: HealthCatalog, grade: HealthGrade): HealthCourse | null {
  return catalog.courses.find((course) => course.grade === grade) ?? null
}

export function listHealthUnits(catalog: HealthCatalog, grade: HealthGrade): readonly HealthUnit[] {
  return getHealthCourse(catalog, grade)?.units ?? []
}

export function getHealthUnit(catalog: HealthCatalog, grade: HealthGrade, unitNumber: number): HealthUnit | null {
  return listHealthUnits(catalog, grade).find((unit) => unit.unitNumber === unitNumber) ?? null
}

export function getHealthUnitById(catalog: HealthCatalog, unitId: string): HealthUnit | null {
  for (const course of catalog.courses) {
    const unit = course.units.find((candidate) => candidate.unitId === unitId)
    if (unit) return unit
  }
  return null
}

/** Every lesson in the course, in completion order (course_day order). */
export function listHealthLessons(catalog: HealthCatalog, grade: HealthGrade): readonly HealthLesson[] {
  return getHealthCourse(catalog, grade)?.lessons ?? []
}

export function listHealthLessonsForUnit(
  catalog: HealthCatalog,
  grade: HealthGrade,
  unitNumber: number,
): readonly HealthLesson[] {
  return listHealthLessons(catalog, grade).filter((lesson) => lesson.unitNumber === unitNumber)
}

export function getHealthLesson(catalog: HealthCatalog, lessonId: string): HealthLesson | null {
  for (const course of catalog.courses) {
    const lesson = course.lessons.find((candidate) => candidate.lessonId === lessonId)
    if (lesson) return lesson
  }
  return null
}

/** The unit a lesson belongs to, or null if the lesson (or catalog) is unknown. */
export function getUnitForLesson(catalog: HealthCatalog, lessonId: string): HealthUnit | null {
  const lesson = getHealthLesson(catalog, lessonId)
  if (!lesson) return null
  return getHealthUnit(catalog, lesson.grade, lesson.unitNumber)
}

/** The lesson immediately after the given one in course-day order, or null at course end / on an unknown id. */
export function nextHealthLesson(catalog: HealthCatalog, lessonId: string): HealthLesson | null {
  const lesson = getHealthLesson(catalog, lessonId)
  if (!lesson) return null
  const lessons = listHealthLessons(catalog, lesson.grade)
  const index = lessons.findIndex((candidate) => candidate.lessonId === lessonId)
  if (index < 0) return null
  return lessons[index + 1] ?? null
}
