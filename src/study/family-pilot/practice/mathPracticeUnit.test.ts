import { describe, expect, it } from 'vitest'
import { mathPracticeUnit, mathPracticeUnitsForGrade } from './mathPracticeUnit'
import type { AcademyGrade } from '../../../types'

const GRADES: readonly AcademyGrade[] = ['5', '7', '8']

describe('FAMILY-PILOT-PRACTICE-1 mathPracticeUnit registry', () => {
  it('covers all ten reviewed units for grade 5, 7, and 8', () => {
    for (const grade of GRADES) {
      const units = mathPracticeUnitsForGrade(grade)
      expect(units.map((u) => u.unitNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    }
  })

  it('every registered unit has a non-empty itemTypes list', () => {
    for (const grade of GRADES) {
      for (const unit of mathPracticeUnitsForGrade(grade)) {
        expect(unit.itemTypes.length).toBeGreaterThan(0)
      }
    }
  })

  it('generate() produces a well-formed question for every item type in every unit', () => {
    for (const grade of GRADES) {
      for (const unit of mathPracticeUnitsForGrade(grade)) {
        for (const itemType of unit.itemTypes) {
          const question = unit.generate(itemType, 1)
          expect(question.itemType).toBe(itemType)
          expect(question.choices.length).toBeGreaterThanOrEqual(2)
          expect(question.answerIndex).toBeGreaterThanOrEqual(0)
          expect(question.answerIndex).toBeLessThan(question.choices.length)
        }
      }
    }
  })

  it('returns undefined for a grade with no registered units', () => {
    expect(mathPracticeUnitsForGrade('6' as AcademyGrade)).toEqual([])
    expect(mathPracticeUnit('6' as AcademyGrade, 1)).toBeUndefined()
  })

  it('returns undefined for an out-of-range unit number', () => {
    expect(mathPracticeUnit('5', 11)).toBeUndefined()
    expect(mathPracticeUnit('5', 0)).toBeUndefined()
  })
})
