import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE5_MATH_UNIT4_GENERATORS,
  GRADE5_MATH_UNIT4_ITEM_DEFINITIONS,
  GRADE5_MATH_UNIT4_ITEM_TYPES,
  generateGrade5MathUnit4Question,
  type Grade5MathUnit4ItemType,
  type Grade5MathUnit4Question,
} from './grade5MathUnit4Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function exactDivision(dividend: number, divisor: number): { quotient: bigint; remainder: bigint } {
  const exactDividend = BigInt(dividend)
  const exactDivisor = BigInt(divisor)
  return {
    quotient: exactDividend / exactDivisor,
    remainder: exactDividend % exactDivisor,
  }
}

function divisionResult(quotient: bigint, remainder: bigint): string {
  return remainder === 0n ? String(quotient) : `${quotient} R ${remainder}`
}

function relatedEquations(dividend: number, divisor: number, quotient: bigint): string {
  return `${dividend} ÷ ${divisor} = ${quotient}; ${divisor} × ${quotient} = ${dividend}`
}

function groupingMarks(grouping: 'parentheses' | 'brackets' | 'braces'): readonly [string, string] {
  if (grouping === 'parentheses') return ['(', ')']
  if (grouping === 'brackets') return ['[', ']']
  return ['{', '}']
}

function applyOperator(operator: '+' | '-' | '×', left: bigint, right: bigint): bigint {
  if (operator === '+') return left + right
  if (operator === '-') return left - right
  return left * right
}

function evaluationExpression(
  parameters: Extract<Grade5MathUnit4Question, { itemType: 'evaluate-numerical-expression' }>['parameters'],
): string {
  if (parameters.mode === 'nested') {
    return `{${parameters.a} + [${parameters.b} × (${parameters.c} - ${parameters.d})]}`
  }
  const [open, close] = groupingMarks(parameters.grouping as 'parentheses' | 'brackets' | 'braces')
  return `${parameters.a} ${parameters.outerOperator} ${open}${parameters.b} ${parameters.innerOperator} ${parameters.c}${close}`
}

function evaluationValue(
  parameters: Extract<Grade5MathUnit4Question, { itemType: 'evaluate-numerical-expression' }>['parameters'],
): bigint {
  if (parameters.mode === 'nested') {
    return BigInt(parameters.a) + BigInt(parameters.b) * (BigInt(parameters.c) - BigInt(parameters.d))
  }
  const inner = applyOperator(parameters.innerOperator, BigInt(parameters.b), BigInt(parameters.c))
  return applyOperator(parameters.outerOperator, BigInt(parameters.a), inner)
}

type LanguageParameters = Extract<Grade5MathUnit4Question, { itemType: 'write-numerical-expression' }>['parameters']

function languageExpression(parameters: LanguageParameters): string {
  const [open, close] = groupingMarks(parameters.grouping)
  if (parameters.template === 'add-then-multiply') {
    return `${open}${parameters.a} + ${parameters.b}${close} × ${parameters.c}`
  }
  if (parameters.template === 'multiply-then-subtract') {
    return `${open}${parameters.a} × ${parameters.b}${close} - ${parameters.c}`
  }
  return `${parameters.c} - ${open}${parameters.a} + ${parameters.b}${close}`
}

function languageDescription(parameters: LanguageParameters): string {
  if (parameters.template === 'add-then-multiply') {
    return `Add ${parameters.a} and ${parameters.b}, then multiply the sum by ${parameters.c}.`
  }
  if (parameters.template === 'multiply-then-subtract') {
    return `Multiply ${parameters.a} by ${parameters.b}, then subtract ${parameters.c} from the product.`
  }
  return `Add ${parameters.a} and ${parameters.b}, then subtract the sum from ${parameters.c}.`
}

function patternTerm(start: number, step: number, termNumber: number): bigint {
  return BigInt(start) + BigInt(termNumber - 1) * BigInt(step)
}

type TwoRuleParameters = Extract<Grade5MathUnit4Question, { itemType: 'extend-two-rule-patterns' }>['parameters']

function patternPair(parameters: TwoRuleParameters): string {
  return `(${patternTerm(parameters.startA, parameters.stepA, parameters.termNumber)}, ${patternTerm(parameters.startB, parameters.stepB, parameters.termNumber)})`
}

function sequence(start: number, step: number, count: number): string {
  return Array.from({ length: count }, (_, index) => String(patternTerm(start, step, index + 1))).join(', ')
}

function oracleAnswer(question: Grade5MathUnit4Question): string {
  switch (question.itemType) {
    case 'division-model-equation': {
      const exact = exactDivision(question.parameters.dividend, question.parameters.divisor)
      return relatedEquations(question.parameters.dividend, question.parameters.divisor, exact.quotient)
    }
    case 'division-area-model':
    case 'whole-number-quotient': {
      const exact = exactDivision(question.parameters.dividend, question.parameters.divisor)
      return String(exact.quotient)
    }
    case 'partial-quotients':
    case 'division-with-remainder': {
      const exact = exactDivision(question.parameters.dividend, question.parameters.divisor)
      return divisionResult(exact.quotient, exact.remainder)
    }
    case 'interpret-remainder': {
      const exact = exactDivision(question.parameters.dividend, question.parameters.divisor)
      if (question.parameters.action === 'full-groups') return String(exact.quotient)
      if (question.parameters.action === 'round-up') return String(exact.quotient + 1n)
      return String(exact.remainder)
    }
    case 'evaluate-numerical-expression':
      return String(evaluationValue(question.parameters))
    case 'write-numerical-expression':
      return languageExpression(question.parameters)
    case 'interpret-numerical-expression':
      return languageDescription(question.parameters)
    case 'extend-two-rule-patterns':
    case 'pattern-ordered-pair':
      return patternPair(question.parameters)
    case 'identify-pattern-relationship':
      return question.parameters.direction === 'b-from-a'
        ? `Each term in Pattern B is ${question.parameters.multiplier} times the corresponding term in Pattern A.`
        : `Each term in Pattern A is 1/${question.parameters.multiplier} of the corresponding term in Pattern B.`
  }
}

function contextPrompt(
  parameters: Extract<Grade5MathUnit4Question, { itemType: 'interpret-remainder' }>['parameters'],
): string {
  if (parameters.action === 'full-groups') {
    return `A teacher has ${parameters.dividend} notebooks and packs ${parameters.divisor} in each complete set. How many complete sets can be packed?`
  }
  if (parameters.action === 'round-up') {
    return `${parameters.dividend} books are packed in boxes holding ${parameters.divisor} books each. How many boxes are needed to pack every book?`
  }
  return `${parameters.dividend} tiles are arranged in complete rows of ${parameters.divisor}. How many tiles are left after making all possible complete rows?`
}

function assertExactDivisionParameters(
  parameters: Extract<
    Grade5MathUnit4Question,
    {
      itemType:
        | 'division-model-equation'
        | 'division-area-model'
        | 'partial-quotients'
        | 'whole-number-quotient'
        | 'division-with-remainder'
        | 'interpret-remainder'
    }
  >['parameters'],
): void {
  const dividend = BigInt(parameters.dividend)
  const divisor = BigInt(parameters.divisor)
  const quotient = BigInt(parameters.quotient)
  const remainder = BigInt(parameters.remainder)
  expect(dividend).toBe(divisor * quotient + remainder)
  expect(remainder).toBeGreaterThanOrEqual(0n)
  expect(remainder).toBeLessThan(divisor)
  expect(parameters.dividend).toBeLessThanOrEqual(9_999)
}

function assertPromptRepresentsParameters(question: Grade5MathUnit4Question): void {
  switch (question.itemType) {
    case 'division-model-equation': {
      const parameters = question.parameters
      assertExactDivisionParameters(parameters)
      expect(question.prompt).toBe(
        parameters.model === 'equal-groups'
          ? `${parameters.dividend} counters are split into ${parameters.divisor} equal groups. Which pair of equations represents the model?`
          : `A missing-factor model shows ${parameters.divisor} × ? = ${parameters.dividend}. Which pair of equations represents the model?`,
      )
      return
    }
    case 'division-area-model': {
      const parameters = question.parameters
      assertExactDivisionParameters(parameters)
      expect(parameters.dividend).toBe(parameters.knownSide * parameters.missingSide)
      expect(parameters.divisor).toBe(parameters.knownSide)
      expect(question.prompt).toBe(
        `A rectangle has area ${parameters.dividend} square units and one side length is ${parameters.knownSide} units. What is the missing side length?`,
      )
      expect(question.visual).toBeUndefined()
      return
    }
    case 'partial-quotients': {
      const parameters = question.parameters
      assertExactDivisionParameters(parameters)
      expect(parameters.firstPartialQuotient + parameters.secondPartialQuotient).toBe(parameters.quotient)
      const afterFirst = parameters.dividend - parameters.divisor * parameters.firstPartialQuotient
      expect(question.prompt).toBe(
        `Use these partial-quotients steps to solve ${parameters.dividend} ÷ ${parameters.divisor}:\n${parameters.dividend} - ${parameters.divisor} × ${parameters.firstPartialQuotient} = ${afterFirst}\n${afterFirst} - ${parameters.divisor} × ${parameters.secondPartialQuotient} = ${parameters.remainder}\nWhat is the quotient${parameters.remainder === 0 ? '?' : ' and remainder?'}`,
      )
      return
    }
    case 'whole-number-quotient':
      assertExactDivisionParameters(question.parameters)
      expect(question.parameters.remainder).toBe(0)
      expect(question.prompt).toBe(`Find ${question.parameters.dividend} ÷ ${question.parameters.divisor}.`)
      return
    case 'division-with-remainder':
      assertExactDivisionParameters(question.parameters)
      expect(question.parameters.remainder).toBeGreaterThan(0)
      expect(question.prompt).toBe(
        `Find ${question.parameters.dividend} ÷ ${question.parameters.divisor}. Write the quotient and remainder.`,
      )
      return
    case 'interpret-remainder':
      assertExactDivisionParameters(question.parameters)
      expect(question.parameters.remainder).toBeGreaterThan(0)
      expect(question.prompt).toBe(contextPrompt(question.parameters))
      expect(question.parameters.context).toBe(
        question.parameters.action === 'full-groups'
          ? 'notebooks'
          : question.parameters.action === 'round-up'
            ? 'boxes'
            : 'tiles',
      )
      return
    case 'evaluate-numerical-expression':
      expect(question.prompt).toBe(`Evaluate ${evaluationExpression(question.parameters)}.`)
      return
    case 'write-numerical-expression':
      expect(question.prompt).toBe(
        `Which numerical expression records this calculation? ${languageDescription(question.parameters)}`,
      )
      return
    case 'interpret-numerical-expression':
      expect(question.prompt).toBe(`Which description matches ${languageExpression(question.parameters)}?`)
      return
    case 'extend-two-rule-patterns':
      expect(question.prompt).toBe(
        `Pattern A starts at ${question.parameters.startA} and adds ${question.parameters.stepA}. Pattern B starts at ${question.parameters.startB} and adds ${question.parameters.stepB}. What are the corresponding terms at term ${question.parameters.termNumber}?`,
      )
      return
    case 'identify-pattern-relationship': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `Pattern A: ${sequence(parameters.startA, parameters.stepA, parameters.termCount)}\nPattern B: ${sequence(parameters.startA * parameters.multiplier, parameters.stepA * parameters.multiplier, parameters.termCount)}\nWhich statement describes the relationship between corresponding terms?`,
      )
      return
    }
    case 'pattern-ordered-pair':
      expect(question.prompt).toBe(
        `Pattern A starts at ${question.parameters.startA} and adds ${question.parameters.stepA}. Pattern B starts at ${question.parameters.startB} and adds ${question.parameters.stepB}. Using Pattern A as x and Pattern B as y, which point represents term ${question.parameters.termNumber}?`,
      )
  }
}

function assertChoicesStayInDomain(question: Grade5MathUnit4Question): void {
  switch (question.itemType) {
    case 'division-model-equation':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^\d+ ÷ \d+ = \d+; \d+ × \d+ = \d+$/)
      }
      return
    case 'partial-quotients':
    case 'division-with-remainder':
      for (const choice of question.choices) expect(choice).toMatch(/^\d+(?: R \d+)?$/)
      return
    case 'write-numerical-expression':
      for (const choice of question.choices) {
        expect(choice).toMatch(/\d/)
        expect(choice).not.toMatch(/[A-Za-z?]/)
      }
      return
    case 'interpret-numerical-expression':
    case 'identify-pattern-relationship':
      for (const choice of question.choices) expect(choice).toMatch(/\.$/)
      return
    case 'extend-two-rule-patterns':
    case 'pattern-ordered-pair':
      for (const choice of question.choices) expect(choice).toMatch(/^\(\d+, \d+\)$/)
      return
    default:
      for (const choice of question.choices) expect(choice).toMatch(/^\d+$/)
  }
}

function expectWellFormed(question: Grade5MathUnit4Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(question.choices[question.answerIndex]).not.toMatch(/\?\d+$/)
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  expect(question.parameters).not.toHaveProperty('correctAnswer')
  assertChoicesStayInDomain(question)
}

describe('Grade 5 Math Unit 4 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE5_MATH_UNIT4_ITEM_DEFINITIONS)).toEqual([...GRADE5_MATH_UNIT4_ITEM_TYPES])
    expect(Object.keys(GRADE5_MATH_UNIT4_GENERATORS)).toEqual([...GRADE5_MATH_UNIT4_ITEM_TYPES])
    expect(new Set(GRADE5_MATH_UNIT4_ITEM_TYPES).size).toBe(12)
  })

  it('covers every standard and all six lesson focuses derived from the source records', () => {
    const definitions = Object.values(GRADE5_MATH_UNIT4_ITEM_DEFINITIONS)
    expect(new Set(definitions.map((definition) => definition.standard))).toEqual(
      new Set(['5.NBT.6', '5.OA.1', '5.OA.2', '5.OA.3']),
    )
    expect(new Set(definitions.map((definition) => definition.lessonFocus))).toEqual(
      new Set([
        'division models',
        'partial quotients',
        'standard division strategies',
        'remainders in context',
        'parentheses and brackets',
        'two-rule numerical patterns',
      ]),
    )
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x5_04_c0de))
    for (const itemType of GRADE5_MATH_UNIT4_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade5MathUnit4Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(GRADE5_MATH_UNIT4_ITEM_DEFINITIONS[itemType].standard)
        expect(question.lessonFocus).toBe(GRADE5_MATH_UNIT4_ITEM_DEFINITIONS[itemType].lessonFocus)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const exampleObjects = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE5_MATH_UNIT4_ITEM_TYPES) {
      const example = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      exampleObjects.add(example)
    }
    expect(exampleObjects.size).toBe(GRADE5_MATH_UNIT4_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike = (typeof GRADE5_MATH_UNIT4_ITEM_DEFINITIONS)[Grade5MathUnit4ItemType]['workedExample']

describe('Grade 5 Math Unit 4 independent property oracles', () => {
  for (const [typeIndex, itemType] of GRADE5_MATH_UNIT4_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have the independently recomputed answer`, () => {
      setRng(seededRng(0x400_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade5MathUnit4Question(itemType, difficulty)
          assertPromptRepresentsParameters(question)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          expectWellFormed(question)
        }
      }
    })
  }
})

describe('Grade 5 Math Unit 4 required edge cases', () => {
  it('keeps division exact and reaches four-digit dividends with two-digit divisors', () => {
    setRng(seededRng(0xd1_4_0001))
    let sawFourDigitDividend = false
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit4Question('division-with-remainder', 3)
      assertExactDivisionParameters(question.parameters)
      expect(question.parameters.divisor).toBeGreaterThanOrEqual(10)
      if (question.parameters.dividend >= 1_000) sawFourDigitDividend = true
    }
    expect(sawFourDigitDividend).toBe(true)
  })

  it('independently validates every partial-quotients decomposition', () => {
    setRng(seededRng(0xfa47_0001))
    for (const difficulty of [1, 2, 3] as const) {
      for (let run = 0; run < 300; run++) {
        const question = generateGrade5MathUnit4Question('partial-quotients', difficulty)
        const parameters = question.parameters
        expect(parameters.firstPartialQuotient).toBeGreaterThan(0)
        expect(parameters.secondPartialQuotient).toBeGreaterThan(0)
        expect(parameters.firstPartialQuotient + parameters.secondPartialQuotient).toBe(parameters.quotient)
        assertExactDivisionParameters(parameters)
      }
    }
  })

  it('reaches and independently verifies all three meanings of a remainder', () => {
    setRng(seededRng(0xc07e_0001))
    const actions = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade5MathUnit4Question('interpret-remainder', 3)
      actions.add(question.parameters.action)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(actions).toEqual(new Set(['full-groups', 'round-up', 'leftovers']))
  })

  it('uses parentheses, brackets, braces, and nested grouping', () => {
    setRng(seededRng(0x6a0_00001))
    const groupings = new Set<string>()
    for (const difficulty of [1, 2, 3] as const) {
      for (let run = 0; run < 600; run++) {
        const question = generateGrade5MathUnit4Question('evaluate-numerical-expression', difficulty)
        groupings.add(question.parameters.grouping)
        expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
      }
    }
    expect(groupings).toEqual(new Set(['parentheses', 'brackets', 'braces', 'nested']))
  })

  it('reaches both multiplicative pattern relationships in both directions', () => {
    setRng(seededRng(0x5a73_0001))
    const multipliers = new Set<number>()
    const directions = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade5MathUnit4Question('identify-pattern-relationship', 3)
      multipliers.add(question.parameters.multiplier)
      directions.add(question.parameters.direction)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(multipliers).toEqual(new Set([2, 3]))
    expect(directions).toEqual(new Set(['b-from-a', 'a-from-b']))
  })
})
