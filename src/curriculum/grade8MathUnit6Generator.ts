import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/** Coverage contract derived from Unit 6, all 18 lesson records, and 8.EE.8a-c. */
export const GRADE8_MATH_UNIT6_ITEM_TYPES = [
  'verify-solution-of-system',
  'solve-system-for-intersection-point',
  'intersection-from-two-tables',
  'identify-quadrant-of-intersection',
  'solve-by-substitution',
  'solve-by-elimination',
  'classify-solution-count',
  'identify-equivalent-or-inconsistent-equation',
  'system-from-context-solve',
  'interpret-context-solution',
  'check-solution-against-system',
  'interpret-solution-meaning',
] as const

export type Grade8MathUnit6ItemType = (typeof GRADE8_MATH_UNIT6_ITEM_TYPES)[number]

interface Point {
  x: number
  y: number
}

interface VerifySolutionParameters {
  m1: number
  b1: number
  m2: number
  b2: number
  candidates: readonly Point[]
}

interface IntersectionPointParameters {
  m1: number
  b1: number
  m2: number
  b2: number
}

interface TableIntersectionParameters {
  m1: number
  b1: number
  m2: number
  b2: number
  xValues: readonly [number, number, number, number]
}

interface QuadrantParameters {
  m1: number
  b1: number
  m2: number
  b2: number
  x0: number
  y0: number
}

interface SubstitutionParameters {
  m1: number
  b1: number
  A2: number
  B2: number
  C2: number
}

interface EliminationParameters {
  A1: number
  B1: number
  C1: number
  A2: number
  B2: number
  C2: number
}

interface ClassifyParameters {
  m1: number
  b1: number
  m2: number
  b2: number
}

interface EquationCandidate {
  A: number
  B: number
  C: number
}

interface EquivalentOrInconsistentParameters {
  m0: number
  b0: number
  mode: 'no-solution' | 'infinite'
  candidates: readonly [EquationCandidate, EquationCandidate, EquationCandidate, EquationCandidate]
}

type ContextUnit = 'month' | 'week' | 'visit'

interface ContextParameters {
  feeA: number
  rateA: number
  feeB: number
  rateB: number
  x0: number
  y0: number
  unit: ContextUnit
}

interface InterpretCoordinateParameters extends ContextParameters {
  coordinateAsked: 'x' | 'y'
}

interface CheckSolutionParameters {
  m1: number
  b1: number
  m2: number
  b2: number
  point: Point
}

type Unit6Question<TItemType extends Grade8MathUnit6ItemType, TParameters> = CurriculumQuestion<
  TItemType,
  TParameters
>

export type Grade8MathUnit6Question =
  | Unit6Question<'verify-solution-of-system', VerifySolutionParameters>
  | Unit6Question<'solve-system-for-intersection-point', IntersectionPointParameters>
  | Unit6Question<'intersection-from-two-tables', TableIntersectionParameters>
  | Unit6Question<'identify-quadrant-of-intersection', QuadrantParameters>
  | Unit6Question<'solve-by-substitution', SubstitutionParameters>
  | Unit6Question<'solve-by-elimination', EliminationParameters>
  | Unit6Question<'classify-solution-count', ClassifyParameters>
  | Unit6Question<'identify-equivalent-or-inconsistent-equation', EquivalentOrInconsistentParameters>
  | Unit6Question<'system-from-context-solve', ContextParameters>
  | Unit6Question<'interpret-context-solution', ContextParameters>
  | Unit6Question<'check-solution-against-system', CheckSolutionParameters>
  | Unit6Question<'interpret-solution-meaning', InterpretCoordinateParameters>

interface ItemDefinition {
  standard: '8.EE.8a' | '8.EE.8b' | '8.EE.8c' | '8.EE.8'
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

export const GRADE8_MATH_UNIT6_ITEM_DEFINITIONS = {
  'verify-solution-of-system': {
    standard: '8.EE.8a',
    lessonFocus: 'intersection as shared solution',
    workedExample: {
      prompt: 'A system is y = 2x + 1 and y = -x + 7. Which point satisfies both equations: (2, 5), (3, 4), (0, 1), or (5, 2)?',
      answer: '(2, 5)',
      steps: [
        'Check (2, 5) in the first equation: 2(2) + 1 = 5, which matches.',
        'Check (2, 5) in the second equation: -1(2) + 7 = 5, which matches.',
        'Since (2, 5) satisfies both equations, it is the point where the lines intersect.',
      ],
    },
  },
  'solve-system-for-intersection-point': {
    standard: '8.EE.8a',
    lessonFocus: 'intersection as shared solution',
    workedExample: {
      prompt: 'Solve the system: y = 3x - 1 and y = -2x + 9. What is the intersection point?',
      answer: '(2, 5)',
      steps: [
        'Set the expressions equal: 3x - 1 = -2x + 9.',
        'Add 2x to both sides and add 1 to both sides: 5x = 10, so x = 2.',
        'Substitute x = 2 into y = 3x - 1 to get y = 5, giving the point (2, 5).',
      ],
    },
  },
  'intersection-from-two-tables': {
    standard: '8.EE.8a',
    lessonFocus: 'graphing systems',
    workedExample: {
      prompt: 'Relationship A: x: 0, 1, 2, 3 y: 1, 3, 5, 7. Relationship B: x: 0, 1, 2, 3 y: 7, 6, 5, 4. At which x-value do the two relationships have the same y-value?',
      answer: '2',
      steps: [
        'Compare the y-values in each table row by row.',
        'At x = 2, Relationship A gives 5 and Relationship B also gives 5.',
        'No other row has matching y-values, so x = 2 is the answer.',
      ],
    },
  },
  'identify-quadrant-of-intersection': {
    standard: '8.EE.8a',
    lessonFocus: 'graphing systems',
    workedExample: {
      prompt: 'Solve the system: y = x + 4 and y = -x + 2. In which quadrant does the intersection lie?',
      answer: 'Quadrant II',
      steps: [
        'Set x + 4 = -x + 2, so 2x = -2 and x = -1.',
        'Substitute to get y = -1 + 4 = 3, so the point is (-1, 3).',
        'Since x is negative and y is positive, the point lies in Quadrant II.',
      ],
    },
  },
  'solve-by-substitution': {
    standard: '8.EE.8b',
    lessonFocus: 'substitution or equivalent reasoning',
    workedExample: {
      prompt: 'Solve the system: y = 2x + 1 and 3x + y = 11.',
      answer: '(2, 5)',
      steps: [
        'Substitute y = 2x + 1 into the second equation: 3x + (2x + 1) = 11.',
        'Combine like terms: 5x + 1 = 11, so 5x = 10 and x = 2.',
        'Substitute x = 2 back into y = 2x + 1 to get y = 5, so the solution is (2, 5).',
      ],
    },
  },
  'solve-by-elimination': {
    standard: '8.EE.8b',
    lessonFocus: 'substitution or equivalent reasoning',
    workedExample: {
      prompt: 'Solve the system: 2x + 3y = 19 and 2x - y = 7.',
      answer: '(5, 3)',
      steps: [
        'Subtract the second equation from the first to eliminate x: (2x + 3y) - (2x - y) = 19 - 7, giving 4y = 12, so y = 3.',
        'Substitute y = 3 into 2x - y = 7 to get 2x - 3 = 7, so 2x = 10 and x = 5.',
        'The solution is (5, 3).',
      ],
    },
  },
  'classify-solution-count': {
    standard: '8.EE.8b',
    lessonFocus: 'one no or infinitely many solutions',
    workedExample: {
      prompt: 'Classify the system: y = 2x + 3 and y = 2x - 1. Does it have one solution, no solution, or infinitely many solutions?',
      answer: 'no solution',
      steps: [
        'Both equations have the same slope, 2, so the lines are parallel.',
        'The y-intercepts are different (3 and -1), so the lines never meet.',
        'A system of parallel, non-identical lines has no solution.',
      ],
    },
  },
  'identify-equivalent-or-inconsistent-equation': {
    standard: '8.EE.8b',
    lessonFocus: 'one no or infinitely many solutions',
    workedExample: {
      prompt: 'The reference equation is y = 2x + 3. Which equation, paired with the reference, gives a system with no solution?',
      answer: '-2x + y = 8',
      steps: [
        'The reference equation has slope 2, so a no-solution partner must also have slope 2 but a different intercept.',
        '-2x + y = 8 rearranges to y = 2x + 8, which has slope 2 and intercept 8, different from 3.',
        'Parallel lines with different intercepts never intersect, so the system has no solution.',
      ],
    },
  },
  'system-from-context-solve': {
    standard: '8.EE.8c',
    lessonFocus: 'systems from contexts',
    workedExample: {
      prompt: 'Plan A charges a $10 flat fee plus $3 per month. Plan B charges a $4 flat fee plus $5 per month. After how many months do the two plans cost the same, and what is that cost?',
      answer: '(3, 19)',
      steps: [
        'Set the two cost expressions equal: 10 + 3x = 4 + 5x.',
        'Subtract 3x and 4 from both sides: 6 = 2x, so x = 3.',
        'Substitute x = 3 into either plan to get a cost of 19, so the plans cost the same after 3 months at $19.',
      ],
    },
  },
  'interpret-context-solution': {
    standard: '8.EE.8c',
    lessonFocus: 'systems from contexts',
    workedExample: {
      prompt: 'Plan A charges a $10 flat fee plus $3 per month. Plan B charges a $4 flat fee plus $5 per month. The solution to the system is (3, 19). What does this solution represent?',
      answer: 'After 3 months, both plans cost $19.',
      steps: [
        'The x-coordinate, 3, is the number of months in the solution.',
        'The y-coordinate, 19, is the shared cost in dollars at that point.',
        'Together, (3, 19) means both plans cost $19 after 3 months.',
      ],
    },
  },
  'check-solution-against-system': {
    standard: '8.EE.8',
    lessonFocus: 'checking and interpreting',
    workedExample: {
      prompt: 'System: y = x + 2 and y = -x + 6. Does the point (1, 3) satisfy both equations, fail one, or fail both?',
      answer: 'fails the second equation only',
      steps: [
        'Check (1, 3) in the first equation: 1 + 2 = 3, which matches.',
        'Check (1, 3) in the second equation: -1 + 6 = 5, which does not match 3.',
        'The point satisfies the first equation but fails the second, so it fails the second equation only.',
      ],
    },
  },
  'interpret-solution-meaning': {
    standard: '8.EE.8a',
    lessonFocus: 'checking and interpreting',
    workedExample: {
      prompt: 'Plan A charges a $10 flat fee plus $3 per month. Plan B charges a $4 flat fee plus $5 per month. The solution to the system is (3, 19). What does the y-coordinate of the solution represent?',
      answer: 'The shared cost, in dollars, when the two plans are equal.',
      steps: [
        'The y-coordinate of the solution is 19.',
        'This value is the cost in dollars, not a number of months.',
        'It represents the shared cost of both plans once they are equal.',
      ],
    },
  },
} as const satisfies Record<Grade8MathUnit6ItemType, ItemDefinition>

const uniqueExcept = (correct: string, candidates: readonly string[]): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

function pointLimit(difficulty: Difficulty): number {
  return difficulty === 1 ? 6 : difficulty === 2 ? 10 : 16
}

function randomPoint(difficulty: Difficulty): Point {
  const limit = pointLimit(difficulty)
  if (difficulty === 1) return { x: ri(0, limit), y: ri(0, limit) }
  return { x: ri(-limit, limit), y: ri(-limit, limit) }
}

function randomNonzeroCoordinate(difficulty: Difficulty): number {
  const limit = pointLimit(difficulty)
  if (difficulty === 1) return ri(1, limit)
  let value = ri(-limit, limit)
  while (value === 0) value = ri(-limit, limit)
  return value
}

function slopeLimit(difficulty: Difficulty): number {
  return difficulty === 1 ? 3 : difficulty === 2 ? 6 : 9
}

function randomSlope(difficulty: Difficulty): number {
  return pick([1, -1] as const) * ri(1, slopeLimit(difficulty))
}

function distinctSlope(exclude: number, difficulty: Difficulty): number {
  let m = randomSlope(difficulty)
  while (m === exclude) m = randomSlope(difficulty)
  return m
}

function randomIntercept(difficulty: Difficulty): number {
  const limit = difficulty === 1 ? 10 : difficulty === 2 ? 20 : 35
  return ri(-limit, limit)
}

function lineFromPoint(point: Point, slope: number): number {
  return point.y - slope * point.x
}

function coefficientTerm(coefficient: number, variable: string): string {
  if (coefficient === 1) return variable
  if (coefficient === -1) return `-${variable}`
  return `${coefficient}${variable}`
}

function fmtSlopeIntercept(m: number, b: number): string {
  if (m === 0) return `y = ${b}`
  const mTerm = coefficientTerm(m, 'x')
  if (b === 0) return `y = ${mTerm}`
  const sign = b > 0 ? '+' : '-'
  return `y = ${mTerm} ${sign} ${Math.abs(b)}`
}

function fmtStandardForm(A: number, B: number, C: number): string {
  const aTerm = coefficientTerm(A, 'x')
  const bTerm = coefficientTerm(Math.abs(B), 'y')
  const sign = B >= 0 ? '+' : '-'
  return `${aTerm} ${sign} ${bTerm} = ${C}`
}

const fmtPoint = (p: Point): string => `(${p.x}, ${p.y})`

function nearbyWrongPoints(correct: Point, count: number): Point[] {
  const candidates: Point[] = [
    { x: correct.x + 1, y: correct.y },
    { x: correct.x - 1, y: correct.y },
    { x: correct.x, y: correct.y + 1 },
    { x: correct.x, y: correct.y - 1 },
    { x: correct.y, y: correct.x },
    { x: correct.x + 2, y: correct.y - 1 },
    { x: correct.x - 1, y: correct.y + 2 },
    { x: correct.x + 1, y: correct.y + 1 },
  ]
  const seen = new Set([`${correct.x},${correct.y}`])
  const result: Point[] = []
  for (const candidate of candidates) {
    const key = `${candidate.x},${candidate.y}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(candidate)
    if (result.length === count) break
  }
  return result
}

function classifyQuadrant(x: number, y: number): string {
  if (x === 0 || y === 0) return 'on an axis'
  if (x > 0 && y > 0) return 'Quadrant I'
  if (x < 0 && y > 0) return 'Quadrant II'
  if (x < 0 && y < 0) return 'Quadrant III'
  return 'Quadrant IV'
}

export function generateVerifySolutionOfSystemQuestion(
  difficulty: Difficulty,
): Unit6Question<'verify-solution-of-system', VerifySolutionParameters> {
  const point = randomPoint(difficulty)
  const m1 = randomSlope(difficulty)
  const m2 = distinctSlope(m1, difficulty)
  const b1 = lineFromPoint(point, m1)
  const b2 = lineFromPoint(point, m2)
  const wrongPoints = nearbyWrongPoints(point, 3)
  const candidates = [point, ...wrongPoints]
  const parameters: VerifySolutionParameters = { m1, b1, m2, b2, candidates }
  const correctAnswer = fmtPoint(point)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['verify-solution-of-system']
  return makeCurriculumQuestion({
    itemType: 'verify-solution-of-system',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `System: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. Which point (x, y) satisfies both equations?`,
    correctAnswer,
    distractors: wrongPoints.map(fmtPoint),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateSolveSystemForIntersectionPointQuestion(
  difficulty: Difficulty,
): Unit6Question<'solve-system-for-intersection-point', IntersectionPointParameters> {
  const point = randomPoint(difficulty)
  const m1 = randomSlope(difficulty)
  const m2 = distinctSlope(m1, difficulty)
  const b1 = lineFromPoint(point, m1)
  const b2 = lineFromPoint(point, m2)
  const parameters: IntersectionPointParameters = { m1, b1, m2, b2 }
  const correctAnswer = fmtPoint(point)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['solve-system-for-intersection-point']
  return makeCurriculumQuestion({
    itemType: 'solve-system-for-intersection-point',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve the system: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. What is the intersection point (x, y)?`,
    correctAnswer,
    distractors: nearbyWrongPoints(point, 3).map(fmtPoint),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateIntersectionFromTwoTablesQuestion(
  difficulty: Difficulty,
): Unit6Question<'intersection-from-two-tables', TableIntersectionParameters> {
  const point = randomPoint(difficulty)
  const m1 = randomSlope(difficulty)
  const m2 = distinctSlope(m1, difficulty)
  const b1 = lineFromPoint(point, m1)
  const b2 = lineFromPoint(point, m2)
  const offset = ri(0, 3)
  const xStart = point.x - offset
  const xValues: [number, number, number, number] = [xStart, xStart + 1, xStart + 2, xStart + 3]
  const y1Values = xValues.map((x) => m1 * x + b1)
  const y2Values = xValues.map((x) => m2 * x + b2)
  const parameters: TableIntersectionParameters = { m1, b1, m2, b2, xValues }
  const correctAnswer = String(point.x)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['intersection-from-two-tables']
  return makeCurriculumQuestion({
    itemType: 'intersection-from-two-tables',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Relationship A: x: ${xValues.join(', ')} y: ${y1Values.join(', ')}. Relationship B: x: ${xValues.join(', ')} y: ${y2Values.join(', ')}. At which x-value do the two relationships have the same y-value?`,
    correctAnswer,
    distractors: xValues.filter((x) => x !== point.x).map(String),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateIdentifyQuadrantOfIntersectionQuestion(
  difficulty: Difficulty,
): Unit6Question<'identify-quadrant-of-intersection', QuadrantParameters> {
  const onAxis = ri(0, 3) === 0
  let x0: number
  let y0: number
  if (onAxis) {
    const axisIsX = ri(0, 1) === 0
    const other = randomNonzeroCoordinate(difficulty)
    x0 = axisIsX ? other : 0
    y0 = axisIsX ? 0 : other
  } else {
    x0 = randomNonzeroCoordinate(difficulty)
    y0 = randomNonzeroCoordinate(difficulty)
  }
  const m1 = randomSlope(difficulty)
  const m2 = distinctSlope(m1, difficulty)
  const b1 = lineFromPoint({ x: x0, y: y0 }, m1)
  const b2 = lineFromPoint({ x: x0, y: y0 }, m2)
  const parameters: QuadrantParameters = { m1, b1, m2, b2, x0, y0 }
  const correctAnswer = classifyQuadrant(x0, y0)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['identify-quadrant-of-intersection']
  return makeCurriculumQuestion({
    itemType: 'identify-quadrant-of-intersection',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve the system: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. In which quadrant does the intersection point lie, or does it lie on an axis?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV', 'on an axis']),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateSolveBySubstitutionQuestion(
  difficulty: Difficulty,
): Unit6Question<'solve-by-substitution', SubstitutionParameters> {
  const point = randomPoint(difficulty)
  const m1 = randomSlope(difficulty)
  const b1 = lineFromPoint(point, m1)
  const coefficientLimit = difficulty === 1 ? 4 : difficulty === 2 ? 7 : 10
  let A2 = ri(1, coefficientLimit)
  let B2 = pick([1, -1] as const) * ri(1, coefficientLimit)
  while (m1 * B2 + A2 === 0) {
    A2 = ri(1, coefficientLimit)
    B2 = pick([1, -1] as const) * ri(1, coefficientLimit)
  }
  const C2 = A2 * point.x + B2 * point.y
  const parameters: SubstitutionParameters = { m1, b1, A2, B2, C2 }
  const correctAnswer = fmtPoint(point)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['solve-by-substitution']
  return makeCurriculumQuestion({
    itemType: 'solve-by-substitution',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve the system:\n${fmtSlopeIntercept(m1, b1)}\n${fmtStandardForm(A2, B2, C2)}\nUse substitution to find the solution (x, y).`,
    correctAnswer,
    distractors: nearbyWrongPoints(point, 3).map(fmtPoint),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateSolveByEliminationQuestion(
  difficulty: Difficulty,
): Unit6Question<'solve-by-elimination', EliminationParameters> {
  const point = randomPoint(difficulty)
  const eliminateVar = pick(['x', 'y'] as const)
  const combineOp = pick(['add', 'subtract'] as const)
  const coefficientLimit = difficulty === 1 ? 4 : difficulty === 2 ? 7 : 10
  const commonCoefficient = ri(1, coefficientLimit)

  let A1: number, B1: number, A2: number, B2: number
  if (eliminateVar === 'x') {
    A1 = commonCoefficient
    A2 = combineOp === 'add' ? -commonCoefficient : commonCoefficient
    B1 = ri(1, coefficientLimit)
    B2 = ri(1, coefficientLimit)
    while (B2 === B1) B2 = ri(1, coefficientLimit)
    B2 = pick([1, -1] as const) * B2
    B1 = pick([1, -1] as const) * B1
  } else {
    B1 = commonCoefficient
    B2 = combineOp === 'add' ? -commonCoefficient : commonCoefficient
    A1 = ri(1, coefficientLimit)
    A2 = ri(1, coefficientLimit)
    while (A2 === A1) A2 = ri(1, coefficientLimit)
    A1 = pick([1, -1] as const) * A1
    A2 = pick([1, -1] as const) * A2
  }
  while (A1 * B2 - A2 * B1 === 0) {
    if (eliminateVar === 'x') {
      B1 = pick([1, -1] as const) * ri(1, coefficientLimit)
      B2 = pick([1, -1] as const) * ri(1, coefficientLimit)
    } else {
      A1 = pick([1, -1] as const) * ri(1, coefficientLimit)
      A2 = pick([1, -1] as const) * ri(1, coefficientLimit)
    }
  }
  const C1 = A1 * point.x + B1 * point.y
  const C2 = A2 * point.x + B2 * point.y
  const parameters: EliminationParameters = { A1, B1, C1, A2, B2, C2 }
  const correctAnswer = fmtPoint(point)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['solve-by-elimination']
  return makeCurriculumQuestion({
    itemType: 'solve-by-elimination',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve the system:\n${fmtStandardForm(A1, B1, C1)}\n${fmtStandardForm(A2, B2, C2)}\nUse elimination to find the solution (x, y).`,
    correctAnswer,
    distractors: nearbyWrongPoints(point, 3).map(fmtPoint),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateClassifySolutionCountQuestion(
  difficulty: Difficulty,
): Unit6Question<'classify-solution-count', ClassifyParameters> {
  const target = pick(['one', 'no', 'infinite'] as const)
  const m1 = randomSlope(difficulty)
  const b1 = randomIntercept(difficulty)
  let m2: number
  let b2: number
  if (target === 'one') {
    m2 = distinctSlope(m1, difficulty)
    b2 = randomIntercept(difficulty)
  } else if (target === 'no') {
    m2 = m1
    b2 = randomIntercept(difficulty)
    while (b2 === b1) b2 = randomIntercept(difficulty)
  } else {
    m2 = m1
    b2 = b1
  }
  const parameters: ClassifyParameters = { m1, b1, m2, b2 }
  const correctAnswer = target === 'one' ? 'one solution' : target === 'no' ? 'no solution' : 'infinitely many solutions'
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['classify-solution-count']
  return makeCurriculumQuestion({
    itemType: 'classify-solution-count',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Classify the system: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. Does it have one solution, no solution, or infinitely many solutions?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, ['one solution', 'no solution', 'infinitely many solutions']),
    parameters,
    workedExample: definition.workedExample,
    choiceCount: 3,
  })
}

function standardFromLine(m: number, b: number, k: number): EquationCandidate {
  return { A: -k * m, B: k, C: k * b }
}

function randomScale(): number {
  return pick([1, 2, 3, -1, -2] as const)
}

/** True when `candidate`, simplified, is the same line as y = m x + b (any nonzero scale). */
function isScaledMultipleOfLine(candidate: EquationCandidate, m: number, b: number): boolean {
  return candidate.A === -m * candidate.B && candidate.C === candidate.B * b
}

export function generateIdentifyEquivalentOrInconsistentEquationQuestion(
  difficulty: Difficulty,
): Unit6Question<'identify-equivalent-or-inconsistent-equation', EquivalentOrInconsistentParameters> {
  const m0 = randomSlope(difficulty)
  const b0 = randomIntercept(difficulty)
  const mode = pick(['no-solution', 'infinite'] as const)

  const deltaLimit = difficulty === 1 ? 4 : difficulty === 2 ? 8 : 14
  const delta = pick([1, -1] as const) * ri(1, deltaLimit)
  const parallelDistinct = standardFromLine(m0, b0 + delta, randomScale())
  const equivalentScaled = standardFromLine(m0, b0, randomScale())

  const m2a = distinctSlope(m0, difficulty)
  const diffSlopeA = standardFromLine(m2a, randomIntercept(difficulty), randomScale())

  let m2b = distinctSlope(m0, difficulty)
  while (m2b === m2a) m2b = distinctSlope(m0, difficulty)
  const diffSlopeB = standardFromLine(m2b, randomIntercept(difficulty), randomScale())

  // `equivalentScaled` represents the reference line itself (any scale), so it may only ever
  // appear as the CORRECT answer (mode === 'infinite'). As a distractor it would be a case of
  // "infinitely many solutions" masquerading as a wrong answer to a "no solution" question, which
  // a correctly-reasoning learner could reject for the right reason and still be marked wrong.
  let diffSlopeC = distinctSlope(m0, difficulty)
  while (diffSlopeC === m2a || diffSlopeC === m2b) diffSlopeC = distinctSlope(m0, difficulty)
  const fourthCandidate =
    mode === 'infinite' ? equivalentScaled : standardFromLine(diffSlopeC, randomIntercept(difficulty), randomScale())

  const candidates: readonly [EquationCandidate, EquationCandidate, EquationCandidate, EquationCandidate] = [
    parallelDistinct,
    fourthCandidate,
    diffSlopeA,
    diffSlopeB,
  ]
  const parameters: EquivalentOrInconsistentParameters = { m0, b0, mode, candidates }
  const correct = mode === 'no-solution' ? parallelDistinct : equivalentScaled
  const correctAnswer = fmtStandardForm(correct.A, correct.B, correct.C)
  const distractors = candidates.filter((c) => c !== correct).map((c) => fmtStandardForm(c.A, c.B, c.C))
  for (const c of candidates) {
    if (c !== correct && isScaledMultipleOfLine(c, m0, b0)) {
      throw new Error('A distractor rendered as the same line as the reference equation.')
    }
  }
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['identify-equivalent-or-inconsistent-equation']
  return makeCurriculumQuestion({
    itemType: 'identify-equivalent-or-inconsistent-equation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `The reference equation is ${fmtSlopeIntercept(m0, b0)}. Which of these equations, paired with the reference, would give the system ${mode === 'no-solution' ? 'no solution' : 'infinitely many solutions'}?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, distractors),
    parameters,
    workedExample: definition.workedExample,
  })
}

function unitPlural(unit: ContextUnit): string {
  return unit === 'month' ? 'months' : unit === 'week' ? 'weeks' : 'visits'
}

function unitForCount(unit: ContextUnit, count: number): string {
  return count === 1 ? unit : unitPlural(unit)
}

function buildContextParameters(difficulty: Difficulty): ContextParameters {
  const unit = pick(['month', 'week', 'visit'] as const)
  const xLimit = difficulty === 1 ? 8 : difficulty === 2 ? 14 : 20
  const rateLimit = difficulty === 1 ? 5 : difficulty === 2 ? 9 : 14
  const feeLimit = difficulty === 1 ? 30 : difficulty === 2 ? 60 : 120
  for (let attempt = 0; attempt < 50; attempt++) {
    const x0 = ri(1, xLimit)
    const rateA = ri(1, rateLimit)
    let rateB = ri(1, rateLimit)
    while (rateB === rateA) rateB = ri(1, rateLimit)
    const feeA = ri(0, feeLimit)
    const y0 = feeA + rateA * x0
    const feeB = y0 - rateB * x0
    if (feeB >= 0 && feeB <= feeLimit * 2) {
      return { feeA, rateA, feeB, rateB, x0, y0, unit }
    }
  }
  const x0 = 2
  const rateA = 3
  const rateB = 5
  const feeA = 10
  const y0 = feeA + rateA * x0
  const feeB = y0 - rateB * x0
  return { feeA, rateA, feeB, rateB, x0, y0, unit }
}

function contextIntro(parameters: ContextParameters): string {
  const unitLabel = parameters.unit
  return `Plan A charges a $${parameters.feeA} flat fee plus $${parameters.rateA} per ${unitLabel}. Plan B charges a $${parameters.feeB} flat fee plus $${parameters.rateB} per ${unitLabel}.`
}

export function generateSystemFromContextSolveQuestion(
  difficulty: Difficulty,
): Unit6Question<'system-from-context-solve', ContextParameters> {
  const parameters = buildContextParameters(difficulty)
  const point = { x: parameters.x0, y: parameters.y0 }
  const correctAnswer = fmtPoint(point)
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['system-from-context-solve']
  return makeCurriculumQuestion({
    itemType: 'system-from-context-solve',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${contextIntro(parameters)} After how many ${unitPlural(parameters.unit)} do the two plans cost the same, and what is that cost?`,
    correctAnswer,
    distractors: nearbyWrongPoints(point, 3).map(fmtPoint),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateInterpretContextSolutionQuestion(
  difficulty: Difficulty,
): Unit6Question<'interpret-context-solution', ContextParameters> {
  const parameters = buildContextParameters(difficulty)
  const { x0, y0, unit } = parameters
  const correctAnswer = `After ${x0} ${unitForCount(unit, x0)}, both plans cost $${y0}.`
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['interpret-context-solution']
  return makeCurriculumQuestion({
    itemType: 'interpret-context-solution',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${contextIntro(parameters)} The solution to the system is (${x0}, ${y0}). What does this solution represent?`,
    correctAnswer,
    distractors: [
      `After ${y0} ${unitForCount(unit, y0)}, both plans cost $${x0}.`,
      `Plan A costs $${y0} more than Plan B after ${x0} ${unitForCount(unit, x0)}.`,
      `After ${x0 + 1} ${unitForCount(unit, x0 + 1)}, both plans cost $${y0}.`,
    ],
    parameters,
    workedExample: definition.workedExample,
  })
}

function pickFailBothPoint(m1: number, b1: number, m2: number, b2: number, x0: number): Point {
  const xp = x0 + 1
  let offset = 1
  let yp = m1 * xp + b1 + offset
  while (yp === m2 * xp + b2) {
    offset++
    yp = m1 * xp + b1 + offset
  }
  return { x: xp, y: yp }
}

export function generateCheckSolutionAgainstSystemQuestion(
  difficulty: Difficulty,
): Unit6Question<'check-solution-against-system', CheckSolutionParameters> {
  const intersection = randomPoint(difficulty)
  const m1 = randomSlope(difficulty)
  const m2 = distinctSlope(m1, difficulty)
  const b1 = lineFromPoint(intersection, m1)
  const b2 = lineFromPoint(intersection, m2)
  const category = pick(['both', 'fails-second', 'fails-first', 'fails-both'] as const)
  const xp = intersection.x + 1
  let point: Point
  if (category === 'both') point = intersection
  else if (category === 'fails-second') point = { x: xp, y: m1 * xp + b1 }
  else if (category === 'fails-first') point = { x: xp, y: m2 * xp + b2 }
  else point = pickFailBothPoint(m1, b1, m2, b2, intersection.x)
  const parameters: CheckSolutionParameters = { m1, b1, m2, b2, point }
  const correctAnswer =
    category === 'both'
      ? 'satisfies both equations'
      : category === 'fails-second'
        ? 'fails the second equation only'
        : category === 'fails-first'
          ? 'fails the first equation only'
          : 'fails both equations'
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['check-solution-against-system']
  return makeCurriculumQuestion({
    itemType: 'check-solution-against-system',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `System: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. Does the point (${point.x}, ${point.y}) satisfy both equations, fail one, or fail both?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      'satisfies both equations',
      'fails the first equation only',
      'fails the second equation only',
      'fails both equations',
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateInterpretSolutionMeaningQuestion(
  difficulty: Difficulty,
): Unit6Question<'interpret-solution-meaning', InterpretCoordinateParameters> {
  const context = buildContextParameters(difficulty)
  const coordinateAsked = pick(['x', 'y'] as const)
  const parameters: InterpretCoordinateParameters = { ...context, coordinateAsked }
  const { x0, y0, unit } = context
  const correctAnswer =
    coordinateAsked === 'x'
      ? `The number of ${unitPlural(unit)} after which the two plans cost the same.`
      : `The shared cost, in dollars, when the two plans are equal.`
  const distractors =
    coordinateAsked === 'x'
      ? [
          `The shared cost, in dollars, when the two plans are equal.`,
          `The difference in cost between the two plans.`,
          `The flat fee charged by Plan A.`,
        ]
      : [
          `The number of ${unitPlural(unit)} after which the two plans cost the same.`,
          `The difference in cost between the two plans.`,
          `The rate Plan B charges per ${unit}.`,
        ]
  const definition = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS['interpret-solution-meaning']
  return makeCurriculumQuestion({
    itemType: 'interpret-solution-meaning',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${contextIntro(context)} The solution to the system is (${x0}, ${y0}). What does the ${coordinateAsked === 'x' ? 'x-coordinate' : 'y-coordinate'} of the solution represent?`,
    correctAnswer,
    distractors,
    parameters,
    workedExample: definition.workedExample,
  })
}

export const GRADE8_MATH_UNIT6_GENERATORS = {
  'verify-solution-of-system': generateVerifySolutionOfSystemQuestion,
  'solve-system-for-intersection-point': generateSolveSystemForIntersectionPointQuestion,
  'intersection-from-two-tables': generateIntersectionFromTwoTablesQuestion,
  'identify-quadrant-of-intersection': generateIdentifyQuadrantOfIntersectionQuestion,
  'solve-by-substitution': generateSolveBySubstitutionQuestion,
  'solve-by-elimination': generateSolveByEliminationQuestion,
  'classify-solution-count': generateClassifySolutionCountQuestion,
  'identify-equivalent-or-inconsistent-equation': generateIdentifyEquivalentOrInconsistentEquationQuestion,
  'system-from-context-solve': generateSystemFromContextSolveQuestion,
  'interpret-context-solution': generateInterpretContextSolutionQuestion,
  'check-solution-against-system': generateCheckSolutionAgainstSystemQuestion,
  'interpret-solution-meaning': generateInterpretSolutionMeaningQuestion,
} satisfies Record<Grade8MathUnit6ItemType, CurriculumGenerator<Grade8MathUnit6Question>>

export function generateGrade8MathUnit6Question<TItemType extends Grade8MathUnit6ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade8MathUnit6Question, { itemType: TItemType }> {
  const generator = GRADE8_MATH_UNIT6_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade8MathUnit6Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
