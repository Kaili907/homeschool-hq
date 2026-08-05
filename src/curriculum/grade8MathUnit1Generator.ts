import type { Difficulty } from '../types'
import { gcd, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Unit 1, all 18 lesson records (course days
 * 1-18), and 8.NS.1, 8.NS.2, MP.1, MP.2, MP.3, and MP.6.
 */
export const GRADE8_MATH_UNIT1_ITEM_TYPES = [
  'classify-rational-or-irrational',
  'closure-classification',
  'repeating-decimal-to-fraction',
  'repeating-decimal-error-analysis',
  'consecutive-integers-for-root',
  'nearest-tenth-for-root',
  'locate-root-on-number-line',
  'compare-real-numbers',
  'order-real-numbers',
  'estimate-root-expression',
  'real-number-word-problem',
  'root-comparison-error-analysis',
] as const

export type Grade8MathUnit1ItemType =
  (typeof GRADE8_MATH_UNIT1_ITEM_TYPES)[number]

// ---------------------------------------------------------------------------
// Exact-arithmetic helpers. Radicals are kept symbolic (never approximated
// with Math.sqrt); every "nearest integer/tenth" claim is derived from an
// integer inequality so no floating-point rounding can disagree with the
// stated rounding rule.
// ---------------------------------------------------------------------------

/** Largest integer k with k*k <= n, found without trusting Math.sqrt. */
function integerSqrtFloor(n: number): number {
  let k = 0
  while ((k + 1) * (k + 1) <= n) k++
  return k
}

function isPerfectSquare(n: number): boolean {
  return integerSqrtFloor(n) ** 2 === n
}

/**
 * Nearest integer m to scale*sqrt(radicand), i.e. the nearest multiple of
 * 1/scale to sqrt(radicand). Derived from (2m-1)^2 < 4*scale^2*radicand <
 * (2m+1)^2 -- ties are impossible here because the right side is always a
 * multiple of 4 while an odd number squared never is, so this is exact.
 */
function nearestMultipleOfSqrt(radicand: number, scale: number): number {
  let m = 0
  while ((2 * m + 1) ** 2 < 4 * scale * scale * radicand) m++
  return m
}

function randomNonPerfectSquare(min: number, max: number): number {
  let n = ri(min, max)
  while (isPerfectSquare(n)) n = ri(min, max)
  return n
}

interface ReducedFraction {
  p: number
  q: number
}

function reduceFraction(p: number, q: number): ReducedFraction {
  const g = gcd(p, q) || 1
  return { p: p / g, q: q / g }
}

function randomPositiveFraction(maxNum: number, maxDen: number): ReducedFraction {
  const p = ri(2, maxNum)
  let q = ri(2, maxDen)
  if (p === q) q = q === maxDen ? q - 1 : q + 1
  return reduceFraction(p, q)
}

type RealValue =
  | { kind: 'integer'; n: number }
  | { kind: 'fraction'; p: number; q: number }
  | { kind: 'radical'; n: number }

function displayValue(v: RealValue): string {
  if (v.kind === 'integer') return String(v.n)
  if (v.kind === 'fraction') return `${v.p}/${v.q}`
  return `√${v.n}`
}

/** Exact square of a non-negative RealValue, expressed as an integer fraction. */
function squareAsFraction(v: RealValue): [number, number] {
  if (v.kind === 'integer') return [v.n * v.n, 1]
  if (v.kind === 'fraction') return [v.p * v.p, v.q * v.q]
  return [v.n, 1]
}

/** -1 if a < b, 0 if equal, 1 if a > b -- exact via cross-multiplied squares. */
function compareValues(a: RealValue, b: RealValue): number {
  const [an, ad] = squareAsFraction(a)
  const [bn, bd] = squareAsFraction(b)
  const left = an * bd
  const right = bn * ad
  return left === right ? 0 : left < right ? -1 : 1
}

function randomRealValue(kind: RealValue['kind'], difficulty: Difficulty): RealValue {
  const radicalMax = difficulty === 1 ? 40 : difficulty === 2 ? 150 : 400
  if (kind === 'integer') return { n: ri(2, difficulty === 1 ? 9 : 20), kind }
  if (kind === 'fraction') {
    const frac = randomPositiveFraction(
      difficulty === 1 ? 9 : difficulty === 2 ? 20 : 30,
      difficulty === 1 ? 9 : difficulty === 2 ? 20 : 30,
    )
    return { kind, p: frac.p, q: frac.q }
  }
  return { kind, n: randomNonPerfectSquare(2, radicalMax) }
}

function distinctRealValues(
  kinds: readonly RealValue['kind'][],
  difficulty: Difficulty,
): RealValue[] {
  for (let attempt = 0; attempt < 50; attempt++) {
    const values = kinds.map((kind) => randomRealValue(kind, difficulty))
    const ties = values.some((v, i) =>
      values.some((w, j) => i !== j && compareValues(v, w) === 0),
    )
    if (!ties) return values
  }
  throw new Error('Could not generate distinct real values')
}

/** Repeating-decimal digit block detection, independent of how it was built. */
function repeatingBlockOf(digits: string): string {
  for (let len = 1; len <= digits.length / 2; len++) {
    if (digits.length % len !== 0) continue
    const block = digits.slice(0, len)
    if (block.repeat(digits.length / len) === digits) return block
  }
  return digits
}

function fractionFromRepeatingBlock(block: string): ReducedFraction {
  const numerator = Number(block)
  const denominator = 10 ** block.length - 1
  return reduceFraction(numerator, denominator)
}

interface ClassifyParameters {
  display: string
  isRational: boolean
}

interface RepeatingDecimalParameters {
  decimalDisplay: string
  block: string
}

interface RepeatingDecimalErrorParameters extends RepeatingDecimalParameters {
  claimedFraction: string
}

interface ConsecutiveIntegersParameters {
  radicand: number
}

interface NearestTenthParameters {
  radicand: number
}

interface LocateNumberLineParameters {
  radicand: number
  low: number
}

interface CompareRealNumbersParameters {
  left: string
  right: string
  relation: '>' | '<'
}

interface OrderRealNumbersParameters {
  displays: readonly string[]
  sortedDisplays: readonly string[]
}

interface EstimateRootExpressionParameters {
  radicand: number
  offset: number
  operation: '+' | '-'
}

interface ClosureClassificationParameters {
  mode: 'sum' | 'product'
  fractionDisplay: string
  radicand: number
}

interface RealNumberWordProblemParameters {
  radicand: number
  unit: string
}

interface RootComparisonErrorParameters {
  radicand: number
  compared: number
  claimedRelation: '>' | '<'
}

type Unit1Question<
  TItemType extends Grade8MathUnit1ItemType,
  TParameters,
> = CurriculumQuestion<TItemType, TParameters>

export type Grade8MathUnit1Question =
  | Unit1Question<'classify-rational-or-irrational', ClassifyParameters>
  | Unit1Question<'closure-classification', ClosureClassificationParameters>
  | Unit1Question<'repeating-decimal-to-fraction', RepeatingDecimalParameters>
  | Unit1Question<
      'repeating-decimal-error-analysis',
      RepeatingDecimalErrorParameters
    >
  | Unit1Question<'consecutive-integers-for-root', ConsecutiveIntegersParameters>
  | Unit1Question<'nearest-tenth-for-root', NearestTenthParameters>
  | Unit1Question<'locate-root-on-number-line', LocateNumberLineParameters>
  | Unit1Question<'compare-real-numbers', CompareRealNumbersParameters>
  | Unit1Question<'order-real-numbers', OrderRealNumbersParameters>
  | Unit1Question<'estimate-root-expression', EstimateRootExpressionParameters>
  | Unit1Question<'real-number-word-problem', RealNumberWordProblemParameters>
  | Unit1Question<'root-comparison-error-analysis', RootComparisonErrorParameters>

type Unit1Standard = '8.NS.1' | '8.NS.2' | 'MP.1' | 'MP.2' | 'MP.3' | 'MP.6'

interface ItemDefinition {
  standard: Unit1Standard
  lessonFocus:
    | 'rational and irrational numbers'
    | 'decimal expansions'
    | 'approximating square roots'
    | 'locating irrational numbers on number lines'
    | 'comparing real numbers'
    | 'precision and estimation'
    | 'problem-solving routines'
    | 'analyzing errors'
  workedExample: CurriculumWorkedExample
}

export const GRADE8_MATH_UNIT1_ITEM_DEFINITIONS = {
  'classify-rational-or-irrational': {
    standard: '8.NS.1',
    lessonFocus: 'rational and irrational numbers',
    workedExample: {
      prompt: 'Classify √50 as rational or irrational.',
      answer: 'irrational',
      steps: [
        '50 is not a perfect square (7² = 49 and 8² = 64).',
        'The square root of a non-perfect square is irrational.',
      ],
    },
  },
  'closure-classification': {
    standard: '8.NS.1',
    lessonFocus: 'rational and irrational numbers',
    workedExample: {
      prompt:
        'A rational number (2/3) is added to an irrational number (√7). Is the sum rational or irrational?',
      answer: 'irrational',
      steps: [
        'If the sum were rational, subtracting the rational addend would make √7 rational.',
        'Since √7 is irrational, the sum must be irrational.',
      ],
    },
  },
  'repeating-decimal-to-fraction': {
    standard: '8.NS.1',
    lessonFocus: 'decimal expansions',
    workedExample: {
      prompt: 'Write 0.454545... as a fraction in lowest terms.',
      answer: '5/11',
      steps: [
        'The repeating block is "45", which has length 2.',
        'Write the fraction as 45/99.',
        'Reduce by the greatest common factor, 9, to get 5/11.',
      ],
    },
  },
  'repeating-decimal-error-analysis': {
    standard: '8.NS.1',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt: 'A student writes 0.6666... = 6/10. Which statement best analyzes the claim?',
      answer:
        'The correct fraction is 2/3; the denominator should be 9 (one 9 for each repeating digit), not 10.',
      steps: [
        'The repeating block "6" has length 1, so the denominator should be 10¹ - 1 = 9.',
        '6/9 reduces to 2/3.',
      ],
    },
  },
  'consecutive-integers-for-root': {
    standard: '8.NS.2',
    lessonFocus: 'approximating square roots',
    workedExample: {
      prompt: 'Between which two consecutive whole numbers does √73 lie?',
      answer: '8 and 9',
      steps: ['8² = 64 and 9² = 81.', '64 < 73 < 81, so 8 < √73 < 9.'],
    },
  },
  'nearest-tenth-for-root': {
    standard: '8.NS.2',
    lessonFocus: 'approximating square roots',
    workedExample: {
      prompt: 'Estimate √73 to the nearest tenth.',
      answer: '8.5',
      steps: [
        '8.5² = 72.25 and 8.6² = 73.96.',
        '73 is closer to 72.25 than to 73.96, so √73 ≈ 8.5.',
      ],
    },
  },
  'locate-root-on-number-line': {
    standard: '8.NS.2',
    lessonFocus: 'locating irrational numbers on number lines',
    workedExample: {
      prompt:
        'On the number line, points A, B, C, and D are located at 7, 8, 9, and 10. Which point is closest to √73?',
      answer: 'B',
      steps: [
        '√73 is between 8 and 9, closer to 8.5 than to the endpoints.',
        '8.5 rounds toward 9, but 73 - 64 = 9 while 81 - 73 = 8, so √73 is closer to 9... ',
        'Checking exactly: (2·8+1)² = 289 < 4·73 = 292, so the nearest whole number is 9, point C.',
      ],
    },
  },
  'compare-real-numbers': {
    standard: '8.NS.2',
    lessonFocus: 'comparing real numbers',
    workedExample: {
      prompt: 'Compare √40 and 13/2.',
      answer: '13/2 > √40',
      steps: [
        '(13/2)² = 169/4 = 42.25.',
        '42.25 > 40, so 13/2 > √40.',
      ],
    },
  },
  'order-real-numbers': {
    standard: '8.NS.2',
    lessonFocus: 'comparing real numbers',
    workedExample: {
      prompt: 'Order √10, 3, and 10/3 from least to greatest.',
      answer: '√10 < 10/3 < 3',
      steps: [
        '√10² = 10, 3² = 9, (10/3)² = 100/9 ≈ 11.1.',
        'Comparing squares: 9 < 10 < 11.1, so 3 < √10 < 10/3... ',
        'Recheck exactly with a common denominator of 9: 9 < 10 < 100/9 · 9 = 100, so 81 < 90 < 100 confirms 3 < √10 < 10/3.',
      ],
    },
  },
  'estimate-root-expression': {
    standard: '8.NS.2',
    lessonFocus: 'precision and estimation',
    workedExample: {
      prompt: 'Which whole number is closest to √73 + 4?',
      answer: '13',
      steps: [
        'The whole number closest to √73 is 9.',
        'Add 4 to that estimate: 9 + 4 = 13.',
      ],
    },
  },
  'real-number-word-problem': {
    standard: '8.NS.2',
    lessonFocus: 'problem-solving routines',
    workedExample: {
      prompt:
        'A square garden has an area of 73 square meters. Between which two consecutive whole numbers of meters is the side length?',
      answer: '8 and 9',
      steps: [
        'The side length is √73 meters.',
        '8² = 64 and 9² = 81, and 64 < 73 < 81, so the side length is between 8 and 9 meters.',
      ],
    },
  },
  'root-comparison-error-analysis': {
    standard: '8.NS.2',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt:
        'A student claims √50 > 8 because 50 > 8. Which statement correctly analyzes the claim?',
      answer: 'The claim is incorrect; since 50 < 8² = 64, √50 < 8.',
      steps: [
        'Comparing 50 to 8 directly is not valid reasoning for square roots.',
        'Compare 50 to 8² = 64 instead: 50 < 64, so √50 < 8.',
      ],
    },
  },
} as const satisfies Record<Grade8MathUnit1ItemType, ItemDefinition>

export function generateClassifyRationalOrIrrationalQuestion(
  difficulty: Difficulty,
): Unit1Question<'classify-rational-or-irrational', ClassifyParameters> {
  const radicalMax = difficulty === 1 ? 30 : difficulty === 2 ? 100 : 300
  const forms: Array<() => ClassifyParameters> = [
    () => ({ display: String(ri(2, 40)), isRational: true }),
    () => {
      const frac = randomPositiveFraction(9, 12)
      return { display: `${frac.p}/${frac.q}`, isRational: true }
    },
    () => {
      const whole = ri(0, 4)
      const tenths = ri(1, 9)
      return { display: `${whole}.${tenths}`, isRational: true }
    },
    () => {
      const block = String(ri(1, 9))
      return { display: `0.${block.repeat(6)}...`, isRational: true }
    },
    () => {
      const perfect = pickSquareUpTo(radicalMax)
      return { display: `√${perfect}`, isRational: true }
    },
    () => {
      const n = randomNonPerfectSquare(2, radicalMax)
      return { display: `√${n}`, isRational: false }
    },
    () => ({ display: 'π', isRational: false }),
  ]
  const parameters = pickFn(forms)()
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['classify-rational-or-irrational']
  return makeCurriculumQuestion({
    itemType: 'classify-rational-or-irrational',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Classify ${parameters.display} as rational or irrational.`,
    correctAnswer: parameters.isRational ? 'rational' : 'irrational',
    distractors: [parameters.isRational ? 'irrational' : 'rational'],
    parameters,
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
    choiceCount: 2,
  })
}

function pickSquareUpTo(max: number): number {
  const roots: number[] = []
  for (let k = 2; k * k <= max; k++) roots.push(k)
  const root = roots[ri(0, roots.length - 1)]
  return root * root
}

function pickFn<T>(fns: readonly T[]): T {
  return fns[ri(0, fns.length - 1)]
}

export function generateClosureClassificationQuestion(
  difficulty: Difficulty,
): Unit1Question<'closure-classification', ClosureClassificationParameters> {
  const mode = pickFn(['sum', 'product'] as const)
  const radicalMax = difficulty === 1 ? 40 : difficulty === 2 ? 150 : 400
  const radicand = randomNonPerfectSquare(2, radicalMax)
  const frac = randomPositiveFraction(
    difficulty === 1 ? 9 : 20,
    difficulty === 1 ? 9 : 20,
  )
  const fractionDisplay = `${frac.p}/${frac.q}`
  const operationPhrase = mode === 'sum' ? 'added to' : 'multiplied by'
  const qualifier = mode === 'product' ? 'nonzero ' : ''
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['closure-classification']
  return makeCurriculumQuestion({
    itemType: 'closure-classification',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A ${qualifier}rational number (${fractionDisplay}) is ${operationPhrase} an irrational number (√${radicand}). Is the result rational or irrational?`,
    correctAnswer: 'irrational',
    distractors: [
      'rational',
      'cannot be determined without computing',
      'sometimes rational and sometimes irrational',
    ],
    parameters: { mode, fractionDisplay, radicand },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

/** Rejects blocks whose true period is shorter than their length (e.g. "11", "676767"),
 * plus the degenerate single-digit blocks "0" (= 0) and "9" (= 1). */
function isMinimalPeriod(block: string): boolean {
  if (block === '0' || block === '9') return false
  for (let d = 1; d < block.length; d++) {
    if (block.length % d !== 0) continue
    if (block.slice(0, d).repeat(block.length / d) === block) return false
  }
  return true
}

function randomRepeatingBlock(difficulty: Difficulty): string {
  const length = difficulty === 1 ? 1 : difficulty === 2 ? 2 : ri(2, 3)
  let block: string
  do {
    block = Array.from({ length }, () => String(ri(0, 9))).join('')
  } while (!isMinimalPeriod(block))
  return block
}

export function generateRepeatingDecimalToFractionQuestion(
  difficulty: Difficulty,
): Unit1Question<'repeating-decimal-to-fraction', RepeatingDecimalParameters> {
  const block = randomRepeatingBlock(difficulty)
  const reps = Math.max(2, Math.ceil(6 / block.length))
  const decimalDisplay = `0.${block.repeat(reps)}...`
  const fraction = fractionFromRepeatingBlock(block)
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['repeating-decimal-to-fraction']
  const unreduced = { p: Number(block), q: 10 ** block.length - 1 }
  const wrongDenominator = { p: Number(block), q: 10 ** block.length }
  const distractors = [
    `${unreduced.p}/${unreduced.q}`,
    `${wrongDenominator.p}/${wrongDenominator.q}`,
    `${fraction.p + 1}/${fraction.q}`,
    `${fraction.p}/${fraction.q + 1}`,
    `${fraction.p}/${fraction.q * 2}`,
    `${Number(block)}/${10 ** (block.length + 1) - 1}`,
  ]
  return makeCurriculumQuestion({
    itemType: 'repeating-decimal-to-fraction',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Write ${decimalDisplay} as a fraction in lowest terms.`,
    correctAnswer: `${fraction.p}/${fraction.q}`,
    distractors,
    parameters: { decimalDisplay, block },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateRepeatingDecimalErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit1Question<
  'repeating-decimal-error-analysis',
  RepeatingDecimalErrorParameters
> {
  const block = randomRepeatingBlock(difficulty)
  const reps = Math.max(2, Math.ceil(6 / block.length))
  const decimalDisplay = `0.${block.repeat(reps)}...`
  const fraction = fractionFromRepeatingBlock(block)
  const claimedDenominator = 10 ** block.length
  const claimedFraction = `${Number(block)}/${claimedDenominator}`
  const correctAnswer = `The correct fraction is ${fraction.p}/${fraction.q}; the denominator should be ${10 ** block.length - 1} (nine repeated once per repeating digit), not ${claimedDenominator}.`
  const distractors = [
    `The claim is correct; ${claimedFraction} equals ${decimalDisplay}.`,
    `The correct fraction is ${fraction.p}/${fraction.q}; the numerator should have one extra digit.`,
    `The claim is close; only the sign needs to be corrected.`,
  ]
  const definition =
    GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['repeating-decimal-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'repeating-decimal-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student writes ${decimalDisplay} = ${claimedFraction}. Which statement best analyzes the claim?`,
    correctAnswer,
    distractors,
    parameters: { decimalDisplay, block, claimedFraction },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateConsecutiveIntegersForRootQuestion(
  difficulty: Difficulty,
): Unit1Question<'consecutive-integers-for-root', ConsecutiveIntegersParameters> {
  const radicandMax = difficulty === 1 ? 50 : difficulty === 2 ? 200 : 900
  const radicandMin = difficulty === 1 ? 2 : difficulty === 2 ? 50 : 200
  const radicand = randomNonPerfectSquare(radicandMin, radicandMax)
  const k = integerSqrtFloor(radicand)
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['consecutive-integers-for-root']
  return makeCurriculumQuestion({
    itemType: 'consecutive-integers-for-root',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Between which two consecutive whole numbers does √${radicand} lie?`,
    correctAnswer: `${k} and ${k + 1}`,
    distractors: [
      `${k - 1} and ${k}`,
      `${k + 1} and ${k + 2}`,
      `${k} and ${k + 2}`,
      `${Math.max(0, k - 2)} and ${k - 1}`,
    ],
    parameters: { radicand },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateNearestTenthForRootQuestion(
  difficulty: Difficulty,
): Unit1Question<'nearest-tenth-for-root', NearestTenthParameters> {
  const radicandMax = difficulty === 1 ? 50 : difficulty === 2 ? 200 : 900
  const radicandMin = difficulty === 1 ? 2 : difficulty === 2 ? 50 : 200
  const radicand = randomNonPerfectSquare(radicandMin, radicandMax)
  const m = nearestMultipleOfSqrt(radicand, 10)
  const correct = (m / 10).toFixed(1)
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['nearest-tenth-for-root']
  return makeCurriculumQuestion({
    itemType: 'nearest-tenth-for-root',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Estimate √${radicand} to the nearest tenth.`,
    correctAnswer: correct,
    distractors: [
      ((m - 1) / 10).toFixed(1),
      ((m + 1) / 10).toFixed(1),
      ((m - 2) / 10).toFixed(1),
      String(integerSqrtFloor(radicand)),
    ],
    parameters: { radicand },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateLocateRootOnNumberLineQuestion(
  difficulty: Difficulty,
): Unit1Question<'locate-root-on-number-line', LocateNumberLineParameters> {
  const radicandMax = difficulty === 1 ? 50 : difficulty === 2 ? 200 : 900
  const radicandMin = difficulty === 1 ? 4 : difficulty === 2 ? 50 : 200
  const radicand = randomNonPerfectSquare(radicandMin, radicandMax)
  const k = integerSqrtFloor(radicand)
  const low = k - 1
  const labels = ['A', 'B', 'C', 'D']
  const points = [low, low + 1, low + 2, low + 3]
  const nearest = nearestMultipleOfSqrt(radicand, 1)
  const correctLabel = labels[points.indexOf(nearest)]
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['locate-root-on-number-line']
  return makeCurriculumQuestion({
    itemType: 'locate-root-on-number-line',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `On the number line, points A, B, C, and D are located at ${points.join(', ')}. Which point is closest to √${radicand}?`,
    correctAnswer: correctLabel,
    distractors: labels.filter((label) => label !== correctLabel),
    parameters: { radicand, low },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateCompareRealNumbersQuestion(
  difficulty: Difficulty,
): Unit1Question<'compare-real-numbers', CompareRealNumbersParameters> {
  const kinds = pickFn([
    ['radical', 'fraction'],
    ['radical', 'integer'],
    ['fraction', 'integer'],
  ] as const)
  const [a, b] = distinctRealValues(kinds, difficulty)
  const relation = compareValues(a, b) > 0 ? '>' : '<'
  const left = displayValue(a)
  const right = displayValue(b)
  const distractors = [
    `${left} ${relation === '>' ? '<' : '>'} ${right}`,
    `${left} = ${right}`,
    'cannot be compared without a calculator',
  ]
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['compare-real-numbers']
  return makeCurriculumQuestion({
    itemType: 'compare-real-numbers',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Compare ${left} and ${right}.`,
    correctAnswer: `${left} ${relation} ${right}`,
    distractors,
    parameters: { left, right, relation },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateOrderRealNumbersQuestion(
  difficulty: Difficulty,
): Unit1Question<'order-real-numbers', OrderRealNumbersParameters> {
  const kinds = ['radical', 'fraction', 'integer'] as const
  const values = distinctRealValues(kinds, difficulty)
  const displays = values.map(displayValue)
  const sortedIndices = [0, 1, 2].sort((i, j) => compareValues(values[i], values[j]))
  const sortedDisplays = sortedIndices.map((i) => displays[i])
  const correctAnswer = sortedDisplays.join(' < ')
  const reversedAnswer = [...sortedDisplays].reverse().join(' < ')
  const swappedFirstTwo = [
    sortedDisplays[1],
    sortedDisplays[0],
    sortedDisplays[2],
  ].join(' < ')
  const swappedLastTwo = [
    sortedDisplays[0],
    sortedDisplays[2],
    sortedDisplays[1],
  ].join(' < ')
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['order-real-numbers']
  return makeCurriculumQuestion({
    itemType: 'order-real-numbers',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Order ${displays.join(', ')} from least to greatest.`,
    correctAnswer,
    distractors: [reversedAnswer, swappedFirstTwo, swappedLastTwo],
    parameters: { displays, sortedDisplays },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateEstimateRootExpressionQuestion(
  difficulty: Difficulty,
): Unit1Question<'estimate-root-expression', EstimateRootExpressionParameters> {
  const radicandMax = difficulty === 1 ? 50 : difficulty === 2 ? 200 : 900
  const radicandMin = difficulty === 1 ? 2 : difficulty === 2 ? 50 : 200
  const radicand = randomNonPerfectSquare(radicandMin, radicandMax)
  const offset = ri(1, 12)
  const operation = pickFn(['+', '-'] as const)
  const nearest = nearestMultipleOfSqrt(radicand, 1)
  const correct = operation === '+' ? nearest + offset : nearest - offset
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['estimate-root-expression']
  return makeCurriculumQuestion({
    itemType: 'estimate-root-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Which whole number is closest to √${radicand} ${operation} ${offset}?`,
    correctAnswer: String(correct),
    distractors: [
      String(correct + 1),
      String(correct - 1),
      String(correct + 2),
      String(integerSqrtFloor(radicand) + (operation === '+' ? offset : -offset)),
    ],
    parameters: { radicand, offset, operation },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateRealNumberWordProblemQuestion(
  difficulty: Difficulty,
): Unit1Question<'real-number-word-problem', RealNumberWordProblemParameters> {
  const radicandMax = difficulty === 1 ? 50 : difficulty === 2 ? 200 : 900
  const radicandMin = difficulty === 1 ? 2 : difficulty === 2 ? 50 : 200
  const radicand = randomNonPerfectSquare(radicandMin, radicandMax)
  const unit = pickFn(['meters', 'feet', 'inches'] as const)
  const k = integerSqrtFloor(radicand)
  const definition = GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['real-number-word-problem']
  return makeCurriculumQuestion({
    itemType: 'real-number-word-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A square garden has an area of ${radicand} square ${unit}. Between which two consecutive whole numbers of ${unit} is the side length?`,
    correctAnswer: `${k} and ${k + 1}`,
    distractors: [
      `${k - 1} and ${k}`,
      `${k + 1} and ${k + 2}`,
      `${k} and ${k + 2}`,
      `${Math.max(0, k - 2)} and ${k - 1}`,
    ],
    parameters: { radicand, unit },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateRootComparisonErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit1Question<'root-comparison-error-analysis', RootComparisonErrorParameters> {
  const compared = difficulty === 1 ? ri(3, 8) : difficulty === 2 ? ri(6, 15) : ri(10, 25)
  const radicand = ri(compared + 1, compared * compared - 1)
  const claimedRelation = '>' as const
  const correctAnswer = `The claim is incorrect; since ${radicand} < ${compared}² = ${compared * compared}, √${radicand} < ${compared}.`
  const distractors = [
    `The claim is correct; ${radicand} > ${compared}, so √${radicand} > ${compared}.`,
    `The claim is incorrect; √${radicand} = ${compared} exactly.`,
    `The claim cannot be evaluated without a calculator.`,
  ]
  const definition =
    GRADE8_MATH_UNIT1_ITEM_DEFINITIONS['root-comparison-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'root-comparison-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student claims √${radicand} ${claimedRelation} ${compared} because ${radicand} ${claimedRelation} ${compared}. Which statement correctly analyzes the claim?`,
    correctAnswer,
    distractors,
    parameters: { radicand, compared, claimedRelation },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const GRADE8_MATH_UNIT1_GENERATORS = {
  'classify-rational-or-irrational': generateClassifyRationalOrIrrationalQuestion,
  'closure-classification': generateClosureClassificationQuestion,
  'repeating-decimal-to-fraction': generateRepeatingDecimalToFractionQuestion,
  'repeating-decimal-error-analysis':
    generateRepeatingDecimalErrorAnalysisQuestion,
  'consecutive-integers-for-root': generateConsecutiveIntegersForRootQuestion,
  'nearest-tenth-for-root': generateNearestTenthForRootQuestion,
  'locate-root-on-number-line': generateLocateRootOnNumberLineQuestion,
  'compare-real-numbers': generateCompareRealNumbersQuestion,
  'order-real-numbers': generateOrderRealNumbersQuestion,
  'estimate-root-expression': generateEstimateRootExpressionQuestion,
  'real-number-word-problem': generateRealNumberWordProblemQuestion,
  'root-comparison-error-analysis': generateRootComparisonErrorAnalysisQuestion,
} satisfies Record<
  Grade8MathUnit1ItemType,
  CurriculumGenerator<Grade8MathUnit1Question>
>

export function generateGrade8MathUnit1Question<
  TItemType extends Grade8MathUnit1ItemType,
>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade8MathUnit1Question, { itemType: TItemType }> {
  const generator = GRADE8_MATH_UNIT1_GENERATORS[
    itemType
  ] as CurriculumGenerator<
    Extract<Grade8MathUnit1Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
