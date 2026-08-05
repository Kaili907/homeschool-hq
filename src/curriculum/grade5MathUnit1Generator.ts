import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Unit 1, all 18 lesson records (course days
 * 1-18), and 5.OA.1, 5.OA.2, 5.NBT.1, MP.1, MP.3, and MP.6.
 */
export const GRADE5_MATH_UNIT1_ITEM_TYPES = [
  'evaluate-numerical-expression',
  'words-to-expression',
  'expression-to-words',
  'expression-relationship',
  'choose-expression-for-situation',
  'solve-multistep-problem',
  'adjacent-whole-number-place-value',
  'estimate-sum-difference',
  'estimate-product',
  'reasonableness-check',
  'expression-error-analysis',
  'place-value-error-analysis',
] as const

export type Grade5MathUnit1ItemType =
  (typeof GRADE5_MATH_UNIT1_ITEM_TYPES)[number]

interface ExpressionParameters {
  expression: string
}

interface TranslationParameters extends ExpressionParameters {
  phrase: string
}

interface RelationshipParameters extends ExpressionParameters {
  mode: 'multiply' | 'add'
  amount: number
}

interface SituationParameters {
  groups: number
  perGroup: number
  extra: number
}

interface MultistepParameters {
  mode: 'group-and-add' | 'group-and-remove' | 'group-add-remove'
  groups: number
  perGroup: number
  extra: number
  removed: number
}

interface AdjacentPlaceParameters {
  display: string
  digit: number
  comparedExponent: number
  referenceExponent: number
}

interface EstimateSumDifferenceParameters {
  left: number
  right: number
  operation: '+' | '-'
  roundingUnit: number
}

interface EstimateProductParameters {
  left: number
  right: number
  leftRoundingUnit: number
  rightRoundingUnit: number
}

interface ReasonablenessParameters {
  left: number
  right: number
  operation: '+' | '-' | '×'
  roundingUnit: number
  proposed: number
}

interface ExpressionErrorParameters extends ExpressionParameters {
  claimed: number
}

interface PlaceValueErrorParameters extends AdjacentPlaceParameters {
  claimedRelation: string
}

type Unit1Question<
  TItemType extends Grade5MathUnit1ItemType,
  TParameters,
> = CurriculumQuestion<TItemType, TParameters>

export type Grade5MathUnit1Question =
  | Unit1Question<'evaluate-numerical-expression', ExpressionParameters>
  | Unit1Question<'words-to-expression', TranslationParameters>
  | Unit1Question<'expression-to-words', TranslationParameters>
  | Unit1Question<'expression-relationship', RelationshipParameters>
  | Unit1Question<'choose-expression-for-situation', SituationParameters>
  | Unit1Question<'solve-multistep-problem', MultistepParameters>
  | Unit1Question<'adjacent-whole-number-place-value', AdjacentPlaceParameters>
  | Unit1Question<'estimate-sum-difference', EstimateSumDifferenceParameters>
  | Unit1Question<'estimate-product', EstimateProductParameters>
  | Unit1Question<'reasonableness-check', ReasonablenessParameters>
  | Unit1Question<'expression-error-analysis', ExpressionErrorParameters>
  | Unit1Question<'place-value-error-analysis', PlaceValueErrorParameters>

type Unit1Standard = '5.OA.1' | '5.OA.2' | '5.NBT.1' | 'MP.1' | 'MP.3' | 'MP.6'

interface ItemDefinition {
  standard: Unit1Standard
  lessonFocus:
    | 'problem-solving routines'
    | 'reading and writing numerical expressions'
    | 'place-value language'
    | 'estimation and reasonableness'
    | 'explaining strategies'
    | 'analyzing errors'
  workedExample: CurriculumWorkedExample
}

export const GRADE5_MATH_UNIT1_ITEM_DEFINITIONS = {
  'evaluate-numerical-expression': {
    standard: '5.OA.1',
    lessonFocus: 'reading and writing numerical expressions',
    workedExample: {
      prompt: 'Evaluate {18 + [6 × (9 - 4)]}.',
      answer: '48',
      steps: [
        'Evaluate the innermost grouping first: 9 - 4 = 5.',
        'Multiply inside the brackets: 6 × 5 = 30.',
        'Add inside the braces: 18 + 30 = 48.',
      ],
    },
  },
  'words-to-expression': {
    standard: '5.OA.2',
    lessonFocus: 'reading and writing numerical expressions',
    workedExample: {
      prompt:
        'Write an expression for: Add 8 and 7, then multiply the sum by 2.',
      answer: '(8 + 7) × 2',
      steps: [
        'The first calculation is 8 + 7, so group it as (8 + 7).',
        'Multiply that entire sum by 2: (8 + 7) × 2.',
      ],
    },
  },
  'expression-to-words': {
    standard: '5.OA.2',
    lessonFocus: 'reading and writing numerical expressions',
    workedExample: {
      prompt: 'Describe 5 × (12 + 3) in words without evaluating it.',
      answer: 'Add 12 and 3, then multiply the sum by 5.',
      steps: [
        'The parentheses show that 12 and 3 are added first.',
        'The 5 multiplies the entire sum.',
      ],
    },
  },
  'expression-relationship': {
    standard: '5.OA.2',
    lessonFocus: 'explaining strategies',
    workedExample: {
      prompt:
        'Let E represent 18 + 7. Without evaluating, compare 4 × (18 + 7) with E.',
      answer: '4 times as large as E',
      steps: [
        'The parentheses contain the same expression represented by E.',
        'The factor 4 multiplies that entire expression, so the new expression is 4 times E.',
      ],
    },
  },
  'choose-expression-for-situation': {
    standard: '5.OA.2',
    lessonFocus: 'problem-solving routines',
    workedExample: {
      prompt:
        'Six boxes hold 8 markers each, and 3 markers are loose. Which expression represents the total?',
      answer: '6 × 8 + 3',
      steps: [
        'Six equal groups of 8 are represented by 6 × 8.',
        'Add the 3 loose markers: 6 × 8 + 3.',
      ],
    },
  },
  'solve-multistep-problem': {
    standard: 'MP.1',
    lessonFocus: 'problem-solving routines',
    workedExample: {
      prompt:
        'Seven trays hold 12 seedlings each. Five more seedlings are beside the trays. How many seedlings are there?',
      answer: '89',
      steps: [
        'Find the seedlings in trays: 7 × 12 = 84.',
        'Add the 5 seedlings beside the trays: 84 + 5 = 89.',
        'Check that the answer is greater than 84 because seedlings were added.',
      ],
    },
  },
  'adjacent-whole-number-place-value': {
    standard: '5.NBT.1',
    lessonFocus: 'place-value language',
    workedExample: {
      prompt:
        'In 55,240, compare the value of the 5 in the ten-thousands place with the 5 in the thousands place.',
      answer: '10 times as much',
      steps: [
        'The first 5 represents 50,000 and the second 5 represents 5,000.',
        '50,000 is 10 times 5,000.',
      ],
    },
  },
  'estimate-sum-difference': {
    standard: 'MP.6',
    lessonFocus: 'estimation and reasonableness',
    workedExample: {
      prompt: 'Round each number to the nearest hundred to estimate 347 + 281.',
      answer: '600',
      steps: [
        'Round 347 to 300 and 281 to 300.',
        'Add the rounded numbers: 300 + 300 = 600.',
      ],
    },
  },
  'estimate-product': {
    standard: 'MP.6',
    lessonFocus: 'estimation and reasonableness',
    workedExample: {
      prompt: 'Round each factor to the nearest ten to estimate 47 × 62.',
      answer: '3,000',
      steps: [
        'Round 47 to 50 and 62 to 60.',
        'Multiply the rounded factors: 50 × 60 = 3,000.',
      ],
    },
  },
  'reasonableness-check': {
    standard: 'MP.6',
    lessonFocus: 'estimation and reasonableness',
    workedExample: {
      prompt:
        'A student says 347 + 281 = 628. Round each number to the nearest hundred to check the claim.',
      answer: 'The claim is exact; the rounded estimate is 600.',
      steps: [
        'Compute the exact sum: 347 + 281 = 628.',
        'Round the addends: 300 + 300 = 600.',
        'The exact result is close to the estimate, and the stated equality is correct.',
      ],
    },
  },
  'expression-error-analysis': {
    standard: 'MP.3',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt:
        'A student adds 9 and 4 before multiplying when evaluating 9 + (4 × 6). Identify and correct the error.',
      answer:
        'The student added before multiplying; 4 × 6 should be evaluated first, giving 33.',
      steps: [
        'Name the error: the student ignored the grouped multiplication.',
        'Evaluate the parentheses first: 4 × 6 = 24.',
        'Then add 9: 9 + 24 = 33, which corrects both the reasoning and result.',
      ],
    },
  },
  'place-value-error-analysis': {
    standard: '5.NBT.1',
    lessonFocus: 'analyzing errors',
    workedExample: {
      prompt:
        'A student says the 6 in the thousands place of 6,600 is 100 times the value of the 6 in the hundreds place. Analyze the claim.',
      answer:
        "The values are 6,000 and 600; 6,000 is 10 times as much as 600, so the student's comparison is incorrect.",
      steps: [
        'The 6 in the thousands place represents 6,000.',
        'The 6 in the hundreds place represents 600.',
        'Because 6,000 = 10 × 600, the first value is 10 times as much.',
      ],
    },
  },
} as const satisfies Record<Grade5MathUnit1ItemType, ItemDefinition>

const PLACE_BY_EXPONENT: Record<number, string> = {
  6: 'millions',
  5: 'hundred-thousands',
  4: 'ten-thousands',
  3: 'thousands',
  2: 'hundreds',
  1: 'tens',
  0: 'ones',
}

const UNIT_BY_EXPONENT = [
  1, 10, 100, 1_000, 10_000, 100_000, 1_000_000,
] as const

const PLACE_BY_UNIT: Record<number, string> = {
  10: 'ten',
  100: 'hundred',
  1_000: 'thousand',
}

interface ExpressionChoice {
  text: string
  value: number
}

interface TranslationSpec {
  expression: string
  phrase: string
  value: number
  alternatives: readonly ExpressionChoice[]
  alternativePhrases: readonly ExpressionChoice[]
}

const uniqueExcept = (
  correct: string,
  candidates: readonly string[],
): string[] =>
  [...new Set(candidates)].filter(
    (candidate) => candidate !== correct && candidate.trim() !== '',
  )

function numericDistractors(
  correct: number,
  candidates: readonly number[],
): string[] {
  return [
    ...new Set([
      ...candidates,
      correct + 1,
      correct + 2,
      correct + 10,
      Math.max(0, correct - 1),
      Math.max(0, correct - 2),
    ]),
  ]
    .filter(
      (candidate) =>
        Number.isSafeInteger(candidate) &&
        candidate >= 0 &&
        candidate !== correct,
    )
    .map(String)
}

function expressionDistractors(spec: TranslationSpec): string[] {
  return uniqueExcept(
    spec.expression,
    spec.alternatives
      .filter(
        (candidate) => candidate.value >= 0 && candidate.value !== spec.value,
      )
      .map((candidate) => candidate.text),
  )
}

function roundToUnit(value: number, unit: number): number {
  const lowerUnits = Math.floor(value / unit)
  const remainder = value % unit
  return (lowerUnits + (remainder * 2 >= unit ? 1 : 0)) * unit
}

function relationForExponents(
  comparedExponent: number,
  referenceExponent: number,
): string {
  return comparedExponent > referenceExponent
    ? '10 times as much'
    : '1/10 as much'
}

function randomTranslation(difficulty: Difficulty): TranslationSpec {
  if (difficulty === 1) {
    const a = ri(2, 20)
    const b = ri(2, 20)
    const c = ri(2, 9)
    return {
      expression: `(${a} + ${b}) × ${c}`,
      phrase: `Add ${a} and ${b}, then multiply the sum by ${c}.`,
      value: (a + b) * c,
      alternatives: [
        { text: `${a} + (${b} × ${c})`, value: a + b * c },
        { text: `(${a} × ${b}) + ${c}`, value: a * b + c },
        { text: `${a} + ${b} + ${c}`, value: a + b + c },
        { text: `${a} × (${b} + ${c})`, value: a * (b + c) },
        { text: `(${a} + ${c}) × ${b}`, value: (a + c) * b },
      ],
      alternativePhrases: [
        { text: `Multiply ${b} by ${c}, then add ${a}.`, value: a + b * c },
        { text: `Multiply ${a} by ${b}, then add ${c}.`, value: a * b + c },
        { text: `Add ${a}, ${b}, and ${c}.`, value: a + b + c },
        {
          text: `Add ${b} and ${c}, then multiply the sum by ${a}.`,
          value: a * (b + c),
        },
        { text: `Subtract ${b} from ${a}, then add ${c}.`, value: a - b + c },
        {
          text: `Multiply ${a} by ${b}, then subtract ${c}.`,
          value: a * b - c,
        },
      ],
    }
  }

  if (difficulty === 2) {
    const b = ri(3, 18)
    const c = ri(2, 9)
    const a = b * c + ri(10, 80)
    return {
      expression: `${a} - (${b} × ${c})`,
      phrase: `Multiply ${b} by ${c}, then subtract the product from ${a}.`,
      value: a - b * c,
      alternatives: [
        { text: `(${a} - ${b}) × ${c}`, value: (a - b) * c },
        { text: `${a} - (${b} + ${c})`, value: a - (b + c) },
        { text: `${a} + (${b} × ${c})`, value: a + b * c },
        { text: `(${a} + ${b}) × ${c}`, value: (a + b) * c },
        { text: `${a} - ${b} + ${c}`, value: a - b + c },
      ],
      alternativePhrases: [
        {
          text: `Subtract ${b} from ${a}, then multiply the difference by ${c}.`,
          value: (a - b) * c,
        },
        {
          text: `Add ${b} and ${c}, then subtract the sum from ${a}.`,
          value: a - (b + c),
        },
        {
          text: `Multiply ${b} by ${c}, then add the product to ${a}.`,
          value: a + b * c,
        },
        {
          text: `Add ${a} and ${b}, then multiply the sum by ${c}.`,
          value: (a + b) * c,
        },
      ],
    }
  }

  const a = ri(10, 90)
  const b = ri(2, 9)
  const d = ri(2, 12)
  const c = d + ri(2, 15)
  return {
    expression: `${a} + [${b} × (${c} - ${d})]`,
    phrase: `Subtract ${d} from ${c}, multiply the difference by ${b}, then add ${a}.`,
    value: a + b * (c - d),
    alternatives: [
      { text: `(${a} + ${b}) × (${c} - ${d})`, value: (a + b) * (c - d) },
      { text: `${a} + [${b} × (${c} + ${d})]`, value: a + b * (c + d) },
      { text: `[${a} + (${b} × ${c})] - ${d}`, value: a + b * c - d },
      { text: `${a} + ${b} × ${c} + ${d}`, value: a + b * c + d },
      { text: `${a} × [${b} + (${c} - ${d})]`, value: a * (b + c - d) },
    ],
    alternativePhrases: [
      {
        text: `Add ${a} and ${b}, then multiply the sum by the difference of ${c} and ${d}.`,
        value: (a + b) * (c - d),
      },
      {
        text: `Add ${c} and ${d}, multiply the sum by ${b}, then add ${a}.`,
        value: a + b * (c + d),
      },
      {
        text: `Multiply ${b} by ${c}, add ${a}, then subtract ${d}.`,
        value: a + b * c - d,
      },
      {
        text: `Subtract ${d} from ${c}, add ${b}, then multiply the sum by ${a}.`,
        value: a * (b + c - d),
      },
    ],
  }
}

function randomAdjacentPlaces(difficulty: Difficulty): {
  display: string
  digit: number
  comparedExponent: number
  referenceExponent: number
} {
  const pairs =
    difficulty === 1
      ? ([
          [2, 1],
          [1, 0],
        ] as const)
      : difficulty === 2
        ? ([
            [4, 3],
            [3, 2],
            [2, 1],
            [1, 0],
          ] as const)
        : ([
            [6, 5],
            [5, 4],
            [4, 3],
            [3, 2],
            [2, 1],
            [1, 0],
          ] as const)
  const [greaterExponent, lesserExponent] = pick(pairs)
  const highestExponent = difficulty === 1 ? 3 : difficulty === 2 ? 5 : 6
  const digits = Array.from({ length: highestExponent + 1 }, () => ri(1, 9))
  const digit = ri(1, 9)
  digits[highestExponent - greaterExponent] = digit
  digits[highestExponent - lesserExponent] = digit
  const compareGreaterToLesser = ri(0, 1) === 1
  return {
    display: digits.join(''),
    digit,
    comparedExponent: compareGreaterToLesser ? greaterExponent : lesserExponent,
    referenceExponent: compareGreaterToLesser
      ? lesserExponent
      : greaterExponent,
  }
}

function randomRoundingOperand(
  unit: number,
  minimumMultiple: number,
  maximumMultiple: number,
  forceHalf: boolean,
): number {
  const multiple = ri(minimumMultiple, maximumMultiple)
  const remainder = forceHalf ? unit / 2 : ri(1, unit - 1)
  return multiple * unit + remainder
}

export function generateEvaluateNumericalExpressionQuestion(
  difficulty: Difficulty,
): Unit1Question<'evaluate-numerical-expression', ExpressionParameters> {
  let expression: string
  let correct: number
  let commonErrors: number[]
  if (difficulty === 1) {
    const a = ri(2, 30)
    const b = ri(2, 12)
    const c = ri(2, 9)
    expression = `${a} + (${b} × ${c})`
    correct = a + b * c
    commonErrors = [(a + b) * c, a + b + c, a * b + c]
  } else if (difficulty === 2) {
    const a = ri(10, 70)
    const b = ri(2, 12)
    const c = ri(2, 9)
    const subtotal = a + b * c
    const d = ri(2, subtotal - 1)
    expression = `[${a} + (${b} × ${c})] - ${d}`
    correct = subtotal - d
    commonErrors = [(a + b) * c - d, a + b * (c - d), subtotal + d]
  } else {
    const a = ri(2, 12)
    const b = ri(3, 20)
    const d = ri(2, 12)
    const c = d + ri(2, 15)
    const e = ri(2, 40)
    expression = `{${a} × [${b} + (${c} - ${d})]} + ${e}`
    correct = a * (b + c - d) + e
    commonErrors = [a * b + c - d + e, a * (b + c) - d + e, a * (b + c - d + e)]
  }
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['evaluate-numerical-expression']
  return makeCurriculumQuestion({
    itemType: 'evaluate-numerical-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Evaluate ${expression}.`,
    correctAnswer: String(correct),
    distractors: numericDistractors(correct, commonErrors),
    parameters: { expression },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateWordsToExpressionQuestion(
  difficulty: Difficulty,
): Unit1Question<'words-to-expression', TranslationParameters> {
  const spec = randomTranslation(difficulty)
  const definition = GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['words-to-expression']
  return makeCurriculumQuestion({
    itemType: 'words-to-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Which expression means: “${spec.phrase}”`,
    correctAnswer: spec.expression,
    distractors: expressionDistractors(spec),
    parameters: { expression: spec.expression, phrase: spec.phrase },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateExpressionToWordsQuestion(
  difficulty: Difficulty,
): Unit1Question<'expression-to-words', TranslationParameters> {
  const spec = randomTranslation(difficulty)
  const definition = GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['expression-to-words']
  return makeCurriculumQuestion({
    itemType: 'expression-to-words',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Which phrase describes ${spec.expression} without evaluating it?`,
    correctAnswer: spec.phrase,
    distractors: uniqueExcept(
      spec.phrase,
      spec.alternativePhrases
        .filter(
          (candidate) => candidate.value >= 0 && candidate.value !== spec.value,
        )
        .map((candidate) => candidate.text),
    ),
    parameters: { expression: spec.expression, phrase: spec.phrase },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateExpressionRelationshipQuestion(
  difficulty: Difficulty,
): Unit1Question<'expression-relationship', RelationshipParameters> {
  const left = difficulty === 1 ? ri(10, 99) : ri(100, 9_999)
  const right = difficulty === 1 ? ri(10, 99) : ri(100, 9_999)
  const expression = `${left} + ${right}`
  const mode = difficulty === 2 ? 'add' : 'multiply'
  const amount =
    mode === 'multiply' ? ri(2, difficulty === 1 ? 5 : 12) : ri(10, 900)
  const correctAnswer =
    mode === 'multiply'
      ? `${amount} times as large as E`
      : `${amount} greater than E`
  const distractors =
    mode === 'multiply'
      ? [
          `${amount} greater than E`,
          `${amount + 1} times as large as E`,
          `1/${amount} as large as E`,
          `${amount - 1} times as large as E`,
        ]
      : [
          `${amount} times as large as E`,
          `${amount + 1} greater than E`,
          `${amount} less than E`,
          `${amount - 1} greater than E`,
        ]
  const comparedExpression =
    mode === 'multiply'
      ? `${amount} × (${expression})`
      : `(${expression}) + ${amount}`
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['expression-relationship']
  return makeCurriculumQuestion({
    itemType: 'expression-relationship',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Let E represent ${expression}. Without evaluating, how does ${comparedExpression} compare with E?`,
    correctAnswer,
    distractors,
    parameters: { expression, mode, amount },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateChooseExpressionForSituationQuestion(
  difficulty: Difficulty,
): Unit1Question<'choose-expression-for-situation', SituationParameters> {
  const groups =
    difficulty === 1 ? ri(3, 9) : difficulty === 2 ? ri(8, 30) : ri(20, 90)
  const perGroup =
    difficulty === 1 ? ri(4, 12) : difficulty === 2 ? ri(10, 40) : ri(25, 120)
  const extra = ri(2, Math.min(perGroup - 1, difficulty * 12 + 4))
  const correctValue = groups * perGroup + extra
  const expression = `${groups} × ${perGroup} + ${extra}`
  const candidates: ExpressionChoice[] = [
    {
      text: `(${groups} + ${extra}) × ${perGroup}`,
      value: (groups + extra) * perGroup,
    },
    {
      text: `${groups} × (${perGroup} + ${extra})`,
      value: groups * (perGroup + extra),
    },
    {
      text: `${groups} + ${perGroup} + ${extra}`,
      value: groups + perGroup + extra,
    },
    {
      text: `(${groups} + ${perGroup}) × ${extra}`,
      value: (groups + perGroup) * extra,
    },
    {
      text: `${groups} × ${perGroup} - ${extra}`,
      value: groups * perGroup - extra,
    },
  ]
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['choose-expression-for-situation']
  return makeCurriculumQuestion({
    itemType: 'choose-expression-for-situation',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A supply cart has ${groups} boxes with ${perGroup} markers in each box and ${extra} loose markers. Which expression represents the total number of markers?`,
    correctAnswer: expression,
    distractors: candidates
      .filter(
        (candidate) => candidate.value >= 0 && candidate.value !== correctValue,
      )
      .map((candidate) => candidate.text),
    parameters: { groups, perGroup, extra },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSolveMultistepProblemQuestion(
  difficulty: Difficulty,
): Unit1Question<'solve-multistep-problem', MultistepParameters> {
  const groups =
    difficulty === 1 ? ri(3, 9) : difficulty === 2 ? ri(8, 25) : ri(15, 60)
  const perGroup =
    difficulty === 1 ? ri(4, 12) : difficulty === 2 ? ri(12, 40) : ri(25, 80)
  const extra =
    difficulty === 1 ? ri(2, 15) : difficulty === 3 ? ri(20, 100) : 0
  const removed =
    difficulty === 1
      ? 0
      : ri(2, Math.min(groups * perGroup - 1, difficulty * 25))
  const mode =
    difficulty === 1
      ? 'group-and-add'
      : difficulty === 2
        ? 'group-and-remove'
        : 'group-add-remove'
  const product = groups * perGroup
  const correct = product + extra - removed
  const prompt =
    mode === 'group-and-add'
      ? `A garden has ${groups} trays with ${perGroup} seedlings in each tray and ${extra} extra seedlings. How many seedlings are there in all?`
      : mode === 'group-and-remove'
        ? `A library has ${groups} shelves with ${perGroup} books on each shelf. Then ${removed} books are loaned out. How many books remain?`
        : `A team packs ${groups} crates with ${perGroup} bottles in each crate, adds ${extra} loose bottles, and then uses ${removed} bottles. How many bottles remain?`
  const commonErrors = [
    product + extra + removed,
    product - extra - removed,
    groups + perGroup + extra - removed,
    product - removed,
    product + extra,
  ]
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['solve-multistep-problem']
  return makeCurriculumQuestion({
    itemType: 'solve-multistep-problem',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt,
    correctAnswer: String(correct),
    distractors: numericDistractors(correct, commonErrors),
    parameters: { mode, groups, perGroup, extra, removed },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateAdjacentWholeNumberPlaceValueQuestion(
  difficulty: Difficulty,
): Unit1Question<'adjacent-whole-number-place-value', AdjacentPlaceParameters> {
  const parameters = randomAdjacentPlaces(difficulty)
  const correctAnswer = relationForExponents(
    parameters.comparedExponent,
    parameters.referenceExponent,
  )
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['adjacent-whole-number-place-value']
  return makeCurriculumQuestion({
    itemType: 'adjacent-whole-number-place-value',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `In ${parameters.display}, how does the value of the ${parameters.digit} in the ${PLACE_BY_EXPONENT[parameters.comparedExponent]} place compare with the value of the ${parameters.digit} in the ${PLACE_BY_EXPONENT[parameters.referenceExponent]} place?`,
    correctAnswer,
    distractors: [
      '10 times as much',
      '1/10 as much',
      '100 times as much',
      'the same value',
    ],
    parameters,
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateEstimateSumDifferenceQuestion(
  difficulty: Difficulty,
): Unit1Question<'estimate-sum-difference', EstimateSumDifferenceParameters> {
  const roundingUnit = difficulty === 1 ? 10 : difficulty === 2 ? 100 : 1_000
  const forceHalf = difficulty === 3
  const maximumMultiple = difficulty === 3 ? 900 : 90
  let left = randomRoundingOperand(roundingUnit, 2, maximumMultiple, forceHalf)
  let right = randomRoundingOperand(roundingUnit, 2, maximumMultiple, forceHalf)
  const operation = difficulty === 1 ? '+' : pick(['+', '-'] as const)
  if (operation === '-' && left < right) [left, right] = [right, left]
  const roundedLeft = roundToUnit(left, roundingUnit)
  const roundedRight = roundToUnit(right, roundingUnit)
  const correct =
    operation === '+' ? roundedLeft + roundedRight : roundedLeft - roundedRight
  const exact = operation === '+' ? left + right : left - right
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['estimate-sum-difference']
  return makeCurriculumQuestion({
    itemType: 'estimate-sum-difference',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Round each number to the nearest ${PLACE_BY_UNIT[roundingUnit]} to estimate ${left} ${operation} ${right}.`,
    correctAnswer: String(correct),
    distractors: numericDistractors(correct, [
      exact,
      correct + roundingUnit,
      Math.max(0, correct - roundingUnit),
      roundedLeft + roundedRight,
      Math.abs(roundedLeft - roundedRight),
    ]),
    parameters: { left, right, operation, roundingUnit },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateEstimateProductQuestion(
  difficulty: Difficulty,
): Unit1Question<'estimate-product', EstimateProductParameters> {
  const leftRoundingUnit = difficulty === 1 ? 10 : 100
  const rightRoundingUnit = 10
  const left = randomRoundingOperand(
    leftRoundingUnit,
    difficulty === 1 ? 2 : 1,
    9,
    difficulty === 3,
  )
  const right = randomRoundingOperand(rightRoundingUnit, 2, 9, difficulty === 3)
  const roundedLeft = roundToUnit(left, leftRoundingUnit)
  const roundedRight = roundToUnit(right, rightRoundingUnit)
  const correct = roundedLeft * roundedRight
  const definition = GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['estimate-product']
  return makeCurriculumQuestion({
    itemType: 'estimate-product',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Round ${left} to the nearest ${PLACE_BY_UNIT[leftRoundingUnit]} and ${right} to the nearest ${PLACE_BY_UNIT[rightRoundingUnit]}, then multiply to estimate the product.`,
    correctAnswer: String(correct),
    distractors: numericDistractors(correct, [
      roundedLeft * right,
      left * roundedRight,
      left * right,
      (roundedLeft + leftRoundingUnit) * roundedRight,
      Math.max(0, roundedLeft - leftRoundingUnit) * roundedRight,
    ]),
    parameters: { left, right, leftRoundingUnit, rightRoundingUnit },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateReasonablenessCheckQuestion(
  difficulty: Difficulty,
): Unit1Question<'reasonableness-check', ReasonablenessParameters> {
  const operation = difficulty === 1 ? '+' : difficulty === 2 ? '-' : '×'
  const roundingUnit = difficulty === 2 ? 100 : 10
  const maximumMultiple = difficulty === 2 ? 90 : 9
  let left = randomRoundingOperand(roundingUnit, 2, maximumMultiple, false)
  let right = randomRoundingOperand(roundingUnit, 2, maximumMultiple, false)
  if (operation === '-' && left < right) [left, right] = [right, left]
  const actual =
    operation === '+'
      ? left + right
      : operation === '-'
        ? left - right
        : left * right
  const estimate =
    operation === '×'
      ? roundToUnit(left, roundingUnit) * roundToUnit(right, roundingUnit)
      : operation === '+'
        ? roundToUnit(left, roundingUnit) + roundToUnit(right, roundingUnit)
        : roundToUnit(left, roundingUnit) - roundToUnit(right, roundingUnit)
  const claimIsExact = ri(0, 1) === 1
  const proposed = claimIsExact ? actual : actual + roundingUnit
  const correctAnswer = claimIsExact
    ? `The claim is exact; the rounded estimate is ${estimate}.`
    : `The claim is not exact; the exact result is ${actual} and the rounded estimate is ${estimate}.`
  const distractors = claimIsExact
    ? [
        `The claim is not exact; the exact result is ${actual} and the rounded estimate is ${estimate}.`,
        `The claim is exact; the rounded estimate is ${estimate + roundingUnit}.`,
        `The claim is not exact; the exact result is ${actual + roundingUnit} and the rounded estimate is ${estimate}.`,
        `The claim is exact; the rounded estimate is ${Math.max(0, estimate - roundingUnit)}.`,
      ]
    : [
        `The claim is exact; the rounded estimate is ${estimate}.`,
        `The claim is not exact; the exact result is ${proposed} and the rounded estimate is ${estimate}.`,
        `The claim is not exact; the exact result is ${actual} and the rounded estimate is ${estimate + roundingUnit}.`,
        `The claim is exact; the rounded estimate is ${estimate + roundingUnit}.`,
      ]
  const definition = GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['reasonableness-check']
  return makeCurriculumQuestion({
    itemType: 'reasonableness-check',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student says ${left} ${operation} ${right} = ${proposed}. Round each number to the nearest ${PLACE_BY_UNIT[roundingUnit]}. Which choice correctly checks the claim?`,
    correctAnswer,
    distractors,
    parameters: { left, right, operation, roundingUnit, proposed },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateExpressionErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit1Question<'expression-error-analysis', ExpressionErrorParameters> {
  let expression: string
  let correct: number
  let claimed: number
  let reasoning: string
  let correctAnswer: string
  if (difficulty === 1) {
    const a = ri(2, 20)
    const b = ri(2, 12)
    const c = ri(2, 9)
    expression = `${a} + (${b} × ${c})`
    correct = a + b * c
    claimed = (a + b) * c
    reasoning = `They add ${a} and ${b} first, then multiply by ${c}, so the value is ${claimed}.`
    correctAnswer = `The student added before multiplying; ${b} × ${c} should be evaluated first, giving ${correct}.`
  } else if (difficulty === 2) {
    const a = ri(10, 80)
    const b = ri(2, 15)
    const c = ri(2, 9)
    const d = ri(2, 20)
    expression = `[${a} + ${b}] × ${c} - ${d}`
    correct = (a + b) * c - d
    claimed = a + b * c - d
    reasoning = `They multiply ${b} by ${c} first, then finish the calculation, so the value is ${claimed}.`
    correctAnswer = `The student multiplied before evaluating [${a} + ${b}]; the grouped sum is ${a + b}, giving ${correct}.`
  } else {
    const a = ri(2, 12)
    const b = ri(5, 25)
    const d = ri(2, 12)
    const c = d + ri(2, 15)
    const e = ri(2, 30)
    expression = `${a} × [${b} + (${c} - ${d})] + ${e}`
    correct = a * (b + c - d) + e
    claimed = a * b + c - d + e
    reasoning = `They multiply ${a} by ${b} first, then finish the calculation, so the value is ${claimed}.`
    correctAnswer = `The student multiplied before evaluating (${c} - ${d}); the innermost difference is ${c - d}, giving ${correct}.`
  }
  const distractors = [
    `The work is correct; ${claimed} is the value.`,
    `The grouping symbols do not affect the order; ${claimed} is the value.`,
    `The first error is in the final addition or subtraction; the value should be ${correct + 1}.`,
    `The student used the right first step but made an arithmetic slip; the value should be ${correct + 2}.`,
  ]
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['expression-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'expression-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student evaluates ${expression}: “${reasoning}” Which statement best identifies the error?`,
    correctAnswer,
    distractors,
    parameters: { expression, claimed },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generatePlaceValueErrorAnalysisQuestion(
  difficulty: Difficulty,
): Unit1Question<'place-value-error-analysis', PlaceValueErrorParameters> {
  const places = randomAdjacentPlaces(difficulty)
  const correctRelation = relationForExponents(
    places.comparedExponent,
    places.referenceExponent,
  )
  const relationChoices = [
    '10 times as much',
    '1/10 as much',
    '100 times as much',
    'the same value',
  ]
  const claimedRelation = pick(
    relationChoices.filter((relation) => relation !== correctRelation),
  )
  const parameters = { ...places, claimedRelation }
  const comparedValue = places.digit * UNIT_BY_EXPONENT[places.comparedExponent]
  const referenceValue =
    places.digit * UNIT_BY_EXPONENT[places.referenceExponent]
  const correctAnswer = `The values are ${comparedValue} and ${referenceValue}; ${comparedValue} is ${correctRelation} as ${referenceValue}, so the student's comparison is incorrect.`
  const reverseRelation =
    correctRelation === '10 times as much' ? '1/10 as much' : '10 times as much'
  const distractors = [
    `The values are ${comparedValue} and ${referenceValue}; ${comparedValue} is ${claimedRelation} as ${referenceValue}, so the student's comparison is correct.`,
    `Both digits have value ${places.digit}; repeated digits always have the same value.`,
    `The places are adjacent, so ${comparedValue} is 100 times as much as ${referenceValue}.`,
    `The values are ${comparedValue} and ${referenceValue}; ${comparedValue} is ${reverseRelation} as ${referenceValue}.`,
  ]
  const definition =
    GRADE5_MATH_UNIT1_ITEM_DEFINITIONS['place-value-error-analysis']
  return makeCurriculumQuestion({
    itemType: 'place-value-error-analysis',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A student says, “In ${parameters.display}, the value of the ${parameters.digit} in the ${PLACE_BY_EXPONENT[parameters.comparedExponent]} place is ${claimedRelation} as the value of the ${parameters.digit} in the ${PLACE_BY_EXPONENT[parameters.referenceExponent]} place.” Which statement best analyzes the error?`,
    correctAnswer,
    distractors,
    parameters,
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const GRADE5_MATH_UNIT1_GENERATORS = {
  'evaluate-numerical-expression': generateEvaluateNumericalExpressionQuestion,
  'words-to-expression': generateWordsToExpressionQuestion,
  'expression-to-words': generateExpressionToWordsQuestion,
  'expression-relationship': generateExpressionRelationshipQuestion,
  'choose-expression-for-situation':
    generateChooseExpressionForSituationQuestion,
  'solve-multistep-problem': generateSolveMultistepProblemQuestion,
  'adjacent-whole-number-place-value':
    generateAdjacentWholeNumberPlaceValueQuestion,
  'estimate-sum-difference': generateEstimateSumDifferenceQuestion,
  'estimate-product': generateEstimateProductQuestion,
  'reasonableness-check': generateReasonablenessCheckQuestion,
  'expression-error-analysis': generateExpressionErrorAnalysisQuestion,
  'place-value-error-analysis': generatePlaceValueErrorAnalysisQuestion,
} satisfies Record<
  Grade5MathUnit1ItemType,
  CurriculumGenerator<Grade5MathUnit1Question>
>

export function generateGrade5MathUnit1Question<
  TItemType extends Grade5MathUnit1ItemType,
>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade5MathUnit1Question, { itemType: TItemType }> {
  const generator = GRADE5_MATH_UNIT1_GENERATORS[
    itemType
  ] as CurriculumGenerator<
    Extract<Grade5MathUnit1Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
