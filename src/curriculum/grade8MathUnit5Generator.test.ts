import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE8_MATH_UNIT5_GENERATORS,
  GRADE8_MATH_UNIT5_ITEM_DEFINITIONS,
  GRADE8_MATH_UNIT5_ITEM_TYPES,
  generateGrade8MathUnit5Question,
  type Grade8MathUnit5ItemType,
  type Grade8MathUnit5Question,
} from './grade8MathUnit5Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function formatLinear(m: number, b: number): string {
  const coefficient = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`
  if (b === 0) return coefficient
  return `${coefficient} ${b > 0 ? '+' : '-'} ${Math.abs(b)}`
}

function formatQuadraticNoLinearTerm(a: number, c: number): string {
  const coefficient = a === 1 ? 'x²' : a === -1 ? '-x²' : `${a}x²`
  if (c === 0) return coefficient
  return `${coefficient} ${c > 0 ? '+' : '-'} ${Math.abs(c)}`
}

function formatPairsSet(pairs: readonly (readonly [number, number])[]): string {
  return `{${pairs.map(([x, y]) => `(${x}, ${y})`).join(', ')}}`
}

function isFunctionRelation(pairs: readonly (readonly [number, number])[]): boolean {
  const seen = new Map<number, number>()
  for (const [x, y] of pairs) {
    if (seen.has(x) && seen.get(x) !== y) return false
    seen.set(x, y)
  }
  return true
}

// Independent copy of the scenario -> shape mapping, kept separate from the generator's table.
const ORACLE_SCENARIOS: ReadonlyMap<string, string> = new Map([
  ['A plant grows at a steady rate the entire time it is measured.', 'increasing at a constant rate the whole time'],
  ['A hiker climbs a steady, unchanging slope for the whole hike.', 'increasing at a constant rate the whole time'],
  ['A candle burns down at a steady rate until it is gone.', 'decreasing at a constant rate the whole time'],
  ['A tank of water drains at a steady rate until it is empty.', 'decreasing at a constant rate the whole time'],
  [
    'A car accelerates steadily, then travels at a constant speed, then decelerates to a stop.',
    'increasing, then constant, then decreasing',
  ],
  [
    'A kettle of water heats up steadily, then boils at a constant temperature, then cools steadily once removed from heat.',
    'increasing, then constant, then decreasing',
  ],
  ['A car is parked for a while, then accelerates steadily onto the highway.', 'constant, then increasing'],
  ['An elevator waits on the ground floor, then rises steadily to the top floor.', 'constant, then increasing'],
])

type RelationParameters = Extract<Grade8MathUnit5Question, { itemType: 'is-relation-a-function' }>['parameters']
type GraphPairsParameters = Extract<Grade8MathUnit5Question, { itemType: 'function-graph-as-pairs' }>['parameters']
type EvaluateNotationParameters = Extract<Grade8MathUnit5Question, { itemType: 'evaluate-function-notation' }>['parameters']
type FindInputParameters = Extract<Grade8MathUnit5Question, { itemType: 'find-input-from-output' }>['parameters']
type CompareRateParameters = Extract<Grade8MathUnit5Question, { itemType: 'compare-functions-rate-of-change' }>['parameters']
type CompareValueParameters = Extract<Grade8MathUnit5Question, { itemType: 'compare-functions-value-at-x' }>['parameters']
type ClassifyTableParameters = Extract<Grade8MathUnit5Question, { itemType: 'classify-linear-from-table' }>['parameters']
type ClassifyEquationParameters = Extract<Grade8MathUnit5Question, { itemType: 'classify-linear-from-equation' }>['parameters']
type TwoPointsParameters = Extract<Grade8MathUnit5Question, { itemType: 'construct-function-from-two-points' }>['parameters']
type ContextFunctionParameters = Extract<Grade8MathUnit5Question, { itemType: 'construct-function-from-context' }>['parameters']
type ScenarioShapeParameters = Extract<Grade8MathUnit5Question, { itemType: 'match-graph-description-to-scenario' }>['parameters']
type IntervalBehaviorParameters = Extract<Grade8MathUnit5Question, { itemType: 'identify-interval-behavior' }>['parameters']

function contextPromptOracle(parameters: ContextFunctionParameters): string {
  const { base, rate, templateId } = parameters
  if (templateId === 'rental') {
    return `A rental company charges a $${base} base fee plus $${rate} per hour. Which function models the total cost f(x) for x hours?`
  }
  if (templateId === 'cab') {
    return `A taxi charges a $${base} flat fee plus $${rate} per mile. Which function models the total fare f(x) for x miles?`
  }
  return `A gym charges a $${base} sign-up fee plus $${rate} per month. Which function models the total cost f(x) after x months?`
}

function intervalLabelOracle(t: IntervalBehaviorParameters['t'], index: number): string {
  return `t = ${t[index]} to t = ${t[index + 1]}`
}

function oracleAnswer(question: Grade8MathUnit5Question): string {
  switch (question.itemType) {
    case 'is-relation-a-function': {
      const p = question.parameters as RelationParameters
      return isFunctionRelation(p.pairs) ? 'Yes, this relation is a function.' : 'No, this relation is not a function.'
    }
    case 'function-graph-as-pairs': {
      const p = question.parameters as GraphPairsParameters
      const candidates = [p.invalidPairs, p.validPairsA, p.validPairsB, p.validPairsC]
      const notAFunction = candidates.find((candidate) => !isFunctionRelation(candidate))
      return formatPairsSet(notAFunction ?? p.invalidPairs)
    }
    case 'evaluate-function-notation': {
      const p = question.parameters as EvaluateNotationParameters
      return String(p.m * p.a + p.b)
    }
    case 'find-input-from-output': {
      const p = question.parameters as FindInputParameters
      return String((p.y0 - p.b) / p.m)
    }
    case 'compare-functions-rate-of-change': {
      const p = question.parameters as CompareRateParameters
      const tableRate = (p.tableY2 - p.tableY1) / (p.tableX2 - p.tableX1)
      const equationLabel = p.aFirst ? 'Function A' : 'Function B'
      const tableLabel = p.aFirst ? 'Function B' : 'Function A'
      return p.mEquation > tableRate ? equationLabel : tableLabel
    }
    case 'compare-functions-value-at-x': {
      const p = question.parameters as CompareValueParameters
      const valueEq = p.mEq * p.x + p.bEq
      const valueVerbal = p.mVerbal * p.x + p.bVerbal
      const equationLabel = p.aIsEquation ? 'Function A' : 'Function B'
      const verbalLabel = p.aIsEquation ? 'Function B' : 'Function A'
      return valueEq > valueVerbal ? equationLabel : verbalLabel
    }
    case 'classify-linear-from-table': {
      const p = question.parameters as ClassifyTableParameters
      const diffs = [p.ys[1] - p.ys[0], p.ys[2] - p.ys[1], p.ys[3] - p.ys[2]]
      const constant = diffs.every((d) => d === diffs[0])
      return constant ? 'linear' : 'nonlinear'
    }
    case 'classify-linear-from-equation': {
      const p = question.parameters as ClassifyEquationParameters
      return p.isLinear ? 'linear' : 'nonlinear'
    }
    case 'construct-function-from-two-points': {
      const p = question.parameters as TwoPointsParameters
      const m = (p.y2 - p.y1) / (p.x2 - p.x1)
      const b = p.y1 - m * p.x1
      return `f(x) = ${formatLinear(m, b)}`
    }
    case 'construct-function-from-context': {
      const p = question.parameters as ContextFunctionParameters
      return `f(x) = ${formatLinear(p.rate, p.base)}`
    }
    case 'match-graph-description-to-scenario': {
      const p = question.parameters as ScenarioShapeParameters
      const shape = ORACLE_SCENARIOS.get(p.scenario)
      if (!shape) throw new Error(`Unknown scenario: ${p.scenario}`)
      return shape
    }
    case 'identify-interval-behavior': {
      const p = question.parameters as IntervalBehaviorParameters
      const diffs = [p.h[1] - p.h[0], p.h[2] - p.h[1], p.h[3] - p.h[2]]
      const behaviorOf = (d: number) => (d > 0 ? 'increasing' : d < 0 ? 'decreasing' : 'constant')
      const matchIndex = diffs.findIndex((d) => behaviorOf(d) === p.queryBehavior)
      return matchIndex >= 0 ? intervalLabelOracle(p.t, matchIndex) : 'No interval shows this behavior.'
    }
  }
}

function assertPromptRepresentsParameters(question: Grade8MathUnit5Question): void {
  switch (question.itemType) {
    case 'is-relation-a-function': {
      const p = question.parameters as RelationParameters
      expect(question.prompt).toBe(`Consider the relation ${formatPairsSet(p.pairs)}. Is this relation a function?`)
      return
    }
    case 'function-graph-as-pairs':
      expect(question.prompt).toBe('Which set of ordered pairs does NOT represent a function?')
      return
    case 'evaluate-function-notation': {
      const p = question.parameters as EvaluateNotationParameters
      expect(question.prompt).toBe(`Given f(x) = ${formatLinear(p.m, p.b)}, find f(${p.a}).`)
      return
    }
    case 'find-input-from-output': {
      const p = question.parameters as FindInputParameters
      expect(question.prompt).toBe(`Given f(x) = ${formatLinear(p.m, p.b)}, find the value of x for which f(x) = ${p.y0}.`)
      expect(p.y0).toBe(p.m * p.x + p.b)
      return
    }
    case 'compare-functions-rate-of-change': {
      const p = question.parameters as CompareRateParameters
      const equationLabel = p.aFirst ? 'Function A' : 'Function B'
      const tableLabel = p.aFirst ? 'Function B' : 'Function A'
      expect(question.prompt).toBe(
        `${equationLabel} is given by f(x) = ${formatLinear(p.mEquation, p.bEquation)}. ${tableLabel} is given by the table:\nx: ${p.tableX1}, ${p.tableX2}\ny: ${p.tableY1}, ${p.tableY2}\nWhich function has the greater rate of change?`,
      )
      expect(p.mEquation).not.toBe(p.mTable)
      return
    }
    case 'compare-functions-value-at-x': {
      const p = question.parameters as CompareValueParameters
      const equationLabel = p.aIsEquation ? 'Function A' : 'Function B'
      const verbalLabel = p.aIsEquation ? 'Function B' : 'Function A'
      const verbalDescription = `${verbalLabel} starts at ${p.bVerbal} and ${p.mVerbal >= 0 ? `increases by ${p.mVerbal}` : `decreases by ${Math.abs(p.mVerbal)}`} each unit.`
      expect(question.prompt).toBe(
        `${equationLabel} is given by f(x) = ${formatLinear(p.mEq, p.bEq)}. ${verbalDescription} Which function has the greater value when x = ${p.x}?`,
      )
      expect(p.mEq * p.x + p.bEq).not.toBe(p.mVerbal * p.x + p.bVerbal)
      return
    }
    case 'classify-linear-from-table': {
      const p = question.parameters as ClassifyTableParameters
      expect(question.prompt).toBe(`A table shows:\nx: ${p.xs.join(', ')}\ny: ${p.ys.join(', ')}\nIs the relationship linear or nonlinear?`)
      return
    }
    case 'classify-linear-from-equation': {
      const p = question.parameters as ClassifyEquationParameters
      const equationText = p.isLinear
        ? `y = ${formatLinear(p.linearM, p.linearB)}`
        : `y = ${formatQuadraticNoLinearTerm(p.quadA, p.quadC)}`
      expect(question.prompt).toBe(`Classify the equation ${equationText} as linear or nonlinear.`)
      return
    }
    case 'construct-function-from-two-points': {
      const p = question.parameters as TwoPointsParameters
      expect(question.prompt).toBe(
        `A function contains the points (${p.x1}, ${p.y1}) and (${p.x2}, ${p.y2}). Write the function rule f(x) = mx + b.`,
      )
      expect(p.y1).toBe(p.m * p.x1 + p.b)
      expect(p.y2).toBe(p.m * p.x2 + p.b)
      expect(p.x1).not.toBe(p.x2)
      return
    }
    case 'construct-function-from-context': {
      const p = question.parameters as ContextFunctionParameters
      expect(question.prompt).toBe(contextPromptOracle(p))
      return
    }
    case 'match-graph-description-to-scenario': {
      const p = question.parameters as ScenarioShapeParameters
      expect(question.prompt).toBe(`${p.scenario} Which description best matches the shape of the graph over time?`)
      return
    }
    case 'identify-interval-behavior': {
      const p = question.parameters as IntervalBehaviorParameters
      expect(question.prompt).toBe(
        `A graph shows height over time.\nFrom t = ${p.t[0]} to t = ${p.t[1]}, height goes from ${p.h[0]} to ${p.h[1]}.\nFrom t = ${p.t[1]} to t = ${p.t[2]}, height goes from ${p.h[1]} to ${p.h[2]}.\nFrom t = ${p.t[2]} to t = ${p.t[3]}, height goes from ${p.h[2]} to ${p.h[3]}.\nWhich interval shows the height ${p.queryBehavior}?`,
      )
      return
    }
  }
}

function assertChoicesStayInDomain(question: Grade8MathUnit5Question): void {
  switch (question.itemType) {
    case 'is-relation-a-function':
      for (const choice of question.choices) expect(choice).toMatch(/^[A-Z].*\.$/)
      return
    case 'function-graph-as-pairs':
      for (const choice of question.choices) expect(choice).toMatch(/^\{(?:\(-?\d+, -?\d+\)(?:, )?)+\}$/)
      return
    case 'evaluate-function-notation':
    case 'find-input-from-output':
      for (const choice of question.choices) expect(choice).toMatch(/^-?\d+$/)
      return
    case 'compare-functions-rate-of-change':
    case 'compare-functions-value-at-x':
      for (const choice of question.choices) expect(choice).toMatch(/^(Function [AB]|[A-Z].*\.)$/)
      return
    case 'classify-linear-from-table':
    case 'classify-linear-from-equation':
      for (const choice of question.choices) expect(choice).toMatch(/^(linear|nonlinear|constant|cannot be determined.*)$/)
      return
    case 'construct-function-from-two-points':
    case 'construct-function-from-context':
      for (const choice of question.choices) expect(choice).toMatch(/^f\(x\) = -?\d*x( [+-] \d+)?$/)
      return
    case 'match-graph-description-to-scenario':
      for (const choice of question.choices) {
        expect(new Set(['increasing at a constant rate the whole time', 'increasing, then constant, then decreasing', 'decreasing at a constant rate the whole time', 'constant, then increasing']).has(choice)).toBe(true)
      }
      return
    case 'identify-interval-behavior':
      for (const choice of question.choices) expect(choice).toMatch(/^(t = -?\d+ to t = -?\d+|No interval shows this behavior\.)$/)
      return
  }
}

function expectWellFormed(question: Grade8MathUnit5Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  expect(question.choices).toContain(curriculumAnswer(question))
  expect(question.parameters).not.toHaveProperty('correctAnswer')
  assertChoicesStayInDomain(question)
}

describe('Grade 8 Math Unit 5 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE8_MATH_UNIT5_ITEM_DEFINITIONS)).toEqual([...GRADE8_MATH_UNIT5_ITEM_TYPES])
    expect(Object.keys(GRADE8_MATH_UNIT5_GENERATORS)).toEqual([...GRADE8_MATH_UNIT5_ITEM_TYPES])
    expect(new Set(GRADE8_MATH_UNIT5_ITEM_TYPES).size).toBe(12)
  })

  it('covers every standard and all six lesson focuses derived from the source records', () => {
    const definitions = Object.values(GRADE8_MATH_UNIT5_ITEM_DEFINITIONS)
    expect(new Set(definitions.map((definition) => definition.standard))).toEqual(
      new Set(['8.F.1', '8.F.2', '8.F.3', '8.F.4', '8.F.5']),
    )
    expect(new Set(definitions.map((definition) => definition.lessonFocus))).toEqual(
      new Set([
        'function definition',
        'input output and notation',
        'comparing functions',
        'linear versus nonlinear patterns',
        'constructing functions',
        'qualitative graph interpretation',
      ]),
    )
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x8_05_c0de))
    for (const itemType of GRADE8_MATH_UNIT5_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade8MathUnit5Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(GRADE8_MATH_UNIT5_ITEM_DEFINITIONS[itemType].standard)
        expect(question.lessonFocus).toBe(GRADE8_MATH_UNIT5_ITEM_DEFINITIONS[itemType].lessonFocus)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const exampleObjects = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE8_MATH_UNIT5_ITEM_TYPES) {
      const example = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      exampleObjects.add(example)
    }
    expect(exampleObjects.size).toBe(GRADE8_MATH_UNIT5_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike = (typeof GRADE8_MATH_UNIT5_ITEM_DEFINITIONS)[Grade8MathUnit5ItemType]['workedExample']

describe('Grade 8 Math Unit 5 independent property oracles', () => {
  for (const [typeIndex, itemType] of GRADE8_MATH_UNIT5_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have the independently recomputed answer`, () => {
      setRng(seededRng(0x500_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade8MathUnit5Question(itemType, difficulty)
          assertPromptRepresentsParameters(question)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          expectWellFormed(question)
        }
      }
    })
  }
})

describe('Grade 8 Math Unit 5 required edge cases', () => {
  it('reaches both function and non-function relations', () => {
    setRng(seededRng(0xf001))
    const outcomes = new Set<boolean>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('is-relation-a-function', 3)
      outcomes.add(question.parameters.isFunction)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(outcomes).toEqual(new Set([true, false]))
  })

  it('always identifies exactly one non-function among the four candidate sets', () => {
    setRng(seededRng(0xf002))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade8MathUnit5Question('function-graph-as-pairs', 2)
      const p = question.parameters
      const nonFunctionCount = [p.invalidPairs, p.validPairsA, p.validPairsB, p.validPairsC].filter(
        (candidate) => !isFunctionRelation(candidate),
      ).length
      expect(nonFunctionCount).toBe(1)
    }
  })

  it('reaches both linear and nonlinear classifications from a table', () => {
    setRng(seededRng(0xf003))
    const outcomes = new Set<boolean>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('classify-linear-from-table', 3)
      outcomes.add(question.parameters.isLinear)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(outcomes).toEqual(new Set([true, false]))
  })

  it('reaches both linear and nonlinear classifications from an equation', () => {
    setRng(seededRng(0xf004))
    const outcomes = new Set<boolean>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('classify-linear-from-equation', 3)
      outcomes.add(question.parameters.isLinear)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(outcomes).toEqual(new Set([true, false]))
  })

  it('reaches all four qualitative graph shapes', () => {
    setRng(seededRng(0xf005))
    const shapes = new Set<string>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('match-graph-description-to-scenario', 3)
      shapes.add(question.parameters.shape)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(shapes).toEqual(
      new Set([
        'increasing at a constant rate the whole time',
        'increasing, then constant, then decreasing',
        'decreasing at a constant rate the whole time',
        'constant, then increasing',
      ]),
    )
  })

  it('reaches all three interval behaviors when queried', () => {
    setRng(seededRng(0xf006))
    const queried = new Set<string>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('identify-interval-behavior', 3)
      queried.add(question.parameters.queryBehavior)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(queried).toEqual(new Set(['increasing', 'decreasing', 'constant']))
  })

  it('reaches both function-A-greater and function-B-greater outcomes for rate of change', () => {
    setRng(seededRng(0xf007))
    const outcomes = new Set<string>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('compare-functions-rate-of-change', 3)
      outcomes.add(curriculumAnswer(question))
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(outcomes).toEqual(new Set(['Function A', 'Function B']))
  })

  it('reaches both function-A-greater and function-B-greater outcomes for value at x', () => {
    setRng(seededRng(0xf008))
    const outcomes = new Set<string>()
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit5Question('compare-functions-value-at-x', 3)
      outcomes.add(curriculumAnswer(question))
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(outcomes).toEqual(new Set(['Function A', 'Function B']))
  })

  it('reaches all three context templates for constructing a function from context', () => {
    setRng(seededRng(0xf009))
    const templates = new Set<string>()
    for (let run = 0; run < 300; run++) {
      const question = generateGrade8MathUnit5Question('construct-function-from-context', 3)
      templates.add(question.parameters.templateId)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(templates).toEqual(new Set(['rental', 'cab', 'membership']))
  })
})
