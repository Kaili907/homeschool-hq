import type { Difficulty } from '../types'
import { type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { buildFinancialGenerator, type FinancialDefinition, type FinancialParameters } from './grade5FinancialGeneratorSupport'
const example = (prompt: string, answer: string): CurriculumWorkedExample => ({ prompt, answer, steps: ['Use only the quantities stated in the fictional scenario.', 'Compute in integer cents, then format the result as dollars and cents.'] })
export const GRADE5_FIN_LIT_UNIT1_ITEM_TYPES = ['priority-budget-remainder','scarcity-tradeoff-cost','money-tool-total','advertising-price-check','decision-plan-remainder','dignity-safe-budget'] as const
export type Grade5FinLitUnit1ItemType = typeof GRADE5_FIN_LIT_UNIT1_ITEM_TYPES[number]
export const GRADE5_FIN_LIT_UNIT1_ITEM_DEFINITIONS: Record<Grade5FinLitUnit1ItemType, FinancialDefinition<Grade5FinLitUnit1ItemType>> = {
  'priority-budget-remainder': { itemType: 'priority-budget-remainder', standard: 'Michigan Personal Finance foundations', lessonFocus: 'needs wants and priorities', kind: 'subtract-two', scenario: 'priority', workedExample: example('A plan has $12.00 and expenses of $3.00 and $2.00.', '$7.00') },
  'scarcity-tradeoff-cost': { itemType: 'scarcity-tradeoff-cost', standard: 'Grade 5 economics connections', lessonFocus: 'scarcity and tradeoffs', kind: 'subtract-two', scenario: 'scarcity', workedExample: example('A plan has $10.00 and two chosen costs total $6.00.', '$4.00') },
  'money-tool-total': { itemType: 'money-tool-total', standard: 'Michigan Personal Finance foundations', lessonFocus: 'money as a tool', kind: 'multiply', workedExample: example('Three jobs earn $4.00 each.', '$12.00') },
  'advertising-price-check': { itemType: 'advertising-price-check', standard: 'Grade 5 economics connections', lessonFocus: 'advertising influence', kind: 'discount-tax', workedExample: example('A $20.00 item is 10% off, then has 5% tax.', '$18.90') },
  'decision-plan-remainder': { itemType: 'decision-plan-remainder', standard: 'Michigan Personal Finance foundations', lessonFocus: 'decision steps', kind: 'subtract-two', scenario: 'decision', workedExample: example('A plan lists its starting amount and two fixed costs.', 'remaining amount') },
  'dignity-safe-budget': { itemType: 'dignity-safe-budget', standard: 'Michigan Personal Finance foundations', lessonFocus: 'family differences and dignity', kind: 'divide', scenario: 'dignity', workedExample: example('A fictional total is shared across equal items.', 'one equal share') },
}
export type Grade5FinLitUnit1Question = CurriculumQuestion<Grade5FinLitUnit1ItemType, FinancialParameters>
export const GRADE5_FIN_LIT_UNIT1_GENERATORS = Object.fromEntries(GRADE5_FIN_LIT_UNIT1_ITEM_TYPES.map((type) => [type, buildFinancialGenerator(GRADE5_FIN_LIT_UNIT1_ITEM_DEFINITIONS[type])])) as Record<Grade5FinLitUnit1ItemType, ReturnType<typeof buildFinancialGenerator>>
export function generateGrade5FinLitUnit1Question(type: Grade5FinLitUnit1ItemType, difficulty: Difficulty): Grade5FinLitUnit1Question { return GRADE5_FIN_LIT_UNIT1_GENERATORS[type](difficulty) as Grade5FinLitUnit1Question }
