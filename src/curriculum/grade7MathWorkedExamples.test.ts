import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import { curriculumAnswer, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { GRADE7_MATH_UNIT1_ITEM_DEFINITIONS, GRADE7_MATH_UNIT1_ITEM_TYPES, generateGrade7MathUnit1Question } from './grade7MathUnit1Generator'
import { GRADE7_MATH_UNIT2_ITEM_DEFINITIONS, GRADE7_MATH_UNIT2_ITEM_TYPES, generateGrade7MathUnit2Question } from './grade7MathUnit2Generator'
import { GRADE7_MATH_UNIT3_ITEM_DEFINITIONS, GRADE7_MATH_UNIT3_ITEM_TYPES, generateGrade7MathUnit3Question } from './grade7MathUnit3Generator'
import { GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, GRADE7_MATH_UNIT4_ITEM_TYPES, generateGrade7MathUnit4Question } from './grade7MathUnit4Generator'
import { GRADE7_MATH_UNIT5_ITEM_DEFINITIONS, GRADE7_MATH_UNIT5_ITEM_TYPES, generateGrade7MathUnit5Question } from './grade7MathUnit5Generator'
import { GRADE7_MATH_UNIT6_ITEM_DEFINITIONS, GRADE7_MATH_UNIT6_ITEM_TYPES, generateGrade7MathUnit6Question } from './grade7MathUnit6Generator'
import { GRADE7_MATH_UNIT9_ITEM_DEFINITIONS, GRADE7_MATH_UNIT9_ITEM_TYPES, generateGrade7MathUnit9Question } from './grade7MathUnit9Generator'
import { GRADE7_MATH_UNIT10_ITEM_DEFINITIONS, GRADE7_MATH_UNIT10_ITEM_TYPES, generateGrade7MathUnit10Question } from './grade7MathUnit10Generator'

afterEach(() => setRng(null))

type AnyQuestion = CurriculumQuestion<string, unknown>

interface UnitUnderTest {
  unit: number
  types: readonly string[]
  definitions: Record<string, { workedExample: CurriculumWorkedExample }>
  generate: (type: string, difficulty: Difficulty) => AnyQuestion
}

const UNITS: readonly UnitUnderTest[] = [
  { unit: 1, types: GRADE7_MATH_UNIT1_ITEM_TYPES, definitions: GRADE7_MATH_UNIT1_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit1Question(t as never, d) },
  { unit: 2, types: GRADE7_MATH_UNIT2_ITEM_TYPES, definitions: GRADE7_MATH_UNIT2_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit2Question(t as never, d) },
  { unit: 3, types: GRADE7_MATH_UNIT3_ITEM_TYPES, definitions: GRADE7_MATH_UNIT3_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit3Question(t as never, d) },
  { unit: 4, types: GRADE7_MATH_UNIT4_ITEM_TYPES, definitions: GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit4Question(t as never, d) },
  { unit: 5, types: GRADE7_MATH_UNIT5_ITEM_TYPES, definitions: GRADE7_MATH_UNIT5_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit5Question(t as never, d) },
  { unit: 6, types: GRADE7_MATH_UNIT6_ITEM_TYPES, definitions: GRADE7_MATH_UNIT6_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit6Question(t as never, d) },
  { unit: 9, types: GRADE7_MATH_UNIT9_ITEM_TYPES, definitions: GRADE7_MATH_UNIT9_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit9Question(t as never, d) },
  { unit: 10, types: GRADE7_MATH_UNIT10_ITEM_TYPES, definitions: GRADE7_MATH_UNIT10_ITEM_DEFINITIONS, generate: (t, d) => generateGrade7MathUnit10Question(t as never, d) },
]

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 }
}

/**
 * The generic filler these eight units shipped before this card. Units 1-3 handed
 * the same two sentences to all six of their item types; Units 4, 5, 6, 9 and 10
 * varied the example prompt but reused one method-only step pair everywhere. A
 * worked example is the only teaching a student sees after a wrong answer, so
 * none of these sentences may come back.
 */
const PLACEHOLDER_STEPS = [
  'Divide by the number of hours.',
  'Reduce the resulting fraction.',
  'Use 12 as the common denominator.',
  '-10/12 + 3/12 = -7/12.',
  'Multiply -3 by both terms.',
  '-3x + 12 is equivalent.',
  'Undo operations in reverse order, keeping both sides equivalent.',
  'Substitute or test a boundary value to check the result.',
  'Convert the percent to a fraction with denominator 100.',
  'Use integer cents for money and simplify only after the exact calculation.',
  'Write the scale as a ratio with matching units.',
  'Multiply or divide consistently, then check whether the dimensions are possible.',
  'Identify the favorable outcomes and the total possible outcomes.',
  'Write the probability as a reduced fraction, or use it to predict or evaluate a count.',
  'Identify what the problem is asking and which quantities, assumptions, or constraints matter.',
  'Build and solve a model, then check the result against the context.',
]

/**
 * Units 1-3 build a coefficient with a `term()` helper that already appends the
 * variable, then append a second `x`, so every `distribute` and
 * `combine-like-terms` prompt and correct answer ships a doubled variable (`5xx`
 * where `5x` is meant). Repairing that would change generated prompts and correct
 * answers, which this card does not own, so shape comparisons normalise it and
 * `documents the pre-existing doubled-variable artifact` pins the defect in place.
 */
const undouble = (text: string): string => text.replace(/xx/g, 'x')

/** Collapses a string to its shape: "$13.77" -> "$#.#", "closed circle at 4" -> "closed circle at #". */
const shapeOf = (text: string): string => undouble(text).replace(/\d+/g, '#')

/**
 * A step that teaches states an operation on real numbers and its result, such as
 * "8 - 3 = 5" or "-8 + -6 = -14". Prose that only names a method fails. Signed
 * operands and signed results are allowed because Units 2, 3 and 10 are about them.
 */
const CONCRETE_STEP = /-?\d[\d/.,² ]*\s*[+\-×÷*]\s*-?[\d/.,² ]*\d[^=]*=\s*-?\$?\d/

/**
 * `graph-inequality` is the one item type whose answer is a picture rather than a
 * computed value, so it is held to a number-line description instead of an
 * equation. Every other item type must show arithmetic.
 */
const PICTURE_ITEM_TYPES = new Set(['graph-inequality'])

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
function frac(numerator: number, denominator: number): string {
  if (denominator < 0) { numerator = -numerator; denominator = -denominator }
  const g = gcd(numerator, denominator) || 1
  const n = numerator / g, d = denominator / g
  return d === 1 ? String(n) : `${n}/${d}`
}
const money = (cents: number) => `$${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const term = (coefficient: number, variable: string) => (coefficient === 1 ? variable : coefficient === -1 ? `-${variable}` : `${coefficient}${variable}`)
const tail = (constant: number) => (constant < 0 ? ` - ${-constant}` : ` + ${constant}`)
function grab(text: string, expression: RegExp): RegExpExecArray {
  const found = expression.exec(text)
  if (!found) throw new Error(`worked-example prompt did not parse: ${JSON.stringify(text)} against ${expression}`)
  return found
}
const n = (value: string) => Number(value)
/** A coefficient of one is written as a bare variable, so "x" reads as 1 and "-x" as -1. */
const coefficient = (text: string) => (text === '' ? 1 : text === '-' ? -1 : Number(text))

/**
 * Recomputes the answer a worked example must state, reading only the example's
 * own displayed prompt. Nothing here consults `parameters`, `answerIndex`, the
 * generator's arithmetic, or the authored `answer` field, so a worked example
 * that teaches the wrong number fails even when the generator agrees with it.
 */
function recomputeFromExamplePrompt(itemType: string, prompt: string): string {
  switch (itemType) {
    // Unit 1 - ratios and proportional relationships
    case 'unit-rate-fraction': { const m = grab(prompt, /^(\d+) units for (\d+) items\. What is the unit rate\?$/); return `${frac(n(m[1]), n(m[2]))} units per item` }
    case 'proportional-table': { const m = grab(prompt, /^A proportional table has (\d+) per item\. What is the output for (\d+) items\?$/); return String(n(m[1]) * n(m[2])) }
    case 'constant-of-proportionality': { const m = grab(prompt, /^For y = kx, y = (\d+) when x = (\d+)\. What is k\?$/); return frac(n(m[1]), n(m[2])) }
    case 'equation-from-rate': { const m = grab(prompt, /^A relationship has (\d+) output units for each input unit\. Write its equation\.$/); return `y = ${m[1]}x` }
    case 'proportional-or-not': {
      grab(prompt, /^Are \(\d+, \d+\), \(\d+, \d+\), and \(\d+, \d+\) proportional\?/)
      const points = [...prompt.matchAll(/\((\d+), (\d+)\)/g)].map((p) => [n(p[1]), n(p[2])] as const)
      const constant = points.every(([x, y]) => y * points[0][0] === points[0][1] * x)
      return constant ? 'proportional' : 'not proportional'
    }
    case 'reasonableness': { const m = grab(prompt, /^A price is (\d+) dollars per item\. Is (\d+) dollars the exact total for (\d+) items\?$/); return n(m[2]) === n(m[1]) * n(m[3]) ? 'yes' : 'no' }

    // Unit 2 - operations with rational numbers
    case 'add-signed': { const m = grab(prompt, /^(-?\d+) \+ (-?\d+) = \?$/); return String(n(m[1]) + n(m[2])) }
    case 'subtract-signed': { const m = grab(prompt, /^(-?\d+) - (-?\d+) = \?$/); return String(n(m[1]) - n(m[2])) }
    case 'multiply-signed': { const m = grab(prompt, /^(-?\d+) \* (-?\d+) = \?$/); return String(n(m[1]) * n(m[2])) }
    case 'divide-signed': { const m = grab(prompt, /^(-?\d+) \/ (-?\d+) = \?$/); return String(n(m[1]) / n(m[2])) }
    case 'signed-fractions': { const m = grab(prompt, /^(-?\d+)\/(\d+) \+ (-?\d+)\/(\d+) = \?$/); return frac(n(m[1]) * n(m[4]) + n(m[3]) * n(m[2]), n(m[2]) * n(m[4])) }
    case 'multi-step-rational': { const m = grab(prompt, /^(-?\d+) \+ \((-?\d+) \* (-?\d+)\) = \?$/); return String(n(m[1]) + n(m[2]) * n(m[3])) }

    // Unit 3 - equivalent expressions
    case 'distribute': { const m = grab(prompt, /^Expand (-?\d+)\(x ([+-]) (\d+)\)\.$/); const a = n(m[1]), b = (m[2] === '-' ? -1 : 1) * n(m[3]); return `${term(a, 'x')}${tail(a * b)}` }
    case 'combine-like-terms': { const m = grab(prompt, /^Combine like terms: (-?\d*)x ([+-]) (\d+) ([+-]) (\d*)x ([+-]) (\d+)\.$/); const a = coefficient(m[1]), b = (m[2] === '-' ? -1 : 1) * n(m[3]), c = (m[4] === '-' ? -1 : 1) * coefficient(m[5]), d = (m[6] === '-' ? -1 : 1) * n(m[7]); return `${term(a + c, 'x')}${tail(b + d)}` }
    case 'factor-expression': { const m = grab(prompt, /^Factor (\d+)x ([+-]) (\d+) using the greatest common factor\.$/); const g = n(m[1]), inside = (m[2] === '-' ? -1 : 1) * n(m[3]) / g; return `${g}(x ${inside < 0 ? '-' : '+'} ${Math.abs(inside)})` }
    case 'equivalent-form': { const m = grab(prompt, /^Evaluate (-?\d+)\(x ([+-]) (\d+)\) when x = (-?\d+)\.$/); return String(n(m[1]) * (n(m[4]) + (m[2] === '-' ? -1 : 1) * n(m[3]))) }
    case 'interpret-expression': { const m = grab(prompt, /^In (-?\d+)n ([+-]) (\d+), what does (-?\d+) represent\?$/); return `${m[4]} per group` }
    case 'context-expression': { const m = grab(prompt, /^A trip has a (-?\d+) dollar starting adjustment and costs (-?\d+) dollars per ticket t\. Write an expression\.$/); return `${term(n(m[2]), 't')}${tail(n(m[1]))}` }

    // Unit 4 - equations and inequalities
    case 'multi-step-numerical-problem': { const m = grab(prompt, /^A group buys (\d+) passes at \$(\d+) each and pays a \$(\d+) service fee\. What is the total cost\?$/); return `$${n(m[1]) * n(m[2]) + n(m[3])}` }
    case 'two-step-equation': { const m = grab(prompt, /^Solve (-?\d+)x ([+-]) (\d+) = (-?\d+)\./); return frac(n(m[4]) - (m[2] === '-' ? -1 : 1) * n(m[3]), n(m[1])) }
    case 'two-step-inequality': { const m = grab(prompt, /^Solve (-?\d+)x \+ (\d+) (≥|≤) (-?\d+)\.$/); const a = n(m[1]); const boundary = (n(m[4]) - n(m[2])) / a; const sign = a < 0 ? (m[3] === '≥' ? '≤' : '≥') : m[3]; return `x ${sign} ${boundary}` }
    case 'solution-set': { const m = grab(prompt, /^Which integer satisfies (\d+)x \+ (\d+) ≥ (\d+) and x < (\d+)\?$/); const lower = (n(m[3]) - n(m[2])) / n(m[1]); const solutions: number[] = []; for (let x = Math.ceil(lower); x < n(m[4]); x++) solutions.push(x); expect(solutions, `${prompt} has ${solutions.length} integer solutions`).toHaveLength(1); return String(solutions[0]) }
    case 'graph-inequality': { const m = grab(prompt, /^Which graph describes x (≥|≤) (\d+)\?$/); return `closed circle at ${m[2]}, shaded ${m[1] === '≥' ? 'right' : 'left'}` }
    case 'check-and-interpret-solution': { const m = grab(prompt, /^A club charges \$(\d+) plus \$(\d+) per session for a total of \$(\d+)\. How many sessions were purchased\?$/); return String((n(m[3]) - n(m[1])) / n(m[2])) }

    // Unit 5 - percent applications (money is exact integer cents)
    case 'percent-increase-decrease': { const m = grab(prompt, /^(Increase|Decrease) \$(\d+)\.(\d\d) by (\d+)%\.$/); const base = n(m[2]) * 100 + n(m[3]); const delta = base * n(m[4]) / 100; return money(base + (m[1] === 'Increase' ? delta : -delta)) }
    case 'discount-markup': { const m = grab(prompt, /^A store (marks up|discounts) \$(\d+)\.(\d\d) by (\d+)%\. What is the new price\?$/); const base = n(m[2]) * 100 + n(m[3]); const delta = base * n(m[4]) / 100; return money(base + (m[1] === 'marks up' ? delta : -delta)) }
    case 'tax-tip': {
      const tax = /^A meal costs \$(\d+)\.(\d\d) before (\d+)% tax\. What is the total\?$/.exec(prompt)
      if (tax) { const base = n(tax[1]) * 100 + n(tax[2]); return money(base + base * n(tax[3]) / 100) }
      const tip = grab(prompt, /^A meal costs \$(\d+)\.(\d\d)\. What is a (\d+)% tip\?$/)
      return money((n(tip[1]) * 100 + n(tip[2])) * n(tip[3]) / 100)
    }
    case 'simple-interest': { const m = grab(prompt, /^Find the simple interest on \$(\d+)\.(\d\d) at (\d+)% for (\d+) years\.$/); return money((n(m[1]) * 100 + n(m[2])) * n(m[3]) / 100 * n(m[4])) }
    case 'percent-error': { const m = grab(prompt, /^The actual value is (\d+) and the measured value is (\d+)\. What is the percent error\?$/); return `${Math.abs(n(m[2]) - n(m[1])) * 100 / n(m[1])}%` }
    case 'multi-step-percent-problem': { const m = grab(prompt, /^An item costs \$(\d+)\.(\d\d), is discounted (\d+)%, then taxed (\d+)%\. What is the final price\?$/); const base = n(m[1]) * 100 + n(m[2]); const discounted = base * (100 - n(m[3])) / 100; return money(discounted * (100 + n(m[4])) / 100) }

    // Unit 6 - scale drawings and triangle construction
    case 'scale-factor': { const m = grab(prompt, /^A (\d+) cm drawing represents (\d+) cm\. What is the scale factor from drawing to actual\?$/); return String(n(m[2]) / n(m[1])) }
    case 'scale-drawing': { const m = grab(prompt, /^A map scale is (\d+) cm : (\d+) m\. What actual distance does (\d+) cm represent\?$/); return `${n(m[3]) / n(m[1]) * n(m[2])} m` }
    case 'actual-drawing-dimensions': { const m = grab(prompt, /^A (\d+) m path is drawn at (\d+) cm : (\d+) m\. What is its drawing length\?$/); return `${n(m[1]) / n(m[3]) * n(m[2])} cm` }
    case 'reproduce-at-new-scale': {
      const area = /^A drawing has area (\d+) cm² and is reproduced using a scale factor of (\d+)\. What is its new area\?$/.exec(prompt)
      if (area) return `${n(area[1]) * n(area[2]) ** 2} cm²`
      const m = grab(prompt, /^A (\d+) cm segment is reproduced using a scale factor of (\d+)\. What is its new length\?$/)
      return `${n(m[1]) * n(m[2])} cm`
    }
    case 'construct-triangle': { const m = grab(prompt, /^Can segments of lengths (\d+), (\d+), and (\d+) form a triangle\?$/); const [a, b, c] = [n(m[1]), n(m[2]), n(m[3])]; return a + b > c && a + c > b && b + c > a ? 'yes' : 'no' }
    case 'unique-triangle-conditions': {
      const asksSufficient = /^Which condition determines a unique triangle: /.test(prompt)
      const listed = [...prompt.matchAll(/\b(SSS|SAS|ASA|SSA|AAA)\b/g)].map((x) => x[1])
      const sufficient = new Set(['SSS', 'SAS', 'ASA'])
      const answers = listed.filter((code) => sufficient.has(code) === asksSufficient)
      expect(answers, `${prompt} lists ${answers.length} valid answers`).toHaveLength(1)
      return answers[0]
    }

    // Unit 9 - probability and simulation
    case 'probability-scale': {
      const m = grab(prompt, /^An event has a probability of (\d+)(?:\/(\d+))?\. How would you describe how likely the event is to happen\?$/)
      const value = n(m[1]) / (m[2] === undefined ? 1 : n(m[2]))
      if (value === 0) return 'impossible'
      if (value === 1) return 'certain'
      if (value === 0.5) return 'equally likely to happen or not happen'
      return value < 0.5 ? 'unlikely' : 'likely'
    }
    case 'experimental-probability': { const m = grab(prompt, /^A spinner was spun (\d+) times and landed on blue (\d+) times\. Based on this experiment, what is the experimental probability of landing on blue\?$/); return frac(n(m[2]), n(m[1])) }
    case 'theoretical-probability': { const m = grab(prompt, /^A bag has (\d+) red, (\d+) blue, and (\d+) green marbles\. If one marble is drawn at random, what is the theoretical probability of drawing red, P\(red\)\?$/); return frac(n(m[1]), n(m[1]) + n(m[2]) + n(m[3])) }
    case 'compound-events': { const m = grab(prompt, /^A fair coin is flipped and a spinner with (\d+) equal sections numbered 1 to (\d+) is spun\. What is the probability of getting (heads|tails) on the coin and landing on (\d+) on the spinner\?$/); return frac(1, 2 * n(m[1])) }
    case 'sample-spaces': { const m = grab(prompt, /from (\d+) options and one .+ from (\d+) options\. How many different \w+s are possible\?$/); return String(n(m[1]) * n(m[2])) }
    case 'simulation-and-model-limitations': {
      const m = grab(prompt, /about (\d+) times in (\d+) spins\. A simulation of (\d+) spins landed on that section (\d+) times\./)
      const difference = n(m[4]) - n(m[1])
      return difference === 0 ? 'exactly as predicted' : `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} than predicted`
    }

    // Unit 10 - integrated modeling
    case 'problem-formulation': { const m = grab(prompt, /^A rental company charges a \$(\d+) base fee plus \$(\d+) per hour\. A customer's total bill was \$(\d+)\./); return `${m[2]}x + ${m[1]} = ${m[3]}; x = ${(n(m[3]) - n(m[1])) / n(m[2])}` }
    case 'assumptions-and-constraints': { const m = grab(prompt, /descends (\d+) m, then descends another (\d+) m, then ascends (\d+) m\./); return String(-n(m[1]) - n(m[2]) + n(m[3])) }
    case 'proportional-and-algebraic-models': { const m = grab(prompt, /^A model predicts a \$(\d+) rate will (increase|decrease) by (\d+)%\./); const scaled = n(m[1]) * (100 + (m[2] === 'increase' ? 1 : -1) * n(m[3])) / 100; return `$${scaled.toFixed(2).replace(/\.00$/, '')}` }
    case 'geometry-and-measurement': { const m = grab(prompt, /(\d+) ft long, (\d+) ft wide, and (\d+) ft high\. What is its volume in cubic feet\?$/); return String(n(m[1]) * n(m[2]) * n(m[3])) }
    case 'data-and-uncertainty': {
      const m = grab(prompt, /values ((?:-?\d+, )+-?\d+)\. The mean is (-?\d+)\./)
      const values = m[1].split(', ').map(Number)
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      expect(mean, `${prompt} states a mean the values do not produce`).toBe(n(m[2]))
      return String(values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length)
    }
    case 'argument-and-presentation': {
      const m = grab(prompt, /^A student claims a box that is (\d+) by (\d+) by (\d+) units has a volume of (\d+) cubic units\. Evaluate the claim\.$/)
      const volume = n(m[1]) * n(m[2]) * n(m[3])
      return volume === n(m[4]) ? `Yes; the volume is ${volume} cubic units.` : `No; the volume is ${volume} cubic units, not ${m[4]}.`
    }
    default: throw new Error(`no independent oracle for ${itemType}`)
  }
}

function sample(unit: UnitUnderTest, type: string, seed: number, perDifficulty = 200): AnyQuestion[] {
  setRng(seededRng(seed))
  const items: AnyQuestion[] = []
  for (const difficulty of [1, 2, 3] as const)
    for (let run = 0; run < perDifficulty; run++) {
      // A rare distinct-distractor collapse predates this card; skip those draws
      // rather than let one throw hide the shape coverage of the other 599.
      try { items.push(unit.generate(type, difficulty)) } catch { /* pre-existing generator edge case */ }
    }
  expect(items.length, `${type} produced too few samples`).toBeGreaterThan(perDifficulty * 2)
  return items
}

describe('Grade 7 Units 1-6, 9 and 10: every item type owns its worked example', () => {
  it('gives all 48 item types a worked example whose prompt is unique across the eight units', () => {
    const prompts = new Map<string, string>()
    let typeCount = 0
    for (const unit of UNITS)
      for (const type of unit.types) {
        typeCount++
        const { prompt } = unit.definitions[type].workedExample
        const owner = prompts.get(prompt)
        expect(owner, `U${unit.unit} ${type} reuses the worked example already given to ${owner}`).toBeUndefined()
        prompts.set(prompt, `U${unit.unit} ${type}`)
      }
    expect(typeCount).toBe(48)
    expect(prompts.size, 'distinct worked-example prompts must equal the number of item types').toBe(typeCount)
  })

  for (const unit of UNITS) {
    it(`U${unit.unit} covers each of its ${unit.types.length} item types exactly once`, () => {
      expect(Object.keys(unit.definitions)).toEqual([...unit.types])
      const prompts = unit.types.map((type) => unit.definitions[type].workedExample.prompt)
      expect(new Set(prompts).size, `U${unit.unit} worked-example prompts: ${prompts.join(' | ')}`).toBe(unit.types.length)
    })

    it(`U${unit.unit} ships no placeholder prose and states an answer in at least three steps`, () => {
      for (const type of unit.types) {
        const example = unit.definitions[type].workedExample
        for (const phrase of PLACEHOLDER_STEPS)
          expect(example.steps, `U${unit.unit} ${type} still ships the placeholder step "${phrase}"`).not.toContain(phrase)
        expect(example.steps.length, `U${unit.unit} ${type} has too few steps`).toBeGreaterThanOrEqual(3)
        expect(example.answer.trim(), `U${unit.unit} ${type} has no stated answer`).not.toBe('')
        expect(example.prompt.trim(), `U${unit.unit} ${type} has no example prompt`).not.toBe('')
      }
    })

    it(`U${unit.unit} shows real arithmetic in every worked example`, () => {
      for (const type of unit.types) {
        const example = unit.definitions[type].workedExample
        if (PICTURE_ITEM_TYPES.has(type)) {
          const prose = example.steps.join(' ')
          expect(prose, `${type} must describe the number line it is asking the student to read`).toMatch(/closed circle/)
          expect(prose, `${type} must contrast the excluded-boundary case`).toMatch(/open circle/)
          expect(prose, `${type} must say which way to shade`).toMatch(/shade/)
          continue
        }
        const concrete = example.steps.filter((step) => CONCRETE_STEP.test(step))
        expect(concrete.length, `U${unit.unit} ${type} steps show no arithmetic: ${example.steps.join(' | ')}`).toBeGreaterThanOrEqual(1)
      }
    })

    for (const [index, type] of unit.types.entries()) {
      it(`U${unit.unit} ${type}: the worked example is an instance of what this item type actually asks`, () => {
        const items = sample(unit, type, unit.unit * 7919 + index * 131 + 17)
        const promptShapes = new Set(items.map((item) => shapeOf(item.prompt)))
        const answerShapes = new Set(items.map((item) => shapeOf(curriculumAnswer(item))))
        const example = unit.definitions[type].workedExample
        expect(
          promptShapes.has(shapeOf(example.prompt)),
          `worked prompt "${example.prompt}" matches no generated shape; this item type asks: ${[...promptShapes].join(' | ')}`,
        ).toBe(true)
        expect(
          answerShapes.has(shapeOf(example.answer)),
          `worked answer "${example.answer}" is not shaped like a generated answer: ${[...answerShapes].join(' | ')}`,
        ).toBe(true)
      })

      it(`U${unit.unit} ${type}: the stated answer survives independent recomputation from the example prompt`, () => {
        const example = unit.definitions[type].workedExample
        expect(recomputeFromExamplePrompt(type, example.prompt)).toBe(example.answer)
      })
    }
  }

  it('recomputes every generated item of every item type with the same prompt-only oracle', () => {
    for (const unit of UNITS)
      for (const [index, type] of unit.types.entries())
        for (const item of sample(unit, type, unit.unit * 104_729 + index * 271 + 5, 40))
          expect(recomputeFromExamplePrompt(type, undouble(item.prompt)), `U${unit.unit} ${item.prompt}`).toBe(undouble(curriculumAnswer(item)))
  })
})

/**
 * Baseline fingerprint captured at 668cfd8773b83185ad78fe212ee83bbb243f8ac8 before
 * any worked example was rewritten. Each digest covers 180 generated items (60 per
 * difficulty) of one item type, hashing prompt, correct answer and the sorted
 * choice set, so a change to any prompt, correct answer or distractor breaks it.
 *
 * `u4:two-step-equation` and `u4:check-and-interpret-solution` were re-baselined
 * when the Unit 4 distractor defects were repaired: both shipped distractors built
 * from a raw JavaScript quotient (`-4.333333333333333`), and `two-step-equation`
 * additionally collapsed its choice pool and threw on some difficulty-2 draws.
 * Only their distractors moved. Their prompts and correct answers are unchanged,
 * which `grade7MathUnit4Adversarial.test.ts` proves over 90,000 draws, and the
 * other 46 digests here are untouched.
 */
const BASELINE_FINGERPRINT: ReadonlyArray<readonly [string, string]> = [
  ['u1:unit-rate-fraction', '87483669116129bc803bd38fdf74d028d6beb4017bf1be7ab1fe2d2e8c94494f'],
  ['u1:proportional-table', 'b366494ecfceecdedfd538778f4fba70073bec47beba2aa96042cb4a7ab9707a'],
  ['u1:constant-of-proportionality', 'a6370c6b6acec6e77e9b19d945f68084c0f08cba99021b76425622cba8bf7768'],
  ['u1:equation-from-rate', 'b037c314dabed31c396e3a543cbb83988c06e80f4552888259033fe48c70208e'],
  ['u1:proportional-or-not', '20210ac31d5db1ecda9730f7ea5b800e9754bef78263f26015a5d45b869fd4de'],
  ['u1:reasonableness', '6414559d0a8ec935f531ace603b1101e64f615191b9406d737c2b10fc1b4e34f'],
  ['u2:add-signed', 'e6aa9e92ae01c12ca3e3e88bdf3ae44eb6bb974954c6644170ec7da4c1414384'],
  ['u2:subtract-signed', '7b606f77748efe31859593ac7207be76f12a046abeadfdb4f26fb300b3848552'],
  ['u2:multiply-signed', '782ed7c0958829faec197a74ed5ce6267f5327ce618e3c8b6b9948854e84aca6'],
  ['u2:divide-signed', '6d88482c578bfff5b8ba86851f2d89fc1bc1d5da4d7e7acc747d44357b1b8192'],
  ['u2:signed-fractions', '3c59c33873e03567a3708d9cc6448e7e1b0730182ad8d124e5445526df2cdc2b'],
  ['u2:multi-step-rational', '5bfbcc5a166c72a0f087638f3843136f9ec71c56cdbf56ec1d4756a43e7a4ebd'],
  ['u3:distribute', 'be6d4b1667d89acb20481451aa719b09954b3262cd6a09e779935bcfa9f200c5'],
  ['u3:combine-like-terms', 'eda2b52294f10ee6a4972ecdb8dccd8306c4aafa40aff509126bcce4fa93a08a'],
  ['u3:factor-expression', 'd88a0b3138b16f379abe00342dd982c7a1d30574fb6913af200d933d5d03f010'],
  ['u3:equivalent-form', '6b1c4f60ae42b5be84ee30bf2462817ecacdad924d85b18f47dc18747b614dbf'],
  ['u3:interpret-expression', '4913a79dfdd4fa63dee80e292eb2f8b9a4c50bdc96df645a18ed9ac1f5c60bd7'],
  ['u3:context-expression', 'd43748eaa50dafb11438b0d59c122cf7150d58cc3d405868f8fb700d845f7ab6'],
  ['u4:multi-step-numerical-problem', '927ca74d7943c62a1e8625f2a7137a81d1152ea4831ca7d8f359f2a453ce31bf'],
  ['u4:two-step-equation', '0f2b93f7a016aae7699cf32efa4f0a9cc6c44d20babb3151260c5969925ac2c4'],
  ['u4:two-step-inequality', '2bbcae05a66c8a076394b71c15e9fb0bec231529fb671225b11843dc5d9baaaa'],
  ['u4:solution-set', '15c7509327e9ec3d0b02ee3eee50e4ca24b16bb136c2f56a655e35b0c937270d'],
  ['u4:graph-inequality', 'e08283c1bb3fcb301ad36d6c97494faf5396e3e4d80744d844b57413490751de'],
  ['u4:check-and-interpret-solution', '827d4ef6598f999f3ee308272269b26928790c268e47f734f41a67152e04ebdd'],
  ['u5:percent-increase-decrease', 'ec8e32291ea12fe62c2bc76c9f89a3832fa7cf6e210318c544cb4bdb78c18a96'],
  ['u5:discount-markup', '2ba2eb841df9995e8dcc8415cb2f4c8431b7390fb5d83d55373ce0c9ba7e1639'],
  ['u5:tax-tip', '7e9770a0d3355725ecefb214ecebf8efcf884fe106cc8c9f2c09e24c39fcf8ec'],
  ['u5:simple-interest', 'f641e54061b8efe1bc34dc6fc9cd401c6bc7f2727f19ae1be1bdacc8d9459d46'],
  ['u5:percent-error', '16015341eca13aaeb13c899ca4b1a0a1470313626c57eabeb54c1a771fad3cd2'],
  ['u5:multi-step-percent-problem', '0aa796006bc0f5a547bce846c7bc1dd2656d79c96755ef174048de501f08275d'],
  ['u6:scale-factor', '5752ae0984c5b33b8bab492f55f1bfb8c31e62353e992494fe50e7594f323b76'],
  ['u6:scale-drawing', '910909517a3342a03f550d458499c3dd9baa86d871b659674ef159c16568c684'],
  ['u6:actual-drawing-dimensions', '501c3ca4d28c0c7f14704fa7b7b179fad8c62417874f39131ffc83dd2ca63776'],
  ['u6:reproduce-at-new-scale', '12e98769262ddf60e831e2b332ac4f9430aad652f08a27b9ae69d244197e5998'],
  ['u6:construct-triangle', 'aea90a5d275cbf55f23f118ec231f554ddd6217207c5152c5b0dc7a0d8fcbe9d'],
  ['u6:unique-triangle-conditions', '764e8ed15f7cf903ba4c446c7f44ca02f39f1315e788b55f89afb66409e6f2b6'],
  ['u9:probability-scale', 'ce4ea1e1db1bcd77ffc54ab255542d231aefdbcec21294c63a6e9e622d61a77f'],
  ['u9:experimental-probability', 'c6a1262b5807815799ba1e5a2d74b0ab7d9b7905ce3378e664cae1cdb1066f06'],
  ['u9:theoretical-probability', 'fbfb4b8e3b5ac2c2392c89f970ce88ee831336c0da091ad5e53996890020a220'],
  ['u9:compound-events', 'ce799fbb672355f19e2b12ccd6b08ef908786ed4e08083014f3ac58a61f14e3c'],
  ['u9:sample-spaces', 'a05f30c5e835549b7a7918e15df515e23c0fcf099c2c4cac3daf1e575aca3516'],
  ['u9:simulation-and-model-limitations', 'fd136b8c0f637e7f24c87a685eb7b945ad2573144a3d7f96f11098306db0cf08'],
  ['u10:problem-formulation', 'f9940802038fb1cb78dab36bf6d81c2b6965a551701b5239810781b670cec436'],
  ['u10:assumptions-and-constraints', '6243f4684cd6b5f86bf5a09dec82a01b9dd87dd3e75aab3345667310d074d3a5'],
  ['u10:proportional-and-algebraic-models', '829fcd538bfbf3c372ea591a1d64e76e2eb916fb252f3fd4cbebc1ab3503ad70'],
  ['u10:geometry-and-measurement', '35ac8cfd2ab417b010886b8de012ed5ddd666b6f97ce5ef682e52d1270065941'],
  ['u10:data-and-uncertainty', '49768cec5ee10d051c072d7d2439333ef1d578909d013848186789dd54c8ba6c'],
  ['u10:argument-and-presentation', 'f37e338d34c546cf04d801756d447d1afacf7eaf39a22f630b47138c540baa3b'],
]

describe('Grade 7 worked-example rewrite leaves the generated questions alone', () => {
  it('reproduces the baseline prompt, correct answer and distractor fingerprint of all 48 item types', () => {
    const observed: Array<readonly [string, string]> = []
    for (const unit of UNITS)
      for (const [index, type] of unit.types.entries()) {
        const records: string[] = []
        for (const difficulty of [1, 2, 3] as const) {
          setRng(seededRng(unit.unit * 100_003 + index * 1_009 + difficulty))
          for (let run = 0; run < 60; run++) {
            try {
              const item = unit.generate(type, difficulty)
              records.push([item.prompt, curriculumAnswer(item), [...item.choices].sort().join('||')].join(' >> '))
            } catch (error) { records.push(`THREW: ${(error as Error).message}`) }
          }
        }
        observed.push([`u${unit.unit}:${type}`, createHash('sha256').update(records.join('\n')).digest('hex')])
      }
    expect(observed).toEqual(BASELINE_FINGERPRINT)
  })

  /**
   * Not an endorsement: this pins a defect the card does not own, so the day the
   * `term()` rendering is repaired this test fails loudly and `undouble` above
   * can be deleted with it.
   */
  it('documents the pre-existing doubled-variable artifact in Unit 3', () => {
    setRng(seededRng(0x3_0001))
    const expanded = generateGrade7MathUnit3Question('distribute', 1)
    expect(curriculumAnswer(expanded), 'U3 distribute still renders 5x as 5xx in its correct answer').toMatch(/\d+xx/)
    setRng(seededRng(0x3_0002))
    const combined = generateGrade7MathUnit3Question('combine-like-terms', 1)
    expect(combined.prompt, 'U3 combine-like-terms still renders 5x as 5xx in its prompt').toMatch(/\d+xx/)
  })
})
