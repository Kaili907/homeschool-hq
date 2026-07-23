import type { FixedTest } from '../types'

// Transcribed VERBATIM from HS-Math-Full-Diagnostic.md (34 items, 4 sections).
// Keys taken from the source "Answer Key" line. Two-part / multi-root answers use
// array keys; the genuinely two-part #16 is human-graded (keyNote holds the key).

export const HS_MATH_DIAGNOSTIC: FixedTest = {
  id: 'hs-math-diagnostic',
  title: 'Full-Spectrum Math Diagnostic — High School',
  forGrades: ['10', '12'],
  scratchReminder: true,
  intro:
    'Both teens take this. Untimed, no calculator, show all work. One rule: if you genuinely ' +
    "don't know how to start a problem, press SKIP. A skip tells us exactly where the gap is; a " +
    "lucky guess hides it. Skips cost nothing — this test can't be failed, it can only be honest " +
    'or dishonest. Use your scratch pad for all work. When you finish, Dad photographs the scratch pad.',
  sections: [
    {
      name: 'Section 1 — Number Foundations',
      items: [
        { id: 'm1', kind: 'numeric', prompt: '3/4 + 5/6 =', key: '19/12', keyNote: '19/12 = 1 7/12' },
        { id: 'm2', kind: 'numeric', prompt: '2 1/3 × 3/7 =', key: '1' },
        { id: 'm3', kind: 'numeric', prompt: '5 ÷ 2/3 =', key: '7 1/2' },
        { id: 'm4', kind: 'numeric', prompt: '4.06 − 1.78 =', key: '2.28' },
        { id: 'm5', kind: 'numeric', prompt: '0.4 × 3.25 =', key: '1.3' },
        { id: 'm6', kind: 'numeric', prompt: 'What is 15% of 80?', key: '12' },
        { id: 'm7', kind: 'numeric', prompt: '36 is what percent of 48?', key: '75%' },
        { id: 'm8', kind: 'numeric', prompt: '−7 + 12 − (−5) =', key: '10' },
        { id: 'm9', kind: 'numeric', prompt: '(−3)(−4)(−2) =', key: '−24' },
        { id: 'm10', kind: 'numeric', prompt: '24 − 6 ÷ 2 × 3 =', key: '15' },
      ],
    },
    {
      name: 'Section 2 — Pre-Algebra',
      items: [
        { id: 'm11', kind: 'numeric', prompt: 'Solve: x + 9 = 4', key: '-5', keyNote: 'x = −5' },
        { id: 'm12', kind: 'numeric', prompt: 'Solve: 3x − 5 = 16', key: '7', keyNote: 'x = 7' },
        { id: 'm13', kind: 'numeric', prompt: 'Solve the proportion: 5/8 = x/24', key: '15', keyNote: 'x = 15' },
        {
          id: 'm14',
          kind: 'numeric',
          prompt: 'If 3 pounds of apples cost $7.50, how much do 8 pounds cost?',
          key: '$20',
        },
        { id: 'm15', kind: 'numeric', prompt: 'Simplify: 2³ · 2⁴ (give the actual number)', key: '128' },
        {
          id: 'm16',
          kind: 'text',
          prompt: '√81 = ___ , and √40 is between which two whole numbers?',
          keyNote: '9; between 6 and 7',
        },
        { id: 'm17', kind: 'numeric', prompt: 'Evaluate 3a − 2b when a = 4 and b = −1', key: '14' },
        {
          id: 'm18',
          kind: 'choice',
          prompt: 'In which quadrant is the point (−3, 5)?',
          choices: ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'],
          key: 'Quadrant II',
        },
      ],
    },
    {
      name: 'Section 3 — Algebra I',
      items: [
        { id: 'm19', kind: 'numeric', prompt: 'Solve: 4(x − 2) = 2x + 10', key: '9', keyNote: 'x = 9' },
        {
          id: 'm20',
          kind: 'text',
          prompt: 'Solve: −3x + 4 ≥ 13',
          key: 'x ≤ −3',
          keyNote: 'x ≤ −3 (sign flips)',
        },
        { id: 'm21', kind: 'numeric', prompt: 'Find the slope of the line through (2, −1) and (6, 7)', key: '2' },
        {
          id: 'm22',
          kind: 'text',
          prompt: 'Write the equation of the line with slope −3 and y-intercept 5',
          key: 'y = −3x + 5',
        },
        {
          id: 'm23',
          kind: 'text',
          prompt: 'Solve the system: 2x + y = 11 and y = x + 2',
          key: ['x=3', 'y=5'],
          keyNote: 'x = 3, y = 5',
        },
        { id: 'm24', kind: 'text', prompt: 'Multiply: (x + 4)(x − 6)', key: 'x² − 2x − 24' },
        { id: 'm25', kind: 'text', prompt: 'Factor: x² − 5x − 14', key: '(x − 7)(x + 2)' },
        { id: 'm26', kind: 'text', prompt: 'Solve: x² = 49', key: ['7', '-7'], keyNote: 'x = 7 or −7' },
        {
          id: 'm27',
          kind: 'text',
          prompt: 'Solve: x² + 6x + 8 = 0',
          key: ['-2', '-4'],
          keyNote: 'x = −2 or x = −4',
        },
        { id: 'm28', kind: 'text', prompt: 'Simplify: 6x⁵ ÷ 2x²', key: '3x³' },
      ],
    },
    {
      name: 'Section 4 — Geometry Sampler',
      items: [
        { id: 'm29', kind: 'numeric', prompt: 'Area of a triangle with base 10 and height 6?', key: '30' },
        {
          id: 'm30',
          kind: 'numeric',
          prompt: 'Circumference of a circle with radius 5? (answer in terms of π)',
          key: '10π',
        },
        {
          id: 'm31',
          kind: 'numeric',
          prompt: 'Two angles of a triangle measure 65° and 40°. The third angle?',
          key: '75°',
        },
        { id: 'm32', kind: 'numeric', prompt: 'What angle is complementary to 34°?', key: '56°' },
        { id: 'm33', kind: 'numeric', prompt: 'A right triangle has legs 6 and 8. Find the hypotenuse.', key: '10' },
        {
          id: 'm34',
          kind: 'numeric',
          prompt: 'Volume of a cylinder with radius 3 and height 10? (in terms of π)',
          key: '90π',
        },
      ],
    },
  ],
}
