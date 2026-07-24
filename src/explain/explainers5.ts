import type { SkillId } from '../skills'
import { answerOf, cleanPrompt, steps, type Explainer } from './types'

const walkthrough =
  (concept: string, method: string, takeaway: string): Explainer =>
  (q) => {
    const answer = answerOf(q)
    return steps(
      { say: concept },
      { say: `${method} Work through ${cleanPrompt(q)} one step at a time.` },
      { say: `The answer is ${answer}. ${takeaway}` },
    )
  }

const mult5 = walkthrough(
  'Multi-digit multiplication combines place-value partial products.',
  'Multiply by each place, line up those partial products, and add.',
  'Keeping each partial product in its place keeps the product accurate.',
)

const div5 = walkthrough(
  'Long division asks how many groups of the divisor fit into the dividend.',
  'Estimate, multiply, subtract, and bring down until every place is used.',
  'A remainder is always smaller than the divisor.',
)

const fracAdd5 = walkthrough(
  'Fractions must name equal-size pieces before they can be added.',
  'Find a common denominator, rewrite both fractions, then add the numerators.',
  'Add only after the denominators match, and simplify at the end.',
)

const fracSub5 = walkthrough(
  'Fractions must name equal-size pieces before they can be subtracted.',
  'Find a common denominator, rewrite both fractions, then subtract the numerators.',
  'Subtract only after the denominators match, and simplify at the end.',
)

const fracMult5 = walkthrough(
  'Multiplying fractions finds a fraction of another amount.',
  'Multiply the numerators, multiply the denominators, then simplify.',
  'Multiply straight across and reduce the product.',
)

const fracDiv5 = walkthrough(
  'Fraction division counts how many equal fractional groups fit.',
  'Use the unit-fraction relationship: dividing by 1/n makes n groups for each whole.',
  'Think about the size and number of equal groups.',
)

const decOps5 = walkthrough(
  'Decimal operations use the same place-value ideas as whole-number operations.',
  'Track each digit by its place and keep the decimal point in the correct position.',
  'Estimate the size first, then check that the decimal placement is reasonable.',
)

const placePow5 = walkthrough(
  'Each move to a neighboring place changes a value by a factor of 10.',
  'Use the exponent to count how many place-value moves are needed.',
  'A power of 10 tells exactly how many places the digits shift.',
)

const volume5 = walkthrough(
  'Volume counts unit cubes that fill a three-dimensional shape.',
  'Multiply length by width by height, or use the missing-factor relationship.',
  'Volume is measured in cubic units.',
)

const coord5 = walkthrough(
  'Coordinates locate points with an ordered pair.',
  'Read or change the horizontal x-value first, then the vertical y-value.',
  'Always write coordinates in x, y order.',
)

const orderOps5 = walkthrough(
  'The order of operations makes every expression have one agreed value.',
  'Work inside grouping symbols first, then multiply or divide, then add or subtract.',
  'At the same level, work from left to right.',
)

export const EXPLAINERS5: Partial<Record<SkillId, Explainer>> = {
  mult5,
  div5,
  fracAdd5,
  fracSub5,
  fracMult5,
  fracDiv5,
  decOps5,
  placePow5,
  volume5,
  coord5,
  orderOps5,
}
