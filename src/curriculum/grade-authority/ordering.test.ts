import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'
import { gradeOrdering, nextSupportedGrade } from './ordering'

describe('supported grade ordering', () => {
  it('uses the canonical list order', () => {
    SUPPORTED_ACADEMY_GRADES.forEach((grade, index) => {
      expect(gradeOrdering(grade)).toBe(index)
    })
  })

  it('progresses across the intentional Grade 6 gap', () => {
    expect(nextSupportedGrade(3)).toBe(4)
    expect(nextSupportedGrade(4)).toBe(5)
    expect(nextSupportedGrade(5)).toBe(7)
    expect(nextSupportedGrade(7)).toBe(8)
    expect(nextSupportedGrade(8)).toBe(9)
    expect(nextSupportedGrade(9)).toBe(10)
    expect(nextSupportedGrade(10)).toBe(11)
    expect(nextSupportedGrade(11)).toBe(12)
    expect(nextSupportedGrade(12)).toBeNull()
  })
})
