import { describe, expect, it, vi } from 'vitest'
import {
  isGrade5MathPracticeEnabled,
  isGrade5MathPracticeEnabledFromHost,
  grade5MathPracticeAvailableFromHost,
} from './featureFlag'
import {
  GRADE5_MATH_PRACTICE_PATH,
  isGrade5MathPracticePath,
} from './grade5MathPracticeRoute'

describe('MOUNT-G5-MATH feature flag', () => {
  it('is off unless the value is exactly "true"', () => {
    expect(isGrade5MathPracticeEnabled('true')).toBe(true)
    for (const value of [undefined, '', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'false']) {
      expect(isGrade5MathPracticeEnabled(value)).toBe(false)
    }
  })

  it('defaults off: the repository ships no value for the host variable', () => {
    // No .env file sets VITE_GRADE5_MATH_PRACTICE_ENABLED, so an unstubbed build
    // reads undefined here — the surface is dark until someone opts in.
    expect(import.meta.env.VITE_GRADE5_MATH_PRACTICE_ENABLED).toBeUndefined()
    expect(isGrade5MathPracticeEnabledFromHost()).toBe(false)
    expect(grade5MathPracticeAvailableFromHost('5')).toBe(false)
  })

  it('needs both the flag and a grade-5 profile', () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', 'true')
    expect(grade5MathPracticeAvailableFromHost('5')).toBe(true)
    for (const grade of ['3', '4', '6', '7', '8', '10', '12'] as const) {
      expect(grade5MathPracticeAvailableFromHost(grade)).toBe(false)
    }
    vi.unstubAllEnvs()
  })
})

describe('MOUNT-G5-MATH route', () => {
  it('matches only its own path', () => {
    expect(GRADE5_MATH_PRACTICE_PATH).toBe('/practice/grade-5-math')
    expect(isGrade5MathPracticePath('/practice/grade-5-math')).toBe(true)
    expect(isGrade5MathPracticePath('/practice/grade-5-math/')).toBe(true)
    for (const path of ['/', '/practice', '/practice/grade-5-math/unit/1', '/academy', '/study-engine']) {
      expect(isGrade5MathPracticePath(path)).toBe(false)
    }
  })
})
