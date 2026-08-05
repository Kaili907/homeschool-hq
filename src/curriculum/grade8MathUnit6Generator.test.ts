import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE8_MATH_UNIT6_GENERATORS,
  GRADE8_MATH_UNIT6_ITEM_DEFINITIONS,
  GRADE8_MATH_UNIT6_ITEM_TYPES,
  generateGrade8MathUnit6Question,
  type Grade8MathUnit6ItemType,
  type Grade8MathUnit6Question,
} from './grade8MathUnit6Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

interface Point {
  x: number
  y: number
}

function coefficientTerm(coefficient: number, variable: string): string {
  if (coefficient === 1) return variable
  if (coefficient === -1) return `-${variable}`
  return `${coefficient}${variable}`
}

function fmtSlopeIntercept(m: number, b: number): string {
  if (m === 0) return `y = ${b}`
  const mTerm = coefficientTerm(m, 'x')
  if (b === 0) return `y = ${mTerm}`
  const sign = b > 0 ? '+' : '-'
  return `y = ${mTerm} ${sign} ${Math.abs(b)}`
}

function fmtStandardForm(A: number, B: number, C: number): string {
  const aTerm = coefficientTerm(A, 'x')
  const bTerm = coefficientTerm(Math.abs(B), 'y')
  const sign = B >= 0 ? '+' : '-'
  return `${aTerm} ${sign} ${bTerm} = ${C}`
}

const fmtPoint = (p: Point): string => `(${p.x}, ${p.y})`

function classifyQuadrant(x: number, y: number): string {
  if (x === 0 || y === 0) return 'on an axis'
  if (x > 0 && y > 0) return 'Quadrant I'
  if (x < 0 && y > 0) return 'Quadrant II'
  if (x < 0 && y < 0) return 'Quadrant III'
  return 'Quadrant IV'
}

type ContextUnit = 'month' | 'week' | 'visit'

function unitPlural(unit: ContextUnit): string {
  return unit === 'month' ? 'months' : unit === 'week' ? 'weeks' : 'visits'
}

function unitForCount(unit: ContextUnit, count: number): string {
  return count === 1 ? unit : unitPlural(unit)
}

function contextIntro(parameters: { feeA: number; rateA: number; feeB: number; rateB: number; unit: ContextUnit }): string {
  return `Plan A charges a $${parameters.feeA} flat fee plus $${parameters.rateA} per ${parameters.unit}. Plan B charges a $${parameters.feeB} flat fee plus $${parameters.rateB} per ${parameters.unit}.`
}

function exactDivide(numerator: bigint, denominator: bigint): bigint {
  expect(denominator).not.toBe(0n)
  expect(numerator % denominator).toBe(0n)
  return numerator / denominator
}

function oracleAnswer(question: Grade8MathUnit6Question): string {
  switch (question.itemType) {
    case 'verify-solution-of-system': {
      const { m1, b1, m2, b2, candidates } = question.parameters
      const matches = candidates.filter((p) => p.y === m1 * p.x + b1 && p.y === m2 * p.x + b2)
      expect(matches.length).toBe(1)
      return fmtPoint(matches[0])
    }
    case 'solve-system-for-intersection-point': {
      const { m1, b1, m2, b2 } = question.parameters
      const x = exactDivide(BigInt(b2 - b1), BigInt(m1 - m2))
      const y = BigInt(m1) * x + BigInt(b1)
      return fmtPoint({ x: Number(x), y: Number(y) })
    }
    case 'intersection-from-two-tables': {
      const { m1, b1, m2, b2, xValues } = question.parameters
      const matches = xValues.filter((x) => m1 * x + b1 === m2 * x + b2)
      expect(matches.length).toBe(1)
      return String(matches[0])
    }
    case 'identify-quadrant-of-intersection': {
      const { m1, b1, m2, b2, x0, y0 } = question.parameters
      expect(y0).toBe(m1 * x0 + b1)
      expect(y0).toBe(m2 * x0 + b2)
      return classifyQuadrant(x0, y0)
    }
    case 'solve-by-substitution': {
      const { m1, b1, A2, B2, C2 } = question.parameters
      const denominator = BigInt(A2) + BigInt(B2) * BigInt(m1)
      const x = exactDivide(BigInt(C2) - BigInt(B2) * BigInt(b1), denominator)
      const y = BigInt(m1) * x + BigInt(b1)
      return fmtPoint({ x: Number(x), y: Number(y) })
    }
    case 'solve-by-elimination': {
      const { A1, B1, C1, A2, B2, C2 } = question.parameters
      const D = BigInt(A1) * BigInt(B2) - BigInt(A2) * BigInt(B1)
      const x = exactDivide(BigInt(C1) * BigInt(B2) - BigInt(C2) * BigInt(B1), D)
      const y = exactDivide(BigInt(A1) * BigInt(C2) - BigInt(A2) * BigInt(C1), D)
      return fmtPoint({ x: Number(x), y: Number(y) })
    }
    case 'classify-solution-count': {
      const { m1, b1, m2, b2 } = question.parameters
      if (m1 !== m2) return 'one solution'
      if (b1 !== b2) return 'no solution'
      return 'infinitely many solutions'
    }
    case 'identify-equivalent-or-inconsistent-equation': {
      const { m0, b0, mode, candidates } = question.parameters
      const matches = candidates.filter((candidate) => {
        const sameSlope = candidate.A === -m0 * candidate.B
        if (!sameSlope) return false
        const sameLine = candidate.C === b0 * candidate.B
        return mode === 'infinite' ? sameLine : !sameLine
      })
      expect(matches.length).toBe(1)
      return fmtStandardForm(matches[0].A, matches[0].B, matches[0].C)
    }
    case 'system-from-context-solve': {
      const { feeA, rateA, feeB, rateB, x0, y0 } = question.parameters
      expect(y0).toBe(feeA + rateA * x0)
      expect(y0).toBe(feeB + rateB * x0)
      return fmtPoint({ x: x0, y: y0 })
    }
    case 'interpret-context-solution': {
      const { x0, y0, unit } = question.parameters
      return `After ${x0} ${unitForCount(unit, x0)}, both plans cost $${y0}.`
    }
    case 'check-solution-against-system': {
      const { m1, b1, m2, b2, point } = question.parameters
      const satisfies1 = point.y === m1 * point.x + b1
      const satisfies2 = point.y === m2 * point.x + b2
      if (satisfies1 && satisfies2) return 'satisfies both equations'
      if (satisfies1) return 'fails the second equation only'
      if (satisfies2) return 'fails the first equation only'
      return 'fails both equations'
    }
    case 'interpret-solution-meaning': {
      const { unit, coordinateAsked } = question.parameters
      return coordinateAsked === 'x'
        ? `The number of ${unitPlural(unit)} after which the two plans cost the same.`
        : `The shared cost, in dollars, when the two plans are equal.`
    }
  }
}

function assertPromptRepresentsParameters(question: Grade8MathUnit6Question): void {
  switch (question.itemType) {
    case 'verify-solution-of-system': {
      const { m1, b1, m2, b2 } = question.parameters
      expect(question.prompt).toBe(
        `System: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. Which point (x, y) satisfies both equations?`,
      )
      return
    }
    case 'solve-system-for-intersection-point': {
      const { m1, b1, m2, b2 } = question.parameters
      expect(question.prompt).toBe(
        `Solve the system: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. What is the intersection point (x, y)?`,
      )
      return
    }
    case 'intersection-from-two-tables': {
      const { m1, b1, m2, b2, xValues } = question.parameters
      const y1Values = xValues.map((x) => m1 * x + b1)
      const y2Values = xValues.map((x) => m2 * x + b2)
      expect(question.prompt).toBe(
        `Relationship A: x: ${xValues.join(', ')} y: ${y1Values.join(', ')}. Relationship B: x: ${xValues.join(', ')} y: ${y2Values.join(', ')}. At which x-value do the two relationships have the same y-value?`,
      )
      return
    }
    case 'identify-quadrant-of-intersection': {
      const { m1, b1, m2, b2 } = question.parameters
      expect(question.prompt).toBe(
        `Solve the system: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. In which quadrant does the intersection point lie, or does it lie on an axis?`,
      )
      return
    }
    case 'solve-by-substitution': {
      const { m1, b1, A2, B2, C2 } = question.parameters
      expect(question.prompt).toBe(
        `Solve the system:\n${fmtSlopeIntercept(m1, b1)}\n${fmtStandardForm(A2, B2, C2)}\nUse substitution to find the solution (x, y).`,
      )
      return
    }
    case 'solve-by-elimination': {
      const { A1, B1, C1, A2, B2, C2 } = question.parameters
      expect(question.prompt).toBe(
        `Solve the system:\n${fmtStandardForm(A1, B1, C1)}\n${fmtStandardForm(A2, B2, C2)}\nUse elimination to find the solution (x, y).`,
      )
      return
    }
    case 'classify-solution-count': {
      const { m1, b1, m2, b2 } = question.parameters
      expect(question.prompt).toBe(
        `Classify the system: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. Does it have one solution, no solution, or infinitely many solutions?`,
      )
      return
    }
    case 'identify-equivalent-or-inconsistent-equation': {
      const { m0, b0, mode } = question.parameters
      expect(question.prompt).toBe(
        `The reference equation is ${fmtSlopeIntercept(m0, b0)}. Which of these equations, paired with the reference, would give the system ${mode === 'no-solution' ? 'no solution' : 'infinitely many solutions'}?`,
      )
      return
    }
    case 'system-from-context-solve': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `${contextIntro(parameters)} After how many ${unitPlural(parameters.unit)} do the two plans cost the same, and what is that cost?`,
      )
      return
    }
    case 'interpret-context-solution': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `${contextIntro(parameters)} The solution to the system is (${parameters.x0}, ${parameters.y0}). What does this solution represent?`,
      )
      return
    }
    case 'check-solution-against-system': {
      const { m1, b1, m2, b2, point } = question.parameters
      expect(question.prompt).toBe(
        `System: ${fmtSlopeIntercept(m1, b1)} and ${fmtSlopeIntercept(m2, b2)}. Does the point (${point.x}, ${point.y}) satisfy both equations, fail one, or fail both?`,
      )
      return
    }
    case 'interpret-solution-meaning': {
      const parameters = question.parameters
      expect(question.prompt).toBe(
        `${contextIntro(parameters)} The solution to the system is (${parameters.x0}, ${parameters.y0}). What does the ${parameters.coordinateAsked === 'x' ? 'x-coordinate' : 'y-coordinate'} of the solution represent?`,
      )
      return
    }
  }
}

const COORDINATE_PATTERN = /^\(-?\d+, -?\d+\)$/

function assertChoicesStayInDomain(question: Grade8MathUnit6Question): void {
  switch (question.itemType) {
    case 'verify-solution-of-system':
    case 'solve-system-for-intersection-point':
    case 'solve-by-substitution':
    case 'solve-by-elimination':
    case 'system-from-context-solve':
      for (const choice of question.choices) expect(choice).toMatch(COORDINATE_PATTERN)
      return
    case 'intersection-from-two-tables':
      for (const choice of question.choices) expect(choice).toMatch(/^-?\d+$/)
      return
    case 'identify-quadrant-of-intersection':
      for (const choice of question.choices) expect(choice).toMatch(/^(Quadrant (I|II|III|IV)|on an axis)$/)
      return
    case 'classify-solution-count':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^(one solution|no solution|infinitely many solutions)$/)
      }
      return
    case 'identify-equivalent-or-inconsistent-equation':
      for (const choice of question.choices) expect(choice).toMatch(/^-?\d*x [+-] \d*y = -?\d+$/)
      return
    case 'interpret-context-solution':
      for (const choice of question.choices) {
        expect(choice).toMatch(/\.$/)
        expect(choice).toMatch(/\d/)
      }
      return
    case 'interpret-solution-meaning':
      for (const choice of question.choices) expect(choice).toMatch(/\.$/)
      return
    case 'check-solution-against-system':
      for (const choice of question.choices) {
        expect(choice).toMatch(
          /^(satisfies both equations|fails the first equation only|fails the second equation only|fails both equations)$/,
        )
      }
      return
  }
}

function expectWellFormed(question: Grade8MathUnit6Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  expect(question.choices[question.answerIndex]).not.toMatch(/\?\d+$/)
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  expect(question.parameters).not.toHaveProperty('correctAnswer')
  assertChoicesStayInDomain(question)
}

describe('Grade 8 Math Unit 6 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE8_MATH_UNIT6_ITEM_DEFINITIONS)).toEqual([...GRADE8_MATH_UNIT6_ITEM_TYPES])
    expect(Object.keys(GRADE8_MATH_UNIT6_GENERATORS)).toEqual([...GRADE8_MATH_UNIT6_ITEM_TYPES])
    expect(new Set(GRADE8_MATH_UNIT6_ITEM_TYPES).size).toBe(12)
  })

  it('covers the 8.EE.8 standard parts and all six lesson focuses derived from the source records', () => {
    const definitions = Object.values(GRADE8_MATH_UNIT6_ITEM_DEFINITIONS)
    expect(new Set(definitions.map((definition) => definition.standard))).toEqual(
      new Set(['8.EE.8a', '8.EE.8b', '8.EE.8c', '8.EE.8']),
    )
    expect(new Set(definitions.map((definition) => definition.lessonFocus))).toEqual(
      new Set([
        'intersection as shared solution',
        'graphing systems',
        'substitution or equivalent reasoning',
        'one no or infinitely many solutions',
        'systems from contexts',
        'checking and interpreting',
      ]),
    )
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x8_06_c0de))
    for (const itemType of GRADE8_MATH_UNIT6_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade8MathUnit6Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(GRADE8_MATH_UNIT6_ITEM_DEFINITIONS[itemType].standard)
        expect(question.lessonFocus).toBe(GRADE8_MATH_UNIT6_ITEM_DEFINITIONS[itemType].lessonFocus)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const exampleObjects = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE8_MATH_UNIT6_ITEM_TYPES) {
      const example = GRADE8_MATH_UNIT6_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      exampleObjects.add(example)
    }
    expect(exampleObjects.size).toBe(GRADE8_MATH_UNIT6_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike = (typeof GRADE8_MATH_UNIT6_ITEM_DEFINITIONS)[Grade8MathUnit6ItemType]['workedExample']

describe('Grade 8 Math Unit 6 independent property oracles', () => {
  for (const [typeIndex, itemType] of GRADE8_MATH_UNIT6_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have the independently recomputed answer`, () => {
      setRng(seededRng(0x600_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade8MathUnit6Question(itemType, difficulty)
          assertPromptRepresentsParameters(question)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          expectWellFormed(question)
        }
      }
    })
  }
})

describe('Grade 8 Math Unit 6 required edge cases', () => {
  it('reaches both "on an axis" and "in a quadrant" intersection points', () => {
    setRng(seededRng(0xa715_0001))
    let sawAxis = false
    let sawQuadrant = false
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit6Question('identify-quadrant-of-intersection', 3)
      const answer = curriculumAnswer(question)
      if (answer === 'on an axis') sawAxis = true
      else sawQuadrant = true
      expect(answer).toBe(oracleAnswer(question))
    }
    expect(sawAxis).toBe(true)
    expect(sawQuadrant).toBe(true)
  })

  it('reaches all three solution-count classifications', () => {
    setRng(seededRng(0xc1a5_0001))
    const classifications = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit6Question('classify-solution-count', 2)
      classifications.add(curriculumAnswer(question))
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(classifications).toEqual(new Set(['one solution', 'no solution', 'infinitely many solutions']))
  })

  it('reaches both the no-solution and infinitely-many framings', () => {
    setRng(seededRng(0xe9f1_0001))
    const modes = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit6Question('identify-equivalent-or-inconsistent-equation', 2)
      modes.add(question.parameters.mode)
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(modes).toEqual(new Set(['no-solution', 'infinite']))
  })

  it('never renders a distractor that is a scaled multiple of the reference equation', () => {
    setRng(seededRng(0x5ca1e_0001))
    for (const difficulty of [1, 2, 3] as const) {
      for (let run = 0; run < 600; run++) {
        const question = generateGrade8MathUnit6Question('identify-equivalent-or-inconsistent-equation', difficulty)
        const { m0, b0, candidates } = question.parameters
        const correctAnswer = curriculumAnswer(question)
        for (const candidate of candidates) {
          const rendered = fmtStandardForm(candidate.A, candidate.B, candidate.C)
          if (rendered === correctAnswer) continue
          const sameLine = candidate.A === -m0 * candidate.B && candidate.C === candidate.B * b0
          expect(sameLine).toBe(false)
        }
      }
    }
  })

  it('reaches all four check-against-system outcomes', () => {
    setRng(seededRng(0xf00d_0001))
    const outcomes = new Set<string>()
    for (let run = 0; run < 800; run++) {
      const question = generateGrade8MathUnit6Question('check-solution-against-system', 2)
      outcomes.add(curriculumAnswer(question))
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(outcomes).toEqual(
      new Set([
        'satisfies both equations',
        'fails the first equation only',
        'fails the second equation only',
        'fails both equations',
      ]),
    )
  })
})
