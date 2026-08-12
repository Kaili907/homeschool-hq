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

/**
 * Narrow a NOMINAL grade down to one curriculum exists for, or null. The null
 * result is the nominal-vs-supported distinction doing its job: a grade-6 girl
 * is not an error, she simply has no academy content to receive.
 */
export function academyGradeOf(grade: Grade): AcademyGrade | null {
  // parseSupportedAcademyGrade, not Number(): the latter also accepts '05',
  // '5.0' and ' 5', which would then be handed back typed as AcademyGrade even
  // though no token built from them matches anything. Re-stringifying the
  // parsed number yields the canonical token.
  const parsed = parseSupportedAcademyGrade(grade)
  return parsed === null ? null : (String(parsed) as AcademyGrade)
}

/**
 * Per-grade host flags. Vite statically replaces `import.meta.env.VITE_*`, so
 * each grade needs its own literal read — a computed lookup would not survive
 * the build. A grade whose flag is unset reads undefined and stays DISABLED,
 * the correct default for grades with no released curriculum. The Record key
 * type is AcademyGrade, so adding a grade to the authority fails typecheck here
 * until its flag is wired.
 */
function hostFlag(grade: AcademyGrade): string | undefined {
  // Built per call, never hoisted to module scope: the flags must be READ at
  // call time so a host (or a test's stubEnv) that changes them after import is
  // still honoured.
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
