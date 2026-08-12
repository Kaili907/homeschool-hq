import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 3 Unit 2 — Meanings of Multiplication and Division (3.OA.1, 3.OA.2, 3.OA.3, 3.OA.4, 3.OA.6). */

const ITEMS = ['crayons', 'marbles', 'cookies', 'stickers', 'seashells'] as const

export const GRADE3_UNIT2 = makeG34UnitBank(3, 2, [
  spec<{ groups: number; perGroup: number; itemIndex: number }>({
    itemType: 'multiplication-as-equal-groups',
    standard: '3.OA.1',
    lessonFocus: 'interpreting products as the total in equal groups',
    build: (difficulty) => {
      const groups = rand(2, difficulty === 1 ? 5 : 9)
      const perGroup = rand(2, difficulty === 3 ? 9 : 6)
      const itemIndex = rand(0, ITEMS.length - 1)
      const item = ITEMS[itemIndex]
      const product = groups * perGroup
      return {
        prompt: `There are ${groups} bags with ${perGroup} ${item} in each bag. How many ${item} are there in all?`,
        parameters: { groups, perGroup, itemIndex },
        answer: String(product),
        distractors: numericDistractors(product, [groups + perGroup, groups * (perGroup + 1), groups * perGroup - groups]),
        solutionSteps: [
          `${groups} equal groups of ${perGroup} means ${groups} × ${perGroup}.`,
          `${groups} × ${perGroup} = ${product}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${groups + perGroup} instead of ${product}.`,
            likelyCause: 'Added the two numbers instead of multiplying the number of groups by the group size.',
            remediation: 'Have the learner draw the groups and count all the items by skip-counting, then compare that total to the addition.',
          },
        ],
      }
    },
    oracle: ({ groups, perGroup }) => String(groups * perGroup),
    referenceExample: {
      prompt: 'There are 4 boxes with 6 pencils in each box. How many pencils in all?',
      steps: ['4 equal groups of 6 is 4 × 6.', '4 × 6 = 24.'],
      answer: '24',
    },
  }),

  spec<{ total: number; groups: number; itemIndex: number }>({
    itemType: 'division-as-equal-groups',
    standard: '3.OA.2',
    lessonFocus: 'interpreting quotients as the size of each equal group',
    build: (difficulty) => {
      const groups = rand(2, difficulty === 1 ? 5 : 8)
      const perGroup = rand(2, difficulty === 3 ? 9 : 6)
      const total = groups * perGroup
      const itemIndex = rand(0, ITEMS.length - 1)
      const item = ITEMS[itemIndex]
      return {
        prompt: `${total} ${item} are shared equally among ${groups} bags. How many ${item} go in each bag?`,
        parameters: { total, groups, itemIndex },
        answer: String(perGroup),
        distractors: numericDistractors(perGroup, [total - groups, groups, total, perGroup + groups]),
        solutionSteps: [
          `Sharing ${total} things equally among ${groups} groups means ${total} ÷ ${groups}.`,
          `${total} ÷ ${groups} = ${perGroup}, because ${groups} × ${perGroup} = ${total}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${groups} instead of ${perGroup}.`,
            likelyCause: 'Reported the number of groups instead of the size of each group.',
            remediation: 'Ask the learner to actually deal the total out one at a time into the groups and count what lands in one group.',
          },
        ],
      }
    },
    oracle: ({ total, groups }) => String(total / groups),
    referenceExample: {
      prompt: '18 marbles are shared equally among 3 bags. How many marbles in each bag?',
      steps: ['18 ÷ 3 asks how many are in each of 3 equal groups.', '3 × 6 = 18, so 18 ÷ 3 = 6.'],
      answer: '6',
    },
  }),

  spec<{ a: number; b: number; isMultiply: number }>({
    itemType: 'multiplication-or-division-word-problem',
    standard: '3.OA.3',
    lessonFocus: 'choosing multiplication or division to solve a word problem within 100',
    build: (difficulty) => {
      const isMultiply = rand(0, 1)
      const a = rand(2, difficulty === 1 ? 6 : 9)
      const b = rand(2, difficulty === 3 ? 9 : 7)
      const product = a * b
      const prompt = isMultiply
        ? `A classroom has ${a} rows of desks with ${b} desks in each row. How many desks are there?`
        : `A teacher has ${product} pencils and gives the same number to each of ${a} students. How many pencils does each student get?`
      const answer = isMultiply ? product : b
      return {
        prompt,
        parameters: { a, b, isMultiply },
        answer: String(answer),
        distractors: numericDistractors(answer, [a + b, isMultiply ? product - a : product, isMultiply ? a : product]),
        solutionSteps: isMultiply
          ? [`${a} rows of ${b} desks is ${a} × ${b}.`, `${a} × ${b} = ${product}.`]
          : [`Sharing ${product} pencils among ${a} students is ${product} ÷ ${a}.`, `${product} ÷ ${a} = ${b}, because ${a} × ${b} = ${product}.`],
        commonErrors: [
          {
            observed: 'Used the wrong operation for the situation described.',
            likelyCause: 'Chose an operation from keywords instead of picturing whether groups are being combined or split apart.',
            remediation: 'Have the learner sketch the groups the problem describes before writing any equation.',
          },
        ],
      }
    },
    oracle: ({ a, b, isMultiply }) => String(isMultiply ? a * b : b),
    referenceExample: {
      prompt: 'A van has 5 rows with 4 seats in each row. How many seats are there?',
      steps: ['5 rows of 4 is 5 × 4.', '5 × 4 = 20.'],
      answer: '20',
    },
  }),

  spec<{ known: number; product: number; missingIsFirst: number }>({
    itemType: 'unknown-number-in-equation',
    standard: '3.OA.4',
    lessonFocus: 'finding the unknown number in a multiplication or division equation',
    build: (difficulty) => {
      const known = rand(2, difficulty === 1 ? 6 : 9)
      const other = rand(2, difficulty === 3 ? 9 : 7)
      const product = known * other
      const missingIsFirst = rand(0, 1)
      const prompt = missingIsFirst
        ? `Find the missing number: ? × ${known} = ${product}`
        : `Find the missing number: ${known} × ? = ${product}`
      return {
        prompt,
        parameters: { known, product, missingIsFirst },
        answer: String(other),
        distractors: numericDistractors(other, [product - known, known, product]),
        solutionSteps: [
          `The equation says one factor times ${known} equals ${product}.`,
          `Divide: ${product} ÷ ${known} = ${other}.`,
          `Check: ${known} × ${other} = ${product}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${product} instead of ${other}.`,
            likelyCause: 'Wrote the product itself instead of solving for the missing factor.',
            remediation: 'Ask the learner to read the equation aloud and name which part is unknown before doing anything.',
          },
        ],
      }
    },
    oracle: ({ known, product }) => String(product / known),
    referenceExample: {
      prompt: 'Find the missing number: 7 × ? = 42',
      steps: ['42 ÷ 7 = 6.', 'Check: 7 × 6 = 42.'],
      answer: '6',
    },
  }),

  spec<{ divisor: number; quotient: number }>({
    itemType: 'division-as-unknown-factor',
    standard: '3.OA.6',
    lessonFocus: 'solving a division problem by thinking of it as an unknown-factor multiplication problem',
    build: (difficulty) => {
      const divisor = rand(2, difficulty === 1 ? 6 : 9)
      const quotient = rand(2, difficulty === 3 ? 9 : 7)
      const dividend = divisor * quotient
      return {
        prompt: `Find ${dividend} ÷ ${divisor} by thinking: ${divisor} × ? = ${dividend}.`,
        parameters: { divisor, quotient },
        answer: String(quotient),
        distractors: numericDistractors(quotient, [dividend - divisor, divisor, dividend]),
        solutionSteps: [
          `${dividend} ÷ ${divisor} asks: what times ${divisor} makes ${dividend}?`,
          `${divisor} × ${quotient} = ${dividend}, so ${dividend} ÷ ${divisor} = ${quotient}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${dividend} instead of ${quotient}.`,
            likelyCause: 'Restated the dividend rather than solving for the unknown factor.',
            remediation: 'Have the learner build the multiplication fact family for this divisor and dividend first.',
          },
        ],
      }
    },
    oracle: ({ divisor, quotient }) => {
      const dividend = divisor * quotient
      return String(dividend / divisor)
    },
    referenceExample: {
      prompt: 'Find 35 ÷ 5 by thinking: 5 × ? = 35.',
      steps: ['5 × 7 = 35.', 'So 35 ÷ 5 = 7.'],
      answer: '7',
    },
  }),
])
