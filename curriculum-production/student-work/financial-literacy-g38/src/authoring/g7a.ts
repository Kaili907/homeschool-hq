import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, m, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 7 Financial Literacy, units 1-3: income and work, consumer decisions, budgeting and saving. */
export const G7A: readonly AuthoredLesson[] = [
  {
    key: 'g7-u01-l01',
    authority: 'FIXED',
    character: 'Naveen',
    objective:
      'Learners combine invented income from an hourly job and irregular freelance work, compute a simulated monthly total, and compare the stability of each source.',
    scenario:
      'Naveen is a made-up seventh grader analysing a pretend household budget. In an invented month, one earner works 32 hours at $16.50 an hour and takes in $240.00 of irregular freelance income. All figures are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the hourly portion of the invented month: 32 hours at $16.50 an hour.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the hourly work pay for the month?', fixed: { expected: '$528.00', compute: scale(m(16.5), 32) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add the $240.00 of invented freelance income, then compare the two sources against each other before drawing any conclusion about the month.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total invented income for the month?', fixed: { expected: '$768.00', compute: sum(scale(m(16.5), 32), m(240.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is the hourly income than the freelance income?', fixed: { expected: '$288.00', compute: diff(scale(m(16.5), 32), m(240.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'In a leaner invented month the hours fall to 24 and the freelance work brings in $60.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total income in the lean month?', fixed: { expected: '$456.00', compute: sum(scale(m(16.5), 24), m(60.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that than the first invented month?', fixed: { expected: '$312.00', compute: diff(sum(scale(m(16.5), 32), m(240.0)), sum(scale(m(16.5), 24), m(60.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both sources fell, but not by the same proportion.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Which invented income source should a monthly budget be planned around, and what should the other be used for? Support your answer with the two months\' figures.' }] },
    ],
    rubric: [
      crit(
        'Planning around income stability',
        'The response treats both of Naveen\'s income sources as equally dependable.',
        'The hourly income is identified as steadier but the figures are not used as support.',
        'The response builds the plan on the hourly portion of Naveen\'s example, uses both months\' figures as evidence, and assigns the freelance income to saving or irregular costs.',
      ),
    ],
    remediation:
      'If a learner treats total income as a reliable planning figure, have them write the lowest plausible month for Naveen\'s household first and build the plan against that floor.',
    extension: 'Ask the learner what a household with this pattern should hold in reserve to survive one lean month, using the figures computed here.',
  },
  {
    key: 'g7-u01-l02',
    authority: 'FIXED',
    character: 'Yuki',
    objective:
      'Learners quantify the return on an invented training investment by computing the pay difference, the payback period, and the multi-year effect.',
    scenario:
      'Yuki is an invented seventh grader evaluating a pretend certification that costs $900.00 and raises a simulated rate from $18.00 to $23.00 an hour, at 20 hours a week. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a 20-hour week at Yuki\'s current invented rate of $18.00 an hour.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a 20-hour week pay now?', fixed: { expected: '$360.00', compute: scale(m(18.0), 20) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the same week at the certified rate of $23.00 an hour, then isolate the weekly gain the certification produces.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a 20-hour week pay after certification?', fixed: { expected: '$460.00', compute: scale(m(23.0), 20) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the weekly gain?', fixed: { expected: '$100.00', compute: diff(scale(m(23.0), 20), scale(m(18.0), 20)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'The $900.00 certification has to be repaid out of that weekly gain, and Yuki wants the picture over a full simulated year of 50 working weeks.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'weeks', text: 'How many whole weeks of the gain repay the $900.00?', fixed: { expected: '9', compute: reach(m(900.0), diff(scale(m(23.0), 20), scale(m(18.0), 20))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'Across 50 weeks, how much does the gain produce beyond the certification cost?', fixed: { expected: '$4,100.00', compute: diff(scale(diff(scale(m(23.0), 20), scale(m(18.0), 20)), 50), m(900.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The calculation assumed the hours and the rate both hold.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Identify two assumptions in this invented calculation that could fail, and describe how each would change the payback period.' }] },
    ],
    rubric: [
      crit(
        'Stress-testing a return calculation',
        'The response treats Yuki\'s payback as guaranteed.',
        'One assumption is named for Yuki but its effect on the payback is not traced.',
        'The response names at least two assumptions in Yuki\'s calculation, such as the hours holding or the certified rate actually being offered, and traces the effect of each on the payback period.',
      ),
    ],
    remediation:
      'If a learner divides the cost by the hourly rate, restate the question as how many $100.00 weekly gains fit inside $900.00 and count before dividing.',
    extension: 'Ask the learner what the certification could cost at most for Yuki to repay it within one 8-week summer, and to justify the figure.',
  },
  {
    key: 'g7-u01-l03',
    authority: 'FIXED',
    character: 'Sofiane',
    objective:
      'Learners apply stated percentage deductions to an invented gross figure, reach net pay, and quantify what the deductions represent as a whole.',
    scenario:
      'Sofiane is a made-up seventh grader reading a pretend pay statement with $2,400.00 of invented gross monthly pay. Simulated deductions are 7.75% for payroll taxes and 10% for income tax withholding. This is a teaching example, not a real statement.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 7.75% payroll deduction to Sofiane\'s $2,400.00 gross.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated payroll taxes?', fixed: { expected: '$186.00', compute: pct(m(2400.0), 775) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply the 10% withholding to the same gross figure, then combine the two deductions.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated income tax?', fixed: { expected: '$240.00', compute: pct(m(2400.0), 1000) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do both deductions come to together?', fixed: { expected: '$426.00', compute: sum(pct(m(2400.0), 775), pct(m(2400.0), 1000)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out Sofiane\'s net pay, then repeat the whole calculation for a month with $3,000.00 of gross pay.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net pay on $2,400.00 gross?', fixed: { expected: '$1,974.00', compute: diff(m(2400.0), sum(pct(m(2400.0), 775), pct(m(2400.0), 1000))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net pay on $3,000.00 gross?', fixed: { expected: '$2,467.50', compute: diff(m(3000.0), sum(pct(m(3000.0), 775), pct(m(3000.0), 1000))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Gross pay rose by $600.00 and net pay rose by less.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why the increase in net pay is smaller than the increase in gross pay, and what that means for planning around a raise.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about deductions on a raise',
        'The response treats Sofiane\'s gross increase as the money gained.',
        'The smaller net increase is noticed but the percentage mechanism is not explained.',
        'The response explains that Sofiane\'s deductions are proportional, so part of any raise is withheld too, and warns against planning on the gross figure.',
      ),
    ],
    remediation:
      'If a learner applies the second percentage to the already-reduced figure, mark Sofiane\'s gross as the base for both deductions and recompute each from that marked figure.',
    extension: 'Ask the learner what gross pay Sofiane would need for net pay to reach exactly $2,000.00 under these two rates, and to show the method.',
  },
  {
    key: 'g7-u01-l04',
    authority: 'FIXED',
    character: 'Renata',
    objective:
      'Learners compute total compensation by adding invented benefit values to salary, and compare two offers that differ in structure.',
    scenario:
      'Renata is an invented seventh grader comparing two pretend job offers. Offer A pays $3,000.00 a month with an invented $250.00 health contribution, a 5% retirement match, and a $60.00 transit benefit. Offer B pays $3,200.00 a month with no benefits at all.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 5% retirement match on Offer A\'s $3,000.00 salary.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly retirement match worth?', fixed: { expected: '$150.00', compute: pct(m(3000.0), 500) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Add all three invented benefits to Offer A\'s salary to reach total monthly compensation.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are Offer A\'s three benefits worth together?', fixed: { expected: '$460.00', compute: sum(m(250.0), pct(m(3000.0), 500), m(60.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Offer A\'s total monthly compensation?', fixed: { expected: '$3,460.00', compute: sum(m(3000.0), m(250.0), pct(m(3000.0), 500), m(60.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare Offer A\'s total compensation with Offer B\'s salary-only $3,200.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is Offer A worth in total compensation?', fixed: { expected: '$260.00', compute: diff(sum(m(3000.0), m(250.0), pct(m(3000.0), 500), m(60.0)), m(3200.0)) } },
          {
            ref: 't3-p2',
            promptType: 'fixed-choice',
            text: 'Which offer pays more in cash each month, before benefits?',
            choices: ['Offer A', 'Offer B', 'They pay the same cash'],
            fixed: { expected: 'Offer B', compute: sel(m(3200.0), m(3000.0), 'Offer A', 'They pay the same cash', 'Offer B') },
          },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One offer wins on cash and the other on total value.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Under what circumstances should Renata take the offer with less total compensation? Be specific about what would make cash more valuable than benefits.' }] },
    ],
    rubric: [
      crit(
        'Comparing offers on total compensation',
        'The response compares Renata\'s offers on salary alone.',
        'Total compensation is computed for Renata but the value of cash is not considered.',
        'The response uses Renata\'s total compensation figures and identifies circumstances, such as needing cash now or already having health cover, that would make the smaller total the better choice.',
      ),
    ],
    remediation:
      'If a learner ignores the benefits, list each of Renata\'s benefits as a line item with a dollar value before either offer is judged.',
    extension: 'Ask the learner what salary Offer B would need for the two offers to be equal in total compensation, and to show the arithmetic.',
  },
  {
    key: 'g7-u01-l05',
    authority: 'FIXED',
    character: 'Dilan',
    objective:
      'Learners model an invented venture including fixed costs, computing contribution per unit, total profit, and the break-even volume.',
    scenario:
      'Dilan is a made-up seventh grader planning a pretend venture. Each invented unit costs $12.50 to make and sells for $22.00, with $150.00 of invented fixed costs for a stall and equipment hire. He plans to sell 40 units.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute what one of Dilan\'s invented units contributes after its own materials.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does one unit contribute after materials?', fixed: { expected: '$9.50', compute: diff(m(22.0), m(12.5)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Scale revenue and material cost across the 40-unit plan, keeping them as separate figures.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the 40-unit run bring in?', fixed: { expected: '$880.00', compute: scale(m(22.0), 40) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do materials for 40 units cost?', fixed: { expected: '$500.00', compute: scale(m(12.5), 40) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Bring in the $150.00 of invented fixed costs, then find how many units are needed just to cover them.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Dilan\'s profit after materials and fixed costs?', fixed: { expected: '$230.00', compute: diff(diff(scale(m(22.0), 40), scale(m(12.5), 40)), m(150.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'units', text: 'How many units must sell before the fixed costs are covered?', fixed: { expected: '16', compute: reach(m(150.0), diff(m(22.0), m(12.5))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The first fifteen units earned nothing at all.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what break-even means using Dilan\'s figures, and why a venture with high fixed costs is riskier than one without them.' }] },
    ],
    rubric: [
      crit(
        'Explaining break-even and fixed-cost risk',
        'The response treats every one of Dilan\'s units as profitable from the first sale.',
        'Break-even is stated for Dilan but the risk of fixed costs is not addressed.',
        'The response explains that Dilan\'s fixed costs are owed regardless of sales, so the first 16 units only repay them, and connects that to higher risk if demand disappoints.',
      ),
    ],
    remediation:
      'If a learner subtracts fixed costs per unit, keep Dilan\'s fixed costs as a single lump on its own line and subtract it once, after the run is totalled.',
    extension: 'Ask the learner what price Dilan would need for break-even to fall to 10 units, and to show the reasoning.',
  },
  {
    key: 'g7-u01-l06',
    authority: 'JUDGMENT',
    character: 'Marisela',
    objective:
      'Learners reason about workplace rights and responsibilities in an invented situation where both are in tension, and identify who to raise a concern with.',
    scenario:
      'Marisela is an invented seventh grader studying a pretend case: a young worker is asked to stay 45 minutes past the scheduled shift without extra pay, the manager says everyone does it, and the worker needs the job. The case is invented for discussion.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Separate the strands of Marisela\'s invented case: what the worker agreed to, what is being asked, and what pressure is being applied. Describe each before judging.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What was agreed, what is now being asked, and what makes the manager\'s reasoning a form of pressure?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what the worker in Marisela\'s case should do, including who to ask and what to document, recognising that they need the job.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the worker do, who should they raise it with, and how does your answer account for their need to keep the job?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Responsibilities run in both directions.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Name one responsibility the worker owes the employer and one the employer owes the worker in this invented case.' }],
      },
    ],
    rubric: [
      crit(
        'Analysing rights and pressure',
        'The response accepts that everyone does it as settling the question.',
        'The pressure is noticed in Marisela\'s case but the underlying agreement is not examined.',
        'The response distinguishes what was agreed from what is being asked in Marisela\'s case, and names the appeal to common practice as pressure rather than justification.',
      ),
      crit(
        'Proposing a workable response',
        'The response tells the worker to quit or to comply silently.',
        'A response is proposed but ignores the worker\'s need to keep the job.',
        'The response proposes a concrete step, such as asking about the policy in writing or keeping a record of hours, that raises the issue while accounting for the worker\'s position.',
      ),
    ],
    lookFors: [
      'Distinguishes the agreed schedule from the additional request.',
      'Identifies the appeal to common practice as pressure.',
      'Proposes documentation or a specific person to ask.',
      'Names a responsibility on each side.',
    ],
    remediation:
      'If a learner treats the request as automatically acceptable, ask what the written agreement in Marisela\'s case says, and rebuild the answer from what was actually agreed.',
    extension: 'Ask the learner what an employer could put in writing at hiring that would prevent this invented situation from arising.',
  },
  {
    key: 'g7-u02-l01',
    authority: 'FIXED',
    character: 'Ezra',
    objective:
      'Learners compare two invented uses of the same simulated funds, compute what each leaves, and attach a value to what is given up.',
    scenario:
      'Ezra is a made-up seventh grader with $1,200.00 of simulated savings. Option A is an invented $850.00 laptop. Option B is a $400.00 course plus a $380.00 tablet. Only one option is possible.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Ezra\'s Option B, which has two invented parts.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Option B cost in total?', fixed: { expected: '$780.00', compute: sum(m(400.0), m(380.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute what each of Ezra\'s options leaves from the $1,200.00 of simulated savings.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What remains after Option A?', fixed: { expected: '$350.00', compute: diff(m(1200.0), m(850.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What remains after Option B?', fixed: { expected: '$420.00', compute: diff(m(1200.0), sum(m(400.0), m(380.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Ezra chooses Option A, and a classmate argues that Option B was strictly better because it leaves more.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Option B leave than Option A?', fixed: { expected: '$70.00', compute: diff(diff(m(1200.0), sum(m(400.0), m(380.0))), diff(m(1200.0), m(850.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the value of the course Ezra gave up by choosing Option A?', fixed: { expected: '$400.00', compute: m(400.0) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The leftover is only part of what changed.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why the $70.00 difference in leftover money is a poor basis for calling Option B better, using the idea of opportunity cost.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about opportunity cost',
        'The response settles Ezra\'s question on the leftover amount alone.',
        'What was given up is mentioned for Ezra but not weighed against what was gained.',
        'The response names what Ezra forgoes under each option and argues that opportunity cost includes the value of the option not taken, not just the cash difference.',
      ),
    ],
    remediation:
      'If a learner compares only leftovers, have them write what Ezra receives under each option in words alongside the amounts before any comparison.',
    extension: 'Ask the learner to design a third option under $1,200.00 that Ezra would find hardest to give up, and to defend the design.',
  },
  {
    key: 'g7-u02-l02',
    authority: 'FIXED',
    character: 'Hattie',
    objective:
      'Learners normalise invented package prices to a common measure, identify the better value, and quantify the difference on a realistic order.',
    scenario:
      'Hattie is an invented seventh grader comparing two pretend package sizes of the same product: 900 grams for $5.40 and 1,500 grams for $8.25. The store lists no unit price, so she works it out herself.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Hattie\'s 900-gram package to a price per 100 grams.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD per 100 g', text: 'What is the price per 100 grams in the 900-gram package?', fixed: { expected: '$0.60', compute: div(m(5.4), 9) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert the 1,500-gram package the same way, then compare Hattie\'s two normalised prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD per 100 g', text: 'What is the price per 100 grams in the 1,500-gram package?', fixed: { expected: '$0.55', compute: div(m(8.25), 15) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which package is the better value per 100 grams?',
            choices: ['The 900-gram package', 'The 1,500-gram package', 'They are equal per 100 grams'],
            fixed: { expected: 'The 1,500-gram package', compute: sel(div(m(8.25), 15), div(m(5.4), 9), 'The 1,500-gram package', 'They are equal per 100 grams', 'The 900-gram package') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Hattie needs 4,500 grams, which is 45 hundred-gram units, and both packages can be bought repeatedly.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 4,500 grams cost at the better rate?', fixed: { expected: '$24.75', compute: scale(div(m(8.25), 15), 45) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the better rate save over 4,500 grams?', fixed: { expected: '$2.25', compute: diff(scale(div(m(5.4), 9), 45), scale(div(m(8.25), 15), 45)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The larger package is only better under a condition.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Name a situation where Hattie should buy the worse-value package anyway, and explain what makes unit price the wrong criterion there.' }] },
    ],
    rubric: [
      crit(
        'Applying and limiting unit-price reasoning',
        'The response treats the lower unit price as always correct for Hattie.',
        'A limitation is gestured at for Hattie but not tied to waste, storage, or cash on hand.',
        'The response names a concrete situation for Hattie, such as spoilage, limited storage, or not having $8.25 available, where the lower unit price is the wrong criterion.',
      ),
    ],
    remediation:
      'If a learner compares package prices directly, require both of Hattie\'s options to be written as a price per 100 grams before any comparison is stated.',
    extension: 'Ask the learner what a 600-gram package would need to cost to beat Hattie\'s best rate, and to prove it.',
  },
  {
    key: 'g7-u02-l03',
    authority: 'FIXED',
    character: 'Ilya',
    objective:
      'Learners compute sequential invented discounts and test whether stacked percentages equal their sum.',
    scenario:
      'Ilya is a made-up seventh grader checking a pretend offer on a $240.00 item: 30% off, then a further 5% off the reduced price. The invented advertisement claims this is 35% off. All figures are invented for checking.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 30% discount to Ilya\'s $240.00 item.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the price after the 30% discount?', fixed: { expected: '$168.00', compute: diff(m(240.0), pct(m(240.0), 3000)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply the further 5% to the reduced price, not to the original, then find the final price Ilya actually pays.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the further 5% take off?', fixed: { expected: '$8.40', compute: pct(diff(m(240.0), pct(m(240.0), 3000)), 500) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the final price after both discounts?', fixed: { expected: '$159.60', compute: diff(diff(m(240.0), pct(m(240.0), 3000)), pct(diff(m(240.0), pct(m(240.0), 3000)), 500)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out what a single 35% discount would have given, and compare it with the stacked result.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would a single 35% discount give?', fixed: { expected: '$156.00', compute: diff(m(240.0), pct(m(240.0), 3500)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Ilya pay under the stacked discounts than under a true 35% off?', fixed: { expected: '$3.60', compute: diff(diff(diff(m(240.0), pct(m(240.0), 3000)), pct(diff(m(240.0), pct(m(240.0), 3000)), 500)), diff(m(240.0), pct(m(240.0), 3500))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Thirty and five did not make thirty-five.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why stacked percentage discounts do not add, using Ilya\'s figures, and state what the second percentage is actually applied to.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about stacked percentages',
        'The response accepts that Ilya\'s two discounts add to 35%.',
        'The discrepancy is noticed for Ilya but the base of the second discount is not identified.',
        'The response explains that Ilya\'s second discount applies to the already-reduced $168.00, so it removes less than 5% of the original price, and uses the $3.60 gap as evidence.',
      ),
    ],
    remediation:
      'If a learner applies both percentages to the original price, box the amount each discount is taken from and require the second box to be filled with the reduced price.',
    extension: 'Ask the learner what second discount, stacked after 30%, would genuinely equal a single 35% off, and to show the method.',
  },
  {
    key: 'g7-u02-l04',
    authority: 'JUDGMENT',
    character: 'Rania',
    objective:
      'Learners read invented contract terms for what they actually commit a person to, and decide which terms would stop them signing.',
    scenario:
      'Rania is an invented seventh grader reviewing pretend terms for a made-up streaming service: a free trial converting to a paid plan automatically, cancellation only by post with 30 days notice, and a clause allowing price changes with email notice. All terms are invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Work through Rania\'s three invented clauses one at a time. Say plainly what each one obliges the customer to do or accept, in ordinary words rather than the clause\'s own language.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Restate each of Rania\'s three clauses in plain words, saying what the customer is actually agreeing to.' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Decide which clause would stop Rania signing and which she could live with, and set out what she would need to do to protect herself if she signed anyway.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Which clause is the most serious for Rania, and what concrete steps would protect her if she signed?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The free trial is the part that sounds generous.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why does the automatic conversion clause make the free trial less generous than it appears?' }],
      },
    ],
    rubric: [
      crit(
        'Reading terms for real obligations',
        'The response summarises Rania\'s clauses in the contract\'s own reassuring language.',
        'Some clauses are restated plainly for Rania but at least one obligation is missed.',
        'The response restates all three of Rania\'s clauses in plain terms and identifies the obligation each creates, including the notice period and the unilateral price change.',
      ),
      crit(
        'Protecting against a signed term',
        'No protective step is proposed for Rania.',
        'A step is proposed but it would not actually address the clause identified.',
        'The response proposes concrete steps for Rania, such as diarising the cancellation date well before the notice window, that directly address the clause she flagged.',
      ),
    ],
    lookFors: [
      'Restates the automatic conversion in plain language.',
      'Identifies the 30-day postal notice as a practical barrier.',
      'Notes that price changes can occur without renegotiation.',
      'Proposes a step tied to the specific clause flagged.',
    ],
    remediation:
      'If a learner skims the terms, have them rewrite each of Rania\'s clauses as a sentence beginning "I agree to" before any judgement is made.',
    extension: 'Ask the learner to rewrite Rania\'s cancellation clause so it is fair to both sides, and to say what they changed.',
  },
  {
    key: 'g7-u02-l05',
    authority: 'FIXED',
    character: 'Tobias',
    objective:
      'Learners compare invented monthly and annual subscription pricing, compute the annual difference, and quantify the cost of a delayed cancellation.',
    scenario:
      'Tobias is a made-up seventh grader comparing pretend subscription options: $14.99 a month or $149.00 for a full simulated year. He also wants to know what forgetting to cancel for three months would cost. All prices are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a full simulated year of Tobias\'s invented monthly plan at $14.99 a month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does 12 months on the monthly plan cost?', fixed: { expected: '$179.88', compute: scale(m(14.99), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with the $149.00 annual plan, then say which costs less over a full year.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much cheaper is the annual plan over a year?', fixed: { expected: '$30.88', compute: diff(scale(m(14.99), 12), m(149.0)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Over a full year, which plan costs Tobias less?',
            choices: ['The monthly plan', 'The annual plan', 'They cost the same'],
            fixed: { expected: 'The annual plan', compute: sel(m(149.0), scale(m(14.99), 12), 'The annual plan', 'They cost the same', 'The monthly plan') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Tobias takes the monthly plan, stops using the service after month 4, and forgets to cancel for 3 further months.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the 3 forgotten months cost?', fixed: { expected: '$44.97', compute: scale(m(14.99), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What has Tobias paid in total across the 7 months?', fixed: { expected: '$104.93', compute: scale(m(14.99), 7) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The annual plan saves money only under one condition.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Given that Tobias stopped using the service after 4 months, was the annual plan really the better choice? Use the figures to argue your position.' }] },
    ],
    rubric: [
      crit(
        'Evaluating a subscription commitment',
        'The response calls the annual plan better for Tobias without regard to usage.',
        'Usage is mentioned for Tobias but the four-month figure is not used.',
        'The response uses Tobias\'s actual usage to argue that the annual plan would have cost more than the value received, and treats the headline saving as conditional on using the full year.',
      ),
    ],
    remediation:
      'If a learner compares only the headline prices, have them compute Tobias\'s cost per month actually used under each plan before deciding.',
    extension: 'Ask the learner how many months Tobias must use the service before the annual plan beats the monthly one, and to show the reasoning.',
  },
  {
    key: 'g7-u02-l06',
    authority: 'JUDGMENT',
    character: 'Kiona',
    objective:
      'Learners work through an invented consumer-protection situation, identifying what evidence matters and what escalation path exists.',
    scenario:
      'Kiona is an invented seventh grader studying a pretend case: an online order arrived damaged, the invented seller says the return window closed two days ago, and the customer has photos taken on the day of delivery. Everything here is invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Set out Kiona\'s invented case in order: what was promised, what arrived, what evidence exists, and what the seller now claims. Keep evidence separate from opinion.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What evidence does the customer in Kiona\'s case actually hold, and why does the timing of the photos matter?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write the steps the customer should take, in order, from contacting the seller through to any escalation, and say what each step should include.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What steps should the customer take, in what order, and what should each communication contain?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The seller is relying on a deadline.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why does a damaged-on-arrival item raise a different question from a change-of-mind return?' }],
      },
    ],
    rubric: [
      crit(
        'Marshalling evidence',
        'The response relies on assertion rather than on the evidence in Kiona\'s case.',
        'The photos are mentioned for Kiona but their timing is not connected to the claim.',
        'The response identifies the delivery-day photos as evidence that the damage predates any deadline, and distinguishes documented facts from opinion.',
      ),
      crit(
        'Escalating in a workable order',
        'The response jumps straight to a complaint body or gives up.',
        'Steps are listed for Kiona but out of a sensible order or without content.',
        'The response sets out an ordered path for Kiona, starting with a written approach to the seller including the evidence, and names a next step if that fails.',
      ),
    ],
    lookFors: [
      'Identifies the delivery-day photos as the key evidence.',
      'Distinguishes damaged-on-arrival from change-of-mind.',
      'Puts a written approach to the seller first.',
      'Names a concrete escalation route if the seller refuses.',
    ],
    remediation:
      'If a learner leads with escalation, ask what a complaint body would want to see first, and rebuild the order from that answer.',
    extension: 'Ask the learner to draft the first three sentences of the customer\'s message to the invented seller.',
  },
  {
    key: 'g7-u03-l01',
    authority: 'FIXED',
    character: 'Lars',
    objective:
      'Learners compute invented net cash flow across two simulated months, including a deficit, and evaluate the combined position.',
    scenario:
      'Lars is a made-up seventh grader building a pretend cash-flow statement. In invented month one, inflows are $1,850.00 and outflows are $1,920.00. In month two, inflows rise to $2,050.00 with the same outflows. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the net cash flow for Lars\'s invented month one.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net cash flow in month one?', fixed: { expected: '-$70.00', compute: diff(m(1850.0), m(1920.0)), note: 'A negative net cash flow means the month spent more than it took in; the shortfall has to come from savings or borrowing.' } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute month two\'s net cash flow with the higher inflows, then combine the two months into a single position.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net cash flow in month two?', fixed: { expected: '$130.00', compute: diff(m(2050.0), m(1920.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the combined net cash flow across both months?', fixed: { expected: '$60.00', compute: sum(diff(m(1850.0), m(1920.0)), diff(m(2050.0), m(1920.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A third invented month brings inflows of $1,700.00 with outflows unchanged.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net cash flow in month three?', fixed: { expected: '-$220.00', compute: diff(m(1700.0), m(1920.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the combined position across all three months?', fixed: { expected: '-$160.00', compute: sum(diff(m(1850.0), m(1920.0)), diff(m(2050.0), m(1920.0)), diff(m(1700.0), m(1920.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A positive month sat between two negative ones.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why looking at a single month of cash flow can mislead, and what the three-month position tells Lars that month two alone did not.' }] },
    ],
    rubric: [
      crit(
        'Interpreting cash flow over time',
        'The response judges Lars\'s position from a single month.',
        'Multiple months are referenced for Lars but the combined position is not interpreted.',
        'The response uses Lars\'s three-month combined figure to show the household is behind overall, and explains that one good month can mask a recurring shortfall.',
      ),
    ],
    remediation:
      'If a learner drops the negative sign, write Lars\'s inflows and outflows in two columns and mark the direction of the difference before recording it.',
    extension: 'Ask the learner what outflow level would make all three of Lars\'s invented months at least break even, and to show the reasoning.',
  },
  {
    key: 'g7-u03-l02',
    authority: 'FIXED',
    character: 'Adaeze',
    objective:
      'Learners classify invented expenses as fixed, variable, or periodic, convert a periodic cost to a monthly equivalent, and total a realistic month.',
    scenario:
      'Adaeze is an invented seventh grader modelling a pretend month. Fixed costs are $780.00 of housing. Variable costs are $260.00 of food and $145.00 of transport. A periodic invented insurance bill of $720.00 falls once a simulated year. Monthly income is $1,400.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Adaeze\'s invented annual insurance bill into a monthly equivalent.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly equivalent of the $720.00 annual bill?', fixed: { expected: '$60.00', compute: div(m(720.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total Adaeze\'s variable costs, then build a full monthly figure that includes fixed, variable, and the periodic equivalent.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the variable costs come to?', fixed: { expected: '$405.00', compute: sum(m(260.0), m(145.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the full monthly cost including the periodic equivalent?', fixed: { expected: '$1,245.00', compute: sum(m(780.0), m(260.0), m(145.0), div(m(720.0), 12)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare that with Adaeze\'s $1,400.00 income, then work out what the month looks like if the periodic bill is ignored until it arrives.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left each month once the periodic equivalent is included?', fixed: { expected: '$155.00', compute: diff(m(1400.0), sum(m(780.0), m(260.0), m(145.0), div(m(720.0), 12))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'In the month the $720.00 bill actually lands, what is the net position if nothing was set aside?', fixed: { expected: '-$505.00', compute: diff(m(1400.0), sum(m(780.0), m(260.0), m(145.0), m(720.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The same bill produced two very different months.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why periodic costs are spread across months in a budget, using Adaeze\'s two results as evidence.' }] },
    ],
    rubric: [
      crit(
        'Handling periodic costs',
        'The response treats Adaeze\'s annual bill as a one-off surprise.',
        'Spreading is mentioned for Adaeze but the two results are not compared.',
        'The response contrasts Adaeze\'s $155.00 monthly surplus with the $505.00 shortfall in the bill month, and explains that spreading converts a shock into a manageable line.',
      ),
    ],
    remediation:
      'If a learner leaves the periodic cost out, have them label every expense fixed, variable, or periodic before any total is computed.',
    extension: 'Ask the learner what monthly set-aside would leave Adaeze exactly break-even in the bill month, and to justify it.',
  },
  {
    key: 'g7-u03-l03',
    authority: 'FIXED',
    character: 'Toma',
    objective:
      'Learners size an invented emergency fund from essential costs and compute how long it takes to build at a given saving rate.',
    scenario:
      'Toma is a made-up seventh grader modelling a pretend emergency fund. Invented essential monthly costs are $1,150.00, the target is three months of essentials, and $200.00 a month can be set aside. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Size Toma\'s invented emergency fund at three months of essential costs.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the three-month target?', fixed: { expected: '$3,450.00', compute: scale(m(1150.0), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out how long the target takes at $200.00 a month, and where the fund stands after one simulated year.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months to reach the target at $200.00 a month?', fixed: { expected: '18', compute: reach(scale(m(1150.0), 3), m(200.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is in the fund after 12 months?', fixed: { expected: '$2,400.00', compute: scale(m(200.0), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'At month 12 an invented $900.00 emergency uses part of the fund, then saving resumes at $200.00 a month.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the fund immediately after the emergency?', fixed: { expected: '$1,500.00', compute: diff(scale(m(200.0), 12), m(900.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'months', text: 'How many more whole months to reach the $3,450.00 target?', fixed: { expected: '10', compute: reach(diff(scale(m(1150.0), 3), diff(scale(m(200.0), 12), m(900.0))), m(200.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The fund did exactly what it was built for and got smaller.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Toma\'s figures, explain why an emergency fund that gets used is working rather than failing, and what should happen next.' }] },
    ],
    rubric: [
      crit(
        'Understanding the purpose of an emergency fund',
        'The response treats Toma\'s withdrawal as a failure of the plan.',
        'The purpose is stated for Toma but no rebuilding step is described.',
        'The response explains that Toma\'s fund absorbed a shock that would otherwise have become debt, and specifies resuming contributions to rebuild it.',
      ),
    ],
    remediation:
      'If a learner recomputes the target from scratch after the emergency, keep the target as a fixed line for Toma and update only the balance beneath it.',
    extension: 'Ask the learner what monthly set-aside would build Toma\'s full target within one simulated year, and to show the reasoning.',
  },
  {
    key: 'g7-u03-l04',
    authority: 'FIXED',
    character: 'Odile',
    objective:
      'Learners convert invented goals into required monthly contributions and evaluate whether competing goals fit the money available.',
    scenario:
      'Odile is an invented seventh grader planning a pretend $2,400.00 goal over 15 months. She also wants to know what a slower $120.00 a month would do to the timeline. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Work out the monthly contribution Odile\'s invented goal requires over 15 months.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount reaches $2,400.00 in 15 months?', fixed: { expected: '$160.00', compute: div(m(2400.0), 15) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now reverse the question: at $120.00 a month, work out how long Odile\'s goal takes and how far behind she is at month 15.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months does $120.00 a month need?', fixed: { expected: '20', compute: reach(m(2400.0), m(120.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is still missing at month 15 under the slower plan?', fixed: { expected: '$600.00', compute: diff(m(2400.0), scale(m(120.0), 15)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Odile adds a second invented goal of $900.00 over 15 months alongside the first, with $220.00 a month available in total.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the second goal require?', fixed: { expected: '$60.00', compute: div(m(900.0), 15) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far short of both goals is $220.00 a month?', fixed: { expected: '$0.00', compute: diff(sum(div(m(2400.0), 15), div(m(900.0), 15)), m(220.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both goals fit exactly, with nothing to spare.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Odile\'s two goals consume every available dollar. Explain the risk in a plan with no slack, and what you would change.' }] },
    ],
    rubric: [
      crit(
        'Evaluating a plan with no slack',
        'The response treats Odile\'s exact fit as ideal with no risk noted.',
        'The lack of slack is noticed for Odile but no consequence or change is proposed.',
        'The response explains that any unplanned cost would break Odile\'s plan, and proposes a concrete change such as extending a timeline or reducing one goal.',
      ),
    ],
    remediation:
      'If a learner divides in the wrong direction, restate the question as sharing the goal amount equally across the months and check the units of the answer.',
    extension: 'Ask the learner to rebuild Odile\'s two goals leaving at least $20.00 a month unassigned, and to show the new timelines.',
  },
  {
    key: 'g7-u03-l05',
    authority: 'FIXED',
    character: 'Wes',
    objective:
      'Learners compare the cost of invented banking services, including avoidable fees, against the interest a simulated savings balance earns.',
    scenario:
      'Wes is a made-up seventh grader comparing pretend account terms: a $5.00 monthly fee waived if the balance stays above $500.00, an invented $34.00 overdraft fee, and 1.25% annual interest on a $2,000.00 simulated savings balance. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a simulated year of interest on Wes\'s $2,000.00 savings balance at the invented 1.25% rate.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much interest does the savings balance earn in a year?', fixed: { expected: '$25.00', compute: pct(m(2000.0), 125) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out what three invented overdraft events cost, and what a year of the monthly fee would cost if the balance never stays above $500.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 3 overdraft fees come to?', fixed: { expected: '$102.00', compute: scale(m(34.0), 3) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a year of the unwaived monthly fee come to?', fixed: { expected: '$60.00', compute: scale(m(5.0), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Set the year\'s fees against the year\'s interest for Wes.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the overdraft fees and monthly fees come to together?', fixed: { expected: '$162.00', compute: sum(scale(m(34.0), 3), scale(m(5.0), 12)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much do those fees exceed the interest earned?', fixed: { expected: '$137.00', compute: diff(sum(scale(m(34.0), 3), scale(m(5.0), 12)), pct(m(2000.0), 125)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The fees dwarfed the interest.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Wes\'s figures, explain why avoiding fees usually matters more than chasing a higher interest rate, and name the one fee here that is hardest to avoid.' }] },
    ],
    rubric: [
      crit(
        'Comparing fees against returns',
        'The response focuses only on the interest rate in Wes\'s comparison.',
        'Both fees and interest are computed for Wes but not compared as a decision.',
        'The response uses Wes\'s $137.00 gap to argue that avoidable fees outweigh the interest, and identifies which fee depends on behaviour and which on balance.',
      ),
    ],
    remediation:
      'If a learner treats the fees as unavoidable, mark each of Wes\'s fees with its trigger condition before any comparison is drawn.',
    extension: 'Ask the learner what interest rate Wes would need for the interest alone to cover the year\'s fees, and to show the method.',
    safetyNotes: ['These account terms are invented for the exercise; real account terms should be checked with a trusted adult.'],
  },
  {
    key: 'g7-u03-l06',
    authority: 'FIXED',
    character: 'Imara',
    objective:
      'Learners revise an invented budget after an income cut, computing the shortfall and testing whether a proposed reduction closes it.',
    scenario:
      'Imara is an invented seventh grader revising a pretend budget. Monthly income was $1,600.00 and has been cut by 10%. Planned expenses total $1,520.00, of which $480.00 is variable. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Imara\'s invented income after the 10% cut.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the income after the cut?', fixed: { expected: '$1,440.00', compute: diff(m(1600.0), pct(m(1600.0), 1000)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare the reduced income with the unchanged $1,520.00 of planned expenses, then say what the position is.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly shortfall after the cut?', fixed: { expected: '$80.00', compute: diff(m(1520.0), diff(m(1600.0), pct(m(1600.0), 1000))) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'How does the unchanged plan sit against the reduced income?',
            choices: ['Inside the income', 'Exactly at the income', 'Over the income'],
            fixed: { expected: 'Over the income', compute: sel(m(1520.0), diff(m(1600.0), pct(m(1600.0), 1000)), 'Inside the income', 'Exactly at the income', 'Over the income') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Imara proposes cutting variable spending by 25%, from the $480.00 variable total.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does a 25% cut to variable spending save?', fixed: { expected: '$120.00', compute: pct(m(480.0), 2500) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly position after that cut?', fixed: { expected: '$40.00', compute: diff(diff(m(1600.0), pct(m(1600.0), 1000)), diff(m(1520.0), pct(m(480.0), 2500))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cut did more than close the gap.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Imara\'s revision leaves a $40.00 surplus. Argue whether she should keep the full cut or restore some spending, and say what should happen to any surplus.' }] },
    ],
    rubric: [
      crit(
        'Revising a budget deliberately',
        'The response makes no recommendation about Imara\'s surplus.',
        'A position is taken for Imara but not supported by the figures.',
        'The response takes a supported position on Imara\'s surplus, weighing rebuilding a reserve against restoring spending, and refers to the reduced income as ongoing or temporary.',
      ),
    ],
    remediation:
      'If a learner applies the 25% cut to the whole budget, mark the variable subtotal as the base and recompute the reduction from that marked figure.',
    extension: 'Ask the learner what percentage cut to variable spending would exactly balance Imara\'s revised budget, and to show the method.',
  },
]
