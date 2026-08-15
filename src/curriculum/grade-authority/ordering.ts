import { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants'

export function gradeOrdering(grade: AcademySupportedGrade): number {
  return SUPPORTED_ACADEMY_GRADES.indexOf(grade)
}

/** Next curriculum-supported grade, deliberately skipping the Grade 6 gap. */
export function nextSupportedGrade(grade: AcademySupportedGrade): AcademySupportedGrade | null {
  const next = SUPPORTED_ACADEMY_GRADES[gradeOrdering(grade) + 1]
  return next ?? null
}
