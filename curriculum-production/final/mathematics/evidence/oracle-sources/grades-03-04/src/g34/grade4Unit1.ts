import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 4 Unit 1 — Mathematical Habits and Place Value to One Million (4.NBT.1, 4.NBT.2, 4.NBT.3, MP.1). */

export const GRADE4_UNIT1 = makeG34UnitBank(4, 1, [
  spec<{ digit: number; placeIndexA: number; placeIndexB: number }>({
    itemType: 'place-value-relationship',
    standard: '4.NBT.1',
    lessonFocus: 'recognizing that a digit in one place represents 10 times what it represents in the place to its right',
    build: (difficulty) => {
      const places = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'] as const
      const placeIndexB = difficulty === 1 ? rand(0, 2) : difficulty === 2 ? rand(1, 3) : rand(2, 4)
      const placeIndexA = placeIndexB + 1
      const digit = rand(1, 9)
      const valueA = digit * 10 ** placeIndexA
      const valueB = digit * 10 ** placeIndexB
      const factor = valueA / valueB
      return {
        prompt: `A digit ${digit} is in the ${places[placeIndexA]} place in one number, and the digit ${digit} is in the ${places[placeIndexB]} place in another number. How many times as great is the first digit's value compared to the second?`,
        parameters: { digit, placeIndexA, placeIndexB },
        answer: String(factor),
        distractors: numericDistractors(factor, [factor / 10, factor * 10, factor + 10]),
        solutionSteps: [
          `The ${places[placeIndexA]} place is one place to the left of the ${places[placeIndexB]} place.`,
          `Each place is worth 10 times the place to its right.`,
          `So the digit's value is ${factor} times as great.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${factor / 10} instead of ${factor}.`,
            likelyCause: 'Counted the number of places instead of applying the ×10 relationship per place.',
            remediation: 'Have the learner write both digits’ full values (with zeros) and divide one by the other.',
          },
        ],
      }
    },
    oracle: ({ placeIndexA, placeIndexB }) => String(10 ** (placeIndexA - placeIndexB)),
    referenceExample: {
      prompt: 'The digit 3 is in the thousands place in one number, and the digit 3 is in the hundreds place in another. How many times as great is the first?',
      steps: ['Thousands is one place left of hundreds.', 'Each place is 10 times the place to its right.', 'The first digit is 10 times as great.'],
      answer: '10',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'compare-multi-digit-numbers',
    standard: '4.NBT.2',
    lessonFocus: 'comparing two multi-digit numbers using place value',
    build: (difficulty) => {
      const digits = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6
      const min = 10 ** (digits - 1)
      const max = 10 ** digits - 1
      let a = rand(min, max)
      let b = rand(min, max)
      while (a === b) b = rand(min, max)
      const symbol = a > b ? '>' : '<'
      return {
        prompt: `Compare using <, >, or =: ${a} ___ ${b}`,
        parameters: { a, b },
        answer: symbol,
        distractors: [...['>', '<', '='].filter((s) => s !== symbol), 'Cannot be compared without more information'],
        solutionSteps: [
          `Compare the numbers place by place, starting from the highest place value.`,
          `${a} is ${symbol === '>' ? 'greater than' : 'less than'} ${b}.`,
        ],
      }
    },
    oracle: ({ a, b }) => (a > b ? '>' : a < b ? '<' : '='),
    referenceExample: {
      prompt: 'Compare using <, >, or =: 48,213 ___ 48,129',
      steps: ['Both have 4 in the ten thousands place.', 'Compare the thousands: 8 vs 8, tie.', 'Compare the hundreds: 2 vs 1.', '48,213 > 48,129.'],
      answer: '>',
    },
  }),

  spec<{ value: number; unit: number }>({
    itemType: 'round-multi-digit-number',
    standard: '4.NBT.3',
    lessonFocus: 'rounding multi-digit whole numbers to any place',
    build: (difficulty) => {
      const unit = difficulty === 1 ? 100 : difficulty === 2 ? 1000 : 10000
      const value = difficulty === 1 ? rand(1000, 9999) : difficulty === 2 ? rand(10000, 99999) : rand(100000, 999999)
      const below = Math.floor(value / unit) * unit
      const above = below + unit
      const rounded = value - below < unit / 2 ? below : value - below === unit / 2 ? above : above
      return {
        prompt: `Round ${value} to the nearest ${unit.toLocaleString('en-US')}.`,
        parameters: { value, unit },
        answer: String(rounded),
        distractors: numericDistractors(rounded, [below, above, value]),
        solutionSteps: [
          `The two multiples of ${unit} nearest ${value} are ${below} and ${above}.`,
          `${value} is closer to ${rounded === below ? below : above}.`,
        ],
      }
    },
    oracle: ({ value, unit }) => {
      const below = Math.floor(value / unit) * unit
      const remainder = value - below
      return String(remainder * 2 >= unit ? below + unit : below)
    },
    referenceExample: {
      prompt: 'Round 583,204 to the nearest 10,000.',
      steps: ['The nearest multiples of 10,000 are 580,000 and 590,000.', '583,204 is closer to 580,000.'],
      answer: '580000',
    },
  }),

  spec<{ kind: number; variant?: number }>({
    itemType: 'mathematical-habits-strategy-choice',
    standard: 'MP.1',
    lessonFocus: 'making sense of an unfamiliar problem before solving it',
    build: (_difficulty, variant = 0) => {
      const kind = rand(0, 2)
      const prompts = [
        'You read a word problem with several numbers in it and are not sure where to start. What should you do first?',
        'You solved a multi-digit problem, but the answer has way more digits than makes sense. What should you do?',
        'A problem could be solved more than one way. What should you do before picking a method?',
        'You need to compare 408,215 and 408,125. What should you examine first?',
        'You are rounding 583,204 to the nearest 10,000. What should you identify before choosing the rounded number?',
        'A learner says the 7 in 70,000 has the same value as the 7 in 7,000. What should you compare?',
        'Two methods give different sums for 38,475 + 16,928. What is the best first check?',
        'A six-digit answer to a subtraction problem is larger than the starting number. What should you do?',
        'A multi-step story includes a table and a paragraph. What should you decide before computing?',
      ]
      const answers = [
        'Restate the problem in your own words and identify exactly what question is being asked.',
        'Estimate the answer first, then compare your exact answer to the estimate to check for a place-value mistake.',
        'Think about which method fits the numbers best, then explain why you chose it.',
        'Compare from the greatest place value and continue only until the first digits differ.',
        'Identify the neighboring multiples 580,000 and 590,000 and compare distances.',
        'Write each digit’s full value and compare 70,000 with 7,000.',
        'Estimate 38,000 + 17,000, then compare both exact sums with the estimate.',
        'Estimate first, then recheck the operation and every regrouping step.',
        'Restate the question and label which information is needed for each step.',
      ]
      const distractorPool = [
        'Guess an answer and move on to the next problem.',
        'Multiply every number in the problem together.',
        'Skip the problem without trying it.',
        'Copy the answer from a different problem that looks similar.',
      ]
      const promptIndex = kind + Math.min(variant, 2) * 3
      return {
        prompt: prompts[promptIndex],
        parameters: { kind, ...(variant === 0 ? {} : { variant: Math.min(variant, 2) }) },
        answer: answers[promptIndex],
        distractors: distractorPool,
        solutionSteps: [`The goal is to make sense of the problem before or while computing.`, `${answers[promptIndex]}`],
      }
    },
    oracle: ({ kind, variant = 0 }) =>
      [
        'Restate the problem in your own words and identify exactly what question is being asked.',
        'Estimate the answer first, then compare your exact answer to the estimate to check for a place-value mistake.',
        'Think about which method fits the numbers best, then explain why you chose it.',
        'Compare from the greatest place value and continue only until the first digits differ.',
        'Identify the neighboring multiples 580,000 and 590,000 and compare distances.',
        'Write each digit’s full value and compare 70,000 with 7,000.',
        'Estimate 38,000 + 17,000, then compare both exact sums with the estimate.',
        'Estimate first, then recheck the operation and every regrouping step.',
        'Restate the question and label which information is needed for each step.',
      ][kind + Math.min(variant, 2) * 3],
    referenceExample: {
      prompt: 'You are not sure whether a word problem wants you to add or multiply. What should you do first?',
      steps: ['Reread the problem and picture the situation.', 'Decide whether equal groups or a running total is being described.'],
      answer: 'Reread the problem, picture the situation, and decide whether it describes equal groups (multiply) or a running total (add).',
    },
  }),
])
