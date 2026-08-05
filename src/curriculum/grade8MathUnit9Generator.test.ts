import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT9_ITEM_TYPES, generateGrade8MathUnit9Question, type Grade8MathUnit9Question } from './grade8MathUnit9Generator'

const rng = (seed: number) => { let state = seed >>> 0; return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000) }
afterEach(() => setRng(null))

function answerFromFacts(question: Grade8MathUnit9Question): string {
  const p = question.parameters
  switch (question.itemType) {
    case 'find-hypotenuse': case 'distance-on-grid': case 'coordinate-distance': return String(p.c)
    case 'find-missing-leg': case 'right-triangle-context': return question.itemType === 'right-triangle-context' ? `${p.b} feet` : String(p.b)
    case 'classify-by-side-lengths': return p.mode!
    case 'pythagorean-converse': return p.a * p.a + p.b * p.b === p.c * p.c ? 'yes' : 'no'
    case 'irrational-distance-estimate': return Math.sqrt(p.a).toFixed(1)
    case 'choose-pythagorean-triple': return `${p.a}, ${p.b}, ${p.c}`
    case 'analyze-pythagorean-error': return `The claim is incorrect; ${p.a}² + ${p.b}² = ${p.c}².`
  }
}

describe('Grade 8 Math Unit 9 generators', () => {
  it('has twenty deterministic desk samples with valid, parameter-derived answers', () => {
    setRng(rng(0x89150001))
    for (let sample = 0; sample < 20; sample++) {
      const type = GRADE8_MATH_UNIT9_ITEM_TYPES[sample % GRADE8_MATH_UNIT9_ITEM_TYPES.length]
      const question = generateGrade8MathUnit9Question(type, ((sample % 3) + 1) as 1 | 2 | 3)
      expect(curriculumAnswer(question)).toBe(answerFromFacts(question))
      expect(question.prompt).not.toBe('')
      expect(new Set(question.choices).size).toBe(4)
    }
  })

  for (const itemType of GRADE8_MATH_UNIT9_ITEM_TYPES) {
    it(`keeps ${itemType} valid across difficulty levels`, () => {
      for (const difficulty of [1, 2, 3] as const) {
        setRng(rng(0x89151000 + itemType.length * 17 + difficulty))
        for (let run = 0; run < 100; run++) {
          const question = generateGrade8MathUnit9Question(itemType, difficulty)
          expect(curriculumAnswer(question)).toBe(answerFromFacts(question))
          expect(question.choices).toContain(curriculumAnswer(question))
          expect(new Set(question.choices).size).toBe(question.choices.length)
          expect(question.standard).toMatch(/^8\.G\.[678]$/)
        }
      }
    })
  }
})
