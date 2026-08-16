import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 12 Unit 10 — Decision Analysis and Expected Value Capstone (S-MD.4-7). */

export const GRADE12_UNIT10 = makeHsUnitBank(12, 10, [
  spec<{ prize: number; cost: number; chances: number }>({
    itemType: 'expected-value-of-a-wager',
    standard: 'S-MD.5',
    lessonFocus: 'expected value of a payoff and whether a game is fair',
    build: (difficulty) => {
      const chances = rand(4, difficulty === 3 ? 20 : 10)
      const prize = rand(2, difficulty === 3 ? 40 : 20) * chances
      const cost = rand(2, difficulty === 3 ? 30 : 15)
      const expected = prize / chances - cost
      return {
        prompt: `A game costs $${cost} to play. It pays $${prize} with probability 1/${chances} and nothing otherwise. Find the expected value to the player, and say whether the game is fair.`,
        parameters: { prize, cost, chances },
        answer: `$${expected}; the game is ${expected === 0 ? 'fair' : expected > 0 ? 'favourable to the player' : 'unfavourable to the player'}`,
        distractors: numericDistractors(expected === 0 ? 1 : 0, [prize / chances, prize - cost, -cost])
          .map(
            (value) =>
              `$${value}; the game is ${Number(value) === 0 ? 'fair' : Number(value) > 0 ? 'favourable to the player' : 'unfavourable to the player'}`,
          )
          .concat([
            `$${expected}; the game is ${expected === 0 ? 'unfavourable to the player' : 'fair'}`,
          ]),
        solutionSteps: [
          `The player pays $${cost} regardless of the outcome, so subtract it from the expected winnings.`,
          `Expected winnings = $${prize} × 1/${chances} = $${prize / chances}.`,
          `Expected value to the player = ${prize / chances} − ${cost} = ${expected}.`,
          expected === 0
            ? 'An expected value of zero means the game is fair: neither side gains on average.'
            : expected > 0
              ? 'A positive expected value means the game favours the player in the long run.'
              : 'A negative expected value means the player loses on average over many plays.',
        ],
        commonErrors: [
          {
            observed: `Reported the expected winnings $${prize / chances} without subtracting the cost.`,
            likelyCause: 'The entry fee was left out of the payoff.',
            remediation:
              'Define the random variable as net gain, so the cost is built into every outcome.',
          },
        ],
      }
    },
    oracle: ({ prize, cost, chances }) => {
      const expected = prize / chances - cost
      const verdict =
        expected === 0 ? 'fair' : expected > 0 ? 'favourable to the player' : 'unfavourable to the player'
      return `$${expected}; the game is ${verdict}`
    },
    referenceExample: {
      prompt: 'Costs $5, pays $40 with probability 1/10. Expected value?',
      steps: ['Expected winnings 40/10 = 4.', '4 − 5 = −1, unfavourable.'],
      answer: '−$1; unfavourable',
    },
  }),

  spec<{ premium: number; claim: number; chances: number }>({
    itemType: 'insurance-expected-value',
    standard: 'S-MD.5',
    lessonFocus: 'expected value applied to insurance and risk',
    build: (difficulty) => {
      const chances = rand(20, difficulty === 3 ? 200 : 100)
      const claim = chances * rand(2, 8)
      const premium = rand(2, difficulty === 3 ? 40 : 20)
      const insurerExpected = premium - claim / chances
      return {
        prompt: `An insurer charges a premium of $${premium} and pays out $${claim} with probability 1/${chances}. Find the insurer's expected profit per policy.`,
        parameters: { premium, claim, chances },
        answer: `$${insurerExpected}`,
        distractors: numericDistractors(insurerExpected, [
          claim / chances - premium,
          premium,
          premium - claim,
          claim / chances,
        ]).map((value) => `$${value}`),
        solutionSteps: [
          `The insurer collects $${premium} on every policy.`,
          `The expected payout is $${claim} × 1/${chances} = $${claim / chances}.`,
          `Expected profit = premium − expected payout = ${premium} − ${claim / chances} = ${insurerExpected}.`,
          insurerExpected > 0
            ? 'A positive value means the insurer profits on average, which is what makes the arrangement sustainable for them.'
            : 'A non-positive value means this policy does not cover its expected cost.',
        ],
        commonErrors: [
          {
            observed: `Subtracted the full claim and answered $${premium - claim}.`,
            likelyCause: 'The payout was treated as certain rather than as a probability-weighted amount.',
            remediation:
              'Weight every outcome by its probability before combining; the claim occurs only sometimes.',
          },
        ],
      }
    },
    oracle: ({ premium, claim, chances }) => `$${premium - claim / chances}`,
    referenceExample: {
      prompt: 'Premium $30, payout $1000 with probability 1/50. Expected profit?',
      steps: ['Expected payout 1000/50 = 20.', '30 − 20 = $10.'],
      answer: '$10',
    },
  }),

  spec<{ aValue: number; bValue: number }>({
    itemType: 'compare-decisions-by-expected-value',
    standard: 'S-MD.7',
    lessonFocus: 'using expected value to compare decisions',
    build: (difficulty) => {
      const aValue = rand(2, difficulty === 3 ? 60 : 30)
      let bValue = rand(2, difficulty === 3 ? 60 : 30)
      if (bValue === aValue) bValue = aValue + 1
      return {
        prompt: `Option A has expected payoff $${aValue} and Option B has expected payoff $${bValue}. On expected value alone, which should be chosen, and what does this criterion ignore?`,
        parameters: { aValue, bValue },
        answer: `Option ${aValue > bValue ? 'A' : 'B'}; expected value ignores the spread of outcomes and the decider's tolerance for risk.`,
        distractors: [
          `Option ${aValue > bValue ? 'B' : 'A'}; expected value ignores the spread of outcomes and the decider's tolerance for risk.`,
          `Option ${aValue > bValue ? 'A' : 'B'}; expected value already accounts for risk, so nothing is ignored.`,
          `Neither; expected value cannot compare two options.`,
          `Option ${aValue > bValue ? 'A' : 'B'}; the criterion ignores only the number of times the decision is repeated.`,
        ],
        solutionSteps: [
          `Expected value ranks options by their long-run average payoff.`,
          `$${aValue} against $${bValue} means Option ${aValue > bValue ? 'A' : 'B'} has the higher expected payoff.`,
          `But two options with the same expected value can differ enormously in variability: one might be certain and the other a rare large payoff.`,
          `So expected value alone ignores the spread of outcomes and how much risk the decider is willing to bear — which matters most when the decision is made only once.`,
        ],
        commonErrors: [
          {
            observed: 'Treated the higher expected value as decisive in every context.',
            likelyCause: 'Expected value was taken as a complete decision rule.',
            remediation:
              'Ask how often the decision will be repeated; a long-run average is weak guidance for a one-off choice.',
          },
        ],
      }
    },
    oracle: ({ aValue, bValue }) =>
      `Option ${aValue > bValue ? 'A' : 'B'}; expected value ignores the spread of outcomes and the decider's tolerance for risk.`,
    referenceExample: {
      prompt: 'A has expected payoff $12, B has $9. Which, and what is ignored?',
      steps: ['A has the higher expected value.', 'Spread and risk tolerance are not captured.'],
      answer: 'A; risk is ignored',
    },
  }),

  spec<{ which: number }>({
    itemType: 'fair-decision-mechanism',
    standard: 'S-MD.6',
    lessonFocus: 'using probability to make and analyse fair decisions',
    build: () => {
      const cases = [
        {
          text: 'choosing between two people using a single fair coin flip',
          answer: 'Fair; each person has probability 1/2, and the mechanism gives neither an advantage.',
        },
        {
          text: 'choosing between three people by rolling a standard die, assigning two faces to each',
          answer: 'Fair; each person receives probability 2/6 = 1/3, so the assignment is equal.',
        },
        {
          text: 'choosing between three people by rolling a standard die, assigning faces 1–3, 4–5, and 6',
          answer: 'Not fair; the three probabilities are 3/6, 2/6, and 1/6, which are unequal.',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Assess whether this is a fair decision mechanism: ${entry.text}.`,
        parameters: { which },
        answer: entry.answer,
        distractors: cases
          .filter((_, index) => index !== which)
          .map((other) => other.answer)
          .concat(['Fair, because any random device produces a fair decision.']),
        solutionSteps: [
          `A mechanism is fair when every party has the same probability of being chosen.`,
          `Count the outcomes assigned to each party and divide by the total number of equally likely outcomes.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Assumed any use of a random device makes a decision fair.',
            likelyCause: 'Randomness was equated with fairness.',
            remediation:
              'Compute each party’s probability explicitly; randomness alone does not guarantee they are equal.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'Fair; each person has probability 1/2, and the mechanism gives neither an advantage.',
        'Fair; each person receives probability 2/6 = 1/3, so the assignment is equal.',
        'Not fair; the three probabilities are 3/6, 2/6, and 1/6, which are unequal.',
      ][which],
    referenceExample: {
      prompt: 'Is a die with faces split 3/2/1 among three people fair?',
      steps: ['Probabilities are 1/2, 1/3, 1/6.', 'They are unequal, so no.'],
      answer: 'Not fair',
    },
  }),
])
