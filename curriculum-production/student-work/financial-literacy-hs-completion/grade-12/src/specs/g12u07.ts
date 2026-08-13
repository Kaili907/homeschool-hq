import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 7 — PF7 Paying Taxes: Taxes and the Simulated Adult Finance
 * Capstone.
 *
 * Lessons 1, 2, 7, and 8 finish the taxes strand. The remaining seven lessons
 * are the capstone: one fictional adult's simulated financial year, carried
 * from income and tax through spending, borrowing, protection, investing, and
 * a shock, and then defended.
 *
 * Three authoring rules govern the capstone lessons.
 *
 * 1. It runs on a supplied fictional case — Case R — or on a fictional profile
 *    the learner invents. It never asks the learner for their own income,
 *    balances, credit standing, debts, aid, tuition, tax filing, household
 *    finances, investments, or insurance. `checkCapstoneIntegrity` and
 *    `checkPrivacy` enforce this on the learner-facing text rather than
 *    leaving it to intent.
 *
 * 2. There is no single correct life plan. Every capstone judgment item that
 *    asks for a decision records at least two defensible alternatives in the
 *    scoring record, so the adult scoring the work is told in the artefact
 *    itself that competing answers earn full credit when they are defended.
 *    A capstone lesson with only one recorded path fails the validator.
 *
 * 3. Case R's figures are consistent across all seven lessons and every one of
 *    them is recomputed by the oracle from the parameters the learner is
 *    shown. Where a lesson relies on a figure established in an earlier one,
 *    that figure is restated in the lesson's own directions so the sheet is
 *    self-contained.
 *
 * Case R: a fictional adult paid $54,600 a year, electing 5% to retirement and
 * $2,040 of pre-tax health premium, under the fictional federal schedule used
 * across grade 12 — a $9,000 standard deduction, then 10% to $10,400, 12% to
 * $44,000, and 22% above — plus a 7.65% payroll levy, 4.25% state and 1% city
 * tax on gross. Every figure is invented.
 */
export const g12u07: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u07-l01',
    grade: 12, unit: 7, day: 1,
    actor: 'a fictional filer assembling a simulated return from invented documents',
    objective: 'Build a simulated tax return from fictional documents, compute what is owed and what was withheld, and distinguish the band the last dollars fall in from the rate the whole income actually bears.',
    scenario: 'The simulated documents and every figure below belong to a fictional filer. No real tax form, filing, or taxpayer is described, and no lesson in this unit asks about anyone’s own tax affairs.',
    materials: ['calculator', 'the fictional document figures and tax schedule in these directions'],
    domains: ['taxes', 'income', 'saving-investing', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional documents report wages of $47,300, a pre-tax retirement contribution of $2,365 already excluded from taxable wages by the employer, interest income of $186, and federal income tax withheld of $4,410. Under the fictional federal schedule, taxable income is wages less the pre-tax contribution, plus interest income, less a standard deduction of $9,000; the schedule then charges 10% on the first $10,400 of taxable income and 12% on the band above it, which runs to $44,000. A separate payroll levy of 7.65% is charged on wages with no deduction.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is taxable income under the fictional schedule?',
            given: { wages: 47300, pretax: 2365, interest: 186, deduction: 9000 },
            expr: 'wages - pretax + interest - deduction', format: 'usd', answer: '$36,121.00',
            reasoning: 'Wages less the pre-tax contribution gives $44,935, the interest income of $186 is added because it is not excluded, and the $9,000 standard deduction comes off last. Interest income is taxable even though nothing was withheld from it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What federal income tax does the schedule produce?',
            given: { band1: 10400, lowRate: 0.1, midRate: 0.12 },
            expr: 'band1 * lowRate + (#t1-p1 - band1) * midRate', format: 'usd', answer: '$4,126.52',
            reasoning: '$1,040.00 on the first $10,400 plus 12% of the remaining $25,721.00. Taxable income of $36,121.00 stays below $44,000, so the 22% band is not reached.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'The documents show $4,410 withheld. What is the refund or the amount still owed?',
            given: { withheld: 4410 }, expr: 'withheld - #t1-p2', format: 'usd', answer: '$283.48',
            reasoning: '$4,410 withheld against $4,126.52 owed, so $283.48 is returned. A refund is money that was over-collected during the year, not an amount earned by filing.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put the income tax alongside the other federal charge, and express what the year actually cost.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the payroll levy on wages at 7.65%?',
            given: { wages2: 47300, levyRate: 0.0765 }, expr: 'wages2 * levyRate', format: 'usd', answer: '$3,618.45',
            reasoning: '7.65% of the full $47,300 of wages. The levy gets no standard deduction and is not reduced by the pre-tax contribution, so it is charged on a much larger base than the income tax is.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do the two federal charges come to together?',
            given: {}, expr: '#t1-p2 + #t2-p1', format: 'usd', answer: '$7,744.97',
            reasoning: '$4,126.52 of income tax plus $3,618.45 of payroll levy. The levy is nearly as large as the income tax, and a filer who thinks only about the return sees only one of them.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What is the federal income tax as a share of wages, to two decimal places?',
            given: { wages3: 47300 }, expr: 'round(#t1-p2 / wages3 * 100, 2)', format: 'percent2', answer: '8.72%',
            reasoning: '$4,126.52 measured against $47,300 of wages. This is well below the 12% band the last dollars fall in, because the deduction and the 10% band shelter the first part of the income.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'The filer’s last dollars are taxed at 12%, and income tax comes to 8.72% of wages. Which figure describes what one more dollar of wages would cost in income tax?',
            choices: ['The 8.72% share of wages', 'The 12% band the last dollars fall in'],
            answer: 'The 12% band the last dollars fall in',
            reasoning: 'An additional dollar is taxed at the band it falls in, which is 12% here. The 8.72% figure averages the whole income including the untaxed deduction and the 10% band, so it describes the year as a whole rather than the next dollar. This follows from how the stated schedule is built.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This fictional filer receives $283.48 back and paid $7,744.97 in federal charges across the year. Explain why the refund is a poor measure of what the year cost, and say which single figure you would put in front of someone who wanted to understand their own tax position — and why.',
            acceptableAnswerCriteria: [
              'Explains the refund correctly: it is the difference between what was withheld and what was owed, so it measures the accuracy of withholding rather than the size of the tax bill.',
              'Uses the scale to make the point: $283.48 returned against $7,744.97 actually charged, so the refund is under 4% of the year’s federal charges and could be zero while nothing about the tax changed.',
              'Names a better single figure with a reason — most defensibly the total charged, $7,744.97, because it is what the year cost, or the 8.72% share for comparing years with different incomes.',
            ],
            evidenceRequirements: [
              'Uses the $283.48 refund and the $7,744.97 total of federal charges.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response separates over-withholding from tax owed.',
              'The response notices the payroll levy, which a focus on the refund hides entirely.',
            ],
            commonMisconception: 'Treating the refund as the outcome of the tax year, when it only reports whether the right amount was collected in advance.',
          },
        ],
      },
    ],
    remediation: 'If taxable income comes out at $38,300.00, the $186 of interest has been left out or the pre-tax contribution has been subtracted twice. Work in the stated order: wages less the pre-tax contribution, plus interest, less the $9,000 deduction. The interest is added because nothing excludes it.',
    extension: 'Recompute the return for a fictional filer with the same wages but $1,900 of interest income, and say which of the two figures — income tax or payroll levy — changes and why the other does not.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l02',
    grade: 12, unit: 7, day: 2,
    actor: 'a fictional worker whose withholding was set too high all year',
    objective: 'Establish a fictional worker’s true liability against what was withheld, convert the over-collection to a monthly figure, and price what that money could not do while it was held.',
    scenario: 'The fictional worker, the simulated withholding, and the invented card rate below exist only for this exercise. Nothing here advises any real person about their own withholding.',
    materials: ['calculator', 'the fictional pay and withholding figures in these directions'],
    domains: ['taxes', 'income', 'budgeting', 'debt'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker earned $51,600 in wages with a pre-tax retirement contribution of $2,580, and had $5,194.40 of federal income tax withheld across the year. The fictional federal schedule allows a standard deduction of $9,000 and charges 10% on the first $10,400 of taxable income and 12% above it to $44,000. The worker also carries a simulated card balance charged at 21.6% a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is taxable income?',
            given: { wages: 51600, pretax: 2580, deduction: 9000 }, expr: 'wages - pretax - deduction', format: 'usd', answer: '$40,020.00',
            reasoning: '$51,600 of wages less the $2,580 pre-tax contribution and the $9,000 standard deduction.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What income tax is owed?',
            given: { band1: 10400, lowRate: 0.1, midRate: 0.12 },
            expr: 'band1 * lowRate + (#t1-p1 - band1) * midRate', format: 'usd', answer: '$4,594.40',
            reasoning: '$1,040.00 on the first $10,400 plus 12% of the remaining $29,620.00.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Given that $5,194.40 was withheld across the year, what refund is due once the amount actually owed is settled?',
            given: { withheld: 5194.40 }, expr: 'withheld - #t1-p2', format: 'usd', answer: '$600.00',
            reasoning: '$5,194.40 withheld against $4,594.40 owed. The worker was correct about nothing in particular; the employer collected $600.00 more than the schedule required.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now express the over-collection as the monthly amount it actually was, and price what it could have been doing.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much extra was withheld each month?',
            given: {}, expr: 'round(#t1-p3 / 12, 2)', format: 'usd', answer: '$50.00',
            reasoning: '$600.00 across the 12 months. The refund arrives as a single sum, but it left the worker’s pay in twelve instalments.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If $600 had instead sat on the card at 21.6% for the year, what interest would that have cost?',
            given: { cardApr: 0.216 }, expr: 'round(#t1-p3 * cardApr, 2)', format: 'usd', answer: '$129.60',
            reasoning: '21.6% of $600 for a year, treating the balance as outstanding throughout — a simplification, since applying $50 a month would reduce the balance steadily and cost less than this. It is an upper bound on what the over-withholding cost.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Is the $600.00 refund money the worker gained by filing?',
            choices: ['Yes — it is a payment received after filing', 'No — it is the worker’s own pay, over-collected and returned without interest'],
            answer: 'No — it is the worker’s own pay, over-collected and returned without interest',
            reasoning: 'The amount owed under the schedule was $4,594.40 whatever the withholding was. The $600.00 is wages that were withheld beyond that and returned later with nothing added, which is what the interest comparison prices.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Some people deliberately over-withhold. Make the strongest case for and against this fictional worker adjusting their withholding so the refund is close to zero, and say what fact about the worker would decide it.',
            acceptableAnswerCriteria: [
              'Makes the case for adjusting: the $50.00 a month is the worker’s own pay, and used against a balance charged at 21.6% it is worth up to $129.60 a year, which a refund paying no interest does not provide.',
              'Makes the case against adjusting: over-withholding is a form of forced saving that reliably produces $600.00 once a year, and a worker who would spend the $50.00 a month gets nothing from the adjustment.',
              'Names the deciding fact: what would actually happen to the $50.00 each month — whether it would reach a balance or a reserve, or be absorbed into ordinary spending.',
              'Notes the risk in the other direction: adjusting too far produces an amount owed at filing rather than a refund, which has to be met.',
            ],
            evidenceRequirements: [
              'Uses the $50.00 monthly over-collection and the $129.60 upper-bound interest figure.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'Both cases are made on the figures; the response is not scored on which it prefers.',
              'The response treats the forced-saving argument as real rather than dismissing it.',
              'The response makes no recommendation about any actual person’s withholding.',
            ],
            commonMisconception: 'Treating a large refund as a good outcome, without noticing that it is money withheld from pay all year and returned without interest.',
          },
        ],
      },
    ],
    remediation: 'If the refund comes out at $2,180.00, the pre-tax contribution has not been subtracted, or the whole taxable income has been taxed at 12%. Taxable income is $40,020.00 after both the $2,580 contribution and the $9,000 deduction, and the first $10,400 of it is charged at 10%, not 12%.',
    extension: 'Work out what withholding would have produced a refund of exactly zero, and say how much would have had to be withheld each month to achieve it.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l03',
    grade: 12, unit: 7, day: 3,
    isCapstone: true,
    actor: 'Case R, a fictional adult beginning a simulated first full financial year',
    objective: 'Establish the income and tax spine of the fictional capstone case: what is earned, what is set aside before tax, what tax takes, and what actually arrives each month.',
    scenario: 'This lesson opens the capstone. It runs on Case R, a fictional adult invented for this course, or on a fictional profile the learner invents instead — every figure in which must also be invented. The capstone never asks about the learner’s own money, household, accounts, or filings, and no lesson in it requests any real financial detail.',
    materials: ['calculator', 'the Case R figures and fictional tax schedule in these directions', 'a page for the capstone record'],
    domains: ['income', 'taxes', 'saving-investing', 'insurance-risk', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Case R is paid $54,600 a year. Before tax, $2,730 goes to a retirement election and $2,040 to a health premium. Under the fictional federal schedule, taxable income is pay less those pre-tax amounts less a standard deduction of $9,000; the schedule charges 10% on the first $10,400 of taxable income and 12% on the band to $44,000. A payroll levy of 7.65%, state tax of 4.25%, and city tax of 1% are all charged on the full $54,600 with no deduction. If you are using a fictional profile of your own instead, substitute your own invented figures throughout and keep them the same in every capstone lesson.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the two pre-tax amounts come to together?',
            given: { retire: 2730, healthPrem: 2040 }, expr: 'retire + healthPrem', format: 'usd', answer: '$4,770.00',
            reasoning: 'The $2,730 retirement election plus the $2,040 health premium. Both reduce taxable income; only the first remains the fictional adult’s own money.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is taxable income?',
            given: { gross: 54600, deduction: 9000 }, expr: 'gross - #t1-p1 - deduction', format: 'usd', answer: '$40,830.00',
            reasoning: '$54,600 less the $4,770.00 of pre-tax elections and the $9,000 standard deduction. This figure sits below $44,000, so the 22% band is not reached this year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the federal income tax?',
            given: { band1: 10400, lowRate: 0.1, midRate: 0.12 },
            expr: 'band1 * lowRate + (#t1-p2 - band1) * midRate', format: 'usd', answer: '$4,691.60',
            reasoning: '$1,040.00 on the first $10,400 plus 12% of the remaining $30,430.00.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now complete the tax picture and find what reaches the account.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the payroll levy, state tax, and city tax come to together?',
            given: { gross2: 54600, levyRate: 0.0765, stateRate: 0.0425, cityRate: 0.01 },
            expr: 'gross2 * levyRate + gross2 * stateRate + gross2 * cityRate', format: 'usd', answer: '$7,043.40',
            reasoning: '$4,176.90 of levy, $2,320.50 of state tax, and $546.00 of city tax, all charged on the full $54,600 because none of them takes the deduction or the pre-tax elections into account.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total tax for the year?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$11,735.00',
            reasoning: '$4,691.60 of federal income tax plus $7,043.40 of the other three charges. The charges that get no deduction are larger together than the one that does.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is take-home pay for the year, after both the pre-tax elections and all tax?',
            given: { gross3: 54600 }, expr: 'gross3 - #t1-p1 - #t2-p2', format: 'usd', answer: '$38,095.00',
            reasoning: '$54,600 less $4,770.00 of pre-tax elections and $11,735.00 of tax. This is the figure every later capstone lesson builds on.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is monthly take-home pay?',
            given: {}, expr: 'round(#t2-p3 / 12, 2)', format: 'usd', answer: '$3,174.58',
            reasoning: '$38,095.00 across 12 months. Against a headline salary of $4,550 a month, this is what the fictional adult can actually plan with.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Begin the capstone record. Answer in a short paragraph and keep it.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Case R earns $54,600 and has $3,174.58 a month to work with. Write the opening entry of the capstone record: state what the year’s income actually makes available, name the largest single reduction and whether it is a cost or a transfer, and set out the one thing you would want to change about this starting position — with the reason it is worth changing and what changing it would cost.',
            acceptableAnswerCriteria: [
              'States the position accurately: $54,600 of pay produces $38,095.00 of take-home, so roughly 30% of the headline figure never reaches the account, and $3,174.58 a month is the planning figure.',
              'Identifies the largest reduction and classifies it correctly: tax at $11,735.00 is the largest and is a cost, while the $2,730 retirement election is a transfer the fictional adult still owns and the $2,040 health premium buys cover.',
              'Names a change with a reason and a cost — for example raising the retirement election, which increases what is saved and reduces income tax but lowers monthly take-home, or reducing the health election, which raises take-home but changes cover.',
              'Does not treat the whole $16,505.00 gap between pay and take-home as money lost.',
            ],
            evidenceRequirements: [
              'Uses the $38,095.00 annual take-home and the $11,735.00 of total tax.',
              'States what the proposed change would cost, in figures or in clearly named terms.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'tradeoff-defense'],
            lookFors: [
              'The response separates tax from elections rather than totalling everything between gross and take-home as deductions.',
              'The proposed change is one the fictional adult could actually make, not a wish about the salary.',
            ],
            defensibleAlternatives: [
              'Raise the retirement election, accepting lower monthly take-home in exchange for more saved and a smaller income tax bill.',
              'Leave the elections as they are and treat the $3,174.58 as the figure to build the year around, on the grounds that the first year of independence needs cash flow more than it needs a higher contribution.',
              'Reduce the health election if a lower-cost option genuinely covers the fictional adult’s needs, raising take-home while accepting a change in cover.',
            ],
            commonMisconception: 'Reading everything between gross pay and take-home pay as tax, when in this case $4,770.00 of the gap is elections the fictional adult chose and largely still owns.',
          },
        ],
      },
    ],
    remediation: 'If take-home comes out at $42,865.00, only the tax has been subtracted and the pre-tax elections are still in the figure; if it comes out at $45,138.40, the levy, state, and city charges have been left out. Subtract in the stated order: the $4,770.00 of elections, then all four taxes totalling $11,735.00.',
    extension: 'Recompute the whole spine for a fictional profile paid $61,000 with the same elections, and say whether the 22% band is reached and what that does to the monthly figure.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l04',
    grade: 12, unit: 7, day: 4,
    isCapstone: true,
    actor: 'Case R, committing a simulated monthly budget and recording what it assumes',
    objective: 'Build the fictional capstone case’s monthly commitments, find the surplus that remains, and document the assumptions and the forgone employer contribution the plan rests on.',
    scenario: 'This lesson continues the capstone on Case R, the fictional adult from the previous lesson, or on the fictional profile the learner invented. All figures are invented; nothing about the learner’s own finances is used or requested at any point.',
    materials: ['calculator', 'the Case R figures in these directions', 'the capstone record begun in the previous lesson'],
    domains: ['budgeting', 'debt', 'credit', 'saving-investing', 'insurance-risk', 'income'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Case R is paid $54,600 a year and has monthly take-home pay of $3,174.58. Monthly costs are rent $1,180, utilities $155, food $430, transport $210, phone $52, and renters insurance $18. A student loan balance of $18,400 is repaid over 120 payments at the fictional factor of $10.79 a month per $1,000 borrowed. A card balance of $1,950 is charged at 21.6% a year. The employer contributes 50% of what Case R puts in, up to the first 6% of pay; Case R currently elects 5%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the monthly living costs come to?',
            given: { rent: 1180, utilities: 155, food: 430, transport: 210, phone: 52, rentersIns: 18 },
            expr: 'rent + utilities + food + transport + phone + rentersIns', format: 'usd', answer: '$2,045.00',
            reasoning: 'The six recurring costs added. Rent alone is $1,180 of it, which is why the largest line is the one a plan has least room to move.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly student loan payment?',
            given: { loanBalance: 18400, factor: 10.79 }, expr: 'round(loanBalance / 1000 * factor, 2)', format: 'usd', answer: '$198.54',
            reasoning: '18.4 thousands borrowed at $10.79 a month each. The factor already accounts for the rate and the 120-payment term.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the card balance cost in interest each month?',
            given: { cardBalance: 1950, cardApr: 0.216 }, expr: 'round(cardBalance * cardApr / 12, 2)', format: 'usd', answer: '$35.10',
            reasoning: 'One twelfth of 21.6% on $1,950. This is a cost that continues every month the balance is carried, and it is not a committed payment in the way the loan is.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find the surplus, and check what the current retirement election leaves on the table.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is committed each month, counting living costs and the loan payment?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$2,243.54',
            reasoning: '$2,045.00 of living costs plus the $198.54 loan payment. The card interest is not added here because it is a charge on a balance rather than a required payment.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What monthly surplus remains?',
            given: { monthlyTakeHome: 3174.58 }, expr: 'round(monthlyTakeHome - #t2-p1, 2)', format: 'usd', answer: '$931.04',
            reasoning: '$3,174.58 of take-home less $2,243.54 committed. Every later capstone decision is an allocation of this figure.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What employer retirement contribution does the current 5% election earn across the year?',
            given: { gross: 54600, electedRate: 0.05, matchShare: 0.5 }, expr: 'gross * electedRate * matchShare', format: 'usd', answer: '$1,365.00',
            reasoning: '50% of the 5% of $54,600 that Case R contributes.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much employer contribution is left unclaimed by electing 5% rather than 6%?',
            given: { gross2: 54600, fullTier: 0.06, matchShare2: 0.5 },
            expr: 'gross2 * fullTier * matchShare2 - #t2-p3', format: 'usd', answer: '$273.00',
            reasoning: 'The full contribution at 6% is $1,638.00 against $1,365.00 earned at 5%. Claiming it would require Case R to contribute a further $546 across the year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Add to the capstone record. Write the assumptions page.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write the assumptions page of the capstone record. State the three assumptions this monthly plan most depends on, say for each what would happen to the $931.04 surplus if it turned out to be wrong, and decide whether to raise the retirement election to 6% — defending whichever way you decide.',
            acceptableAnswerCriteria: [
              'Names at least three genuine assumptions with their effect — for example that the $430 food and $210 transport figures hold rather than drift, that the $1,180 rent does not rise at renewal, that income continues for all 12 months, or that nothing unplanned arrives.',
              'Quantifies at least one: a rent increase of 5% would take about $59 a month out of the $931.04, and a month without income removes the surplus entirely and $2,243.54 besides.',
              'Reaches a defended decision on the retirement election, using the $273.00 unclaimed and the $546 it would cost to claim it, rather than asserting a preference.',
              'Notes that the card interest of $35.10 a month is a cost the plan carries whether or not the surplus is allocated to it.',
            ],
            evidenceRequirements: [
              'Uses the $931.04 monthly surplus and the $273.00 of unclaimed employer contribution.',
              'Attaches a figure to at least one assumption failing.',
            ],
            dimensions: ['assumption-identification', 'plan-coherence', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The assumptions named are ones the plan actually depends on, not general uncertainties.',
              'The retirement decision is defended with the $273.00 and the $546 rather than with a rule of thumb.',
            ],
            defensibleAlternatives: [
              'Raise the election to 6%, claiming the remaining $273.00 and accepting $546 less of surplus across the year.',
              'Hold at 5% and direct the $546 to the card at 21.6% or to a reserve, on the grounds that the first year needs liquidity and the unclaimed amount is small relative to that need.',
              'Raise the election to 6% only after the $1,950 card balance is cleared, sequencing the two rather than choosing between them permanently.',
            ],
            commonMisconception: 'Treating an unclaimed employer contribution as free money that must always be taken, without pricing the $546 of surplus it costs to claim it in a year when that surplus has other work to do.',
          },
        ],
      },
    ],
    remediation: 'If the surplus comes out at $895.94, the $35.10 of card interest has been added to the committed total. Interest is a charge on the balance, not a required monthly payment, and treating it as committed double-counts it once the surplus is allocated to the card. Commit the $2,045.00 of living costs and the $198.54 loan payment only.',
    extension: 'Recompute the surplus for the same fictional case with rent at $1,340 rather than $1,180, and say what proportion of the surplus a single change in the largest line consumes.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l05',
    grade: 12, unit: 7, day: 5,
    isCapstone: true,
    actor: 'Case R, tested against two stated shocks',
    objective: 'Test the fictional capstone plan against a loss of income and against a large unplanned expense, and establish which of the two it survives.',
    scenario: 'This lesson stress-tests the capstone plan for Case R, the fictional adult, or for the learner’s own invented fictional profile. The shocks are stated cases used to test the plan; they are not predictions, and no part of this lesson concerns the learner’s own circumstances.',
    materials: ['calculator', 'the Case R figures in these directions', 'the capstone record'],
    domains: ['budgeting', 'insurance-risk', 'saving-investing', 'debt', 'income', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Case R has living costs of $2,045 a month and a student loan payment of $198.54 that continues whatever happens to income. The reserve holds $1,600 at the start of the year and receives $400 a month. Shock A is 3 months with no income at all. Shock B is a single unplanned expense of $4,200. Note one thing the figures below leave out: the $2,040 health premium was deducted from pay, so with no pay there is no deduction, and keeping that cover through the shock would be a further cost this test does not include.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do living costs come to across the 3 months of shock A?',
            given: { essentials: 2045 }, expr: 'essentials * 3', format: 'usd', answer: '$6,135.00',
            reasoning: '$2,045 a month for the 3 months. These costs do not stop when income does, which is what makes the shock a cash problem rather than only an income problem.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do the loan payments come to across the same 3 months?',
            given: { loanPayment: 198.54 }, expr: 'loanPayment * 3', format: 'usd', answer: '$595.62',
            reasoning: '$198.54 in each of the 3 months. A loan payment is an obligation rather than a discretionary cost, so it belongs in the shock calculation.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does shock A require in total?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$6,730.62',
            reasoning: '$6,135.00 of living costs plus $595.62 of loan payments across the 3 months with no income.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the reserve against each shock.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the reserve hold after a full year of $400 monthly transfers?',
            given: { openingReserve: 1600, monthlyTransfer: 400 }, expr: 'openingReserve + monthlyTransfer * 12', format: 'usd', answer: '$6,400.00',
            reasoning: 'The $1,600 opening balance plus $4,800.00 added across the 12 months. This assumes no withdrawal during the year, which is the best case rather than the expected one.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does shock A exceed the reserve?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$330.62',
            reasoning: '$6,730.62 needed against $6,400.00 held. The plan comes close and does not quite hold, which is a more useful finding than a plan that fails outright.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the reserve hold after shock B instead?',
            given: { repairCost: 4200 }, expr: '#t2-p1 - repairCost', format: 'usd', answer: '$2,200.00',
            reasoning: '$6,400.00 less the $4,200 expense. Shock B is absorbed without borrowing, which is exactly what the reserve is for.',
          },
          {
            ref: 't2-p4', kind: 'numeric',
            text: 'How many months of living costs would the reserve cover after shock B? Give two decimal places.',
            given: { essentials2: 2045 }, expr: 'round(#t2-p3 / essentials2, 2)', format: 'dec2', answer: '1.08',
            reasoning: '$2,200.00 against $2,045 a month. Surviving one shock leaves the fictional adult barely covered against a second, which is the position a stress test is meant to reveal.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Add the stress-test findings to the capstone record.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Record what this stress test found. State plainly which shock the plan survives and which it does not, decide what to change in response, and say what your change costs elsewhere in the plan. Explain why leaving the plan as it is could also be defended.',
            acceptableAnswerCriteria: [
              'States the findings correctly: shock B is absorbed with $2,200.00 remaining, and shock A falls short by $330.62 even after a full year of untouched saving.',
              'Notes what makes the shock A result worse than it looks: the $6,400.00 assumes nothing was withdrawn all year, after shock B the reserve covers only 1.08 months, and the figures exclude the cost of keeping health cover once pay stops.',
              'Either proposes a specific change with its cost — raising the monthly transfer above $400 and naming what loses that money, extending the loan term to reduce the $198.54, or reducing a living cost line and saying which — or decides explicitly to change nothing and states the $330.62 exposure that decision keeps.',
              'Explains why no change is also defensible: the shortfall is $330.62 on a 3-month total loss of income, which is a narrow miss against a severe scenario, and the surplus may have more valuable work to do against the card at 21.6%.',
            ],
            evidenceRequirements: [
              'Uses the $6,730.62 requirement for shock A, the $6,400.00 reserve, and the $330.62 shortfall.',
              'States the cost of the proposed change in figures or clearly named terms.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response distinguishes the shock the plan survives from the one it does not, rather than reporting a single verdict.',
              'The response notices that the $6,400.00 figure assumes an untouched year.',
            ],
            defensibleAlternatives: [
              'Raise the monthly reserve transfer above $400 until the reserve clears $6,730.62, accepting slower progress on the card balance.',
              'Leave the transfer at $400 and clear the $1,950 card balance first, on the grounds that removing a 21.6% charge strengthens the plan against every future month.',
              'Accept the $330.62 shortfall as a tolerable gap against a severe scenario and change nothing, provided the record says so explicitly rather than by omission.',
            ],
            commonMisconception: 'Treating a reserve that survives one shock as adequate, without checking what it covers once that shock has been paid for.',
          },
        ],
      },
    ],
    remediation: 'If shock A appears to be covered, the loan payment has probably been left out. Income stopping does not stop the $198.54 payment, so the 3 months require $6,135.00 of living costs plus $595.62 of loan payments — $6,730.62 against a reserve of $6,400.00.',
    extension: 'Work out what monthly reserve transfer would have covered shock A in full by the end of the year, and say what that transfer would have to displace in the $931.04 surplus.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l06',
    grade: 12, unit: 7, day: 6,
    isCapstone: true,
    actor: 'Case R, with two complete competing plans for the same surplus',
    objective: 'Compare two complete allocations of the fictional capstone surplus on their own terms, confirm both are internally consistent, and defend one without treating the other as wrong.',
    scenario: 'This lesson compares two plans for Case R, the fictional adult, or for the learner’s invented fictional profile. Both plans are complete and defensible; the capstone does not have one correct answer, and neither does this lesson.',
    materials: ['calculator', 'the two fictional plans in these directions', 'the capstone record'],
    domains: ['budgeting', 'debt', 'saving-investing', 'credit', 'insurance-risk', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Case R has a monthly surplus of $931.04 and a card balance of $1,950. Plan 1 allocates $400 to the reserve, $331.04 to the card, and $200 to extra retirement saving. Plan 2 allocates $200 to the reserve and $731.04 to the card, with nothing extra to retirement.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does Plan 1 add to the reserve across a year?',
            given: { plan1Reserve: 400 }, expr: 'plan1Reserve * 12', format: 'usd', answer: '$4,800.00',
            reasoning: '$400 in each of the 12 months. This is the larger of the two reserve paths and is what the earlier stress test found the plan needed.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does Plan 2 add to the reserve across a year?',
            given: { plan2Reserve: 200 }, expr: 'plan2Reserve * 12', format: 'usd', answer: '$2,400.00',
            reasoning: '$200 in each of 12 months — half of what Plan 1 builds.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'Ignoring interest, how many months would Plan 1 take to clear the card? Give one decimal place.',
            given: { cardBalance: 1950, plan1Card: 331.04 }, expr: 'round(cardBalance / plan1Card, 1)', format: 'dec1', answer: '5.9',
            reasoning: '$1,950 at $331.04 a month. Interest is ignored as stated, so the real figure is slightly higher; the comparison between the two plans is unaffected because the same simplification applies to both.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now complete both plans and check they are consistent.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'Ignoring interest, how many months would Plan 2 take to clear the card? Give one decimal place.',
            given: { cardBalance2: 1950, plan2Card: 731.04 }, expr: 'round(cardBalance2 / plan2Card, 1)', format: 'dec1', answer: '2.7',
            reasoning: '$1,950 at $731.04 a month — roughly 3.2 months sooner than Plan 1, which is about $63 of interest avoided at 21.6% on a falling balance.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much extra retirement saving does Plan 1 add across a year?',
            given: { plan1Extra: 200 }, expr: 'plan1Extra * 12', format: 'usd', answer: '$2,400.00',
            reasoning: '$200 a month across 12 months. This earns no further employer contribution, because Case R’s election already sits inside the tier that the employer contributes on.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Plan 1 allocate in total each month?',
            given: { plan1Reserve2: 400, plan1Card2: 331.04, plan1Extra2: 200 },
            expr: 'plan1Reserve2 + plan1Card2 + plan1Extra2', format: 'usd', answer: '$931.04',
            reasoning: 'The three components of Plan 1. Checking that a plan spends exactly the surplus, and no more, is what makes it a plan rather than a list of intentions.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does Plan 2 allocate in total each month?',
            given: { plan2Reserve2: 200, plan2Card2: 731.04 }, expr: 'plan2Reserve2 + plan2Card2', format: 'usd', answer: '$931.04',
            reasoning: 'The two components of Plan 2, which come to the same $931.04. Both plans are complete; they differ in where the money goes, not in how much there is.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Write the comparison into the capstone record.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Both plans allocate exactly $931.04 and both are internally consistent. Defend one of them as the plan you would put forward for this fictional case. Say what your choice gives up, state the circumstance in which the other plan would be the better one, and identify the figure that would most change your answer.',
            acceptableAnswerCriteria: [
              'Defends one plan with figures rather than preference — Plan 2 on the grounds that clearing a 21.6% balance in 2.7 months rather than 5.9 removes the most expensive charge fastest, or Plan 1 on the grounds that $4,800.00 of reserve leaves the fictional adult far better placed against the shock that was shown to break the plan.',
              'Names what the choice gives up: Plan 2 leaves the reserve at $2,400.00 a year and abandons the extra retirement saving, while Plan 1 carries the card balance about 3.2 months longer.',
              'States the circumstance favouring the other plan — for example that Plan 2 is stronger if income is secure and the reserve is already adequate, while Plan 1 is stronger if a shock is plausible in the near term.',
              'Identifies the decisive figure, most defensibly the reserve balance or the card rate: a much larger existing reserve would favour Plan 2, and a much lower card rate would weaken its main argument.',
            ],
            evidenceRequirements: [
              'Uses the two reserve totals, $4,800.00 and $2,400.00, and the two card clearance figures, 5.9 and 2.7 months.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response argues for one plan without describing the other as a mistake.',
              'The response uses the earlier stress-test finding if it draws on the reserve argument.',
              'A defence that rests only on which plan "feels safer" is not credited; the figures have to do the work.',
            ],
            defensibleAlternatives: [
              'Plan 2, prioritising the 21.6% card balance so the most expensive charge is removed within about 3 months.',
              'Plan 1, prioritising the reserve because the stress test showed the plan failing a 3-month loss of income by $330.62.',
              'A third allocation that sequences the two — the whole surplus to the card until it is cleared, then the whole surplus to the reserve — provided the parts still sum to $931.04.',
            ],
            commonMisconception: 'Assuming the plan that pays the highest interest rate first must be correct, when the plan’s own stress test showed the reserve was the part that failed.',
          },
        ],
      },
    ],
    remediation: 'If the two plans appear to allocate different amounts, check each against the $931.04 surplus. Plan 1 is $400 plus $331.04 plus $200; Plan 2 is $200 plus $731.04. Both come to $931.04 exactly, and a plan that does not is either leaving money unallocated or spending money that is not there.',
    extension: 'Build a third complete plan that clears the card in under 4 months and still adds at least $300 a month to the reserve, and say what it has to give up to do both.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l07',
    grade: 12, unit: 7, day: 7,
    actor: 'a fictional filer who made two separate errors on a simulated return',
    objective: 'Reproduce two independent errors on a fictional return, compute the correct liability, and attribute the overstatement to each error separately.',
    scenario: 'The fictional return and the errors on it below are invented for this exercise. No real filing or taxpayer is described.',
    materials: ['calculator', 'the fictional return figures in these directions'],
    domains: ['taxes', 'income', 'saving-investing', 'consumer-protection'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional filer had wages of $49,800 and a pre-tax retirement contribution of $2,490. The fictional schedule allows a standard deduction of $9,000 and charges 10% on the first $10,400 of taxable income and 12% above it. The filer made two mistakes: they left the pre-tax contribution in taxable income, and they applied 12% to the whole of it rather than 10% to the first band.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the correct taxable income?',
            given: { wages: 49800, pretax: 2490, deduction: 9000 }, expr: 'wages - pretax - deduction', format: 'usd', answer: '$38,310.00',
            reasoning: '$49,800 less the $2,490 pre-tax contribution and the $9,000 standard deduction.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the correct tax?',
            given: { band1: 10400, lowRate: 0.1, midRate: 0.12 },
            expr: 'band1 * lowRate + (#t1-p1 - band1) * midRate', format: 'usd', answer: '$4,389.20',
            reasoning: '$1,040.00 on the first $10,400 plus 12% of the remaining $27,910.00.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What taxable income did the filer use?',
            given: { wages2: 49800, deduction2: 9000 }, expr: 'wages2 - deduction2', format: 'usd', answer: '$40,800.00',
            reasoning: 'Wages less the standard deduction only, with the $2,490 pre-tax contribution left in. Reproducing the filer’s own figure is what allows each error to be priced separately.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price each error on its own.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What tax did the filer compute, applying 12% to all of their taxable income?',
            given: { flatRate: 0.12 }, expr: '#t1-p3 * flatRate', format: 'usd', answer: '$4,896.00',
            reasoning: '12% of $40,800.00. The filer treated the band they fell in as the rate on everything they earned.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did the filer overstate the tax?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$506.80',
            reasoning: '$4,896.00 computed against $4,389.20 correct. Both errors pushed the figure in the same direction.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the overstatement comes from leaving the pre-tax contribution in taxable income?',
            given: { pretax2: 2490, midRate2: 0.12 }, expr: 'pretax2 * midRate2', format: 'usd', answer: '$298.80',
            reasoning: 'The $2,490 wrongly included would have been taxed at the 12% band it falls in, so this error alone accounts for $298.80.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much comes from applying 12% to the whole of taxable income rather than 10% to the first band?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$208.00',
            reasoning: 'The remainder of the $506.80 once the first error is accounted for. It equals 2% of the $10,400 first band, which is what charging 12% instead of 10% on that band costs.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Both errors made the filer overpay. Explain why the second error — applying one rate to everything — would produce a very different result for a filer with much higher income, and give one check that would have caught both errors without redoing the whole return.',
            acceptableAnswerCriteria: [
              'Explains the band structure: applying the top band to all income overstates the tax by the difference between the bands on every dollar below the threshold, so the error grows with how much income sits in the lower bands and would be far larger for a filer reaching the 22% band.',
              'Quantifies the present case: the error is exactly 2% of the $10,400 first band, which is $208.00, and a filer in the 22% band would overstate by considerably more.',
              'Gives a workable check — comparing the computed tax against the income as a percentage and asking whether it can exceed the top band applied, or checking that the first $10,400 was charged at 10%.',
            ],
            evidenceRequirements: [
              'Uses the $506.80 total overstatement and its split into $298.80 and $208.00.',
            ],
            dimensions: ['error-diagnosis', 'transfer', 'criteria-application'],
            lookFors: [
              'The response attributes each part of the overstatement to the right error.',
              'The response recognises that the marginal band is not the rate on all income.',
            ],
            commonMisconception: 'Believing that reaching a tax band means all income is taxed at that band’s rate, rather than only the income above the threshold.',
          },
        ],
      },
    ],
    remediation: 'If the two errors do not add to $506.80, check each separately. Leaving $2,490 in taxable income costs 12% of it, which is $298.80. Charging the first $10,400 at 12% rather than 10% costs 2% of $10,400, which is $208.00. Together they account for the whole overstatement.',
    extension: 'Recompute both errors for a fictional filer with taxable income of $58,000 under the same schedule, where the 22% band applies, and say which error grows more.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l08',
    grade: 12, unit: 7, day: 8,
    actor: 'a fictional worker with wages and a second, unwithheld income',
    objective: 'Carry the withholding method onto a fictional case with a second income no employer withholds from, and derive the quarterly amount that has to be set aside.',
    scenario: 'The fictional wages, side income, and invented self-employment levy below exist only for this exercise.',
    materials: ['calculator', 'the fictional income figures and tax schedule in these directions'],
    domains: ['taxes', 'income', 'budgeting', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker earned $38,400 in wages, with $2,780 of federal income tax withheld, and $9,600 from independent work with nothing withheld. Under the fictional schedule, taxable income is total income less a standard deduction of $9,000, charged at 10% on the first $10,400 and 12% above it to $44,000. A fictional self-employment levy of 15.3% applies to the independent income only.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is taxable income for the year?',
            given: { wages: 38400, sideIncome: 9600, deduction: 9000 },
            expr: 'wages + sideIncome - deduction', format: 'usd', answer: '$39,000.00',
            reasoning: 'Both incomes added, less one $9,000 standard deduction. Independent income is taxed alongside wages, not separately.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the federal income tax?',
            given: { band1: 10400, lowRate: 0.1, midRate: 0.12 },
            expr: 'band1 * lowRate + (#t1-p1 - band1) * midRate', format: 'usd', answer: '$4,472.00',
            reasoning: '$1,040.00 on the first $10,400 plus 12% of the remaining $28,600.00.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the self-employment levy on the independent income?',
            given: { sideIncome2: 9600, seLevy: 0.153 }, expr: 'sideIncome2 * seLevy', format: 'usd', answer: '$1,468.80',
            reasoning: '15.3% of $9,600. This levy applies only to the independent income, and it is charged in addition to income tax rather than instead of it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what is still owed and what has to be set aside for it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is owed in total for the year?',
            given: {}, expr: '#t1-p2 + #t1-p3', format: 'usd', answer: '$5,940.80',
            reasoning: '$4,472.00 of income tax plus $1,468.80 of self-employment levy.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What remains owed after the wages withholding is credited?',
            given: { withheld: 2780 }, expr: '#t2-p1 - withheld', format: 'usd', answer: '$3,160.80',
            reasoning: '$5,940.80 owed against $2,780 withheld. The employer withheld against the wages alone and had no knowledge of the independent income, so the gap is structural rather than an error.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Spread across 4 quarterly set-asides, how much is that each time?',
            given: {}, expr: 'round(#t2-p2 / 4, 2)', format: 'usd', answer: '$790.20',
            reasoning: '$3,160.80 across 4 quarters. Setting money aside on the same rhythm the liability accrues is what keeps a filing deadline from arriving as a surprise.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the amount still owed is attributable to the independent income itself — income tax on it at the 12% band plus the 15.3% levy?',
            given: { sideIncome3: 9600, midRate3: 0.12, seLevy2: 0.153 },
            expr: 'sideIncome3 * (midRate3 + seLevy2)', format: 'usd', answer: '$2,620.80',
            reasoning: 'The independent income sits entirely above the standard deduction and the 10% band, which the wages already used, so every dollar of it is taxed at 12% and carries the full 15.3% levy — together 27.30% of $9,600. The remaining $540.00 of the $3,160.80 is not caused by the side work at all: it is wage income tax the employer under-withheld, and it would be owed even if the independent work had never happened.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Someone earning $9,600 from independent work might reasonably plan around having $9,600. Explain what is wrong with that, describe the practice you would recommend for a fictional person in this position, and say what makes the 32.93% figure specific to this case rather than a general rule.',
            acceptableAnswerCriteria: [
              'Explains the error: $2,620.80 of the $9,600 — 27.30% of it — is already committed to tax, so treating the whole amount as available overstates spendable income by more than a quarter and produces a bill with nothing set aside for it.',
              'Describes a workable practice: move a fixed proportion of every payment received into a separate account on receipt, rather than computing the liability once a year, and set aside $790.20 each quarter.',
              'Separates the two causes: $2,620.80 of the bill follows from the independent income at 12% plus the 15.3% levy, and the remaining $540.00 is wage income tax the employer under-withheld, which would have been owed regardless.',
              'Explains what makes the 27.30% share case-specific: the wages already used the standard deduction and the 10% band, so every dollar of independent income falls in the 12% band — a person with lower wages would face a lower share.',
            ],
            evidenceRequirements: [
              'Uses the $3,160.80 still owed, the $790.20 quarterly figure, and the $2,620.80 attributable to the independent income.',
            ],
            dimensions: ['transfer', 'plan-coherence', 'assumption-identification'],
            lookFors: [
              'The response explains why the share is not a general rule of thumb.',
              'The response names where the set-aside money is held between quarters.',
            ],
            commonMisconception: 'Assuming that income arriving without withholding carries no tax, when it carries both income tax and, in this fictional schedule, a levy the employer would otherwise have shared.',
          },
        ],
      },
    ],
    remediation: 'If the amount owed comes out at $1,692.00, only the income tax has been counted and the self-employment levy has been left out; if it comes out at $5,940.80, the $2,780 already withheld has not been credited. Add both charges, then subtract what the employer already collected. Note that the whole $3,160.80 is not caused by the side work: $540.00 of it is wage tax the employer under-withheld.',
    extension: 'Recompute the quarterly set-aside for a fictional worker with the same $9,600 of independent income but only $16,000 of wages, and say why the share of the side income committed to tax falls.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l09',
    grade: 12, unit: 7, day: 9,
    isCapstone: true,
    actor: 'Case R, with every strand of the simulated year totalled on one page',
    objective: 'Total the fictional capstone year across every strand — spending, borrowing, retirement, protection, tax, and reserve — and identify what remains unallocated.',
    scenario: 'This lesson totals the whole simulated year for Case R, the fictional adult, or for the learner’s invented fictional profile. Every figure is invented, and the capstone at no point uses or asks for the learner’s own financial information.',
    materials: ['calculator', 'the Case R annual figures in these directions', 'the capstone record'],
    domains: ['budgeting', 'taxes', 'debt', 'saving-investing', 'insurance-risk', 'income', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'For Case R the year’s figures are: take-home pay $38,095, living costs $2,045 a month, a student loan payment of $198.54 a month, a retirement contribution of $2,730 with an employer contribution of $1,365, a health premium of $2,040 taken before tax, renters insurance of $18 a month inside the living costs, total tax of $11,735, and a reserve transfer of $400 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do living costs come to across the year?',
            given: { essentials: 2045 }, expr: 'essentials * 12', format: 'usd', answer: '$24,540.00',
            reasoning: '$2,045 in each of the 12 months — the largest single use of take-home pay.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do the loan payments come to across the year?',
            given: { loanPayment: 198.54 }, expr: 'round(loanPayment * 12, 2)', format: 'usd', answer: '$2,382.48',
            reasoning: '$198.54 in each of the 12 months.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What goes into retirement across the year, counting both contributions?',
            given: { ownContribution: 2730, employerContribution: 1365 },
            expr: 'ownContribution + employerContribution', format: 'usd', answer: '$4,095.00',
            reasoning: 'The $2,730 Case R contributes plus the $1,365 the employer adds. Only the first came out of pay; the second is additional and appears nowhere in take-home.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now complete the year and find what has not been accounted for.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the year’s insurance premiums come to, counting the pre-tax health premium and renters insurance?',
            given: { healthPrem: 2040, rentersIns: 18 }, expr: 'healthPrem + rentersIns * 12', format: 'usd', answer: '$2,256.00',
            reasoning: 'The $2,040 health premium plus $216.00 of renters insurance. The health premium was taken before tax and so does not appear in take-home, while the renters premium sits inside the monthly living costs.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is added to the reserve across the year?',
            given: { reserveMonthly: 400 }, expr: 'reserveMonthly * 12', format: 'usd', answer: '$4,800.00',
            reasoning: '$400 in each of the 12 months.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Of the take-home pay, how much is left once living costs, loan payments, and the reserve transfer are taken out?',
            given: { takeHome: 38095 }, expr: 'takeHome - #t1-p1 - #t1-p2 - #t2-p2', format: 'usd', answer: '$6,372.52',
            reasoning: '$38,095 less $24,540.00, $2,382.48, and $4,800.00. This is the amount still to be allocated between the card, extra retirement saving, and anything else — and it is the part of the year a plan is actually deciding.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Write the annual summary page of the capstone record.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write the annual summary. Report where the year’s money went across every strand, say which single figure you think best describes whether the year went well, and decide what to do with the $6,372.52 that remains — defending the decision and naming what it forgoes.',
            acceptableAnswerCriteria: [
              'Reports the strands accurately with figures: $24,540.00 on living costs, $2,382.48 on the loan, $4,800.00 to the reserve, $4,095.00 into retirement counting both contributions, $2,256.00 on insurance, and $11,735.00 in tax.',
              'Proposes a summary measure and justifies it — total saved and invested across the year, the reserve expressed in months of living costs, or the change in what is owed — rather than picking a figure without a reason.',
              'Decides what happens to the $6,372.52 and defends it with a figure, for example clearing the $1,950 card balance and directing the rest to the reserve or to retirement.',
              'Names what the decision forgoes, so the allocation is presented as a choice rather than as the only option.',
              'Distinguishes money spent from money that moved between the fictional adult’s own accounts.',
            ],
            evidenceRequirements: [
              'Uses at least four of the annual strand totals, including the $11,735.00 of tax and the $4,095.00 into retirement.',
              'States the disposal of the $6,372.52 in figures.',
            ],
            dimensions: ['plan-coherence', 'evidence-use', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The summary keeps the employer contribution separate from the fictional adult’s own contribution.',
              'The summary does not double-count the renters premium, which sits inside the living costs total.',
              'The chosen summary measure is defended rather than assumed.',
            ],
            defensibleAlternatives: [
              'Clear the $1,950 card balance from the $6,372.52 and direct the remainder to the reserve, ending the 21.6% charge first.',
              'Clear the card and direct the remainder to retirement, accepting a thinner reserve in exchange for more invested in a long-horizon account.',
              'Split the remainder between the reserve and retirement without clearing the card in full, if the record states why carrying part of the balance is acceptable.',
            ],
            commonMisconception: 'Judging a financial year by how much was spent, when the strands that decide whether the year went well are what was saved, what was owed, and what protection was in place at the end of it.',
          },
        ],
      },
    ],
    remediation: 'If the unallocated figure comes out at $4,332.52, the $2,040 health premium has been subtracted from take-home pay; if it comes out at $3,642.52, the $2,730 retirement contribution has. Both were taken before tax and so are already outside the $38,095 of take-home. Subtract only the living costs, the loan payments, and the reserve transfer.',
    extension: 'Rebuild the annual summary with living costs 6% higher and everything else unchanged, and say what happens to the unallocated figure and to the plan that depends on it.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l10',
    grade: 12, unit: 7, day: 10,
    isCapstone: true,
    actor: 'Case R, presented as a complete documented plan',
    objective: 'Produce the fictional capstone plan document: what the year makes available, what it commits, what it builds, and what it assumes — with every claim carrying a figure.',
    scenario: 'This is the capstone performance task, written for Case R, the fictional adult, or for the fictional profile the learner invented. It is entirely about the fictional case: no part of it asks what the learner earns, owes, owns, holds, is insured for, or has filed.',
    materials: ['calculator', 'the Case R figures in these directions', 'the complete capstone record'],
    domains: ['income', 'taxes', 'budgeting', 'debt', 'credit', 'saving-investing', 'insurance-risk', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'For Case R: pay of $54,600 with an employer retirement contribution of $1,365, total tax of $11,735, pre-tax elections of $4,770, a monthly allocation of $931.04, an opening reserve of $1,600 with $400 a month added, living costs of $2,045 a month, an own retirement contribution of $2,730, and a further $2,400 of extra retirement saving across the year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the year make available in total, counting the employer contribution?',
            given: { gross: 54600, employerContribution: 1365 }, expr: 'gross + employerContribution', format: 'usd', answer: '$55,965.00',
            reasoning: '$54,600 of pay plus the $1,365 the employer contributes. The employer amount is real value that never appears in a paycheque, so it belongs in a total-resources figure and not in a cash-flow one.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of those total resources never arrives as spendable cash — tax, the pre-tax elections, and the employer contribution together?',
            given: { totalTax: 11735, preTaxElections: 4770, employerContribution3: 1365 },
            expr: 'totalTax + preTaxElections + employerContribution3', format: 'usd', answer: '$17,870.00',
            reasoning: '$11,735 of tax, $4,770 of pre-tax elections, and the $1,365 employer contribution. All three are inside the $55,965.00 of total resources and none of them reaches the account, so all three belong in the numerator; leaving the employer contribution out would divide by a total that includes it. Only the $11,735 of tax is a cost — the elections buy cover and fund an account Case R still owns, and the employer contribution is money added on their behalf.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the total resources is that, to two decimal places?',
            given: {}, expr: 'round(#t1-p2 / #t1-p1 * 100, 2)', format: 'percent2', answer: '31.93%',
            reasoning: '$17,870.00 measured against $55,965.00, which is the same as the gap between total resources and the $38,095 of take-home pay. Naming the share is useful provided the plan also says how much of it is cost and how much is transfer.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now assemble what the year builds.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is allocated from the surplus across the whole year?',
            given: { monthlyAllocation: 931.04 }, expr: 'round(monthlyAllocation * 12, 2)', format: 'usd', answer: '$11,172.48',
            reasoning: '$931.04 in each of the 12 months. This is the amount the plan actually directs, as distinct from the amount the year consumes.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the reserve hold at the end of the year?',
            given: { openingReserve: 1600, reserveMonthly: 400 },
            expr: 'openingReserve + reserveMonthly * 12', format: 'usd', answer: '$6,400.00',
            reasoning: 'The $1,600 opening balance plus $4,800.00 added, assuming nothing was withdrawn.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'How many months of living costs does that reserve cover? Give two decimal places.',
            given: { essentials: 2045 }, expr: 'round(#t2-p2 / essentials, 2)', format: 'dec2', answer: '3.13',
            reasoning: '$6,400.00 against $2,045 a month. Stating a reserve in months rather than dollars is what makes it meaningful against this household’s own costs.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'One more figure before writing.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'How much goes into retirement across the year in total, counting Case R’s own contribution, the employer contribution, and the extra saving?',
            given: { ownContribution: 2730, employerContribution2: 1365, extraContribution: 2400 },
            expr: 'ownContribution + employerContribution2 + extraContribution', format: 'usd', answer: '$6,495.00',
            reasoning: '$2,730 elected, $1,365 from the employer, and $2,400 saved on top. Of this, $4,095.00 was arranged before any surplus decision was made.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write the capstone plan document. Every claim carries a figure.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the complete capstone plan for this fictional case. Cover what the year makes available, what it commits, what it builds, and how it is protected. State the three tradeoffs the plan makes and what each one costs, name the assumption the whole plan is most sensitive to, and say explicitly what a reader would have to believe for a different plan to be better than yours.',
            acceptableAnswerCriteria: [
              'Reports the year accurately across strands, using at least the $55,965.00 of total resources, the $17,870.00 that never arrives as spendable cash, and the $11,172.48 allocated from surplus.',
              'States what the year as given builds, with figures: a reserve of $6,400.00 covering 3.13 months of living costs, and $6,495.00 into retirement. Where the plan proposed differs from that allocation, it restates both figures under its own allocation instead.',
              'Names three genuine tradeoffs with costs attached — for example reserve against card repayment, extra retirement saving against liquidity, or the retirement election against monthly take-home — rather than listing three good things the plan does.',
              'Identifies the most sensitive assumption and says why, most defensibly the continuity of income, since the stress test showed a 3-month loss exceeding the reserve, or the stability of the $1,180 rent as the largest single cost.',
              'States what would have to be true for a different plan to be better, so the document presents its own conclusion as one defensible answer rather than the answer.',
              'Distinguishes cost from transfer throughout, treating tax as cost and retirement contributions as retained.',
            ],
            evidenceRequirements: [
              'Uses at least five distinct figures drawn from across the capstone, including the reserve of $6,400.00 and the retirement total of $6,495.00.',
              'Attaches a cost to each of the three named tradeoffs.',
              'States the condition under which a different plan would be preferable.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'evidence-use', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The plan is internally consistent: the monthly allocations sum to $931.04 and the annual figures follow from them.',
              'Very different plans earn full credit — a reserve-first plan, a debt-first plan, and a retirement-weighted plan are all defensible on these figures.',
              'A plan that claims to be the only sensible course is marked down on the uncertainty dimension however strong its arithmetic.',
              'A plan built on a learner-invented fictional profile is scored on the same criteria, provided its figures are internally consistent and invented.',
            ],
            defensibleAlternatives: [
              'A protection-first plan that builds the reserve past $6,730.62 before anything else, accepting slower repayment and less retirement saving.',
              'A debt-first plan that clears the $1,950 card and then attacks the $18,400 loan balance ahead of schedule, accepting a thinner reserve for longer.',
              'A long-horizon plan that raises the retirement election to at least 6% and contributes the extra $2,400, accepting less liquidity in exchange for more invested early.',
              'A balanced plan that sequences all three — card first, then reserve to three months, then retirement — provided the sequencing is stated and the figures still sum to $931.04 a month.',
            ],
            commonMisconception: 'Presenting a financial plan as the correct answer, when a plan is a set of tradeoffs that different reasonable priorities would settle differently.',
          },
        ],
      },
    ],
    remediation: 'If the total resources figure comes out at $54,600, the employer retirement contribution has been left out. If the share that never arrives as spendable cash comes out near 21%, only the tax has been counted; if it comes out at 29.49%, the $1,365 employer contribution is in the denominator but not the numerator, which compares two different things. Build the numerator from all three, then say in the plan how much of it is cost and how much is transfer.',
    extension: 'Rewrite the plan for a fictional profile with the same pay but $520 a month of childcare costs, and say which of your three tradeoffs changes first.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u07-l11',
    grade: 12, unit: 7, day: 11,
    isCapstone: true,
    actor: 'Case R, defending the plan against a harder shock than it was built for',
    objective: 'Defend the fictional capstone plan against a shock it does not survive, quantify the gap under two responses, and state what the plan would sacrifice to close it.',
    scenario: 'This is the capstone defence, run on Case R, the fictional adult, or on the learner’s invented fictional profile. The shock is a stated scenario for testing the plan, not a prediction, and nothing in this lesson concerns the learner’s own finances, accounts, or circumstances.',
    materials: ['calculator', 'the Case R figures in these directions', 'the complete capstone record and plan'],
    domains: ['budgeting', 'insurance-risk', 'debt', 'saving-investing', 'income', 'taxes', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Case R ends the year with a reserve of $6,400, living costs of $2,045 a month, and a student loan payment of $198.54 a month that continues regardless of income. Test the plan against a harder shock than before: 5 months with no income at all. As in the earlier test, the figures exclude the cost of keeping health cover once pay stops, since the $2,040 premium was deducted from pay.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the 5-month shock require in total?',
            given: { essentials: 2045, loanPayment: 198.54 }, expr: '(essentials + loanPayment) * 5', format: 'usd', answer: '$11,217.70',
            reasoning: '$2,243.54 a month of living costs and loan payments across 5 months. The loan payment is included because it does not pause when income does.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does that exceed the reserve?',
            given: { reserve: 6400 }, expr: '#t1-p1 - reserve', format: 'usd', answer: '$4,817.70',
            reasoning: '$11,217.70 required against $6,400 held. This is a shortfall the plan has no answer to as written, which is what the defence has to address.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'How many months of full costs does the reserve alone cover? Give two decimal places.',
            given: { reserve2: 6400, essentials2: 2045, loanPayment2: 198.54 },
            expr: 'round(reserve2 / (essentials2 + loanPayment2), 2)', format: 'dec2', answer: '2.85',
            reasoning: '$6,400 against $2,243.54 a month. Expressed this way the reserve covers under 3 months, which is a clearer statement of the position than the dollar figure alone.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test two responses: cutting costs during the shock, and building a larger reserve in advance.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'If $285 a month of food and transport spending were cut during the shock, what would living costs fall to?',
            given: { essentials3: 2045, cutAmount: 285 }, expr: 'essentials3 - cutAmount', format: 'usd', answer: '$1,760.00',
            reasoning: '$2,045 less $285. Rent, utilities, phone, and insurance are not reduced here, because they are contracted amounts rather than discretionary ones.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'How many months would the reserve then cover, still paying the loan? Give two decimal places.',
            given: { reserve3: 6400, loanPayment3: 198.54 },
            expr: 'round(reserve3 / (#t2-p1 + loanPayment3), 2)', format: 'dec2', answer: '3.27',
            reasoning: '$6,400 against $1,958.54 a month. Cutting $285 a month buys about 0.42 of a month of additional cover — real, but far short of the 5 months the shock requires.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What additional monthly reserve transfer across the year would have closed the $4,817.70 gap?',
            given: {}, expr: 'round(#t1-p2 / 12, 2)', format: 'usd', answer: '$401.48',
            reasoning: 'The $4,817.70 shortfall spread across 12 months. This would roughly double the $400 monthly transfer and has to come out of the $931.04 surplus, which is what makes it a tradeoff rather than an improvement.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Write the capstone defence. This is the final entry in the record.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Defend the plan. State honestly what this shock shows it cannot withstand, decide whether to change the plan in response and say exactly what your decision costs, and answer the strongest objection to your decision. Finish by saying what someone with different priorities would reasonably do instead, and why that would also be defensible.',
            acceptableAnswerCriteria: [
              'States the finding without softening it: the plan does not survive a 5-month loss of income, falling $4,817.70 short, and covers only 2.85 months at full costs or 3.27 months with $285 a month cut.',
              'Reaches a decision and prices it: raising the reserve transfer by $401.48 a month would close the gap but consumes most of the $931.04 surplus, ending the card repayment and the extra retirement saving for the year.',
              'Answers the strongest objection to that decision — for example that holding $11,217.70 idle against a severe and uncertain event costs real progress on a 21.6% balance and on long-horizon saving, and that a 5-month total loss of income is a demanding standard to build to.',
              'Names what a different set of priorities would do and why it is defensible, so the defence acknowledges the absence of one correct plan rather than merely asserting its own.',
              'Distinguishes what the plan can control from what it cannot: the reserve, the allocation, and discretionary costs are choices, while the rent, the loan payment, and the tax are not.',
            ],
            evidenceRequirements: [
              'Uses the $11,217.70 requirement, the $4,817.70 shortfall, and the $401.48 additional monthly transfer.',
              'Uses both months-of-cover figures, 2.85 and 3.27, when discussing the effect of cutting costs.',
              'States the cost of the chosen decision in figures.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'communication-of-uncertainty', 'evidence-use', 'assumption-identification'],
            lookFors: [
              'The defence concedes the failure plainly rather than arguing the shock is unrealistic.',
              'The response notices that the $11,217.70 excludes the cost of keeping health cover once pay stops, so the true requirement is higher than the figure it defends against.',
              'Both a change-the-plan defence and a keep-the-plan defence earn full credit when the cost is priced and the objection is answered.',
              'The response recognises that cutting $285 a month buys only about 0.42 of a month, so cost-cutting alone is not an answer to a shock of this size.',
              'A defence that presents its own plan as the only reasonable one is marked down on uncertainty regardless of the arithmetic.',
            ],
            defensibleAlternatives: [
              'Raise the reserve transfer by $401.48 a month to withstand the 5-month shock, accepting that the card balance and the extra retirement saving stop for the year.',
              'Keep the plan as it is, on the grounds that a 5-month total loss of income is a severe standard and the surplus does more good against a 21.6% balance, provided the record states the exposure explicitly.',
              'Target a middle position — enough reserve for 4 months rather than 5 — and split the remaining surplus between the card and retirement, naming the residual exposure that leaves.',
              'Reduce the fixed costs rather than the plan: a smaller rent commitment would lower both the reserve target and the monthly requirement, at the cost of moving.',
            ],
            commonMisconception: 'Defending a plan by arguing that the shock which breaks it is unlikely, rather than stating the exposure and deciding, with reasons, whether to carry it.',
          },
        ],
      },
    ],
    remediation: 'If the shock requirement comes out at $10,225.00, the loan payment has been left out of the 5 months. Income stopping does not stop the $198.54 payment, so each month costs $2,243.54 rather than $2,045. If the additional transfer comes out near $940, the whole requirement is being spread across the year rather than only the $4,817.70 shortfall.',
    extension: 'Work out the reserve target and the monthly transfer that would let this fictional case withstand 5 months on reduced costs of $1,760 a month, and say how much of the $931.04 surplus that leaves for everything else.',
  },
]
