/**
 * Canonical grade authority: the single source of truth for which grades
 * Manuel Academy curriculum supports. See AUDIT.md for the existing
 * consumers this module is meant to eventually replace, and CLAUDE.md-style
 * guidance at the top of each file for why nominal/working/curriculum-
 * supported grades are kept as distinct types.
 */
export { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants'
export { isSupportedAcademyGrade, parseSupportedAcademyGrade, gradeLabel } from './validation'
export { gradeOrdering, nextSupportedGrade } from './ordering'
export {
  gradeLessonIdToken,
  gradeRouteToken,
  parseGradeFromLessonId,
  parseGradeFromRouteToken,
} from './tokens'
export {
  type NominalStudentGrade,
  resolveWorkingAcademyGrade,
} from './gradeKinds'
