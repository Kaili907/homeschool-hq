import type { LessonSpec } from '../types.ts'

/**
 * Grade 9, Unit 2 — PF2 Buying Goods and Services: Comparing a Purchase
 * Before You Make It.
 */
export const g09u02: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g9-financial-literacy-u02-l01',
    grade: 9, unit: 2, day: 1,
    actor: 'a fictional shopper comparing three invented headphone models',
    objective: 'Convert three fictional headphone prices into cost per month of expected life, then rank the options on fitness for a stated purpose rather than on price alone.',
    scenario: 'A fictional shopper needs headphones that plug into a wired jack, because the simulated equipment they must work with has no wireless option. The three invented models below are the only ones available.',
    materials: ['calculator', 'the fictional model listings in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional listings: Aria 40 costs $89 and is expected to last 18 months, with a wired jack. Kestrel Pro costs $164 and is expected to last 36 months, wireless only. Dunlin costs $52 and is expected to last 8 months, with a wired jack.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the Aria 40 cost per month of expected life? Round to the nearest cent.',
            given: { priceAria: 89, monthsAria: 18 }, expr: 'round(priceAria / monthsAria, 2)', format: 'usd', answer: '$4.94',
            reasoning: '$89 spread over 18 months of expected life is $4.944 a month, which rounds to $4.94.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the Kestrel Pro cost per month of expected life?',
            given: { priceKestrel: 164, monthsKestrel: 36 }, expr: 'round(priceKestrel / monthsKestrel, 2)', format: 'usd', answer: '$4.56',
            reasoning: '$164 over 36 months is $4.5555 a month, which rounds to $4.56.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the Dunlin cost per month of expected life?',
            given: { priceDunlin: 52, monthsDunlin: 8 }, expr: 'round(priceDunlin / monthsDunlin, 2)', format: 'usd', answer: '$6.50',
            reasoning: '$52 over 8 months is exactly $6.50 a month, the highest of the three despite the lowest sticker price.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now apply the stated requirement: the headphones must have a wired jack.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Among only the models that meet the wired-jack requirement, which costs least per month?',
            choices: ['Aria 40', 'Kestrel Pro', 'Dunlin'],
            given: {},
            decision: { left: '#t1-p1', cmp: '<', right: '#t1-p3', ifTrue: 'Aria 40', ifFalse: 'Dunlin' },
            answer: 'Aria 40',
            reasoning: 'The Kestrel Pro is excluded before any price comparison because it is wireless only; between the two wired models, $4.94 a month beats $6.50.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Covering 36 months needs 2 Aria 40s and 5 Dunlins, since 4 Dunlins run out at month 32. How much more would the Dunlin path cost, if each pair is replaced only when it wears out?',
            given: { priceDunlin2: 52, dunlinCount: 5, priceAria2: 89 }, expr: 'priceDunlin2 * dunlinCount - priceAria2 * 2', format: 'usd', answer: '$82.00',
            reasoning: 'Headphones are bought whole. Two Arias last 36 months exactly, at $178. Four Dunlins reach only month 32, so covering 36 months takes five, at $260. The difference is $82.00 — larger than the per-month rates suggest, because the fifth Dunlin is bought in full for four months of use.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'The Kestrel Pro has the lowest cost per month of the three. Explain why it is still the wrong purchase here.',
            acceptableAnswerCriteria: [
              'States that the Kestrel Pro cannot do the job at all, because the simulated equipment has no wireless option, so its $4.56 a month buys nothing usable.',
              'Distinguishes fitness for purpose as a requirement to be met before price is compared, not as one factor traded off against price.',
            ],
            evidenceRequirements: [
              'Cites the wired-jack requirement from the scenario and the Kestrel Pro’s $4.56 figure together.',
            ],
            dimensions: ['criteria-application', 'evidence-use'],
            lookFors: [
              'The response screens on the requirement first and prices second, rather than arguing the Kestrel is "worth a bit more".',
              'The response does not treat the wired requirement as a preference.',
            ],
            commonMisconception: 'Treating every attribute as a tradeoff, including one that decides whether the product works at all.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The Dunlin has the lowest sticker price and the highest cost per month. Explain how both can be true.',
            acceptableAnswerCriteria: [
              'Explains that cost per month divides price by expected life, so a cheap item that lasts 8 months can cost more per month than a dearer one lasting 18.',
              'Uses the two figures, $52 over 8 months against $89 over 18 months, rather than asserting the general point.',
            ],
            evidenceRequirements: [
              'Quotes both the sticker prices and both the expected lifespans.',
            ],
            dimensions: ['reasoning-from-figures'],
            lookFors: [
              'The response identifies expected life as the second variable, not "quality" in general.',
            ],
          },
        ],
      },
    ],
    remediation: 'If cost per month is being computed as months divided by price, anchor the units out loud: dollars per month means dollars on top, months underneath. Check the Dunlin first, where $52 over 8 months gives an easy $6.50, before returning to the two that need rounding. For the 36-month question, count whole purchases rather than multiplying the monthly rate: you cannot buy four and a half pairs.',
    extension: 'Suppose the Aria 40 lasted only 12 months rather than 18. Recompute its cost per month and say whether the wired-model ranking changes.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l02',
    grade: 9, unit: 2, day: 2,
    actor: 'a fictional buyer of a used scooter',
    objective: 'Build the first-year total cost of a fictional purchase from its sticker price plus tax, required equipment, registration, insurance, and maintenance, and express the total as a percentage above sticker.',
    scenario: 'A fictional buyer is looking at a made-up used scooter advertised at a sticker price of $1,250. Every additional cost below is invented for this exercise.',
    materials: ['calculator', 'the fictional cost list in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The sticker price is $1,250. Sales tax is 6% of the sticker price. Registration is $85 once. A helmet and lock, required before riding, come to $120. Insurance is $28 a month. Routine maintenance is $95 for the first year.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is the sales tax?',
            given: { sticker: 1250, taxRate: 0.06 }, expr: 'sticker * taxRate', format: 'usd', answer: '$75.00',
            reasoning: '6% of the $1,250 sticker price is $75.00.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of insurance cost?',
            given: { insuranceMonthly: 28 }, expr: 'insuranceMonthly * 12', format: 'usd', answer: '$336.00',
            reasoning: '$28 a month for twelve months.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now total the first year and compare it with the advertised price.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of the first year of ownership?',
            given: { sticker2: 1250, registration: 85, gear: 120, maintenance: 95 },
            expr: 'sticker2 + #t1-p1 + registration + gear + #t1-p2 + maintenance', format: 'usd', answer: '$1,961.00',
            reasoning: '$1,250 sticker + $75 tax + $85 registration + $120 required gear + $336 insurance + $95 maintenance.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much more than the sticker price is that?',
            given: { sticker3: 1250 }, expr: '#t2-p1 - sticker3', format: 'usd', answer: '$711.00',
            reasoning: '$1,961.00 first-year total less the $1,250 advertised.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'By what percentage does the first-year total exceed the sticker price? Round to one decimal place.',
            given: { sticker4: 1250 }, expr: 'round(#t2-p2 / sticker4 * 100, 1)', format: 'percent1', answer: '56.9%',
            reasoning: '$711.00 on a $1,250 base is 0.5688, or 56.9% to one decimal place.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Second-year costs are not the same as first-year costs.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'Assuming insurance and maintenance stay the same and nothing else recurs, what does the second year cost?',
            given: { maintenance2: 95 }, expr: '#t1-p2 + maintenance2', format: 'usd', answer: '$431.00',
            reasoning: 'Only insurance ($336) and maintenance ($95) recur; sticker, tax, registration, and gear are one-time.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Sort the six costs into one-time and recurring, and explain which sort matters more to someone deciding whether they can afford to keep the scooter, as opposed to whether they can afford to buy it.',
            acceptableAnswerCriteria: [
              'Sorts correctly: sticker, tax, registration, and gear are one-time; insurance and maintenance recur.',
              'States that affording the purchase turns on the $1,530 of one-time costs while affording to keep it turns on the $431 a year that recurs.',
              'Explains that a buyer can clear the first hurdle and fail the second, so the two questions need separate answers.',
            ],
            evidenceRequirements: [
              'Uses the first-year total of $1,961.00 and the second-year figure of $431.00 as the two comparison points.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures'],
            lookFors: [
              'The response treats the recurring total as the ongoing commitment rather than as a smaller version of the purchase.',
              'The response does not classify the required helmet and lock as optional.',
            ],
            commonMisconception: 'Treating the advertised price as the cost of ownership.',
          },
        ],
      },
    ],
    remediation: 'If the total is landing near the sticker price, list the six costs in a column and tick each one off as it is added; the two easiest to drop are the $120 of required gear, which feels optional, and the $336 of insurance, which is quoted monthly and has to be annualised before it can join the others.',
    extension: 'Recompute the first-year total if the buyer finances the scooter and pays $94 in interest during the first year, and say what that does to the percentage above sticker.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l03',
    grade: 9, unit: 2, day: 3,
    actor: 'a fictional owner reading an invented appliance warranty',
    objective: 'Read a fictional warranty’s coverage and exclusions, compute what the warranty actually pays on a specific repair, and state what share of the bill the owner still carries.',
    scenario: 'The warranty text below belongs to a fictional appliance brand and covers a made-up repair. Nothing here describes a real product or a real warranty.',
    materials: ['the fictional warranty text in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional warranty reads: "Covers replacement parts for 24 months from purchase. Labour is not covered. A service fee of $50 applies to each claim. Coverage is void if the unit was opened by anyone other than an authorised technician." The repair quote is $138 for parts and 2.5 hours of labour at $95 an hour.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the labour portion of the repair quote?',
            given: { labourHours: 2.5, labourRate: 95 }, expr: 'labourHours * labourRate', format: 'usd', answer: '$237.50',
            reasoning: '2.5 hours at $95 an hour, and the warranty text states labour is not covered.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total repair bill before any warranty is applied?',
            given: { parts: 138 }, expr: 'parts + #t1-p1', format: 'usd', answer: '$375.50',
            reasoning: '$138 in parts plus $237.50 in labour.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Apply the warranty exactly as written: parts covered, labour not covered, $50 service fee per claim.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much does the warranty actually pay toward this repair?',
            given: { parts2: 138, serviceFee: 50 }, expr: 'parts2 - serviceFee', format: 'usd', answer: '$88.00',
            reasoning: 'The warranty pays the $138 of parts less the $50 service fee the claim triggers, so $88.00 of the bill.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the owner pay?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '$287.50',
            reasoning: 'The $375.50 bill less the $88.00 the warranty covers.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What percentage of the repair bill does the warranty cover? Round to one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t1-p2 * 100, 1)', format: 'percent1', answer: '23.4%',
            reasoning: '$88.00 of a $375.50 bill is 0.23435, or 23.4% to one decimal place.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Read the exclusion clause again before answering.',
        items: [
          {
            ref: 't3-p1', kind: 'choice',
            text: 'The owner had already taken the back panel off themselves to look inside. Under the warranty as written, what does the warranty now pay?',
            choices: ['$88.00, as calculated', '$138.00, the full parts cost', 'Nothing; coverage is void'],
            answer: 'Nothing; coverage is void',
            reasoning: 'The warranty states coverage is void if the unit was opened by anyone other than an authorised technician, and the owner opened it, so the calculation above no longer applies at all.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'A seller describes this warranty as "2-year full coverage". Identify every part of that description the warranty text contradicts, and write a one-sentence description that is accurate.',
            acceptableAnswerCriteria: [
              'Identifies that "full" is contradicted by the labour exclusion and by the $50 service fee, which together leave the owner paying $287.50 of a $375.50 bill.',
              'Notes that coverage is conditional, not automatic, because the void clause can remove it entirely.',
              'Offers a replacement description that states the parts-only scope, the service fee, and the 24-month term.',
            ],
            evidenceRequirements: [
              'Quotes or paraphrases at least two specific clauses from the fictional warranty text, and uses the 23.4% coverage figure.',
            ],
            dimensions: ['evidence-use', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats "2-year" as the one accurate part of the seller’s phrase.',
              'The rewritten description is short enough to be usable and does not simply reproduce the whole clause.',
            ],
            commonMisconception: 'Reading a warranty’s headline term and coverage word while skipping the exclusions that determine what it pays.',
          },
        ],
      },
    ],
    remediation: 'If the warranty is being credited with the whole parts cost, read the two money clauses in order: parts are covered, then a $50 fee applies to the claim. Compute $138, then subtract the fee, and only then compare with the bill.',
    extension: 'Work out the repair bill at which this warranty would cover half the cost, and say whether such a repair is likely for an appliance.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l04',
    grade: 9, unit: 2, day: 4,
    actor: 'a fictional shopper using required unit-price labels',
    objective: 'Use fictional unit-price label information to compare two package sizes that cannot be compared by their shelf prices, and quantify the saving the comparison reveals.',
    scenario: 'Two fictional brands sell the same simulated product in different package sizes. Both shelf tags carry a unit price, which in this simulated jurisdiction the seller is required to display.',
    materials: ['calculator', 'the fictional shelf tag figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional tags: Brand Verano, 680 grams for $7.14. Brand Solmar, 1150 grams for $11.73.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD per 100 g',
            text: 'What is Brand Verano’s price per 100 grams?',
            given: { priceV: 7.14, gramsV: 680 }, expr: 'round(priceV / gramsV * 100, 2)', format: 'usd', answer: '$1.05',
            reasoning: '$7.14 over 680 grams is $0.0105 per gram, or $1.05 per 100 grams.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD per 100 g',
            text: 'What is Brand Solmar’s price per 100 grams?',
            given: { priceS: 11.73, gramsS: 1150 }, expr: 'round(priceS / gramsS * 100, 2)', format: 'usd', answer: '$1.02',
            reasoning: '$11.73 over 1150 grams is $0.0102 per gram, or $1.02 per 100 grams.',
          },
          {
            ref: 't1-p3', kind: 'choice',
            text: 'Which brand is cheaper per unit of product?',
            choices: ['Brand Verano', 'Brand Solmar', 'They cost the same per unit'],
            given: {},
            decision: { left: '#t1-p1', cmp: '<', right: '#t1-p2', ifTrue: 'Brand Verano', ifFalse: 'Brand Solmar' },
            answer: 'Brand Solmar',
            reasoning: '$1.02 per 100 grams is less than $1.05, even though Solmar’s shelf price of $11.73 is the larger of the two numbers on display.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Quantify what the unit-price comparison is worth.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'Buying 1150 grams of product, how much does the shopper save by choosing Solmar over buying the same quantity at Verano’s unit price?',
            given: { quantity: 1150 }, expr: 'round((#t1-p1 - #t1-p2) / 100 * quantity, 2)', format: 'usd', answer: '$0.35',
            reasoning: 'The $0.03 difference per 100 grams over 1150 grams comes to $0.345, which rounds to $0.35.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'A household buys 1150 grams of this product every month. What does the difference come to over a year?',
            given: {}, expr: 'round((#t1-p1 - #t1-p2) / 100 * 1150 * 12, 2)', format: 'usd', answer: '$4.14',
            reasoning: '$0.345 a month, unrounded, over twelve months is $4.14.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'short',
            text: 'Explain what a required unit-price label does that a shelf price alone cannot, and why a rule requiring it is aimed at sellers rather than at shoppers.',
            acceptableAnswerCriteria: [
              'States that a unit price puts differently sized packages on one scale, which the shelf prices of $7.14 and $11.73 cannot do on their own.',
              'Explains that the requirement falls on the seller because the seller holds the information and controls how it is displayed, while the shopper cannot compute it without being given the package size.',
            ],
            evidenceRequirements: [
              'Refers to the two package sizes, 680 grams and 1150 grams, as the reason the shelf prices are not comparable.',
            ],
            dimensions: ['criteria-application', 'evidence-use'],
            lookFors: [
              'The response identifies the comparison problem, not merely that labels are "helpful".',
              'The response does not claim the label tells the shopper which product is better.',
            ],
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The yearly difference here is small. Give one reason a shopper might still choose Verano, and one reason the unit-price rule is worth having even when the differences are small.',
            acceptableAnswerCriteria: [
              'Gives a defensible reason to pick the smaller package despite the higher unit price — storage, spoilage before use, cash on hand today, or a preference for the product.',
              'Argues that the rule matters because the shopper cannot know in advance which comparisons will be small and which large, and the same label catches both.',
            ],
            evidenceRequirements: [
              'Uses the $4.14 annual figure in weighing whether the difference is decisive.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not conclude that unit pricing is pointless because this particular gap is small.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the per-100-gram figures come out a hundred times too large or too small, do the division first and the scaling second: $7.14 divided by 680 is about a penny per gram, so per 100 grams it must be about a dollar. Sanity-check against that before recording the answer.',
    extension: 'Add a fictional third option, 2300 grams for $22.54, compute its unit price, and say whether the biggest package is automatically the cheapest per unit.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l05',
    grade: 9, unit: 2, day: 5,
    actor: 'a fictional store running an invented sale',
    objective: 'Test an advertising claim against the underlying fictional sale data, compute what the claim implies against what the shopper would actually receive, and rewrite the claim so it is verifiable.',
    scenario: 'A fictional store advertises a made-up sale with the headline "Save up to 60%!" The sale data below is invented for this exercise.',
    materials: ['calculator', 'the fictional sale data in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional sale covers 12 items. Exactly 1 of them is discounted 60%. The other 11 are discounted 10%. The item the shopper actually wants has a regular price of $48.00 and is one of the 10% items.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the sale price of the item the shopper wants?',
            given: { regular: 48, discount: 0.1 }, expr: 'regular - regular * discount', format: 'usd', answer: '$43.20',
            reasoning: '10% off $48.00 is $4.80 off, leaving $43.20.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What would that same item cost if the headline discount of 60% applied to it?',
            given: { regular2: 48, headline: 0.6 }, expr: 'regular2 - regular2 * headline', format: 'usd', answer: '$19.20',
            reasoning: '60% off $48.00 would leave $19.20 — the price the headline invites a shopper to expect.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the gap between what the headline suggests and what the shopper would actually pay?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$24.00',
            reasoning: '$43.20 actually paid against $19.20 implied by the headline.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now describe the sale as a whole.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the average discount across all 12 sale items? Round to one decimal place.',
            given: { deepCount: 1, deepPct: 60, shallowCount: 11, shallowPct: 10, total: 12 },
            expr: 'round((deepCount * deepPct + shallowCount * shallowPct) / total, 1)', format: 'percent1', answer: '14.2%',
            reasoning: 'One item at 60% and eleven at 10% gives 170 percentage points across 12 items, an average of 14.166%, or 14.2%.',
          },
          {
            ref: 't2-p2', kind: 'choice',
            text: 'Is the headline claim "Save up to 60%" false as stated?',
            choices: [
              'Yes, no item is discounted 60%',
              'No, one item is discounted 60%, so the claim is literally true',
              'The data does not say',
            ],
            given: { itemsAt60: 1 },
            decision: { left: 'itemsAt60', cmp: '>=', right: '1', ifTrue: 'No, one item is discounted 60%, so the claim is literally true', ifFalse: 'Yes, no item is discounted 60%' },
            answer: 'No, one item is discounted 60%, so the claim is literally true',
            reasoning: 'The words "up to" make the claim true if any single item reaches 60%, and exactly one does — which is why literal truth is a weak test of an advertising claim.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The headline is literally true and still misleads. Explain how, then rewrite it as a claim a shopper could verify before entering the store.',
            acceptableAnswerCriteria: [
              'Explains that "up to" describes the maximum across the sale, not the typical discount, and that 11 of the 12 items are at 10%.',
              'Uses the 14.2% average, or the 1-in-12 count, to show how unrepresentative the 60% figure is.',
              'Rewrites the claim in checkable terms — naming the typical discount, the number of items at each level, or which items are deeply discounted.',
            ],
            evidenceRequirements: [
              'Cites the item counts (1 at 60%, 11 at 10%) and at least one computed figure from this lesson.',
            ],
            dimensions: ['evidence-use', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The rewritten claim is verifiable before purchase, not merely more modest in tone.',
              'The response separates literal truth from the impression the claim creates.',
            ],
            commonMisconception: 'Judging an advertising claim only by whether it is technically false.',
          },
        ],
      },
    ],
    remediation: 'If the average discount comes out at 35% — halfway between 10 and 60 — the two rates are being averaged rather than the twelve items. Write out all twelve values, eleven 10s and one 60, and add them before dividing.',
    extension: 'Find how many of the 12 items would have to be discounted 60% for the average to reach 30%, and say whether the headline would then be a fair summary.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l06',
    grade: 9, unit: 2, day: 6,
    actor: 'a fictional buyer keeping a weighted decision log',
    objective: 'Score three fictional options against weighted criteria, produce a defensible ranking, and record the reasons in a form that can be re-checked later.',
    scenario: 'A fictional buyer has written down three criteria, given each a weight, and rated three invented options from 1 to 5 on each. All ratings and weights below are made up for this exercise.',
    materials: ['calculator', 'the fictional decision log in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The weights are: price 0.5, durability 0.3, repairability 0.2. Option Larkspur is rated 4 on price, 2 on durability, 5 on repairability. Option Mirren is rated 2, 5, and 3. Option Otsego is rated 3, 4, and 2.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric',
            text: 'What is Larkspur’s weighted score?',
            given: { wPrice: 0.5, wDur: 0.3, wRep: 0.2, lp: 4, ld: 2, lr: 5 },
            expr: 'wPrice * lp + wDur * ld + wRep * lr', format: 'dec1', answer: '3.6',
            reasoning: '0.5 x 4 plus 0.3 x 2 plus 0.2 x 5 gives 2.0 + 0.6 + 1.0.',
          },
          {
            ref: 't1-p2', kind: 'numeric',
            text: 'What is Mirren’s weighted score?',
            given: { wPrice2: 0.5, wDur2: 0.3, wRep2: 0.2, mp: 2, md: 5, mr: 3 },
            expr: 'wPrice2 * mp + wDur2 * md + wRep2 * mr', format: 'dec1', answer: '3.1',
            reasoning: '0.5 x 2 plus 0.3 x 5 plus 0.2 x 3 gives 1.0 + 1.5 + 0.6.',
          },
          {
            ref: 't1-p3', kind: 'numeric',
            text: 'What is Otsego’s weighted score?',
            given: { wPrice3: 0.5, wDur3: 0.3, wRep3: 0.2, op: 3, od: 4, or_: 2 },
            expr: 'wPrice3 * op + wDur3 * od + wRep3 * or_', format: 'dec1', answer: '3.1',
            reasoning: '0.5 x 3 plus 0.3 x 4 plus 0.2 x 2 gives 1.5 + 1.2 + 0.4, the same total as Mirren by a different route.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Interpret the scores.',
        items: [
          {
            ref: 't2-p1', kind: 'choice',
            text: 'Which option does the weighted log select?',
            choices: ['Larkspur', 'Mirren', 'Otsego', 'The log does not separate them'],
            given: {},
            decision: { left: '#t1-p1', cmp: '>', right: '#t1-p2', ifTrue: 'Larkspur', ifFalse: 'Mirren' },
            answer: 'Larkspur',
            reasoning: 'Larkspur scores 3.6 against 3.1 for both of the others, so the log selects it outright.',
          },
          {
            ref: 't2-p2', kind: 'numeric',
            text: 'If durability were reweighted to 0.5 and price to 0.3, with repairability unchanged, what would Mirren score?',
            given: { newPrice: 0.3, newDur: 0.5, wRep4: 0.2, mp2: 2, md2: 5, mr2: 3 },
            expr: 'newPrice * mp2 + newDur * md2 + wRep4 * mr2', format: 'dec1', answer: '3.7',
            reasoning: '0.3 x 2 plus 0.5 x 5 plus 0.2 x 3 gives 0.6 + 2.5 + 0.6.',
          },
          {
            ref: 't2-p3', kind: 'numeric',
            text: 'Under those same new weights, what would Larkspur score?',
            given: { newPrice2: 0.3, newDur2: 0.5, wRep5: 0.2, lp2: 4, ld2: 2, lr2: 5 },
            expr: 'newPrice2 * lp2 + newDur2 * ld2 + wRep5 * lr2', format: 'dec1', answer: '3.2',
            reasoning: '0.3 x 4 plus 0.5 x 2 plus 0.2 x 5 gives 1.2 + 1.0 + 1.0, so the ranking reverses.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Changing two weights reversed the ranking. Explain what that shows about a weighted decision log, and say what a buyer should record alongside the scores so the decision can be re-checked in a year.',
            acceptableAnswerCriteria: [
              'States that the ranking is driven by the weights as much as by the ratings, since the same ratings gave Larkspur 3.6 then 3.2 and Mirren 3.1 then 3.7.',
              'Concludes that the weights are a judgement that must be recorded and justified, not a neutral step.',
              'Names what to record beyond the scores — the weights, why each weight was chosen, the ratings’ source, and the date — so a later reader can tell whether the reasoning still holds.',
            ],
            evidenceRequirements: [
              'Uses both sets of scores for at least two options to show the reversal.',
            ],
            dimensions: ['assumption-identification', 'plan-coherence', 'reasoning-from-figures'],
            lookFors: [
              'The response treats the reversal as informative rather than as a flaw in the method.',
              'The recording suggestion is specific enough to act on.',
            ],
            commonMisconception: 'Reading a weighted score as an objective measurement rather than as a compressed statement of the buyer’s priorities.',
          },
        ],
      },
    ],
    remediation: 'If the weighted scores come out above 5, the weights are being added to the ratings rather than multiplied. Compute one line at a time — weight times rating — and check that the three weights sum to 1 before summing the products.',
    extension: 'Find a set of three weights, still summing to 1, under which Otsego wins, and say what that set of weights implies about the buyer’s priorities.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l07',
    grade: 9, unit: 2, day: 7,
    actor: 'a fictional reviewer who concluded that price predicts quality',
    objective: 'Test the claim that a higher price means better quality against fictional rating data, find the counterexample that breaks it, and quantify what the extra money bought.',
    scenario: 'A fictional product reviewer wrote: "With blenders, you get what you pay for — the more it costs, the better it is." The four invented models and their made-up durability ratings below are the data the reviewer had.',
    materials: ['the fictional rating table in these directions', 'calculator'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The four fictional models, with price and durability rating out of 5: Model W $39, rated 3.8. Model X $72, rated 4.4. Model Y $118, rated 3.1. Model Z $155, rated 4.5.',
        items: [
          {
            ref: 't1-p1', kind: 'choice',
            text: 'Which pair of models directly contradicts the claim that a higher price means a better rating?',
            choices: ['Model W and Model X', 'Model X and Model Y', 'Model Y and Model Z', 'No pair contradicts it'],
            given: { ratingY: 3.1, ratingX: 4.4 },
            decision: { left: 'ratingY', cmp: '<', right: 'ratingX', ifTrue: 'Model X and Model Y', ifFalse: 'No pair contradicts it' },
            answer: 'Model X and Model Y',
            reasoning: 'Model Y costs $46 more than Model X and is rated 1.3 points lower, so a single pair is enough to break a claim stated as a rule.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Quantify the counterexample and put every model on one scale.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does Model Y cost than Model X?',
            given: { priceY: 118, priceX: 72 }, expr: 'priceY - priceX', format: 'usd', answer: '$46.00',
            reasoning: '$118 less $72, paid for a rating that is lower rather than higher.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Model X cost per rating point? Round to the nearest cent.',
            given: { priceX2: 72, ratingX2: 4.4 }, expr: 'round(priceX2 / ratingX2, 2)', format: 'usd', answer: '$16.36',
            reasoning: '$72 divided by a rating of 4.4 is $16.3636, which rounds to $16.36.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Model Y cost per rating point?',
            given: { priceY2: 118, ratingY2: 3.1 }, expr: 'round(priceY2 / ratingY2, 2)', format: 'usd', answer: '$38.06',
            reasoning: '$118 divided by 3.1 is $38.0645, which rounds to $38.06 — more than double Model X’s cost per point.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Work these without help.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Model W cost per rating point?',
            given: { priceW: 39, ratingW: 3.8 }, expr: 'round(priceW / ratingW, 2)', format: 'usd', answer: '$10.26',
            reasoning: '$39 divided by 3.8 is $10.2631, which rounds to $10.26, the lowest of the four.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Model Z cost per rating point?',
            given: { priceZ: 155, ratingZ: 4.5 }, expr: 'round(priceZ / ratingZ, 2)', format: 'usd', answer: '$34.44',
            reasoning: '$155 divided by 4.5 is $34.4444, which rounds to $34.44.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'State precisely what is wrong with the reviewer’s claim, using the data, and write a version of the claim that the same four models would actually support.',
            acceptableAnswerCriteria: [
              'Identifies that the claim is stated as a rule and is broken by Model Y, which costs $46 more than Model X and rates 1.3 lower.',
              'Notes that the highest-rated model (Z, at 4.5) is indeed the most expensive, so the data is not simply the reverse of the claim — the relationship is loose, not absent.',
              'Offers a supportable restatement, such as that the cheapest model here buys the most rating per dollar while the highest rating costs the most, with no reliable rule in between.',
            ],
            evidenceRequirements: [
              'Cites at least two of the cost-per-rating-point figures ($10.26, $16.36, $38.06, $34.44) in support.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response does not overcorrect into "price tells you nothing", which the Model Z figure does not support.',
              'The restated claim is testable against the table.',
            ],
            commonMisconception: 'Treating a loose tendency in a few data points as a rule that holds for every pair.',
          },
        ],
      },
    ],
    remediation: 'If the counterexample is hard to spot, sort the four models by price and read the ratings down the column: 3.8, 4.4, 3.1, 4.5. A rule that price predicts rating would need that column to rise every time, and it falls once.',
    extension: 'Add a fictional Model V at $95 rated 4.8 and say whether it changes the reviewer’s claim, the cost-per-point ranking, or both.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l08',
    grade: 9, unit: 2, day: 8,
    actor: 'a fictional phone shopper choosing between two invented plans',
    objective: 'Apply the total-cost method to a fictional bundled offer where the item is advertised as free, and find the month at which the two paths cross.',
    scenario: 'Two fictional carriers offer the same simulated phone. One advertises the handset as free; the other charges for it upfront. Both offers are invented for this exercise.',
    materials: ['calculator', 'the two fictional offers in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Offer P: the phone is $0 upfront and the plan is $65 a month on a 24-month contract, with an early termination fee of $240. Offer Q: the phone is $499 upfront and the plan is $38 a month with no contract.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Offer P cost over the full 24 months?',
            given: { monthlyP: 65, months: 24 }, expr: 'monthlyP * months', format: 'usd', answer: '$1,560.00',
            reasoning: '$65 a month for 24 months, with nothing paid upfront for the handset.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Offer Q cost over the same 24 months?',
            given: { upfrontQ: 499, monthlyQ: 38, months2: 24 }, expr: 'upfrontQ + monthlyQ * months2', format: 'usd', answer: '$1,411.00',
            reasoning: '$499 for the handset plus $38 a month for 24 months, which is $912 of service.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'Over 24 months, how much more does the offer with the free phone cost?',
            given: {}, expr: '#t1-p1 - #t1-p2', format: 'usd', answer: '$149.00',
            reasoning: '$1,560.00 against $1,411.00, so the free handset is more than paid for through the monthly price.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The two paths start in different places and climb at different rates, so they cross somewhere.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric',
            text: 'After how many months does Offer Q’s running total first fall below Offer P’s? Give the crossing point to one decimal place.',
            given: { upfront: 499, monthlyP2: 65, monthlyQ2: 38 },
            expr: 'round(upfront / (monthlyP2 - monthlyQ2), 1)', format: 'dec1', answer: '18.5',
            reasoning: 'Offer Q starts $499 behind and closes the gap at $27 a month, so the totals are equal at 18.48 months and Q is cheaper from month 19 onward.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'A buyer who leaves Offer P after 12 months pays the $240 early termination fee. What has Offer P cost them in total?',
            given: { monthlyP3: 65, monthsUsed: 12, etf: 240 }, expr: 'monthlyP3 * monthsUsed + etf', format: 'usd', answer: '$1,020.00',
            reasoning: '$780 of service over 12 months plus the $240 fee for leaving the 24-month contract early.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would 12 months of Offer Q have cost the same buyer?',
            given: { upfrontQ2: 499, monthlyQ3: 38, monthsUsed2: 12 }, expr: 'upfrontQ2 + monthlyQ3 * monthsUsed2', format: 'usd', answer: '$955.00',
            reasoning: '$499 upfront plus $456 of service over 12 months.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain what the word "free" is doing in Offer P, and say which buyer — if any — Offer P is genuinely better for.',
            acceptableAnswerCriteria: [
              'Explains that the handset cost is recovered through the $27 monthly premium, so "free" describes the timing of the payment rather than its absence.',
              'Identifies that Offer P is better for a buyer who cannot pay $499 today, or one who will stop before the 18.5-month crossing point without triggering the fee.',
              'Notes that the $240 termination fee removes most of that early advantage, since leaving at 12 months costs $1,020 against Offer Q’s $955.',
            ],
            evidenceRequirements: [
              'Uses the crossing point of 18.5 months and at least one of the 12-month totals.',
            ],
            dimensions: ['transfer', 'tradeoff-defense', 'reasoning-from-figures'],
            lookFors: [
              'The response recognises that having $499 available today is a real constraint and not merely a preference.',
              'The response applies the total-cost method rather than comparing monthly prices.',
            ],
            commonMisconception: 'Treating a cost bundled into a monthly price as no cost at all.',
          },
        ],
      },
    ],
    remediation: 'If the crossing point is being computed by dividing $499 by $65 or by $38, name what the $499 is being repaid out of: only the $27 a month by which Offer P is dearer. Write the two running totals for months 1, 6, 12, and 24 side by side before dividing.',
    extension: 'Recompute the crossing point if Offer Q’s handset were $349 instead of $499, and say whether the early termination fee still protects Offer P at 12 months.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l09',
    grade: 9, unit: 2, day: 9,
    actor: 'a fictional buyer comparing two invented energy labels',
    objective: 'Read a fictional energy disclosure label, convert its rating into an annual running cost, and combine running cost with purchase price to find how long the cheaper-to-run option takes to pay for itself.',
    scenario: 'Two fictional refrigerators carry simulated energy labels stating estimated yearly electricity use. Both models, both prices, and the electricity rate below are invented.',
    materials: ['calculator', 'the fictional label figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional labels: Model A uses 512 kWh a year and sells for $1,049. Model B uses 389 kWh a year and sells for $1,199. Electricity costs $0.174 per kWh.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Model A cost to run for a year?',
            given: { kwhA: 512, rate: 0.174 }, expr: 'round(kwhA * rate, 2)', format: 'usd', answer: '$89.09',
            reasoning: '512 kWh at $0.174 each is $89.088, which rounds to $89.09.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does Model B cost to run for a year?',
            given: { kwhB: 389, rate2: 0.174 }, expr: 'round(kwhB * rate2, 2)', format: 'usd', answer: '$67.69',
            reasoning: '389 kWh at $0.174 each is $67.686, which rounds to $67.69.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much does Model B save in running cost each year?',
            given: { kwhA2: 512, kwhB2: 389, rate3: 0.174 }, expr: 'round((kwhA2 - kwhB2) * rate3, 2)', format: 'usd', answer: '$21.40',
            reasoning: 'The 123 kWh difference at $0.174 is $21.402, which rounds to $21.40 a year.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Model B saves money to run and costs more to buy.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does Model B cost to buy?',
            given: { priceB: 1199, priceA: 1049 }, expr: 'priceB - priceA', format: 'usd', answer: '$150.00',
            reasoning: 'Model B’s price of $1,199 less Model A’s $1,049, the extra paid upfront for the lower running cost.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'years',
            text: 'How many years of running-cost savings does it take to repay that difference? Round to one decimal place.',
            given: { kwhA3: 512, kwhB3: 389, rate4: 0.174 },
            expr: 'round(#t2-p1 / ((kwhA3 - kwhB3) * rate4), 1)', format: 'years1', answer: '7.0',
            reasoning: '$150 divided by the unrounded annual saving of $21.402 is 7.0087 years, which rounds to 7.0.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'Over 12 years of ownership, what is the total cost — purchase plus running — of Model B?',
            given: { priceB2: 1199, years: 12 }, expr: 'round(priceB2 + #t1-p2 * years, 2)', format: 'usd', answer: '$2,011.28',
            reasoning: '$1,199 to buy plus twelve years at $67.69, which is $812.28 of electricity.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This fictional label gives an estimated yearly kWh figure and nothing about price. Explain why a label might stop there, and what a buyer must supply to turn it into a decision. (Real energy labels usually do print an estimated yearly dollar cost, computed at one national electricity rate.)',
            acceptableAnswerCriteria: [
              'States that electricity prices differ by place and change over time, so a dollar figure printed on the label would be wrong for most buyers, while a kWh figure stays true.',
              'Identifies what the buyer supplies: their own electricity rate, how long they expect to keep the appliance, and the purchase prices.',
              'Connects this to the 7.0-year payback, noting that the answer depends entirely on the buyer’s own horizon.',
            ],
            evidenceRequirements: [
              'Uses the $0.174 rate and the 7.0-year payback figure in the explanation.',
            ],
            dimensions: ['assumption-identification', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the kWh figure as the disclosure and the dollar figure as a local calculation.',
              'The response does not conclude that Model B is simply better without reference to how long it is kept.',
            ],
            commonMisconception: 'Reading an efficiency label as a verdict on which product to buy rather than as one input.',
          },
        ],
      },
    ],
    remediation: 'If the payback comes out near half a year or near seventy, check whether the $150 price gap was divided by the annual saving or by the annual running cost. Write the sentence in words first — the extra $150 is repaid at $21.40 a year — and then divide.',
    extension: 'Recompute the payback at an electricity rate of $0.26 per kWh and say what that shows about how much the label alone can settle.',
  },

  {
    lessonId: 'ma-g9-financial-literacy-u02-l10',
    grade: 9, unit: 2, day: 10,
    actor: 'a fictional student assembling a pre-purchase dossier for a laptop',
    objective: 'Assemble a pre-purchase dossier on three fictional laptops — total cost to meet a stated requirement, cost per year of warranty coverage, and a recorded decision — and defend the recommendation.',
    scenario: 'A fictional student needs a laptop with at least 256 GB of storage for a simulated course. The three invented models below are the options, and no product, price, or warranty named here is real.',
    materials: ['calculator', 'the fictional model listings in these directions', 'a blank three-column dossier sheet'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional options. Cedarline 14: $529, 128 GB storage, 1-year warranty. Pellham Flex: $649, 256 GB storage, 2-year warranty. Vantis Air: $479, 64 GB storage, 90-day warranty. An external drive that brings any model up to the required 256 GB costs $59 for the Cedarline and $110 for the Vantis.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the Cedarline 14 cost in total to meet the 256 GB requirement?',
            given: { priceCedar: 529, driveCedar: 59 }, expr: 'priceCedar + driveCedar', format: 'usd', answer: '$588.00',
            reasoning: '$529 for the machine plus the $59 drive it needs to reach the required storage.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the Vantis Air cost in total to meet the requirement?',
            given: { priceVantis: 479, driveVantis: 110 }, expr: 'priceVantis + driveVantis', format: 'usd', answer: '$589.00',
            reasoning: '$479 plus the $110 drive, which puts the cheapest machine a dollar above the Cedarline once the requirement is met.',
          },
          {
            ref: 't1-p3', kind: 'choice',
            text: 'Which model meets the storage requirement with no additional purchase?',
            choices: ['Cedarline 14', 'Pellham Flex', 'Vantis Air'],
            given: { storagePellham: 256, required: 256 },
            decision: { left: 'storagePellham', cmp: '>=', right: 'required', ifTrue: 'Pellham Flex', ifFalse: 'Cedarline 14' },
            answer: 'Pellham Flex',
            reasoning: 'The Pellham Flex ships with 256 GB, exactly the requirement; the other two ship below it and need a drive.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now put warranty coverage on the same scale as cost. Express the 90-day warranty in years as 0.25.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the Pellham Flex cost per year of warranty coverage?',
            given: { pricePellham: 649, warrantyPellham: 2 }, expr: 'round(pricePellham / warrantyPellham, 2)', format: 'usd', answer: '$324.50',
            reasoning: '$649 over 2 years of coverage; the Pellham needs no drive, so its total cost is its price.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the Cedarline 14 cost per year of warranty coverage, counting the drive it needs?',
            given: { warrantyCedar: 1 }, expr: 'round(#t1-p1 / warrantyCedar, 2)', format: 'usd', answer: '$588.00',
            reasoning: 'Its $588 total over a single year of coverage.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the Vantis Air cost per year of warranty coverage, counting its drive?',
            given: { warrantyVantis: 0.25 }, expr: 'round(#t1-p2 / warrantyVantis, 2)', format: 'usd', answer: '$2,356.00',
            reasoning: 'Its $589 total over 0.25 years of coverage, which is what a 90-day warranty amounts to.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'performance-task',
        directions: 'Write the dossier’s conclusion.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend one model. Your dossier must state the total cost to meet the requirement, the warranty position, and the one figure that decided it — and must say what you would need to learn to change your mind.',
            acceptableAnswerCriteria: [
              'Recommends a model and names the deciding figure explicitly rather than gesturing at overall value.',
              'Uses the totals that meet the requirement ($588, $649, $589), not the advertised prices, and explains why the advertised ranking is misleading here.',
              'Handles the warranty comparison honestly: the Pellham costs $61 more than the Cedarline in total but carries twice the coverage, at $324.50 a year against $588.00.',
              'States a specific, checkable thing that would change the recommendation.',
            ],
            evidenceRequirements: [
              'Cites at least one total-cost figure and one cost-per-warranty-year figure computed in this lesson.',
            ],
            dimensions: ['plan-coherence', 'criteria-application', 'tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The response notices that the Vantis Air, cheapest on the shelf at $479, is no cheaper than the Cedarline once the requirement is met, at $589 against $588, and is by far the worst on cost per warranty-year.',
              'The what-would-change-my-mind statement is testable, not a general caveat.',
            ],
            commonMisconception: 'Ranking options by advertised price when the options do not all meet the requirement as sold.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Warranty length is not the same as reliability. Explain the difference and say what the dossier would need in order to say anything about reliability.',
            acceptableAnswerCriteria: [
              'Explains that a warranty is a promise about who pays if the product fails, while reliability is how often it fails, and that the two are related but not the same.',
              'Names what the dossier lacks — failure rates, repair histories, independent testing, or user reports over time — and notes that none of it is in the listings given.',
            ],
            evidenceRequirements: [
              'Refers to the warranty terms given (1 year, 2 years, 90 days) as evidence about coverage rather than about failure rates.',
            ],
            dimensions: ['communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response resists inferring that the 90-day model is necessarily less reliable, while allowing that a short warranty can be a signal.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the Vantis Air is coming out best, check whether the $110 drive was added. The requirement is 256 GB; a 64 GB machine does not meet it as sold, so its shelf price of $479 is not a price for something that does the job.',
    extension: 'Add the assumption that the student keeps the laptop 4 years and that an out-of-warranty repair costs $215. Rebuild the three totals with one expected repair after coverage ends and say whether the recommendation holds.',
  },
]
