import type { Difficulty } from '../types'
import { type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { buildFinancialGenerator, type FinancialDefinition, type FinancialParameters } from './grade5FinancialGeneratorSupport'
const ex=(prompt:string,answer:string):CurriculumWorkedExample=>({prompt,answer,steps:['Use only the fictional quantities shown.','Calculate with integer cents.']})
export const GRADE5_FIN_LIT_UNIT5_ITEM_TYPES=['repayment-share','borrowing-interest-cost','lending-boundary-total','giving-plan-remainder','risk-cost-check','scam-safe-record'] as const
export type Grade5FinLitUnit5ItemType=typeof GRADE5_FIN_LIT_UNIT5_ITEM_TYPES[number]
export const GRADE5_FIN_LIT_UNIT5_ITEM_DEFINITIONS:Record<Grade5FinLitUnit5ItemType,FinancialDefinition<Grade5FinLitUnit5ItemType>>={
 'repayment-share':{itemType:'repayment-share',standard:'PF4 foundations',lessonFocus:'borrowing and repayment',kind:'divide',workedExample:ex('Divide a fictional repayment into equal amounts.','one payment')},
 'borrowing-interest-cost':{itemType:'borrowing-interest-cost',standard:'PF4 foundations',lessonFocus:'interest as cost',kind:'interest',workedExample:ex('A $100.00 balance has 5% simple interest.','$5.00')},
 'lending-boundary-total':{itemType:'lending-boundary-total',standard:'PF4 foundations',lessonFocus:'responsible lending boundaries',kind:'subtract-two',workedExample:ex('Check a fictional plan by subtracting stated costs.','remainder')},
 'giving-plan-remainder':{itemType:'giving-plan-remainder',standard:'PF4 foundations',lessonFocus:'giving and community support',kind:'subtract-two',workedExample:ex('A fictional giving plan states a total and two amounts.','remainder')},
 'risk-cost-check':{itemType:'risk-cost-check',standard:'PF6 foundations',lessonFocus:'risk and protection',kind:'tax',workedExample:ex('A whole-dollar fictional price has stated tax.','total')},
 'scam-safe-record':{itemType:'scam-safe-record',standard:'PF6 foundations',lessonFocus:'scams',kind:'divide',workedExample:ex('A de-identified record shows equal items.','one item')},}
export type Grade5FinLitUnit5Question=CurriculumQuestion<Grade5FinLitUnit5ItemType,FinancialParameters>
export const GRADE5_FIN_LIT_UNIT5_GENERATORS=Object.fromEntries(GRADE5_FIN_LIT_UNIT5_ITEM_TYPES.map(type=>[type,buildFinancialGenerator(GRADE5_FIN_LIT_UNIT5_ITEM_DEFINITIONS[type])])) as Record<Grade5FinLitUnit5ItemType,ReturnType<typeof buildFinancialGenerator>>
export function generateGrade5FinLitUnit5Question(type:Grade5FinLitUnit5ItemType,difficulty:Difficulty):Grade5FinLitUnit5Question{return GRADE5_FIN_LIT_UNIT5_GENERATORS[type](difficulty) as Grade5FinLitUnit5Question}
