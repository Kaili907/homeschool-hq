import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE7_MATH_UNIT3_ITEM_DEFINITIONS,
  GRADE7_MATH_UNIT3_ITEM_TYPES,
  generateGrade7MathUnit3Question,
  type Grade7MathUnit3ItemType,
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
