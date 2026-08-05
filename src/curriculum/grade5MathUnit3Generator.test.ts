import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE5_MATH_UNIT3_GENERATORS,
  GRADE5_MATH_UNIT3_ITEM_DEFINITIONS,
  GRADE5_MATH_UNIT3_ITEM_TYPES,
  generateGrade5MathUnit3Question,
  type Grade5MathUnit3Question,
} from './grade5MathUnit3Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function matchPrompt(prompt: string, pattern: RegExp): RegExpMatchArray {
  const match = prompt.match(pattern)
  if (!match)
    throw new Error(`Independent oracle could not parse prompt: ${prompt}`)
  return match
}

const integer = (value: string): number => Number(value)

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0)

const placeValue = (name: string): number => {
  if (name === 'ten') return 10
  if (name === 'hundred') return 100
  if (name === 'thousand') return 1_000
  throw new Error(`Unexpected rounding place: ${name}`)
}

const rounded = (value: number, place: number): number =>
  Math.round(value / place) * place

type ExpressionNode =
  | { kind: 'number'; text: string }
  | {
      kind: 'binary'
      operator: '+' | '-' | '×'
      left: ExpressionNode
      right: ExpressionNode
    }

function parseExpression(source: string): ExpressionNode {
  const compact = source.replace(/\s+/g, '')
  const tokens = compact.match(/\d+|[+×()\[\]{}-]/g) ?? []
  if (tokens.join('') !== compact)
    throw new Error(`Unexpected expression token in: ${source}`)
  let index = 0

  const parseFactor = (): ExpressionNode => {
    const token = tokens[index]
    if (/^\d+$/.test(token ?? '')) {
      index++
      return { kind: 'number', text: token }
    }
    const closingByOpening: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
    }
    const closing = closingByOpening[token]
    if (!closing)
      throw new Error(
        `Expected a number or group at token ${String(token)} in ${source}`,
      )
    index++
    const node = parseAddition()
    if (tokens[index] !== closing)
      throw new Error(`Mismatched grouping in ${source}`)
    index++
    return node
  }

  const parseMultiplication = (): ExpressionNode => {
    let node = parseFactor()
    while (tokens[index] === '×') {
      index++
      node = {
        kind: 'binary',
        operator: '×',
        left: node,
        right: parseFactor(),
      }
    }
    return node
  }

  const parseAddition = (): ExpressionNode => {
    let node = parseMultiplication()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index] as '+' | '-'
      index++
      node = {
        kind: 'binary',
        operator,
        left: node,
        right: parseMultiplication(),
      }
    }
    return node
  }

  const result = parseAddition()
  if (index !== tokens.length)
    throw new Error(`Unconsumed expression tokens in ${source}`)
  return result
}

function evaluateExpression(node: ExpressionNode): number {
  if (node.kind === 'number') return integer(node.text)
  const left = evaluateExpression(node.left)
  const right = evaluateExpression(node.right)
  if (node.operator === '+') return left + right
  if (node.operator === '-') return left - right
  return left * right
}

/** Structural language only: this oracle deliberately never calculates an expression. */
function describeOperand(node: ExpressionNode): string {
  if (node.kind === 'number') return node.text
  if (node.operator === '+')
    return `the sum of ${describeOperand(node.left)} and ${describeOperand(node.right)}`
  if (node.operator === '-') {
    return `the difference between ${describeOperand(node.left)} and ${describeOperand(node.right)}`
  }
  return `the product of ${describeOperand(node.left)} and ${describeOperand(node.right)}`
}

/** Type 8's oracle checks operation structure, not a numeric result. */
function interpretExpression(node: ExpressionNode): string {
  if (node.kind === 'number') return `Use the number ${node.text}.`
  if (node.operator === '+')
    return `Add ${describeOperand(node.right)} to ${describeOperand(node.left)}.`
  if (node.operator === '-')
    return `Subtract ${describeOperand(node.right)} from ${describeOperand(node.left)}.`
  return `Multiply ${describeOperand(node.left)} by ${describeOperand(node.right)}.`
}

function expressionFromWrittenDirections(prompt: string): string {
  let match = prompt.match(
    /^Add (\d+) and (\d+)\. Then multiply the sum by (\d+)\. Which numerical expression represents the calculation\?$/,
  )
  if (match) return `(${match[1]} + ${match[2]}) × ${match[3]}`

  match = prompt.match(
    /^Subtract (\d+) from (\d+)\. Then multiply the difference by (\d+)\. Which numerical expression represents the calculation\?$/,
  )
  if (match) return `(${match[2]} - ${match[1]}) × ${match[3]}`

  match = prompt.match(
    /^Multiply (\d+) by (\d+)\. Then add (\d+) to the product\. Which numerical expression represents the calculation\?$/,
  )
  if (match) return `(${match[1]} × ${match[2]}) + ${match[3]}`

  match = prompt.match(
    /^Add (\d+) and (\d+)\. Add (\d+) and (\d+)\. Then multiply the two sums\. Which numerical expression represents the calculation\?$/,
  )
  if (match) return `(${match[1]} + ${match[2]}) × (${match[3]} + ${match[4]})`
  throw new Error(
    `Independent directions oracle could not parse prompt: ${prompt}`,
  )
}

/** Every branch derives its answer from prompt text rather than generator parameters. */
function oracleAnswer(question: Grade5MathUnit3Question): string {
  switch (question.itemType) {
    case 'multiplicative-comparison': {
      let match = question.prompt.match(
        /^Maya has (\d+) times as many cards as Leo\. Leo has (\d+) cards\. How many cards does Maya have\?$/,
      )
      if (match) return String(integer(match[1]) * integer(match[2]))
      match = question.prompt.match(
        /^Maya has (\d+) cards, which is (\d+) times as many as Leo\. How many cards does Leo have\?$/,
      )
      if (match) return String(integer(match[1]) / integer(match[2]))
      match = matchPrompt(
        question.prompt,
        /^Maya has (\d+) cards and Leo has (\d+) cards\. How many times as many cards does Maya have as Leo\?$/,
      )
      return `${integer(match[1]) / integer(match[2])} times`
    }
    case 'area-model-product': {
      const match = matchPrompt(
        question.prompt,
        /^An area model for (\d+) × (\d+) splits (\d+) into ([\d +]+) and (\d+) into ([\d +]+)\. What total product does the model represent\?$/,
      )
      const multiplicand = integer(match[1])
      const multiplier = integer(match[2])
      const firstParts = match[4].split(' + ').map(integer)
      const secondParts = match[6].split(' + ').map(integer)
      if (
        integer(match[3]) !== multiplicand ||
        sum(firstParts) !== multiplicand
      ) {
        throw new Error(
          `Area-model prompt has an invalid first decomposition: ${question.prompt}`,
        )
      }
      if (integer(match[5]) !== multiplier || sum(secondParts) !== multiplier) {
        throw new Error(
          `Area-model prompt has an invalid second decomposition: ${question.prompt}`,
        )
      }
      return String(
        firstParts
          .flatMap((left) => secondParts.map((right) => left * right))
          .reduce((total, value) => total + value, 0),
      )
    }
    case 'partial-products': {
      const match = matchPrompt(
        question.prompt,
        /^Use partial products to calculate (\d+) × (\d+)\. Decompose both factors by place value, multiply each pair of parts, and add the partial products\. What is the product\?$/,
      )
      const firstParts = decimalPlaceParts(integer(match[1]))
      const secondParts = decimalPlaceParts(integer(match[2]))
      return String(
        firstParts
          .flatMap((left) => secondParts.map((right) => left * right))
          .reduce((total, value) => total + value, 0),
      )
    }
    case 'standard-algorithm': {
      const match = matchPrompt(
        question.prompt,
        /^Use the standard multiplication algorithm to calculate (\d+) × (\d+)\.$/,
      )
      return String(integer(match[1]) * integer(match[2]))
    }
    case 'estimate-product': {
      let match = question.prompt.match(
        /^Estimate (\d+) × (\d+) by rounding (\d+) to the nearest (ten|hundred|thousand) and (\d+) to the nearest (ten|hundred|thousand)\.$/,
      )
      if (match) {
        if (match[1] !== match[3] || match[2] !== match[5])
          throw new Error(`Estimate prompt repeats factors incorrectly`)
        const estimate =
          rounded(integer(match[1]), placeValue(match[4])) *
          rounded(integer(match[2]), placeValue(match[6]))
        return String(estimate)
      }
      match = matchPrompt(
        question.prompt,
        /^A student says (\d+) × (\d+) = (\d+)\. Round (\d+) to the nearest (ten|hundred|thousand) and (\d+) to the nearest (ten|hundred|thousand)\. Is the claim reasonable\?$/,
      )
      if (match[1] !== match[4] || match[2] !== match[6])
        throw new Error(`Reasonableness prompt repeats factors incorrectly`)
      const claim = integer(match[3])
      const estimate =
        rounded(integer(match[1]), placeValue(match[5])) *
        rounded(integer(match[2]), placeValue(match[7]))
      const reasonable = claim >= estimate / 2 && claim <= estimate * 1.5
      return `${reasonable ? 'Yes' : 'No'}; the rounded estimate is ${estimate}.`
    }
    case 'write-grouped-expression':
      return expressionFromWrittenDirections(question.prompt)
    case 'evaluate-grouped-expression': {
      const match = matchPrompt(question.prompt, /^Evaluate: (.+)$/)
      return String(evaluateExpression(parseExpression(match[1])))
    }
    case 'interpret-expression': {
      const match = matchPrompt(
        question.prompt,
        /^Without evaluating it, which statement describes (.+)\?$/,
      )
      return interpretExpression(parseExpression(match[1]))
    }
    case 'multi-step-multiplication': {
      let match = question.prompt.match(
        /^An event has (\d+) display tables\. Each table holds (\d+) boxes with (\d+) items in each box\. There are also (\d+) loose items\. How many items are in inventory altogether\?$/,
      )
      if (match)
        return `${integer(match[1]) * integer(match[2]) * integer(match[3]) + integer(match[4])} items`
      match = matchPrompt(
        question.prompt,
        /^For (\d+) event days, a booth sells (\d+) tickets each day at \$(\d+) per ticket\. What projected revenue will the booth earn\?$/,
      )
      return `$${integer(match[1]) * integer(match[2]) * integer(match[3])}`
    }
  }
}

function decimalPlaceParts(value: number): number[] {
  const digits = String(value).split('').map(integer)
  return digits
    .map((digit, index) => digit * 10 ** (digits.length - index - 1))
    .filter((part) => part !== 0)
}

function assertParametersAreRepresented(
  question: Grade5MathUnit3Question,
): void {
  switch (question.itemType) {
    case 'multiplicative-comparison':
      expect(question.parameters.compared).toBe(
        question.parameters.reference * question.parameters.factor,
      )
      return
    case 'area-model-product':
      expect(sum(question.parameters.multiplicandParts)).toBe(
        question.parameters.multiplicand,
      )
      expect(sum(question.parameters.multiplierParts)).toBe(
        question.parameters.multiplier,
      )
      return
    case 'partial-products': {
      expect(sum(question.parameters.multiplicandParts)).toBe(
        question.parameters.multiplicand,
      )
      expect(sum(question.parameters.multiplierParts)).toBe(
        question.parameters.multiplier,
      )
      const independentParts = question.parameters.multiplicandParts.flatMap(
        (left) =>
          question.parameters.multiplierParts.map((right) => left * right),
      )
      expect(question.parameters.partialProducts).toEqual(independentParts)
      expect(sum(independentParts)).toBe(
        question.parameters.multiplicand * question.parameters.multiplier,
      )
      return
    }
    case 'standard-algorithm':
      expect(question.prompt).toContain(
        String(question.parameters.multiplicand),
      )
      expect(question.prompt).toContain(String(question.parameters.multiplier))
      return
    case 'estimate-product':
      expect(question.prompt).toContain(
        String(question.parameters.multiplicand),
      )
      expect(question.prompt).toContain(String(question.parameters.multiplier))
      return
    case 'write-grouped-expression':
      expect(
        question.parameters.values.every((value) =>
          question.prompt.includes(String(value)),
        ),
      ).toBe(true)
      expect(expressionFromWrittenDirections(question.prompt)).toBe(
        question.parameters.expression,
      )
      return
    case 'evaluate-grouped-expression':
      expect(
        evaluateExpression(parseExpression(question.parameters.expression)),
      ).toBe(question.parameters.value)
      expect(question.prompt).toBe(
        `Evaluate: ${question.parameters.expression}`,
      )
      return
    case 'interpret-expression': {
      expect(question.prompt).toContain(question.parameters.expression)
      const expression = matchPrompt(
        question.prompt,
        /^Without evaluating it, which statement describes (.+)\?$/,
      )[1]
      expect(interpretExpression(parseExpression(expression))).toBe(
        curriculumAnswer(question),
      )
      return
    }
    case 'multi-step-multiplication':
      if (question.parameters.context === 'inventory') {
        expect(question.prompt).toContain(
          `${question.parameters.tables} display tables`,
        )
      } else {
        expect(question.prompt).toContain(
          `For ${question.parameters.days} event days`,
        )
      }
  }
}

function assertChoicesStayInDomain(question: Grade5MathUnit3Question): void {
  switch (question.itemType) {
    case 'multiplicative-comparison':
      for (const choice of question.choices)
        expect(choice).toMatch(/^\d+(?: times)?$/)
      return
    case 'area-model-product':
    case 'partial-products':
    case 'standard-algorithm':
    case 'evaluate-grouped-expression':
      for (const choice of question.choices) expect(choice).toMatch(/^\d+$/)
      return
    case 'estimate-product':
      if (question.parameters.mode === 'estimate') {
        for (const choice of question.choices) expect(choice).toMatch(/^\d+$/)
      } else {
        for (const choice of question.choices) {
          expect(choice).toMatch(/^(?:Yes|No); the rounded estimate is \d+\.$/)
        }
      }
      return
    case 'write-grouped-expression':
      for (const choice of question.choices)
        expect(() => parseExpression(choice)).not.toThrow()
      return
    case 'interpret-expression':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^(?:Add|Subtract|Multiply) .+\.$/)
        expect(choice).not.toMatch(/^\$?\d+(?: items)?$/)
      }
      return
    case 'multi-step-multiplication':
      if (question.parameters.context === 'inventory') {
        for (const choice of question.choices)
          expect(choice).toMatch(/^\d+ items$/)
      } else {
        for (const choice of question.choices) expect(choice).toMatch(/^\$\d+$/)
      }
  }
}

function expectWellFormed(question: Grade5MathUnit3Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices).toHaveLength(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  assertChoicesStayInDomain(question)
  assertParametersAreRepresented(question)
}

describe('Grade 5 Math Unit 3 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE5_MATH_UNIT3_ITEM_DEFINITIONS)).toEqual([
      ...GRADE5_MATH_UNIT3_ITEM_TYPES,
    ])
    expect(Object.keys(GRADE5_MATH_UNIT3_GENERATORS)).toEqual([
      ...GRADE5_MATH_UNIT3_ITEM_TYPES,
    ])
    expect(new Set(GRADE5_MATH_UNIT3_ITEM_TYPES).size).toBe(9)
  })

  it('maps every item to one of the three Unit 3 standards at every difficulty', () => {
    setRng(seededRng(0x503_c0de))
    const standards = new Set(['5.NBT.5', '5.OA.1', '5.OA.2'])
    for (const itemType of GRADE5_MATH_UNIT3_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade5MathUnit3Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(standards.has(question.standard)).toBe(true)
        expect(question.standard).toBe(
          GRADE5_MATH_UNIT3_ITEM_DEFINITIONS[itemType].standard,
        )
      }
    }
  })

  it('has one complete, distinct authored worked example per item type', () => {
    const examples = new Set<object>()
    for (const itemType of GRADE5_MATH_UNIT3_ITEM_TYPES) {
      const example = GRADE5_MATH_UNIT3_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      examples.add(example)
    }
    expect(examples.size).toBe(GRADE5_MATH_UNIT3_ITEM_TYPES.length)
  })
})

describe('Grade 5 Math Unit 3 independent prompt-parsing property oracles', () => {
  for (const [typeIndex, itemType] of GRADE5_MATH_UNIT3_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty (600 total) have independently derived answers`, () => {
      setRng(seededRng(0x300_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          expectWellFormed(
            generateGrade5MathUnit3Question(itemType, difficulty),
          )
        }
      }
    })
  }
})

describe('Grade 5 Math Unit 3 distractor resilience', () => {
  it('keeps all choices unique, valid, and oracle-correct under constant RNG functions', () => {
    for (const constant of [0, 0.25, 0.5, 0.75, 0.999_999]) {
      for (const itemType of GRADE5_MATH_UNIT3_ITEM_TYPES) {
        for (const difficulty of [1, 2, 3] as const) {
          setRng(() => constant)
          expectWellFormed(
            generateGrade5MathUnit3Question(itemType, difficulty),
          )
        }
      }
    }
  })
})

describe('Grade 5 Math Unit 3 required breadth and semantic checks', () => {
  it('reaches all multiplicative-comparison unknown positions', () => {
    setRng(seededRng(0xc03_0001))
    const modes = new Set<string>()
    for (let run = 0; run < 1_000; run++) {
      modes.add(
        generateGrade5MathUnit3Question('multiplicative-comparison', 3)
          .parameters.mode,
      )
    }
    expect(modes).toEqual(
      new Set(['find-compared', 'find-reference', 'find-factor']),
    )
  })

  it('uses parentheses, brackets, and braces across grouped-expression difficulties', () => {
    setRng(seededRng(0xc03_0002))
    const level1 = generateGrade5MathUnit3Question(
      'evaluate-grouped-expression',
      1,
    )
    const level2 = generateGrade5MathUnit3Question(
      'evaluate-grouped-expression',
      2,
    )
    const level3 = generateGrade5MathUnit3Question(
      'evaluate-grouped-expression',
      3,
    )
    expect(level1.parameters.expression).toMatch(/[()]/)
    expect(level2.parameters.expression).toMatch(/[\[\]]/)
    expect(level3.parameters.expression).toMatch(/[{}]/)
    for (const question of [level1, level2, level3]) expectWellFormed(question)
  })

  it('reaches all four written-calculation templates', () => {
    setRng(seededRng(0xc03_0003))
    const templates = new Set<string>()
    for (let run = 0; run < 1_000; run++) {
      templates.add(
        generateGrade5MathUnit3Question('write-grouped-expression', 3)
          .parameters.template,
      )
    }
    expect(templates).toEqual(
      new Set(['sum-times', 'difference-times', 'product-plus', 'two-sums']),
    )
  })

  it('checks both estimates and reasonableness judgments', () => {
    setRng(seededRng(0xc03_0004))
    const modes = new Set<string>()
    const judgments = new Set<string>()
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit3Question('estimate-product', 3)
      modes.add(question.parameters.mode)
      if (question.parameters.mode === 'reasonableness') {
        judgments.add(
          curriculumAnswer(question).startsWith('Yes;')
            ? 'reasonable'
            : 'not-reasonable',
        )
      }
    }
    expect(modes).toEqual(new Set(['estimate', 'reasonableness']))
    expect(judgments).toEqual(new Set(['reasonable', 'not-reasonable']))
  })

  it('interprets expressions structurally without asking for or returning a computed product', () => {
    setRng(seededRng(0xc03_0005))
    const templates = new Set<string>()
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit3Question(
        'interpret-expression',
        3,
      )
      templates.add(question.parameters.template)
      expect(question.prompt).toMatch(/^Without evaluating it,/)
      expect(curriculumAnswer(question)).toMatch(/^(?:Add|Subtract|Multiply) /)
      expect(curriculumAnswer(question)).not.toMatch(/^\d+$/)
      const expression = matchPrompt(
        question.prompt,
        /^Without evaluating it, which statement describes (.+)\?$/,
      )[1]
      // Deliberately call only the structural oracle; no evaluation occurs in this assertion.
      expect(curriculumAnswer(question)).toBe(
        interpretExpression(parseExpression(expression)),
      )
    }
    expect(templates).toEqual(
      new Set([
        'factor-times-sum',
        'difference-times-factor',
        'product-plus',
        'sum-times-difference',
      ]),
    )
  })

  it('covers both inventory and projected-revenue multi-step contexts', () => {
    setRng(seededRng(0xc03_0006))
    const contexts = new Set<string>()
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit3Question(
        'multi-step-multiplication',
        3,
      )
      contexts.add(question.parameters.context)
      expectWellFormed(question)
    }
    expect(contexts).toEqual(new Set(['inventory', 'revenue']))
  })
})
