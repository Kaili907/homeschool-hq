import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 4 — PF4 Using Credit: Debt Strategy and Repayment Analysis.
 * Eleven lessons, matching the source unit's eleven days.
 *
 * The grade-11 move here is that the learner builds the amortisation rather
 * than being told the total: interest is charged on the balance that is
 * actually outstanding, the balance moves each month, and the split between
 * interest and principal moves with it. Where a lesson deliberately drops
 * interest to isolate an ordering effect, it says so in the learner-facing
 * text. Every lender, rate, balance, and account below is invented.
 */
export const g11u04: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u04-l01',
    grade: 11, unit: 4, day: 1,
    actor: 'Rosalind Quintero-Fitzgerald, a fictional borrower building an amortisation schedule',
    objective: 'Build the first three months of a fictional loan’s amortisation schedule from the balance and the rate, and show how the split between interest and principal moves as the balance falls.',
    scenario: 'Rosalind Quintero-Fitzgerald has a fictional loan from a simulated lender. The balance, rate, and payment below are invented, and this is a full amortisation schedule rather than a simplified flat-interest model.',
    materials: ['calculator', 'the fictional loan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The loan starts at $9,600. Interest is charged at 0.7% of the outstanding balance each month, which is an 8.4% annual rate. The payment is $302.60 a month for 36 months. Each month, interest is charged first and whatever is left of the payment reduces the balance. Round interest to the cent each month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest is charged in month 1, at 0.7% of the $9,600 balance?',
            given: { balance: 9600, monthlyRate: 0.007 }, expr: 'round(balance * monthlyRate, 2)', format: 'usd', answer: '$67.20',
            reasoning: 'Interest is charged on the outstanding balance, not on the original amount for the whole term: 0.7% of $9,600.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the month-1 payment of $302.60 reduces the balance?',
            given: { payment: 302.60 }, expr: 'payment - #t1-p1', format: 'usd', answer: '$235.40',
            reasoning: 'The payment covers the $67.20 of interest first; only the remainder is principal.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after the month-1 payment?',
            given: { balance2: 9600 }, expr: 'balance2 - #t1-p2', format: 'usd', answer: '$9,364.60',
            reasoning: '$9,600 less the $235.40 of principal repaid. The balance falls by the principal only, never by the whole payment.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now carry the schedule forward. Month 2 charges 0.7% of the balance you just computed, and month 3 charges 0.7% of the balance after month 2.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest is charged in month 2?',
            given: { monthlyRate2: 0.007 }, expr: 'round(#t1-p3 * monthlyRate2, 2)', format: 'usd', answer: '$65.55',
            reasoning: '0.7% of the reduced balance of $9,364.60 — less than month 1 because the balance is smaller.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much principal does the month-2 payment repay?',
            given: { payment2: 302.60 }, expr: 'payment2 - #t2-p1', format: 'usd', answer: '$237.05',
            reasoning: 'The same $302.60 payment against $65.55 of interest — more principal than month 1, from an identical payment.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after the month-2 payment?',
            given: {}, expr: '#t1-p3 - #t2-p2', format: 'usd', answer: '$9,127.55',
            reasoning: '$9,364.60 less $237.05 of principal.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much interest is charged in month 3?',
            given: { monthlyRate3: 0.007 }, expr: 'round(#t2-p3 * monthlyRate3, 2)', format: 'usd', answer: '$63.89',
            reasoning: '0.7% of $9,127.55 — the third consecutive fall in the interest charge.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much principal is repaid across the first 3 months in total?',
            given: { payment3: 302.60 }, expr: '#t1-p2 + #t2-p2 + (payment3 - #t2-p4)', format: 'usd', answer: '$711.16',
            reasoning: '$235.40, $237.05, and $238.71 of principal — three identical payments repaying three different amounts of the loan.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Now look at the loan as a whole.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of all 36 payments?',
            given: { payment4: 302.60 }, expr: 'round(payment4 * 36, 2)', format: 'usd', answer: '$10,893.60',
            reasoning: '36 payments of $302.60 — every dollar that leaves Rosalind’s account over the life of the loan, principal and interest together.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total interest paid across the loan?',
            given: { balance3: 9600 }, expr: '#t3-p1 - balance3', format: 'usd', answer: '$1,293.60',
            reasoning: '$10,893.60 repaid against $9,600 borrowed.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of the first payment goes to interest rather than to the balance? Give one decimal place.',
            given: { payment5: 302.60 }, expr: 'round(#t1-p1 / payment5 * 100, 1)', format: 'percent1', answer: '22.2%',
            reasoning: '$67.20 of the $302.60 first payment. This share falls every month, which is why early payments feel less effective than later ones.',
          },
          {
            ref: 't3-p4', kind: 'choice',
            text: 'Why does an identical $302.60 payment repay more of the balance in month 2 than in month 1?',
            choices: [
              'Because the lender charges less interest as a reward for paying on time',
              'Because interest is charged on a balance that the month-1 payment already reduced',
              'Because the principal portion of a payment is fixed in advance',
            ],
            given: {},
            answer: 'Because interest is charged on a balance that the month-1 payment already reduced',
            reasoning: 'The scenario charges 0.7% of the outstanding balance each month, and that balance fell from $9,600 to $9,364.60, so less of the payment is consumed by interest; nothing in the terms rewards timeliness, and the principal share plainly changes from $235.40 to $237.05.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why this loan cannot be costed by multiplying the balance by the rate and by the number of years, and say what a schedule like this one shows that a single total-interest figure does not.',
            acceptableAnswerCriteria: [
              'Explains that interest is charged on an outstanding balance that falls every month, so a flat calculation on the original $9,600 would overstate the interest.',
              'States what the schedule adds: it shows when the interest is paid, and that the early payments are the least effective at reducing the balance.',
              'Uses the movement from $67.20 to $63.89 of monthly interest, or the rising principal amounts, as the evidence.',
            ],
            evidenceRequirements: [
              'Cites at least two months of the schedule, showing both the interest charge and the principal repaid.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The response identifies the falling balance as the reason the flat method fails.',
              'The response says what timing information the schedule carries, not only that it is more accurate.',
              'A response noting that $1,293.60 of interest is far below 8.4% of $9,600 for three years is checking the point numerically.',
            ],
            commonMisconception: 'Costing an amortising loan as though the full balance were outstanding for the whole term.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Suppose Rosalind paid an extra $100 in month 1 only. Say which figures in the schedule change and which do not, and roughly what the extra $100 saves over the life of the loan.',
            acceptableAnswerCriteria: [
              'States that the month-1 interest of $67.20 does not change because it is charged before the payment, while every balance and every later interest charge falls.',
              'Estimates the saving as somewhat more than the interest the $100 would otherwise have attracted, and reasons about it as 0.7% a month on $100 for the remaining term rather than guessing.',
            ],
            evidenceRequirements: [
              'Refers to the 0.7% monthly rate and to at least one balance figure from the schedule.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies that the month-1 interest is already fixed when the payment arrives.',
              'The estimate is built from the rate and the remaining term rather than asserted.',
            ],
            commonMisconception: 'Assuming an extra payment reduces the interest already charged in the same month.',
          },
        ],
      },
    ],
    remediation: 'If the balance after month 1 comes out at $9,297.40, the whole $302.60 payment is being subtracted. Only the principal reduces the balance: the first $67.20 of the payment pays interest and leaves the loan no smaller. Build the schedule as four columns — opening balance, interest, principal, closing balance — and check that interest plus principal equals $302.60 in every row.',
    extension: 'Continue the schedule to month 6 and compare the interest charged in month 6 with the interest in month 1, stating the fall as a percentage.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l02',
    grade: 11, unit: 4, day: 2,
    actor: 'Ambrose Nakagawa-Silva, a fictional borrower ordering three debts',
    objective: 'Compare a highest-rate-first and a smallest-balance-first ordering on the same fictional debt set, quantify the interest difference the ordering produces, and name what each strategy optimises.',
    scenario: 'Ambrose Nakagawa-Silva holds three fictional debts from simulated lenders. Every balance, rate, and minimum payment below is invented for this exercise.',
    materials: ['calculator', 'the fictional debt table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Debt A is $1,850 at 8.2% a year with a $55 minimum. Debt B is $4,300 at 24.6% a year with a $95 minimum. Debt C is $7,200 at 12.1% a year with a $140 minimum. Ambrose has $250 a month above the minimums. Monthly interest is the annual rate divided by 12, charged on the balance.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Debt A charge in the first month?',
            given: { balanceA: 1850, rateA: 0.082 }, expr: 'round(balanceA * rateA / 12, 2)', format: 'usd', answer: '$12.64',
            reasoning: '8.2% a year on $1,850 is $151.70 a year, or $12.64 in a month. It is the smallest balance and the cheapest rate.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Debt B charge in the first month?',
            given: { balanceB: 4300, rateB: 0.246 }, expr: 'round(balanceB * rateB / 12, 2)', format: 'usd', answer: '$88.15',
            reasoning: '24.6% a year on $4,300 — the highest rate in the set, on a middling balance.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much interest does Debt C charge in the first month?',
            given: { balanceC: 7200, rateC: 0.121 }, expr: 'round(balanceC * rateC / 12, 2)', format: 'usd', answer: '$72.60',
            reasoning: '12.1% a year on $7,200 — the largest balance, at a middling rate.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the total interest charged across all three debts in the first month?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'usd', answer: '$173.39',
            reasoning: '$12.64, $88.15, and $72.60 together — the amount that has to be paid every month before any balance falls at all.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Smallest-balance-first sends the extra $250 to Debt A; highest-rate-first sends it to Debt B. For the two clearing times below, ignore interest so the ordering effect is isolated; this understates both times slightly and is a deliberate simplification.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'Under smallest-balance-first, how many months does Debt A take, paying its $55 minimum plus the $250 extra? Give one decimal place.',
            given: { balanceA2: 1850, minA: 55, extra: 250 }, expr: 'round(balanceA2 / (minA + extra), 1)', format: 'dec1', answer: '6.1',
            reasoning: '$1,850 at $305 a month. Clearing a debt entirely in about six months is what this strategy buys.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'Under highest-rate-first, how many months does Debt B take, paying its $95 minimum plus the $250 extra? Give one decimal place.',
            given: { balanceB2: 4300, minB: 95, extra2: 250 }, expr: 'round(balanceB2 / (minB + extra2), 1)', format: 'dec1', answer: '12.5',
            reasoning: '$4,300 at $345 a month — twice as long before any debt disappears from the list.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Directing the $250 at Debt B rather than Debt A moves it from a debt charging 8.2% to one charging 24.6%. How much interest does that save in a month?',
            given: { extra3: 250, rateB3: 0.246, rateA3: 0.082 }, expr: 'round(extra3 * (rateB3 - rateA3) / 12, 2)', format: 'usd', answer: '$3.42',
            reasoning: 'The $250 is removed from a balance charging 16.4 percentage points more, so the saving is that rate difference applied to $250 for one month.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If that saving held for 12 months, what would it come to?',
            given: {}, expr: '#t2-p3 * 12', format: 'usd', answer: '$41.04',
            reasoning: '$3.42 a month for a year. The real figure compounds as each strategy clears different debts at different times, so this is an approximate floor rather than an exact total.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which debt generates the most interest in the first month?',
            choices: ['Debt A, at 8.2%', 'Debt B, at 24.6%', 'Debt C, at 12.1%'],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t1-p3', ifTrue: 'Debt B, at 24.6%', ifFalse: 'Debt C, at 12.1%' },
            answer: 'Debt B, at 24.6%',
            reasoning: '$88.15 from Debt B against $72.60 from Debt C — the highest rate wins here, but only just, because Debt C carries a balance two-thirds larger.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Name what each of the two orderings optimises, say which one you would recommend to Ambrose, and state what you would need to know about him before the recommendation could be final.',
            acceptableAnswerCriteria: [
              'States that highest-rate-first minimises interest paid while smallest-balance-first minimises the time until a debt disappears, and attaches figures to both — around $41.04 a year against clearing a debt in 6.1 months instead of 12.5.',
              'Makes a recommendation and justifies it against those two objectives rather than asserting one is correct.',
              'Names what would settle it, such as whether Ambrose has abandoned repayment plans before, or whether the $250 is secure enough to sustain a twelve-month effort.',
            ],
            evidenceRequirements: [
              'Cites the 6.1-month and 12.5-month clearing times, and the interest difference of about $3.42 a month.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the interest difference as small in this particular debt set, which it is.',
              'Either recommendation is acceptable; what is scored is whether both objectives are named and priced.',
              'The response does not present the smallest-balance strategy as irrational.',
            ],
            commonMisconception: 'Assuming the strategy that minimises interest is automatically the strategy that gets the debt repaid.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Debt C has the largest balance and generates $72.60 of interest a month while never being targeted by either strategy. Explain what happens to it in the meantime, and why neither strategy starts there.',
            acceptableAnswerCriteria: [
              'Explains that Debt C receives only its $140 minimum, so it falls slowly while continuing to charge around $72.60 a month.',
              'Explains why neither strategy targets it first: it is neither the smallest balance nor the highest rate, so it fails both selection rules despite being the largest debt.',
            ],
            evidenceRequirements: [
              'Refers to the $72.60 monthly interest and the $140 minimum payment when describing what happens to Debt C.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response notices that a large minimum payment against a large interest charge makes slow progress.',
              'The response explains the selection rules rather than criticising them.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the monthly interest figures come out twelve times too large, the annual rate is being applied without dividing by 12. Debt B at 24.6% a year charges $1,057.80 over a year but $88.15 in a month. Convert every rate to a monthly figure first, and sanity-check that the three monthly charges total $173.39 rather than something near $2,080.',
    extension: 'Work out which debt would generate the most interest in a month if Debt C’s balance were $9,500 instead, and say what that shows about ranking debts by rate alone.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l03',
    grade: 11, unit: 4, day: 3,
    actor: 'Ingrid Bassey-Moreau, a fictional borrower offered a consolidation loan',
    objective: 'Compare a fictional consolidation offer against the loans it replaces on both monthly payment and total cost, and identify what the borrower is buying with the difference.',
    scenario: 'Ingrid Bassey-Moreau has been sent the simulated consolidation offer below. The lenders, balances, rates, and fees are invented, and no real product is described.',
    materials: ['calculator', 'the fictional loan and offer terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Ingrid currently pays $355.20 a month on Loan 1, which has 40 payments left, and $246.90 a month on Loan 2, which has 28 payments left. The consolidation offer replaces both with a single payment of $391.15 a month for 60 months, plus a $450 arrangement fee charged at the start.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total remaining on Loan 1?',
            given: { payment1: 355.2 }, expr: 'round(payment1 * 40, 2)', format: 'usd', answer: '$14,208.00',
            reasoning: '40 remaining payments of $355.20.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total remaining on Loan 2?',
            given: { payment2: 246.9 }, expr: 'round(payment2 * 28, 2)', format: 'usd', answer: '$6,913.20',
            reasoning: '28 remaining payments of $246.90 — the shorter of the two loans.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would Ingrid pay in total if she kept both loans to the end?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$21,121.20',
            reasoning: '$14,208.00 and $6,913.20 together — the figure the consolidation offer has to be compared against.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What would the consolidation cost in total, counting the 60 payments and the $450 fee?',
            given: { newPayment: 391.15, fee: 450 }, expr: 'round(newPayment * 60 + fee, 2)', format: 'usd', answer: '$23,919.00',
            reasoning: '$23,469.00 of payments plus the $450 charged at the start.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put the two sides against each other.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does the consolidation cost in total?',
            given: {}, expr: '#t1-p4 - #t1-p3', format: 'usd', answer: '$2,797.80',
            reasoning: '$23,919.00 against $21,121.20 — the offer is more expensive over its life, despite lowering the monthly payment.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the monthly payment under the consolidation?',
            given: { payment1b: 355.2, payment2b: 246.9, newPayment2: 391.15 },
            expr: 'round(payment1b + payment2b - newPayment2, 2)', format: 'usd', answer: '$210.95',
            reasoning: '$602.10 of current payments against a single $391.15 — a genuine and immediate reduction in what leaves the account each month.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Across the 28 months while both current loans still run, what does the monthly relief add up to?',
            given: {}, expr: '#t2-p2 * 28', format: 'usd', answer: '$5,906.60',
            reasoning: '$210.95 a month for the 28 months until Loan 2 would have ended. After that the relief shrinks, because only Loan 1 would still be running.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'The extra cost is what percentage of what Ingrid would otherwise pay? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p3 * 100, 1)', format: 'percent1', answer: '13.2%',
            reasoning: '$2,797.80 against $21,121.20 — the price of the lower payment, expressed against the debt it restructures.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'What is Ingrid actually buying with the extra $2,797.80?',
            choices: [
              'A lower total cost of borrowing',
              'A lower monthly payment and a longer time in debt',
              'A reduction in the amount she owes',
            ],
            given: {},
            decision: { left: '#t1-p4', cmp: '<', right: '#t1-p3', ifTrue: 'A lower total cost of borrowing', ifFalse: 'A lower monthly payment and a longer time in debt' },
            answer: 'A lower monthly payment and a longer time in debt',
            reasoning: 'The consolidation totals $23,919.00 against $21,121.20, so it costs more rather than less, and the term runs 60 months against 40; what changes in Ingrid’s favour is the $210.95 a month, not the amount owed.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Describe a situation in which Ingrid should accept this offer and one in which she should refuse it. For each, name the figure that decides it.',
            acceptableAnswerCriteria: [
              'Gives an accept case grounded in the $210.95 monthly relief — a budget that cannot currently sustain $602.10 a month without missing a payment or borrowing elsewhere.',
              'Gives a refuse case grounded in the $2,797.80 extra cost — a budget that can carry the current payments, where the offer buys relief she does not need.',
              'Attaches the deciding figure to each case rather than describing the two situations in general terms.',
            ],
            evidenceRequirements: [
              'Cites both the $210.95 monthly relief and the $2,797.80 extra total cost.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application', 'plan-coherence'],
            lookFors: [
              'The accept case rests on cash flow, not on the offer being cheaper, which it is not.',
              'The response does not treat consolidation as inherently good or inherently a trap.',
              'A response noting that missing payments on the current loans would cost more than $2,797.80 is reasoning well about the accept case.',
            ],
            commonMisconception: 'Reading a lower monthly payment as a lower cost of borrowing.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The relief is $210.95 a month only while both current loans would still be running. Explain what happens to the comparison after month 28, and why that matters for judging the offer.',
            acceptableAnswerCriteria: [
              'Explains that Loan 2 would have ended at month 28, so from then on the comparison is $391.15 against $355.20 and the consolidation is actually the more expensive monthly option.',
              'Draws the consequence: the relief is temporary, and the offer costs more every month from month 29 to month 60.',
            ],
            evidenceRequirements: [
              'Uses the 28-payment and 40-payment remaining terms alongside the $391.15 consolidated payment.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response tracks what happens after the shorter loan ends rather than treating the relief as constant.',
              'The response computes or clearly states the reversed monthly comparison.',
            ],
            commonMisconception: 'Assuming a monthly saving computed at the start of a restructure holds for its whole term.',
          },
        ],
      },
    ],
    remediation: 'If the consolidation appears cheaper, the $450 fee is probably missing or the term is being taken as 40 months rather than 60. The offer replaces both loans with 60 payments, so its total is $23,469.00 of payments plus the fee. Write both sides as a single total each — $21,121.20 against $23,919.00 — before looking at any monthly figure.',
    extension: 'Find the consolidated monthly payment that would make the offer cost the same in total as keeping both loans, including the fee, and say whether it would still provide monthly relief.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l04',
    grade: 11, unit: 4, day: 4,
    actor: 'Tarek Lindholm-Okafor, a fictional graduate comparing repayment structures',
    objective: 'Compare three fictional student-loan repayment structures on monthly payment and total repaid, and explain what an income-linked structure changes about who carries the risk.',
    scenario: 'Tarek Lindholm-Okafor is choosing between three simulated repayment structures for a fictional education loan. The plans below are simplified inventions that sketch the shape of real structures without reproducing any real programme’s rules.',
    materials: ['calculator', 'the three fictional repayment structures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The balance is $28,600. The fictional standard plan charges $308.75 a month for 120 months. The fictional extended plan charges $194.60 a month for 240 months. The fictional income-linked plan charges 10% a year of the amount by which income exceeds $22,600; Tarek earns $38,400.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total repaid under the standard plan?',
            given: { standard: 308.75 }, expr: 'round(standard * 120, 2)', format: 'usd', answer: '$37,050.00',
            reasoning: '120 payments of $308.75 against a $28,600 balance.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total repaid under the extended plan?',
            given: { extended: 194.6 }, expr: 'round(extended * 240, 2)', format: 'usd', answer: '$46,704.00',
            reasoning: '240 payments of $194.60 — the lower payment, carried for twice as long.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does the extended plan repay in total?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$9,654.00',
            reasoning: '$46,704.00 against $37,050.00 — the cost of halving the monthly payment.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the extended plan’s monthly payment?',
            given: { standard2: 308.75, extended2: 194.6 }, expr: 'round(standard2 - extended2, 2)', format: 'usd', answer: '$114.15',
            reasoning: '$308.75 against $194.60 a month — the relief the extra $9,654.00 buys.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now work out the income-linked plan for Tarek’s current income.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much does Tarek’s $38,400 income exceed the $22,600 threshold?',
            given: { income: 38400, threshold: 22600 }, expr: 'income - threshold', format: 'usd', answer: '$15,800.00',
            reasoning: 'The plan charges on the amount above the threshold, not on the whole income.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the annual payment under the income-linked plan, at 10% of that amount?',
            given: { share: 0.1 }, expr: 'round(#t2-p1 * share, 2)', format: 'usd', answer: '$1,580.00',
            reasoning: '10% of the $15,800.00 above the threshold.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly payment under the income-linked plan?',
            given: {}, expr: 'round(#t2-p2 / 12, 2)', format: 'usd', answer: '$131.67',
            reasoning: '$1,580.00 a year spread across 12 months — the lowest of the three payments at Tarek’s current income.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the income-linked payment than the standard plan’s?',
            given: { standard3: 308.75 }, expr: 'round(standard3 - #t2-p3, 2)', format: 'usd', answer: '$177.08',
            reasoning: '$308.75 against $131.67 a month at this income.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What would the income-linked payment be if Tarek’s income fell to $26,900?',
            given: { lowerIncome: 26900, threshold2: 22600, share2: 0.1 },
            expr: 'round((lowerIncome - threshold2) * share2 / 12, 2)', format: 'usd', answer: '$35.83',
            reasoning: '$4,300 above the threshold, a tenth of it a year, spread monthly. The payment falls with the income, which is the whole point of the structure.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The income-linked plan has the lowest payment at Tarek’s current income and the fixed plans do not change if his income falls. Explain what that difference means for who carries the risk, and say what question you would need answered before recommending the income-linked plan.',
            acceptableAnswerCriteria: [
              'Explains that a fixed payment leaves the borrower carrying the risk of an income fall, while an income-linked payment shifts part of that risk to the lender by moving with income — from $131.67 to $35.83 in the case computed.',
              'Identifies the missing information as what happens over the long run: how long the income-linked plan runs, whether unpaid interest accumulates, and what the total repaid would be.',
              'Avoids concluding the income-linked plan is cheapest, since the totals for it are not given.',
            ],
            evidenceRequirements: [
              'Cites the $131.67 and $35.83 income-linked payments alongside the fixed $308.75 to show what moves and what does not.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response frames the difference as risk allocation, not merely as a lower payment.',
              'The response notices that no total is available for the income-linked plan and treats that as a gap.',
              'A response asking whether a smaller payment even covers the interest is asking the sharpest available question.',
            ],
            commonMisconception: 'Ranking repayment plans on the payment they require today.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'These three plans are deliberately simplified inventions. Name two things a real repayment structure would specify that these do not, and say which of your computed figures each would affect.',
            acceptableAnswerCriteria: [
              'Names two concrete missing specifications, such as the interest rate and how unpaid interest is treated, the length of the income-linked plan, eligibility conditions, or what happens to any balance remaining at the end.',
              'Ties each to a figure it would move — for example the total repaid, or the $131.67 monthly payment.',
            ],
            evidenceRequirements: [
              'Refers to at least one computed total, such as the $37,050.00 or $46,704.00, when saying what the missing rules would change.',
            ],
            dimensions: ['assumption-identification', 'transfer'],
            lookFors: [
              'The items named are specifications a real plan document would contain.',
              'The response links each gap to a figure rather than listing concerns.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the income-linked payment comes out at $320.00 a month, the 10% is being charged on the whole $38,400 income rather than on the amount above the threshold. The plan charges on $15,800.00, not on $38,400. Write the subtraction as its own step, and check the result is well below the income before taking a tenth of it.',
    extension: 'Find the income at which the income-linked payment would equal the standard plan’s $308.75, and say what that figure tells you about who the structure is designed to protect.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l05',
    grade: 11, unit: 4, day: 5,
    actor: 'Vivienne Duarte-Sokolov, a fictional applicant testing her borrowing capacity',
    objective: 'Compute a fictional borrower’s debt-to-income ratio, apply two lender ceilings, and identify which ceiling binds and what it leaves available.',
    scenario: 'Vivienne Duarte-Sokolov is testing a fictional lender’s published rules against her own simulated figures. No real lender, income, or account is involved.',
    materials: ['calculator', 'the fictional income, debt, and lending rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Vivienne’s gross income is $4,750 a month. She pays $268 on a study loan, $342 on a vehicle loan, and $85 as a card minimum. The fictional lender applies two ceilings: all debt payments together may not exceed 36% of gross income, and a housing payment alone may not exceed 28%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do Vivienne’s existing debt payments come to each month?',
            given: { study: 268, vehicle: 342, card: 85 }, expr: 'study + vehicle + card', format: 'usd', answer: '$695.00',
            reasoning: 'The three required monthly payments added. A lender counts the required payment, not the balance behind it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What is her debt-to-income ratio? Give one decimal place.',
            given: { income: 4750 }, expr: 'round(#t1-p1 / income * 100, 1)', format: 'percent1', answer: '14.6%',
            reasoning: '$695.00 of payments against $4,750 of gross income.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the 36% ceiling on all debt payments together?',
            given: { income2: 4750, totalRule: 0.36 }, expr: 'round(income2 * totalRule, 2)', format: 'usd', answer: '$1,710.00',
            reasoning: '36% of $4,750 — the most the lender will let all her debt payments total.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the 28% ceiling on a housing payment alone?',
            given: { income3: 4750, housingRule: 0.28 }, expr: 'round(income3 * housingRule, 2)', format: 'usd', answer: '$1,330.00',
            reasoning: '28% of $4,750, applied to the housing payment on its own with no other debt counted.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what is actually available, and which of the two rules is the binding one.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Under the 36% total rule, how much room is left for a new housing payment?',
            given: {}, expr: '#t1-p3 - #t1-p1', format: 'usd', answer: '$1,015.00',
            reasoning: 'The $1,710.00 ceiling less the $695.00 already committed. Existing debts consume the allowance before housing is considered.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the total-rule allowance than the 28% housing ceiling?',
            given: {}, expr: '#t1-p4 - #t2-p1', format: 'usd', answer: '$315.00',
            reasoning: '$1,330.00 against $1,015.00 — the housing rule would allow more, but the total rule allows less, so the total rule is the one that binds.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'If Vivienne took a housing payment at the full $1,015.00, what would her debt-to-income ratio become? Give one decimal place.',
            given: { income4: 4750 }, expr: 'round((#t1-p1 + #t2-p1) / income4 * 100, 1)', format: 'percent1', answer: '36.0%',
            reasoning: '$695.00 plus $1,015.00 against $4,750 — exactly the ceiling, with no margin for any further borrowing.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If Vivienne cleared the card and its $85 payment, how much housing payment would the total rule then allow?',
            given: { card2: 85 }, expr: '#t2-p1 + card2', format: 'usd', answer: '$1,100.00',
            reasoning: 'Removing an $85 payment releases exactly $85 of the ceiling — the smallest of her three debts, and the fastest to clear.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which of the two lender rules limits Vivienne?',
            choices: ['The 28% housing rule', 'The 36% total-debt rule', 'Neither; both allow the same amount'],
            given: {},
            decision: { left: '#t2-p1', cmp: '<', right: '#t1-p4', ifTrue: 'The 36% total-debt rule', ifFalse: 'The 28% housing rule' },
            answer: 'The 36% total-debt rule',
            reasoning: 'The total rule leaves $1,015.00 for housing while the housing rule would allow $1,330.00, so the lower of the two is what applies and the binding constraint is her existing debt rather than the size of the housing payment.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A lender approving Vivienne at $1,015.00 a month has answered one question. Say what question that is, what question it does not answer, and why the two can give different answers.',
            acceptableAnswerCriteria: [
              'States that the lender is testing whether its rules permit the loan, using gross income and required payments — a rule check rather than an affordability judgement.',
              'Names what is left unanswered: whether Vivienne can live on what remains, since the ratio uses gross income and ignores tax, living costs, saving, and any expense that is not a debt payment.',
              'Explains that a ratio at exactly 36.0% leaves no margin, so a rule can be satisfied by a plan with no resilience in it.',
            ],
            evidenceRequirements: [
              'Cites the $1,015.00 allowance and the 36.0% ratio it produces.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies gross income as the reason the ratio overstates capacity.',
              'The response treats the lender’s rule as a legitimate but narrow test.',
              'A response noting that a $1,015.00 payment on $4,750 gross is far more of take-home pay is doing the right conversion.',
            ],
            commonMisconception: 'Treating a lending approval as a finding that a payment is affordable.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Clearing the $85 card payment releases $85 of borrowing capacity. Say what that tells you about how lenders read small debts, and whether clearing the card is the best use of Vivienne’s money.',
            acceptableAnswerCriteria: [
              'Explains that the ceiling responds to the required monthly payment rather than the balance, so a small debt with a payment attached consumes capacity out of proportion to what is owed.',
              'Gives a considered answer on whether to clear it, weighing the $85 of released capacity against what else the money could do, rather than assuming clearing it is automatically right.',
            ],
            evidenceRequirements: [
              'Refers to the $85 payment and the $1,100.00 allowance it would unlock.',
            ],
            dimensions: ['transfer', 'tradeoff-defense'],
            lookFors: [
              'The response distinguishes payment size from balance size.',
              'The response does not assume more borrowing capacity is automatically desirable.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the available housing payment comes out at $1,330.00, the existing $695.00 of debt payments has not been deducted. The 28% housing rule and the 36% total rule both have to be satisfied, and the total rule counts the study loan, the vehicle loan, and the card. Compute both ceilings, subtract existing payments from the total one, and take whichever result is smaller.',
    extension: 'Find the gross income at which the 28% housing rule would become the binding constraint instead, holding her existing $695.00 of payments constant.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l06',
    grade: 11, unit: 4, day: 6,
    actor: 'Obadiah Terzian-Delgado, a fictional cardholder costing a missed payment',
    objective: 'Cost a single missed payment on a fictional account through its fee and its penalty rate, express the cost in comparable terms, and distinguish the remedies available at different stages.',
    scenario: 'Obadiah Terzian-Delgado has missed one payment on a fictional card account. The balance, rates, fee, and remedy terms below are invented, and this lesson requires no contact with any real lender or account.',
    materials: ['calculator', 'the fictional account terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The balance is $2,840. The ordinary rate is 17.9% a year. Under the fictional account terms a missed payment triggers a $39 late fee immediately, and if the account is more than 60 days late the rate rises to a penalty rate of 29.9% a year for the following 6 months. Monthly interest is the annual rate divided by 12.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the balance attract in a month at the ordinary 17.9% rate?',
            given: { balance: 2840, ordinary: 0.179 }, expr: 'round(balance * ordinary / 12, 2)', format: 'usd', answer: '$42.36',
            reasoning: '17.9% a year on $2,840, charged monthly — the baseline the penalty is measured against.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the same balance attract in a month at the 29.9% penalty rate?',
            given: { balance2: 2840, penalty: 0.299 }, expr: 'round(balance2 * penalty / 12, 2)', format: 'usd', answer: '$70.76',
            reasoning: 'The same balance at the higher rate. Nothing about the debt changed except the rate applied to it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much extra interest does the penalty rate cost each month?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$28.40',
            reasoning: '$70.76 against $42.36 — the monthly price of the rate change alone, before any fee.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now cost the whole episode, assuming the account does go past 60 days and the penalty rate applies for the full 6 months.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the penalty rate cost across the 6 months?',
            given: {}, expr: '#t1-p3 * 6', format: 'usd', answer: '$170.40',
            reasoning: 'Six months of the $28.40 extra charge.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of the missed payment, counting the $39 fee and the penalty interest?',
            given: { lateFee: 39 }, expr: '#t2-p1 + lateFee', format: 'usd', answer: '$209.40',
            reasoning: '$170.40 of extra interest and the $39 fee. The fee is the visible part and the smaller part.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The total cost is what percentage of the $2,840 balance? Give one decimal place.',
            given: { balance3: 2840 }, expr: 'round(#t2-p2 / balance3 * 100, 1)', format: 'percent1', answer: '7.4%',
            reasoning: '$209.40 against $2,840 — one missed payment adds over seven percent of the balance in cost.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'months',
            text: 'How many months of ordinary interest does the missed payment cost? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t1-p1, 1)', format: 'dec1', answer: '4.9',
            reasoning: '$209.40 against $42.36 of ordinary monthly interest — missing one payment costs nearly five months of ordinary borrowing.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much larger is the penalty interest than the late fee?',
            given: { lateFee2: 39 }, expr: '#t2-p1 - lateFee2', format: 'usd', answer: '$131.40',
            reasoning: '$170.40 against $39 — the part of the cost that is not itemised on any statement line is more than four times the part that is.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'The fictional terms also describe what is available at each stage: before the payment is missed, the issuer will move a due date on request; within 60 days, it will reverse one fee a year and keep the ordinary rate; after 60 days, only a repayment arrangement is offered and the penalty rate has already applied.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'Under these fictional terms, which action avoids the largest share of the $209.40?',
            choices: [
              'Contacting the issuer before the due date to move it',
              'Contacting the issuer within 60 days to ask for the fee to be reversed',
              'Agreeing a repayment arrangement after 90 days',
            ],
            given: {},
            answer: 'Contacting the issuer before the due date to move it',
            reasoning: 'Only acting before the payment is missed avoids both the $39 fee and the $170.40 of penalty interest; the within-60-days route recovers the $39 fee at best, and an arrangement after 90 days comes once the penalty rate has already been applied.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which figure should Obadiah use when deciding how urgently to act at day 45?',
            choices: [
              'The $39 late fee, because that is the charge already incurred',
              'The $170.40 of penalty interest, because that is the part still avoidable',
              'The $2,840 balance, because that is what he owes',
            ],
            given: {},
            decision: { left: '#t2-p1', cmp: '>', right: '#t1-p1', ifTrue: 'The $170.40 of penalty interest, because that is the part still avoidable', ifFalse: 'The $39 late fee, because that is the charge already incurred' },
            answer: 'The $170.40 of penalty interest, because that is the part still avoidable',
            reasoning: 'At day 45 the fee is already charged and the balance is unchanged either way; what is still in play is the $170.40 that the 60-day threshold triggers, which is larger than the ordinary monthly interest of $42.36 and larger than the fee.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'The visible cost of the missed payment is $39 and the actual cost is $209.40. Explain where the difference sits, why it is harder to notice, and what that implies about when a borrower in difficulty should make contact.',
            acceptableAnswerCriteria: [
              'Identifies the $170.40 of penalty interest as the hidden part, and explains that it arrives spread across six statements as a higher rate rather than as a single itemised charge.',
              'Explains the timing implication: the remedies that avoid the most cost are available earliest, so contact before or soon after the missed date is worth far more than contact later.',
              'Uses the 60-day threshold as the specific point at which the larger cost is triggered.',
            ],
            evidenceRequirements: [
              'Cites the $39 fee and the $170.40 penalty interest, and refers to the 60-day threshold.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'plan-coherence'],
            lookFors: [
              'The response explains why a rate change is less visible than a fee.',
              'The timing conclusion follows from the terms rather than from general advice to act early.',
              'The response does not treat missing a payment as evidence about the borrower’s character.',
            ],
            commonMisconception: 'Judging the cost of a missed payment by the fee that appears on the statement.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'These terms are a simplified invention. Name one thing a real account’s terms would settle that this scenario does not, and say how it could change the $209.40 figure.',
            acceptableAnswerCriteria: [
              'Names a genuine gap, such as how long the penalty rate lasts, whether it applies to the whole balance or only to new spending, or whether the balance itself changes over the six months.',
              'Says how that gap would move the total, giving a direction and a reason rather than only noting the uncertainty.',
            ],
            evidenceRequirements: [
              'Refers to the $209.40 total or the six-month penalty period when describing what the missing rule affects.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The gap named is something a terms document would actually specify.',
              'The direction of the effect is stated.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the total comes out at $463.56, the whole penalty-rate interest is being counted rather than the extra above the ordinary rate. Obadiah would have paid $42.36 a month in interest regardless; the missed payment costs him the difference of $28.40 a month plus the $39 fee. Compute the two monthly charges side by side and subtract before multiplying by 6.',
    extension: 'Recompute the cost of the missed payment if the balance were $6,300 instead, and say whether the fee or the penalty interest grows with the balance.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l07',
    grade: 11, unit: 4, day: 7,
    actor: 'Marguerite Hollins-Bergman, a fictional adviser checking a term-length claim',
    objective: 'Test a fictional claim that doubling a loan term doubles its interest, compute the real ratio, and explain what makes the relationship more than proportional.',
    scenario: 'Marguerite Hollins-Bergman is checking the simulated claim below. The loan, both offers, and the claim itself are invented for this exercise.',
    materials: ['calculator', 'the fictional loan offers in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The claim reads: "Doubling the term doubles the interest, so the 72-month offer costs twice what the 36-month one does." The loan is $14,500. The 36-month offer charges $461.10 a month; the 72-month offer charges $261.37 a month. Both are at 0.75% a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under the 36-month offer?',
            given: { short: 461.10 }, expr: 'round(short * 36, 2)', format: 'usd', answer: '$16,599.60',
            reasoning: '36 payments of $461.10 — the whole outlay under the shorter offer, before the borrowed amount is taken out of it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under the 72-month offer?',
            given: { long: 261.37 }, expr: 'round(long * 72, 2)', format: 'usd', answer: '$18,818.64',
            reasoning: '72 payments of $261.37 — the whole outlay under the longer offer, over twice as many months.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the interest on the 36-month offer?',
            given: { principal: 14500 }, expr: '#t1-p1 - principal', format: 'usd', answer: '$2,099.60',
            reasoning: '$16,599.60 repaid against $14,500 borrowed.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the interest on the 72-month offer?',
            given: { principal2: 14500 }, expr: '#t1-p2 - principal2', format: 'usd', answer: '$4,318.64',
            reasoning: '$18,818.64 repaid against the same $14,500.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the claim directly. Work these without help.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'ratio',
            text: 'What is the ratio of the 72-month interest to the 36-month interest? Give two decimal places.',
            given: {}, expr: 'round(#t1-p4 / #t1-p3, 2)', format: 'dec2', answer: '2.06',
            reasoning: '$4,318.64 against $2,099.60. Doubling the term more than doubles the interest, so the claim understates the cost.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much extra interest does the 72-month offer cost?',
            given: {}, expr: '#t1-p4 - #t1-p3', format: 'usd', answer: '$2,219.04',
            reasoning: '$4,318.64 against $2,099.60 — more than the entire interest bill of the shorter loan.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the 72-month interest have been if the claim were true?',
            given: {}, expr: '#t1-p3 * 2', format: 'usd', answer: '$4,199.20',
            reasoning: 'Exactly double the $2,099.60 — the figure the claim predicts.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'By how much does the claim understate the 72-month interest?',
            given: {}, expr: '#t1-p4 - #t2-p3', format: 'usd', answer: '$119.44',
            reasoning: '$4,318.64 actual against the $4,199.20 the claim predicts.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the monthly payment on the 72-month offer?',
            given: { short2: 461.10, long2: 261.37 }, expr: 'round(short2 - long2, 2)', format: 'usd', answer: '$199.73',
            reasoning: '$461.10 against $261.37 — the relief the extra $2,219.04 of interest buys.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The claim is close but wrong, and its direction of error matters. Explain why doubling the term more than doubles the interest, using the amortisation idea from earlier in the unit, and say who is harmed by an error in this direction.',
            acceptableAnswerCriteria: [
              'Explains that interest is charged on the outstanding balance, and a longer term means the balance falls more slowly, so more of the loan is outstanding for more of the time.',
              'Points out that the error understates the cost by $119.44, so it makes the longer term look better than it is.',
              'Identifies the borrower considering the longer term as the person harmed by an error that flatters it.',
            ],
            evidenceRequirements: [
              'Cites the 2.06 ratio and the $119.44 by which the claim understates the interest.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The explanation rests on the balance falling more slowly, not on a general statement that longer loans cost more.',
              'The response notices the direction of the error, not only its size.',
              'A response observing that the claim is a useful rough check even though it is wrong is showing good judgement.',
            ],
            commonMisconception: 'Assuming interest on an amortising loan is proportional to the term.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The extra interest is $2,219.04 and the monthly relief is $199.73. Work out how many months of relief the extra interest is worth, and say what that comparison does and does not settle.',
            acceptableAnswerCriteria: [
              'Computes the comparison — about 11.1 months of $199.73 relief equals the $2,219.04 of extra interest — and reports it.',
              'States what the comparison does not settle: whether the borrower can pay $461.10 at all, which is a question about capacity rather than about total cost.',
            ],
            evidenceRequirements: [
              'Uses both the $2,219.04 extra interest and the $199.73 monthly relief in the comparison.',
            ],
            dimensions: ['transfer', 'tradeoff-defense'],
            lookFors: [
              'The comparison is computed rather than described.',
              'The response identifies capacity as the question the arithmetic cannot answer.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the 72-month interest comes out at $4,199.20, the claim is being used as the calculation rather than being tested by it. Compute each offer’s interest from its own payment and term: 72 payments of $261.37 total $18,818.64, and the interest is what that exceeds $14,500. Only then compare the result with what the claim predicted.',
    extension: 'Work out the ratio of interest between a 24-month and a 48-month version of the same loan, and say whether the more-than-doubling effect gets stronger or weaker at shorter terms.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l08',
    grade: 11, unit: 4, day: 8,
    actor: 'Zephyrine Adebayo-Voss, a fictional borrower applying an ordering rule to a new debt set',
    objective: 'Transfer the repayment-ordering method to a fictional debt set where the highest rate is not the largest interest line, and say what that changes about the ranking.',
    scenario: 'Zephyrine Adebayo-Voss holds three fictional debts with the simulated terms below. All balances, rates, and payments are invented for this exercise.',
    materials: ['calculator', 'the fictional debt table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The card holds $920 at 26.9% a year with a $180 minimum. The credit-union loan holds $3,450 at 7.4% a year with a $95 minimum. The store plan holds $6,100 at 15.8% a year with a $205 minimum. Zephyrine has $310 a month above the minimums. Monthly interest is the annual rate divided by 12.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the card charge in the first month?',
            given: { cardBalance: 920, cardRate: 0.269 }, expr: 'round(cardBalance * cardRate / 12, 2)', format: 'usd', answer: '$20.62',
            reasoning: '26.9% a year on $920 — much the highest rate in the set, on much the smallest balance.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the credit-union loan charge in the first month?',
            given: { unionBalance: 3450, unionRate: 0.074 }, expr: 'round(unionBalance * unionRate / 12, 2)', format: 'usd', answer: '$21.28',
            reasoning: '7.4% a year on $3,450 — the lowest rate, yet it charges slightly more than the card does.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the store plan charge in the first month?',
            given: { storeBalance: 6100, storeRate: 0.158 }, expr: 'round(storeBalance * storeRate / 12, 2)', format: 'usd', answer: '$80.32',
            reasoning: '15.8% a year on $6,100 — a middling rate on the largest balance, producing by far the largest charge.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the total interest across all three debts in the first month?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'usd', answer: '$122.22',
            reasoning: '$20.62, $21.28, and $80.32 together — nearly two-thirds of it from a single debt.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now apply the ordering rules. For the clearing time, ignore interest, as in the earlier lesson; this is a deliberate simplification that understates the time slightly.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'The card is both the highest rate and the smallest balance, so both strategies target it. How many months does it take at its $180 minimum plus the $310 extra? Give one decimal place.',
            given: { cardBalance2: 920, cardMin: 180, extra: 310 }, expr: 'round(cardBalance2 / (cardMin + extra), 1)', format: 'dec1', answer: '1.9',
            reasoning: '$920 at $490 a month. When one debt is both the smallest and the dearest, the two strategies agree and the choice does not arise.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Once the card is cleared, directing the $310 at the store plan rather than the credit-union loan moves it from 7.4% to 15.8%. How much interest does that save in a month?',
            given: { extra2: 310, storeRate2: 0.158, unionRate2: 0.074 },
            expr: 'round(extra2 * (storeRate2 - unionRate2) / 12, 2)', format: 'usd', answer: '$2.17',
            reasoning: '$310 moved across a gap of 8.4 percentage points for one month.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the total first-month interest does the store plan generate? Give one decimal place.',
            given: {}, expr: 'round(#t1-p3 / #t1-p4 * 100, 1)', format: 'percent1', answer: '65.7%',
            reasoning: '$80.32 of the $122.22 total — the debt that is neither the smallest nor the dearest is where almost two-thirds of the cost sits.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which debt charges more interest in the first month, the card at 26.9% or the credit-union loan at 7.4%?',
            choices: ['The card, at 26.9%', 'The credit-union loan, at 7.4%', 'They charge the same'],
            given: {},
            decision: { left: '#t1-p1', cmp: '>', right: '#t1-p2', ifTrue: 'The card, at 26.9%', ifFalse: 'The credit-union loan, at 7.4%' },
            answer: 'The credit-union loan, at 7.4%',
            reasoning: '$21.28 against $20.62 — a rate less than a third as high produces more interest, because the balance behind it is nearly four times larger.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'In the earlier debt set the highest rate also produced the largest interest charge, and here it does not. Say what changed, what still transfers from the earlier method, and what a borrower should look at rather than the rate alone.',
            acceptableAnswerCriteria: [
              'Identifies the change: the balances here are far more unequal, so the $920 card at 26.9% charges less than the $3,450 loan at 7.4%.',
              'States what still transfers: the ordering rules are unchanged, and directing spare money at the higher rate still saves interest, here $2.17 a month.',
              'Names the interest charge itself — rate multiplied by balance — as what a borrower should compare, not the rate alone.',
            ],
            evidenceRequirements: [
              'Cites the $20.62 card charge against the $21.28 credit-union charge as the instance where rate and cost disagree.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response identifies balance inequality as what changed between the two cases.',
              'The response does not conclude that ordering by rate is wrong — it still minimises interest per dollar directed.',
              'A response noting that the card clears in 1.9 months regardless is reading the situation accurately.',
            ],
            commonMisconception: 'Reading the highest interest rate as the largest interest cost.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The store plan generates 65.7% of the monthly interest and neither strategy targets it first. Say whether that is a flaw in the strategies, and what Zephyrine should do about it.',
            acceptableAnswerCriteria: [
              'Argues that it is not a flaw in the rules themselves, since both target the card first and the card clears in 1.9 months, after which the store plan does become the highest-rate remaining target.',
              'Concludes that the store plan is next under highest-rate ordering, or the credit-union loan under smallest-balance ordering, and says which rule the choice follows.',
            ],
            evidenceRequirements: [
              'Refers to the 1.9-month card clearing time and the $80.32 monthly store-plan charge.',
            ],
            dimensions: ['criteria-application', 'plan-coherence'],
            lookFors: [
              'The response reasons about what happens after the first debt clears rather than only about the starting position.',
              'The response distinguishes a badly chosen rule from a rule applied at one moment in time.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the card looks like the largest interest charge because its rate is highest, compute all three charges before ranking anything. Interest is the rate multiplied by the balance: 26.9% of $920 is $20.62 while 7.4% of $3,450 is $21.28. Write the three products in a column and rank the column, not the rates.',
    extension: 'Find the card balance at which its interest charge would match the store plan’s $80.32, and say whether that balance is plausible for a card of this kind.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l09',
    grade: 11, unit: 4, day: 9,
    actor: 'Cornelius Iyengar-Mbatha, a fictional borrower testing a refinance offer',
    objective: 'Evaluate a fictional refinance offer by computing its break-even point and its net saving, and identify the condition under which the offer fails despite the lower rate.',
    scenario: 'Cornelius Iyengar-Mbatha has been offered the simulated refinance below. The lender, balance, rates, and fees are invented for this exercise.',
    materials: ['calculator', 'the fictional refinance terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The current loan has a $16,800 balance at 11.2% a year, with 42 payments of $485.35 left. The refinance offer keeps the same 42-month term and the same balance at 7.6% a year, with payments of $456.81, and charges $625 in fees at the start. Monthly interest is the annual rate divided by 12.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the current loan charge in its first month, at 11.2% a year?',
            given: { balance: 16800, currentRate: 0.112 }, expr: 'round(balance * currentRate / 12, 2)', format: 'usd', answer: '$156.80',
            reasoning: '11.2% a year on $16,800, charged monthly.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest would the refinanced loan charge in its first month, at 7.6% a year?',
            given: { balance2: 16800, newRate: 0.076 }, expr: 'round(balance2 * newRate / 12, 2)', format: 'usd', answer: '$106.40',
            reasoning: 'The same balance at the lower rate — a saving of $50.40 in the first month alone, which is larger than the monthly payment difference.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the monthly payment under the refinance?',
            given: { currentPayment: 485.35, newPayment: 456.81 }, expr: 'round(currentPayment - newPayment, 2)', format: 'usd', answer: '$28.54',
            reasoning: '$485.35 against $456.81. The payment falls by less than the first month’s interest saving because the term is unchanged, so more of each payment now goes to principal.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test whether the offer is worth its fees.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'How many months of the monthly saving does it take to recover the $625 in fees? Give one decimal place.',
            given: { fees: 625 }, expr: 'round(fees / #t1-p3, 1)', format: 'dec1', answer: '21.9',
            reasoning: '$625 divided by the $28.54 monthly saving — the break-even point, after which the refinance is ahead.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under the current loan?',
            given: { currentPayment2: 485.35 }, expr: 'round(currentPayment2 * 42, 2)', format: 'usd', answer: '$20,384.70',
            reasoning: '42 remaining payments of $485.35.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under the refinance?',
            given: { newPayment2: 456.81 }, expr: 'round(newPayment2 * 42, 2)', format: 'usd', answer: '$19,186.02',
            reasoning: '42 payments of $456.81 over the same term.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the net saving from refinancing across the full 42 months, after the $625 in fees?',
            given: { fees2: 625 }, expr: '#t2-p2 - #t2-p3 - fees2', format: 'usd', answer: '$573.68',
            reasoning: '$1,198.68 of gross saving less the $625 of fees. The fees consume more than half the benefit.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Cornelius expects to repay the loan early, in about 18 months. Do the $625 of fees get recovered out of the monthly payment saving by then?',
            choices: ['Yes, the payment saving covers the fees by month 18', 'No, the payment saving has not covered the fees by month 18'],
            given: { plannedMonths: 18 },
            decision: { left: '#t2-p1', cmp: '<=', right: 'plannedMonths', ifTrue: 'Yes, the payment saving covers the fees by month 18', ifFalse: 'No, the payment saving has not covered the fees by month 18' },
            answer: 'No, the payment saving has not covered the fees by month 18',
            reasoning: 'Break-even on the payment saving falls at 21.9 months, so by month 18 the $28.54 a month has returned about $514 against $625 of fees. This measures the payment saving alone; the refinanced loan also repays principal faster, which the next task takes up.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The refinance cuts the rate from 11.2% to 7.6% and can still be the wrong choice. Explain the mechanism, state the condition that decides it, and say what Cornelius should establish about his own plans before accepting.',
            acceptableAnswerCriteria: [
              'Explains that the benefit accrues monthly at $28.54 while the $625 cost is paid up front, so the offer only pays once enough months have passed.',
              'States the deciding condition as the holding period against the 21.9-month break-even, not the rate difference, and notes that this break-even counts only the payment saving.',
              'Identifies what Cornelius must establish: how long he actually expects to keep the loan, including any plan to repay early or to sell the asset behind it.',
            ],
            evidenceRequirements: [
              'Cites the 21.9-month break-even and the $573.68 net saving over the full term.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response frames the decision as a break-even comparison rather than a rate comparison.',
              'The response notes that the full-term saving of $573.68 is modest relative to the $625 of fees.',
              'A response observing that the payment-saving break-even understates the benefit — because the refinanced loan also repays principal faster, leaving a smaller balance at payoff — is reasoning beyond the item and should be credited.',
            ],
            commonMisconception: 'Treating a lower interest rate as sufficient reason to refinance.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The first month’s interest falls by $50.40 but the payment falls by only $28.54. Explain where the other $21.86 goes, and why that is not a loss to Cornelius.',
            acceptableAnswerCriteria: [
              'Explains that because the term is unchanged, the payment is not reduced by the whole interest saving; the remainder goes to repaying principal faster.',
              'Argues this is not a loss because the money reduces what he owes rather than leaving his hands, so the loan is repaid with less interest overall.',
            ],
            evidenceRequirements: [
              'Uses the $50.40 first-month interest saving and the $28.54 payment reduction in the explanation.',
            ],
            dimensions: ['reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response tracks the difference into principal rather than treating it as unexplained.',
              'The response connects faster principal repayment to lower total interest.',
            ],
            commonMisconception: 'Expecting a fall in the interest rate to show up entirely as a fall in the payment.',
          },
        ],
      },
    ],
    remediation: 'If the refinance looks like a clear win, check whether the $625 of fees has been included. The gross saving is $1,198.68 across 42 months, but the fees are paid at the start and come off that, leaving $573.68. Compute the break-even in months first, then compare it against how long the loan is actually expected to run.',
    extension: 'Find the largest fee at which the refinance would still break even by month 18, and say how far that is from the $625 charged.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l10',
    grade: 11, unit: 4, day: 10,
    actor: 'Perpetua Olufemi-Strand, a fictional borrower building a repayment plan',
    objective: 'Build a complete fictional repayment plan across three debts, quantify what the current position costs each year, and defend an ordering against a stated objective.',
    scenario: 'Perpetua Olufemi-Strand holds the three fictional debts below and is building a repayment plan. All balances, rates, payments, and income figures are invented for this performance task.',
    materials: ['calculator', 'the fictional debt and income figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The study loan holds $19,400 at 5.9% a year with a $214 minimum. The card holds $3,150 at 23.4% a year with a $95 minimum. The vehicle loan holds $8,700 at 6.4% a year with a $265 minimum. Monthly interest is the annual rate divided by 12. Perpetua takes home $3,960 a month and can put $820 a month towards debt. Her gross income is $5,100 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the study loan charge in the first month?',
            given: { studyBalance: 19400, studyRate: 0.059 }, expr: 'round(studyBalance * studyRate / 12, 2)', format: 'usd', answer: '$95.38',
            reasoning: '5.9% a year on $19,400 — the largest balance at the lowest rate.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the card charge in the first month?',
            given: { cardBalance: 3150, cardRate: 0.234 }, expr: 'round(cardBalance * cardRate / 12, 2)', format: 'usd', answer: '$61.43',
            reasoning: '23.4% a year on $3,150 — the smallest balance at much the highest rate.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much interest does the vehicle loan charge in the first month?',
            given: { vehicleBalance: 8700, vehicleRate: 0.064 }, expr: 'round(vehicleBalance * vehicleRate / 12, 2)', format: 'usd', answer: '$46.40',
            reasoning: '6.4% a year on $8,700 — a middling balance at a rate close to the study loan’s, so it is neither the dearest nor the cheapest debt in the set.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the total interest charged across all three debts in the first month?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'usd', answer: '$203.21',
            reasoning: '$95.38, $61.43, and $46.40 together — the amount that must be paid each month before any balance moves.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now build the plan from her capacity.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the three minimum payments come to?',
            given: { studyMin: 214, cardMin: 95, vehicleMin: 265 }, expr: 'studyMin + cardMin + vehicleMin', format: 'usd', answer: '$574.00',
            reasoning: 'The payments Perpetua must make regardless of any strategy.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does she have above the minimums, from her $820 debt capacity?',
            given: { capacity: 820 }, expr: 'capacity - #t2-p1', format: 'usd', answer: '$246.00',
            reasoning: '$820 of capacity less $574.00 of required payments — the only part of the plan she gets to direct.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If nothing changed, what would the first month’s interest come to over a year?',
            given: {}, expr: 'round(#t1-p4 * 12, 2)', format: 'usd', answer: '$2,438.52',
            reasoning: '$203.21 a month held constant for a year. Balances do fall, so this overstates a real year slightly and gives the scale of the problem.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'months',
            text: 'Directing the extra $246.00 at the card, how many months does it take to clear? Ignore interest for this step and give one decimal place.',
            given: { cardBalance2: 3150, cardMin2: 95 }, expr: 'round(cardBalance2 / (cardMin2 + #t2-p2), 1)', format: 'dec1', answer: '9.2',
            reasoning: '$3,150 at $341 a month. Ignoring interest understates the time slightly and is a stated simplification.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'What is Perpetua’s debt-to-income ratio, using the minimums against her $5,100 gross income? Give one decimal place.',
            given: { gross: 5100 }, expr: 'round(#t2-p1 / gross * 100, 1)', format: 'percent1', answer: '11.3%',
            reasoning: '$574.00 of required payments against $5,100 of gross income — comfortable by lending standards, which is a different question from whether the debt is expensive.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'percent',
            text: 'What share of her $3,960 take-home pay does the $820 debt capacity represent? Give one decimal place.',
            given: { takeHome: 3960, capacity2: 820 }, expr: 'round(capacity2 / takeHome * 100, 1)', format: 'percent1', answer: '20.7%',
            reasoning: '$820 against $3,960 of take-home pay — more than double the debt-to-income figure, because that ratio uses gross income and only the minimums.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One comparison before the recommendation.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'Directing the $246.00 at the card rather than the study loan moves it from 5.9% to 23.4%. How much interest does that save in a month?',
            given: { cardRate2: 0.234, studyRate2: 0.059 }, expr: 'round(#t2-p2 * (cardRate2 - studyRate2) / 12, 2)', format: 'usd', answer: '$3.59',
            reasoning: '$246.00 moved across a gap of 17.5 percentage points for one month.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which debt should receive the extra $246.00 first if the objective is to minimise interest paid?',
            choices: ['The study loan, at 5.9%', 'The card, at 23.4%', 'The vehicle loan, at 6.4%'],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t1-p3', ifTrue: 'The card, at 23.4%', ifFalse: 'The vehicle loan, at 6.4%' },
            answer: 'The card, at 23.4%',
            reasoning: 'Minimising interest means directing spare money at the highest rate, and the card at 23.4% charges $61.43 a month on only $3,150 against the vehicle loan’s $46.40 on $8,700; it also happens to be the smallest balance, so both common strategies agree here.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your plan. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Present a repayment plan for Perpetua. State the ordering and the objective it serves, say what happens to the freed-up payment when the card clears, and name the assumption whose failure would most damage the plan.',
            acceptableAnswerCriteria: [
              'Sets out an ordering with the card first and justifies it against a stated objective, using the $61.43 monthly charge or the 23.4% rate.',
              'Says what happens after the card clears at about month 9.2 — the $95 minimum plus the $246.00 extra, or $341 a month, becomes available for the next debt.',
              'Names the most damaging assumption, most defensibly the $820 monthly capacity holding for the whole plan, and explains what would happen if it fell.',
            ],
            evidenceRequirements: [
              'Cites the $203.21 monthly interest total and the $246.00 of directable capacity.',
              'Refers to the 9.2-month card clearing time when describing what happens next.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'assumption-identification', 'criteria-application'],
            lookFors: [
              'The plan says what happens after the first debt clears, not only where to start.',
              'The objective is stated rather than assumed, so the ordering can be judged against it.',
              'A response noting that the card is both the smallest balance and the highest rate, so no strategy conflict arises, is reading the set correctly.',
            ],
            commonMisconception: 'Building a repayment plan that specifies a starting point but not what happens when a debt is cleared.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Perpetua’s debt-to-income ratio is 11.3% and her debt capacity is 20.7% of take-home pay. Explain why the two figures differ so much, and say which one describes her situation better.',
            acceptableAnswerCriteria: [
              'Explains that the ratio uses gross income and counts only the $574.00 of minimums, while the 20.7% uses take-home pay and counts the full $820 she actually commits.',
              'Argues that the take-home figure describes her situation better, because it measures money she can actually spend against money she has actually committed.',
            ],
            evidenceRequirements: [
              'Uses the $5,100 gross and $3,960 take-home figures, and both the $574.00 and $820 payment figures.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies both differences — the income base and the payment base.',
              'The choice is justified rather than asserted.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the extra available comes out at $820, the minimum payments are not being deducted. The $574.00 of minimums has to be paid on all three debts before anything can be directed, so only $246.00 is actually a choice. Write the capacity as one row, the minimums as three rows, and the remainder as the directable figure before choosing any ordering.',
    extension: 'Work out what Perpetua could direct each month once both the card and the vehicle loan are cleared, and say what that does to the time the study loan takes.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u04-l11',
    grade: 11, unit: 4, day: 11,
    actor: 'Anselm Bracamonte-Danylenko, a fictional applicant defending a borrowing decision',
    objective: 'Defend a fictional borrowing decision against a lender’s ratio test, compute what would have to change for a proposed payment to fit, and separate what the ratio measures from what it does not.',
    scenario: 'Anselm Bracamonte-Danylenko is preparing to defend a fictional borrowing proposal against a simulated lender’s rules. All income, payment, and rule figures below are invented.',
    materials: ['calculator', 'the fictional proposal and lending rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Anselm’s gross income is $6,240 a month and his existing debt payments total $1,142 a month. The fictional lender caps all debt payments at 36% of gross income. The housing payment he is proposing is $1,380 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is Anselm’s current debt-to-income ratio? Give one decimal place.',
            given: { existing: 1142, gross: 6240 }, expr: 'round(existing / gross * 100, 1)', format: 'percent1', answer: '18.3%',
            reasoning: '$1,142 of payments against $6,240 of gross income — comfortably inside the cap before the new payment is considered.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the 36% ceiling on total debt payments?',
            given: { gross2: 6240, rule: 0.36 }, expr: 'round(gross2 * rule, 2)', format: 'usd', answer: '$2,246.40',
            reasoning: '36% of $6,240 — the most the lender will allow across all debt payments together.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much room does that leave for the new housing payment?',
            given: { existing2: 1142 }, expr: '#t1-p2 - existing2', format: 'usd', answer: '$1,104.40',
            reasoning: 'The $2,246.40 ceiling less the $1,142 already committed.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'percent',
            text: 'What would the ratio become if the proposed $1,380 payment were added? Give one decimal place.',
            given: { existing3: 1142, proposed: 1380, gross3: 6240 },
            expr: 'round((existing3 + proposed) / gross3 * 100, 1)', format: 'percent1', answer: '40.4%',
            reasoning: '$2,522 of total payments against $6,240 of gross income — above the 36% cap, so the proposal fails the test as it stands.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now work out exactly what would have to change for the proposal to fit.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much does the proposed payment exceed what the rule allows?',
            given: { proposed2: 1380 }, expr: 'proposed2 - #t1-p3', format: 'usd', answer: '$275.60',
            reasoning: '$1,380 against the $1,104.40 available — the size of the gap that has to be closed one way or another.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of his existing $1,142 of payments would Anselm have to clear for the $1,380 payment to fit?',
            given: {}, expr: '#t2-p1', format: 'usd', answer: '$275.60',
            reasoning: 'Every dollar of existing payment cleared releases exactly one dollar of the ceiling, so the amount to clear equals the gap of $275.60.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Alternatively, what gross income would make the $1,380 payment fit under the 36% rule?',
            given: { existing4: 1142, proposed3: 1380, rule2: 0.36 },
            expr: 'round((existing4 + proposed3) / rule2, 2)', format: 'usd', answer: '$7,005.56',
            reasoning: 'The $2,522 of total payments divided by the 36% cap gives the income at which they sit exactly on the ceiling.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more gross income a month is that than Anselm has now?',
            given: { gross4: 6240 }, expr: '#t2-p3 - gross4', format: 'usd', answer: '$765.56',
            reasoning: '$7,005.56 needed against $6,240 — a 12% rise in income, against $275.60 of debt to clear, which is why clearing debt is usually the faster route.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much larger is the monthly income increase the rule would need than the monthly debt reduction it would need?',
            given: {}, expr: '#t2-p4 - #t2-p2', format: 'usd', answer: '$489.96',
            reasoning: '$765.56 of extra income against $275.60 of debt payments to clear — the two routes to the same ratio are not the same size, because income has to cover the whole payment while cleared debt releases the ceiling dollar for dollar.',
          },
          {
            ref: 't2-p6', kind: 'choice',
            text: 'Which route to fitting the rule is more within Anselm’s control?',
            choices: [
              'Raising gross income by $765.56 a month',
              'Clearing $275.60 a month of existing debt payments',
              'Neither route changes the ratio',
            ],
            given: {},
            decision: { left: '#t2-p2', cmp: '<', right: '#t2-p4', ifTrue: 'Clearing $275.60 a month of existing debt payments', ifFalse: 'Raising gross income by $765.56 a month' },
            answer: 'Clearing $275.60 a month of existing debt payments',
            reasoning: 'The debt route requires removing $275.60 of monthly payments while the income route requires $765.56 more a month, nearly three times as much, and the ratio plainly responds to both.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Anselm wants to argue that the rule is wrong in his case. Construct the strongest version of that argument using figures from this lesson, then give the strongest response a lender could make to it.',
            acceptableAnswerCriteria: [
              'Builds a real argument: the ratio uses gross income and counts required payments regardless of how soon a debt ends, so a borrower whose $1,142 includes a loan ending shortly is treated as though it will run forever.',
              'Gives the lender’s response: the rule is a standard applied across many borrowers without individual investigation, and the 40.4% figure leaves no margin for a fall in income.',
              'Reaches a position on the exchange rather than presenting both sides without comment.',
            ],
            evidenceRequirements: [
              'Cites the 40.4% ratio and the $1,104.40 allowance in the argument.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The argument names a specific defect in what the ratio measures, not a general complaint.',
              'The lender’s response is given its strongest form rather than a weak one.',
              'Either conclusion is acceptable if it engages with both the borrower’s case and the lender’s.',
            ],
            commonMisconception: 'Treating a lending rule as either infallible or arbitrary, rather than as a standard with known limits.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Suppose Anselm clears the $275.60 of payments by taking a longer term on the same debt rather than by repaying it. Say whether that satisfies the rule, and whether it improves his position.',
            acceptableAnswerCriteria: [
              'States that it does satisfy the rule, because the rule counts the required monthly payment and a longer term reduces that payment.',
              'Argues that it does not necessarily improve his position, since the same debt is still owed and a longer term generally increases the total interest paid.',
            ],
            evidenceRequirements: [
              'Refers to the $275.60 reduction and to the fact that the ratio counts payments rather than balances.',
            ],
            dimensions: ['criteria-application', 'error-diagnosis'],
            lookFors: [
              'The response separates satisfying the test from being better off.',
              'The response identifies that the rule can be met without the underlying debt changing.',
            ],
            commonMisconception: 'Assuming that any change which satisfies a lending rule has improved the borrower’s finances.',
          },
        ],
      },
    ],
    remediation: 'If the available housing payment comes out at $2,246.40, the existing $1,142 of payments has not been subtracted from the ceiling. The 36% cap covers all debt payments together, so the existing commitments come out of it first, leaving $1,104.40. Write the ceiling, the existing payments, and the remainder as three separate lines before comparing anything to the $1,380 proposal.',
    extension: 'Find the housing payment at which Anselm’s ratio would sit at 30% rather than 36%, and say what that margin would be worth if his income fell by 10%.',
  },
]
