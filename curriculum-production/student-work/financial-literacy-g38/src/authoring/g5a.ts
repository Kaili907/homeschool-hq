import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, least, m, most, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 5 Financial Literacy, units 1-3: values and tradeoffs, earning and work, spending and budgeting. */
export const G5A: readonly AuthoredLesson[] = [
  {
    key: 'g5-u01-l01',
    authority: 'FIXED',
    character: 'Camille',
    objective:
      'Learners separate an invented month of spending into needs and wants, total each, and judge how much of a simulated income is committed before any choice is made.',
    scenario:
      'Camille is a made-up fifth grader planning an invented month on $180.00 of simulated money. Her needs list holds $65.00 of groceries, $48.00 of transport, and $22.00 of school supplies. Her wants list holds a $25.00 game and $18.00 of art materials.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Camille\'s three invented needs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Camille\'s needs come to?', fixed: { expected: '$135.00', compute: sum(m(65.0), m(48.0), m(22.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total the wants separately, then combine both groups and compare the whole plan with the $180.00 available for the invented month.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Camille\'s wants come to?', fixed: { expected: '$43.00', compute: sum(m(25.0), m(18.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $180.00 is left after the whole plan?', fixed: { expected: '$2.00', compute: diff(m(180.0), sum(m(65.0), m(48.0), m(22.0), m(25.0), m(18.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Groceries rise to $78.00 in the invented month and everything else holds steady.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the whole plan cost with the higher grocery figure?', fixed: { expected: '$191.00', compute: sum(m(78.0), m(48.0), m(22.0), m(25.0), m(18.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must Camille cut to stay inside $180.00?', fixed: { expected: '$11.00', compute: diff(sum(m(78.0), m(48.0), m(22.0), m(25.0), m(18.0)), m(180.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The rise fell on a need.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Camille has to find $11.00. Explain which items you would look at first and why priority order, not preference, should drive the cut.' }] },
    ],
    rubric: [
      crit(
        'Prioritising under a rising cost',
        'The response cuts one of Camille\'s needs with no reasoning about consequence.',
        'A want is cut for Camille but only because it is the item she would miss least.',
        'The response cuts from Camille\'s wants and justifies it by what each item does, noting that groceries and transport carry consequences the game and art materials do not.',
      ),
    ],
    remediation:
      'When a learner cuts by preference, cover the prices and have them write the consequence of losing each item for Camille, then restore the prices and cut only where no consequence was written.',
    extension: 'Ask the learner to rebuild Camille\'s month under the higher grocery cost so it lands exactly on $180.00, showing both group totals.',
  },
  {
    key: 'g5-u01-l02',
    authority: 'FIXED',
    character: 'Bo',
    objective:
      'Learners evaluate every pairing of invented options against a fixed simulated limit, identify which fit, and quantify both overshoot and unused money.',
    scenario:
      'Bo is an invented fifth grader with $120.00 of simulated trip money. Three made-up excursions cost $78.50 for a caving trip, $54.25 for a river walk, and $39.90 for a museum day. Bo can pick at most two.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Bo\'s caving trip with the river walk.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the caving trip and river walk cost together?', fixed: { expected: '$132.75', compute: sum(m(78.5), m(54.25)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Measure that pair against Bo\'s $120.00, then test the caving trip paired with the museum day instead.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much does the caving and river pair overshoot $120.00?', fixed: { expected: '$12.75', compute: diff(sum(m(78.5), m(54.25)), m(120.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $120.00 is left after the caving trip and museum day?', fixed: { expected: '$1.60', compute: diff(m(120.0), sum(m(78.5), m(39.9))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Test Bo\'s last pairing, the river walk with the museum day, and compare what it leaves against the other affordable pair.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $120.00 is left after the river walk and museum day?', fixed: { expected: '$25.85', compute: diff(m(120.0), sum(m(54.25), m(39.9))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does that pair leave than the caving and museum pair?', fixed: { expected: '$24.25', compute: diff(diff(m(120.0), sum(m(54.25), m(39.9))), diff(m(120.0), sum(m(78.5), m(39.9)))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Two of Bo\'s three pairs fit, and they leave very different amounts.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Which affordable pair should Bo choose, and what would make the more expensive pair worth the smaller leftover?' }] },
    ],
    rubric: [
      crit(
        'Weighing affordability against value',
        'The response chooses for Bo purely by which pair costs least.',
        'A choice is made for Bo but the leftover is not connected to anything it could be used for.',
        'The response weighs what Bo gains from each pair against the money left over, and names a use for the leftover that could justify either choice.',
      ),
    ],
    remediation:
      'If a learner tests pairs at random and loses track, make a three-row table of Bo\'s pairs with total and leftover columns and require every row to be filled before any decision.',
    extension: 'Ask the learner what the caving trip would need to cost for all three of Bo\'s pairs to fit inside $120.00.',
  },
  {
    key: 'g5-u01-l03',
    authority: 'FIXED',
    character: 'Tomo',
    objective:
      'Learners use money as a common measure by converting invented bulk prices to per-item prices and applying the better rate to a larger order.',
    scenario:
      'Tomo is a made-up fifth grader ordering supplies for a pretend club. One invented option is 12 notebooks for $8.40; another is 20 of the same notebooks for $12.00. The club needs 24 notebooks.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Tomo\'s 12-for-$8.40 option into a price for one notebook.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price per notebook in the 12-pack?', fixed: { expected: '$0.70', compute: div(m(8.4), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Do the same with Tomo\'s 20-for-$12.00 option, then compare the two per-notebook prices instead of the pack prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price per notebook in the 20-pack?', fixed: { expected: '$0.60', compute: div(m(12.0), 20) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which option gives Tomo the lower price per notebook?',
            choices: ['The 12-pack', 'The 20-pack', 'They are equal per notebook'],
            fixed: { expected: 'The 20-pack', compute: sel(div(m(12.0), 20), div(m(8.4), 12), 'The 20-pack', 'They are equal per notebook', 'The 12-pack') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Tomo orders all 24 notebooks at whichever per-notebook price is better, then compares that with ordering all 24 at the worse rate.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 24 notebooks cost at the better per-notebook price?', fixed: { expected: '$14.40', compute: scale(div(m(12.0), 20), 24) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does that save against 24 at the higher per-notebook price?', fixed: { expected: '$2.40', compute: diff(scale(div(m(8.4), 12), 24), scale(div(m(12.0), 20), 24)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Money made two different-sized packs comparable.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Tomo could not compare a 12-pack with a 20-pack directly. What job did money do here that counting notebooks could not?' }] },
    ],
    rubric: [
      crit(
        'Money as a unit of comparison',
        'The response compares Tomo\'s pack prices without reference to quantity.',
        'Per-notebook price is used for Tomo but not described as what made comparison possible.',
        'The response explains that money let Tomo put two different pack sizes on a single scale, which is what makes the better value visible.',
      ),
    ],
    remediation:
      'When a learner compares totals only, have them write both of Tomo\'s options as a price for exactly one notebook before any comparison is spoken aloud.',
    extension: 'Ask the learner what a 15-notebook pack would need to cost to beat Tomo\'s best per-notebook price.',
  },
  {
    key: 'g5-u01-l04',
    authority: 'FIXED',
    character: 'Delphine',
    objective:
      'Learners compute an advertised percentage discount from invented prices and test a vaguer advertising claim against the arithmetic.',
    scenario:
      'Delphine is an invented fifth grader looking at a pretend advertisement for a $45.00 jacket. The invented banner says 20% off today, while the headline shouts practically half price. All prices and claims are invented for checking.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 20% discount to Delphine\'s $45.00 jacket.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the 20% discount take off?', fixed: { expected: '$9.00', compute: pct(m(45.0), 2000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out what Delphine actually pays, then work out what half price would have been so the two can be compared.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the discounted price?', fixed: { expected: '$36.00', compute: diff(m(45.0), pct(m(45.0), 2000)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would a true half-price jacket cost?', fixed: { expected: '$22.50', compute: div(m(45.0), 2) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the headline claim with the actual offer, then check what the same discount does on a $60.00 invented coat.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How far is the real discounted price from a true half price?', fixed: { expected: '$13.50', compute: diff(diff(m(45.0), pct(m(45.0), 2000)), div(m(45.0), 2)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would a $60.00 coat cost after the same 20% off?', fixed: { expected: '$48.00', compute: diff(m(60.0), pct(m(60.0), 2000)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The banner and the headline described the same offer.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'The banner was accurate and the headline was not. Why would an advertisement put both on the same page?' }] },
    ],
    rubric: [
      crit(
        'Testing an advertising claim',
        'The response treats Delphine\'s headline as equivalent to the stated percentage.',
        'The discrepancy is noticed but the reason for the vaguer wording is not addressed.',
        'The response explains that Delphine\'s headline works on impression while the banner carries the checkable fact, and that the arithmetic settles which one to trust.',
      ),
    ],
    remediation:
      'When a learner subtracts the percentage as dollars, work 20% of $100.00 for Delphine first, then apply the same reasoning to the $45.00 price.',
    extension: 'Ask the learner what percentage off would make the headline honest for Delphine\'s jacket, and to prove it.',
  },
  {
    key: 'g5-u01-l05',
    authority: 'FIXED',
    character: 'Arun',
    objective:
      'Learners run a stated decision routine over two invented options with different structures, computing totals, differences, and what each leaves behind.',
    scenario:
      'Arun is a made-up fifth grader with $110.00 of simulated money and a written routine: name the goal, total each option, compare, then check what remains. Option one is a $96.00 all-in music course. Option two is an $84.50 course plus a $15.00 book.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Arun\'s second option, which has two invented parts.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does option two cost in total?', fixed: { expected: '$99.50', compute: sum(m(84.5), m(15.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare Arun\'s two option totals against each other, then say which one costs less.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does option two cost than option one?', fixed: { expected: '$3.50', compute: diff(sum(m(84.5), m(15.0)), m(96.0)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which option costs Arun less?',
            choices: ['Option one, the all-in course', 'Option two, the course plus book', 'They cost the same'],
            fixed: { expected: 'Option one, the all-in course', compute: sel(m(96.0), sum(m(84.5), m(15.0)), 'Option one, the all-in course', 'They cost the same', 'Option two, the course plus book') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Run the last step of Arun\'s routine, checking what each option leaves from his $110.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is left after option one?', fixed: { expected: '$14.00', compute: diff(m(110.0), m(96.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is left after option two?', fixed: { expected: '$10.50', compute: diff(m(110.0), sum(m(84.5), m(15.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The routine did not tell Arun which to pick.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Arun\'s routine produced numbers but not a decision. What information beyond cost does the final step still need?' }] },
    ],
    rubric: [
      crit(
        'Using a routine without outsourcing the decision',
        'The response treats Arun\'s cheaper total as the decision itself.',
        'The response says more information is needed for Arun but does not say what kind.',
        'The response names concrete information Arun still needs, such as whether the book is required or what each course includes, and treats cost as one input among several.',
      ),
    ],
    remediation:
      'If a learner stops at the smaller total, have them write what Arun receives under each option in words before either total is compared.',
    extension: 'Ask the learner to add a step to Arun\'s routine that checks whether the options are genuinely equivalent, and to explain why it belongs before the comparison.',
  },
  {
    key: 'g5-u01-l06',
    authority: 'JUDGMENT',
    character: 'Halle',
    objective:
      'Learners explain why invented households with identical simulated income make different plans, and practise discussing money without ranking families.',
    scenario:
      'Halle is an invented fifth grader in a pretend classroom exercise. Two made-up households each plan $900.00 of simulated monthly income: one puts a large share into a repair fund and a used car, the other into rent closer to work and no car at all. Both plans balance and neither household is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Read both invented plans with Halle. Each solves the problem of getting to work, and each pays for that solution in a different place. Describe the two approaches before evaluating either.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'How does each of Halle\'s invented households solve the same problem, and where does each one spend to do it?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'A classmate says the car-free household is obviously smarter. Write a response that engages with the actual tradeoffs rather than agreeing or dismissing.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What would each household have to give up to switch to the other plan, and why does that make ranking them unreliable?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Classroom talk about money can reach real families quickly.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'What is one way to keep this discussion about the invented plans rather than about real classmates?' }],
      },
    ],
    rubric: [
      crit(
        'Explaining tradeoffs without ranking',
        'The response declares one of Halle\'s households better with money.',
        'Both of Halle\'s plans are accepted but the tradeoffs are not identified.',
        'The response identifies what each of Halle\'s households gains and gives up, and explains that different circumstances make each plan defensible.',
      ),
      crit(
        'Keeping the discussion respectful',
        'The response drifts into judging real families or repeating private details.',
        'The response says to be careful without naming a concrete practice.',
        'The response names a concrete practice for Halle\'s class, such as speaking only about the invented households, and explains why it protects classmates.',
      ),
    ],
    lookFors: [
      'Names the transport problem both invented plans are solving.',
      'Identifies at least one thing each household gives up.',
      'Avoids ranking either household as smarter or better.',
      'Proposes a concrete way to keep the discussion off real families.',
    ],
    remediation:
      'If a learner ranks the plans, remove the totals and re-read both as descriptions of constraints, then ask which constraint they would be willing to live under.',
    extension: 'Ask the learner to write a third $900.00 plan for Halle\'s exercise that solves the same problem a third way, and to name its tradeoff.',
    safetyNotes: ['Discuss only the invented households on this sheet; do not describe any real family\'s income or spending.'],
  },
  {
    key: 'g5-u02-l01',
    authority: 'FIXED',
    character: 'Bruno',
    objective:
      'Learners combine invented hourly pay with an invented commission, compute a simulated total, and compare the reliability of the two income sources.',
    scenario:
      'Bruno is a made-up fifth grader studying a pretend pay stub. In an invented two-week period the worker logs 18 hours at $14.00 an hour and earns $45.00 in commission on sales. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out the hourly portion: 18 invented hours at $14.00 an hour.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the 18 hours pay?', fixed: { expected: '$252.00', compute: scale(m(14.0), 18) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the invented $45.00 commission to the hourly pay, then compare the size of the two sources.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the invented period\'s total pay?', fixed: { expected: '$297.00', compute: sum(scale(m(14.0), 18), m(45.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the hourly pay than the commission?', fixed: { expected: '$207.00', compute: diff(scale(m(14.0), 18), m(45.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'In a slower invented period the hours fall to 12 and no sales are made, so the commission is $0.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the slow period\'s total pay?', fixed: { expected: '$168.00', compute: sum(scale(m(14.0), 12), m(0.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that than the first invented period?', fixed: { expected: '$129.00', compute: diff(sum(scale(m(14.0), 18), m(45.0)), sum(scale(m(14.0), 12), m(0.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One source vanished entirely in the slow period.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Which part of this invented income should a budget be built on, and what should the other part be used for?' }] },
    ],
    rubric: [
      crit(
        'Planning around variable income',
        'The response treats both of Bruno\'s income sources as equally dependable.',
        'The hourly pay is identified as steadier but no use is suggested for the commission.',
        'The response builds the budget on the hourly portion of Bruno\'s example and assigns the commission to saving or one-off costs, because it can disappear entirely.',
      ),
    ],
    remediation:
      'If a learner combines hours and rate incorrectly, box the rate and the hours separately for Bruno and read the phrase "fourteen dollars for each hour" before writing the multiplication.',
    extension: 'Ask the learner how many hours at $14.00 would be needed to match the first period without any commission at all.',
  },
  {
    key: 'g5-u02-l02',
    authority: 'FIXED',
    character: 'Ngozi',
    objective:
      'Learners quantify the return on an invented training cost by computing the pay difference it creates and the time needed to recover the outlay.',
    scenario:
      'Ngozi is an invented fifth grader studying a pretend training decision. An invented certificate costs $120.00 and raises a simulated rate from $15.00 to $18.00 an hour, with 10 hours of work a week. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out a 10-hour week at Ngozi\'s untrained invented rate of $15.00.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a 10-hour week pay before training?', fixed: { expected: '$150.00', compute: scale(m(15.0), 10) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out the same 10-hour week at the trained rate of $18.00, then isolate the weekly gain the training produces.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a 10-hour week pay after training?', fixed: { expected: '$180.00', compute: scale(m(18.0), 10) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the weekly gain from the training?', fixed: { expected: '$30.00', compute: diff(scale(m(18.0), 10), scale(m(15.0), 10)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'The invented $120.00 certificate has to be paid for out of that weekly gain.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks of the gain repay the $120.00 certificate?', fixed: { expected: '4', compute: reach(m(120.0), diff(scale(m(18.0), 10), scale(m(15.0), 10))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much extra does the gain produce over 12 weeks, beyond the certificate cost?', fixed: { expected: '$240.00', compute: diff(scale(diff(scale(m(18.0), 10), scale(m(15.0), 10)), 12), m(120.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The payback assumed the hours stay at 10 a week.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Name two assumptions in this invented calculation that could fail, and say what each would do to the payback time.' }] },
    ],
    rubric: [
      crit(
        'Examining assumptions behind a return',
        'The response treats Ngozi\'s payback figure as certain.',
        'One assumption is named for Ngozi but its effect on the payback is not traced.',
        'The response names at least two assumptions in Ngozi\'s example, such as the hours holding steady or the higher rate being offered at all, and traces the effect of each on the payback time.',
      ),
    ],
    remediation:
      'If a learner divides the certificate cost by the hourly rate, restate the question as how many $30.00 weekly gains fit inside $120.00 and count the steps before dividing.',
    extension: 'Ask the learner what the certificate could cost at most for Ngozi to recover it within 3 weeks, and to justify the figure.',
  },
  {
    key: 'g5-u02-l03',
    authority: 'FIXED',
    character: 'Salma',
    objective:
      'Learners take stated percentage deductions from an invented gross figure to reach take-home pay, and see how each deduction changes the amount available.',
    scenario:
      'Salma is a made-up fifth grader reading a pretend pay statement. The invented gross pay is $400.00. Simulated deductions take 12% for taxes and a further 5% for a retirement set-aside. This is a teaching example, not a real pay statement.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 12% tax deduction to Salma\'s $400.00 gross.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is deducted for simulated taxes?', fixed: { expected: '$48.00', compute: pct(m(400.0), 1200) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply the 5% retirement set-aside to the same gross figure, then take both deductions off to reach take-home pay.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much goes to the retirement set-aside?', fixed: { expected: '$20.00', compute: pct(m(400.0), 500) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the take-home pay after both deductions?', fixed: { expected: '$332.00', compute: diff(m(400.0), sum(pct(m(400.0), 1200), pct(m(400.0), 500))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A busier invented period lifts the gross to $500.00 with the same two percentages applied.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do both deductions come to on a $500.00 gross?', fixed: { expected: '$85.00', compute: sum(pct(m(500.0), 1200), pct(m(500.0), 500)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the take-home pay on the $500.00 gross?', fixed: { expected: '$415.00', compute: diff(m(500.0), sum(pct(m(500.0), 1200), pct(m(500.0), 500))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The number on the offer was not the number that arrived.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Why should a budget be built on take-home pay rather than gross pay?' }] },
    ],
    rubric: [
      crit(
        'Distinguishing gross from take-home',
        'The response treats Salma\'s gross figure as the money available to spend.',
        'The difference is noticed for Salma but no consequence for budgeting is drawn.',
        'The response explains that Salma\'s deductions leave before any spending happens, so a budget built on gross pay would commit money that never arrives.',
      ),
    ],
    remediation:
      'If a learner applies the second percentage to the reduced amount, mark Salma\'s gross figure as the base for both deductions and recompute each from that marked figure.',
    extension: 'Ask the learner what gross pay Salma would need for take-home to reach exactly $415.00 under a single 17% deduction, and to justify the approach.',
  },
  {
    key: 'g5-u02-l04',
    authority: 'FIXED',
    character: 'Dmitri',
    objective:
      'Learners model an invented venture end to end, computing unit margin, run revenue, run cost, and profit, then test a change in the sales assumption.',
    scenario:
      'Dmitri is an invented fifth grader planning a pretend craft venture. Each invented unit costs $3.25 to make and sells for $6.00. He plans a run of 24 units for a simulated school fair.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compare Dmitri\'s invented price with his invented unit cost.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does Dmitri keep from one unit after its materials?', fixed: { expected: '$2.75', compute: diff(m(6.0), m(3.25)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Scale both sides across the run of 24 units, keeping revenue and cost as separate figures.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the run of 24 units cost to make?', fixed: { expected: '$78.00', compute: scale(m(3.25), 24) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the run bring in if all 24 sell?', fixed: { expected: '$144.00', compute: scale(m(6.0), 24) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out the profit if everything sells, then rework it for the case where only 16 units sell but all 24 were made.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the profit if all 24 sell?', fixed: { expected: '$66.00', compute: diff(scale(m(6.0), 24), scale(m(3.25), 24)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the profit if only 16 sell?', fixed: { expected: '$18.00', compute: diff(scale(m(6.0), 16), scale(m(3.25), 24)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Two-thirds of the units sold, and far less than two-thirds of the profit survived.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Dmitri\'s profit fell so much faster than his sales did, and what that suggests about planning the size of a run.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about fixed production and variable sales',
        'The response assumes Dmitri\'s costs fall with unsold units.',
        'The response notices profit falls faster but does not explain the mechanism.',
        'The response explains that Dmitri paid for all 24 units regardless, so unsold units remove revenue without removing cost, and connects that to sizing the run to expected demand.',
      ),
    ],
    remediation:
      'When a learner scales cost by units sold, label the cost line made and the revenue line sold for Dmitri, and fill each from the correct count.',
    extension: 'Ask the learner how many of Dmitri\'s 24 units must sell before the run breaks even, and to show the reasoning.',
  },
  {
    key: 'g5-u02-l05',
    authority: 'FIXED',
    character: 'Fern',
    objective:
      'Learners quantify invented unpaid community work in hours and translate it into a monetary value at a stated pretend rate.',
    scenario:
      'Fern is a made-up fifth grader documenting a pretend community garden build. Three invented volunteers each work 6 hours, and the invented equivalent paid rate is $16.00 an hour. Materials cost $95.00. Nobody is actually paid.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total the invented volunteer hours: 3 people at 6 hours each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'hours', text: 'How many volunteer hours went into the build?', fixed: { expected: '18', compute: scale({ op: 'count', n: 6 }, 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Put the invented $16.00 rate on those hours, then set that value beside the $95.00 actually spent on materials.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the 18 hours have cost at $16.00 an hour?', fixed: { expected: '$288.00', compute: scale(m(16.0), 18) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the volunteer value than the material cost?', fixed: { expected: '$193.00', compute: diff(scale(m(16.0), 18), m(95.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A second invented work day adds 12 more volunteer hours and another $40.00 of materials.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the volunteer value across both days?', fixed: { expected: '$480.00', compute: sum(scale(m(16.0), 18), scale(m(16.0), 12)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What did the whole project cost in money across both days?', fixed: { expected: '$135.00', compute: sum(m(95.0), m(40.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The receipts totalled far less than the work.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Fern\'s receipts show $135.00. Explain what that figure leaves out and why a community project can be undervalued by its accounts.' }] },
    ],
    rubric: [
      crit(
        'Valuing unpaid labour',
        'The response treats Fern\'s $135.00 as the full cost of the project.',
        'The volunteer hours are mentioned but not connected to what accounts leave out.',
        'The response explains that Fern\'s accounts capture only purchased materials, while most of the work arrived as unpaid time worth far more at the stated rate.',
      ),
    ],
    remediation:
      'If a learner multiplies by volunteers instead of hours, compute Fern\'s hour total as its own boxed figure first, then apply the rate to that box.',
    extension: 'Ask the learner what other contributions Fern\'s hour count still misses, and how a project might record them.',
  },
  {
    key: 'g5-u02-l06',
    authority: 'JUDGMENT',
    character: 'Otis',
    objective:
      'Learners judge an invented workplace situation involving an uncorrected error and decide what responsibility requires of them.',
    scenario:
      'Otis is an invented fifth grader volunteering at a pretend school shop. He notices that a made-up price sign says $4.00 while the till has been charging $3.00 all week, and the shop is short. No one has noticed yet, and nothing here is real.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Set out the facts of Otis\'s invented situation: what the sign says, what the till charged, and what the shop is short as a result. Keep facts separate from blame.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What exactly went wrong in Otis\'s shop, and what is the consequence of leaving it uncorrected?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Otis did not cause the error and is not in charge. Write what he should do anyway, and say what makes it his responsibility even though he did not set the till.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Otis do, and why is it his responsibility to act even though he did not make the mistake?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Customers paid less than the sign said.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Does the shop owe anything to the customers who were undercharged? Give your reasoning.' }],
      },
    ],
    rubric: [
      crit(
        'Taking responsibility for a noticed problem',
        'The response has Otis stay silent because the error was not his.',
        'Otis reports the problem but no reason is given for why it is his to raise.',
        'The response has Otis report the mismatch promptly and explains that noticing a problem creates a responsibility to raise it, independent of who caused it.',
      ),
      crit(
        'Reasoning about fairness to customers',
        'The response ignores the undercharged customers entirely.',
        'The customers are mentioned but no position is taken on what is owed.',
        'The response takes a reasoned position on Otis\'s undercharged customers, weighing fairness to the shop against what customers were told at the point of sale.',
      ),
    ],
    lookFors: [
      'States the mismatch between the invented sign and the till.',
      'Has Otis raise the issue with someone responsible for the shop.',
      'Explains responsibility as following from noticing, not from causing.',
      'Takes a defensible position on the undercharged customers.',
    ],
    remediation:
      'If a learner treats silence as acceptable, ask what happens to the shop and to the next customer if the mismatch runs another week, and revisit from there.',
    extension: 'Ask the learner to write the check Otis\'s shop could add to its routine so the sign and the till are compared before opening.',
  },
  {
    key: 'g5-u03-l01',
    authority: 'FIXED',
    character: 'Aiko',
    objective:
      'Learners compute per-unit prices from invented bulk options, choose the better rate, and apply it to a required quantity.',
    scenario:
      'Aiko is a made-up fifth grader ordering supplies for a pretend art room. One invented option is 12 brushes for $9.60; another is 20 of the same brushes for $15.00. The art room needs 24 brushes.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Aiko\'s 12-for-$9.60 option to a price per brush.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price per brush in the 12-pack?', fixed: { expected: '$0.80', compute: div(m(9.6), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert the 20-for-$15.00 option the same way, then compare Aiko\'s two per-brush prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price per brush in the 20-pack?', fixed: { expected: '$0.75', compute: div(m(15.0), 20) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much lower is the better per-brush price?', fixed: { expected: '$0.05', compute: diff(div(m(9.6), 12), div(m(15.0), 20)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Aiko orders all 24 brushes at each rate in turn to see what the difference is worth on a real order.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 24 brushes cost at the better per-brush price?', fixed: { expected: '$18.00', compute: scale(div(m(15.0), 20), 24) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the better rate save on 24 brushes?', fixed: { expected: '$1.20', compute: diff(scale(div(m(9.6), 12), 24), scale(div(m(15.0), 20), 24)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A five-cent difference produced a dollar-scale saving.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Aiko\'s per-brush gap was $0.05. Explain how a difference that small becomes worth checking.' }] },
    ],
    rubric: [
      crit(
        'Scaling a small unit difference',
        'The response dismisses Aiko\'s five-cent gap as too small to matter.',
        'The saving is computed for Aiko but not connected to the number of units.',
        'The response explains that Aiko\'s per-unit gap repeats with every brush, so the size of the order is what turns a small difference into a meaningful saving.',
      ),
    ],
    remediation:
      'When a learner compares pack totals, write both of Aiko\'s options as a price for a single brush before any comparison is allowed.',
    extension: 'Ask the learner how large an order would have to be before Aiko\'s better rate saves $5.00, and to justify the count.',
  },
  {
    key: 'g5-u03-l02',
    authority: 'FIXED',
    character: 'Neel',
    objective:
      'Learners total identical invented baskets at two pretend suppliers, find the overall difference, and locate which lines drive it.',
    scenario:
      'Neel is an invented fifth grader pricing the same pretend order at two made-up suppliers. The first quotes $24.75, $18.40, and $31.05. The second quotes $26.10, $16.95, and $30.20 for the identical items.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Neel\'s order at the first invented supplier.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the order cost at the first supplier?', fixed: { expected: '$74.20', compute: sum(m(24.75), m(18.4), m(31.05)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total the identical order at the second supplier, then compare the two totals rather than any single line.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the order cost at the second supplier?', fixed: { expected: '$73.25', compute: sum(m(26.1), m(16.95), m(30.2)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much cheaper is the better total?', fixed: { expected: '$0.95', compute: diff(sum(m(24.75), m(18.4), m(31.05)), sum(m(26.1), m(16.95), m(30.2))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Find where the difference actually comes from, line by line, in Neel\'s two quotes.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'On the first item, how much more does the second supplier charge?', fixed: { expected: '$1.35', compute: diff(m(26.1), m(24.75)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'On the second and third items combined, how much less does the second supplier charge?', fixed: { expected: '$2.30', compute: diff(sum(m(18.4), m(31.05)), sum(m(16.95), m(30.2))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cheaper supplier was dearer on one line.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Neel could split the order between suppliers. Work out whether that is worth doing and name a cost it would add that the quotes do not show.' }] },
    ],
    rubric: [
      crit(
        'Comparing totals and considering hidden costs',
        'The response compares Neel\'s single lines only, or ignores splitting entirely.',
        'Splitting is considered for Neel but no additional cost is identified.',
        'The response reasons about Neel\'s split order using the line differences and names a cost the quotes omit, such as a second delivery or extra ordering time.',
      ),
    ],
    remediation:
      'If a learner compares line by line and loses the thread, require both of Neel\'s column totals to be written and boxed before any line-level analysis.',
    extension: 'Ask the learner what the second supplier would need to charge for the first item to make the two quotes identical.',
  },
  {
    key: 'g5-u03-l03',
    authority: 'FIXED',
    character: 'Lior',
    objective:
      'Learners apply a simulated sales-tax percentage to invented subtotals, compute totals due, and plan a purchase that must include tax.',
    scenario:
      'Lior is a made-up fifth grader shopping in an invented town with a 6.5% simulated sales tax. The first invented subtotal is $240.00. The tax rate and prices are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 6.5% simulated tax to Lior\'s $240.00 subtotal.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much simulated tax is added?', fixed: { expected: '$15.60', compute: pct(m(240.0), 650) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find Lior\'s total due, then run the same rate on a smaller invented subtotal of $80.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total due on the $240.00 subtotal?', fixed: { expected: '$255.60', compute: sum(m(240.0), pct(m(240.0), 650)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total due on an $80.00 subtotal?', fixed: { expected: '$85.20', compute: sum(m(80.0), pct(m(80.0), 650)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Lior has $300.00 to spend including tax and is considering a $282.00 invented subtotal.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total due on a $282.00 subtotal?', fixed: { expected: '$300.33', compute: sum(m(282.0), pct(m(282.0), 650)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'Can Lior cover that with $300.00?',
            choices: ['Yes, with money left', 'It comes out exactly even', 'No, the total is over'],
            fixed: { expected: 'No, the total is over', compute: sel(m(300.0), sum(m(282.0), pct(m(282.0), 650)), 'No, the total is over', 'It comes out exactly even', 'Yes, with money left') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A subtotal well under the limit still failed at the register.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'What rule of thumb could Lior use while shopping so the tax never causes this surprise?' }] },
    ],
    rubric: [
      crit(
        'Planning for tax before the register',
        'The response treats Lior\'s shelf subtotal as the amount payable.',
        'The response says to remember tax but offers no usable rule.',
        'The response gives Lior a workable rule, such as keeping the subtotal a set amount below the limit or adding roughly seven cents per dollar as a running estimate.',
      ),
    ],
    remediation:
      'If a learner treats 6.5% as $6.50, work the tax on $100.00 for Lior first so the rate is anchored per hundred before other subtotals are attempted.',
    extension: 'Ask the learner for the largest whole-dollar subtotal Lior could cover with $300.00 including 6.5% tax, and how they narrowed it.',
  },
  {
    key: 'g5-u03-l04',
    authority: 'FIXED',
    character: 'Marta',
    objective:
      'Learners sort invented monthly costs into fixed and flexible groups, total each, and determine which group must absorb a reduction in income.',
    scenario:
      'Marta is an invented fifth grader modelling a pretend month on $320.00 of simulated income. Two invented costs are fixed: a $145.00 housing share and a $60.00 transport pass. Two are flexible: $55.00 of food extras and $34.50 of activities.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Marta\'s two invented fixed costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Marta\'s fixed costs come to?', fixed: { expected: '$205.00', compute: sum(m(145.0), m(60.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total the flexible costs separately, then check the whole plan against Marta\'s $320.00 of simulated income.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do Marta\'s flexible costs come to?', fixed: { expected: '$89.50', compute: sum(m(55.0), m(34.5)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $320.00 is unspent?', fixed: { expected: '$25.50', compute: diff(m(320.0), sum(m(145.0), m(60.0), m(55.0), m(34.5))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Marta\'s simulated income falls to $270.00 for one month, and the fixed costs cannot change.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is available for flexible costs after the fixed ones?', fixed: { expected: '$65.00', compute: diff(m(270.0), sum(m(145.0), m(60.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must Marta cut from her flexible costs?', fixed: { expected: '$24.50', compute: diff(sum(m(55.0), m(34.5)), diff(m(270.0), sum(m(145.0), m(60.0)))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The whole reduction landed on two lines.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Marta\'s cut fell entirely on flexible costs. Explain why, and describe what would have to change for a fixed cost to become adjustable.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about fixed and flexible costs',
        'The response cuts Marta\'s fixed costs without acknowledging the commitment behind them.',
        'The cut is taken from flexible costs for Marta but no explanation of the distinction is given.',
        'The response explains that Marta\'s fixed costs rest on outside commitments while flexible costs are current choices, and names what would have to change for a fixed cost to move.',
      ),
    ],
    remediation:
      'If a learner cuts indiscriminately, label each of Marta\'s lines fixed or flexible and cover the fixed lines before any reduction is proposed.',
    extension: 'Ask the learner to rebuild Marta\'s reduced month with both flexible categories kept in proportion, and to show the new amounts.',
  },
  {
    key: 'g5-u03-l05',
    authority: 'FIXED',
    character: 'Kenji',
    objective:
      'Learners construct a simple simulated budget, verify it against invented income, and test the effect of an unplanned cost on the balance.',
    scenario:
      'Kenji is a made-up fifth grader building a pretend budget from $250.00 of simulated monthly income. His invented categories are $80.00 for food, $45.50 for transport, $32.25 for supplies, and $50.00 for saving.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Kenji\'s four invented budget categories.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Kenji\'s planned month come to?', fixed: { expected: '$207.75', compute: sum(m(80.0), m(45.5), m(32.25), m(50.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Check Kenji\'s plan against the $250.00 of simulated income and state what the leftover represents.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $250.00 is unallocated?', fixed: { expected: '$42.25', compute: diff(m(250.0), sum(m(80.0), m(45.5), m(32.25), m(50.0))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does the planned month sit against Kenji\'s income?',
            choices: ['Inside his income', 'Exactly at his income', 'Over his income'],
            fixed: { expected: 'Inside his income', compute: sel(sum(m(80.0), m(45.5), m(32.25), m(50.0)), m(250.0), 'Inside his income', 'Exactly at his income', 'Over his income') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'An unplanned invented $55.00 dental cost arrives, and Kenji wants to protect the $50.00 saving category.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the month cost with the dental cost added?', fixed: { expected: '$262.75', compute: sum(m(80.0), m(45.5), m(32.25), m(50.0), m(55.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much must be cut from the other categories to stay inside $250.00?', fixed: { expected: '$12.75', compute: diff(sum(m(80.0), m(45.5), m(32.25), m(50.0), m(55.0)), m(250.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The unallocated money absorbed most, but not all, of the shock.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Kenji had $42.25 unallocated and still had to cut. What does that suggest about how much a budget should leave unassigned?' }] },
    ],
    rubric: [
      crit(
        'Designing slack into a budget',
        'The response treats Kenji\'s shortfall as bad luck with no lesson drawn.',
        'More slack is suggested for Kenji but not connected to the size of the unplanned cost.',
        'The response connects Kenji\'s $12.75 shortfall to the size of an ordinary unplanned cost and argues for slack or a dedicated fund sized to that kind of event.',
      ),
    ],
    remediation:
      'When a learner reworks every category, write Kenji\'s new total and his income on one line and let the subtraction give the required cut directly.',
    extension: 'Ask the learner to rebuild Kenji\'s month with a dedicated unexpected-costs category, and to justify the amount they set aside.',
  },
  {
    key: 'g5-u03-l06',
    authority: 'FIXED',
    character: 'Ana',
    objective:
      'Learners recompute an invented total recorded incorrectly, size the error, and re-test the corrected figure against available funds.',
    scenario:
      'Ana is an invented fifth grader auditing a pretend club ledger with three entries: $96.45, $112.30, and $109.15. The ledger records the total as $318.90 and the club has $325.00 of simulated funds.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Add Ana\'s three invented ledger entries yourself before looking at the recorded total.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the correct total of the three entries?', fixed: { expected: '$317.90', compute: sum(m(96.45), m(112.3), m(109.15)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with the $318.90 in Ana\'s ledger, then check the corrected total against the club\'s $325.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much is the ledger total wrong?', fixed: { expected: '$1.00', compute: diff(m(318.9), sum(m(96.45), m(112.3), m(109.15))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'Using the correct total, how much of the $325.00 remains?', fixed: { expected: '$7.10', compute: diff(m(325.0), sum(m(96.45), m(112.3), m(109.15))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A fourth invented entry of $9.80 is added to the corrected ledger.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the corrected total with the fourth entry?', fixed: { expected: '$327.70', compute: sum(m(96.45), m(112.3), m(109.15), m(9.8)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far past the club\'s $325.00 does that go?', fixed: { expected: '$2.70', compute: diff(sum(m(96.45), m(112.3), m(109.15), m(9.8)), m(325.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The ledger overstated the spending by a dollar.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Describe a checking routine Ana could run on every ledger page, and explain what kind of error it would catch that re-adding alone would not.' }] },
    ],
    rubric: [
      crit(
        'Designing a checking routine',
        'The response only says Ana should be careful, with no routine described.',
        'A routine is described for Ana but it is just repeating the same addition.',
        'The response describes a routine for Ana that differs from the original method, such as estimating first or adding in reverse order, and says what class of error it catches.',
      ),
    ],
    remediation:
      'If a learner cannot locate the error, re-add Ana\'s entries in reverse order and compare running totals at each step to isolate the disagreeing place value.',
    extension: 'Ask the learner to change one of Ana\'s four entries so the corrected total lands exactly on $325.00, and to show the arithmetic.',
  },
]
