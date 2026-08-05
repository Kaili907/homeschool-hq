import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT10_ITEM_TYPES, generateGrade8MathUnit10Question, type Grade8MathUnit10Question } from './grade8MathUnit10Generator'

const rng = (seed: number) => { let state = seed >>> 0; return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000) }
afterEach(() => setRng(null))
const volume = (n: number) => `${n}π cubic units`
function answerFromFacts(question: Grade8MathUnit10Question): string {
  const p = question.parameters
  switch (question.itemType) {
    case 'cylinder-volume': return volume(p.r * p.r * p.h)
    case 'cone-volume': return volume(p.r * p.r * p.h / 3)
    case 'sphere-volume': return volume(4 * p.r ** 3 / 3)
    case 'compare-solid-volumes': return 'the cylinder'
    case 'identify-scatter-association': case 'association-in-context': return p.association!
    case 'line-of-fit-prediction': return String(p.slope! * p.askedX! + p.intercept!)
    case 'interpolation-or-extrapolation': return p.askedX! > p.h ? 'extrapolation' : 'interpolation'
    case 'two-way-table-relative-frequency': return `${p.numerator! / (p.denominator! / 5)}/5`
    case 'interpret-relative-frequency': return `${p.numerator! * 20}% of the group is in the category.`
  }
}

describe('Grade 8 Math Unit 10 generators', () => {
  it('has twenty deterministic desk samples with valid, parameter-derived answers', () => {
    setRng(rng(0x8a150001))
    for (let sample = 0; sample < 20; sample++) {
      const type = GRADE8_MATH_UNIT10_ITEM_TYPES[sample % GRADE8_MATH_UNIT10_ITEM_TYPES.length]
      const question = generateGrade8MathUnit10Question(type, ((sample % 3) + 1) as 1 | 2 | 3)
      expect(curriculumAnswer(question)).toBe(answerFromFacts(question))
      expect(question.prompt).not.toBe('')
      expect(new Set(question.choices).size).toBe(4)
    }
  })

  for (const itemType of GRADE8_MATH_UNIT10_ITEM_TYPES) {
    it(`keeps ${itemType} valid across difficulty levels`, () => {
      for (const difficulty of [1, 2, 3] as const) {
        setRng(rng(0x8a151000 + itemType.length * 17 + difficulty))
        for (let run = 0; run < 100; run++) {
          const question = generateGrade8MathUnit10Question(itemType, difficulty)
          expect(curriculumAnswer(question)).toBe(answerFromFacts(question))
          expect(question.choices).toContain(curriculumAnswer(question))
          expect(new Set(question.choices).size).toBe(question.choices.length)
          expect(question.standard).toMatch(/^8\.(G\.9|SP\.[1-4])$/)
        }
      }
    })
  }
})
