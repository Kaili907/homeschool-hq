import { makeHsUnitBank, rand, spec } from './core.ts'

/** Grade 12 Unit 2 — Inverse Trigonometric Functions and Composition (F-TF.6, 7, F-BF.5). */

const ARCSIN = [
  { value: '0', degrees: 0, radians: '0' },
  { value: '1/2', degrees: 30, radians: 'π/6' },
  { value: '√2/2', degrees: 45, radians: 'π/4' },
  { value: '√3/2', degrees: 60, radians: 'π/3' },
  { value: '1', degrees: 90, radians: 'π/2' },
] as const

export const GRADE12_UNIT2 = makeHsUnitBank(12, 2, [
  spec<{ index: number }>({
    itemType: 'evaluate-inverse-sine',
    standard: 'F-TF.6',
    lessonFocus: 'inverse trigonometric functions on a restricted domain',
    build: () => {
      const index = rand(0, ARCSIN.length - 1)
      const entry = ARCSIN[index]
      return {
        prompt: `Evaluate arcsin(${entry.value}) in radians, giving the principal value.`,
        parameters: { index },
        answer: entry.radians,
        distractors: ARCSIN.filter((_, i) => i !== index)
          .map((other): string => other.radians)
          .concat(['π']),
        solutionSteps: [
          `arcsin returns the unique angle in [−π/2, π/2] whose sine is the given value; this restriction is what makes the inverse a function.`,
          `Ask which angle in that interval has sine ${entry.value}: that is ${entry.degrees}°.`,
          `Converting to radians: ${entry.radians}.`,
        ],
        commonErrors: [
          {
            observed: 'Gave a second angle with the same sine, outside the principal range.',
            likelyCause: 'The domain restriction was ignored.',
            remediation:
              'State the principal range before answering and check the candidate lies inside it.',
          },
        ],
      }
    },
    oracle: ({ index }) => ARCSIN[index].radians,
    referenceExample: {
      prompt: 'Evaluate arcsin(1/2).',
      steps: ['Which angle in [−π/2, π/2] has sine 1/2?', '30°, which is π/6.'],
      answer: 'π/6',
    },
  }),

  spec<{ index: number }>({
    itemType: 'compose-trig-and-inverse',
    standard: 'F-TF.7',
    lessonFocus: 'composing a trigonometric function with an inverse',
    build: () => {
      const index = rand(1, ARCSIN.length - 2)
      const entry = ARCSIN[index]
      const complement = ARCSIN[ARCSIN.length - 1 - index]
      return {
        prompt: `Evaluate cos(arcsin(${entry.value})) exactly.`,
        parameters: { index },
        answer: complement.value,
        distractors: ARCSIN.map((other): string => other.value)
          .filter((value) => value !== complement.value)
          .concat(['−1/2']),
        solutionSteps: [
          `Let θ = arcsin(${entry.value}), so sin θ = ${entry.value} and θ lies in [−π/2, π/2].`,
          `Apply the Pythagorean identity: cos²θ = 1 − sin²θ.`,
          `Cosine is non-negative throughout [−π/2, π/2], so take the positive root.`,
          `That gives cos θ = ${complement.value}. Equivalently, θ = ${entry.degrees}° and cos ${entry.degrees}° = ${complement.value}.`,
        ],
        commonErrors: [
          {
            observed: 'Chose a negative value for the cosine.',
            likelyCause: 'The restricted range of arcsin was not used to fix the sign.',
            remediation:
              'Note that arcsin outputs lie in [−π/2, π/2], where cosine is never negative.',
          },
        ],
      }
    },
    oracle: ({ index }) => ARCSIN[ARCSIN.length - 1 - index].value,
    referenceExample: {
      prompt: 'Evaluate cos(arcsin(3/5)).',
      steps: ['sin θ = 3/5 with θ in [−π/2, π/2].', 'cos θ = +4/5.'],
      answer: '4/5',
    },
  }),

  spec<{ which: number }>({
    itemType: 'why-domain-restriction-is-needed',
    standard: 'F-BF.5',
    lessonFocus: 'why trigonometric functions need restricted domains to be invertible',
    build: () => {
      const cases = [
        {
          text: 'sine on all real numbers',
          answer: 'It is not one-to-one — infinitely many inputs give the same output — so it has no inverse until the domain is restricted to [−π/2, π/2].',
        },
        {
          text: 'cosine on all real numbers',
          answer: 'It is not one-to-one, so the domain is restricted to [0, π] to make an inverse possible.',
        },
        {
          text: 'tangent on all real numbers where it is defined',
          answer: 'It repeats with period π, so the domain is restricted to (−π/2, π/2) to make an inverse possible.',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Why does ${entry.text} not have an inverse function without further restriction?`,
        parameters: { which },
        answer: entry.answer,
        distractors: cases
          .filter((_, index) => index !== which)
          .map((other) => other.answer)
          .concat(['Because its outputs are not all positive.']),
        solutionSteps: [
          `A function has an inverse function exactly when it is one-to-one: each output must come from only one input.`,
          `A periodic function repeats its outputs indefinitely, so it fails that test on its full domain.`,
          `Restricting the domain to one stretch where the function is strictly monotonic restores the one-to-one property.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Explained the restriction as a convention with no reason behind it.',
            likelyCause: 'The one-to-one requirement was not connected to invertibility.',
            remediation:
              'Ask the learner to find two inputs with the same output; that pair is exactly what blocks the inverse.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'It is not one-to-one — infinitely many inputs give the same output — so it has no inverse until the domain is restricted to [−π/2, π/2].',
        'It is not one-to-one, so the domain is restricted to [0, π] to make an inverse possible.',
        'It repeats with period π, so the domain is restricted to (−π/2, π/2) to make an inverse possible.',
      ][which],
    referenceExample: {
      prompt: 'Why restrict the domain of sine before inverting?',
      steps: ['Sine repeats, so it is not one-to-one.', 'Restricting to [−π/2, π/2] fixes that.'],
      answer: 'to make it one-to-one',
    },
  }),

  spec<{ index: number; quadrant: number }>({
    itemType: 'solve-trig-equation-all-solutions',
    standard: 'F-TF.7',
    lessonFocus: 'finding all solutions of a trigonometric equation in an interval',
    build: () => {
      const index = rand(1, 3)
      const entry = ARCSIN[index]
      const second = 180 - entry.degrees
      return {
        prompt: `Find all solutions of sin θ = ${entry.value} for 0° ≤ θ < 360°.`,
        parameters: { index, quadrant: 0 },
        answer: `θ = ${entry.degrees}° or θ = ${second}°`,
        distractors: [
          `θ = ${entry.degrees}° only`,
          `θ = ${entry.degrees}° or θ = ${180 + entry.degrees}°`,
          `θ = ${entry.degrees}° or θ = ${360 - entry.degrees}°`,
          `θ = ${second}° only`,
        ],
        solutionSteps: [
          `The principal solution is θ = arcsin(${entry.value}) = ${entry.degrees}°.`,
          `Sine is positive in quadrants 1 and 2, so there is a second solution in quadrant 2.`,
          `Its reference angle is also ${entry.degrees}°, so θ = 180 − ${entry.degrees} = ${second}°.`,
          `Within 0° ≤ θ < 360° the complete solution set is θ = ${entry.degrees}° or θ = ${second}°.`,
        ],
        commonErrors: [
          {
            observed: 'Reported only the calculator value.',
            likelyCause: 'The inverse function returns one solution, and the others were not sought.',
            remediation:
              'Identify which quadrants give the required sign, then produce one solution in each.',
          },
        ],
      }
    },
    oracle: ({ index }) => {
      const entry = ARCSIN[index]
      return `θ = ${entry.degrees}° or θ = ${180 - entry.degrees}°`
    },
    referenceExample: {
      prompt: 'Solve sin θ = 1/2 for 0° ≤ θ < 360°.',
      steps: ['Principal solution 30°.', 'Sine positive in quadrant 2 as well: 150°.'],
      answer: 'θ = 30° or θ = 150°',
    },
  }),
])
