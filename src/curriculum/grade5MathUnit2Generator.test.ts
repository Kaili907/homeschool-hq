import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE5_MATH_UNIT2_GENERATORS,
  GRADE5_MATH_UNIT2_ITEM_DEFINITIONS,
  GRADE5_MATH_UNIT2_ITEM_TYPES,
  generateGrade5MathUnit2Question,
  type Grade5MathUnit2ItemType,
  type Grade5MathUnit2Question,
} from './grade5MathUnit2Generator'

const RUNS_PER_DIFFICULTY = 200

const PLACE_BY_EXPONENT: Record<number, string> = {
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

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function pow10(exponent: number): number {
  return Number(`1${'0'.repeat(exponent)}`)
}

function fixedDecimal(scaled: number, scale: number): string {
  if (scale === 0) return String(scaled)
  const denominator = pow10(scale)
  const whole = Math.floor(scaled / denominator)
  const fractional = String(scaled % denominator).padStart(scale, '0')
  return `${whole}.${fractional}`
}

function rationalDecimal(scaled: number, scale: number, powerShift: number): string {
  const numerator = BigInt(scaled) * BigInt(pow10(Math.max(0, powerShift)))
  const denominatorPower = scale + Math.max(0, -powerShift)
  const denominator = BigInt(pow10(denominatorPower))
  const whole = numerator / denominator
  const remainder = numerator % denominator
  if (remainder === 0n) return String(whole)
  const fractional = String(remainder).padStart(denominatorPower, '0').replace(/0+$/, '')
  return `${whole}.${fractional}`
}

function wordsBelowOneThousand(value: number): string {
  if (value < 20) return ONES[value]
  if (value < 100) {
    const tensWord = TENS[Math.trunc(value / 10)]
    const ones = value % 10
    return ones === 0 ? tensWord : `${tensWord}-${ONES[ones]}`
  }
  const hundreds = Math.trunc(value / 100)
  const rest = value - hundreds * 100
  return rest === 0 ? `${ONES[hundreds]} hundred` : `${ONES[hundreds]} hundred ${wordsBelowOneThousand(rest)}`
}

function decimalWords(whole: number, fractional: number, scale: number): string {
  const pluralPlace = PLACE_BY_EXPONENT[-scale]
  const place = fractional === 1 ? pluralPlace.slice(0, -1) : pluralPlace
  return `${wordsBelowOneThousand(whole)} and ${wordsBelowOneThousand(fractional)} ${place}`
}

function expandedFromDigits(whole: number, fractional: number, scale: number): string {
  const display = fixedDecimal(whole * pow10(scale) + fractional, scale)
  const [wholeDigits, fractionalDigits = ''] = display.split('.')
  const terms: string[] = []
  for (let index = 0; index < wholeDigits.length; index++) {
    const digit = Number(wholeDigits[index])
    if (digit !== 0) terms.push(String(digit * pow10(wholeDigits.length - index - 1)))
  }
  for (let index = 0; index < fractionalDigits.length; index++) {
    const digit = Number(fractionalDigits[index])
    if (digit !== 0) terms.push(fixedDecimal(digit, index + 1))
  }
  return terms.join(' + ')
}

function normalizedInteger(scaled: number, fromScale: number, toScale: number): bigint {
  return BigInt(scaled) * BigInt(pow10(toScale - fromScale))
}

function displayDigitAtExponent(display: string, exponent: number): number {
  const [whole, fractional = ''] = display.split('.')
  if (exponent >= 0) return Number(whole[whole.length - exponent - 1])
  return Number(fractional[-exponent - 1])
}

function oracleAnswer(question: Grade5MathUnit2Question): string {
  switch (question.itemType) {
    case 'adjacent-place-value': {
      const exponentDifference = question.parameters.comparedExponent - question.parameters.referenceExponent
      return exponentDifference === 1 ? '10 times' : '1/10 as much'
    }
    case 'power-of-ten-notation':
      return question.parameters.mode === 'value-from-exponent'
        ? String(pow10(question.parameters.exponent))
        : String(question.parameters.exponent)
    case 'multiply-by-power-of-ten':
      return rationalDecimal(
        question.parameters.operandScaled,
        question.parameters.operandScale,
        question.parameters.exponent,
      )
    case 'divide-by-power-of-ten':
      return rationalDecimal(
        question.parameters.operandScaled,
        question.parameters.operandScale,
        -question.parameters.exponent,
      )
    case 'decimal-to-number-name':
      return decimalWords(
        question.parameters.whole,
        question.parameters.fractional,
        question.parameters.scale,
      )
    case 'number-name-to-decimal':
    case 'expanded-form-to-decimal':
      return fixedDecimal(
        question.parameters.whole * pow10(question.parameters.scale) + question.parameters.fractional,
        question.parameters.scale,
      )
    case 'decimal-to-expanded-form':
      return expandedFromDigits(
        question.parameters.whole,
        question.parameters.fractional,
        question.parameters.scale,
      )
    case 'compare-decimals': {
      const commonScale = Math.max(question.parameters.leftScale, question.parameters.rightScale)
      const left = normalizedInteger(question.parameters.leftScaled, question.parameters.leftScale, commonScale)
      const right = normalizedInteger(question.parameters.rightScaled, question.parameters.rightScale, commonScale)
      return left < right ? '<' : left > right ? '>' : '='
    }
    case 'round-decimal': {
      const factor = BigInt(pow10(question.parameters.inputScale + question.parameters.targetExponent))
      const input = BigInt(question.parameters.inputScaled)
      const quotient = input / factor
      const remainder = input % factor
      const rounded = quotient + (remainder * 2n >= factor ? 1n : 0n)
      return question.parameters.targetExponent >= 0
        ? String(Number(rounded) * pow10(question.parameters.targetExponent))
        : fixedDecimal(Number(rounded), -question.parameters.targetExponent)
    }
    case 'decimal-number-line':
      return fixedDecimal(
        question.parameters.startScaled + question.parameters.pointIndex,
        question.parameters.scale,
      )
    case 'place-value-chart': {
      const index = question.parameters.exponents.indexOf(question.parameters.targetExponent)
      const digit = question.parameters.digits[index]
      if (question.parameters.mode === 'digit') return String(digit)
      if (question.parameters.mode === 'place') return PLACE_BY_EXPONENT[question.parameters.targetExponent]
      return question.parameters.targetExponent >= 0
        ? String(digit * pow10(question.parameters.targetExponent))
        : fixedDecimal(digit, -question.parameters.targetExponent)
    }
  }
}

function assertPromptRepresentsParameters(question: Grade5MathUnit2Question): void {
  switch (question.itemType) {
    case 'adjacent-place-value': {
      const parameters = question.parameters
      expect(displayDigitAtExponent(parameters.display, parameters.comparedExponent)).toBe(parameters.digit)
      expect(displayDigitAtExponent(parameters.display, parameters.referenceExponent)).toBe(parameters.digit)
      expect(question.prompt).toBe(
        `In ${parameters.display}, how does the value of the ${parameters.digit} in the ${PLACE_BY_EXPONENT[parameters.comparedExponent]} place compare with the value of the ${parameters.digit} in the ${PLACE_BY_EXPONENT[parameters.referenceExponent]} place?`,
      )
      return
    }
    case 'power-of-ten-notation': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        parameters.mode === 'value-from-exponent'
          ? `10^${parameters.exponent} = ?`
          : `10^? = ${pow10(parameters.exponent)}`,
      )
      return
    }
    case 'multiply-by-power-of-ten': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `${fixedDecimal(parameters.operandScaled, parameters.operandScale)} × 10^${parameters.exponent} = ?`,
      )
      return
    }
    case 'divide-by-power-of-ten': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `${fixedDecimal(parameters.operandScaled, parameters.operandScale)} ÷ 10^${parameters.exponent} = ?`,
      )
      return
    }
    case 'decimal-to-number-name': {
      const parameters = question.parameters
      const display = fixedDecimal(parameters.whole * pow10(parameters.scale) + parameters.fractional, parameters.scale)
      expect(question.prompt).toBe(`How is ${display} written in words?`)
      return
    }
    case 'number-name-to-decimal': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `Write “${decimalWords(parameters.whole, parameters.fractional, parameters.scale)}” as a decimal.`,
      )
      return
    }
    case 'decimal-to-expanded-form': {
      const parameters = question.parameters
      const display = fixedDecimal(parameters.whole * pow10(parameters.scale) + parameters.fractional, parameters.scale)
      expect(question.prompt).toBe(`Write ${display} in expanded form.`)
      return
    }
    case 'expanded-form-to-decimal': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `Write ${expandedFromDigits(parameters.whole, parameters.fractional, parameters.scale)} in standard form.`,
      )
      return
    }
    case 'compare-decimals': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `Compare ${fixedDecimal(parameters.leftScaled, parameters.leftScale)} and ${fixedDecimal(parameters.rightScaled, parameters.rightScale)} using <, >, or =.`,
      )
      return
    }
    case 'round-decimal': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `Round ${fixedDecimal(parameters.inputScaled, parameters.inputScale)} to the nearest ${ROUND_PLACE_NAME[parameters.targetExponent]}.`,
      )
      return
    }
    case 'decimal-number-line': {
      const parameters = question.parameters
      const start = fixedDecimal(parameters.startScaled, parameters.scale)
      const end = fixedDecimal(parameters.startScaled + parameters.intervalCount, parameters.scale)
      expect(question.prompt).toBe(
        `A number line from ${start} to ${end} has ${parameters.intervalCount} equal intervals. Point P is ${parameters.pointIndex} intervals after ${start}. What number is P?`,
      )
      return
    }
    case 'place-value-chart': {
      const parameters = question.parameters
      const targetIndex = parameters.exponents.indexOf(parameters.targetExponent)
      const targetDigit = parameters.digits[targetIndex]
      const header = parameters.exponents.map((exponent) => PLACE_BY_EXPONENT[exponent]).join(' | ')
      const row = parameters.digits.join(' | ')
      const promptQuestion =
        parameters.mode === 'digit'
          ? `What digit is in the ${PLACE_BY_EXPONENT[parameters.targetExponent]} place?`
          : parameters.mode === 'value'
            ? `What value does the ${targetDigit} in the ${PLACE_BY_EXPONENT[parameters.targetExponent]} place represent?`
            : `Which place contains the digit ${targetDigit}?`
      expect(question.prompt).toBe(`Place-value chart:\n${header}\n${row}\n${promptQuestion}`)
    }
  }
}

function assertChoicesStayInDomain(question: Grade5MathUnit2Question): void {
  switch (question.itemType) {
    case 'adjacent-place-value':
      for (const choice of question.choices) {
        expect(['10 times', '1/10 as much', '100 times', 'the same value']).toContain(choice)
      }
      return
    case 'power-of-ten-notation':
      if (question.parameters.mode === 'value-from-exponent') {
        const powers = new Set([0, 1, 2, 3, 4, 5, 6].map((exponent) => String(pow10(exponent))))
        for (const choice of question.choices) expect(powers.has(choice)).toBe(true)
      } else {
        for (const choice of question.choices) expect(Number(choice)).toBeGreaterThanOrEqual(0)
        for (const choice of question.choices) expect(Number(choice)).toBeLessThanOrEqual(6)
      }
      return
    case 'decimal-to-number-name':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^[a-z -]+ and [a-z -]+ (tenth|tenths|hundredth|hundredths|thousandth|thousandths)$/)
      }
      return
    case 'decimal-to-expanded-form':
      for (const choice of question.choices) expect(choice).toMatch(/^\d+(?:\.\d+)?(?: \+ \d+(?:\.\d+)?)*$/)
      return
    case 'compare-decimals':
      for (const choice of question.choices) expect(['<', '>', '=']).toContain(choice)
      return
    case 'place-value-chart':
      if (question.parameters.mode === 'digit') {
        for (const choice of question.choices) expect(choice).toMatch(/^[1-9]$/)
      } else if (question.parameters.mode === 'place') {
        for (const choice of question.choices) expect(Object.values(PLACE_BY_EXPONENT)).toContain(choice)
      } else {
        for (const choice of question.choices) expect(choice).toMatch(/^\d+(?:\.\d+)?$/)
      }
      return
    default:
      for (const choice of question.choices) expect(choice).toMatch(/^\d+(?:\.\d+)?$/)
  }
}

function expectWellFormed(question: Grade5MathUnit2Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(question.choices[question.answerIndex]).not.toMatch(/\?\d+$/)
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  assertChoicesStayInDomain(question)
}

describe('Grade 5 Math Unit 2 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE5_MATH_UNIT2_ITEM_DEFINITIONS)).toEqual([...GRADE5_MATH_UNIT2_ITEM_TYPES])
    expect(Object.keys(GRADE5_MATH_UNIT2_GENERATORS)).toEqual([...GRADE5_MATH_UNIT2_ITEM_TYPES])
    expect(new Set(GRADE5_MATH_UNIT2_ITEM_TYPES).size).toBe(12)
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x5_02_c0de))
    for (const itemType of GRADE5_MATH_UNIT2_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade5MathUnit2Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(GRADE5_MATH_UNIT2_ITEM_DEFINITIONS[itemType].standard)
        expect(question.lessonFocus).toBe(GRADE5_MATH_UNIT2_ITEM_DEFINITIONS[itemType].lessonFocus)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const exampleObjects = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE5_MATH_UNIT2_ITEM_TYPES) {
      const example = GRADE5_MATH_UNIT2_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      exampleObjects.add(example)
    }
    expect(exampleObjects.size).toBe(GRADE5_MATH_UNIT2_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike = (typeof GRADE5_MATH_UNIT2_ITEM_DEFINITIONS)[Grade5MathUnit2ItemType]['workedExample']

describe('Grade 5 Math Unit 2 independent property oracles', () => {
  for (const [typeIndex, itemType] of GRADE5_MATH_UNIT2_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have the independently recomputed answer`, () => {
      setRng(seededRng(0x200_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade5MathUnit2Question(itemType, difficulty)
          assertPromptRepresentsParameters(question)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          expectWellFormed(question)
        }
      }
    })
  }
})

describe('Grade 5 Math Unit 2 required edge cases', () => {
  it('generates decimal representations through thousandths, including trailing zero forms', () => {
    setRng(seededRng(0x7a11_0000))
    let sawTrailingZero = false
    for (let run = 0; run < 300; run++) {
      const question = generateGrade5MathUnit2Question('decimal-to-number-name', 3)
      expect(question.parameters.scale).toBe(3)
      if (question.parameters.fractional % 10 === 0) {
        sawTrailingZero = true
        expect(question.prompt).toMatch(/\.\d{2}0/)
      }
    }
    expect(sawTrailingZero).toBe(true)
  })

  it('compares equivalent decimals that differ only by a trailing zero', () => {
    setRng(seededRng(0xe0a1_0000))
    let equalQuestion: Extract<Grade5MathUnit2Question, { itemType: 'compare-decimals' }> | undefined
    for (let run = 0; run < 300 && !equalQuestion; run++) {
      const question = generateGrade5MathUnit2Question('compare-decimals', 3)
      if (curriculumAnswer(question) === '=') equalQuestion = question
    }
    expect(equalQuestion).toBeDefined()
    expect(equalQuestion?.parameters.leftScale).not.toBe(equalQuestion?.parameters.rightScale)
  })

  it('rounds exact halfway decimals away from zero at the requested place', () => {
    setRng(seededRng(0x5a1f_0000))
    for (let run = 0; run < 200; run++) {
      const question = generateGrade5MathUnit2Question('round-decimal', 3)
      const factor = pow10(question.parameters.inputScale + question.parameters.targetExponent)
      expect((question.parameters.inputScaled % factor) * 2).toBe(factor)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
  })

  it('reaches every adjacent place pair from thousands through thousandths', () => {
    setRng(seededRng(0xad1a_ce00))
    const pairs = new Set<string>()
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit2Question('adjacent-place-value', 3)
      const high = Math.max(question.parameters.comparedExponent, question.parameters.referenceExponent)
      const low = Math.min(question.parameters.comparedExponent, question.parameters.referenceExponent)
      pairs.add(`${high},${low}`)
    }
    expect(pairs).toEqual(new Set(['3,2', '2,1', '1,0', '0,-1', '-1,-2', '-2,-3']))
  })

  it('rounds to whole-number and decimal places from hundreds through hundredths', () => {
    setRng(seededRng(0xa11_91000))
    const targetExponents = new Set<number>()
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit2Question('round-decimal', 3)
      targetExponents.add(question.parameters.targetExponent)
    }
    expect(targetExponents).toEqual(new Set([2, 1, 0, -1, -2]))
  })

  it('moves values across the decimal point for multiplication and division by powers of ten', () => {
    setRng(seededRng(0xc205_0000))
    let sawDecimalToWhole = false
    let sawWholeToDecimal = false
    for (let run = 0; run < 400; run++) {
      const multiply = generateGrade5MathUnit2Question('multiply-by-power-of-ten', 3)
      const multiplyInput = fixedDecimal(multiply.parameters.operandScaled, multiply.parameters.operandScale)
      if (multiplyInput.includes('.') && !curriculumAnswer(multiply).includes('.')) sawDecimalToWhole = true

      const divide = generateGrade5MathUnit2Question('divide-by-power-of-ten', 1)
      const divideInput = fixedDecimal(divide.parameters.operandScaled, divide.parameters.operandScale)
      if (!divideInput.includes('.') && curriculumAnswer(divide).includes('.')) sawWholeToDecimal = true
    }
    expect(sawDecimalToWhole).toBe(true)
    expect(sawWholeToDecimal).toBe(true)
  })
})
