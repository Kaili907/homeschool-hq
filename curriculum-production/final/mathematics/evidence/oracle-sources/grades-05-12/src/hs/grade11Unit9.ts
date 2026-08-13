import { fraction, makeHsUnitBank, rand, spec } from './core.ts'

/** Grade 11 Unit 9 — Probability Rules and Interpretation (S-CP.5, 6, 7). */

export const GRADE11_UNIT9 = makeHsUnitBank(11, 9, [
  spec<{ joint: number; marginal: number; scale: number }>({
    itemType: 'conditional-probability-formula',
    standard: 'S-CP.6',
    lessonFocus: 'the conditional probability formula',
    build: (difficulty) => {
      const scale = difficulty === 3 ? 100 : 20
      const marginal = rand(4, scale - 2)
      const joint = rand(1, marginal)
      return {
        prompt: `Given P(A and B) = ${joint}/${scale} and P(B) = ${marginal}/${scale}, find P(A | B) as a fraction in lowest terms.`,
        parameters: { joint, marginal, scale },
        answer: fraction(joint, marginal),
        distractors: [
          fraction(marginal, joint),
          fraction(joint, scale),
          fraction(joint * marginal, scale * scale),
          fraction(joint + 1, marginal),
        ],
        solutionSteps: [
          `The conditional probability formula is P(A | B) = P(A and B) / P(B).`,
          `Substitute: (${joint}/${scale}) ÷ (${marginal}/${scale}).`,
          `The common denominator ${scale} cancels, leaving ${joint}/${marginal}.`,
          `In lowest terms that is ${fraction(joint, marginal)}.`,
        ],
        commonErrors: [
          {
            observed: `Inverted the ratio and answered ${fraction(marginal, joint)}.`,
            likelyCause: 'The conditioning event was placed in the numerator.',
            remediation:
              'The event after the bar always becomes the denominator; mark it before substituting.',
          },
        ],
      }
    },
    oracle: ({ joint, marginal }) => fraction(joint, marginal),
    referenceExample: {
      prompt: 'P(A and B) = 3/20, P(B) = 5/20. Find P(A|B).',
      steps: ['Divide: (3/20)/(5/20) = 3/5.'],
      answer: '3/5',
    },
  }),

  spec<{ pa: number; pb: number; pab: number; scale: number }>({
    itemType: 'addition-rule-application',
    standard: 'S-CP.7',
    lessonFocus: 'the addition rule for the probability of a union',
    build: (difficulty) => {
      const scale = difficulty === 3 ? 100 : 20
      const pab = rand(1, Math.floor(scale / 5))
      const pa = pab + rand(1, Math.floor(scale / 4))
      const pb = pab + rand(1, Math.floor(scale / 4))
      return {
        prompt: `Given P(A) = ${pa}/${scale}, P(B) = ${pb}/${scale}, and P(A and B) = ${pab}/${scale}, find P(A or B) in lowest terms.`,
        parameters: { pa, pb, pab, scale },
        answer: fraction(pa + pb - pab, scale),
        distractors: [
          fraction(pa + pb, scale),
          fraction(pa + pb + pab, scale),
          fraction(pa - pb + pab, scale),
          fraction(pa + pb - 2 * pab, scale),
        ],
        solutionSteps: [
          `The addition rule is P(A or B) = P(A) + P(B) − P(A and B).`,
          `The overlap is subtracted because outcomes in both events are counted once in P(A) and again in P(B).`,
          `Substitute: ${pa}/${scale} + ${pb}/${scale} − ${pab}/${scale} = ${pa + pb - pab}/${scale}.`,
          `In lowest terms: ${fraction(pa + pb - pab, scale)}.`,
        ],
        commonErrors: [
          {
            observed: `Added without subtracting and answered ${fraction(pa + pb, scale)}.`,
            likelyCause: 'The events were treated as mutually exclusive.',
            remediation:
              'Check whether P(A and B) is zero; if it is not, the overlap must be removed.',
          },
        ],
      }
    },
    oracle: ({ pa, pb, pab, scale }) => fraction(pa + pb - pab, scale),
    referenceExample: {
      prompt: 'P(A) = 8/20, P(B) = 7/20, P(A and B) = 3/20. Find P(A or B).',
      steps: ['8 + 7 − 3 = 12.', '12/20 = 3/5.'],
      answer: '3/5',
    },
  }),

  spec<{ which: number }>({
    itemType: 'interpret-conditional-in-context',
    standard: 'S-CP.5',
    lessonFocus: 'interpreting conditional probability and independence in context',
    build: () => {
      const cases = [
        {
          text: 'P(has the condition | tested positive) is much smaller than P(tested positive | has the condition)',
          answer: 'The two conditional probabilities condition on different events, so they need not be close; a rare condition makes the first much smaller.',
        },
        {
          text: 'the probability of a delay is the same whether or not it is raining',
          answer: 'Delay and rain are independent, because conditioning on rain does not change the probability of a delay.',
        },
        {
          text: 'P(passes | attended the workshop) is higher than P(passes) overall',
          answer: 'Attendance and passing are associated, though this alone does not show that the workshop caused the improvement.',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `In a study, ${entry.text}. What is the correct interpretation?`,
        parameters: { which },
        answer: entry.answer,
        // Distractors must be wrong readings of *this* scenario. Reusing the
        // other scenarios' answers made the item solvable by topic-matching.
        distractors: [
          'The two conditional probabilities are equal, so the order of conditioning never matters.',
          'The relationship proves that one event causes the other.',
          'The two events are mutually exclusive.',
        ],
        solutionSteps: [
          `Identify which event is being conditioned on, and ask what population that restricts attention to.`,
          `Compare the conditional probability against the unconditional one: equality means independence, a difference means association.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Treated P(A | B) and P(B | A) as interchangeable.',
            likelyCause: 'The order of conditioning was assumed not to matter.',
            remediation:
              'Write out both denominators explicitly; they are different populations, so the two values generally differ.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'The two conditional probabilities condition on different events, so they need not be close; a rare condition makes the first much smaller.',
        'Delay and rain are independent, because conditioning on rain does not change the probability of a delay.',
        'Attendance and passing are associated, though this alone does not show that the workshop caused the improvement.',
      ][which],
    referenceExample: {
      prompt: 'P(delay | rain) = P(delay). What does that mean?',
      steps: ['Conditioning changes nothing.', 'The events are independent.'],
      answer: 'They are independent',
    },
  }),

  spec<{ first: number; second: number; total: number }>({
    itemType: 'multiplication-rule-without-replacement',
    standard: 'S-CP.7',
    lessonFocus: 'chaining conditional probabilities',
    build: (difficulty) => {
      const total = rand(6, difficulty === 3 ? 20 : 12)
      const first = rand(2, total - 2)
      const second = first - 1
      return {
        prompt: `A box holds ${total} items, of which ${first} are defective. Two are drawn without replacement. Find the probability that both are defective, in lowest terms.`,
        parameters: { first, second, total },
        answer: fraction(first * second, total * (total - 1)),
        distractors: [
          fraction(first * first, total * total),
          fraction(first * second, total * total),
          fraction(first, total),
          fraction(2 * first, total),
        ],
        solutionSteps: [
          `The first draw is defective with probability ${first}/${total}.`,
          `Without replacement, the second draw happens from ${total - 1} items of which ${second} are defective, so its conditional probability is ${second}/${total - 1}.`,
          `Multiply the two: (${first}/${total})(${second}/${total - 1}) = ${first * second}/${total * (total - 1)}.`,
          `In lowest terms: ${fraction(first * second, total * (total - 1))}.`,
        ],
        commonErrors: [
          {
            observed: `Used ${first}/${total} twice, as if the draws were independent.`,
            likelyCause: 'The change in the box after the first draw was ignored.',
            remediation:
              'Write down what the box contains immediately before each draw, then read the probability off that.',
          },
        ],
      }
    },
    oracle: ({ first, total }) => fraction(first * (first - 1), total * (total - 1)),
    referenceExample: {
      prompt: '10 items, 4 defective, draw 2 without replacement. Both defective?',
      steps: ['(4/10)(3/9) = 12/90.', 'Reduce: 2/15.'],
      answer: '2/15',
    },
  }),
])
