import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 4 Unit 5 — Division with Remainders (4.NBT.6, 4.OA.3). */

export const GRADE4_UNIT5 = makeG34UnitBank(4, 5, [
  spec<{ divisor: number; quotient: number; remainder: number }>({
    itemType: 'division-with-remainder',
    standard: '4.NBT.6',
    lessonFocus: 'dividing a multi-digit number by a one-digit number, expressing the remainder',
    build: (difficulty) => {
      const divisor = rand(3, difficulty === 3 ? 9 : 6)
      const quotient = rand(difficulty === 1 ? 10 : 20, difficulty === 3 ? 200 : 90)
      const remainder = rand(1, divisor - 1)
      const dividend = divisor * quotient + remainder
      return {
        prompt: `Find ${dividend} ÷ ${divisor}. Write the answer as a quotient and remainder.`,
        parameters: { divisor, quotient, remainder },
        answer: `${quotient} r${remainder}`,
        distractors: [
          `${quotient} r${remainder + 1 < divisor ? remainder + 1 : 1}`,
          `${quotient + 1} r${remainder}`,
          `${quotient - 1} r${remainder}`,
        ],
        solutionSteps: [
          `${divisor} × ${quotient} = ${divisor * quotient}.`,
          `${dividend} − ${divisor * quotient} = ${remainder}, and ${remainder} is less than ${divisor}.`,
          `So ${dividend} ÷ ${divisor} = ${quotient} remainder ${remainder}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${quotient} r${divisor} instead of ${quotient} r${remainder}.`,
            likelyCause: 'Used the divisor itself as the remainder instead of subtracting to find what is left over.',
            remediation: 'Remind the learner the remainder must always be smaller than the divisor — check by subtracting.',
          },
        ],
      }
    },
    oracle: ({ divisor, quotient, remainder }) => {
      const dividend = divisor * quotient + remainder
      const q = Math.floor(dividend / divisor)
      const r = dividend - divisor * q
      return `${q} r${r}`
    },
    referenceExample: {
      prompt: 'Find 53 ÷ 6.',
      steps: ['6 × 8 = 48.', '53 − 48 = 5, and 5 is less than 6.', '53 ÷ 6 = 8 remainder 5.'],
      answer: '8 r5',
    },
  }),

  spec<{ divisor: number; quotient: number; remainder: number; kind: number }>({
    itemType: 'interpret-remainder-in-word-problem',
    standard: '4.OA.3',
    lessonFocus: 'interpreting a division remainder based on the context of the problem',
    build: (difficulty) => {
      const divisor = rand(3, difficulty === 3 ? 9 : 6)
      const quotient = rand(difficulty === 1 ? 4 : 8, difficulty === 3 ? 40 : 20)
      const remainder = rand(1, divisor - 1)
      const dividend = divisor * quotient + remainder
      const kind = rand(0, 1)
      const prompt =
        kind === 0
          ? `${dividend} students are going on a field trip. Each van holds ${divisor} students. How many vans are needed so every student has a seat?`
          : `A baker has ${dividend} eggs and needs ${divisor} eggs for each cake. How many whole cakes can be made?`
      const answer = kind === 0 ? quotient + 1 : quotient
      return {
        prompt,
        parameters: { divisor, quotient, remainder, kind },
        answer: String(answer),
        distractors: numericDistractors(answer, [quotient, quotient + 1, quotient - 1]),
        solutionSteps: [
          `${dividend} ÷ ${divisor} = ${quotient} remainder ${remainder}.`,
          kind === 0
            ? `The ${remainder} leftover students still need a van, so round the quotient up to ${quotient + 1} vans.`
            : `The leftover ${remainder} eggs are not enough for another whole cake, so the answer stays at ${quotient} cakes.`,
        ],
        commonErrors: [
          {
            observed: kind === 0 ? `Answered ${quotient} instead of ${quotient + 1}.` : `Answered ${quotient + 1} instead of ${quotient}.`,
            likelyCause: 'Applied the same rounding rule to every remainder problem instead of reasoning about what the leftover amount means in context.',
            remediation: 'Ask the learner what happens to the leftover amount in this specific situation before deciding whether to round up, round down, or report the remainder itself.',
          },
        ],
      }
    },
    oracle: ({ divisor, quotient, remainder, kind }) => {
      const dividend = divisor * quotient + remainder
      const q = Math.floor(dividend / divisor)
      const r = dividend - divisor * q
      return String(kind === 0 ? (r > 0 ? q + 1 : q) : q)
    },
    referenceExample: {
      prompt: '29 students need vans that hold 8 students each. How many vans are needed?',
      steps: ['29 ÷ 8 = 3 remainder 5.', 'The 5 leftover students still need a van.', '4 vans are needed.'],
      answer: '4',
    },
  }),
])
