import { describe, expect, it } from 'vitest'
import { compoundCents } from './grade8FinLitCore'
import { generateCompoundGrowthQuestion } from './grade8FinLitUnit7Generator'
describe('Grade 8 financial literacy unit 7',()=>it('has a hardcoded exact-cent compounding value',()=>{expect(compoundCents(10_000n,600n,12n,12n)).toBe(10_618n);expect(generateCompoundGrowthQuestion(2).choices).toHaveLength(4)}))
