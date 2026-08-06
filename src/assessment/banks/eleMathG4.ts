import type { FixedTest } from '../types'
import type { Blueprint } from './placementModel'

// CE3 — Grade 4 beginning-of-year mathematics placement.
//
// 33 items, four sections, roughly 40 minutes untimed. Every item is original.
// Tier meaning: foundation = Grade 3 prerequisite · current = Grade 4 start ·
// stretch = Grade 5 readiness signal.

export const ELE_MATH_G4: FixedTest = {
  id: 'ele-math-g4',
  title: 'Grade 4 Mathematics — Beginning-of-Year Placement',
  forGrades: ['4'],
  scratchReminder: true,
  intro:
    'This is not a test you can fail, and no score from it goes on any report. It shows a ' +
    'grown-up where to start teaching you this year. Some questions are review from last year ' +
    'and a few are from next year — nobody is expected to get all of them. If you do not know ' +
    'how to begin a question, press SKIP; that is honest and it helps. There is no timer, and ' +
    'you may use paper and pencil.',
  sections: [
    {
      name: 'Section 1 — Place Value and Whole Numbers',
      items: [
        { id: 'e4m01', kind: 'numeric', prompt: 'Round 468 to the nearest ten.', key: '470', keyNote: '470.' },
        { id: 'e4m02', kind: 'numeric', prompt: '703 − 358 = ?', key: '345', keyNote: '345 (subtracting across a zero).' },
        {
          id: 'e4m03',
          kind: 'numeric',
          prompt: 'In the number 26,481, what is the VALUE of the digit 6?',
          key: '6000',
          keyNote: '6,000. An answer of 6 gives the digit, not its value.',
        },
        {
          id: 'e4m04',
          kind: 'numeric',
          prompt:
            'The 4 in 4,000 is worth how many times as much as the 4 in 400? Write the number of times.',
          key: '10',
          keyNote: '10 times.',
        },
        { id: 'e4m05', kind: 'numeric', prompt: 'Round 27,486 to the nearest thousand.', key: '27000', keyNote: '27,000.' },
        { id: 'e4m06', kind: 'numeric', prompt: '18,406 + 7,295 = ?', key: '25701', keyNote: '25,701.' },
        {
          id: 'e4m07',
          kind: 'choice',
          prompt: 'Which number is greater?',
          choices: ['0.4', '0.35', 'they are equal'],
          key: '0.4',
          keyNote: '0.4. Grade 5 signal — choosing 0.35 usually means "more digits means bigger".',
        },
      ],
    },
    {
      name: 'Section 2 — Multiplication and Division',
      items: [
        { id: 'e4m08', kind: 'numeric', prompt: '9 × 7 = ?', key: '63', keyNote: '63.' },
        { id: 'e4m09', kind: 'numeric', prompt: '56 ÷ 8 = ?', key: '7', keyNote: '7.' },
        {
          id: 'e4m10',
          kind: 'numeric',
          prompt: 'Ben had 8 packs of markers with 6 markers in each pack. He gave away 10 markers. How many markers does he have left?',
          key: '38',
          keyNote: '38 (8 × 6 = 48, then 48 − 10).',
        },
        { id: 'e4m11', kind: 'numeric', prompt: '34 × 6 = ?', key: '204', keyNote: '204.' },
        { id: 'e4m12', kind: 'numeric', prompt: '23 × 15 = ?', key: '345', keyNote: '345 (two-digit by two-digit).' },
        { id: 'e4m13', kind: 'numeric', prompt: '96 ÷ 4 = ?', key: '24', keyNote: '24.' },
        {
          id: 'e4m14',
          kind: 'numeric',
          prompt: '87 pencils are packed 5 to a box. How many FULL boxes can be packed?',
          key: '17',
          keyNote: '17 full boxes.',
        },
        {
          id: 'e4m15',
          kind: 'numeric',
          prompt: 'Using those same 87 pencils packed 5 to a box, how many pencils are left over?',
          key: '2',
          keyNote: '2 left over. Scored separately from e4m14 so a correct quotient still counts when the remainder is missed.',
        },
        {
          id: 'e4m16',
          kind: 'numeric',
          prompt: '216 × 34 = ?',
          key: '7344',
          keyNote: '7,344. Grade 5 signal — not knowing it is expected.',
        },
      ],
    },
    {
      name: 'Section 3 — Fractions and Decimals',
      items: [
        {
          id: 'e4m17',
          kind: 'choice',
          prompt: 'Which fraction is larger?',
          choices: ['3/4', '1/4', 'they are equal'],
          key: '3/4',
          keyNote: '3/4.',
        },
        {
          id: 'e4m18',
          kind: 'numeric',
          prompt: 'Fill in the missing number:\n\n2/3 = ? /12',
          key: '8',
          keyNote: '8, because 2/3 = 8/12.',
        },
        {
          id: 'e4m19',
          kind: 'choice',
          prompt: 'Which sign makes this true?\n\n3/5 ___ 2/3',
          choices: ['<', '>', '='],
          key: '<',
          keyNote: '< because 3/5 = 0.6 and 2/3 ≈ 0.67.',
        },
        {
          id: 'e4m20',
          kind: 'text',
          prompt: '3/8 + 2/8 = ?  Write your answer as a fraction.',
          key: '5/8',
          keyNote: '5/8.',
        },
        {
          id: 'e4m21',
          kind: 'text',
          prompt: '2 1/4 + 1 1/4 = ?  Write your answer as a mixed number or a decimal.',
          key: '3 1/2',
          keyNote: '3 1/2 (3.5 is accepted).',
        },
        {
          id: 'e4m22',
          kind: 'text',
          prompt:
            '5 × 2/3 = ?  Write your answer as a fraction or a mixed number (for example 7/2 or 3 1/2).',
          key: '10/3',
          keyNote:
            '10/3, which is the same as 3 1/3. A rounded decimal such as 3.33 is not equal to 10/3 ' +
            'and does not score; the prompt asks for a fraction or mixed number.',
        },
        {
          id: 'e4m23',
          kind: 'text',
          prompt: 'Write 3/10 as a decimal.',
          key: '0.3',
          keyNote: '0.3.',
        },
        {
          id: 'e4m24',
          kind: 'text',
          prompt: '1/2 + 1/4 = ?  Write your answer as a fraction.',
          key: '3/4',
          keyNote: '3/4. Grade 5 signal (unlike denominators).',
        },
        {
          id: 'e4m25',
          kind: 'numeric',
          prompt: '0.6 + 0.25 = ?',
          key: '0.85',
          keyNote: '0.85. Grade 5 signal.',
        },
      ],
    },
    {
      name: 'Section 4 — Measurement, Geometry and Multi-Step Problems',
      items: [
        {
          id: 'e4m26',
          kind: 'numeric',
          prompt: 'A rectangle is 8 cm long and 3 cm wide. What is its area, in square centimetres?',
          key: '24',
          keyNote: '24 square cm.',
        },
        { id: 'e4m27', kind: 'numeric', prompt: 'How many centimetres are in 4 metres?', key: '400', keyNote: '400 cm.' },
        {
          id: 'e4m28',
          kind: 'numeric',
          prompt:
            'A rectangle has an area of 48 square feet. Its length is 8 feet. What is its width, in feet?',
          key: '6',
          keyNote: '6 feet — working backwards from area.',
        },
        {
          id: 'e4m29',
          kind: 'choice',
          prompt: 'Two straight lines that never cross and always stay the same distance apart are called:',
          choices: ['parallel', 'perpendicular', 'intersecting', 'curved'],
          key: 'parallel',
          keyNote: 'Parallel.',
        },
        {
          id: 'e4m30',
          kind: 'choice',
          prompt: 'An angle that measures exactly 90° is called:',
          choices: ['acute', 'right', 'obtuse', 'straight'],
          key: 'right',
          keyNote: 'A right angle.',
        },
        {
          id: 'e4m31',
          kind: 'numeric',
          prompt:
            'A class of 26 students is going to a museum. Tickets cost $8 each and the bus costs $75. What is the total cost, in dollars?',
          key: '283',
          keyNote: '$283 (26 × 8 = 208, then + 75).',
        },
        {
          id: 'e4m32',
          kind: 'numeric',
          prompt: 'A book costs $12.50. How much do 4 books cost, in dollars?',
          key: '50',
          keyNote: '$50. Grade 5 signal (decimal multiplication).',
        },
        {
          id: 'e4m33',
          kind: 'longtext',
          prompt:
            'When you finish a word problem that took two steps, how can you check whether your ' +
            'answer makes sense? Explain your method and use one example.',
          keyNote:
            'RUBRIC ITEM (0–3). Scored by a grown-up against the Grade 4 rubric in the scoring ' +
            'guide. Look for estimation, re-reading the question, or working backwards — not for ' +
            'the phrase "check your work".',
        },
      ],
    },
  ],
}

/** Answer authority + skill tags for every scored item. Weight is 1 throughout. */
export const ELE_MATH_G4_BLUEPRINT: Blueprint = {
  e4m01: { tier: 'foundation', domain: 'Place value and whole numbers', standard: '3.NBT.A.1 — round to the nearest 10', weight: 1, mode: 'auto' },
  e4m02: { tier: 'foundation', domain: 'Place value and whole numbers', standard: '3.NBT.A.2 — subtract within 1000', weight: 1, mode: 'auto' },
  e4m03: { tier: 'current', domain: 'Place value and whole numbers', standard: '4.NBT.A.2 — multi-digit place value', weight: 1, mode: 'auto' },
  e4m04: { tier: 'current', domain: 'Place value and whole numbers', standard: '4.NBT.A.1 — a digit is ten times the place to its right', weight: 1, mode: 'auto' },
  e4m05: { tier: 'current', domain: 'Place value and whole numbers', standard: '4.NBT.A.3 — round multi-digit numbers', weight: 1, mode: 'auto' },
  e4m06: { tier: 'current', domain: 'Place value and whole numbers', standard: '4.NBT.B.4 — add multi-digit numbers', weight: 1, mode: 'auto' },
  e4m07: { tier: 'stretch', domain: 'Place value and whole numbers', standard: '5.NBT.A.3b — compare decimals', weight: 1, mode: 'auto' },

  e4m08: { tier: 'foundation', domain: 'Multiplication and division', standard: '3.OA.C.7 — multiplication facts', weight: 1, mode: 'auto' },
  e4m09: { tier: 'foundation', domain: 'Multiplication and division', standard: '3.OA.C.7 — division facts', weight: 1, mode: 'auto' },
  e4m11: { tier: 'current', domain: 'Multiplication and division', standard: '4.NBT.B.5 — two-digit by one-digit', weight: 1, mode: 'auto' },
  e4m12: { tier: 'current', domain: 'Multiplication and division', standard: '4.NBT.B.5 — two-digit by two-digit', weight: 1, mode: 'auto' },
  e4m13: { tier: 'current', domain: 'Multiplication and division', standard: '4.NBT.B.6 — divide within 100', weight: 1, mode: 'auto' },
  e4m14: { tier: 'current', domain: 'Multiplication and division', standard: '4.NBT.B.6 — quotient with a remainder', weight: 1, mode: 'auto' },
  e4m15: { tier: 'current', domain: 'Multiplication and division', standard: '4.OA.A.3 — interpret the remainder', weight: 1, mode: 'auto' },
  e4m16: { tier: 'stretch', domain: 'Multiplication and division', standard: '5.NBT.B.5 — three-digit by two-digit', weight: 1, mode: 'auto' },

  e4m17: { tier: 'foundation', domain: 'Fraction equivalence and comparison', standard: '3.NF.A.3d — compare fractions', weight: 1, mode: 'auto' },
  e4m18: { tier: 'current', domain: 'Fraction equivalence and comparison', standard: '4.NF.A.1 — equivalent fractions', weight: 1, mode: 'auto' },
  e4m19: { tier: 'current', domain: 'Fraction equivalence and comparison', standard: '4.NF.A.2 — compare unlike fractions', weight: 1, mode: 'auto' },
  e4m23: { tier: 'current', domain: 'Fraction equivalence and comparison', standard: '4.NF.C.6 — fractions as decimals', weight: 1, mode: 'auto' },

  e4m20: { tier: 'current', domain: 'Fraction and decimal operations', standard: '4.NF.B.3a — add like denominators', weight: 1, mode: 'auto' },
  e4m21: { tier: 'current', domain: 'Fraction and decimal operations', standard: '4.NF.B.3c — add mixed numbers', weight: 1, mode: 'auto' },
  e4m22: { tier: 'current', domain: 'Fraction and decimal operations', standard: '4.NF.B.4b — multiply a fraction by a whole number', weight: 1, mode: 'auto' },
  e4m24: { tier: 'stretch', domain: 'Fraction and decimal operations', standard: '5.NF.A.1 — add unlike denominators', weight: 1, mode: 'auto' },
  e4m25: { tier: 'stretch', domain: 'Fraction and decimal operations', standard: '5.NBT.B.7 — add decimals', weight: 1, mode: 'auto' },

  e4m26: { tier: 'foundation', domain: 'Measurement', standard: '3.MD.C.7 — area of a rectangle', weight: 1, mode: 'auto' },
  e4m27: { tier: 'current', domain: 'Measurement', standard: '4.MD.A.1 — convert measurement units', weight: 1, mode: 'auto' },
  e4m28: { tier: 'current', domain: 'Measurement', standard: '4.MD.A.3 — apply the area formula backwards', weight: 1, mode: 'auto' },

  e4m29: { tier: 'current', domain: 'Geometry', standard: '4.G.A.1 — parallel and perpendicular lines', weight: 1, mode: 'auto' },
  e4m30: { tier: 'current', domain: 'Geometry', standard: '4.MD.C.5 — classify angles', weight: 1, mode: 'auto' },

  e4m10: { tier: 'foundation', domain: 'Multi-step problems', standard: '3.OA.D.8 — two-step word problems', weight: 1, mode: 'auto' },
  e4m31: { tier: 'current', domain: 'Multi-step problems', standard: '4.OA.A.3 — multi-step word problems', weight: 1, mode: 'auto' },
  e4m32: { tier: 'stretch', domain: 'Multi-step problems', standard: '5.NBT.B.7 — multiply decimals in context', weight: 1, mode: 'auto' },
  e4m33: { tier: 'current', domain: 'Multi-step problems', standard: '4.OA.A.3 — assess reasonableness, explained', weight: 1, mode: 'rubric', rubricPoints: 3 },
}

export const ELE_MATH_G4_DOMAINS: readonly string[] = [
  'Place value and whole numbers',
  'Multiplication and division',
  'Fraction equivalence and comparison',
  'Fraction and decimal operations',
  'Measurement',
  'Geometry',
  'Multi-step problems',
]
