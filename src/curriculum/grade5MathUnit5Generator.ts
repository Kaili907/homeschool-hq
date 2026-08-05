import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Grade 5 Mathematics Unit 5, course days
 * 73-90, its 18 lesson records, and standards 5.NF.1-2.
 */
export const GRADE5_MATH_UNIT5_ITEM_TYPES = [
  'equivalent-fraction',
  'simplify-fraction',
  'compare-to-benchmark',
  'estimate-fraction-operation',
  'least-common-denominator',
  'rewrite-with-common-denominator',
  'add-unlike-fractions',
  'subtract-unlike-fractions',
  'add-mixed-numbers',
  'subtract-mixed-numbers',
  'addition-word-problem',
  'subtraction-word-problem',
] as const

export type Grade5MathUnit5ItemType = (typeof GRADE5_MATH_UNIT5_ITEM_TYPES)[number]

interface Fraction {
  numerator: number
  denominator: number
}

interface MixedNumber {
  whole: number
  numerator: number
  denominator: number
}

interface EquivalentFractionParameters {
  original: Fraction
  equivalent: Fraction
  missing: 'numerator' | 'denominator'
}

interface SimplifyFractionParameters {
  fraction: Fraction
}

interface CompareToBenchmarkParameters {
  fraction: Fraction
  benchmark: Fraction
}

interface EstimateFractionOperationParameters {
  left: Fraction
  right: Fraction
  operation: 'add' | 'subtract'
}

interface CommonDenominatorParameters {
  leftDenominator: number
  rightDenominator: number
}

interface RewriteWithCommonDenominatorParameters {
  left: Fraction
  right: Fraction
  commonDenominator: number
}

interface FractionOperationParameters {
  left: Fraction
  right: Fraction
}

interface MixedNumberOperationParameters {
  left: MixedNumber
  right: MixedNumber
}

type AdditionContext = 'recipe' | 'trail' | 'ribbon'
type SubtractionContext = 'ribbon' | 'water' | 'trail'

interface AdditionWordProblemParameters extends FractionOperationParameters {
  context: AdditionContext
}

interface SubtractionWordProblemParameters {
  starting: Fraction
  used: Fraction
  context: SubtractionContext
}

type Unit5Question<TItemType extends Grade5MathUnit5ItemType, TParameters> =
  CurriculumQuestion<TItemType, TParameters>

export type Grade5MathUnit5Question =
  | Unit5Question<'equivalent-fraction', EquivalentFractionParameters>
  | Unit5Question<'simplify-fraction', SimplifyFractionParameters>
  | Unit5Question<'compare-to-benchmark', CompareToBenchmarkParameters>
  | Unit5Question<'estimate-fraction-operation', EstimateFractionOperationParameters>
  | Unit5Question<'least-common-denominator', CommonDenominatorParameters>
  | Unit5Question<'rewrite-with-common-denominator', RewriteWithCommonDenominatorParameters>
  | Unit5Question<'add-unlike-fractions', FractionOperationParameters>
  | Unit5Question<'subtract-unlike-fractions', FractionOperationParameters>
  | Unit5Question<'add-mixed-numbers', MixedNumberOperationParameters>
  | Unit5Question<'subtract-mixed-numbers', MixedNumberOperationParameters>
  | Unit5Question<'addition-word-problem', AdditionWordProblemParameters>
  | Unit5Question<'subtraction-word-problem', SubtractionWordProblemParameters>

interface ItemDefinition {
  standard: '5.NF.1' | '5.NF.2'
  lessonFocus:
    | 'fraction equivalence'
    | 'benchmark fractions'
    | 'common denominators'
    | 'adding unlike fractions'
    | 'subtracting unlike fractions'
    | 'mixed-number problem solving'
  workedExample: CurriculumWorkedExample
}

/** One authored worked example for every source-derived procedural item type. */
export const GRADE5_MATH_UNIT5_ITEM_DEFINITIONS = {
  'equivalent-fraction': {
    standard: '5.NF.1',
    lessonFocus: 'fraction equivalence',
    workedExample: {
      prompt: 'Complete the equivalent fraction: 2/3 = ?/12.',
      answer: '8',
      steps: [
        'The denominator was multiplied by 4 because 3 x 4 = 12.',
        'Multiply the numerator by the same factor: 2 x 4 = 8.',
        'Therefore, 2/3 = 8/12.',
      ],
    },
  },
  'simplify-fraction': {
    standard: '5.NF.1',
    lessonFocus: 'fraction equivalence',
    workedExample: {
      prompt: 'Write 18/24 in simplest form.',
      answer: '3/4',
      steps: [
        'The greatest common divisor of 18 and 24 is 6.',
        'Divide both parts by 6: 18 / 6 = 3 and 24 / 6 = 4.',
        'Because 3 and 4 share no factor greater than 1, 3/4 is simplest.',
      ],
    },
  },
  'compare-to-benchmark': {
    standard: '5.NF.2',
    lessonFocus: 'benchmark fractions',
    workedExample: {
      prompt: 'Compare 5/8 with the benchmark 1/2 using <, >, or =.',
      answer: '>',
      steps: [
        'Rewrite 1/2 as eighths: 1/2 = 4/8.',
        'Five eighths is greater than four eighths.',
        'Therefore, 5/8 > 1/2.',
      ],
    },
  },
  'estimate-fraction-operation': {
    standard: '5.NF.2',
    lessonFocus: 'benchmark fractions',
    workedExample: {
      prompt: 'Use 0, 1/2, or 1 for each fraction to estimate 5/8 + 7/8.',
      answer: 'about 1 1/2',
      steps: [
        'Five eighths is nearest to 1/2.',
        'Seven eighths is nearest to 1.',
        'Add the benchmarks: 1/2 + 1 = 1 1/2.',
      ],
    },
  },
  'least-common-denominator': {
    standard: '5.NF.1',
    lessonFocus: 'common denominators',
    workedExample: {
      prompt: 'What is the least common denominator of fractions with denominators 6 and 8?',
      answer: '24',
      steps: [
        'Multiples of 6 are 6, 12, 18, 24, and so on.',
        'Multiples of 8 are 8, 16, 24, and so on.',
        'The first shared multiple is 24, so the least common denominator is 24.',
      ],
    },
  },
  'rewrite-with-common-denominator': {
    standard: '5.NF.1',
    lessonFocus: 'common denominators',
    workedExample: {
      prompt: 'Rewrite 2/3 and 3/4 using their least common denominator.',
      answer: '8/12 and 9/12',
      steps: [
        'The least common denominator of 3 and 4 is 12.',
        'Multiply 2/3 by 4/4 to get 8/12.',
        'Multiply 3/4 by 3/3 to get 9/12.',
      ],
    },
  },
  'add-unlike-fractions': {
    standard: '5.NF.1',
    lessonFocus: 'adding unlike fractions',
    workedExample: {
      prompt: 'Find 2/3 + 3/4. Write the answer in simplest form.',
      answer: '1 5/12',
      steps: [
        'Use 12 as a common denominator: 2/3 = 8/12 and 3/4 = 9/12.',
        'Add: 8/12 + 9/12 = 17/12.',
        'Rewrite and simplify 17/12 as 1 5/12.',
      ],
    },
  },
  'subtract-unlike-fractions': {
    standard: '5.NF.1',
    lessonFocus: 'subtracting unlike fractions',
    workedExample: {
      prompt: 'Find 5/6 - 1/4. Write the answer in simplest form.',
      answer: '7/12',
      steps: [
        'Use 12 as a common denominator: 5/6 = 10/12 and 1/4 = 3/12.',
        'Subtract: 10/12 - 3/12 = 7/12.',
        'Seven and 12 share no factor greater than 1, so the answer is 7/12.',
      ],
    },
  },
  'add-mixed-numbers': {
    standard: '5.NF.1',
    lessonFocus: 'mixed-number problem solving',
    workedExample: {
      prompt: 'Find 1 2/3 + 2 3/4. Write the answer in simplest form.',
      answer: '4 5/12',
      steps: [
        'Add the whole numbers: 1 + 2 = 3.',
        'Add the fractions: 2/3 + 3/4 = 17/12 = 1 5/12.',
        'Combine the parts: 3 + 1 5/12 = 4 5/12.',
      ],
    },
  },
  'subtract-mixed-numbers': {
    standard: '5.NF.1',
    lessonFocus: 'mixed-number problem solving',
    workedExample: {
      prompt: 'Find 4 1/3 - 1 3/4. Write the answer in simplest form.',
      answer: '2 7/12',
      steps: [
        'Regroup 4 1/3 as 3 4/3.',
        'Use twelfths: 4/3 = 16/12 and 3/4 = 9/12.',
        'Subtract to get 2 7/12.',
      ],
    },
  },
  'addition-word-problem': {
    standard: '5.NF.2',
    lessonFocus: 'mixed-number problem solving',
    workedExample: {
      prompt: 'A recipe uses 2/3 cup of oats and 3/4 cup of fruit. How many cups are used altogether?',
      answer: '1 5/12 cups',
      steps: [
        '“Altogether” calls for addition: 2/3 + 3/4.',
        'Use twelfths and add: 8/12 + 9/12 = 17/12.',
        'Rewrite 17/12 as 1 5/12 cups.',
      ],
    },
  },
  'subtraction-word-problem': {
    standard: '5.NF.2',
    lessonFocus: 'mixed-number problem solving',
    workedExample: {
      prompt: 'A ribbon is 3 1/2 meters long. If 1 3/4 meters are used, how many meters remain?',
      answer: '1 3/4 meters',
      steps: [
        '“Remain” calls for subtraction: 3 1/2 - 1 3/4.',
        'Regroup and use fourths: 3 2/4 = 2 6/4.',
        'Subtract: 2 6/4 - 1 3/4 = 1 3/4 meters.',
      ],
    },
  },
} as const satisfies Record<Grade5MathUnit5ItemType, ItemDefinition>

const MAX_DENOMINATOR: Record<Difficulty, number> = { 1: 8, 2: 12, 3: 18 }

const uniqueExcept = (correct: string, candidates: readonly string[]): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

/**
 * Every rational stays as an integer pair. These small integers remain exactly
 * representable; division is used only after divisibility is established.
 */
function gcd(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b !== 0) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function lcm(left: number, right: number): number {
  return (left / gcd(left, right)) * right
}

function reduceFraction(fraction: Fraction): Fraction {
  const divisor = gcd(fraction.numerator, fraction.denominator)
  return {
    numerator: fraction.numerator / divisor,
    denominator: fraction.denominator / divisor,
  }
}

function addFractions(left: Fraction, right: Fraction): Fraction {
  return reduceFraction({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  })
}

function subtractFractions(left: Fraction, right: Fraction): Fraction {
  return reduceFraction({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  })
}

function compareFractions(left: Fraction, right: Fraction): -1 | 0 | 1 {
  const leftProduct = left.numerator * right.denominator
  const rightProduct = right.numerator * left.denominator
  return leftProduct < rightProduct ? -1 : leftProduct > rightProduct ? 1 : 0
}

function fractionText(fraction: Fraction): string {
  return `${fraction.numerator}/${fraction.denominator}`
}

function benchmarkText(fraction: Fraction): string {
  return fraction.denominator === 1 ? String(fraction.numerator) : fractionText(fraction)
}

function mixedNumberText(mixed: MixedNumber): string {
  return `${mixed.whole} ${mixed.numerator}/${mixed.denominator}`
}

function mixedAnswerText(fraction: Fraction): string {
  const reduced = reduceFraction(fraction)
  const whole = Math.floor(reduced.numerator / reduced.denominator)
  const remainder = reduced.numerator % reduced.denominator
  if (remainder === 0) return String(whole)
  if (whole === 0) return `${remainder}/${reduced.denominator}`
  return `${whole} ${remainder}/${reduced.denominator}`
}

function mixedToFraction(mixed: MixedNumber): Fraction {
  return {
    numerator: mixed.whole * mixed.denominator + mixed.numerator,
    denominator: mixed.denominator,
  }
}

function fractionDistractors(correct: Fraction): string[] {
  const candidates: Fraction[] = [
    { numerator: correct.numerator + 1, denominator: correct.denominator },
    { numerator: Math.max(1, correct.numerator - 1), denominator: correct.denominator },
    { numerator: correct.numerator + correct.denominator, denominator: correct.denominator },
    { numerator: correct.numerator, denominator: correct.denominator + 1 },
    { numerator: correct.numerator, denominator: correct.denominator + 2 },
    { numerator: correct.numerator + 1, denominator: correct.denominator + 1 },
  ]
  return uniqueExcept(
    mixedAnswerText(correct),
    candidates
      .filter((candidate) => compareFractions(candidate, correct) !== 0)
      .map(mixedAnswerText),
  )
}

function randomReducedProperFraction(difficulty: Difficulty): Fraction {
  const denominator = ri(2, MAX_DENOMINATOR[difficulty])
  return reduceFraction({ numerator: ri(1, denominator - 1), denominator })
}

function randomUnlikeProperFractions(difficulty: Difficulty): [Fraction, Fraction] {
  const left = randomReducedProperFraction(difficulty)
  let right = randomReducedProperFraction(difficulty)
  while (right.denominator === left.denominator) right = randomReducedProperFraction(difficulty)
  return [left, right]
}

function randomDenominatorPair(difficulty: Difficulty): [number, number] {
  if (difficulty === 1) {
    const smaller = ri(2, 5)
    return [smaller, smaller * ri(2, 3)]
  }
  if (difficulty === 3) {
    return pick([
      [6, 8],
      [8, 12],
      [9, 12],
      [10, 15],
      [12, 18],
      [14, 18],
    ] as const)
  }
  const left = ri(3, 10)
  let right = ri(3, 12)
  while (right === left) right = ri(3, 12)
  return [left, right]
}

function randomMixedNumber(difficulty: Difficulty): MixedNumber {
  const fraction = randomReducedProperFraction(difficulty)
  return {
    whole: ri(1, difficulty === 1 ? 3 : difficulty === 2 ? 6 : 10),
    numerator: fraction.numerator,
    denominator: fraction.denominator,
  }
}

function randomUnlikeMixedNumbers(difficulty: Difficulty): [MixedNumber, MixedNumber] {
  const left = randomMixedNumber(difficulty)
  let right = randomMixedNumber(difficulty)
  while (right.denominator === left.denominator) right = randomMixedNumber(difficulty)
  return [left, right]
}

function withWholePart(fraction: Fraction, whole: number): Fraction {
  return {
    numerator: whole * fraction.denominator + fraction.numerator,
    denominator: fraction.denominator,
  }
}

/** Twice the nearest benchmark value: 0 -> 0, 1/2 -> 1, 1 -> 2. */
function nearestBenchmarkHalfUnits(fraction: Fraction): 0 | 1 | 2 {
  const fourNumerators = 4 * fraction.numerator
  if (fourNumerators < fraction.denominator) return 0
  if (fourNumerators < 3 * fraction.denominator) return 1
  return 2
}

function estimateText(halfUnits: number): string {
  if (halfUnits === 0) return 'about 0'
  const whole = Math.floor(halfUnits / 2)
  const hasHalf = halfUnits % 2 === 1
  if (whole === 0) return 'about 1/2'
  return hasHalf ? `about ${whole} 1/2` : `about ${whole}`
}

function nonTieBenchmarkFraction(difficulty: Difficulty): Fraction {
  let fraction = randomReducedProperFraction(difficulty)
  while (
    4 * fraction.numerator === fraction.denominator ||
    4 * fraction.numerator === 3 * fraction.denominator
  ) {
    fraction = randomReducedProperFraction(difficulty)
  }
  return fraction
}

export function generateEquivalentFractionQuestion(
  difficulty: Difficulty,
): Unit5Question<'equivalent-fraction', EquivalentFractionParameters> {
  const original = randomReducedProperFraction(difficulty)
  const factor = ri(2, difficulty + 3)
  const equivalent = {
    numerator: original.numerator * factor,
    denominator: original.denominator * factor,
  }
  const missing = difficulty === 1 || ri(0, 1) === 0 ? 'numerator' : 'denominator'
  const correctAnswer = String(missing === 'numerator' ? equivalent.numerator : equivalent.denominator)
  const target = Number(correctAnswer)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['equivalent-fraction']
  return makeCurriculumQuestion({
    itemType: 'equivalent-fraction',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt:
      missing === 'numerator'
        ? `Complete the equivalent fraction: ${fractionText(original)} = ?/${equivalent.denominator}.`
        : `Complete the equivalent fraction: ${fractionText(original)} = ${equivalent.numerator}/?.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(target + 1),
      String(Math.max(1, target - 1)),
      String(target + factor),
      String(original.numerator + original.denominator),
      String(equivalent.numerator + equivalent.denominator),
    ]),
    parameters: { original, equivalent, missing },
    workedExample: definition.workedExample,
  })
}

export function generateSimplifyFractionQuestion(
  difficulty: Difficulty,
): Unit5Question<'simplify-fraction', SimplifyFractionParameters> {
  const reduced = randomReducedProperFraction(difficulty)
  const factor = ri(2, difficulty + 4)
  const fraction = {
    numerator: reduced.numerator * factor,
    denominator: reduced.denominator * factor,
  }
  const correctAnswer = fractionText(reduced)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['simplify-fraction']
  return makeCurriculumQuestion({
    itemType: 'simplify-fraction',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Write ${fractionText(fraction)} in simplest form.`,
    correctAnswer,
    distractors: fractionDistractors(reduced),
    parameters: { fraction },
    workedExample: definition.workedExample,
  })
}

export function generateCompareToBenchmarkQuestion(
  difficulty: Difficulty,
): Unit5Question<'compare-to-benchmark', CompareToBenchmarkParameters> {
  const benchmark = difficulty === 1 || ri(0, 1) === 0
    ? { numerator: 1, denominator: 2 }
    : { numerator: 1, denominator: 1 }
  let fraction: Fraction
  if (ri(0, 3) === 0) {
    const factor = ri(1, difficulty + 2)
    fraction = {
      numerator: benchmark.numerator * factor,
      denominator: benchmark.denominator * factor,
    }
  } else {
    const denominator = ri(2, MAX_DENOMINATOR[difficulty])
    const maxNumerator = benchmark.denominator === 1 && difficulty === 3
      ? denominator + ri(1, denominator)
      : denominator - 1
    fraction = { numerator: ri(1, maxNumerator), denominator }
  }
  const comparison = compareFractions(fraction, benchmark)
  const correctAnswer = comparison < 0 ? '<' : comparison > 0 ? '>' : '='
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['compare-to-benchmark']
  return makeCurriculumQuestion({
    itemType: 'compare-to-benchmark',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Compare ${fractionText(fraction)} with the benchmark ${benchmarkText(benchmark)} using <, >, or =.`,
    correctAnswer,
    distractors: ['<', '>', '='].filter((choice) => choice !== correctAnswer),
    choiceCount: 3,
    parameters: { fraction, benchmark },
    visual: { kind: 'fractionPair', a: [fraction.numerator, fraction.denominator], b: [benchmark.numerator, benchmark.denominator] },
    workedExample: definition.workedExample,
  })
}

export function generateEstimateFractionOperationQuestion(
  difficulty: Difficulty,
): Unit5Question<'estimate-fraction-operation', EstimateFractionOperationParameters> {
  let left = nonTieBenchmarkFraction(difficulty)
  let right = nonTieBenchmarkFraction(difficulty)
  const operation = difficulty === 1 || ri(0, 1) === 0 ? 'add' : 'subtract'
  if (operation === 'subtract' && compareFractions(left, right) < 0) [left, right] = [right, left]
  const leftEstimate = nearestBenchmarkHalfUnits(left)
  const rightEstimate = nearestBenchmarkHalfUnits(right)
  const answerHalfUnits = operation === 'add'
    ? leftEstimate + rightEstimate
    : leftEstimate - rightEstimate
  const correctAnswer = estimateText(answerHalfUnits)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['estimate-fraction-operation']
  return makeCurriculumQuestion({
    itemType: 'estimate-fraction-operation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Use 0, 1/2, or 1 for each fraction to estimate ${fractionText(left)} ${operation === 'add' ? '+' : '-'} ${fractionText(right)}.`,
    correctAnswer,
    distractors: [0, 1, 2, 3, 4].map(estimateText).filter((choice) => choice !== correctAnswer),
    parameters: { left, right, operation },
    workedExample: definition.workedExample,
  })
}

export function generateLeastCommonDenominatorQuestion(
  difficulty: Difficulty,
): Unit5Question<'least-common-denominator', CommonDenominatorParameters> {
  const [leftDenominator, rightDenominator] = randomDenominatorPair(difficulty)
  const answer = lcm(leftDenominator, rightDenominator)
  const correctAnswer = String(answer)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['least-common-denominator']
  return makeCurriculumQuestion({
    itemType: 'least-common-denominator',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `What is the least common denominator of fractions with denominators ${leftDenominator} and ${rightDenominator}?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(leftDenominator * rightDenominator),
      String(Math.max(leftDenominator, rightDenominator)),
      String(leftDenominator + rightDenominator),
      String(answer + Math.min(leftDenominator, rightDenominator)),
      String(Math.max(1, answer - Math.min(leftDenominator, rightDenominator))),
    ]),
    parameters: { leftDenominator, rightDenominator },
    workedExample: definition.workedExample,
  })
}

export function generateRewriteWithCommonDenominatorQuestion(
  difficulty: Difficulty,
): Unit5Question<'rewrite-with-common-denominator', RewriteWithCommonDenominatorParameters> {
  const [left, right] = randomUnlikeProperFractions(difficulty)
  const commonDenominator = lcm(left.denominator, right.denominator)
  const rewrittenLeft = left.numerator * (commonDenominator / left.denominator)
  const rewrittenRight = right.numerator * (commonDenominator / right.denominator)
  const correctAnswer = `${rewrittenLeft}/${commonDenominator} and ${rewrittenRight}/${commonDenominator}`
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['rewrite-with-common-denominator']
  return makeCurriculumQuestion({
    itemType: 'rewrite-with-common-denominator',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Rewrite ${fractionText(left)} and ${fractionText(right)} as equivalent fractions with the least common denominator.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `${left.numerator}/${commonDenominator} and ${right.numerator}/${commonDenominator}`,
      `${rewrittenLeft + 1}/${commonDenominator} and ${rewrittenRight}/${commonDenominator}`,
      `${rewrittenLeft}/${commonDenominator} and ${rewrittenRight + 1}/${commonDenominator}`,
      `${rewrittenRight}/${commonDenominator} and ${rewrittenLeft}/${commonDenominator}`,
      `${left.numerator * right.denominator}/${commonDenominator} and ${right.numerator * left.denominator}/${commonDenominator}`,
    ]),
    parameters: { left, right, commonDenominator },
    visual: { kind: 'fractionPair', a: [left.numerator, left.denominator], b: [right.numerator, right.denominator] },
    workedExample: definition.workedExample,
  })
}

export function generateAddUnlikeFractionsQuestion(
  difficulty: Difficulty,
): Unit5Question<'add-unlike-fractions', FractionOperationParameters> {
  const [left, right] = randomUnlikeProperFractions(difficulty)
  const result = addFractions(left, right)
  const correctAnswer = mixedAnswerText(result)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['add-unlike-fractions']
  return makeCurriculumQuestion({
    itemType: 'add-unlike-fractions',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${fractionText(left)} + ${fractionText(right)} = ? Write the answer in simplest form.`,
    correctAnswer,
    distractors: fractionDistractors(result),
    parameters: { left, right },
    visual: { kind: 'fractionPair', a: [left.numerator, left.denominator], b: [right.numerator, right.denominator] },
    workedExample: definition.workedExample,
  })
}

export function generateSubtractUnlikeFractionsQuestion(
  difficulty: Difficulty,
): Unit5Question<'subtract-unlike-fractions', FractionOperationParameters> {
  let [left, right] = randomUnlikeProperFractions(difficulty)
  if (compareFractions(left, right) < 0) [left, right] = [right, left]
  while (compareFractions(left, right) === 0) {
    ;[left, right] = randomUnlikeProperFractions(difficulty)
    if (compareFractions(left, right) < 0) [left, right] = [right, left]
  }
  const result = subtractFractions(left, right)
  const correctAnswer = mixedAnswerText(result)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['subtract-unlike-fractions']
  return makeCurriculumQuestion({
    itemType: 'subtract-unlike-fractions',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${fractionText(left)} - ${fractionText(right)} = ? Write the answer in simplest form.`,
    correctAnswer,
    distractors: fractionDistractors(result),
    parameters: { left, right },
    visual: { kind: 'fractionPair', a: [left.numerator, left.denominator], b: [right.numerator, right.denominator] },
    workedExample: definition.workedExample,
  })
}

export function generateAddMixedNumbersQuestion(
  difficulty: Difficulty,
): Unit5Question<'add-mixed-numbers', MixedNumberOperationParameters> {
  const [left, right] = randomUnlikeMixedNumbers(difficulty)
  const result = addFractions(mixedToFraction(left), mixedToFraction(right))
  const correctAnswer = mixedAnswerText(result)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['add-mixed-numbers']
  return makeCurriculumQuestion({
    itemType: 'add-mixed-numbers',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${mixedNumberText(left)} + ${mixedNumberText(right)} = ? Write the answer in simplest form.`,
    correctAnswer,
    distractors: fractionDistractors(result),
    parameters: { left, right },
    workedExample: definition.workedExample,
  })
}

export function generateSubtractMixedNumbersQuestion(
  difficulty: Difficulty,
): Unit5Question<'subtract-mixed-numbers', MixedNumberOperationParameters> {
  let [left, right] = randomUnlikeMixedNumbers(difficulty)
  if (difficulty === 3) {
    left.whole = Math.max(left.whole, right.whole + 1)
    if (compareFractions(left, right) >= 0) {
      ;[left.numerator, right.numerator] = [right.numerator, left.numerator]
      ;[left.denominator, right.denominator] = [right.denominator, left.denominator]
    }
  } else {
    left.whole = Math.max(left.whole, right.whole + 1)
    if (difficulty === 1 && compareFractions(left, right) < 0) {
      ;[left.numerator, right.numerator] = [right.numerator, left.numerator]
      ;[left.denominator, right.denominator] = [right.denominator, left.denominator]
    }
  }
  const result = subtractFractions(mixedToFraction(left), mixedToFraction(right))
  const correctAnswer = mixedAnswerText(result)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['subtract-mixed-numbers']
  return makeCurriculumQuestion({
    itemType: 'subtract-mixed-numbers',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${mixedNumberText(left)} - ${mixedNumberText(right)} = ? Write the answer in simplest form.`,
    correctAnswer,
    distractors: fractionDistractors(result),
    parameters: { left, right },
    workedExample: definition.workedExample,
  })
}

function additionWordPrompt(parameters: AdditionWordProblemParameters): string {
  const left = mixedAnswerText(parameters.left)
  const right = mixedAnswerText(parameters.right)
  if (parameters.context === 'recipe') {
    return `A recipe uses ${left} cups of oats and ${right} cups of fruit. How many cups are used altogether?`
  }
  if (parameters.context === 'trail') {
    return `Maya walks ${left} miles in the morning and ${right} miles in the afternoon. How many miles does she walk altogether?`
  }
  return `One ribbon piece is ${left} meters long and another is ${right} meters long. What is their total length in meters?`
}

function subtractionWordPrompt(parameters: SubtractionWordProblemParameters): string {
  const starting = mixedAnswerText(parameters.starting)
  const used = mixedAnswerText(parameters.used)
  if (parameters.context === 'ribbon') {
    return `A ribbon is ${starting} meters long. If ${used} meters are used, how many meters remain?`
  }
  if (parameters.context === 'water') {
    return `A container holds ${starting} liters of water. After ${used} liters are used, how many liters remain?`
  }
  return `A trail is ${starting} miles long. After walking ${used} miles, how many miles remain?`
}

function randomWordAmounts(difficulty: Difficulty): [Fraction, Fraction] {
  const [leftFraction, rightFraction] = randomUnlikeProperFractions(difficulty)
  if (difficulty === 1) return [leftFraction, rightFraction]
  if (difficulty === 2) {
    return [withWholePart(leftFraction, ri(0, 2)), withWholePart(rightFraction, ri(0, 2))]
  }
  return [withWholePart(leftFraction, ri(1, 5)), withWholePart(rightFraction, ri(1, 5))]
}

export function generateAdditionWordProblemQuestion(
  difficulty: Difficulty,
): Unit5Question<'addition-word-problem', AdditionWordProblemParameters> {
  const [left, right] = randomWordAmounts(difficulty)
  const context = pick(['recipe', 'trail', 'ribbon'] as const)
  const parameters = { left, right, context }
  const result = addFractions(left, right)
  const correctAnswer = mixedAnswerText(result)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['addition-word-problem']
  return makeCurriculumQuestion({
    itemType: 'addition-word-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: additionWordPrompt(parameters),
    correctAnswer,
    distractors: fractionDistractors(result),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateSubtractionWordProblemQuestion(
  difficulty: Difficulty,
): Unit5Question<'subtraction-word-problem', SubtractionWordProblemParameters> {
  let used: Fraction
  let remaining: Fraction
  let starting: Fraction
  do {
    ;[used, remaining] = randomWordAmounts(difficulty)
    starting = addFractions(used, remaining)
  } while (starting.denominator === used.denominator)
  const context = pick(['ribbon', 'water', 'trail'] as const)
  const parameters = { starting, used, context }
  const correctAnswer = mixedAnswerText(remaining)
  const definition = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS['subtraction-word-problem']
  return makeCurriculumQuestion({
    itemType: 'subtraction-word-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: subtractionWordPrompt(parameters),
    correctAnswer,
    distractors: fractionDistractors(remaining),
    parameters,
    workedExample: definition.workedExample,
  })
}

export const GRADE5_MATH_UNIT5_GENERATORS = {
  'equivalent-fraction': generateEquivalentFractionQuestion,
  'simplify-fraction': generateSimplifyFractionQuestion,
  'compare-to-benchmark': generateCompareToBenchmarkQuestion,
  'estimate-fraction-operation': generateEstimateFractionOperationQuestion,
  'least-common-denominator': generateLeastCommonDenominatorQuestion,
  'rewrite-with-common-denominator': generateRewriteWithCommonDenominatorQuestion,
  'add-unlike-fractions': generateAddUnlikeFractionsQuestion,
  'subtract-unlike-fractions': generateSubtractUnlikeFractionsQuestion,
  'add-mixed-numbers': generateAddMixedNumbersQuestion,
  'subtract-mixed-numbers': generateSubtractMixedNumbersQuestion,
  'addition-word-problem': generateAdditionWordProblemQuestion,
  'subtraction-word-problem': generateSubtractionWordProblemQuestion,
} satisfies Record<Grade5MathUnit5ItemType, CurriculumGenerator<Grade5MathUnit5Question>>

export function generateGrade5MathUnit5Question<TItemType extends Grade5MathUnit5ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade5MathUnit5Question, { itemType: TItemType }> {
  const generator = GRADE5_MATH_UNIT5_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade5MathUnit5Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
