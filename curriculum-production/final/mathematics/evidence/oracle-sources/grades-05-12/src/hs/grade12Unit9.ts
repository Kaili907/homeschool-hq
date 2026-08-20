import { fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 12 Unit 9 — Random Variables and Probability Distributions (S-CP.8, 9, S-MD.1, 2, 3). */

const factorial = (value: number): number => (value <= 1 ? 1 : value * factorial(value - 1))

export const GRADE12_UNIT9 = makeHsUnitBank(12, 9, [
  spec<{ n: number; k: number; ordered: number }>({
    itemType: 'permutations-and-combinations',
    standard: 'S-CP.9',
    lessonFocus: 'permutations and combinations for counting outcomes',
    build: (difficulty) => {
      const n = rand(5, difficulty === 3 ? 10 : 7)
      const k = rand(2, Math.min(4, n - 1))
      const ordered = rand(0, 1)
      const permutations = factorial(n) / factorial(n - k)
      const combinations = permutations / factorial(k)
      const answer = ordered === 1 ? permutations : combinations
      return {
        prompt: `From ${n} distinct items, how many ways are there to choose ${k} ${ordered === 1 ? 'and arrange them in order' : 'when the order does not matter'}?`,
        parameters: { n, k, ordered },
        answer: String(answer),
        distractors: numericDistractors(answer, [
          ordered === 1 ? combinations : permutations,
          n ** k,
          n * k,
          factorial(n),
        ]),
        solutionSteps: [
          ordered === 1
            ? `Order matters, so this is a permutation: P(${n}, ${k}) = ${n}!/(${n} − ${k})!.`
            : `Order does not matter, so this is a combination: C(${n}, ${k}) = ${n}!/(${k}!·(${n} − ${k})!).`,
          `The ordered count is ${n} × ${n - 1}${k > 2 ? ` × ${n - 2}` : ''}${k > 3 ? ` × ${n - 3}` : ''} = ${permutations}.`,
          ordered === 1
            ? `That is the answer: ${permutations}.`
            : `Each unordered selection was counted ${k}! = ${factorial(k)} times, so divide: ${permutations} ÷ ${factorial(k)} = ${combinations}.`,
        ],
        commonErrors: [
          {
            observed:
              ordered === 1
                ? `Divided by ${k}! and answered ${combinations}.`
                : `Forgot to divide by ${k}! and answered ${permutations}.`,
            likelyCause: 'Whether order mattered was not decided before choosing the formula.',
            remediation:
              'Ask explicitly whether swapping two chosen items produces a different outcome; if not, divide by k!.',
          },
        ],
      }
    },
    oracle: ({ n, k, ordered }) => {
      let permutations = 1
      for (let index = 0; index < k; index += 1) permutations *= n - index
      if (ordered === 1) return String(permutations)
      let kFactorial = 1
      for (let index = 2; index <= k; index += 1) kFactorial *= index
      return String(permutations / kFactorial)
    },
    referenceExample: {
      prompt: 'From 6 items choose 2 with order mattering.',
      steps: ['6 × 5 = 30.'],
      answer: '30',
    },
  }),

  spec<{ values: number[]; weights: number[] }>({
    itemType: 'expected-value-of-random-variable',
    standard: 'S-MD.2',
    lessonFocus: 'the expected value of a discrete random variable',
    build: (difficulty) => {
      const count = difficulty === 3 ? 4 : 3
      const weights: number[] = []
      let remaining = 10
      for (let index = 0; index < count - 1; index += 1) {
        const take = rand(1, remaining - (count - 1 - index))
        weights.push(take)
        remaining -= take
      }
      weights.push(remaining)
      const values = Array.from({ length: count }, () => rand(1, difficulty === 3 ? 20 : 10))
      const total = values.reduce((sum, value, index) => sum + value * weights[index], 0)
      const expected = total / 10
      return {
        prompt: `A random variable takes values ${values.join(', ')} with probabilities ${weights.map((weight) => `${weight}/10`).join(', ')} respectively. Find its expected value.`,
        parameters: { values, weights },
        answer: String(expected),
        distractors: numericDistractors(expected, [
          values.reduce((sum, value) => sum + value, 0) / count,
          total,
          Math.max(...values),
          expected + 1,
        ]),
        solutionSteps: [
          `Expected value weights each outcome by its probability: E(X) = Σ x·P(x).`,
          `Compute each product: ${values.map((value, index) => `${value} × ${weights[index]}/10`).join(' + ')}.`,
          `The weighted total is ${total}/10.`,
          `E(X) = ${expected}. Note this is not the plain average of the values unless the probabilities are equal.`,
        ],
        commonErrors: [
          {
            observed: `Averaged the values and answered ${values.reduce((sum, value) => sum + value, 0) / count}.`,
            likelyCause: 'The probabilities were ignored.',
            remediation:
              'Check whether the probabilities are all equal; if not, a plain average is not the expected value.',
          },
        ],
      }
    },
    oracle: ({ values, weights }) => {
      const total = values.reduce((sum, value, index) => sum + value * weights[index], 0)
      return String(total / 10)
    },
    referenceExample: {
      prompt: 'Values 1, 4 with probabilities 3/10, 7/10. Expected value?',
      steps: ['1(0.3) + 4(0.7) = 0.3 + 2.8.', '= 3.1.'],
      answer: '3.1',
    },
  }),

  spec<{ pa: number; pbGivenA: number }>({
    itemType: 'general-multiplication-rule',
    standard: 'S-CP.8',
    lessonFocus: 'the general multiplication rule',
    build: (difficulty) => {
      const pa = rand(1, 9)
      const pbGivenA = rand(1, 9)
      return {
        prompt: `Given P(A) = ${pa}/10 and P(B | A) = ${pbGivenA}/10, find P(A and B) in lowest terms.`,
        parameters: { pa, pbGivenA },
        answer: fraction(pa * pbGivenA, 100),
        distractors: [
          fraction(pa + pbGivenA, 10),
          fraction(pa, pbGivenA),
          fraction(pa * pbGivenA, 10),
          fraction(pbGivenA, pa),
          // pa = pbGivenA collapses the two ratio distractors onto 1.
          fraction(pa * pbGivenA + 1, 100),
          fraction(pa * pbGivenA + 2, 100),
          fraction(pa * pbGivenA, 50),
        ],
        solutionSteps: [
          `The general multiplication rule is P(A and B) = P(A)·P(B | A). It holds whether or not the events are independent.`,
          `Substitute: (${pa}/10)(${pbGivenA}/10) = ${pa * pbGivenA}/100.`,
          `In lowest terms: ${fraction(pa * pbGivenA, 100)}.`,
          `Independence would be the special case where P(B | A) equals P(B); nothing here requires that.`,
        ],
        commonErrors: [
          {
            observed: `Added the probabilities and answered ${fraction(pa + pbGivenA, 10)}.`,
            likelyCause: 'The addition rule was applied to an intersection.',
            remediation:
              'Match the word to the operation: "and" multiplies, "or" adds with the overlap removed.',
          },
        ],
      }
    },
    oracle: ({ pa, pbGivenA }) => fraction(pa * pbGivenA, 100),
    referenceExample: {
      prompt: 'P(A) = 4/10, P(B|A) = 5/10. Find P(A and B).',
      steps: ['(4/10)(5/10) = 20/100.', '= 1/5.'],
      answer: '1/5',
    },
  }),

  spec<{ trials: number; favourable: number }>({
    itemType: 'probability-distribution-table',
    standard: 'S-MD.1',
    lessonFocus: 'assigning a probability distribution to a random variable',
    build: (difficulty) => {
      const trials = rand(2, difficulty === 3 ? 4 : 3)
      const favourable = rand(1, 5)
      const p = favourable / 10
      const allFail = Math.round((1 - p) ** trials * 10000) / 10000
      return {
        prompt: `A trial succeeds with probability ${favourable}/10 and is repeated ${trials} times independently. Let X count the successes. Find P(X = 0) as a decimal.`,
        parameters: { trials, favourable },
        answer: String(allFail),
        distractors: numericDistractors(allFail, [
          Math.round(p ** trials * 10000) / 10000,
          Math.round((1 - p) * 10000) / 10000,
          Math.round(trials * (1 - p) * 10000) / 10000,
          Math.round((1 - p) ** (trials + 1) * 10000) / 10000,
        ]),
        solutionSteps: [
          `X = 0 means every one of the ${trials} trials failed.`,
          `A single failure has probability 1 − ${favourable}/10 = ${1 - p}.`,
          `The trials are independent, so multiply: (${1 - p})^${trials}.`,
          `P(X = 0) = ${allFail}.`,
        ],
        commonErrors: [
          {
            observed: `Used the success probability and answered ${Math.round(p ** trials * 10000) / 10000}.`,
            likelyCause: 'The complement was not taken before multiplying.',
            remediation:
              'Write down what X = 0 means in words before computing; it describes failures, not successes.',
          },
        ],
      }
    },
    oracle: ({ trials, favourable }) => {
      const failure = 1 - favourable / 10
      let product = 1
      for (let index = 0; index < trials; index += 1) product *= failure
      return String(Math.round(product * 10000) / 10000)
    },
    referenceExample: {
      prompt: 'p = 3/10, 2 trials. Find P(X = 0).',
      steps: ['Failure probability 0.7.', '0.7² = 0.49.'],
      answer: '0.49',
    },
  }),
])
