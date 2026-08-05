import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Coverage contract: Unit 6, course days 91-108, standards 5.NF.3-7. */
export const GRADE5_MATH_UNIT6_ITEM_TYPES = ['fraction-as-division','multiply-fraction-by-whole','multiply-fractions','scaling-magnitude','fraction-word-problem','divide-unit-fraction'] as const
export type Grade5MathUnit6ItemType = typeof GRADE5_MATH_UNIT6_ITEM_TYPES[number]
type Params = { a:number; b:number; c:number; d:number; mode:string }
type Q<T extends Grade5MathUnit6ItemType> = CurriculumQuestion<T, Params>
export type Grade5MathUnit6Question = { [T in Grade5MathUnit6ItemType]: Q<T> }[Grade5MathUnit6ItemType]
type Def={standard:'5.NF.3'|'5.NF.4'|'5.NF.5'|'5.NF.6'|'5.NF.7';lessonFocus:string;workedExample:CurriculumWorkedExample}
const ex=(prompt:string,answer:string):CurriculumWorkedExample=>({prompt,answer,steps:['Represent the quantities as fractions or whole numbers.','Use the operation shown and simplify the result.']})
export const GRADE5_MATH_UNIT6_ITEM_DEFINITIONS={
 'fraction-as-division':{standard:'5.NF.3',lessonFocus:'fractions as division',workedExample:ex('Write 3 ÷ 4 as a fraction.','3/4')},
 'multiply-fraction-by-whole':{standard:'5.NF.4',lessonFocus:'fraction by whole-number multiplication',workedExample:ex('Find 3 × 2/5.','1 1/5')},
 'multiply-fractions':{standard:'5.NF.4',lessonFocus:'fraction by fraction area models',workedExample:ex('Find 2/3 × 3/4.','1/2')},
 'scaling-magnitude':{standard:'5.NF.5',lessonFocus:'scaling and magnitude',workedExample:ex('Is 3/4 × 12 greater or less than 12?','less than 12')},
 'fraction-word-problem':{standard:'5.NF.6',lessonFocus:'fraction word problems',workedExample:ex('A recipe uses 3 groups of 2/3 cup. How many cups?','2')},
 'divide-unit-fraction':{standard:'5.NF.7',lessonFocus:'unit fractions divided by whole numbers',workedExample:ex('Find 1/3 ÷ 2.','1/6')},
} as const satisfies Record<Grade5MathUnit6ItemType,Def>
const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b)
const text=(n:bigint,d:bigint):string=>{const g=gcd(n,d);n/=g;d/=g;const w=n/d;const r=n%d;return w===0n?`${r}/${d}`:r===0n?`${w}`:`${w} ${r}/${d}`}
const q=(itemType:Grade5MathUnit6ItemType,difficulty:Difficulty,prompt:string,answer:string,parameters:Params)=>makeCurriculumQuestion({itemType, difficulty,prompt,correctAnswer:answer,distractors:itemType==='scaling-magnitude'?['less than','equal to','greater than'].filter(x=>x!==answer):['0','1','2','3','4','5'].filter(x=>x!==answer),choiceCount:itemType==='scaling-magnitude'?3:4,distractorMode:'distinct',parameters,...GRADE5_MATH_UNIT6_ITEM_DEFINITIONS[itemType]})
const nums=(d:Difficulty)=>[ri(1,d+3),ri(2, d===1?6:12)] as const
export function generateFractionAsDivisionQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);return q('fraction-as-division',difficulty,`Write ${a} ÷ ${b} as a fraction in simplest form.`,text(BigInt(a),BigInt(b)),{a,b,c:0,d:0,mode:'division'})}
export function generateMultiplyFractionByWholeQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const c=ri(2,difficulty+4);return q('multiply-fraction-by-whole',difficulty,`Find ${c} × ${a}/${b}. Write the answer in simplest form.`,text(BigInt(a*c),BigInt(b)),{a,b,c,d:0,mode:'whole'})}
export function generateMultiplyFractionsQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const[c,d]=nums(difficulty);return q('multiply-fractions',difficulty,`Find ${a}/${b} × ${c}/${d}. Write the answer in simplest form.`,text(BigInt(a*c),BigInt(b*d)),{a,b,c,d,mode:'fraction'})}
export function generateScalingMagnitudeQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const c=ri(2,20);const answer=a<b?'less than':a>b?'greater than':'equal to';return q('scaling-magnitude',difficulty,`Compared with ${c}, ${a}/${b} × ${c} is __ ${c}.`,answer,{a,b,c,d:0,mode:'scale'})}
export function generateFractionWordProblemQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const c=ri(2,difficulty+4);return q('fraction-word-problem',difficulty,`${c} identical ribbon pieces are ${a}/${b} meter each. What is their total length in meters?`,text(BigInt(a*c),BigInt(b)),{a,b,c,d:0,mode:'word'})}
export function generateDivideUnitFractionQuestion(difficulty:Difficulty){const b=ri(2,difficulty===1?6:12),c=ri(2,difficulty+4);return q('divide-unit-fraction',difficulty,`Find 1/${b} ÷ ${c}. Write the answer in simplest form.`,text(1n,BigInt(b*c)),{a:1,b,c,d:0,mode:'unit-divide'})}
export const GRADE5_MATH_UNIT6_GENERATORS={'fraction-as-division':generateFractionAsDivisionQuestion,'multiply-fraction-by-whole':generateMultiplyFractionByWholeQuestion,'multiply-fractions':generateMultiplyFractionsQuestion,'scaling-magnitude':generateScalingMagnitudeQuestion,'fraction-word-problem':generateFractionWordProblemQuestion,'divide-unit-fraction':generateDivideUnitFractionQuestion} satisfies Record<Grade5MathUnit6ItemType,CurriculumGenerator<Grade5MathUnit6Question>>
export function generateGrade5MathUnit6Question<T extends Grade5MathUnit6ItemType>(type:T,difficulty:Difficulty):Extract<Grade5MathUnit6Question,{itemType:T}>{return GRADE5_MATH_UNIT6_GENERATORS[type](difficulty) as Extract<Grade5MathUnit6Question,{itemType:T}>}
