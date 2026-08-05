import type { Difficulty } from '../types'
import { type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { buildFinancialGenerator, type FinancialDefinition, type FinancialParameters } from './grade5FinancialGeneratorSupport'
const ex=(prompt:string,answer:string):CurriculumWorkedExample=>({prompt,answer,steps:['Use the fictional marketplace figures.','Calculate in exact integer cents.']})
export const GRADE5_FIN_LIT_UNIT6_ITEM_TYPES=['product-revenue','cost-price-total','marketplace-budget-remainder','customer-total-with-tax','record-keeping-share','giving-choice-remainder'] as const
export type Grade5FinLitUnit6ItemType=typeof GRADE5_FIN_LIT_UNIT6_ITEM_TYPES[number]
export const GRADE5_FIN_LIT_UNIT6_ITEM_DEFINITIONS:Record<Grade5FinLitUnit6ItemType,FinancialDefinition<Grade5FinLitUnit6ItemType>>={
 'product-revenue':{itemType:'product-revenue',standard:'PF1-PF6 foundations',lessonFocus:'product or service idea',kind:'multiply',workedExample:ex('Three fictional products sell for $4.00 each.','$12.00')},
 'cost-price-total':{itemType:'cost-price-total',standard:'PF1-PF6 foundations',lessonFocus:'costs and pricing',kind:'multiply',workedExample:ex('Four units cost $3.00 each.','$12.00')},
 'marketplace-budget-remainder':{itemType:'marketplace-budget-remainder',standard:'PF1-PF6 foundations',lessonFocus:'budget',kind:'subtract-two',workedExample:ex('A marketplace budget has two stated expenses.','remainder')},
 'customer-total-with-tax':{itemType:'customer-total-with-tax',standard:'PF1-PF6 foundations',lessonFocus:'customer communication',kind:'tax',workedExample:ex('A $10.00 price has 5% tax.','$10.50')},
 'record-keeping-share':{itemType:'record-keeping-share',standard:'PF1-PF6 foundations',lessonFocus:'record keeping',kind:'divide',workedExample:ex('A record total is split among equal sales.','one sale')},
 'giving-choice-remainder':{itemType:'giving-choice-remainder',standard:'PF1-PF6 foundations',lessonFocus:'reflection and giving choices',kind:'subtract-two',workedExample:ex('A fictional reflection lists a total and two allocations.','remainder')},}
export type Grade5FinLitUnit6Question=CurriculumQuestion<Grade5FinLitUnit6ItemType,FinancialParameters>
export const GRADE5_FIN_LIT_UNIT6_GENERATORS=Object.fromEntries(GRADE5_FIN_LIT_UNIT6_ITEM_TYPES.map(type=>[type,buildFinancialGenerator(GRADE5_FIN_LIT_UNIT6_ITEM_DEFINITIONS[type])])) as Record<Grade5FinLitUnit6ItemType,ReturnType<typeof buildFinancialGenerator>>
export function generateGrade5FinLitUnit6Question(type:Grade5FinLitUnit6ItemType,difficulty:Difficulty):Grade5FinLitUnit6Question{return GRADE5_FIN_LIT_UNIT6_GENERATORS[type](difficulty) as Grade5FinLitUnit6Question}
