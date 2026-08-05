import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Unit 3, all 18 lesson records (course days
 * 37-54), and 8.EE.7, MP.1, and MP.3.
 */
export const GRADE8_MATH_UNIT3_ITEM_TYPES = [
  'solve-one-step-equation',
  'solve-two-step-equation',
  'solve-with-distributive-property',
  'solve-combining-like-terms',
  'solve-variables-both-sides',
  'classify-solution-type',
  'check-a-solution',
  'identify-solution-from-choices',
  'write-equation-from-context',
  'solve-word-problem',
  'equation-error-analysis',
  'solution-type-error-analysis',
] as const

export type Grade8MathUnit3ItemType =
  (typeof GRADE8_MATH_UNIT3_ITEM_TYPES)[number]

// ---------------------------------------------------------------------------
// Exact-arithmetic helpers. Every solution is an exact integer or a fully
// reduced fraction (sign carried on the numerator, denominator positive) --
// never a decimal approximation.
// ---------------------------------------------------------------------------

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

function formatSolution(numerator: number, denominator: number): string {
  let n = numerator
  let d = denominator
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d) || 1
  n /= g
  d /= g
  return d === 1 ? String(n) : `${n}/${d}`
}

/** Renders "a*x + b" naturally, e.g. (1,0) -> "x", (-1,-3) -> "-x - 3", (3,-4) -> "3x - 4". */
function renderLinearExpr(a: number, b: number): string {
  if (a === 0) return String(b)
  const coeffPart = a === 1 ? 'x' : a === -1 ? '-x' : `${a}x`
  if (b === 0) return coeffPart
  return `${coeffPart} ${b > 0 ? '+' : '-'} ${Math.abs(b)}`
}

/** Renders "p(x + q)" or "p(x - |q|)". */
function renderProductExpr(p: number, q: number): string {
  return q >= 0 ? `${p}(x + ${q})` : `${p}(x - ${Math.abs(q)})`
}

/** Renders "a1*x + a2*x + b", e.g. (5,-2,3) -> "5x - 2x + 3". */
function renderCombinedTerms(a1: number, a2: number, b: number): string {
  const term1 = a1 === 1 ? 'x' : a1 === -1 ? '-x' : `${a1}x`
  const absA2 = Math.abs(a2)
  const term2 = `${a2 >= 0 ? '+' : '-'} ${absA2 === 1 ? '' : absA2}x`
  const parts = [term1, term2]
  if (b !== 0) parts.push(`${b > 0 ? '+' : '-'} ${Math.abs(b)}`)
  return parts.join(' ')
}

function randomNonzero(min: number, max: number): number {
  let n = ri(min, max)
  while (n === 0) n = ri(min, max)
  return n
}

interface SolveOneStepParameters {
  mode: 'scale' | 'shift'
  a: number
  b: number
  c: number
}

interface SolveTwoStepParameters {
  a: number
  b: number
  c: number
}

interface SolveDistributiveParameters {
  p: number
  q: number
  c: number
}

interface SolveCombiningParameters {
  a1: number
  a2: number
  b: number
  c: number
}

interface SolveBothSidesParameters {
  a: number
  b: number
  c: number
  d: number
}

type SolutionType = 'one' | 'none' | 'infinite'

interface ClassifySolutionTypeParameters {
  a: number
  b: number
  c: number
  d: number
  solutionType: SolutionType
}

interface CheckASolutionParameters {
  a: number
  b: number
  c: number
  candidate: number
  isSolution: boolean
}

interface IdentifySolutionParameters {
  a: number
  b: number
  c: number
}

interface WriteEquationFromContextParameters {
  a: number
  b: number
  c: number
}

interface SolveWordProblemParameters {
  a: number
  b: number
  c: number
}

interface EquationErrorParameters {
  a: number
  b: number
  c: number
  claimed: number
}

interface SolutionTypeErrorParameters {
  a: number
  b: number
  d: number
  solutionType: 'none' | 'infinite'
}

type Unit3Question<
  TItemType extends Grade8MathUnit3ItemType,
  TParameters,
> = CurriculumQuestion<TItemType, TParameters>

export type Grade8MathUnit3Question =
  | Unit3Question<'solve-one-step-equation', SolveOneStepParameters>
  | Unit3Question<'solve-two-step-equation', SolveTwoStepParameters>
  | Unit3Question<'solve-with-distributive-property', SolveDistributiveParameters>
  | Unit3Question<'solve-combining-like-terms', SolveCombiningParameters>
  | Unit3Question<'solve-variables-both-sides', SolveBothSidesParameters>
  | Unit3Question<'classify-solution-type', ClassifySolutionTypeParameters>
  | Unit3Question<'check-a-solution', CheckASolutionParameters>
  | Unit3Question<'identify-solution-from-choices', IdentifySolutionParameters>
  | Unit3Question<
      'write-equation-from-context',
      WriteEquationFromContextParameters
    >
  | Unit3Question<'solve-word-problem', SolveWordProblemParameters>
  | Unit3Question<'equation-error-analysis', EquationErrorParameters>
  | Unit3Question<'solution-type-error-analysis', SolutionTypeErrorParameters>

type Unit3Standard = '8.EE.7' | 'MP.1' | 'MP.3'

interface ItemDefinition {
  standard: Unit3Standard
  lessonFocus:
    | 'one-variable equations'
    | 'distributive property and combining terms'
    | 'variables on both sides'
    | 'one solution no solution infinitely many solutions'
    | 'checking solutions'
    | 'equations from contexts'
    | 'analyzing errors'
  workedExample: CurriculumWorkedExample
}

export const GRADE8_MATH_UNIT3_ITEM_DEFINITIONS = {
  'solve-one-step-equation': {
    standard: '8.EE.7',
    lessonFocus: 'one-variable equations',
    workedExample: {
      prompt: 'Solve for x: 4x = 10.',
      answer: '5/2',
      steps: ['Divide both sides by 4.', 'x = 10/4, which reduces to 5/2.'],
    },
  },
  'solve-two-step-equation': {
    standard: '8.EE.7',
    lessonFocus: 'one-variable equations',
    workedExample: {
      prompt: 'Solve for x: 3x + 4 = 19.',
      answer: '5',
      steps: ['Subtract 4 from both sides: 3x = 15.', 'Divide both sides by 3: x = 5.'],
    },
  },
  'solve-with-distributive-property': {
    standard: '8.EE.7',
    lessonFocus: 'distributive property and combining terms',
    workedExample: {
      prompt: 'Solve for x: 3(x + 4) = 21.',
      answer: '3',
      steps: ['Distribute: 3x + 12 = 21.', 'Subtract 12: 3x = 9.', 'Divide by 3: x = 3.'],
    },
  },
  'solve-combining-like-terms': {
    standard: '8.EE.7',
    lessonFocus: 'distributive property and combining terms',
    workedExample: {
      prompt: 'Solve for x: 5x - 2x + 3 = 12.',
      answer: '3',
      steps: ['Combine like terms: 3x + 3 = 12.', 'Subtract 3: 3x = 9.', 'Divide by 3: x = 3.'],
    },
  },
  'solve-variables-both-sides': {
    standard: '8.EE.7',
    lessonFocus: 'variables on both sides',
    workedExample: {
      prompt: 'Solve for x: 5x + 2 = 2x + 11.',
      answer: '3',
      steps: ['Subtract 2x from both sides: 3x + 2 = 11.', 'Subtract 2: 3x = 9.', 'Divide by 3: x = 3.'],
    },
  },
  'classify-solution-type': {
    standard: '8.EE.7',
    lessonFocus: 'one solution no solution infinitely many solutions',
    workedExample: {
      prompt: 'How many solutions does 2x + 3 = 2x + 5 have?',
      answer: 'no solution',
      steps: ['Subtract 2x from both sides: 3 = 5.', 'This is never true, so there is no solution.'],
    },
  },
  'check-a-solution': {
    standard: '8.EE.7',
    lessonFocus: 'checking solutions',
    workedExample: {
      prompt: 'Is x = 4 a solution to 3x - 2 = 10?',
      answer: 'yes',
      steps: ['Substitute x = 4: 3(4) - 2 = 10.', '12 - 2 = 10, which is true.'],
    },
  },
  'identify-solution-from-choices': {
    standard: '8.EE.7',
    lessonFocus: 'checking solutions',
    workedExample: {
      prompt: 'Which value of x solves 4x + 3 = 19?',
      answer: '4',
      steps: ['Subtract 3: 4x = 16.', 'Divide by 4: x = 4.'],
    },
  },
  'write-equation-from-context': {
    standard: '8.EE.7',
    lessonFocus: 'equations from contexts',
    workedExample: {
      prompt:
        'A bike rental costs $5 plus $3 per hour. The total cost was $20. Which equation represents the number of hours, x?',
      answer: '3x + 5 = 20',
      steps: ['The flat fee of 5 is added once.', 'The hourly rate of 3 multiplies the hours, x.'],
    },
  },
  'solve-word-problem': {
    standard: '8.EE.7',
    lessonFocus: 'equations from contexts',
    workedExample: {
      prompt:
        'A bike rental costs $5 plus $3 per hour. If the total cost was $20, how many hours, x, were rented?',
      answer: '5',
      steps: ['The equation is 3x + 5 = 20.', 'Subtract 5: 3x = 15.', 'Divide by 3: x = 5.'],
    },
  },
  'equation-error-analysis': {
    standard: '8.EE.7',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt:
        'A student solves 3x + 4 = 19. They write 3x = 15, then say x = 15. Which statement best analyzes the error?',
      answer:
        'The student forgot to divide both sides by 3; the correct solution is x = 5.',
      steps: ['3x = 15 is correct so far.', 'Dividing both sides by 3 gives x = 5, not 15.'],
    },
  },
  'solution-type-error-analysis': {
    standard: '8.EE.7',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt:
        'A student says 4x + 3 = 4x + 3 has one solution because they can solve for x. Which statement correctly analyzes the equation?',
      answer: 'The equation has infinitely many solutions; both sides are identical for every x.',
      steps: ['Subtracting 4x from both sides gives 3 = 3.', 'This is always true, so every x is a solution.'],
    },
  },
} as const satisfies Record<Grade8MathUnit3ItemType, ItemDefinition>

export function generateSolveOneStepEquationQuestion(
  difficulty: Difficulty,
): Unit3Question<'solve-one-step-equation', SolveOneStepParameters> {
  const mode = pick(['scale', 'shift'] as const)
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 12
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solve-one-step-equation']
  if (mode === 'scale') {
    const a = randomNonzero(-magnitude, magnitude)
    const c = ri(-magnitude * 2, magnitude * 2)
    const correct = formatSolution(c, a)
    const distractors = [
      formatSolution(c, -a),
      formatSolution(a, c),
      formatSolution(c + a, a),
      formatSolution(c - a, a),
      String(c - a),
    ]
    return makeCurriculumQuestion({
      itemType: 'solve-one-step-equation',
      standard: definition.standard,
      lessonFocus: definition.lessonFocus,
      difficulty,
      prompt: `Solve for x: ${renderLinearExpr(a, 0)} = ${c}.`,
      correctAnswer: correct,
      distractors,
      parameters: { mode, a, b: 0, c },
      workedExample: definition.workedExample,
      distractorMode: 'distinct',
    })
  }
  const b = randomNonzero(-magnitude, magnitude)
  const target = ri(-magnitude, magnitude)
  const c = target + b
  const correct = String(target)
  const distractors = [
    String(target + 1),
    String(target - 1),
    String(c + b),
    String(-target),
    String(target + 2),
  ]
  return makeCurriculumQuestion({
    itemType: 'solve-one-step-equation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve for x: ${renderLinearExpr(1, b)} = ${c}.`,
    correctAnswer: correct,
    distractors,
    parameters: { mode, a: 1, b, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolveTwoStepEquationQuestion(
  difficulty: Difficulty,
): Unit3Question<'solve-two-step-equation', SolveTwoStepParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 10 : 15
  const a = randomNonzero(-magnitude, magnitude)
  const b = ri(-magnitude, magnitude)
  const c = ri(-magnitude * 2, magnitude * 2)
  const correct = formatSolution(c - b, a)
  const distractors = [
    formatSolution(c - b + a, a),
    formatSolution(c - b - a, a),
    formatSolution(c - b + 2 * a, a),
    formatSolution(c - b - 2 * a, a),
    formatSolution(c + b, a),
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solve-two-step-equation']
  return makeCurriculumQuestion({
    itemType: 'solve-two-step-equation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve for x: ${renderLinearExpr(a, b)} = ${c}.`,
    correctAnswer: correct,
    distractors,
    parameters: { a, b, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolveWithDistributivePropertyQuestion(
  difficulty: Difficulty,
): Unit3Question<'solve-with-distributive-property', SolveDistributiveParameters> {
  const magnitude = difficulty === 1 ? 5 : difficulty === 2 ? 8 : 12
  const p = randomNonzero(-6, 6)
  const q = ri(-magnitude, magnitude)
  const c = ri(-magnitude * 3, magnitude * 3)
  const correct = formatSolution(c - p * q, p)
  const distractors = [
    formatSolution(c - p * q + p, p),
    formatSolution(c - p * q - p, p),
    formatSolution(c - p * q + 2 * p, p),
    formatSolution(c - p * q - 2 * p, p),
    formatSolution(c, p),
  ]
  const definition =
    GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solve-with-distributive-property']
  return makeCurriculumQuestion({
    itemType: 'solve-with-distributive-property',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve for x: ${renderProductExpr(p, q)} = ${c}.`,
    correctAnswer: correct,
    distractors,
    parameters: { p, q, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolveCombiningLikeTermsQuestion(
  difficulty: Difficulty,
): Unit3Question<'solve-combining-like-terms', SolveCombiningParameters> {
  const magnitude = difficulty === 1 ? 5 : difficulty === 2 ? 8 : 12
  let a1 = randomNonzero(-8, 8)
  let a2 = randomNonzero(-8, 8)
  while (a1 + a2 === 0) a2 = randomNonzero(-8, 8)
  const b = ri(-magnitude, magnitude)
  const c = ri(-magnitude * 3, magnitude * 3)
  const combined = a1 + a2
  const correct = formatSolution(c - b, combined)
  const distractors = [
    formatSolution(c - b + combined, combined),
    formatSolution(c - b - combined, combined),
    formatSolution(c - b + 2 * combined, combined),
    formatSolution(c - b - 2 * combined, combined),
    formatSolution(c - b, a1),
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solve-combining-like-terms']
  return makeCurriculumQuestion({
    itemType: 'solve-combining-like-terms',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve for x: ${renderCombinedTerms(a1, a2, b)} = ${c}.`,
    correctAnswer: correct,
    distractors,
    parameters: { a1, a2, b, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolveVariablesBothSidesQuestion(
  difficulty: Difficulty,
): Unit3Question<'solve-variables-both-sides', SolveBothSidesParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 13
  const a = randomNonzero(-magnitude, magnitude)
  let c = randomNonzero(-magnitude, magnitude)
  while (c === a) c = randomNonzero(-magnitude, magnitude)
  const b = ri(-magnitude * 2, magnitude * 2)
  const d = ri(-magnitude * 2, magnitude * 2)
  const correct = formatSolution(d - b, a - c)
  const distractors = [
    formatSolution(d - b + (a - c), a - c),
    formatSolution(d - b - (a - c), a - c),
    formatSolution(d - b + 2 * (a - c), a - c),
    formatSolution(d - b - 2 * (a - c), a - c),
    formatSolution(b - d, a - c),
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solve-variables-both-sides']
  return makeCurriculumQuestion({
    itemType: 'solve-variables-both-sides',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Solve for x: ${renderLinearExpr(a, b)} = ${renderLinearExpr(c, d)}.`,
    correctAnswer: correct,
    distractors,
    parameters: { a, b, c, d },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateClassifySolutionTypeQuestion(
  difficulty: Difficulty,
): Unit3Question<'classify-solution-type', ClassifySolutionTypeParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 13
  const solutionType = pick(['one', 'none', 'infinite'] as const)
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['classify-solution-type']
  let a: number
  let c: number
  let b: number
  let d: number
  if (solutionType === 'one') {
    a = randomNonzero(-magnitude, magnitude)
    c = randomNonzero(-magnitude, magnitude)
    while (c === a) c = randomNonzero(-magnitude, magnitude)
    b = ri(-magnitude * 2, magnitude * 2)
    d = ri(-magnitude * 2, magnitude * 2)
  } else {
    a = randomNonzero(-magnitude, magnitude)
    c = a
    b = ri(-magnitude * 2, magnitude * 2)
    d = solutionType === 'infinite' ? b : b + randomNonzero(-magnitude, magnitude)
  }
  const correctAnswer =
    solutionType === 'one'
      ? 'one solution'
      : solutionType === 'none'
        ? 'no solution'
        : 'infinitely many solutions'
  return makeCurriculumQuestion({
    itemType: 'classify-solution-type',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `How many solutions does ${renderLinearExpr(a, b)} = ${renderLinearExpr(c, d)} have?`,
    correctAnswer,
    distractors: ['one solution', 'no solution', 'infinitely many solutions'].filter(
      (choice) => choice !== correctAnswer,
    ),
    parameters: { a, b, c, d, solutionType },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
    choiceCount: 3,
  })
}

export function generateCheckASolutionQuestion(
  difficulty: Difficulty,
): Unit3Question<'check-a-solution', CheckASolutionParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 13
  const a = randomNonzero(-magnitude, magnitude)
  const b = ri(-magnitude, magnitude)
  const target = ri(-magnitude, magnitude)
  const c = a * target + b
  const isSolution = pick([true, false])
  const candidate = isSolution ? target : target + pick([-2, -1, 1, 2])
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['check-a-solution']
  return makeCurriculumQuestion({
    itemType: 'check-a-solution',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Is x = ${candidate} a solution to ${renderLinearExpr(a, b)} = ${c}?`,
    correctAnswer: a * candidate + b === c ? 'yes' : 'no',
    distractors: [a * candidate + b === c ? 'no' : 'yes'],
    parameters: { a, b, c, candidate, isSolution },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
    choiceCount: 2,
  })
}

export function generateIdentifySolutionFromChoicesQuestion(
  difficulty: Difficulty,
): Unit3Question<'identify-solution-from-choices', IdentifySolutionParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 10 : 14
  const a = randomNonzero(-magnitude, magnitude)
  const b = ri(-magnitude, magnitude)
  const c = ri(-magnitude * 2, magnitude * 2)
  const correct = formatSolution(c - b, a)
  const distractors = [
    formatSolution(c - b + a, a),
    formatSolution(c - b - a, a),
    formatSolution(c - b + 2 * a, a),
    formatSolution(c - b - 2 * a, a),
    formatSolution(c + b, a),
  ]
  const definition =
    GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['identify-solution-from-choices']
  return makeCurriculumQuestion({
    itemType: 'identify-solution-from-choices',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Which value of x solves ${renderLinearExpr(a, b)} = ${c}?`,
    correctAnswer: correct,
    distractors,
    parameters: { a, b, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

const CONTEXT_TEMPLATES = [
  {
    describe: (a: number, b: number, c: number) =>
      `A bike rental costs $${b} plus $${a} per hour. The total cost was $${c}. Which equation represents the number of hours, x?`,
    ask: (a: number, b: number, c: number) =>
      `A bike rental costs $${b} plus $${a} per hour. If the total cost was $${c}, how many hours, x, were rented?`,
  },
  {
    describe: (a: number, b: number, c: number) =>
      `A phone plan costs $${b} plus $${a} per gigabyte of data. The bill was $${c}. Which equation represents the number of gigabytes, x?`,
    ask: (a: number, b: number, c: number) =>
      `A phone plan costs $${b} plus $${a} per gigabyte of data. If the bill was $${c}, how many gigabytes, x, were used?`,
  },
] as const

function randomContextEquation(difficulty: Difficulty): {
  a: number
  b: number
  denominator: number
} {
  const denominator = difficulty === 1 ? 1 : pick([1, 1, 2, 4] as const)
  const a = ri(2, difficulty === 1 ? 8 : difficulty === 2 ? 12 : 16) * denominator
  const b = ri(0, difficulty === 1 ? 15 : 30)
  return { a, b, denominator }
}

export function generateWriteEquationFromContextQuestion(
  difficulty: Difficulty,
): Unit3Question<
  'write-equation-from-context',
  WriteEquationFromContextParameters
> {
  const { a, b } = randomContextEquation(difficulty)
  const hours = ri(2, difficulty === 1 ? 8 : 12)
  const c = a * hours + b
  const template = pick(CONTEXT_TEMPLATES)
  const correct = `${a}x + ${b} = ${c}`
  const distractors = [
    `${a}x - ${b} = ${c}`,
    `${b}x + ${a} = ${c}`,
    `${a}(x + ${b}) = ${c}`,
    `${a}x + ${b} = ${c + b}`,
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['write-equation-from-context']
  return makeCurriculumQuestion({
    itemType: 'write-equation-from-context',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: template.describe(a, b, c),
    correctAnswer: correct,
    distractors,
    parameters: { a, b, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolveWordProblemQuestion(
  difficulty: Difficulty,
): Unit3Question<'solve-word-problem', SolveWordProblemParameters> {
  const { a, b, denominator } = randomContextEquation(difficulty)
  const numerator = ri(2, difficulty === 1 ? 8 : 12) * denominator + ri(0, denominator - 1)
  const c = (a * numerator) / denominator + b
  const template = pick(CONTEXT_TEMPLATES)
  const correct = formatSolution(numerator, denominator)
  const distractors = [
    formatSolution(numerator + denominator, denominator),
    formatSolution(numerator - denominator, denominator),
    formatSolution(numerator + 2 * denominator, denominator),
    formatSolution(numerator - 2 * denominator, denominator),
    formatSolution(c, a),
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solve-word-problem']
  return makeCurriculumQuestion({
    itemType: 'solve-word-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: template.ask(a, b, c),
    correctAnswer: correct,
    distractors,
    parameters: { a, b, c },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateEquationErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit3Question<'equation-error-analysis', EquationErrorParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 10 : 14
  const a = randomNonzero(2, magnitude)
  const b = randomNonzero(-magnitude, magnitude)
  const target = randomNonzero(-magnitude, magnitude)
  const c = a * target + b
  const claimed = c - b
  const correct = formatSolution(c - b, a)
  const correctAnswer = `The student forgot to divide both sides by ${a}; the correct solution is x = ${correct}.`
  const distractors = [
    `The work is correct; x = ${claimed}.`,
    `The student should have multiplied by ${a} instead of dividing; x = ${claimed * a}.`,
    `The student subtracted incorrectly; the correct solution is x = ${formatSolution(c + b, a)}.`,
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['equation-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'equation-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student solves ${renderLinearExpr(a, b)} = ${c}. They write ${a}x = ${claimed}, then say x = ${claimed}. Which statement best analyzes the error?`,
    correctAnswer,
    distractors,
    parameters: { a, b, c, claimed },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolutionTypeErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit3Question<'solution-type-error-analysis', SolutionTypeErrorParameters> {
  const magnitude = difficulty === 1 ? 6 : difficulty === 2 ? 9 : 13
  const a = randomNonzero(-magnitude, magnitude)
  const b = ri(-magnitude * 2, magnitude * 2)
  const solutionType = pick(['none', 'infinite'] as const)
  const d = solutionType === 'infinite' ? b : b + randomNonzero(-magnitude, magnitude)
  const correctAnswer =
    solutionType === 'infinite'
      ? 'The equation has infinitely many solutions; both sides are identical for every x.'
      : `The equation has no solution; simplifying gives ${b} = ${d}, which is never true.`
  const distractors = [
    'The equation has exactly one solution, found by dividing both sides by the coefficient of x.',
    solutionType === 'infinite'
      ? `The equation has no solution; simplifying gives ${b} = ${d}, which is never true.`
      : 'The equation has infinitely many solutions; both sides are identical for every x.',
    'The equation cannot be classified without graphing it.',
  ]
  const definition = GRADE8_MATH_UNIT3_ITEM_DEFINITIONS['solution-type-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'solution-type-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student says ${renderLinearExpr(a, b)} = ${renderLinearExpr(a, d)} has one solution because they can solve for x. Which statement correctly analyzes the equation?`,
    correctAnswer,
    distractors,
    parameters: { a, b, d, solutionType },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const GRADE8_MATH_UNIT3_GENERATORS = {
  'solve-one-step-equation': generateSolveOneStepEquationQuestion,
  'solve-two-step-equation': generateSolveTwoStepEquationQuestion,
  'solve-with-distributive-property': generateSolveWithDistributivePropertyQuestion,
  'solve-combining-like-terms': generateSolveCombiningLikeTermsQuestion,
  'solve-variables-both-sides': generateSolveVariablesBothSidesQuestion,
  'classify-solution-type': generateClassifySolutionTypeQuestion,
  'check-a-solution': generateCheckASolutionQuestion,
  'identify-solution-from-choices': generateIdentifySolutionFromChoicesQuestion,
  'write-equation-from-context': generateWriteEquationFromContextQuestion,
  'solve-word-problem': generateSolveWordProblemQuestion,
  'equation-error-analysis': generateEquationErrorAnalysisQuestion,
  'solution-type-error-analysis': generateSolutionTypeErrorAnalysisQuestion,
} satisfies Record<
  Grade8MathUnit3ItemType,
  CurriculumGenerator<Grade8MathUnit3Question>
>

export function generateGrade8MathUnit3Question<
  TItemType extends Grade8MathUnit3ItemType,
>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade8MathUnit3Question, { itemType: TItemType }> {
  const generator = GRADE8_MATH_UNIT3_GENERATORS[
    itemType
  ] as CurriculumGenerator<
    Extract<Grade8MathUnit3Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
