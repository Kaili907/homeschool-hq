import { choose, fraction, gcd, makeHsUnitBank, nonZero, polynomial, rand, spec } from './core.ts'

/** Grade 9 Unit 2 — Expression Structure and Equivalence (A-SSE.1, A-SSE.2). */

export const GRADE9_UNIT2 = makeHsUnitBank(9, 2, [
  spec<{ principal: number; rate: number; part: number }>({
    itemType: 'interpret-expression-part',
    standard: 'A-SSE.1',
    lessonFocus: 'interpreting the parts of an expression in context',
    build: () => {
      const principal = rand(2, 20) * 500
      const rate = choose([3, 4, 5, 6, 8])
      const part = rand(0, 2)
      const factor = `(1 + 0.0${rate})`
      const answers = [
        `the amount invested before any interest is added`,
        `the growth factor applied once per year`,
        `the number of years the investment grows`,
      ]
      const labels = [`${principal}`, factor, `t`]
      return {
        prompt: `An investment is modelled by ${principal}${factor}^t. In this expression, what does ${labels[part]} represent?`,
        parameters: { principal, rate, part },
        answer: answers[part],
        distractors: answers
          .filter((_, index) => index !== part)
          .concat([`the total interest earned over the whole period`]),
        solutionSteps: [
          `The model has the form P(1 + r)^t, where P is a starting amount, (1 + r) is a per-period multiplier, and t counts periods.`,
          `Matching term by term: P = ${principal}, r = 0.0${rate}, and the exponent is t.`,
          `So ${labels[part]} is ${answers[part]}.`,
        ],
        commonErrors: [
          {
            observed: 'Described (1 + r) as the interest earned.',
            likelyCause: 'The multiplier was confused with the interest rate itself.',
            remediation:
              'Evaluate the factor for one year and compare it against the balance; a multiplier near 1 cannot be an amount of money.',
          },
        ],
      }
    },
    oracle: ({ part }) =>
      [
        'the amount invested before any interest is added',
        'the growth factor applied once per year',
        'the number of years the investment grows',
      ][part],
    referenceExample: {
      prompt: 'In 1200(1 + 0.05)^t, what does 1200 represent?',
      steps: ['The form is P(1 + r)^t.', 'P is the value before any growth is applied.'],
      answer: 'the starting amount',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'factor-difference-of-squares',
    standard: 'A-SSE.2',
    lessonFocus: 'using structure to factor a difference of squares',
    build: (difficulty) => {
      const a = rand(difficulty === 1 ? 1 : 2, difficulty === 3 ? 9 : 5)
      const b = rand(2, difficulty === 3 ? 12 : 8)
      const left = a === 1 ? 'x²' : `${a * a}x²`
      return {
        prompt: `Factor completely: ${left} − ${b * b}.`,
        parameters: { a, b },
        answer: `(${a === 1 ? '' : a}x − ${b})(${a === 1 ? '' : a}x + ${b})`,
        distractors: [
          `(${a === 1 ? '' : a}x − ${b})²`,
          `(${a === 1 ? '' : a}x + ${b})²`,
          `(${a === 1 ? '' : a}x − ${b * b})(${a === 1 ? '' : a}x + 1)`,
          `${a === 1 ? '' : a}(x² − ${b * b})`,
        ],
        solutionSteps: [
          `Both terms are perfect squares: ${left} = (${a === 1 ? '' : a}x)² and ${b * b} = ${b}².`,
          `The expression has the form A² − B², which factors as (A − B)(A + B).`,
          `With A = ${a === 1 ? '' : a}x and B = ${b}: (${a === 1 ? '' : a}x − ${b})(${a === 1 ? '' : a}x + ${b}).`,
        ],
        commonErrors: [
          {
            observed: `Answered (${a === 1 ? '' : a}x − ${b})².`,
            likelyCause: 'A difference of squares was confused with a perfect-square trinomial.',
            remediation:
              'Expand the proposed factorisation. A squared binomial produces a middle term; the original expression has none.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => {
      const coefficient = a === 1 ? '' : String(a)
      return `(${coefficient}x − ${b})(${coefficient}x + ${b})`
    },
    referenceExample: {
      prompt: 'Factor 9x² − 25.',
      steps: ['9x² = (3x)² and 25 = 5².', 'A² − B² = (A − B)(A + B).', '(3x − 5)(3x + 5).'],
      answer: '(3x − 5)(3x + 5)',
    },
  }),

  spec<{ r: number; s: number }>({
    itemType: 'factor-quadratic-trinomial',
    standard: 'A-SSE.2',
    lessonFocus: 'factoring a trinomial by its structure',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 11 : difficulty === 2 ? 8 : 5
      const r = nonZero(bound)
      let s = nonZero(bound)
      if (s === -r) s = r === bound ? r - 1 : r + 1
      const b = r + s
      const c = r * s
      const sign = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)
      return {
        prompt: `Factor completely: ${polynomial([1, b, c])}.`,
        parameters: { r, s },
        answer: `(x ${sign(r)})(x ${sign(s)})`,
        distractors: [
          `(x ${sign(-r)})(x ${sign(-s)})`,
          `(x ${sign(r)})(x ${sign(-s)})`,
          `(x ${sign(c)})(x ${sign(b)})`,
          `(x ${sign(r + 1)})(x ${sign(s - 1)})`,
          `(x ${sign(r + 2)})(x ${sign(s)})`,
          `(x ${sign(r)})(x ${sign(s + 2)})`,
          `(x ${sign(r - 2)})(x ${sign(s)})`,
        ],
        solutionSteps: [
          `The trinomial is x² + ${b}x + ${c} with leading coefficient 1, so look for two numbers whose product is ${c} and whose sum is ${b}.`,
          `${r} × ${s} = ${c} and ${r} + ${s} = ${b}.`,
          `The roots are x = ${r} and x = ${s}, so the factors are (x ${sign(r)})(x ${sign(s)}).`,
        ],
        commonErrors: [
          {
            observed: 'Reversed the signs inside the factors.',
            likelyCause: 'The root was copied into the factor instead of its opposite.',
            remediation:
              'Substitute the claimed root back into the original trinomial; only the correct sign gives zero.',
          },
        ],
      }
    },
    oracle: ({ r, s }) => {
      const sign = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)
      return `(x ${sign(r)})(x ${sign(s)})`
    },
    referenceExample: {
      prompt: 'Factor x² − 7x + 12.',
      steps: ['Find two numbers with product 12 and sum −7: −3 and −4.', '(x − 3)(x − 4).'],
      answer: '(x − 3)(x − 4)',
    },
  }),

  spec<{ g: number; a: number; b: number }>({
    itemType: 'factor-greatest-common-factor',
    standard: 'A-SSE.2',
    lessonFocus: 'rewriting an expression by extracting common structure',
    build: (difficulty) => {
      const g = rand(2, difficulty === 3 ? 12 : 6)
      const a = rand(2, 9)
      const b = rand(2, 9)
      return {
        prompt: `Factor out the greatest common factor: ${polynomial([g * a, g * b, 0]).replace(/ \+ 0$/, '')}.`,
        parameters: { g, a, b },
        answer: `${g}x(${a}x + ${b})`,
        distractors: [
          `${g}(${a}x² + ${b}x)`,
          `x(${g * a}x + ${g * b})`,
          `${g * a}x(x + ${b})`,
          `${g}x(${a}x + ${b}x)`,
        ],
        solutionSteps: [
          `The terms are ${g * a}x² and ${g * b}x.`,
          `The greatest common numeric factor of ${g * a} and ${g * b} is ${g * gcd(a, b) === g * gcd(a, b) ? g * gcd(a, b) : g}, and both terms contain at least one x.`,
          `Extracting ${g}x when the remaining factors share nothing further gives ${g}x(${a}x + ${b}).`,
        ],
        commonErrors: [
          {
            observed: 'Pulled out only the number, leaving an x inside both terms.',
            likelyCause: 'The variable part of the common factor was overlooked.',
            remediation:
              'List each term as a product of its factors and circle everything common to both, numbers and variables alike.',
          },
        ],
      }
    },
    oracle: ({ g, a, b }) => `${g}x(${a}x + ${b})`,
    referenceExample: {
      prompt: 'Factor 6x² + 9x.',
      steps: ['Common numeric factor 3, common variable factor x.', '3x(2x + 3).'],
      answer: '3x(2x + 3)',
    },
  }),

  spec<{ a: number; b: number; c: number; claimedConstant: number }>({
    itemType: 'equivalent-expression-check',
    standard: 'A-SSE.1',
    lessonFocus: 'deciding whether two expressions are equivalent',
    build: (difficulty) => {
      const a = rand(2, difficulty === 3 ? 9 : 5)
      const b = nonZero(difficulty === 3 ? 11 : 6)
      const c = nonZero(difficulty === 3 ? 11 : 6)
      const correctConstant = a * c
      const claimedIsRight = rand(0, 1) === 1
      const claimedConstant = claimedIsRight ? correctConstant : correctConstant + choose([-2, -1, 1, 2])
      const shown = `${a}x² ${b >= 0 ? '+' : '−'} ${Math.abs(b) * a}x`
      return {
        prompt: `A student claims that ${a}(x² ${b >= 0 ? '+' : '−'} ${Math.abs(b)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c)}) expands to ${shown} ${claimedConstant >= 0 ? '+' : '−'} ${Math.abs(claimedConstant)}. Is the claim correct?`,
        parameters: { a, b, c, claimedConstant },
        answer: claimedIsRight ? 'Yes, the expansion is correct.' : `No; the constant term should be ${correctConstant}.`,
        distractors: [
          claimedIsRight ? `No; the constant term should be ${correctConstant + 2}.` : 'Yes, the expansion is correct.',
          `No; the x term should be ${b}x.`,
          `No; the leading term should be x².`,
          `The two expressions cannot be compared without a value for x.`,
        ],
        solutionSteps: [
          `Distribute ${a} across each term: ${a}·x² = ${a}x², ${a}·(${b}x) = ${a * b}x, and ${a}·(${c}) = ${correctConstant}.`,
          `So the correct expansion has constant term ${correctConstant}.`,
          claimedIsRight
            ? `The claimed constant ${claimedConstant} matches, so the claim is correct.`
            : `The claimed constant ${claimedConstant} does not match ${correctConstant}, so the claim is wrong.`,
        ],
        commonErrors: [
          {
            observed: 'Distributed across the first two terms only.',
            likelyCause: 'The factor was not applied to the constant term.',
            remediation:
              'Check by substituting x = 0: the original and the expansion must agree, which tests the constant term directly.',
          },
        ],
      }
    },
    oracle: ({ a, c, claimedConstant }) => {
      const correct = a * c
      return claimedConstant === correct
        ? 'Yes, the expansion is correct.'
        : `No; the constant term should be ${correct}.`
    },
    referenceExample: {
      prompt: 'Does 3(x² + 2x + 4) expand to 3x² + 6x + 12?',
      steps: ['3·x² = 3x², 3·2x = 6x, 3·4 = 12.', 'All three terms match, so yes.'],
      answer: 'Yes, the expansion is correct.',
    },
  }),

  spec<{ a: number; n: number }>({
    itemType: 'recognize-substitution-structure',
    standard: 'A-SSE.2',
    lessonFocus: 'seeing an expression as a single object',
    build: (difficulty) => {
      const a = rand(2, difficulty === 3 ? 9 : 5)
      const n = choose([2, 3, 4])
      return {
        prompt: `The expression (x${a >= 0 ? ' + ' : ' − '}${Math.abs(a)})^${2 * n} − ${a * a} can be treated as a difference of squares. Which substitution makes that structure visible?`,
        parameters: { a, n },
        answer: `u = (x + ${a})^${n}`,
        distractors: [`u = x + ${a}`, `u = x^${n}`, `u = (x + ${a})^${2 * n}`, `u = ${a}x`],
        solutionSteps: [
          `A difference of squares needs the form u² − B².`,
          `Since (x + ${a})^${2 * n} = ((x + ${a})^${n})², the first term is already a square of (x + ${a})^${n}.`,
          `So the substitution u = (x + ${a})^${n} turns the expression into u² − ${a * a}, which is u² − ${Math.abs(a)}².`,
        ],
        commonErrors: [
          {
            observed: `Chose u = x + ${a}.`,
            likelyCause: 'The exponent was ignored when matching the squared form.',
            remediation:
              'Ask what u² would be for the proposed substitution and compare it against the actual first term.',
          },
        ],
      }
    },
    oracle: ({ a, n }) => `u = (x + ${a})^${n}`,
    referenceExample: {
      prompt: 'What substitution shows x⁴ − 9 as a difference of squares?',
      steps: ['x⁴ = (x²)².', 'Let u = x², giving u² − 3².'],
      answer: 'u = x²',
    },
  }),
])
