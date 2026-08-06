import type { Difficulty } from '../types'
import { ri, pick } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
/** Grade 7 U3, days 37-54 (7.EE.1-2). Expressions use signed integer coefficients/constants; derived values are integer arithmetic only. */
export const GRADE7_MATH_UNIT3_ITEM_TYPES=['distribute','combine-like-terms','factor-expression','equivalent-form','interpret-expression','context-expression'] as const
export type Grade7MathUnit3ItemType=typeof GRADE7_MATH_UNIT3_ITEM_TYPES[number];type P={a:number;b:number;c:number;d:number;kind:Grade7MathUnit3ItemType};export type Grade7MathUnit3Question=CurriculumQuestion<Grade7MathUnit3ItemType,P>
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt, in the same canonical notation the generator below renders.
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
/** Canonical single term: a coefficient of 1 reads `x` and -1 reads `-x`. The variable is appended here and nowhere else. */
const term=(n:number,v='x')=>n===1?v:n===-1?`-${v}`:`${n}${v}`
/** Canonical trailing constant, so a negative constant reads ` - 4` rather than ` + -4`. */
const signed=(n:number)=>n<0?` - ${-n}`:` + ${n}`
/**
 * Canonical linear expression. A zero coefficient drops the variable (`0x - 8`
 * reads `-8`) and a zero constant drops the tail (`3x + 0` reads `3x`). The
 * rendering is one-to-one on the (coefficient, constant) pair — a bare integer
 * never contains the variable, a bare term never contains a sign separator, and
 * both halves parse back uniquely — so two linear expressions collide as strings
 * only when both numbers agree. Every distinctness argument below relies on that.
 */
const linear=(coefficient:number,constant:number,v='x')=>coefficient===0?String(constant):constant===0?term(coefficient,v):`${term(coefficient,v)}${signed(constant)}`
/** Canonical factored expression `g(x + m)` / `g(x - m)`, one-to-one on (g, m) for m != 0. */
const factored=(g:number,m:number)=>`${g}(x ${m<0?'-':'+'} ${Math.abs(m)})`
/**
 * Builds one item. Each item type gets distractors drawn from its own answer kind
 * — expressions for the three expression types, a number for the evaluation type,
 * interpretation statements for the interpretation type — so no choice can be
 * discarded on its shape alone.
 *
 * Every distractor list opens with three entries that are provably distinct from
 * the correct answer and from each other for every parameter draw, given |a| >= 2
 * and b, c, d and inside all non-zero, so the `distinct` choice builder always has
 * the three it requires and can never fail closed. Any further entry is extra
 * variety and may legitimately collapse into an earlier one.
 */
const make=(kind:Grade7MathUnit3ItemType,difficulty:Difficulty):Grade7MathUnit3Question=>{const a=pick([-1,1] as const)*ri(2,5+difficulty),b=pick([-1,1] as const)*ri(1,5+difficulty),c=pick([-1,1] as const)*ri(1,5+difficulty),d=pick([-1,1] as const)*ri(1,5+difficulty);let correct:string,prompt:string,distractors:string[]
if(kind==='distribute'){correct=linear(a,a*b);prompt=`Expand ${a}(x ${b<0?'-':'+'} ${Math.abs(b)}).`
 // Multiplied only the x term; flipped the sign of the product; did neither. The
 // constants b, -ab and -b differ pairwise, and from ab, because a is neither 1 nor -1.
 distractors=[linear(a,b),linear(a,-a*b),linear(a,-b),linear(a,a+b)]}
else if(kind==='combine-like-terms'){correct=linear(a+c,b+d);prompt=`Combine like terms: ${term(a)}${signed(b)} ${c<0?'-':'+'} ${term(Math.abs(c))}${signed(d)}.`
 // Subtracted the coefficients, subtracted the constants, or both. c and d are
 // non-zero, so a-c never equals a+c and b-d never equals b+d.
 distractors=[linear(a-c,b+d),linear(a+c,b-d),linear(a-c,b-d)]}
else if(kind==='factor-expression'){const g=ri(2,5+difficulty),inside=pick([-1,1] as const)*ri(1,5+difficulty);correct=factored(g,inside);prompt=`Factor ${g}x${signed(g*inside)} using the greatest common factor.`
 // Divided only the x term by the GCF; flipped the sign inside; did both. A fourth,
 // available when half the GCF is still a usable factor, is the classic
 // not-fully-factored answer, which no other entry can render.
 distractors=[factored(g,g*inside),factored(g,-inside),factored(g,-g*inside)]
 if(g%2===0&&g>=4)distractors.push(`${g/2}(2x ${inside<0?'-':'+'} ${2*Math.abs(inside)})`)}
else if(kind==='equivalent-form'){correct=String(a*(c+b));prompt=`Evaluate ${a}(x ${b<0?'-':'+'} ${Math.abs(b)}) when x = ${c}.`
 // Multiplied only x then added b; subtracted inside the parentheses; dropped the
 // constant inside entirely. Every difference between them, and between each of
 // them and a(b+c), is a non-zero multiple of ab or of b.
 distractors=[String(a*c+b),String(a*(c-b)),String(a*c),String(a*b+c)]}
else if(kind==='interpret-expression'){correct=`${a} per group`;prompt=`In ${term(a,'n')}${signed(b)}, what does ${a} represent?`
 // Folded the constant into the rate; read the coefficient as the fixed amount;
 // read it as the variable. b is non-zero, so a + b never equals a.
 distractors=[`${a+b} per group`,`a fixed starting amount of ${a}`,'the number of groups',`${b} per group`]}
else{correct=linear(a,b,'t');prompt=`A trip has a ${b} dollar starting adjustment and costs ${a} dollars per ticket t. Write an expression.`
 // Wrong sign on the fixed amount, on the rate, or on both; then the reversal that
 // swaps rate and fixed amount. a and b are non-zero, so the first three differ.
 distractors=[linear(a,-b,'t'),linear(-a,b,'t'),linear(-a,-b,'t'),linear(b,a,'t')]}
const definition=defs[kind];return makeCurriculumQuestion({itemType:kind,standard:definition.standard,lessonFocus:definition.lessonFocus,difficulty,prompt,correctAnswer:correct,distractors,parameters:{a,b,c,d,kind},workedExample:definition.workedExample,distractorMode:'distinct'})}
export const GRADE7_MATH_UNIT3_GENERATORS=Object.fromEntries(GRADE7_MATH_UNIT3_ITEM_TYPES.map(k=>[k,(d:Difficulty)=>make(k,d)])) as Record<Grade7MathUnit3ItemType,CurriculumGenerator<Grade7MathUnit3Question>>;export const generateGrade7MathUnit3Question=(itemType:Grade7MathUnit3ItemType,difficulty:Difficulty)=>GRADE7_MATH_UNIT3_GENERATORS[itemType](difficulty);export {defs as GRADE7_MATH_UNIT3_ITEM_DEFINITIONS}
