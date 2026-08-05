import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE8_MATH_UNIT2_ITEM_TYPES,
  generateGrade8MathUnit2Question,
  type Grade8MathUnit2Question,
} from './grade8MathUnit2Generator'

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

function ownFormatCoefficient(coeffTenths: number): string {
  return coeffTenths % 10 === 0
    ? String(coeffTenths / 10)
    : (coeffTenths / 10).toFixed(1)
}

function ownFormatSci(coeffTenths: number, exponent: number): string {
  return `${ownFormatCoefficient(coeffTenths)} × 10^${exponent}`
}

function ownStandardForm(coeffTenths: number, exponent: number): string {
  const d1 = Math.floor(coeffTenths / 10)
  const d2 = coeffTenths % 10
  if (exponent >= 1) return `${d1}${d2}${'0'.repeat(exponent - 1)}`
  if (exponent === 0) return d2 === 0 ? `${d1}` : `${d1}.${d2}`
  const raw = `0.${'0'.repeat(-exponent - 1)}${d1}${d2}`
  return d2 === 0 ? raw.slice(0, -1) : raw
}

function ownParseStandardForm(s: string): { coeffTenths: number; exponent: number } {
  if (s.includes('.')) {
    const [intPart, fracPart] = s.split('.')
    if (intPart !== '0') {
      const d1 = intPart[0]
      const d2 = fracPart[0] ?? '0'
      return { coeffTenths: Number(`${d1}${d2}`), exponent: intPart.length - 1 }
    }
    const stripped = fracPart.replace(/^0+/, '')
    const leadingZeros = fracPart.length - stripped.length
    const d1 = stripped[0]
    const d2 = stripped[1] ?? '0'
    return { coeffTenths: Number(`${d1}${d2}`), exponent: -(leadingZeros + 1) }
  }
  const d1 = s[0]
  const d2 = s[1] ?? '0'
  return { coeffTenths: Number(`${d1}${d2}`), exponent: s.length - 1 }
}

function ownParseSci(s: string): { coeffTenths: number; exponent: number } {
  const m = requiredMatch(s, /^(\d+(?:\.\d)?) × 10\^(-?\d+)$/)
  const coeffStr = m[1]
  const exponent = Number(m[2])
  const coeffTenths = coeffStr.includes('.')
    ? Number(coeffStr.replace('.', ''))
    : Number(coeffStr) * 10
  return { coeffTenths, exponent }
}

function ownMultiplySci(
  c1: number,
  e1: number,
  c2: number,
  e2: number,
): { coeffTenths: number; exponent: number } {
  const product = c1 * c2
  return product < 10
    ? { coeffTenths: product * 10, exponent: e1 + e2 }
    : { coeffTenths: product, exponent: e1 + e2 + 1 }
}

function ownDivideSci(
  c1: number,
  e1: number,
  c2: number,
  e2: number,
): { coeffTenths: number; exponent: number } {
  if (c1 % c2 === 0) return { coeffTenths: (c1 / c2) * 10, exponent: e1 - e2 }
  if ((c1 * 10) % c2 === 0)
    return { coeffTenths: (c1 * 10) / c2, exponent: e1 - e2 - 1 }
  throw new Error(`Quotient ${c1}/${c2} does not terminate within one decimal digit`)
}

/** Uses only rendered prompt text; it never reads question.parameters or generator helpers. */
function oracleAnswer(question: Grade8MathUnit2Question): string {
  switch (question.itemType) {
    case 'evaluate-integer-exponent': {
      const [, base, exponent] = requiredMatch(
        question.prompt,
        /^Evaluate (\d+)\^(-?\d+)\.$/,
      )
      const b = Number(base)
      const e = Number(exponent)
      const magnitude = b ** Math.abs(e)
      return e >= 0 ? String(magnitude) : `1/${magnitude}`
    }
    case 'combine-powers': {
      const [, base, left, symbol, base2, right] = requiredMatch(
        question.prompt,
        /^Simplify (\d+)\^(-?\d+) (×|÷) (\d+)\^(-?\d+)\.$/,
      )
      expect(base2).toBe(base)
      const l = Number(left)
      const r = Number(right)
      const result = symbol === '×' ? l + r : l - r
      return `${base}^${result}`
    }
    case 'power-of-a-power': {
      const [, base, inner, outer] = requiredMatch(
        question.prompt,
        /^Simplify \((\d+)\^(-?\d+)\)\^(-?\d+)\.$/,
      )
      return `${base}^${Number(inner) * Number(outer)}`
    }
    case 'evaluate-power-of-ten': {
      const [, exponent] = requiredMatch(question.prompt, /^Evaluate 10\^(-?\d+)\.$/)
      return ownStandardForm(10, Number(exponent))
    }
    case 'compare-powers-of-ten': {
      const [, greater, lesser] = requiredMatch(
        question.prompt,
        /^10\^(-?\d+) is how many times as large as 10\^(-?\d+)\?$/,
      )
      return ownStandardForm(10, Number(greater) - Number(lesser))
    }
    case 'convert-scientific-notation': {
      let m = question.prompt.match(/^Write (.+) in scientific notation\.$/)
      if (m) {
        const parsed = ownParseStandardForm(m[1])
        return ownFormatSci(parsed.coeffTenths, parsed.exponent)
      }
      m = requiredMatch(question.prompt, /^Write (.+) in standard form\.$/)
      const parsed = ownParseSci(m[1])
      return ownStandardForm(parsed.coeffTenths, parsed.exponent)
    }
    case 'compare-scientific-notation': {
      const [, left, right] = requiredMatch(
        question.prompt,
        /^Compare (.+) and (.+)\.$/,
      )
      const l = ownParseSci(left)
      const r = ownParseSci(right)
      const leftGreater =
        l.exponent !== r.exponent ? l.exponent > r.exponent : l.coeffTenths > r.coeffTenths
      const relation = leftGreater ? '>' : '<'
      return `${left} ${relation} ${right}`
    }
    case 'operate-scientific-notation': {
      const [, verb, c1, e1, symbol, c2, e2] = requiredMatch(
        question.prompt,
        /^(Multiply|Divide) \((\d+) × 10\^(-?\d+)\) (×|÷) \((\d+) × 10\^(-?\d+)\) and write the result in scientific notation\.$/,
      )
      expect(verb === 'Multiply').toBe(symbol === '×')
      const result =
        symbol === '×'
          ? ownMultiplySci(Number(c1), Number(e1), Number(c2), Number(e2))
          : ownDivideSci(Number(c1), Number(e1), Number(c2), Number(e2))
      return ownFormatSci(result.coeffTenths, result.exponent)
    }
    case 'scientific-notation-word-problem': {
      const [, c1, e1, c2, e2] = requiredMatch(
        question.prompt,
        /^A processor performs (\d+) × 10\^(-?\d+) operations per second\. How many operations does it perform in (\d+) × 10\^(-?\d+) seconds\? Write the answer in scientific notation\.$/,
      )
      const result = ownMultiplySci(Number(c1), Number(e1), Number(c2), Number(e2))
      return ownFormatSci(result.coeffTenths, result.exponent)
    }
    case 'extreme-quantities-word-problem': {
      const [, c1, e1, c2, e2] = requiredMatch(
        question.prompt,
        /^A cell has a diameter of about (\d+) × 10\^(-?\d+) meters\. A virus has a diameter of about (\d+) × 10\^(-?\d+) meters\. How many times as large is the cell as the virus\?$/,
      )
      const result = ownDivideSci(Number(c1), Number(e1), Number(c2), Number(e2))
      return ownFormatSci(result.coeffTenths, result.exponent)
    }
    case 'exponent-error-analysis': {
      let m = question.prompt.match(
        /^A student simplifies (\d+)\^(\d+) × \1\^(\d+) as \1\^(-?\d+)\. Which statement best analyzes the error\?$/,
      )
      if (m) {
        const [base, left, right, claimed] = m.slice(1)
        expect(Number(claimed)).toBe(Number(left) * Number(right))
        const correct = Number(left) + Number(right)
        return `The exponents should be added, not multiplied: ${left} + ${right} = ${correct}, so the product is ${base}^${correct}.`
      }
      m = question.prompt.match(
        /^A student simplifies \((\d+)\^(-?\d+)\)\^(\d+) as \1\^(-?\d+)\. Which statement best analyzes the error\?$/,
      )
      if (m) {
        const [base, inner, outer, claimed] = m.slice(1)
        expect(Number(claimed)).toBe(Number(inner) + Number(outer))
        const correct = Number(inner) * Number(outer)
        return `The exponents should be multiplied, not added: ${inner} × ${outer} = ${correct}, so the result is ${base}^${correct}.`
      }
      m = question.prompt.match(
        /^A student claims (\d+)\^0 = 0\. Which statement best analyzes the claim\?$/,
      )
      if (m) {
        const [base] = m.slice(1)
        return `The claim is incorrect; any nonzero base raised to the power 0 equals 1, so ${base}^0 = 1.`
      }
      m = requiredMatch(
        question.prompt,
        /^A student claims (\d+)\^-(\d+) = -\1\^(\d+)\. Which statement best analyzes the claim\?$/,
      )
      const [base, left, left2] = m.slice(1)
      expect(left2).toBe(left)
      const magnitude = Number(base) ** Number(left)
      return `The claim is incorrect; a negative exponent means reciprocal, not a negative sign, so ${base}^-${left} = 1/${magnitude}.`
    }
    case 'scientific-notation-error-analysis': {
      const [, c1, e1, c2, e2, claimedCoeff, claimedExponent] = requiredMatch(
        question.prompt,
        /^A student multiplies \((\d+) × 10\^(-?\d+)\) × \((\d+) × 10\^(-?\d+)\) and writes (\d+) × 10\^(-?\d+)\. Which statement best analyzes the claim\?$/,
      )
      expect(Number(claimedCoeff)).toBe(Number(c1) * Number(c2))
      expect(Number(claimedExponent)).toBe(Number(e1) + Number(e2))
      const normalized = ownMultiplySci(Number(c1), Number(e1), Number(c2), Number(e2))
      return `The value is correct but not in scientific notation; ${claimedCoeff} × 10^${claimedExponent} should be rewritten as ${ownFormatSci(normalized.coeffTenths, normalized.exponent)}.`
    }
    default: {
      const exhaustive: never = question
      throw new Error(`Unhandled item type: ${JSON.stringify(exhaustive)}`)
    }
  }
}

describe('generateGrade8MathUnit2Question', () => {
  for (const itemType of GRADE8_MATH_UNIT2_ITEM_TYPES) {
    it(`matches an independent oracle for ${itemType} across difficulties`, () => {
      for (const difficulty of [1, 2, 3] as const) {
        setRng(
          seededRng(0xc22_0001 + difficulty * 97 + itemType.length * 131),
        )
        for (let run = 0; run < RUNS_PER_DIFFICULTY; run++) {
          const question = generateGrade8MathUnit2Question(itemType, difficulty)
          expect(question.choices).toContain(curriculumAnswer(question))
          expect(new Set(question.choices).size).toBe(question.choices.length)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
        }
      }
    })
  }

  it('presents both multiply and divide combine-powers modes', () => {
    setRng(seededRng(0xc22_1001))
    const modes = new Set<string>()
    for (let run = 0; run < 200; run++) {
      modes.add(generateGrade8MathUnit2Question('combine-powers', 2).parameters.mode)
    }
    expect(modes).toEqual(new Set(['multiply', 'divide']))
  })

  it('presents both toScientific and toStandard convert modes', () => {
    setRng(seededRng(0xc22_1002))
    const modes = new Set<string>()
    for (let run = 0; run < 200; run++) {
      modes.add(
        generateGrade8MathUnit2Question('convert-scientific-notation', 2).parameters
          .mode,
      )
    }
    expect(modes).toEqual(new Set(['toScientific', 'toStandard']))
  })

  it('presents both multiply and divide operate-scientific-notation modes', () => {
    setRng(seededRng(0xc22_1003))
    const modes = new Set<string>()
    for (let run = 0; run < 200; run++) {
      modes.add(
        generateGrade8MathUnit2Question('operate-scientific-notation', 2).parameters
          .mode,
      )
    }
    expect(modes).toEqual(new Set(['multiply', 'divide']))
  })

  it('presents all four exponent-error-analysis modes', () => {
    setRng(seededRng(0xc22_1004))
    const modes = new Set<string>()
    for (let run = 0; run < 400; run++) {
      modes.add(
        generateGrade8MathUnit2Question('exponent-error-analysis', 2).parameters.mode,
      )
    }
    expect(modes).toEqual(
      new Set([
        'product-adds-multiplied',
        'power-of-power-added',
        'zero-exponent',
        'negative-exponent-sign',
      ]),
    )
  })

  it('always forces a renormalization-worthy claim in scientific-notation-error-analysis', () => {
    setRng(seededRng(0xc22_1005))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade8MathUnit2Question(
        'scientific-notation-error-analysis',
        3,
      )
      expect(question.parameters.claimedCoeff).toBeGreaterThanOrEqual(10)
    }
  })

  it('always keeps divide operands as a clean (non-repeating) quotient', () => {
    setRng(seededRng(0xc22_1006))
    for (let run = 0; run < 300; run++) {
      const question = generateGrade8MathUnit2Question(
        'operate-scientific-notation',
        3,
      )
      if (question.parameters.mode !== 'divide') continue
      const { c1, c2 } = question.parameters
      expect(c1 % c2 === 0 || (c1 * 10) % c2 === 0).toBe(true)
    }
  })
})
