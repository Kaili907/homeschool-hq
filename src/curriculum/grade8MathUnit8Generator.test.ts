import { describe, expect, it } from 'vitest'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT8_GENERATORS, GRADE8_MATH_UNIT8_ITEM_DEFINITIONS, GRADE8_MATH_UNIT8_ITEM_TYPES, generateGrade8MathUnit8Question, type Grade8MathUnit8Question } from './grade8MathUnit8Generator'

const root = (n: number) => Number.isInteger(Math.sqrt(n)) ? String(Math.sqrt(n)) : `sqrt(${n})`
const nums = (text: string) => [...text.matchAll(/-?\d+/g)].map((match) => Number(match[0]))
function oracle(question: Grade8MathUnit8Question): string {
  const p = question.prompt
  const n = nums(p)
  switch (question.itemType) {
    case 'identify-hypotenuse': return 'the side opposite the right angle'
    case 'find-hypotenuse': return root(n[0] ** 2 + n[1] ** 2)
    case 'find-leg': return String(Math.sqrt(n[0] - n[1] ** 2))
    case 'verify-pythagorean-theorem': return n[0] ** 2 + n[1] ** 2 === n[2] ** 2 ? 'yes' : 'no'
    case 'converse-classification': return n[0] ** 2 + n[1] ** 2 === n[2] ** 2 ? 'right triangle' : 'not a right triangle'
    case 'distance-on-coordinate-plane': return root(n[2] ** 2 + n[3] ** 2)
    case 'right-triangle-from-coordinates': return 'yes'
    case 'rectangle-diagonal': return root(n[0] ** 2 + n[1] ** 2)
    case 'ladder-context': return `${Math.sqrt(n[0] ** 2 - n[1] ** 2)} ft`
    case 'pythagorean-error-analysis': return `No; ${n[0]}² + ${n[1]}² = ${Math.sqrt(n[0] ** 2 + n[1] ** 2)}², not ${n[2]}².`
    case 'compare-right-triangle-distances': { const rectangles = [...p.matchAll(/(\d+)-by-(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]); return rectangles[1][0] ** 2 + rectangles[1][1] ** 2 > rectangles[0][0] ** 2 + rectangles[0][1] ** 2 ? `the ${rectangles[1][0]}-by-${rectangles[1][1]} diagonal` : `the ${rectangles[0][0]}-by-${rectangles[0][1]} diagonal` }
    case 'explain-pythagorean-theorem': return 'the side lengths of a right triangle'
  }
}
describe('Grade 8 Math Unit 8 source coverage and prompt oracles', () => {
  it('registers the complete source-derived coverage contract', () => {
    expect(Object.keys(GRADE8_MATH_UNIT8_ITEM_DEFINITIONS)).toEqual([...GRADE8_MATH_UNIT8_ITEM_TYPES])
    expect(Object.keys(GRADE8_MATH_UNIT8_GENERATORS)).toEqual([...GRADE8_MATH_UNIT8_ITEM_TYPES])
    expect(new Set(Object.values(GRADE8_MATH_UNIT8_ITEM_DEFINITIONS).map((d) => d.standard))).toEqual(new Set(['8.G.6', '8.G.7', '8.G.8']))
  })
  for (const itemType of GRADE8_MATH_UNIT8_ITEM_TYPES) it(`${itemType}: 600 rendered prompts have independently recomputed answers`, () => {
    for (const difficulty of [1, 2, 3] as const) for (let run = 0; run < 200; run++) {
      const question = generateGrade8MathUnit8Question(itemType, difficulty)
      expect(question.choices).toHaveLength(4); expect(new Set(question.choices).size).toBe(4)
      expect(curriculumAnswer(question)).toBe(oracle(question))
    }
  })
})
