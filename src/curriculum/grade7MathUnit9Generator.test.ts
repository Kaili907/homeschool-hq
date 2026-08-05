import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE7_MATH_UNIT9_GENERATORS, GRADE7_MATH_UNIT9_ITEM_DEFINITIONS, GRADE7_MATH_UNIT9_ITEM_TYPES, generateGrade7MathUnit9Question } from './grade7MathUnit9Generator'

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

describe('Grade 7 Math Unit 9 generator contract', () => {
  it('registers every source-derived focus', () => {
    expect(Object.keys(GRADE7_MATH_UNIT9_ITEM_DEFINITIONS)).toEqual([...GRADE7_MATH_UNIT9_ITEM_TYPES])
    expect(Object.keys(GRADE7_MATH_UNIT9_GENERATORS)).toEqual([...GRADE7_MATH_UNIT9_ITEM_TYPES])
  })

  it('produces 20 desk samples with valid choices', () => {
    setRng(seededRng(0x900_000))
    for (let index = 0; index < 20; index++) {
      const type = GRADE7_MATH_UNIT9_ITEM_TYPES[index % GRADE7_MATH_UNIT9_ITEM_TYPES.length]
      const question = generateGrade7MathUnit9Question(type, ([1, 2, 3] as const)[index % 3])
      assertUsable(question)
      expect(question.itemType).toBe(type)
      expect(question.standard).toBe(GRADE7_MATH_UNIT9_ITEM_DEFINITIONS[type].standard)
      expect(question.lessonFocus).toBe(GRADE7_MATH_UNIT9_ITEM_DEFINITIONS[type].lessonFocus)
    }
  })

  it('makes each item reachable at every difficulty', () => {
    setRng(seededRng(0x900_900))
    for (const type of GRADE7_MATH_UNIT9_ITEM_TYPES) for (const difficulty of [1, 2, 3] as const) assertUsable(generateGrade7MathUnit9Question(type, difficulty))
  })

  it('keeps every item usable under 300 unseeded runs', () => {
    for (let run = 0; run < 300; run++) for (const type of GRADE7_MATH_UNIT9_ITEM_TYPES) assertUsable(generateGrade7MathUnit9Question(type, ([1, 2, 3] as const)[run % 3]))
  })
})
