import { makeG34UnitBank, rand, spec } from './core.ts'

/** Grade 3 Unit 6 — Equivalent Fractions and Comparison (3.G.2, 3.NF.1, 3.NF.2, 3.NF.3). */

export const GRADE3_UNIT6 = makeG34UnitBank(3, 6, [
  spec<{ parts: number }>({
    itemType: 'partition-shape-equal-areas-review',
    standard: '3.G.2',
    lessonFocus: 'partitioning shapes into parts with equal area and naming the unit fraction',
    build: (difficulty) => {
      const parts = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [4, 6, 8][rand(0, 2)] : [6, 8][rand(0, 1)]
      return {
        prompt: `A rectangle is partitioned into ${parts} parts of equal area. What fraction of the rectangle does one part represent?`,
        parameters: { parts },
        answer: `1/${parts}`,
        distractors: [`${parts}/1`, `1/${parts - 1}`, `1/${parts + 1}`, `${parts}/${parts}`],
        solutionSteps: [`The whole is split into ${parts} equal parts.`, `One part is 1/${parts}.`],
      }
    },
    oracle: ({ parts }) => `1/${parts}`,
    referenceExample: {
      prompt: 'A rectangle is partitioned into 3 parts of equal area. What fraction is one part?',
      steps: ['3 equal parts make up the whole.', 'One part is 1/3.'],
      answer: '1/3',
    },
  }),

  spec<{ numerator: number; denominator: number; factor: number }>({
    itemType: 'equivalent-fractions',
    standard: '3.NF.3',
    lessonFocus: 'recognizing and generating simple equivalent fractions',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [2, 4][rand(0, 1)] : difficulty === 2 ? [3, 4, 6][rand(0, 2)] : [4, 6, 8][rand(0, 2)]
      const numerator = rand(1, denominator - 1)
      const factor = rand(2, 3)
      const equivNumerator = numerator * factor
      const equivDenominator = denominator * factor
      return {
        prompt: `Which fraction is equivalent to ${numerator}/${denominator}?`,
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
        commonErrors: [
          {
            observed: `Answered ${equivNumerator}/${denominator} instead of ${equivNumerator}/${equivDenominator}.`,
            likelyCause: 'Multiplied only the numerator, changing the size of the pieces represented.',
            remediation: 'Remind the learner that both the numerator and denominator must be multiplied by the same number to keep the same value.',
          },
        ],
      }
    },
    oracle: ({ numerator, denominator, factor }) => `${numerator * factor}/${denominator * factor}`,
    referenceExample: {
      prompt: 'Which fraction is equivalent to 1/3?',
      steps: ['Multiply numerator and denominator by 2.', '1 × 2 = 2, 3 × 2 = 6.', '1/3 = 2/6.'],
      answer: '2/6',
    },
  }),

  spec<{ numA: number; numB: number; denominator: number; sameDenominator: number }>({
    itemType: 'compare-fractions-same-whole',
    standard: '3.NF.3',
    lessonFocus: 'comparing two fractions that refer to the same whole',
    build: (difficulty) => {
      const sameDenominator = rand(0, 1)
      if (sameDenominator === 1) {
        const denominator = difficulty === 1 ? rand(3, 4) : [4, 6, 8][rand(0, 2)]
        let numA = rand(1, denominator - 1)
        let numB = rand(1, denominator - 1)
        while (numB === numA) numB = rand(1, denominator - 1)
        const answer = numA > numB ? `${numA}/${denominator}` : `${numB}/${denominator}`
        return {
          prompt: `Which fraction is greater: ${numA}/${denominator} or ${numB}/${denominator}?`,
          parameters: { numA, numB, denominator, sameDenominator },
          answer,
          distractors: [numA > numB ? `${numB}/${denominator}` : `${numA}/${denominator}`, 'They are equal.', `${denominator}/${denominator}`],
          solutionSteps: [
            `Both fractions refer to the same whole, split into ${denominator} equal parts.`,
            `More parts out of the same-size whole is greater: ${Math.max(numA, numB)} parts is more than ${Math.min(numA, numB)} parts.`,
            `${answer} is greater.`,
          ],
        }
      }
      const numA = 1
      const pool = difficulty === 1 ? [2, 3, 4] : [2, 3, 4, 6, 8]
      const denomA = pool[rand(0, pool.length - 1)]
      let denomB = pool[rand(0, pool.length - 1)]
      while (denomB === denomA) denomB = pool[rand(0, pool.length - 1)]
      const answer = denomA < denomB ? `${numA}/${denomA}` : `${numA}/${denomB}`
      return {
        prompt: `Which fraction is greater: ${numA}/${denomA} or ${numA}/${denomB}?`,
        parameters: { numA, numB: numA, denominator: denomA < denomB ? denomA : denomB, sameDenominator },
        answer,
        distractors: [denomA < denomB ? `${numA}/${denomB}` : `${numA}/${denomA}`, 'They are equal.', `${numA}/${denomA + denomB}`],
        solutionSteps: [
          `Both fractions have the same numerator, ${numA}.`,
          `The same number of parts from a whole cut into fewer, larger pieces is greater: ${denomA < denomB ? denomA : denomB} pieces are bigger than ${denomA < denomB ? denomB : denomA} pieces.`,
          `${answer} is greater.`,
        ],
      }
    },
    oracle: ({ numA, numB, denominator, sameDenominator }) => {
      if (sameDenominator === 1) return numA > numB ? `${numA}/${denominator}` : `${numB}/${denominator}`
      return `${numA}/${denominator}`
    },
    referenceExample: {
      prompt: 'Which fraction is greater: 3/8 or 5/8?',
      steps: ['Same whole, same denominator.', '5 eighths is more than 3 eighths.', '5/8 is greater.'],
      answer: '5/8',
    },
  }),

  spec<{ numerator: number; denominator: number }>({
    itemType: 'fraction-on-number-line-review',
    standard: '3.NF.2',
    lessonFocus: 'locating a fraction as a point on a number line between 0 and 1',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? rand(2, 4) : difficulty === 2 ? [4, 6][rand(0, 1)] : [6, 8][rand(0, 1)]
      const numerator = rand(1, denominator - 1)
      return {
        prompt: `A number line from 0 to 1 is divided into ${denominator} equal lengths. What fraction names the point that is ${numerator} lengths from 0?`,
        parameters: { numerator, denominator },
        answer: `${numerator}/${denominator}`,
        distractors: [`${denominator}/${numerator}`, `${numerator}/${denominator - 1}`, `${numerator + 1}/${denominator}`, `${numerator === 1 ? numerator + 2 : numerator - 1}/${denominator}`],
        solutionSteps: [`Each length is 1/${denominator}.`, `${numerator} lengths from 0 is ${numerator}/${denominator}.`],
      }
    },
    oracle: ({ numerator, denominator }) => `${numerator}/${denominator}`,
    referenceExample: {
      prompt: 'A number line from 0 to 1 is divided into 4 equal lengths. What fraction names the point 1 length from 0?',
      steps: ['Each length is 1/4.', '1 length from 0 is 1/4.'],
      answer: '1/4',
    },
  }),

  spec<{ shaded: number; parts: number }>({
    itemType: 'identify-unit-fraction-review',
    standard: '3.NF.1',
    lessonFocus: 'naming a fraction a/b as a parts out of b equal parts',
    build: (difficulty) => {
      const parts = difficulty === 1 ? rand(2, 4) : difficulty === 2 ? [4, 6][rand(0, 1)] : [6, 8][rand(0, 1)]
      const shaded = rand(1, parts - 1)
      return {
        prompt: `A shape is divided into ${parts} equal parts. ${shaded} of the parts are shaded. What fraction is shaded?`,
        parameters: { shaded, parts },
        answer: `${shaded}/${parts}`,
        distractors: [`${parts}/${shaded}`, `${shaded}/${parts - 1}`, `${shaded}/${parts + 1}`, `${parts - shaded}/${parts}`],
        solutionSteps: [`${parts} equal parts is the denominator.`, `${shaded} shaded parts is the numerator.`, `The fraction is ${shaded}/${parts}.`],
      }
    },
    oracle: ({ shaded, parts }) => `${shaded}/${parts}`,
    referenceExample: {
      prompt: 'A shape is divided into 8 equal parts. 3 are shaded. What fraction is shaded?',
      steps: ['8 equal parts is the denominator.', '3 shaded is the numerator.', 'The fraction is 3/8.'],
      answer: '3/8',
    },
  }),
])
