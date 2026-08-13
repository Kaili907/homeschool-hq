import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 7 — PF7 Paying Taxes: Taxes, Take-Home Pay, and Your First
 * Forms. Eleven lessons, matching the source unit's eleven days.
 *
 * Every tax schedule in this unit is a simplified fictional schedule stated in
 * the lesson itself. No lesson asks a learner to compute a real tax liability
 * or to use any real figure from their own or their household's return.
 */
export const g09u07: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u07-l01',
    grade: 9, unit: 7, day: 1,
    actor: 'a fictional worker counting every tax they pay in a simulated year',
    objective: 'Compute five different taxes a fictional worker pays in one simulated year and express the total as a share of income.',
    scenario: 'A fictional worker earns $38,400 in a simulated year. Every tax rate below belongs to this invented example and is not a real published rate.',
    materials: ['calculator', 'the fictional tax schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional federal schedule charges 10% on the first $11,600 of income and 12% on everything above that. Payroll tax is 7.65% of all income. State income tax is 4.25% and city income tax is 1%. The worker also pays 6% sales tax on $14,000 of taxable purchases.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the federal income tax under this fictional schedule?',
            given: { income: 38400, bracket: 11600, lowRate: 0.1, highRate: 0.12 },
            expr: 'bracket * lowRate + (income - bracket) * highRate', format: 'usd', answer: '$4,376.00',
            reasoning: '10% of the first $11,600 is $1,160, and 12% of the remaining $26,800 is $3,216 — only the income above the threshold is taxed at the higher rate.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the payroll tax at 7.65% of all income?',
            given: { income2: 38400, payrollRate: 0.0765 }, expr: 'income2 * payrollRate', format: 'usd', answer: '$2,937.60',
            reasoning: '7.65% of the full $38,400, with no threshold applied.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What are the state and city income taxes together?',
            given: { income3: 38400, stateRate: 0.0425, cityRate: 0.01 }, expr: 'income3 * stateRate + income3 * cityRate', format: 'usd', answer: '$2,016.00',
            reasoning: '4.25% is $1,632.00 and 1% is $384.00, both charged on the full income.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the sales tax on $14,000 of taxable purchases at 6%?',
            given: { purchases: 14000, salesRate: 0.06 }, expr: 'purchases * salesRate', format: 'usd', answer: '$840.00',
            reasoning: '6% of $14,000, a tax on spending rather than on income.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now total them and measure against income.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of all five taxes?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3 + #t1-p4', format: 'usd', answer: '$10,169.60',
            reasoning: '$4,376.00 federal + $2,937.60 payroll + $2,016.00 state and city + $840.00 sales.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage of income does the total represent? Round to one decimal place.',
            given: { income4: 38400 }, expr: 'round(#t2-p1 / income4 * 100, 1)', format: 'percent1', answer: '26.5%',
            reasoning: '$10,169.60 against $38,400 of income is 0.26483, or 26.5%.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which single tax is the largest for this fictional worker?',
            choices: ['Federal income tax', 'Payroll tax', 'State income tax', 'Sales tax'],
            given: {},
            decision: { left: '#t1-p1', cmp: '>', right: '#t1-p2', ifTrue: 'Federal income tax', ifFalse: 'Payroll tax' },
            answer: 'Federal income tax',
            reasoning: '$4,376.00 of federal income tax against $2,937.60 of payroll tax, though at lower incomes the ranking commonly reverses.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Only two of these five taxes appear on a pay stub as a deduction. Name which ones do not, and explain why a worker asking "how much tax do I pay?" would understate the answer by reading their stub alone.',
            acceptableAnswerCriteria: [
              'Identifies sales tax as the clearest example of a tax paid outside the stub, at $840.00 here, and notes it is paid a little at a time on purchases.',
              'Explains that a stub shows amounts withheld from that employer’s pay, not the worker’s whole tax position.',
              'Uses the totals to show the size of the understatement rather than describing it in general terms.',
            ],
            evidenceRequirements: [
              'Cites the $840.00 sales tax figure and the $10,169.60 total.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response treats the pay stub as an accurate document that answers a narrower question.',
              'The response does not claim the taxes are hidden.',
            ],
            commonMisconception: 'Equating the deductions on a pay stub with everything a person pays in tax.',
          },
        ],
      },
    ],
    remediation: 'If the federal tax comes out near $4,608, the 12% rate is being applied to the whole $38,400. Under this fictional schedule the first $11,600 is taxed at 10% no matter how much is earned above it; compute the two pieces separately before adding.',
    extension: 'Recompute all five taxes for a fictional worker earning $19,000 with $8,000 of taxable purchases, and say which tax becomes the largest.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l02',
    grade: 9, unit: 7, day: 2,
    actor: 'a fictional worker changing their withholding',
    objective: 'Show how a fictional change in withholding moves take-home pay without changing the tax owed, and compute the refund or bill each setting produces.',
    scenario: 'A fictional worker earns $3,100 a month and can set withholding at either of two simulated rates. The tax actually owed for the year is stated below and does not change with the setting.',
    materials: ['calculator', 'the fictional withholding figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Monthly gross is $3,100. Setting A withholds 16% of gross; Setting B withholds 12%. The tax actually owed for the whole year is $4,900 under either setting.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is monthly take-home pay under Setting A?',
            given: { gross: 3100, rateA: 0.16 }, expr: 'gross - gross * rateA', format: 'usd', answer: '$2,604.00',
            reasoning: '$3,100 less 16% withheld, which is $496.00.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is monthly take-home pay under Setting B?',
            given: { gross2: 3100, rateB: 0.12 }, expr: 'gross2 - gross2 * rateB', format: 'usd', answer: '$2,728.00',
            reasoning: '$3,100 less 12% withheld, which is $372.00.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does Setting B put in the worker’s hands each month?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$124.00',
            reasoning: 'Setting B’s $2,728.00 take-home against Setting A’s $2,604.00, a difference of exactly the 4% not withheld.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look at the whole year and settle up against the $4,900 owed.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld over the year under Setting A?',
            given: { gross3: 3100, rateA2: 0.16 }, expr: 'gross3 * rateA2 * 12', format: 'usd', answer: '$5,952.00',
            reasoning: '$496.00 a month for twelve months.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What refund or bill does Setting A produce against the $4,900 owed?',
            given: { owed: 4900 }, expr: '#t2-p1 - owed', format: 'usd', answer: '$1,052.00',
            reasoning: '$5,952.00 withheld against $4,900 owed leaves a $1,052.00 refund.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld over the year under Setting B, and how does it compare with the $4,900 owed? Give the shortfall.',
            given: { gross4: 3100, rateB2: 0.12, owed2: 4900 }, expr: 'owed2 - gross4 * rateB2 * 12', format: 'usd', answer: '$436.00',
            reasoning: '$4,464.00 withheld against $4,900 owed leaves $436.00 still to pay at filing.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The two settings produce a $1,052 refund and a $436 bill, and the tax owed is $4,900 either way. Explain what withholding actually changes, and say which setting you would argue for and on what grounds.',
            acceptableAnswerCriteria: [
              'States that withholding changes only the timing of payment, not the amount owed, which stays at $4,900.',
              'Describes the tradeoff concretely: Setting A gives $1,052 back once a year, Setting B gives $124 a month during the year but requires $436 available at filing.',
              'Argues for one setting on stated grounds — the value of money during the year against the risk of not having the $436 ready — rather than calling a refund good or bad in itself.',
            ],
            evidenceRequirements: [
              'Uses the $124 monthly difference, the $1,052 refund, and the $436 bill.',
            ],
            dimensions: ['reasoning-from-figures', 'tradeoff-defense', 'plan-coherence'],
            lookFors: [
              'The response does not describe the refund as money gained.',
              'The response treats having $436 available at filing as a real requirement of Setting B.',
            ],
            commonMisconception: 'Treating a tax refund as a bonus rather than as the return of money withheld in excess.',
          },
        ],
      },
    ],
    remediation: 'If the refund and the bill both appear to change the tax owed, write $4,900 at the top of the page and leave it there through both calculations. Withholding is a series of payments toward that one figure, and the settling-up at filing is the difference.',
    extension: 'Find the withholding rate that would produce neither a refund nor a bill on this income, and say why hitting it exactly is difficult in practice.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l03',
    grade: 9, unit: 7, day: 3,
    actor: 'a fictional filer reading a simulated W-2 and 1099-NEC',
    objective: 'Read two fictional tax forms, verify the withheld amounts against the stated rates, and identify what the second form does not do that the first does.',
    scenario: 'The two simulated forms below belong to a fictional filer. Every box figure is invented for this exercise and no real form or filer is described.',
    materials: ['calculator', 'the fictional form summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional W-2 reports wages of $41,250 in box 1 and federal income tax withheld of $3,890 in box 2. Social Security is withheld at 6.2% of wages and Medicare at 1.45%, and both appear on the same form.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What Social Security amount should appear on the fictional W-2?',
            given: { wages: 41250, ssRate: 0.062 }, expr: 'round(wages * ssRate, 2)', format: 'usd', answer: '$2,557.50',
            reasoning: '6.2% of $41,250, which a filer can check against the printed box rather than take on trust.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What Medicare amount should appear?',
            given: { wages2: 41250, medRate: 0.0145 }, expr: 'round(wages2 * medRate, 2)', format: 'usd', answer: '$598.13',
            reasoning: '1.45% of $41,250 is $598.125, which rounds to $598.13.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do all three withheld amounts on the W-2 come to?',
            given: { federalWithheld: 3890 }, expr: 'federalWithheld + #t1-p1 + #t1-p2', format: 'usd', answer: '$7,045.63',
            reasoning: '$3,890 of federal income tax plus $2,557.50 of Social Security plus $598.13 of Medicare.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The same fictional filer also received a 1099-NEC reporting $2,800 of self-employed work with nothing withheld. Under the simplified fictional rule used here, self-employment tax is 15.3% of that amount.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What self-employment tax does the $2,800 generate under this fictional rule?',
            given: { selfEmployed: 2800, seRate: 0.153 }, expr: 'round(selfEmployed * seRate, 2)', format: 'usd', answer: '$428.40',
            reasoning: '15.3% of $2,800, an amount nobody withheld on the filer’s behalf.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'What is the main practical difference between the two forms for this filer?',
            choices: [
              'The W-2 reports income and the 1099-NEC does not',
              'Tax was withheld on the W-2 income and no tax was withheld on the 1099-NEC income',
              'The 1099-NEC income is not taxable',
              'The W-2 income is not reported to the tax authority',
            ],
            answer: 'Tax was withheld on the W-2 income and no tax was withheld on the 1099-NEC income',
            reasoning: 'Both forms report income to the filer and to the tax authority; only the W-2 shows amounts already paid in, which is why the 1099-NEC income can produce an unexpected bill.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s total income across both forms?',
            given: { wages3: 41250, selfEmployed2: 2800 }, expr: 'wages3 + selfEmployed2', format: 'usd', answer: '$44,050.00',
            reasoning: '$41,250 of wages plus $2,800 of self-employed income.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A filer with only W-2 income and a filer with 1099-NEC income face the same tax rules but very different experiences at filing time. Explain why, and describe what the second filer should do during the year that the first need not.',
            acceptableAnswerCriteria: [
              'Explains that W-2 income arrives with tax already paid in — $7,045.63 here — while the $2,800 of 1099-NEC income arrives with nothing withheld.',
              'States that the second filer owes at least the $428.40 of self-employment tax plus income tax on the same amount, all due at filing unless paid in advance.',
              'Names the practical step: setting money aside during the year, or making estimated payments, rather than discovering the amount at filing.',
            ],
            evidenceRequirements: [
              'Uses the $7,045.63 total withheld and the $428.40 self-employment tax.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'reasoning-from-figures'],
            lookFors: [
              'The response does not suggest the 1099-NEC income escapes tax.',
              'The response identifies the absence of withholding as the difference, not a difference in the rules.',
            ],
            commonMisconception: 'Assuming income arrives with tax already handled because that is how a first job worked.',
          },
        ],
      },
    ],
    remediation: 'If the three W-2 amounts are being added to the wages rather than subtracted from them, note what box 1 is: total wages before withholding. The three withheld amounts come out of that figure, they do not add to it.',
    extension: 'Work out roughly what the fictional filer should set aside from each $100 of 1099-NEC income to cover both self-employment tax and 12% income tax, and say why that estimate should be rounded up.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l04',
    grade: 9, unit: 7, day: 4,
    actor: 'a fictional filer comparing a credit with a deduction',
    objective: 'Compute the value of a fictional tax credit against a fictional deduction of the same face amount, and state the rule that explains the gap.',
    scenario: 'A fictional filer with a 12% marginal rate is told they qualify for either a $1,200 credit or a $1,200 deduction, but not both. Both are invented for this exercise.',
    materials: ['calculator', 'the fictional credit and deduction terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A credit reduces the tax owed dollar for dollar. A deduction reduces the income the tax is charged on. The filer’s marginal rate is 12%, and the fictional credit is not refundable but the filer owes more than $1,200 in tax.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much does the $1,200 credit reduce the tax owed?',
            given: { credit: 1200 }, expr: 'credit', format: 'usd', answer: '$1,200.00',
            reasoning: 'A credit comes off the tax itself, so its face value and its value to the filer are the same here.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does the $1,200 deduction reduce the tax owed?',
            given: { deduction: 1200, marginalRate: 0.12 }, expr: 'deduction * marginalRate', format: 'usd', answer: '$144.00',
            reasoning: 'The deduction removes $1,200 from taxed income, and at a 12% marginal rate that saves 12% of $1,200.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more is the credit worth than the deduction?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$1,056.00',
            reasoning: '$1,200.00 against $144.00, from two amounts that look identical on the page.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Test how the comparison moves with the marginal rate.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What would the same deduction be worth to a filer with a 24% marginal rate?',
            given: { deduction2: 1200, higherRate: 0.24 }, expr: 'deduction2 * higherRate', format: 'usd', answer: '$288.00',
            reasoning: '24% of $1,200 — twice as much as at 12%, because a deduction is worth the rate it saves.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Whose value depends on the filer’s marginal rate?',
            choices: ['The credit only', 'The deduction only', 'Both', 'Neither'],
            answer: 'The deduction only',
            reasoning: 'The credit is worth $1,200 at either rate, while the deduction moved from $144.00 to $288.00 when the rate doubled.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'State the rule that distinguishes a credit from a deduction in one sentence, then explain why the same $1,200 deduction is worth more to a higher-rate filer while the same credit is not.',
            acceptableAnswerCriteria: [
              'States the rule accurately: a credit reduces tax owed; a deduction reduces taxable income, so it is worth the marginal rate times the amount.',
              'Explains that a deduction’s value scales with the rate because it removes income from the top of what is taxed, which is taxed at the marginal rate.',
              'Notes that the credit is flat by design, so it is worth the same to filers at different rates.',
            ],
            evidenceRequirements: [
              'Uses the $144.00 and $288.00 deduction values and the $1,200.00 credit value.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response notes the credit here is non-refundable, so a filer owing less than $1,200 would not get its full value.',
              'The response does not conclude that credits are always better without that qualification.',
            ],
            commonMisconception: 'Reading a credit and a deduction of the same dollar amount as being worth the same.',
          },
        ],
      },
    ],
    remediation: 'If the deduction is being valued at $1,200, ask what it actually removes. It takes $1,200 out of the income figure, and the filer then does not pay tax on that $1,200 — at 12%, that is $144 not paid, not $1,200.',
    extension: 'Find the marginal rate at which a $1,200 deduction would be worth as much as a $400 credit, and say whether such a rate exists in practice.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l05',
    grade: 9, unit: 7, day: 5,
    actor: 'a fictional filer three months past the deadline',
    objective: 'Compute the penalties a fictional late filing produces under a stated simplified rule, and separate the cost of filing late from the cost of paying late.',
    scenario: 'A fictional filer owes $1,340 and files three months after the deadline. The penalty rules below are simplified and invented for this exercise; they are not the real penalty schedule.',
    materials: ['calculator', 'the fictional penalty rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the simplified fictional rules: a failure-to-file penalty of 5% of the tax owed for each month late, and a separate failure-to-pay penalty of 0.5% of the tax owed for each month late. The filer is 3 months late on both.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the failure-to-file penalty?',
            given: { owed: 1340, fileRate: 0.05, monthsLate: 3 }, expr: 'owed * fileRate * monthsLate', format: 'usd', answer: '$201.00',
            reasoning: '5% of $1,340 for each of 3 months.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the failure-to-pay penalty?',
            given: { owed2: 1340, payRate: 0.005, monthsLate2: 3 }, expr: 'owed2 * payRate * monthsLate2', format: 'usd', answer: '$20.10',
            reasoning: '0.5% of $1,340 for each of 3 months — a tenth the rate of the filing penalty.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the two penalties total?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$221.10',
            reasoning: '$201.00 for filing late plus $20.10 for paying late.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare the two penalties and the total due.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the filer owe in total, tax and penalties?',
            given: { owed3: 1340 }, expr: 'owed3 + #t1-p3', format: 'usd', answer: '$1,561.10',
            reasoning: '$1,340 of tax plus $221.10 of penalties.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If the filer had filed on time but still could not pay for 3 months, what would the penalties have been?',
            given: {}, expr: '#t1-p2', format: 'usd', answer: '$20.10',
            reasoning: 'Only the failure-to-pay penalty would apply, since the return itself would have been filed.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much did filing late, as opposed to paying late, cost this filer?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$201.00',
            reasoning: 'The whole difference is the failure-to-file penalty, which the filer could have avoided at no cost by filing on time.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Filing late cost ten times what paying late cost. Explain what that ratio signals about what the rules are trying to encourage, and describe what a filer who cannot pay should do.',
            acceptableAnswerCriteria: [
              'States that the far heavier filing penalty signals that submitting the return matters more than settling the balance immediately.',
              'Concludes that a filer who cannot pay should still file on time, which here would have reduced $221.10 of penalties to $20.10.',
              'Notes that filing establishes what is owed, which is what makes any payment arrangement possible.',
            ],
            evidenceRequirements: [
              'Uses the $201.00 and $20.10 penalty figures.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The response separates the obligation to file from the obligation to pay.',
              'The response does not suggest that filing late is a way to delay the tax itself.',
            ],
            commonMisconception: 'Believing there is no point filing a return until the money to pay it is available.',
          },
        ],
      },
    ],
    remediation: 'If the two penalties come out equal, check the rates: 5% a month and 0.5% a month differ by a factor of ten. Compute 1% of $1,340 first ($13.40) and scale from there to keep the decimal places straight.',
    extension: 'Under these fictional rules, work out the number of months at which the failure-to-file penalty would exceed the tax owed, and say why a real system would cap it.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l06',
    grade: 9, unit: 7, day: 6,
    actor: 'a fictional worker building one plan across all seven topics',
    objective: 'Assemble a single fictional annual plan that carries income, taxes, spending, saving, credit, investing, and protection together, and check that it balances.',
    scenario: 'A fictional worker earning $44,000 builds one simulated annual plan. The tax schedule is the simplified fictional one used in this unit and every figure is invented.',
    materials: ['calculator', 'the fictional income and plan figures in these directions', 'a blank one-page plan sheet'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Gross income is $44,000. The fictional federal schedule charges 10% on the first $11,600 and 12% above it. Payroll tax is 7.65%, state income tax 4.25%, and city income tax 1%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the federal income tax?',
            given: { income: 44000, bracket: 11600, lowRate: 0.1, highRate: 0.12 },
            expr: 'bracket * lowRate + (income - bracket) * highRate', format: 'usd', answer: '$5,048.00',
            reasoning: '$1,160 on the first $11,600 plus 12% of the remaining $32,400.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do payroll, state, and city taxes come to together?',
            given: { income2: 44000, payroll: 0.0765, state: 0.0425, city: 0.01 },
            expr: 'income2 * payroll + income2 * state + income2 * city', format: 'usd', answer: '$5,676.00',
            reasoning: '$3,366.00 payroll, $1,870.00 state, and $440.00 city.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is take-home income for the year?',
            given: { income3: 44000 }, expr: 'income3 - #t1-p1 - #t1-p2', format: 'usd', answer: '$33,276.00',
            reasoning: '$44,000 less $10,724.00 of total tax.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The plan allocates take-home pay as follows: essential spending $21,600, debt repayment $2,640, emergency reserve $2,400, long-horizon investing $3,600, and insurance premiums $1,860.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the five allocations total?',
            given: { essentials: 21600, debt: 2640, reserve: 2400, investing: 3600, insurance: 1860 },
            expr: 'essentials + debt + reserve + investing + insurance', format: 'usd', answer: '$32,100.00',
            reasoning: 'The five planned allocations added: $21,600 + $2,640 + $2,400 + $3,600 + $1,860.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of take-home pay is unallocated?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$1,176.00',
            reasoning: '$33,276.00 of take-home against $32,100.00 allocated.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of gross income goes to tax? Round to one decimal place.',
            given: { income4: 44000 }, expr: 'round((#t1-p1 + #t1-p2) / income4 * 100, 1)', format: 'percent1', answer: '24.4%',
            reasoning: '$10,724.00 of tax on $44,000 of gross income.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the plan up as one page.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Present the plan and show how each of the seven topics from this course appears in it. Say what the $1,176 unallocated should do, and name the one line you would cut first if income fell 10%.',
            acceptableAnswerCriteria: [
              'Maps each line to a topic — income and taxes to the top of the plan, essentials to spending, the reserve to saving and protection, the debt line to credit, and the investing line to long-horizon growth.',
              'Gives the $1,176 a specific job rather than leaving it as slack, and says why that job was chosen.',
              'Names a cut line and defends the choice against the alternative, recognising that a 10% income fall is about $3,328 of take-home and cannot come from the unallocated amount alone.',
            ],
            evidenceRequirements: [
              'Uses the $33,276.00 take-home figure, the $32,100.00 allocated total, and at least two individual allocation lines.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response does not cut the insurance line without acknowledging the risk exposure that creates.',
              'The response treats tax as a first claim on income rather than as one of the discretionary lines.',
            ],
            commonMisconception: 'Building a plan from gross income and treating tax as an expense to be trimmed alongside the others.',
          },
        ],
      },
    ],
    remediation: 'If take-home comes out near $38,000, only the federal tax has been subtracted. Total the four taxes first — $5,048.00, $3,366.00, $1,870.00, and $440.00 — and take the whole $10,724.00 off gross before any allocation.',
    extension: 'Rebuild the plan on $39,600 of gross income, keeping the reserve and insurance lines intact, and state which two lines absorbed the fall.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l07',
    grade: 9, unit: 7, day: 7,
    actor: 'a fictional filer who concluded that a refund meant no tax',
    objective: 'Find the error in a fictional claim that a refund means no tax was paid, compute what was actually paid, and state what a refund does and does not measure.',
    scenario: 'A fictional filer wrote: "I got a $2,100 refund, so I did not really pay any tax this year." The simulated figures behind that refund are given below.',
    materials: ['the fictional filing summary in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional filing summary: total withheld across the year $6,480, total tax owed for the year $4,380.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What refund do those two figures produce?',
            given: { withheld: 6480, owed: 4380 }, expr: 'withheld - owed', format: 'usd', answer: '$2,100.00',
            reasoning: '$6,480 paid in against $4,380 owed, so the refund figure in the filer’s claim is correct.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much tax did this filer actually pay for the year?',
            given: { owed2: 4380 }, expr: 'owed2', format: 'usd', answer: '$4,380.00',
            reasoning: 'The tax paid is the amount owed and kept by the tax authority, not the amount temporarily withheld.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Test the filer’s reasoning against a second fictional case with the same income and the same tax owed but different withholding of $4,100.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'In the second case, what is owed at filing?',
            given: { withheld2: 4100, owed3: 4380 }, expr: 'owed3 - withheld2', format: 'usd', answer: '$280.00',
            reasoning: '$4,380 owed against $4,100 withheld leaves $280 to pay.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Which filer paid more tax for the year?',
            choices: ['The first, who got a refund', 'The second, who owed at filing', 'They paid the same amount of tax'],
            given: { owedA: 4380, owedB: 4380 },
            decision: { left: 'owedA', cmp: '==', right: 'owedB', ifTrue: 'They paid the same amount of tax', ifFalse: 'The first, who got a refund' },
            answer: 'They paid the same amount of tax',
            reasoning: 'Both owed $4,380; the two experienced opposite outcomes at filing purely because of how much had been withheld along the way.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Name the error.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'What did the fictional filer’s reasoning confuse?',
            choices: [
              'The tax rate with the tax owed',
              'The refund with the tax paid',
              'Withholding with income',
              'Nothing; a refund does mean no tax was paid',
            ],
            answer: 'The refund with the tax paid',
            reasoning: 'The $2,100 refund is the return of over-withholding; the $4,380 owed is what the filer actually paid, and the two are entirely different quantities.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did the filer understate the tax they paid?',
            given: {}, expr: '#t1-p2', format: 'usd', answer: '$4,380.00',
            reasoning: 'The filer claimed to have paid nothing, so the whole $4,380 is the understatement.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Explain what a refund measures, and describe how you would check whether your own withholding is set sensibly — without using any real figures, describe the two numbers you would compare.',
            acceptableAnswerCriteria: [
              'States that a refund measures the gap between what was withheld and what was owed, and says nothing about the size of the tax.',
              'Names the two numbers to compare: total withheld for the year against total tax owed for the year, both of which appear on a completed return.',
              'Explains that a withholding setting is sensible when those two are close, so neither a large refund nor a large bill arises.',
            ],
            evidenceRequirements: [
              'Uses the $6,480 withheld, the $4,380 owed, and the $2,100 refund from the fictional summary.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response describes the check in general terms without asking anyone to state their own real tax figures.',
              'The response recognises that a large refund is not a mistake, only an interest-free loan to the government.',
            ],
            commonMisconception: 'Reading the refund line as the year’s tax result rather than as a settling-up.',
          },
        ],
      },
    ],
    remediation: 'If the two cases seem to involve different amounts of tax, put the $4,380 figure at the top of both columns. Everything else on the page describes when the money moved, not how much tax there was.',
    extension: 'Construct a third fictional case with the same $4,380 owed that produces neither a refund nor a bill, and state what withholding it requires.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l08',
    grade: 9, unit: 7, day: 8,
    actor: 'a fictional worker holding two jobs at once',
    objective: 'Apply the withholding method to a fictional worker with two employers, and show why withholding set correctly at each job can still fall short overall.',
    scenario: 'A fictional worker holds two simulated jobs. Each employer withholds as though it were the only source of income. The schedule below is the simplified fictional one used in this unit.',
    materials: ['calculator', 'the two fictional job figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Job A pays $22,000 a year and Job B pays $16,000. Each employer withholds 10% of the pay it issues, because at that pay level alone 10% would be about right. The fictional federal schedule charges 10% on the first $11,600 of total income and 12% above that.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does Job A withhold over the year?',
            given: { payA: 22000, rate: 0.1 }, expr: 'payA * rate', format: 'usd', answer: '$2,200.00',
            reasoning: '10% of $22,000, computed as though Job A were the worker’s only income.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld across both jobs?',
            given: { payB: 16000, rate2: 0.1 }, expr: '#t1-p1 + payB * rate2', format: 'usd', answer: '$3,800.00',
            reasoning: '$2,200.00 from Job A plus $1,600.00 from Job B.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the tax actually owed on the combined income of $38,000?',
            given: { combined: 38000, bracket: 11600, lowRate: 0.1, highRate: 0.12 },
            expr: 'bracket * lowRate + (combined - bracket) * highRate', format: 'usd', answer: '$4,328.00',
            reasoning: '$1,160 on the first $11,600 plus 12% of the remaining $26,400, because the schedule applies to total income and not to each job separately.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare what was withheld with what is owed.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the shortfall at filing?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$528.00',
            reasoning: '$4,328.00 owed against $3,800.00 withheld.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much extra would need to be withheld each month across the year to close the gap? Round to the nearest cent.',
            given: {}, expr: 'round(#t2-p1 / 12, 2)', format: 'usd', answer: '$44.00',
            reasoning: '$528.00 spread over twelve months.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Why did correct-looking withholding at each job still fall short?',
            choices: [
              'Each employer used the wrong rate for the pay it issued',
              'Neither employer knew about the other income, so both applied the low-rate band',
              'The combined income was taxed at a higher rate on every dollar',
              'The worker earned more than either employer reported',
            ],
            answer: 'Neither employer knew about the other income, so both applied the low-rate band',
            reasoning: 'The 10% band applies once to the first $11,600 of total income, but each employer effectively treated its own pay as starting from zero, so the low band was applied twice.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'This is the same withholding method used on a single job, applied to a case it was not designed for. Explain what changed, and name the step a two-job worker has to take that a one-job worker does not.',
            acceptableAnswerCriteria: [
              'Explains that the method assumes the employer sees all of the worker’s income, which is true with one job and false with two.',
              'Names the step: telling one employer to withhold extra, or making a separate payment, so the total matches the $4,328.00 owed.',
            ],
            evidenceRequirements: [
              'Uses the $3,800.00 withheld and the $4,328.00 owed.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response does not blame either employer, both of which applied the rule correctly to what they could see.',
            ],
            commonMisconception: 'Assuming that withholding handled correctly at each job adds up to the right total.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'A worker discovers the $528 shortfall in March, after filing. Say what they should change for the current year and why acting in March is better than acting in December.',
            acceptableAnswerCriteria: [
              'Recommends raising withholding at one job now, and notes the amount needed spreads across the remaining months rather than the whole year.',
              'Explains that acting early spreads the same total over more paychecks, so each one is affected less than a December correction would be.',
            ],
            evidenceRequirements: [
              'Refers to the $528.00 shortfall or the $44.00 monthly figure.',
            ],
            dimensions: ['plan-coherence', 'transfer'],
            lookFors: [
              'The response recognises the correction must be larger per month if started later.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the tax owed comes out as the sum of two separate calculations, one per job, reread the schedule: it applies to total income. Add the two salaries first, then apply the bands once to the combined $38,000.',
    extension: 'Recompute the shortfall if Job B paid $9,000 instead of $16,000, and say whether the problem gets better or worse as the second job gets smaller.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l09',
    grade: 9, unit: 7, day: 9,
    actor: 'a fictional filer assembling a return from four forms',
    objective: 'Assemble total income from four fictional information forms, state what each form is for, and identify which figures on a return come from forms and which the filer supplies.',
    scenario: 'The four simulated forms below arrived for one fictional filer. Every amount is invented for this exercise and no real form or filer is described.',
    materials: ['calculator', 'the fictional form summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional forms: a W-2 reporting wages of $41,250; a 1099-NEC reporting $2,800 of self-employed work; a 1099-INT reporting $86 of interest; and a 1098-E reporting $340 of student loan interest paid.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is total income across the three forms that report income received?',
            given: { wages: 41250, nec: 2800, interest: 86 }, expr: 'wages + nec + interest', format: 'usd', answer: '$44,136.00',
            reasoning: 'The W-2, 1099-NEC, and 1099-INT all report money received; the 1098-E reports money paid out and is not income.',
          },
          {
            ref: 't1-p2', kind: 'choice',
            text: 'Which of the four forms does not report income to the filer?',
            choices: ['The W-2', 'The 1099-NEC', 'The 1099-INT', 'The 1098-E'],
            answer: 'The 1098-E',
            reasoning: 'A 1098-E reports interest the filer paid on a student loan, which may reduce taxable income rather than adding to it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'If the $340 of student loan interest is fully deductible, what income figure does the return start from?',
            given: { studentInterest: 340 }, expr: '#t1-p1 - studentInterest', format: 'usd', answer: '$43,796.00',
            reasoning: '$44,136.00 of income less the $340 deduction the 1098-E supports.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Not every figure on a return arrives on a form.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Which of these figures would the filer normally have to supply from their own records rather than read off a form?',
            choices: [
              'Wages from an employer',
              'Interest paid by a bank',
              'Expenses against the self-employed income',
              'Federal income tax withheld by an employer',
            ],
            answer: 'Expenses against the self-employed income',
            reasoning: 'The first, second, and fourth all appear on the forms above; expenses against self-employed work are known only to the filer and must come from their own records.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If the filer’s own records show $610 of allowable expenses against the self-employed work, what is the net self-employed income?',
            given: { nec2: 2800, expenses: 610 }, expr: 'nec2 - expenses', format: 'usd', answer: '$2,190.00',
            reasoning: '$2,800 reported on the 1099-NEC less $610 of expenses the form knows nothing about.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Three of these forms are also sent to the tax authority and one figure — the $610 of expenses — is not documented anywhere but the filer’s own records. Explain what that asymmetry means for how a filer should keep records during the year.',
            acceptableAnswerCriteria: [
              'States that income figures arrive documented from third parties, so they are known to the authority whether or not the filer tracks them.',
              'States that deductions and expenses are only as good as the filer’s own records, since no form reports them.',
              'Draws the practical conclusion: keep contemporaneous records of anything that reduces tax, because that is the side of the return the filer alone must support.',
            ],
            evidenceRequirements: [
              'Uses the $44,136.00 income total and the $610 of undocumented expenses.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'evidence-use'],
            lookFors: [
              'The response does not suggest that undocumented expenses can simply be estimated.',
              'The response recognises the forms are a check on the return, not merely a convenience.',
            ],
            commonMisconception: 'Assuming that everything needed to file arrives in the post.',
          },
        ],
      },
    ],
    remediation: 'If the 1098-E amount is being added to income, read what it reports: interest the filer paid, not received. Sort the four forms into money in and money out before adding anything.',
    extension: 'Add a fictional 1099-G reporting $1,150 of unemployment compensation, decide which pile it belongs in, and recompute the income total.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l10',
    grade: 9, unit: 7, day: 10,
    actor: 'a fictional worker weighing two choices with different tax consequences',
    objective: 'Outline the tax benefits and drawbacks of two fictional choices, compute the after-tax effect of each, and recommend one with the drawback stated.',
    scenario: 'A fictional worker with a 12% marginal rate has $3,000 available and two simulated options. Both options and all rates are invented for this exercise.',
    materials: ['calculator', 'the two fictional options in these directions', 'a blank two-column outline'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Option 1: contribute the $3,000 to a pre-tax retirement account, which reduces taxable income by $3,000 but locks the money away until retirement. Option 2: keep the $3,000 in a savings account paying 3.5%, fully available, with the interest taxed at the 12% rate.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much tax does Option 1 save this year?',
            given: { contribution: 3000, marginalRate: 0.12 }, expr: 'contribution * marginalRate', format: 'usd', answer: '$360.00',
            reasoning: 'Removing $3,000 from taxable income at a 12% marginal rate saves 12% of $3,000.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What interest does Option 2 earn in a year, before tax?',
            given: { savings: 3000, savingsRate: 0.035 }, expr: 'savings * savingsRate', format: 'usd', answer: '$105.00',
            reasoning: 'The savings account pays 3.5% on the $3,000 held, giving $105.00 of interest before tax.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Option 2 leave after tax on the interest?',
            given: { interestTaxRate: 0.12 }, expr: '#t1-p2 * (1 - interestTaxRate)', format: 'usd', answer: '$92.40',
            reasoning: '$105.00 of interest less 12% tax on it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare the first-year positions.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much better off is Option 1 in the first year, counting only the tax saved against the after-tax interest?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$267.60',
            reasoning: '$360.00 of tax saved against $92.40 of after-tax interest.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the $3,000 does Option 2 leave available to spend if an emergency arises?',
            given: { savings2: 3000 }, expr: 'savings2', format: 'usd', answer: '$3,000.00',
            reasoning: 'Option 2 keeps the whole amount accessible, which is the thing Option 1 gives up.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the outline.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Outline the tax benefit and the drawback of each option, then recommend one for a worker with no emergency reserve at all — and defend that recommendation against the $267.60 first-year advantage the other option shows.',
            acceptableAnswerCriteria: [
              'States Option 1’s benefit as $360.00 of tax saved now and its drawback as the money being inaccessible until retirement.',
              'States Option 2’s benefit as full access to $3,000 and its drawback as a smaller after-tax gain of $92.40.',
              'Recommends for a worker with no reserve, and defends it against the $267.60 advantage by pricing what an inaccessible reserve would cost in a real emergency — borrowing at credit-card rates, or an early-withdrawal penalty.',
            ],
            evidenceRequirements: [
              'Uses the $360.00, $92.40, and $267.60 figures in the outline.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response faces the $267.60 rather than ignoring it.',
              'The response recognises the recommendation would likely flip once a reserve exists.',
            ],
            commonMisconception: 'Choosing the option with the larger tax benefit without asking what the money is needed for.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Option 1’s $360 saving assumes a 12% marginal rate. Say what happens to that figure if the worker’s marginal rate is 22% instead, and whether that changes the recommendation for a worker with no reserve.',
            acceptableAnswerCriteria: [
              'States that the saving rises to $660 at a 22% rate, making Option 1’s advantage larger.',
              'Says whether the recommendation changes and why — a larger tax advantage does not create an accessible reserve.',
            ],
            evidenceRequirements: [
              'Refers to the $360.00 saving and the 12% rate it assumes.',
            ],
            dimensions: ['assumption-identification', 'transfer'],
            lookFors: [
              'The response treats the marginal rate as an input rather than a fixed feature of the option.',
            ],
          },
        ],
      },
    ],
    remediation: 'If Option 1’s saving is coming out as $3,000, the contribution is being treated as a credit. It reduces the income that tax is charged on, so its value is the marginal rate times the contribution — $360, not $3,000.',
    extension: 'Extend the comparison to five years, assuming Option 1 grows 6% a year untouched and Option 2 keeps earning 3.5% taxed annually, and say what the comparison looks like then.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u07-l11',
    grade: 9, unit: 7, day: 11,
    actor: 'a fictional filer defending a recordkeeping plan',
    objective: 'Price the consequence of a fictional recordkeeping failure, design a records plan that would have prevented it, and defend the plan against the effort it costs.',
    scenario: 'A fictional filer could not support $1,480 of deductions at a simulated review because no records were kept. Every figure below is invented for this exercise.',
    materials: ['calculator', 'the fictional review summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional filer claimed $1,480 of deductions at a 12% marginal rate and could not support them. The disallowed deductions produce additional tax, plus a fictional accuracy penalty of 20% of that additional tax.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What additional tax results from the disallowed deductions?',
            given: { disallowed: 1480, marginalRate: 0.12 }, expr: 'disallowed * marginalRate', format: 'usd', answer: '$177.60',
            reasoning: '12% of the $1,480 that can no longer reduce taxable income.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the accuracy penalty at 20% of that additional tax?',
            given: { penaltyRate: 0.2 }, expr: 'round(#t1-p1 * penaltyRate, 2)', format: 'usd', answer: '$35.52',
            reasoning: 'The fictional accuracy penalty is 20% of the additional tax of $177.60.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of the recordkeeping failure?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$213.12',
            reasoning: '$177.60 of tax plus $35.52 of penalty.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the plan that would have prevented it: 15 minutes a month filing receipts, valued at the filer’s $19.40 hourly rate.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is a year of that recordkeeping worth in the filer’s own time?',
            given: { minutesPerMonth: 15, hourlyRate: 19.4 }, expr: 'round(minutesPerMonth * 12 / 60 * hourlyRate, 2)', format: 'usd', answer: '$58.20',
            reasoning: '15 minutes a month is 3 hours a year, valued at $19.40 an hour.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much better off would the filer have been with the records?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$154.92',
            reasoning: '$213.12 avoided against $58.20 of time spent.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'On these figures, was the recordkeeping worth doing?',
            choices: ['Yes, it costs less than the failure it prevents', 'No, the time is worth more than the tax at stake'],
            given: {},
            decision: { left: '#t2-p1', cmp: '<', right: '#t1-p3', ifTrue: 'Yes, it costs less than the failure it prevents', ifFalse: 'No, the time is worth more than the tax at stake' },
            answer: 'Yes, it costs less than the failure it prevents',
            reasoning: '$58.20 of time against $213.12 of avoidable cost, and the records also protect deductions the filer might otherwise not claim at all.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the defence.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Defend a recordkeeping plan to someone who says it is not worth the effort. Use the figures, name what records the plan would actually keep, and answer the strongest version of their objection.',
            acceptableAnswerCriteria: [
              'Uses the $58.20 of time against the $213.12 of avoidable cost, and does not overstate the margin.',
              'Names specific records the plan keeps — dated receipts, a log of self-employed expenses, the annual forms — rather than recommending record-keeping in general.',
              'Answers the strongest objection honestly: in a year with no review the effort produces no visible return, so the plan is insurance against a possibility rather than a certain saving.',
            ],
            evidenceRequirements: [
              'Uses at least three computed figures from this lesson.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response acknowledges the calculation assumed the review happened, and that its expected value depends on how likely that is.',
              'The plan described is specific enough that someone could follow it.',
            ],
            commonMisconception: 'Judging recordkeeping by whether it produced a visible benefit this year.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Records also protect deductions a filer might otherwise not claim. Explain how that second benefit changes the case, and why it is harder to put a number on than the $213.12.',
            acceptableAnswerCriteria: [
              'Explains that unrecorded expenses are often simply not claimed, so the records raise the deductions taken as well as defending them.',
              'States why the size of that benefit is unknown: it depends on expenses the filer never recorded and therefore cannot count.',
            ],
            evidenceRequirements: [
              'Refers to the $1,480 of deductions at issue as the documented side of the case.',
            ],
            dimensions: ['communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response does not invent a figure for the unclaimed deductions.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the additional tax comes out as $1,480, the disallowed deduction is being treated as tax rather than as income that becomes taxable again. Apply the 12% marginal rate to the $1,480 before anything else.',
    extension: 'Recompute the whole comparison at a 24% marginal rate and say whether the case for recordkeeping strengthens or weakens as income rises.',
  },
]
