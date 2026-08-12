import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 10 — Measurement, Modeling, and Design (G-GMD.1, 3, 4, G-MG.1, 2, 3). */

export const GRADE10_UNIT10 = makeHsUnitBank(10, 10, [
  spec<{ shape: number; a: number; b: number }>({
    itemType: 'volume-of-solid',
    standard: 'G-GMD.3',
    lessonFocus: 'volume formulas for prisms, cylinders, cones, and pyramids',
    build: (difficulty) => {
      const shape = rand(0, 3)
      const a = rand(2, difficulty === 3 ? 12 : 7)
      const b = rand(2, difficulty === 3 ? 12 : 7)
      const values = [
        { name: `a cylinder of radius ${a} and height ${b}`, volume: `${a * a * b}π`, wrong: `${2 * a * b}π` },
        { name: `a cone of radius ${a} and height ${b}`, volume: `${a * a * b}π/3`, wrong: `${a * a * b}π` },
        { name: `a rectangular prism ${a} by ${b} by ${a}`, volume: `${a * b * a}`, wrong: `${2 * (a * b + a * a + a * b)}` },
        { name: `a square pyramid with base edge ${a} and height ${b}`, volume: `${a * a * b}/3`, wrong: `${a * a * b}` },
      ]
      const entry = values[shape]
      return {
        prompt: `Find the volume of ${entry.name}. Leave π in the answer where it appears.`,
        parameters: { shape, a, b },
        answer: entry.volume,
        distractors: [
          entry.wrong,
          ...values.filter((_, index) => index !== shape).map((other) => other.volume),
        ],
        solutionSteps: [
          shape === 0
            ? `A cylinder's volume is the base area times the height: π(${a})²(${b}).`
            : shape === 1
              ? `A cone has one third the volume of the cylinder with the same base and height: (1/3)π(${a})²(${b}).`
              : shape === 2
                ? `A rectangular prism's volume is the product of its three dimensions: ${a} × ${b} × ${a}.`
                : `A pyramid has one third the volume of the prism with the same base and height: (1/3)(${a})²(${b}).`,
          `Evaluating gives ${entry.volume}.`,
          shape === 1 || shape === 3
            ? 'The factor of one third is what distinguishes a cone or pyramid from the cylinder or prism it sits inside.'
            : 'No fractional factor applies here, because the solid has uniform cross-section.',
        ],
        commonErrors: [
          {
            observed: `Answered ${entry.wrong}.`,
            likelyCause:
              shape === 1 || shape === 3
                ? 'The one-third factor for a tapering solid was omitted.'
                : 'A surface-area or perimeter formula was used in place of the volume formula.',
            remediation:
              'State the formula in words before substituting, and check that the result has three dimensions of length.',
          },
        ],
      }
    },
    oracle: ({ shape, a, b }) =>
      [`${a * a * b}π`, `${a * a * b}π/3`, `${a * b * a}`, `${a * a * b}/3`][shape],
    referenceExample: {
      prompt: 'Volume of a cone with radius 3 and height 4?',
      steps: ['Cylinder would be π(9)(4) = 36π.', 'A cone is one third: 12π.'],
      answer: '12π',
    },
  }),

  spec<{ shape: number; cut: number }>({
    itemType: 'cross-section-identification',
    standard: 'G-GMD.4',
    lessonFocus: 'two-dimensional cross-sections of three-dimensional objects',
    build: () => {
      const cases = [
        { text: 'a cylinder cut by a plane parallel to its base', answer: 'a circle' },
        { text: 'a cylinder cut by a plane perpendicular to its base through the axis', answer: 'a rectangle' },
        { text: 'a cone cut by a plane parallel to its base', answer: 'a circle' },
        { text: 'a square pyramid cut by a plane parallel to its base', answer: 'a square' },
        { text: 'a sphere cut by any plane that meets it in more than one point', answer: 'a circle' },
      ]
      const shape = rand(0, cases.length - 1)
      const entry = cases[shape]
      return {
        prompt: `Describe the cross-section formed by ${entry.text}.`,
        parameters: { shape, cut: 0 },
        answer: entry.answer,
        distractors: ['a circle', 'a rectangle', 'a square', 'a triangle', 'an ellipse'].filter(
          (value) => value !== entry.answer,
        ),
        solutionSteps: [
          `Visualise the plane slicing the solid and ask what the boundary of the exposed face looks like.`,
          shape === 1
            ? 'Cutting straight down through the axis exposes the height on two sides and the diameter across, giving a rectangle.'
            : 'A cut parallel to the base reproduces the shape of the base, at the same size for a prism or cylinder and smaller for a cone or pyramid.',
          `The cross-section is ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Named the shape of the solid rather than the shape of the slice.',
            likelyCause: 'The three-dimensional object was described instead of the two-dimensional face.',
            remediation:
              'Ask what a flat photograph of the exposed surface would show.',
          },
        ],
      }
    },
    oracle: ({ shape }) =>
      ['a circle', 'a rectangle', 'a circle', 'a square', 'a circle'][shape],
    referenceExample: {
      prompt: 'Cross-section of a cylinder cut parallel to the base?',
      steps: ['The slice matches the base.', 'The base is a circle.'],
      answer: 'a circle',
    },
  }),

  spec<{ mass: number; volume: number }>({
    itemType: 'density-modelling',
    standard: 'G-MG.2',
    lessonFocus: 'density as a modelling concept',
    build: (difficulty) => {
      const volume = rand(2, difficulty === 3 ? 25 : 12)
      const density = rand(2, difficulty === 3 ? 15 : 9)
      const mass = volume * density
      return {
        prompt: `A solid object has mass ${mass} g and volume ${volume} cm³. Find its density, and state whether it would float in water (density 1 g/cm³).`,
        parameters: { mass, volume },
        answer: `${density} g/cm³; it would sink`,
        distractors: [
          `${density} g/cm³; it would float`,
          `${mass * volume} g/cm³; it would sink`,
          `${Math.round((volume / mass) * 100) / 100} g/cm³; it would float`,
          `${density + 1} g/cm³; it would sink`,
        ],
        solutionSteps: [
          `Density is mass per unit volume: ${mass} ÷ ${volume} = ${density} g/cm³.`,
          `An object sinks in water when its density exceeds that of water, 1 g/cm³.`,
          `Since ${density} > 1, the object would sink.`,
        ],
        commonErrors: [
          {
            observed: 'Divided volume by mass.',
            likelyCause: 'The ratio was inverted.',
            remediation:
              'Check the units of the answer; density must come out in grams per cubic centimetre.',
          },
        ],
      }
    },
    oracle: ({ mass, volume }) => {
      const density = mass / volume
      return `${density} g/cm³; it would ${density > 1 ? 'sink' : 'float'}`
    },
    referenceExample: {
      prompt: 'Mass 48 g, volume 6 cm³. Density and float?',
      steps: ['48 ÷ 6 = 8 g/cm³.', '8 > 1, so it sinks.'],
      answer: '8 g/cm³; it would sink',
    },
  }),

  spec<{ area: number; unitCost: number }>({
    itemType: 'design-constraint-modelling',
    standard: 'G-MG.3',
    lessonFocus: 'applying geometric methods to a design constraint',
    build: (difficulty) => {
      const side = rand(3, difficulty === 3 ? 20 : 12)
      const area = side * side
      const unitCost = rand(2, difficulty === 3 ? 25 : 12)
      return {
        prompt: `A square patio of side ${side} m is to be paved at $${unitCost} per square metre. Find the total cost, and state which quantity the cost is proportional to.`,
        parameters: { area, unitCost },
        answer: `$${area * unitCost}; the cost is proportional to the area`,
        distractors: [
          `$${4 * side * unitCost}; the cost is proportional to the perimeter`,
          `$${area * unitCost}; the cost is proportional to the side length`,
          `$${side * unitCost}; the cost is proportional to the area`,
          `$${area + unitCost}; the cost is proportional to the area`,
        ],
        solutionSteps: [
          `The patio's area is ${side} × ${side} = ${area} m².`,
          `Paving is charged per square metre, so the cost scales with area, not with perimeter or side length.`,
          `Total cost = ${area} × $${unitCost} = $${area * unitCost}.`,
          `Note that doubling the side would quadruple this cost, since area grows as the square of length.`,
        ],
        commonErrors: [
          {
            observed: `Used the perimeter and answered $${4 * side * unitCost}.`,
            likelyCause: 'A per-area rate was applied to a length.',
            remediation:
              'Match the units of the rate to the units of the measurement before multiplying.',
          },
        ],
      }
    },
    oracle: ({ area, unitCost }) =>
      `$${area * unitCost}; the cost is proportional to the area`,
    referenceExample: {
      prompt: 'A 5 m square patio at $10/m². Total cost?',
      steps: ['Area 25 m².', '25 × 10 = $250.'],
      answer: '$250',
    },
  }),
])
