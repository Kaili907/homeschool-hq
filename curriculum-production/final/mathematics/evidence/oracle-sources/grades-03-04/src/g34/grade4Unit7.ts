import { fraction, makeG34UnitBank, rand, spec } from './core.ts'

/** Grade 4 Unit 7 — Adding, Subtracting, and Multiplying Fractions (4.MD.2, 4.NF.3, 4.NF.4). */

export const GRADE4_UNIT7 = makeG34UnitBank(4, 7, [
  spec<{ numA: number; numB: number; denominator: number; add: number }>({
    itemType: 'add-subtract-fractions-same-denominator',
    standard: '4.NF.3',
    lessonFocus: 'adding and subtracting fractions with the same denominator',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [4, 5][rand(0, 1)] : difficulty === 2 ? [6, 8][rand(0, 1)] : [8, 10, 12][rand(0, 2)]
      const add = rand(0, 1)
      let numA: number
      let numB: number
      if (add === 1) {
        numA = rand(1, denominator - 2)
        numB = rand(1, denominator - 1 - numA)
      } else {
        numA = rand(2, denominator - 1)
        numB = rand(1, numA - 1)
      }
      const resultNum = add === 1 ? numA + numB : numA - numB
      return {
        prompt: `Find ${numA}/${denominator} ${add === 1 ? '+' : '−'} ${numB}/${denominator}. Give the answer in lowest terms.`,
        parameters: { numA, numB, denominator, add },
        answer: fraction(resultNum, denominator),
        distractors: [
          `${resultNum + 1}/${denominator}`,
          `${resultNum - 1 >= 1 ? resultNum - 1 : resultNum + 2}/${denominator}`,
          `${numA}/${denominator * 2}`,
          `${resultNum}/${denominator + 1}`,
        ],
        solutionSteps: [
          `The denominators match, so ${add === 1 ? 'add' : 'subtract'} the numerators and keep the denominator: ${numA} ${add === 1 ? '+' : '−'} ${numB} = ${resultNum}.`,
          `${resultNum}/${denominator} in lowest terms is ${fraction(resultNum, denominator)}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${resultNum}/${denominator * 2} instead of ${fraction(resultNum, denominator)}.`,
            likelyCause: `${add === 1 ? 'Added' : 'Subtracted'} the denominators along with the numerators.`,
            remediation: 'Remind the learner that the denominator names the size of the pieces and does not change when combining like pieces.',
          },
        ],
      }
    },
    oracle: ({ numA, numB, denominator, add }) => fraction(add === 1 ? numA + numB : numA - numB, denominator),
    referenceExample: {
      prompt: 'Find 5/8 − 2/8.',
      steps: ['Denominators match, subtract numerators: 5 − 2 = 3.', '3/8 is already in lowest terms.'],
      answer: '3/8',
    },
  }),

  spec<{ numerator: number; denominator: number }>({
    itemType: 'decompose-fraction-as-sum',
    standard: '4.NF.3',
    lessonFocus: 'decomposing a fraction greater than one into a whole number plus a fraction less than one',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [3, 4][rand(0, 1)] : difficulty === 2 ? [4, 5, 6][rand(0, 2)] : [6, 8][rand(0, 1)]
      const numerator = rand(denominator + 1, denominator + (difficulty === 3 ? 6 : 3))
      const whole = Math.floor(numerator / denominator)
      const remainder = numerator % denominator
      return {
        prompt: `Write ${numerator}/${denominator} as a whole number plus a fraction less than 1.`,
        parameters: { numerator, denominator },
        answer: `${whole} ${remainder}/${denominator}`,
        distractors: [
          `${whole - 1} ${remainder}/${denominator}`,
          `${whole} ${remainder + 1}/${denominator}`,
          `${whole + 1} ${remainder}/${denominator}`,
        ],
        solutionSteps: [
          `${denominator}/${denominator} makes one whole. ${numerator} ÷ ${denominator} = ${whole} remainder ${remainder}.`,
          `So ${numerator}/${denominator} = ${whole} whole${whole === 1 ? '' : 's'} and ${remainder}/${denominator}.`,
        ],
      }
    },
    oracle: ({ numerator, denominator }) => `${Math.floor(numerator / denominator)} ${numerator % denominator}/${denominator}`,
    referenceExample: {
      prompt: 'Write 7/3 as a whole number plus a fraction less than 1.',
      steps: ['3/3 makes one whole. 7 ÷ 3 = 2 remainder 1.', '7/3 = 2 and 1/3.'],
      answer: '2 1/3',
    },
  }),

  spec<{ whole: number; denominator: number; count: number }>({
    itemType: 'multiply-fraction-by-whole-number',
    standard: '4.NF.4',
    lessonFocus: 'multiplying a fraction by a whole number',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [3, 4][rand(0, 1)] : difficulty === 2 ? [4, 5, 6][rand(0, 2)] : [5, 6, 8][rand(0, 2)]
      const numerator = rand(1, denominator - 1)
      const count = rand(2, difficulty === 3 ? 8 : 5)
      const resultNumerator = numerator * count
      return {
        prompt: `Find ${count} × ${numerator}/${denominator}.`,
        parameters: { whole: numerator, denominator, count },
        answer: `${resultNumerator}/${denominator}`,
        distractors: [`${numerator}/${denominator * count}`, `${resultNumerator}/${denominator * count}`, `${count}/${denominator}`, `${resultNumerator + 1}/${denominator}`],
        solutionSteps: [
          `${count} × ${numerator}/${denominator} means ${count} groups of ${numerator}/${denominator}.`,
          `Multiply the numerator by ${count}: ${numerator} × ${count} = ${resultNumerator}. The denominator stays ${denominator}.`,
          `The product is ${resultNumerator}/${denominator}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${numerator}/${denominator * count} instead of ${resultNumerator}/${denominator}.`,
            likelyCause: 'Multiplied the denominator instead of the numerator by the whole number.',
            remediation: 'Have the learner draw the groups being combined to see the numerator, not the denominator, is what grows.',
          },
        ],
      }
    },
    oracle: ({ whole, denominator, count }) => `${whole * count}/${denominator}`,
    referenceExample: {
      prompt: 'Find 3 × 2/5.',
      steps: ['3 groups of 2/5.', '2 × 3 = 6.', 'The product is 6/5.'],
      answer: '6/5',
    },
  }),

  spec<{ cupsPerServing: number; denominator: number; servings: number }>({
    itemType: 'fraction-word-problem-measurement',
    standard: '4.MD.2',
    lessonFocus: 'solving measurement word problems involving fractions',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? [2, 4][rand(0, 1)] : difficulty === 2 ? [3, 4][rand(0, 1)] : [4, 8][rand(0, 1)]
      const cupsPerServing = rand(1, denominator - 1)
      const servings = rand(2, difficulty === 3 ? 8 : 5)
      const resultNumerator = cupsPerServing * servings
      return {
        prompt: `A recipe uses ${cupsPerServing}/${denominator} cup of flour per batch. How much flour is needed for ${servings} batches? Give the answer as a fraction of a cup.`,
        parameters: { cupsPerServing, denominator, servings },
        answer: `${resultNumerator}/${denominator}`,
        distractors: [`${cupsPerServing}/${denominator * servings}`, `${servings}/${denominator}`, `${resultNumerator + 1}/${denominator}`, `${resultNumerator}/${denominator * servings}`],
        solutionSteps: [
          `${servings} batches need ${servings} × ${cupsPerServing}/${denominator} cup.`,
          `${cupsPerServing} × ${servings} = ${resultNumerator}, so the total is ${resultNumerator}/${denominator} cup.`,
        ],
      }
    },
    oracle: ({ cupsPerServing, denominator, servings }) => `${cupsPerServing * servings}/${denominator}`,
    referenceExample: {
      prompt: 'A recipe uses 1/4 cup of sugar per batch. How much sugar is needed for 5 batches?',
      steps: ['5 × 1/4 cup.', '1 × 5 = 5.', 'The total is 5/4 cup.'],
      answer: '5/4',
    },
  }),
])
