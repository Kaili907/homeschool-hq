import { fraction, makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 6 — Similarity Proofs and Applications (G-SRT.4, 5). */

export const GRADE10_UNIT6 = makeHsUnitBank(10, 6, [
  spec<{ a: number; b: number; k: number }>({
    itemType: 'proportional-side-in-similar-triangles',
    standard: 'G-SRT.5',
    lessonFocus: 'using similarity to find an unknown length',
    build: (difficulty) => {
      const a = rand(2, difficulty === 3 ? 18 : 10)
      const b = rand(2, difficulty === 3 ? 18 : 10)
      const k = rand(2, difficulty === 3 ? 5 : 3)
      return {
        prompt: `Triangle ABC is similar to triangle DEF. Side AB = ${a} corresponds to DE = ${a * k}. If BC = ${b}, find EF.`,
        parameters: { a, b, k },
        answer: String(b * k),
        distractors: numericDistractors(b * k, [b + (a * k - a), b, Math.round(b / k), b * k * k]),
        solutionSteps: [
          `Similar triangles have corresponding sides in a constant ratio.`,
          `The ratio from ABC to DEF is DE ÷ AB = ${a * k} ÷ ${a} = ${k}.`,
          `Apply the same ratio to the corresponding pair BC and EF: EF = ${b} × ${k} = ${b * k}.`,
        ],
        commonErrors: [
          {
            observed: `Added the difference ${a * k - a} instead of multiplying.`,
            likelyCause: 'The relationship was treated as additive rather than multiplicative.',
            remediation:
              'Check the ratio on the known pair, then verify the same ratio holds for the answer.',
          },
        ],
      }
    },
    oracle: ({ b, k }) => String(b * k),
    referenceExample: {
      prompt: 'AB = 4 maps to DE = 12, BC = 5. Find EF.',
      steps: ['Ratio 12 ÷ 4 = 3.', 'EF = 5 × 3 = 15.'],
      answer: '15',
    },
  }),

  spec<{ p: number; q: number }>({
    itemType: 'geometric-mean-altitude',
    standard: 'G-SRT.5',
    lessonFocus: 'the altitude to the hypotenuse and the geometric mean',
    build: (difficulty) => {
      const p = rand(1, difficulty === 3 ? 12 : 6)
      const k = rand(1, difficulty === 3 ? 6 : 4)
      const q = p * k * k
      const altitude = p * k
      return {
        prompt: `In a right triangle, the altitude to the hypotenuse divides it into segments of length ${p} and ${q}. Find the altitude.`,
        parameters: { p, q },
        answer: String(altitude),
        distractors: numericDistractors(altitude, [p + q, (p + q) / 2, q - p, p * q]),
        solutionSteps: [
          `The altitude to the hypotenuse creates two triangles similar to the original and to each other.`,
          `That similarity gives the proportion ${p} : h = h : ${q}, so h² = ${p} × ${q} = ${p * q}.`,
          `The altitude is the geometric mean of the two segments: h = √${p * q} = ${altitude}.`,
        ],
        commonErrors: [
          {
            observed: `Averaged the segments and answered ${(p + q) / 2}.`,
            likelyCause: 'The geometric mean was replaced by the arithmetic mean.',
            remediation:
              'Write the proportion from the similar triangles first; it produces a product, not a sum.',
          },
        ],
      }
    },
    oracle: ({ p, q }) => String(Math.round(Math.sqrt(p * q))),
    referenceExample: {
      prompt: 'Segments 4 and 9. Find the altitude.',
      steps: ['h² = 4 × 9 = 36.', 'h = 6.'],
      answer: '6',
    },
  }),

  spec<{ objectShadow: number; poleHeight: number; poleShadow: number }>({
    itemType: 'indirect-measurement-by-similarity',
    standard: 'G-SRT.5',
    lessonFocus: 'indirect measurement using similar triangles',
    build: (difficulty) => {
      const poleHeight = rand(2, difficulty === 3 ? 8 : 5)
      const poleShadow = rand(2, difficulty === 3 ? 8 : 5)
      const k = rand(2, difficulty === 3 ? 9 : 5)
      const objectShadow = poleShadow * k
      const height = poleHeight * k
      return {
        prompt: `A ${poleHeight} m pole casts a ${poleShadow} m shadow. At the same moment a building casts a ${objectShadow} m shadow. How tall is the building?`,
        parameters: { objectShadow, poleHeight, poleShadow },
        answer: `${height} m`,
        distractors: numericDistractors(height, [
          objectShadow,
          poleHeight + objectShadow - poleShadow,
          Math.round((poleShadow * objectShadow) / poleHeight),
          Math.round(objectShadow / poleHeight),
        ]).map((value) => `${value} m`),
        solutionSteps: [
          `The sun's rays strike both objects at the same angle, so the two right triangles are similar by AA.`,
          `Corresponding sides are proportional: height ÷ shadow is the same for both.`,
          `${poleHeight} ÷ ${poleShadow} = h ÷ ${objectShadow}, so h = ${objectShadow} × ${poleHeight} ÷ ${poleShadow}.`,
          `h = ${height} m.`,
        ],
        commonErrors: [
          {
            observed: 'Set up the proportion with height matched against the other triangle’s shadow.',
            likelyCause: 'Corresponding parts were paired across the two triangles incorrectly.',
            remediation:
              'Write both ratios in the same order — height over shadow for each triangle — before cross-multiplying.',
          },
        ],
      }
    },
    oracle: ({ objectShadow, poleHeight, poleShadow }) =>
      `${(objectShadow * poleHeight) / poleShadow} m`,
    referenceExample: {
      prompt: 'A 2 m pole casts a 3 m shadow; a tree casts a 12 m shadow. Tree height?',
      steps: ['2/3 = h/12.', 'h = 8 m.'],
      answer: '8 m',
    },
  }),

  spec<{ which: number }>({
    itemType: 'similarity-proof-justification',
    standard: 'G-SRT.4',
    lessonFocus: 'proving theorems using similarity',
    build: () => {
      const cases = [
        {
          claim: 'A line parallel to one side of a triangle divides the other two sides proportionally.',
          answer: 'The parallel line creates corresponding angles, giving a smaller triangle similar to the original by AA, so the sides are in proportion.',
          distractors: [
            'The two parts of each side are congruent because the line is parallel.',
            'The parallel line bisects both sides by definition.',
            'The result follows from the Pythagorean theorem applied twice.',
          ],
        },
        {
          claim: 'The Pythagorean theorem can be proved using similarity.',
          answer: 'The altitude to the hypotenuse creates two triangles similar to the original; writing both similarity proportions and adding them yields a² + b² = c².',
          distractors: [
            'The theorem follows because all right triangles are similar to each other.',
            'The theorem follows from the triangle inequality.',
            'Similarity gives a² + b² = c² only for isosceles right triangles.',
          ],
        },
        {
          claim: 'Two triangles with all three pairs of sides in the same ratio are similar.',
          answer: 'This is the SSS similarity criterion: a dilation matches one triangle’s sides to the other’s, and the resulting figures are congruent.',
          distractors: [
            'This is the SSS congruence criterion applied directly.',
            'Equal ratios of sides guarantee congruence, not similarity.',
            'The criterion holds only when the ratio is a whole number.',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `${entry.claim} Which statement correctly justifies it?`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `Identify which triangles in the configuration are similar and say why — usually AA from parallel lines or from a shared angle.`,
          `Write the proportion the similarity gives, then manipulate it into the claimed result.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Asserted proportionality without naming the similar triangles.',
            likelyCause: 'The proportion was quoted as a rule rather than derived.',
            remediation:
              'Require the two similar triangles to be named explicitly before any proportion is written.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'The parallel line creates corresponding angles, giving a smaller triangle similar to the original by AA, so the sides are in proportion.',
        'The altitude to the hypotenuse creates two triangles similar to the original; writing both similarity proportions and adding them yields a² + b² = c².',
        'This is the SSS similarity criterion: a dilation matches one triangle’s sides to the other’s, and the resulting figures are congruent.',
      ][which],
    referenceExample: {
      prompt: 'Why does a line parallel to one side divide the others proportionally?',
      steps: ['Corresponding angles give AA similarity.', 'Similar triangles have proportional sides.'],
      answer: 'by AA similarity',
    },
  }),
])
