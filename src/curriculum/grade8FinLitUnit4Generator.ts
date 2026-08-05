import type { Difficulty } from '../types'
import { makeFinLitQuestion, money, ri, roundHalfUp, type CurriculumGenerator, type FinLitQuestion } from './grade8FinLitCore'
export const GRADE8_FINLIT_UNIT4_ITEM_TYPES=['credit-interest'] as const
export type Grade8FinLitUnit4ItemType=typeof GRADE8_FINLIT_UNIT4_ITEM_TYPES[number]
export interface Grade8FinLitUnit4Parameters { balanceCents: bigint; annualRateBps: bigint }
export type Grade8FinLitUnit4Question=FinLitQuestion<'credit-interest',Grade8FinLitUnit4Parameters>
const definition={standard:'FL.8.C',lessonFocus:'computing neutral credit cost',workedExample:{prompt:'A $300.00 balance has a 12% annual rate. What is one month of simple interest?',answer:'$3.00',steps:['Monthly rate is 12% divided by 12 = 1%.','One percent of $300.00 is $3.00.']}} as const
export function generateCreditInterestQuestion(difficulty:Difficulty):Grade8FinLitUnit4Question {const balanceCents=BigInt(ri(200*difficulty,900*difficulty)*100),annualRateBps=BigInt(ri(6,24+difficulty*2)*100),answer=roundHalfUp(balanceCents*annualRateBps,120_000n);return makeFinLitQuestion({itemType:'credit-interest',difficulty,prompt:`A loan balance is ${money(balanceCents)} with a nominal annual rate of ${(Number(annualRateBps)/100).toFixed(2)}%. What is one month's interest, calculated as balance × annual rate ÷ 12 and rounded to the nearest cent (half-cent up)?`,correctAnswer:money(answer),distractors:[money(answer+100n),money(answer-100n),money(roundHalfUp(balanceCents*annualRateBps,10_000n)),money(balanceCents-answer)],parameters:{balanceCents,annualRateBps},definition})}
export const GRADE8_FINLIT_UNIT4_GENERATORS={'credit-interest':generateCreditInterestQuestion} satisfies Record<Grade8FinLitUnit4ItemType,CurriculumGenerator<Grade8FinLitUnit4Question>>
export const generateGrade8FinLitUnit4Question=generateCreditInterestQuestion
