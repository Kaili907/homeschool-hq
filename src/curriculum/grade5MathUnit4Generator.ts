import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/** Coverage contract derived from Unit 4, all 18 lesson records, and 5.NBT.6/5.OA.1–3. */
export const GRADE5_MATH_UNIT4_ITEM_TYPES = [
  'division-model-equation',
  'division-area-model',
  'partial-quotients',
  'whole-number-quotient',
  'division-with-remainder',
  'interpret-remainder',
  'evaluate-numerical-expression',
  'write-numerical-expression',
  'interpret-numerical-expression',
  'extend-two-rule-patterns',
  'identify-pattern-relationship',
  'pattern-ordered-pair',
] as const

export type Grade5MathUnit4ItemType = (typeof GRADE5_MATH_UNIT4_ITEM_TYPES)[number]

interface ExactDivisionParameters {
  dividend: number
  divisor: number
  quotient: number
  remainder: number
}

interface DivisionModelParameters extends ExactDivisionParameters {
  model: 'equal-groups' | 'missing-factor'
}

interface AreaModelParameters extends ExactDivisionParameters {
  knownSide: number
  missingSide: number
}

interface PartialQuotientsParameters extends ExactDivisionParameters {
  firstPartialQuotient: number
  secondPartialQuotient: number
}

type RemainderAction = 'full-groups' | 'round-up' | 'leftovers'

interface RemainderContextParameters extends ExactDivisionParameters {
  action: RemainderAction
  context: 'notebooks' | 'boxes' | 'tiles'
}

type ArithmeticOperator = '+' | '-' | '×'
type Grouping = 'parentheses' | 'brackets' | 'braces' | 'nested'

interface EvaluateExpressionParameters {
  mode: 'single-group' | 'nested'
  a: number
  b: number
  c: number
  d: number
  innerOperator: ArithmeticOperator
  outerOperator: ArithmeticOperator
  grouping: Grouping
}

type ExpressionTemplate = 'add-then-multiply' | 'multiply-then-subtract' | 'subtract-sum-from'

interface LanguageExpressionParameters {
  a: number
  b: number
  c: number
  template: ExpressionTemplate
  grouping: Exclude<Grouping, 'nested'>
}

interface TwoRulePatternParameters {
  startA: number
  startB: number
  stepA: number
  stepB: number
  termNumber: number
}

interface PatternRelationshipParameters {
  startA: number
  stepA: number
  multiplier: 2 | 3
  termCount: number
  direction: 'b-from-a' | 'a-from-b'
}

type Unit4Question<TItemType extends Grade5MathUnit4ItemType, TParameters> = CurriculumQuestion<TItemType, TParameters>

export type Grade5MathUnit4Question =
  | Unit4Question<'division-model-equation', DivisionModelParameters>
  | Unit4Question<'division-area-model', AreaModelParameters>
  | Unit4Question<'partial-quotients', PartialQuotientsParameters>
  | Unit4Question<'whole-number-quotient', ExactDivisionParameters>
  | Unit4Question<'division-with-remainder', ExactDivisionParameters>
  | Unit4Question<'interpret-remainder', RemainderContextParameters>
  | Unit4Question<'evaluate-numerical-expression', EvaluateExpressionParameters>
  | Unit4Question<'write-numerical-expression', LanguageExpressionParameters>
  | Unit4Question<'interpret-numerical-expression', LanguageExpressionParameters>
  | Unit4Question<'extend-two-rule-patterns', TwoRulePatternParameters>
  | Unit4Question<'identify-pattern-relationship', PatternRelationshipParameters>
  | Unit4Question<'pattern-ordered-pair', TwoRulePatternParameters>

interface ItemDefinition {
  standard: '5.NBT.6' | '5.OA.1' | '5.OA.2' | '5.OA.3'
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

export const GRADE5_MATH_UNIT4_ITEM_DEFINITIONS = {
  'division-model-equation': {
    standard: '5.NBT.6',
    lessonFocus: 'division models',
    workedExample: {
      prompt: 'Thirty-six counters are split into 4 equal groups. Which equations describe the model?',
      answer: '36 ÷ 4 = 9; 4 × 9 = 36',
      steps: [
        'The total, 36, is the dividend and the 4 groups give the divisor.',
        'Each group has 9 because 4 × 9 = 36.',
        'The related equations are 36 ÷ 4 = 9 and 4 × 9 = 36.',
      ],
    },
  },
  'division-area-model': {
    standard: '5.NBT.6',
    lessonFocus: 'division models',
    workedExample: {
      prompt: 'A rectangle has area 144 square units and one side is 12 units. What is the missing side?',
      answer: '12',
      steps: [
        'Area equals one side multiplied by the other side.',
        'Use 144 ÷ 12 to find the missing factor.',
        '144 ÷ 12 = 12, and 12 × 12 checks the area.',
      ],
    },
  },
  'partial-quotients': {
    standard: '5.NBT.6',
    lessonFocus: 'partial quotients',
    workedExample: {
      prompt: 'Use the partial quotients 40 and 7 to solve 799 ÷ 17.',
      answer: '47',
      steps: [
        'Subtract 17 × 40 = 680 from 799 to leave 119.',
        'Subtract 17 × 7 = 119 to leave 0.',
        'Add the partial quotients: 40 + 7 = 47.',
      ],
    },
  },
  'whole-number-quotient': {
    standard: '5.NBT.6',
    lessonFocus: 'standard division strategies',
    workedExample: {
      prompt: 'Find 1,176 ÷ 24.',
      answer: '49',
      steps: [
        'Estimate: 1,200 ÷ 24 is about 50.',
        'Compute the quotient as 49.',
        'Check with multiplication: 24 × 49 = 1,176.',
      ],
    },
  },
  'division-with-remainder': {
    standard: '5.NBT.6',
    lessonFocus: 'standard division strategies',
    workedExample: {
      prompt: 'Find 938 ÷ 18. Write the quotient and remainder.',
      answer: '52 R 2',
      steps: [
        '18 × 52 = 936.',
        '938 - 936 = 2, so the remainder is 2.',
        'Check that 938 = 18 × 52 + 2 and that 2 is less than 18.',
      ],
    },
  },
  'interpret-remainder': {
    standard: '5.NBT.6',
    lessonFocus: 'remainders in context',
    workedExample: {
      prompt: 'Fifty books are packed in boxes holding 8 books each. How many boxes are needed?',
      answer: '7',
      steps: ['50 ÷ 8 = 6 R 2.', 'Six boxes leave 2 books unpacked.', 'Round the quotient up, so 7 boxes are needed.'],
    },
  },
  'evaluate-numerical-expression': {
    standard: '5.OA.1',
    lessonFocus: 'parentheses and brackets',
    workedExample: {
      prompt: 'Evaluate 6 × [14 - (3 + 5)].',
      answer: '36',
      steps: [
        'Evaluate the parentheses first: 3 + 5 = 8.',
        'Evaluate the brackets: 14 - 8 = 6.',
        'Multiply: 6 × 6 = 36.',
      ],
    },
  },
  'write-numerical-expression': {
    standard: '5.OA.2',
    lessonFocus: 'parentheses and brackets',
    workedExample: {
      prompt: 'Write an expression for: add 8 and 7, then multiply the sum by 4.',
      answer: '(8 + 7) × 4',
      steps: [
        'The addition must happen first, so group 8 + 7.',
        'Then multiply that sum by 4.',
        'The expression is (8 + 7) × 4.',
      ],
    },
  },
  'interpret-numerical-expression': {
    standard: '5.OA.2',
    lessonFocus: 'parentheses and brackets',
    workedExample: {
      prompt: 'Which phrase describes (5 × 12) - 3?',
      answer: 'Multiply 5 by 12, then subtract 3 from the product.',
      steps: [
        'The parentheses show that 5 × 12 is treated as one quantity.',
        'The result of a multiplication is a product.',
        'The outside operation subtracts 3 from that product.',
      ],
    },
  },
  'extend-two-rule-patterns': {
    standard: '5.OA.3',
    lessonFocus: 'two-rule numerical patterns',
    workedExample: {
      prompt: 'Pattern A starts at 2 and adds 3. Pattern B starts at 4 and adds 6. What are the fourth terms?',
      answer: '(11, 22)',
      steps: [
        'Pattern A is 2, 5, 8, 11.',
        'Pattern B is 4, 10, 16, 22.',
        'The fourth corresponding terms form the pair (11, 22).',
      ],
    },
  },
  'identify-pattern-relationship': {
    standard: '5.OA.3',
    lessonFocus: 'two-rule numerical patterns',
    workedExample: {
      prompt: 'Pattern A is 3, 7, 11, 15. Pattern B is 6, 14, 22, 30. How are corresponding terms related?',
      answer: 'Each term in Pattern B is 2 times the corresponding term in Pattern A.',
      steps: [
        'Compare corresponding pairs: (3, 6), (7, 14), and (11, 22).',
        'Each Pattern B term is twice its Pattern A partner.',
        'The relationship continues because Pattern B also grows by twice as much each step.',
      ],
    },
  },
  'pattern-ordered-pair': {
    standard: '5.OA.3',
    lessonFocus: 'two-rule numerical patterns',
    workedExample: {
      prompt:
        'Pattern A starts at 5 and adds 4. Pattern B starts at 8 and adds 6. Which point represents the third pair of terms?',
      answer: '(13, 20)',
      steps: [
        'The third Pattern A term is 5 + 2 × 4 = 13.',
        'The third Pattern B term is 8 + 2 × 6 = 20.',
        'Use Pattern A as x and Pattern B as y: (13, 20).',
      ],
    },
  },
} as const satisfies Record<Grade5MathUnit4ItemType, ItemDefinition>

const uniqueExcept = (correct: string, candidates: readonly string[]): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

function exactQuotientAndRemainder(dividend: number, divisor: number): { quotient: number; remainder: number } {
  const exactDividend = BigInt(dividend)
  const exactDivisor = BigInt(divisor)
  return {
    quotient: Number(exactDividend / exactDivisor),
    remainder: Number(exactDividend % exactDivisor),
  }
}

function maxExactQuotient(divisor: number, remainder: number): number {
  return Number((9_999n - BigInt(remainder)) / BigInt(divisor))
}

function randomDivisor(difficulty: Difficulty): number {
  return difficulty === 1 ? ri(2, 9) : difficulty === 2 ? ri(10, 24) : ri(11, 99)
}

function randomDivision(difficulty: Difficulty, remainderMode: 'zero' | 'nonzero'): ExactDivisionParameters {
  const divisor = randomDivisor(difficulty)
  const remainder = remainderMode === 'zero' ? 0 : ri(1, divisor - 1)
  const maximum = maxExactQuotient(divisor, remainder)
  const minimum = difficulty === 1 ? 2 : difficulty === 2 ? 12 : 30
  const preferredMaximum = difficulty === 1 ? 12 : difficulty === 2 ? 70 : 240
  const quotient = ri(Math.min(minimum, maximum), Math.min(preferredMaximum, maximum))
  const dividend = divisor * quotient + remainder
  return { dividend, divisor, quotient, remainder }
}

function formatDivisionResult(quotient: number, remainder: number): string {
  return remainder === 0 ? String(quotient) : `${quotient} R ${remainder}`
}

function divisionResultDistractors(parameters: ExactDivisionParameters): string[] {
  const { quotient, remainder, divisor } = parameters
  const correct = formatDivisionResult(quotient, remainder)
  return uniqueExcept(correct, [
    formatDivisionResult(Math.max(0, quotient - 1), remainder),
    formatDivisionResult(quotient + 1, remainder),
    formatDivisionResult(quotient, Math.max(0, remainder - 1)),
    formatDivisionResult(quotient, Math.min(divisor - 1, remainder + 1)),
    formatDivisionResult(Math.max(0, quotient - 2), remainder),
  ])
}

function relatedDivisionEquations(parameters: ExactDivisionParameters): string {
  return `${parameters.dividend} ÷ ${parameters.divisor} = ${parameters.quotient}; ${parameters.divisor} × ${parameters.quotient} = ${parameters.dividend}`
}

export function generateDivisionModelEquationQuestion(
  difficulty: Difficulty,
): Unit4Question<'division-model-equation', DivisionModelParameters> {
  const division = randomDivision(difficulty, 'zero')
  const model: DivisionModelParameters['model'] = difficulty === 1 || ri(0, 1) === 0 ? 'equal-groups' : 'missing-factor'
  const parameters: DivisionModelParameters = { ...division, model }
  const correctAnswer = relatedDivisionEquations(parameters)
  const prompt =
    model === 'equal-groups'
      ? `${division.dividend} counters are split into ${division.divisor} equal groups. Which pair of equations represents the model?`
      : `A missing-factor model shows ${division.divisor} × ? = ${division.dividend}. Which pair of equations represents the model?`
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['division-model-equation']
  return makeCurriculumQuestion({
    itemType: 'division-model-equation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `${division.dividend} ÷ ${division.quotient} = ${division.divisor}; ${division.divisor} × ${division.dividend} = ${division.quotient}`,
      `${division.divisor} ÷ ${division.dividend} = ${division.quotient}; ${division.quotient} × ${division.divisor} = ${division.dividend}`,
      `${division.dividend} ÷ ${division.divisor} = ${division.quotient + 1}; ${division.divisor} × ${division.quotient + 1} = ${division.dividend}`,
      `${division.dividend} ÷ ${division.divisor + 1} = ${division.quotient}; ${division.divisor + 1} × ${division.quotient} = ${division.dividend}`,
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateDivisionAreaModelQuestion(
  difficulty: Difficulty,
): Unit4Question<'division-area-model', AreaModelParameters> {
  const knownSide = difficulty === 1 ? ri(2, 9) : difficulty === 2 ? ri(5, 15) : ri(10, 25)
  const missingSide = difficulty === 1 ? ri(2, 12) : difficulty === 2 ? ri(8, 20) : ri(12, 35)
  const dividend = knownSide * missingSide
  const exact = exactQuotientAndRemainder(dividend, knownSide)
  const parameters = {
    dividend,
    divisor: knownSide,
    quotient: exact.quotient,
    remainder: exact.remainder,
    knownSide,
    missingSide,
  }
  const correctAnswer = String(missingSide)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['division-area-model']
  return makeCurriculumQuestion({
    itemType: 'division-area-model',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A rectangle has area ${dividend} square units and one side length is ${knownSide} units. What is the missing side length?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(Math.max(1, missingSide - 1)),
      String(missingSide + 1),
      String(knownSide),
      String(knownSide + missingSide),
      String(dividend - knownSide),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generatePartialQuotientsQuestion(
  difficulty: Difficulty,
): Unit4Question<'partial-quotients', PartialQuotientsParameters> {
  const divisor = randomDivisor(difficulty)
  const remainder = difficulty === 1 ? 0 : ri(0, divisor - 1)
  const maximum = Math.min(difficulty === 1 ? 29 : difficulty === 2 ? 89 : 240, maxExactQuotient(divisor, remainder))
  const minimum = difficulty === 1 ? 12 : difficulty === 2 ? 25 : 60
  let quotient = ri(Math.min(minimum, maximum), maximum)
  if (quotient % 10 === 0) quotient += quotient < maximum ? 1 : -1
  const firstPartialQuotient = Number((BigInt(quotient) / 10n) * 10n)
  const secondPartialQuotient = quotient - firstPartialQuotient
  const dividend = divisor * quotient + remainder
  const parameters = {
    dividend,
    divisor,
    quotient,
    remainder,
    firstPartialQuotient,
    secondPartialQuotient,
  }
  const afterFirst = dividend - divisor * firstPartialQuotient
  const correctAnswer = formatDivisionResult(quotient, remainder)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['partial-quotients']
  return makeCurriculumQuestion({
    itemType: 'partial-quotients',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Use these partial-quotients steps to solve ${dividend} ÷ ${divisor}:\n${dividend} - ${divisor} × ${firstPartialQuotient} = ${afterFirst}\n${afterFirst} - ${divisor} × ${secondPartialQuotient} = ${remainder}\nWhat is the quotient${remainder === 0 ? '?' : ' and remainder?'}`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      formatDivisionResult(firstPartialQuotient, remainder),
      formatDivisionResult(secondPartialQuotient, remainder),
      formatDivisionResult(firstPartialQuotient + secondPartialQuotient + 1, remainder),
      formatDivisionResult(firstPartialQuotient + secondPartialQuotient, Math.min(divisor - 1, remainder + 1)),
      String(firstPartialQuotient + secondPartialQuotient + remainder),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateWholeNumberQuotientQuestion(
  difficulty: Difficulty,
): Unit4Question<'whole-number-quotient', ExactDivisionParameters> {
  const parameters = randomDivision(difficulty, 'zero')
  const correctAnswer = String(parameters.quotient)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['whole-number-quotient']
  return makeCurriculumQuestion({
    itemType: 'whole-number-quotient',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Find ${parameters.dividend} ÷ ${parameters.divisor}.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(Math.max(0, parameters.quotient - 1)),
      String(parameters.quotient + 1),
      String(Math.max(0, parameters.quotient - parameters.divisor)),
      String(parameters.quotient + parameters.divisor),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateDivisionWithRemainderQuestion(
  difficulty: Difficulty,
): Unit4Question<'division-with-remainder', ExactDivisionParameters> {
  const parameters = randomDivision(difficulty, 'nonzero')
  const correctAnswer = formatDivisionResult(parameters.quotient, parameters.remainder)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['division-with-remainder']
  return makeCurriculumQuestion({
    itemType: 'division-with-remainder',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Find ${parameters.dividend} ÷ ${parameters.divisor}. Write the quotient and remainder.`,
    correctAnswer,
    distractors: divisionResultDistractors(parameters),
    parameters,
    workedExample: definition.workedExample,
  })
}

function contextPrompt(parameters: RemainderContextParameters): string {
  const { dividend, divisor, action, context } = parameters
  if (action === 'full-groups' && context === 'notebooks') {
    return `A teacher has ${dividend} notebooks and packs ${divisor} in each complete set. How many complete sets can be packed?`
  }
  if (action === 'round-up' && context === 'boxes') {
    return `${dividend} books are packed in boxes holding ${divisor} books each. How many boxes are needed to pack every book?`
  }
  return `${dividend} tiles are arranged in complete rows of ${divisor}. How many tiles are left after making all possible complete rows?`
}

export function generateInterpretRemainderQuestion(
  difficulty: Difficulty,
): Unit4Question<'interpret-remainder', RemainderContextParameters> {
  const division = randomDivision(difficulty, 'nonzero')
  const action = pick(['full-groups', 'round-up', 'leftovers'] as const)
  const context: RemainderContextParameters['context'] =
    action === 'full-groups' ? 'notebooks' : action === 'round-up' ? 'boxes' : 'tiles'
  const parameters: RemainderContextParameters = {
    ...division,
    action,
    context,
  }
  const answer =
    action === 'full-groups' ? division.quotient : action === 'round-up' ? division.quotient + 1 : division.remainder
  const correctAnswer = String(answer)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['interpret-remainder']
  return makeCurriculumQuestion({
    itemType: 'interpret-remainder',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: contextPrompt(parameters),
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(division.quotient),
      String(division.quotient + 1),
      String(division.remainder),
      String(division.divisor - division.remainder),
      String(Math.max(0, division.quotient - 1)),
      String(division.remainder + 1),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

function applyExactOperator(operator: ArithmeticOperator, left: bigint, right: bigint): bigint {
  if (operator === '+') return left + right
  if (operator === '-') return left - right
  return left * right
}

function groupingMarks(grouping: Exclude<Grouping, 'nested'>): readonly [string, string] {
  if (grouping === 'parentheses') return ['(', ')']
  if (grouping === 'brackets') return ['[', ']']
  return ['{', '}']
}

function renderEvaluationExpression(parameters: EvaluateExpressionParameters): string {
  if (parameters.mode === 'nested') {
    return `{${parameters.a} + [${parameters.b} × (${parameters.c} - ${parameters.d})]}`
  }
  const [open, close] = groupingMarks(parameters.grouping as Exclude<Grouping, 'nested'>)
  return `${parameters.a} ${parameters.outerOperator} ${open}${parameters.b} ${parameters.innerOperator} ${parameters.c}${close}`
}

function evaluateExpression(parameters: EvaluateExpressionParameters): bigint {
  if (parameters.mode === 'nested') {
    return BigInt(parameters.a) + BigInt(parameters.b) * (BigInt(parameters.c) - BigInt(parameters.d))
  }
  const inner = applyExactOperator(parameters.innerOperator, BigInt(parameters.b), BigInt(parameters.c))
  return applyExactOperator(parameters.outerOperator, BigInt(parameters.a), inner)
}

function randomEvaluationParameters(difficulty: Difficulty): EvaluateExpressionParameters {
  if (difficulty === 3 && ri(0, 2) === 0) {
    const d = ri(1, 9)
    return {
      mode: 'nested',
      a: ri(2, 30),
      b: ri(2, 12),
      c: ri(d + 1, d + 12),
      d,
      innerOperator: '×',
      outerOperator: '+',
      grouping: 'nested',
    }
  }
  const grouping =
    difficulty === 1
      ? 'parentheses'
      : difficulty === 2
        ? pick(['parentheses', 'brackets'] as const)
        : pick(['parentheses', 'brackets', 'braces'] as const)
  const innerOperator = pick(['+', '-', '×'] as const)
  let b = ri(2, difficulty === 1 ? 12 : 25)
  let c = ri(2, difficulty === 1 ? 10 : 18)
  if (innerOperator === '-' && b < c) [b, c] = [c, b]
  const inner = applyExactOperator(innerOperator, BigInt(b), BigInt(c))
  const outerOperator = difficulty === 1 ? pick(['+', '×'] as const) : pick(['+', '-', '×'] as const)
  const a = outerOperator === '-' ? Number(inner) + ri(0, 20) : ri(2, difficulty === 1 ? 12 : 30)
  return {
    mode: 'single-group',
    a,
    b,
    c,
    d: 0,
    innerOperator,
    outerOperator,
    grouping,
  }
}

export function generateEvaluateNumericalExpressionQuestion(
  difficulty: Difficulty,
): Unit4Question<'evaluate-numerical-expression', EvaluateExpressionParameters> {
  const parameters = randomEvaluationParameters(difficulty)
  const value = evaluateExpression(parameters)
  const correctAnswer = String(value)
  const magnitude = value > 10n ? 10n : 2n
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['evaluate-numerical-expression']
  return makeCurriculumQuestion({
    itemType: 'evaluate-numerical-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Evaluate ${renderEvaluationExpression(parameters)}.`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(value + 1n),
      String(value + magnitude),
      String(value > 0n ? value - 1n : value + 2n),
      String(value > magnitude ? value - magnitude : value + magnitude + 1n),
      String(BigInt(parameters.a + parameters.b + parameters.c + parameters.d)),
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

function groupingForDifficulty(difficulty: Difficulty): Exclude<Grouping, 'nested'> {
  return difficulty === 1
    ? 'parentheses'
    : difficulty === 2
      ? pick(['parentheses', 'brackets'] as const)
      : pick(['parentheses', 'brackets', 'braces'] as const)
}

function randomLanguageExpressionParameters(difficulty: Difficulty): LanguageExpressionParameters {
  const largeLimit = difficulty === 1 ? 12 : 30
  const smallLimit = difficulty === 1 ? 10 : 20
  const a = ri(2, largeLimit)
  let b = ri(2, largeLimit)
  while (b === a) b = ri(2, largeLimit)
  let third = ri(2, smallLimit)
  while (third === a || third === b) third = ri(2, smallLimit)
  const template = pick(['add-then-multiply', 'multiply-then-subtract', 'subtract-sum-from'] as const)
  const c = template === 'subtract-sum-from' ? a + b + third : third
  return { a, b, c, template, grouping: groupingForDifficulty(difficulty) }
}

function renderLanguageExpression(parameters: LanguageExpressionParameters): string {
  const { a, b, c, template, grouping } = parameters
  const [open, close] = groupingMarks(grouping)
  if (template === 'add-then-multiply') return `${open}${a} + ${b}${close} × ${c}`
  if (template === 'multiply-then-subtract') return `${open}${a} × ${b}${close} - ${c}`
  return `${c} - ${open}${a} + ${b}${close}`
}

function languageDescription(parameters: LanguageExpressionParameters): string {
  const { a, b, c, template } = parameters
  if (template === 'add-then-multiply') return `Add ${a} and ${b}, then multiply the sum by ${c}.`
  if (template === 'multiply-then-subtract') return `Multiply ${a} by ${b}, then subtract ${c} from the product.`
  return `Add ${a} and ${b}, then subtract the sum from ${c}.`
}

function expressionDistractors(parameters: LanguageExpressionParameters): string[] {
  const { a, b, c, template, grouping } = parameters
  const [open, close] = groupingMarks(grouping)
  if (template === 'add-then-multiply') {
    return [`${a} + ${b} × ${c}`, `${a} × ${open}${b} + ${c}${close}`, `${open}${a} + ${c}${close} × ${b}`]
  }
  if (template === 'multiply-then-subtract') {
    return [`${a} × ${open}${b} - ${c}${close}`, `${a} × ${b} + ${c}`, `${open}${a} - ${c}${close} × ${b}`]
  }
  return [`${open}${c} - ${a}${close} + ${b}`, `${open}${a} + ${b}${close} - ${c}`, `${c} - ${a} × ${b}`]
}

function descriptionDistractors(parameters: LanguageExpressionParameters): string[] {
  const { a, b, c } = parameters
  return [
    `Multiply ${b} by ${c}, then add ${a} to the product.`,
    `Subtract ${c} from ${b}, then multiply the difference by ${a}.`,
    `Add ${a} and ${c}, then multiply the sum by ${b}.`,
    `Subtract ${a} from ${c}, then add ${b}.`,
  ]
}

export function generateWriteNumericalExpressionQuestion(
  difficulty: Difficulty,
): Unit4Question<'write-numerical-expression', LanguageExpressionParameters> {
  const parameters = randomLanguageExpressionParameters(difficulty)
  const correctAnswer = renderLanguageExpression(parameters)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['write-numerical-expression']
  return makeCurriculumQuestion({
    itemType: 'write-numerical-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Which numerical expression records this calculation? ${languageDescription(parameters)}`,
    correctAnswer,
    distractors: expressionDistractors(parameters),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generateInterpretNumericalExpressionQuestion(
  difficulty: Difficulty,
): Unit4Question<'interpret-numerical-expression', LanguageExpressionParameters> {
  const parameters = randomLanguageExpressionParameters(difficulty)
  const correctAnswer = languageDescription(parameters)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['interpret-numerical-expression']
  return makeCurriculumQuestion({
    itemType: 'interpret-numerical-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Which description matches ${renderLanguageExpression(parameters)}?`,
    correctAnswer,
    distractors: descriptionDistractors(parameters),
    parameters,
    workedExample: definition.workedExample,
  })
}

function patternTerm(start: number, step: number, termNumber: number): bigint {
  return BigInt(start) + BigInt(termNumber - 1) * BigInt(step)
}

function coordinatePair(parameters: TwoRulePatternParameters): string {
  return `(${patternTerm(parameters.startA, parameters.stepA, parameters.termNumber)}, ${patternTerm(parameters.startB, parameters.stepB, parameters.termNumber)})`
}

function randomPatternParameters(difficulty: Difficulty): TwoRulePatternParameters {
  const limit = difficulty === 1 ? 8 : difficulty === 2 ? 15 : 25
  return {
    startA: ri(0, limit),
    startB: ri(0, limit),
    stepA: ri(1, limit),
    stepB: ri(1, limit),
    termNumber: difficulty === 1 ? ri(3, 5) : difficulty === 2 ? ri(4, 7) : ri(6, 10),
  }
}

function patternPairDistractors(parameters: TwoRulePatternParameters): string[] {
  const termA = patternTerm(parameters.startA, parameters.stepA, parameters.termNumber)
  const termB = patternTerm(parameters.startB, parameters.stepB, parameters.termNumber)
  const previousA = termA - BigInt(parameters.stepA)
  const previousB = termB - BigInt(parameters.stepB)
  return [
    `(${previousA}, ${previousB})`,
    `(${termB}, ${termA})`,
    `(${termA + BigInt(parameters.stepA)}, ${termB + BigInt(parameters.stepB)})`,
    `(${termA}, ${previousB})`,
  ]
}

export function generateExtendTwoRulePatternsQuestion(
  difficulty: Difficulty,
): Unit4Question<'extend-two-rule-patterns', TwoRulePatternParameters> {
  const parameters = randomPatternParameters(difficulty)
  const correctAnswer = coordinatePair(parameters)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['extend-two-rule-patterns']
  return makeCurriculumQuestion({
    itemType: 'extend-two-rule-patterns',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Pattern A starts at ${parameters.startA} and adds ${parameters.stepA}. Pattern B starts at ${parameters.startB} and adds ${parameters.stepB}. What are the corresponding terms at term ${parameters.termNumber}?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, patternPairDistractors(parameters)),
    parameters,
    workedExample: definition.workedExample,
  })
}

function relationshipAnswer(parameters: PatternRelationshipParameters): string {
  return parameters.direction === 'b-from-a'
    ? `Each term in Pattern B is ${parameters.multiplier} times the corresponding term in Pattern A.`
    : `Each term in Pattern A is 1/${parameters.multiplier} of the corresponding term in Pattern B.`
}

function patternSequence(start: number, step: number, count: number): string {
  return Array.from({ length: count }, (_, index) => String(patternTerm(start, step, index + 1))).join(', ')
}

export function generateIdentifyPatternRelationshipQuestion(
  difficulty: Difficulty,
): Unit4Question<'identify-pattern-relationship', PatternRelationshipParameters> {
  const multiplier = pick([2, 3] as const)
  const startA = ri(1, difficulty === 1 ? 6 : 15)
  const stepA = ri(1, difficulty === 1 ? 5 : 12)
  const termCount = difficulty === 1 ? 3 : difficulty === 2 ? 4 : 5
  const direction: PatternRelationshipParameters['direction'] =
    difficulty === 1 || ri(0, 1) === 0 ? 'b-from-a' : 'a-from-b'
  const parameters: PatternRelationshipParameters = {
    startA,
    stepA,
    multiplier,
    termCount,
    direction,
  }
  const correctAnswer = relationshipAnswer(parameters)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['identify-pattern-relationship']
  return makeCurriculumQuestion({
    itemType: 'identify-pattern-relationship',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Pattern A: ${patternSequence(startA, stepA, termCount)}\nPattern B: ${patternSequence(startA * multiplier, stepA * multiplier, termCount)}\nWhich statement describes the relationship between corresponding terms?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `Each term in Pattern A is ${multiplier} times the corresponding term in Pattern B.`,
      `Each term in Pattern B is ${multiplier} more than the corresponding term in Pattern A.`,
      `Each term in Pattern B is ${multiplier + 1} times the corresponding term in Pattern A.`,
      `Each term in Pattern A is 1/${multiplier + 1} of the corresponding term in Pattern B.`,
      `The corresponding terms in the two patterns are equal.`,
    ]),
    parameters,
    workedExample: definition.workedExample,
  })
}

export function generatePatternOrderedPairQuestion(
  difficulty: Difficulty,
): Unit4Question<'pattern-ordered-pair', TwoRulePatternParameters> {
  const parameters = randomPatternParameters(difficulty)
  const correctAnswer = coordinatePair(parameters)
  const definition = GRADE5_MATH_UNIT4_ITEM_DEFINITIONS['pattern-ordered-pair']
  return makeCurriculumQuestion({
    itemType: 'pattern-ordered-pair',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Pattern A starts at ${parameters.startA} and adds ${parameters.stepA}. Pattern B starts at ${parameters.startB} and adds ${parameters.stepB}. Using Pattern A as x and Pattern B as y, which point represents term ${parameters.termNumber}?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, patternPairDistractors(parameters)),
    parameters,
    workedExample: definition.workedExample,
  })
}

export const GRADE5_MATH_UNIT4_GENERATORS = {
  'division-model-equation': generateDivisionModelEquationQuestion,
  'division-area-model': generateDivisionAreaModelQuestion,
  'partial-quotients': generatePartialQuotientsQuestion,
  'whole-number-quotient': generateWholeNumberQuotientQuestion,
  'division-with-remainder': generateDivisionWithRemainderQuestion,
  'interpret-remainder': generateInterpretRemainderQuestion,
  'evaluate-numerical-expression': generateEvaluateNumericalExpressionQuestion,
  'write-numerical-expression': generateWriteNumericalExpressionQuestion,
  'interpret-numerical-expression': generateInterpretNumericalExpressionQuestion,
  'extend-two-rule-patterns': generateExtendTwoRulePatternsQuestion,
  'identify-pattern-relationship': generateIdentifyPatternRelationshipQuestion,
  'pattern-ordered-pair': generatePatternOrderedPairQuestion,
} satisfies Record<Grade5MathUnit4ItemType, CurriculumGenerator<Grade5MathUnit4Question>>

export function generateGrade5MathUnit4Question<TItemType extends Grade5MathUnit4ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade5MathUnit4Question, { itemType: TItemType }> {
  const generator = GRADE5_MATH_UNIT4_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade5MathUnit4Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
