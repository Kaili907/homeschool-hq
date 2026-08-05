import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE5_MATH_UNIT1_GENERATORS,
  GRADE5_MATH_UNIT1_ITEM_DEFINITIONS,
  GRADE5_MATH_UNIT1_ITEM_TYPES,
  generateGrade5MathUnit1Question,
  type Grade5MathUnit1ItemType,
  type Grade5MathUnit1Question,
} from './grade5MathUnit1Generator'

const RUNS_PER_DIFFICULTY = 200

const EXPONENT_BY_PLACE: Record<string, number> = {
  millions: 6,
  'hundred-thousands': 5,
  'ten-thousands': 4,
  thousands: 3,
  hundreds: 2,
  tens: 1,
  ones: 0,
}

const UNIT_BY_PLACE: Record<string, number> = {
  ten: 10,
  hundred: 100,
  thousand: 1_000,
}

const UNIT_BY_EXPONENT = [
  1, 10, 100, 1_000, 10_000, 100_000, 1_000_000,
] as const

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function requiredMatch(text: string, pattern: RegExp): RegExpMatchArray {
  const match = text.match(pattern)
  if (!match)
    throw new Error(`Prompt did not match independent oracle grammar: ${text}`)
  return match
}

/** Independent recursive-descent parser for expressions rendered in prompts/choices. */
function evaluateRenderedExpression(source: string): number {
  const normalized = source.replace(/[\[{]/g, '(').replace(/[\]}]/g, ')')
  const compact = normalized.replace(/\s+/g, '')
  const tokens = compact.match(/\d+|[()+×-]/g) ?? []
  if (tokens.join('') !== compact)
    throw new Error(`Unexpected expression token in ${source}`)
  let index = 0

  function parseFactor(): number {
    const token = tokens[index]
    if (/^\d+$/.test(token ?? '')) {
      index++
      return Number(token)
    }
    if (token === '(') {
      index++
      const value = parseAddSubtract()
      if (tokens[index] !== ')')
        throw new Error(`Unclosed grouping in ${source}`)
      index++
      return value
    }
    throw new Error(`Expected a number or group in ${source}`)
  }

  function parseMultiply(): number {
    let value = parseFactor()
    while (tokens[index] === '×') {
      index++
      value *= parseFactor()
    }
    return value
  }

  function parseAddSubtract(): number {
    let value = parseMultiply()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++]
      const right = parseMultiply()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const value = parseAddSubtract()
  if (index !== tokens.length)
    throw new Error(`Unconsumed expression tokens in ${source}`)
  return value
}

function roundHalfUp(value: number, unit: number): number {
  const quotient = Math.floor(value / unit)
  const remainder = value - quotient * unit
  return (quotient + (remainder * 2 >= unit ? 1 : 0)) * unit
}

function expressionFromPhrase(phrase: string): string {
  let match = phrase.match(
    /^Add (\d+) and (\d+), then multiply the sum by (\d+)\.$/,
  )
  if (match) return `(${match[1]} + ${match[2]}) × ${match[3]}`

  match = phrase.match(
    /^Multiply (\d+) by (\d+), then subtract the product from (\d+)\.$/,
  )
  if (match) return `${match[3]} - (${match[1]} × ${match[2]})`

  match = phrase.match(
    /^Subtract (\d+) from (\d+), multiply the difference by (\d+), then add (\d+)\.$/,
  )
  if (match) return `${match[4]} + [${match[3]} × (${match[2]} - ${match[1]})]`

  throw new Error(`Unsupported generated calculation phrase: ${phrase}`)
}

function phraseFromExpression(expression: string): string {
  let match = expression.match(/^\((\d+) \+ (\d+)\) × (\d+)$/)
  if (match)
    return `Add ${match[1]} and ${match[2]}, then multiply the sum by ${match[3]}.`

  match = expression.match(/^(\d+) - \((\d+) × (\d+)\)$/)
  if (match)
    return `Multiply ${match[2]} by ${match[3]}, then subtract the product from ${match[1]}.`

  match = expression.match(/^(\d+) \+ \[(\d+) × \((\d+) - (\d+)\)\]$/)
  if (match) {
    return `Subtract ${match[4]} from ${match[3]}, multiply the difference by ${match[2]}, then add ${match[1]}.`
  }

  throw new Error(`Unsupported generated expression: ${expression}`)
}

function valueFromPhrase(phrase: string): number {
  let match = phrase.match(
    /^Add (\d+) and (\d+), then multiply the sum by (\d+)\.$/,
  )
  if (match) return (Number(match[1]) + Number(match[2])) * Number(match[3])

  match = phrase.match(/^Multiply (\d+) by (\d+), then add (\d+)\.$/)
  if (match) return Number(match[1]) * Number(match[2]) + Number(match[3])

  match = phrase.match(/^Subtract (\d+) from (\d+), then add (\d+)\.$/)
  if (match) return Number(match[2]) - Number(match[1]) + Number(match[3])

  match = phrase.match(/^Multiply (\d+) by (\d+), then subtract (\d+)\.$/)
  if (match) return Number(match[1]) * Number(match[2]) - Number(match[3])

  match = phrase.match(/^Add (\d+), (\d+), and (\d+)\.$/)
  if (match) return Number(match[1]) + Number(match[2]) + Number(match[3])

  match = phrase.match(
    /^Multiply (\d+) by (\d+), then subtract the product from (\d+)\.$/,
  )
  if (match) return Number(match[3]) - Number(match[1]) * Number(match[2])

  match = phrase.match(
    /^Subtract (\d+) from (\d+), then multiply the difference by (\d+)\.$/,
  )
  if (match) return (Number(match[2]) - Number(match[1])) * Number(match[3])

  match = phrase.match(
    /^Add (\d+) and (\d+), then subtract the sum from (\d+)\.$/,
  )
  if (match) return Number(match[3]) - (Number(match[1]) + Number(match[2]))

  match = phrase.match(
    /^Multiply (\d+) by (\d+), then add the product to (\d+)\.$/,
  )
  if (match) return Number(match[3]) + Number(match[1]) * Number(match[2])

  match = phrase.match(
    /^Subtract (\d+) from (\d+), multiply the difference by (\d+), then add (\d+)\.$/,
  )
  if (match)
    return (
      Number(match[4]) +
      Number(match[3]) * (Number(match[2]) - Number(match[1]))
    )

  match = phrase.match(
    /^Add (\d+) and (\d+), then multiply the sum by the difference of (\d+) and (\d+)\.$/,
  )
  if (match)
    return (
      (Number(match[1]) + Number(match[2])) *
      (Number(match[3]) - Number(match[4]))
    )

  match = phrase.match(
    /^Add (\d+) and (\d+), multiply the sum by (\d+), then add (\d+)\.$/,
  )
  if (match)
    return (
      Number(match[4]) +
      Number(match[3]) * (Number(match[1]) + Number(match[2]))
    )

  match = phrase.match(
    /^Multiply (\d+) by (\d+), add (\d+), then subtract (\d+)\.$/,
  )
  if (match)
    return (
      Number(match[3]) + Number(match[1]) * Number(match[2]) - Number(match[4])
    )

  match = phrase.match(
    /^Subtract (\d+) from (\d+), add (\d+), then multiply the sum by (\d+)\.$/,
  )
  if (match)
    return (
      Number(match[4]) *
      (Number(match[3]) + Number(match[2]) - Number(match[1]))
    )

  throw new Error(`Unsupported phrase choice: ${phrase}`)
}

function placeValueOracle(
  display: string,
  digit: string,
  comparedPlace: string,
  referencePlace: string,
): string {
  const comparedExponent = EXPONENT_BY_PLACE[comparedPlace]
  const referenceExponent = EXPONENT_BY_PLACE[referencePlace]
  if (comparedExponent === undefined || referenceExponent === undefined) {
    throw new Error(`Unknown place in ${comparedPlace}/${referencePlace}`)
  }
  expect(Number(display[display.length - comparedExponent - 1])).toBe(
    Number(digit),
  )
  expect(Number(display[display.length - referenceExponent - 1])).toBe(
    Number(digit),
  )
  expect(Math.abs(comparedExponent - referenceExponent)).toBe(1)
  return comparedExponent > referenceExponent
    ? '10 times as much'
    : '1/10 as much'
}

/** Uses only rendered prompt text; it never reads question.parameters or generator helpers. */
function oracleAnswer(question: Grade5MathUnit1Question): string {
  switch (question.itemType) {
    case 'evaluate-numerical-expression': {
      const [, expression] = requiredMatch(question.prompt, /^Evaluate (.+)\.$/)
      return String(evaluateRenderedExpression(expression))
    }
    case 'words-to-expression': {
      const [, phrase] = requiredMatch(
        question.prompt,
        /^Which expression means: “(.+)”$/,
      )
      return expressionFromPhrase(phrase)
    }
    case 'expression-to-words': {
      const [, expression] = requiredMatch(
        question.prompt,
        /^Which phrase describes (.+) without evaluating it\?$/,
      )
      return phraseFromExpression(expression)
    }
    case 'expression-relationship': {
      const [, left, right, compared] = requiredMatch(
        question.prompt,
        /^Let E represent (\d+) \+ (\d+)\. Without evaluating, how does (.+) compare with E\?$/,
      )
      let match = compared.match(
        new RegExp(`^(\\d+) × \\(${left} \\+ ${right}\\)$`),
      )
      if (match) return `${match[1]} times as large as E`
      match = compared.match(
        new RegExp(`^\\(${left} \\+ ${right}\\) \\+ (\\d+)$`),
      )
      if (match) return `${match[1]} greater than E`
      throw new Error(`Unsupported rendered relationship: ${question.prompt}`)
    }
    case 'choose-expression-for-situation': {
      const [, groups, perGroup, extra] = requiredMatch(
        question.prompt,
        /^A supply cart has (\d+) boxes with (\d+) markers in each box and (\d+) loose markers\. Which expression represents the total number of markers\?$/,
      )
      return `${groups} × ${perGroup} + ${extra}`
    }
    case 'solve-multistep-problem': {
      let match = question.prompt.match(
        /^A garden has (\d+) trays with (\d+) seedlings in each tray and (\d+) extra seedlings\. How many seedlings are there in all\?$/,
      )
      if (match)
        return String(Number(match[1]) * Number(match[2]) + Number(match[3]))
      match = question.prompt.match(
        /^A library has (\d+) shelves with (\d+) books on each shelf\. Then (\d+) books are loaned out\. How many books remain\?$/,
      )
      if (match)
        return String(Number(match[1]) * Number(match[2]) - Number(match[3]))
      match = question.prompt.match(
        /^A team packs (\d+) crates with (\d+) bottles in each crate, adds (\d+) loose bottles, and then uses (\d+) bottles\. How many bottles remain\?$/,
      )
      if (match) {
        return String(
          Number(match[1]) * Number(match[2]) +
            Number(match[3]) -
            Number(match[4]),
        )
      }
      throw new Error(`Unsupported rendered word problem: ${question.prompt}`)
    }
    case 'adjacent-whole-number-place-value': {
      const [, display, digit, comparedPlace, referenceDigit, referencePlace] =
        requiredMatch(
          question.prompt,
          /^In (\d+), how does the value of the (\d) in the ([a-z-]+) place compare with the value of the (\d) in the ([a-z-]+) place\?$/,
        )
      expect(referenceDigit).toBe(digit)
      return placeValueOracle(display, digit, comparedPlace, referencePlace)
    }
    case 'estimate-sum-difference': {
      const [, place, left, operation, right] = requiredMatch(
        question.prompt,
        /^Round each number to the nearest (ten|hundred|thousand) to estimate (\d+) ([+-]) (\d+)\.$/,
      )
      const unit = UNIT_BY_PLACE[place]
      const roundedLeft = roundHalfUp(Number(left), unit)
      const roundedRight = roundHalfUp(Number(right), unit)
      return String(
        operation === '+'
          ? roundedLeft + roundedRight
          : roundedLeft - roundedRight,
      )
    }
    case 'estimate-product': {
      const [, left, leftPlace, right, rightPlace] = requiredMatch(
        question.prompt,
        /^Round (\d+) to the nearest (ten|hundred|thousand) and (\d+) to the nearest (ten|hundred|thousand), then multiply to estimate the product\.$/,
      )
      return String(
        roundHalfUp(Number(left), UNIT_BY_PLACE[leftPlace]) *
          roundHalfUp(Number(right), UNIT_BY_PLACE[rightPlace]),
      )
    }
    case 'reasonableness-check': {
      const [, left, operation, right, proposed, place] = requiredMatch(
        question.prompt,
        /^A student says (\d+) ([+×-]) (\d+) = (\d+)\. Round each number to the nearest (ten|hundred|thousand)\. Which choice correctly checks the claim\?$/,
      )
      const leftValue = Number(left)
      const rightValue = Number(right)
      const actual =
        operation === '+'
          ? leftValue + rightValue
          : operation === '-'
            ? leftValue - rightValue
            : leftValue * rightValue
      const unit = UNIT_BY_PLACE[place]
      const roundedLeft = roundHalfUp(leftValue, unit)
      const roundedRight = roundHalfUp(rightValue, unit)
      const estimate =
        operation === '+'
          ? roundedLeft + roundedRight
          : operation === '-'
            ? roundedLeft - roundedRight
            : roundedLeft * roundedRight
      return actual === Number(proposed)
        ? `The claim is exact; the rounded estimate is ${estimate}.`
        : `The claim is not exact; the exact result is ${actual} and the rounded estimate is ${estimate}.`
    }
    case 'expression-error-analysis': {
      let match = question.prompt.match(
        /^A student evaluates (\d+) \+ \((\d+) × (\d+)\): “They add (\d+) and (\d+) first, then multiply by (\d+), so the value is (\d+)\.” Which statement best identifies the error\?$/,
      )
      if (match) {
        const [a, b, c, reasoningA, reasoningB, reasoningC, claimed] = match
          .slice(1)
          .map(Number)
        expect([reasoningA, reasoningB, reasoningC]).toEqual([a, b, c])
        expect(claimed).toBe((a + b) * c)
        const correct = a + b * c
        expect(claimed).not.toBe(correct)
        return `The student added before multiplying; ${b} × ${c} should be evaluated first, giving ${correct}.`
      }
      match = question.prompt.match(
        /^A student evaluates \[(\d+) \+ (\d+)\] × (\d+) - (\d+): “They multiply (\d+) by (\d+) first, then finish the calculation, so the value is (\d+)\.” Which statement best identifies the error\?$/,
      )
      if (match) {
        const [a, b, c, d, reasoningB, reasoningC, claimed] = match
          .slice(1)
          .map(Number)
        expect([reasoningB, reasoningC]).toEqual([b, c])
        expect(claimed).toBe(a + b * c - d)
        const correct = (a + b) * c - d
        expect(claimed).not.toBe(correct)
        return `The student multiplied before evaluating [${a} + ${b}]; the grouped sum is ${a + b}, giving ${correct}.`
      }
      match = question.prompt.match(
        /^A student evaluates (\d+) × \[(\d+) \+ \((\d+) - (\d+)\)\] \+ (\d+): “They multiply (\d+) by (\d+) first, then finish the calculation, so the value is (\d+)\.” Which statement best identifies the error\?$/,
      )
      if (match) {
        const [a, b, c, d, e, reasoningA, reasoningB, claimed] = match
          .slice(1)
          .map(Number)
        expect([reasoningA, reasoningB]).toEqual([a, b])
        expect(claimed).toBe(a * b + c - d + e)
        const correct = a * (b + c - d) + e
        expect(claimed).not.toBe(correct)
        return `The student multiplied before evaluating (${c} - ${d}); the innermost difference is ${c - d}, giving ${correct}.`
      }
      throw new Error(`Unsupported rendered error analysis: ${question.prompt}`)
    }
    case 'place-value-error-analysis': {
      const [
        ,
        display,
        digit,
        comparedPlace,
        claimed,
        referenceDigit,
        referencePlace,
      ] = requiredMatch(
        question.prompt,
        /^A student says, “In (\d+), the value of the (\d) in the ([a-z-]+) place is (.+?) as the value of the (\d) in the ([a-z-]+) place\.” Which statement best analyzes the error\?$/,
      )
      expect(referenceDigit).toBe(digit)
      const correctRelation = placeValueOracle(
        display,
        digit,
        comparedPlace,
        referencePlace,
      )
      expect(claimed).not.toBe(correctRelation)
      const comparedValue =
        Number(digit) * UNIT_BY_EXPONENT[EXPONENT_BY_PLACE[comparedPlace]]
      const referenceValue =
        Number(digit) * UNIT_BY_EXPONENT[EXPONENT_BY_PLACE[referencePlace]]
      return `The values are ${comparedValue} and ${referenceValue}; ${comparedValue} is ${correctRelation} as ${referenceValue}, so the student's comparison is incorrect.`
    }
  }
}

function assertChoicesStayInDomain(question: Grade5MathUnit1Question): void {
  for (const choice of question.choices) {
    expect(choice).not.toMatch(/-\d/)
  }
  switch (question.itemType) {
    case 'evaluate-numerical-expression':
    case 'solve-multistep-problem':
    case 'estimate-sum-difference':
    case 'estimate-product':
      for (const choice of question.choices) expect(choice).toMatch(/^\d+$/)
      return
    case 'words-to-expression':
    case 'choose-expression-for-situation':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^[\d\s()[\]{}+×-]+$/)
        expect(evaluateRenderedExpression(choice)).toBeGreaterThanOrEqual(0)
      }
      return
    case 'expression-to-words':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^[A-Z][A-Za-z\d ,.-]+\.$/)
        expect(valueFromPhrase(choice)).toBeGreaterThanOrEqual(0)
      }
      return
    case 'expression-relationship':
      for (const choice of question.choices) {
        expect(choice).toMatch(
          /^(?:\d+ times as large as E|\d+ greater than E|\d+ less than E|1\/\d+ as large as E)$/,
        )
      }
      return
    case 'adjacent-whole-number-place-value':
      for (const choice of question.choices) {
        expect([
          '10 times as much',
          '1/10 as much',
          '100 times as much',
          'the same value',
        ]).toContain(choice)
      }
      return
    case 'expression-error-analysis':
      for (const choice of question.choices) {
        expect(choice).toMatch(
          /^(?:The student|The work|The grouping|The first)/,
        )
        expect(choice).toMatch(/\.$/)
      }
      return
    case 'place-value-error-analysis':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^(?:The values|Both digits|The places)/)
        expect(choice).toMatch(/\.$/)
      }
      return
    case 'reasonableness-check':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^The claim is (?:exact|not exact); .+\.$/)
      }
  }
}

function assertNoEquivalentCorrectDistractor(
  question: Grade5MathUnit1Question,
): void {
  const expected = oracleAnswer(question)
  if (
    question.itemType === 'words-to-expression' ||
    question.itemType === 'choose-expression-for-situation'
  ) {
    const correctValue = evaluateRenderedExpression(expected)
    for (const choice of question.choices) {
      if (choice !== expected)
        expect(evaluateRenderedExpression(choice)).not.toBe(correctValue)
    }
    return
  }
  if (question.itemType === 'expression-to-words') {
    const correctValue = valueFromPhrase(expected)
    for (const choice of question.choices) {
      if (choice !== expected)
        expect(valueFromPhrase(choice)).not.toBe(correctValue)
    }
    return
  }
  if (question.itemType === 'expression-error-analysis') {
    const [, correctValue] = requiredMatch(expected, /giving (\d+)\.$/)
    for (const choice of question.choices) {
      if (choice === expected) continue
      const numbers = choice.match(/\d+/g)
      expect(numbers).not.toBeNull()
      expect(Number(numbers?.at(-1))).not.toBe(Number(correctValue))
    }
    return
  }
  if (question.itemType === 'place-value-error-analysis') {
    const [, firstValue, secondValue, correctRelation] = requiredMatch(
      expected,
      /^The values are (\d+) and (\d+); \d+ is (10 times as much|1\/10 as much) as \d+,/,
    )
    for (const choice of question.choices) {
      if (choice === expected) continue
      const statedRelation = choice.match(
        /is (10 times as much|1\/10 as much|100 times as much|the same value) as/,
      )?.[1]
      if (statedRelation) {
        expect(statedRelation).not.toBe(correctRelation)
      } else {
        expect(choice).toMatch(/^Both digits have value \d;/)
        expect(firstValue).not.toBe(secondValue)
      }
    }
    return
  }
  expect(question.choices.filter((choice) => choice === expected)).toHaveLength(
    1,
  )
}

function expectWellFormed(question: Grade5MathUnit1Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices).toHaveLength(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(question.choices[question.answerIndex]).toBe(oracleAnswer(question))
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  assertChoicesStayInDomain(question)
  assertNoEquivalentCorrectDistractor(question)
}

describe('Grade 5 Math Unit 1 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE5_MATH_UNIT1_ITEM_DEFINITIONS)).toEqual([
      ...GRADE5_MATH_UNIT1_ITEM_TYPES,
    ])
    expect(Object.keys(GRADE5_MATH_UNIT1_GENERATORS)).toEqual([
      ...GRADE5_MATH_UNIT1_ITEM_TYPES,
    ])
    expect(new Set(GRADE5_MATH_UNIT1_ITEM_TYPES).size).toBe(12)
  })

  it('covers the complete standards/practices and recurring lesson-focus sets', () => {
    expect(
      new Set(
        Object.values(GRADE5_MATH_UNIT1_ITEM_DEFINITIONS).map(
          ({ standard }) => standard,
        ),
      ),
    ).toEqual(new Set(['5.OA.1', '5.OA.2', '5.NBT.1', 'MP.1', 'MP.3', 'MP.6']))
    expect(
      new Set(
        Object.values(GRADE5_MATH_UNIT1_ITEM_DEFINITIONS).map(
          ({ lessonFocus }) => lessonFocus,
        ),
      ),
    ).toEqual(
      new Set([
        'problem-solving routines',
        'reading and writing numerical expressions',
        'place-value language',
        'estimation and reasonableness',
        'explaining strategies',
        'analyzing errors',
      ]),
    )
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x5_01_c0de))
    for (const itemType of GRADE5_MATH_UNIT1_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade5MathUnit1Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(
          GRADE5_MATH_UNIT1_ITEM_DEFINITIONS[itemType].standard,
        )
        expect(question.lessonFocus).toBe(
          GRADE5_MATH_UNIT1_ITEM_DEFINITIONS[itemType].lessonFocus,
        )
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const examples = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE5_MATH_UNIT1_ITEM_TYPES) {
      const example = GRADE5_MATH_UNIT1_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      examples.add(example)
    }
    expect(examples.size).toBe(GRADE5_MATH_UNIT1_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike =
  (typeof GRADE5_MATH_UNIT1_ITEM_DEFINITIONS)[Grade5MathUnit1ItemType]['workedExample']

describe('Grade 5 Math Unit 1 independent prompt-parsing property oracles', () => {
  for (const [typeIndex, itemType] of GRADE5_MATH_UNIT1_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have an independently recomputed answer`, () => {
      setRng(seededRng(0x100_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade5MathUnit1Question(itemType, difficulty)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          expectWellFormed(question)
        }
      }
    })
  }

  it('executes the full 7,200-case property matrix', () => {
    const cases = GRADE5_MATH_UNIT1_ITEM_TYPES.length * 3 * RUNS_PER_DIFFICULTY
    expect(cases).toBe(7_200)
    console.info(
      `Unit 1 property matrix: ${cases.toLocaleString()} cases = ${GRADE5_MATH_UNIT1_ITEM_TYPES.length} types × 3 difficulties × ${RUNS_PER_DIFFICULTY} items`,
    )
  })
})

describe('Grade 5 Math Unit 1 constant-RNG distractor safety', () => {
  for (const [label, constant] of [
    ['zero', 0],
    ['middle', 0.5],
    ['near-one', 0.999_999_999],
  ] as const) {
    it(`keeps every type and difficulty valid under a constant ${label} RNG`, () => {
      setRng(() => constant)
      for (const itemType of GRADE5_MATH_UNIT1_ITEM_TYPES) {
        for (const difficulty of [1, 2, 3] as const) {
          for (let run = 0; run < 5; run++) {
            expectWellFormed(
              generateGrade5MathUnit1Question(itemType, difficulty),
            )
          }
        }
      }
    })
  }
})

describe('Grade 5 Math Unit 1 required edge cases', () => {
  it('uses parentheses, then brackets, then braces as difficulty increases', () => {
    setRng(seededRng(0x9a01_0001))
    const easy = generateGrade5MathUnit1Question(
      'evaluate-numerical-expression',
      1,
    )
    const medium = generateGrade5MathUnit1Question(
      'evaluate-numerical-expression',
      2,
    )
    const hard = generateGrade5MathUnit1Question(
      'evaluate-numerical-expression',
      3,
    )
    expect(easy.prompt).toMatch(/\(.+\)/)
    expect(easy.prompt).not.toContain('[')
    expect(medium.prompt).toContain('[')
    expect(medium.prompt).toContain('(')
    expect(hard.prompt).toContain('{')
    expect(hard.prompt).toContain('[')
    expect(hard.prompt).toContain('(')
  })

  it('preserves subtraction order in words and nested expressions', () => {
    setRng(seededRng(0x9a01_0002))
    for (const difficulty of [2, 3] as const) {
      for (let run = 0; run < 200; run++) {
        const words = generateGrade5MathUnit1Question(
          'words-to-expression',
          difficulty,
        )
        const phrase = generateGrade5MathUnit1Question(
          'expression-to-words',
          difficulty,
        )
        expect(curriculumAnswer(words)).toBe(oracleAnswer(words))
        expect(curriculumAnswer(phrase)).toBe(oracleAnswer(phrase))
        expect(curriculumAnswer(words)).toContain('-')
        expect(curriculumAnswer(phrase)).toMatch(/Subtract|subtract/)
      }
    }
  })

  it('reaches every adjacent whole-number place pair through millions in both directions', () => {
    setRng(seededRng(0x9a01_0003))
    const pairs = new Set<string>()
    const relations = new Set<string>()
    for (let run = 0; run < 2_000; run++) {
      const question = generateGrade5MathUnit1Question(
        'adjacent-whole-number-place-value',
        3,
      )
      const match = requiredMatch(
        question.prompt,
        /^In \d+, how does the value of the \d in the ([a-z-]+) place compare with the value of the \d in the ([a-z-]+) place\?$/,
      )
      const first = EXPONENT_BY_PLACE[match[1]]
      const second = EXPONENT_BY_PLACE[match[2]]
      pairs.add(`${Math.max(first, second)},${Math.min(first, second)}`)
      relations.add(curriculumAnswer(question))
    }
    expect(pairs).toEqual(new Set(['6,5', '5,4', '4,3', '3,2', '2,1', '1,0']))
    expect(relations).toEqual(new Set(['10 times as much', '1/10 as much']))
  })

  it('rounds exact halfway operands up using integer arithmetic', () => {
    setRng(seededRng(0x9a01_0004))
    for (let run = 0; run < 200; run++) {
      const sum = generateGrade5MathUnit1Question('estimate-sum-difference', 3)
      const product = generateGrade5MathUnit1Question('estimate-product', 3)
      expect(sum.parameters.left % sum.parameters.roundingUnit).toBe(
        sum.parameters.roundingUnit / 2,
      )
      expect(sum.parameters.right % sum.parameters.roundingUnit).toBe(
        sum.parameters.roundingUnit / 2,
      )
      expect(
        product.parameters.left % product.parameters.leftRoundingUnit,
      ).toBe(product.parameters.leftRoundingUnit / 2)
      expect(
        product.parameters.right % product.parameters.rightRoundingUnit,
      ).toBe(product.parameters.rightRoundingUnit / 2)
      expect(curriculumAnswer(sum)).toBe(oracleAnswer(sum))
      expect(curriculumAnswer(product)).toBe(oracleAnswer(product))
    }
  })

  it('keeps product reasoning within whole-number prerequisite bounds', () => {
    setRng(seededRng(0x9a01_0008))
    for (let run = 0; run < 500; run++) {
      const estimate = generateGrade5MathUnit1Question('estimate-product', 3)
      const check = generateGrade5MathUnit1Question('reasonableness-check', 3)
      expect(estimate.parameters.left).toBeLessThan(1_000)
      expect(estimate.parameters.right).toBeLessThan(100)
      expect(check.parameters.left).toBeLessThan(100)
      expect(check.parameters.right).toBeLessThan(100)
    }
  })

  it('keeps estimated subtraction and every generated numeric choice nonnegative', () => {
    setRng(seededRng(0x9a01_0005))
    let sawSubtraction = false
    for (let run = 0; run < 1_000; run++) {
      const question = generateGrade5MathUnit1Question(
        'estimate-sum-difference',
        3,
      )
      if (question.parameters.operation === '-') sawSubtraction = true
      for (const choice of question.choices)
        expect(Number(choice)).toBeGreaterThanOrEqual(0)
    }
    expect(sawSubtraction).toBe(true)
  })

  it('generates both exact and inexact claims for reasonableness checks', () => {
    setRng(seededRng(0x9a01_0006))
    const statuses = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade5MathUnit1Question(
        'reasonableness-check',
        3,
      )
      statuses.add(
        curriculumAnswer(question).startsWith('The claim is exact;')
          ? 'exact'
          : 'inexact',
      )
    }
    expect(statuses).toEqual(new Set(['exact', 'inexact']))
  })

  it('always presents a genuinely incorrect claim in both error-analysis types', () => {
    setRng(seededRng(0x9a01_0007))
    for (const difficulty of [1, 2, 3] as const) {
      for (let run = 0; run < 300; run++) {
        const expression = generateGrade5MathUnit1Question(
          'expression-error-analysis',
          difficulty,
        )
        const placeValue = generateGrade5MathUnit1Question(
          'place-value-error-analysis',
          difficulty,
        )
        expect(expression.parameters.claimed).not.toBe(
          evaluateRenderedExpression(expression.parameters.expression),
        )
        const expectedRelation =
          placeValue.parameters.comparedExponent >
          placeValue.parameters.referenceExponent
            ? '10 times as much'
            : '1/10 as much'
        expect(placeValue.parameters.claimedRelation).not.toBe(expectedRelation)
        expect(curriculumAnswer(expression)).toMatch(/error|before|first/)
        expect(curriculumAnswer(placeValue)).toContain(
          "student's comparison is incorrect",
        )
      }
    }
  })
})
