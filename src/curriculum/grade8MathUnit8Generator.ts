import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Coverage contract: Grade 8 Mathematics Unit 8 (days 127-144), 8.G.6-8. */
export const GRADE8_MATH_UNIT8_ITEM_TYPES = ['identify-hypotenuse', 'find-hypotenuse', 'find-leg', 'verify-pythagorean-theorem', 'converse-classification', 'distance-on-coordinate-plane', 'right-triangle-from-coordinates', 'rectangle-diagonal', 'ladder-context', 'pythagorean-error-analysis', 'compare-right-triangle-distances', 'explain-pythagorean-theorem'] as const
export type Grade8MathUnit8ItemType = typeof GRADE8_MATH_UNIT8_ITEM_TYPES[number]
type Params = { a: number; b: number; c: number; x?: number; y?: number; operation?: string }
type Q<T extends Grade8MathUnit8ItemType> = CurriculumQuestion<T, Params>
export type Grade8MathUnit8Question = { [T in Grade8MathUnit8ItemType]: Q<T> }[Grade8MathUnit8ItemType]
type Def = { standard: '8.G.6' | '8.G.7' | '8.G.8'; lessonFocus: string; workedExample: CurriculumWorkedExample }
const example = (prompt: string, answer: string): CurriculumWorkedExample => ({ prompt, answer, steps: ['Identify the legs and the hypotenuse, the side opposite the right angle.', 'Use a² + b² = c² and take a square root only after finding c².'] })
export const GRADE8_MATH_UNIT8_ITEM_DEFINITIONS = {
  'identify-hypotenuse': { standard: '8.G.6', lessonFocus: 'parts of a right triangle', workedExample: example('In a right triangle, which side is the hypotenuse?', 'the side opposite the right angle') },
  'find-hypotenuse': { standard: '8.G.6', lessonFocus: 'Pythagorean theorem', workedExample: example('A right triangle has legs 3 and 4. Find its hypotenuse.', '5') },
  'find-leg': { standard: '8.G.6', lessonFocus: 'Pythagorean theorem', workedExample: example('A right triangle has hypotenuse 13 and one leg 5. Find the other leg.', '12') },
  'verify-pythagorean-theorem': { standard: '8.G.6', lessonFocus: 'Pythagorean theorem', workedExample: example('Do side lengths 5, 12, 13 satisfy a² + b² = c²?', 'yes') },
  'converse-classification': { standard: '8.G.7', lessonFocus: 'converse of the Pythagorean theorem', workedExample: example('Classify side lengths 6, 8, 10.', 'right triangle') },
  'distance-on-coordinate-plane': { standard: '8.G.8', lessonFocus: 'distance on the coordinate plane', workedExample: example('Find the distance from (0, 0) to (3, 4).', '5') },
  'right-triangle-from-coordinates': { standard: '8.G.8', lessonFocus: 'coordinate geometry', workedExample: example('Are (0, 0), (3, 0), and (0, 4) vertices of a right triangle?', 'yes') },
  'rectangle-diagonal': { standard: '8.G.8', lessonFocus: 'rectangle diagonals', workedExample: example('A rectangle is 5 by 12. Find its diagonal.', '13') },
  'ladder-context': { standard: '8.G.8', lessonFocus: 'reasonableness and units', workedExample: example('A 10-ft ladder reaches 8 ft up a wall. How far is its base from the wall?', '6 ft') },
  'pythagorean-error-analysis': { standard: '8.G.6', lessonFocus: 'proof models', workedExample: example('A student says 3² + 4² = 7². Is this correct?', 'No; 3² + 4² = 25, so c = 5.') },
  'compare-right-triangle-distances': { standard: '8.G.8', lessonFocus: 'comparing distances', workedExample: example('Which is longer: a 3-by-4 diagonal or a 5-by-12 diagonal?', 'the 5-by-12 diagonal') },
  'explain-pythagorean-theorem': { standard: '8.G.6', lessonFocus: 'meaning of the theorem', workedExample: example('What does a² + b² = c² describe?', 'the side lengths of a right triangle') },
} as const satisfies Record<Grade8MathUnit8ItemType, Def>
const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 12, 15]] as const
const triple = (d: Difficulty) => triples[ri(0, Math.min(triples.length - 1, d + 1))]
const symbolicRoot = (radicand: number): string => {
  const root = Math.sqrt(radicand)
  return Number.isInteger(root) ? String(root) : `sqrt(${radicand})`
}
function nonSquareLegs(difficulty: Difficulty): readonly [number, number, number] {
  let a = ri(2, difficulty * 3 + 4)
  let b = ri(2, difficulty * 3 + 5)
  while (Number.isInteger(Math.sqrt(a * a + b * b))) { a = ri(2, difficulty * 3 + 4); b = ri(2, difficulty * 3 + 5) }
  return [a, b, a * a + b * b]
}
const distinct = (answer: string, values: string[]) => [...new Set(values)].filter((value) => value !== answer)
function question<T extends Grade8MathUnit8ItemType>(itemType: T, difficulty: Difficulty, prompt: string, correctAnswer: string, parameters: Params, distractors: string[]): Q<T> { return makeCurriculumQuestion({ itemType, difficulty, prompt, correctAnswer, distractors: distinct(correctAnswer, distractors), distractorMode: 'distinct', parameters, ...GRADE8_MATH_UNIT8_ITEM_DEFINITIONS[itemType] }) }
export function generateIdentifyHypotenuseQuestion(difficulty: Difficulty) { return question('identify-hypotenuse', difficulty, 'In a right triangle, which side is the hypotenuse?', 'the side opposite the right angle', { a: 0, b: 0, c: 0 }, ['either leg', 'the shortest side', 'the side next to the right angle']) }
export function generateFindHypotenuseQuestion(difficulty: Difficulty) { const [a, b, c] = nonSquareLegs(difficulty); return question('find-hypotenuse', difficulty, `A right triangle has legs ${a} and ${b}. What is its hypotenuse in simplest radical form?`, symbolicRoot(c), { a, b, c }, [String(a + b), `sqrt(${c + 1})`, String(c)]) }
export function generateFindLegQuestion(difficulty: Difficulty) { const [a, b] = triple(difficulty); const cSquared = a * a + b * b; return question('find-leg', difficulty, `A right triangle has hypotenuse sqrt(${cSquared}) and one leg ${a}. What is the other leg?`, String(b), { a, b, c: cSquared }, [String(cSquared - a * a), `sqrt(${cSquared - a * a})`, String(a + b)]) }
export function generateVerifyPythagoreanTheoremQuestion(difficulty: Difficulty) { const [a, b, c] = triple(difficulty); const valid = pick([true, false] as const); const shown = valid ? c : c + 1; const answer = valid ? 'yes' : 'no'; return question('verify-pythagorean-theorem', difficulty, `Do side lengths ${a}, ${b}, and ${shown} satisfy the Pythagorean theorem?`, answer, { a, b, c: shown }, distinct(answer, ['yes', 'no', 'only if the triangle is acute', 'only if both legs are equal'])) }
export function generateConverseClassificationQuestion(difficulty: Difficulty) { const [a, b, c] = triple(difficulty); const right = pick([true, false] as const); const shown = right ? c : c + 1; const answer = right ? 'right triangle' : 'not a right triangle'; return question('converse-classification', difficulty, `Classify a triangle with side lengths ${a}, ${b}, and ${shown} using the converse of the Pythagorean theorem.`, answer, { a, b, c: shown }, distinct(answer, ['right triangle', 'not a right triangle', 'equilateral triangle', 'isosceles triangle'])) }
export function generateDistanceOnCoordinatePlaneQuestion(difficulty: Difficulty) { const [a, b, c] = nonSquareLegs(difficulty); return question('distance-on-coordinate-plane', difficulty, `What is the distance between (0, 0) and (${a}, ${b}) in simplest radical form?`, symbolicRoot(c), { a, b, c, x: a, y: b }, [String(a + b), `sqrt(${c + 1})`, String(c)]) }
export function generateRightTriangleFromCoordinatesQuestion(difficulty: Difficulty) { const [a, b, c] = triple(difficulty); return question('right-triangle-from-coordinates', difficulty, `Do the points (0, 0), (${a}, 0), and (0, ${b}) form a right triangle?`, 'yes', { a, b, c }, ['no', 'only when a = b', 'cannot be determined']) }
export function generateRectangleDiagonalQuestion(difficulty: Difficulty) { const [a, b, c] = nonSquareLegs(difficulty); return question('rectangle-diagonal', difficulty, `A rectangle is ${a} units by ${b} units. What is the length of its diagonal in simplest radical form?`, symbolicRoot(c), { a, b, c }, [String(a + b), `sqrt(${c + 1})`, String(c)]) }
export function generateLadderContextQuestion(difficulty: Difficulty) { const [a, b, c] = triple(difficulty); return question('ladder-context', difficulty, `A ${c}-ft ladder reaches ${b} ft up a vertical wall. How far is its base from the wall?`, `${a} ft`, { a, b, c }, [`${b} ft`, `${c - b} ft`, `${a + b} ft`]) }
export function generatePythagoreanErrorAnalysisQuestion(difficulty: Difficulty) { const [a, b, c] = triple(difficulty); const wrong = a + b; const answer = `No; ${a}² + ${b}² = ${c}², not ${wrong}².`; return question('pythagorean-error-analysis', difficulty, `A student claims ${a}² + ${b}² = ${wrong}² for a right triangle. Is the claim correct?`, answer, { a, b, c }, ['Yes; add the legs to find the hypotenuse.', `No; the hypotenuse is ${wrong}.`, 'No; square only one leg.']) }
export function generateCompareRightTriangleDistancesQuestion(difficulty: Difficulty) { const first = triples[0]; const second = triples[1]; const answer = `the ${second[0]}-by-${second[1]} diagonal`; return question('compare-right-triangle-distances', difficulty, `Which is longer: a ${first[0]}-by-${first[1]} rectangle diagonal or a ${second[0]}-by-${second[1]} rectangle diagonal?`, answer, { a: first[2], b: second[2], c: second[2] }, [`the ${first[0]}-by-${first[1]} diagonal`, 'they are equal', 'cannot be determined']) }
export function generateExplainPythagoreanTheoremQuestion(difficulty: Difficulty) { return question('explain-pythagorean-theorem', difficulty, 'What does a² + b² = c² describe?', 'the side lengths of a right triangle', { a: 0, b: 0, c: 0 }, ['the perimeter of every triangle', 'the area of every rectangle', 'the angle sum of a triangle']) }
export const GRADE8_MATH_UNIT8_GENERATORS: Record<Grade8MathUnit8ItemType, CurriculumGenerator<Grade8MathUnit8Question>> = { 'identify-hypotenuse': generateIdentifyHypotenuseQuestion, 'find-hypotenuse': generateFindHypotenuseQuestion, 'find-leg': generateFindLegQuestion, 'verify-pythagorean-theorem': generateVerifyPythagoreanTheoremQuestion, 'converse-classification': generateConverseClassificationQuestion, 'distance-on-coordinate-plane': generateDistanceOnCoordinatePlaneQuestion, 'right-triangle-from-coordinates': generateRightTriangleFromCoordinatesQuestion, 'rectangle-diagonal': generateRectangleDiagonalQuestion, 'ladder-context': generateLadderContextQuestion, 'pythagorean-error-analysis': generatePythagoreanErrorAnalysisQuestion, 'compare-right-triangle-distances': generateCompareRightTriangleDistancesQuestion, 'explain-pythagorean-theorem': generateExplainPythagoreanTheoremQuestion }
export const generateGrade8MathUnit8Question = (itemType: Grade8MathUnit8ItemType, difficulty: Difficulty) => GRADE8_MATH_UNIT8_GENERATORS[itemType](difficulty)
