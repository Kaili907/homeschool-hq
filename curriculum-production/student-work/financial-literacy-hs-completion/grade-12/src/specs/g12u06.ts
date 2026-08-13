import type { LessonSpec } from '../types.ts'

/**
 * Grade 12, Unit 6 — PF6 Protecting and Insuring: Protecting an Adult
 * Household.
 *
 * The senior move is that protection is treated as a system rather than as a
 * list of policies. Deductibles set a reserve floor, a waiting period sets a
 * cash-flow requirement, an enrolment date sets an exposure window, and
 * documents and account security sit alongside insurance as part of the same
 * plan. Every payout in this unit is computed from the policy terms the
 * learner is shown — deductible first, then the member's share, then any cap —
 * so a payout figure can always be traced back to a stated rule.
 *
 * Pricing an exposure is not the same as showing a decision was wrong. Several
 * lessons make that distinction explicitly, because the arithmetic here can
 * only say what a loss would cost, never how likely it is.
 */
export const g12u06: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g12-financial-literacy-u06-l01',
    grade: 12, unit: 6, day: 1,
    actor: 'a fictional adult assembling a first full set of coverage',
    objective: 'Total a fictional adult’s coverage costs, express them against income, and compute what one policy would actually pay on a stated loss.',
    scenario: 'The four simulated policies below and the fictional loss used to test one of them are invented for this exercise. No real insurer, policy, or product is described.',
    materials: ['calculator', 'the fictional policy terms in these directions'],
    domains: ['insurance-risk', 'budgeting', 'income', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional adult earns $46,800 a year and holds four simulated policies: renters cover at $17 a month, auto at $118, the employee share of health at $186, and disability at $24. The renters policy covers personal property up to $25,000 after a deductible of $500.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the four policies cost each month together?',
            given: { renters: 17, auto: 118, health: 186, disability: 24 },
            expr: 'renters + auto + health + disability', format: 'usd', answer: '$345.00',
            reasoning: 'The four monthly premiums added. Health is much the largest at $186, and renters much the smallest at $17, which is worth holding in mind before the payout is computed.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do they cost across a year?',
            given: {}, expr: '#t1-p1 * 12', format: 'usd', answer: '$4,140.00',
            reasoning: '$345.00 in each of the 12 months. Premiums are paid whether or not anything is claimed, which is what makes them a budget line rather than a contingency.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What share of income does that represent, to two decimal places?',
            given: { income: 46800 }, expr: 'round(#t1-p2 / income * 100, 2)', format: 'percent2', answer: '8.85%',
            reasoning: '$4,140.00 measured against $46,800 of income. Expressing protection as a share of income is how it can be compared with the other claims on a budget.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the smallest policy against a stated loss.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'A fictional fire destroys $14,000 of personal property. What does the renters policy pay?',
            given: { loss: 14000, deductible: 500 }, expr: 'loss - deductible', format: 'usd', answer: '$13,500.00',
            reasoning: 'The $14,000 loss less the $500 deductible. The $25,000 limit is not reached, so it does not reduce the payout; the deductible is the only reduction that applies.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Netting off a full year of renters premiums, what is the household ahead by in that year?',
            given: { renters2: 17 }, expr: '#t2-p1 - renters2 * 12', format: 'usd', answer: '$13,296.00',
            reasoning: '$13,500.00 paid out against $204.00 of premiums for the year. This is the arithmetic of a year in which the loss happens; in a year without one the household is $204.00 down, and both are ordinary outcomes for a policy.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which of the four policies protects the largest potential loss for the smallest premium?',
            choices: ['Renters, at $17 a month', 'Auto, at $118 a month', 'Health, at $186 a month'],
            answer: 'Renters, at $17 a month',
            reasoning: 'The renters policy covers up to $25,000 of property for $204.00 a year, the smallest premium of the four against a stated limit far larger than the premium. The comparison follows from the stated terms; it does not mean renters cover is the most important policy, only the one with the largest stated limit per dollar of premium.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fictional friend says renters cover is "not worth it" because $204 a year buys nothing in most years. Explain what that argument gets right and what it misses, and say what the household would have to be able to absorb for the friend to be correct.',
            acceptableAnswerCriteria: [
              'Grants the point: in a year with no loss the policy costs $204.00 and returns nothing, and most years are like that, so the argument is not simply wrong about the common case.',
              'States what it misses: insurance is bought for the uncommon case, and a single $14,000 loss returns $13,500.00 — more than sixty years of premiums — which is exactly the shape of risk a premium exists to convert into a fixed cost.',
              'Names the condition under which the friend would be right: a household able to absorb the full loss out of its own reserves without borrowing or hardship has less need to transfer the risk, so the argument turns on what the household could actually withstand.',
            ],
            evidenceRequirements: [
              'Uses the $204.00 annual renters premium and the $13,500.00 payout on the stated loss.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response frames insurance as converting a large uncertain loss into a small certain cost.',
              'The response does not claim the policy is worth it because a loss is likely; it is not.',
            ],
            commonMisconception: 'Judging a policy by whether it paid out this year, which is the one thing a policy is not designed to do reliably.',
          },
        ],
      },
    ],
    remediation: 'If the renters payout comes out at $14,000.00, the deductible has not been applied; if it comes out at $25,000, the limit has been treated as the payout. Work the terms in order: start from the $14,000 loss, subtract the $500 deductible, then check the result against the $25,000 limit, which only binds if the loss is larger.',
    extension: 'Recompute the renters payout on a fictional loss of $31,000, and say which of the two policy terms decides the answer in that case.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l02',
    grade: 12, unit: 6, day: 2,
    actor: 'a fictional worker facing a coverage gap between two jobs',
    objective: 'Measure a fictional coverage gap in days, price bridging it, and compare that against what one uncovered event would cost.',
    scenario: 'The fictional employment dates, the simulated continuation cover, and the invented visit cost below exist only for this exercise.',
    materials: ['calculator', 'the fictional coverage dates and costs in these directions'],
    domains: ['insurance-risk', 'income', 'budgeting', 'consumer-protection'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Counting days from the fictional worker’s last day, the old plan’s cover ends on day 18 and the new employer’s cover begins on day 79. Continuation cover is available at $612 for each 30-day period or part of one, and 3 such periods are needed to span the gap. Under the new plan a fictional emergency visit costing $4,850 would leave the member paying a $250 copay plus 20% of the rest; with no cover at all the member pays the whole amount.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'days',
            text: 'How many days is the gap in cover?',
            given: { newStart: 79, oldEnd: 18 }, expr: 'newStart - oldEnd', format: 'int', answer: '61',
            reasoning: 'Day 79 when the new cover starts, less day 18 when the old cover ends. The gap arises from two dates neither of which the worker chose, which is why it has to be checked rather than assumed away.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does bridging the whole gap with continuation cover cost?',
            given: { continuation: 612, periods: 3 }, expr: 'continuation * periods', format: 'usd', answer: '$1,836.00',
            reasoning: '$612 for each of the 3 periods needed. Because a part period is charged in full, the 61-day gap costs the same as a 90-day one would.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'With cover in place, what would the member pay toward the $4,850 visit?',
            given: { copay: 250, visitCost: 4850, coins: 0.2 }, expr: 'copay + (visitCost - copay) * coins', format: 'usd', answer: '$1,170.00',
            reasoning: 'The $250 copay plus 20% of the remaining $4,600. This is what the same event costs when cover is in force.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now set the cost of the gap against the cost of bridging it.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more would the visit cost during the gap than it would with cover?',
            given: { visitCost2: 4850 }, expr: 'visitCost2 - #t1-p3', format: 'usd', answer: '$3,680.00',
            reasoning: 'The full $4,850 paid without cover against $1,170.00 with it. This is the exposure the gap creates for a single event of this size.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Comparing the two figures alone, is bridging the gap cheaper than one uncovered visit of this size?',
            choices: ['Yes — bridging costs less than the extra exposure on one event', 'No — bridging costs more than the event would'],
            decision: { left: '#t1-p2', cmp: '<', right: '#t2-p1', ifTrue: 'Yes — bridging costs less than the extra exposure on one event', ifFalse: 'No — bridging costs more than the event would' },
            answer: 'Yes — bridging costs less than the extra exposure on one event',
            reasoning: '$1,836.00 to bridge against $3,680.00 of extra exposure on one such visit. The comparison is only between these two figures; it assumes an event of exactly this size and says nothing about how likely one is.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The comparison above is not a proof that bridging is right. Explain what it leaves out, describe the case for going uncovered for the 61 days, and say what fact about the gap the worker should confirm first whichever way they decide.',
            acceptableAnswerCriteria: [
              'Names what the comparison omits: it assumes exactly one event of exactly $4,850, whereas the gap could pass with nothing at all — in which case $1,836.00 buys nothing — or could bring a far larger cost that the comparison understates.',
              'Makes the case for going uncovered honestly: $1,836.00 is certain and the event is not, so a worker with reserves able to absorb a large bill may reasonably accept 61 days of exposure.',
              'Names the fact to confirm: the two dates themselves — whether the old cover truly ends on day 18 and the new cover truly begins on day 79 — since a shorter gap might need fewer periods and a longer one more, and the whole calculation rests on them.',
            ],
            evidenceRequirements: [
              'Uses the $1,836.00 bridging cost and the $3,680.00 extra exposure, and refers to the 61-day gap.',
            ],
            dimensions: ['communication-of-uncertainty', 'tradeoff-defense', 'assumption-identification'],
            lookFors: [
              'The response treats the single-event comparison as an illustration rather than as a decision rule.',
              'Either decision is credited when the certainty of the premium is weighed against the uncertainty of the event.',
            ],
            commonMisconception: 'Treating a comparison against one hypothetical event as though it settled whether cover is worth buying.',
          },
        ],
      },
    ],
    remediation: 'If the bridging cost comes out at $1,224.00, the gap is being covered with 2 periods rather than 3. A 61-day gap runs past two full 30-day periods, and a part period is charged in full, so 3 periods are needed. Count the periods against the 61 days before multiplying by $612.',
    extension: 'Work out the bridging cost if the new employer’s cover began on day 61 instead of day 79, and say whether the saving is proportional to the days removed.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l03',
    grade: 12, unit: 6, day: 3,
    actor: 'a fictional household sizing a reserve against the deductibles it carries',
    objective: 'Derive two reserve targets from a fictional household’s own policy terms, measure the existing reserve against each, and express the gap as a number of months.',
    scenario: 'The simulated policy terms and reserve below belong to a fictional household and are invented for this exercise.',
    materials: ['calculator', 'the fictional policy terms and reserve figure in these directions'],
    domains: ['insurance-risk', 'saving-investing', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household carries a health deductible of $1,800 with a cap of $5,600 on what the member can pay in a year, an auto deductible of $1,000, and a renters deductible of $500. The reserve currently holds $2,400, and the household can add $185 a month to it.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the three deductibles come to together?',
            given: { healthDed: 1800, autoDed: 1000, rentersDed: 500 }, expr: 'healthDed + autoDed + rentersDed', format: 'usd', answer: '$3,300.00',
            reasoning: 'The three deductibles added. This is what the household would have to produce in cash if one claim were made on each policy in the same year, and it is a floor a reserve can be sized against because it comes from the policies themselves.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would a worse year cost, taking the health cap rather than the health deductible?',
            given: { oopMax: 5600, autoDed2: 1000, rentersDed2: 500 }, expr: 'oopMax + autoDed2 + rentersDed2', format: 'usd', answer: '$7,100.00',
            reasoning: 'The $5,600 cap on health, plus the auto and renters deductibles. The cap, not the deductible, is what bounds a health year with substantial claims in it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How far short of the deductible floor is the current reserve?',
            given: { reserve: 2400 }, expr: '#t1-p1 - reserve', format: 'usd', answer: '$900.00',
            reasoning: '$3,300.00 against $2,400 held.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure the reserve against the worse year and express both gaps in months.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How far short of the worse-year figure is the current reserve?',
            given: { reserve2: 2400 }, expr: '#t1-p2 - reserve2', format: 'usd', answer: '$4,700.00',
            reasoning: '$7,100.00 against $2,400 held. The two targets differ by $3,800.00, which is the difference between the health deductible and the health cap.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'At $185 a month, how many months would close the smaller gap? Give one decimal place.',
            given: { monthly: 185 }, expr: 'round(#t1-p3 / monthly, 1)', format: 'dec1', answer: '4.9',
            reasoning: '$900.00 at $185 a month. A target this close is worth naming, because it can be reached inside a year.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'How many months would close the larger gap? Give one decimal place.',
            given: { monthly2: 185 }, expr: 'round(#t2-p1 / monthly2, 1)', format: 'dec1', answer: '25.4',
            reasoning: '$4,700.00 at the same $185 a month — more than two years, during which the household is exposed to the difference.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Choose which of the two targets this fictional household should work to first and defend it with the figures. Explain what the household is exposed to under your choice, and say why sizing a reserve from the policies rather than from a general rule is useful here.',
            acceptableAnswerCriteria: [
              'Chooses a target and defends it — the $3,300.00 floor because 4.9 months makes it achievable and it covers the common case of one claim per policy, or the $7,100.00 figure because it is the only one that covers a bad health year.',
              'States the exposure that remains under the choice: working to the floor leaves the household $3,800.00 short of a bad health year, while working to the larger figure leaves 25.4 months during which even the floor is not fully funded.',
              'Explains the method: both targets are read off the household’s own deductibles and cap, so they answer what this household would actually have to produce, which a general rule expressed in months of expenses does not.',
            ],
            evidenceRequirements: [
              'Uses the $3,300.00 and $7,100.00 targets and both month figures, 4.9 and 25.4.',
            ],
            dimensions: ['criteria-application', 'tradeoff-defense', 'plan-coherence'],
            lookFors: [
              'The response uses the health cap rather than the health deductible when describing the worse year.',
              'Either target is credited when the remaining exposure is named.',
            ],
            commonMisconception: 'Sizing a reserve only against the deductibles, when the annual cap is what governs the cost of a year with more than one significant claim in it.',
          },
        ],
      },
    ],
    remediation: 'If the worse-year figure comes out at $8,900.00, the health deductible has been added to the health cap. The cap of $5,600 is the most the member pays toward health in the year, and it already includes the $1,800 deductible. Use the cap in place of the deductible, then add the auto and renters deductibles.',
    extension: 'Recompute both targets for a fictional household that raises its auto deductible to $2,000 in exchange for a lower premium, and say what that trade does to the reserve requirement.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l04',
    grade: 12, unit: 6, day: 4,
    actor: 'a fictional household inventorying documents and account security',
    objective: 'Price what replacing a fictional household’s critical documents would cost in money and time, compare that with the cost of protecting them, and state what must never be stored insecurely.',
    scenario: 'The fictional documents, replacement costs, and protection options below are invented for this exercise. No real document, account, or credential is described, and none is requested.',
    materials: ['calculator', 'the fictional replacement costs and protection prices in these directions'],
    domains: ['fraud', 'consumer-protection', 'insurance-risk', 'banking'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Replacing the fictional household’s critical documents would cost $32 for a birth record, $165 for a travel document, $42 for a licence, and $68 for title papers. Doing so would also take about 14 hours, which this exercise values at $22 an hour purely to make the time comparable with the fees.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What are the replacement fees in total?',
            given: { birthCert: 32, travelDoc: 165, licence: 42, titleDocs: 68 },
            expr: 'birthCert + travelDoc + licence + titleDocs', format: 'usd', answer: '$307.00',
            reasoning: 'The four fees added. The travel document at $165 is more than half of it, which is worth knowing when deciding what to protect most carefully.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the 14 hours worth at the stated rate?',
            given: { hours: 14, hourly: 22 }, expr: 'hours * hourly', format: 'usd', answer: '$308.00',
            reasoning: '14 hours at $22. Putting a figure on the time is a device for comparison, not a claim that the household would otherwise have earned this; the point is that the time cost is roughly equal to the fees.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does losing the documents cost altogether on this basis?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$615.00',
            reasoning: '$307.00 of fees plus $308.00 of time. Counting only the fees would understate the loss by about half.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price protecting them instead.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'A fire-resistant document box costs $78 and a secure digital backup service $4.50 a month. What does protection cost in the first year?',
            given: { box: 78, backup: 4.50 }, expr: 'box + backup * 12', format: 'usd', answer: '$132.00',
            reasoning: 'The $78 box plus $54.00 of backup across 12 months. The box is a one-off and the service is recurring, so later years cost only $54.00.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'How many times the first-year protection cost is the cost of losing the documents? Give two decimal places.',
            given: {}, expr: 'round(#t1-p3 / #t2-p1, 2)', format: 'dec2', answer: '4.66',
            reasoning: '$615.00 measured against $132.00. Unlike an insurance comparison, this one does not require estimating a probability: the protection cost is small enough that it is defensible even if loss is unlikely.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which of these should never be kept in the digital backup alongside scanned documents?',
            choices: ['Copies of the licence and title papers', 'Account passwords and security answers written in plain text', 'A list of which documents exist and where the originals are'],
            answer: 'Account passwords and security answers written in plain text',
            reasoning: 'Scanned documents and an inventory are the purpose of such a backup. Storing passwords and security answers in readable form puts every account behind them at risk from a single compromise of one store, which is the opposite of what the backup is for.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why the $615.00 figure understates what losing these documents would actually cost a household, and describe how you would organise document and account protection so that a single failure does not expose everything at once.',
            acceptableAnswerCriteria: [
              'Explains the understatement: the $615.00 counts fees and time to replace, but not the consequences of being without the documents while waiting — a delayed job, a missed deadline, or an inability to prove identity when it is needed.',
              'Adds the exposure the figure ignores entirely: documents that fall into someone else’s hands can be used to open accounts, which is a cost with no ceiling in this calculation.',
              'Describes separation as the organising principle: originals in one secured place, copies in another, and credentials in neither — kept in a purpose-built manager rather than alongside the documents — so a single loss or compromise does not yield everything.',
            ],
            evidenceRequirements: [
              'Uses the $615.00 replacement figure and the $132.00 first-year protection cost.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response separates credentials from documents rather than protecting them together.',
              'The response recognises that the replacement figure is a floor, not an estimate of the whole loss.',
            ],
            commonMisconception: 'Treating document security as a filing problem, when the larger exposure is that the documents can be used by someone else to open accounts.',
          },
        ],
      },
    ],
    remediation: 'If the protection cost comes out at $82.50, the backup service has been counted once rather than for the year. The box is a single $78 purchase and the service is $4.50 every month, so the first year is $78 plus twelve payments of $4.50.',
    extension: 'Work out the five-year cost of protection given that the box is bought once, and compare it with the $615.00 replacement figure.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l05',
    grade: 12, unit: 6, day: 5,
    actor: 'a fictional person discovering accounts opened in their name',
    objective: 'Quantify the exposure in a fictional identity incident, show how the stated reporting window changes liability, and set the response in order.',
    scenario: 'The simulated incident below is a fictional construction for this exercise. No real account, institution, or identifier appears anywhere in this lesson, and none is requested.',
    materials: ['calculator', 'the fictional incident figures in these directions'],
    domains: ['fraud', 'consumer-protection', 'credit', 'banking', 'insurance-risk'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A total of 3 fictional accounts have been opened in the person’s name, carrying charges of $1,240, $380, and $2,115. Under the fictional rules that apply here, a holder who reports within the stated window is liable for at most $50 on each account; a holder who reports after it is liable for up to $500 on each. A fictional monitoring service costs $13.99 a month and would be kept for 24 months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the fraudulent charges come to in total?',
            given: { c1: 1240, c2: 380, c3: 2115 }, expr: 'c1 + c2 + c3', format: 'usd', answer: '$3,735.00',
            reasoning: 'The three charges added. This is the amount in dispute, not the amount the person is liable for, and keeping those two separate is the first thing the arithmetic has to do.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the most the person is liable for if all three are reported inside the window?',
            given: { promptCap: 50, accounts: 3 }, expr: 'promptCap * accounts', format: 'usd', answer: '$150.00',
            reasoning: '$50 on each of the 3 accounts under the stated rule. The cap applies per account, so the number of accounts matters as much as the size of the charges.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the most they are liable for if all three are reported after the window?',
            given: { lateCap: 500, accounts2: 3 }, expr: 'lateCap * accounts2', format: 'usd', answer: '$1,500.00',
            reasoning: '$500 on each of the 3 accounts. The charges themselves have not changed; only the reporting date has.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price what promptness is worth and what follows the incident.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does reporting inside the window save?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$1,350.00',
            reasoning: '$1,500.00 against $150.00. The saving comes from acting on a date, not from anything else the person does.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would 24 months of the monitoring service cost?',
            given: { monitoring: 13.99, monitorMonths: 24 }, expr: 'monitoring * monitorMonths', format: 'usd', answer: '$335.76',
            reasoning: '$13.99 in each of 24 months. It is a cost that follows the incident rather than part of it, because the underlying exposure does not end when the three accounts are closed.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'What should the person do first on discovering the accounts?',
            choices: ['Pay the smallest charge to stop it growing', 'Report the accounts as not theirs and have the fraud recorded', 'Wait to see whether more accounts appear'],
            answer: 'Report the accounts as not theirs and have the fraud recorded',
            reasoning: 'Reporting starts the process that limits liability under the stated window and creates the record every later step depends on. Paying a charge would concede a debt the person does not owe, and waiting risks passing the window, which the figures show costs $1,350.00.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Set out the response to this incident in order, with a reason for the position of each step. Explain why the $3,735.00 is not the right measure of what the person stands to lose, and say what they should refuse to do even if someone contacting them about the incident asks.',
            acceptableAnswerCriteria: [
              'Gives an ordered response with reasons: report the accounts and have the fraud recorded first because the window governs liability, then have the accounts frozen or closed, then obtain and check the full record for anything further, then keep written copies of everything reported and when.',
              'Explains the measure: liability is capped per account, so the exposure is $150.00 reported promptly or $1,500.00 reported late, not the $3,735.00 charged — although the $3,735.00 is what must be disputed and removed.',
              'Names what to refuse: no one contacting the person about the incident should be given account numbers, passwords, security answers, or identifying documents, since a call or message about fraud is itself a common way of obtaining exactly those details.',
              'Notes the continuing exposure and its cost, such as the $335.76 of monitoring, because the details used to open three accounts can be used again.',
            ],
            evidenceRequirements: [
              'Uses the $150.00 and $1,500.00 liability figures and the $1,350.00 that promptness saves.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'evidence-use'],
            lookFors: [
              'The order is justified by what each step makes possible, not by convenience.',
              'The response never suggests paying a fraudulent charge.',
              'The response treats unsolicited contact about the incident as a risk in itself.',
            ],
            commonMisconception: 'Reading the total fraudulent charges as the amount at stake, when a per-account liability cap and the reporting date are what actually determine the loss.',
          },
        ],
      },
    ],
    remediation: 'If the liability comes out at $3,735.00, the charges are being treated as the exposure. Under the stated rules the holder is liable for at most $50 per account when reported inside the window, which is $150.00 across the 3 accounts. The $3,735.00 is what must be disputed, not what must be paid.',
    extension: 'Work out the liability if a fourth fictional account for $60 were found, reported late, and say whether the per-account cap or the charge decides that one.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l06',
    grade: 12, unit: 6, day: 6,
    actor: 'a fictional household reviewing protection after a move and a new dependent',
    objective: 'Reprice a fictional household’s whole protection set after a life change, attribute the increase to its causes, and identify the coverage gap the change created.',
    scenario: 'The fictional household, the simulated move, and the invented premiums below exist only for this exercise.',
    materials: ['calculator', 'the fictional before-and-after premiums in these directions'],
    domains: ['insurance-risk', 'budgeting', 'income', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Before the change the fictional household paid $17 a month for renters cover on $25,000 of property, $118 for auto, and $186 for single health cover, with no life cover. After moving and adding a dependent it would pay $26 for renters, $149 for auto in the new area, $402 for family health cover, and $28 for a new term life policy. The property is now worth $38,000.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What did protection cost each month before the change?',
            given: { rentersOld: 17, autoOld: 118, healthOld: 186 }, expr: 'rentersOld + autoOld + healthOld', format: 'usd', answer: '$321.00',
            reasoning: 'The three premiums held before the change. There was no life cover, so nothing is added for it here.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would it cost each month after the change?',
            given: { rentersNew: 26, autoNew: 149, healthNew: 402, lifeNew: 28 },
            expr: 'rentersNew + autoNew + healthNew + lifeNew', format: 'usd', answer: '$605.00',
            reasoning: 'The four premiums after the change, including the newly added life cover.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does the monthly cost rise?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$284.00',
            reasoning: '$605.00 against $321.00 — nearly double, from a move and one dependent.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now attribute the increase and check what the change left uncovered.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the increase come to across a year?',
            given: {}, expr: '#t1-p3 * 12', format: 'usd', answer: '$3,408.00',
            reasoning: '$284.00 in each of 12 months. A change of this size has to be found in the budget, so it belongs in the review rather than being absorbed silently.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of the increase is the health change and the new life cover together?',
            given: { healthNew2: 402, healthOld2: 186, lifeNew2: 28 }, expr: '(healthNew2 - healthOld2) + lifeNew2', format: 'usd', answer: '$244.00',
            reasoning: 'The $216.00 rise in health plus the $28 of new life cover. Both follow from the dependent rather than from the move, and together they are the great majority of the $284.00.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If the renters cover had been left at $25,000, how much of the property would be uncovered?',
            given: { propertyNew: 38000, coverOld: 25000 }, expr: 'propertyNew - coverOld', format: 'usd', answer: '$13,000.00',
            reasoning: '$38,000 of property against a $25,000 limit. This gap costs nothing in premium and would only appear at the moment of a claim, which is what makes it the most easily missed part of the review.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Of the $284.00 increase, $244.00 follows the dependent and $40.00 follows the move. Explain what that tells the household about which parts of a protection review are triggered by which kind of life change, and say why the $13,000.00 figure is more urgent than any of the premium increases.',
            acceptableAnswerCriteria: [
              'Draws the distinction: a new dependent changes who needs to be covered and adds cover types, producing $244.00 of the increase, while a move changes what the same cover costs, producing the remaining $40.00.',
              'Draws the practical conclusion: a change in household composition needs a review of what policies exist at all, while a move needs a review of the prices and terms of the policies already held.',
              'Explains the urgency of the gap: the $13,000.00 of uncovered property costs nothing now and is discovered only when a claim is made, at which point it cannot be fixed, whereas every premium increase is visible immediately.',
            ],
            evidenceRequirements: [
              'Uses the $244.00 attributable to the dependent, the $40.00 attributable to the move, and the $13,000.00 uncovered property.',
            ],
            dimensions: ['reasoning-from-figures', 'criteria-application', 'plan-coherence'],
            lookFors: [
              'The response identifies limits as something to review, not only premiums.',
              'The response treats an invisible gap as more dangerous than a visible cost.',
            ],
            commonMisconception: 'Reviewing protection after a life change by comparing premiums, which surfaces every price rise and none of the coverage limits that stopped matching the household.',
          },
        ],
      },
    ],
    remediation: 'If the increase attributable to the dependent comes out at $216.00, the new life cover has been left out. The dependent produced two changes: health rising from $186 to $402, which is $216.00, and $28 of life cover that did not exist before. Together they are $244.00 of the $284.00 total.',
    extension: 'Work out what the household would pay if it raised renters cover to $38,000 at a premium of $34 a month, and say whether that changes which life event drove most of the increase.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l07',
    grade: 12, unit: 6, day: 7,
    actor: 'a fictional adult who dropped two policies to reduce monthly costs',
    objective: 'Price what a fictional adult saved by dropping two policies against what those policies would have paid on stated events, and establish exactly what that comparison does and does not show.',
    scenario: 'The fictional policies, premiums, and the two simulated events below are invented for this exercise. The events are stated cases used to price exposure; nothing here establishes how likely either one is.',
    materials: ['calculator', 'the fictional policy terms and event figures in these directions'],
    domains: ['insurance-risk', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional adult dropped renters cover at $17 a month and disability cover at $24 a month, keeping auto and health. The renters policy would have paid a property loss less a $500 deductible. The disability policy would have replaced 60% of a $3,900 monthly income while the holder was unable to work. Consider a stated property loss of $9,400 and a stated period of 5 months unable to work.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the two dropped premiums save across a year?',
            given: { rentersPrem: 17, disabilityPrem: 24 }, expr: '(rentersPrem + disabilityPrem) * 12', format: 'usd', answer: '$492.00',
            reasoning: '$41 a month across 12 months. This saving is certain and arrives whether or not anything goes wrong.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would the renters policy have paid on the stated $9,400 loss?',
            given: { propertyLoss: 9400, deductible: 500 }, expr: 'propertyLoss - deductible', format: 'usd', answer: '$8,900.00',
            reasoning: 'The $9,400 loss less the $500 deductible.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the disability policy have paid across the stated 5 months?',
            given: { monthlyIncome: 3900, replaceRate: 0.6, monthsOut: 5 },
            expr: 'round(monthlyIncome * replaceRate * monthsOut, 2)', format: 'usd', answer: '$11,700.00',
            reasoning: '60% of $3,900 a month for 5 months. Disability cover replaces income rather than reimbursing a loss, so its value scales with how long the interruption lasts.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now set the two figures side by side and be precise about what the comparison establishes.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What would the two policies have paid across both stated events?',
            given: {}, expr: '#t1-p2 + #t1-p3', format: 'usd', answer: '$20,600.00',
            reasoning: '$8,900.00 from renters plus $11,700.00 from disability, on the two stated events.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'How many times the annual saving is that? Give two decimal places.',
            given: {}, expr: 'round(#t2-p1 / #t1-p1, 2)', format: 'dec2', answer: '41.87',
            reasoning: '$20,600.00 measured against the $492.00 saved. The ratio is large, but it compares a certain saving with a payout that only occurs if both events do.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Does this calculation show that dropping the two policies was the wrong decision?',
            choices: ['Yes — the potential payouts far exceed the saving', 'No — it prices the exposure without saying how likely either event is'],
            answer: 'No — it prices the exposure without saying how likely either event is',
            reasoning: 'Every figure here is conditional on two stated events occurring. The calculation establishes what the adult would forgo if they happened, which is a necessary input to the decision but not the decision itself; nothing in the scenario states a probability.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The 41.87 ratio is striking and does not by itself settle anything. Explain what would have to be added to make it a basis for a decision, and describe the situation in which dropping the disability cover is more serious than dropping the renters cover.',
            acceptableAnswerCriteria: [
              'Names what is missing: some estimate of how likely each event is, and — more importantly — what the household could absorb on its own, since a loss it could meet from reserves does not need to be transferred.',
              'Explains why the ratio alone misleads: it compares a certain $492.00 against a conditional $20,600.00, so it would look impressive for almost any policy against almost any large enough hypothetical event.',
              'Distinguishes the two cases: dropping disability cover is more serious for someone whose income is the household’s only one and whose reserves cannot cover several months, because the loss is not a single bill but the disappearance of the money everything else depends on.',
            ],
            evidenceRequirements: [
              'Uses the $492.00 annual saving and the $11,700.00 disability figure, and refers to the 41.87 ratio.',
            ],
            dimensions: ['communication-of-uncertainty', 'error-diagnosis', 'tradeoff-defense'],
            lookFors: [
              'The response resists concluding from the ratio alone.',
              'The response distinguishes a loss of assets from a loss of income.',
              'The response makes no recommendation about any real person’s cover.',
            ],
            commonMisconception: 'Treating a large ratio between a potential payout and a premium as proof that cover should be held, when the same ratio can be produced for any policy by choosing a large enough hypothetical loss.',
          },
        ],
      },
    ],
    remediation: 'If the disability figure comes out at $19,500.00, the full monthly income is being replaced rather than 60% of it. The stated policy replaces $2,340.00 a month, and over 5 months that is $11,700.00. Apply the replacement rate before multiplying by the number of months.',
    extension: 'Recompute the disability figure for a stated interruption of 14 months rather than 5, and say which of the two policies the change makes more valuable.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l08',
    grade: 12, unit: 6, day: 8,
    actor: 'a fictional young adult ageing off a family health plan',
    objective: 'Apply the coverage-gap method to a fictional enrolment deadline, compare three routes annually, and price what missing the window costs.',
    scenario: 'The fictional plan options, prices, and enrolment window below are invented for this exercise.',
    materials: ['calculator', 'the fictional plan options in these directions'],
    domains: ['insurance-risk', 'postsecondary-financing', 'budgeting', 'consumer-protection'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional young adult’s cover under a family plan ends on a stated date. A school plan costs $1,842 a year but must be taken within 31 days of that date. A fictional marketplace plan costs $268 a month and can be taken at any time. Continuation of the old cover costs $604 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the school plan work out to per month?',
            given: { schoolAnnual: 1842 }, expr: 'round(schoolAnnual / 12, 2)', format: 'usd', answer: '$153.50',
            reasoning: '$1,842 across 12 months. Converting the annual price to a monthly one is what makes the three routes comparable.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the marketplace plan cost across a year?',
            given: { marketMonthly: 268 }, expr: 'marketMonthly * 12', format: 'usd', answer: '$3,216.00',
            reasoning: '$268 in each of the 12 months. This route carries no enrolment window, which is part of what it is being paid for.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does continuation cost across a year?',
            given: { continuationMonthly: 604 }, expr: 'continuationMonthly * 12', format: 'usd', answer: '$7,248.00',
            reasoning: '$604 in each of 12 months — nearly four times the school plan, which is why the enrolment window is worth a diary entry.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price the window itself.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much cheaper is a year on the school plan than a year of continuation?',
            given: { schoolAnnual2: 1842 }, expr: '#t1-p3 - schoolAnnual2', format: 'usd', answer: '$5,406.00',
            reasoning: '$7,248.00 against $1,842. The gap is the value of acting within the 31 days.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If the window is missed and continuation is used for 4 months until the next enrolment opportunity, what does that cost?',
            given: { continuationMonthly2: 604, bridgeMonths: 4 }, expr: 'continuationMonthly2 * bridgeMonths', format: 'usd', answer: '$2,416.00',
            reasoning: '$604 in each of the 4 bridging months. This is the price of a missed date rather than of any coverage decision.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Is the cost of missing the 31-day window larger than a full year of the school plan?',
            choices: ['Yes — bridging for 4 months costs more than the whole school year', 'No — bridging is the cheaper option'],
            decision: { left: '#t2-p2', cmp: '>', right: '#t1-p1 * 12', ifTrue: 'Yes — bridging for 4 months costs more than the whole school year', ifFalse: 'No — bridging is the cheaper option' },
            answer: 'Yes — bridging for 4 months costs more than the whole school year',
            reasoning: '$2,416.00 for 4 months of continuation against $1,842 for a whole year of the school plan. Missing a date costs more than the entire cheaper option would have.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why the 31-day window is the most important figure in this lesson even though it is not a price, and say what a fictional person should have in place before that date arrives so the decision is not made by default.',
            acceptableAnswerCriteria: [
              'Explains the role of the window: it is what makes the $1,842 option available at all, so missing it removes the cheapest route and leaves only options costing $3,216.00 or $7,248.00 a year.',
              'Quantifies the cost of default: bridging for 4 months at $2,416.00 exceeds a whole year of the school plan, so doing nothing is the most expensive choice available.',
              'Describes concrete preparation: knowing the exact date cover ends, having the enrolment requirements to hand in advance, and setting a reminder several weeks before rather than on the day.',
            ],
            evidenceRequirements: [
              'Uses the $1,842 school-plan year and the $2,416.00 cost of bridging 4 months after a missed window.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'transfer'],
            lookFors: [
              'The response treats the deadline as the decision point rather than as paperwork.',
              'The response recognises that the default outcome — doing nothing — is both expensive and easy to reach.',
            ],
            commonMisconception: 'Comparing insurance options on price alone, when eligibility windows determine which of the prices is available at all.',
          },
        ],
      },
    ],
    remediation: 'If the school plan looks more expensive than the marketplace plan, the annual and monthly prices are being compared directly. Put both on the same basis: the school plan is $153.50 a month, against $268 a month for the marketplace plan and $604 for continuation.',
    extension: 'Work out the cheapest total cost of the first year if the window is missed by one day and continuation is used until the next opportunity, and say how much of the school plan’s advantage survives.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l09',
    grade: 12, unit: 6, day: 9,
    actor: 'a fictional household sizing a reserve against both deductibles and a waiting period',
    objective: 'Combine a fictional household’s deductibles with the cash-flow gap a disability waiting period creates, and build a single reserve target from both.',
    scenario: 'The fictional policy terms, income, and waiting period below are invented for this exercise.',
    materials: ['calculator', 'the fictional policy and income figures in these directions'],
    domains: ['insurance-risk', 'saving-investing', 'income', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household has essential costs of $3,120 a month and monthly income of $4,400. Its deductibles are $2,400 on health, $750 on auto, and $1,200 on home. Its disability policy replaces 60% of income but pays nothing during a waiting period of the first 3 months.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the three deductibles come to?',
            given: { healthDed: 2400, autoDed: 750, homeDed: 1200 }, expr: 'healthDed + autoDed + homeDed', format: 'usd', answer: '$4,350.00',
            reasoning: 'The three deductibles added — the cash the household must produce before any policy pays anything.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do essential costs come to across the 3-month waiting period, when the disability policy pays nothing?',
            given: { essential: 3120 }, expr: 'essential * 3', format: 'usd', answer: '$9,360.00',
            reasoning: '$3,120 a month for the 3 months before any benefit begins. The policy exists and still pays nothing in this window, which is the part of a disability policy most easily overlooked.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What reserve covers both the deductibles and the waiting period?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$13,710.00',
            reasoning: '$4,350.00 of deductibles plus $9,360.00 of essential costs during the wait. Both are cash requirements the policies create rather than remove.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now check what happens once the benefit does begin.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the monthly disability benefit?',
            given: { income: 4400, replaceRate: 0.6 }, expr: 'round(income * replaceRate, 2)', format: 'usd', answer: '$2,640.00',
            reasoning: '60% of $4,400 of monthly income.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What monthly shortfall remains once the benefit is being paid?',
            given: { essential2: 3120 }, expr: 'essential2 - #t2-p1', format: 'usd', answer: '$480.00',
            reasoning: '$3,120 of essential costs against a $2,640.00 benefit. The policy narrows the gap sharply but does not close it, because it replaces a fraction of income rather than covering costs.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What reserve covers that shortfall for a further 6 months?',
            given: { furtherMonths: 6 }, expr: '#t2-p2 * furtherMonths', format: 'usd', answer: '$2,880.00',
            reasoning: '$480.00 a month for a further 6 months. The shortfall continues for as long as the interruption does, so this component grows with the length of the event rather than being fixed by a policy term.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the full reserve target?',
            given: {}, expr: '#t1-p3 + #t2-p3', format: 'usd', answer: '$16,590.00',
            reasoning: '$13,710.00 for the deductibles and the waiting period, plus $2,880.00 for the shortfall that continues afterwards.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a short paragraph.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This household holds insurance and still needs $16,590.00 in reserve. Explain why cover and reserves are not substitutes for one another, and identify which single change to the policy terms would reduce the reserve target most, saying what it would cost.',
            acceptableAnswerCriteria: [
              'Explains the relationship: policies pay only after deductibles are met and, in the disability case, only after a waiting period, so a reserve is what carries the household through the periods and amounts the policies deliberately exclude.',
              'Uses the figures to show it: $4,350.00 of deductibles and $9,360.00 of waiting-period costs are both created by the structure of the cover, not by its absence.',
              'Identifies the highest-impact change and prices it: shortening the 3-month waiting period would remove up to $9,360.00 from the target, more than any deductible change could, and would be paid for with a higher premium.',
            ],
            evidenceRequirements: [
              'Uses the $9,360.00 waiting-period figure, the $4,350.00 of deductibles, and the $16,590.00 total target.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'tradeoff-defense'],
            lookFors: [
              'The response identifies the waiting period as the largest single component of the target.',
              'The response recognises the $480.00 continuing shortfall rather than treating the benefit as sufficient.',
            ],
            commonMisconception: 'Assuming that holding insurance removes the need for a reserve, when deductibles and waiting periods are precisely the gaps a reserve exists to fill.',
          },
        ],
      },
    ],
    remediation: 'If the target comes out at $4,350.00, only the deductibles have been counted. The disability policy pays nothing for the first 3 months, so $9,360.00 of essential costs must also be met from reserves, and a $480.00 monthly shortfall continues after that. Add all three components.',
    extension: 'Recompute the target for a fictional policy with a 1-month waiting period and a 70% replacement rate, and say which of the two changes does more to reduce it.',
  },

  {
    lessonId: 'ma-g12-financial-literacy-u06-l10',
    grade: 12, unit: 6, day: 10,
    actor: 'a fictional household building a complete protection and security plan',
    objective: 'Assemble the annual cost of a fictional household’s document and account security, set it against the cost of one stated incident, and write the plan the figures support.',
    scenario: 'The fictional household, the protection prices, and the simulated incident below are invented for this exercise. No real credential, account, or identifier appears in this lesson, and none is requested.',
    materials: ['calculator', 'the fictional protection prices and incident figures in these directions'],
    domains: ['fraud', 'consumer-protection', 'insurance-risk', 'banking', 'budgeting', 'multi-variable-decision'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional household earns $52,000 a year and is pricing four protections: a fire-resistant document box at $78 bought once and used for 5 years, a password manager at $36 a year, a monitoring service at $168 a year, and secure backup at $54 a year. A stated incident would bring $2,860 of fraudulent charges, $214 of document replacement, and about 18 hours of work, valued here at $24 an hour so the time is comparable with the fees.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the whole protection set cost in a year, spreading the box across its 5 years?',
            given: { box: 78, passwordMgr: 36, monitoring: 168, backup: 54 },
            expr: 'round(box / 5 + passwordMgr + monitoring + backup, 2)', format: 'usd', answer: '$273.60',
            reasoning: '$15.60 a year for the box, plus the three annual services. Spreading a durable one-off purchase across its life is what makes it comparable with recurring costs.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of income is that, to two decimal places?',
            given: { income: 52000 }, expr: 'round(#t1-p1 / income * 100, 2)', format: 'percent2', answer: '0.53%',
            reasoning: '$273.60 measured against $52,000. Expressing it this way sets it against the 8.85% a full insurance set can cost, which is a useful sense of scale.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the stated incident cost in total?',
            given: { charges: 2860, docReplace: 214, hours: 18, hourly: 24 },
            expr: 'charges + docReplace + hours * hourly', format: 'usd', answer: '$3,506.00',
            reasoning: '$2,860 of charges, $214 of replacements, and $432.00 of time. The time is nearly as large as the document replacement and is the component most often left out.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now set the two against each other over a realistic period.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'How many years of protection does one incident cost? Give two decimal places.',
            given: {}, expr: 'round(#t1-p3 / #t1-p1, 2)', format: 'dec2', answer: '12.81',
            reasoning: '$3,506.00 measured against $273.60 a year. Unlike an insurance comparison this does not need a probability estimate to be useful, because the protection cost is small relative to a single incident.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What would the protection set cost across 5 years?',
            given: {}, expr: '#t1-p1 * 5', format: 'usd', answer: '$1,368.00',
            reasoning: '$273.60 a year for 5 years. Even across five years the protection costs less than half of one stated incident.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which of these protections reduces the chance of the incident happening at all, rather than helping the household recover afterwards?',
            choices: ['The monitoring service', 'The password manager', 'The fire-resistant document box'],
            answer: 'The password manager',
            reasoning: 'A password manager reduces the chance of accounts being compromised by making distinct strong credentials practical. Monitoring detects misuse after it begins, and the document box protects originals from physical loss; both are valuable, but neither prevents an account from being taken over.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Write the plan. Attach a figure to each part.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write the fictional household’s protection and security plan. Say what is bought and what is done, distinguish the parts that prevent an incident from the parts that limit one, state what the household should never do regardless of who asks, and name the part of your plan you would drop first if the budget required it.',
            acceptableAnswerCriteria: [
              'Specifies what is bought with figures — for example the full set at $273.60 a year, or a subset with the omission justified — and what is done, such as storing originals and copies separately and keeping credentials only in the manager.',
              'Separates prevention from limitation: distinct strong credentials and separated storage reduce the chance of an incident, while monitoring and a document inventory reduce what one costs once it starts.',
              'States a firm rule about disclosure: no account number, password, security answer, or identifying document is given to anyone who makes contact unprompted, whatever the apparent urgency, because that contact is itself a common route into an account.',
              'Names what would be dropped first and gives a reason — most defensibly the $168 monitoring service, since it is the largest single line and detects rather than prevents, leaving prevention intact.',
            ],
            evidenceRequirements: [
              'Uses the $273.60 annual protection cost and the $3,506.00 incident cost, and refers to the 12.81 years of protection one incident represents.',
              'Names the specific line that would be dropped first and its cost.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'evidence-use', 'tradeoff-defense'],
            lookFors: [
              'The plan distinguishes prevention from detection rather than treating all four purchases as equivalent.',
              'The plan states a disclosure rule that holds even under pressure.',
              'A response that keeps monitoring and drops something else is credited when the reason is given.',
            ],
            commonMisconception: 'Building a security plan out of purchases alone, when the habits — separated storage, distinct credentials, and never disclosing details to unsolicited contact — carry most of the protection and cost nothing.',
          },
        ],
      },
    ],
    remediation: 'If the annual protection cost comes out at $336.00, the $78 box has been charged in full to the first year rather than spread across the 5 years it is used for. Divide it by 5 to get $15.60, then add the three annual services of $36, $168, and $54.',
    extension: 'Recompute the annual protection cost and the years-per-incident figure without the monitoring service, and say how much protection the household gives up for the $168 saved.',
  },
]
