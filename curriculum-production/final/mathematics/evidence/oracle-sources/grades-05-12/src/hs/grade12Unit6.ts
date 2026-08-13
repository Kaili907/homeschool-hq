import { makeHsUnitBank, nonZero, numericDistractors, rand, renderRadical, simplifyRadical, spec } from './core.ts'

/** Grade 12 Unit 6 — Vectors (N-VM.1-5). */

export const GRADE12_UNIT6 = makeHsUnitBank(12, 6, [
  spec<{ x: number; y: number }>({
    itemType: 'vector-magnitude-and-components',
    standard: 'N-VM.1',
    lessonFocus: 'vectors as quantities with magnitude and direction',
    build: (difficulty) => {
      const triples: Array<[number, number]> = [
        [3, 4],
        [6, 8],
        [5, 12],
        [8, 15],
        [7, 24],
      ]
      const [magX, magY] = triples[rand(0, difficulty === 1 ? 1 : 4)]
      const x = rand(0, 1) === 0 ? magX : -magX
      const y = rand(0, 1) === 0 ? magY : -magY
      const magnitude = Math.sqrt(x * x + y * y)
      return {
        prompt: `A vector has components ⟨${x}, ${y}⟩. Find its magnitude.`,
        parameters: { x, y },
        answer: String(magnitude),
        distractors: numericDistractors(magnitude, [
          Math.abs(x) + Math.abs(y),
          x * x + y * y,
          Math.abs(Math.abs(x) - Math.abs(y)),
          Math.abs(x * y),
        ]),
        solutionSteps: [
          `The magnitude is the length of the arrow, given by the Pythagorean theorem on the components.`,
          `|v| = √(${x}² + ${y}²) = √(${x * x} + ${y * y}) = √${x * x + y * y}.`,
          `√${x * x + y * y} = ${magnitude}.`,
          `The signs of the components affect direction but not magnitude, since both are squared.`,
        ],
        commonErrors: [
          {
            observed: `Added the absolute components and answered ${Math.abs(x) + Math.abs(y)}.`,
            likelyCause: 'The magnitude was treated as a sum rather than a hypotenuse.',
            remediation:
              'Sketch the components as legs of a right triangle; the vector is the hypotenuse and must be shorter than their sum.',
          },
        ],
      }
    },
    oracle: ({ x, y }) => String(Math.sqrt(x * x + y * y)),
    referenceExample: {
      prompt: 'Find the magnitude of ⟨3, 4⟩.',
      steps: ['√(9 + 16) = √25.', '= 5.'],
      answer: '5',
    },
  }),

  spec<{ ax: number; ay: number; bx: number; by: number }>({
    itemType: 'vector-addition-and-subtraction',
    standard: 'N-VM.4',
    lessonFocus: 'adding and subtracting vectors componentwise',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 12 : 7
      const ax = nonZero(bound)
      const ay = nonZero(bound)
      const bx = nonZero(bound)
      const by = nonZero(bound)
      return {
        prompt: `Given u = ⟨${ax}, ${ay}⟩ and v = ⟨${bx}, ${by}⟩, find u − v.`,
        parameters: { ax, ay, bx, by },
        answer: `⟨${ax - bx}, ${ay - by}⟩`,
        distractors: [
          `⟨${ax + bx}, ${ay + by}⟩`,
          `⟨${bx - ax}, ${by - ay}⟩`,
          `⟨${ax - bx}, ${ay + by}⟩`,
          `⟨${ax - by}, ${ay - bx}⟩`,
        ],
        solutionSteps: [
          `Vector subtraction acts on each component independently.`,
          `First component: ${ax} − ${bx} = ${ax - bx}.`,
          `Second component: ${ay} − ${by} = ${ay - by}.`,
          `So u − v = ⟨${ax - bx}, ${ay - by}⟩. Geometrically this is the arrow from the tip of v to the tip of u.`,
        ],
        commonErrors: [
          {
            observed: `Computed v − u and answered ⟨${bx - ax}, ${by - ay}⟩.`,
            likelyCause: 'The order of subtraction was reversed.',
            remediation:
              'Vector subtraction is not commutative; write the first named vector first in every component.',
          },
        ],
      }
    },
    oracle: ({ ax, ay, bx, by }) => `⟨${ax - bx}, ${ay - by}⟩`,
    referenceExample: {
      prompt: 'u = ⟨5, 2⟩, v = ⟨1, 7⟩. Find u − v.',
      steps: ['5 − 1 = 4.', '2 − 7 = −5.'],
      answer: '⟨4, −5⟩',
    },
  }),

  spec<{ x: number; y: number; scalar: number }>({
    itemType: 'scalar-multiplication-effect',
    standard: 'N-VM.5',
    lessonFocus: 'the effect of scalar multiplication on magnitude and direction',
    build: (difficulty) => {
      const triples: Array<[number, number]> = [
        [3, 4],
        [6, 8],
        [5, 12],
      ]
      const [x, y] = triples[rand(0, difficulty === 1 ? 1 : 2)]
      const scalar = nonZero(difficulty === 3 ? 5 : 3, 2)
      const magnitude = Math.sqrt(x * x + y * y)
      return {
        prompt: `Let v = ⟨${x}, ${y}⟩, which has magnitude ${magnitude}. Find ${scalar}v and its magnitude, and say how the direction changes.`,
        parameters: { x, y, scalar },
        answer: `⟨${scalar * x}, ${scalar * y}⟩, magnitude ${Math.abs(scalar) * magnitude}, direction ${scalar < 0 ? 'reversed' : 'unchanged'}`,
        distractors: [
          `⟨${scalar * x}, ${scalar * y}⟩, magnitude ${Math.abs(scalar) * magnitude}, direction ${scalar < 0 ? 'unchanged' : 'reversed'}`,
          `⟨${scalar * x}, ${scalar * y}⟩, magnitude ${magnitude}, direction ${scalar < 0 ? 'reversed' : 'unchanged'}`,
          `⟨${scalar + x}, ${scalar + y}⟩, magnitude ${Math.abs(scalar) * magnitude}, direction unchanged`,
          `⟨${scalar * x}, ${scalar * y}⟩, magnitude ${scalar * scalar * magnitude}, direction unchanged`,
        ],
        solutionSteps: [
          `Scalar multiplication scales every component: ${scalar}v = ⟨${scalar} × ${x}, ${scalar} × ${y}⟩ = ⟨${scalar * x}, ${scalar * y}⟩.`,
          `The magnitude is multiplied by the absolute value of the scalar: |${scalar}| × ${magnitude} = ${Math.abs(scalar) * magnitude}.`,
          scalar < 0
            ? `Because the scalar is negative, every component flips sign, so the direction is reversed.`
            : `Because the scalar is positive, the direction is unchanged and only the length grows.`,
        ],
        commonErrors: [
          {
            observed: `Used the signed scalar for the magnitude, giving a negative length.`,
            likelyCause: 'The absolute value was not applied.',
            remediation:
              'Magnitude is a length and can never be negative; take the absolute value of the scalar.',
          },
        ],
      }
    },
    oracle: ({ x, y, scalar }) => {
      const magnitude = Math.sqrt(x * x + y * y)
      return `⟨${scalar * x}, ${scalar * y}⟩, magnitude ${Math.abs(scalar) * magnitude}, direction ${scalar < 0 ? 'reversed' : 'unchanged'}`
    },
    referenceExample: {
      prompt: 'v = ⟨3, 4⟩, find −2v.',
      steps: ['⟨−6, −8⟩.', 'Magnitude 2 × 5 = 10, direction reversed.'],
      answer: '⟨−6, −8⟩, magnitude 10, reversed',
    },
  }),

  spec<{ x: number; y: number }>({
    itemType: 'unit-vector',
    standard: 'N-VM.3',
    lessonFocus: 'finding a unit vector in a given direction',
    build: (difficulty) => {
      const triples: Array<[number, number]> = [
        [3, 4],
        [6, 8],
        [5, 12],
        [8, 15],
      ]
      const [magX, magY] = triples[rand(0, difficulty === 1 ? 1 : 3)]
      const x = rand(0, 1) === 0 ? magX : -magX
      const y = rand(0, 1) === 0 ? magY : -magY
      const magnitude = Math.sqrt(x * x + y * y)
      return {
        prompt: `Find the unit vector in the direction of ⟨${x}, ${y}⟩.`,
        parameters: { x, y },
        answer: `⟨${x}/${magnitude}, ${y}/${magnitude}⟩`,
        distractors: [
          `⟨${magnitude}/${x}, ${magnitude}/${y}⟩`,
          `⟨${x}/${x * x + y * y}, ${y}/${x * x + y * y}⟩`,
          `⟨${x}, ${y}⟩`,
          `⟨${x}/${Math.abs(x) + Math.abs(y)}, ${y}/${Math.abs(x) + Math.abs(y)}⟩`,
        ],
        solutionSteps: [
          `A unit vector has magnitude 1 and points the same way as the original.`,
          `The magnitude of ⟨${x}, ${y}⟩ is √(${x * x} + ${y * y}) = ${magnitude}.`,
          `Divide each component by that magnitude: ⟨${x}/${magnitude}, ${y}/${magnitude}⟩.`,
          `Check: (${x}/${magnitude})² + (${y}/${magnitude})² = ${x * x + y * y}/${magnitude * magnitude} = 1.`,
        ],
        commonErrors: [
          {
            observed: 'Divided by the sum of the components rather than by the magnitude.',
            likelyCause: 'The magnitude formula was replaced with a simpler sum.',
            remediation:
              'Verify the candidate by computing its magnitude; only division by the true magnitude gives 1.',
          },
        ],
      }
    },
    oracle: ({ x, y }) => {
      const magnitude = Math.sqrt(x * x + y * y)
      return `⟨${x}/${magnitude}, ${y}/${magnitude}⟩`
    },
    referenceExample: {
      prompt: 'Unit vector in the direction of ⟨3, 4⟩?',
      steps: ['Magnitude 5.', 'Divide: ⟨3/5, 4/5⟩.'],
      answer: '⟨3/5, 4/5⟩',
    },
  }),
])
