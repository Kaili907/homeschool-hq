const REVISION = 'FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1'

const PROTECTED_PROFILES = new Set(['DIAGNOSTIC', 'MASTERY', 'ASSESSMENT'])
const MODEL_EXEMPT_PROFILES = new Set([
  'DIAGNOSTIC',
  'APPLICATION_TRANSFER',
  'MASTERY',
  'ASSESSMENT',
])

const PROFILE_BY_PHASE = [
  [/launch and diagnostic/i, 'DIAGNOSTIC'],
  [/unit assessment/i, 'ASSESSMENT'],
  [/mastery check/i, 'MASTERY'],
  [/correction|reteach|error and misconception/i, 'REMEDIATION'],
  [/synthesis and review/i, 'REVIEW'],
  [/concept model|explicit model/i, 'CONCEPT_INSTRUCTION'],
  [/guided practice/i, 'GUIDED_APPLICATION'],
  [/independent application|investigation|transfer to a new case/i, 'APPLICATION_TRANSFER'],
  [/performance task|applied simulation|unit performance task|defense and extension|application or project/i, 'PROJECT'],
  [/comparison and analysis/i, 'DECISION_SCENARIO'],
]

const FAMILIES = {
  MONEY_CONCEPT: {
    label: 'money choices and opportunity cost',
    concepts: [
      'Money is limited, so choosing one use can mean giving up another use.',
      'Needs, wants, goals, and constraints help explain why a choice fits a situation.',
      'A sound choice uses the fictional facts without judging a person or family.',
    ],
    confusion: 'Calling an option a want does not make it bad; the category depends on the stated goal and circumstances.',
    process: ['Name the fictional goal.', 'Separate needs, wants, and constraints.', 'Compare the cost and the opportunity cost.', 'Choose conditionally and support the choice with a scenario fact.'],
    example: {
      facts: ['Imani has an invented $18.00 activity allowance.', 'A required art-board replacement costs $12.00.', 'An optional puzzle book costs $7.00.'],
      goal: 'Keep the art project usable and decide what the remaining pretend money can cover.',
      steps: ['Represent $18.00 as 1,800 cents and $12.00 as 1,200 cents.', 'Subtract: 1,800 − 1,200 = 600 cents, or $6.00.', 'The $7.00 puzzle book costs 700 cents, which is 100 cents more than the $6.00 remaining.', 'Choose the board for the stated goal and delay the puzzle book; the opportunity cost is using $12.00 that cannot be used for another option.'],
      interpretation: 'The choice follows the stated project constraint, not a claim that one kind of spending is always right.',
      tradeoff: 'If the board were already usable, the constraint would change and the puzzle book could be reasonable.',
    },
    alternate: {
      facts: ['Leo has an invented 1,500-cent limit.', 'A bus pass for the fictional event is 900 cents.', 'A souvenir is 800 cents.'],
      steps: ['Mark the bus pass as a constraint because it is required to reach the event.', 'Compute 1,500 − 900 = 600 cents.', 'Compare 600 cents remaining with the 800-cent souvenir; the gap is 200 cents.', 'Delay the souvenir and explain that the decision would change if transportation were already provided.'],
    },
  },
  EARNING_INCOME: {
    label: 'earning, pay, and take-home income',
    concepts: [
      'Gross pay is earned before stated deductions; take-home pay is what remains after them.',
      'Hours, rate, benefits, reliability, and working conditions can all matter in a work choice.',
      'An estimate is only as reliable as its stated hours, rate, and deduction assumptions.',
    ],
    confusion: 'A larger gross-pay number does not automatically mean the larger usable amount or the better overall option.',
    process: ['Identify the pay basis and time period.', 'Compute gross pay in cents.', 'Apply only the stated fictional deductions or benefits.', 'Interpret take-home pay and compare non-pay tradeoffs.'],
    example: {
      facts: ['Rae works an invented 6 hours at $9.00 per hour.', 'A simplified instructional deduction is 5.00% of gross pay.', 'No other deductions or benefits apply.'],
      goal: 'Find gross and take-home pay under the stated fictional rule.',
      steps: ['Convert the hourly rate to 900 cents.', 'Gross pay: 6 × 900 = 5,400 cents, or $54.00.', 'Represent 5.00% as 500 basis points. Deduction: 5,400 × 500 ÷ 10,000 = 270 cents, or $2.70.', 'Take-home pay: 5,400 − 270 = 5,130 cents, or $51.30.'],
      interpretation: 'Rae earned $54.00 gross and receives $51.30 after the one stated deduction.',
      tradeoff: 'A different schedule or benefit could change which fictional job better fits Rae’s goal.',
    },
    alternate: {
      facts: ['Sol works 4 invented hours at $8.00 per hour.', 'A flat $2.00 training-material deduction is stated.'],
      steps: ['Gross pay: 4 × 800 = 3,200 cents.', 'Deduction: 200 cents.', 'Take-home pay: 3,200 − 200 = 3,000 cents, or $30.00.', 'Check: 3,000 + 200 = 3,200 cents.'],
    },
  },
  SPENDING: {
    label: 'spending and total purchase cost',
    concepts: [
      'A price comparison must use the total relevant cost, not only the largest printed number.',
      'Quantity, quality, fees, timing, and fitness for the stated purpose can change the decision.',
      'A purchase is affordable in a scenario only when it fits the stated limit and other constraints.',
    ],
    confusion: 'The lowest sticker price is not always the lowest unit cost or the option that best fits the goal.',
    process: ['Name the goal and required quantity.', 'Put comparable costs in the same unit.', 'Add stated fees or taxes in the declared order.', 'Compare price and non-price tradeoffs.'],
    example: {
      facts: ['A fictional 4-pack costs $6.00.', 'A fictional 6-pack costs $8.40.', 'There are no taxes or fees in this simplified comparison.'],
      goal: 'Compare exact unit prices and choose for a need of six items.',
      steps: ['4-pack unit price: 600 cents ÷ 4 = 150 cents, or $1.50 each.', '6-pack unit price: 840 cents ÷ 6 = 140 cents, or $1.40 each.', 'For six items, two 4-packs would cost 1,200 cents; one 6-pack costs 840 cents.', 'Choose the 6-pack if all six items will be used; it meets the quantity goal for 360 cents less.'],
      interpretation: 'The unit price and required quantity both support the decision.',
      tradeoff: 'If only four items were usable before expiring, the lower unit price might not produce better value.',
    },
    alternate: {
      facts: ['A pretend item costs $12.00.', 'A stated delivery fee is $2.50.', 'The spending limit is $15.00.'],
      steps: ['Convert to cents: 1,200 + 250.', 'Total cost: 1,450 cents, or $14.50.', 'Compare $14.50 with the $15.00 limit; 50 cents remains.', 'The option fits the limit, but reliability and timing still matter.'],
    },
  },
  BUDGETING: {
    label: 'budgeting and cash-flow planning',
    concepts: [
      'A budget is a plan that assigns limited inflow to goals and obligations.',
      'Cash flow tracks when money enters and leaves; a positive total does not solve a timing mismatch.',
      'A useful revision changes a category or timing assumption and names what is sacrificed.',
    ],
    confusion: 'A budget that adds correctly can still fail if required costs are omitted or due before income arrives.',
    process: ['List the fictional inflow for one period.', 'Classify required, goal, and flexible outflows.', 'Subtract all outflows in cents.', 'Revise one category and explain the tradeoff.'],
    example: {
      facts: ['Morgan has an invented $65.00 weekly inflow.', 'Required costs are $28.00, a saving goal is $15.00, and flexible spending is $17.00.'],
      goal: 'Check the plan and interpret the remaining amount.',
      steps: ['Convert to cents: inflow 6,500; outflows 2,800, 1,500, and 1,700.', 'Total outflows: 2,800 + 1,500 + 1,700 = 6,000 cents.', 'Remaining: 6,500 − 6,000 = 500 cents, or $5.00.', 'Check: $28.00 + $15.00 + $17.00 + $5.00 = $65.00.'],
      interpretation: 'The plan balances and leaves a $5.00 cushion under these invented assumptions.',
      tradeoff: 'Increasing saving by $4.00 would leave only a $1.00 cushion unless another category changed.',
    },
    alternate: {
      facts: ['A fictional plan has $48.00 inflow and outflows of $21.00, $14.00, and $16.00.'],
      steps: ['Total outflows: 2,100 + 1,400 + 1,600 = 5,100 cents.', 'Gap: 5,100 − 4,800 = 300 cents.', 'Reduce a flexible category by 300 cents.', 'Check that revised outflows equal the 4,800-cent inflow and name the lost benefit.'],
    },
  },
  SAVING: {
    label: 'saving goals, time, and reserves',
    concepts: [
      'A saving plan connects a target, current amount, regular contribution, and time.',
      'Liquidity and reliability matter when money must be available for a near-term goal or emergency.',
      'Changing the contribution or deadline changes the plan’s feasibility and opportunity cost.',
    ],
    confusion: 'Naming a goal is not yet a plan; the gap, contribution, and time must work together.',
    process: ['State the fictional target and amount already saved.', 'Find the remaining gap in cents.', 'Relate the gap to regular contributions and time.', 'Check whether the timing and access fit the goal.'],
    example: {
      facts: ['Noah’s invented goal is $24.00.', 'Noah already has $6.00 and can save $3.00 per week.', 'No interest applies in this simplified model.'],
      goal: 'Find the number of complete weekly contributions needed.',
      steps: ['Gap: 2,400 − 600 = 1,800 cents.', 'Weekly contribution: 300 cents.', 'Time: 1,800 ÷ 300 = 6 weeks.', 'Check: 600 + (6 × 300) = 2,400 cents.'],
      interpretation: 'The plan reaches the exact target after six complete weekly contributions.',
      tradeoff: 'Saving faster would require a larger contribution and leave less pretend money for current uses.',
    },
    alternate: {
      facts: ['A fictional goal is 3,000 cents, with 900 cents saved and 350 cents added weekly.'],
      steps: ['Gap: 3,000 − 900 = 2,100 cents.', 'Six weeks adds 6 × 350 = 2,100 cents.', 'Total: 900 + 2,100 = 3,000 cents.', 'State which current use gives up the 350 cents each week.'],
    },
  },
  BANKING: {
    label: 'banking records, access, fees, and safety',
    concepts: [
      'An account record changes through deposits, withdrawals, purchases, interest, and fees in time order.',
      'Balance, available funds, access, fees, and protection describe different features.',
      'Secure banking behavior protects credentials and verifies information through trusted channels.',
    ],
    confusion: 'A displayed balance is not evidence that every pending transaction or fee has already posted.',
    process: ['Start with the stated fictional balance in cents.', 'Apply each posted item in time order.', 'Separate pending items and fees.', 'Check the ending record and evaluate access and safety.'],
    example: {
      facts: ['Fictional opening balance: $40.00.', 'Posted deposit: $12.50.', 'Posted purchase: $9.00.', 'Posted fee: $2.50.'],
      goal: 'Reconcile the posted balance.',
      steps: ['Convert to cents: 4,000 + 1,250 − 900 − 250.', 'After deposit: 5,250 cents.', 'After purchase and fee: 5,250 − 900 − 250 = 4,100 cents.', 'Check by net change: +1,250 − 900 − 250 = +100; 4,000 + 100 = 4,100 cents.'],
      interpretation: 'The fictional posted balance is $41.00.',
      tradeoff: 'A lower-fee account may have different access or service features that must also be compared.',
    },
    alternate: {
      facts: ['An invented record starts at 2,500 cents, adds 800 cents, and posts a 1,100-cent purchase.'],
      steps: ['Apply the deposit: 2,500 + 800 = 3,300 cents.', 'Apply the purchase: 3,300 − 1,100 = 2,200 cents.', 'Reverse-check: 2,200 + 1,100 − 800 = 2,500 cents.', 'Keep any pending item separate until the scenario says it posts.'],
    },
  },
  CREDIT_BORROWING: {
    label: 'credit, borrowing cost, and repayment',
    concepts: [
      'Principal is the unpaid amount borrowed; interest and fees are borrowing costs.',
      'A payment may cover interest or fees before the rest reduces principal.',
      'Payment size, rate, timing, term, and new charges can change total cost and cash available now.',
    ],
    confusion: 'Subtracting the whole payment from principal can overstate balance reduction when interest is due.',
    process: ['Identify principal, rate meaning, and period.', 'Compute the stated borrowing cost with exact cents and basis points.', 'Apply the payment in the declared order.', 'Interpret the balance effect and current-cash tradeoff.'],
    example: {
      facts: ['Fictional starting balance: $600.00.', 'Invented monthly periodic rate: 1.00%.', 'Payment: $30.00.', 'No new charges or fees; interest posts first; round interest once to cents, half up.'],
      goal: 'Find interest, principal reduction, and ending balance for one period.',
      steps: ['Represent $600.00 as 60,000 cents and 1.00% as 100 basis points.', 'Interest: 60,000 × 100 ÷ 10,000 = 600 cents, or $6.00.', 'Principal reduction: 3,000 − 600 = 2,400 cents, or $24.00.', 'Ending balance: 60,000 − 2,400 = 57,600 cents, or $576.00. Check: $6.00 + $24.00 = $30.00.'],
      interpretation: 'Only $24.00 of the payment reduces principal under the stated rule.',
      tradeoff: 'A larger payment would reduce more principal but leave less cash available now.',
    },
    alternate: {
      facts: ['$400.00 fictional balance, 1.50% invented monthly rate, $25.00 payment, no fees, interest first.'],
      steps: ['Interest: 40,000 × 150 ÷ 10,000 = 600 cents.', 'Principal reduction: 2,500 − 600 = 1,900 cents.', 'Ending balance: 40,000 − 1,900 = 38,100 cents.', 'Check: 600 + 1,900 = 2,500 cents.'],
    },
  },
  INTEREST: {
    label: 'interest, rates, and time',
    concepts: [
      'Interest is an amount paid or earned for the use of money under stated terms.',
      'The rate meaning, time period, balance, compounding rule, and timing must be known before calculating.',
      'A projected return is conditional on its assumptions and is not a guarantee.',
    ],
    confusion: 'A percentage is incomplete without its period and base; 2% per month is not the same as 2% per year.',
    process: ['Identify principal, rate, rate period, and time.', 'Represent money in cents and the rate in basis points.', 'Apply the stated simple or compound rule.', 'Round only where stated and interpret the limitation.'],
    example: {
      facts: ['Fictional principal: $500.00.', 'Invented simple annual rate: 2.00%.', 'Time: one year.', 'Round once to cents, half up; no deposits or withdrawals.'],
      goal: 'Find one year of simple interest and the ending amount.',
      steps: ['Represent principal as 50,000 cents and 2.00% as 200 basis points.', 'Interest: 50,000 × 200 ÷ 10,000 = 1,000 cents, or $10.00.', 'Ending amount: 50,000 + 1,000 = 51,000 cents, or $510.00.', 'Check: 2% of $500 is $10, so the result has a reasonable scale.'],
      interpretation: 'The fictional account earns $10.00 under this one-year simple-interest rule.',
      tradeoff: 'Fees, a different rate, or earlier withdrawal could change the result.',
    },
    alternate: {
      facts: ['$240.00 fictional principal, 1.50% simple annual rate, one year, no fees.'],
      steps: ['Convert: 24,000 cents and 150 basis points.', 'Interest: 24,000 × 150 ÷ 10,000 = 360 cents.', 'Ending amount: 24,000 + 360 = 24,360 cents.', 'Check the rate period and do not project the return as guaranteed.'],
    },
  },
  TAX: {
    label: 'tax purpose, taxable bases, and stated tax rules',
    concepts: [
      'Taxes fund public purposes and use rules that define a base, rate, timing, and responsibility.',
      'A simplified tax calculation applies only to the fictional jurisdiction, year, and assumptions stated.',
      'Withholding is a prepayment estimate; it is not automatically the final tax owed.',
    ],
    confusion: 'A marginal rate applied to one bracket is not automatically the effective rate on all taxable income.',
    process: ['Identify the fictional tax base and included items.', 'Apply only the stated rate or brackets in order.', 'Account for stated credits or withholding after tax is computed.', 'Round at the declared point and label the result.'],
    example: {
      facts: ['Invented taxable base: $300.00.', 'Simplified flat instructional tax rate: 5.00%.', 'No deductions, credits, or withholding; round once to cents, half up.'],
      goal: 'Compute the tax under this fictional flat-rate rule.',
      steps: ['Represent $300.00 as 30,000 cents and 5.00% as 500 basis points.', 'Tax: 30,000 × 500 ÷ 10,000 = 1,500 cents, or $15.00.', 'Amount after this tax: 30,000 − 1,500 = 28,500 cents, or $285.00.', 'Check: $15 is one twentieth of $300, which matches 5%.'],
      interpretation: 'The $15.00 result belongs only to the stated simplified instructional model.',
      tradeoff: 'Changing the taxable base, jurisdiction, year, bracket rule, credit, or withholding changes the result.',
    },
    alternate: {
      facts: ['Fictional taxable sale: 8,000 cents; invented sales-tax rate: 4.00%; tax is rounded once to cents.'],
      steps: ['Represent 4.00% as 400 basis points.', 'Tax: 8,000 × 400 ÷ 10,000 = 320 cents.', 'Total: 8,000 + 320 = 8,320 cents.', 'Label this as an invented instructional rate, not current tax advice.'],
    },
  },
  ENTREPRENEURSHIP: {
    label: 'entrepreneurship, revenue, cost, and ethical operation',
    concepts: [
      'Revenue is money received from sales; profit is revenue minus all stated costs.',
      'Price decisions must consider customer value, costs, demand uncertainty, and honest communication.',
      'A positive calculation does not guarantee future profit or remove business risk.',
    ],
    confusion: 'Revenue and profit are not the same because revenue has not yet removed costs.',
    process: ['Identify quantity, price, and all stated costs.', 'Compute revenue and total cost in cents.', 'Subtract cost from revenue and interpret the sign.', 'Evaluate the price and communication tradeoffs.'],
    example: {
      facts: ['A fictional stand sells 20 items at $3.50 each.', 'Materials cost $38.00 and the table fee is $8.00.', 'No tax applies in this simplified model.'],
      goal: 'Find revenue, total cost, and profit.',
      steps: ['Revenue: 20 × 350 = 7,000 cents, or $70.00.', 'Total cost: 3,800 + 800 = 4,600 cents, or $46.00.', 'Profit: 7,000 − 4,600 = 2,400 cents, or $24.00.', 'Check: $46.00 cost + $24.00 profit = $70.00 revenue.'],
      interpretation: 'The fictional stand earns a $24.00 profit under the stated sales assumption.',
      tradeoff: 'A lower price might attract more buyers but earns less per item; unsold items could also change the result.',
    },
    alternate: {
      facts: ['A pretend service earns 4 payments of 900 cents and has 2,200 cents of stated costs.'],
      steps: ['Revenue: 4 × 900 = 3,600 cents.', 'Cost: 2,200 cents.', 'Profit: 3,600 − 2,200 = 1,400 cents.', 'Explain one uncertainty that could make actual results differ.'],
    },
  },
  INVESTING: {
    label: 'investing, risk, return, fees, and time horizon',
    concepts: [
      'Expected return describes uncertainty; it is not a promised result.',
      'Risk, diversification, fees, liquidity, and time horizon must be considered together.',
      'A comparison should use the same time period and include stated fees and losses as well as gains.',
    ],
    confusion: 'A higher possible return does not make an option automatically better for every goal or time horizon.',
    process: ['State the fictional goal and time horizon.', 'Compare possible outcomes and fees on the same basis.', 'Identify concentration, liquidity, and loss risk.', 'Make a conditional choice and name what could change it.'],
    example: {
      facts: ['A fictional $200.00 investment gains 4.00% in one year before a $3.00 fee.', 'The rate is an invented scenario outcome, not a forecast.', 'Round the gain once to cents, half up.'],
      goal: 'Find the net one-year change and interpret its limits.',
      steps: ['Represent $200.00 as 20,000 cents and 4.00% as 400 basis points.', 'Gross gain: 20,000 × 400 ÷ 10,000 = 800 cents.', 'Net gain after the 300-cent fee: 800 − 300 = 500 cents, or $5.00.', 'Ending amount: 20,000 + 500 = 20,500 cents, or $205.00.'],
      interpretation: 'The fee reduces the fictional 4.00% gross gain to a $5.00 net gain.',
      tradeoff: 'The investment could lose value, and a near-term goal may require more liquidity and less volatility.',
    },
    alternate: {
      facts: ['A fictional fund starts at 30,000 cents, has a stated 3.00% scenario gain, and charges a 200-cent fee.'],
      steps: ['Gain: 30,000 × 300 ÷ 10,000 = 900 cents.', 'Net gain: 900 − 200 = 700 cents.', 'Ending amount: 30,700 cents.', 'State that this scenario result is not guaranteed and compare the goal’s time horizon.'],
    },
  },
  INSURANCE_RISK: {
    label: 'risk management and insurance tradeoffs',
    concepts: [
      'Insurance transfers some defined financial risk in exchange for a premium and stated conditions.',
      'A deductible is the amount the fictional insured pays before covered amounts are calculated under the simplified rule.',
      'Coverage, exclusions, limits, likelihood, severity, and retained risk all affect a decision.',
    ],
    confusion: 'Having insurance does not mean every loss is covered or that the insured pays nothing.',
    process: ['Identify the covered event and exclusions.', 'Separate premium, deductible, limit, and retained loss.', 'Compute only under the stated simplified rule.', 'Compare protection with cost and remaining risk.'],
    example: {
      facts: ['A fictional covered loss is $4,000.00.', 'The simplified policy has a $750.00 deductible and a limit above the loss.', 'No coinsurance or exclusions apply in this invented model.'],
      goal: 'Find the amount remaining after the deductible under the stated rule.',
      steps: ['Convert to cents: loss 400,000; deductible 75,000.', 'Covered amount after deductible: 400,000 − 75,000 = 325,000 cents.', 'That is $3,250.00 under the simplified assumptions.', 'Check: $750.00 retained deductible + $3,250.00 covered amount = $4,000.00 loss.'],
      interpretation: 'The fictional insured still retains the deductible and any excluded or over-limit loss.',
      tradeoff: 'A lower deductible can raise the premium; the better fit depends on the stated risk and cash constraint.',
    },
    alternate: {
      facts: ['A fictional covered loss is 180,000 cents with a 50,000-cent deductible and no other sharing.'],
      steps: ['Subtract the deductible: 180,000 − 50,000 = 130,000 cents.', 'Convert: $1,300.00 remains after the deductible.', 'Check: 50,000 + 130,000 = 180,000 cents.', 'Then inspect limits and exclusions before calling the whole amount covered.'],
    },
  },
  CONSUMER_PROTECTION: {
    label: 'consumer protection, contracts, privacy, and fraud',
    concepts: [
      'A safe consumer decision verifies the seller, total obligation, cancellation terms, privacy request, and remedy.',
      'Urgency, secrecy, guaranteed outcomes, and credential requests are warning signs rather than proof of value.',
      'A contract decision includes recurring costs and exit conditions, not only the first payment.',
    ],
    confusion: 'A professional-looking message or low introductory price does not verify identity, terms, or safety.',
    process: ['Pause and identify the claim.', 'Verify through an independent trusted channel.', 'Read total cost, renewal, cancellation, and data terms.', 'Reject credential requests and document a safe next step.'],
    example: {
      facts: ['A fictional message promises a guaranteed prize.', 'It demands a password within ten minutes.', 'The organization’s known website lists a different contact method.'],
      goal: 'Decide how the fictional recipient should respond.',
      steps: ['Goal: protect information while verifying whether the claim is real.', 'Constraint: a password must never be shared; urgency is a warning sign.', 'Compare options: replying follows the unverified message, while using the known website creates an independent check.', 'Do not reply or click; preserve the message and verify through the known channel with a trusted adult.'],
      interpretation: 'The decision follows the verification and credential rules, not a guess about the sender’s appearance.',
      tradeoff: 'Pausing may delay a legitimate message, but it prevents an irreversible credential disclosure.',
    },
    alternate: {
      facts: ['A fictional subscription advertises $1.00 today, renews at $12.00 monthly, and requires cancellation three days before renewal.'],
      steps: ['Separate the introductory price from the recurring obligation.', 'Compute a three-month stated total: 100 + 1,200 + 1,200 = 2,500 cents.', 'Record the cancellation deadline before deciding.', 'Choose only if the total and exit terms fit the fictional goal.'],
    },
  },
  EDUCATION_CAREER_FINANCE: {
    label: 'education, career, cost, and uncertain outcomes',
    concepts: [
      'Education and career choices combine direct cost, time, funding, work conditions, and uncertain earnings.',
      'An estimate or average does not guarantee one person’s outcome.',
      'A sound comparison uses the same time horizon and states assumptions and opportunity costs.',
    ],
    confusion: 'The option with the highest stated earnings is not automatically best after cost, time, risk, and fit are considered.',
    process: ['Name the fictional goal and time horizon.', 'Compare direct and recurring costs on the same basis.', 'Include time, funding terms, and uncertain outcomes.', 'Defend a conditional choice and test one changed assumption.'],
    example: {
      facts: ['Program A has an invented $1,200.00 cost and takes six months.', 'Program B costs $600.00 and takes three months.', 'Both meet the fictional job requirement; earnings after completion are unknown.'],
      goal: 'Choose for a fictional learner whose constraint is completing within four months.',
      steps: ['State the decisive constraint: completion within four months.', 'Program A fails that constraint at six months; Program B meets it at three months.', 'Cost difference: 120,000 − 60,000 = 60,000 cents, or $600.00.', 'Choose Program B under these facts, while noting that quality, funding terms, or verified outcomes could change the choice.'],
      interpretation: 'The choice is conditional on the time constraint and equal qualification assumption.',
      tradeoff: 'A longer program could be reasonable if it produced a verified benefit worth the extra time and cost.',
    },
    alternate: {
      facts: ['Two fictional courses both qualify a learner; one costs 45,000 cents and takes eight weeks, the other costs 30,000 cents and takes twelve weeks.'],
      steps: ['Compare the 15,000-cent cost difference.', 'Compare the four-week time difference.', 'Choose based on the stated fictional priority rather than price alone.', 'Name a changed funding or schedule fact that could reverse the choice.'],
    },
  },
  INTEGRATED_FINANCIAL_PLAN: {
    label: 'integrated financial planning and stress testing',
    concepts: [
      'An integrated plan must make income, obligations, saving, protection, taxes, and goals work together.',
      'A plan is conditional on its assumptions and should be tested against a realistic fictional shock.',
      'Closing one gap usually uses cash or capacity that cannot serve another goal at the same time.',
    ],
    confusion: 'A plan that balances in the expected case is not automatically resilient to timing changes or shocks.',
    process: ['Reconcile the expected fictional plan.', 'Identify assumptions and the weakest constraint.', 'Apply one stated shock in cents and recompute.', 'Revise the plan and defend the sacrifice and remaining risk.'],
    example: {
      facts: ['A fictional monthly plan has $2,400.00 inflow, $1,850.00 obligations, and $350.00 goal transfers.', 'A one-time $300.00 shock occurs this month.'],
      goal: 'Stress-test the month and choose a transparent revision.',
      steps: ['Expected remainder: 240,000 − 185,000 − 35,000 = 20,000 cents, or $200.00.', 'Shock gap: 30,000 − 20,000 = 10,000 cents, or $100.00.', 'A complete revision must identify 10,000 cents from a flexible category, reserve, or delayed goal.', 'Choose a stated source, recompute the plan to zero or above, and name the goal or flexibility sacrificed.'],
      interpretation: 'The stress test reveals a $100.00 gap that the expected-case plan did not show.',
      tradeoff: 'Using a reserve preserves current obligations but leaves less protection for a later shock.',
    },
    alternate: {
      facts: ['A pretend plan has 180,000 cents inflow, 145,000 cents obligations, 20,000 cents saving, and a 25,000-cent shock.'],
      steps: ['Expected remainder: 180,000 − 145,000 − 20,000 = 15,000 cents.', 'Shock gap: 25,000 − 15,000 = 10,000 cents.', 'Choose and label a 10,000-cent revision.', 'State the sacrificed benefit and one risk still not covered.'],
    },
  },
}

function classifyProfile(phase = '') {
  return PROFILE_BY_PHASE.find(([pattern]) => pattern.test(phase))?.[1] ?? 'DECISION_SCENARIO'
}

function classifyFamily(pkg) {
  const unitTitle = `${pkg.lessonRef.unitTitle ?? ''}`.toLowerCase()
  const lesson = `${pkg.lessonRef.focus ?? pkg.focus ?? ''} ${pkg.lessonRef.title ?? ''}`.toLowerCase()
  const unit = `${unitTitle} ${lesson}`
  if (/^pf1\b/.test(unitTitle)) return /education|training|pathway|aid/.test(lesson) ? 'EDUCATION_CAREER_FINANCE' : 'EARNING_INCOME'
  if (/^pf2\b/.test(unitTitle)) return /fraud|scam|contract|subscription|advertis|privacy|complaint/.test(lesson) ? 'CONSUMER_PROTECTION' : 'SPENDING'
  if (/^pf3\b/.test(unitTitle)) {
    if (/bank|account|deposit|withdraw|statement|fee and access/.test(lesson)) return 'BANKING'
    if (/saving|reserve|goal|future consumption/.test(lesson)) return 'SAVING'
    return 'BUDGETING'
  }
  if (/^pf4\b/.test(unitTitle)) return 'CREDIT_BORROWING'
  if (/^pf5\b/.test(unitTitle)) return 'INVESTING'
  if (/^pf6\b/.test(unitTitle)) return 'INSURANCE_RISK'
  if (/^pf7\b/.test(unitTitle)) return /capstone|financial plan|integrated|stress|shock|defense/.test(lesson) ? 'INTEGRATED_FINANCIAL_PLAN' : 'TAX'
  if (/marketplace|entrepreneur/.test(unit)) return 'ENTREPRENEURSHIP'
  if (/capstone|integrated financial|financial plan|stress-test|stress test/.test(unit)) return 'INTEGRATED_FINANCIAL_PLAN'
  if (/fraud|scam|identity|consumer protection|advertis|contract|subscription|privacy|complaint/.test(unit)) return 'CONSUMER_PROTECTION'
  if (/invest|stock|bond|fund|portfolio|diversif|risk return|retirement/.test(unit)) return 'INVESTING'
  if (/insurance|coverage|deductible|risk management|exposure|likelihood|severity/.test(unit)) return 'INSURANCE_RISK'
  if (/tax|withhold|filing|return from fictional/.test(unit)) return 'TAX'
  if (/credit|borrow|loan|debt|apr|amort|principal.*term/.test(unit)) return 'CREDIT_BORROWING'
  if (/interest|yield|compound/.test(unit)) return 'INTEREST'
  if (/bank|account|deposit|withdraw|statement|fee and access/.test(unit)) return 'BANKING'
  if (/budget|cash.flow|cash flow/.test(unit)) return 'BUDGETING'
  if (/saving|reserve|goal-based|future consumption/.test(unit)) return 'SAVING'
  if (/career|education|training|pathway|financial aid|aid application/.test(unit)) return 'EDUCATION_CAREER_FINANCE'
  if (/earn|income|pay|compensation|workplace|benefit|\bjobs?\b|\bwork\b|money comes from/.test(unit)) return 'EARNING_INCOME'
  if (/entrepreneur|marketplace|product or service|costs and pricing|profit|customer/.test(unit)) return 'ENTREPRENEURSHIP'
  if (/spend|price|purchase|shopping|unit price|receipt|total cost|renewal/.test(unit)) return 'SPENDING'
  return 'MONEY_CONCEPT'
}

function refsForKinds(pkg, patterns) {
  return pkg.tasks
    .filter((task) => patterns.some((pattern) => pattern.test(task.kind)))
    .map((task) => task.taskId)
}

function agePolicy(grade) {
  if (grade <= 5) return {
    band: 'ELEMENTARY_3_5',
    scaffolding: 'Use concrete choices, at most two interacting constraints at a time, short labelled cent calculations, and one evidence-based reason.',
    reasoningDemand: 'Name the goal, compare concrete costs or benefits, and explain one opportunity cost.',
  }
  if (grade <= 8) return {
    band: 'MIDDLE_7_8',
    scaffolding: 'Use multiple stated constraints, explicit vocabulary support, calculators where declared, and a changed-fact test.',
    reasoningDemand: 'Connect a result to affordability, time, fees, risk, or alternatives and explain a tradeoff.',
  }
  return {
    band: 'HIGH_SCHOOL_9_12',
    scaffolding: 'Require assumptions, total and recurring cost, uncertainty, contractual or tax conditions where relevant, and a conditional defense.',
    reasoningDemand: 'Test assumptions, compare interacting constraints, defend a conditional decision, and identify residual risk.',
  }
}

function contentForLesson(pkg, familyKey, family) {
  const topic = `${pkg.lessonRef.focus ?? pkg.focus ?? ''} ${pkg.lessonRef.title ?? ''}`.toLowerCase()
  if (familyKey === 'CREDIT_BORROWING' && /credit report|credit score|reporting and scoring/.test(topic)) {
    return {
      ...family,
      label: 'credit reports, credit scores, and verification',
      concepts: [
        'A credit report is a record of stated borrowing and payment information; a credit score is a model’s summary based on report data.',
        'Reports and scores are related but are not the same, and neither guarantees approval, a rate, or a person’s financial character.',
        'Accuracy, payment history, balances relative to limits, account age, and recent applications can matter under a stated fictional scoring model.',
      ],
      confusion: 'A score is not a complete report, a guarantee, or a moral judgment; an inaccurate report item should be verified and disputed through an official channel.',
      process: ['Separate the report facts from the score summary.', 'Check each fictional entry for accuracy and timing.', 'Identify which stated factors a model uses.', 'Choose a secure correction or comparison step without sharing credentials.'],
      example: {
        facts: ['Samira’s fictional report shows three on-time accounts and one late payment that belongs to a different invented person.', 'A lender’s fictional score model uses payment history and balances.', 'Samira’s goal is to correct the record before an application; no real application occurs.'],
        goal: 'Decide what the report supports and identify the secure next step.',
        steps: ['Separate evidence: the report contains detailed entries; the score is only a model output based on report data.', 'Locate the material mismatch: the late-payment entry conflicts with the fictional identity facts.', 'Do not assume the score proves the entry is correct and do not send credentials in a message.', 'Use the fictional bureau’s known official dispute route, document the mismatch, and wait for verification before interpreting a revised score.'],
        interpretation: 'The report error is a data-accuracy problem; the score cannot resolve that error by itself.',
        tradeoff: 'Verification takes time, but it avoids treating an unverified entry or score as complete evidence.',
      },
      alternate: {
        facts: ['A fictional report shows a balance posted before a recent payment and no identity mismatch.'],
        steps: ['Check the report’s stated date before calling the balance inaccurate.', 'Compare the payment date with the reporting date.', 'If timing explains the difference, wait for the next stated update; otherwise use the official correction route.', 'Explain why a score alone cannot show which explanation is correct.'],
      },
    }
  }
  if (familyKey === 'TAX' && /withhold/.test(topic)) {
    return {
      ...family,
      label: 'tax withholding, final tax, and reconciliation',
      concepts: [
        'Withholding is money prepaid toward an estimated tax during the year; it is not automatically the final tax.',
        'Reconciliation compares final tax under the stated fictional rules with total withholding.',
        'Too little withholding can leave an amount due, while too much can produce a refund; neither changes the final tax itself.',
      ],
      confusion: 'A refund is not extra earnings, and an amount due is not an added tax rate; both are differences between prepayment and final tax.',
      process: ['Compute total fictional withholding in cents.', 'Use the stated final-tax rule or given final tax.', 'Subtract smaller from larger and label refund or amount due.', 'Check timing, assumptions, and whether an adjustment affects cash flow.'],
      example: {
        facts: ['A simplified fictional final tax is $480.00.', 'Withholding was $45.00 per month for ten months.', 'No credits, penalties, or other payments apply.'],
        goal: 'Reconcile total withholding with final tax.',
        steps: ['Convert $45.00 to 4,500 cents and multiply: 10 × 4,500 = 45,000 cents withheld.', 'Final tax is 48,000 cents.', 'Amount due: 48,000 − 45,000 = 3,000 cents, or $30.00.', 'Check: $450.00 withholding + $30.00 due = $480.00 final tax.'],
        interpretation: 'The fictional filer owes $30.00 because prepayments were $30.00 below final tax.',
        tradeoff: 'Increasing future withholding may reduce current take-home pay while lowering the chance of an amount due under unchanged assumptions.',
      },
      alternate: {
        facts: ['Fictional final tax is 36,000 cents and twelve monthly withholdings are 3,200 cents each.'],
        steps: ['Total withholding: 12 × 3,200 = 38,400 cents.', 'Difference: 38,400 − 36,000 = 2,400 cents.', 'Label the $24.00 difference as a refund under the stated model.', 'Check: final tax + refund = total withholding.'],
      },
    }
  }
  return family
}

function lessonRouteIndex(records) {
  const units = new Map()
  for (const record of records) {
    const pkg = record.pkg
    const key = `${pkg.lessonRef.grade}:${pkg.lessonRef.unitNumber}`
    const lesson = {
      lessonId: pkg.lessonRef.lessonId,
      packageId: pkg.packageId,
      profile: classifyProfile(pkg.lessonRef.phase),
      day: pkg.lessonRef.dayInUnit,
    }
    if (!units.has(key)) units.set(key, [])
    units.get(key).push(lesson)
  }
  return new Map([...units].flatMap(([key, lessons]) => {
    lessons.sort((a, b) => a.day - b.day)
    const find = (...profiles) => lessons.find((lesson) => profiles.includes(lesson.profile)) ?? null
    const route = {
      concept: find('CONCEPT_INSTRUCTION'),
      guided: find('GUIDED_APPLICATION'),
      remediation: find('REMEDIATION'),
      mastery: find('ASSESSMENT', 'MASTERY', 'REVIEW') ?? lessons.at(-1),
    }
    return lessons.map((lesson) => [`${key}:${lesson.packageId}`, route])
  }))
}

export function buildProductionDepthRoutes(records) {
  return lessonRouteIndex(records)
}

function workedExample(pkg, familyKey, family) {
  const elementaryEarning = pkg.lessonRef.grade <= 5 && familyKey === 'EARNING_INCOME'
  const example = elementaryEarning ? {
    facts: ['Kai completes 3 invented one-hour jobs at $4.00 for each job.', 'Each job uses the same pretend rate, and there are no deductions in this elementary model.'],
    goal: 'Find Kai’s pretend earnings and explain what the amount represents.',
    steps: ['Represent $4.00 as 400 cents.', 'Earnings: 3 × 400 = 1,200 cents.', 'Convert 1,200 cents to $12.00.', 'Check with repeated addition: 400 + 400 + 400 = 1,200 cents.'],
    interpretation: 'Kai earns $12.00 in this fictional model by completing three jobs at the stated rate.',
    tradeoff: 'Doing another job could add $4.00 but would also use another hour of time.',
  } : family.example
  return {
    exampleRef: `pd-r1-${familyKey.toLowerCase()}-g${pkg.lessonRef.grade}`,
    title: `Worked example — ${family.label}`,
    fictionCue: 'Every person, amount, product, institution, and rule in this example is invented for instruction.',
    facts: example.facts,
    goal: example.goal,
    relevantInformation: 'Use only the listed fictional facts and conditions; do not substitute real household information.',
    method: family.process.join(' '),
    steps: example.steps,
    interpretation: example.interpretation,
    reasonablenessCheck: example.steps.at(-1),
    tradeoff: example.tradeoff,
    limits: 'The conclusion applies only to the stated fictional facts. A changed rate, fee, time, rule, goal, constraint, or risk can change it.',
    calculationAuthority: 'All USD calculations shown here are written as integer cents. Percent rates, when used, are integer basis points divided by 10,000; stated rounding is half up at the declared line only.',
  }
}

function alternateExample(pkg, familyKey, family) {
  const elementaryEarning = pkg.lessonRef.grade <= 5 && familyKey === 'EARNING_INCOME'
  const alternate = elementaryEarning ? {
    facts: ['Mina completes 2 invented tasks at 350 cents per task.'],
    steps: ['Add 350 + 350 = 700 cents.', 'Convert 700 cents to $7.00.', 'Check with multiplication: 2 × 350 = 700 cents.', 'Explain that the earnings depend on completing both fictional tasks.'],
  } : family.alternate
  return {
    exampleRef: `pd-r1-remediation-${familyKey.toLowerCase()}-g${pkg.lessonRef.grade}`,
    title: `Alternate model — ${family.label}`,
    fictionCue: 'This is a different invented case, not a protected task answer.',
    facts: alternate.facts,
    representation: 'Write each money amount as integer cents, label the goal and constraints, and keep assumptions beside the calculation or comparison.',
    steps: alternate.steps,
    check: 'Reverse the arithmetic where possible and confirm that the conclusion uses a stated goal or constraint.',
  }
}

function calculationPolicy(hasNumeric, familyKey) {
  if (!hasNumeric) return {
    applicable: false,
    reason: 'The protected response contract is decision and judgment work; calculation is not manufactured merely to add arithmetic.',
    moneyRepresentationIfIntroduced: 'integer-cents',
    rateRepresentationIfIntroduced: 'integer-basis-points-or-exact-rational',
  }
  return {
    applicable: true,
    currency: 'USD where a prompt states USD',
    moneyRepresentation: 'integer-cents',
    rateRepresentation: 'integer-basis-points-or-exact-rational',
    family: familyKey,
    operationOrder: 'Use the learner-visible scenario order and apply only the stated inflows, outflows, rates, fees, taxes, interest, deposits, charges, or payments.',
    rounding: 'Treat exact-cent results as exact. When a prompt requires rounding, round only at its explicitly stated point and to its stated unit; use half-up for cent rounding unless the prompt declares another rule.',
    taxAssumptions: familyKey === 'TAX' ? 'Use only the fictional jurisdiction, year, base, rates or brackets, deductions, credits, withholding, caps, and order stated in the learner scenario.' : 'not-applicable-unless-stated-in-the-learner-scenario',
    interestAssumptions: ['CREDIT_BORROWING', 'INTEREST', 'INVESTING'].includes(familyKey) ? 'Use only the stated principal or balance, rate meaning, period, compounding method, timing, fees, payment allocation, and rounding rule.' : 'not-applicable-unless-stated-in-the-learner-scenario',
    normalization: 'Follow each prompt’s requested unit and precision. Dollar and cent forms are equivalent only when the adult authority declares that normalization.',
    permittedTools: ['calculator when listed in lesson materials or task directions', 'scratch paper', 'accessible response tool'],
    verification: 'Protected fixed authority remains adult-only and is independently recomputed or comparison-derived from integer cents, basis points, exact rationals, or validated decimal strings. Binary floating-point output is never final authority.',
  }
}

export function applyProductionDepthR1(pkg, route) {
  const profile = classifyProfile(pkg.lessonRef.phase)
  const familyKey = classifyFamily(pkg)
  const family = contentForLesson(pkg, familyKey, FAMILIES[familyKey])
  const concepts = pkg.lessonRef.grade <= 5 && familyKey === 'EARNING_INCOME' ? [
    'People can earn income by doing work or providing a useful product or service under stated terms.',
    'A simple earnings model connects the number of jobs or hours with the pretend amount earned for each one.',
    'Pay is one part of a work choice; time, skills, safety, responsibility, and unpaid contributions can matter too.',
  ] : pkg.lessonRef.grade <= 5 && familyKey === 'SAVING' ? [
    'Saving means setting aside some pretend money now for a later goal or unexpected need.',
    'A saving plan names the goal, amount already saved, amount added each time, and how long the plan takes.',
    'Saving more quickly can reach a goal sooner but leaves less pretend money for choices today.',
  ] : family.concepts
  const prompts = pkg.tasks.flatMap((task) => task.prompts)
  const numericRefs = prompts.filter((prompt) => prompt.promptType === 'fixed-numeric').map((prompt) => prompt.ref)
  const decisionRefs = prompts.filter((prompt) => !['fixed-numeric', 'fixed-choice'].includes(prompt.promptType)).map((prompt) => prompt.ref)
  const localGuided = refsForKinds(pkg, [/warm-up/i, /guided/i, /comprehension/i])
  const localIndependent = refsForKinds(pkg, [/independent/i, /reflection/i, /performance/i, /mastery/i, /simulation/i])
  const modelExempt = MODEL_EXEMPT_PROFILES.has(profile)
  const protectedAttempt = PROTECTED_PROFILES.has(profile)
  const isMasteryEvidence = profile === 'MASTERY' || profile === 'ASSESSMENT'
  const age = agePolicy(pkg.lessonRef.grade)

  pkg.productionDepthRevision = REVISION
  pkg.financialFocus = {
    primary: familyKey,
    secondary: [...new Set([
      numericRefs.length > 0 ? 'EXACT_MONEY_REASONING' : 'DECISION_QUALITY',
      decisionRefs.length > 0 ? 'DECISION_SCENARIO' : null,
    ].filter(Boolean))],
  }
  pkg.instructionalProfile = profile
  pkg.targetConcepts = concepts.map((meaning, index) => ({
    conceptId: `finlit.${familyKey.toLowerCase()}.${index + 1}`,
    meaning,
  }))
  pkg.evidencePurpose = protectedAttempt
    ? `Collect protected evidence about ${pkg.lessonRef.focus ?? pkg.focus ?? family.label} without answer-bearing teaching during the attempt.`
    : `Develop and apply ${family.label} through the existing fictional lesson work, including calculation where relevant and evidence-based decision reasoning.`
  pkg.conceptExplanation = modelExempt ? {
    applicability: 'PROFILE_BOUNDARY',
    title: `${profile.replaceAll('_', ' ').toLowerCase()} boundary`,
    paragraphs: [],
    protectedBoundary: profile === 'DIAGNOSTIC'
      ? 'Do not preteach the measured target before the diagnostic response. Use the routed concept lesson after the attempt.'
      : profile === 'APPLICATION_TRANSFER'
        ? 'Retrieve only the named prerequisite; do not model the protected transfer solution before the response.'
        : 'Do not reveal, model, or hint the protected solution during this mastery or assessment attempt.',
    conceptLessonId: route?.concept?.lessonId ?? null,
  } : {
    applicability: 'REQUIRED_AND_SUPPLIED',
    title: `Understand ${family.label}`,
    paragraphs: [
      concepts[0],
      `${concepts[1]} In this lesson, the learner uses the provided fictional facts about ${pkg.lessonRef.focus ?? pkg.focus ?? family.label}; no real household information belongs in the work.`,
      `${concepts[2]} The usable process is: ${family.process.join(' ')}`,
    ],
    relationship: family.process,
    commonConfusion: family.confusion,
    conditionsAndLimits: 'Use only the stated fictional facts, time period, rate meaning, fees, taxes, timing, rounding, goals, and constraints. The result is education for this scenario, not individualized advice.',
  }
  pkg.calculationPolicy = calculationPolicy(numericRefs.length > 0, familyKey)
  pkg.workedExamplePolicy = modelExempt ? {
    applicability: 'DEFERRED_OR_PREREQUISITE_ONLY',
    reason: profile === 'DIAGNOSTIC'
      ? 'A like-kind model before the diagnostic would invalidate the evidence.'
      : profile === 'APPLICATION_TRANSFER'
        ? 'The transfer task depends on prior teaching; the named concept lesson contains the model.'
        : 'A like-kind model during protected mastery or assessment would expose the measured method.',
    modelLessonId: route?.concept?.lessonId ?? null,
  } : {
    applicability: 'REQUIRED_AND_SUPPLIED',
    separationRule: 'The model uses different fictional people, amounts, wording, and decision conditions from protected independent and mastery work.',
  }
  pkg.workedExamples = modelExempt ? [] : [workedExample(pkg, familyKey, family)]
  pkg.guidedPracticeContract = {
    applicability: ['CONCEPT_INSTRUCTION', 'GUIDED_APPLICATION', 'REMEDIATION', 'DECISION_SCENARIO'].includes(profile) ? 'REQUIRED' : 'SEQUENCE_HANDOFF',
    localTaskRefs: localGuided,
    guidedLessonId: localGuided.length > 0 ? pkg.lessonRef.lessonId : route?.guided?.lessonId ?? null,
    learnerAction: numericRefs.length > 0
      ? 'Select and carry out the relevant operation with the fictional quantities, then interpret the result.'
      : 'Identify the goal and constraints, compare alternatives, and support a provisional decision.',
    supportBeforeAction: 'Vocabulary, labelled facts, the approved separate model, and an empty organizer may be used only outside protected attempts.',
    feedbackAfterAction: `Check for the observable confusion: ${family.confusion}`,
    expectedEvidence: 'A learner-produced calculation or comparison plus financial meaning in the learner’s own words.',
    fade: 'Step cues and parallel models end before independent or protected evidence.',
  }
  pkg.independentScenarioContract = {
    localTaskRefs: localIndependent,
    independentBoundary: 'Use only the stated fictional facts and declared tools. No completed step, selected option, decisive justification, or protected result may be supplied.',
    permittedSupports: ['read-aloud or vocabulary support', 'calculator when declared', 'scratch paper or unfilled organizer'],
    responseForm: numericRefs.length > 0 && decisionRefs.length > 0 ? 'mixed exact calculation and written reasoning' : numericRefs.length > 0 ? 'calculation and interpretation' : 'written comparison or decision reasoning',
    freshness: 'The protected case keeps the target but changes facts, constraints, timing, representation, or alternatives from the worked model.',
  }
  pkg.decisionReasoning = {
    applicable: decisionRefs.length > 0,
    itemRefs: decisionRefs,
    gradeBandDemand: age.reasoningDemand,
    framework: ['State the fictional goal.', 'Identify fixed facts, constraints, and assumptions.', 'Compare relevant benefits, costs, risks, and opportunity costs.', 'Use a calculation only when it answers a decision question.', 'Defend a conditional choice and name a changed fact that could change it.'],
    neutrality: 'More than one conclusion may be defensible when priorities differ; scoring follows relevant evidence and internal consistency, not an adult lifestyle preference.',
  }
  pkg.masteryRule = {
    targetConceptIds: pkg.targetConcepts.map((concept) => concept.conceptId),
    evidenceLessonId: isMasteryEvidence ? pkg.lessonRef.lessonId : route?.mastery?.lessonId ?? null,
    localTaskRefs: isMasteryEvidence ? pkg.tasks.map((task) => task.taskId) : [],
    permittedSupports: ['declared accessibility support', 'calculator when declared', 'scratch paper or unfilled organizer'],
    independenceRule: 'Worked examples, completed organizers, answer-bearing hints, or decisive feedback invalidate the protected attempt; use a fresh case after support.',
    evidenceRequired: numericRefs.length > 0 && decisionRefs.length > 0
      ? 'Correct or acceptably normalized fixed work plus aligned financial interpretation or decision reasoning.'
      : numericRefs.length > 0
        ? 'Correct or acceptably normalized fixed work with the required unit, precision, and assumptions.'
        : 'A claim supported by relevant fictional evidence, tradeoff or risk reasoning, and acceptable variation under the adult-only rubric.',
    decisionRule: 'Mastery is decided only by the aligned adult-only authority for the named evidence lesson; completion alone is not mastery.',
  }
  pkg.remediationRoutes = [{
    misconceptionId: `finlit.${familyKey.toLowerCase()}.core-confusion`,
    observableSignal: family.confusion,
    alternateExplanation: `Use a labelled fact–rule–result–meaning organizer. Separate what the fictional case states from what must be calculated or judged, then connect the result back to the stated goal.`,
    parallelWorkedCase: alternateExample(pkg, familyKey, family),
    guidedRetryLessonId: route?.remediation?.lessonId ?? route?.guided?.lessonId ?? pkg.lessonRef.lessonId,
    guidedRetryRule: 'Use the alternate representation on a different fictional case, require the learner to complete the decisive step, and fade labels after the attempt.',
    freshMasteryLessonId: route?.mastery?.lessonId ?? pkg.lessonRef.lessonId,
    freshMasteryRule: 'Use a fresh protected case after support; do not count the parallel model or supported retry as mastery.',
  }]
  pkg.futureTutorManifest = {
    dataOnly: true,
    conceptIds: pkg.targetConcepts.map((concept) => concept.conceptId),
    prerequisiteConceptIds: route?.concept && route.concept.lessonId !== pkg.lessonRef.lessonId ? [`lesson:${route.concept.lessonId}`] : [],
    misconceptionIds: pkg.remediationRoutes.map((item) => item.misconceptionId),
    calculationPolicy: pkg.calculationPolicy,
    decisionScenarioRefs: [`lesson:${pkg.lessonRef.lessonId}:fictional-scenario`],
    hintPolicy: {
      order: ['restate-goal', 'locate-fictional-facts', 'name-rule-or-criterion', 'prompt-next-representation', 'parallel-case-then-fresh-retry'],
      mayReveal: 'Vocabulary, stated assumptions, relevant fact locations, and a non-protected parallel case.',
      mustNotReveal: 'Protected results, winning options, decisive justifications, adult authority, or enough successive steps to reduce the response to copying.',
      independenceEffect: 'A parallel worked case or answer-bearing help ends the current independent attempt and requires fresh evidence.',
    },
    agePolicy: {
      ...age,
      privacy: 'Never request real household income, debt, balances, spending, tax records, credit data, credentials, or hardship information.',
      adviceBoundary: 'Discuss only approved fictional cases and general educational questions; do not direct real financial action.',
    },
    answerPolicy: {
      responseMode: pkg.responseScoring?.mode ?? 'derived-during-reconciliation',
      authority: 'adult-only companion scoring artifact resolved by stable package and prompt references',
      revealRestriction: 'No protected fixed answer, rubric locator, or scoring trace appears in the learner package.',
      workedExampleSeparation: 'Learner-visible examples are separate instruction and never authority for protected task responses.',
    },
  }
  pkg.accessibilitySupports = [
    age.scaffolding,
    'Read-aloud, vocabulary clarification, labelled text representations, calculator use when declared, and an unfilled organizer may reduce access burden without performing the target work.',
    'Color, audio, spatial arrangement, and drag interaction are never the sole carrier of a required financial fact.',
  ]

  return pkg
}

export const FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1_REVISION = REVISION
export const FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1_FAMILIES = Object.freeze(Object.keys(FAMILIES))
export const FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1_PROTECTED_PROFILES = Object.freeze([...PROTECTED_PROFILES])
export const FINANCIAL_LITERACY_PRODUCTION_DEPTH_R1_MODEL_EXEMPT_PROFILES = Object.freeze([...MODEL_EXEMPT_PROFILES])
