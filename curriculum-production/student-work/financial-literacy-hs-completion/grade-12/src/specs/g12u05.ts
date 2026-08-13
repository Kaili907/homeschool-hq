import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 5 — PF5 Financial Investing: Long-Horizon Investing as an
 * Adult.
 *
 * Two things govern the authoring of this unit.
 *
 * First, every rate of return in it is a stated assumption for an
 * illustration, never a forecast. The scenarios say so in the learner-facing
 * text, and the judgment items are built so that a response cannot score well
 * by treating an illustrated figure as a promise. What the arithmetic
 * establishes is the shape of compounding and the certainty of fees, not what
 * any account will do.
 *
 * Second, no lesson tells anyone what to hold. The decisions here are about
 * fictional people, the acceptable-answer criteria admit more than one
 * defensible allocation, and no real fund, firm, product, or ticker is named
 * anywhere.
 */
export const g12u05: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u05-l01',
    grade: 12, unit: 5, day: 1,
    actor: 'a fictional employee reading a simulated retirement plan summary',
    objective: 'Compute the whole employer contribution a fictional tiered plan makes available, find the worker contribution that earns it, and identify where further contributions stop earning more.',
    scenario: 'The simulated plan summary below belongs to a fictional employer. Every rate and figure in it is invented for this exercise, and no real plan, provider, or product is described.',
    materials: ['calculator', 'the fictional plan terms in these directions'],
    domains: ['saving-investing', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional employer contributes 100% of what the worker puts in on the first 3% of pay, and 50% of what the worker puts in on the next 2% of pay. Nothing further is contributed on anything above 5% of pay. The worker is paid $52,800 a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the employer contribute on the first tier, when the worker contributes 3% of pay?',
            given: { salary: 52800, tier1: 0.03 }, expr: 'salary * tier1', format: 'usd', answer: '$1,584.00',
            reasoning: '3% of $52,800, matched at 100%, so the employer puts in the same amount the worker does on this tier.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the employer contribute on the second tier, when the worker contributes the next 2% of pay?',
            given: { salary2: 52800, tier2: 0.02, halfRate: 0.5 }, expr: 'salary2 * tier2 * halfRate', format: 'usd', answer: '$528.00',
            reasoning: 'The worker puts in 2% of $52,800, which is $1,056.00, and the employer adds 50% of that. The second tier is worth half as much per dollar contributed as the first.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the largest employer contribution available in a year?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$2,112.00',
            reasoning: '$1,584.00 from the first tier plus $528.00 from the second. Nothing above this is available at any contribution rate.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what the worker has to put in, and where putting in more stops helping.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What must the worker contribute across the year to reach the full 5% of pay?',
            given: { salary3: 52800, fullTier: 0.05 }, expr: 'salary3 * fullTier', format: 'usd', answer: '$2,640.00',
            reasoning: '5% of $52,800. This is the contribution that unlocks both tiers in full.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'The employer contribution measured against the worker’s own $2,640.00 is what percentage, to two decimal places?',
            given: {}, expr: 'round(#t1-p3 / #t2-p1 * 100, 2)', format: 'percent2', answer: '80.00%',
            reasoning: '$2,112.00 measured against $2,640.00. This is an addition to money contributed in the year, not an annual rate of return on a balance, and the two should not be compared as though they were the same kind of figure.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'A worker raises their contribution from 5% of pay to 8%. Does the employer contribution rise?',
            choices: ['Yes — the employer contributes on everything the worker puts in', 'No — nothing is contributed on pay above the 5% ceiling'],
            answer: 'No — nothing is contributed on pay above the 5% ceiling',
            reasoning: 'The stated plan contributes on the first 3% and the next 2% only, so the employer amount is already at its $2,112.00 maximum at 5%. Contributing 8% is still saving $4,224.00 rather than $2,640.00, but the extra earns nothing further from the employer. This is read from the stated terms.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'A worker who contributes only 3% of pay leaves how much of the employer contribution unclaimed?',
            given: {}, expr: '#t1-p3 - #t1-p1', format: 'usd', answer: '$528.00',
            reasoning: '$2,112.00 available against $1,584.00 earned at 3%. The unclaimed amount is the whole of the second tier.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why the two tiers of this plan are not equally valuable to the fictional worker, and say what a worker would need to be true about the rest of their budget for stopping at 3% to be a reasonable decision rather than an oversight.',
            acceptableAnswerCriteria: [
              'Distinguishes the tiers by what each dollar contributed earns: the first 3% earns a matching dollar, while the next 2% earns fifty cents, so the first tier is worth twice as much per dollar contributed.',
              'Quantifies the cost of stopping at 3%: $528.00 of employer contribution is not made, on a further $1,056.00 the worker would have had to contribute.',
              'Names a condition under which stopping at 3% is defensible — for example that the extra $1,056.00 a year is needed for an obligation the worker cannot defer, so the choice is between the second tier and something more pressing rather than between the second tier and nothing.',
            ],
            evidenceRequirements: [
              'Uses the $2,112.00 maximum and the $528.00 left unclaimed at a 3% contribution.',
            ],
            dimensions: ['reasoning-from-figures', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The response treats the ceiling as the point where the employer contribution stops, not where saving stops being worthwhile.',
              'The response does not describe the 80.00% figure as a return.',
            ],
            commonMisconception: 'Reading a tiered employer contribution as a single rate, so the difference between the first 3% and the next 2% is missed entirely.',
          },
        ],
      },
    ],
    remediation: 'If the maximum employer contribution comes out at $2,640.00, both tiers are being matched at 100%. Read the tiers separately: the first 3% of $52,800 is matched dollar for dollar, giving $1,584.00, and the next 2% is matched at 50%, giving $528.00 on a $1,056.00 contribution.',
    extension: 'Work out what the plan would be worth to a fictional worker paid $34,000 rather than $52,800, and say whether the 5% ceiling is easier or harder to reach on the lower salary.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l02',
    grade: 12, unit: 5, day: 2,
    actor: 'a fictional worker deciding a contribution rate against a monthly budget',
    objective: 'Convert a fictional contribution rate into the amount take-home pay actually falls by, and compare two rates on that basis rather than on the rate itself.',
    scenario: 'The fictional salary, the invented marginal tax rate, and the simulated payroll levy below exist only for this exercise.',
    materials: ['calculator', 'the fictional pay and tax figures in these directions'],
    domains: ['saving-investing', 'taxes', 'budgeting', 'income'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker earns $49,200 a year paid monthly. Contributions are taken before income tax, and the worker’s last dollars fall in a fictional 12% income tax band. The payroll levy of 7.65% is charged on all pay and is not reduced by a contribution.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is monthly gross pay?',
            given: { salary: 49200 }, expr: 'round(salary / 12, 2)', format: 'usd', answer: '$4,100.00',
            reasoning: '$49,200 across the 12 months of a year. Every contribution rate below is applied to this figure.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a 6% contribution take from each month’s pay?',
            given: { rate6: 0.06 }, expr: 'round(#t1-p1 * rate6, 2)', format: 'usd', answer: '$246.00',
            reasoning: '6% of $4,100.00. This is the amount leaving the paycheque, not the amount take-home pay falls by.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What income tax does that contribution save each month at the 12% band?',
            given: { marginal: 0.12 }, expr: 'round(#t1-p2 * marginal, 2)', format: 'usd', answer: '$29.52',
            reasoning: '12% of the $246.00 removed from taxable pay. The payroll levy is charged on all pay, so it is unchanged and does not appear here.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now express both rates in the only unit a budget can use.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'By how much does take-home pay actually fall at a 6% contribution?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$216.48',
            reasoning: '$246.00 contributed less $29.52 of income tax no longer paid. The budget has to find $216.48, not $246.00.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a 10% contribution take from each month’s pay?',
            given: { rate10: 0.10 }, expr: 'round(#t1-p1 * rate10, 2)', format: 'usd', answer: '$410.00',
            reasoning: '10% of the $4,100.00 monthly gross — $164.00 more than the 6% election takes, before any tax effect is considered.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does take-home pay fall at a 10% contribution?',
            given: { marginal2: 0.12 }, expr: 'round(#t2-p2 - #t2-p2 * marginal2, 2)', format: 'usd', answer: '$360.80',
            reasoning: '$410.00 contributed less $49.20 of income tax saved at the 12% band.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does moving from 6% to 10% cost the monthly budget?',
            given: {}, expr: '#t2-p3 - #t2-p1', format: 'usd', answer: '$144.32',
            reasoning: '$360.80 against $216.48. The contribution rises $164.00 but take-home falls only $144.32, because $19.68 of the increase is met by income tax no longer paid.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fictional colleague says raising the rate from 6% to 10% "costs $164 a month". Correct the figure, explain why the correction is not the whole answer, and state what the fictional worker needs to know about their budget before the difference between the two rates can be decided.',
            acceptableAnswerCriteria: [
              'Corrects the figure: take-home pay falls by $144.32, not $164.00, because $19.68 of the extra contribution is met by income tax that is no longer paid.',
              'Explains why the correction is not the whole answer: $144.32 still has to be found every month from a budget that currently spends it, and the contribution is money the worker no longer has available to spend this month even though they still own it.',
              'Names what must be known: whether $144.32 a month exists in the budget without displacing something the worker cannot defer, such as an obligation or a reserve that is not yet built.',
            ],
            evidenceRequirements: [
              'Uses the $144.32 fall in take-home pay and the $164.00 increase in the contribution itself.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The response separates the contribution from the effect on take-home pay.',
              'The response does not recommend a rate for any real person; the question is what the fictional worker would need to know.',
            ],
            commonMisconception: 'Assuming a pre-tax contribution reduces take-home pay by its full amount, which overstates the cost by the tax the contribution saves.',
          },
        ],
      },
    ],
    remediation: 'If the cost of moving from 6% to 10% comes out at $164.00, the tax effect has been left out. Compute the take-home reduction at each rate first — $216.48 at 6% and $360.80 at 10% — and take the difference between those, not between the two contributions.',
    extension: 'Recompute both take-home reductions for a fictional worker whose last dollars fall in a 22% band instead of 12%, and say whether the higher band makes contributing cheaper or dearer in take-home terms.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l03',
    grade: 12, unit: 5, day: 3,
    actor: 'a fictional investor comparing two allocations over a long horizon',
    objective: 'Apply a stated illustrative growth assumption to two fictional allocations across a long horizon, compare the results, and state what the illustration does not establish.',
    scenario: 'The two simulated allocations and the illustrative rates below are invented for this exercise. The rates are assumptions chosen to show how compounding works over a long period; they are not predictions, and no real fund, market, or product is described.',
    materials: ['calculator', 'the fictional allocations and illustrative rates in these directions'],
    domains: ['saving-investing', 'multi-variable-decision', 'budgeting', 'insurance-risk'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional balance of $12,000 is split between a growth category and a stable category. Allocation A puts 80% in growth and 20% in stable; allocation B puts 40% in growth and 60% in stable. For this illustration only, assume the growth category averages 7% a year and the stable category 3% a year, every year for 30 years. Real results vary year to year and are not known in advance; these two rates are chosen to make the arithmetic of compounding visible.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does allocation A place in the growth category?',
            given: { portfolio: 12000, growthA: 0.8 }, expr: 'portfolio * growthA', format: 'usd', answer: '$9,600.00',
            reasoning: '80% of the $12,000 balance. Allocation is applied to the starting balance, and the split decides how much of it compounds at each assumed rate.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does allocation A place in the stable category?',
            given: { portfolio2: 12000, stableA: 0.2 }, expr: 'portfolio2 * stableA', format: 'usd', answer: '$2,400.00',
            reasoning: '20% of the $12,000 balance. The two parts add back to the whole, which is the check that an allocation has been read correctly.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Under the stated illustration, what would allocation A be worth after the 30 years?',
            given: { growthRate: 0.07, years: 30, stableRate: 0.03, years2: 30 },
            expr: 'round(#t1-p1 * pow(1 + growthRate, years) + #t1-p2 * pow(1 + stableRate, years2), 2)',
            format: 'usd', answer: '$78,903.08',
            reasoning: 'Each part compounds at its own assumed rate for 30 years and the two are added. The parts must be compounded separately, because a blended average rate applied to the whole balance would give a different and wrong figure.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for allocation B and compare.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does allocation B place in the growth category?',
            given: { portfolio3: 12000, growthB: 0.4 }, expr: 'portfolio3 * growthB', format: 'usd', answer: '$4,800.00',
            reasoning: '40% of the $12,000 balance — half of what allocation A places in growth, from the same starting amount.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does allocation B place in the stable category?',
            given: { portfolio4: 12000, stableB: 0.6 }, expr: 'portfolio4 * stableB', format: 'usd', answer: '$7,200.00',
            reasoning: '60% of the $12,000 balance. As with allocation A, the two parts add back to the whole, which checks the split has been read correctly.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Under the same illustration, what would allocation B be worth after the 30 years?',
            given: { growthRate2: 0.07, years3: 30, stableRate2: 0.03, years4: 30 },
            expr: 'round(#t2-p1 * pow(1 + growthRate2, years3) + #t2-p2 * pow(1 + stableRate2, years4), 2)',
            format: 'usd', answer: '$54,015.11',
            reasoning: 'The same method with the split reversed. Both allocations start from $12,000 and the difference comes entirely from which category holds more of it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How far apart are the two results under the illustration?',
            given: {}, expr: '#t1-p3 - #t2-p3', format: 'usd', answer: '$24,887.97',
            reasoning: '$78,903.08 against $54,015.11. A 40 percentage point difference in allocation produces a gap larger than twice the original balance, because the difference compounds for 30 years.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'State what this calculation does establish and what it does not. Then explain why a fictional investor who needs the money in 3 years rather than 30 might reasonably prefer allocation B, even though allocation A is far ahead in this illustration.',
            acceptableAnswerCriteria: [
              'States what is established: given the stated rates, a larger share in the higher-growth category compounds to a much larger figure over 30 years, and the gap of $24,887.97 comes from compounding rather than from any extra money being added.',
              'States what is not established: the 7% and 3% figures are assumptions, actual results vary year to year, and nothing here shows that either allocation will produce these amounts or that growth arrives smoothly.',
              'Explains the short-horizon case: over 3 years there is little time for compounding to build the gap, and an investor who must sell at a fixed date is exposed to whatever the growth category happens to be worth then, which the illustration’s steady rate conceals entirely.',
            ],
            evidenceRequirements: [
              'Uses the $78,903.08 and $54,015.11 illustrated results and names the 7% and 3% figures as assumptions.',
            ],
            dimensions: ['communication-of-uncertainty', 'assumption-identification', 'tradeoff-defense'],
            lookFors: [
              'The response does not describe either result as what the investor will have.',
              'The response connects the horizon to the ability to wait out a fall, rather than to a preference for risk in the abstract.',
            ],
            commonMisconception: 'Treating a steady assumed rate as a description of how growth actually arrives, which hides the variability that decides whether a short-horizon investor can wait.',
          },
        ],
      },
    ],
    remediation: 'If allocation A comes out at $91,347.06, the 7% growth rate has been applied to the whole $12,000 and the stable sleeve ignored; if it comes out at $72,931.77, a single blended rate of 6.2% has been applied to the whole balance instead. The two parts grow at different assumed rates and must be compounded separately: $9,600.00 at 7% for 30 years, plus $2,400.00 at 3% for 30 years, added at the end.',
    extension: 'Recompute both allocations over 10 years rather than 30, and say what proportion of the 30-year gap has appeared by then.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l04',
    grade: 12, unit: 5, day: 4,
    actor: 'a fictional investor whose balance has fallen sharply',
    objective: 'Compute what a fictional decline costs and what recovering from it requires, compare holding against selling under a stated recovery assumption, and identify what the comparison assumes.',
    scenario: 'The fictional balance, the simulated decline, and the stated recovery assumption below are invented for this exercise. The assumption that the category regains its earlier level is made only so the two courses of action can be compared; nothing here establishes that any real decline is recovered.',
    materials: ['calculator', 'the fictional balance and decline figures in these directions'],
    domains: ['saving-investing', 'insurance-risk', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional balance of $24,000 falls by 32%. The investor contributes $300 a month and is deciding whether to continue. For the comparison that follows, assume the category later regains exactly the level it held before the fall, and that money moved to cash earns nothing in the meantime. Whether and when such a recovery happens is not something this exercise establishes.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance immediately after the 32% fall?',
            given: { portfolio: 24000, decline: 0.32 }, expr: 'portfolio * (1 - decline)', format: 'usd', answer: '$16,320.00',
            reasoning: '$24,000 reduced by 32%, leaving 68% of the original balance.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage gain on the reduced balance would restore the original $24,000, to two decimal places?',
            given: { portfolio2: 24000 }, expr: 'round((portfolio2 - #t1-p1) / #t1-p1 * 100, 2)', format: 'percent2', answer: '47.06%',
            reasoning: 'The $7,680.00 lost measured against the $16,320.00 that remains. A 32% fall needs a 47.06% gain to undo, because the gain is calculated on a smaller base than the fall was.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare continuing to contribute with moving to cash, under the stated recovery assumption.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is contributed over the next 12 months at $300 a month?',
            given: { monthly: 300, months: 12 }, expr: 'monthly * months', format: 'usd', answer: '$3,600.00',
            reasoning: '$300 in each of 12 months. The same amount is contributed on either course of action; only where it goes differs.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If those contributions are made at the depressed level, what are they worth once the category regains its earlier level?',
            given: { portfolio3: 24000 }, expr: 'round(#t2-p1 * portfolio3 / #t1-p1, 2)', format: 'usd', answer: '$5,294.12',
            reasoning: 'Money put in at the depressed level rises in the same proportion as the balance does, from $16,320.00 back to $24,000. The $3,600.00 contributed therefore recovers to $5,294.12 under the stated assumption.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the account worth in total on that course of action?',
            given: { portfolio4: 24000 }, expr: 'portfolio4 + #t2-p2', format: 'usd', answer: '$29,294.12',
            reasoning: 'The original balance restored to $24,000 plus the $5,294.12 the year’s contributions are worth.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If instead the investor sells at the depressed level and holds everything in cash, what do they have?',
            given: {}, expr: '#t1-p1 + #t2-p1', format: 'usd', answer: '$19,920.00',
            reasoning: 'The $16,320.00 realised plus $3,600.00 contributed to cash, which earns nothing under the stated assumption.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What is the difference between the two courses of action?',
            given: {}, expr: '#t2-p3 - #t2-p4', format: 'usd', answer: '$9,374.12',
            reasoning: '$29,294.12 against $19,920.00, under the stated recovery assumption. The whole gap depends on that assumption holding.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write a rule this fictional investor could set down in advance about what to do in a decline. State what evidence in this lesson supports it, and — importantly — name the assumption the $9,374.12 figure rests on and what your rule does if that assumption does not hold.',
            acceptableAnswerCriteria: [
              'States a rule in advance and in concrete terms — for example continuing scheduled contributions through a decline and not selling on a fall alone, with any change requiring a stated reason unrelated to the fall itself.',
              'Identifies the load-bearing assumption explicitly: the entire $9,374.12 gap depends on the category regaining its earlier level, which the lesson assumes rather than shows.',
              'Says what the rule does if the assumption fails: names a circumstance in which selling is right regardless of the market — money needed at a fixed date, or a change in the investor’s circumstances — so the rule is not simply "always hold".',
              'Uses the 47.06% figure to explain why a decline is harder to undo than it looks, without claiming the gain will occur.',
            ],
            evidenceRequirements: [
              'Uses the $9,374.12 difference and the 47.06% recovery figure, and names the recovery assumption behind both.',
            ],
            dimensions: ['plan-coherence', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The rule is written to be applied before a decline, when the decision is easier to make well.',
              'A response that concludes "markets always recover" is not credited; the lesson assumes a recovery for the sake of comparison and says so.',
              'The response distinguishes selling because of a fall from selling because the money is needed.',
            ],
            commonMisconception: 'Reading a percentage fall and the percentage gain that reverses it as the same size, when a 32% fall requires a 47.06% gain to undo.',
          },
        ],
      },
    ],
    remediation: 'If the recovery figure comes out as 32%, the gain is being calculated on the original $24,000 rather than on what remains. After the fall the base is $16,320.00, and $7,680.00 has to be regained from there — which is 47.06% of the smaller base.',
    extension: 'Work out the gain needed to recover from a 50% fall, and say what pattern the answers to the two cases suggest about how the required gain grows as the fall deepens.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l05',
    grade: 12, unit: 5, day: 5,
    actor: 'a fictional saver comparing two fee structures at two balances',
    objective: 'Compare a percentage fee against a mixed fee at two fictional balances, identify which structure favours which balance, and weigh a certain cost against an uncertain return.',
    scenario: 'The two simulated accounts and their fee structures below are invented for this exercise. No real provider, account, or product is described.',
    materials: ['calculator', 'the fictional fee structures in these directions'],
    domains: ['saving-investing', 'consumer-protection', 'banking', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Fictional account X charges 0.85% of the balance each year and nothing else. Fictional account Y charges 0.15% of the balance each year plus a flat $60 a year. Consider a balance of $18,000 and a balance of $60,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does account X charge on an $18,000 balance in a year?',
            given: { small: 18000, feeX: 0.0085 }, expr: 'small * feeX', format: 'usd', answer: '$153.00',
            reasoning: '0.85% of $18,000. A percentage fee rises with the balance and is charged whatever the account earns.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does account Y charge on the same balance?',
            given: { small2: 18000, feeY: 0.0015, flatY: 60 }, expr: 'small2 * feeY + flatY', format: 'usd', answer: '$87.00',
            reasoning: '0.15% of $18,000, which is $27.00, plus the flat $60. The flat component is the larger part at this balance.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much cheaper is account Y at $18,000?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$66.00',
            reasoning: '$153.00 charged by account X against $87.00 by account Y. At this balance the flat $60 is what keeps account Y from being cheaper still.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test both at the larger balance, and price the difference over a long period.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does account X charge on a $60,000 balance?',
            given: { large: 60000, feeX2: 0.0085 }, expr: 'large * feeX2', format: 'usd', answer: '$510.00',
            reasoning: '0.85% of $60,000. The fee has more than tripled because the balance has.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does account Y charge on a $60,000 balance?',
            given: { large2: 60000, feeY2: 0.0015, flatY2: 60 }, expr: 'large2 * feeY2 + flatY2', format: 'usd', answer: '$150.00',
            reasoning: '0.15% of $60,000, which is $90.00, plus the flat $60. The flat part is now the smaller share.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much cheaper is account Y at $60,000?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$360.00',
            reasoning: '$510.00 against $150.00. The advantage widens as the balance grows, because the difference in percentage rates applies to more money.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Holding the balance at $18,000 and ignoring any growth, what would the fee difference come to over 30 years?',
            given: { horizon: 30 }, expr: '#t1-p3 * horizon', format: 'usd', answer: '$1,980.00',
            reasoning: '$66.00 a year for 30 years. Holding the balance flat is a stated simplification: with a growing balance the difference would be larger, so this is a floor.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Fees and returns are both quoted as percentages, but only one of them is known in advance. Explain what follows from that difference, and describe the balances at which the flat $60 component would make account Y the more expensive of the two.',
            acceptableAnswerCriteria: [
              'States the asymmetry: the 0.85% and 0.15% fees are charged with certainty whatever happens, while any return is not known in advance, so a fee difference is a firmer basis for a decision than an expected return is.',
              'Uses the figures to show the scale: $66.00 a year at $18,000 and $360.00 at $60,000, or at least $1,980.00 across 30 years on a flat balance.',
              'Reasons about the crossover: account Y is dearer for any balance small enough that 0.70% of it is less than $60 — that is, below roughly $8,571, where the two charge the same.',
            ],
            evidenceRequirements: [
              'Uses the $153.00 and $87.00 fees at $18,000 and the $510.00 and $150.00 fees at $60,000.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response treats the fee as the certain quantity in the comparison.',
              'A crossover estimate is credited when the reasoning is right, even if the figure is approximate.',
            ],
            commonMisconception: 'Dismissing a fee difference of well under one percent as too small to matter, without applying it to the balance and the number of years it is charged for.',
          },
        ],
      },
    ],
    remediation: 'If account Y looks more expensive at $60,000, the flat $60 may be being applied as a percentage or added twice. Compute each part separately: 0.15% of $60,000 is $90.00, and the flat charge adds $60, for $150.00 in total against account X’s $510.00.',
    extension: 'Find the balance at which the two accounts charge exactly the same fee, and say which structure is cheaper on either side of it.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l06',
    grade: 12, unit: 5, day: 6,
    actor: 'a fictional saver presented with a high-pressure offer',
    objective: 'Test a fictional investment claim by compounding it out, compare the implied result against a stated alternative, and name the features that identify the offer as one to refuse.',
    scenario: 'The offer described below is a fictional construction for this exercise. No real firm, promoter, product, or scheme is described, and nothing here identifies any actual offer.',
    materials: ['calculator', 'the fictional offer terms in these directions'],
    domains: ['fraud', 'saving-investing', 'consumer-protection', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional promoter offers a "guaranteed 18% a month, compounded", asks for a $250 joining fee, requires a decision within 48 hours, and says the opportunity closes after that. A fictional stable savings account is available paying 3% a year. Test the claim on a $1,000 stake.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'If the 18% monthly claim held for a year, what would a $1,000 stake become?',
            given: { stake: 1000, monthlyClaim: 0.18 }, expr: 'round(stake * pow(1 + monthlyClaim, 12), 2)', format: 'usd', answer: '$7,287.59',
            reasoning: '$1,000 multiplied by 1.18 once for each of the 12 months. Compounding the claim out is the quickest test of whether it can be true.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What annual return does that imply, to two decimal places?',
            given: { stake2: 1000 }, expr: 'round((#t1-p1 - stake2) / stake2 * 100, 2)', format: 'percent2', answer: '628.76%',
            reasoning: 'The $6,287.59 gained measured against the $1,000 staked. A guaranteed return of this size would mean money could be multiplied sevenfold every year with no risk, which no genuine offer can support.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the same stake become in a year in the fictional 3% account?',
            given: { stake3: 1000, stableRate: 0.03 }, expr: 'round(stake3 * (1 + stableRate), 2)', format: 'usd', answer: '$1,030.00',
            reasoning: '3% on $1,000 for one year. The gap between this and the claim is what should prompt scrutiny, not excitement.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Before deciding anything, note two things a saver can actually do: promoters and the products they sell are listed on a public register kept by the financial regulator, and the full terms of any offer can be requested in writing before any money moves. Now size what is actually at stake and identify the warning signs.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How far apart are the two outcomes after a year?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$6,257.59',
            reasoning: '$7,287.59 claimed against $1,030.00 from the stable account. A difference this large on a claim described as guaranteed is itself the finding.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If a fictional saver paid the joining fee and invested $2,500, and the offer turns out to be worthless, what have they lost?',
            given: { invested: 2500, joinFee: 250 }, expr: 'invested + joinFee', format: 'usd', answer: '$2,750.00',
            reasoning: 'The $2,500 invested plus the $250 fee. The joining fee is lost whatever happens, which is one reason such fees are asked for up front.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which feature of this offer is the clearest sign that it should be refused rather than investigated further?',
            choices: ['The joining fee of $250', 'A return described as both very high and guaranteed', 'The 48-hour deadline'],
            answer: 'A return described as both very high and guaranteed',
            reasoning: 'An up-front fee and a deadline are both pressure features and both warrant caution, but a high return described as guaranteed is a claim that cannot be true: return and risk cannot be separated in the way the promise requires. The other two features are consistent with a legitimate if unattractive offer; this one is not.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Set out the checks a fictional saver should run before parting with any money, and explain why a 48-hour deadline makes those checks harder rather than unnecessary. Say what the saver should do about their own information as well as their money.',
            acceptableAnswerCriteria: [
              'Lists checks that could actually be run: verifying that the promoter and the product are registered with the relevant authority, obtaining the terms in writing, and having someone independent read them before any money moves.',
              'Explains the function of the deadline: it exists to prevent exactly those checks, so urgency is a reason to slow down rather than a reason the offer is real.',
              'Uses the compounded figure as the test: a guaranteed 628.76% a year is not an unusually good offer but an impossible one, and identifying that requires only arithmetic.',
              'Addresses information as well as money: the saver should not supply account numbers, identifying documents, or login details to an unverified promoter, because those can be misused whether or not any money is sent.',
            ],
            evidenceRequirements: [
              'Uses the 628.76% implied annual return and the $2,750.00 that would be lost on a $2,500 stake with the fee.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'evidence-use'],
            lookFors: [
              'The response treats urgency as a warning sign rather than as a cost of delay.',
              'The response protects identifying information as well as money.',
              'The response does not name or imply any real firm or product.',
            ],
            commonMisconception: 'Judging an offer by whether the return sounds plausible for one month, without compounding the claim out to see what it asserts over a year.',
          },
        ],
      },
    ],
    remediation: 'If the yearly figure comes out at $1,180.00, the 18% has been applied once rather than compounded monthly as the offer states. Multiply by 1.18 twelve times over — once for each month — and the claim resolves to $7,287.59, which is what makes it testable.',
    extension: 'Work out what the fictional 3% account would return over 10 years on $1,000, and say what that comparison shows about the kind of growth a genuine long-horizon plan relies on.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l07',
    grade: 12, unit: 5, day: 7,
    actor: 'a fictional worker who reached an annual contribution cap early in the year',
    objective: 'Reproduce the loss a fictional worker created by front-loading contributions against a per-period employer contribution, and compute the rate that would have avoided it.',
    scenario: 'The fictional plan rules, cap, and salary below are invented for this exercise.',
    materials: ['calculator', 'the fictional plan rules and pay figures in these directions'],
    domains: ['saving-investing', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker earns $60,000 a year, paid monthly at $5,000 a month, and elected to contribute 12% of each month’s pay. Under the fictional plan rules the worker may contribute no more than $4,800 in a year, and the employer adds 50% of what the worker contributes on the first 5% of that month’s pay — calculated separately in each month, with nothing carried forward.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the worker contribute each month at 12%?',
            given: { monthlyGross: 5000, rate: 0.12 }, expr: 'round(monthlyGross * rate, 2)', format: 'usd', answer: '$600.00',
            reasoning: '12% of the $5,000 monthly gross. The rate is applied per month, which is what causes the annual cap to be reached before the year ends.',
          },
          {
            ref: 't1-p2', kind: 'numeric',
            text: 'After how many months is the $4,800 annual cap reached?',
            given: { annualCap: 4800 }, expr: 'annualCap / #t1-p1', format: 'int', answer: '8',
            reasoning: '$4,800 divided by $600.00 a month. From month 9 onward the worker may contribute nothing further.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the largest employer contribution available in a single month?',
            given: { monthlyGross2: 5000, matchTier: 0.05, matchShare: 0.5 }, expr: 'round(monthlyGross2 * matchTier * matchShare, 2)', format: 'usd', answer: '$125.00',
            reasoning: '50% of 5% of $5,000. Because the plan calculates this monthly with nothing carried forward, a month with no worker contribution produces no employer contribution.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the consequence, and find the rate that would have avoided it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What employer contribution was earned across the 8 contributing months?',
            given: {}, expr: '#t1-p3 * 8', format: 'usd', answer: '$1,000.00',
            reasoning: '$125.00 in each of the 8 months in which the worker contributed at least 5% of pay.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What employer contribution was lost across the remaining months of the year?',
            given: {}, expr: '#t1-p3 * 4', format: 'usd', answer: '$500.00',
            reasoning: '$125.00 in each of the 4 months with no worker contribution. Nothing was carried forward, so this is not recoverable later in the year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What contribution rate would have spread the $4,800 evenly across the whole year, to two decimal places?',
            given: { annualCap2: 4800, monthlyGross3: 5000 }, expr: 'round(annualCap2 / 12 / monthlyGross3 * 100, 2)', format: 'percent2', answer: '8.00%',
            reasoning: '$4,800 across 12 months is $400.00 a month, which is 8.00% of $5,000. This is above the 5% needed for the full monthly employer contribution, so the cap and the employer terms are compatible at this rate.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What employer contribution would that rate have produced across the year?',
            given: {}, expr: '#t1-p3 * 12', format: 'usd', answer: '$1,500.00',
            reasoning: '$125.00 in each of 12 months. The worker contributes the same $4,800 either way and receives $500.00 more.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The worker saved the same $4,800 and received $500.00 less. Name precisely what caused that, explain why a higher contribution rate produced a worse result, and state which plan rule the worker would have to check to know this could happen.',
            acceptableAnswerCriteria: [
              'Names the cause precisely: the employer contribution is calculated per month with nothing carried forward, so reaching the annual cap in month 8 left 4 months in which no employer contribution could be earned.',
              'Explains the paradox: a higher rate did not increase the amount contributed, because the cap fixes that at $4,800, but it did change the timing, and timing is what the monthly calculation rewards.',
              'Names the rule to check: whether the plan calculates the employer contribution per pay period or across the year — a plan with a year-end true-up would not produce this loss at all.',
            ],
            evidenceRequirements: [
              'Uses the $1,000.00 actually earned and the $1,500.00 available, and refers to the 8 contributing months.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies timing rather than amount as the error.',
              'The response notes that the worker did nothing wrong in saving more, only in scheduling it.',
            ],
            commonMisconception: 'Assuming that contributing more, or contributing earlier, can only improve the outcome, when a per-period employer calculation rewards contributing in every period instead.',
          },
        ],
      },
    ],
    remediation: 'If the loss comes out as zero, the employer contribution is being treated as an annual calculation. The stated rule calculates it in each month separately, with nothing carried forward, so months 9 to 12 produce nothing. Count $125.00 for each month in which the worker actually contributed, and compare that with $125.00 for all 12.',
    extension: 'Work out what the loss would be if the worker had elected 20% instead of 12%, and say whether the loss grows in proportion to the rate.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l08',
    grade: 12, unit: 5, day: 8,
    actor: 'a fictional worker weighing a retirement contribution against a card balance',
    objective: 'Put a fictional employer contribution and a fictional interest charge on a comparable annual footing, and judge a case where the two claims on one budget are different kinds of quantity.',
    scenario: 'The fictional salary, the simulated card balance, and the invented plan terms below exist only for this exercise. Nothing here advises any real person about borrowing or saving.',
    materials: ['calculator', 'the fictional pay, plan, and balance figures in these directions'],
    domains: ['saving-investing', 'debt', 'credit', 'budgeting', 'income'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional worker earns $45,600 a year paid monthly. The employer contributes 100% of what the worker puts in, up to the first 4% of pay. The worker also carries a simulated card balance of $2,900 charged at 19.2% a year, applied as one twelfth of that rate each month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is monthly gross pay?',
            given: { salary: 45600 }, expr: 'round(salary / 12, 2)', format: 'usd', answer: '$3,800.00',
            reasoning: '$45,600 across the 12 months of a year.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What monthly contribution earns the full employer amount?',
            given: { tier: 0.04 }, expr: 'round(#t1-p1 * tier, 2)', format: 'usd', answer: '$152.00',
            reasoning: '4% of $3,800.00. At a 100% match the employer adds the same $152.00, so the worker’s $152.00 becomes $304.00 in the account.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put both claims on the same annual footing.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the card balance cost in interest in one month?',
            given: { cardBalance: 2900, cardApr: 0.192 }, expr: 'round(cardBalance * cardApr / 12, 2)', format: 'usd', answer: '$46.40',
            reasoning: 'One twelfth of 19.2% on $2,900.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the employer contribution worth across a full year?',
            given: {}, expr: '#t1-p2 * 12', format: 'usd', answer: '$1,824.00',
            reasoning: '$152.00 in each of 12 months, if the worker contributes throughout.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the card cost across a year if the balance stays where it is?',
            given: {}, expr: '#t2-p1 * 12', format: 'usd', answer: '$556.80',
            reasoning: '$46.40 in each of 12 months, holding the balance at $2,900 — a simplification, since any repayment reduces both the balance and the charge.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Over the coming year, which is the larger amount?',
            choices: ['The employer contribution available', 'The interest the card would charge'],
            decision: { left: '#t2-p2', cmp: '>', right: '#t2-p3', ifTrue: 'The employer contribution available', ifFalse: 'The interest the card would charge' },
            answer: 'The employer contribution available',
            reasoning: '$1,824.00 against $556.80 on the stated assumptions. The comparison is only valid because both have been converted to dollars over the same year; the 100% employer rate and the 19.2% annual rate are not comparable as percentages.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The employer contribution is larger in dollars, and the card balance is the more urgent problem in other ways. Explain why comparing 100% with 19.2% directly is a mistake, and describe an allocation of $300 a month across the two claims that you could defend, naming what it gives up.',
            acceptableAnswerCriteria: [
              'Explains why the percentages are not comparable: 100% is a one-time addition to money contributed, while 19.2% is a rate charged every year the balance is carried, so the two describe different things and only a dollar figure over a stated period compares them.',
              'Proposes a specific allocation of the $300 with figures — for example $152.00 to secure the full employer contribution and $148.00 to the card — and shows the parts summing to $300.',
              'Names what the allocation gives up: a slower reduction in the $2,900 balance, or a smaller employer contribution than the $1,824.00 available.',
              'Recognises that the $556.80 figure assumes the balance stays put, so paying it down reduces the charge as well as the balance.',
            ],
            evidenceRequirements: [
              'Uses the $1,824.00 annual employer contribution and the $556.80 annual interest, and shows an allocation summing to $300.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response converts both claims to dollars before ranking them.',
              'More than one allocation is defensible and each is credited when the sacrifice is named.',
              'The response does not present a course of action as advice for a real person.',
            ],
            commonMisconception: 'Ranking a matching rate against an interest rate by comparing the two percentages, when one applies once to contributions and the other applies annually to a balance.',
          },
        ],
      },
    ],
    remediation: 'If the two claims are ranked by comparing 100% with 19.2%, stop and convert both to dollars over the same year. The employer contribution is worth $1,824.00 if $152.00 is contributed monthly; the card costs $556.80 if the balance stays at $2,900. Only figures built the same way can be ranked.',
    extension: 'Recompute both annual figures for a fictional worker with a $9,400 card balance at the same rate, and say at what balance the ranking would reverse.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l09',
    grade: 12, unit: 5, day: 9,
    actor: 'a fictional investor whose horizon has shortened from decades to a few years',
    objective: 'Reallocate a fictional balance as the horizon shortens, quantify how much must move, and compare what a stated fall would cost under each allocation.',
    scenario: 'The fictional balance, the two allocations, and the stated fall below are invented for this exercise. The fall is a scenario used to compare exposure, not a prediction.',
    materials: ['calculator', 'the fictional allocation figures in these directions'],
    domains: ['saving-investing', 'insurance-risk', 'multi-variable-decision', 'budgeting'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional balance of $84,000 is held 85% in a growth category and 15% in a stable category, an allocation chosen when the money was not needed for decades. The investor now expects to need it in about five years and is considering moving to 45% growth and 55% stable.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is in the growth category under the current allocation?',
            given: { portfolio: 84000, growthLong: 0.85 }, expr: 'portfolio * growthLong', format: 'usd', answer: '$71,400.00',
            reasoning: '85% of the $84,000 balance. This is the exposure the original allocation carried when the money was not needed for decades.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much is in the stable category under the current allocation?',
            given: { portfolio2: 84000, stableLong: 0.15 }, expr: 'portfolio2 * stableLong', format: 'usd', answer: '$12,600.00',
            reasoning: '15% of $84,000, which with the growth portion accounts for the whole balance.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much would be in the growth category under the proposed allocation?',
            given: { portfolio3: 84000, growthShort: 0.45 }, expr: 'portfolio3 * growthShort', format: 'usd', answer: '$37,800.00',
            reasoning: '45% of the $84,000 balance — the growth exposure the shorter horizon proposes, on the same total.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now size the change and what it does to exposure.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much would be in the stable category under the proposed allocation?',
            given: { portfolio4: 84000, stableShort: 0.55 }, expr: 'portfolio4 * stableShort', format: 'usd', answer: '$46,200.00',
            reasoning: '55% of the $84,000 balance, which together with the growth portion accounts for the whole amount.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much would have to move from growth to stable?',
            given: {}, expr: '#t1-p1 - #t1-p3', format: 'usd', answer: '$33,600.00',
            reasoning: '$71,400.00 currently in growth against $37,800.00 proposed. The balance itself does not change; only where it sits does.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the growth category fell 30%, what would that cost under the current allocation?',
            given: { fall: 0.30 }, expr: 'round(#t1-p1 * fall, 2)', format: 'usd', answer: '$21,420.00',
            reasoning: '30% of the $71,400.00 held in growth. The stable portion is unaffected in this scenario, which is why the exposure follows the allocation.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What would the same fall cost under the proposed allocation?',
            given: { fall2: 0.30 }, expr: 'round(#t1-p3 * fall2, 2)', format: 'usd', answer: '$11,340.00',
            reasoning: '30% of the $37,800.00 that would be held in growth.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much smaller is the loss under the proposed allocation?',
            given: {}, expr: '#t2-p3 - #t2-p4', format: 'usd', answer: '$10,080.00',
            reasoning: '$21,420.00 against $11,340.00. This is what the reallocation buys, and it is the same figure whether or not the fall happens — which is the point of deciding before rather than after.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why a shortening horizon changes the right allocation even though nothing about the categories themselves has changed, and say what the reallocation costs the fictional investor that the loss figures do not show.',
            acceptableAnswerCriteria: [
              'Explains the horizon argument: an investor with decades can wait out a fall, while one who must spend the money in about five years may have to sell during it, so the same exposure carries a different consequence.',
              'Uses the exposure figures: the reallocation reduces the cost of a 30% fall from $21,420.00 to $11,340.00, a difference of $10,080.00, without any prediction about whether such a fall occurs.',
              'Names what the loss figures omit: moving $33,600.00 out of growth also gives up whatever that portion would have gained, so the reallocation reduces the range of outcomes in both directions rather than only the bad one.',
            ],
            evidenceRequirements: [
              'Uses the $33,600.00 that must move and both loss figures, $21,420.00 and $11,340.00.',
            ],
            dimensions: ['tradeoff-defense', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response ties allocation to when the money is needed rather than to a view about what markets will do.',
              'The response acknowledges the forgone upside as a real cost, not only a theoretical one.',
            ],
            commonMisconception: 'Treating a reallocation toward stability as pure protection, when it also removes the growth exposure that made the original allocation worth holding.',
          },
        ],
      },
    ],
    remediation: 'If the amount to move comes out at $84,000 or at $46,200.00, the two allocations are being compared on the wrong side. The growth holding falls from $71,400.00 to $37,800.00, so $33,600.00 moves; the stable holding rises from $12,600.00 to $46,200.00 by the same $33,600.00.',
    extension: 'Work out the loss under each allocation if the stable category also fell, by 5%, and say how much of the protection the reallocation offered survives.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u05-l10',
    grade: 12, unit: 5, day: 10,
    actor: 'a fictional investor writing a decline policy before it is needed',
    objective: 'Assemble the figures a fictional decline policy has to be built on — the fall, the recovery required, continued contributions, and the fee charged throughout — and write the policy.',
    scenario: 'The fictional balance, contribution, fee, and decline below are invented for this exercise. The decline is a scenario for planning purposes and is not a forecast.',
    materials: ['calculator', 'the fictional account figures in these directions'],
    domains: ['saving-investing', 'insurance-risk', 'consumer-protection', 'budgeting', 'fraud', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional account holds $31,500, receives $340 a month, and is charged an annual fee of 0.22% of the balance. Plan for a scenario in which the balance falls 28%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the balance after a 28% fall?',
            given: { portfolio: 31500, decline: 0.28 }, expr: 'round(portfolio * (1 - decline), 2)', format: 'usd', answer: '$22,680.00',
            reasoning: '$31,500 reduced by 28%, leaving 72% of the balance.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What gain on the reduced balance would restore $31,500, to two decimal places?',
            given: { portfolio2: 31500 }, expr: 'round((portfolio2 - #t1-p1) / #t1-p1 * 100, 2)', format: 'percent2', answer: '38.89%',
            reasoning: 'The $8,820.00 lost measured against the $22,680.00 remaining. The required gain always exceeds the fall, because it is calculated on the smaller base.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the annual fee at the reduced balance?',
            given: { feeRate: 0.0022 }, expr: 'round(#t1-p1 * feeRate, 2)', format: 'usd', answer: '$49.90',
            reasoning: '0.22% of $22,680.00. The fee falls with the balance but does not stop; it is charged during the decline as well as after it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now carry the account forward through 18 months of continued contributions.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is contributed over 18 months?',
            given: { monthly: 340, months: 18 }, expr: 'monthly * months', format: 'usd', answer: '$6,120.00',
            reasoning: '$340 in each of the 18 months. The contributions continue at the same rate whatever the balance is doing, which is what a decline policy has to decide in advance.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Ignoring any further movement in the balance, what does the account hold after those contributions?',
            given: {}, expr: '#t1-p1 + #t2-p1', format: 'usd', answer: '$28,800.00',
            reasoning: '$22,680.00 plus $6,120.00 contributed. Holding the market flat is a stated simplification so the effect of contributions alone can be seen.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the annual fee at that balance?',
            given: { feeRate2: 0.0022 }, expr: 'round(#t2-p2 * feeRate2, 2)', format: 'usd', answer: '$63.36',
            reasoning: '0.22% of the $28,800.00 balance. The fee is charged on the balance however it was built, so contributions raise it just as returns would.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'By how much has the annual fee risen?',
            given: {}, expr: '#t2-p3 - #t1-p3', format: 'usd', answer: '$13.46',
            reasoning: '$63.36 against $49.90. A percentage fee rises with the balance whether the balance grew from contributions or from returns.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Put the fee in the terms the policy will have to justify.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'percent',
            text: 'What proportion of the 18 months of contributions does one year of the fee represent, to two decimal places?',
            given: {}, expr: 'round(#t2-p3 / #t2-p1 * 100, 2)', format: 'percent2', answer: '1.04%',
            reasoning: '$63.36 measured against the $6,120.00 contributed. Setting a certain cost against money the investor actually put in is a way to judge whether the fee is worth what the account provides.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write the policy. Attach a figure to each part of it.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the decline policy this fictional investor should set down now, before any fall occurs. Cover what happens to contributions, what would and would not count as a reason to sell, and how the policy handles anyone who contacts the investor during a decline offering to help. State plainly what your policy cannot guarantee.',
            acceptableAnswerCriteria: [
              'States what happens to contributions during a decline and justifies it with a figure — for example continuing $340 a month, so that 18 months adds $6,120.00 regardless of the level.',
              'Separates reasons to sell from reactions to a fall: names a legitimate trigger such as needing the money at a known date or a change in circumstances, and states that a fall alone is not one.',
              'Addresses unsolicited contact during a decline: an offer arriving at the moment of a fall is a pressure situation, no account details or identifying information should be given to anyone who makes contact unprompted, and any offer should be verified independently before anything moves.',
              'Uses the fee figures to show what continues regardless: 0.22% is charged whether the balance rises or falls, amounting to $49.90 at the reduced balance and $63.36 once contributions have rebuilt it — which is 1.04% of the 18 months of contributions.',
              'States the limit honestly: the policy cannot guarantee a recovery, and the 38.89% gain needed to restore $31,500 is what is required rather than what is expected.',
            ],
            evidenceRequirements: [
              'Uses the $22,680.00 post-decline balance and the 38.89% gain required, and at least one of the fee figures.',
              'States what the policy cannot promise.',
            ],
            dimensions: ['plan-coherence', 'communication-of-uncertainty', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The policy is written in advance and in terms that could be followed without further judgement during a fall.',
              'A policy that continues contributions and one that pauses them are both credited, provided the reason is stated and the cost is named.',
              'The response does not assert that the balance will recover, and does not name any real product or provider.',
            ],
            commonMisconception: 'Writing a decline policy that consists only of "do not panic", which gives no instruction about contributions, no test for when selling is legitimate, and no protection against offers that arrive precisely when judgement is worst.',
          },
        ],
      },
    ],
    remediation: 'If the required gain comes out as 28%, it is being measured against the original $31,500 rather than the $22,680.00 that remains. The $8,820.00 has to be regained from the reduced balance, which needs 38.89%. The same asymmetry applies to every decline: the recovery percentage always exceeds the fall percentage.',
    extension: 'Recompute the balance, the required gain, and the fee after a 45% fall instead, and say what the two cases together show about how quickly the required recovery grows.',
  },
]
