import { makeHsUnitBank, rand, spec } from './core.ts'

/** Grade 12 Unit 1 — Advanced Trigonometry: Unit Circle and Identities (F-TF.3, 4, 9). */

/** Exact values at the special angles, extended around the full circle. */
const SPECIAL = [
  { degrees: 120, radians: '2π/3', sin: '√3/2', cos: '−1/2', reference: '60°', quadrant: 2 },
  { degrees: 135, radians: '3π/4', sin: '√2/2', cos: '−√2/2', reference: '45°', quadrant: 2 },
  { degrees: 150, radians: '5π/6', sin: '1/2', cos: '−√3/2', reference: '30°', quadrant: 2 },
  { degrees: 210, radians: '7π/6', sin: '−1/2', cos: '−√3/2', reference: '30°', quadrant: 3 },
  { degrees: 225, radians: '5π/4', sin: '−√2/2', cos: '−√2/2', reference: '45°', quadrant: 3 },
  { degrees: 240, radians: '4π/3', sin: '−√3/2', cos: '−1/2', reference: '60°', quadrant: 3 },
  { degrees: 300, radians: '5π/3', sin: '−√3/2', cos: '1/2', reference: '60°', quadrant: 4 },
  { degrees: 330, radians: '11π/6', sin: '−1/2', cos: '√3/2', reference: '30°', quadrant: 4 },
] as const

export const GRADE12_UNIT1 = makeHsUnitBank(12, 1, [
  spec<{ index: number; which: number }>({
    itemType: 'exact-value-beyond-first-quadrant',
    standard: 'F-TF.3',
    lessonFocus: 'special triangles and exact trigonometric values',
    build: () => {
      const index = rand(0, SPECIAL.length - 1)
      const which = rand(0, 1)
      const entry = SPECIAL[index]
      const answer = which === 0 ? entry.sin : entry.cos
      return {
        prompt: `Give the exact value of ${which === 0 ? 'sin' : 'cos'}(${entry.radians}), which is ${entry.degrees}°.`,
        parameters: { index, which },
        answer,
        distractors: ['1/2', '−1/2', '√2/2', '−√2/2', '√3/2', '−√3/2'].filter(
          (value) => value !== answer,
        ),
        solutionSteps: [
          `${entry.degrees}° lies in quadrant ${entry.quadrant}, and its reference angle is ${entry.reference}.`,
          `The magnitude of the value equals the corresponding value at ${entry.reference}.`,
          entry.quadrant === 2
            ? 'In quadrant 2 sine is positive and cosine is negative.'
            : entry.quadrant === 3
              ? 'In quadrant 3 both sine and cosine are negative.'
              : 'In quadrant 4 sine is negative and cosine is positive.',
          `Applying that sign gives ${which === 0 ? 'sin' : 'cos'}(${entry.radians}) = ${answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Gave the reference-angle value with the wrong sign.',
            likelyCause: 'The quadrant was not checked after finding the magnitude.',
            remediation:
              'Sketch the terminal ray and read off the sign of the relevant coordinate before writing the answer.',
          },
        ],
      }
    },
    oracle: ({ index, which }) => (which === 0 ? SPECIAL[index].sin : SPECIAL[index].cos),
    referenceExample: {
      prompt: 'Give the exact value of cos(2π/3).',
      steps: ['120° is in quadrant 2 with reference 60°.', 'cos 60° = 1/2; cosine is negative there.'],
      answer: '−1/2',
    },
  }),

  spec<{ index: number }>({
    itemType: 'reference-angle-identification',
    standard: 'F-TF.4',
    lessonFocus: 'symmetry and periodicity of the unit circle',
    build: () => {
      const index = rand(0, SPECIAL.length - 1)
      const entry = SPECIAL[index]
      return {
        prompt: `Find the reference angle for ${entry.degrees}°, and name the quadrant it lies in.`,
        parameters: { index },
        answer: `${entry.reference}, quadrant ${entry.quadrant}`,
        distractors: [
          `${entry.degrees}°, quadrant ${entry.quadrant}`,
          `${entry.reference}, quadrant ${entry.quadrant === 4 ? 1 : entry.quadrant + 1}`,
          `${360 - entry.degrees}°, quadrant ${entry.quadrant}`,
          `${180 - entry.degrees}°, quadrant ${entry.quadrant}`,
        ],
        solutionSteps: [
          `${entry.degrees}° is between ${entry.quadrant === 2 ? '90° and 180°' : entry.quadrant === 3 ? '180° and 270°' : '270° and 360°'}, so it lies in quadrant ${entry.quadrant}.`,
          `The reference angle is the acute angle to the nearest part of the x-axis: ${entry.quadrant === 2 ? `180 − ${entry.degrees}` : entry.quadrant === 3 ? `${entry.degrees} − 180` : `360 − ${entry.degrees}`} = ${entry.reference}.`,
          `So the reference angle is ${entry.reference} in quadrant ${entry.quadrant}.`,
        ],
        commonErrors: [
          {
            observed: 'Subtracted from 180° regardless of the quadrant.',
            likelyCause: 'One reference-angle rule was applied to every quadrant.',
            remediation:
              'The reference angle is always measured to the x-axis; check which part of the axis is nearest.',
          },
        ],
      }
    },
    oracle: ({ index }) => `${SPECIAL[index].reference}, quadrant ${SPECIAL[index].quadrant}`,
    referenceExample: {
      prompt: 'Reference angle for 225°?',
      steps: ['225° is in quadrant 3.', '225 − 180 = 45°.'],
      answer: '45°, quadrant 3',
    },
  }),

  spec<{ which: number }>({
    itemType: 'apply-addition-formula',
    standard: 'F-TF.9',
    lessonFocus: 'the addition and subtraction formulas for sine and cosine',
    build: () => {
      const cases = [
        {
          prompt: 'sin(75°) using sin(45° + 30°)',
          answer: '(√6 + √2)/4',
          steps: [
            'sin(A + B) = sin A cos B + cos A sin B.',
            'sin 45° cos 30° + cos 45° sin 30° = (√2/2)(√3/2) + (√2/2)(1/2).',
            'That is √6/4 + √2/4 = (√6 + √2)/4.',
          ],
        },
        {
          prompt: 'cos(75°) using cos(45° + 30°)',
          answer: '(√6 − √2)/4',
          steps: [
            'cos(A + B) = cos A cos B − sin A sin B.',
            'cos 45° cos 30° − sin 45° sin 30° = (√2/2)(√3/2) − (√2/2)(1/2).',
            'That is √6/4 − √2/4 = (√6 − √2)/4.',
          ],
        },
        {
          prompt: 'sin(15°) using sin(45° − 30°)',
          answer: '(√6 − √2)/4',
          steps: [
            'sin(A − B) = sin A cos B − cos A sin B.',
            'sin 45° cos 30° − cos 45° sin 30° = (√2/2)(√3/2) − (√2/2)(1/2).',
            'That is √6/4 − √2/4 = (√6 − √2)/4.',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Find the exact value of ${entry.prompt}.`,
        parameters: { which },
        answer: entry.answer,
        distractors: ['(√6 + √2)/4', '(√6 − √2)/4', '(√2 − √6)/4', '√6/4', '(√3 + 1)/2'].filter(
          (value) => value !== entry.answer,
        ),
        solutionSteps: [
          ...entry.steps,
          'The point of the formula is that a non-special angle is expressed through two special ones, keeping the value exact.',
        ],
        commonErrors: [
          {
            observed: 'Used a plus sign in the cosine addition formula.',
            likelyCause: 'The sign convention differs between the sine and cosine formulas.',
            remediation:
              'Check the formula against a known case such as cos(90°) = cos(45° + 45°) = 0, which only the minus sign gives.',
          },
        ],
      }
    },
    oracle: ({ which }) => ['(√6 + √2)/4', '(√6 − √2)/4', '(√6 − √2)/4'][which],
    referenceExample: {
      prompt: 'Find sin(75°) exactly.',
      steps: ['sin(45° + 30°) = sin45cos30 + cos45sin30.', '= (√6 + √2)/4.'],
      answer: '(√6 + √2)/4',
    },
  }),

  spec<{ turns: number; index: number }>({
    itemType: 'periodicity-and-coterminal-angles',
    standard: 'F-TF.4',
    lessonFocus: 'using periodicity to evaluate trigonometric functions',
    build: (difficulty) => {
      const index = rand(0, SPECIAL.length - 1)
      const turns = rand(1, difficulty === 3 ? 4 : 2)
      const entry = SPECIAL[index]
      const angle = entry.degrees + 360 * turns
      return {
        prompt: `Evaluate sin(${angle}°) exactly, using the periodicity of sine.`,
        parameters: { turns, index },
        answer: entry.sin,
        distractors: ['1/2', '−1/2', '√2/2', '−√2/2', '√3/2', '−√3/2'].filter(
          (value) => value !== entry.sin,
        ),
        solutionSteps: [
          `Sine has period 360°, so adding or subtracting whole turns leaves the value unchanged.`,
          `Subtract ${turns} full turn${turns === 1 ? '' : 's'}: ${angle} − ${360 * turns} = ${entry.degrees}°.`,
          `So sin(${angle}°) = sin(${entry.degrees}°) = ${entry.sin}.`,
        ],
        commonErrors: [
          {
            observed: 'Treated the large angle as undefined or out of range.',
            likelyCause: 'The domain was assumed to stop at 360°.',
            remediation:
              'Trigonometric functions are defined for every real angle; reduce by whole turns first.',
          },
        ],
      }
    },
    oracle: ({ index }) => SPECIAL[index].sin,
    referenceExample: {
      prompt: 'Evaluate sin(480°).',
      steps: ['480 − 360 = 120°.', 'sin 120° = √3/2.'],
      answer: '√3/2',
    },
  }),
])
