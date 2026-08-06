import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
/** Grade 7 U1, days 1-18 (7.RP.1-2). Ratios remain integer numerator/denominator pairs and are reduced by Euclid; no floating point is used. */
export const GRADE7_MATH_UNIT1_ITEM_TYPES=['unit-rate-fraction','proportional-table','constant-of-proportionality','equation-from-rate','proportional-or-not','reasonableness'] as const
export type Grade7MathUnit1ItemType=typeof GRADE7_MATH_UNIT1_ITEM_TYPES[number];type P={a:number;b:number;c:number;proportional:boolean;kind:Grade7MathUnit1ItemType};export type Grade7MathUnit1Question=CurriculumQuestion<Grade7MathUnit1ItemType,P>
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):Math.abs(a);const f=(a:number,b:number)=>{const g=gcd(a,b);return b/g===1?String(a/g):`${a/g}/${b/g}`}
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt, because this prose is the only teaching a student receives after a wrong
 * answer: an explanation of a different question teaches nothing.
 */
const defs:Record<Grade7MathUnit1ItemType,{standard:'7.RP.1'|'7.RP.2';lessonFocus:string;workedExample:CurriculumWorkedExample}>={
 'unit-rate-fraction':{standard:'7.RP.1',lessonFocus:'unit rates with fractions',workedExample:{
  prompt:'3 units for 4 items. What is the unit rate?',
  answer:'3/4 units per item',
  steps:[
   'A unit rate says how much there is for exactly one item, so share the 3 units equally among the 4 items.',
   'Sharing equally is division: 3 ÷ 4 = 3/4. The answer is smaller than 1 because 3 units have to cover 4 items.',
   '3 and 4 share no factor above 1, so the rate stays 3/4 units per item. Check by scaling back up: 4 items × 3/4 = 3 units.',
  ]}},
 'proportional-table':{standard:'7.RP.2',lessonFocus:'proportional relationships',workedExample:{
  prompt:'A proportional table has 6 per item. What is the output for 4 items?',
  answer:'24',
  steps:[
   'In a proportional table every row uses the same rate, so each output is the rate multiplied by that row\'s number of items.',
   'The rate is 6 per item, so 4 items give 6 × 4 = 24.',
   'The whole table follows that one rule: 1 item is 6, 2 items are 12, 3 items are 18, 4 items are 24. Every output is 6 times its input, which is what makes the table proportional.',
  ]}},
 'constant-of-proportionality':{standard:'7.RP.2',lessonFocus:'constant of proportionality',workedExample:{
  prompt:'For y = kx, y = 6 when x = 4. What is k?',
  answer:'3/2',
  steps:[
   'In y = kx the constant k is the amount of y for one unit of x, so undo the multiplication by dividing y by x.',
   'Divide: 6 ÷ 4 = 6/4.',
   '6 and 4 share the factor 2, and 6 ÷ 2 = 3 over 4 ÷ 2 = 2, so k = 3/2. Check it: 3/2 × 4 = 6, the original y.',
  ]}},
 'equation-from-rate':{standard:'7.RP.2',lessonFocus:'tables graphs and equations',workedExample:{
  prompt:'A relationship has 5 output units for each input unit. Write its equation.',
  answer:'y = 5x',
  steps:[
   'Name the quantities first: let x be the number of input units and y the number of output units.',
   'One input unit produces 5 output units, so x input units produce 5 times as many: y = 5x.',
   'Test it on a value: 3 input units should give 5 × 3 = 15 output units, and substituting x = 3 into y = 5x gives y = 15. The 5 is the constant of proportionality.',
  ]}},
 'proportional-or-not':{standard:'7.RP.2',lessonFocus:'explaining whether a relationship is proportional',workedExample:{
  prompt:'Are (1, 4), (2, 8), and (3, 12) proportional?',
  answer:'proportional',
  steps:[
   'Points are proportional only when y divided by x gives the same constant for every point, so test all of them, not just the first.',
   'Take them in order: 4 ÷ 1 = 4, then 8 ÷ 2 = 4, then 12 ÷ 3 = 4.',
   'All three give the same constant 4, so the points are proportional and the equation is y = 4x. Had the last point been (3, 13), then 13 ÷ 3 would not equal 4 and the answer would be not proportional.',
  ]}},
 reasonableness:{standard:'7.RP.1',lessonFocus:'precision and reasonableness',workedExample:{
  prompt:'A price is 6 dollars per item. Is 42 dollars the exact total for 7 items?',
  answer:'yes',
  steps:[
   'Exact means the total has to equal the price for one item multiplied by the number of items, with nothing rounded.',
   'Multiply the price by the count: 6 × 7 = 42 dollars.',
   'The claim of 42 dollars is exactly that product, so the answer is yes. If the receipt had said 44 dollars, it would be 2 dollars more than 6 × 7 and the answer would be no.',
  ]}},
}
const make=(kind:Grade7MathUnit1ItemType,difficulty:Difficulty):Grade7MathUnit1Question=>{const a=ri(2,6+difficulty),b=ri(2,6+difficulty),c=ri(2,6+difficulty),proportional=ri(0,1)===1;let correct:string,prompt:string,distractors:string[];if(kind==='unit-rate-fraction'){correct=`${f(a,b)} units per item`;prompt=`${a} units for ${b} items. What is the unit rate?`;distractors=[`${f(a+1,b)} units per item`,`${f(a,b+1)} units per item`,`${f(a+b,b)} units per item`,`${f(a+2,b)} units per item`]}else if(kind==='proportional-table'){correct=String(a*c);prompt=`A proportional table has ${a} per item. What is the output for ${c} items?`;distractors=[String(a*c+1),String(a*c-1),String(a+c),String(a*c+2)]}else if(kind==='constant-of-proportionality'){correct=f(a,b);prompt=`For y = kx, y = ${a} when x = ${b}. What is k?`;distractors=[f(a+1,b),f(a,b+1),f(a+b,b),f(a+2,b)]}else if(kind==='equation-from-rate'){correct=`y = ${a}x`;prompt=`A relationship has ${a} output units for each input unit. Write its equation.`;distractors=[`y = ${a+1}x`,`y = ${a+2}x`,`y = x + ${a}`,`y = ${a+3}x`]}else if(kind==='proportional-or-not'){correct=proportional?'proportional':'not proportional';prompt=proportional?`Are (1, ${a}), (2, ${2*a}), and (3, ${3*a}) proportional?`:`Are (1, ${a}), (2, ${2*a}), and (3, ${3*a+1}) proportional? The final ratio deliberately breaks the pattern.`;distractors=correct==='proportional'?['not proportional','cannot tell','neither','both']:['proportional','cannot tell','neither','both']}else{const claimed=a*c+(proportional?0:ri(1,4));correct=claimed===a*c?'yes':'no';prompt=`A price is ${a} dollars per item. Is ${claimed} dollars the exact total for ${c} items?`;distractors=correct==='yes'?['no','approximately','cannot tell','only if discounted']:['yes','approximately','cannot tell','only if discounted']}const d=defs[kind];return makeCurriculumQuestion({itemType:kind,standard:d.standard,lessonFocus:d.lessonFocus,difficulty,prompt,correctAnswer:correct,distractors,parameters:{a,b,c,proportional,kind},workedExample:d.workedExample,distractorMode:'distinct'})}
export const GRADE7_MATH_UNIT1_GENERATORS=Object.fromEntries(GRADE7_MATH_UNIT1_ITEM_TYPES.map(k=>[k,(d:Difficulty)=>make(k,d)])) as Record<Grade7MathUnit1ItemType,CurriculumGenerator<Grade7MathUnit1Question>>;export const generateGrade7MathUnit1Question=(itemType:Grade7MathUnit1ItemType,difficulty:Difficulty)=>GRADE7_MATH_UNIT1_GENERATORS[itemType](difficulty);export {defs as GRADE7_MATH_UNIT1_ITEM_DEFINITIONS}
