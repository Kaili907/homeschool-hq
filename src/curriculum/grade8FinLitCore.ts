import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

export type FinLitStandard =
  | 'FL.8.B'
  | 'FL.8.T'
  | 'FL.8.C'
  | 'FL.8.L'
  | 'FL.8.I'
  | 'FL.8.R'

export interface FinLitDefinition {
  standard: FinLitStandard
  lessonFocus: string
  workedExample: CurriculumWorkedExample
}

export type FinLitQuestion<T extends string, P> = CurriculumQuestion<T, P>

export const money = (cents: bigint): string => {
  const sign = cents < 0n ? '-' : ''
  const value = cents < 0n ? -cents : cents
  return `${sign}$${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}

/** Positive rational division rounded to the nearest cent; a half-cent rounds up. */
export const roundHalfUp = (numerator: bigint, denominator: bigint): bigint =>
  (numerator * 2n + denominator) / (denominator * 2n)

/**
 * Applies a stated nominal annual rate one compounding period at a time.
 * Balances are integer cents after every period, using round-half-up.
 */
export function compoundCents(
  principalCents: bigint,
  annualRateBps: bigint,
  compoundsPerYear: bigint,
  periods: bigint,
): bigint {
  let balance = principalCents
  const denominator = 10_000n * compoundsPerYear
  const numerator = denominator + annualRateBps
  for (let period = 0n; period < periods; period += 1n) {
    balance = roundHalfUp(balance * numerator, denominator)
  }
  return balance
}

/** Total interest for a level-payment loan using the same per-month cent rule. */
export function amortizedLoanTotalInterestCents(
  principalCents: bigint,
  annualRateBps: bigint,
  monthlyPaymentCents: bigint,
): bigint {
  let balance = principalCents
  let interestTotal = 0n
  const denominator = 120_000n
  while (balance > 0n) {
    const interest = roundHalfUp(balance * annualRateBps, denominator)
    interestTotal += interest
    const due = balance + interest
    if (monthlyPaymentCents >= due) return interestTotal
    balance = due - monthlyPaymentCents
  }
  return interestTotal
}

export const example = (
  prompt: string,
  answer: string,
  ...steps: string[]
): CurriculumWorkedExample => ({ prompt, answer, steps })

export function makeFinLitQuestion<T extends string, P>(args: {
  itemType: T
  difficulty: Difficulty
  prompt: string
  correctAnswer: string
  distractors: readonly string[]
  parameters: P
  definition: FinLitDefinition
}): FinLitQuestion<T, P> {
  return makeCurriculumQuestion({
    ...args,
    standard: args.definition.standard,
    lessonFocus: args.definition.lessonFocus,
    workedExample: args.definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const randomCents = (difficulty: Difficulty, low: number, high: number) =>
  BigInt(ri(low, high + (difficulty - 1) * high))

export { pick, ri }
export type { CurriculumGenerator }
