import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 12 Unit 3 — Triangle Laws for Non-Right Triangles (G-SRT.9, 10, 11). */

export const GRADE12_UNIT3 = makeHsUnitBank(12, 3, [
  spec<{ a: number; b: number; angleC: number }>({
    itemType: 'law-of-cosines-side',
    standard: 'G-SRT.10',
    lessonFocus: 'the law of cosines for a side',
    build: (difficulty) => {
      // 60° and 120° give exact cos values of ±1/2, keeping the answer rational.
      const angleC = rand(0, 1) === 0 ? 60 : 120
      const a = rand(2, difficulty === 3 ? 14 : 8)
      const b = rand(2, difficulty === 3 ? 14 : 8)
      const cosValue = angleC === 60 ? 0.5 : -0.5
      const cSquared = a * a + b * b - 2 * a * b * cosValue
      return {
        prompt: `In a triangle, sides a = ${a} and b = ${b} enclose an angle C = ${angleC}°. Find c², the square of the third side.`,
        parameters: { a, b, angleC },
        answer: String(cSquared),
        distractors: numericDistractors(cSquared, [
          a * a + b * b,
          a * a + b * b + 2 * a * b * cosValue,
          (a + b) * (a + b),
          Math.abs(a * a - b * b),
        ]),
        solutionSteps: [
          `The law of cosines gives c² = a² + b² − 2ab·cos C.`,
          `Here a² + b² = ${a * a} + ${b * b} = ${a * a + b * b}.`,
          `cos ${angleC}° = ${cosValue}, so 2ab·cos C = 2(${a})(${b})(${cosValue}) = ${2 * a * b * cosValue}.`,
          `c² = ${a * a + b * b} − ${2 * a * b * cosValue} = ${cSquared}.`,
          angleC === 120
            ? 'Because the angle is obtuse the cosine is negative, so the subtraction increases c² — the side opposite the largest angle is longest.'
            : 'Because the angle is acute the cosine is positive, so c² is less than a² + b².',
        ],
        commonErrors: [
          {
            observed: `Used the Pythagorean theorem and answered ${a * a + b * b}.`,
            likelyCause: 'The triangle was assumed to be right-angled.',
            remediation:
              'The Pythagorean theorem is the special case C = 90°, where the cosine term vanishes; check the given angle first.',
          },
        ],
      }
    },
    oracle: ({ a, b, angleC }) => {
      const cosValue = angleC === 60 ? 0.5 : -0.5
      return String(a * a + b * b - 2 * a * b * cosValue)
    },
    referenceExample: {
      prompt: 'a = 5, b = 8, C = 60°. Find c².',
      steps: ['25 + 64 = 89.', '2(5)(8)(0.5) = 40.', 'c² = 89 − 40 = 49.'],
      answer: '49',
    },
  }),

  spec<{ a: number; angleA: number; angleB: number }>({
    itemType: 'law-of-sines-side',
    standard: 'G-SRT.11',
    lessonFocus: 'the law of sines',
    build: (difficulty) => {
      const angleA = rand(30, 70)
      const angleB = rand(30, 140 - angleA)
      const a = rand(4, difficulty === 3 ? 30 : 16)
      const ratio = Math.sin((angleB * Math.PI) / 180) / Math.sin((angleA * Math.PI) / 180)
      const b = Math.round(a * ratio * 100) / 100
      return {
        prompt: `In a triangle, angle A = ${angleA}°, angle B = ${angleB}°, and side a = ${a} (opposite A). Find side b to two decimal places.`,
        parameters: { a, angleA, angleB },
        answer: String(b),
        distractors: numericDistractors(b, [
          Math.round((a / ratio) * 100) / 100,
          a,
          Math.round(a * (angleB / angleA) * 100) / 100,
          Math.round(a * 2 * 100) / 100,
        ]),
        solutionSteps: [
          `The law of sines states a/sin A = b/sin B, because each ratio equals the diameter of the circumscribed circle.`,
          `Rearrange for b: b = a·sin B / sin A.`,
          `sin ${angleB}° ≈ ${Math.round(Math.sin((angleB * Math.PI) / 180) * 10000) / 10000} and sin ${angleA}° ≈ ${Math.round(Math.sin((angleA * Math.PI) / 180) * 10000) / 10000}.`,
          `b = ${a} × ${Math.round(ratio * 10000) / 10000} ≈ ${b}.`,
        ],
        commonErrors: [
          {
            observed: `Used the ratio of the angles themselves and answered ${Math.round(a * (angleB / angleA) * 100) / 100}.`,
            likelyCause: 'Sides were assumed proportional to angles rather than to their sines.',
            remediation:
              'Compare a 30° and a 60° angle: the sides are not in a 1:2 ratio, which rules out proportionality to the angles.',
          },
        ],
      }
    },
    oracle: ({ a, angleA, angleB }) => {
      const sinA = Math.sin((angleA * Math.PI) / 180)
      const sinB = Math.sin((angleB * Math.PI) / 180)
      return String(Math.round(((a * sinB) / sinA) * 100) / 100)
    },
    referenceExample: {
      prompt: 'A = 30°, B = 45°, a = 10. Find b.',
      steps: ['b = 10·sin45/sin30.', 'b ≈ 14.14.'],
      answer: '14.14',
    },
  }),

  spec<{ a: number; b: number; angleC: number }>({
    itemType: 'triangle-area-from-two-sides-and-angle',
    standard: 'G-SRT.9',
    lessonFocus: 'deriving and using Area = ½ab·sin C',
    build: (difficulty) => {
      const angleC = [30, 90, 150][rand(0, difficulty === 1 ? 1 : 2)]
      const a = rand(2, difficulty === 3 ? 16 : 10) * 2
      const b = rand(2, difficulty === 3 ? 16 : 10)
      const sinValue = angleC === 90 ? 1 : 0.5
      const area = 0.5 * a * b * sinValue
      return {
        prompt: `A triangle has sides a = ${a} and b = ${b} enclosing an angle of ${angleC}°. Find its area exactly.`,
        parameters: { a, b, angleC },
        answer: String(area),
        distractors: numericDistractors(area, [a * b * sinValue, 0.5 * a * b, a * b, area * 2 + 1]),
        solutionSteps: [
          `Dropping a perpendicular from one vertex gives height h = b·sin C, so Area = ½ · a · h = ½ab·sin C.`,
          `sin ${angleC}° = ${sinValue}.`,
          `Area = ½ × ${a} × ${b} × ${sinValue} = ${area}.`,
          angleC === 150
            ? 'Note sin 150° = sin 30°, so an obtuse angle can give the same area as its supplement.'
            : 'With a right angle the formula reduces to the familiar ½ × base × height.',
        ],
        commonErrors: [
          {
            observed: `Omitted the factor of ½ and answered ${a * b * sinValue}.`,
            likelyCause: 'The parallelogram area formula was used instead of the triangle one.',
            remediation:
              'Recall the triangle is half of the parallelogram on the same two sides.',
          },
        ],
      }
    },
    oracle: ({ a, b, angleC }) => {
      const sinValue = angleC === 90 ? 1 : 0.5
      return String(0.5 * a * b * sinValue)
    },
    referenceExample: {
      prompt: 'a = 8, b = 5, enclosed angle 30°. Area?',
      steps: ['Area = ½(8)(5)sin30°.', '= ½(8)(5)(0.5) = 10.'],
      answer: '10',
    },
  }),

  spec<{ which: number }>({
    itemType: 'choose-triangle-law',
    standard: 'G-SRT.11',
    lessonFocus: 'selecting the law that the given information supports',
    build: () => {
      const cases = [
        { given: 'two sides and the angle between them (SAS)', answer: 'the law of cosines' },
        { given: 'all three sides (SSS)', answer: 'the law of cosines' },
        { given: 'two angles and any side (AAS or ASA)', answer: 'the law of sines' },
        { given: 'two sides and an angle not between them (SSA)', answer: 'the law of sines, with a check for the ambiguous case' },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `A triangle problem gives ${entry.given}. Which law should be used first?`,
        parameters: { which },
        answer: entry.answer,
        distractors: [
          'the law of cosines',
          'the law of sines',
          'the law of sines, with a check for the ambiguous case',
          'the Pythagorean theorem',
        ].filter((value) => value !== entry.answer),
        solutionSteps: [
          `The law of sines pairs a side with the angle opposite it, so it needs such a pair to be known.`,
          `The law of cosines relates all three sides to one angle, so it works when no side-angle pair is available.`,
          which === 0 || which === 1
            ? 'With SAS or SSS there is no known side-angle opposite pair, so the law of cosines must come first.'
            : which === 2
              ? 'With two angles the third follows from the angle sum, and any known side gives a complete pair, so the law of sines applies.'
              : 'SSA gives a side-angle pair, so the law of sines applies — but the configuration may admit two triangles, so the ambiguous case must be checked.',
          `Use ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Reached for the law of sines when only SAS was given.',
            likelyCause: 'The requirement for a known side-angle opposite pair was overlooked.',
            remediation:
              'Before choosing, check whether any side and its opposite angle are both known.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'the law of cosines',
        'the law of cosines',
        'the law of sines',
        'the law of sines, with a check for the ambiguous case',
      ][which],
    referenceExample: {
      prompt: 'Given SSS, which law?',
      steps: ['No side-angle pair is known.', 'The law of cosines applies.'],
      answer: 'the law of cosines',
    },
  }),
])
