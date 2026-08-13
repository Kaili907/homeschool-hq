import { makeHsUnitBank, nonZero, numericDistractors, polynomial, rand, renderRadical, simplifyRadical, spec } from './core.ts'

/** Grade 11 Unit 3 — Complex Numbers and Nonlinear Systems (N-CN.1, 2, 7, A-REI.7). */

const complex = (real: number, imaginary: number): string => {
  if (imaginary === 0) return String(real)
  const imaginaryPart =
    imaginary === 1 ? 'i' : imaginary === -1 ? '−i' : `${Math.abs(imaginary)}i`
  if (real === 0) return imaginary < 0 && Math.abs(imaginary) !== 1 ? `−${imaginaryPart}` : imaginaryPart
  return `${real} ${imaginary < 0 ? '−' : '+'} ${imaginary === -1 || imaginary === 1 ? 'i' : `${Math.abs(imaginary)}i`}`
}

export const GRADE11_UNIT3 = makeHsUnitBank(11, 3, [
  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'multiply-complex-numbers',
    standard: 'N-CN.2',
    lessonFocus: 'multiplying complex numbers using i² = −1',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound)
      const d = nonZero(bound)
      const real = a * c - b * d
      const imaginary = a * d + b * c
      return {
        prompt: `Multiply and write in the form a + bi: (${complex(a, b)})(${complex(c, d)}).`,
        parameters: { a, b, c, d },
        answer: complex(real, imaginary),
        distractors: [
          complex(a * c + b * d, a * d + b * c),
          complex(a * c, b * d),
          complex(real, a * d - b * c),
          complex(real + 1, imaginary),
        ],
        solutionSteps: [
          `Expand as with binomials: ${a}·${c} + ${a}·${d}i + ${b}i·${c} + ${b}i·${d}i.`,
          `That gives ${a * c} + ${a * d}i + ${b * c}i + ${b * d}i².`,
          `Replace i² with −1, so the last term becomes ${-b * d}.`,
          `Collect real and imaginary parts: (${a * c} ${-b * d < 0 ? '−' : '+'} ${Math.abs(b * d)}) + (${a * d} ${b * c < 0 ? '−' : '+'} ${Math.abs(b * c)})i = ${complex(real, imaginary)}.`,
        ],
        commonErrors: [
          {
            observed: `Left i² as +1 and answered ${complex(a * c + b * d, a * d + b * c)}.`,
            likelyCause: 'The defining property i² = −1 was not applied.',
            remediation:
              'Highlight the i² term before collecting, and substitute −1 for it as an explicit step.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d }) => {
      const real = a * c - b * d
      const imaginary = a * d + b * c
      if (imaginary === 0) return String(real)
      const part = imaginary === 1 || imaginary === -1 ? 'i' : `${Math.abs(imaginary)}i`
      if (real === 0) return imaginary < 0 && Math.abs(imaginary) !== 1 ? `−${part}` : imaginary < 0 ? '−i' : part
      return `${real} ${imaginary < 0 ? '−' : '+'} ${part}`
    },
    referenceExample: {
      prompt: 'Multiply (2 + 3i)(1 − 4i).',
      steps: ['2 − 8i + 3i − 12i².', 'i² = −1 gives 2 + 12 − 5i.', '14 − 5i.'],
      answer: '14 − 5i',
    },
  }),

  spec<{ b: number; c: number }>({
    itemType: 'quadratic-with-complex-solutions',
    standard: 'N-CN.7',
    lessonFocus: 'solving quadratics whose solutions are complex',
    build: (difficulty) => {
      // Force a negative discriminant so the roots are genuinely complex.
      const realPart = nonZero(difficulty === 3 ? 6 : 4)
      const imaginaryPart = rand(1, difficulty === 3 ? 6 : 4)
      const b = -2 * realPart
      const c = realPart * realPart + imaginaryPart * imaginaryPart
      return {
        prompt: `Solve ${polynomial([1, b, c])} = 0 over the complex numbers.`,
        parameters: { b, c },
        answer: `x = ${complex(realPart, imaginaryPart)} or x = ${complex(realPart, -imaginaryPart)}`,
        distractors: [
          `x = ${complex(-realPart, imaginaryPart)} or x = ${complex(-realPart, -imaginaryPart)}`,
          `x = ${complex(realPart, imaginaryPart)} only`,
          `x = ${realPart} or x = ${-realPart}`,
          `There are no solutions.`,
        ],
        solutionSteps: [
          `The discriminant is ${b}² − 4(1)(${c}) = ${b * b} − ${4 * c} = ${b * b - 4 * c}, which is negative, so the roots are complex.`,
          `Apply the quadratic formula: x = (${-b} ± √${b * b - 4 * c}) / 2.`,
          `Write √${b * b - 4 * c} as ${2 * imaginaryPart}i, since √(−1) = i.`,
          `x = (${-b} ± ${2 * imaginaryPart}i)/2 = ${complex(realPart, imaginaryPart)} or ${complex(realPart, -imaginaryPart)}. The roots are conjugates, as they must be for real coefficients.`,
        ],
        commonErrors: [
          {
            observed: 'Concluded that there are no solutions.',
            likelyCause: 'A negative discriminant was read as "no solutions" rather than "no real solutions".',
            remediation:
              'Distinguish the two questions explicitly: no real roots is not the same as no roots.',
          },
        ],
      }
    },
    oracle: ({ b, c }) => {
      const realPart = -b / 2
      const imaginaryPart = Math.sqrt(c - realPart * realPart)
      const render = (re: number, im: number): string => {
        const part = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`
        if (re === 0) return im < 0 ? `−${part}` : part
        return `${re} ${im < 0 ? '−' : '+'} ${part}`
      }
      return `x = ${render(realPart, imaginaryPart)} or x = ${render(realPart, -imaginaryPart)}`
    },
    referenceExample: {
      prompt: 'Solve x² − 4x + 13 = 0.',
      steps: ['Discriminant 16 − 52 = −36.', 'x = (4 ± 6i)/2 = 2 ± 3i.'],
      answer: 'x = 2 + 3i or x = 2 − 3i',
    },
  }),

  spec<{ m: number; k: number; r: number }>({
    itemType: 'linear-quadratic-system',
    standard: 'A-REI.7',
    lessonFocus: 'solving a system of a line and a circle or parabola',
    build: (difficulty) => {
      const r = rand(2, difficulty === 3 ? 8 : 5)
      const m = nonZero(difficulty === 3 ? 4 : 2)
      const k = nonZero(difficulty === 3 ? 6 : 4)
      // Intersect y = mx + k with the parabola y = x², arranged to have integer roots.
      const root1 = nonZero(difficulty === 3 ? 5 : 3)
      let root2 = nonZero(difficulty === 3 ? 5 : 3)
      if (root2 === root1) root2 = root1 > 0 ? root1 + 1 : root1 - 1
      const slope = root1 + root2
      const intercept = -root1 * root2
      const sorted = [root1, root2].sort((a, b) => a - b)
      return {
        prompt: `Solve the system y = x² and y = ${slope}x ${intercept < 0 ? '−' : '+'} ${Math.abs(intercept)}. Give the x-coordinates of the intersection points in increasing order.`,
        parameters: { m: slope, k: intercept, r },
        answer: sorted.join(', '),
        distractors: [
          sorted.map((value) => -value).sort((a, b) => a - b).join(', '),
          `${slope}, ${intercept}`,
          sorted.map((value) => value + 1).join(', '),
          `${sorted[0]}`,
          // Symmetric root pairs make the negated list coincide with the answer,
          // so keep shifted pairs available as guaranteed-distinct options.
          `${sorted[0] - 1}, ${sorted[1]}`,
          `${sorted[0]}, ${sorted[1] + 1}`,
        ],
        solutionSteps: [
          `Substitute y = x² into the linear equation: x² = ${slope}x ${intercept < 0 ? '−' : '+'} ${Math.abs(intercept)}.`,
          `Rearrange to a quadratic: ${polynomial([1, -slope, -intercept])} = 0.`,
          `Factor: (x ${-root1 < 0 ? '−' : '+'} ${Math.abs(root1)})(x ${-root2 < 0 ? '−' : '+'} ${Math.abs(root2)}) = 0.`,
          `The x-coordinates are ${sorted.join(' and ')}. Each gives a corresponding y from y = x².`,
        ],
        commonErrors: [
          {
            observed: 'Set the two right-hand sides equal but did not move all terms to one side before factoring.',
            likelyCause: 'The quadratic was factored while still in the form x² = mx + k.',
            remediation:
              'Require the equation to be written equal to zero before any factoring is attempted.',
          },
        ],
      }
    },
    oracle: ({ m, k }) => {
      // Roots of x² - m x - k = 0 recomputed from the coefficients.
      const discriminant = m * m + 4 * k
      const root = Math.sqrt(discriminant)
      const first = (m - root) / 2
      const second = (m + root) / 2
      return [first, second].sort((a, b) => a - b).join(', ')
    },
    referenceExample: {
      prompt: 'Solve y = x² and y = 5x − 6.',
      steps: ['x² − 5x + 6 = 0.', '(x − 2)(x − 3) = 0.', 'x = 2, 3.'],
      answer: '2, 3',
    },
  }),

  spec<{ power: number }>({
    itemType: 'powers-of-i',
    standard: 'N-CN.1',
    lessonFocus: 'the cyclic behaviour of powers of i',
    build: (difficulty) => {
      const power = rand(2, difficulty === 3 ? 60 : 20)
      const values = ['1', 'i', '−1', '−i']
      return {
        prompt: `Simplify i^${power}.`,
        parameters: { power },
        answer: values[power % 4],
        distractors: values.filter((value) => value !== values[power % 4]).concat([String(power)]),
        solutionSteps: [
          `The powers of i repeat with period 4: i¹ = i, i² = −1, i³ = −i, i⁴ = 1.`,
          `Divide the exponent by 4 and keep the remainder: ${power} ÷ 4 leaves remainder ${power % 4}.`,
          `A remainder of ${power % 4} corresponds to ${values[power % 4]}.`,
        ],
        commonErrors: [
          {
            observed: 'Used the quotient rather than the remainder.',
            likelyCause: 'The cycle position was read from the wrong part of the division.',
            remediation:
              'Write out i¹ through i⁴ and match the remainder to the position in that list.',
          },
        ],
      }
    },
    oracle: ({ power }) => ['1', 'i', '−1', '−i'][power % 4],
    referenceExample: {
      prompt: 'Simplify i^23.',
      steps: ['23 ÷ 4 leaves remainder 3.', 'i³ = −i.'],
      answer: '−i',
    },
  }),
])
