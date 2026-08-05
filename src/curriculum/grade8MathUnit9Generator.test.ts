import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT9_ITEM_TYPES, generateGrade8MathUnit9Question } from './grade8MathUnit9Generator'
const rng=(seed:number)=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000)}
afterEach(()=>setRng(null))
describe('Grade 8 Math Unit 9: Volume and Bivariate Data',()=>{
  it('produces twenty deterministic desk samples with four distinct choices',()=>{setRng(rng(0x89150001));for(let n=0;n<20;n++){const q=generateGrade8MathUnit9Question(GRADE8_MATH_UNIT9_ITEM_TYPES[n%10],((n%3)+1) as 1|2|3);expect(q.prompt).not.toBe('');expect(q.choices).toContain(curriculumAnswer(q));expect(new Set(q.choices).size).toBe(4)}})
  it('keeps volume exact as rational multiples of pi',()=>{setRng(rng(1));for(const t of ['cylinder-volume','cone-volume','sphere-volume'] as const){const q=generateGrade8MathUnit9Question(t,3);expect(curriculumAnswer(q)).toMatch(/^\d+π cubic units$/);expect(q.prompt).toContain('exact')}})
  for(const type of GRADE8_MATH_UNIT9_ITEM_TYPES)it(`uses the source standard for ${type}`,()=>{setRng(rng(type.length));for(let n=0;n<100;n++){const q=generateGrade8MathUnit9Question(type,((n%3)+1) as 1|2|3);expect(q.standard).toMatch(/^8\.(G\.9|SP\.[1-4])$/);expect(new Set(q.choices).size).toBe(4)}})
})
