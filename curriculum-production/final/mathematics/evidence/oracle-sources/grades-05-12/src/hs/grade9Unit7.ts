import { fraction, makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 9 Unit 7 — Functions: Concept, Notation, and Interpretation (F-IF.1-5). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)

export const GRADE9_UNIT7 = makeHsUnitBank(9, 7, [
  spec<{ a: number; b: number; c: number; input: number }>({
    itemType: 'evaluate-function-notation',
    standard: 'F-IF.2',
    lessonFocus: 'evaluating functions written in function notation',
    build: (difficulty) => {
      const a = nonZero(difficulty === 3 ? 6 : 3)
      const b = nonZero(difficulty === 3 ? 9 : 5)
      const c = nonZero(difficulty === 3 ? 12 : 7)
      const input = nonZero(difficulty === 3 ? 7 : 4)
      const value = a * input * input + b * input + c
      return {
        prompt: `Given f(x) = ${a}x² ${signed(b)}x ${signed(c)}, find f(${input}).`,
        parameters: { a, b, c, input },
        answer: String(value),
        distractors: numericDistractors(value, [
          a * input * input + b * input,
          (a * input) ** 2 + b * input + c,
          a * input + b * input + c,
          a * (input * input) - b * input + c,
        ]),
        solutionSteps: [
          `Substitute x = ${input} everywhere it appears: f(${input}) = ${a}(${input})² ${signed(b)}(${input}) ${signed(c)}.`,
          `Evaluate the square first: (${input})² = ${input * input}, so the first term is ${a * input * input}.`,
          `The middle term is ${b * input}, and the constant is ${c}.`,
          `Add: ${a * input * input} ${signed(b * input)} ${signed(c)} = ${value}.`,
        ],
        commonErrors: [
          {
            observed: `Squared the whole product and answered ${(a * input) ** 2 + b * input + c}.`,
            likelyCause: 'The exponent was applied to the coefficient as well as the variable.',
            remediation:
              'Bracket the substituted value before squaring, so the exponent attaches only to x.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, input }) => String(a * input ** 2 + b * input + c),
    referenceExample: {
      prompt: 'If f(x) = 2x² − 3x + 1, find f(4).',
      steps: ['2(16) − 3(4) + 1.', '32 − 12 + 1 = 21.'],
      answer: '21',
    },
  }),

  spec<{ kind: number }>({
    itemType: 'identify-function-from-relation',
    standard: 'F-IF.1',
    lessonFocus: 'the definition of a function as a rule with one output per input',
    build: () => {
      const cases = [
        {
          text: 'the set {(1, 3), (2, 5), (3, 7), (4, 9)}',
          answer: 'Yes; each input appears once, so each has exactly one output.',
        },
        {
          text: 'the set {(1, 3), (2, 5), (1, 8), (4, 9)}',
          answer: 'No; the input 1 is paired with both 3 and 8.',
        },
        {
          text: 'the set {(1, 4), (2, 4), (3, 4), (5, 4)}',
          answer: 'Yes; repeated outputs are allowed, only repeated inputs with different outputs are not.',
        },
        {
          text: 'the relation x = y², for real y',
          answer: 'No; the input 4 gives both y = 2 and y = −2.',
        },
      ]
      const kind = rand(0, cases.length - 1)
      const entry = cases[kind]
      return {
        prompt: `Does ${entry.text} define y as a function of x? Justify the decision.`,
        parameters: { kind },
        answer: entry.answer,
        distractors: cases.filter((_, index) => index !== kind).map((other) => other.answer),
        solutionSteps: [
          `A function assigns exactly one output to each input, so check whether any input is repeated with different outputs.`,
          `Examine ${entry.text} against that test.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Rejected a relation because two different inputs shared an output.',
            likelyCause: 'The condition was applied to outputs instead of inputs.',
            remediation:
              'State the rule as "one output per input" and check the direction before testing.',
          },
        ],
      }
    },
    oracle: ({ kind }) =>
      [
        'Yes; each input appears once, so each has exactly one output.',
        'No; the input 1 is paired with both 3 and 8.',
        'Yes; repeated outputs are allowed, only repeated inputs with different outputs are not.',
        'No; the input 4 gives both y = 2 and y = −2.',
      ][kind],
    referenceExample: {
      prompt: 'Is {(1,2),(1,3)} a function?',
      steps: ['Input 1 appears twice with different outputs.', 'That violates the definition.'],
      answer: 'No',
    },
  }),

  spec<{ start: number; rate: number; cap: number }>({
    itemType: 'domain-in-context',
    standard: 'F-IF.5',
    lessonFocus: 'the domain a modelling context permits',
    build: (difficulty) => {
      const rate = rand(2, difficulty === 3 ? 15 : 8)
      const cap = rand(4, difficulty === 3 ? 40 : 20)
      const start = rand(2, 30) * 5
      return {
        prompt: `A machine starts with ${start} components and consumes ${rate} per hour. It can run for at most ${cap} hours. What is the domain of C(h) = ${start} − ${rate}h in this context?`,
        parameters: { start, rate, cap },
        answer: `0 ≤ h ≤ ${Math.min(cap, Math.floor(start / rate))}`,
        distractors: [
          `0 ≤ h ≤ ${cap}`,
          `all real numbers`,
          `0 ≤ h ≤ ${start}`,
          `h ≥ 0`,
        ].filter((value) => value !== `0 ≤ h ≤ ${Math.min(cap, Math.floor(start / rate))}`),
        solutionSteps: [
          `Time cannot be negative, so h ≥ 0.`,
          `The machine runs at most ${cap} hours, so h ≤ ${cap}.`,
          `Components cannot go negative: ${start} − ${rate}h ≥ 0 gives h ≤ ${fraction(start, rate)}, so at most ${Math.floor(start / rate)} whole hours.`,
          `The domain is the tighter of the two upper bounds: 0 ≤ h ≤ ${Math.min(cap, Math.floor(start / rate))}.`,
        ],
        commonErrors: [
          {
            observed: 'Gave the domain as all real numbers because the formula is defined everywhere.',
            likelyCause: 'The algebraic domain was reported instead of the contextual one.',
            remediation:
              'Ask what the variable measures and which values that quantity can actually take.',
          },
        ],
      }
    },
    oracle: ({ start, rate, cap }) =>
      `0 ≤ h ≤ ${Math.min(cap, Math.floor(start / rate))}`,
    referenceExample: {
      prompt: 'C(h) = 100 − 20h, machine runs at most 10 hours. Domain?',
      steps: ['h ≥ 0; h ≤ 10; and 100 − 20h ≥ 0 gives h ≤ 5.', 'The binding limit is 5.'],
      answer: '0 ≤ h ≤ 5',
    },
  }),

  spec<{ first: number; step: number; n: number }>({
    itemType: 'sequence-as-function',
    standard: 'F-IF.3',
    lessonFocus: 'sequences as functions on the whole numbers',
    build: (difficulty) => {
      const first = nonZero(difficulty === 3 ? 15 : 8)
      const step = nonZero(difficulty === 3 ? 9 : 5)
      const n = rand(5, difficulty === 3 ? 30 : 15)
      const value = first + (n - 1) * step
      return {
        prompt: `A sequence is defined by a(1) = ${first} and a(n) = a(n − 1) ${signed(step)} for n > 1. Find a(${n}).`,
        parameters: { first, step, n },
        answer: String(value),
        distractors: numericDistractors(value, [
          first + n * step,
          first * step * n,
          first + (n - 1) * step + step,
          first - (n - 1) * step,
        ]),
        solutionSteps: [
          `The recursive rule adds ${step} at each step, so the sequence is arithmetic with first term ${first}.`,
          `Going from a(1) to a(${n}) takes ${n - 1} steps, not ${n}.`,
          `a(${n}) = ${first} + (${n} − 1)(${step}) = ${first} ${signed((n - 1) * step)}.`,
          `a(${n}) = ${value}.`,
        ],
        commonErrors: [
          {
            observed: `Used n steps instead of n − 1 and answered ${first + n * step}.`,
            likelyCause: 'The first term was counted as one step of growth.',
            remediation:
              'Check the formula at n = 1; it must return the first term exactly.',
          },
        ],
      }
    },
    oracle: ({ first, step, n }) => String(first + (n - 1) * step),
    referenceExample: {
      prompt: 'a(1) = 4, a(n) = a(n−1) + 3. Find a(6).',
      steps: ['Five steps of +3 from 4.', '4 + 15 = 19.'],
      answer: '19',
    },
  }),

  spec<{ feature: number }>({
    itemType: 'interpret-key-graph-features',
    standard: 'F-IF.4',
    lessonFocus: 'interpreting key features of a graph in context',
    build: () => {
      const cases = [
        {
          text: 'the graph of a projectile’s height against time reaches its highest point',
          answer: 'the maximum, giving the greatest height and the time it occurs',
          distractors: [
            'the y-intercept, giving the launch height',
            'the x-intercept, giving the landing time',
            'an interval of decrease',
          ],
        },
        {
          text: 'the graph of a projectile’s height against time crosses the horizontal axis',
          answer: 'a zero, giving the time the projectile returns to ground level',
          distractors: [
            'the maximum, giving the greatest height',
            'the y-intercept, giving the launch height',
            'the average rate of change over the flight',
          ],
        },
        {
          text: 'the graph of a cooling object’s temperature flattens out towards a horizontal line',
          answer: 'an end behaviour approaching the surrounding temperature',
          distractors: [
            'a zero, giving the time the object freezes',
            'a maximum, giving the hottest temperature',
            'an interval of increase',
          ],
        },
      ]
      const feature = rand(0, cases.length - 1)
      const entry = cases[feature]
      return {
        prompt: `In a modelling context, ${entry.text}. Which feature is this, and what does it mean?`,
        parameters: { feature },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `Name the feature from the shape of the graph first, without reference to the story.`,
          `Then translate it into the quantities the axes represent.`,
          `Here the feature is ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Named the feature correctly but did not say what it meant in context.',
            likelyCause: 'The interpretation half of the task was skipped.',
            remediation:
              'Require every feature to be stated twice: once in graph language and once in the units of the axes.',
          },
        ],
      }
    },
    oracle: ({ feature }) =>
      [
        'the maximum, giving the greatest height and the time it occurs',
        'a zero, giving the time the projectile returns to ground level',
        'an end behaviour approaching the surrounding temperature',
      ][feature],
    referenceExample: {
      prompt: 'What does the peak of a height-time graph mean?',
      steps: ['The peak is a maximum.', 'It gives the greatest height and when it happens.'],
      answer: 'the maximum height and its time',
    },
  }),
])
