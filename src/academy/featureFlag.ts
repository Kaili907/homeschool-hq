import type { AcademyGrade, Grade } from '../types'
import { parseSupportedAcademyGrade } from '../curriculum/grade-authority'

/**
 * CURR-1 feature flags — one independent flag per academy grade, all DISABLED by
 * default. Mirrors study/featureFlag.ts: only the literal string 'true' enables a
 * grade, so a truthy typo can never turn a curriculum on.
 */
export function isAcademyGradeEnabled(grade: AcademyGrade, value?: string): boolean {
  void grade
  return value === 'true'
}

export function academyGradeOf(grade: Grade): AcademyGrade | null {
  const parsed = parseSupportedAcademyGrade(grade)
  return parsed === null ? null : (String(parsed) as AcademyGrade)
}

/** Literal reads allow Vite to substitute every per-grade flag at build time.
 * Missing flags remain disabled; support authority does not imply delivery. */
function hostFlag(grade: AcademyGrade): string | undefined {
  const flags: Record<AcademyGrade, string | undefined> = {
    '3': import.meta.env.VITE_ACADEMY_GRADE_3_ENABLED,
    '4': import.meta.env.VITE_ACADEMY_GRADE_4_ENABLED,
    '5': import.meta.env.VITE_ACADEMY_GRADE_5_ENABLED,
    '7': import.meta.env.VITE_ACADEMY_GRADE_7_ENABLED,
    '8': import.meta.env.VITE_ACADEMY_GRADE_8_ENABLED,
    '9': import.meta.env.VITE_ACADEMY_GRADE_9_ENABLED,
    '10': import.meta.env.VITE_ACADEMY_GRADE_10_ENABLED,
    '11': import.meta.env.VITE_ACADEMY_GRADE_11_ENABLED,
    '12': import.meta.env.VITE_ACADEMY_GRADE_12_ENABLED,
  }
  return flags[grade]
}

export function isAcademyGradeEnabledFromHost(grade: AcademyGrade): boolean {
  return isAcademyGradeEnabled(grade, hostFlag(grade))
}
