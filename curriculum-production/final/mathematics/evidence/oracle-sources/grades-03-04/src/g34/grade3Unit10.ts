import { makeG34UnitBank, numericDistractors, rand, renderedDistractors, spec } from './core.ts'

/** Grade 3 Unit 10 — Perimeter, Geometry, and Integrated Capstone (3.G.1, 3.G.2, 3.MD.7, 3.MD.8, 3.NF.1). */

const QUADRILATERALS = [
  { name: 'square', description: 'four equal sides and four right angles' },
  { name: 'rectangle', description: 'four right angles, with opposite sides equal' },
  { name: 'rhombus', description: 'four equal sides, but not necessarily right angles' },
  { name: 'trapezoid', description: 'exactly one pair of parallel sides' },
] as const

export const GRADE3_UNIT10 = makeG34UnitBank(3, 10, [
  spec<{ shapeIndex: number }>({
    itemType: 'classify-quadrilaterals',
    standard: '3.G.1',
    lessonFocus: 'classifying quadrilaterals by their shared attributes',
    build: () => {
      const shapeIndex = rand(0, QUADRILATERALS.length - 1)
      const shape = QUADRILATERALS[shapeIndex]
      return {
        prompt: `Which quadrilateral is defined by having ${shape.description}?`,
        parameters: { shapeIndex },
        answer: shape.name,
        distractors: QUADRILATERALS.filter((_, i) => i !== shapeIndex).map((q) => q.name),
        solutionSteps: [
          `The description "${shape.description}" matches the ${shape.name}.`,
          'All quadrilaterals share four sides, but their side and angle rules place them in different categories.',
        ],
      }
    },
    oracle: ({ shapeIndex }) => QUADRILATERALS[shapeIndex].name,
    referenceExample: {
      prompt: 'Which quadrilateral has four equal sides and four right angles?',
      steps: ['Four equal sides and four right angles describes a square.'],
      answer: 'square',
    },
  }),

  spec<{ parts: number }>({
    itemType: 'partition-shape-equal-areas-capstone',
    standard: '3.G.2',
    lessonFocus: 'partitioning shapes into parts with equal area and naming the unit fraction',
    build: (difficulty) => {
      const parts = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [4, 6, 8][rand(0, 2)] : [6, 8][rand(0, 1)]
      return {
        prompt: `A square garden plot is partitioned into ${parts} parts of equal area. What fraction of the plot does one part represent?`,
        parameters: { parts },
        answer: `1/${parts}`,
        distractors: [`${parts}/1`, `1/${parts - 1}`, `1/${parts + 1}`, `${parts}/${parts}`],
        solutionSteps: [`The plot is split into ${parts} equal parts.`, `One part is 1/${parts}.`],
      }
    },
    oracle: ({ parts }) => `1/${parts}`,
    referenceExample: {
      prompt: 'A garden plot is partitioned into 6 parts of equal area. What fraction is one part?',
      steps: ['6 equal parts make up the whole.', 'One part is 1/6.'],
      answer: '1/6',
    },
  }),

  spec<{ length: number; width: number; unitIndex: number }>({
    itemType: 'area-formula-capstone',
    standard: '3.MD.7',
    lessonFocus: 'finding area of a rectangle by multiplying side lengths',
    build: (difficulty) => {
      const units = ['cm', 'in', 'ft', 'm'] as const
      const unitIndex = rand(0, units.length - 1)
      const unit = units[unitIndex]
      const length = rand(3, difficulty === 1 ? 7 : 12)
      const width = rand(2, difficulty === 3 ? 12 : 8)
      const area = length * width
      return {
        prompt: `A rectangular patio is ${length} ${unit} long and ${width} ${unit} wide. What is its area?`,
        parameters: { length, width, unitIndex },
        answer: `${area} sq ${unit}`,
        distractors: renderedDistractors(area, [2 * (length + width), length + width], (v) => `${v} sq ${unit}`, 3),
        solutionSteps: [`Area = length × width.`, `${length} × ${width} = ${area}.`, `The area is ${area} square ${unit}.`],
      }
    },
    oracle: ({ length, width, unitIndex }) => {
      const units = ['cm', 'in', 'ft', 'm'] as const
      return `${length * width} sq ${units[unitIndex]}`
    },
    referenceExample: {
      prompt: 'A rectangular patio is 7 m long and 4 m wide. What is its area?',
      steps: ['7 × 4 = 28.', 'The area is 28 square meters.'],
      answer: '28 sq m',
    },
  }),

  spec<{ length: number; width: number; unitIndex: number }>({
    itemType: 'perimeter-of-rectangle',
    standard: '3.MD.8',
    lessonFocus: 'finding the perimeter of a polygon given its side lengths',
    build: (difficulty) => {
      const units = ['cm', 'in', 'ft', 'm'] as const
      const unitIndex = rand(0, units.length - 1)
      const unit = units[unitIndex]
      const length = rand(3, difficulty === 1 ? 8 : 14)
      const width = rand(2, difficulty === 3 ? 14 : 9)
      const perimeter = 2 * (length + width)
      return {
        prompt: `A rectangular field is ${length} ${unit} long and ${width} ${unit} wide. What is its perimeter?`,
        parameters: { length, width, unitIndex },
        answer: `${perimeter} ${unit}`,
        distractors: renderedDistractors(perimeter, [length * width, length + width], (v) => `${v} ${unit}`, 3),
        solutionSteps: [
          `Perimeter is the distance around all four sides: length + width + length + width.`,
          `2 × (${length} + ${width}) = 2 × ${length + width} = ${perimeter}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${length * width} ${unit} instead of ${perimeter} ${unit}.`,
            likelyCause: 'Computed the area formula instead of the perimeter formula.',
            remediation: 'Have the learner trace the boundary of the rectangle with a finger while adding each side.',
          },
        ],
      }
    },
    oracle: ({ length, width, unitIndex }) => {
      const units = ['cm', 'in', 'ft', 'm'] as const
      return `${2 * (length + width)} ${units[unitIndex]}`
    },
    referenceExample: {
      prompt: 'A rectangular field is 9 ft long and 5 ft wide. What is its perimeter?',
      steps: ['2 × (9 + 5) = 2 × 14 = 28.'],
      answer: '28 ft',
    },
  }),

  spec<{ shaded: number; parts: number }>({
    itemType: 'identify-unit-fraction-capstone',
    standard: '3.NF.1',
    lessonFocus: 'naming a fraction a/b as a parts out of b equal parts',
    build: (difficulty) => {
      const parts = difficulty === 1 ? rand(2, 4) : difficulty === 2 ? [4, 6][rand(0, 1)] : [6, 8][rand(0, 1)]
      const shaded = rand(1, parts - 1)
      return {
        prompt: `A garden bed is divided into ${parts} equal sections. ${shaded} sections are planted with flowers. What fraction of the bed is planted?`,
        parameters: { shaded, parts },
        answer: `${shaded}/${parts}`,
        distractors: [`${parts}/${shaded}`, `${shaded}/${parts - 1}`, `${shaded}/${parts + 1}`, `${parts - shaded}/${parts}`],
        solutionSteps: [`${parts} equal sections is the denominator.`, `${shaded} planted sections is the numerator.`, `The fraction is ${shaded}/${parts}.`],
      }
    },
    oracle: ({ shaded, parts }) => `${shaded}/${parts}`,
    referenceExample: {
      prompt: 'A garden bed is divided into 6 equal sections. 2 are planted with flowers. What fraction is planted?',
      steps: ['6 equal sections is the denominator.', '2 planted is the numerator.', 'The fraction is 2/6.'],
      answer: '2/6',
    },
  }),
])
