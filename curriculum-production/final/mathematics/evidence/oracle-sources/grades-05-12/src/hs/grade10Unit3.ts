import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 3 — Congruence and Triangle Criteria (G-CO.6, 7, 8). */

export const GRADE10_UNIT3 = makeHsUnitBank(10, 3, [
  spec<{ which: number }>({
    itemType: 'select-congruence-criterion',
    standard: 'G-CO.8',
    lessonFocus: 'choosing the triangle congruence criterion the given information supports',
    build: () => {
      const cases = [
        { given: 'all three pairs of corresponding sides are congruent', answer: 'SSS' },
        {
          given: 'two pairs of corresponding sides and the pair of included angles are congruent',
          answer: 'SAS',
        },
        {
          given: 'two pairs of corresponding angles and the pair of included sides are congruent',
          answer: 'ASA',
        },
        {
          given: 'two pairs of corresponding angles and a pair of non-included sides are congruent',
          answer: 'AAS',
        },
        {
          given: 'the hypotenuses and one pair of legs of two right triangles are congruent',
          answer: 'HL',
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      const all = ['SSS', 'SAS', 'ASA', 'AAS', 'HL']
      return {
        prompt: `In two triangles, ${entry.given}. Which congruence criterion applies?`,
        parameters: { which },
        answer: entry.answer,
        distractors: all.filter((value) => value !== entry.answer).concat(['SSA']),
        solutionSteps: [
          `List what is given, in order around each triangle: ${entry.given}.`,
          `Match that pattern against the criteria, paying attention to whether the angle is between the two sides or not.`,
          `The given information matches ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Chose SAS when the congruent angle was not between the two congruent sides.',
            likelyCause: 'The word "included" was overlooked.',
            remediation:
              'Mark the given parts on a sketch and check physically whether the angle sits between the two marked sides.',
          },
        ],
      }
    },
    oracle: ({ which }) => ['SSS', 'SAS', 'ASA', 'AAS', 'HL'][which],
    referenceExample: {
      prompt: 'Two sides and the included angle are congruent. Which criterion?',
      steps: ['Side, angle between them, side.', 'That is SAS.'],
      answer: 'SAS',
    },
  }),

  spec<{ placeholder: number }>({
    itemType: 'why-ssa-is-not-a-criterion',
    standard: 'G-CO.8',
    lessonFocus: 'why side-side-angle does not establish congruence',
    build: () => ({
      prompt:
        'Two triangles share two pairs of congruent sides and a pair of congruent angles that are not between those sides. Why does this fail to prove congruence?',
      parameters: { placeholder: rand(0, 0) },
      answer:
        'The unknown side can close the triangle in two different ways, producing one acute and one obtuse triangle from the same measurements.',
      distractors: [
        'The angle must be a right angle for any criterion to apply.',
        'Two sides are never enough information under any circumstances.',
        'The triangles are congruent, but the criterion is simply named differently.',
        'Congruence fails only when the triangles have different orientations.',
      ],
      solutionSteps: [
        'Fix the congruent angle and the side adjacent to it, then swing the second known side to meet the opposite ray.',
        'When that side is shorter than the distance to the ray but long enough to reach it, the arc crosses the ray at two distinct points.',
        'Each crossing gives a valid triangle with the same three given measurements, but the two triangles differ in shape.',
        'Because the given data do not determine the triangle uniquely, SSA is not a congruence criterion.',
      ],
      commonErrors: [
        {
          observed: 'Assumed SSA works because three parts are given.',
          likelyCause: 'The count of given parts was treated as sufficient regardless of arrangement.',
          remediation:
            'Construct the ambiguous case explicitly with compass and straightedge and observe both solutions.',
        },
      ],
    }),
    oracle: () =>
      'The unknown side can close the triangle in two different ways, producing one acute and one obtuse triangle from the same measurements.',
    referenceExample: {
      prompt: 'Why is SSA not a congruence criterion?',
      steps: ['The swinging side can meet the ray at two points.', 'Two different triangles result.'],
      answer: 'The configuration is ambiguous',
    },
  }),

  spec<{ a: number; b: number; c: number }>({
    itemType: 'corresponding-parts-value',
    standard: 'G-CO.7',
    lessonFocus: 'using congruence to find an unknown measure',
    build: (difficulty) => {
      const a = rand(20, difficulty === 3 ? 80 : 60)
      const b = rand(20, difficulty === 3 ? 80 : 100 - a - 5)
      const c = 180 - a - b
      return {
        prompt: `Triangle ABC is congruent to triangle DEF. In triangle ABC, ∠A = ${a}° and ∠B = ${b}°. Find ∠F.`,
        parameters: { a, b, c },
        answer: `${c}°`,
        distractors: numericDistractors(c, [a, b, 180 - c, 90]).map((value) => `${value}°`),
        solutionSteps: [
          `Congruent triangles have congruent corresponding parts, and the correspondence is given by the order of the letters: A↔D, B↔E, C↔F.`,
          `So ∠F equals ∠C.`,
          `The angles of a triangle sum to 180°, so ∠C = 180 − ${a} − ${b} = ${c}°.`,
          `Therefore ∠F = ${c}°.`,
        ],
        commonErrors: [
          {
            observed: `Reported ∠A = ${a}° or ∠B = ${b}° as the answer.`,
            likelyCause: 'The correspondence implied by the vertex ordering was not used.',
            remediation:
              'Write the correspondence as three explicit pairs before reading off any measure.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => `${180 - a - b}°`,
    referenceExample: {
      prompt: '△ABC ≅ △DEF, ∠A = 50°, ∠B = 60°. Find ∠F.',
      steps: ['∠F corresponds to ∠C.', '∠C = 180 − 50 − 60 = 70°.'],
      answer: '70°',
    },
  }),

  spec<{ which: number }>({
    itemType: 'rigid-motion-defines-congruence',
    standard: 'G-CO.6',
    lessonFocus: 'congruence defined by rigid motions',
    build: () => {
      const cases = [
        {
          text: 'Two figures are congruent if and only if',
          answer: 'there is a sequence of rigid motions taking one exactly onto the other',
          distractors: [
            'they have the same area',
            'they have the same perimeter',
            'they can be scaled to match',
          ],
        },
        {
          text: 'A rigid motion is a transformation that',
          answer: 'preserves distance and angle measure',
          distractors: [
            'preserves area but may change side lengths',
            'preserves shape but may change size',
            'maps every figure to a similar figure',
          ],
        },
        {
          text: 'If a sequence of rigid motions maps △ABC onto △DEF, then',
          answer: 'every pair of corresponding sides and angles is congruent',
          distractors: [
            'only the corresponding angles are congruent',
            'only the corresponding sides are congruent',
            'the triangles have equal area but need not be congruent',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `${entry.text} …`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `Congruence is defined by motion, not by measurement: two figures are congruent exactly when one can be moved onto the other without distortion.`,
          `Rigid motions — translations, rotations, reflections and their compositions — are precisely the transformations preserving distance and angle.`,
          `So the correct completion is: ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Defined congruence by equal area or equal perimeter.',
            likelyCause: 'A consequence of congruence was mistaken for its definition.',
            remediation:
              'Find two figures with equal area that are clearly not congruent; that rules the candidate out.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'there is a sequence of rigid motions taking one exactly onto the other',
        'preserves distance and angle measure',
        'every pair of corresponding sides and angles is congruent',
      ][which],
    referenceExample: {
      prompt: 'What does it mean for two figures to be congruent?',
      steps: ['One can be moved onto the other.', 'The motion must preserve distance and angle.'],
      answer: 'a sequence of rigid motions maps one onto the other',
    },
  }),
])
