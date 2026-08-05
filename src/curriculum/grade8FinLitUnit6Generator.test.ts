import { describe, expect, it } from 'vitest'
import { roundHalfUp } from './grade8FinLitCore'
import { generateInsuranceOutOfPocketQuestion } from './grade8FinLitUnit6Generator'
describe('Grade 8 financial literacy unit 6',()=>it('uses documented half-up cents',()=>{expect(roundHalfUp(5n,2n)).toBe(3n);expect(generateInsuranceOutOfPocketQuestion(2).choices).toHaveLength(4)}))
