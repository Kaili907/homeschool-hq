import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, least, m, most, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 4 Financial Literacy, units 1-3: tradeoffs, earning, and spending plans within $100. */
export const G4A: readonly AuthoredLesson[] = [
  {
    key: 'g4-u01-l01',
    authority: 'FIXED',
    character: 'Ayana',
    objective:
      'Learners sort an invented month of spending into needs and wants, total each group, and test the combined plan against a fixed pretend amount to see what priority order protects.',
    scenario:
      'Ayana is a made-up fourth grader planning a pretend month with $60.00 of simulated money. Her invented list holds two needs, a $24.00 bus pass and $18.00 of lunch supplies, and two wants, a $9.50 game and a $6.25 poster.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total the two invented needs on Ayana\'s list: the $24.00 bus pass and the $18.00 of lunch supplies.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Ayana\'s needs cost together?', fixed: { expected: '$42.00', compute: sum(m(24.0), m(18.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now total the wants separately, then bring both groups together against the $60.00 Ayana has for the pretend month.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Ayana\'s wants cost together?', fixed: { expected: '$15.75', compute: sum(m(9.5), m(6.25)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Ayana\'s whole plan cost?', fixed: { expected: '$57.75', compute: sum(m(24.0), m(18.0), m(9.5), m(6.25)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Ayana checks the finished plan against her $60.00, then finds out the bus pass has gone up to $27.00 while everything else stays the same.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $60.00 is left under the original plan?', fixed: { expected: '$2.25', compute: diff(m(60.0), sum(m(24.0), m(18.0), m(9.5), m(6.25))) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'With the $27.00 bus pass, how does the plan compare with Ayana\'s $60.00?',
            choices: ['It fits', 'It comes out exactly even', 'It runs over'],
            fixed: { expected: 'It runs over', compute: sel(sum(m(27.0), m(18.0), m(9.5), m(6.25)), m(60.0), 'It fits', 'It comes out exactly even', 'It runs over') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The price rise fell on a need, not a want.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Ayana has to cut something. Which item would you cut first and why does priority order matter more than which item she likes least?' }] },
    ],
    rubric: [
      crit(
        'Prioritising under a limit',
        'The response cuts one of Ayana\'s needs first with no reason, or cuts nothing at all.',
        'A want is cut for Ayana but the reason is only that she likes it less.',
        'The response cuts from Ayana\'s wants first and explains that the bus pass and lunch supplies carry consequences the game and poster do not.',
      ),
    ],
    remediation:
      'If a learner cuts by preference, cover the price column and have the learner write, for each item, what would go wrong for Ayana without it, then restore prices and cut only from the items with no consequence attached.',
    extension: 'Ask the learner to rebuild Ayana\'s plan under the $27.00 bus pass so it fits $60.00 exactly, showing the totals for both groups.',
  },
  {
    key: 'g4-u01-l02',
    authority: 'FIXED',
    character: 'Desmond',
    objective:
      'Learners test every pair of invented activities against a fixed pretend amount, identify which combinations are reachable, and measure how far the unreachable ones overshoot.',
    scenario:
      'Desmond is an invented fourth grader with $35.00 of simulated activity money for a pretend break week. Three made-up activities cost $15.00 for a museum day, $22.50 for a climbing session, and $12.75 for a swim pass. He can pick at most two.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Start with Desmond\'s museum day and swim pass together.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the museum day and swim pass cost together?', fixed: { expected: '$27.75', compute: sum(m(15.0), m(12.75)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Hold that pair against Desmond\'s $35.00, then test the museum day paired with the climbing session instead.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $35.00 is left after the museum and swim pair?', fixed: { expected: '$7.25', compute: diff(m(35.0), sum(m(15.0), m(12.75))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does the museum and climbing pair compare with Desmond\'s $35.00?',
            choices: ['Inside the limit', 'Exactly at the limit', 'Over the limit'],
            fixed: { expected: 'Over the limit', compute: sel(sum(m(15.0), m(22.5)), m(35.0), 'Inside the limit', 'Exactly at the limit', 'Over the limit') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'One pair is left untested: climbing with the swim pass. Work it out and measure it against the same $35.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do climbing and the swim pass cost together?', fixed: { expected: '$35.25', compute: sum(m(22.5), m(12.75)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much does that pair overshoot the $35.00?', fixed: { expected: '$0.25', compute: diff(sum(m(22.5), m(12.75)), m(35.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One pair missed the limit by a quarter.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Desmond\'s climbing and swim pair missed by only $0.25. Why does scarcity still rule it out?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about a hard limit',
        'The response lets Desmond take the pair because the gap is small.',
        'The response rules the pair out but treats the $0.25 as unimportant rather than decisive.',
        'The response explains that Desmond\'s $35.00 is the whole amount available, so a plan that costs more cannot be paid for no matter how small the overshoot is.',
      ),
    ],
    remediation:
      'When a learner rounds the overshoot away, write the exact limit and the exact pair total in a two-row comparison and require the subtraction to be shown before any decision is stated.',
    extension: 'Ask the learner which single price would have to change, and by how much, for all three of Desmond\'s pairs to fit inside $35.00.',
  },
  {
    key: 'g4-u01-l03',
    authority: 'FIXED',
    character: 'Priyanka',
    objective:
      'Learners compare two competing invented plans of equal appeal, compute what each leaves behind, and attach a number to what was given up.',
    scenario:
      'Priyanka is a made-up fourth grader with $40.00 of pretend birthday money. Plan A is a $28.00 invented show ticket. Plan B is a $19.50 art book plus a $9.00 lunch with a friend. She can do only one plan.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Priyanka\'s Plan B, which has two invented parts.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Plan B cost in total?', fixed: { expected: '$28.50', compute: sum(m(19.5), m(9.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Put Priyanka\'s two plans side by side, then work out what each one leaves from her $40.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Plan B cost than Plan A?', fixed: { expected: '$0.50', compute: diff(sum(m(19.5), m(9.0)), m(28.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $40.00 is left under Plan A?', fixed: { expected: '$12.00', compute: diff(m(40.0), m(28.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Priyanka chooses Plan A and gives up Plan B entirely.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would have been left under Plan B?', fixed: { expected: '$11.50', compute: diff(m(40.0), sum(m(19.5), m(9.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the value of the art book Priyanka gave up by choosing Plan A?', fixed: { expected: '$19.50', compute: most(m(19.5), m(9.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plans cost almost the same but bought different things.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Name what Priyanka gave up by choosing the show, and explain why the cost of a choice is more than the money she handed over.' }] },
    ],
    rubric: [
      crit(
        'Naming opportunity cost',
        'The response names only the ticket price as the cost of Priyanka\'s choice.',
        'Plan B is mentioned as given up but its contents are not named specifically.',
        'The response names the $19.50 art book and the lunch with a friend as what Priyanka gave up, and states that the give-up is part of what the choice cost her.',
      ),
    ],
    remediation:
      'If a learner reports only the money spent, write both plans on cards, remove the unchosen card from the table, and ask the learner to read aloud everything that left with it before writing the cost sentence.',
    extension: 'Ask the learner to design a Plan C under $40.00 that Priyanka would find harder to give up than either existing plan, and to justify it.',
  },
  {
    key: 'g4-u01-l04',
    authority: 'FIXED',
    character: 'Elena',
    objective:
      'Learners use money as a common measure by converting invented package prices into a price for one item, then compare goods that come in different quantities.',
    scenario:
      'Elena is an invented fourth grader running a pretend bake stall. She sees 6 invented muffins offered for $9.00 and 4 invented rolls offered for $7.00. She wants to know which item is dearer, even though the packages are different sizes.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Turn Elena\'s $9.00 pack of 6 muffins into a price for one muffin.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one muffin cost?', fixed: { expected: '$1.50', compute: div(m(9.0), 6) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Do the same with Elena\'s rolls, which come 4 for $7.00, then compare the two per-item prices rather than the two pack prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does one roll cost?', fixed: { expected: '$1.75', compute: div(m(7.0), 4) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which single item costs Elena more?',
            choices: ['One muffin', 'One roll', 'They cost the same'],
            fixed: { expected: 'One roll', compute: sel(div(m(7.0), 4), div(m(9.0), 6), 'One muffin', 'They cost the same', 'One roll') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Elena needs 12 muffins for her pretend stall, and the price per muffin does not change.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 muffins cost?', fixed: { expected: '$18.00', compute: scale(div(m(9.0), 6), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more would 12 rolls cost than 12 muffins?', fixed: { expected: '$3.00', compute: diff(scale(div(m(7.0), 4), 12), scale(div(m(9.0), 6), 12)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The pack prices alone did not settle the question.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'The rolls came in a cheaper pack but cost more each. What did money let Elena compare that counting packs could not?' }] },
    ],
    rubric: [
      crit(
        'Money as a common measure',
        'The response compares Elena\'s pack prices without reference to how many items each holds.',
        'Per-item price is mentioned for Elena but not described as what made the comparison possible.',
        'The response explains that turning each of Elena\'s packs into a price for one item put both goods on the same scale, which the pack prices alone could not do.',
      ),
    ],
    remediation:
      'When a learner compares $7.00 with $9.00 directly, draw Elena\'s packs as rows of circles and share the price across the circles aloud before any comparison is made.',
    extension: 'Ask the learner what a 5-roll pack would have to cost for rolls to match the muffin price per item, and to show the reasoning.',
  },
  {
    key: 'g4-u01-l05',
    authority: 'FIXED',
    character: 'Omar',
    objective:
      'Learners run a four-step decision routine on an invented purchase, computing the difference between options and the effect of each on the money remaining.',
    scenario:
      'Omar is a made-up fourth grader with $45.00 of pretend money and a routine on his desk: name the goal, list the options, compare the costs, then check what is left. Two invented options are a $32.00 scooter helmet set and a $26.50 plain helmet with a $4.00 light.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Step two of Omar\'s routine lists the options. Total the second option, which has two invented parts.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the plain helmet with a light cost together?', fixed: { expected: '$30.50', compute: sum(m(26.5), m(4.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Step three compares the costs. Put Omar\'s $32.00 set beside the option you just totalled, then say which is cheaper.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much cheaper is the second option?', fixed: { expected: '$1.50', compute: diff(m(32.0), sum(m(26.5), m(4.0))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which option costs Omar less?',
            choices: ['The scooter helmet set', 'The plain helmet with a light', 'They cost the same'],
            fixed: { expected: 'The plain helmet with a light', compute: sel(sum(m(26.5), m(4.0)), m(32.0), 'The plain helmet with a light', 'They cost the same', 'The scooter helmet set') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Step four checks what is left. Run it for both of Omar\'s options against his $45.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is left after the scooter helmet set?', fixed: { expected: '$13.00', compute: diff(m(45.0), m(32.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is left after the plain helmet with a light?', fixed: { expected: '$14.50', compute: diff(m(45.0), sum(m(26.5), m(4.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Cheaper is not automatically the answer.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Omar\'s routine says to compare costs, not just find the smallest number. What else should he check before deciding between these two helmets?' }] },
    ],
    rubric: [
      crit(
        'Applying a decision routine',
        'The response picks Omar\'s cheaper option with no other consideration named.',
        'A second consideration is raised for Omar but not connected to the purpose of a helmet.',
        'The response names something beyond price that Omar should check, such as fit or safety certification, and treats the $1.50 difference as only one input to the decision.',
      ),
    ],
    remediation:
      'If a learner stops at the cheapest total, walk the four written steps in order with a finger on each, requiring a written answer at every step before the decision line is reached.',
    extension: 'Ask the learner to add a fifth step to Omar\'s routine that would catch a bad purchase after the money is spent, and to justify it.',
  },
  {
    key: 'g4-u01-l06',
    authority: 'JUDGMENT',
    character: 'Nour',
    objective:
      'Learners explain why invented families with the same pretend amount make different plans, and practise talking about those differences without ranking anyone.',
    scenario:
      'Nour is an invented fourth grader in a pretend class activity. Two made-up families each plan $80.00 of simulated monthly money: one puts most of it toward a bus pass and food, the other toward a repair fund and a shared music lesson. Both plans balance, and neither family is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Read both invented plans with Nour. Notice what each family put first and what each left out. Neither plan overspends, so the difference is about priorities rather than about arithmetic.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What does each of Nour\'s two invented families protect first, and what does each leave out?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'A classmate in Nour\'s activity says one plan is smarter than the other. Write a reply that takes both plans seriously and explains what would need to be known before anyone could judge.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Why can two families with the same $80.00 build very different plans and both be reasonable?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Talk about money can drift into talk about people.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What is one thing to avoid saying when a classmate mentions what their family can or cannot afford?' }],
      },
    ],
    rubric: [
      crit(
        'Explaining different priorities',
        'The response ranks one of Nour\'s families as better with money.',
        'Both of Nour\'s plans are accepted but no priority difference is identified.',
        'The response identifies what each of Nour\'s families put first and explains that different circumstances make different orderings reasonable.',
      ),
      crit(
        'Speaking about money with dignity',
        'The response suggests wording that shames or pities a family.',
        'The response says to be nice without naming anything concrete to avoid.',
        'The response names something specific to avoid saying, and offers a respectful alternative Nour could use in the classroom.',
      ),
    ],
    lookFors: [
      'Names a concrete priority in each of the two invented plans.',
      'Attributes the difference to circumstances or values, not to skill or worth.',
      'Identifies at least one specific comment to avoid.',
      'Keeps the discussion on the invented families rather than on real classmates.',
    ],
    remediation:
      'If a learner ranks the plans, hide the totals and re-read the plans as lists of what each family was protecting, then ask which protection they would drop first and why that is a judgement call rather than a fact.',
    extension: 'Ask the learner to write a third $80.00 plan for Nour\'s activity that protects something neither family protected, and to say what it gives up.',
    safetyNotes: ['Discuss only the invented families on this sheet; do not describe any real household\'s money.'],
  },
  {
    key: 'g4-u02-l01',
    authority: 'FIXED',
    character: 'Tariq',
    objective:
      'Learners combine an invented hourly wage with a second income source, compute a simulated week of earnings, and compare income that is predictable with income that is not.',
    scenario:
      'Tariq is a made-up fourth grader learning how a pretend job pays. In an invented week his older cousin works 6 hours at $12.00 an hour and also receives $8.50 in tips. All wages here are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out the hourly part of the invented week: 6 hours at $12.00 an hour.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the 6 hours pay?', fixed: { expected: '$72.00', compute: scale(m(12.0), 6) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the $8.50 of invented tips to the hourly pay, then compare the two sources against each other.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total for the invented week?', fixed: { expected: '$80.50', compute: sum(scale(m(12.0), 6), m(8.5)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the hourly pay than the tips?', fixed: { expected: '$63.50', compute: diff(scale(m(12.0), 6), m(8.5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'In a slower invented week the hours drop to 4 and the tips fall to $3.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total for the slow week?', fixed: { expected: '$51.00', compute: sum(scale(m(12.0), 4), m(3.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that than the first invented week?', fixed: { expected: '$29.50', compute: diff(sum(scale(m(12.0), 6), m(8.5)), sum(scale(m(12.0), 4), m(3.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One part of the pay was steadier than the other.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Which part of Tariq\'s cousin\'s income is easier to plan around, and why does that matter for building a budget?' }] },
    ],
    rubric: [
      crit(
        'Distinguishing steady from variable income',
        'The response treats both of Tariq\'s income sources as equally predictable.',
        'The hourly pay is called steadier but the effect on planning is not stated.',
        'The response identifies the hourly pay as the more predictable part of Tariq\'s example and explains that a plan built on tips can fall short in a slow week.',
      ),
    ],
    remediation:
      'If a learner adds hours to the wage, write hours and rate in separate labelled boxes for Tariq and read the phrase "twelve dollars for each hour" aloud before the multiplication is set up.',
    extension: 'Ask the learner how many hours at $12.00 would be needed to match the first invented week with no tips at all, and how they know.',
  },
  {
    key: 'g4-u02-l02',
    authority: 'FIXED',
    character: 'Bianca',
    objective:
      'Learners compare invented pay rates before and after training, compute the weekly gain, and work out how many weeks it takes for the gain to cover the training cost.',
    scenario:
      'Bianca is an invented fourth grader studying a pretend career board. An invented helper role pays $9.00 a simulated hour; after a $40.00 training course the same role pays $12.00 an hour. The board assumes 5 hours of work a week. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out a 5-hour week at Bianca\'s untrained rate of $9.00 an hour.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a 5-hour week pay before training?', fixed: { expected: '$45.00', compute: scale(m(9.0), 5) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now work out the same 5-hour week at the trained rate of $12.00 an hour, then find the weekly gain training buys.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a 5-hour week pay after training?', fixed: { expected: '$60.00', compute: scale(m(12.0), 5) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the trained week pay?', fixed: { expected: '$15.00', compute: diff(scale(m(12.0), 5), scale(m(9.0), 5)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'The training cost $40.00 up front, and the weekly gain is the only thing paying it back.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks of the gain does it take to cover the $40.00 training?', fixed: { expected: '3', compute: reach(m(40.0), diff(scale(m(12.0), 5), scale(m(9.0), 5))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'After those weeks, how much more than the training cost has the gain produced?', fixed: { expected: '$5.00', compute: diff(scale(diff(scale(m(12.0), 5), scale(m(9.0), 5)), 3), m(40.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The training was not free.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Bianca\'s board shows training paying for itself in a few weeks. What would make that a worse deal than it looks?' }] },
    ],
    rubric: [
      crit(
        'Weighing an investment in skills',
        'The response treats Bianca\'s training as always worth it, with no condition named.',
        'A risk is named but not connected to the hours or the pay difference.',
        'The response names a condition that would change Bianca\'s answer, such as fewer hours than assumed or the higher rate not being offered, and ties it to the payback period.',
      ),
    ],
    remediation:
      'When a learner divides in the wrong direction, restate the question as how many $15.00 steps fit inside $40.00 and have them count the steps on a number line before writing an answer.',
    extension: 'Ask the learner what training cost would take exactly 4 weeks of the gain to repay, and to justify the figure.',
  },
  {
    key: 'g4-u02-l03',
    authority: 'FIXED',
    character: 'Hugo',
    objective:
      'Learners take stated percentage set-asides out of invented simulated pay and find the amount actually available to spend.',
    scenario:
      'Hugo is a made-up fourth grader running a pretend pay-day routine. His invented simulated pay is $60.00. His routine sets aside 10% for saving and 5% for giving before anything else is planned. No real paycheck is involved.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Take Hugo\'s first set-aside: 10% of the invented $60.00 pay for saving.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Hugo set aside for saving?', fixed: { expected: '$6.00', compute: pct(m(60.0), 1000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now take the second set-aside, 5% of the same $60.00 for giving, and add both set-asides together.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Hugo set aside for giving?', fixed: { expected: '$3.00', compute: pct(m(60.0), 500) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do both set-asides come to together?', fixed: { expected: '$9.00', compute: sum(pct(m(60.0), 1000), pct(m(60.0), 500)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Hugo now sees what is really available to plan with, and then imagines a pay-day of $80.00 with the same two percentages.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $60.00 is left to plan with?', fixed: { expected: '$51.00', compute: diff(m(60.0), sum(pct(m(60.0), 1000), pct(m(60.0), 500))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'On an $80.00 pay-day, how much would the two set-asides come to?', fixed: { expected: '$12.00', compute: sum(pct(m(80.0), 1000), pct(m(80.0), 500)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The set-asides grew when the pay grew.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Hugo sets aside a percentage rather than a fixed dollar amount. What does that do when his pay changes?' }] },
    ],
    rubric: [
      crit(
        'Reasoning about percentage set-asides',
        'The response treats Hugo\'s set-asides as fixed amounts that never move.',
        'The response notices the set-asides changed but does not connect that to the percentage.',
        'The response explains that Hugo\'s percentages scale with his pay, so bigger pay sets aside more automatically and smaller pay sets aside less.',
      ),
    ],
    remediation:
      'If a learner treats 10% as ten dollars, build Hugo\'s $60.00 as six ten-dollar strips and take one strip as the tenth, so the percentage is seen as a share of the whole rather than a fixed figure.',
    extension: 'Ask the learner what Hugo\'s saving percentage would need to be for the saving set-aside alone to reach $9.00 on a $60.00 pay-day.',
  },
  {
    key: 'g4-u02-l04',
    authority: 'FIXED',
    character: 'Camila',
    objective:
      'Learners cost out an invented small-business run, compute revenue and profit, and test what a change in price does to the outcome.',
    scenario:
      'Camila is an invented fourth grader planning a pretend lemonade stand for a simulated fair. Each invented cup costs her $0.35 in supplies, she plans to sell 12 cups, and she sets a price of $1.00 a cup. All money here is imaginary.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out what supplies for Camila\'s 12 invented cups cost at $0.35 each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do supplies for 12 cups cost?', fixed: { expected: '$4.20', compute: scale(m(0.35), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now find the money coming in from 12 cups at $1.00 each, and take the supply cost back out of it.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much comes in from selling all 12 cups?', fixed: { expected: '$12.00', compute: scale(m(1.0), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Camila\'s profit on the 12 cups?', fixed: { expected: '$7.80', compute: diff(scale(m(1.0), 12), scale(m(0.35), 12)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Camila considers dropping the price to $0.75 a cup, still selling 12 cups with the same supply cost.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the profit be at $0.75 a cup?', fixed: { expected: '$4.80', compute: diff(scale(m(0.75), 12), scale(m(0.35), 12)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much profit does the lower price give up?', fixed: { expected: '$3.00', compute: diff(diff(scale(m(1.0), 12), scale(m(0.35), 12)), diff(scale(m(0.75), 12), scale(m(0.35), 12))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The lower price only makes sense under one condition.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Under what condition would the $0.75 price leave Camila better off than the $1.00 price? Be specific about what would have to happen.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about price and volume',
        'The response says one of Camila\'s prices is simply better with no condition attached.',
        'More sales are mentioned for Camila but without any sense of how many more would be needed.',
        'The response states that Camila would need to sell enough extra cups at $0.75 to make up the $3.00 gap, and reasons about roughly how many that is.',
      ),
    ],
    remediation:
      'When a learner reports revenue as profit, use two columns headed money in and money out for Camila, and require both to be filled before the profit line is written.',
    extension: 'Ask the learner how many cups at $0.75 Camila would need to match the profit from 12 cups at $1.00, and to show the reasoning.',
  },
  {
    key: 'g4-u02-l05',
    authority: 'FIXED',
    character: 'Grace',
    objective:
      'Learners quantify invented unpaid volunteer time and translate it into what the same work would have cost at a stated pretend rate.',
    scenario:
      'Grace is a made-up fourth grader recording a pretend community clean-up. Three invented volunteers each work 4 hours. If the same work had been paid, the invented rate would have been $6.00 an hour. No one is actually paid.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add up the invented volunteer hours: 3 people working 4 hours each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'hours', text: 'How many volunteer hours went into the clean-up?', fixed: { expected: '12', compute: scale({ op: 'count', n: 4 }, 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now put a pretend price on those hours at $6.00 each, and compare that with what the clean-up actually cost in money.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 12 hours have cost at $6.00 an hour?', fixed: { expected: '$72.00', compute: scale(m(6.0), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'The clean-up spent $0.00 on wages. How much value did the volunteers contribute?', fixed: { expected: '$72.00', compute: diff(scale(m(6.0), 12), m(0.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A fourth invented volunteer joins for 4 hours, and the group also spends $15.00 on bags and gloves.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the four volunteers\' hours be worth at $6.00 an hour?', fixed: { expected: '$96.00', compute: sum(scale(m(6.0), 12), scale(m(6.0), 4)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the volunteer value than the $15.00 spent on supplies?', fixed: { expected: '$81.00', compute: diff(sum(scale(m(6.0), 12), scale(m(6.0), 4)), m(15.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'None of that value appears on a receipt.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Grace\'s clean-up cost $15.00 on paper. Why is that number a poor description of what the day was worth?' }] },
    ],
    rubric: [
      crit(
        'Valuing unpaid contribution',
        'The response treats Grace\'s $15.00 as the full cost of the clean-up.',
        'The volunteer hours are noticed but not connected to value the receipt misses.',
        'The response explains that Grace\'s receipt records only purchased supplies, while the volunteer hours carried most of the work and would have cost many times more if paid.',
      ),
    ],
    remediation:
      'If a learner multiplies by the number of people instead of the hours, build the hours total first as its own labelled figure for Grace, then apply the rate to that single number.',
    extension: 'Ask the learner what other unpaid contributions a clean-up needs that even Grace\'s hour count would miss.',
  },
  {
    key: 'g4-u02-l06',
    authority: 'JUDGMENT',
    character: 'Ravi',
    objective:
      'Learners judge an invented workplace situation where responsibilities were not met, and propose a response that is fair to everyone involved.',
    scenario:
      'Ravi is an invented fourth grader in a pretend school store team. One made-up team member kept skipping the closing shift, another quietly covered every time, and the store still balanced its pretend books. Nobody has said anything yet.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Lay out what happened in Ravi\'s pretend store: what was promised, what was actually done, and who absorbed the difference. Keep the description separate from any judgement about the people.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What was each person in Ravi\'s team responsible for, and what actually happened?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Ravi has to raise this with the team. Write what he should say and to whom, keeping it something a fourth grader could actually say out loud without accusing anyone unfairly.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Ravi say, to whom, and what makes that response fair rather than just blunt?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The pretend books balanced anyway.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'The store did not lose money. Why is the missed shift still a problem worth raising?' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about workplace responsibility',
        'The response treats Ravi\'s missed shifts as unimportant because the books balanced.',
        'The problem is named for Ravi but the cost to the covering teammate is not.',
        'The response names the missed commitment and the load it moved onto the teammate who covered, treating the balanced books as beside the point.',
      ),
      crit(
        'Raising an issue fairly',
        'Ravi\'s response is an accusation or a demand for punishment.',
        'Ravi says something but the wording would likely start an argument rather than a fix.',
        'The response gives Ravi wording that describes what happened, names the effect, and leaves room for the other person to explain or fix it.',
      ),
    ],
    lookFors: [
      'Distinguishes the agreed responsibility from what was actually done.',
      'Names the teammate who absorbed the extra work.',
      'Proposes wording that is direct without being an accusation.',
      'Explains why a balanced result does not settle the fairness question.',
    ],
    remediation:
      'If a learner jumps to punishment, have them write the two facts first, what was promised and what happened, and only then draft what Ravi says.',
    extension: 'Ask the learner to write what Ravi\'s team could agree in advance so the same problem is caught earlier next time.',
  },
  {
    key: 'g4-u03-l01',
    authority: 'FIXED',
    character: 'Yara',
    objective:
      'Learners convert invented multi-pack prices into per-item prices, identify the better value, and apply it to a larger order.',
    scenario:
      'Yara is a made-up fourth grader stocking a pretend classroom supply shelf. One invented option is 3 pens for $4.50; another is 5 of the same pens for $6.25. She needs to know which is the better value per pen.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Turn Yara\'s 3-for-$4.50 option into a price per pen.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price per pen in the 3-pen pack?', fixed: { expected: '$1.50', compute: div(m(4.5), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Do the same for Yara\'s 5-for-$6.25 option, then compare the two per-pen prices rather than the pack prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price per pen in the 5-pen pack?', fixed: { expected: '$1.25', compute: div(m(6.25), 5) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which pack gives Yara the lower price per pen?',
            choices: ['The 3-pen pack', 'The 5-pen pack', 'They are the same per pen'],
            fixed: { expected: 'The 5-pen pack', compute: sel(div(m(6.25), 5), div(m(4.5), 3), 'The 5-pen pack', 'They are the same per pen', 'The 3-pen pack') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Yara needs 10 pens, and both packs can be bought more than once at the same per-pen price.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 10 pens cost at the better per-pen price?', fixed: { expected: '$12.50', compute: scale(div(m(6.25), 5), 10) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would that save against 10 pens at the worse per-pen price?', fixed: { expected: '$2.50', compute: diff(scale(div(m(4.5), 3), 10), scale(div(m(6.25), 5), 10)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The bigger pack cost more on the shelf.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Yara\'s better-value pack had the higher sticker price. Explain to a classmate how both of those can be true.' }] },
    ],
    rubric: [
      crit(
        'Explaining unit price',
        'The response says the cheaper sticker price is the better deal for Yara.',
        'Per-pen price is used for Yara but the explanation does not address the sticker price confusion.',
        'The response explains that Yara\'s bigger pack costs more in total but less for each pen, and that per-pen price is what makes the two comparable.',
      ),
    ],
    remediation:
      'If a learner compares sticker prices, draw Yara\'s two packs as rows of pens with the price written above and share the price across the pens aloud before comparing anything.',
    extension: 'Ask the learner what a 4-pen pack would need to cost to beat Yara\'s best per-pen price, and to justify it.',
  },
  {
    key: 'g4-u03-l02',
    authority: 'FIXED',
    character: 'Felix',
    objective:
      'Learners carry out a full comparison-shopping routine across two invented stores, totalling identical baskets and identifying where the difference comes from.',
    scenario:
      'Felix is an invented fourth grader pricing the same pretend basket at two made-up stores. At the first store the items cost $6.40, $3.25, and $8.10. At the second the same three items cost $5.90, $4.00, and $7.75.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Felix\'s basket at the first invented store.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the basket cost at the first store?', fixed: { expected: '$17.75', compute: sum(m(6.4), m(3.25), m(8.1)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total the identical basket at the second store, then compare the two totals rather than any single item.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the same basket cost at the second store?', fixed: { expected: '$17.65', compute: sum(m(5.9), m(4.0), m(7.75)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much cheaper is the better basket?', fixed: { expected: '$0.10', compute: diff(sum(m(6.4), m(3.25), m(8.1)), sum(m(5.9), m(4.0), m(7.75))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Felix looks at where the difference actually comes from, item by item.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'On the second item, how much more does the second store charge?', fixed: { expected: '$0.75', compute: diff(m(4.0), m(3.25)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'On the first and third items combined, how much less does the second store charge?', fixed: { expected: '$0.85', compute: diff(sum(m(6.4), m(8.1)), sum(m(5.9), m(7.75))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One store was cheaper overall but not on every item.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'The second store lost on one item and still won overall. What does that show about comparing a single price?' }] },
    ],
    rubric: [
      crit(
        'Comparing whole baskets',
        'The response picks a store for Felix based on one item\'s price.',
        'The totals are compared for Felix but the item-level difference is not addressed.',
        'The response explains that Felix\'s decision rests on the whole basket, since one item being dearer can be outweighed by savings elsewhere.',
      ),
    ],
    remediation:
      'When a learner compares item by item and stalls, have them complete both of Felix\'s column totals first and only then look at where the difference came from.',
    extension: 'Ask the learner what the second store would need to charge for the middle item to make the two baskets identical in total.',
  },
  {
    key: 'g4-u03-l03',
    authority: 'FIXED',
    character: 'Anjali',
    objective:
      'Learners apply a stated simulated sales-tax percentage to an invented subtotal, find the total due, and see how the tax amount changes with the size of the purchase.',
    scenario:
      'Anjali is a made-up fourth grader at a pretend checkout in an invented town where the simulated sales tax is 6%. Her first invented subtotal is $40.00. The tax rate and the prices are made up for this practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 6% simulated tax to Anjali\'s $40.00 subtotal.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much simulated tax is added to the $40.00?', fixed: { expected: '$2.40', compute: pct(m(40.0), 600) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add that tax to Anjali\'s subtotal to get the amount due, then run the same 6% on a smaller invented subtotal of $25.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total due on the $40.00 subtotal?', fixed: { expected: '$42.40', compute: sum(m(40.0), pct(m(40.0), 600)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much simulated tax is added to a $25.00 subtotal?', fixed: { expected: '$1.50', compute: pct(m(25.0), 600) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Anjali has $45.00 to spend, tax included, and is looking at a $43.00 invented subtotal.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total due on a $43.00 subtotal with 6% simulated tax?', fixed: { expected: '$45.58', compute: sum(m(43.0), pct(m(43.0), 600)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'Can Anjali cover that total with $45.00?',
            choices: ['Yes, with money left', 'It comes out exactly even', 'No, she is short'],
            fixed: { expected: 'No, she is short', compute: sel(m(45.0), sum(m(43.0), pct(m(43.0), 600)), 'No, she is short', 'It comes out exactly even', 'Yes, with money left') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The shelf price was inside her budget; the total was not.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Anjali\'s $43.00 subtotal fitted her $45.00 but the checkout total did not. What should she do differently before choosing items?' }] },
    ],
    rubric: [
      crit(
        'Planning for added tax',
        'The response treats Anjali\'s shelf prices as the amount she will pay.',
        'Tax is mentioned for Anjali but not built into the plan before shopping.',
        'The response says Anjali should leave room for the simulated tax before filling the basket, and refers to the size of the tax at 6%.',
      ),
    ],
    remediation:
      'When a learner adds the tax rate as dollars, work the percentage on a $100.00 example for Anjali first, so six percent is anchored to six dollars per hundred before smaller subtotals are attempted.',
    extension: 'Ask the learner what the largest subtotal is that Anjali could cover with $45.00 once 6% simulated tax is added, and how they narrowed it down.',
  },
  {
    key: 'g4-u03-l04',
    authority: 'FIXED',
    character: 'Malik',
    objective:
      'Learners separate invented fixed costs from flexible ones, total each type, and identify which part of a plan can absorb a change.',
    scenario:
      'Malik is an invented fourth grader planning a pretend month with $60.00 of simulated money. One invented cost is fixed: a $30.00 bus pass that cannot change. Two are flexible: $12.50 of snacks and $8.75 of outings.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Malik\'s two invented flexible costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Malik\'s flexible costs come to?', fixed: { expected: '$21.25', compute: sum(m(12.5), m(8.75)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the fixed bus pass to the flexible total, then check the whole plan against Malik\'s $60.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Malik\'s whole plan cost?', fixed: { expected: '$51.25', compute: sum(m(30.0), m(12.5), m(8.75)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $60.00 is unspent?', fixed: { expected: '$8.75', compute: diff(m(60.0), sum(m(30.0), m(12.5), m(8.75))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Malik\'s simulated money for the month drops to $48.00, and the bus pass still cannot change.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left for flexible costs once the fixed bus pass is paid from $48.00?', fixed: { expected: '$18.00', compute: diff(m(48.0), m(30.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must Malik cut from his flexible costs to fit?', fixed: { expected: '$3.25', compute: diff(sum(m(12.5), m(8.75)), diff(m(48.0), m(30.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Only one part of the plan could move.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Why did Malik have to cut from snacks and outings rather than from the bus pass?' }] },
    ],
    rubric: [
      crit(
        'Distinguishing fixed from flexible',
        'The response cuts Malik\'s bus pass without acknowledging that it is fixed.',
        'The flexible costs are cut for Malik but the reason is not tied to the nature of the costs.',
        'The response explains that Malik\'s bus pass is set by an outside commitment while snacks and outings are choices he controls, so the cut has to come from the flexible side.',
      ),
    ],
    remediation:
      'If a learner cuts indiscriminately, label each of Malik\'s lines fixed or flexible and cover the fixed lines with a card before any reduction is proposed.',
    extension: 'Ask the learner what would have to change in Malik\'s life for the bus pass itself to become a flexible cost.',
  },
  {
    key: 'g4-u03-l05',
    authority: 'FIXED',
    character: 'Sena',
    objective:
      'Learners build a one-week simulated budget from invented categories, check it against invented income, and test what one unplanned addition does to the balance.',
    scenario:
      'Sena is a made-up fourth grader building a pretend one-week budget from $45.00 of simulated income. Her invented categories are $12.00 for food, $9.50 for transport, $6.25 for supplies, and $10.00 for saving.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Sena\'s four invented budget categories.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Sena\'s planned week come to?', fixed: { expected: '$37.75', compute: sum(m(12.0), m(9.5), m(6.25), m(10.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Check the plan against Sena\'s $45.00 of simulated income, and say what the leftover means for the week.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $45.00 is unallocated?', fixed: { expected: '$7.25', compute: diff(m(45.0), sum(m(12.0), m(9.5), m(6.25), m(10.0))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does Sena\'s planned week compare with her income?',
            choices: ['Inside her income', 'Exactly at her income', 'Over her income'],
            fixed: { expected: 'Inside her income', compute: sel(sum(m(12.0), m(9.5), m(6.25), m(10.0)), m(45.0), 'Inside her income', 'Exactly at her income', 'Over her income') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'An unplanned invented $8.00 school trip fee lands mid-week, and Sena refuses to cut her saving category.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the week cost with the trip fee added?', fixed: { expected: '$45.75', compute: sum(m(12.0), m(9.5), m(6.25), m(10.0), m(8.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must Sena cut from the other categories to stay inside $45.00?', fixed: { expected: '$0.75', compute: diff(sum(m(12.0), m(9.5), m(6.25), m(10.0), m(8.0)), m(45.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The unplanned fee was larger than the unallocated money.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Sena kept her saving category untouched. Was that the right call here, and what would change your answer?' }] },
    ],
    rubric: [
      crit(
        'Defending a budget decision',
        'The response states a preference about Sena\'s saving with no reasoning.',
        'A position on Sena\'s saving is taken but no condition that would change it is offered.',
        'The response takes a position on Sena\'s saving category, supports it with the size of the shortfall, and names a condition that would justify the opposite call.',
      ),
    ],
    remediation:
      'When a learner cannot find the required cut, write Sena\'s new total and her income as two numbers on one line and have the subtraction produce the cut directly, rather than reworking every category.',
    extension: 'Ask the learner to rebuild Sena\'s week with the trip fee included and the saving category intact, and to show the new category amounts.',
  },
  {
    key: 'g4-u03-l06',
    authority: 'FIXED',
    character: 'Isaac',
    objective:
      'Learners recompute an invented total that was recorded wrongly, quantify the recording error, and re-test the corrected figure against the money available.',
    scenario:
      'Isaac is an invented fourth grader checking a pretend supply order he wrote up: $21.75, $18.60, and $22.05. He recorded the total as $63.40 and has $65.00 of simulated money. The error in his record is what this task repairs.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Isaac\'s three invented amounts yourself before looking at his recorded total.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the correct total of Isaac\'s three amounts?', fixed: { expected: '$62.40', compute: sum(m(21.75), m(18.6), m(22.05)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with the $63.40 Isaac wrote down, then check the corrected total against his $65.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much is Isaac\'s recorded total wrong?', fixed: { expected: '$1.00', compute: diff(m(63.4), sum(m(21.75), m(18.6), m(22.05))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'Using the correct total, how much of the $65.00 is left?', fixed: { expected: '$2.60', compute: diff(m(65.0), sum(m(21.75), m(18.6), m(22.05))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Isaac adds a fourth invented item at $3.15 to the corrected order, not to his old recorded total.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the corrected total with the fourth item?', fixed: { expected: '$65.55', compute: sum(m(21.75), m(18.6), m(22.05), m(3.15)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far past his $65.00 does that put him?', fixed: { expected: '$0.55', compute: diff(sum(m(21.75), m(18.6), m(22.05), m(3.15)), m(65.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Had Isaac trusted his own record, he would have thought he had less room than he did.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Isaac\'s error made the order look more expensive than it was. Why is an error in that direction still worth fixing?' }] },
    ],
    rubric: [
      crit(
        'Valuing accuracy in both directions',
        'The response says Isaac\'s error was harmless because it overstated the cost.',
        'The response says the error should be fixed but gives no consequence.',
        'The response explains that Isaac\'s overstatement could make him cut something unnecessarily, and that any wrong total makes later decisions unreliable.',
      ),
    ],
    remediation:
      'If a learner cannot locate the error, have them re-add Isaac\'s amounts in reverse order and compare the two runs step by step, so the disagreeing place value is isolated.',
    extension: 'Ask the learner to change one of Isaac\'s four amounts so the corrected order lands exactly on $65.00, and to show the arithmetic.',
  },
]
