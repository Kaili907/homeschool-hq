import { parseSupportedAcademyGrade } from './validation.ts'
import { SUPPORTED_ACADEMY_GRADES } from './constants.ts'
import type { AcademySupportedGrade } from './constants.ts'

/**
 * Grade tokens are always 1-2 digits captured as a full number, never a
 * single `\d`. A single-digit capture would truncate "10"/"11"/"12" down to
 * "1" and misparse Grade 10-12 content as Grade 1. The lookahead/lookbehind
 * boundaries below stop a bare `g1` (or `grade-1`) from also matching as a
 * prefix of `g10`/`grade-10`, `g11`/`grade-11`, `g12`/`grade-12`.
 */
const GRADE_DIGITS = String.raw`\d{1,2}`

/** Compact grade token used inside course/lesson ids, e.g. "g10". */
export function gradeLessonIdToken(grade: AcademySupportedGrade): string {
  return `g${grade}`
}

/** Grade token used in route path segments and ref strings, e.g. "grade-10". */
export function gradeRouteToken(grade: AcademySupportedGrade): string {
  return `grade-${grade}`
}

const LESSON_ID_GRADE_PATTERN = new RegExp(`(?:^|-)g(${GRADE_DIGITS})(?=-|$)`)

/**
 * Extracts and validates the grade embedded in a course/lesson id such as
 * "ma-g10-math-u01-l02". Returns null if there is no grade token, or if the
 * token names a grade with no authored curriculum (e.g. a hypothetical
 * "ma-g6-...").
 */
export function parseGradeFromLessonId(lessonId: string): AcademySupportedGrade | null {
  const match = LESSON_ID_GRADE_PATTERN.exec(lessonId)
  return match ? parseSupportedAcademyGrade(match[1]) : null
}

const ROUTE_GRADE_PATTERN = new RegExp(`(?:^|[/-])grade-(${GRADE_DIGITS})(?=[/:-]|$)`)

/**
 * Extracts and validates the grade embedded in a route path segment or ref
 * string such as "grade-10" or "grade-10:academy-week-12-day-3".
 */
export function parseGradeFromRouteToken(token: string): AcademySupportedGrade | null {
  const match = ROUTE_GRADE_PATTERN.exec(token)
  return match ? parseSupportedAcademyGrade(match[1]) : null
}

/**
 * Regex source matching exactly one curriculum-supported grade token, e.g.
 * "10". Alternatives are emitted LONGEST-FIRST so a two-digit grade can never
 * be shortened to a one-digit prefix: with "3|...|1" ordering a "1" branch
 * would match the "1" of "g12" and leave "2" to the next pattern element,
 * misreading Grade 12 content as Grade 1. Grade 1 is not supported today, but
 * ordering the alternation defensively means adding it later cannot silently
 * break Grades 10-12.
 */
export const SUPPORTED_GRADE_ALTERNATION = [...SUPPORTED_ACADEMY_GRADES]
  .sort((a, b) => String(b).length - String(a).length || a - b)
  .join('|')

/**
 * Canonical course-id shape `ma-g<grade>-<subject>`. Capture 1 is the grade,
 * capture 2 the subject. Single source for what academyRoute.ts,
 * workingLevel.ts and sync/provenance.ts each used to spell out by hand.
 * Stateless (no /g), so sharing one RegExp across call sites is safe.
 */
export const ACADEMY_COURSE_ID_PATTERN = new RegExp(
  `^ma-g(${SUPPORTED_GRADE_ALTERNATION})-([a-z-]+)$`,
)

/** Canonical lesson-id shape `ma-g<grade>-<subject>-u##-l##`. */
export const ACADEMY_LESSON_ID_PATTERN = new RegExp(
  `^ma-g(${SUPPORTED_GRADE_ALTERNATION})-[a-z-]+-u\\d{2}-l\\d{2}$`,
)
