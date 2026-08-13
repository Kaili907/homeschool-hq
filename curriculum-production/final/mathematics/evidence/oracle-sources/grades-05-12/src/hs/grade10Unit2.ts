import { coordinateDistractors, makeHsUnitBank, nonZero, rand, spec } from './core.ts'

/** Grade 10 Unit 2 — Rigid Motions and Transformations (G-CO.2, 3, 4, 5). */

export const GRADE10_UNIT2 = makeHsUnitBank(10, 2, [
  spec<{ x: number; y: number; dx: number; dy: number }>({
    itemType: 'image-under-translation',
    standard: 'G-CO.2',
    lessonFocus: 'translations described by a rule',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 12 : 7
      const x = nonZero(bound)
      const y = nonZero(bound)
      const dx = nonZero(bound)
      const dy = nonZero(bound)
      return {
        prompt: `Point P(${x}, ${y}) is translated by the rule (x, y) → (x ${dx < 0 ? '−' : '+'} ${Math.abs(dx)}, y ${dy < 0 ? '−' : '+'} ${Math.abs(dy)}). Give the image P′.`,
        parameters: { x, y, dx, dy },
        answer: `(${x + dx}, ${y + dy})`,
        distractors: coordinateDistractors(x + dx, y + dy, [
          [x - dx, y - dy],
          [y + dy, x + dx],
          [x + dy, y + dx],
          [x + dx, y - dy],
        ]),
        solutionSteps: [
          `A translation adds a fixed amount to each coordinate independently.`,
          `x-coordinate: ${x} ${dx < 0 ? '−' : '+'} ${Math.abs(dx)} = ${x + dx}.`,
          `y-coordinate: ${y} ${dy < 0 ? '−' : '+'} ${Math.abs(dy)} = ${y + dy}.`,
          `So P′ = (${x + dx}, ${y + dy}).`,
        ],
        commonErrors: [
          {
            observed: 'Subtracted the translation amounts instead of adding them.',
            likelyCause: 'The rule was read as an inverse mapping.',
            remediation:
              'Substitute the original coordinates directly into the rule as written, without rearranging it.',
          },
        ],
      }
    },
    oracle: ({ x, y, dx, dy }) => `(${x + dx}, ${y + dy})`,
    referenceExample: {
      prompt: 'Translate (2, −3) by (x, y) → (x + 4, y − 1).',
      steps: ['2 + 4 = 6.', '−3 − 1 = −4.'],
      answer: '(6, −4)',
    },
  }),

  spec<{ x: number; y: number; kind: number }>({
    itemType: 'image-under-reflection',
    standard: 'G-CO.5',
    lessonFocus: 'reflections across the axes and the line y = x',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 12 : 7
      const x = nonZero(bound)
      const y = nonZero(bound)
      const kind = rand(0, 2)
      const lines = ['the x-axis', 'the y-axis', 'the line y = x']
      const images: Array<[number, number]> = [
        [x, -y],
        [-x, y],
        [y, x],
      ]
      const [ix, iy] = images[kind]
      return {
        prompt: `Reflect the point (${x}, ${y}) across ${lines[kind]}. Give the image.`,
        parameters: { x, y, kind },
        answer: `(${ix}, ${iy})`,
        distractors: coordinateDistractors(ix, iy, [
          ...images.filter((_, index) => index !== kind),
          [-x, -y],
          [x, y],
        ]),
        solutionSteps: [
          kind === 0
            ? 'Reflecting across the x-axis keeps x fixed and negates y.'
            : kind === 1
              ? 'Reflecting across the y-axis negates x and keeps y fixed.'
              : 'Reflecting across y = x swaps the two coordinates.',
          `Applying that to (${x}, ${y}) gives (${ix}, ${iy}).`,
          `Check: the segment from the point to its image is perpendicular to ${lines[kind]} and bisected by it.`,
        ],
        commonErrors: [
          {
            observed: 'Negated both coordinates.',
            likelyCause: 'Reflection was confused with a 180° rotation about the origin.',
            remediation:
              'Plot the point and its claimed image and check the mirror line lies halfway between them.',
          },
        ],
      }
    },
    oracle: ({ x, y, kind }) => {
      const images: Array<[number, number]> = [
        [x, -y],
        [-x, y],
        [y, x],
      ]
      const [ix, iy] = images[kind]
      return `(${ix}, ${iy})`
    },
    referenceExample: {
      prompt: 'Reflect (3, 5) across the y-axis.',
      steps: ['Negate x, keep y.', '(−3, 5).'],
      answer: '(−3, 5)',
    },
  }),

  spec<{ x: number; y: number; turns: number }>({
    itemType: 'image-under-rotation',
    standard: 'G-CO.5',
    lessonFocus: 'rotations about the origin by multiples of 90°',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 12 : 7
      const x = nonZero(bound)
      const y = nonZero(bound)
      const turns = rand(1, 3)
      // When y = -x the swap distractor coincides with the 180° image, which
      // would shrink the pool below the required three options.
      const rotate = (px: number, py: number, count: number): [number, number] => {
        let a = px
        let b = py
        for (let step = 0; step < count; step += 1) {
          ;[a, b] = [-b, a]
        }
        return [a, b]
      }
      const [ix, iy] = rotate(x, y, turns)
      return {
        prompt: `Rotate the point (${x}, ${y}) counterclockwise about the origin by ${turns * 90}°. Give the image.`,
        parameters: { x, y, turns },
        answer: `(${ix}, ${iy})`,
        distractors: coordinateDistractors(ix, iy, [
          ...[1, 2, 3].filter((count) => count !== turns).map((count) => rotate(x, y, count)),
          [y, x],
          [x, -y],
          [-x, y],
        ]),
        solutionSteps: [
          `A 90° counterclockwise rotation about the origin maps (a, b) to (−b, a).`,
          `Apply that ${turns} time${turns === 1 ? '' : 's'} starting from (${x}, ${y}).`,
          `The image is (${ix}, ${iy}).`,
          `Check: the distance from the origin is unchanged, since rotations are rigid motions.`,
        ],
        commonErrors: [
          {
            observed: 'Swapped the coordinates without applying any sign change.',
            likelyCause: 'A rotation was confused with a reflection across y = x.',
            remediation:
              'Rotate a simple point such as (1, 0) first and confirm it lands on (0, 1).',
          },
        ],
      }
    },
    oracle: ({ x, y, turns }) => {
      // Rotation by 90° counterclockwise, applied `turns` times.
      let a = x
      let b = y
      for (let step = 0; step < turns; step += 1) {
        const nextA = -b
        const nextB = a
        a = nextA
        b = nextB
      }
      return `(${a}, ${b})`
    },
    referenceExample: {
      prompt: 'Rotate (4, 1) by 90° counterclockwise about the origin.',
      steps: ['(a, b) → (−b, a).', '(4, 1) → (−1, 4).'],
      answer: '(−1, 4)',
    },
  }),

  spec<{ sides: number }>({
    itemType: 'rotational-symmetry-order',
    standard: 'G-CO.3',
    lessonFocus: 'the symmetries that carry a figure onto itself',
    build: (difficulty) => {
      const sides = rand(3, difficulty === 3 ? 12 : 8)
      return {
        prompt: `A regular polygon has ${sides} sides. How many rotations about its centre, strictly between 0° and 360°, carry it onto itself, and what is the smallest such angle?`,
        parameters: { sides },
        answer: `${sides - 1} rotations; smallest angle ${360 / sides}°`,
        distractors: [
          `${sides} rotations; smallest angle ${360 / sides}°`,
          `${sides - 1} rotations; smallest angle ${180 / sides}°`,
          `${sides - 1} rotations; smallest angle ${Math.round(((sides - 2) * 180) / sides)}°`,
          `${sides * 2} rotations; smallest angle ${360 / sides}°`,
        ],
        solutionSteps: [
          `A regular ${sides}-gon maps onto itself when a vertex moves to the position of another vertex.`,
          `The vertices are spaced 360 ÷ ${sides} = ${360 / sides}° apart, so that is the smallest rotation that works.`,
          `Multiples of ${360 / sides}° also work, and there are ${sides} of them in a full turn.`,
          `Excluding the 360° rotation, which is the identity, leaves ${sides - 1} rotations strictly between 0° and 360°.`,
        ],
        commonErrors: [
          {
            observed: `Counted ${sides} rotations by including the full turn.`,
            likelyCause: 'The identity rotation was counted as a distinct symmetry in the given range.',
            remediation:
              'Re-read the range specified in the question and check whether 360° is inside it.',
          },
        ],
      }
    },
    oracle: ({ sides }) => `${sides - 1} rotations; smallest angle ${360 / sides}°`,
    referenceExample: {
      prompt: 'How many rotations under 360° carry a square onto itself?',
      steps: ['Vertices are 90° apart.', '90°, 180°, 270° work — three rotations.'],
      answer: '3 rotations; smallest angle 90°',
    },
  }),

  spec<{ x: number; y: number }>({
    itemType: 'describe-transformation-sequence',
    standard: 'G-CO.4',
    lessonFocus: 'describing a sequence of rigid motions taking one figure to another',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 10 : 6
      const x = nonZero(bound)
      const y = nonZero(bound)
      return {
        prompt: `Triangle ABC has vertices A(${x}, ${y}) and B(${y}, ${-x}). After a transformation the images are A′(${-x}, ${-y}) and B′(${-y}, ${x}), and the triangle keeps its size and orientation sense. Which single rigid motion describes this?`,
        parameters: { x, y },
        answer: 'a 180° rotation about the origin',
        distractors: [
          'a reflection across the x-axis',
          'a reflection across the y-axis',
          `a translation by ⟨${-2 * x}, ${-2 * y}⟩`,
          'a reflection across the line y = x',
        ],
        solutionSteps: [
          `Both vertices had every coordinate negated: (${x}, ${y}) → (${-x}, ${-y}) and (${y}, ${-x}) → (${-y}, ${x}).`,
          `A single reflection across an axis changes exactly one coordinate's sign, and it reverses orientation sense, so no reflection fits.`,
          `A translation adds the same fixed vector to every point. Here A moved by ⟨${-2 * x}, ${-2 * y}⟩ but B moved by ⟨${-2 * y}, ${2 * x}⟩, and those differ, so it is not a translation.`,
          `Negating both coordinates of every point while preserving orientation is exactly a 180° rotation about the origin.`,
        ],
        commonErrors: [
          {
            observed: 'Chose a reflection because the coordinates changed sign.',
            likelyCause: 'Sign changes were treated as the signature of reflection alone.',
            remediation:
              'Check orientation as well as position: reflections reverse the order of the labelled vertices.',
          },
        ],
      }
    },
    oracle: () => 'a 180° rotation about the origin',
    referenceExample: {
      prompt: '(3, 4) maps to (−3, −4) preserving orientation. Which motion?',
      steps: ['Both signs flip.', 'Orientation is preserved, so it is a rotation.'],
      answer: 'a 180° rotation about the origin',
    },
  }),
])
