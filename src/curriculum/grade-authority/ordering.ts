import { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants'

/**
 * Zero-based rank of a grade among supported grades, e.g. gradeOrdering(3) is
 * 0 and gradeOrdering(7) is 3 (grades 3, 4, 5 precede it; 6 was never in the
 * list to begin with). Useful for sorting without re-deriving the grade list.
 */
export function gradeOrdering(grade: AcademySupportedGrade): number {
  return SUPPORTED_ACADEMY_GRADES.indexOf(grade)
}

/**
 * The next higher supported grade, skipping any gaps (grade 6 has none, so
 * nextSupportedGrade(5) is 7, not 6). Null after the last supported grade.
 */
export function nextSupportedGrade(grade: AcademySupportedGrade): AcademySupportedGrade | null {
  const index = SUPPORTED_ACADEMY_GRADES.indexOf(grade)
  const next = SUPPORTED_ACADEMY_GRADES[index + 1]
  return next ?? null
}
