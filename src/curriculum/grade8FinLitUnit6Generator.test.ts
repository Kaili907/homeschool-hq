import { describe, expect, it } from 'vitest'
import { generateInsuranceOutOfPocketQuestion } from './grade8FinLitUnit6Generator'
describe('Grade 8 financial literacy unit 6',()=>it('computes deductibles and coinsurance',()=>{const q=generateInsuranceOutOfPocketQuestion(2),p=q.parameters,a=p.deductibleCents+(p.lossCents-p.deductibleCents)*(10_000n-p.coverageBps)/10_000n;expect(q.choices[q.answerIndex]).toBe(`$${a/100n}.${String(a%100n).padStart(2,'0')}`)}))
