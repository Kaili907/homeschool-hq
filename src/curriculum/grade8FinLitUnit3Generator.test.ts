import { describe, expect, it } from 'vitest'
import { generateNetPayQuestion } from './grade8FinLitUnit3Generator'
const rounded=(n:bigint,d:bigint)=>(n*2n+d)/(d*2n)
describe('Grade 8 financial literacy unit 3',()=>it('uses an independent cent-rounding oracle for net pay',()=>{const q=generateNetPayQuestion(2),p=q.parameters,tax=rounded(p.grossCents*p.taxBps,10_000n),a=p.grossCents-tax-p.deductionCents;expect(q.choices[q.answerIndex]).toBe(`$${a/100n}.${String(a%100n).padStart(2,'0')}`)}))
