import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE7_MATH_UNIT4_GENERATORS, GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, GRADE7_MATH_UNIT4_ITEM_TYPES, generateGrade7MathUnit4Question } from './grade7MathUnit4Generator'
import { GRADE7_MATH_UNIT5_GENERATORS, GRADE7_MATH_UNIT5_ITEM_DEFINITIONS, GRADE7_MATH_UNIT5_ITEM_TYPES, generateGrade7MathUnit5Question } from './grade7MathUnit5Generator'
import { GRADE7_MATH_UNIT6_GENERATORS, GRADE7_MATH_UNIT6_ITEM_DEFINITIONS, GRADE7_MATH_UNIT6_ITEM_TYPES, generateGrade7MathUnit6Question } from './grade7MathUnit6Generator'

afterEach(() => setRng(null))
const RUNS_PER_DIFFICULTY = 200
function seededRng(seed: number): () => number { let state = seed >>> 0; return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 } }
const money = (cents: number) => `$${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const cents = (text: string) => { const match = /^\$(\d+)\.(\d\d)$/.exec(text); if (!match) throw new Error(`Not money: ${text}`); return Number(match[1]) * 100 + Number(match[2]) }
const match = (prompt: string, expression: RegExp) => { const result = expression.exec(prompt); if (!result) throw new Error(`Prompt parser did not match: ${prompt}`); return result }
const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b)
const rationalText = (numerator: number, denominator: number) => { if (denominator < 0) [numerator, denominator] = [-numerator, -denominator]; const divisor = gcd(numerator, denominator); const n = numerator / divisor, d = denominator / divisor; return d === 1 ? String(n) : `${n}/${d}` }

/**
 * Independent oracle: every value below is parsed from the rendered prompt, not
 * from `parameters`, generator helpers, or item-definition data.
 */
function oracle(itemType: string, prompt: string, answer: string): string {
  switch (itemType) {
    case 'multi-step-numerical-problem': { const m = match(prompt, /buys (\d+) passes at \$(\d+) each and pays a \$(\d+) service/); return `$${Number(m[1]) * Number(m[2]) + Number(m[3])}` }
    case 'two-step-equation': { const m = match(prompt, /Solve (-?\d+)x ([+-]) (\d+) = (-?\d+)/); const b = (m[2] === '-' ? -1 : 1) * Number(m[3]); return rationalText(Number(m[4]) - b, Number(m[1])) }
    case 'two-step-inequality': { const m = match(prompt, /Solve (-?\d+)x \+ (\d+) (≥|≤) (-?\d+)\./); const coefficient = Number(m[1]), boundary = (Number(m[4]) - Number(m[2])) / coefficient; const shown = m[3] as '≥' | '≤'; const sign = coefficient < 0 ? (shown === '≥' ? '≤' : '≥') : shown; return `x ${sign} ${boundary}` }
    case 'solution-set': { const m = match(prompt, /satisfies (\d+)x \+ (\d+) ≥ (\d+) and x < (\d+)\?/); const lower = (Number(m[3]) - Number(m[2])) / Number(m[1]); return lower < Number(m[4]) ? String(lower) : 'INVALID' }
    case 'graph-inequality': { const m = match(prompt, /x (≥|≤) (\d+)\?/); return m[1] === '≥' ? `closed circle at ${m[2]}, shaded right` : `closed circle at ${m[2]}, shaded left` }
    case 'check-and-interpret-solution': { const m = match(prompt, /charges \$(\d+) plus \$(\d+) per session for a total of \$(\d+)/); return String((Number(m[3]) - Number(m[1])) / Number(m[2])) }
    case 'percent-increase-decrease': { const m = match(prompt, /^(Increase|Decrease) (\$\d+\.\d\d) by (\d+)%\./); const base = cents(m[2]), delta = base * Number(m[3]) / 100; return money(base + (m[1] === 'Increase' ? delta : -delta)) }
    case 'discount-markup': { const m = match(prompt, /store (marks up|discounts) (\$\d+\.\d\d) by (\d+)%/); const base = cents(m[2]), delta = base * Number(m[3]) / 100; return money(base + (m[1] === 'marks up' ? delta : -delta)) }
    case 'tax-tip': { const tax = /meal costs (\$\d+\.\d\d) before (\d+)% tax/.exec(prompt); if (tax) { const base = cents(tax[1]), delta = base * Number(tax[2]) / 100; return money(base + delta) } const tip = match(prompt, /meal costs (\$\d+\.\d\d)\. What is a (\d+)% tip/); return money(cents(tip[1]) * Number(tip[2]) / 100) }
    case 'simple-interest': { const m = match(prompt, /on (\$\d+\.\d\d) at (\d+)% for (\d+) years/); return money(cents(m[1]) * Number(m[2]) / 100 * Number(m[3])) }
    case 'percent-error': { const m = match(prompt, /actual value is (\d+) and the measured value is (\d+)/); return `${Math.abs(Number(m[2]) - Number(m[1])) * 100 / Number(m[1])}%` }
    case 'multi-step-percent-problem': { const m = match(prompt, /costs (\$\d+\.\d\d), is discounted (\d+)%, then taxed (\d+)%/); const discounted = cents(m[1]) * (100 - Number(m[2])) / 100; return money(discounted * (100 + Number(m[3])) / 100) }
    case 'scale-factor': { const m = match(prompt, /A (\d+) cm drawing represents (\d+) cm/); return String(Number(m[2]) / Number(m[1])) }
    case 'scale-drawing': { const m = match(prompt, /(\d+) cm : (\d+) m\. What actual distance does (\d+) cm/); return `${Number(m[3]) / Number(m[1]) * Number(m[2])} m` }
    case 'actual-drawing-dimensions': { const m = match(prompt, /A (\d+) m path is drawn at 1 cm : (\d+) m/); return `${Number(m[1]) / Number(m[2])} cm` }
    case 'reproduce-at-new-scale': { const area = /area (\d+) cm².*scale factor of (\d+)/.exec(prompt); if (area) return `${Number(area[1]) * Number(area[2]) ** 2} cm²`; const m = match(prompt, /A (\d+) cm segment.*scale factor of (\d+)/); return `${Number(m[1]) * Number(m[2])} cm` }
    case 'construct-triangle': { const m = match(prompt, /lengths (\d+), (\d+), and (\d+)/); const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])]; return a + b > c && a + c > b && b + c > a ? 'yes' : 'no' }
    case 'unique-triangle-conditions': { const m = match(prompt, /triangle: (SSS|SAS|ASA|SSA|AAA),/); return m[1] }
    default: throw new Error(`Missing oracle for ${itemType}`)
  }
}
function assertWellFormed(question: { choices: string[]; answerIndex: number; prompt: string }) { expect(question.choices).toHaveLength(4); expect(new Set(question.choices).size).toBe(4); expect(question.choices[question.answerIndex]).toBeDefined(); expect(question.prompt.trim()).not.toBe('') }
function assertUniqueSolutionSet(question: { itemType: string; prompt: string; choices: string[] }) { if (question.itemType !== 'solution-set') return; const m = match(question.prompt, /satisfies (\d+)x \+ (\d+) ≥ (\d+) and x < (\d+)\?/); const qualifying = question.choices.filter(choice => { const x = Number(choice); return Number.isInteger(x) && Number(m[1]) * x + Number(m[2]) >= Number(m[3]) && x < Number(m[4]) }); expect(qualifying).toHaveLength(1) }

describe('Grade 7 Math Units 4-6 source contracts and prompt-only property oracles', () => {
  const units = [
    { name: 'Unit 4', types: GRADE7_MATH_UNIT4_ITEM_TYPES, definitions: GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, generators: GRADE7_MATH_UNIT4_GENERATORS, generate: generateGrade7MathUnit4Question },
    { name: 'Unit 5', types: GRADE7_MATH_UNIT5_ITEM_TYPES, definitions: GRADE7_MATH_UNIT5_ITEM_DEFINITIONS, generators: GRADE7_MATH_UNIT5_GENERATORS, generate: generateGrade7MathUnit5Question },
    { name: 'Unit 6', types: GRADE7_MATH_UNIT6_ITEM_TYPES, definitions: GRADE7_MATH_UNIT6_ITEM_DEFINITIONS, generators: GRADE7_MATH_UNIT6_GENERATORS, generate: generateGrade7MathUnit6Question },
  ] as const
  for (const unit of units) {
    it(`${unit.name} registers every source-derived focus`, () => { expect(Object.keys(unit.definitions)).toEqual([...unit.types]); expect(Object.keys(unit.generators)).toEqual([...unit.types]) })
    for (const [index, itemType] of unit.types.entries()) it(`${unit.name} ${itemType}: 200 prompt-parsed items per difficulty`, () => { setRng(seededRng(0x740_000 + index + units.indexOf(unit) * 100)); for (const difficulty of [1, 2, 3] as const) for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) { const question = (unit.generate as (type: string, d: 1 | 2 | 3) => any)(itemType, difficulty); assertWellFormed(question); assertUniqueSolutionSet(question); expect(curriculumAnswer(question)).toBe(oracle(question.itemType, question.prompt, curriculumAnswer(question))) } })
  }
  it('reaches a negative-coefficient inequality and reverses its answer sign', () => { setRng(() => 0); for (let run = 0; run < 20; run++) { const question = generateGrade7MathUnit4Question('two-step-inequality', 3); expect(question.prompt).toMatch(/Solve -/); expect(curriculumAnswer(question)).toMatch(/^x ≤ /); expect(curriculumAnswer(question)).toBe(oracle(question.itemType, question.prompt, curriculumAnswer(question))) } })
  it('reaches area scaling and squares the linear scale factor', () => { setRng(() => 0.9); for (let run = 0; run < 20; run++) { const question = generateGrade7MathUnit6Question('reproduce-at-new-scale', 3); expect(question.prompt).toContain('area'); expect(curriculumAnswer(question)).toBe(oracle(question.itemType, question.prompt, curriculumAnswer(question))) } })
})
