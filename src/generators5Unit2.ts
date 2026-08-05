import type { Difficulty, Visual } from './types'
import { finishChoices, fromPool, pick, ri, shuffle } from './genUtils'

/**
 * Grade 5, Unit 2 pilot coverage contract. This module is deliberately not
 * registered in the student-facing skill trees or the shared generator router.
 */
export const GRADE5_UNIT2_ITEM_TYPES = [
  'place-value-relationship',
  'power-of-ten-notation',
  'multiply-by-power-of-ten',
  'divide-by-power-of-ten',
  'decimal-to-words',
  'words-to-decimal',
  'decimal-to-expanded-form',
  'expanded-form-to-decimal',
  'compare-decimals',
  'round-decimals',
  'decimal-number-line',
  'decimal-place-value-chart',
] as const

export type Grade5Unit2ItemType = (typeof GRADE5_UNIT2_ITEM_TYPES)[number]

export interface Grade5Unit2Question {
  itemType: Grade5Unit2ItemType
  difficulty: Difficulty
  prompt: string
  visual?: Extract<Visual, { kind: 'numberLine' }>
  choices: string[]
  answerIndex: number
}

export type Grade5Unit2Generator = (difficulty: Difficulty) => Grade5Unit2Question

const PLACE_NAMES = ['ones', 'tenths', 'hundredths', 'thousandths'] as const
const FRACTION_NAMES = ['tenths', 'hundredths', 'thousandths'] as const

function formatScaled(scaled: number, places: number, keepPlaces = false): string {
  const factor = 10 ** places
  const whole = Math.floor(scaled / factor)
  if (places === 0) return String(whole)
  let fraction = String(scaled % factor).padStart(places, '0')
  if (!keepPlaces) fraction = fraction.replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}

function positionalValue(digit: number, exponent: number): string {
  if (exponent >= 0) return String(digit * 10 ** exponent)
  return formatScaled(digit, -exponent)
}

function decimalAtPlace(scaledThousandths: number, places: number): string {
  const divisor = 10 ** (3 - places)
  return formatScaled(scaledThousandths / divisor, places, places > 0)
}

function makeQuestion(
  itemType: Grade5Unit2ItemType,
  difficulty: Difficulty,
  prompt: string,
  correct: string,
  distractors: string[],
  visual?: Grade5Unit2Question['visual'],
): Grade5Unit2Question {
  return {
    itemType,
    difficulty,
    prompt,
    ...(visual ? { visual } : {}),
    ...finishChoices(correct, fromPool(distractors.filter((choice) => choice !== correct))),
  }
}

function integerWords(n: number): string {
  const ones = [
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
  ]
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  if (n < 20) return ones[n]
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`
  const rest = n % 100
  return `${ones[Math.floor(n / 100)]} hundred${rest ? ` ${integerWords(rest)}` : ''}`
}

function decimalWords(whole: number, numerator: number, places: number): string {
  const fractionName = numerator === 1 ? FRACTION_NAMES[places - 1].slice(0, -1) : FRACTION_NAMES[places - 1]
  return `${integerWords(whole)} and ${integerWords(numerator)} ${fractionName}`
}

function expandedForm(scaled: number, places: number): string {
  const raw = String(scaled).padStart(places + 1, '0')
  const addends: string[] = []
  for (let index = 0; index < raw.length; index++) {
    const digit = Number(raw[index])
    if (digit === 0) continue
    const exponent = raw.length - places - index - 1
    addends.push(positionalValue(digit, exponent))
  }
  return addends.length ? addends.join(' + ') : '0'
}

function decimalParts(difficulty: Difficulty): { whole: number; numerator: number; places: number } {
  const places = difficulty
  const whole = ri(0, difficulty === 1 ? 9 : difficulty === 2 ? 25 : 99)
  const factor = 10 ** places
  let numerator = ri(1, factor - 1)
  if (difficulty === 3) {
    const pattern = pick(['random', 'middle-zero', 'trailing-zero'] as const)
    if (pattern === 'middle-zero') numerator = ri(1, 9) * 100 + ri(1, 9)
    if (pattern === 'trailing-zero') numerator = ri(1, 99) * 10
  }
  return { whole, numerator, places }
}

export const generatePlaceValueRelationship: Grade5Unit2Generator = (difficulty) => {
  const digit = ri(1, 9)
  const rightExponent =
    difficulty === 1 ? pick([-1, 0, 1] as const) : difficulty === 2 ? ri(-2, 2) : ri(-3, 3)
  const leftExponent = rightExponent + 1
  const askLeftToRight = pick([true, false] as const)
  const firstExponent = askLeftToRight ? leftExponent : rightExponent
  const secondExponent = askLeftToRight ? rightExponent : leftExponent
  const first = positionalValue(digit, firstExponent)
  const second = positionalValue(digit, secondExponent)
  const ratioPower = firstExponent - secondExponent
  const correct = ratioPower === 1 ? '10 times as much' : '1/10 as much'
  return makeQuestion(
    'place-value-relationship',
    difficulty,
    `A digit ${digit} has value ${first} in one number and value ${second} in another. How many times as much is ${first} as ${second}?`,
    correct,
    ['10 times as much', '1/10 as much', '100 times as much', 'the same amount'],
  )
}

export const generatePowerOfTenNotation: Grade5Unit2Generator = (difficulty) => {
  const exponent =
    difficulty === 1 ? ri(1, 3) : difficulty === 2 ? ri(3, 5) : ri(5, 6)
  const value = 10 ** exponent
  if (difficulty === 3) {
    const correct = `${exponent} zeros`
    return makeQuestion(
      'power-of-ten-notation',
      difficulty,
      `A nonzero whole number is multiplied by 10^${exponent}. How many zeros are appended to the original number?`,
      correct,
      [
        `${exponent - 1} zeros`,
        `${exponent + 1} zeros`,
        `${10 * exponent} zeros`,
        'no zeros',
      ],
    )
  }
  const askForValue = pick([true, false] as const)
  if (askForValue) {
    return makeQuestion(
      'power-of-ten-notation',
      difficulty,
      `What number is 10^${exponent}?`,
      value.toLocaleString('en-US'),
      [10 ** (exponent - 1), 10 ** (exponent + 1), exponent * 10, exponent]
        .map((n) => n.toLocaleString('en-US')),
    )
  }
  return makeQuestion(
    'power-of-ten-notation',
    difficulty,
    `Which power of ten equals ${value.toLocaleString('en-US')}?`,
    `10^${exponent}`,
    [`10^${Math.max(0, exponent - 1)}`, `10^${Math.min(6, exponent + 1)}`, `${exponent}^10`, `10^${value}`],
  )
}

export const generateMultiplyByPowerOfTen: Grade5Unit2Generator = (difficulty) => {
  const places = difficulty
  const exponent = ri(1, places)
  const factor = 10 ** places
  const scaled = ri(1, factor * (difficulty === 1 ? 9 : 4))
  const operand = formatScaled(scaled, places)
  const correct = formatScaled(scaled * 10 ** exponent, places)
  const distractors = [
    formatScaled(scaled * 10 ** Math.max(0, exponent - 1), places),
    formatScaled(scaled * 10 ** (exponent + 1), places),
    formatScaled(scaled, places + exponent),
    formatScaled(scaled + exponent, places),
  ]
  return makeQuestion(
    'multiply-by-power-of-ten',
    difficulty,
    `${operand} × 10^${exponent} = ?`,
    correct,
    distractors,
  )
}

export const generateDivideByPowerOfTen: Grade5Unit2Generator = (difficulty) => {
  const basePlaces = difficulty === 1 ? 0 : difficulty === 2 ? ri(0, 1) : ri(0, 2)
  const exponent = difficulty === 1 ? 1 : difficulty === 3 ? 3 - basePlaces : ri(1, 3 - basePlaces)
  const scaled = ri(11, difficulty === 1 ? 99 : 399)
  const operand = formatScaled(scaled, basePlaces)
  const correct = formatScaled(scaled, basePlaces + exponent)
  const distractors = [
    formatScaled(scaled, Math.max(0, basePlaces + exponent - 1)),
    formatScaled(scaled, basePlaces + exponent + 1),
    formatScaled(scaled * 10 ** exponent, basePlaces),
    formatScaled(scaled + exponent, basePlaces + exponent),
  ]
  return makeQuestion(
    'divide-by-power-of-ten',
    difficulty,
    `${operand} ÷ 10^${exponent} = ?`,
    correct,
    distractors,
  )
}

export const generateDecimalToWords: Grade5Unit2Generator = (difficulty) => {
  const { whole, numerator, places } = decimalParts(difficulty)
  const scaled = whole * 10 ** places + numerator
  const correct = decimalWords(whole, numerator, places)
  const factor = 10 ** places
  const adjacentNumerator = numerator === factor - 1 ? numerator - 1 : numerator + 1
  const otherNumerator = numerator <= 1 ? numerator + 2 : numerator - 1
  const alternatePlaces = places === 1 ? 2 : places - 1
  const alternateNumerator = places === 1 ? numerator : Math.max(1, Math.floor(numerator / 10) + 1)
  return makeQuestion(
    'decimal-to-words',
    difficulty,
    `How do you read ${formatScaled(scaled, places, true)}?`,
    correct,
    [
      decimalWords(whole, alternateNumerator, alternatePlaces),
      decimalWords(whole, adjacentNumerator, places),
      decimalWords(whole, otherNumerator, places),
      decimalWords(whole + 1, numerator, places),
    ],
  )
}

export const generateWordsToDecimal: Grade5Unit2Generator = (difficulty) => {
  const { whole, numerator, places } = decimalParts(difficulty)
  const scaled = whole * 10 ** places + numerator
  const correct = formatScaled(scaled, places, true)
  const factor = 10 ** places
  const changedNumerator = (numerator + 10 ** (places - 1)) % factor
  const adjacentNumerator = numerator === factor - 1 ? numerator - 1 : numerator + 1
  return makeQuestion(
    'words-to-decimal',
    difficulty,
    `Write ${decimalWords(whole, numerator, places)} as a decimal.`,
    correct,
    [
      formatScaled(whole * factor + adjacentNumerator, places, true),
      formatScaled(whole * factor + changedNumerator, places, true),
      formatScaled((whole + 1) * 10 ** places + numerator, places, true),
      formatScaled(whole * 10 ** places + Math.max(0, numerator - 1), places, true),
    ],
  )
}

export const generateDecimalToExpandedForm: Grade5Unit2Generator = (difficulty) => {
  const { whole, numerator, places } = decimalParts(difficulty)
  const scaled = whole * 10 ** places + numerator
  const correct = expandedForm(scaled, places)
  return makeQuestion(
    'decimal-to-expanded-form',
    difficulty,
    `Which is the expanded form of ${formatScaled(scaled, places, true)}?`,
    correct,
    [
      expandedForm(scaled + 1, places),
      expandedForm(scaled + 10, places),
      expandedForm(scaled * 10, places),
      expandedForm(Math.max(1, scaled - 1), places),
    ],
  )
}

export const generateExpandedFormToDecimal: Grade5Unit2Generator = (difficulty) => {
  const { whole, numerator, places } = decimalParts(difficulty)
  const scaled = whole * 10 ** places + numerator
  const correct = formatScaled(scaled, places, true)
  return makeQuestion(
    'expanded-form-to-decimal',
    difficulty,
    `${expandedForm(scaled, places)} = ?`,
    correct,
    [
      formatScaled(scaled + 1, places, true),
      formatScaled(scaled + 10, places, true),
      formatScaled(scaled * 10, places, true),
      formatScaled(Math.max(1, scaled - 1), places, true),
    ],
  )
}

export const generateCompareDecimals: Grade5Unit2Generator = (difficulty) => {
  let left: string
  let right: string
  if (difficulty === 1) {
    const a = ri(1, 89)
    const b = a + pick([-10, -1, 1, 10] as const)
    left = formatScaled(a, 2)
    right = formatScaled(Math.max(0, b), 2)
  } else if (difficulty === 2) {
    const prefix = ri(0, 40) * 10
    const a = prefix + ri(0, 9)
    let b = prefix + ri(0, 9)
    if (a === b) b = prefix + ((b + 1) % 10)
    left = formatScaled(a, 3, true)
    right = formatScaled(b, 3, true)
  } else if (pick([true, false] as const)) {
    const tenths = ri(1, 9)
    const zeros = pick([1, 2] as const)
    left = `0.${tenths}${'0'.repeat(zeros)}`
    right = `0.${tenths}`
  } else {
    const a = ri(1, 999)
    const b = a + pick([-1, 1] as const)
    left = formatScaled(a, 3, true)
    right = formatScaled(Math.max(0, b), 3, true)
  }
  const leftValue = Number(left)
  const rightValue = Number(right)
  const correct = leftValue === rightValue ? '=' : leftValue > rightValue ? '>' : '<'
  const choices = shuffle(['<', '=', '>'])
  return {
    itemType: 'compare-decimals',
    difficulty,
    prompt: `Which symbol makes the statement true? ${left} ___ ${right}`,
    choices,
    answerIndex: choices.indexOf(correct),
  }
}

export const generateRoundDecimals: Grade5Unit2Generator = (difficulty) => {
  const targetPlaces = difficulty === 1 ? 1 : pick([0, 1, 2] as const)
  const unit = 10 ** (3 - targetPlaces)
  let scaled: number
  if (difficulty === 3) {
    scaled = ri(0, Math.floor(99000 / unit)) * unit + unit / 2
  } else {
    scaled = ri(1, 98999)
    if (scaled % unit === unit / 2) scaled += 1
  }
  const rounded = Math.floor((scaled + unit / 2) / unit) * unit
  const floor = Math.floor(scaled / unit) * unit
  const ceil = Math.ceil(scaled / unit) * unit
  const placeName = PLACE_NAMES[targetPlaces]
  const correct = decimalAtPlace(rounded, targetPlaces)
  const candidateValues = [floor, ceil, rounded - unit, rounded + unit, rounded - 2 * unit, rounded + 2 * unit, rounded + 3 * unit]
  const distractors = [...new Set(candidateValues)]
    .filter((candidate) => candidate >= 0 && candidate !== rounded)
    .map((candidate) => decimalAtPlace(candidate, targetPlaces))
  return makeQuestion(
    'round-decimals',
    difficulty,
    `Round ${formatScaled(scaled, 3, true)} to the nearest ${targetPlaces === 0 ? 'whole number' : placeName.slice(0, -1)}.`,
    correct,
    distractors,
  )
}

export const generateDecimalNumberLine: Grade5Unit2Generator = (difficulty) => {
  const step = difficulty === 1 ? 100 : difficulty === 2 ? 10 : 1
  const start = ri(0, difficulty === 1 ? 50 : difficulty === 2 ? 5000 : 9900) * step
  const tick = ri(1, 9)
  const end = start + step * 10
  const value = start + step * tick
  const places = difficulty
  const startText = formatScaled(start, 3, places === 3)
  const endText = formatScaled(end, 3, places === 3)
  const correct = formatScaled(value, 3, places === 3)
  return makeQuestion(
    'decimal-number-line',
    difficulty,
    `A number line goes from ${startText} to ${endText} in 10 equal intervals. Point P is ${tick} interval${tick === 1 ? '' : 's'} to the right of ${startText}. What number is at P?`,
    correct,
    [
      formatScaled(value - step, 3, places === 3),
      formatScaled(value + step, 3, places === 3),
      formatScaled(start + step * (10 - tick), 3, places === 3),
      formatScaled(start + tick * step * 10, 3, places === 3),
    ],
    { kind: 'numberLine', min: Number(startText), max: Number(endText), value: Number(correct) },
  )
}

export const generateDecimalPlaceValueChart: Grade5Unit2Generator = (difficulty) => {
  const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4)
  if (digits[0] === 0) [digits[0], digits[1]] = [digits[1], digits[0]]
  const chart = `ones=${digits[0]}, tenths=${digits[1]}, hundredths=${digits[2]}, thousandths=${digits[3]}`
  if (difficulty === 1) {
    const target = ri(1, 3)
    return makeQuestion(
      'decimal-place-value-chart',
      difficulty,
      `A place-value chart shows ${chart}. Which digit is in the ${PLACE_NAMES[target]} place?`,
      String(digits[target]),
      digits.filter((_, index) => index !== target).map(String),
    )
  }
  if (difficulty === 2) {
    const target = pick([1, 2, 3].filter((index) => digits[index] !== 0))
    const correct = positionalValue(digits[target], -target)
    return makeQuestion(
      'decimal-place-value-chart',
      difficulty,
      `A place-value chart shows ${chart}. What is the value of the digit in the ${PLACE_NAMES[target]} place?`,
      correct,
      [
        positionalValue(digits[target], -Math.max(0, target - 1)),
        positionalValue(digits[target], -(target + 1)),
        String(digits[target]),
        positionalValue((digits[target] + 1) % 10, -target),
      ],
    )
  }
  const scaled = digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3]
  return makeQuestion(
    'decimal-place-value-chart',
    difficulty,
    `A place-value chart shows ${chart}. What number does the chart represent?`,
    formatScaled(scaled, 3, true),
    [
      formatScaled(digits[0] * 1000 + digits[1] * 10 + digits[2] * 100 + digits[3], 3, true),
      formatScaled(scaled * 10, 3, true),
      formatScaled(Math.floor(scaled / 10), 3, true),
      formatScaled(scaled + 1, 3, true),
    ],
  )
}

export const GRADE5_UNIT2_GENERATORS = {
  'place-value-relationship': generatePlaceValueRelationship,
  'power-of-ten-notation': generatePowerOfTenNotation,
  'multiply-by-power-of-ten': generateMultiplyByPowerOfTen,
  'divide-by-power-of-ten': generateDivideByPowerOfTen,
  'decimal-to-words': generateDecimalToWords,
  'words-to-decimal': generateWordsToDecimal,
  'decimal-to-expanded-form': generateDecimalToExpandedForm,
  'expanded-form-to-decimal': generateExpandedFormToDecimal,
  'compare-decimals': generateCompareDecimals,
  'round-decimals': generateRoundDecimals,
  'decimal-number-line': generateDecimalNumberLine,
  'decimal-place-value-chart': generateDecimalPlaceValueChart,
} satisfies Record<Grade5Unit2ItemType, Grade5Unit2Generator>

export function generateGrade5Unit2Question(
  itemType: Grade5Unit2ItemType,
  difficulty: Difficulty,
): Grade5Unit2Question {
  return GRADE5_UNIT2_GENERATORS[itemType](difficulty)
}

/** Authored teaching prose; these are examples, not randomized graded items. */
export const GRADE5_UNIT2_WORKED_EXAMPLES: Record<Grade5Unit2ItemType, string> = {
  'place-value-relationship':
    'In 4.44, the 4 in the tenths place is 0.4 and the 4 in the hundredths place is 0.04. Since 0.4 ÷ 0.04 = 10, the left 4 is worth 10 times as much.',
  'power-of-ten-notation':
    'The exponent tells how many factors of 10 are multiplied: 10^3 = 10 × 10 × 10 = 1,000.',
  'multiply-by-power-of-ten':
    'To find 0.37 × 100, multiply by 10 twice: 0.37 → 3.7 → 37. The product is 37.',
  'divide-by-power-of-ten':
    'To find 6.2 ÷ 100, divide by 10 twice: 6.2 → 0.62 → 0.062. The quotient is 0.062.',
  'decimal-to-words':
    'The last digit of 12.305 is in the thousandths place, so read it as “twelve and three hundred five thousandths.”',
  'words-to-decimal':
    '“Seven and forty-two hundredths” means 7 wholes plus 42/100, so write 7.42.',
  'decimal-to-expanded-form':
    'In 3.406, the nonzero digits are 3 ones, 4 tenths, and 6 thousandths, so the expanded form is 3 + 0.4 + 0.006.',
  'expanded-form-to-decimal':
    'Line up each addend by place: 20 + 5 + 0.08 + 0.003 = 25.083.',
  'compare-decimals':
    'Compare 0.6 and 0.58 by writing 0.6 as 0.60. Since 60 hundredths is greater than 58 hundredths, 0.6 > 0.58.',
  'round-decimals':
    'To round 4.35 to the nearest tenth, look at the hundredths digit. It is 5, so increase the tenths digit: 4.35 rounds to 4.4.',
  'decimal-number-line':
    'From 1.20 to 1.30, ten equal intervals each represent 0.01. Six intervals after 1.20 is 1.26.',
  'decimal-place-value-chart':
    'A chart with 2 ones, 7 tenths, 0 hundredths, and 5 thousandths represents 2 + 0.7 + 0 + 0.005 = 2.705.',
}
