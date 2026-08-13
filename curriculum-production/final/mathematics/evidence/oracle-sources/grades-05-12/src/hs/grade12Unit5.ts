import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 12 Unit 5 — Complex Solutions, Polynomials, and the Binomial Theorem (N-CN.8, 9, A-APR.5, 7). */

const factorial = (value: number): number => (value <= 1 ? 1 : value * factorial(value - 1))
const binomial = (n: number, k: number): number => factorial(n) / (factorial(k) * factorial(n - k))

export const GRADE12_UNIT5 = makeHsUnitBank(12, 5, [
  spec<{ b: number }>({
    itemType: 'factor-over-complex-numbers',
    standard: 'N-CN.8',
    lessonFocus: 'extending polynomial identities to the complex numbers',
    build: (difficulty) => {
      const b = rand(2, difficulty === 3 ? 12 : 7)
      return {
        prompt: `Factor x² + ${b * b} completely over the complex numbers.`,
        parameters: { b },
        answer: `(x + ${b}i)(x − ${b}i)`,
        distractors: [
          `(x + ${b})(x − ${b})`,
          `(x + ${b}i)²`,
          `(x + ${b}i)(x + ${b}i)`,
          `(x + ${b * b}i)(x − ${b * b}i)`,
        ],
        solutionSteps: [
          `Over the reals x² + ${b * b} is irreducible, because it has no real zeros.`,
          `Over the complex numbers, write ${b * b} as −(${b}i)², since (${b}i)² = ${b * b}·i² = −${b * b}.`,
          `That turns the sum into a difference of squares: x² − (${b}i)².`,
          `Applying A² − B² = (A + B)(A − B) gives (x + ${b}i)(x − ${b}i).`,
        ],
        commonErrors: [
          {
            observed: `Answered (x + ${b})(x − ${b}), which expands to x² − ${b * b}.`,
            likelyCause: 'The sum of squares was treated as a difference of squares.',
            remediation:
              'Expand the proposed factorisation and compare the constant term against the original.',
          },
        ],
      }
    },
    oracle: ({ b }) => `(x + ${b}i)(x − ${b}i)`,
    referenceExample: {
      prompt: 'Factor x² + 9 over the complex numbers.',
      steps: ['9 = −(3i)².', 'x² − (3i)² = (x + 3i)(x − 3i).'],
      answer: '(x + 3i)(x − 3i)',
    },
  }),

  spec<{ degree: number }>({
    itemType: 'fundamental-theorem-root-count',
    standard: 'N-CN.9',
    lessonFocus: 'the fundamental theorem of algebra',
    build: () => {
      const degree = rand(2, 7)
      return {
        prompt: `A polynomial with real coefficients has degree ${degree}. How many roots does it have in the complex numbers, counted with multiplicity, and what constrains its non-real roots?`,
        parameters: { degree },
        answer: `exactly ${degree}, and any non-real roots occur in conjugate pairs`,
        distractors: numericDistractors(degree, [degree - 1, degree + 1, Math.ceil(degree / 2)]).map(
          (value) => `exactly ${value}, and any non-real roots occur in conjugate pairs`,
        ).concat([`exactly ${degree}, and all roots must be real`]),
        solutionSteps: [
          `The fundamental theorem of algebra guarantees that a degree-${degree} polynomial factors into ${degree} linear factors over the complex numbers.`,
          `Counting with multiplicity, that gives exactly ${degree} roots.`,
          `Because the coefficients are real, taking conjugates of the whole equation shows that if a + bi is a root then so is a − bi.`,
          `So non-real roots always come in conjugate pairs, which means their number is even.`,
        ],
        commonErrors: [
          {
            observed: 'Counted only the distinct real roots visible on a graph.',
            likelyCause: 'Roots were identified with x-intercepts.',
            remediation:
              'A graph shows only real roots; the theorem counts complex roots with multiplicity.',
          },
        ],
      }
    },
    oracle: ({ degree }) => `exactly ${degree}, and any non-real roots occur in conjugate pairs`,
    referenceExample: {
      prompt: 'How many complex roots does a degree-4 polynomial have?',
      steps: ['The fundamental theorem gives 4 linear factors.', 'So 4 roots with multiplicity.'],
      answer: 'exactly 4',
    },
  }),

  spec<{ n: number; k: number }>({
    itemType: 'binomial-theorem-coefficient',
    standard: 'A-APR.5',
    lessonFocus: 'the binomial theorem and Pascal’s triangle',
    build: (difficulty) => {
      const n = rand(4, difficulty === 3 ? 9 : 6)
      const k = rand(1, n - 1)
      const coefficient = binomial(n, k)
      return {
        prompt: `In the expansion of (x + y)^${n}, find the coefficient of the term x^${n - k}·y^${k}.`,
        parameters: { n, k },
        answer: String(coefficient),
        distractors: numericDistractors(coefficient, [
          binomial(n, k - 1),
          binomial(n, k + 1) || coefficient + 2,
          n * k,
          n + k,
        ]),
        solutionSteps: [
          `The binomial theorem gives the coefficient of x^(n−k)·y^k as the binomial coefficient C(n, k).`,
          `Here n = ${n} and k = ${k}, so the coefficient is C(${n}, ${k}) = ${n}! / (${k}!·${n - k}!).`,
          `Evaluating: ${coefficient}.`,
          `This is also the entry in row ${n} of Pascal's triangle, counting rows and positions from zero.`,
        ],
        commonErrors: [
          {
            observed: `Multiplied the exponents and answered ${n * k}.`,
            likelyCause: 'The coefficient was confused with a product of the exponents.',
            remediation:
              'Expand a small case such as (x + y)³ by hand and compare against the formula.',
          },
        ],
      }
    },
    oracle: ({ n, k }) => {
      // Pascal's triangle built iteratively, independent of the factorial formula.
      let row = [1]
      for (let index = 0; index < n; index += 1) {
        const next = [1]
        for (let position = 0; position < row.length - 1; position += 1) {
          next.push(row[position] + row[position + 1])
        }
        next.push(1)
        row = next
      }
      return String(row[k])
    },
    referenceExample: {
      prompt: 'Coefficient of x²y³ in (x + y)⁵?',
      steps: ['C(5, 3) = 10.'],
      answer: '10',
    },
  }),

  spec<{ which: number }>({
    itemType: 'rational-expression-closure',
    standard: 'A-APR.7',
    lessonFocus: 'closure properties of rational expressions',
    build: () => {
      const cases = [
        {
          text: 'the sum of two rational expressions',
          answer: 'is always a rational expression, because a common denominator can always be formed',
        },
        {
          text: 'the product of two rational expressions',
          answer: 'is always a rational expression, because numerators and denominators multiply directly',
        },
        {
          text: 'the quotient of two rational expressions, where the divisor is not the zero expression',
          answer: 'is always a rational expression, because dividing is multiplying by the reciprocal',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Complete the statement: ${entry.text} …`,
        parameters: { which },
        answer: entry.answer,
        distractors: cases
          .filter((_, index) => index !== which)
          .map((other) => other.answer)
          .concat(['need not be a rational expression, because the denominators may differ']),
        solutionSteps: [
          `A rational expression is a ratio of two polynomials, so closure means the result can again be written in that form.`,
          `Polynomials are closed under addition, subtraction, and multiplication, which is what makes the combined numerator and denominator polynomials again.`,
          entry.answer,
          `This mirrors the rational numbers exactly: the system is closed under all four operations apart from division by zero.`,
        ],
        commonErrors: [
          {
            observed: 'Claimed unlike denominators break closure.',
            likelyCause: 'Difficulty of computation was mistaken for impossibility.',
            remediation:
              'Carry out the combination on an example; unlike denominators need work but always produce a ratio of polynomials.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'is always a rational expression, because a common denominator can always be formed',
        'is always a rational expression, because numerators and denominators multiply directly',
        'is always a rational expression, because dividing is multiplying by the reciprocal',
      ][which],
    referenceExample: {
      prompt: 'Is the product of two rational expressions rational?',
      steps: ['Multiply numerators and denominators.', 'Both stay polynomials, so yes.'],
      answer: 'yes',
    },
  }),
])
