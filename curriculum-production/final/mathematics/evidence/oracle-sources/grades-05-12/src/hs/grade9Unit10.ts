import { fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 9 Unit 10 — Distributions, Bivariate Data, and Correlation (S-ID.1-3, 5-9). */

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export const GRADE9_UNIT10 = makeHsUnitBank(9, 10, [
  spec<{ values: number[] }>({
    itemType: 'centre-and-spread-from-data',
    standard: 'S-ID.2',
    lessonFocus: 'comparing centre and spread of a data set',
    build: (difficulty) => {
      const count = difficulty === 3 ? 7 : 5
      const values = Array.from({ length: count }, () => rand(2, difficulty === 3 ? 40 : 20))
      const m = mean(values)
      const md = median(values)
      const rounded = Math.round(m * 100) / 100
      return {
        prompt: `A data set records ${values.join(', ')}. Give the mean and the median.`,
        parameters: { values },
        answer: `mean ${rounded}, median ${md}`,
        distractors: [
          `mean ${md}, median ${rounded}`,
          `mean ${rounded}, median ${Math.round(m)}`,
          `mean ${Math.round(m)}, median ${md}`,
          `mean ${rounded}, median ${values[Math.floor(count / 2)]}`,
          // Nudged pairs keep the pool full when the mean happens to be an
          // integer and equal to the median, which collapses the pairs above.
          `mean ${Math.round((m + 1) * 100) / 100}, median ${md}`,
          `mean ${rounded}, median ${md + 1}`,
          `mean ${Math.round((m - 1) * 100) / 100}, median ${md}`,
        ],
        solutionSteps: [
          `Add the values: ${values.join(' + ')} = ${values.reduce((sum, value) => sum + value, 0)}.`,
          `Divide by the count ${count}: mean = ${rounded}.`,
          `Order the values: ${[...values].sort((a, b) => a - b).join(', ')}.`,
          `The middle value of the ordered list is the median: ${md}.`,
        ],
        commonErrors: [
          {
            observed: 'Took the middle value of the unordered list as the median.',
            likelyCause: 'The data were not sorted before locating the middle.',
            remediation:
              'Require the sorted list to be written out before the median is read off.',
          },
        ],
      }
    },
    oracle: ({ values }) => {
      const total = values.reduce((sum, value) => sum + value, 0)
      const m = Math.round((total / values.length) * 100) / 100
      const sorted = [...values].sort((a, b) => a - b)
      const middle = Math.floor(sorted.length / 2)
      const md = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
      return `mean ${m}, median ${md}`
    },
    referenceExample: {
      prompt: 'Find the mean and median of 4, 8, 6, 10, 2.',
      steps: ['Sum 30, count 5, mean 6.', 'Sorted: 2, 4, 6, 8, 10; median 6.'],
      answer: 'mean 6, median 6',
    },
  }),

  spec<{ base: number[]; outlier: number }>({
    itemType: 'outlier-effect-on-statistics',
    standard: 'S-ID.3',
    lessonFocus: 'the effect of an extreme value on centre and spread',
    build: (difficulty) => {
      const base = Array.from({ length: 5 }, () => rand(10, 30))
      const outlier = rand(150, difficulty === 3 ? 400 : 250)
      return {
        prompt: `A data set of five values between 10 and 30 has one additional reading of ${outlier} appended. Which statement best describes the effect on the mean and the median?`,
        parameters: { base, outlier },
        answer: 'The mean rises sharply while the median changes little, because the mean uses every value’s size.',
        distractors: [
          'Both the mean and the median rise sharply.',
          'The median rises sharply while the mean changes little.',
          'Neither statistic changes, because one value cannot affect a summary.',
          'The mean is unaffected because outliers are excluded by definition.',
        ],
        solutionSteps: [
          `The mean adds every value and divides by the count, so a value of ${outlier} contributes its full size to the total.`,
          'The median depends only on position in the ordered list, so appending one large value shifts the middle by at most one place.',
          'Therefore the mean is pulled towards the outlier while the median stays near the original centre.',
        ],
        commonErrors: [
          {
            observed: 'Claimed the median is equally affected.',
            likelyCause: 'The median was treated as another average of the values.',
            remediation:
              'Recompute both statistics with and without the outlier and compare the two changes side by side.',
          },
        ],
      }
    },
    oracle: () =>
      'The mean rises sharply while the median changes little, because the mean uses every value’s size.',
    referenceExample: {
      prompt: 'How does one very large value affect mean and median?',
      steps: ['The mean uses value sizes.', 'The median uses positions only.'],
      answer: 'The mean moves much more',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'two-way-table-conditional-frequency',
    standard: 'S-ID.5',
    lessonFocus: 'conditional relative frequency from a two-way table',
    build: (difficulty) => {
      const a = rand(5, difficulty === 3 ? 60 : 30)
      const b = rand(5, difficulty === 3 ? 60 : 30)
      const c = rand(5, difficulty === 3 ? 60 : 30)
      const d = rand(5, difficulty === 3 ? 60 : 30)
      const rowTotal = a + b
      return {
        prompt: `A two-way table has row 1: ${a} yes, ${b} no; row 2: ${c} yes, ${d} no. Among row-1 respondents, what fraction answered yes?`,
        parameters: { a, b, c, d },
        answer: fraction(a, rowTotal),
        distractors: [
          fraction(a, a + b + c + d),
          fraction(a, a + c),
          fraction(b, rowTotal),
          fraction(a + c, a + b + c + d),
          fraction(a + 1, rowTotal),
          fraction(a - 1, rowTotal),
          fraction(a + 2, rowTotal),
        ],
        solutionSteps: [
          `The condition "among row-1 respondents" restricts the denominator to row 1 only.`,
          `Row 1 totals ${a} + ${b} = ${rowTotal}.`,
          `Of those, ${a} answered yes.`,
          `The conditional relative frequency is ${a}/${rowTotal} = ${fraction(a, rowTotal)}.`,
        ],
        commonErrors: [
          {
            observed: `Divided by the grand total ${a + b + c + d}.`,
            likelyCause: 'A joint frequency was computed instead of a conditional one.',
            remediation:
              'Underline the conditioning phrase and let it choose the denominator before any arithmetic.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => fraction(a, a + b),
    referenceExample: {
      prompt: 'Row 1 has 12 yes and 8 no. Fraction of row 1 saying yes?',
      steps: ['Row total 20.', '12/20 = 3/5.'],
      answer: '3/5',
    },
  }),

  spec<{ slope: number; intercept: number; unitX: number }>({
    itemType: 'interpret-regression-slope',
    standard: 'S-ID.7',
    lessonFocus: 'interpreting slope and intercept of a fitted line in context',
    build: (difficulty) => {
      const slope = rand(2, difficulty === 3 ? 18 : 9)
      const intercept = rand(5, 60)
      const unitX = rand(0, 1)
      const xUnit = unitX === 0 ? 'hour studied' : 'kilometre travelled'
      const yUnit = unitX === 0 ? 'test points' : 'litres of fuel'
      return {
        prompt: `A least-squares line for a data set is ŷ = ${slope}x + ${intercept}, where x is measured in ${xUnit}s and y in ${yUnit}. Interpret the slope.`,
        parameters: { slope, intercept, unitX },
        answer: `Each additional ${xUnit} is associated with an increase of about ${slope} ${yUnit}.`,
        distractors: [
          `Each additional ${xUnit} causes an increase of exactly ${slope} ${yUnit}.`,
          `The predicted value is ${slope} ${yUnit} when x is 0.`,
          `Each additional ${yUnit} is associated with ${slope} more ${xUnit}s.`,
          `About ${intercept} ${yUnit} are gained per ${xUnit}.`,
        ],
        solutionSteps: [
          `In ŷ = mx + b, the slope m is the predicted change in y for a one-unit increase in x.`,
          `Here m = ${slope}, and x is measured in ${xUnit}s while y is measured in ${yUnit}.`,
          `So a one-${xUnit} increase is associated with about ${slope} more ${yUnit}.`,
          `The wording stays associational: a fitted line from observational data does not establish causation.`,
        ],
        commonErrors: [
          {
            observed: 'Stated the slope as a causal effect.',
            likelyCause: 'A fitted line was read as evidence that x produces y.',
            remediation:
              'Require the words "is associated with" unless the data came from a randomised experiment.',
          },
        ],
      }
    },
    oracle: ({ slope, unitX }) => {
      const xUnit = unitX === 0 ? 'hour studied' : 'kilometre travelled'
      const yUnit = unitX === 0 ? 'test points' : 'litres of fuel'
      return `Each additional ${xUnit} is associated with an increase of about ${slope} ${yUnit}.`
    },
    referenceExample: {
      prompt: 'For ŷ = 4x + 60, interpret the slope where x is hours studied.',
      steps: ['Slope is change in y per unit x.', 'One more hour is associated with about 4 more points.'],
      answer: 'about 4 more points per hour',
    },
  }),

  spec<{ scenario: number }>({
    itemType: 'correlation-versus-causation',
    standard: 'S-ID.9',
    lessonFocus: 'distinguishing correlation from causation',
    build: () => {
      const scenarios = [
        {
          text: 'Ice cream sales and swimming-pool admissions are strongly positively correlated across a year.',
          answer: 'A third variable — warm weather — plausibly drives both, so correlation here is not evidence of causation.',
        },
        {
          text: 'In a randomised trial, one group received a tutoring programme and scored higher on average than the control group.',
          answer: 'Random assignment makes a causal conclusion reasonable, because the groups differ only by the treatment.',
        },
        {
          text: 'Towns with more fire engines report more fire damage.',
          answer: 'Larger towns have both more engines and more fires, so the association reflects town size rather than a causal link.',
        },
      ]
      const scenario = rand(0, scenarios.length - 1)
      const entry = scenarios[scenario]
      return {
        prompt: `${entry.text} What conclusion is justified?`,
        parameters: { scenario },
        answer: entry.answer,
        distractors: scenarios
          .filter((_, index) => index !== scenario)
          .map((other) => other.answer)
          .concat(['A strong correlation always establishes causation when the sample is large.']),
        solutionSteps: [
          `Ask first how the data were produced: observed as they occurred, or generated by random assignment.`,
          scenario === 1
            ? 'Random assignment balances other variables between groups, so a difference in outcome can be attributed to the treatment.'
            : 'Observational data leave open the possibility of a lurking variable that influences both quantities.',
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Treated the strength of the correlation as evidence of causation.',
            likelyCause: 'Strength of association was confused with the design of the study.',
            remediation:
              'Ask how the data were collected before interpreting any correlation coefficient.',
          },
        ],
      }
    },
    oracle: ({ scenario }) =>
      [
        'A third variable — warm weather — plausibly drives both, so correlation here is not evidence of causation.',
        'Random assignment makes a causal conclusion reasonable, because the groups differ only by the treatment.',
        'Larger towns have both more engines and more fires, so the association reflects town size rather than a causal link.',
      ][scenario],
    referenceExample: {
      prompt: 'Ice cream sales correlate with drowning rates. Does ice cream cause drowning?',
      steps: ['Both rise in hot weather.', 'A lurking variable explains the association.'],
      answer: 'No; a third variable explains it',
    },
  }),
])
