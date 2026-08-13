import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 1 — PF1 Earning Income: Compensation Packages and Career
 * Pathways.
 */
export const g10u01: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u01-l01',
    grade: 10, unit: 1, day: 1,
    actor: 'a fictional candidate holding one detailed offer',
    objective: 'Build the full total-compensation figure for a fictional offer from salary, bonus, retirement match, employer health contribution, and paid leave, and express salary as a share of it.',
    scenario: 'A fictional candidate receives the simulated offer below from an invented employer. Every figure is fictional and no real employer or offer is described.',
    materials: ['calculator', 'the fictional offer summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional offer: salary $52,000; a target bonus of 4% of salary; a retirement match of 4% of salary; an employer health contribution of $6,900; and 15 paid days off. Assume a 260-day work year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the target bonus worth?',
            given: { salary: 52000, bonusRate: 0.04 }, expr: 'salary * bonusRate', format: 'usd', answer: '$2,080.00',
            reasoning: '4% of the $52,000 salary, though a target bonus is a stated aim rather than a guaranteed payment.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of salary, bonus, retirement match, and health contribution?',
            given: { salary2: 52000, matchRate: 0.04, health: 6900 },
            expr: 'salary2 + #t1-p1 + salary2 * matchRate + health', format: 'usd', answer: '$63,060.00',
            reasoning: '$52,000 salary + $2,080 bonus + $2,080 match + $6,900 of employer health contribution.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What are the 15 paid days off worth at the salary’s daily rate?',
            given: { salary3: 52000, workYear: 260, paidDays: 15 }, expr: 'round(salary3 / workYear * paidDays, 2)', format: 'usd', answer: '$3,000.00',
            reasoning: 'A day of this salary is $52,000 / 260 = $200.00, and 15 of them come to $3,000.00.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put the whole package together.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is total compensation including the paid leave?',
            given: {}, expr: '#t1-p2 + #t1-p3', format: 'usd', answer: '$66,060.00',
            reasoning: '$63,060.00 of cash and employer contributions plus $3,000.00 of paid leave.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage of total compensation is the salary line? Round to one decimal place.',
            given: { salary4: 52000 }, expr: 'round(salary4 / #t2-p1 * 100, 1)', format: 'percent1', answer: '78.7%',
            reasoning: '$52,000 of a $66,060 package is 0.78716, so more than a fifth of the offer sits outside the salary line.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the package is not salary?',
            given: { salary5: 52000 }, expr: '#t2-p1 - salary5', format: 'usd', answer: '$14,060.00',
            reasoning: '$66,060.00 total less the $52,000 salary line.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Not all $14,060 of non-salary compensation is equally certain or equally useful. Rank the four non-salary components by how confident the candidate should be in each, and explain the ranking.',
            acceptableAnswerCriteria: [
              'Identifies the target bonus as the least certain, because a target is not a promise and the $2,080 may not be paid in full.',
              'Notes that the retirement match at $2,080 usually requires the employee to contribute to receive it, and may vest over time, so it is conditional in a different way.',
              'Treats the $6,900 health contribution and the $3,000 of paid leave as the most reliable, while noting the health figure is only worth its face value to someone who needs that coverage.',
            ],
            evidenceRequirements: [
              'Uses all four non-salary figures: $2,080, $2,080, $6,900, and $3,000.',
            ],
            dimensions: ['assumption-identification', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes conditional on performance, conditional on the employee acting, and unconditional.',
              'The response does not discount the whole $14,060 simply because parts of it are conditional.',
            ],
            commonMisconception: 'Adding every listed benefit into total compensation at face value without asking what each one is conditional on.',
          },
        ],
      },
    ],
    remediation: 'If total compensation comes out near $52,000, only the salary has been counted. List the five components in a column and tick each as it is added, checking that the bonus and match are both computed from salary rather than from the running total.',
    extension: 'Recompute total compensation if the bonus pays out at half its target and the match requires a 4% employee contribution the candidate cannot afford, and state the realistic figure.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l02',
    grade: 10, unit: 1, day: 2,
    actor: 'a fictional employee pricing a benefits package',
    objective: 'Value the three main benefit categories of a fictional package separately, compute the benefit load as a percentage of salary, and identify what each benefit is conditional on.',
    scenario: 'The simulated benefits package below belongs to a fictional employer. Every premium, match, and leave figure is invented for this exercise.',
    materials: ['calculator', 'the fictional benefits summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional package, on a $52,000 salary and a 260-day work year. Health: the total premium is $9,200 a year and the employer pays $6,900 of it. Retirement: the employer matches 4% of salary, but only if the employee also contributes 4%. Leave: 15 paid days off plus 8 paid holidays.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the health premium does the employee pay?',
            given: { premium: 9200, employerShare: 6900 }, expr: 'premium - employerShare', format: 'usd', answer: '$2,300.00',
            reasoning: 'The $9,200 total premium less the $6,900 the employer contributes.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is one paid day worth at this salary?',
            given: { salary: 52000, workYear: 260 }, expr: 'salary / workYear', format: 'usd', answer: '$200.00',
            reasoning: '$52,000 spread across a 260-day work year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What are the 23 paid days — 15 off plus 8 holidays — worth?',
            given: { totalPaidDays: 23 }, expr: '#t1-p2 * totalPaidDays', format: 'usd', answer: '$4,600.00',
            reasoning: '23 days at the $200.00 daily rate.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now total the employer-funded benefits and measure them against salary.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the employer-funded benefits total — health contribution, full retirement match, and paid leave?',
            given: { employerHealth: 6900, salary2: 52000, matchRate: 0.04 },
            expr: 'employerHealth + salary2 * matchRate + #t1-p3', format: 'usd', answer: '$13,580.00',
            reasoning: '$6,900 health + $2,080 match + $4,600 of paid leave.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the benefit load — employer-funded benefits as a percentage of salary? Round to one decimal place.',
            given: { salary3: 52000 }, expr: 'round(#t2-p1 / salary3 * 100, 1)', format: 'percent1', answer: '26.1%',
            reasoning: '$13,580 of benefits on a $52,000 salary is 0.26115, or 26.1%.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the employee have to contribute in the year to receive the full match and their share of the premium?',
            given: { salary4: 52000, matchRate2: 0.04 }, expr: 'salary4 * matchRate2 + #t1-p1', format: 'usd', answer: '$4,380.00',
            reasoning: '$2,080 of retirement contribution to unlock the match plus $2,300 of health premium share.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'An employee who cannot spare the $2,080 retirement contribution loses the $2,080 match. Explain what that means about how the benefit load figure should be read, and say what an employee in that position should weigh.',
            acceptableAnswerCriteria: [
              'States that the 26.1% benefit load assumes the employee takes up everything, and an employee who cannot contribute receives $11,500 rather than $13,580.',
              'Identifies the match as a 100% return on the contribution in the year it is made, which is why it is usually the first call on available money.',
              'Notes the constraint honestly: an employee who genuinely cannot spare $2,080 is not being irrational, and the alternative uses of that money have to be weighed.',
            ],
            evidenceRequirements: [
              'Uses the $2,080 match, the $13,580 benefit total, and the 26.1% load figure.',
            ],
            dimensions: ['reasoning-from-figures', 'tradeoff-defense', 'assumption-identification'],
            lookFors: [
              'The response treats the match as conditional rather than as part of the offer received automatically.',
              'The response does not tell the employee what to do with their own money.',
            ],
            commonMisconception: 'Reading a published benefit load as the value every employee actually receives.',
          },
        ],
      },
    ],
    remediation: 'If the benefit load exceeds 100%, salary has probably been included in the numerator. The load measures employer-funded benefits against salary, so the $52,000 belongs only underneath.',
    extension: 'Recompute the benefit load for an employee on the same package at a $78,000 salary, and say why the percentage moves even though the health contribution does not.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l03',
    grade: 10, unit: 1, day: 3,
    actor: 'a fictional school-leaver comparing three training pathways',
    objective: 'Compute the full cost of three fictional pathways including earnings given up, and find how long each takes to repay against a stated baseline.',
    scenario: 'A fictional school-leaver could work now at $32,000 a year or take one of three invented pathways. Every cost, duration, and wage below is fictional.',
    materials: ['calculator', 'the fictional pathway table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The baseline is working now at $32,000 a year. Pathway A, a certificate: 14 months, tuition $9,400, earning $12,000 a year during it, then $44,000. Pathway B, an apprenticeship: 36 months, no tuition, earning $28,000 a year during it, then $58,000. Pathway C, a degree: 48 months, tuition $46,000, earning $8,000 a year during it, then $67,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What earnings does Pathway A give up against the baseline over its 14 months?',
            given: { baseline: 32000, duringA: 12000, monthsA: 14 }, expr: 'round((baseline - duringA) * monthsA / 12, 2)', format: 'usd', answer: '$23,333.33',
            reasoning: '$20,000 a year of forgone earnings over 14 months, a real cost even though nobody bills for it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Pathway A’s full cost, tuition plus forgone earnings?',
            given: { tuitionA: 9400 }, expr: 'tuitionA + #t1-p1', format: 'usd', answer: '$32,733.33',
            reasoning: '$9,400 of tuition plus $23,333.33 of earnings given up.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Pathway C’s full cost?',
            given: { tuitionC: 46000, baseline2: 32000, duringC: 8000, monthsC: 48 },
            expr: 'tuitionC + (baseline2 - duringC) * monthsC / 12', format: 'usd', answer: '$142,000.00',
            reasoning: '$46,000 of tuition plus four years of giving up $24,000 a year against the baseline.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find how long the higher wage takes to repay each pathway’s full cost, measured against the $32,000 baseline.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'years',
            text: 'How many years does Pathway A take to repay its cost? Round to two decimal places.',
            given: { afterA: 44000, baseline3: 32000 }, expr: 'round(#t1-p2 / (afterA - baseline3), 2)', format: 'dec2', answer: '2.73',
            reasoning: '$32,733.33 of cost against a $12,000 annual gain over the baseline.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'years',
            text: 'How many years does Pathway B take to repay its cost? Round to two decimal places.',
            given: { baseline4: 32000, duringB: 28000, monthsB: 36, afterB: 58000 },
            expr: 'round((baseline4 - duringB) * monthsB / 12 / (afterB - baseline4), 2)', format: 'dec2', answer: '0.46',
            reasoning: 'Pathway B costs only $12,000 of forgone earnings and gains $26,000 a year, so it repays in under six months of the higher wage.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'years',
            text: 'How many years does Pathway C take to repay its cost? Round to two decimal places.',
            given: { afterC: 67000, baseline5: 32000 }, expr: 'round(#t1-p3 / (afterC - baseline5), 2)', format: 'dec2', answer: '4.06',
            reasoning: '$142,000 of cost against a $35,000 annual gain.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Pathway B repays fastest and Pathway C ends at the highest wage. Explain why the payback figures do not settle the choice on their own, and name what a 20-year view would add.',
            acceptableAnswerCriteria: [
              'States that payback measures how quickly a cost is recovered, not how large the eventual gain is, so it favours cheap pathways over valuable ones.',
              'Notes that Pathway C ends $9,000 a year above Pathway B, which compounds over a career even though it repays 3.6 years later.',
              'Says what a 20-year view adds: total earnings across the whole period rather than the moment the cost is cleared.',
            ],
            evidenceRequirements: [
              'Uses at least two payback figures and the ending wages they come from.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response notes the ending wages are assumptions about a future labour market, not guarantees.',
              'The response does not treat the fastest payback as automatically the best pathway.',
            ],
            commonMisconception: 'Ranking education and training pathways by payback period, which systematically favours the cheapest option.',
          },
        ],
      },
    ],
    remediation: 'If Pathway B appears to cost nothing, note that it still gives up $4,000 a year against the baseline for three years. Zero tuition is not zero cost when the alternative pays more during the same period.',
    extension: 'Compute total earnings over 20 years from the start of each pathway, counting the during-pathway years at their stated wages, and say whether the ranking changes.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l04',
    grade: 10, unit: 1, day: 4,
    actor: 'a fictional researcher reading occupational data',
    objective: 'Read a fictional labour market information table, compute wage spread and ratio measures from it, and say what the median alone conceals.',
    scenario: 'The simulated occupational data below is invented for this exercise and does not describe any real occupation or published statistic.',
    materials: ['calculator', 'the fictional occupational data table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Occupation X: median wage $48,300; 10th percentile $33,100; 90th percentile $71,900; about 4,200 openings a year; projected growth 6%. Occupation Y: median wage $61,200; 10th percentile $39,800; 90th percentile $96,400; about 850 openings a year; projected growth -2%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the wage spread for Occupation X — the 90th percentile less the 10th?',
            given: { p90X: 71900, p10X: 33100 }, expr: 'p90X - p10X', format: 'usd', answer: '$38,800.00',
            reasoning: '$71,900 less $33,100, the range covering the middle four-fifths of workers in the occupation.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the wage spread for Occupation Y?',
            given: { p90Y: 96400, p10Y: 39800 }, expr: 'p90Y - p10Y', format: 'usd', answer: '$56,600.00',
            reasoning: 'Occupation Y’s 90th percentile of $96,400 less its 10th percentile of $39,800.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'What is the ratio of the 90th percentile to the 10th for Occupation Y? Round to two decimal places.',
            given: { p90Y2: 96400, p10Y2: 39800 }, expr: 'round(p90Y2 / p10Y2, 2)', format: 'dec2', answer: '2.42',
            reasoning: 'A worker at the 90th percentile earns 2.42 times one at the 10th, which measures dispersion independently of the wage level.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two occupations on more than the median.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much higher is Occupation Y’s median?',
            given: { medY: 61200, medX: 48300 }, expr: 'medY - medX', format: 'usd', answer: '$12,900.00',
            reasoning: 'Occupation Y’s median of $61,200 against Occupation X’s median of $48,300.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much higher is Occupation X’s 10th percentile than nothing at all — that is, what does a worker at the bottom of Occupation X earn compared with the bottom of Occupation Y?',
            given: { p10X2: 33100, p10Y3: 39800 }, expr: 'p10Y3 - p10X2', format: 'usd', answer: '$6,700.00',
            reasoning: 'Occupation Y pays $6,700 more at the 10th percentile too, so its advantage is not confined to the top.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which occupation offers more realistic chances of entry in a given year?',
            choices: ['Occupation X', 'Occupation Y', 'The data does not address entry chances'],
            given: { openingsX: 4200, openingsY: 850 },
            decision: { left: 'openingsX', cmp: '>', right: 'openingsY', ifTrue: 'Occupation X', ifFalse: 'Occupation Y' },
            answer: 'Occupation X',
            reasoning: '4,200 openings a year against 850, and Occupation X is growing 6% while Occupation Y is contracting 2%.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Someone reading only the medians would prefer Occupation Y by $12,900. Say what the rest of the table adds to that picture, and what a person entering the field should probably expect to earn at first.',
            acceptableAnswerCriteria: [
              'Notes that a new entrant is far more likely to start near the 10th percentile than the median, which is $33,100 in X and $39,800 in Y.',
              'Brings in the openings and growth figures: 4,200 growing openings against 850 shrinking ones changes the chance of entering the occupation at all.',
              'States that Occupation Y’s wider spread of $56,600 means the median is a weaker guide to any individual’s outcome there.',
            ],
            evidenceRequirements: [
              'Uses at least one percentile figure, one openings figure, and one growth figure.',
            ],
            dimensions: ['evidence-use', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response treats the median as the middle of a distribution rather than as the wage the occupation pays.',
              'The response does not conclude that Occupation X is simply better; the wage advantage of Y is real at every percentile shown.',
            ],
            commonMisconception: 'Reading a median wage as what someone entering an occupation will earn.',
          },
        ],
      },
    ],
    remediation: 'If the two occupations look interchangeable, put the four percentile figures on one line in order: $33,100, $39,800, $48,300, $61,200, $71,900, $96,400. The overlap between the two distributions is what the medians hide.',
    extension: 'Compute the 90th-to-10th ratio for Occupation X, compare it with Y’s 2.42, and say what a higher ratio tells a person about how much outcomes within one occupation vary.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l05',
    grade: 10, unit: 1, day: 5,
    actor: 'a fictional candidate weighing schedule, stability, and location',
    objective: 'Adjust two fictional offers for commuting cost, then weigh schedule and contract stability that no dollar figure captures.',
    scenario: 'A fictional candidate holds two simulated offers that differ in pay, shift pattern, contract type, and distance. All figures are invented for this exercise.',
    materials: ['calculator', 'the two fictional offers in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer P: $49,000, rotating night shift, a 1-year contract, 41 miles each way. Offer Q: $45,500, fixed daytime hours, a permanent position, 7 miles each way. Assume 235 workdays and a driving cost of $0.31 a mile for both.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does a year of commuting to Offer P cost?',
            given: { milesP: 41, days: 235, perMile: 0.31 }, expr: 'round(milesP * 2 * days * perMile, 2)', format: 'usd', answer: '$5,973.70',
            reasoning: '82 miles a day over 235 days is 19,270 miles, at $0.31 a mile.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of commuting to Offer Q cost?',
            given: { milesQ: 7, days2: 235, perMile2: 0.31 }, expr: 'round(milesQ * 2 * days2 * perMile2, 2)', format: 'usd', answer: '$1,019.90',
            reasoning: '14 miles a day over 235 days is 3,290 miles, at $0.31 a mile.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Offer P worth after commuting cost?',
            given: { payP: 49000 }, expr: 'round(payP - #t1-p1, 2)', format: 'usd', answer: '$43,026.30',
            reasoning: '$49,000 less $5,973.70 of driving.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Finish the adjustment and compare.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Offer Q worth after commuting cost?',
            given: { payQ: 45500 }, expr: 'round(payQ - #t1-p2, 2)', format: 'usd', answer: '$44,480.10',
            reasoning: '$45,500 less $1,019.90 of driving.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'After adjusting for commuting cost alone, which offer is worth more?',
            choices: ['Offer P, at $49,000', 'Offer Q, at $45,500'],
            given: {},
            decision: { left: '#t1-p3', cmp: '>', right: '#t2-p1', ifTrue: 'Offer P, at $49,000', ifFalse: 'Offer Q, at $45,500' },
            answer: 'Offer Q, at $45,500',
            reasoning: '$44,480.10 against $43,026.30 — the $3,500 salary advantage of Offer P is more than consumed by $4,953.80 of extra driving.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does Offer Q lead after the adjustment?',
            given: {}, expr: '#t2-p1 - #t1-p3', format: 'usd', answer: '$1,453.80',
            reasoning: '$44,480.10 against $43,026.30.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Two differences between these offers have no dollar figure at all: rotating nights against fixed days, and a 1-year contract against a permanent position. Explain what each could cost, and say whether either could reverse the $1,453.80 result.',
            acceptableAnswerCriteria: [
              'Describes a concrete cost of rotating night work — sleep, health, childcare, and the difficulty of holding other commitments — rather than calling it merely unpleasant.',
              'Describes what a 1-year contract exposes the candidate to: a job search a year from now, and the income gap if the next role does not start immediately.',
              'Reaches a defensible view on whether either could outweigh $1,453.80, and says what it would take to price them.',
            ],
            evidenceRequirements: [
              'Uses the $1,453.80 adjusted difference as the amount the unpriced factors would have to outweigh.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response notices the two unpriced factors both favour Offer Q, so they widen rather than close the gap.',
              'The response does not treat "unpriced" as meaning "unimportant" or as meaning "decisive".',
            ],
            commonMisconception: 'Assuming that factors without a dollar figure can be set aside in a financial comparison.',
          },
        ],
      },
    ],
    remediation: 'If the two commuting figures come out close together, check the mileage: 41 miles each way is nearly six times 7 miles, and the return trip doubles both. Compute the daily cost for each before annualising.',
    extension: 'Find the salary Offer P would need in order to lead by $2,000 after the commuting adjustment, and say whether that changes how the unpriced factors should be weighed.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l06',
    grade: 10, unit: 1, day: 6,
    actor: 'a fictional freelancer comparing self-employment with employment',
    objective: 'Compute what a fictional freelancer actually keeps after business expenses, self-employment tax, and self-funded health cover, and compare it with a fictional employed alternative.',
    scenario: 'A fictional freelancer and a fictional employee are compared below. Every figure, including the simplified tax treatment, is invented for this exercise.',
    materials: ['calculator', 'the two fictional income situations in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional freelancer invoices $41,000 a year and has $7,400 of business expenses. Under the simplified fictional rule used here, self-employment tax is 15.3% of net business income. Health cover bought individually costs $5,400 a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the freelancer’s net business income after expenses?',
            given: { revenue: 41000, expenses: 7400 }, expr: 'revenue - expenses', format: 'usd', answer: '$33,600.00',
            reasoning: '$41,000 invoiced less $7,400 of business expenses — the figure tax is charged on, not the invoiced total.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the self-employment tax under the simplified fictional rule?',
            given: { seRate: 0.153 }, expr: 'round(#t1-p1 * seRate, 2)', format: 'usd', answer: '$5,140.80',
            reasoning: '15.3% of $33,600 — roughly double an employee’s payroll tax, because the freelancer pays both halves.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the freelancer keep after self-employment tax and health cover?',
            given: { health: 5400 }, expr: 'round(#t1-p1 - #t1-p2 - health, 2)', format: 'usd', answer: '$23,059.20',
            reasoning: '$33,600 less $5,140.80 of tax and $5,400 of self-funded health cover, before any income tax.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The fictional employed alternative pays $38,000, with the employer paying half the payroll tax so the employee pays 7.65%, and providing health cover worth $6,900.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the employee keep after their payroll tax?',
            given: { salary: 38000, employeeRate: 0.0765 }, expr: 'round(salary - salary * employeeRate, 2)', format: 'usd', answer: '$35,093.00',
            reasoning: '$38,000 less $2,907.00 of payroll tax, before income tax, and with health cover already provided.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much better off is the employee before counting the health benefit?',
            given: {}, expr: '#t2-p1 - #t1-p3', format: 'usd', answer: '$12,033.80',
            reasoning: '$35,093.00 against $23,059.20, on invoiced revenue $3,000 above the salary.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the freelancer need to invoice to match the employee’s position, treating the $6,900 health benefit as part of what the employee receives? Give the shortfall the freelancer must close.',
            given: { healthBenefit: 6900 }, expr: '#t2-p1 + healthBenefit - #t1-p3', format: 'usd', answer: '$18,933.80',
            reasoning: 'The employee’s $35,093.00 plus $6,900 of employer-funded health against the freelancer’s $23,059.20.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The freelancer invoices $3,000 more than the employee earns and ends up far behind. Explain where the gap comes from, and name two things the freelancer gets that this comparison does not price.',
            acceptableAnswerCriteria: [
              'Attributes the gap to three specific things: $7,400 of expenses, the doubled payroll tax at $5,140.80, and $5,400 of health cover the employer would otherwise fund.',
              'Notes that invoiced revenue is not income, which is the error the comparison is built to expose.',
              'Names two genuine unpriced advantages of self-employment — control over schedule and clients, the ability to scale revenue, deductibility of business costs — without claiming they close the $18,933.80 gap.',
            ],
            evidenceRequirements: [
              'Uses the $41,000 invoiced, the $33,600 net, and at least one of the two deductions from it.',
            ],
            dimensions: ['reasoning-from-figures', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not conclude that self-employment is simply worse; it identifies what has to be true for it to work.',
              'The response recognises the freelancer also bears income tax, which neither figure includes.',
            ],
            commonMisconception: 'Comparing self-employed revenue with an employee salary as though they were the same kind of number.',
          },
        ],
      },
    ],
    remediation: 'If the freelancer looks ahead, check whether the comparison started from $41,000 rather than $33,600. Revenue is what comes in; income is what is left after the costs of producing it, and only the second is comparable with a salary.',
    extension: 'Recompute the freelancer’s position with $2,200 of expenses instead of $7,400 and no health cover purchased, and say what each change assumes about their circumstances.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l07',
    grade: 10, unit: 1, day: 7,
    actor: 'a fictional candidate who compared two offers on salary alone',
    objective: 'Find the error in a fictional offer comparison made on salary alone, rebuild it on cash the candidate would actually hold, and quantify how far wrong the original went.',
    scenario: 'A fictional candidate wrote: "Offer 1 pays $54,000 and Offer 2 pays $50,500, so Offer 1 is $3,500 better." The two simulated offers are set out in full below.',
    materials: ['the two fictional offers in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'Offer 1: salary $54,000, no retirement match, and the employee pays the whole $8,400 health premium. Offer 2: salary $50,500, a retirement match of 5% of salary, and the employer pays all but $1,300 of the health premium.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Offer 1 leave in cash after the health premium?',
            given: { salary1: 54000, premium1: 8400 }, expr: 'salary1 - premium1', format: 'usd', answer: '$45,600.00',
            reasoning: '$54,000 less the full $8,400 premium the employee must pay.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Offer 2’s retirement match worth?',
            given: { salary2: 50500, matchRate: 0.05 }, expr: 'salary2 * matchRate', format: 'usd', answer: '$2,525.00',
            reasoning: 'Offer 2 matches 5% of salary, and 5% of $50,500 is $2,525.00.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now build Offer 2 on the same basis.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Offer 2 provide in cash after the health premium, plus the match?',
            given: { salary3: 50500, premium2: 1300 }, expr: 'salary3 - premium2 + #t1-p2', format: 'usd', answer: '$51,725.00',
            reasoning: '$50,500 less the $1,300 employee premium share, plus $2,525 of match.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'On this basis, how much better is Offer 2 than Offer 1?',
            given: {}, expr: '#t2-p1 - #t1-p1', format: 'usd', answer: '$6,125.00',
            reasoning: '$51,725.00 against $45,600.00 — the opposite direction from the candidate’s conclusion.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'The candidate said Offer 1 was $3,500 better. How far wrong was that, in dollars?',
            given: { claimed: 3500 }, expr: '#t2-p2 + claimed', format: 'usd', answer: '$9,625.00',
            reasoning: 'The candidate had Offer 1 ahead by $3,500 when Offer 2 is ahead by $6,125, so the conclusion is wrong by the sum of the two.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Name the error precisely.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'What did the candidate’s comparison leave out?',
            choices: [
              'The salaries; the two figures are wrong',
              'Two employer-funded items and one employee-paid item that differ sharply between the offers',
              'Income tax, which differs between the two',
              'Nothing; $3,500 is the correct difference',
            ],
            answer: 'Two employer-funded items and one employee-paid item that differ sharply between the offers',
            reasoning: 'The salary figures are correct, and the arithmetic on them is correct; what is missing is the $2,525 match and the $7,100 difference in who pays the health premium.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the checklist you would run on any two offers to avoid this error, and explain why the health premium mattered more here than the retirement match.',
            acceptableAnswerCriteria: [
              'Gives a short, runnable checklist covering salary, employer retirement contribution, who pays how much of the health premium, paid leave, and any bonus.',
              'Explains that the health premium difference is $7,100 against the match’s $2,525, so the item nobody thinks of as compensation carried most of the reversal.',
              'Notes that the health premium appears as a cost to the employee rather than as a benefit, which is why it is easy to leave out of a comparison.',
            ],
            evidenceRequirements: [
              'Uses the $8,400 and $1,300 premium figures and the $2,525 match.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The checklist is short enough to actually use.',
              'The response recognises the match is conditional on the employee contributing, so $51,725 assumes they do.',
            ],
            commonMisconception: 'Comparing offers on the number the offer letter leads with.',
          },
        ],
      },
    ],
    remediation: 'If the two offers still look close, write four lines for each: salary, employer retirement contribution, employee premium share, and the total. The premium line is the one most often left blank, and here it is worth $7,100.',
    extension: 'Find the Offer 1 salary that would make the two offers equal on this basis, and say whether an employer would plausibly pay it.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l08',
    grade: 10, unit: 1, day: 8,
    actor: 'a fictional worker comparing gig work with an employed role',
    objective: 'Apply the benefits-valuation method to a fictional gig arrangement that provides none, and compare the two on a per-hour basis.',
    scenario: 'A fictional worker can take gig work at an hourly rate or an employed role at a lower rate with benefits. Every figure below is invented for this exercise.',
    materials: ['calculator', 'the two fictional arrangements in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The gig work pays $26 an hour with no benefits, and realistically supports 1,300 paid hours a year. The employed role pays $21 an hour for 2,080 hours, with benefits the employer values at $11,200.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the gig work pay over a year?',
            given: { gigRate: 26, gigHours: 1300 }, expr: 'gigRate * gigHours', format: 'usd', answer: '$33,800.00',
            reasoning: '$26 an hour for the 1,300 hours the work realistically supports, not for a full-time year.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the employed role pay in wages over a year?',
            given: { empRate: 21, empHours: 2080 }, expr: 'empRate * empHours', format: 'usd', answer: '$43,680.00',
            reasoning: 'The employed role pays $21 an hour across a full-time year of 2,080 hours.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the employed role worth in total compensation?',
            given: { benefits: 11200 }, expr: '#t1-p2 + benefits', format: 'usd', answer: '$54,880.00',
            reasoning: '$43,680 of wages plus $11,200 of employer-valued benefits.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put both on a per-hour basis.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the employed role worth per hour, counting benefits? Round to the nearest cent.',
            given: { empHours2: 2080 }, expr: 'round(#t1-p3 / empHours2, 2)', format: 'usd', answer: '$26.38',
            reasoning: '$54,880 across 2,080 hours — slightly more per hour than the gig rate that looked $5 higher.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'On a per-hour basis including benefits, which arrangement pays more?',
            choices: ['The gig work, at $26 an hour', 'The employed role, at $21 an hour'],
            given: { gigRate2: 26 },
            decision: { left: 'gigRate2', cmp: '>', right: '#t2-p1', ifTrue: 'The gig work, at $26 an hour', ifFalse: 'The employed role, at $21 an hour' },
            answer: 'The employed role, at $21 an hour',
            reasoning: '$26.38 an hour of total compensation against $26.00, reversing a headline gap of $5 an hour.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does the employed role provide over the year in total?',
            given: {}, expr: '#t1-p3 - #t1-p1', format: 'usd', answer: '$21,080.00',
            reasoning: '$54,880 against $33,800, driven by both the benefits and the 780 extra paid hours.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The per-hour comparison is nearly a tie and the annual comparison is not close at all. Explain why the two comparisons disagree, and say which one a person choosing between these should use.',
            acceptableAnswerCriteria: [
              'Explains that the per-hour figures are close because the benefits roughly offset the rate difference, while the annual figures diverge because the gig supports only 1,300 hours against 2,080.',
              'Identifies available hours as the variable the per-hour comparison hides.',
              'Concludes that the annual comparison is the one that matters for a person who needs a year’s income, unless they have other paid uses for the remaining 780 hours.',
            ],
            evidenceRequirements: [
              'Uses the $26.38 per-hour figure and both annual totals.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response identifies the 780-hour difference as the thing that decides it.',
              'The response allows that a worker who can fill those hours elsewhere faces a genuinely different comparison.',
            ],
            commonMisconception: 'Comparing an hourly gig rate with an employed hourly rate without asking how many hours each arrangement actually provides.',
          },
        ],
      },
    ],
    remediation: 'If the gig work looks better, check the hours. $26 an hour is a higher rate, and 1,300 hours is 780 fewer than a full-time year; the rate advantage cannot make up for hours that do not exist.',
    extension: 'Find the number of gig hours a year at which the gig work would match the employed role’s total compensation, and say whether that number is realistic given the arrangement described.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l09',
    grade: 10, unit: 1, day: 9,
    actor: 'a fictional analyst adding completion risk to a pathway comparison',
    objective: 'Recompute a fictional pathway’s value with the probability of not completing it, and state what the expected value does and does not capture.',
    scenario: 'The fictional degree pathway from earlier in this unit is revisited with a completion rate attached. The costs, gains, and completion rate below are invented for this exercise.',
    materials: ['calculator', 'the fictional pathway figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional degree pathway costs $142,000 in full, including forgone earnings, and raises annual earnings by $35,000 over the baseline once complete. In this simulated cohort 62% complete it. Someone who does not complete still incurs about 60% of the cost and gains nothing.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the pathway gain over 10 years for someone who completes it, before subtracting cost?',
            given: { annualGain: 35000, years: 10 }, expr: 'annualGain * years', format: 'usd', answer: '$350,000.00',
            reasoning: '$35,000 a year for 10 years at the higher wage.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the net 10-year result for someone who completes?',
            given: { cost: 142000 }, expr: '#t1-p1 - cost', format: 'usd', answer: '$208,000.00',
            reasoning: '$350,000 of extra earnings less the $142,000 full cost.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the net result for someone who does not complete, incurring 60% of the cost with no gain?',
            given: { cost2: 142000, incurredShare: 0.6 }, expr: '0 - cost2 * incurredShare', format: 'usd', answer: '-$85,200.00',
            reasoning: '60% of $142,000 spent with nothing gained, so the result is a loss of $85,200.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now combine the two outcomes by their probabilities.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected 10-year result across the cohort?',
            given: { pComplete: 0.62 }, expr: 'round(pComplete * #t1-p2 + (1 - pComplete) * #t1-p3, 2)', format: 'usd', answer: '$96,584.00',
            reasoning: '62% of a $208,000 gain plus 38% of an $85,200 loss.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the expected result than the result for someone who completes?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$111,416.00',
            reasoning: '$208,000 against $96,584 — the completion risk costs more than half the headline gain.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'At what completion rate would the expected result fall to zero? Round to one decimal place.',
            given: {}, expr: 'round(0 - #t1-p3 / (#t1-p2 - #t1-p3) * 100, 1)', format: 'percent1', answer: '29.1%',
            reasoning: 'Breaking even requires the expected gain to offset the expected loss, which happens at a completion rate of $85,200 / $293,200, or 29.1%.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The expected result is still strongly positive at $96,584, and no individual ever receives that amount. Explain what the expected value is useful for and what it hides, and say what an individual should ask about their own situation instead.',
            acceptableAnswerCriteria: [
              'States that no one experiences $96,584: individuals get either $208,000 or -$85,200, and the expected value is a cohort average.',
              'Explains what it is useful for — comparing pathways at the policy or planning level, and showing that the completion rate matters as much as the wage gain.',
              'Names what an individual should ask: what predicts completion for someone in their circumstances, and whether they could survive the -$85,200 outcome.',
            ],
            evidenceRequirements: [
              'Uses the $208,000 and -$85,200 outcomes and the $96,584 expected value.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification', 'reasoning-from-figures'],
            lookFors: [
              'The response notes the 62% completion rate is a cohort figure and may not describe any particular person.',
              'The response does not conclude that the pathway is a bad idea; the expected value is clearly positive.',
            ],
            commonMisconception: 'Reading an expected value as the outcome an individual should plan on receiving.',
          },
        ],
      },
    ],
    remediation: 'If the expected value comes out above $208,000, the loss branch has probably been added rather than subtracted. The non-completion outcome is negative, so weighting it by 38% must pull the average down.',
    extension: 'Recompute the expected result if non-completers incur 100% of the cost rather than 60%, and say which of the two assumptions the conclusion is more sensitive to.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u01-l10',
    grade: 10, unit: 1, day: 10,
    actor: 'a fictional advisor building a pathway recommendation from labour market data',
    objective: 'Combine fictional labour market data with pathway costs into a single recommendation, and state the evidence and the uncertainty behind it.',
    scenario: 'A fictional advisor has the simulated occupational data and pathway costs below for an invented region. Nothing here describes a real occupation, programme, or published statistic.',
    materials: ['calculator', 'the fictional data tables in these directions', 'a blank recommendation sheet'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Occupation M: median wage $53,700, 10th percentile $37,200, about 2,900 openings a year, growth 9%. Entry requires a 20-month programme costing $16,800, during which a learner earns $10,000 a year against a $32,000 baseline. Occupation N: median wage $71,400, 10th percentile $44,600, about 620 openings a year, growth 1%. Entry requires a 48-month programme costing $52,000, during which a learner earns $9,000 a year against the same baseline.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of the pathway into Occupation M?',
            given: { tuitionM: 16800, baseline: 32000, duringM: 10000, monthsM: 20 },
            expr: 'round(tuitionM + (baseline - duringM) * monthsM / 12, 2)', format: 'usd', answer: '$53,466.67',
            reasoning: '$16,800 of tuition plus 20 months of giving up $22,000 a year against the baseline.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the full cost of the pathway into Occupation N?',
            given: { tuitionN: 52000, baseline2: 32000, duringN: 9000, monthsN: 48 },
            expr: 'tuitionN + (baseline2 - duringN) * monthsN / 12', format: 'usd', answer: '$144,000.00',
            reasoning: '$52,000 of tuition plus four years of giving up $23,000 a year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'years',
            text: 'Using the 10th percentile rather than the median as the realistic entry wage, how long does Occupation M take to repay its pathway cost? Round to two decimal places.',
            given: { p10M: 37200, baseline3: 32000 }, expr: 'round(#t1-p1 / (p10M - baseline3), 2)', format: 'dec2', answer: '10.28',
            reasoning: '$53,466.67 of cost against a $5,200 annual gain at the entry wage — a very different picture from using the $53,700 median.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Do the same for Occupation N, and then compare at the median.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'years',
            text: 'At its 10th percentile wage, how long does Occupation N take to repay its pathway cost? Round to two decimal places.',
            given: { p10N: 44600, baseline4: 32000 }, expr: 'round(#t1-p2 / (p10N - baseline4), 2)', format: 'dec2', answer: '11.43',
            reasoning: '$144,000 of cost against a $12,600 annual gain at the entry wage.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'years',
            text: 'At its median wage, how long does Occupation M take to repay? Round to two decimal places.',
            given: { medM: 53700, baseline5: 32000 }, expr: 'round(#t1-p1 / (medM - baseline5), 2)', format: 'dec2', answer: '2.46',
            reasoning: '$53,466.67 against a $21,700 annual gain at the median — four times faster than at the entry wage.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'years',
            text: 'At its median wage, how long does Occupation N take to repay? Round to two decimal places.',
            given: { medN: 71400, baseline6: 32000 }, expr: 'round(#t1-p2 / (medN - baseline6), 2)', format: 'dec2', answer: '3.65',
            reasoning: '$144,000 against a $39,400 annual gain at the median.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the recommendation.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one pathway for a learner who can fund at most $20,000 of tuition and needs to be earning above the baseline within three years. Use the entry-wage figures, not the median figures, as your working assumption, and say what you are assuming and why.',
            acceptableAnswerCriteria: [
              'Applies both stated constraints: the $20,000 tuition ceiling rules out Occupation N’s $52,000 programme outright, and the three-year requirement rules out its 48-month duration.',
              'Justifies working from the 10th percentile rather than the median, on the grounds that an entrant is not a median worker.',
              'States the resulting recommendation honestly, including that Occupation M repays in 10.28 years at the entry wage and only 2.46 at the median, so the outcome depends heavily on how quickly the learner moves up.',
            ],
            evidenceRequirements: [
              'Cites at least one pathway cost, one entry-wage payback, and one openings or growth figure.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The constraints are applied as constraints rather than weighed against the pay.',
              'The response uses the 2,900 openings and 9% growth for M against 620 and 1% for N as part of the case, not only the wages.',
            ],
            commonMisconception: 'Recommending a pathway on median wages when the person will enter near the bottom of the distribution.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Name the single figure in this lesson you would most want verified before giving this recommendation to a real person, and say how you would try to verify it.',
            acceptableAnswerCriteria: [
              'Names a specific figure — the 10th percentile wage, the openings count, the programme cost, or the growth rate — rather than expressing general doubt.',
              'Describes a concrete verification route, such as published regional wage data, the programme’s own published cost and completion figures, or graduate outcome reporting.',
            ],
            evidenceRequirements: [
              'Refers to the chosen figure by value and says what depends on it.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The verification route named would actually be available to a person making this decision.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the two pathways look similar, compute the entry-wage gain for each first: $5,200 a year for M against $12,600 for N. That gap, not the tuition, is why N repays in a comparable time despite costing nearly three times as much.',
    extension: 'Recompute both paybacks assuming the learner reaches the median wage after five years at the entry wage, and say how much that assumption is worth.',
  },
]
