import { makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 4 Unit 3 — Multiplicative Comparison, Factors, Multiples, and Patterns (4.OA.1, 4.OA.2, 4.OA.4, 4.OA.5). */

export const GRADE4_UNIT3 = makeG34UnitBank(4, 3, [
  spec<{ factor: number; base: number }>({
    itemType: 'multiplicative-comparison-statement',
    standard: '4.OA.1',
    lessonFocus: 'interpreting a multiplication equation as a multiplicative comparison',
    build: (difficulty) => {
      const base = rand(2, difficulty === 1 ? 8 : 12)
      const factor = rand(2, difficulty === 3 ? 9 : 6)
      const product = base * factor
      return {
        prompt: `Fill in the blank so the sentence is true: ${product} is ___ times as many as ${base}.`,
        parameters: { factor, base },
        answer: String(factor),
        distractors: numericDistractors(factor, [base, product, product - base]),
        solutionSteps: [`"___ times as many as ${base}" equals ${product} means ___ × ${base} = ${product}.`, `${product} ÷ ${base} = ${factor}.`],
        commonErrors: [
          {
            observed: `Answered ${product} instead of ${factor}.`,
            likelyCause: 'Filled in the total instead of the comparison factor.',
            remediation: 'Have the learner write the equation ? × base = total before answering.',
          },
        ],
      }
    },
    oracle: ({ factor, base }) => {
      const product = base * factor
      return String(product / base)
    },
    referenceExample: {
      prompt: 'Fill in the blank: 24 is ___ times as many as 6.',
      steps: ['? × 6 = 24.', '24 ÷ 6 = 4.'],
      answer: '4',
    },
  }),

  spec<{ base: number; factor: number; nameA: string; nameB: string }>({
    itemType: 'multiplicative-comparison-word-problem',
    standard: '4.OA.2',
    lessonFocus: 'solving multiplicative comparison word problems',
    build: (difficulty) => {
      const names = [
        ['Mia', 'Jacob'],
        ['Ava', 'Noah'],
        ['Liam', 'Sofia'],
      ] as const
      const [nameA, nameB] = names[rand(0, names.length - 1)]
      const base = rand(2, difficulty === 1 ? 8 : 12)
      const factor = rand(2, difficulty === 3 ? 9 : 6)
      const product = base * factor
      return {
        prompt: `${nameA} has ${base} trading cards. ${nameB} has ${factor} times as many cards as ${nameA}. How many cards does ${nameB} have?`,
        parameters: { base, factor, nameA, nameB },
        answer: String(product),
        distractors: numericDistractors(product, [base + factor, base * (factor - 1), base * (factor + 1)]),
        solutionSteps: [`${nameB} has ${factor} times as many as ${base}.`, `${factor} × ${base} = ${product}.`],
      }
    },
    oracle: ({ base, factor }) => String(base * factor),
    referenceExample: {
      prompt: 'Ella has 5 stickers. Zoe has 3 times as many as Ella. How many stickers does Zoe have?',
      steps: ['3 × 5 = 15.'],
      answer: '15',
    },
  }),

  spec<{ n: number }>({
    itemType: 'factors-of-a-number',
    standard: '4.OA.4',
    lessonFocus: 'finding all factor pairs of a whole number within 100',
    build: (difficulty) => {
      const candidates = difficulty === 1 ? [12, 18, 20, 24] : difficulty === 2 ? [28, 36, 40, 45] : [48, 56, 63, 72]
      const n = candidates[rand(0, candidates.length - 1)]
      const factors: number[] = []
      for (let i = 1; i <= n; i += 1) if (n % i === 0) factors.push(i)
      const count = factors.length
      return {
        prompt: `How many whole-number factors does ${n} have?`,
        parameters: { n },
        answer: String(count),
        distractors: numericDistractors(count, [count - 1, count + 1, Math.floor(count / 2)]),
        solutionSteps: [`List every whole number that divides ${n} evenly: ${factors.join(', ')}.`, `That is ${count} factors.`],
      }
    },
    oracle: ({ n }) => {
      let count = 0
      for (let i = 1; i <= n; i += 1) if (n % i === 0) count += 1
      return String(count)
    },
    referenceExample: {
      prompt: 'How many whole-number factors does 12 have?',
      steps: ['1, 2, 3, 4, 6, 12 all divide 12 evenly.', 'That is 6 factors.'],
      answer: '6',
    },
  }),

  spec<{ n: number; limit: number }>({
    itemType: 'multiples-of-a-number',
    standard: '4.OA.4',
    lessonFocus: 'recognizing whether a number is a multiple of a given one-digit number',
    build: (difficulty) => {
      const n = rand(3, difficulty === 3 ? 9 : 7)
      const count = difficulty === 1 ? rand(3, 5) : difficulty === 2 ? rand(5, 8) : rand(8, 11)
      const multiple = n * count
      return {
        prompt: `What is the ${count}${count === 1 ? 'st' : count === 2 ? 'nd' : count === 3 ? 'rd' : 'th'} multiple of ${n}?`,
        parameters: { n, limit: count },
        answer: String(multiple),
        distractors: numericDistractors(multiple, [n * (count - 1), n * (count + 1), n + count]),
        solutionSteps: [`Multiples of ${n} are ${n}, ${2 * n}, ${3 * n}, and so on.`, `The ${count}${count === 1 ? 'st' : count === 2 ? 'nd' : count === 3 ? 'rd' : 'th'} multiple is ${n} × ${count} = ${multiple}.`],
      }
    },
    oracle: ({ n, limit }) => String(n * limit),
    referenceExample: {
      prompt: 'What is the 4th multiple of 6?',
      steps: ['Multiples of 6: 6, 12, 18, 24.', 'The 4th multiple is 24.'],
      answer: '24',
    },
  }),

  spec<{ start: number; rule: number; ruleIsAdd: number; position: number }>({
    itemType: 'number-or-shape-pattern',
    standard: '4.OA.5',
    lessonFocus: 'generating and analyzing a number pattern that follows a given rule',
    build: (difficulty) => {
      const ruleIsAdd = rand(0, 1)
      const start = rand(1, 8)
      const rule = ruleIsAdd === 1 ? rand(2, difficulty === 3 ? 9 : 6) : rand(2, 3)
      const position = rand(5, 6)
      let value = start
      const sequence = [start]
      for (let i = 1; i < position; i += 1) {
        value = ruleIsAdd === 1 ? value + rule : value * rule
        sequence.push(value)
      }
      const shown = sequence.slice(0, 4)
      return {
        prompt: `The pattern ${shown.join(', ')}, ... follows the rule "${ruleIsAdd === 1 ? `add ${rule}` : `multiply by ${rule}`} each time." What is the ${position}${position === 5 ? 'th' : 'th'} term?`,
        parameters: { start, rule, ruleIsAdd, position },
        answer: String(value),
        distractors: numericDistractors(value, [ruleIsAdd === 1 ? value + rule : value * rule, ruleIsAdd === 1 ? value - rule : Math.floor(value / rule), start * position]),
        solutionSteps: [
          `Start at ${start} and apply the rule "${ruleIsAdd === 1 ? `add ${rule}` : `multiply by ${rule}`}" repeatedly.`,
          `The sequence continues: ${sequence.join(', ')}.`,
          `The ${position}th term is ${value}.`,
        ],
      }
    },
    oracle: ({ start, rule, ruleIsAdd, position }) => {
      let value = start
      for (let i = 1; i < position; i += 1) value = ruleIsAdd === 1 ? value + rule : value * rule
      return String(value)
    },
    referenceExample: {
      prompt: 'The pattern 2, 4, 8, 16, ... follows the rule "multiply by 2 each time." What is the 5th term?',
      steps: ['2, 4, 8, 16, 32.', 'The 5th term is 32.'],
      answer: '32',
    },
  }),
])
