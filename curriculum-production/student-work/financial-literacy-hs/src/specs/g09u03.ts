import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 3 — PF3 Budgeting and Saving: Building a Budget That Survives
 * a Surprise.
 */
export const g09u03: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u03-l01',
    grade: 9, unit: 3, day: 1,
    actor: 'a fictional saver in an invented matched-savings programme',
    objective: 'Compare the size of two incentives to set money aside — a fictional deposit match and account interest — and say which one actually moves the decision.',
    scenario: 'A fictional community credit union runs a simulated matched-savings programme. Every rate and amount below is invented for this exercise; no real account or programme is involved.',
    materials: ['calculator', 'the fictional programme terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional programme: a saver who deposits $25 a month for 12 months receives a match of 50% of everything deposited. The account also pays 3.4% a year on the balance. A plain chequing account at the same fictional credit union pays 0.05% a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does the saver deposit over the 12 months?',
            given: { monthly: 25, months: 12 }, expr: 'monthly * months', format: 'usd', answer: '$300.00',
            reasoning: '$25 a month for 12 months is $300 of the saver’s own money.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is the match worth?',
            given: { matchRate: 0.5 }, expr: '#t1-p1 * matchRate', format: 'usd', answer: '$150.00',
            reasoning: 'The match is 50% of everything deposited, and the deposits total $300 over the year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after deposits and match, before any interest?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$450.00',
            reasoning: '$300 deposited plus $150 matched.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare that with what interest adds. Apply each rate to the $450 balance for one year.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much would a year of interest at 3.4% add to the $450 balance?',
            given: { savingsRate: 0.034 }, expr: 'round(#t1-p3 * savingsRate, 2)', format: 'usd', answer: '$15.30',
            reasoning: '3.4% of $450 is exactly $15.30.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much would the same balance earn in a year at the chequing rate of 0.05%?',
            given: { chequingRate: 0.0005 }, expr: 'round(#t1-p3 * chequingRate, 2)', format: 'usd', answer: '$0.23',
            reasoning: '0.05% of $450 is $0.225, which rounds to $0.23.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which incentive is larger for this saver in the first year?',
            choices: ['The deposit match', 'The 3.4% interest', 'They are about the same'],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t2-p1', ifTrue: 'The deposit match', ifFalse: 'The 3.4% interest' },
            answer: 'The deposit match',
            reasoning: 'The match is worth $150 against $15.30 of interest, so it is nearly ten times the size in the first year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Rank the three incentives in this scenario — the match, the 3.4% interest, and the 0.05% chequing interest — by how much each one should influence where the saver puts the money, and explain the ranking.',
            acceptableAnswerCriteria: [
              'Ranks the match first at $150, the savings interest second at $15.30, and the chequing rate last at $0.23.',
              'Explains that the match is a return of 50% on money deposited in the first year, which no ordinary interest rate approaches.',
              'Notes that the interest gap between the two accounts, about $15, is real but small next to the match, so the match is what should decide the choice.',
            ],
            evidenceRequirements: [
              'Uses all three computed figures — $150.00, $15.30, and $0.23 — in the ranking.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response compares the incentives against the $300 actually deposited rather than treating them as free-standing amounts.',
              'The response does not dismiss the interest as worthless; it is small here, not zero.',
            ],
            commonMisconception: 'Choosing a savings account by its interest rate when a match or other one-off incentive dwarfs the rate difference.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Name one condition in the fictional programme that would have to be checked before treating the $150 match as certain.',
            acceptableAnswerCriteria: [
              'Names a specific, checkable condition — a minimum term, a cap on the match, a withdrawal restriction, an eligibility rule, or what happens if a month is missed.',
              'States why that condition matters to the $150 figure specifically.',
            ],
            evidenceRequirements: [
              'Refers to the $150 match figure and to the 12-month deposit schedule the match is calculated on.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The condition named is one a saver could actually verify by reading the terms.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the match is being computed as 50% of the final balance rather than of deposits, restate the rule in the programme’s own words: the match is on everything deposited, and the deposits total $300. Compute the deposits first and hold that figure before applying the match.',
    extension: 'Work out what annual interest rate a plain savings account would need in order to add $150 to a $450 balance in one year, and say whether such a rate is plausible.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l02',
    grade: 9, unit: 3, day: 2,
    actor: 'a fictional household sorting its monthly costs',
    objective: 'Sort a fictional household’s costs into fixed, variable, and periodic, convert the periodic ones into monthly equivalents, and produce a monthly total the budget can actually be built on.',
    scenario: 'The nine costs below belong to a fictional household. Every figure is invented for this exercise and none describes a real household.',
    materials: ['calculator', 'the fictional cost list in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional costs. Paid every month at the same amount: rent $640, insurance $78, phone $45. Paid every month at a varying amount, shown here as recent averages: groceries $210, fuel $96, entertainment $60. Paid on a longer cycle: vehicle registration $148 once a year, dentist $95 twice a year, an annual software subscription $72 once a year.',
        items: [
          {
            ref: 't1-p1', kind: 'choice',
            text: 'Which of the nine costs is the clearest example of a periodic cost?',
            choices: ['Rent', 'Groceries', 'Vehicle registration', 'Phone'],
            answer: 'Vehicle registration',
            reasoning: 'Registration is paid once a year rather than every month, which is what makes a cost periodic; rent and phone are fixed monthly and groceries are variable monthly.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'A periodic cost has to be spread across the months before it can sit in a monthly budget. Round each monthly equivalent to the nearest cent.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of the $148 annual vehicle registration?',
            given: { registration: 148 }, expr: 'round(registration / 12, 2)', format: 'usd', answer: '$12.33',
            reasoning: '$148 spread over twelve months is $12.3333, which rounds to $12.33.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of two $95 dentist visits a year?',
            given: { dentist: 95 }, expr: 'round(dentist * 2 / 12, 2)', format: 'usd', answer: '$15.83',
            reasoning: '$190 a year spread over twelve months is $15.8333, which rounds to $15.83.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of the $72 annual subscription?',
            given: { subscription: 72 }, expr: 'subscription / 12', format: 'usd', answer: '$6.00',
            reasoning: '$72 over twelve months is exactly $6.00.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Now build the monthly total.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the three fixed costs come to each month?',
            given: { rent: 640, insurance: 78, phone: 45 }, expr: 'rent + insurance + phone', format: 'usd', answer: '$763.00',
            reasoning: 'Rent $640, insurance $78, and phone $45, all unchanged from month to month.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What do the three variable costs average each month?',
            given: { groceries: 210, fuel: 96, entertainment: 60 }, expr: 'groceries + fuel + entertainment', format: 'usd', answer: '$366.00',
            reasoning: 'The three recent averages: $210 groceries, $96 fuel, $60 entertainment.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the household’s full monthly cost, including the periodic costs at their monthly equivalents?',
            given: {}, expr: '#t3-p1 + #t3-p2 + #t2-p1 + #t2-p2 + #t2-p3', format: 'usd', answer: '$1,163.16',
            reasoning: '$763.00 fixed plus $366.00 variable plus $12.33, $15.83, and $6.00 of spread periodic costs.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'A budget that lists only the fixed and variable costs would show $1,129.00 a month. Explain what goes wrong in the month the $148 registration falls due, and what the household should do with the $34.16 of periodic money in the months it is not due.',
            acceptableAnswerCriteria: [
              'States that a budget omitting periodic costs looks balanced for eleven months and is short by $148 in the twelfth, when the bill arrives with nothing set aside for it.',
              'Explains that the $34.16 of monthly equivalents should be set aside rather than spent, so the money is there when the periodic bills fall due.',
              'Distinguishes this from an emergency: these bills are known in advance, so being surprised by them is a budgeting failure rather than bad luck.',
            ],
            evidenceRequirements: [
              'Uses the $1,163.16 full monthly figure against the $1,129.00 that omits periodic costs.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures'],
            lookFors: [
              'The response treats the set-aside as a holding place for money already committed, not as savings.',
              'The response does not classify the periodic costs as unpredictable.',
            ],
            commonMisconception: 'Treating a bill that arrives once a year as an unexpected expense.',
          },
        ],
      },
    ],
    remediation: 'If a periodic cost is being entered at its full amount in every month, ask what the household would have paid over a whole year under that budget: twelve payments of $148 for one annual registration. Divide first, then enter.',
    extension: 'Add a fictional $340 car repair that happens roughly every 18 months, compute its monthly equivalent, and say why that one is harder to budget than the registration.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l03',
    grade: 9, unit: 3, day: 3,
    actor: 'a fictional saver comparing two invented three-year accounts',
    objective: 'Compute simple and compound interest on the same fictional deposit over the same term and quantify the difference the compounding makes.',
    scenario: 'A fictional bank offers two simulated three-year accounts on a deposit of $1,400. Both quote 4.5% a year; they differ only in how the interest is applied. Both are invented for this exercise.',
    materials: ['calculator', 'the two fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Account S pays simple interest: 4.5% of the original $1,400 each year, paid out and not added to the balance. Account C compounds annually: each year the balance is multiplied by 1.045.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Account S pay over the 3 years?',
            given: { principal: 1400, rate: 0.045, years: 3 }, expr: 'principal * rate * years', format: 'usd', answer: '$189.00',
            reasoning: 'Simple interest applies the rate to the original principal each year: $1,400 x 4.5% x 3.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Including the deposit, what has Account S produced after 3 years?',
            given: { principal2: 1400 }, expr: 'principal2 + #t1-p1', format: 'usd', answer: '$1,589.00',
            reasoning: 'The original $1,400 plus $189.00 of simple interest.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now work Account C. Multiply by 1.045 once for each year.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the Account C balance after 3 years? Round to the nearest cent.',
            given: { principal3: 1400, growth: 1.045, years2: 3 }, expr: 'round(principal3 * pow(growth, years2), 2)', format: 'usd', answer: '$1,597.63',
            reasoning: '$1,400 x 1.045 x 1.045 x 1.045 is $1,597.6326, which rounds to $1,597.63.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest did Account C earn?',
            given: { principal4: 1400 }, expr: '#t2-p1 - principal4', format: 'usd', answer: '$197.63',
            reasoning: 'The $1,597.63 ending balance less the $1,400 deposited.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more did compounding earn than simple interest over the 3 years?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$8.63',
            reasoning: '$1,597.63 against $1,589.00 — the same quoted rate, the same term, and a difference of $8.63.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Account for where the extra came from.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Account C’s balance after just the first year?',
            given: { principal5: 1400, growth2: 1.045 }, expr: 'principal5 * growth2', format: 'usd', answer: '$1,463.00',
            reasoning: '$1,400 x 1.045, which is the same $63 of interest simple interest would pay in year one.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What interest does Account C earn in its second year alone?',
            given: { rate3: 0.045 }, expr: 'round(#t3-p1 * rate3, 2)', format: 'usd', answer: '$65.84',
            reasoning: '4.5% of the $1,463.00 balance, which is $2.84 more than the $63.00 simple interest pays in the same year because the first year’s interest is now earning too.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'short',
            text: 'Both accounts quote 4.5%. Explain in your own words where Account C’s extra $8.63 came from, and say whether that gap would grow or shrink over a longer term.',
            acceptableAnswerCriteria: [
              'Explains that compounding pays interest on interest already earned, which simple interest does not, using the second-year figures of $65.84 against $63.00.',
              'States that the gap grows over a longer term, because the base the rate is applied to keeps rising.',
            ],
            evidenceRequirements: [
              'Uses the year-one balance of $1,463.00 and the year-two interest of $65.84 to show the mechanism.',
            ],
            dimensions: ['reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response identifies the growing base as the mechanism, not a higher rate.',
              'The response notices the two accounts are identical in the first year.',
            ],
            commonMisconception: 'Believing a quoted rate tells you the return without knowing how often interest is applied.',
          },
        ],
      },
    ],
    remediation: 'If the compound balance is coming out identical to the simple one, check that the multiplication is being applied to the new balance each year rather than to $1,400 three times. Write the three balances in a column — $1,463.00, then that times 1.045, then that times 1.045 — before rounding anything.',
    extension: 'Extend both accounts to 10 years and state how the $8.63 gap changes, then say what that implies about the term over which compounding matters.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l04',
    grade: 9, unit: 3, day: 4,
    actor: 'a fictional saver leaving one deposit untouched for different lengths of time',
    objective: 'Compute what a single fictional deposit grows to over 5, 15, and 30 years at one rate, and describe how the growth is distributed across the term.',
    scenario: 'A fictional saver places $2,000 in a simulated account that grows 6% a year, compounded annually, and adds nothing further. The account and rate are invented for this exercise.',
    materials: ['calculator with a power function', 'the fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Each year the balance is multiplied by 1.06. Round each balance to the nearest cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after 5 years?',
            given: { deposit: 2000, growth: 1.06, y5: 5 }, expr: 'round(deposit * pow(growth, y5), 2)', format: 'usd', answer: '$2,676.45',
            reasoning: '$2,000 x 1.06 to the fifth power is $2,676.4512, which rounds to $2,676.45.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after 15 years?',
            given: { deposit2: 2000, growth2: 1.06, y15: 15 }, expr: 'round(deposit2 * pow(growth2, y15), 2)', format: 'usd', answer: '$4,793.12',
            reasoning: '$2,000 x 1.06 to the fifteenth power is $4,793.1164, which rounds to $4,793.12.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after 30 years?',
            given: { deposit3: 2000, growth3: 1.06, y30: 30 }, expr: 'round(deposit3 * pow(growth3, y30), 2)', format: 'usd', answer: '$11,486.98',
            reasoning: '$2,000 x 1.06 to the thirtieth power is $11,486.9825, which rounds to $11,486.98.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look at how the growth is spread across the term.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much did the balance grow during the first 15 years?',
            given: { deposit4: 2000 }, expr: '#t1-p2 - deposit4', format: 'usd', answer: '$2,793.12',
            reasoning: 'The 15-year balance of $4,793.12 less the original $2,000.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much did it grow during the second 15 years?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$6,693.86',
            reasoning: 'The 30-year balance of $11,486.98 less the 15-year balance of $4,793.12 — more than twice the growth of the first half.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total growth over the full 30 years?',
            given: { deposit5: 2000 }, expr: '#t1-p3 - deposit5', format: 'usd', answer: '$9,486.98',
            reasoning: '$11,486.98 less the $2,000 deposited, none of it from further contributions.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The second 15 years produced more than twice the growth of the first 15, at the same rate and with no further deposits. Explain why, and say what that implies for someone deciding whether to start saving now or in ten years.',
            acceptableAnswerCriteria: [
              'Explains that the rate applies to a balance that has already grown, so the same 6% moves a larger amount in later years.',
              'Uses the $2,793.12 and $6,693.86 figures to show the effect rather than asserting it.',
              'Draws the implication that delaying removes the years that carry the largest absolute growth, so the cost of waiting is larger than the delay looks.',
            ],
            evidenceRequirements: [
              'Cites at least two of the three balances ($2,676.45, $4,793.12, $11,486.98).',
            ],
            dimensions: ['reasoning-from-figures', 'transfer', 'communication-of-uncertainty'],
            lookFors: [
              'The response recognises the rate did not change; only the base did.',
              'A strong response notes that the 6% is assumed steady, which no real account guarantees, without abandoning the point.',
            ],
            commonMisconception: 'Expecting growth to be spread evenly across the years because the rate is constant.',
          },
        ],
      },
    ],
    remediation: 'If the 30-year figure is coming out near double the 15-year figure, the growth is being treated as if it added a fixed amount each year. Compute 1.06 to the fifth, then square that and multiply once more to reach year 15, and watch the multiplier itself grow.',
    extension: 'Compute what the same $2,000 would reach in 30 years at 4% instead of 6%, and say which mattered more here, the rate or the term.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l05',
    grade: 9, unit: 3, day: 5,
    actor: 'a fictional household stress-testing its reserve',
    objective: 'Express a fictional emergency reserve as months of essential spending, apply two simultaneous shocks to it, and re-measure what is left.',
    scenario: 'A fictional household keeps a simulated emergency reserve. Its essential monthly spending, its reserve, and the two shocks below are all invented for this exercise.',
    materials: ['calculator', 'the fictional household figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household spends $1,480 a month on essentials and holds a reserve of $3,700.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'months',
            text: 'How many months of essential spending does the reserve cover? Round to one decimal place.',
            given: { reserve: 3700, essentials: 1480 }, expr: 'round(reserve / essentials, 1)', format: 'dec1', answer: '2.5',
            reasoning: '$3,700 divided by $1,480 a month is exactly 2.5 months of essential spending.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now stress-test it. Two shocks land in the same month: a car repair of $620, and two weeks of lost income worth $740 that the household must cover from the reserve.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is left in the reserve after both shocks?',
            given: { reserve2: 3700, repair: 620, lostIncome: 740 }, expr: 'reserve2 - repair - lostIncome', format: 'usd', answer: '$2,340.00',
            reasoning: '$3,700 less the $620 repair and the $740 of income the household did not receive.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'How many months of essentials does the reserve now cover? Round to one decimal place.',
            given: { essentials2: 1480 }, expr: 'round(#t2-p1 / essentials2, 1)', format: 'dec1', answer: '1.6',
            reasoning: '$2,340 divided by $1,480 is 1.58 months, which rounds to 1.6.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much would the household have to add to get back to the original 2.5 months of cover?',
            given: {}, expr: '#t1-p1 * 1480 - #t2-p1', format: 'usd', answer: '$1,360.00',
            reasoning: '2.5 months of cover is $3,700, and the reserve now stands at $2,340.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'The household can put $170 a month toward rebuilding the reserve.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'months',
            text: 'How many months of $170 does it take to rebuild the reserve to $3,700? Round to the nearest month.',
            given: { rebuildRate: 170 }, expr: 'round(#t2-p3 / rebuildRate, 0)', format: 'months0', answer: '8',
            reasoning: '$1,360 at $170 a month takes exactly 8 months.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'If a second $620 repair happened during those 8 months, would the reserve still cover one full month of essentials at its lowest point?',
            choices: ['Yes, it would stay above one month of essentials', 'No, it would fall below one month of essentials'],
            given: { lowPoint: 2340, secondRepair: 620, oneMonth: 1480 },
            decision: { left: 'lowPoint - secondRepair', cmp: '>=', right: 'oneMonth', ifTrue: 'Yes, it would stay above one month of essentials', ifFalse: 'No, it would fall below one month of essentials' },
            answer: 'Yes, it would stay above one month of essentials',
            reasoning: 'Taken at the worst moment, before any rebuilding, $2,340 less $620 leaves $1,720, which still exceeds one month of essentials at $1,480.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Measuring a reserve in months rather than in dollars changes what it tells you. Explain the difference, and say what would happen to this household’s months of cover if its essential spending rose to $1,850 with the reserve unchanged at $2,340.',
            acceptableAnswerCriteria: [
              'Explains that months of cover measures the reserve against what the household actually needs, so the same dollars mean different things to different households.',
              'Computes or correctly estimates that $2,340 against $1,850 a month is about 1.3 months, down from 1.6.',
              'Notes that the reserve did not shrink; the requirement grew, which is a second way to lose cover.',
            ],
            evidenceRequirements: [
              'Uses the $2,340 reserve and both essential-spending figures, $1,480 and $1,850.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'transfer'],
            lookFors: [
              'The response treats months of cover as a ratio with two moving parts.',
              'The response does not confuse rising spending with spending more carelessly; the scenario does not say why it rose.',
            ],
            commonMisconception: 'Judging the adequacy of a reserve by its dollar size alone.',
          },
        ],
      },
    ],
    remediation: 'If months of cover is coming out as a dollar figure, name the units aloud: dollars divided by dollars-per-month leaves months. Check the first answer against a rough estimate — $1,480 twice is close to $3,000, so the answer must be a little over 2.',
    extension: 'Work out the reserve this household would need for a 6-month cover target, and say how long $170 a month takes to reach it from $2,340.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l06',
    grade: 9, unit: 3, day: 6,
    actor: 'a fictional budgeter comparing a plan with what actually happened',
    objective: 'Compute line-by-line variance between a fictional plan and a fictional month of actual spending, and read what the variances say that the totals hide.',
    scenario: 'The plan and the actual figures below come from one simulated month in a fictional household’s record. No real spending is described.',
    materials: ['calculator', 'the fictional plan-versus-actual table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Planned, then actual, for six lines. Groceries $240 planned, $287 actual. Fuel $90 planned, $76 actual. Eating out $60 planned, $128 actual. Phone $45 planned, $45 actual. Savings $150 planned, $0 actual. Miscellaneous $40 planned, $62 actual.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What was the total planned across all six lines?',
            given: { pg: 240, pf: 90, pe: 60, pp: 45, ps: 150, pm: 40 }, expr: 'pg + pf + pe + pp + ps + pm', format: 'usd', answer: '$625.00',
            reasoning: 'The six planned figures added: $240 + $90 + $60 + $45 + $150 + $40.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What was the total actual across all six lines?',
            given: { ag: 287, af: 76, ae: 128, ap: 45, as_: 0, am: 62 }, expr: 'ag + af + ae + ap + as_ + am', format: 'usd', answer: '$598.00',
            reasoning: 'The six actual figures added: $287 + $76 + $128 + $45 + $0 + $62.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much did the total actual come in under the total planned?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$27.00',
            reasoning: '$625.00 planned against $598.00 actual, which looks like a month that went well.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now go line by line. A variance is actual minus planned, so overspending is positive.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What was the variance on eating out?',
            given: { actualEat: 128, plannedEat: 60 }, expr: 'actualEat - plannedEat', format: 'usd', answer: '$68.00',
            reasoning: '$128 spent against $60 planned, the largest single overspend in the month.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'By what percentage did eating out exceed its plan? Round to one decimal place.',
            given: { plannedEat2: 60 }, expr: 'round(#t2-p1 / plannedEat2 * 100, 1)', format: 'percent1', answer: '113.3%',
            reasoning: '$68 over a $60 plan is 1.1333 times the plan, or 113.3% over.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What was the variance on savings?',
            given: { actualSave: 0, plannedSave: 150 }, expr: 'actualSave - plannedSave', format: 'usd', answer: '-$150.00',
            reasoning: 'Nothing was saved against a $150 plan, so the variance is negative $150 — the single largest variance of the month.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The month came in $27 under plan overall. Explain why that total is a misleading summary of this month, using at least two line variances.',
            acceptableAnswerCriteria: [
              'Identifies that the whole $27 underspend and more is explained by the $150 that was not saved, so the household spent more than planned on everything else.',
              'Uses at least two line variances, most naturally the $68 overspend on eating out and the -$150 savings variance.',
              'States that a savings line missed is not the same kind of event as a spending line missed, because it is the goal the plan existed to protect.',
            ],
            evidenceRequirements: [
              'Cites the $27 total underspend alongside at least two specific line variances.',
            ],
            dimensions: ['reasoning-from-figures', 'error-diagnosis', 'plan-coherence'],
            lookFors: [
              'The response notices that spending lines alone totalled $598 against $475 planned once savings is set aside.',
              'The response does not treat the $14 fuel underspend as offsetting the savings miss.',
            ],
            commonMisconception: 'Judging a month by whether the bottom line came in under plan.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Suggest one change to how this budget is written that would make the savings line harder to miss, and say what it would cost the household in flexibility.',
            acceptableAnswerCriteria: [
              'Proposes a concrete mechanism — moving the $150 out at the start of the month, a separate account, or treating savings as a fixed cost rather than a leftover.',
              'Names the flexibility cost honestly: the money is harder to reach in a month where spending genuinely has to rise.',
            ],
            evidenceRequirements: [
              'Refers to the $150 savings line and at least one overspent line as the reason the money went elsewhere.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence'],
            lookFors: [
              'The response does not present the change as costless.',
            ],
          },
        ],
      },
    ],
    remediation: 'If variances come out with the wrong sign, fix the convention before computing: actual minus planned, so spending more than planned is a positive number. Check against eating out, where $128 against $60 must give a positive $68.',
    extension: 'Rewrite the plan for the following month using this month’s actuals, keeping the $150 savings line intact, and state which line you cut to make it balance.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l07',
    grade: 9, unit: 3, day: 7,
    actor: 'a fictional student who concluded that saving is not worth it',
    objective: 'Find the error in a fictional argument that dismisses saving, recompute the figure correctly, and separate the return on savings from the savings themselves.',
    scenario: 'A fictional student wrote the argument below about a simulated savings account. The reasoning contains one specific mistake.',
    materials: ['the fictional argument as written in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional argument reads: "My account pays 4% a year. I can only put in $40 a month. So saving earns me 4% of $40, which is $1.60 a year. That is not worth doing." Assume interest is credited on the average balance across the year, which for level monthly deposits is about half the year-end total.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What figure did the fictional student compute, taking 4% of a single $40 deposit?',
            given: { deposit: 40, rate: 0.04 }, expr: 'round(deposit * rate, 2)', format: 'usd', answer: '$1.60',
            reasoning: 'This reproduces the student’s own arithmetic: 4% of $40 is $1.60, and the arithmetic is correct even though the quantity is the wrong one.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now compute what the year actually produces.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does the student deposit over 12 months at $40 a month?',
            given: { monthly: 40, months: 12 }, expr: 'monthly * months', format: 'usd', answer: '$480.00',
            reasoning: '$40 a month for twelve months, which is the student’s own money and is not interest at all.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Using the stated rule, how much interest does the account credit for the year?',
            given: { rate2: 0.04 }, expr: 'round(#t2-p1 / 2 * rate2, 2)', format: 'usd', answer: '$9.60',
            reasoning: 'The average balance is about half the $480 year-end total, and 4% of $240 is $9.60.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the account worth at the end of the year?',
            given: {}, expr: '#t2-p1 + #t2-p2', format: 'usd', answer: '$489.60',
            reasoning: '$480 deposited plus $9.60 credited.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Locate the mistake precisely.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'What did the fictional student’s calculation get wrong?',
            choices: [
              'The interest rate; 4% is not the right rate',
              'The base; the rate was applied to one month’s deposit instead of the balance',
              'The arithmetic; 4% of $40 is not $1.60',
              'Nothing; $1.60 is correct',
            ],
            answer: 'The base; the rate was applied to one month’s deposit instead of the balance',
            reasoning: 'The rate and the arithmetic are both right — 4% of $40 really is $1.60 — but the rate belongs on the accumulated balance, which reaches $480 by year end and averages about $240.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did the student’s figure understate the year’s interest?',
            given: {}, expr: '#t2-p2 - #t1-p1', format: 'usd', answer: '$8.00',
            reasoning: '$9.60 actually credited against the $1.60 the student computed.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Even at the corrected $9.60, the interest is small. Explain why the student’s conclusion is still wrong, distinguishing what the interest does from what the saving does.',
            acceptableAnswerCriteria: [
              'Separates the $480 the student put aside from the $9.60 the account added, and identifies the $480 as the main result of saving.',
              'States that the student judged the whole activity by the return on it, which is the wrong test when the balance itself is the point.',
              'Acknowledges honestly that $9.60 is a small return, so the argument does not depend on overstating the interest.',
            ],
            evidenceRequirements: [
              'Uses the $480 deposited and the $9.60 credited as two separate quantities.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response does not defend saving by inflating the interest figure.',
              'The response identifies having $489.60 available as the thing that changes what the saver can do.',
            ],
            commonMisconception: 'Judging whether to save by the size of the interest rather than by the balance accumulated.',
          },
        ],
      },
    ],
    remediation: 'If the corrected interest still looks like it should be $1.60, ask what the balance is in December under the student’s own plan. The rate is paid on money held, and by December $480 is being held, not $40.',
    extension: 'Recompute the year with the account paying 0.4% instead of 4%, and say whether the student’s conclusion becomes right at that rate.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l08',
    grade: 9, unit: 3, day: 8,
    actor: 'a fictional vehicle owner budgeting a single asset',
    objective: 'Apply the fixed, variable, and periodic classification to a fictional vehicle’s costs, reduce a four-year cost to a monthly figure, and identify which class of cost a shortfall should come out of.',
    scenario: 'A fictional owner keeps one simulated vehicle. The six costs below are invented for this exercise and describe no real vehicle.',
    materials: ['calculator', 'the fictional vehicle cost list in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional vehicle costs. Loan payment $219 every month. Insurance $612 a year, billed in two instalments. Fuel averages $88 a month. Registration $148 once a year. A set of tyres costs $640 and lasts 4 years. An oil change costs $62 and is done twice a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of the annual insurance?',
            given: { insurance: 612 }, expr: 'insurance / 12', format: 'usd', answer: '$51.00',
            reasoning: '$612 a year spread over twelve months is exactly $51.00, regardless of it being billed twice.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of a $640 set of tyres lasting 4 years?',
            given: { tyres: 640, tyreYears: 4 }, expr: 'round(tyres / (tyreYears * 12), 2)', format: 'usd', answer: '$13.33',
            reasoning: '$640 over 48 months is $13.3333, which rounds to $13.33.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of two $62 oil changes a year?',
            given: { oil: 62 }, expr: 'round(oil * 2 / 12, 2)', format: 'usd', answer: '$10.33',
            reasoning: '$124 a year over twelve months is $10.3333, which rounds to $10.33.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now build the full monthly figure.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of the $148 annual registration?',
            given: { registration: 148 }, expr: 'round(registration / 12, 2)', format: 'usd', answer: '$12.33',
            reasoning: '$148 over twelve months is $12.3333, which rounds to $12.33.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the vehicle cost per month in total?',
            given: { loan: 219, fuel: 88 }, expr: 'loan + fuel + #t1-p1 + #t1-p2 + #t1-p3 + #t2-p1', format: 'usd', answer: '$393.99',
            reasoning: '$219 loan + $88 fuel + $51.00 insurance + $13.33 tyres + $10.33 oil + $12.33 registration.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of that monthly total is fixed — the same every month regardless of use?',
            given: { loan2: 219 }, expr: 'loan2 + #t1-p1', format: 'usd', answer: '$270.00',
            reasoning: 'The $219 loan payment and the $51.00 monthly share of insurance do not move with how much the vehicle is driven.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The owner has a month where money is short by $60. Say which of the six vehicle costs can actually absorb that cut, which cannot, and what happens if the cut is taken from the wrong one.',
            acceptableAnswerCriteria: [
              'Identifies fuel, at $88 a month, as the only genuinely variable line, and therefore the only one that can absorb a cut by driving less.',
              'States that the loan and insurance are fixed obligations that cannot be reduced by choice in a single month, and explains the consequence of missing them.',
              'Explains that cutting the periodic set-asides — tyres, oil, registration, totalling $35.99 a month — does not remove the cost but moves it to the month the bill arrives.',
            ],
            evidenceRequirements: [
              'Uses at least three of the six monthly figures in the argument, including the $88 fuel line.',
            ],
            dimensions: ['transfer', 'plan-coherence', 'tradeoff-defense'],
            lookFors: [
              'The response treats skipping an oil change as deferring a cost with a possible larger cost later, not as a saving.',
              'The response applies the same three-way classification used for the household budget to a single asset.',
            ],
            commonMisconception: 'Treating a periodic set-aside as spare money because no bill is due this month.',
          },
        ],
      },
    ],
    remediation: 'If the total lands near $307 — the loan and fuel alone — the four costs that are not billed monthly have been dropped. List all six and mark which already arrive monthly; only two do, and the other four must be divided before they can join the total.',
    extension: 'Compute the total four-year cost of this vehicle from the monthly figure, then compare it with adding up all six costs over four years directly, and explain any difference.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l09',
    grade: 9, unit: 3, day: 9,
    actor: 'a fictional saver reviewing two invented six-year accounts',
    objective: 'Recompute simple against compound growth over a longer term, express the difference as a share of the deposit, and state the conditions under which the difference matters.',
    scenario: 'Two fictional six-year accounts hold $900 each and both quote 5% a year. One pays simple interest and one compounds annually. Both are invented for this exercise.',
    materials: ['calculator with a power function', 'the fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Account J pays 5% of the original $900 each year for 6 years and does not add it to the balance. Account K multiplies the balance by 1.05 each year for 6 years.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Account J pay over the 6 years?',
            given: { principal: 900, rate: 0.05, years: 6 }, expr: 'principal * rate * years', format: 'usd', answer: '$270.00',
            reasoning: '$900 x 5% x 6 years, with the base never changing.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Account K worth after 6 years? Round to the nearest cent.',
            given: { principal2: 900, growth: 1.05, years2: 6 }, expr: 'round(principal2 * pow(growth, years2), 2)', format: 'usd', answer: '$1,206.09',
            reasoning: '$900 x 1.05 to the sixth power is $1,206.0857, which rounds to $1,206.09.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare the two on the same basis.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Account J worth after 6 years, counting the deposit and the interest paid out?',
            given: { principal3: 900 }, expr: 'principal3 + #t1-p1', format: 'usd', answer: '$1,170.00',
            reasoning: 'The $900 deposit plus $270.00 of simple interest.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more did compounding produce over the 6 years?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$36.09',
            reasoning: '$1,206.09 against $1,170.00, at the same quoted rate over the same term.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The difference is what percentage of the original deposit? Round to one decimal place.',
            given: { principal4: 900 }, expr: 'round(#t2-p2 / principal4 * 100, 1)', format: 'percent1', answer: '4.0%',
            reasoning: '$36.09 on a $900 deposit is 0.0401, or 4.0% of the deposit accumulated over six years.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Over 3 years at 4.5% the compounding advantage on $1,400 was $8.63; here over 6 years at 5% on $900 it is $36.09. State the three things that drive how large that advantage gets, and say which one this pair of examples shows most clearly.',
            acceptableAnswerCriteria: [
              'Names the three drivers: the length of the term, the size of the rate, and the size of the balance.',
              'Identifies term as the driver these two examples show most clearly, since the deposit here is smaller and the rate barely higher, yet the advantage is more than four times larger.',
              'Avoids attributing the whole difference to the rate, which rose only from 4.5% to 5%.',
            ],
            evidenceRequirements: [
              'Compares the $8.63 figure from the earlier three-year example with the $36.09 figure here, noting the deposits differ.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response recognises that the smaller deposit makes the term effect stand out more, not less.',
              'The response does not claim compounding is always dramatic; over three years it was under $9.',
            ],
            commonMisconception: 'Believing compounding produces large gains at any term, when short terms leave it close to simple interest.',
          },
        ],
      },
    ],
    remediation: 'If Account K comes out below Account J, check that the multiplication is repeated six times rather than the rate being applied once. Compute 1.05 to the sixth power on its own first — it should be a little over 1.34 — and then multiply by $900.',
    extension: 'Find the term at which the compounding advantage on this $900 account first exceeds $100, and describe how you searched for it.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u03-l10',
    grade: 9, unit: 3, day: 10,
    actor: 'a fictional saver building a 12-month plan toward a stated goal',
    objective: 'Build a 12-month savings plan for a fictional goal, verify it reaches the target with interest, then repair it after a mid-year shock and defend the repair.',
    scenario: 'A fictional saver wants $1,800 in twelve months for a simulated goal. The account, the rate, and the shock below are all invented for this exercise.',
    materials: ['calculator', 'the fictional plan parameters in these directions', 'a blank 12-month schedule'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The plan: deposit $150 a month for 12 months. The fictional account credits 3.2% a year on the average balance, which for level monthly deposits is about $975 across this year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the twelve deposits total?',
            given: { monthly: 150, months: 12 }, expr: 'monthly * months', format: 'usd', answer: '$1,800.00',
            reasoning: '$150 a month for twelve months reaches the $1,800 target from deposits alone.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the year credit on an average balance of $975?',
            given: { avgBalance: 975, rate: 0.032 }, expr: 'round(avgBalance * rate, 2)', format: 'usd', answer: '$31.20',
            reasoning: '3.2% of $975 is exactly $31.20.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the plan finish with?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$1,831.20',
            reasoning: '$1,800 of deposits plus $31.20 of interest, which clears the goal with $31.20 to spare.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now the shock. In month 7, immediately after that month’s deposit, the saver must withdraw $400.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the deposit balance after 7 months, before the withdrawal and ignoring interest?',
            given: { monthly2: 150, sevenMonths: 7 }, expr: 'monthly2 * sevenMonths', format: 'usd', answer: '$1,050.00',
            reasoning: 'Seven monthly deposits of $150 each, before the month-7 withdrawal is applied.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is left immediately after the $400 withdrawal?',
            given: { withdrawal: 400 }, expr: '#t2-p1 - withdrawal', format: 'usd', answer: '$650.00',
            reasoning: '$1,050 less the $400 taken out in month 7.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'To still reach $1,800 in deposits by month 12, what must each of the remaining 5 monthly deposits become?',
            given: { goal: 1800, remainingMonths: 5 }, expr: 'round((goal - #t2-p2) / remainingMonths, 2)', format: 'usd', answer: '$230.00',
            reasoning: '$1,150 still needed across the last five months is exactly $230.00 a month, up from $150.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write up the repaired plan.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Present the repaired plan. State the new monthly deposit, say whether raising the deposit by $80 a month is the right repair or whether moving the goal date is better, and defend the choice.',
            acceptableAnswerCriteria: [
              'States the repaired deposit of $230.00 a month for the final five months and shows it reaches $1,800.',
              'Weighs the two repairs explicitly: a $80 monthly increase for five months against extending the deadline, and names what each costs.',
              'Grounds the choice in something specific — whether the goal has a fixed date, and whether $230 a month is affordable alongside the spending the original $150 plan already assumed.',
            ],
            evidenceRequirements: [
              'Uses the $650.00 post-shock balance and the $230.00 repaired deposit.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The response asks whether the higher deposit is affordable rather than assuming it is.',
              'A recommendation to move the date is fully acceptable if it says what that costs.',
            ],
            commonMisconception: 'Repairing a savings plan by raising the deposit without checking whether the higher amount fits the budget the plan came from.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The plan’s interest figure assumed an average balance of $975. Say why the $400 withdrawal makes that figure wrong, and in which direction.',
            acceptableAnswerCriteria: [
              'States that the withdrawal lowers the balance for part of the year, so the average balance falls below $975 and the interest credited will be less than $31.20.',
              'Notes the direction of the error explicitly rather than only saying the figure changes.',
            ],
            evidenceRequirements: [
              'Refers to the $975 average-balance assumption and the $400 withdrawal in month 7.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response recognises the raised deposits partly offset the withdrawal, so the effect is smaller than $400 would suggest.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the repaired deposit is coming out as $360, the $1,800 goal is being divided by the five remaining months without crediting the $650 already saved. Write the sentence first — $1,800 needed, $650 already there, five months left — and then divide what remains.',
    extension: 'Rebuild the plan assuming the saver can manage only $190 a month after the shock, find the month the goal would then be reached, and say what that costs in delay.',
  },
]
