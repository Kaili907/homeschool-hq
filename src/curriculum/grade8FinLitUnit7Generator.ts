import type { Difficulty } from '../types'
import { compoundCents, makeFinLitQuestion, money, pick, ri, type CurriculumGenerator, type FinLitQuestion } from './grade8FinLitCore'
export const GRADE8_FINLIT_UNIT7_ITEM_TYPES=['compound-growth'] as const
export type Grade8FinLitUnit7ItemType=typeof GRADE8_FINLIT_UNIT7_ITEM_TYPES[number]
export interface Grade8FinLitUnit7Parameters { principalCents: bigint; annualRateBps: bigint; compoundsPerYear: bigint; periods: bigint }
export type Grade8FinLitUnit7Question=FinLitQuestion<'compound-growth',Grade8FinLitUnit7Parameters>
const definition={standard:'FL.8.I',lessonFocus:'computing modeled savings growth',workedExample:{prompt:'A $100.00 balance earns 0% compounded monthly for 12 periods. What is its ending value?',answer:'$100.00',steps:['A 0% rate changes no period balance.','The ending balance remains $100.00.']}} as const
export function generateCompoundGrowthQuestion(difficulty:Difficulty):Grade8FinLitUnit7Question {
  const compoundsPerYear=pick([4n,12n] as const)
  const principalCents=BigInt(ri(100*difficulty,1_000*difficulty)*100)
  const annualRateBps=BigInt(ri(2,8+difficulty*2)*100)
  const periods=BigInt(ri(Number(compoundsPerYear),Number(compoundsPerYear)*difficulty*2))
  const answer=compoundCents(principalCents,annualRateBps,compoundsPerYear,periods)
  return makeFinLitQuestion({itemType:'compound-growth',difficulty,prompt:`A savings balance starts at ${money(principalCents)} and grows at a modeled nominal annual rate of ${(Number(annualRateBps)/100).toFixed(2)}%, compounded ${compoundsPerYear} times per year for ${periods} periods. After each period, round the balance to the nearest cent with a half-cent rounded up. What is the ending balance?`,correctAnswer:money(answer),distractors:[money(answer+100n),money(answer-100n),money(principalCents),money(answer+500n)],parameters:{principalCents,annualRateBps,compoundsPerYear,periods},definition})
}
export const GRADE8_FINLIT_UNIT7_GENERATORS={'compound-growth':generateCompoundGrowthQuestion} satisfies Record<Grade8FinLitUnit7ItemType,CurriculumGenerator<Grade8FinLitUnit7Question>>
export const generateGrade8FinLitUnit7Question=generateCompoundGrowthQuestion
