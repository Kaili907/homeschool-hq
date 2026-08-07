import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import {
  makeCurriculumQuestion,
  type CurriculumGenerator,
  type CurriculumQuestion,
  type CurriculumWorkedExample,
} from './generatorCore'

/**
 * Coverage contract derived from Grade 7 Mathematics Unit 7, course days
 * 109-126, its 18 lesson records, and standards 7.G.4-7.G.6.
 */
export const GRADE7_MATH_UNIT7_ITEM_TYPES = [
  'circumference-from-radius-or-diameter',
  'find-radius-or-diameter-from-circumference',
  'area-of-circle-from-radius-or-diameter',
  'circumference-area-relationship',
  'complementary-supplementary-angle',
  'vertical-angles-with-expressions',
  'angle-equation-multistep',
  'angles-on-a-line-or-around-a-point',
  'area-of-composite-figure',
  'missing-dimension-from-area',
  'surface-area-of-rectangular-prism',
  'volume-of-rectangular-prism',
] as const

export type Grade7MathUnit7ItemType = (typeof GRADE7_MATH_UNIT7_ITEM_TYPES)[number]

/**
 * Every rational in this unit (pi coefficients, fractional side lengths, areas,
 * volumes) is carried as an exact integer numerator/denominator pair. Division
 * is only performed after reducing by the gcd, so no binary floating point is
 * ever used to derive an answer. Pi itself is never approximated: circle
 * answers are always expressed as an exact rational multiple of the symbol "π".
 */
export interface Fraction {
  num: number
  den: number
}

interface CircleMeasureParameters {
  given: 'radius' | 'diameter'
  value: Fraction
  unit: string
}

interface CircumferenceGivenParameters {
  coeff: Fraction
  unit: string
  askFor: 'radius' | 'diameter'
}

interface CircumferenceAreaRelationshipParameters {
  coeff: Fraction
  unit: string
}

interface ComplementarySupplementaryParameters {
  relation: 'complementary' | 'supplementary'
  angle: number
}

interface VerticalAnglesParameters {
  a: number
  b: number
  c: number
  d: number
}

interface SupplementaryAlgebraParameters {
  a: number
  b: number
  c: number
  d: number
}

interface AnglesSumParameters {
  mode: 'line' | 'point'
  knowns: number[]
  x: number
}

interface CompositeFigureParameters {
  mode: 'lshape' | 'house'
  rectW: number
  rectH: number
  notchW?: number
  notchH?: number
  triHeight?: number
}

interface MissingDimensionParameters {
  width: number
  area: number
}

interface PrismParameters {
  l: number
  w: number
  h: Fraction
}

type Unit7Question<TItemType extends Grade7MathUnit7ItemType, TParameters> =
  CurriculumQuestion<TItemType, TParameters>

export type Grade7MathUnit7Question =
  | Unit7Question<'circumference-from-radius-or-diameter', CircleMeasureParameters>
  | Unit7Question<'find-radius-or-diameter-from-circumference', CircumferenceGivenParameters>
  | Unit7Question<'area-of-circle-from-radius-or-diameter', CircleMeasureParameters>
  | Unit7Question<'circumference-area-relationship', CircumferenceAreaRelationshipParameters>
  | Unit7Question<'complementary-supplementary-angle', ComplementarySupplementaryParameters>
  | Unit7Question<'vertical-angles-with-expressions', VerticalAnglesParameters>
  | Unit7Question<'angle-equation-multistep', SupplementaryAlgebraParameters>
  | Unit7Question<'angles-on-a-line-or-around-a-point', AnglesSumParameters>
  | Unit7Question<'area-of-composite-figure', CompositeFigureParameters>
  | Unit7Question<'missing-dimension-from-area', MissingDimensionParameters>
  | Unit7Question<'surface-area-of-rectangular-prism', PrismParameters>
  | Unit7Question<'volume-of-rectangular-prism', PrismParameters>

type Unit7Standard = '7.G.4' | '7.G.5' | '7.G.6'

interface ItemDefinition {
  standard: Unit7Standard
  lessonFocus:
    | 'pi and circumference'
    | 'area of circles'
    | 'angle relationships'
    | 'unknown angles'
    | 'area of composite figures'
    | 'surface area and volume'
  workedExample: CurriculumWorkedExample
}

export const GRADE7_MATH_UNIT7_ITEM_DEFINITIONS = {
  'circumference-from-radius-or-diameter': {
    standard: '7.G.4',
    lessonFocus: 'pi and circumference',
    workedExample: {
      prompt: 'A circle has a radius of 5 cm. What is its exact circumference?',
      answer: '10π cm',
      steps: [
        'The diameter is twice the radius: 2 × 5 = 10 cm.',
        'Circumference is π times the diameter: C = πd = 10π cm.',
      ],
    },
  },
  'find-radius-or-diameter-from-circumference': {
    standard: '7.G.4',
    lessonFocus: 'pi and circumference',
    workedExample: {
      prompt: 'A circle has a circumference of 18π in. What is its exact radius?',
      answer: '9 in',
      steps: [
        'Circumference equals π times the diameter, so the diameter is 18 in.',
        'The radius is half the diameter: 18 ÷ 2 = 9 in.',
      ],
    },
  },
  'area-of-circle-from-radius-or-diameter': {
    standard: '7.G.4',
    lessonFocus: 'area of circles',
    workedExample: {
      prompt: 'A circle has a radius of 6 ft. What is its exact area?',
      answer: '36π ft²',
      steps: [
        'Area is π times the radius squared: A = πr².',
        'Square the radius: 6² = 36, so A = 36π ft².',
      ],
    },
  },
  'circumference-area-relationship': {
    standard: '7.G.4',
    lessonFocus: 'area of circles',
    workedExample: {
      prompt:
        'A circle has a circumference of 8π m. A circle’s radius equals its circumference divided by 2π. Use this relationship to find the circle’s exact area.',
      answer: '16π m²',
      steps: [
        'Divide the circumference coefficient by 2 to get the radius: 8 ÷ 2 = 4 m.',
        'Square the radius and multiply by π: A = π(4)² = 16π m².',
      ],
    },
  },
  'complementary-supplementary-angle': {
    standard: '7.G.5',
    lessonFocus: 'angle relationships',
    workedExample: {
      prompt: 'Two angles are supplementary. One measures 125°. What is the measure of the other angle?',
      answer: '55°',
      steps: [
        'Supplementary angles sum to 180°.',
        'Subtract the known angle: 180 − 125 = 55°.',
      ],
    },
  },
  'vertical-angles-with-expressions': {
    standard: '7.G.5',
    lessonFocus: 'angle relationships',
    workedExample: {
      prompt:
        'Two lines intersect, forming vertical angles that measure (3x + 8)° and (5x - 12)°. Vertical angles are congruent. Find the value of x and the measure of the angles.',
      answer: 'x = 10, each angle measures 38°',
      steps: [
        'Vertical angles are congruent, so set the expressions equal: 3x + 8 = 5x − 12.',
        'Solve for x: 20 = 2x, so x = 10.',
        'Substitute back: 3(10) + 8 = 38°.',
      ],
    },
  },
  'angle-equation-multistep': {
    standard: '7.G.5',
    lessonFocus: 'unknown angles',
    workedExample: {
      prompt:
        'Two angles are supplementary. Their measures are (4x + 6)° and (2x + 24)°. Find the value of x and the measure of each angle.',
      answer: 'x = 25, angles measure 106° and 74°',
      steps: [
        'Supplementary angles sum to 180°: (4x + 6) + (2x + 24) = 180.',
        'Combine like terms: 6x + 30 = 180, so 6x = 150 and x = 25.',
        'Substitute back: 4(25) + 6 = 106°, and 180 − 106 = 74°.',
      ],
    },
  },
  'angles-on-a-line-or-around-a-point': {
    standard: '7.G.5',
    lessonFocus: 'unknown angles',
    workedExample: {
      prompt: 'Three angles lie along a straight line and measure 65°, 40°, and x°. What is the value of x?',
      answer: '75°',
      steps: [
        'Angles along a straight line sum to 180°.',
        'Add the known angles: 65 + 40 = 105.',
        'Subtract from 180: 180 − 105 = 75°.',
      ],
    },
  },
  'area-of-composite-figure': {
    standard: '7.G.6',
    lessonFocus: 'area of composite figures',
    workedExample: {
      prompt:
        'A room shaped like an L is made from a 10-by-8 rectangle with a 3-by-2 rectangular corner cut out. What is the area of the room, in square units?',
      answer: '74',
      steps: [
        'Find the area of the full rectangle: 10 × 8 = 80.',
        'Find the area of the removed corner: 3 × 2 = 6.',
        'Subtract the corner from the rectangle: 80 − 6 = 74 square units.',
      ],
    },
  },
  'missing-dimension-from-area': {
    standard: '7.G.6',
    lessonFocus: 'area of composite figures',
    workedExample: {
      prompt: 'A rectangle has an area of 51 square units and a width of 6 units. What is its exact length?',
      answer: '8 1/2',
      steps: [
        'Length equals area divided by width: 51 ÷ 6.',
        'Write the exact quotient as a fraction: 51/6 = 17/2.',
        'Rewrite as a mixed number: 17/2 = 8 1/2.',
      ],
    },
  },
  'surface-area-of-rectangular-prism': {
    standard: '7.G.6',
    lessonFocus: 'surface area and volume',
    workedExample: {
      prompt: 'A rectangular prism has length 5, width 4, and height 3 (all in units). What is its exact surface area?',
      answer: '94',
      steps: [
        'Surface area is twice the sum of the three face areas: SA = 2(lw + lh + wh).',
        'Find each face area: lw = 20, lh = 15, wh = 12.',
        'Add and double: 2(20 + 15 + 12) = 2(47) = 94 square units.',
      ],
    },
  },
  'volume-of-rectangular-prism': {
    standard: '7.G.6',
    lessonFocus: 'surface area and volume',
    workedExample: {
      prompt: 'What is the exact volume of a rectangular prism with length 5, width 3, and height 5/2 (units)?',
      answer: '37 1/2',
      steps: [
        'Volume is length times width times height: V = l × w × h.',
        'Multiply the whole-number dimensions first: 5 × 3 = 15.',
        'Multiply by the fractional height: 15 × 5/2 = 75/2 = 37 1/2 cubic units.',
      ],
    },
  },
} as const satisfies Record<Grade7MathUnit7ItemType, ItemDefinition>

// ---------- exact-rational helpers ----------

function intF(n: number): Fraction {
  return { num: n, den: 1 }
}

function gcdExact(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    ;[x, y] = [y, x % y]
  }
  return x || 1
}

function reduceFraction(f: Fraction): Fraction {
  const sign = f.den < 0 ? -1 : 1
  const num = f.num * sign
  const den = Math.abs(f.den)
  if (num === 0) return { num: 0, den: 1 }
  const divisor = gcdExact(num, den)
  return { num: num / divisor, den: den / divisor }
}

function mulFraction(a: Fraction, b: Fraction): Fraction {
  return reduceFraction({ num: a.num * b.num, den: a.den * b.den })
}

function addFraction(a: Fraction, b: Fraction): Fraction {
  return reduceFraction({ num: a.num * b.den + b.num * a.den, den: a.den * b.den })
}

/** Plain (improper) fraction text: 17/2 -> "17/2", 8 -> "8". Used for pi coefficients. */
function fractionText(f: Fraction): string {
  const r = reduceFraction(f)
  return r.den === 1 ? String(r.num) : `${r.num}/${r.den}`
}

/** Mixed-number text for measurements: 17/2 -> "8 1/2", 8 -> "8". Assumes non-negative input. */
function mixedText(f: Fraction): string {
  const r = reduceFraction(f)
  if (r.den === 1) return String(r.num)
  const whole = Math.floor(r.num / r.den)
  const remainder = r.num - whole * r.den
  if (whole === 0) return `${remainder}/${r.den}`
  return remainder === 0 ? String(whole) : `${whole} ${remainder}/${r.den}`
}

function piCoeffText(f: Fraction): string {
  return `${fractionText(f)}π`
}

function withFallback(correct: Fraction, candidates: Fraction[]): Fraction[] {
  const d = correct.den
  return [
    ...candidates,
    { num: correct.num + d, den: d },
    { num: correct.num + 2 * d, den: d },
    { num: correct.num + 3 * d, den: d },
    { num: Math.max(0, correct.num - d), den: d },
  ]
}

function fractionChoiceTexts(
  correct: Fraction,
  candidates: Fraction[],
  textFn: (f: Fraction) => string,
): string[] {
  const correctText = textFn(correct)
  const seen = new Set<string>([correctText])
  const result: string[] = []
  for (const candidate of candidates) {
    if (candidate.num < 0) continue
    const text = textFn(reduceFraction(candidate))
    if (!seen.has(text)) {
      seen.add(text)
      result.push(text)
    }
  }
  return result
}

function withIntFallback(correct: number, candidates: number[]): number[] {
  return [...candidates, correct + 1, correct + 2, correct + 3, Math.max(1, correct - 1)]
}

function integerChoiceTexts(correct: number, candidates: number[], suffix = '°'): string[] {
  const correctText = `${correct}${suffix}`
  const seen = new Set<string>([correctText])
  const result: string[] = []
  for (const candidate of candidates) {
    if (candidate <= 0) continue
    const text = `${candidate}${suffix}`
    if (!seen.has(text)) {
      seen.add(text)
      result.push(text)
    }
  }
  return result
}

/**
 * Canonical text for a linear expression: "3x + 5", "3x - 5", "3x", "x + 5",
 * "-x", "5". The second expression in both algebra items carries a derived
 * constant, so a zero constant is reachable and must not render as "3x + 0".
 * The unit and zero coefficient branches keep the helper canonical if the
 * coefficient ranges ever widen past the current 2-6.
 */
function linearExprText(coeff: number, constant: number): string {
  const term = coeff === 0 ? '' : coeff === 1 ? 'x' : coeff === -1 ? '-x' : `${coeff}x`
  if (term === '') return String(constant)
  if (constant === 0) return term
  return `${term} ${constant < 0 ? '-' : '+'} ${Math.abs(constant)}`
}

/** `parts` positive integers summing to `total` (requires total >= parts). */
function splitPositive(total: number, parts: number): number[] {
  if (parts === 1) return [total]
  const cuts = new Set<number>()
  while (cuts.size < parts - 1) cuts.add(ri(1, total - 1))
  const sorted = [...cuts].sort((left, right) => left - right)
  const result: number[] = []
  let prev = 0
  for (const cut of sorted) {
    result.push(cut - prev)
    prev = cut
  }
  result.push(total - prev)
  return result
}

const CIRCLE_UNITS = ['cm', 'in', 'ft', 'm'] as const

function radiusOf(given: 'radius' | 'diameter', value: Fraction): Fraction {
  return given === 'radius' ? value : mulFraction(value, { num: 1, den: 2 })
}

function diameterOf(given: 'radius' | 'diameter', value: Fraction): Fraction {
  return given === 'diameter' ? value : mulFraction(value, { num: 2, den: 1 })
}

function randomCircleMeasure(difficulty: Difficulty): CircleMeasureParameters {
  const unit = pick(CIRCLE_UNITS)
  const given = pick(['radius', 'diameter'] as const)
  if (difficulty === 3) {
    const halves = ri(5, 25)
    return { given, value: reduceFraction({ num: halves, den: 2 }), unit }
  }
  const max = difficulty === 1 ? 12 : 20
  return { given, value: intF(ri(2, max)), unit }
}

function randomCircumferenceGiven(difficulty: Difficulty): CircumferenceGivenParameters {
  const unit = pick(CIRCLE_UNITS)
  const askFor = pick(['radius', 'diameter'] as const)
  if (difficulty === 3) {
    const halves = ri(9, 39)
    return { coeff: reduceFraction({ num: halves, den: 2 }), unit, askFor }
  }
  const max = difficulty === 1 ? 24 : 40
  return { coeff: intF(ri(4, max)), unit, askFor }
}

function randomComplementarySupplementary(difficulty: Difficulty): ComplementarySupplementaryParameters {
  const relation = difficulty === 1 ? 'complementary' : pick(['complementary', 'supplementary'] as const)
  const total = relation === 'complementary' ? 90 : 180
  const angle = difficulty === 1 ? ri(1, 8) * 10 : ri(1, total - 1)
  return { relation, angle }
}

function randomVerticalAngles(difficulty: Difficulty): VerticalAnglesParameters {
  const [aRange, xRange, bMax]: [[number, number], [number, number], number] =
    difficulty === 1 ? [[2, 4], [2, 9], 10] : difficulty === 2 ? [[2, 6], [3, 15], 15] : [[2, 6], [4, 20], 20]
  const a = ri(...aRange)
  let c = ri(...aRange)
  while (c === a) c = ri(...aRange)
  const x = ri(...xRange)
  const b = ri(1, bMax)
  const angle = a * x + b
  const d = angle - c * x
  return { a, b, c, d }
}

function randomSupplementaryAlgebra(difficulty: Difficulty): SupplementaryAlgebraParameters {
  const [aRange, xRange, bMax]: [[number, number], [number, number], number] =
    difficulty === 1 ? [[2, 4], [2, 9], 10] : difficulty === 2 ? [[2, 6], [3, 15], 15] : [[2, 6], [4, 20], 20]
  const a = ri(...aRange)
  const c = ri(...aRange)
  const x = ri(...xRange)
  const b = ri(1, bMax)
  const angle1 = a * x + b
  const angle2 = 180 - angle1
  const d = angle2 - c * x
  return { a, b, c, d }
}

function randomAnglesSum(difficulty: Difficulty): AnglesSumParameters {
  const mode = pick(['line', 'point'] as const)
  const total = mode === 'line' ? 180 : 360
  const count = mode === 'line' ? (difficulty === 1 ? 2 : 3) : difficulty === 1 ? 3 : 4
  const x =
    difficulty === 1
      ? ri(10, 60)
      : difficulty === 2
        ? ri(10, 100)
        : ri(5, 150)
  const knowns = splitPositive(total - x, count)
  return { mode, knowns, x }
}

function randomComposite(difficulty: Difficulty): CompositeFigureParameters {
  if (difficulty === 3 && ri(0, 1) === 0) {
    const rectW = ri(8, 16)
    const rectH = ri(6, 14)
    const triHeight = ri(2, 10)
    return { mode: 'house', rectW, rectH, triHeight }
  }
  const rectW = difficulty === 1 ? ri(6, 12) : difficulty === 2 ? ri(8, 18) : ri(10, 24)
  const rectH = difficulty === 1 ? ri(6, 12) : difficulty === 2 ? ri(8, 18) : ri(10, 24)
  const notchW = ri(1, Math.max(1, Math.floor(rectW / 2)))
  const notchH = ri(1, Math.max(1, Math.floor(rectH / 2)))
  return { mode: 'lshape', rectW, rectH, notchW, notchH }
}

function randomMissingDimension(difficulty: Difficulty): MissingDimensionParameters {
  const width = difficulty === 1 ? ri(2, 9) : difficulty === 2 ? ri(3, 14) : ri(3, 16)
  if (difficulty < 3) {
    const length = difficulty === 1 ? ri(2, 9) : ri(3, 16)
    return { width, area: width * length }
  }
  const wholeLength = ri(3, 16)
  const remainder = ri(1, width - 1)
  return { width, area: width * wholeLength + remainder }
}

function randomPrism(difficulty: Difficulty): PrismParameters {
  const range: [number, number] = difficulty === 1 ? [2, 9] : difficulty === 2 ? [3, 14] : [3, 16]
  const l = ri(...range)
  const w = ri(...range)
  if (difficulty === 3 && ri(0, 1) === 0) {
    const halves = ri(3, 19)
    return { l, w, h: reduceFraction({ num: halves, den: 2 }) }
  }
  return { l, w, h: intF(ri(...range)) }
}

// ---------- generators ----------

export function generateCircumferenceFromRadiusOrDiameterQuestion(
  difficulty: Difficulty,
): Unit7Question<'circumference-from-radius-or-diameter', CircleMeasureParameters> {
  const { given, value, unit } = randomCircleMeasure(difficulty)
  const diameter = diameterOf(given, value)
  const radius = radiusOf(given, value)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['circumference-from-radius-or-diameter']
  return makeCurriculumQuestion({
    itemType: 'circumference-from-radius-or-diameter',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A circle has a ${given} of ${mixedText(value)} ${unit}. What is its exact circumference? Express your answer as a multiple of π.`,
    correctAnswer: `${piCoeffText(diameter)} ${unit}`,
    distractors: fractionChoiceTexts(
      diameter,
      withFallback(diameter, [radius, mulFraction(diameter, intF(2)), mulFraction(radius, intF(4))]),
      (f) => `${piCoeffText(f)} ${unit}`,
    ),
    parameters: { given, value, unit },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateFindRadiusOrDiameterFromCircumferenceQuestion(
  difficulty: Difficulty,
): Unit7Question<'find-radius-or-diameter-from-circumference', CircumferenceGivenParameters> {
  const { coeff, unit, askFor } = randomCircumferenceGiven(difficulty)
  const answerValue = askFor === 'radius' ? mulFraction(coeff, { num: 1, den: 2 }) : coeff
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['find-radius-or-diameter-from-circumference']
  return makeCurriculumQuestion({
    itemType: 'find-radius-or-diameter-from-circumference',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A circle has a circumference of ${piCoeffText(coeff)} ${unit}. What is its exact ${askFor}?`,
    correctAnswer: `${mixedText(answerValue)} ${unit}`,
    distractors: fractionChoiceTexts(
      answerValue,
      withFallback(answerValue, [coeff, mulFraction(coeff, { num: 1, den: 4 }), mulFraction(coeff, intF(2))]),
      (f) => `${mixedText(f)} ${unit}`,
    ),
    parameters: { coeff, unit, askFor },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateAreaOfCircleFromRadiusOrDiameterQuestion(
  difficulty: Difficulty,
): Unit7Question<'area-of-circle-from-radius-or-diameter', CircleMeasureParameters> {
  const { given, value, unit } = randomCircleMeasure(difficulty)
  const radius = radiusOf(given, value)
  const diameter = diameterOf(given, value)
  const areaCoeff = mulFraction(radius, radius)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['area-of-circle-from-radius-or-diameter']
  return makeCurriculumQuestion({
    itemType: 'area-of-circle-from-radius-or-diameter',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A circle has a ${given} of ${mixedText(value)} ${unit}. What is its exact area? Express your answer as a multiple of π (use a fraction for the coefficient if it is not a whole number).`,
    correctAnswer: `${piCoeffText(areaCoeff)} ${unit}²`,
    distractors: fractionChoiceTexts(
      areaCoeff,
      withFallback(areaCoeff, [mulFraction(diameter, diameter), mulFraction(radius, intF(2)), mulFraction(areaCoeff, intF(4))]),
      (f) => `${piCoeffText(f)} ${unit}²`,
    ),
    parameters: { given, value, unit },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateCircumferenceAreaRelationshipQuestion(
  difficulty: Difficulty,
): Unit7Question<'circumference-area-relationship', CircumferenceAreaRelationshipParameters> {
  const { coeff: k, unit } = randomCircumferenceGiven(difficulty)
  const radius = mulFraction(k, { num: 1, den: 2 })
  const areaCoeff = mulFraction(radius, radius)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['circumference-area-relationship']
  return makeCurriculumQuestion({
    itemType: 'circumference-area-relationship',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A circle's radius equals its circumference divided by 2π. A circle has a circumference of ${piCoeffText(k)} ${unit}. Use this relationship to find the circle's exact area, as a multiple of π.`,
    correctAnswer: `${piCoeffText(areaCoeff)} ${unit}²`,
    distractors: fractionChoiceTexts(
      areaCoeff,
      withFallback(areaCoeff, [mulFraction(k, k), k, mulFraction(areaCoeff, intF(2))]),
      (f) => `${piCoeffText(f)} ${unit}²`,
    ),
    parameters: { coeff: k, unit },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateComplementarySupplementaryAngleQuestion(
  difficulty: Difficulty,
): Unit7Question<'complementary-supplementary-angle', ComplementarySupplementaryParameters> {
  const { relation, angle } = randomComplementarySupplementary(difficulty)
  const total = relation === 'complementary' ? 90 : 180
  const otherTotal = relation === 'complementary' ? 180 : 90
  const correct = total - angle
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['complementary-supplementary-angle']
  return makeCurriculumQuestion({
    itemType: 'complementary-supplementary-angle',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Two angles are ${relation}. One angle measures ${angle}°. What is the measure of the other angle?`,
    correctAnswer: `${correct}°`,
    distractors: integerChoiceTexts(correct, withIntFallback(correct, [angle, otherTotal - angle, correct + 10, Math.max(1, correct - 10)])),
    parameters: { relation, angle },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateVerticalAnglesWithExpressionsQuestion(
  difficulty: Difficulty,
): Unit7Question<'vertical-angles-with-expressions', VerticalAnglesParameters> {
  const { a, b, c, d } = randomVerticalAngles(difficulty)
  const x = (d - b) / (a - c)
  const angle = a * x + b
  const correctAnswer = `x = ${x}, each angle measures ${angle}°`
  const altUp = { x: x + 1, angle: a * (x + 1) + b }
  const altDown = { x: Math.max(1, x - 1), angle: a * Math.max(1, x - 1) + b }
  const distractors = [
    `x = ${altUp.x}, each angle measures ${altUp.angle}°`,
    `x = ${altDown.x}, each angle measures ${altDown.angle}°`,
    `x = ${x}, each angle measures ${angle + 10}°`,
    `x = ${x}, each angle measures ${Math.max(1, angle - 10)}°`,
  ].filter((text) => text !== correctAnswer)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['vertical-angles-with-expressions']
  return makeCurriculumQuestion({
    itemType: 'vertical-angles-with-expressions',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Two lines intersect, forming vertical angles that measure (${linearExprText(a, b)})° and (${linearExprText(c, d)})°. Vertical angles are congruent. Find the value of x and the measure of the angles.`,
    correctAnswer,
    distractors: [...new Set(distractors)],
    parameters: { a, b, c, d },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateAngleEquationMultistepQuestion(
  difficulty: Difficulty,
): Unit7Question<'angle-equation-multistep', SupplementaryAlgebraParameters> {
  const { a, b, c, d } = randomSupplementaryAlgebra(difficulty)
  const x = (180 - b - d) / (a + c)
  const angle1 = a * x + b
  const angle2 = 180 - angle1
  const correctAnswer = `x = ${x}, angles measure ${angle1}° and ${angle2}°`
  const altUp = { x: x + 1, angle1: a * (x + 1) + b }
  const altDown = { x: Math.max(1, x - 1), angle1: a * Math.max(1, x - 1) + b }
  const altUp2 = { x: x + 2, angle1: a * (x + 2) + b }
  const distractors = [
    `x = ${altUp.x}, angles measure ${altUp.angle1}° and ${180 - altUp.angle1}°`,
    `x = ${altDown.x}, angles measure ${altDown.angle1}° and ${180 - altDown.angle1}°`,
    `x = ${altUp2.x}, angles measure ${altUp2.angle1}° and ${180 - altUp2.angle1}°`,
    `x = ${x}, angles measure ${angle1}° and ${angle1}°`,
    `x = ${x}, angles measure ${angle2}° and ${angle1}°`,
  ].filter((text) => text !== correctAnswer)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['angle-equation-multistep']
  return makeCurriculumQuestion({
    itemType: 'angle-equation-multistep',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `Two angles are supplementary. Their measures are (${linearExprText(a, b)})° and (${linearExprText(c, d)})°. Find the value of x and the measure of each angle.`,
    correctAnswer,
    distractors: [...new Set(distractors)],
    parameters: { a, b, c, d },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateAnglesOnALineOrAroundAPointQuestion(
  difficulty: Difficulty,
): Unit7Question<'angles-on-a-line-or-around-a-point', AnglesSumParameters> {
  const { mode, knowns, x } = randomAnglesSum(difficulty)
  const total = mode === 'line' ? 180 : 360
  const otherTotal = mode === 'line' ? 360 : 180
  const sumKnowns = knowns.reduce((total_, k) => total_ + k, 0)
  const setting =
    mode === 'line'
      ? `${knowns.length === 2 ? 'Two' : 'Three'} angles lie along a straight line and measure ${knowns.map((k) => `${k}°`).join(', ')}, and x°.`
      : `The angles around a point measure ${knowns.map((k) => `${k}°`).join(', ')}, and x°.`
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['angles-on-a-line-or-around-a-point']
  return makeCurriculumQuestion({
    itemType: 'angles-on-a-line-or-around-a-point',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `${setting} What is the value of x?`,
    correctAnswer: `${x}°`,
    distractors: integerChoiceTexts(x, withIntFallback(x, [otherTotal - sumKnowns, sumKnowns, x + 10, Math.max(1, x - 10)])),
    parameters: { mode, knowns, x },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateAreaOfCompositeFigureQuestion(
  difficulty: Difficulty,
): Unit7Question<'area-of-composite-figure', CompositeFigureParameters> {
  const parameters = randomComposite(difficulty)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['area-of-composite-figure']
  if (parameters.mode === 'lshape') {
    const { rectW, rectH, notchW = 0, notchH = 0 } = parameters
    const area = intF(rectW * rectH - notchW * notchH)
    return makeCurriculumQuestion({
      itemType: 'area-of-composite-figure',
      standard: definition.standard,
      lessonFocus: definition.lessonFocus,
      difficulty,
      prompt: `A room shaped like an L is made from a ${rectW}-by-${rectH} rectangle with a ${notchW}-by-${notchH} rectangular corner cut out. What is the area of the room, in square units?`,
      correctAnswer: mixedText(area),
      distractors: fractionChoiceTexts(
        area,
        withFallback(area, [
          intF(rectW * rectH),
          intF(rectW * rectH - notchW - notchH),
          intF((rectW - notchW) * (rectH - notchH)),
        ]),
        mixedText,
      ),
      parameters,
      workedExample: definition.workedExample,
      distractorMode: 'distinct',
    })
  }
  const { rectW, rectH, triHeight = 0 } = parameters
  const area = reduceFraction({ num: rectW * rectH * 2 + rectW * triHeight, den: 2 })
  return makeCurriculumQuestion({
    itemType: 'area-of-composite-figure',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A figure is a ${rectW}-by-${rectH} rectangle topped by a triangle. The triangle's base equals the rectangle's width, ${rectW} units, and its height is ${triHeight} units. What is the total area of the figure, in square units?`,
    correctAnswer: mixedText(area),
    distractors: fractionChoiceTexts(
      area,
      withFallback(area, [intF(rectW * rectH), intF(rectW * rectH + rectW * triHeight), intF(rectW * rectH + triHeight)]),
      mixedText,
    ),
    parameters,
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateMissingDimensionFromAreaQuestion(
  difficulty: Difficulty,
): Unit7Question<'missing-dimension-from-area', MissingDimensionParameters> {
  const { width, area } = randomMissingDimension(difficulty)
  const length = reduceFraction({ num: area, den: width })
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['missing-dimension-from-area']
  return makeCurriculumQuestion({
    itemType: 'missing-dimension-from-area',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A rectangle has an area of ${area} square units and a width of ${width} units. What is its exact length, in units?`,
    correctAnswer: mixedText(length),
    distractors: fractionChoiceTexts(
      length,
      withFallback(length, [intF(area), intF(width), reduceFraction({ num: area - width, den: 1 })]),
      mixedText,
    ),
    parameters: { width, area },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateSurfaceAreaOfRectangularPrismQuestion(
  difficulty: Difficulty,
): Unit7Question<'surface-area-of-rectangular-prism', PrismParameters> {
  const { l, w, h } = randomPrism(difficulty)
  const lw = intF(l * w)
  const lh = mulFraction(intF(l), h)
  const wh = mulFraction(intF(w), h)
  const surfaceArea = mulFraction(addFraction(addFraction(lw, lh), wh), intF(2))
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['surface-area-of-rectangular-prism']
  return makeCurriculumQuestion({
    itemType: 'surface-area-of-rectangular-prism',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `A rectangular prism has length ${l}, width ${w}, and height ${mixedText(h)} (all in units). What is its exact surface area, in square units?`,
    correctAnswer: mixedText(surfaceArea),
    distractors: fractionChoiceTexts(
      surfaceArea,
      withFallback(surfaceArea, [
        addFraction(addFraction(lw, lh), wh),
        mulFraction(mulFraction(intF(l), intF(w)), h),
        mulFraction(surfaceArea, { num: 1, den: 2 }),
      ]),
      mixedText,
    ),
    parameters: { l, w, h },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export function generateVolumeOfRectangularPrismQuestion(
  difficulty: Difficulty,
): Unit7Question<'volume-of-rectangular-prism', PrismParameters> {
  const { l, w, h } = randomPrism(difficulty)
  const volume = mulFraction(mulFraction(intF(l), intF(w)), h)
  const definition = GRADE7_MATH_UNIT7_ITEM_DEFINITIONS['volume-of-rectangular-prism']
  return makeCurriculumQuestion({
    itemType: 'volume-of-rectangular-prism',
    standard: definition.standard,
    lessonFocus: definition.lessonFocus,
    difficulty,
    prompt: `What is the exact volume of a rectangular prism with length ${l}, width ${w}, and height ${mixedText(h)} (units)? Give your answer in cubic units.`,
    correctAnswer: `${mixedText(volume)} cubic units`,
    distractors: fractionChoiceTexts(
      volume,
      withFallback(volume, [intF(l * w), mulFraction(addFraction(addFraction(intF(l * w), mulFraction(intF(l), h)), mulFraction(intF(w), h)), intF(2)), mulFraction(volume, intF(2))]),
      (f) => `${mixedText(f)} cubic units`,
    ),
    parameters: { l, w, h },
    workedExample: definition.workedExample,
    distractorMode: 'distinct',
  })
}

export const GRADE7_MATH_UNIT7_GENERATORS = {
  'circumference-from-radius-or-diameter': generateCircumferenceFromRadiusOrDiameterQuestion,
  'find-radius-or-diameter-from-circumference': generateFindRadiusOrDiameterFromCircumferenceQuestion,
  'area-of-circle-from-radius-or-diameter': generateAreaOfCircleFromRadiusOrDiameterQuestion,
  'circumference-area-relationship': generateCircumferenceAreaRelationshipQuestion,
  'complementary-supplementary-angle': generateComplementarySupplementaryAngleQuestion,
  'vertical-angles-with-expressions': generateVerticalAnglesWithExpressionsQuestion,
  'angle-equation-multistep': generateAngleEquationMultistepQuestion,
  'angles-on-a-line-or-around-a-point': generateAnglesOnALineOrAroundAPointQuestion,
  'area-of-composite-figure': generateAreaOfCompositeFigureQuestion,
  'missing-dimension-from-area': generateMissingDimensionFromAreaQuestion,
  'surface-area-of-rectangular-prism': generateSurfaceAreaOfRectangularPrismQuestion,
  'volume-of-rectangular-prism': generateVolumeOfRectangularPrismQuestion,
} satisfies Record<Grade7MathUnit7ItemType, CurriculumGenerator<Grade7MathUnit7Question>>

export function generateGrade7MathUnit7Question<TItemType extends Grade7MathUnit7ItemType>(
  itemType: TItemType,
  difficulty: Difficulty,
): Extract<Grade7MathUnit7Question, { itemType: TItemType }> {
  const generator = GRADE7_MATH_UNIT7_GENERATORS[itemType] as CurriculumGenerator<
    Extract<Grade7MathUnit7Question, { itemType: TItemType }>
  >
  return generator(difficulty)
}
