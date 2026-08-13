import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, least, m, most, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 4 Financial Literacy, units 4-6: saving and safety, ads and borrowing, and the simulated marketplace. */
export const G4B: readonly AuthoredLesson[] = [
  {
    key: 'g4-u04-l01',
    authority: 'FIXED',
    character: 'Lucia',
    objective:
      'Learners convert two invented savings goals into the number of weeks each takes at a steady deposit, and compare how a near goal and a distant goal differ in waiting time.',
    scenario:
      'Lucia is a made-up fourth grader who saves $6.00 of simulated money a week. She has two invented goals: a $24.00 pair of headphones soon and a $96.00 bicycle much later. Both goals and the weekly amount are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out how long Lucia\'s near goal takes at $6.00 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until Lucia reaches the $24.00 headphones?', fixed: { expected: '4', compute: reach(m(24.0), m(6.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now do the same for Lucia\'s distant goal, the $96.00 bicycle at the same $6.00 a week, and compare the two waiting times.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until Lucia reaches the $96.00 bicycle?', fixed: { expected: '16', compute: reach(m(96.0), m(6.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many more weeks does the bicycle take than the headphones?', fixed: { expected: '12', compute: diff(reach(m(96.0), m(6.0)), reach(m(24.0), m(6.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Lucia raises her weekly saving to $8.00 and aims only at the bicycle.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until the $96.00 bicycle at $8.00 a week?', fixed: { expected: '12', compute: reach(m(96.0), m(8.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would Lucia have after 8 weeks at $8.00 a week?', fixed: { expected: '$64.00', compute: scale(m(8.0), 8) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both goals came from the same weekly deposit.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Should Lucia chase the headphones first or save straight through for the bicycle? Use the week counts in your reasoning.' }] },
    ],
    rubric: [
      crit(
        'Reasoning across time horizons',
        'The response chooses for Lucia with no reference to the week counts.',
        'A choice is made for Lucia using one week count but not the effect on the other goal.',
        'The response uses Lucia\'s week counts on both sides, noting that buying the headphones adds weeks to the bicycle, and states which tradeoff it prefers and why.',
      ),
    ],
    remediation:
      'When a learner divides in the wrong direction, mark $6.00 jumps along a number line to Lucia\'s goal and count the jumps aloud, so the week count is produced by counting before it is produced by dividing.',
    extension: 'Ask the learner what weekly amount would let Lucia reach the bicycle in exactly 8 weeks, and how they worked it out.',
  },
  {
    key: 'g4-u04-l02',
    authority: 'FIXED',
    character: 'Dario',
    objective:
      'Learners build a simulated savings plan across several weeks, measure the remaining gap to a goal, and confirm when the plan closes it exactly.',
    scenario:
      'Dario is an invented fourth grader saving $7.50 of simulated money a week toward a made-up $75.00 camping kit. He has been saving for 8 weeks. Every figure here is invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out where Dario\'s plan stands after 8 weeks at $7.50 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Dario saved after 8 weeks?', fixed: { expected: '$60.00', compute: scale(m(7.5), 8) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Measure the remaining distance to Dario\'s $75.00 kit, then work out how many more weeks at the same deposit will close it.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How far is Dario from the $75.00 kit after 8 weeks?', fixed: { expected: '$15.00', compute: diff(m(75.0), scale(m(7.5), 8)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many more whole weeks does that gap need?', fixed: { expected: '2', compute: reach(diff(m(75.0), scale(m(7.5), 8)), m(7.5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Dario spends $18.00 of the saved money on an unplanned invented repair at the end of week 8, then keeps saving.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left in Dario\'s plan right after the repair?', fixed: { expected: '$42.00', compute: diff(scale(m(7.5), 8), m(18.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks at $7.50 does it now take to reach $75.00?', fixed: { expected: '5', compute: reach(diff(m(75.0), diff(scale(m(7.5), 8), m(18.0))), m(7.5)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The repair cost more than money.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'The $18.00 repair added weeks to Dario\'s plan. How many, and what does that tell you about spending from a savings goal?' }] },
    ],
    rubric: [
      crit(
        'Tracking a plan through a setback',
        'The response reports Dario\'s new total without connecting it to the timeline.',
        'The delay is mentioned for Dario but not quantified from the week counts.',
        'The response names how many extra weeks Dario\'s repair cost and explains that spending from savings converts money into waiting time.',
      ),
    ],
    remediation:
      'If a learner recalculates from zero, keep the running total on a single line for Dario and apply the withdrawal to that line, so saving resumes from the reduced amount.',
    extension: 'Ask the learner what weekly deposit would put Dario back on his original finishing week despite the repair.',
  },
  {
    key: 'g4-u04-l03',
    authority: 'FIXED',
    character: 'Noor',
    objective:
      'Learners track an invented account through deposits, a withdrawal, and a monthly fee, and compare a fee-charging institution with a fee-free one.',
    scenario:
      'Noor is a made-up fourth grader following a pretend account at an invented bank. Two simulated deposits of $25.00 and $18.50 go in, a $12.25 withdrawal comes out, and the invented bank charges a $2.00 monthly fee. A made-up credit union charges no fee at all. This is a simulation, not a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Noor\'s two invented deposits.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Noor\'s two deposits come to?', fixed: { expected: '$43.50', compute: sum(m(25.0), m(18.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Take the $12.25 withdrawal out of the deposits, then apply the invented bank\'s $2.00 monthly fee to what is left.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the simulated account after the withdrawal?', fixed: { expected: '$31.25', compute: diff(sum(m(25.0), m(18.5)), m(12.25)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the simulated account after the $2.00 fee?', fixed: { expected: '$29.25', compute: diff(diff(sum(m(25.0), m(18.5)), m(12.25)), m(2.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Run the same deposits and withdrawal through the invented fee-free credit union, then look at six months of the bank\'s fee.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the credit-union balance be after the same activity?', fixed: { expected: '$31.25', compute: diff(sum(m(25.0), m(18.5)), m(12.25)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would six months of the invented bank\'s fee come to?', fixed: { expected: '$12.00', compute: scale(m(2.0), 6) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A two-dollar fee looked small on one statement.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What should Noor ask about any place that holds money, beyond whether it is safe?' }] },
    ],
    rubric: [
      crit(
        'Comparing places that hold money',
        'The response says all places that hold money are the same for Noor.',
        'The fee is noticed for Noor but no question for choosing an institution is offered.',
        'The response gives Noor a concrete question to ask, such as what fees apply and under what conditions, and connects it to the six-month fee total.',
      ),
    ],
    remediation:
      'When a learner applies the fee before the withdrawal, rewrite Noor\'s activity as a dated list and process one line at a time, so order of operations follows the order of events.',
    extension: 'Ask the learner how many months of the invented fee it would take to consume the smaller of Noor\'s two deposits, and to show the reasoning.',
    safetyNotes: ['This is a simulated account; never write a real account number or balance on this sheet.'],
  },
  {
    key: 'g4-u04-l04',
    authority: 'FIXED',
    character: 'Kofi',
    objective:
      'Learners apply a simple stated interest rate to invented savings for one and two periods, and compare the result with keeping the money outside an account.',
    scenario:
      'Kofi is an invented fourth grader studying a pretend savings account that pays 5% simple interest a year on the starting amount. He begins with an invented $80.00. Nothing here is a real account or a real rate.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 5% rate to Kofi\'s starting $80.00 for one simulated year.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does one simulated year pay?', fixed: { expected: '$4.00', compute: pct(m(80.0), 500) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add that interest to Kofi\'s starting amount, then work out a second year on the same simple basis, where interest is always figured on the original $80.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the simulated account after one year?', fixed: { expected: '$84.00', compute: sum(m(80.0), pct(m(80.0), 500)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the simulated account after two years?', fixed: { expected: '$88.00', compute: sum(m(80.0), pct(m(80.0), 500), pct(m(80.0), 500)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Kofi\'s cousin keeps the same invented $80.00 in a drawer for the two years instead.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in the drawer after two years?', fixed: { expected: '$80.00', compute: m(80.0) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the simulated account hold after two years?', fixed: { expected: '$8.00', compute: diff(sum(m(80.0), pct(m(80.0), 500), pct(m(80.0), 500)), m(80.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The money in the drawer did no work.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What is Kofi actually being paid for when a simulated account adds interest to his savings?' }] },
    ],
    rubric: [
      crit(
        'Explaining what interest pays for',
        'The response treats Kofi\'s interest as free money with no explanation.',
        'Interest is described for Kofi as a reward without saying what the institution gains.',
        'The response explains that Kofi is being paid for leaving his money with the institution, which can use it while it is there, and that this is why the drawer pays nothing.',
      ),
    ],
    remediation:
      'If a learner applies the rate to the growing balance, restate the rule for Kofi in writing, that simple interest is always figured on the original amount, and mark the original amount before each year is computed.',
    extension: 'Ask the learner how many simulated years of this rate it would take for Kofi\'s interest alone to reach $20.00, and to justify it.',
  },
  {
    key: 'g4-u04-l05',
    authority: 'JUDGMENT',
    character: 'Imani',
    objective:
      'Learners decide which pieces of money information are safe to share and which are not, and explain what makes the difference.',
    scenario:
      'Imani is an invented fourth grader filling in a pretend club sign-up sheet. The invented sheet asks for a nickname, a savings goal, a guardian card number, and a password used at home. This is a practice sheet and no real number is ever written on it.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Go through the four invented fields on Imani\'s sheet one at a time. Two are ordinary and two would give away something that protects the household. Sort them before deciding what she should do.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which of the four fields on Imani\'s sheet should be left blank, and what do those fields have in common?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Imani wants to join the club without handing over anything private. Write what she should do about the sheet and what she could say to the person collecting it.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Imani do with the sheet, and what should she say to whoever asks for the missing information?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'A form asking for something does not make it required.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is it worth pausing when any form asks for a number that unlocks money?' }],
      },
    ],
    rubric: [
      crit(
        'Sorting private from shareable information',
        'The response would have Imani fill in the card number or password.',
        'The right fields are left blank by Imani but no common feature is identified.',
        'The response leaves Imani\'s card number and password blank and identifies that both unlock access to money or accounts, unlike a nickname or a goal.',
      ),
      crit(
        'Acting on the decision',
        'Imani is left with no way to raise the problem with anyone.',
        'The response says Imani should refuse but offers nothing she could actually say.',
        'The response gives Imani wording she could use and routes the question to a guardian or trusted adult rather than to the club organiser alone.',
      ),
    ],
    lookFors: [
      'Identifies the card number and the password as the fields to leave blank.',
      'Names access to money or accounts as what those fields have in common.',
      'Supplies wording Imani could actually use.',
      'Involves a guardian or trusted adult in the decision.',
    ],
    remediation:
      'If a learner treats all four fields the same, ask for each field what someone could do with it if the sheet were lost, and sort by that answer.',
    extension: 'Ask the learner to redesign Imani\'s sign-up sheet so the club still gets what it needs without asking for anything private.',
    safetyNotes: ['Leave every field on this practice sheet blank or filled with invented information; never write a real card number or password.'],
  },
  {
    key: 'g4-u04-l06',
    authority: 'JUDGMENT',
    character: 'Esther',
    objective:
      'Learners identify who counts as a trusted adult for a money problem and what makes that person the right one to bring a worry to.',
    scenario:
      'Esther is a made-up fourth grader who noticed something odd in a pretend club money box: the invented record says $40.00 but the box holds less. She does not know who to tell, and she is worried about being blamed.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'List who Esther could tell in her invented situation: a classmate, the club leader, a guardian, or a stranger online. Weigh each one on whether they can actually help and whether they are safe to tell.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Who on Esther\'s list is the right person to tell first, and what makes them the right one?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what Esther should say. Keep it to what she actually saw, without accusing anyone, and short enough that she could say it out loud.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What exactly should Esther say, and why does sticking to what she saw protect everyone involved?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Esther is afraid of being blamed for noticing.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What would you say to Esther about her worry that reporting will get her into trouble?' }],
      },
    ],
    rubric: [
      crit(
        'Choosing a trusted adult',
        'The response sends Esther to a classmate or to someone online.',
        'An adult is chosen for Esther but no reason is given for that choice.',
        'The response chooses an adult with responsibility for Esther\'s club or household and explains that they can both act on the problem and keep her safe.',
      ),
      crit(
        'Reporting what was observed',
        'Esther\'s report names a culprit or invents details beyond what she saw.',
        'Esther reports the problem but mixes observation with guessing.',
        'The response has Esther describe only what she observed about the record and the box, leaving the explanation to the adult.',
      ),
    ],
    lookFors: [
      'Names an adult with actual responsibility rather than a peer.',
      'Keeps the report to observed facts about the invented money box.',
      'Avoids accusing any named person.',
      'Reassures Esther that reporting an observation is not an admission of fault.',
    ],
    remediation:
      'If a learner drafts an accusation, have them underline every sentence Esther could personally have seen and delete the rest before the report is finalised.',
    extension: 'Ask the learner to name a second trusted adult Esther could go to if the first is unavailable, and to say why a backup matters.',
  },
  {
    key: 'g4-u05-l01',
    authority: 'FIXED',
    character: 'Mina',
    objective:
      'Learners test an advertised saving against the advertisement\'s own invented prices and scale the gap across multiple purchases.',
    scenario:
      'Mina is an invented fourth grader reading a pretend flyer that promises: save $20.00 on every jacket. The flyer\'s own invented small print shows the jackets were $45.00 and are now $38.00. All figures are invented for checking.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Use the flyer\'s own two invented prices to find the real saving on one jacket.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the real saving on one jacket?', fixed: { expected: '$7.00', compute: diff(m(45.0), m(38.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Set the flyer\'s claimed $20.00 saving beside the saving you just found for Mina.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much bigger is the claimed saving than the real one?', fixed: { expected: '$13.00', compute: diff(m(20.0), diff(m(45.0), m(38.0))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does the flyer\'s claim compare with what its own prices show?',
            choices: ['The claim understates the saving', 'The claim matches the saving', 'The claim overstates the saving'],
            fixed: { expected: 'The claim overstates the saving', compute: sel(m(20.0), diff(m(45.0), m(38.0)), 'The claim understates the saving', 'The claim matches the saving', 'The claim overstates the saving') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Mina\'s invented family needs 3 jackets and the flyer promises its saving on every one.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the claimed saving add up to across 3 jackets?', fixed: { expected: '$60.00', compute: scale(m(20.0), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the real saving across 3 jackets?', fixed: { expected: '$21.00', compute: scale(diff(m(45.0), m(38.0)), 3) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The flyer contained both the claim and the evidence against it.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Everything Mina needed to check the claim was on the flyer itself. Why do advertisements still work?' }] },
    ],
    rubric: [
      crit(
        'Checking advertised claims',
        'The response accepts the flyer\'s headline for Mina without checking.',
        'The response says to check but does not say against what.',
        'The response explains that the headline is designed to be read instead of the prices, and that Mina should compute the before-and-after difference herself.',
      ),
    ],
    remediation:
      'When a learner accepts the headline, cover it and require the saving to be computed from the small print for Mina before the claim is revealed for comparison.',
    extension: 'Ask the learner what the sale price would have to be for the flyer\'s $20.00 claim to be honest, and to show the arithmetic.',
  },
  {
    key: 'g4-u05-l02',
    authority: 'JUDGMENT',
    character: 'Jonas',
    objective:
      'Learners identify specific persuasion techniques in invented advertisements and explain what each one is aimed at rather than whether the product is good.',
    scenario:
      'Jonas is a made-up fourth grader collecting three invented advertisements for a class display. One shows a crowd of happy children, one shouts that only 4 are left, and one is fronted by a made-up sports star. None of the products or ads is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Look at Jonas\'s three invented advertisements one at a time. Each one is trying to move a different feeling. Name the technique in each before saying whether the product might be any good.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Name the technique each of Jonas\'s three advertisements uses, and what feeling it aims at.' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Pick the advertisement from Jonas\'s set that you think would work best on someone your age, and explain the mechanics of why, without deciding whether the product is worth buying.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Which of Jonas\'s advertisements would work best on someone your age, and what exactly makes it effective?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'None of the three ads said much about the product itself.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What question could Jonas ask about any advertisement to get past the technique to the facts?' }],
      },
    ],
    rubric: [
      crit(
        'Identifying persuasion techniques',
        'The response judges Jonas\'s products rather than naming any technique.',
        'One technique is named across Jonas\'s three advertisements but the others are not.',
        'The response names a distinct technique for each of Jonas\'s advertisements, such as belonging, scarcity, and celebrity endorsement, and links each to a feeling.',
      ),
      crit(
        'Separating technique from product quality',
        'The response treats an effective advertisement as evidence of a good product.',
        'The two are separated for Jonas but without explaining why they are independent.',
        'The response states that Jonas\'s advertisements say nothing about product quality, and offers a question that asks for facts instead.',
      ),
    ],
    lookFors: [
      'Names three distinct techniques across the invented advertisements.',
      'Connects each technique to a feeling it targets.',
      'Keeps effectiveness separate from product quality.',
      'Offers a question that seeks checkable facts.',
    ],
    remediation:
      'If a learner rates the products, cover the product images entirely and have the learner describe only what each of Jonas\'s advertisements is doing to the viewer.',
    extension: 'Ask the learner to design a fourth advertisement for Jonas\'s display that uses no technique at all, and to say why it feels flat.',
  },
  {
    key: 'g4-u05-l03',
    authority: 'FIXED',
    character: 'Rina',
    objective:
      'Learners model an invented borrow-and-repay arrangement, track the balance owed over time, and find when the debt is cleared.',
    scenario:
      'Rina is an invented fourth grader who borrows $30.00 of simulated money from a pretend club fund and agrees to pay back $6.00 a week. No interest is charged in this arrangement. Everything is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out how long Rina\'s repayment takes at $6.00 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks until Rina has repaid the $30.00?', fixed: { expected: '5', compute: reach(m(30.0), m(6.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now stop partway through Rina\'s repayment, at the end of week 3, and work out both what she has paid and what she still owes.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Rina paid back after 3 weeks?', fixed: { expected: '$18.00', compute: scale(m(6.0), 3) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Rina still owe after 3 weeks?', fixed: { expected: '$12.00', compute: diff(m(30.0), scale(m(6.0), 3)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'In week 4 Rina can only pay $2.00 instead of $6.00, then returns to $6.00 a week afterwards.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Rina owe after the short week 4 payment?', fixed: { expected: '$10.00', compute: diff(diff(m(30.0), scale(m(6.0), 3)), m(2.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many more whole weeks at $6.00 does it take to clear that?', fixed: { expected: '2', compute: reach(diff(diff(m(30.0), scale(m(6.0), 3)), m(2.0)), m(6.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One short payment changed the finishing date.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Rina paid less in one week and it added a week to her repayment. What should she tell the club fund, and when?' }] },
    ],
    rubric: [
      crit(
        'Handling a repayment commitment',
        'The response ignores the promise Rina made to the fund.',
        'The response says Rina should say something but not what or when.',
        'The response has Rina tell the fund before the short payment rather than after, and explains that a borrower who communicates keeps the arrangement workable.',
      ),
    ],
    remediation:
      'When a learner loses track of the balance, keep a two-column ledger for Rina with paid and still owed, and update both columns for every week before answering anything.',
    extension: 'Ask the learner what weekly payment would let Rina clear the $30.00 in exactly 4 weeks, and to show the reasoning.',
  },
  {
    key: 'g4-u05-l04',
    authority: 'FIXED',
    character: 'Andre',
    objective:
      'Learners compute the interest cost of an invented loan, find the total repaid, and compare borrowing now with saving first.',
    scenario:
      'Andre is a made-up fourth grader looking at a pretend loan of $50.00 for a bicycle repair, at an invented 8% interest for the simulated year, repaid in 3 equal payments. Saving up first would take longer but cost no interest. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out the invented 8% interest on Andre\'s $50.00 loan for the simulated year.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the loan cost?', fixed: { expected: '$4.00', compute: pct(m(50.0), 800) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the interest to the amount borrowed to get what Andre repays in total, then split that across the 3 equal payments.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Andre repay in total?', fixed: { expected: '$54.00', compute: sum(m(50.0), pct(m(50.0), 800)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is each of the 3 equal payments?', fixed: { expected: '$18.00', compute: div(sum(m(50.0), pct(m(50.0), 800)), 3) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare that with Andre saving $10.00 a week and paying the $50.00 repair in cash later.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks of saving $10.00 would cover the $50.00 repair?', fixed: { expected: '5', compute: reach(m(50.0), m(10.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does borrowing cost Andre than saving first?', fixed: { expected: '$4.00', compute: diff(sum(m(50.0), pct(m(50.0), 800)), m(50.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Borrowing bought time and charged for it.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'When would the extra $4.00 be worth paying for Andre, and when would waiting the 5 weeks be the better call?' }] },
    ],
    rubric: [
      crit(
        'Weighing the cost of borrowing',
        'The response declares borrowing always wrong or always fine for Andre.',
        'One side is argued for Andre but no condition that would flip the decision is named.',
        'The response identifies what Andre gains by having the bicycle 5 weeks earlier, weighs it against the $4.00, and names a situation that would flip the decision either way.',
      ),
    ],
    remediation:
      'If a learner treats the payment amount as the cost, write Andre\'s borrowed amount, total repaid, and difference on three separate lines, so interest is isolated as its own figure.',
    extension: 'Ask the learner what interest rate would make Andre\'s loan cost exactly $2.00, and how they found it.',
  },
  {
    key: 'g4-u05-l05',
    authority: 'JUDGMENT',
    character: 'Selin',
    objective:
      'Learners recognise the pressure signals in an invented scam message and choose a response that does not engage with it.',
    scenario:
      'Selin is an invented fourth grader who receives a made-up message on a pretend game account: her prize expires in 10 minutes, she must not tell anyone, and she should send a code from a guardian\'s phone. The message is invented for practice, and no real code exists.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Read the invented message with Selin and pull out its parts: a deadline, a secrecy instruction, and a request for something private. Treat each as a signal rather than as an inconvenience.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What are the three warning signals in the message Selin received, and why is each one a signal?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Selin has 10 minutes according to the message. Write exactly what she should do in that time, including what she should not do.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Selin do about the message, and why does the deadline make no difference to the answer?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The message told her to keep it to herself.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is being told to keep something secret from a guardian, by itself, a reason to tell one?' }],
      },
    ],
    rubric: [
      crit(
        'Recognising pressure signals',
        'The response treats the deadline in Selin\'s message as a real constraint to work around.',
        'One signal is named for Selin but the secrecy instruction or the request is missed.',
        'The response names the deadline, the secrecy instruction, and the request for a private code as signals, and explains that urgency is a technique rather than a fact.',
      ),
      crit(
        'Choosing a non-engaging response',
        'The response has Selin reply, negotiate, or investigate the sender.',
        'Selin stops but no adult is involved and nothing is reported.',
        'The response has Selin stop, not reply, and show the message to a guardian or trusted adult, treating the expiry as irrelevant.',
      ),
    ],
    lookFors: [
      'Identifies all three pressure signals in the invented message.',
      'Rejects the deadline as a reason to act quickly.',
      'Involves a guardian or trusted adult.',
      'Never sends or types any code, real or invented.',
    ],
    remediation:
      'If a learner tries to verify the offer, ask what the message would gain from a real prize needing secrecy, and let the contradiction settle the question before any response is written.',
    extension: 'Ask the learner to rewrite Selin\'s message as it would look without the pressure, and to say why it would no longer work.',
    safetyNotes: ['Never send a code, password, or card number in response to any message; this scenario is invented for practice.'],
  },
  {
    key: 'g4-u05-l06',
    authority: 'FIXED',
    character: 'Beatriz',
    objective:
      'Learners apply a percentage share to an invented fundraising total and divide the remainder equally among invented causes.',
    scenario:
      'Beatriz is a made-up fourth grader whose pretend class raised $84.00 in simulated funds. The class agreed to send 10% to an invented emergency fund and split the rest equally among 3 made-up local causes.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Take the agreed 10% out of Beatriz\'s invented $84.00 total for the emergency fund.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much goes to the emergency fund?', fixed: { expected: '$8.40', compute: pct(m(84.0), 1000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find what remains after the emergency fund share, then split that remainder equally among the 3 invented causes.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left after the emergency fund?', fixed: { expected: '$75.60', compute: diff(m(84.0), pct(m(84.0), 1000)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does each of the 3 causes receive?', fixed: { expected: '$25.20', compute: div(diff(m(84.0), pct(m(84.0), 1000)), 3) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A late invented donation brings the total to $96.00, and the same two rules apply.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much now goes to the emergency fund?', fixed: { expected: '$9.60', compute: pct(m(96.0), 1000) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does each cause now receive?', fixed: { expected: '$28.80', compute: div(diff(m(96.0), pct(m(96.0), 1000)), 3) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Every share moved when the total moved.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Why did Beatriz\'s class write the giving plan as a percentage and a split rather than as fixed dollar amounts?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about proportional giving',
        'The response treats Beatriz\'s shares as arbitrary amounts.',
        'The response notices the shares changed but not why the rule made that automatic.',
        'The response explains that Beatriz\'s percentage-and-split rule adjusts itself to whatever is raised, so the plan does not need rewriting when the total changes.',
      ),
    ],
    remediation:
      'If a learner divides before taking the percentage, number the two rules for Beatriz on the page and require the first to be completed and boxed before the second is started.',
    extension: 'Ask the learner what total Beatriz\'s class would need to raise for each cause to receive exactly $30.00, and to show the reasoning.',
  },
  {
    key: 'g4-u06-l01',
    authority: 'FIXED',
    character: 'Ismail',
    objective:
      'Learners compare invented start-up costs across three pretend market ideas and test a production run against a fixed simulated budget.',
    scenario:
      'Ismail is an invented fourth grader choosing between three pretend market ideas with invented start-up costs of $18.00 for a printed card set, $24.50 for a plant stand, and $11.25 for beeswax wraps. His simulated start-up budget is $50.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Look across Ismail\'s three invented start-up costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the lowest start-up cost among Ismail\'s ideas?', fixed: { expected: '$11.25', compute: least(m(18.0), m(24.5), m(11.25)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find the spread between Ismail\'s dearest and cheapest ideas, then compare two of them head to head.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is the dearest start-up than the cheapest?', fixed: { expected: '$13.25', compute: diff(most(m(18.0), m(24.5), m(11.25)), least(m(18.0), m(24.5), m(11.25))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Between the card set and the plant stand, which costs less to start?',
            choices: ['The card set', 'The plant stand', 'They cost the same'],
            fixed: { expected: 'The card set', compute: sel(m(18.0), m(24.5), 'The card set', 'They cost the same', 'The plant stand') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Ismail picks the beeswax wraps and wants to run 4 separate batches, each costing the same start-up amount in materials.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 4 batches of wraps cost?', fixed: { expected: '$45.00', compute: scale(m(11.25), 4) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Ismail\'s $50.00 budget is left?', fixed: { expected: '$5.00', compute: diff(m(50.0), scale(m(11.25), 4)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cheapest idea was not automatically the right one.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What would Ismail need to know about customers before the lowest start-up cost becomes the best choice?' }] },
    ],
    rubric: [
      crit(
        'Choosing a venture on more than cost',
        'The response picks Ismail\'s cheapest idea with no other consideration.',
        'Demand is mentioned for Ismail but not tied to any of the three specific ideas.',
        'The response asks what Ismail\'s customers would actually buy and links that to whether the low start-up cost of the wraps translates into sales.',
      ),
    ],
    remediation:
      'If a learner treats the lowest cost as the answer, have them write next to each of Ismail\'s ideas who would buy it and why, before any comparison is made.',
    extension: 'Ask the learner how many plant stands Ismail could start inside the same $50.00 and what that means for his choice.',
  },
  {
    key: 'g4-u06-l02',
    authority: 'FIXED',
    character: 'Nadine',
    objective:
      'Learners build a unit cost from invented components, set a price above it, and compute revenue, cost, and profit across a production run.',
    scenario:
      'Nadine is a made-up fourth grader making pretend beeswax wraps for a simulated market. Each invented wrap uses $1.20 of cloth, $0.95 of wax, and $0.60 of cord. She sets a price of $4.50 and plans a run of 10.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Nadine\'s three invented component costs for a single wrap.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one wrap cost Nadine to make?', fixed: { expected: '$2.75', compute: sum(m(1.2), m(0.95), m(0.6)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare Nadine\'s $4.50 price with that unit cost, then scale both across the run of 10 wraps.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Nadine keep from one wrap after its materials?', fixed: { expected: '$1.75', compute: diff(m(4.5), sum(m(1.2), m(0.95), m(0.6))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the run of 10 wraps cost in materials?', fixed: { expected: '$27.50', compute: scale(sum(m(1.2), m(0.95), m(0.6)), 10) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Nadine sells all 10 wraps at $4.50 each.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much money comes in from the run?', fixed: { expected: '$45.00', compute: scale(m(4.5), 10) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Nadine\'s profit on the run?', fixed: { expected: '$17.50', compute: diff(scale(m(4.5), 10), scale(sum(m(1.2), m(0.95), m(0.6)), 10)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Only 7 of the 10 wraps actually sell.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Nadine paid for all 10 wraps but sold 7. Explain what happens to her profit and why the unsold wraps still cost her something.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about cost and unsold stock',
        'The response assumes Nadine\'s unsold wraps cost nothing.',
        'The response notices profit falls for Nadine but does not explain that materials were already paid for.',
        'The response explains that Nadine\'s materials for all 10 were spent regardless, so the 3 unsold wraps subtract from profit while contributing no revenue.',
      ),
    ],
    remediation:
      'When a learner nets price against cost only for sold items, lay out ten cost cards and seven revenue cards for Nadine so the mismatch is visible before the arithmetic.',
    extension: 'Ask the learner how many of Nadine\'s wraps must sell at $4.50 before the run breaks even, and to show the reasoning.',
  },
  {
    key: 'g4-u06-l03',
    authority: 'FIXED',
    character: 'Teo',
    objective:
      'Learners assemble an invented operating budget from several cost lines, check it against a simulated limit, and test the effect of an added cost.',
    scenario:
      'Teo is an invented fourth grader running a pretend market stall on a $60.00 simulated operating budget. His invented costs are $27.50 for supplies, an $8.00 table fee, and $4.25 for signs.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Teo\'s three invented operating costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Teo\'s operating costs come to?', fixed: { expected: '$39.75', compute: sum(m(27.5), m(8.0), m(4.25)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Check that total against Teo\'s $60.00 simulated budget, and say how much room the stall still has.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $60.00 budget is unspent?', fixed: { expected: '$20.25', compute: diff(m(60.0), sum(m(27.5), m(8.0), m(4.25))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does Teo\'s plan sit against the budget?',
            choices: ['Inside the budget', 'Exactly at the budget', 'Over the budget'],
            fixed: { expected: 'Inside the budget', compute: sel(sum(m(27.5), m(8.0), m(4.25)), m(60.0), 'Inside the budget', 'Exactly at the budget', 'Over the budget') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A required invented $22.00 permit is added to Teo\'s stall costs, with everything else unchanged.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the operating costs come to with the permit?', fixed: { expected: '$61.75', compute: sum(m(27.5), m(8.0), m(4.25), m(22.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far over the $60.00 budget is that?', fixed: { expected: '$1.75', compute: diff(sum(m(27.5), m(8.0), m(4.25), m(22.0)), m(60.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The permit is not optional.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Which of Teo\'s cost lines should he look at first to close the $1.75 gap, and why that one?' }] },
    ],
    rubric: [
      crit(
        'Adjusting an operating budget',
        'The response cuts the permit or the table fee without noting they are required.',
        'A cut is proposed for Teo without checking whether that line can move.',
        'The response targets a line Teo actually controls, such as supplies or signs, and explains why the permit and table fee cannot be cut.',
      ),
    ],
    remediation:
      'If a learner cuts a required cost, mark each of Teo\'s lines as required or discretionary before proposing any reduction.',
    extension: 'Ask the learner to rebuild Teo\'s budget with the permit included so the total lands under $60.00, showing each new line.',
  },
  {
    key: 'g4-u06-l04',
    authority: 'JUDGMENT',
    character: 'Wren',
    objective:
      'Learners judge whether invented product claims are honest, correct the ones that are not, and explain what a customer is owed.',
    scenario:
      'Wren is an invented fourth grader writing labels for a pretend market stall. The draft labels say the candles burn forever, the soap is approved by doctors, and the jam is made with fruit. Only the last claim is true, and none of the products is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Take Wren\'s three invented labels one at a time. One is impossible, one claims an approval nobody gave, and one is plain fact. Sort them before rewriting anything.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which of Wren\'s three claims is honest, and what is wrong with each of the other two?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Rewrite Wren\'s two problem labels so a customer could rely on them. Keep them appealing; a true label can still sell.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Write honest versions of Wren\'s two problem labels and explain what you changed in each.' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'One label claimed an approval that was never given.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is inventing an approval worse than simply exaggerating how good something is?' }],
      },
    ],
    rubric: [
      crit(
        'Telling customers the truth',
        'Wren\'s false claims are kept because they help the stall sell.',
        'The problems in Wren\'s labels are named but the rewrites still overstate.',
        'The response rewrites Wren\'s labels into claims a customer could check, and keeps them appealing without inventing properties or endorsements.',
      ),
      crit(
        'Reasoning about false endorsement',
        'The response treats the invented approval as harmless marketing.',
        'The approval claim is called wrong but no reason is given.',
        'The response explains that an invented approval borrows trust from people who never gave it, which misleads customers more deeply than a boast about quality.',
      ),
    ],
    lookFors: [
      'Identifies the fruit claim as the only honest label.',
      'Rewrites both problem labels into checkable statements.',
      'Distinguishes exaggeration from a fabricated endorsement.',
      'Keeps the rewritten labels appealing rather than dull.',
    ],
    remediation:
      'If a learner keeps a claim, ask what would happen if a customer tested it in front of Wren\'s stall, and revise from that answer.',
    extension: 'Ask the learner to add one true detail to Wren\'s jam label that would genuinely help a customer choose.',
  },
  {
    key: 'g4-u06-l05',
    authority: 'FIXED',
    character: 'Zoya',
    objective:
      'Learners rebuild an invented sales record from unit sales, quantify a recording error, and separate revenue from what is kept after costs.',
    scenario:
      'Zoya is a made-up fourth grader keeping records for a pretend market stall. She sold 8 invented items at $4.50 each, recorded total sales as $35.50, and had $22.00 of simulated costs.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Rebuild Zoya\'s sales total from the invented unit sales: 8 items at $4.50.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What were Zoya\'s actual total sales?', fixed: { expected: '$36.00', compute: scale(m(4.5), 8) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with the $35.50 Zoya recorded, then use the correct figure to work out what she keeps after her $22.00 of costs.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much is Zoya\'s record off?', fixed: { expected: '$0.50', compute: diff(scale(m(4.5), 8), m(35.5)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Zoya keep after costs, using the correct sales figure?', fixed: { expected: '$14.00', compute: diff(scale(m(4.5), 8), m(22.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Zoya sells 3 more invented items at the same price the next day, with no additional costs.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are Zoya\'s total sales across both days?', fixed: { expected: '$49.50', compute: scale(m(4.5), 11) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does she keep across both days after the $22.00 of costs?', fixed: { expected: '$27.50', compute: diff(scale(m(4.5), 11), m(22.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The record was wrong by less than a dollar.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Zoya\'s record was off by $0.50. Why does a stall keep a record at all if the totals can be rebuilt from the sales?' }] },
    ],
    rubric: [
      crit(
        'Purpose of record keeping',
        'The response treats Zoya\'s records as unnecessary paperwork.',
        'Records are called useful for Zoya but no specific use is named.',
        'The response names something Zoya\'s records make possible, such as catching an error, tracking which day sold better, or proving what was taken in.',
      ),
    ],
    remediation:
      'If a learner reports sales as what is kept, physically move the cost amount out of the sales pile for Zoya before the kept figure is written down.',
    extension: 'Ask the learner how many items at $4.50 Zoya must sell to keep $40.00 after the same costs, and to show the reasoning.',
  },
  {
    key: 'g4-u06-l06',
    authority: 'FIXED',
    character: 'Hakim',
    objective:
      'Learners split an invented profit into giving, saving, and keeping shares using a percentage and a fraction, and confirm the shares reconstruct the whole.',
    scenario:
      'Hakim is an invented fourth grader with $48.00 of pretend market profit. His invented plan gives 10% to a made-up community pantry, saves half of the original profit, and keeps whatever remains.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Take the 10% giving share out of Hakim\'s invented $48.00 profit.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Hakim give to the pantry?', fixed: { expected: '$4.80', compute: pct(m(48.0), 1000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out Hakim\'s saving share, which is half the original profit, then find what is left for him to keep.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Hakim save?', fixed: { expected: '$24.00', compute: div(m(48.0), 2) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left for Hakim to keep?', fixed: { expected: '$19.20', compute: diff(m(48.0), sum(pct(m(48.0), 1000), div(m(48.0), 2))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Check Hakim\'s plan by rebuilding the whole from its parts, then run the same rules on a larger invented profit of $60.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Hakim\'s three shares add back up to?', fixed: { expected: '$48.00', compute: sum(pct(m(48.0), 1000), div(m(48.0), 2), diff(m(48.0), sum(pct(m(48.0), 1000), div(m(48.0), 2)))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'On a $60.00 profit, how much would Hakim keep?', fixed: { expected: '$24.00', compute: diff(m(60.0), sum(pct(m(60.0), 1000), div(m(60.0), 2))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Hakim wrote his plan before he knew the profit.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Hakim decided the shares before the market day. What does deciding in advance protect him from, and when might he need to revisit the plan?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about a giving and saving plan',
        'The response treats Hakim\'s plan as arbitrary or says the shares do not matter.',
        'One benefit of deciding early is named for Hakim but no situation for revisiting is offered.',
        'The response explains that Hakim\'s advance plan protects the giving and saving shares from being spent in the moment, and names a change, such as a much smaller profit, that would justify revisiting it.',
      ),
    ],
    remediation:
      'If the shares do not reconstruct the whole, have the learner check each of Hakim\'s three shares against the original profit before adding them back together.',
    extension: 'Ask the learner to design a version of Hakim\'s plan where the giving share grows with larger profits, and to test it at $48.00 and $60.00.',
  },
]
