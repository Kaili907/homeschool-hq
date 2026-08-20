import { fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 11 Unit 4 — Exponential, Logarithmic, and Series Models (F-LE.4, A-SSE.4). */

export const GRADE11_UNIT4 = makeHsUnitBank(11, 4, [
  spec<{ base: number; exponent: number }>({
    itemType: 'evaluate-logarithm',
    standard: 'F-LE.4',
    lessonFocus: 'logarithms as exponents',
    build: (difficulty) => {
      const base = [2, 3, 5, 10][rand(0, difficulty === 1 ? 1 : 3)]
      const exponent = rand(2, difficulty === 3 ? 6 : 4)
      const value = base ** exponent
      return {
        prompt: `Evaluate log_${base}(${value}).`,
        parameters: { base, exponent },
        answer: String(exponent),
        distractors: numericDistractors(exponent, [value, value / base, base, exponent * base]),
        solutionSteps: [
          `A logarithm answers the question: to what power must the base be raised to give this number?`,
          `Here: ${base}^? = ${value}.`,
          `Since ${base}^${exponent} = ${value}, the logarithm is ${exponent}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${value}, the argument itself.`,
            likelyCause: 'The logarithm was read as the number rather than as its exponent.',
            remediation:
              'Rewrite every logarithm statement in exponential form before evaluating it.',
          },
        ],
      }
    },
    oracle: ({ base, exponent }) => {
      const value = base ** exponent
      return String(Math.round(Math.log(value) / Math.log(base)))
    },
    referenceExample: {
      prompt: 'Evaluate log_3(81).',
      steps: ['3^? = 81.', '3⁴ = 81, so the answer is 4.'],
      answer: '4',
    },
  }),

  spec<{ base: number; target: number }>({
    itemType: 'solve-exponential-equation-with-logs',
    standard: 'F-LE.4',
    lessonFocus: 'using logarithms to solve exponential equations',
    build: (difficulty) => {
      const base = [2, 3, 5][rand(0, difficulty === 1 ? 1 : 2)]
      const exponent = rand(2, difficulty === 3 ? 6 : 4)
      const target = base ** exponent
      return {
        prompt: `Solve ${base}^x = ${target} exactly, and state the logarithmic form used.`,
        parameters: { base, target },
        answer: `x = log_${base}(${target}) = ${exponent}`,
        distractors: [
          `x = log_${target}(${base}) = ${fraction(1, exponent)}`,
          `x = ${target}/${base} = ${target / base}`,
          `x = log_${base}(${target}) = ${exponent + 1}`,
          `x = ${base} × ${exponent} = ${base * exponent}`,
        ],
        solutionSteps: [
          `Take the logarithm base ${base} of both sides: log_${base}(${base}^x) = log_${base}(${target}).`,
          `The left side simplifies to x, because log and exponential with the same base are inverse operations.`,
          `So x = log_${base}(${target}).`,
          `Evaluating: ${base}^${exponent} = ${target}, so x = ${exponent}.`,
        ],
        commonErrors: [
          {
            observed: 'Divided the target by the base.',
            likelyCause: 'The exponent was treated as a multiplier.',
            remediation:
              'Check the candidate by substituting it back as an exponent; division gives a value far from the target.',
          },
        ],
      }
    },
    oracle: ({ base, target }) => {
      const exponent = Math.round(Math.log(target) / Math.log(base))
      return `x = log_${base}(${target}) = ${exponent}`
    },
    referenceExample: {
      prompt: 'Solve 2^x = 32.',
      steps: ['x = log_2(32).', '2⁵ = 32, so x = 5.'],
      answer: 'x = 5',
    },
  }),

  spec<{ first: number; ratio: number; terms: number }>({
    itemType: 'finite-geometric-series-sum',
    standard: 'A-SSE.4',
    lessonFocus: 'the sum of a finite geometric series',
    build: (difficulty) => {
      const first = rand(2, difficulty === 3 ? 9 : 5)
      const ratio = rand(2, difficulty === 3 ? 4 : 3)
      const terms = rand(3, difficulty === 3 ? 8 : 5)
      const sum = (first * (ratio ** terms - 1)) / (ratio - 1)
      return {
        prompt: `Find the sum of the first ${terms} terms of the geometric series with first term ${first} and common ratio ${ratio}.`,
        parameters: { first, ratio, terms },
        answer: String(sum),
        distractors: numericDistractors(sum, [
          first * ratio ** terms,
          first * ratio ** (terms - 1),
          first * terms,
          (first * (ratio ** terms - 1)) / ratio,
        ]),
        solutionSteps: [
          `The sum of a finite geometric series is S = a(rⁿ − 1)/(r − 1), valid whenever r ≠ 1.`,
          `Here a = ${first}, r = ${ratio}, n = ${terms}.`,
          `r^n = ${ratio}^${terms} = ${ratio ** terms}, so the numerator is ${first}(${ratio ** terms} − 1) = ${first * (ratio ** terms - 1)}.`,
          `Divide by r − 1 = ${ratio - 1}: S = ${sum}.`,
        ],
        commonErrors: [
          {
            observed: `Reported the last term ${first * ratio ** (terms - 1)} instead of the sum.`,
            likelyCause: 'The nth term formula was used in place of the series sum.',
            remediation:
              'Add the first three terms by hand and compare against both candidate formulas.',
          },
        ],
      }
    },
    oracle: ({ first, ratio, terms }) => {
      // Independent recomputation by direct summation rather than the closed form.
      let total = 0
      let current = first
      for (let index = 0; index < terms; index += 1) {
        total += current
        current *= ratio
      }
      return String(total)
    },
    referenceExample: {
      prompt: 'Sum the first 4 terms with a = 3, r = 2.',
      steps: ['3 + 6 + 12 + 24.', 'Total 45.'],
      answer: '45',
    },
  }),

  spec<{ principal: number; ratePercent: number; years: number }>({
    itemType: 'logarithm-for-doubling-time',
    standard: 'F-LE.4',
    lessonFocus: 'using logarithms to find a time in a growth model',
    build: (difficulty) => {
      const principal = rand(2, difficulty === 3 ? 30 : 15) * 100
      const ratePercent = rand(2, difficulty === 3 ? 20 : 10)
      const factor = 1 + ratePercent / 100
      const years = Math.ceil(Math.log(2) / Math.log(factor))
      return {
        prompt: `An investment of $${principal} grows by ${ratePercent}% per year. Using logarithms, find the least whole number of years for it to at least double.`,
        parameters: { principal, ratePercent, years },
        answer: `${years} years`,
        distractors: numericDistractors(years, [
          Math.round(100 / ratePercent),
          years + 2,
          Math.round(70 / ratePercent) + 3,
          ratePercent,
        ]).map((value) => `${value} years`),
        solutionSteps: [
          `Doubling requires ${factor}^t ≥ 2; the starting amount $${principal} cancels and does not affect the answer.`,
          `Take logarithms of both sides: t·log(${factor}) ≥ log 2.`,
          `So t ≥ log 2 / log ${factor} ≈ ${Math.round((Math.log(2) / Math.log(factor)) * 100) / 100}.`,
          `The least whole number of years satisfying this is ${years}.`,
        ],
        commonErrors: [
          {
            observed: 'Divided 100 by the percentage rate.',
            likelyCause: 'Linear reasoning was applied to exponential growth.',
            remediation:
              'Compare the candidate against the model directly by computing the growth factor raised to that power.',
          },
        ],
      }
    },
    oracle: ({ ratePercent }) => {
      const factor = 1 + ratePercent / 100
      let years = 0
      let value = 1
      while (value < 2) {
        value *= factor
        years += 1
      }
      return `${years} years`
    },
    referenceExample: {
      prompt: 'At 10% per year, when does an amount double?',
      steps: ['1.1^t ≥ 2.', 't ≥ log2/log1.1 ≈ 7.27.', 'So 8 years.'],
      answer: '8 years',
    },
  }),
])
