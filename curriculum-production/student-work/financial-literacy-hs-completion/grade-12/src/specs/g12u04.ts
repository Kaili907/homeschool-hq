import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 4 — PF4 Using Credit: Financing Adult Life and Postsecondary
 * Costs.
 *
 * The senior move is that borrowing is decided before shopping rather than
 * after. A ceiling is derived from expected income, packages are compared on
 * what has to be borrowed rather than on sticker price, and repayment is
 * projected against more than one career outcome. Every fictional schedule,
 * rate, and payment factor in this unit is invented and labelled as such, and
 * the payment factors are supplied so that a monthly payment can be obtained
 * without an amortisation formula the course has not taught.
 *
 * Nothing in this unit advises any real person about borrowing. Every case is
 * fictional and every conclusion is about the fictional case.
 */
export const g12u04: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u04-l01',
    grade: 12, unit: 4, day: 1,
    actor: 'a fictional applicant working through a simulated aid workflow',
    objective: 'Work a simulated aid offer from cost of attendance through to the amount still unmet, and distinguish aid that is given from aid that must be earned or repaid.',
    scenario: 'The simulated cost figures and aid offer below belong to a fictional applicant at a fictional institution. No real award letter, institution, or applicant is described, and no personal information is requested anywhere in this lesson.',
    materials: ['calculator', 'the fictional cost and award figures in these directions'],
    domains: ['postsecondary-financing', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional institution states a cost of attendance made up of tuition and fees $11,400, housing and food $9,800, books and supplies $1,150, transport $900, and personal costs $1,250. The simulated aid workflow produces a contribution figure of $4,200 for this applicant. The award offers two grants, of $6,500 and $2,000, and a work-study opportunity worth $2,400.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of attendance for the year?',
            given: { tuition: 11400, housing: 9800, books: 1150, transport: 900, personal: 1250 },
            expr: 'tuition + housing + books + transport + personal', format: 'usd', answer: '$24,500.00',
            reasoning: 'All five components added. Tuition alone is $11,400, which is less than half the figure the year actually costs — the reason cost of attendance is defined to include the rest.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the applicant’s calculated need under this simulated workflow?',
            given: { contribution: 4200 }, expr: '#t1-p1 - contribution', format: 'usd', answer: '$20,300.00',
            reasoning: 'Cost of attendance less the $4,200 contribution figure the workflow produced. Need is defined by the workflow’s own arithmetic, not by what the applicant feels able to pay.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total of the two grants?',
            given: { grant1: 6500, grant2: 2000 }, expr: 'grant1 + grant2', format: 'usd', answer: '$8,500.00',
            reasoning: 'The two grants added. Grants are the only part of this offer that is neither earned by working nor repaid later.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now work the offer through to what is actually left unmet.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What need remains after the grants are applied?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$11,800.00',
            reasoning: '$20,300.00 of need less $8,500.00 of grants.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What remains after the work-study opportunity is also counted?',
            given: { workStudy: 2400 }, expr: '#t2-p1 - workStudy', format: 'usd', answer: '$9,400.00',
            reasoning: '$11,800.00 less the $2,400 work-study figure. Counting work-study here assumes the hours are actually available and actually worked, which the award does not guarantee.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the cost of attendance do the grants cover, to two decimal places?',
            given: {}, expr: 'round(#t1-p3 / #t1-p1 * 100, 2)', format: 'percent2', answer: '34.69%',
            reasoning: '$8,500.00 measured against the $24,500.00 cost. Expressed this way, an award that looks substantial in dollars can be seen against the whole cost it has to meet.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Is the $2,400 of work-study the same kind of aid as the $6,500 grant?',
            choices: ['Yes — both reduce what the applicant must find', 'No — work-study must be earned by working hours that may not materialise'],
            answer: 'No — work-study must be earned by working hours that may not materialise',
            reasoning: 'A grant reduces the bill outright, while work-study is an opportunity to earn money by working a job that must exist, be obtained, and be worked around study. The offer states it as an opportunity, so treating it as certain is a reading the document does not support.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This award covers a substantial part of the cost and still leaves $9,400.00 unmet. Sort the three parts of the offer by how reliable each is, justify the ordering with the figures, and say what the fictional applicant should establish about the work-study before counting on it.',
            acceptableAnswerCriteria: [
              'Orders the three correctly with reasons: the $8,500.00 of grants is the most reliable because it reduces the bill directly, work-study at $2,400 is least reliable because it depends on hours actually being worked, and any borrowing is certain money now against a repayment obligation later.',
              'Uses the arithmetic to show what is at stake: if the work-study does not materialise the gap is $11,800.00 rather than $9,400.00, a difference of $2,400.',
              'Names what to establish about work-study — whether a position is guaranteed, how many hours a week it requires, and whether those hours are compatible with the course load.',
            ],
            evidenceRequirements: [
              'Uses the $9,400.00 remaining gap and the $8,500.00 grant total, and states what the gap becomes if work-study is excluded.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response treats an award letter as a set of different instruments rather than one number.',
              'The response does not describe borrowing as aid, while also not describing it as a failure of the offer.',
            ],
            commonMisconception: 'Adding every line of an aid offer into a single total, so money that must be earned or repaid is counted as though it reduced the cost in the same way a grant does.',
          },
        ],
      },
    ],
    remediation: 'If the unmet amount comes out at $16,000.00, the calculation has started from tuition of $11,400 rather than from the full cost of attendance. Books, transport, housing and food, and personal costs are all part of what the year costs, and the workflow computes need against the whole $24,500.00.',
    extension: 'Recompute the unmet amount for a fictional applicant whose contribution figure is $1,500 instead, and say which single line in the calculation moves and by how much.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l02',
    grade: 12, unit: 4, day: 2,
    actor: 'a fictional student setting a borrowing ceiling before looking at any programme',
    objective: 'Derive a borrowing ceiling for a fictional student from expected earnings and a payment share rule, and compare it with a ceiling set by a rule of thumb.',
    scenario: 'The fictional expected earnings, the invented payment factor table, and the simulated rules below exist only for this exercise. Nothing here sets a borrowing limit for any real person.',
    materials: ['calculator', 'the fictional earnings figure and payment factor in these directions'],
    domains: ['postsecondary-financing', 'debt', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional student expects to start work at $41,600 a year in the field they intend to enter. They adopt a rule that the loan payment should take no more than 10% of expected monthly gross pay. Under the fictional payment factor table, a loan repaid over ten years at the rate offered costs $10.60 a month for every $1,000 borrowed.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is expected monthly gross pay?',
            given: { salary: 41600 }, expr: 'round(salary / 12, 2)', format: 'usd', answer: '$3,466.67',
            reasoning: '$41,600 across the 12 months of a year. The rule is written against gross rather than take-home pay, so gross is the base used here.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What monthly payment does the 10% rule allow?',
            given: { shareCap: 0.10 }, expr: 'round(#t1-p1 * shareCap, 2)', format: 'usd', answer: '$346.67',
            reasoning: '10% of the $3,466.67 monthly gross. This is the constraint the borrowing amount has to be derived from, rather than the other way round.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Using the payment factor, what total borrowing does that payment support?',
            given: { factor: 10.60 }, expr: 'round(#t1-p2 / factor * 1000, 2)', format: 'usd', answer: '$32,704.72',
            reasoning: 'Each $1,000 borrowed costs $10.60 a month, so a $346.67 payment supports $346.67 divided by $10.60, in thousands. Working from the affordable payment back to a balance is what makes the ceiling a number the student can shop against.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare that ceiling with a common rule of thumb.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'A widely repeated rule says total borrowing should not exceed one year of expected starting pay, which here is $41,600. Which of the two rules binds — that is, which produces the lower ceiling?',
            choices: ['The one-year-of-pay rule, at $41,600', 'The payment share rule, at $32,704.72'],
            given: { salaryRule: 41600 },
            decision: { left: '#t1-p3', cmp: '<', right: 'salaryRule', ifTrue: 'The payment share rule, at $32,704.72', ifFalse: 'The one-year-of-pay rule, at $41,600' },
            answer: 'The payment share rule, at $32,704.72',
            reasoning: '$32,704.72 is lower than $41,600, so the payment rule constrains first. A student applying only the one-year rule would set a ceiling nearly $9,000 above what their own payment rule allows.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much do the two ceilings differ?',
            given: { salary2: 41600 }, expr: 'salary2 - #t1-p3', format: 'usd', answer: '$8,895.28',
            reasoning: '$41,600 against $32,704.72. The gap is the amount a student could borrow while satisfying one rule and breaking the other.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why deriving a ceiling before looking at any programme is different from working out afterwards whether the payments are affordable, and name the assumption in the $32,704.72 figure that would most change it if it were wrong.',
            acceptableAnswerCriteria: [
              'Explains the difference in order: a ceiling set in advance is a constraint that programmes are then judged against, while an affordability check made afterwards tends to justify a figure already chosen.',
              'Identifies the load-bearing assumption: the whole ceiling rests on the expected $41,600 starting pay, and if actual pay were lower the same balance would take a larger share of gross than the 10% rule allows.',
              'Quantifies the sensitivity in some form — for example noting that the ceiling moves in direct proportion to expected pay, so pay 10% lower supports roughly 10% less borrowing.',
            ],
            evidenceRequirements: [
              'Uses the $32,704.72 ceiling and the $346.67 monthly payment, and names expected pay as the assumption behind both.',
            ],
            dimensions: ['assumption-identification', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the ceiling as derived from income rather than from what a lender is willing to advance.',
              'The response notes that the payment factor and the term are also assumptions, even if expected pay is the largest one.',
            ],
            commonMisconception: 'Deciding how much to borrow by asking how much is available or how much the programme costs, rather than by asking what payment the expected income can carry.',
          },
        ],
      },
    ],
    remediation: 'If the ceiling comes out near $3,466.67, the monthly payment has been divided by the factor without scaling back to thousands. The factor is quoted per $1,000 borrowed, so dividing $346.67 by $10.60 gives the number of thousands, which must then be multiplied by 1000 to reach the balance.',
    extension: 'Recompute the ceiling for the same student under a rule allowing 8% of gross rather than 10%, and say how much less programme cost that ceiling could absorb.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l03',
    grade: 12, unit: 4, day: 3,
    actor: 'a fictional applicant holding two complete financing packages',
    objective: 'Reduce two fictional financing packages to the borrowing each requires, compare them across four years, and show why the higher-priced option can be the cheaper one.',
    scenario: 'The two simulated packages below come from fictional institutions and are invented for this exercise.',
    materials: ['calculator', 'the fictional package figures in these directions'],
    domains: ['postsecondary-financing', 'debt', 'consumer-protection', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Package M comes from an institution costing $27,800 a year and offers $11,200 of gift aid. Package N comes from one costing $19,400 a year and offers $3,600 of gift aid. Both packages assume a work expectation of $2,600 and a family contribution of $4,200. Assume for now that each year of a four-year programme repeats the same figures.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much must be borrowed in one year under package M?',
            given: { costM: 27800, aidM: 11200, workM: 2600, familyM: 4200 },
            expr: 'costM - aidM - workM - familyM', format: 'usd', answer: '$9,800.00',
            reasoning: 'The cost less everything that is not borrowed. Borrowing is what the package leaves over, so it is the figure the two packages should be compared on.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much must be borrowed in one year under package N?',
            given: { costN: 19400, aidN: 3600, workN: 2600, familyN: 4200 },
            expr: 'costN - aidN - workN - familyN', format: 'usd', answer: '$9,000.00',
            reasoning: 'The same calculation on package N. The institution costs $8,400 less a year and the borrowing differs by only $800.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of package M’s cost does its gift aid cover, to two decimal places?',
            given: { aidM2: 11200, costM2: 27800 }, expr: 'round(aidM2 / costM2 * 100, 2)', format: 'percent2', answer: '40.29%',
            reasoning: '$11,200 measured against $27,800.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now carry both packages across the full programme.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What share of package N’s cost does its gift aid cover, to two decimal places?',
            given: { aidN2: 3600, costN2: 19400 }, expr: 'round(aidN2 / costN2 * 100, 2)', format: 'percent2', answer: '18.56%',
            reasoning: '$3,600 measured against $19,400 — less than half the share package M covers.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total borrowing across four years under package M?',
            given: {}, expr: '#t1-p1 * 4', format: 'usd', answer: '$39,200.00',
            reasoning: '$9,800.00 in each of the four years, on the stated assumption that the figures repeat.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total borrowing across four years under package N?',
            given: {}, expr: '#t1-p2 * 4', format: 'usd', answer: '$36,000.00',
            reasoning: '$9,000.00 in each of the four years.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more borrowing does package M require across the programme?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$3,200.00',
            reasoning: '$39,200.00 against $36,000.00. The institution costing $33,600 more across four years produces only $3,200 more borrowing, because its gift aid absorbs the rest.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which package requires less borrowing across the four years?',
            choices: ['Package M', 'Package N'],
            decision: { left: '#t2-p3', cmp: '<', right: '#t2-p2', ifTrue: 'Package N', ifFalse: 'Package M' },
            answer: 'Package N',
            reasoning: '$36,000.00 against $39,200.00. N still wins, but by far less than the difference in sticker price would suggest.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The institution costing $8,400 more a year requires only $800 a year more in borrowing. Explain what makes that possible, and say which single change to the stated assumptions would most alter the comparison and in which direction.',
            acceptableAnswerCriteria: [
              'Explains the mechanism: gift aid covers 40.29% of package M’s cost against 18.56% of package N’s, so most of the higher price is met by the institution rather than by the applicant.',
              'States the conclusion clearly: sticker price and the amount actually borrowed are different quantities, and only the second one has to be repaid.',
              'Names a decisive assumption with its direction — most defensibly that the figures repeat for four years, since gift aid that is not guaranteed beyond year one would push package M’s borrowing up sharply while package N’s changed little.',
            ],
            evidenceRequirements: [
              'Uses the 40.29% and 18.56% aid shares and the $3,200.00 four-year borrowing difference.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response compares the packages on borrowing rather than on price.',
              'The response identifies the four-year repetition as an assumption rather than a fact of the offers.',
            ],
            commonMisconception: 'Ruling out a higher-priced option before reading its aid offer, when the amount that must actually be borrowed is what the two options differ by.',
          },
        ],
      },
    ],
    remediation: 'If package M looks far more expensive, the comparison is being made on the $27,800 and $19,400 costs. Subtract everything that is not borrowed from each — gift aid, the work expectation, and the family contribution — and compare the $9,800.00 and $9,000.00 that remain. Only that difference has to be repaid.',
    extension: 'Recompute both four-year totals assuming package M’s gift aid applies only in year one, and say how large the reversal is.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l04',
    grade: 12, unit: 4, day: 4,
    actor: 'a fictional graduate projecting repayment against an expected salary',
    objective: 'Project a fictional loan’s monthly payment, total repaid, and total interest, and test the payment against expected income using a stated share rule.',
    scenario: 'The fictional balance, the invented rate, and the simulated payment factor below exist only for this exercise.',
    materials: ['calculator', 'the fictional loan terms and payment factor in these directions'],
    domains: ['debt', 'postsecondary-financing', 'income', 'budgeting'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional graduate finishes with a balance of $32,000 at a fixed 5.4%, repaid over 120 monthly payments. Under the fictional payment factor table, that combination costs $10.79 a month for every $1,000 borrowed. The graduate expects to start work at $44,000 a year, and applies a guideline that the payment should stay under 10% of monthly gross pay.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly payment?',
            given: { balance: 32000, factor: 10.79 }, expr: 'round(balance / 1000 * factor, 2)', format: 'usd', answer: '$345.28',
            reasoning: '32 thousands borrowed at $10.79 a month each. The factor already accounts for the 5.4% rate and the 120-payment term, so no separate interest step is needed here.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is repaid in total across the 120 payments?',
            given: { payments: 120 }, expr: '#t1-p1 * payments', format: 'usd', answer: '$41,433.60',
            reasoning: '$345.28 in each of 120 months. This is the figure a borrower rarely sees, because the paperwork leads with the monthly payment.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of that is interest?',
            given: { balance2: 32000 }, expr: '#t1-p2 - balance2', format: 'usd', answer: '$9,433.60',
            reasoning: '$41,433.60 repaid against $32,000 borrowed. Interest is what repayment costs above the sum advanced.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the payment against the income that has to carry it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is expected monthly gross pay?',
            given: { salary: 44000 }, expr: 'round(salary / 12, 2)', format: 'usd', answer: '$3,666.67',
            reasoning: '$44,000 across 12 months, before any tax or deduction.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of monthly gross does the payment take, to two decimal places?',
            given: {}, expr: 'round(#t1-p1 / #t2-p1 * 100, 2)', format: 'percent2', answer: '9.42%',
            reasoning: '$345.28 measured against $3,666.67 of gross pay.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Does the projected payment satisfy the graduate’s 10% guideline?',
            choices: ['Yes — but with little room to spare', 'No — the payment exceeds the guideline'],
            decision: { left: '#t2-p2', cmp: '<', right: '10', ifTrue: 'Yes — but with little room to spare', ifFalse: 'No — the payment exceeds the guideline' },
            answer: 'Yes — but with little room to spare',
            reasoning: '9.42% against a 10% guideline. It passes, and a starting salary about $2,600 lower would not, so the margin is narrow.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This projection passes the guideline at 9.42%. Explain what the guideline is measuring and what it is not, and say why testing the payment against gross rather than take-home pay makes the result look better than the graduate’s month will feel.',
            acceptableAnswerCriteria: [
              'States what the guideline measures: the size of the payment relative to income, as a rough check that one obligation does not dominate a budget.',
              'States what it does not measure: it says nothing about rent, other obligations, the $9,433.60 of interest, or whether the remaining 90.58% of gross is enough to live on in the place the job is.',
              'Explains the gross-versus-net point: tax and payroll deductions come out before the payment does, so $345.28 is a larger share of the money actually reaching the account than 9.42% suggests.',
            ],
            evidenceRequirements: [
              'Uses the 9.42% share and the $345.28 payment, and refers to the $9,433.60 of interest or the $41,433.60 total repaid.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response treats the guideline as a screen rather than as a verdict on affordability.',
              'The response notes that passing at 9.42% leaves very little margin against a lower starting salary.',
            ],
            commonMisconception: 'Reading a payment that satisfies a percentage-of-income guideline as evidence that the borrowing is comfortably affordable.',
          },
        ],
      },
    ],
    remediation: 'If the monthly payment comes out at $10.79 or at $345,280, the balance has not been converted into thousands before the factor is applied. The factor prices each $1,000 borrowed, so $32,000 is 32 units of the factor: 32 times $10.79.',
    extension: 'Recompute the payment, the total repaid, and the share of gross for the same balance over 180 payments at a factor of $8.15 per $1,000, and say what the longer term buys and what it costs.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l05',
    grade: 12, unit: 4, day: 5,
    actor: 'a fictional young adult building a credit record from a first account',
    objective: 'Compute credit utilisation for a fictional account across three situations, and separate what utilisation measures from what it does not.',
    scenario: 'The fictional accounts, limits, and balances below are invented for this exercise. No real credit file, score, or account is described, and nothing here is a recommendation to any real person.',
    materials: ['calculator', 'the fictional account figures in these directions'],
    domains: ['credit', 'debt', 'consumer-protection', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional first card has a limit of $1,500 and currently carries a balance of $940. The cardholder pays it down to $285. Later a second fictional card with a limit of $2,000 is opened and left unused, so the balance stays at $285 across a combined limit. A widely quoted guideline suggests keeping utilisation at or below 30%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is utilisation on the first card at a balance of $940, to two decimal places?',
            given: { bal1: 940, limit1: 1500 }, expr: 'round(bal1 / limit1 * 100, 2)', format: 'percent2', answer: '62.67%',
            reasoning: '$940 measured against the $1,500 limit. Utilisation is a ratio of balance to available credit, not a measure of whether payments were made.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What is utilisation after the balance is paid down to $285?',
            given: { bal2: 285, limit2: 1500 }, expr: 'round(bal2 / limit2 * 100, 2)', format: 'percent2', answer: '19.00%',
            reasoning: '$285 against the same $1,500 limit, now inside the 30% guideline.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What is utilisation once the second card raises the combined limit, with the balance unchanged at $285?',
            given: { bal3: 285, limit3: 1500, limit4: 2000 }, expr: 'round(bal3 / (limit3 + limit4) * 100, 2)', format: 'percent2', answer: '8.14%',
            reasoning: '$285 measured against a combined limit of $3,500. Nothing about the debt changed; only the denominator did.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now separate the two ways the ratio moved.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percentage points',
            text: 'By how many percentage points did paying the balance down reduce utilisation? Give two decimal places.',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'dec2', answer: '43.67',
            reasoning: 'From 62.67% to 19.00%. This fall came from reducing what is owed by $655.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Opening the second card moved utilisation from 19.00% to 8.14%. Did the cardholder’s debt fall?',
            choices: ['Yes — utilisation fell, so less is owed', 'No — the balance stayed at $285 and only the limit changed'],
            answer: 'No — the balance stayed at $285 and only the limit changed',
            reasoning: 'The stated facts hold the balance at $285 while the combined limit rises to $3,500. Utilisation improved without any repayment, which is exactly why the ratio should not be read as a measure of how much is owed. This follows from the scenario’s own figures.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What balance would sit exactly at the 30% guideline on the combined $3,500 limit?',
            given: { limit5: 1500, limit6: 2000, target: 0.30 }, expr: '(limit5 + limit6) * target', format: 'usd', answer: '$1,050.00',
            reasoning: '30% of the combined $3,500 limit. On the original $1,500 limit the same guideline allowed only $450, so the second card raised the balance the guideline permits by $600.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Utilisation improved twice, once by repayment and once by a larger limit. Explain why only one of those changes improved the fictional cardholder’s actual position, and say what risk the second change introduces that the ratio does not show.',
            acceptableAnswerCriteria: [
              'Distinguishes the two movements: the fall from 62.67% to 19.00% came from repaying $655, while the fall to 8.14% came only from a larger denominator with the debt unchanged at $285.',
              'States that only the repayment improved the position, because only repayment reduced what is owed and what interest is charged on.',
              'Names the risk the ratio hides: the guideline now permits a $1,050.00 balance rather than $450, so a larger limit makes it easier to carry more debt while the reported ratio still looks healthy.',
            ],
            evidenceRequirements: [
              'Uses the 19.00% and 8.14% figures and the unchanged $285 balance, and refers to the $1,050.00 guideline balance.',
            ],
            dimensions: ['reasoning-from-figures', 'error-diagnosis', 'criteria-application'],
            lookFors: [
              'The response separates a change in the numerator from a change in the denominator.',
              'The response does not recommend any course of action for a real person’s credit.',
            ],
            commonMisconception: 'Reading a falling utilisation ratio as evidence that debt is falling, when a higher limit moves the ratio without changing the balance at all.',
          },
        ],
      },
    ],
    remediation: 'If the third figure comes out at 19.00%, the balance is still being compared with the original $1,500 limit. Once a second card is open, utilisation across the file compares the total balance with the total limit: $285 against $3,500. Compute each of the three figures with its own denominator before comparing them.',
    extension: 'Work out what balance on the combined limit would return utilisation to 62.67%, and say how much more debt that represents than the original $940.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l06',
    grade: 12, unit: 4, day: 6,
    actor: 'a fictional borrower whose income has fallen below the standard payment',
    objective: 'Price two fictional hardship routes against the standard schedule, quantify what each costs across the life of the loan, and weigh relief now against total repaid.',
    scenario: 'The fictional balance, the invented payment factors, and the simulated programme rules below exist only for this exercise. Nothing here advises any real borrower in difficulty.',
    materials: ['calculator', 'the fictional loan terms and programme rules in these directions'],
    domains: ['debt', 'postsecondary-financing', 'budgeting', 'consumer-protection', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional borrower owes $28,400 at 5.4%. Under the fictional factor table the standard schedule of 120 monthly payments costs $10.79 a month per $1,000 borrowed, and an extended schedule of 240 monthly payments costs $6.82 per $1,000. A third route pauses payments for 12 months, during which interest of 5.4% is added to the balance for the year and nothing is repaid.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the standard monthly payment?',
            given: { balance: 28400, standardFactor: 10.79 }, expr: 'round(balance / 1000 * standardFactor, 2)', format: 'usd', answer: '$306.44',
            reasoning: '28.4 thousands at $10.79 a month each. This is the payment the borrower can no longer meet.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly payment on the extended schedule?',
            given: { balance2: 28400, extendedFactor: 6.82 }, expr: 'round(balance2 / 1000 * extendedFactor, 2)', format: 'usd', answer: '$193.69',
            reasoning: 'The same balance at the 240-payment factor. Doubling the term does not halve the payment, because interest accrues for twice as long.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does the extended schedule reduce the monthly payment?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$112.75',
            reasoning: '$306.44 against $193.69. This is the relief the route delivers each month.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price what each route costs across the whole loan.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is repaid in total under the extended schedule?',
            given: { extendedPayments: 240 }, expr: '#t1-p2 * extendedPayments', format: 'usd', answer: '$46,485.60',
            reasoning: '$193.69 in each of 240 months.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is repaid in total under the standard schedule?',
            given: { standardPayments: 120 }, expr: '#t1-p1 * standardPayments', format: 'usd', answer: '$36,772.80',
            reasoning: '$306.44 in each of 120 months.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the extended schedule cost in total above the standard one?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$9,712.80',
            reasoning: '$46,485.60 against $36,772.80. The $112.75 of monthly relief is bought with nearly $10,000 more repaid across the loan.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the 12-month pause add to the balance in interest?',
            given: { balance3: 28400, annualRate: 0.054 }, expr: 'balance3 * annualRate', format: 'usd', answer: '$1,533.60',
            reasoning: '5.4% of $28,400 added over the year of the pause. Nothing is repaid during that year, so the balance the borrower returns to is larger than the one they left.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Both routes give this fictional borrower relief and both cost money. Argue for one of them, using the figures, and state what you would need to know about the borrower’s situation for your choice to be the right one.',
            acceptableAnswerCriteria: [
              'Argues for the extended schedule on the figures: it lowers the payment permanently by $112.75, and the $9,712.80 cost is spread across twenty years rather than falling due at once.',
              'Argues for the pause on the figures: it costs $1,533.60, far less than $9,712.80, and it leaves the standard schedule intact once the difficulty passes.',
              'Names the decisive fact: whether the drop in income is temporary or lasting. A pause suits a difficulty expected to end within the year; an extended schedule suits an income that will not return to the level the $306.44 payment assumed.',
              'Notes that the two routes are not exclusive in principle, and that neither reduces what is owed.',
            ],
            evidenceRequirements: [
              'Uses the $9,712.80 extra repaid under the extended schedule and the $1,533.60 added by the pause.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'plan-coherence'],
            lookFors: [
              'The response ties the choice to the expected duration of the income drop rather than to which figure is smaller.',
              'The response recognises that the pause defers rather than reduces the obligation.',
            ],
            commonMisconception: 'Choosing the route with the smaller headline cost, without asking whether the relief it gives lasts as long as the difficulty it is meant to address.',
          },
        ],
      },
    ],
    remediation: 'If the extended schedule looks cheaper overall, compare the totals rather than the payments. It pays $193.69 for 240 months, which is $46,485.60, against $306.44 for 120 months, which is $36,772.80. A lower payment over a longer term repays more, not less.',
    extension: 'Work out the standard payment on the balance after a 12-month pause, and say how much of the pause’s cost shows up as a higher payment rather than as a longer term.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l07',
    grade: 12, unit: 4, day: 7,
    actor: 'a fictional applicant who misread a simulated aid offer twice over',
    objective: 'Locate two independent errors in a fictional applicant’s reading of an aid offer, redo the calculation correctly, and quantify how far the mistakes understated the true gap.',
    scenario: 'The fictional aid offer and the applicant’s working below are invented for this exercise.',
    materials: ['calculator', 'the fictional offer and the applicant’s working in these directions'],
    domains: ['postsecondary-financing', 'debt', 'consumer-protection', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional institution states tuition and fees $12,300, housing and food $10,100, books and supplies $1,240, transport $860, and personal costs $1,300. The offer contains grants of $9,100 and $1,800, a work expectation of $2,600, and a loan of $5,500. The applicant left books and supplies and transport out of the cost, and counted the loan as part of the aid.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the true cost of attendance?',
            given: { tuition: 12300, housing: 10100, books: 1240, transport: 860, personal: 1300 },
            expr: 'tuition + housing + books + transport + personal', format: 'usd', answer: '$25,800.00',
            reasoning: 'All five stated components. The institution publishes all of them, so leaving two out is a reading error rather than a judgement call.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What cost figure did the applicant use?',
            given: { books2: 1240, transport2: 860 }, expr: '#t1-p1 - books2 - transport2', format: 'usd', answer: '$23,700.00',
            reasoning: 'The true cost less the two components that were omitted, which is the figure the applicant’s working was built on.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the offer’s actual gift aid?',
            given: { grantA: 9100, grantB: 1800 }, expr: 'grantA + grantB', format: 'usd', answer: '$10,900.00',
            reasoning: 'The two grants only. Neither the work expectation nor the loan reduces the cost the way a grant does.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now reproduce the applicant’s conclusion and then the correct one.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What total did the applicant treat as aid, having added the work expectation and the loan?',
            given: { workStudy: 2600, loanOffer: 5500 }, expr: '#t1-p3 + workStudy + loanOffer', format: 'usd', answer: '$19,000.00',
            reasoning: '$10,900.00 of grants plus $2,600 of work expectation plus the $5,500 loan. Reproducing the wrong figure is what locates the error precisely.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What gap did the applicant conclude they faced?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$4,700.00',
            reasoning: 'The understated $23,700.00 cost less the overstated $19,000.00 of aid. Both errors push in the same direction, which is what makes the result so far out.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What must actually be met from borrowing or other sources, once only the grants and the work expectation are counted against the true cost?',
            given: { workStudy2: 2600 }, expr: '#t1-p1 - #t1-p3 - workStudy2', format: 'usd', answer: '$12,300.00',
            reasoning: 'The full $25,800.00 cost less $10,900.00 of grants and the $2,600 work expectation. The $5,500 loan is one way of meeting this gap, not a reduction of it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'By how much did the applicant understate the gap?',
            given: {}, expr: '#t2-p3 - #t2-p2', format: 'usd', answer: '$7,600.00',
            reasoning: '$12,300.00 against the $4,700.00 the applicant believed. The understatement is larger than either individual error, because the two compound.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Name the two errors separately, say how much of the $7,600.00 understatement each is responsible for, and give one check the applicant could run on any future offer that would catch both.',
            acceptableAnswerCriteria: [
              'Names the first error and sizes it: omitting books and supplies and transport understated the cost by $2,100.',
              'Names the second error and sizes it: counting the $5,500 loan as aid overstated what the offer covers by $5,500, since a loan is money to be repaid rather than a reduction in cost.',
              'Shows the two account for the whole gap: $2,100 plus $5,500 is the $7,600.00 understatement.',
              'Gives a workable check — for example listing every published cost component before reading the offer, and sorting each line of the offer into money given, money to be earned, and money to be repaid.',
            ],
            evidenceRequirements: [
              'Uses the $12,300.00 true gap and the $4,700.00 the applicant computed, and attributes $2,100 and $5,500 to the two errors.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The response separates the two errors rather than treating the result as one miscalculation.',
              'The response notes that a loan appearing in an award letter is normal, and that the error is in how it was classified.',
            ],
            commonMisconception: 'Treating everything listed in an award letter as aid, so borrowed money appears to reduce the cost rather than to finance it.',
          },
        ],
      },
    ],
    remediation: 'If the corrected gap comes out at $6,800.00, the $5,500 loan is still being counted against the cost. Sort the offer first: $10,900.00 is given, $2,600 must be earned, and $5,500 must be repaid. Only the first two reduce what has to be found; the loan is one way of finding it.',
    extension: 'Work out the gap if the fictional applicant also loses one $1,800 grant in the second year, and say what that does to four-year borrowing at this institution.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l08',
    grade: 12, unit: 4, day: 8,
    actor: 'a fictional applicant to a trade programme rather than a degree',
    objective: 'Apply the borrowing-ceiling method to a fictional trade pathway with a shorter repayment term, and quantify the gap between what the ceiling allows and what the pathway costs.',
    scenario: 'The fictional trade programme, its simulated costs, and the invented payment factor below exist only for this exercise.',
    materials: ['calculator', 'the fictional programme costs and payment factor in these directions'],
    domains: ['postsecondary-financing', 'debt', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional applicant expects to earn $38,400 a year on completing the programme, and adopts a rule that the loan payment must stay within 8% of expected monthly gross pay. Loans for this pathway run over five years, and under the fictional factor table that costs $19.10 a month for every $1,000 borrowed. The programme costs $14,600 across two years and requires $2,800 of tools.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is expected monthly gross pay?',
            given: { expectedIncome: 38400 }, expr: 'round(expectedIncome / 12, 2)', format: 'usd', answer: '$3,200.00',
            reasoning: '$38,400 across the 12 months of a year.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What monthly payment does the 8% rule allow?',
            given: { shareCap: 0.08 }, expr: 'round(#t1-p1 * shareCap, 2)', format: 'usd', answer: '$256.00',
            reasoning: '8% of $3,200.00. This applicant has chosen a tighter rule than the 10% used for the ten-year case, which matters because the shorter term makes each borrowed dollar cost more per month.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What total borrowing does that payment support over five years?',
            given: { factor: 19.10 }, expr: 'round(#t1-p2 / factor * 1000, 2)', format: 'usd', answer: '$13,403.14',
            reasoning: '$256.00 divided by the $19.10 charged per $1,000, scaled back to dollars. The five-year term nearly doubles the monthly cost per $1,000 compared with a ten-year term, which is what holds this ceiling down.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the pathway against the ceiling.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the pathway cost in total?',
            given: { programmeCost: 14600, tools: 2800 }, expr: 'programmeCost + tools', format: 'usd', answer: '$17,400.00',
            reasoning: 'The $14,600 programme cost plus $2,800 of tools. The tools are a required cost of entering the trade, so leaving them out would understate what has to be financed.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does the cost exceed the borrowing ceiling?',
            given: {}, expr: '#t2-p1 - #t1-p3', format: 'usd', answer: '$3,996.86',
            reasoning: '$17,400.00 needed against $13,403.14 the payment rule supports.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Does financing the whole pathway by borrowing fit inside the applicant’s own rule?',
            choices: ['Yes — the ceiling covers the cost', 'No — the cost exceeds the ceiling by $3,996.86'],
            decision: { left: '#t2-p1', cmp: '>', right: '#t1-p3', ifTrue: 'No — the cost exceeds the ceiling by $3,996.86', ifFalse: 'Yes — the ceiling covers the cost' },
            answer: 'No — the cost exceeds the ceiling by $3,996.86',
            reasoning: '$17,400.00 against a ceiling of $13,403.14. The rule is not broken by the pathway being unaffordable in general; it is broken by financing all of it with borrowing.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The pathway costs $3,996.86 more than the ceiling allows. Give two different ways this fictional applicant could close that gap without breaking the rule, price each, and say which you would try first and why.',
            acceptableAnswerCriteria: [
              'Gives two genuinely different routes with figures — for example earning and contributing roughly $3,997 before or during the programme, buying tools over time out of earnings rather than financing them, or finding a programme costing less.',
              'Prices each route rather than naming it, showing how it brings the financed amount to $13,403.14 or below.',
              'Chooses one and justifies it against the applicant’s situation, recognising that the tools at $2,800 are the component most likely to be spread over time.',
              'Notes what each route costs that is not money — time before starting, a longer path to qualification, or working while studying.',
            ],
            evidenceRequirements: [
              'Uses the $13,403.14 ceiling and the $17,400.00 total cost, and shows each proposed route closing the $3,996.86 gap.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'transfer'],
            lookFors: [
              'The routes respect the ceiling rather than arguing the rule should be relaxed.',
              'A response that argues for relaxing the rule is credited only if it states what payment share it would accept instead and what that costs monthly.',
            ],
            commonMisconception: 'Assuming a shorter loan term is always better, without noticing that it raises the monthly cost per $1,000 and so lowers how much can be borrowed at all.',
          },
        ],
      },
    ],
    remediation: 'If the ceiling looks close to $32,000, the ten-year factor is being used. This pathway’s loans run five years at $19.10 per $1,000, not $10.60. A shorter term costs more each month for the same balance, so the same $256.00 payment supports far less borrowing.',
    extension: 'Recompute the ceiling if the applicant could repay over ten years at $10.60 per $1,000, and say whether the longer term closes the gap and what it costs in total repaid.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l09',
    grade: 12, unit: 4, day: 9,
    actor: 'a fictional applicant comparing two packages across more than one year',
    objective: 'Project two fictional financing packages across two years with rising costs and fixed aid, and show how borrowing diverges from the first-year comparison.',
    scenario: 'The two simulated packages and the fictional cost increase below are invented for this exercise.',
    materials: ['calculator', 'the fictional package terms and cost increase in these directions'],
    domains: ['postsecondary-financing', 'debt', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Package P costs $26,200 in year one with $12,400 of gift aid. Package Q costs $21,000 in year one with $5,200 of gift aid. Both assume a family contribution of $4,000 and work of $2,500 each year. Costs at both institutions rise 3% in year two, and both gift aid awards stay at their year-one amounts.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What must be borrowed in year one under package P?',
            given: { costP: 26200, aidP: 12400, family: 4000, work: 2500 },
            expr: 'costP - aidP - family - work', format: 'usd', answer: '$7,300.00',
            reasoning: 'The year-one cost less gift aid, the family contribution, and the work expectation.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does package P cost in year two after the 3% increase?',
            given: { costP2: 26200, rise: 0.03 }, expr: 'round(costP2 * (1 + rise), 2)', format: 'usd', answer: '$26,986.00',
            reasoning: '$26,200 raised by 3%. The whole increase of $786.00 falls on the applicant, because the aid does not move with it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What must be borrowed in year two under package P?',
            given: { aidP2: 12400, family2: 4000, work2: 2500 }, expr: '#t1-p2 - aidP2 - family2 - work2', format: 'usd', answer: '$8,086.00',
            reasoning: 'The higher cost against unchanged aid, contribution, and work. Borrowing rises by the full $786.00 of the cost increase.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for package Q and compare the two years together.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What must be borrowed in year one under package Q?',
            given: { costQ: 21000, aidQ: 5200, family3: 4000, work3: 2500 },
            expr: 'costQ - aidQ - family3 - work3', format: 'usd', answer: '$9,300.00',
            reasoning: 'The same calculation applied to package Q, which starts with $2,000 more borrowing despite a lower cost.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does package Q cost in year two?',
            given: { costQ2: 21000, rise2: 0.03 }, expr: 'round(costQ2 * (1 + rise2), 2)', format: 'usd', answer: '$21,630.00',
            reasoning: '$21,000 raised by 3%, an increase of $630.00.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What must be borrowed in year two under package Q?',
            given: { aidQ2: 5200, family4: 4000, work4: 2500 }, expr: '#t2-p2 - aidQ2 - family4 - work4', format: 'usd', answer: '$9,930.00',
            reasoning: 'The higher cost against unchanged aid. Q’s borrowing rises by $630.00, less than P’s $786.00, because the smaller base produces a smaller increase.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the two-year borrowing under package P?',
            given: {}, expr: '#t1-p1 + #t1-p3', format: 'usd', answer: '$15,386.00',
            reasoning: '$7,300.00 in year one plus $8,086.00 in year two.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What is the two-year borrowing under package Q?',
            given: {}, expr: '#t2-p1 + #t2-p3', format: 'usd', answer: '$19,230.00',
            reasoning: '$9,300.00 plus $9,930.00 — $3,844.00 more than package P across the same two years.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Package P costs more every year and requires less borrowing in both. Explain what makes that happen, and say what a fictional applicant should ask each institution that this two-year projection assumes an answer to.',
            acceptableAnswerCriteria: [
              'Explains the mechanism: package P’s $12,400 of gift aid covers a far larger share of its cost than package Q’s $5,200 does, so the gap the applicant must fill is smaller despite the higher price.',
              'Identifies the divergence: P’s borrowing rises $786.00 in year two and Q’s rises $630.00, so P’s advantage narrows slightly but does not reverse, and the two-year gap stands at $3,844.00.',
              'Names the question the projection assumes: whether each gift aid award is guaranteed for the full programme or renewed annually against conditions, since the whole comparison depends on the $12,400 remaining in place.',
            ],
            evidenceRequirements: [
              'Uses the $15,386.00 and $19,230.00 two-year borrowing totals, and refers to the fixed gift aid against rising cost.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response recognises that aid fixed in dollars loses ground to a cost rising in percentage terms.',
              'The response frames the aid-renewal question as decisive rather than as a detail.',
            ],
            commonMisconception: 'Comparing packages on year one alone, when fixed aid against rising costs makes each later year worse than the first in a way the first-year figures do not show.',
          },
        ],
      },
    ],
    remediation: 'If both packages show the same borrowing in year two as in year one, the 3% cost increase has not been applied, or it has been applied to the aid as well. The aid stays at $12,400 and $5,200; only the costs move, to $26,986.00 and $21,630.00. The whole increase therefore lands on the amount borrowed.',
    extension: 'Extend both packages to four years at the same 3% annual increase and fixed aid, and say whether the gap between them widens or narrows.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l10',
    grade: 12, unit: 4, day: 10,
    actor: 'a fictional graduate projecting repayment against two possible career outcomes',
    objective: 'Project a fictional repayment against a strong and a weak career outcome, establish the payment each supports, and write a plan that survives both.',
    scenario: 'The fictional balance, the invented payment factor, and the two simulated salary outcomes below exist only for this exercise.',
    materials: ['calculator', 'the fictional loan terms and salary scenarios in these directions'],
    domains: ['debt', 'postsecondary-financing', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional graduate finishes with $27,600 borrowed, repaid over 120 monthly payments at a factor of $10.79 per $1,000. Scenario A is a starting salary of $46,800; scenario B is $34,200. The graduate wants the payment to stay within 8% of monthly gross in whichever scenario occurs.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly payment?',
            given: { balance: 27600, factor: 10.79 }, expr: 'round(balance / 1000 * factor, 2)', format: 'usd', answer: '$297.80',
            reasoning: '27.6 thousands at $10.79 each. The payment is fixed by the loan, so it is the same in both scenarios; only the income under it changes.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is repaid in total across the 120 payments?',
            given: { payments: 120 }, expr: '#t1-p1 * payments', format: 'usd', answer: '$35,736.00',
            reasoning: '$297.80 in each of 120 months.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the total is interest?',
            given: { balance2: 27600 }, expr: '#t1-p2 - balance2', format: 'usd', answer: '$8,136.00',
            reasoning: '$35,736.00 repaid against $27,600 borrowed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the same payment against both career outcomes.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is monthly gross pay in scenario A?',
            given: { salaryA: 46800 }, expr: 'round(salaryA / 12, 2)', format: 'usd', answer: '$3,900.00',
            reasoning: '$46,800 across the 12 months of a year, before tax. The payment share rule is written against gross pay, so gross is the base used in both scenarios.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of gross does the payment take in scenario A, to two decimal places?',
            given: {}, expr: 'round(#t1-p1 / #t2-p1 * 100, 2)', format: 'percent2', answer: '7.64%',
            reasoning: '$297.80 against $3,900.00 — inside the 8% target with room to spare.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is monthly gross pay in scenario B?',
            given: { salaryB: 34200 }, expr: 'round(salaryB / 12, 2)', format: 'usd', answer: '$2,850.00',
            reasoning: '$34,200 across the 12 months of a year — $1,050.00 a month less than scenario A, on the same fixed loan payment.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What share of gross does the same payment take in scenario B, to two decimal places?',
            given: {}, expr: 'round(#t1-p1 / #t2-p3 * 100, 2)', format: 'percent2', answer: '10.45%',
            reasoning: '$297.80 against $2,850.00. The identical payment breaks the graduate’s own 8% target once income is $12,600 lower.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Quantify what scenario B would require before writing anything.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the payment cost across a full year?',
            given: {}, expr: '#t1-p1 * 12', format: 'usd', answer: '$3,573.60',
            reasoning: '$297.80 in each of 12 months — the annual claim on income before anything else is paid.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What monthly payment would satisfy the 8% target in scenario B?',
            given: { cap: 0.08 }, expr: 'round(#t2-p3 * cap, 2)', format: 'usd', answer: '$228.00',
            reasoning: '8% of $2,850.00. The gap between this and $297.80 is $69.80 a month, which is what a longer term or a smaller balance would have to bridge.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write the repayment plan. Give figures for both scenarios.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write a repayment plan for this fictional graduate that works in scenario A and does not fail in scenario B. State what the plan does differently in each case, name what it costs in the weaker case, and say which part of the plan you are least confident about.',
            acceptableAnswerCriteria: [
              'Sets out what happens in scenario A with figures: the $297.80 payment takes 7.64% of gross, is affordable as scheduled, and any surplus could be applied to the balance to reduce the $8,136.00 of interest.',
              'Sets out a concrete response for scenario B rather than an intention: either accepting 10.45% and naming what else in the budget absorbs it, or moving to a longer term that brings the payment toward $228.00 and stating that this raises total repaid.',
              'Names the cost of the weaker case explicitly — a payment taking 10.45% of gross, or a longer term costing more than $8,136.00 in interest.',
              'Identifies the least confident element with a reason, most defensibly the assumption that only these two salary outcomes are possible, or that scenario B’s income stays flat rather than recovering.',
            ],
            evidenceRequirements: [
              'Uses the 7.64% and 10.45% payment shares and the $228.00 payment scenario B would support.',
              'States the total repaid or the total interest under the plan proposed.',
            ],
            dimensions: ['plan-coherence', 'communication-of-uncertainty', 'tradeoff-defense', 'evidence-use'],
            lookFors: [
              'The plan is written to be executed in either outcome rather than assuming the better one.',
              'Several plans are defensible — holding the standard schedule and adjusting spending, or extending the term — and each is credited when its cost is stated.',
              'The response does not treat the 8% target as a rule that cannot be revisited, provided any revision is justified.',
            ],
            commonMisconception: 'Building a repayment plan around the expected salary alone, so the plan has nothing to say about the outcome that would actually make it difficult.',
          },
        ],
      },
    ],
    remediation: 'If both scenarios produce the same percentage, the payment is being recomputed from each salary rather than held fixed. The loan sets the payment at $297.80 regardless of what the graduate earns. Divide that fixed payment by each monthly gross figure — $3,900.00 and $2,850.00 — to get the two shares.',
    extension: 'Work out the balance that would have kept the payment within 8% of gross in scenario B, and say how much less than $27,600 the graduate would have had to borrow.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u04-l11',
    grade: 12, unit: 4, day: 11,
    actor: 'a fictional borrower defending a credit-protection plan against a disputed account',
    objective: 'Quantify the effect of a disputed account on a fictional credit picture, establish the correct first response, and defend a protection plan that addresses both accuracy and behaviour.',
    scenario: 'The fictional accounts, the simulated credit report entry, and the invented figures below exist only for this exercise. No real credit file, score, or account is described, and no account number, password, or identifier appears anywhere in this lesson.',
    materials: ['calculator', 'the fictional account and report figures in these directions'],
    domains: ['credit', 'fraud', 'consumer-protection', 'debt', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional borrower has one card with a limit of $4,000 carrying a balance of $1,180, and has made payments on time in 34 of the last 36 months. A simulated credit report also lists an account the borrower did not open, with a balance of $2,350 against a limit of $3,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is utilisation on the borrower’s own card, to two decimal places?',
            given: { balance: 1180, limit: 4000 }, expr: 'round(balance / limit * 100, 2)', format: 'percent2', answer: '29.50%',
            reasoning: '$1,180 against the $4,000 limit — just inside the commonly quoted 30% guideline.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What proportion of the last 36 months carried an on-time payment, to two decimal places?',
            given: { onTime: 34, total: 36 }, expr: 'round(onTime / total * 100, 2)', format: 'percent2', answer: '94.44%',
            reasoning: '34 of 36 months. Payment history and utilisation are separate things, and this borrower’s record is strong on the first.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What would utilisation be if the disputed account were counted, to two decimal places?',
            given: { balance2: 1180, disputedBalance: 2350, limit2: 4000, disputedLimit: 3000 },
            expr: 'round((balance2 + disputedBalance) / (limit2 + disputedLimit) * 100, 2)', format: 'percent2', answer: '50.43%',
            reasoning: 'A combined balance of $3,530 against a combined limit of $7,000. The disputed account adds far more to the numerator than to the denominator, which is why it pushes the ratio up.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now size the damage and establish the right first move.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percentage points',
            text: 'By how many percentage points does the disputed account raise utilisation? Give two decimal places.',
            given: {}, expr: '#t1-p3 - #t1-p1', format: 'dec2', answer: '20.93',
            reasoning: 'From 29.50% to 50.43%. An account the borrower never opened moves the ratio by more than two thirds of its original value.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'What is the right first response to the $2,350 account the borrower did not open?',
            choices: ['Pay it down to reduce utilisation', 'Report it as an account the borrower did not open and have it investigated'],
            answer: 'Report it as an account the borrower did not open and have it investigated',
            reasoning: 'The stated facts are that the borrower did not open the account, so it is not their debt and paying it would neither settle the question nor stop further accounts appearing. Reporting it starts the process that can remove it and flag the underlying problem. This follows from the scenario rather than from any comparison of figures.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What balance on the borrower’s own $4,000 limit would sit at 25% utilisation?',
            given: { limit3: 4000, target: 0.25 }, expr: 'limit3 * target', format: 'usd', answer: '$1,000.00',
            reasoning: '25% of $4,000. Reaching it requires paying $180 off the current balance, which is the part of the picture the borrower actually controls.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Write and defend the plan.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write a protection plan for this fictional borrower that covers both the disputed account and their own behaviour, and defend it. Explain why the two halves need different kinds of action, and say what you would tell the borrower to expect that the arithmetic here cannot promise.',
            acceptableAnswerCriteria: [
              'Addresses the disputed account as an accuracy problem: report it as not belonging to the borrower, keep a written record of what was reported and when, and check later reports for further accounts, because a single false entry suggests the borrower’s details are being used.',
              'Addresses the borrower’s own position as a behavioural one: the $1,180 balance is inside their control, and paying $180 would bring utilisation to 25.00% while the 94.44% payment record is maintained.',
              'Explains why the halves differ: one is a claim that a fact is wrong and is resolved by evidence and process, the other is a position that is accurate and is changed only by paying down a balance over time.',
              'States what cannot be promised: how long an investigation takes, whether the entry is removed, and what any of this does to a score, none of which follows from the 20.93 percentage points computed here.',
            ],
            evidenceRequirements: [
              'Uses the 50.43% utilisation with the disputed account and the 29.50% without it, and the $1,000.00 balance that would sit at 25%.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The plan never suggests paying a debt the borrower did not incur in order to improve a ratio.',
              'The plan never involves sharing account numbers, passwords, or identifying details with anyone who contacts the borrower.',
              'The response distinguishes what the borrower controls from what a process controls.',
            ],
            commonMisconception: 'Treating everything on a credit report as a problem to be paid down, when an entry that does not belong to the borrower is a dispute rather than a debt.',
          },
        ],
      },
    ],
    remediation: 'If the combined utilisation comes out at 58.75%, the disputed balance has been added to the numerator without adding its $3,000 limit to the denominator. Both accounts contribute to both sides of the ratio: $3,530 of balance against $7,000 of limit. Compute each version of the ratio with its matching limit before comparing them.',
    extension: 'Work out what utilisation would be if the disputed account were removed but the borrower had opened a third fictional card with a $2,500 limit and no balance, and say which of the two changes helps the ratio more.',
  },
]
