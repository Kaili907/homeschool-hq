import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from './constants'
import { gradeOrdering, nextSupportedGrade } from './ordering'

describe('gradeOrdering', () => {
  it('ranks every supported grade by its position in the list', () => {
    SUPPORTED_ACADEMY_GRADES.forEach((grade, index) => {
      expect(gradeOrdering(grade)).toBe(index)
    })
  })

  it('keeps grade 5 and grade 7 adjacent in rank despite the numeric gap at 6', () => {
    expect(gradeOrdering(7) - gradeOrdering(5)).toBe(1)
  })
})

describe('nextSupportedGrade', () => {
  it('skips the grade-6 gap: the grade after 5 is 7', () => {
    expect(nextSupportedGrade(5)).toBe(7)
  })

  it('steps through the rest of the ordered list', () => {
    expect(nextSupportedGrade(3)).toBe(4)
    expect(nextSupportedGrade(4)).toBe(5)
    expect(nextSupportedGrade(7)).toBe(8)
    expect(nextSupportedGrade(8)).toBe(9)
    expect(nextSupportedGrade(9)).toBe(10)
    expect(nextSupportedGrade(10)).toBe(11)
    expect(nextSupportedGrade(11)).toBe(12)
  })

  it('returns null after the last supported grade', () => {
    expect(nextSupportedGrade(12)).toBeNull()
  })
})
