import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../../types'
import {
  GRADE5_MATH_PRACTICE_DIFFICULTY,
  GRADE5_MATH_PRACTICE_ITEM_COUNT,
  GRADE5_MATH_PRACTICE_UNITS,
  generateGrade5MathPracticeItem,
  grade5MathPracticeItemType,
  grade5MathPracticeUnit,
  grade5MathPracticeUnitKey,
} from './grade5MathPracticeUnits'
import { GRADE5_MATH_UNIT1_ITEM_TYPES } from '../grade5MathUnit1Generator'
import { GRADE5_MATH_UNIT2_ITEM_TYPES } from '../grade5MathUnit2Generator'
import { GRADE5_MATH_UNIT3_ITEM_TYPES } from '../grade5MathUnit3Generator'
import { GRADE5_MATH_UNIT4_ITEM_TYPES } from '../grade5MathUnit4Generator'
import { GRADE5_MATH_UNIT5_ITEM_TYPES } from '../grade5MathUnit5Generator'
import { GRADE5_MATH_UNIT6_ITEM_TYPES } from '../grade5MathUnit6Generator'
import { GRADE5_MATH_UNIT7_ITEM_TYPES } from '../grade5MathUnit7Generator'
import { GRADE5_MATH_UNIT8_ITEM_TYPES } from '../grade5MathUnit8Generator'
import { GRADE5_MATH_UNIT9_ITEM_TYPES } from '../grade5MathUnit9Generator'
import { GRADE5_MATH_UNIT10_ITEM_TYPES } from '../grade5MathUnit10Generator'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]

const EXPECTED_ITEM_TYPES: Record<number, readonly string[]> = {
  1: GRADE5_MATH_UNIT1_ITEM_TYPES,
  2: GRADE5_MATH_UNIT2_ITEM_TYPES,
  3: GRADE5_MATH_UNIT3_ITEM_TYPES,
  4: GRADE5_MATH_UNIT4_ITEM_TYPES,
  5: GRADE5_MATH_UNIT5_ITEM_TYPES,
  6: GRADE5_MATH_UNIT6_ITEM_TYPES,
  7: GRADE5_MATH_UNIT7_ITEM_TYPES,
  8: GRADE5_MATH_UNIT8_ITEM_TYPES,
  9: GRADE5_MATH_UNIT9_ITEM_TYPES,
  10: GRADE5_MATH_UNIT10_ITEM_TYPES,
}

describe('MOUNT-G5-MATH merged unit registry', () => {
  it('exposes all ten Grade 5 math units, in order', () => {
    expect(GRADE5_MATH_PRACTICE_UNITS.map((u) => u.unitNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    for (const unit of GRADE5_MATH_PRACTICE_UNITS) {
      expect(unit.title.length).toBeGreaterThan(0)
    }
  })

  it('carries each unit generator’s own item-type list, unaltered', () => {
    for (const unit of GRADE5_MATH_PRACTICE_UNITS) {
      expect(unit.itemTypes).toEqual(EXPECTED_ITEM_TYPES[unit.unitNumber])
    }
  })

  it('looks a unit up by number and namespaces its stat key', () => {
    expect(grade5MathPracticeUnit(6)?.title).toBe('Multiplying Fractions and Scaling')
    expect(grade5MathPracticeUnit(11)).toBeUndefined()
    expect(grade5MathPracticeUnitKey(1)).toBe('g5-math-u01')
    expect(grade5MathPracticeUnitKey(10)).toBe('g5-math-u10')
  })

  it('round-robins over the unit’s item types, with no selection from history', () => {
    const unit = grade5MathPracticeUnit(9)!
    const covered = Array.from({ length: GRADE5_MATH_PRACTICE_ITEM_COUNT }, (_, i) =>
      grade5MathPracticeItemType(unit, i),
    )
    expect(covered.slice(0, unit.itemTypes.length)).toEqual([...unit.itemTypes])
    expect(covered[unit.itemTypes.length]).toBe(unit.itemTypes[0])
  })

  it('a practice round runs at the fixed non-adaptive difficulty', () => {
    expect(GRADE5_MATH_PRACTICE_DIFFICULTY).toBe(1)
    const unit = grade5MathPracticeUnit(3)!
    for (let i = 0; i < GRADE5_MATH_PRACTICE_ITEM_COUNT; i++) {
      expect(generateGrade5MathPracticeItem(unit, i).difficulty).toBe(1)
    }
  })

  it('every generated item answers itself: choices[answerIndex] is the computed answer', () => {
    for (const unit of GRADE5_MATH_PRACTICE_UNITS) {
      for (const itemType of unit.itemTypes) {
        for (const difficulty of DIFFICULTIES) {
          for (let sample = 0; sample < 8; sample++) {
            const q = unit.generate(itemType, difficulty)
            expect(q.itemType).toBe(itemType)
            expect(q.difficulty).toBe(difficulty)
            expect(q.prompt.trim().length).toBeGreaterThan(0)
            expect(q.choices.length).toBeGreaterThanOrEqual(3)
            expect(new Set(q.choices).size).toBe(q.choices.length)
            expect(q.answerIndex).toBeGreaterThanOrEqual(0)
            expect(q.answerIndex).toBeLessThan(q.choices.length)
            expect(q.choices[q.answerIndex].trim().length).toBeGreaterThan(0)
            expect(q.workedExample.prompt.trim().length).toBeGreaterThan(0)
            expect(q.workedExample.answer.trim().length).toBeGreaterThan(0)
            expect(q.workedExample.steps.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})

describe('MOUNT-G5-MATH exact-value item shapes', () => {
  // A naive float conversion would turn 3/6 into 0.5 and $3.50 into 3.5. These
  // assertions pin the exact forms the generators emit, so a display-layer
  // transformation would have to break them to reach a child.
  const EXACT_FRACTION = /^\d+$|^\d+\/\d+$|^\d+ \d+\/\d+$/

  it('unit 6 multiply-fractions answers stay exact fractions', () => {
    const unit = grade5MathPracticeUnit(6)!
    for (let sample = 0; sample < 200; sample++) {
      const answerText = answerOf(unit.generate('multiply-fractions', 2))
      expect(answerText).toMatch(EXACT_FRACTION)
      expect(answerText).not.toContain('.')
    }
  })

  it('unit 10 fraction-project answers stay exact fractions', () => {
    const unit = grade5MathPracticeUnit(10)!
    for (let sample = 0; sample < 200; sample++) {
      const answerText = answerOf(unit.generate('fraction-project', 1))
      expect(answerText).toMatch(EXACT_FRACTION)
      expect(answerText).not.toContain('.')
    }
  })

  it('unit 10 decimal-budget answers stay exact currency to the cent', () => {
    const unit = grade5MathPracticeUnit(10)!
    for (let sample = 0; sample < 200; sample++) {
      const q = unit.generate('decimal-budget', 1)
      expect(q.choices[q.answerIndex]).toMatch(/^\$\d+\.\d{2}$/)
      for (const choice of q.choices) expect(choice).toMatch(/^\$-?\d+\.\d{2}$/)
    }
  })

  it('unit 7 money-measurement-context answers stay exact currency', () => {
    const unit = grade5MathPracticeUnit(7)!
    for (let sample = 0; sample < 200; sample++) {
      const answerText = answerOf(unit.generate('money-measurement-context', 1))
      expect(answerText).toMatch(/^\$\d+(\.\d{1,2})?$/)
    }
  })

  it('unit 8 line-plot fraction totals stay exact mixed numbers with their unit', () => {
    const unit = grade5MathPracticeUnit(8)!
    for (let sample = 0; sample < 200; sample++) {
      const answerText = answerOf(unit.generate('line-plot-fraction-data', 1))
      expect(answerText).toMatch(/^(\d+|\d+ \d+\/\d+|\d+\/\d+) meters$/)
      expect(answerText).not.toContain('.')
    }
  })
})

function answerOf(question: { choices: string[]; answerIndex: number }): string {
  return question.choices[question.answerIndex]
}
