import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Money is always stored and calculated as integer cents. */
export interface FinancialParameters { kind: FinancialKind; a: number; b: number; c: number; rate?: number }
export type FinancialKind = 'subtract-two' | 'multiply' | 'tax' | 'discount-tax' | 'interest' | 'interest-paid' | 'divide'
export interface FinancialDefinition<T extends string> { itemType: T; standard: string; lessonFocus: string; kind: FinancialKind; workedExample: CurriculumWorkedExample }

const money = (cents: number) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const roundHalfUp = (numerator: number, denominator: number) => Math.floor((numerator * 2 + denominator) / (denominator * 2))
const distinctMoney = (answer: number, candidates: readonly number[]) => {
  const values = [...new Set(candidates.filter((value) => value >= 0 && value !== answer))]
  for (let offset = 1; values.length < 3; offset++) if (!values.includes(answer + offset)) values.push(answer + offset)
  return values.slice(0, 3).map(money)
}

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
  const lead = `In a Grade 5 financial-literacy lesson about ${definition.lessonFocus}, `
  let wrong: number[]
  let parameters: FinancialParameters
  switch (definition.kind) {
    case 'subtract-two': {
      const total = a + b + c
      correct = a
      prompt = `${lead}a fictional plan has ${money(total)}. It records expenses of ${money(b)} and ${money(c)}. What amount remains? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a: total, b, c }
      wrong = [total - b, total - c, b + c]
      break
    }
    case 'multiply': {
      const count = ri(2, 3 + scale)
      correct = a * count
      prompt = `${lead}a fictional service earns ${money(a)} for each of ${count} completed jobs. What is the total earned? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: count, c: 0 }
      wrong = [a, a * (count - 1), a * (count + 1)]
      break
    }
    case 'tax': {
      const taxRates = [5, 6, 8, 10] as const
      const rate = taxRates[ri(0, taxRates.length - 1)]
      const tax = roundHalfUp(a * rate, 100)
      correct = a + tax
      prompt = `${lead}an item costs ${money(a)} before tax. Sales tax is ${rate}%. Round the tax to the nearest cent, half up. What is the total price? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: 0, c: 0, rate }
      wrong = [a, tax, a + roundHalfUp(a * (rate * 10), 100)]
      break
    }
    case 'discount-tax': {
      const discountRates = [10, 20, 25] as const
      const taxRates = [5, 8, 10] as const
      const rate = discountRates[ri(0, discountRates.length - 1)]
      const tax = taxRates[ri(0, taxRates.length - 1)]
      const discount = roundHalfUp(a * rate, 100)
      const discounted = a - discount
      const discountedTax = roundHalfUp(discounted * tax, 100)
      correct = discounted + discountedTax
      prompt = `${lead}an item costs ${money(a)}. First take ${rate}% off, then add ${tax}% sales tax to the discounted price. Round each percentage result to the nearest cent, half up. What is the final price? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: rate, c: tax }
      // Misconceptions: omit tax, omit the discount, or add the discount instead of subtracting it.
      wrong = [discounted, a + roundHalfUp(a * tax, 100), a + discount + discountedTax]
      break
    }
    case 'interest': {
      const interestRates = [1, 2, 5, 10] as const
      const rate = interestRates[ri(0, interestRates.length - 1)]
      correct = roundHalfUp(a * rate, 100)
      prompt = `${lead}a savings account has ${money(a)} for one year at simple interest of ${rate}%. Round the interest to the nearest cent, half up. How much interest is earned? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: 0, c: 0, rate }
      wrong = [a, roundHalfUp(a * rate, 10), a + correct]
      break
    }
    case 'interest-paid': {
      const interestRates = [1, 2, 5, 10] as const
      const rate = interestRates[ri(0, interestRates.length - 1)]
      correct = roundHalfUp(a * rate, 100)
      prompt = `${lead}a fictional borrower owes ${money(a)} for one year at simple interest of ${rate}%. Round the interest to the nearest cent, half up. How much interest is paid? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a, b: 0, c: 0, rate }
      wrong = [a, roundHalfUp(a * rate, 10), a + correct]
      break
    }
    case 'divide': {
      const count = ri(2, 3 + scale)
      correct = a
      const total = a * count
      prompt = `${lead}a fictional record shows ${money(total)} shared equally among ${count} identical items. What is the amount for one item? Give your answer as dollars and cents.`
      parameters = { kind: definition.kind, a: total, b: count, c: 0 }
      wrong = [total, total - a, a * 2]
      break
    }
  }
  return makeCurriculumQuestion({ itemType: definition.itemType, standard: definition.standard, lessonFocus: definition.lessonFocus, difficulty, prompt, correctAnswer: money(correct), distractors: distinctMoney(correct, wrong!), distractorMode: 'distinct', parameters, workedExample: definition.workedExample })
}

export function buildFinancialGenerator<T extends string>(definition: FinancialDefinition<T>): CurriculumGenerator<CurriculumQuestion<T, FinancialParameters>> {
  return (difficulty) => generateFinancialQuestion(definition, difficulty)
}
