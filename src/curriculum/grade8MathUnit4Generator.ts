import type { Difficulty } from '../types'
import { gcd, pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/** Coverage contract derived from Unit 4, all 18 lesson records, and 8.EE.5/8.EE.6. */
export const GRADE8_MATH_UNIT4_ITEM_TYPES = [
  'slope-from-two-points',
  'slope-from-table',
  'similar-triangle-point-on-line',
  'slope-triangle-legs',
  'write-slope-intercept-equation',
  'identify-slope-and-intercept',
  'compare-proportional-relationships',
  'evaluate-linear-equation-at-x',
  'identify-parallel-lines',
  'parallel-line-through-point',
  'interpret-slope-in-context',
  'interpret-y-intercept-in-context',
] as const

export type Grade8MathUnit4ItemType = (typeof GRADE8_MATH_UNIT4_ITEM_TYPES)[number]

interface TwoPointsParameters {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface SlopeTableParameters {
  x0: number
  y0: number
  xStep: number
  rowStep: number
  rowCount: 3 | 4
}

interface SimilarTrianglePointParameters {
  x0: number
  y0: number
  p: number
  q: number
  t: number
}

interface SlopeTriangleLegsParameters {
  p: number
  q: number
  given: 'run' | 'rise'
  givenLeg: number
}

interface SlopeInterceptEquationParameters {
  mode: 'slope-intercept' | 'two-points'
  p: number
  q: number
  b: number
  x1: number
  y1: number
  x2: number
  y2: number
}

interface IdentifySlopeInterceptParameters {
  form: 'slope-intercept' | 'standard'
  p: number
  q: number
  b: number
}

interface CompareProportionalParameters {
  pA: number
  qA: number
  pB: number
  qB: number
  aIsEquation: boolean
  askMode: 'which-greater' | 'difference'
}

interface EvaluateLinearParameters {
  p: number
  q: number
  b: number
  x: number
}

interface ParallelLinesParameters {
  p: number
  q: number
  b: number
  correctB: number
  p2: number
  q2: number
  b2: number
  p3: number
  q3: number
  b3: number
}

interface ParallelThroughPointParameters {
  p: number
  q: number
  b: number
  x0: number
  y0: number
  newB: number
}

interface ContextSlopeParameters {
  contextIndex: 0 | 1 | 2 | 3
  rate: number
  fee: number
}

type Unit4Question<TItemType extends Grade8MathUnit4ItemType, TParameters> = CurriculumQuestion<TItemType, TParameters>

export type Grade8MathUnit4Question =
  | Unit4Question<'slope-from-two-points', TwoPointsParameters>
  | Unit4Question<'slope-from-table', SlopeTableParameters>
  | Unit4Question<'similar-triangle-point-on-line', SimilarTrianglePointParameters>
  | Unit4Question<'slope-triangle-legs', SlopeTriangleLegsParameters>
  | Unit4Question<'write-slope-intercept-equation', SlopeInterceptEquationParameters>
  | Unit4Question<'identify-slope-and-intercept', IdentifySlopeInterceptParameters>
  | Unit4Question<'compare-proportional-relationships', CompareProportionalParameters>
  | Unit4Question<'evaluate-linear-equation-at-x', EvaluateLinearParameters>
  | Unit4Question<'identify-parallel-lines', ParallelLinesParameters>
  | Unit4Question<'parallel-line-through-point', ParallelThroughPointParameters>
  | Unit4Question<'interpret-slope-in-context', ContextSlopeParameters>
  | Unit4Question<'interpret-y-intercept-in-context', ContextSlopeParameters>

interface ItemDefinition {
  standard: '8.EE.5' | '8.EE.6'
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

export const GRADE8_MATH_UNIT4_ITEM_DEFINITIONS = {
  'slope-from-two-points': {
    standard: '8.EE.5',
    lessonFocus: 'slope as rate of change',
    workedExample: {
      prompt: 'Find the slope of the line through (2, 3) and (6, 11).',
      answer: '2',
      steps: [
        'The change in y is 11 - 3 = 8.',
        'The change in x is 6 - 2 = 4.',
        'Slope = rise/run = 8/4 = 2.',
      ],
    },
  },
  'slope-from-table': {
    standard: '8.EE.5',
    lessonFocus: 'slope as rate of change',
    workedExample: {
      prompt: 'A line passes through these points:\nx: 1, 3, 5\ny: 4, 10, 16\nWhat is the slope (rate of change) of the line?',
      answer: '3',
      steps: [
        'From x = 1 to x = 3, y changes from 4 to 10, a change of 6 over 2.',
        'Rate of change = 6/2 = 3.',
        'Check the next interval: 16 - 10 = 6 over 5 - 3 = 2, also 3.',
      ],
    },
  },
  'similar-triangle-point-on-line': {
    standard: '8.EE.6',
    lessonFocus: 'similar triangles and slope',
    workedExample: {
      prompt:
        'A line passes through (1, 2). A slope triangle on the line has a horizontal leg (run) of 3 and a vertical leg (rise) of 2. A similar slope triangle further along the same line is 2 times as large. Which point also lies on the line?',
      answer: '(7, 6)',
      steps: [
        'The base slope triangle shows a slope of 2/3.',
        'Scaling the triangle by 2 gives a run of 6 and a rise of 4 from (1, 2).',
        'The new point is (1 + 6, 2 + 4) = (7, 6).',
      ],
    },
  },
  'slope-triangle-legs': {
    standard: '8.EE.6',
    lessonFocus: 'similar triangles and slope',
    workedExample: {
      prompt: 'A line has a slope of 3/4. A right triangle drawn along the line has a horizontal leg (run) of 12 units. What is the length of the vertical leg (rise)?',
      answer: '9',
      steps: [
        'Slope = rise/run, so rise = slope × run.',
        'rise = (3/4) × 12 = 9.',
        'The vertical leg is 9 units long.',
      ],
    },
  },
  'write-slope-intercept-equation': {
    standard: '8.EE.6',
    lessonFocus: 'slope-intercept form',
    workedExample: {
      prompt: 'Write the equation, in slope-intercept form, of a line with slope -2 and y-intercept 5.',
      answer: 'y = -2x + 5',
      steps: [
        'Slope-intercept form is y = mx + b.',
        'Substitute m = -2 and b = 5.',
        'The equation is y = -2x + 5.',
      ],
    },
  },
  'identify-slope-and-intercept': {
    standard: '8.EE.6',
    lessonFocus: 'slope-intercept form',
    workedExample: {
      prompt: 'Identify the slope and y-intercept of the line y = -3x + 7.',
      answer: 'slope = -3, y-intercept = 7',
      steps: [
        'In y = mx + b, m is the slope and b is the y-intercept.',
        'Here m = -3 and b = 7.',
        'So the slope is -3 and the y-intercept is 7.',
      ],
    },
  },
  'compare-proportional-relationships': {
    standard: '8.EE.5',
    lessonFocus: 'graphs tables and equations',
    workedExample: {
      prompt:
        'Relationship A: y = (2/3)x\nRelationship B (proportional):\nx: 4, 8, 12\ny: 5, 10, 15\nWhich relationship has the greater rate of change (unit rate)?',
      answer: 'Relationship B',
      steps: [
        'Relationship A has a rate of change of 2/3.',
        'Relationship B has a rate of change of 5/4 (since 5 ÷ 4 = 5/4).',
        '5/4 is greater than 2/3, so Relationship B has the greater rate.',
      ],
    },
  },
  'evaluate-linear-equation-at-x': {
    standard: '8.EE.6',
    lessonFocus: 'graphs tables and equations',
    workedExample: {
      prompt: 'For the line y = 4x - 3, find y when x = 5.',
      answer: '17',
      steps: ['Substitute x = 5 into y = 4x - 3.', 'y = 4(5) - 3 = 20 - 3.', 'y = 17.'],
    },
  },
  'identify-parallel-lines': {
    standard: '8.EE.6',
    lessonFocus: 'parallel-line reasoning',
    workedExample: {
      prompt: 'A line has equation y = 2x - 1. Which of these equations represents a line parallel to it?',
      answer: 'y = 2x + 4',
      steps: [
        'Parallel lines have the same slope but different y-intercepts.',
        'y = 2x + 4 has slope 2, the same as y = 2x - 1, but a different intercept.',
        'So y = 2x + 4 is parallel to the given line.',
      ],
    },
  },
  'parallel-line-through-point': {
    standard: '8.EE.6',
    lessonFocus: 'parallel-line reasoning',
    workedExample: {
      prompt: 'A line has equation y = 2x + 1. Write the equation of the line through (3, 4) that is parallel to this line.',
      answer: 'y = 2x - 2',
      steps: [
        'A parallel line has the same slope, 2.',
        'Use y = 2x + b and the point (3, 4): 4 = 2(3) + b.',
        '4 = 6 + b, so b = -2, giving y = 2x - 2.',
      ],
    },
  },
  'interpret-slope-in-context': {
    standard: '8.EE.5',
    lessonFocus: 'interpreting intercepts',
    workedExample: {
      prompt:
        "A moving company's total cost is given by C = 40h + 75, where C is the total cost in dollars and h is the number of hours of labor. What does the slope represent in this context?",
      answer: 'The company charges $40 for each additional hour of labor.',
      steps: [
        'The slope is the coefficient of h, which is 40.',
        'The slope is the rate of change of cost per hour.',
        'So the company charges $40 for each additional hour of labor.',
      ],
    },
  },
  'interpret-y-intercept-in-context': {
    standard: '8.EE.6',
    lessonFocus: 'interpreting intercepts',
    workedExample: {
      prompt:
        "A moving company's total cost is given by C = 40h + 75, where C is the total cost in dollars and h is the number of hours of labor. What does the y-intercept represent in this context?",
      answer: 'The company charges a flat fee of $75 before any labor hours.',
      steps: [
        'The y-intercept is the constant term, 75.',
        'It represents the cost when h = 0, before any hours of labor.',
        'So the company charges a flat fee of $75 before any labor hours.',
      ],
    },
  },
} as const satisfies Record<Grade8MathUnit4ItemType, ItemDefinition>

const uniqueExcept = (correct: string, candidates: readonly string[]): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

function reduceSignedFraction(numerator: number, denominator: number): { numerator: number; denominator: number } {
  const sign = denominator < 0 ? -1 : 1
  const n = sign * numerator
  const d = sign * denominator
  const g = gcd(n, d) || 1
  return { numerator: n / g, denominator: d / g }
}

function formatSignedFraction(numerator: number, denominator: number): string {
  const { numerator: n, denominator: d } = reduceSignedFraction(numerator, denominator)
  return d === 1 ? String(n) : `${n}/${d}`
}

function formatLinearCoefficient(coefficient: number): string {
  return coefficient === 1 ? 'x' : coefficient === -1 ? '-x' : `${coefficient}x`
}

function formatSlopeIntercept(p: number, q: number, b: number): string {
  const slopeTerm = q === 1 ? formatLinearCoefficient(p) : `(${formatSignedFraction(p, q)})x`
  const interceptTerm = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`
  return `y = ${slopeTerm}${interceptTerm}`
}

function randomReducedSlope(pMax: number, qMax: number): { p: number; q: number } {
  let p = 0
  let q = 1
  do {
    q = ri(1, qMax)
    p = ri(1, pMax) * pick([1, -1] as const)
  } while (gcd(Math.abs(p), q) !== 1)
  return { p, q }
}

// ---------- 1: slope-from-two-points ----------

function randomTwoPointsParameters(difficulty: Difficulty): TwoPointsParameters {
  const pMax = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 5 : 9
  const { p, q } = randomReducedSlope(pMax, qMax)
  const kMax = difficulty === 1 ? 4 : difficulty === 2 ? 4 : 6
  const k = ri(1, kMax)
  const flip = pick([1, -1] as const)
  const dx = q * k * flip
  const dy = p * k * flip
  const coordRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 25
  const x1 = ri(-coordRange, coordRange)
  const y1 = ri(-coordRange, coordRange)
  return { x1, y1, x2: x1 + dx, y2: y1 + dy }
}

export function generateSlopeFromTwoPointsQuestion(
  difficulty: Difficulty,
): Unit4Question<'slope-from-two-points', TwoPointsParameters> {
  const parameters = randomTwoPointsParameters(difficulty)
  const { x1, y1, x2, y2 } = parameters
  const correctAnswer = formatSignedFraction(y2 - y1, x2 - x1)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['slope-from-two-points']
  return makeCurriculumQuestion({
    itemType: 'slope-from-two-points',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      x2 - x1 < 0 ? `${-(y2 - y1)}/${-(x2 - x1)}` : `${y2 - y1}/${x2 - x1}`,
      formatSignedFraction(x2 - x1, y2 - y1),
      formatSignedFraction(-(y2 - y1), x2 - x1),
      formatSignedFraction(y2 - y1 + 1, x2 - x1),
      formatSignedFraction(y2 - y1, x2 - x1 + 1),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 2: slope-from-table ----------

function randomSlopeTableParameters(difficulty: Difficulty): SlopeTableParameters {
  const pMax = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 5 : 8
  const { p, q } = randomReducedSlope(pMax, qMax)
  const rowCount: 3 | 4 = pick([3, 4] as const)
  const coordRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20
  const x0 = ri(-coordRange, coordRange)
  const y0 = ri(-coordRange, coordRange)
  return { x0, y0, xStep: q, rowStep: p, rowCount }
}

function tableRowsText(parameters: SlopeTableParameters): string {
  const { x0, y0, xStep, rowStep, rowCount } = parameters
  const xs = Array.from({ length: rowCount }, (_, i) => x0 + i * xStep).join(', ')
  const ys = Array.from({ length: rowCount }, (_, i) => y0 + i * rowStep).join(', ')
  return `x: ${xs}\ny: ${ys}`
}

export function generateSlopeFromTableQuestion(
  difficulty: Difficulty,
): Unit4Question<'slope-from-table', SlopeTableParameters> {
  const parameters = randomSlopeTableParameters(difficulty)
  const { xStep, rowStep, rowCount } = parameters
  const correctAnswer = formatSignedFraction(rowStep, xStep)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['slope-from-table']
  return makeCurriculumQuestion({
    itemType: 'slope-from-table',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A line passes through these points:\n${tableRowsText(parameters)}\nWhat is the slope (rate of change) of the line?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatSignedFraction(xStep, rowStep),
      formatSignedFraction(-rowStep, xStep),
      `${rowStep}/${xStep}`,
      formatSignedFraction(rowStep, rowCount - 1),
      formatSignedFraction(rowStep * (rowCount - 1), xStep),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 3: similar-triangle-point-on-line ----------

function randomSimilarTrianglePointParameters(difficulty: Difficulty): SimilarTrianglePointParameters {
  const pMax = difficulty === 1 ? 6 : difficulty === 2 ? 8 : 10
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 5 : 8
  const { p, q } = randomReducedSlope(pMax, qMax)
  const t = ri(2, difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5)
  const coordRange = difficulty === 1 ? 8 : difficulty === 2 ? 12 : 18
  const x0 = ri(-coordRange, coordRange)
  const y0 = ri(-coordRange, coordRange)
  return { x0, y0, p, q, t }
}

export function generateSimilarTrianglePointOnLineQuestion(
  difficulty: Difficulty,
): Unit4Question<'similar-triangle-point-on-line', SimilarTrianglePointParameters> {
  const parameters = randomSimilarTrianglePointParameters(difficulty)
  const { x0, y0, p, q, t } = parameters
  const correctX = x0 + q * t
  const correctY = y0 + p * t
  const correctAnswer = `(${correctX}, ${correctY})`
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['similar-triangle-point-on-line']
  return makeCurriculumQuestion({
    itemType: 'similar-triangle-point-on-line',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A line passes through (${x0}, ${y0}). A slope triangle on the line has a horizontal leg (run) of ${q} and a vertical leg (rise) of ${p}. A similar slope triangle further along the same line is ${t} times as large. Which point also lies on the line?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `(${correctX}, ${correctY + 1})`,
      `(${correctX + 1}, ${correctY})`,
      `(${correctX}, ${correctY - 1})`,
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 4: slope-triangle-legs ----------

function randomSlopeTriangleLegsParameters(difficulty: Difficulty): SlopeTriangleLegsParameters {
  const pMax = difficulty === 1 ? 8 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 6 : 9
  const { p, q } = randomReducedSlope(pMax, qMax)
  const given: 'run' | 'rise' = pick(['run', 'rise'] as const)
  const givenDenominator = given === 'run' ? q : Math.abs(p)
  let givenLeg: number
  if (difficulty === 1) {
    givenLeg = givenDenominator * ri(1, 6)
  } else {
    givenLeg = ri(1, difficulty === 2 ? 30 : 60)
    if (givenLeg % givenDenominator === 0) givenLeg += 1
  }
  return { p, q, given, givenLeg }
}

export function generateSlopeTriangleLegsQuestion(
  difficulty: Difficulty,
): Unit4Question<'slope-triangle-legs', SlopeTriangleLegsParameters> {
  const parameters = randomSlopeTriangleLegsParameters(difficulty)
  const { p, q, given, givenLeg } = parameters
  const numer = given === 'run' ? Math.abs(p) : q
  const denom = given === 'run' ? q : Math.abs(p)
  const correctAnswer = formatSignedFraction(numer * givenLeg, denom)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['slope-triangle-legs']
  return makeCurriculumQuestion({
    itemType: 'slope-triangle-legs',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A line has a slope of ${formatSignedFraction(p, q)}. A right triangle drawn along the line has a ${given === 'run' ? 'horizontal leg (run)' : 'vertical leg (rise)'} of ${givenLeg} units. What is the length of the other leg?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatSignedFraction(denom * givenLeg, numer),
      formatSignedFraction(numer * (givenLeg + 1), denom),
      String(givenLeg),
      formatSignedFraction(numer * givenLeg, denom + 1),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 5: write-slope-intercept-equation ----------

function randomSlopeInterceptEquationParameters(difficulty: Difficulty): SlopeInterceptEquationParameters {
  const pMax = difficulty === 1 ? 8 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 3 : 5
  const { p, q } = randomReducedSlope(pMax, qMax)
  const bRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20
  const b = ri(-bRange, bRange)
  const mode: 'slope-intercept' | 'two-points' = pick(['slope-intercept', 'two-points'] as const)
  let k = 0
  while (k === 0) k = ri(-6, 6)
  const x1 = q * k
  const y1 = b + p * k
  return { mode, p, q, b, x1, y1, x2: x1 + q, y2: y1 + p }
}

export function generateWriteSlopeInterceptEquationQuestion(
  difficulty: Difficulty,
): Unit4Question<'write-slope-intercept-equation', SlopeInterceptEquationParameters> {
  const parameters = randomSlopeInterceptEquationParameters(difficulty)
  const { mode, p, q, b, x1, y1, x2, y2 } = parameters
  const correctAnswer = formatSlopeIntercept(p, q, b)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['write-slope-intercept-equation']
  // d1-d3 are guaranteed distinct from the correct answer AND from each other for any
  // p (nonzero), q (positive), b — including the degenerate b === 0 / |p| === 1 edge
  // cases where sign-flip-only distractors would otherwise collapse into each other.
  const d1 = formatSlopeIntercept(-p, q, b)
  const d2 = formatSlopeIntercept(p, q, b + 1)
  const d3 = formatSlopeIntercept(p, q, b - 1)
  const d4 =
    q === 1
      ? `y = ${p === 1 ? '1x' : p === -1 ? '-1x' : `${p}x`}${b === 0 ? ' + 0' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`}`
      : `y = ${p}/${q}x${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`}`
  return makeCurriculumQuestion({
    itemType: 'write-slope-intercept-equation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt:
      mode === 'slope-intercept'
        ? `Write the equation, in slope-intercept form, of a line with slope ${formatSignedFraction(p, q)} and y-intercept ${b}.`
        : `Write the equation, in slope-intercept form, of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [d1, d2, d3, d4]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 6: identify-slope-and-intercept ----------

function randomIdentifySlopeInterceptParameters(difficulty: Difficulty): IdentifySlopeInterceptParameters {
  const form: 'slope-intercept' | 'standard' = difficulty === 3 && ri(0, 1) === 0 ? 'standard' : 'slope-intercept'
  const qMax = form === 'standard' ? 1 : difficulty === 1 ? 1 : difficulty === 2 ? 4 : 6
  const pMax = difficulty === 1 ? 9 : difficulty === 2 ? 9 : 12
  const { p, q } = randomReducedSlope(pMax, qMax)
  const bRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20
  const b = ri(-bRange, bRange)
  return { form, p, q, b }
}

export function generateIdentifySlopeAndInterceptQuestion(
  difficulty: Difficulty,
): Unit4Question<'identify-slope-and-intercept', IdentifySlopeInterceptParameters> {
  const parameters = randomIdentifySlopeInterceptParameters(difficulty)
  const { form, p, q, b } = parameters
  const equationText =
    form === 'slope-intercept' ? formatSlopeIntercept(p, q, b) : `${formatLinearCoefficient(-p)} + y = ${b}`
  const correctAnswer = `slope = ${formatSignedFraction(p, q)}, y-intercept = ${b}`
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['identify-slope-and-intercept']
  return makeCurriculumQuestion({
    itemType: 'identify-slope-and-intercept',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt:
      form === 'slope-intercept'
        ? `Identify the slope and y-intercept of the line ${equationText}.`
        : `Identify the slope and y-intercept of the line ${equationText}. Rearrange into slope-intercept form first.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `slope = ${b}, y-intercept = ${formatSignedFraction(p, q)}`,
      `slope = ${formatSignedFraction(-p, q)}, y-intercept = ${b}`,
      `slope = ${formatSignedFraction(p, q)}, y-intercept = ${-b}`,
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 7: compare-proportional-relationships ----------

function randomCompareProportionalParameters(difficulty: Difficulty): CompareProportionalParameters {
  const pMax = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 4 : 6
  const rawA = randomReducedSlope(pMax, qMax)
  const pA = Math.abs(rawA.p)
  const qA = rawA.q
  let rawB = randomReducedSlope(pMax, qMax)
  let pB = Math.abs(rawB.p)
  let qB = rawB.q
  while (pA * qB === pB * qA) {
    rawB = randomReducedSlope(pMax, qMax)
    pB = Math.abs(rawB.p)
    qB = rawB.q
  }
  return {
    pA,
    qA,
    pB,
    qB,
    aIsEquation: pick([true, false] as const),
    askMode: pick(['which-greater', 'difference'] as const),
  }
}

function proportionalEquationText(label: string, p: number, q: number): string {
  return `${label}: ${formatSlopeIntercept(p, q, 0)}`
}

function proportionalTableText(label: string, p: number, q: number): string {
  return `${label} (proportional):\nx: ${q}, ${2 * q}, ${3 * q}\ny: ${p}, ${2 * p}, ${3 * p}`
}

export function generateCompareProportionalRelationshipsQuestion(
  difficulty: Difficulty,
): Unit4Question<'compare-proportional-relationships', CompareProportionalParameters> {
  const parameters = randomCompareProportionalParameters(difficulty)
  const { pA, qA, pB, qB, aIsEquation, askMode } = parameters
  const aText = aIsEquation
    ? proportionalEquationText('Relationship A', pA, qA)
    : proportionalTableText('Relationship A', pA, qA)
  const bText = aIsEquation
    ? proportionalTableText('Relationship B', pB, qB)
    : proportionalEquationText('Relationship B', pB, qB)
  const crossA = pA * qB
  const crossB = pB * qA
  const question =
    askMode === 'which-greater'
      ? 'Which relationship has the greater rate of change (unit rate)?'
      : 'By how much does the greater rate of change exceed the lesser rate of change?'
  const correctAnswer =
    askMode === 'which-greater'
      ? crossA > crossB
        ? 'Relationship A'
        : 'Relationship B'
      : formatSignedFraction(Math.abs(crossA - crossB), qA * qB)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['compare-proportional-relationships']
  return makeCurriculumQuestion({
    itemType: 'compare-proportional-relationships',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${aText}\n${bText}\n${question}`,
    correctAnswer,
    distractors:
      askMode === 'which-greater'
        ? uniqueExcept(correctAnswer, [
            'Relationship A',
            'Relationship B',
            'They have the same rate of change.',
            'The rate of change cannot be determined from this information.',
          ])
        : uniqueExcept(correctAnswer, [
            formatSignedFraction(pA, qA),
            formatSignedFraction(pB, qB),
            formatSignedFraction(crossA + crossB, qA * qB),
            formatSignedFraction(Math.abs(crossA - crossB) + 1, qA * qB),
          ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 8: evaluate-linear-equation-at-x ----------

function randomEvaluateLinearParameters(difficulty: Difficulty): EvaluateLinearParameters {
  const pMax = difficulty === 1 ? 8 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 4 : 6
  const { p, q } = randomReducedSlope(pMax, qMax)
  const bRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20
  const b = ri(-bRange, bRange)
  const xRange = difficulty === 1 ? 10 : difficulty === 2 ? 12 : 15
  const x = ri(-xRange, xRange)
  return { p, q, b, x }
}

export function generateEvaluateLinearEquationAtXQuestion(
  difficulty: Difficulty,
): Unit4Question<'evaluate-linear-equation-at-x', EvaluateLinearParameters> {
  const parameters = randomEvaluateLinearParameters(difficulty)
  const { p, q, b, x } = parameters
  const correctAnswer = formatSignedFraction(p * x + b * q, q)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['evaluate-linear-equation-at-x']
  return makeCurriculumQuestion({
    itemType: 'evaluate-linear-equation-at-x',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `For the line ${formatSlopeIntercept(p, q, b)}, find y when x = ${x}.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatSignedFraction(p * x, q),
      String(p * x + b),
      formatSignedFraction(p * x - b * q, q),
      formatSignedFraction(-(p * x + b * q), q),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 9: identify-parallel-lines ----------

function randomIdentifyParallelLinesParameters(difficulty: Difficulty): ParallelLinesParameters {
  const pMax = difficulty === 1 ? 8 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 4 : 6
  const { p, q } = randomReducedSlope(pMax, qMax)
  const bRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20
  const b = ri(-bRange, bRange)
  let correctB = b
  while (correctB === b) correctB = ri(-bRange, bRange)

  function differentSlope(): { p: number; q: number } {
    let candidate = randomReducedSlope(pMax, qMax)
    while (candidate.p * q === p * candidate.q) candidate = randomReducedSlope(pMax, qMax)
    return candidate
  }
  const wrong2 = differentSlope()
  const wrong3 = differentSlope()
  return {
    p,
    q,
    b,
    correctB,
    p2: wrong2.p,
    q2: wrong2.q,
    b2: ri(-bRange, bRange),
    p3: wrong3.p,
    q3: wrong3.q,
    b3: ri(-bRange, bRange),
  }
}

export function generateIdentifyParallelLinesQuestion(
  difficulty: Difficulty,
): Unit4Question<'identify-parallel-lines', ParallelLinesParameters> {
  const parameters = randomIdentifyParallelLinesParameters(difficulty)
  const { p, q, b, correctB, p2, q2, b2, p3, q3, b3 } = parameters
  const correctAnswer = formatSlopeIntercept(p, q, correctB)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['identify-parallel-lines']
  return makeCurriculumQuestion({
    itemType: 'identify-parallel-lines',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A line has equation ${formatSlopeIntercept(p, q, b)}. Which of these equations represents a line parallel to it?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatSlopeIntercept(p, q, b),
      formatSlopeIntercept(p2, q2, b2),
      formatSlopeIntercept(p3, q3, b3),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 10: parallel-line-through-point ----------

function randomParallelThroughPointParameters(difficulty: Difficulty): ParallelThroughPointParameters {
  const pMax = difficulty === 1 ? 8 : difficulty === 2 ? 9 : 12
  const qMax = difficulty === 1 ? 1 : difficulty === 2 ? 4 : 6
  const { p, q } = randomReducedSlope(pMax, qMax)
  const bRange = difficulty === 1 ? 10 : difficulty === 2 ? 15 : 20
  const b = ri(-bRange, bRange)
  let k = 0
  while (k === 0) k = ri(-6, 6)
  let newB = b
  while (newB === b) newB = ri(-bRange, bRange)
  const x0 = q * k
  const y0 = newB + p * k
  return { p, q, b, x0, y0, newB }
}

export function generateParallelLineThroughPointQuestion(
  difficulty: Difficulty,
): Unit4Question<'parallel-line-through-point', ParallelThroughPointParameters> {
  const parameters = randomParallelThroughPointParameters(difficulty)
  const { p, q, b, x0, y0, newB } = parameters
  const correctAnswer = formatSlopeIntercept(p, q, newB)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['parallel-line-through-point']
  const k = (x0 - 0) / q
  return makeCurriculumQuestion({
    itemType: 'parallel-line-through-point',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A line has equation ${formatSlopeIntercept(p, q, b)}. Write the equation of the line through (${x0}, ${y0}) that is parallel to this line.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatSlopeIntercept(p, q, b),
      formatSlopeIntercept(-p, q, newB),
      formatSlopeIntercept(p, q, newB + 2 * p * k),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

// ---------- 11 & 12: interpret slope / y-intercept in context ----------

interface ContextTemplate {
  prompt: (rate: number, fee: number) => string
  slopeMeaning: (rate: number) => string
  interceptMeaning: (fee: number) => string
}

const GRADE8_MATH_UNIT4_CONTEXTS: readonly ContextTemplate[] = [
  {
    prompt: (rate, fee) =>
      `A moving company's total cost is given by C = ${rate}h + ${fee}, where C is the total cost in dollars and h is the number of hours of labor. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The company charges $${rate} for each additional hour of labor.`,
    interceptMeaning: (fee) => `The company charges a flat fee of $${fee} before any labor hours.`,
  },
  {
    prompt: (rate, fee) =>
      `A taxi fare is given by F = ${rate}m + ${fee}, where F is the total fare in dollars and m is the number of miles traveled. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The fare increases by $${rate} for each additional mile traveled.`,
    interceptMeaning: (fee) => `There is a base fare of $${fee} before any miles are traveled.`,
  },
  {
    prompt: (rate, fee) =>
      `A plant's height is given by H = ${rate}w + ${fee}, where H is the height in centimeters and w is the number of weeks since it was measured. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The plant grows ${rate} centimeters per week.`,
    interceptMeaning: (fee) => `The plant was ${fee} centimeters tall when it was first measured.`,
  },
  {
    prompt: (rate, fee) =>
      `The amount of water in a tank is given by G = ${rate}t + ${fee}, where G is the number of gallons in the tank and t is the number of minutes since filling started. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The tank fills at a rate of ${rate} gallons per minute.`,
    interceptMeaning: (fee) => `The tank already had ${fee} gallons of water before filling started.`,
  },
] as const

function interceptPrompt(context: ContextTemplate, rate: number, fee: number): string {
  return context.prompt(rate, fee).replace('What does the slope represent in this context?', 'What does the y-intercept represent in this context?')
}

function randomContextSlopeParameters(difficulty: Difficulty): ContextSlopeParameters {
  const range = difficulty === 1 ? 9 : difficulty === 2 ? 15 : 25
  const contextIndex = ri(0, 3) as 0 | 1 | 2 | 3
  const rate = ri(1, range)
  let fee = ri(1, range)
  while (fee === rate) fee = ri(1, range)
  return { contextIndex, rate, fee }
}

export function generateInterpretSlopeInContextQuestion(
  difficulty: Difficulty,
): Unit4Question<'interpret-slope-in-context', ContextSlopeParameters> {
  const parameters = randomContextSlopeParameters(difficulty)
  const { contextIndex, rate, fee } = parameters
  const context = GRADE8_MATH_UNIT4_CONTEXTS[contextIndex]
  const correctAnswer = context.slopeMeaning(rate)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['interpret-slope-in-context']
  return makeCurriculumQuestion({
    itemType: 'interpret-slope-in-context',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: context.prompt(rate, fee),
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      context.interceptMeaning(fee),
      context.slopeMeaning(fee),
      context.interceptMeaning(rate),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateInterpretYInterceptInContextQuestion(
  difficulty: Difficulty,
): Unit4Question<'interpret-y-intercept-in-context', ContextSlopeParameters> {
  const parameters = randomContextSlopeParameters(difficulty)
  const { contextIndex, rate, fee } = parameters
  const context = GRADE8_MATH_UNIT4_CONTEXTS[contextIndex]
  const correctAnswer = context.interceptMeaning(fee)
  const definition = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS['interpret-y-intercept-in-context']
  return makeCurriculumQuestion({
    itemType: 'interpret-y-intercept-in-context',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: interceptPrompt(context, rate, fee),
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      context.slopeMeaning(rate),
      context.interceptMeaning(rate),
      context.slopeMeaning(fee),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export const GRADE8_MATH_UNIT4_GENERATORS = {
  'slope-from-two-points': generateSlopeFromTwoPointsQuestion,
  'slope-from-table': generateSlopeFromTableQuestion,
  'similar-triangle-point-on-line': generateSimilarTrianglePointOnLineQuestion,
  'slope-triangle-legs': generateSlopeTriangleLegsQuestion,
  'write-slope-intercept-equation': generateWriteSlopeInterceptEquationQuestion,
  'identify-slope-and-intercept': generateIdentifySlopeAndInterceptQuestion,
  'compare-proportional-relationships': generateCompareProportionalRelationshipsQuestion,
  'evaluate-linear-equation-at-x': generateEvaluateLinearEquationAtXQuestion,
  'identify-parallel-lines': generateIdentifyParallelLinesQuestion,
  'parallel-line-through-point': generateParallelLineThroughPointQuestion,
  'interpret-slope-in-context': generateInterpretSlopeInContextQuestion,
  'interpret-y-intercept-in-context': generateInterpretYInterceptInContextQuestion,
} satisfies Record<Grade8MathUnit4ItemType, CurriculumGenerator<Grade8MathUnit4Question>>

export function generateGrade8MathUnit4Question<TItemType extends Grade8MathUnit4ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade8MathUnit4Question, { itemType: TItemType }> {
  const generator = GRADE8_MATH_UNIT4_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade8MathUnit4Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
