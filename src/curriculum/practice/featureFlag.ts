import type { Profile } from '../../types'
import { workingLevelFor } from '../../academy/workingLevel'

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

/**
 * The surface exists only for a profile whose MATHEMATICS working level is 5,
 * with the flag on. CE1: the gate reads the canonical effective level, not the
 * nominal grade — a grade-6 girl assigned mathematics level 5 reaches Grade 5
 * practice, and a grade-5 girl assigned mathematics level 7 does not. An unset
 * level resolves to her nominal grade (workingLevel.ts), so a plain grade-5
 * profile behaves exactly as it did before. Another subject sitting at level 5
 * grants nothing here: only 'mathematics' is asked.
 */
export function grade5MathPracticeAvailableFromHost(profile: Profile): boolean {
  return workingLevelFor(profile, 'mathematics') === '5' && isGrade5MathPracticeEnabledFromHost()
}
