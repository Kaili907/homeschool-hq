import type { Difficulty } from '../types'
import { pick, ri, shuffle } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/** Coverage contract derived from Unit 5, all 18 lesson records, and 8.F.1–8.F.5. */
export const GRADE8_MATH_UNIT5_ITEM_TYPES = [
  'is-relation-a-function',
  'function-graph-as-pairs',
  'evaluate-function-notation',
  'find-input-from-output',
  'compare-functions-rate-of-change',
  'compare-functions-value-at-x',
  'classify-linear-from-table',
  'classify-linear-from-equation',
  'construct-function-from-two-points',
  'construct-function-from-context',
  'match-graph-description-to-scenario',
  'identify-interval-behavior',
] as const

export type Grade8MathUnit5ItemType = (typeof GRADE8_MATH_UNIT5_ITEM_TYPES)[number]

type OrderedPair = readonly [number, number]

interface RelationPairsParameters {
  pairs: readonly OrderedPair[]
  isFunction: boolean
}

interface FunctionGraphPairsParameters {
  invalidPairs: readonly OrderedPair[]
  validPairsA: readonly OrderedPair[]
  validPairsB: readonly OrderedPair[]
  validPairsC: readonly OrderedPair[]
}

interface EvaluateNotationParameters {
  m: number
  b: number
  a: number
}

interface FindInputParameters {
  m: number
  b: number
  x: number
  y0: number
}

type CompareLabel = 'Function A' | 'Function B'

interface CompareRateParameters {
  aFirst: boolean
  mEquation: number
  bEquation: number
  mTable: number
  bTable: number
  tableX1: number
  tableX2: number
  tableY1: number
  tableY2: number
}

interface CompareValueParameters {
  aIsEquation: boolean
  mEq: number
  bEq: number
  mVerbal: number
  bVerbal: number
  x: number
}

interface ClassifyTableParameters {
  xs: readonly [number, number, number, number]
  ys: readonly [number, number, number, number]
  isLinear: boolean
}

interface ClassifyEquationParameters {
  isLinear: boolean
  linearM: number
  linearB: number
  quadA: number
  quadC: number
}

interface TwoPointsParameters {
  x1: number
  y1: number
  x2: number
  y2: number
  m: number
  b: number
}

type ContextTemplate = 'rental' | 'cab' | 'membership'

interface ContextFunctionParameters {
  base: number
  rate: number
  templateId: ContextTemplate
}

interface ScenarioShapeParameters {
  scenario: string
  shape: string
}

type IntervalBehavior = 'increasing' | 'decreasing' | 'constant'

interface IntervalBehaviorParameters {
  t: readonly [number, number, number, number]
  h: readonly [number, number, number, number]
  behaviors: readonly [IntervalBehavior, IntervalBehavior, IntervalBehavior]
  queryBehavior: IntervalBehavior
}

type Unit5Question<TItemType extends Grade8MathUnit5ItemType, TParameters> = CurriculumQuestion<
  TItemType,
  TParameters
>

export type Grade8MathUnit5Question =
  | Unit5Question<'is-relation-a-function', RelationPairsParameters>
  | Unit5Question<'function-graph-as-pairs', FunctionGraphPairsParameters>
  | Unit5Question<'evaluate-function-notation', EvaluateNotationParameters>
  | Unit5Question<'find-input-from-output', FindInputParameters>
  | Unit5Question<'compare-functions-rate-of-change', CompareRateParameters>
  | Unit5Question<'compare-functions-value-at-x', CompareValueParameters>
  | Unit5Question<'classify-linear-from-table', ClassifyTableParameters>
  | Unit5Question<'classify-linear-from-equation', ClassifyEquationParameters>
  | Unit5Question<'construct-function-from-two-points', TwoPointsParameters>
  | Unit5Question<'construct-function-from-context', ContextFunctionParameters>
  | Unit5Question<'match-graph-description-to-scenario', ScenarioShapeParameters>
  | Unit5Question<'identify-interval-behavior', IntervalBehaviorParameters>

interface ItemDefinition {
  standard: '8.F.1' | '8.F.2' | '8.F.3' | '8.F.4' | '8.F.5'
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

export const GRADE8_MATH_UNIT5_ITEM_DEFINITIONS = {
  'is-relation-a-function': {
    standard: '8.F.1',
    lessonFocus: 'function definition',
    workedExample: {
      prompt: 'Consider the relation {(1, 4), (2, 7), (3, 4)}. Is this relation a function?',
      answer: 'Yes, this relation is a function.',
      steps: [
        'Every input value (1, 2, and 3) appears only once as a first coordinate.',
        'Each input is paired with exactly one output, even though the output 4 repeats.',
        'Because no input has two different outputs, the relation is a function.',
      ],
    },
  },
  'function-graph-as-pairs': {
    standard: '8.F.1',
    lessonFocus: 'function definition',
    workedExample: {
      prompt:
        'Which set of ordered pairs does NOT represent a function? {(1, 2), (2, 4), (3, 6)}, {(1, 5), (1, 9), (2, 5)}, {(0, 0), (1, 1), (2, 4)}, {(-1, 3), (0, 3), (1, 3)}',
      answer: '{(1, 5), (1, 9), (2, 5)}',
      steps: [
        'Check each set for a repeated input value.',
        'In {(1, 5), (1, 9), (2, 5)}, the input 1 is paired with both 5 and 9.',
        'Since one input has two different outputs, this set is not a function.',
      ],
    },
  },
  'evaluate-function-notation': {
    standard: '8.F.1',
    lessonFocus: 'input output and notation',
    workedExample: {
      prompt: 'Given f(x) = 3x + 4, find f(5).',
      answer: '19',
      steps: [
        'Substitute x = 5 into the rule: f(5) = 3(5) + 4.',
        'Multiply first: 3 × 5 = 15.',
        'Add the constant: 15 + 4 = 19.',
      ],
    },
  },
  'find-input-from-output': {
    standard: '8.F.1',
    lessonFocus: 'input output and notation',
    workedExample: {
      prompt: 'Given f(x) = 2x - 3, find the value of x for which f(x) = 11.',
      answer: '7',
      steps: ['Set the rule equal to the target output: 2x - 3 = 11.', 'Add 3 to both sides: 2x = 14.', 'Divide by 2: x = 7.'],
    },
  },
  'compare-functions-rate-of-change': {
    standard: '8.F.2',
    lessonFocus: 'comparing functions',
    workedExample: {
      prompt:
        'Function A is given by f(x) = 4x + 2. Function B is given by the table:\nx: 0, 3\ny: 2, 20\nWhich function has the greater rate of change?',
      answer: 'Function B',
      steps: [
        'Function A has rate of change 4, the coefficient of x.',
        'Function B changes from 2 to 20 as x goes from 0 to 3: rate = (20 - 2) / (3 - 0) = 6.',
        'Since 6 is greater than 4, Function B has the greater rate of change.',
      ],
    },
  },
  'compare-functions-value-at-x': {
    standard: '8.F.2',
    lessonFocus: 'comparing functions',
    workedExample: {
      prompt: 'Function A is given by f(x) = 3x + 1. Function B starts at 10 and increases by 2 each unit. Which function has the greater value when x = 4?',
      answer: 'Function B',
      steps: [
        'Function A at x = 4: f(4) = 3(4) + 1 = 13.',
        'Function B at x = 4: 10 + 2(4) = 18.',
        'Since 18 is greater than 13, Function B has the greater value at x = 4.',
      ],
    },
  },
  'classify-linear-from-table': {
    standard: '8.F.3',
    lessonFocus: 'linear versus nonlinear patterns',
    workedExample: {
      prompt: 'A table shows:\nx: 0, 1, 2, 3\ny: 2, 5, 8, 11\nIs the relationship linear or nonlinear?',
      answer: 'linear',
      steps: [
        'Find the differences between consecutive y-values: 5 - 2 = 3, 8 - 5 = 3, 11 - 8 = 3.',
        'The first differences are all equal to 3.',
        'A constant first difference means the relationship is linear.',
      ],
    },
  },
  'classify-linear-from-equation': {
    standard: '8.F.3',
    lessonFocus: 'linear versus nonlinear patterns',
    workedExample: {
      prompt: 'Classify the equation y = x² + 1 as linear or nonlinear.',
      answer: 'nonlinear',
      steps: [
        'The equation includes x² instead of x to the first power.',
        'A function is linear only when its graph is a straight line with a constant rate of change.',
        'Because the exponent on x is 2, the graph is a curve, so the equation is nonlinear.',
      ],
    },
  },
  'construct-function-from-two-points': {
    standard: '8.F.4',
    lessonFocus: 'constructing functions',
    workedExample: {
      prompt: 'A function contains the points (1, 5) and (3, 13). Write the function rule f(x) = mx + b.',
      answer: 'f(x) = 4x + 1',
      steps: [
        'Find the slope: m = (13 - 5) / (3 - 1) = 8 / 2 = 4.',
        'Use one point to find b: 5 = 4(1) + b, so b = 1.',
        'The function rule is f(x) = 4x + 1.',
      ],
    },
  },
  'construct-function-from-context': {
    standard: '8.F.4',
    lessonFocus: 'constructing functions',
    workedExample: {
      prompt: 'A rental company charges a $30 base fee plus $15 per hour. Which function models the total cost f(x) for x hours?',
      answer: 'f(x) = 15x + 30',
      steps: [
        'The base fee of $30 is charged even with 0 hours, so it is the initial value b.',
        'The $15 per hour charge is the constant rate of change m.',
        'The function rule is f(x) = 15x + 30.',
      ],
    },
  },
  'match-graph-description-to-scenario': {
    standard: '8.F.5',
    lessonFocus: 'qualitative graph interpretation',
    workedExample: {
      prompt:
        'A car accelerates steadily, then travels at a constant speed, then decelerates to a stop. Which description best matches the shape of the graph over time?',
      answer: 'increasing, then constant, then decreasing',
      steps: [
        'While accelerating, the speed graph rises, so it is increasing.',
        'While traveling at a constant speed, the graph is flat, so it is constant.',
        'While decelerating to a stop, the graph falls, so it is decreasing.',
      ],
    },
  },
  'identify-interval-behavior': {
    standard: '8.F.5',
    lessonFocus: 'qualitative graph interpretation',
    workedExample: {
      prompt:
        'A graph shows height over time.\nFrom t = 0 to t = 2, height goes from 0 to 10.\nFrom t = 2 to t = 5, height goes from 10 to 10.\nFrom t = 5 to t = 7, height goes from 10 to 0.\nWhich interval shows the height decreasing?',
      answer: 't = 5 to t = 7',
      steps: [
        'From t = 0 to t = 2, the height rises from 0 to 10, so it is increasing.',
        'From t = 2 to t = 5, the height stays at 10, so it is constant.',
        'From t = 5 to t = 7, the height falls from 10 to 0, so it is decreasing.',
      ],
    },
  },
} as const satisfies Record<Grade8MathUnit5ItemType, ItemDefinition>

const uniqueExcept = (correct: string, candidates: readonly string[]): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

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

function formatPairsSet(pairs: readonly OrderedPair[]): string {
  return `{${pairs.map(([x, y]) => `(${x}, ${y})`).join(', ')}}`
}

function sampleDistinctInts(count: number, range: number): number[] {
  const pool = Array.from({ length: 2 * range + 1 }, (_, index) => index - range)
  return shuffle(pool).slice(0, count)
}

function randomSlope(difficulty: Difficulty): number {
  const magnitude = difficulty === 1 ? ri(1, 6) : difficulty === 2 ? ri(2, 9) : ri(2, 12)
  return difficulty === 1 ? magnitude : pick([1, -1] as const) * magnitude
}

function randomIntercept(difficulty: Difficulty): number {
  return difficulty === 1 ? ri(-6, 10) : difficulty === 2 ? ri(-15, 15) : ri(-25, 25)
}

function randomQuadA(difficulty: Difficulty): number {
  return difficulty === 1 ? pick([1, -1] as const) : difficulty === 2 ? pick([1, -1, 2, -2] as const) : pick([1, -1, 2, -2, 3, -3] as const)
}

function randomQuadC(difficulty: Difficulty): number {
  return difficulty === 1 ? ri(-5, 5) : difficulty === 2 ? ri(-10, 10) : ri(-15, 15)
}

// ---------- 1. is-relation-a-function ----------

function pairSetSize(difficulty: Difficulty): number {
  return difficulty === 1 ? 3 : 4
}

function pairRange(difficulty: Difficulty): number {
  return difficulty === 1 ? 6 : difficulty === 2 ? 10 : 16
}

function randomFunctionPairs(pairCount: number, range: number): OrderedPair[] {
  const xs = sampleDistinctInts(pairCount, range)
  return xs.map((x): OrderedPair => [x, ri(-range, range)])
}

function randomNonFunctionPairs(pairCount: number, range: number): OrderedPair[] {
  const xs = sampleDistinctInts(pairCount - 1, range)
  const repeatX = pick(xs)
  const y1 = ri(-range, range)
  let y2 = ri(-range, range)
  while (y2 === y1) y2 = ri(-range, range)
  const pairs: OrderedPair[] = xs.map((x): OrderedPair => [x, x === repeatX ? y1 : ri(-range, range)])
  pairs.push([repeatX, y2])
  return pairs
}

export function generateIsRelationAFunctionQuestion(
  difficulty: Difficulty,
): Unit5Question<'is-relation-a-function', RelationPairsParameters> {
  const pairCount = pairSetSize(difficulty)
  const range = pairRange(difficulty)
  const isFunction = pick([true, false] as const)
  const pairs = isFunction ? randomFunctionPairs(pairCount, range) : randomNonFunctionPairs(pairCount, range)
  const parameters: RelationPairsParameters = { pairs, isFunction }
  const correctAnswer = isFunction ? 'Yes, this relation is a function.' : 'No, this relation is not a function.'
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['is-relation-a-function']
  return makeCurriculumQuestion({
    itemType: 'is-relation-a-function',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Consider the relation ${formatPairsSet(pairs)}. Is this relation a function?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      'Yes, this relation is a function.',
      'No, this relation is not a function.',
      'Cannot be determined from the given pairs.',
      'It is a function only if every output is different.',
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 2. function-graph-as-pairs ----------

export function generateFunctionGraphAsPairsQuestion(
  difficulty: Difficulty,
): Unit5Question<'function-graph-as-pairs', FunctionGraphPairsParameters> {
  const pairCount = pairSetSize(difficulty)
  const range = pairRange(difficulty)
  const parameters: FunctionGraphPairsParameters = {
    invalidPairs: randomNonFunctionPairs(pairCount, range),
    validPairsA: randomFunctionPairs(pairCount, range),
    validPairsB: randomFunctionPairs(pairCount, range),
    validPairsC: randomFunctionPairs(pairCount, range),
  }
  const correctAnswer = formatPairsSet(parameters.invalidPairs)
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['function-graph-as-pairs']
  return makeCurriculumQuestion({
    itemType: 'function-graph-as-pairs',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: 'Which set of ordered pairs does NOT represent a function?',
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatPairsSet(parameters.validPairsA),
      formatPairsSet(parameters.validPairsB),
      formatPairsSet(parameters.validPairsC),
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 3. evaluate-function-notation ----------

export function generateEvaluateFunctionNotationQuestion(
  difficulty: Difficulty,
): Unit5Question<'evaluate-function-notation', EvaluateNotationParameters> {
  const m = randomSlope(difficulty)
  const b = randomIntercept(difficulty)
  const a = difficulty === 1 ? ri(-5, 5) : difficulty === 2 ? ri(-10, 10) : ri(-15, 15)
  const parameters: EvaluateNotationParameters = { m, b, a }
  const value = m * a + b
  const correctAnswer = String(value)
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['evaluate-function-notation']
  return makeCurriculumQuestion({
    itemType: 'evaluate-function-notation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Given f(x) = ${formatLinear(m, b)}, find f(${a}).`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(value + 1),
      String(value - 1),
      String(value + 2),
      String(value - 2),
      String(value + 3),
      String(value - 3),
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 4. find-input-from-output ----------

export function generateFindInputFromOutputQuestion(
  difficulty: Difficulty,
): Unit5Question<'find-input-from-output', FindInputParameters> {
  const m = randomSlope(difficulty)
  const b = randomIntercept(difficulty)
  const x = difficulty === 1 ? ri(-5, 5) : difficulty === 2 ? ri(-10, 10) : ri(-15, 15)
  const y0 = m * x + b
  const parameters: FindInputParameters = { m, b, x, y0 }
  const correctAnswer = String(x)
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['find-input-from-output']
  return makeCurriculumQuestion({
    itemType: 'find-input-from-output',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Given f(x) = ${formatLinear(m, b)}, find the value of x for which f(x) = ${y0}.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(x + 1),
      String(x - 1),
      String(x + 2),
      String(x - 2),
      String(x + 3),
      String(x - 3),
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 5. compare-functions-rate-of-change ----------

export function generateCompareFunctionsRateOfChangeQuestion(
  difficulty: Difficulty,
): Unit5Question<'compare-functions-rate-of-change', CompareRateParameters> {
  const mEquation = randomSlope(difficulty)
  let mTable = randomSlope(difficulty)
  while (mTable === mEquation) mTable = randomSlope(difficulty)
  const bEquation = randomIntercept(difficulty)
  const bTable = randomIntercept(difficulty)
  const tableX1 = ri(0, 5)
  const step = ri(1, difficulty === 1 ? 3 : 6)
  const tableX2 = tableX1 + step
  const tableY1 = mTable * tableX1 + bTable
  const tableY2 = mTable * tableX2 + bTable
  const aFirst = pick([true, false] as const)
  const parameters: CompareRateParameters = {
    aFirst,
    mEquation,
    bEquation,
    mTable,
    bTable,
    tableX1,
    tableX2,
    tableY1,
    tableY2,
  }
  const equationLabel: CompareLabel = aFirst ? 'Function A' : 'Function B'
  const tableLabel: CompareLabel = aFirst ? 'Function B' : 'Function A'
  const correctAnswer = mEquation > mTable ? equationLabel : tableLabel
  const otherLabel = correctAnswer === equationLabel ? tableLabel : equationLabel
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['compare-functions-rate-of-change']
  return makeCurriculumQuestion({
    itemType: 'compare-functions-rate-of-change',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${equationLabel} is given by f(x) = ${formatLinear(mEquation, bEquation)}. ${tableLabel} is given by the table:\nx: ${tableX1}, ${tableX2}\ny: ${tableY1}, ${tableY2}\nWhich function has the greater rate of change?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      otherLabel,
      'They have the same rate of change.',
      'Cannot be determined from the given information.',
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 6. compare-functions-value-at-x ----------

export function generateCompareFunctionsValueAtXQuestion(
  difficulty: Difficulty,
): Unit5Question<'compare-functions-value-at-x', CompareValueParameters> {
  const mEq = randomSlope(difficulty)
  const mVerbal = randomSlope(difficulty)
  const x = ri(0, difficulty === 1 ? 5 : 12)
  const bEq = randomIntercept(difficulty)
  let bVerbal = ri(0, difficulty === 1 ? 15 : 30)
  if (mEq * x + bEq === mVerbal * x + bVerbal) bVerbal += 1
  const aIsEquation = pick([true, false] as const)
  const parameters: CompareValueParameters = { aIsEquation, mEq, bEq, mVerbal, bVerbal, x }
  const valueEq = mEq * x + bEq
  const valueVerbal = mVerbal * x + bVerbal
  const equationLabel: CompareLabel = aIsEquation ? 'Function A' : 'Function B'
  const verbalLabel: CompareLabel = aIsEquation ? 'Function B' : 'Function A'
  const correctAnswer = valueEq > valueVerbal ? equationLabel : verbalLabel
  const otherLabel = correctAnswer === equationLabel ? verbalLabel : equationLabel
  const verbalDescription = `${verbalLabel} starts at ${bVerbal} and ${mVerbal >= 0 ? `increases by ${mVerbal}` : `decreases by ${Math.abs(mVerbal)}`} each unit.`
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['compare-functions-value-at-x']
  return makeCurriculumQuestion({
    itemType: 'compare-functions-value-at-x',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${equationLabel} is given by f(x) = ${formatLinear(mEq, bEq)}. ${verbalDescription} Which function has the greater value when x = ${x}?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      otherLabel,
      'The two functions have equal values at that input.',
      'Cannot be determined without a graph.',
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 7. classify-linear-from-table ----------

export function generateClassifyLinearFromTableQuestion(
  difficulty: Difficulty,
): Unit5Question<'classify-linear-from-table', ClassifyTableParameters> {
  const step = ri(1, difficulty === 1 ? 2 : 4)
  const x0 = ri(-4, 4)
  const xs: [number, number, number, number] = [x0, x0 + step, x0 + 2 * step, x0 + 3 * step]
  const isLinear = pick([true, false] as const)
  let ys: [number, number, number, number]
  if (isLinear) {
    const m = randomSlope(difficulty)
    const b = randomIntercept(difficulty)
    ys = xs.map((x) => m * x + b) as [number, number, number, number]
  } else {
    const a = randomQuadA(difficulty)
    const c = randomQuadC(difficulty)
    ys = xs.map((x) => a * x * x + c) as [number, number, number, number]
  }
  const parameters: ClassifyTableParameters = { xs, ys, isLinear }
  const correctAnswer = isLinear ? 'linear' : 'nonlinear'
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['classify-linear-from-table']
  return makeCurriculumQuestion({
    itemType: 'classify-linear-from-table',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A table shows:\nx: ${xs.join(', ')}\ny: ${ys.join(', ')}\nIs the relationship linear or nonlinear?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, ['linear', 'nonlinear', 'constant', 'cannot be determined from a table']),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 8. classify-linear-from-equation ----------

export function generateClassifyLinearFromEquationQuestion(
  difficulty: Difficulty,
): Unit5Question<'classify-linear-from-equation', ClassifyEquationParameters> {
  const isLinear = pick([true, false] as const)
  const linearM = randomSlope(difficulty)
  const linearB = randomIntercept(difficulty)
  const quadA = randomQuadA(difficulty)
  const quadC = randomQuadC(difficulty)
  const parameters: ClassifyEquationParameters = { isLinear, linearM, linearB, quadA, quadC }
  const equationText = isLinear ? `y = ${formatLinear(linearM, linearB)}` : `y = ${formatQuadraticNoLinearTerm(quadA, quadC)}`
  const correctAnswer = isLinear ? 'linear' : 'nonlinear'
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['classify-linear-from-equation']
  return makeCurriculumQuestion({
    itemType: 'classify-linear-from-equation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Classify the equation ${equationText} as linear or nonlinear.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, ['linear', 'nonlinear', 'constant', 'cannot be determined from an equation']),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 9. construct-function-from-two-points ----------

export function generateConstructFunctionFromTwoPointsQuestion(
  difficulty: Difficulty,
): Unit5Question<'construct-function-from-two-points', TwoPointsParameters> {
  const m = randomSlope(difficulty)
  const b = randomIntercept(difficulty)
  const x1 = ri(-6, 6)
  const offset = pick([1, -1] as const) * ri(1, difficulty === 1 ? 4 : 8)
  const x2 = x1 + offset
  const y1 = m * x1 + b
  const y2 = m * x2 + b
  const parameters: TwoPointsParameters = { x1, y1, x2, y2, m, b }
  const correctAnswer = `f(x) = ${formatLinear(m, b)}`
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['construct-function-from-two-points']
  return makeCurriculumQuestion({
    itemType: 'construct-function-from-two-points',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A function contains the points (${x1}, ${y1}) and (${x2}, ${y2}). Write the function rule f(x) = mx + b.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `f(x) = ${formatLinear(-m, b)}`,
      `f(x) = ${formatLinear(m, b + 1)}`,
      `f(x) = ${formatLinear(m + 1, b)}`,
      `f(x) = ${formatLinear(m, b - 1)}`,
      `f(x) = ${formatLinear(m, -b)}`,
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 10. construct-function-from-context ----------

const CONTEXT_TEMPLATES: readonly ContextTemplate[] = ['rental', 'cab', 'membership']

function contextPrompt(parameters: ContextFunctionParameters): string {
  const { base, rate, templateId } = parameters
  if (templateId === 'rental') {
    return `A rental company charges a $${base} base fee plus $${rate} per hour. Which function models the total cost f(x) for x hours?`
  }
  if (templateId === 'cab') {
    return `A taxi charges a $${base} flat fee plus $${rate} per mile. Which function models the total fare f(x) for x miles?`
  }
  return `A gym charges a $${base} sign-up fee plus $${rate} per month. Which function models the total cost f(x) after x months?`
}

export function generateConstructFunctionFromContextQuestion(
  difficulty: Difficulty,
): Unit5Question<'construct-function-from-context', ContextFunctionParameters> {
  const base = difficulty === 1 ? ri(5, 50) : difficulty === 2 ? ri(10, 100) : ri(10, 150)
  const rate = difficulty === 1 ? ri(2, 20) : difficulty === 2 ? ri(5, 40) : ri(5, 60)
  const templateId = pick(CONTEXT_TEMPLATES)
  const parameters: ContextFunctionParameters = { base, rate, templateId }
  const correctAnswer = `f(x) = ${formatLinear(rate, base)}`
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['construct-function-from-context']
  return makeCurriculumQuestion({
    itemType: 'construct-function-from-context',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: contextPrompt(parameters),
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `f(x) = ${formatLinear(base, rate)}`,
      `f(x) = ${formatLinear(rate, base + 1)}`,
      `f(x) = ${formatLinear(rate + 1, base)}`,
      `f(x) = ${formatLinear(rate, base - 1)}`,
    ]),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 11. match-graph-description-to-scenario ----------

const GRAPH_SHAPES = [
  'increasing at a constant rate the whole time',
  'increasing, then constant, then decreasing',
  'decreasing at a constant rate the whole time',
  'constant, then increasing',
] as const

interface ScenarioEntry {
  scenario: string
  shape: (typeof GRAPH_SHAPES)[number]
  complexity: 1 | 2 | 3
}

const SCENARIOS: readonly ScenarioEntry[] = [
  {
    scenario: 'A plant grows at a steady rate the entire time it is measured.',
    shape: 'increasing at a constant rate the whole time',
    complexity: 1,
  },
  {
    scenario: 'A hiker climbs a steady, unchanging slope for the whole hike.',
    shape: 'increasing at a constant rate the whole time',
    complexity: 1,
  },
  {
    scenario: 'A candle burns down at a steady rate until it is gone.',
    shape: 'decreasing at a constant rate the whole time',
    complexity: 1,
  },
  {
    scenario: 'A tank of water drains at a steady rate until it is empty.',
    shape: 'decreasing at a constant rate the whole time',
    complexity: 1,
  },
  {
    scenario: 'A car accelerates steadily, then travels at a constant speed, then decelerates to a stop.',
    shape: 'increasing, then constant, then decreasing',
    complexity: 2,
  },
  {
    scenario: 'A kettle of water heats up steadily, then boils at a constant temperature, then cools steadily once removed from heat.',
    shape: 'increasing, then constant, then decreasing',
    complexity: 3,
  },
  {
    scenario: 'A car is parked for a while, then accelerates steadily onto the highway.',
    shape: 'constant, then increasing',
    complexity: 2,
  },
  {
    scenario: 'An elevator waits on the ground floor, then rises steadily to the top floor.',
    shape: 'constant, then increasing',
    complexity: 3,
  },
]

export function generateMatchGraphDescriptionToScenarioQuestion(
  difficulty: Difficulty,
): Unit5Question<'match-graph-description-to-scenario', ScenarioShapeParameters> {
  const pool = SCENARIOS.filter((entry) => entry.complexity <= difficulty)
  const entry = pick(pool)
  const parameters: ScenarioShapeParameters = { scenario: entry.scenario, shape: entry.shape }
  const correctAnswer = entry.shape
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['match-graph-description-to-scenario']
  return makeCurriculumQuestion({
    itemType: 'match-graph-description-to-scenario',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${entry.scenario} Which description best matches the shape of the graph over time?`,
    correctAnswer,
    distractors: GRAPH_SHAPES.filter((shape) => shape !== correctAnswer),
    distractorMode: 'distinct',
    choiceCount: 4,
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 12. identify-interval-behavior ----------

function buildIntervalHeights(behaviors: readonly IntervalBehavior[], h0: number, maxDelta: number): number[] {
  const heights = [h0]
  for (const behavior of behaviors) {
    const prev = heights[heights.length - 1]
    const delta = ri(1, maxDelta)
    heights.push(behavior === 'constant' ? prev : behavior === 'increasing' ? prev + delta : prev - delta)
  }
  return heights
}

export function generateIdentifyIntervalBehaviorQuestion(
  difficulty: Difficulty,
): Unit5Question<'identify-interval-behavior', IntervalBehaviorParameters> {
  const behaviors = shuffle(['increasing', 'decreasing', 'constant'] as const) as [
    IntervalBehavior,
    IntervalBehavior,
    IntervalBehavior,
  ]
  const tStep = () => ri(1, difficulty === 1 ? 3 : 6)
  const t: [number, number, number, number] = [0, 0, 0, 0]
  t[1] = t[0] + tStep()
  t[2] = t[1] + tStep()
  t[3] = t[2] + tStep()
  const h0 = ri(0, difficulty === 1 ? 10 : 20)
  const maxDelta = difficulty === 1 ? ri(2, 8) : difficulty === 2 ? ri(2, 14) : ri(2, 20)
  const h = buildIntervalHeights(behaviors, h0, maxDelta) as [number, number, number, number]
  const queryBehavior = pick(['increasing', 'decreasing', 'constant'] as const)
  const parameters: IntervalBehaviorParameters = { t, h, behaviors, queryBehavior }
  const matchIndex = behaviors.indexOf(queryBehavior)
  const intervalLabel = (index: number) => `t = ${t[index]} to t = ${t[index + 1]}`
  const correctAnswer = intervalLabel(matchIndex)
  const otherLabels = behaviors
    .map((_, index) => index)
    .filter((index) => index !== matchIndex)
    .map((index) => intervalLabel(index))
  const definition = GRADE8_MATH_UNIT5_ITEM_DEFINITIONS['identify-interval-behavior']
  return makeCurriculumQuestion({
    itemType: 'identify-interval-behavior',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A graph shows height over time.\nFrom t = ${t[0]} to t = ${t[1]}, height goes from ${h[0]} to ${h[1]}.\nFrom t = ${t[1]} to t = ${t[2]}, height goes from ${h[1]} to ${h[2]}.\nFrom t = ${t[2]} to t = ${t[3]}, height goes from ${h[2]} to ${h[3]}.\nWhich interval shows the height ${queryBehavior}?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [...otherLabels, 'No interval shows this behavior.']),
    distractorMode: 'distinct',
    parameters,
    workedExample: definition.workedExample,
  })
}

export const GRADE8_MATH_UNIT5_GENERATORS = {
  'is-relation-a-function': generateIsRelationAFunctionQuestion,
  'function-graph-as-pairs': generateFunctionGraphAsPairsQuestion,
  'evaluate-function-notation': generateEvaluateFunctionNotationQuestion,
  'find-input-from-output': generateFindInputFromOutputQuestion,
  'compare-functions-rate-of-change': generateCompareFunctionsRateOfChangeQuestion,
  'compare-functions-value-at-x': generateCompareFunctionsValueAtXQuestion,
  'classify-linear-from-table': generateClassifyLinearFromTableQuestion,
  'classify-linear-from-equation': generateClassifyLinearFromEquationQuestion,
  'construct-function-from-two-points': generateConstructFunctionFromTwoPointsQuestion,
  'construct-function-from-context': generateConstructFunctionFromContextQuestion,
  'match-graph-description-to-scenario': generateMatchGraphDescriptionToScenarioQuestion,
  'identify-interval-behavior': generateIdentifyIntervalBehaviorQuestion,
} satisfies Record<Grade8MathUnit5ItemType, CurriculumGenerator<Grade8MathUnit5Question>>

export function generateGrade8MathUnit5Question<TItemType extends Grade8MathUnit5ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade8MathUnit5Question, { itemType: TItemType }> {
  const generator = GRADE8_MATH_UNIT5_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade8MathUnit5Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
