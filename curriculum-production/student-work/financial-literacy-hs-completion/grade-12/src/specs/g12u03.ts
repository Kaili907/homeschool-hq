import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 3 — PF3 Budgeting and Saving: Running the Adult Budget.
 *
 * The senior move is that a budget is operated rather than drawn up. Grade 9
 * builds a monthly plan that balances; grade 12 runs one across months where
 * income arrives out of step with obligations, where a category quietly
 * absorbs every variance, and where an expense that is not monthly makes a
 * plan that balances on paper fail in the year. Reserves, debt, and a
 * retirement election all compete for the same surplus, so allocation
 * questions here have more than one defensible answer and are scored as such.
 */
export const g12u03: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u03-l01',
    grade: 12, unit: 3, day: 1,
    actor: 'a fictional adult three months into a running budget',
    objective: 'Operate a fictional budget across three months, accumulate the variance the variable categories produce, and report the surplus that actually exists rather than the one that was planned.',
    scenario: 'The budget and the three months of spending below belong to a fictional adult. Every figure is invented for this exercise.',
    materials: ['calculator', 'the fictional budget and monthly totals in these directions'],
    domains: ['budgeting', 'banking', 'saving-investing', 'income'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional adult takes home $3,240 a month. The fixed commitments are rent $1,180, utilities $165, insurance $142, phone $58, and transport $210. The plan allows $480 for food, $120 for household, and $200 for personal spending, and sets aside $350 for savings. Across the first three months the variable categories actually came to $862, $774, and $918.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the fixed commitments come to each month?',
            given: { rent: 1180, utilities: 165, insurance: 142, phone: 58, transport: 210 },
            expr: 'rent + utilities + insurance + phone + transport', format: 'usd', answer: '$1,755.00',
            reasoning: 'The five commitments that do not change month to month. Separating these from the variable categories is what makes a variance meaningful: only the variable half can move.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the plan allocate in total each month, savings included?',
            given: { food: 480, household: 120, personal: 200, savings: 350 },
            expr: '#t1-p1 + food + household + personal + savings', format: 'usd', answer: '$2,905.00',
            reasoning: '$1,755.00 of fixed commitments, $800.00 of planned variable spending, and $350 of savings. Savings is allocated here rather than left as a remainder, which is what makes it possible to see later whether the plan held.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What monthly surplus does the plan expect?',
            given: { netIncome: 3240 }, expr: 'netIncome - #t1-p2', format: 'usd', answer: '$335.00',
            reasoning: '$3,240 of take-home pay less the $2,905.00 allocated. This is what should be left over each month if nothing moves.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now run the plan forward against what actually happened over the 3 months.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What did the variable categories actually cost across the three months?',
            given: { m1: 862, m2: 774, m3: 918 }, expr: 'm1 + m2 + m3', format: 'usd', answer: '$2,554.00',
            reasoning: 'The three actual monthly totals added. Looking at the run rather than a single month is what separates an unusual month from a plan that is set too low.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What did the plan allow for those categories over the same three months?',
            given: { food2: 480, household2: 120, personal2: 200 }, expr: '(food2 + household2 + personal2) * 3', format: 'usd', answer: '$2,400.00',
            reasoning: '$800.00 a month across 3 months.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the cumulative variance after three months?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$154.00',
            reasoning: '$2,554.00 actual against $2,400.00 planned. One month came in under and two came in over, and only the running total shows which way the plan is drifting.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What surplus has actually accumulated across the three months?',
            given: {}, expr: '#t1-p3 * 3 - #t2-p3', format: 'usd', answer: '$851.00',
            reasoning: 'Three months of the planned $335.00 surplus, less the $154.00 the variable categories overran. The planned figure would have been $1,005.00.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The plan expected $1,005.00 of surplus after three months and produced $851.00. Say whether these three months show a plan that is set too low or a run of ordinary variation, explain what in the figures supports your reading, and state what you would need to see to be more certain.',
            acceptableAnswerCriteria: [
              'Reads the pattern rather than the total: two months over by $62.00 and $118.00 and one month under by $26.00, so the overruns are both larger and more frequent than the underrun.',
              'Reaches a defensible conclusion — that the $800.00 allowance looks slightly low, or that three months is too short a run to distinguish a low allowance from ordinary variation — and ties it to the figures rather than asserting it.',
              'States what would settle it: more months of the same pattern, or knowing whether any of the three months contained something one-off that will not repeat.',
            ],
            evidenceRequirements: [
              'Uses the $154.00 cumulative variance and at least two of the individual monthly figures against the $800.00 monthly allowance.',
            ],
            dimensions: ['communication-of-uncertainty', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response distinguishes the direction of the drift from its size.',
              'Either conclusion is credited when the response says what evidence would change it; a confident verdict from three months without that caveat is not.',
            ],
            commonMisconception: 'Treating a single month over budget as proof the plan is wrong, or a single month under as proof it is working.',
          },
        ],
      },
    ],
    remediation: 'If the accumulated surplus comes out at $1,005.00, the variance has not been carried into it. The plan produces $335.00 a month only if the variable categories land on $800.00; they came to $2,554.00 rather than $2,400.00 over the three months, so $154.00 of the expected surplus has already been spent.',
    extension: 'Rewrite the variable allowance so that it would have covered all three months as they actually happened, and say what has to be reduced elsewhere to keep the same $350 of savings.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l02',
    grade: 12, unit: 3, day: 2,
    actor: 'a fictional worker whose income arrives irregularly against fixed monthly obligations',
    objective: 'Establish that a fictional irregular income covers its obligations in total, find the month in which it does not, and size the buffer that timing alone requires.',
    scenario: 'The simulated six-month income record below belongs to a fictional worker paid per project. Every figure is invented for this exercise.',
    materials: ['calculator', 'the fictional income record in these directions'],
    domains: ['income', 'budgeting', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Over 6 months the fictional worker received $1,850, $4,320, $900, $3,780, $2,640, and $4,110. Fixed obligations are $2,470 every month and fall due whether or not a payment has arrived.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What did the 6 months bring in altogether?',
            given: { m1: 1850, m2: 4320, m3: 900, m4: 3780, m5: 2640, m6: 4110 },
            expr: 'm1 + m2 + m3 + m4 + m5 + m6', format: 'usd', answer: '$17,600.00',
            reasoning: 'The six payments added. This is the figure that decides whether the work pays enough; it says nothing about whether the bills can be met on time.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the average monthly income across the 6 months?',
            given: {}, expr: 'round(#t1-p1 / 6, 2)', format: 'usd', answer: '$2,933.33',
            reasoning: '$17,600.00 spread evenly across 6 months. No month actually delivered this amount, which is the limitation of planning from an average.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the fixed obligations come to over the same 6 months?',
            given: { fixed: 2470 }, expr: 'fixed * 6', format: 'usd', answer: '$14,820.00',
            reasoning: '$2,470 in each of the 6 months, due on schedule regardless of when income arrives.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find the month the average conceals.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What surplus did the 6 months produce in total?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$2,780.00',
            reasoning: '$17,600.00 received against $14,820.00 owed. On the whole period the income is more than adequate.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'In the weakest month, income was $900. What was the position in that month alone?',
            given: { lowMonth: 900, fixed2: 2470 }, expr: 'lowMonth - fixed2', format: 'usd', answer: '-$1,570.00',
            reasoning: '$900 received against $2,470 due. The negative figure is the point: a period that is comfortably in surplus overall still contains a month that cannot pay its bills.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much must be held in reserve to carry that month without borrowing?',
            given: {}, expr: 'abs(#t2-p2)', format: 'usd', answer: '$1,570.00',
            reasoning: 'The size of the shortfall, held in advance. This buffer is not saving toward anything; it exists solely because income and obligations are out of step.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Across the whole 6 months, is the income sufficient to meet the obligations?',
            choices: ['Yes — but only if the timing is bridged', 'No — the income falls short over the period'],
            decision: { left: '#t1-p1', cmp: '>', right: '#t1-p3', ifTrue: 'Yes — but only if the timing is bridged', ifFalse: 'No — the income falls short over the period' },
            answer: 'Yes — but only if the timing is bridged',
            reasoning: '$17,600.00 against $14,820.00 leaves $2,780.00 over. Sufficiency and solvency are different questions, and this income record answers them differently.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This income is sufficient over 6 months and insufficient in month 3. Explain why an average of $2,933.33 is a misleading basis for planning here, and describe how you would run this budget so that month 3 is survivable — naming what your method requires the worker to do in a strong month.',
            acceptableAnswerCriteria: [
              'Explains the flaw in the average: it describes a month that never occurred, and obligations fall due monthly while income does not arrive monthly, so the gap is a timing problem the average cannot express.',
              'Describes a method that holds back money in strong months — for example paying a fixed monthly amount to the household from a separate holding account and leaving the rest to accumulate — and names $1,570.00 as the minimum the buffer must reach before month 3.',
              'States what the method requires in a strong month: treating the $4,320 or $4,110 as partly reserved rather than available, which is a discipline the arithmetic alone will not enforce.',
            ],
            evidenceRequirements: [
              'Uses the $2,780.00 six-month surplus and the $1,570.00 month-3 shortfall, and refers to at least one strong month by amount.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response separates whether the income is enough from whether it arrives in time.',
              'The response names where the buffer is held, rather than assuming it stays untouched in a general account.',
            ],
            commonMisconception: 'Planning irregular income from its average, which hides every month in which the money has not yet arrived.',
          },
        ],
      },
    ],
    remediation: 'If the conclusion is that this worker cannot afford their obligations, compare the totals: $17,600.00 received against $14,820.00 due. The income is adequate. Now compare month 3 alone: $900 against $2,470. Both statements are true, and the second one is about timing rather than adequacy.',
    extension: 'Work out the buffer needed if the two weakest months fell consecutively, and say how much larger the reserve would have to be than the $1,570.00 found here.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l03',
    grade: 12, unit: 3, day: 3,
    actor: 'a fictional household deciding how large a reserve should be',
    objective: 'Size a fictional emergency reserve on two different bases, measure the existing reserve against each, and set a contribution that closes the gap over a stated period.',
    scenario: 'The fictional household’s costs and existing reserve below are invented for this exercise.',
    materials: ['calculator', 'the fictional cost breakdown in these directions'],
    domains: ['saving-investing', 'budgeting', 'insurance-risk', 'debt'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household’s essential monthly costs are rent $1,285, utilities $180, food $520, insurance $165, transport $240, and minimum debt payments $310. Beyond those it spends $640 a month on things it could stop. It currently holds $4,860 in reserve and wants to reach a 3-month target within 18 months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the essential monthly costs come to?',
            given: { rent: 1285, utilities: 180, food: 520, insurance: 165, transport: 240, minDebt: 310 },
            expr: 'rent + utilities + food + insurance + transport + minDebt', format: 'usd', answer: '$2,700.00',
            reasoning: 'The six costs that continue whatever happens to income. The minimum debt payments belong here because missing them has consequences beyond the month, not because the debt could not eventually be renegotiated.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is a 3-month reserve sized on essential costs?',
            given: {}, expr: '#t1-p1 * 3', format: 'usd', answer: '$8,100.00',
            reasoning: '3 months of the $2,700.00 essential figure. This assumes a household under strain stops the spending it can stop.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is a 3-month reserve sized on total spending instead?',
            given: { nonEssential: 640 }, expr: '(#t1-p1 + nonEssential) * 3', format: 'usd', answer: '$10,020.00',
            reasoning: '3 months of the full $3,340.00 the household actually spends. This assumes life continues unchanged through the emergency.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure where the household stands and what it would take to close the gap.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much do the two targets differ by?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$1,920.00',
            reasoning: '$10,020.00 against $8,100.00 — three months of the $640 of discretionary spending. The choice of base, not the choice of months, produces this difference.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'How many months of essential costs does the current $4,860 reserve cover? Give one decimal place.',
            given: { reserve: 4860 }, expr: 'round(reserve / #t1-p1, 1)', format: 'dec1', answer: '1.8',
            reasoning: '$4,860 divided by the $2,700.00 essential monthly figure. Stating a reserve in months rather than dollars is what makes it comparable across households.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What monthly contribution reaches the essential-cost target within the 18 months?',
            given: { reserve2: 4860, horizon: 18 }, expr: 'round((#t1-p2 - reserve2) / horizon, 2)', format: 'usd', answer: '$180.00',
            reasoning: 'The $3,240.00 still needed, spread across 18 months. Setting the period first and deriving the contribution is what turns a target into something a budget can act on.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Argue for sizing this household’s reserve on the $2,700.00 essential figure or on the $3,340.00 total figure. Use the figures, name what your choice assumes about how the household would behave during an emergency, and say which assumption is the weaker one.',
            acceptableAnswerCriteria: [
              'Argues one base on the figures — for example that the $8,100.00 target is reachable at $180.00 a month within the stated 18 months while the $10,020.00 target is not, or that the higher target is safer because a household in difficulty rarely cuts $640 of spending immediately.',
              'Names the behavioural assumption behind the chosen base: the lower target assumes discretionary spending actually stops, and the higher target assumes it does not need to.',
              'Identifies the weaker assumption and says why — most defensibly, that cutting $640 a month in the first month of a crisis is harder than a spreadsheet makes it look, so the essential-cost target has less margin than it appears.',
            ],
            evidenceRequirements: [
              'Uses the $8,100.00 and $10,020.00 targets and the 1.8 months the current reserve covers.',
            ],
            dimensions: ['assumption-identification', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the base as the real decision, rather than debating the number of months.',
              'Either target is credited when the assumption behind it is named and examined.',
            ],
            commonMisconception: 'Treating "three months of expenses" as a single well-defined figure, when the base it is three months of changes the target by $1,920.00 here.',
          },
        ],
      },
    ],
    remediation: 'If the two targets come out the same, the $640 of discretionary spending is being included in both or excluded from both. Build the essential figure from the six costs that continue regardless, then add the $640 separately to build the total figure. The gap between the two targets is exactly three months of that $640.',
    extension: 'Work out how long the current $4,860 reserve would last if the household cut only half of its discretionary spending during an emergency, and compare that with the 1.8 months found here.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l04',
    grade: 12, unit: 3, day: 4,
    actor: 'a fictional household choosing between clearing a balance and building a reserve',
    objective: 'Price the interest consequence of splitting a fictional household’s surplus between a card balance and a reserve, and weigh the measurable cost against the protection it buys.',
    scenario: 'The fictional household, the simulated card balance, and the rate applied to it below are invented for this exercise. Nothing here recommends a course of action for any real borrower.',
    materials: ['calculator', 'the fictional balance and budget figures in these directions'],
    domains: ['debt', 'credit', 'saving-investing', 'budgeting'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household has $420 a month available after everything else is paid. It carries a simulated card balance of $3,800 charged at 21.6% a year, applied as one twelfth of that rate each month before the payment is credited. Its reserve currently holds $600. Under the split plan, $210 goes to the card and $210 to the reserve.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What interest is charged on the balance in the first month?',
            given: { balance: 3800, apr: 0.216 }, expr: 'round(balance * apr / 12, 2)', format: 'usd', answer: '$68.40',
            reasoning: 'One twelfth of 21.6% applied to $3,800. The stated order matters: interest is charged on the balance before the payment is credited, which is how a card statement is normally built.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'If the whole $420 goes to the card, what is the balance after one month?',
            given: { balance2: 3800, allToDebt: 420 }, expr: 'balance2 + #t1-p1 - allToDebt', format: 'usd', answer: '$3,448.40',
            reasoning: '$3,800 plus $68.40 of interest less the $420 payment.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Under the split plan, what is the balance after one month?',
            given: { balance3: 3800, splitToDebt: 210 }, expr: 'balance3 + #t1-p1 - splitToDebt', format: 'usd', answer: '$3,658.40',
            reasoning: 'The same interest charge, against a payment of $210 rather than $420. The interest is identical in month one because it is charged before either payment lands.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what the split actually costs, which does not appear until the second month.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much higher is the balance under the split plan after one month?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$210.00',
            reasoning: '$3,658.40 against $3,448.40 — exactly the $210 that went to the reserve instead. After one month the split has cost nothing in interest; it has only moved money.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What interest is charged in the second month if the whole $420 went to the card?',
            given: { apr2: 0.216 }, expr: 'round(#t1-p2 * apr2 / 12, 2)', format: 'usd', answer: '$62.07',
            reasoning: 'One twelfth of 21.6% applied to the reduced $3,448.40 balance.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What interest is charged in the second month under the split plan?',
            given: { apr3: 0.216 }, expr: 'round(#t1-p3 * apr3 / 12, 2)', format: 'usd', answer: '$65.85',
            reasoning: 'The same rate applied to the higher $3,658.40 balance.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the split cost in extra interest in the second month?',
            given: {}, expr: '#t2-p3 - #t2-p2', format: 'usd', answer: '$3.78',
            reasoning: '$65.85 against $62.07. This is the entire measurable cost of the split in month two, and it is what the $210 of reserve has to be worth more than.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Splitting the surplus costs this fictional household $3.78 in the second month and puts $210 into a reserve that holds only $600. Argue for either the split or the all-to-debt plan on these figures, and state plainly what your argument cannot prove.',
            acceptableAnswerCriteria: [
              'Argues one plan on the figures — for instance that $3.78 is a small price for moving the reserve from $600 toward something usable, or that at 21.6% the balance is the more expensive problem and clearing it faster ends the interest sooner.',
              'Notes the scale honestly: the measurable cost of the split is small in the early months, and it grows as the two balances diverge, so the comparison is not fixed.',
              'States the limit of the argument: whether $210 of reserve is worth $3.78 depends on how likely this household is to face an expense it would otherwise put back on the card at 21.6%, which the figures given cannot establish.',
            ],
            evidenceRequirements: [
              'Uses the $3.78 second-month cost and the $600 starting reserve, and refers to the 21.6% rate.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises that a reserve exists partly to prevent new borrowing at the same rate.',
              'Either plan is credited; the response is scored on whether the cost is priced and the uncertainty named, not on which plan it prefers.',
            ],
            commonMisconception: 'Assuming that paying the highest-rate balance first is always right, without pricing what happens when an unplanned expense arrives and there is no reserve to meet it.',
          },
        ],
      },
    ],
    remediation: 'If the split appears to cost $210.00 in interest, the difference in balances is being read as an interest charge. The $210.00 is money moved to the reserve, not money lost. The interest cost of the split is the difference between the two second-month charges, $65.85 against $62.07, which is $3.78.',
    extension: 'Carry both plans forward to the third month and say whether the monthly cost of the split is growing, shrinking, or steady, and why.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l05',
    grade: 12, unit: 3, day: 5,
    actor: 'a fictional household rebuilding a savings plan after one month went wrong',
    objective: 'Recalculate a fictional annual savings plan after a month that produced nothing, add the cost of restoring a drawn-down reserve, and state the total monthly commitment the recovery now requires.',
    scenario: 'The fictional household, its savings target, and the simulated repair that interrupted it are invented for this exercise.',
    materials: ['calculator', 'the fictional savings plan and event in these directions'],
    domains: ['budgeting', 'saving-investing', 'insurance-risk', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household set out to save $3,600 across the year at $300 a month. It saved $300 in each of the first 4 months. In month 5 a simulated vehicle repair of $940 meant nothing was saved and $340 was taken from the reserve. That leaves 7 months of the year remaining.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much had been saved by the end of month 4?',
            given: { monthlyPlan: 300 }, expr: 'monthlyPlan * 4', format: 'usd', answer: '$1,200.00',
            reasoning: '$300 in each of the first 4 months, exactly as planned. Month 5 added nothing, so this is also the position entering month 6.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the annual target is still outstanding?',
            given: { annualTarget: 3600 }, expr: 'annualTarget - #t1-p1', format: 'usd', answer: '$2,400.00',
            reasoning: 'The $3,600 target less the $1,200.00 banked. The month-5 interruption cost the plan $300 of progress and no more; the reserve drawdown is a separate problem.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now work out what finishing the year on target actually requires.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What must be saved each month across the remaining 7 months to reach the target?',
            given: {}, expr: 'round(#t1-p2 / 7, 2)', format: 'usd', answer: '$342.86',
            reasoning: '$2,400.00 spread across the 7 months left. Holding the target fixed and shortening the time is what raises the monthly figure.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more per month is that than the original plan?',
            given: { monthlyPlan2: 300 }, expr: '#t2-p1 - monthlyPlan2', format: 'usd', answer: '$42.86',
            reasoning: '$342.86 against the original $300. A single missed month raises the monthly requirement for every month that follows.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the $340 taken from the reserve is also replaced across the same 7 months, what does that add each month?',
            given: { reserveUsed: 340 }, expr: 'round(reserveUsed / 7, 2)', format: 'usd', answer: '$48.57',
            reasoning: '$340 spread across the 7 remaining months. Replacing the reserve is a real obligation, and a recovery plan that ignores it leaves the household less protected than it started.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the total monthly commitment for the rest of the year?',
            given: {}, expr: 'round(#t2-p1 + #t2-p3, 2)', format: 'usd', answer: '$391.43',
            reasoning: '$342.86 toward the savings target plus $48.57 to restore the reserve — $91.43 a month more than the plan the household was managing before month 5.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Holding the $3,600 target fixed pushes the monthly commitment to $391.43. Set out one alternative that keeps the household’s monthly figure closer to $300, say precisely what it gives up, and explain which of the two you would put to this household first.',
            acceptableAnswerCriteria: [
              'Describes a concrete alternative — lowering the annual target to what $300 a month can still deliver, extending the target date beyond the year, or replacing the reserve first and resuming the savings target afterwards.',
              'States exactly what the alternative gives up, in figures: for example holding $300 a month for the remaining 7 months reaches $3,300 rather than $3,600, leaving the target $300 short.',
              'Makes a recommendation and justifies it, recognising that a plan the household cannot sustain at $391.43 delivers less than a smaller plan it can hold to.',
            ],
            evidenceRequirements: [
              'Uses the $391.43 total commitment and the original $300 monthly plan, and quantifies what the alternative sacrifices.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The alternative is priced rather than only named.',
              'The response treats the reserve replacement as an obligation to be scheduled, not as optional.',
            ],
            commonMisconception: 'Recovering a missed month by keeping both the target and the deadline fixed, without checking whether the resulting monthly figure is one the household can actually meet.',
          },
        ],
      },
    ],
    remediation: 'If the required monthly figure comes out at $300, the recovery is being spread across 12 months rather than the 7 that remain. Only 7 months are left, and $2,400.00 of the target is outstanding. Divide by 7, then add the reserve replacement separately rather than folding it into the same figure.',
    extension: 'Recompute the monthly commitment if the household decides to replace the reserve over 12 months instead of 7, and say what that choice costs in protection during the intervening months.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l06',
    grade: 12, unit: 3, day: 6,
    actor: 'a fictional household reconciling a completed year of budgeting',
    objective: 'Compare a fictional household’s planned and actual savings rates across a year in which income rose, and establish where the additional income actually went.',
    scenario: 'The planned and actual year compared below belong to a fictional household. Every figure, including the simulated bonus, is invented for this exercise.',
    materials: ['calculator', 'the fictional annual plan and outturn in these directions'],
    domains: ['budgeting', 'saving-investing', 'income', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household planned on take-home income of $46,800 for the year, spending of $42,600, and savings of $4,200. It actually took home $47,940, including a simulated bonus, spent $44,388, and saved $3,552.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What savings rate did the plan set, to two decimal places?',
            given: { plannedSavings: 4200, plannedIncome: 46800 }, expr: 'round(plannedSavings / plannedIncome * 100, 2)', format: 'percent2', answer: '8.97%',
            reasoning: '$4,200 measured against $46,800 of planned income. Expressing savings as a rate is what allows a year with different income to be compared with the plan at all.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What savings rate did the year actually deliver, to two decimal places?',
            given: { actualSavings: 3552, actualIncome: 47940 }, expr: 'round(actualSavings / actualIncome * 100, 2)', format: 'percent2', answer: '7.41%',
            reasoning: '$3,552 measured against the $47,940 actually received. The rate fell even though income rose, which is the finding the dollar figures alone would obscure.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more income did the year bring than the plan assumed?',
            given: { actualIncome2: 47940, plannedIncome2: 46800 }, expr: 'actualIncome2 - plannedIncome2', format: 'usd', answer: '$1,140.00',
            reasoning: '$47,940 against $46,800 planned. This is money the plan never allocated, so nothing in the plan decided where it went.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now trace where the extra income ended up.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more did the household spend than it planned?',
            given: { actualSpending: 44388, plannedSpending: 42600 }, expr: 'actualSpending - plannedSpending', format: 'usd', answer: '$1,788.00',
            reasoning: '$44,388 against $42,600 planned.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did savings fall short of the plan?',
            given: { plannedSavings2: 4200, actualSavings2: 3552 }, expr: 'plannedSavings2 - actualSavings2', format: 'usd', answer: '$648.00',
            reasoning: '$3,552 saved against $4,200 planned. The shortfall is exactly the amount by which the overspend exceeded the extra income.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What proportion of the extra income did the additional spending come to, to two decimal places?',
            given: {}, expr: 'round(#t2-p1 / #t1-p3 * 100, 2)', format: 'percent2', answer: '156.84%',
            reasoning: '$1,788.00 of extra spending against $1,140.00 of extra income. A figure above 100% is the point: spending rose by more than the whole of the additional income.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Did any part of the additional income reach savings?',
            choices: ['Yes — savings rose alongside income', 'No — savings finished below plan despite the extra income'],
            decision: { left: '#t2-p1', cmp: '>', right: '#t1-p3', ifTrue: 'No — savings finished below plan despite the extra income', ifFalse: 'Yes — savings rose alongside income' },
            answer: 'No — savings finished below plan despite the extra income',
            reasoning: 'Spending rose $1,788.00 against $1,140.00 of extra income, so the extra income was absorbed entirely and $648.00 more was taken from savings on top of it.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Income rose by $1,140.00 and savings fell by $648.00. Explain how a household can end a better-than-planned year with less saved than it planned, and name one change to how the plan handles unexpected income that would have produced a different result.',
            acceptableAnswerCriteria: [
              'Explains the mechanism: the plan allocated the expected $46,800 but had no rule for the additional $1,140.00, so it defaulted into spending, and savings remained the residual that absorbed the rest.',
              'Uses the rate comparison to show the year was worse than the plan on the measure that matters: 7.41% actual against 8.97% planned, even though the dollar income was higher.',
              'Names a concrete change — for example a standing rule that a fixed share of any unplanned income is transferred to savings on receipt, or moving the $4,200 to a scheduled transfer at the start of each month so it is not available to spend.',
            ],
            evidenceRequirements: [
              'Uses the 8.97% and 7.41% savings rates and the $1,140.00 of extra income.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'error-diagnosis'],
            lookFors: [
              'The response identifies the absence of a rule as the cause, rather than describing the household as undisciplined.',
              'The response uses the rate rather than the dollar amount to judge whether the year improved.',
            ],
            commonMisconception: 'Judging a year by whether income rose, when the savings rate can fall at the same time and is the measure the plan was actually set in.',
          },
        ],
      },
    ],
    remediation: 'If the year looks like a success because income was $1,140.00 above plan, compare the savings rates rather than the income. The plan set 8.97% and the year delivered 7.41%. Then check where the extra went: spending rose $1,788.00, which is more than the extra income, and the difference came out of savings.',
    extension: 'Work out what the savings rate would have been had the household spent exactly its planned $42,600, and say how much of the improvement comes from the bonus rather than from any change in behaviour.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l07',
    grade: 12, unit: 3, day: 7,
    actor: 'a fictional household whose monthly budget balances but whose year does not',
    objective: 'Locate why a fictional budget that shows a monthly surplus produces an annual deficit, convert the missing expenses to their monthly equivalent, and state the correction.',
    scenario: 'The fictional household’s monthly budget and its list of simulated irregular expenses below are invented for this exercise.',
    materials: ['calculator', 'the fictional budget and irregular expense list in these directions'],
    domains: ['budgeting', 'insurance-risk', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household’s monthly budget shows a surplus of $180 and includes every expense that arrives monthly. It does not include four expenses that arrive on other schedules: auto insurance of $612 charged twice a year, a registration and licensing charge of $285 once a year, holiday costs of $900 once a year, and routine medical costs of $420 once a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the four irregular expenses come to across a year?',
            given: { autoIns: 612, registration: 285, holidays: 900, medical: 420 },
            expr: 'autoIns * 2 + registration + holidays + medical', format: 'usd', answer: '$2,829.00',
            reasoning: 'Two insurance charges of $612 plus the three annual items. None appears anywhere in a budget built from a single month, because none of them falls in every month.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly equivalent of those expenses?',
            given: {}, expr: 'round(#t1-p1 / 12, 2)', format: 'usd', answer: '$235.75',
            reasoning: '$2,829.00 spread across the 12 months. This is the amount the budget should have been reserving each month and was not.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the household’s true monthly position once that is included?',
            given: { statedSurplus: 180 }, expr: 'statedSurplus - #t1-p2', format: 'usd', answer: '-$55.75',
            reasoning: 'The reported $180 surplus less the $235.75 of irregular expenses it omits. The budget does not have a small margin; it runs at a deficit.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now express the same error across the whole year.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What annual surplus does the budget as written imply?',
            given: { statedSurplus2: 180 }, expr: 'statedSurplus2 * 12', format: 'usd', answer: '$2,160.00',
            reasoning: '$180 in each of the 12 months. This is what the household believes it will have accumulated by year end.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the actual annual position?',
            given: {}, expr: '#t2-p1 - #t1-p1', format: 'usd', answer: '-$669.00',
            reasoning: '$2,160.00 of apparent surplus against $2,829.00 of expenses the budget never counted. The year ends $669.00 down rather than $2,160.00 up.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much must monthly spending fall for the year to break even?',
            given: {}, expr: 'round(abs(#t2-p2) / 12, 2)', format: 'usd', answer: '$55.75',
            reasoning: 'The $669.00 annual shortfall spread across 12 months, which is exactly the size of the monthly deficit found earlier. Correcting the budget and correcting the year are the same adjustment expressed two ways.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This budget is arithmetically correct and still wrong. Name the error precisely, explain why it would feel like it was working for most of the year, and describe the change that fixes it rather than merely detecting it.',
            acceptableAnswerCriteria: [
              'Names the error precisely: the budget covers a month rather than a year, so every expense that does not arrive monthly is invisible to it, and the $180 surplus is measured against an incomplete list of costs.',
              'Explains the experience: in the 7 or 8 months with no irregular expense the budget appears to work exactly as written, and it only fails in the months when the $612, $900, $285, or $420 lands.',
              'Describes the fix rather than the diagnosis: reserve $235.75 each month into a separate holding account so the irregular expenses are already funded when they arrive, and treat the resulting deficit as a spending problem to be solved rather than a rounding issue.',
            ],
            evidenceRequirements: [
              'Uses the $235.75 monthly equivalent and the -$669.00 annual position, and refers to at least one of the individual irregular expenses.',
            ],
            dimensions: ['error-diagnosis', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response identifies the planning horizon as the error, not the arithmetic.',
              'The fix names where the reserved money is held, so it is not spent before the expense arrives.',
            ],
            commonMisconception: 'Believing a budget is complete because every line in it is accurate, when the expenses that never appear in a single month are the ones that break the year.',
          },
        ],
      },
    ],
    remediation: 'If the annual position comes out as $2,160.00, the four irregular expenses have not been brought in. Total them to $2,829.00 first — remembering the insurance is charged twice — and set that against the apparent annual surplus. The monthly equivalent, $235.75, is larger than the $180 surplus, which is why the year finishes negative.',
    extension: 'List the months in which each irregular expense falls and work out the largest single-month shortfall the household would face, then say how that differs from the $55.75 monthly average correction.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l08',
    grade: 12, unit: 3, day: 8,
    actor: 'a fictional two-earner household with one seasonal income and a tax set-aside',
    objective: 'Carry the irregular-income method onto a fictional household where one income stops for part of the year and part of it is owed in tax, and size the buffer the off-season requires.',
    scenario: 'The fictional household, the simulated seasonal work, and the invented self-employment set-aside rate below exist only for this exercise.',
    materials: ['calculator', 'the fictional household income and cost figures in these directions'],
    domains: ['income', 'taxes', 'budgeting', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'One fictional earner works seasonally, receiving $2,100 a month for 8 months of the year and nothing for the other 4 months. Under the fictional rules that apply to this work, 18% of that pay must be set aside for tax and is not available to spend. The other earner takes home $2,380 every month all year. The household’s fixed costs are $3,150 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the seasonal earner receive across the year?',
            given: { seasonalMonthly: 2100, seasonalMonths: 8 }, expr: 'seasonalMonthly * seasonalMonths', format: 'usd', answer: '$16,800.00',
            reasoning: '$2,100 in each of the 8 working months. None of it arrives in the remaining 4.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of that must be set aside for tax at 18%?',
            given: { setAsideRate: 0.18 }, expr: '#t1-p1 * setAsideRate', format: 'usd', answer: '$3,024.00',
            reasoning: '18% of the $16,800.00. Because no employer withholds it, this money arrives in the household’s account and still is not theirs to spend.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the seasonal work actually contribute to the household after the set-aside?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$13,776.00',
            reasoning: '$16,800.00 received less $3,024.00 that belongs to the tax bill. Budgeting from the $16,800.00 would overstate the household’s income by more than $3,000.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the household against the year and against its worst months.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the household’s spendable income for the year?',
            given: { steadyMonthly: 2380 }, expr: '#t1-p3 + steadyMonthly * 12', format: 'usd', answer: '$42,336.00',
            reasoning: '$13,776.00 from the seasonal work after its set-aside plus $28,560.00 from the steady income.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do the fixed costs come to across the year?',
            given: { fixedMonthly: 3150 }, expr: 'fixedMonthly * 12', format: 'usd', answer: '$37,800.00',
            reasoning: '$3,150 in each of the 12 months, whether or not the seasonal earner is working.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What surplus does the year produce?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$4,536.00',
            reasoning: '$42,336.00 of spendable income against $37,800.00 of fixed costs. On an annual view the household is comfortable.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly position in an off-season month?',
            given: { steadyMonthly2: 2380, fixedMonthly2: 3150 }, expr: 'steadyMonthly2 - fixedMonthly2', format: 'usd', answer: '-$770.00',
            reasoning: 'Only the steady $2,380 arrives, against $3,150 of costs. The annual surplus does nothing to help in the month itself.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What must be held in reserve to carry all 4 off-season months?',
            given: { offMonths: 4 }, expr: 'abs(#t2-p4) * offMonths', format: 'usd', answer: '$3,080.00',
            reasoning: '$770.00 of shortfall in each of the 4 months. This buffer is separate from the $3,024.00 tax set-aside, and confusing the two would leave the household short of both.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This household must hold two separate pools of money that it is not free to spend. Name them with their amounts, explain why keeping them separate matters, and describe how much of the seasonal earner’s $2,100 monthly pay is genuinely available to the household in a working month.',
            acceptableAnswerCriteria: [
              'Names both pools with figures: $3,024.00 set aside for the tax bill and $3,080.00 held to bridge the 4 off-season months.',
              'Explains why they must not be pooled: the tax money is owed to someone else and spending it during the off-season creates a bill the household cannot meet, so a single combined balance will look adequate right up to the point it is not.',
              'Computes or reasons to the available portion of the seasonal pay: $2,100 less the $378.00 tax set-aside is $1,722.00, and part of that must also go toward the off-season buffer, so materially less than $2,100 is genuinely spendable in a working month.',
            ],
            evidenceRequirements: [
              'Uses the $3,024.00 tax set-aside and the $3,080.00 off-season buffer, and refers to the -$770.00 monthly off-season position.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response keeps the two reserves distinct rather than adding them into one target.',
              'The response recognises that the annual surplus of $4,536.00 is barely larger than the two reserves together.',
            ],
            commonMisconception: 'Treating money that has arrived in an account as money the household owns, when part of it is a tax liability and part is next quarter’s living costs.',
          },
        ],
      },
    ],
    remediation: 'If the household looks comfortable throughout, check the off-season months on their own. The annual surplus is $4,536.00, but in each of the 4 months without seasonal pay only $2,380 arrives against $3,150 of costs. Compute the monthly position first, then multiply by the number of months it persists.',
    extension: 'Work out what happens to both reserves if the seasonal work shortens to 7 months at the same monthly rate, and say which of the two grows faster.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l09',
    grade: 12, unit: 3, day: 9,
    actor: 'a fictional household reviewing a reserve that was used twice in one year',
    objective: 'Track a fictional emergency reserve through a year of contributions and two withdrawals, express the closing balance in months of cover, and judge whether the reserve did its job.',
    scenario: 'The fictional reserve, the two simulated emergencies, and the contributions below are invented for this exercise.',
    materials: ['calculator', 'the fictional reserve record in these directions'],
    domains: ['saving-investing', 'insurance-risk', 'budgeting', 'debt'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household began the year with $7,200 in reserve, against essential costs of $2,400 a month. It contributed $260 in each of the 10 months in which nothing went wrong. In month 3 it withdrew $1,850 and in month 8 it withdrew $2,640, and contributed nothing in either of those months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What was contributed to the reserve across the year?',
            given: { contribution: 260 }, expr: 'contribution * 10', format: 'usd', answer: '$2,600.00',
            reasoning: '$260 in each of the 10 months without a withdrawal. The two interrupted months contributed nothing, which is realistic: the month an emergency lands is rarely a month with spare money in it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What was withdrawn across the year?',
            given: { event1: 1850, event2: 2640 }, expr: 'event1 + event2', format: 'usd', answer: '$4,490.00',
            reasoning: 'The two withdrawals added. Both were met from the reserve rather than by borrowing, which is the outcome the reserve exists to produce.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What did the reserve hold at the end of the year?',
            given: { opening: 7200 }, expr: 'opening + #t1-p1 - #t1-p2', format: 'usd', answer: '$5,310.00',
            reasoning: 'The $7,200 opening balance plus $2,600.00 contributed less $4,490.00 withdrawn.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now judge the closing position against what the reserve is for.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'How many months of essential costs does the closing balance cover? Give two decimal places.',
            given: { essential: 2400 }, expr: 'round(#t1-p3 / essential, 2)', format: 'dec2', answer: '2.21',
            reasoning: '$5,310.00 against $2,400 of essential monthly costs. The reserve started the year at exactly 3 months of cover.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How far below the original 3-month position does the year end?',
            given: { opening2: 7200 }, expr: 'opening2 - #t1-p3', format: 'usd', answer: '$1,890.00',
            reasoning: '$7,200 at the start against $5,310.00 at the end. The contributions replaced most but not all of what the two emergencies took.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'At $260 a month, how many months would it take to restore the reserve to $7,200? Give one decimal place.',
            given: { contribution2: 260 }, expr: 'round(#t2-p2 / contribution2, 1)', format: 'dec1', answer: '7.3',
            reasoning: 'The $1,890.00 gap at the existing contribution rate. This assumes no further withdrawal during those months, which the year just completed suggests is optimistic.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The reserve fell from 3 months of cover to 2.21 months across the year. Decide whether this reserve worked or failed, defend your answer with the figures, and say what the two withdrawals suggest about whether $260 a month is the right contribution.',
            acceptableAnswerCriteria: [
              'Makes the case that it worked: $4,490.00 of unplanned costs were met without borrowing, which is precisely what the reserve is for, and a reserve that is never drawn down is not doing its job.',
              'Makes the case that the position weakened: cover fell by 0.79 months, and restoring it would take 7.3 clear months during which another withdrawal is quite possible given that two occurred this year.',
              'Draws a conclusion about the contribution rate from the evidence: $2,600.00 contributed against $4,490.00 withdrawn means the reserve loses ground in a year with two events, so $260 a month is adequate only in quieter years.',
            ],
            evidenceRequirements: [
              'Uses the 2.21 months of closing cover, the $4,490.00 withdrawn, and the $2,600.00 contributed.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response judges the reserve against its purpose rather than against whether the balance rose.',
              'Either verdict is credited when it is argued from the contribution and withdrawal figures together.',
            ],
            commonMisconception: 'Reading a fall in a reserve balance as a failure, when absorbing an unplanned cost without borrowing is exactly the outcome the reserve was built for.',
          },
        ],
      },
    ],
    remediation: 'If the closing balance comes out at $5,570.00, contributions have been counted for all 12 months. The household contributed in only the 10 months without a withdrawal, so the year added $2,600.00 rather than $3,120.00. Apply the contributions and the two withdrawals to the $7,200 opening balance in turn.',
    extension: 'Work out what contribution rate would have held the reserve at $7,200 across this year, and say what else in the household budget would have to give to fund it.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u03-l10',
    grade: 12, unit: 3, day: 10,
    actor: 'a fictional household with one surplus and three competing claims on it',
    objective: 'Quantify all three claims on a fictional household’s monthly surplus — an employer retirement contribution, a card balance, and a reserve — and produce a defended allocation of the whole amount.',
    scenario: 'The fictional household, its simulated card balance, and the invented employer contribution terms below exist only for this exercise. Nothing here advises any real person about their own borrowing or saving.',
    materials: ['calculator', 'the fictional household figures in these directions'],
    domains: ['budgeting', 'debt', 'credit', 'saving-investing', 'income', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household has $640 a month of surplus. It carries a simulated card balance of $4,200 charged at 22.8% a year, applied as one twelfth of that rate each month. Its reserve holds $900 against essential costs of $2,850 a month. The employer adds 50% of whatever the worker contributes to retirement, up to the first 4% of a $54,000 salary.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What interest does the card balance attract in one month?',
            given: { cardBalance: 4200, cardApr: 0.228 }, expr: 'round(cardBalance * cardApr / 12, 2)', format: 'usd', answer: '$79.80',
            reasoning: 'One twelfth of 22.8% on $4,200. This is what the balance costs the household every month it is carried.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the largest employer retirement contribution available in a year?',
            given: { salary: 54000, matchTier: 0.04, matchShare: 0.5 }, expr: 'salary * matchTier * matchShare', format: 'usd', answer: '$1,080.00',
            reasoning: '50% of the first 4% of the $54,000 salary. It is available only if the worker contributes; nothing arrives automatically.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What monthly contribution earns the full employer amount?',
            given: { salary2: 54000, matchTier2: 0.04 }, expr: 'round(salary2 * matchTier2 / 12, 2)', format: 'usd', answer: '$180.00',
            reasoning: '4% of $54,000 spread across the 12 months. Contributing more than this is still saving but earns nothing further from the employer.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now size the other two claims and see what is left once the employer contribution is secured.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is a 3-month reserve target on essential costs?',
            given: { essential: 2850 }, expr: 'essential * 3', format: 'usd', answer: '$8,550.00',
            reasoning: '3 months of the $2,850 essential figure.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How far short of that target is the reserve?',
            given: { reserve: 900 }, expr: '#t2-p1 - reserve', format: 'usd', answer: '$7,650.00',
            reasoning: '$8,550.00 target against $900 held. At any plausible contribution this gap takes years, which is itself a finding.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the $180.00 retirement contribution is made first, what surplus remains?',
            given: { surplus: 640 }, expr: 'surplus - #t1-p3', format: 'usd', answer: '$460.00',
            reasoning: '$640 of surplus less the $180.00 that secures the full $1,080.00 employer contribution.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If that whole $460.00 went to the card, what would the balance be after one month?',
            given: { cardBalance2: 4200 }, expr: 'cardBalance2 + #t1-p1 - #t2-p3', format: 'usd', answer: '$3,819.80',
            reasoning: '$4,200 plus $79.80 of interest less a $460.00 payment.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Put the retirement contribution on a comparable footing before deciding anything.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'The employer adds $1,080.00 on a worker contribution of $2,160.00 a year. What is that as a percentage of what the worker puts in?',
            given: { salary3: 54000, matchTier3: 0.04 }, expr: 'round(#t1-p2 / (salary3 * matchTier3) * 100, 2)', format: 'percent2', answer: '50.00%',
            reasoning: '$1,080.00 measured against the $2,160.00 the worker contributes. It is a one-time addition on money contributed, not an annual rate of return, and it should not be compared directly with the 22.8% charged on the card.',
          },
          {
            ref: 't3-p2', kind: 'numeric',
            text: 'At $460.00 a month, how many months would clear the $4,200 balance if no further interest were charged? Give one decimal place.',
            given: { cardBalance3: 4200 }, expr: 'round(cardBalance3 / #t2-p3, 1)', format: 'dec1', answer: '9.1',
            reasoning: '$4,200 at $460.00 a month, ignoring interest as the prompt states. Because interest continues, the real figure is somewhat higher, so this is a floor rather than a schedule.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write the allocation. Every dollar of the $640 must be accounted for.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Allocate the whole $640 a month across the three claims and defend it. State what your allocation gives up, and name the claim you would fund differently if the household told you its income was uncertain for the next year.',
            acceptableAnswerCriteria: [
              'Allocates the full $640 across the three claims with a figure against each, and shows the parts add to $640 rather than leaving a remainder undescribed.',
              'Defends the treatment of the retirement contribution with the figures: $180.00 a month secures $1,080.00 a year, which is a 50.00% addition to money contributed and is not available later if skipped.',
              'Defends the balance between the card and the reserve using both the $79.80 monthly interest and the $7,650.00 reserve gap, rather than asserting one is more important.',
              'States what the allocation sacrifices — for example that prioritising the card leaves the reserve near $900 for months, or that funding the reserve leaves the balance attracting close to $79.80 a month for longer.',
              'Names what would change under uncertain income and why, most defensibly shifting toward the reserve because a household with no reserve meets the next shock by borrowing at 22.8%.',
            ],
            evidenceRequirements: [
              'Uses the $180.00 contribution that secures the employer amount, the $79.80 monthly card interest, and the $7,650.00 reserve shortfall.',
              'Shows the allocation summing to the full $640.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The response does not compare the 50.00% employer addition directly with the 22.8% annual rate as though both were annual returns.',
              'Several allocations are defensible — securing the employer contribution and splitting the rest, or clearing the card first and building the reserve after — and each is credited when the sacrifice is named.',
              'An allocation that skips the employer contribution entirely is credited only if it says explicitly what the $1,080.00 is being given up for.',
            ],
            commonMisconception: 'Ranking the three claims by their headline percentages alone, when a 50.00% addition on contributions, a 22.8% annual charge, and an unquantified protection against future borrowing are not the same kind of number.',
          },
        ],
      },
    ],
    remediation: 'If the allocation treats the employer contribution as a 50% return to be compared with the 22.8% card rate, stop and check what each figure measures. The card rate is charged every year the balance is carried; the employer contribution is a single addition to whatever is put in during that year. Compute what each is worth in dollars over the coming twelve months — $1,080.00 against roughly $957 of interest on the current balance — before ranking them.',
    extension: 'Rework the allocation for a fictional household with the same $640 surplus but no employer contribution available at all, and say which of the two remaining claims changes most.',
  },
]
