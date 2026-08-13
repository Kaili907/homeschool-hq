import { fraction, makeHsUnitBank, nonZero, numericDistractors, polynomial, rand, spec } from './core.ts'

/** Grade 11 Unit 2 — Rational and Radical Expressions and Equations (A-APR.6, A-REI.2). */

const sign = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)

export const GRADE11_UNIT2 = makeHsUnitBank(11, 2, [
  spec<{ r: number; s: number }>({
    itemType: 'simplify-rational-expression',
    standard: 'A-APR.6',
    lessonFocus: 'simplifying rational expressions and stating restrictions',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const r = nonZero(bound)
      let s = nonZero(bound)
      if (s === r) s = r > 0 ? r + 1 : r - 1
      return {
        prompt: `Simplify (${polynomial([1, -(r + s), r * s])}) / (x ${sign(s)}), and state the restriction on x.`,
        parameters: { r, s },
        answer: `x ${sign(r)}, x ≠ ${s}`,
        distractors: [
          `x ${sign(r)}, x ≠ ${r}`,
          `x ${sign(s)}, x ≠ ${s}`,
          `x ${sign(-r)}, x ≠ ${s}`,
          `x ${sign(r)} with no restriction`,
        ],
        solutionSteps: [
          `Factor the numerator: ${polynomial([1, -(r + s), r * s])} = (x ${sign(r)})(x ${sign(s)}).`,
          `The factor (x ${sign(s)}) is common to numerator and denominator, so it cancels.`,
          `The simplified expression is x ${sign(r)}.`,
          `Cancelling is only valid where the denominator was non-zero, so x ≠ ${s} must be carried forward as a restriction.`,
        ],
        commonErrors: [
          {
            observed: 'Cancelled correctly but omitted the restriction.',
            likelyCause: 'The simplified form was treated as equivalent everywhere.',
            remediation:
              'Evaluate both the original and the simplified expression at the excluded value; only one is defined.',
          },
        ],
      }
    },
    oracle: ({ r, s }) => {
      const inner = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)
      return `x ${inner(r)}, x ≠ ${s}`
    },
    referenceExample: {
      prompt: 'Simplify (x² − 5x + 6)/(x − 2).',
      steps: ['Numerator factors as (x − 2)(x − 3).', 'Cancel (x − 2): x − 3, x ≠ 2.'],
      answer: 'x − 3, x ≠ 2',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'solve-radical-equation-with-check',
    standard: 'A-REI.2',
    lessonFocus: 'solving radical equations and rejecting extraneous roots',
    build: (difficulty) => {
      const root = rand(2, difficulty === 3 ? 9 : 5)
      const a = rand(1, difficulty === 3 ? 5 : 3)
      const c = rand(1, difficulty === 3 ? 8 : 4)
      // √(a x + b) = root  with  b chosen so x is a positive integer.
      const x = rand(2, difficulty === 3 ? 12 : 7)
      const b = root * root - a * x
      return {
        prompt: `Solve √(${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}) = ${root}, then verify the solution.`,
        parameters: { a, b, c: root },
        answer: `x = ${x}`,
        distractors: numericDistractors(x, [x + root, root * root, x - 1, a * x]).map(
          (value) => `x = ${value}`,
        ),
        solutionSteps: [
          `Square both sides: ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${root * root}.`,
          `Solve the linear equation: ${a}x = ${root * root - b}, so x = ${x}.`,
          `Squaring can introduce extraneous roots, so substitute back: √(${a}(${x}) ${b < 0 ? '−' : '+'} ${Math.abs(b)}) = √${root * root} = ${root}.`,
          `The check succeeds, so x = ${x} is a genuine solution.`,
        ],
        commonErrors: [
          {
            observed: 'Solved correctly but skipped the verification step.',
            likelyCause: 'Squaring was treated as a reversible operation.',
            remediation:
              'Make substitution back into the original radical equation a required final line of the solution.',
          },
        ],
      }
    },
    oracle: ({ a, b, c }) => `x = ${(c * c - b) / a}`,
    referenceExample: {
      prompt: 'Solve √(2x + 3) = 5.',
      steps: ['Square: 2x + 3 = 25.', '2x = 22, x = 11.', 'Check: √25 = 5. ✓'],
      answer: 'x = 11',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'add-rational-expressions',
    standard: 'A-APR.6',
    lessonFocus: 'adding rational expressions with unlike denominators',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 7 : 4
      const a = nonZero(bound)
      const b = nonZero(bound)
      let c = nonZero(bound)
      if (c === b) c = b > 0 ? b + 1 : b - 1
      const d = nonZero(bound)
      return {
        prompt: `Write as a single fraction: ${a}/(x ${sign(b)}) + ${d}/(x ${sign(c)}).`,
        parameters: { a, b, c, d },
        answer: `(${a + d}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}) / ((x ${sign(b)})(x ${sign(c)}))`,
        distractors: [
          `(${a + d}) / ((x ${sign(b)})(x ${sign(c)}))`,
          `(${a + d}x ${(a * c + d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}) / ((x ${sign(b)})(x ${sign(c)}))`,
          `(${a * d}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}) / ((x ${sign(b)})(x ${sign(c)}))`,
          `(${a + d}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}) / (x ${sign(b)} ${sign(c)})`,
          // a + d = 0 or ac + db = 0 collapses several of the near-misses above.
          `(${a + d + 1}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}) / ((x ${sign(b)})(x ${sign(c)}))`,
          `(${a + d}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b) + 1}) / ((x ${sign(b)})(x ${sign(c)}))`,
          `(${a + d - 1}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}) / ((x ${sign(b)})(x ${sign(c)}))`,
        ],
        solutionSteps: [
          `The denominators share no common factor, so the common denominator is their product (x ${sign(b)})(x ${sign(c)}).`,
          `Rewrite each fraction: ${a}(x ${sign(c)}) and ${d}(x ${sign(b)}) over that denominator.`,
          `Expand the numerator: ${a}x ${(-a * c) < 0 ? '−' : '+'} ${Math.abs(a * c)} ${d < 0 ? '−' : '+'} ${Math.abs(d)}x ${(-d * b) < 0 ? '−' : '+'} ${Math.abs(d * b)}.`,
          `Collect like terms: ${a + d}x ${(-a * c - d * b) < 0 ? '−' : '+'} ${Math.abs(a * c + d * b)}, over the common denominator.`,
        ],
        commonErrors: [
          {
            observed: 'Added the numerators without rewriting over a common denominator.',
            likelyCause: 'The rule for adding fractions with like denominators was applied to unlike ones.',
            remediation:
              'Test the claim numerically at a convenient x value; the shortcut fails immediately.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d }) => {
      const inner = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)
      const constant = -a * c - d * b
      return `(${a + d}x ${constant < 0 ? '−' : '+'} ${Math.abs(constant)}) / ((x ${inner(b)})(x ${inner(c)}))`
    },
    referenceExample: {
      prompt: 'Write 2/(x − 1) + 3/(x − 4) as one fraction.',
      steps: ['Common denominator (x − 1)(x − 4).', '2(x − 4) + 3(x − 1) = 5x − 11.'],
      answer: '(5x − 11)/((x − 1)(x − 4))',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'identify-extraneous-solution',
    standard: 'A-REI.2',
    lessonFocus: 'why extraneous solutions arise',
    build: (difficulty) => {
      const a = rand(2, difficulty === 3 ? 9 : 5)
      const b = rand(2, difficulty === 3 ? 9 : 5)
      return {
        prompt: `Solving a rational equation with denominator (x − ${a}) yields the candidate solutions x = ${a} and x = ${b}. Which are genuine solutions?`,
        parameters: { a, b },
        answer: `Only x = ${b}; x = ${a} makes the original denominator zero, so it is extraneous.`,
        distractors: [
          `Both x = ${a} and x = ${b} are solutions.`,
          `Only x = ${a}; x = ${b} must be rejected.`,
          `Neither is a solution, because the equation has a restricted domain.`,
          `Both are extraneous, because multiplying by a denominator always introduces false roots.`,
        ],
        solutionSteps: [
          `Multiplying both sides by (x − ${a}) is only valid when that factor is non-zero, so x = ${a} was excluded from the original domain.`,
          `The multiplication step can therefore produce a root that satisfies the cleared equation but not the original one.`,
          `Substituting x = ${a} into the original equation makes a denominator zero, so it is undefined there and cannot be a solution.`,
          `x = ${b} lies in the domain and satisfies the equation, so only x = ${b} is genuine.`,
        ],
        commonErrors: [
          {
            observed: 'Accepted every root of the cleared equation.',
            likelyCause: 'The domain restrictions were dropped once the denominators were cleared.',
            remediation:
              'Write the excluded values down before clearing denominators, and check the candidate roots against that list.',
          },
        ],
      }
    },
    oracle: ({ a, b }) =>
      `Only x = ${b}; x = ${a} makes the original denominator zero, so it is extraneous.`,
    referenceExample: {
      prompt: 'Denominator (x − 3); candidates x = 3 and x = 7. Which hold?',
      steps: ['x = 3 makes the denominator zero.', 'Only x = 7 is genuine.'],
      answer: 'Only x = 7',
    },
  }),
])
