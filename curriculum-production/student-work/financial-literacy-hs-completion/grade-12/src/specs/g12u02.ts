import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 2 — PF2 Buying Goods and Services: Running a Household's
 * Spending.
 *
 * The senior move here is duration. Grade 9 prices a purchase; grade 12
 * operates a household's spending across a whole year, where the decisions
 * that matter are renewals nobody re-decides, small recurring charges that
 * only become visible when annualised, and disputes that have to be pursued
 * against a clock. Every lesson carries the arithmetic into at least one other
 * domain — the budget the spending sits inside, the card the charge lands on,
 * or the protection route a failure opens.
 */
export const g12u02: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u02-l01',
    grade: 12, unit: 2, day: 1,
    actor: 'a fictional household facing a year of renewals at once',
    objective: 'Annualise a fictional household’s recurring obligations, reprice them after a year of renewals, and express the increase as the monthly figure a budget would have to absorb.',
    scenario: 'The recurring obligations below belong to a fictional household. Every provider, price, and renewal increase is invented for this exercise.',
    materials: ['calculator', 'the fictional obligation list in these directions'],
    domains: ['budgeting', 'consumer-protection', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household pays rent of $1,285 a month, auto insurance of $612 charged twice a year, a phone plan of $84 a month, internet at $69 a month, and a streaming bundle at $46 a month. At renewal the rent rises 4.5% and the auto insurance rises 7%. The phone plan is unchanged. The internet promotion ends and the price becomes $92 a month. The streaming bundle rises by $5 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the five obligations cost the household over the current year in total?',
            given: { rent: 1285, auto: 612, phone: 84, internet: 69, streaming: 46 },
            expr: 'rent * 12 + auto * 2 + phone * 12 + internet * 12 + streaming * 12',
            format: 'usd', answer: '$19,032.00',
            reasoning: 'Rent and the three monthly services are charged 12 times; the auto insurance is charged twice. Putting everything on an annual basis first is what makes obligations billed on different cycles comparable at all.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of rent cost after the 4.5% renewal increase?',
            given: { rent2: 1285, rentRise: 0.045 }, expr: 'round(rent2 * 12 * (1 + rentRise), 2)', format: 'usd', answer: '$16,113.90',
            reasoning: 'The current annual rent of $15,420.00 raised by 4.5%. Applying the increase to the annual figure avoids a rounded monthly rent that would not multiply back to the year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does a year of auto insurance cost after the 7% increase?',
            given: { auto2: 612, autoRise: 0.07 }, expr: 'round(auto2 * 2 * (1 + autoRise), 2)', format: 'usd', answer: '$1,309.68',
            reasoning: 'Two charges of $612 raised by 7%. The premium renews on its own cycle, so it is easy to leave out of a review organised around monthly bills.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now reprice the rest and find what the year of renewals costs.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does a year of internet cost once the promotion ends?',
            given: { internetNew: 92 }, expr: 'internetNew * 12', format: 'usd', answer: '$1,104.00',
            reasoning: '$92 a month for 12 months. Nothing was renegotiated here — the increase happened because a promotional period ended on its own schedule.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of the streaming bundle cost after the $5 increase?',
            given: { streaming2: 46, streamRise: 5 }, expr: '(streaming2 + streamRise) * 12', format: 'usd', answer: '$612.00',
            reasoning: '$51 a month for 12 months. The smallest increase on the list still costs $60 more across the year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What will the five obligations cost over the coming year in total?',
            given: { phone2: 84 }, expr: '#t1-p2 + #t1-p3 + phone2 * 12 + #t2-p1 + #t2-p2', format: 'usd', answer: '$20,147.58',
            reasoning: '$16,113.90 of rent, $1,309.68 of insurance, $1,008.00 of phone, $1,104.00 of internet, and $612.00 of streaming.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the increase across the whole year?',
            given: {}, expr: '#t2-p3 - #t1-p1', format: 'usd', answer: '$1,115.58',
            reasoning: '$20,147.58 against $19,032.00. No single renewal in the list looks large; the total does.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What does that increase come to per month?',
            given: {}, expr: 'round(#t2-p4 / 12, 2)', format: 'usd', answer: '$92.97',
            reasoning: '$1,115.58 across 12 months. This is the figure a monthly budget has to find, and it arrives without any new decision having been made.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'None of these five increases was chosen by the household, and none was individually large. Explain how a household ends up paying $92.97 more a month without deciding to, and name the two obligations on this list you would put a renewal date against first, with your reason.',
            acceptableAnswerCriteria: [
              'Explains the mechanism: each obligation renews automatically on its own schedule, so continuing is the default and the household only faces a decision if it creates one.',
              'Names the aggregation problem: five increases that each look small are only visible as $1,115.58 once they are put on a common annual basis.',
              'Selects two obligations with a stated reason — for example rent at $16,113.90 because it is the largest single line and the 4.5% increase on it is $693.90 of the total, and internet at $1,104.00 because a promotional expiry is the one increase with an obvious point of negotiation.',
            ],
            evidenceRequirements: [
              'Uses the $1,115.58 annual increase and the $92.97 monthly figure, and cites at least one individual obligation’s own annual cost.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response ranks by the size of the increase or the prospect of changing it, not by which service feels least necessary.',
              'The response treats the renewal date as the moment leverage exists, rather than treating any month as equivalent.',
            ],
            commonMisconception: 'Judging a recurring obligation by its monthly price rather than by its annual cost, so a $5 increase and a 4.5% rent increase are weighed as if comparable.',
          },
        ],
      },
    ],
    remediation: 'If the annual total comes out near $23,000, the auto insurance is probably being multiplied by 12. Read the billing cycle on each line before annualising: the $612 premium is charged twice a year, and everything else on the list is monthly. Convert each obligation to a yearly figure on its own cycle, then add.',
    extension: 'Work out what the household would have to cancel outright to absorb the $92.97 a month without touching rent, and say whether that is achievable from the list as given.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l02',
    grade: 12, unit: 2, day: 2,
    actor: 'a fictional household replacing a failed appliance mid-year',
    objective: 'Price a fictional replacement purchase three ways, express the financing cost as a share of the cash price, and weigh it against what paying cash does to the household’s reserve.',
    scenario: 'The simulated appliance, the three payment offers, and the fictional household’s reserve below are invented for this exercise.',
    materials: ['calculator', 'the fictional purchase offers in these directions'],
    domains: ['budgeting', 'credit', 'debt', 'consumer-protection', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional replacement costs $1,340 paid in cash. The seller also offers 12 monthly payments of $124 with nothing down, or 18 monthly payments of $89 with nothing down. The household holds $2,100 in an emergency reserve and has $180 a month of surplus after everything else is paid.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the 12-month offer cost in total?',
            given: { payment12: 124, term12: 12 }, expr: 'payment12 * term12', format: 'usd', answer: '$1,488.00',
            reasoning: '12 payments of $124. This is what is actually handed over, which the monthly figure on its own does not show.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more than the cash price is that?',
            given: { cashPrice: 1340 }, expr: '#t1-p1 - cashPrice', format: 'usd', answer: '$148.00',
            reasoning: '$1,488.00 against the $1,340 cash price. This is the price of spreading the payments, whatever the offer calls it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the 18-month offer cost in total?',
            given: { payment18: 89, term18: 18 }, expr: 'payment18 * term18', format: 'usd', answer: '$1,602.00',
            reasoning: '18 payments of $89. The lower monthly figure buys a longer term, and the total is what shows the cost of that.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put the three routes on a common footing, and check what each does to the reserve.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more than the cash price does the 18-month offer cost?',
            given: { cashPrice2: 1340 }, expr: '#t1-p3 - cashPrice2', format: 'usd', answer: '$262.00',
            reasoning: '$1,602.00 against $1,340. The smaller monthly payment costs $114.00 more in total than the 12-month offer does.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'Express the extra cost of the 12-month offer as a percentage of the cash price, to two decimal places.',
            given: { cashPrice3: 1340 }, expr: 'round(#t1-p2 / cashPrice3 * 100, 2)', format: 'percent2', answer: '11.04%',
            reasoning: '$148.00 measured against the $1,340 cash price. This is the added cost over the whole 12 months, not an annual interest rate, and it should not be compared with one.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the household pays cash, what is left in the emergency reserve?',
            given: { fund: 2100, cashPrice4: 1340 }, expr: 'fund - cashPrice4', format: 'usd', answer: '$760.00',
            reasoning: '$2,100 less the $1,340 paid. The reserve is what the household would otherwise draw on if something else fails, so spending it has a cost that does not appear on any offer.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Can the 12-month payment be met out of the household’s stated monthly surplus?',
            choices: ['Yes — $124 is inside the $180 surplus', 'No — the payment exceeds the surplus'],
            given: { payment: 124, surplus: 180 },
            decision: { left: 'payment', cmp: '<', right: 'surplus', ifTrue: 'Yes — $124 is inside the $180 surplus', ifFalse: 'No — the payment exceeds the surplus' },
            answer: 'Yes — $124 is inside the $180 surplus',
            reasoning: '$124 against $180 of surplus leaves $56 a month spare. Affordability of the payment is a separate question from whether the $148.00 extra is worth paying.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The cash route costs $148.00 less than the 12-month offer but leaves the reserve at $760.00. Make the strongest case for each route using the figures, and say what you would need to know about this fictional household to prefer one.',
            acceptableAnswerCriteria: [
              'Makes the case for cash on the figures: it avoids $148.00 of added cost, and the $180 monthly surplus can rebuild the reserve from $760.00 back toward $2,100 in under eight months.',
              'Makes the case for financing on the figures: it keeps $1,340 of reserve intact against a second failure, and the $124 payment fits inside the $180 surplus with $56 to spare.',
              'Names what would decide it — how exposed the household is to another unplanned expense, how secure the income behind the $180 surplus is, or whether anything else is already claiming that surplus.',
            ],
            evidenceRequirements: [
              'Uses the $148.00 added cost and the $760.00 remaining reserve, and refers to the $180 monthly surplus.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response prices the reserve as protection rather than as idle money.',
              'Either route is credited when the case is made on the figures; the response is not scored on which one it picks.',
            ],
            commonMisconception: 'Treating the cheapest total as automatically the right choice, without asking what paying cash leaves the household exposed to.',
          },
        ],
      },
    ],
    remediation: 'If the 18-month offer looks cheapest, the comparison is being made on the monthly payment, where $89 is indeed the smallest figure. Multiply each offer out to its total — $1,488.00 and $1,602.00 against $1,340 cash — before ranking. A longer term lowers the payment and raises the total.',
    extension: 'Work out how many months of the $180 surplus it takes to rebuild the reserve to $2,100 after paying cash, and say what the household is exposed to during that period.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l03',
    grade: 12, unit: 2, day: 3,
    actor: 'a fictional customer disputing two errors on one simulated statement',
    objective: 'Separate the disputed lines on a simulated statement from the lines genuinely owed, total a claim that reaches back over earlier statements, and state what should still be paid while the dispute runs.',
    scenario: 'The statement examined below is simulated and the provider is fictional. No real account or billing record is involved.',
    materials: ['calculator', 'the fictional statement lines in these directions'],
    domains: ['consumer-protection', 'banking', 'budgeting', 'credit'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The simulated statement totals $415.89 and shows five lines: a service charge of $148.20; a second identical service charge of $148.20 for the same period; a late fee of $39.00 although the previous payment posted on time; a plan charge of $67.50 where the agreed rate is $61.50; and $12.99 for an added service the household did request and use. The plan has been billed at the wrong rate on this statement and on the 3 statements before it.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the duplicate service charge and the late fee come to together?',
            given: { duplicate: 148.20, lateFee: 39.00 }, expr: 'duplicate + lateFee', format: 'usd', answer: '$187.20',
            reasoning: 'The second $148.20 charge bills the same period twice, and the $39.00 late fee is charged against a payment the statement itself shows arrived on time. Both are errors of fact rather than disagreements about price.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is the plan overcharged each month?',
            given: { billedRate: 67.50, agreedRate: 61.50 }, expr: 'billedRate - agreedRate', format: 'usd', answer: '$6.00',
            reasoning: '$67.50 billed against the $61.50 agreed. Unlike the duplicate, this is a rate error that repeats every cycle until it is corrected.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the disputed amounts on this statement come to?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$193.20',
            reasoning: '$187.20 of duplicate and late fee plus the $6.00 overcharge on this cycle. The $12.99 added service is not in dispute and is deliberately excluded.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now build the full claim and work out what should still be paid.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much was overcharged across the 3 earlier statements?',
            given: { priorMonths: 3 }, expr: '#t1-p2 * priorMonths', format: 'usd', answer: '$18.00',
            reasoning: '$6.00 on each of the 3 earlier statements. That money has already been paid, so recovering it is a refund claim rather than a deduction from what is due now.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total claim, this statement and the earlier ones together?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$211.20',
            reasoning: '$193.20 on this statement plus $18.00 already paid on earlier ones.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What should the household pay on this statement while the dispute is open?',
            given: { statementTotal: 415.89 }, expr: 'statementTotal - #t1-p3', format: 'usd', answer: '$222.69',
            reasoning: 'The $415.89 total less the $193.20 disputed on this statement. Paying the undisputed remainder keeps the account current, so the provider cannot add a genuine late fee on top of an argument about a mistaken one.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Should the $12.99 charge for the added service the household requested and used form part of the dispute?',
            choices: ['Yes — it appears on the same statement as the errors', 'No — the household requested and used that service'],
            answer: 'No — the household requested and used that service',
            reasoning: 'The statement facts say this service was requested and used, so the charge is correct. Including a valid charge in a dispute weakens the credibility of the claims that are sound; this follows from the stated facts rather than from any comparison.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Set out what the household should put in writing to the provider, and explain why paying $222.69 rather than either $0.00 or the full $415.89 is the strongest position while the dispute is open.',
            acceptableAnswerCriteria: [
              'Specifies what the written claim contains: each disputed line identified separately with its amount, the reason it is wrong, and the total of $211.20 including the $18.00 from the 3 earlier statements.',
              'Explains why paying nothing is weak: the $222.69 is genuinely owed, and withholding it invites a real late fee and a mark against the account that the dispute would not cover.',
              'Explains why paying everything is weak: paying the $193.20 concedes the disputed amount and converts the claim into a request for a refund the household must then chase.',
              'Notes that the rate error will recur at $6.00 a cycle until corrected, so the letter must ask for the rate to be fixed going forward and not only for money back.',
            ],
            evidenceRequirements: [
              'Uses the $211.20 total claim and the $222.69 undisputed amount, and distinguishes the one-off errors from the recurring rate error.',
            ],
            dimensions: ['plan-coherence', 'evidence-use', 'criteria-application'],
            lookFors: [
              'The response separates the recurring error from the one-off errors and asks for different remedies for each.',
              'The response keeps the valid $12.99 charge out of the claim.',
            ],
            commonMisconception: 'Treating a disputed statement as all-or-nothing, so the household either pays everything or pays nothing while the argument runs.',
          },
        ],
      },
    ],
    remediation: 'If the amount to pay comes out as $204.69, the $12.99 added service has been treated as disputed. Work line by line: the duplicate $148.20, the $39.00 late fee, and the $6.00 overcharge are wrong; the original $148.20 service charge, the $61.50 that was properly owed, and the $12.99 are right. Subtract only the first group from $415.89.',
    extension: 'Work out what the claim would grow to if the rate error ran for 9 more cycles before being corrected, and say what that implies about how quickly a recurring error should be raised.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l04',
    grade: 12, unit: 2, day: 4,
    actor: 'a fictional household auditing a year of recurring services',
    objective: 'Audit a fictional household’s recurring services against actual use, total what cancellation would recover, and express the recovery as a share of the whole outlay.',
    scenario: 'The eight simulated services below, their prices, and the fictional household’s use of them are invented for this exercise.',
    materials: ['calculator', 'the fictional service list in these directions'],
    domains: ['budgeting', 'consumer-protection', 'saving-investing', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household pays for eight services. Seven are billed monthly: A at $15.99, B at $8.49, C at $22.00, D at $6.99, F at $11.99, G at $9.99, and H at $17.50. One, E, is billed once a year at $54.00. The household used A, C, E, and G in the last month. It has not used B, D, or F for most of the year. H duplicates what C already provides.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the seven monthly services cost in one month, together?',
            given: { sA: 15.99, sB: 8.49, sC: 22.00, sD: 6.99, sF: 11.99, sG: 9.99, sH: 17.50 },
            expr: 'sA + sB + sC + sD + sF + sG + sH', format: 'usd', answer: '$92.95',
            reasoning: 'The seven monthly charges added. Individually none of them would prompt a review; the sum is what makes the audit worth doing.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do all eight services cost across a year?',
            given: { sE: 54.00 }, expr: '#t1-p1 * 12 + sE', format: 'usd', answer: '$1,169.40',
            reasoning: '$92.95 in each of 12 months plus the $54.00 annual charge. The annual service is the one most easily forgotten in a review that works from a monthly statement.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now separate the services by whether they are used, and price what the audit could recover.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the three unused services — B, D, and F — cost across a year?',
            given: { sB2: 8.49, sD2: 6.99, sF2: 11.99 }, expr: '(sB2 + sD2 + sF2) * 12', format: 'usd', answer: '$329.64',
            reasoning: '$27.47 a month across 12 months. These are recoverable in full, because the household is not receiving anything for them.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the duplicate service H cost across a year?',
            given: { sH2: 17.50 }, expr: 'sH2 * 12', format: 'usd', answer: '$210.00',
            reasoning: '$17.50 across 12 months. H is a different case from B, D, and F: it is used, but it delivers what C already provides, so cancelling it costs the household no capability.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would cancelling all four recover in a year?',
            given: {}, expr: '#t2-p1 + #t2-p2', format: 'usd', answer: '$539.64',
            reasoning: '$329.64 from the unused services plus $210.00 from the duplicate.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What share of the total annual outlay does that recovery represent, to two decimal places?',
            given: {}, expr: 'round(#t2-p3 / #t1-p2 * 100, 2)', format: 'percent2', answer: '46.15%',
            reasoning: '$539.64 measured against the $1,169.40 the household spends. Nearly half the outlay buys either nothing or a second copy of something.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Cancelling B, D, and F is straightforward. Cancelling H is a different kind of decision. Explain the difference, and say what the household should verify before cancelling H that it does not need to verify before cancelling the other three.',
            acceptableAnswerCriteria: [
              'States the difference precisely: B, D, and F deliver nothing the household uses, so cancelling costs no capability, while H is used and cancelling it removes something the household would then rely on C to provide.',
              'Names what must be verified for H: that C genuinely covers everything H is being used for, at the quality and on the terms the household relies on, before the $210.00 is treated as recoverable.',
              'Notes that the $329.64 is therefore a firmer figure than the $539.64, because part of the larger figure depends on a substitution that has not yet been tested.',
            ],
            evidenceRequirements: [
              'Uses the $329.64 unused-service figure and the $210.00 duplicate figure, and states which is the more certain saving.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response distinguishes waste from redundancy rather than treating both as unused.',
              'The response does not assume the substitution works simply because both services are described in the same category.',
            ],
            commonMisconception: 'Treating every service that could be cancelled as an equally certain saving, without checking what the household would lose in each case.',
          },
        ],
      },
    ],
    remediation: 'If the annual total comes out as $1,115.40, the $54.00 annual service has been left out; if it comes out near $14,032, the annual charge has been multiplied by 12 as well. Annualise each line on its own billing cycle: seven services at twelve charges each, and one service at a single charge.',
    extension: 'Rank the eight services by annual cost rather than monthly price, and say which service the two orderings disagree about most.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l05',
    grade: 12, unit: 2, day: 5,
    actor: 'a fictional buyer whose purchase failed after the return window closed',
    objective: 'Establish which remedies remain open on a fictional failed purchase once one window has closed, price the route the household would otherwise pay for, and order the escalation.',
    scenario: 'The simulated purchase, the store policy, the manufacturer warranty, and the card issuer’s dispute window described below are all invented for this exercise.',
    materials: ['calculator', 'the fictional purchase and policy terms in these directions'],
    domains: ['consumer-protection', 'credit', 'insurance-risk', 'budgeting'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional buyer paid $684 for a simulated appliance using a credit card. The store accepts returns for 30 days and charges a restocking fee of 10%. The manufacturer warranty runs 24 months and covers repair at no charge. The card issuer accepts a dispute up to 120 days from the charge. The appliance fails on day 96, which the fictional warranty administrator counts as 3 whole months of the warranty used. A repair shop quotes $228 for the repair plus a $45 diagnostic fee.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'If a return were still possible, what would the restocking fee be?',
            given: { price: 684, restockRate: 0.10 }, expr: 'price * restockRate', format: 'usd', answer: '$68.40',
            reasoning: '10% of the $684 price. Computing this makes the point that even the return route was never a full refund.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would a return inside the window have refunded?',
            given: { price2: 684 }, expr: 'price2 - #t1-p1', format: 'usd', answer: '$615.60',
            reasoning: '$684 less the $68.40 restocking fee. This is the benchmark the remaining routes are judged against.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now establish what is still open on day 96, and what the household avoids by using it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'days',
            text: 'How many days remain in the card issuer’s dispute window on day 96?',
            given: { disputeWindow: 120, dayOfFailure: 96 }, expr: 'disputeWindow - dayOfFailure', format: 'int', answer: '24',
            reasoning: '120 days from the charge, less the 96 already elapsed. This route is still open but closing, which is what makes the ordering of the escalation matter.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'months',
            text: 'How many months of manufacturer warranty remain?',
            given: { warrantyMonths: 24, elapsedMonths: 3 }, expr: 'warrantyMonths - elapsedMonths', format: 'months0', answer: '21',
            reasoning: '24 months of cover less the 3 counted as used. This is much the longest-running of the three routes, and the only one that covers a failure rather than a transaction.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the household pay to have the appliance repaired without using the warranty?',
            given: { repairQuote: 228, diagnostic: 45 }, expr: 'repairQuote + diagnostic', format: 'usd', answer: '$273.00',
            reasoning: 'The $228 repair plus the $45 diagnostic. This is the amount the warranty route is worth to the household if it is honoured.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Is the store return route available on day 96?',
            choices: ['Yes — the appliance is defective, which extends the window', 'No — the 30-day return window closed 66 days ago'],
            answer: 'No — the 30-day return window closed 66 days ago',
            reasoning: 'The stated store policy accepts returns for 30 days and attaches no exception for a later defect, so day 96 is outside it. The warranty exists precisely to cover the period the return policy does not; this is read from the stated terms rather than derived from a comparison.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Put the remaining routes in the order you would use them, and justify the order with the figures. Say specifically why the 24 days left on one window should affect the order even though that route is not the one you would try first.',
            acceptableAnswerCriteria: [
              'Puts the manufacturer warranty first and justifies it: it directly covers the failure, runs for another 21 months, and saves the full $273.00 the household would otherwise pay.',
              'Explains the effect of the 24 days: the card dispute route expires soon, so the household should open the warranty claim promptly and be ready to raise the dispute before day 120 if the warranty claim stalls — the clock constrains how long the first route can be allowed to run.',
              'Notes that the store return is closed and the $615.60 benchmark is no longer available, so it does not belong in the order.',
            ],
            evidenceRequirements: [
              'Uses the 21 months of remaining warranty, the 24 days remaining on the dispute window, and the $273.00 repair cost.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The order is justified by what each route covers and by its deadline, not by which is easiest.',
              'The response treats the shortest deadline as a constraint on timing rather than as a reason to use that route first.',
            ],
            commonMisconception: 'Treating consumer remedies as one queue to be tried in sequence, without noticing that the routes expire on different clocks.',
          },
        ],
      },
    ],
    remediation: 'If the store return looks available, check the policy against the calendar: 30 days from purchase ends on day 30, and the failure is on day 96. A defect does not extend a stated return window. The routes that remain are the ones written to cover a later failure — the 24-month warranty and, for 24 more days, the card dispute.',
    extension: 'Work out what the household loses by discovering the failure on day 130 instead, and say which single route that change removes.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l06',
    grade: 12, unit: 2, day: 6,
    actor: 'a fictional household reviewing a completed year against the plan it started with',
    objective: 'Reconcile a fictional year of actual spending against plan category by category, show that savings absorbed the whole net overspend, and identify which adjustment the figures support.',
    scenario: 'The plan and the year of actual spending compared below belong to a fictional household. Every figure is invented for this exercise.',
    materials: ['calculator', 'the fictional plan and actual figures in these directions'],
    domains: ['budgeting', 'saving-investing', 'insurance-risk', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household planned, for the year: housing $15,420, food $6,600, transport $4,800, insurance $2,448, discretionary $3,000, and savings $4,200. It actually spent: housing $15,420, food $7,284, transport $4,116, insurance $2,619, discretionary $3,915, and saved $3,114.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What did the household plan to allocate across all six categories?',
            given: { housing: 15420, food: 6600, transport: 4800, insurance: 2448, discretionary: 3000, savings: 4200 },
            expr: 'housing + food + transport + insurance + discretionary + savings', format: 'usd', answer: '$36,468.00',
            reasoning: 'The six planned figures added, with savings treated as an allocation like any other rather than as what is left over.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What did the household actually allocate across the same six categories?',
            given: { housing2: 15420, foodA: 7284, transportA: 4116, insuranceA: 2619, discretionaryA: 3915, savingsA: 3114 },
            expr: 'housing2 + foodA + transportA + insuranceA + discretionaryA + savingsA', format: 'usd', answer: '$36,468.00',
            reasoning: 'The six actual figures added. The totals match exactly, which is why a review that stops at the total finds nothing wrong.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The totals agree, so work category by category to find what actually happened.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much did discretionary spending exceed its plan?',
            given: { discretionaryA2: 3915, discretionary2: 3000 }, expr: 'discretionaryA2 - discretionary2', format: 'usd', answer: '$915.00',
            reasoning: '$3,915 against $3,000 planned — the largest single overspend in the year.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did savings fall short of its plan?',
            given: { savings2: 4200, savingsA2: 3114 }, expr: 'savings2 - savingsA2', format: 'usd', answer: '$1,086.00',
            reasoning: '$3,114 saved against $4,200 planned. Nothing decided this figure directly; it is what remained after the other five categories took what they took.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What do the three categories that exceeded plan — food, insurance, and discretionary — come to in total overspend?',
            given: { foodA2: 7284, food2: 6600, insuranceA2: 2619, insurance2: 2448 }, expr: '(foodA2 - food2) + (insuranceA2 - insurance2) + #t2-p1', format: 'usd', answer: '$1,770.00',
            reasoning: '$684.00 on food, $171.00 on insurance, and $915.00 on discretionary.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Netting off the one category that came in under plan, what is the net overspend outside savings?',
            given: { transport2: 4800, transportA2: 4116 }, expr: '#t2-p3 - (transport2 - transportA2)', format: 'usd', answer: '$1,086.00',
            reasoning: '$1,770.00 of overspend less $684.00 of underspend on transport. It equals the savings shortfall exactly, which is the arithmetic proof that savings was the residual.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The year came in exactly on total and $1,086.00 short on savings. Explain what that equality shows about how this plan actually worked, and propose one change to the plan for next year, saying what it would cost the household.',
            acceptableAnswerCriteria: [
              'Explains the structure: savings was funded by whatever remained, so every dollar of net overspend elsewhere came out of it automatically and without a decision being made.',
              'Uses the equality as evidence: the $1,086.00 net overspend and the $1,086.00 savings shortfall are the same money, which is what shows savings absorbed the variance rather than merely happening to be low.',
              'Proposes a concrete change with its cost — for example moving the $4,200 of savings to the front so it is transferred before spending, which would have forced $1,086.00 of cuts across food, insurance, and discretionary instead.',
            ],
            evidenceRequirements: [
              'Uses the matching $1,086.00 figures and at least one category variance, such as the $915.00 on discretionary or the $684.00 on food.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response recognises that a plan meeting its total can still fail completely.',
              'The proposed change names what would have to give, rather than only what should be protected.',
            ],
            commonMisconception: 'Reading a matching annual total as evidence that a plan worked, when the total can only match if the residual category has absorbed everything.',
          },
        ],
      },
    ],
    remediation: 'If the review concludes the year went to plan, compare the categories rather than the totals. Five of the six differ from plan, and they cancel out to zero only because savings moved to make them. Compute each category’s variance and check whether they sum to the savings shortfall.',
    extension: 'Rebuild the year with savings fixed at $4,200 and the $1,086.00 taken from the three overspent categories in proportion to their overspend, and say which category takes the largest cut.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l07',
    grade: 12, unit: 2, day: 7,
    actor: 'a fictional household that accepted six small increases and refused one large purchase',
    objective: 'Aggregate a set of small recurring increases a fictional household accepted, compare them against a one-off purchase it refused, and name the misconception that produced the inconsistency.',
    scenario: 'The six simulated price increases and the fictional refused purchase described below are invented for this exercise.',
    materials: ['calculator', 'the fictional increase list in these directions'],
    domains: ['budgeting', 'consumer-protection', 'saving-investing', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Across one year the fictional household accepted six increases on services it keeps: $2.00, $3.50, $9.99, $4.25, $6.00, and $1.75 a month. In the same year it refused a one-off purchase of $400 on the grounds that it was too expensive. Assume the six increases stay at the new level and no further increases arrive for 3 years.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the six increases add up to per month?',
            given: { i1: 2.00, i2: 3.50, i3: 9.99, i4: 4.25, i5: 6.00, i6: 1.75 }, expr: 'i1 + i2 + i3 + i4 + i5 + i6', format: 'usd', answer: '$27.49',
            reasoning: 'The six monthly increases added. Each was accepted separately, and none was ever compared with the others.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do they come to across one year?',
            given: {}, expr: '#t1-p1 * 12', format: 'usd', answer: '$329.88',
            reasoning: '$27.49 in each of 12 months. Already, one year of increases approaches the purchase the household refused.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What do they come to across the 3 years?',
            given: { horizon: 3 }, expr: '#t1-p2 * horizon', format: 'usd', answer: '$989.64',
            reasoning: '$329.88 a year for 3 years, holding the increases flat as the prompt states. The flat assumption makes this a floor: any further increase raises it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now set the two decisions side by side.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'How many times the refused $400 purchase is the 3-year cost of the accepted increases? Give two decimal places.',
            given: { oneOff: 400 }, expr: 'round(#t1-p3 / oneOff, 2)', format: 'dec2', answer: '2.47',
            reasoning: '$989.64 measured against $400. The household refused the smaller commitment and accepted the larger one, in the same year.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Over the 3 years, which decision commits the household to more money?',
            choices: ['Accepting the six increases', 'Making the one-off purchase'],
            given: { oneOff2: 400 },
            decision: { left: '#t1-p3', cmp: '>', right: 'oneOff2', ifTrue: 'Accepting the six increases', ifFalse: 'Making the one-off purchase' },
            answer: 'Accepting the six increases',
            reasoning: '$989.64 against $400. The increases also differ in kind: they continue beyond the 3 years unless something is done, while the purchase ends when it is paid for.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The household refused $400 and accepted $989.64. Name the misconception that makes this feel consistent at the time, and describe a rule the household could adopt that would have caught it — stating what your rule would cost in effort.',
            acceptableAnswerCriteria: [
              'Names the misconception: each increase was judged alone and per month, where $9.99 is small, while the purchase was judged as a single visible total, so the two decisions were never measured on the same scale.',
              'Identifies the second element — recurrence. The $400 ends when paid; the $27.49 a month continues indefinitely, so a three-year window understates it rather than overstating it.',
              'Proposes a workable rule, such as converting any recurring increase to its annual or multi-year cost before accepting it, or reviewing all increases together once a year rather than one at a time.',
              'States the cost of the rule honestly — it requires tracking increases as they arrive and setting aside time for a review that nothing forces the household to do.',
            ],
            evidenceRequirements: [
              'Uses the $989.64 three-year figure against the $400 refused purchase, and refers to the $27.49 monthly total.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response identifies the framing difference rather than concluding the household was simply careless.',
              'The response notes that the comparison understates the gap, because the increases do not stop at 3 years.',
            ],
            commonMisconception: 'Comparing a recurring monthly increase with a one-off price directly, when the two are not the same kind of commitment and are not measured over the same period.',
          },
        ],
      },
    ],
    remediation: 'If the two decisions still look consistent, put them on one scale. Convert the monthly increases to a yearly figure of $329.88 and then to $989.64 across the 3 years, and only then set that against the $400. Comparing $9.99 a month with $400 compares a rate against a total.',
    extension: 'Recompute the 3-year figure assuming each of the six services raises its price by a further 4% each year, and say how much the flat assumption understated.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l08',
    grade: 12, unit: 2, day: 8,
    actor: 'a fictional household financing a used vehicle inside an existing budget',
    objective: 'Carry the total-cost method onto a larger fictional purchase that changes three budget lines at once, and test the result against the surplus that has to carry it.',
    scenario: 'The simulated vehicle, loan terms, insurance change, and running costs below belong to a fictional household and are invented for this exercise.',
    materials: ['calculator', 'the fictional vehicle and budget figures in these directions'],
    domains: ['credit', 'debt', 'budgeting', 'insurance-risk', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional vehicle is priced at $9,600. The household would put $1,600 down and make 48 monthly payments of $196. Insurance would rise from $71 a month to $118 a month, and fuel and maintenance are estimated at $145 a month. The household currently has $520 a month of surplus.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the loan payments come to over the full term?',
            given: { payment: 196, term: 48 }, expr: 'payment * term', format: 'usd', answer: '$9,408.00',
            reasoning: '48 payments of $196. The term is long enough that the monthly figure and the total tell very different stories.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is handed over in total, including the down payment?',
            given: { down: 1600 }, expr: '#t1-p1 + down', format: 'usd', answer: '$11,008.00',
            reasoning: '$9,408.00 of payments plus the $1,600 paid at the start. The down payment is part of the price, not separate from it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more than the vehicle’s price is that?',
            given: { price: 9600 }, expr: '#t1-p2 - price', format: 'usd', answer: '$1,408.00',
            reasoning: '$11,008.00 against the $9,600 price. This is the cost of borrowing, and it is close to the whole down payment.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what the purchase does to the monthly budget, not just to the price.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the vehicle add to monthly outgoings, counting the payment, the insurance increase, and running costs?',
            given: { payment2: 196, insuranceNew: 118, insuranceOld: 71, running: 145 },
            expr: 'payment2 + (insuranceNew - insuranceOld) + running', format: 'usd', answer: '$388.00',
            reasoning: 'The $196 payment, the $47 by which insurance rises, and $145 of fuel and maintenance. Only the insurance increase counts, because $71 was already being paid.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What surplus is left each month once the vehicle is in the budget?',
            given: { surplus: 520 }, expr: 'surplus - #t2-p1', format: 'usd', answer: '$132.00',
            reasoning: '$520 of surplus less $388.00 of new outgoings.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the surplus does the vehicle consume, to two decimal places?',
            given: { surplus2: 520 }, expr: 'round(#t2-p1 / surplus2 * 100, 2)', format: 'percent2', answer: '74.62%',
            reasoning: '$388.00 measured against $520. The payment alone would have looked like 37.69% of surplus, which is why the payment alone is the wrong test.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Does the full monthly cost of the vehicle fit inside the household’s surplus?',
            choices: ['Yes — but with $132.00 a month to spare', 'No — the monthly cost exceeds the surplus'],
            given: { surplus3: 520 },
            decision: { left: '#t2-p1', cmp: '<', right: 'surplus3', ifTrue: 'Yes — but with $132.00 a month to spare', ifFalse: 'No — the monthly cost exceeds the surplus' },
            answer: 'Yes — but with $132.00 a month to spare',
            reasoning: '$388.00 against $520 of surplus. It fits arithmetically; whether $132.00 is an adequate margin for 48 months is a separate judgement the arithmetic cannot settle.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The purchase fits the surplus and consumes 74.62% of it for 48 months. Argue either that this household should proceed or that it should not, using the figures, and state the single fact about the household you would most want to know before backing your own argument.',
            acceptableAnswerCriteria: [
              'Argues one side on the figures — for instance that $132.00 of remaining surplus is a thin margin to hold for 48 months, or that $388.00 buys transport the household may need and still leaves a positive margin every month.',
              'Uses the term length as part of the argument: the commitment is 48 months long, so the question is whether the margin survives four years rather than whether it works next month.',
              'Names the decisive unknown and says why it matters — for example how stable the income behind the $520 surplus is, whether an emergency reserve exists separately, or what the household would do about the $196 payment in a month with no surplus at all.',
            ],
            evidenceRequirements: [
              'Uses the $388.00 monthly cost, the $132.00 remaining surplus, and the 48-month term.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'plan-coherence'],
            lookFors: [
              'The response counts all three cost lines rather than the loan payment alone.',
              'Either conclusion is credited when it is argued from the figures and names what would change it.',
            ],
            commonMisconception: 'Testing affordability against the loan payment alone, when insurance and running costs arrive with the vehicle and are more than half as large again.',
          },
        ],
      },
    ],
    remediation: 'If the vehicle looks like it consumes only about 38% of the surplus, the test is being run on the $196 payment alone. A vehicle brings three changes: the payment, the $47 rise in insurance, and $145 of running costs. Add all three to $388.00 before comparing with the $520 surplus.',
    extension: 'Find the largest monthly loan payment this household could take on while keeping at least $250 a month of surplus, and say what vehicle price that implies over the same 48-month term.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l09',
    grade: 12, unit: 2, day: 9,
    actor: 'a fictional cardholder facing unauthorised charges and a merchant error on one statement',
    objective: 'Separate unauthorised charges from a merchant billing error on a simulated card statement, compute what is genuinely owed, and route each category to the right remedy.',
    scenario: 'The simulated card statement below and every charge on it are fictional. No real card, account, or merchant is involved, and no card details appear anywhere in this lesson.',
    materials: ['calculator', 'the fictional statement summary in these directions'],
    domains: ['fraud', 'consumer-protection', 'credit', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The simulated statement totals $1,247.83. It includes two charges the cardholder did not make and does not recognise, for $318.40 and $96.75. It also includes a charge of $54.00 from a merchant the cardholder did use, billed twice for one purchase. The rest of the statement is charges the cardholder made and accepts. Interest runs at 1.65% a month on any balance carried.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the two unrecognised charges come to?',
            given: { unauth1: 318.40, unauth2: 96.75 }, expr: 'unauth1 + unauth2', format: 'usd', answer: '$415.15',
            reasoning: 'The two charges the cardholder did not make. These are a different category from the merchant error: the cardholder has no relationship with whoever made them.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of everything the cardholder should not have to pay?',
            given: { duplicate: 54.00 }, expr: '#t1-p1 + duplicate', format: 'usd', answer: '$469.15',
            reasoning: '$415.15 of unauthorised charges plus the $54.00 duplicate. They are added here to size the problem, but they do not travel to the same place.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is genuinely owed on this statement?',
            given: { statementTotal: 1247.83 }, expr: 'statementTotal - #t1-p2', format: 'usd', answer: '$778.68',
            reasoning: '$1,247.83 less the $469.15 in dispute. Establishing this figure early is what lets the cardholder keep the account current while the rest is investigated.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now route each category and price the delay.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Which of the disputed amounts should be reported to the card issuer as charges the cardholder did not make, rather than taken up with a merchant first?',
            choices: ['The $415.15 of unrecognised charges', 'The $54.00 duplicate charge', 'All $469.15 together'],
            answer: 'The $415.15 of unrecognised charges',
            reasoning: 'The $415.15 was not authorised by the cardholder at all, so there is no merchant relationship to resolve it through and the issuer is the correct first route. The $54.00 duplicate arises from a purchase the cardholder did make, which the merchant can correct directly. This follows from the stated facts about each charge.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If the disputed $469.15 were carried on the card for one month at 1.65% rather than being disputed, what would the interest be?',
            given: { monthlyRate: 0.0165 }, expr: 'round(#t1-p2 * monthlyRate, 2)', format: 'usd', answer: '$7.74',
            reasoning: '1.65% of $469.15 for one month. It prices the cost of doing nothing, and shows why the disputed amount should not simply be paid and argued about afterwards.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'The card issuer’s minimum payment for the month is $35. Does the genuinely owed amount exceed it?',
            choices: ['Yes — the owed amount is well above the minimum', 'No — the minimum is larger than what is owed'],
            given: { minimumPayment: 35 },
            decision: { left: '#t1-p3', cmp: '>', right: 'minimumPayment', ifTrue: 'Yes — the owed amount is well above the minimum', ifFalse: 'No — the minimum is larger than what is owed' },
            answer: 'Yes — the owed amount is well above the minimum',
            reasoning: '$778.68 against a $35 minimum. Paying the full undisputed $778.68 rather than the $35 minimum keeps the account current without conceding any part of the $469.15.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Two problems on one statement need two different responses. Explain why the $415.15 and the $54.00 are not the same kind of problem, say what each response should be, and name one action the cardholder should take about the $415.15 that has nothing to do with this statement.',
            acceptableAnswerCriteria: [
              'Distinguishes the categories: the $54.00 is a billing error by a merchant the cardholder chose to deal with, while the $415.15 was never authorised and indicates the card details are being used by someone else.',
              'Gives each response: the merchant is asked to reverse the duplicate, and the issuer is notified of the unauthorised charges so the card can be stopped and the charges investigated.',
              'Names a forward-looking action on the $415.15 — having the card number replaced, and checking later statements for further charges — because the underlying problem is not confined to this statement.',
              'Notes that the $778.68 should be paid on time regardless, so no late fee or interest attaches while either matter is resolved.',
            ],
            evidenceRequirements: [
              'Uses the $415.15 and $54.00 figures separately, and the $778.68 genuinely owed.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'evidence-use'],
            lookFors: [
              'The response treats the unauthorised charges as evidence of an ongoing exposure rather than as a one-off billing question.',
              'The response never suggests sharing card numbers or account credentials with anyone as part of the remedy.',
            ],
            commonMisconception: 'Treating every charge a cardholder objects to as one dispute, when an unauthorised charge and a merchant error need different remedies and different urgency.',
          },
        ],
      },
    ],
    remediation: 'If the amount owed comes out as $832.68, only the unauthorised charges have been removed and the $54.00 duplicate is still in the total. Take out everything the cardholder should not pay — $318.40, $96.75, and $54.00 — to reach $778.68, and keep the two categories labelled separately, because they go to different places.',
    extension: 'Work out what the interest would come to if the disputed $469.15 stayed on the card for 4 months, and say what that implies about how quickly an unauthorised charge should be reported.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u02-l10',
    grade: 12, unit: 2, day: 10,
    actor: 'a fictional household running a full annual audit of ten recurring services',
    objective: 'Run a complete fictional service audit across cancellation, downgrade, and billing-cycle changes, quantify the annual and monthly recovery, and commit the freed money to a stated use.',
    scenario: 'The ten simulated services, their prices, and the fictional household’s use of them below are invented for this exercise.',
    materials: ['calculator', 'the fictional service inventory in these directions'],
    domains: ['budgeting', 'consumer-protection', 'saving-investing', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household pays eight services monthly: s1 at $19.99, s2 at $12.50, s3 at $7.99, s4 at $24.00, s5 at $5.99, s6 at $16.49, s7 at $10.00, and s8 at $32.00. Two more are billed annually: s9 at $96.00 and s10 at $149.00. The household has not used s3, s5, or s7 all year. Service s8 has a lower tier at $14.00 a month that covers everything the household actually uses. Service s10 is also offered at $12.00 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the eight monthly services cost in one month?',
            given: { s1: 19.99, s2: 12.50, s3: 7.99, s4: 24.00, s5: 5.99, s6: 16.49, s7: 10.00, s8: 32.00 },
            expr: 's1 + s2 + s3 + s4 + s5 + s6 + s7 + s8', format: 'usd', answer: '$128.96',
            reasoning: 'The eight monthly charges added, before any annual service is brought in.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do those eight cost across a year?',
            given: {}, expr: '#t1-p1 * 12', format: 'usd', answer: '$1,547.52',
            reasoning: '$128.96 in each of the 12 months of the year. Annualising before the audit is what makes a $7.99 service and a $149.00 service comparable.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the household’s total annual outlay on all ten services?',
            given: { s9: 96.00, s10: 149.00 }, expr: '#t1-p2 + s9 + s10', format: 'usd', answer: '$1,792.52',
            reasoning: '$1,547.52 of monthly services plus the two annual charges of $96.00 and $149.00. This is the figure the audit is measured against.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Price each of the three kinds of change the audit makes available.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What would cancelling the three unused services s3, s5, and s7 recover in a year?',
            given: { s3b: 7.99, s5b: 5.99, s7b: 10.00, months2: 12 }, expr: '(s3b + s5b + s7b) * months2', format: 'usd', answer: '$287.76',
            reasoning: '$23.98 a month across 12 months, recovered in full because the household receives nothing for these.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would moving s8 to the $14.00 tier save in a year?',
            given: { s8b: 32.00, s8new: 14.00, months3: 12 }, expr: '(s8b - s8new) * months3', format: 'usd', answer: '$216.00',
            reasoning: 'The $18.00 monthly difference across 12 months. This is a downgrade rather than a cancellation, and the stated condition is that the lower tier covers what the household uses.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would moving s10 from the $149.00 annual price to the $12.00 monthly price save in a year?',
            given: { s10b: 149.00, s10new: 12.00, months4: 12 }, expr: 's10b - s10new * months4', format: 'usd', answer: '$5.00',
            reasoning: '$149.00 against $144.00 a year billed monthly. It is the smallest change on the list, and it reverses the usual assumption that paying annually is always cheaper.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the whole audit recover in a year?',
            given: {}, expr: '#t2-p1 + #t2-p2 + #t2-p3', format: 'usd', answer: '$508.76',
            reasoning: '$287.76 from cancellations, $216.00 from the downgrade, and $5.00 from the billing change.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Express the recovery in the two forms a household actually uses.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'What share of the annual outlay does the audit recover, to two decimal places?',
            given: {}, expr: 'round(#t2-p4 / #t1-p3 * 100, 2)', format: 'percent2', answer: '28.38%',
            reasoning: '$508.76 measured against the $1,792.52 total outlay.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does the audit free up per month?',
            given: { months5: 12 }, expr: 'round(#t2-p4 / months5, 2)', format: 'usd', answer: '$42.40',
            reasoning: '$508.76 across 12 months. This is the form the money actually arrives in, and it is what a budget can be rewritten around.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write the audit decision. Give a figure for every line of it.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the household’s audit decision: what is cancelled, what is downgraded, what is left alone, and where the freed money goes. Justify each line with a figure, and say which of your three changes is the least certain to deliver what you claimed and why.',
            acceptableAnswerCriteria: [
              'States the cancellations and downgrade with their figures — $287.76 from s3, s5, and s7, $216.00 from moving s8 to the $14.00 tier, and $5.00 from rebilling s10 monthly.',
              'Names at least one service left alone and gives the reason, rather than treating the audit as a directive to cancel everything reviewed.',
              'Commits the $42.40 a month to a stated use — a reserve, a debt payment, a savings transfer — rather than leaving it in general spending where it will be absorbed without a decision.',
              'Identifies the least certain change with a reason: the s8 downgrade rests on the claim that the $14.00 tier covers what the household uses, which the audit has assumed rather than tested, so $216.00 of the $508.76 is conditional.',
            ],
            evidenceRequirements: [
              'Uses the $508.76 annual recovery and the $42.40 monthly figure, and cites at least two individual service savings.',
              'States what the freed money is committed to, in figures.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'evidence-use', 'communication-of-uncertainty'],
            lookFors: [
              'The decision distinguishes cancelling, downgrading, and rebilling as three different kinds of change with different risks.',
              'A response that keeps a service the figures say could be cut is credited when it gives a reason for the value the household gets from it.',
              'The response does not treat the $5.00 rebilling saving as significant simply because it was found.',
            ],
            commonMisconception: 'Treating an audit as a list of things to cancel, so a service that is used and worth its price gets cut alongside the ones that are not.',
          },
        ],
      },
    ],
    remediation: 'If the recovery comes out at $503.76, the s10 billing change has been left out; if it comes out near $719.76, s8 has been counted as cancelled rather than downgraded. Price each change for what it actually is: three cancellations recovering the full charge, one downgrade recovering only the $18.00 difference, and one billing change recovering $5.00.',
    extension: 'Suppose the $14.00 tier of s8 turns out not to cover one feature the household uses monthly. Rework the audit total without that change, and say what share of the original recovery survives.',
  },
]
