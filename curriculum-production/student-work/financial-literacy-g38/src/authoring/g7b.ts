import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, grow, m, most, pct, scale, sel, sum } from './dsl.ts'

/** Grade 7 Financial Literacy, units 4-6: credit and borrowing, investing and protection, taxes and the plan capstone. */
export const G7B: readonly AuthoredLesson[] = [
  {
    key: 'g7-u04-l01',
    authority: 'FIXED',
    character: 'Ronan',
    objective:
      'Learners separate principal, interest, and term in an invented loan, and see how extending the term changes the total cost without changing the principal.',
    scenario:
      'Ronan is a made-up seventh grader modelling a pretend loan: $1,500.00 of principal at 12% simple interest a year. He compares a one-year term with a two-year term. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest on Ronan\'s invented $1,500.00 principal at 12%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest accrues in one year?', fixed: { expected: '$180.00', compute: pct(m(1500.0), 1200) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add that interest to the principal for the one-year term, then work out the two-year term on the same simple basis.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total over one year?', fixed: { expected: '$1,680.00', compute: sum(m(1500.0), pct(m(1500.0), 1200)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total over two years?', fixed: { expected: '$1,860.00', compute: sum(m(1500.0), pct(m(1500.0), 1200), pct(m(1500.0), 1200)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the two terms, then compute what the same two-year loan would cost at 8% instead of 12%.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the two-year term cost than the one-year term?', fixed: { expected: '$180.00', compute: diff(sum(m(1500.0), pct(m(1500.0), 1200), pct(m(1500.0), 1200)), sum(m(1500.0), pct(m(1500.0), 1200))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total over two years at 8%?', fixed: { expected: '$1,740.00', compute: sum(m(1500.0), pct(m(1500.0), 800), pct(m(1500.0), 800)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Principal never moved; total cost did.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Ronan\'s figures, explain how rate and term each affect what a borrower repays, and why a longer term with smaller payments can still cost more.' }] },
    ],
    rubric: [
      crit(
        'Separating principal, rate, and term',
        'The response conflates Ronan\'s principal with the total repaid.',
        'Rate or term is discussed for Ronan but not both.',
        'The response uses Ronan\'s figures to show that principal is fixed while both a higher rate and a longer term raise total cost, and explains why smaller payments can still mean paying more.',
      ),
    ],
    remediation:
      'If a learner adds interest to interest, write the simple-interest rule for Ronan at the top and mark the principal as the base for each year.',
    extension: 'Ask the learner what rate would make Ronan\'s two-year loan cost the same as the one-year loan at 12%, and to show the method.',
  },
  {
    key: 'g7-u04-l02',
    authority: 'FIXED',
    character: 'Marguerite',
    objective:
      'Learners quantify what an invented difference in credit standing costs by comparing interest on the same borrowed amount at two rates.',
    scenario:
      'Marguerite is an invented seventh grader studying a pretend lending table. On a $2,000.00 invented loan, one borrower is offered 9% and another 15% for the simulated year, purely because of a difference in recorded repayment history. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest at Marguerite\'s lower invented rate of 9%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the 9% rate cost in a year?', fixed: { expected: '$180.00', compute: pct(m(2000.0), 900) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the same year at 15%, then find what the difference in standing is worth.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the 15% rate cost in a year?', fixed: { expected: '$300.00', compute: pct(m(2000.0), 1500) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the annual cost of the higher rate?', fixed: { expected: '$120.00', compute: diff(pct(m(2000.0), 1500), pct(m(2000.0), 900)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Extend the comparison across three simulated years on the same simple-interest basis.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does three years at 15% cost in interest?', fixed: { expected: '$900.00', compute: scale(pct(m(2000.0), 1500), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than three years at 9%?', fixed: { expected: '$360.00', compute: diff(scale(pct(m(2000.0), 1500), 3), scale(pct(m(2000.0), 900), 3)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The two borrowers received identical amounts.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Marguerite\'s figures, explain what a record of repayment history is actually being used to predict, and name one thing such a record cannot tell a lender.' }] },
    ],
    rubric: [
      crit(
        'Interpreting credit standing',
        'The response treats the rate difference in Marguerite\'s table as arbitrary or as a judgement of character.',
        'The predictive purpose is stated for Marguerite but no limitation is named.',
        'The response explains that the record is used to predict repayment risk, quantifies the cost using Marguerite\'s figures, and names something it cannot capture, such as a sudden job loss or the reason behind a missed payment.',
      ),
    ],
    remediation:
      'If a learner compares percentages without computing, convert both of Marguerite\'s rates into dollar amounts on the same $2,000.00 before any comparison.',
    extension: 'Ask the learner how many years of the 9% rate cost the same as one year at 15%, and to show the reasoning.',
  },
  {
    key: 'g7-u04-l03',
    authority: 'FIXED',
    character: 'Silas',
    objective:
      'Learners compute monthly interest on an invented revolving balance and see how much of a minimum payment reduces principal.',
    scenario:
      'Silas is a made-up seventh grader modelling a pretend revolving balance of $800.00 at an invented 1.5% monthly interest rate, with a $25.00 minimum payment. Nothing here is a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one month of interest on Silas\'s invented $800.00 balance at 1.5%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest is charged in month one?', fixed: { expected: '$12.00', compute: pct(m(800.0), 150) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Split the $25.00 minimum payment into the part that covers interest and the part that reduces the balance, then find the new balance.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $25.00 payment reduces the balance?', fixed: { expected: '$13.00', compute: diff(m(25.0), pct(m(800.0), 150)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after month one?', fixed: { expected: '$787.00', compute: diff(m(800.0), diff(m(25.0), pct(m(800.0), 150))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Run month two on the new balance, remembering the interest is charged on what is now owed.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest is charged in month two?', fixed: { expected: '$11.81', compute: pct(diff(m(800.0), diff(m(25.0), pct(m(800.0), 150))), 150, 'half-up'), note: 'The exact product is $11.805, rounded to the cent as a statement would round it.' } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after month two?', fixed: { expected: '$773.81', compute: diff(diff(m(800.0), diff(m(25.0), pct(m(800.0), 150))), diff(m(25.0), pct(diff(m(800.0), diff(m(25.0), pct(m(800.0), 150))), 150, 'half-up'))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Two payments of $25.00 reduced the balance by about $26.00.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Silas\'s figures, explain why paying only the minimum takes so long, and estimate what would change if the payment were doubled.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about minimum payments',
        'The response treats Silas\'s whole payment as reducing the balance.',
        'The interest portion is identified for Silas but no consequence for the timeline is drawn.',
        'The response shows that most of Silas\'s early payment covers interest, explains why repayment stretches out, and reasons about the effect of a larger payment.',
      ),
    ],
    remediation:
      'If a learner subtracts the payment from the balance directly, require the interest line to be computed and subtracted from the payment first for Silas.',
    extension: 'Ask the learner to compute Silas\'s month three and describe the trend in how much of each payment reaches the balance.',
    safetyNotes: ['This balance and rate are invented for the exercise; never enter a real card or account number anywhere on this sheet.'],
  },
  {
    key: 'g7-u04-l04',
    authority: 'FIXED',
    character: 'Ingrid',
    objective:
      'Learners compare the interest cost of invented secured and unsecured borrowing of the same amount and connect the difference to collateral.',
    scenario:
      'Ingrid is an invented seventh grader comparing two pretend loans of $4,000.00: a secured loan at 6% backed by the item purchased, and an unsecured loan at 19.5% with nothing pledged. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest on Ingrid\'s invented secured loan at 6%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the secured loan cost in a year?', fixed: { expected: '$240.00', compute: pct(m(4000.0), 600) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the unsecured loan at 19.5% for the same year, then find the annual gap between them.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the unsecured loan cost in a year?', fixed: { expected: '$780.00', compute: pct(m(4000.0), 1950) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the annual difference between the two loans?', fixed: { expected: '$540.00', compute: diff(pct(m(4000.0), 1950), pct(m(4000.0), 600)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Extend both loans to three simulated years on a simple-interest basis.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does three years of the unsecured loan cost in interest?', fixed: { expected: '$2,340.00', compute: scale(pct(m(4000.0), 1950), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than three years of the secured loan?', fixed: { expected: '$1,620.00', compute: diff(scale(pct(m(4000.0), 1950), 3), scale(pct(m(4000.0), 600), 3)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cheaper loan carried a condition the dearer one did not.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Ingrid\'s secured loan costs so much less, and describe the risk the borrower accepts in exchange for that lower rate.' }] },
    ],
    rubric: [
      crit(
        'Connecting collateral to rate',
        'The response treats Ingrid\'s rate difference as arbitrary.',
        'Collateral is mentioned for Ingrid but the borrower\'s risk is not stated.',
        'The response explains that collateral reduces the lender\'s risk and therefore the rate, and names the borrower\'s risk of losing the pledged item on default.',
      ),
    ],
    remediation:
      'If a learner cannot see why the rates differ, ask what each lender can do if Ingrid stops paying, and derive the rate difference from those two answers.',
    extension: 'Ask the learner at what unsecured rate the two of Ingrid\'s loans would cost the same over three years, and to show the method.',
  },
  {
    key: 'g7-u04-l05',
    authority: 'FIXED',
    character: 'Zeynep',
    objective:
      'Learners compute the gap between invented education costs and non-repayable aid, and quantify what borrowing the remainder costs.',
    scenario:
      'Zeynep is a made-up seventh grader modelling a pretend year of study costing $9,000.00. Invented aid comprises a $3,500.00 grant and a $1,200.00 scholarship, neither repayable. Any remainder is borrowed at 5% for the simulated year. All figures are invented, and the simple-interest model keeps the arithmetic visible; real repayment schedules amortise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Zeynep\'s invented non-repayable aid.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the grant and scholarship come to?', fixed: { expected: '$4,700.00', compute: sum(m(3500.0), m(1200.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find the gap Zeynep must cover after the aid, then compute the invented 5% interest on borrowing that gap for a year.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must be covered after the aid?', fixed: { expected: '$4,300.00', compute: diff(m(9000.0), sum(m(3500.0), m(1200.0))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one year of interest on that borrowing cost?', fixed: { expected: '$215.00', compute: pct(diff(m(9000.0), sum(m(3500.0), m(1200.0))), 500) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out the total Zeynep would repay after one year, then see what an extra $800.00 scholarship would change.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total after one year?', fixed: { expected: '$4,515.00', compute: sum(diff(m(9000.0), sum(m(3500.0), m(1200.0))), pct(diff(m(9000.0), sum(m(3500.0), m(1200.0))), 500)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'With an extra $800.00 scholarship, how much would need to be borrowed?', fixed: { expected: '$3,500.00', compute: diff(m(9000.0), sum(m(3500.0), m(1200.0), m(800.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'An $800.00 scholarship removed more than $800.00 of eventual cost.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why non-repayable aid is worth more than the same amount of borrowing, using Zeynep\'s figures to show the difference.' }] },
    ],
    rubric: [
      crit(
        'Distinguishing aid types',
        'The response treats all of Zeynep\'s aid as equivalent to a loan.',
        'The distinction is stated for Zeynep but not quantified.',
        'The response explains that Zeynep\'s grant and scholarship never have to be repaid and shows, with the interest figures, that each aid dollar removes more than a dollar of eventual cost.',
      ),
    ],
    remediation:
      'If a learner applies the interest to the full cost, mark only the borrowed remainder as the base for the rate before any interest is computed for Zeynep.',
    extension: 'Ask the learner how much additional non-repayable aid would remove Zeynep\'s borrowing entirely, and what that saves in interest.',
  },
  {
    key: 'g7-u04-l06',
    authority: 'JUDGMENT',
    character: 'Bram',
    objective:
      'Learners identify the features that make an invented lending offer predatory and decide how to respond to pressure to sign.',
    scenario:
      'Bram is an invented seventh grader studying a pretend offer: cash today, no credit check, fees described only in small print, an in-person signature required within 24 hours, and a clause allowing the lender to take repayment directly from a pay account. All terms are invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Go through Bram\'s invented offer feature by feature. Some features are conveniences and some transfer risk to the borrower. Sort them before judging the offer as a whole.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which features of Bram\'s invented offer transfer risk to the borrower, and how does each one do it?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what someone facing Bram\'s offer should do, including what to ask for in writing and what the 24-hour deadline should tell them.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the borrower do, what should they demand in writing, and what does the deadline signal?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The offer is aimed at people who have been refused elsewhere.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why does an offer like this target people with few options, and what does that imply about the terms?' }],
      },
    ],
    rubric: [
      crit(
        'Identifying predatory features',
        'The response treats Bram\'s no-credit-check offer as simply generous.',
        'One risky feature is identified for Bram but the mechanism is not explained.',
        'The response identifies several features of Bram\'s offer, including the hidden fees, the deadline, and the direct account access, and explains how each shifts risk or removes the borrower\'s control.',
      ),
      crit(
        'Responding to pressure',
        'The response has the borrower sign, or offers no concrete action.',
        'Signing is refused but nothing is requested or verified.',
        'The response has the borrower refuse the deadline, demand full written terms including the total cost, and seek an alternative or a trusted adult before signing anything.',
      ),
    ],
    lookFors: [
      'Names the direct account access as a transfer of control.',
      'Treats the 24-hour deadline as a pressure tactic, not a fact.',
      'Requests the total cost of borrowing in writing.',
      'Considers who the offer is aimed at and why.',
    ],
    remediation:
      'If a learner is drawn to the speed of the offer, ask what the lender gains from each feature in Bram\'s list, and rebuild the judgement from those answers.',
    extension: 'Ask the learner to write the three questions someone should ask before signing any offer like Bram\'s.',
    safetyNotes: ['This offer is invented for study; never share real account details or sign anything under time pressure.'],
  },
  {
    key: 'g7-u05-l01',
    authority: 'FIXED',
    character: 'Théo',
    objective:
      'Learners compare invented returns on saving and investing over one and several periods, and connect the difference to the risk accepted.',
    scenario:
      'Théo is a made-up seventh grader comparing two pretend places for $2,000.00: an invented savings account paying 0.5% a year and an invented investment averaging 6% a year, which can also fall. All figures are invented and no real product is described.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year on Théo\'s invented savings account at 0.5%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the savings account pay in one year?', fixed: { expected: '$10.00', compute: pct(m(2000.0), 50) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute one year at the invented 6% average, then compare the two one-year outcomes.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would one year at 6% produce?', fixed: { expected: '$120.00', compute: pct(m(2000.0), 600) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the invested return in one year?', fixed: { expected: '$110.00', compute: diff(pct(m(2000.0), 600), pct(m(2000.0), 50)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Now run three simulated years of the invested amount compounding at 6%, and model a year in which the investment instead falls 10%.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would $2,000.00 grow to over three years at 6% compounded?', fixed: { expected: '$2,382.03', compute: grow(m(2000.0), 600, 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the $2,000.00 be worth after a single year that falls 10%?', fixed: { expected: '$1,800.00', compute: diff(m(2000.0), pct(m(2000.0), 1000)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The higher average came with a year that lost money.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Théo\'s figures, explain what the extra return is compensating for, and describe a goal for which the savings account is the better choice.' }] },
    ],
    rubric: [
      crit(
        'Relating return to risk and horizon',
        'The response treats the higher average as strictly better for Théo.',
        'Risk is mentioned for Théo but not connected to any goal or horizon.',
        'The response explains that Théo\'s extra return compensates for the possibility of loss, and names a goal, such as money needed soon, for which the savings account is the right choice.',
      ),
    ],
    remediation:
      'If a learner applies the growth rate to the original amount each year, write the compounding rule for Théo and recompute each year from the previous balance.',
    extension: 'Ask the learner how many years at 0.5% would be needed to match one year at 6% for Théo, and to show the reasoning.',
    safetyNotes: ['These rates are invented for the exercise and are not a recommendation about any real product.'],
  },
  {
    key: 'g7-u05-l02',
    authority: 'FIXED',
    character: 'Anika',
    objective:
      'Learners compute invented compound growth at two rates over the same horizon and quantify how much the rate difference is worth.',
    scenario:
      'Anika is an invented seventh grader modelling $1,000.00 over three simulated years at two invented rates: 5% a year and 2% a year, each compounding annually. All figures are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Grow Anika\'s invented $1,000.00 at 5% a year for three years, compounding each year on the new balance.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after three years at 5%?', fixed: { expected: '$1,157.63', compute: grow(m(1000.0), 500, 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Run the same three years at Anika\'s lower invented rate of 2%, then compare the two ending balances.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after three years at 2%?', fixed: { expected: '$1,061.21', compute: grow(m(1000.0), 200, 3) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the 5% rate produce over three years?', fixed: { expected: '$96.42', compute: diff(grow(m(1000.0), 500, 3), grow(m(1000.0), 200, 3)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the compounded result at 5% with what simple interest at the same rate would have produced over three years.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would three years of simple interest at 5% produce as a balance?', fixed: { expected: '$1,150.00', compute: sum(m(1000.0), scale(pct(m(1000.0), 500), 3)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does compounding add over simple interest in three years?', fixed: { expected: '$7.63', compute: diff(grow(m(1000.0), 500, 3), sum(m(1000.0), scale(pct(m(1000.0), 500), 3))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Three years made compounding worth less than eight dollars.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Compounding added little over three years in Anika\'s model. Explain what changes over a much longer horizon and why time matters more than the first few years suggest.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about compounding and time',
        'The response dismisses compounding based on Anika\'s three-year result.',
        'Longer horizons are mentioned for Anika but no mechanism is given.',
        'The response explains that each year in Anika\'s model earns on a larger base, so the gap over simple interest widens as the horizon lengthens, and treats three years as too short to show it.',
      ),
    ],
    remediation:
      'If a learner multiplies the first year\'s interest by three, write out each of Anika\'s three years in sequence with its own opening balance.',
    extension: 'Ask the learner to project Anika\'s 5% balance for a fourth and fifth year and describe how the yearly increase changes.',
  },
  {
    key: 'g7-u05-l03',
    authority: 'FIXED',
    character: 'Marek',
    objective:
      'Learners compare the effect of an invented loss on a diversified holding against a concentrated one of the same total value.',
    scenario:
      'Marek is a made-up seventh grader modelling $3,600.00 of pretend holdings in two ways: split evenly across three invented holdings of $1,200.00 each, or placed entirely in one of them. One holding falls 40%. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 40% fall on one of Marek\'s $1,200.00 holdings.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much value does the falling holding lose in the split portfolio?', fixed: { expected: '$480.00', compute: pct(m(1200.0), 4000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find what Marek\'s split portfolio is worth after the fall, with the other two holdings unchanged.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the split portfolio worth after the fall?', fixed: { expected: '$3,120.00', compute: diff(m(3600.0), pct(m(1200.0), 4000)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would the whole $3,600.00 lose if it were all in that one holding?', fixed: { expected: '$1,440.00', compute: pct(m(3600.0), 4000) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the two outcomes for Marek directly, holding the same 40% fall and the same $3,600.00 starting value in both versions of the portfolio.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the concentrated portfolio worth after the fall?', fixed: { expected: '$2,160.00', compute: diff(m(3600.0), pct(m(3600.0), 4000)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is the split portfolio?', fixed: { expected: '$960.00', compute: diff(diff(m(3600.0), pct(m(1200.0), 4000)), diff(m(3600.0), pct(m(3600.0), 4000))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Splitting did not prevent the loss.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what diversification did and did not do in Marek\'s model, and describe a case where splitting would have been the worse choice.' }] },
    ],
    rubric: [
      crit(
        'Understanding what diversification does',
        'The response claims splitting protects Marek from loss entirely.',
        'The reduced loss is noted for Marek but the limits are not stated.',
        'The response explains that splitting limited Marek\'s exposure to any single holding without removing loss, and names a case, such as the concentrated holding rising sharply, where splitting would have cost him.',
      ),
    ],
    remediation:
      'If a learner applies the fall to the whole portfolio in the split case, mark which holding falls and apply the percentage only to that line for Marek.',
    extension: 'Ask the learner what fall in one of six equal holdings would produce the same loss as Marek\'s 40% fall in one of three.',
    safetyNotes: ['These holdings and movements are invented for the exercise and are not a recommendation about any real investment.'],
  },
  {
    key: 'g7-u05-l04',
    authority: 'FIXED',
    character: 'Sana',
    objective:
      'Learners compute invented compound growth over five periods and quantify the gap against simple interest at the same rate.',
    scenario:
      'Sana is an invented seventh grader modelling $500.00 over five simulated years at an invented 8% a year, compounding annually, and comparing it with 8% simple interest. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Grow Sana\'s invented $500.00 at 8% a year for five years, compounding on the new balance each year.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after five years of compounding?', fixed: { expected: '$734.67', compute: grow(m(500.0), 800, 5) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute five years of simple interest at the same rate on Sana\'s original $500.00, then compare the two balances.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What balance would five years of simple interest give?', fixed: { expected: '$700.00', compute: sum(m(500.0), scale(pct(m(500.0), 800), 5)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does compounding produce over five years?', fixed: { expected: '$34.67', compute: diff(grow(m(500.0), 800, 5), sum(m(500.0), scale(pct(m(500.0), 800), 5))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare a single year against the fifth year of Sana\'s compounding to see how the yearly gain changes.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does year one alone add?', fixed: { expected: '$40.00', compute: diff(grow(m(500.0), 800, 1), m(500.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the fifth year alone add?', fixed: { expected: '$54.42', compute: diff(grow(m(500.0), 800, 5), grow(m(500.0), 800, 4)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The fifth year added more than the first without any change in rate.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Sana\'s yearly gain grows even though the rate never changes, and what that implies about starting early.' }] },
    ],
    rubric: [
      crit(
        'Explaining accelerating growth',
        'The response attributes Sana\'s larger fifth-year gain to a changing rate.',
        'The growing base is mentioned for Sana but not linked to starting early.',
        'The response explains that each of Sana\'s years applies the same rate to a larger balance, and draws the implication that an earlier start compounds for more periods.',
      ),
    ],
    remediation:
      'If a learner computes five identical yearly gains, write out each of Sana\'s years with its own opening balance before any total is taken.',
    extension: 'Ask the learner to estimate Sana\'s balance after ten years and to explain the reasoning behind the estimate.',
  },
  {
    key: 'g7-u05-l05',
    authority: 'FIXED',
    character: 'Nils',
    objective:
      'Learners compute the full cost of an invented insurance arrangement including premiums and deductible, and compare it against bearing a loss unprotected.',
    scenario:
      'Nils is a made-up seventh grader modelling a pretend policy: $45.00 a month in invented premiums, a $500.00 deductible, and a covered invented $3,200.00 repair. All figures are invented and describe no real policy.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a simulated year of Nils\'s invented premiums at $45.00 a month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 months of premiums cost?', fixed: { expected: '$540.00', compute: scale(m(45.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the deductible Nils pays on the claim to the year of premiums to reach his total cost in the year of the repair.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total cost in the claim year with the policy?', fixed: { expected: '$1,040.00', compute: sum(scale(m(45.0), 12), m(500.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is Nils with the policy in that year?', fixed: { expected: '$2,160.00', compute: diff(m(3200.0), sum(scale(m(45.0), 12), m(500.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model three quiet simulated years with no claim at all, then compare against the single claim year.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do three quiet years of premiums cost?', fixed: { expected: '$1,620.00', compute: scale(scale(m(45.0), 12), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'Across those three quiet years plus the claim year, how much better off is Nils than paying the repair unprotected?', fixed: { expected: '$540.00', compute: diff(m(3200.0), sum(scale(scale(m(45.0), 12), 3), scale(m(45.0), 12), m(500.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Four years of premiums nearly matched the repair.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what Nils is actually buying with the premiums, and describe the situation in which the policy is worth having even if the arithmetic comes out roughly even.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about insurance and capacity to absorb loss',
        'The response judges Nils\'s policy solely on whether the totals favour it.',
        'The protection is described for Nils but not connected to his capacity to pay a large loss.',
        'The response explains that Nils is buying protection against a loss he may not be able to absorb at once, and argues that this can justify the policy even at roughly break-even.',
      ),
    ],
    remediation:
      'If a learner omits the deductible, list Nils\'s premiums and deductible as separate labelled lines before any total is computed.',
    extension: 'Ask the learner how many quiet years Nils could pay for before the policy costs more than the repair, and to show the reasoning.',
    safetyNotes: ['This policy is invented for the exercise and is not a recommendation about any real insurance product.'],
  },
  {
    key: 'g7-u05-l06',
    authority: 'JUDGMENT',
    character: 'Yusra',
    objective:
      'Learners evaluate an invented identity-theft situation, decide the order of response, and identify what evidence and notifications matter.',
    scenario:
      'Yusra is an invented seventh grader studying a pretend case: an unfamiliar charge appears on a household statement, a text claims to be the bank asking for a verification code, and a new account notification arrives by email. All of this is invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Sort the three invented signals in Yusra\'s case: which are evidence of a problem, and which is itself an attempt to exploit the situation. Explain how you can tell.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which of the three signals in Yusra\'s case is itself an attack, and what marks it out?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write the order of actions the household should take, and say for each why it comes where it does. Include what should never be sent to anyone.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the household do, in what order, and what should never be shared with an incoming caller or text?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The text arrived at exactly the right moment to seem helpful.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is a message that arrives just when you are worried especially dangerous?' }],
      },
    ],
    rubric: [
      crit(
        'Distinguishing evidence from attack',
        'The response treats Yusra\'s verification-code text as a legitimate bank contact.',
        'The text is doubted for Yusra but no distinguishing feature is named.',
        'The response identifies the code request in Yusra\'s case as the attack, and explains that a genuine institution does not ask an incoming contact to supply a verification code.',
      ),
      crit(
        'Sequencing the response',
        'Actions are listed for Yusra with no ordering or reasoning.',
        'An order is given for Yusra but a key step, such as contacting the institution independently, is missing.',
        'The response orders Yusra\'s actions sensibly, beginning with contacting the institution through an independently obtained number, and states that codes and passwords are never shared.',
      ),
    ],
    lookFors: [
      'Names the verification-code request as the attack.',
      'Contacts the institution through an independently obtained channel.',
      'States that codes and passwords are never shared with incoming contacts.',
      'Involves a trusted adult and keeps a record of the unfamiliar charge.',
    ],
    remediation:
      'If a learner would reply to the text, ask what an attacker would gain from the code in Yusra\'s case, and rebuild the sequence from that answer.',
    extension: 'Ask the learner to write the three checks a household could set up in advance to notice this kind of problem sooner.',
    safetyNotes: ['Never share a verification code, password, or account number with anyone who contacts you; this case is invented for study.'],
  },
  {
    key: 'g7-u06-l01',
    authority: 'FIXED',
    character: 'Pekka',
    objective:
      'Learners analyse an invented public budget by category, identify the largest allocation, and compute the effect of a stated levy.',
    scenario:
      'Pekka is a made-up seventh grader studying a pretend community budget of $8,000.00 in simulated funds: $3,200.00 for schools, $2,000.00 for roads, $1,600.00 for safety, and $1,200.00 for parks. An invented 5% levy is proposed on top. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Check that Pekka\'s four invented allocations account for the whole budget.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the four allocations add up to?', fixed: { expected: '$8,000.00', compute: sum(m(3200.0), m(2000.0), m(1600.0), m(1200.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Identify the largest allocation in Pekka\'s budget and compare it with the smallest.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the largest single allocation?', fixed: { expected: '$3,200.00', compute: most(m(3200.0), m(2000.0), m(1600.0), m(1200.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is it than the parks allocation?', fixed: { expected: '$2,000.00', compute: diff(most(m(3200.0), m(2000.0), m(1600.0), m(1200.0)), m(1200.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the invented 5% levy on the whole budget and work out what the budget would be with it.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would the 5% levy raise?', fixed: { expected: '$400.00', compute: pct(m(8000.0), 500) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the total budget be with the levy?', fixed: { expected: '$8,400.00', compute: sum(m(8000.0), pct(m(8000.0), 500)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Every allocation came from somewhere.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Pekka\'s budget, explain why taxes exist and what would have to happen to any category if the levy were rejected.' }] },
    ],
    rubric: [
      crit(
        'Explaining the purpose of taxation',
        'The response treats Pekka\'s taxes as money simply taken away.',
        'A purpose is named for Pekka but no tradeoff among the categories is identified.',
        'The response connects Pekka\'s allocations to services the community shares, and states that rejecting the levy forces a reduction in a specific named category.',
      ),
    ],
    remediation:
      'If a learner treats the levy as coming out of an allocation, mark it as an addition to the total before any category is adjusted for Pekka.',
    extension: 'Ask the learner to reallocate Pekka\'s budget without the levy so that schools rise by $400.00, and to name what falls.',
  },
  {
    key: 'g7-u06-l02',
    authority: 'FIXED',
    character: 'Constance',
    objective:
      'Learners trace invented money through payroll deductions and a purchase with sales tax, distinguishing where each kind of tax applies.',
    scenario:
      'Constance is an invented seventh grader tracing a pretend $1,800.00 gross monthly pay through 7.75% payroll tax and 12% income tax withholding, then through a $250.00 purchase carrying 6.5% simulated sales tax. All rates are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 7.75% payroll deduction to Constance\'s $1,800.00 gross.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated payroll tax?', fixed: { expected: '$139.50', compute: pct(m(1800.0), 775) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply the 12% income tax withholding to the same gross figure, then compute Constance\'s net pay.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated income tax?', fixed: { expected: '$216.00', compute: pct(m(1800.0), 1200) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net pay?', fixed: { expected: '$1,444.50', compute: diff(m(1800.0), sum(pct(m(1800.0), 775), pct(m(1800.0), 1200))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Constance spends $250.00 of the net pay on a purchase carrying 6.5% simulated sales tax.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total due on the $250.00 purchase?', fixed: { expected: '$266.25', compute: sum(m(250.0), pct(m(250.0), 650)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is left of the net pay after that purchase?', fixed: { expected: '$1,178.25', compute: diff(diff(m(1800.0), sum(pct(m(1800.0), 775), pct(m(1800.0), 1200))), sum(m(250.0), pct(m(250.0), 650))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The same money was taxed on the way in and again on the way out.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain the difference between what Constance\'s payroll taxes and sales tax are charged on, and why the two are calculated at different points.' }] },
    ],
    rubric: [
      crit(
        'Distinguishing kinds of tax',
        'The response treats all of Constance\'s taxes as a single deduction.',
        'The two are distinguished for Constance but the base of each is not named.',
        'The response states that Constance\'s payroll and income taxes are charged on earnings while sales tax is charged on a purchase, and locates each at its point in the flow.',
      ),
    ],
    remediation:
      'If a learner applies sales tax to the gross pay, draw the flow as three boxes for Constance and mark which figure each rate applies to.',
    extension: 'Ask the learner what purchase amount Constance could make with exactly $500.00 of net pay including 6.5% sales tax, and to show the method.',
  },
  {
    key: 'g7-u06-l03',
    authority: 'FIXED',
    character: 'Osman',
    objective:
      'Learners compute per-household shares of an invented public good and see what happens to the share when some households do not contribute.',
    scenario:
      'Osman is a made-up seventh grader modelling a pretend shared cost: an invented $6,000.00 community library upgrade shared among 60 households. Later, only 40 households contribute. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Share Osman\'s invented $6,000.00 cost equally across all 60 households.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is each household\'s share across 60 households?', fixed: { expected: '$100.00', compute: div(m(6000.0), 60) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now share the same total across only the 40 contributing households, and compare the two shares.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is each contributing household\'s share across 40 households?', fixed: { expected: '$150.00', compute: div(m(6000.0), 40) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does each contributor pay?', fixed: { expected: '$50.00', compute: diff(div(m(6000.0), 40), div(m(6000.0), 60)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out what the 20 non-contributing households would have paid, and what the contributors cover on their behalf.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the 20 non-contributing households have paid at the $100.00 share?', fixed: { expected: '$2,000.00', compute: scale(div(m(6000.0), 60), 20) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the 40 contributors pay in total?', fixed: { expected: '$6,000.00', compute: scale(div(m(6000.0), 40), 40) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Everyone can use the library either way.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Osman\'s library is available to all 60 households regardless of who paid. Explain the problem this creates and why taxes are one answer to it.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about shared goods and contribution',
        'The response treats non-contribution in Osman\'s model as costless to everyone.',
        'The higher share is computed for Osman but the incentive problem is not named.',
        'The response explains that Osman\'s library benefits all households while costs fall on some, and connects that to why compulsory contribution through taxes is used for shared goods.',
      ),
    ],
    remediation:
      'If a learner divides by the wrong count, label which households are contributing before each division is set up for Osman.',
    extension: 'Ask the learner what the share becomes if only 30 households contribute, and what that suggests about the stability of voluntary funding.',
  },
  {
    key: 'g7-u06-l04',
    authority: 'FIXED',
    character: 'Rosalind',
    objective:
      'Learners compute a percentage giving commitment, apply an invented employer match, and project the annual effect.',
    scenario:
      'Rosalind is an invented seventh grader modelling a pretend giving plan: 3% of $2,000.00 monthly income, with an invented employer matching every dollar given. All figures are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 3% monthly gift from Rosalind\'s $2,000.00 income.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is given each month before any match?', fixed: { expected: '$60.00', compute: pct(m(2000.0), 300) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply the invented dollar-for-dollar employer match, then project the gift across a simulated year.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What reaches the cause each month with the match?', fixed: { expected: '$120.00', compute: scale(pct(m(2000.0), 300), 2) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Rosalind personally give across 12 months?', fixed: { expected: '$720.00', compute: scale(pct(m(2000.0), 300), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Project the matched total for the year, then see what raising the commitment to 5% would do.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What reaches the cause across the year with the match?', fixed: { expected: '$1,440.00', compute: scale(scale(pct(m(2000.0), 300), 2), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'At a 5% commitment, what would reach the cause each month with the match?', fixed: { expected: '$200.00', compute: scale(pct(m(2000.0), 500), 2) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Every dollar given arrived as two.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Rosalind\'s match doubles the effect of each dollar. Explain how that should influence a giving decision, and what it should not change.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about matched giving',
        'The response treats Rosalind\'s match as a reason to give beyond what she can afford.',
        'The match is described for Rosalind but no limit on its influence is stated.',
        'The response uses Rosalind\'s figures to show the match raises impact per dollar, while noting it should not change what she can genuinely afford or which causes she values.',
      ),
    ],
    remediation:
      'If a learner applies the match to the annual figure twice, compute Rosalind\'s monthly matched amount first and scale only that figure to the year.',
    extension: 'Ask the learner what commitment percentage would send exactly $2,400.00 to the cause across a year with the match, and to show the method.',
  },
  {
    key: 'g7-u06-l05',
    authority: 'FIXED',
    character: 'Aroha',
    objective:
      'Learners convert several invented goals into required monthly amounts, total them, and test the combined plan against the money available.',
    scenario:
      'Aroha is a made-up seventh grader planning three pretend goals: $1,200.00 in 6 months, $3,000.00 in 24 months, and $600.00 in 3 months. She has $450.00 a month available. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Aroha\'s first invented goal, $1,200.00 in 6 months, into a monthly amount.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the first goal need?', fixed: { expected: '$200.00', compute: div(m(1200.0), 6) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert Aroha\'s other two goals the same way, keeping each as its own monthly figure.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the $3,000.00 goal need over 24 months?', fixed: { expected: '$125.00', compute: div(m(3000.0), 24) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the $600.00 goal need over 3 months?', fixed: { expected: '$200.00', compute: div(m(600.0), 3) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total the three monthly requirements and compare them with Aroha\'s $450.00 a month.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the three goals require each month in total?', fixed: { expected: '$525.00', compute: sum(div(m(1200.0), 6), div(m(3000.0), 24), div(m(600.0), 3)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much short of the requirement is Aroha each month?', fixed: { expected: '$75.00', compute: diff(sum(div(m(1200.0), 6), div(m(3000.0), 24), div(m(600.0), 3)), m(450.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan is short by $75.00 a month.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Aroha must change something. Compare extending a timeline, reducing a goal, and dropping one entirely, and recommend one with reasons.' }] },
    ],
    rubric: [
      crit(
        'Resolving competing goals',
        'The response makes no choice for Aroha, or proposes finding more money without basis.',
        'One adjustment is chosen for Aroha but the alternatives are not weighed.',
        'The response weighs at least two of Aroha\'s options against each other using the monthly figures, and recommends one with reasons tied to urgency or purpose.',
      ),
    ],
    remediation:
      'If a learner divides in the wrong direction, restate each goal as sharing the total across its months and check the units of every answer for Aroha.',
    extension: 'Ask the learner to extend exactly one of Aroha\'s timelines so the plan fits $450.00 a month, and to show the new figures.',
  },
  {
    key: 'g7-u06-l06',
    authority: 'JUDGMENT',
    character: 'Farid',
    objective:
      'Learners reason about the ethics of a financial decision where the profitable choice and the honest choice diverge.',
    scenario:
      'Farid is an invented seventh grader studying a pretend case: a seller discovers a pricing error in their own favour after 30 invented orders have shipped, buyers have not noticed, refunding would cost the venture its whole margin, and the invented platform requires no disclosure.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Set out the facts of Farid\'s invented case: what buyers were charged, what they were told, and who bears the loss under each possible response. Keep facts separate from justification.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What did buyers in Farid\'s case actually agree to, and who bears the loss under each possible response?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Decide what the seller should do and defend it against the strongest objection on the other side, which is that the platform requires nothing and the venture may not survive the refunds.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the seller do, and how does your answer meet the objection that no rule requires disclosure?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The rules and the right answer came apart here.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What does this case show about the difference between what is permitted and what is right?' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about a decision with competing interests',
        'The response settles Farid\'s case by citing the platform rule alone.',
        'A position is taken for Farid but the strongest objection is not addressed.',
        'The response takes a defended position on Farid\'s case, engages directly with the survival objection, and identifies who bears the loss under each course.',
      ),
      crit(
        'Distinguishing permitted from right',
        'The response treats permission as settling the ethical question.',
        'The distinction is asserted for Farid but not explained.',
        'The response explains why the absence of a rule in Farid\'s case does not resolve what buyers were owed, and grounds the distinction in what buyers reasonably expected.',
      ),
    ],
    lookFors: [
      'States what buyers were charged against what they agreed to.',
      'Engages with the objection that the venture may not survive.',
      'Identifies who bears the loss under each option.',
      'Separates platform rules from what buyers were owed.',
    ],
    remediation:
      'If a learner stops at the platform rule, ask what the buyers in Farid\'s case would say if told afterwards, and rebuild the reasoning from that answer.',
    extension: 'Ask the learner to write the disclosure message the seller would send, in under four sentences.',
  },
]
