import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACADEMY_GRADES } from '../types'
import { academyGradeOf, isAcademyGradeEnabledFromHost } from './featureFlag'

describe('Academy grade feature flags', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('narrows every supported nominal grade and refuses nominal Grade 6', () => {
    for (const grade of ACADEMY_GRADES) expect(academyGradeOf(grade)).toBe(grade)
    expect(academyGradeOf('6')).toBeNull()
  })

  it('uses independent literal host flags for two-digit grades', () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_11_ENABLED', 'true')
    expect(isAcademyGradeEnabledFromHost('10')).toBe(false)
    expect(isAcademyGradeEnabledFromHost('11')).toBe(true)
    expect(isAcademyGradeEnabledFromHost('12')).toBe(false)
  })
})
