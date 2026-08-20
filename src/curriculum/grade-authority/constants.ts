/** Canonical curriculum-supported grades. Grade 6 is intentionally absent. */
export const SUPPORTED_ACADEMY_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12] as const

export type AcademySupportedGrade = (typeof SUPPORTED_ACADEMY_GRADES)[number]
export type AcademyGradeToken = `${AcademySupportedGrade}`

/** Existing profile/runtime contracts use strings; this projection is derived
 * from the numeric authority rather than maintained as a second grade list. */
export const SUPPORTED_ACADEMY_GRADE_TOKENS: readonly AcademyGradeToken[] =
  SUPPORTED_ACADEMY_GRADES.map((grade) => String(grade) as AcademyGradeToken)
