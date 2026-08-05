import type { AcademyGrade, Grade } from '../types'

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
  return grade === '5' || grade === '7' || grade === '8' ? grade : null
}

export function isAcademyGradeEnabledFromHost(grade: AcademyGrade): boolean {
  const value =
    grade === '5'
      ? import.meta.env.VITE_ACADEMY_GRADE_5_ENABLED
      : grade === '7'
        ? import.meta.env.VITE_ACADEMY_GRADE_7_ENABLED
        : import.meta.env.VITE_ACADEMY_GRADE_8_ENABLED
  return isAcademyGradeEnabled(grade, value)
}
