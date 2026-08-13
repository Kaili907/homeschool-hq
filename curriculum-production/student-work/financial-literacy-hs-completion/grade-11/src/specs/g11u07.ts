import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 7 — PF7 Paying Taxes: Tax Planning and Its Interaction With
 * Everything Else. Eleven lessons, matching the source unit's eleven days.
 *
 * Every schedule in this unit is one invented fictional schedule, stated in
 * full in the lesson that uses it: a standard deduction of $11,400, then 10% on
 * the first $9,800 of taxable income, 14% up to $38,400, 22% up to $85,400, and
 * 30% above that. None of those figures is a real published threshold, and each
 * lesson says so. Taxable income is always computed before any rate is applied,
 * so no lesson ever charges a bracket rate against gross income.
 *
 * No lesson asks a learner for any figure from a real return, a real income, or
 * a real household.
 */
export const g11u07: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u07-l01',
    grade: 11, unit: 7, day: 1,
    actor: 'Ottoline Varga-Nkemdirim, a fictional worker weighing a raise',
    objective: 'Compute a fictional tax liability band by band, distinguish the marginal rate from the effective rate, and find what a raise is actually worth after tax.',
    scenario: 'Ottoline Varga-Nkemdirim earns a fictional salary in a simulated tax system. The schedule below is an invented one: its deduction, thresholds, and rates were chosen for this course and describe no real tax system, and a real return has many more steps than this.',
    materials: ['calculator', 'the fictional tax schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400. Tax is then 10% on the first $9,800 of taxable income, 14% on taxable income between $9,800 and $38,400, 22% between $38,400 and $85,400, and 30% above that. Ottoline earns $52,600.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Ottoline’s taxable income, after the $11,400 standard deduction?',
            given: { income: 52600, deduction: 11400 }, expr: 'income - deduction', format: 'usd', answer: '$41,200.00',
            reasoning: 'The deduction comes off before any rate is applied. Every figure below is computed from this $41,200.00, never from the $52,600 of gross income.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the first $9,800 of taxable income, at 10%?',
            given: { band1: 9800, rate1: 0.1 }, expr: 'round(band1 * rate1, 2)', format: 'usd', answer: '$980.00',
            reasoning: '10% of the first $9,800. This band is charged at 10% however much Ottoline earns above it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the band from $9,800 to $38,400, at 14%?',
            given: { band1b: 9800, band2: 38400, rate2: 0.14 }, expr: 'round((band2 - band1b) * rate2, 2)', format: 'usd', answer: '$4,004.00',
            reasoning: '14% of the $28,600 in that band. Ottoline’s taxable income is above $38,400, so the whole band is used.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the taxable income above $38,400, at 22%?',
            given: { band2b: 38400, rate3: 0.22 }, expr: 'round((#t1-p1 - band2b) * rate3, 2)', format: 'usd', answer: '$616.00',
            reasoning: '22% of the $2,800 by which $41,200.00 exceeds $38,400 — only that part reaches the 22% rate.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now total the tax and compare the two rates.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Ottoline’s total tax under the fictional schedule?',
            given: {}, expr: '#t1-p2 + #t1-p3 + #t1-p4', format: 'usd', answer: '$5,600.00',
            reasoning: '$980.00, $4,004.00, and $616.00 from the three bands used.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is her effective rate, measured against her $52,600 gross income? Give one decimal place.',
            given: { income2: 52600 }, expr: 'round(#t2-p1 / income2 * 100, 1)', format: 'percent1', answer: '10.6%',
            reasoning: '$5,600.00 against $52,600 — less than half the 22% rate on her top dollar, because the deduction and the two lower bands come first.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Ottoline is offered a $3,000 raise. How much extra tax does it attract, given that all of it falls in the 22% band?',
            given: { raise: 3000, rate3b: 0.22 }, expr: 'round(raise * rate3b, 2)', format: 'usd', answer: '$660.00',
            reasoning: '22% of $3,000. The raise takes taxable income from $41,200.00 to $44,200, which stays inside the band ending at $85,400, so the whole raise is taxed at the marginal rate and nothing else changes.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the $3,000 raise does she keep?',
            given: { raise2: 3000 }, expr: 'raise2 - #t2-p3', format: 'usd', answer: '$2,340.00',
            reasoning: '$3,000 less the $660.00 of extra tax — the marginal rate is what decides the value of extra income, not the effective rate.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which rate answers the question "what is another dollar of income worth to Ottoline?"',
            choices: ['The 10.6% effective rate', 'The 22% marginal rate', 'The average of the two'],
            given: {},
            answer: 'The 22% marginal rate',
            reasoning: 'The next dollar falls entirely in the 22% band, so 22 cents of it goes in tax; the 10.6% effective rate describes the whole of what she already earns, including the untaxed deduction and the two lower bands, and averaging the two describes nothing.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Ottoline’s marginal rate is 22% and her effective rate is 10.6%. Explain what each measures, say which one a person should use when deciding whether extra work is worth doing, and why the two differ by so much.',
            acceptableAnswerCriteria: [
              'Explains that the marginal rate applies to the next dollar earned while the effective rate is total tax divided by total income.',
              'States that the marginal rate is the right one for a decision about extra income, since only the extra dollars are affected.',
              'Explains the gap: the $11,400 deduction is untaxed and the first $38,400 of taxable income is taxed at 10% and 14%, so only $2,800 of Ottoline’s income ever meets the 22% rate.',
            ],
            evidenceRequirements: [
              'Cites the $5,600.00 total tax and the $616.00 charged in the 22% band.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'evidence-use'],
            lookFors: [
              'The response says which rate applies to which question rather than describing both.',
              'The explanation of the gap names the deduction and the lower bands.',
              'A response noting that the effective rate would rise slowly as income grows is reading the structure correctly.',
            ],
            commonMisconception: 'Using an effective rate to judge what extra income is worth.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'This schedule is invented. Name two ways a real tax calculation would be more complicated, and say which of Ottoline’s figures each would move.',
            acceptableAnswerCriteria: [
              'Names two genuine complications, such as payroll taxes charged separately on gross income, state or local income taxes, credits, or itemised deductions replacing the standard one.',
              'Ties each to a figure — most defensibly the $5,600.00 total or the 10.6% effective rate — and gives a direction.',
            ],
            evidenceRequirements: [
              'Refers to the $5,600.00 total tax or the 10.6% effective rate when saying what would change.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The complications named are real features of tax systems rather than vague complexity.',
              'The response notes that some would raise the total and others lower it.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the tax comes out at $11,572.00, the 22% rate is being applied to the whole of the gross income rather than only to the part of taxable income above $38,400. Two things happen first: $11,400 comes off as the standard deduction, and the first $38,400 of what remains is taxed at 10% and 14%. Build the three band pieces as separate rows and check that they add to the total.',
    extension: 'Recompute Ottoline’s total tax and effective rate at a gross income of $96,000, and say how much of her income then reaches the 30% band.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l02',
    grade: 11, unit: 7, day: 2,
    actor: 'Ignatius Bellweather-Osun, a fictional saver using a pre-tax contribution',
    objective: 'Compute the tax effect of a fictional pre-tax contribution, express it as a net cost, and explain why the saving equals the marginal rate rather than the effective rate.',
    scenario: 'Ignatius Bellweather-Osun is deciding about a contribution to a fictional pre-tax account. The tax schedule below is invented: its deduction, thresholds, and rates were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional tax schedule and contribution figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income, 14% between $9,800 and $38,400, and 22% between $38,400 and $85,400. Ignatius earns $58,900. A contribution to the fictional pre-tax account reduces taxable income by the amount contributed.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Ignatius’s taxable income before any contribution?',
            given: { income: 58900, deduction: 11400 }, expr: 'income - deduction', format: 'usd', answer: '$47,500.00',
            reasoning: '$58,900 less the $11,400 standard deduction, before the contribution is considered.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is his tax before the contribution?',
            given: { band1: 9800, rate1: 0.1, band2: 38400, rate2: 0.14, rate3: 0.22 },
            expr: 'round(band1 * rate1 + (band2 - band1) * rate2 + (#t1-p1 - band2) * rate3, 2)', format: 'usd', answer: '$6,986.00',
            reasoning: '$980.00 in the 10% band, $4,004.00 in the 14% band, and 22% of the $9,100 above $38,400.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'A $6,000 contribution reduces taxable income by that amount. What is the new taxable income?',
            given: { contribution: 6000 }, expr: '#t1-p1 - contribution', format: 'usd', answer: '$41,500.00',
            reasoning: '$47,500.00 less the $6,000 contributed — still above $38,400, so the reduction falls entirely in the 22% band.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is his tax after the contribution?',
            given: { band1b: 9800, rate1b: 0.1, band2b: 38400, rate2b: 0.14, rate3b: 0.22 },
            expr: 'round(band1b * rate1b + (band2b - band1b) * rate2b + (#t1-p3 - band2b) * rate3b, 2)', format: 'usd', answer: '$5,666.00',
            reasoning: 'The same two lower bands, and 22% of the $3,100 now above $38,400.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure what the contribution actually cost.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much tax does the contribution save?',
            given: {}, expr: '#t1-p2 - #t1-p4', format: 'usd', answer: '$1,320.00',
            reasoning: '$6,986.00 against $5,666.00 — exactly 22% of the $6,000 contributed, because the whole reduction fell in the 22% band.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the net cost of putting $6,000 into the account?',
            given: { contribution2: 6000 }, expr: 'contribution2 - #t2-p1', format: 'usd', answer: '$4,680.00',
            reasoning: '$6,000 into the account for $4,680.00 of reduced take-home pay — the tax system supplies the difference now, and taxes the account on the way out later.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The saving is what percentage of the contribution? Give one decimal place.',
            given: { contribution3: 6000 }, expr: 'round(#t2-p1 / contribution3 * 100, 1)', format: 'percent1', answer: '22.0%',
            reasoning: 'Exactly the marginal rate. A deduction is always worth the rate at which the last dollars of income were taxed.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What is Ignatius’s effective rate before the contribution, against his $58,900 income? Give one decimal place.',
            given: { income2: 58900 }, expr: 'round(#t1-p2 / income2 * 100, 1)', format: 'percent1', answer: '11.9%',
            reasoning: '$6,986.00 against $58,900. The contribution saved at 22.0% rather than at this 11.9%, which is the whole point of the distinction.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Why is the saving 22.0% of the contribution rather than 11.9%?',
            choices: [
              'Because a deduction removes income from the top of the stack, where the highest rate applies',
              'Because pre-tax accounts are taxed at a special rate',
              'Because the standard deduction is applied twice',
            ],
            given: {},
            decision: { left: '#t2-p3', cmp: '>', right: '#t2-p4', ifTrue: 'Because a deduction removes income from the top of the stack, where the highest rate applies', ifFalse: 'Because pre-tax accounts are taxed at a special rate' },
            answer: 'Because a deduction removes income from the top of the stack, where the highest rate applies',
            reasoning: 'The saving of 22.0% exceeds the 11.9% effective rate because the $6,000 came off the part of taxable income sitting above $38,400; nothing in the schedule gives the account its own rate, and the $11,400 deduction is applied once.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The contribution saves 22.0% while Ignatius’s effective rate is 11.9%. Explain why a deduction is worth the higher figure, and say what would have to be true for the same $6,000 contribution to save less.',
            acceptableAnswerCriteria: [
              'Explains that a deduction removes income from the top of the stack, so it is valued at the rate the last dollars were taxed at, not at the average across all income.',
              'Names the condition under which the saving would be smaller: taxable income close enough to $38,400 that part of the contribution drops into the 14% band instead.',
              'Notes that the saving is a deferral rather than a cancellation, since the account is taxed when the money comes out.',
            ],
            evidenceRequirements: [
              'Cites the 22.0% saving against the 11.9% effective rate and the $1,320.00 in dollars.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response describes the deduction as coming off the top rather than off the average.',
              'The condition named is checked against the $38,400 threshold rather than asserted.',
              'A response noting that the tax is deferred and not avoided is making an important correction.',
            ],
            commonMisconception: 'Valuing a deduction at the effective rate rather than the marginal rate.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Ignatius has $4,680.00 less take-home pay and $6,000 in the account. Say what he has actually gained and what he has given up, and name one thing he would need to know before deciding this is a good trade.',
            acceptableAnswerCriteria: [
              'States the gain: $6,000 working in the account for $4,680.00 of forgone take-home pay, with the $1,320.00 difference supplied by the reduced tax bill.',
              'Names what he would need to know, such as when the money can be withdrawn, what rate will apply on the way out, or whether he needs the $4,680.00 for something sooner.',
            ],
            evidenceRequirements: [
              'Uses the $4,680.00 net cost and the $6,000 contribution in the explanation.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies access to the money as a real cost, not only the tax position.',
              'The unknown named is one that would actually change the decision.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the saving comes out at $714.00, the 11.9% effective rate is being applied to the contribution instead of the 22% marginal rate. The contribution reduces taxable income from $47,500.00 to $41,500.00, and both figures are above $38,400, so the entire $6,000 reduction sits in the 22% band and saves exactly $1,320.00. Recompute both tax figures band by band and subtract.',
    extension: 'Find the largest contribution that would save the full 22% on every dollar, given that taxable income starts at $47,500.00, and say what rate the next dollar of contribution would save.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l03',
    grade: 11, unit: 7, day: 3,
    actor: 'Rosamund Kiplagat-Feldman, a fictional filer comparing a credit with a deduction',
    objective: 'Compute the tax effect of a fictional deduction and a fictional credit of the same size, and express how many times more the credit is worth.',
    scenario: 'Rosamund Kiplagat-Feldman is comparing two fictional tax reliefs. The schedule below is invented: its deduction, thresholds, and rates were chosen for this course and describe no real tax system, and real credits carry eligibility rules this outline omits.',
    materials: ['calculator', 'the fictional tax schedule and relief figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income and 14% between $9,800 and $38,400. Rosamund earns $46,300. A deduction reduces taxable income; a credit reduces the tax itself.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Rosamund’s taxable income?',
            given: { income: 46300, deduction: 11400 }, expr: 'income - deduction', format: 'usd', answer: '$34,900.00',
            reasoning: '$46,300 less the $11,400 standard deduction — below $38,400, so her top rate is 14%.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is her tax before any relief?',
            given: { band1: 9800, rate1: 0.1, rate2: 0.14 },
            expr: 'round(band1 * rate1 + (#t1-p1 - band1) * rate2, 2)', format: 'usd', answer: '$4,494.00',
            reasoning: '$980.00 in the 10% band plus 14% of the $25,100 above it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'With a $2,000 deduction, what is her tax?',
            given: { relief: 2000, band1b: 9800, rate1b: 0.1, rate2b: 0.14 },
            expr: 'round(band1b * rate1b + (#t1-p1 - relief - band1b) * rate2b, 2)', format: 'usd', answer: '$4,214.00',
            reasoning: 'Taxable income falls to $32,900, so the 14% band now covers $23,100 rather than $25,100.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'With a $2,000 credit instead, what is her tax?',
            given: { relief2: 2000 }, expr: '#t1-p2 - relief2', format: 'usd', answer: '$2,494.00',
            reasoning: '$4,494.00 of tax less the $2,000 credit — a credit comes off the tax itself, dollar for dollar.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two reliefs directly.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does the $2,000 deduction save?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$280.00',
            reasoning: '$4,494.00 against $4,214.00 — exactly 14% of $2,000, Rosamund’s marginal rate.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does the $2,000 credit save?',
            given: {}, expr: '#t1-p2 - #t1-p4', format: 'usd', answer: '$2,000.00',
            reasoning: 'The full amount — a credit is worth its face value regardless of the rate.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'ratio',
            text: 'How many times more is the credit worth than the deduction? Give two decimal places.',
            given: {}, expr: 'round(#t2-p2 / #t2-p1, 2)', format: 'dec2', answer: '7.14',
            reasoning: '$2,000.00 against $280.00 — the ratio is one divided by the 14% marginal rate.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How large a deduction would be needed to save as much as the $2,000 credit?',
            given: { rate2c: 0.14 }, expr: 'round(#t2-p2 / rate2c, 2)', format: 'usd', answer: '$14,285.71',
            reasoning: '$2,000.00 of saving divided by the 14% marginal rate — over seven times the credit, and more than Rosamund’s entire standard deduction.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'For a filer at a higher marginal rate, what happens to the gap between a credit and a deduction of the same size?',
            choices: [
              'The gap narrows, because the deduction saves more',
              'The gap widens, because the credit saves more',
              'The gap is unchanged, because both are fixed amounts',
            ],
            given: {},
            answer: 'The gap narrows, because the deduction saves more',
            reasoning: 'A credit saves its face value at any rate, while a deduction saves the marginal rate multiplied by its size, so at 22% the same $2,000 deduction would save $440.00 rather than $280.00 and the ratio would fall from 7.14 to about 4.55.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A credit of $2,000 is worth 7.14 times a deduction of $2,000 here. Explain the mechanism, and say what that difference implies about who each kind of relief helps most.',
            acceptableAnswerCriteria: [
              'Explains that a deduction reduces income before the rate is applied, so it is worth the marginal rate multiplied by its size, while a credit reduces the tax itself and is worth its face value.',
              'Draws the distributional implication: a deduction is worth more to filers at higher marginal rates, while a credit is worth the same to everyone whose tax is at least as large as the credit.',
              'Uses the $280.00 and $2,000.00 figures to show the size of the difference at Rosamund’s 14% rate.',
            ],
            evidenceRequirements: [
              'Cites the $280.00 deduction saving and the $2,000.00 credit saving.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response identifies the point in the calculation at which each relief acts.',
              'The distributional point is derived from the mechanism rather than asserted.',
              'A response noting the credit is only worth its face value if the tax bill is large enough is anticipating the next lesson correctly.',
            ],
            commonMisconception: 'Treating a credit and a deduction of the same size as equivalent reliefs.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'A deduction of $14,285.71 would be needed to match the credit. Say what that figure tells you about how deductions and credits should be compared, and why headline sizes are misleading.',
            acceptableAnswerCriteria: [
              'States that reliefs must be compared on the tax they save, not on their stated size, since the same $2,000 means two entirely different things.',
              'Explains that a headline size is uninformative for a deduction because its value depends on the filer’s marginal rate, which the headline does not carry.',
            ],
            evidenceRequirements: [
              'Refers to the $14,285.71 equivalent deduction and to the 14% marginal rate that produces it.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response proposes tax saved as the common basis for comparison.',
              'The response ties the deduction’s value to a rate that varies between filers.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the deduction appears to save $2,000, it is being treated as though it came off the tax. A deduction reduces taxable income from $34,900.00 to $32,900, and the tax then falls by 14% of that $2,000, which is $280.00. Recompute the tax from the reduced taxable income rather than subtracting the relief from the tax.',
    extension: 'Find the marginal rate at which a $2,000 deduction and a $2,000 credit would be worth the same, and say whether any band in this fictional schedule reaches it.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l04',
    grade: 11, unit: 7, day: 4,
    actor: 'Lachlan Ozturk-Bamidele, a fictional worker with employment and self-employment income',
    objective: 'Compute a fictional total tax across employment and self-employment income, including a self-employment contribution the employment income does not attract, and convert it into quarterly instalments.',
    scenario: 'Lachlan Ozturk-Bamidele has two fictional sources of income in a simulated tax system. The schedule and the self-employment rate below were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional income and tax figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is total income less a standard deduction of $11,400, and tax is 10% on the first $9,800 and 14% between $9,800 and $38,400. Lachlan earns $34,200 from employment, with tax already withheld. He also runs a fictional side business with revenue of $21,800 and allowable expenses of $6,400. A fictional self-employment contribution of 14.2% is charged on the net self-employment income only.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Lachlan’s net self-employment income?',
            given: { revenue: 21800, expenses: 6400 }, expr: 'revenue - expenses', format: 'usd', answer: '$15,400.00',
            reasoning: 'Revenue less allowable expenses. Self-employment income is taxed on the profit, not on the money coming in.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is his total income from both sources?',
            given: { employment: 34200 }, expr: 'employment + #t1-p1', format: 'usd', answer: '$49,600.00',
            reasoning: '$34,200 of employment income plus $15,400.00 of net self-employment income.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is his taxable income after the standard deduction?',
            given: { deduction: 11400 }, expr: '#t1-p2 - deduction', format: 'usd', answer: '$38,200.00',
            reasoning: '$49,600.00 less $11,400 — just under the $38,400 threshold, so none of it reaches the 22% band.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is his income tax?',
            given: { band1: 9800, rate1: 0.1, rate2: 0.14 },
            expr: 'round(band1 * rate1 + (#t1-p3 - band1) * rate2, 2)', format: 'usd', answer: '$4,956.00',
            reasoning: '$980.00 in the 10% band plus 14% of the $28,400 above it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now add the self-employment contribution and work out what has to be paid separately.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the 14.2% self-employment contribution on the net self-employment income?',
            given: { seRate: 0.142 }, expr: 'round(#t1-p1 * seRate, 2)', format: 'usd', answer: '$2,186.80',
            reasoning: '14.2% of $15,400.00. The employment income does not attract this charge, so it is the price of the second income source rather than of income generally.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is his total tax, counting income tax and the self-employment contribution?',
            given: {}, expr: '#t1-p4 + #t2-p1', format: 'usd', answer: '$7,142.80',
            reasoning: '$4,956.00 of income tax and $2,186.80 of self-employment contribution.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What is his effective rate against total income? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t1-p2 * 100, 1)', format: 'percent1', answer: '14.4%',
            reasoning: '$7,142.80 against $49,600.00 — noticeably higher than income tax alone would suggest, because of the self-employment contribution.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Nothing is withheld from the self-employment income, so the $2,186.80 must be paid in 4 quarterly instalments. How much is each?',
            given: {}, expr: 'round(#t2-p1 / 4, 2)', format: 'usd', answer: '$546.70',
            reasoning: '$2,186.80 spread across 4 instalments. An employee never sees this because the employer withholds throughout the year.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'The self-employment contribution is what share of the net self-employment income it is charged on? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p1 * 100, 1)', format: 'percent1', answer: '14.2%',
            reasoning: 'Exactly the stated rate, which is the check that it has been charged on the right base — the profit, not the revenue.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Lachlan’s side business brought in $21,800 and his tax rose by more than the income tax on it alone. Explain what the self-employment contribution adds, and say what a person starting a side business should set aside from each payment received.',
            acceptableAnswerCriteria: [
              'Explains that the net $15,400.00 attracts both income tax and the 14.2% self-employment contribution, while employment income of the same size would attract only the income tax in this schedule.',
              'Gives usable advice grounded in the figures: setting aside roughly 28% of net self-employment income covers both the 14% income tax band and the 14.2% contribution.',
              'Notes that nothing is withheld, so the amount has to be set aside deliberately and paid in instalments of $546.70.',
            ],
            evidenceRequirements: [
              'Cites the $2,186.80 self-employment contribution and the $4,956.00 income tax.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'transfer'],
            lookFors: [
              'The set-aside percentage is derived from the two rates rather than guessed.',
              'The response distinguishes revenue from net income when describing what to set aside.',
              'A response noting that expenses reduce both charges is reading the structure correctly.',
            ],
            commonMisconception: 'Assuming self-employment income is taxed in the same way as employment income.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Taxable income came to $38,200.00, just under the $38,400 threshold. Say what would happen to the tax on the next $1,000 of self-employment profit, and why the answer is not simply 14%.',
            acceptableAnswerCriteria: [
              'States that $200 of the next $1,000 stays in the 14% band and $800 falls into the 22% band, giving $204 of income tax rather than $140.',
              'Adds that the same $1,000 also attracts the 14.2% self-employment contribution, so the total on it is about $346.',
            ],
            evidenceRequirements: [
              'Uses the $38,200.00 taxable income and the $38,400 threshold in the calculation.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response splits the $1,000 across the two bands rather than applying one rate.',
              'The self-employment contribution is included in the total.',
            ],
            commonMisconception: 'Applying a single marginal rate to income that straddles a threshold.',
          },
        ],
      },
    ],
    remediation: 'If the self-employment contribution comes out at $3,095.60, it is being charged on the $21,800 of revenue rather than on the $15,400.00 of net income. Expenses come off before either charge applies. Compute net self-employment income first, and use that same figure for both the contribution and the income going into total income.',
    extension: 'Recompute the total tax if Lachlan’s allowable expenses were $9,700 instead of $6,400, and say how much of the difference comes from each of the two charges.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l05',
    grade: 11, unit: 7, day: 5,
    actor: 'Evangeline Sorokin-Quenneville, a fictional analyst timing a disposal',
    objective: 'Compute the tax on a fictional gain under two holding-period rules, express what waiting is worth, and identify the risk that waiting introduces.',
    scenario: 'Evangeline Sorokin-Quenneville is analysing a fictional disposal for a simulated case study. The holding-period rule and the rates below were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional gain and tax rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional rules, a gain on a holding sold within 18 months is taxed at the holder’s marginal rate, and a gain on a holding sold after 18 months or more is taxed at a flat 15%. The gain is $8,400 and the marginal rate is 22%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the tax if the holding is sold within 18 months, at the 22% marginal rate?',
            given: { gain: 8400, marginalRate: 0.22 }, expr: 'round(gain * marginalRate, 2)', format: 'usd', answer: '$1,848.00',
            reasoning: '22% of the $8,400 gain — the rate that applies to the holder’s top dollars of income.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax if the holding is sold after 18 months, at the flat 12%?',
            given: { gain2: 8400, longRate: 0.12 }, expr: 'round(gain2 * longRate, 2)', format: 'usd', answer: '$1,008.00',
            reasoning: '12% of the same $8,400 gain, under the longer-holding rule.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does waiting past the 18-month point save in tax?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$840.00',
            reasoning: '$1,848.00 against $1,008.00 — a saving produced by the date of the sale rather than by anything about the holding itself.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure what is kept, and what waiting risks.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is kept from the gain if sold within 18 months?',
            given: { gain3: 8400 }, expr: 'gain3 - #t1-p1', format: 'usd', answer: '$6,552.00',
            reasoning: '$8,400 less $1,848.00 of tax — what the holder actually retains under the shorter-holding rule.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is kept if sold after 18 months?',
            given: { gain4: 8400 }, expr: 'gain4 - #t1-p2', format: 'usd', answer: '$7,392.00',
            reasoning: '$8,400 less $1,008.00 of tax — the same gain retained under the longer-holding rule.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the gain is kept under the longer-holding rule? Give one decimal place.',
            given: { gain5: 8400 }, expr: 'round(#t2-p2 / gain5 * 100, 1)', format: 'percent1', answer: '88.0%',
            reasoning: '$7,392.00 of $8,400 — exactly what a 12% rate leaves, against the 78.0% left by the 22% rate.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'How far could the holding’s value fall before waiting stopped being worth it? Give one decimal place.',
            given: { gain6: 8400, longRate3: 0.12 }, expr: 'round(#t1-p3 / (1 - longRate3) / gain6 * 100, 1)', format: 'percent1', answer: '11.4%',
            reasoning: 'Selling now nets $6,552.00. Waiting nets 88% of whatever the gain has become, so the break-even gain is $840.00 / 0.88 = $954.55 below $8,400, or 11.4% of it. A smaller gain also carries a smaller tax, which is why the break-even fall is larger than the saving measured against the gain.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'What does the 11.4% figure describe?',
            choices: [
              'The tax rate saved by waiting',
              'The price fall that would cancel the tax saving from waiting',
              'The share of the gain kept under the longer-holding rule',
            ],
            given: {},
            answer: 'The price fall that would cancel the tax saving from waiting',
            reasoning: 'The rate saved is 10 percentage points, the difference between 22% and 12%; the share kept under the longer rule is 88.0%; and 11.4% is the fall in the gain that would leave exactly the $6,552.00 that selling now produces.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Waiting past 18 months saves $840.00 and introduces a risk. Explain the tradeoff precisely, and say what would make waiting clearly the right decision and what would make it clearly the wrong one.',
            acceptableAnswerCriteria: [
              'States the tradeoff in figures: a certain $840.00 of tax saving against exposure to a fall of up to 11.4% in the gain, plus whatever further movement occurs.',
              'Names a condition making waiting right, such as being close to the 18-month point so the exposure is brief, or having no need for the money.',
              'Names a condition making it wrong, such as needing the proceeds sooner, or the holding being volatile enough that a 11.4% move is routine.',
            ],
            evidenceRequirements: [
              'Cites the $840.00 saving and the 11.4% break-even fall.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response treats the tax saving as certain and the price movement as uncertain.',
              'Both conditions are specific to the figures rather than general.',
              'A response noting that the tax tail should not wag the investment dog is making a legitimate point, provided it engages with the $840.00.',
            ],
            commonMisconception: 'Treating a tax saving as a reason to hold an asset regardless of what happens to its value.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The tax difference here comes from the date of a sale, not from anything about the holding. Say what that implies about when a disposal decision should be reviewed, and name one thing the fictional rules leave out.',
            acceptableAnswerCriteria: [
              'States that the holding period should be checked before any disposal, because the same sale on two different dates produces different tax on identical facts.',
              'Names something the outline omits, such as how losses offset gains, what happens when a holding is bought in instalments, or the treatment of income received while holding.',
            ],
            evidenceRequirements: [
              'Refers to the 18-month threshold and to the $840.00 difference it produces.',
            ],
            dimensions: ['assumption-identification', 'transfer'],
            lookFors: [
              'The response identifies the date as a controllable input.',
              'The omission named is a real feature of tax rules on disposals.',
            ],
          },
        ],
      },
    ],
    remediation: 'If waiting appears to save $840.00 on the sale price rather than on the tax, check what each figure applies to. Both rates are charged on the $8,400 gain, and the saving is the difference between $1,848.00 and $1,008.00. The 11.4% figure is then that saving expressed against the gain, not a rate charged on anything.',
    extension: 'Recompute the saving from waiting for a holder whose marginal rate is 14% rather than 22%, and say what that shows about who the holding-period rule benefits most.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l06',
    grade: 11, unit: 7, day: 6,
    actor: 'Barnabas Ifeanyi-Ostrowski, a fictional planner combining two tax reliefs',
    objective: 'Combine a fictional pre-tax contribution and a fictional credit in one calculation, apply them in the correct order, and measure the effect on the effective rate.',
    scenario: 'Barnabas Ifeanyi-Ostrowski is building a fictional annual plan in a simulated tax system. The schedule, the contribution, and the credit below were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional tax schedule and relief figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income, 14% between $9,800 and $38,400, and 22% between $38,400 and $85,400. Barnabas earns $61,500. A pre-tax contribution reduces taxable income; a credit reduces the tax after it has been computed.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Barnabas’s taxable income before any relief?',
            given: { income: 61500, deduction: 11400 }, expr: 'income - deduction', format: 'usd', answer: '$50,100.00',
            reasoning: '$61,500 less the $11,400 standard deduction — above $38,400, so his marginal rate is 22%.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is his tax before any relief?',
            given: { band1: 9800, rate1: 0.1, band2: 38400, rate2: 0.14, rate3: 0.22 },
            expr: 'round(band1 * rate1 + (band2 - band1) * rate2 + (#t1-p1 - band2) * rate3, 2)', format: 'usd', answer: '$7,558.00',
            reasoning: '$980.00, $4,004.00, and 22% of the $11,700 above $38,400.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'A $5,500 pre-tax contribution reduces taxable income. What is his tax after it?',
            given: { contribution: 5500, band1b: 9800, rate1b: 0.1, band2b: 38400, rate2b: 0.14, rate3b: 0.22 },
            expr: 'round(band1b * rate1b + (band2b - band1b) * rate2b + (#t1-p1 - contribution - band2b) * rate3b, 2)', format: 'usd', answer: '$6,348.00',
            reasoning: 'Taxable income falls to $44,600, so the 22% band now covers $6,200 rather than $11,700.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much does the contribution save?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$1,210.00',
            reasoning: '$7,558.00 against $6,348.00 — 22% of the $5,500 contributed, because the whole reduction stayed in the 22% band.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'A $900 credit is also available. It applies to the tax after the contribution has been taken into account.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the tax after both the contribution and the $900 credit?',
            given: { credit: 900 }, expr: '#t1-p3 - credit', format: 'usd', answer: '$5,448.00',
            reasoning: '$6,348.00 less the $900 credit, taken off the tax itself.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total tax reduction from both reliefs together?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$2,110.00',
            reasoning: '$7,558.00 against $5,448.00 — $1,210.00 from the contribution and $900.00 from the credit.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What was his effective rate before any relief, against his $61,500 income? Give one decimal place.',
            given: { income2: 61500 }, expr: 'round(#t1-p2 / income2 * 100, 1)', format: 'percent1', answer: '12.3%',
            reasoning: '$7,558.00 against $61,500 of gross income — the starting position, before either relief is applied.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What is his effective rate after both reliefs? Give one decimal place.',
            given: { income3: 61500 }, expr: 'round(#t2-p1 / income3 * 100, 1)', format: 'percent1', answer: '8.9%',
            reasoning: '$5,448.00 against the same $61,500 — the income has not changed, only the tax charged on it.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Would applying the $900 credit before the contribution change the final tax?',
            choices: [
              'Yes, applying the credit first would give a different result',
              'No, the two reliefs act at different points and the order does not change the total',
            ],
            given: {},
            answer: 'No, the two reliefs act at different points and the order does not change the total',
            reasoning: 'The contribution changes taxable income and so changes the computed tax, while the credit subtracts a fixed $900 from whatever that tax turns out to be; subtracting a fixed amount is unaffected by when it is done, so the final $5,448.00 is the same either way.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The two reliefs reduced Barnabas’s tax by $2,110.00 and his effective rate from 12.3% to 8.9%. Say which relief did more, explain why, and describe what would change the answer.',
            acceptableAnswerCriteria: [
              'Identifies the contribution as doing more, at $1,210.00 against the credit’s $900.00, and explains that this is because 22% of $5,500 exceeds the credit’s face value.',
              'Explains the mechanism: a contribution is worth the marginal rate multiplied by its size, while a credit is worth its face value.',
              'Names what would change the answer, such as a smaller contribution, a lower marginal rate, or a larger credit.',
            ],
            evidenceRequirements: [
              'Cites the $1,210.00 and $900.00 savings and the 22% marginal rate.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The comparison is made on tax saved rather than on the size of each relief.',
              'The condition for the answer changing is stated in terms of the rate or the amounts.',
              'A response noting that the contribution is a deferral while the credit is permanent is drawing an important distinction.',
            ],
            commonMisconception: 'Comparing two tax reliefs by their stated amounts rather than by the tax each saves.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Barnabas’s effective rate fell to 8.9% but his take-home pay also fell by the amount he contributed. Explain why a lower effective rate is not by itself evidence that he is better off.',
            acceptableAnswerCriteria: [
              'Explains that $5,500 of the reduction came from money moved into an account rather than kept, so take-home pay falls by $4,290 net of the $1,210.00 saved.',
              'Distinguishes the two reliefs: the $900 credit genuinely leaves him with more, while the contribution moves money rather than freeing it.',
            ],
            evidenceRequirements: [
              'Uses the $5,500 contribution and the $1,210.00 tax saving in the explanation.',
            ],
            dimensions: ['error-diagnosis', 'plan-coherence'],
            lookFors: [
              'The response tracks where the money went rather than only what happened to the tax.',
              'The distinction between the two reliefs is made explicitly.',
            ],
            commonMisconception: 'Reading a fall in an effective tax rate as a gain in available money.',
          },
        ],
      },
    ],
    remediation: 'If the total reduction comes out at $1,408.00, the $900 credit is being treated as though it reduced taxable income. A credit comes off the tax after it is computed, so it is worth exactly $900.00, while the $5,500 contribution reduces taxable income and is worth 22% of itself. Compute the tax from the reduced taxable income first, then subtract the credit.',
    extension: 'Find the credit that would be worth the same as the $5,500 contribution at Barnabas’s marginal rate, and say what credit would be needed if his marginal rate were 14% instead.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l07',
    grade: 11, unit: 7, day: 7,
    actor: 'Cressida Nwabueze-Lagerfeld, a fictional adviser testing a bracket claim',
    objective: 'Test the fictional claim that a raise crossing a band boundary can reduce take-home pay, compute both cases, and state what the claim confuses.',
    scenario: 'Cressida Nwabueze-Lagerfeld is checking the simulated claim below. The schedule is invented: its deduction, thresholds, and rates were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional tax schedule and the claim in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The claim reads: "Turn down a raise that pushes you into the next band — you take home less." Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income, 14% between $9,800 and $38,400, and 22% between $38,400 and $85,400. The rate charged on the highest band a person’s taxable income reaches is their marginal rate. Test the claim first on a raise that stays inside one band: from $37,900 to $40,400.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the tax on a gross income of $37,900?',
            given: { incomeA: 37900, deduction: 11400, band1: 9800, rate1: 0.1, rate2: 0.14 },
            expr: 'round(band1 * rate1 + (incomeA - deduction - band1) * rate2, 2)', format: 'usd', answer: '$3,318.00',
            reasoning: 'Taxable income is $26,500, so $980.00 in the 10% band and 14% of the $16,700 above it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax on a gross income of $40,400?',
            given: { incomeB: 40400, deduction2: 11400, band1b: 9800, rate1b: 0.1, rate2b: 0.14 },
            expr: 'round(band1b * rate1b + (incomeB - deduction2 - band1b) * rate2b, 2)', format: 'usd', answer: '$3,668.00',
            reasoning: 'Taxable income is $29,000, still inside the 14% band, so $980.00 plus 14% of $19,200.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much extra tax does the $2,500 raise attract?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$350.00',
            reasoning: '$3,668.00 against $3,318.00 — exactly 14% of $2,500, the marginal rate throughout.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more does the worker take home after the raise?',
            given: { raise: 2500 }, expr: 'raise - #t1-p3', format: 'usd', answer: '$2,150.00',
            reasoning: '$2,500 less $350.00 of extra tax. Take-home pay rises, as it must when the marginal rate is below 100%.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the claim on a raise that actually crosses the $38,400 boundary: from $49,500 to $51,000.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the tax on a gross income of $49,500?',
            given: { incomeC: 49500, deduction3: 11400, band1c: 9800, rate1c: 0.1, rate2c: 0.14 },
            expr: 'round(band1c * rate1c + (incomeC - deduction3 - band1c) * rate2c, 2)', format: 'usd', answer: '$4,942.00',
            reasoning: 'Taxable income is $38,100, just under the boundary, so nothing reaches the 22% band.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax on a gross income of $51,000?',
            given: { incomeD: 51000, deduction4: 11400, band1d: 9800, rate1d: 0.1, band2d: 38400, rate2d: 0.14, rate3d: 0.22 },
            expr: 'round(band1d * rate1d + (band2d - band1d) * rate2d + (incomeD - deduction4 - band2d) * rate3d, 2)', format: 'usd', answer: '$5,248.00',
            reasoning: 'Taxable income is $39,600, so $980.00 and $4,004.00 in the lower bands and 22% of the $1,200 above $38,400.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much extra tax does the $1,500 raise attract?',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'usd', answer: '$306.00',
            reasoning: '$300 of the raise is still taxed at 14% and $1,200 at 22%, giving $42.00 plus $264.00 — not 22% of the whole $1,500.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more does the worker take home after crossing the boundary?',
            given: { raise2: 1500 }, expr: 'raise2 - #t2-p3', format: 'usd', answer: '$1,194.00',
            reasoning: '$1,500 less $306.00 — take-home pay still rises, which is what disproves the claim.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Is the claim correct under this schedule?',
            choices: [
              'Yes, crossing the boundary reduces take-home pay',
              'No, take-home pay rises even when the boundary is crossed',
            ],
            given: {},
            decision: { left: '#t2-p4', cmp: '>', right: '0', ifTrue: 'No, take-home pay rises even when the boundary is crossed', ifFalse: 'Yes, crossing the boundary reduces take-home pay' },
            answer: 'No, take-home pay rises even when the boundary is crossed',
            reasoning: 'The $1,500 raise leaves $1,194.00 more in hand, because only the $1,200 above the boundary is taxed at 22% and the rate is well under 100%.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain exactly what the claim confuses, using the second case, and say what would have to be true of a tax system for the claim to be right.',
            acceptableAnswerCriteria: [
              'Identifies the confusion: the claim treats a band rate as applying to all income once the boundary is crossed, when it applies only to the portion above it — $1,200 of the $1,500 here.',
              'States that take-home pay can only fall if the marginal rate on the extra income exceeds 100%, which no band in this schedule approaches.',
              'Uses the split of the raise, $42.00 at 14% and $264.00 at 22%, to show how the boundary is actually handled.',
            ],
            evidenceRequirements: [
              'Cites the $306.00 of extra tax against the $1,500 raise, and the $1,194.00 retained.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response names the "whole income moves to the new rate" belief explicitly.',
              'The condition for the claim to be true is stated in terms of a rate above 100%.',
              'The response does not simply assert the claim is a myth; it shows the arithmetic.',
            ],
            commonMisconception: 'Believing that entering a higher band applies its rate to all of a person’s income.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Some real situations genuinely do reduce a household’s position when income rises slightly, even though tax bands do not. Name one such mechanism, and say how it differs from the band structure tested here.',
            acceptableAnswerCriteria: [
              'Names a genuine mechanism, such as a benefit, subsidy, or credit that is withdrawn entirely once income passes a threshold rather than tapering.',
              'Explains the difference: a band applies its rate only to income above the boundary, while an abrupt withdrawal removes a fixed amount the moment the threshold is crossed.',
            ],
            evidenceRequirements: [
              'Contrasts the mechanism with the $1,200 taxed at 22% in the case just computed.',
            ],
            dimensions: ['transfer', 'criteria-application'],
            lookFors: [
              'The mechanism named genuinely creates a cliff rather than a higher rate.',
              'The response keeps the tax-band point correct while conceding the general possibility.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the tax at $51,000 comes out at $8,712.00, the 22% rate is being applied to the whole taxable income. Only the $1,200 above $38,400 reaches 22%; the first $9,800 is still taxed at 10% and the next $28,600 at 14%. Write the three band pieces separately for both incomes before subtracting one total from the other.',
    extension: 'Find the marginal rate that would have to apply above $38,400 for the $1,500 raise to leave the worker exactly no better off, and say whether any real income tax band comes close to it.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l08',
    grade: 11, unit: 7, day: 8,
    actor: 'Alistair Bergamo-Diarra, a fictional saver at a lower marginal rate',
    objective: 'Transfer the pre-tax contribution analysis to a fictional filer in a lower band, and quantify how the value of the same contribution depends on the rate.',
    scenario: 'Alistair Bergamo-Diarra is considering a contribution to a fictional pre-tax account. His income places him in a lower band than the saver examined earlier in this unit, and testing what that does to the same contribution is the point of the lesson. The schedule below is invented: its deduction, thresholds, and rates were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional tax schedule and contribution figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income and 14% between $9,800 and $38,400. Alistair earns $33,600 and is considering a $4,000 contribution.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Alistair’s taxable income before the contribution?',
            given: { income: 33600, deduction: 11400 }, expr: 'income - deduction', format: 'usd', answer: '$22,200.00',
            reasoning: '$33,600 less the $11,400 standard deduction — well inside the 14% band, so his marginal rate is 14%.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is his tax before the contribution?',
            given: { band1: 9800, rate1: 0.1, rate2: 0.14 },
            expr: 'round(band1 * rate1 + (#t1-p1 - band1) * rate2, 2)', format: 'usd', answer: '$2,716.00',
            reasoning: '$980.00 in the 10% band plus 14% of the $12,400 above it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is his tax after a $4,000 contribution reduces taxable income?',
            given: { contribution: 4000, band1b: 9800, rate1b: 0.1, rate2b: 0.14 },
            expr: 'round(band1b * rate1b + (#t1-p1 - contribution - band1b) * rate2b, 2)', format: 'usd', answer: '$2,156.00',
            reasoning: 'Taxable income falls to $18,200, still above $9,800, so the whole reduction stays in the 14% band.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much tax does the contribution save?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$560.00',
            reasoning: '$2,716.00 against $2,156.00 — exactly 14% of the $4,000 contributed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare with the same contribution made by a filer whose marginal rate is 22%.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the net cost to Alistair of putting $4,000 into the account?',
            given: { contribution2: 4000 }, expr: 'contribution2 - #t1-p4', format: 'usd', answer: '$3,440.00',
            reasoning: '$4,000 into the account for $3,440.00 of reduced take-home pay.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'The saving is what percentage of the contribution? Give one decimal place.',
            given: { contribution3: 4000 }, expr: 'round(#t1-p4 / contribution3 * 100, 1)', format: 'percent1', answer: '14.0%',
            reasoning: 'Exactly his marginal rate, which is the check that the whole reduction stayed inside one band.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the same $4,000 contribution save a filer whose marginal rate is 22%?',
            given: { contribution4: 4000, higherRate: 0.22 }, expr: 'round(contribution4 * higherRate, 2)', format: 'usd', answer: '$880.00',
            reasoning: '22% of $4,000, assuming the whole reduction stays inside that band.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much less is the same contribution worth to Alistair?',
            given: {}, expr: '#t2-p3 - #t1-p4', format: 'usd', answer: '$320.00',
            reasoning: '$880.00 against $560.00 — the identical action is worth 57% more to the filer at the higher rate.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Alistair expects his income to rise into the 22% band within a few years. What does that suggest about the timing of pre-tax contributions?',
            choices: [
              'They are worth more once the marginal rate is higher, so deferring them raises their tax value',
              'They are worth more now, because the account has longer to grow',
              'The marginal rate makes no difference to what a contribution saves',
            ],
            given: {},
            decision: { left: '#t2-p3', cmp: '>', right: '#t1-p4', ifTrue: 'They are worth more once the marginal rate is higher, so deferring them raises their tax value', ifFalse: 'The marginal rate makes no difference to what a contribution saves' },
            answer: 'They are worth more once the marginal rate is higher, so deferring them raises their tax value',
            reasoning: 'The same $4,000 saves $880.00 at 22% against $560.00 at 14%, so the tax value of the deduction genuinely rises with the rate — though this says nothing about the growth the account would forgo by waiting, which is a separate consideration the option about growth raises but does not settle.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The same contribution saves $560.00 for Alistair and $880.00 at the higher rate. Say what carries over unchanged from the earlier lesson, what the difference in rate does, and why the deferral argument is not decisive.',
            acceptableAnswerCriteria: [
              'States what carries over: a deduction is always worth the marginal rate multiplied by its size, and that rule produced both figures.',
              'Explains that the rate is the only thing that differs, so the same action has different tax value to different filers.',
              'Explains why deferring is not automatically right: waiting forgoes years of growth in the account, and the future rate is not certain.',
            ],
            evidenceRequirements: [
              'Cites the $560.00 and $880.00 savings and the 14% and 22% rates behind them.',
            ],
            dimensions: ['transfer', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the general rule as unchanged rather than treating this as a new case.',
              'The counter-argument about forgone growth is made rather than only mentioned.',
              'A response noting that a filer at 14% now might benefit more from a post-tax account is drawing on the earlier unit correctly.',
            ],
            commonMisconception: 'Assuming a tax-advantaged action is equally valuable to everyone who takes it.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Alistair’s taxable income after the contribution is $18,200, still above the $9,800 boundary. Say what would happen to the saving if he contributed $10,000 instead, and why the answer is not simply 14% of $10,000.',
            acceptableAnswerCriteria: [
              'States that only the first $12,400 of contribution would stay in the 14% band, so part of a $10,000 contribution would still save 14% but the calculation must be checked against the $9,800 boundary.',
              'Confirms that $10,000 keeps taxable income at $12,200, still above $9,800, so the saving would in fact be the full 14% — and shows the check rather than asserting it.',
            ],
            evidenceRequirements: [
              'Uses the $22,200.00 taxable income and the $9,800 band boundary in the check.',
            ],
            dimensions: ['transfer', 'criteria-application'],
            lookFors: [
              'The response performs the boundary check rather than applying one rate by assumption.',
              'The response reaches the correct conclusion by working rather than by guessing.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the saving comes out at $880.00, the 22% rate is being applied to a filer whose taxable income never reaches $38,400. Alistair’s taxable income is $22,200.00, so his marginal rate is 14% and the $4,000 contribution saves $560.00. Identify which band the taxable income sits in before choosing any rate.',
    extension: 'Find the contribution at which part of Alistair’s reduction would drop into the 10% band, and say what the saving on that last portion would be.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l09',
    grade: 11, unit: 7, day: 9,
    actor: 'Philippa Onyekachi-Stavros, a fictional filer with a credit larger than her tax',
    objective: 'Compute what a fictional non-refundable credit is worth when it exceeds the tax due, contrast it with a refundable one, and express the wasted portion.',
    scenario: 'Philippa Onyekachi-Stavros is examining a fictional credit in a simulated tax system. The schedule and the credit rules below were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional tax schedule and credit rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is gross income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income and 14% between $9,800 and $38,400. Philippa earns $24,300. A fictional credit of $1,800 is available. A non-refundable credit can reduce tax to zero but no further; a refundable one pays out any excess.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Philippa’s taxable income?',
            given: { income: 24300, deduction: 11400 }, expr: 'income - deduction', format: 'usd', answer: '$12,900.00',
            reasoning: '$24,300 less the $11,400 standard deduction — only $3,100 of it reaches the 14% band.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is her tax before any credit?',
            given: { band1: 9800, rate1: 0.1, rate2: 0.14 },
            expr: 'round(band1 * rate1 + (#t1-p1 - band1) * rate2, 2)', format: 'usd', answer: '$1,414.00',
            reasoning: '$980.00 in the 10% band plus 14% of the $3,100 above it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the $1,800 credit can a non-refundable version actually be used against?',
            given: { credit: 1800 }, expr: 'min(credit, #t1-p2)', format: 'usd', answer: '$1,414.00',
            reasoning: 'The credit cannot reduce tax below zero, so only $1,414.00 of it does any work — the rest has nothing left to offset.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the credit is wasted if it is non-refundable?',
            given: { credit2: 1800 }, expr: 'credit2 - #t1-p3', format: 'usd', answer: '$386.00',
            reasoning: '$1,800 offered against $1,414.00 usable — the excess disappears, because there was not enough tax for it to reduce.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two versions of the credit.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Philippa’s tax after a non-refundable $1,800 credit?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$0.00',
            reasoning: 'The credit reduces the $1,414.00 of tax to nothing, and stops there.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is she better off by if the credit is refundable instead?',
            given: {}, expr: '#t1-p4', format: 'usd', answer: '$386.00',
            reasoning: 'A refundable credit pays out the $386.00 excess rather than letting it lapse — the only difference between the two versions at this income.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the $1,800 credit is lost under the non-refundable version? Give one decimal place.',
            given: { credit3: 1800 }, expr: 'round(#t1-p4 / credit3 * 100, 1)', format: 'percent1', answer: '21.4%',
            reasoning: '$386.00 of $1,800 — over a fifth of the stated relief never reaches the filer it was offered to.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How large a deduction would have produced the same saving as the usable part of the credit, at Philippa’s 14% marginal rate?',
            given: { rate2b: 0.14 }, expr: 'round(#t1-p3 / rate2b, 2)', format: 'usd', answer: '$10,100.00',
            reasoning: '$1,414.00 of saving divided by 14% — a deduction almost as large as the entire standard deduction.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Who is affected by whether a credit is refundable?',
            choices: [
              'Filers whose tax is smaller than the credit',
              'Filers whose tax is larger than the credit',
              'All filers equally',
            ],
            given: {},
            decision: { left: '#t1-p4', cmp: '>', right: '0', ifTrue: 'Filers whose tax is smaller than the credit', ifFalse: 'All filers equally' },
            answer: 'Filers whose tax is smaller than the credit',
            reasoning: 'Philippa loses $386.00 because her $1,414.00 of tax is less than the $1,800 credit; a filer with tax above $1,800 would use the whole credit either way, so refundability changes nothing for them.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A $1,800 credit delivers $1,414.00 to Philippa and would deliver the full $1,800 to someone with a larger tax bill. Explain the mechanism, and say what that pattern means for who a non-refundable credit reaches.',
            acceptableAnswerCriteria: [
              'Explains that a non-refundable credit can only offset tax that exists, so its value is capped at the filer’s tax — $1,414.00 here.',
              'States the consequence: the relief is worth less to filers with lower incomes, which is often the opposite of what a credit is designed to do.',
              'Uses the 21.4% wasted share to show the size of the effect at this income.',
            ],
            evidenceRequirements: [
              'Cites the $1,414.00 tax, the $1,800 credit, and the $386.00 that lapses.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response identifies the cap as the mechanism rather than describing the outcome.',
              'The distributional point follows from the mechanism.',
              'A response noting that refundability is what makes a credit reach filers with little or no tax is stating the design point correctly.',
            ],
            commonMisconception: 'Assuming a stated credit amount is what every eligible filer receives.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'A deduction of $10,100.00 would have matched the usable credit. Say what that comparison shows about relief at low incomes, and which form of relief you would design for a filer in Philippa’s position.',
            acceptableAnswerCriteria: [
              'Observes that a deduction large enough to match the credit is implausible at this income, since $10,100.00 approaches the whole $11,400 standard deduction and her taxable income is only $12,900.00.',
              'Argues for a refundable credit for a filer in this position, with a reason grounded in the $386.00 that would otherwise lapse.',
            ],
            evidenceRequirements: [
              'Refers to the $10,100.00 equivalent deduction and the $12,900.00 taxable income.',
            ],
            dimensions: ['criteria-application', 'plan-coherence'],
            lookFors: [
              'The response checks the equivalent deduction against what is available at this income.',
              'The design choice is justified rather than asserted.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the credit appears to save the full $1,800, the cap is being ignored. A non-refundable credit cannot reduce tax below zero, and Philippa’s tax is only $1,414.00, so $386.00 has nothing to offset. Compute the tax first, then take the smaller of the tax and the credit.',
    extension: 'Find the income at which Philippa could use the whole $1,800 credit under the non-refundable rule, and say how far above her current $24,300 that is.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l10',
    grade: 11, unit: 7, day: 10,
    actor: 'Octavia Mbamalu-Ferrand, a fictional filer building a full estimate',
    objective: 'Build a complete fictional tax estimate across employment and self-employment income, reconcile it against what has already been withheld, and convert the balance into instalments.',
    scenario: 'Octavia Mbamalu-Ferrand is preparing a fictional annual estimate in a simulated tax system. The schedule, the self-employment rate, and all income figures below were chosen for this performance task and describe no real tax system.',
    materials: ['calculator', 'the fictional income and tax figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional schedule, taxable income is total income less a standard deduction of $11,400, and tax is 10% on the first $9,800 of taxable income, 14% between $9,800 and $38,400, and 22% between $38,400 and $85,400. A fictional self-employment contribution of 14.2% is charged on net self-employment income only. Octavia earns $41,800 from employment with $4,180 already withheld, and runs a fictional business with revenue of $28,600 and allowable expenses of $9,350.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Octavia’s net self-employment income?',
            given: { revenue: 28600, expenses: 9350 }, expr: 'revenue - expenses', format: 'usd', answer: '$19,250.00',
            reasoning: 'Revenue less allowable expenses — the profit, which is what both charges are computed on.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is her total income?',
            given: { employment: 41800 }, expr: 'employment + #t1-p1', format: 'usd', answer: '$61,050.00',
            reasoning: '$41,800 of employment income plus $19,250.00 of net self-employment income.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is her taxable income?',
            given: { deduction: 11400 }, expr: '#t1-p2 - deduction', format: 'usd', answer: '$49,650.00',
            reasoning: '$61,050.00 less the $11,400 standard deduction — above $38,400, so part of it reaches the 22% band.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is her income tax?',
            given: { band1: 9800, rate1: 0.1, band2: 38400, rate2: 0.14, rate3: 0.22 },
            expr: 'round(band1 * rate1 + (band2 - band1) * rate2 + (#t1-p3 - band2) * rate3, 2)', format: 'usd', answer: '$7,459.00',
            reasoning: '$980.00, $4,004.00, and 22% of the $11,250 above $38,400.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now add the self-employment contribution and reconcile against what has already been paid.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the 14.2% self-employment contribution?',
            given: { seRate: 0.142 }, expr: 'round(#t1-p1 * seRate, 2)', format: 'usd', answer: '$2,733.50',
            reasoning: '14.2% of the $19,250.00 net self-employment income. The employment income does not attract it.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is her total tax for the year?',
            given: {}, expr: '#t1-p4 + #t2-p1', format: 'usd', answer: '$10,192.50',
            reasoning: '$7,459.00 of income tax and $2,733.50 of self-employment contribution.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is still owed, after the $4,180 already withheld from her employment income?',
            given: { withheld: 4180 }, expr: '#t2-p2 - withheld', format: 'usd', answer: '$6,012.50',
            reasoning: '$10,192.50 of total tax against $4,180 already paid — the withholding was set against the employment income alone.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Paid in 4 equal quarterly instalments, how much is each?',
            given: {}, expr: 'round(#t2-p3 / 4, 2)', format: 'usd', answer: '$1,503.13',
            reasoning: '$6,012.50 across 4 instalments. Setting this aside from each payment the business receives is what stops the balance arriving as a surprise.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'What is her effective rate against total income? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t1-p2 * 100, 1)', format: 'percent1', answer: '16.7%',
            reasoning: '$10,192.50 against $61,050.00.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'percent',
            text: 'What share of the total tax is still outstanding after the withholding? Give one decimal place.',
            given: {}, expr: 'round(#t2-p3 / #t2-p2 * 100, 1)', format: 'percent1', answer: '59.0%',
            reasoning: '$6,012.50 of $10,192.50 — most of the year’s tax is not covered by withholding, which is the position a second income source creates.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One check before the recommendation.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'What share of her net self-employment income would need to be set aside to cover the $6,012.50 balance? Give one decimal place.',
            given: {}, expr: 'round(#t2-p3 / #t1-p1 * 100, 1)', format: 'percent1', answer: '31.2%',
            reasoning: '$6,012.50 against $19,250.00 of net self-employment income — roughly the 22% marginal income-tax rate plus the 14.2% contribution, less the effect of the withholding already made.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Why is more than half the year’s tax still outstanding when Octavia has been paying tax all year?',
            choices: [
              'Because the withholding was computed against the employment income alone',
              'Because self-employment income is taxed at a higher rate in every band',
              'Because the standard deduction only applies to employment income',
            ],
            given: {},
            answer: 'Because the withholding was computed against the employment income alone',
            reasoning: 'The $4,180 withheld relates to the $41,800 of employment income, while the $19,250.00 of self-employment income attracted both income tax and the 14.2% contribution with nothing withheld; the bands are the same for both sources and the $11,400 deduction was applied to total income.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your recommendation. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend how Octavia should handle her tax across the coming year. State what she should set aside and from what, name the figure that would change your recommendation most if it were wrong, and say what she should do differently from a filer with employment income alone.',
            acceptableAnswerCriteria: [
              'Recommends setting aside a share of each business payment, grounded in the 31.2% figure or in the 22% band rate plus the 14.2% contribution.',
              'Names the figure the recommendation is most exposed to, most defensibly the $9,350 of allowable expenses, since it changes both the income tax and the contribution.',
              'States what differs from an employment-only filer: nothing is withheld from the business income, so the $6,012.50 has to be set aside deliberately and paid in instalments.',
            ],
            evidenceRequirements: [
              'Cites the $10,192.50 total tax, the $6,012.50 balance, and the $1,503.13 quarterly instalment.',
              'Refers to the 16.7% effective rate or the 31.2% set-aside share.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'assumption-identification', 'criteria-application'],
            lookFors: [
              'The set-aside is expressed against business receipts or profit rather than against total income.',
              'The exposed figure is identified with a reason it could be wrong.',
              'A response noting that a bad estimate of expenses moves both charges at once is reading the structure correctly.',
            ],
            commonMisconception: 'Assuming that tax withheld from one income source covers a filer’s whole liability.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Octavia’s effective rate is 16.7% and her marginal income-tax rate is 22%. Say what each would tell her about a decision to take on $3,000 more of business work, and which she should use.',
            acceptableAnswerCriteria: [
              'States that the marginal figures apply: the extra $3,000 of net income would attract 22% income tax plus the 14.2% contribution, leaving about $1,914 of it.',
              'Explains that the 16.7% effective rate describes the whole year already earned and would overstate what the extra work is worth.',
            ],
            evidenceRequirements: [
              'Uses the 22% band rate and the 14.2% contribution rate when valuing the extra work.',
            ],
            dimensions: ['criteria-application', 'transfer'],
            lookFors: [
              'Both charges are applied to the extra income, not just the income tax.',
              'The response computes what is kept rather than only naming the rates.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the balance owed comes out at $10,192.50, the $4,180 already withheld has not been credited. Withholding is a payment on account against the same liability, so it comes off the total. If instead the balance comes out near $3,279.00, the self-employment contribution has been left out of the total tax. Build the estimate as four rows — income tax, contribution, total, less withheld — before dividing by 4.',
    extension: 'Recompute the whole estimate if Octavia’s business revenue fell to $22,000 with expenses unchanged, and say whether the quarterly instalment falls by more or less than the fall in profit.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u07-l11',
    grade: 11, unit: 7, day: 11,
    actor: 'Sylvester Adeyinka-Novotny, a fictional analyst defending a disposal decision',
    objective: 'Defend a fictional disposal decision on tax grounds, incorporate an offsetting loss, and state the limits of letting a tax rule drive the timing.',
    scenario: 'Sylvester Adeyinka-Novotny is defending a fictional disposal decision for a simulated case review. The holding-period rule, the rates, and the loss below were chosen for this course and describe no real tax system.',
    materials: ['calculator', 'the fictional gain, loss, and tax rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional rules, a gain on a holding sold within 18 months is taxed at the holder’s marginal rate of 22%, and a gain on a holding sold after 18 months or more is taxed at a flat 15%. A separate holding can be sold at a loss, and the loss reduces the taxable gain dollar for dollar. The gain is $12,600 and the available loss is $3,100.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the tax on the gain if sold within 18 months, at 22%?',
            given: { gain: 12600, marginalRate: 0.22 }, expr: 'round(gain * marginalRate, 2)', format: 'usd', answer: '$2,772.00',
            reasoning: '22% of the $12,600 gain — the marginal rate applies because the holding was sold inside the 18-month window.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax if sold after 18 months, at 12%?',
            given: { gain2: 12600, longRate: 0.12 }, expr: 'round(gain2 * longRate, 2)', format: 'usd', answer: '$1,512.00',
            reasoning: '12% of the same gain, under the longer-holding rule.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does waiting past the 18-month point save?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$1,260.00',
            reasoning: '$2,772.00 against $1,512.00 — the value of the timing alone.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now bring in the $3,100 loss, which reduces the taxable gain.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the taxable gain after the $3,100 loss is offset against it?',
            given: { gain3: 12600, loss: 3100 }, expr: 'gain3 - loss', format: 'usd', answer: '$9,500.00',
            reasoning: '$12,600 less $3,100 — the loss reduces the amount subject to tax, not the tax itself.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax on the reduced gain under the longer-holding rule?',
            given: { longRate2: 0.12 }, expr: 'round(#t2-p1 * longRate2, 2)', format: 'usd', answer: '$1,140.00',
            reasoning: '12% of the $9,500.00 that remains taxable once the loss has been offset against the gain.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does the loss offset save under the longer-holding rule?',
            given: {}, expr: '#t1-p2 - #t2-p2', format: 'usd', answer: '$372.00',
            reasoning: '$1,512.00 against $1,140.00 — 12% of the $3,100 loss, because a loss offset is worth the rate applied to the gain it removes.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What would the same loss offset save under the within-18-months rule instead?',
            given: { loss2: 3100, marginalRate2: 0.22 }, expr: 'round(loss2 * marginalRate2, 2)', format: 'usd', answer: '$682.00',
            reasoning: '22% of $3,100 — the offset is worth more against a gain taxed at the higher rate, which is the opposite of the direction the holding-period rule pushes.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'Combining both moves, how much lower is the tax than selling within 18 months with no offset?',
            given: {}, expr: '#t1-p1 - #t2-p2', format: 'usd', answer: '$1,632.00',
            reasoning: '$2,772.00 against $1,140.00 — $1,260.00 from the timing and $372.00 from the offset.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'percent',
            text: 'The combined saving is what percentage of the original gain? Give one decimal place.',
            given: { gain4: 12600 }, expr: 'round(#t2-p5 / gain4 * 100, 1)', format: 'percent1', answer: '13.0%',
            reasoning: '$1,632.00 against the $12,600 gain. This is not the break-even price fall: because a smaller gain also carries a smaller tax, the fall that would cancel both moves is $1,632.00 / 0.88 = $1,854.55, or 14.7% of the gain.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Write your defence. Answer both.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Defend a recommendation about when to sell. State the tax saving you are relying on, the risk the recommendation carries, and the circumstance in which you would reverse it.',
            acceptableAnswerCriteria: [
              'States a clear recommendation and the saving behind it — $1,260.00 from waiting, $372.00 from the offset, or the combined $1,632.00.',
              'Names the risk in figures: a fall of 14.7% in the holding while waiting would cancel the entire combined saving, and the fall is uncertain while the saving is not.',
              'Names a reversal condition, such as needing the proceeds before the 18-month point, a holding volatile enough that 14.7% is a routine move, or the loss position changing.',
            ],
            evidenceRequirements: [
              'Cites the $1,632.00 combined saving and the 14.7% break-even fall.',
              'Refers to the difference between the $372.00 and $682.00 values of the same offset under the two rules.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The recommendation is decided and the figure supporting it is named.',
              'The risk is quantified rather than acknowledged.',
              'Either recommendation is acceptable if it prices the certain saving against the uncertain movement.',
            ],
            commonMisconception: 'Treating a tax saving as decisive without pricing the risk taken to obtain it.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The same $3,100 loss is worth $372.00 against a long-held gain and $682.00 against a short-held one. Explain what that implies about which gains a loss should be set against, and why the two tax rules pull in opposite directions here.',
            acceptableAnswerCriteria: [
              'States that a loss is worth more offset against gains taxed at the higher rate, so it should be set against short-held gains where a choice exists.',
              'Explains the tension: the holding-period rule rewards waiting, which lowers the rate, and a lower rate makes any loss offset worth less.',
            ],
            evidenceRequirements: [
              'Uses both offset values, $372.00 and $682.00, and the rates that produce them.',
            ],
            dimensions: ['transfer', 'criteria-application'],
            lookFors: [
              'The response identifies the rate as what determines an offset’s value.',
              'The tension between the two rules is stated rather than only one side of it.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the loss offset appears to save $3,100, it is being treated as a credit. A loss reduces the taxable gain from $12,600 to $9,500.00, and the tax then falls by the rate applied to that reduction — $372.00 at 15%. Recompute the tax from the reduced gain rather than subtracting the loss from the tax.',
    extension: 'Find the loss that would be needed to bring the tax on the long-held gain down to $1,000, and say whether that loss is larger or smaller than the gain itself.',
  },
]
