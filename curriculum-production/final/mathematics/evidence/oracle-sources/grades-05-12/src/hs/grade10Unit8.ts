import { fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 8 — Circles (G-C.1, 2, 3, 5). */

export const GRADE10_UNIT8 = makeHsUnitBank(10, 8, [
  spec<{ arc: number }>({
    itemType: 'inscribed-angle-measure',
    standard: 'G-C.2',
    lessonFocus: 'the inscribed angle theorem',
    build: (difficulty) => {
      const arc = rand(10, difficulty === 3 ? 88 : 60) * 2
      return {
        prompt: `An inscribed angle in a circle intercepts an arc of ${arc}°. Find the measure of the inscribed angle.`,
        parameters: { arc },
        answer: `${arc / 2}°`,
        distractors: numericDistractors(arc / 2, [arc, arc * 2, 180 - arc, 90]).map(
          (value) => `${value}°`,
        ),
        solutionSteps: [
          `The inscribed angle theorem states that an inscribed angle is half the central angle subtending the same arc.`,
          `The intercepted arc measures ${arc}°, which is also the central angle.`,
          `So the inscribed angle is ${arc} ÷ 2 = ${arc / 2}°.`,
        ],
        commonErrors: [
          {
            observed: `Gave ${arc}°, the arc measure itself.`,
            likelyCause: 'The inscribed angle was equated with the central angle.',
            remediation:
              'Draw both angles on the same arc; the one with its vertex on the circle is visibly smaller.',
          },
        ],
      }
    },
    oracle: ({ arc }) => `${arc / 2}°`,
    referenceExample: {
      prompt: 'An inscribed angle intercepts a 100° arc. Find it.',
      steps: ['Inscribed angle is half the arc.', '100 ÷ 2 = 50°.'],
      answer: '50°',
    },
  }),

  spec<{ radius: number; distance: number }>({
    itemType: 'tangent-radius-perpendicularity',
    standard: 'G-C.2',
    lessonFocus: 'the tangent line and the radius at the point of tangency',
    build: (difficulty) => {
      const triples: Array<[number, number, number]> = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ]
      const [radius, tangent, distance] = triples[rand(0, difficulty === 3 ? 3 : 1)]
      return {
        prompt: `A circle has radius ${radius}. From an external point ${distance} from the centre, a tangent is drawn. Find the length of the tangent segment, and state the fact that makes this possible.`,
        parameters: { radius, distance },
        answer: `${tangent}, because the radius is perpendicular to the tangent at the point of tangency`,
        distractors: [
          `${distance - radius}, because the radius is perpendicular to the tangent at the point of tangency`,
          `${tangent}, because the tangent bisects the radius`,
          `${distance + radius}, because the tangent extends beyond the circle`,
          `${radius}, because all tangents equal the radius`,
        ],
        solutionSteps: [
          `The radius drawn to the point of tangency is perpendicular to the tangent line.`,
          `That makes a right triangle with legs ${radius} (radius) and the tangent segment, and hypotenuse ${distance} (centre to external point).`,
          `By the Pythagorean theorem: tangent² = ${distance}² − ${radius}² = ${distance * distance - radius * radius}.`,
          `The tangent segment has length ${tangent}.`,
        ],
        commonErrors: [
          {
            observed: `Subtracted the lengths and answered ${distance - radius}.`,
            likelyCause: 'The right-angle relationship was not used.',
            remediation:
              'Mark the right angle at the point of tangency first; it identifies which side is the hypotenuse.',
          },
        ],
      }
    },
    oracle: ({ radius, distance }) =>
      `${Math.sqrt(distance * distance - radius * radius)}, because the radius is perpendicular to the tangent at the point of tangency`,
    referenceExample: {
      prompt: 'Radius 3, external point 5 from centre. Tangent length?',
      steps: ['Right triangle with hypotenuse 5, leg 3.', '√(25 − 9) = 4.'],
      answer: '4',
    },
  }),

  spec<{ radius: number; angle: number }>({
    itemType: 'arc-length-and-sector-area',
    standard: 'G-C.5',
    lessonFocus: 'arc length and sector area as fractions of the circle',
    build: (difficulty) => {
      const radius = rand(2, difficulty === 3 ? 15 : 9)
      const angle = [30, 45, 60, 90, 120, 180][rand(0, difficulty === 1 ? 3 : 5)]
      return {
        prompt: `A circle has radius ${radius}. Find the arc length and the sector area for a central angle of ${angle}°, in terms of π.`,
        parameters: { radius, angle },
        answer: `arc ${fraction(angle * radius, 180)}π; sector ${fraction(angle * radius * radius, 360)}π`,
        distractors: [
          `arc ${fraction(angle * radius * radius, 360)}π; sector ${fraction(angle * radius, 180)}π`,
          `arc ${fraction(angle * radius, 360)}π; sector ${fraction(angle * radius * radius, 360)}π`,
          `arc ${fraction(angle * radius, 180)}π; sector ${fraction(angle * radius * radius, 180)}π`,
          `arc ${fraction(radius, 2)}π; sector ${fraction(radius * radius, 2)}π`,
          // Doubling one component always differs from the answer, which keeps
          // the pool full when a half-circle makes the authored near-misses coincide.
          `arc ${fraction(2 * angle * radius, 180)}π; sector ${fraction(angle * radius * radius, 360)}π`,
          `arc ${fraction(angle * radius, 180)}π; sector ${fraction(2 * angle * radius * radius, 360)}π`,
        ],
        solutionSteps: [
          `The sector is ${angle}/360 of the whole circle.`,
          `The full circumference is 2π(${radius}) = ${2 * radius}π, so the arc is (${angle}/360)(${2 * radius}π) = ${fraction(angle * radius, 180)}π.`,
          `The full area is π(${radius})² = ${radius * radius}π, so the sector is (${angle}/360)(${radius * radius}π) = ${fraction(angle * radius * radius, 360)}π.`,
        ],
        commonErrors: [
          {
            observed: 'Used the area formula for the arc and the circumference formula for the sector.',
            likelyCause: 'The two formulas were interchanged.',
            remediation:
              'Check the units conceptually: an arc is a length and scales with r, while a sector is an area and scales with r².',
          },
        ],
      }
    },
    oracle: ({ radius, angle }) => {
      const reduce = (n: number, d: number): string => {
        const g = ((a: number, b: number): number => {
          let x = Math.abs(a)
          let y = Math.abs(b)
          while (y !== 0) [x, y] = [y, x % y]
          return x
        })(n, d) || 1
        return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
      }
      return `arc ${reduce(angle * radius, 180)}π; sector ${reduce(angle * radius * radius, 360)}π`
    },
    referenceExample: {
      prompt: 'Radius 6, central angle 60°. Arc and sector?',
      steps: ['Fraction is 60/360 = 1/6.', 'Arc = (1/6)(12π) = 2π; sector = (1/6)(36π) = 6π.'],
      answer: 'arc 2π; sector 6π',
    },
  }),

  spec<{ angle: number }>({
    itemType: 'cyclic-quadrilateral-angle',
    standard: 'G-C.3',
    lessonFocus: 'quadrilaterals inscribed in a circle',
    build: (difficulty) => {
      const angle = rand(30, difficulty === 3 ? 150 : 130)
      return {
        prompt: `A quadrilateral is inscribed in a circle. One angle measures ${angle}°. Find the measure of the opposite angle.`,
        parameters: { angle },
        answer: `${180 - angle}°`,
        distractors: numericDistractors(180 - angle, [angle, 360 - angle, 90, angle / 2]).map(
          (value) => `${value}°`,
        ),
        solutionSteps: [
          `Opposite angles of a cyclic quadrilateral are supplementary.`,
          `This follows from the inscribed angle theorem: the two opposite angles intercept arcs that together make the whole circle, 360°, so their halves sum to 180°.`,
          `The opposite angle is 180 − ${angle} = ${180 - angle}°.`,
        ],
        commonErrors: [
          {
            observed: 'Assumed opposite angles are congruent.',
            likelyCause: 'A property of parallelograms was applied to a cyclic quadrilateral.',
            remediation:
              'Check the special case of a rectangle inscribed in a circle: opposite angles are 90° and 90°, which is both equal and supplementary — then test a non-rectangular case.',
          },
        ],
      }
    },
    oracle: ({ angle }) => `${180 - angle}°`,
    referenceExample: {
      prompt: 'A cyclic quadrilateral has an angle of 85°. Opposite angle?',
      steps: ['Opposite angles are supplementary.', '180 − 85 = 95°.'],
      answer: '95°',
    },
  }),
])
