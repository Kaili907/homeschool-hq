import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
/** Coverage contract: Unit 7, course days 109-126, standards 5.NBT.3, 5.NBT.4, 5.NBT.7. Decimal values are scaled integers. */
export const GRADE5_MATH_UNIT7_ITEM_TYPES=['decimal-addition','decimal-subtraction','decimal-multiplication','decimal-division','money-measurement-context','decimal-estimation-check'] as const
export type Grade5MathUnit7ItemType=typeof GRADE5_MATH_UNIT7_ITEM_TYPES[number]
type P={a:bigint;b:bigint;scale:bigint;mode:string};type Q<T extends Grade5MathUnit7ItemType>=CurriculumQuestion<T,P>;export type Grade5MathUnit7Question={ [T in Grade5MathUnit7ItemType]:Q<T>}[Grade5MathUnit7ItemType]
type Def={standard:'5.NBT.3'|'5.NBT.4'|'5.NBT.7';lessonFocus:string;workedExample:CurriculumWorkedExample}

/**
 * One authored worked example per item type. Each is a concrete instance of the
 * generated prompt shape and carries the place-value reasoning out digit by digit;
 * this prose is what a student reads after a wrong answer, so it is the teaching.
 */
export const GRADE5_MATH_UNIT7_ITEM_DEFINITIONS={
 'decimal-addition':{standard:'5.NBT.7',lessonFocus:'decimal addition',workedExample:{
  prompt:'Find 2.35 + 1.4.',
  answer:'3.75',
  steps:[
   'Line the decimal points up and fill the empty hundredths place: 2.35 + 1.40.',
   'Add hundredths: 5 + 0 = 5. Add tenths: 3 + 4 = 7. Add ones: 2 + 1 = 3.',
   'Bring the decimal point straight down into the answer: the sum is 3.75.',
  ]}},
 'decimal-subtraction':{standard:'5.NBT.7',lessonFocus:'decimal subtraction',workedExample:{
  prompt:'Find 5.2 - 1.35.',
  answer:'3.85',
  steps:[
   'Write 5.2 as 5.20 so both numbers show hundredths; the extra zero does not change its value.',
   'Hundredths: 0 - 5 needs regrouping, so 2 tenths becomes 1 tenth and 10 hundredths, and 10 - 5 = 5.',
   'Tenths: 1 - 3 needs regrouping, so 5 ones becomes 4 ones and 11 tenths, and 11 - 3 = 8. Ones: 4 - 1 = 3, giving 3.85.',
  ]}},
 'decimal-multiplication':{standard:'5.NBT.7',lessonFocus:'decimal multiplication',workedExample:{
  prompt:'Find 1.2 × 3.',
  answer:'3.6',
  steps:[
   'Ignore the decimal point at first and multiply whole numbers: 12 × 3 = 36.',
   'Count the decimal places in the factors: 1.2 has one and 3 has none, so the product needs one.',
   'Count one digit from the right of 36 and place the point there: 1.2 × 3 = 3.6.',
  ]}},
 'decimal-division':{standard:'5.NBT.7',lessonFocus:'decimal division',workedExample:{
  prompt:'Find 4.8 ÷ 3.',
  answer:'1.6',
  steps:[
   'Divide the ones first: 4 ÷ 3 = 1 with 1 one left over.',
   'That leftover one is 10 tenths; with the 8 tenths already there that makes 18 tenths, and 18 ÷ 3 = 6 tenths.',
   'Keep the decimal point directly above its place in 4.8: the quotient is 1.6.',
  ]}},
 'money-measurement-context':{standard:'5.NBT.3',lessonFocus:'money and measurement contexts',workedExample:{
  prompt:'3 tickets cost $1.25 each. What is the total cost?',
  answer:'$3.75',
  steps:[
   'Every ticket costs the same, so the total is 3 × $1.25, not $1.25 + 3.',
   'Work in whole cents to avoid a misplaced point: $1.25 is 125 cents, and 3 × 125 = 375 cents.',
   '375 cents is 3 whole dollars and 75 cents left over, so the total cost is $3.75.',
  ]}},
 'decimal-estimation-check':{standard:'5.NBT.4',lessonFocus:'operation estimation and checking',workedExample:{
  prompt:'Round each number to the nearest whole number to estimate 4.7 + 3.2.',
  answer:'8',
  steps:[
   '4.7 sits between 4 and 5; its tenths digit is 7, which is 5 or more, so 4.7 rounds up to 5.',
   '3.2 sits between 3 and 4; its tenths digit is 2, which is under 5, so 3.2 rounds down to 3.',
   'Add the rounded numbers: 5 + 3 = 8, so 4.7 + 3.2 is about 8.',
  ]}},
} as const satisfies Record<Grade5MathUnit7ItemType,Def>
const fmt=(n:bigint,s:bigint):string=>{const neg=n<0n;if(neg)n=-n;const w=n/s,r=n%s;return `${neg?'-':''}${w}.${r.toString().padStart(s.toString().length-1,'0')}`.replace(/\.0+$/,'')}
const SCALES=[1n,10n,100n,1000n,10000n] as const
const places=(scale:bigint):number=>SCALES.indexOf(scale as typeof SCALES[number])
/**
 * The classic decimal error: the digits are right but the point lands one or two
 * places off. Rendering the same scaled value at neighbouring scales reproduces
 * exactly that, so every distractor carries the item's own digits.
 */
const misplacements=(value:bigint,scale:bigint,prefix=''):string[]=>{const p=places(scale);return [p-2,p-1,p+1,p+2].filter(k=>k>=0&&k<SCALES.length).map(k=>prefix+fmt(value,SCALES[k]))}
/** Distractors always come from this item's numbers; `distinct` drops any that collapse onto the answer. */
const q=(itemType:Grade5MathUnit7ItemType,difficulty:Difficulty,prompt:string,answer:string,distractors:readonly string[],parameters:P)=>makeCurriculumQuestion({itemType,difficulty,prompt,correctAnswer:answer,distractors,distractorMode:'distinct',parameters,...GRADE5_MATH_UNIT7_ITEM_DEFINITIONS[itemType]})
const values=(d:Difficulty)=>({a:BigInt(ri(120,d===1?999:9999)),b:BigInt(ri(110,d===1?899:8999)),scale:100n})
export function generateDecimalAdditionQuestion(difficulty:Difficulty){const{a,b,scale}=values(difficulty);return q('decimal-addition',difficulty,`Find ${fmt(a,scale)} + ${fmt(b,scale)}.`,fmt(a+b,scale),[
 ...misplacements(a+b,scale),
 fmt(a+b/10n,scale),    // dropped the last digit of the second addend when aligning
 fmt(a/10n+b,scale),    // dropped the last digit of the first addend when aligning
],{a,b,scale,mode:'add'})}
export function generateDecimalSubtractionQuestion(difficulty:Difficulty){let{a,b,scale}=values(difficulty);if(a<b)[a,b]=[b,a];return q('decimal-subtraction',difficulty,`Find ${fmt(a,scale)} - ${fmt(b,scale)}.`,fmt(a-b,scale),[
 ...misplacements(a-b,scale),
 fmt(a-b/10n,scale),     // right-aligned the digits, losing the subtrahend's last place
 fmt(a-b/100n,scale),    // subtracted only the whole-number part of the second number
 fmt(a+b,scale),         // added instead of subtracting
],{a,b,scale,mode:'subtract'})}
export function generateDecimalMultiplicationQuestion(difficulty:Difficulty){const a=BigInt(ri(12,99)),b=BigInt(ri(2,difficulty+4)),scale=10n;return q('decimal-multiplication',difficulty,`Find ${a/scale}.${a%scale} × ${b}.`,fmt(a*b,scale),[
 ...misplacements(a*b,scale),
 fmt(a+b*scale,scale),        // added the whole number instead of multiplying
 fmt((a/10n)*b*scale,scale),  // dropped the tenths digit before multiplying
],{a,b,scale,mode:'multiply'})}
export function generateDecimalDivisionQuestion(difficulty:Difficulty){const b=BigInt(ri(2,difficulty+4)),answer=BigInt(ri(12,99)),scale=10n,a=b*answer;return q('decimal-division',difficulty,`Find ${a/scale}.${a%scale} ÷ ${b}.`,fmt(answer,scale),[
 ...misplacements(answer,scale),
 fmt(a*b,scale),        // multiplied instead of dividing
 fmt(a-b*scale,scale),  // subtracted the divisor instead of dividing by it
],{a,b,scale,mode:'divide'})}
export function generateMoneyMeasurementContextQuestion(difficulty:Difficulty){const a=BigInt(ri(125,999)),b=BigInt(ri(2,difficulty+4)),scale=100n;return q('money-measurement-context',difficulty,`${b} tickets cost $${fmt(a,scale)} each. What is the total cost?`, `$${fmt(a*b,scale)}`,[
 ...misplacements(a*b,scale,'$'),
 `$${fmt(a,scale)}`,           // gave the price of one ticket
 `$${fmt(a+b*scale,scale)}`,   // added the number of tickets instead of multiplying
],{a,b,scale,mode:'money'})}
export function generateDecimalEstimationCheckQuestion(difficulty:Difficulty){const{a,b,scale}=values(difficulty);const r=(x:bigint)=>((x+50n)/100n)*100n;const down=(x:bigint)=>(x/100n)*100n;const up=(x:bigint)=>((x+99n)/100n)*100n;return q('decimal-estimation-check',difficulty,`Round each number to the nearest whole number to estimate ${fmt(a,scale)} + ${fmt(b,scale)}.`,fmt(r(a)+r(b),scale),[
 ...misplacements(r(a)+r(b),scale),
 fmt(a+b,scale),              // added the exact values instead of estimating
 fmt(down(a)+down(b),scale),  // cut off the decimals instead of rounding
 fmt(up(a)+up(b),scale),      // rounded both numbers up regardless of the tenths digit
],{a,b,scale,mode:'estimate'})}
export const GRADE5_MATH_UNIT7_GENERATORS={'decimal-addition':generateDecimalAdditionQuestion,'decimal-subtraction':generateDecimalSubtractionQuestion,'decimal-multiplication':generateDecimalMultiplicationQuestion,'decimal-division':generateDecimalDivisionQuestion,'money-measurement-context':generateMoneyMeasurementContextQuestion,'decimal-estimation-check':generateDecimalEstimationCheckQuestion} satisfies Record<Grade5MathUnit7ItemType,CurriculumGenerator<Grade5MathUnit7Question>>
export function generateGrade5MathUnit7Question<T extends Grade5MathUnit7ItemType>(type:T,difficulty:Difficulty):Extract<Grade5MathUnit7Question,{itemType:T}>{return GRADE5_MATH_UNIT7_GENERATORS[type](difficulty) as Extract<Grade5MathUnit7Question,{itemType:T}>}
