import type { Difficulty } from '../types'
import { makeFinLitQuestion, money, ri, roundHalfUp, type CurriculumGenerator, type FinLitQuestion } from './grade8FinLitCore'
export const GRADE8_FINLIT_UNIT3_ITEM_TYPES=['net-pay'] as const
export type Grade8FinLitUnit3ItemType=typeof GRADE8_FINLIT_UNIT3_ITEM_TYPES[number]
export interface Grade8FinLitUnit3Parameters { grossCents: bigint; taxBps: bigint; deductionCents: bigint }
export type Grade8FinLitUnit3Question=FinLitQuestion<'net-pay',Grade8FinLitUnit3Parameters>
const definition={standard:'FL.8.T',lessonFocus:'computing sample take-home pay',workedExample:{prompt:'Sample gross pay is $200.00. A 10% withholding and $5.00 deduction apply. What is net pay?',answer:'$175.00',steps:['Withholding is 10% of $200.00, or $20.00.','Subtract both amounts: $200.00 - $20.00 - $5.00 = $175.00.']}} as const
export function generateNetPayQuestion(difficulty:Difficulty):Grade8FinLitUnit3Question {const grossCents=BigInt(ri(150*difficulty,600*difficulty)*100),taxBps=BigInt(ri(5,18+difficulty*2)*100),deductionCents=BigInt(ri(5*difficulty,30*difficulty)*100),tax=roundHalfUp(grossCents*taxBps,10_000n),answer=grossCents-tax-deductionCents;return makeFinLitQuestion({itemType:'net-pay',difficulty,prompt:`A sample pay statement lists gross pay of ${money(grossCents)}, withholding of ${(Number(taxBps)/100).toFixed(2)}%, and another deduction of ${money(deductionCents)}. Round withholding to the nearest cent, with a half-cent rounded up. What is net pay?`,correctAnswer:money(answer),distractors:[money(grossCents-tax),money(grossCents-deductionCents),money(grossCents+tax-deductionCents),money(answer+100n)],parameters:{grossCents,taxBps,deductionCents},definition})}
export const GRADE8_FINLIT_UNIT3_GENERATORS={'net-pay':generateNetPayQuestion} satisfies Record<Grade8FinLitUnit3ItemType,CurriculumGenerator<Grade8FinLitUnit3Question>>
export const generateGrade8FinLitUnit3Question=generateNetPayQuestion
