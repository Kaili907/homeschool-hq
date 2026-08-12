import { fraction, makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 9 Unit 8 — Rate of Change and Building Functions (F-IF.6, F-BF.1, F-BF.2). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)

export const GRADE9_UNIT8 = makeHsUnitBank(9, 8, [
  spec<{ a: number; b: number; c: number; x1: number; x2: number }>({
    itemType: 'average-rate-of-change',
    standard: 'F-IF.6',
    lessonFocus: 'average rate of change over an interval',
    build: (difficulty) => {
      const a = nonZero(difficulty === 3 ? 4 : 2)
      const b = nonZero(difficulty === 3 ? 8 : 5)
      const c = nonZero(9)
      const x1 = nonZero(difficulty === 3 ? 6 : 4)
      let x2 = nonZero(difficulty === 3 ? 6 : 4)
      // x2 - x1 is the divisor of the rate; x2 + x1 appears in a distractor
      // denominator, so keep both differences away from zero.
      if (x2 === x1) x2 = x1 + 2
      if (x2 === -x1) x2 = x1 + 3
      const f = (x: number): number => a * x * x + b * x + c
      const rate = (f(x2) - f(x1)) / (x2 - x1)
      return {
        prompt: `For f(x) = ${a}x² ${signed(b)}x ${signed(c)}, find the average rate of change from x = ${x1} to x = ${x2}.`,
        parameters: { a, b, c, x1, x2 },
        answer: fraction(f(x2) - f(x1), x2 - x1),
        distractors: [
          fraction(f(x1) - f(x2), x2 - x1),
          fraction(f(x2) - f(x1), x2 + x1),
          String(f(x2) - f(x1)),
          fraction(f(x2) + f(x1), x2 - x1),
          fraction(f(x2) - f(x1) + 1, x2 - x1),
          fraction(f(x2) - f(x1) - 1, x2 - x1),
          fraction(f(x2) - f(x1) + 2, x2 - x1),
        ],
        solutionSteps: [
          `Evaluate the endpoints: f(${x1}) = ${f(x1)} and f(${x2}) = ${f(x2)}.`,
          `Average rate of change is the change in output over the change in input.`,
          `(${f(x2)} − ${f(x1)}) / (${x2} − ${x1}) = ${f(x2) - f(x1)} / ${x2 - x1}.`,
          `That simplifies to ${fraction(f(x2) - f(x1), x2 - x1)}.`,
        ],
        commonErrors: [
          {
            observed: 'Subtracted the outputs in one order and the inputs in the other.',
            likelyCause: 'The two differences were not kept in matching order.',
            remediation:
              'Write the interval endpoints as a table and subtract down both columns consistently.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, x1, x2 }) => {
      const f = (x: number): number => a * x * x + b * x + c
      const numerator = f(x2) - f(x1)
      const denominator = x2 - x1
      let n = numerator
      let d = denominator
      if (d < 0) {
        n = -n
        d = -d
      }
      const g = ((p: number, q: number): number => {
        let x = Math.abs(p)
        let y = Math.abs(q)
        while (y !== 0) [x, y] = [y, x % y]
        return x
      })(n, d) || 1
      return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
    },
    referenceExample: {
      prompt: 'For f(x) = x², find the average rate of change from x = 1 to x = 3.',
      steps: ['f(1) = 1, f(3) = 9.', '(9 − 1)/(3 − 1) = 4.'],
      answer: '4',
    },
  }),

  spec<{ first: number; ratio: number; n: number }>({
    itemType: 'geometric-sequence-explicit-form',
    standard: 'F-BF.2',
    lessonFocus: 'translating between recursive and explicit forms',
    build: (difficulty) => {
      const first = rand(2, difficulty === 3 ? 12 : 6)
      const ratio = rand(2, difficulty === 3 ? 4 : 3)
      const n = rand(3, difficulty === 3 ? 8 : 6)
      const value = first * ratio ** (n - 1)
      return {
        prompt: `A sequence has g(1) = ${first} and g(n) = ${ratio}·g(n − 1). Write the explicit form and find g(${n}).`,
        parameters: { first, ratio, n },
        answer: `g(n) = ${first}·${ratio}^(n−1); g(${n}) = ${value}`,
        distractors: [
          `g(n) = ${first}·${ratio}^n; g(${n}) = ${first * ratio ** n}`,
          `g(n) = ${first} + ${ratio}(n − 1); g(${n}) = ${first + ratio * (n - 1)}`,
          `g(n) = ${ratio}·${first}^(n−1); g(${n}) = ${ratio * first ** (n - 1)}`,
          `g(n) = ${first}·${ratio}^(n−1); g(${n}) = ${first * ratio ** n}`,
        ],
        solutionSteps: [
          `Each term is ${ratio} times the previous one, so the sequence is geometric with ratio ${ratio}.`,
          `Reaching term n from term 1 applies the ratio n − 1 times, giving g(n) = ${first}·${ratio}^(n−1).`,
          `g(${n}) = ${first}·${ratio}^${n - 1} = ${first}·${ratio ** (n - 1)} = ${value}.`,
        ],
        commonErrors: [
          {
            observed: `Used exponent n instead of n − 1 and answered ${first * ratio ** n}.`,
            likelyCause: 'The first term was treated as one application of the ratio.',
            remediation:
              'Substitute n = 1 into the explicit form; it must return the first term.',
          },
        ],
      }
    },
    oracle: ({ first, ratio, n }) =>
      `g(n) = ${first}·${ratio}^(n−1); g(${n}) = ${first * ratio ** (n - 1)}`,
    referenceExample: {
      prompt: 'g(1) = 3, g(n) = 2g(n−1). Explicit form?',
      steps: ['Geometric with ratio 2.', 'g(n) = 3·2^(n−1).'],
      answer: 'g(n) = 3·2^(n−1)',
    },
  }),

  spec<{ base: number; perUnit: number; units: number }>({
    itemType: 'build-function-from-context',
    standard: 'F-BF.1',
    lessonFocus: 'building a function that models a relationship',
    build: (difficulty) => {
      const base = rand(3, difficulty === 3 ? 40 : 20) * 5
      const perUnit = rand(2, difficulty === 3 ? 20 : 10)
      const units = rand(3, 15)
      return {
        prompt: `A venue charges $${base} to open plus $${perUnit} per attendee. Write C(n) for the total cost of n attendees, then find C(${units}).`,
        parameters: { base, perUnit, units },
        answer: `C(n) = ${base} + ${perUnit}n; C(${units}) = ${base + perUnit * units}`,
        distractors: [
          `C(n) = ${perUnit} + ${base}n; C(${units}) = ${perUnit + base * units}`,
          `C(n) = ${base}n + ${perUnit}; C(${units}) = ${base * units + perUnit}`,
          `C(n) = ${base + perUnit}n; C(${units}) = ${(base + perUnit) * units}`,
          `C(n) = ${base} + ${perUnit}n; C(${units}) = ${base + perUnit * (units + 1)}`,
        ],
        solutionSteps: [
          `The opening charge $${base} is paid once regardless of n, so it is the constant term.`,
          `The per-attendee charge $${perUnit} scales with n, so it is the coefficient of n.`,
          `C(n) = ${base} + ${perUnit}n.`,
          `C(${units}) = ${base} + ${perUnit}(${units}) = ${base + perUnit * units}.`,
        ],
        commonErrors: [
          {
            observed: 'Attached n to the fixed charge.',
            likelyCause: 'The fixed and variable parts were not distinguished.',
            remediation:
              'Evaluate the candidate function at n = 0; it must return the fixed cost alone.',
          },
        ],
      }
    },
    oracle: ({ base, perUnit, units }) =>
      `C(n) = ${base} + ${perUnit}n; C(${units}) = ${base + perUnit * units}`,
    referenceExample: {
      prompt: '$50 to open plus $8 per attendee. Write C(n) and find C(10).',
      steps: ['C(n) = 50 + 8n.', 'C(10) = 50 + 80 = 130.'],
      answer: 'C(n) = 50 + 8n; C(10) = 130',
    },
  }),

  spec<{ a: number; b: number; k: number }>({
    itemType: 'combine-functions',
    standard: 'F-BF.1',
    lessonFocus: 'combining functions to model a combined quantity',
    build: (difficulty) => {
      const a = nonZero(difficulty === 3 ? 8 : 4)
      const b = nonZero(difficulty === 3 ? 10 : 6)
      const k = nonZero(difficulty === 3 ? 10 : 6)
      return {
        prompt: `Revenue is R(x) = ${a}x ${signed(b)} and cost is C(x) = ${k}x. Write the profit function P(x) = R(x) − C(x) in simplest form.`,
        parameters: { a, b, k },
        answer: `P(x) = ${a - k}x ${signed(b)}`,
        distractors: [
          `P(x) = ${a + k}x ${signed(b)}`,
          `P(x) = ${a - k}x ${signed(-b)}`,
          `P(x) = ${k - a}x ${signed(b)}`,
          `P(x) = ${a - k}x ${signed(b - k)}`,
          `P(x) = ${a - k + 1}x ${signed(b)}`,
          `P(x) = ${a - k}x ${signed(b + 1)}`,
          `P(x) = ${a - k - 1}x ${signed(b)}`,
        ],
        solutionSteps: [
          `Profit is revenue minus cost, so subtract the whole cost function.`,
          `P(x) = (${a}x ${signed(b)}) − (${k}x).`,
          `Combine the x terms: ${a}x − ${k}x = ${a - k}x. The constant ${b} is unaffected because C(x) has no constant term.`,
          `P(x) = ${a - k}x ${signed(b)}.`,
        ],
        commonErrors: [
          {
            observed: 'Added the functions instead of subtracting.',
            likelyCause: 'The order of the combination was not read from the definition.',
            remediation:
              'Write the definition P = R − C above the working and substitute into it literally.',
          },
        ],
      }
    },
    oracle: ({ a, b, k }) => {
      const constant = b < 0 ? `− ${-b}` : `+ ${b}`
      return `P(x) = ${a - k}x ${constant}`
    },
    referenceExample: {
      prompt: 'R(x) = 9x + 4, C(x) = 5x. Find P(x).',
      steps: ['P = R − C = 9x + 4 − 5x.', 'P(x) = 4x + 4.'],
      answer: 'P(x) = 4x + 4',
    },
  }),

  spec<{ p1: number; p2: number; q1: number; q2: number }>({
    itemType: 'rate-of-change-from-table',
    standard: 'F-IF.6',
    lessonFocus: 'estimating rate of change from tabulated data',
    build: (difficulty) => {
      const p1 = rand(1, 6)
      const p2 = p1 + rand(2, difficulty === 3 ? 8 : 4)
      const q1 = rand(5, 60)
      const q2 = q1 + nonZero(difficulty === 3 ? 40 : 20)
      return {
        prompt: `A table records output ${q1} at input ${p1} and output ${q2} at input ${p2}. What is the average rate of change between these readings?`,
        parameters: { p1, p2, q1, q2 },
        answer: `${fraction(q2 - q1, p2 - p1)} output units per input unit`,
        distractors: [
          `${fraction(q1 - q2, p2 - p1)} output units per input unit`,
          `${q2 - q1} output units per input unit`,
          `${fraction(q2 - q1, p2 + p1)} output units per input unit`,
          `${fraction(p2 - p1, q2 - q1)} output units per input unit`,
        ],
        solutionSteps: [
          `The change in output is ${q2} − ${q1} = ${q2 - q1}.`,
          `The change in input is ${p2} − ${p1} = ${p2 - p1}.`,
          `Divide the change in output by the change in input: ${fraction(q2 - q1, p2 - p1)}.`,
        ],
        commonErrors: [
          {
            observed: `Reported the raw change ${q2 - q1} without dividing.`,
            likelyCause: 'Total change was confused with rate of change.',
            remediation:
              'Ask for the units of the answer; a rate must carry "per input unit".',
          },
        ],
      }
    },
    oracle: ({ p1, p2, q1, q2 }) => {
      let n = q2 - q1
      let d = p2 - p1
      if (d < 0) {
        n = -n
        d = -d
      }
      let x = Math.abs(n)
      let y = Math.abs(d)
      while (y !== 0) [x, y] = [y, x % y]
      const g = x || 1
      const value = d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
      return `${value} output units per input unit`
    },
    referenceExample: {
      prompt: 'Output 10 at input 2, output 22 at input 5. Rate?',
      steps: ['Change in output 12, change in input 3.', '12/3 = 4.'],
      answer: '4 output units per input unit',
    },
  }),
])
