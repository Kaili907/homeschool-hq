import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 1 — PF1 Earning Income: Entering the Workforce: Offers,
 * Onboarding, and Pay.
 *
 * The senior move in this unit is that income is never treated as one number.
 * Every lesson makes the learner carry a pay figure across at least one other
 * domain — the fictional tax schedule, a benefit election, a budget, or a
 * retirement contribution — and several turn on the distinction the lower
 * grades can leave implicit: which denominator answers which question. Cash
 * that can pay a bill and total compensation that cannot are computed
 * separately and named separately throughout.
 *
 * The fictional federal schedule used across grade 12 is the grade 9 schedule
 * extended with a third band, so a senior can be asked to cross it:
 * taxable income is gross less a $9,000 standard deduction and any pre-tax
 * election; 10% on the first $10,400 of taxable income, 12% from $10,400 to
 * $44,000, and 22% above $44,000. The payroll levy of 7.65% is charged on
 * full gross with no deduction of any kind. Every rate here is invented.
 */
export const g12u01: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u01-l01',
    grade: 12, unit: 1, day: 1,
    actor: 'a fictional graduate holding two written offers at once',
    objective: 'Separate the cash an offer pays from the total compensation it reports, compute both for two fictional offers, and state which figure answers which question.',
    scenario: 'Two simulated written offers are set out below. Both employers, both salaries, and every benefit figure are fictional and exist only for this exercise.',
    materials: ['calculator', 'the fictional offer terms in these directions'],
    domains: ['income', 'insurance-risk', 'saving-investing', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer A: salary $52,000 a year; the employer adds a retirement contribution of 4% of salary; the employer pays $4,800 a year toward the health premium and the employee pays $1,560 a year. Offer B: salary $55,400 a year; no retirement contribution; the employer pays $2,400 a year toward the health premium and the employee pays $3,120 a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the employer contribute to retirement each year under Offer A?',
            given: { salary: 52000, matchRate: 0.04 }, expr: 'salary * matchRate', format: 'usd', answer: '$2,080.00',
            reasoning: '4% of the $52,000 salary. This is money paid into a retirement account on the worker’s behalf; it is real value but it is not available to spend this year.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total compensation Offer A reports — salary, employer retirement contribution, and the employer’s share of the health premium?',
            given: { salary2: 52000, employerHealth: 4800 }, expr: 'salary2 + #t1-p1 + employerHealth', format: 'usd', answer: '$58,880.00',
            reasoning: '$52,000 salary plus the $2,080 retirement contribution plus the $4,800 the employer pays toward the premium. This is the figure an offer letter leads with, and none of the last two components arrives as spendable pay.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total compensation Offer B reports on the same definition?',
            given: { salaryB: 55400, employerHealthB: 2400 }, expr: 'salaryB + employerHealthB', format: 'usd', answer: '$57,800.00',
            reasoning: '$55,400 salary plus the $2,400 employer premium share. Offer B has no retirement contribution to add.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compute what each offer actually puts in a bank account before tax, which is the only figure that can pay a bill.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Under Offer A, what is salary less the employee’s own share of the health premium?',
            given: { salary3: 52000, employeeHealth: 1560 }, expr: 'salary3 - employeeHealth', format: 'usd', answer: '$50,440.00',
            reasoning: 'The $1,560 the employee pays comes out of the $52,000 salary. The employer’s $4,800 share never passes through the worker’s pay at all, so it cannot be added here.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Under Offer B, what is salary less the employee’s own share of the health premium?',
            given: { salaryB2: 55400, employeeHealthB: 3120 }, expr: 'salaryB2 - employeeHealthB', format: 'usd', answer: '$52,280.00',
            reasoning: '$55,400 less the $3,120 employee premium share.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Before income tax, which offer leaves the fictional graduate more money able to pay rent this year?',
            choices: ['Offer A', 'Offer B'],
            decision: { left: '#t2-p2', cmp: '>', right: '#t2-p1', ifTrue: 'Offer B', ifFalse: 'Offer A' },
            answer: 'Offer B',
            reasoning: '$52,280.00 of spendable salary under B against $50,440.00 under A. Rent is paid out of this figure, not out of total compensation.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'By how much does Offer A’s reported total compensation exceed Offer B’s?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$1,080.00',
            reasoning: '$58,880.00 against $57,800.00. The two offers therefore rank in opposite orders on the two measures, which is the point of the lesson.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Offer A wins on total compensation and Offer B wins on spendable salary. Say which measure answers "can I afford to move out this year" and which answers "which employer is putting more resources behind this job", and name the one condition under which the $2,080 retirement contribution should count for very little.',
            acceptableAnswerCriteria: [
              'States that spendable salary — $50,440.00 against $52,280.00 — is the measure that answers an affordability question, because employer-paid premiums and retirement contributions cannot be used to pay rent in the year they are earned.',
              'States that total compensation — $58,880.00 against $57,800.00 — measures what the employer commits in total, and is the right frame for comparing the value of the whole package rather than this year’s cash.',
              'Names a condition that discounts the retirement contribution: a vesting requirement the worker may not stay long enough to meet, or an immediate cash need that a locked retirement account cannot meet.',
            ],
            evidenceRequirements: [
              'Uses both the $58,880.00 total compensation figure and the $50,440.00 spendable salary figure, and states which question each answers.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response keeps the two measures distinct rather than averaging them into a single ranking.',
              'The response does not treat the employer premium share as worthless; it is real value that simply cannot pay a bill this year.',
            ],
            commonMisconception: 'Ranking two offers on the largest number printed in the letter, without asking whether that number can be spent.',
          },
        ],
      },
    ],
    remediation: 'If Offer A wins both comparisons, the $4,800 employer premium share is probably being added to spendable pay. Trace where each figure goes: the employer’s $4,800 goes to the insurer directly and never reaches the worker’s account, while the employee’s $1,560 comes out of the salary. Rebuild the spendable figure using only salary and the employee’s own deduction.',
    extension: 'Suppose Offer A’s retirement contribution only vests after three years of service. Recompute what Offer A is worth to a fictional worker who expects to leave after two, and say which measure changes.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l02',
    grade: 12, unit: 1, day: 2,
    actor: 'a fictional new hire completing simulated onboarding elections',
    objective: 'Work a set of simulated pre-tax elections through to their effect on the fictional income tax and on the payroll levy, and show why the two behave differently.',
    scenario: 'The onboarding packet below is simulated. The employer, the plan, the salary, and every rate in the fictional tax schedule are invented for this exercise.',
    materials: ['calculator', 'the fictional onboarding terms and tax schedule in these directions'],
    domains: ['income', 'taxes', 'saving-investing', 'insurance-risk'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional hire is paid $48,600 a year. At onboarding they elect a retirement contribution of 6% of pay and a health premium of $1,800 a year, and both are taken before income tax is calculated. Under the fictional federal schedule, taxable income is pay less those pre-tax elections less a standard deduction of $9,000; the schedule then charges 10% on the first $10,400 of taxable income and 12% on the next band, which runs to $44,000. A separate payroll levy of 7.65% is charged on all pay, with no deduction and no election subtracted first.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the annual retirement contribution the election creates?',
            given: { gross: 48600, retireRate: 0.06 }, expr: 'gross * retireRate', format: 'usd', answer: '$2,916.00',
            reasoning: '6% of $48,600. The money leaves the paycheque but stays the worker’s own; it moves into a retirement account rather than being spent.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is taxable income under the fictional schedule after both elections and the standard deduction?',
            given: { gross2: 48600, healthPremium: 1800, deduction: 9000 }, expr: 'gross2 - #t1-p1 - healthPremium - deduction', format: 'usd', answer: '$34,884.00',
            reasoning: '$48,600 less the $2,916 retirement election, less the $1,800 premium, less the $9,000 standard deduction. All three come off before any rate is applied.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the fictional federal income tax on that taxable income?',
            given: { band1: 10400, lowRate: 0.1, midRate: 0.12 }, expr: 'band1 * lowRate + (#t1-p2 - band1) * midRate', format: 'usd', answer: '$3,978.08',
            reasoning: '10% of the first $10,400 is $1,040.00, and 12% of the remaining $24,484.00 is $2,938.08. Taxable income of $34,884.00 stays inside the second band, which runs to $44,000, so the third rate is not reached.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for the payroll levy, and compare how the two respond to the same election.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the payroll levy for the year at 7.65%?',
            given: { gross3: 48600, levyRate: 0.0765 }, expr: 'gross3 * levyRate', format: 'usd', answer: '$3,717.90',
            reasoning: '7.65% of the full $48,600. The schedule charges this levy on all pay, so neither the retirement election nor the premium nor the standard deduction reduces it.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Does electing the 6% retirement contribution reduce the payroll levy this fictional worker owes?',
            choices: ['Yes — the levy is charged on pay after the election', 'No — the levy is charged on the full $48,600 of pay'],
            given: { grossFull: 48600, levyRate2: 0.0765 },
            decision: { left: 'grossFull * levyRate2', cmp: '>', right: '(grossFull - #t1-p1) * levyRate2', ifTrue: 'No — the levy is charged on the full $48,600 of pay', ifFalse: 'Yes — the levy is charged on pay after the election' },
            answer: 'No — the levy is charged on the full $48,600 of pay',
            reasoning: 'The levy on the full $48,600 is $3,717.90; on $45,684 it would be $3,494.83. Because the schedule states the levy applies to all pay with no deduction, the larger figure is the one owed, and the election changes only the income tax.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'The retirement election removes $2,916.00 from taxable income, all of it inside the 12% band. What income tax does the election save this year?',
            given: { midRate2: 0.12 }, expr: '#t1-p1 * midRate2', format: 'usd', answer: '$349.92',
            reasoning: '12% of the $2,916.00 removed from taxable income. The saving is at the band the last dollars fell in, not at the average rate across the whole schedule.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fictional colleague says the 6% election "costs nothing because the tax saving covers it". Using the two figures you computed, say what is right and what is wrong in that claim, and explain what the $2,916.00 actually does to this year’s spendable pay.',
            acceptableAnswerCriteria: [
              'States what is wrong: the election removes $2,916.00 from this year’s spendable pay and returns only $349.92 in income tax saved, so the net reduction in cash available this year is $2,566.08 rather than nothing.',
              'States what is right: the $2,916.00 is not lost — it moves into the worker’s own retirement account, so the household’s total assets do not fall by the amount the paycheque falls.',
              'Notes that the payroll levy is unchanged at $3,717.90 either way, so the election reduces only one of the two charges.',
            ],
            evidenceRequirements: [
              'Uses both the $349.92 income tax saved and the $2,916.00 contribution, and states the difference between them.',
            ],
            dimensions: ['reasoning-from-figures', 'error-diagnosis', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes a reduction in spendable cash from a reduction in wealth.',
              'The response does not claim the election is a bad idea or a good one; it is priced, not judged.',
            ],
            commonMisconception: 'Treating a pre-tax election as free because it lowers a tax bill, without comparing the tax saved to the cash given up.',
          },
        ],
      },
    ],
    remediation: 'If the payroll levy comes out near $3,494.83, the retirement election has been subtracted before the 7.65% was applied. Reread the schedule: the levy is charged on all pay, with no deduction and no election taken off first. Only the income tax calculation gets the $2,916.00, the $1,800.00, and the $9,000.00.',
    extension: 'Recompute the taxable income, the income tax, and the levy if the same fictional worker raises the retirement election to 10%, and say which of the three figures does not move.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l03',
    grade: 12, unit: 1, day: 3,
    actor: 'a fictional employee checking a simulated pay statement line by line',
    objective: 'Verify each withholding line on a simulated pay statement against the stated rates, locate the line the employer computed on the wrong base, and size the error across a full year.',
    scenario: 'The pay statement reproduced below is simulated, and the employer that issued it is fictional. No real payroll record is involved.',
    materials: ['calculator', 'the fictional pay statement figures in these directions'],
    domains: ['income', 'taxes', 'banking', 'consumer-protection'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional employee earns $56,160 a year, paid over 26 pay periods. A retirement contribution of 5% of gross is deducted each period. The payroll levy is 7.65% and the schedule states it is charged on gross pay, before any deduction. The statement in front of the employee shows a levy of $156.98 for the period.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the gross pay for one period?',
            given: { annual: 56160, periods: 26 }, expr: 'annual / periods', format: 'usd', answer: '$2,160.00',
            reasoning: '$56,160 spread across 26 pay periods. Every other line on the statement is checked against this figure.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What should the payroll levy be for one period, charged on gross as the schedule states?',
            given: { levyRate: 0.0765 }, expr: 'round(#t1-p1 * levyRate, 2)', format: 'usd', answer: '$165.24',
            reasoning: '7.65% of the $2,160.00 gross. This is the correct base under the stated schedule.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'The statement’s levy matches 7.65% of gross after the 5% retirement deduction. What does that base produce?',
            given: { retireRate: 0.05, levyRate2: 0.0765 }, expr: 'round((#t1-p1 - #t1-p1 * retireRate) * levyRate2, 2)', format: 'usd', answer: '$156.98',
            reasoning: 'The retirement deduction is $108.00, leaving $2,052.00, and 7.65% of that is $156.98 — which is exactly the figure printed. That reproduces the number on the statement and identifies the base the employer used.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now size the error and decide what it is.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much less than the correct amount was withheld in this one period?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$8.26',
            reasoning: '$165.24 correct against $156.98 withheld.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If the same base is used all year, what does the shortfall come to across the 26 periods?',
            given: { periods2: 26 }, expr: '#t2-p1 * periods2', format: 'usd', answer: '$214.76',
            reasoning: '$8.26 in each of 26 periods. A per-period error small enough to overlook is what makes the annual figure worth computing.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Under the stated schedule, is the under-withheld levy money the fictional employee gets to keep?',
            choices: ['Yes — the employer set the amount, so the employee owes nothing further', 'No — the levy is owed on gross, so the shortfall remains due'],
            answer: 'No — the levy is owed on gross, so the shortfall remains due',
            reasoning: 'The schedule states the levy is charged on gross pay. An employer computing it on the wrong base changes what was collected, not what is owed, so the $214.76 is a liability the employee still carries. This is the fact of the stated schedule, not a comparison between two figures.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'Describe what this fictional employee should do next, in order, and say what they should keep. Explain why raising it at $8.26 a period is better than raising it at $214.76.',
            acceptableAnswerCriteria: [
              'Gives an ordered course of action: keep the statement, put the discrepancy to the employer’s payroll department in writing with the two figures, and keep a copy of what was sent and any reply.',
              'Explains that the error compounds silently — each period adds $8.26, so raising it early caps the liability, while waiting until year end leaves $214.76 to settle at once.',
              'Notes that the goal is a corrected calculation going forward, not an accusation: the wrong base is an error to be shown, and the arithmetic is what shows it.',
            ],
            evidenceRequirements: [
              'Uses both the $8.26 per-period difference and the $214.76 annual figure to justify raising it early.',
            ],
            dimensions: ['error-diagnosis', 'plan-coherence', 'evidence-use'],
            lookFors: [
              'The response names written documentation rather than a verbal mention alone.',
              'The response identifies the wrong base — pay after the retirement deduction — rather than only saying the number is wrong.',
            ],
            commonMisconception: 'Assuming an amount an employer withheld must be the amount owed, so a small discrepancy can be ignored.',
          },
        ],
      },
    ],
    remediation: 'If the correct levy comes out as $156.98, the retirement deduction is being taken off before the 7.65% is applied. The schedule says the levy is charged on gross pay. Compute 7.65% of the $2,160.00 gross first, and only then compare it with what the statement printed.',
    extension: 'Work out what the per-period and annual shortfall would be for a fictional colleague on the same statement format earning $2,700.00 a period with the same 5% election, and say whether the annual figure grows faster than pay does.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l04',
    grade: 12, unit: 1, day: 4,
    actor: 'a fictional employee choosing between two simulated health plans inside an enrolment window',
    objective: 'Price two fictional health plans at a stated level of use, identify which is cheaper there, and state what the comparison depends on that the year cannot be known in advance.',
    scenario: 'The two simulated plans below, their premiums, and the fictional year of covered charges are invented for this exercise. No real insurer or policy is described.',
    materials: ['calculator', 'the fictional plan terms in these directions'],
    domains: ['insurance-risk', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Both fictional plans are paid for over 26 pay periods. The Silver plan costs $95 a period, has a deductible of $1,500, then the plan pays 80% of further covered charges and the member pays 20%, with a cap of $4,000 on what the member can pay in a year. The Bronze plan costs $42 a period, has a deductible of $3,600, then the member pays 30%, with a cap of $6,500. Enrolment closes on a stated date; a member who does not choose is enrolled in neither plan until the following year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does a year of Silver premiums cost?',
            given: { silverPremium: 95, periods: 26 }, expr: 'silverPremium * periods', format: 'usd', answer: '$2,470.00',
            reasoning: '$95 in each of 26 pay periods. This is paid whether or not any care is used.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of Bronze premiums cost?',
            given: { bronzePremium: 42, periods2: 26 }, expr: 'bronzePremium * periods2', format: 'usd', answer: '$1,092.00',
            reasoning: '$42 in each of 26 pay periods.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The fictional year turns out to bring $6,000 of covered charges. Price both plans against that year.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Under Silver, what does the member pay toward the $6,000 of charges?',
            given: { silverDeductible: 1500, charges: 6000, silverCoins: 0.2 }, expr: 'silverDeductible + (charges - silverDeductible) * silverCoins', format: 'usd', answer: '$2,400.00',
            reasoning: 'The member pays the first $1,500 in full, then 20% of the remaining $4,500, which is $900. The $2,400 total is below the $4,000 cap, so the cap does not bind here.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of the Silver year — premiums and the member’s share together?',
            given: {}, expr: '#t1-p1 + #t2-p1', format: 'usd', answer: '$4,870.00',
            reasoning: '$2,470.00 of premiums plus $2,400.00 of cost sharing. Comparing premiums alone would rank the plans backwards.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Under Bronze, what does the member pay toward the same $6,000 of charges?',
            given: { bronzeDeductible: 3600, charges2: 6000, bronzeCoins: 0.3 }, expr: 'bronzeDeductible + (charges2 - bronzeDeductible) * bronzeCoins', format: 'usd', answer: '$4,320.00',
            reasoning: 'The first $3,600 in full, then 30% of the remaining $2,400, which is $720. That total is below the $6,500 cap.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of the Bronze year?',
            given: {}, expr: '#t1-p2 + #t2-p3', format: 'usd', answer: '$5,412.00',
            reasoning: '$1,092.00 of premiums plus $4,320.00 of cost sharing.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'At $6,000 of covered charges, which plan costs the member less for the year in total?',
            choices: ['Silver', 'Bronze'],
            decision: { left: '#t2-p2', cmp: '<', right: '#t2-p4', ifTrue: 'Silver', ifFalse: 'Bronze' },
            answer: 'Silver',
            reasoning: '$4,870.00 against $5,412.00. The plan with the higher premium is the cheaper one at this level of use, because the lower deductible and the smaller coinsurance share more than recover the premium difference.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Silver wins at $6,000 of charges, but the member has to choose before the year happens. Explain what a member would need to believe about the coming year to choose Bronze and still be reasoning well, and say what the two caps — $4,000 and $6,500 — protect against that the premiums do not.',
            acceptableAnswerCriteria: [
              'Explains that Bronze is defensible for a member who expects low use: with no covered charges at all the year costs $1,092.00 under Bronze against $2,470.00 under Silver, so Bronze wins at the low end.',
              'States that the choice is made under uncertainty about the coming year, so it is a judgement about the range of likely use rather than a calculation with one right answer.',
              'Explains that the caps bound the worst year: whatever the charges, the member’s share stops at $4,000 under Silver and $6,500 under Bronze, which is protection against a severe year rather than against an ordinary one.',
            ],
            evidenceRequirements: [
              'Uses the $2,470.00 and $1,092.00 premium totals to describe the low-use case, and the $4,000 and $6,500 caps to describe the severe case.',
            ],
            dimensions: ['communication-of-uncertainty', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The response treats the enrolment decision as made in advance of the information that would settle it.',
              'The response does not present either plan as the correct choice; both are defensible against different expectations of use.',
            ],
            commonMisconception: 'Choosing a plan on premium alone, which ignores the deductible and the coinsurance share that decide the cost of any year with real use in it.',
          },
        ],
      },
    ],
    remediation: 'If Bronze looks cheaper, the comparison probably stopped at the premiums, where Bronze is $1,378.00 cheaper. Add the member’s share of the $6,000 in charges to each: $2,400.00 for Silver and $4,320.00 for Bronze. It is the $1,920.00 difference in cost sharing that reverses the ranking.',
    extension: 'Find the level of covered charges at which the two fictional plans cost the same for the year, and say what that figure tells a member who has no idea what the year will bring.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l05',
    grade: 12, unit: 1, day: 5,
    actor: 'a fictional worker tracing a salary across six years of a career stage',
    objective: 'Compound a fictional salary across repeated annual raises, price the permanent effect of one raise that never happened, and state the assumption the projection rests on.',
    scenario: 'The career path below belongs to a fictional worker at a fictional employer. Every salary and raise in it is invented for this exercise.',
    materials: ['calculator', 'the fictional salary history in these directions'],
    domains: ['income', 'budgeting', 'saving-investing', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker starts at $46,000 a year and receives a raise of 3% at the end of each of the next 5 years. Each raise applies to the salary as it then stands, not to the starting salary.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the salary after all 5 raises? Round to the nearest cent.',
            given: { startSalary: 46000, raiseRate: 0.03, years: 5 }, expr: 'round(startSalary * pow(1 + raiseRate, years), 2)', format: 'usd', answer: '$53,326.61',
            reasoning: 'Each raise multiplies the standing salary by 1.03, so five raises multiply the start by 1.03 to the fifth power. Adding 3% of $46,000 five times would understate this, because later raises apply to a larger base.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much higher is that than the starting salary?',
            given: { startSalary2: 46000 }, expr: '#t1-p1 - startSalary2', format: 'usd', answer: '$7,326.61',
            reasoning: '$53,326.61 against the $46,000 start. Five simple 3% increments on the original salary would have produced $6,900, so compounding accounts for the remaining $426.61.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now suppose the raise in year 3 never happens and the other 4 raises go ahead as scheduled at 3% each.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the salary at the end of the same period with only 4 raises? Round to the nearest cent.',
            given: { startSalary3: 46000, raiseRate2: 0.03, raises: 4 }, expr: 'round(startSalary3 * pow(1 + raiseRate2, raises), 2)', format: 'usd', answer: '$51,773.41',
            reasoning: 'Four raises rather than five, each still 3% on the standing salary. The missing raise is not recovered later, because every subsequent raise now applies to a smaller base.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the annual gap the missed raise leaves at the end of the period?',
            given: {}, expr: '#t1-p1 - #t2-p1', format: 'usd', answer: '$1,553.20',
            reasoning: '$53,326.61 against $51,773.41. Note this is larger than the 3% of the year-3 salary that was skipped, because the gap itself has been compounded by the two later raises.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Assume the gap stays at that same amount in each of the next 10 years, with no further raises on either path. What does the missed raise cost across those 10 years?',
            given: { horizon: 10 }, expr: '#t2-p2 * horizon', format: 'usd', answer: '$15,532.00',
            reasoning: '$1,553.20 in each of 10 years. Holding the gap flat is a deliberate simplification stated in the prompt: if raises continued on both paths the gap would keep widening, so this figure is a floor rather than an estimate.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The $15,532.00 rests on holding the gap flat for 10 years. Say why that assumption makes the figure a floor rather than a best estimate, and name one other thing the projection leaves out that could push the true cost either up or down.',
            acceptableAnswerCriteria: [
              'Explains that if raises continue on both paths, each future raise is applied to a smaller base on the missed-raise path, so the gap widens every year and $1,553.20 a year understates it.',
              'Identifies the flat-gap assumption as the reason $15,532.00 is a floor, and states that the real figure under continued raises would be larger.',
              'Names a further omission with its direction — for instance a later promotion or job change that resets pay and closes the gap, which would push the cost down, or a retirement contribution set as a percentage of pay, which compounds the gap and pushes it up.',
            ],
            evidenceRequirements: [
              'Uses the $1,553.20 annual gap and the $15,532.00 ten-year figure, and names the assumption that links them.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises that a missed raise is permanent rather than a one-year loss.',
              'The response gives the direction of each omission, not just its existence.',
            ],
            commonMisconception: 'Pricing a missed raise as the single year’s increase, which ignores that every later raise compounds from the lower base.',
          },
        ],
      },
    ],
    remediation: 'If the five-raise salary comes out at $52,900.00, each raise is being taken as 3% of the original $46,000 and added five times. A raise applies to the salary as it then stands. Multiply by 1.03 once for each year in turn and compare the running figures — the gap between the two methods is what compounding is.',
    extension: 'Recompute the ten-year cost with the gap growing by 3% a year instead of staying flat, and say how much the flat-gap simplification understated.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l06',
    grade: 12, unit: 1, day: 6,
    actor: 'a fictional worker reconciling a year-end wage summary against a year of pay statements',
    objective: 'Reconcile a fictional year-end wage summary against the pay statements behind it, locate the box that disagrees with the fictional rules, and price the difference.',
    scenario: 'The year-end wage summary and the pay statements described below are simulated documents from a fictional employer. No real tax form is reproduced.',
    materials: ['calculator', 'the fictional summary and statement figures in these directions'],
    domains: ['income', 'taxes', 'consumer-protection', 'fraud'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker was paid $2,240 gross in each of 26 pay periods. Each statement shows federal income tax withheld of $168 and a retirement contribution of 5% of gross. Under the fictional federal rule the retirement contribution is excluded from federal wages; under the fictional state rule it is not, so state wages should equal full gross. The year-end summary reports federal wages of $55,328, state wages of $55,328, and federal tax withheld of $4,368. The state rate is 4.25%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total gross pay the 26 statements add up to?',
            given: { perPeriodGross: 2240, periods: 26 }, expr: 'perPeriodGross * periods', format: 'usd', answer: '$58,240.00',
            reasoning: '$2,240 in each of 26 periods. This is the figure every box on the summary is reconciled against.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total federal income tax withheld across the year?',
            given: { perPeriodFed: 168, periods2: 26 }, expr: 'perPeriodFed * periods2', format: 'usd', answer: '$4,368.00',
            reasoning: '$168 in each of 26 periods, which matches the $4,368 the summary reports. This box reconciles.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the retirement contributions come to for the year?',
            given: { perPeriodGross2: 2240, retireRate: 0.05, periods3: 26 }, expr: 'perPeriodGross2 * retireRate * periods3', format: 'usd', answer: '$2,912.00',
            reasoning: '5% of $2,240 is $112 a period, across 26 periods. This is the amount the federal rule excludes and the state rule does not.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now check each reported wage box against the fictional rule that governs it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What should federal wages be, given that the retirement contribution is excluded?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$55,328.00',
            reasoning: '$58,240.00 of gross less the $2,912.00 excluded. This matches the $55,328 the summary reports, so the federal wage box reconciles.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'The summary reports the same $55,328 for state wages. Under the fictional state rule, is that box correct?',
            choices: ['Yes — state and federal wages are defined the same way', 'No — state wages should be the full $58,240.00'],
            answer: 'No — state wages should be the full $58,240.00',
            reasoning: 'The stated state rule does not exclude the retirement contribution, so state wages should equal full gross of $58,240.00. The summary has carried the federal figure across into a box governed by a different rule. This is read off the stated rules rather than decided by a comparison of two computed amounts.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'At the 4.25% state rate, how much state tax does the understated wage box leave uncollected?',
            given: { stateRate: 0.0425 }, expr: 'round(#t1-p3 * stateRate, 2)', format: 'usd', answer: '$123.76',
            reasoning: '4.25% of the $2,912.00 wrongly excluded from state wages. Only the excluded amount is mis-taxed; the rest of the state wage base was reported correctly.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Two different things can make a year-end summary disagree with a worker’s own records: an employer applying a rule wrongly, and wages appearing that the worker never earned. Say which one this case is and how you can tell, and describe what a worker should do differently if the summary had shown gross pay of $71,000 instead.',
            acceptableAnswerCriteria: [
              'Identifies this as a rule-application error: every figure traces to the worker’s own 26 statements, and the discrepancy is confined to which rule was applied to the state wage box.',
              'States the diagnostic: the statements and the summary agree on what was paid, so nothing unexplained has been added, and the disagreement is about treatment rather than about amount earned.',
              'Describes a different response to unexplained wages of $71,000: that figure cannot be reconciled to any statement the worker holds, which is a possible sign that earnings have been reported in their name, and it warrants raising the discrepancy promptly and keeping records rather than simply requesting a corrected box.',
            ],
            evidenceRequirements: [
              'Uses the $58,240.00 reconciled gross and the $2,912.00 retirement total to show the discrepancy is fully explained.',
            ],
            dimensions: ['error-diagnosis', 'evidence-use', 'criteria-application'],
            lookFors: [
              'The response distinguishes an amount that reconciles from an amount that does not.',
              'The response treats unexplained earnings as something to be checked and documented, without asserting that fraud has certainly occurred.',
            ],
            commonMisconception: 'Treating every disagreement between a pay record and a year-end summary as the same kind of problem with the same remedy.',
          },
        ],
      },
    ],
    remediation: 'If the state wage box looks correct, check which rule each box is governed by. The federal rule excludes the $2,912.00 of retirement contributions and the state rule does not, so the two boxes should not carry the same figure. Compute each from the $58,240.00 gross separately before comparing either with the summary.',
    extension: 'Work out what the reconciliation would show if the fictional employer had also excluded a $1,400 pre-tax premium from both wage boxes, and say which of the two boxes would then be right.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l07',
    grade: 12, unit: 1, day: 7,
    actor: 'a fictional candidate who ranked two offers and got the order wrong',
    objective: 'Locate the first wrong step in a fictional offer comparison, redo it correctly across salary, a local tax, and a benefit cost, and name the misconception behind the error.',
    scenario: 'The comparison below was made by a fictional candidate about two fictional offers. The salaries, rates, and premiums are invented for this exercise.',
    materials: ['calculator', 'the fictional offer terms and the candidate’s working in these directions'],
    domains: ['income', 'taxes', 'insurance-risk', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer P pays $61,000 and is based in a city that charges a 1% city income tax on pay; the employee pays $2,400 a year toward the health premium and there is no employer retirement contribution. Offer Q pays $59,200 with no city income tax; the employee pays $960 a year toward the health premium and the employer contributes 3% of salary to retirement. The fictional candidate compared $61,000 with $59,200, concluded that P paid more, and stopped there.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the 1% city income tax cost under Offer P?',
            given: { salaryP: 61000, cityRate: 0.01 }, expr: 'salaryP * cityRate', format: 'usd', answer: '$610.00',
            reasoning: '1% of the $61,000 salary. Offer Q is not in the city and pays none of this, so it is a difference between the offers rather than a cost both carry.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Offer P leave after the city tax and the employee’s health premium?',
            given: { salaryP2: 61000, premiumP: 2400 }, expr: 'salaryP2 - premiumP - #t1-p1', format: 'usd', answer: '$57,990.00',
            reasoning: '$61,000 less the $2,400 premium and the $610.00 city tax. Both are annual, and both are charged to the worker.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the employer contribute to retirement under Offer Q?',
            given: { salaryQ: 59200, matchRate: 0.03 }, expr: 'salaryQ * matchRate', format: 'usd', answer: '$1,776.00',
            reasoning: '3% of $59,200, paid into a retirement account rather than as pay.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now redo the ranking properly.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Offer Q leave after the employee’s health premium?',
            given: { salaryQ2: 59200, premiumQ: 960 }, expr: 'salaryQ2 - premiumQ', format: 'usd', answer: '$58,240.00',
            reasoning: '$59,200 less the $960 premium. There is no city tax to subtract under Offer Q.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'On spendable pay after the city tax and the health premium, which offer pays more?',
            choices: ['Offer P', 'Offer Q'],
            decision: { left: '#t2-p1', cmp: '>', right: '#t1-p2', ifTrue: 'Offer Q', ifFalse: 'Offer P' },
            answer: 'Offer Q',
            reasoning: '$58,240.00 under Q against $57,990.00 under P. The $1,800 salary advantage P appeared to hold is more than consumed by $610.00 of city tax and $1,440 more in premiums.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Adding the employer retirement contribution, what is Offer Q worth in total?',
            given: {}, expr: '#t2-p1 + #t1-p3', format: 'usd', answer: '$60,016.00',
            reasoning: '$58,240.00 of spendable pay plus the $1,776.00 employer retirement contribution. Q therefore leads on both measures once the ranking is done properly, so the two do not conflict here.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Name the first step at which the fictional candidate’s comparison went wrong, state the misconception behind it, and give one check that would have exposed the error before a decision was made.',
            acceptableAnswerCriteria: [
              'Locates the first wrong step precisely: the comparison stopped at the two salary figures, $61,000 against $59,200, and never brought the city tax or either premium into the calculation.',
              'Names the misconception: treating the salary line as the offer, when the offer is the whole set of terms attached to it — including where the job is located and what the worker pays for benefits.',
              'Gives a workable check: compute a single spendable figure for each offer with every annual charge subtracted, and only compare figures built the same way.',
            ],
            evidenceRequirements: [
              'Uses the $57,990.00 and $58,240.00 spendable figures to show that the original ranking reversed.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies the omission as the first error rather than describing the conclusion as wrong.',
              'The response notes that the $250.00 spendable-pay difference is small, so the ranking would be sensitive to any further term the comparison still omits.',
            ],
            commonMisconception: 'Comparing two salaries directly when the offers carry different local taxes and different benefit costs, so the two numbers are not measuring the same thing.',
          },
        ],
      },
    ],
    remediation: 'If Offer P still comes out ahead, check that both the $610.00 city tax and the full $2,400 premium have been subtracted from it, and that only the $960 premium has been subtracted from Offer Q. The salary difference of $1,800 is smaller than the $2,050 of extra charges P carries, and that is what reverses the ranking.',
    extension: 'Recompute the comparison if Offer P could be worked entirely outside the city, so the city tax does not apply, and say how much of the original ranking that one change restores.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l08',
    grade: 12, unit: 1, day: 8,
    actor: 'a fictional worker who changed jobs partway through a simulated year',
    objective: 'Compute a full-year fictional tax liability across two employers, compare it with what each employer withheld on its own, and plan for the gap the method leaves.',
    scenario: 'The two fictional employers and the simulated pay below are invented for this exercise, as is every rate in the tax schedule applied to them.',
    materials: ['calculator', 'the fictional pay history and tax schedule in these directions'],
    domains: ['income', 'taxes', 'budgeting', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker earned $3,900 a month for the first 7 months of the year, then $5,400 a month for the remaining 5 months at a new employer. Under the fictional federal schedule, taxable income is total pay less a standard deduction of $9,000; the schedule charges 10% on the first $10,400 of taxable income, 12% on the band from $10,400 to $44,000, and 22% above $44,000. Each employer withholds as though its own pay were the worker’s only income for the year: it subtracts the whole $9,000 deduction from that job’s pay and applies the bands from the bottom.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What did the first job pay across the year?',
            given: { job1Monthly: 3900, job1Months: 7 }, expr: 'job1Monthly * job1Months', format: 'usd', answer: '$27,300.00',
            reasoning: '$3,900 a month for the 7 months worked at the first employer. Pay is counted where it was earned, because each employer withholds only against its own payments.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What did the second job pay across the year?',
            given: { job2Monthly: 5400, job2Months: 5 }, expr: 'job2Monthly * job2Months', format: 'usd', answer: '$27,000.00',
            reasoning: '$5,400 a month for the remaining 5 months. The two jobs together account for all 12 months, so no pay is counted twice or left out.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is total pay for the year?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$54,300.00',
            reasoning: '$27,300.00 plus $27,000.00. The schedule is written to apply once, to this figure.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compute what is actually owed, then what was actually withheld.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is taxable income for the year after one standard deduction?',
            given: { deduction: 9000 }, expr: '#t1-p3 - deduction', format: 'usd', answer: '$45,300.00',
            reasoning: '$54,300.00 less one $9,000 deduction. The deduction is available once, against total income.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the federal income tax owed on that taxable income?',
            given: { band1: 10400, band2: 44000, lowRate: 0.1, midRate: 0.12, highRate: 0.22 },
            expr: 'band1 * lowRate + (band2 - band1) * midRate + (#t2-p1 - band2) * highRate', format: 'usd', answer: '$5,358.00',
            reasoning: '$1,040.00 on the first $10,400, $4,032.00 on the $33,600 band that runs to $44,000, and 22% of the $1,300 above $44,000, which is $286.00. Taxable income crosses into the third band this year, which neither job alone would have reached.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What did the first employer withhold, treating its own pay as the only income?',
            given: { band1b: 10400, lowRate2: 0.1, deduction2: 9000, midRate2: 0.12 },
            expr: 'band1b * lowRate2 + (#t1-p1 - deduction2 - band1b) * midRate2', format: 'usd', answer: '$1,988.00',
            reasoning: 'The first employer sees $27,300.00, subtracts the whole $9,000 deduction to reach $18,300.00 taxable, and charges $1,040.00 on the first $10,400 plus 12% of the remaining $7,900.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What did the second employer withhold on the same basis?',
            given: { band1c: 10400, lowRate3: 0.1, deduction3: 9000, midRate3: 0.12 },
            expr: 'band1c * lowRate3 + (#t1-p2 - deduction3 - band1c) * midRate3', format: 'usd', answer: '$1,952.00',
            reasoning: 'The second employer sees $27,000.00, subtracts its own full $9,000 deduction to reach $18,000.00 taxable, and charges $1,040.00 plus 12% of $7,600.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What is still owed when the year is filed?',
            given: {}, expr: '#t2-p2 - #t2-p3 - #t2-p4', format: 'usd', answer: '$1,418.00',
            reasoning: '$5,358.00 owed against $3,940.00 withheld between the two employers. The $9,000 deduction was applied twice and the 10% band was used twice, and no employer applied the 22% band at all.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The fictional worker will owe $1,418.00 at filing through no error of their own. Explain why the withholding method produces this, and set out one workable plan for meeting the bill, stating what your plan requires the worker to do each month.',
            acceptableAnswerCriteria: [
              'Explains the cause structurally: each employer applied a $9,000 deduction and a 10% band that are each available only once, and neither employer could see the income that pushed the worker into the 22% band.',
              'Sets out a workable plan with a monthly figure attached — for example setting aside roughly $118 a month across twelve months, or a larger amount across the five months remaining after the job change — and states where the money is held until filing.',
              'States that the alternative route is to have withholding increased at the second job so the shortfall is collected through payroll instead, and notes what that costs: less take-home pay each period.',
            ],
            evidenceRequirements: [
              'Uses the $5,358.00 owed and the $3,940.00 withheld, and shows how the $1,418.00 gap follows from them.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The plan names where the set-aside money sits between now and filing, rather than leaving it in general spending.',
              'The response does not treat the shortfall as a penalty or a mistake by the worker.',
            ],
            commonMisconception: 'Assuming that because an employer withheld tax from every paycheque, the correct amount for the year has necessarily been collected.',
          },
        ],
      },
    ],
    remediation: 'If the tax owed comes out at $3,940.00, the two employers’ separate calculations are being added together. The schedule applies once, to total income. Add the two jobs to $54,300.00, subtract one $9,000 deduction, and then work through all three bands — including the 22% band above $44,000, which neither employer reached.',
    extension: 'Work out how much extra the second employer would have to withhold in each of its 5 monthly payments to clear the $1,418.00 by year end, and say what that does to the worker’s monthly budget.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l09',
    grade: 12, unit: 1, day: 9,
    actor: 'a fictional worker whose pay statement changed in the middle of a simulated year',
    objective: 'Account for every line that moved between two simulated pay statements after a raise and a benefit change, and judge whether smaller take-home pay means the worker is worse off.',
    scenario: 'The two simulated pay statements compared below are fictional, as are the employer, the raise, and every rate applied.',
    materials: ['calculator', 'the fictional statement figures in these directions'],
    domains: ['income', 'taxes', 'saving-investing', 'budgeting'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker is paid over 24 periods a year. Before the change the salary was $50,400 with a retirement election of 5%; after the change it is $54,000 with a retirement election of 7%. The payroll levy is 7.65% of gross. Federal income tax withheld rose by $10.20 a period.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What was gross pay per period before the change?',
            given: { annualBefore: 50400, periods: 24 }, expr: 'annualBefore / periods', format: 'usd', answer: '$2,100.00',
            reasoning: '$50,400 spread across 24 pay periods. This is the base every deduction on the earlier statement was computed from.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is gross pay per period after the change?',
            given: { annualAfter: 54000, periods2: 24 }, expr: 'annualAfter / periods2', format: 'usd', answer: '$2,250.00',
            reasoning: '$54,000 across 24 periods, a rise of $150.00 a period.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now account for each line that changed between the two statements.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What was the retirement deduction per period before the change?',
            given: { rateBefore: 0.05 }, expr: 'round(#t1-p1 * rateBefore, 2)', format: 'usd', answer: '$105.00',
            reasoning: '5% of the $2,100.00 gross on the earlier statement. It is computed on gross rather than on pay after tax, which is what makes it rise with the raise as well as with the rate.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the retirement deduction per period after the change?',
            given: { rateAfter: 0.07 }, expr: 'round(#t1-p2 * rateAfter, 2)', format: 'usd', answer: '$157.50',
            reasoning: '7% of the $2,250.00 gross — a rise of $52.50, driven by both the higher rate and the higher base.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does the payroll levy rise per period?',
            given: { levyRate: 0.0765 }, expr: 'round((#t1-p2 - #t1-p1) * levyRate, 2)', format: 'usd', answer: '$11.48',
            reasoning: '7.65% of the $150.00 increase in gross. The levy is charged on gross, so the larger retirement election does not reduce it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the change in take-home pay per period, once the retirement increase, the levy increase, and the $10.20 of extra income tax are all accounted for?',
            given: { fedIncrease: 10.2 }, expr: 'round(#t1-p2 - #t1-p1 - (#t2-p2 - #t2-p1) - #t2-p3 - fedIncrease, 2)', format: 'usd', answer: '$75.82',
            reasoning: 'The $150.00 gross rise less $52.50 more retirement, $11.48 more levy, and $10.20 more income tax. Take-home rises, but by roughly half the headline raise.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The fictional worker sees a $150.00 raise turn into $75.82 more in the account and calls it "half a raise". Say what is fair and what is unfair in that description, and explain how you would classify the $52.50 that went to retirement.',
            acceptableAnswerCriteria: [
              'States what is fair: only $75.82 of the $150.00 is available to spend this period, so a budget built on the full raise would be $74.18 short.',
              'States what is unfair: the $52.50 increase in the retirement deduction is not a charge but a transfer to the worker’s own account, so on a wealth measure the worker gained $128.32 of the $150.00 rather than half of it.',
              'Separates the two genuine costs — $11.48 of levy and $10.20 of income tax, $21.68 in total — from the $52.50 that only changed where the worker’s money is held.',
            ],
            evidenceRequirements: [
              'Uses the $75.82 take-home change and the $52.50 retirement increase, and states which of the changed lines are costs and which are not.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response separates money that left the worker from money that moved between the worker’s own accounts.',
              'The response accepts either conclusion about whether the higher election is worth it, provided the $75.82 spendable figure is what the household budget is built on.',
            ],
            commonMisconception: 'Reading every reduction between gross and take-home pay as a cost, when a voluntary retirement election is a transfer the worker still owns.',
          },
        ],
      },
    ],
    remediation: 'If the take-home change comes out as $150.00, no line below gross has been accounted for. Work down the statement: gross rose $150.00, the retirement deduction rose $52.50, the levy rose $11.48, and income tax rose $10.20. Subtract the last three from the first, and keep them separate so you can say which are costs.',
    extension: 'Work out what the take-home change would have been had the worker left the retirement election at 5%, and say what that comparison shows about who decided the size of the raise the worker felt.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u01-l10',
    grade: 12, unit: 1, day: 10,
    actor: 'a fictional new hire making a whole first-year set of benefit elections against a deadline',
    objective: 'Build and defend a complete set of first-year benefit elections for a fictional hire, pricing the retirement contribution, both health plans, and the deadline that governs all of them.',
    scenario: 'The fictional hire, the employer, the two simulated plans, and the fictional year of covered charges below are all invented for this exercise.',
    materials: ['calculator', 'the fictional enrolment packet in these directions'],
    domains: ['income', 'insurance-risk', 'saving-investing', 'budgeting', 'taxes', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional hire is paid $58,800 a year over 24 periods. The employer contributes 50% of whatever the worker contributes to retirement, up to the first 6% of salary. Health Plan A costs $118 a period, with a deductible of $1,200, then the member pays 20%. Health Plan B costs $58 a period, with a deductible of $3,000, then the member pays 30%. Elections must be made before the enrolment window closes; a hire who misses it gets no health plan and no retirement contribution until the next window a year later.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is gross pay per period?',
            given: { salary: 58800, periods: 24 }, expr: 'salary / periods', format: 'usd', answer: '$2,450.00',
            reasoning: '$58,800 across 24 periods. Every per-period cost below is set against this.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What must the worker contribute over the year to earn the largest possible employer contribution?',
            given: { salary3: 58800, matchTier2: 0.06 }, expr: 'salary3 * matchTier2', format: 'usd', answer: '$3,528.00',
            reasoning: '6% of $58,800 — the ceiling above which the employer adds nothing further. Contributing less leaves part of the employer contribution unclaimed; contributing more is still saving, but earns no additional employer money.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the largest employer retirement contribution available for the year?',
            given: { salary2: 58800, matchTier: 0.06, matchShare: 0.5 }, expr: 'salary2 * matchTier * matchShare', format: 'usd', answer: '$1,764.00',
            reasoning: '50% of the first 6% of $58,800. It is paid only on what the worker actually contributes, so it is available rather than automatic.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price both health plans against a fictional year with $4,200 of covered charges.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does a year of Plan A premiums cost?',
            given: { premiumA: 118, periods2: 24 }, expr: 'premiumA * periods2', format: 'usd', answer: '$2,832.00',
            reasoning: '$118 in each of the 24 pay periods. The premium is charged whether or not any care is used, so it is the floor of a Plan A year.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of Plan B premiums cost?',
            given: { premiumB: 58, periods3: 24 }, expr: 'premiumB * periods3', format: 'usd', answer: '$1,392.00',
            reasoning: '$58 in each of the 24 pay periods, and likewise unavoidable. Plan B’s premium floor is $1,440.00 lower than Plan A’s.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Under Plan A, what does the member pay toward $4,200 of covered charges?',
            given: { deductibleA: 1200, charges: 4200, coinsA: 0.2 }, expr: 'deductibleA + (charges - deductibleA) * coinsA', format: 'usd', answer: '$1,800.00',
            reasoning: 'The first $1,200 in full, then 20% of the remaining $3,000.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Under Plan B, what does the member pay toward the same charges?',
            given: { deductibleB: 3000, charges2: 4200, coinsB: 0.3 }, expr: 'deductibleB + (charges2 - deductibleB) * coinsB', format: 'usd', answer: '$3,360.00',
            reasoning: 'The first $3,000 in full, then 30% of the remaining $1,200.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Put the two plans on the same basis and settle the arithmetic before writing anything.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of a Plan A year at this level of use?',
            given: {}, expr: '#t2-p1 + #t2-p3', format: 'usd', answer: '$4,632.00',
            reasoning: '$2,832.00 of premiums plus $1,800.00 of cost sharing.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of a Plan B year at this level of use?',
            given: {}, expr: '#t2-p2 + #t2-p4', format: 'usd', answer: '$4,752.00',
            reasoning: '$1,392.00 of premiums plus $3,360.00 of cost sharing.',
          },
          {
            ref: 't3-p3', kind: 'choice',
            text: 'At $4,200 of covered charges, which plan costs less across the whole year?',
            choices: ['Plan A', 'Plan B'],
            decision: { left: '#t3-p1', cmp: '<', right: '#t3-p2', ifTrue: 'Plan A', ifFalse: 'Plan B' },
            answer: 'Plan A',
            reasoning: '$4,632.00 against $4,752.00 — a difference of $120.00, which is small enough that a different level of use would reverse it.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write the election set. Give the figures behind each choice.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the complete set of first-year elections you would defend for this fictional hire: a retirement contribution rate, a health plan, and what must happen before the enrolment window closes. Justify each with a figure, and name the one election you would change first if the hire told you their expected medical use was much lower.',
            acceptableAnswerCriteria: [
              'Sets a retirement contribution and justifies it against the $3,528.00 needed to earn the full $1,764.00 employer contribution, either by reaching it or by stating explicitly what competing use of the cash makes a lower rate defensible.',
              'Chooses a health plan and justifies it with the year totals — $4,632.00 for Plan A against $4,752.00 for Plan B — rather than with the premium alone.',
              'Addresses the deadline as a decision in its own right: missing the window leaves the hire with no health plan and no employer retirement contribution for a full year, so the cost of not choosing is the whole $1,764.00 plus uninsured exposure.',
              'Identifies the health election as the one to revisit under lower expected use, and gives the reason: Plan B is $1,440.00 cheaper in premiums, which wins whenever cost sharing stays small — so a response that chose Plan A moves to Plan B, and one that already chose Plan B says why lower use confirms it.',
            ],
            evidenceRequirements: [
              'Uses the $1,764.00 employer contribution and both plan-year totals, $4,632.00 and $4,752.00.',
              'States the consequence of missing the enrolment window in figures, not only in words.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The three elections are consistent with one another and with the $2,450.00 of gross pay per period.',
              'A contribution rate below 6% is accepted when the response names what the cash is needed for instead; it is not accepted when offered without a reason.',
              'The response treats the $120.00 gap between the plans as narrow rather than decisive.',
            ],
            commonMisconception: 'Treating an enrolment deadline as an administrative detail rather than as the point at which the default — no coverage and no employer contribution — becomes the outcome.',
          },
        ],
      },
    ],
    remediation: 'If the plans are ranked on their premiums, Plan B wins by $1,440.00 and the comparison stops too early. Add what the member pays toward the $4,200 of charges under each plan — $1,800.00 under A and $3,360.00 under B — before comparing. Do the same with the retirement election: the $1,764.00 is available only if $3,528.00 is actually contributed.',
    extension: 'Rebuild the whole election set for a fictional hire on the same $58,800 salary who is also repaying $340 a month on a loan, and say which of the three elections that constraint changes first.',
  },
]
