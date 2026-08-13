import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 3 — PF3 Budgeting and Saving: Multi-Year Planning, Inflation,
 * and Goal Conflict. Ten lessons, one per source lesson day.
 *
 * The grade-11 move here is that a plan is judged over years rather than over a
 * month. Goals compete for the same capacity, prices compound against a fixed
 * income, and a plan that balances on paper still has to survive a shock. Every
 * household, wage, price, and reserve below is invented.
 */
export const g11u03: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u03-l01',
    grade: 11, unit: 3, day: 1,
    actor: 'Nkechi Halvorsen-Baptiste, a fictional saver with three dated goals',
    objective: 'Sequence three competing fictional savings goals against one monthly capacity, find when each is funded, and show that a plan can have enough total capacity and still miss a deadline.',
    scenario: 'Nkechi Halvorsen-Baptiste is a fictional saver in a simulated household. The three goals, their deadlines, and the monthly capacity below are invented figures for this exercise.',
    materials: ['calculator', 'the fictional goal list in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Nkechi can save $415 a month and nothing more. The emergency fund needs $6,400 and has no deadline. The certification course needs $3,600 and must be paid by month 24. The vehicle replacement needs $9,800 and must be paid by month 48. Only one goal is funded at a time, in the order given. Give each answer to one decimal place.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'months',
            text: 'How many months does the $6,400 emergency fund take at $415 a month?',
            given: { emergency: 6400, capacity: 415 }, expr: 'round(emergency / capacity, 1)', format: 'dec1', answer: '15.4',
            reasoning: '$6,400 divided by the $415 monthly capacity. Because only one goal is funded at a time, this is also the delay every later goal inherits.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'months',
            text: 'How many months does the $3,600 certification course take on its own?',
            given: { certification: 3600, capacity2: 415 }, expr: 'round(certification / capacity2, 1)', format: 'dec1', answer: '8.7',
            reasoning: '$3,600 at $415 a month — the goal itself is small relative to the 24-month window it has.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'months',
            text: 'How many months does the $9,800 vehicle replacement take on its own?',
            given: { vehicle: 9800, capacity3: 415 }, expr: 'round(vehicle / capacity3, 1)', format: 'dec1', answer: '23.6',
            reasoning: '$9,800 at $415 a month, the largest of the three goals and the one with the most time.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now place the goals in the sequence and check them against their deadlines.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'In which month is the certification course fully funded, given that the emergency fund is completed first?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'dec1', answer: '24.1',
            reasoning: '15.4 months of emergency fund followed by 8.7 months of certification. The certification is not slow; it is queued behind something else.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'In which month is the vehicle replacement fully funded?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'dec1', answer: '47.7',
            reasoning: 'All three goals funded in sequence: 15.4, then 8.7, then 23.6 months.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the three goals need in total?',
            given: { emergency2: 6400, certification2: 3600, vehicle2: 9800 },
            expr: 'emergency2 + certification2 + vehicle2', format: 'usd', answer: '$19,800.00',
            reasoning: 'The three targets added: $6,400, $3,600, and $9,800.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much can Nkechi save across the whole 48 months?',
            given: { capacity4: 415 }, expr: 'capacity4 * 48', format: 'usd', answer: '$19,920.00',
            reasoning: '$415 a month for the 48 months to the last deadline.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'By how much does the total capacity exceed what the goals need?',
            given: {}, expr: '#t2-p4 - #t2-p3', format: 'usd', answer: '$120.00',
            reasoning: '$19,920.00 of capacity against $19,800.00 of goals — the plan has enough money in total, with $120.00 to spare.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Check the certification deadline specifically.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'Does the certification course get funded by its month-24 deadline under this sequence?',
            choices: ['Yes, with time to spare', 'No, it is late', 'It lands exactly on the deadline'],
            given: { deadline: 24 },
            decision: { left: '#t2-p1', cmp: '<=', right: 'deadline', ifTrue: 'Yes, with time to spare', ifFalse: 'No, it is late' },
            answer: 'No, it is late',
            reasoning: 'The certification completes in month 24.1 against a month-24 deadline, so the sequence misses it even though the money exists across the whole plan.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'months',
            text: 'By how many months is the certification deadline missed?',
            given: { deadline2: 24 }, expr: '#t2-p1 - deadline2', format: 'dec1', answer: '0.1',
            reasoning: 'Month 24.1 against a month-24 deadline. The miss is tiny, which is exactly why a plan checked only on totals would never show it.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Nkechi has $120.00 more capacity than her goals require and still misses a deadline. Explain how both can be true, and propose one change to the plan that fixes the miss without increasing what she saves.',
            acceptableAnswerCriteria: [
              'Explains that total capacity and timing are different constraints: the money exists across 48 months but arrives too late for a goal due at month 24.',
              'Proposes a change that works within the same $415 a month — most directly funding the certification before the emergency fund, or splitting the monthly amount between the two.',
              'Checks the proposed change against the deadline rather than asserting it works.',
            ],
            evidenceRequirements: [
              'Cites the month-24.1 completion against the month-24 deadline, and the $120.00 surplus, in the same explanation.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response separates "enough money" from "money in time".',
              'The proposed fix is tested, at least roughly, against the numbers.',
              'A response that reorders the goals should notice the emergency fund is then delayed, and say whether that is acceptable.',
            ],
            commonMisconception: 'Checking a multi-goal plan on totals and treating deadlines as automatically satisfied.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The emergency fund is the goal with no deadline, and it is funded first. Give the strongest argument for keeping it first, and say what the certification miss costs under that choice.',
            acceptableAnswerCriteria: [
              'Argues that the emergency fund protects the whole plan, so funding it first is what stops a single unexpected bill from destroying every other goal.',
              'States the cost of that choice concretely: the certification is 0.1 months late, which may mean paying it late, borrowing a small amount, or deferring the course.',
            ],
            evidenceRequirements: [
              'Refers to the 15.4 months the emergency fund occupies and to the resulting month-24.1 certification date.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence'],
            lookFors: [
              'The response gives a reason for the priority rather than restating the order.',
              'The cost named is specific to this plan rather than a general downside.',
            ],
          },
        ],
      },
    ],
    remediation: 'If every goal appears to meet its deadline, the goals are being funded in parallel rather than in sequence. The scenario funds one at a time out of a single $415, so the certification cannot start until month 15.4. Draw a 48-month line and mark three consecutive blocks of 15.4, 8.7, and 23.6 months on it before checking any deadline.',
    extension: 'Work out the smallest monthly capacity that would meet all three deadlines in the given order, and say how much more than $415 that is.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l02',
    grade: 11, unit: 3, day: 2,
    actor: 'Emeka Thorvaldsen-Ruiz, a fictional planner watching prices outrun a wage',
    objective: 'Compound a fictional inflation rate and a slower wage growth rate across a decade, and express the result as a change in the share of income a fixed basket consumes.',
    scenario: 'Emeka Thorvaldsen-Ruiz is a fictional household planner. The inflation rate, wage growth, and basket cost below are invented figures chosen to make a decade of compounding visible.',
    materials: ['calculator', 'the fictional inflation and wage figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fixed basket of goods Emeka buys costs $4,850 a year today. Prices rise 3.4% a year. Emeka earns $52,000 a year and his wage rises 2.1% a year. Use a 10-year horizon and round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the same basket cost after 10 years of 3.4% inflation?',
            given: { basket: 4850, inflation: 0.034 }, expr: 'round(basket * pow(1 + inflation, 10), 2)', format: 'usd', answer: '$6,775.59',
            reasoning: 'Ten years of compounding at 3.4% on $4,850. Nothing about the basket changed; only its price did.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more does the basket cost after the decade?',
            given: { basket2: 4850 }, expr: '#t1-p1 - basket2', format: 'usd', answer: '$1,925.59',
            reasoning: '$6,775.59 against the $4,850 it costs today — a rise of nearly 40% on a rate that sounds small each year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Emeka’s income after 10 years of 2.1% growth?',
            given: { income: 52000, growth: 0.021 }, expr: 'round(income * pow(1 + growth, 10), 2)', format: 'usd', answer: '$64,011.91',
            reasoning: 'Ten years of compounding at 2.1% on $52,000. The wage rises too, which is why the comparison has to be made in shares rather than in dollars.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure the basket against the income at each end of the decade.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What share of today’s income does today’s basket take? Give one decimal place.',
            given: { basket3: 4850, income2: 52000 }, expr: 'round(basket3 / income2 * 100, 1)', format: 'percent1', answer: '9.3%',
            reasoning: '$4,850 against $52,000 — the starting position.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of the year-10 income does the year-10 basket take? Give one decimal place.',
            given: {}, expr: 'round(#t1-p1 / #t1-p3 * 100, 1)', format: 'percent1', answer: '10.6%',
            reasoning: '$6,775.59 against $64,011.91. Both figures grew, but not at the same rate.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percentage points',
            text: 'By how many percentage points has the basket’s share of income risen?',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'dec1', answer: '1.3',
            reasoning: '10.6% against 9.3%. The share rises because prices compound faster than the wage; over this ten-year horizon that comes to 1.3 points, and the gap keeps widening beyond it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What would Emeka’s year-10 income need to be for the basket to take the same 9.3% share it takes today?',
            given: { targetShare: 0.093 }, expr: 'round(#t1-p1 / targetShare, 2)', format: 'usd', answer: '$72,855.81',
            reasoning: 'The $6,775.59 basket divided by the 9.3% share — the income that would have held the position level.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'By how much does the projected year-10 income fall short of that?',
            given: {}, expr: '#t2-p4 - #t1-p3', format: 'usd', answer: '$8,843.90',
            reasoning: '$72,855.81 needed against $64,011.91 projected — the annual cost of a wage growing 1.3 points slower than prices, measured at the end of the decade.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Emeka’s wage rises every year for ten years and he is worse off at the end. Explain how, and say what the difference between 3.4% and 2.1% means in plain terms for someone reading a pay rise letter.',
            acceptableAnswerCriteria: [
              'Explains that a rising wage is only a gain if it rises faster than the prices it has to cover, and that 2.1% against 3.4% means it does not.',
              'Translates the comparison for a pay-rise letter: a raise below the inflation rate is a fall in what the wage buys, even though the number on the payslip is larger.',
              'Uses the share figures — 9.3% rising to 10.6% — rather than the dollar amounts alone, since both dollar figures grew.',
            ],
            evidenceRequirements: [
              'Cites both shares, 9.3% and 10.6%, and both rates, 3.4% and 2.1%.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response reasons in shares or in purchasing power, not in dollars alone.',
              'The plain-terms translation is usable by someone who has not done the arithmetic.',
              'The response does not claim Emeka’s income fell; it did not.',
            ],
            commonMisconception: 'Reading any wage increase as an improvement in living standards.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'This model applies one inflation rate to everything Emeka buys. Name one way that simplification could understate or overstate his real position, and say which computed figure it would move.',
            acceptableAnswerCriteria: [
              'Names a specific way the single rate misleads — different goods inflating at different rates, or the basket itself changing as he substitutes cheaper goods.',
              'Ties the point to a figure, most defensibly the $6,775.59 year-10 basket cost, and gives a direction.',
            ],
            evidenceRequirements: [
              'Refers to the $6,775.59 basket figure or the 10.6% share when describing what the simplification affects.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies a mechanism rather than saying inflation "varies".',
              'The direction of the effect is stated, not left open.',
            ],
            commonMisconception: 'Assuming a single published inflation rate describes every household equally.',
          },
        ],
      },
    ],
    remediation: 'If the year-10 basket comes out at $6,499.00, the inflation is being applied as a flat 34% of the original price rather than compounded. Each year’s 3.4% is charged on the previous year’s price, so year 2 costs 3.4% more than year 1 rather than 3.4% more than the start. Build the first three years by hand before using the ten-year form.',
    extension: 'Find the wage growth rate that would have held the basket at 9.3% of income for the whole decade, and say how close it is to the 3.4% inflation rate.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l03',
    grade: 11, unit: 3, day: 3,
    actor: 'Saoirse Yamamoto-Kalu, a fictional household modelling an income shock',
    objective: 'Model a fictional seven-month income shock against a reserve, compute the recovery period, and measure the total time the plan is disrupted.',
    scenario: 'Saoirse Yamamoto-Kalu runs a fictional household with the simulated monthly figures below. No real income, employer, or account is described.',
    materials: ['calculator', 'the fictional household figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The household takes home $4,280 a month and spends $3,690 a month. It holds a reserve of $6,400. A shock cuts income to $2,950 a month for 7 months, and spending cannot be reduced during that time.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does the household save each month before the shock?',
            given: { income: 4280, spending: 3690 }, expr: 'income - spending', format: 'usd', answer: '$590.00',
            reasoning: '$4,280 in and $3,690 out. This same figure is what will have to rebuild the reserve afterwards.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'During the shock, how much does the household fall short each month?',
            given: { reduced: 2950, spending2: 3690 }, expr: 'spending2 - reduced', format: 'usd', answer: '$740.00',
            reasoning: '$3,690 of spending against only $2,950 of income. The gap is larger than the $590.00 the household used to save, which is what makes a shock more than the loss of saving.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much is drawn from the reserve across the 7 months?',
            given: {}, expr: '#t1-p2 * 7', format: 'usd', answer: '$5,180.00',
            reasoning: 'Seven months of a $740.00 gap, all of it coming out of the reserve.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is left in the $6,400 reserve at the end of the shock?',
            given: { reserve: 6400 }, expr: 'reserve - #t1-p3', format: 'usd', answer: '$1,220.00',
            reasoning: '$6,400 less the $5,180.00 drawn — the reserve survived, but only just.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Income returns to $4,280 after the seventh month and spending is unchanged. Give the month figures to one decimal place.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'How many months does it take to rebuild the reserve to $6,400 at the pre-shock saving rate?',
            given: {}, expr: 'round(#t1-p3 / #t1-p1, 1)', format: 'dec1', answer: '8.8',
            reasoning: '$5,180.00 to replace at $590.00 a month. Recovery takes longer than the shock because the gap was larger than the saving.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'How long is the household’s plan disrupted in total, counting the shock and the rebuild?',
            given: {}, expr: '7 + #t2-p1', format: 'dec1', answer: '15.8',
            reasoning: '7 months of shock and 8.8 months of rebuilding — during all of which no progress is made on any other goal.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'months',
            text: 'How many months of the shock could the full $6,400 reserve have covered?',
            given: { reserve2: 6400 }, expr: 'round(reserve2 / #t1-p2, 1)', format: 'dec1', answer: '8.6',
            reasoning: '$6,400 against a $740.00 monthly gap — the real measure of a reserve is how many months of a specific shortfall it covers, not its dollar size.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Would the reserve have survived a 10-month shock of the same size?',
            choices: ['Yes, with something left over', 'No, it would have run out'],
            given: { longShock: 10 },
            decision: { left: '#t2-p3', cmp: '>=', right: 'longShock', ifTrue: 'Yes, with something left over', ifFalse: 'No, it would have run out' },
            answer: 'No, it would have run out',
            reasoning: 'The reserve covers 8.6 months of a $740.00 gap, so a 10-month shock exhausts it with about 1.4 months still to run.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The shock lasted 7 months and the plan was disrupted for 15.8. Explain why recovery took longer than the shock, and say what that implies about how a household should size a reserve.',
            acceptableAnswerCriteria: [
              'Explains that the monthly gap of $740.00 is larger than the $590.00 monthly saving, so each month of shock takes more out than a month of recovery puts back.',
              'Draws the implication that a reserve should be sized against the monthly gap a shock produces, not against income or against a round number of months of spending.',
              'Notes that no other goal advances during the whole 15.8 months, so the true cost of the shock is longer than the shock itself.',
            ],
            evidenceRequirements: [
              'Cites the $740.00 gap and the $590.00 saving rate as the two figures that set the ratio.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response compares the two rates rather than describing recovery as generally slow.',
              'The implication drawn is about sizing a reserve against a gap, which is the transferable point.',
              'A response observing that the 8.6-month coverage figure is the useful one is reading the arithmetic correctly.',
            ],
            commonMisconception: 'Assuming a reserve that survives a shock means the household has recovered from it.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The scenario says spending cannot be reduced during the shock. Name two spending lines a real household might in fact reduce, and say how a $200 monthly reduction would change the 8.6-month coverage figure.',
            acceptableAnswerCriteria: [
              'Names two plausible reducible lines with a reason they are reducible, such as discretionary categories or a temporarily paused subscription or savings contribution.',
              'Computes or closely estimates the effect: a $200 cut takes the gap to $540.00 and lifts coverage from 8.6 months to about 11.9 months.',
            ],
            evidenceRequirements: [
              'Uses the $740.00 gap and the $6,400 reserve when recomputing the coverage.',
            ],
            dimensions: ['transfer', 'plan-coherence'],
            lookFors: [
              'The recomputation is attempted with figures rather than described as "longer".',
              'The lines named are genuinely discretionary rather than fixed obligations.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the rebuild comes out at 7 months, the reserve is being replaced at the rate it was drained. It drained at $740.00 a month because income fell, but it refills at $590.00 a month because that is all the household saves. Write the two rates side by side and label which applies to which phase before dividing.',
    extension: 'Find the reserve that would cover a 12-month shock of this size, and say how many months of ordinary saving it would take to build it from zero.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l04',
    grade: 11, unit: 3, day: 4,
    actor: 'Bartholomew Nwachukwu-Lindgren, a fictional recipient choosing between two payment dates',
    objective: 'Apply the time value of money to a fictional choice between a sum now and a larger sum later, working the comparison in both directions, and identify the rate at which the choice reverses.',
    scenario: 'Bartholomew Nwachukwu-Lindgren has a fictional settlement to collect and two simulated payment options. The amounts and the interest rate below are invented for this exercise.',
    materials: ['calculator', 'the two fictional payment options in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Option A pays $8,000 today. Option B pays $10,500 in 6 years. If Bartholomew takes the money today he can place it where it earns 5.5% a year, compounded annually. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What would the $8,000 be worth in 6 years at 5.5% a year?',
            given: { now: 8000, rate: 0.055 }, expr: 'round(now * pow(1 + rate, 6), 2)', format: 'usd', answer: '$11,030.74',
            reasoning: 'Six years of compounding at 5.5% on $8,000. This puts both options at the same date, which is what makes them comparable.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Compared at year 6, how much better is Option A than Option B?',
            given: { later: 10500 }, expr: '#t1-p1 - later', format: 'usd', answer: '$530.74',
            reasoning: '$11,030.74 against the $10,500 Option B pays — taking the smaller sum today and letting it grow wins by $530.74.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now make the same comparison at today’s date instead, by discounting Option B back at the same 5.5%.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is $10,500 in 6 years worth today at 5.5% a year?',
            given: { later2: 10500, rate2: 0.055 }, expr: 'round(later2 / pow(1 + rate2, 6), 2)', format: 'usd', answer: '$7,615.08',
            reasoning: 'Dividing by the same growth factor moves the figure backwards in time: this is the amount that would grow into $10,500 in six years.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Compared at today’s date, how much better is Option A than Option B?',
            given: { now2: 8000 }, expr: 'now2 - #t2-p1', format: 'usd', answer: '$384.92',
            reasoning: '$8,000 against $7,615.08 of present value — the same conclusion as before, measured in today’s dollars rather than year-6 dollars.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'The two comparisons give different dollar amounts. What is the difference between them?',
            given: {}, expr: '#t1-p2 - #t2-p2', format: 'usd', answer: '$145.82',
            reasoning: '$530.74 measured at year 6 against $384.92 measured today. The advantage is the same advantage; it is simply being quoted at two different dates.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Show that the two are the same figure at different dates: what does the present-day advantage of $384.92 grow to in 6 years at 5.5%?',
            given: { rate3: 0.055 }, expr: 'round(#t2-p2 * pow(1 + rate3, 6), 2)', format: 'usd', answer: '$530.74',
            reasoning: 'Growing the today-dated advantage forward six years reproduces the year-6 advantage exactly, which is the check that the two comparisons agree.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Now test how much the conclusion depends on the 5.5% rate. Suppose the money could only earn 4% a year.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What would $8,000 be worth in 6 years at 4% a year?',
            given: { now3: 8000, lowRate: 0.04 }, expr: 'round(now3 * pow(1 + lowRate, 6), 2)', format: 'usd', answer: '$10,122.55',
            reasoning: 'The same six years at the lower rate. Nothing about either offer changed; only what the money could do in between.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'At 4%, how much better is Option B than Option A at year 6?',
            given: { later3: 10500 }, expr: 'later3 - #t3-p1', format: 'usd', answer: '$377.45',
            reasoning: '$10,500 against $10,122.55 — at 4% the ranking has reversed, and waiting is now worth $377.45.',
          },
          {
            ref: 't3-p3', kind: 'choice',
            text: 'What does the reversal between 5.5% and 4% show?',
            choices: [
              'That Option B is worth more than Option A whenever rates are low',
              'That the comparison depends on what the money could earn in between, not on the two amounts alone',
              'That present value is a less reliable method than future value',
            ],
            given: {},
            answer: 'That the comparison depends on what the money could earn in between, not on the two amounts alone',
            reasoning: 'The $8,000 and the $10,500 never changed; only the rate did, and the two methods agreed with each other at both rates, so the reversal is about the rate rather than about either method being unreliable.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why $10,500 in six years can be worth less than $8,000 today, and say what a person would have to know about their own situation before using 5.5% as the rate in this comparison.',
            acceptableAnswerCriteria: [
              'Explains that money available now can be put to work, so a later sum must be discounted by whatever the earlier sum could have earned in the meantime.',
              'States that the rate has to reflect what this person could actually achieve — a genuinely available return, not an assumed one — and that using too high a rate biases the comparison towards taking money early.',
              'Notes that the reversal at 4% shows the conclusion is a property of the rate as much as of the two amounts.',
            ],
            evidenceRequirements: [
              'Cites the $7,615.08 present value of Option B and the $8,000 of Option A.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response explains discounting as pricing the delay rather than as a rule.',
              'The response treats the rate as something requiring justification.',
              'A response noting that the 5.5% must be achievable after tax and after fees is going beyond the question well.',
            ],
            commonMisconception: 'Comparing two sums payable at different dates by their face amounts.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The two methods gave $530.74 and $384.92 for the same advantage. Explain why neither is wrong, and say which one you would quote to someone deciding today.',
            acceptableAnswerCriteria: [
              'Explains that the two figures are the same advantage quoted at different dates, and that growing $384.92 forward six years reproduces $530.74 exactly.',
              'Chooses the present-value figure for a decision made today, with a reason — it is expressed in money the decision-maker can actually compare to their current situation.',
            ],
            evidenceRequirements: [
              'Refers to the check that $384.92 grows to $530.74 at 5.5% over six years.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the two figures as consistent rather than as competing answers.',
              'The choice is justified by who is deciding and when, not by which number is larger.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the present value of $10,500 comes out above $10,500, the growth factor is being multiplied rather than divided. Moving a figure backwards in time makes it smaller, because a smaller sum today grows into it. Check the direction with a one-year case first: at 5.5%, $1,055 next year is worth $1,000 today, not $1,113.',
    extension: 'Find the annual rate at which the two options would be exactly equal, and say whether a rate above or below it favours taking the money today.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l05',
    grade: 11, unit: 3, day: 5,
    actor: 'Freya Okoro-Villalobos, a fictional saver whose plan and behaviour diverge',
    objective: 'Quantify the gap between a fictional intended savings rate and the amount actually saved, add a recurring leak, and express the five-year cost of the difference between a plan and a habit.',
    scenario: 'Freya Okoro-Villalobos is a fictional saver whose simulated records are summarised below. The intended amounts, the actual amounts, and the subscriptions are invented figures.',
    materials: ['calculator', 'the fictional savings record in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Freya intends to save $400 a month by moving money manually at the end of each month. Over the past year she has actually saved an average of $215 a month. Separately she pays $87 a month across 6 subscriptions, of which 3 worth $41 a month have gone unused for the whole year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly gap between what Freya intends to save and what she actually saves?',
            given: { intended: 400, actual: 215 }, expr: 'intended - actual', format: 'usd', answer: '$185.00',
            reasoning: '$400 intended against $215 achieved. The plan is not wrong about the money; it is wrong about the behaviour.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Across 5 years, or 60 months, what does that monthly gap come to?',
            given: {}, expr: '#t1-p1 * 60', format: 'usd', answer: '$11,100.00',
            reasoning: '$185.00 a month for 60 months. A gap that looks like rounding error each month is a substantial sum across a plan.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Across the same 60 months, what do the unused subscriptions come to?',
            given: { unused: 41 }, expr: 'unused * 60', format: 'usd', answer: '$2,460.00',
            reasoning: '$41 a month for 60 months, for services the scenario says went unused for a whole year.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What do the two together cost across the 5 years?',
            given: {}, expr: '#t1-p2 + #t1-p3', format: 'usd', answer: '$13,560.00',
            reasoning: '$11,100.00 of unsaved intention plus $2,460.00 of unused subscriptions — neither of which appears anywhere as a decision Freya made.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look at what fixing each would be worth.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'The unused subscriptions are what percentage of the $87 subscription bill? Give one decimal place.',
            given: { unused2: 41, subscriptions: 87 }, expr: 'round(unused2 / subscriptions * 100, 1)', format: 'percent1', answer: '47.1%',
            reasoning: '$41 of $87 — nearly half the subscription spending buys nothing that was used in the past year.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If Freya automated the transfer and cancelled the unused subscriptions, how much more would she have each month?',
            given: {}, expr: '#t1-p1 + #t1-p3 / 60', format: 'usd', answer: '$226.00',
            reasoning: 'Closing the $185.00 behaviour gap and recovering the $41 of unused subscriptions.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of her $400 target would the recovered amount represent? Give one decimal place.',
            given: { intended2: 400 }, expr: 'round(#t2-p2 / intended2 * 100, 1)', format: 'percent1', answer: '56.5%',
            reasoning: '$226.00 against the $400 target — more than half the intended saving is currently lost to two things that require no extra income to fix.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which change would do more over the 5 years?',
            choices: [
              'Automating the transfer so the intended $400 is actually saved',
              'Cancelling the 3 unused subscriptions',
              'They are worth the same amount',
            ],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t1-p3', ifTrue: 'Automating the transfer so the intended $400 is actually saved', ifFalse: 'Cancelling the 3 unused subscriptions' },
            answer: 'Automating the transfer so the intended $400 is actually saved',
            reasoning: '$11,100.00 against $2,460.00 — the behaviour gap is over four times the size of the subscription leak, though the subscriptions are the easier of the two to cancel in an afternoon.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Freya’s plan is arithmetically sound and she is $13,560.00 behind it over five years. Explain what kind of failure that is, and describe one change to the design of the plan — not to her willpower — that would close most of the gap.',
            acceptableAnswerCriteria: [
              'Identifies the failure as one of design rather than arithmetic: the plan depends on a decision being taken correctly 60 separate times.',
              'Proposes a design change that removes the repeated decision, such as an automatic transfer on payday, and explains why that addresses the $185.00 gap specifically.',
              'Distinguishes the $11,100.00 behaviour gap from the $2,460.00 subscription leak, which is a different failure with a different fix.',
            ],
            evidenceRequirements: [
              'Cites the $185.00 monthly gap and at least one of the five-year totals.',
            ],
            dimensions: ['plan-coherence', 'error-diagnosis', 'criteria-application'],
            lookFors: [
              'The proposed change alters when or how the decision is made, not how hard Freya tries.',
              'The response separates the two leaks rather than treating them as one problem.',
              'The response does not moralise about Freya’s discipline; the point is that the plan asked too much of it.',
            ],
            commonMisconception: 'Treating a plan that fails in practice as a problem of motivation rather than of design.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Cancelling the subscriptions is worth $2,460.00 and takes an afternoon; automating the transfer is worth $11,100.00 and takes minutes. Say why someone might still do the first and not the second, and what that suggests about ordering changes to a plan.',
            acceptableAnswerCriteria: [
              'Offers a plausible reason the smaller fix gets done, such as it being concrete and visible while automation feels like committing money in advance.',
              'Draws a usable conclusion about ordering, such as doing the highest-value change first, or using an easy win to build momentum, and justifies the choice.',
            ],
            evidenceRequirements: [
              'Compares the $11,100.00 and $2,460.00 figures when explaining the ordering.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence'],
            lookFors: [
              'The reason offered is about how the change feels to carry out, not about arithmetic.',
              'Either ordering is acceptable if the response says what it is optimising for.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the recovered monthly amount comes out at $185.00, the subscriptions have been left out; if it comes out at $272.00, the whole $87 subscription bill is being counted rather than the $41 that goes unused. Freya still uses three of the six services, so only $41 is recoverable. Write the two recoverable lines separately and check each against the scenario before adding.',
    extension: 'Work out how many months of the automated $400 it would take to reach $13,560.00, and say what that period represents in terms of the plan Freya already has.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l06',
    grade: 11, unit: 3, day: 6,
    actor: 'Kwame Steensen-Marchetti, a fictional saver whose capacity has fallen mid-plan',
    objective: 'Revise a fictional savings plan after a fall in capacity by computing three defensible revisions, and compare what each preserves and gives up.',
    scenario: 'Kwame Steensen-Marchetti is a fictional saver whose simulated plan has run into a change of circumstances. Every target, deadline, and monthly figure below is invented.',
    materials: ['calculator', 'the fictional plan and revision options in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The original plan was to save $12,000 in 30 months at $400 a month. Kwame has completed 11 months on plan. From now on he can only save $265 a month. Give month figures to one decimal place.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much has Kwame saved in the first 11 months?',
            given: { rate: 400 }, expr: 'rate * 11', format: 'usd', answer: '$4,400.00',
            reasoning: 'Eleven months at the original $400 rate, all of it on plan.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is still needed to reach the $12,000 target?',
            given: { target: 12000 }, expr: 'target - #t1-p1', format: 'usd', answer: '$7,600.00',
            reasoning: '$12,000 less the $4,400.00 already saved.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What monthly amount would keep the original month-30 deadline, given 19 months remain?',
            given: {}, expr: 'round(#t1-p2 / 19, 2)', format: 'usd', answer: '$400.00',
            reasoning: '$7,600.00 across the 19 remaining months. Keeping the deadline requires exactly the original rate, which is the one thing Kwame can no longer do.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Three revisions are on the table. Revision A extends the deadline and keeps the target. Revision B keeps the deadline and cuts the target. Revision C extends the deadline by 6 months only.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'Under Revision A, how many further months at $265 does the target take?',
            given: { reduced: 265 }, expr: 'round(#t1-p2 / reduced, 1)', format: 'dec1', answer: '28.7',
            reasoning: '$7,600.00 at $265 a month. The lower rate stretches 19 months of remaining plan into nearly 29.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'Under Revision A, in which month is the target reached in total?',
            given: {}, expr: '11 + #t2-p1', format: 'dec1', answer: '39.7',
            reasoning: 'The 11 months already completed plus 28.7 more — nearly 10 months beyond the original plan.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Under Revision B, how much is saved by month 30, with 19 months at $265?',
            given: { reduced2: 265 }, expr: '#t1-p1 + reduced2 * 19', format: 'usd', answer: '$9,435.00',
            reasoning: '$4,400.00 already saved plus $5,035.00 more at the reduced rate.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Under Revision B, how far short of the $12,000 target does that fall?',
            given: { target2: 12000 }, expr: 'target2 - #t2-p3', format: 'usd', answer: '$2,565.00',
            reasoning: '$12,000 against $9,435.00 — keeping the date costs about 21% of the goal.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'Under Revision C, which allows 25 further months at $265, how much is saved in total?',
            given: { reduced3: 265 }, expr: '#t1-p1 + reduced3 * 25', format: 'usd', answer: '$11,025.00',
            reasoning: '$4,400.00 already saved plus $6,625.00 over the 25 further months the six-month extension allows.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'Under Revision C, how far short of the $12,000 target does Kwame end?',
            given: { target3: 12000 }, expr: 'target3 - #t2-p5', format: 'usd', answer: '$975.00',
            reasoning: '$12,000 against $11,025.00 — a six-month extension recovers most but not all of the shortfall.',
          },
          {
            ref: 't2-p7', kind: 'numeric', unit: 'USD',
            text: 'How much more does Revision C deliver than Revision B?',
            given: {}, expr: '#t2-p5 - #t2-p3', format: 'usd', answer: '$1,590.00',
            reasoning: '$11,025.00 against $9,435.00 — six extra months at $265 is what separates the two revisions that both fall short.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Choose one of the three revisions for Kwame and defend it. State what your choice preserves, what it gives up in figures, and one thing you would need to know about the goal before the choice could be final.',
            acceptableAnswerCriteria: [
              'Selects one revision and states what it preserves in figures — the full $12,000 at month 39.7, or the month-30 date at $9,435.00, or the intermediate position $11,025.00, which is $975.00 short.',
              'Names what the choice gives up, using the corresponding figure rather than describing it generally.',
              'Identifies what needs to be known before finalising: most importantly whether the target has a hard date attached to it, or whether a partial amount is usable.',
            ],
            evidenceRequirements: [
              'Cites at least two of the three revision outcomes when defending the choice.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response identifies whether the deadline or the amount is the binding constraint, which is the question the three revisions differ on.',
              'Any of the three is acceptable if the reasoning names both what is kept and what is lost.',
              'A response that asks whether $9,435.00 would actually accomplish the goal is asking the right question.',
            ],
            commonMisconception: 'Treating a plan that can no longer be met as a plan that has to be abandoned.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Kwame’s original plan needed $400 a month and he had no margin. Say what a plan built with margin would have looked like here, and what it would have cost him in the first 11 months.',
            acceptableAnswerCriteria: [
              'Describes a plan with a lower committed rate and an earlier start, or a target date set beyond the true deadline, so a fall in capacity does not immediately break it.',
              'Names the cost of that margin: a longer plan, a smaller monthly commitment, or reaching the target later than month 30 even if nothing had gone wrong.',
            ],
            evidenceRequirements: [
              'Refers to the $400 monthly rate and the 30-month deadline when describing what margin would have changed.',
            ],
            dimensions: ['plan-coherence', 'transfer'],
            lookFors: [
              'The response treats margin as something bought rather than as something free.',
              'The cost named is concrete rather than a general acknowledgement of tradeoffs.',
            ],
          },
        ],
      },
    ],
    remediation: 'If Revision A comes out at 28.7 months in total rather than 39.7, the 11 months already completed are being dropped. The revision changes only what happens from now on: the plan is 11 months old before the new rate applies. Mark month 11 on a timeline and start the 28.7 months from there.',
    extension: 'Find the monthly amount that would reach the full $12,000 by month 36, and say whether it is closer to the $265 Kwame can manage or to the $400 he originally committed.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l07',
    grade: 11, unit: 3, day: 7,
    actor: 'Delphine Abubakar-Norgaard, a fictional reviewer auditing a savings sequence',
    objective: 'Diagnose a fictional savings plan that funds goals in the wrong order, recompute the completion dates under a deadline-first sequence, and quantify what the ordering error costs.',
    scenario: 'Delphine Abubakar-Norgaard is reviewing the simulated savings plan below. The goals, deadlines, and monthly capacity are invented for this exercise.',
    materials: ['calculator', 'the fictional plan reproduced in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The plan saves $520 a month and funds one goal at a time. Its stated order is: the holiday fund of $3,100 with no deadline, then the roof repair of $5,200 due by month 10, then the tuition deposit of $2,700 due by month 18. The plan concludes: "All three goals are affordable within 18 months." Give month figures to one decimal place.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'months',
            text: 'How long does the $3,100 holiday fund take at $520 a month?',
            given: { holiday: 3100, capacity: 520 }, expr: 'round(holiday / capacity, 1)', format: 'dec1', answer: '6.0',
            reasoning: '$3,100 at $520 a month. It is the smallest goal and the only one with no deadline, and the plan funds it first.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'months',
            text: 'How long does the $5,200 roof repair take on its own?',
            given: { roof: 5200, capacity2: 520 }, expr: 'round(roof / capacity2, 1)', format: 'dec1', answer: '10.0',
            reasoning: '$5,200 at $520 a month — exactly the 10 months its deadline allows, and only if nothing is funded ahead of it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'months',
            text: 'How long does the $2,700 tuition deposit take on its own?',
            given: { tuition: 2700, capacity3: 520 }, expr: 'round(tuition / capacity3, 1)', format: 'dec1', answer: '5.2',
            reasoning: '$2,700 at $520 a month — the smallest of the three goals, and the one whose deadline the plan misses by the least.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now apply the plan’s stated order and check both deadlines.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'Under the plan’s order, in which month is the roof repair funded?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'dec1', answer: '16.0',
            reasoning: '6.0 months of holiday fund followed by 10.0 months of roof — against a month-10 deadline.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'Under the plan’s order, in which month is the tuition deposit funded?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'dec1', answer: '21.2',
            reasoning: 'All three in the stated sequence: 6.0, then 10.0, then 5.2 months.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'months',
            text: 'By how many months does the roof repair miss its month-10 deadline?',
            given: { roofDeadline: 10 }, expr: '#t2-p1 - roofDeadline', format: 'dec1', answer: '6.0',
            reasoning: 'Month 16.0 against a month-10 deadline — the roof waits exactly as long as the holiday fund took.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'months',
            text: 'By how many months does the tuition deposit miss its month-18 deadline?',
            given: { tuitionDeadline: 18 }, expr: '#t2-p2 - tuitionDeadline', format: 'dec1', answer: '3.2',
            reasoning: 'Month 21.2 against a month-18 deadline. Both dated goals are late, and the plan reported neither.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Reorder the goals so the earliest deadline is funded first, and check the same deadlines again.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'months',
            text: 'Funding the roof first, in which month is the tuition deposit funded?',
            given: {}, expr: '#t1-p2 + #t1-p3', format: 'dec1', answer: '15.2',
            reasoning: '10.0 months of roof followed by 5.2 months of tuition — both now inside their deadlines, with the holiday fund pushed to last.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'months',
            text: 'Under the corrected order, by how many months does the tuition deposit now beat its deadline?',
            given: { tuitionDeadline2: 18 }, expr: 'tuitionDeadline2 - #t3-p1', format: 'dec1', answer: '2.8',
            reasoning: 'Month 15.2 against a month-18 deadline. The same money and the same capacity, reordered, turns a 3.2-month miss into 2.8 months of margin.',
          },
          {
            ref: 't3-p3', kind: 'choice',
            text: 'What was actually wrong with the original plan?',
            choices: [
              'It committed more money than $520 a month could provide',
              'It funded an undated goal ahead of two dated ones',
              'It miscalculated how long each goal takes on its own',
            ],
            given: {},
            answer: 'It funded an undated goal ahead of two dated ones',
            reasoning: 'Each goal’s own duration was computed correctly and the same $520 funds all three within 21.2 months, so neither the capacity nor the individual arithmetic was wrong; the defect is placing the goal with no deadline first.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'The plan said all three goals were affordable within 18 months, and every figure behind that claim was correct. Explain what the claim was actually about, what it was read as, and give a rule that would prevent the error.',
            acceptableAnswerCriteria: [
              'Distinguishes affordability — the $520 a month covers all three goals — from schedulability, which is whether each is funded before its own deadline.',
              'Points out that under the stated order the roof is 6.0 months late and the tuition 3.2 months late, so the claim was true about the money and false about the dates.',
              'States a rule that would prevent it, most directly funding goals in deadline order, or checking every dated goal against its own date rather than checking the plan as a whole.',
            ],
            evidenceRequirements: [
              'Cites the month-16.0 roof date and the month-10 deadline as the clearest instance of the gap.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'plan-coherence'],
            lookFors: [
              'The response identifies the ambiguity in "affordable within 18 months" rather than calling the plan miscalculated.',
              'The rule proposed would actually have caught this, and is stated as a check rather than as a resolution to be careful.',
              'A response noting the roof takes exactly its full 10 months, so it can tolerate no delay at all, is reading the figures closely.',
            ],
            commonMisconception: 'Reading "we can afford all of this" as "each of these will arrive on time".',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Under the corrected order the holiday fund is last and finishes in month 21.2. Say whether that is a real cost of the correction, and what would have to be true for the original order to have been defensible.',
            acceptableAnswerCriteria: [
              'Acknowledges that delaying the holiday fund to month 21.2 is a genuine cost, not a free improvement, since something the household wanted is deferred by over a year.',
              'States what would justify the original order, such as the holiday having an unstated fixed date, or the roof deadline being softer than the plan claimed.',
            ],
            evidenceRequirements: [
              'Refers to the month-6.0 completion under the original order against month 21.2 under the corrected one.',
            ],
            dimensions: ['tradeoff-defense', 'assumption-identification'],
            lookFors: [
              'The response treats the reordering as a tradeoff rather than as an unambiguous fix.',
              'The condition named is one the plan could actually have stated.',
            ],
          },
        ],
      },
    ],
    remediation: 'If both deadlines appear to be met under the original order, the goals are being checked against their own durations rather than their completion dates. The roof takes 10.0 months but does not start until month 6.0, so it completes at month 16.0. Write each goal as a start month and an end month before comparing anything to a deadline.',
    extension: 'Find whether any ordering of the three goals meets both deadlines with margin to spare, and say what that tells you about how tight this plan is.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l08',
    grade: 11, unit: 3, day: 8,
    actor: 'Lorenzo Chukwuemeka-Salvesen, a fictional parent saving against a fast-inflating cost',
    objective: 'Transfer the inflation method to a fictional cost rising faster than general prices, separate the excess from ordinary inflation, and compute what must be set aside today to meet it.',
    scenario: 'Lorenzo Chukwuemeka-Salvesen is saving for a fictional certification course for a family member. The fee, its inflation rate, and the savings rate below are invented figures for this exercise.',
    materials: ['calculator', 'the fictional fee and rate figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The course fee is $3,900 a year today and has been rising 5.8% a year. General prices are rising 2.6% a year. Money Lorenzo sets aside earns 3.1% a year. Use a 6-year horizon and round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What will the fee be in 6 years at 5.8% a year?',
            given: { fee: 3900, feeInflation: 0.058 }, expr: 'round(fee * pow(1 + feeInflation, 6), 2)', format: 'usd', answer: '$5,469.89',
            reasoning: 'Six years of compounding at 5.8% on the $3,900 fee.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would the fee be in 6 years if it had only tracked general prices at 2.6% a year?',
            given: { fee2: 3900, generalInflation: 0.026 }, expr: 'round(fee2 * pow(1 + generalInflation, 6), 2)', format: 'usd', answer: '$4,549.34',
            reasoning: 'The same six years at the general rate — the counterfactual that separates ordinary inflation from this cost’s own behaviour.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the increase is above what general inflation would have produced?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$920.55',
            reasoning: '$5,469.89 against $4,549.34 — the excess is what makes this cost a planning problem rather than a general one.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now work out what Lorenzo needs today. Money set aside grows at 3.1% a year, which is slower than the fee is rising.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much must be set aside today, at 3.1% a year, to meet the year-6 fee?',
            given: { savingsRate: 0.031 }, expr: 'round(#t1-p1 / pow(1 + savingsRate, 6), 2)', format: 'usd', answer: '$4,554.35',
            reasoning: 'Discounting the $5,469.89 target back six years at the 3.1% the savings actually earn.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more is that than today’s $3,900 fee?',
            given: { fee3: 3900 }, expr: '#t2-p1 - fee3', format: 'usd', answer: '$654.35',
            reasoning: '$4,554.35 needed today against a fee that currently costs $3,900 — saving the current price is not enough, because the fee outruns the savings.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The amount needed today is what percentage of today’s fee? Give one decimal place.',
            given: { fee4: 3900 }, expr: 'round(#t2-p1 / fee4 * 100, 1)', format: 'percent1', answer: '116.8%',
            reasoning: '$4,554.35 against $3,900 — the gap between a 5.8% cost and a 3.1% return, compounded over six years, is about 17% of the starting price.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Why is more than today’s fee needed today, even though the money earns interest?',
            choices: [
              'Because the fee rises faster than the savings grow',
              'Because interest is only paid at the end of the six years',
              'Because general inflation of 2.6% is subtracted from the 3.1% return',
            ],
            given: {},
            decision: { left: '#t1-p1', cmp: '>', right: '#t2-p1', ifTrue: 'Because the fee rises faster than the savings grow', ifFalse: 'Because interest is only paid at the end of the six years' },
            answer: 'Because the fee rises faster than the savings grow',
            reasoning: 'The fee reaches $5,469.89 while the same period grows savings by only 3.1% a year, so the $4,554.35 needed today reflects a 5.8% target outrunning a 3.1% return; the scenario says nothing about interest timing and does not subtract general inflation from the return.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This lesson applies the same compounding method used earlier in the unit for a general basket of goods. Say what had to change for this case, and explain why saving "the current price" of something is a reliable plan for some goals and not for others.',
            acceptableAnswerCriteria: [
              'Names the change: two different rates now apply — one to the cost and one to the savings — where the earlier case compared a cost rate against an income rate.',
              'Explains that saving the current price works when the savings return at least matches the cost’s inflation, and fails when the cost rises faster, as 5.8% against 3.1% does here.',
              'Uses the $654.35 gap to show the size of the failure rather than describing it qualitatively.',
            ],
            evidenceRequirements: [
              'Cites the 5.8% fee inflation and the 3.1% savings rate as the two figures that decide whether the plan works.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The response states the general condition — cost rate against return rate — not just this case’s answer.',
              'The response identifies which rate belongs to which side of the plan.',
              'A response noting that the 2.6% general rate plays no part in the funding calculation is reading carefully.',
            ],
            commonMisconception: 'Assuming a savings target can be set at what something costs today.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The fee has risen 5.8% a year "and has been rising" at that rate. Explain what that phrasing does and does not establish about the next six years, and say how you would state the $5,469.89 figure honestly.',
            acceptableAnswerCriteria: [
              'Explains that a past rate is evidence about the future but not a commitment, and that nothing in the scenario obliges the fee to continue at 5.8%.',
              'Restates the figure conditionally — $5,469.89 is what the fee reaches if the past rate continues for six more years — rather than as a prediction.',
            ],
            evidenceRequirements: [
              'Refers to the $5,469.89 projection and the 5.8% rate it depends on.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The restatement carries the condition inside the claim.',
              'The response neither dismisses the past rate as useless nor treats it as settled.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the amount needed today comes out below $3,900, the target is being discounted at the fee’s own 5.8% rather than at the 3.1% the savings earn. Two different rates are in play: 5.8% grows the fee and 3.1% grows the money set aside. Label each rate with what it applies to before using either.',
    extension: 'Find the savings return that would let $3,900 set aside today exactly meet the year-6 fee, and say whether that return is closer to the 3.1% available or to the 5.8% the fee is rising at.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l09',
    grade: 11, unit: 3, day: 9,
    actor: 'Aisha Berglund-Ogundipe, a fictional planner sizing a reserve against rising costs',
    objective: 'Combine inflation and a low savings return to show that a fictional reserve sized against an income shock loses coverage over five years, and quantify the months of protection it gives up.',
    scenario: 'Aisha Berglund-Ogundipe is sizing the reserve a fictional household would live on if its income stopped, which is the shock this unit modelled earlier. The expense figures, the inflation rate, and the deposit rate below are invented for this exercise.',
    materials: ['calculator', 'the fictional reserve figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The household spends $3,240 a month today and wants a reserve covering 6 months of spending, so that an interruption to its income does not force it to borrow. Spending rises 3.2% a year. The reserve sits in a deposit account earning 0.8% a year. Use a 5-year horizon and round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What reserve covers 6 months of today’s spending?',
            given: { monthly: 3240 }, expr: 'monthly * 6', format: 'usd', answer: '$19,440.00',
            reasoning: 'Six months at $3,240 — the target as it stands today.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What will monthly spending be in 5 years at 3.2% a year?',
            given: { monthly2: 3240, inflation: 0.032 }, expr: 'round(monthly2 * pow(1 + inflation, 5), 2)', format: 'usd', answer: '$3,792.66',
            reasoning: 'Five years of compounding at 3.2% on $3,240. The reserve target is defined by spending, so it moves when spending does.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What reserve will cover 6 months of spending in 5 years?',
            given: {}, expr: 'round(#t1-p2 * 6, 2)', format: 'usd', answer: '$22,755.96',
            reasoning: 'Six months at the year-5 spending level of $3,792.66 — the target the reserve has to reach, not the one it was set against.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now follow what happens to the reserve itself if Aisha funds it fully today and adds nothing further.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the $19,440.00 reserve worth in 5 years at 0.8% a year?',
            given: { depositRate: 0.008 }, expr: 'round(#t1-p1 * pow(1 + depositRate, 5), 2)', format: 'usd', answer: '$20,230.14',
            reasoning: 'Five years at 0.8% — the reserve grows, just far more slowly than the spending it exists to cover.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does the reserve fall short of the year-5 target?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$2,525.82',
            reasoning: '$22,755.96 needed against $20,230.14 held — a reserve that was fully funded is now short without a dollar ever leaving it.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The shortfall is what percentage of the year-5 target? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t1-p3 * 100, 1)', format: 'percent1', answer: '11.1%',
            reasoning: '$2,525.82 against the $22,755.96 target — the reserve has lost about a ninth of its coverage in five years.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'months',
            text: 'How many months of year-5 spending does the reserve actually cover? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p2, 1)', format: 'dec1', answer: '5.3',
            reasoning: '$20,230.14 against $3,792.66 of monthly spending — the six-month reserve has quietly become a 5.3-month one.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much would need to be added each year over the 5 years to close the shortfall, ignoring interest on the additions?',
            given: {}, expr: 'round(#t2-p2 / 5, 2)', format: 'usd', answer: '$505.16',
            reasoning: '$2,525.82 spread across 5 years — the maintenance cost of keeping a reserve at its stated coverage.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Aisha’s reserve was fully funded, nothing was withdrawn, and it is short. Explain the mechanism, and say what it means to describe a reserve as "six months" rather than as a dollar amount.',
            acceptableAnswerCriteria: [
              'Explains that the target is defined by spending, which rises at 3.2%, while the reserve grows at only 0.8%, so the two drift apart with no withdrawal required.',
              'Argues that stating a reserve in months of coverage keeps the target attached to what it protects, whereas a dollar amount silently shrinks in coverage as prices rise.',
              'Uses the 5.3-month figure to show what the drift amounts to in the terms the household actually cares about.',
            ],
            evidenceRequirements: [
              'Cites the 3.2% and 0.8% rates as the two figures that pull the target and the reserve apart.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the drift as arising from two different rates, not from spending the reserve.',
              'The response prefers coverage to a dollar figure and says why.',
              'A response noting the reserve did grow, just too slowly, is reading the figures accurately.',
            ],
            commonMisconception: 'Treating a savings target set once as a target that stays correct.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'A reserve has to be available at short notice, which is why it earns only 0.8%. Say what that constraint costs Aisha over the five years, and whether a higher-earning account would be a good place for this money.',
            acceptableAnswerCriteria: [
              'Prices the constraint using the figures: the $2,525.82 shortfall, or the $505.16 a year needed to maintain coverage, is what the liquidity requirement costs.',
              'Argues that a reserve should stay accessible even at a lower return, because a reserve that cannot be reached on the day it is needed has failed at its only job.',
            ],
            evidenceRequirements: [
              'Refers to the $2,525.82 shortfall or the $505.16 annual top-up when pricing the constraint.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The response prices the tradeoff rather than treating the low return as simply bad.',
              'The response ties accessibility to the purpose of the reserve, not to a general rule.',
            ],
            commonMisconception: 'Judging where to hold a reserve on its return alone.',
          },
        ],
      },
    ],
    remediation: 'If the reserve appears to keep pace, the same rate is probably being applied to both sides. Two different rates are at work: spending compounds at 3.2% and the reserve at 0.8%. Compute the year-5 target and the year-5 reserve in separate columns, each with its own rate, and only then subtract.',
    extension: 'Find the deposit rate at which the reserve would exactly keep its six-month coverage, and say what that rate has to equal for coverage to hold in general.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u03-l10',
    grade: 11, unit: 3, day: 10,
    actor: 'Casimir Adeleke-Fontaine, a fictional planner building a five-year plan under pressure',
    objective: 'Build a five-year fictional plan in which expenses inflate against a flat income, absorb a one-year shock, and defend which goal is protected when the surplus falls.',
    scenario: 'Casimir Adeleke-Fontaine is building a five-year plan for a fictional household. The income, expenses, inflation rate, and shock below are invented figures for this performance task.',
    materials: ['calculator', 'the fictional five-year plan figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The household takes home $58,400 a year and this does not change across the five years. Expenses are $44,200 in year 1 and rise 3.1% a year. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the surplus in year 1?',
            given: { income: 58400, expenses: 44200 }, expr: 'income - expenses', format: 'usd', answer: '$14,200.00',
            reasoning: '$58,400 of income against $44,200 of expenses — the amount available for every goal in the plan.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What are the expenses in year 5, which is 4 years of inflation after year 1?',
            given: { expenses2: 44200, inflation: 0.031 }, expr: 'round(expenses2 * pow(1 + inflation, 4), 2)', format: 'usd', answer: '$49,940.97',
            reasoning: 'Four years of compounding at 3.1% on the year-1 expenses, because year 1 has had no inflation applied to it yet.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the surplus in year 5?',
            given: { income2: 58400 }, expr: 'round(income2 - #t1-p2, 2)', format: 'usd', answer: '$8,459.03',
            reasoning: 'The same $58,400 of income against year-5 expenses of $49,940.97.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the surplus has been lost by year 5?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$5,740.97',
            reasoning: '$14,200.00 against $8,459.03 — the household’s capacity has fallen 40% with no fall in income and no new spending decision.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'In year 3 a one-off cost of $6,800 arrives. Expenses that year have had 2 years of inflation applied.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What are the ordinary expenses in year 3?',
            given: { expenses3: 44200, inflation2: 0.031 }, expr: 'round(expenses3 * pow(1 + inflation2, 2), 2)', format: 'usd', answer: '$46,982.88',
            reasoning: 'Two years of compounding at 3.1% on the year-1 figure.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the year-3 surplus after the ordinary expenses and the $6,800 one-off?',
            given: { income3: 58400, shock: 6800 }, expr: 'round(income3 - #t2-p1 - shock, 2)', format: 'usd', answer: '$4,617.12',
            reasoning: '$58,400 less $46,982.88 of expenses and the $6,800 one-off cost.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much smaller is the year-3 surplus than the year-1 surplus?',
            given: {}, expr: '#t1-p1 - #t2-p2', format: 'usd', answer: '$9,582.88',
            reasoning: '$14,200.00 against $4,617.12. The shock accounts for $6,800 of that and two years of inflation for the remaining $2,782.88.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'The plan commits $7,200 a year to a savings goal. By how much does the year-3 surplus fall short of that commitment?',
            given: { commitment: 7200 }, expr: 'commitment - #t2-p2', format: 'usd', answer: '$2,582.88',
            reasoning: 'The $7,200 commitment against the $4,617.12 actually available in year 3.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'Does the year-5 surplus still cover the $7,200 commitment, and with how much to spare?',
            given: { commitment2: 7200 }, expr: '#t1-p3 - commitment2', format: 'usd', answer: '$1,259.03',
            reasoning: '$8,459.03 of year-5 surplus against a $7,200 commitment — the plan survives the inflation but with the margin nearly gone.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One more figure for the recommendation.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'By year 5, what share of income do expenses take? Give one decimal place.',
            given: { income4: 58400 }, expr: 'round(#t1-p2 / income4 * 100, 1)', format: 'percent1', answer: '85.5%',
            reasoning: '$49,940.97 of expenses against $58,400 of income, up from 75.7% in year 1.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which single change would most protect the plan across all five years?',
            choices: [
              'Building a reserve in years 1 and 2 large enough to absorb the year-3 shock',
              'Increasing the savings commitment above $7,200 in year 1',
              'Deferring the savings commitment until year 4',
            ],
            given: {},
            answer: 'Building a reserve in years 1 and 2 large enough to absorb the year-3 shock',
            reasoning: 'Only year 3 fails to cover the commitment, and it fails by $2,582.88 because of a one-off cost; the years with the largest surplus are 1 and 2, so moving capacity from them to year 3 is what a reserve does, while raising the commitment makes year 3 worse and deferring it wastes the early surplus.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your plan. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Present a five-year plan for this household. Say what you protect and what you let go, name the year the plan is tightest and by how much, and state the assumption whose failure would do the most damage.',
            acceptableAnswerCriteria: [
              'Names year 3 as the tightest, short of the $7,200 commitment by $2,582.88, and says how the plan handles that year specifically.',
              'States what is protected and what is given up in figures, rather than describing intentions — for example holding the commitment in years 1, 2, 4, and 5 and reducing it in year 3.',
              'Identifies the most damaging assumption and says why, most defensibly the income staying flat at $58,400 while expenses compound, or the 3.1% inflation rate itself.',
            ],
            evidenceRequirements: [
              'Cites the year-1 and year-5 surpluses, $14,200.00 and $8,459.03, and the year-3 surplus of $4,617.12.',
              'Refers to the 85.5% share of income that expenses reach by year 5.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The plan is specific about which years do what, not a general intention to save.',
              'The tightest year is identified from the figures rather than assumed to be the last.',
              'A response noting that the year-5 margin of $1,259.03 leaves no room for a second shock is reading ahead correctly.',
            ],
            commonMisconception: 'Assuming the hardest year of a plan is the last one.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The income is held flat for five years while expenses rise 3.1% a year. Say whether that is a pessimistic or an optimistic assumption, and what the year-5 surplus would look like if income rose 2% a year instead.',
            acceptableAnswerCriteria: [
              'Argues that a flat nominal income across five years is a pessimistic assumption for most employment, while noting it is the right assumption for a fixed income such as some pensions or benefits.',
              'Estimates the effect: income of about $63,214 in year 5 would lift the surplus from $8,459.03 to roughly $13,270, restoring most of what inflation removed.',
            ],
            evidenceRequirements: [
              'Uses the $58,400 income figure and the $8,459.03 year-5 surplus as the base for the comparison.',
            ],
            dimensions: ['assumption-identification', 'transfer'],
            lookFors: [
              'The response recognises that whether the assumption is pessimistic depends on the kind of income.',
              'The recomputation is attempted with figures rather than described as "better".',
            ],
          },
        ],
      },
    ],
    remediation: 'If the year-5 expenses come out at $51,489.13, five years of inflation are being applied instead of four. Year 1 is the base and has had no inflation applied to it, so year 5 is four compounding steps away. Check the year-3 figure the same way: it should be two steps, giving $46,982.88 and not $48,439.35.',
    extension: 'Find the first year in which the surplus falls below the $7,200 commitment if no shock occurs at all, and say what that date tells you about how long this plan can run unchanged.',
  },
]
