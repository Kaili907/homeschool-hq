import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE5_MATH_UNIT10_GENERATORS, GRADE5_MATH_UNIT10_ITEM_DEFINITIONS, GRADE5_MATH_UNIT10_ITEM_TYPES, generateGrade5MathUnit10Question, type Grade5MathUnit10Question } from './grade5MathUnit10Generator'
afterEach(()=>setRng(null));const N=200;const seeded=(seed:number)=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000)};const money=(n:bigint)=>`$${n/100n}.${String(n%100n).padStart(2,'0')}`;const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b);const mixed=(n:bigint,d:bigint)=>{const g=gcd(n,d);n/=g;d/=g;const w=n/d,r=n%d;return r===0n?String(w):w===0n?`${r}/${d}`:`${w} ${r}/${d}`}
function oracle(q:Grade5MathUnit10Question):string{const p=q.prompt;let m:RegExpExecArray|null
 switch(q.itemType){
 case 'choose-operation':m=/(\d+) packs hold (\d+) markers each, and (\d+)/.exec(p);if(!m)throw Error(p);return String(+m[1]* +m[2]+ +m[3])
 case 'whole-number-model':m=/Find (\d+) × (\d+)/.exec(p);if(!m)throw Error(p);return String(BigInt(m[1])*BigInt(m[2]))
 case 'division-model':m=/(\d+) supplies.*among (\d+) teams/.exec(p);if(!m)throw Error(p);return String(BigInt(m[1])/BigInt(m[2]))
 case 'decimal-budget':m=/(\d+) tickets cost \$(\d+)\.(\d+) each.*\$(\d+)\.(\d+) fee/.exec(p);if(!m)throw Error(p);return money(BigInt(m[1])*(BigInt(m[2])*100n+BigInt(m[3]))+BigInt(m[4])*100n+BigInt(m[5]))
 case 'fraction-project':m=/uses (\d+)\/(\d+) meter.*and (\d+)\/(\d+) meter/.exec(p);if(!m)throw Error(p);return mixed(BigInt(m[1])*BigInt(m[4])+BigInt(m[3])*BigInt(m[2]),BigInt(m[2])*BigInt(m[4]))
 case 'scale-project':m=/A (\d+)\/(\d+)-meter path is scaled by (\d+)/.exec(p);if(!m)throw Error(p);return mixed(BigInt(m[1])*BigInt(m[3]),BigInt(m[2]))
 case 'volume-plan':m=/is (\d+) units long, (\d+) units wide, and (\d+) units high/.exec(p);if(!m)throw Error(p);return String(BigInt(m[1])*BigInt(m[2])*BigInt(m[3]))
 case 'coordinate-data':m=/\((\d+), (\d+)\).*right (\d+) and up (\d+)/.exec(p);if(!m)throw Error(p);return `(${+m[1]+ +m[3]}, ${+m[2]+ +m[4]})`
 case 'model-argument':m=/A student says a (\d+) by (\d+) by (\d+) box/.exec(p);if(!m)throw Error(p);return `No; the volume is ${BigInt(m[1])*BigInt(m[2])*BigInt(m[3])} cubic units.`
 }}
function well(q:Grade5MathUnit10Question){expect(curriculumAnswer(q)).toBe(oracle(q));expect(new Set(q.choices).size).toBe(4);for(const c of q.choices){expect(c.trim()).not.toBe('');expect(c).not.toMatch(/-\d/)}}
describe('Grade 5 Math Unit 10 coverage contract',()=>{it('has all integrated source standards and types',()=>{expect(Object.keys(GRADE5_MATH_UNIT10_GENERATORS)).toEqual([...GRADE5_MATH_UNIT10_ITEM_TYPES]);expect(Object.keys(GRADE5_MATH_UNIT10_ITEM_DEFINITIONS)).toEqual([...GRADE5_MATH_UNIT10_ITEM_TYPES]);expect(new Set(Object.values(GRADE5_MATH_UNIT10_ITEM_DEFINITIONS).map(x=>x.standard))).toEqual(new Set(['5.OA.1','5.NBT.5','5.NBT.6','5.NBT.7','5.NF.1','5.NF.4','5.MD.5','5.G.2','MP.4']))});it('reaches every type at every difficulty',()=>{for(const t of GRADE5_MATH_UNIT10_ITEM_TYPES)for(const d of [1,2,3] as const)expect(generateGrade5MathUnit10Question(t,d).difficulty).toBe(d)})})
describe('Grade 5 Math Unit 10 independent prompt oracles',()=>{for(const [i,t] of GRADE5_MATH_UNIT10_ITEM_TYPES.entries())it(`${t}: 600 independently parsed items`,()=>{setRng(seeded(0xa000+i));for(const d of [1,2,3] as const)for(let n=0;n<N;n++)well(generateGrade5MathUnit10Question(t,d))})})
describe('Grade 5 Math Unit 10 edge and constant-RNG validation',()=>{it('preserves exact cents, rational products, division invariant, and volume',()=>{setRng(()=>0);for(let n=0;n<30;n++){const d=generateGrade5MathUnit10Question('division-model',3);expect(BigInt(d.parameters.dividend)).toBe(BigInt(d.parameters.divisor)*BigInt(curriculumAnswer(d)));well(d);well(generateGrade5MathUnit10Question('decimal-budget',3));well(generateGrade5MathUnit10Question('fraction-project',3));well(generateGrade5MathUnit10Question('scale-project',3));well(generateGrade5MathUnit10Question('volume-plan',3))}})})
