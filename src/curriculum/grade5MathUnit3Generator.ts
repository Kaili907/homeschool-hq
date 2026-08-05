import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/** Coverage contract derived from Unit 3, all 18 lesson records, and 5.NBT.5/5.OA.1/5.OA.2. */
export const GRADE5_MATH_UNIT3_ITEM_TYPES = [
  'multiplicative-comparison',
  'area-model-product',
  'partial-products',
  'standard-algorithm',
  'estimate-product',
  'write-grouped-expression',
  'evaluate-grouped-expression',
  'interpret-expression',
  'multi-step-multiplication',
] as const

export type Grade5MathUnit3ItemType =
  (typeof GRADE5_MATH_UNIT3_ITEM_TYPES)[number]

interface MultiplicativeComparisonParameters {
  mode: 'find-compared' | 'find-reference' | 'find-factor'
  reference: number
  factor: number
  compared: number
}

interface AreaModelParameters {
  multiplicand: number
  multiplier: number
  multiplicandParts: readonly number[]
  multiplierParts: readonly number[]
}

interface PartialProductsParameters extends AreaModelParameters {
  partialProducts: readonly number[]
}

interface StandardAlgorithmParameters {
  multiplicand: number
  multiplier: number
}

interface EstimateProductParameters {
  mode: 'estimate' | 'reasonableness'
  multiplicand: number
  multiplier: number
  roundMultiplicandTo: number
  roundMultiplierTo: number
  claimedProduct?: number
}

interface GroupedExpressionParameters {
  template: 'sum-times' | 'difference-times' | 'product-plus' | 'two-sums'
  values: readonly number[]
  expression: string
}

interface EvaluateExpressionParameters {
  expression: string
  value: number
}

interface InterpretExpressionParameters {
  template:
    | 'factor-times-sum'
    | 'difference-times-factor'
    | 'product-plus'
    | 'sum-times-difference'
  values: readonly number[]
  expression: string
}

type MultiStepParameters =
  | {
      context: 'inventory'
      tables: number
      boxesPerTable: number
      itemsPerBox: number
      looseItems: number
    }
  | {
      context: 'revenue'
      days: number
      ticketsPerDay: number
      pricePerTicket: number
    }

type Unit3Question<
  TItemType extends Grade5MathUnit3ItemType,
  TParameters,
> = CurriculumQuestion<TItemType, TParameters>

export type Grade5MathUnit3Question =
  | Unit3Question<
      'multiplicative-comparison',
      MultiplicativeComparisonParameters
    >
  | Unit3Question<'area-model-product', AreaModelParameters>
  | Unit3Question<'partial-products', PartialProductsParameters>
  | Unit3Question<'standard-algorithm', StandardAlgorithmParameters>
  | Unit3Question<'estimate-product', EstimateProductParameters>
  | Unit3Question<'write-grouped-expression', GroupedExpressionParameters>
  | Unit3Question<'evaluate-grouped-expression', EvaluateExpressionParameters>
  | Unit3Question<'interpret-expression', InterpretExpressionParameters>
  | Unit3Question<'multi-step-multiplication', MultiStepParameters>

interface ItemDefinition {
  standard: '5.NBT.5' | '5.OA.1' | '5.OA.2'
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

/**
 * Authoring note: these prompts, distractors, and worked examples are original
 * instructional prose. The frozen curriculum ZIP supplied alignment metadata and
 * the coverage contract; no lesson prose is copied into generated questions.
 */
export const GRADE5_MATH_UNIT3_ITEM_DEFINITIONS = {
  'multiplicative-comparison': {
    standard: '5.OA.2',
    lessonFocus: 'multiplicative comparison',
    workedExample: {
      prompt:
        'Nia has 6 times as many beads as Eli. Eli has 14 beads. How many beads does Nia have?',
      answer: '84',
      steps: [
        '“6 times as many” means multiply Eli’s amount by 6.',
        'Write 6 × 14.',
        '6 × 14 = 84, so Nia has 84 beads.',
      ],
    },
  },
  'area-model-product': {
    standard: '5.NBT.5',
    lessonFocus: 'area models',
    workedExample: {
      prompt:
        'An area model for 34 × 27 splits 34 into 30 + 4 and 27 into 20 + 7. What is the total product?',
      answer: '918',
      steps: [
        'Find the four areas: 30 × 20 = 600, 30 × 7 = 210, 4 × 20 = 80, and 4 × 7 = 28.',
        'Add the partial areas: 600 + 210 + 80 + 28.',
        'The model has total area 918, so 34 × 27 = 918.',
      ],
    },
  },
  'partial-products': {
    standard: '5.NBT.5',
    lessonFocus: 'partial products',
    workedExample: {
      prompt: 'Use partial products to calculate 326 × 24.',
      answer: '7824',
      steps: [
        'Decompose 326 as 300 + 20 + 6 and 24 as 20 + 4.',
        'The partial products are 6000, 1200, 400, 80, 120, and 24.',
        'Add all partial products to get 7824.',
      ],
    },
  },
  'standard-algorithm': {
    standard: '5.NBT.5',
    lessonFocus: 'standard multiplication algorithm',
    workedExample: {
      prompt: 'Use the standard algorithm to calculate 247 × 36.',
      answer: '8892',
      steps: [
        'Multiply 247 by 6 to get 1482.',
        'Multiply 247 by 30 to get 7410; the tens-place zero keeps the place value.',
        'Add 1482 + 7410 to get 8892.',
      ],
    },
  },
  'estimate-product': {
    standard: '5.NBT.5',
    lessonFocus: 'estimation',
    workedExample: {
      prompt:
        'Estimate 684 × 47 by rounding 684 to the nearest hundred and 47 to the nearest ten.',
      answer: '35000',
      steps: [
        '684 rounds to 700 and 47 rounds to 50.',
        'Multiply the rounded factors: 700 × 50.',
        'The estimate is 35000, so an exact answer near that amount is reasonable.',
      ],
    },
  },
  'write-grouped-expression': {
    standard: '5.OA.2',
    lessonFocus: 'multi-step multiplication problems',
    workedExample: {
      prompt:
        'Add 18 and 7. Then multiply the sum by 5. Write a numerical expression.',
      answer: '(18 + 7) × 5',
      steps: [
        'The addition must happen first, so group 18 + 7 with parentheses.',
        'Multiply that grouped sum by 5.',
        'The expression is (18 + 7) × 5.',
      ],
    },
  },
  'evaluate-grouped-expression': {
    standard: '5.OA.1',
    lessonFocus: 'multi-step multiplication problems',
    workedExample: {
      prompt: 'Evaluate [8 + (3 × 4)] × 2.',
      answer: '40',
      steps: [
        'Evaluate the parentheses first: 3 × 4 = 12.',
        'Evaluate the brackets: 8 + 12 = 20.',
        'Multiply 20 × 2 to get 40.',
      ],
    },
  },
  'interpret-expression': {
    standard: '5.OA.2',
    lessonFocus: 'multiplicative comparison',
    workedExample: {
      prompt: 'Without evaluating it, describe 6 × (18 + 7).',
      answer: 'Multiply 6 by the sum of 18 and 7.',
      steps: [
        'The parentheses group 18 + 7 as one sum.',
        'The multiplication sign places 6 groups of that sum.',
        'Describe those operations without finding either the sum or the product.',
      ],
    },
  },
  'multi-step-multiplication': {
    standard: '5.NBT.5',
    lessonFocus: 'multi-step multiplication problems',
    workedExample: {
      prompt:
        'A booth sells 28 tickets each day for 3 days at $6 per ticket. What is the projected revenue?',
      answer: '$504',
      steps: [
        'Find the number of tickets: 28 × 3 = 84.',
        'Multiply the tickets by the price: 84 × 6.',
        'The projected revenue is $504.',
      ],
    },
  },
} as const satisfies Record<Grade5MathUnit3ItemType, ItemDefinition>

const uniqueExcept = (
  correct: string,
  candidates: readonly string[],
): string[] =>
  [...new Set(candidates)].filter((candidate) => candidate !== correct)

const roundTo = (value: number, place: number): number =>
  Math.round(value / place) * place

const placeName = (place: number): 'ten' | 'hundred' | 'thousand' => {
  if (place === 10) return 'ten'
  if (place === 100) return 'hundred'
  return 'thousand'
}

function decomposeWhole(value: number): number[] {
  const parts: number[] = []
  let place = 1
  let remaining = value
  while (remaining > 0) {
    const digit = remaining % 10
    if (digit !== 0) parts.unshift(digit * place)
    remaining = Math.floor(remaining / 10)
    place *= 10
  }
  return parts
}

function numericProductDistractors(
  multiplicand: number,
  multiplier: number,
): string[] {
  const product = multiplicand * multiplier
  const onesOnly = multiplicand * (multiplier % 10)
  const unshiftedTens = multiplicand * Math.floor(multiplier / 10)
  return uniqueExcept(String(product), [
    String(onesOnly),
    String(unshiftedTens),
    String(product + multiplicand),
    String(Math.max(1, product - multiplicand)),
    String(product + multiplier),
    String(Math.max(1, product - multiplier)),
  ])
}

function comparisonFactors(difficulty: Difficulty): {
  reference: number
  factor: number
} {
  if (difficulty === 1) return { reference: ri(4, 24), factor: ri(2, 6) }
  if (difficulty === 2) return { reference: ri(12, 80), factor: ri(3, 9) }
  return { reference: ri(25, 240), factor: ri(4, 12) }
}

export function generateMultiplicativeComparisonQuestion(
  difficulty: Difficulty,
): Unit3Question<
  'multiplicative-comparison',
  MultiplicativeComparisonParameters
> {
  const { reference, factor } = comparisonFactors(difficulty)
  const compared = reference * factor
  const mode =
    difficulty === 1
      ? 'find-compared'
      : difficulty === 2
        ? pick(['find-compared', 'find-reference'] as const)
        : pick(['find-compared', 'find-reference', 'find-factor'] as const)
  const correctAnswer =
    mode === 'find-compared'
      ? String(compared)
      : mode === 'find-reference'
        ? String(reference)
        : `${factor} times`
  const prompt =
    mode === 'find-compared'
      ? `Maya has ${factor} times as many cards as Leo. Leo has ${reference} cards. How many cards does Maya have?`
      : mode === 'find-reference'
        ? `Maya has ${compared} cards, which is ${factor} times as many as Leo. How many cards does Leo have?`
        : `Maya has ${compared} cards and Leo has ${reference} cards. How many times as many cards does Maya have as Leo?`
  const distractors =
    mode === 'find-factor'
      ? uniqueExcept(correctAnswer, [
          `${Math.max(1, factor - 1)} times`,
          `${factor + 1} times`,
          `${reference} times`,
          `${compared - reference} times`,
        ])
      : uniqueExcept(correctAnswer, [
          String(reference + factor),
          String(Math.max(1, compared - factor)),
          String(compared + factor),
          String(reference),
          String(compared),
        ])
  const definition =
    GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['multiplicative-comparison']
  return makeCurriculumQuestion({
    itemType: 'multiplicative-comparison',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt,
    correctAnswer,
    distractors,
    parameters: { mode, reference, factor, compared },
    workedExample: definition.workedExample,
  })
}

function areaFactors(difficulty: Difficulty): [number, number] {
  if (difficulty === 1) return [ri(12, 59), ri(11, 29)]
  if (difficulty === 2) return [ri(120, 599), ri(12, 59)]
  return [ri(1_200, 5_999), ri(21, 99)]
}

export function generateAreaModelProductQuestion(
  difficulty: Difficulty,
): Unit3Question<'area-model-product', AreaModelParameters> {
  const [multiplicand, multiplier] = areaFactors(difficulty)
  const multiplicandParts = decomposeWhole(multiplicand)
  const multiplierParts = decomposeWhole(multiplier)
  const correctAnswer = String(multiplicand * multiplier)
  const definition = GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['area-model-product']
  return makeCurriculumQuestion({
    itemType: 'area-model-product',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `An area model for ${multiplicand} × ${multiplier} splits ${multiplicand} into ${multiplicandParts.join(' + ')} and ${multiplier} into ${multiplierParts.join(' + ')}. What total product does the model represent?`,
    correctAnswer,
    distractors: numericProductDistractors(multiplicand, multiplier),
    parameters: {
      multiplicand,
      multiplier,
      multiplicandParts,
      multiplierParts,
    },
    visual: { kind: 'rect', w: multiplicand, h: multiplier, labels: true },
    workedExample: definition.workedExample,
  })
}

function partialProductFactors(difficulty: Difficulty): [number, number] {
  if (difficulty === 1) return [ri(12, 99), ri(2, 9)]
  if (difficulty === 2) return [ri(120, 999), ri(11, 49)]
  return [ri(1_200, 9_999), ri(21, 99)]
}

export function generatePartialProductsQuestion(
  difficulty: Difficulty,
): Unit3Question<'partial-products', PartialProductsParameters> {
  const [multiplicand, multiplier] = partialProductFactors(difficulty)
  const multiplicandParts = decomposeWhole(multiplicand)
  const multiplierParts = decomposeWhole(multiplier)
  const partialProducts = multiplicandParts.flatMap((left) =>
    multiplierParts.map((right) => left * right),
  )
  const correctAnswer = String(multiplicand * multiplier)
  const definition = GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['partial-products']
  return makeCurriculumQuestion({
    itemType: 'partial-products',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Use partial products to calculate ${multiplicand} × ${multiplier}. Decompose both factors by place value, multiply each pair of parts, and add the partial products. What is the product?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      ...numericProductDistractors(multiplicand, multiplier),
      String(
        partialProducts.slice(0, -1).reduce((sum, value) => sum + value, 0),
      ),
    ]),
    parameters: {
      multiplicand,
      multiplier,
      multiplicandParts,
      multiplierParts,
      partialProducts,
    },
    workedExample: definition.workedExample,
  })
}

function standardAlgorithmFactors(difficulty: Difficulty): [number, number] {
  if (difficulty === 1) return [ri(101, 999), ri(2, 9)]
  if (difficulty === 2) return [ri(101, 999), ri(11, 99)]
  return [ri(1_001, 9_999), ri(11, 99)]
}

export function generateStandardAlgorithmQuestion(
  difficulty: Difficulty,
): Unit3Question<'standard-algorithm', StandardAlgorithmParameters> {
  const [multiplicand, multiplier] = standardAlgorithmFactors(difficulty)
  const correctAnswer = String(multiplicand * multiplier)
  const definition = GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['standard-algorithm']
  return makeCurriculumQuestion({
    itemType: 'standard-algorithm',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Use the standard multiplication algorithm to calculate ${multiplicand} × ${multiplier}.`,
    correctAnswer,
    distractors: numericProductDistractors(multiplicand, multiplier),
    parameters: { multiplicand, multiplier },
    workedExample: definition.workedExample,
  })
}

function estimationFactors(difficulty: Difficulty): {
  multiplicand: number
  multiplier: number
  roundMultiplicandTo: number
  roundMultiplierTo: number
} {
  if (difficulty === 1) {
    return {
      multiplicand: ri(22, 98),
      multiplier: ri(12, 49),
      roundMultiplicandTo: 10,
      roundMultiplierTo: 10,
    }
  }
  if (difficulty === 2) {
    return {
      multiplicand: ri(120, 999),
      multiplier: ri(12, 99),
      roundMultiplicandTo: 100,
      roundMultiplierTo: 10,
    }
  }
  return {
    multiplicand: ri(1_200, 9_999),
    multiplier: ri(120, 999),
    roundMultiplicandTo: 1_000,
    roundMultiplierTo: 100,
  }
}

export function generateEstimateProductQuestion(
  difficulty: Difficulty,
): Unit3Question<'estimate-product', EstimateProductParameters> {
  const factors = estimationFactors(difficulty)
  const { multiplicand, multiplier, roundMultiplicandTo, roundMultiplierTo } =
    factors
  const roundedMultiplicand = roundTo(multiplicand, roundMultiplicandTo)
  const roundedMultiplier = roundTo(multiplier, roundMultiplierTo)
  const estimate = roundedMultiplicand * roundedMultiplier
  const mode =
    difficulty === 1
      ? 'estimate'
      : pick(['estimate', 'reasonableness'] as const)
  const reasonable = ri(0, 1) === 1
  const claimedProduct =
    mode === 'reasonableness'
      ? multiplicand * multiplier * (reasonable ? 1 : 10)
      : undefined
  const correctAnswer =
    mode === 'estimate'
      ? String(estimate)
      : `${reasonable ? 'Yes' : 'No'}; the rounded estimate is ${estimate}.`
  const wrongEstimate = Math.max(
    1,
    roundedMultiplicand * Math.max(1, roundedMultiplier - roundMultiplierTo),
  )
  const distractors =
    mode === 'estimate'
      ? uniqueExcept(correctAnswer, [
          String(multiplicand * roundedMultiplier),
          String(roundedMultiplicand * multiplier),
          String(wrongEstimate),
          String(estimate + roundMultiplicandTo * roundMultiplierTo),
        ])
      : uniqueExcept(correctAnswer, [
          `${reasonable ? 'No' : 'Yes'}; the rounded estimate is ${estimate}.`,
          `${reasonable ? 'Yes' : 'No'}; the rounded estimate is ${wrongEstimate}.`,
          `${reasonable ? 'No' : 'Yes'}; the rounded estimate is ${wrongEstimate}.`,
        ])
  const prompt =
    mode === 'estimate'
      ? `Estimate ${multiplicand} × ${multiplier} by rounding ${multiplicand} to the nearest ${placeName(roundMultiplicandTo)} and ${multiplier} to the nearest ${placeName(roundMultiplierTo)}.`
      : `A student says ${multiplicand} × ${multiplier} = ${claimedProduct}. Round ${multiplicand} to the nearest ${placeName(roundMultiplicandTo)} and ${multiplier} to the nearest ${placeName(roundMultiplierTo)}. Is the claim reasonable?`
  const definition = GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['estimate-product']
  return makeCurriculumQuestion({
    itemType: 'estimate-product',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt,
    correctAnswer,
    distractors,
    parameters: {
      mode,
      ...factors,
      ...(claimedProduct === undefined ? {} : { claimedProduct }),
    },
    workedExample: definition.workedExample,
  })
}

export function generateWriteGroupedExpressionQuestion(
  difficulty: Difficulty,
): Unit3Question<'write-grouped-expression', GroupedExpressionParameters> {
  const template =
    difficulty === 1
      ? 'sum-times'
      : difficulty === 2
        ? pick(['sum-times', 'difference-times', 'product-plus'] as const)
        : pick([
            'sum-times',
            'difference-times',
            'product-plus',
            'two-sums',
          ] as const)
  const a = ri(8, difficulty === 1 ? 30 : 90)
  const b = template === 'difference-times' ? ri(2, a - 1) : ri(3, 35)
  const c = ri(2, 12)
  const d = ri(2, 18)
  let prompt: string
  let expression: string
  let distractors: string[]
  let values: readonly number[]
  if (template === 'sum-times') {
    prompt = `Add ${a} and ${b}. Then multiply the sum by ${c}. Which numerical expression represents the calculation?`
    expression = `(${a} + ${b}) × ${c}`
    distractors = [
      `${a} + (${b} × ${c})`,
      `(${a} × ${b}) + ${c}`,
      `${a} × (${b} + ${c})`,
    ]
    values = [a, b, c]
  } else if (template === 'difference-times') {
    prompt = `Subtract ${b} from ${a}. Then multiply the difference by ${c}. Which numerical expression represents the calculation?`
    expression = `(${a} - ${b}) × ${c}`
    distractors = [
      `${a} - (${b} × ${c})`,
      `(${b} - ${a}) × ${c}`,
      `(${a} × ${c}) - ${b}`,
    ]
    values = [a, b, c]
  } else if (template === 'product-plus') {
    prompt = `Multiply ${a} by ${b}. Then add ${c} to the product. Which numerical expression represents the calculation?`
    expression = `(${a} × ${b}) + ${c}`
    distractors = [
      `${a} × (${b} + ${c})`,
      `(${a} + ${b}) × ${c}`,
      `${a} + (${b} × ${c})`,
    ]
    values = [a, b, c]
  } else {
    prompt = `Add ${a} and ${b}. Add ${c} and ${d}. Then multiply the two sums. Which numerical expression represents the calculation?`
    expression = `(${a} + ${b}) × (${c} + ${d})`
    distractors = [
      `${a} + (${b} × ${c}) + ${d}`,
      `(${a} × ${b}) + (${c} × ${d})`,
      `(${a} + ${b} + ${c}) × ${d}`,
    ]
    values = [a, b, c, d]
  }
  const definition =
    GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['write-grouped-expression']
  return makeCurriculumQuestion({
    itemType: 'write-grouped-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt,
    correctAnswer: expression,
    distractors,
    parameters: { template, values, expression },
    workedExample: definition.workedExample,
  })
}

export function generateEvaluateGroupedExpressionQuestion(
  difficulty: Difficulty,
): Unit3Question<'evaluate-grouped-expression', EvaluateExpressionParameters> {
  let expression: string
  let value: number
  if (difficulty === 1) {
    const a = ri(4, 30)
    const b = ri(2, 20)
    const c = ri(2, 9)
    expression = `(${a} + ${b}) × ${c}`
    value = (a + b) * c
  } else if (difficulty === 2) {
    const a = ri(4, 30)
    const b = ri(2, 12)
    const c = ri(2, 9)
    const d = ri(2, 7)
    expression = `[${a} + (${b} × ${c})] × ${d}`
    value = (a + b * c) * d
  } else {
    const a = ri(10, 45)
    const b = ri(4, 24)
    const c = ri(8, 18)
    const d = ri(2, c - 1)
    const e = ri(2, 30)
    expression = `{[${a} + ${b}] × (${c} - ${d})} + ${e}`
    value = (a + b) * (c - d) + e
  }
  const correctAnswer = String(value)
  const definition =
    GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['evaluate-grouped-expression']
  return makeCurriculumQuestion({
    itemType: 'evaluate-grouped-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Evaluate: ${expression}`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      String(value + 1),
      String(Math.max(1, value - 1)),
      String(value + 10),
      String(Math.max(1, value - 10)),
    ]),
    parameters: { expression, value },
    workedExample: definition.workedExample,
  })
}

export function generateInterpretExpressionQuestion(
  difficulty: Difficulty,
): Unit3Question<'interpret-expression', InterpretExpressionParameters> {
  const template =
    difficulty === 1
      ? 'factor-times-sum'
      : difficulty === 2
        ? pick([
            'factor-times-sum',
            'difference-times-factor',
            'product-plus',
          ] as const)
        : pick([
            'factor-times-sum',
            'difference-times-factor',
            'product-plus',
            'sum-times-difference',
          ] as const)
  const a = ri(8, 50)
  const b = ri(3, 25)
  const c = ri(2, 12)
  const d = ri(2, 18)
  let expression: string
  let correctAnswer: string
  let distractors: string[]
  let values: readonly number[]
  if (template === 'factor-times-sum') {
    expression = `${c} × (${a} + ${b})`
    correctAnswer = `Multiply ${c} by the sum of ${a} and ${b}.`
    distractors = [
      `Add ${a} and the product of ${c} and ${b}.`,
      `Multiply the sum of ${c} and ${a} by ${b}.`,
      `Add ${c} and the product of ${a} and ${b}.`,
    ]
    values = [c, a, b]
  } else if (template === 'difference-times-factor') {
    const greater = Math.max(a, b) + 5
    const lesser = Math.min(a, b)
    expression = `(${greater} - ${lesser}) × ${c}`
    correctAnswer = `Multiply the difference between ${greater} and ${lesser} by ${c}.`
    distractors = [
      `Subtract the product of ${lesser} and ${c} from ${greater}.`,
      `Multiply the difference between ${lesser} and ${greater} by ${c}.`,
      `Subtract ${lesser} from the product of ${greater} and ${c}.`,
    ]
    values = [greater, lesser, c]
  } else if (template === 'product-plus') {
    expression = `(${a} × ${b}) + ${c}`
    correctAnswer = `Add ${c} to the product of ${a} and ${b}.`
    distractors = [
      `Multiply ${a} by the sum of ${b} and ${c}.`,
      `Add ${a} and the product of ${b} and ${c}.`,
      `Multiply the sum of ${a} and ${b} by ${c}.`,
    ]
    values = [a, b, c]
  } else {
    const greater = Math.max(c, d) + 4
    const lesser = Math.min(c, d)
    expression = `{${a} + ${b}} × [${greater} - ${lesser}]`
    correctAnswer = `Multiply the sum of ${a} and ${b} by the difference between ${greater} and ${lesser}.`
    distractors = [
      `Add ${a} to the product of ${b} and the difference between ${greater} and ${lesser}.`,
      `Multiply the difference between ${a} and ${b} by the sum of ${greater} and ${lesser}.`,
      `Multiply the sum of ${a} and ${b} by the difference between ${lesser} and ${greater}.`,
    ]
    values = [a, b, greater, lesser]
  }
  const definition = GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['interpret-expression']
  return makeCurriculumQuestion({
    itemType: 'interpret-expression',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Without evaluating it, which statement describes ${expression}?`,
    correctAnswer,
    distractors,
    parameters: { template, values, expression },
    workedExample: definition.workedExample,
  })
}

export function generateMultiStepMultiplicationQuestion(
  difficulty: Difficulty,
): Unit3Question<'multi-step-multiplication', MultiStepParameters> {
  const context =
    difficulty === 1
      ? 'inventory'
      : difficulty === 2
        ? 'revenue'
        : pick(['inventory', 'revenue'] as const)
  const definition =
    GRADE5_MATH_UNIT3_ITEM_DEFINITIONS['multi-step-multiplication']
  if (context === 'inventory') {
    const tables = ri(3, difficulty === 1 ? 8 : 18)
    const boxesPerTable = ri(4, difficulty === 1 ? 9 : 16)
    const itemsPerBox = ri(12, difficulty === 1 ? 30 : 75)
    const looseItems = ri(2, 40)
    const total = tables * boxesPerTable * itemsPerBox + looseItems
    const correctAnswer = `${total} items`
    return makeCurriculumQuestion({
      itemType: 'multi-step-multiplication',
      standard: definition.standard,
      lessonFocus: definition.lessonFocus,
      difficulty,
      prompt: `An event has ${tables} display tables. Each table holds ${boxesPerTable} boxes with ${itemsPerBox} items in each box. There are also ${looseItems} loose items. How many items are in inventory altogether?`,
      correctAnswer,
      distractors: uniqueExcept(correctAnswer, [
        `${tables * boxesPerTable * itemsPerBox} items`,
        `${tables * boxesPerTable + itemsPerBox + looseItems} items`,
        `${tables * (boxesPerTable + itemsPerBox) + looseItems} items`,
        `${total + itemsPerBox} items`,
      ]),
      parameters: { context, tables, boxesPerTable, itemsPerBox, looseItems },
      workedExample: definition.workedExample,
    })
  }
  const days = ri(2, difficulty === 2 ? 6 : 10)
  const ticketsPerDay = ri(
    difficulty === 2 ? 18 : 45,
    difficulty === 2 ? 75 : 180,
  )
  const pricePerTicket = ri(3, difficulty === 2 ? 12 : 25)
  const revenue = days * ticketsPerDay * pricePerTicket
  const correctAnswer = `$${revenue}`
  return makeCurriculumQuestion({
    itemType: 'multi-step-multiplication',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `For ${days} event days, a booth sells ${ticketsPerDay} tickets each day at $${pricePerTicket} per ticket. What projected revenue will the booth earn?`,
    correctAnswer,
    distractors: uniqueExcept(correctAnswer, [
      `$${ticketsPerDay * pricePerTicket}`,
      `$${days * ticketsPerDay}`,
      `$${days * (ticketsPerDay + pricePerTicket)}`,
      `$${revenue + pricePerTicket}`,
    ]),
    parameters: { context, days, ticketsPerDay, pricePerTicket },
    workedExample: definition.workedExample,
  })
}

export const GRADE5_MATH_UNIT3_GENERATORS = {
  'multiplicative-comparison': generateMultiplicativeComparisonQuestion,
  'area-model-product': generateAreaModelProductQuestion,
  'partial-products': generatePartialProductsQuestion,
  'standard-algorithm': generateStandardAlgorithmQuestion,
  'estimate-product': generateEstimateProductQuestion,
  'write-grouped-expression': generateWriteGroupedExpressionQuestion,
  'evaluate-grouped-expression': generateEvaluateGroupedExpressionQuestion,
  'interpret-expression': generateInterpretExpressionQuestion,
  'multi-step-multiplication': generateMultiStepMultiplicationQuestion,
} satisfies Record<
  Grade5MathUnit3ItemType,
  CurriculumGenerator<Grade5MathUnit3Question>
>

export function generateGrade5MathUnit3Question<
  TItemType extends Grade5MathUnit3ItemType,
>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade5MathUnit3Question, { itemType: TItemType }> {
  const generator = GRADE5_MATH_UNIT3_GENERATORS[
    itemType
  ] as CurriculumGenerator<
    Extract<Grade5MathUnit3Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
