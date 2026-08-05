import type { Difficulty } from '../types'
import { type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { buildFinancialGenerator, type FinancialDefinition, type FinancialParameters } from './grade5FinancialGeneratorSupport'
const ex=(prompt:string,answer:string):CurriculumWorkedExample=>({prompt,answer,steps:['Use the fictional quantities only.','Calculate with integer cents.']})
export const GRADE5_FIN_LIT_UNIT2_ITEM_TYPES=['income-total','skills-earnings-goal','take-home-remainder','enterprise-revenue','unpaid-work-budget','workplace-pay-check'] as const
export type Grade5FinLitUnit2ItemType=typeof GRADE5_FIN_LIT_UNIT2_ITEM_TYPES[number]
export const GRADE5_FIN_LIT_UNIT2_ITEM_DEFINITIONS:Record<Grade5FinLitUnit2ItemType,FinancialDefinition<Grade5FinLitUnit2ItemType>>={
 'income-total':{itemType:'income-total',standard:'PF1 foundations',lessonFocus:'ways people earn income',kind:'multiply',workedExample:ex('Two jobs earn $5.00 each.','$10.00')},
 'skills-earnings-goal':{itemType:'skills-earnings-goal',standard:'PF1 foundations',lessonFocus:'skills and education',kind:'divide',workedExample:ex('A $12.00 goal is divided among 3 equal jobs.','$4.00')},
 'take-home-remainder':{itemType:'take-home-remainder',standard:'PF1 foundations',lessonFocus:'gross and take-home concepts',kind:'subtract-two',workedExample:ex('Subtract two stated deductions from a fictional gross amount.','remainder')},
 'enterprise-revenue':{itemType:'enterprise-revenue',standard:'PF1 foundations',lessonFocus:'entrepreneurship',kind:'multiply',workedExample:ex('Four sales earn $3.00 each.','$12.00')},
 'unpaid-work-budget':{itemType:'unpaid-work-budget',standard:'PF1 foundations',lessonFocus:'unpaid family and community work',kind:'subtract-two',workedExample:ex('A fictional plan lists a total and two costs.','remainder')},
 'workplace-pay-check':{itemType:'workplace-pay-check',standard:'PF1 foundations',lessonFocus:'workplace responsibility',kind:'divide',workedExample:ex('An amount is equally recorded for identical tasks.','one task amount')},}
export type Grade5FinLitUnit2Question=CurriculumQuestion<Grade5FinLitUnit2ItemType,FinancialParameters>
export const GRADE5_FIN_LIT_UNIT2_GENERATORS=Object.fromEntries(GRADE5_FIN_LIT_UNIT2_ITEM_TYPES.map(type=>[type,buildFinancialGenerator(GRADE5_FIN_LIT_UNIT2_ITEM_DEFINITIONS[type])])) as Record<Grade5FinLitUnit2ItemType,ReturnType<typeof buildFinancialGenerator>>
export function generateGrade5FinLitUnit2Question(type:Grade5FinLitUnit2ItemType,difficulty:Difficulty):Grade5FinLitUnit2Question{return GRADE5_FIN_LIT_UNIT2_GENERATORS[type](difficulty) as Grade5FinLitUnit2Question}
