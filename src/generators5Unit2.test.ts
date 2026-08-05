import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from './genUtils'
import {
  GRADE5_UNIT2_GENERATORS,
  GRADE5_UNIT2_ITEM_TYPES,
  GRADE5_UNIT2_WORKED_EXAMPLES,
  generateGrade5Unit2Question,
  type Grade5Unit2ItemType,
  type Grade5Unit2Question,
} from './generators5Unit2'
import type { Difficulty } from './types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS_PER_DIFFICULTY = 75
const ITEMS_PER_TYPE = DIFFICULTIES.length * RUNS_PER_DIFFICULTY

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

afterEach(() => setRng(null))

function answerOf(question: Grade5Unit2Question): string {
  return question.choices[question.answerIndex]
}

interface ExactDecimal {
  coefficient: bigint
  places: number
}

function parseDecimal(text: string): ExactDecimal {
  const plain = text.replaceAll(',', '').trim()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(plain)
  expect(match, `expected a nonnegative decimal, received ${text}`).not.toBeNull()
  const fraction = match![2] ?? ''
  return { coefficient: BigInt(match![1] + fraction), places: fraction.length }
}

function alignDecimal(value: ExactDecimal, places: number): bigint {
  expect(value.places).toBeLessThanOrEqual(places)
  return value.coefficient * 10n ** BigInt(places - value.places)
}

function decimalEquals(left: string, right: string): boolean {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  const places = Math.max(a.places, b.places)
  return alignDecimal(a, places) === alignDecimal(b, places)
}

function compareDecimal(left: string, right: string): '<' | '=' | '>' {
  const a = parseDecimal(left)
  const b = parseDecimal(right)
  const places = Math.max(a.places, b.places)
  const av = alignDecimal(a, places)
  const bv = alignDecimal(b, places)
  return av === bv ? '=' : av < bv ? '<' : '>'
}

function formatExact(value: ExactDecimal, keepPlaces = false): string {
  if (value.places === 0) return value.coefficient.toString()
  const raw = value.coefficient.toString().padStart(value.places + 1, '0')
  const split = raw.length - value.places
  const whole = raw.slice(0, split).replace(/^0+(?=\d)/, '')
  let fraction = raw.slice(split)
  if (!keepPlaces) fraction = fraction.replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function shiftDecimal(text: string, placesRight: number): string {
  const value = parseDecimal(text)
  const newPlaces = value.places - placesRight
  if (newPlaces >= 0) return formatExact({ coefficient: value.coefficient, places: newPlaces })
  return formatExact({ coefficient: value.coefficient * 10n ** BigInt(-newPlaces), places: 0 })
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

function independentIntegerWords(value: number): string {
  if (value >= 100) {
    const rest = value % 100
    return `${ONES[Math.floor(value / 100)]} hundred${rest ? ` ${independentIntegerWords(rest)}` : ''}`
  }
  if (value >= 20) return `${TENS[Math.floor(value / 10)]}${value % 10 ? `-${ONES[value % 10]}` : ''}`
  return ONES[value]
}

function parseIntegerWords(text: string): number {
  const tokens = text.replaceAll('-', ' ').split(/\s+/)
  let result = 0
  for (const token of tokens) {
    if (token === 'hundred') {
      result *= 100
      continue
    }
    const one = ONES.indexOf(token as (typeof ONES)[number])
    if (one >= 0) {
      result += one
      continue
    }
    const ten = TENS.indexOf(token as (typeof TENS)[number])
    expect(ten, `unrecognized number word ${token}`).toBeGreaterThanOrEqual(2)
    result += ten * 10
  }
  return result
}

function wordsToThousandths(text: string): bigint {
  const match = /^(.+) and (.+) (tenth|tenths|hundredth|hundredths|thousandth|thousandths)$/.exec(text)
  expect(match, `expected decimal words, received ${text}`).not.toBeNull()
  const places = match![3].startsWith('tenth') ? 1 : match![3].startsWith('hundredth') ? 2 : 3
  const whole = parseIntegerWords(match![1])
  const numerator = parseIntegerWords(match![2])
  return BigInt(whole * 10 ** places + numerator) * 10n ** BigInt(3 - places)
}

function decimalToIndependentWords(text: string): string {
  const value = parseDecimal(text)
  expect(value.places).toBeGreaterThanOrEqual(1)
  expect(value.places).toBeLessThanOrEqual(3)
  const factor = 10n ** BigInt(value.places)
  const whole = Number(value.coefficient / factor)
  const numerator = Number(value.coefficient % factor)
  const names = ['tenth', 'hundredth', 'thousandth']
  const denominator = `${names[value.places - 1]}${numerator === 1 ? '' : 's'}`
  return `${independentIntegerWords(whole)} and ${independentIntegerWords(numerator)} ${denominator}`
}

function expressionToThousandths(expression: string): bigint {
  return expression.split(' + ').reduce((sum, addend) => {
    const value = parseDecimal(addend)
    expect(value.places).toBeLessThanOrEqual(3)
    return sum + alignDecimal(value, 3)
  }, 0n)
}

function chartDigits(prompt: string): number[] {
  const match = /ones=(\d), tenths=(\d), hundredths=(\d), thousandths=(\d)/.exec(prompt)
  expect(match).not.toBeNull()
  return match!.slice(1).map(Number)
}

function assertQuestionShape(question: Grade5Unit2Question, itemType: Grade5Unit2ItemType, difficulty: Difficulty): void {
  expect(question.itemType).toBe(itemType)
  expect(question.difficulty).toBe(difficulty)
  expect(question.prompt.trim().length).toBeGreaterThan(0)
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
}

function validatePlaceValueRelationship(question: Grade5Unit2Question): void {
  const match = /has value ([\d.]+).*value ([\d.]+).*How many times as much is ([\d.]+) as ([\d.]+)\?$/.exec(question.prompt)
  expect(match).not.toBeNull()
  expect(match![1]).toBe(match![3])
  expect(match![2]).toBe(match![4])
  const first = parseDecimal(match![1])
  const second = parseDecimal(match![2])
  const places = Math.max(first.places, second.places)
  const firstValue = alignDecimal(first, places)
  const secondValue = alignDecimal(second, places)
  const firstIsGreater = firstValue > secondValue
  expect(firstIsGreater ? firstValue : secondValue).toBe(
    (firstIsGreater ? secondValue : firstValue) * 10n,
  )
  const expected = firstIsGreater ? '10 times as much' : '1/10 as much'
  expect(answerOf(question)).toBe(expected)
  expect(question.choices.filter((choice) => choice === expected)).toHaveLength(1)
}

function validatePowerOfTenNotation(question: Grade5Unit2Question): void {
  const zeroPattern = /^A nonzero whole number is multiplied by 10\^(\d+)\. How many zeros are appended to the original number\?$/.exec(
    question.prompt,
  )
  if (zeroPattern) {
    const expected = Number(zeroPattern[1])
    const answer = /^(\d+) zeros$/.exec(answerOf(question))
    expect(answer).not.toBeNull()
    expect(Number(answer![1])).toBe(expected)
    expect(question.choices.filter((choice) => choice === `${expected} zeros`)).toHaveLength(1)
    return
  }
  const forward = /^What number is 10\^(\d+)\?$/.exec(question.prompt)
  if (forward) {
    const expected = 10n ** BigInt(forward[1])
    expect(BigInt(answerOf(question).replaceAll(',', ''))).toBe(expected)
    expect(question.choices.filter((choice) => BigInt(choice.replaceAll(',', '')) === expected)).toHaveLength(1)
    return
  }
  const reverse = /^Which power of ten equals ([\d,]+)\?$/.exec(question.prompt)
  expect(reverse).not.toBeNull()
  const target = BigInt(reverse![1].replaceAll(',', ''))
  const answer = /^10\^(\d+)$/.exec(answerOf(question))
  expect(answer).not.toBeNull()
  expect(10n ** BigInt(answer![1])).toBe(target)
  expect(
    question.choices.filter((choice) => {
      const candidate = /^10\^(\d+)$/.exec(choice)
      return candidate !== null && 10n ** BigInt(candidate[1]) === target
    }),
  ).toHaveLength(1)
}

function validatePowerOperation(question: Grade5Unit2Question, operation: '×' | '÷'): void {
  const match = new RegExp(`^([\\d.]+) ${operation} 10\\^(\\d+) = \\?$`).exec(question.prompt)
  expect(match).not.toBeNull()
  const shift = Number(match![2]) * (operation === '×' ? 1 : -1)
  const expected = shiftDecimal(match![1], shift)
  expect(decimalEquals(answerOf(question), expected)).toBe(true)
  expect(question.choices.filter((choice) => decimalEquals(choice, expected))).toHaveLength(1)
}

function validateDecimalToWords(question: Grade5Unit2Question): void {
  const match = /^How do you read ([\d.]+)\?$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const expected = decimalToIndependentWords(match![1])
  expect(answerOf(question)).toBe(expected)
  const target = alignDecimal(parseDecimal(match![1]), 3)
  expect(question.choices.filter((choice) => wordsToThousandths(choice) === target)).toHaveLength(1)
}

function validateWordsToDecimal(question: Grade5Unit2Question): void {
  const match = /^Write (.+) as a decimal\.$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const target = wordsToThousandths(match![1])
  expect(alignDecimal(parseDecimal(answerOf(question)), 3)).toBe(target)
  expect(question.choices.filter((choice) => alignDecimal(parseDecimal(choice), 3) === target)).toHaveLength(1)
}

function validateDecimalToExpanded(question: Grade5Unit2Question): void {
  const match = /^Which is the expanded form of ([\d.]+)\?$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const target = alignDecimal(parseDecimal(match![1]), 3)
  expect(expressionToThousandths(answerOf(question))).toBe(target)
  expect(question.choices.filter((choice) => expressionToThousandths(choice) === target)).toHaveLength(1)
}

function validateExpandedToDecimal(question: Grade5Unit2Question): void {
  const expression = question.prompt.replace(/ = \?$/, '')
  const target = expressionToThousandths(expression)
  expect(alignDecimal(parseDecimal(answerOf(question)), 3)).toBe(target)
  expect(question.choices.filter((choice) => alignDecimal(parseDecimal(choice), 3) === target)).toHaveLength(1)
}

function validateCompareDecimals(question: Grade5Unit2Question): void {
  const match = /statement true\? ([\d.]+) ___ ([\d.]+)$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const expected = compareDecimal(match![1], match![2])
  expect(answerOf(question)).toBe(expected)
  expect(question.choices).toEqual(expect.arrayContaining(['<', '=', '>']))
}

function validateRoundDecimals(question: Grade5Unit2Question): void {
  const match = /^Round ([\d.]+) to the nearest (whole number|tenth|hundredth)\.$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const places = match![2] === 'whole number' ? 0 : match![2] === 'tenth' ? 1 : 2
  const source = alignDecimal(parseDecimal(match![1]), 3)
  const unit = 10n ** BigInt(3 - places)
  const expected = ((source + unit / 2n) / unit) * unit
  expect(alignDecimal(parseDecimal(answerOf(question)), 3)).toBe(expected)
  expect(question.choices.filter((choice) => alignDecimal(parseDecimal(choice), 3) === expected)).toHaveLength(1)
  for (const choice of question.choices) expect(parseDecimal(choice).places).toBe(places)
}

function validateNumberLine(question: Grade5Unit2Question): void {
  const match = /^A number line goes from ([\d.]+) to ([\d.]+) in 10 equal intervals\. Point P is (\d+) intervals? to the right of ([\d.]+)\./.exec(
    question.prompt,
  )
  expect(match).not.toBeNull()
  expect(match![1]).toBe(match![4])
  const start = alignDecimal(parseDecimal(match![1]), 3)
  const end = alignDecimal(parseDecimal(match![2]), 3)
  const expected = start + ((end - start) / 10n) * BigInt(match![3])
  expect(alignDecimal(parseDecimal(answerOf(question)), 3)).toBe(expected)
  expect(question.choices.filter((choice) => alignDecimal(parseDecimal(choice), 3) === expected)).toHaveLength(1)
  expect(question.visual).toEqual({
    kind: 'numberLine',
    min: Number(match![1]),
    max: Number(match![2]),
    value: Number(answerOf(question)),
  })
}

function validatePlaceValueChart(question: Grade5Unit2Question): void {
  const digits = chartDigits(question.prompt)
  const placeIndex: Record<string, number> = { ones: 0, tenths: 1, hundredths: 2, thousandths: 3 }
  const digitQuestion = /Which digit is in the (\w+) place\?/.exec(question.prompt)
  if (digitQuestion) {
    expect(answerOf(question)).toBe(String(digits[placeIndex[digitQuestion[1]]]))
    return
  }
  const valueQuestion = /value of the digit in the (\w+) place\?/.exec(question.prompt)
  if (valueQuestion) {
    const index = placeIndex[valueQuestion[1]]
    const expected = formatExact({ coefficient: BigInt(digits[index]), places: index })
    expect(decimalEquals(answerOf(question), expected)).toBe(true)
    expect(question.choices.filter((choice) => decimalEquals(choice, expected))).toHaveLength(1)
    return
  }
  expect(question.prompt).toMatch(/What number does the chart represent\?$/)
  const expected = `${digits[0]}.${digits.slice(1).join('')}`
  expect(decimalEquals(answerOf(question), expected)).toBe(true)
  expect(question.choices.filter((choice) => decimalEquals(choice, expected))).toHaveLength(1)
}

const VALIDATORS: Record<Grade5Unit2ItemType, (question: Grade5Unit2Question) => void> = {
  'place-value-relationship': validatePlaceValueRelationship,
  'power-of-ten-notation': validatePowerOfTenNotation,
  'multiply-by-power-of-ten': (question) => validatePowerOperation(question, '×'),
  'divide-by-power-of-ten': (question) => validatePowerOperation(question, '÷'),
  'decimal-to-words': validateDecimalToWords,
  'words-to-decimal': validateWordsToDecimal,
  'decimal-to-expanded-form': validateDecimalToExpanded,
  'expanded-form-to-decimal': validateExpandedToDecimal,
  'compare-decimals': validateCompareDecimals,
  'round-decimals': validateRoundDecimals,
  'decimal-number-line': validateNumberLine,
  'decimal-place-value-chart': validatePlaceValueChart,
}

describe('grade 5 Unit 2 coverage contract', () => {
  it('registers exactly one reachable generator and one worked example per item type', () => {
    expect(Object.keys(GRADE5_UNIT2_GENERATORS).sort()).toEqual([...GRADE5_UNIT2_ITEM_TYPES].sort())
    expect(Object.keys(GRADE5_UNIT2_WORKED_EXAMPLES).sort()).toEqual([...GRADE5_UNIT2_ITEM_TYPES].sort())
    for (const itemType of GRADE5_UNIT2_ITEM_TYPES) {
      expect(GRADE5_UNIT2_WORKED_EXAMPLES[itemType].trim().length).toBeGreaterThan(30)
      const question = generateGrade5Unit2Question(itemType, 1)
      expect(question.itemType).toBe(itemType)
    }
  })
})

describe('grade 5 Unit 2 independent property verification', () => {
  for (const [typeIndex, itemType] of GRADE5_UNIT2_ITEM_TYPES.entries()) {
    it(`${itemType}: ${ITEMS_PER_TYPE} generated items are independently correct`, () => {
      setRng(seededRng(0x5a170000 + typeIndex))
      let verified = 0
      for (const difficulty of DIFFICULTIES) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade5Unit2Question(itemType, difficulty)
          assertQuestionShape(question, itemType, difficulty)
          VALIDATORS[itemType](question)
          verified++
        }
      }
      expect(verified).toBe(ITEMS_PER_TYPE)
      console.info(`PROPERTY ${itemType}: ${verified}/${ITEMS_PER_TYPE} independently verified`)
    })
  }
})

describe('grade 5 Unit 2 required edge cases', () => {
  it('generates decimals through thousandths and comparison items with equivalent trailing zeros', () => {
    setRng(seededRng(0x5002a))
    const thousandths = generateGrade5Unit2Question('decimal-to-words', 3)
    expect(thousandths.prompt).toMatch(/\.\d{3}\?$/)

    let trailingZeroEquality: Grade5Unit2Question | undefined
    for (let run = 0; run < 100; run++) {
      const question = generateGrade5Unit2Question('compare-decimals', 3)
      if (answerOf(question) === '=' && /0\.\d0+ ___ 0\.\d$/.test(question.prompt)) {
        trailingZeroEquality = question
        break
      }
    }
    expect(trailingZeroEquality).toBeDefined()
    validateCompareDecimals(trailingZeroEquality!)
  })

  it('rounds exact halfway values up at the ones, tenths, and hundredths boundaries', () => {
    setRng(seededRng(0x5002b))
    const seen = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const question = generateGrade5Unit2Question('round-decimals', 3)
      const match = /^Round ([\d.]+) to the nearest (whole number|tenth|hundredth)\./.exec(question.prompt)!
      const places = match[2] === 'whole number' ? 0 : match[2] === 'tenth' ? 1 : 2
      const unit = 10n ** BigInt(3 - places)
      expect(alignDecimal(parseDecimal(match[1]), 3) % unit).toBe(unit / 2n)
      validateRoundDecimals(question)
      seen.add(match[2])
    }
    expect(seen).toEqual(new Set(['whole number', 'tenth', 'hundredth']))
  })

  it('moves powers of ten across the decimal point for multiplication and division', () => {
    setRng(seededRng(0x5002c))
    let multiplicationCrossed = false
    let divisionCrossed = false
    for (let run = 0; run < 200; run++) {
      const multiplication = generateGrade5Unit2Question('multiply-by-power-of-ten', 3)
      const multiplyOperand = /^([\d.]+) ×/.exec(multiplication.prompt)![1]
      if (compareDecimal(multiplyOperand, '1') === '<' && compareDecimal(answerOf(multiplication), '1') !== '<') {
        multiplicationCrossed = true
      }
      validatePowerOperation(multiplication, '×')

      const division = generateGrade5Unit2Question('divide-by-power-of-ten', 3)
      const divideOperand = /^([\d.]+) ÷/.exec(division.prompt)![1]
      if (compareDecimal(divideOperand, '1') !== '<' && compareDecimal(answerOf(division), '1') === '<') {
        divisionCrossed = true
      }
      validatePowerOperation(division, '÷')
    }
    expect(multiplicationCrossed).toBe(true)
    expect(divisionCrossed).toBe(true)
  })
})

describe('grade 5 Unit 2 desk-review samples', () => {
  it('emits 20 deterministic generated items with their computed answers', () => {
    setRng(seededRng(0x50022026))
    const sampleTypes = [
      ...GRADE5_UNIT2_ITEM_TYPES,
      ...GRADE5_UNIT2_ITEM_TYPES.slice(0, 8),
    ]
    const samples = sampleTypes.map((itemType, index) => {
      const difficulty = DIFFICULTIES[(index + Math.floor(index / GRADE5_UNIT2_ITEM_TYPES.length)) % DIFFICULTIES.length]
      const question = generateGrade5Unit2Question(itemType, difficulty)
      return `${String(index + 1).padStart(2, '0')} | ${itemType} | D${difficulty} | ${question.prompt} | Answer: ${answerOf(question)}`
    })
    expect(samples).toHaveLength(20)
    console.info(`DESK SAMPLES (seed 0x50022026)\n${samples.join('\n')}`)
  })
})
