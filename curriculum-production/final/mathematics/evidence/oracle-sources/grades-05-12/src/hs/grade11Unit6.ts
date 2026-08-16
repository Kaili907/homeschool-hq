import { fraction, makeHsUnitBank, nonZero, numericDistractors, polynomial, rand, spec } from './core.ts'

/** Grade 11 Unit 6 — Advanced Function Analysis and Graphing (F-IF.7, 8, 9). */

const sign = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)

export const GRADE11_UNIT6 = makeHsUnitBank(11, 6, [
  spec<{ r: number; s: number }>({
    itemType: 'rational-function-asymptotes',
    standard: 'F-IF.7',
    lessonFocus: 'graphing rational functions using asymptotes',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const r = nonZero(bound)
      let s = nonZero(bound)
      if (s === r) s = r > 0 ? r + 1 : r - 1
      return {
        prompt: `For f(x) = (x ${sign(r)}) / (x ${sign(s)}), state the vertical asymptote and the horizontal asymptote.`,
        parameters: { r, s },
        answer: `vertical x = ${s}; horizontal y = 1`,
        distractors: [
          `vertical x = ${r}; horizontal y = 1`,
          `vertical x = ${s}; horizontal y = 0`,
          `vertical x = ${s}; horizontal y = ${fraction(r, s)}`,
          `vertical x = ${-s}; horizontal y = 1`,
        ],
        solutionSteps: [
          `A vertical asymptote occurs where the denominator is zero and the numerator is not: x ${sign(s)} = 0 gives x = ${s}.`,
          `Check the numerator there: at x = ${s} it equals ${s - r}, which is non-zero, so the asymptote is genuine rather than a hole.`,
          `For the horizontal asymptote, compare degrees: numerator and denominator are both degree 1.`,
          `With equal degrees the horizontal asymptote is the ratio of leading coefficients, 1/1, so y = 1.`,
        ],
        commonErrors: [
          {
            observed: 'Gave the horizontal asymptote as y = 0.',
            likelyCause: 'The rule for a numerator of lower degree was applied to equal degrees.',
            remediation:
              'Compare the two degrees explicitly before choosing which asymptote rule applies.',
          },
        ],
      }
    },
    oracle: ({ s }) => `vertical x = ${s}; horizontal y = 1`,
    referenceExample: {
      prompt: 'Asymptotes of (x + 1)/(x − 3)?',
      steps: ['Denominator zero at x = 3.', 'Equal degrees give y = 1.'],
      answer: 'vertical x = 3; horizontal y = 1',
    },
  }),

  spec<{ h: number; k: number; a: number; otherMax: number }>({
    itemType: 'compare-functions-across-representations',
    standard: 'F-IF.9',
    lessonFocus: 'comparing functions given in different representations',
    build: (difficulty) => {
      const h = nonZero(difficulty === 3 ? 6 : 4)
      const k = nonZero(difficulty === 3 ? 10 : 6)
      const a = rand(1, 3)
      // g is always the larger, so the comparison has a single stable answer.
      const otherMax = k + rand(1, 5)
      return {
        prompt: `Function f is given in vertex form as f(x) = −${a === 1 ? '' : a}(x ${sign(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}, so it opens downward. Function g is given by a table whose greatest output is ${otherMax}. Which function has the greater maximum, and by how much?`,
        parameters: { h, k, a, otherMax },
        answer: `g, by ${otherMax - k}`,
        distractors: numericDistractors(otherMax - k, [otherMax + k, k, otherMax, otherMax - k + 1])
          .map((value) => `g, by ${value}`)
          .concat([`f, by ${otherMax - k}`]),
        solutionSteps: [
          `f is in vertex form, so its vertex is (${h}, ${k}).`,
          `The negative leading coefficient makes the parabola open downward, so the vertex is a maximum: f has maximum ${k}.`,
          `g is given as a table, and its greatest listed output is ${otherMax}.`,
          `Comparing the two maxima: ${otherMax} − ${k} = ${otherMax - k}, so g is greater by ${otherMax - k}.`,
          `The point of the task is that each representation had to be read differently before the two numbers could be compared.`,
        ],
        commonErrors: [
          {
            observed: 'Compared the two functions at a shared input rather than at their maxima.',
            likelyCause: 'The question was read as a pointwise comparison.',
            remediation:
              'Extract the requested feature from each representation first, then compare only those two numbers.',
          },
        ],
      }
    },
    oracle: ({ k, otherMax }) => `g, by ${otherMax - k}`,
    referenceExample: {
      prompt: 'f has vertex (2, 7) opening down; g has max 10. Which is greater?',
      steps: ['f max is 7.', 'g max is 10.', 'g is greater by 3.'],
      answer: 'g, by 3',
    },
  }),

  spec<{ a: number; h: number; k: number }>({
    itemType: 'interpret-completed-square-form',
    standard: 'F-IF.8',
    lessonFocus: 'using algebraic form to reveal function properties',
    build: (difficulty) => {
      const a = rand(1, difficulty === 3 ? 4 : 2)
      const h = nonZero(difficulty === 3 ? 7 : 4)
      const k = nonZero(difficulty === 3 ? 12 : 7)
      return {
        prompt: `The function f(x) = ${a === 1 ? '' : a}(x ${sign(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)} opens upward. State its minimum value and where it occurs.`,
        parameters: { a, h, k },
        answer: `minimum ${k} at x = ${h}`,
        distractors: [
          `minimum ${k} at x = ${-h}`,
          `minimum ${-k} at x = ${h}`,
          `minimum ${h} at x = ${k}`,
          `minimum ${k + a} at x = ${h}`,
          // h = k and h = −k collapse several of the near-misses above.
          `minimum ${k + 1} at x = ${h}`,
          `minimum ${k} at x = ${h + 1}`,
          `minimum ${k - 1} at x = ${h}`,
        ],
        solutionSteps: [
          `The squared term (x ${sign(h)})² is never negative, and it equals zero exactly when x = ${h}.`,
          `Since ${a === 1 ? 'the coefficient is positive' : `the coefficient ${a} is positive`}, the whole term is smallest at that point.`,
          `Substituting x = ${h} leaves f(${h}) = ${k}.`,
          `So the minimum value is ${k}, attained at x = ${h}.`,
        ],
        commonErrors: [
          {
            observed: `Gave the location as x = ${-h}.`,
            likelyCause: 'The sign inside the bracket was read directly as the x-coordinate.',
            remediation:
              'Solve (x − h) = 0 explicitly rather than reading h off by inspection.',
          },
        ],
      }
    },
    oracle: ({ h, k }) => `minimum ${k} at x = ${h}`,
    referenceExample: {
      prompt: 'Minimum of f(x) = 2(x − 3)² + 4?',
      steps: ['Square is zero at x = 3.', 'f(3) = 4.'],
      answer: 'minimum 4 at x = 3',
    },
  }),

  spec<{ degree: number; leading: number }>({
    itemType: 'polynomial-end-behaviour',
    standard: 'F-IF.7',
    lessonFocus: 'end behaviour of polynomial graphs',
    build: () => {
      const degree = rand(2, 5)
      const leading = nonZero(6)
      const even = degree % 2 === 0
      const positive = leading > 0
      const answer =
        even && positive
          ? 'both ends rise'
          : even && !positive
            ? 'both ends fall'
            : !even && positive
              ? 'the left end falls and the right end rises'
              : 'the left end rises and the right end falls'
      return {
        prompt: `A polynomial has degree ${degree} and leading coefficient ${leading}. Describe its end behaviour.`,
        parameters: { degree, leading },
        answer,
        distractors: [
          'both ends rise',
          'both ends fall',
          'the left end falls and the right end rises',
          'the left end rises and the right end falls',
        ].filter((value) => value !== answer),
        solutionSteps: [
          `For large |x| the leading term dominates every other term, so end behaviour depends only on degree and leading coefficient.`,
          `The degree ${degree} is ${even ? 'even, so both ends go the same way' : 'odd, so the two ends go opposite ways'}.`,
          `The leading coefficient ${leading} is ${positive ? 'positive, so the right end rises' : 'negative, so the right end falls'}.`,
          `Combining these: ${answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Used the constant term or the number of turning points to decide.',
            likelyCause: 'End behaviour was confused with local features of the graph.',
            remediation:
              'Evaluate the polynomial at a large positive and a large negative input and compare the signs.',
          },
        ],
      }
    },
    oracle: ({ degree, leading }) => {
      const even = degree % 2 === 0
      const positive = leading > 0
      if (even) return positive ? 'both ends rise' : 'both ends fall'
      return positive
        ? 'the left end falls and the right end rises'
        : 'the left end rises and the right end falls'
    },
    referenceExample: {
      prompt: 'Degree 3, leading coefficient −2. End behaviour?',
      steps: ['Odd degree: ends go opposite ways.', 'Negative leading: right end falls.'],
      answer: 'left rises, right falls',
    },
  }),
])
