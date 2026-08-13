import { choose, makeG34UnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 3 Unit 8 — Data: Scaled Graphs and Measurement Line Plots (3.MD.3, 3.MD.4, 3.OA.8). */

const CATEGORY_SETS = [
  ['Apples', 'Bananas', 'Grapes', 'Oranges'],
  ['Red', 'Blue', 'Green', 'Yellow'],
  ['Dogs', 'Cats', 'Birds', 'Fish'],
] as const

export const GRADE3_UNIT8 = makeG34UnitBank(3, 8, [
  spec<{ scale: number; counts: number[]; askIndex: number; setIndex: number }>({
    itemType: 'scaled-bar-graph-reading',
    standard: '3.MD.3',
    lessonFocus: 'reading and interpreting a scaled bar graph',
    build: (difficulty) => {
      const scale = difficulty === 1 ? choose([1, 2]) : difficulty === 2 ? choose([2, 5]) : choose([5, 10])
      const setIndex = rand(0, CATEGORY_SETS.length - 1)
      const categories = CATEGORY_SETS[setIndex]
      const counts = categories.map(() => rand(1, 8) * scale)
      const askIndex = rand(0, categories.length - 1)
      return {
        prompt: `A scaled bar graph shows a survey where each bar length equals a count of ${scale} per symbol. The bar for "${categories[askIndex]}" is worth ${counts[askIndex] / scale} symbols. How many does "${categories[askIndex]}" represent?`,
        parameters: { scale, counts, askIndex, setIndex },
        answer: String(counts[askIndex]),
        distractors: numericDistractors(counts[askIndex], [counts[askIndex] / scale, counts[askIndex] + scale, counts[askIndex] - scale]),
        solutionSteps: [
          `Each symbol on the graph represents ${scale}.`,
          `"${categories[askIndex]}" has ${counts[askIndex] / scale} symbols.`,
          `${counts[askIndex] / scale} × ${scale} = ${counts[askIndex]}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${counts[askIndex] / scale} instead of ${counts[askIndex]}.`,
            likelyCause: 'Read the number of symbols directly without multiplying by the scale.',
            remediation: 'Have the learner state the scale out loud before reading any bar on the graph.',
          },
        ],
      }
    },
    oracle: ({ scale, counts, askIndex }) => String(counts[askIndex]),
    referenceExample: {
      prompt: 'A scaled bar graph uses a scale of 5 per symbol. A bar shows 3 symbols. What does that bar represent?',
      steps: ['3 symbols × 5 per symbol = 15.'],
      answer: '15',
    },
  }),

  spec<{ scale: number; countA: number; countB: number; setIndex: number }>({
    itemType: 'scaled-bar-graph-comparison',
    standard: '3.MD.3',
    lessonFocus: 'using a scaled bar graph to solve a comparison problem',
    build: (difficulty) => {
      const scale = difficulty === 1 ? choose([1, 2]) : difficulty === 2 ? choose([2, 5]) : choose([5, 10])
      const setIndex = rand(0, CATEGORY_SETS.length - 1)
      const categories = CATEGORY_SETS[setIndex]
      const symbolsA = rand(3, 9)
      const symbolsB = rand(1, symbolsA - 1)
      const countA = symbolsA * scale
      const countB = symbolsB * scale
      const diff = countA - countB
      return {
        prompt: `On a scaled bar graph with ${scale} per symbol, "${categories[0]}" has ${symbolsA} symbols and "${categories[1]}" has ${symbolsB} symbols. How many more does "${categories[0]}" have than "${categories[1]}"?`,
        parameters: { scale, countA, countB, setIndex },
        answer: String(diff),
        distractors: numericDistractors(diff, [symbolsA - symbolsB, countA + countB, countA]),
        solutionSteps: [
          `"${categories[0]}" is ${symbolsA} × ${scale} = ${countA}.`,
          `"${categories[1]}" is ${symbolsB} × ${scale} = ${countB}.`,
          `${countA} − ${countB} = ${diff}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${symbolsA - symbolsB} instead of ${diff}.`,
            likelyCause: 'Subtracted the number of symbols instead of the scaled counts.',
            remediation: 'Have the learner convert both bars to their real counts before comparing.',
          },
        ],
      }
    },
    oracle: ({ countA, countB }) => String(countA - countB),
    referenceExample: {
      prompt: 'With a scale of 2 per symbol, "Dogs" has 6 symbols and "Cats" has 4 symbols. How many more dogs than cats?',
      steps: ['Dogs: 6 × 2 = 12.', 'Cats: 4 × 2 = 8.', '12 − 8 = 4.'],
      answer: '4',
    },
  }),

  spec<{ values: number[]; queryValue: number }>({
    itemType: 'line-plot-measurement',
    standard: '3.MD.4',
    lessonFocus: 'reading a line plot of measurements in fractions of a unit',
    build: (difficulty) => {
      const denom = difficulty === 1 ? 2 : difficulty === 2 ? 4 : 8
      const length = difficulty === 1 ? 6 : 8
      const values = Array.from({ length }, () => rand(1, denom))
      const queryValue = choose(values)
      const count = values.filter((v) => v === queryValue).length
      return {
        prompt: `A line plot shows the lengths of ${length} leaves, each measured to the nearest 1/${denom} inch: ${values.map((v) => `${v}/${denom}`).join(', ')}. How many leaves measured exactly ${queryValue}/${denom} inch?`,
        parameters: { values, queryValue },
        answer: String(count),
        distractors: numericDistractors(count, [count + 1, Math.max(0, count - 1), values.length]),
        solutionSteps: [
          `Count how many of the recorded lengths equal ${queryValue}/${denom} inch.`,
          `There are ${count} leaves at that length.`,
        ],
      }
    },
    oracle: ({ values, queryValue }) => String(values.filter((v) => v === queryValue).length),
    referenceExample: {
      prompt: 'A line plot shows 5 pencil lengths to the nearest 1/2 inch: 1/2, 1/2, 1, 1, 3/2. How many pencils measured exactly 1/2 inch?',
      steps: ['Two of the recorded lengths are 1/2 inch.'],
      answer: '2',
    },
  }),

  spec<{ a: number; b: number; c: number; opFirst: number }>({
    itemType: 'two-step-word-problem-review',
    standard: '3.OA.8',
    lessonFocus: 'solving two-step word problems using the four operations',
    build: (difficulty) => {
      const a = rand(3, difficulty === 1 ? 6 : 9)
      const b = rand(3, difficulty === 3 ? 9 : 6)
      const c = rand(2, difficulty === 3 ? 20 : 12)
      const opFirst = rand(0, 1)
      const product = a * b
      const result = opFirst === 0 ? product + c : product - c
      const prompt =
        opFirst === 0
          ? `A survey collects ${a} groups of ${b} responses, then ${c} more responses come in. How many responses in all?`
          : `A survey collects ${a} groups of ${b} responses, then ${c} responses are removed as duplicates. How many responses are left?`
      return {
        prompt,
        parameters: { a, b, c, opFirst },
        answer: String(result),
        distractors: numericDistractors(result, [product, a + b + c, opFirst === 0 ? product - c : product + c]),
        solutionSteps: [
          `First find the group total: ${a} × ${b} = ${product}.`,
          opFirst === 0 ? `Then add: ${product} + ${c} = ${result}.` : `Then subtract: ${product} − ${c} = ${result}.`,
        ],
      }
    },
    oracle: ({ a, b, c, opFirst }) => String(opFirst === 0 ? a * b + c : a * b - c),
    referenceExample: {
      prompt: 'A class collects 4 groups of 7 cans, then 5 more cans arrive. How many cans in all?',
      steps: ['4 × 7 = 28.', '28 + 5 = 33.'],
      answer: '33',
    },
  }),
])
