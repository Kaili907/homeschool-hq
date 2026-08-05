import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../../genUtils'
import type { Difficulty } from '../../types'
import {
  UNIT2_GENERATORS,
  UNIT2_ITEM_TYPES,
  UNIT2_WORKED_EXAMPLES,
  generateUnit2Question,
  type Unit2ItemType,
} from './grade5MathUnit2'
import {
  curriculumAnswer,
  curriculumMultipleChoice,
  type CurriculumQuestion,
} from './shared'

const EXPECTED_ITEM_TYPES = [
  'powers-of-ten-patterns',
  'reading-decimals-through-thousandths',
  'expanded-form',
  'comparing-decimals',
  'rounding-decimals',
  'number-lines-and-place-value-charts',
] as const

const ITEMS_PER_TYPE = 600

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

afterEach(() => setRng(null))

function parseScaled(decimal: string): number {
  const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(decimal)
  expect(match, `expected a nonnegative decimal through thousandths: ${decimal}`).not.toBeNull()
  const fraction = (match?.[2] ?? '').padEnd(3, '0')
  return Number(match?.[1]) * 1000 + Number(fraction || 0)
}

const WORD_VALUES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

function parseNumberWords(words: string): number {
  const tokens = words.split(/[ -]/).filter(Boolean)
  let total = 0
  let current = 0
  for (const token of tokens) {
    if (token === 'hundred') {
      current *= 100
      continue
    }
    const value = WORD_VALUES[token]
    expect(value, `unknown number word: ${token}`).not.toBeUndefined()
    current += value
  }
  total += current
  return total
}

function parseDecimalWords(words: string): number {
  const match = /^(.+) and (.+) (tenth|tenths|hundredth|hundredths|thousandth|thousandths)$/.exec(words)
  expect(match, `expected decimal number words: ${words}`).not.toBeNull()
  const denominator = match?.[3] ?? ''
  const places = denominator.startsWith('tenth')
    ? 1
    : denominator.startsWith('hundredth')
      ? 2
      : 3
  return parseNumberWords(match?.[1] ?? '') * 1000
    + parseNumberWords(match?.[2] ?? '') * 10 ** (3 - places)
}

function expectOnlyComputedChoiceIsCorrect(
  question: CurriculumQuestion<Unit2ItemType>,
  valueOf: (choice: string) => number | string,
  expected: number | string,
): void {
  question.choices.forEach((choice, index) => {
    if (index === question.answerIndex) {
      expect(valueOf(choice)).toBe(expected)
    } else {
      expect(valueOf(choice)).not.toBe(expected)
    }
  })
}

function verifyPowersQuestion(question: CurriculumQuestion<Unit2ItemType>): void {
  const computation = /^Compute (\d+(?:\.\d{1,3})?) (\u00d7|\u00f7) 10\^(\d)\.$/.exec(question.prompt)
  if (computation) {
    const base = parseScaled(computation[1])
    const factor = 10 ** Number(computation[3])
    const expected = computation[2] === '\u00d7' ? base * factor : base / factor
    expect(Number.isSafeInteger(expected)).toBe(true)
    expectOnlyComputedChoiceIsCorrect(question, parseScaled, expected)
    return
  }

  const relationship = /^In (\d+(?:\.\d{1,3})?), the digit (\d) appears in the (tens|ones|tenths|hundredths) place and the (ones|tenths|hundredths|thousandths) place\. The (tens|ones|tenths|hundredths|thousandths)-place digit is how much of the value of the (tens|ones|tenths|hundredths|thousandths)-place digit\?$/.exec(question.prompt)
  if (relationship) {
    const placeScales: Record<string, number> = {
      tens: 10_000,
      ones: 1000,
      tenths: 100,
      hundredths: 10,
      thousandths: 1,
    }
    const scaled = parseScaled(relationship[1])
    const digit = Number(relationship[2])
    expect(Math.floor(scaled / placeScales[relationship[3]]) % 10).toBe(digit)
    expect(Math.floor(scaled / placeScales[relationship[4]]) % 10).toBe(digit)
    const expected = placeScales[relationship[5]] / placeScales[relationship[6]]
    const relationshipValues: Record<string, number> = {
      '10 times as much': 10,
      '1/10 as much': 0.1,
      '100 times as much': 100,
      '1/100 as much': 0.01,
      'the same value': 1,
    }
    for (const choice of question.choices) {
      expect(relationshipValues[choice], `unexpected relationship choice: ${choice}`).not.toBeUndefined()
    }
    expectOnlyComputedChoiceIsCorrect(question, (choice) => relationshipValues[choice], expected)
    return
  }

  const explanation = /^A student computed (\d+(?:\.\d{1,3})?) (\u00d7|\u00f7) 10\^(\d) = (\d+(?:\.\d{1,3})?)\. Which statement explains the power-of-ten pattern\?$/.exec(question.prompt)
  expect(explanation).not.toBeNull()
  const base = parseScaled(explanation?.[1] ?? '')
  const operation = explanation?.[2]
  const exponent = Number(explanation?.[3])
  const result = parseScaled(explanation?.[4] ?? '')
  const factor = 10 ** exponent
  expect(result).toBe(operation === '\u00d7' ? base * factor : base / factor)
  const placeWord = exponent === 1 ? 'place' : 'places'
  const expected = operation === '\u00d7'
    ? `Each digit has ${factor} times its original value, so the decimal point is written ${exponent} ${placeWord} farther right.`
    : `Each digit has 1/${factor} of its original value, so the decimal point is written ${exponent} ${placeWord} farther left.`
  expectOnlyComputedChoiceIsCorrect(question, (choice) => choice, expected)
}

function verifyReadingQuestion(question: CurriculumQuestion<Unit2ItemType>): void {
  const decimalPrompt = /^Which is the word form of (\d+(?:\.\d{1,3})?)\?$/.exec(question.prompt)
  if (decimalPrompt) {
    const expected = parseScaled(decimalPrompt[1])
    expectOnlyComputedChoiceIsCorrect(question, parseDecimalWords, expected)
    return
  }

  const wordPrompt = /^Which decimal matches "(.+)"\?$/.exec(question.prompt)
  expect(wordPrompt).not.toBeNull()
  const expected = parseDecimalWords(wordPrompt?.[1] ?? '')
  expectOnlyComputedChoiceIsCorrect(question, parseScaled, expected)
}

function evaluateExpandedForm(expression: string): number {
  return expression.split(' + ').reduce((sum, term) => sum + parseScaled(term), 0)
}

function verifyExpandedQuestion(question: CurriculumQuestion<Unit2ItemType>): void {
  const match = /^Which is the expanded form of (\d+(?:\.\d{1,3})?)\?$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const expected = parseScaled(match?.[1] ?? '')
  expectOnlyComputedChoiceIsCorrect(question, evaluateExpandedForm, expected)
}

function verifyComparingQuestion(question: CurriculumQuestion<Unit2ItemType>): void {
  const match = /^Which symbol makes this comparison true\?\n(\d+(?:\.\d{1,3})?) __ (\d+(?:\.\d{1,3})?)$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const left = parseScaled(match?.[1] ?? '')
  const right = parseScaled(match?.[2] ?? '')
  const expected = left < right ? '<' : left > right ? '>' : '='
  expectOnlyComputedChoiceIsCorrect(question, (choice) => choice, expected)
}

function independentRound(scaled: number, quantum: number): number {
  const lower = Math.floor(scaled / quantum) * quantum
  return scaled - lower >= quantum / 2 ? lower + quantum : lower
}

function verifyRoundingQuestion(question: CurriculumQuestion<Unit2ItemType>): void {
  const match = /^Round (\d+(?:\.\d{3})) to the nearest (whole number|tenth|hundredth)\.$/.exec(question.prompt)
  expect(match).not.toBeNull()
  const places = match?.[2] === 'whole number' ? 0 : match?.[2] === 'tenth' ? 1 : 2
  const quantum = 10 ** (3 - places)
  const expected = independentRound(parseScaled(match?.[1] ?? ''), quantum)
  expectOnlyComputedChoiceIsCorrect(question, parseScaled, expected)
  const precision = places === 0 ? /^\d+$/ : places === 1 ? /^\d+\.\d$/ : /^\d+\.\d{2}$/
  for (const choice of question.choices) expect(choice).toMatch(precision)
}

const PLACE_SCALE: Record<string, number> = {
  tenths: 100,
  hundredths: 10,
  thousandths: 1,
}

function verifyRepresentationQuestion(question: CurriculumQuestion<Unit2ItemType>): void {
  const chart = /^Place-value chart for (\d+(?:\.\d{2,3})):\nhundreds \| tens \| ones \| tenths \| hundredths \| thousandths\n(\d) \| (\d) \| (\d) \| (\d) \| (\d) \| (\d)\nWhat is the value of the digit (\d) in the (tenths|hundredths|thousandths) place\?$/.exec(question.prompt)
  if (chart) {
    const [wholeText, fractionText] = chart[1].split('.')
    const expectedRow = `${wholeText.padStart(3, '0')}${fractionText.padEnd(3, '0')}`
      .split('')
      .map(Number)
    expect(chart.slice(2, 8).map(Number)).toEqual(expectedRow)
    const digit = Number(chart[8])
    const place = chart[9]
    const placeIndex = place === 'tenths' ? 3 : place === 'hundredths' ? 4 : 5
    expect(expectedRow[placeIndex]).toBe(digit)
    const expected = digit * PLACE_SCALE[place]
    expectOnlyComputedChoiceIsCorrect(question, parseScaled, expected)
    const validDigitValues = new Set([1, 10, 100, 1000].map((scale) => digit * scale))
    for (const choice of question.choices) {
      expect(validDigitValues.has(parseScaled(choice))).toBe(true)
    }
    return
  }

  const line = /^A number line starts at (\d+(?:\.\d{1,3})?) and ends at (\d+(?:\.\d{1,3})?) with 10 equal intervals\. What value is at tick (\d) after the start\?$/.exec(question.prompt)
  expect(line).not.toBeNull()
  const start = parseScaled(line?.[1] ?? '')
  const end = parseScaled(line?.[2] ?? '')
  const span = end - start
  expect(span % 10).toBe(0)
  const step = span / 10
  const expected = start + step * Number(line?.[3])
  expectOnlyComputedChoiceIsCorrect(question, parseScaled, expected)
  for (const choice of question.choices) {
    const value = parseScaled(choice)
    expect(value).toBeGreaterThanOrEqual(start)
    expect(value).toBeLessThanOrEqual(end)
    expect((value - start) % step).toBe(0)
  }
}

function verifyIndependently(question: CurriculumQuestion<Unit2ItemType>): void {
  switch (question.itemType) {
    case 'powers-of-ten-patterns':
      verifyPowersQuestion(question)
      return
    case 'reading-decimals-through-thousandths':
      verifyReadingQuestion(question)
      return
    case 'expanded-form':
      verifyExpandedQuestion(question)
      return
    case 'comparing-decimals':
      verifyComparingQuestion(question)
      return
    case 'rounding-decimals':
      verifyRoundingQuestion(question)
      return
    case 'number-lines-and-place-value-charts':
      verifyRepresentationQuestion(question)
  }
}

describe('Grade 5 Math Unit 2 coverage contract', () => {
  it('matches the six curriculum-derived item types exactly', () => {
    expect(UNIT2_ITEM_TYPES).toEqual(EXPECTED_ITEM_TYPES)
    expect(Object.keys(UNIT2_GENERATORS)).toEqual(EXPECTED_ITEM_TYPES)
    expect(Object.keys(UNIT2_WORKED_EXAMPLES)).toEqual(EXPECTED_ITEM_TYPES)
  })

  it('reaches every item type at every difficulty', () => {
    setRng(seededRng(0x5a17))
    for (const itemType of UNIT2_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateUnit2Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    for (const itemType of UNIT2_ITEM_TYPES) {
      const example = UNIT2_WORKED_EXAMPLES[itemType]
      expect(example.itemType).toBe(itemType)
      expect(example.problem.trim().length).toBeGreaterThan(0)
      expect(example.teaching.trim().length).toBeGreaterThan(0)
      expect(example.answer.trim().length).toBeGreaterThan(0)
    }
  })

  it('never falls back outside a validated curriculum pool, even with a constant RNG', () => {
    setRng(() => 0)
    const question = curriculumMultipleChoice(
      'rounding-decimals',
      1,
      'Regression probe',
      '0',
      ['1', '2', '3'],
    )
    expect(new Set(question.choices)).toEqual(new Set(['0', '1', '2', '3']))
    expect(question.choices[question.answerIndex]).toBe('0')
  })
})

describe('Grade 5 Math Unit 2 independent property verification', () => {
  for (const [typeIndex, itemType] of UNIT2_ITEM_TYPES.entries()) {
    it(`${itemType}: ${ITEMS_PER_TYPE} items have independently recomputed answers and domain-valid distractors`, () => {
      setRng(seededRng(0xc0de_5000 + typeIndex))
      for (let run = 0; run < ITEMS_PER_TYPE; run++) {
        const difficulty = ((run % 3) + 1) as Difficulty
        const question = generateUnit2Question(itemType, difficulty)
        expect(question.prompt.trim().length).toBeGreaterThan(0)
        expect(question.choices.length).toBeGreaterThanOrEqual(2)
        expect(question.choices.length).toBeLessThanOrEqual(4)
        expect(new Set(question.choices).size).toBe(question.choices.length)
        expect(question.answerIndex).toBeGreaterThanOrEqual(0)
        expect(question.answerIndex).toBeLessThan(question.choices.length)
        expect(curriculumAnswer(question).trim().length).toBeGreaterThan(0)
        verifyIndependently(question)
      }
    })
  }
})

describe('Grade 5 Math Unit 2 decimal edge cases', () => {
  it('generates and verifies decimals through thousandths', () => {
    setRng(seededRng(0x1003))
    for (let run = 0; run < 60; run++) {
      const question = generateUnit2Question('reading-decimals-through-thousandths', 2)
      expect(question.prompt).toMatch(/\.\d{3}/)
      verifyIndependently(question)
    }
  })

  it('preserves meaningful trailing zeros in decimal reading items', () => {
    setRng(seededRng(0x7000))
    for (let run = 0; run < 60; run++) {
      const question = generateUnit2Question('reading-decimals-through-thousandths', 3)
      const visible = `${question.prompt} ${curriculumAnswer(question)}`
      expect(visible).toMatch(/\.\d{2}0/)
      verifyIndependently(question)
    }
  })

  it('rounds exact halfway values upward at every supported target place', () => {
    setRng(seededRng(0x5005))
    for (let run = 0; run < 90; run++) {
      const question = generateUnit2Question('rounding-decimals', 3)
      const match = /^Round (\d+(?:\.\d{3})) to the nearest (whole number|tenth|hundredth)\.$/.exec(question.prompt)
      expect(match).not.toBeNull()
      const places = match?.[2] === 'whole number' ? 0 : match?.[2] === 'tenth' ? 1 : 2
      const quantum = 10 ** (3 - places)
      const scaled = parseScaled(match?.[1] ?? '')
      expect(scaled % quantum).toBe(quantum / 2)
      expect(parseScaled(curriculumAnswer(question))).toBe(Math.floor(scaled / quantum) * quantum + quantum)
    }
  })

  it('keeps a complete on-grid choice set when a difficulty-1 value rounds to zero', () => {
    setRng(seededRng(0x7654_3210))
    let sawZero = false
    for (let run = 0; run < 5000; run++) {
      const question = generateUnit2Question('rounding-decimals', 1)
      verifyIndependently(question)
      if (parseScaled(curriculumAnswer(question)) === 0) sawZero = true
    }
    expect(sawZero).toBe(true)
  })

  it('moves across the decimal point for difficulty-3 powers-of-ten items', () => {
    setRng(seededRng(0x10de))
    const operations = new Set<string>()
    let sawExplanation = false
    for (let run = 0; run < 90; run++) {
      const question = generateUnit2Question('powers-of-ten-patterns', 3)
      const match = /^(?:Compute|A student computed) (\d+(?:\.\d{1,3})?) (\u00d7|\u00f7) 10\^(\d)(?: = (\d+(?:\.\d{1,3})?)\. Which statement explains the power-of-ten pattern\?|\.)$/.exec(question.prompt)
      expect(match).not.toBeNull()
      const base = parseScaled(match?.[1] ?? '')
      const factor = 10 ** Number(match?.[3])
      const answer = match?.[4]
        ? parseScaled(match[4])
        : match?.[2] === '\u00d7'
          ? base * factor
          : base / factor
      operations.add(match?.[2] ?? '')
      if (match?.[4]) sawExplanation = true
      if (match?.[2] === '\u00d7') {
        expect(base).toBeLessThan(1000)
        expect(answer).toBeGreaterThanOrEqual(1000)
      } else {
        expect(base).toBeGreaterThanOrEqual(1000)
        expect(answer).toBeLessThan(1000)
      }
      verifyIndependently(question)
    }
    expect(operations).toEqual(new Set(['\u00d7', '\u00f7']))
    expect(sawExplanation).toBe(true)
  })

  it('reaches adjacent-place relationships and every rounding target place', () => {
    setRng(seededRng(0xa11c_e770))
    const relationships = new Set<string>()
    const roundingTargets = new Set<string>()
    for (let run = 0; run < 180; run++) {
      const power = generateUnit2Question('powers-of-ten-patterns', 1)
      const relationship = /The (tens|ones|tenths|hundredths|thousandths)-place digit is how much/.exec(power.prompt)
      expect(relationship).not.toBeNull()
      relationships.add(relationship?.[1] ?? '')
      verifyIndependently(power)

      const rounding = generateUnit2Question('rounding-decimals', 3)
      const target = /nearest (whole number|tenth|hundredth)\./.exec(rounding.prompt)
      roundingTargets.add(target?.[1] ?? '')
    }
    expect(relationships.size).toBeGreaterThanOrEqual(4)
    expect(roundingTargets).toEqual(new Set(['whole number', 'tenth', 'hundredth']))
  })

  it('reaches equality with trailing zeros and both representation variants', () => {
    setRng(seededRng(0xe901))
    let sawEqualTrailingZeros = false
    let sawChart = false
    let sawNumberLine = false
    let sawThousandthLine = false

    for (let run = 0; run < 240; run++) {
      const comparison = generateUnit2Question('comparing-decimals', 3)
      if (curriculumAnswer(comparison) === '=' && /\.\d{1,2}0{1,2}$/.test(comparison.prompt)) {
        sawEqualTrailingZeros = true
      }

      const representation = generateUnit2Question('number-lines-and-place-value-charts', 3)
      if (representation.prompt.startsWith('Place-value chart for')) sawChart = true
      if (representation.prompt.startsWith('A number line')) {
        sawNumberLine = true
        const match = /starts at (\d+(?:\.\d{1,3})?) and ends at (\d+(?:\.\d{1,3})?)/.exec(representation.prompt)
        if (match && parseScaled(match[2]) - parseScaled(match[1]) === 10) {
          sawThousandthLine = true
        }
      }
    }

    expect(sawEqualTrailingZeros).toBe(true)
    expect(sawChart).toBe(true)
    expect(sawNumberLine).toBe(true)
    expect(sawThousandthLine).toBe(true)
  })
})
