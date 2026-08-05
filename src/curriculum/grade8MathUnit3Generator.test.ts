import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE8_MATH_UNIT3_ITEM_TYPES,
  generateGrade8MathUnit3Question,
  type Grade8MathUnit3Question,
} from './grade8MathUnit3Generator'

const RUNS_PER_DIFFICULTY = 200

afterEach(() => setRng(null))

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function requiredMatch(text: string, pattern: RegExp): RegExpMatchArray {
  const match = text.match(pattern)
  if (!match)
    throw new Error(`Prompt did not match independent oracle grammar: ${text}`)
  return match
}

// ---------------------------------------------------------------------------
// Independent re-derivations, reimplemented separately from the generator's
// helpers. They operate only on rendered prompt/choice text.
// ---------------------------------------------------------------------------

function ownGcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : ownGcd(b, a % b)
}

function ownFormatSolution(numerator: number, denominator: number): string {
  let n = numerator
  let d = denominator
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = ownGcd(n, d) || 1
  n /= g
  d /= g
  return d === 1 ? String(n) : `${n}/${d}`
}

function parseCoeff(s: string): number {
  if (s === 'x') return 1
  if (s === '-x') return -1
  const m = requiredMatch(s, /^(-?\d+)x$/)
  return Number(m[1])
}

/** Independent parser for the "a*x + b" grammar rendered across most Unit 3 prompts. */
function parseLinearExpr(s: string): { a: number; b: number } {
  let m = s.match(/^(-?\d*x|x|-x) ([+-]) (\d+)$/)
  if (m) {
    const a = parseCoeff(m[1])
    const b = m[2] === '+' ? Number(m[3]) : -Number(m[3])
    return { a, b }
  }
  m = s.match(/^(-?\d*x|x|-x)$/)
  if (m) return { a: parseCoeff(m[1]), b: 0 }
  m = requiredMatch(s, /^(-?\d+)$/)
  return { a: 0, b: Number(m[1]) }
}

function splitEquation(prompt: string, prefix: string): { left: string; right: string } {
  const withoutPrefix = requiredMatch(prompt, new RegExp(`^${prefix}(.+)\\.$`))[1]
  const parts = withoutPrefix.split(' = ')
  if (parts.length !== 2) throw new Error(`Expected exactly one '=' in: ${withoutPrefix}`)
  return { left: parts[0], right: parts[1] }
}

const CONTEXT_PATTERNS = [
  {
    describe:
      /^A bike rental costs \$(\d+) plus \$(\d+) per hour\. The total cost was \$(\d+)\. Which equation represents the number of hours, x\?$/,
    ask: /^A bike rental costs \$(\d+) plus \$(\d+) per hour\. If the total cost was \$(\d+), how many hours, x, were rented\?$/,
  },
  {
    describe:
      /^A phone plan costs \$(\d+) plus \$(\d+) per gigabyte of data\. The bill was \$(\d+)\. Which equation represents the number of gigabytes, x\?$/,
    ask: /^A phone plan costs \$(\d+) plus \$(\d+) per gigabyte of data\. If the bill was \$(\d+), how many gigabytes, x, were used\?$/,
  },
]

function parseContext(prompt: string, key: 'describe' | 'ask'): { a: number; b: number; c: number } {
  for (const template of CONTEXT_PATTERNS) {
    const m = prompt.match(template[key])
    if (m) return { b: Number(m[1]), a: Number(m[2]), c: Number(m[3]) }
  }
  throw new Error(`Prompt did not match any known context template: ${prompt}`)
}

/** Uses only rendered prompt text; it never reads question.parameters or generator helpers. */
function oracleAnswer(question: Grade8MathUnit3Question): string {
  switch (question.itemType) {
    case 'solve-one-step-equation':
    case 'solve-two-step-equation': {
      const { left, right } = splitEquation(question.prompt, 'Solve for x: ')
      const { a, b } = parseLinearExpr(left)
      const c = Number(right)
      return ownFormatSolution(c - b, a)
    }
    case 'solve-with-distributive-property': {
      const { left, right } = splitEquation(question.prompt, 'Solve for x: ')
      const [, p, sign, q] = requiredMatch(left, /^(-?\d+)\(x ([+-]) (\d+)\)$/)
      const pNum = Number(p)
      const qNum = sign === '+' ? Number(q) : -Number(q)
      const c = Number(right)
      return ownFormatSolution(c - pNum * qNum, pNum)
    }
    case 'solve-combining-like-terms': {
      const { left, right } = splitEquation(question.prompt, 'Solve for x: ')
      const [, term1, sign2, coeff2, sign3, const3] = requiredMatch(
        left,
        /^(-?\d*x|x|-x) ([+-]) (\d*)x(?: ([+-]) (\d+))?$/,
      )
      const a1 = parseCoeff(term1)
      const magnitude2 = coeff2 === '' ? 1 : Number(coeff2)
      const a2 = sign2 === '+' ? magnitude2 : -magnitude2
      const b = sign3 === undefined ? 0 : sign3 === '+' ? Number(const3) : -Number(const3)
      const c = Number(right)
      return ownFormatSolution(c - b, a1 + a2)
    }
    case 'solve-variables-both-sides': {
      const { left, right } = splitEquation(question.prompt, 'Solve for x: ')
      const { a, b } = parseLinearExpr(left)
      const { a: c, b: d } = parseLinearExpr(right)
      return ownFormatSolution(d - b, a - c)
    }
    case 'classify-solution-type': {
      const [, left, right] = requiredMatch(
        question.prompt,
        /^How many solutions does (.+) = (.+) have\?$/,
      )
      const { a, b } = parseLinearExpr(left)
      const { a: c, b: d } = parseLinearExpr(right)
      if (a !== c) return 'one solution'
      return b === d ? 'infinitely many solutions' : 'no solution'
    }
    case 'check-a-solution': {
      const [, candidate, left, right] = requiredMatch(
        question.prompt,
        /^Is x = (-?\d+) a solution to (.+) = (-?\d+)\?$/,
      )
      const { a, b } = parseLinearExpr(left)
      return a * Number(candidate) + b === Number(right) ? 'yes' : 'no'
    }
    case 'identify-solution-from-choices': {
      const [, left, right] = requiredMatch(
        question.prompt,
        /^Which value of x solves (.+) = (-?\d+)\?$/,
      )
      const { a, b } = parseLinearExpr(left)
      return ownFormatSolution(Number(right) - b, a)
    }
    case 'write-equation-from-context': {
      const { a, b, c } = parseContext(question.prompt, 'describe')
      return `${a}x + ${b} = ${c}`
    }
    case 'solve-word-problem': {
      const { a, b, c } = parseContext(question.prompt, 'ask')
      return ownFormatSolution(c - b, a)
    }
    case 'equation-error-analysis': {
      const [, left, c, a2, claimed, claimed2] = requiredMatch(
        question.prompt,
        /^A student solves (.+) = (-?\d+)\. They write (-?\d+)x = (-?\d+), then say x = (-?\d+)\.\s*Which statement best analyzes the error\?$/,
      )
      const { a, b } = parseLinearExpr(left)
      expect(a2).toBe(String(a))
      expect(claimed2).toBe(claimed)
      expect(Number(claimed)).toBe(Number(c) - b)
      return `The student forgot to divide both sides by ${a}; the correct solution is x = ${ownFormatSolution(Number(c) - b, a)}.`
    }
    case 'solution-type-error-analysis': {
      const [, left, right] = requiredMatch(
        question.prompt,
        /^A student says (.+) = (.+) has one solution because they can solve for x\. Which statement correctly analyzes the equation\?$/,
      )
      const { a, b } = parseLinearExpr(left)
      const { a: c, b: d } = parseLinearExpr(right)
      expect(c).toBe(a)
      return b === d
        ? 'The equation has infinitely many solutions; both sides are identical for every x.'
        : `The equation has no solution; simplifying gives ${b} = ${d}, which is never true.`
    }
    default: {
      const exhaustive: never = question
      throw new Error(`Unhandled item type: ${JSON.stringify(exhaustive)}`)
    }
  }
}

describe('generateGrade8MathUnit3Question', () => {
  for (const itemType of GRADE8_MATH_UNIT3_ITEM_TYPES) {
    it(`matches an independent oracle for ${itemType} across difficulties`, () => {
      for (const difficulty of [1, 2, 3] as const) {
        setRng(
          seededRng(0xc32_0001 + difficulty * 97 + itemType.length * 131),
        )
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade8MathUnit3Question(itemType, difficulty)
          expect(question.choices).toContain(curriculumAnswer(question))
          expect(new Set(question.choices).size).toBe(question.choices.length)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
        }
      }
    })
  }

  it('presents both scale and shift one-step modes', () => {
    setRng(seededRng(0xc32_1001))
    const modes = new Set<string>()
    for (let run = 0; run < 200; run++) {
      modes.add(
        generateGrade8MathUnit3Question('solve-one-step-equation', 2).parameters.mode,
      )
    }
    expect(modes).toEqual(new Set(['scale', 'shift']))
  })

  it('presents all three classify-solution-type outcomes', () => {
    setRng(seededRng(0xc32_1002))
    const types = new Set<string>()
    for (let run = 0; run < 300; run++) {
      types.add(
        generateGrade8MathUnit3Question('classify-solution-type', 2).parameters
          .solutionType,
      )
    }
    expect(types).toEqual(new Set(['one', 'none', 'infinite']))
  })

  it('presents both yes and no outcomes for check-a-solution', () => {
    setRng(seededRng(0xc32_1003))
    const outcomes = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const q = generateGrade8MathUnit3Question('check-a-solution', 2)
      outcomes.add(curriculumAnswer(q))
    }
    expect(outcomes).toEqual(new Set(['yes', 'no']))
  })

  it('presents both none and infinite outcomes for solution-type-error-analysis', () => {
    setRng(seededRng(0xc32_1004))
    const types = new Set<string>()
    for (let run = 0; run < 200; run++) {
      types.add(
        generateGrade8MathUnit3Question('solution-type-error-analysis', 2).parameters
          .solutionType,
      )
    }
    expect(types).toEqual(new Set(['none', 'infinite']))
  })

  it('always presents a genuinely wrong claim in equation-error-analysis', () => {
    setRng(seededRng(0xc32_1005))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade8MathUnit3Question('equation-error-analysis', 3)
      const { a, b, c, claimed } = question.parameters
      expect(claimed).toBe(c - b)
      expect(a).toBeGreaterThanOrEqual(2)
      expect(claimed).not.toBe((c - b) / a)
    }
  })

  it('never lets solve-variables-both-sides or solve-combining-like-terms have a zero coefficient', () => {
    setRng(seededRng(0xc32_1006))
    for (let run = 0; run < 300; run++) {
      const both = generateGrade8MathUnit3Question('solve-variables-both-sides', 3)
      expect(both.parameters.a).not.toBe(both.parameters.c)

      const combining = generateGrade8MathUnit3Question(
        'solve-combining-like-terms',
        3,
      )
      expect(combining.parameters.a1 + combining.parameters.a2).not.toBe(0)
    }
  })
})
