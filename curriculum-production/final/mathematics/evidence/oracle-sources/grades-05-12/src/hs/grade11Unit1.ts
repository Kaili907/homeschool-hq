import { makeHsUnitBank, nonZero, numericDistractors, polynomial, rand, spec } from './core.ts'

/** Grade 11 Unit 1 — Polynomial Arithmetic, Identities, and Zeros (A-APR.1-4). */

const sign = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)

export const GRADE11_UNIT1 = makeHsUnitBank(11, 1, [
  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'multiply-polynomials',
    standard: 'A-APR.1',
    lessonFocus: 'closure of polynomials under multiplication',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      const d = nonZero(bound)
      return {
        prompt: `Expand and simplify: (${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)})(${c}x ${d < 0 ? '−' : '+'} ${Math.abs(d)}).`,
        parameters: { a, b, c, d },
        answer: polynomial([a * c, a * d + b * c, b * d]),
        distractors: [
          polynomial([a * c, b * d, 0]).replace(/ \+ 0$/, ''),
          polynomial([a * c, a * d - b * c, b * d]),
          polynomial([a + c, a * d + b * c, b + d]),
          polynomial([a * c, a * d + b * c, b * d + 1]),
        ],
        solutionSteps: [
          `Multiply each term of the first bracket by each term of the second.`,
          `First terms: ${a}x × ${c}x = ${a * c}x². Outer and inner: ${a}x × ${d} = ${a * d}x and ${b} × ${c}x = ${b * c}x.`,
          `Last terms: ${b} × ${d} = ${b * d}.`,
          `Collect the x terms: ${a * d}x ${b * c < 0 ? '−' : '+'} ${Math.abs(b * c)}x = ${a * d + b * c}x, giving ${polynomial([a * c, a * d + b * c, b * d])}.`,
        ],
        commonErrors: [
          {
            observed: 'Multiplied only the first and last terms of each bracket.',
            likelyCause: 'The two cross terms were omitted.',
            remediation:
              'Check the degree-1 coefficient by substituting x = 1 into both the factored and expanded forms.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d }) => polynomial([a * c, a * d + b * c, b * d]),
    referenceExample: {
      prompt: 'Expand (2x + 3)(x − 5).',
      steps: ['2x² − 10x + 3x − 15.', 'Collect: 2x² − 7x − 15.'],
      answer: '2x² − 7x − 15',
    },
  }),

  spec<{ a: number; b: number; c: number; r: number }>({
    itemType: 'remainder-theorem',
    standard: 'A-APR.2',
    lessonFocus: 'the remainder theorem',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      const r = nonZero(difficulty === 3 ? 5 : 3)
      const remainder = a * r * r + b * r + c
      return {
        prompt: `Find the remainder when ${polynomial([a, b, c])} is divided by (x ${sign(r)}).`,
        parameters: { a, b, c, r },
        answer: String(remainder),
        distractors: numericDistractors(remainder, [
          a * r * r + b * r - c,
          a * (-r) * (-r) + b * -r + c,
          a + b + c,
          remainder + r,
        ]),
        solutionSteps: [
          `The remainder theorem says the remainder on division by (x − r) is p(r).`,
          `Here the divisor is (x ${sign(r)}), so r = ${r}.`,
          `Evaluate: p(${r}) = ${a}(${r})² ${b < 0 ? '−' : '+'} ${Math.abs(b)}(${r}) ${c < 0 ? '−' : '+'} ${Math.abs(c)} = ${remainder}.`,
          `The remainder is ${remainder}. No long division is required.`,
        ],
        commonErrors: [
          {
            observed: `Substituted ${-r} instead of ${r}.`,
            likelyCause: 'The sign of the root was taken directly from the divisor.',
            remediation:
              'Set the divisor equal to zero and solve for x; that value is what gets substituted.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, r }) => String(a * r ** 2 + b * r + c),
    referenceExample: {
      prompt: 'Remainder when x² + 2x − 3 is divided by (x − 2)?',
      steps: ['Evaluate at x = 2.', '4 + 4 − 3 = 5.'],
      answer: '5',
    },
  }),

  spec<{ r: number; s: number; t: number }>({
    itemType: 'zeros-and-factored-form',
    standard: 'A-APR.3',
    lessonFocus: 'using zeros to construct a rough graph of a polynomial',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 6 : 4
      const r = nonZero(bound)
      let s = nonZero(bound)
      let t = nonZero(bound)
      if (s === r) s = r > 0 ? r + 1 : r - 1
      if (t === r || t === s) t = Math.max(r, s) + 1
      const sorted = [r, s, t].sort((x, y) => x - y)
      return {
        prompt: `A cubic polynomial factors as (x ${sign(r)})(x ${sign(s)})(x ${sign(t)}). List its zeros in increasing order.`,
        parameters: { r, s, t },
        answer: sorted.join(', '),
        distractors: [
          [-r, -s, -t].sort((x, y) => x - y).join(', '),
          [r, s, t].join(', ') === sorted.join(', ') ? `${sorted[0]}, ${sorted[2]}, ${sorted[1]}` : [r, s, t].join(', '),
          sorted.map((value) => value + 1).join(', '),
          sorted.slice().reverse().join(', '),
        ],
        solutionSteps: [
          `A product is zero exactly when one of its factors is zero.`,
          `Set each factor to zero: x ${sign(r)} = 0 gives x = ${r}; similarly x = ${s} and x = ${t}.`,
          `In increasing order the zeros are ${sorted.join(', ')}.`,
          `Between consecutive zeros the graph stays on one side of the x-axis, which is what makes these values enough for a rough sketch.`,
        ],
        commonErrors: [
          {
            observed: 'Read the constants in the factors as the zeros without changing sign.',
            likelyCause: 'The factor (x − r) was read as the zero −r.',
            remediation:
              'Substitute each candidate back into the factor; only the value giving zero is a root.',
          },
        ],
      }
    },
    oracle: ({ r, s, t }) => [r, s, t].sort((x, y) => x - y).join(', '),
    referenceExample: {
      prompt: 'Zeros of (x − 1)(x + 2)(x − 4)?',
      steps: ['Each factor zero gives a root.', 'x = 1, −2, 4; sorted: −2, 1, 4.'],
      answer: '−2, 1, 4',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'polynomial-identity',
    standard: 'A-APR.4',
    lessonFocus: 'proving and using polynomial identities',
    build: (difficulty) => {
      const a = rand(2, difficulty === 3 ? 9 : 5)
      const b = rand(2, difficulty === 3 ? 9 : 5)
      return {
        prompt: `Use the identity (x² + y²)² = (x² − y²)² + (2xy)² with x = ${a} and y = ${b} to generate a Pythagorean triple. Give the triple in increasing order.`,
        parameters: { a, b },
        answer: [Math.abs(a * a - b * b), 2 * a * b, a * a + b * b].sort((p, q) => p - q).join(', '),
        distractors: [
          [a * a - b * b, a * b, a * a + b * b].sort((p, q) => p - q).join(', '),
          [a, b, a + b].sort((p, q) => p - q).join(', '),
          [Math.abs(a * a - b * b), 2 * a * b, a * a - b * b].sort((p, q) => p - q).join(', '),
          [a * a, b * b, a * a + b * b].sort((p, q) => p - q).join(', '),
        ],
        solutionSteps: [
          `The identity says that x² − y², 2xy, and x² + y² satisfy the Pythagorean relation for any x and y.`,
          `With x = ${a} and y = ${b}: x² − y² = ${a * a} − ${b * b} = ${a * a - b * b}, 2xy = ${2 * a * b}, x² + y² = ${a * a + b * b}.`,
          `Check: ${Math.abs(a * a - b * b)}² + ${2 * a * b}² = ${(a * a - b * b) ** 2} + ${(2 * a * b) ** 2} = ${(a * a - b * b) ** 2 + (2 * a * b) ** 2}, and ${a * a + b * b}² = ${(a * a + b * b) ** 2}. They agree.`,
          `In increasing order the triple is ${[Math.abs(a * a - b * b), 2 * a * b, a * a + b * b].sort((p, q) => p - q).join(', ')}.`,
        ],
        commonErrors: [
          {
            observed: 'Used xy instead of 2xy for the middle term.',
            likelyCause: 'The factor of 2 in the identity was dropped.',
            remediation:
              'Verify the candidate triple by squaring; a dropped factor fails the check immediately.',
          },
        ],
      }
    },
    oracle: ({ a, b }) =>
      [Math.abs(a * a - b * b), 2 * a * b, a * a + b * b].sort((p, q) => p - q).join(', '),
    referenceExample: {
      prompt: 'Use x = 2, y = 1 to build a triple.',
      steps: ['x² − y² = 3, 2xy = 4, x² + y² = 5.', 'Triple: 3, 4, 5.'],
      answer: '3, 4, 5',
    },
  }),
])
