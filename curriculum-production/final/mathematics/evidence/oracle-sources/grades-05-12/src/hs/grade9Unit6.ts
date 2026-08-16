import { fraction, makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 9 Unit 6 — Creating Equations and Constraints (A-CED.1-4). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)

export const GRADE9_UNIT6 = makeHsUnitBank(9, 6, [
  spec<{ fee: number; rate: number; total: number }>({
    itemType: 'create-equation-from-context',
    standard: 'A-CED.1',
    lessonFocus: 'writing an equation that models a situation',
    build: (difficulty) => {
      const fee = rand(2, difficulty === 3 ? 60 : 30) * 5
      const rate = rand(2, difficulty === 3 ? 25 : 12)
      const hours = rand(3, 20)
      const total = fee + rate * hours
      return {
        prompt: `A repair service charges a $${fee} call-out fee plus $${rate} per hour. A job cost $${total} in total. Which equation determines the number of hours h?`,
        parameters: { fee, rate, total },
        answer: `${fee} + ${rate}h = ${total}`,
        distractors: [
          `${rate} + ${fee}h = ${total}`,
          `${fee}h + ${rate} = ${total}`,
          `${fee} + ${rate} + h = ${total}`,
          `${fee} × ${rate}h = ${total}`,
        ],
        solutionSteps: [
          `The call-out fee $${fee} is charged once, so it is a constant term.`,
          `The hourly charge $${rate} applies to each hour, so it multiplies h.`,
          `Total cost is fee plus hourly charges: ${fee} + ${rate}h = ${total}.`,
          `Solving gives h = ${(total - fee) / rate}, which checks against the stated total.`,
        ],
        commonErrors: [
          {
            observed: `Wrote ${fee}h + ${rate} = ${total}, attaching h to the fee.`,
            likelyCause: 'The one-off charge and the per-unit charge were swapped.',
            remediation:
              'Ask what changes when the job runs one hour longer; only the per-hour amount should change.',
          },
        ],
      }
    },
    oracle: ({ fee, rate, total }) => `${fee} + ${rate}h = ${total}`,
    referenceExample: {
      prompt: 'A $40 fee plus $15 per hour totals $115. Write the equation.',
      steps: ['Fee is constant; hourly rate multiplies h.', '40 + 15h = 115.'],
      answer: '40 + 15h = 115',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'rearrange-formula-for-variable',
    standard: 'A-CED.4',
    lessonFocus: 'rearranging a formula to highlight a quantity of interest',
    build: (difficulty) => {
      const a = nonZero(difficulty === 3 ? 9 : 5, 2)
      const b = nonZero(difficulty === 3 ? 9 : 5)
      const c = nonZero(difficulty === 3 ? 12 : 7)
      return {
        prompt: `The formula A = ${a}bh ${signed(b)} models a design constraint, where A, b, and h are positive. Solve it for h.`,
        parameters: { a, b, c },
        answer: `h = (A ${b < 0 ? '+' : '−'} ${Math.abs(b)}) / (${a}b)`,
        distractors: [
          `h = (A ${b < 0 ? '−' : '+'} ${Math.abs(b)}) / (${a}b)`,
          `h = A / (${a}b) ${signed(-b)}`,
          `h = ${a}b(A ${b < 0 ? '+' : '−'} ${Math.abs(b)})`,
          `h = (A ${b < 0 ? '+' : '−'} ${Math.abs(b)}) / ${a} − b`,
        ],
        solutionSteps: [
          `Isolate the term containing h: ${a}bh = A ${b < 0 ? '+' : '−'} ${Math.abs(b)}.`,
          `The coefficient of h is the whole product ${a}b, so divide both sides by ${a}b.`,
          `h = (A ${b < 0 ? '+' : '−'} ${Math.abs(b)}) / (${a}b).`,
        ],
        commonErrors: [
          {
            observed: 'Divided by the numeric coefficient but left b multiplying h.',
            likelyCause: 'Only part of the coefficient was divided out.',
            remediation:
              'Circle everything multiplying h before dividing, so the whole coefficient moves at once.',
          },
        ],
      }
    },
    oracle: ({ a, b }) =>
      `h = (A ${b < 0 ? '+' : '−'} ${Math.abs(b)}) / (${a}b)`,
    referenceExample: {
      prompt: 'Solve A = 2bh + 5 for h.',
      steps: ['2bh = A − 5.', 'Divide by the whole coefficient 2b.', 'h = (A − 5)/(2b).'],
      answer: 'h = (A − 5)/(2b)',
    },
  }),

  spec<{ budget: number; costA: number; costB: number }>({
    itemType: 'write-constraint-inequality',
    standard: 'A-CED.3',
    lessonFocus: 'representing constraints as inequalities',
    build: (difficulty) => {
      const costA = rand(3, difficulty === 3 ? 30 : 15)
      const costB = rand(3, difficulty === 3 ? 30 : 15)
      const budget = rand(8, 40) * 10
      return {
        prompt: `Item A costs $${costA} each and item B costs $${costB} each. You may spend at most $${budget} in total. Which inequality expresses this constraint on the counts a and b?`,
        parameters: { budget, costA, costB },
        answer: `${costA}a + ${costB}b ≤ ${budget}`,
        distractors: [
          `${costA}a + ${costB}b ≥ ${budget}`,
          `${costA}a + ${costB}b = ${budget}`,
          `a + b ≤ ${budget}`,
          `${costA}a − ${costB}b ≤ ${budget}`,
        ],
        solutionSteps: [
          `Spending on A is ${costA} per item times a items, and on B is ${costB} times b items.`,
          `Total spending is ${costA}a + ${costB}b.`,
          `"At most $${budget}" allows equality and anything below it, so the relation is ≤.`,
          `The constraint is ${costA}a + ${costB}b ≤ ${budget}.`,
        ],
        commonErrors: [
          {
            observed: 'Used ≥ for "at most".',
            likelyCause: 'The direction of the inequality was read from the word "most" alone.',
            remediation:
              'Test the constraint with zero of each item; spending nothing must satisfy a budget cap.',
          },
        ],
      }
    },
    oracle: ({ budget, costA, costB }) => `${costA}a + ${costB}b ≤ ${budget}`,
    referenceExample: {
      prompt: 'A costs $4, B costs $7, budget $50. Write the constraint.',
      steps: ['Total spend is 4a + 7b.', '"At most" gives ≤.', '4a + 7b ≤ 50.'],
      answer: '4a + 7b ≤ 50',
    },
  }),

  spec<{ start: number; rate: number; target: number }>({
    itemType: 'solve-model-for-required-value',
    standard: 'A-CED.1',
    lessonFocus: 'using a created equation to answer the question asked',
    build: (difficulty) => {
      const rate = rand(2, difficulty === 3 ? 18 : 9)
      const periods = rand(4, 25)
      const start = rand(5, 60) * 5
      const target = start + rate * periods
      return {
        prompt: `A tank holds ${start} litres and is filling at ${rate} litres per minute. After how many minutes does it hold ${target} litres?`,
        parameters: { start, rate, target },
        answer: `${periods} minutes`,
        distractors: numericDistractors(periods, [
          Math.round(target / rate),
          Math.round((target + start) / rate),
          target - start,
          periods * 2,
        ]).map((value) => `${value} minutes`),
        solutionSteps: [
          `Model the volume after m minutes: ${start} + ${rate}m.`,
          `Set it equal to the target: ${start} + ${rate}m = ${target}.`,
          `Subtract the starting volume: ${rate}m = ${target - start}.`,
          `Divide by the rate: m = ${periods} minutes.`,
        ],
        commonErrors: [
          {
            observed: `Divided the target by the rate and answered ${Math.round(target / rate)} minutes.`,
            likelyCause: 'The starting volume was ignored.',
            remediation:
              'Check the model at m = 0; it must return the starting volume, not zero.',
          },
        ],
      }
    },
    oracle: ({ start, rate, target }) => `${(target - start) / rate} minutes`,
    referenceExample: {
      prompt: 'A tank holds 50 L and fills at 8 L/min. When does it hold 130 L?',
      steps: ['50 + 8m = 130.', '8m = 80, so m = 10 minutes.'],
      answer: '10 minutes',
    },
  }),

  spec<{ which: number }>({
    itemType: 'interpret-constraint-feasibility',
    standard: 'A-CED.3',
    lessonFocus: 'reading a solution as viable or non-viable in context',
    build: () => {
      const cases = [
        {
          text: 'A model gives the number of buses needed as 4.3.',
          answer: 'Round up to 5; a fractional bus is not viable and rounding down leaves people behind.',
          distractors: [
            'Round down to 4, because 4.3 is closer to 4.',
            'Report 4.3, because the model is exact.',
            'The model must be wrong, because the answer is not a whole number.',
          ],
        },
        {
          text: 'A model gives a required side length of −6 metres.',
          answer: 'Reject the solution; a length cannot be negative, so it lies outside the model’s domain.',
          distractors: [
            'Use 6 metres, taking the absolute value.',
            'Report −6 metres, because the algebra is correct.',
            'Add 6 to every measurement to correct the model.',
          ],
        },
        {
          text: 'A budget model allows 12.7 units of a product sold individually.',
          answer: 'Round down to 12; buying a partial unit is not possible and 13 would exceed the budget.',
          distractors: [
            'Round up to 13, because 12.7 is closer to 13.',
            'Report 12.7, because the constraint is satisfied.',
            'Split the order so the fractional unit is shared.',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `${entry.text} How should this solution be interpreted?`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `The algebra produced a value, but the context restricts which values are meaningful.`,
          `Ask what the variable counts or measures, and whether the value is admissible for that quantity.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Applied ordinary rounding rules without asking what the quantity represents.',
            likelyCause: 'The context constraint was dropped once the equation was solved.',
            remediation:
              'Re-read the question after solving and check the answer against what the quantity can actually be.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'Round up to 5; a fractional bus is not viable and rounding down leaves people behind.',
        'Reject the solution; a length cannot be negative, so it lies outside the model’s domain.',
        'Round down to 12; buying a partial unit is not possible and 13 would exceed the budget.',
      ][which],
    referenceExample: {
      prompt: 'A model needs 3.2 vans. How many are required?',
      steps: ['Vans are whole objects.', 'Three vans leave some load uncarried, so four are needed.'],
      answer: '4 vans',
    },
  }),
])
