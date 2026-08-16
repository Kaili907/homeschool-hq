import { fraction, makeHsUnitBank, rand, spec } from './core.ts'

/** Grade 11 Unit 8 — Probability, Independence, and Conditional Reasoning (S-CP.1-4). */

export const GRADE11_UNIT8 = makeHsUnitBank(11, 8, [
  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'conditional-probability-from-table',
    standard: 'S-CP.4',
    lessonFocus: 'conditional probability read from a two-way table',
    build: (difficulty) => {
      const a = rand(4, difficulty === 3 ? 50 : 25)
      const b = rand(4, difficulty === 3 ? 50 : 25)
      const c = rand(4, difficulty === 3 ? 50 : 25)
      const d = rand(4, difficulty === 3 ? 50 : 25)
      return {
        prompt: `A survey table records: group X with ${a} successes and ${b} failures; group Y with ${c} successes and ${d} failures. Find P(success | group X) as a fraction in lowest terms.`,
        parameters: { a, b, c, d },
        answer: fraction(a, a + b),
        distractors: [
          fraction(a, a + b + c + d),
          fraction(a, a + c),
          fraction(b, a + b),
          fraction(a + c, a + b + c + d),
          fraction(a + 1, a + b),
          fraction(a - 1, a + b),
          fraction(a + 2, a + b),
        ],
        solutionSteps: [
          `The condition "given group X" restricts attention to group X only.`,
          `Group X contains ${a} + ${b} = ${a + b} people.`,
          `Of those, ${a} were successes.`,
          `P(success | group X) = ${a}/${a + b} = ${fraction(a, a + b)}.`,
        ],
        commonErrors: [
          {
            observed: `Divided by the overall total ${a + b + c + d}.`,
            likelyCause: 'The joint probability was computed instead of the conditional one.',
            remediation:
              'Circle the row or column the condition names, and take the denominator only from inside it.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => fraction(a, a + b),
    referenceExample: {
      prompt: 'Group X: 12 successes, 8 failures. Find P(success | X).',
      steps: ['Group X has 20 people.', '12/20 = 3/5.'],
      answer: '3/5',
    },
  }),

  spec<{ tenthsA: number; tenthsB: number; pab: number }>({
    itemType: 'test-for-independence',
    standard: 'S-CP.2',
    lessonFocus: 'testing whether two events are independent',
    build: (difficulty) => {
      // Probabilities are whole tenths so that the independent joint
      // probability, (a/10)(b/10), is always an exact hundredth.
      const tenthsA = rand(1, 9)
      const tenthsB = rand(1, difficulty === 1 ? 5 : 9)
      const independentJoint = tenthsA * tenthsB
      const isIndependent = rand(0, 1) === 1
      const pab = isIndependent ? independentJoint : independentJoint + rand(1, 5)
      return {
        prompt: `Two events have P(A) = ${tenthsA}/10, P(B) = ${tenthsB}/10, and P(A and B) = ${pab}/100. Are A and B independent?`,
        parameters: { tenthsA, tenthsB, pab },
        answer:
          pab === independentJoint
            ? 'Yes; P(A and B) equals P(A)·P(B).'
            : 'No; P(A and B) differs from P(A)·P(B).',
        distractors: [
          pab === independentJoint
            ? 'No; P(A and B) differs from P(A)·P(B).'
            : 'Yes; P(A and B) equals P(A)·P(B).',
          'Yes; the two events cannot occur together.',
          'No; the two events are mutually exclusive.',
          'There is not enough information to decide.',
        ],
        solutionSteps: [
          `Two events are independent exactly when P(A and B) = P(A)·P(B). This is a numerical test, not a description of the events.`,
          `P(A)·P(B) = (${tenthsA}/10)(${tenthsB}/10) = ${independentJoint}/100.`,
          `The given joint probability is ${pab}/100.`,
          pab === independentJoint
            ? `The two agree, so A and B are independent.`
            : `${pab}/100 differs from ${independentJoint}/100, so A and B are not independent.`,
        ],
        commonErrors: [
          {
            observed: 'Concluded independence because the events could occur together.',
            likelyCause: 'Independence was confused with being non-mutually-exclusive.',
            remediation:
              'Independence is a numerical condition; always multiply the two probabilities and compare.',
          },
        ],
      }
    },
    oracle: ({ tenthsA, tenthsB, pab }) =>
      pab === tenthsA * tenthsB
        ? 'Yes; P(A and B) equals P(A)·P(B).'
        : 'No; P(A and B) differs from P(A)·P(B).',
    referenceExample: {
      prompt: 'P(A) = 5/10, P(B) = 4/10, P(A and B) = 20/100. Independent?',
      steps: ['P(A)P(B) = 20/100.', 'It matches, so yes.'],
      answer: 'Yes',
    },
  }),

  spec<{ total: number; both: number; onlyA: number; onlyB: number }>({
    itemType: 'union-and-intersection-probability',
    standard: 'S-CP.1',
    lessonFocus: 'describing events as unions, intersections, and complements',
    build: (difficulty) => {
      const both = rand(2, difficulty === 3 ? 20 : 10)
      const onlyA = rand(2, difficulty === 3 ? 25 : 12)
      const onlyB = rand(2, difficulty === 3 ? 25 : 12)
      const neither = rand(2, difficulty === 3 ? 25 : 12)
      const total = both + onlyA + onlyB + neither
      return {
        prompt: `In a group of ${total}, ${onlyA + both} do activity A, ${onlyB + both} do activity B, and ${both} do both. Find P(A or B) as a fraction in lowest terms.`,
        parameters: { total, both, onlyA, onlyB },
        answer: fraction(onlyA + onlyB + both, total),
        distractors: [
          fraction(onlyA + both + onlyB + both, total),
          fraction(both, total),
          fraction(onlyA + onlyB, total),
          fraction(total - (onlyA + onlyB + both), total),
          fraction(onlyA + onlyB + both - 1, total),
          fraction(onlyA + onlyB + both + 1, total),
        ],
        solutionSteps: [
          `The addition rule is P(A or B) = P(A) + P(B) − P(A and B); the overlap must be subtracted because it is counted in both totals.`,
          `Counting people: ${onlyA + both} + ${onlyB + both} − ${both} = ${onlyA + onlyB + both}.`,
          `So P(A or B) = ${onlyA + onlyB + both}/${total} = ${fraction(onlyA + onlyB + both, total)}.`,
        ],
        commonErrors: [
          {
            observed: `Added the two totals without subtracting the overlap.`,
            likelyCause: 'The people doing both activities were counted twice.',
            remediation:
              'Draw the two-circle diagram and label each region separately before adding.',
          },
        ],
      }
    },
    oracle: ({ total, both, onlyA, onlyB }) => fraction(onlyA + onlyB + both, total),
    referenceExample: {
      prompt: '30 people; 18 do A, 14 do B, 7 do both. Find P(A or B).',
      steps: ['18 + 14 − 7 = 25.', '25/30 = 5/6.'],
      answer: '5/6',
    },
  }),

  spec<{ favourable: number; total: number }>({
    itemType: 'complement-and-at-least-one',
    standard: 'S-CP.3',
    lessonFocus: 'using the complement to compute "at least one"',
    build: (difficulty) => {
      const total = rand(4, difficulty === 3 ? 12 : 8)
      const favourable = rand(1, total - 1)
      return {
        prompt: `An event has probability ${favourable}/${total} on a single trial. Two independent trials are run. Find the probability of at least one success, as a fraction in lowest terms.`,
        parameters: { favourable, total },
        answer: fraction(total * total - (total - favourable) * (total - favourable), total * total),
        distractors: [
          fraction(favourable * favourable, total * total),
          fraction(2 * favourable, total),
          fraction((total - favourable) * (total - favourable), total * total),
          fraction(favourable, total),
        ],
        solutionSteps: [
          `"At least one success" is the complement of "no successes at all", which is easier to compute directly.`,
          `The probability of failure on one trial is ${total - favourable}/${total}.`,
          `Because the trials are independent, the probability of two failures is (${total - favourable}/${total})² = ${(total - favourable) * (total - favourable)}/${total * total}.`,
          `Subtract from 1: ${total * total - (total - favourable) * (total - favourable)}/${total * total} = ${fraction(total * total - (total - favourable) * (total - favourable), total * total)}.`,
        ],
        commonErrors: [
          {
            observed: `Doubled the single-trial probability.`,
            likelyCause: 'The two trials were treated as mutually exclusive rather than independent.',
            remediation:
              'Test the shortcut with a probability above 1/2; doubling produces a value greater than 1, which is impossible.',
          },
        ],
      }
    },
    oracle: ({ favourable, total }) => {
      const failure = total - favourable
      return fraction(total * total - failure * failure, total * total)
    },
    referenceExample: {
      prompt: 'P(success) = 1/3 per trial, two trials. P(at least one)?',
      steps: ['P(no success) = (2/3)² = 4/9.', '1 − 4/9 = 5/9.'],
      answer: '5/9',
    },
  }),
])
