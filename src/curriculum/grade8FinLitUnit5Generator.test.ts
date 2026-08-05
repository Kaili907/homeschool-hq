import { describe, expect, it } from 'vitest'
import { generateAmortizedLoanInterestQuestion } from './grade8FinLitUnit5Generator'
const rounded=(n:bigint,d:bigint)=>(n*2n+d)/(d*2n)
describe('Grade 8 financial literacy unit 5',()=>it('uses an independent monthly amortization oracle',()=>{const q=generateAmortizedLoanInterestQuestion(3),p=q.parameters;let balance=p.principalCents,total=0n;while(balance>0n){const interest=rounded(balance*p.annualRateBps,120_000n);total+=interest;const due=balance+interest;if(p.monthlyPaymentCents>=due)break;balance=due-p.monthlyPaymentCents}expect(q.choices[q.answerIndex]).toBe(`$${total/100n}.${String(total%100n).padStart(2,'0')}`)}))
