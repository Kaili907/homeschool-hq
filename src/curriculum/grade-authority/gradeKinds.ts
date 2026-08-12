import type { AcademySupportedGrade } from './constants.ts'
import { isSupportedAcademyGrade } from './validation.ts'

/**
 * Three different questions get asked about "what grade is this", and this
 * module keeps them as distinct types on purpose:
 *
 *  - NOMINAL grade — what a student IS, for transcripts/report cards/
 *    placement. Every real grade level, whether or not curriculum exists for
 *    it (a nominal grade of 6 is a perfectly normal student; it just can't
 *    be served Academy content).
 *  - WORKING grade — what a student RECEIVES for one subject right now: an
 *    explicit override if one was set, otherwise the nominal grade. A
 *    working grade is only actionable once it is also curriculum-supported.
 *  - CURRICULUM-SUPPORTED grade (AcademySupportedGrade, see constants.ts) —
 *    what content actually EXISTS for, independent of any student.
 *
 * Conflating these is exactly the bug class this module exists to prevent:
 * a nominal grade of 6 is not an error, but treating it as curriculum-
 * supported would be.
 */
export type NominalStudentGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/**
 * Resolves the grade whose curriculum content should render for one
 * subject: the explicit override when set, otherwise the nominal grade —
 * but only when that grade is curriculum-supported. Returns null when
 * nothing can be served (e.g. a nominal grade of 6 with no override),
 * rather than silently handing back a grade nothing was authored for.
 */
export function resolveWorkingAcademyGrade(
  nominalGrade: NominalStudentGrade,
  explicitOverride?: AcademySupportedGrade | null,
): AcademySupportedGrade | null {
  if (explicitOverride != null) return explicitOverride
  return isSupportedAcademyGrade(nominalGrade) ? nominalGrade : null
}
