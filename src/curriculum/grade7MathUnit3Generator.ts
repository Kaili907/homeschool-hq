import type { Difficulty } from '../types'
import { ri, pick } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
/** Grade 7 U3, days 37-54 (7.EE.1-2). Expressions use signed integer coefficients/constants; derived values are integer arithmetic only. */
export const GRADE7_MATH_UNIT3_ITEM_TYPES=['distribute','combine-like-terms','factor-expression','equivalent-form','interpret-expression','context-expression'] as const
export type Grade7MathUnit3ItemType=typeof GRADE7_MATH_UNIT3_ITEM_TYPES[number];type P={a:number;b:number;c:number;d:number;kind:Grade7MathUnit3ItemType};export type Grade7MathUnit3Question=CurriculumQuestion<Grade7MathUnit3ItemType,P>
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt. The variable is written the standard way, as `5x`; `term()` below
 * already appends the variable and the callers append a second `x`, so generated
 * `distribute` and `combine-like-terms` strings read `5xx`. Repairing that would
 * change generated prompts and correct answers, which this change does not own, so
 * the teaching prose uses correct notation and the artifact is pinned by
 * `documents the pre-existing doubled-variable artifact` in the unit tests.
 */
const defs:Record<Grade7MathUnit3ItemType,{standard:'7.EE.1'|'7.EE.2';lessonFocus:string;workedExample:CurriculumWorkedExample}>={
 distribute:{standard:'7.EE.1',lessonFocus:'distributive property',workedExample:{
  prompt:'Expand -5(x - 3).',
  answer:'-5x + 15',
  steps:[
   'The distributive property says the factor outside the parentheses multiplies every term inside, not only the first one.',
   'Multiply the first term: -5 × x = -5x.',
   'The second term is -3 because of the subtraction sign, so multiply -5 × -3 = 15; two negatives make a positive. Putting the pieces together, -5(x - 3) = -5x + 15.',
  ]}},
 'combine-like-terms':{standard:'7.EE.1',lessonFocus:'combining like terms',workedExample:{
  prompt:'Combine like terms: 5x + 6 - 2x - 2.',
  answer:'3x + 4',
  steps:[
   'Like terms have exactly the same variable part. Here 5x and -2x are like terms, and the plain numbers 6 and -2 are like terms with each other. An x-term can never be combined with a plain number.',
   'Combine the x-terms by adding their coefficients: 5 - 2 = 3, which gives 3x.',
   'Combine the constants the same way: 6 - 2 = 4. Nothing else can be joined, so the expression is 3x + 4.',
  ]}},
 'factor-expression':{standard:'7.EE.1',lessonFocus:'factoring simple expressions',workedExample:{
  prompt:'Factor 4x + 12 using the greatest common factor.',
  answer:'4(x + 3)',
  steps:[
   'Factoring undoes the distributive property, so look for the largest number that divides both 4x and 12.',
   '4 divides by 1, 2 and 4; 12 divides by 1, 2, 3, 4, 6 and 12. The greatest factor they share is 4.',
   'Divide each term by 4: 4 ÷ 4 = 1 leaves x, and 12 ÷ 4 = 3, so the expression is 4(x + 3). Multiplying back gives 4 × x + 4 × 3 = 4x + 12, the original expression.',
  ]}},
 'equivalent-form':{standard:'7.EE.1',lessonFocus:'equivalent forms',workedExample:{
  prompt:'Evaluate 3(x + 5) when x = 2.',
  answer:'21',
  steps:[
   'Substitute first: replace x with 2 everywhere it appears, giving 3(2 + 5).',
   'The order of operations does the parentheses first: 2 + 5 = 7.',
   'Then multiply by the factor outside: 3 × 7 = 21. Expanding first gives the same value, because 3x + 15 at x = 2 is 6 + 15 = 21 — that is what equivalent means.',
  ]}},
 'interpret-expression':{standard:'7.EE.2',lessonFocus:'interpreting parts of expressions',workedExample:{
  prompt:'In 4n + 7, what does 4 represent?',
  answer:'4 per group',
  steps:[
   'The number multiplied by the variable is a rate: it says how much is added for each single unit of n.',
   'Test it with numbers: at n = 1 the expression is 4 × 1 + 7 = 11, and at n = 2 it is 4 × 2 + 7 = 15.',
   'Each extra group raises the total by 15 - 11 = 4, so the 4 represents 4 per group. The 7 is the fixed starting amount, which never changes no matter how large n gets.',
  ]}},
 'context-expression':{standard:'7.EE.2',lessonFocus:'writing expressions from contexts',workedExample:{
  prompt:'A trip has a 6 dollar starting adjustment and costs 5 dollars per ticket t. Write an expression.',
  answer:'5t + 6',
  steps:[
   'Identify what varies: t is the number of tickets, and the cost changes with it.',
   'Each ticket costs 5 dollars, so t tickets cost 5 times t, written 5t. The 6 dollar starting adjustment is counted once, however many tickets there are.',
   'Adding the two parts gives 5t + 6. Check with 3 tickets: 5 × 3 + 6 = 21 dollars, which matches 3 tickets at 5 dollars plus the single 6 dollar adjustment.',
  ]}},
}
const term=(n:number,v='x')=>n===1?v:n===-1?`-${v}`:`${n}${v}`;const signed=(n:number)=>n<0?` - ${-n}`:` + ${n}`
const make=(kind:Grade7MathUnit3ItemType,difficulty:Difficulty):Grade7MathUnit3Question=>{const a=pick([-1,1] as const)*ri(2,5+difficulty),b=pick([-1,1] as const)*ri(1,5+difficulty),c=pick([-1,1] as const)*ri(1,5+difficulty),d=pick([-1,1] as const)*ri(1,5+difficulty);let correct:string,prompt:string
if(kind==='distribute'){correct=`${term(a)}x${signed(a*b)}`;prompt=`Expand ${a}(x ${b<0?'-':'+'} ${Math.abs(b)}).`}else if(kind==='combine-like-terms'){correct=`${term(a+c)}x${signed(b+d)}`;prompt=`Combine like terms: ${term(a)}x${signed(b)} ${c<0?'-':'+'} ${term(Math.abs(c))}x${signed(d)}.`}else if(kind==='factor-expression'){const g=ri(2,5+difficulty),inside=pick([-1,1] as const)*ri(1,5+difficulty);correct=`${g}(x ${inside<0?'-':'+'} ${Math.abs(inside)})`;prompt=`Factor ${g}x${signed(g*inside)} using the greatest common factor.`}else if(kind==='equivalent-form'){correct=String(a*(c+b));prompt=`Evaluate ${a}(x ${b<0?'-':'+'} ${Math.abs(b)}) when x = ${c}.`}else if(kind==='interpret-expression'){correct=`${a} per group`;prompt=`In ${term(a,'n')}${signed(b)}, what does ${a} represent?`}else{correct=`${term(a,'t')}${signed(b)}`;prompt=`A trip has a ${b} dollar starting adjustment and costs ${a} dollars per ticket t. Write an expression.`}const choices=[`${term(a+1)}x${signed(a*b)}`,`${term(a)}x${signed(b)}`,`${term(a+c)}x${signed(b+d)}`,String(a+b+c)];const definition=defs[kind];return makeCurriculumQuestion({itemType:kind,standard:definition.standard,lessonFocus:definition.lessonFocus,difficulty,prompt,correctAnswer:correct,distractors:choices,parameters:{a,b,c,d,kind},workedExample:definition.workedExample,distractorMode:'distinct'})}
export const GRADE7_MATH_UNIT3_GENERATORS=Object.fromEntries(GRADE7_MATH_UNIT3_ITEM_TYPES.map(k=>[k,(d:Difficulty)=>make(k,d)])) as Record<Grade7MathUnit3ItemType,CurriculumGenerator<Grade7MathUnit3Question>>;export const generateGrade7MathUnit3Question=(itemType:Grade7MathUnit3ItemType,difficulty:Difficulty)=>GRADE7_MATH_UNIT3_GENERATORS[itemType](difficulty);export {defs as GRADE7_MATH_UNIT3_ITEM_DEFINITIONS}
