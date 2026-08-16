import { fraction, makeHsUnitBank, nonZero, rand, spec } from './core.ts'

/** Grade 9 Unit 4 — Systems of Linear Equations and Inequalities (A-REI.5, 6, 12). */

const signed = (value: number): string => (value < 0 ? `− ${-value}` : `+ ${value}`)

export const GRADE9_UNIT4 = makeHsUnitBank(9, 4, [
  spec<{ a: number; b: number; c: number; d: number; x: number; y: number }>({
    itemType: 'solve-system-by-elimination',
    standard: 'A-REI.6',
    lessonFocus: 'solving a linear system exactly',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 9 : difficulty === 2 ? 6 : 4
      const x = nonZero(bound)
      const y = nonZero(bound)
      let a = nonZero(bound)
      let b = nonZero(bound)
      let c = nonZero(bound)
      let d = nonZero(bound)
      // A non-zero determinant guarantees the unique solution the prompt asserts.
      if (a * d - b * c === 0) d = d + (d >= 0 ? 1 : -1)
      const e = a * x + b * y
      const f = c * x + d * y
      return {
        prompt: `Solve the system exactly:\n  ${a}x ${signed(b)}y = ${e}\n  ${c}x ${signed(d)}y = ${f}`,
        parameters: { a, b, c, d, x, y },
        answer: `(${x}, ${y})`,
        distractors: [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(${-x}, ${-y})`, `(${x}, ${y + 1})`],
        solutionSteps: [
          `Scale the equations so one variable cancels: multiply the first by ${d} and the second by ${b}.`,
          `Subtracting eliminates y and leaves (${a}·${d} − ${b}·${c})x = ${a * d - b * c === 0 ? 0 : e * d - f * b}, so x = ${x}.`,
          `Substitute x = ${x} into the first equation: ${a}(${x}) ${signed(b)}y = ${e}, giving y = ${y}.`,
          `The solution is (${x}, ${y}); check it satisfies both equations.`,
        ],
        commonErrors: [
          {
            observed: `Reported (${y}, ${x}) with the coordinates swapped.`,
            likelyCause: 'The second solved value was written first.',
            remediation:
              'Label each value with its variable as it is found, and only then assemble the ordered pair.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, d, x, y }) => {
      // Independent recomputation by Cramer's rule from the same coefficients.
      const e = a * x + b * y
      const f = c * x + d * y
      const determinant = a * d - b * c
      const solvedX = (e * d - b * f) / determinant
      const solvedY = (a * f - e * c) / determinant
      return `(${solvedX}, ${solvedY})`
    },
    referenceExample: {
      prompt: 'Solve 2x + 3y = 12 and x − y = 1.',
      steps: ['From the second, x = y + 1.', '2(y + 1) + 3y = 12 gives 5y = 10, y = 2.', 'x = 3.'],
      answer: '(3, 2)',
    },
  }),

  spec<{ a: number; b: number; k: number }>({
    itemType: 'classify-system-solution-count',
    standard: 'A-REI.6',
    lessonFocus: 'recognising systems with no solution or infinitely many',
    build: () => {
      const a = nonZero(7)
      const b = nonZero(7)
      const c = nonZero(11)
      const k = rand(0, 2)
      // k = 0: proportional and consistent; k = 1: proportional, inconsistent; k = 2: independent.
      const multiplier = rand(2, 4)
      const second =
        k === 2
          ? { a: a + 1, b, c: c + 3 }
          : { a: a * multiplier, b: b * multiplier, c: k === 0 ? c * multiplier : c * multiplier + 5 }
      const answers = ['infinitely many solutions', 'no solution', 'exactly one solution']
      return {
        prompt: `How many solutions does this system have?\n  ${a}x ${signed(b)}y = ${c}\n  ${second.a}x ${signed(second.b)}y = ${second.c}`,
        parameters: { a, b, k },
        answer: answers[k],
        distractors: answers.filter((_, index) => index !== k).concat(['exactly two solutions']),
        solutionSteps: [
          k === 2
            ? `The coefficient pairs (${a}, ${b}) and (${second.a}, ${second.b}) are not proportional, so the lines have different slopes.`
            : `The second equation's coefficients are ${multiplier} times the first's, so the lines are parallel or identical.`,
          k === 0
            ? `The constant is scaled by the same factor ${multiplier}, so the equations describe the same line.`
            : k === 1
              ? `The constant is not scaled by ${multiplier}, so the lines are parallel and never meet.`
              : `Lines with different slopes meet exactly once.`,
          `Therefore the system has ${answers[k]}.`,
        ],
        commonErrors: [
          {
            observed: 'Called any proportional-looking system dependent.',
            likelyCause: 'Only the coefficients were compared, not the constants.',
            remediation:
              'Require the constant term to be checked against the same scale factor before concluding.',
          },
        ],
      }
    },
    oracle: ({ k }) => ['infinitely many solutions', 'no solution', 'exactly one solution'][k],
    referenceExample: {
      prompt: 'How many solutions has 2x + y = 5 and 4x + 2y = 11?',
      steps: ['Coefficients scale by 2, but 5 × 2 = 10 ≠ 11.', 'The lines are parallel and distinct.'],
      answer: 'no solution',
    },
  }),

  spec<{ a: number; b: number; c: number; px: number; py: number }>({
    itemType: 'half-plane-membership',
    standard: 'A-REI.12',
    lessonFocus: 'the half-plane as the solution set of a linear inequality',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 8 : 5
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = nonZero(bound * 2)
      const px = nonZero(bound)
      const py = nonZero(bound)
      const value = a * px + b * py
      const satisfies = value <= c
      return {
        prompt: `Is the point (${px}, ${py}) in the solution region of ${a}x ${signed(b)}y ≤ ${c}?`,
        parameters: { a, b, c, px, py },
        answer: satisfies
          ? `Yes; substituting gives ${value} ≤ ${c}.`
          : `No; substituting gives ${value}, which is greater than ${c}.`,
        distractors: [
          satisfies
            ? `No; substituting gives ${value}, which is greater than ${c}.`
            : `Yes; substituting gives ${value} ≤ ${c}.`,
          'Only points on the boundary line are in the solution region.',
          'The region cannot be tested without graphing it first.',
          `Yes; every point with a positive coordinate satisfies the inequality.`,
        ],
        solutionSteps: [
          `A half-plane is a solution set, so test the point by substitution.`,
          `Substitute x = ${px}, y = ${py}: ${a}(${px}) ${signed(b)}(${py}) = ${value}.`,
          `Compare against ${c}: ${value} ${satisfies ? '≤' : '>'} ${c}.`,
          satisfies ? 'The point lies in the shaded region.' : 'The point lies outside the shaded region.',
        ],
        commonErrors: [
          {
            observed: 'Decided by which side of the line the point appeared to be on.',
            likelyCause: 'The shading direction was guessed rather than tested.',
            remediation:
              'Always substitute a test point; the arithmetic settles the shading without a sketch.',
          },
        ],
      }
    },
    oracle: ({ a, b, c, px, py }) => {
      const value = a * px + b * py
      return value <= c
        ? `Yes; substituting gives ${value} ≤ ${c}.`
        : `No; substituting gives ${value}, which is greater than ${c}.`
    },
    referenceExample: {
      prompt: 'Is (1, 2) in the region 3x + y ≤ 6?',
      steps: ['3(1) + 2 = 5.', '5 ≤ 6, so yes.'],
      answer: 'Yes; substituting gives 5 ≤ 6.',
    },
  }),

  spec<{ a: number; b: number; c: number; d: number; multiplier: number }>({
    itemType: 'linear-combination-equivalence',
    standard: 'A-REI.5',
    lessonFocus: 'why replacing an equation by a linear combination preserves solutions',
    build: () => {
      const a = nonZero(6)
      const b = nonZero(6)
      const c = nonZero(6)
      const d = nonZero(6)
      const multiplier = rand(2, 5)
      return {
        prompt: `A student replaces the second equation of a system with (second equation) + ${multiplier} × (first equation). Which statement is correct?`,
        parameters: { a, b, c, d, multiplier },
        answer:
          'The new system has exactly the same solution set, because the replacement step is reversible.',
        distractors: [
          'The new system may gain solutions that the original did not have.',
          'The new system may lose solutions that the original had.',
          `The new system is equivalent only when ${multiplier} is 1.`,
          'The new system is equivalent only if both equations have integer coefficients.',
        ],
        solutionSteps: [
          `Any pair (x, y) satisfying both original equations also satisfies the sum of the second and ${multiplier} times the first, so no solution is lost.`,
          `The step can be undone by subtracting ${multiplier} times the first equation, so no solution is gained either.`,
          'Because the operation is reversible in this way, the two systems have identical solution sets.',
        ],
        commonErrors: [
          {
            observed: 'Accepted the method as a rule without being able to say why it is valid.',
            likelyCause: 'Elimination was learned as a procedure rather than as a justified move.',
            remediation:
              'Ask the learner to reverse the step explicitly and observe that the original system returns.',
          },
        ],
      }
    },
    oracle: () =>
      'The new system has exactly the same solution set, because the replacement step is reversible.',
    referenceExample: {
      prompt: 'Why may we add a multiple of one equation to another?',
      steps: ['Every common solution still satisfies the combination.', 'The step reverses, so nothing is gained.'],
      answer: 'The solution set is unchanged.',
    },
  }),

  spec<{ a: number; b: number; x: number; y: number }>({
    itemType: 'solve-system-by-substitution',
    standard: 'A-REI.6',
    lessonFocus: 'choosing substitution when one variable is already isolated',
    build: (difficulty) => {
      const bound = difficulty === 3 ? 9 : 5
      const x = nonZero(bound)
      const m = nonZero(bound)
      const k = nonZero(bound * 2)
      const y = m * x + k
      const a = nonZero(bound)
      const b = nonZero(bound)
      const c = a * x + b * y
      return {
        prompt: `Solve by substitution:\n  y = ${m}x ${signed(k)}\n  ${a}x ${signed(b)}y = ${c}`,
        parameters: { a: m, b: k, x, y },
        answer: `(${x}, ${y})`,
        distractors: [`(${y}, ${x})`, `(${x}, ${m * x - k})`, `(${x + 1}, ${y})`, `(${-x}, ${y})`],
        solutionSteps: [
          `The first equation already gives y in terms of x, so substitute it into the second.`,
          `${a}x ${signed(b)}(${m}x ${signed(k)}) = ${c}.`,
          `Expand and collect: ${a + b * m}x ${signed(b * k)} = ${c}, so x = ${x}.`,
          `Back-substitute: y = ${m}(${x}) ${signed(k)} = ${y}. The solution is (${x}, ${y}).`,
        ],
        commonErrors: [
          {
            observed: 'Substituted into the same equation the expression came from.',
            likelyCause: 'The two equations were not tracked separately.',
            remediation:
              'Number the equations and state which one is being substituted into before writing anything.',
          },
        ],
      }
    },
    oracle: ({ a, b, x }) => `(${x}, ${a * x + b})`,
    referenceExample: {
      prompt: 'Solve y = 2x − 1 and 3x + y = 9.',
      steps: ['3x + (2x − 1) = 9, so 5x = 10 and x = 2.', 'y = 2(2) − 1 = 3.'],
      answer: '(2, 3)',
    },
  }),
])
