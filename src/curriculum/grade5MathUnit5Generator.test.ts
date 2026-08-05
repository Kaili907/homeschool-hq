import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE5_MATH_UNIT5_GENERATORS,
  GRADE5_MATH_UNIT5_ITEM_DEFINITIONS,
  GRADE5_MATH_UNIT5_ITEM_TYPES,
  generateGrade5MathUnit5Question,
  type Grade5MathUnit5ItemType,
  type Grade5MathUnit5Question,
} from './grade5MathUnit5Generator'

const RUNS_PER_DIFFICULTY = 200

interface FractionLike {
  numerator: number
  denominator: number
}

interface BigFraction {
  numerator: bigint
  denominator: bigint
}

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function bigFraction(fraction: FractionLike): BigFraction {
  return {
    numerator: BigInt(fraction.numerator),
    denominator: BigInt(fraction.denominator),
  }
}

function bigGcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b !== 0n) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function bigLcm(left: bigint, right: bigint): bigint {
  return (left / bigGcd(left, right)) * right
}

function bigReduce(fraction: BigFraction): BigFraction {
  const divisor = bigGcd(fraction.numerator, fraction.denominator)
  return {
    numerator: fraction.numerator / divisor,
    denominator: fraction.denominator / divisor,
  }
}

function bigAdd(left: BigFraction, right: BigFraction): BigFraction {
  return bigReduce({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  })
}

function bigSubtract(left: BigFraction, right: BigFraction): BigFraction {
  return bigReduce({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  })
}

function bigCompare(left: BigFraction, right: BigFraction): -1 | 0 | 1 {
  const leftProduct = left.numerator * right.denominator
  const rightProduct = right.numerator * left.denominator
  return leftProduct < rightProduct ? -1 : leftProduct > rightProduct ? 1 : 0
}

function fractionText(fraction: FractionLike): string {
  return `${fraction.numerator}/${fraction.denominator}`
}

function benchmarkText(fraction: FractionLike): string {
  return fraction.denominator === 1 ? String(fraction.numerator) : fractionText(fraction)
}

function bigMixedText(fraction: BigFraction): string {
  const reduced = bigReduce(fraction)
  const whole = reduced.numerator / reduced.denominator
  const remainder = reduced.numerator % reduced.denominator
  if (remainder === 0n) return String(whole)
  if (whole === 0n) return `${remainder}/${reduced.denominator}`
  return `${whole} ${remainder}/${reduced.denominator}`
}

function mixedParameterFraction(mixed: { whole: number; numerator: number; denominator: number }): BigFraction {
  return {
    numerator: BigInt(mixed.whole) * BigInt(mixed.denominator) + BigInt(mixed.numerator),
    denominator: BigInt(mixed.denominator),
  }
}

function nearestBenchmarkHalfUnits(fraction: BigFraction): bigint {
  const fourNumerators = 4n * fraction.numerator
  if (fourNumerators < fraction.denominator) return 0n
  if (fourNumerators < 3n * fraction.denominator) return 1n
  return 2n
}

function estimateText(halfUnits: bigint): string {
  if (halfUnits === 0n) return 'about 0'
  const whole = halfUnits / 2n
  const hasHalf = halfUnits % 2n === 1n
  if (whole === 0n) return 'about 1/2'
  return hasHalf ? `about ${whole} 1/2` : `about ${whole}`
}

function oracleAnswer(question: Grade5MathUnit5Question): string {
  switch (question.itemType) {
    case 'equivalent-fraction':
      return String(
        question.parameters.missing === 'numerator'
          ? question.parameters.equivalent.numerator
          : question.parameters.equivalent.denominator,
      )
    case 'simplify-fraction':
      return bigMixedText(bigFraction(question.parameters.fraction))
    case 'compare-to-benchmark': {
      const comparison = bigCompare(
        bigFraction(question.parameters.fraction),
        bigFraction(question.parameters.benchmark),
      )
      return comparison < 0 ? '<' : comparison > 0 ? '>' : '='
    }
    case 'estimate-fraction-operation': {
      const left = nearestBenchmarkHalfUnits(bigFraction(question.parameters.left))
      const right = nearestBenchmarkHalfUnits(bigFraction(question.parameters.right))
      return estimateText(question.parameters.operation === 'add' ? left + right : left - right)
    }
    case 'least-common-denominator':
      return String(
        bigLcm(
          BigInt(question.parameters.leftDenominator),
          BigInt(question.parameters.rightDenominator),
        ),
      )
    case 'rewrite-with-common-denominator': {
      const common = BigInt(question.parameters.commonDenominator)
      const left = bigFraction(question.parameters.left)
      const right = bigFraction(question.parameters.right)
      return `${left.numerator * (common / left.denominator)}/${common} and ${right.numerator * (common / right.denominator)}/${common}`
    }
    case 'add-unlike-fractions':
    case 'addition-word-problem':
      return bigMixedText(
        bigAdd(bigFraction(question.parameters.left), bigFraction(question.parameters.right)),
      )
    case 'subtract-unlike-fractions':
      return bigMixedText(
        bigSubtract(bigFraction(question.parameters.left), bigFraction(question.parameters.right)),
      )
    case 'add-mixed-numbers':
      return bigMixedText(
        bigAdd(
          mixedParameterFraction(question.parameters.left),
          mixedParameterFraction(question.parameters.right),
        ),
      )
    case 'subtract-mixed-numbers':
      return bigMixedText(
        bigSubtract(
          mixedParameterFraction(question.parameters.left),
          mixedParameterFraction(question.parameters.right),
        ),
      )
    case 'subtraction-word-problem':
      return bigMixedText(
        bigSubtract(bigFraction(question.parameters.starting), bigFraction(question.parameters.used)),
      )
  }
}

function mixedParameterText(mixed: { whole: number; numerator: number; denominator: number }): string {
  return `${mixed.whole} ${mixed.numerator}/${mixed.denominator}`
}

function wordAmountText(fraction: FractionLike): string {
  return bigMixedText(bigFraction(fraction))
}

function additionWordPrompt(
  parameters: Extract<Grade5MathUnit5Question, { itemType: 'addition-word-problem' }>['parameters'],
): string {
  const left = wordAmountText(parameters.left)
  const right = wordAmountText(parameters.right)
  if (parameters.context === 'recipe') {
    return `A recipe uses ${left} cups of oats and ${right} cups of fruit. How many cups are used altogether?`
  }
  if (parameters.context === 'trail') {
    return `Maya walks ${left} miles in the morning and ${right} miles in the afternoon. How many miles does she walk altogether?`
  }
  return `One ribbon piece is ${left} meters long and another is ${right} meters long. What is their total length in meters?`
}

function subtractionWordPrompt(
  parameters: Extract<Grade5MathUnit5Question, { itemType: 'subtraction-word-problem' }>['parameters'],
): string {
  const starting = wordAmountText(parameters.starting)
  const used = wordAmountText(parameters.used)
  if (parameters.context === 'ribbon') {
    return `A ribbon is ${starting} meters long. If ${used} meters are used, how many meters remain?`
  }
  if (parameters.context === 'water') {
    return `A container holds ${starting} liters of water. After ${used} liters are used, how many liters remain?`
  }
  return `A trail is ${starting} miles long. After walking ${used} miles, how many miles remain?`
}

function assertPromptRepresentsParameters(question: Grade5MathUnit5Question): void {
  switch (question.itemType) {
    case 'equivalent-fraction':
      expect(question.prompt).toBe(
        question.parameters.missing === 'numerator'
          ? `Complete the equivalent fraction: ${fractionText(question.parameters.original)} = ?/${question.parameters.equivalent.denominator}.`
          : `Complete the equivalent fraction: ${fractionText(question.parameters.original)} = ${question.parameters.equivalent.numerator}/?.`,
      )
      return
    case 'simplify-fraction':
      expect(question.prompt).toBe(`Write ${fractionText(question.parameters.fraction)} in simplest form.`)
      return
    case 'compare-to-benchmark':
      expect(question.prompt).toBe(
        `Compare ${fractionText(question.parameters.fraction)} with the benchmark ${benchmarkText(question.parameters.benchmark)} using <, >, or =.`,
      )
      return
    case 'estimate-fraction-operation':
      expect(question.prompt).toBe(
        `Use 0, 1/2, or 1 for each fraction to estimate ${fractionText(question.parameters.left)} ${question.parameters.operation === 'add' ? '+' : '-'} ${fractionText(question.parameters.right)}.`,
      )
      return
    case 'least-common-denominator':
      expect(question.prompt).toBe(
        `What is the least common denominator of fractions with denominators ${question.parameters.leftDenominator} and ${question.parameters.rightDenominator}?`,
      )
      return
    case 'rewrite-with-common-denominator':
      expect(question.prompt).toBe(
        `Rewrite ${fractionText(question.parameters.left)} and ${fractionText(question.parameters.right)} as equivalent fractions with the least common denominator.`,
      )
      return
    case 'add-unlike-fractions':
      expect(question.prompt).toBe(
        `${fractionText(question.parameters.left)} + ${fractionText(question.parameters.right)} = ? Write the answer in simplest form.`,
      )
      return
    case 'subtract-unlike-fractions':
      expect(question.prompt).toBe(
        `${fractionText(question.parameters.left)} - ${fractionText(question.parameters.right)} = ? Write the answer in simplest form.`,
      )
      return
    case 'add-mixed-numbers':
      expect(question.prompt).toBe(
        `${mixedParameterText(question.parameters.left)} + ${mixedParameterText(question.parameters.right)} = ? Write the answer in simplest form.`,
      )
      return
    case 'subtract-mixed-numbers':
      expect(question.prompt).toBe(
        `${mixedParameterText(question.parameters.left)} - ${mixedParameterText(question.parameters.right)} = ? Write the answer in simplest form.`,
      )
      return
    case 'addition-word-problem':
      expect(question.prompt).toBe(additionWordPrompt(question.parameters))
      return
    case 'subtraction-word-problem':
      expect(question.prompt).toBe(subtractionWordPrompt(question.parameters))
  }
}

function parseRational(text: string): BigFraction | undefined {
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(text)
  if (mixed) {
    const whole = BigInt(mixed[1])
    const numerator = BigInt(mixed[2])
    const denominator = BigInt(mixed[3])
    return { numerator: whole * denominator + numerator, denominator }
  }
  const fraction = /^(\d+)\/(\d+)$/.exec(text)
  if (fraction) return { numerator: BigInt(fraction[1]), denominator: BigInt(fraction[2]) }
  if (/^\d+$/.test(text)) return { numerator: BigInt(text), denominator: 1n }
  return undefined
}

const RATIONAL_CHOICE_TYPES = new Set<Grade5MathUnit5ItemType>([
  'simplify-fraction',
  'add-unlike-fractions',
  'subtract-unlike-fractions',
  'add-mixed-numbers',
  'subtract-mixed-numbers',
  'addition-word-problem',
  'subtraction-word-problem',
])

function assertChoicesStayInDomain(question: Grade5MathUnit5Question): void {
  if (question.itemType === 'compare-to-benchmark') {
    for (const choice of question.choices) expect(['<', '>', '=']).toContain(choice)
    return
  }
  if (question.itemType === 'estimate-fraction-operation') {
    for (const choice of question.choices) expect(choice).toMatch(/^about (?:\d+|\d+\/\d+|\d+ \d+\/\d+)$/)
    return
  }
  if (question.itemType === 'rewrite-with-common-denominator') {
    for (const choice of question.choices) expect(choice).toMatch(/^\d+\/\d+ and \d+\/\d+$/)
    return
  }
  if (question.itemType === 'equivalent-fraction' || question.itemType === 'least-common-denominator') {
    for (const choice of question.choices) expect(choice).toMatch(/^\d+$/)
    return
  }
  for (const choice of question.choices) expect(choice).toMatch(/^\d+(?:\/\d+| \d+\/\d+)?$/)
}

function expectWellFormed(question: Grade5MathUnit5Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(question.choices[question.answerIndex]).not.toMatch(/\?\d+$/)
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  assertChoicesStayInDomain(question)

  if (RATIONAL_CHOICE_TYPES.has(question.itemType)) {
    const correct = parseRational(oracleAnswer(question))
    expect(correct).toBeDefined()
    for (const [index, choice] of question.choices.entries()) {
      const parsed = parseRational(choice)
      expect(parsed).toBeDefined()
      expect(parsed?.denominator).toBeGreaterThan(0n)
      expect(parsed?.numerator).toBeGreaterThanOrEqual(0n)
      if (index !== question.answerIndex && parsed && correct) {
        expect(bigCompare(parsed, correct)).not.toBe(0)
      }
    }
  }
}

function assertExactRationalInvariants(question: Grade5MathUnit5Question): void {
  switch (question.itemType) {
    case 'equivalent-fraction': {
      const original = bigFraction(question.parameters.original)
      const equivalent = bigFraction(question.parameters.equivalent)
      expect(original.numerator * equivalent.denominator).toBe(
        equivalent.numerator * original.denominator,
      )
      expect(question.parameters.equivalent.numerator % question.parameters.original.numerator).toBe(0)
      expect(question.parameters.equivalent.denominator % question.parameters.original.denominator).toBe(0)
      return
    }
    case 'simplify-fraction': {
      const original = bigFraction(question.parameters.fraction)
      const answer = parseRational(curriculumAnswer(question))
      expect(answer).toBeDefined()
      expect(answer && bigCompare(original, answer)).toBe(0)
      expect(answer && bigGcd(answer.numerator, answer.denominator)).toBe(1n)
      expect(bigGcd(original.numerator, original.denominator)).toBeGreaterThan(1n)
      return
    }
    case 'least-common-denominator': {
      const left = BigInt(question.parameters.leftDenominator)
      const right = BigInt(question.parameters.rightDenominator)
      const answer = BigInt(curriculumAnswer(question))
      expect(answer % left).toBe(0n)
      expect(answer % right).toBe(0n)
      for (let candidate = 1n; candidate < answer; candidate++) {
        expect(candidate % left === 0n && candidate % right === 0n).toBe(false)
      }
      return
    }
    case 'rewrite-with-common-denominator': {
      const match = /^(\d+)\/(\d+) and (\d+)\/(\d+)$/.exec(curriculumAnswer(question))
      expect(match).not.toBeNull()
      if (!match) return
      const rewrittenLeft = { numerator: BigInt(match[1]), denominator: BigInt(match[2]) }
      const rewrittenRight = { numerator: BigInt(match[3]), denominator: BigInt(match[4]) }
      const expectedDenominator = bigLcm(
        BigInt(question.parameters.left.denominator),
        BigInt(question.parameters.right.denominator),
      )
      expect(rewrittenLeft.denominator).toBe(expectedDenominator)
      expect(rewrittenRight.denominator).toBe(expectedDenominator)
      expect(bigCompare(rewrittenLeft, bigFraction(question.parameters.left))).toBe(0)
      expect(bigCompare(rewrittenRight, bigFraction(question.parameters.right))).toBe(0)
      return
    }
    default:
      return
  }
}

describe('Grade 5 Math Unit 5 source-derived coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE5_MATH_UNIT5_ITEM_DEFINITIONS)).toEqual([...GRADE5_MATH_UNIT5_ITEM_TYPES])
    expect(Object.keys(GRADE5_MATH_UNIT5_GENERATORS)).toEqual([...GRADE5_MATH_UNIT5_ITEM_TYPES])
    expect(new Set(GRADE5_MATH_UNIT5_ITEM_TYPES).size).toBe(12)
  })

  it('covers the standards and every focus repeated across course days 73-90', () => {
    expect(new Set(Object.values(GRADE5_MATH_UNIT5_ITEM_DEFINITIONS).map(({ standard }) => standard))).toEqual(
      new Set(['5.NF.1', '5.NF.2']),
    )
    expect(new Set(Object.values(GRADE5_MATH_UNIT5_ITEM_DEFINITIONS).map(({ lessonFocus }) => lessonFocus))).toEqual(
      new Set([
        'fraction equivalence',
        'benchmark fractions',
        'common denominators',
        'adding unlike fractions',
        'subtracting unlike fractions',
        'mixed-number problem solving',
      ]),
    )
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x5_05_c0de))
    for (const itemType of GRADE5_MATH_UNIT5_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade5MathUnit5Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(GRADE5_MATH_UNIT5_ITEM_DEFINITIONS[itemType].standard)
        expect(question.lessonFocus).toBe(GRADE5_MATH_UNIT5_ITEM_DEFINITIONS[itemType].lessonFocus)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const exampleObjects = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE5_MATH_UNIT5_ITEM_TYPES) {
      const example = GRADE5_MATH_UNIT5_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      exampleObjects.add(example)
    }
    expect(exampleObjects.size).toBe(GRADE5_MATH_UNIT5_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike = (typeof GRADE5_MATH_UNIT5_ITEM_DEFINITIONS)[Grade5MathUnit5ItemType]['workedExample']

describe('Grade 5 Math Unit 5 independent exact-rational property oracles', () => {
  for (const [typeIndex, itemType] of GRADE5_MATH_UNIT5_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have the independently recomputed answer`, () => {
      setRng(seededRng(0x500_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade5MathUnit5Question(itemType, difficulty)
          assertPromptRepresentsParameters(question)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          assertExactRationalInvariants(question)
          expectWellFormed(question)
        }
      }
    })
  }
})

describe('Grade 5 Math Unit 5 required fraction edge cases', () => {
  it('reaches both missing parts while preserving exact fraction equivalence', () => {
    setRng(seededRng(0xe0_500_001))
    const missingParts = new Set<string>()
    for (let run = 0; run < 300; run++) {
      const question = generateGrade5MathUnit5Question('equivalent-fraction', 3)
      missingParts.add(question.parameters.missing)
      assertExactRationalInvariants(question)
    }
    expect(missingParts).toEqual(new Set(['numerator', 'denominator']))
  })

  it('reaches less-than, equal-to, and greater-than benchmark comparisons', () => {
    setRng(seededRng(0xb0_500_002))
    const comparisons = new Set<string>()
    for (let run = 0; run < 500; run++) {
      comparisons.add(curriculumAnswer(generateGrade5MathUnit5Question('compare-to-benchmark', 3)))
    }
    expect(comparisons).toEqual(new Set(['<', '=', '>']))
  })

  it('estimates both operations without quarter-point benchmark ties', () => {
    setRng(seededRng(0xe5_500_003))
    const operations = new Set<string>()
    for (let run = 0; run < 500; run++) {
      const question = generateGrade5MathUnit5Question('estimate-fraction-operation', 3)
      operations.add(question.parameters.operation)
      for (const fraction of [question.parameters.left, question.parameters.right]) {
        expect(4 * fraction.numerator).not.toBe(fraction.denominator)
        expect(4 * fraction.numerator).not.toBe(3 * fraction.denominator)
      }
    }
    expect(operations).toEqual(new Set(['add', 'subtract']))
  })

  it('uses non-coprime high-difficulty denominator pairs and proves the least result', () => {
    setRng(seededRng(0x1c_500_004))
    for (let run = 0; run < 200; run++) {
      const question = generateGrade5MathUnit5Question('least-common-denominator', 3)
      expect(bigGcd(
        BigInt(question.parameters.leftDenominator),
        BigInt(question.parameters.rightDenominator),
      )).toBeGreaterThan(1n)
      assertExactRationalInvariants(question)
    }
  })

  it('always uses unlike input denominators for the four direct operation generators', () => {
    setRng(seededRng(0xad_500_005))
    for (const itemType of [
      'add-unlike-fractions',
      'subtract-unlike-fractions',
      'add-mixed-numbers',
      'subtract-mixed-numbers',
    ] as const) {
      for (let run = 0; run < 300; run++) {
        const question = generateGrade5MathUnit5Question(itemType, 3)
        expect(question.parameters.left.denominator).not.toBe(question.parameters.right.denominator)
      }
    }
  })

  it('requires regrouping in high-difficulty mixed-number subtraction', () => {
    setRng(seededRng(0x5b_500_006))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade5MathUnit5Question('subtract-mixed-numbers', 3)
      expect(
        bigCompare(bigFraction(question.parameters.left), bigFraction(question.parameters.right)),
      ).toBe(-1)
      expect(question.parameters.left.whole).toBeGreaterThan(question.parameters.right.whole)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
  })

  it('keeps subtraction word problems positive and uses unlike displayed denominators', () => {
    setRng(seededRng(0x2f_500_007))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade5MathUnit5Question('subtraction-word-problem', 3)
      expect(question.parameters.starting.denominator).not.toBe(question.parameters.used.denominator)
      expect(
        bigCompare(bigFraction(question.parameters.starting), bigFraction(question.parameters.used)),
      ).toBe(1)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
  })
})
