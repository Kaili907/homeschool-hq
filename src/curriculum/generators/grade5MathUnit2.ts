import type { Difficulty } from '../../types'
import { pick, ri } from '../../genUtils'
import {
  curriculumMultipleChoice,
  formatThousandths,
  roundThousandths,
  THOUSANDTHS_SCALE,
  toThousandths,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type WorkedExample,
} from './shared'

/**
 * Coverage contract derived from Manuel Academy Grade 5 Mathematics Unit 2:
 * "Place Value, Powers of Ten, and Decimals" (5.NBT.1-5.NBT.4).
 */
export const UNIT2_ITEM_TYPES = [
  'powers-of-ten-patterns',
  'reading-decimals-through-thousandths',
  'expanded-form',
  'comparing-decimals',
  'rounding-decimals',
  'number-lines-and-place-value-charts',
] as const

export type Unit2ItemType = (typeof UNIT2_ITEM_TYPES)[number]

const SMALL_NUMBER_WORDS = [
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

const TENS_WORDS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
] as const

const DENOMINATORS = ['tenths', 'hundredths', 'thousandths'] as const

function numberWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999) {
    throw new Error('numberWords supports integers from 0 through 999')
  }
  if (value < 20) return SMALL_NUMBER_WORDS[value]
  if (value < 100) {
    const tens = Math.floor(value / 10)
    const ones = value % 10
    return ones === 0 ? TENS_WORDS[tens] : `${TENS_WORDS[tens]}-${SMALL_NUMBER_WORDS[ones]}`
  }
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  return remainder === 0
    ? `${SMALL_NUMBER_WORDS[hundreds]} hundred`
    : `${SMALL_NUMBER_WORDS[hundreds]} hundred ${numberWords(remainder)}`
}

function denominatorName(places: 1 | 2 | 3, numerator: number): string {
  const plural = DENOMINATORS[places - 1]
  return numerator === 1 ? plural.slice(0, -1) : plural
}

function decimalWords(scaled: number, places: 1 | 2 | 3): string {
  const whole = Math.floor(scaled / THOUSANDTHS_SCALE)
  const fractionalDigits =
    (scaled % THOUSANDTHS_SCALE) / 10 ** (3 - places)
  return `${numberWords(whole)} and ${numberWords(fractionalDigits)} ${denominatorName(places, fractionalDigits)}`
}

function distinctScaledDistractors(
  correct: number,
  candidates: number[],
  minimumPlaces: 0 | 1 | 2 | 3 = 0,
): string[] {
  const seen = new Set<string>()
  for (const value of candidates) {
    if (!Number.isSafeInteger(value) || value < 0 || value === correct) continue
    seen.add(formatThousandths(value, minimumPlaces))
  }
  return [...seen]
}

type PowerOperation = '\u00d7' | '\u00f7'

interface PowerCalculation {
  baseScaled: number
  exponent: number
  operation: PowerOperation
  correctScaled: number
}

function makePowerCalculation(difficulty: Difficulty): PowerCalculation {
  let baseScaled: number
  let exponent: number
  let operation: PowerOperation

  if (difficulty === 1) {
    baseScaled = ri(2, 90) * THOUSANDTHS_SCALE
    exponent = 1
    operation = '\u00d7'
  } else if (difficulty === 2) {
    const places = pick([1, 2] as const)
    baseScaled = toThousandths(ri(0, 9), ri(1, 10 ** places - 1), places)
    exponent = pick([1, 2] as const)
    operation = '\u00d7'
  } else {
    exponent = ri(1, 3)
    const factor = 10 ** exponent
    operation = ri(0, 1) === 0 ? '\u00d7' : '\u00f7'
    if (operation === '\u00d7') {
      do baseScaled = ri(1, 999)
      while (baseScaled * factor < THOUSANDTHS_SCALE)
    } else {
      let resultScaled: number
      do resultScaled = ri(1, 999)
      while (resultScaled * factor < THOUSANDTHS_SCALE)
      baseScaled = resultScaled * factor
    }
  }

  const factor = 10 ** exponent
  const correctScaled = operation === '\u00d7' ? baseScaled * factor : baseScaled / factor
  return { baseScaled, exponent, operation, correctScaled }
}

function generatePowerComputation(
  difficulty: Difficulty,
): CurriculumQuestion<Unit2ItemType> {
  const { baseScaled, exponent, operation, correctScaled } = makePowerCalculation(difficulty)
  const factor = 10 ** exponent
  const reverseScaled = operation === '\u00d7' ? baseScaled / factor : baseScaled * factor
  const smallerFactor = 10 ** Math.max(0, exponent - 1)
  const largerFactor = 10 ** (exponent + 1)
  const candidates = operation === '\u00d7'
    ? [
        baseScaled,
        reverseScaled,
        baseScaled * smallerFactor,
        baseScaled * largerFactor,
        baseScaled + factor * THOUSANDTHS_SCALE,
      ]
    : [
        baseScaled,
        reverseScaled,
        baseScaled / smallerFactor,
        baseScaled / largerFactor,
        baseScaled + factor * THOUSANDTHS_SCALE,
      ]

  return curriculumMultipleChoice(
    'powers-of-ten-patterns',
    difficulty,
    `Compute ${formatThousandths(baseScaled)} ${operation} 10^${exponent}.`,
    formatThousandths(correctScaled),
    distinctScaledDistractors(correctScaled, candidates),
  )
}

const ADJACENT_PLACE_PAIRS = [
  { left: 'tens', right: 'ones', leftScale: 10_000, rightScale: 1000, places: 0 },
  { left: 'ones', right: 'tenths', leftScale: 1000, rightScale: 100, places: 1 },
  { left: 'tenths', right: 'hundredths', leftScale: 100, rightScale: 10, places: 2 },
  { left: 'hundredths', right: 'thousandths', leftScale: 10, rightScale: 1, places: 3 },
] as const

function generateAdjacentPlaceRelationship(
  difficulty: Difficulty,
): CurriculumQuestion<Unit2ItemType> {
  const pair = pick(ADJACENT_PLACE_PAIRS)
  const digit = ri(1, 9)
  const scaled = digit * pair.leftScale + digit * pair.rightScale
  const askLeft = ri(0, 1) === 0
  const askedPlace = askLeft ? pair.left : pair.right
  const otherPlace = askLeft ? pair.right : pair.left
  const askedScale = askLeft ? pair.leftScale : pair.rightScale
  const otherScale = askLeft ? pair.rightScale : pair.leftScale
  const ratio = askedScale / otherScale
  const correct = ratio === 10 ? '10 times as much' : '1/10 as much'

  return curriculumMultipleChoice(
    'powers-of-ten-patterns',
    difficulty,
    `In ${formatThousandths(scaled, pair.places)}, the digit ${digit} appears in the ${pair.left} place and the ${pair.right} place. The ${askedPlace}-place digit is how much of the value of the ${otherPlace}-place digit?`,
    correct,
    ['10 times as much', '1/10 as much', '100 times as much', '1/100 as much', 'the same value'],
  )
}

function generatePowerPatternExplanation(
  difficulty: Difficulty,
): CurriculumQuestion<Unit2ItemType> {
  const { baseScaled, exponent, operation, correctScaled } = makePowerCalculation(difficulty)
  const factor = 10 ** exponent
  const placeWord = exponent === 1 ? 'place' : 'places'
  const multiplied = `Each digit has ${factor} times its original value, so the decimal point is written ${exponent} ${placeWord} farther right.`
  const divided = `Each digit has 1/${factor} of its original value, so the decimal point is written ${exponent} ${placeWord} farther left.`
  const correct = operation === '\u00d7' ? multiplied : divided

  return curriculumMultipleChoice(
    'powers-of-ten-patterns',
    difficulty,
    `A student computed ${formatThousandths(baseScaled)} ${operation} 10^${exponent} = ${formatThousandths(correctScaled)}. Which statement explains the power-of-ten pattern?`,
    correct,
    [
      operation === '\u00d7' ? divided : multiplied,
      `Each digit keeps its original value; only the operation symbol changes the answer.`,
      `The exponent means add ${exponent} to the original number.`,
      `Only digits to the right of the decimal point change value.`,
    ],
  )
}

export const generatePowersOfTenPatterns: CurriculumGenerator<Unit2ItemType> = (difficulty) => {
  if (difficulty === 1) return generateAdjacentPlaceRelationship(difficulty)
  if (difficulty === 3 && ri(0, 2) === 0) return generatePowerPatternExplanation(difficulty)
  return generatePowerComputation(difficulty)
}

function decimalReadingParts(difficulty: Difficulty): {
  scaled: number
  places: 1 | 2 | 3
} {
  if (difficulty === 1) {
    const places = pick([1, 2] as const)
    return {
      scaled: toThousandths(ri(0, 20), ri(1, 10 ** places - 1), places),
      places,
    }
  }
  if (difficulty === 2) {
    return {
      scaled: toThousandths(ri(0, 99), ri(1, 999), 3),
      places: 3,
    }
  }
  // Retaining a final zero makes the named denominator instructionally relevant.
  return {
    scaled: toThousandths(ri(0, 99), ri(1, 99) * 10, 3),
    places: 3,
  }
}

export const generateReadingDecimalsThroughThousandths: CurriculumGenerator<Unit2ItemType> = (
  difficulty,
) => {
  const { scaled, places } = decimalReadingParts(difficulty)
  const decimal = formatThousandths(scaled, places)
  const words = decimalWords(scaled, places)
  const whole = Math.floor(scaled / THOUSANDTHS_SCALE)
  const fractionalDigits = (scaled % THOUSANDTHS_SCALE) / 10 ** (3 - places)

  if (difficulty === 3 && ri(0, 1) === 1) {
    const neighboringFraction = fractionalDigits === 10 ** places - 1
      ? fractionalDigits - 1
      : fractionalDigits + 1
    const candidates = [
      toThousandths(whole, neighboringFraction, places),
      toThousandths(whole + 1, fractionalDigits, places),
      whole * THOUSANDTHS_SCALE + fractionalDigits * 10 ** Math.max(0, 4 - places),
    ]
    return curriculumMultipleChoice(
      'reading-decimals-through-thousandths',
      difficulty,
      `Which decimal matches "${words}"?`,
      decimal,
      distinctScaledDistractors(scaled, candidates, places),
    )
  }

  const wrongDenominators = DENOMINATORS
    .map((_, index) => (index + 1) as 1 | 2 | 3)
    .filter((wrongPlaces) => wrongPlaces !== places)
    .map((wrongPlaces) => `${numberWords(whole)} and ${numberWords(fractionalDigits)} ${denominatorName(wrongPlaces, fractionalDigits)}`)
  const neighboringFraction = fractionalDigits === 999 ? 998 : fractionalDigits + 1
  const wordDistractors = [
    ...wrongDenominators,
    `${numberWords(whole)} and ${numberWords(neighboringFraction)} ${denominatorName(places, neighboringFraction)}`,
    `${numberWords(whole + 1)} and ${numberWords(fractionalDigits)} ${denominatorName(places, fractionalDigits)}`,
  ].filter((candidate) => candidate !== words)

  return curriculumMultipleChoice(
    'reading-decimals-through-thousandths',
    difficulty,
    `Which is the word form of ${decimal}?`,
    words,
    wordDistractors,
  )
}

function expandedForm(scaled: number): string {
  const terms: string[] = []
  const whole = Math.floor(scaled / THOUSANDTHS_SCALE)
  for (const place of [100, 10, 1]) {
    const digit = Math.floor(whole / place) % 10
    if (digit !== 0) terms.push(String(digit * place))
  }
  const fraction = scaled % THOUSANDTHS_SCALE
  for (const placeScaled of [100, 10, 1]) {
    const digit = Math.floor(fraction / placeScaled) % 10
    if (digit !== 0) terms.push(formatThousandths(digit * placeScaled))
  }
  return terms.length > 0 ? terms.join(' + ') : '0'
}

function expandedDistractors(correctScaled: number): string[] {
  const wholeScaled = Math.floor(correctScaled / THOUSANDTHS_SCALE) * THOUSANDTHS_SCALE
  const fraction = correctScaled % THOUSANDTHS_SCALE
  const tenths = Math.floor(fraction / 100)
  const hundredths = Math.floor(fraction / 10) % 10
  const thousandths = fraction % 10
  const candidates = [
    wholeScaled + hundredths * 100 + tenths * 10 + thousandths,
    wholeScaled + tenths * 100 + thousandths * 10 + hundredths,
    correctScaled + 90,
    correctScaled - 90,
    correctScaled + 9,
    correctScaled - 9,
  ]
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (candidate < 0 || candidate === correctScaled) continue
    seen.add(expandedForm(candidate))
  }
  return [...seen]
}

export const generateExpandedForm: CurriculumGenerator<Unit2ItemType> = (difficulty) => {
  let scaled: number
  let places: 2 | 3
  if (difficulty === 1) {
    const fraction = ri(1, 9) * 10 + ri(1, 9)
    scaled = toThousandths(ri(0, 9), fraction, 2)
    places = 2
  } else if (difficulty === 2) {
    scaled = toThousandths(ri(10, 99), ri(1, 999), 3)
    places = 3
  } else {
    // A zero hundredths digit checks that zero-value places are omitted correctly.
    const fraction = ri(1, 9) * 100 + ri(1, 9)
    scaled = toThousandths(ri(100, 999), fraction, 3)
    places = 3
  }

  return curriculumMultipleChoice(
    'expanded-form',
    difficulty,
    `Which is the expanded form of ${formatThousandths(scaled, places)}?`,
    expandedForm(scaled),
    expandedDistractors(scaled),
  )
}

export const generateComparingDecimals: CurriculumGenerator<Unit2ItemType> = (difficulty) => {
  let leftScaled: number
  let rightScaled: number
  let leftPlaces: 1 | 2 | 3
  let rightPlaces: 1 | 2 | 3

  if (difficulty === 1) {
    leftPlaces = rightPlaces = pick([1, 2] as const)
    leftScaled = toThousandths(ri(0, 20), ri(0, 10 ** leftPlaces - 1), leftPlaces)
    do {
      rightScaled = toThousandths(ri(0, 20), ri(0, 10 ** rightPlaces - 1), rightPlaces)
    } while (rightScaled === leftScaled)
  } else if (difficulty === 2) {
    leftPlaces = 1
    rightPlaces = 3
    leftScaled = toThousandths(ri(0, 50), ri(0, 9), 1)
    const delta = pick([-50, -10, 10, 50] as const)
    rightScaled = Math.max(0, leftScaled + delta)
    if (rightScaled === leftScaled) rightScaled += 10
  } else if (ri(0, 2) === 0) {
    leftPlaces = pick([1, 2] as const)
    rightPlaces = 3
    leftScaled = toThousandths(ri(0, 99), ri(0, 10 ** leftPlaces - 1), leftPlaces)
    rightScaled = leftScaled
  } else {
    leftPlaces = rightPlaces = 3
    leftScaled = toThousandths(ri(0, 99), ri(1, 998), 3)
    rightScaled = Math.max(0, leftScaled + pick([-9, -1, 1, 9] as const))
  }

  const correct = leftScaled < rightScaled ? '<' : leftScaled > rightScaled ? '>' : '='
  return curriculumMultipleChoice(
    'comparing-decimals',
    difficulty,
    `Which symbol makes this comparison true?\n${formatThousandths(leftScaled, leftPlaces)} __ ${formatThousandths(rightScaled, rightPlaces)}`,
    correct,
    ['<', '>', '='].filter((symbol) => symbol !== correct),
    { count: 3 },
  )
}

const ROUNDING_PLACE_NAMES = ['whole number', 'tenth', 'hundredth'] as const

export const generateRoundingDecimals: CurriculumGenerator<Unit2ItemType> = (difficulty) => {
  let targetPlaces: 0 | 1 | 2
  let scaled: number

  if (difficulty === 1) {
    targetPlaces = pick([0, 1] as const)
    scaled = toThousandths(ri(0, 99), ri(1, 999), 3)
  } else if (difficulty === 2) {
    targetPlaces = pick([1, 2] as const)
    scaled = toThousandths(ri(0, 999), ri(1, 999), 3)
  } else {
    targetPlaces = pick([0, 1, 2] as const)
    const quantum = 10 ** (3 - targetPlaces)
    const lowerMultiple = ri(0, Math.floor(999_000 / quantum)) * quantum
    scaled = lowerMultiple + quantum / 2
  }

  const quantum = 10 ** (3 - targetPlaces)
  const correctScaled = roundThousandths(scaled, targetPlaces)
  const lower = Math.floor(scaled / quantum) * quantum
  const upper = lower + quantum
  const candidates = [
    lower,
    upper,
    correctScaled - quantum,
    correctScaled + quantum,
    correctScaled - 2 * quantum,
    correctScaled + 2 * quantum,
    correctScaled + 3 * quantum,
  ]

  return curriculumMultipleChoice(
    'rounding-decimals',
    difficulty,
    `Round ${formatThousandths(scaled, 3)} to the nearest ${ROUNDING_PLACE_NAMES[targetPlaces]}.`,
    formatThousandths(correctScaled, targetPlaces),
    distinctScaledDistractors(correctScaled, candidates, targetPlaces),
  )
}

const PLACE_NAMES = ['tenths', 'hundredths', 'thousandths'] as const
const PLACE_SCALES = [100, 10, 1] as const

function generatePlaceValueChart(
  difficulty: Difficulty,
): CurriculumQuestion<Unit2ItemType> {
  const places: 2 | 3 = difficulty === 1 ? 2 : 3
  const digits = [ri(1, 9), ri(1, 9), ri(1, 9)]
  const targetIndex = ri(0, places - 1)
  const fraction = digits[0] * 100 + digits[1] * 10 + (places === 3 ? digits[2] : 0)
  const scaled = ri(1, difficulty === 1 ? 99 : 999) * THOUSANDTHS_SCALE + fraction
  const digit = digits[targetIndex]
  const correctScaled = digit * PLACE_SCALES[targetIndex]
  const whole = Math.floor(scaled / THOUSANDTHS_SCALE)
  const chartDigits = [
    Math.floor(whole / 100) % 10,
    Math.floor(whole / 10) % 10,
    whole % 10,
    digits[0],
    digits[1],
    places === 3 ? digits[2] : 0,
  ]
  const candidates = [
    digit * THOUSANDTHS_SCALE,
    ...PLACE_SCALES.map((placeScale) => digit * placeScale),
  ]

  return curriculumMultipleChoice(
    'number-lines-and-place-value-charts',
    difficulty,
    `Place-value chart for ${formatThousandths(scaled, places)}:\nhundreds | tens | ones | tenths | hundredths | thousandths\n${chartDigits.join(' | ')}\nWhat is the value of the digit ${digit} in the ${PLACE_NAMES[targetIndex]} place?`,
    formatThousandths(correctScaled),
    distinctScaledDistractors(correctScaled, candidates),
  )
}

function generateNumberLine(
  difficulty: Difficulty,
): CurriculumQuestion<Unit2ItemType> {
  const stepScaled = difficulty === 2
    ? pick([100, 10] as const)
    : pick([10, 1] as const)
  const places: 1 | 2 | 3 = stepScaled === 100 ? 1 : stepScaled === 10 ? 2 : 3
  const span = stepScaled * 10
  const rawStart = ri(0, 500_000)
  const startScaled = Math.floor(rawStart / span) * span
  const endScaled = startScaled + span
  const tick = ri(1, 9)
  const correctScaled = startScaled + tick * stepScaled
  const candidates = [
    correctScaled - stepScaled,
    correctScaled + stepScaled,
    startScaled + (10 - tick) * stepScaled,
    startScaled + Math.min(10, tick + 2) * stepScaled,
  ]

  return curriculumMultipleChoice(
    'number-lines-and-place-value-charts',
    difficulty,
    `A number line starts at ${formatThousandths(startScaled, places)} and ends at ${formatThousandths(endScaled, places)} with 10 equal intervals. What value is at tick ${tick} after the start?`,
    formatThousandths(correctScaled, places),
    distinctScaledDistractors(correctScaled, candidates, places),
  )
}

export const generateNumberLinesAndPlaceValueCharts: CurriculumGenerator<Unit2ItemType> = (
  difficulty,
) => {
  if (difficulty === 1 || (difficulty === 3 && ri(0, 1) === 0)) {
    return generatePlaceValueChart(difficulty)
  }
  return generateNumberLine(difficulty)
}

/** Registry is exhaustive over the curriculum-derived coverage contract. */
export const UNIT2_GENERATORS = {
  'powers-of-ten-patterns': generatePowersOfTenPatterns,
  'reading-decimals-through-thousandths': generateReadingDecimalsThroughThousandths,
  'expanded-form': generateExpandedForm,
  'comparing-decimals': generateComparingDecimals,
  'rounding-decimals': generateRoundingDecimals,
  'number-lines-and-place-value-charts': generateNumberLinesAndPlaceValueCharts,
} satisfies Record<Unit2ItemType, CurriculumGenerator<Unit2ItemType>>

export function generateUnit2Question(
  itemType: Unit2ItemType,
  difficulty: Difficulty,
): CurriculumQuestion<Unit2ItemType> {
  return UNIT2_GENERATORS[itemType](difficulty)
}

/** One concise, authored teaching model per item type; these are not graded items. */
export const UNIT2_WORKED_EXAMPLES = {
  'powers-of-ten-patterns': {
    itemType: 'powers-of-ten-patterns',
    problem: 'Compute 0.47 \u00d7 10^2.',
    teaching: 'Multiplying by 10 twice makes every digit worth 100 times as much: 0.47 -> 4.7 -> 47.',
    answer: '47',
  },
  'reading-decimals-through-thousandths': {
    itemType: 'reading-decimals-through-thousandths',
    problem: 'Read 6.305 in words.',
    teaching: 'The final digit is in the thousandths place, so name 305 as the fractional part.',
    answer: 'six and three hundred five thousandths',
  },
  'expanded-form': {
    itemType: 'expanded-form',
    problem: 'Write 12.304 in expanded form.',
    teaching: 'Keep each nonzero digit with its place value: one ten, two ones, three tenths, and four thousandths.',
    answer: '10 + 2 + 0.3 + 0.004',
  },
  'comparing-decimals': {
    itemType: 'comparing-decimals',
    problem: 'Compare 4.070 and 4.7.',
    teaching: 'Write 4.7 as 4.700. The whole numbers match, but 70 thousandths is less than 700 thousandths.',
    answer: '4.070 < 4.7',
  },
  'rounding-decimals': {
    itemType: 'rounding-decimals',
    problem: 'Round 8.675 to the nearest hundredth.',
    teaching: 'The thousandths digit is 5, so increase the hundredths digit from 7 to 8.',
    answer: '8.68',
  },
  'number-lines-and-place-value-charts': {
    itemType: 'number-lines-and-place-value-charts',
    problem: 'A line from 2.30 to 2.40 has 10 equal intervals. Find tick 6 after 2.30.',
    teaching: 'Each interval is one hundredth. Six intervals add 0.06; a place-value chart confirms 6 in the hundredths place.',
    answer: '2.36',
  },
} satisfies Record<Unit2ItemType, WorkedExample<Unit2ItemType>>
