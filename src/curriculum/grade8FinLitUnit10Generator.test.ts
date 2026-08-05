import { describe, expect, it } from 'vitest'
import { generateFinancialPlanSurplusQuestion } from './grade8FinLitUnit10Generator'
describe('Grade 8 financial literacy unit 10',()=>it('integrates the sample plan in cents',()=>{const q=generateFinancialPlanSurplusQuestion(2),p=q.parameters,a=p.incomeCents-p.expensesCents-p.taxesCents-p.savingsCents;expect(q.choices[q.answerIndex]).toBe(`$${a/100n}.${String(a%100n).padStart(2,'0')}`)}))
