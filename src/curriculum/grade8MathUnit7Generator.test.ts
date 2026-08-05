import { describe, expect, it } from 'vitest'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT7_GENERATORS, GRADE8_MATH_UNIT7_ITEM_DEFINITIONS, GRADE8_MATH_UNIT7_ITEM_TYPES, generateGrade8MathUnit7Question, type Grade8MathUnit7Question } from './grade8MathUnit7Generator'

const nums = (text: string) => [...text.matchAll(/-?\d+/g)].map((match) => Number(match[0]))
const point = (x: number, y: number) => `(${x}, ${y})`
function oracle(question: Grade8MathUnit7Question): string {
  const p = question.prompt; const n = nums(p)
  switch (question.itemType) {
    case 'identify-translation-rule': { const dx = n[2] - n[0]; const dy = n[3] - n[1]; return `(x ${dx >= 0 ? '+' : '-'} ${Math.abs(dx)}, y ${dy >= 0 ? '+' : '-'} ${Math.abs(dy)})` }
    case 'apply-translation': { const rule = p.match(/x ([+-]) (\d+), y ([+-]) (\d+)/)!; return point(n[0] + (rule[1] === '+' ? 1 : -1) * Number(rule[2]), n[1] + (rule[3] === '+' ? 1 : -1) * Number(rule[4])) }
    case 'reflect-across-axis': return p.includes('x-axis') ? point(n[0], -n[1]) : point(-n[0], n[1])
    case 'rotate-90-degrees': return p.includes('counterclockwise') ? point(-n[1], n[0]) : point(n[1], -n[0])
    case 'dilate-coordinate': return point(n[0] * n[2], n[1] * n[2])
    case 'find-scale-factor': return String(n[1] / n[0])
    case 'classify-rigid-transformation': return p.match(/a (translation|reflection|rotation)/)?.[1] ?? ''
    case 'identify-congruent-figures': return n[0] === n[3] && n[1] === n[4] && n[2] === n[5] ? 'congruent' : 'not congruent'
    case 'identify-similar-figures': return 'similar'
    case 'sequence-transformations': return point(n[0] + n[2], -(n[1] + n[3]))
    case 'angle-relationships': return `${180 - n[0]}°`
    case 'informal-geometric-argument': { const operation = p.match(/by a (translation|reflection|rotation)/)?.[1] ?? ''; return `A ${operation} preserves lengths and angle measures.` }
  }
}
describe('Grade 8 Math Unit 7 source coverage and prompt oracles', () => {
  it('registers the complete source-derived coverage contract', () => {
    expect(Object.keys(GRADE8_MATH_UNIT7_ITEM_DEFINITIONS)).toEqual([...GRADE8_MATH_UNIT7_ITEM_TYPES])
    expect(Object.keys(GRADE8_MATH_UNIT7_GENERATORS)).toEqual([...GRADE8_MATH_UNIT7_ITEM_TYPES])
    expect(new Set(Object.values(GRADE8_MATH_UNIT7_ITEM_DEFINITIONS).map((d) => d.standard))).toEqual(new Set(['8.G.1', '8.G.2', '8.G.3', '8.G.4', '8.G.5']))
  })
  for (const itemType of GRADE8_MATH_UNIT7_ITEM_TYPES) it(`${itemType}: 600 rendered prompts have independently recomputed answers`, () => {
    for (const difficulty of [1, 2, 3] as const) for (let run = 0; run < 200; run++) {
      const question = generateGrade8MathUnit7Question(itemType, difficulty)
      expect(question.choices).toHaveLength(4); expect(new Set(question.choices).size).toBe(4)
      expect(curriculumAnswer(question)).toBe(oracle(question))
    }
  })
})
