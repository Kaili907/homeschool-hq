import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 2 — PF2 Buying Goods and Services: Contracts, Disclosures,
 * and Consumer Protection.
 */
export const g10u02: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u02-l01',
    grade: 10, unit: 2, day: 1,
    actor: 'a fictional member signing a minimum-term contract',
    objective: 'Compute the full obligation a fictional contract creates, then compute what leaving it early actually costs and what that makes each month of use worth.',
    scenario: 'The simulated membership contract below is invented for this exercise. No real provider, contract, or member is described.',
    materials: ['calculator', 'the fictional contract terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional contract: $39 a month, a minimum term of 18 months, a joining fee of $75 paid at signing, and an early-exit buyout of 50% of the payments remaining in the minimum term.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the full obligation the contract creates if it runs the whole minimum term?',
            given: { joining: 75, monthly: 39, term: 18 }, expr: 'joining + monthly * term', format: 'usd', answer: '$777.00',
            reasoning: 'The $75 joining fee plus 18 monthly payments of $39 — the amount committed at signature, not the $39 the advertisement leads with.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'A member who stops attending after 5 months has paid how much by then?',
            given: { joining2: 75, monthly2: 39, used: 5 }, expr: 'joining2 + monthly2 * used', format: 'usd', answer: '$270.00',
            reasoning: '$75 at signing plus five monthly payments.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the early-exit buyout at that point, at 50% of the 13 remaining payments?',
            given: { monthly3: 39, remaining: 13, buyoutRate: 0.5 }, expr: 'monthly3 * remaining * buyoutRate', format: 'usd', answer: '$253.50',
            reasoning: '13 payments of $39 remain in the minimum term, and the contract charges half of them to exit.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find what the five months actually cost.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of joining and leaving after 5 months?',
            given: {}, expr: '#t1-p2 + #t1-p3', format: 'usd', answer: '$523.50',
            reasoning: '$270.00 already paid plus the $253.50 buyout.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does that make each month of use cost?',
            given: { used2: 5 }, expr: 'round(#t2-p1 / used2, 2)', format: 'usd', answer: '$104.70',
            reasoning: '$523.50 across the 5 months actually used, against an advertised $39 a month.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more per month of use is that than the advertised monthly price?',
            given: { monthly4: 39 }, expr: '#t2-p2 - monthly4', format: 'usd', answer: '$65.70',
            reasoning: '$104.70 against the $39 headline.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Name the two terms in this contract that turn "$39 a month" into an obligation of $777, and say which single question a person should answer honestly before signing anything with a minimum term.',
            acceptableAnswerCriteria: [
              'Identifies the 18-month minimum term and the joining fee as the two terms that create the $777 obligation, and the buyout clause as what prices leaving.',
              'Poses the honest question: how likely am I to still be using this in 18 months, given that stopping does not stop the payments.',
              'Notes that the buyout reduces but does not remove the obligation — $253.50 of the remaining $507 is still owed.',
            ],
            evidenceRequirements: [
              'Uses the $777.00 full obligation and the $104.70 per-month-of-use figure.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the monthly price as the price of a month only if the term is completed.',
              'The response does not describe the buyout as a penalty for something wrong; it is a disclosed term.',
            ],
            commonMisconception: 'Reading a monthly price on a minimum-term contract as a monthly commitment that can be stopped at will.',
          },
        ],
      },
    ],
    remediation: 'If the exit cost comes out as $253.50 alone, the money already paid is being left out. The question is what the five months cost in total, so both the $270.00 paid and the $253.50 buyout belong in the numerator.',
    extension: 'Find the month at which leaving early stops costing more per month of use than $39, and say what that tells you about when in a contract the terms bite hardest.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l02',
    grade: 10, unit: 2, day: 2,
    actor: 'a fictional subscriber comparing monthly and annual billing',
    objective: 'Compare a fictional subscription’s monthly and annual prices, price the risk that an auto-renewal is missed, and decide which billing choice fits which subscriber.',
    scenario: 'The simulated subscription below bills either monthly or annually and renews automatically. All terms are invented for this exercise.',
    materials: ['calculator', 'the fictional subscription terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional subscription costs $12.99 a month billed monthly, or $119 a year billed once in advance. Both renew automatically unless cancelled. A 30-day free trial converts automatically to the annual plan.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the annual plan work out to per month? Round to the nearest cent.',
            given: { annual: 119 }, expr: 'round(annual / 12, 2)', format: 'usd', answer: '$9.92',
            reasoning: '$119 spread across twelve months.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of monthly billing cost?',
            given: { monthly: 12.99 }, expr: 'monthly * 12', format: 'usd', answer: '$155.88',
            reasoning: 'Twelve monthly charges of $12.99, which is what a year of monthly billing comes to.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does the annual plan save over a full year of use?',
            given: { annual2: 119 }, expr: '#t1-p2 - annual2', format: 'usd', answer: '$36.88',
            reasoning: '$155.88 against $119 — a real saving, but only for someone who uses the full year.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now price what auto-renewal costs when it is missed.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'A monthly subscriber stops using the service but does not cancel for 7 more months. What does that cost?',
            given: { monthly2: 12.99, unusedMonths: 7 }, expr: 'round(monthly2 * unusedMonths, 2)', format: 'usd', answer: '$90.93',
            reasoning: '7 unused months at $12.99, charged automatically.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'A subscriber who is unsure whether they will still want the service in three months should choose which plan?',
            choices: ['The annual plan, to capture the $36.88 saving', 'The monthly plan, despite the higher rate'],
            given: { monthlyRate3: 12.99, annual3: 119 },
            decision: { left: 'monthlyRate3 * 3', cmp: '<', right: 'annual3', ifTrue: 'The monthly plan, despite the higher rate', ifFalse: 'The annual plan, to capture the $36.88 saving' },
            answer: 'The monthly plan, despite the higher rate',
            reasoning: 'Three months of monthly billing costs $38.97 against $119 paid in advance for the year, so the annual saving is only available to someone who will actually use the year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does a subscriber lose by taking the annual plan and stopping after 3 months?',
            given: { annual4: 119, monthly3: 12.99, usedMonths: 3 }, expr: 'round(annual4 - monthly3 * usedMonths, 2)', format: 'usd', answer: '$80.03',
            reasoning: '$119 paid against $38.97 of value used, assuming no refund on cancellation.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A free trial that converts automatically to the $119 annual plan is a different offer from a free trial that ends. Explain the difference in terms of who has to act, and say what a subscriber should do at the moment they start the trial.',
            acceptableAnswerCriteria: [
              'States that automatic conversion places the burden of action on the subscriber: doing nothing results in a $119 charge rather than in nothing happening.',
              'Recommends a concrete action at the start of the trial — setting a reminder several days before day 30, or cancelling immediately if the trial runs to term regardless.',
              'Connects this to the $90.93 figure: forgetting is not a small error when charges continue automatically.',
            ],
            evidenceRequirements: [
              'Uses the $119 annual price and either the $90.93 or the $80.03 figure.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the default as the design feature that matters.',
              'The response does not treat auto-renewal as hidden; it is disclosed, and that is the point.',
            ],
            commonMisconception: 'Treating a free trial as risk-free without checking what happens if nothing is done at the end of it.',
          },
        ],
      },
    ],
    remediation: 'If the annual plan looks better in every case, notice what the $36.88 saving assumes: a full year of use. Compute the cost of each plan for three months and for twelve, and compare the two pairs.',
    extension: 'Find the number of months of use at which the annual plan stops being the more expensive choice, and say how a subscriber could estimate that in advance.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l03',
    grade: 10, unit: 2, day: 3,
    actor: 'a fictional buyer with a defective purchase and two possible remedies',
    objective: 'Compare a fictional return route with a fictional warranty route on the same defect, compute what each recovers, and identify which remedy the timing allows.',
    scenario: 'A fictional buyer paid $429 for a simulated appliance. The store policy and manufacturer warranty below are invented for this exercise.',
    materials: ['calculator', 'the fictional policy and warranty terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional store policy: returns accepted within 30 days, subject to a 15% restocking fee. The fictional manufacturer warranty: 12 months, covering repair or replacement of a defect at no charge. The defect appears on day 45.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'If the buyer could still return it, what would the restocking fee be?',
            given: { price: 429, restockRate: 0.15 }, expr: 'round(price * restockRate, 2)', format: 'usd', answer: '$64.35',
            reasoning: '15% of the $429 purchase price.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What refund would a return produce?',
            given: { price2: 429 }, expr: 'price2 - #t1-p1', format: 'usd', answer: '$364.65',
            reasoning: '$429 less the $64.35 restocking fee.',
          },
          {
            ref: 't1-p3', kind: 'choice',
            text: 'On day 45, which remedy is actually available?',
            choices: ['The store return', 'The manufacturer warranty', 'Both', 'Neither'],
            given: { dayOfDefect: 45, returnWindow: 30 },
            decision: { left: 'dayOfDefect', cmp: '>', right: 'returnWindow', ifTrue: 'The manufacturer warranty', ifFalse: 'Both' },
            answer: 'The manufacturer warranty',
            reasoning: 'Day 45 is past the 30-day return window, so only the 12-month warranty remains open.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare the value of the two remedies.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'What does the warranty route cost the buyer for the repair itself?',
            choices: ['Nothing', '$64.35, the restocking fee', '$429, the purchase price'],
            answer: 'Nothing',
            reasoning: 'The warranty covers repair or replacement at no charge, so unlike the return route it costs the buyer nothing and leaves them with a working appliance.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much better off is the buyer under the warranty than they would have been returning it on day 20?',
            given: { price3: 429 }, expr: 'price3 - #t1-p2', format: 'usd', answer: '$64.35',
            reasoning: 'The warranty leaves the buyer with a working $429 appliance; the return would have left them with $364.65 and no appliance, so the difference is the restocking fee.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'For a buyer who has decided they do not want the appliance at all, which remedy is better?',
            choices: ['The store return, even with the fee', 'The manufacturer warranty'],
            answer: 'The store return, even with the fee',
            reasoning: 'The warranty produces a working appliance, which is worth nothing to a buyer who does not want one; only the return converts the purchase back into money, and it must be used inside 30 days.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'These two remedies solve different problems and expire at different times. Set out when each one is the right tool, and say what a buyer should check in the first 30 days of owning something expensive.',
            acceptableAnswerCriteria: [
              'States that a return solves "I do not want this" and a warranty solves "this does not work", and that only the first converts the item back into money.',
              'Notes the asymmetry in timing: the return window is 30 days and the warranty runs 12 months, so the shorter one has to be used or lost.',
              'Recommends a concrete check inside 30 days — test everything the item is meant to do — because after day 30 an unwanted item cannot be returned even if the fault is real.',
            ],
            evidenceRequirements: [
              'Uses the $364.65 refund figure and the day-45 timing.',
            ],
            dimensions: ['criteria-application', 'plan-coherence', 'transfer'],
            lookFors: [
              'The response recognises the restocking fee makes the return route lossy but still the only route to a refund.',
              'The response does not treat the warranty as a substitute for a return.',
            ],
            commonMisconception: 'Assuming a long warranty makes the short return window unimportant.',
          },
        ],
      },
    ],
    remediation: 'If the two remedies look interchangeable, ask what the buyer holds at the end of each: under the warranty, a working appliance; under the return, $364.65 and no appliance. Which is better depends entirely on whether the appliance is wanted.',
    extension: 'Suppose the warranty covered parts only and the repair needed $110 of labour. Recompute both routes and say whether the day-30 decision would have changed.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l04',
    grade: 10, unit: 2, day: 4,
    actor: 'a fictional regulator introducing a disclosure requirement',
    objective: 'Compute defect reporting rates before and after a fictional disclosure requirement, and distinguish a change in what is known from a change in what is happening.',
    scenario: 'A fictional consumer protection agency requires sellers of a simulated product to publish a defect and complaint disclosure. The reporting figures below are invented for this exercise.',
    materials: ['calculator', 'the fictional reporting figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Before the requirement, 3 defects were reported out of 240 units sold in the period. After the requirement, with a published complaint route and a disclosure box on the packaging, 16 defects were reported out of the same 240 units sold in the next comparable period.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What was the reported defect rate before the requirement? Round to two decimal places.',
            given: { before: 3, units: 240 }, expr: 'round(before / units * 100, 2)', format: 'percent2', answer: '1.25%',
            reasoning: '3 defect reports against the 240 units sold in that period.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What was the reported defect rate after? Round to one decimal place.',
            given: { after: 16, units2: 240 }, expr: 'round(after / units2 * 100, 1)', format: 'percent1', answer: '6.7%',
            reasoning: '16 defect reports against the same 240 units sold in the later comparable period.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'By what factor did the reported rate rise? Round to two decimal places.',
            given: { before2: 3, after2: 16 }, expr: 'round(after2 / before2, 2)', format: 'dec2', answer: '5.33',
            reasoning: '16 reports against 3, on the same number of units sold.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Interpret the change.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'What does the rise in the reported rate most likely show?',
            choices: [
              'The product became five times more defective',
              'More of the defects that were already occurring are now being reported',
              'The disclosure requirement caused defects',
              'The data cannot support any interpretation',
            ],
            answer: 'More of the defects that were already occurring are now being reported',
            reasoning: 'The intervention changed how easy it is to report and how visible the route is, not how the product is made, so the most direct reading is that the earlier 1.25% understated what was happening.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'How many additional defects were reported in the second period?',
            given: { before3: 3, after3: 16 }, expr: 'after3 - before3', format: 'int', answer: '13',
            reasoning: '16 reports against 3 on the same 240 units.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A seller argues that the disclosure requirement made their product look worse without making anything better for buyers. Answer that argument, and say what evidence would be needed to know whether the requirement actually helped.',
            acceptableAnswerCriteria: [
              'Answers the argument directly: the 6.7% figure is closer to the truth than the 1.25% figure, and buyers making a decision are better served by a more accurate number even if it is less flattering.',
              'Notes that a working complaint route also gives buyers a remedy they previously did not use, which is a benefit distinct from the disclosure.',
              'Names evidence that would settle it — whether defects per unit actually fell over later periods, whether more buyers obtained remedies, and whether buyers changed which products they bought.',
            ],
            evidenceRequirements: [
              'Uses both reported rates, 1.25% and 6.7%, and the 240-unit denominator.',
            ],
            dimensions: ['evidence-use', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response recognises the seller’s factual claim is correct — the product does look worse — and disputes the conclusion rather than the fact.',
              'The response does not assert that defects fell; nothing in the data shows that.',
            ],
            commonMisconception: 'Reading a rise in reported problems as a rise in problems.',
          },
        ],
      },
    ],
    remediation: 'If the two rates look like they measure the same thing, write out what each one counts: reports, not defects. The denominator is identical at 240 units; only the willingness and ability to report changed between the periods.',
    extension: 'Suppose a third period shows 11 reports out of 300 units. Compute that rate and say whether it is evidence that the product improved.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l05',
    grade: 10, unit: 2, day: 5,
    actor: 'a fictional buyer comparing two printers on cost per page',
    objective: 'Compare two fictional products on total cost of ownership rather than purchase price, and find the usage level at which the ranking flips.',
    scenario: 'Two fictional printers differ in purchase price and in running cost. Every figure below is invented for this exercise.',
    materials: ['calculator', 'the two fictional product summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Printer A costs $129 and its ink cartridge costs $42 and prints 260 pages. Printer B costs $219 and its cartridge costs $58 and prints 620 pages.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is Printer A’s ink cost per page? Round to two decimal places.',
            given: { inkA: 42, pagesA: 260 }, expr: 'round(inkA / pagesA, 2)', format: 'dec2', answer: '0.16',
            reasoning: '$42 divided by the 260 pages a cartridge prints.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Printer B’s ink cost per page? Round to two decimal places.',
            given: { inkB: 58, pagesB: 620 }, expr: 'round(inkB / pagesB, 2)', format: 'dec2', answer: '0.09',
            reasoning: '$58 divided by 620 pages — a little over half of Printer A’s rate.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Printer A cost in total to print 3,000 pages, counting the purchase? Round to the nearest cent.',
            given: { priceA: 129, inkA2: 42, pagesA2: 260, target: 3000 },
            expr: 'round(priceA + target / pagesA2 * inkA2, 2)', format: 'usd', answer: '$613.62',
            reasoning: '$129 to buy plus 3,000 pages of ink at the cartridge rate.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Finish the comparison and find where it turns.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Printer B cost in total to print 3,000 pages? Round to the nearest cent.',
            given: { priceB: 219, inkB2: 58, pagesB2: 620, target2: 3000 },
            expr: 'round(priceB + target2 / pagesB2 * inkB2, 2)', format: 'usd', answer: '$499.65',
            reasoning: '$219 to buy plus 3,000 pages of ink at the cheaper cartridge rate.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much cheaper is Printer B over 3,000 pages?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$113.97',
            reasoning: '$613.62 against $499.65, despite Printer B costing $90 more to buy.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'At how many pages do the two printers cost the same in total? Round to one decimal place.',
            given: { priceA2: 129, priceB2: 219, inkA3: 42, pagesA3: 260, inkB3: 58, pagesB3: 620 },
            expr: 'round((priceB2 - priceA2) / (inkA3 / pagesA3 - inkB3 / pagesB3), 1)', format: 'dec1', answer: '1,323.7',
            reasoning: 'Printer B starts $90 behind and closes the gap at about $0.068 a page, so the totals meet at roughly 1,324 pages.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain what a buyer needs to know about themselves before this comparison can produce an answer, and say what a seller advertising only the $129 price is relying on.',
            acceptableAnswerCriteria: [
              'Identifies expected page volume as the one thing the buyer must supply, and notes the crossover at about 1,324 pages.',
              'States that below that volume Printer A really is cheaper, so neither product is simply better.',
              'Says what the $129 headline relies on: buyers comparing purchase prices and discovering the running cost only after the decision.',
            ],
            evidenceRequirements: [
              'Uses the two cost-per-page figures and the 1,323.7-page crossover.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response treats page volume as an estimate the buyer must make rather than a fact the comparison supplies.',
              'The response does not conclude that the cheaper printer is a trick.',
            ],
            commonMisconception: 'Comparing products on purchase price when the consumable is the larger lifetime cost.',
          },
        ],
      },
    ],
    remediation: 'If the crossover comes out near 2,000 pages, check the denominator: the gap closes at the difference between the two per-page rates, about $0.068, not at either rate on its own. Compute the two rates unrounded before subtracting.',
    extension: 'Add a fictional Printer C at $89 with a $39 cartridge printing 180 pages, and say at what volume it stops being the cheapest of the three.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l06',
    grade: 10, unit: 2, day: 6,
    actor: 'a fictional consumer escalating a disputed charge',
    objective: 'Track a fictional complaint through its stages, compute what escalating recovered, and price the effort against the recovery.',
    scenario: 'A fictional consumer disputes a simulated charge of $268.40. The timeline and offers below are invented for this exercise.',
    materials: ['calculator', 'the fictional complaint timeline in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional timeline: the disputed charge is $268.40. On day 3 the consumer telephones and gets no resolution. By day 17 there has been no response. On day 18 they send a written complaint keeping a copy. On day 26 the seller offers $120 as a partial settlement. The consumer escalates to a complaints body, and on day 41 the full $268.40 is refunded. Total time spent across all stages is 4.5 hours.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more did escalating recover than accepting the partial offer?',
            given: { charge: 268.4, partialOffer: 120 }, expr: 'charge - partialOffer', format: 'usd', answer: '$148.40',
            reasoning: 'The full $268.40 refund against the $120 offered on day 26.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What did that additional recovery work out to per hour of the consumer’s time? Round to the nearest cent.',
            given: { hours: 4.5 }, expr: 'round(#t1-p1 / hours, 2)', format: 'usd', answer: '$32.98',
            reasoning: '$148.40 recovered across 4.5 hours of calls, writing, and following up.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'How many days passed between the first contact and the resolution?',
            given: { firstContact: 3, resolved: 41 }, expr: 'resolved - firstContact', format: 'int', answer: '38',
            reasoning: 'From the first contact on day 3 to the resolution on day 41.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Compare the whole recovery with the effort.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Taking the whole $268.40 as what the complaint recovered, what was that per hour? Round to the nearest cent.',
            given: { charge2: 268.4, hours2: 4.5 }, expr: 'round(charge2 / hours2, 2)', format: 'usd', answer: '$59.64',
            reasoning: '$268.40 across 4.5 hours, if the alternative to complaining at all was recovering nothing.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Which single step in the timeline most likely made the escalation possible?',
            choices: [
              'The telephone call on day 3',
              'The written complaint on day 18, of which a copy was kept',
              'The partial offer on day 26',
              'Waiting until day 41',
            ],
            answer: 'The written complaint on day 18, of which a copy was kept',
            reasoning: 'A complaints body needs a record of what was claimed and when; the telephone call left none, and the kept copy is what turned the dispute into something a third party could act on.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The partial offer on day 26 was $120 against a $268.40 claim. Explain what a partial offer at that stage is testing, and set out the rule you would use to decide whether to accept one.',
            acceptableAnswerCriteria: [
              'Explains that a partial offer tests whether the consumer will stop for less than the full claim, and that accepting typically ends the dispute.',
              'Sets out a usable rule that weighs the amount still in dispute against the effort and uncertainty of continuing — here, $148.40 more for an unknown amount of further time.',
              'Acknowledges the uncertainty honestly: the full recovery was not guaranteed at day 26, so accepting $120 would not have been unreasonable.',
            ],
            evidenceRequirements: [
              'Uses the $120 offer, the $148.40 still in dispute, and the 4.5 hours spent.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'plan-coherence'],
            lookFors: [
              'The response does not treat the eventual full recovery as proof that accepting would have been a mistake.',
              'The rule offered could be applied to a different dispute.',
            ],
            commonMisconception: 'Judging a decision made under uncertainty by the outcome that happened to follow.',
          },
        ],
      },
    ],
    remediation: 'If the per-hour figure is being computed from the $120 offer, reread the question: it asks what escalating recovered beyond the offer, which is the $148.40 difference, not the offer itself.',
    extension: 'Recompute both per-hour figures if the dispute had taken 14 hours instead of 4.5, and say at what point the effort stops being worth the amount at stake.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l07',
    grade: 10, unit: 2, day: 7,
    actor: 'a fictional customer who believed cancelling ended the obligation',
    objective: 'Find the error in a fictional belief that cancelling a service ends the obligation immediately, compute what is actually owed under the notice term, and state what would have avoided it.',
    scenario: 'A fictional customer wrote: "I cancelled on the 12th, so I do not owe anything more." The simulated contract terms below are invented for this exercise.',
    materials: ['the fictional contract terms in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional contract: $86 a month, billed on the 1st, requiring 30 days written notice to cancel. The customer telephoned on the 12th and sent nothing in writing. A late fee of $45 applies to an unpaid balance after 30 days.',
        items: [
          {
            ref: 't1-p1', kind: 'choice',
            text: 'Under the contract as written, did the telephone call on the 12th start the notice period?',
            choices: ['Yes, cancellation is effective from the call', 'No, the contract requires written notice'],
            answer: 'No, the contract requires written notice',
            reasoning: 'The term specifies 30 days written notice, and a telephone call is not written notice, so the clock had not started when the customer believed it had.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Work out the consequence. Assume written notice is eventually sent, and one further monthly charge falls due before the notice period ends.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the further monthly charge the customer owes?',
            given: { monthly: 86 }, expr: 'monthly', format: 'usd', answer: '$86.00',
            reasoning: 'One more billing cycle falls due before a 30-day written notice period can expire.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If that charge goes unpaid past 30 days, what is the total owed with the late fee?',
            given: { lateFee: 45 }, expr: '#t2-p1 + lateFee', format: 'usd', answer: '$131.00',
            reasoning: '$86.00 of service charge plus the $45 late fee the contract applies.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'The customer expected to owe nothing. By how much was that wrong?',
            given: {}, expr: '#t2-p2', format: 'usd', answer: '$131.00',
            reasoning: 'The whole $131.00 is the error, and $45 of it arose only because the customer believed nothing was due.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Separate the two parts of the error.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the $131.00 was avoidable simply by paying the charge on time, even after the notice mistake?',
            given: { lateFee2: 45 }, expr: 'lateFee2', format: 'usd', answer: '$45.00',
            reasoning: 'The $86.00 was owed under the contract either way; only the late fee followed from acting on the mistaken belief.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'The customer made one mistake about the contract and a second mistake in response to it. Name both, and describe the two-step habit that would have prevented the whole $131.',
            acceptableAnswerCriteria: [
              'Names the first mistake as assuming a telephone call satisfied a written-notice term, and the second as not paying the resulting charge because they believed it was not owed.',
              'Identifies that the second mistake alone cost the $45 late fee.',
              'Describes a habit with two concrete steps: cancel in the form the contract specifies and keep proof, and pay a disputed charge on time while disputing it rather than withholding.',
            ],
            evidenceRequirements: [
              'Uses the $86.00 charge and the $45.00 late fee as the two separable components.',
            ],
            dimensions: ['error-diagnosis', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response separates the unavoidable charge from the avoidable fee.',
              'The response does not describe the notice term as unfair or hidden; it was in the contract.',
            ],
            commonMisconception: 'Treating a service as cancelled from the moment the decision to cancel is made.',
          },
        ],
      },
    ],
    remediation: 'If the whole $131 looks avoidable, split it in two. The $86 was owed the moment the notice period ran into another billing cycle; only the $45 depended on what the customer did after the misunderstanding.',
    extension: 'Rewrite the notice clause in one sentence a customer could not misread, and say what it would have to specify about form, timing, and proof.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l08',
    grade: 10, unit: 2, day: 8,
    actor: 'a fictional subscriber to a bundled service with a stepped price',
    objective: 'Apply the subscription-comparison method to a fictional promotional rate that steps up, compute the true average monthly price, and test the advertised figure against it.',
    scenario: 'A fictional provider advertises a simulated bundle "from $24.99 a month". The full price schedule below is invented for this exercise.',
    materials: ['calculator', 'the fictional price schedule in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional schedule: $24.99 a month for the first 6 months, then $79.99 a month for months 7 through 24 — that is 18 months — on a 24-month agreement.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the first 6 months cost?',
            given: { promo: 24.99, promoMonths: 6 }, expr: 'round(promo * promoMonths, 2)', format: 'usd', answer: '$149.94',
            reasoning: '6 months at the promotional $24.99.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What do months 7 through 24 cost?',
            given: { standard: 79.99, standardMonths: 18 }, expr: 'round(standard * standardMonths, 2)', format: 'usd', answer: '$1,439.82',
            reasoning: '18 months at the standard $79.99.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the whole 24-month agreement cost?',
            given: {}, expr: '#t1-p1 + #t1-p2', format: 'usd', answer: '$1,589.76',
            reasoning: '$149.94 of promotional months plus $1,439.82 at the standard rate.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the advertised figure.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the true average monthly price across the 24 months? Round to the nearest cent.',
            given: { months: 24 }, expr: 'round(#t1-p3 / months, 2)', format: 'usd', answer: '$66.24',
            reasoning: 'The $1,589.76 total commitment spread across the 24 months of the agreement.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much higher is the true average than the advertised "from" price?',
            given: { advertised: 24.99 }, expr: '#t2-p1 - advertised', format: 'usd', answer: '$41.25',
            reasoning: '$66.24 against the $24.99 the advertisement leads with.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Is the advertised claim "from $24.99 a month" false as stated?',
            choices: [
              'Yes, no month costs $24.99',
              'No, six months genuinely cost $24.99, so "from" is literally accurate',
              'The schedule does not say',
            ],
            given: { promoMonths2: 6 },
            decision: { left: 'promoMonths2', cmp: '>=', right: '1', ifTrue: 'No, six months genuinely cost $24.99, so "from" is literally accurate', ifFalse: 'Yes, no month costs $24.99' },
            answer: 'No, six months genuinely cost $24.99, so "from" is literally accurate',
            reasoning: 'Six of the 24 months really are billed at $24.99, so the word "from" is defensible — which is exactly why the average of $66.24 is the figure that matters.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'The earlier lesson on subscriptions compared two prices for the same service. This one compares one price that changes over time. Say what stayed the same in the method and what had to be added.',
            acceptableAnswerCriteria: [
              'States that the method is unchanged: total the whole commitment and divide by the months it covers.',
              'Identifies what had to be added: the schedule has two segments, so the total is built from two products rather than one.',
            ],
            evidenceRequirements: [
              'Uses the $1,589.76 total and the $66.24 average.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises the promotional rate is a segment of the schedule rather than the price of the service.',
            ],
            commonMisconception: 'Reading a promotional rate as the price of a service that carries a longer commitment.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Write the one figure you would want an advertisement for this bundle to display, and say why that figure rather than any other.',
            acceptableAnswerCriteria: [
              'Names the total 24-month commitment of $1,589.76, or the $66.24 average, and says why it represents what the customer actually agrees to.',
              'Explains why the chosen figure cannot be gamed by restructuring the schedule the way a "from" price can.',
            ],
            evidenceRequirements: [
              'Refers to both the $24.99 advertised price and the chosen replacement figure.',
            ],
            dimensions: ['criteria-application', 'evidence-use'],
            lookFors: [
              'The response justifies the choice rather than only naming a bigger number.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the average comes out near $52 — halfway between the two rates — the months are being averaged instead of the payments. Only 6 months are at the low rate and 18 at the high one, so the average must sit much closer to $79.99.',
    extension: 'Find the promotional length that would make the true average exactly $60 a month, holding both rates fixed, and say whether a provider would offer it.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l09',
    grade: 10, unit: 2, day: 9,
    actor: 'a fictional buyer comparing two retailers on the same defect',
    objective: 'Compare two fictional retailers’ return and warranty policies on the same defect and price, and identify which policy difference actually matters.',
    scenario: 'The same simulated $312 item is sold by two fictional retailers with different policies. A defect appears on day 52. All terms are invented for this exercise.',
    materials: ['calculator', 'the two fictional policy summaries in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Retailer G: 90-day returns with no restocking fee, and no retailer warranty beyond the manufacturer’s 12 months. Retailer H: 14-day returns with a 20% restocking fee, plus a 24-month retailer warranty covering repair. The item costs $312 at both.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'On day 52, what refund would Retailer G’s return policy give?',
            given: { price: 312 }, expr: 'price', format: 'usd', answer: '$312.00',
            reasoning: 'Day 52 falls inside Retailer G’s 90-day window and no restocking fee applies, so the refund is the full price.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would Retailer H’s restocking fee have been if the item had been returned inside its 14-day window?',
            given: { price2: 312, restockH: 0.2 }, expr: 'price2 * restockH', format: 'usd', answer: '$62.40',
            reasoning: '20% of $312, applicable only within the first 14 days.',
          },
          {
            ref: 't1-p3', kind: 'choice',
            text: 'On day 52, which retailer’s return policy is still available?',
            choices: ['Retailer G only', 'Retailer H only', 'Both', 'Neither'],
            given: { day: 52, windowG: 90, windowH: 14 },
            decision: { left: 'day', cmp: '<=', right: 'windowG', ifTrue: 'Retailer G only', ifFalse: 'Neither' },
            answer: 'Retailer G only',
            reasoning: 'Day 52 is inside G’s 90-day window and well outside H’s 14-day window.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now look past day 52.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'How many months longer does Retailer H’s warranty run than the manufacturer’s 12 months?',
            given: { warrantyH: 24, manufacturer: 12 }, expr: 'warrantyH - manufacturer', format: 'int', answer: '12',
            reasoning: '24 months against 12 — a full extra year of covered repair.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'For a defect appearing in month 14, which retailer’s policies help?',
            choices: ['Retailer G', 'Retailer H', 'Both', 'Neither'],
            given: { monthOfDefect: 14, warrantyH2: 24 },
            decision: { left: 'monthOfDefect', cmp: '<=', right: 'warrantyH2', ifTrue: 'Retailer H', ifFalse: 'Neither' },
            answer: 'Retailer H',
            reasoning: 'Month 14 is past both return windows and past the manufacturer’s 12 months, so only Retailer H’s 24-month warranty remains.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Retailer G is better on day 52 and Retailer H is better in month 14. Explain what each policy is actually protecting against, and say what a buyer would need to know about the product to choose between them at the point of purchase.',
            acceptableAnswerCriteria: [
              'States that a return window protects against early problems and changes of mind, while a longer warranty protects against later failure.',
              'Uses the day-52 and month-14 cases to show the two policies do not compete over the same period.',
              'Names what the buyer would need: when this kind of product typically fails — early, from a manufacturing fault, or late, from wear.',
            ],
            evidenceRequirements: [
              'Uses the $312 price, the two return windows, and the two warranty lengths.',
            ],
            dimensions: ['criteria-application', 'transfer', 'communication-of-uncertainty'],
            lookFors: [
              'The response recognises the 20% restocking fee at Retailer H is largely irrelevant, since its window is only 14 days.',
              'The response does not rank the retailers without reference to when failure is likely.',
            ],
            commonMisconception: 'Comparing consumer policies by counting their features rather than by asking which period each one covers.',
          },
        ],
      },
    ],
    remediation: 'If the two retailers look equivalent, draw a single timeline from month 0 to month 24 and mark all four periods on it. The overlaps and the gaps are what the comparison is about.',
    extension: 'Suppose Retailer H sells the same item for $289. Compute the saving, decide whether it is worth the shorter return window, and state the assumption your answer depends on.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u02-l10',
    grade: 10, unit: 2, day: 10,
    actor: 'a fictional consumer preparing a complaint dossier',
    objective: 'Assemble a fictional complaint dossier that computes the amount claimed, states the contractual basis, and sets out an escalation path with realistic expectations.',
    scenario: 'A fictional consumer has a simulated dispute with an invented seller. The charges, terms, and timeline below are all fictional.',
    materials: ['calculator', 'the fictional dispute record in these directions', 'a blank dossier sheet'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional dispute: an agreed price of $540 for a service, an invoice of $712 including $94 of charges not in the written agreement and $78 of a fee the agreement caps at $30. The consumer paid the invoice in full and now claims the excess back.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much of the fee charged exceeds the agreed cap?',
            given: { feeCharged: 78, feeCap: 30 }, expr: 'feeCharged - feeCap', format: 'usd', answer: '$48.00',
            reasoning: '$78 charged against a $30 cap written into the agreement.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total amount the consumer can claim on the contract’s own terms?',
            given: { unagreedCharges: 94 }, expr: 'unagreedCharges + #t1-p1', format: 'usd', answer: '$142.00',
            reasoning: '$94 of charges not in the agreement plus the $48 by which the capped fee was exceeded.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the invoice total less the claim come to, and does it match the agreed price?',
            given: { invoice: 712 }, expr: 'invoice - #t1-p2', format: 'usd', answer: '$570.00',
            reasoning: '$712 less the $142 claimed leaves $570, which is $30 above the agreed $540 — exactly the capped fee, correctly charged.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Check the arithmetic of the claim against the agreement.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much above the agreed price of $540 was the consumer invoiced?',
            given: { invoice2: 712, agreed: 540 }, expr: 'invoice2 - agreed', format: 'usd', answer: '$172.00',
            reasoning: '$712 invoiced against $540 agreed.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much of that excess is legitimately chargeable under the agreement?',
            given: {}, expr: '#t2-p1 - #t1-p2', format: 'usd', answer: '$30.00',
            reasoning: 'The $172 excess less the $142 claimed leaves the $30 fee the agreement expressly permits.',
          },
          {
            ref: 't2-p3', kind: 'choice',
            text: 'Which figure should head the complaint?',
            choices: ['$712, the invoice total', '$172, the amount above the agreed price', '$142, the amount claimed as improperly charged'],
            answer: '$142, the amount claimed as improperly charged',
            reasoning: 'Claiming $172 would include the $30 fee the agreement permits, which weakens a complaint by asking for something the contract allows.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Assemble the dossier.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Write the dossier. State the amount claimed and its contractual basis line by line, the evidence you would attach, the escalation path if the seller refuses, and what you would accept as a reasonable settlement.',
            acceptableAnswerCriteria: [
              'Leads with the $142 claim and breaks it into the $94 of unagreed charges and the $48 fee excess, each tied to a term of the agreement.',
              'Names the evidence: the written agreement showing the $540 price and the $30 fee cap, the $712 invoice, proof of payment, and dated copies of any correspondence.',
              'Sets out an escalation path with an actual sequence — written complaint to the seller with a deadline, then a complaints body or regulator, then a small-claims route — rather than naming one step.',
              'States a settlement position and its reasoning, recognising that a partial offer may come and the $142 is not guaranteed.',
            ],
            evidenceRequirements: [
              'Uses the $142 claim, the $30 permitted fee, and at least one of the two component amounts.',
            ],
            dimensions: ['plan-coherence', 'evidence-use', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The dossier concedes the $30 explicitly, which strengthens rather than weakens the claim.',
              'The escalation path is something the consumer could actually follow, in order.',
            ],
            commonMisconception: 'Claiming everything above the expected price rather than only what the agreement does not permit.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'A consumer protection agency publishes complaint data by seller. Say how that publication helps a consumer who has not yet bought anything, and what it cannot tell them.',
            acceptableAnswerCriteria: [
              'Explains that published complaint data lets a buyer compare sellers before purchase, which is information no individual buyer could gather alone.',
              'States what it cannot tell them: complaint counts depend on how easy complaining is and on how many customers a seller has, so a raw count is not a defect rate.',
            ],
            evidenceRequirements: [
              'Refers to the specific dispute in this lesson as the kind of event such data would record.',
            ],
            dimensions: ['communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response connects back to the reporting-rate distinction: reports are not incidents.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the claim comes out at $172, the $30 permitted fee has been swept in with the improper charges. Read the agreement’s three figures — the $540 price, the $30 cap, and nothing else — and claim only what falls outside them.',
    extension: 'Suppose the seller offers $95 to settle. Decide whether to accept, state the reasoning, and say what you would need to know about the escalation route to be confident.',
  },
]
