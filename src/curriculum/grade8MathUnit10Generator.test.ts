import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT10_ITEM_TYPES, generateGrade8MathUnit10Question } from './grade8MathUnit10Generator'
const rng=(seed:number)=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000)}
afterEach(()=>setRng(null))
describe('Grade 8 Math Unit 10: Integrated Algebraic Modeling Capstone',()=>{
  it('produces twenty deterministic desk samples with four distinct choices',()=>{setRng(rng(0x8a150001));for(let n=0;n<20;n++){const q=generateGrade8MathUnit10Question(GRADE8_MATH_UNIT10_ITEM_TYPES[n%10],((n%3)+1) as 1|2|3);expect(q.prompt).not.toBe('');expect(q.choices).toContain(curriculumAnswer(q));expect(new Set(q.choices).size).toBe(4)}})
  for(const type of GRADE8_MATH_UNIT10_ITEM_TYPES)it(`uses capstone standards for ${type}`,()=>{setRng(rng(type.length));for(let n=0;n<100;n++){const q=generateGrade8MathUnit10Question(type,((n%3)+1) as 1|2|3);expect(q.standard).toMatch(/^(8\.(EE\.[78]|F\.4|G\.7|SP\.3)|MP\.4)$/);expect(new Set(q.choices).size).toBe(4)}})
})
