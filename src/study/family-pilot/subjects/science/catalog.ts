import type { AcademyGrade } from '../../../../types'
import type {
  ScienceCatalog,
  ScienceCourseRef,
  ScienceLessonDetail,
  ScienceUnitAssessment,
  ScienceUnitRef,
} from './types'

/**
 * FAMILY-PILOT-SCIENCE-1 — pure catalog queries. Given an already-loaded
 * catalog (see source.node.ts's loadScienceCatalog), these never touch the
 * filesystem, so callers in any environment can hold a catalog instance and
 * query it repeatedly.
 */

function courseForGrade(catalog: ScienceCatalog, grade: AcademyGrade): ScienceCourseRef | undefined {
  return catalog.courses.find((course) => course.grade === grade)
}

/** The full course ref for a grade — its units and lessons in completion
 * order. undefined if the catalog has no course for that grade. */
export function getScienceCourse(catalog: ScienceCatalog, grade: AcademyGrade): ScienceCourseRef | undefined {
  return courseForGrade(catalog, grade)
}

/** This grade's units, in unit_number order. Empty if the grade has no course. */
export function listScienceUnits(catalog: ScienceCatalog, grade: AcademyGrade): readonly ScienceUnitRef[] {
  return courseForGrade(catalog, grade)?.units ?? []
}

/** This grade's lessons, course_day-ordered end to end — the schedule order
 * a student works through them in. Empty if the grade has no course. */
export function listScienceLessons(catalog: ScienceCatalog, grade: AcademyGrade) {
  return courseForGrade(catalog, grade)?.lessons ?? []
}

/** The full instructional detail for one lesson — including the safety and
 * media metadata a guardian projection or Study adapter needs. undefined if
 * the ref is unknown for that grade. */
export function getScienceLesson(
  catalog: ScienceCatalog,
  grade: AcademyGrade,
  lessonId: string,
): ScienceLessonDetail | undefined {
  return courseForGrade(catalog, grade)?.lessonDetailById.get(lessonId)
}

/** The unit assessment tied to a unit's assessment_id, if the unit has one. */
export function getScienceUnitAssessment(
  catalog: ScienceCatalog,
  grade: AcademyGrade,
  unitId: string,
): ScienceUnitAssessment | undefined {
  const course = courseForGrade(catalog, grade)
  if (!course) return undefined
  const unit = course.units.find((candidate) => candidate.unitId === unitId)
  if (!unit || unit.assessmentId === null) return undefined
  return course.assessmentsById.get(unit.assessmentId)
}
