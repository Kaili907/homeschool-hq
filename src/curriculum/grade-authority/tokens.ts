import { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants'
import { parseSupportedAcademyGrade } from './validation'

const GRADE_DIGITS = String.raw`\d{1,2}`
const SUBJECT_TOKEN = String.raw`[a-z]+(?:-[a-z]+)*`
const TWO_DIGITS = String.raw`\d{2}`

export function gradeLessonIdToken(grade: AcademySupportedGrade): string {
  return `g${grade}`
}

export function gradeRouteToken(grade: AcademySupportedGrade): string {
  return `grade-${grade}`
}

const LESSON_ID_GRADE_PATTERN = new RegExp(`(?:^|-)g(${GRADE_DIGITS})(?=-|$)`)
const ROUTE_GRADE_PATTERN = new RegExp(`(?:^|[/-])grade-(${GRADE_DIGITS})(?=[/:-]|$)`)

export function parseGradeFromLessonId(value: string): AcademySupportedGrade | null {
  const match = LESSON_ID_GRADE_PATTERN.exec(value)
  return match ? parseSupportedAcademyGrade(match[1]) : null
}

export function parseGradeFromRouteToken(value: string): AcademySupportedGrade | null {
  const match = ROUTE_GRADE_PATTERN.exec(value)
  return match ? parseSupportedAcademyGrade(match[1]) : null
}

/** Longest-first prevents a future one-digit alternative from truncating
 * Grades 10-12. */
export const SUPPORTED_GRADE_ALTERNATION = [...SUPPORTED_ACADEMY_GRADES]
  .sort((left, right) => String(right).length - String(left).length || left - right)
  .join('|')

export const ACADEMY_COURSE_ID_PATTERN = new RegExp(
  `^ma-g(${SUPPORTED_GRADE_ALTERNATION})-(${SUBJECT_TOKEN})$`,
)
export const ACADEMY_UNIT_ID_PATTERN = new RegExp(
  `^ma-g(${SUPPORTED_GRADE_ALTERNATION})-(${SUBJECT_TOKEN})-u(${TWO_DIGITS})$`,
)
export const ACADEMY_LESSON_ID_PATTERN = new RegExp(
  `^ma-g(${SUPPORTED_GRADE_ALTERNATION})-(${SUBJECT_TOKEN})-u(${TWO_DIGITS})-l(${TWO_DIGITS})$`,
)
export const ACADEMY_ASSESSMENT_ID_PATTERN = new RegExp(
  `^ma-g(${SUPPORTED_GRADE_ALTERNATION})-(${SUBJECT_TOKEN})-u(${TWO_DIGITS})-assessment$`,
)

export interface AcademyCourseIdParts {
  readonly grade: AcademySupportedGrade
  readonly subject: string
}

export interface AcademyUnitIdParts extends AcademyCourseIdParts {
  readonly unitNumber: number
}

export interface AcademyLessonIdParts extends AcademyUnitIdParts {
  readonly lessonNumber: number
}

function parsedGrade(match: RegExpExecArray): AcademySupportedGrade {
  const grade = parseSupportedAcademyGrade(match[1])
  if (grade === null) throw new Error('Canonical Academy id pattern admitted an unsupported grade.')
  return grade
}

export function parseAcademyCourseId(value: string): AcademyCourseIdParts | null {
  const match = ACADEMY_COURSE_ID_PATTERN.exec(value)
  return match ? { grade: parsedGrade(match), subject: match[2] } : null
}

export function parseAcademyUnitId(value: string): AcademyUnitIdParts | null {
  const match = ACADEMY_UNIT_ID_PATTERN.exec(value)
  return match
    ? { grade: parsedGrade(match), subject: match[2], unitNumber: Number(match[3]) }
    : null
}

export function parseAcademyLessonId(value: string): AcademyLessonIdParts | null {
  const match = ACADEMY_LESSON_ID_PATTERN.exec(value)
  return match
    ? {
        grade: parsedGrade(match),
        subject: match[2],
        unitNumber: Number(match[3]),
        lessonNumber: Number(match[4]),
      }
    : null
}

export function parseAcademyAssessmentId(value: string): AcademyUnitIdParts | null {
  const match = ACADEMY_ASSESSMENT_ID_PATTERN.exec(value)
  return match
    ? { grade: parsedGrade(match), subject: match[2], unitNumber: Number(match[3]) }
    : null
}

function assertSubject(subject: string): void {
  if (!new RegExp(`^${SUBJECT_TOKEN}$`).test(subject)) {
    throw new RangeError(`Invalid Academy subject token: ${subject}`)
  }
}

function twoDigit(value: number, label: string): string {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new RangeError(`${label} must be an integer from 0 through 99.`)
  }
  return String(value).padStart(2, '0')
}

export function academyCourseId(grade: AcademySupportedGrade, subject: string): string {
  assertSubject(subject)
  return `ma-${gradeLessonIdToken(grade)}-${subject}`
}

export function academyUnitId(
  grade: AcademySupportedGrade,
  subject: string,
  unitNumber: number,
): string {
  return `${academyCourseId(grade, subject)}-u${twoDigit(unitNumber, 'Unit number')}`
}

export function academyLessonId(
  grade: AcademySupportedGrade,
  subject: string,
  unitNumber: number,
  lessonNumber: number,
): string {
  return `${academyUnitId(grade, subject, unitNumber)}-l${twoDigit(lessonNumber, 'Lesson number')}`
}

export function academyAssessmentId(
  grade: AcademySupportedGrade,
  subject: string,
  unitNumber: number,
): string {
  return `${academyUnitId(grade, subject, unitNumber)}-assessment`
}
