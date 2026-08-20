import { fraction, makeHsUnitBank, nonZero, rand, spec } from './core.ts'

/** Grade 11 Unit 7 — Transformations and Inverse Functions (F-BF.3, F-BF.4). */

const sign = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)

export const GRADE11_UNIT7 = makeHsUnitBank(11, 7, [
  spec<{ kind: number; amount: number }>({
    itemType: 'identify-graph-transformation',
    standard: 'F-BF.3',
    lessonFocus: 'the effect of transformations on a graph',
    build: (difficulty) => {
      const kind = rand(0, 3)
      const amount = rand(2, difficulty === 3 ? 9 : 5)
      const forms = [
        `f(x) ${sign(-amount)}`,
        `f(x ${sign(amount)})`,
        `${amount}·f(x)`,
        `f(${amount}x)`,
      ]
      const answers = [
        `a vertical shift up by ${amount}`,
        `a horizontal shift right by ${amount}`,
        `a vertical stretch by a factor of ${amount}`,
        `a horizontal compression by a factor of ${amount}`,
      ]
      return {
        prompt: `The graph of y = f(x) is transformed to y = ${forms[kind]}. Describe the transformation.`,
        parameters: { kind, amount },
        answer: answers[kind],
        distractors: answers
          .filter((_, index) => index !== kind)
          .concat([`a reflection across the x-axis`]),
        solutionSteps: [
          kind === 0 || kind === 2
            ? 'The change is applied outside the function, so it affects outputs and therefore acts vertically.'
            : 'The change is applied to the input inside the function, so it acts horizontally — and horizontally the effect is the opposite of what the sign suggests.',
          kind === 1
            ? `Replacing x by x − ${amount} means the graph reaches each output ${amount} units later, so it shifts right by ${amount}.`
            : kind === 3
              ? `Replacing x by ${amount}x makes the function complete its behaviour ${amount} times faster, compressing it horizontally by a factor of ${amount}.`
              : kind === 0
                ? `Adding ${amount} to every output raises the graph by ${amount}.`
                : `Multiplying every output by ${amount} stretches the graph vertically by a factor of ${amount}.`,
          `The transformation is ${answers[kind]}.`,
        ],
        commonErrors: [
          {
            observed: 'Read a horizontal shift in the direction of the sign inside the bracket.',
            likelyCause: 'Inside-the-function changes were treated like outside ones.',
            remediation:
              'Find the input that makes the bracket zero; that is where the original graph’s starting behaviour now occurs.',
          },
        ],
      }
    },
    oracle: ({ kind, amount }) =>
      [
        `a vertical shift up by ${amount}`,
        `a horizontal shift right by ${amount}`,
        `a vertical stretch by a factor of ${amount}`,
        `a horizontal compression by a factor of ${amount}`,
      ][kind],
    referenceExample: {
      prompt: 'Describe y = f(x − 3).',
      steps: ['The change is inside the function, so horizontal.', 'x − 3 shifts the graph right by 3.'],
      answer: 'a horizontal shift right by 3',
    },
  }),

  spec<{ m: number; b: number }>({
    itemType: 'find-inverse-function',
    standard: 'F-BF.4',
    lessonFocus: 'finding the inverse of a linear function',
    build: (difficulty) => {
      const m = nonZero(difficulty === 3 ? 9 : 5, 2)
      const b = nonZero(difficulty === 3 ? 12 : 7)
      return {
        prompt: `Find the inverse of f(x) = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}.`,
        parameters: { m, b },
        answer: `f⁻¹(x) = (x ${sign(b)}) / ${m}`,
        distractors: [
          `f⁻¹(x) = (x ${sign(-b)}) / ${m}`,
          `f⁻¹(x) = ${m}x ${sign(b)}`,
          `f⁻¹(x) = 1 / (${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)})`,
          `f⁻¹(x) = (x / ${m}) ${sign(b)}`,
        ],
        solutionSteps: [
          `Write y = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} and swap the roles of x and y: x = ${m}y ${b < 0 ? '−' : '+'} ${Math.abs(b)}.`,
          `Solve for y: ${m}y = x ${sign(b)}.`,
          `Divide by ${m}: y = (x ${sign(b)}) / ${m}.`,
          `So f⁻¹(x) = (x ${sign(b)}) / ${m}. Note this is the inverse function, not the reciprocal 1/f(x).`,
        ],
        commonErrors: [
          {
            observed: 'Gave the reciprocal 1/f(x).',
            likelyCause: 'The notation f⁻¹ was read as an exponent.',
            remediation:
              'Check by composition: f(f⁻¹(x)) must simplify to x, which the reciprocal does not.',
          },
        ],
      }
    },
    oracle: ({ m, b }) => {
      const inner = b < 0 ? `+ ${-b}` : `− ${b}`
      return `f⁻¹(x) = (x ${inner}) / ${m}`
    },
    referenceExample: {
      prompt: 'Find the inverse of f(x) = 3x + 6.',
      steps: ['x = 3y + 6.', '3y = x − 6.', 'y = (x − 6)/3.'],
      answer: 'f⁻¹(x) = (x − 6)/3',
    },
  }),

  spec<{ m: number; b: number; input: number }>({
    itemType: 'verify-inverse-by-composition',
    standard: 'F-BF.4',
    lessonFocus: 'verifying inverses through composition',
    build: (difficulty) => {
      const m = nonZero(difficulty === 3 ? 7 : 4, 2)
      const b = nonZero(difficulty === 3 ? 10 : 6)
      const input = nonZero(difficulty === 3 ? 8 : 5)
      return {
        prompt: `For f(x) = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} and its inverse f⁻¹, evaluate f⁻¹(f(${input})).`,
        parameters: { m, b, input },
        answer: String(input),
        distractors: [
          String(m * input + b),
          String(-input),
          String(input + b),
          String(m * input),
          // Small draws can make several of the near-misses coincide with the
          // answer, so keep guaranteed-distinct shifts available.
          String(input + 1),
          String(input - 1),
          String(input + 2),
        ],
        solutionSteps: [
          `Composing a function with its inverse returns the original input, by definition of inverse.`,
          `So f⁻¹(f(${input})) = ${input} without any computation.`,
          `Confirming the long way: f(${input}) = ${m}(${input}) ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${m * input + b}.`,
          `Then f⁻¹(${m * input + b}) = (${m * input + b} ${sign(b)}) / ${m} = ${m * input} / ${m} = ${input}. The two agree.`,
        ],
        commonErrors: [
          {
            observed: `Reported ${m * input + b}, the value of f(${input}).`,
            likelyCause: 'Only the inner function was evaluated.',
            remediation:
              'Track the composition as two steps and confirm the outer function was applied.',
          },
        ],
      }
    },
    oracle: ({ m, b, input }) => {
      // Recompute through both functions rather than appealing to the identity.
      const forward = m * input + b
      return String((forward - b) / m)
    },
    referenceExample: {
      prompt: 'For f(x) = 2x + 1, find f⁻¹(f(5)).',
      steps: ['f(5) = 11.', 'f⁻¹(11) = (11 − 1)/2 = 5.'],
      answer: '5',
    },
  }),

  spec<{ kind: number }>({
    itemType: 'even-odd-symmetry',
    standard: 'F-BF.3',
    lessonFocus: 'even and odd functions and their symmetry',
    build: () => {
      const cases = [
        { text: 'f(x) = x⁴ − 3x² + 1', answer: 'even; its graph is symmetric about the y-axis' },
        { text: 'f(x) = x³ − 4x', answer: 'odd; its graph is symmetric about the origin' },
        { text: 'f(x) = x² + x', answer: 'neither even nor odd' },
        { text: 'f(x) = x⁵ + x³', answer: 'odd; its graph is symmetric about the origin' },
      ]
      const kind = rand(0, cases.length - 1)
      const entry = cases[kind]
      return {
        prompt: `Classify ${entry.text} as even, odd, or neither, and state the corresponding symmetry.`,
        parameters: { kind },
        answer: entry.answer,
        distractors: [
          'even; its graph is symmetric about the y-axis',
          'odd; its graph is symmetric about the origin',
          'neither even nor odd',
          'even; its graph is symmetric about the origin',
        ].filter((value) => value !== entry.answer),
        solutionSteps: [
          `Compute f(−x) and compare it against f(x) and −f(x).`,
          kind === 0
            ? 'Every exponent is even, so replacing x by −x leaves each term unchanged: f(−x) = f(x), which is the definition of even.'
            : kind === 2
              ? 'The x² term is unchanged by the substitution but the x term flips sign, so f(−x) equals neither f(x) nor −f(x).'
              : 'Every exponent is odd, so replacing x by −x flips the sign of every term: f(−x) = −f(x), which is the definition of odd.',
          `Therefore the function is ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Classified a function as even because it contained an even power.',
            likelyCause: 'The test was applied term by term rather than to the whole function.',
            remediation:
              'Compute f(−x) fully and compare the resulting expression against f(x) in its entirety.',
          },
        ],
      }
    },
    oracle: ({ kind }) =>
      [
        'even; its graph is symmetric about the y-axis',
        'odd; its graph is symmetric about the origin',
        'neither even nor odd',
        'odd; its graph is symmetric about the origin',
      ][kind],
    referenceExample: {
      prompt: 'Classify f(x) = x³ − x.',
      steps: ['f(−x) = −x³ + x = −(x³ − x).', 'That is −f(x), so the function is odd.'],
      answer: 'odd',
    },
  }),
])
