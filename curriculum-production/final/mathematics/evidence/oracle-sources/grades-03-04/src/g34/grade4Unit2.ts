import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 4 Unit 2 — Multi-Digit Addition and Subtraction (4.NBT.1, 4.NBT.3, 4.NBT.4, 4.OA.3). */

export const GRADE4_UNIT2 = makeG34UnitBank(4, 2, [
  spec<{ value: number; unit: number }>({
    itemType: 'round-multi-digit-number-review',
    standard: '4.NBT.3',
    lessonFocus: 'rounding multi-digit whole numbers to any place',
    build: (difficulty) => {
      const unit = difficulty === 1 ? 100 : difficulty === 2 ? 1000 : 10000
      const value = difficulty === 1 ? rand(1000, 9999) : difficulty === 2 ? rand(10000, 99999) : rand(100000, 999999)
      const below = Math.floor(value / unit) * unit
      const above = below + unit
      const rounded = value - below < unit / 2 ? below : above
      return {
        prompt: `Round ${value} to the nearest ${unit}.`,
        parameters: { value, unit },
        answer: String(rounded),
        distractors: numericDistractors(rounded, [below, above, value]),
        solutionSteps: [`The nearest multiples of ${unit} are ${below} and ${above}.`, `${value} is closer to ${rounded}.`],
      }
    },
    oracle: ({ value, unit }) => {
      const below = Math.floor(value / unit) * unit
      const remainder = value - below
      return String(remainder * 2 >= unit ? below + unit : below)
    },
    referenceExample: {
      prompt: 'Round 24,681 to the nearest 1,000.',
      steps: ['The nearest multiples of 1,000 are 24,000 and 25,000.', '24,681 is closer to 25,000.'],
      answer: '25000',
    },
  }),

  spec<{ a: number; b: number; contextIndex: number }>({
    itemType: 'multi-digit-addition',
    standard: '4.NBT.4',
    lessonFocus: 'fluently adding multi-digit whole numbers using the standard algorithm',
    build: (difficulty) => {
      const contexts = ['a concert', 'a stadium', 'a food drive', 'a fundraiser'] as const
      const contextIndex = rand(0, contexts.length - 1)
      const digits = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6
      const min = 10 ** (digits - 1)
      // Course scope caps Grade 4 whole-number work at 1,000,000 (see
      // standards-map.json scope_notes), so the max for each addend is
      // capped at half that ceiling at 6 digits, keeping every sum within it.
      const max = digits === 6 ? 500_000 : 10 ** digits - 1
      const a = rand(min, max)
      const b = rand(min, max)
      const sum = a + b
      return {
        prompt: `${contexts[contextIndex]} raised ${a} dollars on Saturday and ${b} dollars on Sunday. What was the total number of dollars raised?`,
        parameters: { a, b, contextIndex },
        answer: String(sum),
        distractors: numericDistractors(sum, [a - b < 0 ? b - a : a - b, sum + 1000, sum - 1000]),
        solutionSteps: [
          `Add ${a} + ${b}, regrouping any place value that totals 10 or more.`,
          `${a} + ${b} = ${sum}.`,
        ],
      }
    },
    oracle: ({ a, b }) => String(a + b),
    referenceExample: {
      prompt: 'A theater sold 24,861 tickets in week one and 18,957 in week two. How many total?',
      steps: ['24,861 + 18,957.', 'Add each place, regrouping as needed.', 'Total: 43,818.'],
      answer: '43818',
    },
  }),

  spec<{ a: number; b: number; contextIndex: number }>({
    itemType: 'multi-digit-subtraction',
    standard: '4.NBT.4',
    lessonFocus: 'fluently subtracting multi-digit whole numbers using the standard algorithm',
    build: (difficulty) => {
      const contexts = ['a concert', 'a stadium', 'a warehouse', 'a school'] as const
      const contextIndex = rand(0, contexts.length - 1)
      const digits = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6
      const min = 10 ** (digits - 1)
      const max = 10 ** digits - 1
      const a = rand(min, max)
      const b = rand(min, a - 1)
      const diff = a - b
      return {
        prompt: `${contexts[contextIndex]} had ${a} visitors expected, but only ${b} attended. How many fewer people attended than expected?`,
        parameters: { a, b, contextIndex },
        answer: String(diff),
        distractors: numericDistractors(diff, [a + b, diff + 1000, diff - 1000]),
        solutionSteps: [
          `Subtract ${a} − ${b}, regrouping any place value where the top digit is smaller.`,
          `${a} − ${b} = ${diff}.`,
        ],
      }
    },
    oracle: ({ a, b }) => String(a - b),
    referenceExample: {
      prompt: 'A stadium holds 62,000 seats. 47,318 seats were filled. How many were empty?',
      steps: ['62,000 − 47,318.', 'Regroup across the zeros as needed.', 'Difference: 14,682.'],
      answer: '14682',
    },
  }),

  spec<{ a: number; b: number; c: number; opFirst: number }>({
    itemType: 'multistep-word-problem-addition-subtraction',
    standard: '4.OA.3',
    lessonFocus: 'solving multistep word problems using addition and subtraction',
    build: (difficulty) => {
      const a = difficulty === 1 ? rand(500, 3000) : difficulty === 2 ? rand(2000, 20000) : rand(10000, 90000)
      const b = difficulty === 1 ? rand(200, 1500) : difficulty === 2 ? rand(1000, 8000) : rand(5000, 40000)
      const c = difficulty === 1 ? rand(100, 900) : difficulty === 2 ? rand(500, 4000) : rand(2000, 20000)
      const opFirst = rand(0, 1)
      const sum = a + b
      const result = opFirst === 0 ? sum - c : sum + c
      const prompt =
        opFirst === 0
          ? `A charity collected $${a} in the spring and $${b} in the fall, then spent $${c} on supplies. How much money remains?`
          : `A charity collected $${a} in the spring and $${b} in the fall, then received an extra $${c} donation. How much money is there in total?`
      return {
        prompt,
        parameters: { a, b, c, opFirst },
        answer: String(result),
        distractors: numericDistractors(result, [sum, a + c, opFirst === 0 ? sum + c : sum - c]),
        solutionSteps: [
          `First combine the two collections: ${a} + ${b} = ${sum}.`,
          opFirst === 0 ? `Then subtract the amount spent: ${sum} − ${c} = ${result}.` : `Then add the extra donation: ${sum} + ${c} = ${result}.`,
        ],
      }
    },
    oracle: ({ a, b, c, opFirst }) => String(opFirst === 0 ? a + b - c : a + b + c),
    referenceExample: {
      prompt: 'A school raised $3,200 in September and $2,750 in October, then spent $1,400 on new books. How much remains?',
      steps: ['3,200 + 2,750 = 5,950.', '5,950 − 1,400 = 4,550.'],
      answer: '4550',
    },
  }),
])
