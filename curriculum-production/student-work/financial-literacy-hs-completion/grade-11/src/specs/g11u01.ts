import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 1 — PF1 Earning Income: Education, Career, and Lifetime
 * Earnings Tradeoffs. Ten lessons, one per source lesson day.
 *
 * The grade-11 move in this unit is that a pathway is never scored on its
 * sticker price. Every lesson makes the learner carry forgone earnings, a
 * multi-year horizon, or a stated growth assumption through the arithmetic, and
 * then say what would change the answer. Every wage, employer, programme, and
 * percentile in the unit is invented.
 */
export const g11u01: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u01-l01',
    grade: 11, unit: 1, day: 1,
    actor: 'Priya Raghunathan, a fictional eleventh-grader mapping three pathways',
    objective: 'Build an eight-year net position for three fictional post-secondary pathways, rank them, and state the horizon at which the ranking is being decided.',
    scenario: 'Priya Raghunathan is a fictional eleventh-grader. The three pathways below, their costs, and their salaries are invented for this exercise and describe no real programme, employer, or wage.',
    materials: ['calculator', 'the three fictional pathway summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'Pathway A is a fictional two-year technical certificate costing $9,400 a year in tuition. Pathway B is a fictional four-year degree costing $18,600 a year. Pathway C is going straight to work with no tuition at all. Count the whole horizon as the first 8 years after high school.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total tuition for Pathway A across its 2 years?',
            given: { tuitionA: 9400 }, expr: 'tuitionA * 2', format: 'usd', answer: '$18,800.00',
            reasoning: 'Tuition is charged once a year for the length of the programme: $9,400 for each of 2 years.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total tuition for Pathway B across its 4 years?',
            given: { tuitionB: 18600 }, expr: 'tuitionB * 4', format: 'usd', answer: '$74,400.00',
            reasoning: 'The same rule over a longer programme: $18,600 for each of 4 years, which is where most of the cost difference between the pathways comes from.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now the earnings side. Pathway A earns $41,200 a year once the certificate is finished, which gives 6 earning years inside the horizon: years 3 through 8. Pathway B earns $56,800 a year and has 4 earning years, years 5 through 8. Pathway C earns $31,500 a year for all 8 years. Hold each salary flat across the horizon.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does Pathway A earn across the horizon, counting only its 6 earning years?',
            given: { salaryA: 41200, yearsA: 6 }, expr: 'salaryA * yearsA', format: 'usd', answer: '$247,200.00',
            reasoning: 'Years 1 and 2 are study years with no wage, so only 6 of the 8 years pay anything: $41,200 x 6.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does Pathway B earn across the horizon, counting only its 4 earning years?',
            given: { salaryB: 56800, yearsB: 4 }, expr: 'salaryB * yearsB', format: 'usd', answer: '$227,200.00',
            reasoning: 'Pathway B has the highest salary but the fewest earning years inside this horizon: $56,800 x 4.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does Pathway C earn across the horizon, earning in all 8 years?',
            given: { salaryC: 31500, yearsC: 8 }, expr: 'salaryC * yearsC', format: 'usd', answer: '$252,000.00',
            reasoning: 'The lowest salary of the three, but paid in every year of the horizon: $31,500 x 8.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Net position is what a pathway earned across the horizon less what its tuition cost. Work these without help.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Pathway A’s net position at the end of year 8?',
            given: {}, expr: '#t2-p1 - #t1-p1', format: 'usd', answer: '$228,400.00',
            reasoning: 'Earnings less tuition for the same pathway: $247,200.00 earned against $18,800.00 of tuition.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Pathway B’s net position at the end of year 8?',
            given: {}, expr: '#t2-p2 - #t1-p2', format: 'usd', answer: '$152,800.00',
            reasoning: 'The same subtraction for Pathway B: $227,200.00 earned against $74,400.00 of tuition, the largest tuition bill of the three.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does Pathway C’s eight-year position exceed the better of the other two?',
            given: {}, expr: '#t2-p3 - max(#t3-p1, #t3-p2)', format: 'usd', answer: '$23,600.00',
            reasoning: 'Pathway C has no tuition to subtract, so its $252,000.00 stands against the stronger of $228,400.00 and $152,800.00, which is Pathway A.',
          },
          {
            ref: 't3-p4', kind: 'choice',
            text: 'Ranked by net position at the end of year 8, which pathway comes first?',
            choices: ['Pathway A, the 2-year certificate', 'Pathway B, the 4-year degree', 'Pathway C, straight to work'],
            given: {},
            decision: { left: '#t2-p3', cmp: '>', right: '#t3-p1', ifTrue: 'Pathway C, straight to work', ifFalse: 'Pathway A, the 2-year certificate' },
            answer: 'Pathway C, straight to work',
            reasoning: 'At this horizon the ranking is decided by earning years, not by salary: C’s $252,000.00 beats A’s $228,400.00 because C was paid in all 8 years while A was paid in 6.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Pathway C finishes first at year 8 and finishes last on salary. Explain what the eight-year horizon is doing to the ranking, and say what you would expect to happen to the ranking at year 20 and why.',
            acceptableAnswerCriteria: [
              'Explains that the eight-year window rewards years spent earning, and that C wins it by being paid in all 8 years while A is paid in 6 and B in only 4.',
              'States that beyond the horizon the annual salary gaps keep accruing while the tuition is already spent, so B gains $25,300 a year on C and would eventually overtake it.',
              'Treats the ranking as a property of the chosen horizon rather than as a fact about the pathways.',
            ],
            evidenceRequirements: [
              'Cites the number of earning years for at least two pathways and the annual salary figures that would drive the later comparison.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the horizon itself as the thing doing the work, not the salaries alone.',
              'The response uses the annual gap between salaries to argue about year 20 rather than asserting a reversal without a mechanism.',
              'A response that argues C could stay ahead is acceptable if it says what would have to hold, such as C also receiving raises.',
            ],
            commonMisconception: 'Reading a comparison made at one horizon as the permanent ranking of the options.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Every salary in this model is held flat for eight years. Name one way that assumption favours a particular pathway, and say which computed figure would move most if it were dropped.',
            acceptableAnswerCriteria: [
              'Identifies that flat salaries suppress the advantage of the pathways that start higher, because a percentage raise on $56,800 is worth more than the same raise on $31,500.',
              'Names a specific computed figure that would move, such as Pathway C’s $252,000.00 total or Pathway B’s $227,200.00, and says in which direction.',
            ],
            evidenceRequirements: [
              'Refers to at least two of the three annual salary figures when explaining who the flat assumption favours.',
            ],
            dimensions: ['assumption-identification', 'tradeoff-defense'],
            lookFors: [
              'The response reasons about raises as percentages of different bases rather than as equal dollar amounts.',
              'The response names a figure and a direction rather than saying only that "the numbers would change".',
            ],
            commonMisconception: 'Treating a simplifying assumption as neutral between the options it is applied to.',
          },
        ],
      },
    ],
    remediation: 'If a pathway’s earnings come out too high, the study years are being paid. Rebuild the horizon as a row of 8 boxes per pathway and write a salary only in the boxes after the programme ends: 6 boxes for A, 4 for B, 8 for C. Tuition then comes off the total once, not once a year, and the net position is the row total minus that single subtraction.',
    extension: 'Extend all three pathways to a 20-year horizon with salaries still held flat, and find the first horizon at which Pathway B moves ahead of Pathway C.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l02',
    grade: 11, unit: 1, day: 2,
    actor: 'Marcus Delacroix-Whitfield, a fictional adult returning to full-time study',
    objective: 'Compute the earnings a fictional adult gives up across four full-time study years when the wage he leaves would itself have grown, add that to tuition to reach a true cost, and convert it into a recovery period.',
    scenario: 'Marcus Delacroix-Whitfield is a fictional warehouse coordinator considering four years of full-time study. His current wage, the raise pattern, and the tuition below are simulated figures for this exercise.',
    materials: ['calculator', 'the fictional wage and tuition figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Marcus earns $32,000 this year. If he keeps working instead of studying, his employer’s pattern gives him a raise of 2.5% at the start of each following year. Study takes 4 years, during which he would earn nothing. Round each year to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What would Marcus earn in the first of the four years if he kept working?',
            given: { wage: 32000 }, expr: 'wage', format: 'usd', answer: '$32,000.00',
            reasoning: 'The first year is the wage he already has, before any raise has been applied.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would he earn in the second year, after one raise of 2.5%?',
            given: { wage2: 32000, growth: 0.025 }, expr: 'round(wage2 * pow(1 + growth, 1), 2)', format: 'usd', answer: '$32,800.00',
            reasoning: 'One year of 2.5% growth applied to $32,000, which is the wage he is giving up in the second study year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would he earn in the third year, after two raises of 2.5%?',
            given: { wage3: 32000, growth3: 0.025 }, expr: 'round(wage3 * pow(1 + growth3, 2), 2)', format: 'usd', answer: '$33,620.00',
            reasoning: 'Two years of compounding: the second raise is applied to $32,800, not to the original $32,000.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What would he earn in the fourth year, after three raises of 2.5%?',
            given: { wage4: 32000, growth4: 0.025 }, expr: 'round(wage4 * pow(1 + growth4, 3), 2)', format: 'usd', answer: '$34,460.50',
            reasoning: 'Three years of compounding on $32,000. Compounding is why the forgone amount is larger than four times the starting wage.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Tuition is $12,750 a year for each of the 4 study years. Once he finishes, the qualification is expected to raise his pay by $19,400 a year over what he would otherwise have been earning.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What are the total earnings Marcus gives up across all four study years?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3 + #t1-p4', format: 'usd', answer: '$132,880.50',
            reasoning: 'The four forgone years added: $32,000.00 + $32,800.00 + $33,620.00 + $34,460.50.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total tuition across the 4 study years?',
            given: { tuition: 12750 }, expr: 'tuition * 4', format: 'usd', answer: '$51,000.00',
            reasoning: 'Tuition of $12,750 charged in each of the 4 study years.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the true cost of the four years, counting both the tuition and the earnings given up?',
            given: {}, expr: '#t2-p1 + #t2-p2', format: 'usd', answer: '$183,880.50',
            reasoning: 'The economic cost is the cash paid out plus the income never received: $132,880.50 forgone plus $51,000.00 of tuition.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'years',
            text: 'At an advantage of $19,400 a year, how many years of work does it take to recover the true cost? Give one decimal place.',
            given: { advantage: 19400 }, expr: 'round(#t2-p3 / advantage, 1)', format: 'years1', answer: '9.5',
            reasoning: '$183,880.50 divided by the $19,400 annual advantage. Recovery is measured against the true cost, not against tuition alone.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which of the two parts of the true cost is larger for Marcus?',
            choices: ['The tuition he pays', 'The earnings he gives up', 'They are equal'],
            given: {},
            decision: { left: '#t2-p1', cmp: '>', right: '#t2-p2', ifTrue: 'The earnings he gives up', ifFalse: 'The tuition he pays' },
            answer: 'The earnings he gives up',
            reasoning: '$132,880.50 of forgone earnings against $51,000.00 of tuition — the invisible half of the cost is more than twice the half that arrives as a bill.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A friend tells Marcus the programme "costs $51,000". Explain what that figure leaves out, why the omitted part is easy to miss, and what it does to the recovery period.',
            acceptableAnswerCriteria: [
              'Identifies the $132,880.50 of forgone earnings as the omission, and explains that it never appears as a bill because it is income that simply never arrives.',
              'States that counting tuition alone would give a recovery period of about 2.6 years against the 9.5 years the full cost produces.',
              'Explains that the forgone side compounds, so it grows with the length of the programme rather than staying fixed.',
            ],
            evidenceRequirements: [
              'Cites the $51,000.00 tuition figure and the $132,880.50 forgone-earnings figure side by side.',
            ],
            dimensions: ['reasoning-from-figures', 'error-diagnosis', 'evidence-use'],
            lookFors: [
              'The response explains why an opportunity cost is invisible, not merely that it was forgotten.',
              'The response connects the omission to a specific consequence for the recovery period.',
              'A response that computes the tuition-only recovery period itself is stronger than one that only says it would be shorter.',
            ],
            commonMisconception: 'Treating the cost of a programme as the amount that appears on the invoice.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The model gives Marcus a raise of 2.5% in each year he is not studying. Say what would happen to the true cost if that raise pattern were smaller, and name one thing about his job that would make the 2.5% assumption unsafe.',
            acceptableAnswerCriteria: [
              'States that a smaller raise pattern lowers the forgone earnings, lowering the true cost below $183,880.50 and shortening the 9.5-year recovery.',
              'Names a specific reason the assumption could fail, such as raises being tied to a role he would leave anyway, or the wage in that job having a ceiling.',
            ],
            evidenceRequirements: [
              'Refers to the compounded fourth-year figure of $34,460.50 or to the $132,880.50 total when describing what the raise assumption controls.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the raise pattern as an assumption about the alternative, not about the programme.',
              'The response gives a mechanism for the assumption failing rather than saying only that it "might not happen".',
            ],
          },
        ],
      },
    ],
    remediation: 'If the forgone total comes out at $128,000, the four years are being valued at $32,000 each and the raises are being dropped. The wage Marcus is giving up rises while he studies, so year 3 gives up $33,620.00 and not $32,000.00. Build the four years as separate rows, apply 2.5% to the previous row rather than to the first row, and only then add the column.',
    extension: 'Recompute the true cost and the recovery period for a 2-year version of the same programme at the same tuition rate, and say why the recovery period does not simply halve.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l03',
    grade: 11, unit: 1, day: 3,
    actor: 'Odalys Ferreira-Nkemelu, a fictional counsellor comparing earnings percentiles',
    objective: 'Work with a fictional field’s earnings distribution rather than its median alone, compute a probability-weighted expectation, and quantify how much a median-only ten-year plan overstates a lower-percentile outcome.',
    scenario: 'Odalys Ferreira-Nkemelu is a fictional careers counsellor. The percentile figures below describe an invented occupation and are not drawn from any published wage survey.',
    materials: ['calculator', 'the fictional percentile table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'For the invented field, the 25th percentile earns $38,900 a year, the median earns $47,600, and the 75th percentile earns $61,300.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the spread between the 75th percentile and the 25th percentile in this fictional field?',
            given: { p75: 61300, p25: 38900 }, expr: 'p75 - p25', format: 'usd', answer: '$22,400.00',
            reasoning: 'The interquartile spread is the distance between the two outer figures: $61,300 less $38,900. It is the size of the variation the median hides.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'The spread is what percentage of the median? Give one decimal place.',
            given: { median: 47600 }, expr: 'round(#t1-p1 / median * 100, 1)', format: 'percent1', answer: '47.1%',
            reasoning: 'Expressing the spread against the median makes the variation comparable across fields: $22,400.00 against $47,600.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Treat the three percentiles as a simplified fictional distribution: a 25% chance of landing at the 25th-percentile wage, a 50% chance of landing at the median, and a 25% chance of landing at the 75th-percentile wage. This is a teaching simplification, not how a real wage distribution is shaped.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the probability-weighted expected wage under this simplified distribution?',
            given: { pLow: 0.25, low: 38900, pMid: 0.5, mid: 47600, pHigh: 0.25, high: 61300 },
            expr: 'pLow * low + pMid * mid + pHigh * high', format: 'usd', answer: '$48,850.00',
            reasoning: 'Each outcome is weighted by its stated chance: 25% of $38,900 plus 50% of $47,600 plus 25% of $61,300. The expectation sits above the median because the upper tail is further from the middle than the lower tail.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much does the expected wage differ from the median wage?',
            given: { median2: 47600 }, expr: '#t2-p1 - median2', format: 'usd', answer: '$1,250.00',
            reasoning: '$48,850.00 against the $47,600 median. The gap is a direct consequence of the distribution being lopsided, not an error.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Odalys now builds two 10-year plans for the same fictional field: one that assumes the median wage every year and one that assumes the 25th-percentile wage every year. Hold each wage flat.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the 10-year plan total at the median wage?',
            given: { median3: 47600, years: 10 }, expr: 'median3 * years', format: 'usd', answer: '$476,000.00',
            reasoning: 'Ten flat years at the $47,600 median.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the 10-year plan total at the 25th-percentile wage?',
            given: { p25b: 38900, years2: 10 }, expr: 'p25b * years2', format: 'usd', answer: '$389,000.00',
            reasoning: 'The same ten years at the $38,900 lower-percentile wage.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does the median plan overstate the 25th-percentile plan across the decade?',
            given: {}, expr: '#t3-p1 - #t3-p2', format: 'usd', answer: '$87,000.00',
            reasoning: '$476,000.00 against $389,000.00. A single year’s $8,700 gap becomes this once it is carried for ten years.',
          },
          {
            ref: 't3-p4', kind: 'numeric', unit: 'percent',
            text: 'The overstatement is what percentage of the median plan? Give one decimal place.',
            given: {}, expr: 'round(#t3-p3 / #t3-p1 * 100, 1)', format: 'percent1', answer: '18.3%',
            reasoning: '$87,000.00 measured against the $476,000.00 the median plan assumed — the share of the plan that rests on landing at or above the middle of the field.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Odalys writes that "planning on the median is planning on a coin flip". Using the figures you computed, say what is right about that description and what is misleading about it.',
            acceptableAnswerCriteria: [
              'Accepts that roughly half of the field earns below the median, so a median plan has a substantial chance of being too optimistic.',
              'Corrects the description by pointing out that falling below the median is not a single outcome: the shortfall at the 25th percentile is $87,000.00 across the decade, and someone just below the median is barely affected.',
              'Distinguishes the chance of missing the target from the size of the miss.',
            ],
            evidenceRequirements: [
              'Cites the $87,000.00 decade shortfall or the 18.3% figure when describing how large a miss can be.',
            ],
            dimensions: ['communication-of-uncertainty', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response separates likelihood from magnitude rather than treating "below median" as one event.',
              'The response does not conclude that the median is useless; it says what it is and is not good for.',
              'A response arguing the phrase is fair as shorthand is acceptable if it names the magnitude point it is glossing over.',
            ],
            commonMisconception: 'Reading a median as a typical guaranteed outcome rather than as the middle of a spread.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The expected wage of $48,850.00 came out above the median of $47,600. Explain what feature of the fictional distribution produces that, and say whether the expected wage or the median is the better figure to build a minimum plan on.',
            acceptableAnswerCriteria: [
              'Explains that the 75th percentile sits $13,700 above the median while the 25th sits $8,700 below it, so the weighted average is pulled upward.',
              'Argues for a figure at or below the median for a minimum plan, on the ground that a plan should survive the outcomes it is most exposed to rather than the average of all of them.',
            ],
            evidenceRequirements: [
              'Uses the distances from the median to the 25th and 75th percentiles, not just the three wage figures on their own.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The response identifies the asymmetry of the distances, not merely that the high figure is large.',
              'The response gives a reason for its choice of planning figure rather than picking one.',
            ],
            commonMisconception: 'Assuming an average and a median must coincide.',
          },
        ],
      },
    ],
    remediation: 'If the expected wage comes out as $49,266.67, the three percentiles are being averaged as equals and the stated 25/50/25 weights are being ignored. Write the three products in a column — 0.25 x $38,900, 0.5 x $47,600, 0.25 x $61,300 — check that the weights sum to 1 before adding, and only then total the column.',
    extension: 'Recompute the expected wage under weights of 40%, 40%, and 20%, and say how much the ten-year median plan would then be overstating a plan built on the expectation.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l04',
    grade: 11, unit: 1, day: 4,
    actor: 'Tobias Ferndale-Aquino, a fictional graduate testing a twelve-year salary projection',
    objective: 'Recompute a fictional twelve-year salary projection under two stated raise assumptions, measure the gap the assumption alone creates, and test the projection against a target.',
    scenario: 'Tobias Ferndale-Aquino is a fictional laboratory technician whose twelve-year projection is printed below. Every wage and growth rate in it is invented, and the projection is a simulated planning exercise.',
    materials: ['calculator', 'the fictional projection assumptions in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The projection starts at a salary of $44,500 in year 1 and applies a raise at the start of each year after that. Year 12 is therefore 11 raises after the start. The optimistic assumption is 3.2% a year; the cautious assumption is 1.2% a year. Round each result to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'Under the 3.2% assumption, what is the year-12 salary?',
            given: { start: 44500, fast: 0.032 }, expr: 'round(start * pow(1 + fast, 11), 2)', format: 'usd', answer: '$62,926.95',
            reasoning: 'Eleven compounding raises of 3.2% on the $44,500 starting salary, because year 1 receives no raise.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Under the 1.2% assumption, what is the year-12 salary?',
            given: { start2: 44500, slow: 0.012 }, expr: 'round(start2 * pow(1 + slow, 11), 2)', format: 'usd', answer: '$50,739.44',
            reasoning: 'The same eleven periods at the lower rate. Nothing about the job changed here; only the assumption did.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the year-12 gap between the two assumptions?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$12,187.51',
            reasoning: '$62,926.95 against $50,739.44 — the whole of this difference is produced by a 2 percentage point change in a rate nobody has observed yet.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Tobias wants a year-12 salary of at least $58,000. Test both assumptions against that target.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'The gap is what percentage of the year-12 salary the optimistic assumption predicts? Give one decimal place.',
            given: {}, expr: 'round(#t1-p3 / #t1-p1 * 100, 1)', format: 'percent1', answer: '19.4%',
            reasoning: '$12,187.51 measured against $62,926.95 — the share of the optimistic projection that exists only because of the rate chosen.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Under the cautious assumption, by how much does the year-12 salary fall short of the $58,000 target?',
            given: { target: 58000 }, expr: 'target - #t1-p2', format: 'usd', answer: '$7,260.56',
            reasoning: 'The $58,000 target against the $50,739.44 the 1.2% assumption produces.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Under the optimistic assumption, by how much does the year-12 salary exceed the same target?',
            given: { target2: 58000 }, expr: '#t1-p1 - target2', format: 'usd', answer: '$4,926.95',
            reasoning: '$62,926.95 against the $58,000 target. The target sits between the two projections, which is what makes the assumption decisive.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Does the $58,000 target survive both assumptions, only the optimistic one, or neither?',
            choices: ['Both assumptions clear it', 'Only the 3.2% assumption clears it', 'Neither assumption clears it'],
            given: { target3: 58000 },
            decision: { left: '#t1-p2', cmp: '>=', right: 'target3', ifTrue: 'Both assumptions clear it', ifFalse: 'Only the 3.2% assumption clears it' },
            answer: 'Only the 3.2% assumption clears it',
            reasoning: 'The cautious projection reaches $50,739.44 and misses; the optimistic one reaches $62,926.95 and clears. A target that only one assumption reaches is a target that rests on the assumption.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One more comparison, to separate the effect of the rate from the effect of the horizon.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'Under the 3.2% assumption, what would the salary be in year 6, which is 5 raises after the start?',
            given: { start3: 44500, fast2: 0.032 }, expr: 'round(start3 * pow(1 + fast2, 5), 2)', format: 'usd', answer: '$52,090.50',
            reasoning: 'Five compounding raises rather than eleven, on the same $44,500 base.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the optimistic projection’s total year-12 growth arrives after year 6?',
            given: {}, expr: '#t1-p1 - #t3-p1', format: 'usd', answer: '$10,836.45',
            reasoning: '$62,926.95 in year 12 against $52,090.50 in year 6 — more growth arrives in the second half than the first, which is what compounding does to a projection.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Tobias says the projection "shows" he will be earning about $63,000 in year 12. Rewrite that claim so it is defensible, and say what evidence would justify picking one of the two rates over the other.',
            acceptableAnswerCriteria: [
              'Rewrites the claim as conditional, naming the rate the figure depends on — that $62,926.95 is what year 12 looks like if raises average 3.2% for eleven straight years.',
              'Names evidence that would support choosing a rate, such as the employer’s actual raise history over several years, or the raise pattern for the same role across the sector.',
              'Notes that the target of $58,000 falls between the two projections, so the choice of rate decides whether the plan succeeds.',
            ],
            evidenceRequirements: [
              'Cites both year-12 figures, $62,926.95 and $50,739.44, when explaining why the claim needs its condition attached.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification', 'evidence-use'],
            lookFors: [
              'The rewritten claim carries the assumption inside it rather than in a footnote.',
              'The evidence named is something that could actually be gathered before the twelve years elapse.',
              'The response does not simply average the two rates and present that as the safe answer.',
            ],
            commonMisconception: 'Treating the output of a projection as a finding about the future rather than a consequence of its inputs.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'More of the optimistic projection’s growth arrives after year 6 than before it. Explain why, and say what that timing means for someone deciding whether to leave the job in year 5.',
            acceptableAnswerCriteria: [
              'Explains that each raise is applied to a larger salary than the last, so equal percentages produce unequal dollar amounts and the later years contribute more.',
              'Draws the implication that leaving in year 5 forgoes the larger part of the projected growth, so the decision should be judged against $10,836.45 of later growth rather than against the year-5 salary.',
            ],
            evidenceRequirements: [
              'Uses the year-6 figure of $52,090.50 alongside the year-12 figure to show where the growth sits.',
            ],
            dimensions: ['reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response explains compounding in terms of a growing base rather than restating that the number gets bigger.',
              'The response treats the later growth as conditional on the same 3.2% assumption holding.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the year-12 figure comes out at $64,940.61, twelve raises are being applied instead of eleven. Year 1 is the starting salary with no raise on it, so year 2 has one raise and year 12 has eleven. Count the raises on a number line from year 1 to year 12 before choosing the exponent, and check the year-6 case, which should show 5.',
    extension: 'Find the constant annual raise, to the nearest tenth of a percent, that would put the year-12 salary exactly at the $58,000 target, and say whether it is closer to the cautious or the optimistic assumption.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l05',
    grade: 11, unit: 1, day: 5,
    actor: 'Simone Batbayar-Cruz, a fictional applicant weighing a programme she might not finish',
    objective: 'Model the risk of not completing a fictional programme as a probability-weighted outcome, compare it with an alternative, and identify what the debt does in the outcome where the qualification does not arrive.',
    scenario: 'Simone Batbayar-Cruz is a fictional applicant to an invented three-year programme. The completion rate, salaries, and costs below are simulated figures chosen for this exercise.',
    materials: ['calculator', 'the fictional programme figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional programme runs 3 years at $14,200 a year, all borrowed. Of the invented cohort, 68% finish and 32% do not. A graduate earns $58,400 a year. Someone who leaves without finishing earns $34,900. Without the programme at all, Simone would earn $39,800.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total borrowed across the 3 years of the programme?',
            given: { annual: 14200 }, expr: 'annual * 3', format: 'usd', answer: '$42,600.00',
            reasoning: 'Three years of $14,200, all of it borrowed, which is owed whether or not the qualification arrives.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the probability-weighted expected annual salary after the programme, using the 68% and 32% figures?',
            given: { pDone: 0.68, gradPay: 58400, pLeft: 0.32, leftPay: 34900 },
            expr: 'pDone * gradPay + pLeft * leftPay', format: 'usd', answer: '$50,880.00',
            reasoning: '68% of $58,400 plus 32% of $34,900. The expectation is well below the graduate salary because nearly a third of the cohort does not reach it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual advantage over the $39,800 Simone would earn without the programme?',
            given: { without: 39800 }, expr: '#t1-p2 - without', format: 'usd', answer: '$11,080.00',
            reasoning: 'The expected salary of $50,880.00 against the $39,800 alternative. This is the advantage the borrowing has to be repaid out of.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now separate the two outcomes and look at each on its own.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'years',
            text: 'At the expected annual advantage, how many years of work does it take to repay the amount borrowed? Give one decimal place. Ignore interest for this step.',
            given: {}, expr: 'round(#t1-p1 / #t1-p3, 1)', format: 'years1', answer: '3.8',
            reasoning: '$42,600.00 of borrowing against an $11,080.00 expected annual advantage. Interest is excluded here so the effect of the completion risk alone is visible.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'In the outcome where Simone does not finish, what is her annual position relative to the $39,800 she would have earned without the programme?',
            given: { without2: 39800, leftPay2: 34900 }, expr: 'leftPay2 - without2', format: 'usd', answer: '-$4,900.00',
            reasoning: 'The non-completing outcome pays $34,900 against the $39,800 alternative, so the advantage is negative — and the $42,600.00 of debt is still owed.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'In the completing outcome, what is the annual advantage over the same alternative?',
            given: { gradPay2: 58400, without3: 39800 }, expr: 'gradPay2 - without3', format: 'usd', answer: '$18,600.00',
            reasoning: '$58,400 against $39,800. The two outcomes are $23,500 apart in annual terms, which is the size of what the 68% is deciding.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Across the first 5 years after the programme, how much larger is the completing outcome than the non-completing one?',
            given: { horizon: 5 }, expr: '(#t2-p3 - #t2-p2) * horizon', format: 'usd', answer: '$117,500.00',
            reasoning: 'The two outcomes differ by $23,500 a year — $18,600.00 against -$4,900.00 — and that gap is carried for each of the 5 years.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'In the outcome where the programme is not finished, what has happened to the $42,600 borrowed?',
            choices: [
              'It is cancelled, because the qualification was not awarded',
              'It is still owed in full, with no qualification to show for it',
              'It is reduced in proportion to the years completed',
            ],
            given: {},
            answer: 'It is still owed in full, with no qualification to show for it',
            reasoning: 'The scenario states the full $42,600 is borrowed across the three years and says nothing about cancellation or proportional reduction; the debt is a separate obligation from the qualification, which is precisely why the non-completing outcome is worse than simply not enrolling.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The expected annual advantage is positive at $11,080.00, but one of the two outcomes leaves Simone worse off than not enrolling. Explain how both of those can be true, and say what the expected figure is and is not useful for.',
            acceptableAnswerCriteria: [
              'Explains that the expectation is a weighted blend of $18,600.00 and -$4,900.00, so a positive average is compatible with a genuinely bad outcome occurring 32% of the time.',
              'States that the expectation is useful for comparing options across many repetitions but not for describing what happens to one person once.',
              'Notes that the downside outcome carries the full $42,600.00 of debt alongside the lower salary.',
            ],
            evidenceRequirements: [
              'Cites both branch figures — the $18,600.00 advantage and the -$4,900.00 shortfall — and the weights that combine them.',
            ],
            dimensions: ['communication-of-uncertainty', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response distinguishes an average outcome from an achievable outcome.',
              'The response mentions that the debt survives the bad branch, not only that the salary is lower.',
              'A response arguing the programme is still worth it is acceptable if it acknowledges the size and probability of the downside.',
            ],
            commonMisconception: 'Treating an expected value as the outcome an individual should plan to receive.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Name one thing Simone could find out before enrolling that would change the 68% figure for her specifically, and say how a higher or lower figure would move the expected advantage.',
            acceptableAnswerCriteria: [
              'Names something concrete and knowable in advance, such as the completion rate for part-time students, or for students entering with her preparation, or the programme’s support for people who fall behind.',
              'States the direction correctly: a higher completion figure raises the expected advantage above $11,080.00 by shifting weight from the -$4,900.00 branch to the $18,600.00 one.',
            ],
            evidenceRequirements: [
              'Refers to the 68% and 32% weights and to at least one of the two branch outcomes when describing the effect.',
            ],
            dimensions: ['evidence-use', 'assumption-identification'],
            lookFors: [
              'The suggestion is something a prospective student could actually ask for, not a general wish for more information.',
              'The response reasons about weight moving between branches rather than about the salaries changing.',
            ],
            commonMisconception: 'Assuming a published cohort completion rate applies unchanged to every individual in it.',
          },
        ],
      },
    ],
    remediation: 'If the expected salary comes out at $46,650.00, the two outcomes are being averaged evenly instead of weighted 68% and 32%. Write the two products separately — 0.68 x $58,400 and 0.32 x $34,900 — confirm the weights add to 1, and then add. A useful check: the expectation must land between $34,900 and $58,400, and closer to $58,400 because that outcome carries the larger weight.',
    extension: 'Find the completion rate at which the expected annual advantage falls to zero, and say what that rate implies about how sensitive this decision is to the completion figure.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l06',
    grade: 11, unit: 1, day: 6,
    actor: 'Idris Vanterpool, a fictional new hire negotiating a starting salary',
    objective: 'Compute what a one-time fictional negotiated increase is worth across fifteen years once it compounds with annual raises, and express it as a share of total career earnings over that period.',
    scenario: 'Idris Vanterpool is a fictional new hire at an invented engineering firm. The offer, the negotiated increase, and the raise pattern below are simulated and describe no real employer.',
    materials: ['calculator', 'the fictional offer and raise figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The opening offer is $52,000. After negotiating, Idris starts at $55,400 instead. Under either starting salary, the firm’s pattern gives a 3% raise at the start of each following year, and Idris stays 15 years. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much did the negotiation add to the starting salary?',
            given: { negotiated: 55400, offered: 52000 }, expr: 'negotiated - offered', format: 'usd', answer: '$3,400.00',
            reasoning: 'The difference between the two starting salaries, which is the only thing the negotiation changed directly.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'By year 15, which is 14 raises after the start, how large is the annual gap between the two salary paths?',
            given: { rate: 0.03 }, expr: 'round(#t1-p1 * pow(1 + rate, 14), 2)', format: 'usd', answer: '$5,142.81',
            reasoning: 'Because the 3% raise is applied to whichever salary Idris is on, the original $3,400.00 gap compounds at the same rate as the salary itself for 14 years.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total of the 15 annual gaps across the whole period? Use the running-total formula for a stream that grows 3% a year: the first year’s amount times ((1 + 0.03) raised to the 15th, less 1) divided by 0.03.',
            given: { rate2: 0.03 }, expr: 'round(#t1-p1 * (pow(1 + rate2, 15) - 1) / rate2, 2)', format: 'usd', answer: '$63,236.31',
            reasoning: 'Adding the 15 compounding gaps at once. The formula is the closed form of writing out $3,400.00, then $3,502.00, and so on for 15 years and totalling the column.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put that total against the size of the career it sits inside.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Using the same running-total formula, what would Idris earn across the 15 years on the original $52,000 offer?',
            given: { offered2: 52000, rate3: 0.03 }, expr: 'round(offered2 * (pow(1 + rate3, 15) - 1) / rate3, 2)', format: 'usd', answer: '$967,143.52',
            reasoning: 'The same closed form applied to the whole salary rather than to the gap: $52,000 growing at 3% for 15 years.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'The fifteen-year value of the negotiation is what percentage of that total? Give two decimal places.',
            given: {}, expr: 'round(#t1-p3 / #t2-p1 * 100, 2)', format: 'percent2', answer: '6.54%',
            reasoning: '$63,236.31 against $967,143.52. The starting salary was raised by about 6.54%, and because every later raise is a percentage of it, the share holds across the whole period.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more than the original $3,400 increase is the fifteen-year total worth?',
            given: {}, expr: '#t1-p3 - #t1-p1', format: 'usd', answer: '$59,836.31',
            reasoning: '$63,236.31 against the $3,400.00 that was actually negotiated — the rest is produced by carrying that increase through 15 years of compounding raises.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'The negotiation happened once, at the start. Why is its fifteen-year value so much larger than $3,400?',
            choices: [
              'Because the firm repeats the negotiated increase every year as a separate bonus',
              'Because the increase is carried in every later year and each 3% raise is calculated on the higher salary',
              'Because inflation increases the value of the original $3,400 over time',
            ],
            given: {},
            answer: 'Because the increase is carried in every later year and each 3% raise is calculated on the higher salary',
            reasoning: 'The scenario states the 3% raise is applied to whichever salary Idris is on, so the higher base is present in all 15 years and grows with the same percentage; nothing in the scenario adds a repeated bonus, and inflation is not mentioned anywhere in it.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A colleague tells Idris that negotiating "was worth about three and a half thousand". Explain what that description gets wrong, and say what has to be true about the job for the $63,236.31 figure to be the right one.',
            acceptableAnswerCriteria: [
              'Explains that $3,400.00 is the one-year effect and that the increase persists in the base for all 15 years, compounding with the annual raise.',
              'States the conditions the larger figure depends on: staying 15 years, the 3% raise pattern continuing, and later raises being percentages of the base rather than flat amounts.',
              'Recognises that if raises were flat dollar amounts instead of percentages, the negotiated gap would stay near $3,400 rather than reaching $5,142.81.',
            ],
            evidenceRequirements: [
              'Cites the year-15 gap of $5,142.81 or the $63,236.31 total when contrasting the two ways of valuing the negotiation.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the base effect — the raise is a percentage of a number the negotiation moved.',
              'The response names the tenure assumption explicitly rather than accepting 15 years without comment.',
              'A response noting that leaving after three years makes the colleague nearer to right is showing exactly the reasoning wanted.',
            ],
            commonMisconception: 'Valuing a change to a recurring amount as though it happened only once.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Suppose the firm switched to flat raises of $1,600 a year for everyone instead of 3%. Say what happens to the value of the negotiation, and explain why the two raise designs treat it differently.',
            acceptableAnswerCriteria: [
              'States that under flat raises the gap stays at $3,400 every year, so the fifteen-year value falls to $51,000 rather than $63,236.31.',
              'Explains that a percentage raise multiplies the base the negotiation changed, while a flat raise adds the same amount regardless of the base.',
            ],
            evidenceRequirements: [
              'Contrasts the compounding year-15 gap of $5,142.81 with the constant gap a flat raise would preserve.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response applies the same fifteen-year frame to the new raise design rather than answering only about one year.',
              'The response explains the mechanism rather than asserting that flat raises are worth less.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the fifteen-year value of the negotiation comes out as $51,000, the gap is being held flat at $3,400 for 15 years and the compounding is being dropped. Write the first three gaps by hand — $3,400.00, then 3% more, then 3% more again — to see the column is not constant, and then use the running-total formula on the whole stream.',
    extension: 'Find what the opening offer would have had to be, with no negotiation, for the fifteen-year total to match the negotiated path, and say why that figure is not $52,000 plus $63,236.31.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l07',
    grade: 11, unit: 1, day: 7,
    actor: 'Wren Kaczmarek-Oyelaran, a fictional student checking a payback worksheet',
    objective: 'Locate the first wrong step in a fictional payback worksheet, recompute the payback period with forgone earnings included, and show what applying tax to the salary advantage does to the result.',
    scenario: 'Wren Kaczmarek-Oyelaran is a fictional student who has been handed the simulated worksheet below. The programme, the figures, and the worksheet’s conclusion are invented for this exercise.',
    materials: ['calculator', 'the fictional worksheet reproduced in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The worksheet reads: "Programme: 3 years at $15,900 a year. Total cost $47,700. Salary advantage after finishing: $13,250 a year. Payback: 3.6 years. Conclusion: the programme pays for itself before the fourth year of work." During the 3 years of study the student would otherwise have been earning $33,600 a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'Confirm the worksheet’s own cost line: what is 3 years of tuition at $15,900 a year?',
            given: { annual: 15900 }, expr: 'annual * 3', format: 'usd', answer: '$47,700.00',
            reasoning: 'The worksheet’s tuition arithmetic is correct on its own terms; the error is not here, which is worth establishing before looking further.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'years',
            text: 'Confirm the worksheet’s payback line: $47,700 divided by the $13,250 advantage, to one decimal place.',
            given: { advantage: 13250 }, expr: 'round(#t1-p1 / advantage, 1)', format: 'years1', answer: '3.6',
            reasoning: 'The division is also correct. The worksheet fails not by miscalculating but by dividing the wrong numerator, which is the harder error to see.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Now rebuild the cost line properly. The 3 study years are years in which $33,600 of earnings does not arrive.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What are the total earnings given up across the 3 study years?',
            given: { forgone: 33600 }, expr: 'forgone * 3', format: 'usd', answer: '$100,800.00',
            reasoning: 'Three years at $33,600 that the student does not receive. Held flat here so the correction to the worksheet is visible on its own.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the true cost of the programme, counting tuition and forgone earnings together?',
            given: {}, expr: '#t1-p1 + #t2-p1', format: 'usd', answer: '$148,500.00',
            reasoning: 'The worksheet’s $47,700.00 plus the $100,800.00 it never counted.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'years',
            text: 'What is the corrected payback period against the same $13,250 advantage? Give one decimal place.',
            given: { advantage2: 13250 }, expr: 'round(#t2-p2 / advantage2, 1)', format: 'years1', answer: '11.2',
            reasoning: '$148,500.00 against the same annual advantage the worksheet used — the conclusion moves from before the fourth year to past the eleventh.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One further correction. The tuition was paid out of money that had already been taxed, while the salary advantage in the worksheet is a gross figure. Apply a simplified flat 22% tax to the advantage. This flat rate is a deliberate simplification of a real tax calculation, invented for this lesson.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the salary advantage after the simplified 22% tax?',
            given: { advantage3: 13250, taxRate: 0.22 }, expr: 'round(advantage3 * (1 - taxRate), 2)', format: 'usd', answer: '$10,335.00',
            reasoning: 'Taking 22% off the $13,250 gross advantage leaves what actually arrives to pay down the cost.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'years',
            text: 'What is the payback period using the true cost and the after-tax advantage? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t3-p1, 1)', format: 'years1', answer: '14.4',
            reasoning: '$148,500.00 against the $10,335.00 that actually arrives each year, rather than against the gross figure.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'years',
            text: 'How many years separate the worksheet’s answer from the fully corrected one? Give one decimal place.',
            given: {}, expr: '#t3-p2 - #t1-p2', format: 'years1', answer: '10.8',
            reasoning: '14.4 years against the 3.6 the worksheet reported — the two errors together move the answer by more than a decade.',
          },
          {
            ref: 't3-p4', kind: 'choice',
            text: 'Which line of the worksheet is the first one that is actually wrong?',
            choices: [
              'The tuition line, "3 years at $15,900 a year"',
              'The total cost line, "$47,700"',
              'The division that produced "3.6 years"',
            ],
            given: {},
            answer: 'The total cost line, "$47,700"',
            reasoning: 'The tuition line is right and the division is arithmetically right; the first defective step is labelling $47,700.00 as the total cost when it is only the tuition, which is what makes every line below it wrong.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Every arithmetic step in the original worksheet is correct, and its conclusion is still wrong by more than ten years. Explain how that happens, and give one check that would have caught it before the conclusion was written.',
            acceptableAnswerCriteria: [
              'Locates the defect in the definition of "total cost" rather than in any calculation, and names the $100,800.00 of forgone earnings as what the label excluded.',
              'Explains that correct operations on an incomplete input produce a confidently wrong result, so checking the arithmetic would never have found this.',
              'Gives a concrete check, such as asking what the student’s position would be in each of the three study years, or comparing against simply staying in work.',
            ],
            evidenceRequirements: [
              'Cites the worksheet’s 3.6-year conclusion against the corrected 14.4 years, and names the omitted figure.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response distinguishes an arithmetic error from a modelling error.',
              'The proposed check is one that interrogates the inputs, not one that re-does the division.',
              'The response does not claim the worksheet miscalculated; it did not.',
            ],
            commonMisconception: 'Believing that verifying every calculation is the same as verifying a conclusion.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The tax correction moved the answer from 11.2 years to 14.4 years. Explain why applying tax to the advantage but not to the tuition is the right way round, and name one figure in the corrected model you would still want to check.',
            acceptableAnswerCriteria: [
              'Explains that the advantage is income and is taxed before it can be spent, while the tuition was paid from money already taxed, so comparing a gross inflow against a net outflow overstates the repayment.',
              'Names a figure worth checking with a reason, such as whether the $13,250 advantage holds for the whole payback period, or whether the $33,600 forgone wage would have risen.',
            ],
            evidenceRequirements: [
              'Refers to the after-tax advantage of $10,335.00 and to the gross figure it came from.',
            ],
            dimensions: ['criteria-application', 'assumption-identification'],
            lookFors: [
              'The response reasons about matching gross to gross and net to net.',
              'The figure chosen for further checking comes with a reason it might be wrong.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the corrected payback still comes out near 3.6 years, the forgone earnings are being left out of the numerator. The question the payback period answers is how long the advantage takes to repay everything the choice cost, and three years without a wage cost $100,800.00. Rebuild the numerator as a two-line sum before dividing anything.',
    extension: 'Recompute the corrected payback if the student worked part time during the programme and earned $11,200 a year, and say which of the three corrections in this lesson that change partly undoes.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l08',
    grade: 11, unit: 1, day: 8,
    actor: 'Hafsa Lindqvist-Bello, a fictional school-leaver choosing between an apprenticeship and a full-time programme',
    objective: 'Transfer the opportunity-cost method to a case where one pathway pays during training, compute both ten-year positions, and find how long the crossover actually takes.',
    scenario: 'Hafsa Lindqvist-Bello is a fictional school-leaver with two invented options. Neither the apprenticeship nor the programme below is real, and the wages attached to them are simulated.',
    materials: ['calculator', 'the two fictional pathway summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional apprenticeship pays $27,400 a year for 3 training years and $52,300 a year for the remaining 7 years, with no tuition. The fictional full-time programme charges $16,800 a year for 3 years with no earnings during them, and pays $61,700 a year for the remaining 7 years. Use a 10-year horizon and hold each wage flat.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the apprenticeship earn across the whole 10 years?',
            given: { training: 27400, qualified: 52300, after: 7 }, expr: 'training * 3 + qualified * after', format: 'usd', answer: '$448,300.00',
            reasoning: 'Three training years at $27,400 plus 7 qualified years at $52,300. Unlike the other pathway, none of its years are unpaid.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the programme’s net position across the whole 10 years, after its tuition?',
            given: { gradPay: 61700, after2: 7, tuition: 16800 }, expr: 'gradPay * after2 - tuition * 3', format: 'usd', answer: '$381,500.00',
            reasoning: 'Seven years at $61,700 less three years of $16,800 tuition. The first three years contribute nothing but cost.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'At the end of 10 years, how far ahead is the apprenticeship?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$66,800.00',
            reasoning: '$448,300.00 against $381,500.00 — the higher-paying qualification has not yet made up the three years it spent paying instead of earning.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Find where the two paths actually cross. Work these without help.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'At the end of year 3, how far apart are the two pathways?',
            given: { training2: 27400, tuition2: 16800 }, expr: 'training2 * 3 + tuition2 * 3', format: 'usd', answer: '$132,600.00',
            reasoning: 'The apprentice has earned $82,200 while the student has paid out $50,400, so the gap at the end of the training period is the sum of the two.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'From year 4 onwards, how much more does the programme pathway earn each year?',
            given: { gradPay2: 61700, qualified2: 52300 }, expr: 'gradPay2 - qualified2', format: 'usd', answer: '$9,400.00',
            reasoning: '$61,700 against $52,300 once both are working — this is the only force closing the gap.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'years',
            text: 'How many further years after year 3 does it take for the programme to close the gap? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t2-p2, 1)', format: 'years1', answer: '14.1',
            reasoning: '$132,600.00 of accumulated gap divided by the $9,400.00 a year that closes it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'years',
            text: 'Counting from the start, in which year does the programme pathway overtake the apprenticeship? Give one decimal place.',
            given: { trainingYears: 3 }, expr: '#t2-p3 + trainingYears', format: 'years1', answer: '17.1',
            reasoning: 'The 14.1 years of catching up begin only after the 3 training years have already passed.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Over a 10-year horizon, which pathway is ahead, and over a 25-year horizon?',
            choices: [
              'The apprenticeship at 10 years and the apprenticeship at 25 years',
              'The apprenticeship at 10 years and the programme at 25 years',
              'The programme at both horizons',
            ],
            given: { longHorizon: 25 },
            decision: { left: '#t2-p4', cmp: '<', right: 'longHorizon', ifTrue: 'The apprenticeship at 10 years and the programme at 25 years', ifFalse: 'The apprenticeship at 10 years and the apprenticeship at 25 years' },
            answer: 'The apprenticeship at 10 years and the programme at 25 years',
            reasoning: 'The crossover falls at 17.1 years, which is after the 10-year horizon and before the 25-year one, so the two horizons genuinely disagree.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'In an earlier lesson the pathway that paid throughout also led at the shorter horizon. Say what is the same about the mechanism here, and name the one feature of this case that the earlier method had to be adjusted for.',
            acceptableAnswerCriteria: [
              'Identifies the shared mechanism: a pathway that pays during training accumulates a lead that the higher later wage can only close at the rate of the annual difference.',
              'Names the adjustment: here the training years earn $27,400 rather than nothing, so the gap at year 3 is the apprentice’s earnings plus the student’s tuition rather than tuition alone.',
              'States the limit of the transfer, such as the conclusion depending on the crossover at 17.1 years sitting inside a working life.',
            ],
            evidenceRequirements: [
              'Cites the $132,600.00 year-3 gap and the $9,400.00 annual closing rate as the two quantities the crossover depends on.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response describes the method, not just the answer, and says where it needed changing.',
              'The response treats the paid training years as the distinguishing feature rather than the wage levels.',
              'The response states a limit on the transfer rather than presenting the method as universal.',
            ],
            commonMisconception: 'Assuming an unpaid training period and a paid one differ only in the size of the cost.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The crossover falls at 17.1 years. Name two things about Hafsa’s situation that would make that either decisive or almost irrelevant, and say which figure each one would move.',
            acceptableAnswerCriteria: [
              'Names a factor that makes the crossover decisive, such as intending a long career in the field, and ties it to the horizon being compared rather than to the wages.',
              'Names a factor that makes it nearly irrelevant, such as expecting to change fields within a decade, or the $9,400.00 annual advantage not holding for seventeen years.',
            ],
            evidenceRequirements: [
              'Refers to the 17.1-year crossover and to at least one computed figure that the named factor would move.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'Each factor is tied to a specific figure rather than offered as a general consideration.',
              'The response distinguishes factors that move the crossover from factors that change which horizon matters.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the crossover comes out at 14.1 years, the 3 training years have been left out of the count. The catching-up only starts once both pathways are working, so the answer is 3 years of gap-building plus 14.1 years of closing it. Draw a timeline with year 3 marked and start the closing count there.',
    extension: 'Recompute the crossover if the apprenticeship’s qualified wage rises to $55,000 while the programme’s stays at $61,700, and say what that does to the size of the decision.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l09',
    grade: 11, unit: 1, day: 9,
    actor: 'Ezekiel Montalvo-Achebe, a fictional adviser ranking two fields at two percentiles',
    objective: 'Rank two fictional fields on a twelve-year net position at the median and again at the 25th percentile, and identify the conditions under which the ranking reverses.',
    scenario: 'Ezekiel Montalvo-Achebe is a fictional adviser comparing two invented fields. All wages, percentiles, and pathway costs below are simulated figures for this exercise.',
    materials: ['calculator', 'the fictional field comparison in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Fictional Field A pays a median of $54,200 and a 25th percentile of $43,100, and its pathway costs $38,400 in total. Fictional Field B pays a median of $49,800 and a 25th percentile of $45,600, and its pathway costs $21,900 in total. Compare a 12-year net position with wages held flat.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Field A’s twelve-year net position at its median wage?',
            given: { medA: 54200, costA: 38400 }, expr: 'medA * 12 - costA', format: 'usd', answer: '$612,000.00',
            reasoning: 'Twelve years at the $54,200 median less the $38,400 pathway cost, which is paid once.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Field B’s twelve-year net position at its median wage?',
            given: { medB: 49800, costB: 21900 }, expr: 'medB * 12 - costB', format: 'usd', answer: '$575,700.00',
            reasoning: 'The same calculation for Field B: twelve years at $49,800 less its cheaper $21,900 pathway.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'At the median, how far ahead is Field A?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$36,300.00',
            reasoning: '$612,000.00 against $575,700.00 — Field A’s higher wage more than covers its more expensive pathway at this percentile.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now repeat the whole comparison at the 25th percentile of each field, with everything else unchanged.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Field A’s twelve-year net position at its 25th-percentile wage?',
            given: { lowA: 43100, costA2: 38400 }, expr: 'lowA * 12 - costA2', format: 'usd', answer: '$478,800.00',
            reasoning: 'Twelve years at $43,100 less the same $38,400 pathway cost. The cost does not fall when the wage does.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Field B’s twelve-year net position at its 25th-percentile wage?',
            given: { lowB: 45600, costB2: 21900 }, expr: 'lowB * 12 - costB2', format: 'usd', answer: '$525,300.00',
            reasoning: 'Twelve years at $45,600 less $21,900. Field B’s narrower spread means its lower percentile is close to its median.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'At the 25th percentile, how far ahead is Field B?',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'usd', answer: '$46,500.00',
            reasoning: '$525,300.00 against $478,800.00 — the ranking from the median comparison has reversed.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How large is the swing between the two comparisons, counting Field A’s lead at the median and Field B’s lead at the 25th percentile together?',
            given: {}, expr: '#t1-p3 + #t2-p3', format: 'usd', answer: '$82,800.00',
            reasoning: '$36,300.00 one way and $46,500.00 the other. The choice of percentile moves the comparison by more than either lead on its own.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which field is the safer choice for someone who cannot absorb a poor outcome?',
            choices: ['Field A, which leads at the median', 'Field B, which leads at the 25th percentile', 'Neither is safer; they are equivalent'],
            given: {},
            decision: { left: '#t2-p2', cmp: '>', right: '#t2-p1', ifTrue: 'Field B, which leads at the 25th percentile', ifFalse: 'Field A, which leads at the median' },
            answer: 'Field B, which leads at the 25th percentile',
            reasoning: 'Safety here means the worse outcomes are better, and at the 25th percentile Field B is $46,500.00 ahead — its narrower spread and cheaper pathway both protect the downside.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The two comparisons disagree. Explain what causes the reversal, and say what a person would need to know about themselves — not about the fields — to decide which comparison to act on.',
            acceptableAnswerCriteria: [
              'Explains that Field A has the wider spread, so its 25th percentile falls $11,100 below its median while Field B’s falls only $4,200, and its higher fixed pathway cost is unchanged by the lower wage.',
              'Identifies that the deciding personal fact is capacity to absorb a poor outcome — whether a result near the 25th percentile would be survivable or ruinous.',
              'Avoids declaring one field better outright, and instead ties the answer to which comparison applies.',
            ],
            evidenceRequirements: [
              'Cites Field A’s $36,300.00 median lead and Field B’s $46,500.00 lead at the 25th percentile.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response names both causes of the reversal — the wider spread and the higher fixed cost.',
              'The personal factor named is about downside capacity, not about preference or interest alone.',
              'The response does not resolve the disagreement by averaging the two comparisons.',
            ],
            commonMisconception: 'Assuming the field that leads on typical pay leads on every outcome.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Field A’s pathway costs $16,500 more than Field B’s. Say how much of the reversal that cost difference is responsible for, and what would happen to the ranking if the two pathways cost the same.',
            acceptableAnswerCriteria: [
              'Identifies that $16,500 of the $46,500.00 gap at the 25th percentile comes from the cost difference and the rest from the $2,500 annual wage gap over 12 years.',
              'States that equalising the pathway costs would narrow Field B’s lead at the 25th percentile to $30,000 but would not reverse it, because Field B still pays more at that percentile.',
            ],
            evidenceRequirements: [
              'Separates the one-off cost difference from the twelve-year wage difference when accounting for the gap.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application'],
            lookFors: [
              'The response decomposes the gap into its two sources rather than attributing it to one.',
              'The response checks whether the ranking would actually flip rather than assuming it would.',
            ],
          },
        ],
      },
    ],
    remediation: 'If both comparisons rank the fields the same way, the pathway cost is probably being scaled with the wage. The cost is a single figure paid once — $38,400 for Field A and $21,900 for Field B — and it stays the same whether the wage lands at the median or the 25th percentile. Rebuild each column as twelve identical wage rows and one cost row, and check that only the wage rows changed between the two comparisons.',
    extension: 'Find the 25th-percentile wage Field A would need for the ranking to hold at both percentiles, and say how far that is from the $43,100 it actually pays.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u01-l10',
    grade: 11, unit: 1, day: 10,
    actor: 'Anouk Rasmussen-Diallo, a fictional applicant building a defensible pathway model',
    objective: 'Build a complete fictional pathway model that carries borrowing cost, forgone earnings, and a stated salary advantage through to a payback period, then re-run it under a weaker assumption and defend the recommendation.',
    scenario: 'Anouk Rasmussen-Diallo is a fictional applicant to an invented two-year programme. Every figure below — tuition, the interest rule, the wages — is simulated for this performance task and describes no real lender or institution.',
    materials: ['calculator', 'the fictional programme and loan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional programme runs 2 years at $21,300 a year, entirely borrowed. The invented loan rule is classroom simple interest: 6.5% a year charged on the full borrowed amount for each of the 2 study years, with nothing repaid until study ends. This is a simplified teaching model and not how a real amortising student loan accrues.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total amount borrowed across the 2 years?',
            given: { tuition: 21300 }, expr: 'tuition * 2', format: 'usd', answer: '$42,600.00',
            reasoning: 'Two years of $21,300 tuition, all financed.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Under the stated simple-interest rule, how much interest accrues across the 2 study years?',
            given: { rate: 0.065 }, expr: 'round(#t1-p1 * rate * 2, 2)', format: 'usd', answer: '$5,538.00',
            reasoning: 'Simple interest charges the rate on the principal without compounding: $42,600.00 at 6.5% for each of 2 years. A real loan would usually compound and would not apply the full balance from day one.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the balance owed when repayment begins?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$48,138.00',
            reasoning: 'Principal plus the accrued interest: $42,600.00 plus $5,538.00.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'During the 2 study years Anouk would otherwise earn $30,200 a year. After the programme she expects $57,900 against the $33,500 she would earn without it. Build the full model.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What earnings does Anouk give up across the 2 study years?',
            given: { forgone: 30200 }, expr: 'forgone * 2', format: 'usd', answer: '$60,400.00',
            reasoning: 'Two years at $30,200 that never arrive, held flat here so the model has one fewer assumption in it.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total economic cost of the pathway, counting the balance owed and the earnings given up?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$108,538.00',
            reasoning: 'The $48,138.00 owed plus the $60,400.00 never earned. Both are consequences of the same two years.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the annual salary advantage the programme is expected to produce?',
            given: { withProgramme: 57900, without: 33500 }, expr: 'withProgramme - without', format: 'usd', answer: '$24,400.00',
            reasoning: '$57,900 against the $33,500 alternative — the advantage is measured against what she would otherwise have earned, not against zero.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'years',
            text: 'How long does the pathway take to pay back at that advantage? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t2-p3, 1)', format: 'years1', answer: '4.4',
            reasoning: '$108,538.00 of total cost against $24,400.00 a year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Now stress the model. Suppose the salary advantage turns out to be only $18,300 a year.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'years',
            text: 'What is the payback period under the weaker advantage? Give one decimal place.',
            given: { weaker: 18300 }, expr: 'round(#t2-p2 / weaker, 1)', format: 'years1', answer: '5.9',
            reasoning: 'The same $108,538.00 cost against a smaller annual advantage.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'years',
            text: 'How much longer is the payback under the weaker assumption? Give one decimal place.',
            given: {}, expr: '#t3-p1 - #t2-p4', format: 'years1', answer: '1.5',
            reasoning: '5.9 years against 4.4 — a quarter cut from the advantage adds about a year and a half to the payback.',
          },
          {
            ref: 't3-p3', kind: 'choice',
            text: 'A reviewer asks which single input the recommendation is most exposed to. Which is the defensible answer?',
            choices: [
              'The 6.5% interest rate, because it is the only rate in the model',
              'The $24,400 salary advantage, because it is the only input the payback is divided by',
              'The $21,300 tuition, because it is the largest single figure',
            ],
            given: {},
            answer: 'The $24,400 salary advantage, because it is the only input the payback is divided by',
            reasoning: 'Cutting the advantage by a quarter moved the payback by 1.5 years, while the whole of the accrued interest is $5,538.00, about 5% of the total cost; the divisor is where the model is most exposed.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your recommendation. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend for or against the programme for Anouk. State the payback period you are relying on, the assumptions the recommendation rests on, and the single piece of evidence that would most change your mind.',
            acceptableAnswerCriteria: [
              'States a clear recommendation and names the payback figure behind it, either the 4.4 years or the 5.9 years, rather than reporting both without choosing.',
              'Names at least two load-bearing assumptions from the model, such as the salary advantage holding, the wage during study staying at $30,200, or the simple-interest rule understating a real loan.',
              'Identifies a specific piece of evidence that would change the recommendation, such as the actual salaries of recent leavers from a comparable programme.',
            ],
            evidenceRequirements: [
              'Cites the total economic cost of $108,538.00 and at least one of the two payback periods.',
              'Points to the sensitivity result — that a drop to $18,300 adds 1.5 years — when describing the risk.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The recommendation is decided rather than hedged, and the figure supporting it is named.',
              'The assumptions listed are ones that actually appear in the model, not general cautions.',
              'Either recommendation is acceptable; what is scored is whether the reasoning carries the cost, the advantage, and the sensitivity together.',
            ],
            commonMisconception: 'Presenting a model’s output as a recommendation without stating what it assumed.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The loan in this task uses a simplified simple-interest rule. Explain what a real amortising loan would do differently, and say whether that would make the payback period longer or shorter than the 4.4 years you computed.',
            acceptableAnswerCriteria: [
              'Explains that a real loan generally compounds and that repayments are split between interest and principal, so the total paid exceeds the $48,138.00 this simplified rule produces.',
              'Concludes that the payback would be longer than 4.4 years, and ties that to the cost rising while the $24,400.00 advantage stays the same.',
            ],
            evidenceRequirements: [
              'Refers to the $5,538.00 of simple interest as the figure the simplification produced.',
            ],
            dimensions: ['assumption-identification', 'transfer'],
            lookFors: [
              'The response names compounding or the interest-first application of payments, not merely that real loans are "more complicated".',
              'The direction of the effect on the payback period is stated and justified.',
            ],
            commonMisconception: 'Treating a simplified classroom interest rule as equivalent to how a real loan accrues.',
          },
        ],
      },
    ],
    remediation: 'If the total economic cost comes out at $60,400 or at $48,138, only one of the two halves is in the model. The two years cost Anouk both the money she borrowed, which has grown to $48,138.00, and the wages she did not earn, which come to $60,400.00. Write the cost as a two-line sum before dividing, and label each line so it is clear neither is a duplicate of the other.',
    extension: 'Recompute the payback period if Anouk repays $9,000 of the balance during the second study year, and say which line of the model that changes and which it leaves alone.',
  },
]
