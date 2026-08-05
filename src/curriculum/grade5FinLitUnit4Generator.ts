import type { Difficulty } from '../types'
import { type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
import { buildFinancialGenerator, type FinancialDefinition, type FinancialParameters } from './grade5FinancialGeneratorSupport'
const ex=(prompt:string,answer:string):CurriculumWorkedExample=>({prompt,answer,steps:['Use the fictional amounts only.','Calculate with exact integer cents.']})
export const GRADE5_FIN_LIT_UNIT4_ITEM_TYPES=['goal-share','saving-plan-total','bank-balance-remainder','interest-earned','insured-balance-check','safe-record-share'] as const
export type Grade5FinLitUnit4ItemType=typeof GRADE5_FIN_LIT_UNIT4_ITEM_TYPES[number]
export const GRADE5_FIN_LIT_UNIT4_ITEM_DEFINITIONS:Record<Grade5FinLitUnit4ItemType,FinancialDefinition<Grade5FinLitUnit4ItemType>>={
 'goal-share':{itemType:'goal-share',standard:'PF3 foundations',lessonFocus:'short and long goals',kind:'divide',workedExample:ex('Divide a fictional goal into equal parts.','one part')},
 'saving-plan-total':{itemType:'saving-plan-total',standard:'PF3 foundations',lessonFocus:'saving plans',kind:'multiply',workedExample:ex('Save $4.00 for 3 weeks.','$12.00')},
 'bank-balance-remainder':{itemType:'bank-balance-remainder',standard:'PF3 foundations',lessonFocus:'banks and credit unions',kind:'subtract-two',workedExample:ex('A fictional balance records two withdrawals.','remainder')},
 'interest-earned':{itemType:'interest-earned',standard:'PF3 foundations',lessonFocus:'interest concept',kind:'interest',workedExample:ex('A $100.00 balance earns 5% simple interest.','$5.00')},
 'insured-balance-check':{itemType:'insured-balance-check',standard:'PF6 foundations',lessonFocus:'deposit insurance concept',kind:'subtract-two',workedExample:ex('Check a fictional account record using only its stated entries.','remainder')},
 'safe-record-share':{itemType:'safe-record-share',standard:'PF6 foundations',lessonFocus:'fraud and password safety',kind:'divide',workedExample:ex('A de-identified practice record has equal items.','one item')},}
export type Grade5FinLitUnit4Question=CurriculumQuestion<Grade5FinLitUnit4ItemType,FinancialParameters>
export const GRADE5_FIN_LIT_UNIT4_GENERATORS=Object.fromEntries(GRADE5_FIN_LIT_UNIT4_ITEM_TYPES.map(type=>[type,buildFinancialGenerator(GRADE5_FIN_LIT_UNIT4_ITEM_DEFINITIONS[type])])) as Record<Grade5FinLitUnit4ItemType,ReturnType<typeof buildFinancialGenerator>>
export function generateGrade5FinLitUnit4Question(type:Grade5FinLitUnit4ItemType,difficulty:Difficulty):Grade5FinLitUnit4Question{return GRADE5_FIN_LIT_UNIT4_GENERATORS[type](difficulty) as Grade5FinLitUnit4Question}
