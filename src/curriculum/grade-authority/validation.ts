import { SUPPORTED_ACADEMY_GRADES, type AcademySupportedGrade } from './constants'

const SUPPORTED_SET = new Set<number>(SUPPORTED_ACADEMY_GRADES)

/** True when curriculum content exists for this grade. */
export function isSupportedAcademyGrade(value: unknown): value is AcademySupportedGrade {
  return typeof value === 'number' && Number.isInteger(value) && SUPPORTED_SET.has(value)
}

/**
 * Parses an untrusted value (URL param, JSON field, form input) into a
 * curriculum-supported grade, or null if it isn't one. Accepts plain
 * integers and integer-shaped strings ("10", not "10.0" or "010"); rejects
 * everything else, including unsupported grades like 1, 2, or 6.
 */
export function parseSupportedAcademyGrade(value: unknown): AcademySupportedGrade | null {
  if (typeof value === 'number') return isSupportedAcademyGrade(value) ? value : null
  if (typeof value === 'string') {
    if (!/^(0|[1-9]\d?)$/.test(value)) return null
    return parseSupportedAcademyGrade(Number(value))
  }
  return null
}

/** Human-facing label for a curriculum-supported grade, e.g. "Grade 10". */
export function gradeLabel(grade: AcademySupportedGrade): string {
  return `Grade ${grade}`
}
