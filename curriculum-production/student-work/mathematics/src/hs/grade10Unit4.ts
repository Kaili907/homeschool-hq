import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 4 — Proving Geometric Theorems (G-CO.9, 10, 11). */

export const GRADE10_UNIT4 = makeHsUnitBank(10, 4, [
  spec<{ angle: number; relation: number }>({
    itemType: 'parallel-lines-angle-value',
    standard: 'G-CO.9',
    lessonFocus: 'angle relationships when parallel lines are cut by a transversal',
    build: (difficulty) => {
      const angle = rand(25, difficulty === 3 ? 155 : 145)
      const relation = rand(0, 2)
      const names = ['corresponding', 'alternate interior', 'co-interior (same-side interior)']
      const values = [angle, angle, 180 - angle]
      return {
        prompt: `Two parallel lines are cut by a transversal. One angle measures ${angle}°. Find the measure of the ${names[relation]} angle.`,
        parameters: { angle, relation },
        answer: `${values[relation]}°`,
        distractors: numericDistractors(values[relation], [
          180 - values[relation],
          90,
          angle / 2,
          360 - values[relation],
        ]).map((value) => `${value}°`),
        solutionSteps: [
          relation === 2
            ? 'Co-interior angles lie on the same side of the transversal between the parallels, and they are supplementary.'
            : `${names[relation].charAt(0).toUpperCase()}${names[relation].slice(1)} angles formed by a transversal across parallel lines are congruent.`,
          relation === 2
            ? `So the required angle is 180 − ${angle} = ${values[relation]}°.`
            : `So the required angle equals the given one: ${values[relation]}°.`,
        ],
        commonErrors: [
          {
            observed: 'Used the supplement where the angles were congruent, or vice versa.',
            likelyCause: 'The angle pair was named without checking its position relative to the parallels.',
            remediation:
              'Mark the two parallel lines and shade the region between them; co-interior pairs both lie inside on one side.',
          },
        ],
      }
    },
    oracle: ({ angle, relation }) => `${[angle, angle, 180 - angle][relation]}°`,
    referenceExample: {
      prompt: 'Parallel lines, transversal, one angle 70°. Alternate interior angle?',
      steps: ['Alternate interior angles are congruent.', 'The angle is 70°.'],
      answer: '70°',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'exterior-angle-theorem',
    standard: 'G-CO.10',
    lessonFocus: 'the exterior angle theorem for triangles',
    build: (difficulty) => {
      const a = rand(20, difficulty === 3 ? 80 : 60)
      const b = rand(20, difficulty === 3 ? 80 : 70)
      const exterior = a + b
      return {
        prompt: `In a triangle, the two remote interior angles measure ${a}° and ${b}°. Find the exterior angle at the third vertex.`,
        parameters: { a, b },
        answer: `${exterior}°`,
        distractors: numericDistractors(exterior, [
          180 - exterior,
          180 - a - b + 10,
          Math.abs(a - b),
          90,
        ]).map((value) => `${value}°`),
        solutionSteps: [
          `The interior angle at the third vertex is 180 − ${a} − ${b} = ${180 - a - b}°.`,
          `The exterior angle is supplementary to it: 180 − ${180 - a - b} = ${exterior}°.`,
          `This matches the exterior angle theorem directly: the exterior angle equals the sum of the two remote interior angles, ${a} + ${b} = ${exterior}°.`,
        ],
        commonErrors: [
          {
            observed: `Gave the interior angle ${180 - a - b}° instead of the exterior one.`,
            likelyCause: 'The exterior angle was confused with the third interior angle.',
            remediation:
              'Extend one side in the sketch and mark the angle outside the triangle before computing.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => `${a + b}°`,
    referenceExample: {
      prompt: 'Remote interior angles 40° and 65°. Exterior angle?',
      steps: ['Exterior equals the sum of the remote interiors.', '40 + 65 = 105°.'],
      answer: '105°',
    },
  }),

  spec<{ angle: number; which: number }>({
    itemType: 'parallelogram-property',
    standard: 'G-CO.11',
    lessonFocus: 'properties of parallelograms',
    build: (difficulty) => {
      const angle = rand(30, difficulty === 3 ? 150 : 130)
      const which = rand(0, 1)
      const value = which === 0 ? angle : 180 - angle
      const label = which === 0 ? 'opposite' : 'consecutive'
      return {
        prompt: `In a parallelogram, one angle measures ${angle}°. Find the ${label} angle.`,
        parameters: { angle, which },
        answer: `${value}°`,
        distractors: numericDistractors(value, [180 - value, 90, angle / 2, 360 - value]).map(
          (item) => `${item}°`,
        ),
        solutionSteps: [
          which === 0
            ? 'Opposite angles of a parallelogram are congruent, because each pair of opposite sides is parallel and the diagonals create congruent triangles.'
            : 'Consecutive angles of a parallelogram lie between a pair of parallel sides, so they are co-interior and therefore supplementary.',
          which === 0
            ? `The opposite angle is also ${value}°.`
            : `The consecutive angle is 180 − ${angle} = ${value}°.`,
        ],
        commonErrors: [
          {
            observed: 'Assumed all four angles are equal.',
            likelyCause: 'A parallelogram was treated as a rectangle.',
            remediation:
              'Sketch a clearly slanted parallelogram; the unequal angles become visible immediately.',
          },
        ],
      }
    },
    oracle: ({ angle, which }) => `${which === 0 ? angle : 180 - angle}°`,
    referenceExample: {
      prompt: 'A parallelogram has an angle of 110°. Find the consecutive angle.',
      steps: ['Consecutive angles are supplementary.', '180 − 110 = 70°.'],
      answer: '70°',
    },
  }),

  spec<{ base: number }>({
    itemType: 'triangle-midsegment-theorem',
    standard: 'G-CO.10',
    lessonFocus: 'the midsegment of a triangle',
    build: (difficulty) => {
      const base = rand(4, difficulty === 3 ? 60 : 30) * 2
      return {
        prompt: `In a triangle, a segment joins the midpoints of two sides. The third side measures ${base}. Find the length of the midsegment and state its relationship to the third side.`,
        parameters: { base },
        answer: `${base / 2}, and it is parallel to the third side`,
        distractors: [
          `${base}, and it is parallel to the third side`,
          `${base / 2}, and it is perpendicular to the third side`,
          `${base * 2}, and it is parallel to the third side`,
          `${base / 4}, and it is parallel to the third side`,
        ],
        solutionSteps: [
          `The midsegment theorem states that the segment joining the midpoints of two sides is parallel to the third side and half its length.`,
          `The third side is ${base}, so the midsegment is ${base} ÷ 2 = ${base / 2}.`,
          `It is parallel to the third side, which follows because the midsegment creates a triangle similar to the original with ratio 1:2.`,
        ],
        commonErrors: [
          {
            observed: 'Doubled the third side instead of halving it.',
            likelyCause: 'The direction of the ratio was reversed.',
            remediation:
              'Check plausibility: a segment inside the triangle cannot be longer than the side it parallels.',
          },
        ],
      }
    },
    oracle: ({ base }) => `${base / 2}, and it is parallel to the third side`,
    referenceExample: {
      prompt: 'Third side is 18. Find the midsegment.',
      steps: ['Midsegment is half the third side.', '18 ÷ 2 = 9, parallel to it.'],
      answer: '9, parallel to the third side',
    },
  }),

  spec<{ which: number }>({
    itemType: 'proof-reasoning-gap',
    standard: 'G-CO.9',
    lessonFocus: 'identifying the missing justification in a proof',
    build: () => {
      const cases = [
        {
          claim: 'A proof concludes that base angles of an isosceles triangle are congruent, after constructing the bisector of the apex angle.',
          answer: 'The two smaller triangles are congruent by SAS, so their corresponding base angles are congruent.',
          distractors: [
            'The base angles look equal in the diagram.',
            'All triangles have congruent base angles.',
            'The bisector is perpendicular to the base by definition.',
          ],
        },
        {
          claim: 'A proof concludes that vertical angles are congruent.',
          answer: 'Each vertical angle is supplementary to the same adjacent angle, so both have the same measure.',
          distractors: [
            'Vertical angles are congruent by definition.',
            'The two lines are parallel, forcing the angles to match.',
            'The angles are congruent because they are opposite in position.',
          ],
        },
        {
          claim: 'A proof concludes that the diagonals of a parallelogram bisect each other.',
          answer: 'Alternate interior angles give two pairs of congruent angles, and the opposite sides are congruent, so the triangles formed are congruent by ASA.',
          distractors: [
            'The diagonals are congruent, so they must bisect each other.',
            'Every quadrilateral has diagonals that bisect each other.',
            'The diagonals are perpendicular, which forces bisection.',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `${entry.claim} Which statement supplies the missing justification?`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `A proof step must cite a definition, postulate, or previously proved theorem — never the appearance of the diagram.`,
          `Identify which congruent parts the construction produces, then name the criterion or relationship they satisfy.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Justified a step by what the diagram appeared to show.',
            likelyCause: 'The diagram was treated as evidence rather than as illustration.',
            remediation:
              'Ask whether the step would still hold if the diagram were drawn inaccurately; if not, the justification is missing.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'The two smaller triangles are congruent by SAS, so their corresponding base angles are congruent.',
        'Each vertical angle is supplementary to the same adjacent angle, so both have the same measure.',
        'Alternate interior angles give two pairs of congruent angles, and the opposite sides are congruent, so the triangles formed are congruent by ASA.',
      ][which],
    referenceExample: {
      prompt: 'Why are vertical angles congruent?',
      steps: ['Both are supplementary to the same angle.', 'Angles supplementary to the same angle are equal.'],
      answer: 'both supplementary to a common angle',
    },
  }),
])
