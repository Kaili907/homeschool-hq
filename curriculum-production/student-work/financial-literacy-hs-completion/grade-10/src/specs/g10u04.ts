import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 4 — PF4 Using Credit: Credit Systems, Scores, and Financing
 * Aid.
 *
 * Three modelling commitments run through this unit, each stated on the
 * learner-facing sheet of every lesson that depends on it:
 *
 *  - Amortisation is modelled as it actually behaves. Interest for a period is
 *    charged on the balance outstanding at the start of that period, the fixed
 *    payment is applied to that interest first, and the remainder reduces the
 *    balance. Lessons l03 and l09 carry this month by month rather than
 *    dressing a simple-interest total up as a loan.
 *  - Where a total is computed as a level payment times a number of periods,
 *    the sheet says that the payment is rounded to the cent and that a real
 *    final payment absorbs the rounding difference.
 *  - In-school interest accrual on the fictional student loans is simple, not
 *    compounded, and capitalises once when repayment begins. The sheet says so,
 *    and says that real loans vary in how often capitalisation happens.
 *
 * The fictional scoring model in l01 uses invented category weights. They are
 * deliberately not the weights any real scoring model publishes.
 */
export const g10u04: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u04-l01',
    grade: 10, unit: 4, day: 1,
    actor: 'a fictional borrower whose file is scored by an invented model',
    objective: 'Compute a fictional credit score from stated category weights, recompute it after a change in one category, and identify which input the borrower can actually move.',
    scenario: 'The Meridian Score described below is a fictional scoring model invented for this exercise. Its categories, weights, and scale are made up and match no real scoring model. No learner is asked for a real credit score or credit file.',
    materials: ['calculator', 'the fictional scoring model in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional Meridian Score rates a file from 0 to 100 in each of five categories, weights them, and maps the weighted result onto a scale that runs from 300 to 850. The invented weights are: payment history 40%, amounts owed 25%, length of history 15%, new credit 12%, and credit mix 8%. A fictional borrower’s file scores 92 on payment history, 55 on amounts owed, 70 on length of history, 80 on new credit, and 60 on credit mix.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric',
            text: 'What is the borrower’s weighted category score, out of 100?',
            given: { pay: 92, owed: 55, length: 70, newc: 80, mix: 60, wPay: 0.4, wOwed: 0.25, wLen: 0.15, wNew: 0.12, wMix: 0.08 },
            expr: 'pay*wPay + owed*wOwed + length*wLen + newc*wNew + mix*wMix', format: 'dec2', answer: '75.45',
            reasoning: 'Each category score multiplied by its stated weight and summed. The weights total 100%, so the result is on the same 0-to-100 basis as the inputs.',
          },
          {
            ref: 't1-p2', kind: 'numeric',
            text: 'Mapped onto the 300 to 850 scale, what is the borrower’s score?',
            given: {}, expr: '300 + (#t1-p1 / 100) * (850 - 300)', format: 'int', answer: '715',
            reasoning: '75.45 out of 100 placed proportionally along the 550 points between the 300 floor and the 850 ceiling, then added to the floor. The floor matters: a score of 0 on every category still returns 300.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'The amounts-owed category is driven by utilisation. The borrower owes $4,260 against total limits of $9,000. What is the utilisation?',
            given: { bal: 4260, limits: 9000 }, expr: 'bal / limits * 100', format: 'percent2', answer: '47.33%',
            reasoning: 'Balances divided by limits. This is the input behind the weakest of the borrower’s five category scores.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The borrower pays down $1,860 of the balance. Nothing else about the file changes: the same accounts stay open, so total limits are unchanged, and the amounts-owed category score rises from 55 to 78. Recompute.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after the paydown?',
            given: { bal2: 4260, paydown: 1860 }, expr: 'bal2 - paydown', format: 'usd', answer: '$2,400.00',
            reasoning: '$4,260 owed less the $1,860 paid down.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the new utilisation?',
            given: { limits2: 9000 }, expr: '#t2-p1 / limits2 * 100', format: 'percent2', answer: '26.67%',
            reasoning: '$2,400.00 against the same $9,000 of limits. The limits did not change, which is why the ratio moved as far as it did.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'What is the new weighted category score, out of 100?',
            given: { pay2: 92, owed2: 78, length2: 70, newc2: 80, mix2: 60, wPay2: 0.4, wOwed2: 0.25, wLen2: 0.15, wNew2: 0.12, wMix2: 0.08 },
            expr: 'pay2*wPay2 + owed2*wOwed2 + length2*wLen2 + newc2*wNew2 + mix2*wMix2', format: 'dec2', answer: '81.20',
            reasoning: 'Only the amounts-owed input changed, from 55 to 78. The other four category scores are carried across unchanged.',
          },
          {
            ref: 't2-p4', kind: 'numeric',
            text: 'What is the new score on the 300 to 850 scale?',
            given: {}, expr: '300 + (#t2-p3 / 100) * (850 - 300)', format: 'int', answer: '747',
            reasoning: '81.20 mapped onto the same scale as before.',
          },
          {
            ref: 't2-p5', kind: 'numeric',
            text: 'How many points did the paydown move the score?',
            given: {}, expr: 'round(#t2-p4, 0) - round(#t1-p2, 0)', format: 'int', answer: '32',
            reasoning: 'The 747 score against the 715 score, both as they are reported. A 23-point move in one category worth 25% of the model produced this.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Using the stated weights, explain why paying down a balance moved this fictional score while opening a new account to raise total limits might not help as much as it appears. Then say what a scoring model of this kind can and cannot tell a lender.',
            acceptableAnswerCriteria: [
              'Reasons from the weights: amounts owed carries 25%, so a large move there produced 32 points, while a new account touches the 12% new-credit category and the 15% length-of-history category in the opposite direction.',
              'States what the model measures — a record of repayment behaviour and current obligation — and what it does not: income, savings, assets, or whether a particular loan is affordable.',
              'Notes that the borrower controls balances and payment timing directly, while length of history moves only with time and cannot be accelerated.',
            ],
            evidenceRequirements: [
              'Uses the 715 and 747 scores and at least two of the stated category weights.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response uses the weights as the reason rather than asserting that paying down debt is generally good.',
              'The response does not treat the score as a measure of the borrower as a person; it is a prediction about repayment built from a file.',
            ],
            commonMisconception: 'Treating a credit score as a measure of wealth or income rather than of borrowing and repayment history.',
          },
        ],
      },
    ],
    remediation: 'If the mapped score comes out as 75 or 76, the weighted result is being reported without being placed on the 300 to 850 scale. The weighted figure is out of 100; the scale has a floor of 300 and 550 points above it. Take 75.45 percent of those 550 points and add the 300 floor.',
    extension: 'Work out how many points the borrower would gain by moving payment history from 92 to 100 instead, and say which of the two changes is easier to make and which is easier to lose.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l02',
    grade: 10, unit: 4, day: 2,
    actor: 'a fictional household holding four different kinds of credit at once',
    objective: 'Classify four fictional credit products as secured or unsecured and revolving or installment, compute one month of interest on each, and show what a revolving minimum payment actually retires.',
    scenario: 'The four simulated credit accounts below are invented for this exercise. No real lender, card, or borrower is described.',
    materials: ['calculator', 'the four fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional household holds four accounts. A car loan of $9,400 at a 7.2% annual percentage rate, secured by the car and repaid on a fixed schedule. A credit card carrying $2,100 at a 22.9% annual percentage rate, unsecured, with a balance the household chooses each month. A personal loan of $3,000 at an 11.5% annual percentage rate, unsecured and on a fixed schedule. A secured credit card with a $500 limit backed by a $500 cash deposit and no balance carried. For each, one month of interest is the annual rate divided by 12, applied to the balance, rounded to the nearest cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is one month of interest on the credit card balance?',
            given: { cardBal: 2100, cardApr: 0.229 }, expr: 'round(cardBal * cardApr / 12, 2)', format: 'usd', answer: '$40.08',
            reasoning: 'One twelfth of the 22.9% rate applied to the $2,100 carried. This is charged for as long as the balance stands, with no end date set by the contract.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is one month of interest on the car loan?',
            given: { carBal: 9400, carApr: 0.072 }, expr: 'round(carBal * carApr / 12, 2)', format: 'usd', answer: '$56.40',
            reasoning: 'One twelfth of 7.2% on $9,400. The balance is more than four times the card’s and the monthly interest is only 41% higher, because the security behind the loan buys a much lower rate.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is one month of interest on the personal loan?',
            given: { loanBal: 3000, loanApr: 0.115 }, expr: 'round(loanBal * loanApr / 12, 2)', format: 'usd', answer: '$28.75',
            reasoning: 'One twelfth of 11.5% on $3,000. Unsecured like the card but on a fixed schedule, and priced between the secured car loan and the revolving card.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look at what a revolving minimum payment does. The fictional card requires a minimum payment of 2% of the balance each month, and applies that payment to the month’s interest first.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the minimum payment on the $2,100 card balance?',
            given: { cardBal2: 2100, minRate: 0.02 }, expr: 'cardBal2 * minRate', format: 'usd', answer: '$42.00',
            reasoning: '2% of the $2,100 balance, which is what the contract requires rather than what retires the debt.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'After the month’s interest is covered, how much of that minimum payment reduces the balance?',
            given: {}, expr: '#t2-p1 - #t1-p1', format: 'usd', answer: '$1.92',
            reasoning: 'The $42.00 minimum less the $40.08 of interest. Paying the minimum on this balance retires under two dollars of what is owed.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the balance never changed, what would a year of interest on the card cost?',
            given: {}, expr: 'round(#t1-p1 * 12, 2)', format: 'usd', answer: '$480.96',
            reasoning: 'Twelve months at $40.08, holding the balance constant. The constant balance is an assumption made to price the carrying cost, not a prediction of what the household will do.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which of the four accounts has no contractual end date by which the balance must be repaid?',
            choices: ['The car loan', 'The credit card', 'The personal loan', 'The secured card deposit'],
            answer: 'The credit card',
            reasoning: 'The car loan and the personal loan are installment credit with a fixed schedule that ends. The secured card carries no balance. Only the revolving credit card can be carried indefinitely, which is the structural feature that makes its rate expensive over time.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The car loan carries the largest balance but the card is the account to worry about. Using the two axes — secured or unsecured, revolving or installment — explain why, and say what the $500 deposit behind the secured card is actually doing.',
            acceptableAnswerCriteria: [
              'Explains that the car loan is secured and on an installment schedule, so its rate is low and its balance is guaranteed to reach zero, while the card is unsecured and revolving, so it is priced higher and has no end date.',
              'Uses the $1.92 figure to show that a minimum payment on revolving credit can leave the balance essentially untouched, which is what makes the structure rather than the amount the problem.',
              'States that the $500 deposit is collateral that converts an unsecured product into a secured one, which is what lets a lender extend credit to a file with no history.',
            ],
            evidenceRequirements: [
              'Uses the $40.08 monthly card interest, the $56.40 monthly car-loan interest, and the $1.92 that the minimum payment retires.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response reasons from the two classification axes rather than from the size of the balances.',
              'The response notes that security lowers a rate because it lowers the lender’s loss if the borrower stops paying, not because it rewards the borrower.',
            ],
            commonMisconception: 'Ranking debts by balance rather than by rate, structure, and whether the schedule ever ends.',
          },
        ],
      },
    ],
    remediation: 'If the minimum payment looks like real progress, compare the two figures side by side: the payment is $42.00 and the month’s interest is $40.08. Subtract before deciding what the payment accomplished, and notice that the $2,100 balance falls to $2,098.08.',
    extension: 'Work out what monthly payment would retire $100 of the card balance in a month, and say how that compares with the required minimum.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l03',
    grade: 10, unit: 4, day: 3,
    actor: 'a fictional borrower watching three months of one fixed payment split',
    objective: 'Carry a fictional installment loan through three months of true amortisation, showing how a fixed payment splits into interest and principal and why the split shifts.',
    scenario: 'The simulated loan below is invented for this exercise. Interest each month is charged on the balance standing at the start of that month, the fixed payment covers that interest first, and whatever remains reduces the balance. This is how an amortising loan actually behaves, and it is not the same as charging a year of interest on the original amount.',
    materials: ['calculator', 'the fictional loan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional borrower owes $6,000 at a 9.6% annual percentage rate and pays a fixed $200 a month. Each month, interest is one twelfth of the annual rate applied to the balance at the start of that month, rounded to the nearest cent. Work through the first month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the interest charged in month 1?',
            given: { bal: 6000, apr: 0.096 }, expr: 'round(bal * apr / 12, 2)', format: 'usd', answer: '$48.00',
            reasoning: 'One twelfth of 9.6% on the $6,000 standing at the start of month 1.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the $200 payment reduces the balance in month 1?',
            given: { payment: 200 }, expr: 'payment - #t1-p1', format: 'usd', answer: '$152.00',
            reasoning: 'The payment covers the $48.00 of interest first; the remainder is principal. Nothing about the payment changes, but this split will.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the start of month 2?',
            given: { bal2: 6000 }, expr: 'bal2 - #t1-p2', format: 'usd', answer: '$5,848.00',
            reasoning: '$6,000 less the $152.00 of principal retired. Next month’s interest will be charged on this smaller figure, which is the whole mechanism.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now carry the same loan through months 2 and 3, using each month’s starting balance.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the interest charged in month 2?',
            given: { apr2: 0.096 }, expr: 'round(#t1-p3 * apr2 / 12, 2)', format: 'usd', answer: '$46.78',
            reasoning: 'One twelfth of 9.6% on the $5,848.00 balance, which is $1.22 less than month 1 charged.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much principal does month 2 retire?',
            given: { payment2: 200 }, expr: 'payment2 - #t2-p1', format: 'usd', answer: '$153.22',
            reasoning: 'The same $200 payment, less the smaller interest charge. The payment did not change; more of it now reaches the balance.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the start of month 3?',
            given: {}, expr: '#t1-p3 - #t2-p2', format: 'usd', answer: '$5,694.78',
            reasoning: '$5,848.00 less the $153.22 retired in month 2.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the interest charged in month 3?',
            given: { apr3: 0.096 }, expr: 'round(#t2-p3 * apr3 / 12, 2)', format: 'usd', answer: '$45.56',
            reasoning: 'One twelfth of 9.6% on the $5,694.78 balance.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much principal does month 3 retire?',
            given: { payment3: 200 }, expr: 'payment3 - #t2-p4', format: 'usd', answer: '$154.44',
            reasoning: 'The remainder of the $200 after $45.56 of interest — $2.44 more principal than month 1 retired, from an identical payment.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'What is the balance at the start of month 4?',
            given: {}, expr: '#t2-p3 - #t2-p5', format: 'usd', answer: '$5,540.34',
            reasoning: '$5,694.78 less the $154.44 retired in month 3.',
          },
          {
            ref: 't2-p7', kind: 'numeric', unit: 'USD',
            text: 'Across the three months, how much of the original $6,000 has actually been repaid?',
            given: { bal3: 6000 }, expr: 'bal3 - #t2-p6', format: 'usd', answer: '$459.66',
            reasoning: '$6,000 against the $5,540.34 still owed. The borrower paid $600.00 over the three months, so $140.34 of it went to interest and never touched the debt.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A classmate says "9.6% of $6,000 is $576, so a year of this loan costs $576 in interest." Explain what that calculation assumes, why the three months you just worked contradict it, and state whether the true first-year interest is above or below $576.',
            acceptableAnswerCriteria: [
              'Identifies the assumption: that the full $6,000 is owed for the whole year, when in fact the balance falls every month as principal is retired.',
              'Uses the worked months as the contradiction — interest fell from $48.00 to $46.78 to $45.56 while the payment stayed at $200 — and concludes the true first-year interest is below $576.',
              'Notes that the simple calculation would be correct only for a loan on which nothing is repaid until the end of the year, which is a different product from this one.',
            ],
            evidenceRequirements: [
              'Uses at least two of the three monthly interest figures and the $459.66 of principal retired.',
            ],
            dimensions: ['error-diagnosis', 'assumption-identification', 'reasoning-from-figures'],
            lookFors: [
              'The response names the declining balance as the reason, not rounding or fees.',
              'The response recognises that the classmate’s method is not nonsense; it is the right method for a different loan structure.',
            ],
            commonMisconception: 'Pricing an amortising loan by applying its annual rate once to the amount originally borrowed.',
          },
        ],
      },
    ],
    remediation: 'If every month’s interest comes out as $48.00, the rate is being applied to the original $6,000 each time. Month 2 charges interest on $5,848.00, because that is what is owed when month 2 begins. Recompute each month from the balance the previous month left behind.',
    extension: 'Carry this loan two more months and describe, in one sentence, what is happening to the gap between the interest and principal portions of the same $200 payment.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l04',
    grade: 10, unit: 4, day: 4,
    actor: 'a fictional applicant reading one simulated aid offer',
    objective: 'Separate a fictional aid package into gift aid, earned aid, and borrowed aid, compute the gap the package leaves, and quantify how much of the offer must be repaid.',
    scenario: 'The simulated aid offer below is invented for this exercise. No real institution, aid formula, or applicant is described, and no learner is asked for family financial information.',
    materials: ['calculator', 'the fictional aid offer in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional aid offer lists a cost of attendance of $21,400 for one year and five lines of aid: a $6,800 grant, a $3,500 scholarship, $2,600 of work study, a $3,500 subsidised loan, and a $2,000 unsubsidised loan. Grants and scholarships are gift aid and are not repaid. Work study is money earned by working an assigned job during the year. Both loans are repaid with interest.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total gift aid in the offer?',
            given: { grant: 6800, scholarship: 3500 }, expr: 'grant + scholarship', format: 'usd', answer: '$10,300.00',
            reasoning: 'The $6,800 grant plus the $3,500 scholarship. This is the only part of the offer that reduces the cost outright.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the net price — the cost of attendance after gift aid only?',
            given: { coa: 21400 }, expr: 'coa - #t1-p1', format: 'usd', answer: '$11,100.00',
            reasoning: '$21,400 of cost less $10,300.00 of gift aid. This is the figure that has to be covered by earning, borrowing, or paying.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the three self-help lines — work study and the two loans — come to?',
            given: { workStudy: 2600, sub: 3500, unsub: 2000 }, expr: 'workStudy + sub + unsub', format: 'usd', answer: '$8,100.00',
            reasoning: '$2,600 of work study plus $3,500 of subsidised loan plus $2,000 of unsubsidised loan. All three appear on the offer as "aid" but none of them lower what the year costs.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what the package does not cover, and how much of it is debt.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What gap remains after every line of the offer is used?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$3,000.00',
            reasoning: 'The $11,100.00 net price less the $8,100.00 of self-help aid. This gap is not listed anywhere on the offer, and it is the number the applicant most needs.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of every line the offer calls aid?',
            given: {}, expr: '#t1-p1 + #t1-p3', format: 'usd', answer: '$18,400.00',
            reasoning: '$10,300.00 of gift aid plus $8,100.00 of self-help aid — the headline total an offer letter would lead with.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of that headline total has to be repaid?',
            given: { sub2: 3500, unsub2: 2000 }, expr: '(sub2 + unsub2) / #t2-p2 * 100', format: 'percent2', answer: '29.89%',
            reasoning: 'The $5,500 of loans against the $18,400.00 headline. Close to three dollars in ten of this "aid" is debt, and the work study is a fourth kind again — earned, not given and not borrowed.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which line of the offer requires the applicant to do scheduled work during the year to receive the money?',
            choices: ['The grant', 'The scholarship', 'The work study', 'The subsidised loan'],
            answer: 'The work study',
            reasoning: 'Work study pays for hours worked in an assigned job, so the money arrives only as the work is done. Grants and scholarships require no work and no repayment, and the loans require repayment but no work.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The offer says $18,400.00 of aid. Write two sentences you would use to explain to a fictional applicant what that number actually means, and name the one figure you would want added to the letter.',
            acceptableAnswerCriteria: [
              'Explains that the headline bundles three different things — money given, money earned by working, and money borrowed — and that only the $10,300.00 of gift aid lowers what the year costs.',
              'Names the missing figure as the remaining gap of $3,000.00, or equivalently the net price after all aid, and says why an offer letter that omits it can be read as covering the full cost.',
              'Notes that the $2,600 of work study depends on actually working the assigned hours, so it is not guaranteed in the way a grant is.',
            ],
            evidenceRequirements: [
              'Uses the $18,400.00 headline, the $10,300.00 of gift aid, and the $3,000.00 gap.',
            ],
            dimensions: ['criteria-application', 'evidence-use', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes all three categories, not just gift aid against loans.',
              'The response does not describe the offer as dishonest; every line is disclosed, and the issue is what the total invites a reader to conclude.',
            ],
            commonMisconception: 'Reading a single "total aid" figure as the amount by which the cost of attending has been reduced.',
          },
        ],
      },
    ],
    remediation: 'If the gap comes out as zero, the loans and work study are being treated as though they lower the cost. Take only the $10,300.00 of gift aid off the $21,400 cost first. What remains, $11,100.00, is what the applicant has to cover — and the $8,100.00 of self-help aid covers all but $3,000.00 of it.',
    extension: 'Recompute the gap if the scholarship is renewable for only one year while the cost of attendance stays the same, and say what the applicant should ask the fictional institution before accepting.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l05',
    grade: 10, unit: 4, day: 5,
    actor: 'a fictional student holding the same amount under three different loan terms',
    objective: 'Compute what the same fictional principal owes at the start of repayment under subsidised, unsubsidised, and private terms, and attribute the whole difference to in-school interest treatment.',
    scenario: 'The three simulated loans below are invented for this exercise. In this model, interest accrues at a simple annual rate during the in-school and grace period and is added to the principal once when repayment begins. Real loans vary in how often interest capitalises, and a real schedule can capitalise more than once.',
    materials: ['calculator', 'the three fictional loan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Three fictional loans of $3,500 each. The subsidised federal loan is charged 5.5% but no interest accrues during the 4.5 years of school and grace, so nothing is added. The unsubsidised federal loan is charged the same 5.5%, and interest does accrue over those 4.5 years. The private loan is charged 10.9% and interest accrues over the same 4.5 years.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest accrues on the unsubsidised loan before repayment begins?',
            given: { principal: 3500, fedRate: 0.055, years: 4.5 }, expr: 'principal * fedRate * years', format: 'usd', answer: '$866.25',
            reasoning: '5.5% of $3,500 for each of 4.5 years, at a simple rate. This accrues while the student is enrolled and earning nothing from the loan.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the unsubsidised borrower owe when repayment begins?',
            given: { principal2: 3500 }, expr: 'principal2 + #t1-p1', format: 'usd', answer: '$4,366.25',
            reasoning: 'The $3,500 borrowed plus the $866.25 accrued, capitalised once. From this point interest is charged on the larger figure, which is what capitalisation means.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much interest accrues on the private loan before repayment begins?',
            given: { principal3: 3500, privRate: 0.109, years2: 4.5 }, expr: 'principal3 * privRate * years2', format: 'usd', answer: '$1,716.75',
            reasoning: '10.9% of $3,500 for 4.5 years. The same borrowed amount over the same period, at roughly double the rate.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the three at the moment repayment starts. The subsidised borrower still owes exactly the $3,500 borrowed.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the private borrower owe when repayment begins?',
            given: { principal4: 3500 }, expr: 'principal4 + #t1-p3', format: 'usd', answer: '$5,216.75',
            reasoning: 'The $3,500 borrowed plus $1,716.75 of accrued interest, capitalised once.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more does the private borrower owe than the unsubsidised federal borrower?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$850.50',
            reasoning: '$5,216.75 against $4,366.25. Both borrowed the same amount for the same time; the gap is entirely the rate difference over the in-school period.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The private balance is what percentage of the subsidised balance at that same moment?',
            given: { subBal: 3500 }, expr: '#t2-p1 / subBal * 100', format: 'percent2', answer: '149.05%',
            reasoning: '$5,216.75 against the $3,500 the subsidised borrower still owes. Before a single repayment has been made, one borrower owes about half again as much as the other on identical borrowing.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which loan owes the most at the moment repayment begins?',
            choices: ['The subsidised federal loan', 'The unsubsidised federal loan', 'The private loan'],
            given: {},
            decision: { left: '#t2-p1', cmp: '>', right: '#t1-p2', ifTrue: 'The private loan', ifFalse: 'The unsubsidised federal loan' },
            answer: 'The private loan',
            reasoning: 'At $5,216.75 the private loan exceeds the unsubsidised loan’s $4,366.25, and both exceed the subsidised loan’s unchanged $3,500. The ordering was fixed before repayment started.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'All three fictional students borrowed $3,500 and none of them made a payment during school, yet they owe three different amounts on the first day of repayment. Explain what a subsidy actually pays for, and say what a borrower could do during school to make the unsubsidised loan behave more like the subsidised one.',
            acceptableAnswerCriteria: [
              'Explains that the subsidy is the government paying the interest that accrues during the in-school and grace period, so the balance does not grow, rather than a lower rate — both federal loans here are charged 5.5%.',
              'States the concrete action: paying the interest as it accrues during school prevents it from capitalising, so repayment starts on the $3,500 rather than on $4,366.25.',
              'Notes that the private loan’s gap comes from its 10.9% rate rather than from a missing subsidy, so the two effects are different and stack.',
            ],
            evidenceRequirements: [
              'Uses the $3,500 principal shared by all three and at least two of the three repayment-start balances.',
            ],
            dimensions: ['reasoning-from-figures', 'transfer', 'tradeoff-defense'],
            lookFors: [
              'The response separates the subsidy from the rate; both federal loans carry the same rate.',
              'The response recognises that paying interest during school means finding the money during school, which is the cost of that choice.',
            ],
            commonMisconception: 'Believing a subsidised loan simply carries a lower interest rate than an unsubsidised one.',
          },
        ],
      },
    ],
    remediation: 'If all three loans come out at $3,500, no interest has been accrued. Only the subsidised loan has its in-school interest paid for it. Apply the stated rate to $3,500 across the full 4.5 years for each of the other two, and add the result to the principal.',
    extension: 'Work out what the unsubsidised borrower would owe at repayment if they paid the accruing interest every year during school, and say how much capitalisation itself cost them.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l06',
    grade: 10, unit: 4, day: 6,
    actor: 'a fictional borrower comparing a short-term fee-priced loan with a rate-priced one',
    objective: 'Convert a fictional short-term loan fee into an annualised rate, compute what renewal costs, and compare the result with a rate-priced alternative for the same borrowed amount.',
    scenario: 'The simulated short-term lender and the simulated credit-union alternative below are invented for this exercise. No real lender is described, and the pattern shown is a teaching example rather than a claim about any actual product.',
    materials: ['calculator', 'the two fictional loan offers in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional short-term lender advances $400 and charges a flat $60 fee, due with the principal at the end of a 14-day term. The lender advertises the $60 as a fee rather than as interest. If the borrower cannot repay, the loan is renewed for another 14 days for another $60 fee, and the principal does not fall.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'The $60 fee is what percentage of the $400 advanced?',
            given: { fee: 60, borrowed: 400 }, expr: 'fee / borrowed * 100', format: 'percent2', answer: '15.00%',
            reasoning: 'The fee measured against the principal. Presented on its own this reads as a modest charge, because nothing in it mentions the 14-day term.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'Annualise that charge: what rate is 15.00% for 14 days, over a 365-day year?',
            given: { fee2: 60, borrowed2: 400, term: 14 }, expr: 'fee2 / borrowed2 * (365 / term) * 100', format: 'percent2', answer: '391.07%',
            reasoning: 'The 14-day charge scaled to a year. Annualising is what makes a fee-priced loan comparable with a rate-priced one, and it is why the term length matters as much as the fee.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'The borrower renews 5 times, so 6 fees are charged in total. What do the fees come to?',
            given: { fee3: 60, renewals: 6 }, expr: 'fee3 * renewals', format: 'usd', answer: '$360.00',
            reasoning: '6 fees of $60. Each renewal buys another 14 days and retires none of the $400, so the fees accumulate against an unchanged principal.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare with a fictional credit-union small-dollar loan of the same $400 at a 28% annual percentage rate. This loan is repaid in a single payment at the end of 3 months, so the whole $400 is held for the full term and interest is charged at the annual rate for the months held. That is why simple interest on the full principal is the right model here, and not for a loan repaid in instalments.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'After the 5 renewals, what does the borrower owe in total, including the principal?',
            given: { borrowed3: 400 }, expr: 'borrowed3 + #t1-p3', format: 'usd', answer: '$760.00',
            reasoning: 'The original $400, which never fell, plus $360.00 of accumulated fees — after roughly three months of renewals.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would 3 months on the fictional credit-union loan cost in interest?',
            given: { borrowed4: 400, cuApr: 0.28, months: 3 }, expr: 'round(borrowed4 * cuApr * months / 12, 2)', format: 'usd', answer: '$28.00',
            reasoning: '28% of $400 for a quarter of a year. A 28% annual rate sounds high on its own and is a small fraction of what the fee-priced loan charged over the same period.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more did the short-term loan cost over the six fee periods, which run about as long as the credit-union loan’s 3 months?',
            given: {}, expr: '#t1-p3 - #t2-p2', format: 'usd', answer: '$332.00',
            reasoning: '$360.00 of fees against $28.00 of interest on the same $400 for the same period.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which feature of the fictional short-term loan is the warning sign that the fee alone does not reveal?',
            choices: [
              'That the charge is called a fee rather than interest',
              'That renewing costs another full fee while the principal never falls',
              'That the loan is for only $400',
            ],
            answer: 'That renewing costs another full fee while the principal never falls',
            reasoning: 'What the fee label hides is the structure behind it: a term short enough that repayment is unlikely, and a renewal that charges again without retiring any principal. A single $60 fee on a loan that is actually repaid in 14 days would not produce the $360.00 total.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Name the two features that made the fictional short-term loan expensive, and explain why annualising the fee is a fairer comparison than reading the $60 next to the $400. Say what question a borrower should ask about any charge quoted as a flat fee.',
            acceptableAnswerCriteria: [
              'Names both features: the very short term, which makes the 15.00% charge recur often, and the renewal structure, which charges a full fee again without reducing the principal.',
              'Explains that annualising puts a fee-priced and a rate-priced loan on the same basis, which is why $360.00 and $28.00 can be compared at all.',
              'States the question to ask: over what period does this fee apply, and what happens to the principal and the fee if the loan is not repaid at the end of that period.',
            ],
            evidenceRequirements: [
              'Uses the 391.07% annualised figure and the $360.00 against $28.00 comparison.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'error-diagnosis'],
            lookFors: [
              'The response identifies the term length as doing as much work as the fee size.',
              'The response does not treat the borrower as having made an obvious mistake; the structure is what is being examined.',
            ],
            commonMisconception: 'Judging the cost of borrowing from the size of a fee without asking what period the fee buys.',
          },
        ],
      },
    ],
    remediation: 'If the annualised rate comes out near 15%, the 14-day term has not been accounted for. A 15.00% charge every 14 days is not a 15% annual charge: there are about 26 such periods in a 365-day year. Multiply the 15.00% by 365 divided by 14.',
    extension: 'Work out how many renewals it would take for the accumulated fees to exceed the $400 originally advanced, and say what that says about the relationship between the fee and the principal.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l07',
    grade: 10, unit: 4, day: 7,
    actor: 'a fictional student who wrote three confident and incorrect claims about credit files',
    objective: 'Test three fictional claims about credit reporting against computed figures, and identify which one costs money and which one only costs accuracy.',
    scenario: 'The three simulated claims below were written by a fictional student for this exercise and are deliberately wrong. No real credit bureau, scoring model, or credit file is described, and no learner is asked about their own credit.',
    materials: ['calculator', 'the fictional claims in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional student’s first claim: "You have to carry a balance to build credit, so leaving $1,500 on the card is the smart move." The fictional card charges a 24.9% annual percentage rate, with one month of interest computed as one twelfth of that rate on the balance, rounded to the nearest cent. Assume the balance is held at $1,500 all year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does one month of carrying that balance cost?',
            given: { bal: 1500, apr: 0.249 }, expr: 'round(bal * apr / 12, 2)', format: 'usd', answer: '$31.13',
            reasoning: 'One twelfth of 24.9% on $1,500. Paying the statement in full each month would have cost nothing, and a card reports the same activity either way.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of carrying it cost, charging each month and rounding to the cent?',
            given: {}, expr: 'round(#t1-p1 * 12, 2)', format: 'usd', answer: '$373.56',
            reasoning: 'Twelve monthly charges of $31.13. This is the price of the student’s first claim, and it buys nothing that paying in full would not also have produced.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The student’s second claim: "Closing my oldest card will tidy up my file and help my score." The fictional file has $1,900 of balances against $9,500 of total limits. Closing the card removes $3,500 of limit, leaving $6,000, and the balances do not change. The third claim: "I should not check my own report, because every check lowers the score." In the fictional model, a borrower requesting their own report is recorded as a review that carries no scoring weight, while a lender’s request in an application does carry weight.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the utilisation before the card is closed?',
            given: { owed: 1900, limitsBefore: 9500 }, expr: 'owed / limitsBefore * 100', format: 'percent2', answer: '20.00%',
            reasoning: '$1,900 of balances against $9,500 of limits.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What is the utilisation after the card is closed?',
            given: { owed2: 1900, limitsAfter: 6000 }, expr: 'owed2 / limitsAfter * 100', format: 'percent2', answer: '31.67%',
            reasoning: 'The same $1,900 against $6,000 of remaining limits. The borrower did not spend anything; the denominator shrank.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percentage points',
            text: 'By how many percentage points did closing the card move utilisation? Give the number of points, without a percent sign.',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'dec2', answer: '11.67',
            reasoning: '31.67% against 20.00%, a rise of 11.67 percentage points. Closing an account raises utilisation whenever a balance remains anywhere on the file, which is the opposite of tidying up. Percentage points are the right unit for the gap between two rates; calling it 11.67% would invite reading it as a proportion of the 20.00%.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Under the stated fictional model, which of the student’s three claims is simply false rather than costly?',
            choices: [
              'That a balance must be carried to build credit',
              'That closing the oldest card helps the score',
              'That checking your own report lowers the score',
            ],
            answer: 'That checking your own report lowers the score',
            reasoning: 'The model states that a borrower’s own request carries no scoring weight, so acting on that belief costs nothing directly — it only stops someone from finding errors in their own file. The other two claims each cost money or score.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Correct each of the three claims in one sentence, then rank them by how much acting on them would cost over a year and defend the ranking with figures.',
            acceptableAnswerCriteria: [
              'Corrects all three: a card reports activity whether or not a balance is carried, closing an account removes limit and raises utilisation, and a person checking their own file is not scored for it.',
              'Ranks the carried balance first at $373.56 a year of interest, with the closed card second because its rise of 11.67 percentage points in utilisation costs score rather than cash.',
              'Argues that the third claim costs nothing directly but has its own risk: someone who never checks their file will not find an error on it.',
            ],
            evidenceRequirements: [
              'Uses the $373.56 annual carrying cost and both utilisation figures.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response distinguishes a cost in dollars from a cost in score, rather than treating all three errors as equivalent.',
              'The response does not claim that closing a card always hurts; it hurts here because balances remain on the file.',
            ],
            commonMisconception: 'Believing that debt must be carried, and interest paid, for a credit file to develop.',
          },
        ],
      },
    ],
    remediation: 'If closing the card looks like it should help, write the utilisation as a fraction and change only what actually changed. The $1,900 of balances stays where it is; the $9,500 of limits falls to $6,000. A smaller denominator over the same numerator is a larger ratio, and utilisation rises from 20.00% to 31.67%.',
    extension: 'Work out how much of the $1,900 balance would have to be repaid to hold utilisation at 20.00% after the card is closed, and say which is easier: keeping the account open or finding that money.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l08',
    grade: 10, unit: 4, day: 8,
    actor: 'a fictional shopper offered a deferred-interest promotion at a checkout',
    objective: 'Apply the revolving-credit model to a deferred-interest offer, compute what a small remaining balance triggers, and express the result as the cost of the final payment.',
    scenario: 'The simulated store promotion below is invented for this exercise. Under its stated terms, no interest is charged if the full purchase is repaid within the promotional period, and if any balance remains at the end of it, interest is charged on the entire original purchase amount for the whole promotional period.',
    materials: ['calculator', 'the fictional promotion terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional shopper buys an $1,800 item under a promotion offering no interest for 12 months. The promotional rate is 26.99%, and under the stated terms it applies to the full original purchase amount for the whole 12 months if any balance is left at the end. The shopper plans to clear the purchase in equal monthly amounts across the 12 months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What equal monthly payment clears the purchase within the promotional period?',
            given: { price: 1800 }, expr: 'price / 12', format: 'usd', answer: '$150.00',
            reasoning: 'The $1,800 purchase spread across the 12 promotional months. Paying exactly this each month costs nothing in interest under the stated terms.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'The shopper misses the final payment, leaving $150 outstanding at the end of month 12. Under the stated terms, what interest is charged?',
            given: { price2: 1800, defApr: 0.2699 }, expr: 'round(price2 * defApr, 2)', format: 'usd', answer: '$485.82',
            reasoning: '26.99% applied to the entire original $1,800 for the full 12 months, exactly as the promotion’s terms state — not to the $150 still outstanding.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the shopper now owe in total at the end of month 12?',
            given: { remaining: 150 }, expr: '#t1-p2 + remaining', format: 'usd', answer: '$635.82',
            reasoning: 'The $485.82 of retroactive interest plus the $150 that was still outstanding.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put a price on the missed payment itself.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'The retroactive interest is how many times the $150 that was left unpaid? Round to two decimal places.',
            given: { remaining2: 150 }, expr: 'round(#t1-p2 / remaining2, 2)', format: 'dec2', answer: '3.24',
            reasoning: '$485.82 against the $150 outstanding. Missing the last payment cost more than three times the payment itself, because the trigger is whether a balance remains rather than how large it is.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'Counting the retroactive interest, the shopper paid what percentage of the sticker price?',
            given: { price3: 1800 }, expr: '(#t1-p2 + price3) / price3 * 100', format: 'percent2', answer: '126.99%',
            reasoning: 'The $1,800 price plus $485.82 of interest, against the $1,800 price. The whole promotional rate lands at once, which is exactly what "deferred" rather than "waived" means.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Under the stated terms, what determines whether the interest is charged?',
            choices: [
              'How large the remaining balance is at the end of the promotion',
              'Whether any balance at all remains at the end of the promotion',
              'How many payments were made during the promotion',
            ],
            answer: 'Whether any balance at all remains at the end of the promotion',
            reasoning: 'The terms make it a threshold, not a proportion: a balance of $150 and a balance of $5 trigger the same $485.82 charge, and eleven payments made on time do not reduce it.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain the difference between interest that is waived and interest that is deferred, and say what a shopper should set up at the moment of purchase so that this promotion behaves the way it appears to.',
            acceptableAnswerCriteria: [
              'Distinguishes the two: waived interest is never owed, while deferred interest is accruing throughout and is cancelled only if the condition is met exactly.',
              'Names a concrete safeguard set up at purchase — an automatic payment above the $150 required, or a plan to clear the balance a month early — and explains that it protects against the threshold rather than against the rate.',
              'Uses the $485.82 figure to show that the safeguard is worth far more than the small amounts involved in setting it up.',
            ],
            evidenceRequirements: [
              'Uses the $150.00 required monthly payment and the $485.82 retroactive charge.',
            ],
            dimensions: ['transfer', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the all-or-nothing threshold as the feature that matters.',
              'The response does not describe the promotion as hidden; the terms are stated, and the point is what they mean when read.',
            ],
            commonMisconception: 'Reading "no interest for 12 months" as interest that cannot be charged for that period, rather than as interest that is being held back on a condition.',
          },
        ],
      },
    ],
    remediation: 'If the retroactive interest is computed on the $150 left over, read the promotion’s terms again: the rate applies to the entire original purchase amount for the whole promotional period. The base is the $1,800 that was bought, not the balance that happened to remain.',
    extension: 'Work out what monthly payment would have cleared the purchase in 11 months instead of 12, and say what that extra margin is worth given the $485.82 at stake.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l09',
    grade: 10, unit: 4, day: 9,
    actor: 'a fictional borrower choosing between a three-year and a five-year term',
    objective: 'Compute the level payment that amortises the same fictional loan over two different terms, compare total interest, and state the tradeoff the longer term buys.',
    scenario: 'The simulated loan below is invented for this exercise. The level payment is the one that reduces the balance to zero over the stated number of months when interest is charged each month on the balance outstanding. The payment is rounded to the nearest cent, and totals below assume every payment equals that rounded figure; a real final payment absorbs the few cents of difference.',
    materials: ['calculator', 'the fictional loan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional borrower needs $12,000 at a 6.6% annual percentage rate, with interest charged each month on the outstanding balance at one twelfth of the annual rate. The lender offers a 36-month term and a 60-month term. The level payment is the loan amount times the monthly rate times the growth factor over the term, divided by that growth factor less one.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the level monthly payment over the 36-month term? Round to the nearest cent.',
            given: { loan: 12000, apr: 0.066 }, expr: 'round(loan * (apr / 12) * pow(1 + apr / 12, 36) / (pow(1 + apr / 12, 36) - 1), 2)', format: 'usd', answer: '$368.33',
            reasoning: 'The payment that exactly retires $12,000 over 36 months while interest accrues monthly on the falling balance.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is paid in total over the 36-month term?',
            given: {}, expr: 'round(#t1-p1 * 36, 2)', format: 'usd', answer: '$13,259.88',
            reasoning: '36 payments of $368.33, on the stated assumption that every payment equals the rounded figure.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of that is interest?',
            given: { loan2: 12000 }, expr: '#t1-p2 - loan2', format: 'usd', answer: '$1,259.88',
            reasoning: 'Total paid less the $12,000 borrowed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for the 60-month term and compare the two.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the level monthly payment over the 60-month term? Round to the nearest cent.',
            given: { loan3: 12000, apr2: 0.066 }, expr: 'round(loan3 * (apr2 / 12) * pow(1 + apr2 / 12, 60) / (pow(1 + apr2 / 12, 60) - 1), 2)', format: 'usd', answer: '$235.36',
            reasoning: 'The same loan and the same rate spread over 60 months instead of 36.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is paid in total over the 60-month term?',
            given: {}, expr: 'round(#t2-p1 * 60, 2)', format: 'usd', answer: '$14,121.60',
            reasoning: '60 payments of $235.36, on the same rounding assumption.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of that is interest?',
            given: { loan4: 12000 }, expr: '#t2-p2 - loan4', format: 'usd', answer: '$2,121.60',
            reasoning: 'Total paid less the same $12,000 borrowed.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more interest does the longer term cost?',
            given: {}, expr: '#t2-p3 - #t1-p3', format: 'usd', answer: '$861.72',
            reasoning: '$2,121.60 against $1,259.88. The rate is identical; the money is simply borrowed for longer.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much smaller is the monthly payment on the longer term?',
            given: {}, expr: '#t1-p1 - #t2-p1', format: 'usd', answer: '$132.97',
            reasoning: '$368.33 against $235.36 — what the extra $861.72 of interest buys, month by month.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The longer term costs $861.72 more and frees $132.97 a month. Argue for one of the two terms for a fictional borrower whose income is steady but whose monthly margin is thin, and name what your choice risks.',
            acceptableAnswerCriteria: [
              'Chooses a term and defends it with both figures, treating the $861.72 as the price of the $132.97 of monthly room rather than as a mistake either way.',
              'Names the risk of the chosen side specifically: the 36-month term risks missed payments if the thin margin disappears, and the 60-month term risks paying $861.72 more and owing on the loan for two additional years.',
              'Notes that the same rate produced both figures, so the difference is entirely the length of time the money is borrowed, not a worse deal.',
            ],
            evidenceRequirements: [
              'Uses both monthly payments and both total-interest figures.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'Either term is defensible; what is scored is whether the cost of the choice is named in figures.',
              'The response recognises that a payment which cannot be made reliably is worse than a larger total, and does not treat the cheapest total as automatically correct.',
            ],
            commonMisconception: 'Choosing a loan term by the monthly payment alone, without pricing what the extra months of borrowing cost.',
          },
        ],
      },
    ],
    remediation: 'If total interest comes out as $12,000 times 6.6% times the number of years, the balance is being treated as though it never falls. This loan is repaid every month, so the balance that interest is charged on shrinks throughout. Use the level payment, multiply it by the number of payments, and subtract the $12,000 borrowed.',
    extension: 'Work out the total interest on a 48-month term at the same rate, and say whether the extra interest per additional year of term is constant as the term lengthens.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l10',
    grade: 10, unit: 4, day: 10,
    actor: 'a fictional applicant financing a two-year pathway end to end',
    objective: 'Build a complete two-year financing plan for a fictional pathway from gift aid, work study, and loans, then compute the repayment shape of the debt it creates.',
    scenario: 'The simulated two-year pathway, its costs, and its aid are invented for this exercise. In-school interest on the unsubsidised balance accrues at a simple annual rate and capitalises once at repayment, and the repayment figures assume every monthly payment equals the rounded level payment. No real institution or applicant is described.',
    materials: ['calculator', 'the fictional pathway figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional two-year pathway costs $16,900 a year. Each year the applicant receives a $5,200 grant, a $2,000 scholarship, $3,000 of work study, a $3,500 subsidised loan, and a $2,000 unsubsidised loan. Over the two years that is $7,000 of subsidised borrowing and $4,000 of unsubsidised borrowing.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the pathway cost over the two years?',
            given: { coaYear: 16900 }, expr: 'coaYear * 2', format: 'usd', answer: '$33,800.00',
            reasoning: 'Two years at $16,900. This is the figure every other line has to be measured against.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total gift aid over the two years?',
            given: { grantYear: 5200, scholarYear: 2000 }, expr: '(grantYear + scholarYear) * 2', format: 'usd', answer: '$14,400.00',
            reasoning: 'The $5,200 grant and $2,000 scholarship in each of two years. This is the only part that reduces the cost outright.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total self-help aid — work study and both loans — over the two years?',
            given: { workYear: 3000, subYear: 3500, unsubYear: 2000 }, expr: '(workYear + subYear + unsubYear) * 2', format: 'usd', answer: '$17,000.00',
            reasoning: '$3,000 of work study, $3,500 of subsidised loan, and $2,000 of unsubsidised loan in each of two years. Every dollar of this is earned or repaid.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now finish the plan. The $4,000 of unsubsidised borrowing actually arrives as $2,000 in each of the two years; this model collapses that into a single balance accruing 5.5% simple interest for 1.5 years, which is the average time the two halves are outstanding, and capitalising once. A real schedule tracks each disbursement separately. Both federal loans are then repaid together at 5.5% over 120 months, on the level-payment basis used earlier in this unit.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What gap remains after every line of aid is used across the two years?',
            given: {}, expr: '#t1-p1 - #t1-p2 - #t1-p3', format: 'usd', answer: '$2,400.00',
            reasoning: '$33,800.00 of cost less $14,400.00 of gift aid and $17,000.00 of self-help aid. The applicant has to find this from earnings, family, or further borrowing.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest accrues on the unsubsidised balance before repayment begins?',
            given: { unsubTotal: 4000, fedRate: 0.055, accrual: 1.5 }, expr: 'unsubTotal * fedRate * accrual', format: 'usd', answer: '$330.00',
            reasoning: '5.5% of $4,000 across 1.5 years at a simple rate. The subsidised $7,000 accrues nothing over the same period.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total federal balance when repayment begins?',
            given: { subTotal: 7000, unsubTotal2: 4000 }, expr: 'subTotal + unsubTotal2 + #t2-p2', format: 'usd', answer: '$11,330.00',
            reasoning: '$7,000 subsidised plus $4,000 unsubsidised plus the $330.00 that capitalised onto it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the level monthly payment over 120 months at 5.5%? Round to the nearest cent.',
            given: { fedRate2: 0.055 }, expr: 'round(#t2-p3 * (fedRate2 / 12) * pow(1 + fedRate2 / 12, 120) / (pow(1 + fedRate2 / 12, 120) - 1), 2)', format: 'usd', answer: '$122.96',
            reasoning: 'The payment that retires the $11,330.00 balance over 120 months with interest charged monthly on the falling balance.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What is repaid in total over the 120 months?',
            given: {}, expr: 'round(#t2-p4 * 120, 2)', format: 'usd', answer: '$14,755.20',
            reasoning: '120 payments of $122.96, on the stated rounding assumption.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'How much of that total is interest?',
            given: {}, expr: '#t2-p5 - #t2-p3', format: 'usd', answer: '$3,425.20',
            reasoning: '$14,755.20 repaid against the $11,330.00 owed at repayment. Note that the $330.00 of capitalised interest is inside the $11,330.00 and therefore earns interest of its own.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Report this plan in four sentences: what the pathway costs, what is given, what is owed, and what repaying it looks like. Then name the single change to the package that would most reduce the total repaid, and defend it with a figure.',
            acceptableAnswerCriteria: [
              'Reports the plan accurately: $33,800.00 of cost, $14,400.00 of gift aid, $11,330.00 owed at repayment, and $14,755.20 repaid over 120 months at $122.96 a month.',
              'Names a specific change — more gift aid, less unsubsidised borrowing, paying the in-school interest, or a shorter repayment term — and supports it with the relevant figure rather than a general preference.',
              'Recognises that the $2,400.00 gap is unfunded in this plan and must come from somewhere, so a complete report cannot stop at the aid lines.',
            ],
            evidenceRequirements: [
              'Uses the $33,800.00 cost, the $11,330.00 repayment-start balance, and the $3,425.20 of interest.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response treats work study as earned income requiring hours worked, not as a discount on the cost.',
              'The response notices that the $330.00 of capitalised interest goes on to earn interest itself over the repayment period.',
            ],
            commonMisconception: 'Treating a financing plan as complete once the aid lines are listed, without computing the gap or the repayment.',
          },
        ],
      },
    ],
    remediation: 'If the repayment-start balance comes out as $11,000.00, the in-school accrual has been left out. The subsidised $7,000 accrues nothing, but the unsubsidised $4,000 accrues 5.5% for 1.5 years and that $330.00 capitalises onto the balance before the first payment is due.',
    extension: 'Recompute the monthly payment and total repaid if the applicant pays the unsubsidised interest during school instead of letting it capitalise, and say how much of the saving comes from the $330.00 itself and how much from the interest it would have earned.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u04-l11',
    grade: 10, unit: 4, day: 11,
    actor: 'a fictional student defending an order in which to accept borrowing',
    objective: 'Price two orders of borrowing the same fictional amount, defend the cheaper order from the figures, and identify the condition under which the defence would not hold.',
    scenario: 'The simulated loan options below are invented for this exercise. Interest accrues at a simple annual rate over the in-school and grace period and capitalises once at repayment, as elsewhere in this unit.',
    materials: ['calculator', 'the fictional borrowing options in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional student needs $6,000 for one year and can take it two ways. Order A takes the federal money first: a $3,500 subsidised loan on which no interest accrues in school, plus a $2,500 unsubsidised loan at 5.5%. Order B takes a single $6,000 private loan at 10.9%. Both are held for 4.5 years of school and grace before repayment begins.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'Under Order A, how much interest accrues on the unsubsidised portion?',
            given: { unsub: 2500, fedRate: 0.055, years: 4.5 }, expr: 'unsub * fedRate * years', format: 'usd', answer: '$618.75',
            reasoning: '5.5% of $2,500 across 4.5 years. The $3,500 subsidised portion accrues nothing over the same period.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Order A owe when repayment begins?',
            given: { sub: 3500, unsub2: 2500 }, expr: 'sub + unsub2 + #t1-p1', format: 'usd', answer: '$6,618.75',
            reasoning: 'The $3,500 subsidised and $2,500 unsubsidised principals plus the $618.75 that accrued and capitalised.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Under Order B, how much interest accrues on the private loan?',
            given: { priv: 6000, privRate: 0.109, years2: 4.5 }, expr: 'priv * privRate * years2', format: 'usd', answer: '$2,943.00',
            reasoning: '10.9% of the whole $6,000 across 4.5 years, with no subsidised portion sheltered from accrual.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two orders at the moment repayment begins.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Order B owe when repayment begins?',
            given: { priv2: 6000 }, expr: 'priv2 + #t1-p3', format: 'usd', answer: '$8,943.00',
            reasoning: 'The $6,000 borrowed plus $2,943.00 of accrued interest, capitalised once.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more does Order B owe than Order A?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$2,324.25',
            reasoning: '$8,943.00 against $6,618.75. The same $6,000 was borrowed for the same 4.5 years; only the order of acceptance differed.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'Order B’s balance is what percentage of Order A’s?',
            given: {}, expr: '#t2-p1 / #t1-p2 * 100', format: 'percent2', answer: '135.12%',
            reasoning: '$8,943.00 measured against $6,618.75 — about a third more owed before the first payment is made.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which feature of Order A accounts for the larger share of the $2,324.25 difference?',
            choices: [
              'That $3,500 of it accrues no interest during school',
              'That its rate is 5.5% rather than 10.9%',
              'That it is split across two loans rather than one',
            ],
            given: { subShelter: 3500, unsubGap: 2500, privRate4: 0.109, fedRate3: 0.055, years3: 4.5 },
            decision: { left: 'subShelter * privRate4 * years3', cmp: '>', right: 'unsubGap * (privRate4 - fedRate3) * years3', ifTrue: 'That $3,500 of it accrues no interest during school', ifFalse: 'That its rate is 5.5% rather than 10.9%' },
            answer: 'That $3,500 of it accrues no interest during school',
            reasoning: 'The $3,500 subsidised portion avoids the whole 10.9% it would have carried under Order B, worth $1,716.75 across 4.5 years, while the rate advantage on the remaining $2,500 is the 5.4 percentage point gap, worth $607.50. The subsidy is the larger effect, and splitting into two loans is not itself worth anything.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Defend the rule "take federal aid before private borrowing" using these figures, then name one circumstance in which a fictional student might still need private borrowing, and say what they should compare before accepting it.',
            acceptableAnswerCriteria: [
              'Defends the rule from the $2,324.25 difference and attributes it to the two mechanisms present: the subsidised portion that accrues nothing, and the lower rate on the rest.',
              'Names a realistic circumstance — federal limits reached, the gap left after all aid, or ineligibility — rather than treating private borrowing as always avoidable.',
              'States what to compare before accepting private borrowing: the rate, whether interest accrues and capitalises during school, and what repayment protections the loan does or does not carry.',
            ],
            evidenceRequirements: [
              'Uses the $6,618.75 and $8,943.00 repayment-start balances and the $2,324.25 difference.',
            ],
            dimensions: ['tradeoff-defense', 'transfer', 'criteria-application'],
            lookFors: [
              'The response defends a general rule with the specific figures rather than asserting it.',
              'The response acknowledges that a student who has hit federal limits is not choosing between these two orders at all.',
            ],
            commonMisconception: 'Treating all education borrowing as interchangeable because the amount borrowed is the same.',
          },
        ],
      },
    ],
    remediation: 'If the two orders come out equal, the in-school accrual is being skipped. The same $6,000 is borrowed either way, but Order A shelters $3,500 of it from accrual entirely and charges 5.5% on the rest, while Order B charges 10.9% on all of it for the full 4.5 years.',
    extension: 'Work out how much Order B would owe if the private lender required interest to be paid during school rather than capitalised, and say whether that changes which order you would defend.',
  },
]
