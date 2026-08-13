import { fraction, makeHsUnitBank, nonZero, numericDistractors, polynomial, rand, renderRadical, simplifyRadical, spec } from './core.ts'

/** Grade 9 Unit 5 — Quadratic Expressions and Equations (A-SSE.3, A-REI.4). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)
const rootLabel = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)

export const GRADE9_UNIT5 = makeHsUnitBank(9, 5, [
  spec<{ r: number; s: number }>({
    itemType: 'solve-quadratic-by-factoring',
    standard: 'A-REI.4',
    lessonFocus: 'solving quadratics by factoring and the zero product property',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 10 : difficulty === 2 ? 7 : 4
      const r = nonZero(bound)
      let s = nonZero(bound)
      if (s === r) s = r > 0 ? r + 1 : r - 1
      const b = -(r + s)
      const c = r * s
      const [low, high] = r < s ? [r, s] : [s, r]
      return {
        prompt: `Solve by factoring: ${polynomial([1, b, c])} = 0.`,
        parameters: { r, s },
        answer: `x = ${low} or x = ${high}`,
        distractors: [
          `x = ${-low} or x = ${-high}`,
          `x = ${low} or x = ${-high}`,
          `x = ${low + 1} or x = ${high}`,
          `x = ${b} or x = ${c}`,
          `x = ${low} or x = ${high + 1}`,
        ],
        solutionSteps: [
          `Find two numbers whose product is ${c} and whose sum is ${b}: ${-r} and ${-s}.`,
          `Factor: (x ${rootLabel(r)})(x ${rootLabel(s)}) = 0.`,
          `The zero product property says a product is zero only when a factor is zero.`,
          `Setting each factor to zero gives x = ${low} or x = ${high}.`,
        ],
        commonErrors: [
          {
            observed: 'Read the roots straight off the factors without changing sign.',
            likelyCause: 'The factor (x − r) was read as the root −r.',
            remediation:
              'Substitute the claimed root into the factor; only the value making it zero is a solution.',
          },
        ],
      }
    },
    oracle: ({ r, s }) => {
      const [low, high] = r < s ? [r, s] : [s, r]
      return `x = ${low} or x = ${high}`
    },
    referenceExample: {
      prompt: 'Solve x² − 5x + 6 = 0.',
      steps: ['Factors: (x − 2)(x − 3) = 0.', 'Each factor zero gives x = 2 or x = 3.'],
      answer: 'x = 2 or x = 3',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'discriminant-and-root-nature',
    standard: 'A-REI.4',
    lessonFocus: 'using the discriminant to describe the roots',
    build: (difficulty) => {
      const a = nonZero(difficulty === 3 ? 5 : 3, 1)
      const b = nonZero(difficulty === 3 ? 11 : 7)
      const c = nonZero(difficulty === 3 ? 11 : 7)
      const discriminant = b * b - 4 * a * c
      const isSquare = discriminant >= 0 && Number.isInteger(Math.sqrt(discriminant))
      const answer =
        discriminant < 0
          ? 'no real roots (two complex conjugate roots)'
          : discriminant === 0
            ? 'exactly one real root (a repeated root)'
            : isSquare
              ? 'two distinct rational roots'
              : 'two distinct irrational roots'
      return {
        prompt: `Without solving, describe the roots of ${polynomial([a, b, c])} = 0.`,
        parameters: { a, b, c },
        answer,
        distractors: [
          'no real roots (two complex conjugate roots)',
          'exactly one real root (a repeated root)',
          'two distinct rational roots',
          'two distinct irrational roots',
        ].filter((value) => value !== answer),
        solutionSteps: [
          `The discriminant is b² − 4ac with a = ${a}, b = ${b}, c = ${c}.`,
          `b² − 4ac = ${b * b} − 4(${a})(${c}) = ${discriminant}.`,
          discriminant < 0
            ? 'A negative discriminant means the parabola never meets the x-axis, so there are no real roots.'
            : discriminant === 0
              ? 'A zero discriminant means the vertex sits on the x-axis, giving one repeated root.'
              : isSquare
                ? `${discriminant} is a perfect square, so the two real roots are rational.`
                : `${discriminant} is positive but not a perfect square, so the two real roots are irrational.`,
          `The roots are: ${answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Computed b² − 4ac but ignored whether it was a perfect square.',
            likelyCause: 'Only the sign of the discriminant was considered.',
            remediation:
              'Distinguish two questions: how many real roots (sign) and what kind of number they are (perfect square or not).',
          },
        ],
      }
    },
    oracle: ({ a, b, c }) => {
      const discriminant = b * b - 4 * a * c
      if (discriminant < 0) return 'no real roots (two complex conjugate roots)'
      if (discriminant === 0) return 'exactly one real root (a repeated root)'
      const root = Math.sqrt(discriminant)
      return Number.isInteger(root)
        ? 'two distinct rational roots'
        : 'two distinct irrational roots'
    },
    referenceExample: {
      prompt: 'Describe the roots of x² + 2x + 5 = 0.',
      steps: ['b² − 4ac = 4 − 20 = −16.', 'Negative, so there are no real roots.'],
      answer: 'no real roots',
    },
  }),

  spec<{ h: number; k: number }>({
    itemType: 'complete-the-square-to-vertex-form',
    standard: 'A-SSE.3',
    lessonFocus: 'completing the square to reveal the vertex',
    build: (difficulty) => {
      const h = nonZero(difficulty === 3 ? 9 : 5)
      const k = nonZero(difficulty === 3 ? 14 : 8)
      const b = -2 * h
      const c = h * h + k
      return {
        prompt: `Rewrite ${polynomial([1, b, c])} in vertex form and state the vertex.`,
        parameters: { h, k },
        answer: `(x ${rootLabel(h)})² ${signed(k)}; vertex (${h}, ${k})`,
        distractors: [
          `(x ${rootLabel(-h)})² ${signed(k)}; vertex (${-h}, ${k})`,
          `(x ${rootLabel(h)})² ${signed(-k)}; vertex (${h}, ${-k})`,
          `(x ${rootLabel(h)})² ${signed(c)}; vertex (${h}, ${c})`,
          `(x ${rootLabel(h + 1)})² ${signed(k)}; vertex (${h + 1}, ${k})`,
        ],
        solutionSteps: [
          `Take half the coefficient of x: ${b} ÷ 2 = ${-h}, and square it: ${h * h}.`,
          `Write ${polynomial([1, b, c])} = (x² ${signed(b)}x + ${h * h}) ${signed(c - h * h)}.`,
          `The bracket is a perfect square: (x ${rootLabel(h)})².`,
          `So the vertex form is (x ${rootLabel(h)})² ${signed(k)}, and the vertex is (${h}, ${k}).`,
        ],
        commonErrors: [
          {
            observed: `Gave the vertex as (${-h}, ${k}), with the x-coordinate sign flipped.`,
            likelyCause: 'The constant inside the bracket was read directly as the vertex coordinate.',
            remediation:
              'Vertex form is (x − h)²; ask what value of x makes the bracket zero, and that is h.',
          },
        ],
      }
    },
    oracle: ({ h, k }) => {
      const label = h < 0 ? `+ ${-h}` : `− ${h}`
      const constant = k < 0 ? `− ${-k}` : `+ ${k}`
      return `(x ${label})² ${constant}; vertex (${h}, ${k})`
    },
    referenceExample: {
      prompt: 'Write x² − 6x + 11 in vertex form.',
      steps: ['Half of −6 is −3; (−3)² = 9.', 'x² − 6x + 9 + 2 = (x − 3)² + 2.', 'Vertex (3, 2).'],
      answer: '(x − 3)² + 2; vertex (3, 2)',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'quadratic-formula-exact-roots',
    standard: 'A-REI.4',
    lessonFocus: 'applying the quadratic formula and leaving exact form',
    build: (difficulty) => {
      // Choose a positive non-square discriminant so the exact answer is a surd.
      const a = rand(1, difficulty === 3 ? 3 : 2)
      const b = nonZero(difficulty === 3 ? 9 : 6)
      let c = nonZero(6)
      let discriminant = b * b - 4 * a * c
      let guard = 0
      while ((discriminant <= 0 || Number.isInteger(Math.sqrt(discriminant))) && guard < 40) {
        c -= 1
        discriminant = b * b - 4 * a * c
        guard += 1
      }
      const simplified = simplifyRadical(discriminant)
      const surd = renderRadical(simplified.outside, simplified.inside)
      return {
        prompt: `Use the quadratic formula to solve ${polynomial([a, b, c])} = 0. Give exact values.`,
        parameters: { a, b, c },
        answer: `x = (${-b} ± ${surd}) / ${2 * a}`,
        distractors: [
          `x = (${b} ± ${surd}) / ${2 * a}`,
          `x = (${-b} ± ${surd}) / ${a}`,
          `x = (${-b} ± ${renderRadical(1, discriminant)}) / ${2 * a}`,
          `x = (${-b} ± ${surd}) / ${2 * a + 1}`,
        ],
        solutionSteps: [
          `With a = ${a}, b = ${b}, c = ${c}, the discriminant is ${b}² − 4(${a})(${c}) = ${discriminant}.`,
          `Simplify the radical: √${discriminant} = ${surd}.`,
          `Apply x = (−b ± √(b² − 4ac)) / (2a): x = (${-b} ± ${surd}) / ${2 * a}.`,
          `Because ${discriminant} is not a perfect square, this exact form cannot be simplified to integers.`,
        ],
        commonErrors: [
          {
            observed: `Wrote ${b} instead of ${-b} in the numerator.`,
            likelyCause: 'The negation of b in the formula was dropped.',
            remediation:
              'Write −b as its own step with the sign substituted before assembling the fraction.',
          },
        ],
      }
    },
    oracle: ({ a, b, c }) => {
      const discriminant = b * b - 4 * a * c
      let outside = 1
      let inside = discriminant
      for (let factor = 2; factor * factor <= inside; factor += 1) {
        while (inside % (factor * factor) === 0) {
          inside /= factor * factor
          outside *= factor
        }
      }
      const surd = inside === 1 ? String(outside) : outside === 1 ? `√${inside}` : `${outside}√${inside}`
      return `x = (${-b} ± ${surd}) / ${2 * a}`
    },
    referenceExample: {
      prompt: 'Solve x² + 3x + 1 = 0 exactly.',
      steps: ['Discriminant 9 − 4 = 5.', 'x = (−3 ± √5)/2.'],
      answer: 'x = (−3 ± √5) / 2',
    },
  }),

  spec<{ r: number; s: number; want: number }>({
    itemType: 'interpret-quadratic-form-choice',
    standard: 'A-SSE.3',
    lessonFocus: 'choosing the form of a quadratic that reveals a required feature',
    build: () => {
      const r = nonZero(6)
      let s = nonZero(6)
      if (s === r) s = r + 1
      const want = rand(0, 2)
      const wanted = ['the x-intercepts', 'the vertex', 'the y-intercept']
      const answers = ['factored form', 'vertex form', 'standard form']
      return {
        prompt: `You need to read off ${wanted[want]} of a quadratic function directly, without further calculation. Which form should you write it in?`,
        parameters: { r, s, want },
        answer: answers[want],
        distractors: answers.filter((_, index) => index !== want).concat(['recursive form']),
        solutionSteps: [
          `Each algebraic form of a quadratic exposes one feature without extra work.`,
          want === 0
            ? 'Factored form a(x − r)(x − s) shows the zeros directly, since a product is zero exactly when a factor is.'
            : want === 1
              ? 'Vertex form a(x − h)² + k shows the vertex (h, k) directly, since the squared term is smallest at x = h.'
              : 'Standard form ax² + bx + c shows the y-intercept directly, since substituting x = 0 leaves c.',
          `So use ${answers[want]}.`,
        ],
        commonErrors: [
          {
            observed: 'Chose the form that was most familiar rather than the one exposing the feature.',
            likelyCause: 'The forms were treated as interchangeable notation.',
            remediation:
              'For each form, ask which single value can be read without any computation; that is what the form is for.',
          },
        ],
      }
    },
    oracle: ({ want }) => ['factored form', 'vertex form', 'standard form'][want],
    referenceExample: {
      prompt: 'Which form shows the zeros of a quadratic immediately?',
      steps: ['A product is zero exactly when one factor is zero.', 'Factored form exposes that.'],
      answer: 'factored form',
    },
  }),
])
