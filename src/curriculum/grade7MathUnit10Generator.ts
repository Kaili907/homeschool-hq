import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Source coverage: Grade 7 Mathematics Unit 10 "Integrated Modeling and Capstone" (days 163-180), 7.RP.3, 7.NS.3, 7.EE.4, 7.G.6, 7.SP.4, MP.4. */
export const GRADE7_MATH_UNIT10_ITEM_TYPES = ['problem-formulation', 'assumptions-and-constraints', 'proportional-and-algebraic-models', 'geometry-and-measurement', 'data-and-uncertainty', 'argument-and-presentation'] as const
export type Grade7MathUnit10ItemType = typeof GRADE7_MATH_UNIT10_ITEM_TYPES[number]
type Params = { a?: number; b?: number; c?: number; solution?: number; values?: number[]; mad?: number; meanA?: number }
type Q<T extends Grade7MathUnit10ItemType> = CurriculumQuestion<T, Params>
export type Grade7MathUnit10Question = { [T in Grade7MathUnit10ItemType]: Q<T> }[Grade7MathUnit10ItemType]
type Def = { standard: '7.RP.3' | '7.NS.3' | '7.EE.4' | '7.G.6' | '7.SP.4' | 'MP.4'; lessonFocus: string; workedExample: CurriculumWorkedExample }
const example = (prompt: string, answer: string, steps: readonly string[]): CurriculumWorkedExample => ({ prompt, answer, steps })
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt. This is the capstone unit, so each walkthrough names the modelling move
 * as well as the arithmetic: what the unknown stands for, which quantity is a
 * constraint rather than a term, and what the number means back in the context.
 */
export const GRADE7_MATH_UNIT10_ITEM_DEFINITIONS = {
  'problem-formulation': { standard: '7.EE.4', lessonFocus: 'problem formulation', workedExample: example('A rental company charges a $10 base fee plus $5 per hour. A customer\'s total bill was $45. Which equation models this situation, and how many hours were rented?', '5x + 10 = 45; x = 7', [
    'Name the unknown first: let x be the number of hours rented, because that is the quantity that changes from customer to customer.',
    'The $5 hourly charge repeats once per hour, giving 5x, and the $10 base fee is paid a single time, so the model is 5x + 10 = 45.',
    'Solve by undoing the two steps: 45 - 10 = 35, so 5x = 35, and 35 ÷ 5 = 7. The customer rented 7 hours. Check: 5 × 7 + 10 = 45.',
  ]) },
  'assumptions-and-constraints': { standard: '7.NS.3', lessonFocus: 'assumptions and constraints', workedExample: example('A diver starts at the surface (0 m) and descends 8 m, then descends another 6 m, then ascends 5 m. The dive plan assumes a depth limit of 25 m below the surface. What is the diver\'s final position, as a signed number of meters?', '-9', [
    'Fix a sign convention before computing: the surface is 0, descending is negative and ascending is positive. Without that choice the numbers cannot be added.',
    'Add the two descents: -8 + -6 = -14, so the diver reaches 14 m below the surface.',
    'Now apply the ascent: -14 + 5 = -9. The diver ends at -9, which reads as 9 m below the surface. The 25 m depth limit is a constraint to check, not a quantity to add: the deepest point, -14, stays inside it, so the plan holds.',
  ]) },
  'proportional-and-algebraic-models': { standard: '7.RP.3', lessonFocus: 'proportional and algebraic models', workedExample: example('A model predicts a $80 rate will increase by 25%. What does the model predict as the new rate?', '$100', [
    'The model scales the rate proportionally, so the new rate is the old rate plus a fixed fraction of that same old rate.',
    '25% is 25 hundredths, and 25/100 reduces to 1/4, so the increase is 80 ÷ 4 = 20 dollars.',
    'Add the increase to the original rate: 80 + 20 = 100, so the model predicts $100. The same answer comes from scaling in one step, since a 25% increase multiplies by 1.25 and 80 × 1.25 = 100.',
  ]) },
  'geometry-and-measurement': { standard: '7.G.6', lessonFocus: 'geometry and measurement', workedExample: example('A storage container is designed as a rectangular prism 4 ft long, 3 ft wide, and 2 ft high. What is its volume in cubic feet?', '24', [
    'Volume counts how many unit cubes fill the container, so all three dimensions multiply together rather than adding.',
    'Start with a single layer on the floor: 4 × 3 = 12, so one layer holds 12 unit cubes.',
    'The container is 2 ft high, so it stacks 2 of those layers: 12 × 2 = 24 cubic feet. Surface area answers a different question, adding up the six faces instead of filling the inside.',
  ]) },
  'data-and-uncertainty': { standard: '7.SP.4', lessonFocus: 'data and uncertainty', workedExample: example('A data set has the values 30, 35, 40, 45, 50. The mean is 40. What is the mean absolute deviation (MAD), a measure of the data\'s uncertainty or spread?', '6', [
    'The mean absolute deviation asks how far a typical value sits from the mean, so measure each value\'s distance from 40 and ignore whether it is above or below.',
    'The five distances are 40 - 30 = 10, then 40 - 35 = 5, then 0 for the value that is the mean, then 45 - 40 = 5, then 50 - 40 = 10.',
    'Average those distances: 10 + 5 + 0 + 5 + 10 = 30, and 30 ÷ 5 = 6. The MAD is 6, meaning values sit about 6 away from the mean on average. A larger MAD would mean a more spread-out, less predictable data set.',
  ]) },
  'argument-and-presentation': { standard: 'MP.4', lessonFocus: 'argument and presentation', workedExample: example('A student claims a box that is 4 by 3 by 2 units has a volume of 9 cubic units. Evaluate the claim.', 'No; the volume is 24 cubic units, not 9.', [
    'Evaluating a claim means recomputing it yourself, then saying plainly whether it holds and why.',
    'Volume multiplies the three dimensions: 4 × 3 = 12 for one layer, and 12 × 2 = 24 cubic units in total.',
    '24 does not match the claimed 9, so the claim is wrong. Tracing the error, 4 + 3 + 2 = 9, so the student added the dimensions where they should have multiplied. A complete response names the correct value and the mistake: No; the volume is 24 cubic units, not 9.',
  ]) },
} as const satisfies Record<Grade7MathUnit10ItemType, Def>
const q = (itemType: Grade7MathUnit10ItemType, difficulty: Difficulty, prompt: string, answer: string, parameters: Params, distractors: string[]) => makeCurriculumQuestion({ itemType, difficulty, prompt, correctAnswer: answer, distractors, distractorMode: 'distinct', parameters, ...GRADE7_MATH_UNIT10_ITEM_DEFINITIONS[itemType] })
const dollars = (value: number) => `$${value.toFixed(2).replace(/\.00$/, '')}`
export function generateProblemFormulationQuestion(difficulty: Difficulty) { const a = ri(2, difficulty + 5); const x = ri(2, difficulty * 4 + 5); const b = ri(1, difficulty * 5 + 6); const c = a * x + b; const answer = `${a}x + ${b} = ${c}; x = ${x}`; return q('problem-formulation', difficulty, `A rental company charges a $${b} base fee plus $${a} per hour. A customer's total bill was $${c}. Which equation models this situation, and how many hours were rented?`, answer, { a, b, c, solution: x }, [`${a}x + ${b} = ${c}; x = ${x - 1}`, `${a}x - ${b} = ${c}; x = ${x + 1}`, `${a}x + ${b} = ${c}; x = ${x + 1}`, `${b}x + ${a} = ${c}; x = ${x + 2}`]) }
export function generateAssumptionsAndConstraintsQuestion(difficulty: Difficulty) { const descend1 = ri(3, difficulty * 8 + 10); const descend2 = ri(2, difficulty * 6 + 8); const ascend = ri(2, difficulty * 8 + 10); const limit = descend1 + descend2 + ri(5, 20); const answer = -(descend1 + descend2) + ascend; return q('assumptions-and-constraints', difficulty, `A diver starts at the surface (0 m) and descends ${descend1} m, then descends another ${descend2} m, then ascends ${ascend} m. The dive plan assumes a depth limit of ${limit} m below the surface. What is the diver's final position, as a signed number of meters?`, String(answer), { a: descend1, b: descend2, c: ascend, solution: answer }, [String(-(descend1 + descend2) - ascend), String(descend1 + descend2 + ascend), String(descend1 - descend2 + ascend), String(-(descend1 + descend2) + 2 * ascend)]) }
export function generateProportionalAndAlgebraicModelsQuestion(difficulty: Difficulty) { const amount = ri(4, difficulty * 10 + 25) * 20; const percent = pick([5, 10, 20, 25] as const); const increase = pick([true, false] as const); const answer = amount * (increase ? 1 + percent / 100 : 1 - percent / 100); return q('proportional-and-algebraic-models', difficulty, `A model predicts a $${amount} rate will ${increase ? 'increase' : 'decrease'} by ${percent}%. What does the model predict as the new rate?`, dollars(answer), { a: amount, b: percent }, [dollars(amount * (increase ? 1 - percent / 100 : 1 + percent / 100)), dollars(amount * percent / 100), dollars(amount + percent), dollars(amount)]) }
export function generateGeometryAndMeasurementQuestion(difficulty: Difficulty) { const l = ri(2, difficulty * 3 + 5); const w = ri(2, difficulty * 3 + 4); const h = ri(2, difficulty * 3 + 3); const volume = l * w * h; const surfaceArea = 2 * (l * w + l * h + w * h); return q('geometry-and-measurement', difficulty, `A storage container is designed as a rectangular prism ${l} ft long, ${w} ft wide, and ${h} ft high. What is its volume in cubic feet?`, String(volume), { a: l, b: w, c: h, solution: volume }, [String(surfaceArea), String(l * w), String(volume + l), String(volume - h)]) }
export function generateDataAndUncertaintyQuestion(difficulty: Difficulty) { const mean = ri(30, difficulty * 15 + 40); const kMax = Math.max(1, Math.min(difficulty + 2, Math.floor(mean / 10))); const k = ri(1, kMax); const d = 5 * k; const values = [mean - 2 * d, mean - d, mean, mean + d, mean + 2 * d]; const answer = 6 * k; return q('data-and-uncertainty', difficulty, `A data set has the values ${values.join(', ')}. The mean is ${mean}. What is the mean absolute deviation (MAD), a measure of the data's uncertainty or spread?`, String(answer), { values, mad: answer, meanA: mean }, [String(answer + k), String(answer - k), String(2 * d), String(k)]) }
export function generateArgumentAndPresentationQuestion(difficulty: Difficulty) { const l = ri(2, 8); const w = ri(2, 8); const h = ri(2, 8); const correctVolume = l * w * h; const claim = pick([l + w + h, l * w, correctVolume + ri(1, 10)] as const); const answer = `No; the volume is ${correctVolume} cubic units, not ${claim}.`; return q('argument-and-presentation', difficulty, `A student claims a box that is ${l} by ${w} by ${h} units has a volume of ${claim} cubic units. Evaluate the claim.`, answer, { a: l, b: w, c: h, solution: correctVolume }, [`Yes; the volume is ${claim} cubic units.`, `No; the volume is ${claim + 1} cubic units, not ${claim}.`, `No; the volume is ${claim + 2} cubic units, not ${claim}.`, 'Cannot be determined from the given information.']) }
export const GRADE7_MATH_UNIT10_GENERATORS = { 'problem-formulation': generateProblemFormulationQuestion, 'assumptions-and-constraints': generateAssumptionsAndConstraintsQuestion, 'proportional-and-algebraic-models': generateProportionalAndAlgebraicModelsQuestion, 'geometry-and-measurement': generateGeometryAndMeasurementQuestion, 'data-and-uncertainty': generateDataAndUncertaintyQuestion, 'argument-and-presentation': generateArgumentAndPresentationQuestion } satisfies Record<Grade7MathUnit10ItemType, CurriculumGenerator<Grade7MathUnit10Question>>
export function generateGrade7MathUnit10Question<T extends Grade7MathUnit10ItemType>(itemType: T, difficulty: Difficulty): Extract<Grade7MathUnit10Question, { itemType: T }> { return GRADE7_MATH_UNIT10_GENERATORS[itemType](difficulty) as Extract<Grade7MathUnit10Question, { itemType: T }> }
