import type { Difficulty } from '../types'
import { makeFinLitQuestion, money, ri, type CurriculumGenerator, type FinLitQuestion } from './grade8FinLitCore'

export const GRADE8_FINLIT_UNIT1_ITEM_TYPES = ['budget-balance'] as const
export type Grade8FinLitUnit1ItemType = typeof GRADE8_FINLIT_UNIT1_ITEM_TYPES[number]
export interface Grade8FinLitUnit1Parameters { incomeCents: bigint; needsCents: bigint; savingsCents: bigint }
export type Grade8FinLitUnit1Question = FinLitQuestion<'budget-balance', Grade8FinLitUnit1Parameters>
const definition = { standard: 'FL.8.B', lessonFocus: 'balancing a neutral spending plan', workedExample: { prompt: 'A plan has $80.00 income, $45.00 needs, and $15.00 savings. What remains?', answer: '$20.00', steps: ['Subtract planned needs and savings from income.', '$80.00 - $45.00 - $15.00 = $20.00.'] } } as const
export function generateBudgetBalanceQuestion(difficulty: Difficulty): Grade8FinLitUnit1Question {
  const incomeCents = BigInt(ri(8, 20) * 1_000)
  const needsCents = BigInt(ri(2, 5) * 1_000)
  const savingsCents = BigInt(ri(5, 15) * 100)
  const answer = incomeCents - needsCents - savingsCents
  return makeFinLitQuestion({ itemType: 'budget-balance', difficulty, prompt: `A sample monthly plan has income of ${money(incomeCents)}, needs of ${money(needsCents)}, and planned savings of ${money(savingsCents)}. How much is unassigned?`, correctAnswer: money(answer), distractors: [money(answer + 100n), money(answer - 100n), money(incomeCents - needsCents), money(incomeCents - savingsCents)], parameters: { incomeCents, needsCents, savingsCents }, definition })
}
export const GRADE8_FINLIT_UNIT1_GENERATORS = { 'budget-balance': generateBudgetBalanceQuestion } satisfies Record<Grade8FinLitUnit1ItemType, CurriculumGenerator<Grade8FinLitUnit1Question>>
export const generateGrade8FinLitUnit1Question = generateBudgetBalanceQuestion
