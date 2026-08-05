import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE8_MATH_UNIT1_ITEM_TYPES,
  generateGrade8MathUnit1Question,
  type Grade8MathUnit1Question,
} from './grade8MathUnit1Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function requiredMatch(text: string, pattern: RegExp): RegExpMatchArray {
  const match = text.match(pattern)
  if (!match)
    throw new Error(`Prompt did not match independent oracle grammar: ${text}`)
  return match
}

// ---------------------------------------------------------------------------
// Independent re-derivations. These never call into the generator's helper
// functions -- they are separate implementations of the same well-defined
// mathematical facts, applied only to the rendered prompt/choice text.
// ---------------------------------------------------------------------------

function ownIntegerSqrtFloor(n: number): number {
  let k = 0
  while ((k + 1) * (k + 1) <= n) k++
  return k
}

function ownIsPerfectSquare(n: number): boolean {
  return ownIntegerSqrtFloor(n) ** 2 === n
}

function ownNearestMultipleOfSqrt(radicand: number, scale: number): number {
  let m = 0
  while ((2 * m + 1) ** 2 < 4 * scale * scale * radicand) m++
  return m
}

function ownGcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : ownGcd(b, a % b)
}

function ownReduce(p: number, q: number): { p: number; q: number } {
  const g = ownGcd(p, q) || 1
  return { p: p / g, q: q / g }
}

/** Smallest period of a purely repeating digit string, independent of how it was built. */
function ownRepeatingBlock(digits: string): string {
  for (let len = 1; len <= digits.length / 2; len++) {
    if (digits.length % len !== 0) continue
    const block = digits.slice(0, len)
    if (block.repeat(digits.length / len) === digits) return block
  }
  return digits
}

function ownFractionFromRepeatingBlock(block: string): { p: number; q: number } {
  return ownReduce(Number(block), 10 ** block.length - 1)
}

function ownParseRealValue(display: string): { squareNum: number; squareDen: number } {
  let m = display.match(/^√(\d+)$/)
  if (m) return { squareNum: Number(m[1]), squareDen: 1 }
  m = display.match(/^(\d+)\/(\d+)$/)
  if (m) return { squareNum: Number(m[1]) ** 2, squareDen: Number(m[2]) ** 2 }
  m = display.match(/^(\d+)$/)
  if (m) return { squareNum: Number(m[1]) ** 2, squareDen: 1 }
  throw new Error(`Unparseable real value display: ${display}`)
}

function ownCompareDisplays(a: string, b: string): number {
  const left = ownParseRealValue(a)
  const right = ownParseRealValue(b)
  const l = left.squareNum * right.squareDen
  const r = right.squareNum * left.squareDen
  return l === r ? 0 : l < r ? -1 : 1
}

/** Uses only rendered prompt text; it never reads question.parameters or generator helpers. */
function oracleAnswer(question: Grade8MathUnit1Question): string {
  switch (question.itemType) {
    case 'classify-rational-or-irrational': {
      const [, display] = requiredMatch(
        question.prompt,
        /^Classify (.+) as rational or irrational\.$/,
      )
      if (display === 'π') return 'irrational'
      let m = display.match(/^√(\d+)$/)
      if (m) return ownIsPerfectSquare(Number(m[1])) ? 'rational' : 'irrational'
      if (display.includes('...')) {
        const digits = requiredMatch(display, /^0\.(\d+)\.\.\.$/)[1]
        const block = ownRepeatingBlock(digits)
        expect(block.length).toBeLessThan(digits.length)
        return 'rational'
      }
      if (/^-?\d+\/\d+$/.test(display)) return 'rational'
      if (/^-?\d+(\.\d+)?$/.test(display)) return 'rational'
      throw new Error(`Unrecognized number form: ${display}`)
    }
    case 'closure-classification': {
      const [, qualifier, fraction, operationPhrase, radicand] = requiredMatch(
        question.prompt,
        /^A (nonzero )?rational number \((-?\d+\/\d+)\) is (added to|multiplied by) an irrational number \(√(\d+)\)\. Is the result rational or irrational\?$/,
      )
      expect(ownIsPerfectSquare(Number(radicand))).toBe(false)
      const [num] = fraction.split('/')
      if (operationPhrase === 'multiplied by') {
        expect(qualifier).toBe('nonzero ')
        expect(Number(num)).not.toBe(0)
      }
      return 'irrational'
    }
    case 'repeating-decimal-to-fraction': {
      const [, decimalDisplay] = requiredMatch(
        question.prompt,
        /^Write (0\.\d+\.\.\.) as a fraction in lowest terms\.$/,
      )
      const digits = requiredMatch(decimalDisplay, /^0\.(\d+)\.\.\.$/)[1]
      const block = ownRepeatingBlock(digits)
      const fraction = ownFractionFromRepeatingBlock(block)
      return `${fraction.p}/${fraction.q}`
    }
    case 'repeating-decimal-error-analysis': {
      const [, decimalDisplay, claimedFraction] = requiredMatch(
        question.prompt,
        /^A student writes (0\.\d+\.\.\.) = (-?\d+\/\d+)\. Which statement best analyzes the claim\?$/,
      )
      const digits = requiredMatch(decimalDisplay, /^0\.(\d+)\.\.\.$/)[1]
      const block = ownRepeatingBlock(digits)
      const fraction = ownFractionFromRepeatingBlock(block)
      const claimedDenominator = Number(claimedFraction.split('/')[1])
      expect(claimedDenominator).toBe(10 ** block.length)
      return `The correct fraction is ${fraction.p}/${fraction.q}; the denominator should be ${10 ** block.length - 1} (nine repeated once per repeating digit), not ${claimedDenominator}.`
    }
    case 'consecutive-integers-for-root': {
      const [, radicand] = requiredMatch(
        question.prompt,
        /^Between which two consecutive whole numbers does √(\d+) lie\?$/,
      )
      const n = Number(radicand)
      const k = ownIntegerSqrtFloor(n)
      expect(k * k).toBeLessThan(n)
      expect(n).toBeLessThan((k + 1) * (k + 1))
      return `${k} and ${k + 1}`
    }
    case 'nearest-tenth-for-root': {
      const [, radicand] = requiredMatch(
        question.prompt,
        /^Estimate √(\d+) to the nearest tenth\.$/,
      )
      const m = ownNearestMultipleOfSqrt(Number(radicand), 10)
      return (m / 10).toFixed(1)
    }
    case 'locate-root-on-number-line': {
      const [, p0, p1, p2, p3, radicand] = requiredMatch(
        question.prompt,
        /^On the number line, points A, B, C, and D are located at (-?\d+), (-?\d+), (-?\d+), (-?\d+)\. Which point is closest to √(\d+)\?$/,
      )
      const points = [p0, p1, p2, p3].map(Number)
      expect(points[1]).toBe(points[0] + 1)
      expect(points[2]).toBe(points[1] + 1)
      expect(points[3]).toBe(points[2] + 1)
      const nearest = ownNearestMultipleOfSqrt(Number(radicand), 1)
      const index = points.indexOf(nearest)
      expect(index).toBeGreaterThanOrEqual(0)
      return ['A', 'B', 'C', 'D'][index]
    }
    case 'compare-real-numbers': {
      const [, left, right] = requiredMatch(
        question.prompt,
        /^Compare (.+) and (.+)\.$/,
      )
      const relation = ownCompareDisplays(left, right) > 0 ? '>' : '<'
      return `${left} ${relation} ${right}`
    }
    case 'order-real-numbers': {
      const [, listText] = requiredMatch(
        question.prompt,
        /^Order (.+) from least to greatest\.$/,
      )
      const displays = listText.split(', ')
      expect(displays.length).toBe(3)
      const sorted = [...displays].sort(ownCompareDisplays)
      return sorted.join(' < ')
    }
    case 'estimate-root-expression': {
      const [, radicand, operation, offset] = requiredMatch(
        question.prompt,
        /^Which whole number is closest to √(\d+) ([+-]) (\d+)\?$/,
      )
      const nearest = ownNearestMultipleOfSqrt(Number(radicand), 1)
      return String(
        operation === '+' ? nearest + Number(offset) : nearest - Number(offset),
      )
    }
    case 'real-number-word-problem': {
      const [, radicand, , unit] = requiredMatch(
        question.prompt,
        /^A square garden has an area of (\d+) square ((meters|feet|inches))\. Between which two consecutive whole numbers of \2 is the side length\?$/,
      )
      void unit
      const n = Number(radicand)
      const k = ownIntegerSqrtFloor(n)
      return `${k} and ${k + 1}`
    }
    case 'root-comparison-error-analysis': {
      const [, radicand, rel1, compared, radicand2, rel2, compared2] =
        requiredMatch(
          question.prompt,
          /^A student claims √(\d+) (>|<) (\d+) because (\d+) (>|<) (\d+)\. Which statement correctly analyzes the claim\?$/,
        )
      expect(radicand2).toBe(radicand)
      expect(rel2).toBe(rel1)
      expect(compared2).toBe(compared)
      const n = Number(radicand)
      const m = Number(compared)
      expect(n).toBeGreaterThan(m)
      expect(n).toBeLessThan(m * m)
      expect(rel1).toBe('>')
      return `The claim is incorrect; since ${n} < ${m}² = ${m * m}, √${n} < ${m}.`
    }
    default: {
      const exhaustive: never = question
      throw new Error(`Unhandled item type: ${JSON.stringify(exhaustive)}`)
    }
  }
}

describe('generateGrade8MathUnit1Question', () => {
  for (const itemType of GRADE8_MATH_UNIT1_ITEM_TYPES) {
    it(`matches an independent oracle for ${itemType} across difficulties`, () => {
      for (const difficulty of [1, 2, 3] as const) {
        setRng(
          seededRng(0xc12_0001 + difficulty * 97 + itemType.length * 131),
        )
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade8MathUnit1Question(itemType, difficulty)
          expect(question.choices).toContain(curriculumAnswer(question))
          expect(new Set(question.choices).size).toBe(question.choices.length)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
        }
      }
    })
  }

  it('presents both rational and irrational classifications', () => {
    setRng(seededRng(0xc12_1001))
    const seen = new Set<string>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit1Question(
        'classify-rational-or-irrational',
        2,
      )
      seen.add(curriculumAnswer(question))
    }
    expect(seen).toEqual(new Set(['rational', 'irrational']))
  })

  it('presents both addition and multiplication closure modes', () => {
    setRng(seededRng(0xc12_1002))
    const modes = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const question = generateGrade8MathUnit1Question(
        'closure-classification',
        2,
      )
      modes.add(question.parameters.mode)
    }
    expect(modes).toEqual(new Set(['sum', 'product']))
  })

  it('presents both + and - offsets for estimate-root-expression', () => {
    setRng(seededRng(0xc12_1003))
    const operations = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const question = generateGrade8MathUnit1Question(
        'estimate-root-expression',
        2,
      )
      operations.add(question.parameters.operation)
    }
    expect(operations).toEqual(new Set(['+', '-']))
  })

  it('always presents a genuinely wrong claim in both error-analysis types', () => {
    setRng(seededRng(0xc12_1004))
    for (let run = 0; run < 300; run++) {
      const repeating = generateGrade8MathUnit1Question(
        'repeating-decimal-error-analysis',
        3,
      )
      const digits = requiredMatch(
        repeating.parameters.decimalDisplay,
        /^0\.(\d+)\.\.\.$/,
      )[1]
      const block = ownRepeatingBlock(digits)
      const correct = ownFractionFromRepeatingBlock(block)
      const [claimedP, claimedQ] = repeating.parameters.claimedFraction
        .split('/')
        .map(Number)
      expect(`${claimedP}/${claimedQ}`).not.toBe(`${correct.p}/${correct.q}`)

      const comparison = generateGrade8MathUnit1Question(
        'root-comparison-error-analysis',
        3,
      )
      expect(comparison.parameters.radicand).toBeLessThan(
        comparison.parameters.compared ** 2,
      )
      expect(comparison.parameters.radicand).toBeGreaterThan(
        comparison.parameters.compared,
      )
    }
  })

  it('never lets order-real-numbers or compare-real-numbers tie', () => {
    setRng(seededRng(0xc12_1005))
    for (let run = 0; run < 300; run++) {
      const compare = generateGrade8MathUnit1Question('compare-real-numbers', 3)
      expect(['>', '<']).toContain(compare.parameters.relation)

      const order = generateGrade8MathUnit1Question('order-real-numbers', 3)
      expect(new Set(order.parameters.displays).size).toBe(3)
    }
  })
})
