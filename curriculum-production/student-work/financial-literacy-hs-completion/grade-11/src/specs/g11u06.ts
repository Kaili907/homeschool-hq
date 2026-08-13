import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 6 — PF6 Protecting and Insuring: Risk Management Across a
 * Household. Ten lessons, one per source lesson day.
 *
 * The grade-11 move here is that coverage is computed rather than described.
 * Every payout in this unit is worked in the order a policy actually applies:
 * the deductible comes off the loss first, the coverage limit caps what remains,
 * and whatever is left is the holder's. Expected loss is likelihood multiplied
 * by severity, so a frequent small risk and a rare catastrophic one can be
 * ranked against each other. Every policy, insurer, premium, and loss below is
 * invented, and the fraud lesson is a written case study that requires no
 * contact with anyone and no account of any kind.
 */
export const g11u06: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u06-l01',
    grade: 11, unit: 6, day: 1,
    actor: 'Persephone Adeoye-Ravensworth, a fictional planner quantifying a household’s exposure',
    objective: 'Compute the expected annual loss of four fictional risks from likelihood and severity, rank them, and show why likelihood alone gives a different ranking.',
    scenario: 'Persephone Adeoye-Ravensworth is quantifying the exposure of a fictional household. The four risks, their likelihoods, and their severities below are invented figures for this exercise.',
    materials: ['calculator', 'the fictional risk table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household faces four risks in a year. Roof damage has a 4% chance and would cost $14,500. A vehicle collision has a 9% chance and would cost $6,800. Losing a phone has a 22% chance and would cost $940. A long illness has a 2% chance and would cost $38,000. Expected loss is the chance multiplied by the cost.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from roof damage?',
            given: { roofChance: 0.04, roofCost: 14500 }, expr: 'round(roofChance * roofCost, 2)', format: 'usd', answer: '$580.00',
            reasoning: '4% of $14,500. This is not what a roof failure costs; it is what the risk of one costs on average across many years.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from a vehicle collision?',
            given: { collisionChance: 0.09, collisionCost: 6800 }, expr: 'round(collisionChance * collisionCost, 2)', format: 'usd', answer: '$612.00',
            reasoning: '9% of $6,800 — a more likely event with a smaller loss behind it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from losing a phone?',
            given: { phoneChance: 0.22, phoneCost: 940 }, expr: 'round(phoneChance * phoneCost, 2)', format: 'usd', answer: '$206.80',
            reasoning: '22% of $940 — much the most likely of the four, and much the smallest expected loss.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from a long illness?',
            given: { illnessChance: 0.02, illnessCost: 38000 }, expr: 'round(illnessChance * illnessCost, 2)', format: 'usd', answer: '$760.00',
            reasoning: '2% of $38,000 — the least likely of the four, and the largest expected loss.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now combine them and compare the two ways of ranking.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total expected annual loss across all four risks?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3 + #t1-p4', format: 'usd', answer: '$2,158.80',
            reasoning: '$580.00, $612.00, $206.80, and $760.00 together — the average annual cost of carrying all four risks unprotected.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of the total expected loss comes from the illness risk? Give one decimal place.',
            given: {}, expr: 'round(#t1-p4 / #t2-p1 * 100, 1)', format: 'percent1', answer: '35.2%',
            reasoning: '$760.00 of $2,158.80 — over a third of the exposure sits in the risk that is least likely to happen.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'ratio',
            text: 'How many times larger is the illness expected loss than the phone expected loss? Give two decimal places.',
            given: {}, expr: 'round(#t1-p4 / #t1-p3, 2)', format: 'dec2', answer: '3.68',
            reasoning: '$760.00 against $206.80, even though the phone risk is eleven times more likely to occur.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'The household holds a reserve of $9,000. By how much would the illness loss exceed it?',
            given: { illnessCost2: 38000, reserve: 9000 }, expr: 'illnessCost2 - reserve', format: 'usd', answer: '$29,000.00',
            reasoning: '$38,000 against a $9,000 reserve. Expected loss says how much the risk costs on average; this says what happens on the day it arrives.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which risk carries the largest expected annual loss?',
            choices: ['Roof damage', 'Vehicle collision', 'Losing a phone', 'A long illness'],
            given: {},
            decision: { left: '#t1-p4', cmp: '>', right: '#t1-p2', ifTrue: 'A long illness', ifFalse: 'Vehicle collision' },
            answer: 'A long illness',
            reasoning: '$760.00 from the illness risk against $612.00 from collision, $580.00 from the roof, and $206.80 from the phone — the least likely risk tops the ranking because severity, not frequency, dominates it.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Ranking by likelihood puts the phone first and ranking by expected loss puts the illness first. Explain why the two disagree, and say which ranking should guide how the household spends money on protection.',
            acceptableAnswerCriteria: [
              'Explains that expected loss multiplies likelihood by severity, so a 2% chance of $38,000 outweighs a 22% chance of $940 by 3.68 times.',
              'Argues that expected loss should guide spending, because protection is bought against cost rather than against frequency.',
              'Notes that the $29,000 shortfall against the reserve is a further reason the illness risk matters more, since it is the one the household could not absorb.',
            ],
            evidenceRequirements: [
              'Cites the $760.00 and $206.80 expected losses alongside the 2% and 22% likelihoods.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'plan-coherence'],
            lookFors: [
              'The response uses both dimensions of the risk rather than arguing that severity alone matters.',
              'The response distinguishes the average annual cost from what happens in the year the event occurs.',
              'A response noting that the phone loss is annoying but survivable while the illness loss is not is making the right distinction.',
            ],
            commonMisconception: 'Ranking risks by how often they happen.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The total expected annual loss is $2,158.80. Say what that figure would and would not tell the household about any particular year.',
            acceptableAnswerCriteria: [
              'Explains that it is an average across many years, and that most years will bring either nothing at all or a single event costing far more than $2,158.80.',
              'States what it is useful for: comparing the cost of carrying the risks against the cost of protecting against them.',
            ],
            evidenceRequirements: [
              'Refers to at least one individual severity figure, such as the $38,000 illness cost, when explaining what an average conceals.',
            ],
            dimensions: ['communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises that the expected figure is not a likely outcome in any single year.',
              'The stated use is a genuine one rather than a concession.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the phone risk comes out as the largest exposure, likelihood is being read as the answer on its own. Expected loss is the chance multiplied by the cost: 22% of $940 is $206.80, while 2% of $38,000 is $760.00. Write the four products in a column and rank the column, not the percentages.',
    extension: 'Recompute the four expected losses if every severity doubled but every likelihood halved, and say what happens to the ranking and to the total.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l02',
    grade: 11, unit: 6, day: 2,
    actor: 'Lucien Batbold-Renaudin, a fictional planner allocating a fixed protection budget',
    objective: 'Rank four fictional policies by the expected loss each removes per premium dollar, allocate a fixed budget accordingly, and state what the ranking measure leaves out.',
    scenario: 'Lucien Batbold-Renaudin is allocating a fictional household’s protection budget. The four policies, their premiums, deductibles, and limits below are invented for this exercise.',
    materials: ['calculator', 'the fictional policy table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The budget is $1,850 a year. Policy A costs $640, covers roof damage with a $1,000 deductible, and the risk is a 4% chance of a $14,500 loss. Policy D costs $410, covers a long illness with a $2,500 deductible, and the risk is a 2% chance of a $38,000 loss. A policy removes the expected value of what it would pay, which is the chance multiplied by the loss less the deductible.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does Policy A remove?',
            given: { roofChance: 0.04, roofLoss: 14500, roofDeductible: 1000 },
            expr: 'round(roofChance * (roofLoss - roofDeductible), 2)', format: 'usd', answer: '$540.00',
            reasoning: 'The policy pays the loss above the $1,000 deductible, so 4% of $13,500 is what it removes on average. The deductible stays with the household.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does Policy D remove?',
            given: { illnessChance: 0.02, illnessLoss: 38000, illnessDeductible: 2500 },
            expr: 'round(illnessChance * (illnessLoss - illnessDeductible), 2)', format: 'usd', answer: '$710.00',
            reasoning: '2% of the $35,500 above the deductible — the largest reduction of the four, from the cheapest premium.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'ratio',
            text: 'How much expected loss does Policy A remove per premium dollar? Give two decimal places.',
            given: { premiumA: 640 }, expr: 'round(#t1-p1 / premiumA, 2)', format: 'dec2', answer: '0.84',
            reasoning: '$540.00 of reduction for $640 of premium — under a dollar of expected loss removed per dollar spent.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'ratio',
            text: 'How much expected loss does Policy D remove per premium dollar? Give two decimal places.',
            given: { premiumD: 410 }, expr: 'round(#t1-p2 / premiumD, 2)', format: 'dec2', answer: '1.73',
            reasoning: '$710.00 of reduction for $410 of premium — over twice as much per dollar as Policy A.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Policy C costs $190, covers a phone with a $100 deductible, and the risk is a 22% chance of a $940 loss. Policy B costs $780, covers a collision with a $500 deductible, and the risk is a 9% chance of a $6,800 loss.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does Policy C remove?',
            given: { phoneChance: 0.22, phoneLoss: 940, phoneDeductible: 100 },
            expr: 'round(phoneChance * (phoneLoss - phoneDeductible), 2)', format: 'usd', answer: '$184.80',
            reasoning: '22% of the $840 above the deductible.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does Policy B remove?',
            given: { collisionChance: 0.09, collisionLoss: 6800, collisionDeductible: 500 },
            expr: 'round(collisionChance * (collisionLoss - collisionDeductible), 2)', format: 'usd', answer: '$567.00',
            reasoning: '9% of the $6,300 above the deductible.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'ratio',
            text: 'How much expected loss does Policy C remove per premium dollar? Give two decimal places.',
            given: { premiumC0: 190 }, expr: 'round(#t2-p1 / premiumC0, 2)', format: 'dec2', answer: '0.97',
            reasoning: '$184.80 of reduction for $190 of premium — better value than Policy A but well behind Policy D.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Buying Policy D, then Policy C, then Policy A in that order, what do the three premiums come to?',
            given: { premiumD2: 410, premiumC: 190, premiumA2: 640 },
            expr: 'premiumD2 + premiumC + premiumA2', format: 'usd', answer: '$1,240.00',
            reasoning: '$410, $190, and $640 — the three policies ranked highest on reduction per premium dollar, taken in that order.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much of the $1,850 budget is left after those three?',
            given: { budget: 1850 }, expr: 'budget - #t2-p4', format: 'usd', answer: '$610.00',
            reasoning: '$1,850 less $1,240.00 — not enough for Policy B at $780, which is why the last policy on the ranking is the one that goes unbought.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'What total expected annual loss do the three purchased policies remove?',
            given: {}, expr: '#t1-p2 + #t2-p1 + #t1-p1', format: 'usd', answer: '$1,434.80',
            reasoning: '$710.00 from D, $184.80 from C, and $540.00 from A — bought for $1,240.00 of premium.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The ranking measure is expected loss removed per premium dollar. Say what it captures well, name one thing it ignores entirely, and explain how that omission could lead to the wrong purchase.',
            acceptableAnswerCriteria: [
              'States what it captures: value for money across policies with different premiums, letting a $410 policy and a $780 one be compared on the same basis.',
              'Names a genuine omission — most importantly that it treats a $940 phone loss and a $38,000 illness loss as equivalent per dollar, ignoring whether the household could survive the loss at all.',
              'Explains the consequence: the measure could rank a cheap policy against a survivable risk above an expensive one against a ruinous risk.',
            ],
            evidenceRequirements: [
              'Cites at least two of the per-dollar figures, such as 1.73 for Policy D and 0.97 for Policy C, when describing what the measure compares.',
            ],
            dimensions: ['criteria-application', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The omission named is about the size of the loss relative to the household, not about the arithmetic.',
              'The response does not reject the measure; it says what it is for and where it stops.',
              'A response arguing that catastrophic risks should be insured first regardless of the ratio is making the right argument.',
            ],
            commonMisconception: 'Treating a value-for-money ranking as a complete guide to what should be insured.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Policy B is the one that goes unbought, leaving $610.00 of budget unspent. Say what the household could do with that $610.00, and what it would be giving up by leaving the collision risk uncovered.',
            acceptableAnswerCriteria: [
              'Proposes a use for the $610.00 with a reason, such as holding it as reserve against the uncovered collision risk or against the deductibles on the three policies bought.',
              'States what is given up in figures: the $567.00 of expected loss Policy B would have removed, and exposure to a $6,800 loss at a 9% chance.',
            ],
            evidenceRequirements: [
              'Refers to the $610.00 remaining and the $567.00 reduction Policy B would have provided.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense'],
            lookFors: [
              'The proposed use is connected to the risk left uncovered rather than being arbitrary.',
              'The response notices that the deductibles on the purchased policies are themselves an exposure.',
            ],
          },
        ],
      },
    ],
    remediation: 'If a policy appears to remove the whole expected loss, the deductible is being ignored. A policy pays only what the loss exceeds the deductible by, so Policy A removes 4% of $13,500 and not 4% of $14,500. Write the loss, the deductible, and the difference as three columns before multiplying by the chance.',
    extension: 'Find the premium at which Policy B would be worth buying ahead of Policy A on the per-dollar measure, and say whether the household could then afford all four.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l03',
    grade: 11, unit: 6, day: 3,
    actor: 'Wilhelmina Osagie-Trentham, a fictional planner deciding whether to buy cover at all',
    objective: 'Compare the expected cost of carrying a fictional risk against the expected cost of insuring it, and identify the condition under which the cheaper option is still the wrong one.',
    scenario: 'Wilhelmina Osagie-Trentham is deciding how a fictional household should handle one risk. The chance, the loss, the premium, and the reserve below are invented for this exercise.',
    materials: ['calculator', 'the fictional risk and policy figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The risk is a 6% chance of a $4,200 loss in a year. A policy covering it costs $395 a year with a $600 deductible and a limit above the full loss. The household holds a reserve of $1,500.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss if the household carries the risk itself?',
            given: { chance: 0.06, loss: 4200 }, expr: 'round(chance * loss, 2)', format: 'usd', answer: '$252.00',
            reasoning: '6% of $4,200 — the average annual cost of self-insuring, spread across many years.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'If the loss occurs, how much does the policy pay, after the $600 deductible?',
            given: { loss2: 4200, deductible: 600, limit: 4200 },
            expr: 'min(max(loss2 - deductible, 0), limit)', format: 'usd', answer: '$3,600.00',
            reasoning: 'The deductible comes off the loss first, and $3,600 is below the limit, so the whole remainder is paid.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'If the loss occurs, how much does the household still pay?',
            given: { loss3: 4200 }, expr: 'loss3 - #t1-p2', format: 'usd', answer: '$600.00',
            reasoning: 'The $600 deductible — the part of every covered loss that stays with the holder.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual cost of holding the policy, counting the premium and the expected deductible?',
            given: { premium: 395, chance2: 0.06, deductible2: 600 },
            expr: 'round(premium + chance2 * deductible2, 2)', format: 'usd', answer: '$431.00',
            reasoning: '$395 paid every year plus 6% of the $600 deductible, since the deductible is only paid in the years the loss occurs.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now compare the two, and then look at what happens in the year the loss actually arrives.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much cheaper is carrying the risk than insuring it, in expected terms?',
            given: {}, expr: '#t1-p4 - #t1-p1', format: 'usd', answer: '$179.00',
            reasoning: '$431.00 with the policy against $252.00 without — the insurer charges more than the expected loss, which is how it covers its own costs and risk.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If the loss occurs and the household has no policy, how much does its $1,500 reserve fall short by?',
            given: { loss4: 4200, reserve: 1500 }, expr: 'loss4 - reserve', format: 'usd', answer: '$2,700.00',
            reasoning: '$4,200 against a $1,500 reserve. Self-insuring only works if the reserve can actually absorb the loss.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'With the policy, how much would the $1,500 reserve have left over after paying the deductible?',
            given: { reserve2: 1500 }, expr: 'reserve2 - #t1-p3', format: 'usd', answer: '$900.00',
            reasoning: '$1,500 less the $600 deductible — the policy converts a loss the household cannot absorb into one it can.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'years',
            text: 'How many years of the $179.00 expected saving would it take to build a reserve able to cover the whole $4,200 loss? Give one decimal place.',
            given: {}, expr: 'round(#t2-p2 / #t2-p1, 1)', format: 'years1', answer: '15.1',
            reasoning: 'The $2,700.00 shortfall divided by the $179.00 a year that self-insuring saves — the household is exposed for the whole of that period.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which option is cheaper in expected terms, and which is safer for this household?',
            choices: [
              'Carrying the risk is cheaper and also safer',
              'Carrying the risk is cheaper but the policy is safer',
              'The policy is cheaper and also safer',
            ],
            given: {},
            decision: { left: '#t1-p1', cmp: '<', right: '#t1-p4', ifTrue: 'Carrying the risk is cheaper but the policy is safer', ifFalse: 'The policy is cheaper and also safer' },
            answer: 'Carrying the risk is cheaper but the policy is safer',
            reasoning: '$252.00 against $431.00 makes self-insuring cheaper on average, while the $2,700.00 shortfall against the reserve makes the policy the option the household could actually survive.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Insuring costs $179.00 a year more in expected terms and is still the right choice here. Explain what the household is buying with that $179.00, and state the general condition under which self-insuring is the better option.',
            acceptableAnswerCriteria: [
              'Explains that the $179.00 buys the removal of an outcome the household cannot survive: a $4,200 loss against a $1,500 reserve.',
              'States the general condition: self-insuring is better when the reserve can absorb the largest plausible loss without disrupting the rest of the plan.',
              'Recognises that an insurer must charge more than the expected loss, so paying more than the expectation is the normal case rather than a sign of a bad policy.',
            ],
            evidenceRequirements: [
              'Cites the $252.00 expected loss, the $431.00 expected cost with the policy, and the $2,700.00 reserve shortfall.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies capacity to absorb the loss as the deciding factor, not the expected cost.',
              'The response explains why the premium exceeds the expected loss rather than treating it as overcharging.',
              'A response noting that the household could self-insure once the reserve passes about $4,200 is stating the condition correctly.',
            ],
            commonMisconception: 'Choosing between insuring and self-insuring on expected cost alone.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The household is exposed for the 15.1 years it would take to build a sufficient reserve out of the saving. Say what that figure assumes, and name one way the household could shorten it.',
            acceptableAnswerCriteria: [
              'Identifies the assumptions: that the $179.00 saving is actually set aside every year, that no loss occurs during the period, and that the $4,200 loss does not grow with prices.',
              'Names a way to shorten it, such as contributing more than the saving, holding the policy while the reserve is built, or accepting a higher deductible to reduce the premium.',
            ],
            evidenceRequirements: [
              'Refers to the 15.1-year figure and to the $179.00 annual saving it is built from.',
            ],
            dimensions: ['assumption-identification', 'plan-coherence'],
            lookFors: [
              'The assumptions named are ones the calculation actually makes.',
              'The suggested change is checked against the figures rather than asserted.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the expected cost with the policy comes out at $995.00, the whole $600 deductible is being added to the premium. The deductible is only paid in the 6% of years when the loss occurs, so its expected cost is $36.00 and not $600. Write the premium as a certain cost and the deductible as a chance-weighted one before adding them.',
    extension: 'Find the premium at which insuring and self-insuring would cost the same in expected terms, and say how far below the actual $395 that is.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l04',
    grade: 11, unit: 6, day: 4,
    actor: 'Nikolai Ferreiro-Adichie, a fictional claimant working through two overlapping policies',
    objective: 'Compute what two fictional overlapping policies pay on a single loss in the correct order — deductible, then limit, then the remainder — and locate exactly where the coverage gap sits.',
    scenario: 'Nikolai Ferreiro-Adichie is working through a fictional claim against two simulated policies. The loss, deductibles, and limits below are invented, and no real insurer or claim is described.',
    materials: ['calculator', 'the fictional policy terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A single covered loss of $18,400 has occurred. Policy 1 has a $1,500 deductible and a coverage limit of $12,000. Policy 2 covers whatever Policy 1 leaves, has no deductible, and has a coverage limit of $5,000. Apply the deductible to the loss first, then cap what remains at the limit.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the $18,400 loss is left after Policy 1’s $1,500 deductible?',
            given: { loss: 18400, deductible1: 1500 }, expr: 'loss - deductible1', format: 'usd', answer: '$16,900.00',
            reasoning: 'The deductible comes off the loss before any limit is applied — this is the amount Policy 1 is being asked to pay.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does Policy 1 actually pay, given its $12,000 limit?',
            given: { loss2: 18400, deductible2: 1500, limit1: 12000 },
            expr: 'min(max(loss2 - deductible2, 0), limit1)', format: 'usd', answer: '$12,000.00',
            reasoning: '$16,900.00 is above the $12,000 limit, so the limit caps the payment. Applying the limit before the deductible would have given the same figure here, but not in general.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the loss remains after Policy 1 has paid?',
            given: { loss3: 18400 }, expr: 'loss3 - #t1-p2', format: 'usd', answer: '$6,400.00',
            reasoning: '$18,400 less the $12,000.00 paid — made up of the $1,500 deductible and the $4,900 that sat above Policy 1’s limit.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much does Policy 2 pay, given its $5,000 limit and no deductible?',
            given: { limit2: 5000 }, expr: 'min(#t1-p3, limit2)', format: 'usd', answer: '$5,000.00',
            reasoning: 'The $6,400.00 remaining exceeds the $5,000 limit, so Policy 2 pays its maximum.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find where the gap sits and how large it is.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the loss does Nikolai pay out of pocket?',
            given: { loss4: 18400 }, expr: 'loss4 - #t1-p2 - #t1-p4', format: 'usd', answer: '$1,400.00',
            reasoning: '$18,400 less $12,000.00 from Policy 1 and $5,000.00 from Policy 2.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the loss did the two policies pay between them?',
            given: {}, expr: '#t1-p2 + #t1-p4', format: 'usd', answer: '$17,000.00',
            reasoning: '$12,000.00 and $5,000.00 — the second policy closed most but not all of the first policy’s gap.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the loss was covered? Give one decimal place.',
            given: { loss5: 18400 }, expr: 'round(#t2-p2 / loss5 * 100, 1)', format: 'percent1', answer: '92.4%',
            reasoning: '$17,000.00 of $18,400 — two policies with a combined limit of $17,000 could never have covered more than this.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the loss sat above Policy 1’s $12,000 limit, after its deductible?',
            given: { limit1b: 12000 }, expr: '#t1-p1 - limit1b', format: 'usd', answer: '$4,900.00',
            reasoning: '$16,900.00 that Policy 1 was asked to pay against its $12,000 limit — this excess, not the deductible, is what Policy 2 mostly absorbed.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'What would have closed Nikolai’s $1,400.00 gap entirely?',
            choices: [
              'Raising Policy 2’s limit from $5,000 to $6,400',
              'Removing Policy 1’s $1,500 deductible',
              'Raising Policy 1’s limit from $12,000 to $12,700',
            ],
            given: {},
            answer: 'Raising Policy 2’s limit from $5,000 to $6,400',
            reasoning: 'Policy 2 was asked for $6,400.00 and capped at $5,000, so lifting its limit to $6,400 covers the whole remainder; removing the $1,500 deductible would only shift $1,500 of loss into Policy 1, which is already at its limit, and raising Policy 1’s limit only to $12,700 still leaves $700.00 outstanding, because Policy 2 remains capped at $5,000.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Nikolai holds two policies covering the same loss and still pays $1,400.00. Explain how holding more than one policy can still leave a gap, and identify which of the two terms — the deductible or the limit — did more damage here.',
            acceptableAnswerCriteria: [
              'Explains that deductibles and limits work at opposite ends: a deductible removes the bottom of a loss and a limit caps the top, so two policies can overlap in the middle and still leave both ends exposed.',
              'Identifies the limits as the greater problem here, since the two limits together cap payment at $17,000.00 against an $18,400 loss regardless of anything else.',
              'Notes that the $1,500 deductible was in fact fully absorbed by Policy 2, so it contributed nothing to the final gap.',
            ],
            evidenceRequirements: [
              'Cites the $4,900.00 that sat above Policy 1’s limit and the $17,000.00 combined payment.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'error-diagnosis'],
            lookFors: [
              'The response traces which term produced which part of the gap rather than blaming both.',
              'The response notices that the combined limits are the binding constraint.',
              'A response observing that a larger loss would have widened the gap dollar for dollar is generalising correctly.',
            ],
            commonMisconception: 'Assuming that holding two policies on the same loss means the loss is fully covered.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The order matters: deductible first, then limit. Construct a loss for which applying the limit first would give a different answer under Policy 1, and say which order a policy actually uses.',
            acceptableAnswerCriteria: [
              'Constructs a case where the order changes the result — any loss between $12,000 and $13,500, such as $13,000, where deductible-first gives $11,500 and limit-first would give $10,500.',
              'States that a policy applies the deductible to the loss first and caps the remainder at the limit, which is the order used throughout this lesson.',
            ],
            evidenceRequirements: [
              'Gives a specific loss figure and both results, rather than describing the difference in general terms.',
            ],
            dimensions: ['transfer', 'criteria-application'],
            lookFors: [
              'The constructed case genuinely distinguishes the two orders.',
              'The response states the correct order rather than leaving it open.',
            ],
            commonMisconception: 'Assuming the deductible and the limit can be applied in either order.',
          },
        ],
      },
    ],
    remediation: 'If Policy 1 comes out paying $10,500.00, the deductible is being subtracted after the limit rather than before. The order is: take the $1,500 deductible off the $18,400 loss to get $16,900.00, then cap that at the $12,000 limit. Write the three steps — loss, less deductible, capped at limit — as separate lines every time.',
    extension: 'Recompute all the payments for a loss of $9,000 instead, and say why the two policies cover the whole of it even though their limits are unchanged.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l05',
    grade: 11, unit: 6, day: 5,
    actor: 'Seraphina Duncan-Mwangi, a fictional worker costing an income-loss policy',
    objective: 'Compute what a fictional disability policy pays across an interruption to earnings, measure the share of lost income it replaces, and identify the two terms that create the shortfall.',
    scenario: 'Seraphina Duncan-Mwangi is examining a fictional income-protection policy. The income, benefit percentage, waiting period, and interruption below are invented for this exercise.',
    materials: ['calculator', 'the fictional policy terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Seraphina earns $4,150 a month. The fictional policy pays 60% of monthly income, begins only after a waiting period of 3 months with no benefit, and pays for up to 24 months. The interruption to her earnings lasts 14 months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly benefit at 60% of income?',
            given: { income: 4150, benefitRate: 0.6 }, expr: 'round(income * benefitRate, 2)', format: 'usd', answer: '$2,490.00',
            reasoning: '60% of $4,150. The policy replaces part of the income, not all of it, which is the first source of the shortfall.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much income is lost across the whole 14 months?',
            given: { income2: 4150, months: 14 }, expr: 'income2 * months', format: 'usd', answer: '$58,100.00',
            reasoning: '14 months at $4,150 — what Seraphina would have earned had the interruption not happened.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much income is lost during the 3-month waiting period, when nothing is paid?',
            given: { income3: 4150 }, expr: 'income3 * 3', format: 'usd', answer: '$12,450.00',
            reasoning: 'Three months at $4,150 with no benefit at all — the second source of the shortfall, and the one that arrives first.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much does the policy pay in total, across the 11 months of the interruption that fall after the waiting period?',
            given: {}, expr: '#t1-p1 * 11', format: 'usd', answer: '$27,390.00',
            reasoning: '11 months of $2,490.00. The 24-month maximum is not reached, so it plays no part in this claim.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure the shortfall and attribute it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total shortfall between the income lost and the benefit paid?',
            given: {}, expr: '#t1-p2 - #t1-p4', format: 'usd', answer: '$30,710.00',
            reasoning: '$58,100.00 of lost income against $27,390.00 of benefit.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of the lost income does the policy replace? Give one decimal place.',
            given: {}, expr: 'round(#t1-p4 / #t1-p2 * 100, 1)', format: 'percent1', answer: '47.1%',
            reasoning: '$27,390.00 of $58,100.00 — well under the 60% the policy quotes, because the waiting period pays nothing.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the shortfall is caused by the waiting period alone?',
            given: {}, expr: '#t1-p3', format: 'usd', answer: '$12,450.00',
            reasoning: 'The three unpaid months. This portion would exist even if the policy replaced 100% of income afterwards.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the shortfall is caused by the benefit replacing only 60% rather than all of the income?',
            given: {}, expr: '#t2-p1 - #t2-p3', format: 'usd', answer: '$18,260.00',
            reasoning: '$30,710.00 of shortfall less the $12,450.00 from the waiting period — the remainder is the 40% of income the policy never replaces across the 11 paid months.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'months',
            text: 'How many months of the $2,490.00 benefit would be needed to cover the waiting-period loss? Give one decimal place.',
            given: {}, expr: 'round(#t1-p3 / #t1-p1, 1)', format: 'dec1', answer: '5.0',
            reasoning: '$12,450.00 against a monthly benefit of $2,490.00 — a three-month wait costs five months of benefit, which is why a reserve has to cover the waiting period rather than the policy.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The policy quotes 60% replacement and delivers 47.1%. Explain why the two figures differ, say which of the policy’s terms a household should size its reserve against, and how large that reserve would need to be.',
            acceptableAnswerCriteria: [
              'Explains that the 60% applies only to the months after the waiting period, so three unpaid months at $4,150 pull the realised replacement down to 47.1%.',
              'Identifies the waiting period as the term the reserve must cover, since the policy pays nothing during it whatever the interruption turns out to be.',
              'States the reserve size as at least $12,450.00, the full three months of income.',
            ],
            evidenceRequirements: [
              'Cites the 47.1% realised replacement against the 60% quoted, and the $12,450.00 waiting-period loss.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response explains the gap between quoted and realised replacement, not just that a gap exists.',
              'The reserve figure is derived from the waiting period rather than picked.',
              'A response noting that a longer interruption would push the realised share closer to 60% is reading the mechanism correctly.',
            ],
            commonMisconception: 'Reading a quoted replacement percentage as the share of a whole interruption that will be replaced.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'A shorter waiting period would cost a higher premium. Using the figures, say what a household would be buying and how it should decide whether the shorter wait is worth it.',
            acceptableAnswerCriteria: [
              'States what is bought: each month removed from the waiting period is worth $2,490.00 of benefit in a claim of this length.',
              'Describes the decision method: compare the extra annual premium against that benefit weighted by how likely a claim is, and against whether the household has a reserve able to cover the wait.',
            ],
            evidenceRequirements: [
              'Uses the $2,490.00 monthly benefit or the $12,450.00 waiting-period loss when valuing the shorter wait.',
            ],
            dimensions: ['tradeoff-defense', 'transfer'],
            lookFors: [
              'The response weights the benefit by the chance of claiming rather than comparing it to the premium directly.',
              'The response connects the decision to whether a reserve already covers the wait.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the total benefit comes out at $34,860.00, the waiting period is being paid. The policy pays nothing for the first 3 months, so only 11 of the 14 months attract a benefit. Draw the 14 months as a row of boxes, cross out the first three, and count the boxes that remain before multiplying.',
    extension: 'Recompute the realised replacement share for an interruption lasting 30 months, and say why the 24-month maximum now matters when it did not before.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l06',
    grade: 11, unit: 6, day: 6,
    actor: 'Emmerich Grzeskowiak-Toure, a fictional case reviewer studying a written scam transcript',
    objective: 'Analyse a written record of a fictional escalating scam, quantify what stopping at each stage would have saved, and evaluate a recovery procedure against what it can actually recover.',
    scenario: 'Emmerich Grzeskowiak-Toure is reviewing a written transcript of a fictional scam, prepared for training. Everything below is invented and already concluded. This lesson is analysis of a written record only: it involves no contact with anyone, no real message, no account, and no credential of any kind.',
    materials: ['calculator', 'the fictional transcript summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'In the fictional transcript the escalation ran in four stages. Stage 1 was contact claiming a prize, costing nothing. Stage 2 was a $250 "verification fee". Stage 3 was a $1,900 "release fee". Stage 4 was a $6,400 transfer described as a "tax deposit". Each stage was justified by the one before it.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What was lost in total across all four stages?',
            given: { stage2: 250, stage3: 1900, stage4: 6400 }, expr: 'stage2 + stage3 + stage4', format: 'usd', answer: '$8,550.00',
            reasoning: '$250, $1,900, and $6,400 — stage 1 cost nothing, which is exactly what makes it hard to recognise as the start of anything.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much would stopping after stage 2 have saved?',
            given: { stage3b: 1900, stage4b: 6400 }, expr: 'stage3b + stage4b', format: 'usd', answer: '$8,300.00',
            reasoning: 'The $1,900 and $6,400 that came later. The first payment is the smallest and the one after which almost all the loss is still avoidable.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the total loss would stopping after stage 2 have avoided? Give one decimal place.',
            given: {}, expr: 'round(#t1-p2 / #t1-p1 * 100, 1)', format: 'percent1', answer: '97.1%',
            reasoning: '$8,300.00 of the $8,550.00 total — the escalation puts almost all of the money at the end, after the target has already paid something.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'ratio',
            text: 'How many times larger was the stage-4 payment than the stage-2 payment? Give two decimal places.',
            given: { stage4c: 6400, stage2c: 250 }, expr: 'round(stage4c / stage2c, 2)', format: 'dec2', answer: '25.60',
            reasoning: '$6,400 against $250 — the request grows by more than twenty-five times across three steps, each one small relative to the last.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The fictional recovery procedure in the transcript recovered 35% of the stage-4 transfer because it was reported within 48 hours, and nothing from the two earlier payments.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much was recovered under the procedure?',
            given: { stage4d: 6400, recoveryRate: 0.35 }, expr: 'round(stage4d * recoveryRate, 2)', format: 'usd', answer: '$2,240.00',
            reasoning: '35% of the $6,400 transfer. The two earlier payments were not recoverable under this procedure.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What was the net loss after the recovery?',
            given: {}, expr: '#t1-p1 - #t2-p1', format: 'usd', answer: '$6,310.00',
            reasoning: '$8,550.00 lost against $2,240.00 recovered.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the total loss was recovered? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p1 * 100, 1)', format: 'percent1', answer: '26.2%',
            reasoning: '$2,240.00 of $8,550.00 — recovery is real but partial, and it applied only to the most recent payment.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more would have been kept by stopping after stage 2 than by the recovery procedure?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$6,060.00',
            reasoning: '$8,300.00 avoided by stopping against $2,240.00 recovered afterwards — recognising the pattern early is worth nearly four times what the best recovery achieved.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which stage of the fictional escalation was the most valuable point at which to stop?',
            choices: [
              'After stage 1, before any money moved',
              'After stage 2, once $250 had been paid',
              'After stage 3, once $2,150 had been paid',
            ],
            given: {},
            answer: 'After stage 1, before any money moved',
            reasoning: 'Stopping at stage 1 avoids the entire $8,550.00, while stopping after stage 2 still avoids $8,300.00 and stopping after stage 3 avoids only the $6,400 stage-4 transfer; every later stopping point costs everything already paid.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences. Write only about the fictional transcript.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The escalation put 97.1% of the loss after the first payment. Explain why an escalating structure works that way, and describe the check a person could apply at stage 2 that does not depend on knowing anything about the specific claim being made.',
            acceptableAnswerCriteria: [
              'Explains that a small first payment makes the target invested in the outcome, so each later and larger request is judged against money already spent rather than on its own.',
              'Describes a general check that needs no knowledge of the claim — for example that a genuine prize or refund is never conditional on the recipient sending money first, or verifying through a channel the person finds independently rather than one supplied in the message.',
              'Notes that the check is worth applying precisely because it works without evaluating the story.',
            ],
            evidenceRequirements: [
              'Cites the 97.1% figure or the $8,300.00 still avoidable after stage 2.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies prior investment as the mechanism rather than describing the target as gullible.',
              'The proposed check is structural and does not require judging whether the story is true.',
              'The response does not suggest engaging with the sender to test them.',
            ],
            commonMisconception: 'Believing that money already paid is a reason to continue rather than a sunk cost.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The recovery procedure returned 26.2% of the total and depended on reporting within 48 hours. Say what that tells you about how recovery procedures should be treated in a protection plan.',
            acceptableAnswerCriteria: [
              'States that recovery is partial and time-limited, so it should be treated as a last resort rather than as protection that makes prevention less important.',
              'Draws the practical point that knowing where and how quickly to report is itself part of the plan, since the $2,240.00 depended entirely on the 48-hour window being met.',
            ],
            evidenceRequirements: [
              'Refers to the $2,240.00 recovered and the 48-hour condition attached to it.',
            ],
            dimensions: ['plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats recovery as a partial backstop, not as insurance.',
              'The response identifies preparation — knowing the procedure in advance — as the actionable part.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the amount saved by stopping after stage 2 comes out at $8,550.00, the $250 already paid is being counted as avoided. Stopping after a payment does not undo it: the $250 is gone, and what is avoided is the $1,900 and $6,400 that would have followed. List the four stages in order and draw the line after stage 2 before adding anything.',
    extension: 'Work out what recovery rate applied to the whole $8,550.00 would have matched the amount saved by stopping after stage 2, and say whether any recovery procedure could plausibly achieve it.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l07',
    grade: 11, unit: 6, day: 7,
    actor: 'Antonia Sepulveda-Njie, a fictional reviewer auditing a risk ranking',
    objective: 'Diagnose a fictional risk register that ranks by likelihood, recompute the ranking by expected loss, and identify the decision the error would have produced.',
    scenario: 'Antonia Sepulveda-Njie is auditing the simulated risk register below. The risks, figures, and the register’s conclusion are invented for this exercise.',
    materials: ['calculator', 'the fictional risk register in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The register lists three risks for a fictional household: a bicycle theft at a 28% chance costing $1,150; a basement flood at a 5% chance costing $9,400; and a boiler failure at a 11% chance costing $3,700. The register ranks them by likelihood and concludes: "Protect the bicycle first — it is by far the most likely loss."',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from bicycle theft?',
            given: { bikeChance: 0.28, bikeCost: 1150 }, expr: 'round(bikeChance * bikeCost, 2)', format: 'usd', answer: '$322.00',
            reasoning: '28% of $1,150 — much the most likely of the three risks.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from a basement flood?',
            given: { floodChance: 0.05, floodCost: 9400 }, expr: 'round(floodChance * floodCost, 2)', format: 'usd', answer: '$470.00',
            reasoning: '5% of $9,400 — the least likely risk and, as it turns out, the largest expected loss.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from a boiler failure?',
            given: { boilerChance: 0.11, boilerCost: 3700 }, expr: 'round(boilerChance * boilerCost, 2)', format: 'usd', answer: '$407.00',
            reasoning: '11% of $3,700 — the middle risk on both likelihood and expected loss.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now rank by expected loss and measure the register’s error.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total expected annual loss across the three risks?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'usd', answer: '$1,199.00',
            reasoning: '$322.00, $470.00, and $407.00 together.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much larger is the flood’s expected loss than the bicycle’s?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$148.00',
            reasoning: '$470.00 against $322.00 — the risk the register ranked last carries $148.00 a year more exposure than the one it ranked first.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the total expected loss does the bicycle risk represent? Give one decimal place.',
            given: {}, expr: 'round(#t1-p1 / #t2-p1 * 100, 1)', format: 'percent1', answer: '26.9%',
            reasoning: '$322.00 of $1,199.00 — the smallest of the three shares, on the risk the register said to protect first.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'ratio',
            text: 'How many times more likely is the bicycle theft than the flood? Give two decimal places.',
            given: { bikeChance2: 0.28, floodChance2: 0.05 }, expr: 'round(bikeChance2 / floodChance2, 2)', format: 'dec2', answer: '5.60',
            reasoning: '28% against 5% — the register was right that the bicycle risk is far more likely, and wrong that this makes it the priority.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which risk should be protected first, ranked by expected annual loss?',
            choices: ['The bicycle theft', 'The basement flood', 'The boiler failure'],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t1-p3', ifTrue: 'The basement flood', ifFalse: 'The boiler failure' },
            answer: 'The basement flood',
            reasoning: '$470.00 from the flood against $407.00 from the boiler and $322.00 from the bicycle — the ranking by expected loss exactly reverses the register’s ranking by likelihood.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Every figure in the register is correct and its conclusion is the reverse of the right one. Explain how that happened, and give the one column the register needed to add.',
            acceptableAnswerCriteria: [
              'Identifies the defect as ranking on one dimension of risk when risk has two: the register recorded both likelihood and severity but sorted on likelihood alone.',
              'Names the missing column as expected loss, the product of the two, and shows it reverses the order to flood, boiler, bicycle.',
              'Notes that the register was not wrong about the bicycle being 5.60 times more likely; it was wrong about what that establishes.',
            ],
            evidenceRequirements: [
              'Cites the $470.00 flood expected loss against the $322.00 bicycle expected loss.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response separates a true observation from an unsupported conclusion.',
              'The missing column is named precisely rather than described as "more analysis".',
              'The response does not claim any of the register’s figures were miscalculated.',
            ],
            commonMisconception: 'Treating the most frequent risk as the most important one.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The three expected losses are $322.00, $407.00, and $470.00 — close together. Say what that closeness means for how confident the corrected ranking should be, and what else should inform the decision.',
            acceptableAnswerCriteria: [
              'Observes that the three are within $148.00 of each other, so small errors in the likelihood or severity estimates could reorder them.',
              'Names another factor that should inform the decision, most defensibly whether the household could absorb the $9,400 flood loss, which no expected-loss figure captures.',
            ],
            evidenceRequirements: [
              'Refers to the $148.00 gap between the largest and smallest expected losses.',
            ],
            dimensions: ['communication-of-uncertainty', 'plan-coherence'],
            lookFors: [
              'The response treats a narrow ranking as weak evidence rather than as a result.',
              'The additional factor named is about survivability rather than about refining the estimates.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the corrected ranking still puts the bicycle first, likelihood is still doing the sorting. Expected loss is the chance multiplied by the cost: 28% of $1,150 is $322.00, while 5% of $9,400 is $470.00. Add a fourth column to the register holding these products, and sort on that column alone.',
    extension: 'Find the bicycle replacement cost at which its expected loss would exceed the flood’s, and say whether that cost is plausible for a bicycle.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l08',
    grade: 11, unit: 6, day: 8,
    actor: 'Caspian Obiora-Halstead, a fictional adviser allocating a small enterprise’s protection budget',
    objective: 'Transfer the protection-budget method to a fictional enterprise where one uncovered risk exceeds the whole enterprise, and say what that changes about the ranking.',
    scenario: 'Caspian Obiora-Halstead advises a fictional two-person enterprise on its protection budget. The risks, premiums, deductibles, and budget below are invented for this exercise.',
    materials: ['calculator', 'the fictional enterprise risk table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The budget is $3,200 a year. Equipment cover costs $1,450, has a $5,000 deductible, and the risk is a 7% chance of a $52,000 loss. Stock cover costs $890, has a $750 deductible, and the risk is a 15% chance of a $9,800 loss. Liability cover costs $1,620, has a $10,000 deductible, and the risk is a 3% chance of a $120,000 loss.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does the equipment cover remove?',
            given: { equipChance: 0.07, equipLoss: 52000, equipDeductible: 5000 },
            expr: 'round(equipChance * (equipLoss - equipDeductible), 2)', format: 'usd', answer: '$3,290.00',
            reasoning: '7% of the $47,000 above the deductible.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does the stock cover remove?',
            given: { stockChance: 0.15, stockLoss: 9800, stockDeductible: 750 },
            expr: 'round(stockChance * (stockLoss - stockDeductible), 2)', format: 'usd', answer: '$1,357.50',
            reasoning: '15% of the $9,050 above the deductible — the most frequent risk and the smallest reduction.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What expected annual loss does the liability cover remove?',
            given: { liabChance: 0.03, liabLoss: 120000, liabDeductible: 10000 },
            expr: 'round(liabChance * (liabLoss - liabDeductible), 2)', format: 'usd', answer: '$3,300.00',
            reasoning: '3% of the $110,000 above the deductible — the rarest risk and the largest reduction.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now rank by reduction per premium dollar and allocate the $3,200 budget.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'ratio',
            text: 'How much expected loss does the equipment cover remove per premium dollar? Give two decimal places.',
            given: { equipPremium: 1450 }, expr: 'round(#t1-p1 / equipPremium, 2)', format: 'dec2', answer: '2.27',
            reasoning: '$3,290.00 of reduction for $1,450 of premium — the best value of the three.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'ratio',
            text: 'How much does the liability cover remove per premium dollar? Give two decimal places.',
            given: { liabPremium: 1620 }, expr: 'round(#t1-p3 / liabPremium, 2)', format: 'dec2', answer: '2.04',
            reasoning: '$3,300.00 of reduction for $1,620 of premium — slightly worse value than the equipment cover despite removing more.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'ratio',
            text: 'How much does the stock cover remove per premium dollar? Give two decimal places.',
            given: { stockPremium: 890 }, expr: 'round(#t1-p2 / stockPremium, 2)', format: 'dec2', answer: '1.53',
            reasoning: '$1,357.50 of reduction for $890 of premium — the weakest of the three on this measure.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Taking the two best-value covers, equipment then liability, what do the premiums come to?',
            given: { equipPremium2: 1450, liabPremium2: 1620 }, expr: 'equipPremium2 + liabPremium2', format: 'usd', answer: '$3,070.00',
            reasoning: '$1,450 and $1,620 — within the $3,200 budget, with the stock cover left unbought.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much of the budget is left, and how far short is it of the stock premium?',
            given: { budget: 3200 }, expr: 'budget - #t2-p4', format: 'usd', answer: '$130.00',
            reasoning: '$3,200 less $3,070.00. The remaining $130.00 is far short of the $890 the stock cover costs.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'What total expected annual loss do the two purchased covers remove?',
            given: {}, expr: '#t1-p1 + #t1-p3', format: 'usd', answer: '$6,590.00',
            reasoning: '$3,290.00 and $3,300.00, bought for $3,070.00 of premium — the enterprise removes more expected loss than it spends.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The same per-dollar method used for a household is applied here to an enterprise. Say what carries over unchanged, and explain why the $120,000 liability risk deserves separate treatment even though it ranks second on the measure.',
            acceptableAnswerCriteria: [
              'States what carries over: expected loss is still chance multiplied by the amount above the deductible, and per-dollar ranking still allows policies with different premiums to be compared.',
              'Explains why liability is different in kind: a $120,000 loss is larger than the enterprise could survive, so leaving it uncovered risks the whole operation rather than a bad year.',
              'Notes that the per-dollar measure treats a survivable loss and a fatal one identically, which is precisely why it cannot be the only input.',
            ],
            evidenceRequirements: [
              'Cites the 2.27 and 2.04 per-dollar figures and the $120,000 liability loss.',
            ],
            dimensions: ['transfer', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response identifies survivability as the dimension the measure omits.',
              'The response says what carries over as well as what does not.',
              'A response arguing liability should be bought first regardless of the ratio is making the intended argument.',
            ],
            commonMisconception: 'Applying a value-for-money ranking to risks whose consequences differ in kind.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The stock cover goes unbought and stock is the most likely loss at 15%. Say what the enterprise is accepting, and what it could do with the $130.00 left over.',
            acceptableAnswerCriteria: [
              'States what is accepted: a 15% annual chance of a $9,800 loss, of which $1,357.50 of expected cost is now carried rather than transferred.',
              'Proposes a use for the $130.00 with a reason, such as beginning a reserve against the stock risk or against the $5,000 and $10,000 deductibles now carried.',
            ],
            evidenceRequirements: [
              'Refers to the $1,357.50 reduction forgone and the $130.00 remaining.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense'],
            lookFors: [
              'The response notices that the two purchased covers carry large deductibles that are themselves uncovered exposure.',
              'The proposed use is connected to a named risk.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the two best-value covers come out as liability and stock, check the per-dollar figures rather than the reduction amounts. Liability removes the most in dollars, at $3,300.00, but equipment removes more per premium dollar, at 2.27 against 2.04. Rank on the ratio column, then work down it until the budget runs out.',
    extension: 'Find the equipment premium at which the enterprise could afford all three covers within $3,200, and say how much reduction that would add.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l09',
    grade: 11, unit: 6, day: 9,
    actor: 'Georgiana Petrossian-Abara, a fictional planner building towards self-insurance',
    objective: 'Combine the self-insurance comparison with a growing reserve to find when a fictional household could safely drop a policy, and identify what the transition depends on.',
    scenario: 'Georgiana Petrossian-Abara is planning a fictional household’s move from buying cover to carrying a risk itself. The risk, policy, and reserve figures below are invented for this exercise.',
    materials: ['calculator', 'the fictional risk, policy, and reserve figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The risk is a 5% chance of a $7,600 loss in a year. The policy costs $620 a year with a $1,200 deductible. The household holds a reserve of $2,400 which grows 2.8% a year. Round to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss if the household carries the risk itself?',
            given: { chance: 0.05, loss: 7600 }, expr: 'round(chance * loss, 2)', format: 'usd', answer: '$380.00',
            reasoning: '5% of $7,600 — the average annual cost of carrying the risk unprotected.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual cost of holding the policy, counting the premium and the expected deductible?',
            given: { premium: 620, chance2: 0.05, deductible: 1200 },
            expr: 'round(premium + chance2 * deductible, 2)', format: 'usd', answer: '$680.00',
            reasoning: '$620 every year plus 5% of the $1,200 deductible, which is only paid in the years a loss occurs.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does the household save each year in expected terms by carrying the risk itself?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$300.00',
            reasoning: '$680.00 with the policy against $380.00 without — the annual value of the transition, once it is safe to make.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now follow the reserve and test when the transition becomes safe.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the $2,400 reserve worth after 5 years at 2.8% a year?',
            given: { reserve: 2400, growth: 0.028 }, expr: 'round(reserve * pow(1 + growth, 5), 2)', format: 'usd', answer: '$2,755.35',
            reasoning: 'Five years of compounding at 2.8% — growth alone moves the reserve very little against a $7,600 risk.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How far short of the $7,600 loss would the reserve still be after those 5 years?',
            given: { loss2: 7600 }, expr: 'loss2 - #t2-p1', format: 'usd', answer: '$4,844.65',
            reasoning: '$7,600 against $2,755.35 — growth on its own does not get the household to self-insurance.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the household also set aside the $300.00 annual saving for each of the 5 years, ignoring interest on those additions, what would the reserve hold?',
            given: {}, expr: '#t2-p1 + #t1-p3 * 5', format: 'usd', answer: '$4,255.35',
            reasoning: '$2,755.35 of grown reserve plus $1,500.00 of additions. Ignoring interest on the additions understates the result slightly and is a stated simplification.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How far short of the $7,600 loss is that?',
            given: { loss3: 7600 }, expr: 'loss3 - #t2-p3', format: 'usd', answer: '$3,344.65',
            reasoning: '$7,600 against $4,255.35 — even with the saving added, the household is not yet able to absorb the loss after five years.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Can the household safely drop the policy after 5 years on these figures?',
            choices: ['Yes, the reserve covers the loss', 'No, the reserve is still short of the loss'],
            given: { loss4: 7600 },
            decision: { left: '#t2-p3', cmp: '>=', right: 'loss4', ifTrue: 'Yes, the reserve covers the loss', ifFalse: 'No, the reserve is still short of the loss' },
            answer: 'No, the reserve is still short of the loss',
            reasoning: 'The reserve reaches $4,255.35 against a $7,600 loss, leaving $3,344.65 uncovered — the saving is real but the transition is not yet safe.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'There is a middle course: keep the policy but raise the deductible to $2,400, which the reserve already covers, cutting the premium to $455. What is the expected annual cost of that version?',
            given: { newPremium: 455, chance3: 0.05, newDeductible: 2400 },
            expr: 'round(newPremium + chance3 * newDeductible, 2)', format: 'usd', answer: '$575.00',
            reasoning: '$455 of premium plus 5% of the $2,400 deductible — cheaper than the original policy and still protected against the part of the loss the reserve cannot absorb.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend what this household should do now. Use the three options — keep the policy, drop it, or raise the deductible — and say what condition would have to be met before dropping it entirely.',
            acceptableAnswerCriteria: [
              'Rules out dropping the policy on the figures, since the reserve reaches only $4,255.35 against a $7,600 loss.',
              'Makes a recommendation between keeping the policy at $680.00 expected cost and raising the deductible to reach $575.00, and justifies it against what the reserve can actually absorb.',
              'States the condition for dropping the policy entirely: a reserve able to absorb the full $7,600 without disrupting the rest of the plan.',
            ],
            evidenceRequirements: [
              'Cites the $4,255.35 five-year reserve, the $7,600 loss, and at least two of the three expected annual costs.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The recommendation matches the deductible to what the reserve can genuinely cover.',
              'Either of the two viable options is acceptable if the reasoning ties the deductible to the reserve.',
              'A response noting that the raised deductible converts part of the risk to self-insurance is describing the mechanism correctly.',
            ],
            commonMisconception: 'Treating the choice between insuring and self-insuring as all or nothing.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The reserve grew by only $355.35 in five years while the additions contributed $1,500.00. Say what that shows about how a reserve of this size is built, and name one risk in relying on the $300.00 saving.',
            acceptableAnswerCriteria: [
              'States that contributions rather than growth build a reserve at this scale, since 2.8% on $2,400 is small against the amounts needed.',
              'Names a risk in relying on the saving, such as it only existing if the money is actually set aside, or a loss occurring during the five years and consuming the reserve.',
            ],
            evidenceRequirements: [
              'Compares the $355.35 of growth against the $1,500.00 of additions.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The comparison between growth and contributions is made numerically.',
              'The risk named is specific to this plan rather than general.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the policy looks cheaper than self-insuring, check that the $1,200 deductible is being weighted by the 5% chance rather than added in full. The deductible is only paid in the years a loss occurs, so it contributes $60.00 to the expected cost and not $1,200. Write the premium as a certain cost and the deductible as a chance-weighted one before comparing anything.',
    extension: 'Find how many years of the $300.00 saving, on top of the growing reserve, would be needed before the household could absorb the whole $7,600 loss.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u06-l10',
    grade: 11, unit: 6, day: 10,
    actor: 'Thelonius Vandermeer-Ekwueme, a fictional claimant working three policies against one loss',
    objective: 'Compute what three fictional policies pay in sequence against a single large loss, locate every remaining gap, and defend a recommendation about what to change.',
    scenario: 'Thelonius Vandermeer-Ekwueme is working a fictional claim against three simulated policies. All losses, deductibles, limits, and premiums below are invented for this performance task.',
    materials: ['calculator', 'the fictional policy terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A single covered loss of $26,700 has occurred. Policy A applies first, with a $2,000 deductible and a $15,000 limit. Policy B applies to what Policy A leaves, with a $500 deductible and a $7,000 limit. Policy C applies to what Policy B leaves, with no deductible and a $3,000 limit. Apply each policy’s deductible before its limit.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does Policy A pay?',
            given: { loss: 26700, deductibleA: 2000, limitA: 15000 },
            expr: 'min(max(loss - deductibleA, 0), limitA)', format: 'usd', answer: '$15,000.00',
            reasoning: '$24,700 remains after the $2,000 deductible, which is above the $15,000 limit, so the limit caps the payment.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the loss remains after Policy A has paid?',
            given: { loss2: 26700 }, expr: 'loss2 - #t1-p1', format: 'usd', answer: '$11,700.00',
            reasoning: '$26,700 less $15,000.00 — the $2,000 deductible and the $9,700 that sat above Policy A’s limit.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does Policy B pay, against what remains?',
            given: { deductibleB: 500, limitB: 7000 },
            expr: 'min(max(#t1-p2 - deductibleB, 0), limitB)', format: 'usd', answer: '$7,000.00',
            reasoning: '$11,200.00 remains after Policy B’s $500 deductible, which is above its $7,000 limit, so the limit caps this payment too.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much of the loss remains after Policy B has paid?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$4,700.00',
            reasoning: '$11,700.00 less the $7,000.00 Policy B paid — this is what Policy C is asked to cover, and it is above Policy C’s limit.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Finish the claim and account for every dollar.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does Policy C pay, against what remains?',
            given: { limitC: 3000 }, expr: 'min(#t1-p4, limitC)', format: 'usd', answer: '$3,000.00',
            reasoning: '$4,700.00 remains and Policy C caps at $3,000, so it pays its maximum.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does Thelonius pay out of pocket?',
            given: { loss3: 26700 }, expr: 'loss3 - #t1-p1 - #t1-p3 - #t2-p1', format: 'usd', answer: '$1,700.00',
            reasoning: '$26,700 less $15,000.00, $7,000.00, and $3,000.00 from the three policies.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much did the three policies pay between them?',
            given: {}, expr: '#t1-p1 + #t1-p3 + #t2-p1', format: 'usd', answer: '$25,000.00',
            reasoning: '$15,000.00, $7,000.00, and $3,000.00 — exactly the sum of the three limits, which is what happens when every policy is capped.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'percent',
            text: 'What share of the loss was covered? Give one decimal place.',
            given: { loss4: 26700 }, expr: 'round(#t2-p3 / loss4 * 100, 1)', format: 'percent1', answer: '93.6%',
            reasoning: '$25,000.00 of $26,700 — a claim in which all three policies paid their maximum still left 6.4% with the holder.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'The three annual premiums are $1,180, $430, and $295. What do they come to?',
            given: { premiumA: 1180, premiumB: 430, premiumC: 295 },
            expr: 'premiumA + premiumB + premiumC', format: 'usd', answer: '$1,905.00',
            reasoning: 'The annual cost of the arrangement that left $1,700.00 uncovered on this claim.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'ratio',
            text: 'How many times the annual premium total is the amount the three policies paid? Give two decimal places.',
            given: {}, expr: 'round(#t2-p3 / #t2-p5, 2)', format: 'dec2', answer: '13.12',
            reasoning: '$25,000.00 paid against $1,905.00 of annual premium — the return on this particular claim, which says nothing about whether the arrangement is well designed.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One check before the recommendation.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the largest loss this arrangement could fully cover?',
            given: { limitA2: 15000, limitB2: 7000, limitC2: 3000 },
            expr: 'limitA2 + limitB2 + limitC2', format: 'usd', answer: '$25,000.00',
            reasoning: 'The three limits total $25,000. The deductibles do not add capacity: each layer applies to whatever the previous one leaves, so a deductible taken by one policy is passed down and absorbed by the next while capacity remains. Above $25,000 every further dollar is the holder’s.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which single change would have covered this $26,700 loss in full?',
            choices: [
              'Raising Policy C’s limit from $3,000 to $4,700',
              'Removing Policy A’s $2,000 deductible',
              'Raising Policy A’s limit from $15,000 to $15,800',
            ],
            given: {},
            answer: 'Raising Policy C’s limit from $3,000 to $4,700',
            reasoning: 'Policy C was asked for $4,700.00 and capped at $3,000, so lifting its limit to $4,700 covers the whole remainder; removing Policy A’s deductible pushes more loss into a policy already at its limit, and raising Policy A’s limit only to $15,800 still leaves $900.00 outstanding, because Policies B and C remain capped.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your recommendation. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one change to this arrangement. State what it would have cost on this claim, what it would cost in a year with no claim, and why you chose it over the alternatives.',
            acceptableAnswerCriteria: [
              'Identifies that all three policies paid their limits, so the binding constraint is total limit rather than any single deductible.',
              'Names a specific change with its effect on this claim, such as lifting Policy C’s limit to cover the $4,700.00 it was asked for, and acknowledges it would raise the $1,905.00 annual premium.',
              'Explains why the chosen change beats the alternatives, using the fact that moving loss between policies that are already capped changes nothing.',
            ],
            evidenceRequirements: [
              'Cites the $25,000.00 total paid, the $1,700.00 left uncovered, and the $1,905.00 of annual premium.',
              'Refers to the $25,000.00 largest fully covered loss when describing what the arrangement can handle.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response recognises that every policy was capped, which is what makes deductible changes ineffective here.',
              'The cost of the change is acknowledged, not just its benefit.',
              'A response arguing that a $1,700.00 gap is acceptable and the premium should not rise is defensible if it says what makes that gap absorbable.',
            ],
            commonMisconception: 'Assuming a gap in a layered arrangement can always be closed by adjusting a deductible.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The policies paid 13.12 times the annual premium on this claim. Say why that figure is a poor measure of whether the arrangement is worth holding, and what would be a better one.',
            acceptableAnswerCriteria: [
              'Explains that the figure describes one claim that did happen, and says nothing about the years in which no claim occurs, so it cannot measure the arrangement’s value.',
              'Proposes a better measure, such as the expected annual loss removed against the $1,905.00 premium, or whether the holder could absorb the uncovered amount.',
            ],
            evidenceRequirements: [
              'Refers to the 13.12 ratio and the $1,905.00 annual premium when explaining what the figure does and does not measure.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies selection on a claim that occurred as the problem.',
              'The proposed measure is one that could actually be computed from the kind of figures used in this unit.',
            ],
            commonMisconception: 'Judging insurance by the payout received on a claim that happened to occur.',
          },
        ],
      },
    ],
    remediation: 'If the three policies appear to cover the whole loss, check that each limit is being applied to what its own policy was asked to pay. Policy B receives $11,700.00, takes its $500 deductible, and is then capped at $7,000 — it does not pay the remaining $4,200. Write four lines for each policy: amount received, less deductible, capped at limit, amount passed on.',
    extension: 'Recompute the whole claim for a loss of $14,000 instead, and say why the arrangement covers the whole of it, deductibles included.',
  },
]
