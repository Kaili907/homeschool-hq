import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 7 — PF7 Paying Taxes: Tax Structure, Withholding, and Filing.
 *
 * One fictional schedule runs through the unit, and every lesson that uses it
 * states it in full on the learner-facing sheet:
 *
 *   - Taxable income is gross income less a standard deduction of $11,200.
 *     Brackets are applied to taxable income, never to gross. Every lesson
 *     that computes a bracket total computes the deduction first, as a visible
 *     step the learner performs.
 *   - Rates on taxable income: 10% on the first $9,800, 14% from $9,800 to
 *     $42,000, and 24% above $42,000.
 *   - Payroll tax is a 6% social insurance levy on wages up to a cap of
 *     $158,000, plus a 1.5% health levy on all wages with no cap. On
 *     self-employment income the fictional system charges both the employee
 *     and employer shares, 15% in total, with no further adjustment.
 *
 * The deduction, the thresholds, the rates, the cap, and the penalty schedule
 * in l06 are all invented, and are deliberately not the published figures of
 * any real tax system. They are also deliberately different from the fictional
 * grade-9 schedule, so a learner who has done both meets a second structure
 * rather than a memorised one. The grade-9 schedule had two brackets and a
 * different deduction; this one has three brackets, a wage cap, and
 * self-employment treatment.
 *
 * No lesson asks a learner for real income, real withholding, or any real tax
 * document, and nothing here is tax advice.
 */
export const g10u07: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u07-l01',
    grade: 10, unit: 7, day: 1,
    actor: 'a fictional worker whose income reaches into the third bracket',
    objective: 'Compute a fictional worker’s income tax bracket by bracket from taxable income, then distinguish the marginal rate from the effective rate on taxable income and on gross income.',
    scenario: 'The simulated tax schedule below is invented for this exercise. Its deduction, thresholds, and rates are not the published figures of any real tax system, and a real return has many more steps than this.',
    materials: ['calculator', 'the fictional tax schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional federal schedule, taxable income is gross income less a standard deduction of $11,200. The schedule then charges 10% on the first $9,800 of taxable income, 14% on taxable income between $9,800 and $42,000, and 24% on taxable income above $42,000. A fictional worker has a gross income of $58,000. Work out the deduction first — the rates apply to taxable income, never to gross.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the worker’s taxable income?',
            given: { gross: 58000, stdDed: 11200 }, expr: 'gross - stdDed', format: 'usd', answer: '$46,800.00',
            reasoning: '$58,000 of gross income less the $11,200 standard deduction. Every rate below is applied to this figure, not to the $58,000.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the first bracket?',
            given: { b1: 9800, r1: 0.1 }, expr: 'b1 * r1', format: 'usd', answer: '$980.00',
            reasoning: '10% of the first $9,800 of taxable income. Every filer with at least this much taxable income pays exactly this on the first bracket, whatever they earn above it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the second bracket?',
            given: { b1b: 9800, b2: 42000, r2: 0.14 }, expr: '(b2 - b1b) * r2', format: 'usd', answer: '$4,508.00',
            reasoning: '14% of the band from $9,800 to $42,000, which is $32,200 wide. This worker’s taxable income runs past the top of this band, so the whole band is charged.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now finish the calculation and state the result three different ways.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the third bracket?',
            given: { b2b: 42000, r3: 0.24 }, expr: '(#t1-p1 - b2b) * r3', format: 'usd', answer: '$1,152.00',
            reasoning: '24% of the taxable income above $42,000, which is $4,800 here. Only this last slice is charged at 24%.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total federal income tax?',
            given: {}, expr: '#t1-p2 + #t1-p3 + #t2-p1', format: 'usd', answer: '$6,640.00',
            reasoning: '$980.00 plus $4,508.00 plus $1,152.00, the three bracket amounts added.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What is the effective rate on taxable income — the total tax divided by taxable income?',
            given: {}, expr: '#t2-p2 / #t1-p1 * 100', format: 'percent2', answer: '14.19%',
            reasoning: '$6,640.00 against $46,800.00 of taxable income. This is well below the 24% marginal rate, because only the top slice is taxed at 24%.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What is the effective rate on gross income?',
            given: { gross2: 58000 }, expr: '#t2-p2 / gross2 * 100', format: 'percent2', answer: '11.45%',
            reasoning: '$6,640.00 against the $58,000 of gross income. Lower again, because the $11,200 deduction removed income from the calculation entirely.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'What rate would apply to one additional dollar of this worker’s gross income?',
            choices: ['10%', '14%', '24%', '11.45%'],
            given: { threshold: 42000 },
            decision: { left: '#t1-p1', cmp: '>', right: 'threshold', ifTrue: '24%', ifFalse: '14%' },
            answer: '24%',
            reasoning: 'Taxable income of $46,800.00 is above the $42,000 threshold, so an additional dollar falls in the top bracket and is charged at 24%. That is the marginal rate, and it is the rate that applies to a change rather than to the whole income.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This worker has a 24% marginal rate, a 14.19% effective rate on taxable income, and an 11.45% effective rate on gross income. Explain what question each of the three rates answers, and say which one a person should use when deciding whether extra work is worth taking on.',
            acceptableAnswerCriteria: [
              'Assigns each rate a distinct question: the marginal rate answers what the next dollar costs, the effective rate on taxable income answers what the taxed income bore on average, and the effective rate on gross answers what share of everything earned went to this tax.',
              'Identifies the marginal rate as the one that governs a decision about extra work, since extra income is taxed at the top of the stack rather than at the average.',
              'Notes that all three figures are correct descriptions of the same $6,640.00, so quoting one as "the tax rate" without saying which is what causes confusion.',
            ],
            evidenceRequirements: [
              'Uses the $6,640.00 total and at least two of the three rates.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response ties each rate to a decision or a question rather than ranking them.',
              'The response recognises that the gap between 24% and 11.45% comes from the bracket structure and the deduction together, not from either alone.',
            ],
            commonMisconception: 'Treating a filer’s top bracket as the rate applied to all of their income.',
          },
        ],
      },
    ],
    remediation: 'If the total comes out near $13,920, the 24% rate is being applied to the whole $58,000. Two things happen before any rate is applied: $11,200 comes off as the standard deduction, and the taxable income that remains is then split across the three bands. Only the $4,800 above $42,000 is charged at 24%.',
    extension: 'Recompute all three rates for a fictional worker with a gross income of $30,000 under the same schedule, and say which of the three moves most between the two workers.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l02',
    grade: 10, unit: 7, day: 2,
    actor: 'a fictional payroll office withholding for two workers with very different wages',
    objective: 'Compute payroll tax for two fictional wage levels under a schedule with a wage cap on one levy and none on the other, and show that the combined rate falls as wages rise past the cap.',
    scenario: 'The simulated payroll levies below are invented for this exercise. In this fictional system the social insurance levy is 6% of wages up to a cap of $158,000, and the health levy is 1.5% of all wages with no cap. These are separate from the income tax and are withheld from every paycheck.',
    materials: ['calculator', 'the fictional payroll schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Worker A earns wages of $58,000 in the simulated year, which is below the $158,000 social insurance cap. Compute each levy separately. Note that no deduction applies to payroll tax in this system: the levies are charged on wages from the first dollar.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Worker A’s social insurance levy?',
            given: { wagesA: 58000, socRate: 0.06 }, expr: 'wagesA * socRate', format: 'usd', answer: '$3,480.00',
            reasoning: '6% of $58,000. The wages are below the cap, so the whole amount is subject to the levy.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Worker A’s health levy?',
            given: { wagesA2: 58000, healthRate: 0.015 }, expr: 'wagesA2 * healthRate', format: 'usd', answer: '$870.00',
            reasoning: '1.5% of $58,000, with no cap to consider.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Worker A’s total payroll tax?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$4,350.00',
            reasoning: '$3,480.00 plus $870.00. Note this is charged on top of any income tax, and unlike income tax it receives no standard deduction.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Worker B earns wages of $210,000 in the same year, which is above the cap. Apply the cap to the social insurance levy only.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Worker B’s social insurance levy?',
            given: { wagesB: 210000, cap: 158000, socRate2: 0.06 }, expr: 'min(wagesB, cap) * socRate2', format: 'usd', answer: '$9,480.00',
            reasoning: '6% is charged on the first $158,000 only. The $52,000 of wages above the cap carries no social insurance levy at all.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Worker B’s health levy?',
            given: { wagesB2: 210000, healthRate2: 0.015 }, expr: 'wagesB2 * healthRate2', format: 'usd', answer: '$3,150.00',
            reasoning: '1.5% of the whole $210,000, because this levy has no cap.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Worker B’s total payroll tax?',
            given: {}, expr: '#t2-p1 + #t2-p2', format: 'usd', answer: '$12,630.00',
            reasoning: '$9,480.00 of social insurance plus $3,150.00 of health levy, charged on the same wages with no deduction.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What share of Worker B’s wages is that?',
            given: { wagesB3: 210000 }, expr: '#t2-p3 / wagesB3 * 100', format: 'percent2', answer: '6.01%',
            reasoning: '$12,630.00 against $210,000 of wages.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'What share of Worker A’s wages was their payroll tax?',
            given: { wagesA3: 58000 }, expr: '#t1-p3 / wagesA3 * 100', format: 'percent2', answer: '7.50%',
            reasoning: '$4,350.00 against $58,000 — a higher share than the worker earning nearly four times as much, because the cap removed the social insurance levy from Worker B’s top $52,000.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The income tax in the previous lesson took a larger share as income rose; this payroll tax takes a smaller one. Explain what feature of each schedule produces that difference, and say why a person comparing two jobs should look at both taxes rather than the income tax alone.',
            acceptableAnswerCriteria: [
              'Identifies the two features: rising bracket rates make the income tax take a larger share as income rises, while the $158,000 cap on the social insurance levy makes the payroll tax take a smaller share above that point.',
              'Uses the 7.50% and 6.01% figures to show the direction, and notes that the health levy alone would have kept the rate flat.',
              'Concludes that comparing jobs on income tax alone understates the total, because payroll tax is charged from the first dollar with no deduction.',
            ],
            evidenceRequirements: [
              'Uses both workers’ total payroll tax figures and both of the share percentages.',
            ],
            dimensions: ['reasoning-from-figures', 'transfer', 'criteria-application'],
            lookFors: [
              'The response points at the cap specifically as the mechanism.',
              'The response notes that payroll tax has no deduction, which is why it starts biting at incomes where income tax is still zero.',
            ],
            commonMisconception: 'Assuming every tax takes a larger share of a larger income.',
          },
        ],
      },
    ],
    remediation: 'If Worker B’s social insurance levy comes out as $12,600, the 6% is being charged on the whole $210,000. The cap stops that levy at $158,000 of wages, so the charge is 6% of $158,000. The health levy is the one with no cap, and it does apply to all $210,000.',
    extension: 'Find the wage level at which the combined payroll rate first falls below 7%, and say what happens to that rate as wages continue to rise.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l03',
    grade: 10, unit: 7, day: 3,
    actor: 'a fictional filer with one job and one side arrangement reporting on different forms',
    objective: 'Combine fictional wage income and non-employee income into one taxable figure, compute the income tax, and show why a balance is owed at filing when only one of the two had tax withheld.',
    scenario: 'The simulated forms and figures below are invented for this exercise. This lesson computes income tax only; the payroll tax on the non-employee income is set aside here and taken up later in the unit. No learner is asked for a real tax document.',
    materials: ['calculator', 'the fictional form figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional filer receives two forms for the simulated year. A W-2 reports $34,000 of wages from an employer, with $2,100 of federal income tax withheld across the year — the amount set by the W-4 the filer completed when hired. A 1099 reports $9,600 paid for work done as a non-employee, with nothing withheld. Both figures are reported on the same 1040. The standard deduction is $11,200, and the rates are 10% on the first $9,800 of taxable income and 14% between $9,800 and $42,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s total income for the year?',
            given: { w2Wages: 34000, form1099: 9600 }, expr: 'w2Wages + form1099', format: 'usd', answer: '$43,600.00',
            reasoning: 'The $34,000 of wages plus the $9,600 reported on the 1099. Both are income; the forms differ in who reports them and whether anything was withheld, not in whether they are taxed.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s taxable income?',
            given: { stdDed: 11200 }, expr: '#t1-p1 - stdDed', format: 'usd', answer: '$32,400.00',
            reasoning: 'The $43,600.00 of total income less the $11,200 standard deduction. The deduction is applied once, to the combined income, not once per form.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the first bracket?',
            given: { b1: 9800, r1: 0.1 }, expr: 'b1 * r1', format: 'usd', answer: '$980.00',
            reasoning: '10% of the first $9,800 of taxable income.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now finish the tax and compare it with what was withheld.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much tax is charged on the second bracket?',
            given: { b1b: 9800, r2: 0.14 }, expr: '(#t1-p2 - b1b) * r2', format: 'usd', answer: '$3,164.00',
            reasoning: '14% of the taxable income above $9,800, which is $22,600 here. The filer’s taxable income does not reach $42,000, so the third bracket is not used.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total income tax for the year?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$4,144.00',
            reasoning: '$980.00 from the first bracket plus $3,164.00 from the second. This is the tax on both forms of income together.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'The employer withheld $2,100. What does the filer owe when the return is filed?',
            given: { withheld: 2100 }, expr: '#t2-p2 - withheld', format: 'usd', answer: '$2,044.00',
            reasoning: '$4,144.00 of tax against $2,100 already paid in. The gap exists because the employer withheld against the $34,000 it paid and knew nothing about the $9,600 on the 1099.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which document tells an employer how much income tax to withhold from a paycheck?',
            choices: ['The W-2', 'The W-4', 'The 1099', 'The 1040'],
            answer: 'The W-4',
            reasoning: 'The W-4 is completed by the worker and instructs the employer’s withholding going forward. The W-2 reports afterwards what was paid and withheld, the 1099 reports non-employee payments, and the 1040 is the return that reconciles everything at the end of the year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The filer did nothing wrong and still owes $2,044.00 at filing. Explain how that happens, and describe two different things the filer could have done during the year to avoid being surprised by it.',
            acceptableAnswerCriteria: [
              'Explains that withholding is set per employer against that employer’s payments, so income reported on a 1099 has nothing withheld and the shortfall only appears when the 1040 combines both.',
              'Gives two distinct actions — adjusting the W-4 so the employer withholds more, or setting money aside from each 1099 payment as it arrives — and connects each to the $2,044.00 figure.',
              'Notes that this is a timing and cash-planning problem rather than an extra tax: the same $4,144.00 was owed either way.',
            ],
            evidenceRequirements: [
              'Uses the $4,144.00 total tax, the $2,100 withheld, and the $2,044.00 owed.',
            ],
            dimensions: ['plan-coherence', 'error-diagnosis', 'transfer'],
            lookFors: [
              'The response distinguishes owing tax from owing a penalty; nothing here says the filer was penalised.',
              'The response recognises that the employer had no way to know about the 1099 income.',
            ],
            commonMisconception: 'Assuming that because tax is withheld from a paycheck, all tax for the year has been paid.',
          },
        ],
      },
    ],
    remediation: 'If the amount owed comes out as $4,144.00, the withholding has not been credited. The $2,100 the employer already sent in counts against the year’s tax. Subtract it from the total tax to get what is still due at filing.',
    extension: 'Work out how much larger the W-4 withholding would have needed to be, per month across 12 months, to leave nothing owing at filing.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l04',
    grade: 10, unit: 7, day: 4,
    actor: 'a fictional filer offered the same amount as a deduction, a nonrefundable credit, or a refundable credit',
    objective: 'Compute the value of an identical fictional amount delivered three different ways, and establish the rule that separates a deduction from a credit and a nonrefundable credit from a refundable one.',
    scenario: 'The simulated schedule and the three simulated tax provisions below are invented for this exercise. The same $2,800 is offered in three different forms so that the structures, not the amounts, are what differ.',
    materials: ['calculator', 'the fictional schedule and provisions in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional filer has a gross income of $31,500. The standard deduction is $11,200, and the rates are 10% on the first $9,800 of taxable income and 14% above that. Three provisions are available, each worth $2,800: an additional deduction, a nonrefundable credit, and a refundable credit. A deduction reduces taxable income. A credit reduces the tax owed dollar for dollar. A nonrefundable credit cannot reduce the tax below zero; a refundable one is paid out to the extent it exceeds the tax.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s taxable income before any of the three provisions?',
            given: { gross: 31500, stdDed: 11200 }, expr: 'gross - stdDed', format: 'usd', answer: '$20,300.00',
            reasoning: '$31,500 of gross less the $11,200 standard deduction.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax owed before any of the three provisions?',
            given: { b1: 9800, r1: 0.1, r2: 0.14 }, expr: 'b1 * r1 + (#t1-p1 - b1) * r2', format: 'usd', answer: '$2,450.00',
            reasoning: '10% of the first $9,800 is $980, and 14% of the remaining $10,500 of taxable income is $1,470. This is the figure the credits act on.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'With the $2,800 nonrefundable credit applied, what tax is owed?',
            given: { nonrefundable: 2800 }, expr: 'max(#t1-p2 - nonrefundable, 0)', format: 'usd', answer: '$0.00',
            reasoning: 'The $2,800 credit exceeds the $2,450.00 of tax, so the tax falls to zero and stops there. The credit could not reduce the liability below zero.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now value the other two provisions on the same filer.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'If the $2,800 credit were refundable instead, what would the filer receive back?',
            given: { refundable: 2800 }, expr: 'refundable - #t1-p2', format: 'usd', answer: '$350.00',
            reasoning: 'The $2,800 credit against $2,450.00 of tax. The excess is paid out rather than discarded, so the filer ends with $350.00 in hand and no tax owed.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the $2,800 does the nonrefundable version leave unused?',
            given: {}, expr: '#t2-p1 - #t1-p3', format: 'usd', answer: '$350.00',
            reasoning: 'The refundable version delivered $350.00 that the nonrefundable version did not, because there was only $2,450.00 of tax for it to erase. That unused portion is what "nonrefundable" costs this filer.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the $2,800 were an additional deduction rather than a credit, how much tax would it save?',
            given: { extraDeduction: 2800, r2b: 0.14 }, expr: 'extraDeduction * r2b', format: 'usd', answer: '$392.00',
            reasoning: 'The deduction removes $2,800 from taxable income, all of it from the band charged at 14%, so it saves 14% of $2,800. A deduction is worth the marginal rate times the amount, not the amount.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more is the refundable credit worth to this filer than the deduction?',
            given: { refundable2: 2800 }, expr: 'refundable2 - #t2-p3', format: 'usd', answer: '$2,408.00',
            reasoning: 'The refundable credit is worth its full $2,800 — $2,450.00 of tax erased plus $350.00 paid out — against $392.00 for the deduction. Identical face amounts, very different value.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Rank the three provisions by what they are worth to this filer, then explain how the ranking would change for a filer whose tax owed was $9,000 instead of $2,450.00. State the rule each provision follows in one sentence apiece.',
            acceptableAnswerCriteria: [
              'Ranks them correctly for this filer — refundable credit $2,800, nonrefundable credit $2,450.00, deduction $392.00 — and reports each value.',
              'Explains that with $9,000 of tax owed the two credits become equal in value at $2,800 each, because the nonrefundable one is no longer capped by too little tax, while the deduction stays worth the marginal rate times $2,800.',
              'States the three rules cleanly: a deduction reduces taxable income and is worth the marginal rate times its amount; a credit reduces tax dollar for dollar; refundability decides whether the unused part is paid out or lost.',
            ],
            evidenceRequirements: [
              'Uses the $2,450.00 tax before provisions, the $350.00 unused portion, and the $392.00 deduction value.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response notices that the ranking depends on how much tax the filer owes, which is what makes refundability matter most at low incomes.',
              'The response does not treat the deduction as worthless; $392.00 is a real saving, just a much smaller one.',
            ],
            commonMisconception: 'Reading a deduction and a credit of the same stated amount as being worth the same.',
          },
        ],
      },
    ],
    remediation: 'If the deduction looks like it saves $2,800, ask what it actually removes. It takes $2,800 out of taxable income, so the filer does not pay tax on that $2,800 — at a 14% marginal rate, that is $392.00 of tax not paid, not $2,800.',
    extension: 'Find the amount of tax owed at which the nonrefundable and refundable versions of this credit become worth exactly the same, and say which kind of filer that threshold protects.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l05',
    grade: 10, unit: 7, day: 5,
    actor: 'a fictional worker comparing the whole tax picture in two simulated states',
    objective: 'Total income, sales, and property taxes for the same fictional worker in two simulated states, and show that the state with no income tax is not automatically the cheaper one.',
    scenario: 'The two simulated states below are invented for this exercise, as are their rates and levies. Federal tax is identical in both and is left out of this comparison, since it does not affect which state is cheaper.',
    materials: ['calculator', 'the two fictional state tax schedules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional worker with a gross income of $47,000 makes $12,000 of taxable purchases in the simulated year. State P charges a flat 4.6% income tax on gross income, a 7.25% sales tax, and no separate annual levy. State Q charges no income tax, a 9% sales tax, and an annual levy of $1,340 on vehicles and property.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What income tax does the worker pay in State P?',
            given: { gross: 47000, pRate: 0.046 }, expr: 'gross * pRate', format: 'usd', answer: '$2,162.00',
            reasoning: '4.6% of the $47,000 gross. This fictional state charges a flat rate on gross with no deduction, which is a different structure from the federal schedule in this unit.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What sales tax does the worker pay in State P?',
            given: { purchases: 12000, pSales: 0.0725 }, expr: 'purchases * pSales', format: 'usd', answer: '$870.00',
            reasoning: '7.25% of the $12,000 of taxable purchases.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the worker pay in State P in total?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$3,032.00',
            reasoning: '$2,162.00 of income tax plus $870.00 of sales tax.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now total the same worker’s state and local taxes in State Q, which advertises that it has no income tax.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What sales tax does the worker pay in State Q?',
            given: { purchases2: 12000, qSales: 0.09 }, expr: 'purchases2 * qSales', format: 'usd', answer: '$1,080.00',
            reasoning: '9% of the same $12,000 of purchases — $210.00 more than State P charges on identical spending.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the worker pay in State Q in total, including the annual levy?',
            given: { qLevy: 1340 }, expr: '#t2-p1 + qLevy', format: 'usd', answer: '$2,420.00',
            reasoning: '$1,080.00 of sales tax plus the $1,340 annual levy. There is no income tax line, but there are two other lines.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much less does this worker pay in State Q?',
            given: {}, expr: '#t1-p3 - #t2-p2', format: 'usd', answer: '$612.00',
            reasoning: '$3,032.00 against $2,420.00. State Q is cheaper for this worker — but by $612.00, not by the whole $2,162.00 the missing income tax might suggest.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'What does State Q recover through, in place of an income tax?',
            choices: [
              'Nothing — its total tax is simply lower',
              'A higher sales tax and a separate annual levy',
              'A higher federal tax on its residents',
            ],
            answer: 'A higher sales tax and a separate annual levy',
            reasoning: 'State Q charges 9% on purchases against State P’s 7.25%, and adds a $1,340 annual levy that State P does not have. Federal tax is the same in both states and is not affected by where the worker lives in this comparison.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'State Q saved this particular worker $612.00. Describe a fictional worker for whom State P would be cheaper instead, and explain which feature of each schedule decides the answer.',
            acceptableAnswerCriteria: [
              'Describes a worker for whom State P wins — a lower income with high taxable spending, or someone facing the $1,340 levy with little income — and explains why from the structures.',
              'Identifies the deciding features: State P’s bill scales with income, while State Q’s scales with spending and carries a fixed levy that does not fall when income does.',
              'Notes that the $612.00 saving belongs to this worker’s particular combination of $47,000 of income and $12,000 of purchases, and is not a property of the two states.',
            ],
            evidenceRequirements: [
              'Uses both state totals and refers to the $1,340 levy or the difference between the two sales tax rates.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response reasons from which base each tax is charged on — income against spending — rather than from the rates alone.',
              'The response recognises that a fixed levy weighs most heavily on the lowest incomes.',
            ],
            commonMisconception: 'Reading "no income tax" as meaning a lower total tax burden.',
          },
        ],
      },
    ],
    remediation: 'If State Q looks $2,162.00 cheaper, only the missing income tax has been counted. State Q charges 9% on purchases where State P charges 7.25%, and adds a $1,340 annual levy. Total all the lines in each state before comparing; the real gap is $612.00.',
    extension: 'Find the level of annual taxable purchases at which the two states would cost this worker the same, and say whether that figure is above or below the $12,000 in the scenario.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l06',
    grade: 10, unit: 7, day: 6,
    actor: 'a fictional filer whose records are incomplete and whose return is filed late',
    objective: 'Price the tax cost of undocumented deductions and the cost of filing late under a stated fictional penalty schedule, and compare the two.',
    scenario: 'The simulated penalty and interest schedule below is invented for this exercise. It is shaped like the penalties real tax systems charge — a monthly percentage of the balance due, capped after a few months, plus separate interest — but its rates and cap are made up, and no real authority’s schedule should be inferred from it. The point being taught is how the pieces combine.',
    materials: ['calculator', 'the fictional record summary and penalty schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional filer had $1,850 of deductible expenses with receipts and a further $1,240 that were genuinely incurred but for which no record was kept. Only documented expenses can be deducted. The filer’s marginal rate is 14%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What were the filer’s deductible expenses in total, documented or not?',
            given: { documented: 1850, undocumented: 1240 }, expr: 'documented + undocumented', format: 'usd', answer: '$3,090.00',
            reasoning: '$1,850 with receipts plus $1,240 without. All of it was genuinely spent; only part of it can be proved.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What tax does the documented amount actually save at a 14% marginal rate?',
            given: { documented2: 1850, marginal: 0.14 }, expr: 'documented2 * marginal', format: 'usd', answer: '$259.00',
            reasoning: '14% of the $1,850 that can be substantiated. A deduction is worth the marginal rate times the amount, as the previous lesson established.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the full $3,090.00 have saved if all of it had been documented?',
            given: { marginal2: 0.14 }, expr: '#t1-p1 * marginal2', format: 'usd', answer: '$432.60',
            reasoning: '14% of the whole $3,090.00 of real expenses.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the missing records and the late filing. Under the fictional schedule, a late return carries a penalty of 5% of the balance due for each month it is late, up to 5 months, plus interest of 0.6% of the balance due per month over the same period. This filer’s balance due is $1,900 and the return is filed 5 months late.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What did the missing records cost in extra tax?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$173.60',
            reasoning: '$432.60 that full records would have saved against the $259.00 the receipts actually delivered. The money was genuinely spent; the deduction was lost for want of proof.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the late-filing penalty?',
            given: { balanceDue: 1900, penaltyRate: 0.05, lateMonths: 5 }, expr: 'balanceDue * penaltyRate * lateMonths', format: 'usd', answer: '$475.00',
            reasoning: '5% of the $1,900 balance for each of 5 months. The penalty is charged on the balance due, so a filer who owes nothing has much less at stake in being late.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the interest charged over the same period?',
            given: { balanceDue2: 1900, interestRate: 0.006, lateMonths2: 5 }, expr: 'balanceDue2 * interestRate * lateMonths2', format: 'usd', answer: '$57.00',
            reasoning: '0.6% of the $1,900 balance for each of 5 months. Interest is much smaller than the penalty here, which is worth noticing: the cost of being late is mostly the penalty.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What did poor recordkeeping and late filing cost the filer altogether?',
            given: {}, expr: '#t2-p1 + #t2-p2 + #t2-p3', format: 'usd', answer: '$705.60',
            reasoning: '$173.60 of lost deduction plus $475.00 of penalty plus $57.00 of interest. None of this reflects any additional income or spending — it is entirely the cost of how the year was documented and when the return was filed.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Of the $705.60, decide which part was cheapest to have avoided and defend your answer. Then write three recordkeeping habits that would address the larger of the two problems, and say when in the year each one has to happen.',
            acceptableAnswerCriteria: [
              'Compares the $173.60 from missing records against the $532.00 from filing late, and defends which was cheaper to avoid rather than asserting it.',
              'Gives three concrete habits with timing — filing on time or requesting an extension by the deadline, keeping receipts as expenses occur rather than reconstructing them, and setting money aside for a known balance due during the year.',
              'Notes that the penalty is charged on the balance due, so reducing what is owed at filing reduces the exposure to being late as well.',
            ],
            evidenceRequirements: [
              'Uses the $173.60, $475.00, and $57.00 components and the $705.60 total.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response ties each habit to a point in the year rather than listing intentions.',
              'A response arguing either way on which was cheaper to avoid is defensible if it compares the two amounts explicitly.',
            ],
            commonMisconception: 'Treating recordkeeping as a filing-season task rather than something that has to happen as expenses occur.',
          },
        ],
      },
    ],
    remediation: 'If the cost of the missing records comes out as $1,240, the expense is being confused with the tax it would have saved. The filer does not get the $1,240 back — a deduction only removes that amount from taxed income, which at a 14% marginal rate is worth $173.60.',
    extension: 'Recompute the penalty and interest if the filer had paid the $1,900 balance on time but filed the return 5 months late anyway, and say which of the two obligations the schedule prices more heavily.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l07',
    grade: 10, unit: 7, day: 7,
    actor: 'a fictional worker who turned down a raise for the wrong reason',
    objective: 'Test the claim that entering a higher bracket reduces take-home pay by computing the tax before and after a fictional raise, and isolate the amount actually charged at the higher rate.',
    scenario: 'The simulated raise below is invented for this exercise, and the schedule is the same fictional one used throughout this unit. The claim being tested is a real and common misunderstanding, stated here by a fictional worker.',
    materials: ['calculator', 'the fictional schedule and raise in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional worker earning $52,500 is offered a raise to $54,500 and says: "That pushes me into the 24% bracket, so I would take home less. I should turn it down." The standard deduction is $11,200. The rates are 10% on the first $9,800 of taxable income, 14% from $9,800 to $42,000, and 24% above $42,000. Compute both years.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the worker’s taxable income before the raise?',
            given: { grossBefore: 52500, stdDed: 11200 }, expr: 'grossBefore - stdDed', format: 'usd', answer: '$41,300.00',
            reasoning: '$52,500 of gross less the $11,200 standard deduction. This is below the $42,000 threshold, so the top bracket is not reached.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the tax before the raise?',
            given: { b1: 9800, r1: 0.1, r2: 0.14 }, expr: 'b1 * r1 + (#t1-p1 - b1) * r2', format: 'usd', answer: '$5,390.00',
            reasoning: '$980 on the first bracket plus 14% of the remaining $31,500 of taxable income. Only two brackets are used.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the worker’s taxable income after the raise?',
            given: { grossAfter: 54500, stdDed2: 11200 }, expr: 'grossAfter - stdDed2', format: 'usd', answer: '$43,300.00',
            reasoning: '$54,500 of gross less the same $11,200 deduction. This does cross the $42,000 threshold, so the worker is right that the top bracket is now in play.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compute the tax after the raise and settle the claim.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the tax after the raise?',
            given: { b1b: 9800, b2: 42000, r1b: 0.1, r2b: 0.14, r3: 0.24 },
            expr: 'b1b * r1b + (b2 - b1b) * r2b + (#t1-p3 - b2) * r3', format: 'usd', answer: '$5,800.00',
            reasoning: '$980 on the first bracket, $4,508 on the second, and 24% of the $1,300 of taxable income above $42,000. The first two bracket amounts are unchanged from before the raise.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more tax does the raise cost?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$410.00',
            reasoning: '$5,800.00 against $5,390.00. The extra tax is charged only on the additional income, not on the income the worker already had.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Of the $2,000 raise, how much does the worker keep?',
            given: { raise: 2000 }, expr: 'raise - #t2-p2', format: 'usd', answer: '$1,590.00',
            reasoning: '$2,000 of extra gross less $410.00 of extra tax. The worker is $1,590.00 better off, so the claim that the raise reduces take-home pay is false.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the worker’s taxable income is actually charged at 24%?',
            given: { b2b: 42000 }, expr: '#t1-p3 - b2b', format: 'usd', answer: '$1,300.00',
            reasoning: '$43,300.00 of taxable income less the $42,000 threshold. Entering a bracket means the income above the threshold is charged at that rate, not the whole income.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain in your own words exactly where the worker’s reasoning goes wrong, and write the one sentence you would say to correct it. Then describe what would have to be true of a tax system for the worker’s fear to be justified.',
            acceptableAnswerCriteria: [
              'Locates the error precisely: the worker treats a bracket rate as applying to all income once the threshold is crossed, when it applies only to the $1,300.00 above the threshold.',
              'Gives a correcting sentence that would generalise — a higher bracket taxes only the income above its threshold, so more gross income always leaves more after tax under this schedule.',
              'Describes what would justify the fear: a system where crossing a threshold changed the rate on all income at once, or where a benefit was withdrawn abruptly at a specific income.',
            ],
            evidenceRequirements: [
              'Uses the $410.00 of extra tax, the $1,590.00 kept, and the $1,300.00 taxed at the top rate.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response notes that the worker was right that the bracket was entered and wrong about what that means.',
              'The response identifies abrupt benefit withdrawal as a real case where extra income can leave someone worse off, without claiming it happens under this schedule.',
            ],
            commonMisconception: 'Believing that crossing into a higher bracket re-taxes all previously earned income at the higher rate.',
          },
        ],
      },
    ],
    remediation: 'If the raise looks like it costs more than it pays, compare the two bracket calculations line by line. The first bracket charges $980 in both years. The second charges $4,410 before the raise, because taxable income stops at $41,300.00, and $4,508 after, because taxable income now runs past $42,000 and fills the band. That $98 plus 24% of the $1,300.00 above the threshold is the whole extra tax, $410.00 — against $2,000 of extra gross.',
    extension: 'Determine whether any raise from $52,500 could leave the worker keeping only half of it under this schedule, and say what the top rate implies about the smallest share of a raise a worker can keep.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l08',
    grade: 10, unit: 7, day: 8,
    actor: 'a fictional person offered the same work as an employee or as a contractor',
    objective: 'Apply the payroll schedule to employee and self-employment income at the same earnings, and compute the contractor rate that would leave the person equally well off.',
    scenario: 'The simulated offers below are invented for this exercise. Under this fictional system an employee pays a 7.5% share of payroll tax and the employer pays a matching share, while a self-employed person pays both, 15% in total. Income tax is identical under both arrangements and is set aside so the comparison isolates the payroll treatment.',
    materials: ['calculator', 'the two fictional work arrangements in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional person is offered the same work two ways, both paying $46,000 for the simulated year. As an employee they pay the 7.5% employee share of payroll tax and the employer pays the other half. As a self-employed contractor they pay both shares, 15% in total.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What payroll tax does the employee pay?',
            given: { earnings: 46000, employeeShare: 0.075 }, expr: 'earnings * employeeShare', format: 'usd', answer: '$3,450.00',
            reasoning: '7.5% of $46,000. The employer pays a matching $3,450.00 that never appears on the worker’s pay stub.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What payroll tax does the contractor pay on the same $46,000?',
            given: { earnings2: 46000, bothShares: 0.15 }, expr: 'earnings2 * bothShares', format: 'usd', answer: '$6,900.00',
            reasoning: '15% of $46,000, because a self-employed person is treated as both the employer and the employee under this fictional system.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more payroll tax does the contractor pay?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$3,450.00',
            reasoning: '$6,900.00 against $3,450.00. The difference is exactly the employer share, which the contractor has nobody to pay on their behalf.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find the contractor rate that would leave the person level on payroll tax alone. This comparison holds income tax aside, and at the higher contractor pay the income tax would not in fact be identical, so the figure below is a floor on what the rate would have to be rather than a full equalisation.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the employee have left after payroll tax?',
            given: { earnings3: 46000 }, expr: 'earnings3 - #t1-p1', format: 'usd', answer: '$42,550.00',
            reasoning: '$46,000 less the $3,450.00 employee share. This is the figure the contractor arrangement has to match.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would the contractor have to be paid to keep the same amount after their 15% payroll tax? Round to the nearest cent.',
            given: { bothShares2: 0.15 }, expr: 'round(#t2-p1 / (1 - bothShares2), 2)', format: 'usd', answer: '$50,058.82',
            reasoning: 'The amount that, after 15% is removed, leaves $42,550.00. Dividing by 0.85 is the right operation here; adding 15% to $42,550.00 would not be, because the tax is charged on the larger figure.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more than the employee offer is that?',
            given: { earnings4: 46000 }, expr: '#t2-p2 - earnings4', format: 'usd', answer: '$4,058.82',
            reasoning: '$50,058.82 against the $46,000 offered. Note this is more than the $3,450.00 extra tax, because the additional pay is itself taxed.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What percentage increase over the employee offer does that represent?',
            given: { earnings5: 46000 }, expr: '#t2-p3 / earnings5 * 100', format: 'percent2', answer: '8.82%',
            reasoning: '$4,058.82 against $46,000. A contractor rate has to be meaningfully above an equivalent employee wage before the two arrangements are level on payroll tax alone.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why $4,058.82 rather than $3,450.00 is the right uplift, then name two things besides payroll tax that a fictional person should price before accepting contractor work at the same headline rate.',
            acceptableAnswerCriteria: [
              'Explains that the extra pay is itself subject to the 15% levy, so covering a $3,450.00 gap requires more than $3,450.00 of additional income — dividing by 0.85 rather than adding 15%.',
              'Names two concrete items a contractor bears that an employee may not — for example health coverage, paid time off, unemployment protection, retirement contributions, equipment, or the cost of gaps between engagements.',
              'Notes that the comparison here holds income tax equal and covers only payroll treatment, so the true uplift needed is larger than 8.82%.',
            ],
            evidenceRequirements: [
              'Uses the $3,450.00 payroll gap, the $50,058.82 equalising rate, and the 8.82% uplift.',
            ],
            dimensions: ['transfer', 'tradeoff-defense', 'assumption-identification'],
            lookFors: [
              'The response identifies the circularity — taxing the raise that covers the tax — as the reason the two figures differ.',
              'The response does not present contractor work as worse; it prices what has to be recovered for the two to be comparable.',
            ],
            commonMisconception: 'Equalising two offers by adding the tax difference to the lower one, when the addition is itself taxed.',
          },
        ],
      },
    ],
    remediation: 'If the equalising rate comes out as $49,450, the $3,450.00 gap has simply been added to $46,000. That amount is itself taxed at 15%, so it does not close the gap. Find the figure that leaves $42,550.00 after 15% is taken: divide by 0.85, which gives $50,058.82.',
    extension: 'Work out the equalising contractor rate if the person also had to buy health coverage costing $3,600 a year that an employer would otherwise have provided, and say how much the total uplift becomes.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l09',
    grade: 10, unit: 7, day: 9,
    actor: 'a fictional filer reconciling a full year across wages, side income, and withholding',
    objective: 'Reconcile a fictional filer’s whole year — combining wage and self-employment income, applying the deduction and brackets, adding self-employment payroll tax, and crediting withholding — to a single balance due.',
    scenario: 'The simulated year below is invented for this exercise. It brings together the income tax schedule, the self-employment payroll treatment, and the withholding mechanics used earlier in this unit, all of which are fictional.',
    materials: ['calculator', 'the fictional year-end figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional filer’s W-2 reports $41,000 of wages with $3,250 of federal income tax withheld. A 1099 reports $6,500 of self-employment income with nothing withheld. The standard deduction is $11,200; the rates are 10% on the first $9,800 of taxable income and 14% from $9,800 to $42,000. Self-employment income also carries payroll tax at 15%, covering both the employee and employer shares. Payroll tax already withheld on the wages is handled by the employer and is not part of this reconciliation.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s total income for the year?',
            given: { w2: 41000, se: 6500 }, expr: 'w2 + se', format: 'usd', answer: '$47,500.00',
            reasoning: '$41,000 of wages plus $6,500 of self-employment income.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s taxable income?',
            given: { stdDed: 11200 }, expr: '#t1-p1 - stdDed', format: 'usd', answer: '$36,300.00',
            reasoning: 'The $47,500.00 of total income less the $11,200 standard deduction, applied once to the combined figure.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the income tax on that taxable income?',
            given: { b1: 9800, r1: 0.1, r2: 0.14 }, expr: 'b1 * r1 + (#t1-p2 - b1) * r2', format: 'usd', answer: '$4,690.00',
            reasoning: '$980 on the first $9,800 plus 14% of the remaining $26,500 of taxable income. The $42,000 threshold is not reached, so the top bracket is unused.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now add the self-employment payroll tax and credit what was already withheld.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What payroll tax is owed on the self-employment income?',
            given: { se2: 6500, bothShares: 0.15 }, expr: 'se2 * bothShares', format: 'usd', answer: '$975.00',
            reasoning: '15% of the $6,500 of self-employment income, covering both shares. Note this is charged on the $6,500 itself, with no standard deduction — the deduction applies to income tax only.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the filer owe in total for the year?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$5,665.00',
            reasoning: '$4,690.00 of income tax plus $975.00 of self-employment payroll tax.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'After crediting the $3,250 already withheld, what is the balance due at filing?',
            given: { withheld: 3250 }, expr: '#t2-p2 - withheld', format: 'usd', answer: '$2,415.00',
            reasoning: '$5,665.00 owed against $3,250 paid in through withholding on the wages. The $6,500 of side income generated both income tax and payroll tax and had nothing withheld against either.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which figure did the $6,500 of self-employment income affect that the same amount of extra W-2 wages would not have?',
            choices: [
              'The standard deduction',
              'The amount of payroll tax the filer personally owes',
              'The bracket thresholds',
            ],
            answer: 'The amount of payroll tax the filer personally owes',
            reasoning: 'The deduction and the thresholds are the same whatever form the income takes. What changes is that the filer personally owes both payroll shares on self-employment income, $975.00 here, where an employer would have paid half on wages.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Work out what fraction of every dollar of the $6,500 side income this filer keeps, and use it to write one sentence of guidance about setting money aside from side income. Explain why the fraction is smaller than the 14% bracket rate alone would suggest.',
            acceptableAnswerCriteria: [
              'Computes the combined burden on the side income correctly — 14% income tax plus 15% payroll tax, so 29 cents of every dollar — and states the fraction kept as about 71 cents.',
              'Gives guidance tied to that figure: set aside close to 30% of each side payment as it arrives, rather than the 14% the bracket alone suggests.',
              'Explains that the payroll tax is charged on the side income itself with no deduction, so it stacks on top of the income tax rather than replacing part of it.',
            ],
            evidenceRequirements: [
              'Uses the $975.00 of payroll tax and the $2,415.00 balance due.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'transfer'],
            lookFors: [
              'The response adds the two taxes rather than treating the bracket rate as the whole burden.',
              'The response translates the figure into an action with a percentage attached.',
            ],
            commonMisconception: 'Setting aside only the income tax bracket rate from side income, and being caught by the payroll tax that also applies to it.',
          },
        ],
      },
    ],
    remediation: 'If the balance due comes out as $1,440.00, the self-employment payroll tax has been left out. The $6,500 of side income owes 15% payroll tax on top of the income tax it generated. Add the $975.00 to the $4,690.00 before crediting the $3,250 withheld.',
    extension: 'Work out what the balance due would have been if the same $6,500 had been paid as W-2 wages by a second employer withholding nothing, and say which of the two arrangements leaves a larger surprise at filing.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l10',
    grade: 10, unit: 7, day: 10,
    actor: 'a fictional filer preparing a complete annual tax estimate and filing-readiness check',
    objective: 'Produce a complete fictional annual tax estimate — brackets, a credit, and payroll tax — check it against withholding, and report the effective federal rate on gross income.',
    scenario: 'The simulated filer and figures below are invented for this exercise, as is the credit. This is a simplified annual estimate using the fictional schedule from this unit, not a return, and it is not tax advice.',
    materials: ['calculator', 'the fictional annual figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional filer earns $63,400 in wages for the simulated year, with $5,900 of federal income tax withheld. The standard deduction is $11,200. Rates on taxable income are 10% on the first $9,800, 14% from $9,800 to $42,000, and 24% above $42,000. The filer qualifies for a $1,500 nonrefundable credit. Payroll tax is 6% social insurance on wages up to the $158,000 cap plus a 1.5% health levy on all wages.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s taxable income?',
            given: { gross: 63400, stdDed: 11200 }, expr: 'gross - stdDed', format: 'usd', answer: '$52,200.00',
            reasoning: '$63,400 of wages less the $11,200 standard deduction. The brackets below apply to this figure only.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the income tax before the credit?',
            given: { b1: 9800, b2: 42000, r1: 0.1, r2: 0.14, r3: 0.24 },
            expr: 'b1 * r1 + (b2 - b1) * r2 + (#t1-p1 - b2) * r3', format: 'usd', answer: '$7,936.00',
            reasoning: '$980 on the first bracket, $4,508 on the second, and 24% of the $10,200 of taxable income above $42,000.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the income tax after the $1,500 nonrefundable credit?',
            given: { credit: 1500 }, expr: 'max(#t1-p2 - credit, 0)', format: 'usd', answer: '$6,436.00',
            reasoning: 'The credit reduces the tax dollar for dollar. There is far more than $1,500 of tax here, so the whole credit is used and none of it is wasted.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now add payroll tax, check the withholding, and state the whole year as one rate.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What payroll tax is charged on the wages?',
            given: { gross2: 63400, socRate: 0.06, healthRate: 0.015 }, expr: 'gross2 * socRate + gross2 * healthRate', format: 'usd', answer: '$4,755.00',
            reasoning: '6% plus 1.5% of $63,400, which is below the $158,000 cap so the whole amount is subject to both levies. No deduction and no credit applies to payroll tax.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the filer’s total federal tax for the year?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$11,191.00',
            reasoning: '$6,436.00 of income tax after the credit plus $4,755.00 of payroll tax. The payroll tax is more than two fifths of the total and receives none of the deduction or credit.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'The $5,900 withheld covered income tax only. What is the balance due or refund on the income tax?',
            given: { withheld: 5900 }, expr: '#t1-p3 - withheld', format: 'usd', answer: '$536.00',
            reasoning: '$6,436.00 of income tax against $5,900 withheld, leaving $536.00 owing. A positive figure here is a balance due; a negative one would have been a refund.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What is the effective federal rate on gross income, counting both taxes?',
            given: { gross3: 63400 }, expr: '#t2-p2 / gross3 * 100', format: 'percent2', answer: '17.65%',
            reasoning: '$11,191.00 against $63,400 of gross wages. This is well above the 10.15% the income tax alone would give, and well below the 24% marginal bracket rate.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write a four-sentence year-end summary for this fictional filer: what was owed, what was already paid, what is still due, and what share of gross income the whole federal burden came to. Then name the one change to the W-4 you would recommend and say what it would and would not fix.',
            acceptableAnswerCriteria: [
              'Reports the year accurately: $11,191.00 of total federal tax, $5,900 withheld against income tax, $536.00 still due, and a 17.65% effective rate on gross income.',
              'Recommends increasing W-4 withholding by roughly $45 a month, or an equivalent per-paycheck amount, and ties it to closing the $536.00 gap.',
              'States what the change would not fix: the $4,755.00 of payroll tax is withheld separately and is not affected by the W-4, and the total owed does not change — only its timing does.',
              'Notes that the credit was fully used here, so nothing was lost to nonrefundability.',
            ],
            evidenceRequirements: [
              'Uses the $11,191.00 total, the $536.00 balance due, and the 17.65% effective rate.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes changing what is owed from changing when it is paid.',
              'The response recognises that payroll tax is a large part of the burden and is untouched by the deduction, the credit, and the W-4.',
            ],
            commonMisconception: 'Treating the income tax on a return as the whole of what a worker pays in federal tax.',
          },
        ],
      },
    ],
    remediation: 'If the total comes out as $6,436.00, only the income tax has been counted. Payroll tax of $4,755.00 is charged on the same wages, receives no standard deduction, and is not reduced by the credit. Add both before computing the effective rate.',
    extension: 'Recompute the effective federal rate on gross income for a fictional filer earning $31,700 under the same schedule and credit, and say which of the two taxes accounts for more of their burden.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u07-l11',
    grade: 10, unit: 7, day: 11,
    actor: 'two fictional households facing the same two state tax systems from different positions',
    objective: 'Test one claim about two simulated states against two fictional households that differ in income and in whether they own, and identify who a fixed annual levy actually falls on.',
    scenario: 'The two simulated states below are invented for this exercise. This lesson asks who a tax falls on rather than which state is cheaper, because the same pair of systems can favour one household and penalise another.',
    materials: ['calculator', 'the two fictional state tax schedules and the two household profiles in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'State R charges a 3.2% state income tax and a 1.4% local income tax, both on gross income, plus a 6.5% sales tax. State S charges no income tax at any level and an 8.75% sales tax, plus an annual property levy of $2,180 that is charged only to households that own the home they live in. Household A owns its home, has a gross income of $32,000, and makes $10,000 of taxable purchases a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Household A pay in State R in income tax, state and local combined?',
            given: { grossA: 32000, rState: 0.032, rLocal: 0.014 }, expr: 'grossA * rState + grossA * rLocal', format: 'usd', answer: '$1,472.00',
            reasoning: '3.2% plus 1.4% of the $32,000 gross. Both rates are charged on the same base, and the local line is easy to miss when only the state rate is quoted.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Household A pay in State R in total?',
            given: { purchasesA: 10000, rSales: 0.065 }, expr: '#t1-p1 + purchasesA * rSales', format: 'usd', answer: '$2,122.00',
            reasoning: 'The $1,472.00 of income taxes plus 6.5% of the $10,000 of taxable purchases.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Household A pay in State S in total?',
            given: { purchasesA2: 10000, sSales: 0.0875, sLevy: 2180 }, expr: 'purchasesA2 * sSales + sLevy', format: 'usd', answer: '$3,055.00',
            reasoning: '8.75% of the $10,000 of purchases plus the $2,180 levy, which this household pays because it owns its home. There is no income tax line, and the total is still the larger of the two.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Household B rents, so the property levy does not reach it. It has a gross income of $55,000 and makes $14,000 of taxable purchases a year. Work out the same two totals for Household B, then measure the levy against Household A’s income.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does State S cost Household A than State R does?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$933.00',
            reasoning: '$3,055.00 against $2,122.00. For this household the state with no income tax is the more expensive one, and the levy is why.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Household B pay in State R in total?',
            given: { grossB: 55000, rState2: 0.032, rLocal2: 0.014, purchasesB: 14000, rSales2: 0.065 },
            expr: 'grossB * rState2 + grossB * rLocal2 + purchasesB * rSales2', format: 'usd', answer: '$3,440.00',
            reasoning: '4.6% of the $55,000 gross across the two income taxes, plus 6.5% of the $14,000 of purchases. A higher income means a larger income-tax bill.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Household B pay in State S in total?',
            given: { purchasesB2: 14000, sSales2: 0.0875 }, expr: 'purchasesB2 * sSales2', format: 'usd', answer: '$1,225.00',
            reasoning: '8.75% of the $14,000 of purchases and nothing else. This household rents, so the $2,180 levy does not apply to it at all.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much less does State S cost Household B than State R does?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$2,215.00',
            reasoning: '$3,440.00 against $1,225.00. The same pair of states that cost Household A $933.00 more saves Household B $2,215.00.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'The $2,180 levy is what percentage of Household A’s gross income?',
            given: { sLevy2: 2180, grossA2: 32000 }, expr: 'sLevy2 / grossA2 * 100', format: 'percent2', answer: '6.81%',
            reasoning: 'The levy against the $32,000 income it is charged alongside. It is a fixed amount, so it does not fall when income does — which is what makes it weigh most on the households with the least.',
          },
          {
            ref: 't2-p6', kind: 'choice',
            text: 'For which household is the claim "State S is the cheaper state" true?',
            choices: ['For Household A only', 'For Household B only', 'For both households', 'For neither household'],
            given: {},
            decision: { left: '#t1-p3', cmp: '>', right: '#t1-p2', ifTrue: 'For Household B only', ifFalse: 'For both households' },
            answer: 'For Household B only',
            reasoning: 'State S costs Household A $3,055.00 against $2,122.00, so the claim is false for them, while it saves Household B $2,215.00. A claim about a state is not a claim anyone can verify without knowing whose bill is being described.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fictional advertisement says "Move to State S and stop paying income tax." Say for whom that advice would have worked and for whom it would have backfired, explain which feature of State S produces the split, and state what makes a fixed annual charge fall differently from a percentage one.',
            acceptableAnswerCriteria: [
              'Reports both outcomes accurately: State S costs Household A $933.00 more and saves Household B $2,215.00, so the advertisement is false for one household and true for the other.',
              'Identifies the $2,180 property levy as the feature producing the split, and notes that it reaches Household A only because that household owns its home, while Household B rents.',
              'Explains the incidence point: a fixed charge takes the same dollars from every household it touches, so it is 6.81% of Household A’s income and a smaller share of a larger one, while a percentage income tax scales with what a household earns.',
              'Notes that the advertisement is not false about the income tax — State S genuinely has none — and that what it omits is what replaces it and who pays that instead.',
            ],
            evidenceRequirements: [
              'Uses the $933.00 and $2,215.00 differences and the 6.81% share of Household A’s income.',
            ],
            dimensions: ['assumption-identification', 'tradeoff-defense', 'evidence-use', 'communication-of-uncertainty'],
            lookFors: [
              'The response reasons about who a tax reaches, not only about how large the rates are.',
              'The response recognises that the two households differ in two ways at once — income and owning versus renting — and does not attribute the whole split to income alone.',
            ],
            commonMisconception: 'Reading a tax as cheap or expensive in itself, rather than asking which households it actually reaches.',
          },
        ],
      },
    ],
    remediation: 'If State S looks cheaper for both households, check which one the $2,180 levy reaches. It is charged only on a home the household owns, so it lands on Household A and not on Household B. Add it to Household A’s State S bill and the ranking for that household turns over: $3,055.00 against $2,122.00.',
    extension: 'Work out what Household A’s gross income would have to be for State S to become the cheaper option for them while they still own their home, and say what that figure shows about which households a fixed levy is hardest on.',
  },
]
