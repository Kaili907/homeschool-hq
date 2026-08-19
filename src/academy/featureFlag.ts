import type { AcademyGrade, WorkingGrade } from '../types'

/**
 * CURR-1 feature flags — one independent flag per academy grade, all DISABLED by
 * default. Mirrors study/featureFlag.ts: only the literal string 'true' enables a
 * grade, so a truthy typo can never turn a curriculum on.
 */
export function isAcademyGradeEnabled(grade: AcademyGrade, value?: string): boolean {
  void grade
  return value === 'true'
}

/** The academy level this working grade may serve content from. Restricted to
 * 5/7/8 to match ACADEMY_GRADES in sync/provenance.ts, the runtime list the
 * parent UI offers and sync authorizes. Grades 9-12 have published content but
 * are not yet offered or authorized, so they resolve to null. */
export function academyGradeOf(grade: WorkingGrade): AcademyGrade | null {
  return grade === '5' || grade === '7' || grade === '8' ? grade : null
}

export function isAcademyGradeEnabledFromHost(grade: AcademyGrade): boolean {
  // One literal entry per grade. import.meta.env members are statically replaced
  // at build time, so the flags cannot be indexed dynamically. Typing this as a
  // total Record<AcademyGrade, ...> makes adding a grade a compile error rather
  // than a silent fall-through onto another grade's flag.
  const flags: Record<AcademyGrade, string | undefined> = {
    '5': import.meta.env.VITE_ACADEMY_GRADE_5_ENABLED,
    '7': import.meta.env.VITE_ACADEMY_GRADE_7_ENABLED,
    '8': import.meta.env.VITE_ACADEMY_GRADE_8_ENABLED,
    '9': import.meta.env.VITE_ACADEMY_GRADE_9_ENABLED,
    '10': import.meta.env.VITE_ACADEMY_GRADE_10_ENABLED,
    '11': import.meta.env.VITE_ACADEMY_GRADE_11_ENABLED,
    '12': import.meta.env.VITE_ACADEMY_GRADE_12_ENABLED,
  }
  return isAcademyGradeEnabled(grade, flags[grade])
}
