import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 5 — PF5 Financial Investing: Portfolio Reasoning, Inflation,
 * and Fees. Ten lessons, one per source lesson day.
 *
 * The grade-11 move here is that a return is never taken at face value: it is
 * carried through fees, tax, and inflation before it is compared to anything,
 * and a distribution of outcomes is preferred to a single expected figure.
 * Every fund, account, rate, and portfolio below is invented. No lesson names a
 * real product or asks any learner what to do with money of their own; these
 * are general concepts worked on fictional cases.
 */
export const g11u05: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u05-l01',
    grade: 11, unit: 5, day: 1,
    actor: 'Leocadia Winterbourne-Adeyeye, a fictional analyst describing a portfolio by its range',
    objective: 'Compute the probability-weighted expected value of a fictional portfolio across three outcomes, express it as a return, and contrast the one-year range with a long-horizon projection.',
    scenario: 'Leocadia Winterbourne-Adeyeye is describing a fictional portfolio for a simulated case study. The outcomes, their probabilities, and the amounts below are invented and describe no real fund or market.',
    materials: ['calculator', 'the fictional outcome table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional portfolio holds $12,000. Over one year it has a 30% chance of a good outcome returning 18.2%, a 45% chance of a flat outcome returning 4.1%, and a 25% chance of a poor outcome losing 9.6%. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the portfolio worth after a good year returning 18.2%?',
            given: { start: 12000, good: 0.182 }, expr: 'round(start * (1 + good), 2)', format: 'usd', answer: '$14,184.00',
            reasoning: '$12,000 grown by 18.2% — the best of the three stated outcomes.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after a flat year returning 4.1%?',
            given: { start2: 12000, flat: 0.041 }, expr: 'round(start2 * (1 + flat), 2)', format: 'usd', answer: '$12,492.00',
            reasoning: '$12,000 grown by 4.1%, the middle outcome and the most likely single one at 45%.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after a poor year losing 9.6%?',
            given: { start3: 12000, poor: 0.096 }, expr: 'round(start3 * (1 - poor), 2)', format: 'usd', answer: '$10,848.00',
            reasoning: '$12,000 reduced by 9.6% — the outcome a single expected figure would hide entirely.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the probability-weighted expected value after one year?',
            given: { pGood: 0.3, pFlat: 0.45, pPoor: 0.25 },
            expr: 'round(#t1-p1 * pGood + #t1-p2 * pFlat + #t1-p3 * pPoor, 2)', format: 'usd', answer: '$12,588.60',
            reasoning: '30% of $14,184.00, 45% of $12,492.00, and 25% of $10,848.00. Notice that this value is not one of the three outcomes and cannot actually occur.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now express the expectation as a return, and measure the spread around it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the expected return for the year? Give one decimal place.',
            given: { start4: 12000 }, expr: 'round((#t1-p4 - start4) / start4 * 100, 1)', format: 'percent1', answer: '4.9%',
            reasoning: 'The $588.60 expected gain against the $12,000 starting value.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the range between the good outcome and the poor one?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$3,336.00',
            reasoning: '$14,184.00 against $10,848.00 — a spread of 28% of the starting value, around an expected return of under 5%.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How far below the expected value does the poor outcome fall?',
            given: {}, expr: '#t1-p4 - #t1-p3', format: 'usd', answer: '$1,740.60',
            reasoning: '$12,588.60 expected against $10,848.00 in the poor case — three times the expected gain itself.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If the portfolio returned its expected 4.9% every year for 10 years, what would it be worth?',
            given: { start5: 12000, expected: 0.049 }, expr: 'round(start5 * pow(1 + expected, 10), 2)', format: 'usd', answer: '$19,361.37',
            reasoning: 'Ten years of compounding at the expected rate. Holding the rate constant is a simplification: no real year returns exactly the expectation.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which statement about the expected value of $12,588.60 is accurate?',
            choices: [
              'It is the most likely value after one year',
              'It is a weighted average of outcomes and is not itself one of them',
              'It is the value the portfolio reaches if nothing unusual happens',
            ],
            given: {},
            answer: 'It is a weighted average of outcomes and is not itself one of them',
            reasoning: 'The three possible values are $14,184.00, $12,492.00, and $10,848.00, and $12,588.60 is none of them; the most likely single outcome is the flat one at 45%, which gives $12,492.00.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The expected return is 4.9% and the outcomes span $3,336.00. Explain what a single expected-return figure hides, and say how the horizon changes how much that hidden spread matters.',
            acceptableAnswerCriteria: [
              'Explains that the expectation is a weighted average, so it conceals both the 25% chance of a $1,740.60 shortfall and the fact that no year actually returns 4.9%.',
              'Explains that over a long horizon good and poor years partly offset, so the spread of the average annual outcome narrows, while over one year the full spread is what is faced.',
              'Notes that money needed within a year is exposed to the whole range, which is why horizon and not just expected return decides how a portfolio should be described.',
            ],
            evidenceRequirements: [
              'Cites the $3,336.00 range and the 4.9% expected return together.',
            ],
            dimensions: ['communication-of-uncertainty', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response distinguishes the spread of a single year from the spread of an average over many years.',
              'The response does not claim a long horizon removes risk, only that it changes its shape.',
              'A response observing that the poor outcome is three times the expected gain is reading the figures well.',
            ],
            commonMisconception: 'Treating an expected return as what a portfolio will do.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The ten-year projection assumes 4.9% every single year. Say what is wrong with that as a description of the future, and what it is nonetheless useful for.',
            acceptableAnswerCriteria: [
              'States that no year returns the expectation, so a smooth 4.9% path describes a sequence that cannot occur, and it conceals the order in which good and poor years arrive.',
              'Says what it is useful for: a single comparable figure for scale, or a benchmark against which an actual path can be judged.',
            ],
            evidenceRequirements: [
              'Refers to the $19,361.37 ten-year figure and to at least one of the three actual one-year outcomes.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the smoothing as the problem, not the rate itself.',
              'The use named is a real one rather than a concession.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the expected value comes out at $12,508.00, the three outcomes are being averaged as equals rather than weighted 30%, 45%, and 25%. Write the three products in a column, check the weights sum to 1, then add. A useful check: the expectation must fall between $10,848.00 and $14,184.00, and nearer the middle outcome because it carries the largest weight.',
    extension: 'Recompute the expected value if the poor outcome’s probability rises to 40% and the good outcome’s falls to 15%, and say what happens to the expected return.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l02',
    grade: 11, unit: 5, day: 2,
    actor: 'Gideon Praskovya-Halloran, a fictional analyst costing fees and tax against a return',
    objective: 'Carry a fictional gross return through an annual fee and a tax on the gain to reach a net return, and show what the fee alone does across a twenty-year horizon.',
    scenario: 'Gideon Praskovya-Halloran is analysing a fictional holding for a simulated case study. The return, fee, and tax rate below are invented, and the flat tax on gains is a deliberate simplification of a real tax calculation.',
    materials: ['calculator', 'the fictional return, fee, and tax figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional holding of $25,000 returns 7.3% over one year before costs. The fund charges an annual fee of 1.15% of the amount held. A simplified flat tax of 15% is then charged on the gain after the fee. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the gross gain at 7.3%?',
            given: { holding: 25000, grossReturn: 0.073 }, expr: 'round(holding * grossReturn, 2)', format: 'usd', answer: '$1,825.00',
            reasoning: '7.3% of $25,000 — the figure that would be quoted as the return.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the annual fee at 1.15% of the amount held?',
            given: { holding2: 25000, feeRate: 0.0115 }, expr: 'round(holding2 * feeRate, 2)', format: 'usd', answer: '$287.50',
            reasoning: 'The fee is charged on the whole $25,000 held, not on the gain, which is why it is paid even in a year with no gain at all.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the gain after the fee?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$1,537.50',
            reasoning: '$1,825.00 of gross gain less the $287.50 fee.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the simplified 15% tax on the gain after the fee?',
            given: { taxRate: 0.15 }, expr: 'round(#t1-p3 * taxRate, 2)', format: 'usd', answer: '$230.63',
            reasoning: '15% of $1,537.50. A real tax calculation depends on the kind of gain, how long it was held, and the rest of the return, none of which this simplification carries.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put the net figure against the number that was quoted.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the gain after both the fee and the tax?',
            given: {}, expr: '#t1-p3 - #t1-p4', format: 'usd', answer: '$1,306.87',
            reasoning: '$1,537.50 after the fee, less $230.63 of tax.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the net return on the $25,000? Give two decimal places.',
            given: { holding3: 25000 }, expr: 'round(#t2-p1 / holding3 * 100, 2)', format: 'percent2', answer: '5.23%',
            reasoning: '$1,306.87 against $25,000 — the return that actually reached the holder, against the 7.3% that was quoted.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the gross gain survives the fee and the tax? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p1 * 100, 1)', format: 'percent1', answer: '71.6%',
            reasoning: '$1,306.87 of the original $1,825.00 — costs that sound small as percentages of the holding take over a quarter of the gain.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Ignoring tax, what would $25,000 grow to over 20 years at the full 7.3% a year?',
            given: { holding4: 25000, grossReturn2: 0.073 }, expr: 'round(holding4 * pow(1 + grossReturn2, 20), 2)', format: 'usd', answer: '$102,313.85',
            reasoning: 'Twenty years of compounding at the quoted rate, with no fee deducted.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What would it grow to over the same 20 years if the 1.15% fee were deducted from the return each year?',
            given: { holding5: 25000, grossReturn3: 0.073, feeRate2: 0.0115 },
            expr: 'round(holding5 * pow(1 + grossReturn3 - feeRate2, 20), 2)', format: 'usd', answer: '$82,478.35',
            reasoning: 'The same twenty years at 6.15% instead of 7.3%. Deducting the fee from the annual return is a simplification, since the fee is charged on the balance rather than on the gain.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'How much does the fee cost across the 20 years?',
            given: {}, expr: '#t2-p4 - #t2-p5', format: 'usd', answer: '$19,835.50',
            reasoning: '$102,313.85 against $82,478.35 — a fee of just over one percent a year removes nearly a fifth of the twenty-year result, because every dollar it takes is a dollar that stops compounding.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fee of 1.15% a year removes $19,835.50 over twenty years from a $25,000 holding. Explain how a figure that small produces an effect that large, and say what that implies about which number matters most when comparing two funds with similar strategies.',
            acceptableAnswerCriteria: [
              'Explains that the fee is charged every year on the whole balance, and each dollar taken also forgoes all the growth it would have produced in the remaining years.',
              'States that the fee is knowable in advance while the return is not, so between similar funds the fee is the figure that can actually be compared.',
              'Uses the $19,835.50 figure against the $25,000 starting holding to show the scale.',
            ],
            evidenceRequirements: [
              'Cites both twenty-year figures, $102,313.85 and $82,478.35.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The response identifies forgone compounding, not just the sum of the fees.',
              'The response draws the comparison point about certainty: fees are known, returns are not.',
              'The response does not claim a low fee guarantees a better result.',
            ],
            commonMisconception: 'Judging an annual fee by its size in a single year.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The fee is charged on the amount held and the tax is charged on the gain. Explain why that difference matters, and describe a year in which one is paid and the other is not.',
            acceptableAnswerCriteria: [
              'Explains that a fee on assets is owed regardless of performance, while a tax on gains is owed only when there is a gain.',
              'Describes a loss year concretely: the $287.50 fee is still charged while no tax arises, so costs continue in exactly the year the holder can least absorb them.',
            ],
            evidenceRequirements: [
              'Refers to the $287.50 fee and the $230.63 tax as the two charges being contrasted.',
            ],
            dimensions: ['criteria-application', 'transfer'],
            lookFors: [
              'The response names the base each charge is applied to.',
              'The loss-year example is worked through rather than asserted.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the net gain comes out at $1,551.25, the tax is being charged on the gross gain and the fee has not been deducted first. The scenario charges the fee on the balance, and the 15% tax applies to what remains. Build the calculation as a ladder — gross gain, minus fee, minus tax — and check each line against the base the scenario names for it.',
    extension: 'Find the gross return that would be needed for a fund charging 1.15% to leave the same net gain as one charging 0.35%, and say what that says about how much extra performance a fee has to justify.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l03',
    grade: 11, unit: 5, day: 3,
    actor: 'Amara Silvestri-Novak, a fictional analyst converting a nominal return into a real one',
    objective: 'Convert a fictional nominal return into a real return, show why subtracting the inflation rate is an approximation, and carry the difference across a twelve-year horizon.',
    scenario: 'Amara Silvestri-Novak is reporting on a fictional holding for a simulated case study. The nominal return and inflation rate below are invented figures used to make the real-return calculation explicit.',
    materials: ['calculator', 'the fictional return and inflation figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional holding returns 5.8% a year in nominal terms. Prices rise 3.2% a year. Round to the stated precision at each step.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percentage points',
            text: 'Subtracting one rate from the other, what is the approximate real return in percentage points?',
            given: { nominalPoints: 5.8, inflationPoints: 3.2 }, expr: 'nominalPoints - inflationPoints', format: 'dec1', answer: '2.6',
            reasoning: '5.8 less 3.2. This is the common approximation, and the next item shows what it misses.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the exact real return, found by dividing the growth factor by the price factor? Give two decimal places.',
            given: { nominal: 0.058, inflation: 0.032 },
            expr: 'round((1 + nominal) / (1 + inflation) * 100 - 100, 2)', format: 'percent2', answer: '2.52%',
            reasoning: 'Dividing 1.058 by 1.032 asks how much more the money buys, rather than how much larger the two percentages are. The subtraction slightly overstates the answer.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percentage points',
            text: 'By how many percentage points does the subtraction overstate the exact figure? Give two decimal places.',
            given: {}, expr: 'round(#t1-p1 - #t1-p2, 2)', format: 'dec2', answer: '0.08',
            reasoning: '2.6 against 2.52 — small in one year, and the next task shows what it becomes over twelve.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now carry $40,000 across 12 years at both rates.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is $40,000 worth after 12 years at the 5.8% nominal return?',
            given: { start: 40000, nominal2: 0.058 }, expr: 'round(start * pow(1 + nominal2, 12), 2)', format: 'usd', answer: '$78,684.29',
            reasoning: 'Twelve years of compounding at the nominal rate — the figure a statement would show.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would $40,000 of goods cost after 12 years at 3.2% inflation?',
            given: { start2: 40000, inflation2: 0.032 }, expr: 'round(start2 * pow(1 + inflation2, 12), 2)', format: 'usd', answer: '$58,373.58',
            reasoning: 'The same twelve years applied to prices — what it takes to buy in year 12 what $40,000 buys today.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the year-12 holding worth in today’s dollars?',
            given: { inflation3: 0.032 }, expr: 'round(#t2-p1 / pow(1 + inflation3, 12), 2)', format: 'usd', answer: '$53,917.74',
            reasoning: 'Dividing the $78,684.29 nominal value by twelve years of price growth converts it into money of today’s purchasing power.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the nominal gain across the 12 years?',
            given: { start3: 40000 }, expr: '#t2-p1 - start3', format: 'usd', answer: '$38,684.29',
            reasoning: '$78,684.29 against the $40,000 invested — the holding has almost doubled on paper.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What is the real gain, in today’s dollars?',
            given: { start4: 40000 }, expr: '#t2-p3 - start4', format: 'usd', answer: '$13,917.74',
            reasoning: '$53,917.74 of purchasing power against the $40,000 it started with — barely more than a third of the nominal gain.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'percent',
            text: 'What share of the nominal gain survives in real terms? Give one decimal place.',
            given: {}, expr: 'round(#t2-p5 / #t2-p4 * 100, 1)', format: 'percent1', answer: '36.0%',
            reasoning: '$13,917.74 of the $38,684.29 nominal gain — the other 64% is the price level catching up.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The holding nearly doubles in nominal terms and gains 36.0% of that in real terms. Explain what "real" is measuring, and say when a nominal figure is nonetheless the right one to use.',
            acceptableAnswerCriteria: [
              'Explains that a real figure measures what the money can buy, by removing the effect of prices having risen over the same period.',
              'States when nominal is correct: for a fixed obligation stated in dollars, such as repaying a $40,000 loan or meeting a fixed-price commitment, where the number rather than the purchasing power is what matters.',
              'Uses the $78,684.29 and $53,917.74 figures to show what the conversion does.',
            ],
            evidenceRequirements: [
              'Cites both the nominal and real year-12 values.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response defines real in terms of purchasing power rather than as "adjusted".',
              'The nominal case named is one where the dollar amount genuinely is the relevant quantity.',
              'A response noting that a goal defined in today’s goods must be planned in real terms is applying the idea well.',
            ],
            commonMisconception: 'Treating a nominal return as a gain in what money can buy.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The subtraction overstates the real return by 0.08 percentage points a year. Say whether that approximation is good enough here, and name a situation where it would not be.',
            acceptableAnswerCriteria: [
              'Judges the approximation acceptable at these rates for a rough figure, since 2.6 against 2.52 is a small relative error over one year.',
              'Names a situation where it fails, such as high inflation where the two rates are large, or a long horizon where the annual error compounds.',
            ],
            evidenceRequirements: [
              'Refers to the 2.6 and 2.52 figures when judging the approximation.',
            ],
            dimensions: ['assumption-identification', 'transfer'],
            lookFors: [
              'The judgement is made against a stated use rather than in the abstract.',
              'The failure case names why the error grows, not just that it does.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the real value comes out above the nominal one, the price factor is being multiplied rather than divided. Converting a future amount into today’s dollars makes it smaller, because prices have risen in between. Check the direction on the twelve-year figures: $78,684.29 divided by the price growth gives $53,917.74, which must be the smaller of the two.',
    extension: 'Find the nominal return that would be needed to produce a real return of 4% a year at 3.2% inflation, and say whether it is more or less than 7.2%.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l04',
    grade: 11, unit: 5, day: 4,
    actor: 'Konstantin Vasquez-Lindeberg, a fictional trustee applying a written rebalancing rule',
    objective: 'Apply a fictional written rebalancing rule to a portfolio that has drifted, compute the trade it requires, and explain why the rule is written before the drift rather than after.',
    scenario: 'Konstantin Vasquez-Lindeberg administers a fictional portfolio under a simulated written policy. The holdings, returns, and target weights below are invented and describe no real fund.',
    materials: ['calculator', 'the fictional portfolio and policy in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The written policy sets a target of 60% in a stock fund and 40% in a bond fund, and requires rebalancing whenever the stock share moves outside the band from 57% to 63%, which is 3 percentage points either side of its target. The portfolio started the year at $30,000 on target. Over the year the stock fund returned 21.4% and the bond fund returned 2.6%. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What was held in the stock fund at the start, at 60% of $30,000?',
            given: { total: 30000, stockTarget: 0.6 }, expr: 'round(total * stockTarget, 2)', format: 'usd', answer: '$18,000.00',
            reasoning: '60% of $30,000, the target weight before any drift.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What was held in the bond fund at the start, at 40%?',
            given: { total2: 30000, bondTarget: 0.4 }, expr: 'round(total2 * bondTarget, 2)', format: 'usd', answer: '$12,000.00',
            reasoning: '40% of $30,000 — the two holdings together make the whole portfolio.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the stock fund worth after returning 21.4%?',
            given: { stockReturn: 0.214 }, expr: 'round(#t1-p1 * (1 + stockReturn), 2)', format: 'usd', answer: '$21,852.00',
            reasoning: '$18,000.00 grown by 21.4% — the strong year that causes the drift.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the bond fund worth after returning 2.6%?',
            given: { bondReturn: 0.026 }, expr: 'round(#t1-p2 * (1 + bondReturn), 2)', format: 'usd', answer: '$12,312.00',
            reasoning: '$12,000.00 grown by 2.6% — the weaker of the two returns, which is why the portfolio drifts away from bonds rather than towards them.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now check the policy and compute the trade it requires.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the portfolio worth at the end of the year?',
            given: {}, expr: '#t1-p3 + #t1-p4', format: 'usd', answer: '$34,164.00',
            reasoning: '$21,852.00 in stocks and $12,312.00 in bonds.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of the portfolio is now in the stock fund? Give one decimal place.',
            given: {}, expr: 'round(#t1-p3 / #t2-p1 * 100, 1)', format: 'percent1', answer: '64.0%',
            reasoning: '$21,852.00 of $34,164.00. Nothing was bought or sold; the drift came entirely from the two funds performing differently.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Does the written policy require a rebalance?',
            choices: ['Yes, the drift exceeds the 3 percentage point trigger', 'No, the drift is within the trigger'],
            given: { upperBand: 63 },
            decision: { left: '#t2-p2', cmp: '>', right: 'upperBand', ifTrue: 'Yes, the drift exceeds the 3 percentage point trigger', ifFalse: 'No, the drift is within the trigger' },
            answer: 'Yes, the drift exceeds the 3 percentage point trigger',
            reasoning: 'The stock weight has reached 64.0% against a 60% target, so it has drifted 4 percentage points and passed the 63% point at which the policy triggers.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What should the stock fund hold to be back on its 60% target?',
            given: { stockTarget2: 0.6 }, expr: 'round(#t2-p1 * stockTarget2, 2)', format: 'usd', answer: '$20,498.40',
            reasoning: '60% of the new $34,164.00 total — the target is a share of the portfolio as it now stands, not the original $18,000.00.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much of the stock fund must be sold and moved into bonds?',
            given: {}, expr: '#t1-p3 - #t2-p4', format: 'usd', answer: '$1,353.60',
            reasoning: '$21,852.00 held against $20,498.40 targeted. The rule sells part of what did best and buys what did worst, which is what makes it hard to follow without writing it down first.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'percent',
            text: 'What did the portfolio return over the year as a whole? Give one decimal place.',
            given: { total3: 30000 }, expr: 'round((#t2-p1 - total3) / total3 * 100, 1)', format: 'percent1', answer: '13.9%',
            reasoning: '$34,164.00 against $30,000 — between the two funds’ returns, and closer to the stock fund’s because more was held in it.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The rule requires selling $1,353.60 of the fund that returned 21.4% to buy more of the one that returned 2.6%. Explain what the rule is protecting against, and say why writing it in advance is part of how it works.',
            acceptableAnswerCriteria: [
              'Explains that without rebalancing the portfolio drifts towards whatever has risen, so its risk profile changes by accident rather than by decision — here from 60% to 64.0% in stocks.',
              'Explains that a rule written before the drift removes the judgement at the moment it is hardest, when selling the strong performer feels wrong.',
              'Notes that the rule is mechanical: it is triggered by the 3 percentage point threshold rather than by a view about what will happen next.',
            ],
            evidenceRequirements: [
              'Cites the 64.0% drifted weight against the 60% target and the $1,353.60 trade it implies.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response identifies unintended drift in risk as the thing being protected against.',
              'The response treats the advance commitment as the mechanism, not merely as good organisation.',
              'The response does not claim rebalancing improves returns; it manages the mix.',
            ],
            commonMisconception: 'Reading rebalancing as an attempt to predict which holding will do better next.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The target is 60% of $34,164.00, not the original $18,000.00. Explain why the target moves with the portfolio, and what would go wrong if it did not.',
            acceptableAnswerCriteria: [
              'Explains that the policy sets a share of the portfolio, so the dollar target rises and falls with the total — 60% of the new total is $20,498.40.',
              'States what a fixed dollar target would do: after a strong year it would force selling far more than the drift requires, and after a poor year it would push the mix away from the intended shares.',
            ],
            evidenceRequirements: [
              'Uses the $20,498.40 target and the $18,000.00 starting holding in the explanation.',
            ],
            dimensions: ['criteria-application', 'error-diagnosis'],
            lookFors: [
              'The response distinguishes a share target from a dollar target.',
              'The consequence described follows from the arithmetic.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the trade comes out at $3,852.00, the stock fund is being returned to its original $18,000.00 rather than to 60% of the new total. The policy sets a share, so the target is 60% of $34,164.00, which is $20,498.40. Compute the new total first, take the target share of it, and only then subtract.',
    extension: 'Work out what the stock fund would have to return, with bonds flat at 2.6%, for the drift to stop exactly at the 3 percentage point trigger without crossing it.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l05',
    grade: 11, unit: 5, day: 5,
    actor: 'Rosalie Nwosu-Hartmann, a fictional analyst comparing two account structures',
    objective: 'Compare two fictional retirement account structures on the amount finally available, and identify the single fact that decides between them.',
    scenario: 'Rosalie Nwosu-Hartmann is comparing two simulated account structures for a fictional case. The accounts, rates, and tax figures below are invented outlines rather than descriptions of any real programme, and the flat tax rates are a deliberate simplification.',
    materials: ['calculator', 'the two fictional account outlines in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional saver has $6,000 of income to set aside for 25 years, and both accounts grow at 6% a year. In the pre-tax account the whole $6,000 goes in and the final balance is taxed at the rate applying then. In the post-tax account the money is taxed at today’s rate before going in and nothing is taxed on the way out. Today’s rate is 22%; the rate applying at withdrawal is 24%. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the pre-tax account hold after 25 years at 6% a year?',
            given: { contribution: 6000, growth: 0.06 }, expr: 'round(contribution * pow(1 + growth, 25), 2)', format: 'usd', answer: '$25,751.22',
            reasoning: 'The full $6,000 compounds for 25 years, because nothing was taken out of it on the way in.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is left from the pre-tax account after the 24% tax on withdrawal?',
            given: { laterRate: 0.24 }, expr: 'round(#t1-p1 * (1 - laterRate), 2)', format: 'usd', answer: '$19,570.93',
            reasoning: '$25,751.22 less 24%. The tax is charged on the whole balance, including everything the account earned.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much goes into the post-tax account after today’s 22% tax?',
            given: { contribution2: 6000, todayRate: 0.22 }, expr: 'round(contribution2 * (1 - todayRate), 2)', format: 'usd', answer: '$4,680.00',
            reasoning: '$6,000 less 22% — a smaller amount starts compounding, which is the cost of paying the tax first.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the post-tax account hold after 25 years, with nothing taxed on withdrawal?',
            given: { growth2: 0.06 }, expr: 'round(#t1-p3 * pow(1 + growth2, 25), 2)', format: 'usd', answer: '$20,085.95',
            reasoning: '$4,680.00 compounding for 25 years, all of which is available at the end.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two, and test what happens when the rates match.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does the post-tax account leave available?',
            given: {}, expr: '#t1-p4 - #t1-p2', format: 'usd', answer: '$515.02',
            reasoning: '$20,085.95 against $19,570.93. The post-tax account wins here even though less money started compounding.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would the pre-tax account leave if the withdrawal rate were 22% rather than 24%?',
            given: { matchedRate: 0.22 }, expr: 'round(#t1-p1 * (1 - matchedRate), 2)', format: 'usd', answer: '$20,085.95',
            reasoning: 'Exactly the post-tax figure. When the two rates match, the order in which the tax is applied makes no difference at all.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much do the two accounts differ when the rates match?',
            given: {}, expr: '#t2-p2 - #t1-p4', format: 'usd', answer: '$0.00',
            reasoning: 'The two structures are identical when the rate now equals the rate later, which is what identifies the rate difference as the only thing deciding between them.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'The post-tax advantage is what percentage of the pre-tax result? Give two decimal places.',
            given: {}, expr: 'round(#t2-p1 / #t1-p2 * 100, 2)', format: 'percent2', answer: '2.63%',
            reasoning: '$515.02 against $19,570.93 — a two percentage point difference in tax rates produces a 2.63% difference in the final amount.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Under these simplified structures, what decides which account leaves more?',
            choices: [
              'Whether the tax rate at withdrawal is higher or lower than the rate today',
              'How long the money is invested for',
              'The rate of return the account earns',
            ],
            given: {},
            decision: { left: '#t2-p3', cmp: '==', right: '#t2-p3', ifTrue: 'Whether the tax rate at withdrawal is higher or lower than the rate today', ifFalse: 'How long the money is invested for' },
            answer: 'Whether the tax rate at withdrawal is higher or lower than the rate today',
            reasoning: 'When the two rates were set equal the accounts came out identical to the cent, so neither the 25-year period nor the 6% return can be what separates them; only the difference between 22% and 24% does.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The post-tax account wins by $515.02 even though $1,320 less started compounding. Explain why the smaller starting amount does not decide the outcome, and say what a saver would need to believe for the pre-tax structure to be better.',
            acceptableAnswerCriteria: [
              'Explains that both accounts multiply by the same 25-year growth factor, so the comparison reduces to whether 78% of the amount is taken at the start or 76% is left at the end.',
              'Uses the matched-rate result of $0.00 difference to show the growth factor cancels out entirely.',
              'States what would favour pre-tax: expecting a lower tax rate at withdrawal than today, for example on a lower income later.',
            ],
            evidenceRequirements: [
              'Cites the $20,085.95 figure appearing on both sides when the rates match.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'criteria-application'],
            lookFors: [
              'The response identifies the growth factor as common to both, so it cannot decide the comparison.',
              'The belief named is about future tax rates, which is genuinely uncertain, rather than about returns.',
              'A response noting that nobody can know their withdrawal rate 25 years ahead is identifying the real difficulty.',
            ],
            commonMisconception: 'Assuming the account that starts with more invested must end with more available.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'These outlines are simplified inventions with flat rates and no other rules. Name two things a real account structure would specify that these do not, and say which computed figure each would affect.',
            acceptableAnswerCriteria: [
              'Names two genuine specifications, such as contribution limits, rules on withdrawing early, whether tax bands rather than a flat rate apply, or employer contributions.',
              'Ties each to a figure — most defensibly the $19,570.93 or $20,085.95 final amounts — and says how it would move.',
            ],
            evidenceRequirements: [
              'Refers to at least one of the two final figures when describing what the missing rules would change.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The specifications named are ones a real account document would contain.',
              'Each is tied to a figure rather than listed as a general caveat.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the pre-tax account comes out ahead, check whether the 24% withdrawal tax has been applied to the whole $25,751.22 balance rather than only to the growth. Under the stated structure the entire balance is taxed on the way out, because none of it was taxed on the way in. Apply each account’s tax exactly once, at the point the outline names for it.',
    extension: 'Find the withdrawal tax rate at which the pre-tax account would leave $1,000 more than the post-tax one, and say whether that rate is above or below today’s 22%.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l06',
    grade: 11, unit: 5, day: 6,
    actor: 'Augustin Belmonte-Kirilenko, a fictional reviewer separating a record from a forecast',
    objective: 'Distinguish a fictional fund’s recorded five-year result from what an average of its yearly returns would predict, and quantify the gap the distinction creates.',
    scenario: 'Augustin Belmonte-Kirilenko is reviewing a simulated advertisement for a fictional fund. The fund, its returns, and the claims below are invented for this exercise.',
    materials: ['calculator', 'the fictional five-year record in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional fund’s 5 yearly returns were 11.4%, -7.2%, 14.8%, 2.1%, and -3.6%. The advertisement says the fund "has averaged 3.5% a year". A fictional holding of $20,000 was invested at the start of the five years. Round to the stated precision.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the arithmetic mean of the five yearly returns? Give two decimal places.',
            given: { y1: 0.114, y2: -0.072, y3: 0.148, y4: 0.021, y5: -0.036 },
            expr: 'round((y1 + y2 + y3 + y4 + y5) / 5 * 100, 2)', format: 'percent2', answer: '3.50%',
            reasoning: 'The five returns added and divided by 5. The advertisement’s figure is arithmetically correct, which is what makes the rest of the lesson necessary.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the $20,000 actually worth after the five years, applying each return in turn?',
            given: { start: 20000, r1: 0.114, r2: -0.072, r3: 0.148, r4: 0.021, r5: -0.036 },
            expr: 'round(start * (1 + r1) * (1 + r2) * (1 + r3) * (1 + r4) * (1 + r5), 2)', format: 'usd', answer: '$23,361.88',
            reasoning: 'Each year’s return is applied to whatever the holding was worth at the start of that year, which is what actually happened to the money.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would $20,000 be worth after five years at the advertised 3.5% average?',
            given: { start2: 20000 }, expr: 'round(start2 * pow(1 + #t1-p1 / 100, 5), 2)', format: 'usd', answer: '$23,753.73',
            reasoning: 'Five years of steady growth at the advertised average — the figure a reader would expect the average to describe.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'By how much does the advertised average overstate what actually happened?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$391.85',
            reasoning: '$23,753.73 against $23,361.88. The average is true about the yearly figures and false about the money, because losses take a larger share of a bigger balance than the same percentage gain returns.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure the record itself.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the actual gain across the five years?',
            given: { start3: 20000 }, expr: '#t1-p2 - start3', format: 'usd', answer: '$3,361.88',
            reasoning: '$23,361.88 against the $20,000 invested.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the total growth across the five years as a percentage? Give two decimal places.',
            given: { start4: 20000 }, expr: 'round(#t2-p1 / start4 * 100, 2)', format: 'percent2', answer: '16.81%',
            reasoning: '$3,361.88 against $20,000 — the figure that describes the whole period rather than a typical year within it.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percentage points',
            text: 'The two losing years were -7.2% and -3.6%. What do they come to together in percentage points? Give one decimal place.',
            given: { loss1: -7.2, loss2: -3.6 }, expr: 'loss1 + loss2', format: 'dec1', answer: '-10.8',
            reasoning: 'The two negative years added — the part of the record an average absorbs into a single positive figure.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which of the advertisement’s possible claims is a statement of evidence rather than a prediction?',
            choices: [
              '"The fund has averaged 3.5% a year"',
              '"The fund is expected to return 3.5% a year"',
              '"The fund will return 3.5% a year"',
            ],
            given: {},
            answer: '"The fund has averaged 3.5% a year"',
            reasoning: 'Only the first describes something that has already happened and can be checked against the five recorded returns; the other two make claims about years that have not occurred and no record can establish.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The advertisement’s 3.5% figure is correct and overstates the result by $391.85. Explain how both can be true, and say what figure the advertisement should have quoted instead.',
            acceptableAnswerCriteria: [
              'Explains that the mean is a correct average of the five percentages, but percentages compound rather than add, so applying the average as a growth rate produces a larger result than the actual sequence did.',
              'Explains the mechanism: a loss removes a share of a balance that a later equal-sized gain is applied to a smaller base of, so negative years cost more than the average suggests.',
              'Names the better figure: the total 16.81% across the period, or the compound annual rate implied by it.',
            ],
            evidenceRequirements: [
              'Cites the $23,361.88 actual result against the $23,753.73 the average implies.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response distinguishes averaging percentages from compounding them.',
              'The suggested replacement figure is one that could be checked against the record.',
              'The response does not accuse the advertisement of arithmetic error; the 3.5% is right.',
            ],
            commonMisconception: 'Reading an average of yearly returns as the rate that would have produced the same result.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Suppose the advertisement said instead that the fund "is expected to return 3.5% a year". Say what evidence would be needed to support that claim, and whether the five-year record supplies it.',
            acceptableAnswerCriteria: [
              'Explains that a claim about expectation is about years that have not happened, so it needs a stated basis — a model, a stated strategy, or a much longer record — rather than five observations.',
              'Concludes that the record does not supply it, noting that five years including two losing ones is a small sample from which to project.',
            ],
            evidenceRequirements: [
              'Refers to the five-year record, including the -7.2% and -3.6% years, when judging what it can support.',
            ],
            dimensions: ['communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response asks what would justify the claim rather than only rejecting it.',
              'The response identifies the sample size or the variability as the limitation.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the five-year value comes out at $23,753.73, the average is being applied as though it were the actual sequence. The money experienced 11.4%, then -7.2%, and so on, each applied to the balance at the start of that year. Multiply the five growth factors together in order and compare the result with what the average predicted.',
    extension: 'Find the single constant annual return that would have produced exactly $23,361.88 from $20,000 over five years, and say whether it is above or below the advertised 3.5%.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l07',
    grade: 11, unit: 5, day: 7,
    actor: 'Marisol Tanaka-Eberhardt, a fictional student testing a break-even claim',
    objective: 'Test a fictional claim that a gain and an equal-sized loss cancel out, compute the actual outcome, and generalise the result to a second case.',
    scenario: 'Marisol Tanaka-Eberhardt is checking the simulated claim below. The fund, the returns, and the claim are invented for this exercise.',
    materials: ['calculator', 'the fictional claim reproduced in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The claim reads: "A fictional holding gained 50% in one year and lost 50% the next. The two average to 0%, so it broke even." The holding started at $10,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the holding worth after the first year, gaining 50%?',
            given: { start: 10000, gain: 0.5 }, expr: 'round(start * (1 + gain), 2)', format: 'usd', answer: '$15,000.00',
            reasoning: '$10,000 grown by 50%. The gain is applied to $10,000.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after the second year, losing 50%?',
            given: { loss: 0.5 }, expr: 'round(#t1-p1 * (1 - loss), 2)', format: 'usd', answer: '$7,500.00',
            reasoning: 'The loss is applied to $15,000.00, not to $10,000 — half of a larger number is a larger amount than half of the original.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much has the holding actually lost across the two years?',
            given: { start2: 10000 }, expr: 'start2 - #t1-p2', format: 'usd', answer: '$2,500.00',
            reasoning: '$10,000 against the $7,500.00 remaining — a quarter of the holding, from two returns the claim says cancel.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'percent',
            text: 'What is that loss as a percentage of the starting amount? Give one decimal place.',
            given: { start3: 10000 }, expr: 'round(#t1-p3 / start3 * 100, 1)', format: 'percent1', answer: '25.0%',
            reasoning: '$2,500.00 of $10,000 — the claim predicted 0% and the answer is a quarter of the holding.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the same idea on a second case where the two returns are not equal: a gain of 30% followed by a loss of 20%.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is $10,000 worth after gaining 30%?',
            given: { start4: 10000, gain2: 0.3 }, expr: 'round(start4 * (1 + gain2), 2)', format: 'usd', answer: '$13,000.00',
            reasoning: '$10,000 grown by 30% — the same starting amount as the first case, so the two are directly comparable.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after then losing 20%?',
            given: { loss2: 0.2 }, expr: 'round(#t2-p1 * (1 - loss2), 2)', format: 'usd', answer: '$10,400.00',
            reasoning: '20% off $13,000.00. The loss is bigger in dollars than 20% of the original would have been.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What is the actual two-year gain as a percentage? Give one decimal place.',
            given: { start5: 10000 }, expr: 'round((#t2-p2 - start5) / start5 * 100, 1)', format: 'percent1', answer: '4.0%',
            reasoning: '$10,400.00 against $10,000 — the money is 4% ahead.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'The arithmetic mean of 30% and -20% is 5%. What would two years at 5% have produced?',
            given: { start6: 10000, meanRate: 0.05 }, expr: 'round(start6 * pow(1 + meanRate, 2), 2)', format: 'usd', answer: '$11,025.00',
            reasoning: 'Two years of steady 5% growth — the figure the average predicts.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'By how much does the average overstate the second case?',
            given: {}, expr: '#t2-p4 - #t2-p2', format: 'usd', answer: '$625.00',
            reasoning: '$11,025.00 against the actual $10,400.00 — the same kind of overstatement as the first case, smaller because the swings are smaller.',
          },
          {
            ref: 't2-p6', kind: 'choice',
            text: 'What do both cases show about averaging returns?',
            choices: [
              'The arithmetic mean of yearly returns overstates what actually happened whenever the returns vary',
              'The arithmetic mean is only wrong when one of the returns is negative',
              'The arithmetic mean is wrong because the returns were not calculated correctly',
            ],
            given: {},
            decision: { left: '#t2-p4', cmp: '>', right: '#t2-p2', ifTrue: 'The arithmetic mean of yearly returns overstates what actually happened whenever the returns vary', ifFalse: 'The arithmetic mean is only wrong when one of the returns is negative' },
            answer: 'The arithmetic mean of yearly returns overstates what actually happened whenever the returns vary',
            reasoning: 'The mean overstated both cases, by $2,500.00 in the first and $625.00 in the second, and the overstatement is larger where the swing is larger; the individual yearly returns were applied correctly in both.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain in your own words why a 50% gain and a 50% loss do not cancel, and say what percentage gain would be needed to recover from the 50% loss.',
            acceptableAnswerCriteria: [
              'Explains that each return is applied to the balance at the time, so the 50% loss is taken from $15,000.00 while the 50% gain was taken from $10,000.',
              'Computes the recovery correctly: from $7,500.00 back to $10,000 requires a gain of $2,500.00, which is a 33.3% gain rather than 50%.',
              'Draws the general point that recovering from a loss always requires a larger percentage gain than the loss itself.',
            ],
            evidenceRequirements: [
              'Cites the $15,000.00 and $7,500.00 balances when explaining what each percentage was applied to.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The recovery percentage is computed rather than guessed.',
              'The response identifies the changing base as the mechanism.',
              'A response noting that the asymmetry grows with the size of the loss is generalising correctly.',
            ],
            commonMisconception: 'Treating percentage gains and losses as though they were applied to the same base.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The overstatement was $2,500.00 in the first case and $625.00 in the second. Say what explains the difference in size, and what that means for how a fund with volatile returns should be described.',
            acceptableAnswerCriteria: [
              'Identifies the size of the swings as the cause: the first case moved 50% each way and the second only 30% and 20%, so the gap between the average and the outcome is larger.',
              'Concludes that a volatile fund’s average yearly return is a poorer description of its result than a stable one’s, so the actual multi-year outcome should be quoted for volatile funds.',
            ],
            evidenceRequirements: [
              'Compares the two overstatements, $2,500.00 and $625.00, against the size of the returns in each case.',
            ],
            dimensions: ['transfer', 'communication-of-uncertainty'],
            lookFors: [
              'The response links volatility to the size of the gap rather than to the direction of the returns.',
              'The recommendation about description follows from that link.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the holding comes back to $10,000 after the second year, the 50% loss is being taken from the original $10,000 rather than from the $15,000.00 the holding had actually reached. Each return applies to whatever the holding is worth at the start of that year. Write the two years as separate rows with the opening balance shown in each.',
    extension: 'Work out what percentage gain would be needed to recover from a 20% loss, a 40% loss, and a 60% loss, and describe the pattern the three answers make.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l08',
    grade: 11, unit: 5, day: 8,
    actor: 'Fyodor Achterberg-Nwankwo, a fictional analyst comparing two fee structures',
    objective: 'Transfer the fee analysis to two fictional fee structures charged on different bases, and show that which is cheaper depends on the year rather than on the structure.',
    scenario: 'Fyodor Achterberg-Nwankwo is comparing two simulated fee structures for a fictional holding. The funds, fees, and returns below are invented and describe no real product.',
    materials: ['calculator', 'the two fictional fee structures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional holding of $50,000 gains 9.4% in a year. Fund A charges 0.85% of the amount held. Fund B charges 0.2% of the amount held plus 12% of any gain. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the gain at 9.4%?',
            given: { holding: 50000, gainRate: 0.094 }, expr: 'round(holding * gainRate, 2)', format: 'usd', answer: '$4,700.00',
            reasoning: '9.4% of $50,000 — the amount both fee structures are measured against.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Fund A charge, at 0.85% of the amount held?',
            given: { holding2: 50000, feeA: 0.0085 }, expr: 'round(holding2 * feeA, 2)', format: 'usd', answer: '$425.00',
            reasoning: '0.85% of $50,000, charged on the holding regardless of how the year went.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Fund B charge on the amount held, at 0.2%?',
            given: { holding3: 50000, feeB: 0.002 }, expr: 'round(holding3 * feeB, 2)', format: 'usd', answer: '$100.00',
            reasoning: '0.2% of $50,000 — much lower than Fund A’s asset charge, which is the part the advertisement would lead with.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What does Fund B charge on the gain, at 12%?',
            given: { performanceRate: 0.12 }, expr: 'round(#t1-p1 * performanceRate, 2)', format: 'usd', answer: '$564.00',
            reasoning: '12% of the $4,700.00 gain — on its own already larger than Fund A’s entire fee.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two, in this year and in a losing one.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Fund B charge in total this year?',
            given: {}, expr: '#t1-p3 + #t1-p4', format: 'usd', answer: '$664.00',
            reasoning: '$100.00 on the assets and $564.00 on the gain.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much cheaper is Fund A in this year?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$239.00',
            reasoning: '$664.00 against $425.00 — the fund with the higher headline percentage is the cheaper one in a strong year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is left of the gain after Fund A’s fee?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$4,275.00',
            reasoning: '$4,700.00 of gain less the $425.00 fee.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Suppose instead the holding lost 6.2% in the year. What would Fund A charge?',
            given: { holding4: 50000, feeA2: 0.0085 }, expr: 'round(holding4 * feeA2, 2)', format: 'usd', answer: '$425.00',
            reasoning: 'Unchanged here: the fee is charged on the $50,000 held rather than on any gain, so it is owed in full even in a year with no gain at all.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'In that losing year, how much cheaper is Fund B than Fund A?',
            given: {}, expr: '#t2-p4 - #t1-p3', format: 'usd', answer: '$325.00',
            reasoning: '$425.00 against Fund B’s $100.00, because there is no gain for the 12% charge to apply to — the ranking has reversed.',
          },
          {
            ref: 't2-p6', kind: 'choice',
            text: 'Which fund charges less?',
            choices: [
              'Fund A, in every year',
              'Fund B, in every year',
              'It depends on how the year went',
            ],
            given: {},
            decision: { left: '#t2-p5', cmp: '>', right: '0', ifTrue: 'It depends on how the year went', ifFalse: 'Fund A, in every year' },
            answer: 'It depends on how the year went',
            reasoning: 'Fund A is $239.00 cheaper in the 9.4% year and $325.00 dearer in the losing year, so neither structure is cheaper in general and the comparison cannot be made without specifying the year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Earlier in the unit a fee was compared on a single percentage. Say why that method fails here, what has to be specified before these two funds can be compared, and which structure a holder facing several uncertain years would find easier to plan around.',
            acceptableAnswerCriteria: [
              'Explains that the two fees are charged on different bases, so a single percentage does not describe either comparison — Fund B’s cost depends on a gain that is not known in advance.',
              'States what must be specified: the return for the year, or a distribution of returns across the years being compared.',
              'Argues that Fund A’s fee is easier to plan around because it is knowable in advance at $425.00, while acknowledging that this is a different question from which is cheaper.',
            ],
            evidenceRequirements: [
              'Cites the $239.00 gap in the gaining year and the $325.00 gap in the losing year.',
            ],
            dimensions: ['transfer', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the differing fee bases as what breaks the earlier method.',
              'The response separates predictability from cheapness.',
              'A response noting that Fund B’s structure means the manager is paid more when the holder does well is a legitimate additional observation.',
            ],
            commonMisconception: 'Comparing fee structures on their headline percentages when they are charged on different bases.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Fund B charges nothing on gains in a losing year. Say whether that makes it the safer structure for a holder, and name one thing about the arrangement you would want to see specified.',
            acceptableAnswerCriteria: [
              'Gives a considered answer, noting that the $100.00 charge in a losing year is genuinely lower, while the 12% charge in gaining years may cost more over a run of mixed years.',
              'Names something that should be specified, such as whether past losses must be recovered before the performance fee applies again, or what the gain is measured against.',
            ],
            evidenceRequirements: [
              'Refers to the $100.00 losing-year charge and the $564.00 performance fee from the gaining year.',
            ],
            dimensions: ['assumption-identification', 'tradeoff-defense'],
            lookFors: [
              'The response reasons across a run of years rather than one.',
              'The specification named is one a real fee schedule would settle.',
            ],
          },
        ],
      },
    ],
    remediation: 'If Fund B looks cheaper in the 9.4% year, only its 0.2% asset charge is being counted. Its fee has two parts, and the 12% of the $4,700.00 gain adds $564.00 on top of the $100.00. Write each fund’s fee as a list of its parts before totalling, and check that Fund B’s list has two lines and Fund A’s has one.',
    extension: 'Find the annual return at which the two fee structures would charge exactly the same amount, and say what that figure tells you about which kind of year favours each fund.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l09',
    grade: 11, unit: 5, day: 9,
    actor: 'Clementine Vasilyeva-Boateng, a fictional analyst reducing a quoted return to what is left',
    objective: 'Carry a fictional quoted return through fee, tax, and inflation in a single chain, and express what share of the original figure survives.',
    scenario: 'Clementine Vasilyeva-Boateng is preparing a summary of a fictional holding for a simulated case study. The return, fee, tax rate, and inflation rate below are invented, and the flat tax is a deliberate simplification.',
    materials: ['calculator', 'the fictional return and cost figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional holding of $60,000 is quoted as returning 6.9% over one year. The fund charges 0.95% of the amount held. A simplified flat tax of 15% applies to the gain after the fee. Prices rise 3.4% over the year. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the gross gain at the quoted 6.9%?',
            given: { holding: 60000, quoted: 0.069 }, expr: 'round(holding * quoted, 2)', format: 'usd', answer: '$4,140.00',
            reasoning: '6.9% of $60,000 — the only figure in this chain that would appear in an advertisement.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the fee at 0.95% of the amount held?',
            given: { holding2: 60000, feeRate: 0.0095 }, expr: 'round(holding2 * feeRate, 2)', format: 'usd', answer: '$570.00',
            reasoning: '0.95% of the $60,000 held, charged on the balance rather than on the gain.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the gain after the fee?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$3,570.00',
            reasoning: '$4,140.00 less the $570.00 fee.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the gain after the fee and the simplified 15% tax?',
            given: { taxRate: 0.15 }, expr: 'round(#t1-p3 * (1 - taxRate), 2)', format: 'usd', answer: '$3,034.50',
            reasoning: '$3,570.00 less 15% of itself. Two costs have now been taken and the price level has not yet been considered.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now convert the result into what it can actually buy.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the holding worth at the end of the year in nominal terms?',
            given: { holding3: 60000 }, expr: 'holding3 + #t1-p4', format: 'usd', answer: '$63,034.50',
            reasoning: 'The $60,000 held plus the $3,034.50 that survived the fee and the tax.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is that worth in today’s dollars, after 3.4% inflation?',
            given: { inflation: 0.034 }, expr: 'round(#t2-p1 / (1 + inflation), 2)', format: 'usd', answer: '$60,961.80',
            reasoning: 'Dividing by 1.034 converts the year-end amount into money of today’s purchasing power.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the real gain?',
            given: { holding4: 60000 }, expr: '#t2-p2 - holding4', format: 'usd', answer: '$961.80',
            reasoning: '$60,961.80 of purchasing power against the $60,000 started with — under a quarter of the $4,140.00 that was quoted.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What is the real return after fee, tax, and inflation? Give two decimal places.',
            given: { holding5: 60000 }, expr: 'round(#t2-p3 / holding5 * 100, 2)', format: 'percent2', answer: '1.60%',
            reasoning: '$961.80 against $60,000 — the figure that describes what the year actually did for the holder.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'What share of the quoted 6.9% survives to the end of the chain? Give one decimal place.',
            given: {}, expr: 'round(#t2-p3 / #t1-p1 * 100, 1)', format: 'percent1', answer: '23.2%',
            reasoning: '$961.80 of the original $4,140.00. Three costs, each of which sounds modest, together consume more than three-quarters of the quoted return.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'Of the $4,140.00 that did not survive, how much was taken by the fee and the tax together?',
            given: {}, expr: '#t1-p2 + (#t1-p3 - #t1-p4)', format: 'usd', answer: '$1,105.50',
            reasoning: '$570.00 of fee and $535.50 of tax. The remaining reduction — over $2,000 — is the price level, which nobody charges and which is the largest of the three.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Only 23.2% of the quoted return survived. Rank the three reductions by size, say which is easiest for a holder to influence, and explain why the largest one is the one least often mentioned.',
            acceptableAnswerCriteria: [
              'Ranks the three correctly: inflation removes the most, then the $570.00 fee, then the $535.50 tax.',
              'Identifies the fee as the most influenceable, since it is set by the choice of fund and known in advance, while inflation is not controllable and the tax follows from rules.',
              'Explains that inflation is rarely mentioned because it is not a charge anyone levies and does not appear on any statement, so it has to be applied deliberately.',
            ],
            evidenceRequirements: [
              'Cites the $570.00 fee, the $535.50 tax, and the difference between the $63,034.50 nominal and $60,961.80 real values.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The ranking is derived from the figures rather than assumed.',
              'The response explains why inflation is invisible rather than saying it is ignored.',
              'A response noting that the tax is charged on a nominal gain that inflation has partly erased is making a sophisticated and correct point.',
            ],
            commonMisconception: 'Assuming the costs that appear on a statement are the largest costs.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The order of this chain was fee, then tax, then inflation. Say whether changing the order would change the final figure, and explain why.',
            acceptableAnswerCriteria: [
              'States that the fee must come before the tax because the scenario taxes the gain after the fee, so swapping those two would change the answer.',
              'Explains that inflation is applied to the final amount and would give the same result wherever it were applied, since it divides the whole figure rather than a component.',
            ],
            evidenceRequirements: [
              'Refers to the $3,570.00 after-fee gain as the base the 15% tax was applied to.',
            ],
            dimensions: ['criteria-application', 'error-diagnosis'],
            lookFors: [
              'The response checks the order against what each step is applied to.',
              'The response distinguishes the two costs charged on components from the one applied to the whole.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the real gain comes out near $3,034.50, the inflation step has been skipped. The $63,034.50 the holding reaches is in year-end dollars, and prices have risen 3.4% since the start, so it has to be divided by 1.034 to be compared with the $60,000. Lay the chain out as four rows — gross, after fee, after tax, in today’s dollars — and check that each row is smaller than the one above it.',
    extension: 'Find the quoted return that would have been needed to leave a real return of 3% after the same fee, tax, and inflation, and say how much higher that is than 6.9%.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u05-l10',
    grade: 11, unit: 5, day: 10,
    actor: 'Isadora Krisztina-Mensah, a fictional trustee writing a rebalancing policy',
    objective: 'Apply a fictional three-asset rebalancing policy after a year of drift, compute every trade it requires, and defend the policy against the objection that it sells what is working.',
    scenario: 'Isadora Krisztina-Mensah administers a fictional three-asset portfolio under a simulated written policy. All holdings, returns, and target weights below are invented for this performance task.',
    materials: ['calculator', 'the fictional portfolio and policy in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The policy targets 55% in a stock fund, 30% in a bond fund, and 15% in cash, and rebalances once a year. The portfolio began the year at $84,000 exactly on target. Over the year the stock fund returned 19.8%, the bond fund lost 1.4%, and cash returned 4.2%. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What was held in the stock fund at the start, at 55% of $84,000?',
            given: { total: 84000, stockWeight: 0.55 }, expr: 'round(total * stockWeight, 2)', format: 'usd', answer: '$46,200.00',
            reasoning: '55% of $84,000, the largest of the three target holdings.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the stock fund worth after returning 19.8%?',
            given: { stockReturn: 0.198 }, expr: 'round(#t1-p1 * (1 + stockReturn), 2)', format: 'usd', answer: '$55,347.60',
            reasoning: '$46,200.00 grown by 19.8% — the holding that causes the drift.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the bond fund worth after losing 1.4%, having started at 30% of $84,000?',
            given: { total2: 84000, bondWeight: 0.3, bondReturn: 0.014 },
            expr: 'round(total2 * bondWeight * (1 - bondReturn), 2)', format: 'usd', answer: '$24,847.20',
            reasoning: '$25,200.00 at the start, reduced by 1.4%.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the cash holding worth after returning 4.2%, having started at 15% of $84,000?',
            given: { total3: 84000, cashWeight: 0.15, cashReturn: 0.042 },
            expr: 'round(total3 * cashWeight * (1 + cashReturn), 2)', format: 'usd', answer: '$13,129.20',
            reasoning: '$12,600.00 at the start, grown by 4.2%.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now apply the policy and compute every trade it requires.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the portfolio worth at the end of the year?',
            given: {}, expr: '#t1-p2 + #t1-p3 + #t1-p4', format: 'usd', answer: '$93,324.00',
            reasoning: '$55,347.60 in stocks, $24,847.20 in bonds, and $13,129.20 in cash.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of the portfolio is now in the stock fund? Give two decimal places.',
            given: {}, expr: 'round(#t1-p2 / #t2-p1 * 100, 2)', format: 'percent2', answer: '59.31%',
            reasoning: '$55,347.60 of $93,324.00 — over four percentage points above the 55% target, from performance alone.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the stock fund must be sold to return it to 55%?',
            given: { stockWeight2: 0.55 }, expr: 'round(#t1-p2 - #t2-p1 * stockWeight2, 2)', format: 'usd', answer: '$4,019.40',
            reasoning: '$55,347.60 held against a target of $51,328.20, which is 55% of the new total.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much must be added to the bond fund to return it to 30%?',
            given: { bondWeight2: 0.3 }, expr: 'round(#t2-p1 * bondWeight2 - #t1-p3, 2)', format: 'usd', answer: '$3,150.00',
            reasoning: 'A target of $27,997.20 against the $24,847.20 held — the fund that lost money is the one that receives.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much must be added to cash to return it to 15%?',
            given: { cashWeight2: 0.15 }, expr: 'round(#t2-p1 * cashWeight2 - #t1-p4, 2)', format: 'usd', answer: '$869.40',
            reasoning: 'A target of $13,998.60 against the $13,129.20 held.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'Check the trades balance: what do the two purchases come to together?',
            given: {}, expr: '#t2-p4 + #t2-p5', format: 'usd', answer: '$4,019.40',
            reasoning: '$3,150.00 into bonds and $869.40 into cash, exactly matching the $4,019.40 sold from stocks — no money enters or leaves the portfolio, which is the check that the rebalance is correct.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One more figure before the defence.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'What did the portfolio return over the year as a whole? Give one decimal place.',
            given: { total4: 84000 }, expr: 'round((#t2-p1 - total4) / total4 * 100, 1)', format: 'percent1', answer: '11.1%',
            reasoning: '$93,324.00 against $84,000 — well below the stock fund’s 19.8%, because only 55% of the portfolio was in it.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which figure shows the rebalance has been computed correctly?',
            choices: [
              'The stock weight returning to exactly 55%',
              'The two purchases totalling exactly the amount sold',
              'The portfolio total staying at $93,324.00 after the trades',
            ],
            given: {},
            decision: { left: '#t2-p6', cmp: '==', right: '#t2-p3', ifTrue: 'The two purchases totalling exactly the amount sold', ifFalse: 'The stock weight returning to exactly 55%' },
            answer: 'The two purchases totalling exactly the amount sold',
            reasoning: 'All three statements are true after a correct rebalance, but only the balance of purchases against the sale is a check that would fail if a target had been miscomputed; a weight can be set to 55% and a total can be preserved even when the other two holdings are wrong.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your defence of the policy. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'A trustee objects that the policy sells $4,019.40 of the fund that returned 19.8% to buy more of one that lost money. Answer the objection, state what the policy is actually managing, and name the circumstance in which the objection would be right.',
            acceptableAnswerCriteria: [
              'Answers the objection by identifying what the policy manages: the mix of the portfolio, which drifted from 55% to 59.31% without any decision being taken.',
              'States that the policy makes no claim about which fund will do better next, so selling the strong performer is not a prediction that it will fall.',
              'Names a circumstance in which the objection has force, such as trading costs or tax on the sale making the rebalance cost more than the drift is worth, or the target weights themselves no longer suiting the portfolio’s purpose.',
            ],
            evidenceRequirements: [
              'Cites the 59.31% drifted stock weight against the 55% target, and the $4,019.40 trade.',
              'Refers to the check that the two purchases total exactly the amount sold.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The defence rests on managing the mix, not on a view about future returns.',
              'The circumstance conceded is a real one rather than a token concession.',
              'A response noting that the portfolio returned 11.1% against the stock fund’s 19.8% is showing what the mix does.',
            ],
            commonMisconception: 'Reading a rebalancing rule as a forecast about which holding will do better.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The policy rebalances once a year. Say what would change if it rebalanced monthly instead, and what would change if it rebalanced every five years.',
            acceptableAnswerCriteria: [
              'States that monthly rebalancing keeps the mix closer to target but trades far more often, raising costs and any tax on sales.',
              'States that a five-year interval allows much larger drift, so the portfolio could spend years at a mix well beyond 59.31% before any correction.',
            ],
            evidenceRequirements: [
              'Uses the 59.31% drift reached in a single year as the reference point for both alternatives.',
            ],
            dimensions: ['transfer', 'tradeoff-defense'],
            lookFors: [
              'Both directions are addressed, not only one.',
              'The response treats the interval as a tradeoff between drift and cost.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the purchases do not add up to the amount sold, at least one target has been taken as a share of the original $84,000 rather than of the new $93,324.00 total. Every target is a share of the portfolio as it now stands. Compute the new total first, then all three targets from it, and check that the three targets themselves add back to $93,324.00 before working out any trade.',
    extension: 'Recompute the trades if the policy targeted 45% stocks, 35% bonds, and 20% cash, and say which holding would then have drifted furthest from its target.',
  },
]
