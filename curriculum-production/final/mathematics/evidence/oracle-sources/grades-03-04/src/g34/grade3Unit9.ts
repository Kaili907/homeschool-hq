import { makeG34UnitBank, numericDistractors, rand, renderedDistractors, spec } from './core.ts'

/** Grade 3 Unit 9 — Area and the Distributive Property (3.MD.5, 3.MD.6, 3.MD.7, 3.OA.5, 3.OA.7). */

const AREA_CONCEPT_STATEMENTS = [
  {
    statement: 'Area is the amount of flat space a shape covers, measured in square units.',
    correct: true,
  },
  {
    statement: 'Area is the distance around the outside edge of a shape, measured in linear units.',
    correct: false,
  },
  {
    statement: 'Area can be found by counting only the unit squares along one edge of a shape.',
    correct: false,
  },
  {
    statement: 'Area is always the same number as the perimeter for any rectangle.',
    correct: false,
  },
] as const

export const GRADE3_UNIT9 = makeG34UnitBank(3, 9, [
  spec<{ correctIndex: number; promptVariant?: number }>({
    itemType: 'recognize-area-attribute',
    standard: '3.MD.5',
    lessonFocus: 'recognizing area as an attribute of plane figures and understanding area measurement as covering with unit squares',
    build: (_difficulty, variant = 0) => {
      const correctIndex = AREA_CONCEPT_STATEMENTS.findIndex((s) => s.correct)
      const prompts = [
        'Which statement correctly describes the area of a shape?',
        'A student is explaining what area measures. Which statement is correct?',
        'Which statement could be used to define area in square units?',
        'Which statement explains why unit squares are used to measure area?',
        'You cover a flat figure with same-size squares. Which statement describes what you are measuring?',
        'Which statement correctly distinguishes area from perimeter?',
        'A rectangle is tiled with no gaps or overlaps. Which statement tells what the tile count measures?',
        'Which statement describes the inside surface of a plane figure rather than its boundary?',
        'Which statement would correctly label a measurement written in square centimeters?',
        'A learner shades the entire inside of a shape. Which statement names the attribute being shown?',
        'Which statement correctly connects covering a figure and counting unit squares?',
        'Which statement about measuring the flat space inside a figure is true?',
      ]
      const promptVariant = Math.min(variant, prompts.length - 1)
      return {
        prompt: prompts[promptVariant],
        parameters: { correctIndex, ...(promptVariant === 0 ? {} : { promptVariant }) },
        answer: AREA_CONCEPT_STATEMENTS[correctIndex].statement,
        distractors: AREA_CONCEPT_STATEMENTS.filter((s) => !s.correct).map((s) => s.statement),
        solutionSteps: [
          'Area measures how much flat surface a shape covers.',
          'A shape\'s area is found by covering it with same-size unit squares, with no gaps or overlaps, and counting them.',
          `The correct statement is: "${AREA_CONCEPT_STATEMENTS[correctIndex].statement}"`,
        ],
        commonErrors: [
          {
            observed: 'Chose the statement describing perimeter instead of area.',
            likelyCause: 'Confused the boundary (perimeter) with the covered surface (area).',
            remediation: 'Have the learner trace the boundary with a finger for perimeter, then shade the inside with unit squares for area, naming which one each action measures.',
          },
        ],
      }
    },
    oracle: ({ correctIndex }) => AREA_CONCEPT_STATEMENTS[correctIndex].statement,
    referenceExample: {
      prompt: 'Which statement correctly describes the perimeter of a shape?',
      steps: ['Perimeter is the distance around the outside boundary of a shape, measured in linear units, not the space it covers.'],
      answer: 'Perimeter is the distance around the outside edge of a shape, measured in linear units.',
    },
  }),

  spec<{ length: number; width: number }>({
    itemType: 'area-by-counting-unit-squares',
    standard: '3.MD.6',
    lessonFocus: 'measuring area by counting unit squares',
    build: (difficulty) => {
      const length = rand(2, difficulty === 1 ? 6 : 9)
      const width = rand(2, difficulty === 3 ? 9 : 6)
      const area = length * width
      return {
        prompt: `A rectangle is covered by unit squares in ${length} rows of ${width} squares each, with no gaps or overlaps. How many unit squares cover the rectangle?`,
        parameters: { length, width },
        answer: String(area),
        distractors: numericDistractors(area, [length + width, length * width - length, 2 * (length + width)]),
        solutionSteps: [
          `${length} rows of ${width} unit squares means ${length} × ${width} squares total.`,
          `${length} × ${width} = ${area}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${2 * (length + width)} instead of ${area}.`,
            likelyCause: 'Found the perimeter (adding the sides) instead of the area (covering the surface).',
            remediation: 'Have the learner physically count rows and squares per row, then multiply, rather than adding side lengths.',
          },
        ],
      }
    },
    oracle: ({ length, width }) => String(length * width),
    referenceExample: {
      prompt: 'A rectangle is covered by unit squares in 4 rows of 5 squares each. How many unit squares cover it?',
      steps: ['4 rows of 5 is 4 × 5.', '4 × 5 = 20.'],
      answer: '20',
    },
  }),

  spec<{ length: number; width: number; unitIndex: number }>({
    itemType: 'area-formula-multiplication',
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
        prompt: `A rectangular rug is ${length} ${unit} long and ${width} ${unit} wide. What is its area?`,
        parameters: { length, width, unitIndex },
        answer: `${area} sq ${unit}`,
        distractors: renderedDistractors(area, [2 * (length + width), length + width], (v) => `${v} sq ${unit}`, 3),
        solutionSteps: [`Area of a rectangle is length × width.`, `${length} × ${width} = ${area}.`, `The area is ${area} square ${unit}.`],
        commonErrors: [
          {
            observed: `Answered ${2 * (length + width)} sq ${unit} instead of ${area} sq ${unit}.`,
            likelyCause: 'Computed the perimeter formula instead of the area formula.',
            remediation: 'Have the learner state which formula covers the surface (multiply) versus which measures the boundary (add all sides).',
          },
        ],
      }
    },
    oracle: ({ length, width, unitIndex }) => {
      const units = ['cm', 'in', 'ft', 'm'] as const
      return `${length * width} sq ${units[unitIndex]}`
    },
    referenceExample: {
      prompt: 'A rectangular garden bed is 6 ft long and 3 ft wide. What is its area?',
      steps: ['Area = length × width.', '6 × 3 = 18.', 'The area is 18 square feet.'],
      answer: '18 sq ft',
    },
  }),

  spec<{ length: number; widthA: number; widthB: number }>({
    itemType: 'area-distributive-property',
    standard: '3.MD.7',
    lessonFocus: 'finding area of a rectangle split into two smaller rectangles using the distributive property',
    build: (difficulty) => {
      const length = rand(3, difficulty === 1 ? 6 : 9)
      const widthA = rand(2, difficulty === 3 ? 8 : 5)
      const widthB = rand(2, difficulty === 3 ? 8 : 5)
      const totalWidth = widthA + widthB
      const area = length * totalWidth
      return {
        prompt: `A rectangle ${length} units long is split into two parts: one ${widthA} units wide and one ${widthB} units wide. Use ${length} × (${widthA} + ${widthB}) to find the total area.`,
        parameters: { length, widthA, widthB },
        answer: String(area),
        distractors: numericDistractors(area, [length * widthA, length * widthB, length + totalWidth]),
        solutionSteps: [
          `${length} × (${widthA} + ${widthB}) = (${length} × ${widthA}) + (${length} × ${widthB}).`,
          `${length} × ${widthA} = ${length * widthA}, and ${length} × ${widthB} = ${length * widthB}.`,
          `${length * widthA} + ${length * widthB} = ${area}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${length * widthA} instead of ${area}.`,
            likelyCause: 'Found the area of only one of the two smaller rectangles.',
            remediation: 'Have the learner shade both parts of the rectangle and find each area before adding.',
          },
        ],
      }
    },
    oracle: ({ length, widthA, widthB }) => String(length * (widthA + widthB)),
    referenceExample: {
      prompt: 'A rectangle 5 units long is split into a 3-unit part and a 2-unit part. Find the total area.',
      steps: ['5 × 3 = 15.', '5 × 2 = 10.', '15 + 10 = 25.'],
      answer: '25',
    },
  }),

  spec<{ kind: number; a: number; b: number; c: number }>({
    itemType: 'property-of-operations-area-context',
    standard: '3.OA.5',
    lessonFocus: 'using properties of operations, including in area contexts',
    build: () => {
      const kind = rand(0, 1)
      const a = rand(2, 9)
      const b = rand(2, 9)
      const c = rand(2, 9)
      if (kind === 0) {
        const answer = `${b} × ${a}`
        return {
          prompt: `A rectangle has area ${a} × ${b}. Which expression gives the same area by the commutative property?`,
          parameters: { kind, a, b, c },
          answer,
          distractors: [`${a} + ${b}`, `${a + 1} × ${b}`, `${a} × ${b + 1}`],
          solutionSteps: ['The commutative property says changing the order of the factors does not change the product.', `${a} × ${b} = ${b} × ${a}.`],
        }
      }
      const answer = `(${a} × ${b}) + (${a} × ${c})`
      return {
        prompt: `A rectangle's area is ${a} × (${b} + ${c}). Which expression shows the same area using the distributive property?`,
        parameters: { kind, a, b, c },
        answer,
        distractors: [`${a} × ${b} × ${c}`, `${a} + ${b} + ${c}`, `(${a} + ${b}) × (${a} + ${c})`],
        solutionSteps: ['The distributive property splits the rectangle into two smaller rectangles.', `${a} × (${b} + ${c}) = (${a} × ${b}) + (${a} × ${c}).`],
      }
    },
    oracle: ({ kind, a, b, c }) => (kind === 0 ? `${b} × ${a}` : `(${a} × ${b}) + (${a} × ${c})`),
    referenceExample: {
      prompt: "A rectangle's area is 4 × (3 + 5). Which expression shows the same area using the distributive property?",
      steps: ['Split into two rectangles: 4 × 3 and 4 × 5.', '4 × (3 + 5) = (4 × 3) + (4 × 5).'],
      answer: '(4 × 3) + (4 × 5)',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'fluency-fact-area-review',
    standard: '3.OA.7',
    lessonFocus: 'fluently multiplying within 100',
    build: (difficulty) => {
      const a = rand(2, difficulty === 1 ? 6 : 9)
      const b = rand(2, difficulty === 3 ? 9 : 7)
      const product = a * b
      return {
        prompt: `Find ${a} × ${b}.`,
        parameters: { a, b },
        answer: String(product),
        distractors: numericDistractors(product, [a * (b - 1), a * (b + 1), a + b]),
        solutionSteps: [`${a} × ${b} = ${product}.`],
      }
    },
    oracle: ({ a, b }) => String(a * b),
    referenceExample: {
      prompt: 'Find 9 × 6.',
      steps: ['9 × 6 = 54.'],
      answer: '54',
    },
  }),
])
