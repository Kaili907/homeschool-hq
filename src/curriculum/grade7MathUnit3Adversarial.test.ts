import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE7_MATH_UNIT3_ITEM_DEFINITIONS,
  GRADE7_MATH_UNIT3_ITEM_TYPES,
  generateGrade7MathUnit3Question,
  type Grade7MathUnit3ItemType,
  type Grade7MathUnit3Question,
} from './grade7MathUnit3Generator'

afterEach(() => setRng(null))

const seededRng = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 }
}

const DIFFICULTIES = [1, 2, 3] as const satisfies readonly Difficulty[]
/** Draws per item type per difficulty in the sweep below: 6 x 3 x 25,000 = 450,000 items. */
const DRAWS = 25_000

/**
 * Notation a Grade 7 student must never be shown. Each rule is applied to the
 * prompt, the correct answer and every distractor of every generated item.
 * `0x`/`1x` are matched without a following word boundary on purpose, so the
 * historical `0xx` and `1xx` renderings are caught by the coefficient rules too;
 * the negative lookbehind keeps `10x` and `21n` out of it.
 */
const MALFORMED: ReadonlyArray<readonly [string, RegExp]> = [
  ['doubled variable (5xx)', /xx/],
  ['zero coefficient (0x)', /(?<!\d)0[xnt]/],
  ['uncanonical unit coefficient (1x rather than x)', /(?<!\d)1[xnt]/],
  ['signed plus (+ -3)', /\+ -/],
  ['double negative (- -3)', /- -/],
  ['zero tail (3x + 0)', /[+-] 0$/],
  ['unnecessary leading plus', /^\+/],
  ['double space', / {2}/],
]

/**
 * The answer domain each item type draws from. Every distractor must sit in the
 * same domain as that item type's correct answer, so no choice can be discarded
 * on its shape alone. `combine-like-terms` legitimately collapses to a bare
 * constant when the x-terms cancel, so the linear domains admit a plain integer
 * as the degenerate linear expression it is.
 */
const ANSWER_DOMAIN: Record<Grade7MathUnit3ItemType, RegExp> = {
  distribute: /^(?:-?\d*x(?: [+-] \d+)?|-?\d+)$/,
  'combine-like-terms': /^(?:-?\d*x(?: [+-] \d+)?|-?\d+)$/,
  'factor-expression': /^\d+\(\d*x [+-] \d+\)$/,
  'equivalent-form': /^-?\d+$/,
  'interpret-expression': /^(?:-?\d+ per group|a fixed starting amount of -?\d+|the number of groups)$/,
  'context-expression': /^(?:-?\d*t(?: [+-] \d+)?|-?\d+)$/,
}

/** Standard and lesson focus are curriculum facts; a rendering repair may not touch them. */
const PINNED_CURRICULUM: ReadonlyArray<readonly [Grade7MathUnit3ItemType, string, string]> = [
  ['distribute', '7.EE.1', 'distributive property'],
  ['combine-like-terms', '7.EE.1', 'combining like terms'],
  ['factor-expression', '7.EE.1', 'factoring simple expressions'],
  ['equivalent-form', '7.EE.1', 'equivalent forms'],
  ['interpret-expression', '7.EE.2', 'interpreting parts of expressions'],
  ['context-expression', '7.EE.2', 'writing expressions from contexts'],
]

/**
 * The one sentence `context-expression` renders. Everything the item asks a
 * student to do is stated here, so the checks below read the rate and the fixed
 * amount out of this prompt rather than out of `parameters`.
 */
const CONTEXT_PROMPT = /^A trip has a (-?\d+) dollar starting adjustment and costs (-?\d+) dollars per ticket t\. Write an expression\.$/

/**
 * Canonical linear expression in t, written out from algebra here rather than
 * imported, so the generator's own renderer cannot vouch for itself.
 */
const canonicalInT = (rate: number, fixed: number): string =>
  rate === 0
    ? String(fixed)
    : `${rate === 1 ? 't' : rate === -1 ? '-t' : `${rate}t`}${fixed === 0 ? '' : fixed < 0 ? ` - ${-fixed}` : ` + ${fixed}`}`

/**
 * Reads the context sentence and holds the generator to it. A cost is money
 * paid, so `costs N dollars per ticket` may not state a negative or a zero N —
 * a negative amount per ticket is a discount or a refund, not a cost, and the
 * sentence would contradict itself no matter how correct the algebra is. The
 * starting adjustment stays signed, because an adjustment genuinely runs both
 * ways. The correct answer is then recomputed from the two numbers the sentence
 * displays, so an item whose prose and algebra drift apart fails here.
 */
function contextFaults(question: Grade7MathUnit3Question, correct: string): string[] {
  const parsed = CONTEXT_PROMPT.exec(question.prompt)
  if (!parsed) return [`context prompt does not read as a trip-cost sentence: ${JSON.stringify(question.prompt)}`]
  const fixed = Number(parsed[1])
  const rate = Number(parsed[2])
  const faults: string[] = []
  if (rate < 0) faults.push(`calls a negative amount a cost: "costs ${rate} dollars per ticket"`)
  if (rate === 0) faults.push('states a cost of 0 dollars per ticket')
  if (canonicalInT(rate, fixed) !== correct) faults.push(`the sentence gives ${canonicalInT(rate, fixed)} but the correct answer is ${JSON.stringify(correct)}`)
  if (question.parameters.a !== rate) faults.push(`parameters.a is ${question.parameters.a} but the sentence charges ${rate} per ticket`)
  if (question.parameters.b !== fixed) faults.push(`parameters.b is ${question.parameters.b} but the sentence adjusts by ${fixed}`)
  if (!/t/.test(correct)) faults.push(`the correct answer is not an expression in t: ${JSON.stringify(correct)}`)
  return faults
}

/**
 * Seeds whose choice sets collapsed below four distinct options before this
 * correction, taken from a census of the pre-correction generator. Each threw
 * `Expected at least 3 distinct distractors`; each must now build a full item.
 */
const HISTORICAL_COLLAPSE_SEEDS: ReadonlyArray<readonly [Grade7MathUnit3ItemType, Difficulty, number]> = [
  ['combine-like-terms', 1, 4_442_560],
  ['combine-like-terms', 1, 18_427_514],
  ['combine-like-terms', 1, 22_893_830],
  ['equivalent-form', 3, 855_255],
]

/**
 * Returns every contract violation in one generated item, or an empty array. The
 * sweeps below run hundreds of thousands of items, so faults are collected rather
 * than asserted one by one; only a non-empty result reaches `expect`.
 */
function faultsIn(type: Grade7MathUnit3ItemType, difficulty: Difficulty, seed: number): string[] {
  const question = generateGrade7MathUnit3Question(type, difficulty)
  const correct = curriculumAnswer(question)
  const texts = [question.prompt, correct, ...question.choices]
  const faults: string[] = []

  for (const [label, expression] of MALFORMED)
    for (const text of texts)
      if (expression.test(text)) faults.push(`${label} in ${JSON.stringify(text)}`)

  if (question.choices.length !== 4) faults.push(`${question.choices.length} choices, expected 4`)
  if (new Set(question.choices.map((choice) => choice.trim())).size !== question.choices.length) faults.push('duplicate choices after trimming')
  if (question.choices.filter((choice) => choice === correct).length !== 1) faults.push('correct answer does not appear exactly once')
  if (question.answerIndex !== question.choices.indexOf(correct)) faults.push(`answerIndex ${question.answerIndex} does not resolve to the correct answer`)

  const domain = ANSWER_DOMAIN[type]
  for (const choice of question.choices)
    if (!domain.test(choice)) faults.push(`${JSON.stringify(choice)} is outside this item type's answer domain`)

  if (type === 'context-expression') faults.push(...contextFaults(question, correct))

  return faults.length === 0 ? faults : [`${type} d=${difficulty} seed=${seed} prompt ${JSON.stringify(question.prompt)} choices ${JSON.stringify(question.choices)}`, ...faults]
}

function checkItem(type: Grade7MathUnit3ItemType, difficulty: Difficulty, seed: number): void {
  const faults = faultsIn(type, difficulty, seed)
  if (faults.length > 0) expect.unreachable(faults.join('\n  '))
}

describe('Grade 7 Unit 3 adversarial sweep', () => {
  for (const type of GRADE7_MATH_UNIT3_ITEM_TYPES)
    it(`${type}: ${DRAWS} deterministic draws per difficulty are canonical, distinct and same-kind`, () => {
      for (const difficulty of DIFFICULTIES) {
        const seed = 0x5b_0000 + GRADE7_MATH_UNIT3_ITEM_TYPES.indexOf(type) * 1_009 + difficulty
        setRng(seededRng(seed))
        for (let draw = 0; draw < DRAWS; draw++) checkItem(type, difficulty, seed)
      }
    })

  it('rebuilds every seed whose choice set collapsed before this correction', () => {
    for (const [type, difficulty, seed] of HISTORICAL_COLLAPSE_SEEDS) {
      setRng(seededRng(seed))
      checkItem(type, difficulty, seed)
    }
  })

  it('holds when every draw starts from its own RNG stream rather than one long run', () => {
    for (const type of GRADE7_MATH_UNIT3_ITEM_TYPES)
      for (const difficulty of DIFFICULTIES)
        for (let seed = 1; seed <= 2_000; seed++) {
          setRng(seededRng(seed * 7_919 + difficulty))
          checkItem(type, difficulty, seed * 7_919 + difficulty)
        }
  })

  it('terminates inside a 20-draw RNG budget for every item type and difficulty', () => {
    let calls = 0
    setRng(() => { if (++calls > 20) throw new Error('Unit 3 exceeded its 20-draw termination budget'); return 0 })
    for (const type of GRADE7_MATH_UNIT3_ITEM_TYPES)
      for (const difficulty of DIFFICULTIES) {
        calls = 0
        const question = generateGrade7MathUnit3Question(type, difficulty)
        expect(question.choices, `${type} d=${difficulty} under a constant RNG`).toHaveLength(4)
        expect(new Set(question.choices).size).toBe(4)
      }
  })

  it('leaves the standard and lesson focus of every item type alone', () => {
    expect(GRADE7_MATH_UNIT3_ITEM_TYPES.map((type) => [type, GRADE7_MATH_UNIT3_ITEM_DEFINITIONS[type].standard, GRADE7_MATH_UNIT3_ITEM_DEFINITIONS[type].lessonFocus])).toEqual(PINNED_CURRICULUM.map((row) => [...row]))
  })
})

/**
 * Drives one exact (rate, fixed amount) pair through the real generator instead
 * of waiting for random draws to reach it. `make` spends its RNG in a fixed
 * order — sign then magnitude for a, b, c and d — and `context-expression` draws
 * nothing after that but shuffles, so a scripted stream that runs out and
 * returns 0 still builds a complete item. The sign fed for a is deliberately the
 * one the caller asks for: feeding the negative sign is how the tests below show
 * that a draw which used to render a negative cost no longer can.
 */
const chooseSign = (value: number) => (value < 0 ? 0.25 : 0.75)
const chooseMagnitude = (value: number, min: number, max: number) => (Math.abs(value) - min + 0.5) / (max - min + 1)
function contextItemFor(difficulty: Difficulty, drawnA: number, b: number): Grade7MathUnit3Question {
  const top = 5 + difficulty
  const stream = [
    chooseSign(drawnA), chooseMagnitude(drawnA, 2, top),
    chooseSign(b), chooseMagnitude(b, 1, top),
    chooseSign(1), chooseMagnitude(1, 1, top),
    chooseSign(1), chooseMagnitude(1, 1, top),
  ]
  let index = 0
  setRng(() => (index < stream.length ? stream[index++] : 0))
  try { return generateGrade7MathUnit3Question('context-expression', difficulty) } finally { setRng(null) }
}

/**
 * Prompts the pre-correction generator produced at RNG seed 1, one per
 * difficulty, each charging a negative number of dollars per ticket. The
 * corrected generator must reach the same seed and describe a real cost.
 */
const HISTORICAL_NEGATIVE_COST_SEEDS: ReadonlyArray<readonly [Difficulty, string, string, string]> = [
  [1, 'A trip has a 5 dollar starting adjustment and costs -3 dollars per ticket t. Write an expression.', 'A trip has a 5 dollar starting adjustment and costs 3 dollars per ticket t. Write an expression.', '3t + 5'],
  [2, 'A trip has a 5 dollar starting adjustment and costs -4 dollars per ticket t. Write an expression.', 'A trip has a 5 dollar starting adjustment and costs 4 dollars per ticket t. Write an expression.', '4t + 5'],
  [3, 'A trip has a 6 dollar starting adjustment and costs -4 dollars per ticket t. Write an expression.', 'A trip has a 6 dollar starting adjustment and costs 4 dollars per ticket t. Write an expression.', '4t + 6'],
]

describe('Grade 7 Unit 3 context-expression states a cost a student can pay', () => {
  it('repairs the seeds that used to charge a negative number of dollars per ticket', () => {
    for (const [difficulty, before, after, answer] of HISTORICAL_NEGATIVE_COST_SEEDS) {
      expect(Number(CONTEXT_PROMPT.exec(before)![2]), `the recorded pre-correction prompt for d=${difficulty} is the defect this card fixes`).toBeLessThan(0)
      setRng(seededRng(1))
      const question = generateGrade7MathUnit3Question('context-expression', difficulty)
      expect(question.prompt, `d=${difficulty} at seed 1`).toBe(after)
      expect(curriculumAnswer(question)).toBe(answer)
      expect(contextFaults(question, curriculumAnswer(question))).toEqual([])
    }
  })

  it('charges a positive whole number of dollars per ticket for every reachable parameter pair', () => {
    let pairs = 0
    for (const difficulty of DIFFICULTIES) {
      const top = 5 + difficulty
      for (let magnitude = 2; magnitude <= top; magnitude++)
        for (const sign of [-1, 1])
          for (let fixed = 1; fixed <= top; fixed++)
            for (const fixedSign of [-1, 1]) {
              pairs++
              const question = contextItemFor(difficulty, sign * magnitude, fixedSign * fixed)
              const correct = curriculumAnswer(question)
              const rate = Number(CONTEXT_PROMPT.exec(question.prompt)![2])
              expect(rate, `d=${difficulty} drawn a=${sign * magnitude}: ${question.prompt}`).toBe(magnitude)
              expect(contextFaults(question, correct), question.prompt).toEqual([])
              expect(new Set(question.choices).size, `choices collapsed for ${question.prompt}`).toBe(4)
              expect(question.choices.filter((choice) => choice === correct)).toHaveLength(1)
              expect(question.choices[question.answerIndex]).toBe(correct)
              for (const choice of question.choices)
                expect(choice, `${JSON.stringify(choice)} is not an expression in t`).toMatch(ANSWER_DOMAIN['context-expression'])
              const wrong = question.choices.filter((choice) => choice !== correct)
              expect(wrong.filter((choice) => choice === canonicalInT(magnitude, fixedSign * fixed)), 'a distractor repeats the correct expression').toHaveLength(0)
            }
    }
    // 4 x top x (top - 1) tuples per difficulty: both signs of a drawn coefficient
    // of magnitude 2..top, against both signs of a fixed amount of 1..top.
    expect(pairs, 'the reachable parameter space was not swept').toBe(4 * 6 * 5 + 4 * 7 * 6 + 4 * 8 * 7)
  })

  it('keeps the starting adjustment signed, so the context still teaches both directions', () => {
    const adjustments = new Set<number>()
    for (const difficulty of DIFFICULTIES) {
      setRng(seededRng(0x5d_0001 + difficulty))
      for (let draw = 0; draw < 5_000; draw++)
        adjustments.add(Number(CONTEXT_PROMPT.exec(generateGrade7MathUnit3Question('context-expression', difficulty).prompt)![1]))
    }
    expect([...adjustments].filter((value) => value < 0).length, 'no negative starting adjustment is ever generated').toBeGreaterThan(0)
    expect([...adjustments].filter((value) => value > 0).length, 'no positive starting adjustment is ever generated').toBeGreaterThan(0)
    expect(adjustments.has(0), 'a 0 dollar adjustment says nothing').toBe(false)
  })

  it('still teaches negative coefficients in the item types that are not about cost', () => {
    const negativeCoefficients = new Map<Grade7MathUnit3ItemType, number>()
    for (const type of GRADE7_MATH_UNIT3_ITEM_TYPES) {
      let seen = 0
      for (const difficulty of DIFFICULTIES) {
        setRng(seededRng(0x5d_0100 + GRADE7_MATH_UNIT3_ITEM_TYPES.indexOf(type) * 101 + difficulty))
        for (let draw = 0; draw < 2_000; draw++)
          if (generateGrade7MathUnit3Question(type, difficulty).parameters.a < 0) seen++
      }
      negativeCoefficients.set(type, seen)
    }
    // Only the cost sentence loses its negative coefficient. `interpret-expression`
    // is the item type that asks a student to say what a coefficient means, so it
    // carries the interpretation of a negative rate on its own.
    expect(negativeCoefficients.get('context-expression')).toBe(0)
    for (const type of GRADE7_MATH_UNIT3_ITEM_TYPES)
      if (type !== 'context-expression')
        expect(negativeCoefficients.get(type), `${type} no longer draws a negative coefficient`).toBeGreaterThan(1_000)
  })

  it('leaves the authored worked example valid, reachable and consistent with its own sentence', () => {
    const example = GRADE7_MATH_UNIT3_ITEM_DEFINITIONS['context-expression'].workedExample
    const parsed = CONTEXT_PROMPT.exec(example.prompt)
    expect(parsed, `the worked example is no longer a context-expression prompt: ${example.prompt}`).not.toBeNull()
    const fixed = Number(parsed![1])
    const rate = Number(parsed![2])
    expect(rate, 'the worked example must model a real cost').toBeGreaterThan(0)
    expect(example.answer).toBe(canonicalInT(rate, fixed))
    const question = contextItemFor(1, rate, fixed)
    expect(question.prompt).toBe(example.prompt)
    expect(curriculumAnswer(question)).toBe(example.answer)
  })
})
