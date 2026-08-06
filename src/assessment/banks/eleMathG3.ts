import type { FixedTest } from '../types'
import type { Blueprint } from './placementModel'

// CE3 — Grade 3 beginning-of-year mathematics placement.
//
// 27 items, four sections, roughly 35 minutes untimed. Every item is original.
// Tier meaning: foundation = Grade 2 prerequisite · current = Grade 3 start ·
// stretch = Grade 4 signal. The blueprint below is the answer authority the
// reviewer audits; the scoring guide prints the same table in prose.

export const ELE_MATH_G3: FixedTest = {
  id: 'ele-math-g3',
  title: 'Grade 3 Mathematics — Beginning-of-Year Placement',
  forGrades: ['3'],
  scratchReminder: true,
  intro:
    'This is not a test you can fail. It shows a grown-up which math to teach you first, so ' +
    'nothing is too easy and nothing is too hard. Some questions come from last year and some ' +
    'are from next year — you are not expected to know all of them. If you do not know how to ' +
    'start a question, press SKIP. A skip tells the truth; a guess hides it. Take as long as ' +
    'you like. You may use paper and pencil.',
  sections: [
    {
      name: 'Section 1 — Numbers and Place Value',
      items: [
        {
          id: 'e3m01',
          kind: 'numeric',
          prompt: 'In the number 476, what is the VALUE of the digit 7?',
          key: '70',
          keyNote: '70 (7 tens). "7" alone is the digit, not its value — mark that as not yet.',
        },
        {
          id: 'e3m02',
          kind: 'numeric',
          prompt: 'Write this number using digits: three hundred five.',
          key: '305',
          keyNote: '305. A written 350 shows a place-value gap, not a careless slip.',
        },
        {
          id: 'e3m03',
          kind: 'choice',
          prompt: 'Which sign makes this true?\n\n418 ___ 481',
          choices: ['<', '>', '='],
          key: '<',
          keyNote: '< because 418 is less than 481.',
        },
        {
          id: 'e3m04',
          kind: 'numeric',
          prompt: 'Round 68 to the nearest ten.',
          key: '70',
          keyNote: '70.',
        },
        {
          id: 'e3m05',
          kind: 'numeric',
          prompt: 'Round 342 to the nearest hundred.',
          key: '300',
          keyNote: '300.',
        },
        {
          id: 'e3m06',
          kind: 'numeric',
          prompt: 'What number is 10 more than 1,295?',
          key: '1305',
          keyNote: '1,305. Commas in the answer are accepted.',
        },
      ],
    },
    {
      name: 'Section 2 — Adding and Subtracting',
      items: [
        { id: 'e3m07', kind: 'numeric', prompt: '47 + 35 = ?', key: '82', keyNote: '82.' },
        { id: 'e3m08', kind: 'numeric', prompt: '62 − 28 = ?', key: '34', keyNote: '34.' },
        {
          id: 'e3m09',
          kind: 'numeric',
          prompt: '356 + 187 = ?',
          key: '543',
          keyNote: '543 (regrouping in two places).',
        },
        {
          id: 'e3m10',
          kind: 'numeric',
          prompt: '500 − 246 = ?',
          key: '254',
          keyNote: '254 (subtracting across zeros).',
        },
        {
          id: 'e3m11',
          kind: 'numeric',
          prompt: '2,405 + 1,738 = ?',
          key: '4143',
          keyNote: '4,143. This is a Grade 4 signal — not knowing it is expected.',
        },
      ],
    },
    {
      name: 'Section 3 — Multiplication and Division',
      items: [
        {
          id: 'e3m12',
          kind: 'numeric',
          prompt:
            'There are 4 rows of chairs. Each row has 5 chairs. How many chairs are there in all?',
          key: '20',
          keyNote: '20. Counting one at a time still earns the point here.',
        },
        {
          id: 'e3m13',
          kind: 'choice',
          prompt: 'Which one matches "six groups of three"?',
          choices: ['6 × 3', '6 + 3', '3 − 6', '6 ÷ 3'],
          key: '6 × 3',
          keyNote: '6 × 3 — tests whether equal groups are read as multiplication.',
        },
        {
          id: 'e3m14',
          kind: 'numeric',
          prompt: 'An array of dots has 3 rows and 7 columns. How many dots are in the array?',
          key: '21',
          keyNote: '21.',
        },
        { id: 'e3m15', kind: 'numeric', prompt: '8 × 4 = ?', key: '32', keyNote: '32.' },
        { id: 'e3m16', kind: 'numeric', prompt: '7 × 6 = ?', key: '42', keyNote: '42.' },
        {
          id: 'e3m17',
          kind: 'numeric',
          prompt: '24 counters are shared equally among 4 children. How many does each child get?',
          key: '6',
          keyNote: '6 — division as fair sharing.',
        },
        {
          id: 'e3m18',
          kind: 'numeric',
          prompt: '23 × 4 = ?',
          key: '92',
          keyNote: '92. This is a Grade 4 signal — not knowing it is expected.',
        },
      ],
    },
    {
      name: 'Section 4 — Fractions, Measuring and Word Problems',
      items: [
        {
          id: 'e3m19',
          kind: 'text',
          prompt:
            'A rectangle is split into 4 equal parts. One part is coloured in. What fraction of ' +
            'the rectangle is coloured? Write it like 1/2.',
          key: '1/4',
          keyNote: '1/4.',
        },
        {
          id: 'e3m20',
          kind: 'text',
          prompt:
            'A pizza is cut into 6 equal slices. Maya eats 2 slices. What fraction of the pizza ' +
            'did she eat? Write it like 1/2.',
          key: '2/6',
          keyNote: '2/6 — an answer of 1/3 is the same amount and is also correct.',
        },
        {
          id: 'e3m21',
          kind: 'choice',
          prompt: 'Which is larger, 1/2 or 1/4?',
          choices: ['1/2', '1/4', 'they are the same'],
          key: '1/2',
          keyNote: '1/2. Choosing 1/4 usually means "4 is bigger than 2".',
        },
        {
          id: 'e3m22',
          kind: 'choice',
          prompt: 'A lesson starts at 9:15 and lasts 30 minutes. What time does it end?',
          choices: ['9:20', '9:35', '9:45', '10:15'],
          key: '9:45',
          keyNote: '9:45.',
        },
        {
          id: 'e3m23',
          kind: 'numeric',
          prompt:
            'A rectangle is 5 cm long and 3 cm wide. What is the distance all the way around it ' +
            '(its perimeter), in centimetres?',
          key: '16',
          keyNote: '16 cm. An answer of 15 is area, not perimeter — a useful thing to notice.',
        },
        {
          id: 'e3m24',
          kind: 'numeric',
          prompt:
            'Liam had 45 stickers. He gave 12 to his sister. Then he bought 20 more. How many ' +
            'stickers does he have now?',
          key: '53',
          keyNote: '53 — a two-step problem.',
        },
        {
          id: 'e3m25',
          kind: 'choice',
          prompt: 'Which fraction is equal to 1/2?',
          choices: ['2/4', '1/3', '2/5', '3/5'],
          key: '2/4',
          keyNote: '2/4. Grade 4 signal.',
        },
        {
          id: 'e3m26',
          kind: 'numeric',
          prompt: 'There are 3 feet in 1 yard. How many feet are in 5 yards?',
          key: '15',
          keyNote: '15. Grade 4 signal.',
        },
        {
          id: 'e3m27',
          kind: 'longtext',
          prompt:
            'Maya says that 4 × 5 and 5 × 4 both equal 20. Explain why that happens. You may ' +
            'describe a picture in words if that helps.',
          keyNote:
            'RUBRIC ITEM (0–3). Scored by a grown-up against the Grade 3 rubric in the scoring ' +
            'guide. Look for the idea that turning an array does not change how many dots it has.',
        },
      ],
    },
  ],
}

/** Answer authority + skill tags for every scored item. Weight is 1 throughout. */
export const ELE_MATH_G3_BLUEPRINT: Blueprint = {
  e3m01: { tier: 'foundation', domain: 'Place value', standard: '2.NBT.A.1 — value of a digit', weight: 1, mode: 'auto' },
  e3m02: { tier: 'foundation', domain: 'Place value', standard: '2.NBT.A.3 — read and write numbers to 1000', weight: 1, mode: 'auto' },
  e3m03: { tier: 'foundation', domain: 'Place value', standard: '2.NBT.A.4 — compare three-digit numbers', weight: 1, mode: 'auto' },
  e3m04: { tier: 'current', domain: 'Place value', standard: '3.NBT.A.1 — round to the nearest 10', weight: 1, mode: 'auto' },
  e3m05: { tier: 'current', domain: 'Place value', standard: '3.NBT.A.1 — round to the nearest 100', weight: 1, mode: 'auto' },
  e3m06: { tier: 'stretch', domain: 'Place value', standard: '4.NBT.A.2 — four-digit place value', weight: 1, mode: 'auto' },

  e3m07: { tier: 'foundation', domain: 'Addition and subtraction', standard: '2.NBT.B.5 — add within 100', weight: 1, mode: 'auto' },
  e3m08: { tier: 'foundation', domain: 'Addition and subtraction', standard: '2.NBT.B.5 — subtract within 100', weight: 1, mode: 'auto' },
  e3m09: { tier: 'current', domain: 'Addition and subtraction', standard: '3.NBT.A.2 — add within 1000', weight: 1, mode: 'auto' },
  e3m10: { tier: 'current', domain: 'Addition and subtraction', standard: '3.NBT.A.2 — subtract across zeros', weight: 1, mode: 'auto' },
  e3m11: { tier: 'stretch', domain: 'Addition and subtraction', standard: '4.NBT.B.4 — add multi-digit numbers', weight: 1, mode: 'auto' },

  e3m12: { tier: 'foundation', domain: 'Equal groups and arrays', standard: '2.OA.C.4 — rows and columns as repeated addition', weight: 1, mode: 'auto' },
  e3m13: { tier: 'current', domain: 'Equal groups and arrays', standard: '3.OA.A.1 — interpret products of whole numbers', weight: 1, mode: 'auto' },
  e3m14: { tier: 'current', domain: 'Equal groups and arrays', standard: '3.OA.A.3 — arrays in problem situations', weight: 1, mode: 'auto' },
  e3m15: { tier: 'current', domain: 'Multiplication and division facts', standard: '3.OA.C.7 — fluently multiply within 100', weight: 1, mode: 'auto' },
  e3m16: { tier: 'current', domain: 'Multiplication and division facts', standard: '3.OA.C.7 — fluently multiply within 100', weight: 1, mode: 'auto' },
  e3m17: { tier: 'current', domain: 'Multiplication and division facts', standard: '3.OA.A.2 — division as equal sharing', weight: 1, mode: 'auto' },
  e3m18: { tier: 'stretch', domain: 'Multiplication and division facts', standard: '4.NBT.B.5 — multiply two-digit by one-digit', weight: 1, mode: 'auto' },

  e3m19: { tier: 'foundation', domain: 'Fractions', standard: '2.G.A.3 — equal shares of a shape', weight: 1, mode: 'auto' },
  e3m20: { tier: 'current', domain: 'Fractions', standard: '3.NF.A.1 — a fraction as parts of a whole', weight: 1, mode: 'auto' },
  e3m21: { tier: 'current', domain: 'Fractions', standard: '3.NF.A.3d — compare unit fractions', weight: 1, mode: 'auto' },
  e3m25: { tier: 'stretch', domain: 'Fractions', standard: '4.NF.A.1 — equivalent fractions', weight: 1, mode: 'auto' },

  e3m22: { tier: 'current', domain: 'Measurement', standard: '3.MD.A.1 — elapsed time to the minute', weight: 1, mode: 'auto' },
  e3m23: { tier: 'current', domain: 'Measurement', standard: '3.MD.D.8 — perimeter of a rectangle', weight: 1, mode: 'auto' },
  e3m26: { tier: 'stretch', domain: 'Measurement', standard: '4.MD.A.1 — convert larger units to smaller', weight: 1, mode: 'auto' },

  e3m24: { tier: 'current', domain: 'Word problems and reasoning', standard: '3.OA.D.8 — two-step word problems', weight: 1, mode: 'auto' },
  e3m27: { tier: 'current', domain: 'Word problems and reasoning', standard: '3.OA.B.5 — commutative property, explained', weight: 1, mode: 'rubric', rubricPoints: 3 },
}

export const ELE_MATH_G3_DOMAINS: readonly string[] = [
  'Place value',
  'Addition and subtraction',
  'Equal groups and arrays',
  'Multiplication and division facts',
  'Fractions',
  'Measurement',
  'Word problems and reasoning',
]
