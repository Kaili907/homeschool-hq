import type { Difficulty } from '../types'
import { pick, ri, shuffle } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/** Coverage contract derived from Unit 2, its 18 lesson records, and 5.NBT.1–4. */
export const GRADE5_MATH_UNIT2_ITEM_TYPES = [
  'adjacent-place-value',
  'power-of-ten-notation',
  'multiply-by-power-of-ten',
  'divide-by-power-of-ten',
  'decimal-to-number-name',
  'number-name-to-decimal',
  'decimal-to-expanded-form',
  'expanded-form-to-decimal',
  'compare-decimals',
  'round-decimal',
  'decimal-number-line',
  'place-value-chart',
] as const

export type Grade5MathUnit2ItemType = (typeof GRADE5_MATH_UNIT2_ITEM_TYPES)[number]

type DecimalPlace =
  | 'thousands'
  | 'hundreds'
  | 'tens'
  | 'ones'
  | 'tenths'
  | 'hundredths'
  | 'thousandths'

interface AdjacentPlaceParameters {
  display: string
  digit: number
  comparedExponent: number
  referenceExponent: number
}

interface PowerNotationParameters {
  exponent: number
  mode: 'value-from-exponent' | 'exponent-from-value'
}

interface PowerShiftParameters {
  operandScaled: number
  operandScale: number
  exponent: number
}

interface DecimalRepresentationParameters {
  whole: number
  fractional: number
  scale: number
}

interface CompareDecimalParameters {
  leftScaled: number
  leftScale: number
  rightScaled: number
  rightScale: number
}

interface RoundDecimalParameters {
  inputScaled: number
  inputScale: number
  targetExponent: number
}

interface NumberLineParameters {
  startScaled: number
  scale: number
  intervalCount: number
  pointIndex: number
}

interface PlaceValueChartParameters {
  exponents: readonly number[]
  digits: readonly number[]
  targetExponent: number
  mode: 'digit' | 'value' | 'place'
}

type Unit2Question<TItemType extends Grade5MathUnit2ItemType, TParameters> =
  CurriculumQuestion<TItemType, TParameters>

export type Grade5MathUnit2Question =
  | Unit2Question<'adjacent-place-value', AdjacentPlaceParameters>
  | Unit2Question<'power-of-ten-notation', PowerNotationParameters>
  | Unit2Question<'multiply-by-power-of-ten', PowerShiftParameters>
  | Unit2Question<'divide-by-power-of-ten', PowerShiftParameters>
  | Unit2Question<'decimal-to-number-name', DecimalRepresentationParameters>
  | Unit2Question<'number-name-to-decimal', DecimalRepresentationParameters>
  | Unit2Question<'decimal-to-expanded-form', DecimalRepresentationParameters>
  | Unit2Question<'expanded-form-to-decimal', DecimalRepresentationParameters>
  | Unit2Question<'compare-decimals', CompareDecimalParameters>
  | Unit2Question<'round-decimal', RoundDecimalParameters>
  | Unit2Question<'decimal-number-line', NumberLineParameters>
  | Unit2Question<'place-value-chart', PlaceValueChartParameters>

interface ItemDefinition {
  standard: '5.NBT.1' | '5.NBT.2' | '5.NBT.3' | '5.NBT.4'
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

/**
 * Each item type owns one authored example. Later units should follow this same
 * definition → generator → registry pattern and reuse generatorCore.ts.
 */
export const GRADE5_MATH_UNIT2_ITEM_DEFINITIONS = {
  'adjacent-place-value': {
    standard: '5.NBT.1',
    lessonFocus: 'powers-of-ten patterns',
    workedExample: {
      prompt: 'In 6.66, compare the value of the 6 in the tenths place with the 6 in the hundredths place.',
      answer: '10 times',
      steps: [
        'The 6 in the tenths place has value 0.6.',
        'The 6 in the hundredths place has value 0.06.',
        'Because 0.6 = 10 × 0.06, the tenths-place 6 is worth 10 times as much.',
      ],
    },
  },
  'power-of-ten-notation': {
    standard: '5.NBT.2',
    lessonFocus: 'powers-of-ten patterns',
    workedExample: {
      prompt: 'What is 10^3?',
      answer: '1,000',
      steps: [
        'The exponent 3 means multiply three factors of 10.',
        '10 × 10 × 10 = 1,000.',
      ],
    },
  },
  'multiply-by-power-of-ten': {
    standard: '5.NBT.2',
    lessonFocus: 'powers-of-ten patterns',
    workedExample: {
      prompt: 'What is 0.47 × 10^2?',
      answer: '47',
      steps: [
        '10^2 is 100.',
        'Multiplying by 100 makes each digit worth 100 times as much.',
        '0.47 × 100 = 47.',
      ],
    },
  },
  'divide-by-power-of-ten': {
    standard: '5.NBT.2',
    lessonFocus: 'powers-of-ten patterns',
    workedExample: {
      prompt: 'What is 47 ÷ 10^2?',
      answer: '0.47',
      steps: [
        '10^2 is 100.',
        'Dividing by 100 makes each digit worth one hundredth as much.',
        '47 ÷ 100 = 0.47.',
      ],
    },
  },
  'decimal-to-number-name': {
    standard: '5.NBT.3',
    lessonFocus: 'reading decimals through thousandths',
    workedExample: {
      prompt: 'Write 12.305 in words.',
      answer: 'twelve and three hundred five thousandths',
      steps: [
        'Read 12 as twelve.',
        'The last decimal digit is in the thousandths place, so read 305 as three hundred five thousandths.',
        'Use “and” for the decimal point.',
      ],
    },
  },
  'number-name-to-decimal': {
    standard: '5.NBT.3',
    lessonFocus: 'reading decimals through thousandths',
    workedExample: {
      prompt: 'Write twelve and three hundred five thousandths as a decimal.',
      answer: '12.305',
      steps: [
        'Write the whole-number part, 12.',
        'Three hundred five thousandths needs three decimal places: 305.',
        'Combine them as 12.305.',
      ],
    },
  },
  'decimal-to-expanded-form': {
    standard: '5.NBT.3',
    lessonFocus: 'expanded form',
    workedExample: {
      prompt: 'Write 24.305 in expanded form.',
      answer: '20 + 4 + 0.3 + 0.005',
      steps: [
        'The 2 represents 20 and the 4 represents 4.',
        'The 3 represents 0.3, the 0 contributes no term, and the 5 represents 0.005.',
        'Add the nonzero place values.',
      ],
    },
  },
  'expanded-form-to-decimal': {
    standard: '5.NBT.3',
    lessonFocus: 'expanded form',
    workedExample: {
      prompt: 'Write 20 + 4 + 0.3 + 0.005 in standard form.',
      answer: '24.305',
      steps: [
        'Place 2 in the tens place and 4 in the ones place.',
        'Place 3 in the tenths place, 0 in the hundredths place, and 5 in the thousandths place.',
        'The number is 24.305.',
      ],
    },
  },
  'compare-decimals': {
    standard: '5.NBT.3',
    lessonFocus: 'comparing decimals',
    workedExample: {
      prompt: 'Compare 4.50 and 4.5 using <, >, or =.',
      answer: '=',
      steps: [
        'Line up the decimal points.',
        'A zero added to the right of a decimal does not change its value.',
        'Both numbers equal four and five tenths, so use =.',
      ],
    },
  },
  'round-decimal': {
    standard: '5.NBT.4',
    lessonFocus: 'rounding decimals',
    workedExample: {
      prompt: 'Round 7.250 to the nearest tenth.',
      answer: '7.3',
      steps: [
        'The tenths digit is 2; inspect the hundredths digit.',
        'The hundredths digit is 5, so the value is exactly halfway and rounds up.',
        'Increase the tenths digit to 3: 7.3.',
      ],
    },
  },
  'decimal-number-line': {
    standard: '5.NBT.3',
    lessonFocus: 'number lines and place-value charts',
    workedExample: {
      prompt: 'A number line from 2.3 to 2.4 has 10 equal intervals. Point P is 7 intervals after 2.3. What number is P?',
      answer: '2.37',
      steps: [
        'The distance from 2.3 to 2.4 is one tenth.',
        'Ten equal intervals make each interval one hundredth.',
        'Seven hundredths after 2.30 is 2.37.',
      ],
    },
  },
  'place-value-chart': {
    standard: '5.NBT.1',
    lessonFocus: 'number lines and place-value charts',
    workedExample: {
      prompt: 'A place-value chart shows 5 in the hundredths column. What value does that digit represent?',
      answer: '0.05',
      steps: [
        'The hundredths column represents parts of size 0.01.',
        'Five hundredths is 5 × 0.01.',
        'The digit represents 0.05.',
      ],
    },
  },
} as const satisfies Record<Grade5MathUnit2ItemType, ItemDefinition>

const POWERS_OF_TEN = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000] as const

const PLACE_BY_EXPONENT: Record<number, DecimalPlace> = {
  3: 'thousands',
  2: 'hundreds',
  1: 'tens',
  0: 'ones',
  [-1]: 'tenths',
  [-2]: 'hundredths',
  [-3]: 'thousandths',
}

const ROUND_PLACE_NAME: Record<number, string> = {
  2: 'hundred',
  1: 'ten',
  0: 'whole number',
  [-1]: 'tenth',
  [-2]: 'hundredth',
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

const pow10 = (exponent: number): number => POWERS_OF_TEN[exponent] ?? 10 ** exponent

const uniqueExcept = (correct: string, candidates: readonly string[]): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

function formatScaledFixed(scaled: number, scale: number): string {
  if (scale === 0) return String(scaled)
  const digits = String(scaled).padStart(scale + 1, '0')
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

function trimDecimal(decimal: string): string {
  return decimal.includes('.') ? decimal.replace(/0+$/, '').replace(/\.$/, '') : decimal
}

function shiftDecimal(scaled: number, scale: number, shift: number): string {
  const resultScale = scale - shift
  if (resultScale <= 0) return String(scaled * pow10(-resultScale))
  return trimDecimal(formatScaledFixed(scaled, resultScale))
}

function digitValue(digit: number, exponent: number): string {
  if (exponent >= 0) return String(digit * pow10(exponent))
  return formatScaledFixed(digit, -exponent)
}

function formatPlaceUnits(units: number, exponent: number): string {
  return exponent >= 0 ? String(units * pow10(exponent)) : formatScaledFixed(units, -exponent)
}

function wholeNumberWords(value: number): string {
  if (value < 20) return ONES[value]
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)]
    const ones = value % 10
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`
  }
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  return remainder === 0
    ? `${ONES[hundreds]} hundred`
    : `${ONES[hundreds]} hundred ${wholeNumberWords(remainder)}`
}

function decimalName(whole: number, fractional: number, scale: number): string {
  const place = PLACE_BY_EXPONENT[-scale]
  const unit = fractional === 1 ? place.slice(0, -1) : place
  return `${wholeNumberWords(whole)} and ${wholeNumberWords(fractional)} ${unit}`
}

function expandedForm(scaled: number, scale: number): string {
  const maxExponent = String(Math.floor(scaled / pow10(scale))).length - 1
  const terms: string[] = []
  for (let exponent = maxExponent; exponent >= -scale; exponent--) {
    const divisor = pow10(exponent + scale)
    const digit = Math.floor(scaled / divisor) % 10
    if (digit !== 0) terms.push(digitValue(digit, exponent))
  }
  return terms.join(' + ')
}

function compareScaled(left: number, leftScale: number, right: number, rightScale: number): -1 | 0 | 1 {
  const scale = Math.max(leftScale, rightScale)
  const normalizedLeft = left * pow10(scale - leftScale)
  const normalizedRight = right * pow10(scale - rightScale)
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0
}

function roundUnitsAtExponent(input: number, inputScale: number, targetExponent: number): number {
  const factor = pow10(inputScale + targetExponent)
  const lower = Math.floor(input / factor)
  const remainder = input % factor
  return lower + (remainder * 2 >= factor ? 1 : 0)
}

function randomDecimalParts(difficulty: Difficulty): DecimalRepresentationParameters {
  const scale = difficulty
  const whole = difficulty === 1 ? ri(0, 9) : difficulty === 2 ? ri(0, 99) : ri(0, 999)
  let fractional = ri(1, pow10(scale) - 1)
  if (difficulty === 3 && ri(0, 2) === 0) fractional = Math.max(10, Math.floor(fractional / 10) * 10)
  return { whole, fractional, scale }
}

function randomExpandedParts(difficulty: Difficulty): DecimalRepresentationParameters {
  const scale = difficulty
  const whole = difficulty === 1 ? ri(1, 9) : difficulty === 2 ? ri(1, 99) : ri(1, 999)
  let fractional = ri(1, pow10(scale) - 1)
  if (fractional % 10 === 0) fractional++
  return { whole, fractional, scale }
}

export function generateAdjacentPlaceValueQuestion(
  difficulty: Difficulty,
): Unit2Question<'adjacent-place-value', AdjacentPlaceParameters> {
  const pair =
    difficulty === 1
      ? pick([[2, 1], [1, 0]] as const)
      : difficulty === 2
        ? pick([[3, 2], [2, 1], [1, 0], [0, -1]] as const)
        : pick([[3, 2], [2, 1], [1, 0], [0, -1], [-1, -2], [-2, -3]] as const)
  const [greaterExponent, lesserExponent] = pair
  const scale = Math.max(0, -lesserExponent)
  const maxExponent = Math.max(1, greaterExponent)
  const digits = Array.from({ length: maxExponent + scale + 1 }, () => ri(1, 9))
  const digit = ri(1, 9)
  digits[maxExponent - greaterExponent] = digit
  digits[maxExponent - lesserExponent] = digit
  const scaled = digits.reduce((value, next) => value * 10 + next, 0)
  const display = formatScaledFixed(scaled, scale)
  const compareGreaterToLesser = ri(0, 1) === 1
  const comparedExponent = compareGreaterToLesser ? greaterExponent : lesserExponent
  const referenceExponent = compareGreaterToLesser ? lesserExponent : greaterExponent
  const correctAnswer = compareGreaterToLesser ? '10 times' : '1/10 as much'
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['adjacent-place-value']
  return makeCurriculumQuestion({
    itemType: 'adjacent-place-value',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `In ${display}, how does the value of the ${digit} in the ${PLACE_BY_EXPONENT[comparedExponent]} place compare with the value of the ${digit} in the ${PLACE_BY_EXPONENT[referenceExponent]} place?`,
    correctAnswer,
    distractors: ['10 times', '1/10 as much', '100 times', 'the same value'],
    parameters: { display, digit, comparedExponent, referenceExponent },
    workedExample: definition.workedExample,
  })
}

export function generatePowerOfTenNotationQuestion(
  difficulty: Difficulty,
): Unit2Question<'power-of-ten-notation', PowerNotationParameters> {
  const exponent = difficulty === 1 ? ri(1, 2) : difficulty === 2 ? ri(2, 4) : ri(0, 6)
  const mode = difficulty === 1 || ri(0, 1) === 0 ? 'value-from-exponent' : 'exponent-from-value'
  const value = pow10(exponent)
  const correctAnswer = mode === 'value-from-exponent' ? String(value) : String(exponent)
  const distractors =
    mode === 'value-from-exponent'
      ? [0, 1, 2, 3, 4, 5, 6]
          .filter((candidateExponent) => candidateExponent !== exponent)
          .map((candidateExponent) => String(pow10(candidateExponent)))
      : [0, 1, 2, 3, 4, 5, 6]
          .filter((candidateExponent) => candidateExponent !== exponent)
          .map(String)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['power-of-ten-notation']
  return makeCurriculumQuestion({
    itemType: 'power-of-ten-notation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: mode === 'value-from-exponent' ? `10^${exponent} = ?` : `10^? = ${value}`,
    correctAnswer,
    distractors,
    parameters: { exponent, mode },
    workedExample: definition.workedExample,
  })
}

function randomPowerOperand(difficulty: Difficulty): { scaled: number; scale: number } {
  if (difficulty === 1) return { scaled: ri(2, 99), scale: 0 }
  if (difficulty === 2) {
    const scale = pick([1, 2] as const)
    return { scaled: ri(pow10(scale - 1) + 1, pow10(scale + 1) - 1), scale }
  }
  const scale = pick([2, 3] as const)
  let scaled = ri(pow10(scale - 1) + 1, pow10(scale + 1) - 1)
  if (ri(0, 2) === 0) scaled = Math.max(10, Math.floor(scaled / 10) * 10)
  return { scaled, scale }
}

function powerShiftDistractors(scaled: number, scale: number, shift: number, correct: string): string[] {
  return uniqueExcept(correct, [
    shiftDecimal(scaled, scale, shift - 1),
    shiftDecimal(scaled, scale, shift + 1),
    shiftDecimal(scaled, scale, -shift),
    shiftDecimal(scaled, scale, 0),
  ])
}

export function generateMultiplyByPowerOfTenQuestion(
  difficulty: Difficulty,
): Unit2Question<'multiply-by-power-of-ten', PowerShiftParameters> {
  const operand = randomPowerOperand(difficulty)
  const exponent = difficulty === 1 ? ri(1, 2) : difficulty === 2 ? ri(1, 2) : ri(1, 3)
  const correctAnswer = shiftDecimal(operand.scaled, operand.scale, exponent)
  const display = formatScaledFixed(operand.scaled, operand.scale)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['multiply-by-power-of-ten']
  return makeCurriculumQuestion({
    itemType: 'multiply-by-power-of-ten',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${display} × 10^${exponent} = ?`,
    correctAnswer,
    distractors: powerShiftDistractors(operand.scaled, operand.scale, exponent, correctAnswer),
    parameters: { operandScaled: operand.scaled, operandScale: operand.scale, exponent },
    workedExample: definition.workedExample,
  })
}

export function generateDivideByPowerOfTenQuestion(
  difficulty: Difficulty,
): Unit2Question<'divide-by-power-of-ten', PowerShiftParameters> {
  const operand = randomPowerOperand(difficulty)
  const exponent = difficulty === 1 ? ri(1, 2) : difficulty === 2 ? ri(1, 2) : ri(1, 3)
  const correctAnswer = shiftDecimal(operand.scaled, operand.scale, -exponent)
  const display = formatScaledFixed(operand.scaled, operand.scale)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['divide-by-power-of-ten']
  return makeCurriculumQuestion({
    itemType: 'divide-by-power-of-ten',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${display} ÷ 10^${exponent} = ?`,
    correctAnswer,
    distractors: powerShiftDistractors(operand.scaled, operand.scale, -exponent, correctAnswer),
    parameters: { operandScaled: operand.scaled, operandScale: operand.scale, exponent },
    workedExample: definition.workedExample,
  })
}

export function generateDecimalToNumberNameQuestion(
  difficulty: Difficulty,
): Unit2Question<'decimal-to-number-name', DecimalRepresentationParameters> {
  const parameters = randomDecimalParts(difficulty)
  const scaled = parameters.whole * pow10(parameters.scale) + parameters.fractional
  const display = formatScaledFixed(scaled, parameters.scale)
  const correctAnswer = decimalName(parameters.whole, parameters.fractional, parameters.scale)
  const nearby = parameters.fractional === pow10(parameters.scale) - 1 ? parameters.fractional - 1 : parameters.fractional + 1
  const wrongScale = parameters.scale === 1 ? 2 : parameters.scale - 1
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['decimal-to-number-name']
  return makeCurriculumQuestion({
    itemType: 'decimal-to-number-name',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `How is ${display} written in words?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      decimalName(parameters.whole, nearby, parameters.scale),
      decimalName(parameters.whole, parameters.fractional, wrongScale),
      decimalName(parameters.whole + 1, parameters.fractional, parameters.scale),
      decimalName(parameters.whole, Math.max(1, parameters.fractional - 1), parameters.scale),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateNumberNameToDecimalQuestion(
  difficulty: Difficulty,
): Unit2Question<'number-name-to-decimal', DecimalRepresentationParameters> {
  const parameters = randomDecimalParts(difficulty)
  const scaled = parameters.whole * pow10(parameters.scale) + parameters.fractional
  const correctAnswer = formatScaledFixed(scaled, parameters.scale)
  const wrongScale = parameters.scale === 1 ? 2 : parameters.scale - 1
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['number-name-to-decimal']
  return makeCurriculumQuestion({
    itemType: 'number-name-to-decimal',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Write “${decimalName(parameters.whole, parameters.fractional, parameters.scale)}” as a decimal.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatScaledFixed(parameters.whole * pow10(wrongScale) + parameters.fractional, wrongScale),
      formatScaledFixed(scaled + 1, parameters.scale),
      formatScaledFixed(scaled + pow10(parameters.scale), parameters.scale),
      `${parameters.whole}.${parameters.fractional}`,
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateDecimalToExpandedFormQuestion(
  difficulty: Difficulty,
): Unit2Question<'decimal-to-expanded-form', DecimalRepresentationParameters> {
  const parameters = randomExpandedParts(difficulty)
  const scaled = parameters.whole * pow10(parameters.scale) + parameters.fractional
  const display = formatScaledFixed(scaled, parameters.scale)
  const correctAnswer = expandedForm(scaled, parameters.scale)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['decimal-to-expanded-form']
  return makeCurriculumQuestion({
    itemType: 'decimal-to-expanded-form',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Write ${display} in expanded form.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      expandedForm(scaled + 1, parameters.scale),
      expandedForm(scaled + pow10(Math.max(0, parameters.scale - 1)), parameters.scale),
      expandedForm(scaled, Math.max(0, parameters.scale - 1)),
      display,
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateExpandedFormToDecimalQuestion(
  difficulty: Difficulty,
): Unit2Question<'expanded-form-to-decimal', DecimalRepresentationParameters> {
  const parameters = randomExpandedParts(difficulty)
  const scaled = parameters.whole * pow10(parameters.scale) + parameters.fractional
  const correctAnswer = formatScaledFixed(scaled, parameters.scale)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['expanded-form-to-decimal']
  return makeCurriculumQuestion({
    itemType: 'expanded-form-to-decimal',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Write ${expandedForm(scaled, parameters.scale)} in standard form.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatScaledFixed(scaled + 1, parameters.scale),
      formatScaledFixed(scaled + pow10(Math.max(0, parameters.scale - 1)), parameters.scale),
      formatScaledFixed(scaled, Math.max(0, parameters.scale - 1)),
      trimDecimal(formatScaledFixed(scaled * 10, parameters.scale)),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateCompareDecimalsQuestion(
  difficulty: Difficulty,
): Unit2Question<'compare-decimals', CompareDecimalParameters> {
  let leftScale: number
  let rightScale: number
  let leftScaled: number
  let rightScaled: number
  if (difficulty === 3 && ri(0, 2) === 0) {
    leftScale = pick([1, 2] as const)
    rightScale = leftScale + 1
    leftScaled = ri(1, pow10(leftScale + 1) - 1)
    rightScaled = leftScaled * 10
    if (ri(0, 1) === 1) {
      ;[leftScale, rightScale] = [rightScale, leftScale]
      ;[leftScaled, rightScaled] = [rightScaled, leftScaled]
    }
  } else {
    leftScale = difficulty === 1 ? 1 : ri(1, difficulty)
    rightScale = difficulty === 1 ? 1 : ri(1, difficulty)
    leftScaled = ri(1, pow10(leftScale + 1) - 1)
    rightScaled = ri(1, pow10(rightScale + 1) - 1)
    while (compareScaled(leftScaled, leftScale, rightScaled, rightScale) === 0) rightScaled++
  }
  const comparison = compareScaled(leftScaled, leftScale, rightScaled, rightScale)
  const correctAnswer = comparison < 0 ? '<' : comparison > 0 ? '>' : '='
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['compare-decimals']
  return makeCurriculumQuestion({
    itemType: 'compare-decimals',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Compare ${formatScaledFixed(leftScaled, leftScale)} and ${formatScaledFixed(rightScaled, rightScale)} using <, >, or =.`,
    correctAnswer,
    distractors: ['<', '>', '='].filter((symbol) => symbol !== correctAnswer),
    choiceCount: 3,
    parameters: { leftScaled, leftScale, rightScaled, rightScale },
    workedExample: definition.workedExample,
  })
}

export function generateRoundDecimalQuestion(
  difficulty: Difficulty,
): Unit2Question<'round-decimal', RoundDecimalParameters> {
  const inputScale = difficulty === 1 ? 2 : 3
  const targetExponent =
    difficulty === 1
      ? pick([0, -1] as const)
      : difficulty === 2
        ? pick([1, 0, -1, -2] as const)
        : pick([2, 1, 0, -1, -2] as const)
  const factor = pow10(inputScale + targetExponent)
  const wholeLimit = difficulty === 1 ? 99 : difficulty === 2 ? 999 : 9_999
  const maxInputScaled = wholeLimit * pow10(inputScale) + (pow10(inputScale) - 1)
  const maxBase = Math.max(1, Math.floor(maxInputScaled / factor) - 1)
  const base = ri(0, maxBase)
  const halfway = difficulty === 3 || ri(0, 3) === 0
  let remainder = halfway ? factor / 2 : ri(0, factor - 1)
  if (!halfway && remainder === factor / 2) remainder = (remainder + 1) % factor
  const inputScaled = base * factor + remainder
  const rounded = roundUnitsAtExponent(inputScaled, inputScale, targetExponent)
  const correctAnswer = formatPlaceUnits(rounded, targetExponent)
  const floor = Math.floor(inputScaled / factor)
  const ceil = Math.ceil(inputScaled / factor)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['round-decimal']
  return makeCurriculumQuestion({
    itemType: 'round-decimal',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Round ${formatScaledFixed(inputScaled, inputScale)} to the nearest ${ROUND_PLACE_NAME[targetExponent]}.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatPlaceUnits(floor, targetExponent),
      formatPlaceUnits(ceil, targetExponent),
      formatPlaceUnits(Math.max(0, rounded - 1), targetExponent),
      formatPlaceUnits(rounded + 1, targetExponent),
      formatPlaceUnits(rounded + 2, targetExponent),
      formatPlaceUnits(rounded + 3, targetExponent),
    ]),
    parameters: { inputScaled, inputScale, targetExponent },
    workedExample: definition.workedExample,
  })
}

export function generateDecimalNumberLineQuestion(
  difficulty: Difficulty,
): Unit2Question<'decimal-number-line', NumberLineParameters> {
  const scale = difficulty
  const intervalCount = 10
  const startScaled = ri(0, difficulty === 1 ? 90 : difficulty === 2 ? 990 : 9_990)
  const alignedStart = Math.floor(startScaled / intervalCount) * intervalCount
  const pointIndex = ri(1, intervalCount - 1)
  const endScaled = alignedStart + intervalCount
  const correctAnswer = formatScaledFixed(alignedStart + pointIndex, scale)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['decimal-number-line']
  return makeCurriculumQuestion({
    itemType: 'decimal-number-line',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A number line from ${formatScaledFixed(alignedStart, scale)} to ${formatScaledFixed(endScaled, scale)} has ${intervalCount} equal intervals. Point P is ${pointIndex} intervals after ${formatScaledFixed(alignedStart, scale)}. What number is P?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatScaledFixed(alignedStart + Math.max(0, pointIndex - 1), scale),
      formatScaledFixed(alignedStart + Math.min(intervalCount, pointIndex + 1), scale),
      formatScaledFixed(alignedStart + (intervalCount - pointIndex), scale),
      formatScaledFixed(alignedStart + pointIndex, Math.max(0, scale - 1)),
    ]),
    parameters: { startScaled: alignedStart, scale, intervalCount, pointIndex },
    visual: {
      kind: 'numberLine',
      min: Number(formatScaledFixed(alignedStart, scale)),
      max: Number(formatScaledFixed(endScaled, scale)),
      value: Number(correctAnswer),
    },
    workedExample: definition.workedExample,
  })
}

export function generatePlaceValueChartQuestion(
  difficulty: Difficulty,
): Unit2Question<'place-value-chart', PlaceValueChartParameters> {
  const exponents =
    difficulty === 1
      ? ([1, 0, -1] as const)
      : difficulty === 2
        ? ([2, 1, 0, -1, -2] as const)
        : ([3, 2, 1, 0, -1, -2, -3] as const)
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, exponents.length)
  const targetExponent = pick(exponents)
  const targetIndex = (exponents as readonly number[]).indexOf(targetExponent)
  const targetDigit = digits[targetIndex]
  const mode = difficulty === 1 ? 'digit' : difficulty === 2 ? 'value' : 'place'
  const correctAnswer =
    mode === 'digit'
      ? String(targetDigit)
      : mode === 'value'
        ? digitValue(targetDigit, targetExponent)
        : PLACE_BY_EXPONENT[targetExponent]
  const header = exponents.map((exponent) => PLACE_BY_EXPONENT[exponent]).join(' | ')
  const row = digits.join(' | ')
  const question =
    mode === 'digit'
      ? `What digit is in the ${PLACE_BY_EXPONENT[targetExponent]} place?`
      : mode === 'value'
        ? `What value does the ${targetDigit} in the ${PLACE_BY_EXPONENT[targetExponent]} place represent?`
        : `Which place contains the digit ${targetDigit}?`
  const distractors =
    mode === 'digit'
      ? digits.filter((digit) => digit !== targetDigit).map(String)
      : mode === 'value'
        ? uniqueExcept(correctAnswer, exponents.map((exponent) => digitValue(targetDigit, exponent)))
        : exponents.map((exponent) => PLACE_BY_EXPONENT[exponent]).filter((place) => place !== correctAnswer)
  const definition = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS['place-value-chart']
  return makeCurriculumQuestion({
    itemType: 'place-value-chart',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Place-value chart:\n${header}\n${row}\n${question}`,
    correctAnswer,
    distractors,
    choiceCount: mode === 'digit' ? 3 : 4,
    parameters: { exponents, digits, targetExponent, mode },
    workedExample: definition.workedExample,
  })
}

export const GRADE5_MATH_UNIT2_GENERATORS = {
  'adjacent-place-value': generateAdjacentPlaceValueQuestion,
  'power-of-ten-notation': generatePowerOfTenNotationQuestion,
  'multiply-by-power-of-ten': generateMultiplyByPowerOfTenQuestion,
  'divide-by-power-of-ten': generateDivideByPowerOfTenQuestion,
  'decimal-to-number-name': generateDecimalToNumberNameQuestion,
  'number-name-to-decimal': generateNumberNameToDecimalQuestion,
  'decimal-to-expanded-form': generateDecimalToExpandedFormQuestion,
  'expanded-form-to-decimal': generateExpandedFormToDecimalQuestion,
  'compare-decimals': generateCompareDecimalsQuestion,
  'round-decimal': generateRoundDecimalQuestion,
  'decimal-number-line': generateDecimalNumberLineQuestion,
  'place-value-chart': generatePlaceValueChartQuestion,
} satisfies Record<Grade5MathUnit2ItemType, CurriculumGenerator<Grade5MathUnit2Question>>

export function generateGrade5MathUnit2Question<TItemType extends Grade5MathUnit2ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade5MathUnit2Question, { itemType: TItemType }> {
  const generator = GRADE5_MATH_UNIT2_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade5MathUnit2Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
