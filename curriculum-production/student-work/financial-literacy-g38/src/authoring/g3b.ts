import type { AuthoredLesson } from '../types.ts'
import { crit, diff, least, m, most, scale, sel, sum } from './dsl.ts'

/** Grade 3 Financial Literacy, units 4-6: saving, money tools and ads, and the pretend market capstone. */
export const G3B: readonly AuthoredLesson[] = [
  {
    key: 'g3-u04-l01',
    authority: 'FIXED',
    character: 'Fatima',
    objective:
      'Learners build a savings total by repeated weekly deposits, compare it against an invented goal price, and see what taking money back out does to the timeline.',
    scenario:
      'Fatima is a made-up third grader who puts $1.50 of pretend money into a jar every week toward an invented $6.00 kite. The jar, the weeks, and the kite are all imaginary practice figures.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Fatima has been saving for three weeks at $1.50 a week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in Fatima\'s jar after three weeks?', fixed: { expected: '$4.50', compute: scale(m(1.5), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now carry Fatima one week further, to four weeks of saving at the same $1.50, and hold the jar against the $6.00 kite price.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in the jar after four weeks?', fixed: { expected: '$6.00', compute: scale(m(1.5), 4) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'After four weeks, how does Fatima\'s jar compare with the $6.00 kite?',
            choices: ['Not enough yet', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'Exactly enough', compute: sel(scale(m(1.5), 4), m(6.0), 'Not enough yet', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Now change the story. At the end of week three, Fatima takes $2.00 out of the jar for a snack, then keeps saving $1.50 a week for two more weeks.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in the jar right after she takes the $2.00 out?', fixed: { expected: '$2.50', compute: diff(scale(m(1.5), 3), m(2.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in the jar after two more weeks of saving?', fixed: { expected: '$5.50', compute: sum(diff(scale(m(1.5), 3), m(2.0)), scale(m(1.5), 2)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Compare the two versions of Fatima\'s five weeks.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Fatima saved for five weeks in the second story but still had not reached the kite. What did the $2.00 snack cost her besides $2.00?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about saving over time',
        'The response repeats a jar total without connecting the snack to the delay.',
        'Fatima is said to have less money, but the extra waiting time is not named.',
        'The response explains that Fatima\'s $2.00 snack also cost her time, because the jar had to be refilled before the kite came back into reach.',
      ),
    ],
    remediation:
      'When a learner restarts the count after the withdrawal, write the jar total on a sticky note after every week and physically move the note down by $2.00 at the withdrawal, so saving continues from the reduced amount rather than from zero.',
    extension: 'Ask the learner how many more $1.50 weeks Fatima needs after the snack before the jar reaches $6.00, and to show the reasoning.',
  },
  {
    key: 'g3-u04-l02',
    authority: 'FIXED',
    character: 'Leo',
    objective:
      'Learners compare a short pretend savings goal with a longer one at the same weekly deposit, and see what spending on the near goal does to the far one.',
    scenario:
      'Leo is an invented third grader saving $2.00 of play money a week. He has two imaginary goals: a $6.00 sticker album he could have soon and a $12.00 pair of skates that would take much longer.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Leo saves $2.00 a week for three weeks toward the sticker album.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Leo saved after three weeks?', fixed: { expected: '$6.00', compute: scale(m(2.0), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Suppose Leo buys nothing and keeps saving the same $2.00 a week for five weeks, aiming at the $12.00 skates.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Leo saved after five weeks?', fixed: { expected: '$10.00', compute: scale(m(2.0), 5) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far is that from the $12.00 skates?', fixed: { expected: '$2.00', compute: diff(m(12.0), scale(m(2.0), 5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Now suppose Leo buys the $6.00 sticker album at the end of week three, then keeps saving $2.00 a week through week five.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Leo have at the end of week five in this version?', fixed: { expected: '$4.00', compute: diff(scale(m(2.0), 5), m(6.0)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'How does that compare with the $12.00 skates?',
            choices: ['Not enough yet', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'Not enough yet', compute: sel(diff(scale(m(2.0), 5), m(6.0)), m(12.0), 'Not enough yet', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both versions covered the same five weeks.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Leo saved the same amount each week in both stories. Why do the two versions end so far apart?' }] },
    ],
    rubric: [
      crit(
        'Short goals against long goals',
        'The response says Leo saved wrong, or gives no reason for the difference.',
        'Leo\'s album purchase is mentioned but not linked to the distance from the skates.',
        'The response explains that Leo\'s $6.00 album came out of the same savings, so buying the short goal pushed the $12.00 skates further away even though his weekly saving never changed.',
      ),
    ],
    remediation:
      'If a learner forgets to subtract the album, draw a savings bar for the five weeks and cut a $6.00 piece out of it at week three, so the purchase is removed from the same bar that has to reach the skates.',
    extension: 'Ask the learner how many extra weeks the album costs Leo on the way to the skates, and to justify the number of weeks.',
  },
  {
    key: 'g3-u04-l03',
    authority: 'FIXED',
    character: 'Nadia',
    objective:
      'Learners read an invented savings chart with uneven weekly deposits, build running totals, and compare the finished chart against a goal.',
    scenario:
      'Nadia is a made-up third grader whose pretend savings chart shows four uneven weeks: $2.00, then $1.50, then $2.50, then $3.00. Her invented goal is a $10.00 art set. The chart is a practice chart, not a real account.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Start with the first two rows of Nadia\'s chart.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Nadia saved after week two?', fixed: { expected: '$3.50', compute: sum(m(2.0), m(1.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now read all four rows of Nadia\'s chart, then find which single week was her strongest one.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total across all four weeks?', fixed: { expected: '$9.00', compute: sum(m(2.0), m(1.5), m(2.5), m(3.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What was Nadia\'s largest single week?', fixed: { expected: '$3.00', compute: most(m(2.0), m(1.5), m(2.5), m(3.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Nadia checks her four-week total against the $10.00 art set, then adds a fifth week of $2.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'After four weeks, how far is Nadia from the $10.00 art set?', fixed: { expected: '$1.00', compute: diff(m(10.0), sum(m(2.0), m(1.5), m(2.5), m(3.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'After the fifth week of $2.00, how much is she past the $10.00 goal?', fixed: { expected: '$1.00', compute: diff(sum(m(2.0), m(1.5), m(2.5), m(3.0), m(2.0)), m(10.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Nadia\'s weeks were not all the same size.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Nadia saved a different amount every week. What does her chart still let her see that a jar of mixed coins would not?' }] },
    ],
    rubric: [
      crit(
        'Reading a savings record',
        'The response describes Nadia\'s chart without naming anything it lets her see.',
        'The chart is called helpful for Nadia but no specific piece of information is named.',
        'The response names something Nadia can read straight off the chart, such as which week was strongest or how far the running total is from $10.00.',
      ),
    ],
    remediation:
      'When a learner loses the running total, have them write each week\'s new total in a second column beside the deposit, so every row carries both the week and the amount saved so far.',
    extension: 'Have the learner design a different four-week chart for Nadia that lands on exactly $10.00 and show the addition that proves it.',
  },
  {
    key: 'g3-u04-l04',
    authority: 'FIXED',
    character: 'Emeka',
    objective:
      'Learners see that a small steady deposit accumulates, measure the remaining gap to a goal, and test what raising the weekly amount does.',
    scenario:
      'Emeka is an invented third grader who saves $0.75 of pretend money a week, which feels far too small to matter. His imaginary goal is a $5.00 model rocket kit.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Follow Emeka\'s small deposits for four weeks at $0.75 each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Emeka saved after four weeks?', fixed: { expected: '$3.00', compute: scale(m(0.75), 4) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add one more week at the same $0.75, then measure how far Emeka still is from the $5.00 kit.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Emeka saved after five weeks?', fixed: { expected: '$3.75', compute: scale(m(0.75), 5) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far is Emeka from the $5.00 kit after five weeks?', fixed: { expected: '$1.25', compute: diff(m(5.0), scale(m(0.75), 5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Emeka doubles his deposit to $1.50 a week for the next two weeks, on top of the $3.75 he already has.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Emeka have after those two bigger weeks?', fixed: { expected: '$6.75', compute: sum(scale(m(0.75), 5), scale(m(1.5), 2)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'How does that compare with the $5.00 kit?',
            choices: ['Not enough yet', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'More than enough', compute: sel(sum(scale(m(0.75), 5), scale(m(1.5), 2)), m(5.0), 'Not enough yet', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Seventy-five cents did not look like much at the start.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Emeka almost gave up because $0.75 felt too small. What do his weekly totals show about small amounts that keep repeating?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about steady saving',
        'The response agrees that Emeka\'s $0.75 is too small to bother with, ignoring the totals.',
        'Emeka is said to be making progress but no total from the task is used as evidence.',
        'The response uses Emeka\'s running totals to show that a small repeated amount reaches a real goal, and notes that repetition, not size, did the work.',
      ),
    ],
    remediation:
      'If a learner cannot see the accumulation, stack seventy-five-cent coin groups in a column one week at a time and mark the $5.00 line on the wall of the stack, so growth toward the line is watched rather than calculated.',
    extension: 'Ask the learner how many $0.75 weeks alone would have reached $5.00 without the doubling, and to explain how they counted.',
  },
  {
    key: 'g3-u04-l05',
    authority: 'JUDGMENT',
    character: 'Sofia',
    objective:
      'Learners describe what waiting for a savings goal actually feels like and choose a strategy for staying with a goal, without treating the difficulty as a personal failing.',
    scenario:
      'Sofia is a made-up third grader four weeks into saving for an invented $9.00 board game. Her pretend jar is over halfway full, a friend just bought the same game, and she is tired of waiting. Everything here is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Talk through Sofia\'s week four. The jar is more than half full, the goal has not moved, and the waiting feels harder now than it did in week one. Describe the feeling before deciding anything about it.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Why does waiting feel harder for Sofia in week four than it did in week one?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Sofia wants to keep going but needs something concrete to help. Write one strategy she could actually use this week, and say what makes it likely to work for her rather than just sounding good.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What is one thing Sofia could do this week to make waiting easier, and why would it help?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Sofia\'s friend already has the game.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What would you say to Sofia about her friend already having the game?' }],
      },
    ],
    rubric: [
      crit(
        'Naming the difficulty honestly',
        'The response tells Sofia that waiting is easy or that wanting the game is childish.',
        'Sofia\'s frustration is acknowledged but not connected to anything specific about week four.',
        'The response names something real about Sofia\'s week four, such as the goal being close enough to see but not yet reachable, and treats the difficulty as normal.',
      ),
      crit(
        'Offering a usable strategy',
        'No strategy is offered to Sofia, or the advice is only to try harder.',
        'A strategy is named for Sofia but nothing is said about why it would help her keep going.',
        'A specific, doable strategy is offered to Sofia, such as marking the jar or setting a smaller checkpoint, with a reason tied to how it makes progress visible.',
      ),
    ],
    lookFors: [
      'Treats Sofia\'s impatience as ordinary rather than as a character flaw.',
      'Offers at least one concrete strategy she could use inside a single week.',
      'Does not compare Sofia unfavourably with her friend or with any real child.',
      'Keeps the response about Sofia\'s own goal rather than about what other families can afford.',
    ],
    remediation:
      'When a learner offers only "be patient", ask what would let Sofia see progress between now and the goal, and take one concrete idea before any advice is written down.',
    extension: 'Ask the learner to design a checkpoint reward for Sofia that does not spend any of the jar, and explain why it does not slow the goal.',
  },
  {
    key: 'g3-u04-l06',
    authority: 'FIXED',
    character: 'Marcus',
    objective:
      'Learners work out what is left after a savings goal is reached and spent, then measure the distance to a fresh goal and the weeks needed to close it.',
    scenario:
      'Marcus is an imaginary third grader who has reached his pretend $8.00 goal and bought an invented telescope kit priced at $6.50. He now wants an invented $5.00 star map and can save $1.00 of play money a week.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Marcus spends $6.50 of his $8.00 on the telescope kit.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Marcus have left after the telescope kit?', fixed: { expected: '$1.50', compute: diff(m(8.0), m(6.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Marcus points what is left toward the new $5.00 star map, and checks how far away that goal is before saving another week.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Marcus need for the $5.00 star map?', fixed: { expected: '$3.50', compute: diff(m(5.0), diff(m(8.0), m(6.5))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Right now, how does what Marcus has compare with the star map?',
            choices: ['Not enough yet', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'Not enough yet', compute: sel(diff(m(8.0), m(6.5)), m(5.0), 'Not enough yet', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Marcus saves $1.00 a week for the next four weeks on top of what he has.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Marcus have after those four weeks?', fixed: { expected: '$5.50', compute: sum(diff(m(8.0), m(6.5)), scale(m(1.0), 4)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is that past the $5.00 star map?', fixed: { expected: '$0.50', compute: diff(sum(diff(m(8.0), m(6.5)), scale(m(1.0), 4)), m(5.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Marcus did not start his second goal from zero.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Reaching one goal left Marcus with $1.50. How did that change the start of his next goal?' }] },
    ],
    rubric: [
      crit(
        'Carrying savings into a next goal',
        'The response treats Marcus as starting the star map from nothing.',
        'The leftover $1.50 is noticed for Marcus but its effect on the new goal is not stated.',
        'The response explains that Marcus\'s $1.50 leftover became the head start on the star map, so fewer weeks were needed than if he had emptied the jar.',
      ),
    ],
    remediation:
      'If a learner restarts at zero, keep the leftover coins physically on the table when the telescope card is removed, so the next goal visibly begins with money already present.',
    extension: 'Ask the learner what Marcus should do with the $0.50 he ends up over the goal, and to give a reason for the choice.',
  },
  {
    key: 'g3-u05-l01',
    authority: 'FIXED',
    character: 'Yusuf',
    objective:
      'Learners work out change from a pretend bill, then assemble a payment from mixed play coins and test whether the assembled payment covers the price.',
    scenario:
      'Yusuf is a made-up third grader at a pretend school store where a notebook set costs $4.35. He has one play $5.00 bill, three play $1.00 bills, and a handful of toy coins. Nothing here is real money.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Yusuf pays for the $4.35 notebook set with the play $5.00 bill.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much change should Yusuf get back?', fixed: { expected: '$0.65', compute: diff(m(5.0), m(4.35)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now Yusuf tries to pay without the big bill, using three play $1.00 bills and five play quarters at $0.25 each. Build the payment before comparing it to the price.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Yusuf\'s coin-and-bill payment worth?', fixed: { expected: '$4.25', compute: sum(scale(m(1.0), 3), scale(m(0.25), 5)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Does that payment cover the $4.35 price?',
            choices: ['Not enough', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'Not enough', compute: sel(sum(scale(m(1.0), 3), scale(m(0.25), 5)), m(4.35), 'Not enough', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Yusuf adds two play dimes at $0.10 each to the payment he already built.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the payment worth now?', fixed: { expected: '$4.45', compute: sum(scale(m(1.0), 3), scale(m(0.25), 5), scale(m(0.1), 2)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much change comes back from that payment?', fixed: { expected: '$0.10', compute: diff(sum(scale(m(1.0), 3), scale(m(0.25), 5), scale(m(0.1), 2)), m(4.35)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Yusuf paid the same price two different ways.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Yusuf paid $4.35 with a bill and with coins. What stayed the same about the two payments, and what changed?' }] },
    ],
    rubric: [
      crit(
        'Understanding money tools',
        'The response says one of Yusuf\'s payments was worth more than the other.',
        'The response says both payments worked for Yusuf without naming what differed.',
        'The response states that the $4.35 price and Yusuf\'s obligation stayed the same while the form of the payment and the change back differed.',
      ),
    ],
    remediation:
      'When a learner counts mixed coins by number rather than value, sort Yusuf\'s payment into piles of one coin type and count each pile in its own skip-count before combining the piles.',
    extension: 'Ask the learner to build a third payment for Yusuf that covers $4.35 with the fewest play coins possible, and to explain the choice.',
  },
  {
    key: 'g3-u05-l02',
    authority: 'JUDGMENT',
    character: 'Amara',
    objective:
      'Learners decide what money information is safe to share in an invented online game and identify who to bring a request to instead of answering it.',
    scenario:
      'Amara is an invented third grader playing a pretend online game. A made-up in-game character asks her to type the long number from a family card so she can get a free pet. Nothing in this scenario is a real account, and no real number is ever typed anywhere.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Read the invented in-game message with Amara. It offers a prize, it is friendly, and it asks for a number that belongs to her family. Sort what is being asked for before deciding what she should do.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What exactly is the invented game character asking Amara for, and who does that information really belong to?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Amara has to answer the invented character. Write what she should do, and say what makes the friendly tone of the message unimportant to that decision.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Amara do about the request, and why does it not matter that the message sounded nice?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Some information is fine to share and some is not.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Name one money thing that is fine to talk about at school and one that stays inside the family.' }],
      },
    ],
    rubric: [
      crit(
        'Protecting private money information',
        'The response has Amara type the number, or treats the prize as worth the risk.',
        'The response says Amara should refuse but gives no reason and names no adult.',
        'The response has Amara refuse, keeps the family number private, and brings the invented message to a trusted adult rather than answering it alone.',
      ),
      crit(
        'Sorting shareable from private',
        'The response treats all money talk as secret, or all of it as fine to share.',
        'Amara\'s example is given on only one side of the line.',
        'The response gives one thing Amara could safely discuss, such as saving for a goal, and one that stays private, such as card or account numbers.',
      ),
    ],
    lookFors: [
      'Refuses the invented request outright rather than negotiating with it.',
      'Names a trusted adult as the next step for Amara.',
      'Identifies the requested number as belonging to the family, not to Amara.',
      'Distinguishes a safe topic from private account information.',
    ],
    remediation:
      'If a learner focuses on whether the prize is real, set the prize aside entirely and ask only who owns the number being requested, so the decision rests on ownership rather than on the offer.',
    extension: 'Ask the learner to write the exact words Amara could use to end the conversation and go find an adult.',
    safetyNotes: ['Never type a real card, account, or password anywhere in this task; the scenario is invented and needs no real number.'],
  },
  {
    key: 'g3-u05-l03',
    authority: 'FIXED',
    character: 'Tomas',
    objective:
      'Learners compute the real size of an advertised saving and test what happens to a pretend budget when an advertisement persuades a character to buy more than planned.',
    scenario:
      'Tomas is a made-up third grader who sees an invented poster shouting that a toy usually priced at $5.00 is on sale for $3.00 today only. He has $5.00 of pretend money and did not plan to buy a toy at all.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compare the invented sale price with the invented regular price.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much lower is the sale price than the regular price?', fixed: { expected: '$2.00', compute: diff(m(5.0), m(3.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'The poster tells Tomas to grab two while the sale lasts. Work out what two would cost him, and compare that with the $5.00 he actually brought.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would two sale toys cost Tomas?', fixed: { expected: '$6.00', compute: scale(m(3.0), 2) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does that compare with the $5.00 Tomas has?',
            choices: ['Less than Tomas has', 'Exactly what Tomas has', 'More than Tomas has'],
            fixed: { expected: 'More than Tomas has', compute: sel(scale(m(3.0), 2), m(5.0), 'Less than Tomas has', 'Exactly what Tomas has', 'More than Tomas has') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare two endings: Tomas buys one sale toy, or Tomas walks past the poster and buys nothing.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would Tomas have left after buying one sale toy?', fixed: { expected: '$2.00', compute: diff(m(5.0), m(3.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more would he have left by walking past instead?', fixed: { expected: '$3.00', compute: diff(m(5.0), diff(m(5.0), m(3.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Tomas came in without a toy on his list.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'The sale is real, and Tomas still might not want it. What is the ad trying to make him feel?' }] },
    ],
    rubric: [
      crit(
        'Seeing what an advertisement does',
        'The response says the sale proves Tomas should buy the toy.',
        'The response says the ad is persuading Tomas but does not name the feeling it aims at.',
        'The response names a feeling the poster aims at Tomas, such as hurry or fear of missing out, and separates that from whether he wanted a toy at all.',
      ),
    ],
    remediation:
      'When a learner treats any discount as a reason to buy, cover the sale sign and ask what Tomas came in for, so the decision starts from his plan rather than from the poster.',
    extension: 'Have the learner rewrite the poster so it gives Tomas the same facts without the hurry, and explain what they removed.',
  },
  {
    key: 'g3-u05-l04',
    authority: 'FIXED',
    character: 'Bea',
    objective:
      'Learners compare an advertised weekly payment plan against a single invented price and find which way of paying costs more in total.',
    scenario:
      'Bea is an invented third grader who sees a made-up advertisement for a craft kit: pay only $2.00 a week for 5 weeks. The same kit sits on the shelf with an $8.50 price tag. All prices are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out what the advertised weekly plan adds up to across all 5 weeks.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the $2.00-a-week plan cost Bea in total?', fixed: { expected: '$10.00', compute: scale(m(2.0), 5) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Set the finished plan total beside the $8.50 shelf tag for the very same kit.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the weekly plan cost than the shelf price?', fixed: { expected: '$1.50', compute: diff(scale(m(2.0), 5), m(8.5)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which way of paying costs Bea less overall?',
            choices: ['Paying $8.50 at once', 'Paying $2.00 a week', 'They cost the same'],
            fixed: { expected: 'Paying $8.50 at once', compute: sel(m(8.5), scale(m(2.0), 5), 'Paying $8.50 at once', 'They cost the same', 'Paying $2.00 a week') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A second invented advertisement offers the same kit at $1.50 a week for 5 weeks.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the second plan cost in total?', fixed: { expected: '$7.50', compute: scale(m(1.5), 5) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that than the $8.50 shelf price?', fixed: { expected: '$1.00', compute: diff(m(8.5), scale(m(1.5), 5)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One weekly plan cost more than the tag and one cost less.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Both advertisements showed a small weekly number. What does Bea have to do before she can tell which is cheaper?' }] },
    ],
    rubric: [
      crit(
        'Checking an advertised claim',
        'The response picks a plan for Bea by which weekly number is smaller.',
        'The response says Bea should add it up but does not say what the total is compared against.',
        'The response says Bea has to multiply the weekly amount across all the weeks and compare that total with the shelf price before deciding.',
      ),
    ],
    remediation:
      'If a learner compares $2.00 with $8.50 directly, lay five weekly cards in a row for Bea and total them aloud before the shelf tag is turned face up.',
    extension: 'Ask the learner what weekly amount over five weeks would exactly match the $8.50 shelf price, and how they know.',
  },
  {
    key: 'g3-u05-l05',
    authority: 'FIXED',
    character: 'Rafi',
    objective:
      'Learners test an advertised savings claim against the actual invented prices, measure the gap between claim and reality, and scale that gap across several purchases.',
    scenario:
      'Rafi is a made-up third grader reading an invented flyer that promises: save $5.00 on every puzzle. The flyer\'s own small print shows the puzzles were $4.00 and are now $3.00. All figures are invented for this check.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Use the invented flyer\'s own two prices to find the real saving.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the real saving on one puzzle?', fixed: { expected: '$1.00', compute: diff(m(4.0), m(3.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Put the flyer\'s claimed $5.00 saving beside the saving you just computed for Rafi.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much bigger is the claimed saving than the real one?', fixed: { expected: '$4.00', compute: diff(m(5.0), diff(m(4.0), m(3.0))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does the flyer\'s claim compare with what the prices show?',
            choices: ['The claim is smaller than the real saving', 'The claim matches the real saving', 'The claim is bigger than the real saving'],
            fixed: { expected: 'The claim is bigger than the real saving', compute: sel(m(5.0), diff(m(4.0), m(3.0)), 'The claim is smaller than the real saving', 'The claim matches the real saving', 'The claim is bigger than the real saving') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Rafi\'s pretend club wants 3 puzzles, and the flyer promises its $5.00 saving on every one.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What saving would the flyer\'s claim add up to across 3 puzzles?', fixed: { expected: '$15.00', compute: scale(m(5.0), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the real saving across 3 puzzles?', fixed: { expected: '$3.00', compute: scale(diff(m(4.0), m(3.0)), 3) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The flyer\'s own prices disagreed with the flyer\'s own headline.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What question should Rafi ask before believing a number printed in big letters?' }] },
    ],
    rubric: [
      crit(
        'Asking a checking question',
        'The response accepts the flyer\'s headline for Rafi without any question.',
        'A question is offered but it does not send Rafi to the actual prices.',
        'The response gives Rafi a checking question that points at the two real prices, such as asking what it cost before and what it costs now.',
      ),
    ],
    remediation:
      'When a learner trusts the headline, cover the big print entirely and have the learner compute the saving from the small print first, then uncover the claim for comparison.',
    extension: 'Ask the learner to write an honest headline for Rafi\'s flyer using the real numbers, and to say why the honest version is less exciting.',
  },
  {
    key: 'g3-u05-l06',
    authority: 'JUDGMENT',
    character: 'Ines',
    objective:
      'Learners decide who to tell when something about money feels like a trick, and practise reporting without blaming themselves.',
    scenario:
      'Ines is an invented third grader who nearly typed a family number into a made-up website that promised free game coins. She stopped, but she is embarrassed and thinking about saying nothing. No real number was ever entered.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Walk through what happened to Ines in order: an offer arrived, it asked for something private, and she stopped before answering. Separate what she did from how she feels about it.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What did Ines actually do right in this story?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Ines is deciding whether to tell anyone. Write who she should tell and what she should say, keeping it short enough that she could actually say it out loud.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Who should Ines tell, and what words could she use?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Ines feels embarrassed even though she stopped in time.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What would you say to Ines about feeling embarrassed?' }],
      },
    ],
    rubric: [
      crit(
        'Reporting to a trusted adult',
        'The response tells Ines to keep it quiet or to handle the website herself.',
        'The response says Ines should tell someone but names no particular kind of person.',
        'The response names a trusted adult for Ines, such as a parent, guardian, or teacher, and gives words she could actually say.',
      ),
      crit(
        'Responding without blame',
        'The response blames Ines for nearly falling for the invented trick.',
        'The response reassures Ines but does not credit what she did well.',
        'The response tells Ines that noticing and stopping was the right move, and that telling an adult is not an admission of doing something wrong.',
      ),
    ],
    lookFors: [
      'Names a trusted adult rather than a friend or a website.',
      'Supplies words short enough for a third grader to say aloud.',
      'Credits Ines for stopping instead of focusing on the near-miss.',
      'Does not suggest confronting or replying to the invented website.',
    ],
    remediation:
      'If a learner focuses on punishment, retell the story stopping at the moment Ines closed the page, and ask what a trusted adult would most want to know about that moment.',
    extension: 'Have the learner list two different trusted adults Ines could tell if the first one is not available, and explain why having two matters.',
  },
  {
    key: 'g3-u06-l01',
    authority: 'FIXED',
    character: 'Kai',
    objective:
      'Learners compare the invented start-up supply costs of three pretend market products and test the cheapest option against a fixed pretend budget.',
    scenario:
      'Kai is a made-up third grader choosing a product for a pretend classroom market. Three invented ideas have supply costs of $2.00 for a card, $3.50 for a painted rock, and $1.25 for a friendship bracelet. His pretend supply budget is $6.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Look across Kai\'s three invented supply costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'Which of Kai\'s three products costs the least to make one of?', fixed: { expected: '$1.25', compute: least(m(2.0), m(3.5), m(1.25)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Kai wants to know how far apart his cheapest and most expensive ideas are, and which of two ideas he should rule out first.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the most expensive product cost to make than the cheapest?', fixed: { expected: '$2.25', compute: diff(most(m(2.0), m(3.5), m(1.25)), least(m(2.0), m(3.5), m(1.25))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Between the card and the painted rock, which costs Kai less to make?',
            choices: ['The card', 'The painted rock', 'They cost the same'],
            fixed: { expected: 'The card', compute: sel(m(2.0), m(3.5), 'The card', 'They cost the same', 'The painted rock') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Kai picks the bracelet and plans to make 4 of them with his $6.00 supply budget.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do supplies for 4 bracelets cost?', fixed: { expected: '$5.00', compute: scale(m(1.25), 4) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Kai\'s $6.00 supply budget is left?', fixed: { expected: '$1.00', compute: diff(m(6.0), scale(m(1.25), 4)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Cheapest to make is not automatically the best idea.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Besides supply cost, name one thing Kai should think about before choosing his market product.' }] },
    ],
    rubric: [
      crit(
        'Choosing a product for more than price',
        'The response repeats one of Kai\'s supply costs instead of naming another factor.',
        'A factor is named for Kai but it could apply to any product at all.',
        'The response names a concrete factor for Kai\'s market, such as whether classmates would want a bracelet or how long each one takes to make.',
      ),
    ],
    remediation:
      'When a learner picks by the smallest number alone, ask them to state what Kai gets for each cost, so the comparison weighs the product as well as the price.',
    extension: 'Have the learner work out how many painted rocks Kai could make inside the same $6.00 budget and what that means for his choice.',
  },
  {
    key: 'g3-u06-l02',
    authority: 'FIXED',
    character: 'Lila',
    objective:
      'Learners add per-item supply costs into a cost for one unit, scale it across a production run, and check the run against a pretend budget.',
    scenario:
      'Lila is an invented third grader making pretend friendship bracelets for a classroom market. Each bracelet uses $0.40 of string, $0.85 of beads, and a $0.25 clasp. Her invented supply budget is $8.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add the three invented supply pieces for a single one of Lila\'s bracelets.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one bracelet cost Lila to make?', fixed: { expected: '$1.50', compute: sum(m(0.4), m(0.85), m(0.25)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Lila plans a run of 5 bracelets, all identical, then checks the run against her $8.00 supply budget.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do supplies for 5 bracelets cost?', fixed: { expected: '$7.50', compute: scale(sum(m(0.4), m(0.85), m(0.25)), 5) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Lila\'s $8.00 budget is left after that run?', fixed: { expected: '$0.50', compute: diff(m(8.0), scale(sum(m(0.4), m(0.85), m(0.25)), 5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A classmate asks Lila for a sixth bracelet, made exactly the same way.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would supplies for all 6 bracelets cost?', fixed: { expected: '$9.00', compute: sum(scale(sum(m(0.4), m(0.85), m(0.25)), 5), sum(m(0.4), m(0.85), m(0.25))) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'Does the sixth bracelet fit inside Lila\'s $8.00 budget?',
            choices: ['It fits', 'It comes out exactly even', 'It does not fit'],
            fixed: { expected: 'It does not fit', compute: sel(sum(scale(sum(m(0.4), m(0.85), m(0.25)), 5), sum(m(0.4), m(0.85), m(0.25))), m(8.0), 'It fits', 'It comes out exactly even', 'It does not fit') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The sixth bracelet cost the same as the first five each did.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Lila had $0.50 left and one more bracelet cost $1.50. What does she have to change to say yes to her classmate?' }] },
    ],
    rubric: [
      crit(
        'Planning production inside a budget',
        'The response tells Lila to make the bracelet with no change to the plan or budget.',
        'A change is suggested for Lila but not measured against the $1.00 she is short.',
        'The response names a specific change for Lila, such as adding a dollar to the supply budget or using cheaper beads, and ties it to the $1.00 gap.',
      ),
    ],
    remediation:
      'If a learner multiplies only one supply line, build one full bracelet cost on a card first and copy that card five times, so the run scales the whole unit cost rather than a single ingredient.',
    extension: 'Ask the learner which single supply Lila could change, and by how much, to fit six bracelets inside $8.00.',
  },
  {
    key: 'g3-u06-l03',
    authority: 'FIXED',
    character: 'Nico',
    objective:
      'Learners set a pretend price above unit cost, compute profit per item and across a sales run, and see how lowering the price changes the profit.',
    scenario:
      'Nico is a made-up third grader selling invented paper flowers at a pretend market. Each flower costs him $1.50 in supplies and he sets a price of $2.50. He expects to sell 4 flowers. Every figure is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compare Nico\'s invented price with his invented cost for one flower.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Nico keep from one flower after paying for its supplies?', fixed: { expected: '$1.00', compute: diff(m(2.5), m(1.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now run Nico\'s whole day: 4 flowers sold at $2.50, with supplies of $1.50 for each of the 4.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much money comes in from selling 4 flowers?', fixed: { expected: '$10.00', compute: scale(m(2.5), 4) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What did supplies for those 4 flowers cost?', fixed: { expected: '$6.00', compute: scale(m(1.5), 4) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Nico wonders whether a lower price of $2.00 would still be worth it, assuming he still sells exactly 4 flowers.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Nico keep from all 4 flowers at the $2.50 price?', fixed: { expected: '$4.00', compute: diff(scale(m(2.5), 4), scale(m(1.5), 4)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would he keep from all 4 flowers at the $2.00 price?', fixed: { expected: '$2.00', compute: diff(scale(m(2.0), 4), scale(m(1.5), 4)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The lower price halved what Nico kept.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Dropping the price by $0.50 cut Nico\'s keep-money in half. Why might he still consider it?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about price and profit',
        'The response says the lower price is simply wrong for Nico, with no reason.',
        'A reason is offered for Nico but it does not involve customers or the number sold.',
        'The response explains that a lower price might let Nico sell to more classmates, and that more sales could make up for keeping less on each flower.',
      ),
    ],
    remediation:
      'When a learner forgets to subtract supplies, write the money-in and the money-out as two separate rows for Nico and require both rows to be filled before any keep-money is written.',
    extension: 'Ask the learner what price Nico would need so that 4 flowers leave him with exactly $6.00 after supplies, and to show the reasoning.',
  },
  {
    key: 'g3-u06-l04',
    authority: 'JUDGMENT',
    character: 'Ruby',
    objective:
      'Learners judge whether an invented market sign tells customers the truth and rewrite a claim that overstates what a product does.',
    scenario:
      'Ruby is an invented third grader making a sign for her pretend market stall. Her draft sign says her bookmarks are unbreakable and the best in the whole school. The bookmarks are made of paper. This is a practice stall.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Read Ruby\'s draft sign line by line. One claim is about what the bookmark is made to do, and one is about how it compares with everyone else\'s. Decide which parts a customer could check.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which claim on Ruby\'s sign could a customer check, and which one could not be checked?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Rewrite Ruby\'s sign so every line is something she could stand behind if a customer asked. Keep it appealing; honest signs still sell.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Write an honest version of Ruby\'s sign and explain what you changed and why.' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'A customer buys a paper bookmark believing it cannot break.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What happens to that customer\'s trust in Ruby\'s stall the next week?' }],
      },
    ],
    rubric: [
      crit(
        'Telling customers the truth',
        'Ruby\'s exaggerated claims are kept because they help sales.',
        'The response says Ruby\'s sign is exaggerated but does not fix the claim.',
        'The response replaces Ruby\'s unbreakable claim with something true about paper bookmarks and keeps the sign appealing without overstating.',
      ),
      crit(
        'Reasoning about trust',
        'The response treats the broken promise as unimportant to Ruby\'s stall.',
        'Trust is mentioned for Ruby but not connected to what customers would do next.',
        'The response explains that a customer who finds Ruby\'s claim false is unlikely to come back, so an honest sign protects future sales.',
      ),
    ],
    lookFors: [
      'Identifies the unbreakable claim as the one a customer can test and disprove.',
      'Produces a rewritten sign that stays appealing without a false claim.',
      'Connects honesty to whether customers return to Ruby\'s stall.',
      'Does not suggest hiding the material the bookmarks are made from.',
    ],
    remediation:
      'If a learner keeps the exaggeration, hand them a paper bookmark and ask them to test the claim, then ask what the sign should say about what actually happened.',
    extension: 'Ask the learner to add one honest sentence to Ruby\'s sign that would genuinely help a customer decide, such as what the bookmark is good for.',
  },
  {
    key: 'g3-u06-l05',
    authority: 'FIXED',
    character: 'Halima',
    objective:
      'Learners total an invented sales record, find the size of a recording error, and separate money taken in from money kept after costs.',
    scenario:
      'Halima is a made-up third grader keeping the record for her pretend market stall. Four invented sales came in at $2.50, $2.50, $3.00, and $1.75, and her supplies cost $5.00. She wrote $9.50 as her sales total.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Halima\'s four invented sales yourself before checking her written total.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the correct total of Halima\'s four sales?', fixed: { expected: '$9.75', compute: sum(m(2.5), m(2.5), m(3.0), m(1.75)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Halima recorded $9.50. Compare that with your total, then use the correct figure to work out what she keeps after her $5.00 of supplies.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much is Halima\'s written total off?', fixed: { expected: '$0.25', compute: diff(sum(m(2.5), m(2.5), m(3.0), m(1.75)), m(9.5)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'Using the correct total, what does Halima keep after supplies?', fixed: { expected: '$4.75', compute: diff(sum(m(2.5), m(2.5), m(3.0), m(1.75)), m(5.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A fifth invented sale of $2.25 comes in at the end of the day, and supplies stay at $5.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are Halima\'s total sales for the whole day?', fixed: { expected: '$12.00', compute: sum(m(2.5), m(2.5), m(3.0), m(1.75), m(2.25)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does she keep after supplies for the whole day?', fixed: { expected: '$7.00', compute: diff(sum(m(2.5), m(2.5), m(3.0), m(1.75), m(2.25)), m(5.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Money taken in is not the same as money kept.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Halima took in $12.00 but kept $7.00. Explain to a classmate why those two numbers are different.' }] },
    ],
    rubric: [
      crit(
        'Separating sales from what is kept',
        'The response treats Halima\'s $12.00 and $7.00 as if one of them is simply wrong.',
        'The difference is noticed for Halima but the supplies are not named as the reason.',
        'The response explains that Halima\'s $5.00 of supplies was paid out of the $12.00 taken in, so what she keeps is what is left after that cost.',
      ),
    ],
    remediation:
      'When a learner reports sales as profit, use two labelled envelopes for Halima, moving the supply money out of the sales envelope physically before the kept amount is counted.',
    extension: 'Ask the learner how many more $2.25 sales Halima would need to keep $10.00 for the day, and to show the reasoning.',
  },
  {
    key: 'g3-u06-l06',
    authority: 'FIXED',
    character: 'Jamal',
    objective:
      'Learners split an invented market profit into giving, saving, and keeping shares, check that the shares add back to the whole, and compare two different splits.',
    scenario:
      'Jamal is an invented third grader deciding what to do with $6.00 of pretend profit from a classroom market. His first plan gives $2.00 to a made-up food drive, saves $2.00, and keeps $2.00 for himself.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Check Jamal\'s first plan by adding the three shares back together.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Jamal\'s three shares add up to?', fixed: { expected: '$6.00', compute: sum(m(2.0), m(2.0), m(2.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare two of the shares in Jamal\'s first plan before he changes anything.',
        prompts: [
          {
            ref: 't2-p1',
            promptType: 'fixed-choice',
            text: 'In the first plan, how does Jamal\'s giving share compare with his keeping share?',
            choices: ['He gives less than he keeps', 'They are the same', 'He gives more than he keeps'],
            fixed: { expected: 'They are the same', compute: sel(m(2.0), m(2.0), 'He gives less than he keeps', 'They are the same', 'He gives more than he keeps') },
          },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $6.00 is not being kept for himself in the first plan?', fixed: { expected: '$4.00', compute: diff(m(6.0), m(2.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Jamal writes a second plan: $3.00 to the food drive, $2.00 saved, and $1.00 kept.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'Do the second plan\'s shares still add up to the whole profit?', fixed: { expected: '$6.00', compute: sum(m(3.0), m(2.0), m(1.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Jamal give in the second plan than in the first?', fixed: { expected: '$1.00', compute: diff(m(3.0), m(2.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both of Jamal\'s plans use the whole $6.00.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Both plans add to $6.00, so neither is wrong. Which plan would you choose for Jamal, and what does your choice say about what you value?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about giving, saving, and keeping',
        'The response picks one of Jamal\'s plans with no reason, or says the other plan is wrong.',
        'A plan is chosen for Jamal with a reason that does not refer to any of the three shares.',
        'The response chooses one of Jamal\'s plans and explains the choice in terms of what the giving, saving, or keeping share protects, without calling the other plan wrong.',
      ),
    ],
    remediation:
      'If a learner\'s shares no longer add to the profit, have them lay six pretend dollar coins on the table and physically move each coin into a labelled pile, so the split is made from the actual whole.',
    extension: 'Ask the learner to write a third split for Jamal that adds to $6.00 and gives the largest share to saving, then explain when that plan would make sense.',
  },
]
