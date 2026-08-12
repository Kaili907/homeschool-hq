import type { AcademyGrade } from '../../../../types'
import type {
  SocialStudiesAssessmentRef,
  SocialStudiesCatalog,
  SocialStudiesLessonRef,
  SocialStudiesUnitRef,
} from './types'

/**
 * FF-M3 — pure catalog queries. Given an already-loaded catalog (see
 * source.node.ts), these never touch the filesystem, so callers can use
 * them from any environment once they hold a catalog instance. Mirrors
 * src/curriculum/family-pilot/catalog.ts's query shape.
 *
 * This module holds no state of its own and makes no completion or mastery
 * decision — every function here is a read of already-loaded, frozen data.
 * Completion/mastery authority stays entirely with the existing Study
 * Engine (src/study/family-pilot/study, src/study/family-pilot/core).
 */

function courseForGrade(catalog: SocialStudiesCatalog, grade: AcademyGrade) {
  return catalog.courses.find((course) => course.grade === grade)
}

function courseForLesson(catalog: SocialStudiesCatalog, lessonRef: string) {
  return catalog.courses.find((course) => course.lessons.some((lesson) => lesson.lessonId === lessonRef))
}

/** Every lesson for a grade, in course completion order. Empty if the
 * catalog has no course for that grade. */
export function listLessons(catalog: SocialStudiesCatalog, grade: AcademyGrade): readonly SocialStudiesLessonRef[] {
  return courseForGrade(catalog, grade)?.lessons ?? []
}

/** Every unit for a grade, in unit-number order. */
export function listUnits(catalog: SocialStudiesCatalog, grade: AcademyGrade): readonly SocialStudiesUnitRef[] {
  return courseForGrade(catalog, grade)?.units ?? []
}

export function getLesson(catalog: SocialStudiesCatalog, lessonRef: string): SocialStudiesLessonRef | undefined {
  return courseForLesson(catalog, lessonRef)?.lessons.find((lesson) => lesson.lessonId === lessonRef)
}

export function getUnit(catalog: SocialStudiesCatalog, unitRef: string): SocialStudiesUnitRef | undefined {
  for (const course of catalog.courses) {
    const unit = course.units.find((candidate) => candidate.unitId === unitRef)
    if (unit) return unit
  }
  return undefined
}

/** The next lesson after `lessonRef` in its course's completion order.
 * undefined if lessonRef is unknown or is the course's last lesson. */
export function getNextLesson(catalog: SocialStudiesCatalog, lessonRef: string): SocialStudiesLessonRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  if (!course) return undefined
  const index = course.lessons.findIndex((lesson) => lesson.lessonId === lessonRef)
  return index >= 0 ? course.lessons[index + 1] : undefined
}

export function firstLesson(catalog: SocialStudiesCatalog, grade: AcademyGrade): SocialStudiesLessonRef | undefined {
  return listLessons(catalog, grade)[0]
}

export function lastLesson(catalog: SocialStudiesCatalog, grade: AcademyGrade): SocialStudiesLessonRef | undefined {
  const lessons = listLessons(catalog, grade)
  return lessons[lessons.length - 1]
}

/** The deterministic middle lesson: for an even-length course this is the
 * lesson just before the midpoint (index floor((n-1)/2)), same rule every
 * time the catalog loads. */
export function midLesson(catalog: SocialStudiesCatalog, grade: AcademyGrade): SocialStudiesLessonRef | undefined {
  const lessons = listLessons(catalog, grade)
  if (lessons.length === 0) return undefined
  return lessons[Math.floor((lessons.length - 1) / 2)]
}

export function totalLessonCount(catalog: SocialStudiesCatalog): number {
  return catalog.courses.reduce((sum, course) => sum + course.lessons.length, 0)
}

export function totalUnitCount(catalog: SocialStudiesCatalog): number {
  return catalog.courses.reduce((sum, course) => sum + course.units.length, 0)
}

/**
 * The unit assessment content for a lesson — defined only for the single
 * "Unit assessment" phase lesson in each unit, so there is exactly one
 * lesson per unit carrying assessment content. This is metadata joined onto
 * that lesson's existing calendar-block completion, not a second assignable
 * item — the unit never gets a separate completion authority for its
 * assessment.
 */
export function getAssessmentForLesson(
  catalog: SocialStudiesCatalog,
  lessonRef: string,
): SocialStudiesAssessmentRef | undefined {
  const course = courseForLesson(catalog, lessonRef)
  const lesson = course?.lessons.find((candidate) => candidate.lessonId === lessonRef)
  if (!course || !lesson || lesson.phase !== 'Unit assessment') return undefined
  const unit = course.units.find((candidate) => candidate.unitNumber === lesson.unitNumber)
  if (!unit?.assessmentId) return undefined
  return course.assessments.find((assessment) => assessment.assessmentId === unit.assessmentId)
}

export function getAssessmentForUnit(
  catalog: SocialStudiesCatalog,
  unitRef: string,
): SocialStudiesAssessmentRef | undefined {
  for (const course of catalog.courses) {
    const unit = course.units.find((candidate) => candidate.unitId === unitRef)
    if (!unit?.assessmentId) continue
    const assessment = course.assessments.find((candidate) => candidate.assessmentId === unit.assessmentId)
    if (assessment) return assessment
  }
  return undefined
}
