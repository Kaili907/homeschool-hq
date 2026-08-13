import { choose, fraction, makeHsUnitBank, nonZero, rand, spec } from './core.ts'

/** Grade 9 Unit 3 — Reasoning with Linear Equations and Inequalities (A-REI.1, 3, 10, 11). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)

export const GRADE9_UNIT3 = makeHsUnitBank(9, 3, [
  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'solve-linear-equation',
    standard: 'A-REI.3',
    lessonFocus: 'solving linear equations in one variable',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 12 : difficulty === 2 ? 8 : 5
      const solution = nonZero(bound)
      const a = nonZero(bound)
      let c = nonZero(bound)
      // The equation needs a - c non-zero for a unique solution, and the
      // distractor set divides by a + c, so keep that non-zero too.
      if (c === a) c = a > 0 ? a + 1 : a - 1
      if (c === -a) c = a > 0 ? a + 2 : a - 2
      if (c === 0) c = 1
      const b = nonZero(bound)
      // Construct d so the equation is satisfied exactly at `solution`.
      const d = (a - c) * solution + b
      return {
        prompt: `Solve for x: ${a}x ${signed(b)} = ${c}x ${signed(d)}.`,
        parameters: { a, b, c, d },
        answer: `x = ${fraction(d - b, a - c)}`,
        distractors: [
          `x = ${fraction(b - d, a - c)}`,
          `x = ${fraction(d + b, a - c)}`,
          `x = ${fraction(d - b, a + c)}`,
          `x = ${fraction(d - b, c - a)}`,
          `x = ${fraction(d - b + 1, a - c)}`,
          `x = ${fraction(d - b - 1, a - c)}`,
          `x = ${fraction(d - b + 2, a - c)}`,
        ],
        solutionSteps: [
          `Collect the x terms on one side: ${a}x − ${c}x = ${d} − ${b}, so ${a - c}x = ${d - b}.`,
          `Divide both sides by ${a - c}.`,
          `x = ${fraction(d - b, a - c)}.`,
          `Check by substitution: both sides evaluate to the same number at this x.`,
        ],
        commonErrors: [
          {
            observed: 'Subtracted in the wrong order and obtained the opposite sign.',
            likelyCause: 'Terms were moved without applying the same operation to both sides.',
            remediation:
              'Require the learner to write the operation applied to both sides on its own line before simplifying.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d }) => `x = ${fraction(d - b, a - c)}`,
    referenceExample: {
      prompt: 'Solve 5x + 3 = 2x − 9.',
      steps: ['5x − 2x = −9 − 3, so 3x = −12.', 'Divide by 3: x = −4.'],
      answer: 'x = −4',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'solve-linear-inequality',
    standard: 'A-REI.3',
    lessonFocus: 'solving inequalities and tracking the direction of the sign',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 11 : 7
      const a = nonZero(bound, 2)
      const b = nonZero(bound)
      const c = nonZero(bound * 2)
      const flips = a < 0
      const direction = flips ? '>' : '<'
      return {
        prompt: `Solve for x and state the solution set: ${a}x ${signed(b)} < ${c}.`,
        parameters: { a, b, c },
        answer: `x ${direction} ${fraction(c - b, a)}`,
        distractors: [
          `x ${flips ? '<' : '>'} ${fraction(c - b, a)}`,
          `x ${direction} ${fraction(c + b, a)}`,
          `x ${direction} ${fraction(c - b, -a)}`,
          `x ${flips ? '<' : '>'} ${fraction(c + b, a)}`,
          `x ${direction} ${fraction(c - b + 1, a)}`,
          `x ${direction} ${fraction(c - b - 1, a)}`,
        ],
        solutionSteps: [
          `Subtract ${b} from both sides: ${a}x < ${c - b}.`,
          `Divide both sides by ${a}.`,
          flips
            ? `Dividing by the negative number ${a} reverses the inequality, so the sign becomes >.`
            : `Dividing by the positive number ${a} leaves the inequality direction unchanged.`,
          `The solution set is x ${direction} ${fraction(c - b, a)}.`,
        ],
        commonErrors: [
          {
            observed: 'Kept the inequality direction after dividing by a negative coefficient.',
            likelyCause: 'The reversal rule was not applied.',
            remediation:
              'Test the boundary with one value from each side; the failing test shows the direction is wrong.',
          },
        ],
      }
    },
    oracle: ({ a, b, c }) => `x ${a < 0 ? '>' : '<'} ${fraction(c - b, a)}`,
    referenceExample: {
      prompt: 'Solve −3x + 2 < 11.',
      steps: ['−3x < 9.', 'Dividing by −3 reverses the sign: x > −3.'],
      answer: 'x > −3',
    },
  }),

  spec<{ step: number }>({
    itemType: 'justify-solution-step',
    standard: 'A-REI.1',
    lessonFocus: 'justifying each step in a solution',
    build: () => {
      const justifications = [
        {
          line: 'From 3(x + 4) = 21 to 3x + 12 = 21',
          answer: 'the distributive property',
          distractors: ['the addition property of equality', 'combining like terms', 'the multiplicative inverse'],
        },
        {
          line: 'From 3x + 12 = 21 to 3x = 9',
          answer: 'subtracting 12 from both sides (subtraction property of equality)',
          distractors: ['the distributive property', 'dividing both sides by 3', 'the commutative property'],
        },
        {
          line: 'From 3x = 9 to x = 3',
          answer: 'dividing both sides by 3 (division property of equality)',
          distractors: ['the distributive property', 'subtracting 3 from both sides', 'the associative property'],
        },
        {
          line: 'From 2x + 5 = 5 + 2x to a statement true for all x',
          answer: 'the commutative property, which shows the two sides are identical',
          distractors: [
            'the distributive property',
            'the zero product property',
            'dividing both sides by 2x',
          ],
        },
      ]
      const step = rand(0, justifications.length - 1)
      const entry = justifications[step]
      return {
        prompt: `In a solution, one line reads: ${entry.line}. Which property justifies that step?`,
        parameters: { step },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `The step in question is: ${entry.line}.`,
          `Identify what changed between the two lines, and name the single property that licenses exactly that change.`,
          `The justification is ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Named the operation performed rather than the property that permits it.',
            likelyCause:
              'Describing a step and justifying it were treated as the same task.',
            remediation:
              'Ask why the equation still holds after the step, not what was done — the answer to "why" is the property.',
          },
        ],
      }
    },
    oracle: ({ step }) =>
      [
        'the distributive property',
        'subtracting 12 from both sides (subtraction property of equality)',
        'dividing both sides by 3 (division property of equality)',
        'the commutative property, which shows the two sides are identical',
      ][step],
    referenceExample: {
      prompt: 'Why may 2(x + 3) = 10 be rewritten as 2x + 6 = 10?',
      steps: ['The left side was expanded over the sum.', 'That is licensed by the distributive property.'],
      answer: 'the distributive property',
    },
  }),

  spec<{ m: number; b: number; x: number; offset: number }>({
    itemType: 'point-on-graph-membership',
    standard: 'A-REI.10',
    lessonFocus: 'the graph of an equation as its solution set',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 9 : 5
      const m = nonZero(bound)
      const b = nonZero(bound * 2)
      const x = nonZero(bound)
      const offset = choose([0, 0, 1, -1, 2, -2])
      const y = m * x + b + offset
      const onGraph = offset === 0
      return {
        prompt: `Does the point (${x}, ${y}) lie on the graph of y = ${m}x ${signed(b)}?`,
        parameters: { m, b, x, offset },
        answer: onGraph
          ? 'Yes; the coordinates satisfy the equation.'
          : `No; substituting x = ${x} gives y = ${m * x + b}, not ${y}.`,
        distractors: [
          onGraph
            ? `No; substituting x = ${x} gives y = ${m * x + b + 1}, not ${y}.`
            : 'Yes; the coordinates satisfy the equation.',
          `Only if the graph is extended beyond the plotted window.`,
          `It cannot be determined without graphing the line.`,
          `No; the point satisfies the equation but lies off the line.`,
        ],
        solutionSteps: [
          `The graph of an equation is exactly the set of points whose coordinates make it true, so substitute rather than sketch.`,
          `Substitute x = ${x}: y = ${m}(${x}) ${signed(b)} = ${m * x + b}.`,
          onGraph
            ? `That matches the given y-value ${y}, so the point is on the graph.`
            : `The given y-value is ${y}, which differs from ${m * x + b}, so the point is not on the graph.`,
        ],
        commonErrors: [
          {
            observed: 'Judged membership by how the point looked on a sketch.',
            likelyCause: 'The graph was treated as a picture rather than as a solution set.',
            remediation:
              'Insist on substitution as the test; a sketch cannot distinguish a near miss from a hit.',
          },
        ],
      }
    },
    oracle: ({ m, b, x, offset }) => {
      const y = m * x + b + offset
      return offset === 0
        ? 'Yes; the coordinates satisfy the equation.'
        : `No; substituting x = ${x} gives y = ${m * x + b}, not ${y}.`
    },
    referenceExample: {
      prompt: 'Is (2, 7) on the graph of y = 3x + 1?',
      steps: ['Substitute x = 2: y = 3(2) + 1 = 7.', 'That matches, so yes.'],
      answer: 'Yes; the coordinates satisfy the equation.',
    },
  }),

  spec<{ m1: number; b1: number; m2: number; b2: number }>({
    itemType: 'intersection-as-equation-solution',
    standard: 'A-REI.11',
    lessonFocus: 'reading f(x) = g(x) from the intersection of two graphs',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const x = nonZero(bound)
      const m1 = nonZero(bound)
      let m2 = nonZero(bound)
      // m1 - m2 must be non-zero for a single intersection; m1 + m2 appears in a
      // distractor denominator, so exclude that collision as well.
      if (m2 === m1) m2 = m1 > 0 ? m1 + 1 : m1 - 1
      if (m2 === -m1) m2 = m1 > 0 ? m1 + 2 : m1 - 2
      if (m2 === 0) m2 = 1
      const b1 = nonZero(bound * 2)
      const b2 = (m1 - m2) * x + b1
      return {
        prompt: `The graphs of f(x) = ${m1}x ${signed(b1)} and g(x) = ${m2}x ${signed(b2)} intersect at exactly one point. What is the solution of f(x) = g(x)?`,
        parameters: { m1, b1, m2, b2 },
        answer: `x = ${fraction(b2 - b1, m1 - m2)}`,
        distractors: [
          `x = ${fraction(b1 - b2, m1 - m2)}`,
          `x = ${fraction(b2 + b1, m1 - m2)}`,
          `x = ${fraction(b2 - b1, m1 + m2)}`,
          `x = ${m1 * x + b1}`,
          `x = ${fraction(b2 - b1 + 1, m1 - m2)}`,
          `x = ${fraction(b2 - b1 - 1, m1 - m2)}`,
        ],
        solutionSteps: [
          `A point on both graphs has the same x and the same y, so the solution of f(x) = g(x) is the x-coordinate of the intersection.`,
          `Set the expressions equal: ${m1}x ${signed(b1)} = ${m2}x ${signed(b2)}.`,
          `Collect terms: ${m1 - m2}x = ${b2 - b1}.`,
          `x = ${fraction(b2 - b1, m1 - m2)}.`,
        ],
        commonErrors: [
          {
            observed: 'Reported the y-coordinate of the intersection.',
            likelyCause: 'The question was read as "where do they meet" rather than "solve for x".',
            remediation:
              'Ask which variable the equation f(x) = g(x) is solved for, then name that coordinate.',
          },
        ],
      }
    },
    oracle: ({ m1, b1, m2, b2 }) => `x = ${fraction(b2 - b1, m1 - m2)}`,
    referenceExample: {
      prompt: 'f(x) = 2x + 1 and g(x) = 5x − 8 meet where?',
      steps: ['2x + 1 = 5x − 8.', '−3x = −9, so x = 3.'],
      answer: 'x = 3',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'solve-literal-equation',
    standard: 'A-REI.3',
    lessonFocus: 'rearranging a formula for a chosen variable',
    build: (difficulty) => {
      const a = nonZero(difficulty === 3 ? 9 : 5, 2)
      const b = nonZero(difficulty === 3 ? 9 : 5)
      const c = nonZero(difficulty === 3 ? 9 : 5)
      return {
        prompt: `Solve ${a}x ${signed(b)}y = ${c} for y.`,
        parameters: { a, b, c },
        answer: `y = (${c} − ${a}x)/${b}`,
        distractors: [
          `y = (${c} + ${a}x)/${b}`,
          `y = ${c} − ${a}x`,
          `y = (${a}x − ${c})/${b}`,
          `y = ${b}(${c} − ${a}x)`,
        ],
        solutionSteps: [
          `Isolate the y term: ${b}y = ${c} − ${a}x.`,
          `Divide every term on the right by ${b}, not just the first.`,
          `y = (${c} − ${a}x)/${b}.`,
        ],
        commonErrors: [
          {
            observed: 'Divided only one term of the numerator by the coefficient.',
            likelyCause: 'The division was applied term-wise instead of to the whole side.',
            remediation:
              'Keep the numerator in brackets until the division is written, so the whole expression is divided.',
          },
        ],
      }
    },
    oracle: ({ a, b, c }) => `y = (${c} − ${a}x)/${b}`,
    referenceExample: {
      prompt: 'Solve 3x + 4y = 12 for y.',
      steps: ['4y = 12 − 3x.', 'y = (12 − 3x)/4.'],
      answer: 'y = (12 − 3x)/4',
    },
  }),
])
