import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 4 Unit 4 — Multi-Digit Multiplication with Area Models and Partial Products (4.NBT.1, 4.NBT.5, 4.OA.2, 4.OA.3). */

export const GRADE4_UNIT4 = makeG34UnitBank(4, 4, [
  spec<{ digit: number; placeIndexA: number; placeIndexB: number }>({
    itemType: 'place-value-relationship-multiplication',
    standard: '4.NBT.1',
    lessonFocus: 'recognizing that a digit in one place represents 10 times what it represents in the place to its right',
    build: (difficulty) => {
      const placeIndexB = difficulty === 1 ? rand(0, 2) : difficulty === 2 ? rand(1, 3) : rand(2, 4)
      const placeIndexA = placeIndexB + 1
      const digit = rand(1, 9)
      const factor = 10 ** (placeIndexA - placeIndexB)
      return {
        prompt: `A digit ${digit} moves one place to the left in a number. By what factor does its value change?`,
        parameters: { digit, placeIndexA, placeIndexB },
        answer: String(factor),
        distractors: numericDistractors(factor, [factor / 10, factor * 10, factor + 10]),
        solutionSteps: [`Moving one place to the left multiplies a digit's value by 10.`, `The factor is ${factor}.`],
      }
    },
    oracle: ({ placeIndexA, placeIndexB }) => String(10 ** (placeIndexA - placeIndexB)),
    referenceExample: {
      prompt: 'A digit 7 moves one place to the left. By what factor does its value change?',
      steps: ['Moving one place left multiplies the value by 10.'],
      answer: '10',
    },
  }),

  spec<{ length: number; tens: number; ones: number }>({
    itemType: 'multi-digit-multiplication-area-model',
    standard: '4.NBT.5',
    lessonFocus: 'multiplying a multi-digit number by a one-digit number using an area model',
    build: (difficulty) => {
      const length = rand(2, difficulty === 1 ? 6 : 9)
      const tens = rand(1, difficulty === 3 ? 8 : 5)
      const ones = rand(1, 9)
      const twoDigit = tens * 10 + ones
      const product = length * twoDigit
      const tensProduct = length * tens * 10
      const onesProduct = length * ones
      return {
        prompt: `Use an area model to find ${length} × ${twoDigit}. Split ${twoDigit} into ${tens * 10} and ${ones}.`,
        parameters: { length, tens, ones },
        answer: String(product),
        distractors: numericDistractors(product, [tensProduct, onesProduct, tensProduct + ones]),
        solutionSteps: [
          `${length} × ${tens * 10} = ${tensProduct}.`,
          `${length} × ${ones} = ${onesProduct}.`,
          `${tensProduct} + ${onesProduct} = ${product}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${tensProduct} instead of ${product}.`,
            likelyCause: 'Stopped after finding only the tens part of the area model.',
            remediation: 'Have the learner shade both rectangles of the area model and add both partial products.',
          },
        ],
      }
    },
    oracle: ({ length, tens, ones }) => String(length * (tens * 10 + ones)),
    referenceExample: {
      prompt: 'Use an area model to find 6 × 47. Split 47 into 40 and 7.',
      steps: ['6 × 40 = 240.', '6 × 7 = 42.', '240 + 42 = 282.'],
      answer: '282',
    },
  }),

  spec<{ hundreds: number; tens: number; ones: number; multiplier: number }>({
    itemType: 'multi-digit-multiplication-partial-products',
    standard: '4.NBT.5',
    lessonFocus: 'multiplying a multi-digit number by a one-digit number using partial products',
    build: (difficulty) => {
      const multiplier = rand(2, difficulty === 3 ? 9 : 6)
      const hundreds = rand(1, difficulty === 1 ? 3 : 8)
      const tens = rand(0, 9)
      const ones = rand(1, 9)
      const threeDigit = hundreds * 100 + tens * 10 + ones
      const product = multiplier * threeDigit
      return {
        prompt: `Find ${multiplier} × ${threeDigit} using partial products.`,
        parameters: { hundreds, tens, ones, multiplier },
        answer: String(product),
        distractors: numericDistractors(product, [multiplier * hundreds * 100, multiplier * (threeDigit - ones), product - multiplier]),
        solutionSteps: [
          `${multiplier} × ${hundreds * 100} = ${multiplier * hundreds * 100}.`,
          `${multiplier} × ${tens * 10} = ${multiplier * tens * 10}.`,
          `${multiplier} × ${ones} = ${multiplier * ones}.`,
          `${multiplier * hundreds * 100} + ${multiplier * tens * 10} + ${multiplier * ones} = ${product}.`,
        ],
      }
    },
    oracle: ({ hundreds, tens, ones, multiplier }) => String(multiplier * (hundreds * 100 + tens * 10 + ones)),
    referenceExample: {
      prompt: 'Find 4 × 326 using partial products.',
      steps: ['4 × 300 = 1200.', '4 × 20 = 80.', '4 × 6 = 24.', '1200 + 80 + 24 = 1304.'],
      answer: '1304',
    },
  }),

  spec<{ base: number; factor: number; nameA: string; nameB: string }>({
    itemType: 'multiplicative-comparison-word-problem-review',
    standard: '4.OA.2',
    lessonFocus: 'solving multiplicative comparison word problems',
    build: (difficulty) => {
      const names = [
        ['Ben', 'Priya'],
        ['Carlos', 'Emma'],
      ] as const
      const [nameA, nameB] = names[rand(0, names.length - 1)]
      const base = rand(2, difficulty === 1 ? 8 : 12)
      const factor = rand(2, difficulty === 3 ? 9 : 6)
      const product = base * factor
      return {
        prompt: `${nameA} read ${base} books this year. ${nameB} read ${factor} times as many books as ${nameA}. How many books did ${nameB} read?`,
        parameters: { base, factor, nameA, nameB },
        answer: String(product),
        distractors: numericDistractors(product, [base + factor, base * (factor - 1), base * (factor + 1)]),
        solutionSteps: [`${nameB} read ${factor} times as many as ${base}.`, `${factor} × ${base} = ${product}.`],
      }
    },
    oracle: ({ base, factor }) => String(base * factor),
    referenceExample: {
      prompt: 'Sam read 4 books. Priya read 5 times as many as Sam. How many did Priya read?',
      steps: ['5 × 4 = 20.'],
      answer: '20',
    },
  }),

  spec<{ length: number; width: number; c: number; opFirst: number }>({
    itemType: 'multistep-word-problem-multiplication',
    standard: '4.OA.3',
    lessonFocus: 'solving multistep word problems using multiplication and another operation',
    build: (difficulty) => {
      const length = rand(3, difficulty === 1 ? 6 : 9)
      const width = rand(10, difficulty === 3 ? 60 : 40)
      const c = rand(5, difficulty === 3 ? 100 : 50)
      const opFirst = rand(0, 1)
      const product = length * width
      const result = opFirst === 0 ? product + c : product - c
      const prompt =
        opFirst === 0
          ? `A theater has ${length} sections with ${width} seats each, plus ${c} extra folding chairs. How many total seats are there?`
          : `A theater has ${length} sections with ${width} seats each, but ${c} seats are roped off for repairs. How many usable seats remain?`
      return {
        prompt,
        parameters: { length, width, c, opFirst },
        answer: String(result),
        distractors: numericDistractors(result, [product, length + width + c, opFirst === 0 ? product - c : product + c]),
        solutionSteps: [
          `First find the total seats: ${length} × ${width} = ${product}.`,
          opFirst === 0 ? `Then add the extra chairs: ${product} + ${c} = ${result}.` : `Then subtract the roped-off seats: ${product} − ${c} = ${result}.`,
        ],
      }
    },
    oracle: ({ length, width, c, opFirst }) => String(opFirst === 0 ? length * width + c : length * width - c),
    referenceExample: {
      prompt: 'A parking garage has 5 levels with 32 spots each, plus 8 street spots. How many total spots?',
      steps: ['5 × 32 = 160.', '160 + 8 = 168.'],
      answer: '168',
    },
  }),
])
