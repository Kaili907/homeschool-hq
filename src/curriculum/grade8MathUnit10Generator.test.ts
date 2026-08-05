import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT10_ITEM_TYPES, generateGrade8MathUnit10Question, type Grade8MathUnit10ItemType } from './grade8MathUnit10Generator'
const RUNS_PER_DIFFICULTY=200
const rng=(seed:number)=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000)}
afterEach(()=>setRng(null))
const match=(text:string,re:RegExp)=>{const x=text.match(re);if(!x)throw new Error(`Prompt did not match oracle: ${text}`);return x}
function oracle(type:Grade8MathUnit10ItemType,prompt:string):string { switch(type){
  case 'define-variable':return 'x = number of hours worked'
  case 'state-model-assumption':return 'The hourly charge remains $12 for every hour.'
  case 'select-linear-or-nonlinear-model':return prompt.includes('squared')?'nonlinear':'linear'
  case 'solve-model-equation':{const [,a,sign,b,c]=match(prompt,/gives (\d+)x ([+-]) (\d+) = (-?\d+)/);return String((Number(c)-(sign==='+'?1:-1)*Number(b))/Number(a))}
  case 'solve-system-constraint':{const [,a,s1,b,c,s2,d]=match(prompt,/y = (\d+)x ([+-]) (\d+) and y = (\d+)x ([+-]) (\d+)/);const b0=(s1==='+'?1:-1)*Number(b),d0=(s2==='+'?1:-1)*Number(d),x=(d0-b0)/(Number(a)-Number(c));return `(${x}, ${Number(a)*x+b0})`}
  case 'geometry-measurement-model':{const [,a,b]=match(prompt,/side lengths (\d+) units and (\d+) units/);return `${Math.sqrt(Number(a)**2+Number(b)**2)} units`}
  case 'interpret-data-trend':return prompt.includes('performance scores')?'positive':'negative'
  case 'identify-model-limitation':return 'The prediction is an extrapolation and may be less reliable.'
  case 'choose-mathematical-evidence':return 'show calculations and compare predictions to data'
  case 'communicate-model-conclusion':return 'State the result, units, assumption, and limitation.'
}}
describe('Grade 8 Math Unit 10: Integrated Algebraic Modeling Capstone',()=>{
  it('has twenty deterministic samples with prompt-derived answers',()=>{setRng(rng(0x8a150001));for(let n=0;n<20;n++){const type=GRADE8_MATH_UNIT10_ITEM_TYPES[n%10],q=generateGrade8MathUnit10Question(type,((n%3)+1) as 1|2|3);expect(curriculumAnswer(q)).toBe(oracle(type,q.prompt));expect(new Set(q.choices).size).toBe(4)}})
  for(const type of GRADE8_MATH_UNIT10_ITEM_TYPES)it(`prompt oracle validates ${RUNS_PER_DIFFICULTY*3} ${type} cases`,()=>{for(const difficulty of [1,2,3] as const){setRng(rng(0x8a151000+type.length*17+difficulty));for(let n=0;n<RUNS_PER_DIFFICULTY;n++){const q=generateGrade8MathUnit10Question(type,difficulty);expect(curriculumAnswer(q)).toBe(oracle(type,q.prompt));expect(new Set(q.choices).size).toBe(4)}}})
})
