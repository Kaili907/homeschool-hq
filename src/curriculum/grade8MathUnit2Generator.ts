import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Unit 2, all 18 lesson records (course days
 * 19-36), and 8.EE.1, 8.EE.3, 8.EE.4, MP.1, MP.3, and MP.6.
 */
export const GRADE8_MATH_UNIT2_ITEM_TYPES = [
  'evaluate-integer-exponent',
  'combine-powers',
  'power-of-a-power',
  'evaluate-power-of-ten',
  'compare-powers-of-ten',
  'convert-scientific-notation',
  'compare-scientific-notation',
  'operate-scientific-notation',
  'scientific-notation-word-problem',
  'extreme-quantities-word-problem',
  'exponent-error-analysis',
  'scientific-notation-error-analysis',
] as const

export type Grade8MathUnit2ItemType =
  (typeof GRADE8_MATH_UNIT2_ITEM_TYPES)[number]

// ---------------------------------------------------------------------------
// Exact-arithmetic helpers. Every number is kept as an exact coefficient
// (in tenths, so 1.0 <= coefficient < 10.0) plus an integer power of ten --
// never a rounded float -- and standard-form strings are built digit by
// digit so no floating-point formatting can disagree with the exact value.
// ---------------------------------------------------------------------------

function formatCoefficient(coeffTenths: number): string {
  return coeffTenths % 10 === 0
    ? String(coeffTenths / 10)
    : (coeffTenths / 10).toFixed(1)
}

function formatSci(coeffTenths: number, exponent: number): string {
  return `${formatCoefficient(coeffTenths)} × 10^${exponent}`
}

/** Exact standard-form digit string for coeffTenths/10 * 10^exponent. */
function standardFormFromCoeffTenths(coeffTenths: number, exponent: number): string {
  const d1 = Math.floor(coeffTenths / 10)
  const d2 = coeffTenths % 10
  if (exponent >= 1) return `${d1}${d2}${'0'.repeat(exponent - 1)}`
  if (exponent === 0) return d2 === 0 ? `${d1}` : `${d1}.${d2}`
  const raw = `0.${'0'.repeat(-exponent - 1)}${d1}${d2}`
  return d2 === 0 ? raw.slice(0, -1) : raw
}

function randomCoeffTenths(): number {
  return ri(10, 99)
}

/** Clean (c1, c2) pairs from 1-9 whose quotient terminates in at most one decimal digit. */
const CLEAN_DIVIDE_PAIRS: ReadonlyArray<{ c1: number; c2: number }> = (() => {
  const pairs: Array<{ c1: number; c2: number }> = []
  for (let c1 = 1; c1 <= 9; c1++) {
    for (let c2 = 1; c2 <= 9; c2++) {
      if (c1 % c2 === 0 || (c1 * 10) % c2 === 0) pairs.push({ c1, c2 })
    }
  }
  return pairs
})()

/** Normalizes a raw (coefficient, exponent) pair -- coefficient given in tenths,
 * possibly outside [10, 99] -- into scientific-notation range. */
function normalizeTenths(rawTenths: number, exponent: number): { coeffTenths: number; exponent: number } {
  let coeffTenths = rawTenths
  let exp = exponent
  while (coeffTenths >= 100) {
    coeffTenths = Math.round(coeffTenths / 10)
    exp += 1
  }
  while (coeffTenths < 10) {
    coeffTenths *= 10
    exp -= 1
  }
  return { coeffTenths, exponent: exp }
}

interface EvaluateExponentParameters {
  base: number
  exponent: number
}

type CombinePowersMode = 'multiply' | 'divide'

interface CombinePowersParameters {
  base: number
  left: number
  right: number
  mode: CombinePowersMode
}

interface PowerOfAPowerParameters {
  base: number
  inner: number
  outer: number
}

interface PowerOfTenParameters {
  exponent: number
}

interface ComparePowersOfTenParameters {
  greater: number
  lesser: number
}

type ConvertMode = 'toScientific' | 'toStandard'

interface ConvertScientificNotationParameters {
  mode: ConvertMode
  coeffTenths: number
  exponent: number
}

interface CompareScientificNotationParameters {
  leftDisplay: string
  rightDisplay: string
  relation: '>' | '<'
}

type OperateMode = 'multiply' | 'divide'

interface OperateScientificNotationParameters {
  mode: OperateMode
  c1: number
  e1: number
  c2: number
  e2: number
}

interface ScientificNotationWordProblemParameters {
  c1: number
  e1: number
  c2: number
  e2: number
}

interface ExtremeQuantitiesWordProblemParameters {
  c1: number
  e1: number
  c2: number
  e2: number
}

type ExponentErrorMode =
  | 'product-adds-multiplied'
  | 'power-of-power-added'
  | 'zero-exponent'
  | 'negative-exponent-sign'

interface ExponentErrorParameters {
  mode: ExponentErrorMode
  base: number
  left: number
  right: number
}

interface ScientificNotationErrorParameters {
  c1: number
  e1: number
  c2: number
  e2: number
  claimedCoeff: number
  claimedExponent: number
}

type Unit2Question<
  TItemType extends Grade8MathUnit2ItemType,
  TParameters,
> = CurriculumQuestion<TItemType, TParameters>

export type Grade8MathUnit2Question =
  | Unit2Question<'evaluate-integer-exponent', EvaluateExponentParameters>
  | Unit2Question<'combine-powers', CombinePowersParameters>
  | Unit2Question<'power-of-a-power', PowerOfAPowerParameters>
  | Unit2Question<'evaluate-power-of-ten', PowerOfTenParameters>
  | Unit2Question<'compare-powers-of-ten', ComparePowersOfTenParameters>
  | Unit2Question<
      'convert-scientific-notation',
      ConvertScientificNotationParameters
    >
  | Unit2Question<
      'compare-scientific-notation',
      CompareScientificNotationParameters
    >
  | Unit2Question<
      'operate-scientific-notation',
      OperateScientificNotationParameters
    >
  | Unit2Question<
      'scientific-notation-word-problem',
      ScientificNotationWordProblemParameters
    >
  | Unit2Question<
      'extreme-quantities-word-problem',
      ExtremeQuantitiesWordProblemParameters
    >
  | Unit2Question<'exponent-error-analysis', ExponentErrorParameters>
  | Unit2Question<
      'scientific-notation-error-analysis',
      ScientificNotationErrorParameters
    >

type Unit2Standard = '8.EE.1' | '8.EE.3' | '8.EE.4' | 'MP.1' | 'MP.3' | 'MP.6'

interface ItemDefinition {
  standard: Unit2Standard
  lessonFocus:
    | 'laws of integer exponents'
    | 'powers of ten'
    | 'scientific notation'
    | 'comparing extreme quantities'
    | 'operations in scientific notation'
    | 'measurement and technology applications'
    | 'analyzing errors'
  workedExample: CurriculumWorkedExample
}

export const GRADE8_MATH_UNIT2_ITEM_DEFINITIONS = {
  'evaluate-integer-exponent': {
    standard: '8.EE.1',
    lessonFocus: 'laws of integer exponents',
    workedExample: {
      prompt: 'Evaluate 5^-2.',
      answer: '1/25',
      steps: ['A negative exponent means reciprocal: 5^-2 = 1/5².', '5² = 25, so 5^-2 = 1/25.'],
    },
  },
  'combine-powers': {
    standard: '8.EE.1',
    lessonFocus: 'laws of integer exponents',
    workedExample: {
      prompt: 'Simplify 4^3 × 4^-5.',
      answer: '4^-2',
      steps: ['When multiplying like bases, add the exponents.', '3 + (-5) = -2, so the product is 4^-2.'],
    },
  },
  'power-of-a-power': {
    standard: '8.EE.1',
    lessonFocus: 'laws of integer exponents',
    workedExample: {
      prompt: 'Simplify (3^-2)^4.',
      answer: '3^-8',
      steps: ['When raising a power to a power, multiply the exponents.', '-2 × 4 = -8, so the result is 3^-8.'],
    },
  },
  'evaluate-power-of-ten': {
    standard: '8.EE.1',
    lessonFocus: 'powers of ten',
    workedExample: {
      prompt: 'Evaluate 10^-3.',
      answer: '0.001',
      steps: ['A negative exponent moves the 1 to the right of the decimal point.', '10^-3 = 1/1000 = 0.001.'],
    },
  },
  'compare-powers-of-ten': {
    standard: '8.EE.1',
    lessonFocus: 'powers of ten',
    workedExample: {
      prompt: '10^5 is how many times as large as 10^2?',
      answer: '1,000',
      steps: ['Dividing powers of ten with the same base subtracts exponents: 5 - 2 = 3.', '10^3 = 1,000.'],
    },
  },
  'convert-scientific-notation': {
    standard: '8.EE.3',
    lessonFocus: 'scientific notation',
    workedExample: {
      prompt: 'Write 320,000 in scientific notation.',
      answer: '3.2 × 10^5',
      steps: [
        'Place the decimal point after the first nonzero digit: 3.2.',
        'Count how many places the decimal point moved: 5.',
      ],
    },
  },
  'compare-scientific-notation': {
    standard: '8.EE.3',
    lessonFocus: 'comparing extreme quantities',
    workedExample: {
      prompt: 'Compare 3.2 × 10^5 and 4.1 × 10^-2.',
      answer: '3.2 × 10^5 > 4.1 × 10^-2',
      steps: ['A larger power of ten always makes a number larger when the coefficient is between 1 and 10.', '5 > -2, so 3.2 × 10^5 is greater.'],
    },
  },
  'operate-scientific-notation': {
    standard: '8.EE.4',
    lessonFocus: 'operations in scientific notation',
    workedExample: {
      prompt: 'Multiply (7 × 10^4) × (8 × 10^3) and write the result in scientific notation.',
      answer: '5.6 × 10^8',
      steps: [
        'Multiply the coefficients: 7 × 8 = 56.',
        'Add the exponents: 4 + 3 = 7.',
        '56 is not between 1 and 10, so rewrite 56 × 10^7 as 5.6 × 10^8.',
      ],
    },
  },
  'scientific-notation-word-problem': {
    standard: '8.EE.4',
    lessonFocus: 'measurement and technology applications',
    workedExample: {
      prompt:
        'A processor performs 6 × 10^9 operations per second. How many operations does it perform in 5 × 10^2 seconds? Write the answer in scientific notation.',
      answer: '3 × 10^12',
      steps: ['Multiply the coefficients: 6 × 5 = 30.', 'Add the exponents: 9 + 2 = 11.', '30 × 10^11 = 3 × 10^12.'],
    },
  },
  'extreme-quantities-word-problem': {
    standard: '8.EE.4',
    lessonFocus: 'measurement and technology applications',
    workedExample: {
      prompt:
        'A cell has a diameter of about 8 × 10^-5 meters. A virus has a diameter of about 2 × 10^-8 meters. How many times as large is the cell as the virus?',
      answer: '4 × 10^3',
      steps: ['Divide the coefficients: 8 ÷ 2 = 4.', 'Subtract the exponents: -5 - (-8) = 3.'],
    },
  },
  'exponent-error-analysis': {
    standard: '8.EE.1',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt: 'A student simplifies 2^3 × 2^4 as 2^12. Which statement best analyzes the error?',
      answer: 'The exponents should be added, not multiplied: 3 + 4 = 7, so the product is 2^7.',
      steps: ['Multiplying like bases adds the exponents, it does not multiply them.', '3 + 4 = 7.'],
    },
  },
  'scientific-notation-error-analysis': {
    standard: '8.EE.4',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt:
        'A student multiplies (7 × 10^4) × (8 × 10^3) and writes 56 × 10^7. Which statement best analyzes the claim?',
      answer:
        'The value is correct but not in scientific notation; 56 × 10^7 should be rewritten as 5.6 × 10^8.',
      steps: ['56 is not between 1 and 10.', 'Move the decimal point one place left and add 1 to the exponent: 5.6 × 10^8.'],
    },
  },
} as const satisfies Record<Grade8MathUnit2ItemType, ItemDefinition>

export function generateEvaluateIntegerExponentQuestion(
  difficulty: Difficulty,
): Unit2Question<'evaluate-integer-exponent', EvaluateExponentParameters> {
  const base = ri(2, difficulty === 1 ? 5 : 9)
  const exponent =
    difficulty === 1 ? ri(0, 3) : difficulty === 2 ? ri(-3, 4) : ri(-5, 5)
  const magnitude = base ** Math.abs(exponent)
  const correct = exponent >= 0 ? String(magnitude) : `1/${magnitude}`
  const distractors =
    exponent >= 0
      ? [
          String(base * exponent),
          String(base ** Math.max(0, exponent - 1)),
          String(base ** (exponent + 1)),
          `1/${magnitude}`,
          String(magnitude + 1),
        ]
      : [
          `-1/${magnitude}`,
          String(magnitude),
          `1/${base * Math.abs(exponent)}`,
          `-${magnitude}`,
          `1/${magnitude + base}`,
        ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['evaluate-integer-exponent']
  return makeCurriculumQuestion({
    itemType: 'evaluate-integer-exponent',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Evaluate ${base}^${exponent}.`,
    correctAnswer: correct,
    distractors,
    parameters: { base, exponent },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateCombinePowersQuestion(
  difficulty: Difficulty,
): Unit2Question<'combine-powers', CombinePowersParameters> {
  const base = ri(2, 9)
  const range = difficulty === 1 ? 4 : difficulty === 2 ? 6 : 8
  const left = ri(-range, range)
  const right = ri(-range, range)
  const mode = pick(['multiply', 'divide'] as const)
  const result = mode === 'multiply' ? left + right : left - right
  const symbol = mode === 'multiply' ? '×' : '÷'
  const distractors = [
    `${base}^${left * right}`,
    `${base}^${result + 1}`,
    `${base}^${result - 1}`,
    `${base}^${result + 2}`,
    `${base}^${mode === 'multiply' ? left - right : left + right}`,
  ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['combine-powers']
  return makeCurriculumQuestion({
    itemType: 'combine-powers',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Simplify ${base}^${left} ${symbol} ${base}^${right}.`,
    correctAnswer: `${base}^${result}`,
    distractors,
    parameters: { base, left, right, mode },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generatePowerOfAPowerQuestion(
  difficulty: Difficulty,
): Unit2Question<'power-of-a-power', PowerOfAPowerParameters> {
  const base = ri(2, 9)
  const range = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5
  const inner = ri(-range, range)
  const outer = ri(2, range)
  const result = inner * outer
  const distractors = [
    `${base}^${inner + outer}`,
    `${base}^${result + 1}`,
    `${base}^${result - 1}`,
    `${base}^${result + 2}`,
    `${base}^${inner}`,
    `${base}^${outer}`,
  ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['power-of-a-power']
  return makeCurriculumQuestion({
    itemType: 'power-of-a-power',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Simplify (${base}^${inner})^${outer}.`,
    correctAnswer: `${base}^${result}`,
    distractors,
    parameters: { base, inner, outer },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateEvaluatePowerOfTenQuestion(
  difficulty: Difficulty,
): Unit2Question<'evaluate-power-of-ten', PowerOfTenParameters> {
  const exponent =
    difficulty === 1 ? ri(1, 4) : difficulty === 2 ? ri(-4, 6) : ri(-6, 8)
  const correct = standardFormFromCoeffTenths(10, exponent)
  const distractors = [
    standardFormFromCoeffTenths(10, exponent + 1),
    standardFormFromCoeffTenths(10, exponent - 1),
    standardFormFromCoeffTenths(10, -exponent),
    `${exponent}0`,
  ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['evaluate-power-of-ten']
  return makeCurriculumQuestion({
    itemType: 'evaluate-power-of-ten',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Evaluate 10^${exponent}.`,
    correctAnswer: correct,
    distractors,
    parameters: { exponent },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateComparePowersOfTenQuestion(
  difficulty: Difficulty,
): Unit2Question<'compare-powers-of-ten', ComparePowersOfTenParameters> {
  const spread = difficulty === 1 ? ri(1, 3) : difficulty === 2 ? ri(1, 5) : ri(1, 8)
  const lesser = difficulty === 1 ? ri(-2, 3) : difficulty === 2 ? ri(-4, 4) : ri(-6, 5)
  const greater = lesser + spread
  const correct = standardFormFromCoeffTenths(10, spread)
  const distractors = [
    standardFormFromCoeffTenths(10, spread + 1),
    standardFormFromCoeffTenths(10, spread - 1),
    standardFormFromCoeffTenths(10, greater + lesser),
    standardFormFromCoeffTenths(10, -spread),
  ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['compare-powers-of-ten']
  return makeCurriculumQuestion({
    itemType: 'compare-powers-of-ten',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `10^${greater} is how many times as large as 10^${lesser}?`,
    correctAnswer: correct,
    distractors,
    parameters: { greater, lesser },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateConvertScientificNotationQuestion(
  difficulty: Difficulty,
): Unit2Question<
  'convert-scientific-notation',
  ConvertScientificNotationParameters
> {
  const coeffTenths = randomCoeffTenths()
  const exponentRange = difficulty === 1 ? 4 : difficulty === 2 ? 6 : 9
  const exponent = ri(-exponentRange, exponentRange)
  const mode = pick(['toScientific', 'toStandard'] as const)
  const standardForm = standardFormFromCoeffTenths(coeffTenths, exponent)
  const sciForm = formatSci(coeffTenths, exponent)
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['convert-scientific-notation']
  if (mode === 'toScientific') {
    return makeCurriculumQuestion({
      itemType: 'convert-scientific-notation',
      standard: definition.standard,
      lessonFocus: definition.lessonFocus,
      difficulty,
      prompt: `Write ${standardForm} in scientific notation.`,
      correctAnswer: sciForm,
      distractors: [
        formatSci(coeffTenths, exponent + 1),
        formatSci(coeffTenths, exponent - 1),
        formatSci(coeffTenths, exponent + 2),
        formatSci(coeffTenths + 10, exponent),
      ],
      parameters: { mode, coeffTenths, exponent },
      workedExample: definition.workedExample,
      distractorMode: 'distinct',
    })
  }
  return makeCurriculumQuestion({
    itemType: 'convert-scientific-notation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Write ${sciForm} in standard form.`,
    correctAnswer: standardForm,
    distractors: [
      standardFormFromCoeffTenths(coeffTenths, exponent + 1),
      standardFormFromCoeffTenths(coeffTenths, exponent - 1),
      standardFormFromCoeffTenths(coeffTenths, exponent + 2),
      standardFormFromCoeffTenths(coeffTenths, -exponent),
    ],
    parameters: { mode, coeffTenths, exponent },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateCompareScientificNotationQuestion(
  difficulty: Difficulty,
): Unit2Question<
  'compare-scientific-notation',
  CompareScientificNotationParameters
> {
  const exponentRange = difficulty === 1 ? 5 : difficulty === 2 ? 7 : 10
  const sameExponent = difficulty === 3 && pick([true, false])
  let leftCoeff = randomCoeffTenths()
  let rightCoeff = randomCoeffTenths()
  while (leftCoeff === rightCoeff) rightCoeff = randomCoeffTenths()
  let leftExponent = ri(-exponentRange, exponentRange)
  let rightExponent = sameExponent
    ? leftExponent
    : ri(-exponentRange, exponentRange)
  while (!sameExponent && rightExponent === leftExponent) {
    rightExponent = ri(-exponentRange, exponentRange)
  }
  const leftGreater =
    leftExponent !== rightExponent
      ? leftExponent > rightExponent
      : leftCoeff > rightCoeff
  const relation: '>' | '<' = leftGreater ? '>' : '<'
  const leftDisplay = formatSci(leftCoeff, leftExponent)
  const rightDisplay = formatSci(rightCoeff, rightExponent)
  const distractors = [
    `${leftDisplay} ${relation === '>' ? '<' : '>'} ${rightDisplay}`,
    `${leftDisplay} = ${rightDisplay}`,
    'cannot be compared without a calculator',
  ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['compare-scientific-notation']
  return makeCurriculumQuestion({
    itemType: 'compare-scientific-notation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Compare ${leftDisplay} and ${rightDisplay}.`,
    correctAnswer: `${leftDisplay} ${relation} ${rightDisplay}`,
    distractors,
    parameters: { leftDisplay, rightDisplay, relation },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateOperateScientificNotationQuestion(
  difficulty: Difficulty,
): Unit2Question<
  'operate-scientific-notation',
  OperateScientificNotationParameters
> {
  const exponentRange = difficulty === 1 ? 3 : difficulty === 2 ? 5 : 7
  const mode = pick(['multiply', 'divide'] as const)
  const e1 = ri(-exponentRange, exponentRange)
  const e2 = ri(-exponentRange, exponentRange)
  let c1: number
  let c2: number
  let resultCoeffTenths: number
  let resultExponent: number
  const symbol = mode === 'multiply' ? '×' : '÷'
  if (mode === 'multiply') {
    c1 = ri(1, 9)
    c2 = ri(1, 9)
    const product = c1 * c2
    resultCoeffTenths = product < 10 ? product * 10 : product
    resultExponent = product < 10 ? e1 + e2 : e1 + e2 + 1
  } else {
    const chosen = pick(CLEAN_DIVIDE_PAIRS)
    c1 = chosen.c1
    c2 = chosen.c2
    if (c1 % c2 === 0) {
      resultCoeffTenths = (c1 / c2) * 10
      resultExponent = e1 - e2
    } else {
      resultCoeffTenths = (c1 * 10) / c2
      resultExponent = e1 - e2 - 1
    }
  }
  const correct = formatSci(resultCoeffTenths, resultExponent)
  const rawExponent = mode === 'multiply' ? e1 + e2 : e1 - e2
  const rawCoeff = mode === 'multiply' ? c1 * c2 : undefined
  const distractors = [
    formatSci(resultCoeffTenths, resultExponent + 1),
    formatSci(resultCoeffTenths, resultExponent - 1),
    formatSci(resultCoeffTenths, resultExponent + 2),
    rawCoeff !== undefined ? `${rawCoeff} × 10^${rawExponent}` : `${c1}/${c2} × 10^${rawExponent}`,
    formatSci(resultCoeffTenths, mode === 'multiply' ? e1 - e2 : e1 + e2),
  ]
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['operate-scientific-notation']
  return makeCurriculumQuestion({
    itemType: 'operate-scientific-notation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${mode === 'multiply' ? 'Multiply' : 'Divide'} (${c1} × 10^${e1}) ${symbol} (${c2} × 10^${e2}) and write the result in scientific notation.`,
    correctAnswer: correct,
    distractors,
    parameters: { mode, c1, e1, c2, e2 },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateScientificNotationWordProblemQuestion(
  difficulty: Difficulty,
): Unit2Question<
  'scientific-notation-word-problem',
  ScientificNotationWordProblemParameters
> {
  const exponentRange = difficulty === 1 ? 3 : difficulty === 2 ? 5 : 8
  const c1 = ri(1, 9)
  const c2 = ri(1, 9)
  const e1 = ri(0, exponentRange)
  const e2 = ri(0, exponentRange)
  const product = c1 * c2
  const resultCoeffTenths = product < 10 ? product * 10 : product
  const resultExponent = product < 10 ? e1 + e2 : e1 + e2 + 1
  const correct = formatSci(resultCoeffTenths, resultExponent)
  const distractors = [
    formatSci(resultCoeffTenths, resultExponent + 1),
    formatSci(resultCoeffTenths, resultExponent - 1),
    formatSci(resultCoeffTenths, resultExponent + 2),
    `${product} × 10^${e1 + e2}`,
    formatSci(resultCoeffTenths, e1 - e2),
  ]
  const definition =
    GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['scientific-notation-word-problem']
  return makeCurriculumQuestion({
    itemType: 'scientific-notation-word-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A processor performs ${c1} × 10^${e1} operations per second. How many operations does it perform in ${c2} × 10^${e2} seconds? Write the answer in scientific notation.`,
    correctAnswer: correct,
    distractors,
    parameters: { c1, e1, c2, e2 },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateExtremeQuantitiesWordProblemQuestion(
  difficulty: Difficulty,
): Unit2Question<
  'extreme-quantities-word-problem',
  ExtremeQuantitiesWordProblemParameters
> {
  const exponentSpread = difficulty === 1 ? ri(1, 3) : difficulty === 2 ? ri(2, 5) : ri(3, 8)
  const chosen = pick(CLEAN_DIVIDE_PAIRS)
  const c1 = chosen.c1
  const c2 = chosen.c2
  const e2 = -ri(1, 6)
  const e1 = e2 + exponentSpread
  let resultCoeffTenths: number
  let resultExponent: number
  if (c1 % c2 === 0) {
    resultCoeffTenths = (c1 / c2) * 10
    resultExponent = e1 - e2
  } else {
    resultCoeffTenths = (c1 * 10) / c2
    resultExponent = e1 - e2 - 1
  }
  const correct = formatSci(resultCoeffTenths, resultExponent)
  const distractors = [
    formatSci(resultCoeffTenths, resultExponent + 1),
    formatSci(resultCoeffTenths, resultExponent - 1),
    formatSci(resultCoeffTenths, resultExponent + 2),
    formatSci(resultCoeffTenths, e1 + e2),
    `${c1}/${c2} × 10^${e1 - e2}`,
  ]
  const definition =
    GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['extreme-quantities-word-problem']
  return makeCurriculumQuestion({
    itemType: 'extreme-quantities-word-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A cell has a diameter of about ${c1} × 10^${e1} meters. A virus has a diameter of about ${c2} × 10^${e2} meters. How many times as large is the cell as the virus?`,
    correctAnswer: correct,
    distractors,
    parameters: { c1, e1, c2, e2 },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateExponentErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit2Question<'exponent-error-analysis', ExponentErrorParameters> {
  const base = ri(2, 9)
  const mode = pick([
    'product-adds-multiplied',
    'power-of-power-added',
    'zero-exponent',
    'negative-exponent-sign',
  ] as const)
  const range = difficulty === 1 ? 4 : difficulty === 2 ? 6 : 8
  const left = ri(1, range)
  const right = ri(1, range)
  let prompt: string
  let correctAnswer: string
  const distractors: string[] = []
  if (mode === 'product-adds-multiplied') {
    const claimed = left * right
    const correct = left + right
    prompt = `A student simplifies ${base}^${left} × ${base}^${right} as ${base}^${claimed}. Which statement best analyzes the error?`
    correctAnswer = `The exponents should be added, not multiplied: ${left} + ${right} = ${correct}, so the product is ${base}^${correct}.`
    distractors.push(
      `The claim is correct; ${base}^${claimed} is the product.`,
      `The exponents should be subtracted: ${base}^${left - right}.`,
      `The bases should be multiplied together first.`,
    )
  } else if (mode === 'power-of-power-added') {
    const claimed = left + right
    const correct = left * right
    prompt = `A student simplifies (${base}^${left})^${right} as ${base}^${claimed}. Which statement best analyzes the error?`
    correctAnswer = `The exponents should be multiplied, not added: ${left} × ${right} = ${correct}, so the result is ${base}^${correct}.`
    distractors.push(
      `The claim is correct; ${base}^${claimed} is the result.`,
      `The exponents should be subtracted: ${base}^${left - right}.`,
      `Only the outer exponent applies, so the result is ${base}^${right}.`,
    )
  } else if (mode === 'zero-exponent') {
    prompt = `A student claims ${base}^0 = 0. Which statement best analyzes the claim?`
    correctAnswer = `The claim is incorrect; any nonzero base raised to the power 0 equals 1, so ${base}^0 = 1.`
    distractors.push(
      `The claim is correct; anything to the power 0 is 0.`,
      `The claim is incorrect; ${base}^0 = ${base}.`,
      `The claim is incorrect; ${base}^0 is undefined.`,
    )
  } else {
    prompt = `A student claims ${base}^-${left} = -${base}^${left}. Which statement best analyzes the claim?`
    correctAnswer = `The claim is incorrect; a negative exponent means reciprocal, not a negative sign, so ${base}^-${left} = 1/${base ** left}.`
    distractors.push(
      `The claim is correct; a negative exponent negates the value.`,
      `The claim is incorrect; ${base}^-${left} = ${base ** left}.`,
      `The claim is incorrect; ${base}^-${left} = 0.`,
    )
  }
  const definition = GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['exponent-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'exponent-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt,
    correctAnswer,
    distractors,
    parameters: { mode, base, left, right },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateScientificNotationErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit2Question<
  'scientific-notation-error-analysis',
  ScientificNotationErrorParameters
> {
  const exponentRange = difficulty === 1 ? 3 : difficulty === 2 ? 5 : 7
  let c1 = ri(2, 9)
  let c2 = ri(2, 9)
  while (c1 * c2 < 10) {
    c1 = ri(2, 9)
    c2 = ri(2, 9)
  }
  const e1 = ri(-exponentRange, exponentRange)
  const e2 = ri(-exponentRange, exponentRange)
  const claimedCoeff = c1 * c2
  const claimedExponent = e1 + e2
  const normalized = normalizeTenths(claimedCoeff * 10, claimedExponent)
  const correctAnswer = `The value is correct but not in scientific notation; ${claimedCoeff} × 10^${claimedExponent} should be rewritten as ${formatSci(normalized.coeffTenths, normalized.exponent)}.`
  const distractors = [
    `The claim is correct and already in scientific notation.`,
    `The coefficients should have been added, not multiplied: ${c1 + c2} × 10^${claimedExponent}.`,
    `The exponents should have been multiplied: ${claimedCoeff} × 10^${e1 * e2}.`,
  ]
  const definition =
    GRADE8_MATH_UNIT2_ITEM_DEFINITIONS['scientific-notation-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'scientific-notation-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student multiplies (${c1} × 10^${e1}) × (${c2} × 10^${e2}) and writes ${claimedCoeff} × 10^${claimedExponent}. Which statement best analyzes the claim?`,
    correctAnswer,
    distractors,
    parameters: { c1, e1, c2, e2, claimedCoeff, claimedExponent },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const GRADE8_MATH_UNIT2_GENERATORS = {
  'evaluate-integer-exponent': generateEvaluateIntegerExponentQuestion,
  'combine-powers': generateCombinePowersQuestion,
  'power-of-a-power': generatePowerOfAPowerQuestion,
  'evaluate-power-of-ten': generateEvaluatePowerOfTenQuestion,
  'compare-powers-of-ten': generateComparePowersOfTenQuestion,
  'convert-scientific-notation': generateConvertScientificNotationQuestion,
  'compare-scientific-notation': generateCompareScientificNotationQuestion,
  'operate-scientific-notation': generateOperateScientificNotationQuestion,
  'scientific-notation-word-problem':
    generateScientificNotationWordProblemQuestion,
  'extreme-quantities-word-problem':
    generateExtremeQuantitiesWordProblemQuestion,
  'exponent-error-analysis': generateExponentErrorAnalysisQuestion,
  'scientific-notation-error-analysis':
    generateScientificNotationErrorAnalysisQuestion,
} satisfies Record<
  Grade8MathUnit2ItemType,
  CurriculumGenerator<Grade8MathUnit2Question>
>

export function generateGrade8MathUnit2Question<
  TItemType extends Grade8MathUnit2ItemType,
>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade8MathUnit2Question, { itemType: TItemType }> {
  const generator = GRADE8_MATH_UNIT2_GENERATORS[
    itemType
  ] as CurriculumGenerator<
    Extract<Grade8MathUnit2Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
