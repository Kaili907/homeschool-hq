import { makeG34UnitBank, rand, spec } from './core.ts'

/** Grade 3 Unit 5 — Understanding Fractions as Numbers (3.G.2, 3.NF.1, 3.NF.2). */

const SHAPES = ['rectangle', 'circle', 'square'] as const

export const GRADE3_UNIT5 = makeG34UnitBank(3, 5, [
  spec<{ parts: number; shapeIndex: number }>({
    itemType: 'partition-shape-equal-areas',
    standard: '3.G.2',
    lessonFocus: 'partitioning shapes into parts with equal area and naming the unit fraction',
    build: (difficulty) => {
      const parts = difficulty === 1 ? [2, 3, 4][rand(0, 2)] : difficulty === 2 ? [4, 6, 8][rand(0, 2)] : [6, 8][rand(0, 1)]
      const shapeIndex = rand(0, SHAPES.length - 1)
      const shape = SHAPES[shapeIndex]
      return {
        prompt: `A ${shape} is partitioned into ${parts} parts of equal area. What fraction of the ${shape} does one part represent?`,
        parameters: { parts, shapeIndex },
        answer: `1/${parts}`,
        distractors: [`${parts}/1`, `1/${parts - 1}`, `1/${parts + 1}`, `${parts}/${parts}`],
        solutionSteps: [
          `The whole ${shape} is split into ${parts} parts, all the same size.`,
          `Each part is 1 out of ${parts} equal parts, written 1/${parts}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${parts}/1 instead of 1/${parts}.`,
            likelyCause: 'Swapped the number of parts and the count of parts being described, inverting the fraction.',
            remediation: 'Have the learner shade exactly one part and describe it as "1 out of how many equal parts."',
          },
        ],
      }
    },
    oracle: ({ parts }) => `1/${parts}`,
    referenceExample: {
      prompt: 'A rectangle is partitioned into 4 parts of equal area. What fraction does one part represent?',
      steps: ['4 equal parts make up the whole.', 'One part is 1/4.'],
      answer: '1/4',
    },
  }),

  spec<{ shaded: number; parts: number }>({
    itemType: 'identify-unit-fraction',
    standard: '3.NF.1',
    lessonFocus: 'naming a fraction a/b as a parts out of b equal parts',
    build: (difficulty) => {
      const parts = difficulty === 1 ? rand(2, 4) : difficulty === 2 ? [4, 6][rand(0, 1)] : [6, 8][rand(0, 1)]
      const shaded = rand(1, parts - 1)
      return {
        prompt: `A shape is divided into ${parts} equal parts. ${shaded} of the parts are shaded. What fraction of the shape is shaded?`,
        parameters: { shaded, parts },
        answer: `${shaded}/${parts}`,
        distractors: [`${parts}/${shaded}`, `${shaded}/${parts - 1}`, `${shaded - 1 < 1 ? shaded + 1 : shaded - 1}/${parts}`, `${shaded}/${parts + 1}`],
        solutionSteps: [
          `The whole is split into ${parts} equal parts, so the denominator is ${parts}.`,
          `${shaded} of those parts are shaded, so the numerator is ${shaded}.`,
          `The shaded fraction is ${shaded}/${parts}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${parts}/${shaded} instead of ${shaded}/${parts}.`,
            likelyCause: 'Put the total number of parts on top instead of on the bottom.',
            remediation: 'Remind the learner the denominator always names the equal parts the whole was split into.',
          },
        ],
      }
    },
    oracle: ({ shaded, parts }) => `${shaded}/${parts}`,
    referenceExample: {
      prompt: 'A shape is divided into 6 equal parts. 5 are shaded. What fraction is shaded?',
      steps: ['6 equal parts is the denominator.', '5 shaded parts is the numerator.', 'The fraction is 5/6.'],
      answer: '5/6',
    },
  }),

  spec<{ numerator: number; denominator: number }>({
    itemType: 'fraction-on-number-line',
    standard: '3.NF.2',
    lessonFocus: 'locating a fraction as a point on a number line between 0 and 1',
    build: (difficulty) => {
      const denominator = difficulty === 1 ? rand(2, 4) : difficulty === 2 ? [4, 6][rand(0, 1)] : [6, 8][rand(0, 1)]
      const numerator = rand(1, denominator - 1)
      return {
        prompt: `A number line from 0 to 1 is divided into ${denominator} equal lengths. What fraction names the point that is ${numerator} lengths from 0?`,
        parameters: { numerator, denominator },
        answer: `${numerator}/${denominator}`,
        distractors: [`${denominator}/${numerator}`, `${numerator}/${denominator - 1}`, `${denominator - numerator}/${denominator}`, `${numerator + 1}/${denominator}`],
        solutionSteps: [
          `Each of the ${denominator} equal lengths represents 1/${denominator}.`,
          `A point ${numerator} lengths from 0 is ${numerator} × 1/${denominator} = ${numerator}/${denominator}.`,
        ],
        commonErrors: [
          {
            observed: `Answered ${denominator - numerator}/${denominator} instead of ${numerator}/${denominator}.`,
            likelyCause: 'Counted the lengths remaining to 1 instead of the lengths already traveled from 0.',
            remediation: 'Have the learner count each equal length out loud starting from 0, stopping exactly at the labeled point.',
          },
        ],
      }
    },
    oracle: ({ numerator, denominator }) => `${numerator}/${denominator}`,
    referenceExample: {
      prompt: 'A number line from 0 to 1 is divided into 6 equal lengths. What fraction names the point 4 lengths from 0?',
      steps: ['Each length is 1/6.', '4 lengths from 0 is 4/6.'],
      answer: '4/6',
    },
  }),
])
