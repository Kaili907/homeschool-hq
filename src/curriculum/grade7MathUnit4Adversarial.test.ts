import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE7_MATH_UNIT3_ITEM_TYPES, generateGrade7MathUnit3Question } from './grade7MathUnit3Generator'
import { GRADE7_MATH_UNIT4_ITEM_DEFINITIONS, GRADE7_MATH_UNIT4_ITEM_TYPES, generateGrade7MathUnit4Question } from './grade7MathUnit4Generator'

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 0x1_0000_0000 }
}
const digest = (records: readonly string[]) => createHash('sha256').update(records.join('\n')).digest('hex')
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/**
 * The Unit 4 distractor format policy, expressed as the only string shapes a
 * student may be shown. Every Unit 4 answer is an exact integer, an exact
 * simplest-form fraction, a whole-dollar amount or an inequality statement, so
 * no Unit 4 choice may carry a decimal point at all: a raw JavaScript quotient
 * such as 11.333333333333334 is not a value any student would write down.
 * Scientific notation, NaN, Infinity and a signed zero are excluded by the same
 * rule because none of them is a shape this unit ever asks a student to produce.
 */
const CHOICE_SHAPES: Record<string, RegExp> = {
  'multi-step-numerical-problem': /^\$\d+$/,
  'two-step-equation': /^(-?\d+|-?\d+\/\d+)$/,
  'two-step-inequality': /^x [≥≤] -?\d+$/,
  'solution-set': /^-?\d+$/,
  'graph-inequality': /^(closed|open) circle at -?\d+, shaded (left|right)$/,
  'check-and-interpret-solution': /^\d+$/,
}

/** Reports why a choice violates the policy, or null when it is well formed. */
function policyViolation(itemType: string, choice: string): string | null {
  if (/\d[.]\d/.test(choice)) return 'decimal point'
  if (/e[+-]?\d/i.test(choice)) return 'scientific notation'
  if (/NaN|Infinity/.test(choice)) return 'NaN or Infinity'
  if (/(^|\D)-0($|\D)/.test(choice)) return 'negative zero'
  if (!CHOICE_SHAPES[itemType].test(choice)) return `does not match the ${itemType} answer shape`
  const fraction = /^(-?\d+)\/(\d+)$/.exec(choice)
  if (fraction) {
    const [numerator, denominator] = [Number(fraction[1]), Number(fraction[2])]
    if (denominator <= 1) return 'fraction written over 1'
    if (gcd(numerator, denominator) !== 1) return 'fraction not in simplest form'
  }
  return null
}

/**
 * Independent oracle: reads only the rendered prompt, never `parameters` or the
 * generator's own arithmetic, so a repaired seed that now produces a *different*
 * question still has to produce the right answer to that question.
 */
function oracle(itemType: string, prompt: string): string {
  const grab = (expression: RegExp) => { const m = expression.exec(prompt); if (!m) throw new Error(`prompt did not parse: ${prompt}`); return m }
  const rational = (numerator: number, denominator: number) => {
    if (denominator < 0) { numerator = -numerator; denominator = -denominator }
    const divisor = gcd(numerator, denominator) || 1
    return denominator / divisor === 1 ? String(numerator / divisor) : `${numerator / divisor}/${denominator / divisor}`
  }
  switch (itemType) {
    case 'multi-step-numerical-problem': { const m = grab(/buys (\d+) passes at \$(\d+) each and pays a \$(\d+) service/); return `$${Number(m[1]) * Number(m[2]) + Number(m[3])}` }
    case 'two-step-equation': { const m = grab(/Solve (-?\d+)x ([+-]) (\d+) = (-?\d+)/); return rational(Number(m[4]) - (m[2] === '-' ? -1 : 1) * Number(m[3]), Number(m[1])) }
    case 'two-step-inequality': { const m = grab(/Solve (-?\d+)x \+ (\d+) (≥|≤) (-?\d+)\./); const a = Number(m[1]); const sign = a < 0 ? (m[3] === '≥' ? '≤' : '≥') : m[3]; return `x ${sign} ${(Number(m[4]) - Number(m[2])) / a}` }
    case 'solution-set': { const m = grab(/satisfies (\d+)x \+ (\d+) ≥ (\d+) and x < (\d+)\?/); return String((Number(m[3]) - Number(m[2])) / Number(m[1])) }
    case 'graph-inequality': { const m = grab(/x (≥|≤) (\d+)\?/); return `closed circle at ${m[2]}, shaded ${m[1] === '≥' ? 'right' : 'left'}` }
    case 'check-and-interpret-solution': { const m = grab(/charges \$(\d+) plus \$(\d+) per session for a total of \$(\d+)/); return String((Number(m[3]) - Number(m[1])) / Number(m[2])) }
    default: throw new Error(`no oracle for ${itemType}`)
  }
}

function assertSoundItem(question: { itemType: string; prompt: string; choices: string[]; answerIndex: number }) {
  const answer = question.choices[question.answerIndex]
  expect(question.choices, question.prompt).toHaveLength(4)
  expect(new Set(question.choices).size, `duplicate choice in ${JSON.stringify(question.choices)}`).toBe(4)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(4)
  expect(question.choices.filter((choice) => choice === answer), `correct answer repeated in ${JSON.stringify(question.choices)}`).toHaveLength(1)
  expect(answer, question.prompt).toBe(oracle(question.itemType, question.prompt))
  for (const choice of question.choices)
    expect(policyViolation(question.itemType, choice), `${question.itemType} "${question.prompt}" choice ${JSON.stringify(choice)} violates the distractor format policy`).toBeNull()
}

/**
 * The three difficulty-2 `two-step-equation` seeds an independent review recorded
 * as distinct-choice collapses. `finishDistinctChoices` fails closed, so before
 * this card each of these threw straight out of the generator and would have
 * surfaced to a learner as an unhandled failure.
 */
const HISTORICAL_COLLAPSE_SEEDS = [48_422, 48_449, 48_476] as const

describe('Grade 7 Unit 4 distractor corrections', () => {
  it('generates the three historical difficulty-2 collapse seeds without throwing', () => {
    for (const seed of HISTORICAL_COLLAPSE_SEEDS) {
      setRng(seededRng(seed))
      const question = generateGrade7MathUnit4Question('two-step-equation', 2)
      assertSoundItem(question)
    }
  })

  it('sweeps 10,000 seeded draws of every item type at every difficulty with zero defects', () => {
    let draws = 0
    const throws: string[] = []
    const duplicates: string[] = []
    const violations: string[] = []
    let maxDecimals = 0
    for (const [index, itemType] of GRADE7_MATH_UNIT4_ITEM_TYPES.entries())
      for (const difficulty of [1, 2, 3] as const) {
        setRng(seededRng(0xce5c_0000 + index * 31 + difficulty))
        for (let run = 0; run < 10_000; run++) {
          draws++
          try {
            const question = generateGrade7MathUnit4Question(itemType, difficulty)
            const answer = curriculumAnswer(question)
            if (new Set(question.choices).size !== 4) duplicates.push(`${itemType} d${difficulty} ${JSON.stringify(question.choices)}`)
            if (question.choices.filter((choice) => choice === answer).length !== 1) duplicates.push(`${itemType} d${difficulty} repeated answer ${JSON.stringify(question.choices)}`)
            if (answer !== oracle(itemType, question.prompt)) violations.push(`${itemType} d${difficulty} wrong answer for "${question.prompt}": ${answer}`)
            for (const choice of question.choices) {
              for (const decimals of choice.matchAll(/\d+\.(\d+)/g)) maxDecimals = Math.max(maxDecimals, decimals[1].length)
              const violation = policyViolation(itemType, choice)
              if (violation) violations.push(`${itemType} d${difficulty} ${JSON.stringify(choice)}: ${violation}`)
            }
          } catch (error) { throws.push(`${itemType} d${difficulty} run ${run}: ${(error as Error).message}`) }
        }
      }
    const evidence = [...throws.slice(0, 3), ...duplicates.slice(0, 3), ...violations.slice(0, 3)].join('\n  ')
    expect(
      { draws, throws: throws.length, duplicateDraws: duplicates.length, violations: violations.length, maxDecimals },
      `first offenders:\n  ${evidence}`,
    ).toEqual({ draws: 180_000, throws: 0, duplicateDraws: 0, violations: 0, maxDecimals: 0 })
  })

  it('offers the pedagogically named errors as distractors', () => {
    // `two-step-equation` must still offer "forgot to divide" (c - b) and must now
    // also offer a sign error; `check-and-interpret-solution` must still offer the
    // dollars-spent-on-sessions interpretation error rather than a raw quotient.
    const seen = { forgotToDivide: 0, signError: 0, dollarsNotSessions: 0 }
    for (const difficulty of [1, 2] as const) {
      setRng(seededRng(0xd1_5720 + difficulty))
      for (let run = 0; run < 2_000; run++) {
        const equation = generateGrade7MathUnit4Question('two-step-equation', difficulty)
        const { a, b, c, solution } = equation.parameters
        if (equation.choices.includes(String(c - b))) seen.forgotToDivide++
        if (equation.choices.includes(String(-solution))) seen.signError++
        void a
        const interpret = generateGrade7MathUnit4Question('check-and-interpret-solution', difficulty)
        if (interpret.choices.includes(String(interpret.parameters.c - interpret.parameters.b))) seen.dollarsNotSessions++
      }
    }
    expect(seen.forgotToDivide).toBeGreaterThan(1_000)
    expect(seen.signError).toBeGreaterThan(1_000)
    expect(seen.dollarsNotSessions).toBeGreaterThan(1_000)
  })
})

/**
 * Baselines captured at e1522f3aaed2e4162f0d17462e34d4af046f2716, before any
 * distractor was touched. The digest below covers prompt, correct answer,
 * standard, lessonFocus, difficulty and parameters for 90,000 independently
 * seeded draws, so it breaks if this card moved a single prompt or answer.
 */
const U4_INVARIANCE_DIGEST = '5c8c7779c8513081a91c99a704907f3b20e5dc82c2c6356ccc78ce601cc04223'
const U4_WORKED_EXAMPLE_DIGEST = 'e78dcbc227d7d8cd502eb1274c89de4812a8b7be85e017892f1ac64c835260e3'
/**
 * Re-anchored at integration, and deliberately not to e1522f3 like the two digests
 * above. This guard exists to prove the Unit 4 distractor work does not perturb
 * Unit 3, and it still does. But it is a digest of Unit 3's *output*, and on this
 * branch Unit 3 is the corrected generator: the Unit 3 card landed at 1cf141f and
 * intentionally changed that output, so the e1522f3 value it originally pinned
 * describes a Unit 3 that no longer exists here and would fail for the one reason
 * this test is not meant to detect.
 *
 * Re-anchored a second time for the same reason, at the final Grade 7 integration.
 * The Unit 3 positive-cost card deliberately changed Unit 3's output again — that
 * is its whole purpose — so the value this guard pinned before it now describes a
 * Unit 3 that again no longer exists here.
 *
 * The value below is Unit 3 with that card applied and nothing else, so the guard
 * keeps its meaning: it still fails if Unit 4 work — or Unit 7 or Unit 10 work —
 * moves Unit 3. Ownership is checkable rather than asserted, and was checked two
 * independent ways rather than re-baselined from a failing run:
 *
 * - By import closure. Unit 3 generation imports only ../types, ../genUtils and
 *   ./generatorCore; generatorCore imports only ../types and ../genUtils; genUtils
 *   imports only ./types. Across that closure the single blob that differs between
 *   the pre-integration base and the Unit 3 card is grade7MathUnit3Generator.ts,
 *   and every blob in it is byte-identical between that card and this branch tip.
 *   The Unit 4, Unit 7 and Unit 10 cards touch grade7MathUnit4Generator.ts,
 *   grade7MathUnit7Generator.ts, grade7MathUnit10Generator.ts and test files, none
 *   of which the closure contains.
 * - By execution. Replaying this exact 9,000-draw recipe against the Unit 3 card
 *   alone and against this branch tip yields the same digest, and replaying it
 *   against the pre-integration base reproduces the value this constant held
 *   before, which is what shows the recipe was replayed faithfully.
 *
 * grade7MathWorkedExamples.test.ts confirms the same thing from the other side: its
 * six `u3:` digests are the Unit 3 values, one of them re-taken by that same card.
 */
const U3_UNTOUCHED_DIGEST = '0c948f49355dfb5f0d19b5e8a68eab72d218a3c92eb4fa73ead0c85f0a02be72'

/**
 * The eleven draws inside that 90,000-draw sample that threw before this card.
 * They are the only records the digest cannot compare directly, because before
 * the fix they produced no prompt and no answer at all. Each one is separately
 * asserted below to now generate a sound item.
 */
const PRE_FIX_COLLAPSE_DRAWS: ReadonlyArray<readonly [string, Difficulty, number]> = [
  ['two-step-equation', 2, 4_182],
  ['two-step-equation', 2, 4_209],
  ['two-step-equation', 2, 4_236],
  ['two-step-equation', 2, 4_263],
  ['two-step-equation', 2, 4_290],
  ['two-step-equation', 2, 4_317],
  ['two-step-equation', 2, 4_344],
  ['two-step-equation', 2, 4_371],
  ['two-step-equation', 2, 4_398],
  ['two-step-equation', 2, 4_425],
  ['two-step-equation', 2, 4_452],
]
const invarianceSeed = (index: number, difficulty: Difficulty, seed: number) => 0x5eed_0000 + index * 100_003 + difficulty * 7_919 + seed

describe('Grade 7 Unit 4 corrections leave everything except the defective distractors alone', () => {
  it('reproduces the baseline prompt, correct answer, standard, lessonFocus and parameters of 90,000 draws', () => {
    const collapsed = new Set(PRE_FIX_COLLAPSE_DRAWS.map(([itemType, difficulty, seed]) => `${itemType}|${difficulty}|${seed}`))
    const records: string[] = []
    for (const [index, itemType] of GRADE7_MATH_UNIT4_ITEM_TYPES.entries())
      for (const difficulty of [1, 2, 3] as const)
        for (let seed = 1; seed <= 5_000; seed++) {
          if (collapsed.has(`${itemType}|${difficulty}|${seed}`)) { records.push('THREW'); continue }
          setRng(seededRng(invarianceSeed(index, difficulty, seed)))
          const question = generateGrade7MathUnit4Question(itemType, difficulty)
          records.push([question.itemType, question.difficulty, question.standard, question.lessonFocus, question.prompt, curriculumAnswer(question), JSON.stringify(question.parameters)].join('|'))
        }
    expect(records).toHaveLength(90_000)
    expect(digest(records)).toBe(U4_INVARIANCE_DIGEST)
  })

  it('repairs every draw that used to collapse, into a sound item with the right answer', () => {
    for (const [itemType, difficulty, seed] of PRE_FIX_COLLAPSE_DRAWS) {
      const index = GRADE7_MATH_UNIT4_ITEM_TYPES.indexOf(itemType as never)
      setRng(seededRng(invarianceSeed(index, difficulty, seed)))
      assertSoundItem(generateGrade7MathUnit4Question(itemType as never, difficulty))
    }
  })

  it('leaves every Unit 4 worked example byte-identical', () => {
    expect(digest([JSON.stringify(GRADE7_MATH_UNIT4_ITEM_DEFINITIONS)])).toBe(U4_WORKED_EXAMPLE_DIGEST)
  })

  it('leaves Unit 3 generation untouched, choices included', () => {
    const records: string[] = []
    for (const [index, itemType] of GRADE7_MATH_UNIT3_ITEM_TYPES.entries())
      for (const difficulty of [1, 2, 3] as const)
        for (let seed = 1; seed <= 500; seed++) {
          setRng(seededRng(0x3_0000 + index * 1_009 + difficulty * 97 + seed))
          const question = generateGrade7MathUnit3Question(itemType as never, difficulty)
          records.push([question.itemType, question.difficulty, question.standard, question.lessonFocus, question.prompt, curriculumAnswer(question), [...question.choices].sort().join('~')].join('|'))
        }
    expect(digest(records)).toBe(U3_UNTOUCHED_DIGEST)
  })
})
