import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 3 Unit 1 — Mathematical Habits, Place Value, and Rounding (3.NBT.1, 3.NBT.2). */

const CONTEXTS = [
  { subject: 'a school', item: 'pencils' },
  { subject: 'a library', item: 'books' },
  { subject: 'a farm', item: 'apples' },
  { subject: 'a toy store', item: 'stickers' },
] as const

export const GRADE3_UNIT1 = makeG34UnitBank(3, 1, [
  spec<{ value: number; unit: number }>({
    itemType: 'round-to-nearest-ten-or-hundred',
    standard: '3.NBT.1',
    lessonFocus: 'rounding whole numbers to the nearest 10 or 100',
    build: (difficulty) => {
      const unit = difficulty === 3 ? 100 : 10
      const value = difficulty === 1 ? rand(11, 98) : rand(101, 989)
      const rounded = Math.round(value / unit) * unit
      const digitBelow = Math.floor(value / unit) * unit
      const digitAbove = digitBelow + unit
      return {
        prompt: `Round ${value} to the nearest ${unit}.`,
        parameters: { value, unit },
        answer: String(rounded),
        distractors: numericDistractors(rounded, [digitBelow, digitAbove, value]),
        solutionSteps: [
          `Find the two multiples of ${unit} closest to ${value}: ${digitBelow} and ${digitAbove}.`,
          `${value} is ${value - digitBelow} away from ${digitBelow} and ${digitAbove - value} away from ${digitAbove}.`,
          `The nearer multiple of ${unit} is ${rounded}, so that is the rounded value. (A distance exactly halfway rounds up.)`,
        ],
        commonErrors: [
          {
            observed: `Answered ${digitBelow === rounded ? digitAbove : digitBelow} instead of ${rounded}.`,
            likelyCause: 'Rounded toward the wrong neighboring multiple, or rounded down out of habit regardless of distance.',
            remediation: 'Have the learner mark both neighboring multiples on a number line and measure the distance to each before choosing.',
          },
        ],
      }
    },
    oracle: ({ value, unit }) => {
      const below = Math.floor(value / unit) * unit
      const remainder = value - below
      return String(remainder * 2 >= unit ? below + unit : below)
    },
    referenceExample: {
      prompt: 'Round 647 to the nearest 100.',
      steps: ['The nearest multiples of 100 are 600 and 700.', '647 is 47 away from 600 and 53 away from 700.', '600 is nearer, so 647 rounds to 600.'],
      answer: '600',
    },
  }),

  spec<{ a: number; b: number; contextIndex: number }>({
    itemType: 'add-within-1000',
    standard: '3.NBT.2',
    lessonFocus: 'fluently adding within 1000',
    build: (difficulty) => {
      const contextIndex = rand(0, CONTEXTS.length - 1)
      const context = CONTEXTS[contextIndex]
      const a = difficulty === 1 ? rand(20, 250) : rand(150, 650)
      const b = difficulty === 1 ? rand(20, 250) : rand(150, 340)
      const sum = a + b
      return {
        prompt: `${context.subject.charAt(0).toUpperCase()}${context.subject.slice(1)} had ${a} ${context.item}. They received ${b} more ${context.item}. How many ${context.item} are there now?`,
        parameters: { a, b, contextIndex },
        answer: String(sum),
        distractors: numericDistractors(sum, [a - b, a * 1 + b - 10, a + b + 10, Math.abs(a - b)]),
        solutionSteps: [
          `Add the two amounts: ${a} + ${b}.`,
          `Add the hundreds, tens, and ones, regrouping where a place value totals 10 or more.`,
          `${a} + ${b} = ${sum}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${Math.abs(a - b)} instead of ${sum}.`,
            likelyCause: 'Subtracted instead of adding, or misread the question as a comparison.',
            remediation: 'Ask the learner to restate in their own words whether the total is growing or shrinking before choosing an operation.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => String(a + b),
    referenceExample: {
      prompt: 'A bakery made 248 rolls, then made 175 more. How many rolls in all?',
      steps: ['248 + 175.', 'Add ones: 8 + 5 = 13, regroup 1 ten.', 'Add tens: 4 + 7 + 1 = 12, regroup 1 hundred.', 'Add hundreds: 2 + 1 + 1 = 4.', 'Total: 423.'],
      answer: '423',
    },
  }),

  spec<{ a: number; b: number; contextIndex: number }>({
    itemType: 'subtract-within-1000',
    standard: '3.NBT.2',
    lessonFocus: 'fluently subtracting within 1000',
    build: (difficulty) => {
      const contextIndex = rand(0, CONTEXTS.length - 1)
      const context = CONTEXTS[contextIndex]
      const a = difficulty === 1 ? rand(50, 300) : rand(300, 950)
      const b = rand(20, a - 5)
      const diff = a - b
      return {
        prompt: `${context.subject.charAt(0).toUpperCase()}${context.subject.slice(1)} had ${a} ${context.item}. ${b} ${context.item} were given away. How many ${context.item} are left?`,
        parameters: { a, b, contextIndex },
        answer: String(diff),
        distractors: numericDistractors(diff, [a + b, b - a < 0 ? -(b - a) + 100 : b, diff + 10, diff - 10]),
        solutionSteps: [
          `Subtract: ${a} − ${b}.`,
          `Subtract the ones, tens, and hundreds, regrouping where a place value in the top number is smaller than the one below it.`,
          `${a} − ${b} = ${diff}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${a + b} instead of ${diff}.`,
            likelyCause: 'Added instead of subtracting after misreading "given away" as a gain.',
            remediation: 'Ask the learner to say whether the amount is going up or down before writing the equation.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => String(a - b),
    referenceExample: {
      prompt: 'A farm had 512 apples. 168 apples were sold. How many apples are left?',
      steps: ['512 − 168.', 'Regroup a ten to subtract the ones: 12 − 8 = 4.', 'Regroup a hundred to subtract the tens: 10 − 6 = 4.', 'Subtract hundreds: 4 − 1 = 3.', 'Difference: 344.'],
      answer: '344',
    },
  }),

  spec<{ kind: number }>({
    itemType: 'mathematical-habits-strategy-choice',
    standard: 'MP.1',
    lessonFocus: 'making sense of an unfamiliar problem before solving it',
    build: () => {
      const kind = rand(0, 2)
      const prompts = [
        'You read a word problem and are not sure what it is asking. What should you do first?',
        'You solved a problem, but the answer seems much too large for the situation. What should you do?',
        'A problem has more numbers in it than you need. What should you do before solving?',
      ]
      const answers = [
        'Restate the problem in your own words and identify what question is being asked.',
        'Check the answer against the situation and rework any step that does not make sense.',
        'Decide which numbers the question actually needs before setting up the work.',
      ]
      const distractorPool = [
        'Guess an answer and move on to the next problem.',
        'Multiply every number in the problem together.',
        'Skip the problem without trying it.',
        'Copy the answer from a different problem that looks similar.',
      ]
      return {
        prompt: prompts[kind],
        parameters: { kind },
        answer: answers[kind],
        distractors: distractorPool,
        solutionSteps: [
          `The goal is to make sense of the problem before computing anything.`,
          `${answers[kind]}`,
          `Only after that step does it make sense to choose numbers and an operation.`,
        ],
      }
    },
    oracle: ({ kind }) =>
      [
        'Restate the problem in your own words and identify what question is being asked.',
        'Check the answer against the situation and rework any step that does not make sense.',
        'Decide which numbers the question actually needs before setting up the work.',
      ][kind],
    referenceExample: {
      prompt: 'You are not sure a word problem is asking you to add or subtract. What should you do first?',
      steps: ['Reread the problem and picture what is happening.', 'Decide whether the total is growing or shrinking.', 'Only then choose the operation.'],
      answer: 'Reread the problem, picture the situation, and decide whether the amount is growing or shrinking.',
    },
  }),
])
