import type { Difficulty } from '../types'
import { amortizedLoanTotalInterestCents, makeFinLitQuestion, money, ri, type CurriculumGenerator, type FinLitQuestion } from './grade8FinLitCore'
export const GRADE8_FINLIT_UNIT5_ITEM_TYPES=['amortized-loan-interest'] as const
export type Grade8FinLitUnit5ItemType=typeof GRADE8_FINLIT_UNIT5_ITEM_TYPES[number]
export interface Grade8FinLitUnit5Parameters { principalCents: bigint; annualRateBps: bigint; monthlyPaymentCents: bigint }
export type Grade8FinLitUnit5Question=FinLitQuestion<'amortized-loan-interest',Grade8FinLitUnit5Parameters>
const definition={standard:'FL.8.L',lessonFocus:'reading an amortized loan schedule',workedExample:{prompt:'A $100.00 loan at 0% is paid with $25.00 each month. What total interest is paid?',answer:'$0.00',steps:['A 0% rate produces $0.00 interest each month.','The payments only reduce principal.']}} as const
export function generateAmortizedLoanInterestQuestion(difficulty:Difficulty):Grade8FinLitUnit5Question {
  const principalCents=BigInt(ri(800*difficulty,2_000*difficulty)*100)
  const annualRateBps=BigInt(ri(4,12+difficulty*3)*100)
  const monthlyPaymentCents=principalCents/BigInt(ri(4,6+difficulty))+BigInt(ri(4_000,8_000))
  const answer=amortizedLoanTotalInterestCents(principalCents,annualRateBps,monthlyPaymentCents)
  return makeFinLitQuestion({itemType:'amortized-loan-interest',difficulty,prompt:`A sample loan has principal ${money(principalCents)}, nominal annual rate ${(Number(annualRateBps)/100).toFixed(2)}%, and fixed monthly payments of ${money(monthlyPaymentCents)}. Each month, calculate interest as balance × annual rate ÷ 12, round to the nearest cent with a half-cent rounded up, add it to the balance, and then apply the payment. The final payment may be smaller. What is the total interest paid?`,correctAnswer:money(answer),distractors:[money(answer+100n),money(answer+500n),money(answer-100n),money(answer+1_000n)],parameters:{principalCents,annualRateBps,monthlyPaymentCents},definition})
}
export const GRADE8_FINLIT_UNIT5_GENERATORS={'amortized-loan-interest':generateAmortizedLoanInterestQuestion} satisfies Record<Grade8FinLitUnit5ItemType,CurriculumGenerator<Grade8FinLitUnit5Question>>
export const generateGrade8FinLitUnit5Question=generateAmortizedLoanInterestQuestion
