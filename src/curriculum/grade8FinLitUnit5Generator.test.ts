import { describe, expect, it } from 'vitest'
import { amortizedLoanTotalInterestCents } from './grade8FinLitCore'
import { generateAmortizedLoanInterestQuestion } from './grade8FinLitUnit5Generator'
describe('Grade 8 financial literacy unit 5',()=>{
  it('has a hardcoded amortization value and rejects non-amortizing payments',()=>{expect(amortizedLoanTotalInterestCents(100_000n,600n,17_000n)).toBe(1_755n);expect(()=>amortizedLoanTotalInterestCents(100_000n,120_000n,100n)).toThrow('does not amortize')})
  it('returns a valid generated question',()=>{const q=generateAmortizedLoanInterestQuestion(3);expect(q.choices[q.answerIndex]).toMatch(/^\$\d+\.\d{2}$/)})
})
