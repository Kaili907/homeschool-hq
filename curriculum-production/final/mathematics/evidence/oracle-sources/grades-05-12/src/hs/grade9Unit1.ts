import {
  choose,
  fraction,
  gcd,
  makeHsUnitBank,
  numericDistractors,
  rand,
  renderRadical,
  simplifyRadical,
  spec,
} from './core.ts'

/** Grade 9 Unit 1 — Quantitative Reasoning, Units, and Rational Exponents (N-Q, N-RN). */

const RATE_CONVERSIONS = [
  { from: 'meters per second', to: 'kilometers per hour', factor: 3.6, context: 'a conveyor belt' },
  { from: 'liters per minute', to: 'liters per hour', factor: 60, context: 'an irrigation pump' },
  { from: 'kilometers per hour', to: 'meters per minute', factor: 1000 / 60, context: 'a delivery drone' },
  { from: 'grams per second', to: 'kilograms per hour', factor: 3.6, context: 'a bottling line' },
] as const

const round2 = (value: number): number => Math.round(value * 100) / 100

export const GRADE9_UNIT1 = makeHsUnitBank(9, 1, [
  spec<{ value: number; factorIndex: number }>({
    itemType: 'derived-rate-conversion',
    standard: 'N-Q.1',
    lessonFocus: 'quantities, units, and derived rates in context',
    build: (difficulty) => {
      const factorIndex = rand(0, RATE_CONVERSIONS.length - 1)
      const conversion = RATE_CONVERSIONS[factorIndex]
      const value = rand(difficulty === 1 ? 2 : 5, difficulty === 3 ? 90 : 40)
      const exact = round2(value * conversion.factor)
      return {
        prompt: `${conversion.context.charAt(0).toUpperCase()}${conversion.context.slice(1)} operates at ${value} ${conversion.from}. Express this rate in ${conversion.to}.`,
        parameters: { value, factorIndex },
        answer: `${exact} ${conversion.to}`,
        distractors: [
          `${round2(value / conversion.factor)} ${conversion.to}`,
          `${value} ${conversion.to}`,
          `${round2(value * conversion.factor * 10)} ${conversion.to}`,
          `${round2(value + conversion.factor)} ${conversion.to}`,
        ],
        solutionSteps: [
          `The given rate is ${value} ${conversion.from}.`,
          `One ${conversion.from} equals ${round2(conversion.factor)} ${conversion.to}, so multiply rather than divide: the target unit is larger per unit time.`,
          `${value} × ${round2(conversion.factor)} = ${exact}.`,
          `The converted rate is ${exact} ${conversion.to}.`,
        ],
        commonErrors: [
          {
            observed: `Divided instead of multiplying and reported ${round2(value / conversion.factor)}.`,
            likelyCause: 'The conversion factor was applied in the wrong direction.',
            remediation:
              'Have the learner write the conversion as a fraction equal to 1 and cancel units explicitly, so the direction is forced by the units rather than chosen.',
          },
        ],
      }
    },
    oracle: ({ value, factorIndex }) => {
      const conversion = RATE_CONVERSIONS[factorIndex]
      return `${Math.round(value * conversion.factor * 100) / 100} ${conversion.to}`
    },
    referenceExample: {
      prompt: 'A pump moves 12 liters per minute. Express this rate in liters per hour.',
      steps: [
        'One minute is 1/60 of an hour, so one liter per minute is 60 liters per hour.',
        'Multiply: 12 × 60 = 720.',
        'The rate is 720 liters per hour.',
      ],
      answer: '720 liters per hour',
    },
  }),

  spec<{ m: number; n: number }>({
    itemType: 'radical-to-rational-exponent',
    standard: 'N-RN.1',
    lessonFocus: 'rational exponents and radical notation',
    build: (difficulty) => {
      const n = rand(2, difficulty === 1 ? 3 : 5)
      const m = rand(2, difficulty === 3 ? 9 : 5)
      return {
        prompt: `Rewrite the ${n === 2 ? 'square root' : `index-${n} radical`} expression ${n === 2 ? '√' : `${n}√`}(x^${m}) using a rational exponent, in lowest terms.`,
        parameters: { m, n },
        answer: `x^(${fraction(m, n)})`,
        distractors: [
          `x^(${fraction(n, m)})`,
          `x^(${m * n})`,
          `x^(${m - n})`,
          `${m}x^(1/${n})`,
        ],
        solutionSteps: [
          `The index of the radical becomes the denominator of the exponent and the power inside becomes the numerator.`,
          `So ${n === 2 ? '√' : `${n}√`}(x^${m}) = x^(${m}/${n}).`,
          `Reduce ${m}/${n} by their greatest common divisor ${gcd(m, n)}: x^(${fraction(m, n)}).`,
        ],
        commonErrors: [
          {
            observed: `Wrote x^(${fraction(n, m)}), inverting the exponent.`,
            likelyCause: 'The index was placed in the numerator instead of the denominator.',
            remediation:
              'Check against a known case: √(x²) = x, which only works if the index is the denominator.',
          },
        ],
      }
    },
    oracle: ({ m, n }) => `x^(${fraction(m, n)})`,
    referenceExample: {
      prompt: 'Rewrite ³√(x⁴) using a rational exponent.',
      steps: ['The index 3 is the denominator and the power 4 is the numerator.', '³√(x⁴) = x^(4/3).'],
      answer: 'x^(4/3)',
    },
  }),

  spec<{ root: number; n: number; m: number }>({
    itemType: 'evaluate-rational-exponent',
    standard: 'N-RN.2',
    lessonFocus: 'evaluating expressions with rational exponents',
    build: (difficulty) => {
      const n = rand(2, difficulty === 1 ? 2 : 3)
      const root = rand(2, difficulty === 3 ? 6 : 4)
      const m = rand(2, difficulty === 3 ? 5 : 3)
      const base = root ** n
      const value = root ** m
      return {
        prompt: `Evaluate ${base}^(${fraction(m, n)}) exactly.`,
        parameters: { root, n, m },
        answer: String(value),
        distractors: numericDistractors(value, [
          base * m,
          root ** (m + 1),
          Math.round((base * m) / n),
          root ** n * m,
          base + m,
        ]),
        solutionSteps: [
          `Write the base as a perfect power: ${base} = ${root}^${n}.`,
          `Then ${base}^(${m}/${n}) = (${root}^${n})^(${m}/${n}) = ${root}^(${n} × ${m}/${n}) = ${root}^${m}.`,
          `${root}^${m} = ${value}.`,
        ],
        commonErrors: [
          {
            observed: `Multiplied the base by the numerator and answered ${base * m}.`,
            likelyCause: 'The rational exponent was treated as a coefficient.',
            remediation:
              'Rewrite the exponent as a root of a power first, then evaluate the root before the power.',
          },
        ],
      }
    },
    oracle: ({ root, n, m }) => {
      const base = root ** n
      const recovered = Math.round(base ** (1 / n))
      return String(recovered ** m)
    },
    referenceExample: {
      prompt: 'Evaluate 27^(2/3).',
      steps: ['27 = 3³.', '27^(2/3) = (3³)^(2/3) = 3² = 9.'],
      answer: '9',
    },
  }),

  spec<{ radicand: number }>({
    itemType: 'simplify-radical-expression',
    standard: 'N-RN.2',
    lessonFocus: 'simplifying radical expressions',
    build: (difficulty) => {
      const square = rand(2, difficulty === 3 ? 7 : 4)
      const free = choose([2, 3, 5, 6, 7, 10, 11, 13, 15])
      const radicand = square * square * free
      const simplified = simplifyRadical(radicand)
      return {
        prompt: `Write √${radicand} in simplest radical form.`,
        parameters: { radicand },
        answer: renderRadical(simplified.outside, simplified.inside),
        // The unsimplified form √radicand is *equal* to the answer, so it can
        // never be offered as a distractor — a learner picking it would be right.
        distractors: [
          renderRadical(simplified.outside * 2, simplified.inside),
          renderRadical(simplified.inside, simplified.outside),
          String(simplified.outside * simplified.inside),
          renderRadical(simplified.outside + 1, simplified.inside),
          renderRadical(simplified.outside, simplified.inside + 1),
        ],
        solutionSteps: [
          `Factor ${radicand} so that a perfect square is separated: ${radicand} = ${simplified.outside * simplified.outside} × ${simplified.inside}.`,
          `√${radicand} = √${simplified.outside * simplified.outside} × √${simplified.inside}.`,
          `√${simplified.outside * simplified.outside} = ${simplified.outside}, so the result is ${renderRadical(simplified.outside, simplified.inside)}.`,
        ],
        commonErrors: [
          {
            observed: `Left the expression as √${radicand} instead of extracting the perfect square.`,
            likelyCause: 'No perfect-square factor was searched for.',
            remediation:
              'Have the learner list perfect squares up to the radicand and test divisibility from the largest down.',
          },
        ],
      }
    },
    oracle: ({ radicand }) => {
      let outside = 1
      let inside = radicand
      for (let factor = 2; factor * factor <= inside; factor += 1) {
        while (inside % (factor * factor) === 0) {
          inside /= factor * factor
          outside *= factor
        }
      }
      return inside === 1 ? String(outside) : outside === 1 ? `√${inside}` : `${outside}√${inside}`
    },
    referenceExample: {
      prompt: 'Write √72 in simplest radical form.',
      steps: ['72 = 36 × 2 and 36 is a perfect square.', '√72 = √36 × √2 = 6√2.'],
      answer: '6√2',
    },
  }),

  spec<{ kind: number; rational: number; radicand: number }>({
    itemType: 'rational-irrational-closure',
    standard: 'N-RN.3',
    lessonFocus: 'closure properties of rational and irrational numbers',
    build: () => {
      const kind = rand(0, 3)
      const rational = rand(2, 9)
      const radicand = choose([2, 3, 5, 6, 7, 10])
      const descriptions = [
        `the sum of the rational number ${rational} and the irrational number √${radicand}`,
        `the product of the non-zero rational number ${rational} and the irrational number √${radicand}`,
        `the product of the rational number 0 and the irrational number √${radicand}`,
        `the sum of the irrational numbers √${radicand} and −√${radicand}`,
      ]
      const answers = ['irrational', 'irrational', 'rational', 'rational']
      const reasons = [
        `If ${rational} + √${radicand} were rational, subtracting the rational ${rational} would make √${radicand} rational, which it is not.`,
        `If ${rational}√${radicand} were rational, dividing by the non-zero rational ${rational} would make √${radicand} rational, which it is not.`,
        `Zero times any real number is 0, and 0 is rational. The non-zero condition is exactly what this case drops.`,
        `The two irrational terms are additive inverses, so the sum is 0, which is rational. Irrationals are not closed under addition.`,
      ]
      return {
        prompt: `Classify ${descriptions[kind]} as rational or irrational, and be ready to justify it.`,
        parameters: { kind, rational, radicand },
        answer: answers[kind],
        distractors: [
          answers[kind] === 'rational' ? 'irrational' : 'rational',
          'undefined',
          'both rational and irrational',
        ],
        solutionSteps: [
          `The claim concerns ${descriptions[kind]}.`,
          reasons[kind],
          `Therefore the value is ${answers[kind]}.`,
        ],
        commonErrors: [
          {
            observed: 'Applied "rational plus irrational is always irrational" to every case.',
            likelyCause:
              'The closure rules were memorised without their conditions (non-zero factor, sum versus product).',
            remediation:
              'Ask the learner to state the condition attached to each rule and then find the case where dropping it changes the answer.',
          },
        ],
      }
    },
    oracle: ({ kind }) => ['irrational', 'irrational', 'rational', 'rational'][kind],
    referenceExample: {
      prompt: 'Is 5 + √3 rational or irrational?',
      steps: [
        'Suppose 5 + √3 were rational.',
        'Subtracting the rational number 5 would leave √3 rational, but √3 is irrational.',
        'The assumption fails, so 5 + √3 is irrational.',
      ],
      answer: 'irrational',
    },
  }),

  spec<{ a: number; b: number; unitsA: number; unitsB: number }>({
    itemType: 'unit-rate-comparison',
    standard: 'N-Q.1',
    lessonFocus: 'comparing quantities using derived units',
    build: (difficulty) => {
      const unitsA = rand(3, difficulty === 3 ? 16 : 9)
      const unitsB = rand(3, difficulty === 3 ? 16 : 9)
      const a = unitsA * rand(2, 12)
      const b = unitsB * rand(2, 12)
      const rateA = a / unitsA
      const rateB = b / unitsB
      const better = rateA === rateB ? 'The two rates are equal.' : rateA > rateB ? 'Option A' : 'Option B'
      return {
        prompt: `Option A delivers ${a} units of output over ${unitsA} hours. Option B delivers ${b} units over ${unitsB} hours. Which has the greater output per hour?`,
        parameters: { a, b, unitsA, unitsB },
        answer: better,
        distractors: [
          'Option A',
          'Option B',
          'The two rates are equal.',
          'There is not enough information without knowing the total hours available.',
        ].filter((value) => value !== better),
        solutionSteps: [
          `Option A: ${a} ÷ ${unitsA} = ${Math.round(rateA * 100) / 100} units per hour.`,
          `Option B: ${b} ÷ ${unitsB} = ${Math.round(rateB * 100) / 100} units per hour.`,
          `Comparing the per-hour rates rather than the totals gives: ${better}`,
        ],
        commonErrors: [
          {
            observed: 'Compared the total outputs instead of the rates.',
            likelyCause: 'The differing time spans were not accounted for.',
            remediation:
              'Require the learner to write both quantities with the same denominator unit before comparing.',
          },
        ],
      }
    },
    oracle: ({ a, b, unitsA, unitsB }) => {
      const left = a * unitsB
      const right = b * unitsA
      return left === right ? 'The two rates are equal.' : left > right ? 'Option A' : 'Option B'
    },
    referenceExample: {
      prompt: 'A produces 120 units in 8 hours; B produces 165 units in 11 hours. Which rate is greater?',
      steps: ['A: 120 ÷ 8 = 15 per hour.', 'B: 165 ÷ 11 = 15 per hour.', 'The rates are equal.'],
      answer: 'The two rates are equal.',
    },
  }),

  spec<{ length: number; width: number; decimals: number }>({
    itemType: 'report-to-limiting-precision',
    standard: 'N-Q.3',
    lessonFocus: 'precision and reporting measured quantities',
    build: (difficulty) => {
      const decimals = difficulty === 3 ? 2 : 1
      const length = rand(15, 90) + rand(1, 9) / 10
      const width = rand(4, 30) + rand(1, 9) / 10
      const area = length * width
      const reported = area.toFixed(decimals)
      return {
        prompt: `A rectangular plot measures ${length.toFixed(1)} m by ${width.toFixed(1)} m, each measured to the nearest tenth of a metre. Report the area to ${decimals} decimal place${decimals === 1 ? '' : 's'}.`,
        parameters: { length, width, decimals },
        answer: `${reported} m²`,
        distractors: [
          `${area.toFixed(decimals + 2)} m²`,
          `${(length + width).toFixed(decimals)} m²`,
          `${(2 * (length + width)).toFixed(decimals)} m²`,
          `${Math.round(area)} m²`,
        ],
        solutionSteps: [
          `Area is length × width: ${length.toFixed(1)} × ${width.toFixed(1)} = ${area.toFixed(4)} m².`,
          `The measurements are precise to the nearest tenth, so reporting many decimal places would claim precision the measurement does not have.`,
          `Rounded to ${decimals} decimal place${decimals === 1 ? '' : 's'}: ${reported} m².`,
        ],
        commonErrors: [
          {
            observed: 'Reported every digit the calculator displayed.',
            likelyCause: 'Calculated precision was mistaken for measured precision.',
            remediation:
              'Ask what the smallest unit on the measuring tool was, and let that set the reported precision.',
          },
        ],
      }
    },
    oracle: ({ length, width, decimals }) => `${(length * width).toFixed(decimals)} m²`,
    referenceExample: {
      prompt: 'A plot measures 12.4 m by 5.3 m. Report the area to one decimal place.',
      steps: ['12.4 × 5.3 = 65.72 m².', 'The measurements carry one decimal place.', 'Report 65.7 m².'],
      answer: '65.7 m²',
    },
  }),

  spec<{ quantity: number }>({
    itemType: 'choose-modelling-units',
    standard: 'N-Q.2',
    lessonFocus: 'choosing units appropriate to a model',
    build: () => {
      const options = [
        {
          quantity: 'the fuel efficiency of a delivery van',
          answer: 'kilometres per litre',
          distractors: ['litres', 'kilometres', 'litres per hour'],
        },
        {
          quantity: 'the rate at which a reservoir is draining',
          answer: 'cubic metres per hour',
          distractors: ['cubic metres', 'metres per hour', 'hours per cubic metre'],
        },
        {
          quantity: 'the population density of a county',
          answer: 'people per square kilometre',
          distractors: ['people', 'square kilometres', 'people per kilometre'],
        },
        {
          quantity: 'the cost effectiveness of two phone plans',
          answer: 'dollars per gigabyte',
          distractors: ['dollars', 'gigabytes', 'gigabytes per month'],
        },
      ]
      const quantity = rand(0, options.length - 1)
      const option = options[quantity]
      return {
        prompt: `You are building a model of ${option.quantity}. Which unit should the modelled quantity be reported in?`,
        parameters: { quantity },
        answer: option.answer,
        distractors: option.distractors,
        solutionSteps: [
          `The quantity being modelled is ${option.quantity}, which compares one measure against another.`,
          'A quantity that compares two measures needs a derived unit — one measure divided by the other — not either measure on its own.',
          `The appropriate unit is ${option.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Chose a base unit such as litres or kilometres.',
            likelyCause: 'The quantity was read as a single measurement rather than a comparison.',
            remediation:
              'Ask what two quantities the model relates, then write the unit as the first divided by the second.',
          },
        ],
      }
    },
    oracle: ({ quantity }) =>
      [
        'kilometres per litre',
        'cubic metres per hour',
        'people per square kilometre',
        'dollars per gigabyte',
      ][quantity],
    referenceExample: {
      prompt: 'What unit should describe how quickly a tank fills?',
      steps: ['The model relates volume to time.', 'The derived unit is volume divided by time.'],
      answer: 'litres per minute',
    },
  }),
])
