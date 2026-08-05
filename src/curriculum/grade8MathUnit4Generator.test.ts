import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE8_MATH_UNIT4_GENERATORS,
  GRADE8_MATH_UNIT4_ITEM_DEFINITIONS,
  GRADE8_MATH_UNIT4_ITEM_TYPES,
  generateGrade8MathUnit4Question,
  type Grade8MathUnit4ItemType,
  type Grade8MathUnit4Question,
} from './grade8MathUnit4Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

// ---------- independently written oracle helpers (never call the generator's own helpers) ----------

function gcdOracle(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcdOracle(b, a % b)
}

function reduceFraction(numerator: number, denominator: number): { n: number; d: number } {
  const sign = denominator < 0 ? -1 : 1
  const n0 = sign * numerator
  const d0 = sign * denominator
  const g = gcdOracle(n0, d0) || 1
  return { n: n0 / g, d: d0 / g }
}

function fractionString(numerator: number, denominator: number): string {
  const { n, d } = reduceFraction(numerator, denominator)
  return d === 1 ? String(n) : `${n}/${d}`
}

function linearTerm(coefficient: number): string {
  if (coefficient === 1) return 'x'
  if (coefficient === -1) return '-x'
  return `${coefficient}x`
}

function slopeInterceptEquation(p: number, q: number, b: number): string {
  const slopeTerm = q === 1 ? linearTerm(p) : `(${fractionString(p, q)})x`
  const interceptTerm = b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${Math.abs(b)}`
  return `y = ${slopeTerm}${interceptTerm}`
}

function tableText(x0: number, y0: number, xStep: number, rowStep: number, rowCount: number): string {
  const xs = Array.from({ length: rowCount }, (_, i) => x0 + i * xStep).join(', ')
  const ys = Array.from({ length: rowCount }, (_, i) => y0 + i * rowStep).join(', ')
  return `x: ${xs}\ny: ${ys}`
}

interface ContextOracle {
  prompt: (rate: number, fee: number) => string
  slopeMeaning: (rate: number) => string
  interceptMeaning: (fee: number) => string
}

const CONTEXTS: readonly ContextOracle[] = [
  {
    prompt: (rate, fee) =>
      `A moving company's total cost is given by C = ${rate}h + ${fee}, where C is the total cost in dollars and h is the number of hours of labor. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The company charges $${rate} for each additional hour of labor.`,
    interceptMeaning: (fee) => `The company charges a flat fee of $${fee} before any labor hours.`,
  },
  {
    prompt: (rate, fee) =>
      `A taxi fare is given by F = ${rate}m + ${fee}, where F is the total fare in dollars and m is the number of miles traveled. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The fare increases by $${rate} for each additional mile traveled.`,
    interceptMeaning: (fee) => `There is a base fare of $${fee} before any miles are traveled.`,
  },
  {
    prompt: (rate, fee) =>
      `A plant's height is given by H = ${rate}w + ${fee}, where H is the height in centimeters and w is the number of weeks since it was measured. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The plant grows ${rate} centimeters per week.`,
    interceptMeaning: (fee) => `The plant was ${fee} centimeters tall when it was first measured.`,
  },
  {
    prompt: (rate, fee) =>
      `The amount of water in a tank is given by G = ${rate}t + ${fee}, where G is the number of gallons in the tank and t is the number of minutes since filling started. What does the slope represent in this context?`,
    slopeMeaning: (rate) => `The tank fills at a rate of ${rate} gallons per minute.`,
    interceptMeaning: (fee) => `The tank already had ${fee} gallons of water before filling started.`,
  },
]

function interceptPromptOracle(context: ContextOracle, rate: number, fee: number): string {
  return context
    .prompt(rate, fee)
    .replace('What does the slope represent in this context?', 'What does the y-intercept represent in this context?')
}

function oracleAnswer(question: Grade8MathUnit4Question): string {
  switch (question.itemType) {
    case 'slope-from-two-points': {
      const { x1, y1, x2, y2 } = question.parameters
      return fractionString(y2 - y1, x2 - x1)
    }
    case 'slope-from-table': {
      const { xStep, rowStep } = question.parameters
      return fractionString(rowStep, xStep)
    }
    case 'similar-triangle-point-on-line': {
      const { x0, y0, p, q, t } = question.parameters
      return `(${x0 + q * t}, ${y0 + p * t})`
    }
    case 'slope-triangle-legs': {
      const { p, q, given, givenLeg } = question.parameters
      const numer = given === 'run' ? Math.abs(p) : q
      const denom = given === 'run' ? q : Math.abs(p)
      return fractionString(numer * givenLeg, denom)
    }
    case 'write-slope-intercept-equation': {
      const { p, q, b } = question.parameters
      return slopeInterceptEquation(p, q, b)
    }
    case 'identify-slope-and-intercept': {
      const { p, q, b } = question.parameters
      return `slope = ${fractionString(p, q)}, y-intercept = ${b}`
    }
    case 'compare-proportional-relationships': {
      const { pA, qA, pB, qB, askMode } = question.parameters
      const crossA = pA * qB
      const crossB = pB * qA
      return askMode === 'which-greater'
        ? crossA > crossB
          ? 'Relationship A'
          : 'Relationship B'
        : fractionString(Math.abs(crossA - crossB), qA * qB)
    }
    case 'evaluate-linear-equation-at-x': {
      const { p, q, b, x } = question.parameters
      return fractionString(p * x + b * q, q)
    }
    case 'identify-parallel-lines': {
      const { p, q, correctB } = question.parameters
      return slopeInterceptEquation(p, q, correctB)
    }
    case 'parallel-line-through-point': {
      const { p, q, newB } = question.parameters
      return slopeInterceptEquation(p, q, newB)
    }
    case 'interpret-slope-in-context': {
      const { contextIndex, rate } = question.parameters
      return CONTEXTS[contextIndex].slopeMeaning(rate)
    }
    case 'interpret-y-intercept-in-context': {
      const { contextIndex, fee } = question.parameters
      return CONTEXTS[contextIndex].interceptMeaning(fee)
    }
  }
}

function assertPromptRepresentsParameters(question: Grade8MathUnit4Question): void {
  switch (question.itemType) {
    case 'slope-from-two-points': {
      const { x1, y1, x2, y2 } = question.parameters
      expect(x1).not.toBe(x2)
      expect(question.prompt).toBe(`Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`)
      return
    }
    case 'slope-from-table': {
      const { x0, y0, xStep, rowStep, rowCount } = question.parameters
      expect(xStep).toBeGreaterThanOrEqual(1)
      expect([3, 4]).toContain(rowCount)
      expect(question.prompt).toBe(
        `A line passes through these points:\n${tableText(x0, y0, xStep, rowStep, rowCount)}\nWhat is the slope (rate of change) of the line?`,
      )
      return
    }
    case 'similar-triangle-point-on-line': {
      const { x0, y0, p, q, t } = question.parameters
      expect(q).toBeGreaterThanOrEqual(1)
      expect(p).not.toBe(0)
      expect(t).toBeGreaterThanOrEqual(2)
      expect(question.prompt).toBe(
        `A line passes through (${x0}, ${y0}). A slope triangle on the line has a horizontal leg (run) of ${q} and a vertical leg (rise) of ${p}. A similar slope triangle further along the same line is ${t} times as large. Which point also lies on the line?`,
      )
      return
    }
    case 'slope-triangle-legs': {
      const { p, q, given, givenLeg } = question.parameters
      expect(['run', 'rise']).toContain(given)
      expect(givenLeg).toBeGreaterThanOrEqual(1)
      expect(question.prompt).toBe(
        `A line has a slope of ${fractionString(p, q)}. A right triangle drawn along the line has a ${given === 'run' ? 'horizontal leg (run)' : 'vertical leg (rise)'} of ${givenLeg} units. What is the length of the other leg?`,
      )
      return
    }
    case 'write-slope-intercept-equation': {
      const { mode, p, q, b, x1, y1, x2, y2 } = question.parameters
      expect(x2 - x1).toBe(q)
      expect(y2 - y1).toBe(p)
      expect(x1 % q === 0).toBe(true)
      expect(y1).toBe(b + p * (x1 / q))
      expect(question.prompt).toBe(
        mode === 'slope-intercept'
          ? `Write the equation, in slope-intercept form, of a line with slope ${fractionString(p, q)} and y-intercept ${b}.`
          : `Write the equation, in slope-intercept form, of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`,
      )
      return
    }
    case 'identify-slope-and-intercept': {
      const { form, p, q, b } = question.parameters
      if (form === 'standard') expect(q).toBe(1)
      const equationText = form === 'slope-intercept' ? slopeInterceptEquation(p, q, b) : `${linearTerm(-p)} + y = ${b}`
      expect(question.prompt).toBe(
        form === 'slope-intercept'
          ? `Identify the slope and y-intercept of the line ${equationText}.`
          : `Identify the slope and y-intercept of the line ${equationText}. Rearrange into slope-intercept form first.`,
      )
      return
    }
    case 'compare-proportional-relationships': {
      const { pA, qA, pB, qB, aIsEquation, askMode } = question.parameters
      expect(pA * qB).not.toBe(pB * qA)
      const aText = aIsEquation
        ? `Relationship A: ${slopeInterceptEquation(pA, qA, 0)}`
        : `Relationship A (proportional):\nx: ${qA}, ${2 * qA}, ${3 * qA}\ny: ${pA}, ${2 * pA}, ${3 * pA}`
      const bText = aIsEquation
        ? `Relationship B (proportional):\nx: ${qB}, ${2 * qB}, ${3 * qB}\ny: ${pB}, ${2 * pB}, ${3 * pB}`
        : `Relationship B: ${slopeInterceptEquation(pB, qB, 0)}`
      const question2 =
        askMode === 'which-greater'
          ? 'Which relationship has the greater rate of change (unit rate)?'
          : 'By how much does the greater rate of change exceed the lesser rate of change?'
      expect(question.prompt).toBe(`${aText}\n${bText}\n${question2}`)
      return
    }
    case 'evaluate-linear-equation-at-x': {
      const { p, q, b, x } = question.parameters
      expect(question.prompt).toBe(`For the line ${slopeInterceptEquation(p, q, b)}, find y when x = ${x}.`)
      return
    }
    case 'identify-parallel-lines': {
      const { p, q, b, correctB, p2, q2, p3, q3 } = question.parameters
      expect(correctB).not.toBe(b)
      expect(p2 * q).not.toBe(p * q2)
      expect(p3 * q).not.toBe(p * q3)
      expect(question.prompt).toBe(
        `A line has equation ${slopeInterceptEquation(p, q, b)}. Which of these equations represents a line parallel to it?`,
      )
      return
    }
    case 'parallel-line-through-point': {
      const { p, q, b, x0, y0, newB } = question.parameters
      expect(newB).not.toBe(b)
      expect(x0 % q === 0).toBe(true)
      expect(y0).toBe(newB + p * (x0 / q))
      expect(question.prompt).toBe(
        `A line has equation ${slopeInterceptEquation(p, q, b)}. Write the equation of the line through (${x0}, ${y0}) that is parallel to this line.`,
      )
      return
    }
    case 'interpret-slope-in-context': {
      const { contextIndex, rate, fee } = question.parameters
      expect(rate).not.toBe(fee)
      expect(question.prompt).toBe(CONTEXTS[contextIndex].prompt(rate, fee))
      return
    }
    case 'interpret-y-intercept-in-context': {
      const { contextIndex, rate, fee } = question.parameters
      expect(rate).not.toBe(fee)
      expect(question.prompt).toBe(interceptPromptOracle(CONTEXTS[contextIndex], rate, fee))
      return
    }
  }
}

function assertChoicesStayInDomain(question: Grade8MathUnit4Question): void {
  switch (question.itemType) {
    case 'similar-triangle-point-on-line':
      for (const choice of question.choices) expect(choice).toMatch(/^\(-?\d+, -?\d+\)$/)
      return
    case 'write-slope-intercept-equation':
    case 'identify-parallel-lines':
    case 'parallel-line-through-point':
      for (const choice of question.choices) expect(choice).toMatch(/^y = /)
      return
    case 'identify-slope-and-intercept':
      for (const choice of question.choices) {
        expect(choice).toMatch(/^slope = -?\d+(\/\d+)?, y-intercept = -?\d+(\/\d+)?$/)
      }
      return
    case 'compare-proportional-relationships':
      if (question.parameters.askMode === 'which-greater') {
        for (const choice of question.choices) {
          expect(choice).toMatch(
            /^(Relationship [AB]|They have the same rate of change\.|The rate of change cannot be determined from this information\.)$/,
          )
        }
      } else {
        for (const choice of question.choices) expect(choice).toMatch(/^-?\d+(\/\d+)?$/)
      }
      return
    case 'interpret-slope-in-context':
    case 'interpret-y-intercept-in-context':
      for (const choice of question.choices) expect(choice).toMatch(/\.$/)
      return
    default:
      for (const choice of question.choices) expect(choice).toMatch(/^-?\d+(\/\d+)?$/)
  }
}

function expectWellFormed(question: Grade8MathUnit4Question): void {
  expect(question.prompt.trim()).not.toBe('')
  expect(question.choices.length).toBeGreaterThanOrEqual(3)
  expect(question.choices.length).toBeLessThanOrEqual(4)
  expect(new Set(question.choices).size).toBe(question.choices.length)
  expect(question.answerIndex).toBeGreaterThanOrEqual(0)
  expect(question.answerIndex).toBeLessThan(question.choices.length)
  for (const choice of question.choices) expect(choice.trim()).not.toBe('')
  expect(question.choices).toContain(curriculumAnswer(question))
  expect(question.parameters).not.toHaveProperty('correctAnswer')
  assertChoicesStayInDomain(question)
}

describe('Grade 8 Math Unit 4 coverage contract', () => {
  it('registers exactly one definition and generator for every frozen item type', () => {
    expect(Object.keys(GRADE8_MATH_UNIT4_ITEM_DEFINITIONS)).toEqual([...GRADE8_MATH_UNIT4_ITEM_TYPES])
    expect(Object.keys(GRADE8_MATH_UNIT4_GENERATORS)).toEqual([...GRADE8_MATH_UNIT4_ITEM_TYPES])
    expect(new Set(GRADE8_MATH_UNIT4_ITEM_TYPES).size).toBe(12)
  })

  it('covers both standards and all six lesson focuses derived from the source records', () => {
    const definitions = Object.values(GRADE8_MATH_UNIT4_ITEM_DEFINITIONS)
    expect(new Set(definitions.map((definition) => definition.standard))).toEqual(new Set(['8.EE.5', '8.EE.6']))
    expect(new Set(definitions.map((definition) => definition.lessonFocus))).toEqual(
      new Set([
        'slope as rate of change',
        'similar triangles and slope',
        'slope-intercept form',
        'graphs tables and equations',
        'parallel-line reasoning',
        'interpreting intercepts',
      ]),
    )
  })

  it('makes every item type reachable at every difficulty', () => {
    setRng(seededRng(0x8_04_c0de))
    for (const itemType of GRADE8_MATH_UNIT4_ITEM_TYPES) {
      for (const difficulty of [1, 2, 3] as const) {
        const question = generateGrade8MathUnit4Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
        expect(question.standard).toBe(GRADE8_MATH_UNIT4_ITEM_DEFINITIONS[itemType].standard)
        expect(question.lessonFocus).toBe(GRADE8_MATH_UNIT4_ITEM_DEFINITIONS[itemType].lessonFocus)
      }
    }
  })

  it('has one complete authored worked example per item type', () => {
    const exampleObjects = new Set<CurriculumWorkedExampleLike>()
    for (const itemType of GRADE8_MATH_UNIT4_ITEM_TYPES) {
      const example = GRADE8_MATH_UNIT4_ITEM_DEFINITIONS[itemType].workedExample
      expect(example.prompt.trim()).not.toBe('')
      expect(example.answer.trim()).not.toBe('')
      expect(example.steps.length).toBeGreaterThanOrEqual(2)
      exampleObjects.add(example)
    }
    expect(exampleObjects.size).toBe(GRADE8_MATH_UNIT4_ITEM_TYPES.length)
  })
})

type CurriculumWorkedExampleLike = (typeof GRADE8_MATH_UNIT4_ITEM_DEFINITIONS)[Grade8MathUnit4ItemType]['workedExample']

describe('Grade 8 Math Unit 4 independent property oracles', () => {
  for (const [typeIndex, itemType] of GRADE8_MATH_UNIT4_ITEM_TYPES.entries()) {
    it(`${itemType}: 200 items per difficulty have the independently recomputed answer`, () => {
      setRng(seededRng(0x800_000 + typeIndex))
      for (const difficulty of [1, 2, 3] as const) {
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade8MathUnit4Question(itemType, difficulty)
          assertPromptRepresentsParameters(question)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
          expectWellFormed(question)
        }
      }
    })
  }
})

describe('Grade 8 Math Unit 4 required edge cases', () => {
  it('slope-from-two-points reaches negative and fraction slopes in both point orders', () => {
    setRng(seededRng(0x51_0_0001))
    let sawNegative = false
    let sawFraction = false
    let sawDescendingX = false
    for (let run = 0; run < 800; run++) {
      const question = generateGrade8MathUnit4Question('slope-from-two-points', 3)
      const answer = curriculumAnswer(question)
      if (answer.startsWith('-')) sawNegative = true
      if (answer.includes('/')) sawFraction = true
      if (question.parameters.x2 < question.parameters.x1) sawDescendingX = true
    }
    expect(sawNegative).toBe(true)
    expect(sawFraction).toBe(true)
    expect(sawDescendingX).toBe(true)
  })

  it('slope-from-table reaches both row counts and fraction rates', () => {
    setRng(seededRng(0x52_0_0001))
    const rowCounts = new Set<number>()
    let sawFraction = false
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit4Question('slope-from-table', 3)
      rowCounts.add(question.parameters.rowCount)
      if (curriculumAnswer(question).includes('/')) sawFraction = true
    }
    expect(rowCounts).toEqual(new Set([3, 4]))
    expect(sawFraction).toBe(true)
  })

  it('similar-triangle-point-on-line always produces guaranteed-wrong distractor points', () => {
    setRng(seededRng(0x53_0_0001))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade8MathUnit4Question('similar-triangle-point-on-line', 3)
      const { x0, y0, p, q } = question.parameters
      const onLine = (point: string): boolean => {
        const match = /^\((-?\d+), (-?\d+)\)$/.exec(point)
        if (!match) return false
        const x = Number(match[1])
        const y = Number(match[2])
        return q * (y - y0) === p * (x - x0)
      }
      for (const choice of question.choices) {
        expect(onLine(choice)).toBe(choice === curriculumAnswer(question))
      }
    }
  })

  it('slope-triangle-legs reaches both given-leg kinds and fraction other-leg answers', () => {
    setRng(seededRng(0x54_0_0001))
    const givenKinds = new Set<string>()
    let sawFraction = false
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit4Question('slope-triangle-legs', 3)
      givenKinds.add(question.parameters.given)
      if (curriculumAnswer(question).includes('/')) sawFraction = true
    }
    expect(givenKinds).toEqual(new Set(['run', 'rise']))
    expect(sawFraction).toBe(true)
  })

  it('write-slope-intercept-equation reaches both modes and formats coefficients and zero intercepts correctly', () => {
    setRng(seededRng(0x55_0_0001))
    const modes = new Set<string>()
    let sawZeroIntercept = false
    let sawUnitCoefficient = false
    let sawNegativeUnitCoefficient = false
    let sawFractionSlope = false
    for (let run = 0; run < 2_000; run++) {
      const question = generateGrade8MathUnit4Question('write-slope-intercept-equation', 3)
      modes.add(question.parameters.mode)
      const answer = curriculumAnswer(question)
      expect(answer).not.toMatch(/\+ 0\b/)
      expect(answer).not.toMatch(/(?<!\d)1x/) // a bare coefficient of 1 or -1 must render as "x"/"-x", never "1x"/"-1x"
      if (question.parameters.b === 0) {
        sawZeroIntercept = true
        expect(answer).not.toMatch(/[+-] 0$/)
      }
      if (question.parameters.p === 1 && question.parameters.q === 1) {
        sawUnitCoefficient = true
        expect(answer).toMatch(/^y = x/)
      }
      if (question.parameters.p === -1 && question.parameters.q === 1) {
        sawNegativeUnitCoefficient = true
        expect(answer).toMatch(/^y = -x/)
      }
      if (question.parameters.q > 1) sawFractionSlope = true
    }
    expect(modes).toEqual(new Set(['slope-intercept', 'two-points']))
    expect(sawZeroIntercept).toBe(true)
    expect(sawUnitCoefficient).toBe(true)
    expect(sawNegativeUnitCoefficient).toBe(true)
    expect(sawFractionSlope).toBe(true)
  })

  it('identify-slope-and-intercept reaches both the slope-intercept and standard forms', () => {
    setRng(seededRng(0x56_0_0001))
    const forms = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit4Question('identify-slope-and-intercept', 3)
      forms.add(question.parameters.form)
    }
    expect(forms).toEqual(new Set(['slope-intercept', 'standard']))
  })

  it('compare-proportional-relationships reaches both layouts and both ask modes', () => {
    setRng(seededRng(0x57_0_0001))
    const layouts = new Set<boolean>()
    const askModes = new Set<string>()
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit4Question('compare-proportional-relationships', 3)
      layouts.add(question.parameters.aIsEquation)
      askModes.add(question.parameters.askMode)
    }
    expect(layouts).toEqual(new Set([true, false]))
    expect(askModes).toEqual(new Set(['which-greater', 'difference']))
  })

  it('evaluate-linear-equation-at-x reaches both integer and fraction results', () => {
    setRng(seededRng(0x58_0_0001))
    let sawInteger = false
    let sawFraction = false
    for (let run = 0; run < 600; run++) {
      const question = generateGrade8MathUnit4Question('evaluate-linear-equation-at-x', 3)
      const answer = curriculumAnswer(question)
      if (answer.includes('/')) sawFraction = true
      else sawInteger = true
    }
    expect(sawInteger).toBe(true)
    expect(sawFraction).toBe(true)
  })

  it('identify-parallel-lines never offers the identical line as correct and always varies the wrong slopes', () => {
    setRng(seededRng(0x59_0_0001))
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit4Question('identify-parallel-lines', 3)
      const { p, q, b, correctB } = question.parameters
      expect(curriculumAnswer(question)).not.toBe(slopeInterceptEquation(p, q, b))
      expect(correctB).not.toBe(b)
    }
  })

  it('parallel-line-through-point always shifts the intercept away from the reference line', () => {
    setRng(seededRng(0x60_0_0001))
    let sawPositiveK = false
    let sawNegativeK = false
    for (let run = 0; run < 400; run++) {
      const question = generateGrade8MathUnit4Question('parallel-line-through-point', 3)
      const { p, q, b, x0, newB } = question.parameters
      expect(newB).not.toBe(b)
      const k = x0 / q
      if (k > 0) sawPositiveK = true
      if (k < 0) sawNegativeK = true
      void p
    }
    expect(sawPositiveK).toBe(true)
    expect(sawNegativeK).toBe(true)
  })

  it('interpret-slope-in-context and interpret-y-intercept-in-context reach all four contexts', () => {
    setRng(seededRng(0x61_0_0001))
    const slopeContexts = new Set<number>()
    const interceptContexts = new Set<number>()
    for (let run = 0; run < 400; run++) {
      const slopeQuestion = generateGrade8MathUnit4Question('interpret-slope-in-context', 3)
      slopeContexts.add(slopeQuestion.parameters.contextIndex)
      const interceptQuestion = generateGrade8MathUnit4Question('interpret-y-intercept-in-context', 3)
      interceptContexts.add(interceptQuestion.parameters.contextIndex)
    }
    expect(slopeContexts).toEqual(new Set([0, 1, 2, 3]))
    expect(interceptContexts).toEqual(new Set([0, 1, 2, 3]))
  })
})
