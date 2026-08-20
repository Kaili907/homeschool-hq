import { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants'

const SUPPORTED_SET = new Set<number>(SUPPORTED_ACADEMY_GRADES)

export function isSupportedAcademyGrade(value: unknown): value is AcademySupportedGrade {
  return typeof value === 'number' && Number.isInteger(value) && SUPPORTED_SET.has(value)
}

/** Parse an integer or canonical integer string. Malformed tokens and grades
 * without curriculum authority (especially Grade 6) return null. */
export function parseSupportedAcademyGrade(value: unknown): AcademySupportedGrade | null {
  if (typeof value === 'number') return isSupportedAcademyGrade(value) ? value : null
  if (typeof value !== 'string' || !/^(0|[1-9]\d?)$/.test(value)) return null
  const grade = Number(value)
  return isSupportedAcademyGrade(grade) ? grade : null
}

export function gradeLabel(grade: AcademySupportedGrade): string {
  return `Grade ${grade}`
}
