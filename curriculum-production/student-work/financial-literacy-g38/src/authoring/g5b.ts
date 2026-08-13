import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, least, m, most, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 5 Financial Literacy, units 4-6: saving and banking safety, borrowing and risk, marketplace capstone. */
export const G5B: readonly AuthoredLesson[] = [
  {
    key: 'g5-u04-l01',
    authority: 'FIXED',
    character: 'Zainab',
    objective:
      'Learners convert invented goals into waiting times at a steady deposit and see how changing the deposit changes the horizon of a long goal.',
    scenario:
      'Zainab is a made-up fifth grader saving $15.00 of simulated money a week. Her invented near goal is a $90.00 telescope and her invented far goal is a $300.00 laptop. All amounts are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out how long Zainab\'s $90.00 telescope takes at $15.00 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until the telescope?', fixed: { expected: '6', compute: reach(m(90.0), m(15.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Do the same for Zainab\'s $300.00 laptop at the same weekly deposit, then compare the two waiting times.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until the laptop at $15.00 a week?', fixed: { expected: '20', compute: reach(m(300.0), m(15.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many more weeks does the laptop take than the telescope?', fixed: { expected: '14', compute: diff(reach(m(300.0), m(15.0)), reach(m(90.0), m(15.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Zainab raises the weekly deposit to $25.00 and aims only at the laptop.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until the laptop at $25.00 a week?', fixed: { expected: '12', compute: reach(m(300.0), m(25.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would Zainab have after 12 weeks at $25.00 a week?', fixed: { expected: '$300.00', compute: scale(m(25.0), 12) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Raising the deposit shortened the wait by a third.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Raising the deposit means giving up something now. How should Zainab decide whether the shorter wait is worth it?' }] },
    ],
    rubric: [
      crit(
        'Weighing deposit size against waiting time',
        'The response tells Zainab to save more with no attention to what that costs now.',
        'The tradeoff is mentioned for Zainab but the week counts are not used.',
        'The response uses Zainab\'s week counts to size the gain, and weighs it against what the extra $10.00 a week would otherwise have paid for.',
      ),
    ],
    remediation:
      'When a learner divides in the wrong direction, mark $15.00 jumps along a line to Zainab\'s goal and count the jumps before any division is written.',
    extension: 'Ask the learner what weekly deposit would put Zainab\'s laptop within 10 weeks, and to justify the figure.',
  },
  {
    key: 'g5-u04-l02',
    authority: 'FIXED',
    character: 'Iker',
    objective:
      'Learners run a multi-week simulated saving plan, measure the remaining gap, and confirm the number of further weeks needed to close it.',
    scenario:
      'Iker is an invented fifth grader saving $22.50 of simulated money a week toward a made-up $360.00 repair fund. He has saved for 12 weeks so far. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out where Iker\'s plan stands after 12 weeks at $22.50 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Iker saved after 12 weeks?', fixed: { expected: '$270.00', compute: scale(m(22.5), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Measure the gap to Iker\'s $360.00 target, then convert that gap into further weeks at the same deposit.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How far is Iker from the $360.00 target?', fixed: { expected: '$90.00', compute: diff(m(360.0), scale(m(22.5), 12)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many more whole weeks does the gap need?', fixed: { expected: '4', compute: reach(diff(m(360.0), scale(m(22.5), 12)), m(22.5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'In week 13 Iker takes $75.00 out of the fund for an unplanned invented cost, then keeps saving.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in the fund right after the withdrawal?', fixed: { expected: '$195.00', compute: diff(scale(m(22.5), 12), m(75.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks at $22.50 now reach the $360.00 target?', fixed: { expected: '8', compute: reach(diff(m(360.0), diff(scale(m(22.5), 12), m(75.0))), m(22.5)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One withdrawal doubled the remaining wait.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'The repair fund existed for unplanned costs, and using it delayed the target. Was using it a failure of the plan? Argue your position.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about a fund used as intended',
        'The response calls Iker\'s withdrawal a mistake with no reference to the fund\'s purpose.',
        'The purpose is noted for Iker but the delay is not weighed against it.',
        'The response takes a position on Iker\'s withdrawal, weighing the delay against the fact that the fund existed precisely for unplanned costs.',
      ),
    ],
    remediation:
      'If a learner restarts the count from zero, keep Iker\'s running balance on one line and apply the withdrawal to that line before computing the remaining weeks.',
    extension: 'Ask the learner what weekly deposit would return Iker to his original finishing week despite the withdrawal.',
  },
  {
    key: 'g5-u04-l03',
    authority: 'FIXED',
    character: 'Sunita',
    objective:
      'Learners track a simulated account through deposits, a withdrawal, and recurring fees, and compare institutions on the cost of holding money.',
    scenario:
      'Sunita is a made-up fifth grader modelling a pretend account. Invented deposits of $150.00 and $85.50 go in, a $60.25 withdrawal comes out, and the invented bank charges $4.00 a month. A made-up credit union charges nothing. This is a simulation, not a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Sunita\'s two invented deposits.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the deposits come to?', fixed: { expected: '$235.50', compute: sum(m(150.0), m(85.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Take out the $60.25 withdrawal, then apply one month of the invented $4.00 fee.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after the withdrawal?', fixed: { expected: '$175.25', compute: diff(sum(m(150.0), m(85.5)), m(60.25)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after one monthly fee?', fixed: { expected: '$171.25', compute: diff(diff(sum(m(150.0), m(85.5)), m(60.25)), m(4.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Look at a full simulated year of the invented fee, and at what the same activity leaves at the fee-free credit union.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 months of the invented fee come to?', fixed: { expected: '$48.00', compute: scale(m(4.0), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the credit-union balance be after the same deposits and withdrawal?', fixed: { expected: '$175.25', compute: diff(sum(m(150.0), m(85.5)), m(60.25)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A year of small fees was worth more than a fifth of the balance.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Name two questions Sunita should ask before choosing where money is held, and say what each question protects against.' }] },
    ],
    rubric: [
      crit(
        'Evaluating where money is held',
        'The response treats all institutions in Sunita\'s comparison as interchangeable.',
        'One question is offered for Sunita but not tied to a risk or cost.',
        'The response gives Sunita at least two questions, such as what fees apply and whether deposits are protected, and connects each to a specific risk or cost.',
      ),
    ],
    remediation:
      'When a learner applies the fee before the withdrawal, write Sunita\'s activity as a dated list and process the lines strictly in order.',
    extension: 'Ask the learner how many months of the invented fee it would take to consume the smaller deposit, and to show the reasoning.',
    safetyNotes: ['This is a simulated account; never write a real account number or balance on this sheet.'],
  },
  {
    key: 'g5-u04-l04',
    authority: 'FIXED',
    character: 'Elias',
    objective:
      'Learners apply a stated simple interest rate across two invented periods and compare the result against holding the same money outside an account.',
    scenario:
      'Elias is an invented fifth grader modelling a pretend savings account paying 3% simple interest a year on the starting amount. He begins with an invented $400.00. Nothing here is a real account or rate.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 3% rate to Elias\'s starting $400.00 for one simulated year.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does one simulated year pay?', fixed: { expected: '$12.00', compute: pct(m(400.0), 300) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add that interest to the starting amount, then work out a second year, remembering that simple interest is always figured on the original $400.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after one year?', fixed: { expected: '$412.00', compute: sum(m(400.0), pct(m(400.0), 300)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance after two years?', fixed: { expected: '$424.00', compute: sum(m(400.0), pct(m(400.0), 300), pct(m(400.0), 300)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare that with keeping the same invented $400.00 in a box for the two years, then look at a doubled starting amount.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the simulated account hold after two years than the box?', fixed: { expected: '$24.00', compute: diff(sum(m(400.0), pct(m(400.0), 300), pct(m(400.0), 300)), m(400.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would one year of interest be on a starting $500.00?', fixed: { expected: '$15.00', compute: pct(m(500.0), 300) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Interest rewarded leaving the money alone.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What is Elias giving up while the money sits in the simulated account, and why is the interest offered in return?' }] },
    ],
    rubric: [
      crit(
        'Explaining why interest is paid',
        'The response treats Elias\'s interest as free money.',
        'Interest is described for Elias as a reward without naming what the saver gives up.',
        'The response explains that Elias gives up immediate access and use of the money, and that the institution pays interest because it can put those funds to work meanwhile.',
      ),
    ],
    remediation:
      'If a learner applies the rate to the growing balance, write the simple-interest rule for Elias at the top of the page and mark the original amount before each year.',
    extension: 'Ask the learner how many simulated years at this rate it would take for Elias\'s interest alone to reach $60.00, and to justify it.',
  },
  {
    key: 'g5-u04-l05',
    authority: 'FIXED',
    character: 'Wanjiru',
    objective:
      'Learners apply an invented deposit-protection limit to a simulated balance, identify the unprotected portion, and restructure holdings so everything falls within the limit.',
    scenario:
      'Wanjiru is a made-up fifth grader working with a pretend rule: in this simulation, deposits are protected up to $250.00 per invented account. Her simulated balance is $320.00 in a single account. The limit and balances are invented for the exercise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compare Wanjiru\'s invented $320.00 balance with the simulation\'s $250.00 protection limit.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the balance sits above the protection limit?', fixed: { expected: '$70.00', compute: diff(m(320.0), m(250.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Wanjiru splits the invented balance evenly across two accounts at different institutions, each with the same protection limit.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the balance in each of the two accounts?', fixed: { expected: '$160.00', compute: div(m(320.0), 2) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'After the split, how does each account compare with the $250.00 limit?',
            choices: ['Below the limit', 'Exactly at the limit', 'Above the limit'],
            fixed: { expected: 'Below the limit', compute: sel(div(m(320.0), 2), m(250.0), 'Below the limit', 'Exactly at the limit', 'Above the limit') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Wanjiru\'s simulated balance grows to $480.00 and she keeps the two-account structure.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in each account after the growth?', fixed: { expected: '$240.00', compute: div(m(480.0), 2) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much headroom does each account still have under the limit?', fixed: { expected: '$10.00', compute: diff(m(250.0), div(m(480.0), 2)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The money never changed; only where it sat did.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Splitting the balance changed nothing about how much Wanjiru had. What did it change?' }] },
    ],
    rubric: [
      crit(
        'Understanding a protection limit',
        'The response treats Wanjiru\'s split as increasing her money.',
        'The response says the split helps but does not name what is protected.',
        'The response explains that Wanjiru\'s total is unchanged while the portion covered by the invented protection limit rises, so less would be at risk if an institution failed.',
      ),
    ],
    remediation:
      'If a learner thinks the split creates money, write Wanjiru\'s total above the two account boxes and check that the boxes always add back to it.',
    extension: 'Ask the learner at what total balance Wanjiru would need a third account under this invented limit, and to show the reasoning.',
    safetyNotes: ['The $250.00 limit here is invented for the exercise; check real protection rules with a trusted adult rather than assuming this figure.'],
  },
  {
    key: 'g5-u04-l06',
    authority: 'JUDGMENT',
    character: 'Levi',
    objective:
      'Learners evaluate invented password and account-security practices and choose the ones that actually reduce risk.',
    scenario:
      'Levi is an invented fifth grader reviewing a pretend list of habits for a family simulation: one password reused everywhere, a password written on a note taped to a screen, a long unique passphrase kept in a locked manager, and a habit of clicking links inside account emails. Nothing here describes a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Go through Levi\'s four invented habits one at a time. Two make an attacker\'s job easier and two make it harder. Say what each habit does before ranking anything.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which of Levi\'s four habits reduce risk, and what does each of the risky ones actually make possible?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Levi has to recommend a short set of practices someone would actually follow. Write the recommendation and defend it against the objection that strong passwords are too hard to remember.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Levi recommend, and how does the recommendation answer the objection that it is too hard to remember?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'One habit was about links rather than passwords.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is how someone reaches a login page as important as the strength of the password?' }],
      },
    ],
    rubric: [
      crit(
        'Evaluating security practices',
        'The response treats all four of Levi\'s habits as equally acceptable.',
        'The risky habits are identified for Levi but the reason each is risky is not given.',
        'The response identifies the reused password and the taped note as risky for Levi and explains the concrete consequence of each, such as one breach unlocking everything.',
      ),
      crit(
        'Producing a usable recommendation',
        'Levi\'s recommendation is impractical or ignores the memory objection.',
        'A recommendation is made for Levi but the objection is dismissed rather than answered.',
        'Levi\'s recommendation is something a household would actually follow and it answers the memory objection directly, for example by using a manager or a memorable passphrase.',
      ),
    ],
    lookFors: [
      'Identifies both risky habits in the invented list.',
      'Explains what reusing one password across accounts makes possible.',
      'Recommends practices a real household could sustain.',
      'Connects link-clicking to reaching a fake login page.',
    ],
    remediation:
      'If a learner ranks habits without reasons, ask for each one what an attacker would gain, and rebuild the ranking from those answers.',
    extension: 'Ask the learner to write the one sentence Levi could say to a family member who insists on reusing one password.',
    safetyNotes: ['Never write any real password on this sheet; discuss only the invented habits listed here.'],
  },
  {
    key: 'g5-u05-l01',
    authority: 'FIXED',
    character: 'Rasheed',
    objective:
      'Learners model an invented repayment schedule, track the outstanding balance, and recompute the timeline after a missed payment.',
    scenario:
      'Rasheed is a made-up fifth grader modelling a pretend loan from an invented community fund: $240.00 borrowed, repaid at $20.00 a week, with no interest charged. Everything is invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out how long Rasheed\'s repayment takes at $20.00 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until the $240.00 is repaid?', fixed: { expected: '12', compute: reach(m(240.0), m(20.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Stop partway, at the end of week 5, and work out both what Rasheed has paid and what he still owes.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Rasheed repaid after 5 weeks?', fixed: { expected: '$100.00', compute: scale(m(20.0), 5) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does he still owe after 5 weeks?', fixed: { expected: '$140.00', compute: diff(m(240.0), scale(m(20.0), 5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Rasheed misses week 6 entirely, paying nothing, then resumes $20.00 a week.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many more whole weeks at $20.00 clear the remaining balance?', fixed: { expected: '7', compute: reach(diff(m(240.0), scale(m(20.0), 5)), m(20.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would Rasheed need to pay each week to finish in 5 weeks instead of 7?', fixed: { expected: '$28.00', compute: div(diff(m(240.0), scale(m(20.0), 5)), 5) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A missed week moved the finishing date but not the amount owed.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What should Rasheed tell the fund about the missed week, and when should he tell them?' }] },
    ],
    rubric: [
      crit(
        'Managing a repayment commitment',
        'The response ignores the agreement Rasheed made with the fund.',
        'The response says Rasheed should communicate but not when or what.',
        'The response has Rasheed notify the fund before the missed payment where possible, state the new expected timeline, and treats the obligation as unchanged.',
      ),
    ],
    remediation:
      'When a learner loses track of the balance, keep a two-column ledger of repaid and still owed for Rasheed, updating both after every week.',
    extension: 'Ask the learner what steady weekly payment would have cleared Rasheed\'s loan in 10 weeks, and to justify it.',
  },
  {
    key: 'g5-u05-l02',
    authority: 'FIXED',
    character: 'Elif',
    objective:
      'Learners compute the interest cost of an invented loan, split the repayment into equal instalments, and compare borrowing with saving first.',
    scenario:
      'Elif is an invented fifth grader modelling a pretend $300.00 loan at 9% interest for the simulated year, repaid in 3 equal instalments. Saving $30.00 a week instead would take longer but cost no interest. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out the invented 9% interest on Elif\'s $300.00 loan.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the loan cost?', fixed: { expected: '$27.00', compute: pct(m(300.0), 900) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the interest to the amount borrowed, then divide the total across Elif\'s 3 equal instalments.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Elif repay in total?', fixed: { expected: '$327.00', compute: sum(m(300.0), pct(m(300.0), 900)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is each instalment?', fixed: { expected: '$109.00', compute: div(sum(m(300.0), pct(m(300.0), 900)), 3) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare that with Elif saving $30.00 a week and paying the $300.00 in full later.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks of saving $30.00 reach $300.00?', fixed: { expected: '10', compute: reach(m(300.0), m(30.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does borrowing cost than saving first?', fixed: { expected: '$27.00', compute: diff(sum(m(300.0), pct(m(300.0), 900)), m(300.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Borrowing bought ten weeks and charged twenty-seven dollars for them.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Describe one situation where Elif should pay the $27.00 and one where she should wait the 10 weeks, and say what distinguishes them.' }] },
    ],
    rubric: [
      crit(
        'Judging when borrowing is worth its cost',
        'The response declares borrowing always right or always wrong for Elif.',
        'Both sides are stated for Elif but no distinguishing feature is identified.',
        'The response gives Elif a situation on each side and identifies what distinguishes them, such as whether the delay itself carries a cost or a risk.',
      ),
    ],
    remediation:
      'If a learner treats the instalment as the cost, write Elif\'s borrowed amount, total repaid, and their difference on separate lines so interest stands alone.',
    extension: 'Ask the learner what interest rate would make Elif\'s loan cost exactly $15.00, and how they found it.',
  },
  {
    key: 'g5-u05-l03',
    authority: 'JUDGMENT',
    character: 'Gus',
    objective:
      'Learners set boundaries around lending to friends and decide what to do when an invented repayment does not arrive.',
    scenario:
      'Gus is a made-up fifth grader who lent a classmate $12.00 of pretend club money three weeks ago. The classmate has said nothing since, they still eat lunch together, and a second classmate has now asked Gus for a loan. Everything here is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Separate the two problems in Gus\'s invented situation: the unpaid loan and the new request. Describe what makes each one awkward before deciding either.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What makes the unpaid loan awkward for Gus, and what makes the new request a separate question?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what Gus should say to the first classmate. Keep it something a fifth grader could say in a hallway that raises the loan without ending the friendship.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Gus say about the unpaid $12.00, and what makes those words workable?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'A second classmate is waiting for an answer.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What boundary could Gus set for lending in future, and how would he explain it without insulting anyone?' }],
      },
    ],
    rubric: [
      crit(
        'Raising an unpaid loan',
        'The response has Gus stay silent, or confront the classmate accusingly.',
        'Gus raises it but the wording is likely to embarrass the classmate publicly.',
        'The response gives Gus direct, private wording that names the $12.00 and asks about a plan, without accusation.',
      ),
      crit(
        'Setting a lending boundary',
        'The response has Gus lend again with no boundary, or refuse all lending without explanation.',
        'A boundary is named for Gus but not explained in a way he could say aloud.',
        'The response gives Gus a boundary he can state plainly, such as lending only what he can afford to lose or waiting until the first loan is settled, with a respectful explanation.',
      ),
    ],
    lookFors: [
      'Treats the unpaid loan and the new request as separate decisions.',
      'Supplies wording that is private and non-accusatory.',
      'States a boundary Gus could actually keep.',
      'Does not suggest publicly shaming the classmate.',
    ],
    remediation:
      'If a learner writes an ultimatum, have them read it aloud as though to a friend, and revise anything they would not want said to them.',
    extension: 'Ask the learner what Gus should do differently at the moment of lending so the same situation is less likely next time.',
  },
  {
    key: 'g5-u05-l04',
    authority: 'FIXED',
    character: 'Tiwa',
    objective:
      'Learners apply a percentage allocation to an invented fundraising total and divide the remainder equally across invented recipients.',
    scenario:
      'Tiwa is an invented fifth grader whose pretend class raised $480.00 in simulated funds. The class agreed to send 15% to a made-up emergency reserve and split the rest equally among 4 invented local projects.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Take the agreed 15% out of Tiwa\'s invented $480.00 for the reserve.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much goes to the reserve?', fixed: { expected: '$72.00', compute: pct(m(480.0), 1500) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find what remains after the reserve, then split that remainder equally among Tiwa\'s 4 invented projects.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left after the reserve?', fixed: { expected: '$408.00', compute: diff(m(480.0), pct(m(480.0), 1500)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does each project receive?', fixed: { expected: '$102.00', compute: div(diff(m(480.0), pct(m(480.0), 1500)), 4) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A late invented donation lifts the total to $500.00, with the same two rules applied.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much now goes to the reserve?', fixed: { expected: '$75.00', compute: pct(m(500.0), 1500) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does each project now receive?', fixed: { expected: '$106.25', compute: div(diff(m(500.0), pct(m(500.0), 1500)), 4) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The rule was written before the total was known.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Tiwa\'s class chose a percentage-and-split rule instead of fixed amounts. Give one advantage and one disadvantage of that choice.' }] },
    ],
    rubric: [
      crit(
        'Evaluating an allocation rule',
        'The response only restates Tiwa\'s amounts without evaluating the rule.',
        'One advantage is named for Tiwa\'s rule but no disadvantage is offered.',
        'The response names an advantage, such as the rule scaling automatically, and a real disadvantage, such as no project being guaranteed a workable minimum.',
      ),
    ],
    remediation:
      'If a learner divides before taking the percentage, number Tiwa\'s two rules on the page and require the first result to be boxed before the second is begun.',
    extension: 'Ask the learner what total Tiwa\'s class would need for each project to receive exactly $120.00, and to show the reasoning.',
  },
  {
    key: 'g5-u05-l05',
    authority: 'FIXED',
    character: 'Solveig',
    objective:
      'Learners compare the total cost of an invented protection arrangement against the cost of bearing a loss directly, using premiums and a deductible.',
    scenario:
      'Solveig is a made-up fifth grader modelling a pretend protection plan: $12.00 a month in simulated premiums, a $50.00 deductible, and an invented $380.00 repair that the plan would cover above the deductible. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out a simulated year of Solveig\'s invented premiums at $12.00 a month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 months of premiums come to?', fixed: { expected: '$144.00', compute: scale(m(12.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out what the invented $380.00 repair costs Solveig with the plan in place, remembering she still pays the deductible.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Solveig pay toward the repair with the plan?', fixed: { expected: '$50.00', compute: m(50.0) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is her total cost for the year with the plan and one repair?', fixed: { expected: '$194.00', compute: sum(scale(m(12.0), 12), m(50.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Now model the year without any plan, where the repair is paid in full, and then model a year with no repair at all.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is Solveig with the plan in the year with a repair?', fixed: { expected: '$186.00', compute: diff(m(380.0), sum(scale(m(12.0), 12), m(50.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'In a year with no repair, how much worse off is she with the plan?', fixed: { expected: '$144.00', compute: diff(sum(scale(m(12.0), 12), m(0.0)), m(0.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan won one year and lost the other.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Protection costs money in quiet years and saves money in bad ones. Explain what someone is actually buying, and when it is worth buying.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about risk protection',
        'The response judges Solveig\'s plan solely by whether a repair happened.',
        'Both years are described for Solveig but no account of what protection buys is given.',
        'The response explains that Solveig is buying protection against a loss she could not absorb, and ties the decision to how damaging the unprotected outcome would be.',
      ),
    ],
    remediation:
      'If a learner forgets the deductible, list Solveig\'s costs as premiums plus deductible in two labelled lines before any comparison.',
    extension: 'Ask the learner how large the repair would have to be before Solveig\'s plan pays for itself in a single year, and to show the reasoning.',
  },
  {
    key: 'g5-u05-l06',
    authority: 'JUDGMENT',
    character: 'Bilal',
    objective:
      'Learners analyse an invented scam message for its structure and choose a response that neither engages nor escalates.',
    scenario:
      'Bilal is an invented fifth grader who receives a made-up message: a package cannot be delivered, a small fee must be paid within one hour, and a link leads to a page asking for card details. The message is invented for practice and no real details exist.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Break the invented message down with Bilal: a plausible story, a deadline, a small amount, and a request for card details. Say what each part is doing rather than whether the story is true.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What job does each part of the message do, and why is the small fee amount deliberately small?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what Bilal should do, in order, including how to check whether a delivery problem is real without using anything in the message.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Bilal do step by step, and how can he check the story without using the link or number in the message?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The message would have cost only a few dollars if it worked.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is the real risk much larger than the small fee the message asks for?' }],
      },
    ],
    rubric: [
      crit(
        'Analysing scam structure',
        'The response judges only whether the delivery story sounds true.',
        'One element is identified for Bilal but the role of the small amount is missed.',
        'The response explains that Bilal\'s message pairs a plausible story with urgency and a deliberately small fee, because a small amount lowers resistance to entering card details.',
      ),
      crit(
        'Verifying without engaging',
        'The response has Bilal use the link or reply to the message.',
        'Bilal avoids the link but no independent way to check is offered.',
        'The response has Bilal ignore the link entirely and verify through an independently found channel, with a trusted adult involved.',
      ),
    ],
    lookFors: [
      'Names urgency, plausibility, and the small amount as deliberate design.',
      'Explains that card details, not the fee, are the actual target.',
      'Verifies through a channel not supplied by the message.',
      'Involves a trusted adult before any action.',
    ],
    remediation:
      'If a learner focuses on whether a package exists, set the story aside entirely and ask what the sender gains if the card details are entered.',
    extension: 'Ask the learner to write the version of this message a real delivery service could legitimately send, and to say what is missing from it.',
    safetyNotes: ['Never enter card, bank, or password details in response to any message; this scenario is invented for practice.'],
  },
  {
    key: 'g5-u06-l01',
    authority: 'FIXED',
    character: 'Ottilie',
    objective:
      'Learners compare invented start-up costs across pretend venture ideas and test a scaled production plan against a simulated budget.',
    scenario:
      'Ottilie is a made-up fifth grader choosing among three pretend venture ideas with invented start-up costs of $85.00 for a print series, $120.50 for a garden kit, and $64.75 for a card set. Her simulated budget is $300.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Look across Ottilie\'s three invented start-up costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the lowest start-up cost among the three ideas?', fixed: { expected: '$64.75', compute: least(m(85.0), m(120.5), m(64.75)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find the spread between Ottilie\'s dearest and cheapest ideas, then compare two of them directly.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is the dearest start-up than the cheapest?', fixed: { expected: '$55.75', compute: diff(most(m(85.0), m(120.5), m(64.75)), least(m(85.0), m(120.5), m(64.75))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Between the print series and the garden kit, which costs less to start?',
            choices: ['The print series', 'The garden kit', 'They cost the same'],
            fixed: { expected: 'The print series', compute: sel(m(85.0), m(120.5), 'The print series', 'They cost the same', 'The garden kit') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Ottilie chooses the card set and plans 4 production batches, each costing the same start-up amount.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 4 batches cost?', fixed: { expected: '$259.00', compute: scale(m(64.75), 4) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $300.00 budget remains?', fixed: { expected: '$41.00', compute: diff(m(300.0), scale(m(64.75), 4)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cheapest start was not automatically the strongest plan.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'What evidence about buyers would Ottilie need before four batches of the cheapest idea beats one batch of a dearer one?' }] },
    ],
    rubric: [
      crit(
        'Grounding a venture choice in demand',
        'The response chooses Ottilie\'s cheapest idea with no reference to buyers.',
        'Demand is mentioned for Ottilie but not tied to the batch decision.',
        'The response names concrete evidence Ottilie would need, such as how many buyers exist at what price, and connects it to whether four batches can actually sell.',
      ),
    ],
    remediation:
      'When a learner selects on cost alone, have them write who buys each of Ottilie\'s three products and why, before any comparison is drawn.',
    extension: 'Ask the learner how many garden kits Ottilie could start inside $300.00 and what that implies for her choice.',
  },
  {
    key: 'g5-u06-l02',
    authority: 'FIXED',
    character: 'Mateo',
    objective:
      'Learners build a unit cost from invented components, set a price, and compute revenue, cost, and profit across a production run.',
    scenario:
      'Mateo is an invented fifth grader making pretend planters for a simulated market. Each invented planter uses $2.10 of clay, $1.75 of glaze, and $0.75 of packaging. He prices them at $8.00 and plans a run of 20.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Mateo\'s three invented component costs for one planter.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one planter cost to make?', fixed: { expected: '$4.60', compute: sum(m(2.1), m(1.75), m(0.75)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare Mateo\'s $8.00 price with that unit cost, then scale the cost across the run of 20.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Mateo keep from one planter after materials?', fixed: { expected: '$3.40', compute: diff(m(8.0), sum(m(2.1), m(1.75), m(0.75))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the run of 20 cost in materials?', fixed: { expected: '$92.00', compute: scale(sum(m(2.1), m(1.75), m(0.75)), 20) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out the run\'s revenue and profit if everything sells, then rework the profit if only 14 sell.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the profit if all 20 planters sell?', fixed: { expected: '$68.00', compute: diff(scale(m(8.0), 20), scale(sum(m(2.1), m(1.75), m(0.75)), 20)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the profit if only 14 sell?', fixed: { expected: '$20.00', compute: diff(scale(m(8.0), 14), scale(sum(m(2.1), m(1.75), m(0.75)), 20)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Seventy percent of the units sold left under a third of the profit.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Mateo\'s profit is so much more sensitive than his sales, and what that implies about how large a first run should be.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about run size and risk',
        'The response assumes Mateo\'s unsold planters cost nothing.',
        'The response notes profit fell faster but does not explain why.',
        'The response explains that Mateo\'s materials were committed for all 20, so unsold units strip revenue without stripping cost, and argues for sizing a first run to demonstrated demand.',
      ),
    ],
    remediation:
      'When a learner scales cost by units sold, label the two lines made and sold for Mateo and fill each from the correct count.',
    extension: 'Ask the learner how many planters Mateo must sell to break even on a run of 20, and to show the reasoning.',
  },
  {
    key: 'g5-u06-l03',
    authority: 'FIXED',
    character: 'Freya',
    objective:
      'Learners assemble an invented operating budget, verify it against a simulated limit, and evaluate whether an added cost can be absorbed.',
    scenario:
      'Freya is a made-up fifth grader running a pretend market stall on a $200.00 simulated operating budget. Her invented costs are $92.00 of supplies, a $25.00 stall fee, and $18.50 of signage.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Freya\'s three invented operating costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Freya\'s operating costs come to?', fixed: { expected: '$135.50', compute: sum(m(92.0), m(25.0), m(18.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Check that against Freya\'s $200.00 simulated budget and state how much room remains.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $200.00 is unspent?', fixed: { expected: '$64.50', compute: diff(m(200.0), sum(m(92.0), m(25.0), m(18.5))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does Freya\'s plan sit against the budget?',
            choices: ['Inside the budget', 'Exactly at the budget', 'Over the budget'],
            fixed: { expected: 'Inside the budget', compute: sel(sum(m(92.0), m(25.0), m(18.5)), m(200.0), 'Inside the budget', 'Exactly at the budget', 'Over the budget') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A required invented $70.00 refrigeration hire is added to Freya\'s stall costs.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the costs come to with the hire?', fixed: { expected: '$205.50', compute: sum(m(92.0), m(25.0), m(18.5), m(70.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far over the $200.00 budget is that?', fixed: { expected: '$5.50', compute: diff(sum(m(92.0), m(25.0), m(18.5), m(70.0)), m(200.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The hire is required if she sells anything chilled.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Freya must close a $5.50 gap. Compare cutting supplies with dropping the chilled products entirely, and recommend one.' }] },
    ],
    rubric: [
      crit(
        'Making a budget tradeoff',
        'The response cuts a required cost or ignores the gap for Freya.',
        'One option is chosen for Freya but the alternative is not weighed.',
        'The response weighs cutting Freya\'s supplies against dropping the chilled line, notes what each would do to sales, and recommends one with reasons.',
      ),
    ],
    remediation:
      'If a learner cuts the stall fee, mark each of Freya\'s lines required or discretionary before proposing any reduction.',
    extension: 'Ask the learner to rebuild Freya\'s budget with the hire included so the total lands under $200.00, showing each new line.',
  },
  {
    key: 'g5-u06-l04',
    authority: 'JUDGMENT',
    character: 'Petra',
    objective:
      'Learners decide how to tell customers about a problem with an invented product and weigh honesty against short-term sales.',
    scenario:
      'Petra is an invented fifth grader who has already sold 12 pretend candles when she notices the invented wicks burn out halfway down. Buyers have not complained yet, the stall closes tomorrow, and everything here is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Lay out Petra\'s invented situation: what buyers were told, what she now knows, and who is affected. Keep what she knows separate from what she fears.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What do Petra\'s buyers currently believe, and what does she now know that they do not?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what Petra should tell buyers and how she should tell them, given the stall closes tomorrow and she has already been paid.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Petra communicate, to whom, and what should she offer?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Saying nothing would probably work out fine for the stall.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is "nobody complained" not a good enough reason for Petra to stay quiet?' }],
      },
    ],
    rubric: [
      crit(
        'Communicating a product problem',
        'The response has Petra say nothing, or wait until a buyer complains.',
        'Petra tells buyers but no remedy is offered and no plan for reaching them is given.',
        'The response has Petra tell buyers proactively, explains how she could reach them before the stall closes, and offers a concrete remedy such as a refund or replacement.',
      ),
      crit(
        'Reasoning about honesty and trust',
        'The response treats silence as acceptable because sales are already made.',
        'Honesty is asserted for Petra without connecting it to consequences.',
        'The response explains that Petra\'s buyers paid for something that does not work as described, and that disclosure protects both them and her reputation for any future stall.',
      ),
    ],
    lookFors: [
      'States clearly what buyers were led to expect.',
      'Has Petra initiate the disclosure rather than wait.',
      'Offers a concrete remedy.',
      'Rejects "nobody complained" as a justification.',
    ],
    remediation:
      'If a learner counsels silence, ask what they would want to be told as a buyer of Petra\'s candles, and rebuild the answer from there.',
    extension: 'Ask the learner to write the exact notice Petra could post at her stall, in under three sentences.',
  },
  {
    key: 'g5-u06-l05',
    authority: 'FIXED',
    character: 'Idris',
    objective:
      'Learners reconstruct sales from invented unit records, quantify a recording discrepancy, and separate revenue from what remains after costs.',
    scenario:
      'Idris is a made-up fifth grader keeping records for a pretend market stall. He sold 18 invented items at $8.00 each, recorded sales as $142.50, and had $92.00 of simulated costs.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Rebuild Idris\'s sales from the invented unit record: 18 items at $8.00.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What were the actual total sales?', fixed: { expected: '$144.00', compute: scale(m(8.0), 18) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with the $142.50 recorded, then use the correct figure against Idris\'s $92.00 of costs.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much is the record off?', fixed: { expected: '$1.50', compute: diff(scale(m(8.0), 18), m(142.5)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What remains after costs, using the correct sales figure?', fixed: { expected: '$52.00', compute: diff(scale(m(8.0), 18), m(92.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A second invented market day adds 9 more sales at the same price with $30.00 of extra costs.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are total sales across both days?', fixed: { expected: '$216.00', compute: sum(scale(m(8.0), 18), scale(m(8.0), 9)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What remains after all costs across both days?', fixed: { expected: '$94.00', compute: diff(sum(scale(m(8.0), 18), scale(m(8.0), 9)), sum(m(92.0), m(30.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The record and the reality drifted by a dollar and a half.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Design a record-keeping routine for Idris that would catch this kind of drift on the day, and explain why it works.' }] },
    ],
    rubric: [
      crit(
        'Designing a record check',
        'The response says Idris should be careful without describing a routine.',
        'A routine is described for Idris but it would not detect a mismatch between units and money.',
        'The response describes a routine for Idris that cross-checks units sold against cash taken, such as counting stock at close and comparing it with the recorded total.',
      ),
    ],
    remediation:
      'If a learner reports sales as what is kept, physically separate the cost amount from the sales figure for Idris before the remaining amount is written.',
    extension: 'Ask the learner how many items at $8.00 Idris must sell across both days to keep $120.00, and to show the reasoning.',
  },
  {
    key: 'g5-u06-l06',
    authority: 'FIXED',
    character: 'Colette',
    objective:
      'Learners divide an invented profit into giving, saving, and keeping shares using a percentage and a fraction, and confirm the split reconstructs the whole.',
    scenario:
      'Colette is an invented fifth grader with $168.00 of pretend market profit. Her invented plan sends 12.5% to a made-up food bank, saves half the original profit, and keeps the remainder.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Take the 12.5% giving share out of Colette\'s invented $168.00.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Colette give?', fixed: { expected: '$21.00', compute: pct(m(168.0), 1250) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out Colette\'s saving share, which is half the original profit, then find what is left to keep.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Colette save?', fixed: { expected: '$84.00', compute: div(m(168.0), 2) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left for Colette to keep?', fixed: { expected: '$63.00', compute: diff(m(168.0), sum(pct(m(168.0), 1250), div(m(168.0), 2))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Check the split by rebuilding the whole, then apply the same rules to a larger invented profit of $240.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the three shares add back to?', fixed: { expected: '$168.00', compute: sum(pct(m(168.0), 1250), div(m(168.0), 2), diff(m(168.0), sum(pct(m(168.0), 1250), div(m(168.0), 2)))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'On a $240.00 profit, how much would Colette keep?', fixed: { expected: '$90.00', compute: diff(m(240.0), sum(pct(m(240.0), 1250), div(m(240.0), 2))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan was fixed before the profit was known.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Colette committed to these shares in advance. Explain what that protects and name a circumstance that would justify changing the plan.' }] },
    ],
    rubric: [
      crit(
        'Evaluating a pre-committed plan',
        'The response treats Colette\'s shares as arbitrary or unchangeable.',
        'One benefit is named for Colette but no circumstance for revision is offered.',
        'The response explains that Colette\'s advance commitment protects the giving and saving shares from in-the-moment pressure, and names a specific circumstance, such as an unexpected necessary cost, that would justify revisiting it.',
      ),
    ],
    remediation:
      'If the shares fail to reconstruct the whole, check each of Colette\'s three shares against the original profit separately before adding them back.',
    extension: 'Ask the learner to redesign Colette\'s plan so the giving share rises with larger profits, and to test it at both $168.00 and $240.00.',
  },
]
