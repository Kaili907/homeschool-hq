import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../../genUtils'
import type { Difficulty } from '../../types'
import {
  UNIT2_GENERATORS,
  UNIT2_ITEM_TYPE_CHECKLIST,
  UNIT2_ITEM_TYPES,
  UNIT2_WORKED_EXAMPLES,
  generateDecimalComparisonItem,
  generateDecimalNumberLineItem,
  generateDecimalNumberNameItem,
  generateDecimalRoundingItem,
  generateGrade5MathUnit2Item,
  generatePlaceValueChartItem,
  generatePowerOfTenCalculationItem,
  generatePowerOfTenNotationItem,
  generatePowerOfTenPatternItem,
  type Unit2GeneratedItem,
} from './grade5MathUnit2'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS_PER_DIFFICULTY = 80

afterEach(() => setRng(null))

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

function sequenceRng(values: number[], fallback = 0.25): () => number {
  let index = 0
  return () => values[index++] ?? fallback
}

function seedFor(text: string): number {
  let seed = 2166136261
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  return seed >>> 0
}

function decimalFraction(value: string): { numerator: bigint; denominator: bigint } {
  const [whole, fraction = ''] = value.split('.')
  const denominator = 10n ** BigInt(fraction.length)
  return {
    numerator: BigInt(whole) * denominator + BigInt(fraction || '0'),
    denominator,
  }
}

function exactDecimal(numerator: bigint, denominator: bigint, fixedPlaces?: number): string {
  let places = 0
  let divisor = denominator
  while (divisor > 1n && divisor % 10n === 0n) {
    divisor /= 10n
    places++
  }
  expect(divisor).toBe(1n)
  const whole = numerator / denominator
  const remainder = numerator % denominator
  if (fixedPlaces === 0) return String(whole)
  const fraction = String(remainder).padStart(places, '0')
  if (fixedPlaces !== undefined) {
    const adjusted = fraction.padEnd(fixedPlaces, '0').slice(0, fixedPlaces)
    return `${whole}.${adjusted}`
  }
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed === '' ? String(whole) : `${whole}.${trimmed}`
}

function wholeWords(value: number): string {
  const small = [
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
  if (value < 20) return small[value]
  if (value < 100) {
    const ones = value % 10
    return ones === 0 ? tens[Math.floor(value / 10)] : `${tens[Math.floor(value / 10)]}-${small[ones]}`
  }
  const remainder = value % 100
  return remainder === 0
    ? `${small[Math.floor(value / 100)]} hundred`
    : `${small[Math.floor(value / 100)]} hundred ${wholeWords(remainder)}`
}

function independentNumberName(numeral: string): string {
  const [wholeText, fraction] = numeral.split('.')
  const places = fraction.length
  const fractional = Number(fraction)
  const singular = places === 1 ? 'tenth' : places === 2 ? 'hundredth' : 'thousandth'
  return `${wholeWords(Number(wholeText))} and ${wholeWords(fractional)} ${fractional === 1 ? singular : `${singular}s`}`
}

function parseWholeWords(words: string): number {
  const small = new Map(
    [
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
    ].map((word, value) => [word, value]),
  )
  const tens = new Map([
    ['twenty', 20],
    ['thirty', 30],
    ['forty', 40],
    ['fifty', 50],
    ['sixty', 60],
    ['seventy', 70],
    ['eighty', 80],
    ['ninety', 90],
  ])
  const tokens = words.replaceAll('-', ' ').split(' ')
  let total = 0
  let current = 0
  for (const token of tokens) {
    if (small.has(token)) current += small.get(token) ?? 0
    else if (tens.has(token)) current += tens.get(token) ?? 0
    else if (token === 'hundred') {
      current *= 100
      total += current
      current = 0
    } else throw new Error(`Unknown number-name token: ${token}`)
  }
  return total + current
}

function independentWordsToNumeral(numberName: string): string {
  const [wholeWords, fractionalPhrase] = numberName.split(' and ')
  const match = /^(.*) (tenth|tenths|hundredth|hundredths|thousandth|thousandths)$/.exec(
    fractionalPhrase,
  )
  if (!match) throw new Error(`Cannot parse decimal number name: ${numberName}`)
  const places = match[2].startsWith('tenth') ? 1 : match[2].startsWith('hundred') ? 2 : 3
  const fractional = parseWholeWords(match[1])
  return `${parseWholeWords(wholeWords)}.${String(fractional).padStart(places, '0')}`
}

function independentExpanded(numeral: string): string {
  const [whole, fraction = ''] = numeral.split('.')
  const digits = `${whole}${fraction}`.split('').map(Number)
  const firstExponent = whole.length - 1
  const terms: string[] = []
  digits.forEach((digit, index) => {
    if (digit === 0) return
    const exponent = firstExponent - index
    if (exponent >= 0) terms.push(String(digit * 10 ** exponent))
    else terms.push(`0.${'0'.repeat(-exponent - 1)}${digit}`)
  })
  return terms.join(' + ')
}

function decimalToScaled(value: string, places: number): number {
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 10 ** places + Number(fraction.padEnd(places, '0').slice(0, places))
}

function formatScaled(value: number, places: number): string {
  if (places === 0) return String(value)
  const factor = 10 ** places
  return `${Math.floor(value / factor)}.${String(value % factor).padStart(places, '0')}`
}

const PLACE_VALUE = {
  hundreds: 100,
  tens: 10,
  ones: 1,
  tenths: 0.1,
  hundredths: 0.01,
  thousandths: 0.001,
} as const

function independentlyComputedAnswer(item: Unit2GeneratedItem): string {
  const prompt = item.prompt
  switch (item.itemType) {
    case 'adjacent-place-relationship': {
      const match = /A (\d) is in the (\w+) place\. Another \d is in the (\w+) place\./.exec(prompt)
      if (!match) throw new Error(`Cannot parse adjacent-place prompt: ${prompt}`)
      const firstPlace = match[2] as keyof typeof PLACE_VALUE
      const secondPlace = match[3] as keyof typeof PLACE_VALUE
      const ratio = PLACE_VALUE[firstPlace] / PLACE_VALUE[secondPlace]
      return ratio > 1 ? '10 times as much' : '1/10 as much'
    }
    case 'power-of-ten-notation': {
      const powerToValue = /equals 10\^(\d+)\?/.exec(prompt)
      if (powerToValue) return String(10 ** Number(powerToValue[1]))
      const valueToExponent = /10\^\? = (\d+)/.exec(prompt)
      if (valueToExponent) return String(valueToExponent[1].length - 1)
      const valueToPower = /power of ten equals (\d+)/.exec(prompt)
      if (valueToPower) return `10^${valueToPower[1].length - 1}`
      throw new Error(`Cannot parse power-notation prompt: ${prompt}`)
    }
    case 'powers-of-ten-calculation': {
      const match = /Calculate ([\d.]+) ([×÷]) 10\^(\d+)\./.exec(prompt)
      if (!match) throw new Error(`Cannot parse power calculation: ${prompt}`)
      const value = decimalFraction(match[1])
      const power = 10n ** BigInt(match[3])
      return match[2] === '×'
        ? exactDecimal(value.numerator * power, value.denominator)
        : exactDecimal(value.numerator, value.denominator * power)
    }
    case 'powers-of-ten-pattern': {
      const match = /pattern in ([\d.]+) ([×÷]) 10\^(\d+)\?/.exec(prompt)
      if (!match) throw new Error(`Cannot parse power pattern: ${prompt}`)
      const operand = match[1]
      const exponent = Number(match[3])
      const value = decimalFraction(operand)
      const power = 10n ** BigInt(exponent)
      const result =
        match[2] === '×'
          ? exactDecimal(value.numerator * power, value.denominator)
          : exactDecimal(value.numerator, value.denominator * power)
      if (prompt.includes('zero pattern')) {
        return `The product is ${result}; it has ${exponent} new ${exponent === 1 ? 'zero' : 'zeros'} after ${operand}.`
      }
      return `Place the decimal point ${exponent} ${exponent === 1 ? 'place' : 'places'} to the ${match[2] === '×' ? 'right' : 'left'}; the result is ${result}.`
    }
    case 'decimal-number-name': {
      const numeralToName = /matches ([\d.]+)\?$/.exec(prompt)
      if (numeralToName) return independentNumberName(numeralToName[1])
      const nameToNumeral = /matches “(.+)”\?/.exec(prompt)
      if (!nameToNumeral) throw new Error(`Cannot parse number-name prompt: ${prompt}`)
      return independentWordsToNumeral(nameToNumeral[1])
    }
    case 'decimal-expanded-form': {
      const numeralToExpanded = /expanded form of ([\d.]+)\?/.exec(prompt)
      if (numeralToExpanded) return independentExpanded(numeralToExpanded[1])
      const expandedToNumeral = /equals ([\d. +]+)\?/.exec(prompt)
      if (!expandedToNumeral) throw new Error(`Cannot parse expanded-form prompt: ${prompt}`)
      const thousandths = expandedToNumeral[1]
        .split(' + ')
        .reduce((sum, term) => sum + decimalToScaled(term, 3), 0)
      return exactDecimal(BigInt(thousandths), 1000n)
    }
    case 'compare-decimals': {
      const match = /true\? ([\d.]+) ___ ([\d.]+)$/.exec(prompt)
      if (!match) throw new Error(`Cannot parse comparison prompt: ${prompt}`)
      const left = decimalFraction(match[1])
      const right = decimalFraction(match[2])
      const leftCommon = left.numerator * right.denominator
      const rightCommon = right.numerator * left.denominator
      return leftCommon > rightCommon ? '>' : leftCommon < rightCommon ? '<' : '='
    }
    case 'round-decimal': {
      const match = /Round ([\d.]+) to the nearest (whole number|tenth|hundredth)\./.exec(prompt)
      if (!match) throw new Error(`Cannot parse rounding prompt: ${prompt}`)
      const targetPlaces = match[2] === 'whole number' ? 0 : match[2] === 'tenth' ? 1 : 2
      const value = decimalFraction(match[1])
      const targetScale = 10n ** BigInt(targetPlaces)
      const scaledNumerator = value.numerator * targetScale
      const lower = scaledNumerator / value.denominator
      const remainder = scaledNumerator % value.denominator
      const rounded = remainder * 2n >= value.denominator ? lower + 1n : lower
      return formatScaled(Number(rounded), targetPlaces)
    }
    case 'decimal-number-line': {
      const match = /from ([\d.]+) to ([\d.]+) is divided into (\d+) equal intervals\. Point P is at tick (\d+)/.exec(
        prompt,
      )
      if (!match) throw new Error(`Cannot parse number-line prompt: ${prompt}`)
      const displayPlaces = match[1].split('.')[1].length
      const start = decimalToScaled(match[1], displayPlaces)
      const end = decimalToScaled(match[2], displayPlaces)
      const step = (end - start) / Number(match[3])
      return formatScaled(start + step * Number(match[4]), displayPlaces)
    }
    case 'place-value-chart': {
      const lines = prompt.split('\n')
      const columns = lines[1]
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean)
      const onesIndex = columns.indexOf('ones')
      const displayPlaces = columns.length - onesIndex - 1
      if (prompt.startsWith('What number')) {
        const digits = lines[3]
          .split('|')
          .map((value) => value.trim())
          .filter(Boolean)
          .map(Number)
        const whole = digits.slice(0, onesIndex + 1).join('')
        const fraction = digits.slice(onesIndex + 1).join('')
        return displayPlaces === 0 ? String(Number(whole)) : `${Number(whole)}.${fraction}`
      }
      const numeral = /digits of ([\d.]+)/.exec(prompt)?.[1]
      if (!numeral) throw new Error(`Cannot parse chart composition prompt: ${prompt}`)
      const [whole, fraction = ''] = numeral.split('.')
      const wholeDigits = whole.padStart(onesIndex + 1, '0').split('')
      const decimalDigits = fraction.padEnd(displayPlaces, '0').split('')
      const digits = [...wholeDigits, ...decimalDigits]
      return `| ${digits.join(' | ')} |`
    }
  }
}

function expectPromptMatchesModel(item: Unit2GeneratedItem): void {
  const model = item.model
  switch (model.kind) {
    case 'adjacent-place-relationship':
      expect(item.prompt).toContain(String(model.digit))
      expect(item.prompt).toContain(model.firstPlace)
      expect(item.prompt).toContain(model.secondPlace)
      break
    case 'power-of-ten-notation':
      if (model.direction === 'power-to-value') {
        expect(item.prompt).toContain(`10^${model.exponent}`)
      } else {
        expect(item.prompt).toContain(model.value)
      }
      break
    case 'powers-of-ten-calculation':
      expect(item.prompt).toContain(model.operand)
      expect(item.prompt).toContain(`10^${model.exponent}`)
      expect(item.prompt).toContain(model.operation === 'multiply' ? '×' : '÷')
      break
    case 'powers-of-ten-pattern':
      expect(item.prompt).toContain(model.operand)
      expect(item.prompt).toContain(`10^${model.exponent}`)
      expect(item.prompt).toContain(model.operation === 'multiply' ? '×' : '÷')
      expect(item.answer).toContain(model.result)
      break
    case 'decimal-number-name':
      expect(item.prompt).toContain(
        model.direction === 'numeral-to-name' ? model.numeral : model.numberName,
      )
      expect(model.numberName).toBe(independentNumberName(model.numeral))
      break
    case 'decimal-expanded-form':
      expect(item.prompt).toContain(
        model.direction === 'numeral-to-expanded' ? model.numeral : model.expanded,
      )
      expect(model.expanded).toBe(independentExpanded(model.numeral))
      break
    case 'compare-decimals':
      expect(item.prompt).toContain(model.left)
      expect(item.prompt).toContain(model.right)
      break
    case 'round-decimal':
      expect(item.prompt).toContain(model.numeral)
      expect(item.prompt).toContain(model.target)
      break
    case 'decimal-number-line':
      expect(item.prompt).toContain(model.start)
      expect(item.prompt).toContain(model.end)
      expect(item.prompt).toContain(`tick ${model.tick}`)
      break
    case 'place-value-chart':
      model.columns.forEach((column) => expect(item.prompt).toContain(column))
      if (model.direction === 'chart-to-numeral') {
        model.digits.forEach((digit) => expect(item.prompt).toContain(String(digit)))
      } else {
        expect(item.prompt).toContain('Which row')
        expect(item.answer).toBe(`| ${model.digits.join(' | ')} |`)
      }
      break
  }
}

describe('Grade 5 math Unit 2 coverage contract', () => {
  it('has exactly one distinct generator and one worked example per checklist item', () => {
    const checklistIds = UNIT2_ITEM_TYPE_CHECKLIST.map(({ id }) => id)
    expect(checklistIds).toEqual(UNIT2_ITEM_TYPES)
    expect(Object.keys(UNIT2_GENERATORS)).toEqual(expect.arrayContaining(UNIT2_ITEM_TYPES))
    expect(Object.keys(UNIT2_GENERATORS)).toHaveLength(UNIT2_ITEM_TYPES.length)
    expect(new Set(Object.values(UNIT2_GENERATORS)).size).toBe(UNIT2_ITEM_TYPES.length)
    expect(Object.keys(UNIT2_WORKED_EXAMPLES)).toEqual(expect.arrayContaining(UNIT2_ITEM_TYPES))
    expect(Object.keys(UNIT2_WORKED_EXAMPLES)).toHaveLength(UNIT2_ITEM_TYPES.length)
  })

  it('routes every checklist item and difficulty to the requested item type', () => {
    setRng(seededRng(0x5_02_19_36))
    for (const itemType of UNIT2_ITEM_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        const item = generateGrade5MathUnit2Item(itemType, difficulty)
        expect(item.itemType).toBe(itemType)
        expect(item.model.kind).toBe(itemType)
        expect(item.difficulty).toBe(difficulty)
      }
    }
  })

  it('reaches every bidirectional and power-pattern submode', () => {
    setRng(seededRng(0x5_02_c0de))
    const notationDirections = new Set<string>()
    const operations = new Set<string>()
    const patternFoci = new Set<string>()
    const numberNameDirections = new Set<string>()
    const expandedDirections = new Set<string>()
    const chartDirections = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      for (let run = 0; run < 80; run++) {
        const notation = UNIT2_GENERATORS['power-of-ten-notation'](difficulty)
        const calculation = UNIT2_GENERATORS['powers-of-ten-calculation'](difficulty)
        const pattern = UNIT2_GENERATORS['powers-of-ten-pattern'](difficulty)
        const numberName = UNIT2_GENERATORS['decimal-number-name'](difficulty)
        const expanded = UNIT2_GENERATORS['decimal-expanded-form'](difficulty)
        const chart = UNIT2_GENERATORS['place-value-chart'](difficulty)
        if (notation.model.kind === 'power-of-ten-notation') notationDirections.add(notation.model.direction)
        if (calculation.model.kind === 'powers-of-ten-calculation') operations.add(calculation.model.operation)
        if (pattern.model.kind === 'powers-of-ten-pattern') patternFoci.add(pattern.model.focus)
        if (numberName.model.kind === 'decimal-number-name') numberNameDirections.add(numberName.model.direction)
        if (expanded.model.kind === 'decimal-expanded-form') expandedDirections.add(expanded.model.direction)
        if (chart.model.kind === 'place-value-chart') chartDirections.add(chart.model.direction)
      }
    }
    expect(notationDirections).toEqual(
      new Set(['power-to-value', 'value-to-exponent', 'value-to-power']),
    )
    expect(operations).toEqual(new Set(['multiply', 'divide']))
    expect(patternFoci).toEqual(new Set(['zero-count', 'decimal-placement']))
    expect(numberNameDirections).toEqual(new Set(['numeral-to-name', 'name-to-numeral']))
    expect(expandedDirections).toEqual(new Set(['numeral-to-expanded', 'expanded-to-numeral']))
    expect(chartDirections).toEqual(new Set(['chart-to-numeral', 'numeral-to-chart']))
  })

  it('keeps every authored worked example complete and short', () => {
    for (const itemType of UNIT2_ITEM_TYPES) {
      const example = UNIT2_WORKED_EXAMPLES[itemType]
      expect(example.problem.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(1)
      expect(example.steps.length).toBeLessThanOrEqual(3)
      expect(example.answer.trim()).not.toBe('')
    }
  })
})

describe('Grade 5 math Unit 2 property tests (240 generated items per item type)', () => {
  for (const itemType of UNIT2_ITEM_TYPES) {
    it(`${itemType}: independently recomputes every answer`, () => {
      setRng(seededRng(seedFor(itemType)))
      let generated = 0
      for (const difficulty of DIFFICULTIES) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const item = UNIT2_GENERATORS[itemType](difficulty)
          generated++
          expect(item.itemType).toBe(itemType)
          expect(item.difficulty).toBe(difficulty)
          expect(item.prompt.trim()).not.toBe('')
          expect(item.answer).toBe(independentlyComputedAnswer(item))
          expect(item.answerIndex).toBeGreaterThanOrEqual(0)
          expect(item.answerIndex).toBeLessThan(item.choices.length)
          expect(item.choices[item.answerIndex]).toBe(item.answer)
          expect(item.choices.length).toBeGreaterThanOrEqual(3)
          expect(item.choices.length).toBeLessThanOrEqual(4)
          expect(new Set(item.choices).size).toBe(item.choices.length)
          item.choices.forEach((choice) => expect(choice.trim()).not.toBe(''))
          if (item.model.kind === 'decimal-number-name' && item.model.direction === 'numeral-to-name') {
            item.choices.forEach((choice) =>
              expect(choice).toMatch(/ (tenths?|hundredths?|thousandths?)$/),
            )
          }
          if (item.model.kind === 'round-decimal') {
            item.choices.forEach((choice) => expect(Number(choice)).toBeGreaterThanOrEqual(0))
          }
          expectPromptMatchesModel(item)
        }
      }
      expect(generated).toBe(240)
    })
  }
})

describe('Grade 5 math Unit 2 edge cases', () => {
  it('reads and writes exactly through thousandths at difficulty 3', () => {
    setRng(seededRng(0x3000))
    for (let run = 0; run < 200; run++) {
      const item = generateDecimalNumberNameItem(3)
      expect(item.model.kind).toBe('decimal-number-name')
      if (item.model.kind !== 'decimal-number-name') continue
      expect(item.model.numeral).toMatch(/^\d+\.\d{3}$/)
      expect(item.answer).toBe(independentlyComputedAnswer(item))
    }
  })

  it('generates trailing-zero equality comparisons', () => {
    setRng(seededRng(0x70005))
    let found: Unit2GeneratedItem | undefined
    for (let run = 0; run < 200; run++) {
      const item = generateDecimalComparisonItem(3)
      if (
        item.model.kind === 'compare-decimals' &&
        item.model.left !== item.model.right &&
        independentlyComputedAnswer(item) === '='
      ) {
        found = item
        break
      }
    }
    expect(found).toBeDefined()
    expect(found?.answer).toBe('=')
    expect(`${found?.model.kind === 'compare-decimals' ? found.model.left + found.model.right : ''}`).toMatch(/0$/)
  })

  it('rounds exact .5 boundaries upward at the whole, tenth, and hundredth places', () => {
    setRng(() => 0.5)
    const whole = generateDecimalRoundingItem(1)
    expect(whole.model.kind).toBe('round-decimal')
    expect(whole.model.kind === 'round-decimal' ? whole.model.numeral : '').toMatch(/\.5$/)
    expect(whole.answer).toBe(independentlyComputedAnswer(whole))

    setRng(() => 0.5)
    const tenth = generateDecimalRoundingItem(2)
    expect(tenth.model.kind).toBe('round-decimal')
    expect(tenth.model.kind === 'round-decimal' ? tenth.model.numeral : '').toMatch(/5$/)
    expect(tenth.model.kind === 'round-decimal' ? tenth.model.target : '').toBe('tenth')
    expect(tenth.answer).toBe(independentlyComputedAnswer(tenth))

    setRng(sequenceRng([0.9, 0.5, 0.5, 0.5, 0.5]))
    const hundredth = generateDecimalRoundingItem(3)
    expect(hundredth.model.kind).toBe('round-decimal')
    expect(hundredth.model.kind === 'round-decimal' ? hundredth.model.numeral : '').toMatch(/5$/)
    expect(hundredth.model.kind === 'round-decimal' ? hundredth.model.target : '').toBe('hundredth')
    expect(hundredth.answer).toBe(independentlyComputedAnswer(hundredth))
  })

  it('keeps near-zero rounding distractors nonnegative and in the target place', () => {
    setRng(sequenceRng([0, 0, 0.4]))
    const item = generateDecimalRoundingItem(2)
    expect(item.model.kind).toBe('round-decimal')
    if (item.model.kind !== 'round-decimal') return
    expect(item.model.numeral).toBe('0.04')
    expect(item.answer).toBe('0.0')
    expect(item.choices).toHaveLength(4)
    item.choices.forEach((choice) => {
      expect(choice).toMatch(/^\d+\.\d$/)
      expect(Number(choice)).toBeGreaterThanOrEqual(0)
    })
  })

  it('moves a value across the decimal point when dividing by a power of ten', () => {
    setRng(() => 0.75)
    const item = generatePowerOfTenCalculationItem(3)
    expect(item.model.kind).toBe('powers-of-ten-calculation')
    if (item.model.kind !== 'powers-of-ten-calculation') return
    expect(item.model.operation).toBe('divide')
    expect(Number(item.model.operand)).toBeGreaterThanOrEqual(1)
    expect(Number(item.answer)).toBeLessThan(1)
    expect(item.answer).toBe(independentlyComputedAnswer(item))
  })

  it('has only one numerically correct notation choice when the exponent is 1', () => {
    setRng(sequenceRng([0, 0.75]))
    const item = generatePowerOfTenNotationItem(3)
    expect(item.model.kind).toBe('power-of-ten-notation')
    if (item.model.kind !== 'power-of-ten-notation') return
    expect(item.model.exponent).toBe(1)
    expect(item.model.direction).toBe('value-to-power')
    const evaluate = (choice: string): number => {
      const power = /^10\^(\d+)$/.exec(choice)
      if (power) return 10 ** Number(power[1])
      const product = /^10 × (\d+)$/.exec(choice)
      if (product) return 10 * Number(product[1])
      const sum = /^10 \+ (\d+)$/.exec(choice)
      if (sum) return 10 + Number(sum[1])
      return Number(choice)
    }
    expect(item.choices.filter((choice) => evaluate(choice) === 10)).toEqual([item.answer])
  })

  it('generates both zero-count and decimal-placement explanations', () => {
    setRng(seededRng(0x10_10))
    const zeroPattern = generatePowerOfTenPatternItem(1)
    expect(zeroPattern.model.kind).toBe('powers-of-ten-pattern')
    expect(zeroPattern.model.kind === 'powers-of-ten-pattern' ? zeroPattern.model.focus : '').toBe(
      'zero-count',
    )
    expect(zeroPattern.answer).toBe(independentlyComputedAnswer(zeroPattern))

    setRng(() => 0.75)
    const decimalPattern = generatePowerOfTenPatternItem(3)
    expect(decimalPattern.model.kind).toBe('powers-of-ten-pattern')
    expect(
      decimalPattern.model.kind === 'powers-of-ten-pattern' ? decimalPattern.model.focus : '',
    ).toBe('decimal-placement')
    expect(decimalPattern.answer).toBe(independentlyComputedAnswer(decimalPattern))
  })

  it('keeps number-name distractors in number-name form at the upper whole-number edge', () => {
    setRng(sequenceRng([0.999999, 0, 0]))
    const item = generateDecimalNumberNameItem(3)
    expect(item.model.kind).toBe('decimal-number-name')
    if (item.model.kind !== 'decimal-number-name') return
    expect(item.model.numeral).toBe('999.001')
    expect(item.model.direction).toBe('numeral-to-name')
    item.choices.forEach((choice) =>
      expect(choice).toMatch(/ (tenths?|hundredths?|thousandths?)$/),
    )
  })

  it('uses thousandth-sized intervals on a difficulty-3 number line', () => {
    setRng(seededRng(0x1_000))
    const item = generateDecimalNumberLineItem(3)
    expect(item.model.kind).toBe('decimal-number-line')
    if (item.model.kind !== 'decimal-number-line') return
    const start = decimalToScaled(item.model.start, 3)
    const end = decimalToScaled(item.model.end, 3)
    expect((end - start) / item.model.intervals).toBe(1)
    expect(item.answer).toBe(independentlyComputedAnswer(item))
  })

  it('includes the thousandths column in a difficulty-3 place-value chart', () => {
    setRng(() => 0.25)
    const item = generatePlaceValueChartItem(3)
    expect(item.model.kind).toBe('place-value-chart')
    if (item.model.kind !== 'place-value-chart') return
    expect(item.model.columns.at(-1)).toBe('thousandths')
    expect(item.model.direction).toBe('chart-to-numeral')
    expect(item.answer).toMatch(/^\d+\.\d{3}$/)
    expect(item.answer).toBe(independentlyComputedAnswer(item))
  })
})
