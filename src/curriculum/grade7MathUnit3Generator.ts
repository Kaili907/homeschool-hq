import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Grade 7 U3, days 37-54 (7.EE.1-2). Coefficients and substitutions use integer arithmetic only; no derived answer uses floating point. */
export const GRADE7_MATH_UNIT3_ITEM_TYPES = ['distribute', 'combine-like-terms', 'factor-expression', 'equivalent-form', 'interpret-expression', 'context-expression'] as const
export type Grade7MathUnit3ItemType = typeof GRADE7_MATH_UNIT3_ITEM_TYPES[number]
type P = { a: number; b: number; c: number; kind: Grade7MathUnit3ItemType }
export type Grade7MathUnit3Question = CurriculumQuestion<Grade7MathUnit3ItemType, P>
const example: CurriculumWorkedExample = { prompt: 'Expand 3(x + 2).', answer: '3x + 6', steps: ['Distribute 3 to each term.', '3 times x + 3 times 2 = 3x + 6.'] }
const defs: Record<Grade7MathUnit3ItemType, { standard: '7.EE.1' | '7.EE.2'; lessonFocus: string; workedExample: CurriculumWorkedExample }> = {
  distribute: { standard: '7.EE.1', lessonFocus: 'distributive property', workedExample: example },
  'combine-like-terms': { standard: '7.EE.1', lessonFocus: 'combining like terms', workedExample: { ...example, prompt: 'Simplify 3x + 2x.', answer: '5x' } },
  'factor-expression': { standard: '7.EE.1', lessonFocus: 'factoring simple expressions', workedExample: { ...example, prompt: 'Factor 6x + 12.', answer: '6(x + 2)' } },
  'equivalent-form': { standard: '7.EE.1', lessonFocus: 'equivalent forms', workedExample: { ...example, prompt: 'Evaluate 2(x + 3) at x = 4.', answer: '14' } },
  'interpret-expression': { standard: '7.EE.2', lessonFocus: 'interpreting parts of expressions', workedExample: { ...example, prompt: 'In 5n + 2, what does 5 mean?', answer: '5 per group' } },
  'context-expression': { standard: '7.EE.2', lessonFocus: 'writing expressions from contexts', workedExample: { ...example, prompt: 'A fee of 3 plus 2 per ticket: expression?', answer: '2t + 3' } },
}
const q = (kind: Grade7MathUnit3ItemType, difficulty: Difficulty): Grade7MathUnit3Question => {
  const a = ri(2, 5 + difficulty), b = ri(1, 5 + difficulty), c = ri(1, 5 + difficulty), definition = defs[kind]
  let answer: string, prompt: string
  switch (kind) { case 'distribute': answer = `${a}x + ${a * b}`; prompt = `Expand ${a}(x + ${b}).`; break; case 'combine-like-terms': answer = `${a + b}x`; prompt = `Combine like terms: ${a}x + ${b}x.`; break; case 'factor-expression': answer = `${a}(x + ${b})`; prompt = `Factor ${a}x + ${a * b}.`; break; case 'equivalent-form': answer = String(a * (c + b)); prompt = `Evaluate ${a}(x + ${b}) when x = ${c}.`; break; case 'interpret-expression': answer = `${a} per group`; prompt = `In ${a}n + ${b}, what does ${a} represent?`; break; default: answer = `${a}t + ${b}`; prompt = `A service costs ${b} dollars plus ${a} dollars per ticket t. Write an expression.` }
  const distractors = [kind === 'interpret-expression' ? `${b} per group` : `${a + 1}x + ${a * b}`, kind === 'context-expression' ? `${b}t + ${a}` : `${a}x + ${b}`, String(a + b), `${a + b}x`]
  return makeCurriculumQuestion({ itemType: kind, standard: definition.standard, lessonFocus: definition.lessonFocus, difficulty, prompt, correctAnswer: answer, distractors, parameters: { a, b, c, kind }, workedExample: definition.workedExample, distractorMode: 'distinct' })
}
export const GRADE7_MATH_UNIT3_GENERATORS = Object.fromEntries(GRADE7_MATH_UNIT3_ITEM_TYPES.map(kind => [kind, (difficulty: Difficulty) => q(kind, difficulty)])) as Record<Grade7MathUnit3ItemType, CurriculumGenerator<Grade7MathUnit3Question>>
export const generateGrade7MathUnit3Question = (itemType: Grade7MathUnit3ItemType, difficulty: Difficulty) => GRADE7_MATH_UNIT3_GENERATORS[itemType](difficulty)
export { defs as GRADE7_MATH_UNIT3_ITEM_DEFINITIONS }
