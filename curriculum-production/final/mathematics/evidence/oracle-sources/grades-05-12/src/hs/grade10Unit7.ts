import { choose, fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 7 — Right Triangle Trigonometry (G-SRT.6, 7, 8). */

/** Pythagorean triples keep every ratio exact, so no answer depends on rounding. */
const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [9, 40, 41],
  [20, 21, 29],
] as const

export const GRADE10_UNIT7 = makeHsUnitBank(10, 7, [
  spec<{ tripleIndex: number; ratio: number; scale: number }>({
    itemType: 'trig-ratio-value',
    standard: 'G-SRT.6',
    lessonFocus: 'sine, cosine, and tangent as side ratios',
    build: (difficulty) => {
      const tripleIndex = rand(0, difficulty === 3 ? TRIPLES.length - 1 : 2)
      const scale = difficulty === 3 ? rand(1, 3) : 1
      const [opposite, adjacent, hypotenuse] = TRIPLES[tripleIndex]
      const ratio = rand(0, 2)
      const names = ['sin', 'cos', 'tan']
      const pairs: Array<[number, number]> = [
        [opposite, hypotenuse],
        [adjacent, hypotenuse],
        [opposite, adjacent],
      ]
      const [numerator, denominator] = pairs[ratio]
      return {
        prompt: `A right triangle has legs ${opposite * scale} and ${adjacent * scale} and hypotenuse ${hypotenuse * scale}. Angle θ is opposite the leg of length ${opposite * scale}. Find ${names[ratio]} θ as an exact fraction in lowest terms.`,
        parameters: { tripleIndex, ratio, scale },
        answer: fraction(numerator, denominator),
        distractors: [
          fraction(denominator, numerator),
          fraction(pairs[(ratio + 1) % 3][0], pairs[(ratio + 1) % 3][1]),
          fraction(pairs[(ratio + 2) % 3][0], pairs[(ratio + 2) % 3][1]),
          fraction(numerator + 1, denominator),
          fraction(numerator, denominator + 1),
        ],
        solutionSteps: [
          `Relative to θ, the opposite leg is ${opposite * scale}, the adjacent leg is ${adjacent * scale}, and the hypotenuse is ${hypotenuse * scale}.`,
          ratio === 0
            ? 'Sine is opposite over hypotenuse.'
            : ratio === 1
              ? 'Cosine is adjacent over hypotenuse.'
              : 'Tangent is opposite over adjacent.',
          `${names[ratio]} θ = ${numerator * scale}/${denominator * scale}, which reduces to ${fraction(numerator, denominator)}.`,
          `The scale factor cancels, which is why the ratio depends only on the angle and not on the triangle's size.`,
        ],
        commonErrors: [
          {
            observed: `Inverted the ratio and answered ${fraction(denominator, numerator)}.`,
            likelyCause: 'The numerator and denominator of the definition were swapped.',
            remediation:
              'Check plausibility: sine and cosine of an acute angle are always less than 1.',
          },
        ],
      }
    },
    oracle: ({ tripleIndex, ratio }) => {
      const [opposite, adjacent, hypotenuse] = TRIPLES[tripleIndex]
      const pairs: Array<[number, number]> = [
        [opposite, hypotenuse],
        [adjacent, hypotenuse],
        [opposite, adjacent],
      ]
      const [n, d] = pairs[ratio]
      const g = ((a: number, b: number): number => {
        let x = a
        let y = b
        while (y !== 0) [x, y] = [y, x % y]
        return x
      })(n, d) || 1
      return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
    },
    referenceExample: {
      prompt: 'A 3-4-5 triangle, θ opposite the side 3. Find sin θ.',
      steps: ['Opposite 3, hypotenuse 5.', 'sin θ = 3/5.'],
      answer: '3/5',
    },
  }),

  spec<{ tripleIndex: number; scale: number; unknown: number }>({
    itemType: 'solve-right-triangle-side',
    standard: 'G-SRT.8',
    lessonFocus: 'finding an unknown side in a right triangle',
    build: (difficulty) => {
      const tripleIndex = rand(0, difficulty === 3 ? TRIPLES.length - 1 : 2)
      const scale = rand(1, difficulty === 3 ? 5 : 3)
      const [a, b, c] = TRIPLES[tripleIndex].map((value) => value * scale) as [number, number, number]
      const unknown = rand(0, 1)
      const answer = unknown === 0 ? c : b
      return {
        prompt:
          unknown === 0
            ? `A right triangle has legs ${a} and ${b}. Find the hypotenuse.`
            : `A right triangle has hypotenuse ${c} and one leg ${a}. Find the other leg.`,
        parameters: { tripleIndex, scale, unknown },
        answer: String(answer),
        distractors: numericDistractors(answer, [
          unknown === 0 ? a + b : c - a,
          unknown === 0 ? Math.round(Math.sqrt(a * a - b * b)) || a : Math.round(Math.sqrt(c * c + a * a)),
          answer + scale,
          Math.abs(a - b),
        ]),
        solutionSteps: [
          `The Pythagorean theorem relates the sides: leg² + leg² = hypotenuse².`,
          unknown === 0
            ? `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c}.`
            : `${c}² − ${a}² = ${c * c} − ${a * a} = ${b * b}.`,
          `Taking the positive square root gives ${answer}.`,
        ],
        commonErrors: [
          {
            observed:
              unknown === 0
                ? `Added the legs and answered ${a + b}.`
                : `Subtracted the lengths directly and answered ${c - a}.`,
            likelyCause: 'The theorem was applied to the lengths rather than to their squares.',
            remediation:
              'Square each known length as a separate written step before combining them.',
          },
        ],
      }
    },
    oracle: ({ tripleIndex, scale, unknown }) => {
      const [a, b, c] = TRIPLES[tripleIndex].map((value) => value * scale)
      return String(unknown === 0 ? Math.sqrt(a * a + b * b) : Math.sqrt(c * c - a * a))
    },
    referenceExample: {
      prompt: 'Legs 6 and 8. Find the hypotenuse.',
      steps: ['36 + 64 = 100.', '√100 = 10.'],
      answer: '10',
    },
  }),

  spec<{ angle: number }>({
    itemType: 'complementary-sine-cosine',
    standard: 'G-SRT.7',
    lessonFocus: 'the relationship between sine and cosine of complementary angles',
    build: (difficulty) => {
      const angle = rand(10, difficulty === 3 ? 80 : 70)
      return {
        prompt: `Express sin ${angle}° as a cosine of another angle, and explain why the two are equal.`,
        parameters: { angle },
        answer: `cos ${90 - angle}°, because the two angles are complementary and swap the roles of opposite and adjacent`,
        distractors: [
          `cos ${angle}°, because sine and cosine are always equal`,
          `cos ${180 - angle}°, because the angles are supplementary`,
          `cos ${90 + angle}°, because the angles differ by a right angle`,
          `cos ${angle / 2}°, because the angle is halved`,
        ],
        solutionSteps: [
          `In a right triangle, the two acute angles sum to 90°, so they are complementary.`,
          `The side opposite one acute angle is the side adjacent to the other.`,
          `Sine is opposite over hypotenuse and cosine is adjacent over hypotenuse, so sin θ = cos(90° − θ).`,
          `Therefore sin ${angle}° = cos ${90 - angle}°.`,
        ],
        commonErrors: [
          {
            observed: `Answered cos ${180 - angle}°.`,
            likelyCause: 'Supplementary angles were used instead of complementary ones.',
            remediation:
              'Recall that the two acute angles of a right triangle sum to 90°, not 180°.',
          },
        ],
      }
    },
    oracle: ({ angle }) =>
      `cos ${90 - angle}°, because the two angles are complementary and swap the roles of opposite and adjacent`,
    referenceExample: {
      prompt: 'Write sin 35° as a cosine.',
      steps: ['sin θ = cos(90 − θ).', 'sin 35° = cos 55°.'],
      answer: 'cos 55°',
    },
  }),

  spec<{ tripleIndex: number; scale: number }>({
    itemType: 'angle-of-elevation-application',
    standard: 'G-SRT.8',
    lessonFocus: 'modelling with right triangle trigonometry',
    build: (difficulty) => {
      const tripleIndex = rand(0, difficulty === 3 ? TRIPLES.length - 1 : 2)
      const scale = rand(1, difficulty === 3 ? 4 : 2)
      const [opposite, adjacent] = TRIPLES[tripleIndex].map((value) => value * scale)
      return {
        prompt: `From a point ${adjacent} m from the base of a tower, the angle of elevation to the top is θ, and the tower is ${opposite} m tall. Which equation correctly determines θ?`,
        parameters: { tripleIndex, scale },
        answer: `tan θ = ${opposite}/${adjacent}`,
        distractors: [
          `sin θ = ${opposite}/${adjacent}`,
          `cos θ = ${opposite}/${adjacent}`,
          `tan θ = ${adjacent}/${opposite}`,
          `tan θ = ${opposite} × ${adjacent}`,
        ],
        solutionSteps: [
          `Draw the right triangle: the tower is the vertical leg, the ground distance is the horizontal leg, and θ is at the observation point.`,
          `Relative to θ, the tower (${opposite} m) is opposite and the ground distance (${adjacent} m) is adjacent.`,
          `The ratio relating opposite to adjacent is tangent.`,
          `So tan θ = ${opposite}/${adjacent}. The hypotenuse is not given, which rules out sine and cosine.`,
        ],
        commonErrors: [
          {
            observed: `Chose sin θ = ${opposite}/${adjacent}.`,
            likelyCause: 'The ground distance was treated as the hypotenuse.',
            remediation:
              'Label all three sides on the sketch before selecting a ratio; the hypotenuse is always opposite the right angle.',
          },
        ],
      }
    },
    oracle: ({ tripleIndex, scale }) => {
      const [opposite, adjacent] = TRIPLES[tripleIndex].map((value) => value * scale)
      return `tan θ = ${opposite}/${adjacent}`
    },
    referenceExample: {
      prompt: 'Tower 30 m tall, observer 40 m away. Equation for θ?',
      steps: ['Opposite 30, adjacent 40.', 'tan θ = 30/40.'],
      answer: 'tan θ = 30/40',
    },
  }),
])
