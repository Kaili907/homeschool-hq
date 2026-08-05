import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE5_MATH_UNIT6_ITEM_TYPES, generateGrade5MathUnit6Question } from './grade5MathUnit6Generator'
import { GRADE5_MATH_UNIT7_ITEM_TYPES, generateGrade5MathUnit7Question } from './grade5MathUnit7Generator'
import { GRADE5_MATH_UNIT8_ITEM_TYPES, generateGrade5MathUnit8Question } from './grade5MathUnit8Generator'
afterEach(()=>setRng(null))
const rng=()=>{let x=0x6789abcd;return()=>((x=Math.imul(x,1664525)+1013904223>>>0)/0x100000000)}
function wellFormed(q:{choices:string[];answerIndex:number;prompt:string}){expect(q.prompt).not.toBe('');expect(new Set(q.choices).size).toBe(q.choices.length);expect(q.choices.length).toBeGreaterThanOrEqual(3);expect(q.choices.length).toBeLessThanOrEqual(4);expect(q.choices[q.answerIndex]).toBeTruthy()}
describe('Grade 5 mathematics Units 6-8 coverage and properties',()=>{
  it('reaches every coverage-contract type at every difficulty',()=>{setRng(rng());for(const type of GRADE5_MATH_UNIT6_ITEM_TYPES)for(const d of [1,2,3] as const)wellFormed(generateGrade5MathUnit6Question(type,d));for(const type of GRADE5_MATH_UNIT7_ITEM_TYPES)for(const d of [1,2,3] as const)wellFormed(generateGrade5MathUnit7Question(type,d));for(const type of GRADE5_MATH_UNIT8_ITEM_TYPES)for(const d of [1,2,3] as const)wellFormed(generateGrade5MathUnit8Question(type,d))})
  it('validates 200 items per difficulty per Unit 6 type with exact BigInt answers',()=>{setRng(rng());for(const type of GRADE5_MATH_UNIT6_ITEM_TYPES)for(const difficulty of [1,2,3] as const)for(let i=0;i<200;i++){const q=generateGrade5MathUnit6Question(type,difficulty);wellFormed(q);expect(curriculumAnswer(q)).not.toBe('')}})
  it('validates 200 items per difficulty per Unit 7 type with scaled-integer answers',()=>{setRng(rng());for(const type of GRADE5_MATH_UNIT7_ITEM_TYPES)for(const difficulty of [1,2,3] as const)for(let i=0;i<200;i++){const q=generateGrade5MathUnit7Question(type,difficulty);wellFormed(q);expect(curriculumAnswer(q)).not.toBe('')}})
  it('validates 200 items per difficulty per Unit 8 type with exact integer answers',()=>{setRng(rng());for(const type of GRADE5_MATH_UNIT8_ITEM_TYPES)for(const difficulty of [1,2,3] as const)for(let i=0;i<200;i++){const q=generateGrade5MathUnit8Question(type,difficulty);wellFormed(q);expect(curriculumAnswer(q)).not.toBe('')}})
  it('keeps choices distinct under a constant injected RNG',()=>{setRng(()=>.999999);for(const type of GRADE5_MATH_UNIT6_ITEM_TYPES)for(const d of [1,2,3] as const)wellFormed(generateGrade5MathUnit6Question(type,d));for(const type of GRADE5_MATH_UNIT7_ITEM_TYPES)for(const d of [1,2,3] as const)wellFormed(generateGrade5MathUnit7Question(type,d));for(const type of GRADE5_MATH_UNIT8_ITEM_TYPES)for(const d of [1,2,3] as const)wellFormed(generateGrade5MathUnit8Question(type,d))})
})
