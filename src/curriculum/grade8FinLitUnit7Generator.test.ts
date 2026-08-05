import { describe, expect, it } from 'vitest'
import { generateCompoundGrowthQuestion } from './grade8FinLitUnit7Generator'
const rounded=(n:bigint,d:bigint)=>(n*2n+d)/(d*2n)
describe('Grade 8 financial literacy unit 7',()=>it('uses an independent exact-cent compounding oracle',()=>{const q=generateCompoundGrowthQuestion(2),p=q.parameters;let balance=p.principalCents;for(let i=0n;i<p.periods;i++)balance=rounded(balance*(10_000n*p.compoundsPerYear+p.annualRateBps),10_000n*p.compoundsPerYear);expect(q.choices[q.answerIndex]).toBe(`$${balance/100n}.${String(balance%100n).padStart(2,'0')}`)}))
