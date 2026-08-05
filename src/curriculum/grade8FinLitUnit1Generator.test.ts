import { describe, expect, it } from 'vitest'
import { generateBudgetBalanceQuestion } from './grade8FinLitUnit1Generator'
describe('Grade 8 financial literacy unit 1',()=>it('computes budget remainders from cents',()=>{for(const d of [1,2,3] as const){const q=generateBudgetBalanceQuestion(d);expect(q.choices[q.answerIndex]).toBe(`$${(q.parameters.incomeCents-q.parameters.needsCents-q.parameters.savingsCents)/100n}.${String((q.parameters.incomeCents-q.parameters.needsCents-q.parameters.savingsCents)%100n).padStart(2,'0')}`)}}))
