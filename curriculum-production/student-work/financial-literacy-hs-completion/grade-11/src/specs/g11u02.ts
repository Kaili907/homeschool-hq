import type { LessonSpec } from '../types.ts'

/**
 * Grade 11, Unit 2 — PF2 Buying Goods and Services: Major Purchase Analysis
 * Under Constraint. Ten lessons, one per source lesson day.
 *
 * The grade-11 move here is that no purchase is judged by its price or its
 * monthly payment. Every lesson carries a holding period, and most carry a
 * resale or depreciation term, so the figure being compared is what the whole
 * period cost. Every vehicle, dealer, lender, and disclosure below is invented.
 */
export const g11u02: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g11-financial-literacy-u02-l01',
    grade: 11, unit: 2, day: 1,
    actor: 'Ines Kowalczyk-Amadi, a fictional buyer costing a used vehicle over five years',
    objective: 'Build the total cost of owning a fictional used vehicle across a five-year holding period, including resale, and convert it into a cost per year and a cost per mile.',
    scenario: 'Ines Kowalczyk-Amadi is a fictional buyer in a simulated town. The vehicle, its running costs, and its resale value below are invented figures and describe no real car or dealer.',
    materials: ['calculator', 'the fictional vehicle cost figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The fictional vehicle costs $14,800 to buy. Ines expects to drive 11,000 miles a year for 5 years, a total of 55,000 miles. It averages 25 miles per gallon and fuel costs $3.45 a gallon throughout.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'gallons',
            text: 'How many gallons of fuel does Ines use in one year, driving 11,000 miles at 25 miles per gallon?',
            given: { miles: 11000, mpg: 25 }, expr: 'miles / mpg', format: 'int', answer: '440',
            reasoning: 'Miles divided by miles per gallon gives gallons: 11,000 / 25. Fuel cost has to be built from consumption, because the price per gallon alone says nothing about the annual bill.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does a year of fuel cost at $3.45 a gallon?',
            given: { price: 3.45 }, expr: 'round(#t1-p1 * price, 2)', format: 'usd', answer: '$1,518.00',
            reasoning: '440 gallons at $3.45 each. This is the first of the running costs that never appears on a price tag.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does fuel cost across the whole 5 years?',
            given: {}, expr: '#t1-p2 * 5', format: 'usd', answer: '$7,590.00',
            reasoning: 'Five years at $1,518.00, holding both the mileage and the fuel price flat across the holding period.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'The other running costs are insurance at $1,340 a year, maintenance at $620 a year, and registration at $148 a year, all held flat across the 5 years.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does insurance cost across the 5 years?',
            given: { insurance: 1340 }, expr: 'insurance * 5', format: 'usd', answer: '$6,700.00',
            reasoning: 'Five years at $1,340. Insurance is a condition of driving the vehicle, so it belongs inside the cost of owning it.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do maintenance and registration cost together across the 5 years?',
            given: { maintenance: 620, registration: 148 }, expr: 'maintenance * 5 + registration * 5', format: 'usd', answer: '$3,840.00',
            reasoning: 'Five years each of $620 maintenance and $148 registration: $3,100 plus $740.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total running cost across the 5 years, before the purchase price or resale are counted?',
            given: {}, expr: '#t1-p3 + #t2-p1 + #t2-p2', format: 'usd', answer: '$18,130.00',
            reasoning: 'Fuel of $7,590.00, insurance of $6,700.00, and $3,840.00 of maintenance and registration — already more than the running costs a buyer usually estimates.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'At the end of the 5 years Ines expects to sell the vehicle for $5,900. Work these without help.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of owning the vehicle for 5 years, counting the purchase price and the running costs and subtracting the resale?',
            given: { purchase: 14800, resale: 5900 }, expr: 'purchase + #t2-p3 - resale', format: 'usd', answer: '$27,030.00',
            reasoning: 'The $14,800 paid out and $18,130.00 of running costs, less the $5,900 that comes back at the end. Resale is subtracted because that part of the purchase price was recovered, not consumed.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the vehicle cost per year across the holding period?',
            given: {}, expr: 'round(#t3-p1 / 5, 2)', format: 'usd', answer: '$5,406.00',
            reasoning: '$27,030.00 spread across the 5 years of ownership.',
          },
          {
            ref: 't3-p3', kind: 'numeric', unit: 'USD',
            text: 'What does the vehicle cost per mile across the 55,000 miles?',
            given: { totalMiles: 55000 }, expr: 'round(#t3-p1 / totalMiles, 2)', format: 'usd', answer: '$0.49',
            reasoning: '$27,030.00 across 55,000 miles. Cost per mile is the figure that lets this vehicle be compared against a different one driven a different distance.',
          },
          {
            ref: 't3-p4', kind: 'choice',
            text: 'Ignoring the purchase price itself, which single running cost is the largest across the 5 years?',
            choices: ['Fuel', 'Insurance', 'Maintenance and registration together'],
            given: {},
            decision: { left: '#t1-p3', cmp: '>', right: '#t2-p1', ifTrue: 'Fuel', ifFalse: 'Insurance' },
            answer: 'Fuel',
            reasoning: '$7,590.00 of fuel against $6,700.00 of insurance and $3,840.00 of maintenance and registration. The two largest are close, which is why a change in either the fuel price or the mileage could reverse this.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'The vehicle’s price is $14,800 and owning it for five years costs $27,030.00. Explain where the extra cost comes from, and say which of the figures in the calculation you would least trust to hold for five years.',
            acceptableAnswerCriteria: [
              'Accounts for the difference by naming the $18,130.00 of running costs and the $5,900 resale that partly offsets the purchase price.',
              'Identifies a specific figure as least reliable with a reason — for example the $3.45 fuel price, the $5,900 resale value, or the $620 maintenance figure holding flat while the vehicle ages.',
              'Explains that the price is a single payment while the running costs recur, so the gap grows with the holding period.',
            ],
            evidenceRequirements: [
              'Cites the $18,130.00 running-cost total and the $5,900 resale figure when reconciling $14,800 against $27,030.00.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response treats resale as a recovery of part of the price rather than as income.',
              'The figure named as least reliable comes with a mechanism, not just a label.',
              'A response naming maintenance is strong if it observes that a flat $620 for a vehicle five years older is optimistic.',
            ],
            commonMisconception: 'Treating the purchase price as the cost of owning something.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Ines is offered a similar vehicle at $12,900 that averages 19 miles per gallon. Say which figure in your calculation that change moves, and roughly how much of the $1,900 price saving it would consume.',
            acceptableAnswerCriteria: [
              'Identifies the fuel line as the figure that moves, because gallons used is miles divided by miles per gallon and nothing else in the calculation depends on the rating.',
              'Estimates the effect at roughly $2,400 across five years and concludes it would consume the whole of the $1,900 price saving and then some.',
            ],
            evidenceRequirements: [
              'Uses the 440-gallon figure or the $7,590.00 five-year fuel total as the base for the comparison.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures'],
            lookFors: [
              'The response scales the fuel line rather than guessing at a total.',
              'The response compares the effect against the price saving rather than reporting it alone.',
            ],
            commonMisconception: 'Comparing two vehicles on price when a running cost differs between them.',
          },
        ],
      },
    ],
    remediation: 'If the five-year total comes out at $32,930.00, the resale value is being added instead of subtracted. The $5,900 is money coming back to Ines at the end, so it reduces what the five years cost. Lay the calculation out as three lines — money out for the purchase, money out for running costs, money back at the end — and check the sign on each line before totalling.',
    extension: 'Recompute the cost per mile if Ines drives 6,000 miles a year instead of 11,000, and say why the cost per mile rises even though the total cost falls.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l02',
    grade: 11, unit: 2, day: 2,
    actor: 'Thaddeus Okonkwo-Reyes, a fictional buyer weighing four ways to get a vehicle',
    objective: 'Compare buying outright, financing, leasing, and delaying a fictional purchase on total outlay, and identify what each comparison leaves the buyer holding at the end.',
    scenario: 'Thaddeus Okonkwo-Reyes is a fictional buyer with four simulated routes to the same vehicle. Every price, payment, and lease term below is invented for this exercise.',
    materials: ['calculator', 'the four fictional offers in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Buying outright costs $19,600 today. Financing means $2,900 down and 60 monthly payments of $348. Leasing means $1,850 due at signing and 36 monthly payments of $229, after which the vehicle is returned.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of the 60 finance payments?',
            given: { payment: 348 }, expr: 'payment * 60', format: 'usd', answer: '$20,880.00',
            reasoning: '60 payments of $348. This is the part of the finance route a monthly figure hides.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the finance route cost in total, counting the deposit?',
            given: { down: 2900 }, expr: '#t1-p1 + down', format: 'usd', answer: '$23,780.00',
            reasoning: 'The $2,900 down payment plus the $20,880.00 of payments.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does financing cost than buying outright?',
            given: { cash: 19600 }, expr: '#t1-p2 - cash', format: 'usd', answer: '$4,180.00',
            reasoning: '$23,780.00 against the $19,600 cash price — the price of spreading the payments over five years.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the 36-month lease cost in total?',
            given: { signing: 1850, leasePayment: 229 }, expr: 'signing + leasePayment * 36', format: 'usd', answer: '$10,094.00',
            reasoning: '$1,850 at signing plus 36 payments of $229. It is the smallest total on the page and the only one that leaves Thaddeus owning nothing.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The fourth route is delay. Thaddeus keeps his current vehicle for 2 more years at $2,150 a year in repairs, and then buys the same model, which by then costs $17,200.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the 2 extra years of repairs cost?',
            given: { repairs: 2150 }, expr: 'repairs * 2', format: 'usd', answer: '$4,300.00',
            reasoning: 'Two years at $2,150. Delay is not free: the repairs are the price of waiting.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does the delay route cost in total, counting the repairs and the later purchase?',
            given: { laterPrice: 17200 }, expr: '#t2-p1 + laterPrice', format: 'usd', answer: '$21,500.00',
            reasoning: '$4,300.00 of repairs plus the $17,200 the vehicle costs in two years’ time.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does delaying cost than buying outright today?',
            given: { cash2: 19600 }, expr: '#t2-p2 - cash2', format: 'usd', answer: '$1,900.00',
            reasoning: 'The $2,400 the vehicle has fallen in price is less than the $4,300.00 spent keeping the old one running, so waiting costs more here rather than less.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Among the three routes that end with Thaddeus owning the vehicle, what separates the most expensive from the least?',
            given: { cash3: 19600 },
            expr: 'max(#t1-p2, #t2-p2, cash3) - min(#t1-p2, #t2-p2, cash3)', format: 'usd', answer: '$4,180.00',
            reasoning: 'The three ownership routes total $23,780.00, $21,500.00, and $19,600 — a spread of $4,180.00 between financing and paying outright, with delay in between.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'The lease has the lowest total on the page at $10,094.00. Why can it not be ranked against the other three on that figure?',
            choices: [
              'Because it covers 36 months and leaves no vehicle, while the others cover 60 months and end in ownership',
              'Because lease payments are not really payments',
              'Because the deposit at signing is larger than the finance deposit',
            ],
            given: {},
            answer: 'Because it covers 36 months and leaves no vehicle, while the others cover 60 months and end in ownership',
            reasoning: 'The scenario states the vehicle is returned at the end of the 36 months, so the lease buys a different thing over a different period; the $1,850 signing amount is in fact smaller than the $2,900 finance deposit, so the third option contradicts the scenario.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Rank the four routes for Thaddeus and defend the ranking. State explicitly what you are holding constant to make the comparison, and what your ranking would change to if he could only find $1,000 today.',
            acceptableAnswerCriteria: [
              'Produces a ranking that puts buying outright at $19,600 ahead of delay at $21,500.00 and financing at $23,780.00 on total outlay, and handles the lease separately rather than slotting it in on total alone.',
              'Names what is being held constant, such as a five-year holding period, or the assumption that the $17,200 future price is known.',
              'Revises the ranking under the $1,000 constraint, recognising that buying outright, the $2,900 finance deposit, and the $1,850 due at lease signing are all out of reach, which leaves delay as the only available route.',
            ],
            evidenceRequirements: [
              'Cites at least three of the four route totals when defending the ranking.',
            ],
            dimensions: ['tradeoff-defense', 'plan-coherence', 'criteria-application'],
            lookFors: [
              'The response says why the lease cannot be ranked on total outlay rather than ignoring it.',
              'The revised ranking follows from the cash constraint rather than being asserted.',
              'Any ranking is acceptable if the criterion behind it is stated and applied consistently.',
            ],
            commonMisconception: 'Ranking options with different terms and different end states on total outlay alone.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The delay route assumes the vehicle will cost $17,200 in two years. Explain what makes that figure different in kind from the other figures in this comparison, and say what would happen to the ranking if it turned out to be $19,900.',
            acceptableAnswerCriteria: [
              'Explains that the other figures are quoted terms Thaddeus could hold someone to, while the future price is a forecast nobody has committed to.',
              'States that at $19,900 the delay route would total $24,200, making it the most expensive of the three ownership routes rather than the middle one.',
            ],
            evidenceRequirements: [
              'Refers to the $21,500.00 delay total and to at least one quoted figure, such as the $348 monthly payment or the $19,600 cash price.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes a quoted term from a projected one.',
              'The revised total is computed rather than described as "higher".',
            ],
            commonMisconception: 'Treating every number in a comparison as equally solid because they all appear on the same page.',
          },
        ],
      },
    ],
    remediation: 'If the finance route comes out at $20,880.00, the deposit has been left out; if it comes out near $24,000 with no deposit line, the deposit is being double-counted inside the payments. The finance route is exactly two payments of a different kind: $2,900 once, and $348 sixty times. Write those as two lines and total them before comparing anything.',
    extension: 'Work out what the vehicle would have to cost in two years for the delay route to beat buying outright today, and say whether that price drop is larger or smaller than the one the scenario assumes.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l03',
    grade: 11, unit: 2, day: 3,
    actor: 'Beatriz Sandoval-Haugen, a fictional owner tracking what depreciation actually does',
    objective: 'Apply a declining-balance depreciation model to a fictional vehicle across five years, show that the loss is front-loaded, and contrast it with a straight-line assumption.',
    scenario: 'Beatriz Sandoval-Haugen owns a fictional vehicle bought new for $23,400. The depreciation rate below is an invented simplification and no real vehicle loses value on so regular a schedule.',
    materials: ['calculator', 'the fictional depreciation figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the simplified model, the vehicle loses 17% of whatever it is worth at the start of each year. Round each value to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the vehicle worth after 1 year?',
            given: { price: 23400, rate: 0.17 }, expr: 'round(price * pow(1 - rate, 1), 2)', format: 'usd', answer: '$19,422.00',
            reasoning: '17% comes off the $23,400 starting value, leaving 83% of it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after 3 years?',
            given: { price2: 23400, rate2: 0.17 }, expr: 'round(price2 * pow(1 - rate2, 3), 2)', format: 'usd', answer: '$13,379.82',
            reasoning: 'Three successive years of losing 17% of a shrinking value, not 51% of the original price.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after 5 years?',
            given: { price3: 23400, rate3: 0.17 }, expr: 'round(price3 * pow(1 - rate3, 5), 2)', format: 'usd', answer: '$9,217.36',
            reasoning: 'Five years of the same proportional loss. Under this model the value approaches zero without ever reaching it.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure the loss rather than the remaining value.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much value does the vehicle lose in its first year alone?',
            given: { price4: 23400 }, expr: 'price4 - #t1-p1', format: 'usd', answer: '$3,978.00',
            reasoning: '$23,400 against the $19,422.00 it is worth a year later.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much value does it lose across all 5 years?',
            given: { price5: 23400 }, expr: 'price5 - #t1-p3', format: 'usd', answer: '$14,182.64',
            reasoning: '$23,400 against the $9,217.36 remaining after five years.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'The first year’s loss is what percentage of the whole five-year loss? Give one decimal place.',
            given: {}, expr: 'round(#t2-p1 / #t2-p2 * 100, 1)', format: 'percent1', answer: '28.0%',
            reasoning: '$3,978.00 against $14,182.64 — a single year carries more than a quarter of a five-year loss, which is what "front-loaded" means in figures.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'A straight-line assumption would spread the fall from $23,400 to a $6,000 value evenly across the 5 years. What annual loss does that give?',
            given: { price6: 23400, residual: 6000 }, expr: 'round((price6 - residual) / 5, 2)', format: 'usd', answer: '$3,480.00',
            reasoning: '$17,400 of assumed loss spread evenly over 5 years — a simpler model that gets the total roughly right and the timing wrong.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'For someone planning to sell after only 1 year, which model gives the more favourable and more misleading answer?',
            choices: [
              'The straight-line model, which understates the first year’s loss',
              'The declining-balance model, which understates the first year’s loss',
              'Both models agree in the first year',
            ],
            given: {},
            decision: { left: '#t2-p1', cmp: '>', right: '#t2-p4', ifTrue: 'The straight-line model, which understates the first year’s loss', ifFalse: 'The declining-balance model, which understates the first year’s loss' },
            answer: 'The straight-line model, which understates the first year’s loss',
            reasoning: 'The declining-balance model puts the first year’s loss at $3,978.00 while straight-line puts it at $3,480.00, so a one-year seller relying on straight-line expects to lose $498.00 less than the front-loaded model predicts.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why buying a vehicle and selling it after one year is expensive even if nothing goes wrong with it, and say what that implies about how long a buyer should plan to keep one.',
            acceptableAnswerCriteria: [
              'Identifies the $3,978.00 first-year loss as a real cost of that year, borne whether or not the vehicle needed anything.',
              'Explains that because the loss is front-loaded, spreading it over more years lowers the cost per year of ownership.',
              'Draws the implication that short holding periods carry a disproportionate share of the depreciation, so a buyer expecting to sell soon pays more per year than the price suggests.',
            ],
            evidenceRequirements: [
              'Cites the 28.0% share of the five-year loss that falls in year one.',
            ],
            dimensions: ['reasoning-from-figures', 'plan-coherence', 'transfer'],
            lookFors: [
              'The response treats depreciation as a cost incurred, not as a paper figure.',
              'The response connects holding period to cost per year rather than only to total cost.',
              'A response noting that maintenance rises as depreciation falls is going beyond what was asked and is a strength.',
            ],
            commonMisconception: 'Believing depreciation is only a cost at the moment a vehicle is sold.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Both models are simplifications. Name one thing about real vehicle values that neither the 17% declining-balance model nor the straight-line model captures, and say which of the computed figures it would move most.',
            acceptableAnswerCriteria: [
              'Names something genuine and specific, such as mileage or condition changing the value independently of age, a model’s reputation, or market shifts in fuel prices or supply.',
              'Ties the named factor to a specific figure, most defensibly the $9,217.36 five-year value, and says in which direction it could move.',
            ],
            evidenceRequirements: [
              'Refers to at least one computed value from the declining-balance schedule when naming what would move.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The factor named is something that actually varies between vehicles of the same age.',
              'The response identifies a figure and a direction rather than saying the model is "not realistic".',
            ],
          },
        ],
      },
    ],
    remediation: 'If the three-year value comes out at $11,466.00, the 17% is being taken from the original price three times rather than from the value at the start of each year. Build the schedule as a ladder: $23,400 to $19,422.00, then 17% off that, then 17% off the result. Each year’s loss is smaller than the last, which is exactly what the straight-line model misses.',
    extension: 'Find the first year in which the declining-balance value rises above the straight-line value, and explain why the two schedules must cross rather than run parallel.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l04',
    grade: 11, unit: 2, day: 4,
    actor: 'Malik Sørensen-Adeyemi, a fictional worker fitting a vehicle into a monthly plan',
    objective: 'Compute what a fictional vehicle costs each month in total, measure it against take-home pay and the rest of a monthly plan, and quantify what the purchase displaces.',
    scenario: 'Malik Sørensen-Adeyemi is a fictional warehouse supervisor with the simulated monthly figures below. No real household budget, wage, or account is involved.',
    materials: ['calculator', 'the fictional monthly plan in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The vehicle would cost $389 a month in payments, $118 a month in insurance, and $132 a month in fuel. Malik’s take-home pay is $2,840 a month.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the vehicle cost Malik each month in total?',
            given: { payment: 389, insurance: 118, fuel: 132 }, expr: 'payment + insurance + fuel', format: 'usd', answer: '$639.00',
            reasoning: 'The payment is only 61% of what the vehicle costs each month; insurance and fuel are as much a condition of driving it as the loan is.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of Malik’s $2,840 take-home pay does the vehicle take? Give one decimal place.',
            given: { takeHome: 2840 }, expr: 'round(#t1-p1 / takeHome * 100, 1)', format: 'percent1', answer: '22.5%',
            reasoning: '$639.00 against $2,840 of take-home pay. Measuring against take-home rather than gross is what makes the share meaningful.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'What share would the $389 payment alone have suggested? Give one decimal place.',
            given: { payment2: 389, takeHome2: 2840 }, expr: 'round(payment2 / takeHome2 * 100, 1)', format: 'percent1', answer: '13.7%',
            reasoning: 'The payment on its own reads as 13.7% — the figure a buyer checking affordability against the loan alone would see.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The rest of Malik’s plan is housing at $1,180, food at $460, and utilities and phone at $235 a month. His savings goal is $450 a month.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do housing, food, and utilities come to each month?',
            given: { housing: 1180, food: 460, utilities: 235 }, expr: 'housing + food + utilities', format: 'usd', answer: '$1,875.00',
            reasoning: 'The three commitments that were already in the plan before the vehicle was considered.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is left each month once those commitments and the vehicle are paid?',
            given: { takeHome3: 2840 }, expr: 'takeHome3 - #t2-p1 - #t1-p1', format: 'usd', answer: '$326.00',
            reasoning: '$2,840 less $1,875.00 of commitments and $639.00 for the vehicle.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'By how much does that fall short of the $450 savings goal?',
            given: { goal: 450 }, expr: 'goal - #t2-p2', format: 'usd', answer: '$124.00',
            reasoning: 'The $450 goal against the $326.00 actually available — the vehicle does not break the plan, it displaces the saving inside it.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Across the 60 months of the loan, how much saving does that monthly shortfall represent?',
            given: {}, expr: '#t2-p3 * 60', format: 'usd', answer: '$7,440.00',
            reasoning: '$124.00 a month for the 60 months of the loan — the cumulative size of what a $124 monthly gap actually costs.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which figure most fairly answers the question "can Malik afford this vehicle?"',
            choices: [
              'The $389 monthly payment, because that is what the lender requires',
              'The $639.00 monthly total, because insurance and fuel are also required to drive it',
              'The $326.00 left over, because a positive balance means it is affordable',
            ],
            given: {},
            answer: 'The $639.00 monthly total, because insurance and fuel are also required to drive it',
            reasoning: 'Affordability is about the whole cost of the commitment, and the scenario makes insurance and fuel unavoidable; the leftover of $326.00 is the consequence of that cost rather than a measure of it, and a positive balance that misses the savings goal by $124.00 is not by itself proof of affordability.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Nothing in Malik’s plan goes negative, yet the purchase has a real cost beyond the money. Describe what the purchase displaces, quantify it over the life of the loan, and say what that would mean if an unexpected $900 bill arrived in month 14.',
            acceptableAnswerCriteria: [
              'Identifies the savings goal as what is displaced, and quantifies it as $124.00 a month or $7,440.00 over the 60 months.',
              'Explains that a plan with $326.00 of monthly slack and no accumulated reserve has no way to absorb a $900 bill in month 14 other than borrowing or cutting a commitment.',
              'Distinguishes a plan that balances from a plan that is resilient.',
            ],
            evidenceRequirements: [
              'Cites the $326.00 remaining and the $450 goal, and uses the $7,440.00 cumulative figure or an equivalent multi-month total.',
            ],
            dimensions: ['plan-coherence', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response reasons about the reserve that was not built, not only about the monthly gap.',
              'The month-14 case is answered with the figures rather than in general terms.',
              'A response noting that three months of the $326.00 left over roughly equals the $900 bill is using the arithmetic well.',
            ],
            commonMisconception: 'Treating "the numbers balance" as the same thing as "this is affordable".',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The payment alone reads as 13.7% of take-home pay and the full cost reads as 22.5%. Explain which of the two a lender is more likely to use and why, and say what that means for a buyer reading a lender’s approval as advice.',
            acceptableAnswerCriteria: [
              'Explains that a lender is assessing whether its own payment will be made, so the $389 figure is the one relevant to its decision.',
              'Concludes that an approval answers a narrower question than "can I afford this", so a buyer should not read it as a judgement about the whole $639.00 commitment.',
            ],
            evidenceRequirements: [
              'Uses both percentage figures, 13.7% and 22.5%, when explaining the difference in what each measures.',
            ],
            dimensions: ['criteria-application', 'tradeoff-defense'],
            lookFors: [
              'The response treats the lender as answering a legitimate but different question rather than as acting in bad faith.',
              'The response says what the buyer should do with the approval, not just that it is incomplete.',
            ],
            commonMisconception: 'Reading a lending decision as a verdict on whether a purchase is affordable.',
          },
        ],
      },
    ],
    remediation: 'If the leftover comes out at $576.00, only the $389 payment is in the plan and the insurance and fuel are missing. The vehicle costs $639.00 a month, not $389.00. Rebuild the month as a single column — take-home at the top, then every commitment including all three vehicle lines — and check the column has as many rows as the scenario has commitments.',
    extension: 'Find the largest monthly payment Malik could take on and still meet the $450 savings goal, holding insurance and fuel unchanged, and say how much less vehicle that implies.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l05',
    grade: 11, unit: 2, day: 5,
    actor: 'Cordelia Nakamura-Obi, a fictional buyer preparing for a negotiation',
    objective: 'Quantify what independent information is worth in a fictional negotiation by separating the price move from the trade-in move, and identify which side holds which information.',
    scenario: 'Cordelia Nakamura-Obi is a fictional buyer at a simulated dealership. The asking price, the comparable sales, and the trade-in offers below are invented and describe no real dealer or market.',
    materials: ['calculator', 'the fictional price and trade-in figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The dealer is asking $16,900. Cordelia has found two recent comparable sales of the same fictional model, at $15,800 and $16,300.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the midpoint of the two comparable sales at $15,800 and $16,300?',
            given: { lowComp: 15800, highComp: 16300 }, expr: 'round((lowComp + highComp) / 2, 2)', format: 'usd', answer: '$16,050.00',
            reasoning: 'A midpoint of two observed sales is a defensible opening reference precisely because Cordelia can say where it came from.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How far above that midpoint is the asking price?',
            given: { asking: 16900 }, expr: 'asking - #t1-p1', format: 'usd', answer: '$850.00',
            reasoning: '$16,900 against the $16,050.00 midpoint. This gap is what the comparable sales gave Cordelia to argue with.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Cordelia also has a vehicle to dispose of. The dealer offers $4,200 as a trade-in. A private sale would bring $5,650 but would take several weeks and carries the risk of no sale at all.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does the private sale bring than the trade-in offer?',
            given: { privateSale: 5650, tradeIn: 4200 }, expr: 'privateSale - tradeIn', format: 'usd', answer: '$1,450.00',
            reasoning: '$5,650 against $4,200 — the amount the dealer’s convenience is being paid for.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'If Cordelia wins both the price argument and the private sale, how much better off is she than accepting both of the dealer’s figures?',
            given: {}, expr: '#t1-p2 + #t2-p1', format: 'usd', answer: '$2,300.00',
            reasoning: '$850.00 off the price plus $1,450.00 more for the old vehicle — two separate transactions that a single "out the door" figure would blend together.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'That combined amount is what percentage of the $16,900 asking price? Give one decimal place.',
            given: { asking2: 16900 }, expr: 'round(#t2-p2 / asking2 * 100, 1)', format: 'percent1', answer: '13.6%',
            reasoning: '$2,300.00 against $16,900 — the share of the headline price that rests on information rather than on the vehicle.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Suppose the dealer agrees to the midpoint price but only if Cordelia takes the $4,200 trade-in. What is her net position compared with paying the asking price and selling privately?',
            given: {}, expr: '#t1-p2 - #t2-p1', format: 'usd', answer: '-$600.00',
            reasoning: 'The $850.00 saved on price is less than the $1,450.00 given up on the trade-in, so the bundled deal leaves Cordelia $600.00 worse off — which is why the two transactions have to be priced separately.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'One more comparison, on the information itself.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'If the private sale fails and Cordelia ends up taking the trade-in after all, having still won the price argument, what has the negotiation been worth?',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'usd', answer: '$850.00',
            reasoning: 'Only the price move survives, so the value falls back to the $850.00 the comparable sales produced.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which piece of information in this scenario does the dealer have that Cordelia does not?',
            choices: [
              'What the dealer paid for the vehicle and what it can resell her trade-in for',
              'The two comparable sale prices',
              'The condition of Cordelia’s current vehicle',
            ],
            given: {},
            answer: 'What the dealer paid for the vehicle and what it can resell her trade-in for',
            reasoning: 'The scenario gives Cordelia the comparable sales and she has driven her own vehicle, so she holds those two; what she cannot see is the dealer’s own cost and resale position, which is what makes the bundled offer hard for her to price.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'A dealer offers Cordelia "the best out-the-door price" as a single figure covering both the purchase and the trade-in. Explain why a single figure is harder to evaluate than two, using the $600.00 result, and say what Cordelia should ask for instead.',
            acceptableAnswerCriteria: [
              'Explains that a blended figure lets a gain on one side hide a larger loss on the other, and points to the bundled deal that looked like a win on price but left her $600.00 worse off.',
              'States what to ask for: the purchase price and the trade-in value quoted separately so each can be checked against its own evidence.',
              'Notes that Cordelia has independent evidence for both sides — the comparable sales and the private-sale figure — but can only use it if the numbers are separated.',
            ],
            evidenceRequirements: [
              'Cites the $850.00 price move and the $1,450.00 trade-in gap, and the -$600.00 net result of bundling them.',
            ],
            dimensions: ['evidence-use', 'tradeoff-defense', 'criteria-application'],
            lookFors: [
              'The response identifies blending as the mechanism, not merely that the dealer is being unhelpful.',
              'The request Cordelia should make is specific and checkable.',
              'The response does not assume the dealer is acting dishonestly; a bundled quote can be offered in good faith and still be hard to evaluate.',
            ],
            commonMisconception: 'Judging a deal on a single total when it contains two separately priced transactions.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The private sale is worth $1,450.00 more but takes weeks and might not happen. Say what would have to be true about Cordelia’s situation for the trade-in to be the better choice despite the gap.',
            acceptableAnswerCriteria: [
              'Names a specific condition under which the certainty is worth more than $1,450.00 — for example needing the vehicle gone before a move, or having no safe way to meet private buyers.',
              'Treats the $1,450.00 as the price of certainty and speed rather than as money simply lost.',
            ],
            evidenceRequirements: [
              'Refers to the $1,450.00 gap and to the risk or delay stated in the scenario when justifying the choice.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty'],
            lookFors: [
              'The condition named is concrete rather than a general preference for convenience.',
              'The response prices the risk rather than dismissing either option.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the bundled deal comes out as a $2,300.00 gain, the trade-in concession is being added instead of subtracted. In that deal Cordelia wins $850.00 on the price and gives up $1,450.00 on the trade-in, so the two move in opposite directions. Write each transaction on its own line with a sign, and total the signed column.',
    extension: 'Find the trade-in figure at which the bundled deal would leave Cordelia exactly even, and say what she would need to know about the dealer to judge whether that figure is achievable.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l06',
    grade: 11, unit: 2, day: 6,
    actor: 'Rafael Bergström-Osei, a fictional buyer reading a required disclosure box',
    objective: 'Read a fictional standardised credit disclosure, recompute its figures independently, and show what a monthly-payment advertisement leaves out that the disclosure is designed to expose.',
    scenario: 'Rafael Bergström-Osei is a fictional buyer looking at the simulated disclosure box below. The lender, the figures, and the advertisement are invented; the general idea that governments require standardised cost disclosure on credit is the real point of the lesson.',
    materials: ['calculator', 'the fictional disclosure box and advertisement in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional disclosure box reads: "Amount financed $18,450. Monthly payment $367.20. Number of payments 66." The advertisement beside it says only: "Drive away from $299 a month" and, in small print, "84 monthly payments".',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under the disclosure box?',
            given: { payment: 367.2, count: 66 }, expr: 'round(payment * count, 2)', format: 'usd', answer: '$24,235.20',
            reasoning: '66 payments of $367.20. The disclosure requires this figure precisely because a monthly amount alone does not produce it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the finance charge — the amount paid above the $18,450 financed?',
            given: { financed: 18450 }, expr: '#t1-p1 - financed', format: 'usd', answer: '$5,785.20',
            reasoning: '$24,235.20 of payments against $18,450 borrowed. The finance charge is the cost of the credit itself, separate from the price of the vehicle.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'percent',
            text: 'The finance charge is what percentage of the amount financed? Give one decimal place.',
            given: { financed2: 18450 }, expr: 'round(#t1-p2 / financed2 * 100, 1)', format: 'percent1', answer: '31.4%',
            reasoning: '$5,785.20 against $18,450. This is not an annual rate — it is the total cost of the credit across all 66 months, which is why a rate and a total are both disclosed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same arithmetic for the advertised offer. It finances the same $18,450 over 84 monthly payments of $299.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under the advertised offer?',
            given: { adPayment: 299, adCount: 84 }, expr: 'round(adPayment * adCount, 2)', format: 'usd', answer: '$25,116.00',
            reasoning: '84 payments of $299 — the smaller monthly figure over the longer term.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the finance charge on the advertised offer?',
            given: { financed3: 18450 }, expr: '#t2-p1 - financed3', format: 'usd', answer: '$6,666.00',
            reasoning: '$25,116.00 of payments against the same $18,450 financed.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does the advertised offer cost in finance charges than the one in the disclosure box?',
            given: {}, expr: '#t2-p2 - #t1-p2', format: 'usd', answer: '$880.80',
            reasoning: '$6,666.00 against $5,785.20 — the price of the lower monthly figure, invisible unless both totals are computed.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much lower is the advertised monthly payment than the one in the disclosure box?',
            given: { adPayment2: 299, payment2: 367.2 }, expr: 'payment2 - adPayment2', format: 'usd', answer: '$68.20',
            reasoning: '$367.20 against $299 — the only figure the advertisement actually invites a buyer to compare.',
          },
          {
            ref: 't2-p5', kind: 'choice',
            text: 'Which figure does the advertisement omit that changes the comparison most?',
            choices: [
              'The number of payments and the total they come to',
              'The amount financed, which is $18,450 in both offers',
              'The monthly payment, which is stated as $299',
            ],
            given: {},
            answer: 'The number of payments and the total they come to',
            reasoning: 'The advertisement does state $299 and the two offers finance the same $18,450, so neither of those is the omission; what it buries is that 84 payments rather than 66 turn a $68.20 monthly saving into $880.80 of extra finance charges.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain what a standardised disclosure box is for, using the two offers as the example, and say why requiring the total of payments does more work than requiring the monthly payment to be accurate.',
            acceptableAnswerCriteria: [
              'Explains that standardising which figures must be shown makes two offers comparable on the same terms, rather than on whichever figure each seller finds flattering.',
              'Points out that the advertised $299 is perfectly accurate and still misleading about cost, so accuracy of the monthly figure is not the protection that matters.',
              'Identifies the total of payments, or the finance charge, as the figure that exposes the $880.80 difference.',
            ],
            evidenceRequirements: [
              'Cites both finance charges, $5,785.20 and $6,666.00, and the $68.20 monthly difference that pulls the other way.',
            ],
            dimensions: ['criteria-application', 'reasoning-from-figures', 'evidence-use'],
            lookFors: [
              'The response distinguishes a true statement from a complete one.',
              'The response explains comparability as the purpose, not merely honesty.',
              'A response noting that a longer term can still be the right choice for someone with a tight monthly constraint is showing good judgement, provided it names the $880.80 cost.',
            ],
            commonMisconception: 'Assuming that an advertisement stating only true figures cannot mislead.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'The finance charge is 31.4% of the amount financed over 66 months. Explain why that figure is not the interest rate, and say which additional piece of information from the disclosure would let a buyer compare two loans of different lengths.',
            acceptableAnswerCriteria: [
              'Explains that 31.4% is a total across five and a half years, while a rate is charged per year on a balance that falls as the loan is repaid.',
              'Identifies an annualised rate as the figure that makes different-length loans comparable, and notes it is disclosed alongside the totals for that reason.',
            ],
            evidenceRequirements: [
              'Refers to the 66-payment term alongside the 31.4% figure when explaining why the two are not the same thing.',
            ],
            dimensions: ['criteria-application', 'transfer'],
            lookFors: [
              'The response mentions that the balance falls over the term, so the charge is not levied on the full amount throughout.',
              'The response names annualisation as the mechanism that makes terms comparable.',
            ],
            commonMisconception: 'Reading a total finance charge as a percentage rate.',
          },
        ],
      },
    ],
    remediation: 'If the finance charge comes out as $24,235.20, the amount financed has not been subtracted — that figure is everything Rafael pays, not the extra he pays for the credit. The finance charge is the difference between what is paid in total and what was borrowed. Write the two figures one above the other and subtract before doing anything else with them.',
    extension: 'Work out what monthly payment over 84 months would give the same total of payments as the disclosure box, and say how close that is to the advertised $299.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l07',
    grade: 11, unit: 2, day: 7,
    actor: 'Jocasta Mbeki-Larsen, a fictional student auditing a purchase worksheet',
    objective: 'Diagnose a fictional purchase comparison that selects on monthly payment, recompute both offers on total cost, and state the condition under which the worksheet’s choice would nonetheless be right.',
    scenario: 'Jocasta Mbeki-Larsen is a fictional student checking the simulated worksheet below. The offers, the payments, and the worksheet’s conclusion are invented for this exercise.',
    materials: ['calculator', 'the fictional worksheet reproduced in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'warm-up',
        directions: 'The worksheet reads: "Same vehicle, $17,400 financed either way. Offer 1: $421 a month for 48 months. Offer 2: $348 a month for 72 months. Offer 2 saves $73 every month. Choose Offer 2." Both offers finance the same amount and neither has a deposit.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'Confirm the worksheet’s monthly saving: how much less is Offer 2 each month?',
            given: { pay1: 421, pay2: 348 }, expr: 'pay1 - pay2', format: 'usd', answer: '$73.00',
            reasoning: '$421 against $348. The worksheet’s only computed figure is correct, which is why the conclusion feels safe.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under Offer 1?',
            given: { pay1b: 421 }, expr: 'pay1b * 48', format: 'usd', answer: '$20,208.00',
            reasoning: '48 payments of $421, the figure the worksheet never computed for either offer.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the total of payments under Offer 2?',
            given: { pay2b: 348 }, expr: 'pay2b * 72', format: 'usd', answer: '$25,056.00',
            reasoning: '72 payments of $348 — 24 more payments than Offer 1, each of them smaller.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'guided',
        directions: 'Both offers finance the same $17,400, so the amount paid above that is the cost of the credit.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the interest cost of Offer 1?',
            given: { financed: 17400 }, expr: '#t1-p2 - financed', format: 'usd', answer: '$2,808.00',
            reasoning: '$20,208.00 paid against $17,400 borrowed.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the interest cost of Offer 2?',
            given: { financed2: 17400 }, expr: '#t1-p3 - financed2', format: 'usd', answer: '$7,656.00',
            reasoning: '$25,056.00 paid against the same $17,400 borrowed.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much extra interest does the worksheet’s recommended offer cost?',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'usd', answer: '$4,848.00',
            reasoning: '$7,656.00 against $2,808.00 — more than two and a half times as much interest, on the offer the worksheet selected.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'Across the 48 months both offers share, how much does the monthly saving on Offer 2 add up to?',
            given: {}, expr: '#t1-p1 * 48', format: 'usd', answer: '$3,504.00',
            reasoning: '$73.00 a month for the 48 months of Offer 1’s term. Even counting every month of relief, it does not reach the $4,848.00 of extra interest.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Locate the defect precisely.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'After the 48 months of Offer 1 have ended, how much is still owed on Offer 2 in remaining payments?',
            given: { pay2c: 348 }, expr: 'pay2c * 24', format: 'usd', answer: '$8,352.00',
            reasoning: 'The 24 payments of $348 that fall after Offer 1 has been fully repaid — the part of the deal the monthly comparison never reaches.',
          },
          {
            ref: 't3-p2', kind: 'choice',
            text: 'Which statement identifies the worksheet’s actual error?',
            choices: [
              'It computed the monthly saving incorrectly',
              'It compared two offers on a per-month figure without holding the number of months constant',
              'It used the wrong amount financed for Offer 2',
            ],
            given: {},
            answer: 'It compared two offers on a per-month figure without holding the number of months constant',
            reasoning: 'The $73.00 saving is arithmetically right and both offers finance the same $17,400, so neither of the other statements holds; the defect is comparing a rate per month across terms of 48 and 72 months as though the terms were the same.',
          },
          {
            ref: 't3-p3', kind: 'choice',
            text: 'Which offer costs less in total?',
            choices: ['Offer 1, at 48 months', 'Offer 2, at 72 months', 'They cost the same in total'],
            given: {},
            decision: { left: '#t1-p2', cmp: '<', right: '#t1-p3', ifTrue: 'Offer 1, at 48 months', ifFalse: 'Offer 2, at 72 months' },
            answer: 'Offer 1, at 48 months',
            reasoning: '$20,208.00 against $25,056.00 — the offer with the higher monthly payment is the cheaper one, because it is repaid in two fewer years.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'The worksheet’s arithmetic is correct and its conclusion costs $4,848.00. Explain how a correct figure produced a wrong decision, and give the one additional line the worksheet needed.',
            acceptableAnswerCriteria: [
              'Explains that a per-month figure is only comparable when the number of months is held constant, and that 48 against 72 months breaks that condition.',
              'Names the missing line as the total of payments, or the interest cost, for each offer.',
              'Notes that the $73.00 saving is real but bounded, reaching only $3,504.00 across the shared 48 months against $4,848.00 of extra interest.',
            ],
            evidenceRequirements: [
              'Cites both totals of payments, $20,208.00 and $25,056.00, when showing the decision reversed.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'reasoning-from-figures'],
            lookFors: [
              'The response names the comparability condition rather than saying the worksheet "forgot" something.',
              'The additional line proposed would actually have caught the error.',
              'The response does not claim the $73.00 figure was miscalculated.',
            ],
            commonMisconception: 'Comparing per-period costs across arrangements of different length.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'Describe a situation in which choosing Offer 2 would be defensible despite costing $4,848.00 more, and say what the buyer would have to accept for that choice to make sense.',
            acceptableAnswerCriteria: [
              'Describes a genuine monthly constraint — an income that cannot support $421 a month without displacing something essential — under which the $73.00 of relief is what makes the purchase possible at all.',
              'States what must be accepted: that the extra $4,848.00 is the price of that relief, and that the debt persists for 24 months longer.',
            ],
            evidenceRequirements: [
              'Uses the $73.00 monthly figure and the $4,848.00 total when framing the tradeoff.',
            ],
            dimensions: ['tradeoff-defense', 'transfer'],
            lookFors: [
              'The response treats the longer term as a priced choice rather than as a mistake.',
              'The response names what is given up, not only what is gained.',
            ],
            commonMisconception: 'Concluding that the cheapest total is always the right choice regardless of monthly capacity.',
          },
        ],
      },
    ],
    remediation: 'If Offer 2 still looks cheaper after the interest is computed, check that 72 payments are being counted and not 48. The two offers do not run for the same time, so the only fair comparison is what each costs in total: $20,208.00 against $25,056.00. Write both totals before comparing anything per month.',
    extension: 'Find the monthly payment Offer 2 would need over its 72 months to match Offer 1’s total cost, and say whether that payment would still be lower than $421.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l08',
    grade: 11, unit: 2, day: 8,
    actor: 'Dmitri Ferrante-Oyelowo, a fictional tenant comparing renting with buying',
    objective: 'Transfer the total-cost-of-ownership method to a fictional housing decision, carry rent growth and property appreciation across seven years, and identify what the comparison still omits.',
    scenario: 'Dmitri Ferrante-Oyelowo is a fictional tenant in a simulated city. Every rent, price, rate, and cost below is invented, and no real property, lender, or market is described.',
    materials: ['calculator', 'the fictional rent and ownership figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Renting costs $1,285 a month now and rises 3% at the start of each following year. Use the running-total formula for a stream that grows 3% a year: the first year’s total times ((1 + 0.03) raised to the 7th, less 1) divided by 0.03. Use a 7-year comparison throughout.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does renting cost across the 7 years?',
            given: { rent: 1285, growth: 0.03 }, expr: 'round(rent * 12 * (pow(1 + growth, 7) - 1) / growth, 2)', format: 'usd', answer: '$118,155.17',
            reasoning: 'Twelve months of $1,285 in the first year, then six further years each 3% above the last, totalled by the closed form.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'Owning costs $1,412 a month in loan payments, $296 a month in property tax, and $118 a month in insurance. What is the monthly ownership outlay?',
            given: { loan: 1412, tax: 296, insurance: 118 }, expr: 'loan + tax + insurance', format: 'usd', answer: '$1,826.00',
            reasoning: 'The loan payment is only part of what a house costs each month; the tax and insurance are as unavoidable as the loan.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does that monthly outlay come to across the 7 years?',
            given: {}, expr: '#t1-p2 * 12 * 7', format: 'usd', answer: '$153,384.00',
            reasoning: '$1,826.00 a month for 84 months, held flat because the loan payment is fixed and the tax and insurance are assumed steady.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The house costs $228,000. Maintenance runs at 1% of that price each year, closing costs were $6,800 at purchase, and the house appreciates 2.5% a year.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does maintenance cost across the 7 years at 1% of the price each year?',
            given: { price: 228000, maintRate: 0.01 }, expr: 'round(price * maintRate * 7, 2)', format: 'usd', answer: '$15,960.00',
            reasoning: '1% of $228,000 is $2,280 a year, for each of 7 years. Maintenance has no landlord to fall to.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of owning across the 7 years, counting the outlay, the maintenance, and the closing costs?',
            given: { closing: 6800 }, expr: '#t1-p3 + #t2-p1 + closing', format: 'usd', answer: '$176,144.00',
            reasoning: '$153,384.00 of monthly outlay, $15,960.00 of maintenance, and the $6,800 paid once at purchase.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the house worth after 7 years at 2.5% appreciation a year?',
            given: { price2: 228000, appreciation: 0.025 }, expr: 'round(price2 * pow(1 + appreciation, 7), 2)', format: 'usd', answer: '$271,020.35',
            reasoning: 'Seven years of compounding at 2.5% on the $228,000 purchase price.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much has the house gained in value across the 7 years?',
            given: { price3: 228000 }, expr: '#t2-p3 - price3', format: 'usd', answer: '$43,020.35',
            reasoning: '$271,020.35 against the $228,000 paid — the part of ownership that renting has no equivalent for.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'Netting the appreciation against the cost of owning, how much more does owning cost than renting across the 7 years?',
            given: {}, expr: '#t2-p2 - #t2-p4 - #t1-p1', format: 'usd', answer: '$14,968.48',
            reasoning: '$176,144.00 of ownership cost less $43,020.35 of appreciation, compared against $118,155.17 of rent — owning still costs more at this horizon, though by less than a single year of rent.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'This comparison uses the same method as the vehicle analysis earlier in the unit. Name the one term that had to be added for housing, explain why the vehicle case did not need it, and state one important cost this comparison still leaves out.',
            acceptableAnswerCriteria: [
              'Identifies appreciation as the added term, and explains that the vehicle case only ever had depreciation because vehicles lose value while the house is assumed to gain it.',
              'Names a genuine omission with a reason — most strongly that the $1,412 payment includes principal repayment, which builds equity recovered on sale, so counting the whole payment as cost while counting only appreciation as a return understates ownership; the deposit tied up in the house, the cost of selling, and the rent scenario having no equivalent to the $6,800 closing cost are also acceptable.',
              'Keeps the conclusion attached to the 7-year horizon rather than generalising it.',
            ],
            evidenceRequirements: [
              'Cites the $43,020.35 of appreciation and the $14,968.48 net difference when describing what the added term did to the comparison.',
            ],
            dimensions: ['transfer', 'reasoning-from-figures', 'assumption-identification'],
            lookFors: [
              'The response describes the method as transferable and says precisely where it needed adjusting.',
              'The omission named is one that would actually move the $14,968.48 figure; naming the principal repaid inside the payment is the strongest available answer and should be credited as such.',
              'A response noting that the appreciation is unrealised until the house is sold is showing exactly the right caution.',
            ],
            commonMisconception: 'Treating a gain in an asset’s value as though it were money already received.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Rent grows at 3% a year while the loan payment stays at $1,412. Say what that difference does to the comparison at a 20-year horizon, and name the assumption that would have to hold for your answer to be right.',
            acceptableAnswerCriteria: [
              'States that a growing rent against a fixed payment closes and eventually reverses the $14,968.48 gap, so owning wins at long enough horizons.',
              'Names the assumption the argument depends on, such as the 3% rent growth continuing, or the loan payment genuinely staying fixed for twenty years.',
            ],
            evidenceRequirements: [
              'Refers to the fixed $1,412 payment and the 3% rent growth as the two things moving in opposite directions.',
            ],
            dimensions: ['transfer', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies the mechanism as one figure growing while the other does not.',
              'The assumption named is one that could actually fail, not a generic caveat.',
            ],
          },
        ],
      },
    ],
    remediation: 'If owning comes out cheaper than renting, the appreciation is probably being counted twice — once as a gain and again as a reduction in cost. It enters the comparison once, as a subtraction from the $176,144.00 of ownership cost. Lay the comparison out as two columns, put every ownership figure in one and the rent total in the other, and check that $43,020.35 appears exactly once.',
    extension: 'Find the annual appreciation rate at which owning and renting would cost the same across the 7 years, and say how far that is from the 2.5% the scenario assumes.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l09',
    grade: 11, unit: 2, day: 9,
    actor: 'Yolanda Castellanos-Njoku, a fictional owner choosing how long to keep a vehicle',
    objective: 'Combine depreciation and rising running costs to find the cost per year of two fictional holding periods, and identify the tension that decides the best time to sell.',
    scenario: 'Yolanda Castellanos-Njoku owns a fictional vehicle bought for $26,500. The depreciation rate and running costs below are invented figures used to make the tradeoff visible.',
    materials: ['calculator', 'the fictional holding-period figures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Under the simplified model the vehicle loses 16% of its value each year. Running costs are $2,960 a year for the first 5 years and $4,310 a year after that, as repairs become more frequent. Round each value to the cent.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the vehicle worth after 3 years?',
            given: { price: 26500, rate: 0.16 }, expr: 'round(price * pow(1 - rate, 3), 2)', format: 'usd', answer: '$15,706.66',
            reasoning: 'Three years of losing 16% of a shrinking value on the $26,500 purchase price.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is it worth after 8 years?',
            given: { price2: 26500, rate2: 0.16 }, expr: 'round(price2 * pow(1 - rate2, 8), 2)', format: 'usd', answer: '$6,568.71',
            reasoning: 'Eight years of the same proportional loss. Most of the fall has already happened by year 3.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much value is lost across the first 3 years?',
            given: { price3: 26500 }, expr: 'price3 - #t1-p1', format: 'usd', answer: '$10,793.34',
            reasoning: '$26,500 against $15,706.66 — over $10,000 gone in three years, which is the cost of the early years of ownership.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much value is lost across all 8 years?',
            given: { price4: 26500 }, expr: 'price4 - #t1-p2', format: 'usd', answer: '$19,931.29',
            reasoning: '$26,500 against $6,568.71. The extra five years add only about $9,100 more of depreciation than the first three did.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now add the running costs and find the cost per year of each holding period.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do running costs come to across the first 3 years, at $2,960 a year?',
            given: { early: 2960 }, expr: 'early * 3', format: 'usd', answer: '$8,880.00',
            reasoning: 'Three years at the lower early-ownership rate.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do running costs come to across the full 8 years, at $2,960 for the first 5 and $4,310 for the last 3?',
            given: { early2: 2960, late: 4310 }, expr: 'early2 * 5 + late * 3', format: 'usd', answer: '$27,730.00',
            reasoning: '$14,800 across the first five years and $12,930 across the last three — the later years cost nearly as much as the earlier five.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the cost per year of ownership if Yolanda sells at 3 years?',
            given: {}, expr: 'round((#t1-p3 + #t2-p1) / 3, 2)', format: 'usd', answer: '$6,557.78',
            reasoning: '$10,793.34 of depreciation plus $8,880.00 of running costs, spread over 3 years.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the cost per year of ownership if she sells at 8 years?',
            given: {}, expr: 'round((#t1-p4 + #t2-p2) / 8, 2)', format: 'usd', answer: '$5,957.66',
            reasoning: '$19,931.29 of depreciation plus $27,730.00 of running costs, spread over 8 years.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much does holding for 8 years rather than 3 save per year of ownership?',
            given: {}, expr: '#t2-p3 - #t2-p4', format: 'usd', answer: '$600.12',
            reasoning: '$6,557.78 against $5,957.66 — the front-loaded depreciation is spread thinner, and that gain survives the rising repair bills, but only just.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer each in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Two forces pull in opposite directions as a vehicle is held longer. Name both, say which one is winning at eight years and by how much, and describe what would have to happen for the answer to flip.',
            acceptableAnswerCriteria: [
              'Names depreciation per year falling as the holding period lengthens, and running costs per year rising as the vehicle ages, as the two opposing forces.',
              'States that at eight years the depreciation effect still wins, by $600.12 a year, and identifies that as a narrow margin.',
              'Describes a flip condition in figures — repairs rising further, or an unreliable year adding a large one-off cost — rather than as a general possibility.',
            ],
            evidenceRequirements: [
              'Cites the two cost-per-year figures, $6,557.78 and $5,957.66, and at least one of the running-cost totals behind them.',
            ],
            dimensions: ['tradeoff-defense', 'reasoning-from-figures', 'plan-coherence'],
            lookFors: [
              'The response names both forces and attaches each to the right figure.',
              'The response treats $600.12 a year as a narrow margin rather than as a decisive result.',
              'A response observing that the running-cost step from $2,960 to $4,310 is itself an assumption is going beyond the question well.',
            ],
            commonMisconception: 'Assuming that keeping a vehicle longer always lowers the cost of owning it.',
          },
          {
            ref: 't3-p2', kind: 'judgment', length: 'short',
            text: 'Yolanda says she will decide by the vehicle’s condition rather than by the cost per year. Say what the cost-per-year figures are still useful for in that case, and what they cannot tell her.',
            acceptableAnswerCriteria: [
              'Explains that the figures set the price of the choice — around $600.12 a year — so she can judge whether the condition problem is worth that much to avoid.',
              'States what the figures cannot supply, such as the chance of a breakdown, the value of reliability for her, or a repair large enough to break the $2,960 and $4,310 assumptions.',
            ],
            evidenceRequirements: [
              'Refers to the $600.12 annual difference when describing what the figures do supply.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the figures as pricing a decision rather than as making it.',
              'What the figures cannot say is stated specifically, not as a general limit of arithmetic.',
            ],
          },
        ],
      },
    ],
    remediation: 'If the eight-year cost per year comes out near $5,451.41, the running costs are being held at $2,960 for all eight years. The scenario raises them to $4,310 from year 6, so the eight-year running total is $27,730.00 and not $23,680. Split the running-cost line into two blocks — five years at the lower rate and three at the higher — before adding the depreciation.',
    extension: 'Find the holding period at which the cost per year is lowest, and say what feature of the running-cost schedule makes that year rather than the last one the answer.',
  },

  {
    lessonId: 'ma-g11-financial-literacy-u02-l10',
    grade: 11, unit: 2, day: 10,
    actor: 'Solveig Adeniran-Petrov, a fictional buyer building a full purchase analysis',
    objective: 'Produce a complete fictional major-purchase analysis carrying financing cost, running costs, and resale to a true monthly cost, and defend a recommendation against the figure the advertisement invites.',
    scenario: 'Solveig Adeniran-Petrov is a fictional buyer analysing a simulated vehicle purchase. All prices, payments, running costs, and resale figures below are invented for this performance task.',
    materials: ['calculator', 'the fictional purchase terms in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The vehicle costs $21,750. Solveig would pay $3,500 down and finance the rest with 60 monthly payments of $342.60.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much is financed after the deposit?',
            given: { price: 21750, down: 3500 }, expr: 'price - down', format: 'usd', answer: '$18,250.00',
            reasoning: 'The $21,750 price less the $3,500 paid at the start.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total of the 60 payments?',
            given: { payment: 342.6 }, expr: 'round(payment * 60, 2)', format: 'usd', answer: '$20,556.00',
            reasoning: '60 payments of $342.60, which is what the loan actually costs to repay before any running cost is counted.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the finance charge on the loan?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$2,306.00',
            reasoning: '$20,556.00 repaid against $18,250.00 borrowed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Running costs are $1,420 a year for insurance, $760 a year for maintenance, and $1,690 a year for fuel. Solveig plans to keep the vehicle 5 years, over which it loses 15% of its value a year from the $21,750 price.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What do the running costs come to in one year?',
            given: { insurance: 1420, maintenance: 760, fuel: 1690 }, expr: 'insurance + maintenance + fuel', format: 'usd', answer: '$3,870.00',
            reasoning: 'Insurance, maintenance, and fuel added — none of which appears in the financing terms.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What do they come to across the 5 years?',
            given: {}, expr: '#t2-p1 * 5', format: 'usd', answer: '$19,350.00',
            reasoning: 'Five years at $3,870.00, held flat across the holding period.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What is the vehicle worth after 5 years, losing 15% of its value a year?',
            given: { price2: 21750, depreciation: 0.15 }, expr: 'round(price2 * pow(1 - depreciation, 5), 2)', format: 'usd', answer: '$9,650.59',
            reasoning: 'Five years of declining-balance depreciation on $21,750 — the amount Solveig expects to recover at the end.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the total cost of owning the vehicle for 5 years, counting the deposit, all the payments, and the running costs, less the resale value?',
            given: { down2: 3500 }, expr: 'down2 + #t1-p2 + #t2-p2 - #t2-p3', format: 'usd', answer: '$33,755.41',
            reasoning: '$3,500 down, $20,556.00 of payments, and $19,350.00 of running costs, less the $9,650.59 recovered on resale.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'What does that come to per month across the 60 months?',
            given: {}, expr: 'round(#t2-p4 / 60, 2)', format: 'usd', answer: '$562.59',
            reasoning: '$33,755.41 across the 60 months of the holding period — the honest monthly figure for this purchase.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'independent',
        directions: 'Set the true monthly cost against the figure the advertisement leads with, and against Solveig’s $3,180 monthly take-home pay.',
        items: [
          {
            ref: 't3-p1', kind: 'numeric', unit: 'USD',
            text: 'How much larger is the true monthly cost than the $342.60 payment?',
            given: { payment2: 342.6 }, expr: 'round(#t2-p5 - payment2, 2)', format: 'usd', answer: '$219.99',
            reasoning: '$562.59 against $342.60 — the advertised payment covers well under two-thirds of what the vehicle actually costs each month.',
          },
          {
            ref: 't3-p2', kind: 'numeric', unit: 'percent',
            text: 'What share of the $3,180 monthly take-home does the true cost take? Give one decimal place.',
            given: { takeHome: 3180 }, expr: 'round(#t2-p5 / takeHome * 100, 1)', format: 'percent1', answer: '17.7%',
            reasoning: '$562.59 against $3,180 of take-home pay.',
          },
          {
            ref: 't3-p3', kind: 'choice',
            text: 'Which single change would reduce the true monthly cost the most?',
            choices: [
              'Negotiating $500 off the purchase price',
              'Keeping the vehicle 8 years instead of 5',
              'Paying $500 more as a deposit',
            ],
            given: {},
            answer: 'Keeping the vehicle 8 years instead of 5',
            reasoning: 'A larger deposit only moves money between the deposit line and the payments, and $500 off the price is a one-off saving spread over 60 months; extending the holding period spreads a cost of over $33,000 across 36 more months, which no adjustment of this size can match.',
          },
        ],
      },
      {
        taskId: 't4', kind: 'reflection',
        directions: 'Write your recommendation. Answer both.',
        items: [
          {
            ref: 't4-p1', kind: 'judgment', length: 'extended',
            text: 'Recommend for or against this purchase for Solveig. State the monthly figure you are relying on, name the assumptions the analysis rests on, and identify the one figure whose failure would most damage the conclusion.',
            acceptableAnswerCriteria: [
              'States a recommendation and relies on the $562.59 true monthly cost rather than the $342.60 payment, or explains why a different figure is the right one for the decision.',
              'Names at least two load-bearing assumptions, such as the 15% depreciation holding, the running costs staying flat for five years, or the five-year holding period being kept to.',
              'Identifies the most damaging failure and says why — most defensibly the $9,650.59 resale value, since it is the only figure recovered at the end and it rests entirely on the depreciation assumption.',
            ],
            evidenceRequirements: [
              'Cites the $33,755.41 five-year total and the 17.7% share of take-home pay.',
              'Refers to the $219.99 gap between the true monthly cost and the advertised payment.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The recommendation is decided and the figure behind it is named.',
              'The assumptions listed appear in the analysis rather than being general cautions.',
              'Either recommendation is acceptable; what is scored is whether financing, running costs, and resale are all carried through the reasoning.',
            ],
            commonMisconception: 'Judging affordability against the payment a lender quotes rather than against the cost of the commitment.',
          },
          {
            ref: 't4-p2', kind: 'judgment', length: 'short',
            text: 'The resale value is the only figure in this analysis that reduces the cost. Explain what makes it different in kind from the others, and say what the true monthly cost would be if the vehicle turned out to be worth nothing at the end.',
            acceptableAnswerCriteria: [
              'Explains that every other figure is a known price or a quoted term, while the resale value is a forecast that will not be tested until year five.',
              'Computes the alternative correctly, giving a true monthly cost of about $723.43 if the resale value were zero, and notes that this is more than double the advertised payment.',
            ],
            evidenceRequirements: [
              'Uses the $9,650.59 resale figure and the $33,755.41 total when explaining the effect of its failure.',
            ],
            dimensions: ['assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response distinguishes a quoted figure from a projected one.',
              'The recomputation is attempted with figures rather than described qualitatively.',
            ],
            commonMisconception: 'Treating an expected resale value as a certainty because it appears in the same table as the contracted payments.',
          },
        ],
      },
    ],
    remediation: 'If the five-year total comes out near $43,406.00, the resale value is not being subtracted, and if it comes out near $30,255.41 the $3,500 deposit has been left out of the money-out lines. The purchase has three money-out lines — the $3,500 deposit, the $20,556.00 of payments, and the $19,350.00 of running costs — and exactly one money-back line, the $9,650.59 resale. Build those four rows with signs before dividing by 60.',
    extension: 'Recompute the true monthly cost over an 8-year holding period, assuming running costs rise to $4,900 a year from year 6, and say whether the change you recommended in the ranking task holds up.',
  },
]
