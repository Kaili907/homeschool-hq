import { choose, clockTime, makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 3 Unit 7 — Measurement: Time, Liquid Volume, and Mass (3.MD.1, 3.MD.2, 3.OA.3). */

export const GRADE3_UNIT7 = makeG34UnitBank(3, 7, [
  spec<{ startMinutes: number; elapsed: number }>({
    itemType: 'elapsed-time',
    standard: '3.MD.1',
    lessonFocus: 'solving elapsed-time problems to the nearest minute',
    build: (difficulty) => {
      const startHour = rand(7, 15)
      const startMin = choose([0, 5, 10, 15, 20, 30, 45])
      const startMinutes = startHour * 60 + startMin
      const elapsed = difficulty === 1 ? rand(5, 45) : difficulty === 2 ? rand(20, 90) : rand(45, 150)
      const endMinutes = startMinutes + elapsed
      const end = clockTime(endMinutes)
      return {
        prompt: `Practice starts at ${clockTime(startMinutes)} and lasts ${elapsed} minutes. What time does practice end?`,
        parameters: { startMinutes, elapsed },
        answer: end,
        distractors: (() => {
          const seenMinutes = new Set<number>([endMinutes])
          const candidates = [endMinutes + 30, endMinutes - 30, startMinutes - elapsed, endMinutes + 60, endMinutes + 15, endMinutes - 45]
          const out: string[] = []
          for (const candidate of candidates) {
            if (out.length >= 3) break
            if (seenMinutes.has(candidate)) continue
            seenMinutes.add(candidate)
            out.push(clockTime(candidate))
          }
          return out
        })(),
        solutionSteps: [
          `Start at ${clockTime(startMinutes)} and count forward ${elapsed} minutes.`,
          `${clockTime(startMinutes)} + ${elapsed} minutes = ${end}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${clockTime(startMinutes - elapsed)} instead of ${end}.`,
            likelyCause: 'Counted backward from the start time instead of forward.',
            remediation: 'Have the learner walk the minutes forward on an analog clock face, five minutes at a time.',
          },
        ],
      }
    },
    oracle: ({ startMinutes, elapsed }) => {
      const total = startMinutes + elapsed
      const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
      const hours24 = Math.floor(normalized / 60)
      const minutes = normalized % 60
      const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
      const suffix = hours24 < 12 ? 'a.m.' : 'p.m.'
      return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
    },
    referenceExample: {
      prompt: 'A movie starts at 2:15 p.m. and lasts 40 minutes. What time does it end?',
      steps: ['Start at 2:15 p.m. and count forward 40 minutes.', '2:15 + 40 minutes = 2:55 p.m.'],
      answer: '2:55 p.m.',
    },
  }),

  spec<{ a: number; b: number; unitIndex: number; add: number }>({
    itemType: 'liquid-volume-or-mass-word-problem',
    standard: '3.MD.2',
    lessonFocus: 'solving word problems involving liquid volume or mass measured in whole units',
    build: (difficulty) => {
      const units = ['liters', 'milliliters', 'grams', 'kilograms'] as const
      const unitIndex = rand(0, units.length - 1)
      const unit = units[unitIndex]
      const add = rand(0, 1)
      const a = difficulty === 1 ? rand(10, 60) : difficulty === 2 ? rand(50, 300) : rand(100, 800)
      const b = difficulty === 1 ? rand(5, 40) : difficulty === 2 ? rand(20, 200) : rand(50, 400)
      const result = add === 1 ? a + b : a - (b > a ? Math.floor(a / 2) : b)
      const bUsed = add === 1 ? b : b > a ? Math.floor(a / 2) : b
      const prompt =
        add === 1
          ? `A container has ${a} ${unit}. Another ${bUsed} ${unit} are poured in. How many ${unit} are in the container now?`
          : `A container has ${a} ${unit}. ${bUsed} ${unit} are removed. How many ${unit} are left?`
      return {
        prompt,
        parameters: { a, b: bUsed, unitIndex, add },
        answer: String(result),
        distractors: numericDistractors(result, [a, bUsed, a + bUsed]),
        solutionSteps: [
          add === 1 ? `Add: ${a} + ${bUsed} = ${result}.` : `Subtract: ${a} − ${bUsed} = ${result}.`,
        ],
      }
    },
    oracle: ({ a, b, add }) => String(add === 1 ? a + b : a - b),
    referenceExample: {
      prompt: 'A jug has 350 milliliters. Another 120 milliliters are poured in. How much is in the jug now?',
      steps: ['350 + 120 = 470.'],
      answer: '470',
    },
  }),

  spec<{ a: number; b: number; isMultiply: number }>({
    itemType: 'multiplication-or-division-word-problem-review',
    standard: '3.OA.3',
    lessonFocus: 'choosing multiplication or division to solve a word problem within 100',
    build: (difficulty) => {
      const isMultiply = rand(0, 1)
      const a = rand(2, difficulty === 1 ? 6 : 9)
      const b = rand(2, difficulty === 3 ? 9 : 7)
      const product = a * b
      const prompt = isMultiply
        ? `A garden has ${a} rows with ${b} plants in each row. How many plants are there?`
        : `A gardener has ${product} seeds and plants the same number in each of ${a} pots. How many seeds go in each pot?`
      const answer = isMultiply ? product : b
      return {
        prompt,
        parameters: { a, b, isMultiply },
        answer: String(answer),
        distractors: numericDistractors(answer, [a + b, isMultiply ? product - a : product, isMultiply ? a : product]),
        solutionSteps: isMultiply
          ? [`${a} rows of ${b} is ${a} × ${b} = ${product}.`]
          : [`${product} ÷ ${a} = ${b}, because ${a} × ${b} = ${product}.`],
      }
    },
    oracle: ({ a, b, isMultiply }) => String(isMultiply ? a * b : b),
    referenceExample: {
      prompt: 'A garden has 6 rows with 5 plants in each row. How many plants are there?',
      steps: ['6 × 5 = 30.'],
      answer: '30',
    },
  }),
])
