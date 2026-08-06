import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Grade 7 U2, days 19-36 (7.NS.1-3). Every item has a negative operand; fractions retain signed numerators and positive denominators and use integer cross-products only. */
export const GRADE7_MATH_UNIT2_ITEM_TYPES = ['add-signed','subtract-signed','multiply-signed','divide-signed','signed-fractions','multi-step-rational'] as const
export type Grade7MathUnit2ItemType = typeof GRADE7_MATH_UNIT2_ITEM_TYPES[number]
type P={a:number;b:number;da:number;db:number;kind:Grade7MathUnit2ItemType}; export type Grade7MathUnit2Question=CurriculumQuestion<Grade7MathUnit2ItemType,P>
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):Math.abs(a);const f=(n:number,d:number)=>{const g=gcd(n,d);return d/g===1?String(n/g):`${n/g}/${d/g}`};const proper=(d:number)=>ri(1,d-1)
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt. Sign reasoning is stated explicitly rather than asserted, because the
 * sign is exactly what a student who missed one of these items got wrong.
 */
const defs:Record<Grade7MathUnit2ItemType,{standard:'7.NS.1'|'7.NS.2'|'7.NS.3';lessonFocus:string;workedExample:CurriculumWorkedExample}>={
 'add-signed':{standard:'7.NS.1',lessonFocus:'adding signed numbers',workedExample:{
  prompt:'-8 + 3 = ?',
  answer:'-5',
  steps:[
   'Start at -8 on a number line. Adding a positive 3 moves 3 units to the right, back toward zero.',
   'The two numbers pull in opposite directions, so their distances from zero partly cancel: 8 - 3 = 5 units are left over.',
   '-8 is farther from zero than 3 is, so what is left keeps the negative direction: -8 + 3 = -5.',
  ]}},
 'subtract-signed':{standard:'7.NS.1',lessonFocus:'subtracting signed numbers',workedExample:{
  prompt:'-7 - 4 = ?',
  answer:'-11',
  steps:[
   'Subtracting 4 is the same as adding its opposite, so rewrite -7 - 4 as -7 + (-4).',
   'Both moves now go the same way on the number line, away from zero, so their distances add: 7 + 4 = 11.',
   'Both parts are negative, so the result lands 11 units to the left of zero: -7 - 4 = -11.',
  ]}},
 'multiply-signed':{standard:'7.NS.2',lessonFocus:'multiplying signed numbers',workedExample:{
  prompt:'-6 * 4 = ?',
  answer:'-24',
  steps:[
   'Multiplying by 4 means 4 equal groups of -6, that is -6 + -6 + -6 + -6.',
   'Multiply the distances from zero first: 6 × 4 = 24.',
   'Exactly one factor is negative, so the product ends up on the negative side of zero: -6 * 4 = -24. Two negative factors would have cancelled and given +24.',
  ]}},
 'divide-signed':{standard:'7.NS.2',lessonFocus:'dividing signed numbers',workedExample:{
  prompt:'-24 / 4 = ?',
  answer:'-6',
  steps:[
   'Division asks how many groups of 4 make -24, so start with the distances from zero: 24 ÷ 4 = 6.',
   'A negative divided by a positive has exactly one negative sign, so the quotient is negative.',
   'Check by multiplying back: -6 × 4 = -24, the number we started with, so -24 / 4 = -6.',
  ]}},
 'signed-fractions':{standard:'7.NS.3',lessonFocus:'fractions and decimals',workedExample:{
  prompt:'-3/4 + 1/6 = ?',
  answer:'-7/12',
  steps:[
   'The denominators 4 and 6 are different, so rewrite both fractions over a common denominator. The smallest number both divide into is 12, because 4 × 3 = 12 and 6 × 2 = 12.',
   'Rename each fraction without changing its value: -3/4 becomes -9/12, and 1/6 becomes 2/12.',
   'Add the numerators over the shared denominator: -9 and 2 pull opposite ways, leaving 7 twelfths on the negative side, so the sum is -7/12. It will not reduce, because 7 and 12 share no factor above 1.',
  ]}},
 'multi-step-rational':{standard:'7.NS.3',lessonFocus:'multi-step rational-number problems',workedExample:{
  prompt:'-9 + (3 * 4) = ?',
  answer:'3',
  steps:[
   'The order of operations puts the parentheses first, so multiply before adding: 3 * 4 = 12.',
   'The expression is now -9 + 12, which adds a positive to a negative, so the two distances from zero partly cancel.',
   '12 is farther from zero than 9 is, so 12 - 9 = 3 is left and the result is positive: -9 + (3 * 4) = 3.',
  ]}},
}
const make=(kind:Grade7MathUnit2ItemType,difficulty:Difficulty):Grade7MathUnit2Question=>{const m=5+difficulty;let a=-ri(2,m+2),b=ri(1,m),da=ri(3,6+difficulty),db=ri(3,7+difficulty);if(db===da)db=db===7+difficulty?3:db+1;let n:number,d=1,prompt:string
 if(kind==='add-signed'){if(difficulty>1)b=ri(1,Math.abs(a)-1);n=a+b;prompt=`${a} + ${b} = ?`}else if(kind==='subtract-signed'){b=ri(1,m);n=a-b;prompt=`${a} - ${b} = ?`}else if(kind==='multiply-signed'){n=a*b;prompt=`${a} * ${b} = ?`}else if(kind==='divide-signed'){b=ri(2,m);a=-b*ri(2,m);n=a/b;prompt=`${a} / ${b} = ?`}else if(kind==='signed-fractions'){let na=-proper(da),nb=proper(db);if(difficulty>1){if(db<=da)db=da+1;na=-proper(da);const maxPositiveNumerator=Math.floor(((-na)*db-1)/da);nb=ri(1,maxPositiveNumerator)}n=na*db+nb*da;d=da*db;a=na;b=nb;prompt=`${na}/${da} + ${nb}/${db} = ?`}else {b=ri(2,m);const c=ri(2,m);n=a+b*c;prompt=`${a} + (${b} * ${c}) = ?`;db=c}
 const correct=f(n,d),definition=defs[kind], distractors=[f(n+d,d),f(n-d,d),f(-n,d),f(n+2*d,d)]
 return makeCurriculumQuestion({itemType:kind,standard:definition.standard,lessonFocus:definition.lessonFocus,difficulty,prompt,correctAnswer:correct,distractors,parameters:{a,b,da,db,kind},workedExample:definition.workedExample,distractorMode:'distinct'})}
export const GRADE7_MATH_UNIT2_GENERATORS=Object.fromEntries(GRADE7_MATH_UNIT2_ITEM_TYPES.map(k=>[k,(d:Difficulty)=>make(k,d)])) as Record<Grade7MathUnit2ItemType,CurriculumGenerator<Grade7MathUnit2Question>>
export const generateGrade7MathUnit2Question=(itemType:Grade7MathUnit2ItemType,difficulty:Difficulty)=>GRADE7_MATH_UNIT2_GENERATORS[itemType](difficulty);export {defs as GRADE7_MATH_UNIT2_ITEM_DEFINITIONS}
