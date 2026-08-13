import { makeG34UnitBank, numericDistractors, rand, renderedDistractors, spec } from './core.ts'

/** Grade 4 Unit 9 — Measurement, Conversion, and Data (4.MD.1, 4.MD.2, 4.MD.3, 4.MD.4). */

const CONVERSIONS = [
  { from: 'meters', fromSingular: 'meter', to: 'centimeters', toSingular: 'centimeter', factor: 100 },
  { from: 'kilograms', fromSingular: 'kilogram', to: 'grams', toSingular: 'gram', factor: 1000 },
  { from: 'liters', fromSingular: 'liter', to: 'milliliters', toSingular: 'milliliter', factor: 1000 },
  { from: 'feet', fromSingular: 'foot', to: 'inches', toSingular: 'inch', factor: 12 },
] as const

/** Grammatical unit label agreeing with `count` (1 meter vs 2 meters). */
const unitLabel = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural

export const GRADE4_UNIT9 = makeG34UnitBank(4, 9, [
  spec<{ value: number; convIndex: number }>({
    itemType: 'convert-measurement-units',
    standard: '4.MD.1',
    lessonFocus: 'converting a measurement to a smaller unit within the same system',
    build: (difficulty) => {
      const convIndex = rand(0, CONVERSIONS.length - 1)
      const conv = CONVERSIONS[convIndex]
      const value = difficulty === 1 ? rand(1, 6) : difficulty === 2 ? rand(2, 12) : rand(3, 20)
      const converted = value * conv.factor
      const fromLabel = unitLabel(value, conv.fromSingular, conv.from)
      return {
        prompt: `Convert ${value} ${fromLabel} to ${conv.to}.`,
        parameters: { value, convIndex },
        answer: `${converted} ${conv.to}`,
        distractors: renderedDistractors(converted, [value, value + conv.factor, converted / 10], (v) => `${v} ${conv.to}`, 3),
        solutionSteps: [
          `1 ${conv.fromSingular} = ${conv.factor} ${conv.to}.`,
          `${value} × ${conv.factor} = ${converted}.`,
          `${value} ${fromLabel} = ${converted} ${conv.to}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${value} ${unitLabel(value, conv.toSingular, conv.to)} instead of ${converted} ${conv.to}.`,
            likelyCause: 'Kept the original number instead of multiplying by the conversion factor.',
            remediation: 'Have the learner state the conversion factor out loud before converting.',
          },
        ],
      }
    },
    oracle: ({ value, convIndex }) => `${value * CONVERSIONS[convIndex].factor} ${CONVERSIONS[convIndex].to}`,
    referenceExample: {
      prompt: 'Convert 3 meters to centimeters.',
      steps: ['1 meter = 100 centimeters.', '3 × 100 = 300.', '3 meters = 300 centimeters.'],
      answer: '300 centimeters',
    },
  }),

  spec<{ a: number; b: number; c: number; opFirst: number }>({
    itemType: 'measurement-word-problem',
    standard: '4.MD.2',
    lessonFocus: 'solving word problems involving distances, intervals of time, and money',
    build: (difficulty) => {
      const b = difficulty === 1 ? rand(2, 30) : difficulty === 2 ? rand(10, 100) : rand(50, 300)
      const c = rand(2, difficulty === 3 ? 10 : 5)
      const scaled = b * c
      const opFirst = rand(0, 1)
      // Choose `a` after `scaled` so a subtraction scenario can never go negative.
      const a = opFirst === 0
        ? (difficulty === 1 ? rand(5, 40) : difficulty === 2 ? rand(20, 150) : rand(100, 800))
        : scaled + (difficulty === 1 ? rand(5, 40) : difficulty === 2 ? rand(20, 150) : rand(100, 800))
      const finalResult = opFirst === 0 ? a + scaled : a - scaled
      return {
        prompt:
          opFirst === 0
            ? `A hiker walks ${a} meters, then walks ${c} more trips of ${b} meters each. How many meters total?`
            : `A tank has ${a} liters of water. ${c} containers of ${b} liters each are drained from it. How many liters remain?`,
        parameters: { a, b, c, opFirst },
        answer: String(finalResult),
        distractors: numericDistractors(finalResult, [a, scaled, a + scaled]),
        solutionSteps: [
          `First find the repeated amount: ${c} × ${b} = ${scaled}.`,
          opFirst === 0 ? `Then add: ${a} + ${scaled} = ${finalResult}.` : `Then subtract: ${a} − ${scaled} = ${finalResult}.`,
        ],
      }
    },
    oracle: ({ a, b, c, opFirst }) => String(opFirst === 0 ? a + b * c : a - b * c),
    referenceExample: {
      prompt: 'A runner covers 200 meters, then runs 4 more laps of 50 meters each. How many meters total?',
      steps: ['4 × 50 = 200.', '200 + 200 = 400.'],
      answer: '400',
    },
  }),

  spec<{ area: number; knownSide: number }>({
    itemType: 'area-perimeter-unknown-side',
    standard: '4.MD.3',
    lessonFocus: 'applying the area formula to find an unknown side length',
    build: (difficulty) => {
      const knownSide = rand(3, difficulty === 3 ? 12 : 8)
      const otherSide = rand(3, difficulty === 3 ? 15 : 9)
      const area = knownSide * otherSide
      return {
        prompt: `A rectangle has area ${area} square units and one side is ${knownSide} units. What is the length of the other side?`,
        parameters: { area, knownSide },
        answer: String(otherSide),
        distractors: numericDistractors(otherSide, [area - knownSide, knownSide, area]),
        solutionSteps: [`Area = length × width, so the missing side is ${area} ÷ ${knownSide}.`, `${area} ÷ ${knownSide} = ${otherSide}.`],
        commonErrors: [
          {
            observed: `Answered ${area - knownSide} instead of ${otherSide}.`,
            likelyCause: 'Subtracted the known side from the area instead of dividing.',
            remediation: 'Have the learner write the area formula with the unknown side as a blank before solving.',
          },
        ],
      }
    },
    oracle: ({ area, knownSide }) => String(area / knownSide),
    referenceExample: {
      prompt: 'A rectangle has area 48 square units and one side is 6 units. Find the other side.',
      steps: ['48 ÷ 6 = 8.'],
      answer: '8',
    },
  }),

  spec<{ values: number[]; queryValue: number; denom: number }>({
    itemType: 'line-plot-with-fractions',
    standard: '4.MD.4',
    lessonFocus: 'making a line plot of fractional measurements and using it to solve problems',
    build: (difficulty) => {
      const denom = difficulty === 1 ? 2 : difficulty === 2 ? 4 : 8
      const length = difficulty === 1 ? 6 : 8
      const values = Array.from({ length }, () => rand(1, denom))
      const uniqueValues = [...new Set(values)]
      const queryValue = uniqueValues[rand(0, uniqueValues.length - 1)]
      const total = values.filter((v) => v === queryValue).reduce((sum) => sum + queryValue, 0)
      return {
        prompt: `A line plot shows ${length} ribbon lengths to the nearest 1/${denom} yard: ${values.map((v) => `${v}/${denom}`).join(', ')}. What is the combined length, in a fraction of a yard, of all ribbons measuring exactly ${queryValue}/${denom} yard?`,
        parameters: { values, queryValue, denom },
        answer: `${total}/${denom}`,
        distractors: [`${total + 1}/${denom}`, `${total > 1 ? total - 1 : total + 2}/${denom}`, `${total}/${denom * 2}`],
        solutionSteps: [
          `${values.filter((v) => v === queryValue).length} ribbons measure exactly ${queryValue}/${denom} yard.`,
          `Add ${queryValue}/${denom} that many times: total = ${total}/${denom} yard.`,
        ],
      }
    },
    oracle: ({ values, queryValue, denom }) => {
      const count = values.filter((v) => v === queryValue).length
      return `${count * queryValue}/${denom}`
    },
    referenceExample: {
      prompt: 'A line plot shows ribbon lengths to the nearest 1/4 yard: 1/4, 1/4, 2/4, 3/4. What is the combined length of ribbons measuring exactly 1/4 yard?',
      steps: ['Two ribbons measure 1/4 yard.', '1/4 + 1/4 = 2/4 yard.'],
      answer: '2/4',
    },
  }),
])
