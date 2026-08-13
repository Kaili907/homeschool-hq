import { choose, fraction, makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 4 Unit 10 — Angles, Geometry, and Integrated Capstone (4.G.1, 4.G.2, 4.G.3, 4.MD.5, 4.MD.6, 4.MD.7, 4.OA.5). */

const LINE_TERMS = [
  { term: 'parallel lines', description: 'two lines in the same plane that never meet and stay the same distance apart' },
  { term: 'perpendicular lines', description: 'two lines that cross to form a right angle' },
  { term: 'a ray', description: 'a part of a line that has one endpoint and extends forever in one direction' },
  { term: 'a line segment', description: 'a part of a line with two endpoints' },
] as const

const TRIANGLE_TYPES = [
  { name: 'acute triangle', description: 'all three angles measure less than 90°' },
  { name: 'right triangle', description: 'one angle measures exactly 90°' },
  { name: 'obtuse triangle', description: 'one angle measures more than 90°' },
  { name: 'equilateral triangle', description: 'all three sides are the same length' },
] as const

const SYMMETRY_SHAPES = [
  { name: 'square', lines: 4 },
  { name: 'rectangle (non-square)', lines: 2 },
  { name: 'equilateral triangle', lines: 3 },
  { name: 'regular pentagon', lines: 5 },
  { name: 'circle', lines: 4 },
] as const

export const GRADE4_UNIT10 = makeG34UnitBank(4, 10, [
  spec<{ index: number }>({
    itemType: 'classify-lines-and-angles',
    standard: '4.G.1',
    lessonFocus: 'identifying points, lines, rays, angles, and parallel or perpendicular lines',
    build: () => {
      const index = rand(0, LINE_TERMS.length - 1)
      const entry = LINE_TERMS[index]
      return {
        prompt: `Which term describes ${entry.description}?`,
        parameters: { index },
        answer: entry.term,
        distractors: LINE_TERMS.filter((_, i) => i !== index).map((e) => e.term),
        solutionSteps: [`The description matches the definition of ${entry.term}.`],
      }
    },
    oracle: ({ index }) => LINE_TERMS[index].term,
    referenceExample: {
      prompt: 'Which term describes two lines that cross to form a right angle?',
      steps: ['That is the definition of perpendicular lines.'],
      answer: 'perpendicular lines',
    },
  }),

  spec<{ index: number }>({
    itemType: 'classify-triangles',
    standard: '4.G.2',
    lessonFocus: 'classifying triangles by their angles',
    build: () => {
      const index = rand(0, TRIANGLE_TYPES.length - 1)
      const entry = TRIANGLE_TYPES[index]
      return {
        prompt: `A triangle where ${entry.description} is called what kind of triangle?`,
        parameters: { index },
        answer: entry.name,
        distractors: TRIANGLE_TYPES.filter((_, i) => i !== index).map((e) => e.name),
        solutionSteps: [`A triangle where ${entry.description} is classified as a(n) ${entry.name}.`],
      }
    },
    oracle: ({ index }) => TRIANGLE_TYPES[index].name,
    referenceExample: {
      prompt: 'A triangle where one angle measures more than 90° is called what kind of triangle?',
      steps: ['One angle over 90° makes it an obtuse triangle.'],
      answer: 'obtuse triangle',
    },
  }),

  spec<{ index: number }>({
    itemType: 'identify-line-of-symmetry',
    standard: '4.G.3',
    lessonFocus: 'identifying lines of symmetry in two-dimensional figures',
    build: () => {
      const index = rand(0, SYMMETRY_SHAPES.length - 1)
      const shape = SYMMETRY_SHAPES[index]
      return {
        prompt: `How many lines of symmetry does a ${shape.name} have?`,
        parameters: { index },
        answer: String(shape.lines),
        distractors: numericDistractors(shape.lines, [shape.lines - 1, shape.lines + 1, shape.lines * 2]),
        solutionSteps: [`A ${shape.name} can be folded along ${shape.lines} different lines so the two halves match exactly.`],
      }
    },
    oracle: ({ index }) => String(SYMMETRY_SHAPES[index].lines),
    referenceExample: {
      prompt: 'How many lines of symmetry does a square have?',
      steps: ['A square matches itself when folded along 2 diagonals and 2 midlines.', 'That is 4 lines of symmetry.'],
      answer: '4',
    },
  }),

  spec<{ degrees: number }>({
    itemType: 'angle-as-fraction-of-circle',
    standard: '4.MD.5',
    lessonFocus: 'understanding an angle measure as a fraction of a full circular turn',
    build: (difficulty, variant = 0) => {
      const basePools = difficulty === 1 ? [90, 180] : difficulty === 2 ? [45, 60, 120] : [30, 40, 100, 200]
      const expandedPools = difficulty === 1
        ? [30, 45, 60, 72, 120, 135, 180, 270]
        : difficulty === 2
          ? [20, 30, 40, 45, 60, 72, 90, 120, 135, 144, 180, 240]
          : [10, 20, 24, 30, 36, 40, 45, 60, 72, 90, 100, 120, 135, 144, 180, 200, 240, 270]
      const degrees = choose(variant === 0 ? basePools : expandedPools)
      return {
        prompt: `An angle turns through ${degrees}° of a full circle. What fraction of a full turn (360°) is this, in lowest terms?`,
        parameters: { degrees },
        answer: fraction(degrees, 360),
        distractors: [fraction(degrees, 180), fraction(degrees + 10, 360), fraction(Math.max(1, degrees - 10), 360)],
        solutionSteps: [`A full turn is 360°.`, `${degrees}/360 in lowest terms is ${fraction(degrees, 360)}.`],
      }
    },
    oracle: ({ degrees }) => fraction(degrees, 360),
    referenceExample: {
      prompt: 'An angle turns through 90° of a full circle. What fraction of a full turn is this?',
      steps: ['90/360 reduces to 1/4.'],
      answer: '1/4',
    },
  }),

  spec<{ degrees: number }>({
    itemType: 'classify-angle-by-measure',
    standard: '4.MD.6',
    lessonFocus: 'measuring angles with a protractor and classifying them by measure',
    build: (difficulty, variant = 0) => {
      const basePools = difficulty === 1 ? [30, 45, 90, 150] : difficulty === 2 ? [20, 75, 110, 170] : [10, 89, 91, 179]
      const expandedPools = difficulty === 1
        ? [15, 25, 35, 50, 65, 80, 90, 105, 125, 145, 160, 175]
        : difficulty === 2
          ? [12, 28, 42, 58, 73, 87, 90, 98, 112, 128, 143, 158, 172]
          : [5, 17, 33, 49, 67, 83, 89, 90, 91, 107, 123, 139, 157, 173, 179]
      const degrees = choose(variant === 0 ? basePools : expandedPools)
      const classification = degrees === 90 ? 'right' : degrees === 180 ? 'straight' : degrees < 90 ? 'acute' : 'obtuse'
      return {
        prompt: `A protractor reads ${degrees}° for an angle. Classify the angle.`,
        parameters: { degrees },
        answer: classification,
        distractors: ['acute', 'right', 'obtuse', 'straight'].filter((c) => c !== classification),
        solutionSteps: [
          degrees === 90
            ? 'An angle of exactly 90° is a right angle.'
            : degrees < 90
              ? `An angle less than 90° (here, ${degrees}°) is acute.`
              : `An angle greater than 90° and less than 180° (here, ${degrees}°) is obtuse.`,
        ],
      }
    },
    oracle: ({ degrees }) => (degrees === 90 ? 'right' : degrees === 180 ? 'straight' : degrees < 90 ? 'acute' : 'obtuse'),
    referenceExample: {
      prompt: 'A protractor reads 120° for an angle. Classify the angle.',
      steps: ['120° is greater than 90° and less than 180°, so it is obtuse.'],
      answer: 'obtuse',
    },
  }),

  spec<{ total: number; known: number }>({
    itemType: 'find-unknown-angle-additive',
    standard: '4.MD.7',
    lessonFocus: 'finding an unknown angle measure using the additive property of angle measure',
    build: (difficulty) => {
      const total = difficulty === 1 ? choose([90, 180]) : difficulty === 2 ? rand(90, 180) : rand(100, 350)
      const known = rand(10, total - 10)
      const unknown = total - known
      return {
        prompt: `Two adjacent angles share a ray and together measure ${total}°. One of the angles measures ${known}°. What does the other angle measure?`,
        parameters: { total, known },
        answer: `${unknown}°`,
        distractors: numericDistractors(unknown, [total, known, total + known]).map((v) => `${v}°`),
        solutionSteps: [`The two adjacent angles add up to ${total}°.`, `${total} − ${known} = ${unknown}.`],
      }
    },
    oracle: ({ total, known }) => `${total - known}°`,
    referenceExample: {
      prompt: 'Two adjacent angles together measure 90°. One measures 35°. What does the other measure?',
      steps: ['90 − 35 = 55.'],
      answer: '55°',
    },
  }),

  spec<{ start: number; rule: number; ruleIsAdd: number; position: number }>({
    itemType: 'number-or-shape-pattern-capstone',
    standard: '4.OA.5',
    lessonFocus: 'generating and analyzing a number pattern that follows a given rule',
    build: (difficulty) => {
      const ruleIsAdd = rand(0, 1)
      const start = rand(1, 8)
      const rule = ruleIsAdd === 1 ? rand(2, difficulty === 3 ? 9 : 6) : rand(2, 3)
      const position = rand(5, 6)
      let value = start
      const sequence = [start]
      for (let i = 1; i < position; i += 1) {
        value = ruleIsAdd === 1 ? value + rule : value * rule
        sequence.push(value)
      }
      const shown = sequence.slice(0, 4)
      return {
        prompt: `The pattern ${shown.join(', ')}, ... follows the rule "${ruleIsAdd === 1 ? `add ${rule}` : `multiply by ${rule}`} each time." What is the ${position}th term?`,
        parameters: { start, rule, ruleIsAdd, position },
        answer: String(value),
        distractors: numericDistractors(value, [ruleIsAdd === 1 ? value + rule : value * rule, ruleIsAdd === 1 ? value - rule : Math.floor(value / rule), start * position]),
        solutionSteps: [`Continue the rule from ${start}: ${sequence.join(', ')}.`, `The ${position}th term is ${value}.`],
      }
    },
    oracle: ({ start, rule, ruleIsAdd, position }) => {
      let value = start
      for (let i = 1; i < position; i += 1) value = ruleIsAdd === 1 ? value + rule : value * rule
      return String(value)
    },
    referenceExample: {
      prompt: 'The pattern 1, 5, 9, 13, ... follows the rule "add 4 each time." What is the 6th term?',
      steps: ['1, 5, 9, 13, 17, 21.', 'The 6th term is 21.'],
      answer: '21',
    },
  }),
])
