import type { LessonSpec } from '../types.ts'

/**
 * Grade 10, Unit 5 — PF5 Financial Investing: Markets, Vehicles, and
 * Regulation.
 *
 * Every instrument, fund, brokerage, regulator, and protection scheme in this
 * unit is invented. No real security, ticker, fund, firm, or agency is named
 * anywhere, and no lesson asks a learner what to do with their own money or
 * implies that any return is available in practice. Returns used here are
 * stated outcomes of a simulated period, not forecasts.
 *
 * Two modelling conventions are stated on the learner-facing sheet wherever
 * they are used:
 *
 *  - A fund's net return is its gross return less its expense ratio, applied
 *    once a year. This is the standard simplification and it omits trading
 *    costs and cash drag.
 *  - The tax comparison in l05 holds one flat rate across the whole
 *    withdrawal and ignores contribution limits, penalties, employer
 *    contributions, and required distributions. The sheet says so.
 */
export const g10u05: readonly LessonSpec[] = [
  {
    lessonId: 'ma-g10-financial-literacy-u05-l01',
    grade: 10, unit: 5, day: 1,
    actor: 'a fictional investor holding one share position and one bond',
    objective: 'Compute the total return on a fictional share position from both price change and dividends, compute the current yield on a fictional bond bought below face value, and distinguish what each instrument promises.',
    scenario: 'The simulated share, bond, and fund described below are invented for this exercise. No real company, security, or fund is named, and the price movements shown are a stated outcome of a simulated period rather than a prediction.',
    materials: ['calculator', 'the fictional holdings described in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional investor bought 40 shares of a simulated company at $28.50 a share. Over the simulated year the price moved to $31.75 and the company paid a dividend of $0.42 a share. Ignore any commission.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What did the share position cost to buy?',
            given: { shares: 40, buy: 28.5 }, expr: 'shares * buy', format: 'usd', answer: '$1,140.00',
            reasoning: '40 shares at $28.50 each. This is the base every return figure below is measured against.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the position worth at the end of the simulated year?',
            given: { shares2: 40, sell: 31.75 }, expr: 'shares2 * sell', format: 'usd', answer: '$1,270.00',
            reasoning: 'The same 40 shares at the $31.75 price. Nothing has been sold, so this is a value on paper.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much did the position gain from the price move alone?',
            given: {}, expr: '#t1-p2 - #t1-p1', format: 'usd', answer: '$130.00',
            reasoning: '$1,270.00 against $1,140.00. This part of the return exists only while the price holds and reverses if it falls.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now add the dividends, state the whole result as a return, and compare with a fictional bond. The simulated bond has a face value of $1,000 and pays a 4.5% coupon each year; the investor bought it for $960.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much did the shares pay in dividends over the year?',
            given: { shares3: 40, dividend: 0.42 }, expr: 'shares3 * dividend', format: 'usd', answer: '$16.80',
            reasoning: '40 shares at $0.42 each. Unlike the price move, this is cash the investor actually received.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the total return on the share position in dollars?',
            given: {}, expr: '#t1-p3 + #t2-p1', format: 'usd', answer: '$146.80',
            reasoning: '$130.00 of price change plus $16.80 of dividends. Reporting only the price change would understate the year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percent',
            text: 'What is that total return as a percentage of what the position cost?',
            given: {}, expr: '#t2-p2 / #t1-p1 * 100', format: 'percent2', answer: '12.88%',
            reasoning: '$146.80 against the $1,140.00 invested.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the fictional bond pay in coupon each year?',
            given: { face: 1000, coupon: 0.045 }, expr: 'face * coupon', format: 'usd', answer: '$45.00',
            reasoning: '4.5% of the $1,000 face value. The coupon is set against face value, not against what the investor paid.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'percent',
            text: 'What is the bond’s current yield — the coupon measured against the $960 actually paid?',
            given: { pricePaid: 960 }, expr: '#t2-p4 / pricePaid * 100', format: 'percent2', answer: '4.69%',
            reasoning: '$45.00 against the $960 paid. Buying below face value raises the yield above the stated coupon rate, which is why the two figures differ.',
          },
          {
            ref: 't2-p6', kind: 'choice',
            text: 'Which of these instruments carries a stated promise to pay a fixed amount on a schedule?',
            choices: ['The share', 'The bond', 'Both of them', 'Neither of them'],
            answer: 'The bond',
            reasoning: 'A bond is a loan with a contractual coupon and a repayment date, so the amounts are stated in advance. A dividend on a share is declared at the company’s discretion and can be reduced or stopped, which is why the $16.80 was not promised.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fictional index fund holds small pieces of hundreds of companies at once, while the share position above is one company. Explain what the fund changes about the risk the investor is exposed to, and name one risk it does not remove.',
            acceptableAnswerCriteria: [
              'Explains that spreading across many companies removes the exposure to any single company failing, so one company’s collapse cannot take the whole position with it.',
              'Names a risk the fund does not remove — a decline across the whole market, or the fund’s own expense ratio — and says why holding more companies does not address it.',
              'Distinguishes the two sources of the share return, the $130.00 price move and the $16.80 of dividends, and notes that a fund return is built the same way from its holdings.',
            ],
            evidenceRequirements: [
              'Uses the $146.80 total return and the 12.88% figure, and refers to the bond’s stated coupon.',
            ],
            dimensions: ['transfer', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response separates company-specific risk from market-wide risk.',
              'The response does not present the 12.88% as a rate anyone can expect; it is one simulated year’s outcome.',
            ],
            commonMisconception: 'Treating diversification as protection against loss in general rather than against the failure of any one holding.',
          },
        ],
      },
    ],
    remediation: 'If the total return comes out as $130.00, the dividends have been left out. A share position returns both what the price does and what the company pays out. Add the $16.80 of dividends to the $130.00 of price change before dividing by the $1,140.00 cost.',
    extension: 'Work out what the share position would have returned if the price had ended at $26.00 and the same dividend had been paid, and say whether the dividend made the year positive.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l02',
    grade: 10, unit: 5, day: 2,
    actor: 'a fictional investor comparing two funds with the same gross return',
    objective: 'Compute twenty years of growth on two fictional funds that differ only in expense ratio, and show that the cost of the higher fee is far larger than the fees themselves.',
    scenario: 'The two simulated funds below are invented for this exercise. Both are assumed to earn the same gross return, so the only difference between them is the disclosed expense ratio. A fund’s net return here is its gross return less its expense ratio, applied once a year; a real fund also bears trading costs this model leaves out.',
    materials: ['calculator', 'the two fictional fund disclosures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional investor places $10,000 for 20 years. Both simulated funds earn a gross return of 6.5% a year. Fund L discloses an expense ratio of 0.08%; Fund H discloses 0.95%. Neither fund receives any further contribution.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is Fund L’s net annual return?',
            given: { gross: 0.065, erLow: 0.0008 }, expr: '(gross - erLow) * 100', format: 'percent2', answer: '6.42%',
            reasoning: 'The 6.5% gross return less the 0.08% expense ratio. The fee comes out of the return before the investor sees it.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What is Fund H’s net annual return?',
            given: { gross2: 0.065, erHigh: 0.0095 }, expr: '(gross2 - erHigh) * 100', format: 'percent2', answer: '5.55%',
            reasoning: 'The same 6.5% gross less the 0.95% expense ratio — a gap of 0.87 percentage points a year.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does Fund L hold after 20 years? Round to the nearest cent.',
            given: { start: 10000, gross3: 0.065, erLow2: 0.0008 }, expr: 'round(start * pow(1 + gross3 - erLow2, 20), 2)', format: 'usd', answer: '$34,710.84',
            reasoning: '$10,000 compounded at the 6.42% net rate for 20 years.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now do the same for Fund H, and compare the gap with the fees themselves.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does Fund H hold after 20 years? Round to the nearest cent.',
            given: { start2: 10000, gross4: 0.065, erHigh2: 0.0095 }, expr: 'round(start2 * pow(1 + gross4 - erHigh2, 20), 2)', format: 'usd', answer: '$29,455.39',
            reasoning: 'The same $10,000 compounded at the 5.55% net rate for the same 20 years.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much less does the investor end with in Fund H?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$5,255.45',
            reasoning: '$34,710.84 against $29,455.39. Both funds earned the same gross return every year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'If Fund H’s 0.95% fee were charged on the original $10,000 every year for 20 years, what would the fees add up to?',
            given: { start3: 10000, erHigh3: 0.0095 }, expr: 'start3 * erHigh3 * 20', format: 'usd', answer: '$1,900.00',
            reasoning: '0.95% of $10,000 in each of 20 years. This is what a quick estimate of the fee cost produces, and it is the wrong figure.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'By how much does the actual shortfall exceed that estimate?',
            given: {}, expr: '#t2-p2 - #t2-p3', format: 'usd', answer: '$3,355.45',
            reasoning: '$5,255.45 of actual shortfall against a $1,900.00 estimate. The difference is the growth the money taken as fees would itself have produced, plus the fee charged on a balance that grew well above $10,000.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The difference between the two expense ratios is under one percentage point, and it cost $5,255.45 over twenty years. Explain why the naive fee estimate of $1,900.00 misses most of the cost, and say what this implies about which disclosed number deserves attention on a long-held fund.',
            acceptableAnswerCriteria: [
              'Explains that the fee is charged on the whole balance each year, not on the original $10,000, and that money removed early also gives up every year of growth it would have earned.',
              'Concludes that the expense ratio deserves close attention precisely because it is small-looking, recurring, and compounds against the investor over a long holding period.',
              'Notes that the comparison holds gross return equal by assumption, so it isolates the fee and does not claim the cheaper fund performs better before costs.',
            ],
            evidenceRequirements: [
              'Uses the $34,710.84 and $29,455.39 ending balances and both the $5,255.45 and $1,900.00 figures.',
            ],
            dimensions: ['reasoning-from-figures', 'assumption-identification', 'communication-of-uncertainty'],
            lookFors: [
              'The response identifies forgone growth on the fees, not just the fees.',
              'The response recognises the equal-gross-return assumption as an assumption rather than a finding.',
            ],
            commonMisconception: 'Treating a fraction of a percent in fees as too small to matter over a long holding period.',
          },
        ],
      },
    ],
    remediation: 'If the fee cost looks like $1,900.00, the estimate is charging 0.95% on $10,000 every year. The balance is not $10,000 every year — it grows past $29,000 — and the fee is charged on whatever is there. Compute each fund’s ending balance from its own net rate and subtract, which gives $5,255.45.',
    extension: 'Work out what Fund H would need as a gross return to end level with Fund L after 20 years, and say whether an investor could know in advance that a fund would deliver it.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l03',
    grade: 10, unit: 5, day: 3,
    actor: 'a fictional investor comparing a spread allocation with two concentrated ones',
    objective: 'Compute the one-year outcome of a fictional equally weighted portfolio against single-asset alternatives, and quantify what diversification gave up and what it avoided.',
    scenario: 'The four simulated asset classes below are invented for this exercise, and the returns shown are the stated outcome of one simulated year rather than a forecast of any real market.',
    materials: ['calculator', 'the fictional one-year returns in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Over one simulated year, four fictional asset classes returned: a broad domestic stock fund 18%, a bond fund 3%, an international stock fund -6%, and a cash account 2%. A fictional investor has $8,000 and puts an equal quarter into each.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the return on the equally weighted portfolio?',
            given: { broad: 0.18, bond: 0.03, intl: -0.06, cash: 0.02 }, expr: '(broad + bond + intl + cash) / 4 * 100', format: 'percent2', answer: '4.25%',
            reasoning: 'With equal quarters, the portfolio return is the plain average of the four returns. The -6% is included at the same weight as the 18%.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the equally weighted portfolio worth at the end of the year? Round to the nearest cent.',
            given: { invested: 8000 }, expr: 'round(invested * (1 + #t1-p1 / 100), 2)', format: 'usd', answer: '$8,340.00',
            reasoning: 'The $8,000 invested grown by the 4.25% portfolio return computed above.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the whole $8,000 have been worth in the broad domestic stock fund alone?',
            given: { invested2: 8000, broad2: 0.18 }, expr: 'invested2 * (1 + broad2)', format: 'usd', answer: '$9,440.00',
            reasoning: 'The best of the four outcomes, known only after the year ended.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find the worst single choice and measure the spread between the extremes.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What would the whole $8,000 have been worth in the international stock fund alone?',
            given: { invested3: 8000, intl2: -0.06 }, expr: 'invested3 * (1 + intl2)', format: 'usd', answer: '$7,520.00',
            reasoning: 'The worst of the four outcomes, at a -6% return.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What is the spread between the best and worst single-asset outcomes?',
            given: {}, expr: '#t1-p3 - #t2-p1', format: 'usd', answer: '$1,920.00',
            reasoning: '$9,440.00 against $7,520.00 — the range a concentrated investor was exposed to before knowing which asset would be which.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much did the diversified portfolio gain over the year?',
            given: { invested4: 8000 }, expr: '#t1-p2 - invested4', format: 'usd', answer: '$340.00',
            reasoning: '$8,340.00 against the $8,000 invested — a positive year without having had to pick correctly.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'How much did the diversified investor give up against the best single choice?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$1,100.00',
            reasoning: '$9,440.00 against $8,340.00. This is the cost of diversification, and it is only visible after the fact.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'The diversified portfolio finished $1,100.00 behind the best single choice and $820.00 ahead of the worst. Explain what an investor is actually buying when they diversify, and say why the $1,100.00 is not evidence that diversifying was a mistake.',
            acceptableAnswerCriteria: [
              'States that diversification buys a narrower range of outcomes rather than a higher return, so it gives up the best case in exchange for avoiding the worst.',
              'Explains that the $1,100.00 is only identifiable after the year ended, and that the investor did not know in advance which of the four would lead, so the choice cannot be judged by the outcome alone.',
              'Uses the $1,920.00 spread to show how much was at stake in picking a single asset.',
            ],
            evidenceRequirements: [
              'Uses the $8,340.00 diversified value and both of the single-asset outcomes.',
            ],
            dimensions: ['tradeoff-defense', 'communication-of-uncertainty', 'reasoning-from-figures'],
            lookFors: [
              'The response separates judging a decision from judging its outcome.',
              'The response does not claim diversification prevents loss; all four assets could have fallen together.',
            ],
            commonMisconception: 'Judging a diversified allocation against whichever asset happened to do best, once the year is known.',
          },
        ],
      },
    ],
    remediation: 'If the portfolio return comes out as 7.67%, the negative return is being left out of the sum altogether while the other three are still divided by 4. The international fund returned -6%, and at an equal quarter weight it pulls the average down. Add all four returns, including the negative one, before dividing by 4.',
    extension: 'Recompute the equally weighted return if the international fund had instead returned -20% and everything else was unchanged, and say whether the portfolio still finished the year positive.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l04',
    grade: 10, unit: 5, day: 4,
    actor: 'a fictional account holder reading what a protection scheme does and does not cover',
    objective: 'Apply a fictional custody-protection scheme’s stated limits to two account sizes, and establish that no part of it covers a decline in the value of the investments themselves.',
    scenario: 'The Investor Protection Fund and the Markets Disclosure Authority described below are fictional stand-ins invented only for this exercise. Their limits and rules are made up. No real agency, protection scheme, or brokerage is described.',
    materials: ['calculator', 'the fictional scheme rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'In this simulated system, the fictional Investor Protection Fund steps in only when a brokerage fails and customer property is missing. It covers up to $500,000 of securities and cash per customer, with a sub-limit of $250,000 on cash. It does not cover any fall in the value of an investment. A fictional customer holds $340,000 of securities and $18,000 of cash at a simulated brokerage.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What is the total value of the customer’s account?',
            given: { securities: 340000, cash: 18000 }, expr: 'securities + cash', format: 'usd', answer: '$358,000.00',
            reasoning: '$340,000 of securities plus $18,000 of cash.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'If the fictional brokerage fails, how much of the securities holding falls within the $500,000 limit?',
            given: { securities2: 340000, limit: 500000 }, expr: 'min(securities2, limit)', format: 'usd', answer: '$340,000.00',
            reasoning: 'The $340,000 held is below the $500,000 ceiling, so all of it is within the limit.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much of the cash falls within the $250,000 cash sub-limit?',
            given: { cash2: 18000, cashSub: 250000 }, expr: 'min(cash2, cashSub)', format: 'usd', answer: '$18,000.00',
            reasoning: 'The $18,000 of cash is far below the $250,000 sub-limit, so all of it is within it. A sub-limit binds only when the cash portion is large.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now test the limit against a larger account, and then against something the scheme does not cover at all. A second fictional customer holds $610,000 of securities. Separately, the first customer’s $340,000 of securities falls 22% in a simulated market decline while the brokerage stays in business.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'If that brokerage failed, how much of the second customer’s securities would fall outside the $500,000 limit?',
            given: { bigAccount: 610000, limit2: 500000 }, expr: 'bigAccount - min(bigAccount, limit2)', format: 'usd', answer: '$110,000.00',
            reasoning: '$610,000 held against a $500,000 ceiling. The excess is not protected by the scheme, which is why a large holder may spread across firms.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much value does the first customer lose in the 22% market decline?',
            given: { portfolio: 340000, decline: 0.22 }, expr: 'portfolio * decline', format: 'usd', answer: '$74,800.00',
            reasoning: '22% of the $340,000 of securities held.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What are those securities worth after the decline?',
            given: { portfolio2: 340000, decline2: 0.22 }, expr: 'portfolio2 * (1 - decline2)', format: 'usd', answer: '$265,200.00',
            reasoning: '$340,000 less the $74,800.00 lost. The securities are all still present in the account; they are simply worth less.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'How much of that $74,800.00 decline does the fictional Investor Protection Fund cover?',
            choices: ['All of it', 'Up to the $500,000 limit', 'None of it'],
            answer: 'None of it',
            reasoning: 'The scheme covers customer property that goes missing when a brokerage fails. Nothing went missing here and the brokerage did not fail — the investments simply fell in value, which the stated rules exclude entirely.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'A fictional advertisement says an account is "protected up to $500,000". Explain in your own words what that protection actually is, name what it excludes, and say what a disclosure rule requiring risk factors to be published is for.',
            acceptableAnswerCriteria: [
              'Explains that the protection is against the failure of the firm holding the assets and the loss of customer property, not against the assets falling in value.',
              'Names the exclusion concretely using the $74,800.00 decline, which is covered by nothing despite the account being well inside the $500,000 limit.',
              'States that a disclosure rule exists so an investor can see the risks and costs before committing, since no scheme repays a loss that comes from the investment itself.',
            ],
            evidenceRequirements: [
              'Uses the $358,000.00 account total, the $110,000.00 that falls outside the limit for the larger account, and the $74,800.00 decline.',
            ],
            dimensions: ['criteria-application', 'communication-of-uncertainty', 'evidence-use'],
            lookFors: [
              'The response distinguishes custody risk from market risk without needing those terms.',
              'The response does not describe the advertisement as false; the claim is accurate and the issue is what a reader assumes it covers.',
            ],
            commonMisconception: 'Reading a brokerage protection limit as a guarantee that an account cannot lose value.',
          },
        ],
      },
    ],
    remediation: 'If the decline looks like something the scheme should cover, re-read what triggers it: a brokerage failing and customer property going missing. In the decline, every security is still in the account. The customer holds exactly what they held before, and it is worth $265,200.00 instead of $340,000.',
    extension: 'Work out how a fictional customer holding $900,000 of securities could stay within the stated per-customer limit, and say what that costs them in convenience.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l05',
    grade: 10, unit: 5, day: 5,
    actor: 'a fictional saver comparing three account types under a stated tax model',
    objective: 'Compute the after-tax result of the same fictional contribution in a pre-tax account, an after-tax account, and an ordinary taxable account, and identify the single condition that decides between the first two.',
    scenario: 'The three simulated account types and the tax rates below are invented for this exercise. This simplified model applies one flat rate to a whole withdrawal and ignores contribution limits, penalties, employer contributions, and required distributions. It also taxes every year’s growth in the ordinary account at the full rate as it is earned, where a real taxable account defers tax on gains until they are realised and may tax them at a different rate, so the cost it computes for that account is an upper bound. It is a teaching model, not a description of any real account, and it is not advice about anyone’s own saving.',
    materials: ['calculator', 'the fictional account rules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Carry every calculation through without rounding, and round only the figure a question actually asks for — rounding a running total and then reusing it will move the last cent. A fictional saver has $4,000 of income to commit for 25 years at a simulated 6% annual growth rate. The pre-tax account takes the whole $4,000 before tax and taxes the withdrawal. The after-tax account takes the $4,000 after tax is paid on it and does not tax the withdrawal. The ordinary account takes the $4,000 after tax and taxes the growth each year. The tax rate is 22% now.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the pre-tax account hold after 25 years, before any withdrawal tax?',
            given: { contrib: 4000, growth: 0.06 }, expr: 'contrib * pow(1 + growth, 25)', format: 'usd', answer: '$17,167.48',
            reasoning: 'The whole $4,000 compounding at 6% for 25 years, with no tax taken along the way.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'If the withdrawal is taxed at 22%, what does the saver keep from the pre-tax account? Round to the nearest cent.',
            given: { taxRate: 0.22 }, expr: 'round(#t1-p1 * (1 - taxRate), 2)', format: 'usd', answer: '$13,390.64',
            reasoning: 'The full balance less 22% taken at withdrawal. Tax was deferred, not avoided.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much actually goes into the after-tax account, once 22% tax is paid on the $4,000 first?',
            given: { contrib2: 4000, taxRate2: 0.22 }, expr: 'contrib2 * (1 - taxRate2)', format: 'usd', answer: '$3,120.00',
            reasoning: '$4,000 less 22% paid up front. Less money starts working, which is the cost of paying tax now.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now grow the after-tax account, then test what happens if the rate at withdrawal is 12% rather than 22%, and finally compare with the ordinary taxable account, where each year’s growth is taxed at 22% as it is earned.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the after-tax account hold after 25 years, with no tax due on withdrawal? Round to the nearest cent.',
            given: { growth2: 0.06 }, expr: 'round(#t1-p3 * pow(1 + growth2, 25), 2)', format: 'usd', answer: '$13,390.64',
            reasoning: '$3,120.00 compounding at 6% for 25 years. This is exactly what the pre-tax account left after tax — when the rate is the same at both ends, the two are identical, and both come to $13,390.64 from the unrounded chain. A learner who rounds the $17,167.48 first and then takes 78% of it lands a cent low, which is why the directions say to round only at the end.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'Suppose the saver’s rate at withdrawal is 12% instead. What does the pre-tax account leave then? Round to the nearest cent.',
            given: { laterRate: 0.12 }, expr: 'round(#t1-p1 * (1 - laterRate), 2)', format: 'usd', answer: '$15,107.38',
            reasoning: 'The same balance taxed at 12% rather than 22% at withdrawal.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much better off is the pre-tax account in that case?',
            given: {}, expr: '#t2-p2 - #t2-p1', format: 'usd', answer: '$1,716.74',
            reasoning: '$15,107.38 against $13,390.64. The whole advantage comes from the rate being lower at withdrawal than at contribution.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What does the ordinary taxable account hold after 25 years, with each year’s 6% growth taxed at 22% as it is earned? Round to the nearest cent.',
            given: { growth3: 0.06, taxRate3: 0.22 }, expr: 'round(#t1-p3 * pow(1 + growth3 * (1 - taxRate3), 25), 2)', format: 'usd', answer: '$9,789.21',
            reasoning: 'The same $3,120.00 start, but compounding at 4.68% instead of 6% because tax removes part of each year’s return before it can compound.',
          },
          {
            ref: 't2-p5', kind: 'numeric', unit: 'USD',
            text: 'How much does the annual taxing of growth cost against the after-tax account?',
            given: {}, expr: '#t2-p1 - #t2-p4', format: 'usd', answer: '$3,601.43',
            reasoning: '$13,390.64 against $9,789.21, from identical starting amounts and an identical gross growth rate. The whole gap is the compounding lost to tax paid each year.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Under this model the pre-tax and after-tax accounts finished exactly level at $13,390.64. State the single condition that made them equal, say which one wins if that condition breaks in each direction, and name one thing this simplified model leaves out.',
            acceptableAnswerCriteria: [
              'Identifies the condition precisely: the tax rate at contribution and the rate at withdrawal are the same, which is why $4,000 taxed at the end and $3,120.00 taxed at the start produce the same result.',
              'States both directions: a lower rate at withdrawal favours the pre-tax account, as the $15,107.38 case shows, and a higher rate at withdrawal favours the after-tax account.',
              'Names something the model omits — contribution limits, penalties for early withdrawal, employer contributions, changes in tax law, or required distributions.',
            ],
            evidenceRequirements: [
              'Uses the $13,390.64 figure common to both accounts and the $15,107.38 lower-rate case.',
            ],
            dimensions: ['assumption-identification', 'reasoning-from-figures', 'communication-of-uncertainty'],
            lookFors: [
              'The response treats the equality as a consequence of the equal rates, not as a coincidence of these numbers.',
              'The response does not recommend an account to any real person; the question is about what decides between them.',
            ],
            commonMisconception: 'Believing a pre-tax account is always better because the contribution is untaxed, without asking what rate applies at withdrawal.',
          },
        ],
      },
    ],
    remediation: 'If the pre-tax account looks like an automatic winner, compare what each one taxes. Taxing $4,000 at the start and growing $3,120.00, or growing $4,000 and taxing the result, give the same answer when the rate is the same — both come to $13,390.64. Only a change in the rate between the two moments separates them.',
    extension: 'Work out which account wins if the rate at withdrawal is 30%, and say what a saver would need to know about a future they cannot see in order to choose confidently.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l06',
    grade: 10, unit: 5, day: 6,
    actor: 'a fictional recipient of an offer promising a guaranteed monthly return',
    objective: 'Annualise a fictional guaranteed monthly return, compute how long a pool of investor money could sustain the promised payouts with no real earnings, and name the structural red flags.',
    scenario: 'The simulated investment offer below is invented for this exercise. It is a teaching example of a pattern, not a description of any real scheme, product, or person.',
    materials: ['calculator', 'the fictional offer in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional offer promises a guaranteed 3% return every month, says the opportunity closes on Friday, and is not registered with the fictional Markets Disclosure Authority. 40 fictional investors put in $5,000 each. Assume the money is never actually invested and earns nothing, so payouts come only from the pool itself.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What annual return does a guaranteed 3% a month work out to, if each month’s return compounds?',
            given: { monthly: 0.03 }, expr: '(pow(1 + monthly, 12) - 1) * 100', format: 'percent2', answer: '42.58%',
            reasoning: '3% compounded over 12 months. A guaranteed return of this size is the first red flag: real returns of this magnitude come with real risk, and nothing that carries real risk can be guaranteed.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much money is in the pool?',
            given: { investors: 40, each: 5000 }, expr: 'investors * each', format: 'usd', answer: '$200,000.00',
            reasoning: '40 fictional investors at $5,000 each, which is the entire amount the arrangement has available to it.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What does one month of promised payouts cost across all 40 investors?',
            given: { monthly2: 0.03 }, expr: '#t1-p2 * monthly2', format: 'usd', answer: '$6,000.00',
            reasoning: '3% of the $200,000.00 pool, owed every month whether or not anything was earned.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now find how long the arrangement can last, and compare the promise with a stated long-run average.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'months',
            text: 'With no real earnings, how many months of payouts can the pool fund before it is exhausted? Round to one decimal place.',
            given: {}, expr: '#t1-p2 / #t1-p3', format: 'dec1', answer: '33.3',
            reasoning: 'The $200,000.00 pool divided by $6,000.00 of monthly payouts. The arithmetic guarantees an end, and the only way to postpone it is to take in new investors.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'percent',
            text: 'A fictional diversified fund states a long-run average of 7% a year. State that as a percentage for comparison.',
            given: { stated: 0.07 }, expr: 'stated * 100', format: 'percent2', answer: '7.00%',
            reasoning: 'A stated long-run average, which is an average of good and bad years rather than a promise about any single year.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'percentage points',
            text: 'By how many percentage points does the offer exceed that stated average? Give the number of points, without a percent sign.',
            given: {}, expr: '#t1-p1 - #t2-p2', format: 'dec2', answer: '35.58',
            reasoning: '42.58% against 7.00%, a gap of 35.58 percentage points. A gap this large with less risk attached is not an opportunity that was overlooked. Percentage points are the right unit for a difference between two rates; calling it 35.58% would invite reading it as a proportion of the 7.00%.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Which feature of the offer is the strongest single warning sign?',
            choices: [
              'That the return is described as guaranteed',
              'That the offer closes on Friday',
              'That there are only 40 investors',
            ],
            answer: 'That the return is described as guaranteed',
            reasoning: 'The deadline is a pressure tactic and the number of investors is neutral, but a guarantee attached to a 42.58% annual return is a claim that cannot be true: a return that size necessarily carries risk, and risk is exactly what a guarantee denies.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why the arithmetic alone shows this arrangement must fail, and name three checks a person could run before putting money into any offer. Say which of your checks would have been quickest here.',
            acceptableAnswerCriteria: [
              'Explains that with no real earnings the payouts come out of the pool itself, so the $200,000.00 is exhausted in 33.3 months and only new money postpones that.',
              'Names three concrete checks — confirming registration with the relevant authority, asking in writing where the returns come from, and refusing to act on a deadline — and identifies the registration check as the quickest.',
              'Connects the guarantee to the 42.58% figure: the size of the promised return and the certainty of it cannot both be true at once.',
            ],
            evidenceRequirements: [
              'Uses the $6,000.00 monthly payout, the 33.3-month exhaustion figure, and the 42.58% annualised return.',
            ],
            dimensions: ['error-diagnosis', 'criteria-application', 'communication-of-uncertainty'],
            lookFors: [
              'The response reasons from where the money comes from, not from the offer sounding suspicious.',
              'The response treats the deadline as a pressure device designed to prevent exactly these checks.',
            ],
            commonMisconception: 'Assessing an offer by how professional it appears rather than by asking what generates the return and whether it is registered.',
          },
        ],
      },
    ],
    remediation: 'If the arrangement looks like it could work indefinitely, ask where the $6,000.00 paid out each month comes from. Nothing was invested, so it comes from the same $200,000.00 the investors put in. Dividing one by the other gives 33.3 months, and no skill on the operator’s part changes that division.',
    extension: 'Work out how much new money would have to arrive each month to keep the payouts going without touching the original pool, and say what happens to that requirement as the number of investors grows.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l07',
    grade: 10, unit: 5, day: 7,
    actor: 'a fictional student holding three wrong beliefs about how instruments behave',
    objective: 'Test three fictional claims about recovering from a loss, bond safety, and fund size against computed figures, and locate the reasoning error in each.',
    scenario: 'The three simulated claims below were written by a fictional student for this exercise and are deliberately wrong. No real security or fund is described.',
    materials: ['calculator', 'the fictional claims in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'The fictional student’s first claim: "A share that fell from $50 to $25 lost 50%, so a 50% rise puts it back where it started." Test both halves of that sentence.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What was the percentage change on the way down, from $50 to $25?',
            given: { high: 50, low: 25 }, expr: '(low - high) / high * 100', format: 'percent2', answer: '-50.00%',
            reasoning: 'The $25 fall measured against the $50 it started from. The first half of the student’s claim is correct.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'percent',
            text: 'What percentage rise is needed to get from $25 back to $50?',
            given: { high2: 50, low2: 25 }, expr: '(high2 - low2) / low2 * 100', format: 'percent2', answer: '100.00%',
            reasoning: 'The same $25 move, but now measured against the $25 it starts from. A percentage is always relative to its base, and the base changed.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'The student’s second claim: "A bond is the safe one, so it cannot lose value." Test it on a fictional bond with a $1,000 face value paying a 3% coupon, with one year left before it repays. In this simplified model the bond’s price is the single remaining payment of face value plus coupon, discounted at the rate available on new bonds; market rates have risen to 5%. The third claim: "A fund holding more companies always charges less."',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does the fictional bond pay in coupon for its final year?',
            given: { face: 1000, coupon: 0.03 }, expr: 'face * coupon', format: 'usd', answer: '$30.00',
            reasoning: '3% of the $1,000 face value, fixed when the bond was issued and unchanged by anything the market does.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'With new bonds now paying 5%, what is this bond worth today? Round to the nearest cent.',
            given: { face2: 1000, newRate: 0.05 }, expr: 'round((face2 + #t2-p1) / (1 + newRate), 2)', format: 'usd', answer: '$980.95',
            reasoning: 'The $1,030.00 the bond will pay in a year, discounted at the 5% a buyer can now get elsewhere. A buyer will not pay face value for a 3% coupon when 5% is available.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much has the bondholder lost on paper?',
            given: { face3: 1000 }, expr: 'face3 - #t2-p2', format: 'usd', answer: '$19.05',
            reasoning: '$1,000 against $980.95. The issuer has not missed anything and will still repay in full at maturity, but selling today would realise a loss.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Under this model, what caused the bond’s price to fall?',
            choices: [
              'The issuer became less likely to repay',
              'Rates available on new bonds rose above this bond’s coupon',
              'The bond’s coupon was reduced',
            ],
            answer: 'Rates available on new bonds rose above this bond’s coupon',
            reasoning: 'Nothing about the issuer or the coupon changed; both are fixed in the scenario. The bond became less attractive only because a buyer can now get 5% elsewhere, so its price adjusted until its return matched.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Correct each of the three claims, and explain what the first two have in common as reasoning errors. For the third claim, say what actually determines a fund’s expense ratio.',
            acceptableAnswerCriteria: [
              'Corrects the first claim by identifying the changed base: a 50% fall needs a 100% rise to reverse, because the second percentage is taken on the smaller figure.',
              'Corrects the second claim by distinguishing credit risk from interest-rate risk — the issuer is still good for the money, and the $19.05 loss came from rates rising.',
              'Corrects the third claim by stating that an expense ratio is set by how the fund is managed and priced, not by how many holdings it has, so a fund with more companies can charge more or less.',
              'Identifies the shared error in the first two: assuming a single word — "50%" or "safe" — carries the same meaning in both directions or in every context.',
            ],
            evidenceRequirements: [
              'Uses the -50.00% and 100.00% figures and the $980.95 bond price.',
            ],
            dimensions: ['error-diagnosis', 'reasoning-from-figures', 'transfer'],
            lookFors: [
              'The response names the base of the percentage as what changed, rather than calling the arithmetic careless.',
              'The response recognises that "safe" is true of this bond in one sense — it will repay at maturity — and false in another.',
            ],
            commonMisconception: 'Reading a percentage move as reversible by the same percentage in the opposite direction.',
          },
        ],
      },
    ],
    remediation: 'If a 50% rise still looks like enough to recover, write both moves as fractions of where they start. Falling from $50 to $25 is $25 out of $50. Rising from $25 to $50 is $25 out of $25. The dollar move is identical and the percentages are not, because the base halved.',
    extension: 'Work out what percentage rise would be needed to recover from a 75% fall, and describe in one sentence how the required recovery behaves as the loss deepens.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l08',
    grade: 10, unit: 5, day: 8,
    actor: 'a fictional investor choosing between a percentage fee and a flat fee',
    objective: 'Transfer the expense-ratio method to a fee charged as a flat amount, find the balance at which the two pricing structures cost the same, and state which structure suits which balance.',
    scenario: 'The two simulated platforms below are invented for this exercise. Each charges only the fee described, and the balances are held constant so the comparison isolates the fee structure.',
    materials: ['calculator', 'the two fictional fee schedules in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional platform A charges 0.45% of the account balance each year. A fictional platform B charges a flat $95 a year regardless of balance. Consider a $12,000 account and a $30,000 account.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'What does platform A charge on the $12,000 account in a year?',
            given: { balSmall: 12000, pctFee: 0.0045 }, expr: 'balSmall * pctFee', format: 'usd', answer: '$54.00',
            reasoning: '0.45% of $12,000. A percentage fee scales with the balance, so it is small when the balance is small.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What does platform A charge on the $30,000 account in a year?',
            given: { balBig: 30000, pctFee2: 0.0045 }, expr: 'balBig * pctFee2', format: 'usd', answer: '$135.00',
            reasoning: '0.45% of $30,000 — two and a half times the smaller account’s fee, because the base is two and a half times larger.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'At what balance do the two platforms charge the same amount in a year? Round to the nearest cent.',
            given: { flatFee: 95, pctFee3: 0.0045 }, expr: 'round(flatFee / pctFee3, 2)', format: 'usd', answer: '$21,111.11',
            reasoning: 'The balance at which 0.45% equals the flat $95. Below it the percentage fee is cheaper; above it the flat fee is.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now hold the $30,000 balance for 10 years under each structure and compare, then check the smaller account.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'What does platform A cost on the $30,000 account over 10 years?',
            given: {}, expr: 'round(#t1-p2 * 10, 2)', format: 'usd', answer: '$1,350.00',
            reasoning: '10 years at $135.00, holding the balance constant so the structures alone are compared.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does platform B cost over the same 10 years?',
            given: { flatFee2: 95 }, expr: 'round(flatFee2 * 10, 2)', format: 'usd', answer: '$950.00',
            reasoning: '10 years at the flat $95, which does not move with the balance.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much more does the percentage fee cost on that account over the decade?',
            given: {}, expr: '#t2-p1 - #t2-p2', format: 'usd', answer: '$400.00',
            reasoning: '$1,350.00 against $950.00, on a balance well above the $21,111.11 crossover.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'On the $12,000 account, how much more does the flat fee cost than the percentage fee in one year?',
            given: { flatFee4: 95 }, expr: 'flatFee4 - #t1-p1', format: 'usd', answer: '$41.00',
            reasoning: '$95 against $54.00. On this smaller account the flat fee is the more expensive of the two by $41.00 — the reverse of the $30,000 case, where the percentage fee cost $400.00 more across the decade.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Explain why neither fee structure is cheaper in general, using the crossover balance. Then say what changes about this comparison for an investor who is adding money every year, and what that means for someone starting near the crossover.',
            acceptableAnswerCriteria: [
              'Explains that the two structures cross at $21,111.11, so which is cheaper depends entirely on the balance rather than on the structure itself.',
              'States that a growing balance moves an investor across the crossover, so a flat fee that starts out expensive becomes the cheaper option once the account passes $21,111.11.',
              'Concludes that an investor starting near the crossover should weigh the expected direction of the balance, and notes the $400.00 ten-year difference as the size of what is at stake.',
            ],
            evidenceRequirements: [
              'Uses the $21,111.11 crossover balance and both of the one-year fee comparisons.',
            ],
            dimensions: ['transfer', 'tradeoff-defense', 'plan-coherence'],
            lookFors: [
              'The response treats the crossover as the answer rather than picking a winner outright.',
              'The response recognises that the constant-balance assumption is what makes the ten-year totals simple, and that a real balance moves.',
            ],
            commonMisconception: 'Assuming a flat fee is always worse than a percentage fee because it is charged regardless of the balance.',
          },
        ],
      },
    ],
    remediation: 'If one platform looks cheaper in every case, compute both fees at both balances. At $12,000 the percentage fee is $54.00 against $95; at $30,000 it is $135.00 against the same $95. A structure that wins at one balance and loses at another has a crossover, and here it is $21,111.11.',
    extension: 'Work out which platform is cheaper over 10 years for an account that starts at $12,000 and grows by $3,000 every year, and say roughly when the ranking flips.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l09',
    grade: 10, unit: 5, day: 9,
    actor: 'a fictional investor comparing two paths with the same average annual return',
    objective: 'Compute the ending value of two fictional three-year return sequences with identical arithmetic averages, and establish that the steadier path ends higher.',
    scenario: 'The two simulated three-year return sequences below are invented for this exercise. Both are stated outcomes of a simulated period and neither is a forecast.',
    materials: ['calculator', 'the two fictional return sequences in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'Two fictional investors each start with $10,000. Portfolio P returns 20% in the first year, -10% in the second, and 8% in the third. Portfolio Q returns 6% in each of the 3 years. No money is added or withdrawn.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the average of Portfolio P’s three annual returns?',
            given: { y1: 0.2, y2: -0.1, y3: 0.08 }, expr: '(y1 + y2 + y3) / 3 * 100', format: 'percent2', answer: '6.00%',
            reasoning: '20% less 10% plus 8%, divided by 3. The two portfolios have exactly the same average annual return.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'What is Portfolio P worth after the three years? Round to the nearest cent.',
            given: { start: 10000, a: 0.2, b: -0.1, c: 0.08 }, expr: 'round(start * (1 + a) * (1 + b) * (1 + c), 2)', format: 'usd', answer: '$11,664.00',
            reasoning: 'Each year’s return applied in turn to whatever the previous year left. The order does not matter, but the multiplication does.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'What is Portfolio Q worth after the three years? Round to the nearest cent.',
            given: { start2: 10000, steady: 0.06 }, expr: 'round(start2 * pow(1 + steady, 3), 2)', format: 'usd', answer: '$11,910.16',
            reasoning: '$10,000 compounded at a steady 6% for 3 years — the same average return, delivered without the swing.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'independent',
        directions: 'Now measure the gap the swing created.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'USD',
            text: 'How much more does the steadier portfolio end with?',
            given: {}, expr: '#t1-p3 - #t1-p2', format: 'usd', answer: '$246.16',
            reasoning: '$11,910.16 against $11,664.00, from identical starting amounts and identical average annual returns.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'How much did Portfolio P actually gain over the three years?',
            given: { start3: 10000 }, expr: '#t1-p2 - start3', format: 'usd', answer: '$1,664.00',
            reasoning: '$11,664.00 against the $10,000 started with.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'How much did Portfolio Q gain?',
            given: { start4: 10000 }, expr: '#t1-p3 - start4', format: 'usd', answer: '$1,910.16',
            reasoning: '$11,910.16 against the same $10,000. The gain is nearly 15% larger from the same average return.',
          },
          {
            ref: 't2-p4', kind: 'choice',
            text: 'Why does Portfolio P end lower despite having the same average annual return?',
            choices: [
              'Because its average was computed incorrectly',
              'Because the -10% year removed money that the later gain had to rebuild before it could add anything',
              'Because three years is too short a period to compare',
            ],
            answer: 'Because the -10% year removed money that the later gain had to rebuild before it could add anything',
            reasoning: 'The average is correct at 6.00%, and the period is the same for both. The loss year shrank the base that every later return applies to, and recovering a percentage loss takes a larger percentage gain, as the previous lesson established.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Both portfolios averaged 6.00% a year and ended $246.16 apart. Explain what this shows about reading an advertised average return, and connect it to why an investor might accept a lower expected return in exchange for a steadier one.',
            acceptableAnswerCriteria: [
              'Explains that an arithmetic average of annual returns does not determine the ending value, because returns multiply rather than add, so a swing costs money even when the average is unchanged.',
              'Connects this to the choice between portfolios: a steadier path can end higher than a more volatile one with the same average, which is a reason to value steadiness rather than merely a preference for comfort.',
              'Notes that this comparison is a stated outcome of one simulated three-year period, so it demonstrates the mechanism rather than predicting which real portfolio would win.',
            ],
            evidenceRequirements: [
              'Uses the 6.00% average shared by both, the $11,664.00 and $11,910.16 ending values, and the $246.16 gap.',
            ],
            dimensions: ['reasoning-from-figures', 'communication-of-uncertainty', 'transfer'],
            lookFors: [
              'The response identifies multiplication of returns as the mechanism rather than describing losses as psychologically worse.',
              'The response does not conclude that steadier is always better; it concludes that the average alone does not settle it.',
            ],
            commonMisconception: 'Treating an average annual return as sufficient to determine what an investment ends up worth.',
          },
        ],
      },
    ],
    remediation: 'If both portfolios are expected to end at the same value, notice that returns are applied one after another to a changing balance. Portfolio P’s 8% in year three is applied to what the -10% year left, not to the original $10,000. Multiply the three factors in turn rather than adding the percentages.',
    extension: 'Construct a three-year sequence that also averages 6.00% but ends lower than $11,664.00, and describe what you had to do to the swing to achieve it.',
  },

  {
    lessonId: 'ma-g10-financial-literacy-u05-l10',
    grade: 10, unit: 5, day: 10,
    actor: 'a fictional investor building and defending one allocation for a stated goal',
    objective: 'Build a fictional diversified allocation to a stated goal and horizon, compute its weighted expense ratio and the dollar cost of the fee, and name the risk each part of the allocation accepts.',
    scenario: 'The four simulated vehicles below are invented for this exercise, as is the goal and horizon the allocation is built for. Nothing here is a recommendation to any real person about their own money.',
    materials: ['calculator', 'the fictional vehicle disclosures in these directions'],
    tasks: [
      {
        taskId: 't1', kind: 'guided',
        directions: 'A fictional investor allocates $15,000 for a stated goal 15 years away, across four simulated vehicles: 40% to a broad domestic stock index fund with an expense ratio of 0.05%, 25% to an international stock index fund at 0.24%, 30% to a bond index fund at 0.10%, and 5% to a cash reserve at 0.00%.',
        items: [
          {
            ref: 't1-p1', kind: 'numeric', unit: 'USD',
            text: 'How much goes into the broad domestic stock index fund?',
            given: { total: 15000, wBroad: 0.4 }, expr: 'total * wBroad', format: 'usd', answer: '$6,000.00',
            reasoning: '40% of the $15,000 allocated. This is the largest single holding and carries most of the allocation’s exposure to shares.',
          },
          {
            ref: 't1-p2', kind: 'numeric', unit: 'USD',
            text: 'How much goes into the international stock index fund?',
            given: { total2: 15000, wIntl: 0.25 }, expr: 'total2 * wIntl', format: 'usd', answer: '$3,750.00',
            reasoning: '25% of the $15,000, spreading share exposure beyond a single country’s market.',
          },
          {
            ref: 't1-p3', kind: 'numeric', unit: 'USD',
            text: 'How much goes into the bond index fund?',
            given: { total3: 15000, wBond: 0.3 }, expr: 'total3 * wBond', format: 'usd', answer: '$4,500.00',
            reasoning: '30% of the $15,000, in an asset class that behaves differently from shares.',
          },
          {
            ref: 't1-p4', kind: 'numeric', unit: 'USD',
            text: 'How much goes into the cash reserve?',
            given: { total4: 15000, wCash: 0.05 }, expr: 'total4 * wCash', format: 'usd', answer: '$750.00',
            reasoning: '5% of the $15,000, held so that a need for money does not force a sale of the other three at whatever price is available that day.',
          },
        ],
      },
      {
        taskId: 't2', kind: 'performance-task',
        directions: 'Now price the allocation. The weighted expense ratio is each vehicle’s ratio multiplied by its share of the allocation, summed. Compare it with a fictional managed alternative that charges 1.15% of the balance each year.',
        items: [
          {
            ref: 't2-p1', kind: 'numeric', unit: 'percent',
            text: 'What is the weighted expense ratio of the whole allocation?',
            given: { wBroad2: 0.4, erBroad: 0.05, wIntl2: 0.25, erIntl: 0.24, wBond2: 0.3, erBond: 0.1, wCash2: 0.05, erCash: 0 },
            expr: 'wBroad2*erBroad + wIntl2*erIntl + wBond2*erBond + wCash2*erCash', format: 'percent2', answer: '0.11%',
            reasoning: 'Each ratio weighted by its share of the allocation. The international fund carries the highest ratio but only a quarter of the money, so it contributes 0.06 percentage points of the total — more than any other holding, despite not being the largest.',
          },
          {
            ref: 't2-p2', kind: 'numeric', unit: 'USD',
            text: 'What does that cost in dollars in the first year? Round to the nearest cent.',
            given: { total5: 15000 }, expr: 'round(total5 * (#t2-p1 / 100), 2)', format: 'usd', answer: '$16.50',
            reasoning: '0.11% of the $15,000 allocated, charged inside the funds rather than billed separately.',
          },
          {
            ref: 't2-p3', kind: 'numeric', unit: 'USD',
            text: 'What would the fictional managed alternative cost on the same balance in a year?',
            given: { total6: 15000, advisedEr: 0.0115 }, expr: 'total6 * advisedEr', format: 'usd', answer: '$172.50',
            reasoning: '1.15% of the same $15,000 balance, charged annually on the balance rather than on the amount originally allocated.',
          },
          {
            ref: 't2-p4', kind: 'numeric', unit: 'USD',
            text: 'What is the annual difference between the two?',
            given: {}, expr: '#t2-p3 - #t2-p2', format: 'usd', answer: '$156.00',
            reasoning: '$172.50 against $16.50. Applying the method from earlier in the unit, a gap of this size held over 15 years costs far more than 15 times $156.00.',
          },
        ],
      },
      {
        taskId: 't3', kind: 'reflection',
        directions: 'Answer in a few sentences, using the figures you computed.',
        items: [
          {
            ref: 't3-p1', kind: 'judgment', length: 'extended',
            text: 'Defend this allocation for a goal 15 years away in four sentences: what each of the four parts is there to do, what risk each one accepts, what the whole thing costs, and what would have to be true for the managed alternative’s extra $156.00 a year to be worth paying.',
            acceptableAnswerCriteria: [
              'Assigns a purpose to each of the four holdings and names the risk it accepts — share funds accept market declines, the international fund adds exposure to other countries and currencies, bonds accept rate risk, and cash accepts losing ground to inflation.',
              'States the total cost accurately at 0.11% and $16.50 in the first year, and contrasts it with the $172.50 alternative.',
              'States the condition for the managed alternative honestly: it would have to add more than $156.00 a year of value after its own fee, and says how an investor could tell in advance, or that they largely cannot.',
              'Ties the allocation to the stated 15-year horizon rather than defending it in the abstract.',
            ],
            evidenceRequirements: [
              'Uses at least three of the four dollar allocations, the 0.11% weighted ratio, and the $156.00 annual difference.',
            ],
            dimensions: ['plan-coherence', 'tradeoff-defense', 'communication-of-uncertainty', 'criteria-application'],
            lookFors: [
              'The response names a distinct risk for each holding rather than calling the whole allocation "risky" or "safe".',
              'The response does not present the allocation as correct for any real person, and does not claim the horizon guarantees an outcome.',
            ],
            commonMisconception: 'Treating an allocation as complete once the percentages are chosen, without pricing it or naming what each part is exposed to.',
          },
        ],
      },
    ],
    remediation: 'If the weighted expense ratio comes out as 0.39%, the four ratios are being added without their weights. The international fund’s 0.24% applies to only a quarter of the money and the cash reserve’s 0.00% applies to a twentieth. Multiply each ratio by its share before adding, which gives 0.11%.',
    extension: 'Recompute the weighted expense ratio if the international share rises to 40% and the broad domestic share falls to 25%, and say whether the change in cost is large enough to matter against the reason for making it.',
  },
]
