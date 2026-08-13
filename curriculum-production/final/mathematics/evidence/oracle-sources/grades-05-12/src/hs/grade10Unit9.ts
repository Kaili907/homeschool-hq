import { coordinateDistractors, fraction, makeHsUnitBank, nonZero, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 9 — Coordinate Geometry (G-GPE.1, 2, 4, 5, 6, 7). */

const signedTerm = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)

export const GRADE10_UNIT9 = makeHsUnitBank(10, 9, [
  spec<{ h: number; k: number; r: number }>({
    itemType: 'circle-equation-from-centre-radius',
    standard: 'G-GPE.1',
    lessonFocus: 'the equation of a circle from its centre and radius',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 9 : 5
      const h = nonZero(bound)
      const k = nonZero(bound)
      const r = rand(2, difficulty === 3 ? 12 : 7)
      return {
        prompt: `Write the equation of the circle with centre (${h}, ${k}) and radius ${r}.`,
        parameters: { h, k, r },
        answer: `(x ${signedTerm(h)})² + (y ${signedTerm(k)})² = ${r * r}`,
        distractors: [
          `(x ${signedTerm(-h)})² + (y ${signedTerm(-k)})² = ${r * r}`,
          `(x ${signedTerm(h)})² + (y ${signedTerm(k)})² = ${r}`,
          `(x ${signedTerm(h)})² − (y ${signedTerm(k)})² = ${r * r}`,
          `(x ${signedTerm(h)})² + (y ${signedTerm(k)})² = ${r * r * r}`,
        ],
        solutionSteps: [
          `The circle is the set of points at distance ${r} from (${h}, ${k}).`,
          `Applying the distance formula and squaring both sides gives (x − h)² + (y − k)² = r².`,
          `Substitute h = ${h}, k = ${k}, r = ${r}: (x ${signedTerm(h)})² + (y ${signedTerm(k)})² = ${r * r}.`,
          `The signs inside the brackets are opposite to the centre's coordinates, and the right side is the radius squared.`,
        ],
        commonErrors: [
          {
            observed: `Wrote the right side as ${r} instead of ${r * r}.`,
            likelyCause: 'The radius was substituted where the radius squared was required.',
            remediation:
              'Check by substituting a point known to be on the circle, such as (h + r, k).',
          },
        ],
      }
    },
    oracle: ({ h, k, r }) => {
      const inner = (value: number): string => (value < 0 ? `+ ${-value}` : `− ${value}`)
      return `(x ${inner(h)})² + (y ${inner(k)})² = ${r * r}`
    },
    referenceExample: {
      prompt: 'Circle with centre (2, −3), radius 5.',
      steps: ['(x − h)² + (y − k)² = r².', '(x − 2)² + (y + 3)² = 25.'],
      answer: '(x − 2)² + (y + 3)² = 25',
    },
  }),

  spec<{ numerator: number; denominator: number; kind: number }>({
    itemType: 'parallel-perpendicular-slope',
    standard: 'G-GPE.5',
    lessonFocus: 'slope criteria for parallel and perpendicular lines',
    build: (difficulty) => {
      const numerator = nonZero(difficulty === 3 ? 9 : 5)
      const denominator = rand(1, difficulty === 3 ? 7 : 4)
      const kind = rand(0, 1)
      const answer =
        kind === 0 ? fraction(numerator, denominator) : fraction(-denominator, numerator)
      return {
        prompt: `A line has slope ${fraction(numerator, denominator)}. What is the slope of a line ${kind === 0 ? 'parallel' : 'perpendicular'} to it?`,
        parameters: { numerator, denominator, kind },
        answer,
        distractors: [
          kind === 0 ? fraction(-denominator, numerator) : fraction(numerator, denominator),
          fraction(denominator, numerator),
          fraction(-numerator, denominator),
          fraction(numerator + 1, denominator),
          // When |numerator| = |denominator| the reciprocal collides with the
          // original, so keep guaranteed-distinct nudges in the pool.
          fraction(numerator + 2, denominator),
          fraction(numerator - 1, denominator),
          fraction(numerator, denominator + 1),
        ],
        solutionSteps: [
          kind === 0
            ? 'Parallel lines have equal slopes, because they rise and run at the same rate.'
            : 'Perpendicular lines have slopes whose product is −1, so the slope is the negative reciprocal.',
          kind === 0
            ? `The parallel slope is therefore the same: ${answer}.`
            : `Flip ${fraction(numerator, denominator)} to ${fraction(denominator, numerator)} and negate it: ${answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Took the reciprocal without negating it.',
            likelyCause: 'Only half of the negative-reciprocal rule was applied.',
            remediation:
              'Multiply the two slopes together; perpendicular slopes must give exactly −1.',
          },
        ],
      }
    },
    oracle: ({ numerator, denominator, kind }) => {
      const reduce = (n: number, d: number): string => {
        let a = n
        let b = d
        if (b < 0) {
          a = -a
          b = -b
        }
        let x = Math.abs(a)
        let y = Math.abs(b)
        while (y !== 0) [x, y] = [y, x % y]
        const g = x || 1
        return b / g === 1 ? String(a / g) : `${a / g}/${b / g}`
      }
      return kind === 0 ? reduce(numerator, denominator) : reduce(-denominator, numerator)
    },
    referenceExample: {
      prompt: 'A line has slope 2/3. Perpendicular slope?',
      steps: ['Flip to 3/2.', 'Negate: −3/2.'],
      answer: '−3/2',
    },
  }),

  spec<{ x1: number; y1: number; x2: number; y2: number; ratio: number }>({
    itemType: 'partition-segment-in-ratio',
    standard: 'G-GPE.6',
    lessonFocus: 'finding the point partitioning a segment in a given ratio',
    build: (difficulty) => {
      const ratio = rand(1, difficulty === 3 ? 4 : 2)
      const total = ratio + 1
      const x1 = nonZero(difficulty === 3 ? 8 : 5)
      const y1 = nonZero(difficulty === 3 ? 8 : 5)
      // Choose the far endpoint so the partition point has integer coordinates.
      const x2 = x1 + total * nonZero(4)
      const y2 = y1 + total * nonZero(4)
      const px = x1 + ((x2 - x1) * ratio) / total
      const py = y1 + ((y2 - y1) * ratio) / total
      return {
        prompt: `Find the point that partitions the segment from A(${x1}, ${y1}) to B(${x2}, ${y2}) in the ratio ${ratio}:1 from A.`,
        parameters: { x1, y1, x2, y2, ratio },
        answer: `(${px}, ${py})`,
        distractors: coordinateDistractors(px, py, [
          [(x1 + x2) / 2, (y1 + y2) / 2],
          [x1 + ((x2 - x1) * 1) / total, y1 + ((y2 - y1) * 1) / total],
          [x2 - ((x2 - x1) * ratio) / total, y2 - ((y2 - y1) * ratio) / total],
        ]),
        solutionSteps: [
          `A ratio of ${ratio}:1 from A divides the segment into ${total} equal parts, and the point sits ${ratio} of them along.`,
          `The run is ${x2} − ${x1} = ${x2 - x1}, so move ${ratio}/${total} of it: ${((x2 - x1) * ratio) / total}.`,
          `The rise is ${y2} − ${y1} = ${y2 - y1}, so move ${((y2 - y1) * ratio) / total}.`,
          `Adding those to A gives (${px}, ${py}).`,
        ],
        commonErrors: [
          {
            observed: `Gave the midpoint (${(x1 + x2) / 2}, ${(y1 + y2) / 2}).`,
            likelyCause: 'Every partition was treated as a bisection.',
            remediation:
              'Convert the ratio to a fraction of the whole segment first; only 1:1 gives one half.',
          },
        ],
      }
    },
    oracle: ({ x1, y1, x2, y2, ratio }) => {
      const fractionAlong = ratio / (ratio + 1)
      return `(${x1 + (x2 - x1) * fractionAlong}, ${y1 + (y2 - y1) * fractionAlong})`
    },
    referenceExample: {
      prompt: 'Partition A(0,0) to B(6,9) in ratio 2:1 from A.',
      steps: ['Three parts; move two of them.', '(0 + 4, 0 + 6) = (4, 6).'],
      answer: '(4, 6)',
    },
  }),

  spec<{ a: number; b: number }>({
    itemType: 'coordinate-distance-and-perimeter',
    standard: 'G-GPE.7',
    lessonFocus: 'computing perimeter and area using coordinates',
    build: (difficulty) => {
      const triples: Array<[number, number, number]> = [
        [3, 4, 5],
        [6, 8, 10],
        [5, 12, 13],
        [8, 15, 17],
      ]
      const [a, b, c] = triples[rand(0, difficulty === 3 ? 3 : 1)]
      return {
        prompt: `A right triangle has vertices at (0, 0), (${a}, 0), and (${a}, ${b}). Find its perimeter and area.`,
        parameters: { a, b },
        answer: `perimeter ${a + b + c}; area ${(a * b) / 2}`,
        distractors: [
          `perimeter ${a + b + c}; area ${a * b}`,
          `perimeter ${a + b}; area ${(a * b) / 2}`,
          `perimeter ${a + b + c}; area ${(a + b) / 2}`,
          `perimeter ${2 * (a + b)}; area ${(a * b) / 2}`,
        ],
        solutionSteps: [
          `The horizontal leg runs from (0, 0) to (${a}, 0), so its length is ${a}.`,
          `The vertical leg runs from (${a}, 0) to (${a}, ${b}), so its length is ${b}.`,
          `The hypotenuse is √(${a}² + ${b}²) = √${a * a + b * b} = ${c}.`,
          `Perimeter = ${a} + ${b} + ${c} = ${a + b + c}. Area = ½ × ${a} × ${b} = ${(a * b) / 2}.`,
        ],
        commonErrors: [
          {
            observed: `Reported the area as ${a * b}.`,
            likelyCause: 'The rectangle area was used instead of the triangle area.',
            remediation:
              'Sketch the enclosing rectangle and note the triangle is exactly half of it.',
          },
        ],
      }
    },
    oracle: ({ a, b }) => {
      const c = Math.sqrt(a * a + b * b)
      return `perimeter ${a + b + c}; area ${(a * b) / 2}`
    },
    referenceExample: {
      prompt: 'Right triangle with legs 3 and 4 on the axes. Perimeter and area?',
      steps: ['Hypotenuse 5.', 'Perimeter 12; area 6.'],
      answer: 'perimeter 12; area 6',
    },
  }),

  spec<{ h: number; k: number; p: number }>({
    itemType: 'parabola-from-focus-and-directrix',
    standard: 'G-GPE.2',
    lessonFocus: 'deriving a parabola from focus and directrix',
    build: (difficulty) => {
      const h = nonZero(difficulty === 3 ? 6 : 4)
      const k = nonZero(difficulty === 3 ? 6 : 4)
      const p = rand(1, difficulty === 3 ? 4 : 2)
      return {
        prompt: `A parabola has focus (${h}, ${k + p}) and directrix y = ${k - p}. Write its equation in vertex form.`,
        parameters: { h, k, p },
        answer: `y = ${fraction(1, 4 * p)}(x ${signedTerm(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}`,
        distractors: [
          `y = ${fraction(1, 4 * p)}(x ${signedTerm(-h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}`,
          `y = ${fraction(1, 2 * p)}(x ${signedTerm(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}`,
          `y = ${fraction(4 * p, 1)}(x ${signedTerm(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}`,
          `y = ${fraction(1, 4 * p)}(x ${signedTerm(h)})² ${k < 0 ? '+' : '−'} ${Math.abs(k)}`,
        ],
        solutionSteps: [
          `The vertex lies halfway between the focus and the directrix: midway between y = ${k + p} and y = ${k - p} is y = ${k}, so the vertex is (${h}, ${k}).`,
          `The distance from the vertex to the focus is p = ${p}.`,
          `A parabola opening upward has equation y = (1/(4p))(x − h)² + k.`,
          `Substituting gives y = ${fraction(1, 4 * p)}(x ${signedTerm(h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}.`,
        ],
        commonErrors: [
          {
            observed: 'Used 1/(2p) as the leading coefficient.',
            likelyCause: 'The focal distance formula was misremembered.',
            remediation:
              'Derive it once from the definition: distance to focus equals distance to directrix.',
          },
        ],
      }
    },
    oracle: ({ h, k, p }) => {
      const inner = h < 0 ? `+ ${-h}` : `− ${h}`
      const reduce = (n: number, d: number): string => {
        let x = Math.abs(n)
        let y = Math.abs(d)
        while (y !== 0) [x, y] = [y, x % y]
        const g = x || 1
        return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
      }
      return `y = ${reduce(1, 4 * p)}(x ${inner})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}`
    },
    referenceExample: {
      prompt: 'Focus (0, 2), directrix y = −2. Equation?',
      steps: ['Vertex (0, 0), p = 2.', 'y = (1/8)x².'],
      answer: 'y = 1/8 x²',
    },
  }),
])
