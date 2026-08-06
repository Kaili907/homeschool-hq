import type { FixedTest } from '../types'
import type { Blueprint } from './placementModel'

// CE3 — Grade 6 beginning-of-year mathematics placement.
//
// 34 items, four sections, roughly 45 minutes untimed. Every item is original.
// Tier meaning: foundation = Grade 5 prerequisite · current = Grade 6 start ·
// stretch = Grade 7 readiness signal. The three tiers are exactly the Grade 5 /
// Grade 6 / Grade 7 readiness question this session asked for.

export const ELE_MATH_G6: FixedTest = {
  id: 'ele-math-g6',
  title: 'Grade 6 Mathematics — Beginning-of-Year Placement',
  forGrades: ['6'],
  scratchReminder: true,
  intro:
    'This assessment is not graded and nothing from it goes on a report. Its whole job is to ' +
    'show where your math year should start, so you are not repeating what you already own or ' +
    'drowning in what you have never been taught. Some questions are Grade 5 review, most are ' +
    'Grade 6, and a few are Grade 7 — nobody is expected to finish every one. If you do not ' +
    'know how to begin, press SKIP. A skip shows a real gap; a guess hides it. No timer. Paper ' +
    'and pencil are fine.',
  sections: [
    {
      name: 'Section 1 — Whole Numbers, Fractions and Decimals',
      items: [
        { id: 'e6m01', kind: 'numeric', prompt: '324 × 27 = ?', key: '8748', keyNote: '8,748.' },
        { id: 'e6m02', kind: 'numeric', prompt: '912 ÷ 8 = ?', key: '114', keyNote: '114.' },
        {
          id: 'e6m03',
          kind: 'text',
          prompt: '2/3 + 1/4 = ?  Write your answer as a fraction.',
          key: '11/12',
          keyNote: '11/12.',
        },
        { id: 'e6m04', kind: 'numeric', prompt: '4.6 − 1.75 = ?', key: '2.85', keyNote: '2.85.' },
        {
          id: 'e6m05',
          kind: 'text',
          prompt:
            '3/4 ÷ 1/2 = ?  Write your answer as a fraction, a mixed number, or a decimal.',
          key: '3/2',
          keyNote: '3/2, which is the same as 1 1/2 or 1.5 — all three score.',
        },
        { id: 'e6m06', kind: 'numeric', prompt: '1,908 ÷ 12 = ?', key: '159', keyNote: '159.' },
        { id: 'e6m07', kind: 'numeric', prompt: '7.2 × 0.5 = ?', key: '3.6', keyNote: '3.6.' },
        { id: 'e6m08', kind: 'numeric', prompt: '9.36 ÷ 0.4 = ?', key: '23.4', keyNote: '23.4.' },
        {
          id: 'e6m09',
          kind: 'numeric',
          prompt: 'What is the greatest common factor of 24 and 36?',
          key: '12',
          keyNote: '12.',
        },
        {
          id: 'e6m10',
          kind: 'text',
          prompt: '−3/4 + 1/2 = ?  Write your answer as a fraction or a decimal.',
          key: '-1/4',
          keyNote: '−1/4 (or −0.25). Grade 7 signal.',
        },
      ],
    },
    {
      name: 'Section 2 — Ratios, Rates and Percent',
      items: [
        {
          id: 'e6m11',
          kind: 'text',
          prompt: '2/3 × 3/5 = ?  Write your answer as a fraction in simplest form.',
          key: '2/5',
          keyNote: '2/5. An unsimplified 6/15 is the same number and also scores.',
        },
        {
          id: 'e6m12',
          kind: 'choice',
          prompt:
            'A basket holds 8 apples and 12 oranges. Which is the ratio of apples to oranges in simplest form?',
          choices: ['2:3', '3:2', '8:12', '4:6'],
          key: '2:3',
          keyNote: '2:3. 8:12 and 4:6 are the same ratio but are not in simplest form.',
        },
        {
          id: 'e6m13',
          kind: 'numeric',
          prompt: 'A car travels 180 miles in 3 hours. What is its speed, in miles per hour?',
          key: '60',
          keyNote: '60 mph — a unit rate.',
        },
        {
          id: 'e6m14',
          kind: 'numeric',
          prompt: 'If 4 notebooks cost $10, how much do 10 notebooks cost, in dollars?',
          key: '25',
          keyNote: '$25.',
        },
        { id: 'e6m15', kind: 'numeric', prompt: 'What is 25% of 80?', key: '20', keyNote: '20.' },
        {
          id: 'e6m16',
          kind: 'numeric',
          prompt: '12 is what percent of 48? Write just the number.',
          key: '25',
          keyNote: '25 (percent).',
        },
        {
          id: 'e6m17',
          kind: 'numeric',
          prompt:
            'A recipe uses 3 cups of flour for every 2 cups of milk. How many cups of flour are needed for 9 cups of milk?',
          key: '13.5',
          keyNote: '13.5 cups (13 1/2 also scores). Grade 7 signal.',
        },
        {
          id: 'e6m18',
          kind: 'numeric',
          prompt: 'A $40 jacket is marked down 15%. What is the sale price, in dollars?',
          key: '34',
          keyNote: '$34. Grade 7 signal — answering 6 gives the discount, not the price.',
        },
      ],
    },
    {
      name: 'Section 3 — Integers and the Coordinate Plane',
      items: [
        {
          id: 'e6m19',
          kind: 'text',
          prompt:
            'Start at the origin. Move 4 units right and 2 units up. Write the ordered pair ' +
            '(x, y) for where you land, in the form (1, 6).',
          key: '(4,2)',
          keyNote:
            '(4, 2). Spaces do not matter. CE3-C: this item moved UP rather than down. It is ' +
            'tagged 5.G.A.1 and sits in the foundation tier, which is Grade 5 first-quadrant ' +
            'plotting; the earlier version landed on (4, −2) in Quadrant IV, which is Grade 6 ' +
            'signed-coordinate work and does not belong in a prerequisite band. Signed ' +
            'coordinates are still sampled at Grade 6 level by e6m23 and e6m24.',
        },
        {
          id: 'e6m20',
          kind: 'choice',
          prompt: 'Which sign makes this true?\n\n−8 ___ −3',
          choices: ['<', '>', '='],
          key: '<',
          keyNote: '< because −8 is further left on the number line.',
        },
        {
          id: 'e6m21',
          kind: 'numeric',
          prompt: 'What is the absolute value of −12? Write it as a number.',
          key: '12',
          keyNote: '12.',
        },
        {
          id: 'e6m22',
          kind: 'choice',
          prompt: 'Which number is FARTHER from 0 on a number line?',
          choices: ['−7', '5', 'they are the same distance'],
          key: '−7',
          keyNote: '−7, because its distance from 0 is 7. Tests order versus magnitude.',
        },
        {
          id: 'e6m23',
          kind: 'choice',
          prompt: 'In which quadrant is the point (−4, 3)?',
          choices: ['I', 'II', 'III', 'IV'],
          key: 'II',
          keyNote: 'Quadrant II (left of the y-axis, above the x-axis).',
        },
        {
          id: 'e6m24',
          kind: 'numeric',
          prompt: 'Point A is at (2, 7) and point B is at (2, −3). How many units apart are they?',
          key: '10',
          keyNote: '10 units.',
        },
        {
          id: 'e6m25',
          kind: 'numeric',
          prompt: '−6 − (−9) = ?',
          key: '3',
          keyNote: '3. Grade 7 signal.',
        },
      ],
    },
    {
      name: 'Section 4 — Expressions, Equations and Statistics',
      items: [
        { id: 'e6m26', kind: 'numeric', prompt: '3 + 4 × 5 = ?', key: '23', keyNote: '23 — order of operations. An answer of 35 means left-to-right.' },
        {
          id: 'e6m27',
          kind: 'numeric',
          prompt: 'What is the value of 2³ (two to the third power)?',
          key: '8',
          keyNote: '8. An answer of 6 means 2 × 3.',
        },
        {
          id: 'e6m28',
          kind: 'numeric',
          prompt: 'Evaluate 4x + 7 when x = 5.',
          key: '27',
          keyNote: '27.',
        },
        { id: 'e6m29', kind: 'numeric', prompt: 'Solve for x:  x + 14 = 31', key: '17', keyNote: 'x = 17.' },
        { id: 'e6m30', kind: 'numeric', prompt: 'Solve for x:  6x = 54', key: '9', keyNote: 'x = 9.' },
        {
          id: 'e6m31',
          kind: 'numeric',
          prompt: 'Find the mean (average) of 4, 8, 9, 11, 13.',
          key: '9',
          keyNote: '9 (45 ÷ 5).',
        },
        {
          id: 'e6m32',
          kind: 'numeric',
          prompt: 'Find the median of 3, 7, 2, 9, 5.',
          key: '5',
          keyNote: '5 — the values must be ordered first.',
        },
        {
          id: 'e6m33',
          kind: 'numeric',
          prompt: 'Solve for x:  3x − 5 = 16',
          key: '7',
          keyNote: 'x = 7. Grade 7 signal (two-step equation).',
        },
        {
          id: 'e6m34',
          kind: 'longtext',
          prompt:
            'A student says: "The average score on our spelling tests was 90, so everyone did ' +
            'about the same." Explain why the average alone does not show that, and say what ' +
            'else you would want to know about the scores.',
          keyNote:
            'RUBRIC ITEM (0–4). Scored by a grown-up against the Grade 6 rubric in the scoring ' +
            'guide. Look for the idea that a mean hides spread, plus a request for the range, ' +
            'the individual scores, or how spread out they are.',
        },
      ],
    },
  ],
}

/** Answer authority + skill tags for every scored item. Weight is 1 throughout. */
export const ELE_MATH_G6_BLUEPRINT: Blueprint = {
  e6m01: { tier: 'foundation', domain: 'Whole-number operations', standard: '5.NBT.B.5 — multiply multi-digit numbers', weight: 1, mode: 'auto' },
  e6m02: { tier: 'foundation', domain: 'Whole-number operations', standard: '5.NBT.B.6 — divide by a one-digit divisor', weight: 1, mode: 'auto' },
  e6m06: { tier: 'current', domain: 'Whole-number operations', standard: '6.NS.B.2 — divide by a two-digit divisor', weight: 1, mode: 'auto' },
  e6m09: { tier: 'current', domain: 'Whole-number operations', standard: '6.NS.B.4 — greatest common factor', weight: 1, mode: 'auto' },

  e6m03: { tier: 'foundation', domain: 'Fractions and decimals', standard: '5.NF.A.1 — add unlike denominators', weight: 1, mode: 'auto' },
  e6m04: { tier: 'foundation', domain: 'Fractions and decimals', standard: '5.NBT.B.7 — subtract decimals', weight: 1, mode: 'auto' },
  e6m11: { tier: 'foundation', domain: 'Fractions and decimals', standard: '5.NF.B.4 — multiply fractions', weight: 1, mode: 'auto' },
  e6m05: { tier: 'current', domain: 'Fractions and decimals', standard: '6.NS.A.1 — divide a fraction by a fraction', weight: 1, mode: 'auto' },
  e6m07: { tier: 'current', domain: 'Fractions and decimals', standard: '6.NS.B.3 — multiply decimals', weight: 1, mode: 'auto' },
  e6m08: { tier: 'current', domain: 'Fractions and decimals', standard: '6.NS.B.3 — divide decimals', weight: 1, mode: 'auto' },
  e6m10: { tier: 'stretch', domain: 'Fractions and decimals', standard: '7.NS.A.1 — add signed rational numbers', weight: 1, mode: 'auto' },

  e6m12: { tier: 'current', domain: 'Ratios, rates and percent', standard: '6.RP.A.1 — ratio language', weight: 1, mode: 'auto' },
  e6m13: { tier: 'current', domain: 'Ratios, rates and percent', standard: '6.RP.A.2 — unit rate', weight: 1, mode: 'auto' },
  e6m14: { tier: 'current', domain: 'Ratios, rates and percent', standard: '6.RP.A.3a — equivalent ratios', weight: 1, mode: 'auto' },
  e6m15: { tier: 'current', domain: 'Ratios, rates and percent', standard: '6.RP.A.3c — percent of a quantity', weight: 1, mode: 'auto' },
  e6m16: { tier: 'current', domain: 'Ratios, rates and percent', standard: '6.RP.A.3c — find the percent', weight: 1, mode: 'auto' },
  e6m17: { tier: 'stretch', domain: 'Ratios, rates and percent', standard: '7.RP.A.2 — proportional relationships', weight: 1, mode: 'auto' },
  e6m18: { tier: 'stretch', domain: 'Ratios, rates and percent', standard: '7.RP.A.3 — percent increase and decrease', weight: 1, mode: 'auto' },

  e6m20: { tier: 'current', domain: 'Integers', standard: '6.NS.C.7a — order negative numbers', weight: 1, mode: 'auto' },
  e6m21: { tier: 'current', domain: 'Integers', standard: '6.NS.C.7c — absolute value', weight: 1, mode: 'auto' },
  e6m22: { tier: 'current', domain: 'Integers', standard: '6.NS.C.7c — magnitude versus order', weight: 1, mode: 'auto' },
  e6m25: { tier: 'stretch', domain: 'Integers', standard: '7.NS.A.1c — subtract signed numbers', weight: 1, mode: 'auto' },

  e6m19: { tier: 'foundation', domain: 'Coordinate plane', standard: '5.G.A.1 — plot in the first quadrant', weight: 1, mode: 'auto' },
  e6m23: { tier: 'current', domain: 'Coordinate plane', standard: '6.NS.C.6b — signed coordinates and quadrants', weight: 1, mode: 'auto' },
  e6m24: { tier: 'current', domain: 'Coordinate plane', standard: '6.NS.C.8 — distance on a coordinate grid', weight: 1, mode: 'auto' },

  e6m26: { tier: 'foundation', domain: 'Expressions and equations', standard: '5.OA.A.1 — order of operations', weight: 1, mode: 'auto' },
  e6m27: { tier: 'current', domain: 'Expressions and equations', standard: '6.EE.A.1 — whole-number exponents', weight: 1, mode: 'auto' },
  e6m28: { tier: 'current', domain: 'Expressions and equations', standard: '6.EE.A.2c — evaluate an expression', weight: 1, mode: 'auto' },
  e6m29: { tier: 'current', domain: 'Expressions and equations', standard: '6.EE.B.7 — solve x + p = q', weight: 1, mode: 'auto' },
  e6m30: { tier: 'current', domain: 'Expressions and equations', standard: '6.EE.B.7 — solve px = q', weight: 1, mode: 'auto' },
  e6m33: { tier: 'stretch', domain: 'Expressions and equations', standard: '7.EE.B.4a — solve a two-step equation', weight: 1, mode: 'auto' },

  e6m31: { tier: 'current', domain: 'Statistics', standard: '6.SP.B.5c — mean', weight: 1, mode: 'auto' },
  e6m32: { tier: 'current', domain: 'Statistics', standard: '6.SP.B.5c — median', weight: 1, mode: 'auto' },
  e6m34: { tier: 'current', domain: 'Statistics', standard: '6.SP.A.2 — centre versus spread, explained', weight: 1, mode: 'rubric', rubricPoints: 4 },
}

export const ELE_MATH_G6_DOMAINS: readonly string[] = [
  'Whole-number operations',
  'Fractions and decimals',
  'Ratios, rates and percent',
  'Integers',
  'Coordinate plane',
  'Expressions and equations',
  'Statistics',
]
