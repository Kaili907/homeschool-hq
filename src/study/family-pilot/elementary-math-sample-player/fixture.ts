import type { LearnerMaterialDto } from '../final-app/learner-response'

const LESSON_REF = 'sample-g3-math-rounding-r1'

/**
 * Presentation-only Grade 3 rounding material. This is a local sample, not
 * canonical curriculum. It intentionally contains no score, answer key, or
 * correctness rule; worked examples are instructional content.
 */
export const ELEMENTARY_MATH_SAMPLE_MATERIAL: LearnerMaterialDto = Object.freeze({
  lessonRef: LESSON_REF,
  title: 'Rounding to the Nearest 10 and 100',
  format: 'structured',
  sections: Object.freeze([
    Object.freeze({
      sectionRef: `${LESSON_REF}:learn`,
      kind: 'lesson',
      title: 'Learn',
      body: 'Rounding helps us find a nearby number that is easier to use.\nFind the place you are rounding to.\nLook at the digit just to its right.\nIf that digit is 5 or more, round up. If it is 4 or less, keep the rounding digit the same.\nChange every digit to the right into a zero.',
    }),
    Object.freeze({
      sectionRef: `${LESSON_REF}:examples`,
      kind: 'instructional-example',
      title: 'Examples',
      directions: 'Open each example one step at a time.',
      items: Object.freeze([
        Object.freeze({
          itemRef: `${LESSON_REF}:example:1`,
          kind: 'worked-example',
          prompt: 'Round 347 to the nearest ten.',
          workedSolution: Object.freeze({ steps: Object.freeze([
            'Find the tens digit: 4.',
            'Look one place to the right. The ones digit is 7.',
            'Because 7 is 5 or more, round the tens digit up.',
            '347 rounds to 350.',
          ]) }),
        }),
        Object.freeze({
          itemRef: `${LESSON_REF}:example:2`,
          kind: 'worked-example',
          prompt: 'Round 641 to the nearest hundred.',
          workedSolution: Object.freeze({ steps: Object.freeze([
            'Find the hundreds digit: 6.',
            'Look one place to the right. The tens digit is 4.',
            'Because 4 is less than 5, keep the hundreds digit the same.',
            '641 rounds to 600.',
          ]) }),
        }),
        Object.freeze({
          itemRef: `${LESSON_REF}:example:3`,
          kind: 'worked-example',
          prompt: 'Round 785 to the nearest hundred.',
          workedSolution: Object.freeze({ steps: Object.freeze([
            'Find the hundreds digit: 7.',
            'Look one place to the right. The tens digit is 8.',
            'Because 8 is 5 or more, round the hundreds digit up.',
            '785 rounds to 800.',
          ]) }),
        }),
      ]),
    }),
    Object.freeze({
      sectionRef: `${LESSON_REF}:guided`,
      kind: 'guided-practice',
      title: "Let's Try One",
      directions: 'Use each small clue to build your answer.',
      items: Object.freeze([
        Object.freeze({
          itemRef: `${LESSON_REF}:guided:1`,
          kind: 'numeric-entry',
          prompt: 'What is the lower bounding hundred for 641?',
          responseType: 'NUMERIC',
        }),
        Object.freeze({
          itemRef: `${LESSON_REF}:guided:2`,
          kind: 'multiple-choice',
          prompt: 'To round 641 to the nearest hundred, which digit tells you whether to round up?',
          choices: Object.freeze([
            Object.freeze({ id: `${LESSON_REF}:guided:2:choice:1`, label: 'The 6 in the hundreds place' }),
            Object.freeze({ id: `${LESSON_REF}:guided:2:choice:2`, label: 'The 4 in the tens place' }),
            Object.freeze({ id: `${LESSON_REF}:guided:2:choice:3`, label: 'The 1 in the ones place' }),
          ]),
        }),
        Object.freeze({
          itemRef: `${LESSON_REF}:guided:3`,
          kind: 'numeric-entry',
          prompt: 'Round 641 to the nearest hundred.',
          responseType: 'NUMERIC',
        }),
      ]),
    }),
    Object.freeze({
      sectionRef: `${LESSON_REF}:independent`,
      kind: 'independent-practice',
      title: 'Your Turn',
      directions: 'Try one problem at a time.',
      items: Object.freeze([
        Object.freeze({ itemRef: `${LESSON_REF}:independent:1`, kind: 'numeric-entry', prompt: 'Round 263 to the nearest ten.', responseType: 'NUMERIC' }),
        Object.freeze({ itemRef: `${LESSON_REF}:independent:2`, kind: 'numeric-entry', prompt: 'Round 918 to the nearest hundred.', responseType: 'NUMERIC' }),
        Object.freeze({
          itemRef: `${LESSON_REF}:independent:3`, kind: 'multiple-choice',
          prompt: 'Which number rounds to 500 when rounded to the nearest hundred?',
          choices: Object.freeze([
            Object.freeze({ id: `${LESSON_REF}:independent:3:choice:1`, label: '431' }),
            Object.freeze({ id: `${LESSON_REF}:independent:3:choice:2`, label: '472' }),
            Object.freeze({ id: `${LESSON_REF}:independent:3:choice:3`, label: '551' }),
          ]),
        }),
        Object.freeze({ itemRef: `${LESSON_REF}:independent:4`, kind: 'numeric-entry', prompt: 'Round 76 to the nearest ten.', responseType: 'NUMERIC' }),
        Object.freeze({ itemRef: `${LESSON_REF}:independent:5`, kind: 'numeric-entry', prompt: 'Round 349 to the nearest hundred.', responseType: 'NUMERIC' }),
        Object.freeze({
          itemRef: `${LESSON_REF}:independent:6`, kind: 'multiple-choice',
          prompt: 'When rounding 824 to the nearest ten, which place do you look at?',
          choices: Object.freeze([
            Object.freeze({ id: `${LESSON_REF}:independent:6:choice:1`, label: 'Hundreds place' }),
            Object.freeze({ id: `${LESSON_REF}:independent:6:choice:2`, label: 'Tens place' }),
            Object.freeze({ id: `${LESSON_REF}:independent:6:choice:3`, label: 'Ones place' }),
          ]),
        }),
        Object.freeze({ itemRef: `${LESSON_REF}:independent:7`, kind: 'numeric-entry', prompt: 'Round 1,249 to the nearest hundred.', responseType: 'NUMERIC' }),
        Object.freeze({ itemRef: `${LESSON_REF}:independent:8`, kind: 'numeric-entry', prompt: 'Round 995 to the nearest ten.', responseType: 'NUMERIC' }),
        Object.freeze({
          itemRef: `${LESSON_REF}:independent:9`, kind: 'constructed-response',
          prompt: 'Mia says 452 rounds to 400 to the nearest hundred. Explain what you would ask Mia to check.',
          responseType: 'CONSTRUCTED_RESPONSE',
        }),
        Object.freeze({ itemRef: `${LESSON_REF}:independent:10`, kind: 'numeric-entry', prompt: 'Round 5,650 to the nearest hundred.', responseType: 'NUMERIC' }),
      ]),
    }),
    Object.freeze({
      sectionRef: `${LESSON_REF}:mastery`,
      kind: 'mastery-check',
      title: 'Check What You Know',
      directions: 'Show what you know, one question at a time.',
      items: Object.freeze([
        Object.freeze({ itemRef: `${LESSON_REF}:mastery:1`, kind: 'numeric-entry', prompt: 'Round 438 to the nearest ten.', responseType: 'NUMERIC' }),
        Object.freeze({ itemRef: `${LESSON_REF}:mastery:2`, kind: 'numeric-entry', prompt: 'Round 438 to the nearest hundred.', responseType: 'NUMERIC' }),
        Object.freeze({
          itemRef: `${LESSON_REF}:mastery:3`, kind: 'multiple-choice',
          prompt: 'Which number rounds to 700 when rounded to the nearest hundred?',
          choices: Object.freeze([
            Object.freeze({ id: `${LESSON_REF}:mastery:3:choice:1`, label: '642' }),
            Object.freeze({ id: `${LESSON_REF}:mastery:3:choice:2`, label: '681' }),
            Object.freeze({ id: `${LESSON_REF}:mastery:3:choice:3`, label: '751' }),
          ]),
        }),
        Object.freeze({
          itemRef: `${LESSON_REF}:mastery:4`, kind: 'constructed-response',
          prompt: 'Explain how the digit to the right helps you round a number.',
          responseType: 'CONSTRUCTED_RESPONSE',
        }),
      ]),
    }),
  ]),
})

export const ELEMENTARY_MATH_SAMPLE_LESSON_REF = LESSON_REF
