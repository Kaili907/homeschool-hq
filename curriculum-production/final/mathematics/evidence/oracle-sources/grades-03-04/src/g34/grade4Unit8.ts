import { makeG34UnitBank, rand, renderedDistractors, spec } from './core.ts'

/** Grade 4 Unit 8 — Decimal Notation and Fraction-Decimal Connections (4.MD.2, 4.NF.5, 4.NF.6, 4.NF.7). */

export const GRADE4_UNIT8 = makeG34UnitBank(4, 8, [
  spec<{ tenths: number; hundredths: number }>({
    itemType: 'add-tenths-and-hundredths',
    standard: '4.NF.5',
    lessonFocus: 'expressing a fraction with denominator 10 as an equivalent fraction with denominator 100 to add two fractions',
    build: (difficulty) => {
      const tenths = rand(1, difficulty === 1 ? 4 : 8)
      const hundredths = rand(1, difficulty === 3 ? 90 : 40)
      const tenthsAsHundredths = tenths * 10
      const sum = tenthsAsHundredths + hundredths
      return {
        prompt: `Find ${tenths}/10 + ${hundredths}/100. Give the answer as a fraction over 100.`,
        parameters: { tenths, hundredths },
        answer: `${sum}/100`,
        distractors: [`${tenths + hundredths}/100`, `${sum}/10`, `${tenthsAsHundredths}/100`, `${sum + 10}/100`],
        solutionSteps: [
          `Rewrite ${tenths}/10 as an equivalent fraction over 100: ${tenths} × 10 = ${tenthsAsHundredths}, so ${tenths}/10 = ${tenthsAsHundredths}/100.`,
          `${tenthsAsHundredths}/100 + ${hundredths}/100 = ${sum}/100.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${tenths + hundredths}/100 instead of ${sum}/100.`,
            likelyCause: 'Added the numerators without first rewriting tenths as hundredths.',
            remediation: 'Remind the learner both fractions need the same denominator before the numerators can be added.',
          },
        ],
      }
    },
    oracle: ({ tenths, hundredths }) => String(tenths * 10 + hundredths) + '/100',
    referenceExample: {
      prompt: 'Find 3/10 + 25/100.',
      steps: ['3/10 = 30/100.', '30/100 + 25/100 = 55/100.'],
      answer: '55/100',
    },
  }),

  spec<{ numerator: number; denominator: number }>({
    itemType: 'decimal-notation-for-fraction',
    standard: '4.NF.6',
    lessonFocus: 'writing a fraction with denominator 10 or 100 using decimal notation',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? 10 : 100
      const numerator = denominator === 10 ? rand(1, 9) : rand(1, 99)
      const decimal = denominator === 10 ? `0.${numerator}` : `0.${String(numerator).padStart(2, '0')}`
      return {
        prompt: `Write ${numerator}/${denominator} using decimal notation.`,
        parameters: { numerator, denominator },
        answer: decimal,
        distractors: [
          ...renderedDistractors(numerator, [], (v) => (denominator === 10 ? `0.${v}` : `0.${String(v).padStart(2, '0')}`), 3),
          `${numerator}.0`,
        ],
        solutionSteps: [
          denominator === 10
            ? `A denominator of 10 means one decimal place: ${numerator}/10 = 0.${numerator}.`
            : `A denominator of 100 means two decimal places: ${numerator}/100 = 0.${String(numerator).padStart(2, '0')}.`,
        ],
      }
    },
    oracle: ({ numerator, denominator }) => (denominator === 10 ? `0.${numerator}` : `0.${String(numerator).padStart(2, '0')}`),
    referenceExample: {
      prompt: 'Write 7/100 using decimal notation.',
      steps: ['A denominator of 100 means two decimal places.', '7/100 = 0.07.'],
      answer: '0.07',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'compare-decimals',
    standard: '4.NF.7',
    lessonFocus: 'comparing two decimals to hundredths by reasoning about size',
    build: (difficulty) => {
      const scale = difficulty === 1 ? 10 : 100
      let a = rand(1, scale === 10 ? 9 : 99)
      let b = rand(1, scale === 10 ? 9 : 99)
      while (a === b) b = rand(1, scale === 10 ? 9 : 99)
      const decA = scale === 10 ? `0.${a}` : `0.${String(a).padStart(2, '0')}`
      const decB = scale === 10 ? `0.${b}` : `0.${String(b).padStart(2, '0')}`
      const symbol = a > b ? '>' : '<'
      return {
        prompt: `Compare using <, >, or =: ${decA} ___ ${decB}`,
        parameters: { a, b },
        answer: symbol,
        distractors: [...['>', '<', '='].filter((s) => s !== symbol), 'Cannot be compared without more information'],
        solutionSteps: [
          `Both decimals are written to the same number of places, so compare the digits directly.`,
          `${decA} ${symbol} ${decB}.`,
        ],
      }
    },
    oracle: ({ a, b }) => (a > b ? '>' : a < b ? '<' : '='),
    referenceExample: {
      prompt: 'Compare using <, >, or =: 0.30 ___ 0.3',
      steps: ['0.30 and 0.3 represent the same amount.', '0.30 = 0.3.'],
      answer: '=',
    },
  }),

  spec<{ cupsPerServing: number; denominator: number; servings: number }>({
    itemType: 'fraction-word-problem-measurement-review',
    standard: '4.MD.2',
    lessonFocus: 'solving measurement word problems involving fractions',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [2, 4][rand(0, 1)] : difficulty === 2 ? [3, 4][rand(0, 1)] : [4, 8][rand(0, 1)]
      const cupsPerServing = rand(1, denominator - 1)
      const servings = rand(2, difficulty === 3 ? 8 : 5)
      const resultNumerator = cupsPerServing * servings
      return {
        prompt: `A pitcher holds ${cupsPerServing}/${denominator} liter per glass. How much liquid fills ${servings} glasses? Give the answer as a fraction of a liter.`,
        parameters: { cupsPerServing, denominator, servings },
        answer: `${resultNumerator}/${denominator}`,
        distractors: [`${cupsPerServing}/${denominator * servings}`, `${servings}/${denominator}`, `${resultNumerator + 1}/${denominator}`, `${resultNumerator}/${denominator * servings}`],
        solutionSteps: [
          `${servings} glasses need ${servings} × ${cupsPerServing}/${denominator} liter.`,
          `${cupsPerServing} × ${servings} = ${resultNumerator}, so the total is ${resultNumerator}/${denominator} liter.`,
        ],
      }
    },
    oracle: ({ cupsPerServing, denominator, servings }) => `${cupsPerServing * servings}/${denominator}`,
    referenceExample: {
      prompt: 'A pitcher holds 1/3 liter per glass. How much fills 4 glasses?',
      steps: ['4 × 1/3 liter.', '1 × 4 = 4.', 'The total is 4/3 liter.'],
      answer: '4/3',
    },
  }),
])
