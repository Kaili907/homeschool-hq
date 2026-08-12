import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 3 Unit 4 — Properties, Patterns, and Two-Step Problems (3.NBT.3, 3.OA.5, 3.OA.7, 3.OA.8, 3.OA.9). */

export const GRADE3_UNIT4 = makeG34UnitBank(3, 4, [
  spec<{ a: number; tens: number }>({
    itemType: 'multiply-by-multiples-of-ten-fluency',
    standard: '3.NBT.3',
    lessonFocus: 'multiplying one-digit numbers by multiples of ten',
    build: (difficulty) => {
      const a = rand(2, difficulty === 1 ? 5 : 9)
      const tens = rand(1, difficulty === 3 ? 9 : 6)
      const b = tens * 10
      const product = a * b
      return {
        prompt: `Find ${a} × ${b}.`,
        parameters: { a, tens },
        answer: String(product),
        distractors: numericDistractors(product, [a * tens, product + 10, product - 10]),
        solutionSteps: [`${b} is ${tens} tens.`, `${a} × ${tens} = ${a * tens}.`, `${a * tens} tens is ${product}.`],
      }
    },
    oracle: ({ a, tens }) => String(a * tens * 10),
    referenceExample: {
      prompt: 'Find 8 × 30.',
      steps: ['30 is 3 tens.', '8 × 3 = 24.', '24 tens is 240.'],
      answer: '240',
    },
  }),

  spec<{ a: number; b: number; c: number; opFirst: number }>({
    itemType: 'two-step-word-problem',
    standard: '3.OA.8',
    lessonFocus: 'solving two-step word problems using the four operations',
    build: (difficulty) => {
      const a = rand(3, difficulty === 1 ? 6 : 9)
      const b = rand(3, difficulty === 3 ? 9 : 6)
      const c = rand(2, difficulty === 3 ? 20 : 12)
      const opFirst = rand(0, 1)
      const product = a * b
      const result = opFirst === 0 ? product + c : product - c
      const prompt =
        opFirst === 0
          ? `A store arranges ${a} shelves with ${b} boxes on each shelf, then adds ${c} more boxes to the display. How many boxes are on display now?`
          : `A store arranges ${a} shelves with ${b} boxes on each shelf, then sells ${c} boxes from the display. How many boxes are left?`
      return {
        prompt,
        parameters: { a, b, c, opFirst },
        answer: String(result),
        distractors: numericDistractors(result, [product, a + b + c, opFirst === 0 ? product - c : product + c]),
        solutionSteps: [
          `First find the boxes on the shelves: ${a} × ${b} = ${product}.`,
          opFirst === 0 ? `Then add the extra boxes: ${product} + ${c} = ${result}.` : `Then subtract the boxes sold: ${product} − ${c} = ${result}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${product} instead of ${result}.`,
            likelyCause: 'Stopped after the first step and forgot the second operation the problem describes.',
            remediation: 'Have the learner underline both actions in the problem before writing any equation.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, opFirst }) => String(opFirst === 0 ? a * b + c : a * b - c),
    referenceExample: {
      prompt: 'A theater sets up 5 rows of 8 chairs, then adds 6 more chairs. How many chairs in all?',
      steps: ['5 × 8 = 40.', '40 + 6 = 46.'],
      answer: '46',
    },
  }),

  spec<{ start: number; step: number; position: number }>({
    itemType: 'identify-arithmetic-pattern',
    standard: '3.OA.9',
    lessonFocus: 'identifying and extending arithmetic patterns',
    build: (difficulty) => {
      const start = rand(1, 10)
      const step = rand(2, difficulty === 3 ? 9 : 6)
      const position = rand(5, 7)
      const value = start + step * (position - 1)
      const sequence = Array.from({ length: 4 }, (_, i) => start + step * i)
      return {
        prompt: `The pattern ${sequence.join(', ')}, ... continues by the same rule. What is the ${position}${position === 5 ? 'th' : position === 6 ? 'th' : 'th'} term?`,
        parameters: { start, step, position },
        answer: String(value),
        distractors: numericDistractors(value, [value + step, value - step, start + step * position]),
        solutionSteps: [
          `Each term increases by ${step}.`,
          `Term 1 is ${start}; term ${position} is ${start} + ${step} × ${position - 1}.`,
          `${start} + ${step} × ${position - 1} = ${value}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${start + step * position} instead of ${value}.`,
            likelyCause: 'Multiplied the step by the term position instead of by (position − 1).',
            remediation: 'Have the learner list every term up to the target position and count the number of jumps, not the number of terms.',
          },
        ],
      }
    },
    oracle: ({ start, step, position }) => String(start + step * (position - 1)),
    referenceExample: {
      prompt: 'The pattern 3, 7, 11, 15, ... continues by the same rule. What is the 6th term?',
      steps: ['Each term increases by 4.', 'Term 6 is 3 + 4 × 5 = 23.'],
      answer: '23',
    },
  }),

  spec<{ kind: number; a: number; b: number; c: number }>({
    itemType: 'property-of-operations-application',
    standard: '3.OA.5',
    lessonFocus: 'using properties of operations as strategies to multiply and divide',
    build: () => {
      const kind = rand(0, 1)
      const a = rand(2, 9)
      const b = rand(2, 9)
      const c = rand(2, 9)
      let prompt: string
      let answer: string
      const distractors: string[] = []
      if (kind === 0) {
        prompt = `Which expression is equal to ${a} × ${b} by the commutative property?`
        answer = `${b} × ${a}`
        distractors.push(`${a} + ${b}`, `${a + 1} × ${b}`, `${a} × ${b + 1}`)
      } else {
        prompt = `Which expression shows ${a} × (${b} + ${c}) rewritten using the distributive property?`
        answer = `(${a} × ${b}) + (${a} × ${c})`
        distractors.push(`${a} × ${b} × ${c}`, `${a} + ${b} + ${c}`, `(${a} + ${b}) × (${a} + ${c})`)
      }
      return {
        prompt,
        parameters: { kind, a, b, c },
        answer,
        distractors,
        solutionSteps: [
          kind === 0
            ? 'The commutative property says changing the order of the factors does not change the product.'
            : 'The distributive property says multiplying a sum is the same as multiplying each addend and adding the products.',
          `So the equal expression is ${answer}.`,
        ],
      }
    },
    oracle: ({ kind, a, b, c }) => (kind === 0 ? `${b} × ${a}` : `(${a} × ${b}) + (${a} × ${c})`),
    referenceExample: {
      prompt: 'Which expression shows 4 × (5 + 2) rewritten using the distributive property?',
      steps: ['Multiply 4 by each addend and add the products.', '4 × (5 + 2) = (4 × 5) + (4 × 2).'],
      answer: '(4 × 5) + (4 × 2)',
    },
  }),

  spec<{ a: number; b: number; isMultiply: number }>({
    itemType: 'fluency-fact-mixed',
    standard: '3.OA.7',
    lessonFocus: 'fluently multiplying and dividing within 100',
    build: (difficulty) => {
      const isMultiply = rand(0, 1)
      const a = rand(2, difficulty === 1 ? 6 : 9)
      const b = rand(2, difficulty === 3 ? 9 : 7)
      const product = a * b
      const prompt = isMultiply ? `Find ${a} × ${b}.` : `Find ${product} ÷ ${a}.`
      const answer = isMultiply ? product : b
      return {
        prompt,
        parameters: { a, b, isMultiply },
        answer: String(answer),
        distractors: numericDistractors(answer, [isMultiply ? a + b : a, isMultiply ? product - a : b + 1, isMultiply ? product + a : b - 1]),
        solutionSteps: isMultiply ? [`${a} × ${b} = ${product}.`] : [`Think: ${a} × ? = ${product}.`, `${a} × ${b} = ${product}, so ${product} ÷ ${a} = ${b}.`],
      }
    },
    oracle: ({ a, b, isMultiply }) => String(isMultiply ? a * b : b),
    referenceExample: {
      prompt: 'Find 48 ÷ 6.',
      steps: ['6 × 8 = 48.', 'So 48 ÷ 6 = 8.'],
      answer: '8',
    },
  }),
])
