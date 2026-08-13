import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 4 — PF4 Using Credit: What Credit Costs and What Aid Is.
 * Eleven lessons, matching the source unit's eleven days.
 */
export const g09u04: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u04-l01',
    grade: 9, unit: 4, day: 1,
    actor: 'a fictional buyer financing an $840 purchase',
    objective: 'Compute the cost of credit on a fictional financed purchase from its disclosed total of payments, and compare it against waiting and paying cash.',
    scenario: 'A fictional retailer offers financing on a made-up $840 purchase. The disclosure figures below are invented for this exercise; no real credit offer is described.',
    materials: ['calculator', 'the fictional financing disclosure in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional disclosure states: amount financed $840, 24 monthly payments of $43.72.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of all payments over the 24 months?',
            given: { payment: 43.72, months: 24 }, expr: 'payment * months', format: 'usd', answer: '$1,049.28',
            reasoning: '24 payments of $43.72, which is the figure a disclosure calls the total of payments.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the credit itself cost — the amount paid above the $840 financed?',
            given: { financed: 840 }, expr: '#t1-p1 - financed', format: 'usd', answer: '$209.28',
            reasoning: '$1,049.28 paid in total against $840 of goods received.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'The cost of credit is what percentage of the purchase price? Round to one decimal place.',
            given: { financed2: 840 }, expr: 'round(#t1-p2 / financed2 * 100, 1)', format: 'percent1', answer: '24.9%',
            reasoning: '$209.28 on an $840 purchase is 0.24914, or 24.9% added to the price.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The alternative is to wait and pay cash. The buyer can set aside $70 a month.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'How many months of saving $70 does it take to reach $840?',
            given: { setAside: 70, target: 840 }, expr: 'target / setAside', format: 'months0', answer: '12',
            reasoning: '$840 at $70 a month takes exactly 12 months, with no interest assumed.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Comparing the two paths on money alone, which costs less?',
            choices: ['Financing now, at $43.72 a month for 24 months', 'Saving $70 a month and paying cash in 12 months'],
            given: { cash: 840 },
            decision: { left: '#t1-p1', cmp: '<', right: 'cash', ifTrue: 'Financing now, at $43.72 a month for 24 months', ifFalse: 'Saving $70 a month and paying cash in 12 months' },
            answer: 'Saving $70 a month and paying cash in 12 months',
            reasoning: 'Paying cash costs $840 against $1,049.28 financed, so waiting saves the $209.28 cost of credit.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Saving is cheaper by $209.28 and financing is still sometimes the right choice. Describe one situation in which financing this purchase would be defensible, and one in which it clearly would not, using the figures.',
            acceptableAnswerCriteria: [
              'Gives a defensible case for financing that turns on the item being needed now — a tool required for work, a repair that prevents a larger loss — where 12 months of waiting has its own cost.',
              'Gives a clear case against — a purchase that could wait with no consequence — and identifies the $209.28 as the price of not waiting.',
              'Treats the monthly figures honestly: $43.72 is easier to fit into a month than $70, which is a real consideration and not merely an illusion.',
            ],
            evidenceRequirements: [
              'Uses the $209.28 cost of credit and both monthly figures, $43.72 and $70.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises that the smaller monthly payment is not the same as the cheaper option.',
              'The response does not treat all borrowing as a mistake.',
            ],
            commonMisconception: 'Comparing credit offers by the monthly payment rather than by the total of payments.',
          },
        ],
      },
    ],
    remediation: 'If the cost of credit is being read as the $43.72 payment, name what each number is: $43.72 is a payment, $1,049.28 is everything paid, and $840 is what was received. The cost of credit is the gap between the last two.',
    extension: 'Recompute the cost of credit if the same $840 were financed over 12 months at $74.55 a month, and say what the comparison shows about term length.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l02',
    grade: 9, unit: 4, day: 2,
    actor: 'a fictional borrower choosing between two terms on the same loan',
    objective: 'Compare two fictional loans that differ only in term, computing total repaid and total interest for each, and state exactly what the lower monthly payment costs.',
    scenario: 'A fictional lender offers the same $6,000 loan at the same 5.9% rate over two different terms. Both disclosures below are invented for this exercise.',
    materials: ['calculator', 'the two fictional loan disclosures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Loan A: $6,000 at 5.9% APR over 36 months, disclosed monthly payment $182.10. Loan B: the same $6,000 at the same 5.9% APR over 60 months, disclosed monthly payment $115.61.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Loan A’s total of payments?',
            given: { paymentA: 182.1, monthsA: 36 }, expr: 'paymentA * monthsA', format: 'usd', answer: '$6,555.60',
            reasoning: '36 monthly payments of $182.10, the figure a disclosure calls the total of payments.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Loan A cost in total?',
            given: { principal: 6000 }, expr: '#t1-p1 - principal', format: 'usd', answer: '$555.60',
            reasoning: '$6,555.60 repaid against $6,000 borrowed.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Loan B’s total of payments?',
            given: { paymentB: 115.61, monthsB: 60 }, expr: 'paymentB * monthsB', format: 'usd', answer: '$6,936.60',
            reasoning: '60 monthly payments of $115.61 on the same $6,000 of principal.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Loan B cost in total?',
            given: { principal2: 6000 }, expr: '#t1-p3 - principal2', format: 'usd', answer: '$936.60',
            reasoning: '$6,936.60 repaid against the same $6,000 borrowed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the difference between the two.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much lower is Loan B’s monthly payment?',
            given: { paymentA2: 182.1, paymentB2: 115.61 }, expr: 'paymentA2 - paymentB2', format: 'usd', answer: '$66.49',
            reasoning: '$182.10 against $115.61 each month.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does that lower payment cost in total interest?',
            given: {}, expr: '#t1-p4 - #t1-p2', format: 'usd', answer: '$381.00',
            reasoning: '$936.60 of interest on Loan B against $555.60 on Loan A, at the same rate.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'The rate is identical on both loans. What makes Loan B cost more?',
            choices: [
              'A higher interest rate',
              'A longer term, so the balance is owed for more months',
              'A larger amount borrowed',
              'Fees disclosed separately',
            ],
            answer: 'A longer term, so the balance is owed for more months',
            reasoning: 'Both loans state 5.9% APR on $6,000 and no fees are disclosed; the only difference in the two disclosures is 36 months against 60.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A borrower says Loan B is better because it is "the same rate for less money each month". Explain precisely what is true and what is false in that sentence, and name the borrower for whom Loan B really is the better choice.',
            acceptableAnswerCriteria: [
              'Confirms that the rate really is the same and the monthly payment really is $66.49 lower, so both factual claims hold.',
              'Identifies the false implication: less money each month is not less money, since Loan B costs $381.00 more in total.',
              'Names a borrower for whom Loan B is right — one who cannot fit $182.10 into a monthly budget and would otherwise default or go without — and says what that costs them.',
            ],
            evidenceRequirements: [
              'Uses the $66.49 payment difference and the $381.00 total interest difference together.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response separates affordability per month from total cost rather than collapsing them.',
              'The response does not claim the longer loan is simply a trap.',
            ],
            commonMisconception: 'Reading an unchanged interest rate as meaning the loan costs the same.',
          },
        ],
      },
    ],
    remediation: 'If the two loans appear to cost the same because the rate is the same, compute the total of payments for each before anything else and put the two figures side by side. The rate describes the price per year of borrowing; the term decides how many years it is paid.',
    extension: 'Find the total interest on the same $6,000 at 5.9% over 24 months at a disclosed payment of $265.44, and describe the pattern across the three terms.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l03',
    grade: 9, unit: 4, day: 3,
    actor: 'a fictional borrower reading a simulated credit report',
    objective: 'Read a fictional credit report, compute credit utilisation and on-time payment rate from it, and identify what the report does and does not record.',
    scenario: 'The simulated credit report below belongs to a fictional person. Every account, limit, and balance is invented, and no real credit file is described.',
    materials: ['calculator', 'the fictional credit report summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional report shows two revolving accounts. Card A: balance $640, limit $1,500. Card B: balance $210, limit $800. It also shows 24 scheduled payments over the last two years, of which 22 were on time.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total balance across both cards?',
            given: { balanceA: 640, balanceB: 210 }, expr: 'balanceA + balanceB', format: 'usd', answer: '$850.00',
            reasoning: '$640 on Card A plus $210 on Card B.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the overall credit utilisation — total balance as a percentage of total limit? Round to one decimal place.',
            given: { limitA: 1500, limitB: 800 }, expr: 'round(#t1-p1 / (limitA + limitB) * 100, 1)', format: 'percent1', answer: '37.0%',
            reasoning: '$850 of a combined $2,300 limit is 0.36956, or 37.0% to one decimal place.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of the 24 scheduled payments were made on time? Round to one decimal place.',
            given: { onTime: 22, scheduled: 24 }, expr: 'round(onTime / scheduled * 100, 1)', format: 'percent1', answer: '91.7%',
            reasoning: '22 of 24 payments is 0.91666, or 91.7%.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The borrower pays $300 toward Card A.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the new utilisation after the $300 payment? Round to one decimal place.',
            given: { payment: 300, limitA2: 1500, limitB2: 800 }, expr: 'round((#t1-p1 - payment) / (limitA2 + limitB2) * 100, 1)', format: 'percent1', answer: '23.9%',
            reasoning: '$550 remaining on the same $2,300 of limits is 0.23913, or 23.9%.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Set the $300 payment aside for a moment and go back to the original balances. Closing Card B would remove its $800 limit and its $210 balance. What would that do to the 37.0% utilisation?',
            choices: ['Lower it', 'Raise it', 'Leave it unchanged'],
            given: { balanceAfter: 640, limitAfter: 1500 },
            decision: { left: 'round(balanceAfter / limitAfter * 100, 1)', cmp: '>', right: '#t1-p2', ifTrue: 'Raise it', ifFalse: 'Lower it' },
            answer: 'Raise it',
            reasoning: 'Closing Card B leaves $640 against a $1,500 limit, which is 42.7% — higher than the 37.0% across both cards, because the limit falls by more, proportionally, than the balance.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A credit report records what this person did with credit. Name two things it records that the figures above show, and two things about their finances it does not record at all, and say why the gap matters when a lender uses it.',
            acceptableAnswerCriteria: [
              'Names two recorded items grounded in the report — the balances and limits behind the 37.0% utilisation, and the payment history behind the 91.7% figure.',
              'Names two genuinely absent items — how much the person earns, their savings, their assets, or their expenses — and does not confuse them with what a lender might separately ask for.',
              'Explains that a lender reading only this file sees how obligations were handled, not whether the borrower can afford a new one.',
            ],
            evidenceRequirements: [
              'Cites the 37.0% utilisation figure and the 91.7% on-time figure as examples of what is recorded.',
            ],
            dimensions: ['evidence-use', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not claim the report contains a judgement about the person, and does not list employment among the absent items: a report commonly carries an employer name, though never an income figure.',
              'The response recognises that two missed payments out of 24 is recorded as a fact, not as an explanation.',
            ],
            commonMisconception: 'Believing a credit report reflects how much money a person has.',
          },
        ],
      },
    ],
    remediation: 'If utilisation is being computed per card and averaged, note that the report’s combined figure divides the total balance by the total limit. Compute $850 and $2,300 as two separate sums before dividing once.',
    extension: 'Work out the payment that would bring utilisation below 30%, and say why a borrower might target that threshold even though nothing in the report labels it.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l04',
    grade: 9, unit: 4, day: 4,
    actor: 'a fictional applicant reading a simulated financial aid offer',
    objective: 'Read a fictional aid offer, separate gift aid from earned aid and borrowed aid, and compute the gap the applicant must still cover.',
    scenario: 'The aid offer below is a simulated document for a fictional applicant at an invented college. No real institution, applicant, or aid programme is described.',
    materials: ['calculator', 'the fictional aid offer in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional offer lists a cost of attendance of $21,400 for the year, and four lines of aid: a grant of $4,800, a scholarship of $2,500, work study of $2,200, and a subsidised loan of $3,500.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the offer is gift aid — money that is neither earned by working nor repaid?',
            given: { grant: 4800, scholarship: 2500 }, expr: 'grant + scholarship', format: 'usd', answer: '$7,300.00',
            reasoning: 'The $4,800 grant and the $2,500 scholarship are gift aid; work study is earned and the loan is repaid.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do all four aid lines total?',
            given: { workStudy: 2200, loan: 3500 }, expr: '#t1-p1 + workStudy + loan', format: 'usd', answer: '$13,000.00',
            reasoning: '$7,300 of gift aid plus $2,200 of work study plus the $3,500 loan.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What gap remains between the cost of attendance and the total aid offered?',
            given: { coa: 21400 }, expr: 'coa - #t1-p2', format: 'usd', answer: '$8,400.00',
            reasoning: '$21,400 of cost against $13,000 of aid of all kinds.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The three kinds of aid are not equivalent.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What percentage of the cost of attendance is covered by gift aid? Round to one decimal place.',
            given: { coa2: 21400 }, expr: 'round(#t1-p1 / coa2 * 100, 1)', format: 'percent1', answer: '34.1%',
            reasoning: '$7,300 of gift aid against $21,400 of cost is 0.34112, or 34.1%.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If work study is not counted as aid — because it must be worked for — what is the effective gap?',
            given: { workStudy2: 2200 }, expr: '#t1-p3 + workStudy2', format: 'usd', answer: '$10,600.00',
            reasoning: 'The $8,400 gap plus the $2,200 the applicant must earn rather than receive.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which single line of this offer will still be owed after the year is over?',
            choices: ['The $4,800 grant', 'The $2,500 scholarship', 'The $2,200 work study', 'The $3,500 subsidised loan'],
            answer: 'The $3,500 subsidised loan',
            reasoning: 'Grants and scholarships are not repaid and work study is wages for hours worked; only the loan creates an obligation that outlasts the year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The offer presents all four lines under one heading and one total. Explain why totalling them can mislead an applicant, and write the two or three figures you would put at the top of the offer instead.',
            acceptableAnswerCriteria: [
              'Explains that the $13,000 total mixes money given, money earned, and money borrowed, which have different consequences for the applicant.',
              'Proposes a clearer presentation — separating gift aid, earned aid, and borrowed aid, or leading with the $10,600 effective gap.',
              'Uses the $8,400 and $10,600 figures to show how much the presentation changes the apparent affordability.',
            ],
            evidenceRequirements: [
              'Cites the $13,000 total and at least one of the two gap figures.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response treats work study as real money the applicant can get, while noting that it costs hours.',
              'The response does not describe the loan as though it were not aid at all.',
            ],
            commonMisconception: 'Reading a total aid figure as the amount the year will not cost.',
          },
        ],
      },
    ],
    remediation: 'If the gap comes out at $14,100, only the gift aid has been subtracted. Subtract all four lines to find the accounting gap of $8,400 first, then reason separately about which lines are genuinely aid.',
    extension: 'Recompute both gaps if the scholarship is renewable for four years but the grant is one year only, and state the four-year picture.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l05',
    grade: 9, unit: 4, day: 5,
    actor: 'a fictional applicant pricing what each kind of aid costs',
    objective: 'Price a fictional loan dollar against a grant dollar and a work-study dollar, and rank the four kinds of aid by what each costs the recipient.',
    scenario: 'The fictional aid lines below are priced out over their full life. The loan terms, the wage, and the amounts are invented for this exercise.',
    materials: ['calculator', 'the fictional aid terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional subsidised loan is $3,500 at 5.5%, repaid over 10 years — 120 monthly payments — at a disclosed $37.99 a month. The fictional work-study award is $2,200 at a wage of $13.75 an hour.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total repaid on the $3,500 loan over the 10 years?',
            given: { payment: 37.99, months: 120 }, expr: 'payment * months', format: 'usd', answer: '$4,558.80',
            reasoning: '120 monthly payments of $37.99.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the loan cost in interest?',
            given: { borrowed: 3500 }, expr: '#t1-p1 - borrowed', format: 'usd', answer: '$1,058.80',
            reasoning: '$4,558.80 repaid against $3,500 received.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'What does each borrowed dollar end up costing? Give the answer to two decimal places.',
            given: { borrowed2: 3500 }, expr: 'round(#t1-p1 / borrowed2, 2)', format: 'dec2', answer: '1.30',
            reasoning: '$4,558.80 repaid for every $3,500 received is $1.30 repaid per dollar borrowed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the work-study award in the currency it actually costs.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'hours',
            text: 'How many hours must be worked to earn the full $2,200 work-study award at $13.75 an hour?',
            given: { award: 2200, wage: 13.75 }, expr: 'round(award / wage, 0)', format: 'int', answer: '160',
            reasoning: '$2,200 at $13.75 an hour is exactly 160 hours of work.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Ranking a grant dollar, a work-study dollar, and a loan dollar by what each costs the recipient, which costs the most?',
            choices: ['A grant dollar', 'A work-study dollar', 'A loan dollar'],
            given: {},
            decision: { left: '#t1-p3', cmp: '>', right: '1', ifTrue: 'A loan dollar', ifFalse: 'A grant dollar' },
            answer: 'A loan dollar',
            reasoning: 'A grant dollar costs nothing to keep, a work-study dollar costs about four and a half minutes of work, and a loan dollar costs $1.30 repaid — the only one that costs more than a dollar.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Work study costs 160 hours and the loan costs $1,058.80. Explain why these two costs cannot simply be added or compared as numbers, and describe what an applicant would have to know about themselves to weigh them.',
            acceptableAnswerCriteria: [
              'States that one cost is paid in time during the study year and the other in money over ten years afterwards, so they fall on different resources at different times.',
              'Identifies what the applicant would need to know: whether 160 hours can be spared without harming study or other earnings, and what $37.99 a month will mean against a future income they cannot yet see.',
              'Avoids converting the hours into dollars at the work-study wage and calling that a comparison, or explains why that conversion is not the whole answer.',
            ],
            evidenceRequirements: [
              'Uses the 160-hour figure and at least one loan figure ($1,058.80 interest, $37.99 a month, or $1.30 per dollar).',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The response treats the ten-year repayment horizon as a source of genuine uncertainty.',
              'The response does not conclude that work study is always better, nor that borrowing should always be avoided.',
            ],
            commonMisconception: 'Treating aid of different kinds as interchangeable because they appear on the same offer at the same face value.',
          },
        ],
      },
    ],
    remediation: 'If the cost per borrowed dollar comes out near $0.30, the interest has been divided by the amount borrowed rather than the total repaid. The question asks what each dollar costs in the end, so divide the $4,558.80 repaid, not the $1,058.80 of interest.',
    extension: 'Recompute the cost per borrowed dollar if the same $3,500 were repaid over 20 years at a disclosed $24.08 a month, and say what doubling the term does to that figure.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l06',
    grade: 9, unit: 4, day: 6,
    actor: 'a fictional cardholder paying only the minimum',
    objective: 'Track a fictional revolving balance across three months of minimum payments, and show how much of the money paid actually reduced what is owed.',
    scenario: 'The fictional credit card below carries a balance of $1,200. Its rate, minimum-payment rule, and balance are invented for this exercise.',
    materials: ['calculator', 'the fictional card terms in these directions', 'a blank three-row tracking table'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional card charges 24% a year, applied as 2% of the balance each month. Interest is charged first; the minimum payment is then 2.5% of that new statement balance, or $25, whichever is greater; then the payment is applied. This matches how a real card bills, on the statement balance including the finance charge. Round each figure to the nearest cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What interest is charged in month 1 on the $1,200 balance?',
            given: { balance: 1200, monthlyRate: 0.02 }, expr: 'round(balance * monthlyRate, 2)', format: 'usd', answer: '$24.00',
            reasoning: 'The card applies 2% of the balance each month, and 2% of $1,200 is $24.00.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the month 1 minimum payment?',
            given: { balance2: 1200, minRate: 0.025, minFloor: 25 }, expr: 'max(round((balance2 + #t1-p1) * minRate, 2), minFloor)', format: 'usd', answer: '$30.60',
            reasoning: 'The statement balance after interest is $1,224.00, and 2.5% of that is $30.60, which is greater than the $25 floor.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the end of month 1?',
            given: { balance3: 1200 }, expr: 'balance3 + #t1-p1 - #t1-p2', format: 'usd', answer: '$1,193.40',
            reasoning: '$1,200 plus $24.00 of interest less the $30.60 paid, so only $6.60 of the payment reduced the balance.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Repeat the same three steps for month 2, starting from the month 1 closing balance.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What interest is charged in month 2?',
            given: { monthlyRate2: 0.02 }, expr: 'round(#t1-p3 * monthlyRate2, 2)', format: 'usd', answer: '$23.87',
            reasoning: 'The same 2% monthly rate, now applied to the $1,193.40 carried into month 2.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the month 2 minimum payment?',
            given: { minRate2: 0.025, minFloor2: 25 }, expr: 'max(round((#t1-p3 + #t2-p1) * minRate2, 2), minFloor2)', format: 'usd', answer: '$30.43',
            reasoning: '2.5% of the $1,217.27 statement balance, still above the $25 floor.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the end of month 2?',
            given: {}, expr: '#t1-p3 + #t2-p1 - #t2-p2', format: 'usd', answer: '$1,186.84',
            reasoning: '$1,193.40 plus $23.87 of interest less the $30.43 paid.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Work month 3 yourself, then total the three months.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the end of month 3?',
            given: { monthlyRate3: 0.02, minRate3: 0.025, minFloor3: 25 },
            expr: '#t2-p3 + round(#t2-p3 * monthlyRate3, 2) - max(round((#t2-p3 + round(#t2-p3 * monthlyRate3, 2)) * minRate3, 2), minFloor3)',
            format: 'usd', answer: '$1,180.32',
            reasoning: '$1,186.84 plus $23.74 of interest less the $30.26 minimum payment.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What was paid in total across the three months?',
            given: { minRate4: 0.025, minFloor4: 25, monthlyRate4: 0.02 }, expr: '#t1-p2 + #t2-p2 + max(round((#t2-p3 + round(#t2-p3 * monthlyRate4, 2)) * minRate4, 2), minFloor4)', format: 'usd', answer: '$91.29',
            reasoning: '$30.60 plus $30.43 plus $30.26.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much did the balance actually fall over the three months?',
            given: { start: 1200 }, expr: 'start - #t3-p1', format: 'usd', answer: '$19.68',
            reasoning: '$1,200 at the start against $1,180.32 at the end.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Of the $91.29 paid, only $19.68 reduced the balance. Explain where the rest went, and describe what the minimum-payment rule does as the balance falls.',
            acceptableAnswerCriteria: [
              'States that $71.61 of the $91.29 paid went to interest, and shows this as the difference between the two figures.',
              'Explains that the minimum is a percentage of the balance, so it shrinks as the balance shrinks, which slows repayment further.',
              'Notes that the $25 floor eventually takes over, and that until then each month repeats the same pattern at a slightly smaller scale.',
            ],
            evidenceRequirements: [
              'Uses the $91.29 total paid and the $19.68 reduction in balance.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The response identifies the shrinking minimum as a mechanism rather than describing minimum payments as merely "bad".',
              'The response does not claim the interest was hidden; it was charged at the stated rate.',
            ],
            commonMisconception: 'Assuming a payment reduces the balance by the amount paid.',
          },
        ],
      },
    ],
    remediation: 'If the closing balance is falling by the full payment each month, the interest step is being skipped. Work strictly in the stated order: add the interest to the balance, take 2.5% of that new total as the minimum, then subtract it, and record all three numbers for each month before moving on.',
    extension: 'Continue the table until the minimum payment first hits the $25 floor, and say how many months that takes and what the balance is then.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l07',
    grade: 9, unit: 4, day: 7,
    actor: 'a fictional shopper who believed a 0% offer was free',
    objective: 'Find the error in a fictional claim that a 0% financing offer costs nothing, compute both outcomes the offer allows, and quantify the risk the claim ignores.',
    scenario: 'A fictional shopper wrote: "It is 0% financing, so borrowing costs me nothing." The simulated offer they were reading is set out below and is invented for this exercise.',
    materials: ['the fictional offer terms in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional offer on a $1,450 purchase: no interest for 12 months, a one-time account setup fee of $99, and deferred interest of 26.9% charged on the full original purchase amount if any balance remains after 12 months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'If the balance is paid in full within the 12 months, what has the purchase cost in total?',
            given: { purchase: 1450, setupFee: 99 }, expr: 'purchase + setupFee', format: 'usd', answer: '$1,549.00',
            reasoning: 'The $1,450 purchase plus the $99 setup fee, with no interest charged.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'Even in that best case, by what percentage does the offer raise the cost of the purchase? Round to one decimal place.',
            given: { purchase2: 1450, setupFee2: 99 }, expr: 'round(setupFee2 / purchase2 * 100, 1)', format: 'percent1', answer: '6.8%',
            reasoning: 'The $99 fee on a $1,450 purchase is 0.06827, or 6.8% — which is not zero, whatever the interest rate says.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now the other outcome. Suppose $200 of the balance is still owed when the 12 months end.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much deferred interest is charged, at 26.9% of the full original purchase amount?',
            given: { purchase3: 1450, deferredRate: 0.269 }, expr: 'round(purchase3 * deferredRate, 2)', format: 'usd', answer: '$390.05',
            reasoning: '26.9% of the full $1,450, not of the $200 still owed — that is what "deferred interest on the original amount" means.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What has the purchase cost in total in that case?',
            given: {}, expr: '#t1-p1 + #t2-p1', format: 'usd', answer: '$1,939.05',
            reasoning: 'The $1,549.00 of purchase and fee plus $390.05 of deferred interest.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more is that than paying cash for the item?',
            given: { purchase4: 1450 }, expr: '#t2-p2 - purchase4', format: 'usd', answer: '$489.05',
            reasoning: '$1,939.05 against the $1,450 cash price.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Locate the error precisely.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'What does the fictional shopper’s sentence get wrong?',
            choices: [
              'The rate; the offer is not really 0%',
              'It reads one term of the offer as though it were the whole price of borrowing',
              'The arithmetic; $1,450 at 0% is not $1,450',
              'Nothing; borrowing at 0% is free',
            ],
            answer: 'It reads one term of the offer as though it were the whole price of borrowing',
            reasoning: 'The 0% promotional rate is genuine for the 12 months, but the offer also carries a $99 fee that applies regardless and a deferred-interest clause worth $390.05 that applies conditionally.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the difference between the best outcome and the worst outcome this offer allows?',
            given: {}, expr: '#t2-p2 - #t1-p1', format: 'usd', answer: '$390.05',
            reasoning: 'The whole spread between the two outcomes is the deferred interest, which turns on a single condition.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the question you would ask before accepting this offer that best separates the $1,549.00 outcome from the $1,939.05 one, and explain why that question, rather than the interest rate, is the one that matters.',
            acceptableAnswerCriteria: [
              'Poses a question aimed at whether the balance will certainly be cleared inside 12 months — the required monthly payment, what happens if a payment is missed, or how the deferral is triggered.',
              'Explains that the rate is fixed at 0% either way, so it cannot distinguish the two outcomes, while the clearing condition decides a $390.05 difference.',
              'Acknowledges the $99 fee applies in both cases and so is a certainty rather than a risk.',
            ],
            evidenceRequirements: [
              'Uses both total figures, $1,549.00 and $1,939.05, and the $99 fee.',
            ],
            dimensions: ['error-diagnosis', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The question posed is answerable from the offer document.',
              'The response separates the certain cost from the conditional one.',
            ],
            commonMisconception: 'Treating a promotional interest rate as the full price of a credit offer.',
          },
        ],
      },
    ],
    remediation: 'If the deferred interest is being computed on the $200 still owed, reread the clause: it is charged on the full original purchase amount. Compute 26.9% of $1,450 and note how much larger it is than 26.9% of $200.',
    extension: 'Work out the monthly payment needed to clear $1,450 within 12 months, and say whether that payment is what the offer’s minimum would have required.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l08',
    grade: 9, unit: 4, day: 8,
    actor: 'a fictional borrower considering refinancing a vehicle loan',
    objective: 'Apply the rate, term, and total-repaid method to a fictional refinance, computing what the borrower pays in total on each path and what the switch is worth.',
    scenario: 'A fictional borrower is 12 months into a simulated vehicle loan and has been offered an invented refinance. Every rate, balance, and payment below is fictional.',
    materials: ['calculator', 'the two fictional loan disclosures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The original fictional loan: $12,400 at 8.4% over 60 months, disclosed payment $253.72. After 12 payments the fictional balance is $10,480. The refinance offer: that balance at 5.1% over 48 months, disclosed payment $241.85.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What would the original loan cost in total over its full 60 months?',
            given: { payment: 253.72, months: 60 }, expr: 'payment * months', format: 'usd', answer: '$15,223.20',
            reasoning: '60 payments of $253.72 on the original schedule.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of that is interest?',
            given: { borrowed: 12400 }, expr: '#t1-p1 - borrowed', format: 'usd', answer: '$2,823.20',
            reasoning: '$15,223.20 repaid against $12,400 borrowed.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the refinance cost over its 48 months?',
            given: { paymentR: 241.85, monthsR: 48 }, expr: 'paymentR * monthsR', format: 'usd', answer: '$11,608.80',
            reasoning: '48 payments of $241.85 on the refinanced balance.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The 12 payments already made count on either path.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What has the borrower already paid in the first 12 months?',
            given: { payment2: 253.72, paid: 12 }, expr: 'payment2 * paid', format: 'usd', answer: '$3,044.64',
            reasoning: '12 payments of $253.72 already made before the refinance is considered.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total paid across the whole borrowing if the refinance is taken?',
            given: {}, expr: '#t2-p1 + #t1-p3', format: 'usd', answer: '$14,653.44',
            reasoning: '$3,044.64 already paid plus $11,608.80 on the refinanced schedule.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does refinancing save against staying on the original loan?',
            given: {}, expr: '#t1-p1 - #t2-p2', format: 'usd', answer: '$569.76',
            reasoning: '$15,223.20 on the original path against $14,653.44 with the refinance.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The refinance lowers the rate from 8.4% to 5.1% but saves only $569.76 on a $12,400 loan. Explain why the saving is not larger, and name the one term in the refinance offer that limits it.',
            acceptableAnswerCriteria: [
              'Identifies that the refinance runs 48 months from month 12, so the borrowing lasts 60 months in total — the same length as the original — rather than finishing 12 months sooner.',
              'Explains that a rate cut only saves money on the months and balance that remain, and 12 months of the highest-balance period were already paid at 8.4%.',
              'Uses the total figures, $15,223.20 against $14,653.44, rather than comparing the rates alone.',
            ],
            evidenceRequirements: [
              'Cites the 48-month refinance term alongside the 12 months already paid.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response notices the monthly payment barely changed, from $253.72 to $241.85, and attributes that to a smaller balance running over the same 48 remaining months at a lower rate rather than to a longer term.',
              'The response does not treat a lower rate as automatically producing proportional savings.',
            ],
            commonMisconception: 'Judging a refinance by the change in rate without checking what happens to the term.',
          },
        ],
      },
    ],
    remediation: 'If the saving is coming out in the thousands, the 12 payments already made are probably being dropped from one side of the comparison. Both paths include them; only what happens after month 12 differs.',
    extension: 'Recompute the saving if the refinance ran 36 months at a disclosed $314.61 a month, and say what that shows about which term the borrower should ask for.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l09',
    grade: 9, unit: 4, day: 9,
    actor: 'a fictional lender’s published scoring model',
    objective: 'Compute a fictional lender’s published index from weighted factors, test which factor moves it most, and state what the index does not measure.',
    scenario: 'A fictional lender publishes the simulated scoring model below and applies it to a fictional applicant’s file. The index and the sub-scores are invented for this exercise and are not any real credit score. The five factors and their weights follow the breakdown a widely used real scoring model publishes, so the categories are realistic even though the numbers are not.',
    materials: ['calculator', 'the fictional model and file in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional model weights five factors: payment history 0.35, credit utilisation 0.30, length of history 0.15, credit mix 0.10, and new credit 0.10. The fictional applicant scores, out of 100: payment history 96, utilisation 62, length 40, mix 70, new credit 85.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric',
            text: 'What does the payment history factor contribute to the index?',
            given: { wHistory: 0.35, sHistory: 96 }, expr: 'wHistory * sHistory', format: 'dec1', answer: '33.6',
            reasoning: '0.35 x 96, the largest single contribution in the model.',
          },
          {
            ref: 't1-p2', kind: 'numeric',
            text: 'What is the applicant’s overall index? Give it to one decimal place.',
            given: { wUtil: 0.3, sUtil: 62, wLength: 0.15, sLength: 40, wMix: 0.1, sMix: 70, wNew: 0.1, sNew: 85 },
            expr: '#t1-p1 + wUtil * sUtil + wLength * sLength + wMix * sMix + wNew * sNew',
            format: 'dec1', answer: '73.7',
            reasoning: '33.6 + 18.6 + 6.0 + 7.0 + 8.5, the five weighted contributions added.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Test what would move the index most.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'If the utilisation sub-score rose from 62 to 90 with everything else unchanged, what would the index become?',
            given: { wUtil2: 0.3, newUtil: 90, oldUtil: 62 }, expr: '#t1-p2 + wUtil2 * (newUtil - oldUtil)', format: 'dec1', answer: '82.1',
            reasoning: 'A 28-point gain on a factor weighted 0.30 adds 8.4 to the index, taking 73.7 to 82.1.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'If instead the length-of-history sub-score rose from 40 to 90, what would the index become?',
            given: { wLength2: 0.15, newLength: 90, oldLength: 40 }, expr: '#t1-p2 + wLength2 * (newLength - oldLength)', format: 'dec1', answer: '81.2',
            reasoning: 'A larger 50-point gain on a factor weighted only 0.15 adds 7.5, taking 73.7 to 81.2.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which of those two improvements raises the index more?',
            choices: ['Raising utilisation from 62 to 90', 'Raising length of history from 40 to 90', 'They raise it equally'],
            given: {},
            decision: { left: '#t2-p1', cmp: '>', right: '#t2-p2', ifTrue: 'Raising utilisation from 62 to 90', ifFalse: 'Raising length of history from 40 to 90' },
            answer: 'Raising utilisation from 62 to 90',
            reasoning: 'The smaller 28-point gain on the heavier-weighted factor beats the larger 50-point gain on the lighter one, 82.1 against 81.2.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'One of these two improvements is largely within the applicant’s control this year and the other is not. Say which is which, and explain what that means for how much attention the index deserves.',
            acceptableAnswerCriteria: [
              'Identifies utilisation as the factor that can be changed quickly by paying down balances, and length of history as one that only time can improve.',
              'Connects this to the weights: the factor that is both heavily weighted and controllable is where effort pays.',
              'States a limit honestly — the index is one fictional lender’s model, and a different lender weighting length more heavily would rank the same file differently.',
            ],
            evidenceRequirements: [
              'Uses the two resulting index figures, 82.1 and 81.2, and the two weights, 0.30 and 0.15.',
            ],
            dimensions: ['criteria-application', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the weights as the lender’s choices rather than as facts about creditworthiness.',
              'The response does not suggest the applicant can do anything about the length of their own credit history.',
            ],
            commonMisconception: 'Believing a scoring index measures something objective about a person rather than summarising a lender’s priorities.',
          },
        ],
      },
    ],
    remediation: 'If the index comes out above 100, the sub-scores are being added before the weights are applied. Compute the five weighted contributions in a column — 33.6, 18.6, 6.0, 7.0, 8.5 — and only then add.',
    extension: 'Construct a second fictional lender’s weights, still summing to 1, under which this applicant’s file scores above 80 with no change to any sub-score.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l10',
    grade: 9, unit: 4, day: 10,
    actor: 'a fictional applicant comparing two aid offers',
    objective: 'Compare two fictional aid offers with very different sticker prices, compute the gap each leaves, and defend a recommendation from the gaps rather than the prices.',
    scenario: 'The two simulated aid offers below come from invented colleges for a fictional applicant. No real institution, cost, or aid programme is described.',
    materials: ['calculator', 'the two fictional aid offers in these directions', 'a blank comparison sheet'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer 1, from the fictional Ridgeway College: cost of attendance $18,900; grant $6,200; scholarship $1,500; work study $2,000; subsidised loan $3,500. Offer 2, from the fictional Halloway University: cost of attendance $31,500; grant $14,800; scholarship $4,000; work study $2,500; subsidised loan $3,500.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What gap does Offer 1 leave after all four aid lines?',
            given: { coa1: 18900, g1: 6200, s1: 1500, w1: 2000, l1: 3500 },
            expr: 'coa1 - g1 - s1 - w1 - l1', format: 'usd', answer: '$5,700.00',
            reasoning: '$18,900 of cost less $13,200 of total aid.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What gap does Offer 2 leave?',
            given: { coa2: 31500, g2: 14800, s2: 4000, w2: 2500, l2: 3500 },
            expr: 'coa2 - g2 - s2 - w2 - l2', format: 'usd', answer: '$6,700.00',
            reasoning: '$31,500 of cost less $24,800 of total aid.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much higher is Offer 2’s cost of attendance?',
            given: { coa1b: 18900, coa2b: 31500 }, expr: 'coa2b - coa1b', format: 'usd', answer: '$12,600.00',
            reasoning: '$31,500 against $18,900 in sticker price.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much higher is Offer 2’s gap?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$1,000.00',
            reasoning: '$6,700 against $5,700 — a difference of $1,000 on a sticker gap of $12,600.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Look at what kind of aid closes each gap.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What percentage of Offer 2’s cost is covered by gift aid? Round to one decimal place.',
            given: { g2b: 14800, s2b: 4000, coa2c: 31500 }, expr: 'round((g2b + s2b) / coa2c * 100, 1)', format: 'percent1', answer: '59.7%',
            reasoning: '$18,800 of grant and scholarship against $31,500 of cost.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage of Offer 1’s cost is covered by gift aid? Round to one decimal place.',
            given: { g1b: 6200, s1b: 1500, coa1c: 18900 }, expr: 'round((g1b + s1b) / coa1c * 100, 1)', format: 'percent1', answer: '40.7%',
            reasoning: '$7,700 of grant and scholarship against $18,900 of cost.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the comparison up.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one offer for an applicant who can contribute $4,000 a year and does not want to borrow beyond the subsidised loan. Use the gaps, not the sticker prices, and say what each offer would require the applicant to do about the shortfall.',
            acceptableAnswerCriteria: [
              'Leads with the gaps, $5,700 and $6,700, and states plainly that the $12,600 sticker difference does not translate into a $12,600 difference in what the applicant pays.',
              'Works out the shortfall against the $4,000 contribution in each case — $1,700 at Ridgeway and $2,700 at Halloway — and says how each might be covered.',
              'Reaches a recommendation that respects the stated constraint against borrowing further, rather than assuming additional loans are available.',
            ],
            evidenceRequirements: [
              'Cites both gap figures and the $4,000 contribution in reaching the recommendation.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response notices that the more expensive college leaves a gap only $1,000 larger.',
              'A recommendation for either offer can meet the criteria if the shortfall is faced with a concrete plan.',
            ],
            commonMisconception: 'Ruling out a college on its published cost before reading what its aid offer leaves to pay.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Name one thing you would need to know about these offers, not stated above, before treating either gap as the real annual cost for four years.',
            acceptableAnswerCriteria: [
              'Names a specific, checkable unknown — whether the grant and scholarship renew, whether the cost of attendance rises each year, what happens if grades or income change, or whether the loan amount is available again.',
              'Explains how that unknown could change the four-year picture, not just the single year.',
            ],
            evidenceRequirements: [
              'Refers to a specific aid line from one of the two offers by amount.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The unknown named is one an applicant could resolve by asking the college, not an unanswerable general doubt.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the recommendation is being driven by the $12,600 sticker difference, cover the cost-of-attendance line on both offers and reread them from the gap upward. The applicant pays the gap, not the sticker.',
    extension: 'Recompute both gaps for a second year in which each college raises its cost 4% and holds aid flat, and say which offer is more exposed to that change.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u04-l11',
    grade: 9, unit: 4, day: 11,
    actor: 'a fictional applicant defending a plan to close a $5,700 gap',
    objective: 'Price the borrowing needed to close a fictional aid gap over its full repayment life, and defend a plan that mixes work, saving, and borrowing under a stated constraint.',
    scenario: 'A fictional applicant faces a $5,700 annual gap and must decide how to close it. The loan terms, wage, and figures below are invented for this exercise.',
    materials: ['calculator', 'the fictional gap and loan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'If the whole $5,700 gap is borrowed, the fictional terms are 6.8% over 10 years — 120 monthly payments — at a disclosed $65.58 a month. Additional work at the fictional campus wage pays $13.75 an hour.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total repaid if the full gap is borrowed?',
            given: { payment: 65.58, months: 120 }, expr: 'payment * months', format: 'usd', answer: '$7,869.60',
            reasoning: '120 monthly payments of $65.58.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does borrowing the gap cost in interest?',
            given: { gap: 5700 }, expr: '#t1-p1 - gap', format: 'usd', answer: '$2,169.60',
            reasoning: '$7,869.60 repaid against $5,700 borrowed.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'What does each dollar of this gap cost if it is borrowed? Give the answer to two decimal places.',
            given: { gap2: 5700 }, expr: 'round(#t1-p1 / gap2, 2)', format: 'dec2', answer: '1.38',
            reasoning: '$7,869.60 repaid for every $5,700 borrowed is $1.38 per dollar.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price a mixed plan: borrow $3,500, earn $1,400 through extra work, and save the rest before the year begins.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'hours',
            text: 'How many hours of work at $13.75 an hour produce $1,400? Round to the nearest hour.',
            given: { earn: 1400, wage: 13.75 }, expr: 'round(earn / wage, 0)', format: 'int', answer: '102',
            reasoning: '$1,400 at $13.75 an hour is 101.8 hours, which rounds to 102.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much must be saved in advance to complete the mixed plan?',
            given: { gap3: 5700, borrow: 3500, earn2: 1400 }, expr: 'gap3 - borrow - earn2', format: 'usd', answer: '$800.00',
            reasoning: '$5,700 of gap less $3,500 borrowed and $1,400 earned.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Borrowing $3,500 rather than $5,700 at the same $1.38 per dollar saves how much in eventual repayment? Round to the nearest cent.',
            given: { borrow2: 3500 }, expr: 'round(#t1-p1 - borrow2 * #t1-p3, 2)', format: 'usd', answer: '$3,039.60',
            reasoning: '$7,869.60 to repay the full gap against $4,830.00 to repay $3,500 at the same $1.38 per dollar.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Defend the plan.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Defend the mixed plan against the simpler alternative of borrowing the whole $5,700. Say what the mixed plan costs that the simple one does not, and name the condition under which borrowing the whole gap would be the better choice.',
            acceptableAnswerCriteria: [
              'States what the mixed plan saves — $3,039.60 in eventual repayment — and what it costs: 102 hours of work during the year and $800 saved in advance.',
              'Names a condition under which borrowing the full gap is better, such as those 102 hours displacing study or a better-paid commitment, or the $800 not being available in time.',
              'Treats the 10-year repayment horizon as a real cost of the simple plan rather than a distant abstraction.',
            ],
            evidenceRequirements: [
              'Uses the $3,039.60 saving, the 102 hours, and the $800 advance saving together.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response prices the hours against something, rather than treating work as free.',
              'The response does not present borrowing as always wrong; the subsidised $3,500 is retained in the mixed plan.',
            ],
            commonMisconception: 'Treating a plan that borrows less as automatically better without pricing what replaces the borrowing.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The $1.38 per borrowed dollar assumes the loan runs its full 10 years. Say how paying it off in 5 years instead would change that figure, and why the direction of the change is certain even without the new payment amount.',
            acceptableAnswerCriteria: [
              'States that the cost per dollar would fall, because interest accrues over fewer months on a balance that falls faster.',
              'Explains that the direction is certain from the structure of the loan, without needing the disclosed 5-year payment.',
            ],
            evidenceRequirements: [
              'Refers to the $1.38 per dollar figure and the 10-year term it assumes.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response notes that the monthly payment would rise, so the shorter term is not free.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the saving from borrowing less comes out as $2,200 — the raw difference in principal — the repayment multiplier has been dropped. Every dollar not borrowed saves about $1.38, so the saving is near $3,036; the keyed $3,039.60 differs slightly because it uses the exact $7,869.60 total on one side rather than the rounded per-dollar figure on both.',
    extension: 'Build a third plan that borrows nothing, state what it requires in hours and advance saving, and say honestly whether it is realistic alongside full-time study.',
  },
]
