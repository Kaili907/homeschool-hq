import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Financial-literacy arithmetic is represented as integer cents; never as binary floats. */
export const money = (cents: bigint | number): string => {
  const value = BigInt(cents)
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}$${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}
export const cents = (minDollars: number, maxDollars: number) => BigInt(ri(minDollars, maxDollars) * 100 + ri(0, 99))
export const pct = (basisPoints: number) => `${basisPoints / 100}%`

/** Exact rational compound calculation, rounded to cents once only after all periods. */
export function compoundCents(principal: bigint, annualBasisPoints: bigint, years: bigint, compoundsPerYear: bigint): bigint {
  const denominator = 10_000n * compoundsPerYear
  const numerator = denominator + annualBasisPoints
  const exponent = years * compoundsPerYear
  let top = principal
  let bottom = 1n
  for (let i = 0n; i < exponent; i++) { top *= numerator; bottom *= denominator }
  return (top + bottom / 2n) / bottom
}
export function simpleInterestCents(principal: bigint, annualBasisPoints: bigint, months: bigint): bigint {
  const denominator = 10_000n * 12n
  const numerator = principal * annualBasisPoints * months
  if (numerator % denominator !== 0n) throw new Error('Loan facts must resolve to whole cents')
  return numerator / denominator
}

export type FinLitQuestion<T extends string, P> = CurriculumQuestion<T, P>
export type FinLitDefinition = { standard: string; lessonFocus: string; workedExample: CurriculumWorkedExample }
export const example = (prompt: string, answer: string, steps: readonly string[]): CurriculumWorkedExample => ({ prompt, answer, steps })
export function finLitQuestion<T extends string, P>(itemType: T, difficulty: Difficulty, definition: FinLitDefinition, prompt: string, answer: string, parameters: P, distractors: string[]): FinLitQuestion<T, P> {
  return makeCurriculumQuestion({ itemType, difficulty, ...definition, prompt, correctAnswer: answer, parameters, distractors, distractorMode: 'distinct' })
}
