import type { Grade } from '../../types'

/**
 * MOUNT-G5-MATH feature flag — the Grade 5 math practice surface is opt-in and
 * DISABLED by default. Mirrors study/featureFlag.ts and academy/featureFlag.ts:
 * only the literal string 'true' enables it, so a truthy typo ('TRUE', '1',
 * 'yes') can never put generated math in front of a child.
 */
export function isGrade5MathPracticeEnabled(value?: string): boolean {
  return value === 'true'
}

export function isGrade5MathPracticeEnabledFromHost(): boolean {
  return isGrade5MathPracticeEnabled(import.meta.env.VITE_GRADE5_MATH_PRACTICE_ENABLED)
}

/** The surface exists only for a grade-5 profile with the flag on. */
export function grade5MathPracticeAvailableFromHost(grade: Grade): boolean {
  return grade === '5' && isGrade5MathPracticeEnabledFromHost()
}
