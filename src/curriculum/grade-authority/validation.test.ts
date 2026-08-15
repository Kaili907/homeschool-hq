import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'
import { gradeLabel, isSupportedAcademyGrade, parseSupportedAcademyGrade } from './validation'

describe('Academy grade validation', () => {
  it('accepts every canonical supported grade', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      expect(isSupportedAcademyGrade(grade)).toBe(true)
      expect(parseSupportedAcademyGrade(String(grade))).toBe(grade)
    }
  })

  it('rejects Grade 6 and malformed or out-of-range tokens', () => {
    for (const value of [6, '6', 1, 2, 13, '010', '10.0', ' 10', 'grade-10', null]) {
      expect(parseSupportedAcademyGrade(value)).toBeNull()
    }
  })

  it('parses and labels two-digit grades intact', () => {
    expect(parseSupportedAcademyGrade('10')).toBe(10)
    expect(parseSupportedAcademyGrade('11')).toBe(11)
    expect(parseSupportedAcademyGrade('12')).toBe(12)
    expect(gradeLabel(10)).toBe('Grade 10')
  })
})
