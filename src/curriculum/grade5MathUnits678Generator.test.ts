import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import { GRADE5_MATH_UNIT6_ITEM_TYPES, generateGrade5MathUnit6Question, type Grade5MathUnit6Question } from './grade5MathUnit6Generator'
import { GRADE5_MATH_UNIT7_ITEM_TYPES, generateGrade5MathUnit7Question, type Grade5MathUnit7Question } from './grade5MathUnit7Generator'
import { GRADE5_MATH_UNIT8_ITEM_TYPES, generateGrade5MathUnit8Question, type Grade5MathUnit8Question } from './grade5MathUnit8Generator'

afterEach(()=>setRng(null))
const seeded=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000}
const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b)
const rational=(n:bigint,d:bigint):string=>{const g=gcd(n,d);n/=g;d/=g;const w=n/d,r=n%d;return w===0n?`${r}/${d}`:r===0n?`${w}`:`${w} ${r}/${d}`}
function parseFraction(s:string):[bigint,bigint]{const m=s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/);if(!m)return [BigInt(s),1n];return [BigInt(m[1]??0)*BigInt(m[3])+BigInt(m[2]),BigInt(m[3])]}
function decimal(s:string):bigint { const [w,f='']=s.split('.');return BigInt(w)*100n+BigInt((f+'00').slice(0,2)) }
function fmt(n:bigint):string {const w=n/100n,r=n%100n;return `${w}.${r.toString().padStart(2,'0')}`.replace(/\.0+$/,'')}
function fmt10(n:bigint):string {const w=n/10n,r=n%10n;return `${w}.${r}`.replace(/\.0$/,'')}
/** Parses only question.prompt; it never reads generated parameters or generator helpers. */
function oracle6(q:Grade5MathUnit6Question):string {const p=q.prompt
 if(q.itemType==='fraction-as-division'){const m=p.match(/Write (\d+) ÷ (\d+)/)!;return rational(BigInt(m[1]),BigInt(m[2]))}
 if(q.itemType==='multiply-fraction-by-whole'){const m=p.match(/Find (\d+) × (\d+)\/(\d+)/)!;return rational(BigInt(m[1])*BigInt(m[2]),BigInt(m[3]))}
 if(q.itemType==='multiply-fractions'){const m=p.match(/Find (\d+)\/(\d+) × (\d+)\/(\d+)/)!;return rational(BigInt(m[1])*BigInt(m[3]),BigInt(m[2])*BigInt(m[4]))}
 if(q.itemType==='scaling-magnitude'){const m=p.match(/(\d+)\/(\d+) × (\d+)/)!;return +m[1]<+m[2]?'less than':+m[1]>+m[2]?'greater than':'equal to'}
 if(q.itemType==='fraction-word-problem'){const m=p.match(/(\d+) identical ribbon pieces are (\d+)\/(\d+)/)!;return rational(BigInt(m[1])*BigInt(m[2]),BigInt(m[3]))}
 const m=p.match(/1\/(\d+) ÷ (\d+)/)!;return rational(1n,BigInt(m[1])*BigInt(m[2]))}
function oracle7(q:Grade5MathUnit7Question):string {const p=q.prompt
 if(q.itemType==='money-measurement-context'){const m=p.match(/(\d+) tickets cost \$(\d+(?:\.\d+)?) each/)!;return `$${fmt(BigInt(m[1])*decimal(m[2]))}`}
 const m=p.match(/(?:Find|estimate) (\d+(?:\.\d+)?) [+×÷-] (\d+(?:\.\d+)?)/)!;const a=decimal(m[1]),b=decimal(m[2]),a10=BigInt(m[1].replace('.',''));if(q.itemType==='decimal-addition')return fmt(a+b);if(q.itemType==='decimal-subtraction')return fmt(a-b);if(q.itemType==='decimal-multiplication')return fmt10(a10*BigInt(m[2]));if(q.itemType==='decimal-division')return fmt10(a10/BigInt(m[2]));const r=(n:bigint)=>(n+50n)/100n*100n;return fmt(r(a)+r(b))}
function oracle8(q:Grade5MathUnit8Question):string {const p=q.prompt
 if(q.itemType==='measurement-conversion'){const m=p.match(/Convert (\d+) feet/)!;return `${BigInt(m[1])*12n} inches`}
 if(q.itemType==='line-plot-fraction-data'){const m=p.match(/has (\d+) marks at 1\/4 meter, (\d+) marks at 1\/2 meter, and (\d+) marks at 3\/4/)!;return `${rational(BigInt(m[1])+2n*BigInt(m[2])+3n*BigInt(m[3]),4n)} meters`}
 if(q.itemType==='additive-volume'){const m=p.match(/base of (\d+) by (\d+) units and having heights (\d+) and (\d+)/)!;expect(m[3]).not.toBe(m[4]);return `${BigInt(m[1])*BigInt(m[2])*(BigInt(m[3])+BigInt(m[4]))} cubic units`}
 const m=p.match(/(?:is|length) (\d+) (?:unit cubes long, |, width )(\d+) (?:wide, and |, and height )(\d+)/) ?? p.match(/length (\d+), width (\d+), and height (\d+) units/) ?? p.match(/is (\d+) inches by (\d+) inches by (\d+) inches/)!;const unit=q.itemType==='measurement-design'?'cubic inches':'cubic units';return `${BigInt(m[1])*BigInt(m[2])*BigInt(m[3])} ${unit}`}
function well(q:{choices:string[];answerIndex:number;prompt:string}){expect(q.choices.length).toBeGreaterThanOrEqual(3);expect(new Set(q.choices).size).toBe(q.choices.length);expect(q.choices[q.answerIndex]).toBeTruthy()}
describe('Grade 5 Units 6-8 rendered-prompt independent property oracles',()=>{
 for(const [i,type] of GRADE5_MATH_UNIT6_ITEM_TYPES.entries())it(`U6 ${type}: 600 parsed items`,()=>{setRng(seeded(600+i));for(const d of [1,2,3] as const)for(let n=0;n<200;n++){const q=generateGrade5MathUnit6Question(type,d);well(q);expect(curriculumAnswer(q)).toBe(oracle6(q))}})
 for(const [i,type] of GRADE5_MATH_UNIT7_ITEM_TYPES.entries())it(`U7 ${type}: 600 parsed items`,()=>{setRng(seeded(700+i));for(const d of [1,2,3] as const)for(let n=0;n<200;n++){const q=generateGrade5MathUnit7Question(type,d);well(q);expect(curriculumAnswer(q)).toBe(oracle7(q))}})
 for(const [i,type] of GRADE5_MATH_UNIT8_ITEM_TYPES.entries())it(`U8 ${type}: 600 parsed items`,()=>{setRng(seeded(800+i));for(const d of [1,2,3] as const)for(let n=0;n<200;n++){const q=generateGrade5MathUnit8Question(type,d);well(q);expect(curriculumAnswer(q)).toBe(oracle8(q))}})
 it('retains distinct choices with a constant injected RNG',()=>{setRng(()=>.999999);for(const t of GRADE5_MATH_UNIT6_ITEM_TYPES)well(generateGrade5MathUnit6Question(t,3));for(const t of GRADE5_MATH_UNIT7_ITEM_TYPES)well(generateGrade5MathUnit7Question(t,3));for(const t of GRADE5_MATH_UNIT8_ITEM_TYPES)well(generateGrade5MathUnit8Question(t,3))})
})
