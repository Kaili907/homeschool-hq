import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 1 — PF1 Earning Income: Income, Benefits, and the Cost of
 * Getting Qualified. Ten lessons, one per source lesson day.
 */
export const g09u01: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u01-l01',
    grade: 9, unit: 1, day: 1,
    actor: 'Dario Villanueva, a fictional grocery stocker',
    objective: 'Compute a fictional worker’s gross pay from an hourly rate and hours worked, subtract each stated payroll deduction to reach take-home pay, and state how much a budget built on gross pay would overstate.',
    scenario: 'Dario Villanueva is a fictional grocery stocker in a simulated town. Every figure on his made-up pay stub below exists only for this exercise.',
    materials: ['calculator', 'the fictional pay stub figures printed in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'Dario’s fictional pay stub covers one week. He is paid $15.80 per hour and worked 34 hours.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Dario’s gross pay for the week, before any deduction is taken out?',
            given: { hourlyRate: 15.8, hours: 34 }, expr: 'hourlyRate * hours', format: 'usd', answer: '$537.20',
            reasoning: 'Gross pay is the rate times the hours worked before any deduction: $15.80 x 34 hours.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'The stub lists three deductions: FICA at 7.65% of gross pay, state income tax at 4.25% of gross pay, and federal income tax withheld of $42.15. Percentage deductions are rounded to the nearest cent.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld for FICA, at 7.65% of gross pay?',
            given: { ficaRate: 0.0765 }, expr: 'round(#t1-p1 * ficaRate, 2)', format: 'usd', answer: '$41.10',
            reasoning: 'FICA is a percentage of gross, not of take-home: 7.65% of $537.20 is $41.0958, which rounds to $41.10.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld for state income tax, at 4.25% of gross pay?',
            given: { stateRate: 0.0425 }, expr: 'round(#t1-p1 * stateRate, 2)', format: 'usd', answer: '$22.83',
            reasoning: 'State income tax here is also assessed on gross: 4.25% of $537.20 is $22.831, which rounds to $22.83.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Dario’s take-home pay after all three deductions?',
            given: { federalWithheld: 42.15 }, expr: '#t1-p1 - #t2-p1 - #t2-p2 - federalWithheld', format: 'usd', answer: '$431.12',
            reasoning: 'Take-home is gross less every deduction: $537.20 - $41.10 - $22.83 - $42.15.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Work these two without help. Round a percentage to one decimal place.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'What percentage of Dario’s gross pay does he actually take home?',
            given: {}, expr: 'round(#t2-p3 / #t1-p1 * 100, 1)', format: 'percent1', answer: '80.3%',
            reasoning: '$431.12 divided by $537.20 is 0.80253, or 80.3% to one decimal place.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'If Dario planned his week’s spending as though the whole gross amount were available, by how many dollars would his plan overstate what he can spend?',
            given: {}, expr: '#t1-p1 - #t2-p3', format: 'usd', answer: '$106.08',
            reasoning: 'The overstatement is exactly the total withheld: $537.20 - $431.12.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why a weekly plan built on Dario’s gross pay would fail, and say which single figure on the stub a person should plan from instead.',
            acceptableAnswerCriteria: [
              'Identifies take-home pay ($431.12) as the figure a spending plan should start from, not gross pay ($537.20).',
              'Explains that the deductions are removed before the worker ever receives the money, so the gross figure was never available to spend.',
              'Quantifies the gap, or describes it as roughly a fifth of the paycheck, rather than calling it merely "some" difference.',
            ],
            evidenceRequirements: [
              'Cites both the gross figure of $537.20 and the take-home figure of $431.12 from the fictional stub.',
            ],
            dimensions: ['reasoning-from-figures', 'evidence-use'],
            lookFors: [
              'The response names take-home pay, not "net" or "the smaller number", and ties it to the $106.08 gap.',
              'The response does not treat the deductions as optional or as something Dario chose.',
            ],
            commonMisconception: 'Treating payroll deductions as a bill paid later out of the paycheck rather than as money withheld before the paycheck is issued.',
          },
        ],
      },
    ],
    remediation: 'If the running deductions drift, rebuild the stub as a four-row subtraction table (gross, minus FICA, minus state, minus federal) and check each row against the previous row before moving on. If the percentage deductions are the problem, compute 1% of $537.20 first ($5.372) and scale it, so the learner can see that 7.65% must land near $41 and not near $4 or $410.',
    extension: 'Recompute the whole stub with Dario at 29 hours instead of 34 and state which of the four figures changes proportionally and which does not.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l02',
    grade: 9, unit: 1, day: 2,
    actor: 'Nadia Okonjo, a fictional veterinary assistant',
    objective: 'Add employer-paid benefits to salary to compute the total compensation of two fictional job offers, and decide which offer is worth more than its salary line suggests.',
    scenario: 'Nadia Okonjo, a fictional veterinary assistant, has two made-up offers in front of her. Neither clinic is real and neither offer is a real job.',
    materials: ['calculator', 'the two fictional offer summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer A, from the fictional Brightleaf Animal Clinic: salary $34,000 per year, employer health contribution $3,600 per year, retirement match of 3% of salary, and 10 paid days off. Assume a 260-day work year throughout.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is Brightleaf’s retirement match worth in a year, at 3% of salary?',
            given: { salaryA: 34000, matchA: 0.03 }, expr: 'salaryA * matchA', format: 'usd', answer: '$1,020.00',
            reasoning: 'The match is a percentage of salary, so 3% of $34,000 is $1,020.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total annual compensation of Offer A, counting salary, the health contribution, and the retirement match?',
            given: { salaryA2: 34000, healthA: 3600 }, expr: 'salaryA2 + healthA + #t1-p1', format: 'usd', answer: '$38,620.00',
            reasoning: 'Total compensation adds employer-paid items to salary: $34,000 + $3,600 + $1,020.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Offer B, from the fictional Riverbend Pet Hospital: salary $36,500 per year, no employer health contribution, retirement match of 1% of salary, and 5 paid days off.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total annual compensation of Offer B?',
            given: { salaryB: 36500, matchB: 0.01 }, expr: 'salaryB + salaryB * matchB', format: 'usd', answer: '$36,865.00',
            reasoning: 'Offer B adds only its 1% match: $36,500 + $365, with no health contribution to include.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Which offer provides more total annual compensation?',
            choices: ['Offer A, from Brightleaf', 'Offer B, from Riverbend', 'They are equal'],
            given: { sA: 34000, hA: 3600, mA: 0.03, sB: 36500, mB: 0.01 },
            decision: { left: 'sA + hA + sA * mA', cmp: '>', right: 'sB + sB * mB', ifTrue: 'Offer A, from Brightleaf', ifFalse: 'Offer B, from Riverbend' },
            answer: 'Offer A, from Brightleaf',
            reasoning: 'Offer A totals $38,620 against Offer B’s $36,865, so the offer with the lower salary line is worth more once benefits are counted.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Paid days off are also compensation: they are days the employer pays for without work. Value a paid day at the daily rate of the salary, using the 260-day work year.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What are Brightleaf’s 10 paid days off worth in a year, valued at Offer A’s daily rate?',
            given: { salary: 34000, workYear: 260, daysOff: 10 }, expr: 'round(salary / workYear * daysOff, 2)', format: 'usd', answer: '$1,307.69',
            reasoning: 'A day of Offer A’s salary is $34,000 / 260 = $130.769..., and ten of them come to $1,307.69 after rounding to the cent.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does Offer A’s total compensation exceed Offer B’s, before counting paid days off?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$1,755.00',
            reasoning: '$38,620 less $36,865, the two totals computed above.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'short',
            text: 'A friend of Nadia’s says Riverbend is obviously the better offer because it pays $2,500 more. Say what that comparison leaves out and what it would take for Riverbend to actually be worth more.',
            acceptableAnswerCriteria: [
              'States that the $2,500 salary difference ignores the $3,600 health contribution and the difference in retirement match.',
              'Names a specific condition under which Riverbend could still be the better choice, such as Nadia already being covered by health insurance so the $3,600 is worth nothing to her.',
            ],
            evidenceRequirements: [
              'Refers to at least one employer-paid figure from Offer A ($3,600 health, $1,020 match, or $1,307.69 in paid days) as the thing the salary comparison omits.',
            ],
            dimensions: ['tradeoff-defense', 'evidence-use', 'assumption-identification'],
            lookFors: [
              'The response treats the health contribution as compensation only if Nadia would otherwise have to buy that coverage.',
              'The response does not simply restate that Offer A totals more; it says which omitted item carries the difference.',
            ],
            commonMisconception: 'Reading the salary line as the whole of what a job pays.',
          },
        ],
      },
    ],
    remediation: 'If total compensation is being read as a bigger salary, separate the two columns explicitly: cash the worker receives and money the employer spends on the worker’s behalf. Rebuild Offer A as a four-line list ($34,000 cash, $3,600 health, $1,020 retirement, $1,307.69 paid days) and ask which lines would appear in a bank account and which would not.',
    extension: 'Find the salary Riverbend would have to offer to match Offer A’s total compensation, given that its match stays at 1%.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l03',
    grade: 9, unit: 1, day: 3,
    actor: 'Marcus Adeyemi, a fictional pool lifeguard',
    objective: 'Read each line of a fictional pay stub, compute the five separate deductions a first-time worker is likely to see, and total them against net pay.',
    scenario: 'This is a fictional pay stub for Marcus Adeyemi, a made-up lifeguard at a simulated municipal pool. The employer, the amounts, and the tax rates are all invented for practice.',
    materials: ['calculator', 'the fictional pay-stub lines in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Marcus’s fictional stub shows gross pay of $612.00 for the period. Social Security is withheld at 6.2% of gross and Medicare at 1.45% of gross. Round each deduction to the nearest cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld for Social Security?',
            given: { gross: 612, ssRate: 0.062 }, expr: 'round(gross * ssRate, 2)', format: 'usd', answer: '$37.94',
            reasoning: '6.2% of $612.00 is $37.944, which rounds to $37.94.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld for Medicare?',
            given: { gross2: 612, medRate: 0.0145 }, expr: 'round(gross2 * medRate, 2)', format: 'usd', answer: '$8.87',
            reasoning: '1.45% of $612.00 is $8.874, which rounds to $8.87.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'The same stub also shows state income tax at 4.25% of gross, a city income tax at 1% of gross, and federal income tax withheld of $38.50.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld for state income tax?',
            given: { gross3: 612, stateRate: 0.0425 }, expr: 'round(gross3 * stateRate, 2)', format: 'usd', answer: '$26.01',
            reasoning: '4.25% of $612.00 is exactly $26.01.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld for city income tax?',
            given: { gross4: 612, cityRate: 0.01 }, expr: 'round(gross4 * cityRate, 2)', format: 'usd', answer: '$6.12',
            reasoning: '1% of $612.00 is exactly $6.12.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Work these three without help.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of all five deductions on the stub?',
            given: { federal: 38.5 }, expr: '#t1-p1 + #t1-p2 + #t2-p1 + #t2-p2 + federal', format: 'usd', answer: '$117.44',
            reasoning: '$37.94 + $8.87 + $26.01 + $6.12 + $38.50, the five withheld lines added.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Marcus’s net pay for the period?',
            given: { gross5: 612 }, expr: 'gross5 - #t3-p1', format: 'usd', answer: '$494.56',
            reasoning: 'Net pay is gross less total deductions: $612.00 - $117.44.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of gross pay was withheld in total? Round to one decimal place.',
            given: { gross6: 612 }, expr: 'round(#t3-p1 / gross6 * 100, 1)', format: 'percent1', answer: '19.2%',
            reasoning: '$117.44 of $612.00 is 0.19189..., or 19.2% to one decimal place.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'short',
            text: 'Two of the five deductions on Marcus’s stub are not income tax at all. Name them and say what they pay for.',
            acceptableAnswerCriteria: [
              'Names Social Security ($37.94) and Medicare ($8.87) as the two non-income-tax lines, together called FICA.',
              'States that these fund social insurance programs — retirement, disability, and survivor benefits, and hospital insurance — rather than general government spending assessed on income.',
            ],
            evidenceRequirements: [
              'Quotes the two amounts, $37.94 and $8.87, from the fictional stub rather than describing them generally.',
            ],
            dimensions: ['evidence-use', 'criteria-application'],
            lookFors: [
              'The response distinguishes the flat-rate payroll lines from the three income-tax lines, which are federal, state, and city.',
              'The response does not claim Marcus can opt out of them.',
            ],
          },
        ],
      },
    ],
    remediation: 'If deduction lines are being combined or skipped, print the stub as five labelled rows and have the learner compute one row per pass, checking each against 1% of gross ($6.12) as a scale reference before summing.',
    extension: 'Marcus picks up a second fictional shift and his gross rises to $748.00. Recompute all four percentage deductions and state which stub line stays fixed.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l04',
    grade: 9, unit: 1, day: 4,
    actor: 'Lena Pham, a fictional HVAC apprentice',
    objective: 'Compute what a fictional technical certificate costs in money and time, and how long the resulting pay increase takes to repay that cost.',
    scenario: 'Lena Pham is a fictional worker considering an invented 18-month HVAC certificate program. The program, the tuition, and the wages below are all made up for this exercise.',
    materials: ['calculator', 'the fictional program and wage figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional certificate costs $6,800 in tuition plus $950 for tools and books, and takes 18 months. Lena currently earns $29,500 per year and expects $46,000 per year once certified.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total out-of-pocket cost of getting qualified?',
            given: { tuition: 6800, toolsAndBooks: 950 }, expr: 'tuition + toolsAndBooks', format: 'usd', answer: '$7,750.00',
            reasoning: 'Cost to qualify is tuition plus required materials: $6,800 + $950.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more would Lena earn per year after certifying?',
            given: { after: 46000, before: 29500 }, expr: 'after - before', format: 'usd', answer: '$16,500.00',
            reasoning: 'The annual gain is $46,000 - $29,500.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Payback time is the cost of qualifying divided by the yearly gain, expressed in months.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'How many whole months of the higher wage does it take to repay the cost of qualifying? Round to the nearest month.',
            given: {}, expr: 'round(#t1-p1 / #t1-p2 * 12, 0)', format: 'months0', answer: '6',
            reasoning: '$7,750 / $16,500 is 0.4697 of a year, which is 5.64 months and rounds to 6.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'Counting the 18 months of the program itself, how long from starting the program until the cost is repaid?',
            given: { programMonths: 18 }, expr: 'programMonths + #t2-p1', format: 'months0', answer: '24',
            reasoning: 'The clock starts at enrolment: 18 months of training plus the 6 months of higher pay that repay the $7,750.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Work these without help.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'Over 5 years at the higher wage, what is Lena’s net gain after subtracting the cost of qualifying?',
            given: { years: 5 }, expr: '#t1-p2 * years - #t1-p1', format: 'usd', answer: '$74,750.00',
            reasoning: 'Five years of the $16,500 gain is $82,500, less the $7,750 cost.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'If the program’s tuition rose to $19,000 with everything else unchanged, would the cost still be repaid within the first year of higher pay?',
            choices: ['Yes, within the first year', 'No, it would take longer than a year'],
            given: { newTuition: 19000 },
            decision: { left: 'newTuition + 950', cmp: '<=', right: '#t1-p2', ifTrue: 'Yes, within the first year', ifFalse: 'No, it would take longer than a year' },
            answer: 'No, it would take longer than a year',
            reasoning: 'The cost would be $19,950, which is more than the $16,500 earned in the first year at the higher wage.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'The payback calculation above leaves out something that costs Lena real money during the 18 months. Name it, and say how including it would change the answer to the payback question.',
            acceptableAnswerCriteria: [
              'Identifies a cost the calculation omits — most directly earnings given up if the program reduces her work hours, and reasonably also interest on borrowed tuition, transport, or childcare.',
              'States that including it raises the total cost to qualify and therefore lengthens the payback beyond 6 months.',
              'Keeps the direction of the effect correct: a larger cost cannot shorten payback.',
            ],
            evidenceRequirements: [
              'Ties the argument to at least one figure already computed — the $7,750 cost, the $16,500 annual gain, or the 6-month payback.',
            ],
            dimensions: ['assumption-identification', 'reasoning-from-figures'],
            lookFors: [
              'The response treats forgone earnings as a real cost even though no one writes a cheque for it.',
              'The response does not conclude that the certificate is therefore not worth it; the five-year figure still favours certifying.',
            ],
            commonMisconception: 'Counting only money paid out and treating income not earned during training as costing nothing.',
          },
        ],
      },
    ],
    remediation: 'If payback is being computed as cost divided by the new salary rather than by the gain, put the two salaries side by side and ask which dollars are actually new. Only the $16,500 difference is available to repay the $7,750; the other $29,500 was already being earned.',
    extension: 'Suppose Lena must cut to half her current hours during the 18 months. Compute the earnings she gives up and redo the payback in months with that cost added.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l05',
    grade: 9, unit: 1, day: 5,
    actor: 'Tobias Krause, a fictional new graduate',
    objective: 'Adjust two fictional job offers for commuting cost, commuting time, and a tuition benefit, and show that the higher-salary offer is not automatically the better one.',
    scenario: 'Tobias Krause is a fictional graduate holding two invented offers. Both employers, both salaries, and the mileage cost below are simulated for this exercise.',
    materials: ['calculator', 'the fictional offer details in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer 1 pays $41,000 and is 34 miles each way. Offer 2 pays $38,200, is 6 miles each way, and reimburses $2,500 of tuition each year. Assume 232 workdays and a driving cost of $0.28 per mile for both.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does a year of commuting to Offer 1 cost in driving expense?',
            given: { miles1: 34, days: 232, perMile: 0.28 }, expr: 'miles1 * 2 * days * perMile', format: 'usd', answer: '$4,417.28',
            reasoning: '34 miles each way is 68 miles a day; 68 x 232 days is 15,776 miles; at $0.28 per mile that is $4,417.28.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of commuting to Offer 2 cost in driving expense?',
            given: { miles2: 6, days2: 232, perMile2: 0.28 }, expr: 'miles2 * 2 * days2 * perMile2', format: 'usd', answer: '$779.52',
            reasoning: '6 miles each way is 12 miles a day; 12 x 232 days is 2,784 miles; at $0.28 per mile that is $779.52.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Adjust each salary: subtract that offer’s commuting cost, then add any tuition reimbursement.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Offer 1 worth after adjusting for commuting cost?',
            given: { salary1: 41000 }, expr: 'salary1 - #t1-p1', format: 'usd', answer: '$36,582.72',
            reasoning: '$41,000 less the $4,417.28 it costs to get there.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Offer 2 worth after adjusting for commuting cost and adding the tuition reimbursement?',
            given: { salary2: 38200, tuitionBenefit: 2500 }, expr: 'salary2 - #t1-p2 + tuitionBenefit', format: 'usd', answer: '$39,920.48',
            reasoning: '$38,200 less $779.52 of driving, plus the $2,500 of tuition the employer covers.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'After both adjustments, which offer is worth more per year?',
            choices: ['Offer 1, at $41,000', 'Offer 2, at $38,200', 'They are equal'],
            given: { s1: 41000, s2: 38200, tb: 2500 },
            decision: { left: 's1 - #t1-p1', cmp: '>', right: 's2 - #t1-p2 + tb', ifTrue: 'Offer 1, at $41,000', ifFalse: 'Offer 2, at $38,200' },
            answer: 'Offer 2, at $38,200',
            reasoning: 'Adjusted, Offer 1 is worth $36,582.72 and Offer 2 is worth $39,920.48, so the lower salary wins by $3,337.76.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Time is the non-income factor money does not capture. Offer 1’s drive takes 45 minutes each way; Offer 2’s takes 12 minutes each way.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'hours',
            text: 'How many more hours a year would Tobias spend commuting under Offer 1 than under Offer 2? Round to one decimal place.',
            given: { min1: 45, min2: 12, days3: 232 }, expr: 'round((min1 * 2 * days3 - min2 * 2 * days3) / 60, 1)', format: 'dec1', answer: '255.2',
            reasoning: 'Offer 1 costs 90 minutes a day and Offer 2 costs 24; the 66-minute daily difference over 232 days is 15,312 minutes, or 255.2 hours.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'performance-task',
        directions: 'Write your recommendation.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one offer for Tobias. Use the adjusted dollar figures and the commuting-hours figure, and name one non-income factor the numbers above do not capture at all.',
            acceptableAnswerCriteria: [
              'Recommends an offer and supports it with the adjusted figures ($36,582.72 against $39,920.48), not the headline salaries.',
              'Uses the 255.2-hour commuting difference as a cost of Offer 1 rather than mentioning it in passing.',
              'Names a factor the calculation cannot price — such as schedule control, the work itself, coworkers, job security, or what the tuition benefit lets him study — and says why it could matter.',
            ],
            evidenceRequirements: [
              'Cites at least two computed figures from this lesson, one dollar figure and the hours figure.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'A recommendation for Offer 1 can still meet the criteria if it argues the unpriced factors outweigh $3,337.76 and 255.2 hours; what is scored is whether the tradeoff is faced.',
              'The response does not claim the adjusted figures settle the question by themselves.',
            ],
            commonMisconception: 'Ranking offers by salary alone when the cost of holding the job differs between them.',
          },
        ],
      },
    ],
    remediation: 'If the mileage cost is coming out roughly half of what it should, check whether the return trip was counted. Walk one day at a time: 34 miles out, 34 miles back, 68 miles at $0.28 is $19.04 a day, and 232 of those days is $4,417.28.',
    extension: 'Find the salary Offer 1 would need in order to beat Offer 2 after both adjustments, and say whether the 255.2 extra commuting hours would still make it a close call.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l06',
    grade: 9, unit: 1, day: 6,
    actor: 'Ruth Delacroix, a fictional household budgeter',
    objective: 'Compare four fictional income sources on size and on reliability, and identify which one a monthly plan cannot safely treat as fixed.',
    scenario: 'Ruth Delacroix is a fictional adult whose simulated household income arrives from four different sources. Every amount below is invented for this comparison.',
    materials: ['calculator', 'the fictional six-month income record in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Ruth’s fictional income has four sources. Wages are $2,480 a month. Interest on a simulated savings account is $14.20 a month. Renting out a garage bay brings $150 a month. Resale income over the last 6 months was $0, $320, $85, $0, $210, and $45.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What did resale bring in over the whole six months?',
            given: { m1: 0, m2: 320, m3: 85, m4: 0, m5: 210, m6: 45 }, expr: 'm1 + m2 + m3 + m4 + m5 + m6', format: 'usd', answer: '$660.00',
            reasoning: 'The six recorded months add to $660: 0 + 320 + 85 + 0 + 210 + 45.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the average monthly resale income over those six months?',
            given: { months: 6 }, expr: '#t1-p1 / months', format: 'usd', answer: '$110.00',
            reasoning: '$660 spread over 6 months averages $110 a month.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Use the average for resale and the stated monthly figures for the other three sources.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Ruth’s average total monthly income from all four sources?',
            given: { wages: 2480, interest: 14.2, garage: 150 }, expr: 'wages + interest + garage + #t1-p2', format: 'usd', answer: '$2,754.20',
            reasoning: '$2,480 wages + $14.20 interest + $150 garage rent + $110 average resale.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage of Ruth’s average monthly income comes from wages? Round to one decimal place.',
            given: { wages2: 2480 }, expr: 'round(wages2 / #t2-p1 * 100, 1)', format: 'percent1', answer: '90.0%',
            reasoning: '$2,480 of $2,754.20 is 0.90044, or 90.0% to one decimal place.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Reliability is a separate question from size.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'Which source did the six-month record show reaching zero in at least one month?',
            choices: ['Wages', 'Interest', 'Garage rent', 'Resale'],
            given: { r1: 0, r2: 320, r3: 85, r4: 0, r5: 210, r6: 45 },
            decision: { left: 'min(r1, r2, r3, r4, r5, r6)', cmp: '==', right: '0', ifTrue: 'Resale', ifFalse: 'Garage rent' },
            answer: 'Resale',
            reasoning: 'The lowest of the six recorded resale months is $0, in the first and fourth months; the other three sources are stated as steady monthly amounts.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'In a month where resale brings in nothing, how far below the average total does Ruth’s income fall?',
            given: {}, expr: '#t1-p2', format: 'usd', answer: '$110.00',
            reasoning: 'The shortfall in a zero-resale month is exactly the average resale figure the plan assumed, $110.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'short',
            text: 'Ruth wants to commit to a fixed monthly payment. Say which of her four income sources should not be counted on to cover it, and how she could use that income instead.',
            acceptableAnswerCriteria: [
              'Identifies resale as the source that cannot back a fixed commitment, citing the two months at $0.',
              'Proposes a use suited to variable income — building a reserve, paying down a balance, or covering optional spending — rather than a fixed obligation.',
            ],
            evidenceRequirements: [
              'Cites the six-month resale record, or the $110 average against the $0 months, as the reason.',
            ],
            dimensions: ['criteria-application', 'evidence-use', 'communication-of-uncertainty'],
            lookFors: [
              'The response separates how much a source brings in from how reliably it arrives.',
              'The response does not treat the $110 average as if it were received every month.',
            ],
            commonMisconception: 'Treating an average of a variable income stream as though it were a guaranteed monthly amount.',
          },
        ],
      },
    ],
    remediation: 'If the average is being trusted as a monthly amount, lay the six resale figures in a row and mark the two zeros. Ask what a plan that spends $110 of resale money each month would do in month one and month four, before any averaging.',
    extension: 'Recompute the wage share of income if the garage tenant leaves and resale stays at its average, and say which single change would most reduce Ruth’s exposure to a bad resale month.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l07',
    grade: 9, unit: 1, day: 7,
    actor: 'Jaylen Foster, a fictional first-year worker',
    objective: 'Locate the first wrong line in a fictional budget built on gross pay, correct it, and quantify how far the error carried through the rest of the plan.',
    scenario: 'Below is a fictional monthly budget written by Jaylen Foster, a made-up worker. It contains one mistake made early and carried through. No part of it describes a real person or a real paycheck.',
    materials: ['the fictional budget as written in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'Jaylen wrote: "Gross pay $2,150 a month. That is what I have to work with. Rent $700, phone $55, car $240, food $300, savings $200. Total planned $1,495. Left over $655." His fictional employer withholds 21.4% of gross.',
        items: [
          {
            ref: 't1-p1', kind: 'choice',
            text: 'Which line of Jaylen’s budget is the first one that is wrong?',
            choices: [
              'The gross pay figure of $2,150',
              'The claim that $2,150 is what he has to work with',
              'The total planned spending of $1,495',
              'The leftover figure of $655',
            ],
            answer: 'The claim that $2,150 is what he has to work with',
            reasoning: 'The $2,150 gross figure and the $1,495 spending total are both arithmetically correct as written; the first false statement is treating gross pay as available money, and the $655 leftover is only wrong because it inherits that error.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Correct the budget from the start.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is withheld from Jaylen’s $2,150 gross pay at 21.4%?',
            given: { grossMonthly: 2150, withholdingRate: 0.214 }, expr: 'round(grossMonthly * withholdingRate, 2)', format: 'usd', answer: '$460.10',
            reasoning: '21.4% of $2,150 is exactly $460.10.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Jaylen’s actual take-home pay for the month?',
            given: { gross: 2150 }, expr: 'gross - #t2-p1', format: 'usd', answer: '$1,689.90',
            reasoning: '$2,150 gross less $460.10 withheld.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'His five planned amounts are $700, $55, $240, $300, and $200. What do they total?',
            given: { rent: 700, phone: 55, car: 240, food: 300, savings: 200 }, expr: 'rent + phone + car + food + savings', format: 'usd', answer: '$1,495.00',
            reasoning: 'The five planned lines do add to $1,495, so this part of Jaylen’s work is correct.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Work these without help.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is actually left over each month after the planned spending?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$194.90',
            reasoning: '$1,689.90 of take-home less $1,495 planned.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did Jaylen’s leftover figure of $655 overstate what he really has?',
            given: { claimedLeftover: 655 }, expr: 'claimedLeftover - #t3-p1', format: 'usd', answer: '$460.10',
            reasoning: '$655 claimed less $194.90 actual, which equals the withholding he never subtracted.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Name the misconception behind Jaylen’s error, and give a check he could run on any future budget in under a minute that would catch this same mistake.',
            acceptableAnswerCriteria: [
              'Names the misconception as treating gross pay as spendable money, rather than describing the error only as "he forgot taxes".',
              'Notes that the overstatement, $460.10, is exactly the withholding — the error propagated one-for-one into the leftover line.',
              'Gives a check that is actually runnable and would catch it, such as starting every budget from the deposit amount on the pay stub rather than the top line.',
            ],
            evidenceRequirements: [
              'Refers to the correct take-home figure of $1,689.90 or the $460.10 overstatement.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures'],
            lookFors: [
              'The check is specific enough to perform, not "be more careful".',
              'The response recognises the spending total was not itself wrong.',
            ],
            commonMisconception: 'Reading the largest number on a pay stub as the amount of money received.',
          },
        ],
      },
    ],
    remediation: 'If the learner marks the leftover line as the original error, walk the budget line by line and ask of each: is this line wrong on its own, or only because of a line above it? The leftover line is arithmetically consistent with the (false) starting figure, which is exactly what makes an early error hard to see.',
    extension: 'Rewrite Jaylen’s budget so it works on his real take-home pay while keeping his $200 savings line intact, and say which other line you cut and why.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l08',
    grade: 9, unit: 1, day: 8,
    actor: 'Simone Batiste, a fictional part-time bakery worker',
    objective: 'Apply the total-compensation method to a fictional part-time offer whose stated benefits are not all usable, and separate face value from realised value.',
    scenario: 'Simone Batiste is a fictional part-time worker at an invented bakery. The offer below, including both benefits, is simulated for this exercise.',
    materials: ['calculator', 'the fictional offer terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional offer: $17.25 an hour for 24 hours a week across 50 working weeks, plus a transit pass worth $85 a month and a gym stipend of $100 a month. Simone rides transit daily. She has said she would not use a gym.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What are Simone’s wages for the year?',
            given: { rate: 17.25, hoursPerWeek: 24, weeks: 50 }, expr: 'rate * hoursPerWeek * weeks', format: 'usd', answer: '$20,700.00',
            reasoning: '$17.25 x 24 hours x 50 weeks, which is 1,200 hours of work in the year.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the transit pass worth over a year?',
            given: { transitMonthly: 85 }, expr: 'transitMonthly * 12', format: 'usd', answer: '$1,020.00',
            reasoning: '$85 a month for twelve months.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the gym stipend worth over a year at its stated face value?',
            given: { gymMonthly: 100 }, expr: 'gymMonthly * 12', format: 'usd', answer: '$1,200.00',
            reasoning: '$100 a month for twelve months, as the offer states it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Compute the offer two ways: at face value, counting every stated benefit, and at realised value, counting only what Simone would actually use.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the offer’s total compensation at face value?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'usd', answer: '$22,920.00',
            reasoning: '$20,700 wages + $1,020 transit + $1,200 gym, counting both benefits in full.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the offer worth to Simone in realised value, given that she would not use the gym?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$21,720.00',
            reasoning: 'A benefit she would not use returns nothing to her, so only wages and the transit pass count.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the gap between the offer’s face value and its realised value?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$1,200.00',
            reasoning: 'The whole gap is the unused gym stipend.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'A second fictional bakery offers $18.90 an hour for the same 24 hours across the same 50 weeks, with no benefits at all.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What would the second bakery pay in wages for the year?',
            given: { rate2: 18.9, hours2: 24, weeks2: 50 }, expr: 'rate2 * hours2 * weeks2', format: 'usd', answer: '$22,680.00',
            reasoning: 'The second bakery pays $18.90 x 24 hours x 50 weeks, the same 1,200 hours as the first offer.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Judged on realised value, which offer is worth more to Simone?',
            choices: ['The first bakery, at $17.25 an hour', 'The second bakery, at $18.90 an hour'],
            given: {},
            decision: { left: '#t1-p1 + #t1-p2', cmp: '>', right: '#t3-p1', ifTrue: 'The first bakery, at $17.25 an hour', ifFalse: 'The second bakery, at $18.90 an hour' },
            answer: 'The second bakery, at $18.90 an hour',
            reasoning: 'The first is worth $21,720 in realised value against the second’s $22,680 — though at face value the first appears to win at $22,920.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'short',
            text: 'Comparing these two offers at face value and at realised value gives opposite answers. Explain why, and say which comparison Simone should act on.',
            acceptableAnswerCriteria: [
              'Explains that the $1,200 gym stipend counts in the face-value total but returns nothing to someone who would not use it, and that this $1,200 is larger than the $960 by which the offers otherwise differ.',
              'Concludes that realised value is the comparison to act on, because it measures what she actually receives.',
            ],
            evidenceRequirements: [
              'Uses both totals for the first offer, $22,920 face and $21,720 realised, against the second offer’s $22,680.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response identifies that the conclusion depends on Simone’s stated intention not to use a gym, which is an assumption that could change.',
              'The response applies the total-compensation method from the earlier offer comparison rather than starting over from hourly rates.',
            ],
            commonMisconception: 'Counting every listed benefit at face value regardless of whether the worker would use it.',
          },
        ],
      },
    ],
    remediation: 'If both benefits are being counted in the realised total, ask what Simone would have to spend to make the gym stipend useful. A reimbursement she would never claim puts no money in her hands, while the transit pass replaces fares she is already paying.',
    extension: 'Suppose the gym stipend were paid as cash whether or not she joined a gym. Redo the realised-value comparison and say what changed.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l09',
    grade: 9, unit: 1, day: 9,
    actor: 'Amara Whitfield, a fictional office assistant',
    objective: 'Compare two fictional pay periods that differ only by a pre-tax retirement contribution, and account for where every dollar of the take-home difference went.',
    scenario: 'Amara Whitfield is a fictional office assistant. The two simulated pay periods below are identical except that she started a retirement contribution in the second. All figures are invented.',
    materials: ['calculator', 'the two fictional pay periods in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'In both fictional periods, gross pay is $1,850 and combined tax is withheld at 18% of taxable wages. In period 1 she contributed nothing to retirement. In period 2 she contributed 5% of gross, taken out before tax is calculated.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'In period 1, how much tax is withheld?',
            given: { gross: 1850, taxRate: 0.18 }, expr: 'round(gross * taxRate, 2)', format: 'usd', answer: '$333.00',
            reasoning: 'With no pre-tax deduction, taxable wages equal gross: 18% of $1,850 is $333.00.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is her period 1 take-home pay?',
            given: { gross2: 1850 }, expr: 'gross2 - #t1-p1', format: 'usd', answer: '$1,517.00',
            reasoning: '$1,850 less $333.00 of tax, with nothing else withheld.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now work period 2. The retirement contribution comes out first, and tax is charged on what remains.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much goes into retirement in period 2, at 5% of gross?',
            given: { gross3: 1850, contribRate: 0.05 }, expr: 'gross3 * contribRate', format: 'usd', answer: '$92.50',
            reasoning: 'The contribution is a percentage of gross pay, so 5% of $1,850 is $92.50.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What are her taxable wages in period 2?',
            given: { gross4: 1850 }, expr: 'gross4 - #t2-p1', format: 'usd', answer: '$1,757.50',
            reasoning: 'A pre-tax contribution reduces the wages tax is charged on: $1,850 - $92.50.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much tax is withheld in period 2?',
            given: { taxRate2: 0.18 }, expr: 'round(#t2-p2 * taxRate2, 2)', format: 'usd', answer: '$316.35',
            reasoning: '18% of the reduced taxable wages of $1,757.50.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is her period 2 take-home pay?',
            given: { gross5: 1850 }, expr: 'gross5 - #t2-p1 - #t2-p3', format: 'usd', answer: '$1,441.15',
            reasoning: '$1,850 less the $92.50 contribution and the $316.35 of tax.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Account for the whole difference between the two periods.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much did take-home pay fall from period 1 to period 2?',
            given: {}, expr: '#t1-p2 - #t2-p4', format: 'usd', answer: '$75.85',
            reasoning: 'Period 1 take-home of $1,517.00 less period 2 take-home of $1,441.15.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'How much less tax was withheld in period 2 than in period 1?',
            given: {}, expr: '#t1-p1 - #t2-p3', format: 'usd', answer: '$16.65',
            reasoning: '$333.00 less $316.35, the tax saved by reducing taxable wages.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'USD',
            text: 'Add the fall in take-home pay to the tax saved. What figure from period 2 does the total equal?',
            given: {}, expr: '#t3-p1 + #t3-p2', format: 'usd', answer: '$92.50',
            reasoning: '$75.85 + $16.65 = $92.50, exactly the retirement contribution: every dollar is accounted for as either less cash in hand or less tax.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Amara set aside $92.50 but her take-home pay fell by less than that. Explain where the rest came from, and state one thing the $92.50 costs her that the arithmetic above does not show.',
            acceptableAnswerCriteria: [
              'Explains that $16.65 of the contribution was funded by the reduction in tax, because the pre-tax contribution lowered taxable wages from $1,850 to $1,757.50.',
              'States that the money is not gone but moved into a retirement account, so this is a shift between uses rather than a loss.',
              'Names a real cost the arithmetic omits, most directly that the $92.50 is not available to spend now and is generally not withdrawable without conditions.',
            ],
            evidenceRequirements: [
              'Uses the three period-2 figures — the $92.50 contribution, the $75.85 fall in take-home, and the $16.65 tax saving — and shows they reconcile.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'assumption-identification'],
            lookFors: [
              'The response says the tax saving depends on the contribution being pre-tax; a post-tax contribution would have cut take-home by the full $92.50.',
              'The response does not present the tax saving as free money.',
            ],
            commonMisconception: 'Expecting take-home pay to fall by the full contribution amount, or treating the tax saving as a gain rather than as part of the money already set aside.',
          },
        ],
      },
    ],
    remediation: 'If period 2 is coming out with tax on the full $1,850, mark the order of operations on the stub: contribution first, then tax on what is left. Compute the two taxable-wage figures side by side, $1,850 and $1,757.50, before any tax is applied.',
    extension: 'Recompute period 2 with the contribution taken after tax instead of before, and state exactly how much the pre-tax treatment was worth.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u01-l10',
    grade: 9, unit: 1, day: 10,
    actor: 'three fictional entry-level roles in a simulated regional job board',
    objective: 'Build an income profile for three fictional entry-level roles — total compensation, cost to qualify, and months to recoup that cost — and defend a recommendation from the profiles.',
    scenario: 'A fictional regional job board lists the three invented entry-level roles below. No employer, wage, or program named here is real.',
    materials: ['calculator', 'the fictional role listings in these directions', 'a blank three-column table for the income profiles'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'All three fictional roles are full time at 2,080 hours a year. Role 1, warehouse operations associate: $19.10 an hour, benefits worth $4,100 a year, 3 weeks of on-the-job training at no cost. Role 2, pharmacy technician: $21.40 an hour, benefits worth $5,250, a 9-month program costing $3,900. Role 3, wind turbine technician: $27.65 an hour, benefits worth $6,800, a 24-month program costing $18,400.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Role 1’s total annual compensation, counting wages and benefits?',
            given: { rate1: 19.1, hoursYear: 2080, benefits1: 4100 }, expr: 'rate1 * hoursYear + benefits1', format: 'usd', answer: '$43,828.00',
            reasoning: '$19.10 x 2,080 hours is $39,728 in wages, plus $4,100 of benefits.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Role 2’s total annual compensation?',
            given: { rate2: 21.4, hoursYear2: 2080, benefits2: 5250 }, expr: 'rate2 * hoursYear2 + benefits2', format: 'usd', answer: '$49,762.00',
            reasoning: '$21.40 x 2,080 hours is $44,512 in wages, plus $5,250 of benefits.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Role 3’s total annual compensation?',
            given: { rate3: 27.65, hoursYear3: 2080, benefits3: 6800 }, expr: 'rate3 * hoursYear3 + benefits3', format: 'usd', answer: '$64,312.00',
            reasoning: '$27.65 x 2,080 hours is $57,512 in wages, plus $6,800 of benefits.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Role 1 requires no paid training, so use it as the baseline. For each of the other two roles, find the annual gain over Role 1 and how many months of that gain repay the program cost.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'How many months does Role 2’s gain over Role 1 take to repay its $3,900 program cost? Round to the nearest month.',
            given: { cost2: 3900 }, expr: 'round(cost2 / (#t1-p2 - #t1-p1) * 12, 0)', format: 'months0', answer: '8',
            reasoning: 'Role 2 gains $5,934 a year over Role 1; $3,900 / $5,934 of a year is 7.89 months, which rounds to 8.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'How many months does Role 3’s gain over Role 1 take to repay its $18,400 program cost? Round to the nearest month.',
            given: { cost3: 18400 }, expr: 'round(cost3 / (#t1-p3 - #t1-p1) * 12, 0)', format: 'months0', answer: '11',
            reasoning: 'Role 3 gains $20,484 a year over Role 1; $18,400 / $20,484 of a year is 10.78 months, which rounds to 11.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'months',
            text: 'Counting the 24 months of Role 3’s program before any of that pay begins, how long from starting the program until the $18,400 is repaid?',
            given: { programMonths3: 24 }, expr: 'programMonths3 + #t2-p2', format: 'months0', answer: '35',
            reasoning: '24 months of training with no gain, then the 11 months of higher pay that repay the cost.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the recommendation. Use your three completed income profiles.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one of the three fictional roles for someone who needs steady income within six months, and defend it against the role with the highest total compensation.',
            acceptableAnswerCriteria: [
              'Recommends a role and grounds it in the six-month constraint, not only in total compensation.',
              'Faces the strongest counter-argument directly: Role 3 pays $20,484 a year more than Role 1 but cannot deliver any income for 24 months.',
              'Uses the recoup figures — 8 months for Role 2, 35 months from enrolment for Role 3 — rather than comparing program costs alone.',
            ],
            evidenceRequirements: [
              'Cites at least one total-compensation figure and at least one recoup figure computed in this lesson.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response treats the six-month constraint as binding rather than mentioning it and then choosing on pay.',
              'A recommendation of Role 2 must acknowledge that its 9-month program also breaks the six-month constraint; only Role 1 satisfies it outright.',
            ],
            commonMisconception: 'Ranking career paths by their eventual pay while ignoring how long the person has to survive on nothing.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'State one figure in your three income profiles that you are least confident in, and say what would change your recommendation if it were wrong.',
            acceptableAnswerCriteria: [
              'Names a specific figure from the profiles rather than expressing general uncertainty.',
              'Says concretely how the recommendation would change if that figure were different, including the direction and rough size of change that would matter.',
            ],
            evidenceRequirements: [
              'Refers to a specific computed figure from this lesson by value.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The response identifies an assumption that is actually load-bearing, such as the 2,080-hour full-time year or the benefit valuations.',
              'The response does not simply say all the numbers are made up.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the recoup months are coming out implausibly small or large, check that the divisor is the gain over Role 1 and not the role’s whole compensation. Write the subtraction explicitly first ($49,762 - $43,828 = $5,934) before dividing the program cost by it.',
    extension: 'Add a fourth fictional role paying $24.00 an hour with $5,000 of benefits and a 6-month, $2,200 program, and place it in the ranking by recoup time from enrolment.',
  },
]
