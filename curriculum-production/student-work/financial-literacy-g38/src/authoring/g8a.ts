import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, m, most, least, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 8 Financial Literacy, unit 1 (PF1 - Earning Income). */
export const G8A: readonly AuthoredLesson[] = [
  {
    key: 'g8-u01-l01',
    authority: 'FIXED',
    character: 'Adaora',
    objective:
      'Learners compare two invented career pathways by computing the cost of training, the annual earnings gap it produces, and the multi-year position after the cost is repaid.',
    scenario:
      'Adaora is a made-up eighth grader comparing two pretend pathways. Path A requires a $12,000.00 invented two-year program and then pays $42,000.00 a simulated year. Path B needs no program and pays $30,000.00 a year. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the annual earnings gap between Adaora\'s two invented pathways once Path A is under way.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Path A pay each simulated year?', fixed: { expected: '$12,000.00', compute: diff(m(42000.0), m(30000.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Set the $12,000.00 program cost against that annual gap, then project five simulated years of each pathway before any cost is subtracted.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'years', text: 'How many whole years of the gap repay the program cost?', fixed: { expected: '1', compute: reach(m(12000.0), diff(m(42000.0), m(30000.0))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Path A earn across five simulated years?', fixed: { expected: '$210,000.00', compute: scale(m(42000.0), 5) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Subtract the program cost from Path A and compare the five-year positions.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Path A worth over five years after the program cost?', fixed: { expected: '$198,000.00', compute: diff(scale(m(42000.0), 5), m(12000.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than five years of Path B?', fixed: { expected: '$48,000.00', compute: diff(diff(scale(m(42000.0), 5), m(12000.0)), scale(m(30000.0), 5)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The model ignored the two years spent studying.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Adaora\'s comparison leaves out the earnings forgone during the program. Explain how including them would change the picture and what else the model omits.' }] },
    ],
    rubric: [
      crit(
        'Critiquing a pathway model',
        'The response accepts Adaora\'s five-year comparison as complete.',
        'Forgone earnings are mentioned for Adaora but not connected to the comparison.',
        'The response identifies the earnings forgone during Adaora\'s program as a real cost, and names at least one further omission such as job availability or interest on borrowed fees.',
      ),
    ],
    remediation:
      'If a learner subtracts the program cost from the annual gap rather than the cumulative total, separate Adaora\'s calculation into an annual line and a one-off line before combining them.',
    extension: 'Ask the learner to redo Adaora\'s comparison including two years of forgone Path B earnings, and to state the new five-year difference.',
  },
  {
    key: 'g8-u01-l02',
    authority: 'FIXED',
    character: 'Bastien',
    objective:
      'Learners compute monthly earnings under invented salary, commission, and self-employment structures and compare what each depends on.',
    scenario:
      'Bastien is an invented eighth grader modelling three pretend pay structures for the same month: a $3,600.00 salary; a commission role paying a $2,000.00 base plus 8% of $25,000.00 in sales; and self-employment with $5,000.00 of revenue and $1,400.00 of costs.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the commission portion of Bastien\'s invented commission role: 8% of $25,000.00 in sales.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much commission is earned?', fixed: { expected: '$2,000.00', compute: pct(m(25000.0), 800) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Complete the commission role by adding the base, then compute the self-employed net for the same invented month.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the commission role pay in total for the month?', fixed: { expected: '$4,000.00', compute: sum(m(2000.0), pct(m(25000.0), 800)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does self-employment net for the month?', fixed: { expected: '$3,600.00', compute: diff(m(5000.0), m(1400.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the three structures for Bastien, then model a weak month where sales fall to $8,000.00 and revenue falls to $2,600.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the commission role pay in the weak month?', fixed: { expected: '$2,640.00', compute: sum(m(2000.0), pct(m(8000.0), 800)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does self-employment net in the weak month?', fixed: { expected: '$1,200.00', compute: diff(m(2600.0), m(1400.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'All three structures paid similarly in a good month.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Bastien\'s two months, rank the three structures by how much risk each transfers to the earner, and justify the ranking.' }] },
    ],
    rubric: [
      crit(
        'Comparing pay structures by risk',
        'The response ranks Bastien\'s structures by the good month alone.',
        'The weak month is referenced for Bastien but the ranking is not justified.',
        'The response uses both of Bastien\'s months to rank the structures by risk transferred, noting the salary is unchanged, the commission partly protected by its base, and self-employment fully exposed.',
      ),
    ],
    remediation:
      'If a learner treats revenue as income, write Bastien\'s revenue and costs as separate lines and require both before any net figure is recorded.',
    extension: 'Ask the learner what sales level would make Bastien\'s commission role match the salary exactly, and to show the method.',
  },
  {
    key: 'g8-u01-l03',
    authority: 'FIXED',
    character: 'Cleo',
    objective:
      'Learners apply several stated payroll deduction rates to an invented gross figure and compute net pay and the total deduction burden.',
    scenario:
      'Cleo is a made-up eighth grader reading a pretend pay statement with $4,200.00 of invented monthly gross pay. Simulated deductions are 7.65% payroll tax, 11% federal withholding, and 4.25% state withholding. This is a teaching example, not a real statement.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Apply the invented 7.65% payroll deduction to Cleo\'s $4,200.00 gross.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated payroll tax?', fixed: { expected: '$321.30', compute: pct(m(4200.0), 765) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply the federal and state withholding rates to the same gross figure, keeping each as its own line.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld federally at 11%?', fixed: { expected: '$462.00', compute: pct(m(4200.0), 1100) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld by the state at 4.25%?', fixed: { expected: '$178.50', compute: pct(m(4200.0), 425) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total Cleo\'s three deductions and compute net pay, then project the annual deduction burden.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly net pay?', fixed: { expected: '$3,238.20', compute: diff(m(4200.0), sum(pct(m(4200.0), 765), pct(m(4200.0), 1100), pct(m(4200.0), 425))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the deductions come to across 12 months?', fixed: { expected: '$11,541.60', compute: scale(sum(pct(m(4200.0), 765), pct(m(4200.0), 1100), pct(m(4200.0), 425)), 12) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Nearly a quarter of gross pay never arrived.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Cleo\'s figures, explain what the payroll deduction funds differently from the withholding lines, and why one may be refundable and the other is not.' }] },
    ],
    rubric: [
      crit(
        'Distinguishing types of deduction',
        'The response treats all of Cleo\'s deductions as identical.',
        'A distinction is asserted for Cleo but not explained.',
        'The response explains that Cleo\'s payroll deduction funds specific social insurance programmes while withholding is an advance against an eventual tax bill that can be reconciled later.',
      ),
    ],
    remediation:
      'If a learner applies later rates to the reduced balance, mark Cleo\'s gross as the base for all three rates and recompute each from that marked figure.',
    extension: 'Ask the learner what single combined rate would produce the same total deduction from Cleo\'s gross, and to show the method.',
  },
  {
    key: 'g8-u01-l04',
    authority: 'FIXED',
    character: 'Dashiell',
    objective:
      'Learners compute total compensation from invented salary and benefits and compare it with a higher-salary offer carrying none.',
    scenario:
      'Dashiell is an invented eighth grader comparing pretend offers. Offer A pays $4,000.00 monthly with a $520.00 health contribution, a 4% retirement match, and $300.00 of paid-leave value. Offer B pays $4,600.00 monthly with no benefits. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 4% retirement match on Offer A\'s $4,000.00 salary.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly retirement match worth?', fixed: { expected: '$160.00', compute: pct(m(4000.0), 400) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total Offer A\'s three invented benefits, then add them to the salary for total monthly compensation.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What are Offer A\'s benefits worth together?', fixed: { expected: '$980.00', compute: sum(m(520.0), pct(m(4000.0), 400), m(300.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Offer A\'s total monthly compensation?', fixed: { expected: '$4,980.00', compute: sum(m(4000.0), m(520.0), pct(m(4000.0), 400), m(300.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare Offer A\'s total compensation with Offer B, in a month and across a simulated year.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is Offer A worth monthly in total compensation?', fixed: { expected: '$380.00', compute: diff(sum(m(4000.0), m(520.0), pct(m(4000.0), 400), m(300.0)), m(4600.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is Offer A worth across 12 months?', fixed: { expected: '$4,560.00', compute: scale(diff(sum(m(4000.0), m(520.0), pct(m(4000.0), 400), m(300.0)), m(4600.0)), 12) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Offer B still pays more cash every month.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Identify who should take Offer B despite the lower total compensation, and explain what makes cash more useful than benefits in that situation.' }] },
    ],
    rubric: [
      crit(
        'Weighing benefits against cash',
        'The response compares Dashiell\'s offers on salary alone.',
        'Total compensation is computed for Dashiell but no case for cash is made.',
        'The response uses Dashiell\'s totals and identifies a concrete situation, such as existing health cover or immediate cash needs, where the lower total compensation is the better choice.',
      ),
    ],
    remediation:
      'If a learner omits the match, list each of Dashiell\'s benefits with a dollar value before either offer is totalled.',
    extension: 'Ask the learner what Offer B salary would equal Offer A in total compensation, and to show the arithmetic.',
  },
  {
    key: 'g8-u01-l05',
    authority: 'FIXED',
    character: 'Eleni',
    objective:
      'Learners read invented labour-market data, compare typical pay across occupations, and convert monthly figures to an annual basis.',
    scenario:
      'Eleni is a made-up eighth grader studying a pretend labour-market table with three invented occupations paying typical monthly amounts of $3,200.00, $4,500.00, and $5,800.00. The table is invented for practice and describes no real occupation.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Identify the highest typical monthly figure in Eleni\'s invented table.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the highest typical monthly pay?', fixed: { expected: '$5,800.00', compute: most(m(3200.0), m(4500.0), m(5800.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Find the spread across Eleni\'s table, then convert the top figure to an annual basis.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the gap between the highest and lowest typical pay?', fixed: { expected: '$2,600.00', compute: diff(most(m(3200.0), m(4500.0), m(5800.0)), least(m(3200.0), m(4500.0), m(5800.0))) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the highest-paying occupation pay across 12 months?', fixed: { expected: '$69,600.00', compute: scale(m(5800.0), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the annual figures for the lowest and middle occupations in Eleni\'s table.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the lowest-paying occupation pay across 12 months?', fixed: { expected: '$38,400.00', compute: scale(m(3200.0), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does the middle occupation pay annually than the lowest?', fixed: { expected: '$15,600.00', compute: diff(scale(m(4500.0), 12), scale(m(3200.0), 12)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A typical figure is not a promise.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what a typical pay figure in Eleni\'s table does and does not tell someone entering that occupation, and name two things the table omits.' }] },
    ],
    rubric: [
      crit(
        'Interpreting labour-market data',
        'The response treats Eleni\'s typical figures as guaranteed pay.',
        'One limitation is named for Eleni but the meaning of a typical figure is not addressed.',
        'The response explains that a typical figure describes a middle of a range rather than an entry rate, and names omissions such as location, experience, or hours.',
      ),
    ],
    remediation:
      'If a learner treats the annual conversion as optional, require every comparison in Eleni\'s table to be stated on the same time basis before it is written down.',
    extension: 'Ask the learner what additional column would most improve Eleni\'s table for someone choosing a pathway, and why.',
  },
  {
    key: 'g8-u01-l06',
    authority: 'FIXED',
    character: 'Fabio',
    objective:
      'Learners analyse invented irregular self-employment income across several months, compute an average, and identify the planning risk in the weakest month.',
    scenario:
      'Fabio is an invented eighth grader modelling three pretend months of self-employment: revenue of $6,200.00, $2,800.00, and $4,500.00, with invented costs of $1,900.00 every month. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Fabio\'s three invented months of revenue.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the three-month revenue total?', fixed: { expected: '$13,500.00', compute: sum(m(6200.0), m(2800.0), m(4500.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Take three months of costs out of that revenue, then find the average monthly net.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the three-month net after costs?', fixed: { expected: '$7,800.00', compute: diff(sum(m(6200.0), m(2800.0), m(4500.0)), scale(m(1900.0), 3)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the average monthly net?', fixed: { expected: '$2,600.00', compute: div(diff(sum(m(6200.0), m(2800.0), m(4500.0)), scale(m(1900.0), 3)), 3) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the weakest and strongest single months for Fabio, so the average can be tested against reality.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net in the weakest month?', fixed: { expected: '$900.00', compute: diff(m(2800.0), m(1900.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far below the average is that weakest month?', fixed: { expected: '$1,700.00', compute: diff(div(diff(sum(m(6200.0), m(2800.0), m(4500.0)), scale(m(1900.0), 3)), 3), diff(m(2800.0), m(1900.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The average month never actually happened.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Fabio should not build fixed monthly commitments on the average, and describe a rule that would make the irregular income safe to plan around.' }] },
    ],
    rubric: [
      crit(
        'Planning around irregular income',
        'The response treats Fabio\'s average as a dependable monthly figure.',
        'The weak month is noticed for Fabio but no planning rule is proposed.',
        'The response argues that Fabio should commit only to the level the weakest month supports, and proposes a concrete rule such as banking the surplus of strong months into a buffer.',
      ),
    ],
    remediation:
      'If a learner averages revenue instead of net, require costs to be subtracted for each of Fabio\'s months before any average is computed.',
    extension: 'Ask the learner what buffer Fabio would need to smooth all three months to the average, and to show the reasoning.',
  },
  {
    key: 'g8-u01-l07',
    authority: 'JUDGMENT',
    character: 'Greta',
    objective:
      'Learners evaluate the quality of invented sources about a career pathway and decide what evidence would justify a decision.',
    scenario:
      'Greta is an invented eighth grader researching a pretend pathway. Her three invented sources are a training provider\'s own brochure promising high placement, a public statistics table with no year given, and a single interview with one worker who loves the job. All sources are invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Assess each of Greta\'s three invented sources in turn: who produced it, what interest they have, and what it can and cannot establish. Keep the assessment separate from whether the claims sound plausible.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What is the main weakness of each of Greta\'s three sources, and who benefits from each being believed?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Specify what evidence Greta would need before committing to the pathway, and how she could obtain it from sources with different interests.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What evidence would justify Greta\'s decision, and where could each piece come from?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'One source was a single person\'s experience.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is one worker\'s enthusiasm useful evidence about some questions and useless about others?' }],
      },
    ],
    rubric: [
      crit(
        'Evaluating sources by interest and scope',
        'The response ranks Greta\'s sources by how convincing they sound.',
        'One weakness is identified for Greta but the interests behind the sources are not addressed.',
        'The response identifies the provider\'s commercial interest, the undated statistics, and the single-case interview as distinct weaknesses in Greta\'s set, and says who benefits from each.',
      ),
      crit(
        'Specifying decision-grade evidence',
        'No evidence requirement is stated for Greta.',
        'Evidence is named for Greta but with no route to obtaining it.',
        'The response specifies what Greta needs, such as dated placement rates from an independent body, and names where each piece could come from.',
      ),
    ],
    lookFors: [
      'Names the brochure\'s commercial interest explicitly.',
      'Flags the missing date on the statistics table.',
      'Distinguishes what a single interview can and cannot show.',
      'Specifies at least one independent source Greta could seek.',
    ],
    remediation:
      'If a learner accepts the brochure, ask what the provider gains from each claim in Greta\'s set, and rebuild the assessment from those answers.',
    extension: 'Ask the learner to write three questions Greta should put to the training provider that the brochure does not answer.',
  },
  {
    key: 'g8-u01-l08',
    authority: 'FIXED',
    character: 'Hamid',
    objective:
      'Learners compute pay combining invented regular hours and a higher overtime rate, and quantify what the premium is worth.',
    scenario:
      'Hamid is a made-up eighth grader modelling a pretend week: 38 regular hours at $21.40 an hour plus 6 overtime hours at an invented $32.10 an hour. All figures are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Hamid\'s invented regular pay: 38 hours at $21.40.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the regular hours pay?', fixed: { expected: '$813.20', compute: scale(m(21.4), 38) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the overtime portion at the higher invented rate, then combine both parts into the week\'s total.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the 6 overtime hours pay?', fixed: { expected: '$192.60', compute: scale(m(32.1), 6) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the total pay for the week?', fixed: { expected: '$1,005.80', compute: sum(scale(m(21.4), 38), scale(m(32.1), 6)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out what those 6 hours would have paid at the regular rate, and what the premium is worth.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 6 hours at the regular rate have paid?', fixed: { expected: '$128.40', compute: scale(m(21.4), 6) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the overtime premium worth on those hours?', fixed: { expected: '$64.20', compute: diff(scale(m(32.1), 6), scale(m(21.4), 6)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The extra hours paid half as much again.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what an overtime premium is compensating a worker for, and why relying on it as regular income is risky.' }] },
    ],
    rubric: [
      crit(
        'Interpreting an overtime premium',
        'The response treats Hamid\'s overtime as ordinary income.',
        'The premium is computed for Hamid but its purpose or instability is not addressed.',
        'The response explains that the premium compensates for time given beyond the normal schedule, and warns that overtime can be withdrawn, so it should not anchor fixed commitments.',
      ),
    ],
    remediation:
      'If a learner applies one rate to all hours, split Hamid\'s week into two labelled blocks with their own rates before any total is written.',
    extension: 'Ask the learner how many overtime hours Hamid would need to reach $1,200.00 in a week, and to show the reasoning.',
  },
  {
    key: 'g8-u01-l09',
    authority: 'FIXED',
    character: 'Isla',
    objective:
      'Learners build a complete invented gross-to-net calculation with rounding at the cent, and interpret the resulting effective deduction burden.',
    scenario:
      'Isla is an invented eighth grader completing a pretend payroll task on $3,150.00 of invented monthly gross pay, with simulated deductions of 7.65% payroll tax, 10% federal withholding, and 3% state withholding. This is a teaching example only.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 7.65% payroll deduction on Isla\'s $3,150.00 gross, rounding to the cent as a statement would.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated payroll tax?', fixed: { expected: '$240.98', compute: pct(m(3150.0), 765, 'half-up'), note: 'The exact product is $240.975; payroll systems round to the cent.' } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the federal and state withholding lines on the same gross figure, then total all three deductions.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld federally at 10%?', fixed: { expected: '$315.00', compute: pct(m(3150.0), 1000) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do all three deductions come to?', fixed: { expected: '$650.48', compute: sum(pct(m(3150.0), 765, 'half-up'), pct(m(3150.0), 1000), pct(m(3150.0), 300)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute Isla\'s net pay by taking the combined deduction total off the gross figure, then project that monthly net across a full simulated year of twelve identical months.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly net pay?', fixed: { expected: '$2,499.52', compute: diff(m(3150.0), sum(pct(m(3150.0), 765, 'half-up'), pct(m(3150.0), 1000), pct(m(3150.0), 300))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the annual net pay?', fixed: { expected: '$29,994.24', compute: scale(diff(m(3150.0), sum(pct(m(3150.0), 765, 'half-up'), pct(m(3150.0), 1000), pct(m(3150.0), 300))), 12) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One deduction required rounding.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why the payroll line had to be rounded and what would happen to Isla\'s annual figures if a system rounded down every month instead.' }] },
    ],
    rubric: [
      crit(
        'Handling rounding in payroll',
        'The response ignores the rounding in Isla\'s calculation.',
        'Rounding is noted for Isla but the annual consequence is not considered.',
        'The response explains that fractions of a cent cannot be paid so the line is rounded, and reasons about the cumulative effect of a consistent rounding direction across a year.',
      ),
    ],
    remediation:
      'If a learner truncates instead of rounding, write out Isla\'s exact product to three decimal places and apply the stated rounding rule explicitly.',
    extension: 'Ask the learner what gross pay would give Isla exactly $2,600.00 net under these three rates, and to describe the method.',
  },
  {
    key: 'g8-u01-l10',
    authority: 'FIXED',
    character: 'Jarrah',
    objective:
      'Learners synthesise salary, benefits, and match structures to compare two invented offers on total compensation and on cash.',
    scenario:
      'Jarrah is a made-up eighth grader comparing pretend offers. Offer A pays $3,800.00 monthly with a $480.00 health contribution and a 5% retirement match. Offer B pays $4,150.00 monthly with a flat $200.00 benefit allowance. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented 5% retirement match on Offer A\'s $3,800.00 salary.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the retirement match worth monthly?', fixed: { expected: '$190.00', compute: pct(m(3800.0), 500) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total each offer\'s monthly compensation for Jarrah, benefits included.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Offer A worth in total monthly compensation?', fixed: { expected: '$4,470.00', compute: sum(m(3800.0), m(480.0), pct(m(3800.0), 500)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Offer B worth in total monthly compensation?', fixed: { expected: '$4,350.00', compute: sum(m(4150.0), m(200.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the two offers on total compensation and on cash in hand for Jarrah.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is Offer A worth in total compensation?', fixed: { expected: '$120.00', compute: diff(sum(m(3800.0), m(480.0), pct(m(3800.0), 500)), sum(m(4150.0), m(200.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more cash salary does Offer B pay?', fixed: { expected: '$350.00', compute: diff(m(4150.0), m(3800.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The offers point in opposite directions.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Recommend one of Jarrah\'s offers and defend it against the strongest argument for the other, using both figures you computed.' }] },
    ],
    rubric: [
      crit(
        'Synthesising a compensation comparison',
        'The response picks one of Jarrah\'s offers with no use of the figures.',
        'A recommendation is made for Jarrah but the counter-argument is not addressed.',
        'The response recommends one of Jarrah\'s offers using both the $120.00 total-compensation gap and the $350.00 cash gap, and answers the strongest case for the other.',
      ),
    ],
    remediation:
      'If a learner compares only one dimension, require both a total-compensation line and a cash line for each of Jarrah\'s offers before any recommendation.',
    extension: 'Ask the learner what health contribution Offer B would need for the two offers to match on total compensation.',
  },
]
