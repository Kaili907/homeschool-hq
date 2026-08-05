import type { Difficulty } from '../types'
import { makeFinLitQuestion, money, ri, roundHalfUp, type CurriculumGenerator, type FinLitQuestion } from './grade8FinLitCore'
export const GRADE8_FINLIT_UNIT8_ITEM_TYPES=['inflation-adjusted-price'] as const
export type Grade8FinLitUnit8ItemType=typeof GRADE8_FINLIT_UNIT8_ITEM_TYPES[number]
export interface Grade8FinLitUnit8Parameters { priceCents: bigint; increaseBps: bigint }
export type Grade8FinLitUnit8Question=FinLitQuestion<'inflation-adjusted-price',Grade8FinLitUnit8Parameters>
const definition={standard:'FL.8.I',lessonFocus:'measuring purchasing-power change',workedExample:{prompt:'A $20.00 item rises by 5%. What is the new price?',answer:'$21.00',steps:['Five percent of $20.00 is $1.00.','Add the increase: $21.00.']}} as const
export function generateInflationAdjustedPriceQuestion(difficulty:Difficulty):Grade8FinLitUnit8Question {const priceCents=BigInt(ri(10*difficulty,80*difficulty)*100),increaseBps=BigInt(ri(2,5+difficulty*2)*100),answer=roundHalfUp(priceCents*(10_000n+increaseBps),10_000n);return makeFinLitQuestion({itemType:'inflation-adjusted-price',difficulty,prompt:`A sample item's price is ${money(priceCents)} and it increases by ${(Number(increaseBps)/100).toFixed(2)}%. Round the new price to the nearest cent, with a half-cent rounded up. What is the new price?`,correctAnswer:money(answer),distractors:[money(priceCents),money(answer+100n),money(answer-100n),money(roundHalfUp(priceCents*increaseBps,10_000n))],parameters:{priceCents,increaseBps},definition})}
export const GRADE8_FINLIT_UNIT8_GENERATORS={'inflation-adjusted-price':generateInflationAdjustedPriceQuestion} satisfies Record<Grade8FinLitUnit8ItemType,CurriculumGenerator<Grade8FinLitUnit8Question>>
export const generateGrade8FinLitUnit8Question=generateInflationAdjustedPriceQuestion
