import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE7_MATH_UNIT4_GENERATORS, GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, GRADE7_MATH_UNIT4_ITEM_TYPES, generateGrade7MathUnit4Question } from './grade7MathUnit4Generator'
import { GRADE7_MATH_UNIT5_GENERATORS, GRADE7_MATH_UNIT5_ITEM_DEFINITIONS, GRADE7_MATH_UNIT5_ITEM_TYPES, generateGrade7MathUnit5Question } from './grade7MathUnit5Generator'
import { GRADE7_MATH_UNIT6_GENERATORS, GRADE7_MATH_UNIT6_ITEM_DEFINITIONS, GRADE7_MATH_UNIT6_ITEM_TYPES, generateGrade7MathUnit6Question } from './grade7MathUnit6Generator'

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 }
}

function assertUsable(question: { choices: string[]; answerIndex: number; prompt: string; workedExample: { steps: readonly string[] } }) {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices).toHaveLength(4)
  expect(new Set(question.choices).size).toBe(4)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(4)
  expect(curriculumAnswer(question)).toBe(question.choices[question.answerIndex])
  expect(question.workedExample.steps.length).toBeGreaterThanOrEqual(2)
}

describe('Grade 7 Math Units 4-6 generator contracts', () => {
  const units = [
    { name: 'Unit 4', types: GRADE7_MATH_UNIT4_ITEM_TYPES, definitions: GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, generators: GRADE7_MATH_UNIT4_GENERATORS, generate: generateGrade7MathUnit4Question },
    { name: 'Unit 5', types: GRADE7_MATH_UNIT5_ITEM_TYPES, definitions: GRADE7_MATH_UNIT5_ITEM_DEFINITIONS, generators: GRADE7_MATH_UNIT5_GENERATORS, generate: generateGrade7MathUnit5Question },
    { name: 'Unit 6', types: GRADE7_MATH_UNIT6_ITEM_TYPES, definitions: GRADE7_MATH_UNIT6_ITEM_DEFINITIONS, generators: GRADE7_MATH_UNIT6_GENERATORS, generate: generateGrade7MathUnit6Question },
  ] as const
  for (const unit of units) {
    it(`${unit.name} registers every source-derived focus`, () => {
      expect(Object.keys(unit.definitions)).toEqual([...unit.types])
      expect(Object.keys(unit.generators)).toEqual([...unit.types])
    })
    it(`${unit.name} produces 20 desk samples with valid choices`, () => {
      setRng(seededRng(0x700_400 + units.indexOf(unit)))
      for (let index = 0; index < 20; index++) {
        const type = unit.types[index % unit.types.length]
        const question = unit.generate(type, ([1, 2, 3] as const)[index % 3])
        assertUsable(question)
        expect(question.itemType).toBe(type)
        expect(question.standard).toBe(unit.definitions[type].standard)
        expect(question.lessonFocus).toBe(unit.definitions[type].lessonFocus)
      }
    })
    it(`${unit.name} makes each item reachable at every difficulty`, () => {
      setRng(seededRng(0x700_900 + units.indexOf(unit)))
      for (const type of unit.types) for (const difficulty of [1, 2, 3] as const) assertUsable(unit.generate(type, difficulty))
    })
  }
})
