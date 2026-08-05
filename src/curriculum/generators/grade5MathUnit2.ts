import { finishChoices, fromPool, pick, ri } from '../../genUtils'
import type { Difficulty } from '../../types'

/**
 * Coverage contract derived from the custody-verified curriculum package:
 * Grade 5 mathematics, Unit 2, course days 19-36 (5.NBT.1-5.NBT.4).
 *
 * This module is deliberately not registered in the student-facing skill tree.
 */
export const UNIT2_ITEM_TYPE_CHECKLIST = [
  {
    id: 'adjacent-place-relationship',
    standard: '5.NBT.1',
    coverage:
      'Relate the values of the same digit in adjacent places as 10 times or one tenth, including across ones and tenths.',
  },
  {
    id: 'powers-of-ten-pattern',
    standard: '5.NBT.2',
    coverage:
      'Multiply and divide whole numbers and decimals by powers of ten written with whole-number exponents.',
  },
  {
    id: 'decimal-number-name',
    standard: '5.NBT.3',
    coverage:
      'Read and write decimals through thousandths in base-ten numeral and number-name forms.',
  },
  {
    id: 'decimal-expanded-form',
    standard: '5.NBT.3',
    coverage: 'Read and write decimals through thousandths in base-ten numeral and expanded forms.',
  },
  {
    id: 'compare-decimals',
    standard: '5.NBT.3',
    coverage:
      'Compare decimals through thousandths with >, <, and =, including equivalent forms with trailing zeros.',
  },
  {
    id: 'round-decimal',
    standard: '5.NBT.4',
    coverage: 'Round decimals to an indicated whole-number or decimal place.',
  },
  {
    id: 'decimal-number-line',
    standard: '5.NBT.3-5.NBT.4 representation',
    coverage: 'Locate and read decimals through thousandths on equally partitioned number lines.',
  },
  {
    id: 'place-value-chart',
    standard: '5.NBT.1-5.NBT.3 representation',
    coverage: 'Compose and read decimals through thousandths from place-value charts.',
  },
] as const

export type Unit2ItemType = (typeof UNIT2_ITEM_TYPE_CHECKLIST)[number]['id']

export const UNIT2_ITEM_TYPES = UNIT2_ITEM_TYPE_CHECKLIST.map(({ id }) => id) as Unit2ItemType[]

type DecimalPlace =
  | 'hundreds'
  | 'tens'
  | 'ones'
  | 'tenths'
  | 'hundredths'
  | 'thousandths'

export type Unit2ItemModel =
  | {
      kind: 'adjacent-place-relationship'
      digit: number
      firstPlace: DecimalPlace
      secondPlace: DecimalPlace
    }
  | {
      kind: 'powers-of-ten-pattern'
      operand: string
      operation: 'multiply' | 'divide'
      exponent: number
    }
  | {
      kind: 'decimal-number-name'
      numeral: string
      numberName: string
      direction: 'numeral-to-name' | 'name-to-numeral'
    }
  | {
      kind: 'decimal-expanded-form'
      numeral: string
      expanded: string
      direction: 'numeral-to-expanded' | 'expanded-to-numeral'
    }
  | {
      kind: 'compare-decimals'
      left: string
      right: string
    }
  | {
      kind: 'round-decimal'
      numeral: string
      target: 'whole' | 'tenth' | 'hundredth'
    }
  | {
      kind: 'decimal-number-line'
      start: string
      end: string
      intervals: number
      tick: number
      displayPlaces: 1 | 2 | 3
    }
  | {
      kind: 'place-value-chart'
      columns: readonly DecimalPlace[]
      digits: readonly number[]
      displayPlaces: 1 | 2 | 3
    }

export interface Unit2GeneratedItem {
  itemType: Unit2ItemType
  difficulty: Difficulty
  prompt: string
  /** The computed answer, also present at choices[answerIndex]. */
  answer: string
  choices: string[]
  answerIndex: number
  /** Operands/representations retained so tests can recompute by an independent method. */
  model: Unit2ItemModel
}

export interface Unit2WorkedExample {
  problem: string
  steps: readonly string[]
  answer: string
}

const PLACE_EXPONENT: Record<DecimalPlace, number> = {
  hundreds: 2,
  tens: 1,
  ones: 0,
  tenths: -1,
  hundredths: -2,
  thousandths: -3,
}

const PLACE_LABEL: Record<DecimalPlace, string> = {
  hundreds: 'hundreds place',
  tens: 'tens place',
  ones: 'ones place',
  tenths: 'tenths place',
  hundredths: 'hundredths place',
  thousandths: 'thousandths place',
}

const TARGET_LABEL = {
  whole: 'nearest whole number',
  tenth: 'nearest tenth',
  hundredth: 'nearest hundredth',
} as const

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

const SMALL_WORDS = [
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

const denominatorName = (places: number, amount: number) => {
  const singular = places === 1 ? 'tenth' : places === 2 ? 'hundredth' : 'thousandth'
  return amount === 1 ? singular : `${singular}s`
}

function wholeNumberWords(value: number): string {
  if (value < 20) return SMALL_WORDS[value]
  if (value < 100) {
    const tens = TENS_WORDS[Math.floor(value / 10)]
    const ones = value % 10
    return ones === 0 ? tens : `${tens}-${SMALL_WORDS[ones]}`
  }
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  return remainder === 0
    ? `${SMALL_WORDS[hundreds]} hundred`
    : `${SMALL_WORDS[hundreds]} hundred ${wholeNumberWords(remainder)}`
}

/** Format an integer count of thousandths without floating-point arithmetic. */
function formatThousandths(scaled: number, fixedPlaces?: 0 | 1 | 2 | 3): string {
  const whole = Math.floor(scaled / 1000)
  const fraction = String(scaled % 1000).padStart(3, '0')
  if (fixedPlaces === 0) return String(whole)
  if (fixedPlaces !== undefined) return `${whole}.${fraction.slice(0, fixedPlaces)}`
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed === '' ? String(whole) : `${whole}.${trimmed}`
}

function decimalName(scaled: number, places: 1 | 2 | 3): string {
  const whole = Math.floor(scaled / 1000)
  const fractional = Math.floor((scaled % 1000) / 10 ** (3 - places))
  return `${wholeNumberWords(whole)} and ${wholeNumberWords(fractional)} ${denominatorName(places, fractional)}`
}

function expandedForm(scaled: number, places: 1 | 2 | 3): string {
  const terms: string[] = []
  const columns: readonly [number, number][] = [
    [100000, 100],
    [10000, 10],
    [1000, 1],
    [100, 0.1],
    [10, 0.01],
    [1, 0.001],
  ]
  const lastColumn = 2 + places
  for (let index = 0; index <= lastColumn; index++) {
    const [scaledPlace, value] = columns[index]
    const digit = Math.floor(scaled / scaledPlace) % 10
    if (digit !== 0) terms.push(String(digit * value))
  }
  return terms.join(' + ')
}

function buildItem(
  itemType: Unit2ItemType,
  difficulty: Difficulty,
  prompt: string,
  answer: string,
  distractors: string[],
  model: Unit2ItemModel,
  choiceCount = 4,
): Unit2GeneratedItem {
  const pool = [...new Set(distractors.filter((choice) => choice !== answer))]
  return {
    itemType,
    difficulty,
    prompt,
    answer,
    ...finishChoices(answer, fromPool(pool), choiceCount),
    model,
  }
}

export function generateAdjacentPlaceRelationshipItem(difficulty: Difficulty): Unit2GeneratedItem {
  const pairs: Record<Difficulty, readonly (readonly [DecimalPlace, DecimalPlace])[]> = {
    1: [
      ['hundreds', 'tens'],
      ['tens', 'ones'],
    ],
    2: [
      ['tens', 'ones'],
      ['ones', 'tenths'],
      ['tenths', 'hundredths'],
    ],
    3: [
      ['ones', 'tenths'],
      ['tenths', 'hundredths'],
      ['hundredths', 'thousandths'],
    ],
  }
  const [left, right] = pick(pairs[difficulty])
  const reverse = ri(0, 1) === 1
  const firstPlace = reverse ? right : left
  const secondPlace = reverse ? left : right
  const digit = ri(1, 9)
  const exponentDifference = PLACE_EXPONENT[firstPlace] - PLACE_EXPONENT[secondPlace]
  const answer = exponentDifference === 1 ? '10 times as much' : '1/10 as much'
  const prompt =
    `A ${digit} is in the ${PLACE_LABEL[firstPlace]}. Another ${digit} is in the ${PLACE_LABEL[secondPlace]}. ` +
    `The value of the first ${digit} is ___ the value of the second ${digit}.`
  return buildItem(
    'adjacent-place-relationship',
    difficulty,
    prompt,
    answer,
    ['10 times as much', '1/10 as much', '100 times as much', 'the same as'],
    { kind: 'adjacent-place-relationship', digit, firstPlace, secondPlace },
  )
}

export function generatePowerOfTenPatternItem(difficulty: Difficulty): Unit2GeneratedItem {
  let operation: 'multiply' | 'divide'
  let exponent: number
  let operandScaled: number
  let answerScaled: number

  if (difficulty === 1) {
    operation = 'multiply'
    exponent = ri(1, 3)
    operandScaled = ri(1, 99) * 1000
    answerScaled = operandScaled * 10 ** exponent
  } else if (difficulty === 2) {
    operation = pick(['multiply', 'divide'] as const)
    exponent = operation === 'multiply' ? ri(1, 2) : 1
    if (operation === 'multiply') {
      operandScaled = ri(1, 999) * 10
      answerScaled = operandScaled * 10 ** exponent
    } else {
      answerScaled = ri(1, 999) * 10
      operandScaled = answerScaled * 10
    }
  } else {
    operation = pick(['multiply', 'divide'] as const)
    exponent = ri(2, 3)
    if (operation === 'multiply') {
      operandScaled = ri(1, 999)
      answerScaled = operandScaled * 10 ** exponent
    } else {
      answerScaled = ri(1, 999)
      operandScaled = answerScaled * 10 ** exponent
    }
  }

  const operand = formatThousandths(operandScaled)
  const answer = formatThousandths(answerScaled)
  const symbol = operation === 'multiply' ? '×' : '÷'
  const prompt = `Calculate ${operand} ${symbol} 10^${exponent}.`
  const distractors = [
    operand,
    formatThousandths(answerScaled * 10),
    formatThousandths(answerScaled * 100),
    formatThousandths(Math.max(1, answerScaled + 10 ** Math.max(0, 3 - exponent))),
  ]
  return buildItem('powers-of-ten-pattern', difficulty, prompt, answer, distractors, {
    kind: 'powers-of-ten-pattern',
    operand,
    operation,
    exponent,
  })
}

export function generateDecimalNumberNameItem(difficulty: Difficulty): Unit2GeneratedItem {
  const places = difficulty
  const wholeMax = difficulty === 1 ? 9 : difficulty === 2 ? 99 : 999
  const whole = ri(0, wholeMax)
  let fractional = ri(1, 10 ** places - 1)
  if (fractional % 10 === 0) fractional += 1
  const scaled = whole * 1000 + fractional * 10 ** (3 - places)
  const numeral = formatThousandths(scaled, places)
  const numberName = decimalName(scaled, places)
  const direction =
    difficulty === 1 || ri(0, 1) === 0 ? 'numeral-to-name' : 'name-to-numeral'
  const answer = direction === 'numeral-to-name' ? numberName : numeral
  const prompt =
    direction === 'numeral-to-name'
      ? `Which number name matches ${numeral}?`
      : `Which base-ten numeral matches “${numberName}”?`

  const wrongPlaces = ([1, 2, 3] as const).filter((value) => value !== places)
  const nameDistractors = [
    ...wrongPlaces.map(
      (wrongPlace) =>
        `${wholeNumberWords(whole)} and ${wholeNumberWords(fractional)} ${denominatorName(wrongPlace, fractional)}`,
    ),
    `${wholeNumberWords(Math.min(999, whole + 1))} and ${wholeNumberWords(fractional)} ${denominatorName(places, fractional)}`,
    `${wholeNumberWords(whole)} and ${wholeNumberWords(Math.max(1, fractional - 1))} ${denominatorName(places, Math.max(1, fractional - 1))}`,
  ]
  const numeralDistractors = [
    String(whole + fractional / 10 ** Math.min(3, places + 1)),
    String(whole + fractional / 10 ** Math.max(1, places - 1)),
    `${whole}${String(fractional).padStart(places, '0')}`,
    String(whole + Math.max(1, fractional - 1) / 10 ** places),
  ]

  return buildItem(
    'decimal-number-name',
    difficulty,
    prompt,
    answer,
    direction === 'numeral-to-name' ? nameDistractors : numeralDistractors,
    { kind: 'decimal-number-name', numeral, numberName, direction },
  )
}

export function generateDecimalExpandedFormItem(difficulty: Difficulty): Unit2GeneratedItem {
  const places = difficulty
  const whole = difficulty === 1 ? ri(1, 9) : difficulty === 2 ? ri(10, 99) : ri(100, 999)
  let scaled = whole * 1000
  for (let place = 1; place <= places; place++) {
    const digit = place === places ? ri(1, 9) : ri(0, 9)
    scaled += digit * 10 ** (3 - place)
  }
  const numeral = formatThousandths(scaled, places)
  const expanded = expandedForm(scaled, places)
  const direction =
    difficulty === 1 || ri(0, 1) === 0 ? 'numeral-to-expanded' : 'expanded-to-numeral'
  const answer = direction === 'numeral-to-expanded' ? expanded : numeral
  const prompt =
    direction === 'numeral-to-expanded'
      ? `Which is the expanded form of ${numeral}?`
      : `Which base-ten numeral equals ${expanded}?`
  const offsets = [100, 10, 1, 110]
  const distractors = offsets.map((offset) =>
    direction === 'numeral-to-expanded'
      ? expandedForm(scaled + offset, places)
      : formatThousandths(scaled + offset),
  )

  return buildItem('decimal-expanded-form', difficulty, prompt, answer, distractors, {
    kind: 'decimal-expanded-form',
    numeral,
    expanded,
    direction,
  })
}

export function generateDecimalComparisonItem(difficulty: Difficulty): Unit2GeneratedItem {
  let leftScaled: number
  let rightScaled: number
  let leftPlaces: 1 | 2 | 3
  let rightPlaces: 1 | 2 | 3

  const trailingZeroEquivalent = difficulty > 1 && ri(0, 3) === 0
  if (trailingZeroEquivalent) {
    leftPlaces = difficulty === 2 ? 1 : pick([1, 2] as const)
    rightPlaces = 3
    const step = 10 ** (3 - leftPlaces)
    leftScaled = ri(1, 999) * step
    rightScaled = leftScaled
  } else {
    leftPlaces = difficulty
    rightPlaces = difficulty
    const step = 10 ** (3 - difficulty)
    const whole = ri(0, difficulty === 1 ? 9 : 99)
    const leftFraction = ri(0, 10 ** difficulty - 1)
    let rightFraction = Math.max(0, Math.min(10 ** difficulty - 1, leftFraction + pick([-2, -1, 1, 2] as const)))
    if (rightFraction === leftFraction) rightFraction = (leftFraction + 1) % 10 ** difficulty
    leftScaled = whole * 1000 + leftFraction * step
    rightScaled = whole * 1000 + rightFraction * step
  }

  const left = formatThousandths(leftScaled, leftPlaces)
  const right = formatThousandths(rightScaled, rightPlaces)
  const answer = leftScaled > rightScaled ? '>' : leftScaled < rightScaled ? '<' : '='
  return buildItem(
    'compare-decimals',
    difficulty,
    `Which symbol makes the statement true? ${left} ___ ${right}`,
    answer,
    ['>', '<', '='],
    { kind: 'compare-decimals', left, right },
    3,
  )
}

export function generateDecimalRoundingItem(difficulty: Difficulty): Unit2GeneratedItem {
  const targetPlaces =
    difficulty === 1 ? 0 : difficulty === 2 ? 1 : pick([0, 1, 2] as const)
  const inputPlaces = difficulty === 3 ? 3 : ((targetPlaces + 1) as 1 | 2)
  const whole = ri(0, 99)
  let scaled = whole * 1000
  for (let place = 1; place <= inputPlaces; place++) {
    scaled += ri(0, 9) * 10 ** (3 - place)
  }
  const unit = 10 ** (3 - targetPlaces)
  const answerScaled = Math.floor((scaled + unit / 2) / unit) * unit
  const target = (targetPlaces === 0
    ? 'whole'
    : targetPlaces === 1
      ? 'tenth'
      : 'hundredth') as 'whole' | 'tenth' | 'hundredth'
  const numeral = formatThousandths(scaled, inputPlaces)
  const answer = formatThousandths(answerScaled, targetPlaces)
  const floorScaled = Math.floor(scaled / unit) * unit
  const ceilScaled = Math.ceil(scaled / unit) * unit
  const distractors = [floorScaled, ceilScaled, answerScaled + unit, answerScaled - unit]
    .filter((value) => value >= 0)
    .map((value) => formatThousandths(value, targetPlaces))

  return buildItem(
    'round-decimal',
    difficulty,
    `Round ${numeral} to the ${TARGET_LABEL[target]}.`,
    answer,
    distractors,
    { kind: 'round-decimal', numeral, target },
  )
}

export function generateDecimalNumberLineItem(difficulty: Difficulty): Unit2GeneratedItem {
  const displayPlaces = difficulty
  const stepScaled = 10 ** (3 - displayPlaces)
  const startScaled = ri(0, difficulty === 1 ? 90 : difficulty === 2 ? 990 : 9990) * stepScaled
  const intervals = 10
  const tick = ri(1, 9)
  const endScaled = startScaled + intervals * stepScaled
  const answerScaled = startScaled + tick * stepScaled
  const start = formatThousandths(startScaled, displayPlaces)
  const end = formatThousandths(endScaled, displayPlaces)
  const answer = formatThousandths(answerScaled, displayPlaces)
  const distractors = [tick - 1, tick + 1, Math.max(0, 10 - tick), Math.min(10, tick + 2)].map(
    (wrongTick) => formatThousandths(startScaled + wrongTick * stepScaled, displayPlaces),
  )
  const prompt =
    `A number line from ${start} to ${end} is divided into ${intervals} equal intervals. ` +
    `Point P is at tick ${tick} after ${start}. What decimal does P represent?`

  return buildItem('decimal-number-line', difficulty, prompt, answer, distractors, {
    kind: 'decimal-number-line',
    start,
    end,
    intervals,
    tick,
    displayPlaces,
  })
}

function scaledFromChart(columns: readonly DecimalPlace[], digits: readonly number[]): number {
  return columns.reduce(
    (total, place, index) => total + digits[index] * 10 ** (PLACE_EXPONENT[place] + 3),
    0,
  )
}

export function generatePlaceValueChartItem(difficulty: Difficulty): Unit2GeneratedItem {
  const columns: readonly DecimalPlace[] =
    difficulty === 1
      ? ['ones', 'tenths']
      : difficulty === 2
        ? ['tens', 'ones', 'tenths', 'hundredths']
        : ['hundreds', 'tens', 'ones', 'tenths', 'hundredths', 'thousandths']
  const digits = columns.map((_, index) =>
    index === 0 || index === columns.length - 1 ? ri(1, 9) : ri(0, 9),
  )
  const displayPlaces = difficulty
  const scaled = scaledFromChart(columns, digits)
  const answer = formatThousandths(scaled, displayPlaces)
  const swapped = [...digits]
  const swapIndex = Math.max(0, columns.indexOf('ones'))
  const nextIndex = Math.min(columns.length - 1, swapIndex + 1)
  ;[swapped[swapIndex], swapped[nextIndex]] = [swapped[nextIndex], swapped[swapIndex]]
  const changed = [...digits]
  changed[changed.length - 1] = (changed[changed.length - 1] % 9) + 1
  const reversedDecimals = [...digits]
  const decimalStart = columns.indexOf('tenths')
  reversedDecimals.splice(
    decimalStart,
    reversedDecimals.length - decimalStart,
    ...reversedDecimals.slice(decimalStart).reverse(),
  )
  const distractors = [swapped, changed, reversedDecimals, digits.map((digit) => (digit + 1) % 10)].map(
    (candidate) => formatThousandths(scaledFromChart(columns, candidate), displayPlaces),
  )
  const header = `| ${columns.map((place) => PLACE_LABEL[place].replace(' place', '')).join(' | ')} |`
  const divider = `| ${columns.map(() => '---').join(' | ')} |`
  const row = `| ${digits.join(' | ')} |`
  const prompt = `What number does this place-value chart represent?\n${header}\n${divider}\n${row}`

  return buildItem('place-value-chart', difficulty, prompt, answer, distractors, {
    kind: 'place-value-chart',
    columns,
    digits,
    displayPlaces,
  })
}

export type Unit2Generator = (difficulty: Difficulty) => Unit2GeneratedItem

export const UNIT2_GENERATORS = {
  'adjacent-place-relationship': generateAdjacentPlaceRelationshipItem,
  'powers-of-ten-pattern': generatePowerOfTenPatternItem,
  'decimal-number-name': generateDecimalNumberNameItem,
  'decimal-expanded-form': generateDecimalExpandedFormItem,
  'compare-decimals': generateDecimalComparisonItem,
  'round-decimal': generateDecimalRoundingItem,
  'decimal-number-line': generateDecimalNumberLineItem,
  'place-value-chart': generatePlaceValueChartItem,
} satisfies Record<Unit2ItemType, Unit2Generator>

export function generateGrade5MathUnit2Item(
  itemType: Unit2ItemType,
  difficulty: Difficulty,
): Unit2GeneratedItem {
  return UNIT2_GENERATORS[itemType](difficulty)
}

/** Static teaching copy: one authored, reviewable example per coverage-contract item. */
export const UNIT2_WORKED_EXAMPLES: Record<Unit2ItemType, Unit2WorkedExample> = {
  'adjacent-place-relationship': {
    problem: 'Compare the value of a 7 in the ones place with a 7 in the tenths place.',
    steps: [
      'The 7 in the ones place has value 7. The 7 in the tenths place has value 0.7.',
      'Moving one place left makes a digit worth 10 times as much: 7 is 10 times 0.7.',
    ],
    answer: 'The 7 in the ones place is 10 times as much.',
  },
  'powers-of-ten-pattern': {
    problem: 'Calculate 0.042 × 10^2.',
    steps: [
      'The exponent 2 means multiply by 10 twice.',
      'Each multiplication by 10 makes every digit worth 10 times as much: 0.042 → 0.42 → 4.2.',
    ],
    answer: '4.2',
  },
  'decimal-number-name': {
    problem: 'Write 36.407 in words.',
    steps: [
      'Read the whole-number part: thirty-six.',
      'The last decimal digit is in the thousandths place, so read 407 as four hundred seven thousandths.',
    ],
    answer: 'thirty-six and four hundred seven thousandths',
  },
  'decimal-expanded-form': {
    problem: 'Write 5.083 in expanded form.',
    steps: [
      'The nonzero digits show 5 ones, 8 hundredths, and 3 thousandths.',
      'Write the value of each nonzero digit as a sum.',
    ],
    answer: '5 + 0.08 + 0.003',
  },
  'compare-decimals': {
    problem: 'Compare 4.7 and 4.700.',
    steps: [
      'Add zeros to the right of a decimal without changing its value: 4.7 = 4.700.',
      'The digits match in every place, so the numbers are equal.',
    ],
    answer: '4.7 = 4.700',
  },
  'round-decimal': {
    problem: 'Round 6.275 to the nearest hundredth.',
    steps: [
      'The hundredths digit is 7. Look one place right at the thousandths digit, 5.',
      'A 5 rounds the hundredths digit up, so 7 becomes 8.',
    ],
    answer: '6.28',
  },
  'decimal-number-line': {
    problem: 'A line from 2.30 to 2.40 has 10 equal intervals. What is tick 6 after 2.30?',
    steps: [
      'The total distance is 0.10, so each of 10 intervals is 0.01.',
      'Six intervals after 2.30 is 2.30 + 0.06.',
    ],
    answer: '2.36',
  },
  'place-value-chart': {
    problem: 'A chart shows 3 tens, 4 ones, 0 tenths, 6 hundredths, and 2 thousandths.',
    steps: [
      'The whole-number columns make 34.',
      'The decimal columns make 0.062. Combine them without dropping the zero in the tenths place.',
    ],
    answer: '34.062',
  },
}
