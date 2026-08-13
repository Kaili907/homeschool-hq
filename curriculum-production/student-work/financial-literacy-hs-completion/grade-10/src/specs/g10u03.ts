import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 3 — PF3 Budgeting and Saving: Banking Systems, Interest
 * Mechanics, and Inflation.
 *
 * Two modelling conventions are used repeatedly here and are stated in the
 * learner-facing directions of every lesson that relies on them, rather than
 * left implicit:
 *
 *  - Where a rate is disclosed as an APY, the balance is grown by that rate
 *    once per year. Where a nominal rate is compounded more often than
 *    annually, the lesson says so and the periodic rate is the nominal rate
 *    divided by the number of periods.
 *  - Interest credited once at year end on a stream of level monthly deposits
 *    is computed on the average of the twelve month-end balances, which is
 *    6.5 times the monthly deposit. The lesson states the multiplier on the
 *    sheet rather than burying it in the key.
 */
export const g10u03: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u03-l01',
    grade: 10, unit: 3, day: 1,
    actor: 'a fictional saver choosing between three accounts at one bank',
    objective: 'Compute what each of three fictional account structures costs and earns over a year, and show that access restrictions, not headline rates, decide which one fits money that may be needed early.',
    scenario: 'Junction Bank and its three accounts are fictional and are invented for this exercise. No real bank, rate, fee schedule, or customer is described.',
    materials: ['calculator', 'the fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The three fictional accounts. Everyday Checking charges an $8 monthly fee, waived in any month the balance stays at or above $500, and pays no interest. Basic Savings pays 0.75% annual interest credited once at year end, allows 6 free withdrawals a month and charges $5 for each withdrawal beyond that. The 12-month Term Certificate pays 3.20% annual interest but charges a penalty of 90 days of interest on any withdrawal before the term ends.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'A fictional saver holds $410 in Everyday Checking in every month of the year. What do the monthly fees cost over the year?',
            given: { fee: 8 }, expr: 'fee * 12', format: 'usd', answer: '$96.00',
            reasoning: 'The $410 balance is below the $500 waiver threshold in every month, so the $8 fee is charged all twelve times. The waiver is a condition, not a discount.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'The same saver instead holds $2,600 in Basic Savings for the whole year. What interest is credited at year end?',
            given: { balance: 2600, rate: 0.0075 }, expr: 'balance * rate', format: 'usd', answer: '$19.50',
            reasoning: '0.75% of the $2,600 held for the full year. The balance is above every minimum the account states, so no fee reduces it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'In one month the saver makes 9 withdrawals from Basic Savings. What do the withdrawals past the free allowance cost that month?',
            given: { withdrawals: 9, free: 6, perExcess: 5 }, expr: '(withdrawals - free) * perExcess', format: 'usd', answer: '$15.00',
            reasoning: '9 withdrawals against a 6-withdrawal free allowance leaves 3 charged at $5 each. Note that this single month costs most of the $19.50 the account pays for the whole year.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the certificate, including what happens when the money is needed early. The certificate credits interest for the months actually held, then subtracts the penalty. Basic Savings credits its interest only at year end, so money withdrawn before then earns nothing at all.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'The saver puts the $2,600 into the 12-month Term Certificate instead. What interest does a full year earn?',
            given: { balance2: 2600, cdRate: 0.032 }, expr: 'balance2 * cdRate', format: 'usd', answer: '$83.20',
            reasoning: '3.20% of $2,600 held for the full term.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'The saver instead needs the money in month 7. What interest has the certificate credited for the months actually held?',
            given: { held: 7 }, expr: 'round(#t2-p1 * held / 12, 2)', format: 'usd', answer: '$48.53',
            reasoning: 'Seven of the twelve months of the $83.20 full-year interest. The certificate pays for time held; the penalty is charged separately below.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the early-withdrawal penalty, at 90 days of interest?',
            given: { penaltyDays: 90 }, expr: 'round(#t2-p1 * penaltyDays / 365, 2)', format: 'usd', answer: '$20.52',
            reasoning: '90 days out of 365 of the $83.20 annual interest. The penalty is priced in interest, not in a flat fee, so it scales with the deposit.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What interest does the saver actually keep after withdrawing in month 7?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$28.01',
            reasoning: '$48.53 credited less the $20.52 penalty. The penalty consumes a large share of what was earned but does not reach the deposit itself.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'For money that turns out to be needed in month 7, which account left the saver with more interest?',
            choices: ['The Term Certificate, even after the penalty', 'Basic Savings, because it has no penalty'],
            given: {},
            decision: { left: '#t2-p4', cmp: '>', right: '0', ifTrue: 'The Term Certificate, even after the penalty', ifFalse: 'Basic Savings, because it has no penalty' },
            answer: 'The Term Certificate, even after the penalty',
            reasoning: 'The certificate keeps $28.01 after the penalty, while Basic Savings credits interest only at year end and therefore pays nothing on money withdrawn in month 7. Having no penalty is not the same as paying more.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Rank the three fictional accounts for money that will definitely not be touched for a year, then rank them again for money that might be needed in any month. Say which single term changes the ranking, and why the headline interest rate is not that term.',
            acceptableAnswerCriteria: [
              'Ranks the certificate first for untouched money on the strength of the $83.20 it earns, and identifies the withdrawal terms rather than the rate as what changes the second ranking.',
              'Recognises that Basic Savings loses its whole year of interest on an early withdrawal because crediting happens once at year end, so "no penalty" does not mean "no cost".',
              'Notes that Everyday Checking pays nothing and can still cost $96.00 a year, so the account with the lowest rate is not automatically the cheapest.',
            ],
            evidenceRequirements: [
              'Uses the $96.00 fee total, the $19.50 savings interest, and the $28.01 kept after the certificate penalty.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response separates what an account pays from what it costs to reach the money in it.',
              'A response that ranks the certificate first in both cases is defensible if it argues from the $28.01 figure, since the penalty still left more than either alternative.',
            ],
            commonMisconception: 'Choosing an account by comparing interest rates alone, without reading when interest is credited or what reaching the money costs.',
          },
        ],
      },
    ],
    remediation: 'If the certificate looks like the wrong choice for month-7 money, check what Basic Savings actually pays on that money: the account credits interest once at year end, so a withdrawal in month 7 earns nothing. Compare $28.01 against $0.00, not against the $19.50 a full year would have paid.',
    extension: 'Work out the fee Everyday Checking would have charged if the balance had stayed at or above $500 in 8 of the 12 months, and say what that implies about a waiver tied to a minimum rather than to an average.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l02',
    grade: 10, unit: 3, day: 2,
    actor: 'a fictional depositor comparing three compounding frequencies at one rate',
    objective: 'Compute one year of growth on the same deposit at the same nominal rate compounded annually, quarterly, and monthly, and express the difference as the effective annual rate the depositor actually receives.',
    scenario: 'The simulated deposit and the three crediting schedules below are invented for this exercise. All three quote the same 4% nominal annual rate and differ only in how often interest is added.',
    materials: ['calculator', 'the fictional deposit terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional depositor places $4,000 for one year at a 4% nominal annual rate. Under quarterly compounding the account adds one quarter of the nominal rate at the end of each of the 4 quarters, and each addition earns interest for the rest of the year. Under monthly compounding it adds one twelfth of the nominal rate at the end of each month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'Compounded once at the end of the year, how much interest does the deposit earn?',
            given: { principal: 4000, rate: 0.04 }, expr: 'principal * rate', format: 'usd', answer: '$160.00',
            reasoning: '4% of $4,000 credited a single time. This is the baseline every other frequency is measured against.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after one year with quarterly compounding? Round to the nearest cent.',
            given: { principal2: 4000, rate2: 0.04 }, expr: 'round(principal2 * pow(1 + rate2 / 4, 4), 2)', format: 'usd', answer: '$4,162.42',
            reasoning: 'One quarter of the 4% rate is added at the end of each of four quarters, and each credited amount earns interest for the quarters that follow.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much interest is that, and how does it compare with the once-a-year figure?',
            given: { principal3: 4000 }, expr: '#t1-p2 - principal3', format: 'usd', answer: '$162.42',
            reasoning: '$4,162.42 less the $4,000 deposited — $2.42 more than the $160.00 a single annual credit produces.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for monthly compounding, then state each schedule as an effective annual rate — the single once-a-year rate that would produce the same ending balance.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after one year with monthly compounding? Round to the nearest cent.',
            given: { principal4: 4000, rate3: 0.04 }, expr: 'round(principal4 * pow(1 + rate3 / 12, 12), 2)', format: 'usd', answer: '$4,162.97',
            reasoning: 'One twelfth of the 4% nominal rate added at each of twelve month ends, each addition earning for the months that remain.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does monthly compounding produce?',
            given: { principal5: 4000 }, expr: '#t2-p1 - principal5', format: 'usd', answer: '$162.97',
            reasoning: '$4,162.97 less the $4,000 deposited. Moving from quarterly to monthly added 55 cents on $4,000.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'State the quarterly schedule as an effective annual rate.',
            given: { rate4: 0.04 }, expr: '(pow(1 + rate4 / 4, 4) - 1) * 100', format: 'percent2', answer: '4.06%',
            reasoning: 'The growth factor over the year less 1, expressed as a percentage. A 4% nominal rate compounded quarterly is a 4.06% effective rate.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'State the monthly schedule as an effective annual rate.',
            given: { rate5: 0.04 }, expr: '(pow(1 + rate5 / 12, 12) - 1) * 100', format: 'percent2', answer: '4.07%',
            reasoning: 'The same calculation on twelve periods. This is the figure a disclosure would print as the APY, and it is what makes two accounts comparable.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'All three schedules advertise the same 4% rate but pay three different amounts. Explain what the effective annual rate is for, and say what a depositor should ask for when two accounts quote the same nominal rate.',
            acceptableAnswerCriteria: [
              'Explains that the effective annual rate folds compounding frequency into a single number, so two accounts quoted on that basis can be compared directly.',
              'States that a depositor should ask for the effective annual rate or APY rather than the nominal rate, because the nominal rate alone does not determine the ending balance.',
              'Observes from the $160.00, $162.42, and $162.97 figures that the gain from more frequent compounding is real but small at this rate, and shrinks as frequency rises.',
            ],
            evidenceRequirements: [
              'Cites at least two of the three interest figures and at least one of the two effective annual rates.',
            ],
            dimensions: ['reasoning-from-figures', 'transfer', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats frequency as a second term of the offer, not as a detail.',
              'The response does not overstate the effect: the whole span from annual to monthly is $2.97 on $4,000 here.',
            ],
            commonMisconception: 'Assuming two accounts quoting the same rate must pay the same amount.',
          },
        ],
      },
    ],
    remediation: 'If quarterly compounding comes out as $164.00, the rate is being applied four times in full rather than a quarter of it applied four times. Each quarter adds one fourth of 4%, which is 1%, to whatever is in the account at that moment. Compute the four quarterly balances one at a time and watch the interest itself start earning.',
    extension: 'Work out what the same $4,000 would earn in a year at 4% compounded daily, and say whether the gap from monthly to daily is larger or smaller than the gap from annual to quarterly.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l03',
    grade: 10, unit: 3, day: 3,
    actor: 'a fictional saver whose balance grew while its purchasing power fell',
    objective: 'Convert a fictional year-end balance into start-of-year purchasing power, compute the real rate of return, and show why subtracting inflation from the nominal rate is an approximation rather than the definition.',
    scenario: 'The simulated savings account and the simulated inflation rate below are invented for this exercise. No real price index or published rate is used.',
    materials: ['calculator', 'the fictional account and inflation figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional saver holds $3,000 for one year in an account paying 2.5% annual interest. Over the same year, prices in the simulated economy rise by 3.8%, so what cost $1.00 at the start of the year costs $1.038 at the end of it.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the end of the year?',
            given: { saved: 3000, nominalRate: 0.025 }, expr: 'saved * (1 + nominalRate)', format: 'usd', answer: '$3,075.00',
            reasoning: '$3,000 plus 2.5% of it. This is the nominal balance — the number the statement prints.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is that year-end balance worth in start-of-year dollars? Round to the nearest cent.',
            given: { inflation: 0.038 }, expr: 'round(#t1-p1 / (1 + inflation), 2)', format: 'usd', answer: '$2,962.43',
            reasoning: 'Dividing by 1.038 converts end-of-year dollars back to what they would have bought at the start of the year. Prices rose, so each dollar buys less and the division reduces the figure.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much purchasing power did the saver lose over the year, measured in start-of-year dollars?',
            given: { saved2: 3000 }, expr: 'saved2 - #t1-p2', format: 'usd', answer: '$37.57',
            reasoning: 'The original $3,000 against the $2,962.43 the ending balance can actually buy. The balance rose by $75.00 and still bought less.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now state the same result as a rate, two ways.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the exact real rate of return — the growth factor divided by the price factor, less 1?',
            given: { nominalRate2: 0.025, inflation2: 0.038 }, expr: '((1 + nominalRate2) / (1 + inflation2) - 1) * 100', format: 'percent2', answer: '-1.25%',
            reasoning: '1.025 divided by 1.038 is less than 1, so the real return is negative. This is the definition: what the money grew by, divided by what prices grew by.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What do you get by simply subtracting the inflation rate from the interest rate?',
            given: { nominalRate3: 0.025, inflation3: 0.038 }, expr: '(nominalRate3 - inflation3) * 100', format: 'percent2', answer: '-1.30%',
            reasoning: '2.5% less 3.8%. The subtraction is a close approximation and is the wrong sign for nobody here, but it is not the same figure as the exact -1.25%.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which statement about the saver’s year is accurate?',
            choices: [
              'The account lost money and the balance fell',
              'The account gained money and the balance bought less than it would have at the start of the year',
              'The account gained money and the balance bought more than it would have at the start of the year',
            ],
            given: { nominalRate4: 0.025, inflation4: 0.038 },
            decision: { left: 'nominalRate4', cmp: '<', right: 'inflation4', ifTrue: 'The account gained money and the balance bought less than it would have at the start of the year', ifFalse: 'The account gained money and the balance bought more than it would have at the start of the year' },
            answer: 'The account gained money and the balance bought less than it would have at the start of the year',
            reasoning: 'The balance rose from $3,000 to $3,075.00, so nothing was lost in dollars. Because 2.5% is below the 3.8% rise in prices, those dollars buy less than the original ones did.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A statement showing a balance that went up is not by itself evidence that a saver is better off. Explain what the statement leaves out, and say what a saver would need to know to judge whether a year of saving worked.',
            acceptableAnswerCriteria: [
              'Explains that a statement reports nominal dollars only, and that judging a year requires comparing the interest rate against the change in prices over the same period.',
              'States that the saver needs an inflation figure for the same year, and that without one the $75.00 gain cannot be read as a gain in purchasing power.',
              'Uses the $2,962.43 figure to make the point concrete: the ending balance buys less than the $3,000 that was deposited.',
            ],
            evidenceRequirements: [
              'Uses the $3,075.00 nominal balance and either the $2,962.43 real value or the -1.25% real return.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not describe the account as having lost money; the balance rose.',
              'The response treats inflation as something that happened to prices, not as a fee the bank charged.',
            ],
            commonMisconception: 'Reading a rising balance as proof that saving is keeping ahead, without checking what happened to prices.',
          },
        ],
      },
    ],
    remediation: 'If the real value comes out above $3,075.00, the division has been done the wrong way round. Prices rose, so a year-end dollar buys less than a start-of-year dollar; converting back to start-of-year dollars must make the figure smaller. Divide $3,075.00 by 1.038, not multiply.',
    extension: 'Find the interest rate this fictional account would have needed to leave the saver exactly even in purchasing power, and say whether that rate is above or below the 3.8% rise in prices.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l04',
    grade: 10, unit: 3, day: 4,
    actor: 'a fictional worker comparing an automatic transfer with saving whatever is left',
    objective: 'Compute a year of saving under an automatic transfer against a year of saving the monthly remainder, and quantify the gap the ordering of the two decisions creates.',
    scenario: 'The simulated pay, expenses, and transfer below are invented for this exercise. No real household budget is described and none is requested.',
    materials: ['calculator', 'the fictional pay and expense figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional worker takes home $1,840 a month. Under the first plan, 12% of take-home moves to savings automatically on payday, before any spending. Under the second plan, nothing is transferred and whatever remains at the end of the month is saved. The worker’s spending settles at $1,690 a month under the second plan.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'Under the automatic plan, how much moves to savings each month?',
            given: { takeHome: 1840, saveRate: 0.12 }, expr: 'takeHome * saveRate', format: 'usd', answer: '$220.80',
            reasoning: '12% of the $1,840 take-home, moved before the month’s spending begins.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the automatic plan save over twelve months?',
            given: {}, expr: '#t1-p1 * 12', format: 'usd', answer: '$2,649.60',
            reasoning: 'Twelve transfers of $220.80. The amount is fixed by the rule rather than by what is left over.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Under the second plan, how much is left at the end of a month?',
            given: { takeHome2: 1840, expenses: 1690 }, expr: 'takeHome2 - expenses', format: 'usd', answer: '$150.00',
            reasoning: '$1,840 of take-home less $1,690 of spending. This is the residual the second plan saves.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two plans over a year, and measure the automatic plan against a stated goal.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the second plan save over twelve months?',
            given: {}, expr: '#t1-p3 * 12', format: 'usd', answer: '$1,800.00',
            reasoning: 'Twelve months of the $150.00 residual.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more does the automatic plan save over the year?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$849.60',
            reasoning: '$2,649.60 against $1,800.00. Nothing about the worker’s income changed between the two plans; only the order in which saving and spending happen did.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'After 13 months of automatic transfers, how much has the worker saved?',
            given: { months: 13 }, expr: '#t1-p1 * months', format: 'usd', answer: '$2,870.40',
            reasoning: '13 transfers of $220.80, ignoring any interest the account might add.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'The worker is saving towards a $3,000 goal. How far short is the balance after those 13 months?',
            given: { goal: 3000 }, expr: 'goal - #t2-p3', format: 'usd', answer: '$129.60',
            reasoning: '$3,000 against the $2,870.40 accumulated, which shows the goal is not quite reached in 13 months at this transfer rate.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The worker earns the same amount under both plans, yet one saves $849.60 more. Explain where that difference comes from, and name one condition under which the automatic plan would fail rather than help.',
            acceptableAnswerCriteria: [
              'Locates the difference in the ordering: the automatic plan sets the saving amount first and lets spending adjust to what remains, while the second plan lets spending set the saving amount.',
              'Names a realistic failure condition — spending that cannot compress to the remaining $1,619.20, leading to overdrafts, borrowing, or transfers pulled straight back out.',
              'Recognises that the $849.60 gap is a change in behaviour and not new income, so it holds only if the smaller spending figure is actually livable.',
            ],
            evidenceRequirements: [
              'Uses the $2,649.60 and $1,800.00 annual totals, and refers to the $220.80 monthly transfer.',
            ],
            dimensions: ['plan-coherence', 'assumption-identification', 'tradeoff-defense'],
            lookFors: [
              'The response identifies the automatic transfer as changing what the month starts with, not as changing what is earned.',
              'The response does not treat the second plan as a character failing; a residual of $150.00 is what a tight month produces.',
            ],
            commonMisconception: 'Treating saving as what happens to be left over rather than as a fixed claim on income taken first.',
          },
        ],
      },
    ],
    remediation: 'If both plans look the same, compare what each one fixes. The automatic plan fixes the saving at $220.80 and lets spending take what is left. The second plan fixes spending at $1,690 and lets saving take what is left. The same $1,840 produces $2,649.60 one way and $1,800.00 the other.',
    extension: 'Find the transfer percentage that would reach the $3,000 goal in exactly 12 months, and say what monthly spending that would leave.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l05',
    grade: 10, unit: 3, day: 5,
    actor: 'a fictional seasonal worker whose pay arrives unevenly across the year',
    objective: 'Convert a fictional uneven income stream into a level monthly figure, compute the shortfall the low months create and the surplus the high months produce, and show that the two must match.',
    scenario: 'The simulated seasonal job and its pay pattern are invented for this exercise. No real employer, season, or worker is described.',
    materials: ['calculator', 'the fictional pay pattern in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional seasonal worker is paid $2,900 a month during 4 peak months and $980 a month during the other 8 months of the year. Nothing else changes across the year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does the worker earn across the peak months?',
            given: { peakPay: 2900, peakMonths: 4 }, expr: 'peakPay * peakMonths', format: 'usd', answer: '$11,600.00',
            reasoning: '4 peak months at $2,900 each. This is the part of the year the whole plan has to be funded from.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does the worker earn across the off-season months?',
            given: { offPay: 980, offMonths: 8 }, expr: 'offPay * offMonths', format: 'usd', answer: '$7,840.00',
            reasoning: '8 off-season months at $980 each.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the worker’s income for the whole year?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$19,440.00',
            reasoning: '$11,600.00 from the peak months plus $7,840.00 from the off-season.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now build the level figure the year can actually support, and check that the two halves of the plan balance.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What level monthly amount does the year’s income support?',
            given: {}, expr: '#t1-p3 / 12', format: 'usd', answer: '$1,620.00',
            reasoning: 'The $19,440.00 annual total spread evenly across twelve months. This is the figure a budget should be built on, and it matches neither the peak pay nor the off-season pay.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Across the off-season, how far does the pay fall short of that level amount in total?',
            given: { offPay2: 980, offMonths2: 8 }, expr: '(#t2-p1 - offPay2) * offMonths2', format: 'usd', answer: '$5,120.00',
            reasoning: 'Each of the 8 off-season months falls $640.00 short of $1,620.00. This is the amount that has to be waiting when the off-season starts.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Across the peak months, how much does the pay exceed the level amount in total?',
            given: { peakPay2: 2900, peakMonths2: 4 }, expr: '(peakPay2 - #t2-p1) * peakMonths2', format: 'usd', answer: '$5,120.00',
            reasoning: 'Each of the 4 peak months runs $1,280.00 above $1,620.00. It equals the off-season shortfall exactly, because both are measured against the same average of the same income.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If the worker instead budgeted as though every month paid the peak rate, how much income would the plan assume that the year never produces?',
            given: { peakPay3: 2900 }, expr: 'peakPay3 * 12 - #t1-p3', format: 'usd', answer: '$15,360.00',
            reasoning: 'Twelve months at $2,900 is $34,800.00 against actual income of $19,440.00 — the gap a peak-anchored budget would have to borrow or default on.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The peak surplus and the off-season shortfall both come to $5,120.00. Explain why they have to be equal, and say what the worker must actually do during the peak months for the plan to hold.',
            acceptableAnswerCriteria: [
              'Explains that both figures are deviations from the same average of the same annual income, so the amounts above and below the average necessarily cancel.',
              'States the required action concretely: the $5,120.00 of peak surplus must be set aside as it arrives rather than spent, so that it is available across the 8 lean months.',
              'Notes that the equality is arithmetic and guarantees nothing on its own — it holds only if the surplus is actually kept and the $1,620.00 level figure is livable.',
            ],
            evidenceRequirements: [
              'Uses the $1,620.00 level monthly figure and the $5,120.00 that appears on both sides.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response treats the equality as a consequence of using the average, not as a coincidence of these numbers.',
              'The response recognises that a peak month feels like a raise and that this is exactly when the plan is most likely to break.',
            ],
            commonMisconception: 'Budgeting seasonal work from the months when money is coming in, and treating the lean months as an emergency rather than as a known part of the year.',
          },
        ],
      },
    ],
    remediation: 'If the level monthly figure comes out as $1,940, the two monthly pay rates are being averaged without weighting them by how many months each one lasts — $2,900 and $980 average to $1,940, but the year holds only 4 months at the higher rate and 8 at the lower. Total the whole year’s income, $19,440.00, and divide that by 12.',
    extension: 'Suppose the peak season shortens to 3 months at the same rates. Recompute the level monthly figure and the amount the peak months must now carry, and say which of the two changes more.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l06',
    grade: 10, unit: 3, day: 6,
    actor: 'a fictional saver choosing among three vehicles with different disclosed terms',
    objective: 'Compare three fictional savings vehicles over two years on their disclosed terms, net of fees, and show that the highest advertised rate produces the worst outcome once a maintenance fee is counted.',
    scenario: 'The three simulated savings vehicles below are invented for this exercise. Each discloses an annual percentage yield, and the balance is grown by that yield once per year for two years.',
    materials: ['calculator', 'the three fictional vehicle disclosures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional saver has $5,000 to place for 2 years. Vehicle A discloses a 4.10% annual percentage yield with no fee and withdrawals at any time. Vehicle B discloses a 4.45% yield with no fee but locks the money for the full 24 months. Vehicle C discloses a 4.75% yield with withdrawals at any time and a $4 monthly maintenance fee. Grow each balance by its disclosed yield once per year, then subtract any fees.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Vehicle A hold after two years? Round to the nearest cent.',
            given: { deposit: 5000, apyA: 0.041 }, expr: 'round(deposit * pow(1 + apyA, 2), 2)', format: 'usd', answer: '$5,418.41',
            reasoning: '$5,000 grown at the disclosed 4.10% yield in each of two years, with the first year’s interest earning in the second.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Vehicle B hold after two years? Round to the nearest cent.',
            given: { deposit2: 5000, apyB: 0.0445 }, expr: 'round(deposit2 * pow(1 + apyB, 2), 2)', format: 'usd', answer: '$5,454.90',
            reasoning: 'The same calculation at the disclosed 4.45% yield. Nothing is deducted, but the money cannot be reached for 24 months.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Vehicle C hold after two years, before any fee is taken? Round to the nearest cent.',
            given: { deposit3: 5000, apyC: 0.0475 }, expr: 'round(deposit3 * pow(1 + apyC, 2), 2)', format: 'usd', answer: '$5,486.28',
            reasoning: 'The highest disclosed yield, 4.75%, applied for two years. On interest alone Vehicle C leads.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now take the fee into account and rank the three.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do Vehicle C’s maintenance fees total over the two years?',
            given: { monthlyFee: 4 }, expr: 'monthlyFee * 24', format: 'usd', answer: '$96.00',
            reasoning: '$4 charged in each of the 24 months. The fee is flat, so it does not shrink when the yield is high.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Vehicle C actually leave the saver after fees?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$5,390.28',
            reasoning: '$5,486.28 of balance less $96.00 of fees, which drops the highest-yielding vehicle below both of the others.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does Vehicle B leave the saver than Vehicle C, after fees?',
            given: {}, expr: '#t1-p2 - #t2-p2', format: 'usd', answer: '$64.62',
            reasoning: '$5,454.90 against $5,390.28 — a 4.45% vehicle beating a 4.75% one because of a fee worth more than the rate difference.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which vehicle leaves the most money after two years, counting fees?',
            choices: ['Vehicle A', 'Vehicle B', 'Vehicle C'],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t2-p2', ifTrue: 'Vehicle B', ifFalse: 'Vehicle C' },
            answer: 'Vehicle B',
            reasoning: 'Vehicle B ends at $5,454.90 against Vehicle C’s $5,390.28 and Vehicle A’s $5,418.41. The ranking by ending balance is the reverse of the ranking by advertised yield for B and C.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Vehicle B ends with the most money, but Vehicle A is the only one of the three a saver can reach at any time without giving anything up. Argue for one of them for money that has a 1-in-4 chance of being needed inside the two years, and name what your choice costs.',
            acceptableAnswerCriteria: [
              'Chooses either A or B and defends it with the $36.49 difference between their ending balances against the cost of not being able to reach Vehicle B for 24 months.',
              'Names what the choice gives up specifically — either the $36.49 of extra interest, or the ability to take the money out during the lock period.',
              'Treats the stated 1-in-4 chance as the fact that decides the question rather than assuming the money will or will not be needed.',
            ],
            evidenceRequirements: [
              'Uses the $5,418.41 and $5,454.90 ending balances, and refers to the 24-month lock on Vehicle B.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'Either choice is fully defensible here; what is being scored is whether the cost of the choice is named.',
              'The response does not select Vehicle C on the strength of its 4.75% headline, having computed the $96.00 of fees.',
            ],
            commonMisconception: 'Ranking savings vehicles by advertised yield without netting out flat fees or pricing the access restriction.',
          },
        ],
      },
    ],
    remediation: 'If Vehicle C still looks best, the fee has not been subtracted from the ending balance. The $4 monthly charge runs for all 24 months whatever the yield does, and $96.00 is more than the extra interest the higher yield produced over Vehicle B. Compute each vehicle’s ending balance, then take the fees off before ranking.',
    extension: 'Find the monthly maintenance fee at which Vehicle C would exactly tie Vehicle B after two years, and say whether a saver could tell from the advertised yields alone that such a fee mattered.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l07',
    grade: 10, unit: 3, day: 7,
    actor: 'a fictional student whose worked account page contains three specific errors',
    objective: 'Locate and correct three errors in a fictional worked page about account rates, overdraft charges, and a minimum-balance waiver, and state the misconception behind each one.',
    scenario: 'The simulated worked page below was written by a fictional student for this exercise. Its errors are deliberate. No real bank or account is described.',
    materials: ['calculator', 'the fictional worked page in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional student wrote: "The account holds $1,500 at a 3.6% annual percentage yield. That is 3.6% each month, so the interest is $54 a month, which comes to $648 a year." Check the first claim.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does a 3.6% annual percentage yield actually pay on $1,500 over a year?',
            given: { bal: 1500, apy: 0.036 }, expr: 'bal * apy', format: 'usd', answer: '$54.00',
            reasoning: '3.6% of $1,500. The student’s $54 figure is right as an annual amount and wrong as a monthly one — the word "annual" in the rate name is the whole disagreement.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does the student’s $648 claim overstate a year of interest?',
            given: { claimed: 648 }, expr: 'claimed - #t1-p1', format: 'usd', answer: '$594.00',
            reasoning: '$648 claimed against $54.00 actually paid, an overstatement of twelve times the true figure less the true figure itself.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The fictional student also wrote: "Overdraft protection is free, so the three overdrafts cost nothing," and "The balance averaged $310 over the month, so the $10 monthly fee was waived." The fictional bank charges $34 for each overdraft, plus $6 a day for each day an account stays overdrawn beyond the first, and waives the $10 monthly fee only in a month when the balance stays at or above $300 every single day. This account was overdrawn for 5 extra days and fell to $25 on one day.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the three overdrafts cost in per-item charges?',
            given: { odFee: 34, odCount: 3 }, expr: 'odFee * odCount', format: 'usd', answer: '$102.00',
            reasoning: '3 overdrafts at $34 each. "Protection" describes the bank covering the payment, not the charge being waived.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do the extended overdraft days add?',
            given: { dailyFee: 6, days: 5 }, expr: 'dailyFee * days', format: 'usd', answer: '$30.00',
            reasoning: '$6 a day for 5 days beyond the first. This charge accrues from time, not from any further transaction.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What did the overdrafts cost altogether?',
            given: {}, expr: '#t2-p1 + #t2-p2', format: 'usd', answer: '$132.00',
            reasoning: '$102.00 of per-item charges plus $30.00 of daily charges — against a year of interest on this account worth $54.00.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'The balance fell to $25 on one day, so the waiver condition failed. What does the monthly fee cost over a year if it fails every month?',
            given: { monthlyFee2: 10 }, expr: 'monthlyFee2 * 12', format: 'usd', answer: '$120.00',
            reasoning: 'The waiver is written on the daily balance, not the monthly average, so a single day at $25 forfeits it. Twelve failed months at $10 each.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Name the misconception behind each of the student’s three errors, and say which of the three would cost a real account holder the most over a year.',
            acceptableAnswerCriteria: [
              'Identifies the three misconceptions: reading an annual rate as a monthly one, reading "overdraft protection" as meaning free, and reading a daily-minimum waiver as an average-balance waiver.',
              'Ranks the overdraft charges highest at $132.00 from a single month, against $120.00 of monthly fees across a whole year and $54.00 of interest earned in a year.',
              'Notes that the rate error costs nothing directly but produces a wrong expectation, which is how it does its damage.',
            ],
            evidenceRequirements: [
              'Uses the $132.00 overdraft total and the $120.00 annual fee total, and refers to the $54.00 of annual interest.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response locates each error in a specific misreading of a term rather than calling the work careless.',
              'A response that ranks the $120.00 annual fee above the $132.00 single month is defensible if it argues that the fee recurs every year while the overdrafts may not.',
            ],
            commonMisconception: 'Reading the words in an account disclosure as everyday English rather than as terms with a defined trigger.',
          },
        ],
      },
    ],
    remediation: 'If the annual interest still looks like $648, read the rate name again: an annual percentage yield is what a year pays, not what a month pays. Multiply $1,500 by 3.6% once for a year, and notice that a single month of overdrafts on this same account cost $132.00.',
    extension: 'Rewrite the fictional student’s three sentences so each one is correct, then say which of the three terms — the yield, the overdraft schedule, or the waiver condition — a person opening an account would be least likely to read.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l08',
    grade: 10, unit: 3, day: 8,
    actor: 'a fictional saver deciding between a higher rate and more frequent compounding',
    objective: 'Apply the compounding method to a five-year horizon and determine whether an extra tenth of a percentage point of rate is worth more than a move from annual to monthly compounding.',
    scenario: 'The simulated accounts below are invented for this exercise. They are offered to a fictional saver who must pick one and leave the money for the full term.',
    materials: ['calculator', 'the fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional saver places $8,000 for 5 years. Account X pays a 3.00% nominal annual rate compounded monthly, adding one twelfth of the rate at each of the 60 month ends. Account Y pays 3.10% compounded once a year. Nothing is added or withdrawn during the term.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Account X hold at the end of the term? Round to the nearest cent.',
            given: { start: 8000, rateX: 0.03 }, expr: 'round(start * pow(1 + rateX / 12, 60), 2)', format: 'usd', answer: '$9,292.93',
            reasoning: 'One twelfth of the 3.00% nominal rate compounded across 60 months.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Account Y hold at the end of the term? Round to the nearest cent.',
            given: { start2: 8000, rateY: 0.031 }, expr: 'round(start2 * pow(1 + rateY, 5), 2)', format: 'usd', answer: '$9,319.30',
            reasoning: '3.10% applied once in each of 5 years — the less frequent schedule, but the higher rate.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Which account ends higher, and by how much?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$26.37',
            reasoning: '$9,319.30 against $9,292.93. The annually compounded account wins because its rate advantage is larger than the compounding advantage it gives up.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now separate the two effects, by pricing monthly compounding on its own.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What would $8,000 hold after 5 years at 3.00% compounded once a year? Round to the nearest cent.',
            given: { start3: 8000, rateX2: 0.03 }, expr: 'round(start3 * pow(1 + rateX2, 5), 2)', format: 'usd', answer: '$9,274.19',
            reasoning: 'The same 3.00% rate as Account X, but credited annually. This isolates what the compounding frequency alone is worth.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is monthly compounding worth on its own, at the same 3.00% rate?',
            given: {}, expr: '#t1-p1 - #t2-p1', format: 'usd', answer: '$18.74',
            reasoning: '$9,292.93 against $9,274.19. Moving from annual to monthly compounding is worth $18.74 across five years on $8,000.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the extra tenth of a percentage point worth on its own, comparing the two annually compounded figures?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$45.11',
            reasoning: '$9,319.30 at 3.10% against $9,274.19 at 3.00%, both compounded annually — more than twice what the frequency change was worth.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'An earlier lesson showed that compounding more often always pays more. This one shows an annually compounded account beating a monthly one. Explain how both can be true, and state the rule this case gives you for reading two offers.',
            acceptableAnswerCriteria: [
              'Explains that more frequent compounding always beats less frequent compounding at the same rate, and that Account Y wins here because it does not offer the same rate.',
              'States the transferable rule: convert both offers to an effective annual rate, or compare ending balances, rather than ranking on either the rate or the frequency alone.',
              'Uses the $18.74 and $45.11 figures to show which of the two effects was larger in this case, and notes that the ranking could reverse at a different rate gap.',
            ],
            evidenceRequirements: [
              'Uses the $9,292.93 and $9,319.30 ending balances and both of the isolated effects.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'error-diagnosis'],
            lookFors: [
              'The response holds one variable fixed at a time rather than arguing from the two headline offers.',
              'The response does not conclude that compounding frequency is unimportant; it concludes that it was smaller than the rate gap here.',
            ],
            commonMisconception: 'Treating "compounds more often" as a ranking rule that survives a change in the rate.',
          },
        ],
      },
    ],
    remediation: 'If Account X is expected to win, notice that two things differ between the offers, not one. Hold the rate at 3.00% and change only the frequency to see that it is worth $18.74; then hold the frequency annual and change only the rate to see that it is worth $45.11. The larger of the two decides the ranking.',
    extension: 'Find the nominal rate Account X would need, still compounded monthly, to match Account Y over the same term, and say how far that is above 3.00%.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l09',
    grade: 10, unit: 3, day: 9,
    actor: 'a fictional saver reviewing a three-year result in both nominal and real terms',
    objective: 'Carry a fictional balance through three years of compounding and three years of inflation, and report the same result as a nominal gain, a real gain, and a real rate.',
    scenario: 'The simulated account and the simulated three-year inflation rate below are invented for this exercise. The inflation figure is held constant across the three years to keep the arithmetic readable, which no real economy does.',
    materials: ['calculator', 'the fictional account and inflation figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional saver places $6,500 in an account paying a 4.2% annual percentage yield, compounded once a year, and leaves it for 3 years. Over each of those years, prices in the simulated economy rise by 3.1%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the nominal balance after three years? Round to the nearest cent.',
            given: { start: 6500, rate: 0.042 }, expr: 'round(start * pow(1 + rate, 3), 2)', format: 'usd', answer: '$7,353.88',
            reasoning: '$6,500 grown at 4.2% in each of three years. This is the figure the statement prints.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the nominal gain over the three years?',
            given: { start2: 6500 }, expr: '#t1-p1 - start2', format: 'usd', answer: '$853.88',
            reasoning: '$7,353.88 against the $6,500 deposited.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is that ending balance worth in the dollars of the day the money was deposited? Round to the nearest cent.',
            given: { inflation: 0.031 }, expr: 'round(#t1-p1 / pow(1 + inflation, 3), 2)', format: 'usd', answer: '$6,710.28',
            reasoning: 'Three years of 3.1% price rises are divided out, converting the ending balance into the purchasing power it represents at the start.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now report the same three years as a real gain and as a rate, and separate the two components of the nominal figure.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the real gain over the three years, in start-of-period dollars?',
            given: { start3: 6500 }, expr: '#t1-p3 - start3', format: 'usd', answer: '$210.28',
            reasoning: '$6,710.28 of purchasing power against the $6,500 deposited. Unlike the previous unit’s case, this saver is genuinely ahead — the yield beat the price rise.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the $853.88 nominal gain was consumed by rising prices?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$643.60',
            reasoning: 'The gap between the $7,353.88 nominal balance and the $6,710.28 it is worth in start-of-period dollars — over three quarters of the nominal gain.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What is the real rate of return per year?',
            given: { rate2: 0.042, inflation2: 0.031 }, expr: '((1 + rate2) / (1 + inflation2) - 1) * 100', format: 'percent2', answer: '1.07%',
            reasoning: 'The growth factor divided by the price factor, less 1. A 4.2% yield against 3.1% inflation is a real return just above 1%, not the 4.2% the statement suggests.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The saver gained $853.88 on paper and $210.28 in purchasing power. Explain which figure answers "did this account do its job", and identify the assumption in this lesson that a real three-year period would not satisfy.',
            acceptableAnswerCriteria: [
              'Argues that the $210.28 real gain answers the question, because the point of saving is future purchasing power rather than a larger number of dollars.',
              'Identifies the constant 3.1% inflation assumption as the one a real three-year period would not satisfy, and states that a different path of prices would change the real result even with the same yield.',
              'Notes that both figures are correct answers to different questions, so the nominal figure is not wrong — it is just not the one that decides whether saving worked.',
            ],
            evidenceRequirements: [
              'Uses the $853.88 nominal gain, the $210.28 real gain, and the 1.07% real rate.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response names the constant-inflation assumption specifically, not "the numbers are made up".',
              'The response recognises that a 4.2% yield beating 3.1% inflation is a good outcome, even though $643.60 of the gain went to prices.',
            ],
            commonMisconception: 'Treating a real return as a deduction someone takes, rather than as a restatement of the same result in constant dollars.',
          },
        ],
      },
    ],
    remediation: 'If the real gain comes out near $853.88, inflation has not been applied. Divide the $7,353.88 ending balance by 1.031 three times — once for each year of price rises — before comparing it with the original $6,500.',
    extension: 'Recompute the real gain if prices rose 3.1% in the first year and then 5% in each of the next two, and say whether an average inflation rate would have given you the same answer.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u03-l10',
    grade: 10, unit: 3, day: 10,
    actor: 'a fictional household modelling one budget year across two accounts',
    objective: 'Build a twelve-month fictional budget across a checking and a savings account, credit interest on the average month-end balance, and report the ending balance in inflation-adjusted terms.',
    scenario: 'The simulated household, its pay, its costs, and the simulated inflation rate are all invented for this exercise. No real household finances are described and none are requested.',
    materials: ['calculator', 'the fictional budget figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional household takes home $2,450 a month. Fixed costs come to $1,780 a month. An automatic transfer moves 15% of take-home into savings on payday, before anything is spent. The savings account credits 3.9% annual interest once at year end, calculated on the average of the twelve month-end balances; for a level monthly deposit that average is 6.5 times the deposit.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much moves into savings each month?',
            given: { takeHome: 2450, saveRate: 0.15 }, expr: 'takeHome * saveRate', format: 'usd', answer: '$367.50',
            reasoning: '15% of $2,450 take-home, transferred before spending.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is left in checking each month after fixed costs and the transfer?',
            given: { takeHome2: 2450, fixedCosts: 1780 }, expr: 'takeHome2 - fixedCosts - #t1-p1', format: 'usd', answer: '$302.50',
            reasoning: '$2,450 less $1,780 of fixed costs less the $367.50 transfer. This is what the household has for everything the fixed-cost line does not cover.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the twelve transfers deposit into savings over the year, before interest?',
            given: {}, expr: '#t1-p1 * 12', format: 'usd', answer: '$4,410.00',
            reasoning: 'Twelve deposits of $367.50, before any interest is added. This is the amount the household itself put in.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now finish the year: credit the interest on the stated basis, then convert the result into the purchasing power it represents at the start of the year, when prices in the simulated economy rise 3.4% over the twelve months.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What interest is credited at year end? Round to the nearest cent.',
            given: { avgFactor: 6.5, apy: 0.039 }, expr: 'round(#t1-p1 * avgFactor * apy, 2)', format: 'usd', answer: '$93.16',
            reasoning: 'The average month-end balance is 6.5 times the $367.50 deposit, and 3.9% of that average is credited once. Interest is not paid on the full $4,410.00, because most of that money was in the account for only part of the year.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the savings balance at the end of the year?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$4,503.16',
            reasoning: '$4,410.00 of deposits plus $93.16 of interest.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is that ending balance worth in start-of-year dollars? Round to the nearest cent.',
            given: { inflation: 0.034 }, expr: 'round(#t2-p2 / (1 + inflation), 2)', format: 'usd', answer: '$4,355.09',
            reasoning: 'The $4,503.16 balance divided by 1.034 to undo the year’s price rise.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much purchasing power did the year’s price rise take out of the ending balance?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$148.07',
            reasoning: '$4,503.16 against $4,355.09 — more than the $93.16 of interest the account paid.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Report this budget year to the fictional household in three sentences: what was saved, what it is worth, and what the household should change first if the $302.50 monthly remainder is not enough to live on. Justify the change you recommend with a figure from this lesson.',
            acceptableAnswerCriteria: [
              'Reports the year accurately: $4,410.00 deposited, $93.16 of interest, an ending balance of $4,503.16 worth $4,355.09 in start-of-year dollars.',
              'Recommends a specific first change — reducing the 15% transfer rate, or reducing a fixed cost — and ties it to the $302.50 remainder rather than to a general preference.',
              'Recognises that the $148.07 lost to prices exceeds the $93.16 of interest, so a higher transfer rate rather than a higher yield is what this household controls.',
            ],
            evidenceRequirements: [
              'Uses the $4,503.16 ending balance, the $4,355.09 real value, and the $302.50 monthly remainder.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes what the household controls, the transfer rate and the costs, from what it does not, the interest rate and inflation.',
              'Either recommendation is defensible; what is scored is whether it is tied to a figure and whether its cost is acknowledged.',
            ],
            commonMisconception: 'Judging a savings year by the deposit total alone, without asking what the balance will buy or whether the monthly remainder was livable.',
          },
        ],
      },
    ],
    remediation: 'If the interest comes out near $171.99, the 3.9% is being applied to the full $4,410.00 of deposits. Money deposited in month 11 was in the account for one month, not twelve. The stated basis here is the average of the twelve month-end balances, which is 6.5 times the $367.50 monthly deposit.',
    extension: 'Recompute the year with the transfer set at 20% of take-home, and say what the new monthly remainder would be and whether the extra interest or the extra deposits accounts for more of the change.',
  },
]
