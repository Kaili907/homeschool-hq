import { describe, expect, it } from 'vitest'
import { roundHalfUp } from './grade8FinLitCore'
import { generateNetPayQuestion } from './grade8FinLitUnit3Generator'
describe('Grade 8 financial literacy unit 3',()=>it('has a hardcoded cent-rounding check',()=>{expect(roundHalfUp(12_345n,100n)).toBe(123n);expect(roundHalfUp(12_350n,100n)).toBe(124n);expect(generateNetPayQuestion(3).choices).toHaveLength(4)}))
