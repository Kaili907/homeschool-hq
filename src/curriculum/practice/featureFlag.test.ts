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
import { emptyProfile } from '../../migration'
import type { AcademyGrade, Grade, Profile, WorkingLevels } from '../../types'

/** A profile is the whole input to the gate now: nominal grade plus whatever
 * working levels a parent has assigned. */
function profileAt(grade: Grade, workingLevels?: WorkingLevels): Profile {
  const p = emptyProfile('t1', 'Test', grade)
  return workingLevels ? { ...p, workingLevels } : p
}

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
    expect(grade5MathPracticeAvailableFromHost(profileAt('5'))).toBe(false)
    expect(grade5MathPracticeAvailableFromHost(profileAt('6', { mathematics: '5' }))).toBe(false)
  })

  it('needs both the flag and an effective mathematics level of 5', () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', 'true')
    // no explicit level: the nominal grade still decides, exactly as before
    expect(grade5MathPracticeAvailableFromHost(profileAt('5'))).toBe(true)
    for (const grade of ['3', '4', '6', '7', '8', '10', '12'] as const) {
      expect(grade5MathPracticeAvailableFromHost(profileAt(grade))).toBe(false)
    }
    vi.unstubAllEnvs()
  })

  it('follows the mathematics working level, not the nominal grade', () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', 'true')
    // CE1: any nominal grade assigned mathematics level 5 reaches the surface
    for (const grade of ['3', '4', '6', '7', '8', '10', '12'] as const) {
      expect(grade5MathPracticeAvailableFromHost(profileAt(grade, { mathematics: '5' }))).toBe(true)
    }
    // ...and a nominal grade-5 girl moved off level 5 does not
    for (const level of ['7', '8'] as const satisfies readonly AcademyGrade[]) {
      expect(grade5MathPracticeAvailableFromHost(profileAt('5', { mathematics: level }))).toBe(false)
    }
    vi.unstubAllEnvs()
  })

  it('reads mathematics only — another subject at level 5 grants nothing', () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', 'true')
    expect(
      grade5MathPracticeAvailableFromHost(profileAt('6', { 'english-language-arts': '5', science: '5' })),
    ).toBe(false)
    // and the reverse: mathematics 5 alongside other subjects elsewhere still grants it
    expect(
      grade5MathPracticeAvailableFromHost(profileAt('6', { mathematics: '5', science: '8' })),
    ).toBe(true)
    vi.unstubAllEnvs()
  })

  it('never mutates the profile it is asked about', () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', 'true')
    const p = profileAt('6', { mathematics: '5' })
    const before = JSON.stringify(p)
    expect(grade5MathPracticeAvailableFromHost(p)).toBe(true)
    expect(JSON.stringify(p)).toBe(before)
    expect(p.grade).toBe('6')
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
