import { describe, expect, it } from 'vitest'
import { roundHalfUp } from './grade8FinLitCore'
import { generateInflationAdjustedPriceQuestion } from './grade8FinLitUnit8Generator'
describe('Grade 8 financial literacy unit 8',()=>it('rounds inflation prices half-up to cents',()=>{expect(roundHalfUp(20_005n,1_000n)).toBe(20n);expect(roundHalfUp(20_500n,1_000n)).toBe(21n);expect(generateInflationAdjustedPriceQuestion(2).choices).toHaveLength(4)}))
