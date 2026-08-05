import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE5_MATH_UNIT9_GENERATORS, GRADE5_MATH_UNIT9_ITEM_DEFINITIONS, GRADE5_MATH_UNIT9_ITEM_TYPES, generateGrade5MathUnit9Question, type Grade5MathUnit9Question } from './grade5MathUnit9Generator'
afterEach(()=>setRng(null)); const N=200
const seeded=(seed:number)=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000)}
function oracle(q:Grade5MathUnit9Question):string { const p=q.prompt
 switch(q.itemType){
 case 'identify-coordinate-axes':return p.includes('horizontal')?'x-axis':'y-axis'
 case 'read-ordered-pair':case 'graph-context-point':{const m=/x(?:-coordinate| = )\s*(\d+) and y(?:-coordinate| = )\s*(\d+)/.exec(p);if(!m)throw Error(p);return `(${m[1]}, ${m[2]})`}
 case 'classify-shape-properties':if(p.includes('four equal sides'))return 'rhombus';if(p.includes('3 sides'))return 'triangle';return p.includes('4 right angles')?'rectangle':'parallelogram'
 case 'shape-hierarchy':return /→ (\w+) →/.exec(p)?.[1] ?? ''
 case 'geometric-vocabulary':return p.startsWith('Lines that meet')?'perpendicular':p.startsWith('Lines in a plane')?'parallel':'vertex'
 case 'coordinate-route':{const m=/\((\d+), (\d+)\).*right (\d+) and up (\d+)/.exec(p);if(!m)throw Error(p);return `(${+m[1]+ +m[3]}, ${+m[2]+ +m[4]})`}
 }}
function well(q:Grade5MathUnit9Question){expect(curriculumAnswer(q)).toBe(oracle(q));expect(new Set(q.choices).size).toBe(4);expect(q.choices).not.toContain('');for(const c of q.choices)expect(c).not.toMatch(/-\d/)}
describe('Grade 5 Math Unit 9 coverage contract',()=>{it('has every source-derived type, definition, and generator',()=>{expect(Object.keys(GRADE5_MATH_UNIT9_GENERATORS)).toEqual([...GRADE5_MATH_UNIT9_ITEM_TYPES]);expect(Object.keys(GRADE5_MATH_UNIT9_ITEM_DEFINITIONS)).toEqual([...GRADE5_MATH_UNIT9_ITEM_TYPES]);expect(new Set(Object.values(GRADE5_MATH_UNIT9_ITEM_DEFINITIONS).map(x=>x.standard))).toEqual(new Set(['5.G.1','5.G.2','5.G.3','5.G.4']))});it('reaches every type at every difficulty',()=>{for(const t of GRADE5_MATH_UNIT9_ITEM_TYPES)for(const d of [1,2,3] as const)expect(generateGrade5MathUnit9Question(t,d).difficulty).toBe(d)})})
describe('Grade 5 Math Unit 9 independent prompt oracles',()=>{for(const [i,t] of GRADE5_MATH_UNIT9_ITEM_TYPES.entries())it(`${t}: 600 independently parsed items`,()=>{setRng(seeded(0x9000+i));for(const d of [1,2,3] as const)for(let n=0;n<N;n++)well(generateGrade5MathUnit9Question(t,d))})})
describe('Grade 5 Math Unit 9 edge and constant-RNG validation',()=>{it('keeps coordinate choices unique and nonnegative with constant RNG',()=>{setRng(()=>0);for(const t of ['read-ordered-pair','graph-context-point','coordinate-route'] as const)for(const d of [1,2,3] as const)well(generateGrade5MathUnit9Question(t,d))});it('reaches every classification family',()=>{setRng(seeded(99));const seen=new Set<string>();for(let i=0;i<300;i++)seen.add(curriculumAnswer(generateGrade5MathUnit9Question('classify-shape-properties',3)));expect(seen).toEqual(new Set(['triangle','rectangle','parallelogram','rhombus']))})})
