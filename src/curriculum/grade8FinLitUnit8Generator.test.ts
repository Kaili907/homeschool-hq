import { describe, expect, it } from 'vitest'
import { generateInflationAdjustedPriceQuestion } from './grade8FinLitUnit8Generator'
describe('Grade 8 financial literacy unit 8',()=>it('computes price increases exactly for terminating cases',()=>{const q=generateInflationAdjustedPriceQuestion(2),p=q.parameters,a=p.priceCents*(10_000n+p.increaseBps)/10_000n;expect(q.choices[q.answerIndex]).toBe(`$${a/100n}.${String(a%100n).padStart(2,'0')}`)}))
