import { describe, expect, it } from 'vitest'
import { generateAccountReconciliationQuestion } from './grade8FinLitUnit2Generator'
describe('Grade 8 financial literacy unit 2',()=>it('reconciles all account entries',()=>{expect(11_100n+3_400n-1_900n-100n).toBe(12_500n);const q=generateAccountReconciliationQuestion(2);const p=q.parameters;expect(q.choices[q.answerIndex]).toBe(`$${(p.openingCents+p.depositCents-p.withdrawalCents-p.feeCents)/100n}.${String((p.openingCents+p.depositCents-p.withdrawalCents-p.feeCents)%100n).padStart(2,'0')}`)}))
