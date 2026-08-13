import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 3 Unit 3 — Multiplication and Division Fluency Within 100 (3.NBT.3, 3.OA.4, 3.OA.5, 3.OA.6, 3.OA.7). */

export const GRADE3_UNIT3 = makeG34UnitBank(3, 3, [
  spec<{ a: number; tens: number }>({
    itemType: 'multiply-by-multiples-of-ten',
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
        solutionSteps: [
          `${b} is ${tens} tens, so ${a} × ${b} = ${a} × ${tens} × 10.`,
          `${a} × ${tens} = ${a * tens}.`,
          `${a * tens} × 10 = ${product}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${a * tens} instead of ${product}.`,
            likelyCause: 'Multiplied the basic fact but forgot to place the extra zero for the ten.',
            remediation: 'Have the learner write the basic fact first, then attach one zero for each ten in the multiple of ten.',
          },
        ],
      }
    },
    oracle: ({ a, tens }) => String(a * tens * 10),
    referenceExample: {
      prompt: 'Find 6 × 40.',
      steps: ['40 is 4 tens, so 6 × 40 = 6 × 4 × 10.', '6 × 4 = 24.', '24 × 10 = 240.'],
      answer: '240',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'fluency-multiplication-fact',
    standard: '3.OA.7',
    lessonFocus: 'fluently multiplying within 100',
    build: (difficulty) => {
      const a = rand(2, difficulty === 1 ? 6 : 9)
      const b = rand(2, difficulty === 3 ? 9 : 7)
      const product = a * b
      return {
        prompt: `Find ${a} × ${b}.`,
        parameters: { a, b },
        answer: String(product),
        distractors: numericDistractors(product, [a * (b - 1), a * (b + 1), a + b]),
        solutionSteps: [`${a} groups of ${b}, or ${b} groups of ${a}: ${a} × ${b} = ${product}.`],
        commonErrors: [
          {
            observed: `Answered ${a + b} instead of ${product}.`,
            likelyCause: 'Added the factors instead of multiplying.',
            remediation: 'Have the learner skip-count by one factor, that many times, to rebuild the product.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => String(a * b),
    referenceExample: {
      prompt: 'Find 7 × 8.',
      steps: ['7 groups of 8: 8, 16, 24, 32, 40, 48, 56.', '7 × 8 = 56.'],
      answer: '56',
    },
  }),

  spec<{ divisor: number; quotient: number }>({
    itemType: 'fluency-division-fact',
    standard: '3.OA.7',
    lessonFocus: 'fluently dividing within 100',
    build: (difficulty) => {
      const divisor = rand(2, difficulty === 1 ? 6 : 9)
      const quotient = rand(2, difficulty === 3 ? 9 : 7)
      const dividend = divisor * quotient
      return {
        prompt: `Find ${dividend} ÷ ${divisor}.`,
        parameters: { divisor, quotient },
        answer: String(quotient),
        distractors: numericDistractors(quotient, [dividend - divisor, divisor, quotient + 1]),
        solutionSteps: [`Think: ${divisor} × ? = ${dividend}.`, `${divisor} × ${quotient} = ${dividend}, so ${dividend} ÷ ${divisor} = ${quotient}.`],
        commonErrors: [
          {
            observed: `Answered ${divisor} instead of ${quotient}.`,
            likelyCause: 'Confused the divisor with the quotient.',
            remediation: 'Have the learner say the related multiplication fact out loud before answering.',
          },
        ],
      }
    },
    oracle: ({ divisor, quotient }) => String((divisor * quotient) / divisor),
    referenceExample: {
      prompt: 'Find 54 ÷ 9.',
      steps: ['9 × 6 = 54.', 'So 54 ÷ 9 = 6.'],
      answer: '6',
    },
  }),

  spec<{ kind: number; a: number; b: number; c: number }>({
    itemType: 'property-of-operations',
    standard: '3.OA.5',
    lessonFocus: 'using properties of operations as strategies to multiply',
    build: () => {
      const kind = rand(0, 2)
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
      } else if (kind === 1) {
        prompt = `Which expression shows ${a} × (${b} × ${c}) rewritten using the associative property?`
        answer = `(${a} × ${b}) × ${c}`
        distractors.push(`${a} × ${b} + ${c}`, `(${a} + ${b}) × ${c}`, `${a} × ${c} × ${b} × ${b}`)
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
            : kind === 1
              ? 'The associative property says changing the grouping of the factors does not change the product.'
              : 'The distributive property says multiplying a sum is the same as multiplying each addend and adding the products.',
          `So the equal expression is ${answer}.`,
        ],
      }
    },
    oracle: ({ kind, a, b, c }) =>
      kind === 0 ? `${b} × ${a}` : kind === 1 ? `(${a} × ${b}) × ${c}` : `(${a} × ${b}) + (${a} × ${c})`,
    referenceExample: {
      prompt: 'Which expression is equal to 3 × 7 by the commutative property?',
      steps: ['Changing the order of the factors keeps the same product.', '3 × 7 = 7 × 3.'],
      answer: '7 × 3',
    },
  }),

  spec<{ known: number; product: number }>({
    itemType: 'find-unknown-factor',
    standard: '3.OA.4',
    lessonFocus: 'finding an unknown factor in a multiplication equation',
    build: (difficulty) => {
      const known = rand(2, difficulty === 1 ? 6 : 9)
      const other = rand(2, difficulty === 3 ? 9 : 7)
      const product = known * other
      return {
        prompt: `Find the missing number: ${known} × ? = ${product}`,
        parameters: { known, product },
        answer: String(other),
        distractors: numericDistractors(other, [product - known, known, product]),
        solutionSteps: [`${product} ÷ ${known} = ${other}.`, `Check: ${known} × ${other} = ${product}.`],
      }
    },
    oracle: ({ known, product }) => String(product / known),
    referenceExample: {
      prompt: 'Find the missing number: 6 × ? = 48',
      steps: ['48 ÷ 6 = 8.', 'Check: 6 × 8 = 48.'],
      answer: '8',
    },
  }),

  spec<{ dividend: number; divisor: number }>({
    itemType: 'division-unknown-factor-strategy',
    standard: '3.OA.6',
    lessonFocus: 'relating division to an unknown-factor multiplication problem',
    build: (difficulty) => {
      const divisor = rand(2, difficulty === 1 ? 6 : 9)
      const quotient = rand(2, difficulty === 3 ? 9 : 7)
      const dividend = divisor * quotient
      return {
        prompt: `A teacher has ${dividend} crayons to put into cups of ${divisor} crayons each. How many cups are needed?`,
        parameters: { dividend, divisor },
        answer: String(quotient),
        distractors: numericDistractors(quotient, [dividend - divisor, divisor, dividend]),
        solutionSteps: [
          `Think: ${divisor} × ? = ${dividend}.`,
          `${divisor} × ${quotient} = ${dividend}, so ${dividend} ÷ ${divisor} = ${quotient} cups.`,
        ],
      }
    },
    oracle: ({ dividend, divisor }) => String(dividend / divisor),
    referenceExample: {
      prompt: 'A teacher has 42 pencils to put into cups of 6 pencils each. How many cups are needed?',
      steps: ['6 × 7 = 42.', 'So 42 ÷ 6 = 7 cups.'],
      answer: '7',
    },
  }),
])
