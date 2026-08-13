import { makeG34UnitBank, rand, spec } from './core.ts'

/** Grade 4 Unit 6 — Fraction Equivalence and Comparison (4.NF.1, 4.NF.2). */

export const GRADE4_UNIT6 = makeG34UnitBank(4, 6, [
  spec<{ numerator: number; denominator: number; factor: number }>({
    itemType: 'equivalent-fractions-generate',
    standard: '4.NF.1',
    lessonFocus: 'generating equivalent fractions by multiplying the numerator and denominator by the same number',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [3, 4, 5, 6][rand(0, 3)] : [4, 5, 6, 8][rand(0, 3)]
      const numerator = rand(1, denominator - 1)
      const factor = rand(2, difficulty === 3 ? 6 : 4)
      const equivNumerator = numerator * factor
      const equivDenominator = denominator * factor
      return {
        prompt: `Generate a fraction equivalent to ${numerator}/${denominator} by multiplying the numerator and denominator by the same number.`,
        parameters: { numerator, denominator, factor },
        answer: `${equivNumerator}/${equivDenominator}`,
        distractors: [
          `${equivNumerator + 1}/${equivDenominator}`,
          `${equivNumerator}/${denominator}`,
          `${numerator}/${equivDenominator}`,
          `${equivDenominator}/${equivNumerator}`,
        ],
        solutionSteps: [
          `Multiply the numerator and denominator by the same number, ${factor}.`,
          `${numerator} × ${factor} = ${equivNumerator}, and ${denominator} × ${factor} = ${equivDenominator}.`,
          `${numerator}/${denominator} = ${equivNumerator}/${equivDenominator}.`,
        ],
      }
    },
    oracle: ({ numerator, denominator, factor }) => `${numerator * factor}/${denominator * factor}`,
    referenceExample: {
      prompt: 'Generate a fraction equivalent to 2/5 by multiplying the numerator and denominator by the same number.',
      steps: ['Multiply numerator and denominator by 3.', '2 × 3 = 6, 5 × 3 = 15.', '2/5 = 6/15.'],
      answer: '6/15',
    },
  }),

  spec<{ numA: number; denomA: number; numB: number; denomB: number }>({
    itemType: 'compare-fractions-different-denominators',
    standard: '4.NF.2',
    lessonFocus: 'comparing two fractions with different numerators and denominators using a common denominator or benchmark',
    build: (difficulty) => {
      const denomA = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [3, 4, 5, 6][rand(0, 3)] : [4, 5, 6, 8][rand(0, 3)]
      let denomB = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [3, 4, 5, 6][rand(0, 3)] : [4, 5, 6, 8][rand(0, 3)]
      while (denomB === denomA) denomB = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [3, 4, 5, 6][rand(0, 3)] : [4, 5, 6, 8][rand(0, 3)]
      const numA = rand(1, denomA - 1)
      const numB = rand(1, denomB - 1)
      const valueA = numA * denomB
      const valueB = numB * denomA
      const symbol = valueA > valueB ? '>' : valueA < valueB ? '<' : '='
      return {
        prompt: `Compare using <, >, or =: ${numA}/${denomA} ___ ${numB}/${denomB}`,
        parameters: { numA, denomA, numB, denomB },
        answer: symbol,
        distractors: [...['>', '<', '='].filter((s) => s !== symbol), 'Cannot be compared without more information'],
        solutionSteps: [
          `Compare using a common denominator: ${numA}/${denomA} = ${numA * denomB}/${denomA * denomB} and ${numB}/${denomB} = ${numB * denomA}/${denomA * denomB}.`,
          `${numA * denomB} ${symbol} ${numB * denomA}, so ${numA}/${denomA} ${symbol} ${numB}/${denomB}.`,
        ],
        commonErrors: [
          {
            observed: 'Compared the numerators alone without accounting for the different denominators.',
            likelyCause: 'Assumed the fraction with the larger numerator is always greater.',
            remediation: 'Have the learner rewrite both fractions with a common denominator before comparing.',
          },
        ],
      }
    },
    oracle: ({ numA, denomA, numB, denomB }) => {
      const left = numA * denomB
      const right = numB * denomA
      return left > right ? '>' : left < right ? '<' : '='
    },
    referenceExample: {
      prompt: 'Compare using <, >, or =: 3/4 ___ 5/8',
      steps: ['Common denominator 8: 3/4 = 6/8.', '6/8 vs 5/8.', '3/4 > 5/8.'],
      answer: '>',
    },
  }),
])
