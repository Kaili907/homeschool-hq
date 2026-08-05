import { describe, expect, it } from 'vitest'
import { generateCreditInterestQuestion } from './grade8FinLitUnit4Generator'
const rounded=(n:bigint,d:bigint)=>(n*2n+d)/(d*2n)
describe('Grade 8 financial literacy unit 4',()=>it('computes monthly credit cost in exact cents',()=>{const q=generateCreditInterestQuestion(3),p=q.parameters,a=rounded(p.balanceCents*p.annualRateBps,120_000n);expect(q.choices[q.answerIndex]).toBe(`$${a/100n}.${String(a%100n).padStart(2,'0')}`)}))
