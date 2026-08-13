import { coordinateDistractors, fraction, makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 5 — Dilations and Similarity (G-SRT.1, 2, 3). */

export const GRADE10_UNIT5 = makeHsUnitBank(10, 5, [
  spec<{ x: number; y: number; k: number }>({
    itemType: 'dilation-image-coordinates',
    standard: 'G-SRT.1',
    lessonFocus: 'dilations centred at the origin',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 9 : 6
      const x = nonZero(bound)
      const y = nonZero(bound)
      const k = rand(2, difficulty === 3 ? 5 : 3)
      return {
        prompt: `Dilate the point (${x}, ${y}) about the origin with scale factor ${k}. Give the image.`,
        parameters: { x, y, k },
        answer: `(${x * k}, ${y * k})`,
        distractors: coordinateDistractors(x * k, y * k, [
          [x + k, y + k],
          [x * k, y],
          [x, y * k],
          [Math.round(x / k), Math.round(y / k)],
        ]),
        solutionSteps: [
          `A dilation centred at the origin multiplies both coordinates by the scale factor.`,
          `x: ${x} × ${k} = ${x * k}. y: ${y} × ${k} = ${y * k}.`,
          `The image is (${x * k}, ${y * k}).`,
          `Check: the image lies on the ray from the origin through the original point, ${k} times as far out.`,
        ],
        commonErrors: [
          {
            observed: `Added the scale factor and answered (${x + k}, ${y + k}).`,
            likelyCause: 'The dilation was treated as a translation.',
            remediation:
              'Ask what happens to a point at the origin; a dilation must leave the centre fixed, which addition does not.',
          },
        ],
      }
    },
    oracle: ({ x, y, k }) => `(${x * k}, ${y * k})`,
    referenceExample: {
      prompt: 'Dilate (3, −2) about the origin by factor 4.',
      steps: ['Multiply both coordinates by 4.', '(12, −8).'],
      answer: '(12, −8)',
    },
  }),

  spec<{ original: number; image: number }>({
    itemType: 'scale-factor-from-lengths',
    standard: 'G-SRT.2',
    lessonFocus: 'finding the scale factor between similar figures',
    build: (difficulty) => {
      const original = rand(2, difficulty === 3 ? 24 : 12)
      const k = rand(2, difficulty === 3 ? 6 : 4)
      const image = original * k
      return {
        prompt: `A figure is dilated so that a side of length ${original} becomes a side of length ${image}. What is the scale factor, and what happens to the figure's area?`,
        parameters: { original, image },
        answer: `scale factor ${k}; the area is multiplied by ${k * k}`,
        distractors: [
          `scale factor ${k}; the area is multiplied by ${k}`,
          `scale factor ${image - original}; the area is multiplied by ${k * k}`,
          `scale factor ${fraction(original, image)}; the area is multiplied by ${k * k}`,
          `scale factor ${k}; the area is multiplied by ${k * k * k}`,
        ],
        solutionSteps: [
          `The scale factor is the ratio of image length to original length: ${image} ÷ ${original} = ${k}.`,
          `Area scales as the square of the linear scale factor, because both dimensions are multiplied by ${k}.`,
          `So the area is multiplied by ${k}² = ${k * k}.`,
        ],
        commonErrors: [
          {
            observed: `Said the area is multiplied by ${k} as well.`,
            likelyCause: 'The linear factor was applied to area without squaring.',
            remediation:
              'Compute the area of a simple rectangle before and after, and compare the ratio directly.',
          },
        ],
      }
    },
    oracle: ({ original, image }) => {
      const k = image / original
      return `scale factor ${k}; the area is multiplied by ${k * k}`
    },
    referenceExample: {
      prompt: 'A side of 5 becomes 15. Scale factor and area change?',
      steps: ['15 ÷ 5 = 3.', 'Area scales by 3² = 9.'],
      answer: 'scale factor 3; area ×9',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'aa-similarity-criterion',
    standard: 'G-SRT.3',
    lessonFocus: 'establishing similarity from two pairs of congruent angles',
    build: (difficulty) => {
      const a = rand(25, difficulty === 3 ? 80 : 65)
      const b = rand(25, difficulty === 3 ? 80 : 175 - a - 25)
      return {
        prompt: `Triangle ABC has ∠A = ${a}° and ∠B = ${b}°. Triangle DEF has ∠D = ${a}° and ∠E = ${b}°. Are the triangles similar, and on what grounds?`,
        parameters: { a, b },
        answer: 'Yes, by AA similarity: two pairs of congruent angles force the third pair to be congruent as well.',
        distractors: [
          'Yes, but only if a pair of corresponding sides is also known to be congruent.',
          'No; angle information alone never establishes similarity.',
          'Yes, by SSS similarity.',
          'No; the triangles are congruent rather than similar.',
        ],
        solutionSteps: [
          `The angles of a triangle sum to 180°, so ∠C = 180 − ${a} − ${b} = ${180 - a - b}° and ∠F = 180 − ${a} − ${b} = ${180 - a - b}°.`,
          `All three pairs of corresponding angles are therefore congruent.`,
          `Equal angles force the corresponding sides into a fixed ratio, so the triangles are similar. Two pairs suffice, which is the AA criterion.`,
          `Note this establishes similarity, not congruence: the triangles may be different sizes.`,
        ],
        commonErrors: [
          {
            observed: 'Concluded the triangles are congruent.',
            likelyCause: 'Similarity and congruence were conflated.',
            remediation:
              'Ask whether any side length is known; without one, size is undetermined and only similarity follows.',
          },
        ],
      }
    },
    oracle: () =>
      'Yes, by AA similarity: two pairs of congruent angles force the third pair to be congruent as well.',
    referenceExample: {
      prompt: 'Two triangles share two pairs of equal angles. Similar?',
      steps: ['The third angles must match too.', 'AA similarity applies.'],
      answer: 'Yes, by AA',
    },
  }),

  spec<{ which: number }>({
    itemType: 'dilation-effect-on-line',
    standard: 'G-SRT.1',
    lessonFocus: 'what a dilation does to a line through or away from the centre',
    build: () => {
      const cases = [
        {
          text: 'a line that passes through the centre of dilation',
          answer: 'is mapped onto itself',
          distractors: [
            'is mapped to a parallel line a fixed distance away',
            'is mapped to a perpendicular line',
            'is mapped to a line through the origin with a different slope',
          ],
        },
        {
          text: 'a line that does not pass through the centre of dilation',
          answer: 'is mapped to a parallel line',
          distractors: [
            'is mapped onto itself',
            'is mapped to a perpendicular line',
            'is mapped to a line with slope multiplied by the scale factor',
          ],
        },
        {
          text: 'a segment not through the centre, under a dilation with scale factor k',
          answer: 'is mapped to a parallel segment k times as long',
          distractors: [
            'is mapped to a segment of the same length',
            'is mapped to a segment k² times as long',
            'is mapped to a perpendicular segment k times as long',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Under a dilation, ${entry.text} …`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `A dilation moves every point along the ray from the centre, scaling its distance from the centre.`,
          which === 0
            ? 'Points already on a line through the centre stay on that same line, since the ray from the centre lies along it.'
            : 'Points off that line move along different rays, and the scaled distances keep the direction of the line unchanged, so the image is parallel.',
          `Therefore it ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Claimed every line is mapped to itself.',
            likelyCause: 'The special case through the centre was generalised.',
            remediation:
              'Dilate two points of a line not through the centre and check whether the image passes through the originals.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'is mapped onto itself',
        'is mapped to a parallel line',
        'is mapped to a parallel segment k times as long',
      ][which],
    referenceExample: {
      prompt: 'What happens to a line through the centre of dilation?',
      steps: ['Every point stays on the ray from the centre.', 'The line maps onto itself.'],
      answer: 'onto itself',
    },
  }),
])
