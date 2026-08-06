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

/**
 * One authored worked example per item type. Each is a concrete instance of the
 * generated prompt shape and shows the arithmetic a student must actually perform;
 * this prose is what a student reads after a wrong answer, so it is the teaching.
 */
export const GRADE5_MATH_UNIT6_ITEM_DEFINITIONS={
 'fraction-as-division':{standard:'5.NF.3',lessonFocus:'fractions as division',workedExample:{
  prompt:'Write 3 ÷ 4 as a fraction in simplest form.',
  answer:'3/4',
  steps:[
   'Sharing 3 wholes equally among 4 people gives each person 3 ÷ 4, which is written as the fraction 3/4.',
   'Check the size: 4 shares of 3/4 rebuild the original amount, because 4 × 3/4 = 12/4 = 3.',
   'The only factor 3 and 4 share is 1, so 3/4 is already in simplest form.',
  ]}},
 'multiply-fraction-by-whole':{standard:'5.NF.4',lessonFocus:'fraction by whole-number multiplication',workedExample:{
  prompt:'Find 3 × 2/5. Write the answer in simplest form.',
  answer:'1 1/5',
  steps:[
   '3 × 2/5 means 3 copies of 2/5, that is 2/5 + 2/5 + 2/5.',
   'Multiply the whole number by the numerator only and keep the denominator: (3 × 2)/5 = 6/5.',
   '6/5 is one whole (5/5) with 1/5 left over, so the answer is 1 1/5.',
  ]}},
 'multiply-fractions':{standard:'5.NF.4',lessonFocus:'fraction by fraction area models',workedExample:{
  prompt:'Find 2/3 × 3/4. Write the answer in simplest form.',
  answer:'1/2',
  steps:[
   'Multiply the numerators: 2 × 3 = 6. This counts the shaded parts of the area model.',
   'Multiply the denominators: 3 × 4 = 12. This counts all the parts the model is cut into.',
   'That gives 6/12; the greatest common factor of 6 and 12 is 6, and 6 ÷ 6 = 1 over 12 ÷ 6 = 2, so the answer is 1/2.',
  ]}},
 'scaling-magnitude':{standard:'5.NF.5',lessonFocus:'scaling and magnitude',workedExample:{
  prompt:'Compared with 12, 3/4 × 12 is __ 12.',
  answer:'less than',
  steps:[
   'The factor 3/4 is smaller than 1, so it keeps only 3 of every 4 parts of 12 instead of all of them.',
   'Compute to check: 3/4 × 12 = (3 × 12)/4 = 36/4 = 9.',
   'Because 9 is below 12, the product is less than 12. Multiplying by a factor under 1 always scales a number down.',
  ]}},
 'fraction-word-problem':{standard:'5.NF.6',lessonFocus:'fraction word problems',workedExample:{
  prompt:'3 identical ribbon pieces are 2/3 meter each. What is their total length in meters?',
  answer:'2',
  steps:[
   'Equal-length pieces means repeated addition, which is multiplication: 3 × 2/3.',
   'Multiply the count by the numerator and keep the denominator: (3 × 2)/3 = 6/3.',
   '6/3 means 6 thirds, and every 3 thirds make 1 whole, so 6/3 = 2 meters.',
  ]}},
 'divide-unit-fraction':{standard:'5.NF.7',lessonFocus:'unit fractions divided by whole numbers',workedExample:{
  prompt:'Find 1/3 ÷ 2. Write the answer in simplest form.',
  answer:'1/6',
  steps:[
   'Dividing 1/3 by 2 means splitting one third into 2 equal pieces, so each piece must be smaller than 1/3.',
   'Dividing by 2 is the same as multiplying by its reciprocal 1/2: (1 × 1)/(3 × 2) = 1/6.',
   'Check by rebuilding: 2 copies of 1/6 give 2/6 = 1/3, the amount we started with.',
  ]}},
} as const satisfies Record<Grade5MathUnit6ItemType,Def>

/**
 * 5.NF.5 is about scaling in both directions, so a scaling-magnitude item can
 * answer any of the three comparisons. Each one gets its own walkthrough: a
 * student who missed a greater-than item must not be handed a less-than one.
 * The `less than` entry is the item type's default worked example above.
 */
export const GRADE5_MATH_UNIT6_SCALING_EXAMPLES={
 'less than':GRADE5_MATH_UNIT6_ITEM_DEFINITIONS['scaling-magnitude'].workedExample,
 'greater than':{
  prompt:'Compared with 12, 5/4 × 12 is __ 12.',
  answer:'greater than',
  steps:[
   'The factor 5/4 is larger than 1, because 5 fourths is one whole (4/4) plus an extra 1/4.',
   'Compute to check: 5/4 × 12 = (5 × 12)/4 = 60/4 = 15.',
   'Because 15 is above 12, the product is greater than 12. Multiplying by a factor over 1 always scales a number up.',
  ]},
 'equal to':{
  prompt:'Compared with 12, 4/4 × 12 is __ 12.',
  answer:'equal to',
  steps:[
   'The factor 4/4 is exactly 1, because 4 fourths make one whole with nothing left over.',
   'Compute to check: 4/4 × 12 = (4 × 12)/4 = 48/4 = 12.',
   'The product is 12, the number we started with. Multiplying by 1 leaves a number unchanged.',
  ]},
} as const satisfies Record<string,CurriculumWorkedExample>
const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b)
const text=(n:bigint,d:bigint):string=>{const g=gcd(n,d);n/=g;d/=g;const w=n/d;const r=n%d;return w===0n?`${r}/${d}`:r===0n?`${w}`:`${w} ${r}/${d}`}
/**
 * Distractors are supplied by each generator from that item's own numbers, so a
 * student cannot spot the answer by its shape or eliminate a fixed 0-5 pool.
 * `distinct` mode drops any candidate that collapses onto the answer or a sibling.
 */
const q=(itemType:Grade5MathUnit6ItemType,difficulty:Difficulty,prompt:string,answer:string,distractors:readonly string[],parameters:Params,workedExample?:CurriculumWorkedExample)=>makeCurriculumQuestion({itemType,difficulty,prompt,correctAnswer:answer,distractors,choiceCount:itemType==='scaling-magnitude'?3:4,distractorMode:'distinct',parameters,...GRADE5_MATH_UNIT6_ITEM_DEFINITIONS[itemType],...(workedExample?{workedExample}:{})})
/** Every generated fraction operand is proper, so it cannot reduce to an integer. */
const nums=(d:Difficulty)=>{const b=ri(3,d===1?6:12);return [ri(1,b-1),b] as const}
export function generateFractionAsDivisionQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const A=BigInt(a),B=BigInt(b);return q('fraction-as-division',difficulty,`Write ${a} ÷ ${b} as a fraction in simplest form.`,text(A,B),[
 text(B,A),      // divided in the reverse order, b ÷ a
 `${a}/${b}`,    // stopped before simplifying
 text(B-A,B),    // named the leftover share instead of one share
 text(A,A+B),    // wrote dividend over the total instead of over the divisor
 text(B,A+B),    // the same part-to-whole slip with the numbers reversed
],{a,b,c:0,d:0,mode:'division'})}
export function generateMultiplyFractionByWholeQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const c=ri(2,difficulty+4);const A=BigInt(a),B=BigInt(b),C=BigInt(c);return q('multiply-fraction-by-whole',difficulty,`Find ${c} × ${a}/${b}. Write the answer in simplest form.`,text(A*C,B),[
 text(A,B),        // multiplied the denominator by c as well, leaving a/b unchanged
 text(A+C*B,B),    // added the whole number instead of multiplying
 text(A,B*C),      // multiplied the denominator instead of the numerator
 `${a*c}/${b}`,    // stopped at the improper fraction
],{a,b,c,d:0,mode:'whole'})}
export function generateMultiplyFractionsQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const[c,d]=nums(difficulty);const A=BigInt(a),B=BigInt(b),C=BigInt(c),D=BigInt(d);return q('multiply-fractions',difficulty,`Find ${a}/${b} × ${c}/${d}. Write the answer in simplest form.`,text(A*C,B*D),[
 text(A*D,B*C),      // inverted the second fraction, as if dividing
 text(A*C,B),        // multiplied numerators but kept only the first denominator
 text(A*C,D),        // multiplied numerators but kept only the second denominator
 text(A+C,B+D),      // added straight across instead of multiplying
 text(A*C,B+D),      // multiplied the numerators but added the denominators
 `${a*c}/${b*d}`,    // stopped before simplifying
],{a,b,c,d,mode:'fraction'})}
/**
 * The scaling factor is drawn case-first so all three comparisons stay frequent.
 * Drawing a numerator freely would leave the factor proper almost every time, and
 * a student could answer "less than" by rote without meeting the half of 5.NF.5
 * that says a factor above 1 scales up. The greater-than case stays strictly
 * between 1 and 2, so it always reads as a genuine improper fraction rather than
 * a whole number in disguise.
 */
const scalingFactor=(d:Difficulty):readonly[number,number]=>{
 const b=ri(3,d===1?6:12)
 const shape=ri(0,2)
 if(shape===0)return [b,b] as const              // b/b, exactly one whole
 if(shape===1)return [ri(1,b-1),b] as const      // proper, under one whole
 return [ri(b+1,2*b-1),b] as const               // improper, over one whole but under two
}
export function generateScalingMagnitudeQuestion(difficulty:Difficulty){const[a,b]=scalingFactor(difficulty);const c=ri(2,20);const answer=a<b?'less than':a>b?'greater than':'equal to';return q('scaling-magnitude',difficulty,`Compared with ${c}, ${a}/${b} × ${c} is __ ${c}.`,answer,
 // The three comparison words are the question's own answer space, not a numeric pool.
 ['less than','greater than','equal to'].filter(x=>x!==answer),
{a,b,c,d:0,mode:'scale'},GRADE5_MATH_UNIT6_SCALING_EXAMPLES[answer])}
export function generateFractionWordProblemQuestion(difficulty:Difficulty){const[a,b]=nums(difficulty);const c=ri(2,difficulty+4);const A=BigInt(a),B=BigInt(b),C=BigInt(c);return q('fraction-word-problem',difficulty,`${c} identical ribbon pieces are ${a}/${b} meter each. What is their total length in meters?`,text(A*C,B),[
 text(A,B),        // gave the length of a single piece
 text(A+C*B,B),    // added the number of pieces instead of multiplying
 text(A,B*C),      // divided by the number of pieces instead of multiplying
 `${a*c}/${b}`,    // stopped at the improper fraction
],{a,b,c,d:0,mode:'word'})}
export function generateDivideUnitFractionQuestion(difficulty:Difficulty){const b=ri(2,difficulty===1?6:12),c=ri(2,difficulty+4);const B=BigInt(b),C=BigInt(c);return q('divide-unit-fraction',difficulty,`Find 1/${b} ÷ ${c}. Write the answer in simplest form.`,text(1n,B*C),[
 text(C,B),       // multiplied by c instead of dividing by it
 text(B,C),       // inverted the unit fraction instead of the divisor
 text(1n,B),      // repeated the starting amount without dividing
 text(B*C,1n),    // reversed dividend and divisor, computing c ÷ 1/b
 text(1n,B+C),    // added the divisor onto the denominator
],{a:1,b,c,d:0,mode:'unit-divide'})}
export const GRADE5_MATH_UNIT6_GENERATORS={'fraction-as-division':generateFractionAsDivisionQuestion,'multiply-fraction-by-whole':generateMultiplyFractionByWholeQuestion,'multiply-fractions':generateMultiplyFractionsQuestion,'scaling-magnitude':generateScalingMagnitudeQuestion,'fraction-word-problem':generateFractionWordProblemQuestion,'divide-unit-fraction':generateDivideUnitFractionQuestion} satisfies Record<Grade5MathUnit6ItemType,CurriculumGenerator<Grade5MathUnit6Question>>
export function generateGrade5MathUnit6Question<T extends Grade5MathUnit6ItemType>(type:T,difficulty:Difficulty):Extract<Grade5MathUnit6Question,{itemType:T}>{return GRADE5_MATH_UNIT6_GENERATORS[type](difficulty) as Extract<Grade5MathUnit6Question,{itemType:T}>}
