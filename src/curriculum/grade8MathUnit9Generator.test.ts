import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE8_MATH_UNIT9_ITEM_TYPES, generateGrade8MathUnit9Question, type Grade8MathUnit9ItemType } from './grade8MathUnit9Generator'
const RUNS_PER_DIFFICULTY=200
const rng=(seed:number)=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000)}
afterEach(()=>setRng(null))
const match=(text:string,re:RegExp)=>{const x=text.match(re);if(!x)throw new Error(`Prompt did not match oracle: ${text}`);return x}
function oracle(type:Grade8MathUnit9ItemType,prompt:string):string { switch(type){
  case 'cylinder-volume':{const [,r,h]=match(prompt,/radius (\d+) units and height (\d+) units/);return `${Number(r)**2*Number(h)}π cubic units`}
  case 'cone-volume':{const [,r,h]=match(prompt,/radius (\d+) units and height (\d+) units/);return `${Number(r)**2*Number(h)/3}π cubic units`}
  case 'sphere-volume':{const [,r]=match(prompt,/radius (\d+) units/);return `${4*Number(r)**3/3}π cubic units`}
  case 'compare-solid-volumes':return 'the cylinder'
  case 'identify-scatter-association':return prompt.includes('generally increases')?'positive':prompt.includes('generally decreases')?'negative':'none'
  case 'identify-outlier':{const points=[...prompt.matchAll(/\((-?\d+), (-?\d+)\)/g)].map(m=>[Number(m[1]),Number(m[2])]);const p=points.find(([x,y])=>y!==2*x+1);if(!p)throw new Error('No outlier');return `(${p[0]}, ${p[1]})`}
  case 'line-of-fit-prediction':{const [,a,sign,b,x]=match(prompt,/y = (\d+)x ([+-]) (\d+)\. Predict y when x = (\d+)/);return String(Number(a)*Number(x)+(sign==='+'?1:-1)*Number(b))}
  case 'interpolation-or-extrapolation':{const [,low,high,x]=match(prompt,/from (\d+) through (\d+)\. A prediction is made at x = (\d+)/);return Number(x)>Number(high)||Number(x)<Number(low)?'extrapolation':'interpolation'}
  case 'two-way-table-relative-frequency':{const [,n,d]=match(prompt,/(\d+) of (\d+) students/);const g=(a:number,b:number):number=>b?g(b,a%b):Math.abs(a);const k=g(Number(n),Number(d));return `${Number(n)/k}/${Number(d)/k}`}
  case 'correlation-versus-causation':return 'They are correlated; this alone does not prove causation.'
}}
describe('Grade 8 Math Unit 9: Volume and Bivariate Data',()=>{
  it('has twenty deterministic samples with prompt-derived answers',()=>{setRng(rng(0x89150001));for(let n=0;n<20;n++){const type=GRADE8_MATH_UNIT9_ITEM_TYPES[n%10],q=generateGrade8MathUnit9Question(type,((n%3)+1) as 1|2|3);expect(curriculumAnswer(q)).toBe(oracle(type,q.prompt));expect(new Set(q.choices).size).toBe(4)}})
  for(const type of GRADE8_MATH_UNIT9_ITEM_TYPES)it(`prompt oracle validates ${RUNS_PER_DIFFICULTY*3} ${type} cases`,()=>{for(const difficulty of [1,2,3] as const){setRng(rng(0x89151000+type.length*17+difficulty));for(let n=0;n<RUNS_PER_DIFFICULTY;n++){const q=generateGrade8MathUnit9Question(type,difficulty);expect(curriculumAnswer(q)).toBe(oracle(type,q.prompt));expect(new Set(q.choices).size).toBe(4)}}})
})
