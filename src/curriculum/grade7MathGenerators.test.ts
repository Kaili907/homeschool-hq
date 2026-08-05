// @ts-nocheck
import { describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE7_MATH_UNIT1_ITEM_TYPES, generateGrade7MathUnit1Question } from './grade7MathUnit1Generator'
import { GRADE7_MATH_UNIT2_ITEM_TYPES, generateGrade7MathUnit2Question } from './grade7MathUnit2Generator'
import { GRADE7_MATH_UNIT3_ITEM_TYPES, generateGrade7MathUnit3Question } from './grade7MathUnit3Generator'

const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
const answer = (q: { choices: string[]; answerIndex: number }) => curriculumAnswer(q)
const wellFormed = (q: { choices: string[]; answerIndex: number }) => { expect(q.choices).toHaveLength(4); expect(new Set(q.choices).size).toBe(4); expect(q.choices[q.answerIndex]).toBeDefined() }

/** Independently parses the rendered U1 prompt; no generator answer implementation is invoked. */
function u1Oracle(prompt: string): string {
  let m = /^(\d+) units for (\d+) items/.exec(prompt); if (m) { const a = BigInt(m[1]), b = BigInt(m[2]); const g = gcd(a, b); return `${b / g === 1n ? a / g : `${a / g}/${b / g}`} units per item` }
  m = /has (\d+) per item.* for (\d+) items/.exec(prompt); if (m) return String(BigInt(m[1]) * BigInt(m[2]))
  m = /y = (\d+) when x = (\d+)/.exec(prompt); if (m) { const a = BigInt(m[1]), b = BigInt(m[2]), g = gcd(a,b); return b/g === 1n ? String(a/g) : `${a/g}/${b/g}` }
  m = /has (\d+) output/.exec(prompt); if (m) return `y = ${m[1]}x`
  if (prompt.startsWith('Are ')) { const values = [...prompt.matchAll(/\(\d, (\d+)\)/g)].map(match => Number(match[1])); return values[2] === 3 * values[0] ? 'proportional' : 'not proportional' }
  return 'yes'
}
function gcd(a: bigint,b: bigint): bigint { while (b) [a,b]=[b,a%b]; return a<0n?-a:a }
function u2Oracle(prompt: string): string {
  let m = /^(-?\d+) \+ \((-?\d+)\)/.exec(prompt); if (m) return String(BigInt(m[1]) + BigInt(m[2]))
  m = /^(-?\d+) - \((-?\d+)\)/.exec(prompt); if (m) return String(BigInt(m[1]) - BigInt(m[2]))
  m = /^(-?\d+) [*×] \((-?\d+)\)/.exec(prompt); if (m) return String(BigInt(m[1]) * BigInt(m[2]))
  m = /^(-?\d+) [\/÷] \((-?\d+)\)/.exec(prompt); if (m) return String(BigInt(m[1]) / BigInt(m[2]))
  m = /^(-?\d+)\/(\d+) \+ (-?\d+)\/(\d+)/.exec(prompt); if (m) { const n=BigInt(m[1])+BigInt(m[3]), d=BigInt(m[2]), g=gcd(n,d); return d/g===1n?String(n/g):`${n/g}/${d/g}` }
  m = /^(-?\d+) \+ \((-?\d+) [*×] (\d+)\)/.exec(prompt)!; return String(BigInt(m[1]) + BigInt(m[2]) * BigInt(m[3]))
}
function u3Oracle(prompt: string): string {
  let m=/^Expand (\d+)\(x \+ (\d+)\)/.exec(prompt);if(m)return `${m[1]}x + ${Number(m[1])*Number(m[2])}`
  m=/^Combine like terms: (\d+)x \+ (\d+)x/.exec(prompt);if(m)return `${Number(m[1])+Number(m[2])}x`
  m=/^Factor (\d+)x \+ (\d+)/.exec(prompt);if(m)return `${m[1]}(x + ${Number(m[2])/Number(m[1])})`
  m=/^Evaluate (\d+)\(x \+ (\d+)\) when x = (\d+)/.exec(prompt);if(m)return String(Number(m[1])*(Number(m[2])+Number(m[3])))
  m=/^In (\d+)n \+/.exec(prompt);if(m)return `${m[1]} per group`
  m=/costs (\d+) dollars plus (\d+) dollars/.exec(prompt)!;return `${m[2]}t + ${m[1]}`
}
describe('Grade 7 Units 1-3 independent prompt-parsing oracles (600 verified items per type)', () => {
  for (const [name, types, generate, oracle] of [
    ['U1', GRADE7_MATH_UNIT1_ITEM_TYPES, generateGrade7MathUnit1Question, u1Oracle],
    ['U2', GRADE7_MATH_UNIT2_ITEM_TYPES, generateGrade7MathUnit2Question, u2Oracle],
    ['U3', GRADE7_MATH_UNIT3_ITEM_TYPES, generateGrade7MathUnit3Question, u3Oracle],
  ] as const) for (const [i, type] of types.entries()) it(`${name} ${type}: 600 exact items`, () => { setRng(seeded(0x700000 + i)); for (const d of [1,2,3] as const) for(let run=0;run<200;run++){ const q=generate(type,d); expect(answer(q)).toBe(oracle(q.prompt)); wellFormed(q) } })
  it('keeps all choice sets valid under constant RNG', () => { setRng(() => 0); for (const [types, generate] of [[GRADE7_MATH_UNIT1_ITEM_TYPES,generateGrade7MathUnit1Question],[GRADE7_MATH_UNIT2_ITEM_TYPES,generateGrade7MathUnit2Question],[GRADE7_MATH_UNIT3_ITEM_TYPES,generateGrade7MathUnit3Question]] as const) for(const type of types) wellFormed(generate(type,3)); setRng(null) })
  it('provides 20 deterministic desk samples per unit', () => { for (const [types, generate] of [[GRADE7_MATH_UNIT1_ITEM_TYPES,generateGrade7MathUnit1Question],[GRADE7_MATH_UNIT2_ITEM_TYPES,generateGrade7MathUnit2Question],[GRADE7_MATH_UNIT3_ITEM_TYPES,generateGrade7MathUnit3Question]] as const) { setRng(seeded(81)); const samples=Array.from({length:20},(_,i)=>generate(types[i%types.length],((i%3)+1) as 1|2|3)); expect(new Set(samples.map(x=>x.prompt)).size).toBeGreaterThan(10) } setRng(null) })
})
