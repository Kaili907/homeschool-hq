import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import { curriculumAnswer, type CurriculumQuestion } from './generatorCore'
import { GRADE7_MATH_UNIT10_ITEM_DEFINITIONS, GRADE7_MATH_UNIT10_ITEM_TYPES, generateGrade7MathUnit10Question } from './grade7MathUnit10Generator'

afterEach(() => setRng(null))

type Item = CurriculumQuestion<string, unknown>

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 }
}

/**
 * Noncanonical algebra a student must never be shown. These are surface-form
 * rules, not arithmetic rules: `1x + 2 = 11` states a true equation but is not how
 * the coefficient one is written, and an item type that teaches problem
 * formulation teaches the notation along with it.
 */
const NONCANONICAL: ReadonlyArray<readonly [string, RegExp]> = [
  ['a unit coefficient written as 1x', /(?<![\d.])1x/],
  ['a negative unit coefficient written as -1x', /-\s*1x/],
  ['a zero coefficient written as 0x', /(?<![\d.])0x/],
  ['a zero constant tail', /\+\s*0(?![\d.])/],
  ['a "+ -" join', /\+\s*-/],
  ['a "- -" join', /-\s*-/],
  ['a leading plus', /(^|[=;]\s*)\+/],
  ['a doubled variable', /xx|x\s+x/],
  ['a doubled space', / {2}/],
  ['NaN', /NaN/],
  ['Infinity', /Infinity/],
  ['scientific notation', /\d[eE][+-]?\d/],
]

/**
 * Faults are collected and asserted in one go rather than through a per-item
 * `expect`, so a suite that inspects tens of thousands of draws still runs in
 * seconds. An empty list is the pass condition; the first faults are reported in
 * full so a failure names the exact draw.
 */
function assertNoFaults(faults: readonly string[]): void {
  expect(faults.slice(0, 10), `${faults.length} faulty Unit 10 draws`).toEqual([])
}

function canonicalFaults(item: Item, where: string): string[] {
  const faults: string[] = []
  for (const field of [item.prompt, ...item.choices])
    for (const [name, pattern] of NONCANONICAL)
      if (pattern.test(field)) faults.push(`${where} shows ${name}: ${JSON.stringify(field)}`)
  return faults
}

function usabilityFaults(item: Item, where: string): string[] {
  const faults: string[] = []
  if (item.choices.length !== 4) faults.push(`${where} has ${item.choices.length} choices`)
  if (new Set(item.choices).size !== item.choices.length) faults.push(`${where} has a duplicate choice: ${item.choices.join(' | ')}`)
  if (!(Number.isInteger(item.answerIndex) && item.answerIndex >= 0 && item.answerIndex < item.choices.length))
    faults.push(`${where} has answerIndex ${item.answerIndex}`)
  return faults
}

// ---------- independent algebra oracle for problem-formulation ----------

const PROMPT = /^A rental company charges a \$(\d+) base fee plus \$(\d+) per hour\. A customer's total bill was \$(\d+)\. Which equation models this situation, and how many hours were rented\?$/
/**
 * One choice read as algebra rather than compared against a string the generator
 * built. The coefficient slot is empty exactly when the coefficient is one — that
 * is the notation rule under test — so a choice that still writes `1x` parses to
 * the same 1 here and is caught by the notation rules instead of slipping past
 * this oracle.
 */
const CHOICE = /^(-?\d*)x ([+-]) (\d+) = (\d+); x = (-?\d+)$/

/** True when a choice both models the situation the prompt describes and states the hours that solve it. */
function isCorrectChoice(choice: string, baseFee: number, hourly: number, total: number): boolean {
  const parsed = CHOICE.exec(choice)
  if (!parsed) return false
  const coefficient = parsed[1] === '' ? 1 : parsed[1] === '-' ? -1 : Number(parsed[1])
  const constant = (parsed[2] === '-' ? -1 : 1) * Number(parsed[3])
  const hours = Number(parsed[5])
  // The model is "hourly rate times hours, plus the one-off base fee, equals the bill".
  if (coefficient !== hourly || constant !== baseFee || Number(parsed[4]) !== total) return false
  return coefficient * hours + constant === total
}

/**
 * Recomputes correctness from the prompt alone, then checks `answerIndex` against
 * that result. `answerIndex` is never the oracle.
 */
function formulationFaults(item: Item, where: string): string[] {
  const parsed = PROMPT.exec(item.prompt)
  if (!parsed) return [`${where} prompt did not parse: ${JSON.stringify(item.prompt)}`]
  const [baseFee, hourly, total] = [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])]
  const faults: string[] = []
  for (const choice of item.choices) if (!CHOICE.test(choice)) faults.push(`${where} offers a choice that is not an equation: ${JSON.stringify(choice)}`)
  const correct = item.choices.filter((choice) => isCorrectChoice(choice, baseFee, hourly, total))
  if (correct.length !== 1) faults.push(`${where} has ${correct.length} mathematically correct choices: ${item.choices.join(' | ')}`)
  else if (item.choices[item.answerIndex] !== correct[0]) faults.push(`${where} points answerIndex away from the only correct choice: ${item.choices.join(' | ')}`)
  return faults
}

function allFaults(item: Item, type: string, where: string): string[] {
  const faults = [...canonicalFaults(item, where), ...usabilityFaults(item, where)]
  if (type === 'problem-formulation') faults.push(...formulationFaults(item, where))
  return faults
}

// ---------- the historical defect ----------

/**
 * The exact pre-fix output of this seed at baseline 1cf141fac5e2457dde719883ab5632b144f9cf04.
 * The swapped-rate distractor puts the base fee into the coefficient slot, and the
 * base fee is drawn from 1 upward, so a capstone item about writing a model shipped `1x`.
 */
const HISTORICAL_DEFECT_SEED = 0x5f00_0010
const PARENT_CHOICES = ['2x + 1 = 11; x = 5', '2x - 1 = 11; x = 6', '2x + 1 = 11; x = 6', '1x + 2 = 11; x = 7'] as const
const PARENT_PROMPT = "A rental company charges a $1 base fee plus $2 per hour. A customer's total bill was $11. Which equation models this situation, and how many hours were rented?"

describe('Grade 7 Unit 10 renders unit coefficients in canonical algebra notation', () => {
  it('corrects the pinned historical 1x draw and changes nothing else about it', () => {
    expect(PARENT_CHOICES.filter((choice) => /(?<![\d.])1x/.test(choice)), 'the pinned seed must document a genuine pre-fix defect').toEqual(['1x + 2 = 11; x = 7'])

    setRng(seededRng(HISTORICAL_DEFECT_SEED))
    const item = generateGrade7MathUnit10Question('problem-formulation', 1)

    // Everything the parent emitted, with the single defective rendering corrected.
    expect(item.choices).toEqual(PARENT_CHOICES.map((choice) => choice.replace(/^1x /, 'x ')))
    expect(item.prompt).toBe(PARENT_PROMPT)
    expect(item.answerIndex).toBe(0)
    expect(curriculumAnswer(item)).toBe('2x + 1 = 11; x = 5')
    expect(item.parameters).toEqual({ a: 2, b: 1, c: 11, solution: 5 })
    expect(item.standard).toBe('7.EE.4')
    expect(item.lessonFocus).toBe('problem formulation')
    assertNoFaults(allFaults(item, 'problem-formulation', 'the pinned historical seed'))
  })

  /**
   * Drives one exact (a, x, b) tuple instead of hunting for it in random draws. The
   * generator draws the hourly rate, then the hours, then the base fee, and every
   * later draw only shuffles, so a scripted stream that runs out and returns 0
   * still builds a valid item. `ri(min, max)` floors `u * (max - min + 1)`, so the
   * midpoint of a bucket selects that bucket's value.
   */
  const bucket = (value: number, min: number, max: number) => (value - min + 0.5) / (max - min + 1)
  function formulationWith(difficulty: Difficulty, a: number, x: number, b: number): Item {
    const stream = [bucket(a, 2, difficulty + 5), bucket(x, 2, difficulty * 4 + 5), bucket(b, 1, difficulty * 5 + 6)]
    let index = 0
    setRng(() => (index < stream.length ? stream[index++] : 0))
    try { return generateGrade7MathUnit10Question('problem-formulation', difficulty) } finally { setRng(null) }
  }

  it('stays canonical and single-answered across the whole problem-formulation parameter space', () => {
    const faults: string[] = []
    let covered = 0
    let unitCoefficientDraws = 0
    for (const difficulty of [1, 2, 3] as const)
      for (let a = 2; a <= difficulty + 5; a++)
        for (let x = 2; x <= difficulty * 4 + 5; x++)
          for (let b = 1; b <= difficulty * 5 + 6; b++) {
            const item = formulationWith(difficulty, a, x, b)
            const where = `d${difficulty} a=${a} x=${x} b=${b}`
            const c = a * x + b
            // Confirms the scripted stream really produced the intended tuple.
            if (JSON.stringify(item.parameters) !== JSON.stringify({ a, b, c, solution: x })) faults.push(`${where} drew ${JSON.stringify(item.parameters)}`)
            faults.push(...allFaults(item, 'problem-formulation', where))
            // The hourly-rate slot never reaches one, so it must still render as `${a}x`.
            if (curriculumAnswer(item) !== `${a}x + ${b} = ${c}; x = ${x}`) faults.push(`${where} answer moved to ${curriculumAnswer(item)}`)
            if (b === 1) {
              unitCoefficientDraws++
              if (!item.choices.includes(`x + ${a} = ${c}; x = ${x + 2}`)) faults.push(`${where} lost the canonical swapped-rate distractor: ${item.choices.join(' | ')}`)
            }
            covered++
          }
    assertNoFaults(faults)
    expect(covered).toBe(3944)
    // One draw per (hourly rate, hours) pair reaches a $1 base fee: 5×8 + 6×12 + 7×16.
    expect(unitCoefficientDraws, 'the parameter space must actually reach the unit coefficient').toBe(224)
  })
})

describe('Grade 7 Unit 10 stays canonical and valid under volume', () => {
  it('emits no noncanonical form across 36,000 seeded draws of every item type and difficulty', () => {
    const faults: string[] = []
    let items = 0
    for (const type of GRADE7_MATH_UNIT10_ITEM_TYPES)
      for (const difficulty of [1, 2, 3] as const)
        for (let run = 0; run < 2000; run++) {
          setRng(seededRng(0x5f00_0000 + run))
          // No try/catch: a generator throw must fail this test rather than be skipped.
          const item = generateGrade7MathUnit10Question(type, difficulty)
          const where = `${type} d${difficulty} seed ${run}`
          faults.push(...allFaults(item, type, where))
          if (item.standard !== GRADE7_MATH_UNIT10_ITEM_DEFINITIONS[type].standard) faults.push(`${where} standard moved to ${item.standard}`)
          if (item.lessonFocus !== GRADE7_MATH_UNIT10_ITEM_DEFINITIONS[type].lessonFocus) faults.push(`${where} lessonFocus moved to ${item.lessonFocus}`)
          items++
        }
    assertNoFaults(faults)
    expect(items).toBe(36_000)
  })

  it('emits no noncanonical form under 3,000 unseeded draws of every item type', () => {
    const faults: string[] = []
    for (let run = 0; run < 3000; run++)
      for (const type of GRADE7_MATH_UNIT10_ITEM_TYPES) {
        const difficulty = ([1, 2, 3] as const)[run % 3]
        faults.push(...allFaults(generateGrade7MathUnit10Question(type, difficulty), type, `${type} d${difficulty} unseeded run ${run}`))
      }
    assertNoFaults(faults)
  })

  it('holds at the constant-RNG corners the seeded stream never reaches', () => {
    const faults: string[] = []
    for (const constant of [0, 0.999_999_9]) {
      setRng(() => constant)
      for (const type of GRADE7_MATH_UNIT10_ITEM_TYPES)
        for (const difficulty of [1, 2, 3] as const)
          faults.push(...allFaults(generateGrade7MathUnit10Question(type, difficulty), type, `${type} d${difficulty} at constant RNG ${constant}`))
    }
    assertNoFaults(faults)
  })
})
