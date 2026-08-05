import { describe, expect, it } from 'vitest'
import { roundHalfUp } from './grade8FinLitCore'
import { generateCreditInterestQuestion } from './grade8FinLitUnit4Generator'
describe('Grade 8 financial literacy unit 4',()=>it('has a hardcoded monthly-interest rounding check',()=>{expect(roundHalfUp(1_000_000n,120_000n)).toBe(8n);expect(generateCreditInterestQuestion(3).choices).toHaveLength(4)}))
