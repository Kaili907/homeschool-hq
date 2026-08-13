/**
 * Canonical grade authority: the single source of truth for which grades
 * Manuel Academy curriculum supports. See AUDIT.md for the existing
 * consumers this module is meant to eventually replace, and CLAUDE.md-style
 * guidance at the top of each file for why nominal/working/curriculum-
 * supported grades are kept as distinct types.
 */
export { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants.ts'
export { isSupportedAcademyGrade, parseSupportedAcademyGrade, gradeLabel } from './validation.ts'
export { gradeOrdering, nextSupportedGrade } from './ordering.ts'
export {
  gradeLessonIdToken,
  gradeRouteToken,
  parseGradeFromLessonId,
  parseGradeFromRouteToken,
  SUPPORTED_GRADE_ALTERNATION,
  ACADEMY_COURSE_ID_PATTERN,
  ACADEMY_LESSON_ID_PATTERN,
} from './tokens.ts'
export {
  type NominalStudentGrade,
  resolveWorkingAcademyGrade,
} from './gradeKinds.ts'
