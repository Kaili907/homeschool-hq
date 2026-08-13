import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 5 — PF5 Financial Investing: Risk, Return, and Why
 * Diversification Matters.
 */
export const g09u05: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u05-l01',
    grade: 9, unit: 5, day: 1,
    actor: 'a fictional investor comparing three invented one-year options',
    objective: 'Compute the expected gain and the worst-case outcome for three fictional investment options, and describe the relationship between the two.',
    scenario: 'A fictional investor has $5,000 to place for one year in a simulated market. The three invented options below carry expected returns and stated ranges of possible outcomes; none is a real product.',
    materials: ['calculator', 'the three fictional option descriptions in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Option A, an insured savings certificate, returns exactly 3% with no other outcome possible. Option B, a bond fund, has an expected return of 4.6% with outcomes ranging from -3% to +11%. Option C, a stock fund, has an expected return of 8.2% with outcomes ranging from -28% to +34%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected one-year gain on Option A?',
            given: { stake: 5000, rateA: 0.03 }, expr: 'stake * rateA', format: 'usd', answer: '$150.00',
            reasoning: '3% of $5,000, and for Option A this is also the only possible outcome.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected one-year gain on Option B?',
            given: { stake2: 5000, rateB: 0.046 }, expr: 'stake2 * rateB', format: 'usd', answer: '$230.00',
            reasoning: '4.6% of $5,000, which is the average of a range, not a promise.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected one-year gain on Option C?',
            given: { stake3: 5000, rateC: 0.082 }, expr: 'stake3 * rateC', format: 'usd', answer: '$410.00',
            reasoning: '8.2% of $5,000, again an expected value drawn from a wide range.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compute the worst case each option allows.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Option B worth at the bottom of its stated range, -3%?',
            given: { stake4: 5000, lossB: 0.03 }, expr: 'stake4 * (1 - lossB)', format: 'usd', answer: '$4,850.00',
            reasoning: 'A 3% loss on $5,000 leaves $4,850.00.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Option C worth at the bottom of its stated range, -28%?',
            given: { stake5: 5000, lossC: 0.28 }, expr: 'stake5 * (1 - lossC)', format: 'usd', answer: '$3,600.00',
            reasoning: 'A 28% loss on $5,000 leaves $3,600.00 — the investor would be $1,400 down.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the full spread of Option C — the distance between its best outcome at +34% and its worst?',
            given: { stake6: 5000, gainC: 0.34 }, expr: 'stake6 * (1 + gainC) - #t2-p2', format: 'usd', answer: '$3,100.00',
            reasoning: '$6,700.00 at the top of the range against $3,600.00 at the bottom.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Describe the pattern linking each option’s expected gain to its spread of outcomes, and explain what an investor is actually paying for when they accept Option A’s $150 instead of Option C’s $410.',
            acceptableAnswerCriteria: [
              'States the pattern: the higher the expected gain, the wider the range of outcomes — A has no spread, B has $700 of spread, C has $3,100.',
              'Explains that Option A’s lower return buys certainty, so the investor is paying $260 of expected gain for the removal of the possibility of loss.',
              'Notes that an expected return is an average over outcomes, so Option C does not promise $410 in any particular year.',
            ],
            evidenceRequirements: [
              'Uses at least one expected gain and one worst-case figure from each of at least two options.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty', 'tradeoff-defense'],
            lookFors: [
              'The response treats the spread as the price of the higher expected return rather than as a flaw.',
              'The response does not describe Option C as simply "riskier" without using the range figures.',
            ],
            commonMisconception: 'Reading an expected rate of return as the return that will be received.',
          },
        ],
      },
    ],
    remediation: 'If the worst-case values come out above the stake, the loss percentage is being added rather than subtracted. Write the multiplier first — a 28% loss means multiplying by 0.72 — and check that the result is smaller than $5,000 before recording it.',
    extension: 'Compute what Option C would have to be worth after one year for the investor to be no worse off than Option A, and express that as a required return.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l02',
    grade: 9, unit: 5, day: 2,
    actor: 'a fictional investor measuring a return against inflation',
    objective: 'Convert a fictional nominal return into a real return by adjusting for inflation, and state what the money will actually buy at the end of the year.',
    scenario: 'A fictional investment of $4,000 returns 5.4% over one simulated year while prices in that simulated economy rise 3.1%. All figures are invented for this exercise.',
    materials: ['calculator', 'the fictional return and inflation figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional investment grows 5.4% in the year. Prices rise 3.1% over the same year, so a basket costing $1.00 in January costs $1.031 in December.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the investment worth at the end of the year in plain dollars?',
            given: { stake: 4000, nominalRate: 0.054 }, expr: 'stake * (1 + nominalRate)', format: 'usd', answer: '$4,216.00',
            reasoning: '$4,000 grown by 5.4% is $4,216.00, which is the nominal value.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is that end-of-year amount worth in January prices? Round to the nearest cent.',
            given: { stake2: 4000, nominalRate2: 0.054, inflation: 0.031 }, expr: 'round(stake2 * (1 + nominalRate2) / (1 + inflation), 2)', format: 'usd', answer: '$4,089.23',
            reasoning: '$4,216.00 divided by the price level of 1.031 gives what it buys in January terms.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the real gain — the increase in what the money can buy?',
            given: { stake3: 4000 }, expr: '#t1-p2 - stake3', format: 'usd', answer: '$89.23',
            reasoning: '$4,089.23 of purchasing power against the $4,000 that went in.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now express the same result as a rate.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the real rate of return? Round to one decimal place.',
            given: { nominalRate3: 0.054, inflation2: 0.031 }, expr: 'round(((1 + nominalRate3) / (1 + inflation2) - 1) * 100, 1)', format: 'percent1', answer: '2.2%',
            reasoning: '1.054 divided by 1.031 is 1.02231, so the real return is 2.2% — slightly less than the 2.3% that subtracting the rates would suggest.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'If inflation had instead been 6.0%, would this investment have gained or lost purchasing power?',
            choices: ['Gained purchasing power', 'Lost purchasing power', 'Neither; it would have broken even'],
            given: { nominalRate: 5.4, altInflation: 6 },
            decision: { left: 'nominalRate', cmp: '>', right: 'altInflation', ifTrue: 'Gained purchasing power', ifFalse: 'Lost purchasing power' },
            answer: 'Lost purchasing power',
            reasoning: 'A 5.4% nominal return against 6.0% inflation leaves the investor able to buy less at the end of the year than at the start, even though the dollar balance rose.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The account balance rose by $216 and the investor got $89.23 better off. Explain where the other $126.77 went, and say why a statement showing only the balance can be misleading.',
            acceptableAnswerCriteria: [
              'Explains that $126.77 of the nominal gain was consumed by prices rising 3.1%, so it restored purchasing power rather than adding any.',
              'States that a statement reports dollars, which do not hold a constant value, so the same balance means less each year prices rise.',
              'Uses the real return of 2.2% rather than only the dollar figures.',
            ],
            evidenceRequirements: [
              'Uses the $4,216.00 nominal value, the $4,089.23 real value, and the 3.1% inflation rate.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not describe the $126.77 as a fee or a loss taken by anyone.',
              'The response recognises the investor is genuinely better off, just by less than the balance suggests.',
            ],
            commonMisconception: 'Reading a rise in an account balance as a rise in what the money can buy.',
          },
        ],
      },
    ],
    remediation: 'If the real return comes out as exactly 2.3%, the two rates are being subtracted. Subtraction is a good estimate but not the calculation: divide 1.054 by 1.031 and subtract 1 to get the real figure.',
    extension: 'Compute the nominal return this investment would have needed to deliver a 4% real return at 3.1% inflation, and say how far that is above 7.1%.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l03',
    grade: 9, unit: 5, day: 3,
    actor: 'a fictional investor comparing two invented funds and a blend of them',
    objective: 'Compute three years of growth for two fictional funds and for an even blend of them, and show what the blend does to the year-to-year swings.',
    scenario: 'The two fictional funds below posted the simulated annual returns shown. A third option puts half the money in each and rebalances every year. All figures are invented for this exercise.',
    materials: ['calculator', 'the fictional three-year return record in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Fund P returned +18%, then -12%, then +9%. Fund Q returned -4%, then +14%, then +3%. A 50/50 blend rebalanced each year therefore returned +7%, then +1%, then +6%. Each option starts with $2,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Fund P worth after the three years? Round to the nearest cent.',
            given: { stake: 2000, p1: 0.18, p2: 0 - 0.12, p3: 0.09 }, expr: 'round(stake * (1 + p1) * (1 + p2) * (1 + p3), 2)', format: 'usd', answer: '$2,263.71',
            reasoning: '$2,000 x 1.18 x 0.88 x 1.09, applying each year’s return to the balance the previous year left.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Fund Q worth after the three years?',
            given: { stake2: 2000, q1: 0 - 0.04, q2: 0.14, q3: 0.03 }, expr: 'round(stake2 * (1 + q1) * (1 + q2) * (1 + q3), 2)', format: 'usd', answer: '$2,254.46',
            reasoning: '$2,000 falling 4%, then rising 14%, then rising 3%, each applied to the running balance.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the 50/50 blend worth after the three years?',
            given: { stake3: 2000, b1: 0.07, b2: 0.01, b3: 0.06 }, expr: 'round(stake3 * (1 + b1) * (1 + b2) * (1 + b3), 2)', format: 'usd', answer: '$2,291.08',
            reasoning: '$2,000 x 1.07 x 1.01 x 1.06 — the blend ends above both of the funds it is made from.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the swings rather than the endings.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the spread of Fund P’s annual returns — its best year minus its worst?',
            given: { pBest: 18, pWorst: 0 - 12 }, expr: 'pBest - pWorst', format: 'percent1', answer: '30.0%',
            reasoning: '+18% in the best year against -12% in the worst.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the spread of the blend’s annual returns?',
            given: { bBest: 7, bWorst: 1 }, expr: 'bBest - bWorst', format: 'percent1', answer: '6.0%',
            reasoning: '+7% in the best year against +1% in the worst; the blend never had a losing year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more did the blend produce than Fund Q?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$36.62',
            reasoning: 'The blend’s $2,291.08 against Fund Q’s $2,254.46 after the same three years.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The blend ended above both funds and swung far less than Fund P. Explain how holding both can beat holding either, and say what property of these two funds made that possible.',
            acceptableAnswerCriteria: [
              'Identifies that the funds moved in opposite directions in the first two years, so the blend avoided Fund P’s -12% year and Fund Q’s -4% year.',
              'Explains that avoiding a large loss matters more than matching a large gain, because a loss must be recovered from a smaller base.',
              'States the property required: the two holdings must not move together, and diversification does nothing if they do.',
            ],
            evidenceRequirements: [
              'Uses both spreads, 30.0% and 6.0%, and at least two of the three ending balances.',
            ],
            dimensions: ['reasoning-from-figures', 'transfer', 'assumption-identification'],
            lookFors: [
              'The response identifies the opposite movement as the mechanism rather than "spreading risk" in general.',
              'The response does not claim diversification guarantees a higher return; here it happened to, and that needs saying.',
            ],
            commonMisconception: 'Believing diversification works by owning many things rather than by owning things that do not move together.',
          },
        ],
      },
    ],
    remediation: 'If the three-year values come out by adding the percentages, note that a -12% year applies to whatever the +18% year produced, not to the original $2,000. Multiply the three factors in sequence, writing the balance after each year.',
    extension: 'Recompute the blend if Fund Q had returned +16%, -10%, and +8% — moving with Fund P rather than against it — and say what happens to the spread.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l04',
    grade: 9, unit: 5, day: 4,
    actor: 'a fictional saver matching three goals to three time horizons',
    objective: 'Compute the monthly amount each of three fictional goals requires, and match each goal to a category of holding on the basis of its time horizon.',
    scenario: 'A fictional saver has three simulated goals at three different distances. The amounts, dates, and holding categories below are invented for this exercise and are not recommendations.',
    materials: ['calculator', 'the three fictional goals in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Goal 1: $900 for a replacement laptop, needed in 8 months. Goal 2: $7,000 toward a vehicle, needed in 48 months. Goal 3: a long-horizon goal 30 years away, funded by a single $5,000 placement growing at 6% a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much a month does Goal 1 require, assuming no growth?',
            given: { goal1: 900, months1: 8 }, expr: 'round(goal1 / months1, 2)', format: 'usd', answer: '$112.50',
            reasoning: '$900 over 8 months, with no growth assumed because 8 months is too short to rely on any.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much a month does Goal 2 require, assuming no growth?',
            given: { goal2: 7000, months2: 48 }, expr: 'round(goal2 / months2, 2)', format: 'usd', answer: '$145.83',
            reasoning: '$7,000 divided across 48 months, again with no growth assumed at this horizon.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Goal 3’s single $5,000 placement reach after 30 years at 6% a year?',
            given: { placement: 5000, rate: 0.06, years: 30 }, expr: 'round(placement * pow(1 + rate, years), 2)', format: 'usd', answer: '$28,717.46',
            reasoning: '$5,000 x 1.06 to the thirtieth power, with nothing added along the way.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now match each goal to a holding category. The categories are: insured cash, which cannot lose value; a bond-type holding, which can lose a little in a bad year; and a stock-type holding, which can lose a lot in a bad year but has the highest long-run expected return.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Which category fits Goal 1, needed in 8 months?',
            choices: ['Insured cash', 'A bond-type holding', 'A stock-type holding'],
            given: {},
            answer: 'Insured cash',
            reasoning: 'With 8 months to the date and a fixed $900 required, there is no time to recover from a fall, so certainty matters more than expected return.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Which category fits Goal 3, 30 years away?',
            choices: ['Insured cash', 'A bond-type holding', 'A stock-type holding'],
            given: {},
            answer: 'A stock-type holding',
            reasoning: 'A 30-year horizon leaves time to recover from bad years, and over that span the difference in expected return compounds into the largest part of the outcome.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If Goal 3’s placement instead grew at 3% a year for the same 30 years, what would it reach?',
            given: { placement2: 5000, lowRate: 0.03, years2: 30 }, expr: 'round(placement2 * pow(1 + lowRate, years2), 2)', format: 'usd', answer: '$12,136.31',
            reasoning: '$5,000 x 1.03 to the thirtieth power — less than half the 6% outcome, from a rate difference of three percentage points.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why the same holding can be the right choice for Goal 3 and the wrong choice for Goal 1, and say what would have to change about Goal 1 for the answer to change.',
            acceptableAnswerCriteria: [
              'States that time horizon, not the holding, decides: a holding that can fall sharply is survivable when there are decades to recover and not when the money is needed in 8 months.',
              'Uses the $28,717.46 and $12,136.31 figures to show what the long horizon is worth, and the fixed $900 requirement to show why Goal 1 cannot absorb a fall.',
              'Names what would change the answer for Goal 1 — a flexible date, or the goal no longer being required at all.',
            ],
            evidenceRequirements: [
              'Uses the two 30-year figures and at least one of the monthly requirements.',
            ],
            dimensions: ['criteria-application', 'transfer', 'tradeoff-defense'],
            lookFors: [
              'The response treats the deadline as the binding constraint rather than the saver’s comfort with risk.',
              'The response does not describe stock-type holdings as simply better or simply dangerous.',
            ],
            commonMisconception: 'Choosing investments by expected return alone, without asking when the money is needed.',
          },
        ],
      },
    ],
    remediation: 'If Goal 2 is being matched to a stock-type holding because 48 months sounds long, put the two deadlines beside the ranges from the first lesson of this unit: a 28% fall on money needed in four years leaves no assurance of recovery by the date.',
    extension: 'Work out what monthly amount Goal 2 would require if the money grew 3% a year, and say whether the growth changes the category it belongs in.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l05',
    grade: 9, unit: 5, day: 5,
    actor: 'a fictional household checking deposit insurance coverage',
    objective: 'Apply a fictional deposit insurance limit to a simulated household’s balances, compute the uninsured amount, and restructure the holdings so nothing is uninsured.',
    scenario: 'In this simulated jurisdiction, a government agency insures deposits up to $250,000 per depositor per bank in a single ownership category. The fictional household and its balances below are invented for this exercise.',
    materials: ['calculator', 'the fictional balance summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household holds $312,000 at one simulated bank, all in a single ownership category. The insurance limit is $250,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the household’s deposit is uninsured?',
            given: { held: 312000, limit: 250000 }, expr: 'held - limit', format: 'usd', answer: '$62,000.00',
            reasoning: '$312,000 held against a $250,000 limit at one bank in one category.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'If the household splits the money evenly between two separate insured banks, how much sits at each?',
            given: { held2: 312000 }, expr: 'held2 / 2', format: 'usd', answer: '$156,000.00',
            reasoning: '$312,000 divided between two banks.',
          },
          {
            ref: 't1-p3', kind: 'choice',
            text: 'After that split, how much is uninsured?',
            choices: ['$62,000', '$31,000', 'Nothing'],
            given: { limit2: 250000 },
            decision: { left: '#t1-p2', cmp: '>', right: 'limit2', ifTrue: '$62,000', ifFalse: 'Nothing' },
            answer: 'Nothing',
            reasoning: '$156,000 at each bank is below the $250,000 limit that applies separately at each institution.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The agency insures deposits. It does not insure investments.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'The household also holds $40,000 in a stock fund at a brokerage. If that fund falls 30% in a year, what does deposit insurance pay?',
            choices: ['$12,000, the amount of the fall', '$40,000, the full holding', 'Nothing; deposit insurance does not cover investment losses'],
            answer: 'Nothing; deposit insurance does not cover investment losses',
            reasoning: 'Deposit insurance protects against the failure of an insured bank, not against a holding losing value; a 30% fall is the investment behaving as an investment.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would that $40,000 stock fund be worth after a 30% fall?',
            given: { fund: 40000, fall: 0.3 }, expr: 'fund * (1 - fall)', format: 'usd', answer: '$28,000.00',
            reasoning: '$40,000 reduced by 30%, a loss the household bears in full.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain the difference between the two risks in this scenario — the bank failing and the fund falling — and say what a government agency can and cannot protect against.',
            acceptableAnswerCriteria: [
              'Distinguishes the risk that an institution fails, which insurance can cover up to $250,000, from the risk that an investment loses value, which it cannot.',
              'Explains why the second is uninsurable: the possibility of loss is the reason the holding is expected to return more in the first place.',
              'Notes what agencies do instead for investments — requiring disclosure, registration, and honest dealing — rather than guaranteeing outcomes.',
            ],
            evidenceRequirements: [
              'Uses the $62,000 uninsured figure and the $28,000 post-fall value as the two contrasting cases.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not treat the absence of investment insurance as a gap in protection.',
              'The response recognises the split across two banks is a real solution to a real limit, not a trick.',
            ],
            commonMisconception: 'Assuming that because a financial institution is regulated, the money held there cannot lose value.',
          },
        ],
      },
    ],
    remediation: 'If the split still shows an uninsured amount, reread how the limit applies: it is per depositor per bank, so two banks give two separate $250,000 limits. Compare $156,000 with $250,000, not with half of it.',
    extension: 'Work out the largest total this household could hold fully insured across three banks under the same rule, and say what practical costs that structure carries.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l06',
    grade: 9, unit: 5, day: 6,
    actor: 'a fictional saver comparing two invented tax treatments',
    objective: 'Compare a fictional pre-tax account with a fictional after-tax account over the same term and rate, and identify which figure decides between them.',
    scenario: 'Two simulated retirement account types are compared below on a $3,000 contribution. The tax rates, the growth rate, and the term are invented for this exercise, and nothing here is tax advice.',
    materials: ['calculator with a power function', 'the two fictional account descriptions in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Account T takes the contribution before tax: the full $3,000 goes in, and the whole withdrawal is taxed at 15% in 20 years. Account R takes it after tax: the $3,000 is taxed at 22% first and only what remains goes in, but the withdrawal is not taxed. Both grow 6% a year for 20 years.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Account T grow to before any withdrawal tax?',
            given: { contribution: 3000, rate: 0.06, years: 20 }, expr: 'round(contribution * pow(1 + rate, years), 2)', format: 'usd', answer: '$9,621.41',
            reasoning: 'The full $3,000 x 1.06 to the twentieth power, because nothing was taxed on the way in.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is left from Account T after the 15% withdrawal tax?',
            given: { withdrawalTax: 0.15 }, expr: 'round(#t1-p1 * (1 - withdrawalTax), 2)', format: 'usd', answer: '$8,178.20',
            reasoning: '$9,621.41 less 15% taken at withdrawal.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much actually goes into Account R after the 22% tax on the contribution?',
            given: { contribution2: 3000, contributionTax: 0.22 }, expr: 'contribution2 * (1 - contributionTax)', format: 'usd', answer: '$2,340.00',
            reasoning: '$3,000 less 22%, so $2,340 is what starts growing.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Finish the comparison.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Account R produce after 20 years, with no tax on withdrawal?',
            given: { rate2: 0.06, years2: 20 }, expr: 'round(#t1-p3 * pow(1 + rate2, years2), 2)', format: 'usd', answer: '$7,504.70',
            reasoning: '$2,340 x 1.06 to the twentieth power, all of it kept.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more does Account T deliver?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$673.50',
            reasoning: 'Account T’s after-tax $8,178.20 against Account R’s untaxed $7,504.70.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which comparison decides between the two accounts?',
            choices: [
              'The growth rate, since both grow at 6%',
              'The term, since both run 20 years',
              'Whether the tax rate at withdrawal is lower or higher than the tax rate today',
              'The contribution amount, since both start from $3,000',
            ],
            answer: 'Whether the tax rate at withdrawal is lower or higher than the tax rate today',
            reasoning: 'Growth, term, and contribution are identical across the two accounts, so the only thing that differs is where the tax falls — 22% today against 15% later.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Account T won here by $673.50. Explain what would have to be true for Account R to win instead, and say why neither answer can be settled with certainty today.',
            acceptableAnswerCriteria: [
              'States that Account R wins when the withdrawal tax rate is higher than the rate avoided today — here, above 22% rather than the assumed 15%.',
              'Explains that the withdrawal rate depends on future income and future tax law, neither of which is known 20 years ahead.',
              'Uses the two ending figures to show the margin is modest, so a moderate change in the assumed rates could reverse it.',
            ],
            evidenceRequirements: [
              'Uses both after-tax outcomes, $8,178.20 and $7,504.70, and both tax rates, 22% and 15%.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies the future tax rate as the load-bearing assumption.',
              'The response does not recommend either account as the right choice for a real person.',
            ],
            commonMisconception: 'Treating a pre-tax account as always better because the contribution is larger.',
          },
        ],
      },
    ],
    remediation: 'If Account R comes out ahead, check that the 22% was taken before the growth rather than after. Only $2,340 grows in Account R, and that difference at the start is what the 20 years of compounding then multiplies.',
    extension: 'Find the withdrawal tax rate at which the two accounts finish exactly level, and say what that rate means in words.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l07',
    grade: 9, unit: 5, day: 7,
    actor: 'a fictional investor who averaged the annual returns',
    objective: 'Find the error in a fictional projection built from an average annual return, compute what actually happened, and quantify the gap the averaging created.',
    scenario: 'A fictional investor wrote: "This fund averaged 12% a year over three years, so my $10,000 should be worth about $14,000." The three simulated annual returns are given below and are invented for this exercise.',
    materials: ['the fictional return record in these directions', 'calculator with a power function'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional fund returned +40% in year 1, -30% in year 2, and +26% in year 3.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the arithmetic average of the three annual returns? Round to one decimal place.',
            given: { r1: 40, r2: 0 - 30, r3: 26 }, expr: 'round((r1 + r2 + r3) / 3, 1)', format: 'percent1', answer: '12.0%',
            reasoning: '40 minus 30 plus 26 is 36, divided by 3 years, so the investor’s 12% average is correctly computed.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the investor’s projection give — $10,000 growing 12% a year for 3 years?',
            given: { stake: 10000, years: 3 }, expr: 'round(stake * pow(1 + #t1-p1 / 100, years), 2)', format: 'usd', answer: '$14,049.28',
            reasoning: 'This reproduces the investor’s own method: $10,000 x 1.12 to the third power.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now apply the three actual returns in order.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after year 1?',
            given: { stake2: 10000, y1: 0.4 }, expr: 'stake2 * (1 + y1)', format: 'usd', answer: '$14,000.00',
            reasoning: 'The first year’s +40% applied to the original $10,000 stake.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after year 2?',
            given: { y2: 0.3 }, expr: '#t2-p1 * (1 - y2)', format: 'usd', answer: '$9,800.00',
            reasoning: 'The 30% fall applies to the $14,000 the good year produced, taking the balance below the original stake.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after year 3?',
            given: { y3: 0.26 }, expr: '#t2-p2 * (1 + y3)', format: 'usd', answer: '$12,348.00',
            reasoning: 'The third year’s +26% applied to the $9,800 the second year left.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Locate and measure the error.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much did the investor’s projection overstate the actual result?',
            given: {}, expr: '#t1-p2 - #t2-p3', format: 'usd', answer: '$1,701.28',
            reasoning: '$14,049.28 projected against $12,348.00 actually reached.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'What went wrong in the investor’s reasoning?',
            choices: [
              'The average was computed incorrectly',
              'An average of annual percentages does not compound to the same result as the actual sequence',
              'The fund’s returns were misreported',
              'Nothing; $14,049.28 is what the fund produced',
            ],
            answer: 'An average of annual percentages does not compound to the same result as the actual sequence',
            reasoning: 'The 12% average is arithmetically correct, but a 30% loss removes more value than a 30% gain adds, so averaging the rates and compounding the average overstates what a volatile sequence delivers.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why the year-2 loss cost more than the year-1 gain earned, using the balances, and state what an advertisement quoting an "average annual return" is and is not telling you.',
            acceptableAnswerCriteria: [
              'Explains that the 30% loss was taken on $14,000 while the 40% gain was earned on $10,000, so the same-looking percentages moved very different amounts of money.',
              'States that an average annual return describes the rates, not the outcome, and that the wider the swings the further the two diverge.',
              'Notes what the investor should ask for instead: the actual ending value, or the growth rate that would have produced it.',
            ],
            evidenceRequirements: [
              'Uses the year-1 and year-2 balances, $14,000.00 and $9,800.00, and the final $12,348.00.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response notices the balance fell below the original $10,000 after two years despite a positive average.',
              'The response does not accuse anyone of misreporting; the figures are all correct.',
            ],
            commonMisconception: 'Treating the average of a series of annual returns as the rate the money actually grew at.',
          },
        ],
      },
    ],
    remediation: 'If the two paths look like they should agree, work year 2 out loud: 30% of $14,000 is $4,200, while 30% of $10,000 would have been $3,000. The percentage is the same and the dollars are not, which is the whole of the effect.',
    extension: 'Find the single steady annual rate that would take $10,000 to $12,348.00 in three years, by trial, and compare it with the 12% average.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l08',
    grade: 9, unit: 5, day: 8,
    actor: 'a fictional worker measuring a pay rise against inflation',
    objective: 'Apply the real-versus-nominal method to wages rather than investments, and determine whether a fictional pay rise left the worker better off.',
    scenario: 'A fictional worker’s hourly wage rises from $18.40 to a new figure while prices in the same simulated year rise 3.4%. All figures are invented for this exercise.',
    materials: ['calculator', 'the fictional wage and inflation figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional wage of $18.40 an hour rises by 2.2%. Over the same year, prices rise 3.4%, so a basket costing $1.00 now costs $1.034.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the new hourly wage? Round to the nearest cent.',
            given: { wage: 18.4, riseRate: 0.022 }, expr: 'round(wage * (1 + riseRate), 2)', format: 'usd', answer: '$18.80',
            reasoning: '$18.40 raised 2.2% is $18.8048, which the fictional employer rounds to $18.80.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the new wage worth in the prices of a year ago? Round to the nearest cent.',
            given: { inflation: 0.034 }, expr: 'round(#t1-p1 / (1 + inflation), 2)', format: 'usd', answer: '$18.18',
            reasoning: '$18.80 divided by the price level of 1.034 gives what the new wage buys in last year’s prices.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much purchasing power did the worker lose per hour despite the rise?',
            given: { wage2: 18.4 }, expr: 'wage2 - #t1-p2', format: 'usd', answer: '$0.22',
            reasoning: '$18.40 of buying power before against $18.18 after, so the rise did not keep pace.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Scale the effect up to a working year of 1,760 hours.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Over 1,760 hours, how much purchasing power is lost across the year?',
            given: { hours: 1760 }, expr: '#t1-p3 * hours', format: 'usd', answer: '$387.20',
            reasoning: '$0.22 an hour over 1,760 hours.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Did this pay rise leave the worker better off?',
            choices: ['Yes, wages rose', 'No, prices rose faster than wages', 'It cannot be determined from these figures'],
            given: { wageRise: 2.2, inflation: 3.4 },
            decision: { left: 'wageRise', cmp: '>', right: 'inflation', ifTrue: 'Yes, wages rose', ifFalse: 'No, prices rose faster than wages' },
            answer: 'No, prices rose faster than wages',
            reasoning: 'A 2.2% rise against 3.4% inflation is a real cut, worth $387.20 across a 1,760-hour year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What hourly wage would have exactly kept pace with prices? Round to the nearest cent.',
            given: { wage3: 18.4, inflation2: 0.034 }, expr: 'round(wage3 * (1 + inflation2), 2)', format: 'usd', answer: '$19.03',
            reasoning: '$18.40 raised by the full 3.4% is $19.0256, which rounds to $19.03.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'The same method was used earlier on an investment return. Explain what is being measured in both cases, and one way the wage case differs from the investment case.',
            acceptableAnswerCriteria: [
              'States that both cases divide a nominal amount by the price level to measure what it actually buys.',
              'Names a genuine difference — a wage is received continuously through the year rather than valued at a single date, or a wage rise persists into future years while a single year’s return does not.',
            ],
            evidenceRequirements: [
              'Refers to the $18.18 real wage figure and the 3.4% price rise.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises the method transfers unchanged even though the subject is different.',
            ],
            commonMisconception: 'Judging a pay rise by its percentage without reference to what prices did.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The figure of 3.4% describes prices across a whole simulated economy. Say why an individual worker’s own experience of price rises could differ, and what that means for the $387.20 figure.',
            acceptableAnswerCriteria: [
              'Explains that an economy-wide price measure is an average across many goods, and a household buying a different mix faces a different effective rate.',
              'States that the $387.20 is therefore an estimate based on the average basket, and could be larger or smaller for this worker.',
            ],
            evidenceRequirements: [
              'Refers to the 3.4% figure and the $387.20 annual estimate.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The response does not dismiss the average as useless, only as an average.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the real wage comes out above $18.40, check the direction of the division: dividing by 1.034 must make the figure smaller, because the same dollars buy less. Multiplying by 1.034 answers a different question, the one in t2-p3.',
    extension: 'Compute the real change if inflation had been 1.4% instead, and state the rule for when a nominal rise is also a real one.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l09',
    grade: 9, unit: 5, day: 9,
    actor: 'a fictional portfolio with one concentrated holding',
    objective: 'Compute a fictional portfolio’s weighted return, re-weight it to reduce a concentration, and show what the concentration cost in the year given.',
    scenario: 'The fictional portfolio below holds five simulated positions with the weights and one-year returns shown. Every holding, weight, and return is invented for this exercise.',
    materials: ['calculator', 'the fictional portfolio table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional portfolio: Holding 1 at weight 0.4 returned +12%. Holding 2 at weight 0.2 returned -45%. Holding 3 at weight 0.15 returned +6%. Holding 4 at weight 0.15 returned +9%. Holding 5 at weight 0.1 returned +3%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What did Holding 2 contribute to the portfolio return?',
            given: { w2: 0.2, r2: 0 - 45 }, expr: 'w2 * r2', format: 'percent1', answer: '-9.0%',
            reasoning: 'A weight of 0.2 on a -45% return contributes -9.0 percentage points.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What was the portfolio’s overall return? Give it to two decimal places.',
            given: { w1: 0.4, r1: 12, w3: 0.15, r3: 6, w4: 0.15, r4: 9, w5: 0.1, r5: 3 },
            expr: 'w1 * r1 + #t1-p1 + w3 * r3 + w4 * r4 + w5 * r5', format: 'percent2', answer: '-1.65%',
            reasoning: '4.8 - 9.0 + 0.9 + 1.35 + 0.3, so four positive holdings were outweighed by one bad one.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now re-weight, cutting Holding 2 to 0.05 and redistributing: Holding 1 to 0.30, Holding 3 to 0.25, Holding 4 to 0.25, Holding 5 to 0.15. The returns are unchanged.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What would the re-weighted portfolio have returned? Give it to two decimal places.',
            given: { n1: 0.3, m1: 12, n2: 0.05, m2: 0 - 45, n3: 0.25, m3: 6, n4: 0.25, m4: 9, n5: 0.15, m5: 3 },
            expr: 'n1 * m1 + n2 * m2 + n3 * m3 + n4 * m4 + n5 * m5', format: 'percent2', answer: '5.55%',
            reasoning: '3.6 - 2.25 + 1.5 + 2.25 + 0.45, the same five holdings with the concentration reduced.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'How many percentage points better is the re-weighted portfolio in this year?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'percent2', answer: '7.20%',
            reasoning: '5.55% against -1.65%, with no change to any holding’s own return.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'On a $24,000 portfolio, what is that difference worth in dollars?',
            given: { portfolio: 24000 }, expr: 'round(portfolio * #t2-p2 / 100, 2)', format: 'usd', answer: '$1,728.00',
            reasoning: '7.20 percentage points of difference applied to a $24,000 portfolio.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The re-weighting looks obviously right after the fact. Explain why it would have been much harder to justify beforehand, and state what a diversification rule can and cannot promise.',
            acceptableAnswerCriteria: [
              'States that the -45% return was not known in advance, so the re-weighting could only have been justified as a rule about concentration, not as a prediction about Holding 2.',
              'Notes that the same re-weighting would have cost the portfolio return if Holding 2 had risen 45% instead.',
              'States what diversification promises: a narrower range of outcomes, not a higher return.',
            ],
            evidenceRequirements: [
              'Uses the two portfolio returns, -1.65% and 5.55%, and the -45% holding return.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty', 'tradeoff-defense'],
            lookFors: [
              'The response resists treating one year’s outcome as proof the re-weighting was correct.',
              'The response notices that Holding 2 was never removed, only reduced.',
            ],
            commonMisconception: 'Judging a diversification decision by whether the concentrated holding happened to fall.',
          },
        ],
      },
    ],
    remediation: 'If the portfolio return comes out positive, check the sign on Holding 2: a -45% return at weight 0.2 subtracts 9 percentage points, and it is the only negative contribution in the table.',
    extension: 'Find the weight on Holding 2 at which the original portfolio would have exactly broken even in this year, and say what that weight implies.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u05-l10',
    grade: 9, unit: 5, day: 10,
    actor: 'a fictional saver assembling a three-goal plan',
    objective: 'Assemble a fictional three-goal plan matching each goal to a horizon and a holding category, compute what each requires, and defend the allocation against a stated objection.',
    scenario: 'A fictional saver has $340 a month available and three simulated goals. Every amount, date, and rate below is invented for this exercise; nothing here recommends a real investment.',
    materials: ['calculator with a power function', 'the fictional goal list in these directions', 'a blank allocation table'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The three fictional goals. Goal A: $1,600 for a certification course, needed in 10 months. Goal B: $9,000 toward a vehicle, needed in 60 months. Goal C: a 25-year goal, funded by placing $5,000 now at an assumed 6% a year and adding nothing.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much a month does Goal A require, assuming no growth?',
            given: { goalA: 1600, monthsA: 10 }, expr: 'goalA / monthsA', format: 'usd', answer: '$160.00',
            reasoning: '$1,600 over 10 months, with no growth assumed over so short a horizon.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much a month does Goal B require, assuming no growth?',
            given: { goalB: 9000, monthsB: 60 }, expr: 'goalB / monthsB', format: 'usd', answer: '$150.00',
            reasoning: '$9,000 divided across the 60 months to the vehicle date, with no growth assumed.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Goal C’s $5,000 placement reach in 25 years at 6% a year?',
            given: { placement: 5000, rate: 0.06, years: 25 }, expr: 'round(placement * pow(1 + rate, years), 2)', format: 'usd', answer: '$21,459.35',
            reasoning: '$5,000 x 1.06 to the twenty-fifth power.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Check the plan against the money actually available.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do Goals A and B together require each month?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$310.00',
            reasoning: '$160.00 for Goal A plus $150.00 for Goal B.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the $340 a month is left over?',
            given: { available: 340 }, expr: 'available - #t2-p1', format: 'usd', answer: '$30.00',
            reasoning: '$340 available less the $310 the two dated goals require.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Once Goal A is funded after 10 months, how much a month becomes free?',
            given: {}, expr: '#t1-p1', format: 'usd', answer: '$160.00',
            reasoning: 'The Goal A contribution ends when the goal is reached, freeing its full monthly amount.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the plan up.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Present the allocation: which holding category each goal belongs in, what each requires, and what happens to the freed $160 after month 10. Then answer this objection: "Goal A is only 10 months away — put it in the stock-type holding and it will get there faster."',
            acceptableAnswerCriteria: [
              'Assigns each goal to a category on the basis of its horizon and says why, with Goal A in insured cash and Goal C in a long-horizon growth holding.',
              'Uses the $160.00, $150.00, and $30.00 figures to show the plan fits within $340 a month.',
              'Answers the objection directly: a stock-type holding might get there faster and might also be down when the $1,600 is due, and 10 months leaves no time to recover — so the objection trades a fixed requirement for an uncertain one.',
              'States a plan for the freed $160 after month 10 rather than leaving it unallocated.',
            ],
            evidenceRequirements: [
              'Cites at least three computed figures from this lesson, including at least one monthly requirement and the Goal C projection.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The objection is answered on its merits — the higher expected return is real — rather than dismissed.',
              'The response does not name specific real investments or products.',
            ],
            commonMisconception: 'Choosing a holding for a dated goal by expected return rather than by whether the amount must be there on a fixed date.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The Goal C projection assumes 6% a year for 25 years. Say what happens to that projection if the actual average is 4%, and how you would present the figure to avoid overstating certainty.',
            acceptableAnswerCriteria: [
              'States that a lower average produces a substantially smaller result over 25 years, and that the gap widens with the term.',
              'Proposes presenting a range or a set of scenarios rather than a single figure, and says why a single figure invites false confidence.',
            ],
            evidenceRequirements: [
              'Refers to the $21,459.35 projection and the 6% assumption behind it.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The response treats the assumed rate as an input to be stated, not a property of the goal.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the plan comes out over budget, check whether Goal C is being given a monthly contribution. It is funded by a single $5,000 placement made now, so it requires nothing from the $340 a month.',
    extension: 'Rebuild the plan for a saver with only $260 a month available, deciding which goal moves and by how long, and state the reasoning behind the choice.',
  },
]
