import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer } from './generatorCore'
import {
  GRADE7_MATH_UNIT7_ITEM_TYPES,
  generateGrade7MathUnit7Question,
  type Grade7MathUnit7ItemType,
  type Grade7MathUnit7Question,
} from './grade7MathUnit7Generator'

const RUNS_PER_DIFFICULTY = 200
const DIFFICULTIES = [1, 2, 3] as const

afterEach(() => setRng(null))

/**
 * The oracle below never imports arithmetic from grade7MathUnit7Generator.ts.
 * It parses the RENDERED PROMPT TEXT with independent regexes and recomputes
 * the answer with its own BigInt-exact fraction math, then compares the
 * result to the generator's actual answer text.
 */

interface BigFraction {
  num: bigint
  den: bigint
}

function bfGcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) {
    ;[x, y] = [y, x % y]
  }
  return x === 0n ? 1n : x
}

function bfReduce(f: BigFraction): BigFraction {
  const sign = f.den < 0n ? -1n : 1n
  const num = f.num * sign
  const den = f.den < 0n ? -f.den : f.den
  if (num === 0n) return { num: 0n, den: 1n }
  const divisor = bfGcd(num < 0n ? -num : num, den)
  return { num: num / divisor, den: den / divisor }
}

function bfInt(n: number | bigint): BigFraction {
  return { num: BigInt(n), den: 1n }
}

function bfAdd(a: BigFraction, b: BigFraction): BigFraction {
  return bfReduce({ num: a.num * b.den + b.num * a.den, den: a.den * b.den })
}

function bfMul(a: BigFraction, b: BigFraction): BigFraction {
  return bfReduce({ num: a.num * b.num, den: a.den * b.den })
}

function bfDiv(a: BigFraction, b: BigFraction): BigFraction {
  return bfReduce({ num: a.num * b.den, den: a.den * b.num })
}

function bfMixedText(f: BigFraction): string {
  const r = bfReduce(f)
  if (r.den === 1n) return r.num.toString()
  const whole = r.num / r.den
  const remainder = r.num - whole * r.den
  if (whole === 0n) return `${remainder}/${r.den}`
  return remainder === 0n ? whole.toString() : `${whole} ${remainder}/${r.den}`
}

function bfFractionText(f: BigFraction): string {
  const r = bfReduce(f)
  return r.den === 1n ? r.num.toString() : `${r.num}/${r.den}`
}

function parseMixedNumber(text: string): BigFraction {
  const trimmed = text.trim()
  let m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed)
  if (m) {
    const whole = BigInt(m[1])
    const n = BigInt(m[2])
    const d = BigInt(m[3])
    return bfReduce({ num: whole * d + n, den: d })
  }
  m = /^(\d+)\/(\d+)$/.exec(trimmed)
  if (m) return bfReduce({ num: BigInt(m[1]), den: BigInt(m[2]) })
  m = /^(\d+)$/.exec(trimmed)
  if (m) return { num: BigInt(m[1]), den: 1n }
  throw new Error(`cannot parse number text: "${text}"`)
}

function parsePiCoeff(text: string): BigFraction {
  const m = /^(.+)π$/.exec(text.trim())
  if (!m) throw new Error(`cannot parse pi coefficient: "${text}"`)
  return parseMixedNumber(m[1])
}

function required<T>(match: RegExpExecArray | null, prompt: string): RegExpExecArray {
  if (!match) throw new Error(`prompt did not match expected pattern: "${prompt}"`)
  return match
}

function oracleAnswer(question: Grade7MathUnit7Question): string {
  const prompt = question.prompt
  switch (question.itemType) {
    case 'circumference-from-radius-or-diameter': {
      const m = required(
        /^A circle has a (radius|diameter) of (.+?) (cm|in|ft|m)\. What is its exact circumference\?/.exec(prompt),
        prompt,
      )
      const value = parseMixedNumber(m[2])
      const diameter = m[1] === 'diameter' ? value : bfMul(value, bfInt(2))
      return `${bfFractionText(diameter)}π ${m[3]}`
    }
    case 'find-radius-or-diameter-from-circumference': {
      const m = required(
        /^A circle has a circumference of (.+?)π (cm|in|ft|m)\. What is its exact (radius|diameter)\?$/.exec(prompt),
        prompt,
      )
      const coeff = parseMixedNumber(m[1])
      const answerValue = m[3] === 'radius' ? bfDiv(coeff, bfInt(2)) : coeff
      return `${bfMixedText(answerValue)} ${m[2]}`
    }
    case 'area-of-circle-from-radius-or-diameter': {
      const m = required(
        /^A circle has a (radius|diameter) of (.+?) (cm|in|ft|m)\. What is its exact area\?/.exec(prompt),
        prompt,
      )
      const value = parseMixedNumber(m[2])
      const radius = m[1] === 'radius' ? value : bfDiv(value, bfInt(2))
      const areaCoeff = bfMul(radius, radius)
      return `${bfFractionText(areaCoeff)}π ${m[3]}²`
    }
    case 'circumference-area-relationship': {
      const m = required(/circumference of (.+?)π (cm|in|ft|m)\. Use this relationship/.exec(prompt), prompt)
      const k = parseMixedNumber(m[1])
      const radius = bfDiv(k, bfInt(2))
      const areaCoeff = bfMul(radius, radius)
      return `${bfFractionText(areaCoeff)}π ${m[2]}²`
    }
    case 'complementary-supplementary-angle': {
      const m = required(
        /^Two angles are (complementary|supplementary)\. One angle measures (\d+)°\./.exec(prompt),
        prompt,
      )
      const total = m[1] === 'complementary' ? 90 : 180
      return `${total - Number(m[2])}°`
    }
    case 'vertical-angles-with-expressions': {
      const m = required(
        /measure \((\d+)x ([+-]) (\d+)\)° and \((\d+)x ([+-]) (\d+)\)°/.exec(prompt),
        prompt,
      )
      const a = Number(m[1])
      const b = (m[2] === '+' ? 1 : -1) * Number(m[3])
      const c = Number(m[4])
      const d = (m[5] === '+' ? 1 : -1) * Number(m[6])
      const x = (d - b) / (a - c)
      if (!Number.isInteger(x)) throw new Error(`non-integer x for vertical angles: ${x}`)
      const angle = a * x + b
      return `x = ${x}, each angle measures ${angle}°`
    }
    case 'angle-equation-multistep': {
      const m = required(
        /measures are \((\d+)x ([+-]) (\d+)\)° and \((\d+)x ([+-]) (\d+)\)°/.exec(prompt),
        prompt,
      )
      const a = Number(m[1])
      const b = (m[2] === '+' ? 1 : -1) * Number(m[3])
      const c = Number(m[4])
      const d = (m[5] === '+' ? 1 : -1) * Number(m[6])
      const x = (180 - b - d) / (a + c)
      if (!Number.isInteger(x)) throw new Error(`non-integer x for supplementary algebra: ${x}`)
      const angle1 = a * x + b
      const angle2 = 180 - angle1
      return `x = ${x}, angles measure ${angle1}° and ${angle2}°`
    }
    case 'angles-on-a-line-or-around-a-point': {
      const m = required(/measure (.+)\. What is the value of x\?/.exec(prompt), prompt)
      const mode = prompt.includes('around a point') ? 'point' : 'line'
      const total = mode === 'point' ? 360 : 180
      const knowns = [...m[1].matchAll(/(\d+)°/g)].map((k) => Number(k[1]))
      const sum = knowns.reduce((total_, v) => total_ + v, 0)
      return `${total - sum}°`
    }
    case 'area-of-composite-figure': {
      if (prompt.includes('cut out')) {
        const m = required(
          /a (\d+)-by-(\d+) rectangle with a (\d+)-by-(\d+) rectangular corner cut out/.exec(prompt),
          prompt,
        )
        const area = Number(m[1]) * Number(m[2]) - Number(m[3]) * Number(m[4])
        return bfMixedText(bfInt(area))
      }
      const m = required(/a (\d+)-by-(\d+) rectangle topped by a triangle.*height is (\d+) units/.exec(prompt), prompt)
      const rectW = Number(m[1])
      const rectH = Number(m[2])
      const triHeight = Number(m[3])
      const area = bfAdd(bfInt(rectW * rectH), bfDiv(bfInt(rectW * triHeight), bfInt(2)))
      return bfMixedText(area)
    }
    case 'missing-dimension-from-area': {
      const m = required(/an area of (\d+) square units and a width of (\d+) units/.exec(prompt), prompt)
      return bfMixedText(bfDiv(bfInt(Number(m[1])), bfInt(Number(m[2]))))
    }
    case 'surface-area-of-rectangular-prism': {
      const m = required(/length (\d+), width (\d+), and height (.+?) \(all in units\)/.exec(prompt), prompt)
      const l = bfInt(Number(m[1]))
      const w = bfInt(Number(m[2]))
      const h = parseMixedNumber(m[3])
      const lw = bfMul(l, w)
      const lh = bfMul(l, h)
      const wh = bfMul(w, h)
      const surfaceArea = bfMul(bfAdd(bfAdd(lw, lh), wh), bfInt(2))
      return bfMixedText(surfaceArea)
    }
    case 'volume-of-rectangular-prism': {
      const m = required(/length (\d+), width (\d+), and height (.+?) \(units\)/.exec(prompt), prompt)
      const l = bfInt(Number(m[1]))
      const w = bfInt(Number(m[2]))
      const h = parseMixedNumber(m[3])
      const volume = bfMul(bfMul(l, w), h)
      return `${bfMixedText(volume)} cubic units`
    }
  }
}

describe('grade7MathUnit7Generator', () => {
  describe.each(GRADE7_MATH_UNIT7_ITEM_TYPES)('%s', (itemType: Grade7MathUnit7ItemType) => {
    it(`matches an independent prompt-parsing oracle across ${RUNS_PER_DIFFICULTY} runs per difficulty`, () => {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < RUNS_PER_DIFFICULTY; i++) {
          const question = generateGrade7MathUnit7Question(itemType, difficulty)
          expect(question.itemType).toBe(itemType)
          expect(question.difficulty).toBe(difficulty)
          expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
        }
      }
    })
  })

  it('reaches every item type at every difficulty (coverage)', () => {
    for (const itemType of GRADE7_MATH_UNIT7_ITEM_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        const question = generateGrade7MathUnit7Question(itemType, difficulty)
        expect(question.itemType).toBe(itemType)
        expect(question.difficulty).toBe(difficulty)
      }
    }
  })

  function seededRng(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state / 0x1_0000_0000
    }
  }

  it('produces distinct, non-empty, in-domain choices under a constant injected RNG', () => {
    setRng(seededRng(20260805))
    for (const itemType of GRADE7_MATH_UNIT7_ITEM_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 25; i++) {
          const question = generateGrade7MathUnit7Question(itemType, difficulty)
          expect(question.choices.length).toBe(new Set(question.choices).size)
          expect(question.choices).toContain(curriculumAnswer(question))
          for (const choice of question.choices) {
            expect(choice.trim()).not.toBe('')
            expect(choice).not.toMatch(/^-/)
          }
        }
      }
    }
  })

  it('exercises fractional radius/diameter values at difficulty 3 and still verifies exactly', () => {
    let sawFraction = false
    for (let i = 0; i < 100; i++) {
      const question = generateGrade7MathUnit7Question('circumference-from-radius-or-diameter', 3)
      if (question.parameters.value.den !== 1) sawFraction = true
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(sawFraction).toBe(true)
  })

  it('constructs missing-dimension-from-area at difficulty 3 so the length is never a whole number', () => {
    for (let i = 0; i < 100; i++) {
      const question = generateGrade7MathUnit7Question('missing-dimension-from-area', 3)
      expect(question.parameters.area % question.parameters.width).not.toBe(0)
      expect(curriculumAnswer(question)).toMatch(/\//)
    }
  })

  it('exercises negative constant terms in linear angle expressions', () => {
    let sawNegativeConstant = false
    for (let i = 0; i < 100; i++) {
      const question = generateGrade7MathUnit7Question('vertical-angles-with-expressions', 3)
      if (question.prompt.includes('- ')) sawNegativeConstant = true
      expect(curriculumAnswer(question)).toBe(oracleAnswer(question))
    }
    expect(sawNegativeConstant).toBe(true)
  })

  it('exercises fractional prism heights at difficulty 3 for surface area and volume', () => {
    let sawFractionalHeightSA = false
    let sawFractionalHeightVolume = false
    for (let i = 0; i < 100; i++) {
      const sa = generateGrade7MathUnit7Question('surface-area-of-rectangular-prism', 3)
      if (sa.parameters.h.den !== 1) sawFractionalHeightSA = true
      expect(curriculumAnswer(sa)).toBe(oracleAnswer(sa))
      const vol = generateGrade7MathUnit7Question('volume-of-rectangular-prism', 3)
      if (vol.parameters.h.den !== 1) sawFractionalHeightVolume = true
      expect(curriculumAnswer(vol)).toBe(oracleAnswer(vol))
    }
    expect(sawFractionalHeightSA).toBe(true)
    expect(sawFractionalHeightVolume).toBe(true)
  })

  it('keeps every angles-on-a-line-or-around-a-point known angle and x strictly positive', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 100; i++) {
        const question = generateGrade7MathUnit7Question('angles-on-a-line-or-around-a-point', difficulty)
        expect(question.parameters.x).toBeGreaterThan(0)
        for (const known of question.parameters.knowns) expect(known).toBeGreaterThan(0)
      }
    }
  })
})
