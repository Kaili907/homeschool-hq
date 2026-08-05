import { describe, expect, it } from 'vitest'
import { generateTotalCostComparisonQuestion } from './grade8FinLitUnit9Generator'
describe('Grade 8 financial literacy unit 9',()=>it('selects the lower total cost',()=>{const q=generateTotalCostComparisonQuestion(2),p=q.parameters,a=p.quantityA*p.unitACents,b=p.quantityB*p.unitBCents;expect(q.choices[q.answerIndex]).toBe(a<b?`Option A, $${a/100n}.${String(a%100n).padStart(2,'0')}`:`Option B, $${b/100n}.${String(b%100n).padStart(2,'0')}`)}))
