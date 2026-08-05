import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Money is always stored and calculated as integer cents. */
export interface FinancialParameters { kind: FinancialKind; a: number; b: number; c: number; rate?: number }
export type FinancialKind = 'subtract-two' | 'multiply' | 'tax' | 'discount-tax' | 'interest' | 'divide'
export interface FinancialDefinition<T extends string> { itemType: T; standard: string; lessonFocus: string; kind: FinancialKind; workedExample: CurriculumWorkedExample }

const money = (cents: number) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const distractors = (answer: number) => [answer + 100, Math.max(1, answer - 100), answer + 200, answer + 300].map(money)

/**
 * Produces one explicitly worded, independently parseable financial calculation.
 * Tax and interest bases are multiples of $1, so every percentage result is exact
 * to the cent; no floating point arithmetic is used.
 */
export function generateFinancialQuestion<T extends string>(definition: FinancialDefinition<T>, difficulty: Difficulty): CurriculumQuestion<T, FinancialParameters> {
  const scale = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 4
  const a = ri(8, 25 * scale) * 100
  const b = ri(2, 7 * scale) * 100
  const c = ri(1, 5 * scale) * 100
  let correct: number
  let prompt: string
  let parameters: FinancialParameters
  switch (definition.kind) {
    case 'subtract-two': {
      const total = a + b + c
      correct = a
      prompt = `A fictional plan has ${money(total)}. It records expenses of ${money(b)} and ${money(c)}. How many cents remain? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a: total, b, c }
      break
    }
    case 'multiply': {
      const count = ri(2, 3 + scale)
      correct = a * count
      prompt = `A fictional service earns ${money(a)} for each of ${count} completed jobs. What is the total earned? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: count, c: 0 }
      break
    }
    case 'tax': {
      const taxRates = [5, 6, 8, 10] as const
      const rate = taxRates[ri(0, taxRates.length - 1)]
      correct = a + (a * rate) / 100
      prompt = `An item costs ${money(a)} before tax. Sales tax is ${rate}%. The price is a whole-dollar amount, so the tax is exact to the cent. What is the total price? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: 0, c: 0, rate }
      break
    }
    case 'discount-tax': {
      const discountRates = [10, 20, 25] as const
      const taxRates = [5, 8, 10] as const
      const rate = discountRates[ri(0, discountRates.length - 1)]
      const tax = taxRates[ri(0, taxRates.length - 1)]
      const discounted = a - (a * rate) / 100
      correct = discounted + (discounted * tax) / 100
      prompt = `An item costs ${money(a)}. First take ${rate}% off, then add ${tax}% sales tax to the discounted price. The price is a whole-dollar amount, so each percentage result is exact to the cent. What is the final price? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: rate, c: tax }
      break
    }
    case 'interest': {
      const interestRates = [1, 2, 5, 10] as const
      const rate = interestRates[ri(0, interestRates.length - 1)]
      correct = (a * rate) / 100
      prompt = `A savings account has ${money(a)} for one year at simple interest of ${rate}%. The balance is a whole-dollar amount, so the interest is exact to the cent. How much interest is earned? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: 0, c: 0, rate }
      break
    }
    case 'divide': {
      const count = ri(2, 3 + scale)
      correct = a
      const total = a * count
      prompt = `A fictional record shows ${money(total)} shared equally among ${count} identical items. What is the amount for one item? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a: total, b: count, c: 0 }
      break
    }
  }
  return makeCurriculumQuestion({ itemType: definition.itemType, standard: definition.standard, lessonFocus: definition.lessonFocus, difficulty, prompt, correctAnswer: money(correct), distractors: distractors(correct), distractorMode: 'distinct', parameters, workedExample: definition.workedExample })
}

export function buildFinancialGenerator<T extends string>(definition: FinancialDefinition<T>): CurriculumGenerator<CurriculumQuestion<T, FinancialParameters>> {
  return (difficulty) => generateFinancialQuestion(definition, difficulty)
}
