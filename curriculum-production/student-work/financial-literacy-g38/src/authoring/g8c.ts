import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, grow, m, pct, scale, sel, sum } from './dsl.ts'

/** Grade 8 Financial Literacy, units 4-5 (PF4 using credit, PF5 financial investing). */
export const G8C: readonly AuthoredLesson[] = [
  {
    key: 'g8-u04-l01',
    authority: 'FIXED',
    character: 'Emrys',
    objective:
      'Learners separate principal, rate, and term in an invented loan and quantify how the term alone changes total repayment.',
    scenario:
      'Emrys is a made-up eighth grader modelling a pretend $8,000.00 loan at 7.5% simple interest a year, comparing a three-year term with a five-year term. All figures are invented, and this model applies simple interest to the original amount; real loans of this size usually amortise, so a real total would differ.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest on Emrys\'s invented $8,000.00 principal at 7.5%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest accrues in one year?', fixed: { expected: '$600.00', compute: pct(m(8000.0), 750) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Extend Emrys\'s loan to three years on a simple-interest basis and compute the total repaid.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the interest over three years?', fixed: { expected: '$1,800.00', compute: scale(pct(m(8000.0), 750), 3) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total over three years?', fixed: { expected: '$9,800.00', compute: sum(m(8000.0), scale(pct(m(8000.0), 750), 3)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Now model Emrys\'s five-year term at the same rate and principal.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total over five years?', fixed: { expected: '$11,000.00', compute: sum(m(8000.0), scale(pct(m(8000.0), 750), 5)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the five-year term cost than the three-year term?', fixed: { expected: '$1,200.00', compute: diff(sum(m(8000.0), scale(pct(m(8000.0), 750), 5)), sum(m(8000.0), scale(pct(m(8000.0), 750), 3))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The longer term has smaller payments and a larger total.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why a borrower might still choose Emrys\'s five-year term despite the extra $1,200.00, and what would make that choice unwise.' }] },
    ],
    rubric: [
      crit(
        'Weighing term against total cost',
        'The response treats the shorter term as automatically correct for Emrys.',
        'The payment-size tradeoff is mentioned for Emrys but not tied to affordability.',
        'The response explains that Emrys\'s longer term lowers each payment and raises the total, names when lower payments are necessary, and names when the extra cost is not justified.',
      ),
    ],
    remediation:
      'If a learner compounds the interest, write the simple-interest rule for Emrys and mark the principal as the base for every year.',
    extension: 'Ask the learner what rate would make Emrys\'s five-year loan cost the same as the three-year loan at 7.5%.',
  },
  {
    key: 'g8-u04-l02',
    authority: 'FIXED',
    character: 'Fionnuala',
    objective:
      'Learners quantify the cost of an invented credit-standing difference over one year and over a full loan term.',
    scenario:
      'Fionnuala is an invented eighth grader studying a pretend lending table. On a $15,000.00 invented auto loan, one borrower is offered 5.5% and another 12.9% for the simulated year, based only on recorded repayment history.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest at Fionnuala\'s lower invented rate of 5.5%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the 5.5% rate cost in a year?', fixed: { expected: '$825.00', compute: pct(m(15000.0), 550) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the same year at 12.9%, then find the annual cost of the higher rate for Fionnuala.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the 12.9% rate cost in a year?', fixed: { expected: '$1,935.00', compute: pct(m(15000.0), 1290) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the annual cost of the higher rate?', fixed: { expected: '$1,110.00', compute: diff(pct(m(15000.0), 1290), pct(m(15000.0), 550)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Extend both of Fionnuala\'s rates across a five-year term on a simple-interest basis.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does five years at 12.9% cost in interest?', fixed: { expected: '$9,675.00', compute: scale(pct(m(15000.0), 1290), 5) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than five years at 5.5%?', fixed: { expected: '$5,550.00', compute: diff(scale(pct(m(15000.0), 1290), 5), scale(pct(m(15000.0), 550), 5)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The two borrowers received identical vehicles.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Fionnuala\'s figures, explain what a repayment record is being used to predict and name two actions that would improve a borrower\'s standing.' }] },
    ],
    rubric: [
      crit(
        'Interpreting credit standing',
        'The response treats Fionnuala\'s rate difference as unfair by definition or as a judgement of worth.',
        'The predictive purpose is stated for Fionnuala but no improving action is named.',
        'The response explains the record predicts repayment risk, quantifies the cost with Fionnuala\'s figures, and names concrete actions such as on-time payments or lower balances.',
      ),
    ],
    remediation:
      'If a learner compares percentages without computing, convert both of Fionnuala\'s rates to dollar figures on the same principal before comparing.',
    extension: 'Ask the learner what the higher-rate borrower would need to put down to pay the same total interest over five years.',
  },
  {
    key: 'g8-u04-l03',
    authority: 'FIXED',
    character: 'Gideon',
    objective:
      'Learners track an invented revolving balance across two months of minimum payments, separating interest from principal reduction.',
    scenario:
      'Gideon is a made-up eighth grader modelling a pretend $2,400.00 revolving balance at an invented 1.75% monthly rate with a $60.00 minimum payment. Nothing here is a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute month one interest on Gideon\'s invented $2,400.00 balance at 1.75%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest is charged in month one?', fixed: { expected: '$42.00', compute: pct(m(2400.0), 175) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Split Gideon\'s $60.00 payment into interest and principal, then compute the new balance.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the payment reduces the balance?', fixed: { expected: '$18.00', compute: diff(m(60.0), pct(m(2400.0), 175)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after month one?', fixed: { expected: '$2,382.00', compute: diff(m(2400.0), diff(m(60.0), pct(m(2400.0), 175))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Run month two on Gideon\'s new balance, rounding the interest to the cent as a statement would.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest is charged in month two?', fixed: { expected: '$41.69', compute: pct(diff(m(2400.0), diff(m(60.0), pct(m(2400.0), 175))), 175, 'half-up'), note: 'The exact product is $41.685, rounded to the cent.' } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after month two?', fixed: { expected: '$2,363.69', compute: diff(diff(m(2400.0), diff(m(60.0), pct(m(2400.0), 175))), diff(m(60.0), pct(diff(m(2400.0), diff(m(60.0), pct(m(2400.0), 175))), 175, 'half-up'))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Two payments totalling $120.00 cut the balance by about $36.00.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Gideon\'s figures, explain where the rest of the money went and estimate what doubling the payment would do to the repayment time.' }] },
    ],
    rubric: [
      crit(
        'Analysing minimum payments',
        'The response treats Gideon\'s whole payment as reducing the balance.',
        'The interest share is identified for Gideon but no consequence for repayment time is drawn.',
        'The response shows that most of Gideon\'s payment covers interest, explains why repayment stretches out, and reasons about the effect of a larger payment.',
      ),
    ],
    remediation:
      'If a learner subtracts the payment from the balance directly, require the interest line to be computed and removed from the payment first for Gideon.',
    extension: 'Ask the learner to compute Gideon\'s month three and describe how the interest share of each payment is changing.',
    safetyNotes: ['This balance and rate are invented; never write a real card or account number on this sheet.'],
  },
  {
    key: 'g8-u04-l04',
    authority: 'FIXED',
    character: 'Hesper',
    objective:
      'Learners compare invented loan types at the same rate across very different principals and convert annual interest into a monthly burden.',
    scenario:
      'Hesper is an invented eighth grader modelling two pretend loans at 6% a year: an invented $180,000.00 mortgage concept and an invented $24,000.00 auto loan. All figures are invented for the exercise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest on Hesper\'s invented $180,000.00 mortgage concept at 6%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest accrues in the first year?', fixed: { expected: '$10,800.00', compute: pct(m(180000.0), 600) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert that annual interest into a monthly figure, then compute the auto loan\'s annual interest at the same rate.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly interest on the mortgage concept?', fixed: { expected: '$900.00', compute: div(pct(m(180000.0), 600), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the auto loan accrue in a year?', fixed: { expected: '$1,440.00', compute: pct(m(24000.0), 600) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Convert the auto loan interest to a monthly figure and compare the two monthly burdens for Hesper.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly interest on the auto loan?', fixed: { expected: '$120.00', compute: div(pct(m(24000.0), 600), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the mortgage concept\'s monthly interest?', fixed: { expected: '$780.00', compute: diff(div(pct(m(180000.0), 600), 12), div(pct(m(24000.0), 600), 12)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both loans carried the same rate.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why the same 6% produces such different burdens in Hesper\'s two loans, and what else besides rate a borrower should compare.' }] },
    ],
    rubric: [
      crit(
        'Comparing loans beyond the rate',
        'The response treats Hesper\'s equal rates as meaning equal cost.',
        'The principal difference is noted for Hesper but no further comparison factor is named.',
        'The response explains that interest scales with principal, so Hesper\'s rate alone says nothing about burden, and names further factors such as term, fees, or what the loan secures.',
      ),
    ],
    remediation:
      'If a learner compares rates directly, convert both of Hesper\'s loans into annual dollar interest before any comparison is drawn.',
    extension: 'Ask the learner what auto-loan rate would produce the same monthly interest as Hesper\'s mortgage concept, and what that shows.',
  },
  {
    key: 'g8-u04-l05',
    authority: 'FIXED',
    character: 'Ivo',
    objective:
      'Learners layer invented aid types against an education cost and compute what borrowing the remainder adds.',
    scenario:
      'Ivo is a made-up eighth grader modelling a pretend year of study costing $28,000.00, with invented aid of a $9,500.00 grant, a $4,000.00 scholarship, and $3,000.00 of term-time earnings. Any remainder is borrowed at 6% for the simulated year.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Ivo\'s invented grant and scholarship, which never have to be repaid.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the non-repayable aid come to?', fixed: { expected: '$13,500.00', compute: sum(m(9500.0), m(4000.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add Ivo\'s term-time earnings to the aid, then find the remaining gap against the $28,000.00 cost.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do aid and earnings cover together?', fixed: { expected: '$16,500.00', compute: sum(m(9500.0), m(4000.0), m(3000.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must be borrowed?', fixed: { expected: '$11,500.00', compute: diff(m(28000.0), sum(m(9500.0), m(4000.0), m(3000.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the invented 6% interest on Ivo\'s borrowing for one year and the total that would be repaid.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one year of interest cost?', fixed: { expected: '$690.00', compute: pct(diff(m(28000.0), sum(m(9500.0), m(4000.0), m(3000.0))), 600) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would be repaid in total after one year?', fixed: { expected: '$12,190.00', compute: sum(diff(m(28000.0), sum(m(9500.0), m(4000.0), m(3000.0))), pct(diff(m(28000.0), sum(m(9500.0), m(4000.0), m(3000.0))), 600)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Three kinds of money covered the same cost very differently.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Rank Ivo\'s three funding sources by their true cost to him, and explain what makes term-time earnings different from both aid and borrowing.' }] },
    ],
    rubric: [
      crit(
        'Ranking funding sources by true cost',
        'The response treats all of Ivo\'s funding as equivalent.',
        'Aid and borrowing are separated for Ivo but earnings are not distinguished.',
        'The response ranks Ivo\'s sources with aid cheapest, earnings costing time and study capacity, and borrowing costing interest, and supports the ranking with figures.',
      ),
    ],
    remediation:
      'If a learner applies interest to the full cost, mark only Ivo\'s borrowed remainder as the base for the rate.',
    extension: 'Ask the learner how much additional scholarship would remove Ivo\'s borrowing entirely, and what interest that saves.',
  },
  {
    key: 'g8-u04-l06',
    authority: 'JUDGMENT',
    character: 'Jocasta',
    objective:
      'Learners identify predatory features in an invented lending arrangement and reason about debt collection and insolvency as consequences rather than moral failures.',
    scenario:
      'Jocasta is an invented eighth grader studying a pretend case: a borrower rolls over a short-term loan four times, fees now exceed the original amount, collection calls have begun, and a made-up advertisement offers to erase the debt for an upfront fee. All of it is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Separate the strands of Jocasta\'s invented case: the loan structure, the collection activity, and the debt-relief advertisement. Say what each one is and who benefits.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What makes the rollover structure in Jocasta\'s case dangerous, and why is the debt-relief advertisement a separate problem?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Set out what the borrower should do now, in order, including how to handle collection contact and where legitimate help would come from.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the borrower do, in what order, and what makes a source of help legitimate rather than another trap?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The borrower is being told the situation is their own fault.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'How should someone in Jocasta\'s case think about blame, and why does that framing matter for what they do next?' }],
      },
    ],
    rubric: [
      crit(
        'Identifying a debt trap',
        'The response treats the rollovers in Jocasta\'s case as ordinary borrowing.',
        'The rollover cost is noted for Jocasta but the advertisement is not distinguished.',
        'The response explains that each rollover in Jocasta\'s case adds fees without reducing principal, and identifies the upfront-fee advertisement as a second exploitation of the same distress.',
      ),
      crit(
        'Finding legitimate help',
        'The response sends the borrower to the advertised service or offers no route.',
        'Help is suggested for Jocasta\'s borrower but no test of legitimacy is given.',
        'The response routes Jocasta\'s borrower to help that does not demand payment upfront, and gives a test such as checking registration or seeking a non-profit adviser.',
      ),
    ],
    lookFors: [
      'Explains that rollover fees do not reduce principal.',
      'Flags the upfront-fee offer as a further predatory step.',
      'Describes handling collection contact without ignoring it.',
      'Frames the situation in terms of structure rather than personal failure.',
    ],
    remediation:
      'If a learner blames the borrower, work out what each rollover in Jocasta\'s case added and what it repaid, then revisit the question.',
    extension: 'Ask the learner what single change to the loan terms would have prevented Jocasta\'s case from escalating.',
    safetyNotes: ['Never pay an upfront fee to a service promising to erase debt; this case is invented for study.'],
  },
  {
    key: 'g8-u04-l07',
    authority: 'FIXED',
    character: 'Kwabena',
    objective:
      'Learners annualise an invented short-term borrowing fee and compare it with a conventional annual rate.',
    scenario:
      'Kwabena is an invented eighth grader investigating a pretend short-term loan: $1,200.00 borrowed with a $180.00 fee for a four-week term, renewable. A simulated year holds 13 such terms. A conventional invented alternative charges 30% a year.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'The lender describes the charge as 15% of the amount borrowed for each four-week term. Check that this rate matches the $180.00 fee actually quoted on Kwabena\'s invented loan.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does 15% of the $1,200.00 borrowed come to?', fixed: { expected: '$180.00', compute: pct(m(1200.0), 1500) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Project the fee across all 13 invented terms in a simulated year, then compute the conventional alternative at 30%.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 13 terms of the fee come to in a year?', fixed: { expected: '$2,340.00', compute: scale(m(180.0), 13) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 30% a year cost on the same $1,200.00?', fixed: { expected: '$360.00', compute: pct(m(1200.0), 3000) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the two annual costs for Kwabena and express the short-term arrangement against the amount borrowed.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the short-term arrangement cost in a year?', fixed: { expected: '$1,980.00', compute: diff(scale(m(180.0), 13), pct(m(1200.0), 3000)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much do a year of fees exceed the amount originally borrowed?', fixed: { expected: '$1,140.00', compute: diff(scale(m(180.0), 13), m(1200.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The advertised figure was a flat fee, not a rate.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why quoting a flat fee for a short term hides the cost, and describe how Kwabena converted it into something comparable.' }] },
    ],
    rubric: [
      crit(
        'Annualising a short-term fee',
        'The response compares Kwabena\'s $180.00 fee directly with a 30% annual rate.',
        'The annualisation is performed for Kwabena but not explained as the point of the comparison.',
        'The response explains that a flat fee over a short term must be projected across the year to be comparable, and uses Kwabena\'s figures to show the scale of the difference.',
      ),
    ],
    remediation:
      'If a learner treats one term as a year, mark how many terms fit in a simulated year for Kwabena before any annual figure is computed.',
    extension: 'Ask the learner what flat fee per term would make Kwabena\'s short-term loan match the 30% annual alternative.',
  },
  {
    key: 'g8-u04-l08',
    authority: 'FIXED',
    character: 'Liesel',
    objective:
      'Learners re-practise quantifying an invented rate difference on the same principal across one and several years.',
    scenario:
      'Liesel is a made-up eighth grader comparing two pretend offers on the same $6,000.00 loan: 8% and 17% for the simulated year. All figures are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year at Liesel\'s lower invented rate of 8%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does 8% cost in a year?', fixed: { expected: '$480.00', compute: pct(m(6000.0), 800) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the same year at 17%, then find the annual gap for Liesel.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does 17% cost in a year?', fixed: { expected: '$1,020.00', compute: pct(m(6000.0), 1700) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the annual gap between the two offers?', fixed: { expected: '$540.00', compute: diff(pct(m(6000.0), 1700), pct(m(6000.0), 800)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Extend both of Liesel\'s offers across three years on a simple-interest basis.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does three years at 17% cost in interest?', fixed: { expected: '$3,060.00', compute: scale(pct(m(6000.0), 1700), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than three years at 8%?', fixed: { expected: '$1,620.00', compute: diff(scale(pct(m(6000.0), 1700), 3), scale(pct(m(6000.0), 800), 3)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The gap over three years approached a third of the amount borrowed.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what Liesel should do before accepting the higher rate, and what evidence would justify waiting rather than borrowing now.' }] },
    ],
    rubric: [
      crit(
        'Acting on a rate comparison',
        'The response reports Liesel\'s gap without any action.',
        'An action is proposed for Liesel but not supported by the figures.',
        'The response proposes concrete steps for Liesel, such as seeking other offers or delaying, and grounds them in the size of the three-year gap.',
      ),
    ],
    remediation:
      'If a learner compares only percentages, require both of Liesel\'s offers to be expressed as dollars on the same principal first.',
    extension: 'Ask the learner how much smaller a principal would have to be for the 17% offer to cost what 8% costs on $6,000.00.',
  },
  {
    key: 'g8-u04-l09',
    authority: 'FIXED',
    character: 'Magnus',
    objective:
      'Learners compare two payment levels against the same invented revolving balance and quantify the difference in principal reduction.',
    scenario:
      'Magnus is an invented eighth grader modelling a pretend $3,600.00 balance at an invented 1.5% monthly rate, comparing a $150.00 payment with a $300.00 payment. Nothing here is a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one month of interest on Magnus\'s invented $3,600.00 balance at 1.5%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest is charged in the month?', fixed: { expected: '$54.00', compute: pct(m(3600.0), 150) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out how much of each of Magnus\'s two payment levels reduces the balance in that month.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much principal does the $150.00 payment repay?', fixed: { expected: '$96.00', compute: diff(m(150.0), pct(m(3600.0), 150)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much principal does the $300.00 payment repay?', fixed: { expected: '$246.00', compute: diff(m(300.0), pct(m(3600.0), 150)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the balance after one month under each of Magnus\'s payment levels.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after the $150.00 payment?', fixed: { expected: '$3,504.00', compute: diff(m(3600.0), diff(m(150.0), pct(m(3600.0), 150))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much lower is the balance under the $300.00 payment?', fixed: { expected: '$150.00', compute: diff(diff(m(3600.0), diff(m(150.0), pct(m(3600.0), 150))), diff(m(3600.0), diff(m(300.0), pct(m(3600.0), 150)))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Doubling the payment more than doubled the principal repaid.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why doubling Magnus\'s payment more than doubles the principal repaid, and what that means for paying down a balance quickly.' }] },
    ],
    rubric: [
      crit(
        'Explaining nonlinear payoff effects',
        'The response assumes Magnus\'s principal repaid doubles with the payment.',
        'The disproportion is noticed for Magnus but not explained.',
        'The response explains that the interest charge is fixed for the month, so every extra dollar of Magnus\'s payment goes entirely to principal, making larger payments disproportionately effective.',
      ),
    ],
    remediation:
      'If a learner scales the principal repaid with the payment, compute Magnus\'s interest line once and subtract it from each payment separately.',
    extension: 'Ask the learner what payment would repay $500.00 of Magnus\'s principal in a single month, and to show the reasoning.',
  },
  {
    key: 'g8-u04-l10',
    authority: 'FIXED',
    character: 'Nerissa',
    objective:
      'Learners discover that different invented rate-and-term combinations can produce identical total interest, and reason about what still separates them.',
    scenario:
      'Nerissa is a made-up eighth grader comparing two pretend $12,000.00 loans: 6% simple interest over three years, and 9% simple interest over two years. All figures are invented, and both use simple interest rather than the amortising schedules real loans normally follow.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of interest on Nerissa\'s first invented loan at 6%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the 6% loan accrue in a year?', fixed: { expected: '$720.00', compute: pct(m(12000.0), 600) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Extend each of Nerissa\'s loans over its own term and compute the total interest for each.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total interest on the 6% loan over three years?', fixed: { expected: '$2,160.00', compute: scale(pct(m(12000.0), 600), 3) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total interest on the 9% loan over two years?', fixed: { expected: '$2,160.00', compute: scale(pct(m(12000.0), 900), 2) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare Nerissa\'s two loans on total repayment and on how long the debt is carried.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total on the 9% two-year loan?', fixed: { expected: '$14,160.00', compute: sum(m(12000.0), scale(pct(m(12000.0), 900), 2)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the difference in total repayment between the two loans?', fixed: { expected: '$0.00', compute: diff(sum(m(12000.0), scale(pct(m(12000.0), 600), 3)), sum(m(12000.0), scale(pct(m(12000.0), 900), 2))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The totals matched exactly.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Nerissa\'s two loans cost the same in total. Give two reasons a borrower might still strongly prefer one over the other.' }] },
    ],
    rubric: [
      crit(
        'Looking past identical totals',
        'The response concludes Nerissa\'s loans are simply equivalent.',
        'One difference is named for Nerissa but not connected to a borrower\'s situation.',
        'The response identifies at least two real differences in Nerissa\'s loans, such as the size of each payment or the years spent carrying debt, and ties them to circumstances.',
      ),
    ],
    remediation:
      'If a learner assumes the higher rate must cost more, compute both of Nerissa\'s totals fully before any conclusion is stated.',
    extension: 'Ask the learner what term at 9% would make Nerissa\'s second loan cheaper than the first, and to show the method.',
  },
  {
    key: 'g8-u04-l11',
    authority: 'FIXED',
    character: 'Orsolya',
    objective:
      'Learners complete an invented education-funding assessment, computing the borrowing gap, annual interest, and the long-run repayment total.',
    scenario:
      'Orsolya is an invented eighth grader completing a pretend assessment: study costing $32,000.00, invented aid of $18,000.00, and the remainder borrowed at 5.5% simple interest, repaid over ten simulated years. The simple-interest model keeps the arithmetic visible; real repayment schedules amortise, so a real total would differ.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the borrowing gap in Orsolya\'s invented case after the aid is applied.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must be borrowed?', fixed: { expected: '$14,000.00', compute: diff(m(32000.0), m(18000.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute one year of interest on that borrowing, then the total interest across ten simulated years.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one year of interest cost?', fixed: { expected: '$770.00', compute: pct(diff(m(32000.0), m(18000.0)), 550) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does ten years of interest come to?', fixed: { expected: '$7,700.00', compute: scale(pct(diff(m(32000.0), m(18000.0)), 550), 10) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the total repaid over the ten years and what it would be if aid rose by $4,000.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is repaid in total over ten years?', fixed: { expected: '$21,700.00', compute: sum(diff(m(32000.0), m(18000.0)), scale(pct(diff(m(32000.0), m(18000.0)), 550), 10)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'With $4,000.00 more aid, what would ten years of interest come to?', fixed: { expected: '$5,500.00', compute: scale(pct(diff(m(32000.0), m(22000.0)), 550), 10) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Four thousand dollars of aid removed more than four thousand dollars of cost.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Quantify how much total cost the extra aid removes in Orsolya\'s case, and explain why aid is worth more than its face value.' }] },
    ],
    rubric: [
      crit(
        'Valuing aid against borrowing',
        'The response treats Orsolya\'s extra aid as worth exactly its face value.',
        'The saving is computed for Orsolya but not explained.',
        'The response shows that Orsolya\'s extra $4,000.00 removes both principal and the interest it would have carried, and states the combined saving.',
      ),
    ],
    remediation:
      'If a learner applies the rate to the total cost, mark only Orsolya\'s borrowed gap as the base before any interest is computed.',
    extension: 'Ask the learner what aid level would keep Orsolya\'s total repayment under $15,000.00, and to show the method.',
  },
  {
    key: 'g8-u05-l01',
    authority: 'FIXED',
    character: 'Perrine',
    objective:
      'Learners compare invented returns on saving and investing and weigh them against the liquidity a near-term need requires.',
    scenario:
      'Perrine is a made-up eighth grader comparing two pretend homes for $10,000.00: an invented savings account paying 1% a year and an invented investment averaging 7% a year but able to fall. She may need the money in six months.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year on Perrine\'s invented savings account at 1%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the savings account pay in a year?', fixed: { expected: '$100.00', compute: pct(m(10000.0), 100) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute a year at the invented 7% average and find the difference for Perrine.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would a year at 7% produce?', fixed: { expected: '$700.00', compute: pct(m(10000.0), 700) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the invested return in a year?', fixed: { expected: '$600.00', compute: diff(pct(m(10000.0), 700), pct(m(10000.0), 100)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model the case where Perrine must withdraw after a year in which the investment falls 12%.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the $10,000.00 be worth after a 12% fall?', fixed: { expected: '$8,800.00', compute: diff(m(10000.0), pct(m(10000.0), 1200)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much worse off is that than the savings account after a year?', fixed: { expected: '$1,300.00', compute: diff(sum(m(10000.0), pct(m(10000.0), 100)), diff(m(10000.0), pct(m(10000.0), 1200))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The money may be needed in six months.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Perrine\'s figures, explain why a near-term need changes the answer even though the investment has the higher average return.' }] },
    ],
    rubric: [
      crit(
        'Matching risk to time horizon',
        'The response chooses the higher average for Perrine regardless of the horizon.',
        'The horizon is mentioned for Perrine but not connected to the possibility of a fall.',
        'The response explains that Perrine\'s six-month need removes the time needed to recover from a fall, and concludes the savings account fits the horizon despite the lower return.',
      ),
    ],
    remediation:
      'If a learner treats the average return as guaranteed, require the fall scenario to be computed in full for Perrine, written beside the average-return figure, before any recommendation is stated, so the range of outcomes is visible rather than a single expected number.',
    extension: 'Ask the learner what horizon would change the recommendation for Perrine, and to justify it.',
    safetyNotes: ['These rates are invented for the exercise and are not a recommendation about any real product.'],
  },
  {
    key: 'g8-u05-l02',
    authority: 'FIXED',
    character: 'Quillon',
    objective:
      'Learners compute invented returns from a bond, a dividend-paying holding, and a fund with a fee, and compare what each return depends on.',
    scenario:
      'Quillon is an invented eighth grader modelling $5,000.00 in three pretend ways: an invented bond paying 4%, a holding paying a 2.5% dividend that also rose 8% in price, and a fund charging a 0.6% annual fee. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year on Quillon\'s invented 4% bond.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the bond pay in a year?', fixed: { expected: '$200.00', compute: pct(m(5000.0), 400) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the dividend and the price gain on Quillon\'s invented holding, keeping them as separate figures.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the 2.5% dividend pay?', fixed: { expected: '$125.00', compute: pct(m(5000.0), 250) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the 8% price gain worth?', fixed: { expected: '$400.00', compute: pct(m(5000.0), 800) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total the holding\'s return, then apply the invented fund fee to see what it removes.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the holding\'s total return for the year?', fixed: { expected: '$525.00', compute: sum(pct(m(5000.0), 250), pct(m(5000.0), 800)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the 0.6% annual fund fee cost?', fixed: { expected: '$30.00', compute: pct(m(5000.0), 60) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Only one of the three returns was contractually promised.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Sort Quillon\'s three sources of return by how certain each is, and explain what the price gain depends on that the bond payment does not.' }] },
    ],
    rubric: [
      crit(
        'Distinguishing kinds of return',
        'The response treats all of Quillon\'s returns as equally reliable.',
        'The price gain is called uncertain for Quillon but the reason is not given.',
        'The response ranks Quillon\'s returns by certainty, noting the bond payment is contractual, the dividend is declared, and the price gain depends on what others will pay.',
      ),
    ],
    remediation:
      'If a learner merges dividend and price gain, keep two labelled lines for Quillon\'s holding and fill each separately.',
    extension: 'Ask the learner what price movement would leave Quillon\'s holding with the same total return as the bond, and to show the reasoning.',
    safetyNotes: ['These holdings and returns are invented for the exercise and describe no real security.'],
  },
  {
    key: 'g8-u05-l03',
    authority: 'FIXED',
    character: 'Rasmus',
    objective:
      'Learners quantify how an invented loss affects a diversified holding compared with a concentrated one of equal value.',
    scenario:
      'Rasmus is a made-up eighth grader modelling $24,000.00 two ways: split evenly across four invented holdings of $6,000.00, or entirely in one of them. That holding falls 50%. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 50% fall on one of Rasmus\'s $6,000.00 holdings.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the falling holding lose in the split portfolio?', fixed: { expected: '$3,000.00', compute: pct(m(6000.0), 5000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute what Rasmus\'s split portfolio is worth after the fall, and what the whole amount would lose if concentrated.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the split portfolio worth after the fall?', fixed: { expected: '$21,000.00', compute: diff(m(24000.0), pct(m(6000.0), 5000)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would the whole $24,000.00 lose if concentrated in that holding?', fixed: { expected: '$12,000.00', compute: pct(m(24000.0), 5000) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the two outcomes for Rasmus, using the same fall and the same starting value in both versions.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the concentrated portfolio worth after the fall?', fixed: { expected: '$12,000.00', compute: diff(m(24000.0), pct(m(24000.0), 5000)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is the split portfolio?', fixed: { expected: '$9,000.00', compute: diff(diff(m(24000.0), pct(m(6000.0), 5000)), diff(m(24000.0), pct(m(24000.0), 5000))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Splitting reduced the damage without removing it.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain precisely what diversification protected against in Rasmus\'s model, and name a risk it cannot protect against.' }] },
    ],
    rubric: [
      crit(
        'Bounding what diversification does',
        'The response claims splitting removes risk for Rasmus.',
        'The reduced loss is noted for Rasmus but no unprotected risk is named.',
        'The response explains that splitting limits exposure to a single holding\'s failure, and names a risk it cannot address, such as a fall affecting every holding at once.',
      ),
    ],
    remediation:
      'If a learner applies the fall to the whole portfolio in the split case, mark which single holding falls before applying any percentage for Rasmus.',
    extension: 'Ask the learner what fall across all four of Rasmus\'s holdings would produce the same loss as the concentrated case.',
    safetyNotes: ['These holdings and movements are invented and are not a recommendation about any real investment.'],
  },
  {
    key: 'g8-u05-l04',
    authority: 'FIXED',
    character: 'Saoirse',
    objective:
      'Learners compute invented compound growth over five periods and contrast it with a sequence of equal-sized gains and losses.',
    scenario:
      'Saoirse is an invented eighth grader modelling $10,000.00 two ways: growing at 8% a year for five simulated years, and a volatile pair of years rising 30% then falling 30%. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Grow Saoirse\'s invented $10,000.00 at 8% a year for five years, compounding annually.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after five years at 8%?', fixed: { expected: '$14,693.28', compute: grow(m(10000.0), 800, 5) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now model Saoirse\'s volatile pair: a 30% rise in year one, then a 30% fall applied to the new balance.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after the 30% rise?', fixed: { expected: '$13,000.00', compute: sum(m(10000.0), pct(m(10000.0), 3000)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after the following 30% fall?', fixed: { expected: '$9,100.00', compute: diff(sum(m(10000.0), pct(m(10000.0), 3000)), pct(sum(m(10000.0), pct(m(10000.0), 3000)), 3000)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Quantify the net effect of Saoirse\'s volatile pair and compare it with two steady years at 8%.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is lost across the volatile pair of years?', fixed: { expected: '$900.00', compute: diff(m(10000.0), diff(sum(m(10000.0), pct(m(10000.0), 3000)), pct(sum(m(10000.0), pct(m(10000.0), 3000)), 3000))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would two steady years at 8% have produced?', fixed: { expected: '$11,664.00', compute: grow(m(10000.0), 800, 2) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A 30% gain and a 30% loss did not cancel out.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why equal percentage moves in opposite directions leave Saoirse worse off, and what that implies about recovering from a loss.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about percentage asymmetry',
        'The response expects Saoirse\'s gain and loss to cancel.',
        'The shortfall is noticed for Saoirse but the changing base is not identified.',
        'The response explains that Saoirse\'s fall applies to a larger base than the rise did, so recovering a loss requires a larger percentage gain than the loss itself.',
      ),
    ],
    remediation:
      'If a learner applies both percentages to the original amount, mark the base for each step in Saoirse\'s sequence before computing.',
    extension: 'Ask the learner what percentage gain would restore Saoirse\'s $9,100.00 to $10,000.00, and to show the method.',
  },
  {
    key: 'g8-u05-l05',
    authority: 'FIXED',
    character: 'Tavish',
    objective:
      'Learners quantify the long-run cost of an invented annual fee difference and connect fee structures to conflicts of interest.',
    scenario:
      'Tavish is a made-up eighth grader comparing two pretend arrangements for $50,000.00: one charging an invented 1.2% annual fee and one charging 0.1%. All figures are invented for the exercise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year of Tavish\'s invented 1.2% fee on $50,000.00.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the higher fee cost in one year?', fixed: { expected: '$600.00', compute: pct(m(50000.0), 120) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the lower fee for the same year, then the annual gap between Tavish\'s two arrangements.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the 0.1% fee cost in one year?', fixed: { expected: '$50.00', compute: pct(m(50000.0), 10) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the annual difference between the two fees?', fixed: { expected: '$550.00', compute: diff(pct(m(50000.0), 120), pct(m(50000.0), 10)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Project both of Tavish\'s fee levels across ten simulated years at the same balance.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the higher fee cost over ten years?', fixed: { expected: '$6,000.00', compute: scale(pct(m(50000.0), 120), 10) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than ten years of the lower fee?', fixed: { expected: '$5,500.00', compute: diff(scale(pct(m(50000.0), 120), 10), scale(pct(m(50000.0), 10), 10)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The fee was charged whether the balance rose or fell.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain how Tavish should weigh a fee difference against a promise of better performance, and what conflict arises when an adviser is paid more for recommending certain products.' }] },
    ],
    rubric: [
      crit(
        'Weighing fees and conflicts of interest',
        'The response treats Tavish\'s fees as too small to matter.',
        'The fee gap is computed for Tavish but the conflict question is not addressed.',
        'The response uses Tavish\'s ten-year gap to show fees are certain while performance is not, and explains that commission-based advice creates an incentive that may not align with the client.',
      ),
    ],
    remediation:
      'If a learner dismisses a 1.2% fee as small, convert Tavish\'s percentages into dollars over ten years before any judgement.',
    extension: 'Ask the learner what extra annual return the higher-fee arrangement would need to justify itself for Tavish, and why that is hard to promise.',
  },
  {
    key: 'g8-u05-l06',
    authority: 'FIXED',
    character: 'Ulla',
    objective:
      'Learners compute invented long-horizon compound growth and quantify the cost of starting later.',
    scenario:
      'Ulla is an invented eighth grader modelling $10,000.00 at an invented 7% a year for ten simulated years, compared with the same amount left uninvested for those ten years. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Grow Ulla\'s invented $10,000.00 at 7% a year for ten years, compounding annually.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after ten years?', fixed: { expected: '$19,671.52', compute: grow(m(10000.0), 700, 10) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with $10,000.00 left uninvested, then compute the first five years alone for Ulla.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does investing produce over ten years?', fixed: { expected: '$9,671.52', compute: diff(grow(m(10000.0), 700, 10), m(10000.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after only five years?', fixed: { expected: '$14,025.52', compute: grow(m(10000.0), 700, 5) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the growth in Ulla\'s first five years with the growth in the second five years.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much growth happened in the first five years?', fixed: { expected: '$4,025.52', compute: diff(grow(m(10000.0), 700, 5), m(10000.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much growth happened in the second five years?', fixed: { expected: '$5,646.00', compute: diff(grow(m(10000.0), 700, 10), grow(m(10000.0), 700, 5)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The later years grew more than the earlier ones.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Ulla\'s figures, explain why the second half grew more and what that means for someone deciding whether to start now or in five years.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about time in compounding',
        'The response treats Ulla\'s growth as evenly spread across the years.',
        'The uneven growth is noticed for Ulla but not connected to starting time.',
        'The response explains that later years in Ulla\'s model compound on a larger base, and concludes that delaying removes the most productive years at the end.',
      ),
    ],
    remediation:
      'If a learner divides the total growth evenly, compute Ulla\'s five-year and ten-year balances separately and subtract.',
    extension: 'Ask the learner to estimate Ulla\'s balance after fifteen years and explain the reasoning behind the estimate.',
  },
  {
    key: 'g8-u05-l07',
    authority: 'JUDGMENT',
    character: 'Viggo',
    objective:
      'Learners evaluate invented claims about an investment opportunity and decide what evidence would be needed before committing.',
    scenario:
      'Viggo is an invented eighth grader studying a pretend pitch: guaranteed 20% monthly returns, a testimonial from a friend who has already been paid, pressure to join before a made-up deadline, and returns paid from new members\' deposits. All of it is invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Examine each feature of Viggo\'s invented pitch. One of them describes where the money actually comes from. Say what each feature reveals before judging the pitch overall.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What does each feature of Viggo\'s pitch reveal, and which one alone is enough to reject it?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Explain why the friend having been paid is not evidence that the arrangement works, and set out what evidence would be needed before anyone committed money.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Why is the paid friend weak evidence, and what evidence would actually be required?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The word guaranteed did a lot of work in the pitch.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What would have to be true for a return to be genuinely guaranteed, and why is 20% a month not?' }],
      },
    ],
    rubric: [
      crit(
        'Identifying an unsustainable structure',
        'The response evaluates Viggo\'s pitch only on whether the returns sound attractive.',
        'The pitch is doubted for Viggo but the source of the payouts is not identified.',
        'The response identifies that returns in Viggo\'s pitch are paid from new deposits rather than from any activity, and treats that alone as decisive.',
      ),
      crit(
        'Assessing testimonial evidence',
        'The response accepts the paid friend as proof for Viggo.',
        'The testimonial is doubted for Viggo but no reason is given.',
        'The response explains that early participants in Viggo\'s structure are paid precisely to attract others, so being paid early is expected and proves nothing about sustainability.',
      ),
    ],
    lookFors: [
      'Names the payout source as the decisive feature.',
      'Explains why early payouts are consistent with a collapsing structure.',
      'Rejects the deadline as a pressure tactic.',
      'States what a genuine guarantee would require.',
    ],
    remediation:
      'If a learner is persuaded by the testimonial, ask where the money paid to the friend came from in Viggo\'s pitch, and rebuild the judgement from that answer.',
    extension: 'Ask the learner to write the two questions that would expose Viggo\'s pitch fastest, and to say why each works.',
    safetyNotes: ['This pitch is invented for study; never send money to an arrangement promising guaranteed high returns.'],
  },
  {
    key: 'g8-u05-l08',
    authority: 'FIXED',
    character: 'Wilfrid',
    objective:
      'Learners re-practise computing invented returns from a fixed-income holding and an ownership holding with two components.',
    scenario:
      'Wilfrid is a made-up eighth grader comparing $8,000.00 in a pretend bond paying 3.5% with $8,000.00 in an invented holding that rose 6% in price and paid a 1.5% dividend. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute one simulated year on Wilfrid\'s invented 3.5% bond.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the bond pay in a year?', fixed: { expected: '$280.00', compute: pct(m(8000.0), 350) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the two components of Wilfrid\'s ownership holding separately before combining them.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the 6% price gain worth?', fixed: { expected: '$480.00', compute: pct(m(8000.0), 600) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the 1.5% dividend pay?', fixed: { expected: '$120.00', compute: pct(m(8000.0), 150) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total the ownership holding\'s return for Wilfrid and compare it with the bond.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the ownership holding\'s total return?', fixed: { expected: '$600.00', compute: sum(pct(m(8000.0), 600), pct(m(8000.0), 150)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than the bond?', fixed: { expected: '$320.00', compute: diff(sum(pct(m(8000.0), 600), pct(m(8000.0), 150)), pct(m(8000.0), 350)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The ownership holding won in this particular year.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what Wilfrid\'s comparison would look like in a year when the price fell 6%, and what that shows about comparing a single year.' }] },
    ],
    rubric: [
      crit(
        'Comparing across scenarios rather than one year',
        'The response concludes the ownership holding is simply better for Wilfrid.',
        'A falling year is mentioned for Wilfrid but not computed or reasoned through.',
        'The response works through a falling year for Wilfrid, shows the ownership holding would underperform the bond, and concludes that a single year is weak evidence.',
      ),
    ],
    remediation:
      'If a learner merges the two components, keep separate labelled lines for Wilfrid\'s price gain and dividend before totalling.',
    extension: 'Ask the learner what price change would leave Wilfrid\'s two holdings with equal total returns, and to show the method.',
  },
  {
    key: 'g8-u05-l09',
    authority: 'FIXED',
    character: 'Xiomara',
    objective:
      'Learners model an invented loss affecting part of a diversified holding and compare it with the same loss concentrated.',
    scenario:
      'Xiomara is an invented eighth grader modelling $30,000.00 split across five pretend holdings of $6,000.00. Two of them fall 20%. She compares this with the whole amount held in a single falling holding. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 20% fall on one of Xiomara\'s $6,000.00 holdings.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does one falling holding lose?', fixed: { expected: '$1,200.00', compute: pct(m(6000.0), 2000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the total loss across Xiomara\'s two falling holdings and the resulting portfolio value.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total loss across the two falling holdings?', fixed: { expected: '$2,400.00', compute: scale(pct(m(6000.0), 2000), 2) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the split portfolio worth after the falls?', fixed: { expected: '$27,600.00', compute: diff(m(30000.0), scale(pct(m(6000.0), 2000), 2)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model the concentrated case for Xiomara, with the whole $30,000.00 in a single holding that falls 20%.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the concentrated portfolio worth after the fall?', fixed: { expected: '$24,000.00', compute: diff(m(30000.0), pct(m(30000.0), 2000)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is the split portfolio?', fixed: { expected: '$3,600.00', compute: diff(diff(m(30000.0), scale(pct(m(6000.0), 2000), 2)), diff(m(30000.0), pct(m(30000.0), 2000))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Two of five holdings fell and the portfolio lost 8%.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain how the share of Xiomara\'s portfolio affected translates into the overall loss, and what would happen if all five holdings fell together.' }] },
    ],
    rubric: [
      crit(
        'Relating exposure to portfolio impact',
        'The response treats the 20% fall as a 20% portfolio loss for Xiomara.',
        'The reduced impact is computed for Xiomara but not explained proportionally.',
        'The response explains that only the affected share of Xiomara\'s portfolio takes the fall, and notes that correlated falls across all holdings would remove the benefit.',
      ),
    ],
    remediation:
      'If a learner applies the fall to the whole portfolio, mark which of Xiomara\'s holdings are affected before applying any percentage.',
    extension: 'Ask the learner what fall across all five of Xiomara\'s holdings would match the concentrated loss, and to show the reasoning.',
  },
  {
    key: 'g8-u05-l10',
    authority: 'FIXED',
    character: 'Yaminah',
    objective:
      'Learners synthesise compound and simple growth on the same invented amount and quantify the compounding advantage.',
    scenario:
      'Yaminah is a made-up eighth grader modelling $6,000.00 over five simulated years at an invented 6% a year, once compounding annually and once as simple interest. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Grow Yaminah\'s invented $6,000.00 at 6% a year for five years, compounding annually.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the compounded balance after five years?', fixed: { expected: '$8,029.36', compute: grow(m(6000.0), 600, 5) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute five years of simple interest at the same rate on Yaminah\'s original amount, then the resulting balance.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one year of simple interest pay?', fixed: { expected: '$360.00', compute: pct(m(6000.0), 600) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the simple-interest balance after five years?', fixed: { expected: '$7,800.00', compute: sum(m(6000.0), scale(pct(m(6000.0), 600), 5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Quantify the compounding advantage for Yaminah and compare it with a single year of interest.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does compounding produce over five years?', fixed: { expected: '$229.36', compute: diff(grow(m(6000.0), 600, 5), sum(m(6000.0), scale(pct(m(6000.0), 600), 5))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that five-year advantage than a single year of simple interest?', fixed: { expected: '$130.64', compute: diff(pct(m(6000.0), 600), diff(grow(m(6000.0), 600, 5), sum(m(6000.0), scale(pct(m(6000.0), 600), 5)))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Five years of compounding added less than one year of interest.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why compounding looks unimpressive over Yaminah\'s five years, and what changes over twenty or thirty years.' }] },
    ],
    rubric: [
      crit(
        'Placing compounding in a time context',
        'The response dismisses compounding based on Yaminah\'s five-year result.',
        'Longer horizons are mentioned for Yaminah but no mechanism is offered.',
        'The response explains that the compounding advantage in Yaminah\'s model grows with each year\'s larger base, so five years understates what longer horizons produce.',
      ),
    ],
    remediation:
      'If a learner multiplies the first year\'s interest by five for the compound case, write out each of Yaminah\'s years with its own opening balance.',
    extension: 'Ask the learner to project Yaminah\'s compounded balance for a tenth year and describe how the annual gain changes.',
  },
]
