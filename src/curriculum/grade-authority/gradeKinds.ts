import type { AcademySupportedGrade } from './constants'
import { isSupportedAcademyGrade } from './validation'

/** Nominal profile grades supported by the current student model. This is a
 * separate vocabulary from curriculum support: Grade 6 belongs here. */
export const NOMINAL_STUDENT_GRADES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export type NominalStudentGrade = (typeof NOMINAL_STUDENT_GRADES)[number]
export type NominalStudentGradeToken = `${NominalStudentGrade}`

/** Resolve the curriculum grade served for one subject. Unsupported nominal
 * grades fail closed as null and never fall back to another grade. */
export function resolveWorkingAcademyGrade(
  nominalGrade: NominalStudentGrade,
  explicitOverride?: AcademySupportedGrade | null,
): AcademySupportedGrade | null {
  if (explicitOverride != null) return explicitOverride
  return isSupportedAcademyGrade(nominalGrade) ? nominalGrade : null
}
