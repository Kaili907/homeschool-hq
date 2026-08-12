import type { AcademyGrade } from '../../../../types'
import type { ElaCatalog, ElaCourseRef, ElaLessonRef, ElaUnitRef } from './types'

/**
 * FAMILY-PILOT-SUBJECT-ELA — pure catalog queries. Given an already-loaded
 * catalog (see source.node.ts, Node-only), these never touch the filesystem,
 * so any host — browser or server — can call them once it has a catalog
 * instance. Mirrors src/curriculum/family-pilot/catalog.ts's math queries.
 */

/** The grade's ELA course, or undefined if the catalog has none for it. */
export function getElaCourse(catalog: ElaCatalog, grade: AcademyGrade): ElaCourseRef | undefined {
  return catalog.courses.find((course) => course.grade === grade)
}

/** The grade's units, in unit-number order. Empty if the grade has no course. */
export function listElaUnits(catalog: ElaCatalog, grade: AcademyGrade): readonly ElaUnitRef[] {
  return getElaCourse(catalog, grade)?.units ?? []
}

/** The grade's lessons, in course completion order. Empty if the grade has no course. */
export function listElaLessons(catalog: ElaCatalog, grade: AcademyGrade): readonly ElaLessonRef[] {
  return getElaCourse(catalog, grade)?.lessons ?? []
}

/** The lesson with this ref, searched across every grade's course. */
export function getElaLesson(catalog: ElaCatalog, lessonRef: string): ElaLessonRef | undefined {
  for (const course of catalog.courses) {
    const lesson = course.lessons.find((candidate) => candidate.lessonId === lessonRef)
    if (lesson) return lesson
  }
  return undefined
}
