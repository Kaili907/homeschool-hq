import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 6 — PF6 Protecting and Insuring: Insurance Structures and
 * Identity Protection.
 *
 * The payout rule is the thing this unit exists to teach correctly, and it is
 * stated in the learner-facing directions of every lesson that computes one:
 *
 *     payout = min(covered loss - deductible, coverage limit)
 *
 * The deductible is subtracted from the *loss*, and the coverage limit caps
 * the *payout*. The limit is not reduced by the deductible, and `limit -
 * deductible` is not the payout — l02 computes the size of that error
 * explicitly, and l08 repeats the rule where the deductible is a percentage of
 * the limit rather than a flat amount.
 *
 * It follows that the insured party's own cost is not always the deductible.
 * When the limit binds, the insured pays the deductible *and* everything above
 * the limit; l02, l08, and l10 each carry a case where that happens.
 *
 * Health coverage in l04 uses a different structure again — deductible, then
 * coinsurance, then an out-of-pocket maximum that caps the insured party's
 * total — and the sheet states the order of operations rather than assuming it.
 *
 * Every policy, insurer, premium, limit, and liability schedule here is
 * invented. No real insurer, product, or policy form is described.
 */
export const g10u06: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u06-l01',
    grade: 10, unit: 6, day: 1,
    actor: 'a fictional household holding five kinds of coverage at once',
    objective: 'Total a fictional household’s annual premiums across five coverage types, express each as a share of the total, and compare the cheapest premium against the exposure it stands behind.',
    scenario: 'The five simulated policies below and their premiums are invented for this exercise. No real insurer, product, or household is described.',
    materials: ['calculator', 'the fictional premium schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional household pays these annual premiums: health $2,760, auto $1,344, renters $186, disability $432, and term life $228. Health coverage pays medical bills. Auto covers damage and liability involving the vehicle. Renters covers the household’s own belongings and its liability, not the building. Disability replaces part of an income when illness or injury stops the earner working. Term life pays a stated amount to named survivors if the insured dies during the term.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the five policies cost the household in a year?',
            given: { health: 2760, auto: 1344, renters: 186, disability: 432, life: 228 },
            expr: 'health + auto + renters + disability + life', format: 'usd', answer: '$4,950.00',
            reasoning: 'The five annual premiums added. This is a real claim on the household budget whether or not any claim is ever made.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does that come to per month?',
            given: {}, expr: '#t1-p1 / 12', format: 'usd', answer: '$412.50',
            reasoning: 'The $4,950.00 annual total spread across twelve months, which is how it actually lands in a budget.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of the total does health coverage take?',
            given: { health2: 2760 }, expr: 'health2 / #t1-p1 * 100', format: 'percent2', answer: '55.76%',
            reasoning: 'The $2,760 health premium against the $4,950.00 total — more than half of everything the household spends on protection.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look at the cheapest of the five. The household’s belongings are worth $14,600.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What share of the total does renters coverage take?',
            given: { renters2: 186 }, expr: 'renters2 / #t1-p1 * 100', format: 'percent2', answer: '3.76%',
            reasoning: 'The $186 renters premium against the $4,950.00 total — the smallest line of the five by a wide margin.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does renters coverage cost per month?',
            given: { renters3: 186 }, expr: 'renters3 / 12', format: 'usd', answer: '$15.50',
            reasoning: 'The $186 annual premium across twelve months.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'The belongings are worth $14,600. How many dollars of belongings does each dollar of annual renters premium stand behind? Round to two decimal places.',
            given: { belongings: 14600, renters4: 186 }, expr: 'round(belongings / renters4, 2)', format: 'dec2', answer: '78.49',
            reasoning: '$14,600 of exposure against $186 of annual premium. This ratio says nothing about whether the coverage is good value on its own — it shows only that the cheapest premium of the five stands behind a large exposure.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'If the building the household rents burns down, which of these policies is the one that pays for the household’s own furniture and clothing?',
            choices: ['The landlord’s policy on the building', 'The household’s renters policy', 'The household’s health policy'],
            answer: 'The household’s renters policy',
            reasoning: 'A landlord’s policy covers the building the landlord owns, not a tenant’s possessions. Renters coverage is the only one of the five in this scenario that stands behind the household’s own belongings.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Insurance is worth buying for losses a household could not absorb on its own. Using that test, sort these five coverages into ones that protect against a loss too large to absorb and ones that protect against something else, and say which single coverage you would defend keeping if the household had to drop one.',
            acceptableAnswerCriteria: [
              'Applies the stated test rather than a preference: health, disability, auto liability, and life all stand behind losses large enough that a household would struggle to absorb them from income alone, while the belongings behind the renters policy are the smallest sum on the sheet at $14,600.',
              'Names a coverage to drop and defends it with the loss it protects against — for example that the $14,600 of belongings is the only exposure the sheet puts a number on, and is a sum a household might rebuild over time, where a health or disability loss is not bounded at all.',
              'Recognises that premium size and exposure size are different things: the 3.76% share of the budget says nothing about the size of the risk it stands behind.',
            ],
            evidenceRequirements: [
              'Uses the $4,950.00 annual total and at least two of the individual premium shares.',
            ],
            dimensions: ['criteria-application', 'tradeoff-defense', 'reasoning-from-figures'],
            lookFors: [
              'The response applies the "could not absorb" test to each coverage rather than ranking by price.',
              'Several answers are defensible here; what is scored is whether the exposure behind the chosen coverage is named.',
            ],
            commonMisconception: 'Judging a policy by the size of its premium rather than by the size of the loss it stands behind.',
          },
        ],
      },
    ],
    remediation: 'If renters coverage looks like the obvious thing to drop because it is cheapest, separate the two figures. Its premium is 3.76% of what the household spends on protection, and it stands behind $14,600 of belongings. A cheap premium is a fact about the price, not about the risk.',
    extension: 'Work out what share of the annual total each of the remaining three policies takes, and say whether the ranking by premium matches your ranking by size of exposure.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l02',
    grade: 10, unit: 6, day: 2,
    actor: 'a fictional policyholder working two claims against one set of policy terms',
    objective: 'Apply a fictional policy’s stated payout rule to a loss below the limit and a loss above it, and compute exactly how much a common shortcut misstates the payout.',
    scenario: 'The simulated auto policy below is invented for this exercise. Read its payout rule carefully: the deductible is subtracted from the loss, and the coverage limit caps what the policy pays. The limit is not reduced by the deductible.',
    materials: ['calculator', 'the fictional policy terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional collision coverage has a limit of $15,000 and a deductible of $1,000, and the annual premium is $1,344. The policy pays the covered loss minus the deductible, up to but not beyond the limit. Start with a loss of $6,400.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'On a $6,400 loss, what does the policy pay?',
            given: { lossA: 6400, deductible: 1000, limit: 15000 }, expr: 'min(lossA - deductible, limit)', format: 'usd', answer: '$5,400.00',
            reasoning: 'The $1,000 deductible comes off the $6,400 loss, leaving $5,400.00, which is below the $15,000 limit, so the limit does not bind and the whole remainder is paid.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the policyholder pay on that loss?',
            given: { lossA2: 6400 }, expr: 'lossA2 - #t1-p1', format: 'usd', answer: '$1,000.00',
            reasoning: 'The $6,400 loss less the $5,400.00 paid. Here the policyholder’s cost equals the deductible exactly — which is true only because the limit did not bind.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now take a loss of $18,500 against the same policy, and apply the same rule.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'On an $18,500 loss, what does the policy pay?',
            given: { lossB: 18500, deductible2: 1000, limit2: 15000 }, expr: 'min(lossB - deductible2, limit2)', format: 'usd', answer: '$15,000.00',
            reasoning: 'The $1,000 deductible comes off the $18,500 loss, leaving $17,500. That exceeds the $15,000 limit, so the limit binds and the policy pays $15,000.00 — the full limit, not the limit less the deductible.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the policyholder pay on that loss?',
            given: { lossB2: 18500 }, expr: 'lossB2 - #t2-p1', format: 'usd', answer: '$3,500.00',
            reasoning: 'The $18,500 loss less the $15,000.00 paid. This is three and a half times the deductible, because once the limit binds the policyholder carries the deductible and everything above the limit.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'A common shortcut says "the most you can get is the limit minus the deductible." On this $18,500 loss, by how much does that shortcut understate what the policy actually pays?',
            given: { deductible3: 1000, limit3: 15000 }, expr: '#t2-p1 - (limit3 - deductible3)', format: 'usd', answer: '$1,000.00',
            reasoning: 'The policy pays $15,000.00; the shortcut gives $14,000. The shortcut subtracts the deductible twice — once from the loss, where it belongs, and once from the limit, where it does not — so it is always wrong by the deductible whenever the limit binds.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'In a year with the $6,400 loss, what does the policyholder pay in total, counting the premium?',
            given: { premium: 1344, deductible4: 1000 }, expr: 'premium + deductible4', format: 'usd', answer: '$2,344.00',
            reasoning: 'The $1,344 annual premium plus the $1,000 the policyholder bore on the claim. The premium is owed whether or not a claim happens, so the true cost of a claim year includes it.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'On which of the two losses is the policyholder’s own cost equal to the deductible?',
            choices: ['On the $6,400 loss only', 'On the $18,500 loss only', 'On both losses'],
            given: {},
            decision: { left: '#t1-p2', cmp: '<', right: '#t2-p2', ifTrue: 'On the $6,400 loss only', ifFalse: 'On both losses' },
            answer: 'On the $6,400 loss only',
            reasoning: 'The policyholder paid $1,000.00 on the smaller loss and $3,500.00 on the larger one. A deductible sets the policyholder’s cost only while the loss stays within the limit.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write the policy’s payout rule as one sentence a person could apply to any loss. Then explain why "my deductible is $1,000, so a claim can never cost me more than $1,000" is false, and say which of the two policy terms a person should check first when deciding whether coverage is enough.',
            acceptableAnswerCriteria: [
              'States the rule correctly and generally: subtract the deductible from the loss, then pay that amount up to the coverage limit, never more than the limit.',
              'Explains the falsehood using the $18,500 case: once the limit binds, the policyholder carries the deductible plus everything above the limit, which came to $3,500.00 here.',
              'Argues that the coverage limit should be checked first against the largest plausible loss, since the deductible only controls the policyholder’s cost while the limit is not reached.',
            ],
            evidenceRequirements: [
              'Uses the $5,400.00 and $15,000.00 payouts and both of the policyholder’s own costs.',
            ],
            dimensions: ['criteria-application', 'error-diagnosis', 'reasoning-from-figures'],
            lookFors: [
              'The response states the rule in a form that would give the right answer on a loss it has not seen.',
              'The response identifies the limit rather than the deductible as the term that decides whether a large loss is survivable.',
            ],
            commonMisconception: 'Reading a deductible as a ceiling on what a claim can cost the policyholder.',
          },
        ],
      },
    ],
    remediation: 'If the $18,500 claim comes out as $14,000, the deductible is being taken off the limit as well as off the loss. Take it off once, from the loss: $18,500 less $1,000 is $17,500. Then cap that at the limit, which pays $15,000.00. The limit is a ceiling on the payment, not an amount the deductible is deducted from.',
    extension: 'Find the largest loss on which this policyholder’s own cost is still exactly $1,000, and say what that figure tells you about where the limit starts to matter.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l03',
    grade: 10, unit: 6, day: 3,
    actor: 'a fictional renter choosing between two coverage limits for the same belongings',
    objective: 'Inventory a fictional renter’s exposure, compute what each of two coverage limits pays in a total loss, and compare the gap in payout with the gap in premium.',
    scenario: 'The simulated belongings inventory and the two simulated renters policies below are invented for this exercise. Both policies pay the covered loss minus the deductible, up to the coverage limit.',
    materials: ['calculator', 'the fictional inventory and policy options in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional renter lists their belongings: electronics $2,400, furniture $3,100, clothing $1,800, kitchen items $900, and a bicycle $650. Two simulated policies are available, both with a $500 deductible. Option 1 has a coverage limit of $6,000 and an annual premium of $220. Option 2 has a coverage limit of $10,000 and an annual premium of $290. Consider a fire that destroys everything on the list.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the renter’s total exposure — the value of everything on the list?',
            given: { electronics: 2400, furniture: 3100, clothing: 1800, kitchen: 900, bike: 650 },
            expr: 'electronics + furniture + clothing + kitchen + bike', format: 'usd', answer: '$8,850.00',
            reasoning: 'The five categories added. Doing this inventory before choosing a limit is what makes the choice a measurement rather than a guess.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'In the total loss, what does Option 1 pay?',
            given: { limit1: 6000, ded: 500 }, expr: 'min(#t1-p1 - ded, limit1)', format: 'usd', answer: '$6,000.00',
            reasoning: 'The $500 deductible off the $8,850.00 loss leaves $8,350, which exceeds the $6,000 limit, so the limit binds and Option 1 pays $6,000.00.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the renter bear under Option 1?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$2,850.00',
            reasoning: 'The $8,850.00 loss less the $6,000.00 paid — nearly six times the $500 deductible, because the limit was set below the exposure.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for Option 2 and compare the two.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'In the same total loss, what does Option 2 pay?',
            given: { limit2: 10000, ded2: 500 }, expr: 'min(#t1-p1 - ded2, limit2)', format: 'usd', answer: '$8,350.00',
            reasoning: 'The $500 deductible off the $8,850.00 loss leaves $8,350.00, which is below the $10,000 limit, so the limit does not bind and the whole remainder is paid.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the renter bear under Option 2?',
            given: {}, expr: '#t1-p1 - #t2-p1', format: 'usd', answer: '$500.00',
            reasoning: 'Exactly the deductible, because the limit is above the exposure. This is what a correctly sized limit does.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does Option 2 pay in this loss?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$2,350.00',
            reasoning: '$8,350.00 against $6,000.00 — the difference the higher limit makes on this particular loss, and it exists only because the exposure is above $6,000.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much more does Option 2 cost in annual premium?',
            given: { prem1: 220, prem2: 290 }, expr: 'prem2 - prem1', format: 'usd', answer: '$70.00',
            reasoning: '$290 against $220. The comparison the renter has to make is this $70.00 a year against the $2,350.00 it would pay in a total loss, weighted by how likely such a loss is.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Option 2 costs $70.00 more a year and pays $2,350.00 more in a total loss. Explain how a renter should decide between them without knowing whether a fire will happen, and say what would have to change about the inventory for Option 1 to become the better fit.',
            acceptableAnswerCriteria: [
              'Frames the decision around the size of the loss the renter could absorb unaided rather than around whether a fire is expected: bearing $2,850.00 unexpectedly is the risk Option 1 leaves open.',
              'States what would change the answer: an inventory worth less than about $6,500, so that the $6,000 limit covers the loss after the deductible and the extra premium buys nothing.',
              'Notes that the $70.00 is paid every year while the $2,350.00 arrives only in a total loss, so the comparison depends on how likely such a loss is and on how badly it would land.',
            ],
            evidenceRequirements: [
              'Uses the $8,850.00 exposure, both payouts, and the $70.00 premium difference.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response ties the limit to the measured inventory rather than to a general preference for more or less coverage.',
              'The response recognises that a limit above the exposure buys nothing extra, so more coverage is not automatically better.',
            ],
            commonMisconception: 'Choosing a coverage limit by what feels affordable rather than by measuring the exposure it has to stand behind.',
          },
        ],
      },
    ],
    remediation: 'If Option 1 leaves the renter paying $500, the limit has not been applied. The deductible comes off first, leaving $8,350, and Option 1 will not pay more than its $6,000 limit. The renter bears the difference, $2,850.00, which is what an under-sized limit actually costs.',
    extension: 'Find the coverage limit at which Option 1 and Option 2 would pay the same amount in this loss, and say how a renter could keep a limit correctly sized as they acquire more belongings.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l04',
    grade: 10, unit: 6, day: 4,
    actor: 'a fictional patient following one year of charges through a health plan',
    objective: 'Work a fictional health plan’s deductible, coinsurance, and out-of-pocket maximum in the stated order, and find the charge level at which the maximum takes over.',
    scenario: 'The simulated health plan below is invented for this exercise. Apply its terms in the stated order: the patient pays the deductible first, then a stated share of what remains, and the out-of-pocket maximum caps the patient’s total for the year. This is a different structure from the property policies earlier in the unit, where a coverage limit capped what the insurer paid.',
    materials: ['calculator', 'the fictional plan terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the fictional plan, the patient pays the first $1,800 of covered charges. After that the patient pays 20% of covered charges and the plan pays the rest. Once the patient’s payments for the year reach the out-of-pocket maximum of $5,400, the plan pays everything further. A simulated year brings $24,000 of covered charges.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'After the deductible is met, how much of the year’s charges remain?',
            given: { charges: 24000, ded: 1800 }, expr: 'charges - ded', format: 'usd', answer: '$22,200.00',
            reasoning: '$24,000 of charges less the first $1,800, which the patient pays in full.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the patient’s 20% share of that remainder?',
            given: { coins: 0.2 }, expr: '#t1-p1 * coins', format: 'usd', answer: '$4,440.00',
            reasoning: '20% of the $22,200.00 remaining after the deductible. The plan is responsible for the other 80%.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Adding the deductible, what would the patient owe before the maximum is considered?',
            given: { ded2: 1800 }, expr: 'ded2 + #t1-p2', format: 'usd', answer: '$6,240.00',
            reasoning: 'The $1,800 deductible plus the $4,440.00 coinsurance share. This figure is above the plan’s stated maximum, which is what the next step handles.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now apply the out-of-pocket maximum, and find where it starts to bind.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the patient actually pay for the year?',
            given: { oopMax: 5400 }, expr: 'min(#t1-p3, oopMax)', format: 'usd', answer: '$5,400.00',
            reasoning: 'The $6,240.00 the deductible and coinsurance would have produced, capped at the $5,400 maximum. The maximum is a ceiling on the patient, which is the mirror image of a coverage limit being a ceiling on the insurer.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the plan pay for the year?',
            given: { charges2: 24000 }, expr: 'charges2 - #t2-p1', format: 'usd', answer: '$18,600.00',
            reasoning: 'The $24,000 of covered charges less the $5,400.00 the patient paid.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'At what level of covered charges does the patient first reach the out-of-pocket maximum?',
            given: { oopMax2: 5400, ded3: 1800, coins2: 0.2 }, expr: 'ded3 + (oopMax2 - ded3) / coins2', format: 'usd', answer: '$19,800.00',
            reasoning: 'After the $1,800 deductible, the patient still owes $3,600 before hitting the maximum, and at a 20% share that takes $18,000 of further charges. Beyond $19,800.00 of charges the patient pays nothing more for the year.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'A second simulated year brings $60,000 of covered charges under the same plan. What does the patient pay?',
            choices: ['$5,400.00', '$12,240.00', '$60,000.00'],
            given: { charges3: 60000 },
            decision: { left: 'charges3', cmp: '>', right: '#t2-p3', ifTrue: '$5,400.00', ifFalse: '$12,240.00' },
            answer: '$5,400.00',
            reasoning: 'The test is the $19,800.00 threshold computed above, not the maximum itself: charges of $60,000 are far past it, so the out-of-pocket maximum binds and the patient pays $5,400.00 — the same as in the $24,000 year. A year between $5,400 and $19,800 of charges would not reach the maximum. Beyond the threshold the patient’s cost stops moving with the size of the bill, which is the protection the plan is really selling.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A coverage limit on the auto policy earlier in this unit and an out-of-pocket maximum on this health plan both cap something. Explain what each one caps and who it protects, and say which structure leaves the insured party exposed to an unlimited loss.',
            acceptableAnswerCriteria: [
              'States that a coverage limit caps what the insurer pays and therefore protects the insurer, while an out-of-pocket maximum caps what the patient pays and therefore protects the patient.',
              'Concludes that the coverage-limit structure leaves the insured exposed above the limit, as the $18,500 auto loss showed, while this health plan’s maximum removes that exposure once $5,400.00 is reached.',
              'Uses the $60,000 year to make the point concrete: a bill more than twice as large produced the same patient cost.',
            ],
            evidenceRequirements: [
              'Uses the $5,400.00 patient cost, the $18,600.00 plan payment, and the $19,800.00 threshold.',
            ],
            dimensions: ['transfer', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response identifies who each cap protects rather than treating both as "a maximum".',
              'The response recognises that this comparison holds only for charges the plan counts as covered.',
            ],
            commonMisconception: 'Reading every stated maximum in a policy as a protection for the insured party.',
          },
        ],
      },
    ],
    remediation: 'If the patient’s cost comes out as $6,240.00, the out-of-pocket maximum has not been applied. The deductible and coinsurance would have produced that figure, but the plan states that the patient’s payments stop at $5,400 for the year. Take the smaller of the two.',
    extension: 'Work out what the patient pays in a year with only $1,200 of covered charges, and say which of the plan’s three terms is doing the work in that year.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l05',
    grade: 10, unit: 6, day: 5,
    actor: 'a fictional account holder who finds unauthorised charges on a statement',
    objective: 'Total a set of fictional unauthorised charges, apply a stated liability schedule at three different reporting dates, and price the value of reporting quickly.',
    scenario: 'The simulated charges and the simulated liability schedule below are invented for this exercise. The schedule is a simplified teaching device, not a statement of anyone’s legal rights. No learner is asked for any real account, card, or login detail, and nothing here should be used to decide a real dispute — for that, contact the institution and a trusted adult.',
    materials: ['calculator', 'the fictional statement and liability schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional statement shows four unauthorised charges: $312.48, $89.99, $1,204.00, and $47.25. Under this simulated liability schedule, an account holder who reports within 2 business days owes at most $50; reporting after that but within 60 days caps the amount owed at $500; reporting after 60 days leaves the whole amount owing.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the unauthorised charges come to?',
            given: { c1: 312.48, c2: 89.99, c3: 1204.00, c4: 47.25 }, expr: 'c1 + c2 + c3 + c4', format: 'usd', answer: '$1,653.72',
            reasoning: 'The four charges added. This is the amount at stake before any liability cap is applied.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'If the holder reports the next day, what do they owe under the schedule?',
            given: { capFast: 50 }, expr: 'min(#t1-p1, capFast)', format: 'usd', answer: '$50.00',
            reasoning: 'The $1,653.72 is capped at $50 by the schedule’s fastest tier. The cap applies to the total, not to each charge.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'If instead the holder reports on day 12, what do they owe?',
            given: { capMid: 500 }, expr: 'min(#t1-p1, capMid)', format: 'usd', answer: '$500.00',
            reasoning: 'Day 12 is past the 2-business-day tier but within 60 days, so the $500 cap applies.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the delay itself. Reporting after 60 days leaves the whole $1,653.72 owing.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does reporting the next day save against reporting after 60 days?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$1,603.72',
            reasoning: 'The full $1,653.72 against the $50.00 cap. Nothing about the fraud changed between those two outcomes — only when it was reported.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much does the delay from day 1 to day 12 cost?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$450.00',
            reasoning: '$500.00 against $50.00. Ten days of not looking at a statement moved the amount owed by $450.00.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Under this simulated schedule, what does the account holder control?',
            choices: [
              'The size of the unauthorised charges',
              'How quickly the charges are reported',
              'Whether the institution investigates',
            ],
            answer: 'How quickly the charges are reported',
            reasoning: 'The charges have already happened and the investigation is the institution’s to run. The one variable in the holder’s hands is the reporting date, and the schedule prices it at $50.00, $500.00, or the whole $1,653.72.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write the first four things a fictional person should do on finding unauthorised charges, in order, and explain why the order matters given this schedule. Say which step you would not delay even by a day.',
            acceptableAnswerCriteria: [
              'Gives an ordered, actionable sequence — contact the institution to report and freeze the account, record the date and time of the report, request written confirmation, and review recent statements for anything else — and puts contacting the institution first.',
              'Explains the order using the schedule: every tier is defined by elapsed time, so the step that starts the clock has to come before documentation, disputes, or investigation.',
              'Identifies the report itself as the step not to delay, and supports it with the $450.00 cost of an eleven-day delay or the $1,603.72 cost of missing the 60-day window.',
            ],
            evidenceRequirements: [
              'Uses the $1,653.72 total and at least two of the three liability outcomes.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response puts reporting before gathering evidence, because the tiers are defined by time rather than by the quality of the report.',
              'The response does not blame the account holder for the fraud; the schedule prices response time, not fault.',
            ],
            commonMisconception: 'Waiting to assemble a complete account of what happened before reporting, when the liability tiers are set by the reporting date.',
          },
        ],
      },
    ],
    remediation: 'If the amount owed after a next-day report comes out as $1,653.72, the cap has not been applied. The schedule limits what the holder owes to $50 in that tier, so the answer is the smaller of the two figures. Compare the total against each tier’s cap and take the lower.',
    extension: 'Work out what the holder would owe if only the $1,204.00 charge had been unauthorised and it was reported on day 30, and say whether the size of the charge changes which tier applies.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l06',
    grade: 10, unit: 6, day: 6,
    actor: 'a fictional shopper comparing a low-premium policy with a low-deductible one',
    objective: 'Compute the multi-year cost of two fictional policies under different claim frequencies, and find the claim rate at which the ranking between them reverses.',
    scenario: 'The two simulated policies below are invented for this exercise. Neither is presented with a sales frame: the only figures given are the premium, the deductible, and the number of claims, so the comparison rests on arithmetic rather than on how the offer is described.',
    materials: ['calculator', 'the two fictional policy quotes in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Policy X charges an annual premium of $1,180 with a $500 deductible. Policy Y charges $890 a year with a $1,500 deductible. Assume every claim is large enough that the full deductible is paid and the coverage limit is never reached, so the deductible is the policyholder’s whole cost on a claim.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'In a single year with one claim, what does Policy X cost in total?',
            given: { premX: 1180, dedX: 500 }, expr: 'premX + dedX', format: 'usd', answer: '$1,680.00',
            reasoning: 'The $1,180 premium plus the $500 deductible borne on the claim.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'In the same year, what does Policy Y cost in total?',
            given: { premY: 890, dedY: 1500 }, expr: 'premY + dedY', format: 'usd', answer: '$2,390.00',
            reasoning: 'The $890 premium plus the $1,500 deductible. In a claim year the cheaper premium loses by $710.00.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'In a year with no claim, how much cheaper is Policy Y?',
            given: { premX2: 1180, premY2: 890 }, expr: 'premX2 - premY2', format: 'usd', answer: '$290.00',
            reasoning: 'Only the premiums are paid, so the $290.00 premium gap is the whole difference. Every claim-free year banks this amount for Policy Y.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now run both policies over 5 years, first with one claim in the period and then with two.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Over 5 years with one claim, what does Policy X cost?',
            given: { premX3: 1180, dedX2: 500 }, expr: 'premX3 * 5 + dedX2', format: 'usd', answer: '$6,400.00',
            reasoning: 'Five annual premiums of $1,180 plus one $500 deductible.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Over the same 5 years with one claim, what does Policy Y cost?',
            given: { premY3: 890, dedY2: 1500 }, expr: 'premY3 * 5 + dedY2', format: 'usd', answer: '$5,950.00',
            reasoning: 'Five annual premiums of $890 plus one $1,500 deductible.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Which is cheaper over that period, and by how much?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$450.00',
            reasoning: '$6,400.00 against $5,950.00, so Policy Y is cheaper by $450.00. Four claim-free years at $290.00 each more than covered the extra $1,000 borne on the single claim.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Over 5 years with two claims, what does Policy X cost?',
            given: { premX4: 1180, dedX3: 500 }, expr: 'premX4 * 5 + dedX3 * 2', format: 'usd', answer: '$6,900.00',
            reasoning: 'Five premiums of $1,180 plus two $500 deductibles.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'Over 5 years with two claims, what does Policy Y cost?',
            given: { premY4: 890, dedY3: 1500 }, expr: 'premY4 * 5 + dedY3 * 2', format: 'usd', answer: '$7,450.00',
            reasoning: 'Five premiums of $890 plus two $1,500 deductibles.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'With two claims, how much more does Policy Y cost?',
            given: {}, expr: '#t2-p5 - #t2-p4', format: 'usd', answer: '$550.00',
            reasoning: '$7,450.00 against $6,900.00. The ranking reversed between one claim and two, so the number of claims decides which policy is cheaper.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Policy Y is cheaper with one claim in five years and more expensive with two. Explain what a shopper actually has to estimate to choose between them, and say why a policy with a higher deductible can be the wrong choice even for someone who expects few claims.',
            acceptableAnswerCriteria: [
              'Identifies the quantity to estimate: how many claims are likely over the period, since the $290.00 annual premium saving is traded against $1,000 of extra cost on each claim.',
              'Explains that a higher deductible can still be wrong for a low-claim household if it could not readily produce the $1,500 on the day a claim happens, so affordability at the moment of loss matters as well as the multi-year total.',
              'Notes that the comparison assumes every claim is large enough to use the full deductible, and that small claims change the arithmetic.',
            ],
            evidenceRequirements: [
              'Uses the $450.00 one-claim difference and the $550.00 two-claim difference.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'assumption-identification'],
            lookFors: [
              'The response separates the expected total cost from the ability to pay the deductible when a claim occurs.',
              'The response identifies the claim count as the variable rather than declaring one policy better.',
            ],
            commonMisconception: 'Choosing a policy on the premium alone, without asking how many claims the period is likely to bring.',
          },
        ],
      },
    ],
    remediation: 'If Policy Y looks cheaper in every case, count both parts of what it costs. Its premium saves $290.00 a year, and each claim costs $1,000 more than under Policy X. One claim in five years leaves Y ahead by $450.00; two claims put it behind by $550.00.',
    extension: 'Find the number of claims over 5 years at which the two policies cost exactly the same, and say whether that number is one a shopper could estimate with any confidence.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l07',
    grade: 10, unit: 6, day: 7,
    actor: 'a fictional student holding three wrong beliefs about what coverage does',
    objective: 'Test three fictional claims about landlord coverage, disability coverage, and term life against computed figures, and state what each coverage is actually for.',
    scenario: 'The three simulated claims below were written by a fictional student for this exercise and are deliberately wrong. No real insurer or policy is described.',
    materials: ['calculator', 'the fictional claims in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional student’s first claim: "I do not need renters coverage, because my landlord has insurance on the building." A fire destroys $5,240 of the tenant’s belongings. The landlord’s fictional policy covers the building the landlord owns and pays $0 toward a tenant’s possessions. The second claim: "I do not need disability coverage, because I have health coverage." A fictional worker earning $3,200 a month is unable to work for 5 months; health coverage pays the medical bills, and a fictional disability policy would replace 60% of lost income.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'The landlord’s policy pays $0 toward the tenant’s possessions. How much of the tenant’s $5,240 of belongings must the tenant replace out of their own pocket?',
            given: { belongings: 5240, landlordPays: 0 }, expr: 'belongings - landlordPays', format: 'usd', answer: '$5,240.00',
            reasoning: 'The landlord’s policy pays $0 toward tenant possessions, so the tenant bears the whole $5,240. The landlord’s coverage is real and it protects the landlord’s property, which is not the same property. Note what the question asks for: the tenant’s own exposure, not the policy’s payment, which is $0.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much income does the fictional worker lose over the 5 months?',
            given: { monthly: 3200, months: 5 }, expr: 'monthly * months', format: 'usd', answer: '$16,000.00',
            reasoning: '5 months at $3,200. Health coverage pays the medical bills and pays none of this, because lost income is not a medical bill.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much would a disability policy replacing 60% of lost income have paid?',
            given: { replaceRate: 0.6 }, expr: '#t1-p2 * replaceRate', format: 'usd', answer: '$9,600.00',
            reasoning: '60% of the $16,000.00 lost. Disability coverage replaces part of an income; it typically does not replace all of it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The student’s third claim: "Term life is a waste, because if you do not die you get nothing back." Consider a fictional 20-year term life policy with a $228 annual premium and $250,000 of coverage.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Even with a disability policy, how much of the lost income is still unreplaced?',
            given: {}, expr: '#t1-p2 - #t1-p3', format: 'usd', answer: '$6,400.00',
            reasoning: '$16,000.00 lost against $9,600.00 replaced. Coverage reduces an exposure rather than removing it, which is a fact about the policy and not a defect in it.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do 20 years of term life premiums come to?',
            given: { lifePrem: 228 }, expr: 'lifePrem * 20', format: 'usd', answer: '$4,560.00',
            reasoning: '20 years at $228 a year. This is what the student is describing as wasted.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'How many dollars of coverage does each dollar of total premium stand behind over the term? Round to two decimal places.',
            given: { coverage: 250000 }, expr: 'round(coverage / #t2-p2, 2)', format: 'dec2', answer: '54.82',
            reasoning: '$250,000 of coverage against $4,560.00 of premiums. The policy is buying protection during the term, not building a balance to return.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which of the three claims describes a coverage the student already holds as though it did a different job?',
            choices: [
              'The claim about the landlord’s building policy',
              'The claim about health coverage standing in for disability coverage',
              'The claim about term life returning nothing',
            ],
            answer: 'The claim about health coverage standing in for disability coverage',
            reasoning: 'The landlord’s policy belongs to someone else and the term life claim misreads what a premium buys. Only the second claim takes a policy the worker actually holds — health coverage — and assumes it covers an exposure it does not, namely the $16,000.00 of lost income.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'For each of the three claims, name the exposure the student is leaving uncovered and say what would have to be true for the student to be right. Then explain what "you get nothing back" misunderstands about paying a premium.',
            acceptableAnswerCriteria: [
              'Names all three exposures: $5,240 of belongings, $16,000.00 of lost income of which $6,400.00 would remain unreplaced even with coverage, and the loss to survivors that $250,000 of term coverage stands behind.',
              'Gives the condition for each claim to hold — owning nothing worth insuring, having savings that can absorb months without income, or having nobody who depends on the insured’s income.',
              'Explains that a premium buys protection for a period rather than a balance, so a term ending with no claim means the insured event did not happen, which is the outcome the buyer wanted.',
            ],
            evidenceRequirements: [
              'Uses the $5,240 of belongings, the $16,000.00 of lost income, and the $4,560.00 of total premiums.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'transfer'],
            lookFors: [
              'The response gives an honest condition under which each claim would be correct rather than declaring all three simply wrong.',
              'The response distinguishes protection from saving without describing term life as good or bad for anyone in particular.',
            ],
            commonMisconception: 'Judging insurance by whether money comes back, rather than by which exposure it stands behind.',
          },
        ],
      },
    ],
    remediation: 'If the landlord’s policy looks like it should help, ask whose property it insures. It covers the building, which the landlord owns. The tenant’s $5,240 of belongings are the tenant’s property, and the landlord’s policy pays $0 toward them.',
    extension: 'Work out how many months of the fictional worker’s lost income a $9,600.00 disability payment would actually cover at their normal spending, and say what that implies about how long a household reserve needs to last.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l08',
    grade: 10, unit: 6, day: 8,
    actor: 'a fictional homeowner whose deductible is a percentage rather than a flat amount',
    objective: 'Apply the payout rule where the deductible is a percentage of the coverage limit rather than a flat amount, and compare the result with a flat-deductible policy on the same loss.',
    scenario: 'The simulated dwelling policy below is invented for this exercise. Its windstorm deductible is a percentage of the dwelling coverage limit, not of the loss — a structure that behaves differently from the flat deductibles used earlier in this unit. The payout rule is unchanged: the deductible comes off the loss, and the coverage limit caps the payment.',
    materials: ['calculator', 'the fictional dwelling policy terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional dwelling policy has a coverage limit of $180,000. Its windstorm deductible is 2% of that coverage limit, whatever the size of the loss. Start with a windstorm loss of $47,500.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the windstorm deductible in dollars?',
            given: { dwelling: 180000, windPct: 0.02 }, expr: 'dwelling * windPct', format: 'usd', answer: '$3,600.00',
            reasoning: '2% of the $180,000 coverage limit. Because it is calculated on the limit, this figure is the same for a small loss and a large one.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'On the $47,500 loss, what does the policy pay?',
            given: { loss1: 47500, dwelling2: 180000 }, expr: 'min(loss1 - #t1-p1, dwelling2)', format: 'usd', answer: '$43,900.00',
            reasoning: 'The $3,600.00 deductible comes off the $47,500 loss, leaving $43,900.00, which is below the $180,000 limit, so the limit does not bind.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the homeowner pay on that loss?',
            given: { loss1b: 47500 }, expr: 'loss1b - #t1-p2', format: 'usd', answer: '$3,600.00',
            reasoning: 'Exactly the deductible, because the limit was not reached. This matches the pattern from the flat-deductible policies, even though the deductible was computed differently.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now take a windstorm loss of $195,000 against the same policy, then compare the percentage deductible with a flat one on the original loss.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'On the $195,000 loss, what does the policy pay?',
            given: { loss2: 195000, dwelling3: 180000 }, expr: 'min(loss2 - #t1-p1, dwelling3)', format: 'usd', answer: '$180,000.00',
            reasoning: 'The $3,600.00 deductible off the $195,000 loss leaves $191,400, which exceeds the $180,000 limit, so the limit binds and the policy pays the full $180,000.00 — not the limit less the deductible.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the homeowner pay on that loss?',
            given: { loss2b: 195000 }, expr: 'loss2b - #t2-p1', format: 'usd', answer: '$15,000.00',
            reasoning: 'The $195,000 loss less the $180,000.00 paid — more than four times the deductible, because the limit bound and the homeowner carries everything above it.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the policy had carried a flat $1,000 deductible instead, how much more would it have paid on the $47,500 loss?',
            given: { flatDed: 1000, loss1c: 47500, dwelling4: 180000 }, expr: 'min(loss1c - flatDed, dwelling4) - #t1-p2', format: 'usd', answer: '$2,600.00',
            reasoning: '$46,500 against $43,900.00. The percentage deductible is $2,600.00 larger than the flat one here, and it grows with the coverage limit rather than staying fixed.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'If the homeowner raised the dwelling coverage limit to $220,000, what would happen to the windstorm deductible?',
            choices: ['It would stay at $3,600.00', 'It would rise', 'It would fall'],
            given: { newLimit: 220000, oldLimit: 180000 },
            decision: { left: 'newLimit', cmp: '>', right: 'oldLimit', ifTrue: 'It would rise', ifFalse: 'It would fall' },
            answer: 'It would rise',
            reasoning: 'The deductible is 2% of the coverage limit, so raising the limit raises it too. Buying more coverage under this structure also increases what the homeowner bears on every windstorm claim, which is not obvious from the word "deductible" alone.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The payout rule was the same in this lesson as in the flat-deductible ones, but one input was computed differently. State the rule in a form that covers both, explain what changes when a deductible is set as a percentage of the limit, and say what a homeowner should check before raising a coverage limit.',
            acceptableAnswerCriteria: [
              'States the rule in a form that survives the change: work out the deductible however the policy defines it, subtract it from the loss, and pay that amount up to the coverage limit.',
              'Explains that a percentage deductible scales with the limit rather than with the loss, so it is fixed across losses of different sizes but moves whenever the limit changes.',
              'Advises checking how the deductible is defined before raising a limit, since under this structure more coverage also means a larger amount borne on every claim.',
            ],
            evidenceRequirements: [
              'Uses the $3,600.00 deductible, the $43,900.00 payout, and the $15,000.00 the homeowner bore on the larger loss.',
            ],
            dimensions: ['transfer', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response separates how the deductible is computed from how the payout is computed.',
              'The response notices that raising the limit has two opposing effects and does not treat more coverage as strictly better.',
            ],
            commonMisconception: 'Assuming a deductible is always a flat amount that does not change when the coverage limit changes.',
          },
        ],
      },
    ],
    remediation: 'If the $195,000 claim comes out as $176,400, the deductible has been subtracted from the limit as well as from the loss. Take it off once, from the loss, then cap at the limit: the policy pays $180,000.00 and the homeowner bears $15,000.00.',
    extension: 'Work out the windstorm deductible and the payout on the $47,500 loss if the coverage limit were raised to $220,000, and say whether the homeowner ends up better or worse off on that particular claim.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l09',
    grade: 10, unit: 6, day: 9,
    actor: 'a fictional household reviewing every exposure it carries at once',
    objective: 'Measure a fictional household’s three largest exposures against the coverage standing behind each, identify the largest uncovered gap, and total what the household would bear.',
    scenario: 'The simulated household, its coverage, and its exposures below are invented for this exercise. Each property policy pays the loss minus its deductible, capped at its coverage limit.',
    materials: ['calculator', 'the fictional household coverage summary in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional household earns $52,000 a year from one earner. Its belongings are worth $14,600, covered by a renters policy with a $10,000 limit and a $500 deductible. Its car is worth $12,300, covered by collision with a $12,300 limit and a $1,000 deductible. The household holds no disability coverage. Consider three separate events: the earner unable to work for 6 months, a total loss of the belongings, and a total loss of the car.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much income does the household lose if the earner cannot work for 6 months?',
            given: { income: 52000 }, expr: 'income / 12 * 6', format: 'usd', answer: '$26,000.00',
            reasoning: 'Half of the $52,000 annual income. With no disability coverage in place, the household bears all of it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'In a total loss of the belongings, what does the renters policy pay?',
            given: { belongings: 14600, rentLimit: 10000, rentDed: 500 }, expr: 'min(belongings - rentDed, rentLimit)', format: 'usd', answer: '$10,000.00',
            reasoning: 'The $500 deductible off the $14,600 loss leaves $14,100, which exceeds the $10,000 limit, so the limit binds.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the household bear in that event?',
            given: { belongings2: 14600 }, expr: 'belongings2 - #t1-p2', format: 'usd', answer: '$4,600.00',
            reasoning: 'The $14,600 loss less the $10,000.00 paid. The limit is below the exposure, so the household carries the shortfall as well as the deductible.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for the car, then rank the three exposures.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'In a total loss of the car, what does collision pay?',
            given: { autoValue: 12300, autoLimit: 12300, autoDed: 1000 }, expr: 'min(autoValue - autoDed, autoLimit)', format: 'usd', answer: '$11,300.00',
            reasoning: 'The $1,000 deductible off the $12,300 loss leaves $11,300.00, which is below the $12,300 limit, so the limit does not bind.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the household bear in that event?',
            given: { autoValue2: 12300 }, expr: 'autoValue2 - #t2-p1', format: 'usd', answer: '$1,000.00',
            reasoning: 'Exactly the deductible, because the limit was set at the value of the car rather than below it.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Of the three events, what is the largest amount the household would have to bear?',
            given: {}, expr: 'max(#t1-p1, #t1-p3, #t2-p2)', format: 'usd', answer: '$26,000.00',
            reasoning: 'The $26,000.00 of lost income, against $4,600.00 on the belongings and $1,000.00 on the car. The largest exposure is the one with no coverage behind it at all.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'If all three events happened in the same year, what would the household bear in total?',
            given: {}, expr: '#t1-p3 + #t2-p2 + #t1-p1', format: 'usd', answer: '$31,600.00',
            reasoning: '$4,600.00 plus $1,000.00 plus $26,000.00 — more than half a year’s income, and over four fifths of it from the uncovered exposure.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The household insures a $12,300 car down to a $1,000 exposure and leaves a $26,000.00 income exposure entirely uncovered. Explain why this pattern is common, and recommend the single change you would make first, defending it against the alternative of raising the renters limit.',
            acceptableAnswerCriteria: [
              'Explains the pattern: coverage tends to follow visible property and legal or lender requirements, while an income exposure has no object attached to it and is often not required by anyone.',
              'Recommends adding disability coverage first and defends it with the $26,000.00 figure against the $4,600.00 that raising the renters limit would address.',
              'Acknowledges what the recommendation costs — a further premium against a household already paying for renters and collision coverage — rather than treating more coverage as free.',
            ],
            evidenceRequirements: [
              'Uses all three of the amounts borne, and the $31,600.00 combined figure.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The response ranks by the size of what the household would bear, not by the size of the asset.',
              'A response that prioritises the renters limit is defensible only if it argues from likelihood rather than from magnitude, and says so.',
            ],
            commonMisconception: 'Reviewing coverage by listing the policies held rather than by listing the exposures carried.',
          },
        ],
      },
    ],
    remediation: 'If the belongings event comes out at $500, the coverage limit has not been applied. The deductible leaves $14,100 of loss, but the renters policy will not pay more than its $10,000 limit, so the household bears $4,600.00. Compare each exposure against the limit standing behind it, not against the deductible.',
    extension: 'Work out what renters limit would reduce the household’s exposure on the belongings to the $500 deductible, and say whether that change or disability coverage would remove more risk per dollar of premium.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u06-l10',
    grade: 10, unit: 6, day: 10,
    actor: 'a fictional policyholder working one accident through three separate coverages',
    objective: 'Work a fictional multi-part claim through three coverages that each have their own rule, total what the insurer pays and what the policyholder bears, and check that the two reconcile to the loss.',
    scenario: 'The simulated accident and the simulated policy below are invented for this exercise. Each of the three coverages has its own limit and its own deductible rule, and each is applied separately to the part of the loss it covers.',
    materials: ['calculator', 'the fictional policy declarations in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional auto policy carries three coverages. Collision has a $14,000 limit and a $1,000 deductible. Medical payments has a $5,000 limit and no deductible. Property damage liability has a $25,000 limit and no deductible. In a simulated accident the policyholder’s own car sustains $9,800 of damage, the policyholder’s own medical bills come to $6,200, and the policyholder is responsible for $31,400 of damage to another party’s property. Apply each coverage separately, subtracting its deductible from its part of the loss and capping the result at its limit.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does collision pay for the policyholder’s car?',
            given: { carDamage: 9800, collDed: 1000, collLimit: 14000 }, expr: 'min(carDamage - collDed, collLimit)', format: 'usd', answer: '$8,800.00',
            reasoning: 'The $1,000 deductible off the $9,800 of damage leaves $8,800.00, below the $14,000 limit, so the limit does not bind.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does medical payments coverage pay?',
            given: { medBills: 6200, medLimit: 5000 }, expr: 'min(medBills, medLimit)', format: 'usd', answer: '$5,000.00',
            reasoning: 'This coverage carries no deductible, so nothing is subtracted from the $6,200. The $5,000 limit binds and caps the payment.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does property damage liability pay for the other party’s property?',
            given: { otherProp: 31400, pdLimit: 25000 }, expr: 'min(otherProp, pdLimit)', format: 'usd', answer: '$25,000.00',
            reasoning: 'No deductible applies, and the $31,400 of damage exceeds the $25,000 limit, so the limit binds and the coverage pays $25,000.00.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now total both sides of the claim and check that they reconcile.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the insurer pay in total across the three coverages?',
            given: {}, expr: '#t1-p1 + #t1-p2 + #t1-p3', format: 'usd', answer: '$38,800.00',
            reasoning: '$8,800.00 of collision plus $5,000.00 of medical payments plus $25,000.00 of property damage liability.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the policyholder bear on their own car?',
            given: { carDamage2: 9800 }, expr: 'carDamage2 - #t1-p1', format: 'usd', answer: '$1,000.00',
            reasoning: 'The deductible only, since the collision limit did not bind.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the policyholder bear on their own medical bills?',
            given: { medBills2: 6200 }, expr: 'medBills2 - #t1-p2', format: 'usd', answer: '$1,200.00',
            reasoning: 'The $6,200 of bills less the $5,000.00 the limit allowed. There was no deductible here, so this whole amount comes from the limit binding.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the policyholder responsible for on the other party’s property?',
            given: { otherProp2: 31400 }, expr: 'otherProp2 - #t1-p3', format: 'usd', answer: '$6,400.00',
            reasoning: 'The $31,400 of damage less the $25,000.00 the liability limit allowed. Liability that exceeds a limit does not disappear; it remains the policyholder’s.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What does the policyholder bear in total?',
            given: {}, expr: '#t2-p2 + #t2-p3 + #t2-p4', format: 'usd', answer: '$8,600.00',
            reasoning: '$1,000.00 plus $1,200.00 plus $6,400.00. Only $1,000.00 of this is a deductible; the other $7,600.00 comes from limits binding.',
          },
          {
            ref: 't2-p6', kind: 'numeric', unit: 'USD',
            text: 'Check the work: what do the insurer’s payments and the policyholder’s costs come to together?',
            given: {}, expr: '#t2-p1 + #t2-p5', format: 'usd', answer: '$47,400.00',
            reasoning: '$38,800.00 plus $8,600.00, which must equal the total loss of $9,800 plus $6,200 plus $31,400. If the two sides do not reconcile, a deductible or a limit has been applied twice or not at all.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Report this claim to the fictional policyholder: what the policy paid, what they owe, and which single coverage limit was most costly to have set where it was. Then say which limit you would raise first and what raising it would not fix.',
            acceptableAnswerCriteria: [
              'Reports both sides accurately — $38,800.00 paid by the insurer and $8,600.00 borne by the policyholder — and notes that the two reconcile to the $47,400.00 total loss.',
              'Identifies property damage liability as the costliest limit, since its binding produced $6,400.00 of the $8,600.00, and recommends raising it first.',
              'States what raising it would not fix: the $1,000.00 collision deductible would remain, and the $1,200.00 medical shortfall would need a different limit raised.',
              'Recognises that the $6,400.00 of liability remains legally owed to the other party rather than being written off.',
            ],
            evidenceRequirements: [
              'Uses the $38,800.00 insurer total, the $8,600.00 policyholder total, and the $6,400.00 liability shortfall.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes the one deductible from the two limits that bound.',
              'The response recognises that liability above a limit is still owed, which is what makes a liability limit different from a limit on one’s own property.',
            ],
            commonMisconception: 'Assuming a policy’s deductible is the whole of what a claim costs the policyholder, when limits binding can cost far more.',
          },
        ],
      },
    ],
    remediation: 'If the policyholder’s total comes out at $1,000.00, only the deductible has been counted. Two of the three coverages hit their limits: medical payments stopped at $5,000.00 against $6,200 of bills, and liability stopped at $25,000.00 against $31,400 of damage. Everything above a limit stays with the policyholder.',
    extension: 'Recompute the claim with the property damage liability limit raised to $50,000 and everything else unchanged, and say how much of the policyholder’s $8,600.00 that single change removes.',
  },
]
