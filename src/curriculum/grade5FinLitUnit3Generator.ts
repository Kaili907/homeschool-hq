import type { Difficulty } from '../types'
import { type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { buildFinancialGenerator, type FinancialDefinition, type FinancialParameters } from './grade5FinancialGeneratorSupport'
const ex=(prompt:string,answer:string):CurriculumWorkedExample=>({prompt,answer,steps:['Use the stated fictional amounts.','Calculate in integer cents.']})
export const GRADE5_FIN_LIT_UNIT3_ITEM_TYPES=['unit-price-share','comparison-total','sales-tax-total','fixed-flexible-remainder','simple-budget-remainder','total-check'] as const
export type Grade5FinLitUnit3ItemType=typeof GRADE5_FIN_LIT_UNIT3_ITEM_TYPES[number]
export const GRADE5_FIN_LIT_UNIT3_ITEM_DEFINITIONS:Record<Grade5FinLitUnit3ItemType,FinancialDefinition<Grade5FinLitUnit3ItemType>>={
 'unit-price-share':{itemType:'unit-price-share',standard:'PF2 foundations',lessonFocus:'unit prices',kind:'divide',workedExample:ex('A $12.00 pack has 3 identical items.','$4.00')},
 'comparison-total':{itemType:'comparison-total',standard:'PF2 foundations',lessonFocus:'comparison shopping',kind:'multiply',workedExample:ex('Three identical items cost $4.00 each.','$12.00')},
 'sales-tax-total':{itemType:'sales-tax-total',standard:'PF3 foundations',lessonFocus:'sales tax concept',kind:'tax',workedExample:ex('A $10.00 item has 5% tax.','$10.50')},
 'fixed-flexible-remainder':{itemType:'fixed-flexible-remainder',standard:'PF3 foundations',lessonFocus:'fixed and flexible categories',kind:'subtract-two',workedExample:ex('Subtract two categories from a fictional budget.','remainder')},
 'simple-budget-remainder':{itemType:'simple-budget-remainder',standard:'PF3 foundations',lessonFocus:'simple budgets',kind:'subtract-two',workedExample:ex('A budget shows a starting amount and two expenses.','remainder')},
 'total-check':{itemType:'total-check',standard:'PF3 foundations',lessonFocus:'checking totals',kind:'discount-tax',workedExample:ex('Discount first, then calculate tax.','final total')},}
export type Grade5FinLitUnit3Question=CurriculumQuestion<Grade5FinLitUnit3ItemType,FinancialParameters>
export const GRADE5_FIN_LIT_UNIT3_GENERATORS=Object.fromEntries(GRADE5_FIN_LIT_UNIT3_ITEM_TYPES.map(type=>[type,buildFinancialGenerator(GRADE5_FIN_LIT_UNIT3_ITEM_DEFINITIONS[type])])) as Record<Grade5FinLitUnit3ItemType,ReturnType<typeof buildFinancialGenerator>>
export function generateGrade5FinLitUnit3Question(type:Grade5FinLitUnit3ItemType,difficulty:Difficulty):Grade5FinLitUnit3Question{return GRADE5_FIN_LIT_UNIT3_GENERATORS[type](difficulty) as Grade5FinLitUnit3Question}
