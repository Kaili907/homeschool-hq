import { fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 11 Unit 5 — Trigonometric Functions and Periodic Models (F-TF.1, 2, 5, 8). */

/** Exact unit-circle values, keyed by degree measure. */
const EXACT = [
  { degrees: 0, radians: '0', sin: '0', cos: '1' },
  { degrees: 30, radians: 'π/6', sin: '1/2', cos: '√3/2' },
  { degrees: 45, radians: 'π/4', sin: '√2/2', cos: '√2/2' },
  { degrees: 60, radians: 'π/3', sin: '√3/2', cos: '1/2' },
  { degrees: 90, radians: 'π/2', sin: '1', cos: '0' },
] as const

export const GRADE11_UNIT5 = makeHsUnitBank(11, 5, [
  spec<{ index: number }>({
    itemType: 'degrees-to-radians',
    standard: 'F-TF.1',
    lessonFocus: 'radian measure as arc length on the unit circle',
    build: () => {
      const index = rand(0, EXACT.length - 1)
      const entry = EXACT[index]
      return {
        prompt: `Convert ${entry.degrees}° to radian measure, in terms of π.`,
        parameters: { index },
        answer: entry.radians,
        distractors: EXACT.filter((_, i) => i !== index)
          .map((other): string => other.radians)
          .concat([`${entry.degrees}π`]),
        solutionSteps: [
          `A full turn is 360°, which corresponds to an arc of 2π on the unit circle, so 180° corresponds to π.`,
          `Multiply the degree measure by π/180: ${entry.degrees} × π/180.`,
          `That simplifies to ${entry.radians}.`,
          `Radian measure is the arc length subtended on a unit circle, which is why it is a pure number rather than a unit of angle.`,
        ],
        commonErrors: [
          {
            observed: `Multiplied by π without dividing by 180.`,
            likelyCause: 'The conversion factor was applied only halfway.',
            remediation:
              'Check against the anchor 180° = π; any conversion must be consistent with it.',
          },
        ],
      }
    },
    oracle: ({ index }) => EXACT[index].radians,
    referenceExample: {
      prompt: 'Convert 60° to radians.',
      steps: ['60 × π/180.', 'Simplifies to π/3.'],
      answer: 'π/3',
    },
  }),

  spec<{ index: number; which: number }>({
    itemType: 'exact-trig-value-unit-circle',
    standard: 'F-TF.2',
    lessonFocus: 'exact values from the unit circle',
    build: () => {
      const index = rand(0, EXACT.length - 1)
      const which = rand(0, 1)
      const entry = EXACT[index]
      const answer = which === 0 ? entry.sin : entry.cos
      return {
        prompt: `Give the exact value of ${which === 0 ? 'sin' : 'cos'}(${entry.radians}).`,
        parameters: { index, which },
        answer,
        distractors: ['0', '1/2', '√2/2', '√3/2', '1'].filter((value) => value !== answer),
        solutionSteps: [
          `On the unit circle, the point at angle ${entry.radians} has coordinates (cos, sin).`,
          `At ${entry.degrees}° that point is (${entry.cos}, ${entry.sin}).`,
          `So ${which === 0 ? 'sin' : 'cos'}(${entry.radians}) = ${answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Swapped the sine and cosine values.',
            likelyCause: 'The coordinate order on the unit circle was reversed.',
            remediation:
              'Remember the point is (cos θ, sin θ): the horizontal coordinate is the cosine.',
          },
        ],
      }
    },
    oracle: ({ index, which }) => (which === 0 ? EXACT[index].sin : EXACT[index].cos),
    referenceExample: {
      prompt: 'Give the exact value of sin(π/6).',
      steps: ['The unit circle point at 30° is (√3/2, 1/2).', 'The sine is the y-coordinate.'],
      answer: '1/2',
    },
  }),

  spec<{ amplitude: number; periodDivisor: number; midline: number }>({
    itemType: 'amplitude-period-midline',
    standard: 'F-TF.5',
    lessonFocus: 'reading amplitude, period, and midline from a trigonometric model',
    build: (difficulty) => {
      const amplitude = rand(2, difficulty === 3 ? 12 : 7)
      const periodDivisor = [1, 2, 3, 4][rand(0, difficulty === 1 ? 1 : 3)]
      const midline = rand(1, difficulty === 3 ? 20 : 10)
      // 2π/2 must render as π, not as an unreduced fraction.
      const period = periodDivisor === 1 ? '2π' : periodDivisor === 2 ? 'π' : `2π/${periodDivisor}`
      return {
        prompt: `A model is f(t) = ${amplitude}·sin(${periodDivisor === 1 ? '' : periodDivisor}t) + ${midline}. State the amplitude, period, and midline.`,
        parameters: { amplitude, periodDivisor, midline },
        answer: `amplitude ${amplitude}; period ${period}; midline y = ${midline}`,
        // When periodDivisor is 1 the "multiplied instead of divided" distractor
        // would render identically to the answer, so use an explicitly wrong
        // period there instead.
        distractors: [
          `amplitude ${amplitude}; period ${periodDivisor === 1 ? 'π/2' : `${periodDivisor}·2π`}; midline y = ${midline}`,
          `amplitude ${midline}; period ${period}; midline y = ${amplitude}`,
          `amplitude ${2 * amplitude}; period ${period}; midline y = ${midline}`,
          `amplitude ${amplitude}; period ${periodDivisor}; midline y = ${midline}`,
          `amplitude ${amplitude + 1}; period ${period}; midline y = ${midline}`,
          `amplitude ${amplitude}; period ${period}; midline y = ${midline + 1}`,
        ],
        solutionSteps: [
          `In f(t) = A·sin(Bt) + D, the amplitude is |A|, the period is 2π/|B|, and the midline is y = D.`,
          `Here A = ${amplitude}, so the amplitude is ${amplitude} — the distance from the midline to a peak.`,
          `B = ${periodDivisor}, so the period is 2π ÷ ${periodDivisor} = ${period}.`,
          `D = ${midline}, so the midline is y = ${midline}.`,
        ],
        commonErrors: [
          {
            observed: 'Multiplied by B instead of dividing to find the period.',
            likelyCause: 'The role of B as a horizontal compression factor was inverted.',
            remediation:
              'A larger B means faster oscillation, so the period must get smaller — check the direction against that.',
          },
        ],
      }
    },
    oracle: ({ amplitude, periodDivisor, midline }) => {
      const reduced =
        periodDivisor === 1 ? '2π' : periodDivisor === 2 ? 'π' : `2π/${periodDivisor}`
      return `amplitude ${amplitude}; period ${reduced}; midline y = ${midline}`
    },
    referenceExample: {
      prompt: 'For f(t) = 3sin(2t) + 5, state amplitude, period, midline.',
      steps: ['A = 3, B = 2, D = 5.', 'Period 2π/2 = π.'],
      answer: 'amplitude 3; period π; midline y = 5',
    },
  }),

  spec<{ index: number; quadrant: number }>({
    itemType: 'pythagorean-identity',
    standard: 'F-TF.8',
    lessonFocus: 'using sin²θ + cos²θ = 1',
    build: () => {
      const triples: Array<[number, number, number]> = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ]
      const index = rand(0, 3)
      const quadrant = rand(0, 1)
      const [opposite, adjacent, hypotenuse] = triples[index]
      const cosSign = quadrant === 0 ? 1 : -1
      return {
        prompt: `Given sin θ = ${opposite}/${hypotenuse} and θ is in ${quadrant === 0 ? 'the first quadrant' : 'the second quadrant'}, find cos θ exactly.`,
        parameters: { index, quadrant },
        answer: `${cosSign === 1 ? '' : '−'}${adjacent}/${hypotenuse}`,
        distractors: [
          `${cosSign === 1 ? '−' : ''}${adjacent}/${hypotenuse}`,
          `${opposite}/${hypotenuse}`,
          `${hypotenuse}/${adjacent}`,
          `${adjacent}/${opposite}`,
        ],
        solutionSteps: [
          `Apply sin²θ + cos²θ = 1: cos²θ = 1 − (${opposite}/${hypotenuse})² = 1 − ${opposite * opposite}/${hypotenuse * hypotenuse}.`,
          `That equals ${adjacent * adjacent}/${hypotenuse * hypotenuse}, so |cos θ| = ${adjacent}/${hypotenuse}.`,
          quadrant === 0
            ? 'In the first quadrant cosine is positive.'
            : 'In the second quadrant cosine is negative.',
          `Therefore cos θ = ${cosSign === 1 ? '' : '−'}${adjacent}/${hypotenuse}.`,
        ],
        commonErrors: [
          {
            observed: 'Took the positive root without checking the quadrant.',
            likelyCause: 'The identity gives magnitude only; the sign requires the quadrant.',
            remediation:
              'Sketch the angle in its quadrant and read off the sign of the horizontal coordinate.',
          },
        ],
      }
    },
    oracle: ({ index, quadrant }) => {
      const triples: Array<[number, number, number]> = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25],
      ]
      const [, adjacent, hypotenuse] = triples[index]
      return `${quadrant === 0 ? '' : '−'}${adjacent}/${hypotenuse}`
    },
    referenceExample: {
      prompt: 'sin θ = 3/5, θ in quadrant I. Find cos θ.',
      steps: ['cos²θ = 1 − 9/25 = 16/25.', 'Quadrant I: cos θ = 4/5.'],
      answer: '4/5',
    },
  }),
])
