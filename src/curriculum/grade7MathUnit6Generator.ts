import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Source coverage: Grade 7 Mathematics Unit 6 (days 91-108), 7.G.1-2. */
export const GRADE7_MATH_UNIT6_ITEM_TYPES = ['scale-factor', 'scale-drawing', 'actual-drawing-dimensions', 'reproduce-at-new-scale', 'construct-triangle', 'unique-triangle-conditions'] as const
export type Grade7MathUnit6ItemType = typeof GRADE7_MATH_UNIT6_ITEM_TYPES[number]
type Params = { drawing: number; actual: number; scale: number; newScale: number; drawingScale?: number; a?: number; b?: number; c?: number; measure?: 'length' | 'area' }
type Q<T extends Grade7MathUnit6ItemType> = CurriculumQuestion<T, Params>
export type Grade7MathUnit6Question = { [T in Grade7MathUnit6ItemType]: Q<T> }[Grade7MathUnit6ItemType]
type Def = { standard: '7.G.1' | '7.G.2'; lessonFocus: string; workedExample: CurriculumWorkedExample }
const example = (prompt: string, answer: string, steps: readonly string[]): CurriculumWorkedExample => ({ prompt, answer, steps })
/**
 * One authored worked example per item type. Each prompt is a concrete instance of
 * that item type's own generated shape and each answer is the answer to that
 * prompt, because this prose is the only teaching a student receives after a wrong
 * answer: an explanation of a different question teaches nothing.
 */
export const GRADE7_MATH_UNIT6_ITEM_DEFINITIONS = {
  'scale-factor': { standard: '7.G.1', lessonFocus: 'scale factors', workedExample: example('A 4 cm drawing represents 20 cm. What is the scale factor from drawing to actual?', '5', [
    'A scale factor is the number you multiply a drawing length by to get the matching real length, so it compares two lengths measured in the same unit.',
    'Both lengths here are already in centimetres, so divide the actual length by the drawing length: 20 ÷ 4 = 5.',
    'The scale factor is 5, meaning every 1 cm on the drawing stands for 5 cm in real life. Check it by scaling up: 4 × 5 = 20 cm.',
  ]) },
  'scale-drawing': { standard: '7.G.1', lessonFocus: 'scale drawings', workedExample: example('A map scale is 2 cm : 5 m. What actual distance does 8 cm represent?', '20 m', [
    'The scale 2 cm : 5 m says that every 2 cm on the map stands for 5 m on the ground, so first work out how many of those 2 cm blocks the 8 cm holds.',
    'Divide to count the blocks: 8 ÷ 2 = 4 blocks.',
    'Each block stands for 5 m, so multiply: 4 × 5 = 20, giving 20 m. The centimetres and the metres never mix; each stays on its own side of the ratio.',
  ]) },
  'actual-drawing-dimensions': { standard: '7.G.1', lessonFocus: 'actual and drawing dimensions', workedExample: example('A 24 m path is drawn at 1 cm : 4 m. What is its drawing length?', '6 cm', [
    'This question runs the scale backwards: the real length is known and the drawing length is missing, so divide instead of multiply.',
    'The scale 1 cm : 4 m means each single centimetre covers 4 m, so ask how many 4 m pieces fit inside 24 m: 24 ÷ 4 = 6.',
    'Six pieces need 6 cm of paper, so the drawing length is 6 cm. Check by scaling back up: 6 × 4 = 24 m.',
  ]) },
  'reproduce-at-new-scale': { standard: '7.G.1', lessonFocus: 'reproducing a drawing at a new scale', workedExample: example('A 6 cm segment is reproduced using a scale factor of 3. What is its new length?', '18 cm', [
    'Reproducing a drawing at a scale factor of 3 stretches every length by the same multiplier, so no length is left unchanged.',
    'Multiply the original length by the scale factor: 6 × 3 = 18, so the new length is 18 cm.',
    'Lengths scale by the factor itself, but areas scale by the factor squared, because both the width and the height stretch. Had this been an area of 6 cm², the new area would be 6 × 9 = 54 cm², not 18.',
  ]) },
  'construct-triangle': { standard: '7.G.2', lessonFocus: 'constructing triangles', workedExample: example('Can segments of lengths 4, 6, and 9 form a triangle?', 'yes', [
    'Three segments close into a triangle only when the two shorter ones together can reach across the longest one. That is the triangle inequality.',
    'The longest segment is 9, and the other two add to 4 + 6 = 10.',
    '10 is greater than 9, so the short sides have length to spare and can meet above the long one: the answer is yes. Had the longest been 10, the two shorter sides would add to exactly 10 and lie flat along it, forming a straight line rather than a triangle.',
  ]) },
  'unique-triangle-conditions': { standard: '7.G.2', lessonFocus: 'conditions for unique triangles', workedExample: example('Which condition determines a unique triangle: SSS, AAA, SSA, or one side length?', 'SSS', [
    'A condition determines a unique triangle when every triangle built from that information comes out the same size and shape, so no second, different triangle can satisfy it.',
    'SSS gives all three side lengths, and three fixed sides can be assembled in only one way, so SSS determines a unique triangle.',
    'The others fail. AAA fixes only the angles: a 3, 4, 5 triangle and a 6, 8, 10 triangle have the same three angles, because 3 × 2 = 6, 4 × 2 = 8 and 5 × 2 = 10 simply enlarge it, so AAA allows triangles of every size. SSA can fit two different triangles to the same measurements, and one side length alone fixes almost nothing.',
  ]) },
} as const satisfies Record<Grade7MathUnit6ItemType, Def>
const q = (itemType: Grade7MathUnit6ItemType, difficulty: Difficulty, prompt: string, answer: string, parameters: Params, distractors: string[]) => makeCurriculumQuestion({ itemType, difficulty, prompt, correctAnswer: answer, distractors, distractorMode: 'distinct', parameters, ...GRADE7_MATH_UNIT6_ITEM_DEFINITIONS[itemType] })
const facts = (difficulty: Difficulty) => { const scale = ri(2, difficulty + 5); const drawing = ri(2, difficulty * 4 + 6); return { drawing, actual: drawing * scale, scale, newScale: ri(2, difficulty + 4) } }
export function generateScaleFactorQuestion(difficulty: Difficulty) { const p = facts(difficulty); return q('scale-factor', difficulty, `A ${p.drawing} cm drawing represents ${p.actual} cm. What is the scale factor from drawing to actual?`, String(p.scale), p, [String(p.scale - 1), String(p.scale + 1), String(p.scale + 2), String(p.scale + 3)]) }
export function generateScaleDrawingQuestion(difficulty: Difficulty) { const p = facts(difficulty); const drawingScale = ri(1, 3); const scale = ri(2, difficulty + 6); const units = ri(2, difficulty * 4 + 6) * drawingScale; const actual = units / drawingScale * scale; return q('scale-drawing', difficulty, `A map scale is ${drawingScale} cm : ${scale} m. What actual distance does ${units} cm represent?`, `${actual} m`, { ...p, drawing: units, actual, scale, drawingScale }, [`${actual + 1} m`, `${actual + 2} m`, `${actual + 3} m`, `${actual + 4} m`]) }
export function generateActualDrawingDimensionsQuestion(difficulty: Difficulty) { const p = facts(difficulty); return q('actual-drawing-dimensions', difficulty, `A ${p.actual} m path is drawn at 1 cm : ${p.scale} m. What is its drawing length?`, `${p.drawing} cm`, p, [`${p.drawing + 1} cm`, `${p.drawing + 2} cm`, `${p.drawing + 3} cm`, `${p.drawing + 4} cm`]) }
export function generateReproduceAtNewScaleQuestion(difficulty: Difficulty) { const p = facts(difficulty); const measure = difficulty === 3 ? pick(['length', 'area'] as const) : 'length'; if (measure === 'area') { const answer = p.drawing * p.newScale * p.newScale; return q('reproduce-at-new-scale', difficulty, `A drawing has area ${p.drawing} cm² and is reproduced using a scale factor of ${p.newScale}. What is its new area?`, `${answer} cm²`, { ...p, measure }, [`${answer + 1} cm²`, `${answer + 2} cm²`, `${answer + 3} cm²`, `${answer + 4} cm²`]) } const answer = p.drawing * p.newScale; return q('reproduce-at-new-scale', difficulty, `A ${p.drawing} cm segment is reproduced using a scale factor of ${p.newScale}. What is its new length?`, `${answer} cm`, { ...p, measure }, [`${answer + 1} cm`, `${answer + 2} cm`, `${answer + 3} cm`, `${answer + 4} cm`]) }
export function generateConstructTriangleQuestion(difficulty: Difficulty) { const p = facts(difficulty); const a = ri(2, 7), b = ri(3, 9), c = pick([a + b - 1, a + b] as const); const answer = c < a + b ? 'yes' : 'no'; return q('construct-triangle', difficulty, `Can segments of lengths ${a}, ${b}, and ${c} form a triangle?`, answer, { ...p, a, b, c }, [answer === 'yes' ? 'no' : 'yes', 'only if all sides are equal', 'only if one angle is right', 'not enough information']) }
export function generateUniqueTriangleConditionsQuestion(difficulty: Difficulty) { const p = facts(difficulty); const sufficient = pick(['SSS', 'SAS', 'ASA'] as const); const insufficient = pick(['SSA', 'AAA'] as const); const otherInsufficient = insufficient === 'SSA' ? 'AAA' : 'SSA'; const askSufficient = pick([true, false] as const); const answer = askSufficient ? sufficient : insufficient; return q('unique-triangle-conditions', difficulty, askSufficient ? `Which condition determines a unique triangle: ${sufficient}, ${insufficient}, ${otherInsufficient}, or one side length?` : `Which condition does not determine a unique triangle: ${insufficient}, SSS, SAS, or ASA?`, answer, p, askSufficient ? [insufficient, otherInsufficient, 'one side length', 'a perimeter only'] : ['SSS', 'SAS', 'ASA', 'three side lengths']) }
export const GRADE7_MATH_UNIT6_GENERATORS = { 'scale-factor': generateScaleFactorQuestion, 'scale-drawing': generateScaleDrawingQuestion, 'actual-drawing-dimensions': generateActualDrawingDimensionsQuestion, 'reproduce-at-new-scale': generateReproduceAtNewScaleQuestion, 'construct-triangle': generateConstructTriangleQuestion, 'unique-triangle-conditions': generateUniqueTriangleConditionsQuestion } satisfies Record<Grade7MathUnit6ItemType, CurriculumGenerator<Grade7MathUnit6Question>>
export function generateGrade7MathUnit6Question<T extends Grade7MathUnit6ItemType>(itemType: T, difficulty: Difficulty): Extract<Grade7MathUnit6Question, { itemType: T }> { return GRADE7_MATH_UNIT6_GENERATORS[itemType](difficulty) as Extract<Grade7MathUnit6Question, { itemType: T }> }
