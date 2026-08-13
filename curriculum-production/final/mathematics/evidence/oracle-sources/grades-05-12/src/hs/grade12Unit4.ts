import { makeHsUnitBank, nonZero, numericDistractors, rand, renderRadical, simplifyRadical, spec } from './core.ts'

/** Grade 12 Unit 4 — The Complex Plane (N-CN.3, 4, 5, 6). */

const complex = (real: number, imaginary: number): string => {
  if (imaginary === 0) return String(real)
  const part = Math.abs(imaginary) === 1 ? 'i' : `${Math.abs(imaginary)}i`
  if (real === 0) return imaginary < 0 ? `−${part}` : part
  return `${real} ${imaginary < 0 ? '−' : '+'} ${part}`
}

export const GRADE12_UNIT4 = makeHsUnitBank(12, 4, [
  spec<{ a: number; b: number }>({
    itemType: 'modulus-and-conjugate',
    standard: 'N-CN.3',
    lessonFocus: 'conjugates and moduli of complex numbers',
    build: (difficulty) => {
      const triples: Array<[number, number]> = [
        [3, 4],
        [5, 12],
        [8, 15],
        [7, 24],
        [6, 8],
      ]
      const [magA, magB] = triples[rand(0, difficulty === 1 ? 1 : 4)]
      const a = rand(0, 1) === 0 ? magA : -magA
      const b = rand(0, 1) === 0 ? magB : -magB
      const modulus = Math.sqrt(a * a + b * b)
      return {
        prompt: `For z = ${complex(a, b)}, give the conjugate z̄ and the modulus |z|.`,
        parameters: { a, b },
        answer: `z̄ = ${complex(a, -b)}, |z| = ${modulus}`,
        distractors: [
          `z̄ = ${complex(-a, b)}, |z| = ${modulus}`,
          `z̄ = ${complex(-a, -b)}, |z| = ${modulus}`,
          `z̄ = ${complex(a, -b)}, |z| = ${Math.abs(a) + Math.abs(b)}`,
          `z̄ = ${complex(a, -b)}, |z| = ${a * a + b * b}`,
        ],
        solutionSteps: [
          `The conjugate negates only the imaginary part: z̄ = ${complex(a, -b)}.`,
          `The modulus is the distance from the origin in the complex plane: |z| = √(${a}² + ${b}²) = √${a * a + b * b}.`,
          `√${a * a + b * b} = ${modulus}.`,
          `Note z·z̄ = ${a * a + b * b} = |z|², which is always a non-negative real number.`,
        ],
        commonErrors: [
          {
            observed: `Reported the modulus as ${a * a + b * b}.`,
            likelyCause: 'The square root was not taken.',
            remediation:
              'The modulus is a distance, so it must satisfy the Pythagorean relation — take the root.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => {
      const conjugate =
        b === 0
          ? String(a)
          : (() => {
              const flipped = -b
              const part = Math.abs(flipped) === 1 ? 'i' : `${Math.abs(flipped)}i`
              if (a === 0) return flipped < 0 ? `−${part}` : part
              return `${a} ${flipped < 0 ? '−' : '+'} ${part}`
            })()
      return `z̄ = ${conjugate}, |z| = ${Math.sqrt(a * a + b * b)}`
    },
    referenceExample: {
      prompt: 'For z = 3 + 4i, give z̄ and |z|.',
      steps: ['Negate the imaginary part: 3 − 4i.', '|z| = √(9 + 16) = 5.'],
      answer: 'z̄ = 3 − 4i, |z| = 5',
    },
  }),

  spec<{ index: number }>({
    itemType: 'polar-form-of-complex-number',
    standard: 'N-CN.4',
    lessonFocus: 'rectangular and polar forms of a complex number',
    build: () => {
      const cases = [
        { rectangular: '1 + i', modulus: '√2', argument: '45°' },
        { rectangular: '−1 + i', modulus: '√2', argument: '135°' },
        { rectangular: '−1 − i', modulus: '√2', argument: '225°' },
        { rectangular: '1 − i', modulus: '√2', argument: '315°' },
        { rectangular: '2i', modulus: '2', argument: '90°' },
      ]
      const index = rand(0, cases.length - 1)
      const entry = cases[index]
      return {
        prompt: `Write ${entry.rectangular} in polar form, giving the modulus and an argument in [0°, 360°).`,
        parameters: { index },
        answer: `modulus ${entry.modulus}, argument ${entry.argument}`,
        distractors: cases
          .filter((_, i) => i !== index)
          .map((other) => `modulus ${other.modulus}, argument ${other.argument}`),
        solutionSteps: [
          `Plot the point in the complex plane, taking the real part as the horizontal coordinate and the imaginary part as the vertical one.`,
          `The modulus is the distance from the origin: ${entry.modulus}.`,
          `The argument is the angle measured counterclockwise from the positive real axis, chosen from the correct quadrant: ${entry.argument}.`,
          `So the polar form is ${entry.modulus}(cos ${entry.argument} + i sin ${entry.argument}).`,
        ],
        commonErrors: [
          {
            observed: 'Gave an argument in the wrong quadrant.',
            likelyCause: 'The inverse tangent was used without checking the signs of the parts.',
            remediation:
              'Plot the point first; the quadrant fixes which of the two candidate angles is correct.',
          },
        ],
      }
    },
    oracle: ({ index }) =>
      [
        'modulus √2, argument 45°',
        'modulus √2, argument 135°',
        'modulus √2, argument 225°',
        'modulus √2, argument 315°',
        'modulus 2, argument 90°',
      ][index],
    referenceExample: {
      prompt: 'Write 1 + i in polar form.',
      steps: ['Modulus √2.', 'The point is in quadrant 1 at 45°.'],
      answer: 'modulus √2, argument 45°',
    },
  }),

  spec<{ modA: number; argA: number; modB: number; argB: number }>({
    itemType: 'multiplication-as-rotation',
    standard: 'N-CN.5',
    lessonFocus: 'multiplication in the complex plane as rotation and scaling',
    build: (difficulty) => {
      const modA = rand(2, difficulty === 3 ? 6 : 4)
      const modB = rand(2, difficulty === 3 ? 6 : 4)
      const argA = [30, 45, 60, 90][rand(0, 3)]
      const argB = [30, 45, 60, 90][rand(0, 3)]
      return {
        prompt: `Complex numbers z and w have modulus ${modA} and ${modB} and arguments ${argA}° and ${argB}°. Give the modulus and argument of zw.`,
        parameters: { modA, argA, modB, argB },
        answer: `modulus ${modA * modB}, argument ${(argA + argB) % 360}°`,
        distractors: [
          `modulus ${modA + modB}, argument ${(argA + argB) % 360}°`,
          `modulus ${modA * modB}, argument ${argA * argB}°`,
          `modulus ${modA * modB}, argument ${Math.abs(argA - argB)}°`,
          `modulus ${modA + modB}, argument ${argA * argB}°`,
          // modA = modB = 2 makes sum and product coincide, and equal arguments
          // collapse the difference distractor, so keep explicit nudges.
          `modulus ${modA * modB + 1}, argument ${(argA + argB) % 360}°`,
          `modulus ${modA * modB}, argument ${(argA + argB + 15) % 360}°`,
        ],
        solutionSteps: [
          `In polar form, multiplying complex numbers multiplies their moduli and adds their arguments.`,
          `Moduli: ${modA} × ${modB} = ${modA * modB}.`,
          `Arguments: ${argA}° + ${argB}° = ${argA + argB}°${argA + argB >= 360 ? `, which reduces to ${(argA + argB) % 360}°` : ''}.`,
          `Geometrically, multiplying by w scales z by ${modB} and rotates it through ${argB}°.`,
        ],
        commonErrors: [
          {
            observed: `Added the moduli and answered ${modA + modB}.`,
            likelyCause: 'The rule for arguments was applied to moduli as well.',
            remediation:
              'Test with a real example: 2 × 3 = 6, so moduli multiply rather than add.',
          },
        ],
      }
    },
    oracle: ({ modA, argA, modB, argB }) =>
      `modulus ${modA * modB}, argument ${(argA + argB) % 360}°`,
    referenceExample: {
      prompt: 'Moduli 2 and 3, arguments 30° and 45°. Find zw.',
      steps: ['Multiply moduli: 6.', 'Add arguments: 75°.'],
      answer: 'modulus 6, argument 75°',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number }>({
    itemType: 'distance-and-midpoint-in-complex-plane',
    standard: 'N-CN.6',
    lessonFocus: 'distance and midpoint between complex numbers',
    build: (difficulty) => {
      const triples: Array<[number, number]> = [
        [3, 4],
        [6, 8],
        [5, 12],
        [8, 15],
      ]
      const [runValue, riseValue] = triples[rand(0, difficulty === 1 ? 1 : 3)]
      const a = nonZero(difficulty === 3 ? 8 : 5)
      const b = nonZero(difficulty === 3 ? 8 : 5)
      const c = a + runValue
      const d = b + riseValue
      const distance = Math.sqrt(runValue * runValue + riseValue * riseValue)
      const midpointReal = (a + c) / 2
      const midpointImaginary = (b + d) / 2
      return {
        prompt: `Let z = ${complex(a, b)} and w = ${complex(c, d)}. Find the distance |z − w| and the midpoint of the segment joining them.`,
        parameters: { a, b, c, d },
        answer: `distance ${distance}, midpoint ${complex(midpointReal, midpointImaginary)}`,
        distractors: [
          `distance ${runValue + riseValue}, midpoint ${complex(midpointReal, midpointImaginary)}`,
          `distance ${distance}, midpoint ${complex(c - a, d - b)}`,
          `distance ${distance * distance}, midpoint ${complex(midpointReal, midpointImaginary)}`,
          `distance ${distance}, midpoint ${complex(a + c, b + d)}`,
        ],
        solutionSteps: [
          `Treat the two complex numbers as points: z is (${a}, ${b}) and w is (${c}, ${d}).`,
          `The difference is z − w = ${complex(a - c, b - d)}, and its modulus is the distance.`,
          `|z − w| = √(${runValue}² + ${riseValue}²) = √${runValue * runValue + riseValue * riseValue} = ${distance}.`,
          `The midpoint is the average of the two numbers: (z + w)/2 = ${complex(midpointReal, midpointImaginary)}.`,
        ],
        commonErrors: [
          {
            observed: `Added the coordinate differences and answered a distance of ${runValue + riseValue}.`,
            likelyCause: 'The Pythagorean step was skipped.',
            remediation:
              'Distance in the plane is never the sum of the two differences; square, add, and take the root.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d }) => {
      const distance = Math.sqrt((c - a) ** 2 + (d - b) ** 2)
      const realPart = (a + c) / 2
      const imaginaryPart = (b + d) / 2
      const render = (re: number, im: number): string => {
        if (im === 0) return String(re)
        const part = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`
        if (re === 0) return im < 0 ? `−${part}` : part
        return `${re} ${im < 0 ? '−' : '+'} ${part}`
      }
      return `distance ${distance}, midpoint ${render(realPart, imaginaryPart)}`
    },
    referenceExample: {
      prompt: 'z = 1 + 2i, w = 4 + 6i. Distance and midpoint?',
      steps: ['Difference −3 − 4i, modulus 5.', 'Midpoint (1+4)/2 + (2+6)/2 i = 2.5 + 4i.'],
      answer: 'distance 5, midpoint 2.5 + 4i',
    },
  }),
])
