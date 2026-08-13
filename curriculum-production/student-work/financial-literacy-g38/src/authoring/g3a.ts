import type { AuthoredLesson } from '../types.ts'
import { crit, diff, m, most, least, scale, sel, sum } from './dsl.ts'

/** Grade 3 Financial Literacy, units 1-3. Whole-cent addition and subtraction within $20. */
export const G3A: readonly AuthoredLesson[] = [
  {
    key: 'g3-u01-l01',
    authority: 'FIXED',
    character: 'Nia',
    objective:
      'Learners sort a short list of invented items into needs and wants, add each group separately, and compare the two totals to see which group takes more of the pretend money.',
    scenario:
      'Nia is a made-up third grader packing for a pretend school week. Her invented list has four items with pretend prices: a school lunch for $3.00, warm socks for $4.00, a sticker sheet for $1.00, and a toy car for $2.00. Nothing on this sheet is a real purchase.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Two items on Nia\'s pretend list are needs: the school lunch at $3.00 and the warm socks at $4.00.',
        prompts: [
          { ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Nia\'s two needs cost together?', fixed: { expected: '$7.00', compute: sum(m(3.0), m(4.0)) } },
        ],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'The other two items are wants: the sticker sheet at $1.00 and the toy car at $2.00. Add the wants the same way you added the needs, then put the two totals side by side.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Nia\'s two wants cost together?', fixed: { expected: '$3.00', compute: sum(m(1.0), m(2.0)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which group takes more of Nia\'s pretend money?',
            choices: ['The needs cost more', 'The wants cost more', 'They cost the same'],
            fixed: {
              expected: 'The needs cost more',
              compute: sel(sum(m(3.0), m(4.0)), sum(m(1.0), m(2.0)), 'The wants cost more', 'They cost the same', 'The needs cost more'),
            },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'The pretend weather report says rain all week, so Nia adds a raincoat for $6.00 to her needs. Her wants do not change.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Nia\'s three needs cost together now?', fixed: { expected: '$13.00', compute: sum(m(3.0), m(4.0), m(6.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more do Nia\'s needs cost than her wants now?', fixed: { expected: '$10.00', compute: diff(sum(m(3.0), m(4.0), m(6.0)), sum(m(1.0), m(2.0))) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Think about why the raincoat moved into the needs group.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Why is the raincoat a need for Nia during a rainy pretend week, when a sticker sheet is not?' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about needs and wants',
        'Nia\'s raincoat is called a need with no reason given, or the reason only says that she likes it.',
        'The response ties the raincoat to the rain but does not say what would go wrong for Nia without it.',
        'The response explains that the rainy week makes the raincoat something Nia needs to stay dry and healthy, while stickers can wait without harm.',
      ),
    ],
    remediation:
      'If a learner adds the needs and wants into one pile, put two labelled index cards on the table and physically place each pretend price card on the matching card before any addition happens, so the two totals are built separately and can be seen side by side.',
    extension: 'Ask the learner to invent one more item for Nia priced under $5.00, place it in a group, and defend the placement with a reason about what happens without it.',
  },
  {
    key: 'g3-u01-l02',
    authority: 'FIXED',
    character: 'Theo',
    objective:
      'Learners add a short list of invented want prices, compare the total against the pretend money on hand, and find the gap between what a plan costs and what a character can pay.',
    scenario:
      'Theo is an invented third grader at a pretend comic fair with $5.00 of play money. Three made-up items catch his eye: a comic for $2.25, a marble set for $1.50, and a poster for $3.00. All of it is imaginary; no real money changes hands.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Start by finding the cost of wanting everything at once. Add all three pretend prices from Theo\'s fair.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would all three items cost Theo together?', fixed: { expected: '$6.75', compute: sum(m(2.25), m(1.5), m(3.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Theo brought exactly $5.00 of play money to the pretend fair. Hold your total next to that amount and decide what it tells you before doing any more arithmetic.',
        prompts: [
          {
            ref: 't2-p1',
            promptType: 'fixed-choice',
            text: 'How does the cost of all three items compare with Theo\'s $5.00?',
            choices: ['Less than Theo has', 'Exactly what Theo has', 'More than Theo has'],
            fixed: { expected: 'More than Theo has', compute: sel(sum(m(2.25), m(1.5), m(3.0)), m(5.0), 'Less than Theo has', 'Exactly what Theo has', 'More than Theo has') },
          },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much short of all three items is Theo?', fixed: { expected: '$1.75', compute: diff(sum(m(2.25), m(1.5), m(3.0)), m(5.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Theo decides to leave the $3.00 poster behind and take only the comic and the marble set.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the comic and the marble set cost together?', fixed: { expected: '$3.75', compute: sum(m(2.25), m(1.5)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Theo\'s $5.00 is left after that choice?', fixed: { expected: '$1.25', compute: diff(m(5.0), sum(m(2.25), m(1.5))) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Think about the difference between wanting something and needing it.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'The comic is a want, not a need. What makes it a want, even though Theo really would like to have it?' }],
      },
    ],
    rubric: [
      crit(
        'Distinguishing wanting from needing',
        'The response says the comic is a want only because Theo bought it, or gives no reason at all.',
        'Theo\'s comic is named a want with a partial reason, such as it being fun, without saying that he is fine without it.',
        'The response explains that Theo would still be safe, fed, and warm without the comic, so wanting it strongly does not turn it into a need.',
      ),
    ],
    remediation:
      'When a learner writes the shortfall as the whole price of the missing item, rebuild the comparison with a paper strip cut to $5.00 and a second strip cut to $6.75, then lay them end to end so the overhanging piece is visibly the gap rather than any single item.',
    extension: 'Have the learner find a different pair from Theo\'s three items that also fits inside $5.00 and show the subtraction that proves it fits.',
  },
  {
    key: 'g3-u01-l03',
    authority: 'FIXED',
    character: 'Rosa',
    objective:
      'Learners test every pair of invented items against a fixed pretend budget, find which pairs fit, and name the smallest total, building the idea that limited money forces a choice.',
    scenario:
      'Rosa is a made-up third grader with $6.00 in pretend craft-fair tokens. Three invented booths sell a kite for $4.00, a set of paints for $3.00, and a bouncy ball for $2.50. She may pick at most two. None of this is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Try Rosa\'s first pair: the paints and the bouncy ball.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the paints and the bouncy ball cost together?', fixed: { expected: '$5.50', compute: sum(m(3.0), m(2.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Rosa holds that pair against her $6.00 in tokens. Then try a second pair, the kite and the bouncy ball, and compare that total to the same $6.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'If Rosa takes the paints and the ball, how many tokens are left over?', fixed: { expected: '$0.50', compute: diff(m(6.0), sum(m(3.0), m(2.5))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does the kite and ball pair compare with Rosa\'s $6.00?',
            choices: ['Less than Rosa\'s tokens', 'Exactly Rosa\'s tokens', 'More than Rosa\'s tokens'],
            fixed: { expected: 'More than Rosa\'s tokens', compute: sel(sum(m(4.0), m(2.5)), m(6.0), 'Less than Rosa\'s tokens', 'Exactly Rosa\'s tokens', 'More than Rosa\'s tokens') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'One pair is still untested: the kite and the paints. Work it out, then look across all three pair totals you have found.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the kite and the paints cost together?', fixed: { expected: '$7.00', compute: sum(m(4.0), m(3.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'Of Rosa\'s three possible pairs, what does the least expensive pair cost?', fixed: { expected: '$5.50', compute: least(sum(m(3.0), m(2.5)), sum(m(4.0), m(2.5)), sum(m(4.0), m(3.0))) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Look at how many pairs actually fit inside the tokens Rosa has.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Only one of Rosa\'s three pairs fits inside $6.00. What does that show about having a set amount of money?' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about scarcity',
        'The response repeats a total without saying anything about Rosa having to choose.',
        'Rosa is described as unable to buy everything, but the fixed $6.00 is not named as the reason.',
        'The response states that Rosa\'s money stops at $6.00, so some pairs are out of reach and she has to give something up no matter which pair she picks.',
      ),
    ],
    remediation:
      'If a learner declares a pair affordable without comparing it to the tokens, have them build each total in coins first and physically place it beside six pretend dollar coins, so fitting or not fitting is something they see before it is something they compute.',
    extension: 'Ask the learner what price the kite would have to drop to before the kite-and-paints pair would fit inside Rosa\'s $6.00, and to show the subtraction behind the answer.',
  },
  {
    key: 'g3-u01-l04',
    authority: 'FIXED',
    character: 'Milo',
    objective:
      'Learners compute the change left by two competing invented choices, compare the two prices, and name the specific item given up so opportunity cost is attached to a number.',
    scenario:
      'Milo is an imaginary third grader holding $5.00 in pretend book-fair money. He is deciding between a made-up adventure book priced at $4.00 and a made-up puzzle priced at $3.50, and he can take only one. No real purchase happens here.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Suppose Milo picks the $4.00 adventure book.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Milo\'s $5.00 is left after the book?', fixed: { expected: '$1.00', compute: diff(m(5.0), m(4.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now set the two pretend prices side by side before deciding anything. The book is $4.00 and the puzzle is $3.50.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the book cost than the puzzle?', fixed: { expected: '$0.50', compute: diff(m(4.0), m(3.5)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which of Milo\'s two choices costs more?',
            choices: ['The adventure book', 'The puzzle', 'They cost the same'],
            fixed: { expected: 'The adventure book', compute: sel(m(4.0), m(3.5), 'The puzzle', 'They cost the same', 'The adventure book') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Now run the other choice all the way through. Suppose Milo picks the $3.50 puzzle instead of the book.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Milo\'s $5.00 is left after the puzzle?', fixed: { expected: '$1.50', compute: diff(m(5.0), m(3.5)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more money is left over in the puzzle plan than in the book plan?', fixed: { expected: '$0.50', compute: diff(diff(m(5.0), m(3.5)), diff(m(5.0), m(4.0))) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Milo finally takes the adventure book.',
        prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Name exactly what Milo gave up by choosing the book, and say what he got in return for giving it up.' }],
      },
    ],
    rubric: [
      crit(
        'Naming the thing given up',
        'The response says only that Milo spent money, without naming the puzzle he passed on.',
        'Milo\'s puzzle is named as the thing given up, but nothing is said about what he received instead.',
        'The response names the $3.50 puzzle as what Milo gave up and states plainly what he gained instead, treating the giving-up as part of the choice rather than a loss.',
      ),
    ],
    remediation:
      'When a learner treats the change as the thing given up, place both pretend items on the table, remove the unchosen one, and say aloud what left the table, before asking the learner to write the sentence that names it.',
    extension: 'Have the learner invent a third pretend book-fair item under $5.00 and explain which of the three they would give up last and why.',
  },
  {
    key: 'g3-u01-l05',
    authority: 'JUDGMENT',
    character: 'Zuri',
    objective:
      'Learners compare two invented families who spend the same pretend amount very differently, and practise talking about money choices without ranking families or repeating private details.',
    scenario:
      'Zuri is a made-up third grader whose class runs a pretend planning activity. Two invented families each plan $10.00 of imaginary market money: the first plans rice, beans, and fruit; the second plans bread, soup, and a birthday candle for a sibling. Both plans are complete and neither family is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Read both invented plans with Zuri. The first family put every pretend dollar into food that lasts the week. The second family kept a little back for a birthday candle. Notice what each plan protects before you say anything about which you prefer.',
        prompts: [
          { ref: 't1-p1', promptType: 'short-response', text: 'Name one thing the first invented family\'s plan takes care of, and one thing the second family\'s plan takes care of.' },
        ],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Zuri\'s classmate says the second family "wasted" money on the candle. Write what you would say back. Remember that both families finished their pretend plan and neither ran out of money.',
        prompts: [
          { ref: 't2-p1', promptType: 'extended-response', text: 'Explain why two families can spend the same pretend $10.00 in different ways and both plans can still be good ones.' },
        ],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Money information about a real family belongs to that family.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'A friend tells you something about what their family can afford. What is the kind thing to do with what they told you?' }],
      },
    ],
    rubric: [
      crit(
        'Respect for different family choices',
        'The response ranks one of Zuri\'s two invented families as better with money, or calls a family\'s choice foolish.',
        'The response accepts both of Zuri\'s plans but gives no reason grounded in what each family valued.',
        'The response explains that each family in Zuri\'s activity protected something different with the same pretend $10.00, and treats both plans as reasonable rather than ranking the families.',
      ),
      crit(
        'Handling private money information',
        'The response suggests telling others what a friend of Zuri\'s said about family money.',
        'The response says to keep it quiet without naming any trusted adult a worry could go to.',
        'The response says that what Zuri\'s friend shared stays private, and that a worry about a friend can be brought to a trusted adult instead of to other children.',
      ),
    ],
    lookFors: [
      'Names at least one concrete thing each invented plan protects, such as food for the whole week or a sibling\'s birthday.',
      'Does not rank either invented family as better, smarter, or poorer than the other.',
      'States that a friend\'s family money information is kept private rather than repeated.',
      'Sends any real worry to a trusted adult rather than to classmates.',
    ],
    remediation:
      'If a learner ranks the families, cover the price column entirely and re-read both plans as stories about what each family cared about, then ask which plan would be missing something if the other family had written it.',
    extension: 'Ask the learner to write a third invented $10.00 plan that protects something neither family protected, and to name what it gives up in exchange.',
    safetyNotes: ['Talk only about the two invented families on this sheet; do not describe any real household\'s money.'],
  },
  {
    key: 'g3-u01-l06',
    authority: 'FIXED',
    character: 'Ada',
    objective:
      'Learners find and repair an invented addition error in a pretend spending plan, measure the size of the error, and re-check the corrected plan against the money available.',
    scenario:
      'Ada is an invented third grader who wrote a pretend plan for a made-up craft day: yarn $2.75, buttons $1.25, and fabric $3.00. She recorded the total as $6.00 and had $8.00 in pretend money. Her arithmetic is the thing under repair here; nothing was really bought.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Ada\'s three pretend prices carefully yourself before looking at what she wrote.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the correct total of Ada\'s three craft-day items?', fixed: { expected: '$7.00', compute: sum(m(2.75), m(1.25), m(3.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Ada wrote $6.00 on her plan. Put your correct total next to her recorded total, then check the corrected plan against the $8.00 she actually has.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much was Ada\'s recorded total wrong?', fixed: { expected: '$1.00', compute: diff(sum(m(2.75), m(1.25), m(3.0)), m(6.0)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Does the corrected total still fit inside Ada\'s $8.00?',
            choices: ['It fits', 'It is exactly enough', 'It does not fit'],
            fixed: { expected: 'It fits', compute: sel(sum(m(2.75), m(1.25), m(3.0)), m(8.0), 'It fits', 'It is exactly enough', 'It does not fit') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Ada now wants to add a $1.50 juice to the same craft-day plan, using the corrected total rather than her old one.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the new total with the juice added?', fixed: { expected: '$8.50', compute: sum(m(2.75), m(1.25), m(3.0), m(1.5)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far over Ada\'s $8.00 does the new plan go?', fixed: { expected: '$0.50', compute: diff(sum(m(2.75), m(1.25), m(3.0), m(1.5)), m(8.0)) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Ada would have caught her own mistake with one more step.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Name one checking step Ada skipped, and say how that step would have shown her the total was wrong.' }],
      },
    ],
    rubric: [
      crit(
        'Naming a checking step',
        'The response only says Ada should be more careful, with no step named.',
        'A checking step is named for Ada but not connected to how it would surface the missing dollar.',
        'The response names a concrete step Ada skipped, such as re-adding in a different order or estimating first, and explains how it would have exposed the $1.00 gap.',
      ),
    ],
    remediation:
      'If a learner accepts the recorded total without testing it, cover Ada\'s written total with a sticky note and require an estimate first, so a rough sense of about seven dollars is in place before the exact sum is compared to what she wrote.',
    extension: 'Have the learner rewrite Ada\'s plan so the juice fits inside $8.00 by changing exactly one price, and show the new total.',
  },
  {
    key: 'g3-u02-l01',
    authority: 'FIXED',
    character: 'Sam',
    objective:
      'Learners use repeated addition on an invented per-job payment to find earnings for different amounts of work, then test the earnings against a pretend savings target.',
    scenario:
      'Sam is a made-up third grader in a pretend neighbourhood who is paid $2.00 of play money for each imaginary dog walk. The walks, the pay, and the scooter later in this task are all invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Sam finishes three pretend dog walks on Saturday at $2.00 each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Sam earn from three pretend walks?', fixed: { expected: '$6.00', compute: scale(m(2.0), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'The next week Sam does five pretend walks at the same $2.00 each. Work out the new earnings, then compare the two weeks directly instead of starting over.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Sam earn from five pretend walks?', fixed: { expected: '$10.00', compute: scale(m(2.0), 5) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Sam earn in the five-walk week than in the three-walk week?', fixed: { expected: '$4.00', compute: diff(scale(m(2.0), 5), scale(m(2.0), 3)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'On top of the five walks, Sam rakes an invented yard for a flat $3.00. He is saving toward a pretend scooter that costs $15.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What has Sam earned in total from the five walks and the raking?', fixed: { expected: '$13.00', compute: sum(scale(m(2.0), 5), m(3.0)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'Is that enough for the $15.00 pretend scooter?',
            choices: ['Not yet enough', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'Not yet enough', compute: sel(sum(scale(m(2.0), 5), m(3.0)), m(15.0), 'Not yet enough', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Think about where Sam\'s money came from.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Sam\'s pretend money did not appear on its own. What did he trade to get it?' }],
      },
    ],
    rubric: [
      crit(
        'Connecting work to income',
        'The response says only that Sam has money, without naming any work behind it.',
        'Sam\'s walking and raking are mentioned but not described as the trade that produced the pay.',
        'The response states that Sam traded his time and effort on the walks and the raking for the pretend pay, so the money came from work he did.',
      ),
    ],
    remediation:
      'When a learner adds the number of walks to the price instead of repeating the payment, lay out one pretend $2.00 card per walk and count the cards aloud, so five walks visibly becomes five twos rather than the numbers two and five combined.',
    extension: 'Ask the learner how many more $2.00 walks Sam needs before he reaches the $15.00 pretend scooter, and to show the reasoning behind the count.',
  },
  {
    key: 'g3-u02-l02',
    authority: 'FIXED',
    character: 'Marisol',
    objective:
      'Learners compare invented daily pay across three pretend community jobs, find the largest and the spread between jobs, and scale one job\'s pay across two days.',
    scenario:
      'Marisol is an imaginary third grader making a poster about a pretend town. In her invented town, a baker is paid $8.00 for a day, a librarian $9.00, and a bus driver $7.00. These are made-up figures for a poster, not real wages.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Look across Marisol\'s three invented day rates: baker $8.00, librarian $9.00, bus driver $7.00.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the largest pretend day rate on Marisol\'s poster?', fixed: { expected: '$9.00', compute: most(m(8.0), m(9.0), m(7.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Marisol wants to show how far apart the jobs are on her poster. Find the spread between the highest and lowest rate, then compare two of the jobs directly.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is the largest day rate than the smallest one?', fixed: { expected: '$2.00', compute: diff(most(m(8.0), m(9.0), m(7.0)), least(m(8.0), m(9.0), m(7.0))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Between the baker and the bus driver, who earns more in a pretend day?',
            choices: ['The baker earns more', 'The bus driver earns more', 'They earn the same'],
            fixed: { expected: 'The baker earns more', compute: sel(m(8.0), m(7.0), 'The bus driver earns more', 'They earn the same', 'The baker earns more') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'On the poster, Marisol shows the baker working two pretend days in a row while the librarian works one.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the baker earn across two pretend days?', fixed: { expected: '$16.00', compute: scale(m(8.0), 2) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than the librarian\'s one pretend day?', fixed: { expected: '$7.00', compute: diff(scale(m(8.0), 2), m(9.0)) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Marisol\'s poster shows pay, but pay is not the whole story of a job.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Besides the pretend pay, name one reason someone in Marisol\'s invented town might choose one of these jobs.' }],
      },
    ],
    rubric: [
      crit(
        'Reasons beyond pay',
        'The response repeats a pay amount from Marisol\'s poster instead of naming another reason.',
        'A non-pay reason is named for Marisol\'s town but stated so generally that it fits any job at all.',
        'The response names a specific non-pay reason tied to one of Marisol\'s three jobs, such as enjoying baking or helping readers find books.',
      ),
    ],
    remediation:
      'If a learner subtracts the wrong pair when finding the spread, have them order the three pretend rate cards from smallest to largest on the desk first, so the highest and lowest are the two ends being compared rather than whichever numbers were read first.',
    extension: 'Ask the learner to invent a fourth job for Marisol\'s town with a day rate between $7.00 and $9.00 and explain where it lands in the ordering.',
  },
  {
    key: 'g3-u02-l03',
    authority: 'FIXED',
    character: 'Ivy',
    objective:
      'Learners track an invented count of finished work across three weeks of practice, find the growth between weeks, and project a steady rate forward.',
    scenario:
      'Ivy is a made-up third grader learning to fold napkins at a pretend family restaurant. In week one she folds 4 napkins in ten minutes, in week two she folds 7, and in week three she folds 9. These counts are invented to show what practice does.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compare Ivy\'s first week with her third week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'napkins', text: 'How many more napkins does Ivy fold in week three than in week one?', fixed: { expected: '5', compute: diff({ op: 'count', n: 9 }, { op: 'count', n: 4 }) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now look at all three of Ivy\'s practice weeks together, then check whether the second week was really an improvement on the first.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'napkins', text: 'How many napkins does Ivy fold across all three weeks?', fixed: { expected: '20', compute: sum({ op: 'count', n: 4 }, { op: 'count', n: 7 }, { op: 'count', n: 9 }) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does Ivy\'s week two compare with her week one?',
            choices: ['Fewer in week two', 'The same in both weeks', 'More in week two'],
            fixed: { expected: 'More in week two', compute: sel({ op: 'count', n: 7 }, { op: 'count', n: 4 }, 'Fewer in week two', 'The same in both weeks', 'More in week two') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Suppose Ivy holds steady at her week-three speed of 9 napkins for the next four practice weeks.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'napkins', text: 'How many napkins would Ivy fold across those four weeks?', fixed: { expected: '36', compute: scale({ op: 'count', n: 9 }, 4) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'napkins', text: 'How many more is that than her first three weeks put together?', fixed: { expected: '16', compute: diff(scale({ op: 'count', n: 9 }, 4), sum({ op: 'count', n: 4 }, { op: 'count', n: 7 }, { op: 'count', n: 9 })) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Ivy did not get faster by accident.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What does Ivy\'s week-by-week change show about what practice does to a skill someone gets paid for?' }],
      },
    ],
    rubric: [
      crit(
        'Linking practice to skill',
        'The response states a count from Ivy\'s table without saying anything about practice.',
        'Ivy is said to be getting better, but the weekly counts are not used as the evidence for it.',
        'The response uses Ivy\'s rising counts across the three weeks as evidence that repeated practice made the skill faster, and connects a faster skill to being worth more at work.',
      ),
    ],
    remediation:
      'When a learner adds instead of comparing, write Ivy\'s three weekly counts on separate cards and slide the week-one card directly beneath the week-three card, so the question of how many more is answered by looking at the gap between two rows.',
    extension: 'Have the learner sketch what Ivy\'s fourth week might look like if practice keeps helping but she cannot fold faster than twelve, and explain the ceiling.',
  },
  {
    key: 'g3-u02-l04',
    authority: 'FIXED',
    character: 'Owen',
    objective:
      'Learners total the invented minutes spent on unpaid household work, identify the longest job, and scale the routine across several days to see the size of work that carries no pay.',
    scenario:
      'Owen is an invented third grader who helps at home without being paid. In a made-up evening he sweeps for 15 minutes, dries dishes for 10 minutes, and folds laundry for 20 minutes. The minutes are invented for this task.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add up Owen\'s three invented evening jobs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'minutes', text: 'How many minutes does Owen spend helping in one pretend evening?', fixed: { expected: '45', compute: sum({ op: 'count', n: 15 }, { op: 'count', n: 10 }, { op: 'count', n: 20 }) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Look at Owen\'s three jobs one at a time rather than as a single block, and find which one takes the biggest share of the evening.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'minutes', text: 'How long is Owen\'s longest single job?', fixed: { expected: '20', compute: most({ op: 'count', n: 15 }, { op: 'count', n: 10 }, { op: 'count', n: 20 }) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which takes Owen longer, folding laundry or drying dishes?',
            choices: ['Folding laundry takes longer', 'Drying dishes takes longer', 'They take the same time'],
            fixed: { expected: 'Folding laundry takes longer', compute: sel({ op: 'count', n: 20 }, { op: 'count', n: 10 }, 'Drying dishes takes longer', 'They take the same time', 'Folding laundry takes longer') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Owen does the same three jobs on three pretend evenings in a row.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'minutes', text: 'How many minutes of unpaid help is that across the three evenings?', fixed: { expected: '135', compute: scale(sum({ op: 'count', n: 15 }, { op: 'count', n: 10 }, { op: 'count', n: 20 }), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'minutes', text: 'How many more minutes is that than a single evening?', fixed: { expected: '90', compute: diff(scale(sum({ op: 'count', n: 15 }, { op: 'count', n: 10 }, { op: 'count', n: 20 }), 3), sum({ op: 'count', n: 15 }, { op: 'count', n: 10 }, { op: 'count', n: 20 })) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'None of Owen\'s evening jobs comes with pay.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Owen is not paid for any of these minutes. Why does the work still matter to his household?' }],
      },
    ],
    rubric: [
      crit(
        'Valuing unpaid work',
        'The response says Owen\'s work does not count because no money changed hands.',
        'Owen\'s help is called good or nice without naming what it actually does for the household.',
        'The response explains that Owen\'s minutes do real work the household needs, such as clean dishes and folded laundry, and that being unpaid does not make the work worth less.',
      ),
    ],
    remediation:
      'If a learner multiplies a single job instead of the whole evening, have them total one evening on a strip of paper first and then lay three identical strips end to end, so the tripling is applied to the finished evening rather than to one chore.',
    extension: 'Ask the learner to add one more unpaid job to Owen\'s evening with a time under fifteen minutes and recompute the three-evening total.',
  },
  {
    key: 'g3-u02-l05',
    authority: 'FIXED',
    character: 'Ben',
    objective:
      'Learners separate invented money that was given from invented money that was earned, total both, and compare the two sources as they change over two pretend weeks.',
    scenario:
      'Ben is a made-up third grader keeping a pretend money record. This imaginary week he receives a $5.00 birthday gift, a $3.00 allowance for being part of the family, and $2.00 he earned washing a neighbour\'s pretend bicycle. None of these amounts are real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add everything that came into Ben\'s pretend record this week.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much pretend money does Ben have in total this week?', fixed: { expected: '$10.00', compute: sum(m(5.0), m(3.0), m(2.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Not all of Ben\'s money arrived the same way. Set the $2.00 he earned beside the $5.00 he was given as a gift.',
        prompts: [
          {
            ref: 't2-p1',
            promptType: 'fixed-choice',
            text: 'Which is larger in Ben\'s record this week, the money he earned or the birthday gift?',
            choices: ['The money he earned is larger', 'They are equal', 'The gift is larger'],
            fixed: { expected: 'The gift is larger', compute: sel(m(2.0), m(5.0), 'The gift is larger', 'They are equal', 'The money he earned is larger') },
          },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is it?', fixed: { expected: '$3.00', compute: diff(m(5.0), m(2.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'The following pretend week, no gift arrives, but Ben earns $4.00 more from washing bicycles on top of the $2.00 he already earned.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much has Ben now earned in total from washing bicycles?', fixed: { expected: '$6.00', compute: sum(m(2.0), m(4.0)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'How does Ben\'s total earned money now compare with the $5.00 gift?',
            choices: ['Earned money is smaller', 'They are equal', 'Earned money is larger'],
            fixed: { expected: 'Earned money is larger', compute: sel(sum(m(2.0), m(4.0)), m(5.0), 'Earned money is smaller', 'They are equal', 'Earned money is larger') },
          },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Gifts and earnings both spend the same, but they do not arrive the same way.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What is the difference between the $5.00 Ben was given and the $6.00 he earned?' }],
      },
    ],
    rubric: [
      crit(
        'Distinguishing gifts from earnings',
        'The response treats Ben\'s gift and earnings as the same thing with no difference named.',
        'A difference is stated for Ben but only in terms of the amounts rather than how each arrived.',
        'The response explains that Ben\'s gift came from someone else\'s choice while the earned money came from work he did, and notes that he can repeat earning but cannot count on gifts.',
      ),
    ],
    remediation:
      'When a learner blends the sources, split the record into two columns headed given and earned, re-enter each pretend amount under the right heading, and only then ask for any comparison between them.',
    extension: 'Have the learner plan how many more pretend bicycle washes at $2.00 Ben needs before his earnings alone reach $10.00.',
  },
  {
    key: 'g3-u02-l06',
    authority: 'JUDGMENT',
    character: 'Priya',
    objective:
      'Learners judge whether an invented sharing arrangement was fair, and practise thanking people for work that was given rather than paid for.',
    scenario:
      'Priya is an imaginary third grader whose pretend class ran a bake sale. Three invented classmates each promised an equal share of the setting up. One of them did most of the work while another left early, and a made-up neighbour donated all the flour for free. Everything here is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Talk through the invented bake sale with Priya. All three classmates agreed to share the work equally, and the work was not shared equally in the end. Describe what happened before deciding what anyone deserves.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What did the three invented classmates agree to, and what actually happened?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Priya has to decide how the pretend bake sale earnings are split. Write what you would do about the classmate who left early, and say what makes your decision fair rather than just harsh or just easy.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What is a fair way to handle the split, and what makes it fair?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The invented neighbour gave the flour and asked for nothing back.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Write the thank-you Priya could say to the neighbour, naming what the neighbour actually gave.' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about fairness',
        'Priya\'s decision is stated with no reason, or punishes the classmate without reference to the agreement.',
        'A workable split is proposed for Priya\'s sale but the reason does not connect to what each classmate actually did.',
        'The response ties Priya\'s split to the work each classmate really did against what was agreed, and stays respectful toward the classmate who left early.',
      ),
      crit(
        'Thanking for unpaid help',
        'The thank-you Priya offers is missing or names nothing the neighbour did.',
        'Priya\'s thank-you is polite but generic, and could be addressed to anyone.',
        'Priya\'s thank-you names the donated flour specifically and recognises that the neighbour gave something of value without being paid.',
      ),
    ],
    lookFors: [
      'Refers to the agreement the three invented classmates made, not only to the outcome.',
      'Proposes a split and gives a reason for it that a classmate could hear without being shamed.',
      'Names the donated flour in the thank-you rather than thanking in general.',
      'Does not suggest telling other people that a classmate is lazy or bad.',
    ],
    remediation:
      'If a learner jumps straight to punishment, re-read the agreement aloud and ask what each classmate promised and what each did, one line at a time, before any decision about the money is written.',
    extension: 'Ask the learner to write the sentence Priya could say to the classmate who left early, in a way that names the problem without name-calling.',
  },
  {
    key: 'g3-u03-l01',
    authority: 'FIXED',
    character: 'Dev',
    objective:
      'Learners find the value of groups of like pretend coins by repeated addition, combine the groups into one total, and compare the total against a pretend price.',
    scenario:
      'Dev is a made-up third grader counting a handful of play coins for a pretend market game: 3 quarters, 4 dimes, and 2 nickels. A quarter is $0.25, a dime is $0.10, and a nickel is $0.05. The coins are toy coins from a classroom set.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Start with Dev\'s three play quarters at $0.25 each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are Dev\'s three quarters worth altogether?', fixed: { expected: '$0.75', compute: scale(m(0.25), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now count Dev\'s dimes as their own group before mixing anything together, then bring all three groups into a single total.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are Dev\'s four dimes worth altogether?', fixed: { expected: '$0.40', compute: scale(m(0.1), 4) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the value of all of Dev\'s coins together?', fixed: { expected: '$1.25', compute: sum(scale(m(0.25), 3), scale(m(0.1), 4), scale(m(0.05), 2)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Dev finds 5 more play pennies, worth $0.01 each, and wants a pretend market item priced at $1.50.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the value of all of Dev\'s coins now?', fixed: { expected: '$1.30', compute: sum(scale(m(0.25), 3), scale(m(0.1), 4), scale(m(0.05), 2), scale(m(0.01), 5)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'Is that enough for the $1.50 pretend item?',
            choices: ['Not enough', 'Exactly enough', 'More than enough'],
            fixed: { expected: 'Not enough', compute: sel(sum(scale(m(0.25), 3), scale(m(0.1), 4), scale(m(0.05), 2), scale(m(0.01), 5)), m(1.5), 'Not enough', 'Exactly enough', 'More than enough') },
          },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Dev counted coins in groups rather than one at a time.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Why is counting the quarters as a group easier than counting every coin one by one?' }],
      },
    ],
    rubric: [
      crit(
        'Explaining grouped counting',
        'The response says Dev\'s way is faster with no reason connected to the coins.',
        'Grouping is described for Dev but the equal value of the coins in a group is not mentioned.',
        'The response explains that all of Dev\'s quarters are worth the same, so they can be counted in one repeated jump instead of one coin at a time.',
      ),
    ],
    remediation:
      'When a learner counts every coin as one unit, sort the play coins into three piles by type and count each pile in its own skip-count aloud, so quarters are counted by twenty-fives rather than by ones.',
    extension: 'Ask the learner which single extra play coin would take Dev from $1.30 to exactly $1.50, and to show why no other single coin works.',
  },
  {
    key: 'g3-u03-l02',
    authority: 'FIXED',
    character: 'Lena',
    objective:
      'Learners compare two invented prices for the same item, find the difference, and scale the saving across several units to see that a small gap repeats.',
    scenario:
      'Lena is an invented third grader comparing two pretend stores for the same pack of pencils. The made-up Corner Store charges $2.40 a pack and the made-up Market Stand charges $2.15 a pack. The packs and the stores are both imaginary.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Look at Lena\'s two pretend prices for the identical pencil pack.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the lower of Lena\'s two pretend prices?', fixed: { expected: '$2.15', compute: least(m(2.4), m(2.15)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find how far apart Lena\'s two stores are on the same pack, then say plainly which store is the cheaper one.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is the Market Stand pack than the Corner Store pack?', fixed: { expected: '$0.25', compute: diff(m(2.4), m(2.15)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which pretend store sells the pencil pack for less?',
            choices: ['The Corner Store', 'The Market Stand', 'They charge the same'],
            fixed: { expected: 'The Market Stand', compute: sel(m(2.15), m(2.4), 'The Market Stand', 'They charge the same', 'The Corner Store') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Lena\'s pretend class needs 3 identical packs, and every pack costs the same at each store.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 3 packs cost at the Market Stand?', fixed: { expected: '$6.45', compute: scale(m(2.15), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that than 3 packs at the Corner Store?', fixed: { expected: '$0.75', compute: diff(scale(m(2.4), 3), scale(m(2.15), 3)) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'The gap on one pack was small; the gap on three was not.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Why is comparing prices worth Lena\'s time even when the difference on one pack looks tiny?' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about repeated savings',
        'The response says comparing is good for Lena without connecting to any amount.',
        'Lena\'s saving is mentioned but only for a single pack, with no notice that it repeats.',
        'The response explains that Lena\'s $0.25 gap repeats with every pack, so buying three turns a small difference into a noticeably larger one.',
      ),
    ],
    remediation:
      'If a learner compares the totals by re-adding both stores from scratch and loses track, have them find the one-pack gap first and add that same gap three times, so the repeated structure is visible rather than buried in two long sums.',
    extension: 'Ask the learner how many packs Lena would have to buy before the saving passes $1.00, and to justify the count.',
  },
  {
    key: 'g3-u03-l03',
    authority: 'FIXED',
    character: 'Hana',
    objective:
      'Learners test whether a bigger invented package is actually the better buy for the amount actually needed, by comparing totals for the same quantity rather than sticker prices.',
    scenario:
      'Hana is a made-up third grader at a pretend snack stall. An invented big box holds 8 crackers for $4.00 and an invented small box holds 4 crackers for $2.50. Hana only wants 4 crackers today. All boxes and prices here are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'First get the same number of crackers two different ways. Two of Hana\'s small boxes hold 8 crackers, the same as one big box.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do two small boxes cost?', fixed: { expected: '$5.00', compute: scale(m(2.5), 2) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now compare those two small boxes against the single big box, remembering that both give Hana 8 crackers.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'For 8 crackers, how much less does the big box cost than two small boxes?', fixed: { expected: '$1.00', compute: diff(scale(m(2.5), 2), m(4.0)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'If Hana truly wanted 8 crackers, which is the better buy?',
            choices: ['The big box', 'Two small boxes', 'They cost the same'],
            fixed: { expected: 'The big box', compute: sel(m(4.0), scale(m(2.5), 2), 'The big box', 'They cost the same', 'Two small boxes') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Hana only wants 4 crackers today, and the extra crackers in the big box would go stale before anyone eats them.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'For the 4 crackers Hana actually wants, how much less does the small box cost than the big box?', fixed: { expected: '$1.50', compute: diff(m(4.0), m(2.5)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'For today\'s 4 crackers, which box costs Hana less?',
            choices: ['The big box', 'The small box', 'They cost the same'],
            fixed: { expected: 'The small box', compute: sel(m(2.5), m(4.0), 'The small box', 'They cost the same', 'The big box') },
          },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'The big box won one comparison and lost the other.',
        prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain how the same big box can be the better buy in one question and the worse buy in the next.' }],
      },
    ],
    rubric: [
      crit(
        'Comparing against what is actually needed',
        'The response claims Hana\'s bigger box is always better or always worse, with no mention of quantity.',
        'The response notices the two answers differ but does not name the amount Hana actually wants as the reason.',
        'The response explains that the big box wins when Hana genuinely wants 8 crackers and loses when she wants 4, because crackers she will not eat are money spent for nothing.',
      ),
    ],
    remediation:
      'When a learner picks by sticker price alone, draw the crackers as circles under each option and cross out the ones Hana will not eat, so the comparison is made on the crackers she actually gets to use.',
    extension: 'Ask the learner what the big box would have to cost before it beats the small box for a learner who only ever wants 4 crackers.',
  },
  {
    key: 'g3-u03-l04',
    authority: 'FIXED',
    character: 'Jonah',
    objective:
      'Learners build the total of an invented shopping list, check it against pretend money on hand, and test what one more item does to a plan that had room in it.',
    scenario:
      'Jonah is an imaginary third grader writing a pretend grocery list for a made-up family dinner: bread $2.50, apples $3.25, rice $4.00, and milk $2.75. He has $15.00 in pretend money. Nothing is being bought for real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add every item on Jonah\'s pretend list.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Jonah\'s whole list cost?', fixed: { expected: '$12.50', compute: sum(m(2.5), m(3.25), m(4.0), m(2.75)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Hold Jonah\'s list total against the $15.00 he brought, and say how much room the plan still has.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of Jonah\'s $15.00 is left after the list?', fixed: { expected: '$2.50', compute: diff(m(15.0), sum(m(2.5), m(3.25), m(4.0), m(2.75))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Does Jonah\'s list fit inside his $15.00?',
            choices: ['It fits with money to spare', 'It comes out exactly even', 'It does not fit'],
            fixed: { expected: 'It fits with money to spare', compute: sel(sum(m(2.5), m(3.25), m(4.0), m(2.75)), m(15.0), 'It fits with money to spare', 'It comes out exactly even', 'It does not fit') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'At the pretend counter Jonah adds a $3.00 block of cheese to the same list.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Jonah\'s list cost with the cheese added?', fixed: { expected: '$15.50', compute: sum(m(2.5), m(3.25), m(4.0), m(2.75), m(3.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far past his $15.00 does that put Jonah?', fixed: { expected: '$0.50', compute: diff(sum(m(2.5), m(3.25), m(4.0), m(2.75), m(3.0)), m(15.0)) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Jonah had $2.50 of room and the cheese cost $3.00.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Jonah had room left over but still went over. Explain how both of those can be true at the same time.' }],
      },
    ],
    rubric: [
      crit(
        'Reasoning about room in a plan',
        'The response repeats a total without addressing how Jonah both had room and went over.',
        'Jonah is said to have spent too much, but the size of the room is not compared with the price of the cheese.',
        'The response compares Jonah\'s $2.50 of room with the $3.00 cheese and concludes that room only helps when it is at least as large as the thing being added.',
      ),
    ],
    remediation:
      'If a learner treats any leftover as enough for anything, mark the $2.50 of room as a physical gap on a number line and slide a $3.00 strip into it, so the overhang is seen before it is calculated.',
    extension: 'Have the learner remove exactly one item from Jonah\'s list so the cheese fits, and show the two totals that prove it works.',
  },
  {
    key: 'g3-u03-l05',
    authority: 'FIXED',
    character: 'Talia',
    objective:
      'Learners re-add an invented total that was recorded incorrectly, measure the size of the recording error, and re-test the corrected plan when one more item is added.',
    scenario:
      'Talia is a made-up third grader who wrote down a pretend supply total of $9.30 for three invented items: paper $3.45, markers $2.85, and tape $2.90. She has $10.00 in pretend money. The error in her record is the point of this task.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Talia\'s three pretend prices yourself before comparing with what she recorded.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the correct total of Talia\'s three items?', fixed: { expected: '$9.20', compute: sum(m(3.45), m(2.85), m(2.9)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Talia recorded $9.30. Put your total beside hers and measure the gap, then check the corrected total against her $10.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much is Talia\'s recorded total off?', fixed: { expected: '$0.10', compute: diff(m(9.3), sum(m(3.45), m(2.85), m(2.9))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Does the corrected total fit inside Talia\'s $10.00?',
            choices: ['It fits', 'It comes out exactly even', 'It does not fit'],
            fixed: { expected: 'It fits', compute: sel(sum(m(3.45), m(2.85), m(2.9)), m(10.0), 'It fits', 'It comes out exactly even', 'It does not fit') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Talia adds an $0.85 glue stick to the corrected list, not to her old recorded total.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Talia\'s new corrected total with the glue stick?', fixed: { expected: '$10.05', compute: sum(m(3.45), m(2.85), m(2.9), m(0.85)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far past her $10.00 does that go?', fixed: { expected: '$0.05', compute: diff(sum(m(3.45), m(2.85), m(2.9), m(0.85)), m(10.0)) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'A ten-cent error looked harmless at first.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Talia\'s error was only $0.10. Explain why checking a total still matters when the mistake is small.' }],
      },
    ],
    rubric: [
      crit(
        'Valuing the check',
        'The response says small errors do not matter for Talia\'s list.',
        'Checking is called useful for Talia but no consequence of the error is named.',
        'The response explains that Talia\'s small error sits inside every later decision, and that a plan this close to $10.00 can be pushed over by a dime.',
      ),
    ],
    remediation:
      'When a learner cannot find where the ten cents went, re-add Talia\'s three prices in the reverse order and compare the two runs, so the disagreeing step is located rather than the whole sum being redone under the same habit.',
    extension: 'Ask the learner to change exactly one of Talia\'s prices so the glue stick fits inside $10.00, and show both totals.',
  },
  {
    key: 'g3-u03-l06',
    authority: 'FIXED',
    character: 'Kwame',
    objective:
      'Learners measure how far an invented plan overshoots the money available, remove one item to repair it, and confirm the repaired plan fits.',
    scenario:
      'Kwame is an invented third grader planning a pretend fair outing: a game booth for $6.00, a snack for $2.25, and a small gift for his sister for $4.50. He has $11.00 in pretend fair money. Every price here is made up.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Kwame\'s pretend plan exactly as he first wrote it.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Kwame\'s first plan cost in total?', fixed: { expected: '$12.75', compute: sum(m(6.0), m(2.25), m(4.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that total with the $11.00 Kwame actually has, and name the size of the problem before trying to fix it.',
        prompts: [
          {
            ref: 't2-p1',
            promptType: 'fixed-choice',
            text: 'How does Kwame\'s first plan compare with his $11.00?',
            choices: ['It fits', 'It comes out exactly even', 'It runs short'],
            fixed: { expected: 'It runs short', compute: sel(sum(m(6.0), m(2.25), m(4.5)), m(11.0), 'It fits', 'It comes out exactly even', 'It runs short') },
          },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much does the first plan run short?', fixed: { expected: '$1.75', compute: diff(sum(m(6.0), m(2.25), m(4.5)), m(11.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Kwame decides the gift for his sister stays and the snack goes.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Kwame\'s changed plan cost?', fixed: { expected: '$10.50', compute: sum(m(6.0), m(4.5)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of his $11.00 is left after the changed plan?', fixed: { expected: '$0.50', compute: diff(m(11.0), sum(m(6.0), m(4.5))) } },
        ],
      },
      {
        taskId: 't4',
        kind: 'reflection',
        directions: 'Kwame kept the gift and gave up the snack.',
        prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Kwame had to drop something. What does his choice show about what mattered most to him that day?' }],
      },
    ],
    rubric: [
      crit(
        'Reading a choice under a limit',
        'The response restates what Kwame dropped without saying anything about what it shows.',
        'Kwame\'s priority is named but not tied to the fact that his money forced a cut.',
        'The response explains that Kwame\'s money ran out first, and that keeping his sister\'s gift while cutting his own snack shows what he treated as most important.',
      ),
    ],
    remediation:
      'If a learner cuts an item at random, list Kwame\'s three items with the shortfall written above them and ask which single item is at least as large as the gap, so the repair is chosen against a measured target.',
    extension: 'Ask the learner to find a different single change that also brings Kwame\'s plan inside $11.00 and to say which repair they would prefer and why.',
  },
]
