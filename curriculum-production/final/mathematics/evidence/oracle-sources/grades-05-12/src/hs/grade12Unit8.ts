import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 12 Unit 8 — Conic Sections and Volume Arguments (G-C.4, G-GPE.3, G-GMD.2). */

export const GRADE12_UNIT8 = makeHsUnitBank(12, 8, [
  spec<{ a: number; c: number }>({
    itemType: 'ellipse-from-foci-and-sum',
    standard: 'G-GPE.3',
    lessonFocus: 'deriving the equation of an ellipse from its foci',
    build: (difficulty) => {
      const pairs: Array<[number, number]> = [
        [5, 3],
        [5, 4],
        [13, 5],
        [13, 12],
        [10, 6],
      ]
      const [a, c] = pairs[rand(0, difficulty === 1 ? 1 : 4)]
      const bSquared = a * a - c * c
      return {
        prompt: `An ellipse centred at the origin has foci at (±${c}, 0) and the sum of distances to the foci equal to ${2 * a}. Write its equation.`,
        parameters: { a, c },
        answer: `x²/${a * a} + y²/${bSquared} = 1`,
        distractors: [
          `x²/${a * a} − y²/${bSquared} = 1`,
          `x²/${bSquared} + y²/${a * a} = 1`,
          `x²/${a * a} + y²/${c * c} = 1`,
          `x²/${2 * a} + y²/${bSquared} = 1`,
        ],
        solutionSteps: [
          `The constant sum of distances is 2a, so a = ${2 * a} ÷ 2 = ${a} and a² = ${a * a}.`,
          `The foci are at (±c, 0) with c = ${c}, so c² = ${c * c}.`,
          `For an ellipse, b² = a² − c² = ${a * a} − ${c * c} = ${bSquared}.`,
          `With the foci on the x-axis the major axis is horizontal, giving x²/${a * a} + y²/${bSquared} = 1.`,
        ],
        commonErrors: [
          {
            observed: `Placed a² under y² instead of x².`,
            likelyCause: 'The orientation of the major axis was not read from the foci.',
            remediation:
              'The larger denominator always sits under the variable matching the axis the foci lie on.',
          },
        ],
      }
    },
    oracle: ({ a, c }) => `x²/${a * a} + y²/${a * a - c * c} = 1`,
    referenceExample: {
      prompt: 'Foci (±3, 0), distance sum 10. Equation?',
      steps: ['a = 5, c = 3.', 'b² = 25 − 9 = 16.', 'x²/25 + y²/16 = 1.'],
      answer: 'x²/25 + y²/16 = 1',
    },
  }),

  spec<{ a: number; c: number }>({
    itemType: 'hyperbola-from-foci-and-difference',
    standard: 'G-GPE.3',
    lessonFocus: 'deriving the equation of a hyperbola from its foci',
    build: (difficulty) => {
      const pairs: Array<[number, number]> = [
        [3, 5],
        [4, 5],
        [5, 13],
        [12, 13],
        [6, 10],
      ]
      const [a, c] = pairs[rand(0, difficulty === 1 ? 1 : 4)]
      const bSquared = c * c - a * a
      return {
        prompt: `A hyperbola centred at the origin has foci at (±${c}, 0) and the absolute difference of distances to the foci equal to ${2 * a}. Write its equation.`,
        parameters: { a, c },
        answer: `x²/${a * a} − y²/${bSquared} = 1`,
        distractors: [
          `x²/${a * a} + y²/${bSquared} = 1`,
          `y²/${a * a} − x²/${bSquared} = 1`,
          `x²/${bSquared} − y²/${a * a} = 1`,
          `x²/${c * c} − y²/${a * a} = 1`,
        ],
        solutionSteps: [
          `The constant difference of distances is 2a, so a = ${a} and a² = ${a * a}.`,
          `The foci are at (±c, 0) with c = ${c}, so c² = ${c * c}.`,
          `For a hyperbola the relationship is b² = c² − a² — note this is the reverse of the ellipse relationship, because here c exceeds a.`,
          `b² = ${c * c} − ${a * a} = ${bSquared}, giving x²/${a * a} − y²/${bSquared} = 1.`,
        ],
        commonErrors: [
          {
            observed: 'Used b² = a² − c², producing a negative value.',
            likelyCause: 'The ellipse relationship was applied to a hyperbola.',
            remediation:
              'Check which of a and c is larger: for a hyperbola the foci lie beyond the vertices, so c > a.',
          },
        ],
      }
    },
    oracle: ({ a, c }) => `x²/${a * a} − y²/${c * c - a * a} = 1`,
    referenceExample: {
      prompt: 'Foci (±5, 0), difference 6. Equation?',
      steps: ['a = 3, c = 5.', 'b² = 25 − 9 = 16.', 'x²/9 − y²/16 = 1.'],
      answer: 'x²/9 − y²/16 = 1',
    },
  }),

  spec<{ which: number }>({
    itemType: 'cavalieri-volume-argument',
    standard: 'G-GMD.2',
    lessonFocus: 'Cavalieri’s principle and informal volume arguments',
    build: () => {
      const cases = [
        {
          text: 'an oblique cylinder and a right cylinder with the same base area and the same height',
          answer: 'They have equal volumes, because every horizontal cross-section has the same area at the same height.',
        },
        {
          text: 'a cone and a cylinder with the same base and height',
          answer: 'The cone has one third the volume, which Cavalieri’s principle establishes by comparing cross-sections against a reference solid.',
        },
        {
          text: 'a sphere of radius r and a cylinder of radius r and height 2r with two cones removed',
          answer: 'They have equal volumes, and matching cross-sections is exactly how the sphere volume formula is derived.',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Compare ${entry.text}. What does Cavalieri’s principle tell us?`,
        parameters: { which },
        answer: entry.answer,
        distractors: cases
          .filter((_, index) => index !== which)
          .map((other) => other.answer)
          .concat(['Nothing, because Cavalieri’s principle applies only to prisms.']),
        solutionSteps: [
          `Cavalieri's principle states that two solids of the same height have equal volumes if every plane parallel to the base cuts cross-sections of equal area.`,
          `The comparison therefore turns on cross-sectional areas at matching heights, not on the outward shape of the solids.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Assumed a slanted solid must have a different volume from an upright one.',
            likelyCause: 'Volume was judged by appearance rather than by cross-sections.',
            remediation:
              'Picture the solid as a stack of thin slices; sliding the slices sideways changes shape but not total volume.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'They have equal volumes, because every horizontal cross-section has the same area at the same height.',
        'The cone has one third the volume, which Cavalieri’s principle establishes by comparing cross-sections against a reference solid.',
        'They have equal volumes, and matching cross-sections is exactly how the sphere volume formula is derived.',
      ][which],
    referenceExample: {
      prompt: 'Do an oblique and a right cylinder with the same base and height have equal volume?',
      steps: ['Cross-sections match at every height.', 'Cavalieri gives equal volumes.'],
      answer: 'Yes',
    },
  }),

  spec<{ radius: number; distance: number }>({
    itemType: 'tangent-construction-from-external-point',
    standard: 'G-C.4',
    lessonFocus: 'constructing a tangent from a point outside a circle',
    build: (difficulty) => {
      const triples: Array<[number, number, number]> = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ]
      const [radius, tangent, distance] = triples[rand(0, difficulty === 1 ? 1 : 3)]
      return {
        prompt: `A circle has radius ${radius} and centre O. A point P lies ${distance} from O. Explain the construction of a tangent from P and give the tangent length.`,
        parameters: { radius, distance },
        answer: `Draw the circle on diameter OP; it meets the given circle at the point of tangency, and the tangent length is ${tangent}.`,
        distractors: [
          `Draw the circle on diameter OP; it meets the given circle at the point of tangency, and the tangent length is ${distance - radius}.`,
          `Draw the perpendicular bisector of OP; the tangent length is ${tangent}.`,
          `Draw the circle centred at P with radius ${radius}; the tangent length is ${tangent}.`,
          `Join P to O and extend; the tangent length is ${distance + radius}.`,
        ],
        solutionSteps: [
          `A tangent meets the radius at the point of tangency at a right angle, so the point of tangency sees OP as a right angle.`,
          `By the inscribed angle theorem, every point seeing OP at a right angle lies on the circle with OP as diameter.`,
          `So constructing the circle on diameter OP and intersecting it with the given circle locates the point of tangency exactly.`,
          `The right triangle then gives the tangent length: √(${distance}² − ${radius}²) = √${distance * distance - radius * radius} = ${tangent}.`,
        ],
        commonErrors: [
          {
            observed: `Gave the tangent length as ${distance - radius}.`,
            likelyCause: 'The lengths were subtracted directly instead of using the right triangle.',
            remediation:
              'Mark the right angle at the point of tangency; the Pythagorean relation follows immediately.',
          },
        ],
      }
    },
    oracle: ({ radius, distance }) =>
      `Draw the circle on diameter OP; it meets the given circle at the point of tangency, and the tangent length is ${Math.sqrt(distance * distance - radius * radius)}.`,
    referenceExample: {
      prompt: 'Radius 3, P is 5 from O. Tangent length and construction?',
      steps: ['Circle on diameter OP locates the tangency point.', '√(25 − 9) = 4.'],
      answer: '4',
    },
  }),
])
