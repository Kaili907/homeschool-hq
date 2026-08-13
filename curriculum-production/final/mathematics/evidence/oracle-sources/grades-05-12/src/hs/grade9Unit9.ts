import { fraction, makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 9 Unit 9 — Linear, Quadratic, and Exponential Models (F-LE.1, 2, 3, 5). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)

export const GRADE9_UNIT9 = makeHsUnitBank(9, 9, [
  spec<{ kind: number; start: number; step: number }>({
    itemType: 'classify-linear-or-exponential',
    standard: 'F-LE.1',
    lessonFocus: 'distinguishing constant difference from constant ratio',
    build: (difficulty) => {
      const kind = rand(0, 1)
      const start = rand(2, difficulty === 3 ? 20 : 10)
      const step = rand(2, difficulty === 3 ? 6 : 4)
      const values =
        kind === 0
          ? [start, start + step, start + 2 * step, start + 3 * step]
          : [start, start * step, start * step * step, start * step ** 3]
      return {
        prompt: `A table of successive outputs reads ${values.join(', ')}. Is the relationship linear or exponential, and why?`,
        parameters: { kind, start, step },
        answer:
          kind === 0
            ? `Linear; successive outputs differ by a constant ${step}.`
            : `Exponential; successive outputs have a constant ratio of ${step}.`,
        distractors: [
          kind === 0
            ? `Exponential; successive outputs have a constant ratio of ${step}.`
            : `Linear; successive outputs differ by a constant ${step}.`,
          'Quadratic; the second differences are constant.',
          'Neither; the pattern does not repeat.',
          `${kind === 0 ? 'Exponential' : 'Linear'}; the first output is ${start}.`,
        ],
        solutionSteps: [
          `Compute successive differences: ${values.map((value, index) => (index === 0 ? null : value - values[index - 1])).filter((value) => value !== null).join(', ')}.`,
          `Compute successive ratios: ${values.map((value, index) => (index === 0 ? null : value / values[index - 1])).filter((value) => value !== null).join(', ')}.`,
          kind === 0
            ? `The differences are constant while the ratios are not, which is the signature of a linear relationship.`
            : `The ratios are constant while the differences are not, which is the signature of an exponential relationship.`,
        ],
        commonErrors: [
          {
            observed: 'Called any rapidly growing table exponential.',
            likelyCause: 'Growth was judged by size rather than by structure.',
            remediation:
              'Always compute both differences and ratios; only one of them will be constant.',
          },
        ],
      }
    },
    oracle: ({ kind, step }) =>
      kind === 0
        ? `Linear; successive outputs differ by a constant ${step}.`
        : `Exponential; successive outputs have a constant ratio of ${step}.`,
    referenceExample: {
      prompt: 'Is 3, 6, 12, 24 linear or exponential?',
      steps: ['Differences 3, 6, 12 are not constant.', 'Ratios 2, 2, 2 are constant.'],
      answer: 'Exponential with ratio 2',
    },
  }),

  spec<{ initial: number; ratePercent: number; years: number }>({
    itemType: 'write-exponential-model',
    standard: 'F-LE.2',
    lessonFocus: 'writing an exponential model from a description',
    build: (difficulty) => {
      const initial = rand(2, difficulty === 3 ? 40 : 20) * 100
      const ratePercent = rand(2, difficulty === 3 ? 25 : 12)
      const years = rand(2, 8)
      const factor = (100 + ratePercent) / 100
      const value = Math.round(initial * factor ** years)
      return {
        prompt: `A population of ${initial} grows by ${ratePercent}% per year. Write the model P(t) and find the population after ${years} years, to the nearest whole number.`,
        parameters: { initial, ratePercent, years },
        answer: `P(t) = ${initial}(${factor})^t; P(${years}) ≈ ${value}`,
        distractors: [
          `P(t) = ${initial}(${ratePercent / 100})^t; P(${years}) ≈ ${Math.round(initial * (ratePercent / 100) ** years)}`,
          `P(t) = ${initial} + ${ratePercent}t; P(${years}) ≈ ${initial + ratePercent * years}`,
          `P(t) = ${initial}(${factor})^t; P(${years}) ≈ ${Math.round(initial * factor ** (years + 1))}`,
          `P(t) = ${initial}(1 − ${ratePercent / 100})^t; P(${years}) ≈ ${Math.round(initial * (1 - ratePercent / 100) ** years)}`,
        ],
        solutionSteps: [
          `Growth of ${ratePercent}% per year multiplies the population by 1 + ${ratePercent}/100 = ${factor} each year.`,
          `The model is P(t) = ${initial}(${factor})^t, where t counts years.`,
          `P(${years}) = ${initial}(${factor})^${years} ≈ ${value}.`,
        ],
        commonErrors: [
          {
            observed: `Used ${ratePercent / 100} as the base instead of ${factor}.`,
            likelyCause: 'The growth rate was used where the growth factor was needed.',
            remediation:
              'Check the model at t = 1: it must exceed the starting value for growth, not shrink it.',
          },
        ],
      }
    },
    oracle: ({ initial, ratePercent, years }) => {
      const factor = (100 + ratePercent) / 100
      return `P(t) = ${initial}(${factor})^t; P(${years}) ≈ ${Math.round(initial * factor ** years)}`
    },
    referenceExample: {
      prompt: '500 grows 4% per year. Model and value after 3 years?',
      steps: ['Factor is 1.04.', 'P(t) = 500(1.04)^t.', 'P(3) ≈ 562.'],
      answer: 'P(t) = 500(1.04)^t; P(3) ≈ 562',
    },
  }),

  spec<{ linearRate: number; ratio: number }>({
    itemType: 'compare-growth-rates',
    standard: 'F-LE.3',
    lessonFocus: 'exponential growth eventually exceeding linear growth',
    build: () => {
      const linearRate = rand(20, 120)
      const ratio = rand(2, 3)
      return {
        prompt: `Quantity A grows by ${linearRate} units each year. Quantity B doubles or triples each year, with ratio ${ratio}, starting from a much smaller value. Which statement is true in the long run?`,
        parameters: { linearRate, ratio },
        answer: 'B eventually exceeds A and stays ahead, however large A’s constant increase is.',
        distractors: [
          `A stays ahead permanently because ${linearRate} is larger than ${ratio}.`,
          'The two grow at the same eventual rate.',
          'B exceeds A only if B starts larger than A.',
          `B exceeds A only while the ratio ${ratio} is greater than ${linearRate}.`,
        ],
        solutionSteps: [
          `A grows by a fixed amount each year, so after t years it has increased by ${linearRate}t — growth proportional to t.`,
          `B is multiplied by ${ratio} each year, so after t years it has been scaled by ${ratio}^t — growth proportional to an exponential in t.`,
          `An exponential with ratio greater than 1 eventually outgrows any linear function, regardless of the starting values or the size of the constant increase.`,
          'So B eventually exceeds A and remains ahead.',
        ],
        commonErrors: [
          {
            observed: 'Compared the growth constants directly and concluded the larger number wins.',
            likelyCause: 'A per-year increase was compared against a multiplier as if they were the same kind of quantity.',
            remediation:
              'Tabulate both quantities for enough years to see the crossing point rather than comparing the constants.',
          },
        ],
      }
    },
    oracle: () => 'B eventually exceeds A and stays ahead, however large A’s constant increase is.',
    referenceExample: {
      prompt: 'Does 100t ever fall behind 2^t?',
      steps: ['2^t doubles each step while 100t adds 100.', 'Doubling overtakes any fixed addition.'],
      answer: 'Yes, eventually',
    },
  }),

  spec<{ initial: number; factor: number; part: number }>({
    itemType: 'interpret-model-parameters',
    standard: 'F-LE.5',
    lessonFocus: 'interpreting the parameters of a model in context',
    build: () => {
      const initial = rand(3, 40) * 100
      const factor = rand(85, 97) / 100
      const part = rand(0, 1)
      const answers = [
        `the value of the asset when it was new, $${initial}`,
        `the fraction of value retained each year, ${factor}, meaning a ${Math.round((1 - factor) * 100)}% annual loss`,
      ]
      return {
        prompt: `An asset's value is modelled by V(t) = ${initial}(${factor})^t, with t in years. What does ${part === 0 ? initial : factor} represent?`,
        parameters: { initial, factor, part },
        answer: answers[part],
        distractors: [
          answers[1 - part],
          `the number of years until the asset is worthless`,
          `the total value lost over the asset's life`,
          `the annual dollar loss in value`,
        ],
        solutionSteps: [
          `The model has the form V(t) = a·b^t.`,
          `Substituting t = 0 gives V(0) = ${initial}, so ${initial} is the starting value.`,
          `The base ${factor} is the multiplier applied each year; since it is less than 1, the value decays by ${Math.round((1 - factor) * 100)}% annually.`,
          `The requested parameter represents ${answers[part]}.`,
        ],
        commonErrors: [
          {
            observed: 'Described the base as the percentage lost each year.',
            likelyCause: 'The retained fraction and the lost fraction were confused.',
            remediation:
              'Ask what fraction remains after one year and check that it matches the base directly.',
          },
        ],
      }
    },
    oracle: ({ initial, factor, part }) =>
      [
        `the value of the asset when it was new, $${initial}`,
        `the fraction of value retained each year, ${factor}, meaning a ${Math.round((1 - factor) * 100)}% annual loss`,
      ][part],
    referenceExample: {
      prompt: 'In V(t) = 2000(0.9)^t, what is 0.9?',
      steps: ['It is the multiplier per year.', '90% is retained, so 10% is lost.'],
      answer: 'the fraction retained each year',
    },
  }),

  spec<{ m: number; b: number; x: number }>({
    itemType: 'write-linear-model-from-two-points',
    standard: 'F-LE.2',
    lessonFocus: 'constructing a linear model from two data points',
    build: (difficulty) => {
      const m = nonZero(difficulty === 3 ? 9 : 5)
      const b = nonZero(difficulty === 3 ? 14 : 8)
      const x = rand(1, 6)
      const x2 = x + rand(2, 5)
      const y1 = m * x + b
      const y2 = m * x2 + b
      return {
        prompt: `A linear model passes through (${x}, ${y1}) and (${x2}, ${y2}). Write it in the form f(x) = mx + b.`,
        parameters: { m, b, x },
        answer: `f(x) = ${m}x ${signed(b)}`,
        distractors: [
          `f(x) = ${m}x ${signed(-b)}`,
          `f(x) = ${-m}x ${signed(b)}`,
          `f(x) = ${b}x ${signed(m)}`,
          `f(x) = ${m + 1}x ${signed(b)}`,
        ],
        solutionSteps: [
          `Slope is the change in output over the change in input: (${y2} − ${y1}) / (${x2} − ${x}) = ${m}.`,
          `Substitute one point into f(x) = ${m}x + b: ${y1} = ${m}(${x}) + b.`,
          `Solve for b: b = ${y1} − ${m * x} = ${b}.`,
          `The model is f(x) = ${m}x ${signed(b)}.`,
        ],
        commonErrors: [
          {
            observed: 'Computed the slope correctly but read b off one of the y-values.',
            likelyCause: 'The intercept was assumed to be a given data point.',
            remediation:
              'Confirm that b is the output at x = 0, and substitute to find it unless one point already has x = 0.',
          },
        ],
      }
    },
    oracle: ({ m, b }) => `f(x) = ${m}x ${b < 0 ? `− ${-b}` : `+ ${b}`}`,
    referenceExample: {
      prompt: 'Line through (1, 5) and (3, 11).',
      steps: ['Slope (11−5)/(3−1) = 3.', '5 = 3(1) + b so b = 2.'],
      answer: 'f(x) = 3x + 2',
    },
  }),
])
