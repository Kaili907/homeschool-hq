import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 6 — PF6 Protecting and Insuring: Naming Risk and Deciding
 * What to Do About It.
 */
export const g09u06: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u06-l01',
    grade: 9, unit: 6, day: 1,
    actor: 'a fictional household naming four risks it faces',
    objective: 'Compute the expected annual loss for four fictional risks from their stated probability and size, and rank them by expected loss rather than by how alarming each sounds.',
    scenario: 'The four risks below belong to a fictional household in a simulated year. Every probability and loss amount is invented for this exercise.',
    materials: ['calculator', 'the fictional risk table in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional risks, each with a chance of happening in a year and the loss it would cause. A cracked phone screen: 22% chance, $180 loss. Three months out of work: 6% chance, $4,440 loss. A major dental bill: 11% chance, $1,250 loss. Cleaning up after identity theft: 4% chance, $890 loss. Expected loss is the chance multiplied by the loss.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from the cracked phone screen?',
            given: { pPhone: 0.22, lossPhone: 180 }, expr: 'pPhone * lossPhone', format: 'usd', answer: '$39.60',
            reasoning: '22% of $180 is the amount this risk costs on average across many years.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from three months out of work?',
            given: { pJob: 0.06, lossJob: 4440 }, expr: 'pJob * lossJob', format: 'usd', answer: '$266.40',
            reasoning: '6% of $4,440 — the lowest chance but one, and by far the largest expected loss.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from the major dental bill?',
            given: { pDental: 0.11, lossDental: 1250 }, expr: 'pDental * lossDental', format: 'usd', answer: '$137.50',
            reasoning: 'An 11% chance of a $1,250 dental bill gives $137.50 of expected annual loss.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual loss from identity theft cleanup?',
            given: { pId: 0.04, lossId: 890 }, expr: 'pId * lossId', format: 'usd', answer: '$35.60',
            reasoning: 'A 4% chance of an $890 cleanup gives $35.60 of expected annual loss.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now rank and total.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the household’s total expected loss across all four risks?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3 + #t1-p4', format: 'usd', answer: '$479.10',
            reasoning: '$39.60 + $266.40 + $137.50 + $35.60.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Which risk has the highest expected annual loss?',
            choices: ['The cracked phone screen', 'Three months out of work', 'The major dental bill', 'Identity theft cleanup'],
            given: {},
            decision: { left: '#t1-p2', cmp: '>', right: '#t1-p3', ifTrue: 'Three months out of work', ifFalse: 'The major dental bill' },
            answer: 'Three months out of work',
            reasoning: '$266.40 is the largest of the four, though the job risk is also the second least likely to happen in any given year.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which risk is most likely to happen in a given year?',
            choices: ['The cracked phone screen', 'Three months out of work', 'The major dental bill', 'Identity theft cleanup'],
            given: { pPhone2: 0.22, pDental2: 0.11 },
            decision: { left: 'pPhone2', cmp: '>', right: 'pDental2', ifTrue: 'The cracked phone screen', ifFalse: 'The major dental bill' },
            answer: 'The cracked phone screen',
            reasoning: 'At 22% the phone screen is the most frequent risk and, at $39.60, the second smallest by expected loss.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The most likely risk and the most costly risk are different ones. Explain what that means for which risk the household should plan for first, and say why expected loss alone is not enough to decide.',
            acceptableAnswerCriteria: [
              'States that the phone screen happens most often at 22% but costs least in expectation at $39.60, while the job loss is rare at 6% and largest in expectation at $266.40.',
              'Argues that the job risk deserves attention first because a $4,440 loss could exceed what the household can absorb, whatever its expected value.',
              'Names what expected loss leaves out: the size of the worst case relative to what the household can survive.',
            ],
            evidenceRequirements: [
              'Uses at least two expected-loss figures and at least one raw loss amount.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes frequency from severity explicitly.',
              'The response does not conclude that the household should simply set aside $479.10.',
            ],
            commonMisconception: 'Ranking risks by how often they happen rather than by what they would cost.',
          },
        ],
      },
    ],
    remediation: 'If expected loss is being read as the amount the household will lose, work one risk aloud: in 100 simulated years the phone breaks in about 22 of them at $180 each, which averages $39.60 a year — an amount that is never actually lost in any single year.',
    extension: 'Add a fifth fictional risk with a 1% chance and a $30,000 loss, compute its expected loss, and say where it belongs in the ranking and why that placement is uncomfortable.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l02',
    grade: 9, unit: 6, day: 2,
    actor: 'a fictional cyclist choosing among three responses to one risk',
    objective: 'Price the three standard responses to a single fictional risk — accept it, reduce it, transfer it — and show that the cheapest in expectation is not always the right choice.',
    scenario: 'A fictional cyclist faces a simulated 15% annual chance of the bicycle being stolen, at a loss of $620. The lock, the policy, and all figures below are invented for this exercise.',
    materials: ['calculator', 'the three fictional options in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Accept the risk: do nothing and bear the loss if it happens. Reduce it: a $70 lock cuts the annual chance from 15% to 5%. Transfer it: a policy costs $85 a year and pays the loss less a $100 deductible.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does accepting the risk cost per year in expectation?',
            given: { pTheft: 0.15, loss: 620 }, expr: 'pTheft * loss', format: 'usd', answer: '$93.00',
            reasoning: '15% of $620, with nothing spent in advance.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does reducing the risk cost per year in expectation, counting the lock?',
            given: { pReduced: 0.05, loss2: 620, lock: 70 }, expr: 'pReduced * loss2 + lock', format: 'usd', answer: '$101.00',
            reasoning: '$70 spent for certain, plus a 5% chance of the $620 loss, which is $31.00 in expectation.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does transferring the risk cost per year in expectation, counting the deductible?',
            given: { premium: 85, pTheft2: 0.15, deductible: 100 }, expr: 'premium + pTheft2 * deductible', format: 'usd', answer: '$100.00',
            reasoning: '$85 of premium for certain, plus a 15% chance of paying the $100 deductible.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Expected cost is only one of the two things that matter. Now look at the worst case each option allows.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the worst single-year cost of accepting the risk?',
            given: { loss3: 620 }, expr: 'loss3', format: 'usd', answer: '$620.00',
            reasoning: 'If the bicycle is stolen the whole $620 falls on the cyclist at once.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the worst single-year cost of transferring the risk?',
            given: { premium2: 85, deductible2: 100 }, expr: 'premium2 + deductible2', format: 'usd', answer: '$185.00',
            reasoning: 'The premium is paid either way and the deductible is the most the cyclist pays on a claim.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which option is cheapest in expected annual cost?',
            choices: ['Accept the risk', 'Reduce the risk with the lock', 'Transfer the risk with the policy'],
            given: {},
            decision: { left: '#t1-p1', cmp: '<', right: '#t1-p3', ifTrue: 'Accept the risk', ifFalse: 'Transfer the risk with the policy' },
            answer: 'Accept the risk',
            reasoning: 'Accepting costs $93.00 in expectation against $100.00 to transfer and $101.00 to reduce — the three are within $8 of each other.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The three options cost almost the same in expectation but differ sharply in their worst case. Recommend one for a cyclist who has $150 in savings, and defend it against the option with the lowest expected cost.',
            acceptableAnswerCriteria: [
              'Recognises the three expected costs are effectively tied, at $93.00, $100.00, and $101.00, so expected cost cannot decide the question.',
              'Applies the $150 savings constraint: a $620 loss cannot be absorbed, while $185 can, which points away from accepting the risk.',
              'Defends the recommendation against the $93.00 option directly rather than ignoring it.',
            ],
            evidenceRequirements: [
              'Uses at least two expected costs and both worst-case figures, $620.00 and $185.00.',
            ],
            dimensions: ['tradeoff-defense', 'criteria-application', 'plan-coherence'],
            lookFors: [
              'The response treats the $7 expected-cost difference as too small to decide anything.',
              'A recommendation to reduce with the lock is acceptable if it addresses the worst case, which the lock does not remove.',
            ],
            commonMisconception: 'Choosing among risk responses on expected cost alone when the worst cases differ by hundreds of dollars.',
          },
        ],
      },
    ],
    remediation: 'If the reduce option comes out cheapest, check whether the $70 lock was included. The lock is paid whether or not the bicycle is stolen, so it is added in full, not multiplied by any probability.',
    extension: 'Find the lock price at which reducing becomes the cheapest option in expectation, and say whether that changes the worst-case argument.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l03',
    grade: 9, unit: 6, day: 3,
    actor: 'a fictional insurance pool of 400 households',
    objective: 'Compute the arithmetic of a fictional insurance pool — total expected losses, cost per member, premium income, and margin — and explain how a premium transfers risk.',
    scenario: 'A fictional insurer covers 400 simulated households against one risk. The probability, loss, and premium below are invented for this exercise.',
    materials: ['calculator', 'the fictional pool figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Each of the 400 fictional households has a 2% chance in a year of a $9,000 loss. The insurer charges each household a premium of $225 a year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What total loss does the insurer expect to pay across the whole pool in a year?',
            given: { households: 400, p: 0.02, loss: 9000 }, expr: 'households * p * loss', format: 'usd', answer: '$72,000.00',
            reasoning: '400 households, each with a 2% chance of a $9,000 loss, which is about 8 claims a year.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected loss per household?',
            given: { households2: 400 }, expr: '#t1-p1 / households2', format: 'usd', answer: '$180.00',
            reasoning: '$72,000 of expected claims spread over 400 households.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the insurer collect in premiums across the pool?',
            given: { households3: 400, premium: 225 }, expr: 'households3 * premium', format: 'usd', answer: '$90,000.00',
            reasoning: 'Premium income across the pool: 400 households at $225 each.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look at the difference between what is collected and what is expected to be paid.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the insurer’s expected margin across the pool?',
            given: {}, expr: '#t1-p3 - #t1-p1', format: 'usd', answer: '$18,000.00',
            reasoning: '$90,000 collected against $72,000 of expected claims.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage of premium income is that margin? Round to one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p3 * 100, 1)', format: 'percent1', answer: '20.0%',
            reasoning: '$18,000 of $90,000 collected, which covers administration, the risk that claims exceed expectation, and profit.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does each household’s premium exceed its own expected loss?',
            given: { premium2: 225 }, expr: 'premium2 - #t1-p2', format: 'usd', answer: '$45.00',
            reasoning: '$225 paid against $180 of expected loss.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Every household pays $45 a year more than its own expected loss, and buying the policy is still rational for most of them. Explain why, and say what kind of household it would not be rational for.',
            acceptableAnswerCriteria: [
              'Explains that the $45 buys the removal of a $9,000 possibility, which most households could not absorb in one year.',
              'States that the insurer can carry the risk because 400 pooled households produce a predictable total, while one household faces an unpredictable single outcome.',
              'Identifies the household for whom it is not rational: one wealthy enough that a $9,000 loss is absorbable, for whom the $45 buys nothing it needs.',
            ],
            evidenceRequirements: [
              'Uses the $180 expected loss, the $225 premium, and the $9,000 loss amount.',
            ],
            dimensions: ['reasoning-from-figures', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies pooling as the mechanism that makes the total predictable.',
              'The response does not describe the $18,000 margin as the insurer cheating the pool.',
            ],
            commonMisconception: 'Concluding that insurance is a bad deal because the premium exceeds the expected loss, which it must for the insurer to exist.',
          },
        ],
      },
    ],
    remediation: 'If the expected loss per household comes out as $9,000 or as $72,000, work the pool total first and divide only at the end. The chain is 400 households, 2% of them claiming, $9,000 each, then divided back across all 400.',
    extension: 'Recompute the pool if only 40 households join instead of 400, and say what happens to how predictable the insurer’s total claims are.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l04',
    grade: 9, unit: 6, day: 4,
    actor: 'a fictional policyholder applying three policy terms to two claims',
    objective: 'Apply a fictional policy’s premium, deductible, and coverage limit to two claims of different sizes, and identify which term binds in each case.',
    scenario: 'The simulated policy below has a premium, a deductible, and a coverage limit. Both claims are invented for this exercise, and no real policy is described.',
    materials: ['calculator', 'the fictional policy terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional policy: premium $58 a month, deductible $750 per claim, coverage limit $12,000. The insurer pays the loss less the deductible, up to the limit.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the policy cost in premiums over a year?',
            given: { premium: 58 }, expr: 'premium * 12', format: 'usd', answer: '$696.00',
            reasoning: '$58 a month for twelve months, paid whether or not a claim is made.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'On a $4,300 claim, how much does the insurer pay?',
            given: { claim1: 4300, deductible: 750 }, expr: 'min(claim1 - deductible, 12000)', format: 'usd', answer: '$3,550.00',
            reasoning: '$4,300 less the $750 deductible is $3,550, which is below the $12,000 limit, so the limit does not bind.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'On that $4,300 claim, how much does the policyholder pay?',
            given: { claim1b: 4300 }, expr: 'claim1b - #t1-p2', format: 'usd', answer: '$750.00',
            reasoning: 'The policyholder pays exactly the deductible when the loss is under the limit.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now a much larger claim: $19,000.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'On a $19,000 claim, how much does the insurer pay?',
            given: { claim2: 19000, deductible2: 750, limit: 12000 }, expr: 'min(claim2 - deductible2, limit)', format: 'usd', answer: '$12,000.00',
            reasoning: '$19,000 less $750 is $18,250, which exceeds the $12,000 limit, so the limit caps the payment.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'On that claim, how much does the policyholder pay?',
            given: { claim2b: 19000 }, expr: 'claim2b - #t2-p1', format: 'usd', answer: '$7,000.00',
            reasoning: '$19,000 of loss less the $12,000 the insurer pays.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which policy term decided the policyholder’s cost on the $19,000 claim?',
            choices: ['The premium', 'The deductible', 'The coverage limit'],
            given: { claim2c: 19000, deductible3: 750, limit2: 12000 },
            decision: { left: 'claim2c - deductible3', cmp: '>', right: 'limit2', ifTrue: 'The coverage limit', ifFalse: 'The deductible' },
            answer: 'The coverage limit',
            reasoning: 'Once the loss less the deductible exceeds $12,000, every further dollar of loss falls on the policyholder, so the limit and not the deductible sets the cost.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The policyholder paid $750 on one claim and $7,000 on another. Explain which term protected them in each case, and say what question they should ask about the limit before renewing.',
            acceptableAnswerCriteria: [
              'States that the deductible set the cost on the smaller claim while the coverage limit set it on the larger one.',
              'Explains that a limit turns a policy into partial protection above a certain loss, so the policyholder still carries the tail.',
              'Poses a checkable renewal question: what would it cost to replace the insured thing in full, and is $12,000 above that figure.',
            ],
            evidenceRequirements: [
              'Uses both policyholder costs, $750.00 and $7,000.00, and the $12,000 limit.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response recognises that a higher limit would cost more in premium, so the question is a tradeoff and not an oversight.',
              'The response does not describe the limit as a hidden term; it was disclosed.',
            ],
            commonMisconception: 'Reading a deductible as the most a policyholder can ever pay on a claim.',
          },
        ],
      },
    ],
    remediation: 'If the insurer’s payment on the large claim comes out as $18,250, the limit has been skipped. Compute the uncapped figure first, then compare it with $12,000 and take the smaller — that comparison is what a coverage limit does.',
    extension: 'Find the claim size at which the coverage limit first begins to bind, and state it as a rule in terms of the deductible and the limit.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l05',
    grade: 9, unit: 6, day: 5,
    actor: 'a fictional person cleaning up after a simulated data breach',
    objective: 'Price the cost of recovering from a fictional identity theft, compare it with the cost of two safeguards, and decide which safeguard is worth its price.',
    scenario: 'A fictional person’s details appear in a simulated data breach. The cleanup costs and the safeguard prices below are invented for this exercise. Nothing here asks for or refers to any real personal information.',
    materials: ['calculator', 'the fictional cleanup and safeguard figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional cleanup takes 26 hours of the person’s own time, of which 6 hours are taken from paid work at $17.20 an hour. Fees for certified post and replacement documents come to $145. The chance of a breach leading to this kind of cleanup in a year is 4%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What are the lost wages from the 6 hours taken from paid work?',
            given: { hoursLost: 6, wage: 17.2 }, expr: 'hoursLost * wage', format: 'usd', answer: '$103.20',
            reasoning: '6 hours at $17.20 an hour, the only part of the 26 hours with a direct dollar price.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total out-of-pocket and lost-wage cost of one cleanup?',
            given: { fees: 145 }, expr: '#t1-p1 + fees', format: 'usd', answer: '$248.20',
            reasoning: '$103.20 of lost wages plus $145 of fees — and 20 further hours that cost time but no money.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual cost of this risk at a 4% chance?',
            given: { pBreach: 0.04 }, expr: 'round(#t1-p2 * pBreach, 2)', format: 'usd', answer: '$9.93',
            reasoning: 'A 4% annual chance of the $248.20 cleanup gives $9.93 of expected cost.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Two safeguards are available. A credit freeze costs nothing and blocks new accounts from being opened. A monitoring service costs $14.99 a month and alerts the person after something has already happened.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the monitoring service cost for a year?',
            given: { monthly: 14.99 }, expr: 'round(monthly * 12, 2)', format: 'usd', answer: '$179.88',
            reasoning: '$14.99 a month for twelve months.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Compared with the expected annual cost of the risk, is the monitoring service worth its price on these figures alone?',
            choices: ['Yes, it costs less than the expected loss', 'No, it costs more than the expected loss'],
            given: {},
            decision: { left: '#t2-p1', cmp: '<', right: '#t1-p3', ifTrue: 'Yes, it costs less than the expected loss', ifFalse: 'No, it costs more than the expected loss' },
            answer: 'No, it costs more than the expected loss',
            reasoning: '$179.88 a year against an expected loss of $9.93 — the service costs about eighteen times the risk it addresses, on these figures.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does the monitoring service cost than the expected annual loss?',
            given: {}, expr: '#t2-p1 - #t1-p3', format: 'usd', answer: '$169.95',
            reasoning: 'The $179.88 annual monitoring cost against the $9.93 expected annual loss.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The free safeguard prevents the loss and the paid one reports it afterwards. Explain why that difference matters more than the price, and name two figures in this lesson that a real decision would need but that the calculation above does not contain.',
            acceptableAnswerCriteria: [
              'States that a freeze reduces the probability of the loss occurring while monitoring reduces neither the probability nor the size, only the delay in finding out.',
              'Uses the $179.88 against $9.93 comparison but does not rest the whole argument on it.',
              'Names two genuine gaps — the 20 unpaid hours have no price attached, and the 4% probability is an assumption that could be far wrong for a particular person.',
            ],
            evidenceRequirements: [
              'Uses the $248.20 cleanup cost and the $179.88 annual monitoring cost.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The response values the 20 unpaid hours as a real cost even though the calculation prices them at zero.',
              'The response does not conclude that monitoring services are worthless in general from one fictional figure.',
            ],
            commonMisconception: 'Treating a service that detects a problem as though it prevented the problem.',
          },
        ],
      },
    ],
    remediation: 'If all 26 hours are being priced at $17.20, reread the directions: only 6 of them were taken from paid work. The other 20 are a real cost with no dollar figure attached, which is worth naming rather than inventing a number for.',
    extension: 'Price all 26 hours at the $17.20 wage, recompute the comparison, and say whether that changes the conclusion about the monitoring service.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l06',
    grade: 9, unit: 6, day: 6,
    actor: 'a fictional recipient comparing two invented approach messages',
    objective: 'Compare two fictional messages against a checklist of pressure tactics, compute what compliance would cost in each case, and identify the single feature that marks both as fraudulent.',
    scenario: 'The two simulated messages below arrived to a fictional person. Both are invented for this exercise. No real organisation, number, or account is involved, and no learner should act on any similar message.',
    materials: ['the two fictional messages in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'Message 1 claims to be from a utility, says service will be cut off within 30 minutes, and demands payment of $500 on each of 3 gift cards. Message 2 says the recipient has won $8,500 and must send a $395 processing fee to release it.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much would complying with Message 1 cost?',
            given: { perCard: 500, cards: 3 }, expr: 'perCard * cards', format: 'usd', answer: '$1,500.00',
            reasoning: '3 gift cards at $500 each, none of which is recoverable once the codes are shared.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Message 2 promises $8,500 for a $395 fee. What is the recipient’s actual net outcome if they pay?',
            given: { fee: 395 }, expr: '0 - fee', format: 'usd', answer: '-$395.00',
            reasoning: 'The advertised $8,500 does not exist, so the whole outcome is the fee paid out and nothing received.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Check each message against four markers of a fraudulent approach: manufactured urgency, an untraceable payment method, an unsolicited prize, and a demand for payment before anything is received.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Which marker is present in both messages?',
            choices: [
              'Manufactured urgency',
              'A demand for payment before anything is received',
              'An unsolicited prize',
              'A request for gift cards specifically',
            ],
            answer: 'A demand for payment before anything is received',
            reasoning: 'Only Message 1 sets a 30-minute deadline, only Message 2 offers a prize, and only Message 1 names gift cards — but both require money to move before the recipient gets anything.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'A real utility with an overdue balance would normally do which of these?',
            choices: [
              'Demand gift cards within 30 minutes',
              'Send written notice in advance and offer standard payment channels',
              'Offer a prize for prompt payment',
              'Call from an unlisted number and refuse to identify the account',
            ],
            answer: 'Send written notice in advance and offer standard payment channels',
            reasoning: 'The distinguishing feature of the fictional message is not that it asks for money but that it removes every normal way of verifying the claim before paying.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Compare the two costs.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more would complying with Message 1 cost than with Message 2?',
            given: { fee2: 395 }, expr: '#t1-p1 - fee2', format: 'usd', answer: '$1,105.00',
            reasoning: '$1,500 against $395, though both losses are total.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Write the single check you would run on any message of this kind before responding, and explain why it works on both of these messages even though their stories are opposite — one threatens a loss and one promises a gain.',
            acceptableAnswerCriteria: [
              'Proposes one concrete, runnable check: contact the organisation independently using a number or address the recipient already had, not one supplied in the message.',
              'Explains that the check works on both because both depend on the recipient not verifying before money moves, whatever story is used to prevent verification.',
              'Notes that urgency and prizes are the mechanisms for suppressing that check, not the fraud itself.',
            ],
            evidenceRequirements: [
              'Refers to specific features of both messages — the 30-minute deadline and the $395 advance fee.',
            ],
            dimensions: ['criteria-application', 'transfer', 'error-diagnosis'],
            lookFors: [
              'The check named would work on a message the learner has never seen before.',
              'The response does not rely on spotting bad spelling or an odd address, which a careful fraud will not provide.',
            ],
            commonMisconception: 'Learning the surface features of particular scams rather than the structural feature they share.',
          },
        ],
      },
    ],
    remediation: 'If Message 2 seems less serious because $395 is smaller than $1,500, note what is received in each case: nothing. Both are total losses, and the smaller one is often the opening move rather than the whole of it.',
    extension: 'Write a third fictional message that carries none of the four markers and would still be fraudulent, then say which check would still catch it.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l07',
    grade: 9, unit: 6, day: 7,
    actor: 'a fictional renter who thought their possessions were not worth insuring',
    objective: 'Find the error in a fictional judgement that possessions are not worth insuring, build the inventory that corrects it, and compare the corrected figure with a premium.',
    scenario: 'A fictional renter wrote: "I do not need renters insurance — my stuff is not worth much, maybe $900 all in." The simulated inventory below is what the possessions actually come to.',
    materials: ['the fictional inventory in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional inventory, at replacement cost: laptop $640, phone $410, bicycle $285, clothes $700, kitchen items $240, textbooks $320, furniture $480. The renter estimated the total at $900. A fictional policy costs $13 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total replacement cost of the inventory?',
            given: { laptop: 640, phone: 410, bike: 285, clothes: 700, kitchen: 240, books: 320, furniture: 480 },
            expr: 'laptop + phone + bike + clothes + kitchen + books + furniture', format: 'usd', answer: '$3,075.00',
            reasoning: 'The seven listed items added at replacement cost.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'By how much did the renter’s estimate of $900 understate the total?',
            given: { estimate: 900 }, expr: '#t1-p1 - estimate', format: 'usd', answer: '$2,175.00',
            reasoning: '$3,075 of replacement cost against a $900 guess.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the fictional policy cost for a year?',
            given: { premium: 13 }, expr: 'premium * 12', format: 'usd', answer: '$156.00',
            reasoning: '$13 a month for twelve months.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Locate the error and test the judgement.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'What was wrong with the renter’s reasoning?',
            choices: [
              'The premium; $13 a month is more than they said',
              'The estimate; an unlisted guess at total value was far below the itemised total',
              'The arithmetic; the items do not add to $3,075',
              'Nothing; $900 of possessions is not worth insuring',
            ],
            answer: 'The estimate; an unlisted guess at total value was far below the itemised total',
            reasoning: 'The renter never wrote the items down, and estimating a total without listing it produced a figure less than a third of the real one.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'How many years of premiums would it take to equal the replacement cost of the inventory? Round to one decimal place.',
            given: {}, expr: 'round(#t1-p1 / #t1-p3, 1)', format: 'dec1', answer: '19.7',
            reasoning: '$3,075 of possessions against $156 a year of premium.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why estimating a total without listing the items produced such a large error, and say what the corrected figures do and do not settle about whether to buy the policy.',
            acceptableAnswerCriteria: [
              'Explains that an unlisted estimate recalls a few large items and omits the many small ones, and here the clothes and furniture alone come to $1,180 — more than the whole guess.',
              'States that the corrected $3,075 changes the size of the risk but does not by itself decide the purchase.',
              'Names what is still needed: the chance of a loss, whether the policy covers these items at replacement cost, and what deductible applies.',
            ],
            evidenceRequirements: [
              'Uses the $3,075 total, the $900 estimate, and the $156 annual premium.',
            ],
            dimensions: ['error-diagnosis', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response does not conclude the policy is obviously worth buying from the inventory alone.',
              'The response identifies listing as the fix, not simply guessing higher.',
            ],
            commonMisconception: 'Judging the value of what you own by what comes to mind rather than by an itemised list.',
          },
        ],
      },
    ],
    remediation: 'If the total feels too high, read the list back and ask what each item would cost to buy again today. Replacement cost is the relevant figure for insurance, and it is usually well above what the owner remembers paying.',
    extension: 'Add a $750 deductible to the fictional policy and recompute what the renter would actually receive after a total loss, then revisit the judgement.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l08',
    grade: 9, unit: 6, day: 8,
    actor: 'a fictional vehicle owner applying the accept-reduce-transfer method',
    objective: 'Apply the accept, reduce, or transfer method to a new fictional risk where the answer differs from the earlier case, and say what changed to make it differ.',
    scenario: 'A fictional vehicle owner faces a simulated 8% annual chance of a $2,600 mechanical failure. The maintenance plan and the warranty below are invented for this exercise.',
    materials: ['calculator', 'the three fictional options in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Accept: bear the $2,600 if it happens. Reduce: a $220 annual maintenance plan cuts the chance from 8% to 3%. Transfer: an extended warranty costs $180 a year and pays the repair less a $150 deductible.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual cost of accepting the risk?',
            given: { pFail: 0.08, loss: 2600 }, expr: 'pFail * loss', format: 'usd', answer: '$208.00',
            reasoning: 'An 8% annual chance of a $2,600 mechanical failure gives $208.00 of expected cost.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual cost of reducing the risk?',
            given: { pReduced: 0.03, loss2: 2600, plan: 220 }, expr: 'pReduced * loss2 + plan', format: 'usd', answer: '$298.00',
            reasoning: '$220 spent for certain plus a 3% chance of the $2,600 failure, which is $78.00 in expectation.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the expected annual cost of transferring the risk?',
            given: { warranty: 180, pFail2: 0.08, deductible: 150 }, expr: 'warranty + pFail2 * deductible', format: 'usd', answer: '$192.00',
            reasoning: '$180 of warranty premium plus an 8% chance of paying the $150 deductible.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare with the earlier bicycle case, where accepting was cheapest at $93.00 against $100.00 to transfer.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Which option is cheapest here in expected annual cost?',
            choices: ['Accept the risk', 'Reduce the risk with maintenance', 'Transfer the risk with the warranty'],
            given: {},
            decision: { left: '#t1-p3', cmp: '<', right: '#t1-p1', ifTrue: 'Transfer the risk with the warranty', ifFalse: 'Accept the risk' },
            answer: 'Transfer the risk with the warranty',
            reasoning: '$192.00 to transfer against $208.00 to accept and $298.00 to reduce — the opposite ranking from the bicycle case.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the worst single-year cost of transferring here?',
            given: { warranty2: 180, deductible2: 150 }, expr: 'warranty2 + deductible2', format: 'usd', answer: '$330.00',
            reasoning: 'The warranty premium plus the deductible, the most the owner pays in a claim year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much larger is the worst case of accepting than of transferring?',
            given: { loss3: 2600 }, expr: 'loss3 - #t2-p2', format: 'usd', answer: '$2,270.00',
            reasoning: '$2,600 borne alone against $330 with the warranty.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The same three-way method gave "accept" for the bicycle and "transfer" here. Name what changed between the two cases, and state the general rule the pair of cases supports.',
            acceptableAnswerCriteria: [
              'Identifies the changes: the loss is much larger here ($2,600 against $620) while the transfer is priced close to the expected loss, so transferring costs little and removes a lot.',
              'Notes that reducing lost here because $220 of certain spending bought only a five-point fall in probability.',
              'States a general rule the two cases support: transfer when the loss is large relative to what can be absorbed and the premium is close to the expected loss; accept when the loss is small enough to bear.',
            ],
            evidenceRequirements: [
              'Compares at least one figure from each case, such as $93.00 against $208.00, or $620 against $2,600.',
            ],
            dimensions: ['transfer', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response applies the method rather than restating the earlier conclusion.',
              'The response notices that the method did not change; only the inputs did.',
            ],
            commonMisconception: 'Learning the answer to a worked risk case rather than the method that produced it.',
          },
        ],
      },
    ],
    remediation: 'If reducing looks cheapest, check the arithmetic on the maintenance plan: $220 is spent whether or not the failure happens, and it only removes five percentage points of an 8% chance. The certain spending outweighs what it buys.',
    extension: 'Find the maintenance price at which reducing would beat transferring, and say whether that price seems plausible for what it claims to do.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l09',
    grade: 9, unit: 6, day: 9,
    actor: 'a fictional buyer choosing between a low and a high deductible',
    objective: 'Compare two fictional policies that differ only in deductible and premium, find the claim frequency at which they break even, and interpret that frequency.',
    scenario: 'Two simulated policies cover the same fictional risk. They differ only in premium and deductible; both are invented for this exercise.',
    materials: ['calculator', 'the two fictional policy summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Policy L: $42 a month with a $500 deductible. Policy H: $29 a month with a $1,500 deductible. Coverage is otherwise identical.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Policy L cost in premiums for a year?',
            given: { monthlyL: 42 }, expr: 'monthlyL * 12', format: 'usd', answer: '$504.00',
            reasoning: '$42 a month for twelve months.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Policy H cost in premiums for a year?',
            given: { monthlyH: 29 }, expr: 'monthlyH * 12', format: 'usd', answer: '$348.00',
            reasoning: '$29 a month for twelve months.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does Policy H save in premium each year?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$156.00',
            reasoning: '$504.00 against $348.00 — the certain saving Policy H offers.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now bring in the deductibles.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'In a year with exactly one claim, what does Policy L cost in total?',
            given: { deductibleL: 500 }, expr: '#t1-p1 + deductibleL', format: 'usd', answer: '$1,004.00',
            reasoning: '$504.00 of premium plus the $500 deductible on the claim.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'In a year with exactly one claim, what does Policy H cost in total?',
            given: { deductibleH: 1500 }, expr: '#t1-p2 + deductibleH', format: 'usd', answer: '$1,848.00',
            reasoning: '$348.00 of premium plus the $1,500 deductible.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'How many years pass between claims for the two policies to cost the same? Divide the extra deductible by the annual premium saving and round to two decimal places.',
            given: { deductibleL2: 500, deductibleH2: 1500 }, expr: 'round((deductibleH2 - deductibleL2) / #t1-p3, 2)', format: 'dec2', answer: '6.41',
            reasoning: 'The extra $1,000 of deductible is repaid by $156.00 of annual premium saving in 6.41 years, so Policy H wins if claims are less frequent than roughly one every six and a half years.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'State plainly what the 6.41 figure means, and say what a buyer would need to believe about their own claim frequency to choose Policy H — and what they would need in savings to survive that choice.',
            acceptableAnswerCriteria: [
              'Interprets 6.41 as the average years between claims at which the two policies cost the same over the long run.',
              'States that Policy H is better if claims come less often than that, and worse if they come more often.',
              'Notes the separate requirement: Policy H needs $1,500 available at any moment, and the $156 saved a year does not build that quickly.',
            ],
            evidenceRequirements: [
              'Uses the $156.00 annual saving and the $1,000 difference in deductible.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response separates the long-run cost question from the immediate liquidity question.',
              'The response recognises the buyer cannot know their own claim frequency in advance.',
            ],
            commonMisconception: 'Choosing the lower premium without asking whether the higher deductible could be paid on the day it is needed.',
          },
        ],
      },
    ],
    remediation: 'If the break-even comes out near 1, the whole $1,500 deductible is being divided by the premium saving rather than the $1,000 difference between the two deductibles. Only the extra deductible is the price of the cheaper premium.',
    extension: 'Recompute the break-even if Policy H’s premium were $22 a month, and say how much that changes the claim frequency a buyer would have to believe in.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u06-l10',
    grade: 9, unit: 6, day: 10,
    actor: 'a fictional household choosing among three policies with a fixed reserve',
    objective: 'Compute expected annual cost and worst-case exposure for three fictional policies, test each against a stated reserve, and defend a recommendation.',
    scenario: 'A fictional household with $2,000 in reserve is choosing among three simulated policies against a $6,000 loss with an 18% annual chance. All figures are invented for this exercise.',
    materials: ['calculator', 'the three fictional policy summaries in these directions', 'a blank comparison table'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Policy 1: $46 a month, $500 deductible, $15,000 limit. Policy 2: $33 a month, $1,500 deductible, $15,000 limit. Policy 3: $25 a month, $2,500 deductible, $8,000 limit. The loss, if it happens, is $6,000 and the annual chance is 18%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Policy 1’s expected annual cost — premium plus the chance of paying the deductible?',
            given: { m1: 46, p: 0.18, d1: 500 }, expr: 'm1 * 12 + p * d1', format: 'usd', answer: '$642.00',
            reasoning: '$552 of premium plus 18% of the $500 deductible.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Policy 2’s expected annual cost?',
            given: { m2: 33, p2: 0.18, d2: 1500 }, expr: 'm2 * 12 + p2 * d2', format: 'usd', answer: '$666.00',
            reasoning: '$396 of premium plus 18% of the $1,500 deductible.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Policy 3’s expected annual cost?',
            given: { m3: 25, p3: 0.18, d3: 2500 }, expr: 'm3 * 12 + p3 * d3', format: 'usd', answer: '$750.00',
            reasoning: '$300 of premium plus 18% of the $2,500 deductible.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test each against the $2,000 reserve. On a $6,000 loss, the household pays the deductible, or more if the limit binds.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'On a $6,000 loss under Policy 3, how much does the household pay?',
            given: { loss: 6000, d3b: 2500, limit3: 8000 }, expr: 'loss - min(loss - d3b, limit3)', format: 'usd', answer: '$2,500.00',
            reasoning: '$6,000 less $2,500 is $3,500, which is below the $8,000 limit, so the household pays exactly the $2,500 deductible.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Which policy leaves the household unable to cover its own share from the $2,000 reserve?',
            choices: ['Policy 1', 'Policy 2', 'Policy 3', 'None of them'],
            given: { reserve: 2000 },
            decision: { left: '#t2-p1', cmp: '>', right: 'reserve', ifTrue: 'Policy 3', ifFalse: 'None of them' },
            answer: 'Policy 3',
            reasoning: 'Policy 3’s $2,500 deductible exceeds the $2,000 reserve, while Policy 1 at $500 and Policy 2 at $1,500 both sit inside it.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much short of Policy 3’s deductible is the reserve?',
            given: { reserve2: 2000 }, expr: '#t2-p1 - reserve2', format: 'usd', answer: '$500.00',
            reasoning: '$2,500 required against $2,000 available.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the recommendation.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one policy for this household. Use both the expected annual costs and the $2,000 reserve, and say explicitly what your recommendation would be if the reserve were $5,000 instead.',
            acceptableAnswerCriteria: [
              'Rules out Policy 3 on the reserve test, and says so before comparing costs, since its $2,500 deductible cannot be paid.',
              'Compares Policy 1 and Policy 2 on the expected costs, $642.00 and $666.00, and notes the difference is small — $24 a year — so the reserve position carries most of the weight.',
              'Answers the $5,000 counterfactual: with a larger reserve, Policy 3 becomes payable and its $750.00 expected cost can be judged on its merits, though it remains the most expensive of the three in expectation.',
            ],
            evidenceRequirements: [
              'Cites all three expected annual costs and the $2,000 reserve.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response applies the reserve as a screen before the cost comparison rather than as a tiebreaker.',
              'The response notices that the cheapest premium produces the highest expected cost here.',
            ],
            commonMisconception: 'Choosing the policy with the lowest monthly premium without checking whether its deductible is payable.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Policy 3 also has a lower coverage limit than the other two. Say when that would matter and why it did not matter in this comparison.',
            acceptableAnswerCriteria: [
              'States that the $8,000 limit did not bind because the loss was $6,000, so the limit never entered the calculation.',
              'Identifies when it would matter: a loss above about $10,500, where $8,000 of cover stops short of the loss less the deductible.',
            ],
            evidenceRequirements: [
              'Refers to the $8,000 limit and the $6,000 loss.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response recognises that a term can be present without being binding.',
            ],
          },
        ],
      },
    ],
    remediation: 'If all three policies look affordable, check the deductible against the reserve rather than against the premium. The premium is a monthly commitment; the deductible is a single amount that must be available on the day of the loss.',
    extension: 'Add a fourth fictional policy at $38 a month with a $1,000 deductible and a $15,000 limit, place it in both rankings, and say whether it changes the recommendation.',
  },
]
