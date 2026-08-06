import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Source coverage: Grade 7 Mathematics Unit 4 (days 55-72), 7.EE.3-4. */
export const GRADE7_MATH_UNIT4_ITEM_TYPES = ['multi-step-numerical-problem', 'two-step-equation', 'two-step-inequality', 'solution-set', 'graph-inequality', 'check-and-interpret-solution'] as const
export type Grade7MathUnit4ItemType = typeof GRADE7_MATH_UNIT4_ITEM_TYPES[number]
type Params = { a: number; b: number; c: number; solution: number; denominator?: number; relation?: '>=' | '<='; negativeCoefficient?: boolean }
type Q<T extends Grade7MathUnit4ItemType> = CurriculumQuestion<T, Params>
export type Grade7MathUnit4Question = { [T in Grade7MathUnit4ItemType]: Q<T> }[Grade7MathUnit4ItemType]
type Def = { standard: '7.EE.3' | '7.EE.4'; lessonFocus: string; workedExample: CurriculumWorkedExample }
const example = (prompt: string, answer: string, steps: readonly string[]): CurriculumWorkedExample => ({ prompt, answer, steps })
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt, because this prose is the only teaching a student receives after a wrong
 * answer: an explanation of a different question teaches nothing.
 */
export const GRADE7_MATH_UNIT4_ITEM_DEFINITIONS = {
  'multi-step-numerical-problem': { standard: '7.EE.3', lessonFocus: 'multi-step numerical problems', workedExample: example('A group buys 4 passes at $12 each and pays a $5 service fee. What is the total cost?', '$53', [
    'Separate the two kinds of charge: the passes are priced per pass, so their cost grows with the number bought, while the service fee is charged once for the whole order.',
    'Find the cost of the passes first: 4 × 12 = 48 dollars.',
    'Then add the single service fee: 48 + 5 = 53, so the total is $53. Adding the fee before multiplying would charge it on every pass and give 4 × 17 = 68 instead.',
  ]) },
  'two-step-equation': { standard: '7.EE.4', lessonFocus: 'two-step equations', workedExample: example('Solve 3x + 5 = 26.', '7', [
    'The equation builds x in two steps: multiply by 3, then add 5. Solving undoes those steps in the opposite order, like taking off shoes after socks.',
    'Undo the addition first by subtracting 5 from both sides: 26 - 5 = 21, so 3x = 21.',
    'Undo the multiplication by dividing both sides by 3: 21 ÷ 3 = 7, so x = 7. Check by substituting back: 3 × 7 + 5 = 26.',
  ]) },
  'two-step-inequality': { standard: '7.EE.4', lessonFocus: 'two-step inequalities', workedExample: example('Solve 4x + 7 ≥ 27.', 'x ≥ 5', [
    'An inequality is solved like an equation: undo the operations in reverse order, doing the same thing to both sides each time.',
    'Subtract 7 from both sides: 27 - 7 = 20, so 4x ≥ 20.',
    'Divide both sides by 4: 20 ÷ 4 = 5, so x ≥ 5. The ≥ keeps its direction because 4 is positive; dividing by a negative number would flip it to ≤. Testing the boundary, 4 × 5 + 7 = 27, so 5 itself is a solution.',
  ]) },
  'solution-set': { standard: '7.EE.4', lessonFocus: 'solution sets', workedExample: example('Which integer satisfies 3x + 4 ≥ 22 and x < 7?', '6', [
    'Two conditions have to hold at the same time, so solve each one and keep only the integers that satisfy both.',
    'Solve the first: subtract 4 from both sides to get 3x ≥ 18, then divide by 3, and 18 ÷ 3 = 6, so x ≥ 6.',
    'The second condition says x < 7. The only integer that is at least 6 and also below 7 is 6. Check it: 3 × 6 + 4 = 22, which is not below 22, and 6 < 7.',
  ]) },
  'graph-inequality': { standard: '7.EE.4', lessonFocus: 'graphing inequalities', workedExample: example('Which graph describes x ≥ 4?', 'closed circle at 4, shaded right', [
    'A number-line graph shows every value that makes the statement true, so read the symbol and the boundary number separately.',
    'The symbol ≥ means "greater than or equal to", so 4 itself is a solution. An included boundary is drawn as a closed circle, filled in; the strict inequality x > 4 would leave 4 out and use an open circle instead.',
    'The remaining solutions are the numbers bigger than 4, and bigger numbers lie to the right, so shade to the right of 4. The picture reads: 2 --- 3 --- [4]===5===6===7 with 4 filled in and the shading running right. Checking values, 6 ≥ 4 is true and sits in the shaded part, while 3 ≥ 4 is false and sits outside it.',
  ]) },
  'check-and-interpret-solution': { standard: '7.EE.3', lessonFocus: 'checking and interpreting solutions', workedExample: example('A club charges $10 plus $6 per session for a total of $46. How many sessions were purchased?', '6', [
    'The $10 is charged once and the $6 repeats for every session, so the situation is 6x + 10 = 46, where x counts sessions.',
    'Take the one-time charge out of the total: 46 - 10 = 36 dollars was spent on sessions alone.',
    'Each session costs 6 dollars, so divide: 36 ÷ 6 = 6. Interpreting the number, x counts sessions, so the answer is 6 sessions, not 6 dollars. Check: 6 × 6 + 10 = 46.',
  ]) },
} as const satisfies Record<Grade7MathUnit4ItemType, Def>
const q = (itemType: Grade7MathUnit4ItemType, difficulty: Difficulty, prompt: string, answer: string, parameters: Params, distractors: string[]) => makeCurriculumQuestion({ itemType, difficulty, prompt, correctAnswer: answer, distractors, distractorMode: 'distinct', parameters, ...GRADE7_MATH_UNIT4_ITEM_DEFINITIONS[itemType] })
const facts = (difficulty: Difficulty) => { const a = ri(2, difficulty + 5); const x = ri(2, difficulty * 4 + 5); const b = ri(1, difficulty * 5 + 6); return { a, b, x, c: a * x + b } }
const integerText = (value: number) => String(value)
const signedTerm = (value: number) => value < 0 ? `- ${-value}` : `+ ${value}`
export function generateMultiStepNumericalProblemQuestion(difficulty: Difficulty) { const p = facts(difficulty); const count = ri(2, difficulty + 4); const unit = ri(3, difficulty * 5 + 8); const fee = ri(1, 9); const answer = count * unit + fee; return q('multi-step-numerical-problem', difficulty, `A group buys ${count} passes at $${unit} each and pays a $${fee} service fee. What is the total cost?`, `$${answer}`, { ...p, c: count, solution: answer }, [`$${answer - 1}`, `$${answer + 1}`, `$${answer + 2}`, `$${answer + 3}`]) }
export function generateTwoStepEquationQuestion(difficulty: Difficulty) { if (difficulty === 3) { const a = pick([-6, -4, 4, 6] as const); const denominator = Math.abs(a) === 4 ? pick([2, 4] as const) : pick([2, 3] as const); const numerator = denominator === 3 ? pick([-7, -5, -4, -2, 1, 2, 4, 5, 7] as const) : denominator === 4 ? pick([-7, -5, -3, 1, 3, 5, 7] as const) : pick([-7, -5, -3, 1, 5, 7] as const); const b = pick([-12, -6, 3, 9] as const); const c = b + a / denominator * numerator; const answer = `${numerator}/${denominator}`; return q('two-step-equation', difficulty, `Solve ${a}x ${signedTerm(b)} = ${c}. Write the answer in simplest form.`, answer, { a, b, c, solution: numerator, denominator }, [`${numerator + 2}/${denominator}`, `${numerator - 2}/${denominator}`, integerText(c - b), `${numerator}/${denominator === 2 ? 3 : 2}`]) } const p = facts(difficulty); const b = difficulty === 2 ? -ri(1, 14) : p.b; const solution = difficulty === 2 ? -ri(1, 10) : p.x; const c = p.a * solution + b; return q('two-step-equation', difficulty, `Solve ${p.a}x ${signedTerm(b)} = ${c}.`, String(solution), { ...p, b, c, solution }, [String(solution - 1), String(solution + 1), String(c - b), String(c / p.a)]) }
export function generateTwoStepInequalityQuestion(difficulty: Difficulty) { const p = facts(difficulty); const negativeCoefficient = difficulty === 3 ? pick([true, false] as const) : false; const relation = pick(['>=', '<='] as const); const shownSign = relation === '>=' ? '≥' : '≤'; const answerRelation = negativeCoefficient ? (relation === '>=' ? '<=' : '>=') : relation; const answerSign = answerRelation === '>=' ? '≥' : '≤'; const coefficient = negativeCoefficient ? `-${p.a}` : String(p.a); const right = negativeCoefficient ? p.b - p.a * p.x : p.c; const answer = `x ${answerSign} ${p.x}`; return q('two-step-inequality', difficulty, `Solve ${coefficient}x + ${p.b} ${shownSign} ${right}.`, answer, { ...p, c: right, solution: p.x, relation: answerRelation, negativeCoefficient }, [`x ${answerSign} ${p.x - 1}`, `x ${answerSign} ${p.x + 1}`, `x ${answerRelation === '>=' ? '≤' : '≥'} ${p.x}`, `x ${answerRelation === '>=' ? '≤' : '≥'} ${p.x + 1}`]) }
export function generateSolutionSetQuestion(difficulty: Difficulty) { const p = facts(difficulty); const upperBound = p.x + 1; return q('solution-set', difficulty, `Which integer satisfies ${p.a}x + ${p.b} ≥ ${p.c} and x < ${upperBound}?`, String(p.x), { ...p, solution: p.x, relation: '>=' }, [String(p.x - 1), String(p.x + 1), String(p.x + 2), String(p.x + 3)]) }
export function generateGraphInequalityQuestion(difficulty: Difficulty) { const p = facts(difficulty); const relation = pick(['>=', '<='] as const); const answer = relation === '>=' ? `closed circle at ${p.x}, shaded right` : `closed circle at ${p.x}, shaded left`; const opposite = relation === '>=' ? `closed circle at ${p.x}, shaded left` : `closed circle at ${p.x}, shaded right`; return q('graph-inequality', difficulty, `Which graph describes x ${relation === '>=' ? '≥' : '≤'} ${p.x}?`, answer, { ...p, solution: p.x, relation }, [opposite, `open circle at ${p.x}, shaded right`, `open circle at ${p.x}, shaded left`, `closed circle at ${p.x + 1}, shaded right`]) }
export function generateCheckAndInterpretSolutionQuestion(difficulty: Difficulty) { const p = facts(difficulty); return q('check-and-interpret-solution', difficulty, `A club charges $${p.b} plus $${p.a} per session for a total of $${p.c}. How many sessions were purchased?`, String(p.x), { ...p, solution: p.x }, [String(p.x - 1), String(p.x + 1), String(p.c / p.a), String(p.c - p.b)]) }
export const GRADE7_MATH_UNIT4_GENERATORS = { 'multi-step-numerical-problem': generateMultiStepNumericalProblemQuestion, 'two-step-equation': generateTwoStepEquationQuestion, 'two-step-inequality': generateTwoStepInequalityQuestion, 'solution-set': generateSolutionSetQuestion, 'graph-inequality': generateGraphInequalityQuestion, 'check-and-interpret-solution': generateCheckAndInterpretSolutionQuestion } satisfies Record<Grade7MathUnit4ItemType, CurriculumGenerator<Grade7MathUnit4Question>>
export function generateGrade7MathUnit4Question<T extends Grade7MathUnit4ItemType>(itemType: T, difficulty: Difficulty): Extract<Grade7MathUnit4Question, { itemType: T }> { return GRADE7_MATH_UNIT4_GENERATORS[itemType](difficulty) as Extract<Grade7MathUnit4Question, { itemType: T }> }
