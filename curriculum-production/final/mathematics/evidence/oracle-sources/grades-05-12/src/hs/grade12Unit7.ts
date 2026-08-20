import { makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 12 Unit 7 — Matrices, Transformations, and Systems (N-VM.6-11). */

export const GRADE12_UNIT7 = makeHsUnitBank(12, 7, [
  spec<{ a: number; b: number; c: number; d: number; k: number }>({
    itemType: 'scalar-multiple-of-matrix',
    standard: 'N-VM.7',
    lessonFocus: 'multiplying a matrix by a scalar',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 9 : 5
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      const d = nonZero(bound)
      const k = nonZero(difficulty === 3 ? 5 : 3, 2)
      return {
        prompt: `Compute ${k}·[[${a}, ${b}], [${c}, ${d}]].`,
        parameters: { a, b, c, d, k },
        answer: `[[${k * a}, ${k * b}], [${k * c}, ${k * d}]]`,
        distractors: [
          `[[${k * a}, ${b}], [${c}, ${d}]]`,
          `[[${k + a}, ${k + b}], [${k + c}, ${k + d}]]`,
          `[[${k * a}, ${k * b}], [${c}, ${d}]]`,
          `[[${k * d}, ${k * b}], [${k * c}, ${k * a}]]`,
        ],
        solutionSteps: [
          `Scalar multiplication multiplies every entry of the matrix by the scalar.`,
          `Top row: ${k} × ${a} = ${k * a} and ${k} × ${b} = ${k * b}.`,
          `Bottom row: ${k} × ${c} = ${k * c} and ${k} × ${d} = ${k * d}.`,
          `The result is [[${k * a}, ${k * b}], [${k * c}, ${k * d}]].`,
        ],
        commonErrors: [
          {
            observed: 'Multiplied only the first entry.',
            likelyCause: 'The scalar was distributed as if to a single number.',
            remediation:
              'Write the scalar beside each of the four entries before evaluating any of them.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d, k }) => `[[${k * a}, ${k * b}], [${k * c}, ${k * d}]]`,
    referenceExample: {
      prompt: 'Compute 3·[[1, 2], [3, 4]].',
      steps: ['Multiply every entry by 3.', '[[3, 6], [9, 12]].'],
      answer: '[[3, 6], [9, 12]]',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number; x: number; y: number }>({
    itemType: 'matrix-vector-product',
    standard: 'N-VM.11',
    lessonFocus: 'a matrix acting on a vector as a transformation',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 7 : 4
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      const d = nonZero(bound)
      const x = nonZero(bound)
      const y = nonZero(bound)
      const first = a * x + b * y
      const second = c * x + d * y
      return {
        prompt: `Compute [[${a}, ${b}], [${c}, ${d}]]·⟨${x}, ${y}⟩.`,
        parameters: { a, b, c, d, x, y },
        answer: `⟨${first}, ${second}⟩`,
        distractors: [
          `⟨${a * x}, ${d * y}⟩`,
          `⟨${second}, ${first}⟩`,
          `⟨${a * x + c * y}, ${b * x + d * y}⟩`,
          `⟨${first + 1}, ${second}⟩`,
          `⟨${first}, ${second + 1}⟩`,
          `⟨${first - 1}, ${second}⟩`,
        ],
        solutionSteps: [
          `Each output component is the dot product of a row of the matrix with the vector.`,
          `First component: (${a})(${x}) + (${b})(${y}) = ${a * x} + ${b * y} = ${first}.`,
          `Second component: (${c})(${x}) + (${d})(${y}) = ${c * x} + ${d * y} = ${second}.`,
          `So the image vector is ⟨${first}, ${second}⟩. The matrix has acted as a transformation of the plane.`,
        ],
        commonErrors: [
          {
            observed: 'Multiplied entry-by-entry instead of taking dot products of rows.',
            likelyCause: 'Matrix multiplication was treated like scalar multiplication.',
            remediation:
              'Trace a finger across a row and down the vector, summing the products as you go.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d, x, y }) => `⟨${a * x + b * y}, ${c * x + d * y}⟩`,
    referenceExample: {
      prompt: 'Compute [[1, 2], [3, 4]]·⟨5, 6⟩.',
      steps: ['1(5) + 2(6) = 17.', '3(5) + 4(6) = 39.'],
      answer: '⟨17, 39⟩',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'determinant-and-invertibility',
    standard: 'N-VM.10',
    lessonFocus: 'the determinant, the identity matrix, and invertibility',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      // Half the time force a singular matrix so both verdicts genuinely occur.
      const singular = rand(0, 1) === 0
      const d = singular ? (b * c) / a : nonZero(bound)
      const determinant = a * d - b * c
      return {
        prompt: `For M = [[${a}, ${b}], [${c}, ${d}]], find det(M) and state whether M is invertible.`,
        parameters: { a, b, c, d },
        answer: `det(M) = ${determinant}; M is ${determinant === 0 ? 'not invertible' : 'invertible'}`,
        distractors: numericDistractors(determinant === 0 ? 1 : 0, [
          a * d + b * c,
          a * c - b * d,
          determinant + 1,
        ])
          .map((value) => `det(M) = ${value}; M is ${Number(value) === 0 ? 'not invertible' : 'invertible'}`)
          .concat([
            `det(M) = ${determinant}; M is ${determinant === 0 ? 'invertible' : 'not invertible'}`,
            `det(M) = ${a * d + b * c}; M is invertible`,
          ]),
        solutionSteps: [
          `For a 2×2 matrix, det(M) = ad − bc.`,
          `Here ad = ${a} × ${d} = ${a * d} and bc = ${b} × ${c} = ${b * c}.`,
          `det(M) = ${a * d} − ${b * c} = ${determinant}.`,
          determinant === 0
            ? 'A zero determinant means the matrix collapses the plane onto a line, so no inverse exists.'
            : 'A non-zero determinant means the transformation is reversible, so the inverse exists.',
        ],
        commonErrors: [
          {
            observed: `Added the products and answered ${a * d + b * c}.`,
            likelyCause: 'The subtraction in the determinant formula was replaced by addition.',
            remediation:
              'Check against the identity matrix, whose determinant must be 1; addition gives the wrong value there.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d }) => {
      const determinant = a * d - b * c
      return `det(M) = ${determinant}; M is ${determinant === 0 ? 'not invertible' : 'invertible'}`
    },
    referenceExample: {
      prompt: 'Find det([[3, 1], [2, 4]]) and say whether it is invertible.',
      steps: ['3(4) − 1(2) = 10.', 'Non-zero, so invertible.'],
      answer: 'det = 10; invertible',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number; startingArea: number }>({
    itemType: 'determinant-as-area-scale-factor',
    standard: 'N-VM.11',
    lessonFocus: 'the determinant as the area scale factor of a transformation',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 6 : 4
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      let d = nonZero(bound)
      if (a * d - b * c === 0) d = d + (d >= 0 ? 1 : -1)
      const determinant = a * d - b * c
      const startingArea = rand(2, difficulty === 3 ? 20 : 10)
      return {
        prompt: `The matrix [[${a}, ${b}], [${c}, ${d}]] is applied to a region of area ${startingArea}. Find the area of the image.`,
        parameters: { a, b, c, d, startingArea },
        answer: String(Math.abs(determinant) * startingArea),
        distractors: numericDistractors(Math.abs(determinant) * startingArea, [
          determinant * startingArea === Math.abs(determinant) * startingArea
            ? Math.abs(determinant) * startingArea + 1
            : determinant * startingArea,
          startingArea,
          Math.abs(determinant),
          determinant * determinant * startingArea,
        ]),
        solutionSteps: [
          `A linear transformation scales every area by the absolute value of its determinant.`,
          `det = (${a})(${d}) − (${b})(${c}) = ${a * d} − ${b * c} = ${determinant}.`,
          `The scale factor is |${determinant}| = ${Math.abs(determinant)}; the sign only records whether orientation was reversed.`,
          `Image area = ${Math.abs(determinant)} × ${startingArea} = ${Math.abs(determinant) * startingArea}.`,
        ],
        commonErrors: [
          {
            observed: 'Used a negative determinant directly, giving a negative area.',
            likelyCause: 'The absolute value was omitted.',
            remediation:
              'Area is never negative; the determinant’s sign describes orientation, not size.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d, startingArea }) => String(Math.abs(a * d - b * c) * startingArea),
    referenceExample: {
      prompt: 'Matrix [[2, 0], [0, 3]] applied to area 5. Image area?',
      steps: ['det = 6.', '6 × 5 = 30.'],
      answer: '30',
    },
  }),
])
